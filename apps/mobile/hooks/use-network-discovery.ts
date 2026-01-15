import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAppSettingsStore } from '@/store/app-settings-store';

/**
 * 네트워크 변경 감지 및 서버 자동 감지 훅
 */
export function useNetworkDiscovery() {
  const { autoDiscoverServer, validateCurrentServer, settings } = useAppSettingsStore();
  const lastNetworkType = useRef<string | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // 초기 서버 유효성 검사
    const checkInitialServer = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        const isValid = await validateCurrentServer();
        if (!isValid) {
          console.log('[NetworkDiscovery] 현재 서버가 유효하지 않음. 자동 감지 시작...');
          await autoDiscoverServer();
        }
      } catch (error) {
        console.error('[NetworkDiscovery] 초기 서버 검사 실패:', error);
      } finally {
        isCheckingRef.current = false;
      }
    };

    // 앱 시작 시 한 번만 실행
    const timeoutId = setTimeout(checkInitialServer, 2000); // 2초 후 실행 (앱 초기화 대기)

    // 네트워크 상태 변경 감지
    const unsubscribe = NetInfo.addEventListener(state => {
      const currentType = state.type;
      const wasConnected = lastNetworkType.current !== null;
      const isNowConnected = state.isConnected === true;

      // 네트워크가 연결되었고, 이전과 다른 타입이면 서버 재감지
      if (isNowConnected && (lastNetworkType.current !== currentType || !wasConnected)) {
        console.log(`[NetworkDiscovery] 네트워크 변경 감지: ${lastNetworkType.current} -> ${currentType}`);
        
        // 네트워크 변경 후 잠시 대기 (IP 할당 대기)
        setTimeout(async () => {
          if (isCheckingRef.current) return;
          isCheckingRef.current = true;

          try {
            const isValid = await validateCurrentServer();
            if (!isValid) {
              console.log('[NetworkDiscovery] 네트워크 변경 후 서버 자동 감지 시작...');
              await autoDiscoverServer();
            }
          } catch (error) {
            console.error('[NetworkDiscovery] 네트워크 변경 후 서버 감지 실패:', error);
          } finally {
            isCheckingRef.current = false;
          }
        }, 3000); // 3초 대기 (네트워크 안정화 대기)
      }

      lastNetworkType.current = currentType;
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [autoDiscoverServer, validateCurrentServer]);
}

