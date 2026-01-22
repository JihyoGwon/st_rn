/**
 * DB에서 users 테이블 데이터 확인 스크립트
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

// Config 파일 경로를 가장 먼저 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, '..', 'config.yaml');

const { setConfigFilePath } = await import('../src/util.js');
if (existsSync(configPath)) {
  setConfigFilePath(configPath);
}

// DB 연결
const { getPool } = await import('../src/db/index.js');

async function checkUsersDB() {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT handle, name, enabled, admin, created_at FROM users ORDER BY created_at');
    
    console.log('=== DB users 테이블 데이터 ===\n');
    console.log(`총 ${result.rows.length}명의 사용자:\n`);
    
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.handle}`);
      console.log(`   이름: ${user.name}`);
      console.log(`   활성화: ${user.enabled ? '예' : '아니오'}`);
      console.log(`   어드민: ${user.admin ? '예' : '아니오'}`);
      console.log(`   생성일: ${new Date(user.created_at).toLocaleString('ko-KR')}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('오류:', error);
    process.exit(1);
  }
}

checkUsersDB();
