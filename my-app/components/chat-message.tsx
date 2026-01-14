import { StyleSheet, View, Image } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatChatTime } from '@/utils/date-format';
import { useCharacterStore } from '@/store/character-store';
import { useAppSettingsStore } from '@/store/app-settings-store';
import type { ChatMessage } from '@/store/chat-store';

interface ChatMessageProps {
  message: ChatMessage;
}

export const ChatMessageComponent = ({ message }: ChatMessageProps) => {
  const colorScheme = useColorScheme();
  const isUser = message.isUser;
  const { selectedCharacter } = useCharacterStore();
  const { settings } = useAppSettingsStore();
  // Hooks must be called unconditionally - always call useThemeColor
  const botBackgroundColor = useThemeColor({ light: '#F0F0F0', dark: '#2A2A2A' }, 'background');
  const backgroundColor = isUser
    ? Colors[colorScheme ?? 'light'].tint
    : botBackgroundColor;
  const textColor = isUser ? '#fff' : Colors[colorScheme ?? 'light'].text;

  // 봇 메시지의 경우 아바타 URL 생성 (웹과 동일한 thumbnail 엔드포인트 사용)
  const getAvatarUrl = () => {
    if (isUser || !selectedCharacter || !settings.serverUrl || !selectedCharacter.avatar || selectedCharacter.avatar === 'none') {
      return null;
    }
    try {
      const url = new URL(settings.serverUrl);
      return `${url.origin}/thumbnail?type=avatar&file=${encodeURIComponent(selectedCharacter.avatar)}`;
    } catch {
      return null;
    }
  };

  const avatarUrl = getAvatarUrl();

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer]}>
      {!isUser && (
        <View style={styles.avatarContainer}>
          <Image
            source={avatarUrl ? { uri: avatarUrl } : require('@/assets/images/icon.png')}
            style={styles.avatar}
            defaultSource={require('@/assets/images/icon.png')}
            resizeMode="cover"
            onError={() => {
              // 이미지 로드 실패 시 기본 이미지로 대체됨 (조용히 처리)
            }}
          />
        </View>
      )}
      <View style={[styles.messageWrapper, isUser && styles.userMessageWrapper]}>
        <ThemedView
          style={[
            styles.messageBubble,
            {
              backgroundColor,
            },
          ]}
        >
          <ThemedText style={[styles.messageText, { color: textColor }]}>{message.text}</ThemedText>
        </ThemedView>
        <ThemedText style={[styles.timestamp, isUser ? styles.userTimestamp : styles.botTimestamp]}>
          {formatChatTime(message.timestamp)}
        </ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  botContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    marginRight: 8,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
  },
  messageWrapper: {
    maxWidth: '80%',
    flexShrink: 1,
  },
  userMessageWrapper: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.6,
  },
  userTimestamp: {
    textAlign: 'right',
  },
  botTimestamp: {
    textAlign: 'left',
  },
});

