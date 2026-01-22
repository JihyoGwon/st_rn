/**
 * 인증 상태 관리 스토어
 * 로그인 방식과 무관하게 인증 상태를 관리
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserInfo {
  handle: string;
  name: string;
  admin: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  isLoading: boolean;
  
  // 로그인 (로그인 방식과 무관)
  login: (userInfo: UserInfo) => Promise<void>;
  
  // 로그아웃
  logout: () => Promise<void>;
  
  // 인증 상태 초기화 (앱 시작 시)
  initialize: () => Promise<void>;
  
  // 인증 상태 확인
  checkAuth: () => Promise<boolean>;
}

const AUTH_STORAGE_KEY = '@auth:user';
const AUTH_STATE_KEY = '@auth:isAuthenticated';

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  isLoading: true,

  /**
   * 로그인 (로그인 방식과 무관하게 사용자 정보만 저장)
   */
  login: async (userInfo: UserInfo) => {
    try {
      // AsyncStorage에 저장
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userInfo));
      await AsyncStorage.setItem(AUTH_STATE_KEY, 'true');
      
      // 상태 업데이트
      set({
        isAuthenticated: true,
        user: userInfo,
        isLoading: false,
      });
      
      console.log('[Auth] 로그인 성공:', userInfo.handle);
    } catch (error) {
      console.error('[Auth] 로그인 상태 저장 실패:', error);
      throw error;
    }
  },

  /**
   * 로그아웃
   */
  logout: async () => {
    try {
      // AsyncStorage에서 삭제
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem(AUTH_STATE_KEY);
      
      // 상태 초기화
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
      
      console.log('[Auth] 로그아웃 완료');
    } catch (error) {
      console.error('[Auth] 로그아웃 실패:', error);
      throw error;
    }
  },

  /**
   * 인증 상태 초기화 (앱 시작 시 호출)
   * 서버 세션도 확인하여 유효한 세션이 없으면 로그아웃 처리
   */
  initialize: async () => {
    try {
      const [userData, authState] = await Promise.all([
        AsyncStorage.getItem(AUTH_STORAGE_KEY),
        AsyncStorage.getItem(AUTH_STATE_KEY),
      ]);

      if (userData && authState === 'true') {
        const user = JSON.parse(userData) as UserInfo;
        
        // 서버 세션 확인
        try {
          const { getCurrentUser } = await import('@/lib/api/client');
          const currentUser = await getCurrentUser();
          
          if (currentUser && currentUser.handle === user.handle) {
            // 서버 세션이 유효함
            set({
              isAuthenticated: true,
              user,
              isLoading: false,
            });
            console.log('[Auth] 저장된 인증 상태 복원:', user.handle);
          } else {
            // 서버 세션이 없거나 다른 사용자임
            console.log('[Auth] 서버 세션이 없거나 만료됨, 로그아웃 처리');
            await get().logout();
          }
        } catch (error) {
          // 서버 세션 확인 실패 (네트워크 오류 등)
          console.warn('[Auth] 서버 세션 확인 실패, 로컬 상태 유지:', error);
          // 네트워크 오류인 경우 로컬 상태는 유지하되, 실제 API 호출 시 다시 확인됨
          set({
            isAuthenticated: true,
            user,
            isLoading: false,
          });
          console.log('[Auth] 저장된 인증 상태 복원 (서버 확인 실패):', user.handle);
        }
      } else {
        set({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
        console.log('[Auth] 저장된 인증 상태 없음');
      }
    } catch (error) {
      console.error('[Auth] 인증 상태 초기화 실패:', error);
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
    }
  },

  /**
   * 인증 상태 확인 (서버에 실제로 로그인되어 있는지 확인)
   * 나중에 소셜 로그인으로 바꿔도 이 함수만 수정하면 됨
   */
  checkAuth: async () => {
    try {
      // TODO: 서버에 인증 상태 확인 API 호출
      // 현재는 AsyncStorage만 확인
      const authState = await AsyncStorage.getItem(AUTH_STATE_KEY);
      return authState === 'true';
    } catch (error) {
      console.error('[Auth] 인증 상태 확인 실패:', error);
      return false;
    }
  },
}));
