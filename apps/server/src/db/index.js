/**
 * PostgreSQL 데이터베이스 연결 모듈
 */

import pg from 'pg';
import { getConfigValue } from '../util.js';

const { Pool } = pg;

let pool = null;

/**
 * 데이터베이스 연결 풀 초기화
 * @returns {Pool}
 */
export function initDatabase() {
  if (pool) {
    return pool;
  }

  // 환경 변수 우선, 없으면 config.yaml에서 읽기
  const passwordValue = process.env.DB_PASSWORD || getConfigValue('storage.password', '', 'string') || '';
  
  const config = {
    host: process.env.DB_HOST || getConfigValue('storage.host', 'localhost', 'string'),
    port: parseInt(process.env.DB_PORT || getConfigValue('storage.port', '5432', 'string')),
    database: process.env.DB_NAME || getConfigValue('storage.database', 'sillytavern', 'string'),
    user: process.env.DB_USER || getConfigValue('storage.user', 'postgres', 'string'),
    password: String(passwordValue), // 문자열로 강제 변환
    max: 20, // 연결 풀 크기
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
  
  console.log('[Database] Connecting to PostgreSQL:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    passwordSet: !!config.password,
    passwordType: typeof config.password
  });

  pool = new Pool(config);

  // 에러 핸들링
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
}

/**
 * 데이터베이스 연결 풀 가져오기
 * @returns {Pool}
 */
export function getPool() {
  if (!pool) {
    return initDatabase();
  }
  return pool;
}

/**
 * 데이터베이스 연결 종료
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
