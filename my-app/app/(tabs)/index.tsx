import { useEffect } from 'react';
import { StyleSheet, ActivityIndicator, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CharacterCard } from '@/components/character-card';
import { Button } from '@/components/ui/button';
import { useCharacterStore } from '@/store/character-store';
import { useAppSettingsStore } from '@/store/app-settings-store';

export default function HomeScreen() {
  const router = useRouter();
  const { characters, isLoading, error, loadCharacters, selectCharacter } = useCharacterStore();
  const { settings, loadFromStorage } = useAppSettingsStore();

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

  const handleCharacterPress = (character: typeof characters[0]) => {
    selectCharacter(character);
    router.push('/chat');
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
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>캐릭터를 불러오는 중...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText type="title" style={styles.errorText}>연결 오류</ThemedText>
        <ThemedText style={styles.errorMessage}>{error}</ThemedText>
        <Button
          title="서버 설정으로 이동"
          onPress={() => router.push('/profile')}
          style={styles.settingsButton}
        />
        <Button
          title="다시 시도"
          onPress={handleRefresh}
          style={styles.retryButton}
        />
      </ThemedView>
    );
  }

  if (displayCharacters.length === 0) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText type="title">캐릭터가 없습니다</ThemedText>
        <ThemedText style={styles.emptyText}>
          {settings.mode === 'single' 
            ? '기본 캐릭터가 설정되지 않았습니다'
            : '웹에서 캐릭터를 추가해주세요'}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
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
  );
}

const styles = StyleSheet.create({
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
  settingsButton: {
    marginTop: 20,
    minWidth: 200,
  },
  retryButton: {
    marginTop: 12,
    minWidth: 200,
  },
});
