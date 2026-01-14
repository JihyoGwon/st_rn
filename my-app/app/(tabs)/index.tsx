import { useEffect } from 'react';
import { StyleSheet, ActivityIndicator, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CharacterCard } from '@/components/character-card';
import { Button } from '@/components/ui/button';
import { useCharacterStore } from '@/store/character-store';
import { useAppSettingsStore } from '@/store/app-settings-store';
import { useChatStore } from '@/store/chat-store';

export default function HomeScreen() {
  const router = useRouter();
  const { characters, isLoading, error, loadCharacters, selectCharacter } = useCharacterStore();
  const { settings, loadFromStorage } = useAppSettingsStore();
  const { getMostRecentChatId, loadChatHistory } = useChatStore();

  // 앱 시작 시 설정 로드 및 캐릭터 목록 로드
  useEffect(() => {
    const initialize = async () => {
      // 설정 먼저 로드
      await loadFromStorage();
      
      // 캐릭터 목록 로드
      await loadCharacters();
    };
    
    initialize();
  }, []);

  const handleCharacterPress = async (character: typeof characters[0]) => {
    selectCharacter(character);
    
    // 가장 최근 채팅 찾기
    try {
      const mostRecentChatId = await getMostRecentChatId(character.avatar);
      
      // 채팅 히스토리 로드 (가장 최근 채팅 또는 기본 'chat')
      await loadChatHistory(character.avatar, mostRecentChatId || 'chat');
      
      // 채팅 화면으로 이동
      router.push('/chat');
    } catch (error) {
      console.error('최근 채팅 로드 실패:', error);
      // 에러가 발생해도 채팅 화면으로 이동 (기본 채팅 사용)
    router.push('/chat');
    }
  };

  const handleRefresh = async () => {
    await loadCharacters();
  };

  // Single 모드일 때는 기본 캐릭터만 필터링
  const displayCharacters = settings.mode === 'single' && settings.selectedCharacterId
    ? characters.filter((char) => char.avatar === settings.selectedCharacterId)
    : characters;

  if (isLoading && characters.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>캐릭터를 불러오는 중...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={styles.centerContainer}>
          <ThemedText type="title" style={styles.errorText}>서버를 찾을 수 없습니다</ThemedText>
          <ThemedText style={styles.errorMessage}>{error}</ThemedText>
          <ThemedView style={styles.helpSection}>
            <ThemedText style={styles.helpTitle}>해결 방법:</ThemedText>
            <ThemedText style={styles.helpText}>
              1. PC에서 SillyTavern 서버가 실행 중인지 확인{'\n'}
              2. 같은 Wi-Fi 네트워크에 연결되어 있는지 확인{'\n'}
              3. 방화벽이 서버 접근을 차단하지 않는지 확인
            </ThemedText>
          </ThemedView>
          <Button
            title="다시 시도"
            onPress={handleRefresh}
            style={styles.retryButton}
          />
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (displayCharacters.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={styles.centerContainer}>
          <ThemedText type="title">캐릭터가 없습니다</ThemedText>
          <ThemedText style={styles.emptyText}>
            {settings.mode === 'single' 
              ? '기본 캐릭터가 설정되지 않았습니다'
              : '웹에서 캐릭터를 추가해주세요'}
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">캐릭터 선택</ThemedText>
        <ThemedText style={styles.subtitle}>
          {settings.mode === 'single' 
            ? '기본 캐릭터'
            : '대화할 캐릭터를 선택하세요'}
        </ThemedText>
      </ThemedView>

      <FlashList
        data={displayCharacters}
        renderItem={({ item }) => (
          <CharacterCard character={item} onPress={handleCharacterPress} />
        )}
        keyExtractor={(item) => item.avatar}
        numColumns={2}
        estimatedItemSize={140}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
      />
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.6,
  },
  listContent: {
    padding: 12,
  },
  row: {
    justifyContent: 'space-between',
    gap: 12,
  },
  loadingText: {
    marginTop: 12,
  },
  errorText: {
    marginBottom: 8,
  },
  errorMessage: {
    textAlign: 'center',
    opacity: 0.7,
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.6,
  },
  retryButton: {
    marginTop: 20,
    minWidth: 200,
  },
  helpSection: {
    marginTop: 24,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    maxWidth: '90%',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
});
