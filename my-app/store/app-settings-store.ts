import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { discoverServer, validateServerUrl } from '@/utils/server-discovery';

/**
 * 서버 설정 타입 (SillyTavern 서버 설정)
 */
export interface ServerSettings {
  chat_completion_source?: string; // 'openai', 'vertexai' 등
  vertexai_auth_mode?: string; // 'express' 또는 'full'
  vertexai_region?: string; // 'us-central1' 등
  vertexai_model?: string; // 모델 이름
  openai_model?: string;
  claude_model?: string;
  google_model?: string;
  temp_openai?: number;
  openai_max_tokens?: number;
  reasoning_effort?: string; // 'auto', 'min', 'low', 'medium', 'high', 'max'
  include_reasoning?: boolean; // 추론 결과 반환 여부
  [key: string]: any; // 기타 설정들
}

/**
 * 앱 설정 타입
 */
export interface AppSettings {
  mode: 'multi' | 'single';
  selectedCharacterId: string | null;
  autoConnect: boolean;
  showCharacterList: boolean;
  defaultChatId: string | null;
  serverUrl: string; // 서버 URL
  serverSettings?: ServerSettings; // 서버 설정 (SillyTavern)
}

/**
 * 앱 설정 스토어 인터페이스
 */
interface AppSettingsStore {
  settings: AppSettings;
  isDiscovering: boolean;
  setMode: (mode: 'multi' | 'single') => void;
  setSelectedCharacterId: (id: string | null) => void;
  setServerUrl: (url: string) => void;
  setServerSettings: (serverSettings: ServerSettings) => void;
  syncFromServer: (serverSettings: Partial<AppSettings>) => void;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
  autoDiscoverServer: () => Promise<string | null>;
  validateCurrentServer: () => Promise<boolean>;
}

/**
 * 기본 설정
 */
const defaultSettings: AppSettings = {
  mode: 'multi',
  selectedCharacterId: null,
  autoConnect: false,
  showCharacterList: true,
  defaultChatId: null,
  serverUrl: 'http://192.168.0.197:8001', // 기본값: PC의 로컬 IP (사용자가 변경 가능)
};

const STORAGE_KEY = '@app_settings';

/**
 * 앱 설정 스토어
 */
export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
  settings: defaultSettings,
  isDiscovering: false,

  setMode: (mode) => {
    set((state) => ({
      settings: { ...state.settings, mode },
    }));
    get().saveToStorage();
  },

  setSelectedCharacterId: (id) => {
    set((state) => ({
      settings: { ...state.settings, selectedCharacterId: id },
    }));
    get().saveToStorage();
  },

  setServerUrl: (url) => {
    set((state) => ({
      settings: { ...state.settings, serverUrl: url },
    }));
    get().saveToStorage();
  },

  /**
   * 서버 설정 설정 (SillyTavern 서버 설정)
   */
  setServerSettings: (serverSettings) => {
    set((state) => ({
      settings: { ...state.settings, serverSettings },
    }));
    get().saveToStorage();
  },

  /**
   * 서버 설정으로 동기화
   */
  syncFromServer: (serverSettings) => {
    const currentSettings = get().settings;
    const newSettings = { ...currentSettings, ...serverSettings };
    
    // 설정이 변경되었는지 확인
    const hasChanged = JSON.stringify(currentSettings) !== JSON.stringify(newSettings);
    
    if (hasChanged) {
      set({ settings: newSettings });
      get().saveToStorage();
    }
  },

  /**
   * 로컬 스토리지에서 로드
   */
  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ settings: { ...defaultSettings, ...parsed } });
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
    }
  },

  /**
   * 로컬 스토리지에 저장
   */
  saveToStorage: async () => {
    try {
      const settings = get().settings;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('설정 저장 실패:', error);
    }
  },

  /**
   * 서버 자동 감지
   */
  autoDiscoverServer: async () => {
    const state = get();
    if (state.isDiscovering) {
      return null; // 이미 감지 중이면 중복 실행 방지
    }

    set({ isDiscovering: true });
    
    try {
      const foundIP = await discoverServer();
      
      if (foundIP) {
        const newUrl = `http://${foundIP}:8001`;
        get().setServerUrl(newUrl);
        console.log(`[AppSettings] 서버 자동 감지 성공: ${newUrl}`);
        return foundIP;
      }
      
      return null;
    } catch (error) {
      console.error('[AppSettings] 서버 자동 감지 실패:', error);
      return null;
    } finally {
      set({ isDiscovering: false });
    }
  },

  /**
   * 현재 서버 URL이 유효한지 확인
   */
  validateCurrentServer: async () => {
    const currentUrl = get().settings.serverUrl;
    if (!currentUrl) {
      return false;
    }

    try {
      const isValid = await validateServerUrl(currentUrl);
      if (!isValid) {
        console.log('[AppSettings] 현재 서버 URL이 유효하지 않음:', currentUrl);
      }
      return isValid;
    } catch (error) {
      console.error('[AppSettings] 서버 URL 검증 실패:', error);
      return false;
    }
  },
}));

