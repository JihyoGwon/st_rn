import { useState, useRef, useEffect } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChatMessageComponent } from '@/components/chat-message';
import { useChatStore } from '@/store/chat-store';
import { useCharacterStore } from '@/store/character-store';
import { useAppSettingsStore } from '@/store/app-settings-store';

export default function ChatScreen() {
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const { messages, addMessage } = useChatStore();
  const { selectedCharacter } = useCharacterStore();
  const { settings, loadFromStorage } = useAppSettingsStore();
  const flashListRef = useRef<FlashList<any>>(null);

  // 화면 진입 시 설정 확인
  useEffect(() => {
    loadFromStorage();
    
    // 캐릭터가 선택되지 않았으면 홈으로 리다이렉트
    if (!selectedCharacter && settings.mode === 'multi') {
      router.replace('/');
    }
  }, []);

  // 새 메시지가 추가되면 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flashListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = () => {
    if (inputText.trim() === '') {
      return;
    }

    // 사용자 메시지 추가
    addMessage(inputText.trim(), true);

    // 입력창 초기화
    setInputText('');

    // 간단한 봇 응답 (나중에 실제 API로 교체 가능)
    setTimeout(() => {
      addMessage('안녕하세요! 무엇을 도와드릴까요?', false);
    }, 500);
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* 메시지 리스트 */}
        <View style={styles.listContainer}>
          <FlashList
            ref={flashListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatMessageComponent message={item} />}
            contentContainerStyle={styles.messagesContainer}
            estimatedItemSize={80}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>메시지를 입력해주세요</ThemedText>
              </View>
            }
          />
        </View>

        {/* 입력 영역 */}
        <View style={styles.inputContainer}>
          <Input
            style={styles.input}
            placeholder="메시지를 입력하세요..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Button
            title="전송"
            onPress={handleSend}
            style={styles.sendButton}
            disabled={inputText.trim() === ''}
          />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  messagesContainer: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  input: {
    flex: 1,
    maxHeight: 100,
  },
  sendButton: {
    minWidth: 60,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});

