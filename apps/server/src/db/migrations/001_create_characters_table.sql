-- Character 테이블 생성
-- PostgreSQL 스키마

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL, -- SillyTavern user handle
  character_name VARCHAR(255) NOT NULL,
  character_data JSONB NOT NULL, -- Character card JSON (spec v2)
  avatar VARCHAR(500) NOT NULL, -- 파일명 (예: "character.png")
  json_data TEXT, -- 원본 JSON 문자열 (선택적)
  date_added BIGINT, -- 파일 생성 시간 (밀리초)
  create_date TIMESTAMP WITH TIME ZONE,
  chat_size INTEGER DEFAULT 0,
  date_last_chat TIMESTAMP WITH TIME ZONE,
  data_size INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_character_name UNIQUE(user_id, character_name)
);

-- 인덱스 생성
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_character_name ON characters(character_name);
CREATE INDEX idx_characters_date_added ON characters(date_added DESC);
CREATE INDEX idx_characters_date_last_chat ON characters(date_last_chat DESC NULLS LAST);

-- JSONB 인덱스 (GIN 인덱스) - character_data 검색용
CREATE INDEX idx_characters_data ON characters USING GIN (character_data);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
