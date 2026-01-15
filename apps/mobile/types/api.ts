/**
 * API 관련 타입 정의
 */

/**
 * 서버에서 받는 채팅 메시지 타입
 */
export interface ServerChatMessage {
  name?: string;
  mes?: string;
  is_user?: boolean;
  character_name?: string;
  send_date?: string;
  extra?: Record<string, unknown>;
  is_system?: boolean;
  [key: string]: unknown; // 기타 필드 허용 (하지만 명시적 필드 우선)
}

/**
 * 서버 채팅 메타데이터
 */
export interface ServerChatMetadata {
  chat_metadata?: Record<string, unknown>;
  user_name?: string;
  character_name?: string;
  [key: string]: unknown;
}

/**
 * 서버에 저장하는 채팅 데이터 형식
 * 첫 번째 항목은 메타데이터, 나머지는 메시지들
 */
export type ServerChatData = [ServerChatMetadata, ...ServerChatMessage[]];

/**
 * Character 데이터 응답
 */
export interface CharacterData {
  name: string;
  character_version?: string;
  creator?: string;
  creator_notes?: string;
  tags?: string[];
  first_mes?: string;
  [key: string]: unknown;
}

/**
 * Character API 응답
 */
export interface CharacterResponse {
  data?: CharacterData;
  name?: string;
  [key: string]: unknown;
}

/**
 * 메시지 준비 응답
 */
export interface PrepareMessagesResponse {
  success: boolean;
  generate_data?: {
    messages?: ChatCompletionMessage[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  };
  metadata?: {
    character_name?: string;
    user_name?: string;
    summary?: {
      exists: boolean;
      generating: boolean;
      length: number;
    };
    [key: string]: unknown;
  };
}

/**
 * 채팅 완성 메시지 (OpenAI 형식)
 */
export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  identifier?: string;
  [key: string]: unknown;
}

/**
 * 채팅 완성 요청 파라미터
 */
export interface ChatCompletionParams {
  messages: ChatCompletionMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  chat_completion_source?: string;
  reasoning_effort?: string;
  include_reasoning?: boolean;
  vertexai_auth_mode?: string;
  vertexai_region?: string;
  [key: string]: unknown; // 기타 파라미터들 허용
}

/**
 * 채팅 완성 응답 (비스트리밍)
 */
export interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
      role?: string;
      [key: string]: unknown;
    };
    text?: string;
    [key: string]: unknown;
  }>;
  content?: string;
  [key: string]: unknown;
}

/**
 * 최근 채팅 정보
 */
export interface RecentChat {
  file_name: string;        // "chat.jsonl"
  chat_name?: string;       // "chat" (확장자 제거)
  last_mes: string;         // 마지막 메시지 타임스탬프
  mes?: string;            // 마지막 메시지 내용
  avatar: string;           // 캐릭터 아바타 파일명
  char_name?: string;       // 캐릭터 이름
  chat_items?: number;      // 메시지 개수
  file_size?: string;       // 파일 크기
  [key: string]: unknown;
}

/**
 * API 응답 기본 타입
 */
export interface ApiResponse<T> {
  success?: boolean;
  error?: boolean;
  data?: T;
  [key: string]: unknown;
}

