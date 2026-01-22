/**
 * PostgreSQL User Repository 구현
 */

import { getPool } from '../../db/index.js';

export class PostgreSQLUserRepository {
  async getAll() {
    const pool = getPool();
    
    const query = `
      SELECT 
        handle,
        name,
        password_hash,
        salt,
        enabled,
        admin,
        created_at,
        updated_at
      FROM users
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    return result.rows.map(row => ({
      handle: row.handle,
      name: row.name,
      passwordHash: row.password_hash || '',
      salt: row.salt || '',
      enabled: row.enabled !== false,
      admin: row.admin === true,
      created: row.created_at ? new Date(row.created_at).getTime() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    }));
  }

  async get(handle) {
    const pool = getPool();
    
    const query = `
      SELECT 
        handle,
        name,
        password_hash,
        salt,
        enabled,
        admin,
        created_at,
        updated_at
      FROM users
      WHERE handle = $1
    `;
    
    const result = await pool.query(query, [handle]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      handle: row.handle,
      name: row.name,
      passwordHash: row.password_hash || '',
      salt: row.salt || '',
      enabled: row.enabled !== false,
      admin: row.admin === true,
      created: row.created_at ? new Date(row.created_at).getTime() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  async save(handle, data) {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // created_at 변환 (밀리초 timestamp 또는 ISO 문자열)
      let createdAt;
      if (data.created) {
        createdAt = new Date(data.created);
      } else if (data.createdAt) {
        createdAt = new Date(data.createdAt);
      } else {
        createdAt = new Date();
      }
      
      // UPSERT (INSERT ... ON CONFLICT UPDATE)
      await client.query(`
        INSERT INTO users (
          handle,
          name,
          password_hash,
          salt,
          enabled,
          admin,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (handle) 
        DO UPDATE SET
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          salt = EXCLUDED.salt,
          enabled = EXCLUDED.enabled,
          admin = EXCLUDED.admin,
          updated_at = NOW()
      `, [
        data.handle || handle,
        data.name,
        data.passwordHash || '',
        data.salt || '',
        data.enabled !== false,
        data.admin === true,
        createdAt,
      ]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(handle) {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      await client.query('DELETE FROM users WHERE handle = $1', [handle]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async exists(handle) {
    const pool = getPool();
    
    const query = `SELECT 1 FROM users WHERE handle = $1 LIMIT 1`;
    const result = await pool.query(query, [handle]);
    
    return result.rows.length > 0;
  }
}
