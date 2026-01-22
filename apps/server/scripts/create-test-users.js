import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

// Config 파일 경로를 가장 먼저 설정 (다른 모듈 import 전에)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, '..', 'config.yaml');

// 동적 import로 setConfigFilePath 가져오기 (다른 모듈 import 전에)
const { setConfigFilePath } = await import('../src/util.js');
if (existsSync(configPath)) {
  setConfigFilePath(configPath);
} else {
  console.warn(`경고: config.yaml을 찾을 수 없습니다: ${configPath}`);
}

// 이제 다른 모듈 import (동적 import로 변경 - config 설정 후에 로드)
const storage = (await import('node-persist')).default;
const lodash = (await import('lodash')).default;

const { 
  KEY_PREFIX, 
  toKey, 
  getPasswordSalt, 
  getPasswordHash,
  getUserDirectories,
  ensurePublicDirectoriesExist,
  getAllUserHandles,
  initUserStorage
} = await import('../src/users.js');

const { checkForNewContent, CONTENT_TYPES } = await import('../src/endpoints/content-manager.js');

async function createTestUsers() {
  console.log('=== 테스트 사용자 생성 시작 ===\n');

  try {
    // 1. 사용자 스토리지 초기화
    const dataRoot = process.env.SILLYTAVERN_DATA_ROOT || './data';
    globalThis.DATA_ROOT = dataRoot;
    await initUserStorage(dataRoot);
    console.log(`데이터 루트: ${dataRoot}\n`);

    // 2. 기존 사용자 확인
    const existingHandles = await getAllUserHandles();
    console.log(`기존 사용자 수: ${existingHandles.length}`);
    if (existingHandles.length > 0) {
      console.log(`기존 사용자: ${existingHandles.join(', ')}\n`);
    }

    // 3. 테스트 사용자 정의
    const testUsers = [
      {
        handle: 'test-user1',
        name: '테스트 사용자 1',
        password: 'test1234',
        admin: false,
      },
      {
        handle: 'test-user2',
        name: '테스트 사용자 2',
        password: 'test1234',
        admin: false,
      },
    ];

    // 4. 각 테스트 사용자 생성
    let created = 0;
    let skipped = 0;

    for (const userData of testUsers) {
      const handle = lodash.kebabCase(String(userData.handle).toLowerCase().trim());

      // 이미 존재하는 사용자 확인
      if (existingHandles.includes(handle)) {
        console.log(`[${handle}] 이미 존재하는 사용자입니다. 건너뜁니다.`);
        skipped++;
        continue;
      }

      // 비밀번호 해시 생성
      const salt = getPasswordSalt();
      const passwordHash = getPasswordHash(userData.password, salt);

      // 사용자 객체 생성
      const newUser = {
        handle: handle,
        name: userData.name,
        created: Date.now(),
        password: passwordHash,
        salt: salt,
        admin: !!userData.admin,
        enabled: true,
      };

      // 사용자 저장
      await storage.setItem(toKey(handle), newUser);
      console.log(`[${handle}] 사용자 생성 완료`);
      console.log(`  이름: ${userData.name}`);
      console.log(`  비밀번호: ${userData.password}`);
      console.log(`  관리자: ${userData.admin ? '예' : '아니오'}`);

      // 사용자 디렉토리 생성
      console.log(`  디렉토리 생성 중...`);
      await ensurePublicDirectoriesExist();
      const directories = getUserDirectories(handle);
      await checkForNewContent([directories], [CONTENT_TYPES.SETTINGS]);
      console.log(`  디렉토리 생성 완료\n`);

      created++;
    }

    // 5. 결과 요약
    console.log('=== 사용자 생성 완료 ===');
    console.log(`생성됨: ${created}명`);
    console.log(`건너뜀: ${skipped}명`);

    if (created > 0) {
      console.log('\n생성된 사용자로 로그인할 수 있습니다:');
      testUsers.forEach(user => {
        if (!existingHandles.includes(lodash.kebabCase(user.handle.toLowerCase().trim()))) {
          console.log(`  - Handle: ${lodash.kebabCase(user.handle.toLowerCase().trim())}`);
          console.log(`    비밀번호: ${user.password}`);
        }
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n✗ 사용자 생성 실패:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 스크립트 실행
createTestUsers();
