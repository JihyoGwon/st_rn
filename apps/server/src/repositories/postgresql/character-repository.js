/**
 * PostgreSQL Character Repository 구현
 */

import { getPool } from '../../db/index.js';

export class PostgreSQLCharacterRepository {
  async getAll(userId, shallow = false) {
    const pool = getPool();
    
    const query = shallow
      ? `
        SELECT 
          id,
          user_id,
          character_name,
          avatar,
          date_added,
          create_date,
          chat_size,
          date_last_chat,
          data_size,
          is_shared
        FROM characters
        WHERE user_id = $1 OR is_shared = true
        ORDER BY date_added DESC
      `
      : `
        SELECT 
          id,
          user_id,
          character_name,
          character_data,
          avatar,
          json_data,
          date_added,
          create_date,
          chat_size,
          date_last_chat,
          data_size,
          is_shared
        FROM characters
        WHERE user_id = $1 OR is_shared = true
        ORDER BY date_added DESC
      `;

    console.log('[PostgreSQLCharacterRepository] getAll query:', {
      userId,
      shallow,
      query: query.substring(0, 100) + '...',
    });

    const result = await pool.query(query, [userId]);
    
    console.log('[PostgreSQLCharacterRepository] getAll result:', {
      totalCount: result.rows.length,
      userCharacters: result.rows.filter(r => r.user_id === userId).length,
      sharedCharacters: result.rows.filter(r => r.is_shared === true).length,
      characters: result.rows.map(r => ({
        name: r.character_name,
        userId: r.user_id,
        isShared: r.is_shared,
      })),
    });

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      characterName: row.character_name,
      characterData: shallow ? null : row.character_data,
      avatar: row.avatar,
      jsonData: shallow ? undefined : row.json_data,
      dateAdded: row.date_added ? Number(row.date_added) : undefined,
      createDate: row.create_date ? new Date(row.create_date).toISOString() : undefined,
      chatSize: row.chat_size || 0,
      dateLastChat: row.date_last_chat ? new Date(row.date_last_chat).getTime() : undefined,
      dataSize: row.data_size || 0,
      isShared: row.is_shared || false,
    }));
  }

  async get(characterId, userId) {
    const pool = getPool();
    
    // characterId가 UUID인지 파일명인지 확인
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(characterId);
    
    // 공용 캐릭터도 가져올 수 있도록 수정
    // 사용자가 소유한 캐릭터이거나 공용 캐릭터(is_shared = true)인 경우
    const query = isUUID
      ? `
        SELECT * FROM characters
        WHERE id = $1 AND (user_id = $2 OR is_shared = true)
      `
      : `
        SELECT * FROM characters
        WHERE avatar = $1 AND (user_id = $2 OR is_shared = true)
      `;

    const result = await pool.query(query, [characterId, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      characterName: row.character_name,
      characterData: row.character_data,
      avatar: row.avatar,
      jsonData: row.json_data,
      dateAdded: row.date_added ? Number(row.date_added) : undefined,
      createDate: row.create_date ? new Date(row.create_date).toISOString() : undefined,
      chatSize: row.chat_size || 0,
      dateLastChat: row.date_last_chat ? new Date(row.date_last_chat).getTime() : undefined,
      dataSize: row.data_size || 0,
      isShared: row.is_shared || false,
    };
  }

  async save(characterId, userId, data) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // characterId가 UUID인지 확인
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(characterId);

      if (isUUID && data.id === characterId) {
        // 업데이트 (is_shared는 명시적으로 업데이트하지 않음 - 기존 값 유지)
        await client.query(`
          UPDATE characters
          SET
            character_name = $1,
            character_data = $2,
            avatar = $3,
            json_data = $4,
            date_added = $5,
            create_date = $6,
            chat_size = $7,
            date_last_chat = $8,
            data_size = $9,
            updated_at = NOW()
          WHERE id = $10 AND user_id = $11
        `, [
          data.characterName,
          JSON.stringify(data.characterData),
          data.avatar,
          data.jsonData,
          data.dateAdded ? Math.floor(Number(data.dateAdded)) : null, // BIGINT는 정수만 받음
          data.createDate ? new Date(data.createDate) : null,
          data.chatSize || 0,
          data.dateLastChat ? new Date(Math.floor(Number(data.dateLastChat))) : null,
          data.dataSize || 0,
          characterId,
          userId,
        ]);
      } else {
        // 삽입 (avatar를 기준으로)
        // 기존 레코드의 is_shared 값을 유지하기 위해 서브쿼리 사용
        await client.query(`
          INSERT INTO characters (
            user_id,
            character_name,
            character_data,
            avatar,
            json_data,
            date_added,
            create_date,
            chat_size,
            date_last_chat,
            data_size,
            is_shared
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE((SELECT is_shared FROM characters WHERE user_id = $1 AND character_name = $2), false))
          ON CONFLICT (user_id, character_name) 
          DO UPDATE SET
            character_data = EXCLUDED.character_data,
            json_data = EXCLUDED.json_data,
            chat_size = EXCLUDED.chat_size,
            date_last_chat = EXCLUDED.date_last_chat,
            data_size = EXCLUDED.data_size,
            updated_at = NOW()
            -- is_shared는 업데이트하지 않음 (기존 값 유지)
        `, [
          userId,
          data.characterName,
          JSON.stringify(data.characterData),
          data.avatar,
          data.jsonData,
          data.dateAdded ? Math.floor(Number(data.dateAdded)) : null, // BIGINT는 정수만 받음
          data.createDate ? new Date(data.createDate) : null,
          data.chatSize || 0,
          data.dateLastChat ? (data.dateLastChat ? new Date(Math.floor(Number(data.dateLastChat))) : null) : null,
          data.dataSize || 0,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(characterId, userId) {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(characterId);
      
      const query = isUUID
        ? `DELETE FROM characters WHERE id = $1 AND user_id = $2`
        : `DELETE FROM characters WHERE avatar = $1 AND user_id = $2`;

      const result = await client.query(query, [characterId, userId]);
      
      await client.query('COMMIT');
      
      // 삭제된 행이 없으면 경고
      if (result.rowCount === 0) {
        console.warn(`[PostgreSQL] No character found to delete: ${characterId} for user: ${userId}`);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async exists(characterId, userId) {
    const pool = getPool();
    
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(characterId);
    
    const query = isUUID
      ? `SELECT 1 FROM characters WHERE id = $1 AND user_id = $2 LIMIT 1`
      : `SELECT 1 FROM characters WHERE avatar = $1 AND user_id = $2 LIMIT 1`;

    const result = await pool.query(query, [characterId, userId]);
    return result.rows.length > 0;
  }
}
