/**
 * API 클라이언트 모듈
 * 서버와의 통신을 담당하며, API 호출 시 설정을 자동으로 확인합니다.
 */

import { useAppSettingsStore } from '@/store/app-settings-store';

/**
 * 서버 URL 가져오기
 */
function getBaseUrl(): string {
  const settings = useAppSettingsStore.getState().settings;
  return settings.serverUrl || 'http://192.168.0.197:8001';
}

/**
 * 타임아웃이 있는 fetch 래퍼
 */
function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 10000 // 10초
): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('요청 시간 초과')), timeout)
    ),
  ]);
}

/**
 * API 응답 타입
 */
interface ApiResponse<T> {
  success?: boolean;
  error?: boolean;
  data?: T;
}

/**
 * API 클라이언트 클래스
 */
class ApiClient {
  private csrfToken: string | null = null;
  private lastSettingsCheck: number = 0;
  private settingsCheckInterval = 5000; // 5초마다 설정 확인

  /**
   * CSRF 토큰 가져오기
   */
  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const baseUrl = getBaseUrl();
      console.log('[API] CSRF 토큰 요청:', `${baseUrl}/csrf-token`);
      const response = await fetchWithTimeout(
        `${baseUrl}/csrf-token`,
        {
          method: 'GET',
          credentials: 'include', // 쿠키 포함
        },
        5000 // 5초 타임아웃
      );
      if (!response.ok) {
        throw new Error(`CSRF 토큰 요청 실패: ${response.status}`);
      }
      const data = await response.json();
      const token = data.token;
      if (!token) {
        throw new Error('CSRF 토큰을 받을 수 없습니다');
      }
      this.csrfToken = token;
      return token;
    } catch (error) {
      const baseUrl = getBaseUrl();
      const errorMessage = error instanceof Error 
        ? error.message 
        : '알 수 없는 오류';
      
      // 더 명확한 에러 메시지
      if (errorMessage.includes('시간 초과') || errorMessage.includes('Network request failed')) {
        throw new Error(`서버에 연결할 수 없습니다. 서버 URL을 확인해주세요: ${baseUrl}`);
      }
      
      console.error('CSRF 토큰 가져오기 실패:', error);
      // 네트워크 에러는 다시 시도할 수 있도록 토큰 초기화
      this.csrfToken = null;
      throw error;
    }
  }

  /**
   * 설정 확인 및 동기화
   */
  async checkAndSyncSettings(): Promise<void> {
    const now = Date.now();
    // 너무 자주 확인하지 않도록 제한
    if (now - this.lastSettingsCheck < this.settingsCheckInterval) {
      return;
    }

    this.lastSettingsCheck = now;

    try {
      const baseUrl = getBaseUrl();
      // CSRF 토큰 가져오기 실패 시 설정 동기화도 건너뛰기
      let token: string;
      try {
        token = await this.getCsrfToken();
      } catch (error) {
        // CSRF 토큰 가져오기 실패 시 설정 동기화도 중단
        return;
      }

      const response = await fetchWithTimeout(
        `${baseUrl}/api/settings/get`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token,
          },
          credentials: 'include',
        },
        8000
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const settings = JSON.parse(data.settings || '{}');
      
      // 앱 설정 동기화
      if (settings.mobile_app) {
        useAppSettingsStore.getState().syncFromServer(settings.mobile_app);
      }
    } catch (error) {
      // 네트워크 에러는 조용히 무시 (앱은 계속 동작)
      // 개발 중에만 콘솔에 출력
      if (__DEV__) {
        console.error('설정 동기화 실패:', error);
      }
    }
  }

  /**
   * API 요청 (설정 확인 포함)
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // API 호출 전 설정 확인 (에러가 나도 계속 진행)
    try {
      await this.checkAndSyncSettings();
    } catch (error) {
      // 설정 동기화 실패해도 API 요청은 계속 진행
    }

    const baseUrl = getBaseUrl();
    const token = await this.getCsrfToken();
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

    try {
      console.log('[API] 요청:', url);
      const response = await fetchWithTimeout(
        url,
        {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token,
            ...options.headers,
          },
          credentials: 'include',
        },
        10000 // API 요청은 10초 타임아웃
      );

      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // 타임아웃이나 네트워크 에러 시 더 명확한 메시지
      if (error instanceof Error) {
        if (error.message.includes('시간 초과') || error.message.includes('Network request failed')) {
          throw new Error(`서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하고, 프로필에서 서버 URL을 확인해주세요. (${baseUrl})`);
        }
        throw error;
      }
      throw new Error('알 수 없는 오류가 발생했습니다');
    }
  }

  /**
   * GET 요청
   */
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST 요청
   */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient();

