/**
 * API 관련 상수 정의
 */

/**
 * 기본 서버 설정
 * 주의: 실제 서버 URL은 자동 감지로 설정되므로 여기서는 포트만 정의
 */
export const DEFAULT_SERVER_PORT = 8001;
export const DEFAULT_CHARACTER_PORT = 8000; // 캐릭터 이미지 서빙 포트

/**
 * 타임아웃 설정 (밀리초)
 */
export const TIMEOUTS = {
  CSRF_TOKEN: 5000,        // CSRF 토큰 요청: 5초
  SETTINGS_SYNC: 8000,     // 설정 동기화: 8초
  API_REQUEST: 10000,       // 일반 API 요청: 10초
  CHAT_GENERATION: 60000,   // 채팅 생성: 60초
  SERVER_SCAN: 2000,        // 서버 스캔: 2초
} as const;

/**
 * 설정 동기화 간격 (밀리초)
 */
export const SETTINGS_SYNC_INTERVAL = 5000; // 5초마다 설정 확인

/**
 * 네트워크 관련 상수
 */
export const NETWORK = {
  DISCOVERY_DELAY: 2000,    // 초기 서버 검사 대기 시간: 2초
  STABILIZATION_DELAY: 3000, // 네트워크 안정화 대기 시간: 3초
} as const;
