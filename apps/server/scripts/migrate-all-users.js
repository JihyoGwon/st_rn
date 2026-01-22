/**
 * 일괄 사용자 마이그레이션 스크립트
 * 파일시스템(node-persist)에 있는 모든 사용자를 PostgreSQL DB로 마이그레이션
 * 
 * 사용법:
 *   node scripts/migrate-all-users.js
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

// Config 파일 경로를 가장 먼저 설정 (다른 모듈 import 전에)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, '..', 'config.yaml');

// setConfigFilePath를 먼저 import하고 설정
const { setConfigFilePath } = await import('../src/util.js');
if (existsSync(configPath)) {
  setConfigFilePath(configPath);
} else {
  console.warn(`경고: config.yaml을 찾을 수 없습니다: ${configPath}`);
}

// 이제 다른 모듈 import (동적 import로 변경 - config 설정 후에 로드)
const { initUserStorage, getAllUserHandles } = await import('../src/users.js');
const { FileSystemUserRepository } = await import('../src/repositories/file-system/user-repository.js');
const { PostgreSQLUserRepository } = await import('../src/repositories/postgresql/user-repository.js');
const { getPool } = await import('../src/db/index.js');

async function migrateAllUsers() {
  console.log('=== 사용자 일괄 마이그레이션 시작 ===\n');

  try {
    // 1. 사용자 스토리지 초기화
    const dataRoot = process.env.SILLYTAVERN_DATA_ROOT || './data';
    globalThis.DATA_ROOT = dataRoot;
    await initUserStorage(dataRoot);
    console.log(`데이터 루트: ${dataRoot}\n`);

    // 2. DB 연결 확인
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
      console.log('✓ PostgreSQL 연결 확인\n');
    } finally {
      client.release();
    }

    // 3. 파일시스템에서 모든 사용자 가져오기
    const fileRepo = new FileSystemUserRepository();
    const users = await fileRepo.getAll();
    console.log(`파일시스템에서 ${users.length}명의 사용자 발견\n`);

    if (users.length === 0) {
      console.log('✓ 마이그레이션할 사용자가 없습니다.');
      process.exit(0);
    }

    // 4. 각 사용자를 DB로 저장
    const dbRepo = new PostgreSQLUserRepository();
    let migrated = 0;
    let failed = 0;
    const errors = [];

    for (const user of users) {
      try {
        await dbRepo.save(user.handle, user);
        console.log(`✓ [${user.handle}] 마이그레이션 완료`);
        migrated++;
      } catch (error) {
        failed++;
        errors.push({
          handle: user.handle,
          error: error.message
        });
        console.error(`✗ [${user.handle}] 마이그레이션 실패: ${error.message}`);
      }
    }

    // 5. 결과 요약
    console.log('\n=== 마이그레이션 완료 ===');
    console.log(`총 성공: ${migrated}명`);
    console.log(`총 실패: ${failed}명`);

    if (errors.length > 0) {
      console.log('\n실패한 사용자:');
      errors.forEach(({ handle, error }) => {
        console.log(`  - [${handle}]: ${error}`);
      });
    }

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('\n✓ 모든 사용자가 성공적으로 마이그레이션되었습니다!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n✗ 마이그레이션 실패:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 스크립트 실행
migrateAllUsers();
