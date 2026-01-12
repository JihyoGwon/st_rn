import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import process from 'node:process';

import express from 'express';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import _ from 'lodash';

import validateAvatarUrlMiddleware from '../middleware/validateFileName.js';
import {
    getConfigValue,
    humanizedDateTime,
    tryParse,
    generateTimestamp,
    removeOldBackups,
    formatBytes,
    tryWriteFileSync,
    tryReadFileSync,
    tryDeleteFile,
    readFirstLine,
} from '../util.js';
import { parse } from '../character-card-parser.js';
import { readWorldInfoFile } from './worldinfo.js';

const isBackupEnabled = !!getConfigValue('backups.chat.enabled', true, 'boolean');
const maxTotalChatBackups = Number(getConfigValue('backups.chat.maxTotalBackups', -1, 'number'));
const throttleInterval = Number(getConfigValue('backups.chat.throttleInterval', 10_000, 'number'));
const checkIntegrity = !!getConfigValue('backups.chat.checkIntegrity', true, 'boolean');

export const CHAT_BACKUPS_PREFIX = 'chat_';

/**
 * Saves a chat to the backups directory.
 * @param {string} directory The user's backup directory.
 * @param {string} name The name of the chat.
 * @param {string} data The serialized chat to save.
 * @param {string} backupPrefix The file prefix. Typically CHAT_BACKUPS_PREFIX.
 * @returns
 */
function backupChat(directory, name, data, backupPrefix = CHAT_BACKUPS_PREFIX) {
    try {
        if (!isBackupEnabled) { return; }
        if (!fs.existsSync(directory)) {
            console.error(`The chat couldn't be backed up because no directory exists at ${directory}!`);
        }
        // replace non-alphanumeric characters with underscores
        name = sanitize(name).replace(/[^a-z0-9]/gi, '_').toLowerCase();

        const backupFile = path.join(directory, `${backupPrefix}${name}_${generateTimestamp()}.jsonl`);

        tryWriteFileSync(backupFile, data);
        removeOldBackups(directory, `${backupPrefix}${name}_`);
        if (isNaN(maxTotalChatBackups) || maxTotalChatBackups < 0) {
            return;
        }
        removeOldBackups(directory, backupPrefix, maxTotalChatBackups);
    } catch (err) {
        console.error(`Could not backup chat for ${name}`, err);
    }
}

/**
 * @type {Map<string, import('lodash').DebouncedFunc<typeof backupChat>>}
 */
const backupFunctions = new Map();

/**
 * Gets a backup function for a user.
 * @param {string} handle User handle
 * @returns {typeof backupChat} Backup function
 */
function getBackupFunction(handle) {
    if (!backupFunctions.has(handle)) {
        backupFunctions.set(handle, _.throttle(backupChat, throttleInterval, { leading: true, trailing: true }));
    }
    return backupFunctions.get(handle) || (() => { });
}

/**
 * Gets a preview message from an array of chat messages
 * @param {Array<Object>} messages - Array of chat messages, each with a 'mes' property
 * @returns {string} A truncated preview of the last message or empty string if no messages
 */
function getPreviewMessage(messages) {
    const strlen = 400;
    const lastMessage = messages[messages.length - 1]?.mes;

    if (!lastMessage) {
        return '';
    }

    return lastMessage.length > strlen
        ? '...' + lastMessage.substring(lastMessage.length - strlen)
        : lastMessage;
}

process.on('exit', () => {
    for (const func of backupFunctions.values()) {
        func.flush();
    }
});

/**
 * Imports a chat from Ooba's format.
 * @param {string} userName User name
 * @param {string} characterName Character name
 * @param {object} jsonData JSON data
 * @returns {string} Chat data
 */
function importOobaChat(userName, characterName, jsonData) {
    /** @type {object[]} */
    const chat = [{
        chat_metadata: {},
        user_name: 'unused',
        character_name: 'unused',
    }];

    for (const arr of jsonData.data_visible) {
        if (arr[0]) {
            const userMessage = {
                name: userName,
                is_user: true,
                send_date: new Date().toISOString(),
                mes: arr[0],
                extra: {},
            };
            chat.push(userMessage);
        }
        if (arr[1]) {
            const charMessage = {
                name: characterName,
                is_user: false,
                send_date: new Date().toISOString(),
                mes: arr[1],
                extra: {},
            };
            chat.push(charMessage);
        }
    }

    return chat.map(obj => JSON.stringify(obj)).join('\n');
}

/**
 * Imports a chat from Agnai's format.
 * @param {string} userName User name
 * @param {string} characterName Character name
 * @param {object} jsonData Chat data
 * @returns {string} Chat data
 */
function importAgnaiChat(userName, characterName, jsonData) {
    /** @type {object[]} */
    const chat = [{
        chat_metadata: {},
        user_name: 'unused',
        character_name: 'unused',
    }];

    for (const message of jsonData.messages) {
        const isUser = !!message.userId;
        chat.push({
            name: isUser ? userName : characterName,
            is_user: isUser,
            send_date: new Date().toISOString(),
            mes: message.msg,
            extra: {},
        });
    }

    return chat.map(obj => JSON.stringify(obj)).join('\n');
}

/**
 * Imports a chat from CAI Tools format.
 * @param {string} userName User name
 * @param {string} characterName Character name
 * @param {object} jsonData JSON data
 * @returns {string[]} Converted data
 */
function importCAIChat(userName, characterName, jsonData) {
    /**
     * Converts the chat data to suitable format.
     * @param {object} history Imported chat data
     * @returns {object[]} Converted chat data
     */
    function convert(history) {
        const starter = {
            chat_metadata: {},
            user_name: 'unused',
            character_name: 'unused',
        };

        const historyData = history.msgs.map((msg) => ({
            name: msg.src.is_human ? userName : characterName,
            is_user: msg.src.is_human,
            send_date: new Date().toISOString(),
            mes: msg.text,
            extra: {},
        }));

        return [starter, ...historyData];
    }

    const newChats = (jsonData.histories.histories ?? []).map(history => newChats.push(convert(history).map(obj => JSON.stringify(obj)).join('\n')));
    return newChats;
}

/**
 * Imports a chat from Kobold Lite format.
 * @param {string} _userName User name
 * @param {string} _characterName Character name
 * @param {object} data JSON data
 * @returns {string} Chat data
 */
function importKoboldLiteChat(_userName, _characterName, data) {
    const inputToken = '{{[INPUT]}}';
    const outputToken = '{{[OUTPUT]}}';

    /** @type {function(string): object} */
    function processKoboldMessage(msg) {
        const isUser = msg.includes(inputToken);
        return {
            name: isUser ? userName : characterName,
            is_user: isUser,
            mes: msg.replaceAll(inputToken, '').replaceAll(outputToken, '').trim(),
            send_date: new Date().toISOString(),
            extra: {},
        };
    }

    // Create the header
    const userName = String(data.savedsettings.chatname);
    const characterName = String(data.savedsettings.chatopponent).split('||$||')[0];
    const header = {
        chat_metadata: {},
        user_name: 'unused',
        character_name: 'unused',
    };
    // Format messages
    const formattedMessages = data.actions.map(processKoboldMessage);
    // Add prompt if available
    if (data.prompt) {
        formattedMessages.unshift(processKoboldMessage(data.prompt));
    }
    // Combine header and messages
    const chatData = [header, ...formattedMessages];
    return chatData.map(obj => JSON.stringify(obj)).join('\n');
}

/**
 * Flattens `msg` and `swipes` data from Chub Chat format.
 * Only changes enough to make it compatible with the standard chat serialization format.
 * @param {string} userName User name
 * @param {string} characterName Character name
 * @param {string[]} lines serialised JSONL data
 * @returns {string} Converted data
 */
function flattenChubChat(userName, characterName, lines) {
    function flattenSwipe(swipe) {
        return swipe.message ? swipe.message : swipe;
    }

    function convert(line) {
        const lineData = tryParse(line);
        if (!lineData) return line;

        if (lineData.mes && lineData.mes.message) {
            lineData.mes = lineData?.mes.message;
        }

        if (lineData?.swipes && Array.isArray(lineData.swipes)) {
            lineData.swipes = lineData.swipes.map(swipe => flattenSwipe(swipe));
        }

        return JSON.stringify(lineData);
    }

    return (lines ?? []).map(convert).join('\n');
}

/**
 * Imports a chat from RisuAI format.
 * @param {string} userName User name
 * @param {string} characterName Character name
 * @param {object} jsonData Imported chat data
 * @returns {string} Chat data
 */
function importRisuChat(userName, characterName, jsonData) {
    /** @type {object[]} */
    const chat = [{
        chat_metadata: {},
        user_name: 'unused',
        character_name: 'unused',
    }];

    for (const message of jsonData.data.message) {
        const isUser = message.role === 'user';
        chat.push({
            name: message.name ?? (isUser ? userName : characterName),
            is_user: isUser,
            send_date: new Date(Number(message.time ?? Date.now())).toISOString(),
            mes: message.data ?? '',
            extra: {},
        });
    }

    return chat.map(obj => JSON.stringify(obj)).join('\n');
}

/**
 * Checks if the chat being saved has the same integrity as the one being loaded.
 * @param {string} filePath Path to the chat file
 * @param {string} integritySlug Integrity slug
 * @returns {Promise<boolean>} Whether the chat is intact
 */
async function checkChatIntegrity(filePath, integritySlug) {
    // If the chat file doesn't exist, assume it's intact
    if (!fs.existsSync(filePath)) {
        return true;
    }

    // Parse the first line of the chat file as JSON
    const firstLine = await readFirstLine(filePath);
    const jsonData = tryParse(firstLine);
    const chatIntegrity = jsonData?.chat_metadata?.integrity;

    // If the chat has no integrity metadata, assume it's intact
    if (!chatIntegrity) {
        console.debug(`File "${filePath}" does not have integrity metadata matching "${integritySlug}". The integrity validation has been skipped.`);
        return true;
    }

    // Check if the integrity matches
    return chatIntegrity === integritySlug;
}

/**
 * @typedef {Object} ChatInfo
 * @property {string} [file_id] - The name of the chat file (without extension)
 * @property {string} [file_name] - The name of the chat file (with extension)
 * @property {string} [file_size] - The size of the chat file in a human-readable format
 * @property {number} [chat_items] - The number of chat items in the file
 * @property {string} [mes] - The last message in the chat
 * @property {number} [last_mes] - The timestamp of the last message
 * @property {object} [chat_metadata] - Additional chat metadata
 */

/**
 * Reads the information from a chat file.
 * @param {string} pathToFile - Path to the chat file
 * @param {object} additionalData - Additional data to include in the result
 * @param {boolean} withMetadata - Whether to read chat metadata
 * @returns {Promise<ChatInfo>}
 */
export async function getChatInfo(pathToFile, additionalData = {}, withMetadata = false) {
    return new Promise(async (res) => {
        const parsedPath = path.parse(pathToFile);
        const stats = await fs.promises.stat(pathToFile);

        const chatData = {
            file_id: parsedPath.name,
            file_name: parsedPath.base,
            file_size: formatBytes(stats.size),
            chat_items: 0,
            mes: '[The chat is empty]',
            last_mes: stats.mtimeMs,
            ...additionalData,
        };

        if (stats.size === 0) {
            res(chatData);
            return;
        }

        const fileStream = fs.createReadStream(pathToFile);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        let lastLine;
        let itemCounter = 0;
        rl.on('line', (line) => {
            if (withMetadata && itemCounter === 0) {
                const jsonData = tryParse(line);
                if (jsonData && _.isObjectLike(jsonData.chat_metadata)) {
                    chatData.chat_metadata = jsonData.chat_metadata;
                }
            }
            itemCounter++;
            lastLine = line;
        });
        rl.on('close', () => {
            rl.close();

            if (lastLine) {
                const jsonData = tryParse(lastLine);
                if (jsonData && (jsonData.name || jsonData.character_name || jsonData.chat_metadata)) {
                    chatData.chat_items = (itemCounter - 1);
                    chatData.mes = jsonData['mes'] || '[The message is empty]';
                    chatData.last_mes = jsonData['send_date'] || new Date(Math.round(stats.mtimeMs)).toISOString();

                    res(chatData);
                } else {
                    console.warn('Found an invalid or corrupted chat file:', pathToFile);
                    res({});
                }
            }
        });
    });
}

export const router = express.Router();

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
class IntegrityMismatchError extends Error {
    constructor(...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);
        // Maintains proper stack trace for where our error was thrown (non-standard)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, IntegrityMismatchError);
        }
        this.date = new Date();
    }
}

/**
 * Tries to save the chat data to a file, performing an integrity check if required.
 * @param {Array} chatData The chat array to save.
 * @param {string} filePath Target file path for the data.
 * @param {boolean} skipIntegrityCheck If undefined, the chat's integrity will not be checked.
 * @param {string} handle The users handle, passed to getBackupFunction.
 * @param {string} cardName Passed to backupChat.
 * @param {string} backupDirectory Passed to backupChat.
 */
export async function trySaveChat(chatData, filePath, skipIntegrityCheck = false, handle, cardName, backupDirectory) {
    const jsonlData = chatData?.map(m => JSON.stringify(m)).join('\n');

    const doIntegrityCheck = (checkIntegrity && !skipIntegrityCheck);
    const chatIntegritySlug = doIntegrityCheck ? chatData?.[0]?.chat_metadata?.integrity : undefined;

    if (chatIntegritySlug && !await checkChatIntegrity(filePath, chatIntegritySlug)) {
        throw new IntegrityMismatchError(`Chat integrity check failed for "${filePath}". The expected integrity slug was "${chatIntegritySlug}".`);
    }
    tryWriteFileSync(filePath, jsonlData);
    getBackupFunction(handle)(backupDirectory, cardName, jsonlData);
}

router.post('/save', validateAvatarUrlMiddleware, async function (request, response) {
    try {
        const handle = request.user.profile.handle;
        const cardName = String(request.body.avatar_url).replace('.png', '');
        const chatData = request.body.chat;
        const chatFileName = `${String(request.body.file_name)}.jsonl`;
        const chatFilePath = path.join(request.user.directories.chats, cardName, sanitize(chatFileName));

        if (Array.isArray(chatData)) {
            await trySaveChat(chatData, chatFilePath, request.body.force, handle, cardName, request.user.directories.backups);
            return response.send({ ok: true });
        } else {
            return response.status(400).send({ error: 'The request\'s body.chat is not an array.' });
        }
    } catch (error) {
        if (error instanceof IntegrityMismatchError) {
            console.error(error.message);
            return response.status(400).send({ error: 'integrity' });
        }
        console.error(error);
        return response.status(500).send({ error: 'An error has occurred, see the console logs for more information.' });
    }
});

/**
 * Gets the chat as an object.
 * @param {string} chatFilePath The full chat file path.
 * @returns {Array}} If the chatFilePath cannot be read, this will return [].
 */
export function getChatData(chatFilePath) {
    let chatData = [];

    const chatJSON = tryReadFileSync(chatFilePath) ?? '';
    if (chatJSON.length > 0) {
        const lines = chatJSON.split('\n');
        // Iterate through the array of strings and parse each line as JSON
        chatData = lines.map(line => tryParse(line)).filter(x => x);
    } else {
        console.warn(`File not found: ${chatFilePath}. The chat does not exist or is empty.`);
    }

    return chatData;
}

router.post('/get', validateAvatarUrlMiddleware, function (request, response) {
    try {
        const dirName = String(request.body.avatar_url).replace('.png', '');
        const directoryPath = path.join(request.user.directories.chats, dirName);
        const chatDirExists = fs.existsSync(directoryPath);

        //if no chat dir for the character is found, make one with the character name
        if (!chatDirExists) {
            fs.mkdirSync(directoryPath);
            return response.send({});
        }

        if (!request.body.file_name) {
            return response.send({});
        }

        const chatFileName = `${String(request.body.file_name)}.jsonl`;
        const chatFilePath = path.join(directoryPath, sanitize(chatFileName));

        return response.send(getChatData(chatFilePath));
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});

router.post('/rename', validateAvatarUrlMiddleware, async function (request, response) {
    try {
        if (!request.body || !request.body.original_file || !request.body.renamed_file) {
            return response.sendStatus(400);
        }

        const pathToFolder = request.body.is_group
            ? request.user.directories.groupChats
            : path.join(request.user.directories.chats, String(request.body.avatar_url).replace('.png', ''));
        const pathToOriginalFile = path.join(pathToFolder, sanitize(request.body.original_file));
        const pathToRenamedFile = path.join(pathToFolder, sanitize(request.body.renamed_file));
        const sanitizedFileName = path.parse(pathToRenamedFile).name;
        console.debug('Old chat name', pathToOriginalFile);
        console.debug('New chat name', pathToRenamedFile);

        if (!fs.existsSync(pathToOriginalFile) || fs.existsSync(pathToRenamedFile)) {
            console.error('Either Source or Destination files are not available');
            return response.status(400).send({ error: true });
        }

        fs.copyFileSync(pathToOriginalFile, pathToRenamedFile);
        fs.unlinkSync(pathToOriginalFile);
        console.info('Successfully renamed chat file.');
        return response.send({ ok: true, sanitizedFileName });
    } catch (error) {
        console.error('Error renaming chat file:', error);
        return response.status(500).send({ error: true });
    }
});

router.post('/delete', validateAvatarUrlMiddleware, function (request, response) {
    try {
        if (!path.extname(request.body.chatfile)) {
            request.body.chatfile += '.jsonl';
        }

        const dirName = String(request.body.avatar_url).replace('.png', '');
        const chatFileName = String(request.body.chatfile);
        const chatFilePath = path.join(request.user.directories.chats, dirName, sanitize(chatFileName));
        //Return success if the file was deleted.
        if (tryDeleteFile(chatFilePath)) {
            return response.send({ ok: true });
        } else {
            console.error('The chat file was not deleted.');
            return response.sendStatus(400);
        }
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/reset', validateAvatarUrlMiddleware, async function (request, response) {
    try {
        const handle = request.user.profile.handle;
        const cardName = String(request.body.avatar_url).replace('.png', '');
        const chatFileName = request.body.chatfile || 'chat';
        
        // Ensure .jsonl extension
        const chatFileNameWithExt = path.extname(chatFileName) ? chatFileName : `${chatFileName}.jsonl`;
        const chatFilePath = path.join(request.user.directories.chats, cardName, sanitize(chatFileNameWithExt));
        
        // Load existing chat to preserve metadata if needed
        let existingChat = [];
        if (fs.existsSync(chatFilePath)) {
            existingChat = getChatData(chatFilePath);
        }
        
        // Create empty chat array, preserving chat_metadata if it exists
        const emptyChat = [];
        if (existingChat.length > 0 && existingChat[0]?.chat_metadata) {
            // Preserve metadata in first message
            emptyChat.push({
                chat_metadata: existingChat[0].chat_metadata
            });
        }
        
        // Save empty chat
        await trySaveChat(emptyChat, chatFilePath, false, handle, cardName, request.user.directories.backups);
        
        return response.send({ ok: true });
    } catch (error) {
        console.error('[reset] Error resetting chat:', error);
        return response.status(500).send({ error: 'Failed to reset chat' });
    }
});

router.post('/export', validateAvatarUrlMiddleware, async function (request, response) {
    if (!request.body.file || (!request.body.avatar_url && request.body.is_group === false)) {
        return response.sendStatus(400);
    }
    const pathToFolder = request.body.is_group
        ? request.user.directories.groupChats
        : path.join(request.user.directories.chats, String(request.body.avatar_url).replace('.png', ''));
    let filename = path.join(pathToFolder, request.body.file);
    let exportfilename = request.body.exportfilename;
    if (!fs.existsSync(filename)) {
        const errorMessage = {
            message: `Could not find JSONL file to export. Source chat file: ${filename}.`,
        };
        console.error(errorMessage.message);
        return response.status(404).json(errorMessage);
    }
    try {
        // Short path for JSONL files
        if (request.body.format === 'jsonl') {
            try {
                const rawFile = fs.readFileSync(filename, 'utf8');
                const successMessage = {
                    message: `Chat saved to ${exportfilename}`,
                    result: rawFile,
                };

                console.info(`Chat exported as ${exportfilename}`);
                return response.status(200).json(successMessage);
            } catch (err) {
                console.error(err);
                const errorMessage = {
                    message: `Could not read JSONL file to export. Source chat file: ${filename}.`,
                };
                console.error(errorMessage.message);
                return response.status(500).json(errorMessage);
            }
        }

        const readStream = fs.createReadStream(filename);
        const rl = readline.createInterface({
            input: readStream,
        });
        let buffer = '';
        rl.on('line', (line) => {
            const data = JSON.parse(line);
            // Skip non-printable/prompt-hidden messages
            if (data.is_system) {
                return;
            }
            if (data.mes) {
                const name = data.name;
                const message = (data?.extra?.display_text || data?.mes || '').replace(/\r?\n/g, '\n');
                buffer += (`${name}: ${message}\n\n`);
            }
        });
        rl.on('close', () => {
            const successMessage = {
                message: `Chat saved to ${exportfilename}`,
                result: buffer,
            };
            console.info(`Chat exported as ${exportfilename}`);
            return response.status(200).json(successMessage);
        });
    } catch (err) {
        console.error('chat export failed.', err);
        return response.sendStatus(400);
    }
});

router.post('/group/import', function (request, response) {
    try {
        const filedata = request.file;

        if (!filedata) {
            return response.sendStatus(400);
        }

        const chatname = humanizedDateTime();
        const pathToUpload = path.join(filedata.destination, filedata.filename);
        const pathToNewFile = path.join(request.user.directories.groupChats, `${chatname}.jsonl`);
        fs.copyFileSync(pathToUpload, pathToNewFile);
        fs.unlinkSync(pathToUpload);
        return response.send({ res: chatname });
    } catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

router.post('/import', validateAvatarUrlMiddleware, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    const format = request.body.file_type;
    const avatarUrl = (request.body.avatar_url).replace('.png', '');
    const characterName = request.body.character_name;
    const userName = request.body.user_name || 'User';
    const fileNames = [];

    if (!request.file) {
        return response.sendStatus(400);
    }

    try {
        const pathToUpload = path.join(request.file.destination, request.file.filename);
        const data = fs.readFileSync(pathToUpload, 'utf8');

        if (format === 'json') {
            fs.unlinkSync(pathToUpload);
            const jsonData = JSON.parse(data);

            /** @type {function(string, string, object): string|string[]} */
            let importFunc;

            if (jsonData.savedsettings !== undefined) { // Kobold Lite format
                importFunc = importKoboldLiteChat;
            } else if (jsonData.histories !== undefined) { // CAI Tools format
                importFunc = importCAIChat;
            } else if (Array.isArray(jsonData.data_visible)) { // oobabooga's format
                importFunc = importOobaChat;
            } else if (Array.isArray(jsonData.messages)) { // Agnai's format
                importFunc = importAgnaiChat;
            } else if (jsonData.type === 'risuChat') { // RisuAI format
                importFunc = importRisuChat;
            } else { // Unknown format
                console.error('Incorrect chat format .json');
                return response.send({ error: true });
            }

            const handleChat = (chat) => {
                const fileName = `${characterName} - ${humanizedDateTime()} imported.jsonl`;
                const filePath = path.join(request.user.directories.chats, avatarUrl, fileName);
                fileNames.push(fileName);
                writeFileAtomicSync(filePath, chat, 'utf8');
            };

            const chat = importFunc(userName, characterName, jsonData);

            if (Array.isArray(chat)) {
                chat.forEach(handleChat);
            } else {
                handleChat(chat);
            }

            return response.send({ res: true, fileNames });
        }

        if (format === 'jsonl') {
            let lines = data.split('\n');
            const header = lines[0];

            const jsonData = JSON.parse(header);

            if (!(jsonData.user_name !== undefined || jsonData.name !== undefined || jsonData.chat_metadata !== undefined)) {
                console.error('Incorrect chat format .jsonl');
                return response.send({ error: true });
            }

            // Do a tiny bit of work to import Chub Chat data
            // Processing the entire file is so fast that it's not worth checking if it's a Chub chat first
            let flattenedChat = data;
            try {
                // flattening is unlikely to break, but it's not worth failing to
                // import normal chats in an attempt to import a Chub chat
                flattenedChat = flattenChubChat(userName, characterName, lines);
            } catch (error) {
                console.warn('Failed to flatten Chub Chat data: ', error);
            }

            const fileName = `${characterName} - ${humanizedDateTime()} imported.jsonl`;
            const filePath = path.join(request.user.directories.chats, avatarUrl, fileName);
            fileNames.push(fileName);
            if (flattenedChat !== data) {
                writeFileAtomicSync(filePath, flattenedChat, 'utf8');
            } else {
                fs.copyFileSync(pathToUpload, filePath);
            }
            fs.unlinkSync(pathToUpload);
            response.send({ res: true, fileNames });
        }
    } catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

router.post('/group/get', (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const chatFilePath = path.join(request.user.directories.groupChats, `${id}.jsonl`);

    return response.send(getChatData(chatFilePath));
});

router.post('/group/delete', (request, response) => {
    try {
        if (!request.body || !request.body.id) {
            return response.sendStatus(400);
        }

        const id = request.body.id;
        const chatFilePath = path.join(request.user.directories.groupChats, `${id}.jsonl`);

        //Return success if the file was deleted.
        if (tryDeleteFile(chatFilePath)) {
            return response.send({ ok: true });
        } else {
            console.error('The group chat file was not deleted.\'');
            return response.sendStatus(400);
        }
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/group/save', async function (request, response) {
    try {
        if (!request.body || !request.body.id) {
            return response.sendStatus(400);
        }

        const id = request.body.id;
        const handle = request.user.profile.handle;
        const chatFilePath = path.join(request.user.directories.groupChats, sanitize(`${id}.jsonl`));
        const chatData = request.body.chat;

        if (Array.isArray(chatData)) {
            await trySaveChat(chatData, chatFilePath, request.body.force, handle, String(id), request.user.directories.backups);
            return response.send({ ok: true });
        }
        else {
            return response.status(400).send({ error: 'The request\'s body.chat is not an array.' });
        }
    } catch (error) {
        if (error instanceof IntegrityMismatchError) {
            console.error(error.message);
            return response.status(400).send({ error: 'integrity' });
        }
        console.error(error);
        return response.status(500).send({ error: 'An error has occurred, see the console logs for more information.' });
    }
});

router.post('/search', validateAvatarUrlMiddleware, function (request, response) {
    try {
        const { query, avatar_url, group_id } = request.body;
        let chatFiles = [];

        if (group_id) {
            // Find group's chat IDs first
            const groupDir = path.join(request.user.directories.groups);
            const groupFiles = fs.readdirSync(groupDir)
                .filter(file => file.endsWith('.json'));

            let targetGroup;
            for (const groupFile of groupFiles) {
                try {
                    const groupData = JSON.parse(fs.readFileSync(path.join(groupDir, groupFile), 'utf8'));
                    if (groupData.id === group_id) {
                        targetGroup = groupData;
                        break;
                    }
                } catch (error) {
                    console.warn(groupFile, 'group file is corrupted:', error);
                }
            }

            if (!targetGroup?.chats) {
                return response.send([]);
            }

            // Find group chat files for given group ID
            const groupChatsDir = path.join(request.user.directories.groupChats);
            chatFiles = targetGroup.chats
                .map(chatId => {
                    const filePath = path.join(groupChatsDir, `${chatId}.jsonl`);
                    if (!fs.existsSync(filePath)) return null;
                    const stats = fs.statSync(filePath);
                    return {
                        file_name: chatId,
                        file_size: formatBytes(stats.size),
                        path: filePath,
                    };
                })
                .filter(x => x);
        } else {
            // Regular character chat directory
            const character_name = avatar_url.replace('.png', '');
            const directoryPath = path.join(request.user.directories.chats, character_name);

            if (!fs.existsSync(directoryPath)) {
                return response.send([]);
            }

            chatFiles = fs.readdirSync(directoryPath)
                .filter(file => file.endsWith('.jsonl'))
                .map(fileName => {
                    const filePath = path.join(directoryPath, fileName);
                    const stats = fs.statSync(filePath);
                    return {
                        file_name: fileName,
                        file_size: formatBytes(stats.size),
                        path: filePath,
                    };
                });
        }

        const results = [];

        // Search logic
        for (const chatFile of chatFiles) {
            const data = getChatData(chatFile.path);
            const messages = data.filter(x => x && typeof x.mes === 'string');

            if (query && messages.length === 0) {
                continue;
            }

            const lastMessage = messages[messages.length - 1];
            const lastMesDate = lastMessage?.send_date || new Date(fs.statSync(chatFile.path).mtimeMs).toISOString();

            // If no search query, just return metadata
            if (!query) {
                results.push({
                    file_name: chatFile.file_name,
                    file_size: chatFile.file_size,
                    message_count: messages.length,
                    last_mes: lastMesDate,
                    preview_message: getPreviewMessage(messages),
                });
                continue;
            }

            // Search through title and messages of the chat
            const fragments = query.trim().toLowerCase().split(/\s+/).filter(x => x);
            const text = [path.parse(chatFile.path).name, ...messages.map(message => message?.mes)].join('\n').toLowerCase();
            const hasMatch = fragments.every(fragment => text.includes(fragment));

            if (hasMatch) {
                results.push({
                    file_name: chatFile.file_name,
                    file_size: chatFile.file_size,
                    message_count: messages.length,
                    last_mes: lastMesDate,
                    preview_message: getPreviewMessage(messages),
                });
            }
        }

        // Sort by last message date descending
        results.sort((a, b) => new Date(b.last_mes).getTime() - new Date(a.last_mes).getTime());
        return response.send(results);

    } catch (error) {
        console.error('Chat search error:', error);
        return response.status(500).json({ error: 'Search failed' });
    }
});

router.post('/recent', async function (request, response) {
    try {
        /** @type {{pngFile?: string, groupId?: string, filePath: string, mtime: number}[]} */
        const allChatFiles = [];

        const getCharacterChatFiles = async () => {
            const pngDirents = await fs.promises.readdir(request.user.directories.characters, { withFileTypes: true });
            const pngFiles = pngDirents.filter(e => e.isFile() && path.extname(e.name) === '.png').map(e => e.name);

            for (const pngFile of pngFiles) {
                const chatsDirectory = pngFile.replace('.png', '');
                const pathToChats = path.join(request.user.directories.chats, chatsDirectory);
                if (!fs.existsSync(pathToChats)) {
                    continue;
                }
                const pathStats = await fs.promises.stat(pathToChats);
                if (pathStats.isDirectory()) {
                    const chatFiles = await fs.promises.readdir(pathToChats);
                    const jsonlFiles = chatFiles.filter(file => path.extname(file) === '.jsonl');

                    for (const file of jsonlFiles) {
                        const filePath = path.join(pathToChats, file);
                        const stats = await fs.promises.stat(filePath);
                        allChatFiles.push({ pngFile, filePath, mtime: stats.mtimeMs });
                    }
                }
            }
        };

        const getGroupChatFiles = async () => {
            const groupDirents = await fs.promises.readdir(request.user.directories.groups, { withFileTypes: true });
            const groups = groupDirents.filter(e => e.isFile() && path.extname(e.name) === '.json').map(e => e.name);

            for (const group of groups) {
                try {
                    const groupPath = path.join(request.user.directories.groups, group);
                    const groupContents = await fs.promises.readFile(groupPath, 'utf8');
                    const groupData = JSON.parse(groupContents);

                    if (Array.isArray(groupData.chats)) {
                        for (const chat of groupData.chats) {
                            const filePath = path.join(request.user.directories.groupChats, `${chat}.jsonl`);
                            if (!fs.existsSync(filePath)) {
                                continue;
                            }
                            const stats = await fs.promises.stat(filePath);
                            allChatFiles.push({ groupId: groupData.id, filePath, mtime: stats.mtimeMs });
                        }
                    }
                } catch (error) {
                    // Skip group files that can't be read or parsed
                    continue;
                }
            }
        };

        const getRootChatFiles = async () => {
            const dirents = await fs.promises.readdir(request.user.directories.chats, { withFileTypes: true });
            const chatFiles = dirents.filter(e => e.isFile() && path.extname(e.name) === '.jsonl').map(e => e.name);

            for (const file of chatFiles) {
                const filePath = path.join(request.user.directories.chats, file);
                const stats = await fs.promises.stat(filePath);
                allChatFiles.push({ filePath, mtime: stats.mtimeMs });
            }
        };

        await Promise.allSettled([getCharacterChatFiles(), getGroupChatFiles(), getRootChatFiles()]);

        const max = parseInt(request.body.max ?? Number.MAX_SAFE_INTEGER);
        const recentChats = allChatFiles.sort((a, b) => b.mtime - a.mtime).slice(0, max);
        const jsonFilesPromise = recentChats.map((file) => {
            const withMetadata = !!request.body.metadata;
            return file.groupId
                ? getChatInfo(file.filePath, { group: file.groupId }, withMetadata)
                : getChatInfo(file.filePath, { avatar: file.pngFile }, withMetadata);
        });

        const chatData = (await Promise.allSettled(jsonFilesPromise)).filter(x => x.status === 'fulfilled').map(x => x.value);
        const validFiles = chatData.filter(i => i.file_name);

        return response.send(validFiles);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

/**
 * Prepare messages for chat completion API
 * This endpoint takes a simple user message and prepares a complete message array
 * with all system prompts, world info, extension prompts, etc.
 */
router.post('/prepare-messages', validateAvatarUrlMiddleware, async function (request, response) {
    try {
        const { chat_id, character_id, user_message, type = 'chat', regenerate = false, swipe_index = -1 } = request.body;

        // Validate required fields
        if (!character_id) {
            return response.status(400).json({
                success: false,
                error: 'character_id is required',
                code: 'MISSING_CHARACTER_ID'
            });
        }

        if (!user_message) {
            return response.status(400).json({
                success: false,
                error: 'user_message is required',
                code: 'MISSING_USER_MESSAGE'
            });
        }

        // Load character data
        const characterFileName = character_id.endsWith('.png') ? character_id : `${character_id}.png`;
        const characterFilePath = path.join(request.user.directories.characters, characterFileName);
        
        if (!fs.existsSync(characterFilePath)) {
            return response.status(404).json({
                success: false,
                error: 'Character not found',
                code: 'CHARACTER_NOT_FOUND'
            });
        }

        const characterJsonData = await parse(characterFilePath, 'png');
        if (!characterJsonData) {
            return response.status(500).json({
                success: false,
                error: 'Failed to parse character file',
                code: 'CHARACTER_PARSE_ERROR'
            });
        }

        const characterData = tryParse(characterJsonData);
        if (!characterData || !characterData.data) {
            return response.status(500).json({
                success: false,
                error: 'Invalid character data format',
                code: 'INVALID_CHARACTER_FORMAT'
            });
        }

        // Extract character fields
        const charDescription = characterData.data.description || '';
        const charPersonality = characterData.data.personality || '';
        const scenario = characterData.data.scenario || '';
        const name2 = characterData.data.name || '';
        const charFirstMes = characterData.data.first_mes || '';
        const alternateGreetings = characterData.data.alternate_greetings || [];
        const worldInfoName = characterData.data.extensions?.world || characterData.data.world || '';

        // Load world info if character has one
        let worldInfoBefore = '';
        let worldInfoAfter = '';
        if (worldInfoName) {
            try {
                const worldInfo = readWorldInfoFile(request.user.directories, worldInfoName, true);
                if (worldInfo && worldInfo.entries) {
                    // Simple formatting: combine all entries
                    // TODO: Implement proper world info scanning based on chat history
                    const entries = Object.values(worldInfo.entries || {});
                    const worldInfoText = entries
                        .filter(entry => entry && entry.content)
                        .map(entry => {
                            const keys = entry.keys ? entry.keys.join(', ') : '';
                            return keys ? `${keys}: ${entry.content}` : entry.content;
                        })
                        .join('\n\n');
                    
                    // For now, put all world info in worldInfoBefore
                    // TODO: Implement proper before/after positioning based on entry position
                    worldInfoBefore = worldInfoText;
                }
            } catch (error) {
                console.warn('[prepare-messages] Failed to load world info:', error);
            }
        }

        // Load chat history if chat_id is provided
        let chatHistory = [];
        let summary = null; // Summary from chat history
        if (chat_id) {
            const characterDirName = characterFileName.replace('.png', '');
            const chatDirectory = path.join(request.user.directories.chats, characterDirName);
            const chatFileName = `${chat_id}.jsonl`;
            const chatFilePath = path.join(chatDirectory, sanitize(chatFileName));
            
            if (fs.existsSync(chatFilePath)) {
                chatHistory = getChatData(chatFilePath);
                
                // Find the latest summary from chat history (stored in extra.memory)
                for (let i = chatHistory.length - 1; i >= 0; i--) {
                    const chatItem = chatHistory[i];
                    if (chatItem.extra && typeof chatItem.extra === 'object' && chatItem.extra.memory) {
                        summary = chatItem.extra.memory;
                        console.log(`[prepare-messages] Summary 로드됨 (index ${i}):`, {
                            summaryLength: summary.length,
                            summaryPreview: summary.substring(0, 100),
                            chatItemExtra: chatItem.extra
                        });
                        break;
                    }
                }
                
                // 디버깅: Summary가 없는 경우 채팅 히스토리 확인
                if (!summary) {
                    console.log('[prepare-messages] Summary를 찾을 수 없음. 채팅 히스토리 확인:', {
                        chatHistoryLength: chatHistory.length,
                        hasExtraFields: chatHistory.some(item => item.extra),
                        extraFieldsCount: chatHistory.filter(item => item.extra).length,
                        sampleItems: chatHistory.slice(-5).map((item, idx) => ({
                            index: chatHistory.length - 5 + idx,
                            hasExtra: !!item.extra,
                            extraKeys: item.extra ? Object.keys(item.extra) : [],
                            hasMemory: !!(item.extra && item.extra.memory)
                        }))
                    });
                }
            }
        }

        // Load user settings to get name1, extension settings, and oai_settings
        let name1 = 'You';
        let extensionSettings = {};
        let oaiSettings = {};
        try {
            const pathToSettings = path.join(request.user.directories.root, 'settings.json');
            if (fs.existsSync(pathToSettings)) {
                const settingsContent = fs.readFileSync(pathToSettings, 'utf8');
                const settings = tryParse(settingsContent);
                if (settings) {
                    if (settings.name1) {
                        name1 = settings.name1;
                    }
                    // Load extension settings (for Summary, Authors Note, etc.)
                    if (settings.extension_settings) {
                        extensionSettings = settings.extension_settings;
                    }
                    // Load oai_settings (for Main Prompt, etc.)
                    if (settings.oai_settings) {
                        oaiSettings = settings.oai_settings;
                    }
                }
            }
        } catch (error) {
            console.warn('[prepare-messages] Failed to load user settings:', error);
        }
        
        // Get Main Prompt from oai_settings.prompts
        let mainPrompt = null;
        if (oaiSettings.prompts && Array.isArray(oaiSettings.prompts)) {
            const mainPromptConfig = oaiSettings.prompts.find(p => p.identifier === 'main');
            if (mainPromptConfig && mainPromptConfig.content) {
                // Replace macros: {{char}} -> name2, {{user}} -> name1
                // Also handle {{charIfNotGroup}} -> name2 (for group chats, but we'll use name2 for now)
                mainPrompt = mainPromptConfig.content
                    .replace(/\{\{char\}\}/g, name2)
                    .replace(/\{\{charIfNotGroup\}\}/g, name2)
                    .replace(/\{\{user\}\}/g, name1);
            }
        }
        
        // Default Main Prompt if not found in settings
        if (!mainPrompt) {
            mainPrompt = `Write ${name2}'s next reply in a fictional chat between ${name2} and ${name1}.`;
        }
        
        // Get new chat prompt from oai_settings
        const newChatPrompt = oaiSettings.new_chat_prompt || '[Start a new Chat]';
        
        // Get Summary settings
        const memorySettings = extensionSettings.memory || {};
        const summaryTemplate = memorySettings.template || '[Summary: {{summary}}]';
        const summaryPosition = memorySettings.position || 0; // 0 = IN_PROMPT, 1 = IN_CHAT
        const summaryDepth = memorySettings.depth || 2;
        const summaryRole = memorySettings.role || 0; // 0 = SYSTEM, 1 = USER, 2 = ASSISTANT
        
        // Format summary with template if summary exists
        let formattedSummary = null;
        if (summary) {
            // Replace {{summary}} placeholder in template
            formattedSummary = summaryTemplate.replace(/\{\{summary\}\}/g, summary);
        }

        // Prepare basic message array
        const messages = [];

        // Add world info before (if exists)
        if (worldInfoBefore) {
            messages.push({
                role: 'system',
                content: worldInfoBefore
            });
        }

        // Add Main Prompt (after worldInfoBefore, before worldInfoAfter)
        if (mainPrompt) {
            messages.push({
                role: 'system',
                content: mainPrompt,
                identifier: 'main'
            });
        }

        // Add Summary right after Main Prompt (if position is IN_PROMPT)
        if (formattedSummary && summaryPosition === 0) {
            const summaryRoleStr = summaryRole === 0 ? 'system' : (summaryRole === 1 ? 'user' : 'assistant');
            messages.push({
                role: summaryRoleStr,
                content: formattedSummary,
                identifier: 'summary'
            });
        }

        // Add world info after (if exists) - should be after Main Prompt and Summary
        if (worldInfoAfter) {
            messages.push({
                role: 'system',
                content: worldInfoAfter
            });
        }

        // Add system prompts (basic version - will be extended later)
        if (charDescription) {
            messages.push({
                role: 'system',
                content: charDescription
            });
        }

        if (charPersonality) {
            messages.push({
                role: 'system',
                content: charPersonality
            });
        }

        if (scenario) {
            messages.push({
                role: 'system',
                content: scenario
            });
        }

        // Check if this is the first message (no chat history or empty chat history)
        const isFirstMessage = !chatHistory || chatHistory.length === 0 || 
            chatHistory.every(item => !item.mes || !item.mes.trim() || item.is_system);
        
        // Always add [Start a new Chat] at the start of chat history (web behavior)
        const newChatMessage = newChatPrompt
            .replace(/\{\{char\}\}/g, name2)
            .replace(/\{\{user\}\}/g, name1)
            .replace(/\{\{charIfNotGroup\}\}/g, name2);
        
        // Add character's first message if this is the first message
        // (In web/app, the first message is saved to chat history, so for existing chats
        // it will already be in chatHistory. This is only needed for the very first message.)
        if (isFirstMessage && charFirstMes) {
            // Pick random greeting if alternate greetings exist
            let firstMessageText = charFirstMes;
            if (Array.isArray(alternateGreetings) && alternateGreetings.length > 0) {
                const allGreetings = [charFirstMes, ...alternateGreetings].filter(x => x);
                firstMessageText = allGreetings[Math.floor(Math.random() * allGreetings.length)];
            }
            
            // Replace macros in first message
            firstMessageText = firstMessageText
                .replace(/\{\{char\}\}/g, name2)
                .replace(/\{\{user\}\}/g, name1)
                .replace(/\{\{charIfNotGroup\}\}/g, name2);
            
            messages.push({
                role: 'assistant',
                content: firstMessageText.trim()
            });
        }
        
        // Add [Start a new Chat] system message (always added, before chat history)
        messages.push({
            role: 'system',
            content: newChatMessage,
            identifier: 'newMainChat'
        });
        
        // Add existing chat history (convert from chat format to message format)
        // Chat format: { name, mes, is_user, ... }
        // Message format: { role: 'user' | 'assistant', content: string }
        if (!isFirstMessage) {
            for (const chatItem of chatHistory) {
                if (chatItem.mes && chatItem.mes.trim() && !chatItem.is_system) {
                    if (chatItem.is_user || chatItem.name === name1) {
                        messages.push({
                            role: 'user',
                            content: chatItem.mes
                        });
                    } else if (chatItem.name === name2 || chatItem.character_name === name2) {
                        messages.push({
                            role: 'assistant',
                            content: chatItem.mes
                        });
                    }
                }
            }
        }

        // Add current user message
        messages.push({
            role: 'user',
            content: user_message
        });

        // Apply Summary extension prompt for IN_CHAT position (at depth)
        // Summary position: 0 = IN_PROMPT (already added above), 1 = IN_CHAT (at depth)
        if (formattedSummary && summaryPosition === 1) {
            // IN_CHAT: Add at specific depth in chat history
            // Depth 0 = before last message, Depth 1 = before second-to-last, etc.
            // For now, add before the last user message (depth 0)
            // TODO: Implement proper depth-based insertion
            const lastUserIndex = messages.map((m, i) => ({ role: m.role, index: i }))
                .filter(m => m.role === 'user')
                .pop()?.index;
            
            if (lastUserIndex !== undefined) {
                const summaryRoleStr = summaryRole === 0 ? 'system' : (summaryRole === 1 ? 'user' : 'assistant');
                messages.splice(lastUserIndex, 0, {
                    role: summaryRoleStr,
                    content: formattedSummary,
                    identifier: 'summary',
                    injected: true
                });
            }
        }
        
        // Check if Summary should be generated automatically
        // Summary is generated if:
        // 1. Summary settings are enabled (promptInterval > 0)
        // 2. Enough messages since last summary (>= promptInterval)
        // 3. Summary source is 'main' (only Main API is supported for now)
        const shouldGenerateSummary = memorySettings.source === 'main' && 
                                     memorySettings.promptInterval > 0 &&
                                     chatHistory.length >= memorySettings.promptInterval;
        
        if (shouldGenerateSummary && !summary) {
            // Count messages since last summary
            let messagesSinceLastSummary = 0;
            for (let i = chatHistory.length - 1; i >= 0; i--) {
                if (chatHistory[i].extra && chatHistory[i].extra.memory) {
                    break;
                }
                messagesSinceLastSummary++;
            }
            
            console.log('[prepare-messages] Summary 생성 조건 확인:', {
                promptInterval: memorySettings.promptInterval,
                messagesSinceLastSummary,
                shouldGenerate: messagesSinceLastSummary >= memorySettings.promptInterval,
                chatHistoryLength: chatHistory.length
            });
            
            // Generate summary if enough messages
            if (messagesSinceLastSummary >= memorySettings.promptInterval) {
                try {
                    // Generate summary asynchronously (don't block the response)
                    // Pass the full request object to access session and CSRF token
                    generateSummaryForChat(request.user.directories, characterFileName, chat_id, memorySettings, name1, name2, request)
                        .catch(error => {
                            console.error('[prepare-messages] Failed to generate summary:', error);
                        });
                } catch (error) {
                    console.error('[prepare-messages] Error starting summary generation:', error);
                }
            }
        }
        
        // TODO: Implement proper world info scanning based on chat history (checkWorldInfo equivalent)
        // TODO: Apply other extension prompts (vectors, authors note, etc.)
        // TODO: Calculate token budget
        // TODO: Apply prompt formatting (scenario_format, personality_format, etc.)

        return response.json({
            success: true,
            messages: messages,
            generate_data: {
                messages: messages,
                stream: true
            },
            metadata: {
                character_id: character_id,
                character_name: name2,
                user_name: name1,
                chat_id: chat_id || null,
                token_count: 0 // TODO: Calculate actual token count
            }
        });
    } catch (error) {
        console.error('[prepare-messages] Error:', error);
        return response.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * Summarize chat endpoint
 * POST /api/chats/summarize
 */
router.post('/summarize', validateAvatarUrlMiddleware, async function (request, response) {
    try {
        const { character_id, chat_id, force = false } = request.body;
        
        // Validate required fields
        if (!character_id) {
            return response.status(400).json({
                success: false,
                error: 'character_id is required',
                code: 'MISSING_CHARACTER_ID'
            });
        }
        
        if (!chat_id) {
            return response.status(400).json({
                success: false,
                error: 'chat_id is required',
                code: 'MISSING_CHAT_ID'
            });
        }
        
        // Load character data
        const characterFileName = character_id.endsWith('.png') ? character_id : `${character_id}.png`;
        const characterFilePath = path.join(request.user.directories.characters, characterFileName);
        
        if (!fs.existsSync(characterFilePath)) {
            return response.status(404).json({
                success: false,
                error: 'Character not found',
                code: 'CHARACTER_NOT_FOUND'
            });
        }
        
        const characterJsonData = await parse(characterFilePath, 'png');
        if (!characterJsonData) {
            return response.status(500).json({
                success: false,
                error: 'Failed to parse character file',
                code: 'CHARACTER_PARSE_ERROR'
            });
        }
        
        const characterData = tryParse(characterJsonData);
        if (!characterData || !characterData.data) {
            return response.status(500).json({
                success: false,
                error: 'Invalid character data format',
                code: 'INVALID_CHARACTER_FORMAT'
            });
        }
        
        const name2 = characterData.data.name || 'Character';
        
        // Load user settings
        let name1 = 'You';
        let extensionSettings = {};
        try {
            const pathToSettings = path.join(request.user.directories.root, 'settings.json');
            if (fs.existsSync(pathToSettings)) {
                const settingsContent = fs.readFileSync(pathToSettings, 'utf8');
                const settings = tryParse(settingsContent);
                if (settings) {
                    if (settings.name1) {
                        name1 = settings.name1;
                    }
                    if (settings.extension_settings) {
                        extensionSettings = settings.extension_settings;
                    }
                }
            }
        } catch (error) {
            console.warn('[summarize] Failed to load user settings:', error);
        }
        
        const memorySettings = extensionSettings.memory || {};
        
        // Check if summary should be generated
        if (!force) {
            // Check if source is 'main' (only Main API is supported)
            if (memorySettings.source !== 'main') {
                return response.status(400).json({
                    success: false,
                    error: 'Summary source must be "main"',
                    code: 'INVALID_SOURCE'
                });
            }
            
            // Check if summary generation is enabled
            if (!memorySettings.promptInterval || memorySettings.promptInterval <= 0) {
                return response.status(400).json({
                    success: false,
                    error: 'Summary generation is not enabled (promptInterval must be > 0)',
                    code: 'SUMMARY_DISABLED'
                });
            }
        }
        
        // Generate summary
        const summary = await generateSummaryForChat(
            request.user.directories,
            characterFileName,
            chat_id,
            memorySettings,
            name1,
            name2,
            request
        );
        
        if (!summary) {
            return response.status(500).json({
                success: false,
                error: 'Failed to generate summary',
                code: 'SUMMARY_GENERATION_FAILED'
            });
        }
        
        return response.json({
            success: true,
            summary: summary
        });
        
    } catch (error) {
        console.error('[summarize] Error:', error);
        return response.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * Generate summary for a chat
 * @param {object} directories User directories
 * @param {string} characterFileName Character file name
 * @param {string} chatId Chat ID
 * @param {object} memorySettings Memory extension settings
 * @param {string} name1 User name
 * @param {string} name2 Character name
 * @param {object} request Express request object (for internal API calls and CSRF token)
 * @returns {Promise<string|null>} Generated summary or null
 */
async function generateSummaryForChat(directories, characterFileName, chatId, memorySettings, name1, name2, request = null) {
    if (!chatId) {
        return null;
    }
    
    try {
        const characterDirName = characterFileName.replace('.png', '');
        const chatDirectory = path.join(directories.chats, characterDirName);
        const chatFileName = `${chatId}.jsonl`;
        const chatFilePath = path.join(chatDirectory, sanitize(chatFileName));
        
        if (!fs.existsSync(chatFilePath)) {
            console.warn('[generateSummaryForChat] Chat file not found:', chatFilePath);
            return null;
        }
        
        const chatHistory = getChatData(chatFilePath);
        if (!chatHistory || chatHistory.length === 0) {
            return null;
        }
        
        // Find the latest summary index
        let latestSummaryIndex = -1;
        let latestSummary = null;
        for (let i = chatHistory.length - 1; i >= 0; i--) {
            if (chatHistory[i].extra && chatHistory[i].extra.memory) {
                latestSummaryIndex = i;
                latestSummary = chatHistory[i].extra.memory;
                break;
            }
        }
        
        // Get prompt builder mode (0=DEFAULT, 1=RAW_BLOCKING, 2=RAW_NON_BLOCKING)
        const promptBuilder = memorySettings.prompt_builder !== undefined ? memorySettings.prompt_builder : 0;
        const isRawMode = promptBuilder === 1 || promptBuilder === 2; // RAW_BLOCKING or RAW_NON_BLOCKING
        
        // Build summary prompt
        const summaryPrompt = (memorySettings.prompt || 'Ignore previous instructions. Summarize the most important facts and events in the story so far. If a summary already exists in your memory, use that as a base and expand with new facts. Limit the summary to {{words}} words or less. Your response should include nothing but the summary.')
            .replace(/\{\{words\}\}/g, String(memorySettings.promptWords || 200));
        
        // Load server settings for chat completion API
        let serverSettings = {};
        try {
            const pathToSettings = path.join(directories.root, 'settings.json');
            if (fs.existsSync(pathToSettings)) {
                const settingsContent = fs.readFileSync(pathToSettings, 'utf8');
                const settings = tryParse(settingsContent);
                if (settings) {
                    // Merge oai_settings into top level for easier access
                    serverSettings = {
                        ...settings,
                        ...(settings.oai_settings || {}),
                    };
                }
            }
        } catch (error) {
            console.warn('[generateSummaryForChat] Failed to load server settings:', error);
        }
        
        // Collect messages for summary based on prompt builder mode
        let messagesToSummarize = [];
        let lastUsedIndex = -1;
        const startIndex = latestSummaryIndex + 1;
        const endIndex = chatHistory.length - 1; // Exclude last message
        const maxMessagesPerRequest = memorySettings.maxMessagesPerRequest || 0;
        
        if (isRawMode) {
            // RAW mode: Collect messages with token/message limit consideration
            // For now, we'll use a simple word count estimation instead of token counting
            // (Token counting would require model-specific tokenizer which is complex)
            const chatBuffer = [];
            
            for (let i = startIndex; i <= endIndex && i < chatHistory.length; i++) {
                const chatItem = chatHistory[i];
                if (chatItem.mes && chatItem.mes.trim() && !chatItem.is_system) {
                    const senderName = chatItem.is_user || chatItem.name === name1 ? name1 : name2;
                    const entry = `${senderName}:\n${chatItem.mes}`;
                    chatBuffer.push(entry);
                    lastUsedIndex = i;
                    
                    // Apply maxMessagesPerRequest limit if set
                    if (maxMessagesPerRequest > 0 && chatBuffer.length >= maxMessagesPerRequest) {
                        break;
                    }
                }
            }
            
            messagesToSummarize = chatBuffer;
        } else {
            // DEFAULT mode: Collect all messages (simple approach)
            for (let i = startIndex; i <= endIndex && i < chatHistory.length; i++) {
                const chatItem = chatHistory[i];
                if (chatItem.mes && chatItem.mes.trim() && !chatItem.is_system) {
                    const senderName = chatItem.is_user || chatItem.name === name1 ? name1 : name2;
                    messagesToSummarize.push(`${senderName}:\n${chatItem.mes}`);
                }
            }
        }
        
        if (messagesToSummarize.length === 0) {
            return null;
        }
        
        // Prepare messages for summary generation based on prompt builder mode
        let summaryMessages = [];
        
        if (isRawMode) {
            // RAW mode: Build raw prompt string
            // Format: [Summary Prompt]\n\n[Existing Summary]\n\n[Message 1]\n\n[Message 2]...
            const rawPromptParts = [];
            
            // Add existing summary if exists
            if (latestSummary) {
                rawPromptParts.push(latestSummary);
            }
            
            // Add messages
            rawPromptParts.push(...messagesToSummarize);
            
            const rawPrompt = rawPromptParts.filter(t => t.trim()).join('\n\n');
            
            if (!rawPrompt.trim()) {
                return null;
            }
            
            // RAW mode: system prompt + raw text as user message
            summaryMessages = [
                {
                    role: 'system',
                    content: summaryPrompt
                },
                {
                    role: 'user',
                    content: rawPrompt
                }
            ];
        } else {
            // DEFAULT mode: Standard message format
            const textToSummarize = [
                latestSummary ? latestSummary : '',
                ...messagesToSummarize
            ].filter(t => t.trim()).join('\n\n');
            
            if (!textToSummarize.trim()) {
                return null;
            }
            
            summaryMessages = [
                {
                    role: 'system',
                    content: summaryPrompt
                },
                {
                    role: 'user',
                    content: textToSummarize
                }
            ];
        }
        
        // Call chat completion API via HTTP request
        try {
            const nodeFetch = (await import('node-fetch')).default;
            const baseUrl = `http://localhost:${process.env.PORT || 8001}`;
            const generateUrl = `${baseUrl}/api/backends/chat-completions/generate`;
            
            // Prepare request body for chat completion
            const chatCompletionSource = serverSettings.chat_completion_source || 'openai';
            const requestBody = {
                messages: summaryMessages,
                chat_completion_source: chatCompletionSource,
                model: serverSettings.openai_model || serverSettings.vertexai_model || 'gpt-3.5-turbo',
                temperature: serverSettings.openai_temperature || serverSettings.vertexai_temperature || 0.7,
                max_tokens: memorySettings.overrideResponseLength || serverSettings.openai_max_tokens || serverSettings.vertexai_max_tokens || 500,
                stream: false,
            };
            
            // Add Vertex AI specific settings if using Vertex AI
            if (chatCompletionSource === 'google' || chatCompletionSource === 'vertexai') {
                if (serverSettings.vertexai_auth_mode !== undefined) {
                    requestBody.vertexai_auth_mode = serverSettings.vertexai_auth_mode;
                }
                if (serverSettings.vertexai_region !== undefined) {
                    requestBody.vertexai_region = serverSettings.vertexai_region;
                }
                if (serverSettings.vertexai_model !== undefined) {
                    requestBody.model = serverSettings.vertexai_model;
                }
                // Add reasoning settings for Gemini models
                if (serverSettings.reasoning_effort !== undefined) {
                    requestBody.reasoning_effort = serverSettings.reasoning_effort;
                }
                if (serverSettings.include_reasoning !== undefined) {
                    requestBody.include_reasoning = serverSettings.include_reasoning;
                }
            }
            
            // Add additional OpenAI settings if available
            if (serverSettings.openai_top_p !== undefined) {
                requestBody.top_p = serverSettings.openai_top_p;
            }
            if (serverSettings.openai_frequency_penalty !== undefined) {
                requestBody.frequency_penalty = serverSettings.openai_frequency_penalty;
            }
            if (serverSettings.openai_presence_penalty !== undefined) {
                requestBody.presence_penalty = serverSettings.openai_presence_penalty;
            }
            
            
            // Get CSRF token from request session if available
            let csrfToken = null;
            if (request && request.session) {
                // Try to get CSRF token from session
                csrfToken = request.session.csrfToken;
                
                // If not in session, generate one
                if (!csrfToken && request.session) {
                    try {
                        const csrfResponse = await nodeFetch(`${baseUrl}/csrf-token`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Cookie': request.headers.cookie || '', // Include session cookie
                            },
                        });
                        if (csrfResponse.ok) {
                            const csrfData = await csrfResponse.json();
                            csrfToken = csrfData.token;
                            // Store in session for next time
                            if (request.session) {
                                request.session.csrfToken = csrfToken;
                            }
                        }
                    } catch (error) {
                        console.warn('[generateSummaryForChat] Failed to get CSRF token:', error);
                    }
                }
            }
            
            // Make internal HTTP request to chat completion endpoint
            const headers = {
                'Content-Type': 'application/json',
            };
            
            // Add CSRF token if available
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }
            
            // Include session cookie if available
            if (request && request.headers && request.headers.cookie) {
                headers['Cookie'] = request.headers.cookie;
            }
            
            const response = await nodeFetch(generateUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[generateSummaryForChat] Chat completion API error:', response.status, errorText);
                return null;
            }
            
            const result = await response.json();
            
            // Extract summary from response
            let generatedSummary = null;
            if (result.choices && result.choices.length > 0) {
                generatedSummary = result.choices[0].message?.content || result.choices[0].text;
            } else if (result.text) {
                generatedSummary = result.text;
            } else if (typeof result === 'string') {
                generatedSummary = result;
            }
            
            if (!generatedSummary || !generatedSummary.trim()) {
                console.warn('[generateSummaryForChat] Empty summary received from API');
                return null;
            }
            
            // Remove reasoning tags if present (for models like o1)
            generatedSummary = generatedSummary.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            
            // Save summary to chat history
            // In RAW mode, save to the last used message index
            // In DEFAULT mode, save to second-to-last message (before the last message)
            let saveIndex = -1;
            
            if (isRawMode && lastUsedIndex >= 0) {
                // RAW mode: Save to the last message that was included in summary
                saveIndex = lastUsedIndex;
            } else {
                // DEFAULT mode: Save to second-to-last message
                saveIndex = chatHistory.length - 2;
            }
            
            if (saveIndex >= 0 && saveIndex < chatHistory.length) {
                if (!chatHistory[saveIndex].extra) {
                    chatHistory[saveIndex].extra = {};
                }
                chatHistory[saveIndex].extra.memory = generatedSummary;
                
                // Save chat history
                const handle = path.basename(directories.root);
                const cardName = characterDirName;
                await trySaveChat(chatHistory, chatFilePath, false, handle, cardName, directories.backups);
                
                console.log(`[generateSummaryForChat] Summary saved at index ${saveIndex}:`, {
                    saveIndex,
                    chatHistoryLength: chatHistory.length,
                    summaryLength: generatedSummary.length,
                    summaryPreview: generatedSummary.substring(0, 100),
                    savedExtra: chatHistory[saveIndex].extra,
                    filePath: chatFilePath
                });
                return generatedSummary;
            } else {
                console.warn('[generateSummaryForChat] Cannot save summary: invalid save index');
                return null;
            }
            
        } catch (error) {
            console.error('[generateSummaryForChat] Error calling chat completion API:', error);
            return null;
        }
        
    } catch (error) {
        console.error('[generateSummaryForChat] Error:', error);
        return null;
    }
}