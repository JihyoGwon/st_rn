/**
 * Character Repository 인터페이스 (JSDoc으로 타입 정의)
 * 데이터 저장소(파일시스템 또는 PostgreSQL)에 접근하는 방법을 추상화
 */

/**
 * @typedef {Object} CharacterData
 * @property {string} [id] - 캐릭터 ID (UUID 또는 파일명)
 * @property {string} userId - 사용자 ID
 * @property {string} characterName - 캐릭터 이름
 * @property {Object} characterData - Character card JSON (spec v2)
 * @property {string} avatar - 파일명 (예: "character.png")
 * @property {string} [jsonData] - 원본 JSON 문자열
 * @property {number} [dateAdded] - 파일 생성 시간 (밀리초)
 * @property {string} [createDate] - 생성 날짜 (ISO 문자열)
 * @property {number} [chatSize] - 채팅 개수
 * @property {number} [dateLastChat] - 마지막 채팅 시간 (밀리초)
 * @property {number} [dataSize] - 데이터 크기 (바이트)
 */

/**
 * Character Repository 인터페이스
 * @interface
 */
export class CharacterRepository {
  /**
   * 사용자의 모든 캐릭터 목록 조회
   * @param {string} userId 사용자 ID
   * @param {boolean} [shallow=false] 메타데이터만 반환할지 여부
   * @returns {Promise<CharacterData[]>}
   */
  async getAll(userId, shallow = false) {
    throw new Error('Not implemented');
  }

  /**
   * 특정 캐릭터 조회
   * @param {string} characterId 캐릭터 ID (파일명 또는 DB ID)
   * @param {string} userId 사용자 ID
   * @returns {Promise<CharacterData|null>}
   */
  async get(characterId, userId) {
    throw new Error('Not implemented');
  }

  /**
   * 캐릭터 저장
   * @param {string} characterId 캐릭터 ID
   * @param {string} userId 사용자 ID
   * @param {CharacterData} data 캐릭터 데이터
   * @returns {Promise<void>}
   */
  async save(characterId, userId, data) {
    throw new Error('Not implemented');
  }

  /**
   * 캐릭터 삭제
   * @param {string} characterId 캐릭터 ID
   * @param {string} userId 사용자 ID
   * @returns {Promise<void>}
   */
  async delete(characterId, userId) {
    throw new Error('Not implemented');
  }

  /**
   * 캐릭터 존재 여부 확인
   * @param {string} characterId 캐릭터 ID
   * @param {string} userId 사용자 ID
   * @returns {Promise<boolean>}
   */
  async exists(characterId, userId) {
    throw new Error('Not implemented');
  }
}
