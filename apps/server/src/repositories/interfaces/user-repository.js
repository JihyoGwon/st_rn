/**
 * User Repository 인터페이스 (JSDoc으로 타입 정의)
 * 데이터 저장소(파일시스템 또는 PostgreSQL)에 접근하는 방법을 추상화
 */

/**
 * @typedef {Object} UserData
 * @property {string} handle - 사용자 핸들 (고유 식별자)
 * @property {string} name - 표시 이름
 * @property {string} passwordHash - 비밀번호 해시 (scrypt)
 * @property {string} salt - 비밀번호 해싱용 salt
 * @property {boolean} enabled - 활성화 여부
 * @property {boolean} admin - 어드민 여부
 * @property {number} [created] - 생성 시간 (밀리초 timestamp)
 * @property {string} [createdAt] - 생성 시간 (ISO 문자열)
 * @property {string} [updatedAt] - 수정 시간 (ISO 문자열)
 */

/**
 * User Repository 인터페이스
 * @interface
 */
export class UserRepository {
  /**
   * 모든 사용자 목록 조회
   * @returns {Promise<UserData[]>}
   */
  async getAll() {
    throw new Error('Not implemented');
  }

  /**
   * 특정 사용자 조회
   * @param {string} handle 사용자 핸들
   * @returns {Promise<UserData|null>}
   */
  async get(handle) {
    throw new Error('Not implemented');
  }

  /**
   * 사용자 저장 (생성 또는 업데이트)
   * @param {string} handle 사용자 핸들
   * @param {UserData} data 사용자 데이터
   * @returns {Promise<void>}
   */
  async save(handle, data) {
    throw new Error('Not implemented');
  }

  /**
   * 사용자 삭제
   * @param {string} handle 사용자 핸들
   * @returns {Promise<void>}
   */
  async delete(handle) {
    throw new Error('Not implemented');
  }

  /**
   * 사용자 존재 여부 확인
   * @param {string} handle 사용자 핸들
   * @returns {Promise<boolean>}
   */
  async exists(handle) {
    throw new Error('Not implemented');
  }
}
