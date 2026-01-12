import { useState, useEffect } from 'react';
import { StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { useChatStore } from '@/store/chat-store';
import { useCharacterStore } from '@/store/character-store';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatChatDate, formatChatTime } from '@/utils/date-format';
import type { RecentChat } from '@/types/api';

interface ChatListModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
}

export function ChatListModal({ visible, onClose, onSelectChat }: ChatListModalProps) {
  const { chatList, isLoadingChatList, loadChatList, deleteChat } = useChatStore();
  const { selectedCharacter } = useCharacterStore();
  
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'border');

  useEffect(() => {
    if (visible && selectedCharacter) {
      loadChatList(selectedCharacter.avatar);
    }
  }, [visible, selectedCharacter]);

  const handleSelectChat = (chat: RecentChat) => {
    const chatId = chat.chat_name || chat.file_name?.replace('.jsonl', '') || 'chat';
    onSelectChat(chatId);
    onClose();
  };

  const handleDeleteChat = (chat: RecentChat, event: any) => {
    event.stopPropagation();
    
    if (!selectedCharacter) return;
    
    Alert.alert(
      '채팅 삭제',
      `"${chat.chat_name || chat.file_name}" 채팅을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChat(selectedCharacter.avatar, chat.file_name || '');
            } catch (error) {
              Alert.alert('오류', '채팅을 삭제할 수 없습니다.');
            }
          },
        },
      ]
    );
  };


  const renderChatItem = ({ item }: { item: RecentChat }) => {
    const chatId = item.chat_name || item.file_name?.replace('.jsonl', '') || 'chat';
    const lastMessage = item.mes || '';
    const lastMessagePreview = lastMessage.length > 50 
      ? lastMessage.substring(0, 50) + '...' 
      : lastMessage;
    
    return (
      <TouchableOpacity
        style={[styles.chatItem, { borderBottomColor: borderColor }]}
        onPress={() => handleSelectChat(item)}
      >
        <ThemedView style={styles.chatItemContent}>
          <ThemedView style={styles.chatItemMain}>
            <ThemedText style={styles.chatName} numberOfLines={1}>
              {item.chat_name || chatId}
            </ThemedText>
            {lastMessagePreview ? (
              <ThemedText style={styles.chatPreview} numberOfLines={1}>
                {lastMessagePreview}
              </ThemedText>
            ) : null}
            <ThemedView style={styles.chatMeta}>
              <ThemedText style={styles.chatDate}>
                {item.last_mes ? formatChatDate(item.last_mes) : ''}
              </ThemedText>
              {item.last_mes && (
                <ThemedText style={styles.chatTime}>
                  {formatChatTime(item.last_mes)}
                </ThemedText>
              )}
              {item.chat_items !== undefined && (
                <ThemedText style={styles.chatItems}>
                  {item.chat_items}개 메시지
                </ThemedText>
              )}
            </ThemedView>
          </ThemedView>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => handleDeleteChat(item, e)}
          >
            <MaterialIcons name="delete-outline" size={24} color={iconColor} />
          </TouchableOpacity>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container} edges={['top']}>
          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              채팅 목록
            </ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={28} color={textColor} />
            </TouchableOpacity>
          </ThemedView>

          {selectedCharacter && (
            <ThemedView style={styles.characterInfo}>
              <ThemedText style={styles.characterName}>
                {selectedCharacter.name}
              </ThemedText>
            </ThemedView>
          )}

          {isLoadingChatList ? (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <ThemedText style={styles.loadingText}>채팅 목록을 불러오는 중...</ThemedText>
            </ThemedView>
          ) : chatList.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>채팅이 없습니다</ThemedText>
            </ThemedView>
          ) : (
            <FlashList
              data={chatList}
              renderItem={renderChatItem}
              keyExtractor={(item) => item.file_name || `chat-${Math.random()}`}
              estimatedItemSize={100}
              contentContainerStyle={styles.listContent}
            />
          )}

        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  characterInfo: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  characterName: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
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
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    borderBottomWidth: 1,
  },
  chatItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  chatItemMain: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  chatPreview: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  chatMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  chatTime: {
    fontSize: 12,
    opacity: 0.6,
  },
  chatItems: {
    fontSize: 12,
    opacity: 0.6,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 12,
  },
});

