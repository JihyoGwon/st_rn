import type { Character } from '@/store/character-store';

/**
 * 캐릭터 아바타 이미지 URL 생성
 * 캐시 버스터를 포함하여 이미지 변경 시 새로 로드되도록 함
 * 
 * @param character 캐릭터 객체
 * @param serverUrl 서버 URL
 * @returns 아바타 이미지 URL 또는 null (기본 이미지 사용)
 */
export function getCharacterAvatarUrl(
  character: Character | null | undefined,
  serverUrl: string | null | undefined
): string | null {
  // 유효성 검사
  if (!character || !serverUrl || !character.avatar || character.avatar === 'none') {
    return null; // 기본 이미지 사용
  }

  try {
    const url = new URL(serverUrl);
    // date_added를 캐시 버스터로 사용 (이미지 변경 시 새로 로드)
    const cacheBuster = character.date_added ? `&t=${character.date_added}` : `&t=${Date.now()}`;
    return `${url.origin}/thumbnail?type=avatar&file=${encodeURIComponent(character.avatar)}${cacheBuster}`;
  } catch {
    // URL 파싱 실패 시 기본 이미지 사용
    return null;
  }
}

/**
 * 아바타 이미지 컴포넌트의 key prop 생성
 * 캐릭터가 변경되거나 아바타가 업데이트될 때 이미지를 강제로 리렌더링하기 위함
 * 
 * @param character 캐릭터 객체
 * @returns key 값 (avatar-date_added 형식)
 */
export function getAvatarImageKey(character: Character | null | undefined): string {
  if (!character || !character.avatar) {
    return `avatar-${Date.now()}`;
  }
  return `${character.avatar}-${character.date_added || Date.now()}`;
}
