/**
 * 서버 자동 감지 유틸리티
 * 로컬 네트워크에서 SillyTavern 서버를 찾습니다.
 */

import { DEFAULT_SERVER_PORT, TIMEOUTS } from '@/constants/api';

const SERVER_PORT = DEFAULT_SERVER_PORT;
const SCAN_TIMEOUT = TIMEOUTS.SERVER_SCAN;
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
      const isValid = data && typeof data.token === 'string';
      if (isValid) {
        console.log(`[ServerDiscovery] 유효한 서버 발견: ${ip}:${port}`);
      }
      return isValid;
    }
    
    return false;
  } catch (error) {
    // 네트워크 에러는 무시 (서버가 없거나 연결 불가)
    // 디버깅을 위해 에러 로그는 출력하지 않음 (너무 많아짐)
    return false;
  }
}

/**
 * 서브넷 범위에서 서버를 스캔
 * 첫 번째 성공 시 즉시 반환하도록 최적화
 */
async function scanSubnet(subnet: string, port: number = SERVER_PORT): Promise<string | null> {
  // 배치 크기: 한 번에 20개씩 스캔
  const BATCH_SIZE = 20;
  const TOTAL_IPS = 254;
  
  // 배치 단위로 스캔 (첫 번째 성공 시 즉시 반환)
  for (let start = 1; start <= TOTAL_IPS; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, TOTAL_IPS);
    const promises: Promise<{ ip: string; found: boolean }>[] = [];
    
    // 현재 배치의 IP들을 스캔
    for (let i = start; i <= end; i++) {
      const ip = `${subnet}.${i}`;
      promises.push(
        checkServerAtIP(ip, port)
          .then(found => {
            if (found) {
              console.log(`[ServerDiscovery] 서버 발견: ${ip}:${port}`);
            }
            return { ip, found };
          })
          .catch(() => ({ ip, found: false }))
      );
    }
    
    // 현재 배치의 결과를 확인 (첫 번째 성공 시 즉시 반환)
    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.found) {
        return result.value.ip;
      }
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
  
  // Android 에뮬레이터를 위한 특수 IP 먼저 확인
  const emulatorIPs = ['10.0.2.2']; // Android 에뮬레이터 호스트
  console.log('[ServerDiscovery] Android 에뮬레이터 IP 확인 중...');
  for (const ip of emulatorIPs) {
    const found = await checkServerAtIP(ip);
    if (found) {
      console.log(`[ServerDiscovery] 서버 발견 (에뮬레이터): ${ip}:${SERVER_PORT}`);
      return ip;
    }
  }
  
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

