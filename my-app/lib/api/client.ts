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
   * 설정 동기화 (공개 메서드 - 외부에서 호출 가능)
   */
  async syncSettings(): Promise<void> {
    // 마지막 확인 시간 초기화하여 강제로 동기화
    this.lastSettingsCheck = 0;
    await this.checkAndSyncSettings();
  }

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
      
      // oai_settings에서 채팅 완성 관련 설정 가져오기
      const oaiSettings = settings.oai_settings || {};
      
      // 디버깅: oai_settings 확인
      if (__DEV__) {
        console.log('[API] oai_settings 키들:', Object.keys(oaiSettings).slice(0, 30));
        console.log('[API] oai_settings에서 찾은 설정:', {
          chat_completion_source: oaiSettings.chat_completion_source,
          vertexai_auth_mode: oaiSettings.vertexai_auth_mode,
          vertexai_model: oaiSettings.vertexai_model,
          vertexai_region: oaiSettings.vertexai_region,
        });
      }
      
      // 앱 설정 동기화
      if (settings.mobile_app) {
        useAppSettingsStore.getState().syncFromServer(settings.mobile_app);
      }
      
      // 서버 설정 저장 (채팅 생성에 사용) - oai_settings 포함
      // oai_settings의 설정들을 최상위 레벨로 병합하여 저장
      const serverSettings = {
        ...settings,
        ...oaiSettings, // oai_settings의 설정들을 최상위로 병합
      };
      
      useAppSettingsStore.getState().setServerSettings(serverSettings);
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

  /**
   * 채팅 히스토리 가져오기
   */
  async getChatHistory(avatarUrl: string, fileName: string): Promise<any[]> {
    return this.post<any[]>('/api/chats/get', {
      avatar_url: avatarUrl,
      file_name: fileName,
    });
  }

  /**
   * 채팅 저장
   */
  async saveChat(
    avatarUrl: string,
    fileName: string,
    chat: any[],
    chatMetadata?: any
  ): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>('/api/chats/save', {
      avatar_url: avatarUrl,
      file_name: fileName,
      chat: chat,
      chat_metadata: chatMetadata,
    });
  }

  /**
   * 채팅 리셋 (채팅 내용 비우기)
   */
  async resetChat(
    avatarUrl: string,
    chatfile: string = 'chat'
  ): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>('/api/chats/reset', {
      avatar_url: avatarUrl,
      chatfile: chatfile,
    });
  }

  /**
   * 메시지 준비 (채팅 전송 전)
   */
  async prepareMessages(params: {
    chat_id?: string;
    character_id: string;
    user_message: string;
    type?: string;
    regenerate?: boolean;
    swipe_index?: number;
  }): Promise<any> {
    return this.post('/api/chats/prepare-messages', params);
  }

  /**
   * 채팅 생성 (스트리밍 또는 비스트리밍)
   */
  async generateChatCompletion(params: {
    messages: any[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    chat_completion_source?: string;
  }): Promise<any> {
    const baseUrl = getBaseUrl();
    const token = await this.getCsrfToken();
    const url = `${baseUrl}/api/backends/chat-completions/generate`;

    // 기본값 설정
    const requestParams = {
      stream: false,
      chat_completion_source: 'openai',
      ...params,
    };

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        credentials: 'include',
        body: JSON.stringify(requestParams),
      },
      60000 // 생성은 60초 타임아웃
    );

    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = errorData.error?.message || JSON.stringify(errorData);
      } catch {
        errorText = await response.text();
      }
      
      // API 키가 없는 경우 더 명확한 메시지
      if (response.status === 400 && errorText.includes('key') || errorText.includes('Key')) {
        throw new Error('API 키가 설정되지 않았습니다. SillyTavern 웹에서 API 키를 설정해주세요.');
      }
      
      throw new Error(`채팅 생성 실패: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // 스트리밍이 아닌 경우 JSON 파싱
    if (!requestParams.stream) {
      return response.json();
    }

    // 스트리밍인 경우 Response 반환 (나중에 구현)
    return response;
  }
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient();

