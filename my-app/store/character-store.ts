import { create } from 'zustand';
import { apiClient } from '@/lib/api/client';
import { useAppSettingsStore } from './app-settings-store';

/**
 * 캐릭터 타입 (서버 응답 기반)
 */
export interface Character {
  name: string;
  avatar: string;
  chat: number;
  fav: boolean;
  date_added: number;
  create_date: string;
  date_last_chat: number;
  chat_size: number;
  data_size: number;
  tags: string[];
  data: {
    name: string;
    character_version?: string;
    creator?: string;
    creator_notes?: string;
    tags?: string[];
  };
}

/**
 * 캐릭터 스토어 인터페이스
 */
interface CharacterStore {
  characters: Character[];
  selectedCharacter: Character | null;
  isLoading: boolean;
  error: string | null;
  
  // 액션들
  loadCharacters: () => Promise<void>;
  selectCharacter: (character: Character) => void;
  selectCharacterById: (avatar: string) => Promise<void>;
  clearSelection: () => void;
}

/**
 * 캐릭터 스토어
 */
export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters: [],
  selectedCharacter: null,
  isLoading: false,
  error: null,

  /**
   * 캐릭터 목록 로드
   */
  loadCharacters: async () => {
    set({ isLoading: true, error: null });
    
    try {
      console.log('[CharacterStore] 캐릭터 로드 시작');
      // API 호출 (자동으로 설정 확인됨)
      const characters = await apiClient.post<Character[]>('/api/characters/all');
      console.log('[CharacterStore] 캐릭터 로드 성공:', characters?.length || 0, '개');
      
      // 서버 설정 확인 (API 호출 시 자동으로 확인되지만, 명시적으로도 확인)
      const appSettings = useAppSettingsStore.getState();
      await appSettings.loadFromStorage();
      
      set({ 
        characters: characters || [],
        isLoading: false 
      });
    } catch (error) {
      console.error('[CharacterStore] 캐릭터 로드 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '캐릭터를 불러올 수 없습니다';
      console.error('[CharacterStore] 에러 메시지:', errorMessage);
      set({ 
        error: errorMessage,
        isLoading: false 
      });
    }
  },

  /**
   * 캐릭터 선택
   */
  selectCharacter: (character) => {
    set({ selectedCharacter: character });
    
    // 앱 설정에 선택된 캐릭터 저장
    useAppSettingsStore.getState().setSelectedCharacterId(character.avatar);
  },

  /**
   * 캐릭터 ID로 선택
   */
  selectCharacterById: async (avatar) => {
    const { characters } = get();
    const character = characters.find((c) => c.avatar === avatar);
    
    if (character) {
      get().selectCharacter(character);
    } else {
      // 캐릭터 목록에 없으면 다시 로드 시도
      await get().loadCharacters();
      const updatedCharacters = get().characters;
      const foundCharacter = updatedCharacters.find((c) => c.avatar === avatar);
      
      if (foundCharacter) {
        get().selectCharacter(foundCharacter);
      } else {
        throw new Error('캐릭터를 찾을 수 없습니다');
      }
    }
  },

  /**
   * 선택 해제
   */
  clearSelection: () => {
    set({ selectedCharacter: null });
    useAppSettingsStore.getState().setSelectedCharacterId(null);
  },
}));

