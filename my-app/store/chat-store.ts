import { create } from 'zustand';

/**
 * 채팅 메시지 타입
 */
export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
}

/**
 * 채팅 스토어 인터페이스
 */
interface ChatStore {
  messages: ChatMessage[];
  addMessage: (text: string, isUser: boolean) => void;
  clearMessages: () => void;
}

/**
 * 채팅 스토어
 */
export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (text: string, isUser: boolean) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text,
      isUser,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },
  clearMessages: () => set({ messages: [] }),
}));

