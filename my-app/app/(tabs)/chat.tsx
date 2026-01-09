import { useState, useRef, useEffect } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, View, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChatMessageComponent } from '@/components/chat-message';
import { useChatStore } from '@/store/chat-store';
import { useCharacterStore } from '@/store/character-store';
import { useAppSettingsStore } from '@/store/app-settings-store';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ChatScreen() {
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { 
    messages, 
    isLoading, 
    error, 
    loadChatHistory, 
    addMessage, 
    sendMessage,
    currentChatId,
    resetChat
  } = useChatStore();
  const { selectedCharacter } = useCharacterStore();
  const { settings, loadFromStorage } = useAppSettingsStore();
  const flashListRef = useRef<FlashList<any>>(null);
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'tint');

  // 화면 진입 시 설정 확인 및 채팅 히스토리 로드
  useEffect(() => {
    const initialize = async () => {
      await loadFromStorage();
      
      // Single 모드일 때는 기본 캐릭터 선택
      if (settings.mode === 'single' && settings.selectedCharacterId && !selectedCharacter) {
        await useCharacterStore.getState().selectCharacterById(settings.selectedCharacterId);
      }
      
      // 캐릭터가 선택되지 않았으면 홈으로 리다이렉트
      const currentCharacter = useCharacterStore.getState().selectedCharacter;
      if (!currentCharacter && settings.mode === 'multi') {
        router.replace('/');
        return;
      }
      
      // 캐릭터가 있으면 채팅 히스토리 로드
      if (currentCharacter) {
        await loadChatHistory(currentCharacter.avatar, currentChatId || 'chat');
      }
    };
    
    initialize();
  }, []);

  // 캐릭터가 변경될 때 채팅 히스토리 다시 로드
  useEffect(() => {
    if (!selectedCharacter) {
      return;
    }

    const loadCharacterChat = async () => {
      // 이전 메시지 초기화
      useChatStore.getState().clearMessages();
      // 새 캐릭터의 채팅 히스토리 로드
      await loadChatHistory(selectedCharacter.avatar, 'chat');
    };

    loadCharacterChat();
  }, [selectedCharacter?.avatar]); // 캐릭터 avatar가 변경될 때만 실행

  // 새 메시지가 추가되면 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flashListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (inputText.trim() === '' || isSending || !selectedCharacter) {
      return;
    }

    setIsSending(true);
    const messageText = inputText.trim();
    setInputText(''); // 입력창 먼저 초기화

    try {
      // 메시지 전송 (서버로)
      await sendMessage(messageText, selectedCharacter.avatar);
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      // 에러 발생 시 메시지 다시 추가 (입력창에)
      setInputText(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const handleResetChat = () => {
    if (!selectedCharacter) {
      return;
    }

    Alert.alert(
      '채팅 리셋',
      '모든 채팅 내용이 삭제됩니다. 계속하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '리셋',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetChat(selectedCharacter.avatar, currentChatId || 'chat');
              // 리셋 후 채팅 히스토리 다시 로드 (빈 상태로)
              await loadChatHistory(selectedCharacter.avatar, currentChatId || 'chat');
            } catch (error) {
              console.error('채팅 리셋 실패:', error);
              Alert.alert('오류', '채팅을 리셋할 수 없습니다.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>
            {selectedCharacter?.name || '채팅'}
          </ThemedText>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={handleResetChat}
            disabled={!selectedCharacter || isLoading}
          >
            <MaterialIcons name="more-vert" size={24} color={iconColor} />
          </TouchableOpacity>
        </View>

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
                {isLoading ? (
                  <>
                    <ActivityIndicator size="large" />
                    <ThemedText style={styles.emptyText}>채팅을 불러오는 중...</ThemedText>
                  </>
                ) : error ? (
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                ) : (
                  <ThemedText style={styles.emptyText}>메시지를 입력해주세요</ThemedText>
                )}
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
            title={isSending ? "전송 중..." : "전송"}
            onPress={handleSend}
            style={styles.sendButton}
            disabled={inputText.trim() === '' || isSending || !selectedCharacter}
          />
        </View>
        </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  menuButton: {
    padding: 4,
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
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ff4444',
    textAlign: 'center',
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

