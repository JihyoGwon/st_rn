import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ChatMessage } from '@/store/chat-store';

interface ChatMessageProps {
  message: ChatMessage;
}

export const ChatMessageComponent = ({ message }: ChatMessageProps) => {
  const colorScheme = useColorScheme();
  const isUser = message.isUser;
  // Hooks must be called unconditionally - always call useThemeColor
  const botBackgroundColor = useThemeColor({ light: '#F0F0F0', dark: '#2A2A2A' }, 'background');
  const backgroundColor = isUser
    ? Colors[colorScheme ?? 'light'].tint
    : botBackgroundColor;
  const textColor = isUser ? '#fff' : Colors[colorScheme ?? 'light'].text;

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer]}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  botContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
});

