/**
 * 디폴트 사용자의 설정을 전역 디렉토리(_global)로 마이그레이션하는 스크립트
 * 
 * 실행 방법:
 *   node apps/server/scripts/migrate-to-global-settings.js
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 서버 디렉토리 경로 (apps/server)
const serverDir = path.resolve(__dirname, '..');

// config.yaml 읽기
const configPath = path.join(serverDir, 'config.yaml');
let dataRoot;

if (fs.existsSync(configPath)) {
    try {
        const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
        const configDataRoot = config.dataRoot || './data';
        // 상대 경로인 경우 서버 디렉토리 기준으로 절대 경로 변환
        dataRoot = path.isAbsolute(configDataRoot) 
            ? configDataRoot 
            : path.resolve(serverDir, configDataRoot);
        console.log(`📁 config.yaml에서 dataRoot 읽음: ${configDataRoot} -> ${dataRoot}`);
    } catch (error) {
        console.warn(`⚠️  config.yaml 읽기 실패: ${error.message}`);
        // 기본값 사용
        dataRoot = path.resolve(serverDir, 'data');
    }
} else {
    // config.yaml이 없으면 기본값 사용
    console.warn(`⚠️  config.yaml을 찾을 수 없음: ${configPath}`);
    dataRoot = process.env.SILLYTAVERN_DATA_ROOT || path.resolve(serverDir, 'data');
}

globalThis.DATA_ROOT = dataRoot;

const GLOBAL_DIRECTORY_NAME = '_global';
const DEFAULT_USER_HANDLE = 'default-user';

// 전역 디렉토리로 마이그레이션할 디렉토리 목록
const GLOBAL_DIRECTORY_KEYS = [
    'worlds',
    'characters',
    'backgrounds',
    'themes',
    'NovelAI Settings',
    'KoboldAI Settings',
    'OpenAI Settings',
    'TextGen Settings',
    'movingUI',
    'extensions',
    'instruct',
    'context',
    'QuickReplies',
    'assets',
    'sysprompt',
    'reasoning',
    'thumbnails',
];

/**
 * 디렉토리 또는 파일을 복사하는 함수
 */
function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    
    if (stat.isDirectory()) {
        // 디렉토리인 경우
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const files = fs.readdirSync(src);
        for (const file of files) {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);
            copyRecursive(srcPath, destPath);
        }
    } else {
        // 파일인 경우
        if (!fs.existsSync(path.dirname(dest))) {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
        }
        fs.copyFileSync(src, dest);
    }
}

/**
 * 마이그레이션 실행
 */
async function migrateToGlobalSettings() {
    console.log('=== 전역 설정 마이그레이션 시작 ===\n');
    console.log(`데이터 루트: ${dataRoot}\n`);

    const defaultUserPath = path.join(dataRoot, DEFAULT_USER_HANDLE);
    const globalPath = path.join(dataRoot, GLOBAL_DIRECTORY_NAME);

    // 디폴트 사용자 디렉토리 확인
    if (!fs.existsSync(defaultUserPath)) {
        console.error(`❌ 디폴트 사용자 디렉토리를 찾을 수 없습니다: ${defaultUserPath}`);
        process.exit(1);
    }

    console.log(`✅ 디폴트 사용자 디렉토리 확인: ${defaultUserPath}\n`);

    // 전역 디렉토리 생성
    if (!fs.existsSync(globalPath)) {
        fs.mkdirSync(globalPath, { recursive: true });
        console.log(`✅ 전역 디렉토리 생성: ${globalPath}\n`);
    } else {
        console.log(`ℹ️  전역 디렉토리 이미 존재: ${globalPath}\n`);
    }

    let copiedCount = 0;
    let skippedCount = 0;

    // settings.json 복사
    const settingsSrc = path.join(defaultUserPath, 'settings.json');
    const settingsDest = path.join(globalPath, 'settings.json');
    
    if (fs.existsSync(settingsSrc)) {
        if (fs.existsSync(settingsDest)) {
            console.log(`⏭️  settings.json 이미 존재, 건너뜀: ${settingsDest}`);
            skippedCount++;
        } else {
            fs.copyFileSync(settingsSrc, settingsDest);
            console.log(`✅ settings.json 복사: ${settingsDest}`);
            copiedCount++;
        }
    } else {
        console.warn(`⚠️  settings.json을 찾을 수 없음: ${settingsSrc}`);
    }

    // secrets.json 복사 (API 키 등)
    const secretsSrc = path.join(defaultUserPath, 'secrets.json');
    const secretsDest = path.join(globalPath, 'secrets.json');
    
    if (fs.existsSync(secretsSrc)) {
        if (fs.existsSync(secretsDest)) {
            console.log(`⏭️  secrets.json 이미 존재, 건너뜀: ${secretsDest}`);
            skippedCount++;
        } else {
            fs.copyFileSync(secretsSrc, secretsDest);
            console.log(`✅ secrets.json 복사: ${secretsDest}`);
            copiedCount++;
        }
    } else {
        console.log(`ℹ️  secrets.json 없음, 건너뜀`);
    }

    // 각 디렉토리 복사
    for (const dirKey of GLOBAL_DIRECTORY_KEYS) {
        const srcDir = path.join(defaultUserPath, dirKey);
        const destDir = path.join(globalPath, dirKey);

        if (fs.existsSync(srcDir)) {
            if (fs.existsSync(destDir)) {
                console.log(`⏭️  ${dirKey} 이미 존재, 건너뜀: ${destDir}`);
                skippedCount++;
            } else {
                copyRecursive(srcDir, destDir);
                console.log(`✅ ${dirKey} 복사: ${destDir}`);
                copiedCount++;
            }
        } else {
            // 디렉토리가 없으면 건너뜀 (정상)
            console.log(`ℹ️  ${dirKey} 없음, 건너뜀`);
        }
    }

    console.log('\n=== 마이그레이션 완료 ===');
    console.log(`✅ 복사된 항목: ${copiedCount}개`);
    console.log(`⏭️  건너뛴 항목: ${skippedCount}개`);
    console.log(`\n전역 디렉토리: ${globalPath}`);
    console.log('\n⚠️  주의: 기존 사용자별 설정은 그대로 유지됩니다.');
    console.log('   서버를 재시작하면 전역 설정이 적용됩니다.\n');
}

// 스크립트 실행
migrateToGlobalSettings()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ 마이그레이션 실패:');
        console.error(error);
        process.exit(1);
    });
