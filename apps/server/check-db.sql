-- PostgreSQL에서 캐릭터 데이터 확인하는 SQL 쿼리

-- 1. 전체 캐릭터 개수 확인
SELECT COUNT(*) as total_characters FROM characters;

-- 2. 모든 캐릭터 목록 (간단한 정보)
SELECT 
    id,
    character_name,
    avatar,
    created_at,
    updated_at
FROM characters
ORDER BY created_at DESC;

-- 3. 특정 캐릭터의 상세 정보
-- (character_name을 원하는 캐릭터 이름으로 변경)
SELECT 
    id,
    character_name,
    avatar,
    character_data->>'name' as name_from_data,
    character_data->>'description' as description,
    created_at,
    updated_at
FROM characters
WHERE character_name = 'Assistant';  -- 여기에 캐릭터 이름 입력

-- 4. 최근 수정된 캐릭터 확인
SELECT 
    character_name,
    updated_at,
    created_at
FROM characters
ORDER BY updated_at DESC
LIMIT 10;

-- 5. 캐릭터 데이터의 JSON 확인 (전체)
SELECT 
    character_name,
    character_data
FROM characters
WHERE character_name = 'Assistant';  -- 여기에 캐릭터 이름 입력
