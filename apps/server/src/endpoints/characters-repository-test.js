/**
 * Character Repository 테스트 엔드포인트
 * Repository Pattern 테스트용
 */

import express from 'express';
import { getCharacterRepository } from '../repositories/factory.js';

const router = express.Router();

/**
 * GET /api/characters-repo-test/all
 * Repository를 사용한 캐릭터 목록 조회 테스트
 */
router.get('/all', async function (request, response) {
    try {
        if (!request.user) {
            return response.status(401).json({ error: 'Unauthorized' });
        }

        const userId = request.user.profile.handle;
        const repo = getCharacterRepository();
        
        console.log(`[Repository Test] Getting all characters for user: ${userId}`);
        const characters = await repo.getAll(userId, false);
        
        console.log(`[Repository Test] Found ${characters.length} characters`);
        return response.json({
            success: true,
            count: characters.length,
            characters: characters,
            repository: repo.constructor.name,
        });
    } catch (error) {
        console.error('[Repository Test] Error:', error);
        return response.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
        });
    }
});

/**
 * GET /api/characters-repo-test/get/:characterId
 * Repository를 사용한 특정 캐릭터 조회 테스트
 */
router.get('/get/:characterId', async function (request, response) {
    try {
        if (!request.user) {
            return response.status(401).json({ error: 'Unauthorized' });
        }

        const userId = request.user.profile.handle;
        const characterId = request.params.characterId;
        const repo = getCharacterRepository();
        
        console.log(`[Repository Test] Getting character: ${characterId} for user: ${userId}`);
        const character = await repo.get(characterId, userId);
        
        if (!character) {
            return response.status(404).json({
                success: false,
                error: 'Character not found',
            });
        }
        
        return response.json({
            success: true,
            character: character,
            repository: repo.constructor.name,
        });
    } catch (error) {
        console.error('[Repository Test] Error:', error);
        return response.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
        });
    }
});

export default router;
