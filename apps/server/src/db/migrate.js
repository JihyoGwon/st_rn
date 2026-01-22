/**
 * 데이터베이스 마이그레이션 스크립트
 * PostgreSQL 스키마 생성
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// Config 파일 경로를 가장 먼저 설정 (다른 모듈 import 전에)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '..', '..', 'config.yaml');

// setConfigFilePath를 먼저 import하고 설정
const { setConfigFilePath } = await import('../util.js');
if (existsSync(configPath)) {
  setConfigFilePath(configPath);
} else {
  console.warn(`경고: config.yaml을 찾을 수 없습니다: ${configPath}`);
}

// 이제 다른 모듈 import
import { getPool } from './index.js';

async function runMigrations() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log('Starting database migrations...');

    // 마이그레이션 파일 읽기
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`✓ ${file} completed`);
      } catch (error) {
        await client.query('ROLLBACK');
        // 테이블이 이미 존재하는 경우는 경고만 (42P07 = duplicate_table)
        if (error.code === '42P07') {
          console.warn(`⚠ ${file} skipped (table already exists)`);
          continue;
        }
        console.error(`✗ ${file} failed:`, error.message);
        throw error;
      }
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 직접 실행 시
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMainModule) {
  runMigrations()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { runMigrations };
