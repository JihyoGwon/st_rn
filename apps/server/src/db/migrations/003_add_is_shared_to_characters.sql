-- characters 테이블에 is_shared 컬럼 추가
-- 공용 캐릭터 기능을 위한 마이그레이션

-- is_shared 컬럼 추가 (기본값: false)
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false NOT NULL;

-- 인덱스 생성 (is_shared로 필터링할 때 성능 향상)
CREATE INDEX IF NOT EXISTS idx_characters_is_shared ON characters(is_shared) WHERE is_shared = true;

-- 기존 캐릭터는 모두 is_shared = false로 설정 (이미 DEFAULT로 설정되지만 명시적으로)
UPDATE characters SET is_shared = false WHERE is_shared IS NULL;
