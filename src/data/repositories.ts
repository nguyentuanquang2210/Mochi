import { database, withTransaction } from './database';
import * as Crypto from 'expo-crypto';
import { newFsrsState, schedule } from '../domain/fsrs';
import type { Card, CardSummary, ChartDataPoint, DashboardStats, Deck, FsrsState, LearningObjective, Rating, SavedView } from '../domain/types';

const id = () => Crypto.randomUUID();

const asDeck = (r: any): Deck => ({
  id: r.id,
  name: r.name,
  description: r.description,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

const parseSides = (rawContent: string, front: string, back: string) => {
  const content = rawContent || (back ? `${front}\n---\n${back}` : front);
  const sides = content.split(/\n\s*---\s*\n/).map(s => s.trim()).filter(Boolean);
  return sides.length > 0 ? sides : [front];
};

const asCardSummary = (r: any): CardSummary => {
  const rawContent = r.content || '';
  const sides = parseSides(rawContent, r.front, r.back);
  const hiddenSidesCount = Math.max(0, sides.length - 1);
  const isDue = r.due_at ? r.due_at <= Date.now() : false;
  const isNew = !r.state || r.state === 'new';
  const tags = r.tag_names ? String(r.tag_names).split('|').filter(Boolean) : [];

  return {
    id: r.id,
    deckId: r.deck_id,
    front: r.front,
    back: r.back,
    content: rawContent || (sides.length > 1 ? sides.join('\n---\n') : r.front),
    cardType: r.card_type || 'basic',
    objective: r.objective || 'meaning_en_vi',
    createdAt: r.created_at,
    updatedAt: r.updated_at || r.created_at,
    archivedAt: r.archived_at,
    trashedAt: r.trashed_at,
    isPinned: Boolean(r.is_pinned),
    reviewReverse: Boolean(r.review_reverse),
    ipaUs: r.ipa_us || null,
    ipaUk: r.ipa_uk || null,
    imageUrl: r.image_url || null,
    thumbnailUrl: r.thumbnail_url || null,
    tags,
    sides,
    hiddenSidesCount,
    isDue,
    isNew,
    intervalDays: Math.round(r.scheduled_days ?? 0),
    reps: r.reps ?? 0,
    state: r.state
  };
};

const asState = (r: any): FsrsState => ({
  cardId: r.card_id,
  objective: r.objective,
  state: r.state,
  dueAt: r.due_at,
  stability: r.stability,
  difficulty: r.difficulty,
  elapsedDays: r.elapsed_days,
  scheduledDays: r.scheduled_days,
  reps: r.reps,
  lapses: r.lapses,
  lastReviewAt: r.last_review_at,
  rawJson: r.raw_json
});

export const DeckRepository = {
  async all(): Promise<Deck[]> {
    const db = await database();
    const rows = await db.getAllAsync('SELECT * FROM decks ORDER BY name ASC');
    return rows.map(asDeck);
  },

  async getById(deckId: string): Promise<Deck | null> {
    const db = await database();
    const row = await db.getFirstAsync('SELECT * FROM decks WHERE id = ?', deckId);
    return row ? asDeck(row) : null;
  },

  async create(name: string, description?: string): Promise<Deck> {
    const db = await database();
    const now = Date.now();
    const deck: Deck = { id: id(), name: name.trim(), description: description?.trim() || null, createdAt: now, updatedAt: now };
    await db.runAsync('INSERT INTO decks (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      deck.id, deck.name, deck.description, deck.createdAt, deck.createdAt);
    return deck;
  },

  async update(deckId: string, name: string, description?: string): Promise<void> {
    const db = await database();
    await db.runAsync('UPDATE decks SET name = ?, description = ?, updated_at = ? WHERE id = ?',
      name.trim(), description?.trim() || null, Date.now(), deckId);
  },

  async delete(deckId: string): Promise<void> {
    const db = await database();
    await db.runAsync('DELETE FROM decks WHERE id = ?', deckId);
  }
};

export const TagRepository = {
  async all(): Promise<string[]> {
    const db = await database();
    const rows = await db.getAllAsync<{ name: string }>('SELECT name FROM tags ORDER BY name COLLATE NOCASE');
    return rows.map(x => x.name);
  }
};

export const CardRepository = {
  async create(input: {
    deckId: string;
    content: string;
    tags?: string[];
    isPinned?: boolean;
    reviewReverse?: boolean;
    ipaUs?: string | null;
    ipaUk?: string | null;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
  }): Promise<CardSummary> {
    const now = Date.now();
    const cardId = id();
    const content = input.content.trim();
    const sides = parseSides(content, '', '');
    const front = sides[0] || '';
    const back = sides.slice(1).join('\n---\n') || '';

    const state = await newFsrsState(new Date(now));
    state.cardId = cardId;
    state.objective = 'meaning_en_vi';

    await withTransaction(async tx => {
      await tx.runAsync(
        `INSERT INTO cards (id, deck_id, front, back, content, card_type, objective, created_at, updated_at, archived_at, trashed_at, is_pinned, review_reverse, ipa_us, ipa_uk, image_url, thumbnail_url)
         VALUES (?, ?, ?, ?, ?, 'basic', 'meaning_en_vi', ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
        cardId, input.deckId, front, back, content, now, now, input.isPinned ? 1 : 0, input.reviewReverse ? 1 : 0, input.ipaUs || null, input.ipaUk || null, input.imageUrl || null, input.thumbnailUrl || null
      );
      await persistState(tx, state);

      for (const rawTag of input.tags ?? []) {
        const name = rawTag.replace(/^#/, '').trim().toLowerCase();
        if (!name) continue;
        const tagId = id();
        await tx.runAsync('INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (?, ?, ?)', tagId, name, now);
        const tag = await tx.getFirstAsync<{ id: string }>('SELECT id FROM tags WHERE name = ? COLLATE NOCASE', name);
        if (tag) await tx.runAsync('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)', cardId, tag.id);
      }
    });

    const created = await this.getById(cardId);
    return created!;
  },

  async update(cardId: string, input: {
    deckId?: string;
    content: string;
    tags?: string[];
    isPinned?: boolean;
    reviewReverse?: boolean;
    archivedAt?: number | null;
    ipaUs?: string | null;
    ipaUk?: string | null;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
  }): Promise<void> {
    const now = Date.now();
    const content = input.content.trim();
    const sides = parseSides(content, '', '');
    const front = sides[0] || '';
    const back = sides.slice(1).join('\n---\n') || '';

    await withTransaction(async tx => {
      let query = 'UPDATE cards SET front = ?, back = ?, content = ?, updated_at = ?';
      const args: any[] = [front, back, content, now];

      if (input.deckId) {
        query += ', deck_id = ?';
        args.push(input.deckId);
      }
      if (input.isPinned !== undefined) {
        query += ', is_pinned = ?';
        args.push(input.isPinned ? 1 : 0);
      }
      if (input.reviewReverse !== undefined) {
        query += ', review_reverse = ?';
        args.push(input.reviewReverse ? 1 : 0);
      }
      if (input.archivedAt !== undefined) {
        query += ', archived_at = ?';
        args.push(input.archivedAt);
      }
      if (input.ipaUs !== undefined) {
        query += ', ipa_us = ?';
        args.push(input.ipaUs);
      }
      if (input.ipaUk !== undefined) {
        query += ', ipa_uk = ?';
        args.push(input.ipaUk);
      }
      if (input.imageUrl !== undefined) {
        query += ', image_url = ?';
        args.push(input.imageUrl);
      }
      if (input.thumbnailUrl !== undefined) {
        query += ', thumbnail_url = ?';
        args.push(input.thumbnailUrl);
      }
      query += ' WHERE id = ?';
      args.push(cardId);

      await tx.runAsync(query, ...args);

      if (input.tags) {
        await tx.runAsync('DELETE FROM card_tags WHERE card_id = ?', cardId);
        for (const rawTag of input.tags) {
          const name = rawTag.replace(/^#/, '').trim().toLowerCase();
          if (!name) continue;
          const tagId = id();
          await tx.runAsync('INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (?, ?, ?)', tagId, name, now);
          const tag = await tx.getFirstAsync<{ id: string }>('SELECT id FROM tags WHERE name = ? COLLATE NOCASE', name);
          if (tag) await tx.runAsync('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)', cardId, tag.id);
        }
      }
    });
  },

  async updateIpa(cardId: string, ipaUs: string | null, ipaUk: string | null): Promise<void> {
    const db = await database();
    await db.runAsync(
      'UPDATE cards SET ipa_us = ?, ipa_uk = ?, updated_at = ? WHERE id = ?',
      ipaUs, ipaUk, Date.now(), cardId
    );
  },

  async findByFront(front: string, deckId?: string): Promise<CardSummary | null> {
    const db = await database();
    const clean = front.trim().toLowerCase();
    let query = `
      SELECT c.*,
        GROUP_CONCAT(t.name, '|') as tag_names,
        f.due_at, f.scheduled_days, f.reps, f.state
      FROM cards c
      LEFT JOIN card_tags ct ON ct.card_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      LEFT JOIN fsrs_states f ON f.card_id = c.id AND f.objective = 'meaning_en_vi'
      WHERE LOWER(TRIM(c.front)) = ? AND c.trashed_at IS NULL
    `;
    const args: any[] = [clean];
    if (deckId) {
      query += ' AND c.deck_id = ?';
      args.push(deckId);
    }
    query += ' GROUP BY c.id LIMIT 1';
    const row = await db.getFirstAsync(query, ...args);
    return row ? asCardSummary(row) : null;
  },

  async getById(cardId: string): Promise<CardSummary | null> {
    const db = await database();
    const row = await db.getFirstAsync<any>(
      `SELECT c.*, f.state, f.due_at, f.scheduled_days, f.reps, GROUP_CONCAT(t.name, '|') AS tag_names
       FROM cards c
       LEFT JOIN fsrs_states f ON f.card_id = c.id
       LEFT JOIN card_tags ct ON ct.card_id = c.id
       LEFT JOIN tags t ON t.id = ct.tag_id
       WHERE c.id = ?
       GROUP BY c.id`,
      cardId
    );
    return row ? asCardSummary(row) : null;
  },

  async search(query = '', deckId?: string, tag?: string, filter = 'all'): Promise<CardSummary[]> {
    const db = await database();
    const filters: string[] = ['c.trashed_at IS NULL'];
    const args: (string | number)[] = [];

    if (query.trim()) {
      const needle = `%${query.trim()}%`;
      filters.push('(c.front LIKE ? OR c.back LIKE ? OR c.content LIKE ?)');
      args.push(needle, needle, needle);
    }

    if (deckId) {
      filters.push('c.deck_id = ?');
      args.push(deckId);
    }

    if (filter === 'new') {
      filters.push("(f.state IS NULL OR f.state = 'new')");
    } else if (filter === 'due') {
      filters.push('f.due_at <= ?');
      args.push(Date.now());
    } else if (filter === 'learned') {
      filters.push("f.state IN ('learning', 'review', 'relearning')");
    } else if (filter === 'pinned') {
      filters.push('c.is_pinned = 1');
    } else if (filter === 'archived') {
      filters.push('c.archived_at IS NOT NULL');
    } else {
      // By default do not show archived in normal view
      filters.push('c.archived_at IS NULL');
    }

    let sql = `
      SELECT c.*, f.state, f.due_at, f.scheduled_days, f.reps, GROUP_CONCAT(t.name, '|') AS tag_names
      FROM cards c
      LEFT JOIN fsrs_states f ON f.card_id = c.id
      LEFT JOIN card_tags ct ON ct.card_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      WHERE ${filters.join(' AND ')}
      GROUP BY c.id
    `;

    if (tag) {
      sql += ` HAVING tag_names LIKE '%${tag}%'`;
    }

    sql += ' ORDER BY c.is_pinned DESC, c.updated_at DESC LIMIT 200';

    const rows = await db.getAllAsync<any>(sql, ...args);
    return rows.map(asCardSummary);
  },

  async getDueCards(deckId?: string, newCardsLimit = 20): Promise<{ card: CardSummary; state: FsrsState }[]> {
    const db = await database();
    const filters = ['c.trashed_at IS NULL', 'c.archived_at IS NULL'];
    const args: any[] = [];

    if (deckId) {
      filters.push('c.deck_id = ?');
      args.push(deckId);
    }

    // 1. Lấy toàn bộ thẻ đến hạn ôn tập hôm nay (bắt buộc phải ôn để không quên)
    const dueSql = `
      SELECT c.*, f.*, GROUP_CONCAT(t.name, '|') AS tag_names
      FROM cards c
      JOIN fsrs_states f ON f.card_id = c.id
      LEFT JOIN card_tags ct ON ct.card_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      WHERE ${filters.join(' AND ')} AND f.state != 'new' AND f.due_at <= ?
      GROUP BY c.id
      ORDER BY f.due_at ASC
    `;
    const dueRows = await db.getAllAsync<any>(dueSql, ...args, Date.now() + 60000);

    // 2. Lấy thẻ mới (tối đa newCardsLimit để không làm ngợp người học khi kho có nhiều thẻ)
    const newSql = `
      SELECT c.*, f.*, GROUP_CONCAT(t.name, '|') AS tag_names
      FROM cards c
      JOIN fsrs_states f ON f.card_id = c.id
      LEFT JOIN card_tags ct ON ct.card_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      WHERE ${filters.join(' AND ')} AND (f.state IS NULL OR f.state = 'new')
      GROUP BY c.id
      ORDER BY c.created_at ASC
      LIMIT ?
    `;
    const newRows = await db.getAllAsync<any>(newSql, ...args, newCardsLimit);

    const combined = [...dueRows, ...newRows];
    return combined.map(r => ({
      card: asCardSummary(r),
      state: asState(r)
    }));
  },

  async getNewCards(deckId?: string): Promise<{ card: CardSummary; state: FsrsState }[]> {
    const db = await database();
    const filters = ['c.trashed_at IS NULL', 'c.archived_at IS NULL', "(f.state IS NULL OR f.state = 'new')"];
    const args: any[] = [];

    if (deckId) {
      filters.push('c.deck_id = ?');
      args.push(deckId);
    }

    const sql = `
      SELECT c.*, f.*, GROUP_CONCAT(t.name, '|') AS tag_names
      FROM cards c
      JOIN fsrs_states f ON f.card_id = c.id
      LEFT JOIN card_tags ct ON ct.card_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      WHERE ${filters.join(' AND ')}
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `;

    const rows = await db.getAllAsync<any>(sql, ...args);
    return rows.map(r => ({
      card: asCardSummary(r),
      state: asState(r)
    }));
  },

  async getCramCards(deckId?: string): Promise<{ card: CardSummary; state: FsrsState }[]> {
    const db = await database();
    const filters = ['c.trashed_at IS NULL', 'c.archived_at IS NULL'];
    const args: any[] = [];

    if (deckId) {
      filters.push('c.deck_id = ?');
      args.push(deckId);
    }

    const sql = `
      SELECT c.*, f.*, GROUP_CONCAT(t.name, '|') AS tag_names
      FROM cards c
      JOIN fsrs_states f ON f.card_id = c.id
      LEFT JOIN card_tags ct ON ct.card_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      WHERE ${filters.join(' AND ')}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;

    const rows = await db.getAllAsync<any>(sql, ...args);
    return rows.map(r => ({
      card: asCardSummary(r),
      state: asState(r)
    }));
  },

  async resetDeckReviewHistory(deckId: string): Promise<void> {
    const db = await database();
    const freshState = await newFsrsState();
    await withTransaction(async tx => {
      await tx.runAsync(
        `UPDATE fsrs_states SET
           state = 'new',
           reps = 0,
           lapses = 0,
           scheduled_days = 0,
           elapsed_days = 0,
           stability = 0,
           difficulty = 0,
           due_at = ?,
           last_review_at = NULL,
           raw_json = ?
         WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)`,
        Date.now(),
        freshState.rawJson,
        deckId
      );
      await tx.runAsync(
        `DELETE FROM review_logs WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)`,
        deckId
      );
    });
  },

  async countDue(deckId?: string, newCardsLimit = 20): Promise<number> {
    const db = await database();
    const filters = ['c.trashed_at IS NULL', 'c.archived_at IS NULL'];
    const args: any[] = [];
    if (deckId) {
      filters.push('c.deck_id = ?');
      args.push(deckId);
    }

    // Đếm thẻ đến hạn
    const dueRow = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM cards c JOIN fsrs_states f ON f.card_id = c.id WHERE ${filters.join(' AND ')} AND f.state != 'new' AND f.due_at <= ?`,
      ...args, Date.now()
    );
    const dueCount = dueRow?.count ?? 0;

    // Đếm thẻ mới (giới hạn tối đa newCardsLimit trong mục tiêu ngày)
    const newRow = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM cards c JOIN fsrs_states f ON f.card_id = c.id WHERE ${filters.join(' AND ')} AND (f.state IS NULL OR f.state = 'new')`,
      ...args
    );
    const newCount = Math.min(newRow?.count ?? 0, newCardsLimit);

    return dueCount + newCount;
  },

  async countNew(deckId?: string): Promise<number> {
    const db = await database();
    let sql = `
      SELECT COUNT(*) as count
      FROM cards c
      JOIN fsrs_states f ON f.card_id = c.id
      WHERE c.trashed_at IS NULL AND c.archived_at IS NULL AND (f.state IS NULL OR f.state = 'new')
    `;
    const args: any[] = [];
    if (deckId) {
      sql += ' AND c.deck_id = ?';
      args.push(deckId);
    }
    const row = await db.getFirstAsync<{ count: number }>(sql, ...args);
    return row?.count ?? 0;
  },

  async countTrashed(): Promise<number> {
    const db = await database();
    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cards WHERE trashed_at IS NOT NULL');
    return row?.count ?? 0;
  },

  async getTrashedCards(): Promise<CardSummary[]> {
    const db = await database();
    const rows = await db.getAllAsync<any>(
      `SELECT c.*, f.state, f.due_at, f.scheduled_days, GROUP_CONCAT(t.name, '|') AS tag_names
       FROM cards c
       LEFT JOIN fsrs_states f ON f.card_id = c.id
       LEFT JOIN card_tags ct ON ct.card_id = c.id
       LEFT JOIN tags t ON t.id = ct.tag_id
       WHERE c.trashed_at IS NOT NULL
       GROUP BY c.id
       ORDER BY c.trashed_at DESC`
    );
    return rows.map(asCardSummary);
  },

  async moveToTrash(cardId: string): Promise<void> {
    const db = await database();
    await db.runAsync('UPDATE cards SET trashed_at = ?, updated_at = ? WHERE id = ?', Date.now(), Date.now(), cardId);
  },

  async restoreFromTrash(cardId: string): Promise<void> {
    const db = await database();
    await db.runAsync('UPDATE cards SET trashed_at = NULL, updated_at = ? WHERE id = ?', Date.now(), cardId);
  },

  async permanentDelete(cardId: string): Promise<void> {
    const db = await database();
    await db.runAsync('DELETE FROM cards WHERE id = ?', cardId);
  },

  async emptyTrash(): Promise<void> {
    const db = await database();
    await db.runAsync('DELETE FROM cards WHERE trashed_at IS NOT NULL');
  },

  async duplicate(cardId: string): Promise<CardSummary | null> {
    const card = await this.getById(cardId);
    if (!card) return null;
    return this.create({
      deckId: card.deckId,
      content: card.content,
      tags: card.tags,
      isPinned: card.isPinned,
      reviewReverse: card.reviewReverse
    });
  },

  async togglePin(cardId: string): Promise<boolean> {
    const db = await database();
    const card = await this.getById(cardId);
    if (!card) return false;
    const next = !card.isPinned;
    await db.runAsync('UPDATE cards SET is_pinned = ?, updated_at = ? WHERE id = ?', next ? 1 : 0, Date.now(), cardId);
    return next;
  },

  async toggleReviewReverse(cardId: string): Promise<boolean> {
    const db = await database();
    const card = await this.getById(cardId);
    if (!card) return false;
    const next = !card.reviewReverse;
    await db.runAsync('UPDATE cards SET review_reverse = ?, updated_at = ? WHERE id = ?', next ? 1 : 0, Date.now(), cardId);
    return next;
  },

  async toggleArchive(cardId: string): Promise<boolean> {
    const db = await database();
    const card = await this.getById(cardId);
    if (!card) return false;
    const nextArchived = card.archivedAt ? null : Date.now();
    await db.runAsync('UPDATE cards SET archived_at = ?, updated_at = ? WHERE id = ?', nextArchived, Date.now(), cardId);
    return nextArchived !== null;
  },

  async moveToDeck(cardId: string, targetDeckId: string): Promise<void> {
    const db = await database();
    await db.runAsync('UPDATE cards SET deck_id = ?, updated_at = ? WHERE id = ?', targetDeckId, Date.now(), cardId);
  },

  async review(card: CardSummary, state: FsrsState, rating: Rating): Promise<FsrsState> {
    const reviewedAt = Date.now();
    const next = await schedule(state, rating, new Date(reviewedAt));

    // BẢO VỆ CHỐNG OVER-SCHEDULING TRONG CÙNG NGÀY (Same-day Review Protection):
    // Trong Spaced Repetition (Mochi Cards / Anki), nếu thẻ đã được học và lên lịch trong ngày hôm nay (< 12 giờ),
    // việc người dùng ôn lại hoặc bấm 'good' liên tục trong cùng ngày KHÔNG được nhân dồn khoảng cách (từ 4 ngày -> 12 ngày -> 23 ngày).
    // Chỉ khi đến đúng ngày hẹn (due_at) và người dùng ôn lại, khoảng cách mới chính thức được nhân tiếp.
    const isSameDayReview = Boolean(
      state.lastReviewAt &&
      (reviewedAt - state.lastReviewAt < 12 * 3600 * 1000) &&
      state.state !== 'new' &&
      state.scheduledDays > 0
    );

    let finalState = next.state;
    if (isSameDayReview && rating === 'good') {
      // Giữ nguyên khoảng cách ngày hẹn đã lên lịch trước đó, không nhân dồn thêm chu kỳ mới
      finalState = {
        ...next.state,
        scheduledDays: state.scheduledDays,
        dueAt: state.dueAt
      };
    }

    await withTransaction(async tx => {
      await persistState(tx, finalState);
      await tx.runAsync(
        `INSERT INTO review_logs (id, card_id, objective, rating, reviewed_at, state_before, state_after, scheduled_days, elapsed_days, review_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id(), card.id, card.objective, rating, reviewedAt, state.state, finalState.state, finalState.scheduledDays, next.state.elapsedDays, JSON.stringify(next.review)
      );
    });
    return finalState;
  },

  async rollbackState(state: FsrsState): Promise<void> {
    await withTransaction(async tx => {
      await persistState(tx, state);
      // Xóa log ôn tập mới nhất của thẻ này khi người dùng hoàn tác (Undo)
      await tx.runAsync(
        'DELETE FROM review_logs WHERE id IN (SELECT id FROM review_logs WHERE card_id = ? ORDER BY reviewed_at DESC LIMIT 1)',
        state.cardId
      );
    });
  },

  async getDashboardStats(deckId?: string): Promise<DashboardStats> {
    const db = await database();
    const now = Date.now();
    const oneDayMs = 86400000;

    // 1. Real Cards Learned
    let learnedSql = `
      SELECT COUNT(*) as count FROM cards c
      JOIN fsrs_states f ON f.card_id = c.id
      WHERE c.trashed_at IS NULL AND f.state IN ('learning', 'review', 'relearning')
    `;
    if (deckId) learnedSql += ` AND c.deck_id = '${deckId}'`;
    const learnedRow = await db.getFirstAsync<{ count: number }>(learnedSql);
    const cardsLearned = learnedRow?.count ?? 0;

    // Total cards
    let totalCardsSql = 'SELECT COUNT(*) as count FROM cards WHERE trashed_at IS NULL';
    if (deckId) totalCardsSql += ` AND deck_id = '${deckId}'`;
    const totalCardsRow = await db.getFirstAsync<{ count: number }>(totalCardsSql);
    const cardsLearnedTotal = totalCardsRow?.count ?? cardsLearned;

    // 2. Real Total Reviews & Retention
    let reviewSql = `
      SELECT COUNT(*) as count, rating
      FROM review_logs rl
      JOIN cards c ON c.id = rl.card_id
      WHERE c.trashed_at IS NULL
    `;
    if (deckId) reviewSql += ` AND c.deck_id = '${deckId}'`;
    reviewSql += ' GROUP BY rating';

    const reviewRows = await db.getAllAsync<{ count: number; rating: string }>(reviewSql);
    let totalReviews = 0;
    let successfulReviews = 0;
    for (const r of reviewRows) {
      totalReviews += r.count;
      if (r.rating === 'good' || r.rating === 'easy') {
        successfulReviews += r.count;
      }
    }
    const retentionRate = totalReviews > 0 ? Math.round((successfulReviews / totalReviews) * 100) : 100;

    // 3. Real Heatmap data & Review logs
    let logsSql = `
      SELECT rl.reviewed_at, rl.rating
      FROM review_logs rl
      JOIN cards c ON c.id = rl.card_id
      WHERE c.trashed_at IS NULL AND rl.reviewed_at >= ?
    `;
    if (deckId) logsSql += ` AND c.deck_id = '${deckId}'`;
    logsSql += ' ORDER BY rl.reviewed_at ASC';

    const logs = await db.getAllAsync<{ reviewed_at: number; rating: string }>(logsSql, now - 365 * oneDayMs);

    const activityHeatmap: { [dateStr: string]: number } = {};
    const dailyReviewsCount: { [dateStr: string]: number } = {};
    const dailySuccessCount: { [dateStr: string]: number } = {};
    const activeDaysSet = new Set<string>();

    for (const log of logs) {
      const d = new Date(log.reviewed_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      activityHeatmap[key] = (activityHeatmap[key] || 0) + 1;
      dailyReviewsCount[key] = (dailyReviewsCount[key] || 0) + 1;
      if (log.rating === 'good' || log.rating === 'easy') {
        dailySuccessCount[key] = (dailySuccessCount[key] || 0) + 1;
      }
      activeDaysSet.add(key);
    }

    // 4. Streak Calculation (Duolingo style)
    const today = new Date(now);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(now - oneDayMs);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const isStreakActiveToday = activeDaysSet.has(todayStr);
    let streakDays = 0;
    let isStreakFrozen = false;

    if (isStreakActiveToday) {
      streakDays = 1;
      let checkDate = new Date(now - oneDayMs);
      while (true) {
        const checkKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        if (activeDaysSet.has(checkKey)) {
          streakDays++;
          checkDate = new Date(checkDate.getTime() - oneDayMs);
        } else {
          break;
        }
      }
      isStreakFrozen = false;
    } else if (activeDaysSet.has(yesterdayStr)) {
      streakDays = 1;
      let checkDate = new Date(now - 2 * oneDayMs);
      while (true) {
        const checkKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        if (activeDaysSet.has(checkKey)) {
          streakDays++;
          checkDate = new Date(checkDate.getTime() - oneDayMs);
        } else {
          break;
        }
      }
      isStreakFrozen = true; // Ice blue frozen flame! Needs study today to unfreeze
    } else {
      streakDays = 0;
      isStreakFrozen = true;
    }

    // 5. Chart 1: Reviews Per Day (Last 7 days)
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const reviewsChart: ChartDataPoint[] = [];
    const retentionChart: ChartDataPoint[] = [];
    const reviewTimeChart: ChartDataPoint[] = [];
    const cumulativeLearnedChart: ChartDataPoint[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * oneDayMs);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayLabel = i === 0 ? 'H.nay' : dayNames[d.getDay()];
      const dayReviews = dailyReviewsCount[key] || 0;
      const daySuccess = dailySuccessCount[key] || 0;
      const dayRetention = dayReviews > 0 ? Math.round((daySuccess / dayReviews) * 100) : 0;
      // Thời gian ôn thực tế ước tính (khoảng 15s/thẻ) ra số phút
      const timeInMinutes = Math.round(((dayReviews * 15) / 60) * 10) / 10;

      reviewsChart.push({ label: dayLabel, value: dayReviews, dateStr: key });
      retentionChart.push({ label: dayLabel, value: dayRetention, dateStr: key });
      reviewTimeChart.push({ label: dayLabel, value: timeInMinutes, dateStr: key });

      // Lấy số thẻ tích lũy thật đã học tính đến hết ngày này
      const endOfThisDay = new Date(d);
      endOfThisDay.setHours(23, 59, 59, 999);
      let cumSql = `
        SELECT COUNT(DISTINCT rl.card_id) as count
        FROM review_logs rl
        JOIN cards c ON c.id = rl.card_id
        WHERE c.trashed_at IS NULL AND rl.reviewed_at <= ?
      `;
      if (deckId) cumSql += ` AND c.deck_id = '${deckId}'`;
      const cumRow = await db.getFirstAsync<{ count: number }>(cumSql, endOfThisDay.getTime());
      cumulativeLearnedChart.push({ label: dayLabel, value: cumRow?.count ?? 0, dateStr: key });
    }

    // 6. Chart: Review Forecast (Upcoming 7 days due)
    const reviewForecastChart: ChartDataPoint[] = [];
    for (let i = 0; i < 7; i++) {
      const startOfDay = new Date(now + i * oneDayMs);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now + i * oneDayMs);
      endOfDay.setHours(23, 59, 59, 999);

      let forecastSql = `
        SELECT COUNT(*) as count FROM fsrs_states f
        JOIN cards c ON c.id = f.card_id
        WHERE c.trashed_at IS NULL AND f.due_at BETWEEN ? AND ?
      `;
      if (deckId) forecastSql += ` AND c.deck_id = '${deckId}'`;

      const forecastRow = await db.getFirstAsync<{ count: number }>(forecastSql, startOfDay.getTime(), endOfDay.getTime());
      const label = i === 0 ? 'H.nay' : i === 1 ? 'M.mai' : dayNames[startOfDay.getDay()];
      reviewForecastChart.push({
        label,
        value: forecastRow?.count || 0
      });
    }

    // 7. Chart: Intervals Distribution (Dữ liệu thật từ fsrs_states)
    let intervalsSql = `
      SELECT scheduled_days FROM fsrs_states f
      JOIN cards c ON c.id = f.card_id
      WHERE c.trashed_at IS NULL
    `;
    if (deckId) intervalsSql += ` AND c.deck_id = '${deckId}'`;
    const intervalRows = await db.getAllAsync<{ scheduled_days: number }>(intervalsSql);

    let bucketUnder1 = 0;
    let bucket1to3 = 0;
    let bucket4to7 = 0;
    let bucket8to14 = 0;
    let bucket15to30 = 0;
    let bucketOver30 = 0;

    for (const row of intervalRows) {
      const days = row.scheduled_days || 0;
      if (days < 1) bucketUnder1++;
      else if (days <= 3) bucket1to3++;
      else if (days <= 7) bucket4to7++;
      else if (days <= 14) bucket8to14++;
      else if (days <= 30) bucket15to30++;
      else bucketOver30++;
    }

    const intervalsDistribution: ChartDataPoint[] = [
      { label: '<1d', value: bucketUnder1 },
      { label: '1-3d', value: bucket1to3 },
      { label: '4-7d', value: bucket4to7 },
      { label: '8-14d', value: bucket8to14 },
      { label: '15-30d', value: bucket15to30 },
      { label: '>30d', value: bucketOver30 }
    ];

    const streakFrozenDates: string[] = [];
    if (!isStreakActiveToday) {
      streakFrozenDates.push(todayStr);
    }

    const cardsDueCount = await this.countDue(deckId);

    // Tính tổng số ngày kể từ ngày ôn tập đầu tiên
    let oldestReviewSql = 'SELECT MIN(reviewed_at) as oldest FROM review_logs';
    const oldestRow = await db.getFirstAsync<{ oldest: number | null }>(oldestReviewSql);
    const oldestTime = oldestRow?.oldest || now;
    const totalDaysSpan = Math.max(1, Math.ceil((now - oldestTime) / oneDayMs));

    return {
      cardsLearned,
      retentionRate,
      totalReviews,
      cardsDueCount,
      activeDaysCount: activeDaysSet.size,
      totalDaysSpan,
      totalReviewYearCount: logs.length,
      cardsLearnedTotal,
      activityHeatmap,
      streakDays,
      isStreakActiveToday,
      isStreakFrozen,
      activeDates: Array.from(activeDaysSet),
      streakFrozenDates,
      cumulativeLearnedChart,
      reviewsChart,
      retentionChart,
      reviewTimeChart,
      reviewForecastChart,
      intervalsDistribution
    };
  }
};

export const ViewRepository = {
  async all(): Promise<SavedView[]> {
    const db = await database();
    const rows = await db.getAllAsync<any>('SELECT * FROM saved_views ORDER BY name COLLATE NOCASE');
    return rows.map(r => ({ id: r.id, name: r.name, query: JSON.parse(r.query_json), createdAt: r.created_at }));
  },
  async create(name: string, query: SavedView['query']): Promise<SavedView> {
    const db = await database();
    const now = Date.now();
    const view = { id: id(), name: name.trim(), query, createdAt: now };
    await db.runAsync('INSERT INTO saved_views (id, name, query_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      view.id, view.name, JSON.stringify(query), now, now);
    return view;
  }
};

async function persistState(tx: any, s: FsrsState) {
  await tx.runAsync(
    `INSERT INTO fsrs_states (card_id, objective, state, due_at, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, last_review_at, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(card_id, objective) DO UPDATE SET
       state = excluded.state,
       due_at = excluded.due_at,
       stability = excluded.stability,
       difficulty = excluded.difficulty,
       elapsed_days = excluded.elapsed_days,
       scheduled_days = excluded.scheduled_days,
       reps = excluded.reps,
       lapses = excluded.lapses,
       last_review_at = excluded.last_review_at,
       raw_json = excluded.raw_json`,
    s.cardId, s.objective, s.state, s.dueAt, s.stability, s.difficulty, s.elapsedDays, s.scheduledDays, s.reps, s.lapses, s.lastReviewAt, s.rawJson
  );
}
