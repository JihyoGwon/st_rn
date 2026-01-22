/**
 * Repository Factory
 * 설정에 따라 적절한 Repository 구현체를 반환
 */

import { FileSystemCharacterRepository } from './file-system/character-repository.js';
import { PostgreSQLCharacterRepository } from './postgresql/character-repository.js';
import { HybridCharacterRepository } from './hybrid/character-repository.js';
import { getConfigValue } from '../util.js';

// 싱글톤 인스턴스
let characterRepository = null;

/**
 * 저장소 타입 가져오기
 * @returns {'file'|'postgresql'}
 */
function getStorageType() {
  const storageType = getConfigValue('storage.type', 'file', 'string');
  return storageType === 'postgresql' ? 'postgresql' : 'file';
}

/**
 * Character Repository 가져오기
 * @returns {FileSystemCharacterRepository|PostgreSQLCharacterRepository}
 */
export function getCharacterRepository() {
  if (characterRepository) {
    return characterRepository;
  }

  const storageType = getStorageType();

  switch (storageType) {
    case 'postgresql':
      console.log('[Repository] Using Hybrid mode (PostgreSQL + FileSystem auto-migration) for characters');
      characterRepository = new HybridCharacterRepository();
      break;
    case 'file':
    default:
      console.log('[Repository] Using FileSystem for characters');
      characterRepository = new FileSystemCharacterRepository();
      break;
  }

  return characterRepository;
}

/**
 * Repository 초기화 (테스트용)
 */
export function resetRepositories() {
  characterRepository = null;
}
