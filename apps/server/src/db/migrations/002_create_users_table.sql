-- Users 테이블 생성
-- PostgreSQL 스키마
-- handle을 PRIMARY KEY로 사용하여 characters 테이블의 user_id와 호환

CREATE TABLE IF NOT EXISTS users (
  handle VARCHAR(255) PRIMARY KEY,                    -- 사용자 핸들 (PK, characters.user_id와 호환)
  name VARCHAR(255) NOT NULL,                          -- 표시 이름
  password_hash VARCHAR(255) NOT NULL DEFAULT '',     -- 비밀번호 해시 (scrypt)
  salt VARCHAR(255) NOT NULL DEFAULT '',              -- 비밀번호 해싱용 salt
  enabled BOOLEAN DEFAULT true,                       -- 활성화 여부
  admin BOOLEAN DEFAULT false,                        -- 어드민 여부
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- 생성 시간
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()   -- 수정 시간
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_enabled ON users(enabled);
CREATE INDEX IF NOT EXISTS idx_users_admin ON users(admin);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_users_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_users_updated_at_column();
