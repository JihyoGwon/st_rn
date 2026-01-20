import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mime from 'mime-types';
import { serverDirectory } from './server-directory.js';
import { getRequestURL, isFileURL, isPathUnderParent } from './util.js';

const originalFetch = globalThis.fetch;

const ALLOWED_EXTENSIONS = [
    '.wasm',
];

// Patched fetch function that handles file URLs
globalThis.fetch = async (/** @type {string | URL | Request} */ request, /** @type {RequestInit | undefined} */ options) => {
    if (!isFileURL(request)) {
        return originalFetch(request, options);
    }
    const url = getRequestURL(request);
    const filePath = path.resolve(fileURLToPath(url));
    const parsedPath = path.parse(filePath);
    
    // WASM 파일은 node_modules 안에 있을 수 있으므로, 여러 레벨의 상위 디렉토리도 허용
    const serverParentDirectory = path.dirname(serverDirectory);
    const projectRoot = path.resolve(serverDirectory, '..', '..');
    const isUnderServerDirectory = isPathUnderParent(serverDirectory, filePath);
    const isUnderServerParentDirectory = isPathUnderParent(serverParentDirectory, filePath);
    const isUnderProjectRoot = isPathUnderParent(projectRoot, filePath);
    const isInNodeModules = filePath.includes(path.sep + 'node_modules' + path.sep);
    
    // WASM 파일이 node_modules 안에 있고, serverDirectory/상위 디렉토리/프로젝트 루트 안에 있으면 허용
    if (!isUnderServerDirectory && !isUnderServerParentDirectory && !(isUnderProjectRoot && isInNodeModules)) {
        throw new Error('Requested file path is outside of the server directory.');
    }
    
    if (!ALLOWED_EXTENSIONS.includes(parsedPath.ext)) {
        throw new Error('Unsupported file extension.');
    }
    const fileName = parsedPath.base;
    const buffer = await fs.promises.readFile(filePath);
    const response = new Response(buffer, {
        status: 200,
        statusText: 'OK',
        headers: {
            'Content-Type': mime.lookup(fileName) || 'application/octet-stream',
            'Content-Length': buffer.length.toString(),
        },
    });
    return response;
};
