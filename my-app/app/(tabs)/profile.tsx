import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppSettingsStore } from '@/store/app-settings-store';

export default function ProfileScreen() {
  const { settings } = useAppSettingsStore();

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
});

