import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import sanitize from 'sanitize-filename';
import _ from 'lodash';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { tryParse } from '../util.js';

/**
 * Reads a World Info file and returns its contents
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {string} worldInfoName Name of the World Info file
 * @param {boolean} allowDummy If true, returns an empty object if the file doesn't exist
 * @returns {object} World Info file contents
 */
export function readWorldInfoFile(directories, worldInfoName, allowDummy) {
    const dummyObject = allowDummy ? { entries: {} } : null;

    if (!worldInfoName) {
        return dummyObject;
    }

    const filename = sanitize(`${worldInfoName}.json`);
    const pathToWorldInfo = path.join(directories.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        console.error(`World info file ${filename} doesn't exist.`);
        return dummyObject;
    }

    const worldInfoText = fs.readFileSync(pathToWorldInfo, 'utf8');
    const worldInfo = JSON.parse(worldInfoText);
    return worldInfo;
}

/**
 * Gets World Info entries for a character
 * Loads the World Info file specified in character.data.extensions.world
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {object} characterData Character data object (must have data.extensions.world)
 * @returns {Array<object>} Array of World Info entries with 'world' field added
 */
export function getCharacterWorldInfo(directories, characterData) {
    // Get World Info name from character data
    const worldInfoName = characterData?.data?.extensions?.world || characterData?.data?.world || '';
    
    if (!worldInfoName) {
        return [];
    }

    // Load World Info file
    const worldInfo = readWorldInfoFile(directories, worldInfoName, true);
    
    if (!worldInfo || !worldInfo.entries) {
        return [];
    }

    // Convert entries object to array and add 'world' field
    const entries = Object.keys(worldInfo.entries).map((uid) => {
        const entry = worldInfo.entries[uid];
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return null;
        }
        // Ensure key and keysecondary are arrays
        if (!Array.isArray(entry.key)) {
            entry.key = [];
        }
        if (!Array.isArray(entry.keysecondary)) {
            entry.keysecondary = [];
        }
        // Add world field to identify which World Info book this entry belongs to
        return {
            ...entry,
            uid: Number(uid) || entry.uid || 0,
            world: worldInfoName,
        };
    }).filter(entry => entry !== null);

    return entries;
}

/**
 * Gets Global World Info entries
 * Loads World Info files specified in selected_world_info settings
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {string[]} selectedWorldInfo Array of World Info names to load
 * @returns {Array<object>} Array of World Info entries with 'world' field added
 */
export function getGlobalLore(directories, selectedWorldInfo) {
    if (!selectedWorldInfo || !Array.isArray(selectedWorldInfo) || selectedWorldInfo.length === 0) {
        return [];
    }

    let entries = [];
    for (const worldName of selectedWorldInfo) {
        const worldInfo = readWorldInfoFile(directories, worldName, true);
        if (worldInfo && worldInfo.entries) {
            const newEntries = Object.keys(worldInfo.entries).map((uid) => {
                const entry = worldInfo.entries[uid];
                if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                    return null;
                }
                // Ensure key and keysecondary are arrays
                if (!Array.isArray(entry.key)) {
                    entry.key = [];
                }
                if (!Array.isArray(entry.keysecondary)) {
                    entry.keysecondary = [];
                }
                return {
                    ...entry,
                    uid: Number(uid) || entry.uid || 0,
                    world: worldName,
                };
            }).filter(entry => entry !== null);
            entries = entries.concat(newEntries);
        }
    }

    return entries;
}

/**
 * World Info insertion strategy enum
 */
export const world_info_insertion_strategy = {
    evenly: 0,
    character_first: 1,
    global_first: 2,
};

/**
 * Sort function for World Info entries (higher order comes first)
 * @param {object} a First entry
 * @param {object} b Second entry
 * @returns {number} Sort comparison result
 */
function sortWorldInfoEntries(a, b) {
    const orderA = a.order || 100;
    const orderB = b.order || 100;
    return orderB - orderA; // Higher order comes first
}

/**
 * Gets sorted World Info entries from all sources
 * Combines Global Lore and Character Lore, then sorts them according to strategy
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {object} characterData Character data object
 * @param {string[]} selectedWorldInfo Array of selected World Info names (from settings)
 * @param {number} characterStrategy Strategy for combining Character and Global Lore (0=evenly, 1=character_first, 2=global_first)
 * @returns {Array<object>} Sorted array of World Info entries
 */
export function getSortedEntries(directories, characterData, selectedWorldInfo = [], characterStrategy = 0) {
    try {
        // Get entries from both sources
        const globalLore = getGlobalLore(directories, selectedWorldInfo);
        const characterLore = getCharacterWorldInfo(directories, characterData);

        // Check for duplicates (if character's world is already in global lore, skip it)
        const characterWorldName = characterData?.data?.extensions?.world || characterData?.data?.world || '';
        const globalLoreWorlds = new Set(selectedWorldInfo);
        
        // Filter out character lore if it's already in global lore
        const filteredCharacterLore = characterWorldName && globalLoreWorlds.has(characterWorldName)
            ? []
            : characterLore;

        let entries;

        // Sort according to strategy
        switch (Number(characterStrategy)) {
            case world_info_insertion_strategy.character_first:
                entries = [...filteredCharacterLore.sort(sortWorldInfoEntries), ...globalLore.sort(sortWorldInfoEntries)];
                break;
            case world_info_insertion_strategy.global_first:
                entries = [...globalLore.sort(sortWorldInfoEntries), ...filteredCharacterLore.sort(sortWorldInfoEntries)];
                break;
            case world_info_insertion_strategy.evenly:
            default:
                entries = [...globalLore, ...filteredCharacterLore].sort(sortWorldInfoEntries);
                break;
        }

        return entries;
    } catch (error) {
        console.error('[WI] Error getting sorted entries:', error);
        return [];
    }
}

/**
 * Converts chat history to a searchable text string
 * @param {Array<object>} chatHistory Array of chat messages
 * @param {number} scanDepth Maximum depth to scan (number of messages from the end)
 * @returns {string} Combined text from chat messages
 */
function convertChatToText(chatHistory, scanDepth = 100) {
    if (!chatHistory || chatHistory.length === 0) {
        return '';
    }

    // Get messages from the end (most recent first in reverse order)
    const messagesToScan = chatHistory.slice(-scanDepth);
    
    // Extract message text (skip system messages)
    const textParts = messagesToScan
        .filter(item => item && item.mes && typeof item.mes === 'string' && !item.is_system)
        .map(item => item.mes.trim())
        .filter(text => text.length > 0);

    return textParts.join('\n');
}

/**
 * Simple keyword matching (basic version for Phase 1.3)
 * @param {string} text Text to search in
 * @param {string} keyword Keyword to search for
 * @param {boolean} caseSensitive Whether to match case (default: false)
 * @returns {boolean} True if keyword is found
 */
function matchKeyword(text, keyword, caseSensitive = false) {
    if (!text || !keyword) {
        return false;
    }

    const searchText = caseSensitive ? text : text.toLowerCase();
    const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();

    return searchText.includes(searchKeyword);
}

/**
 * World Info selective logic enum
 */
export const world_info_logic = {
    AND_ANY: 0,   // Primary AND (any Secondary) - 하나라도 매칭되면 활성화
    NOT_ALL: 1,   // Primary AND NOT (all Secondary) - 하나라도 매칭되지 않으면 활성화
    NOT_ANY: 2,   // Primary AND NOT (any Secondary) - 모두 매칭되지 않으면 활성화
    AND_ALL: 3,   // Primary AND (all Secondary) - 모두 매칭되면 활성화
};

/**
 * Checks Secondary Keywords against chat text based on selective logic
 * @param {string} chatText Chat text to search in
 * @param {Array<string>} secondaryKeywords Array of secondary keywords
 * @param {number} selectiveLogic Selective logic to use
 * @returns {boolean} True if secondary keywords match according to logic
 */
function checkSecondaryKeywords(chatText, secondaryKeywords, selectiveLogic) {
    if (!secondaryKeywords || secondaryKeywords.length === 0) {
        return true; // No secondary keywords means always pass
    }

    let hasAnyMatch = false;
    let hasAllMatch = true;

    // Check each secondary keyword
    for (const keyword of secondaryKeywords) {
        if (!keyword || typeof keyword !== 'string') {
            continue;
        }

        const hasMatch = matchKeyword(chatText, keyword.trim(), false);

        if (hasMatch) {
            hasAnyMatch = true;
        } else {
            hasAllMatch = false;
        }

        // Early exit for AND_ANY: 하나라도 매칭되면 바로 활성화
        if (selectiveLogic === world_info_logic.AND_ANY && hasMatch) {
            return true;
        }

        // Early exit for NOT_ALL: 하나라도 매칭되지 않으면 바로 활성화
        if (selectiveLogic === world_info_logic.NOT_ALL && !hasMatch) {
            return true;
        }
    }

    // Handle NOT_ANY: 모두 매칭되지 않으면 활성화
    if (selectiveLogic === world_info_logic.NOT_ANY && !hasAnyMatch) {
        return true;
    }

    // Handle AND_ALL: 모두 매칭되면 활성화
    if (selectiveLogic === world_info_logic.AND_ALL && hasAllMatch) {
        return true;
    }

    return false;
}

/**
 * Checks World Info entries against chat history and returns activated entries
 * Checks Primary Keywords and Secondary Keywords based on selective logic
 * @param {Array<object>} entries Array of World Info entries
 * @param {Array<object>} chatHistory Array of chat messages
 * @param {number} scanDepth Maximum depth to scan (default: 100)
 * @returns {Array<object>} Array of activated entries
 */
export function checkWorldInfo(entries, chatHistory = [], scanDepth = 100) {
    if (!entries || entries.length === 0) {
        return [];
    }

    // Convert chat history to searchable text
    const chatText = convertChatToText(chatHistory, scanDepth);

    if (!chatText) {
        // No chat text to search, return empty array
        return [];
    }

    const activatedEntries = [];

    for (const entry of entries) {
        // Skip entries without keys
        if (!entry.key || !Array.isArray(entry.key) || entry.key.length === 0) {
            continue;
        }

        // Skip disabled entries
        if (entry.disable === true) {
            continue;
        }

        // Check constant entries (always activated)
        if (entry.constant === true) {
            activatedEntries.push(entry);
            continue;
        }

        // Check Primary Keywords
        let primaryMatch = false;
        for (const keyword of entry.key) {
            if (!keyword || typeof keyword !== 'string') {
                continue;
            }

            // Basic keyword matching (case-insensitive by default)
            // TODO: Add case sensitivity and whole word matching in Phase 3
            if (matchKeyword(chatText, keyword.trim(), false)) {
                primaryMatch = true;
                break;
            }
        }

        // Primary keyword must match first
        if (!primaryMatch) {
            continue;
        }

        // Check if entry has Secondary Keywords
        const hasSecondaryKeywords = entry.keysecondary && 
            Array.isArray(entry.keysecondary) && 
            entry.keysecondary.length > 0;

        // If no secondary keywords, activate immediately
        if (!hasSecondaryKeywords) {
            activatedEntries.push(entry);
            continue;
        }

        // Check Secondary Keywords based on selective logic
        const selectiveLogic = entry.selectiveLogic ?? world_info_logic.AND_ANY;
        const secondaryMatch = checkSecondaryKeywords(
            chatText,
            entry.keysecondary,
            selectiveLogic
        );

        if (secondaryMatch) {
            activatedEntries.push(entry);
        }
    }

    return activatedEntries;
}

/**
 * World Info position enum (basic version for Phase 1.4)
 */
export const world_info_position = {
    before: 0,
    after: 1,
    // Other positions will be added in later phases
    // ANTop: 2,
    // ANBottom: 3,
    // atDepth: 4,
    // EMTop: 5,
    // EMBottom: 6,
    // outlet: 7,
};

/**
 * Formats a World Info entry for prompt inclusion
 * @param {object} entry World Info entry
 * @returns {string} Formatted entry text
 */
function formatWorldInfoEntry(entry) {
    if (!entry || !entry.content) {
        return '';
    }

    const keys = entry.key && Array.isArray(entry.key) && entry.key.length > 0
        ? entry.key.join(', ')
        : '';

    // Format: "keys: content" or just "content" if no keys
    return keys ? `${keys}: ${entry.content}` : entry.content;
}

/**
 * Formats activated World Info entries into prompt strings
 * Separates entries by position (Before/After) and formats them
 * @param {Array<object>} activatedEntries Array of activated World Info entries
 * @returns {object} Object with worldInfoBefore and worldInfoAfter strings
 */
export function formatWorldInfo(activatedEntries) {
    if (!activatedEntries || activatedEntries.length === 0) {
        return {
            worldInfoBefore: '',
            worldInfoAfter: '',
        };
    }

    const beforeEntries = [];
    const afterEntries = [];

    // Sort entries by order (higher order first, then reverse for insertion order)
    const sortedEntries = [...activatedEntries].sort((a, b) => {
        const orderA = a.order || 100;
        const orderB = b.order || 100;
        return orderB - orderA; // Higher order comes first
    });

    // Separate entries by position
    for (const entry of sortedEntries) {
        const formatted = formatWorldInfoEntry(entry);
        if (!formatted) {
            continue;
        }

        const position = entry.position ?? world_info_position.before;

        switch (position) {
            case world_info_position.after:
                afterEntries.push(formatted);
                break;
            case world_info_position.before:
            default:
                beforeEntries.push(formatted);
                break;
        }
    }

    return {
        worldInfoBefore: beforeEntries.join('\n\n'),
        worldInfoAfter: afterEntries.join('\n\n'),
    };
}

export const router = express.Router();

router.post('/list', async (request, response) => {
    try {
        const data = [];
        const jsonFiles = (await fs.promises.readdir(request.user.directories.worlds, { withFileTypes: true }))
            .filter((file) => file.isFile() && path.extname(file.name).toLowerCase() === '.json')
            .sort((a, b) => a.name.localeCompare(b.name));

        for (const file of jsonFiles) {
            try {
                const filePath = path.join(request.user.directories.worlds, file.name);
                const fileContents = await fs.promises.readFile(filePath, 'utf8');
                const fileContentsParsed = tryParse(fileContents) || {};
                const fileExtensions = fileContentsParsed?.extensions || {};
                const fileNameWithoutExt = path.parse(file.name).name;
                const fileData = {
                    file_id: fileNameWithoutExt,
                    name: fileContentsParsed?.name || fileNameWithoutExt,
                    extensions: _.isObjectLike(fileExtensions) ? fileExtensions : {},
                };
                data.push(fileData);
            } catch (err) {
                console.warn(`Error reading or parsing World Info file ${file.name}:`, err);
            }
        }

        return response.send(data);
    } catch (err) {
        console.error('Error reading World Info directory:', err);
        return response.sendStatus(500);
    }
});

router.post('/get', (request, response) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }

    const file = readWorldInfoFile(request.user.directories, request.body.name, true);

    return response.send(file);
});

router.post('/delete', (request, response) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }

    const worldInfoName = request.body.name;
    const filename = sanitize(`${worldInfoName}.json`);
    const pathToWorldInfo = path.join(request.user.directories.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        throw new Error(`World info file ${filename} doesn't exist.`);
    }

    fs.unlinkSync(pathToWorldInfo);

    return response.sendStatus(200);
});

router.post('/import', (request, response) => {
    if (!request.file) return response.sendStatus(400);

    const filename = `${path.parse(sanitize(request.file.originalname)).name}.json`;

    let fileContents = null;

    if (request.body.convertedData) {
        fileContents = request.body.convertedData;
    } else {
        const pathToUpload = path.join(request.file.destination, request.file.filename);
        fileContents = fs.readFileSync(pathToUpload, 'utf8');
        fs.unlinkSync(pathToUpload);
    }

    try {
        const worldContent = JSON.parse(fileContents);
        if (!('entries' in worldContent)) {
            throw new Error('File must contain a world info entries list');
        }
    } catch (err) {
        return response.status(400).send('Is not a valid world info file');
    }

    const pathToNewFile = path.join(request.user.directories.worlds, filename);
    const worldName = path.parse(pathToNewFile).name;

    if (!worldName) {
        return response.status(400).send('World file must have a name');
    }

    writeFileAtomicSync(pathToNewFile, fileContents);
    return response.send({ name: worldName });
});

router.post('/edit', (request, response) => {
    if (!request.body) {
        return response.sendStatus(400);
    }

    if (!request.body.name) {
        return response.status(400).send('World file must have a name');
    }

    try {
        if (!('entries' in request.body.data)) {
            throw new Error('World info must contain an entries list');
        }
    } catch (err) {
        return response.status(400).send('Is not a valid world info file');
    }

    const filename = sanitize(`${request.body.name}.json`);
    const pathToFile = path.join(request.user.directories.worlds, filename);

    writeFileAtomicSync(pathToFile, JSON.stringify(request.body.data, null, 4));

    return response.send({ ok: true });
});
