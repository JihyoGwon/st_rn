import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppSettingsStore } from '@/store/app-settings-store';

export default function ProfileScreen() {
  const { settings, setServerUrl, loadFromStorage } = useAppSettingsStore();
  const [serverUrl, setServerUrlLocal] = useState(settings.serverUrl || '');

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    setServerUrlLocal(settings.serverUrl || '');
  }, [settings.serverUrl]);

  const handleSave = () => {
    if (!serverUrl.trim()) {
      Alert.alert('오류', '서버 URL을 입력해주세요.');
      return;
    }

    // 기본 URL 형식 검증
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      Alert.alert('오류', '서버 URL은 http:// 또는 https://로 시작해야 합니다.');
      return;
    }

    setServerUrl(serverUrl.trim());
    Alert.alert('성공', '서버 URL이 저장되었습니다.');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <ThemedView style={styles.section}>
          <ThemedText type="title" style={styles.title}>설정</ThemedText>
          
          <ThemedView style={styles.settingItem}>
            <ThemedText style={styles.label}>서버 URL</ThemedText>
            <ThemedText style={styles.description}>
              PC에서 실행 중인 SillyTavern 서버 주소를 입력하세요.{'\n'}
              예: http://192.168.0.197:8000
            </ThemedText>
            <Input
              style={styles.input}
              placeholder="http://192.168.0.197:8000"
              value={serverUrl}
              onChangeText={setServerUrlLocal}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Button
              title="저장"
              onPress={handleSave}
              style={styles.saveButton}
            />
          </ThemedView>

          <ThemedView style={styles.infoSection}>
            <ThemedText type="subtitle" style={styles.infoTitle}>PC의 IP 주소 확인 방법</ThemedText>
            <ThemedText style={styles.infoText}>
              Windows:{'\n'}
              명령 프롬프트에서 "ipconfig" 실행{'\n'}
              IPv4 주소 확인 (예: 192.168.0.197){'\n\n'}
              Mac/Linux:{'\n'}
              터미널에서 "ifconfig" 또는 "ip addr" 실행
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
  settingItem: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    marginBottom: 12,
  },
  saveButton: {
    marginTop: 8,
  },
  infoSection: {
    marginTop: 32,
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
  },
});

