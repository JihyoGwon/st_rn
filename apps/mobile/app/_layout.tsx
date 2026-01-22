import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNetworkDiscovery } from '@/hooks/use-network-discovery';
import { useAuthStore } from '@/store/auth-store';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  
  // 네트워크 변경 감지 및 서버 자동 감지
  useNetworkDiscovery();

  // 인증 상태 초기화 (앱 시작 시)
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 인증 상태에 따른 라우팅 분기
  useEffect(() => {
    if (isLoading) {
      // 초기화 중이면 아무것도 하지 않음
      return;
    }

    const inAuthGroup = segments[0] === '(tabs)';
    
    if (!isAuthenticated && inAuthGroup) {
      // 로그인 안 되어 있는데 메인 화면에 있으면 로그인 화면으로
      router.replace('/login');
    } else if (isAuthenticated && !inAuthGroup) {
      // 로그인 되어 있는데 로그인 화면에 있으면 메인 화면으로
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
