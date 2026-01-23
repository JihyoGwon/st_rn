import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import mime from 'mime-types';
import express from 'express';
import sanitize from 'sanitize-filename';
import { Jimp, JimpMime } from '../jimp.js';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { getConfigValue, invalidateFirefoxCache } from '../util.js';
import { getCharacterRepository } from '../repositories/factory.js';
import { getUserDirectories, getGlobalDirectories } from '../users.js';

const thumbnailsEnabled = !!getConfigValue('thumbnails.enabled', true, 'boolean');
const quality = Math.min(100, Math.max(1, parseInt(getConfigValue('thumbnails.quality', 95, 'number'))));
const pngFormat = String(getConfigValue('thumbnails.format', 'jpg')).toLowerCase().trim() === 'png';

/**
 * @typedef {'bg' | 'avatar' | 'persona'} ThumbnailType
 */

/** @type {Record<string, number[]>} */
export const dimensions = {
    'bg': getConfigValue('thumbnails.dimensions.bg', [160, 90]),
    'avatar': getConfigValue('thumbnails.dimensions.avatar', [96, 144]),
    'persona': getConfigValue('thumbnails.dimensions.persona', [96, 144]),
};

/**
 * Gets a path to thumbnail folder based on the type.
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {ThumbnailType} type Thumbnail type
 * @returns {string} Path to the thumbnails folder
 */
function getThumbnailFolder(directories, type) {
    let thumbnailFolder;

    switch (type) {
        case 'bg':
            thumbnailFolder = directories.thumbnailsBg;
            break;
        case 'avatar':
            thumbnailFolder = directories.thumbnailsAvatar;
            break;
        case 'persona':
            thumbnailFolder = directories.thumbnailsPersona;
            break;
    }

    return thumbnailFolder;
}

/**
 * Gets a path to the original images folder based on the type.
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {ThumbnailType} type Thumbnail type
 * @returns {string} Path to the original images folder
 */
function getOriginalFolder(directories, type) {
    let originalFolder;

    switch (type) {
        case 'bg':
            originalFolder = directories.backgrounds;
            break;
        case 'avatar':
            originalFolder = directories.characters;
            break;
        case 'persona':
            originalFolder = directories.avatars;
            break;
    }

    return originalFolder;
}

/**
 * Finds the original file path for avatar type.
 * 캐릭터는 사용자별 디렉토리에 저장되며, is_shared인 경우 다른 사용자도 접근 가능.
 * @param {string} file File name
 * @param {string} userHandle User handle (for checking user-specific directory)
 * @param {string} [ownerHandle] Owner handle (for shared characters)
 * @returns {string|null} Path to the original file, or null if not found
 */
function findAvatarOriginalPath(file, userHandle, ownerHandle = null) {
    // 캐릭터는 사용자별 디렉토리에 저장됨
    // 1. 현재 사용자 디렉토리 확인
    const userPath = path.join(globalThis.DATA_ROOT, userHandle, 'characters', file);
    if (fs.existsSync(userPath)) {
        return userPath;
    }
    
    // 2. 공용 캐릭터인 경우 소유자 디렉토리 확인
    if (ownerHandle && ownerHandle !== userHandle) {
        const ownerPath = path.join(globalThis.DATA_ROOT, ownerHandle, 'characters', file);
        if (fs.existsSync(ownerPath)) {
            return ownerPath;
        }
    }
    
    return null;
}

/**
 * Removes the generated thumbnail from the disk.
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {ThumbnailType} type Type of the thumbnail
 * @param {string} file Name of the file
 */
export function invalidateThumbnail(directories, type, file) {
    const folder = getThumbnailFolder(directories, type);
    if (folder === undefined) throw new Error('Invalid thumbnail type');

    const pathToThumbnail = path.join(folder, sanitize(file));

    if (fs.existsSync(pathToThumbnail)) {
        fs.unlinkSync(pathToThumbnail);
    }
}

/**
 * Generates a thumbnail from a specific file path.
 * @param {string} originalFilePath Full path to the original file
 * @param {import('../users.js').UserDirectoryList} directories User directories (for thumbnail folder)
 * @param {ThumbnailType} type Type of the thumbnail
 * @param {string} file Name of the file
 * @returns {Promise<string|null>} Path to cached thumbnail or null
 */
async function generateThumbnailFromPath(originalFilePath, directories, type, file) {
    let thumbnailFolder = getThumbnailFolder(directories, type);
    if (thumbnailFolder === undefined) throw new Error('Invalid thumbnail type');
    const pathToCachedFile = path.join(thumbnailFolder, file);
    
    const cachedFileExists = fs.existsSync(pathToCachedFile);
    const originalFileExists = fs.existsSync(originalFilePath);

    // to handle cases when original image was updated after thumb creation
    let shouldRegenerate = false;

    if (cachedFileExists && originalFileExists) {
        const originalStat = fs.statSync(originalFilePath);
        const cachedStat = fs.statSync(pathToCachedFile);

        if (originalStat.mtimeMs > cachedStat.ctimeMs) {
            shouldRegenerate = true;
        }
    }

    if (cachedFileExists && !shouldRegenerate) {
        return pathToCachedFile;
    }

    if (!originalFileExists) {
        return null;
    }

    try {
        let buffer;

        try {
            const size = dimensions[type];
            const fileBuffer = await fsPromises.readFile(originalFilePath);
            const image = await Jimp.fromBuffer(fileBuffer);
            const width = !isNaN(size?.[0]) && size?.[0] > 0 ? size[0] : image.bitmap.width;
            const height = !isNaN(size?.[1]) && size?.[1] > 0 ? size[1] : image.bitmap.height;
            image.cover({ w: width, h: height });
            buffer = pngFormat
                ? await image.getBuffer(JimpMime.png)
                : await image.getBuffer(JimpMime.jpeg, { quality: quality, jpegColorSpace: 'ycbcr' });
        }
        catch (inner) {
            console.warn(`Thumbnailer can not process the image: ${originalFilePath}. Using original size`, inner);
            buffer = fs.readFileSync(originalFilePath);
        }

        writeFileAtomicSync(pathToCachedFile, buffer);
    }
    catch (outer) {
        return null;
    }

    return pathToCachedFile;
}

/**
 * Generates a thumbnail for the given file.
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {ThumbnailType} type Type of the thumbnail
 * @param {string} file Name of the file
 * @returns
 */
async function generateThumbnail(directories, type, file) {
    let thumbnailFolder = getThumbnailFolder(directories, type);
    let originalFolder = getOriginalFolder(directories, type);
    if (thumbnailFolder === undefined || originalFolder === undefined) throw new Error('Invalid thumbnail type');
    const pathToCachedFile = path.join(thumbnailFolder, file);
    const pathToOriginalFile = path.join(originalFolder, file);

    const cachedFileExists = fs.existsSync(pathToCachedFile);
    const originalFileExists = fs.existsSync(pathToOriginalFile);

    // to handle cases when original image was updated after thumb creation
    let shouldRegenerate = false;

    if (cachedFileExists && originalFileExists) {
        const originalStat = fs.statSync(pathToOriginalFile);
        const cachedStat = fs.statSync(pathToCachedFile);

        if (originalStat.mtimeMs > cachedStat.ctimeMs) {
            //console.warn('Original file changed. Regenerating thumbnail...');
            shouldRegenerate = true;
        }
    }

    if (cachedFileExists && !shouldRegenerate) {
        return pathToCachedFile;
    }

    if (!originalFileExists) {
        return null;
    }

    try {
        let buffer;

        try {
            const size = dimensions[type];
            // 파일을 직접 읽어서 버퍼로 변환한 후 Jimp.fromBuffer를 사용
            // 이렇게 하면 fetch-patch.js의 제한을 우회할 수 있음
            const fileBuffer = await fsPromises.readFile(pathToOriginalFile);
            const image = await Jimp.fromBuffer(fileBuffer);
            const width = !isNaN(size?.[0]) && size?.[0] > 0 ? size[0] : image.bitmap.width;
            const height = !isNaN(size?.[1]) && size?.[1] > 0 ? size[1] : image.bitmap.height;
            image.cover({ w: width, h: height });
            buffer = pngFormat
                ? await image.getBuffer(JimpMime.png)
                : await image.getBuffer(JimpMime.jpeg, { quality: quality, jpegColorSpace: 'ycbcr' });
        }
        catch (inner) {
            console.warn(`Thumbnailer can not process the image: ${pathToOriginalFile}. Using original size`, inner);
            buffer = fs.readFileSync(pathToOriginalFile);
        }

        writeFileAtomicSync(pathToCachedFile, buffer);
    }
    catch (outer) {
        return null;
    }

    return pathToCachedFile;
}

/**
 * Ensures that the thumbnail cache for backgrounds is valid.
 * @param {import('../users.js').UserDirectoryList[]} directoriesList User directories
 * @returns {Promise<void>} Promise that resolves when the cache is validated
 */
export async function ensureThumbnailCache(directoriesList) {
    for (const directories of directoriesList) {
        const cacheFiles = fs.readdirSync(directories.thumbnailsBg);

        // files exist, all ok
        if (cacheFiles.length) {
            continue;
        }

        console.info('Generating thumbnails cache. Please wait...');

        const bgFiles = fs.readdirSync(directories.backgrounds);
        const tasks = [];

        for (const file of bgFiles) {
            tasks.push(generateThumbnail(directories, 'bg', file));
        }

        await Promise.all(tasks);
        console.info(`Done! Generated: ${bgFiles.length} preview images`);
    }
}

export const router = express.Router();

// Important: This route must be mounted as '/thumbnail'. It is used in the client code and saved to chat files.
router.get('/', async function (request, response) {
    try{
        if (typeof request.query.file !== 'string' || typeof request.query.type !== 'string') {
            return response.sendStatus(400);
        }

        const type = request.query.type;
        const file = sanitize(request.query.file);

        if (!type || !file) {
            return response.sendStatus(400);
        }

        if (!(type === 'bg' || type === 'avatar' || type === 'persona')) {
            return response.sendStatus(400);
        }

        if (sanitize(file) !== file) {
            console.error('Malicious filename prevented');
            return response.sendStatus(403);
        }

        if (!thumbnailsEnabled) {
            let pathToOriginalFile;

            if (type === 'avatar') {
                // 아바타 타입: 사용자별 디렉토리 확인 (캐릭터는 사용자별 저장)
                const userId = request.user.profile.handle;
                
                // 먼저 DB에서 캐릭터 정보 확인 (공용 캐릭터인지 확인)
                let ownerHandle = null;
                try {
                    const repo = getCharacterRepository();
                    const character = await repo.get(file, userId);
                    
                    if (character) {
                        // 캐릭터 소유자 확인
                        ownerHandle = character.userId;
                    }
                } catch (error) {
                    // Repository 실패 시 현재 사용자로 가정
                    console.warn('[Thumbnails] Failed to check character owner:', error);
                }
                
                // 소유자 디렉토리에서 찾기 (현재 사용자 또는 공용 캐릭터 소유자)
                pathToOriginalFile = findAvatarOriginalPath(file, userId, ownerHandle);
            } else {
                // 다른 타입: 기존 방식 유지
                const folder = getOriginalFolder(request.user.directories, type);
                if (folder === undefined) {
                    return response.sendStatus(400);
                }
                pathToOriginalFile = path.join(folder, file);
            }

            if (!pathToOriginalFile || !fs.existsSync(pathToOriginalFile)) {
                return response.sendStatus(404);
            }
            const contentType = mime.lookup(pathToOriginalFile) || 'image/png';
            const originalFile = await fsPromises.readFile(pathToOriginalFile);
            response.setHeader('Content-Type', contentType);

            invalidateFirefoxCache(pathToOriginalFile, request, response);

            return response.send(originalFile);
        }

        // 아바타 타입인 경우 사용자별 디렉토리 확인
        let directories = request.user.directories;
        let originalFilePath = null;
        
        if (type === 'avatar') {
            const userId = request.user.profile.handle;
            
            // DB에서 캐릭터 정보 확인 (공용 캐릭터인지 확인)
            let ownerHandle = null;
            try {
                const repo = getCharacterRepository();
                const character = await repo.get(file, userId);
                
                if (character) {
                    ownerHandle = character.userId;
                }
            } catch (error) {
                console.warn('[Thumbnails] Failed to check character owner:', error);
            }
            
            // 소유자 디렉토리에서 원본 파일 찾기
            originalFilePath = findAvatarOriginalPath(file, userId, ownerHandle);
            
            if (originalFilePath) {
                // 썸네일은 원본 파일의 소유자 디렉토리에 저장 (일관성 유지)
                // 원본 파일이 어느 사용자 디렉토리에 있는지 확인
                if (ownerHandle && ownerHandle !== userId) {
                    // 공용 캐릭터인 경우, 소유자의 디렉토리에 썸네일 저장
                    directories = getUserDirectories(ownerHandle);
                }
                // 그 외의 경우는 request.user.directories 사용 (현재 사용자 디렉토리)
            }
        }
        
        // 원본 파일 경로가 있으면 그것을 사용, 없으면 기존 방식대로
        const pathToCachedFile = originalFilePath 
            ? await generateThumbnailFromPath(originalFilePath, directories, type, file)
            : await generateThumbnail(directories, type, file);

        if (!pathToCachedFile) {
            return response.sendStatus(404);
        }

        if (!fs.existsSync(pathToCachedFile)) {
            return response.sendStatus(404);
        }

        const contentType = mime.lookup(pathToCachedFile) || 'image/jpeg';
        const cachedFile = await fsPromises.readFile(pathToCachedFile);
        response.setHeader('Content-Type', contentType);

        invalidateFirefoxCache(file, request, response);

        return response.send(cachedFile);
    } catch (error) {
        console.error('Failed getting thumbnail', error);
        return response.sendStatus(500);
    }
});
