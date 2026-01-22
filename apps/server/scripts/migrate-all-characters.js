/**
 * 일괄 마이그레이션 스크립트
 * 파일시스템에 있는 모든 캐릭터를 PostgreSQL DB로 마이그레이션
 * 
 * 사용법:
 *   node scripts/migrate-all-characters.js
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

// 이제 다른 모듈 import
const { initUserStorage, getAllUserHandles } = await import('../src/users.js');
const { DEFAULT_USER } = await import('../src/constants.js');
const { FileSystemCharacterRepository } = await import('../src/repositories/file-system/character-repository.js');
const { PostgreSQLCharacterRepository } = await import('../src/repositories/postgresql/character-repository.js');
const { getPool } = await import('../src/db/index.js');

async function migrateAllCharacters() {
  console.log('=== 캐릭터 일괄 마이그레이션 시작 ===\n');

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

    // 3. 모든 사용자 가져오기
    const userHandles = await getAllUserHandles();
    if (userHandles.length === 0) {
      // 사용자가 없으면 기본 사용자 사용
      userHandles.push(DEFAULT_USER.handle);
    }

    console.log(`총 ${userHandles.length}명의 사용자 발견\n`);

    const fileRepo = new FileSystemCharacterRepository();
    const dbRepo = new PostgreSQLCharacterRepository();

    let totalMigrated = 0;
    let totalFailed = 0;
    const errors = [];

    // 4. 각 사용자의 캐릭터 마이그레이션
    for (const userId of userHandles) {
      console.log(`[${userId}] 마이그레이션 시작...`);

      try {
        // 파일시스템에서 모든 캐릭터 읽기
        const characters = await fileRepo.getAll(userId, false);
        console.log(`  파일시스템에서 ${characters.length}개 캐릭터 발견`);

        if (characters.length === 0) {
          console.log(`  ✓ 마이그레이션할 캐릭터 없음\n`);
          continue;
        }

        // 각 캐릭터를 DB로 저장
        let migrated = 0;
        let failed = 0;

        for (const character of characters) {
          try {
            await dbRepo.save(character.avatar, userId, character);
            migrated++;
            totalMigrated++;
          } catch (error) {
            failed++;
            totalFailed++;
            errors.push({
              userId,
              character: character.avatar,
              error: error.message
            });
            console.error(`  ✗ ${character.avatar} 마이그레이션 실패: ${error.message}`);
          }
        }

        console.log(`  ✓ ${migrated}개 성공, ${failed}개 실패\n`);

      } catch (error) {
        console.error(`  ✗ 사용자 ${userId} 마이그레이션 실패:`, error.message);
        totalFailed++;
      }
    }

    // 5. 결과 요약
    console.log('=== 마이그레이션 완료 ===');
    console.log(`총 성공: ${totalMigrated}개`);
    console.log(`총 실패: ${totalFailed}개`);

    if (errors.length > 0) {
      console.log('\n실패한 캐릭터:');
      errors.forEach(({ userId, character, error }) => {
        console.log(`  - [${userId}] ${character}: ${error}`);
      });
    }

    if (totalFailed > 0) {
      process.exit(1);
    } else {
      console.log('\n✓ 모든 캐릭터가 성공적으로 마이그레이션되었습니다!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n✗ 마이그레이션 실패:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 스크립트 실행
migrateAllCharacters();
