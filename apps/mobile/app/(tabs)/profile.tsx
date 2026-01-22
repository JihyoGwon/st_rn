import { useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useAppSettingsStore } from '@/store/app-settings-store';
import { useAuthStore } from '@/store/auth-store';
import { logout as logoutApi } from '@/lib/api/client';

export default function ProfileScreen() {
  const router = useRouter();
  const { settings } = useAppSettingsStore();
  const { logout } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              // 서버에 로그아웃 요청
              await logoutApi();
              // 클라이언트 상태 초기화
              await logout();
              // 로그인 화면으로 이동
              router.replace('/login');
            } catch (error) {
              console.error('[Profile] 로그아웃 실패:', error);
              // 에러가 나도 클라이언트 상태는 초기화
              await logout();
              router.replace('/login');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ThemedView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="title" style={styles.title}>설정</ThemedText>
            
            <ThemedView style={styles.infoSection}>
              <ThemedText type="subtitle" style={styles.infoTitle}>서버 연결</ThemedText>
              <ThemedText style={styles.infoText}>
                {settings.serverUrl 
                  ? `연결됨: ${settings.serverUrl}`
                  : '서버를 찾는 중...'}
              </ThemedText>
              <ThemedText style={styles.description}>
                {'\n'}서버는 앱 실행 시 자동으로 감지됩니다.{'\n'}
                같은 Wi-Fi 네트워크에 연결되어 있어야 합니다.
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.logoutSection}>
              <Button
                title={isLoggingOut ? '로그아웃 중...' : '로그아웃'}
                onPress={handleLogout}
                disabled={isLoggingOut}
                style={styles.logoutButton}
              />
            </ThemedView>
          </ThemedView>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  title: {
    marginBottom: 24,
  },
  infoSection: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  infoTitle: {
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
  logoutSection: {
    marginTop: 32,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
});

