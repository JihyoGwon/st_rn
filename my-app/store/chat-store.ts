import { create } from 'zustand';
import { apiClient } from '@/lib/api/client';
import { useAppSettingsStore } from './app-settings-store';

/**
 * 서버에서 받는 채팅 메시지 타입
 */
export interface ServerChatMessage {
  name?: string;
  mes?: string;
  is_user?: boolean;
  character_name?: string;
  send_date?: string;
  [key: string]: any;
}

/**
 * 앱에서 사용하는 채팅 메시지 타입
 */
export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  name?: string;
}

/**
 * 채팅 스토어 인터페이스
 */
interface ChatStore {
  messages: ChatMessage[];
  currentChatId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // 액션들
  loadChatHistory: (characterId: string, chatId?: string) => Promise<void>;
  addMessage: (text: string, isUser: boolean, name?: string) => void;
  sendMessage: (text: string, characterId: string) => Promise<void>;
  clearMessages: () => void;
  setCurrentChatId: (chatId: string | null) => void;
  resetChat: (characterId: string, chatId?: string) => Promise<void>;
}

/**
 * 서버 메시지를 앱 메시지로 변환
 */
function convertServerMessageToAppMessage(serverMsg: ServerChatMessage, index: number): ChatMessage {
  return {
    id: serverMsg.send_date 
      ? `${serverMsg.send_date}_${index}` 
      : Date.now().toString() + Math.random().toString(36).substr(2, 9),
    text: serverMsg.mes || '',
    isUser: serverMsg.is_user || false,
    timestamp: serverMsg.send_date 
      ? new Date(serverMsg.send_date).getTime() 
      : Date.now(),
    name: serverMsg.name || serverMsg.character_name,
  };
}

/**
 * 앱 메시지를 서버 형식으로 변환
 */
function convertAppMessagesToServerFormat(
  appMessages: ChatMessage[],
  userName: string,
  characterName: string,
  chatId: string
): any[] {
  // 첫 번째 줄: 메타데이터
  const metadata = {
    chat_metadata: {
      // 필요시 추가 메타데이터
    },
    user_name: userName,
    character_name: characterName,
  };
  
  // 나머지 줄: 메시지들
  const serverMessages = appMessages.map((msg) => ({
    name: msg.isUser ? userName : characterName,
    is_user: msg.isUser,
    mes: msg.text,
    send_date: new Date(msg.timestamp).toISOString(),
    extra: {},
  }));
  
  return [metadata, ...serverMessages];
}

/**
 * 채팅 스토어
 */
export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  currentChatId: null,
  isLoading: false,
  error: null,

  /**
   * 채팅 히스토리 로드
   */
  loadChatHistory: async (characterId: string, chatId?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // chatId가 없으면 기본 채팅 ID 생성 (또는 최근 채팅 사용)
      const fileName = chatId || 'chat';
      
      const serverMessages = await apiClient.getChatHistory(characterId, fileName);
      
      // 첫 번째 항목이 메타데이터인지 확인하고 제외
      const messagesToConvert = Array.isArray(serverMessages) 
        ? serverMessages.filter((msg, index) => {
            // 첫 번째 항목이 chat_metadata를 가지고 있으면 메타데이터로 간주
            if (index === 0 && msg.chat_metadata !== undefined) {
              return false;
            }
            return true;
          })
        : [];
      
      // 서버 메시지를 앱 메시지로 변환
      const appMessages = messagesToConvert.map((msg, index) => 
        convertServerMessageToAppMessage(msg, index)
      );
      
      set({ 
        messages: appMessages,
        currentChatId: fileName,
        isLoading: false 
      });
    } catch (error) {
      console.error('[ChatStore] 채팅 히스토리 로드 실패:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : '채팅 히스토리를 불러올 수 없습니다';
      set({ 
        error: errorMessage,
        isLoading: false 
      });
    }
  },

  /**
   * 메시지 추가 (로컬)
   */
  addMessage: (text: string, isUser: boolean, name?: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text,
      isUser,
      timestamp: Date.now(),
      name,
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },

  /**
   * 메시지 전송 (서버로)
   */
  sendMessage: async (text: string, characterId: string) => {
    const state = get();
    const chatId = state.currentChatId || 'chat';
    
    try {
      // 0. 서버 설정 동기화 (메시지 전송 전에 명시적으로 동기화)
      console.log('[ChatStore] 서버 설정 동기화 시작...');
      await apiClient.syncSettings();
      console.log('[ChatStore] 서버 설정 동기화 완료');
      
      // 1. 사용자 메시지 추가 (로컬)
      get().addMessage(text, true);
      
      // 2. 메시지 준비
      console.log('[ChatStore] prepareMessages 호출 시작...', { chatId, characterId, user_message: text });
      let prepareResult;
      try {
        prepareResult = await apiClient.prepareMessages({
          chat_id: chatId,
          character_id: characterId,
          user_message: text,
          type: 'chat',
        });
        console.log('[ChatStore] prepareMessages 호출 성공');
      } catch (error) {
        console.error('[ChatStore] prepareMessages 호출 실패:', error);
        throw error;
      }
      
      if (!prepareResult.success || !prepareResult.generate_data) {
        console.error('[ChatStore] prepareMessages 응답이 유효하지 않음:', prepareResult);
        throw new Error('메시지 준비 실패');
      }
      
      // 디버깅: prepareMessages 응답의 messages 구조 확인
      console.log('[ChatStore] ========== prepareMessages 응답 ==========');
      console.log('[ChatStore] prepareMessages 응답 - messages 개수:', prepareResult.messages?.length || 0);
      if (prepareResult.messages && Array.isArray(prepareResult.messages)) {
        prepareResult.messages.forEach((msg: any, index: number) => {
          const contentPreview = msg.content ? msg.content.substring(0, 80) + (msg.content.length > 80 ? '...' : '') : '(empty)';
          console.log(`[ChatStore] [${index + 1}] role: ${msg.role}, identifier: ${msg.identifier || 'none'}, content: ${contentPreview}`);
        });
        
        // Main Prompt 찾기
        const mainPrompt = prepareResult.messages.find((m: any) => 
          m.identifier === 'main' || 
          (m.content && (m.content.includes("Write") || m.content.includes("write")))
        );
        if (mainPrompt) {
          console.log('[ChatStore] ✅ Main Prompt 발견:', JSON.stringify(mainPrompt, null, 2));
        } else {
          console.log('[ChatStore] ❌ Main Prompt를 찾을 수 없습니다');
        }
      } else {
        console.log('[ChatStore] ❌ messages가 배열이 아닙니다:', typeof prepareResult.messages);
      }
      console.log('[ChatStore] ===========================================');
      
      // 3. AI 응답 생성 (비스트리밍)
      // 서버 설정에서 동적으로 가져오기
      const serverSettings = useAppSettingsStore.getState().settings.serverSettings || {};
      
      // 디버깅: 설정 값 확인
      console.log('[ChatStore] 서버 설정:', {
        chat_completion_source: serverSettings.chat_completion_source,
        vertexai_auth_mode: serverSettings.vertexai_auth_mode,
        vertexai_model: serverSettings.vertexai_model,
      });
      
      // chat_completion_source 결정
      const chatCompletionSource = serverSettings.chat_completion_source || 'openai';
      
      if (!serverSettings.chat_completion_source) {
        console.warn('[ChatStore] 서버 설정에서 chat_completion_source를 찾을 수 없습니다. 기본값 사용:', chatCompletionSource);
      }
      
      // 모델 결정 (소스별로 다른 필드 사용)
      let model = prepareResult.generate_data?.model;
      if (!model) {
        if (chatCompletionSource === 'vertexai') {
          model = serverSettings.vertexai_model || serverSettings.google_model || 'gemini-2.5-flash';
        } else if (chatCompletionSource === 'openai') {
          model = serverSettings.openai_model || 'gpt-4-turbo';
        } else if (chatCompletionSource === 'claude') {
          model = serverSettings.claude_model || 'claude-sonnet-4-5';
        } else {
          model = 'gpt-4-turbo'; // 기본값
        }
      }
      
      // Vertex AI 관련 설정
      const vertexaiAuthMode = serverSettings.vertexai_auth_mode || 'express';
      const vertexaiRegion = serverSettings.vertexai_region || 'us-central1';
      
      // 생성 파라미터
      const temperature = prepareResult.generate_data?.temperature ?? serverSettings.temp_openai ?? 0.7;
      const maxTokens = prepareResult.generate_data?.max_tokens ?? serverSettings.openai_max_tokens ?? 2000;
      
      // prepareResult.generate_data에 이미 설정이 있을 수 있으므로, 서버 설정으로 덮어쓰기
      const generateData = {
        ...prepareResult.generate_data,
        stream: false,
        chat_completion_source: chatCompletionSource, // 서버 설정 우선
        model: model, // 서버 설정 우선
        temperature: temperature,
        max_tokens: maxTokens,
      };
      
      // Vertex AI인 경우 추가 설정
      if (chatCompletionSource === 'vertexai') {
        generateData.vertexai_auth_mode = vertexaiAuthMode;
        generateData.vertexai_region = vertexaiRegion;
      }
      
      // 추론(reasoning) 설정 추가 (Gemini 모델용)
      console.log('[ChatStore] 서버 설정에서 reasoning 값 확인:', {
        serverSettings_reasoning_effort: serverSettings.reasoning_effort,
        serverSettings_include_reasoning: serverSettings.include_reasoning,
        serverSettings_keys: Object.keys(serverSettings).filter(k => k.includes('reason') || k.includes('thought')),
      });
      
      if (serverSettings.reasoning_effort !== undefined) {
        generateData.reasoning_effort = serverSettings.reasoning_effort;
        console.log('[ChatStore] reasoning_effort 추가됨:', generateData.reasoning_effort);
      } else {
        console.log('[ChatStore] reasoning_effort가 서버 설정에 없음');
      }
      
      if (serverSettings.include_reasoning !== undefined) {
        generateData.include_reasoning = serverSettings.include_reasoning;
        console.log('[ChatStore] include_reasoning 추가됨:', generateData.include_reasoning);
      } else {
        console.log('[ChatStore] include_reasoning이 서버 설정에 없음');
      }
      
      // 디버깅: 최종 generateData 확인
      console.log('[ChatStore] 최종 generateData:', {
        chat_completion_source: generateData.chat_completion_source,
        model: generateData.model,
        vertexai_auth_mode: generateData.vertexai_auth_mode,
        vertexai_region: generateData.vertexai_region,
        reasoning_effort: generateData.reasoning_effort,
        include_reasoning: generateData.include_reasoning,
      });
      
      // 디버깅: 최종 generateData.messages 구조 확인 (웹과 비교용)
      console.log('[ChatStore] ========== 최종 프롬프트 구조 (generateData.messages) ==========');
      console.log('[ChatStore] messages 개수:', generateData.messages?.length || 0);
      if (generateData.messages && Array.isArray(generateData.messages)) {
        generateData.messages.forEach((msg: any, index: number) => {
          console.log(`[ChatStore] [${index + 1}] role: ${msg.role}, content: ${msg.content?.substring(0, 100)}${msg.content?.length > 100 ? '...' : ''}`);
          if (msg.identifier) {
            console.log(`[ChatStore]      identifier: ${msg.identifier}`);
          }
        });
      }
      console.log('[ChatStore] ===============================================================');
      
      const completionResponse = await apiClient.generateChatCompletion(generateData);
      
      // 4. 응답 파싱
      let aiResponse = '';
      if (completionResponse.choices && completionResponse.choices[0]) {
        aiResponse = completionResponse.choices[0].message?.content || 
                     completionResponse.choices[0].text || 
                     '';
      } else if (completionResponse.content) {
        aiResponse = completionResponse.content;
      } else if (typeof completionResponse === 'string') {
        aiResponse = completionResponse;
      }
      
      if (!aiResponse) {
        throw new Error('AI 응답을 받을 수 없습니다');
      }
      
      // 5. AI 응답 메시지 추가
      const characterName = prepareResult.metadata?.character_name || '캐릭터';
      get().addMessage(aiResponse, false, characterName);
      
      // 6. 채팅 저장
      const messages = get().messages;
      const serverChatData = convertAppMessagesToServerFormat(
        messages,
        prepareResult.metadata?.user_name || 'You',
        characterName,
        chatId
      );
      
      await apiClient.saveChat(characterId, chatId, serverChatData);
      
    } catch (error) {
      console.error('[ChatStore] 메시지 전송 실패:', error);
      // 에러 발생 시 마지막 메시지 제거 (사용자 메시지)
      const messages = get().messages;
      if (messages.length > 0 && messages[messages.length - 1].isUser) {
        set({ messages: messages.slice(0, -1) });
      }
      throw error;
    }
  },

  /**
   * 메시지 초기화
   */
  clearMessages: () => set({ messages: [], currentChatId: null }),

  /**
   * 현재 채팅 ID 설정
   */
  setCurrentChatId: (chatId: string | null) => set({ currentChatId: chatId }),

  /**
   * 채팅 리셋 (서버에서 채팅 내용 비우기)
   */
  resetChat: async (characterId: string, chatId?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const fileName = chatId || 'chat';
      await apiClient.resetChat(characterId, fileName);
      
      // 로컬 메시지도 초기화
      set({ 
        messages: [],
        currentChatId: fileName,
        isLoading: false 
      });
    } catch (error) {
      console.error('[ChatStore] 채팅 리셋 실패:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : '채팅을 리셋할 수 없습니다';
      set({ 
        error: errorMessage,
        isLoading: false 
      });
      throw error;
    }
  },
}));

