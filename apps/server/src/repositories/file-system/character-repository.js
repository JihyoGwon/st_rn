/**
 * FileSystem Character Repository 구현
 * 기존 파일시스템 로직을 래핑
 */

import path from 'node:path';
import fs from 'node:fs';
import { getUserDirectories } from '../../users.js';
import { readCharacterData } from '../../endpoints/characters.js';

export class FileSystemCharacterRepository {
  async getAll(userId, shallow = false) {
    const directories = getUserDirectories(userId);
    
    if (!fs.existsSync(directories.characters)) {
      return [];
    }

    const files = fs.readdirSync(directories.characters);
    const pngFiles = files.filter(file => file.endsWith('.png'));

    const characters = [];

    for (const file of pngFiles) {
      try {
        const character = await this.get(file, userId);
        if (character) {
          characters.push(character);
        }
      } catch (error) {
        console.error(`Failed to load character ${file}:`, error);
      }
    }

    return characters;
  }

  async get(characterId, userId) {
    const directories = getUserDirectories(userId);
    const imgFile = path.join(directories.characters, characterId);

    if (!fs.existsSync(imgFile)) {
      return null;
    }

    try {
      const imgData = await readCharacterData(imgFile);
      if (!imgData) {
        return null;
      }

      const jsonObject = JSON.parse(imgData);
      const charStat = fs.statSync(imgFile);

      // 채팅 디렉토리 확인
      const chatsDirectory = path.join(directories.chats, characterId.replace('.png', ''));
      let chatSize = 0;
      let dateLastChat;

      if (fs.existsSync(chatsDirectory)) {
        const chatFiles = fs.readdirSync(chatsDirectory);
        chatSize = chatFiles.filter(f => f.endsWith('.jsonl')).length;
        // 마지막 채팅 날짜는 간단히 파일 수정 시간으로 대체
        if (chatSize > 0) {
          const chatFilesWithStats = chatFiles.map(f => ({
            name: f,
            mtime: fs.statSync(path.join(chatsDirectory, f)).mtimeMs
          }));
          dateLastChat = Math.max(...chatFilesWithStats.map(f => f.mtime));
        }
      }

      return {
        id: characterId,
        userId,
        characterName: jsonObject.data?.name || jsonObject.name || characterId,
        characterData: jsonObject,
        avatar: characterId,
        jsonData: imgData,
        dateAdded: Math.floor(charStat.ctimeMs), // 정수로 변환 (BIGINT용)
        createDate: jsonObject.create_date || new Date(charStat.ctimeMs).toISOString(),
        chatSize,
        dateLastChat: dateLastChat ? Math.floor(dateLastChat) : undefined, // 정수로 변환
        dataSize: JSON.stringify(jsonObject).length,
      };
    } catch (error) {
      console.error(`Failed to read character ${characterId}:`, error);
      return null;
    }
  }

  async save(characterId, userId, data) {
    // 파일시스템 저장은 characters.js의 writeCharacterData()에서 이미 처리됨
    // 하이브리드 모드에서는 DB 저장 후 호출되므로, 여기서는 아무것도 하지 않음
    // (이미 writeCharacterData()로 저장되어 있음)
    return;
  }

  async delete(characterId, userId) {
    const directories = getUserDirectories(userId);
    const imgFile = path.join(directories.characters, characterId);

    if (fs.existsSync(imgFile)) {
      fs.unlinkSync(imgFile);
    }
  }

  async exists(characterId, userId) {
    const directories = getUserDirectories(userId);
    const imgFile = path.join(directories.characters, characterId);
    return fs.existsSync(imgFile);
  }
}
