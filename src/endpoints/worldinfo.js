import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import express from 'express';
import sanitize from 'sanitize-filename';
import _ from 'lodash';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { tryParse } from '../util.js';

/**
 * Generates a hash value for a given string (compatible with client-side getStringHash)
 * Uses the same algorithm as the client-side implementation
 * @param {string} str Input string
 * @param {number} seed Seed value (default: 0)
 * @returns {number} Hash value
 */
function getStringHash(str, seed = 0) {
    if (typeof str !== 'string') {
        return 0;
    }

    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

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
        // Normalize extensions fields (caseSensitive, matchWholeWords can be in extensions or directly on entry)
        const normalizedEntry = {
            ...entry,
            uid: Number(uid) || entry.uid || 0,
            world: worldInfoName,
        };
        
        // Extract caseSensitive, matchWholeWords, scanDepth, probability, and useProbability from extensions if they exist
        if (entry.extensions) {
            if (entry.extensions.case_sensitive !== undefined && normalizedEntry.caseSensitive === undefined) {
                normalizedEntry.caseSensitive = entry.extensions.case_sensitive;
            }
            if (entry.extensions.match_whole_words !== undefined && normalizedEntry.matchWholeWords === undefined) {
                normalizedEntry.matchWholeWords = entry.extensions.match_whole_words;
            }
            if (entry.extensions.scan_depth !== undefined && normalizedEntry.scanDepth === undefined) {
                normalizedEntry.scanDepth = entry.extensions.scan_depth;
            }
            if (entry.extensions.probability !== undefined && normalizedEntry.probability === undefined) {
                normalizedEntry.probability = entry.extensions.probability;
            }
            if (entry.extensions.useProbability !== undefined && normalizedEntry.useProbability === undefined) {
                normalizedEntry.useProbability = entry.extensions.useProbability;
            }
        }
        
        return normalizedEntry;
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
                
                // Normalize extensions fields (caseSensitive, matchWholeWords can be in extensions or directly on entry)
                const normalizedEntry = {
                    ...entry,
                    uid: Number(uid) || entry.uid || 0,
                    world: worldName,
                };
                
                // Extract caseSensitive, matchWholeWords, scanDepth, probability, and useProbability from extensions if they exist
                if (entry.extensions) {
                    if (entry.extensions.case_sensitive !== undefined && normalizedEntry.caseSensitive === undefined) {
                        normalizedEntry.caseSensitive = entry.extensions.case_sensitive;
                    }
                    if (entry.extensions.match_whole_words !== undefined && normalizedEntry.matchWholeWords === undefined) {
                        normalizedEntry.matchWholeWords = entry.extensions.match_whole_words;
                    }
                    if (entry.extensions.scan_depth !== undefined && normalizedEntry.scanDepth === undefined) {
                        normalizedEntry.scanDepth = entry.extensions.scan_depth;
                    }
                    if (entry.extensions.probability !== undefined && normalizedEntry.probability === undefined) {
                        normalizedEntry.probability = entry.extensions.probability;
                    }
                    if (entry.extensions.useProbability !== undefined && normalizedEntry.useProbability === undefined) {
                        normalizedEntry.useProbability = entry.extensions.useProbability;
                    }
                }
                
                return normalizedEntry;
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
 * Simple keyword matching with case sensitivity and whole word matching support
 * @param {string} text Text to search in
 * @param {string} keyword Keyword to search for
 * @param {boolean} caseSensitive Whether to match case (default: false)
 * @param {boolean} matchWholeWords Whether to match whole words only (default: false)
 * @returns {boolean} True if keyword is found
 */
function matchKeyword(text, keyword, caseSensitive = false, matchWholeWords = false) {
    if (!text || !keyword) {
        return false;
    }

    const searchText = caseSensitive ? text : text.toLowerCase();
    const searchKeyword = caseSensitive ? keyword.trim() : keyword.trim().toLowerCase();

    if (!searchKeyword) {
        return false;
    }

    // Whole word matching: use word boundary regex
    if (matchWholeWords) {
        // Escape special regex characters in keyword
        const escapedKeyword = searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Use word boundary (\b) to match whole words only
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, caseSensitive ? 'g' : 'gi');
        return regex.test(searchText);
    }

    // Simple substring matching
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
 * @param {boolean} caseSensitive Whether to match case
 * @param {boolean} matchWholeWords Whether to match whole words only
 * @returns {boolean} True if secondary keywords match according to logic
 */
function checkSecondaryKeywords(chatText, secondaryKeywords, selectiveLogic, caseSensitive = false, matchWholeWords = false) {
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

        const hasMatch = matchKeyword(chatText, keyword.trim(), caseSensitive, matchWholeWords);

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
 * Generates query text from chat history for vector search
 * Takes the most recent N messages and combines them into a query string
 * @param {Array<object>} chatHistory Array of chat messages
 * @param {number} queryMessageCount Number of recent messages to include (default: 2)
 * @returns {string} Query text for vector search
 */
function getQueryTextForVectorSearch(chatHistory, queryMessageCount = 2) {
    if (!chatHistory || chatHistory.length === 0) {
        return '';
    }

    // Get recent messages (most recent first)
    const recentMessages = chatHistory
        .slice(-queryMessageCount)
        .filter(item => item && item.mes && typeof item.mes === 'string' && !item.is_system)
        .map(item => item.mes.trim())
        .filter(text => text.length > 0);

    return recentMessages.join('\n').trim();
}

/**
 * Checks World Info entries against chat history and returns activated entries
 * Checks Primary Keywords and Secondary Keywords based on selective logic
 * Supports case sensitivity, whole word matching, and scan depth (global and entry-specific)
 * @param {Array<object>} entries Array of World Info entries
 * @param {Array<object>} chatHistory Array of chat messages
 * @param {number} globalScanDepth Global scan depth setting (default: 100)
 * @param {boolean} globalCaseSensitive Global case sensitivity setting (default: false)
 * @param {boolean} globalMatchWholeWords Global whole word matching setting (default: false)
 * @returns {Array<object>} Array of activated entries
 */
export function checkWorldInfo(entries, chatHistory = [], globalScanDepth = 100, globalCaseSensitive = false, globalMatchWholeWords = false) {
    if (!entries || entries.length === 0) {
        return [];
    }

    if (!chatHistory || chatHistory.length === 0) {
        // No chat history to search, return empty array
        console.log(`[WI] No chat history to search`);
        return [];
    }

    const activatedEntries = [];
    
    // Cache for converted chat texts by scan depth (to avoid redundant conversions)
    const chatTextCache = new Map();

    for (const entry of entries) {
        // Skip entries without keys
        if (!entry.key || !Array.isArray(entry.key) || entry.key.length === 0) {
            continue;
        }

        // Check constant entries (always activated)
        if (entry.constant === true) {
            activatedEntries.push(entry);
            continue;
        }

        // Get entry-specific scan depth (override global if specified)
        // entry.scanDepth can be null/undefined (use global), or a number
        const entryScanDepth = entry.scanDepth !== null && entry.scanDepth !== undefined
            ? entry.scanDepth
            : globalScanDepth;
        
        // Ensure scanDepth is a valid positive number
        const scanDepth = (typeof entryScanDepth === 'number' && entryScanDepth > 0) 
            ? Math.min(entryScanDepth, 1000) // Cap at 1000 for safety
            : globalScanDepth;
        
        // Log entry-specific scan depth if different from global
        if (entryScanDepth !== null && entryScanDepth !== undefined && entryScanDepth !== globalScanDepth) {
            console.log(`[WI] Entry "${entry.key?.[0] || 'unknown'}" using scan depth: ${scanDepth} (entry override)`);
        }

        // Get entry-specific settings (override global if specified)
        // entry.caseSensitive can be null (use global), true, or false
        // entry.matchWholeWords can be null (use global), true, or false
        const caseSensitive = entry.caseSensitive !== null && entry.caseSensitive !== undefined
            ? entry.caseSensitive
            : globalCaseSensitive;
        const matchWholeWords = entry.matchWholeWords !== null && entry.matchWholeWords !== undefined
            ? entry.matchWholeWords
            : globalMatchWholeWords;

        // Convert chat history to searchable text (use cache if available)
        let chatText;
        if (chatTextCache.has(scanDepth)) {
            chatText = chatTextCache.get(scanDepth);
        } else {
            // Calculate actual messages scanned (may be less than scanDepth if chatHistory is shorter)
            const actualScanned = Math.min(chatHistory.length, scanDepth);
            chatText = convertChatToText(chatHistory, scanDepth);
            chatTextCache.set(scanDepth, chatText);
            if (actualScanned < chatHistory.length) {
                console.log(`[WI] Scan depth ${scanDepth}: scanning last ${actualScanned} messages out of ${chatHistory.length} total`);
            }
        }

        if (!chatText) {
            // No chat text to search for this entry, skip
            continue;
        }

        // Check Primary Keywords
        let primaryMatch = false;
        for (const keyword of entry.key) {
            if (!keyword || typeof keyword !== 'string') {
                continue;
            }

            // Keyword matching with case sensitivity and whole word matching
            if (matchKeyword(chatText, keyword.trim(), caseSensitive, matchWholeWords)) {
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
            selectiveLogic,
            caseSensitive,
            matchWholeWords
        );

        if (!secondaryMatch) {
            continue;
        }

        // All keyword checks passed, now check probability
        // Get entry-specific probability settings (default: probability=100, useProbability=true)
        const probability = entry.probability !== null && entry.probability !== undefined
            ? Math.max(0, Math.min(100, entry.probability)) // Clamp to 0-100
            : 100;
        const useProbability = entry.useProbability !== null && entry.useProbability !== undefined
            ? entry.useProbability
            : true;

        // Probability check: if useProbability is false or probability is 100, always activate
        if (useProbability && probability < 100) {
            const rollValue = Math.random() * 100; // Generate random value between 0-100
            if (rollValue > probability) {
                // Failed probability check, skip this entry
                console.log(`[WI] Entry "${entry.key?.[0] || 'unknown'}" failed probability check: ${rollValue.toFixed(2)} > ${probability}%`);
                continue;
            }
            console.log(`[WI] Entry "${entry.key?.[0] || 'unknown'}" passed probability check: ${rollValue.toFixed(2)} <= ${probability}%`);
        }

        // All checks passed, activate entry
        activatedEntries.push(entry);
    }

    // Log scan depth usage if multiple depths were used
    if (chatTextCache.size > 1) {
        console.log(`[WI] Used ${chatTextCache.size} different scan depths: ${Array.from(chatTextCache.keys()).join(', ')}`);
    }

    return activatedEntries;
}

/**
 * Groups World Info entries by world name
 * Filters entries based on vectorization settings and validity
 * @param {Array<object>} entries Array of World Info entries
 * @param {boolean} enabledForAll Whether all entries should be vectorized (enabled_for_all setting)
 * @returns {object} Object with world names as keys and arrays of entries as values
 */
function groupEntriesByWorld(entries, enabledForAll = false) {
    const groupedEntries = {};

    if (!entries || !Array.isArray(entries)) {
        return groupedEntries;
    }

    for (const entry of entries) {
        // Skip orphaned entries (without world field)
        if (!entry.world) {
            console.debug(`[WI] Skipped entry without world field: ${entry.uid || 'unknown'}`);
            continue;
        }

        // Skip disabled entries
        if (entry.disable === true) {
            console.debug(`[WI] Skipped disabled entry: ${entry.uid || 'unknown'}`);
            continue;
        }

        // Skip entries without content
        if (!entry.content || typeof entry.content !== 'string' || entry.content.trim().length === 0) {
            console.debug(`[WI] Skipped entry without content: ${entry.uid || 'unknown'}`);
            continue;
        }

        // Skip non-vectorized entries (unless enabled_for_all is true)
        if (!entry.vectorized && !enabledForAll) {
            console.debug(`[WI] Skipped non-vectorized entry: ${entry.uid || 'unknown'}`);
            continue;
        }

        // Group by world name
        if (!Object.hasOwnProperty.call(groupedEntries, entry.world)) {
            groupedEntries[entry.world] = [];
        }

        groupedEntries[entry.world].push(entry);
    }

    return groupedEntries;
}

/**
 * Gets saved hashes from vector index for a specific world
 * @param {string} world World name
 * @param {string} vectorSource Vector source (e.g., 'transformers')
 * @param {object} sourceSettings Source settings for vector API
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @returns {Promise<number[]>} Array of saved hashes
 */
async function getSavedHashesForWorld(world, vectorSource, sourceSettings, directories) {
    try {
        // Generate collection ID from world name
        const collectionId = `world_${getStringHash(world)}`;

        // Import vector functions
        const { getSavedHashes } = await import('./vectors.js');

        // Get saved hashes from vector index
        const hashes = await getSavedHashes(directories, collectionId, vectorSource, sourceSettings);

        return hashes || [];
    } catch (error) {
        console.warn(`[WI] Failed to get saved hashes for world "${world}":`, error);
        // Return empty array on error (treat as no existing entries)
        return [];
    }
}

/**
 * Activates vectorized World Info entries using vector search
 * @param {Array<object>} vectorizedEntries Array of vectorized World Info entries
 * @param {Array<object>} chatHistory Array of chat messages
 * @param {object} vectorSettings Vector extension settings
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {import('express').Request} request Express request object (for vector API call)
 * @returns {Promise<Array<object>>} Array of activated vectorized entries
 */
export async function checkVectorizedWorldInfo(vectorizedEntries, chatHistory, vectorSettings, directories, request) {
    if (!vectorSettings || !vectorSettings.enabled_world_info) {
        console.log('[WI] Vector search disabled for World Info');
        return [];
    }

    if (!vectorizedEntries || vectorizedEntries.length === 0) {
        console.log('[WI] No vectorized entries to search');
        return [];
    }

    if (!chatHistory || chatHistory.length === 0) {
        console.log('[WI] No chat history for vector search');
        return [];
    }

    // Group entries by world
    const groupedEntries = {};
    for (const entry of vectorizedEntries) {
        // Skip entries without world field
        if (!entry.world) {
            console.log(`[WI] Skipped vectorized entry without world field: ${entry.uid}`);
            continue;
        }

        // Skip entries without content
        if (!entry.content || typeof entry.content !== 'string' || entry.content.trim().length === 0) {
            console.log(`[WI] Skipped vectorized entry without content: ${entry.uid}`);
            continue;
        }

        if (!groupedEntries[entry.world]) {
            groupedEntries[entry.world] = [];
        }
        groupedEntries[entry.world].push(entry);
    }

    if (Object.keys(groupedEntries).length === 0) {
        console.log('[WI] No valid vectorized entries to search');
        return [];
    }

    // Generate collection IDs for each world
    const collectionIds = [];
    for (const world in groupedEntries) {
        const collectionId = `world_${getStringHash(world)}`;
        collectionIds.push(collectionId);
    }

    // Generate query text from chat history
    const queryMessageCount = vectorSettings.query || 2;
    const queryText = getQueryTextForVectorSearch(chatHistory, queryMessageCount);

    if (!queryText || queryText.trim().length === 0) {
        console.log('[WI] No query text generated for vector search');
        return [];
    }

    console.log(`[WI] Vector search query text (${queryMessageCount} messages): "${queryText.substring(0, 100)}${queryText.length > 100 ? '...' : ''}"`);

    // Call vector search API
    try {
        const vectorSource = vectorSettings.source || 'transformers';
        const maxEntries = vectorSettings.max_entries || 5;
        const scoreThreshold = vectorSettings.score_threshold || 0.25;

        // Import vector functions
        const { multiQueryCollection, getSourceSettings } = await import('./vectors.js');
        
        // Create a mock request object with vector settings for getSourceSettings
        // getSourceSettings expects request.body to have source-specific settings
        const mockRequest = {
            body: {
                model: vectorSettings.model || (vectorSource === 'transformers' ? '' : undefined),
                apiUrl: vectorSettings.apiUrl,
                extrasUrl: vectorSettings.extrasUrl,
                extrasKey: vectorSettings.extrasKey,
                keep: vectorSettings.keep,
                embeddings: vectorSettings.embeddings,
            }
        };
        
        // Get source settings from vector settings
        const sourceSettings = getSourceSettings(vectorSource, mockRequest);

        // Perform vector search
        const queryResults = await multiQueryCollection(
            directories,
            collectionIds,
            vectorSource,
            sourceSettings,
            queryText,
            maxEntries,
            scoreThreshold
        );

        // Extract activated hashes from results
        const activatedHashes = [];
        for (const collectionId in queryResults) {
            if (queryResults[collectionId].hashes) {
                activatedHashes.push(...queryResults[collectionId].hashes);
            }
        }

        if (activatedHashes.length === 0) {
            console.log('[WI] No vectorized entries activated (no matches above threshold)');
            return [];
        }

        // Match entries by content hash
        const activatedEntries = [];
        for (const entry of vectorizedEntries) {
            const entryHash = getStringHash(entry.content);
            if (activatedHashes.includes(entryHash)) {
                activatedEntries.push(entry);
            }
        }

        console.log(`[WI] Activated ${activatedEntries.length} vectorized entries via vector search`);
        return activatedEntries;
    } catch (error) {
        console.warn('[WI] Vector search failed:', error);
        return [];
    }
}

/**
 * World Info position enum
 */
export const world_info_position = {
    before: 0,
    after: 1,
    ANTop: 2,
    ANBottom: 3,
    atDepth: 4,
    EMTop: 5,
    EMBottom: 6,
    outlet: 7,
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
 * Separates entries by position (Before/After/ANTop/ANBottom/atDepth/Outlet) and formats them
 * @param {Array<object>} activatedEntries Array of activated World Info entries
 * @returns {object} Object with worldInfoBefore, worldInfoAfter, and other position-specific entries
 */
export function formatWorldInfo(activatedEntries) {
    if (!activatedEntries || activatedEntries.length === 0) {
        return {
            worldInfoBefore: '',
            worldInfoAfter: '',
            anTopEntries: [],
            anBottomEntries: [],
            depthEntries: [],
            outletEntries: {},
        };
    }

    const beforeEntries = [];
    const afterEntries = [];
    const anTopEntries = [];
    const anBottomEntries = [];
    /** @type {Array<{depth: number, entries: string[], role: number}>} */
    const depthEntries = [];
    /** @type {{[key: string]: string[]}} */
    const outletEntries = {};

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
            case world_info_position.before:
                beforeEntries.push(formatted);
                break;
            case world_info_position.after:
                afterEntries.push(formatted);
                break;
            case world_info_position.ANTop:
                anTopEntries.push(formatted);
                break;
            case world_info_position.ANBottom:
                anBottomEntries.push(formatted);
                break;
            case world_info_position.atDepth: {
                // Group by depth and role
                const depth = entry.depth ?? 0;
                const role = entry.role ?? 0; // 0 = system
                const existingDepthIndex = depthEntries.findIndex(
                    (e) => e.depth === depth && e.role === role
                );
                if (existingDepthIndex !== -1) {
                    depthEntries[existingDepthIndex].entries.push(formatted);
                } else {
                    depthEntries.push({
                        depth: depth,
                        entries: [formatted],
                        role: role,
                    });
                }
                break;
            }
            case world_info_position.outlet: {
                // Group by outlet name
                const outletName = entry.outletName || '';
                if (!outletName) {
                    console.warn(`[WI] Entry has position 'outlet' but no outletName. Skipping.`);
                    break;
                }
                if (Array.isArray(outletEntries[outletName])) {
                    outletEntries[outletName].push(formatted);
                } else {
                    outletEntries[outletName] = [formatted];
                }
                break;
            }
            case world_info_position.EMTop:
            case world_info_position.EMBottom:
                // Example Messages - not implemented yet, treat as before for now
                beforeEntries.push(formatted);
                break;
            default:
                // Unknown position, treat as before
                beforeEntries.push(formatted);
                break;
        }
    }

    return {
        worldInfoBefore: beforeEntries.join('\n\n'),
        worldInfoAfter: afterEntries.join('\n\n'),
        anTopEntries: anTopEntries,
        anBottomEntries: anBottomEntries,
        depthEntries: depthEntries,
        outletEntries: outletEntries,
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
