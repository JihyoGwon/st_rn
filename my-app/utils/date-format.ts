/**
 * 날짜/시간을 사람이 읽기 쉬운 형식으로 변환
 * SillyTavern의 humanizedDateTime과 동일한 형식
 * @param timestamp - 타임스탬프 (밀리초), 기본값은 현재 시간
 * @returns 형식: "2024-01-12@14h30m45s123ms"
 */
export function humanizedDateTime(timestamp: number = Date.now()): string {
  const date = new Date(timestamp);
  const dt = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    millisecond: date.getMilliseconds(),
  };
  
  for (const key in dt) {
    const padLength = key === 'millisecond' ? 3 : 2;
    dt[key as keyof typeof dt] = dt[key as keyof typeof dt].toString().padStart(padLength, '0') as any;
  }
  
  return `${dt.year}-${dt.month}-${dt.day}@${dt.hour}h${dt.minute}m${dt.second}s${dt.millisecond}ms`;
}

/**
 * 날짜를 간단한 형식으로 표시 (예: "1월 12일", "오늘", "어제")
 */
export function formatChatDate(timestamp: string | number): string {
  const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const chatDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = today.getTime() - chatDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return '오늘';
  } else if (diffDays === 1) {
    return '어제';
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  }
}

/**
 * 시간을 표시 (예: "14:30")
 */
export function formatChatTime(timestamp: string | number): string {
  const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

