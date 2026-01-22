/**
 * FileSystem User Repository 구현
 * 기존 node-persist 방식 사용
 */

import storage from 'node-persist';
import { KEY_PREFIX, toKey } from '../../users.js';

export class FileSystemUserRepository {
  async getAll() {
    const keys = await storage.keys();
    const userKeys = keys.filter(key => key.startsWith(KEY_PREFIX));
    
    const users = [];
    for (const key of userKeys) {
      const user = await storage.getItem(key);
      if (user) {
        users.push({
          handle: user.handle,
          name: user.name,
          passwordHash: user.password || '',
          salt: user.salt || '',
          enabled: user.enabled !== false,
          admin: user.admin === true,
          created: user.created,
          createdAt: user.created ? new Date(user.created).toISOString() : undefined,
          updatedAt: undefined, // 파일시스템에는 updated_at 없음
        });
      }
    }
    
    return users;
  }

  async get(handle) {
    const user = await storage.getItem(toKey(handle));
    
    if (!user) {
      return null;
    }
    
    return {
      handle: user.handle,
      name: user.name,
      passwordHash: user.password || '',
      salt: user.salt || '',
      enabled: user.enabled !== false,
      admin: user.admin === true,
      created: user.created,
      createdAt: user.created ? new Date(user.created).toISOString() : undefined,
      updatedAt: undefined,
    };
  }

  async save(handle, data) {
    // 파일시스템 저장은 기존 방식 유지 (node-persist)
    // 여기서는 변환만 수행
    const user = {
      handle: data.handle || handle,
      name: data.name,
      password: data.passwordHash || '',
      salt: data.salt || '',
      enabled: data.enabled !== false,
      admin: data.admin === true,
      created: data.created || (data.createdAt ? new Date(data.createdAt).getTime() : Date.now()),
    };
    
    await storage.setItem(toKey(handle), user);
  }

  async delete(handle) {
    await storage.removeItem(toKey(handle));
  }

  async exists(handle) {
    const user = await storage.getItem(toKey(handle));
    return user !== null && user !== undefined;
  }
}
