import { StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppSettingsStore } from '@/store/app-settings-store';
import { DEFAULT_CHARACTER_PORT } from '@/constants/api';
import type { Character } from '@/store/character-store';

interface CharacterCardProps {
  character: Character;
  onPress?: (character: Character) => void;
}

export const CharacterCard = ({ character, onPress }: CharacterCardProps) => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { settings } = useAppSettingsStore();
  const backgroundColor = useThemeColor({ light: '#F5F5F5', dark: '#2A2A2A' }, 'background');
  const borderColor = Colors[colorScheme ?? 'light'].icon;
  const textColor = Colors[colorScheme ?? 'light'].text;

  const handlePress = () => {
    if (onPress) {
      onPress(character);
    } else {
      // 기본 동작: 채팅 화면으로 이동
      router.push('/chat');
    }
  };

  // 아바타 이미지 URL (서버 URL + 캐릭터 파일명)
  // 서버 URL이 없으면 기본 이미지만 표시
  const getAvatarUrl = () => {
    if (!settings.serverUrl) {
      return null; // 기본 이미지 사용
    }
    // 서버 URL에서 포트를 character 포트로 변경
    try {
      const url = new URL(settings.serverUrl);
      url.port = DEFAULT_CHARACTER_PORT.toString();
      return `${url.origin}/characters/${character.avatar}`;
    } catch {
      return null; // URL 파싱 실패 시 기본 이미지 사용
    }
  };

  const avatarUrl = getAvatarUrl();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor,
          borderColor,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={handlePress}
    >
      <Image
        source={avatarUrl ? { uri: avatarUrl } : require('@/assets/images/icon.png')}
        style={styles.avatar}
        defaultSource={require('@/assets/images/icon.png')}
      />
      <ThemedView style={styles.content}>
        <ThemedText style={[styles.name, { color: textColor }]} numberOfLines={1}>
          {character.name || character.data?.name || '이름 없음'}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

