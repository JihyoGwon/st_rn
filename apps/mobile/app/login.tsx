import { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppSettingsStore } from '@/store/app-settings-store';
import { useAuthStore } from '@/store/auth-store';
import { loginWithCredentials } from '@/lib/api/client';

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { settings } = useAppSettingsStore();
  const { login } = useAuthStore();
  
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#000000' }, 'background');
  const textColor = Colors[colorScheme ?? 'light'].text;
  const borderColor = Colors[colorScheme ?? 'light'].icon;

  const handleLogin = async () => {
    // 입력 검증
    if (!handle.trim()) {
      setError('사용자 핸들을 입력해주세요');
      return;
    }

    if (!settings.serverUrl) {
      setError('서버 URL이 설정되지 않았습니다');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 로그인 API 호출
      const userInfo = await loginWithCredentials(handle.trim(), password);
      
      // 인증 스토어에 저장
      await login(userInfo);
      
      // 성공 시 메인 화면으로 이동
      router.replace('/(tabs)');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '로그인에 실패했습니다';
      setError(errorMessage);
      console.error('[Login] 로그인 실패:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedView style={styles.content}>
            {/* 헤더 */}
            <ThemedView style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                로그인
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: textColor, opacity: 0.6 }]}>
                SillyTavern 서버에 로그인하세요
              </ThemedText>
            </ThemedView>

            {/* 서버 정보 */}
            {settings.serverUrl && (
              <ThemedView style={[styles.serverInfo, { borderColor }]}>
                <ThemedText style={[styles.serverLabel, { color: textColor, opacity: 0.6 }]}>
                  서버
                </ThemedText>
                <ThemedText style={[styles.serverUrl, { color: textColor }]} numberOfLines={1}>
                  {settings.serverUrl}
                </ThemedText>
              </ThemedView>
            )}

            {/* 입력 폼 */}
            <ThemedView style={styles.form}>
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>
                  사용자 핸들
                </ThemedText>
                <Input
                  value={handle}
                  onChangeText={(text) => {
                    setHandle(text);
                    setError(null);
                  }}
                  placeholder="사용자 핸들을 입력하세요"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>
                  비밀번호
                </ThemedText>
                <Input
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  placeholder="비밀번호를 입력하세요"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  onSubmitEditing={handleLogin}
                />
              </View>

              {/* 에러 메시지 */}
              {error && (
                <ThemedView style={styles.errorContainer}>
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                </ThemedView>
              )}

              {/* 로그인 버튼 */}
              <Button
                title={isLoading ? '로그인 중...' : '로그인'}
                onPress={handleLogin}
                disabled={isLoading}
                style={styles.loginButton}
              />

              {/* 테스트 사용자 안내 */}
              <ThemedView style={styles.testInfo}>
                <ThemedText style={[styles.testLabel, { color: textColor, opacity: 0.6 }]}>
                  테스트 계정
                </ThemedText>
                <ThemedText style={[styles.testText, { color: textColor, opacity: 0.8 }]}>
                  핸들: test-user-1{'\n'}
                  비밀번호: test1234
                </ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  serverInfo: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
  },
  serverLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  serverUrl: {
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: 8,
  },
  testInfo: {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  testLabel: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  testText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
