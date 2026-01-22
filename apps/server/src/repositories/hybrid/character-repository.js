/**
 * Hybrid Character Repository
 * PostgreSQL 모드에서도 파일시스템 데이터를 자동으로 읽고 마이그레이션
 */

import { FileSystemCharacterRepository } from '../file-system/character-repository.js';
import { PostgreSQLCharacterRepository } from '../postgresql/character-repository.js';

export class HybridCharacterRepository {
  constructor() {
    this.fileRepo = new FileSystemCharacterRepository();
    this.dbRepo = new PostgreSQLCharacterRepository();
    this.migrationCompleted = false; // 마이그레이션 완료 여부
  }

  async getAll(userId, shallow = false) {
    // 1. DB에서 읽기
    let dbData;
    try {
      dbData = await this.dbRepo.getAll(userId, shallow);
    } catch (error) {
      // DB 읽기 실패는 에러 (파일시스템으로 폴백하지 않음)
      console.error('[Hybrid] Failed to read from database:', error);
      throw new Error(`Database read failed: ${error.message}`);
    }
    
    // 2. DB에 데이터가 있으면 그대로 반환
    if (dbData.length > 0) {
      this.migrationCompleted = true; // 마이그레이션 완료 표시
      return dbData;
    }
    
    // 3. DB가 비어있고 마이그레이션을 아직 안 했다면 → 초기 마이그레이션
    if (!this.migrationCompleted) {
      const fileData = await this.fileRepo.getAll(userId, shallow);
      
      if (fileData.length > 0) {
        console.log(`[Hybrid] Initial migration: Migrating ${fileData.length} characters from filesystem to database...`);
        try {
          await this.migrateToDatabase(userId, fileData);
          console.log('[Hybrid] Initial migration completed successfully');
          this.migrationCompleted = true;
          // 마이그레이션 후 DB에서 다시 읽기
          return await this.dbRepo.getAll(userId, shallow);
        } catch (error) {
          // 마이그레이션 실패는 에러
          console.error('[Hybrid] Initial migration failed:', error);
          throw new Error(`Initial migration failed: ${error.message}`);
        }
      }
    }
    
    // 4. 마이그레이션 완료 후에도 DB가 비어있으면 → 문제!
    if (this.migrationCompleted && dbData.length === 0) {
      console.warn('[Hybrid] Database is empty after migration. This might indicate a problem.');
    }
    
    return [];
  }

  async get(characterId, userId) {
    // 1. DB에서 읽기
    let dbData;
    try {
      dbData = await this.dbRepo.get(characterId, userId);
    } catch (error) {
      console.error('[Hybrid] Failed to read from database:', error);
      throw new Error(`Database read failed: ${error.message}`);
    }
    
    // 2. DB에 있으면 반환
    if (dbData) {
      return dbData;
    }
    
    // 3. DB에 없고 마이그레이션을 아직 안 했다면 → 초기 마이그레이션 시도
    if (!this.migrationCompleted) {
      const fileData = await this.fileRepo.get(characterId, userId);
      if (fileData) {
        // 파일시스템에 있으면 DB로 마이그레이션
        try {
          await this.dbRepo.save(characterId, userId, fileData);
          return fileData;
        } catch (error) {
          console.error('[Hybrid] Failed to migrate character to database:', error);
          throw new Error(`Migration failed: ${error.message}`);
        }
      }
    }
    
    // 4. 마이그레이션 완료 후에도 DB에 없으면 → null 반환 (파일시스템으로 폴백 안 함)
    return null;
  }

  async save(characterId, userId, data) {
    // DB 저장이 우선 (실패 시 에러 발생)
    try {
      await this.dbRepo.save(characterId, userId, data);
    } catch (error) {
      console.error('[Hybrid] Failed to save to database:', error);
      throw error; // DB 저장 실패는 에러로 처리
    }
    
    // DB 저장 성공 후 파일시스템에도 저장 (백업용, 실패해도 계속 진행)
    try {
      await this.fileRepo.save(characterId, userId, data);
    } catch (error) {
      // 파일시스템 저장 실패는 경고만 (DB는 이미 저장됨)
      console.warn('[Hybrid] Failed to save to filesystem (non-critical):', error);
    }
  }

  async delete(characterId, userId) {
    // 파일시스템과 DB 둘 다에서 삭제
    await Promise.all([
      this.fileRepo.delete(characterId, userId).catch(() => {}),
      this.dbRepo.delete(characterId, userId).catch(() => {}),
    ]);
  }

  async exists(characterId, userId) {
    // DB 또는 파일시스템 중 하나라도 있으면 true
    const dbExists = await this.dbRepo.exists(characterId, userId);
    if (dbExists) return true;
    
    const fileExists = await this.fileRepo.exists(characterId, userId);
    return fileExists;
  }

  /**
   * 파일시스템 데이터를 DB로 마이그레이션
   * 실패 시 에러 발생 (모든 데이터가 마이그레이션되어야 함)
   */
  async migrateToDatabase(userId, fileData) {
    const errors = [];
    
    for (const character of fileData) {
      try {
        await this.dbRepo.save(character.avatar, userId, character);
      } catch (error) {
        errors.push({ character: character.avatar, error });
        console.error(`[Hybrid] Failed to migrate character ${character.avatar}:`, error);
      }
    }
    
    // 일부라도 실패하면 에러 발생
    if (errors.length > 0) {
      throw new Error(`Failed to migrate ${errors.length} characters: ${errors.map(e => e.character).join(', ')}`);
    }
  }
}
