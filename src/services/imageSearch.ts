import { database } from '../data/database';
import type { ImageItem } from '../domain/types';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

export class ImageSearchService {
  /**
   * Tìm kiếm hình ảnh minh họa theo từ vựng tiếng Anh và ngữ cảnh nghĩa
   */
  static async searchImages(word: string, meaningContext?: string): Promise<ImageItem[]> {
    const cleanWord = (word || '').trim().toLowerCase();
    if (!cleanWord) return [];

    const cacheKey = `${cleanWord}:${(meaningContext || '').trim().toLowerCase()}`;

    // 1. Kiểm tra cache trong CSDL SQLite cục bộ
    try {
      const db = await database();
      const cached = await db.getFirstAsync<{ images_json: string; created_at: number }>(
        'SELECT images_json, created_at FROM image_cache WHERE keyword = ?',
        cacheKey
      );
      if (cached && Date.now() - cached.created_at < CACHE_TTL_MS) {
        const parsed = JSON.parse(cached.images_json) as ImageItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Image cache read error:', e);
    }

    // 2. Tạo từ khóa tìm kiếm theo ngữ cảnh nghĩa
    const query = this.buildContextQuery(cleanWord, meaningContext);

    // 3. Gọi Wikimedia Commons API (Miễn phí 100%, không cần API Key, không giới hạn lượt gọi)
    let images: ImageItem[] = await this.fetchFromWikimedia(query);

    // Nếu tìm theo ngữ cảnh không có ảnh, thử tìm lại chỉ với từ gốc
    if (images.length === 0 && query !== cleanWord) {
      images = await this.fetchFromWikimedia(cleanWord);
    }

    // 4. Lưu cache nếu tìm thấy kết quả
    if (images.length > 0) {
      try {
        const db = await database();
        await db.runAsync(
          'INSERT OR REPLACE INTO image_cache (keyword, images_json, created_at) VALUES (?, ?, ?)',
          cacheKey,
          JSON.stringify(images),
          Date.now()
        );
      } catch (e) {
        console.warn('Image cache save error:', e);
      }
    }

    return images;
  }

  /**
   * Tạo từ khóa tìm kiếm tiếng Anh bổ trợ từ nghĩa tiếng Việt
   */
  private static buildContextQuery(word: string, meaning?: string): string {
    if (!meaning) return word;

    const lowerMeaning = meaning.toLowerCase();
    // Một số ngữ cảnh phổ biến để bổ sung vào search query
    if (lowerMeaning.includes('ô') || lowerMeaning.includes('dù')) return `${word} rain`;
    if (lowerMeaning.includes('địa chỉ') || lowerMeaning.includes('thư')) return `${word} street envelope`;
    if (lowerMeaning.includes('phát biểu') || lowerMeaning.includes('diễn thuyết')) return `${word} speech podium`;
    if (lowerMeaning.includes('mua lại') || lowerMeaning.includes('sáp nhập')) return `${word} business contract`;
    if (lowerMeaning.includes('hội nghị') || lowerMeaning.includes('họp')) return `${word} meeting conference`;
    if (lowerMeaning.includes('vỉa hè')) return `${word} sidewalk street`;
    if (lowerMeaning.includes('sân trong')) return `${word} building courtyard`;
    if (lowerMeaning.includes('tủ lạnh')) return `${word} kitchen`;

    return word;
  }

  /**
   * Gọi Wikimedia Commons API lấy ảnh chất lượng cao
   */
  private static async fetchFromWikimedia(searchTerm: string): Promise<ImageItem[]> {
    try {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
        searchTerm
      )}&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=500&format=json`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MochiEnglishLearningApp/1.0 (free education flashcards)'
        }
      });

      if (!response.ok) return [];

      const data = await response.json();
      const pages = data.query?.pages;
      if (!pages) return [];

      const items: ImageItem[] = [];

      for (const key of Object.keys(pages)) {
        const page = pages[key];
        const imageInfo = page.imageinfo?.[0];
        if (!imageInfo) continue;

        const originalUrl: string = imageInfo.url || '';
        const thumbUrl: string = imageInfo.thumburl || originalUrl;
        const title: string = (page.title || '').replace(/^File:/i, '').replace(/\.[^/.]+$/, '');

        // Bỏ qua các file âm thanh, tài liệu hoặc svg phức tạp
        const lowerUrl = originalUrl.toLowerCase();
        if (
          lowerUrl.endsWith('.ogg') ||
          lowerUrl.endsWith('.ogv') ||
          lowerUrl.endsWith('.pdf') ||
          lowerUrl.endsWith('.tif') ||
          lowerUrl.endsWith('.tiff') ||
          lowerUrl.endsWith('.svg')
        ) {
          continue;
        }

        items.push({
          id: String(page.pageid || key),
          url: originalUrl,
          thumbnailUrl: thumbUrl,
          title,
          source: 'wikimedia'
        });

        if (items.length >= 6) break;
      }

      return items;
    } catch (err) {
      console.warn('Wikimedia fetch error:', err);
      return [];
    }
  }
}

