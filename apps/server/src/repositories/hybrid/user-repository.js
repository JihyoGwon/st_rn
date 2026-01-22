/**
 * Hybrid User Repository 구현
 * DB에서 먼저 읽고, 없으면 파일시스템에서 읽어서 자동 마이그레이션
 */

import { FileSystemUserRepository } from '../file-system/user-repository.js';
import { PostgreSQLUserRepository } from '../postgresql/user-repository.js';

export class HybridUserRepository {
  constructor() {
    this.fileRepo = new FileSystemUserRepository();
    this.dbRepo = new PostgreSQLUserRepository();
    this.migrationCompleted = false; // 초기 마이그레이션 완료 여부 플래그
  }

  async getAll() {
    // 1. DB에서 먼저 읽기
    let dbData;
    try {
      dbData = await this.dbRepo.getAll();
    } catch (error) {
      console.error('[Hybrid] Failed to read from database:', error);
      dbData = []; // DB 읽기 실패 시 빈 배열로 처리
    }
    
    // 2. DB에 데이터가 있으면 그대로 반환
    if (dbData.length > 0) {
      this.migrationCompleted = true; // DB에 데이터가 있으므로 마이그레이션 완료로 간주
      return dbData;
    }
    
    // 3. DB가 비어있고, 아직 마이그레이션이 완료되지 않았다면 파일시스템에서 읽기
    if (!this.migrationCompleted) {
      const fileData = await this.fileRepo.getAll();
      
      // 4. 파일시스템 데이터를 DB로 자동 마이그레이션
      if (fileData.length > 0) {
        console.log(`[Hybrid] Initial migration: Migrating ${fileData.length} users from filesystem to database...`);
        try {
          await this.migrateToDatabase(fileData);
          this.migrationCompleted = true;
          console.log('[Hybrid] Initial migration completed successfully');
          // 마이그레이션 후 DB에서 다시 읽기
          return await this.dbRepo.getAll();
        } catch (error) {
          // 마이그레이션 실패 시 에러 발생
          console.error('[Hybrid] Initial migration failed:', error);
          throw new Error(`Initial migration failed: ${error.message}`);
        }
      }
    }
    
    return [];
  }

  async get(handle) {
    // 1. DB에서 먼저 시도
    let dbData;
    try {
      dbData = await this.dbRepo.get(handle);
    } catch (error) {
      console.error('[Hybrid] Failed to read from database:', error);
      dbData = null;
    }
    
    if (dbData) {
      return dbData;
    }
    
    // 2. DB에 없으면 파일시스템에서 읽기 (초기 마이그레이션 단계)
    if (!this.migrationCompleted) {
      const fileData = await this.fileRepo.get(handle);
      if (!fileData) {
        return null;
      }
      
      // 3. 파일시스템 데이터를 DB로 자동 마이그레이션
      try {
        await this.dbRepo.save(handle, fileData);
        return await this.dbRepo.get(handle); // 마이그레이션 후 DB에서 다시 읽기
      } catch (error) {
        console.warn(`[Hybrid] Failed to migrate user ${handle} to database, using filesystem data:`, error);
        return fileData;
      }
    }
    
    return null; // 마이그레이션 완료 후 DB에 없으면 null 반환
  }

  async save(handle, data) {
    // DB 저장이 우선 (실패 시 에러 발생)
    try {
      await this.dbRepo.save(handle, data);
    } catch (error) {
      console.error('[Hybrid] Failed to save to database:', error);
      throw error; // DB 저장 실패는 에러로 처리
    }
    
    // DB 저장 성공 후 파일시스템에도 저장 (백업용, 실패해도 계속 진행)
    try {
      await this.fileRepo.save(handle, data);
    } catch (error) {
      // 파일시스템 저장 실패는 경고만 (DB는 이미 저장됨)
      console.warn('[Hybrid] Failed to save to filesystem (non-critical):', error);
    }
  }

  async delete(handle) {
    // 파일시스템과 DB 둘 다에서 삭제
    await Promise.all([
      this.fileRepo.delete(handle).catch(error => {
        console.warn(`[Hybrid] Failed to delete from filesystem (non-critical): ${handle}`, error);
      }),
      this.dbRepo.delete(handle).catch(error => {
        console.error(`[Hybrid] Failed to delete from database: ${handle}`, error);
        throw error; // DB 삭제 실패는 에러로 처리
      }),
    ]);
  }

  async exists(handle) {
    // DB 또는 파일시스템 중 하나라도 있으면 true
    const dbExists = await this.dbRepo.exists(handle);
    if (dbExists) return true;
    
    const fileExists = await this.fileRepo.exists(handle);
    return fileExists;
  }

  /**
   * 파일시스템 데이터를 DB로 마이그레이션
   */
  async migrateToDatabase(fileData) {
    const errors = [];
    
    for (const user of fileData) {
      try {
        await this.dbRepo.save(user.handle, user);
      } catch (error) {
        errors.push({ handle: user.handle, error });
        console.error(`[Hybrid] Failed to migrate user ${user.handle}:`, error);
      }
    }
    
    // 일부라도 실패하면 에러 발생
    if (errors.length > 0) {
      throw new Error(`Failed to migrate ${errors.length} users: ${errors.map(e => e.handle).join(', ')}`);
    }
  }
}
