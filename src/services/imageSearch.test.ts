import { describe, expect, it, vi } from 'vitest';

vi.mock('../data/database', () => ({
  database: vi.fn().mockResolvedValue({
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    runAsync: vi.fn().mockResolvedValue(null)
  })
}));

import { ImageSearchService } from './imageSearch';

describe('ImageSearchService', () => {
  it('should search images from Wikimedia Commons for common vocabulary', async () => {
    const images = await ImageSearchService.searchImages('umbrella', 'chiếc ô');
    expect(Array.isArray(images)).toBe(true);
    if (images.length > 0) {
      expect(images[0]).toHaveProperty('url');
      expect(images[0]).toHaveProperty('thumbnailUrl');
      expect(images[0].source).toBe('wikimedia');
    }
  });

  it('should handle multi-word context gracefully', async () => {
    const images = await ImageSearchService.searchImages('station', 'ga tàu điện');
    expect(Array.isArray(images)).toBe(true);
  });
});
