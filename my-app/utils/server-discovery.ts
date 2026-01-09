/**
 * 서버 자동 감지 유틸리티
 * 로컬 네트워크에서 SillyTavern 서버를 찾습니다.
 */

const SERVER_PORT = 8001;
const SCAN_TIMEOUT = 2000; // 각 IP당 2초 타임아웃
const COMMON_SUBNETS = [
  '192.168.1',   // 가장 일반적인 서브넷
  '192.168.0',   // 두 번째로 일반적인 서브넷
  '192.168.2',
  '10.0.0',
  '172.16.0',
];

/**
 * 특정 IP 주소에서 서버가 실행 중인지 확인
 */
async function checkServerAtIP(ip: string, port: number = SERVER_PORT): Promise<boolean> {
  const url = `http://${ip}:${port}/csrf-token`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    // CSRF 토큰 엔드포인트가 응답하면 서버가 실행 중
    if (response.ok) {
      const data = await response.json();
      return data && typeof data.token === 'string';
    }
    
    return false;
  } catch (error) {
    // 네트워크 에러는 무시 (서버가 없거나 연결 불가)
    return false;
  }
}

/**
 * 서브넷 범위에서 서버를 스캔
 */
async function scanSubnet(subnet: string, port: number = SERVER_PORT): Promise<string | null> {
  const promises: Promise<{ ip: string; found: boolean }>[] = [];
  
  // 1부터 254까지 스캔 (0과 255는 일반적으로 사용되지 않음)
  for (let i = 1; i <= 254; i++) {
    const ip = `${subnet}.${i}`;
    promises.push(
      checkServerAtIP(ip, port).then(found => ({ ip, found }))
    );
  }
  
  // 모든 요청을 병렬로 실행하되, 첫 번째 성공 시 즉시 반환
  const results = await Promise.allSettled(promises);
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.found) {
      return result.value.ip;
    }
  }
  
  return null;
}

/**
 * 로컬 네트워크에서 SillyTavern 서버를 자동으로 찾습니다.
 * 여러 서브넷을 순차적으로 스캔합니다.
 * 
 * @returns 서버 IP 주소 (예: "192.168.1.84") 또는 null
 */
export async function discoverServer(): Promise<string | null> {
  console.log('[ServerDiscovery] 서버 자동 감지 시작...');
  
  // 일반적인 서브넷들을 순차적으로 스캔
  for (const subnet of COMMON_SUBNETS) {
    console.log(`[ServerDiscovery] ${subnet}.x 스캔 중...`);
    const foundIP = await scanSubnet(subnet);
    
    if (foundIP) {
      console.log(`[ServerDiscovery] 서버 발견: ${foundIP}:${SERVER_PORT}`);
      return foundIP;
    }
  }
  
  console.log('[ServerDiscovery] 서버를 찾을 수 없습니다.');
  return null;
}

/**
 * 현재 저장된 서버 URL이 여전히 유효한지 확인
 */
export async function validateServerUrl(url: string): Promise<boolean> {
  try {
    const testUrl = url.replace(/\/$/, '') + '/csrf-token';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return data && typeof data.token === 'string';
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

