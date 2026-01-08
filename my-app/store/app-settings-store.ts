import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

/**
 * 앱 설정 스토어 인터페이스
 */
interface AppSettingsStore {
  settings: AppSettings;
  setMode: (mode: 'multi' | 'single') => void;
  setSelectedCharacterId: (id: string | null) => void;
  setServerUrl: (url: string) => void;
  syncFromServer: (serverSettings: Partial<AppSettings>) => void;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
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
}));

