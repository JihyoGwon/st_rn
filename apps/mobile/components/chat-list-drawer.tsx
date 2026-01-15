import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer } from 'react-native-drawer-layout';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useChatStore } from '@/store/chat-store';
import { useCharacterStore } from '@/store/character-store';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatChatDate, formatChatTime } from '@/utils/date-format';
import type { RecentChat } from '@/types/api';

interface ChatListDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  children: React.ReactNode;
}

export function ChatListDrawer({ open, onClose, onSelectChat, children }: ChatListDrawerProps) {
  const { chatList, isLoadingChatList, loadChatList, searchChats, deleteChat } = useChatStore();
  const { selectedCharacter } = useCharacterStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'border') || 'rgba(0, 0, 0, 0.1)';
  const backgroundColor = useThemeColor({}, 'background') || '#ffffff';
  const inputBackgroundColor = useThemeColor({}, 'background') || '#ffffff';

  // 드로어가 열릴 때 채팅 목록 로드
  useEffect(() => {
    if (open && selectedCharacter) {
      if (searchQuery.trim() === '') {
        loadChatList(selectedCharacter.avatar);
      } else {
        searchChats(selectedCharacter.avatar, searchQuery);
      }
    }
  }, [open, selectedCharacter]);

  // 검색어 변경 시 디바운스 처리
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!selectedCharacter) return;

    const timeout = setTimeout(() => {
      if (searchQuery.trim() === '') {
        loadChatList(selectedCharacter.avatar);
      } else {
        searchChats(selectedCharacter.avatar, searchQuery);
      }
    }, 300); // 300ms 디바운스

    setSearchTimeout(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchQuery]);

  // 드로어가 닫힐 때 검색어 초기화
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  const handleSelectChat = useCallback((chat: RecentChat) => {
    const chatId = chat.chat_name || chat.file_name?.replace('.jsonl', '') || 'chat';
    onSelectChat(chatId);
    onClose();
  }, [onSelectChat, onClose]);

  const handleDeleteChat = useCallback((chat: RecentChat, event: any) => {
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
              // 삭제 후 검색어가 있으면 다시 검색, 없으면 전체 목록 로드
              if (searchQuery.trim() === '') {
                await loadChatList(selectedCharacter.avatar);
              } else {
                await searchChats(selectedCharacter.avatar, searchQuery);
              }
            } catch (error) {
              Alert.alert('오류', '채팅을 삭제할 수 없습니다.');
            }
          },
        },
      ]
    );
  }, [selectedCharacter, deleteChat, searchQuery, loadChatList, searchChats]);

  const renderChatItem = useCallback(({ item }: { item: RecentChat }) => {
    const chatId = item.chat_name || item.file_name?.replace('.jsonl', '') || 'chat';
    const lastMessage = item.mes || item.preview_message || '';
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
              {item.message_count !== undefined && (
                <ThemedText style={styles.chatItems}>
                  {item.message_count}개 메시지
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
  }, [handleSelectChat, handleDeleteChat, borderColor, iconColor]);

  const renderDrawerContent = useCallback(() => {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* 헤더 */}
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            채팅 목록
          </ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={28} color={textColor || '#000000'} />
          </TouchableOpacity>
        </ThemedView>

        {/* 캐릭터 정보 */}
        {selectedCharacter && (
          <ThemedView style={styles.characterInfo}>
            <ThemedText style={styles.characterName}>
              {selectedCharacter.name}
            </ThemedText>
          </ThemedView>
        )}

        {/* 검색바 */}
        <ThemedView style={styles.searchContainer}>
          <View style={[styles.searchInputContainer, { 
            backgroundColor: inputBackgroundColor || '#ffffff', 
            borderColor: borderColor || 'rgba(0, 0, 0, 0.1)' 
          }]}>
            <MaterialIcons name="search" size={20} color={iconColor || '#0a7ea4'} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: textColor || '#000000' }]}
              placeholder="채팅 검색"
              placeholderTextColor={useThemeColor({ light: 'rgba(0,0,0,0.5)', dark: 'rgba(255,255,255,0.5)' }, 'text') || 'rgba(0,0,0,0.5)'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
              >
                <MaterialIcons name="close" size={18} color={iconColor || '#0a7ea4'} />
              </TouchableOpacity>
            )}
          </View>
        </ThemedView>

        {/* 채팅 목록 */}
        {isLoadingChatList ? (
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <ThemedText style={styles.loadingText}>채팅 목록을 불러오는 중...</ThemedText>
          </ThemedView>
        ) : chatList.length === 0 ? (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              {searchQuery.trim() ? '검색 결과가 없습니다' : '채팅이 없습니다'}
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.listContainer}>
            <FlashList
              data={chatList}
              renderItem={renderChatItem}
              keyExtractor={(item) => item.file_name || `chat-${Math.random()}`}
              estimatedItemSize={100}
              contentContainerStyle={styles.listContent}
            />
          </View>
        )}
      </SafeAreaView>
    );
  }, [
    onClose,
    textColor,
    iconColor,
    borderColor,
    inputBackgroundColor,
    selectedCharacter,
    searchQuery,
    isLoadingChatList,
    chatList,
    renderChatItem,
  ]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      drawerType="front"
      drawerPosition="left"
      drawerStyle={{
        width: '85%',
        maxWidth: 400,
        backgroundColor: backgroundColor || '#ffffff',
      }}
      overlayStyle={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
      renderDrawerContent={renderDrawerContent}
    >
      {children}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawer: {
    width: '85%',
    maxWidth: 400,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
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
  listContainer: {
    flex: 1,
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

