import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { TOEIC_MAP } from './toeicWordlist';

let db: SQLite.SQLiteDatabase | null = null;

export async function database() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('english-learning.db');
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      content TEXT,
      card_type TEXT NOT NULL,
      objective TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived_at INTEGER,
      trashed_at INTEGER,
      is_pinned INTEGER DEFAULT 0,
      review_reverse INTEGER DEFAULT 0,
      ipa_us TEXT,
      ipa_uk TEXT
    );
    CREATE TABLE IF NOT EXISTS fsrs_states (
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      objective TEXT NOT NULL,
      state TEXT NOT NULL,
      due_at INTEGER NOT NULL,
      stability REAL NOT NULL,
      difficulty REAL NOT NULL,
      elapsed_days INTEGER NOT NULL,
      scheduled_days INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      lapses INTEGER NOT NULL,
      last_review_at INTEGER,
      raw_json TEXT NOT NULL,
      PRIMARY KEY(card_id, objective)
    );
    CREATE TABLE IF NOT EXISTS review_logs (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      objective TEXT NOT NULL,
      rating TEXT NOT NULL,
      reviewed_at INTEGER NOT NULL,
      state_before TEXT NOT NULL,
      state_after TEXT NOT NULL,
      scheduled_days INTEGER NOT NULL,
      elapsed_days INTEGER NOT NULL,
      review_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS card_tags (card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(card_id, tag_id));
    CREATE TABLE IF NOT EXISTS saved_views (id TEXT PRIMARY KEY, name TEXT NOT NULL, query_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS note_links (source_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, target_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, PRIMARY KEY(source_card_id, target_card_id));
    CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      deck_id TEXT,
      review_mode TEXT NOT NULL,
      queue_json TEXT NOT NULL,
      current_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_study_sessions_active ON study_sessions(deck_id, review_mode, completed_at, updated_at);
    CREATE TABLE IF NOT EXISTS learning_load_history (
      id TEXT PRIMARY KEY,
      recorded_at INTEGER NOT NULL,
      suggested_new_limit INTEGER NOT NULL,
      actual_new_count INTEGER NOT NULL DEFAULT 0,
      due_count INTEGER NOT NULL DEFAULT 0,
      rereview_count INTEGER NOT NULL DEFAULT 0,
      study_seconds INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id, archived_at, trashed_at);
    CREATE INDEX IF NOT EXISTS idx_cards_search ON cards(front, back, content);
    CREATE INDEX IF NOT EXISTS idx_card_tags_tag ON card_tags(tag_id, card_id);
    CREATE INDEX IF NOT EXISTS idx_fsrs_due ON fsrs_states(objective, due_at);
    CREATE INDEX IF NOT EXISTS idx_review_logs_card ON review_logs(card_id, reviewed_at);
  `);

  // Safe migration for any columns added later
  await safeMigrate(db);
  // Seed sample data if empty
  await seedInitialDataIfEmpty(db);

  return db;
}

async function safeMigrate(connection: SQLite.SQLiteDatabase) {
  const tableInfo = await connection.getAllAsync<{ name: string }>('PRAGMA table_info(cards);');
  const cols = new Set(tableInfo.map(c => c.name));
  if (!cols.has('content')) {
    await connection.execAsync('ALTER TABLE cards ADD COLUMN content TEXT;');
  }
  if (!cols.has('trashed_at')) {
    await connection.execAsync('ALTER TABLE cards ADD COLUMN trashed_at INTEGER;');
  }
  if (!cols.has('is_pinned')) {
    await connection.execAsync('ALTER TABLE cards ADD COLUMN is_pinned INTEGER DEFAULT 0;');
  }
  if (!cols.has('review_reverse')) {
    await connection.execAsync('ALTER TABLE cards ADD COLUMN review_reverse INTEGER DEFAULT 0;');
  }
  if (!cols.has('ipa_us')) {
    await connection.execAsync('ALTER TABLE cards ADD COLUMN ipa_us TEXT;');
  }
  if (!cols.has('ipa_uk')) {
    await connection.execAsync('ALTER TABLE cards ADD COLUMN ipa_uk TEXT;');
  }
  if (!cols.has('image_url')) {
    await connection.execAsync('ALTER TABLE cards ADD COLUMN image_url TEXT;');
  }
  if (!cols.has('thumbnail_url')) {
    await connection.execAsync('ALTER TABLE cards ADD COLUMN thumbnail_url TEXT;');
  }
  await connection.execAsync(`
    CREATE TABLE IF NOT EXISTS dictionary_cache (
      word TEXT PRIMARY KEY COLLATE NOCASE,
      ipa_us TEXT,
      ipa_uk TEXT,
      phonetic TEXT,
      data_json TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dict_word ON dictionary_cache(word);

    CREATE TABLE IF NOT EXISTS image_cache (
      keyword TEXT PRIMARY KEY COLLATE NOCASE,
      images_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_img_keyword ON image_cache(keyword);
    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY, deck_id TEXT, review_mode TEXT NOT NULL, queue_json TEXT NOT NULL,
      current_index INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, completed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_study_sessions_active ON study_sessions(deck_id, review_mode, completed_at, updated_at);
    CREATE TABLE IF NOT EXISTS learning_load_history (
      id TEXT PRIMARY KEY, recorded_at INTEGER NOT NULL, suggested_new_limit INTEGER NOT NULL,
      actual_new_count INTEGER NOT NULL DEFAULT 0, due_count INTEGER NOT NULL DEFAULT 0,
      rereview_count INTEGER NOT NULL DEFAULT 0, study_seconds INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL
    );
  `);

  // Tự động bổ sung phiên âm IPA cho tất cả các thẻ đã có sẵn trong CSDL
  try {
    const missingCards = await connection.getAllAsync<{ id: string; front: string }>(
      'SELECT id, front FROM cards WHERE ipa_us IS NULL OR ipa_us = ""'
    );
    for (const card of missingCards) {
      const clean = (card.front || '').trim().toLowerCase();
      const toeic = TOEIC_MAP.get(clean);
      if (toeic && (toeic.ipaUs || toeic.ipaUk)) {
        await connection.runAsync(
          'UPDATE cards SET ipa_us = ?, ipa_uk = ? WHERE id = ?',
          toeic.ipaUs || null,
          toeic.ipaUk || toeic.ipaUs || null,
          card.id
        );
      } else if (clean === 'revised') {
        await connection.runAsync('UPDATE cards SET ipa_us = ?, ipa_uk = ? WHERE id = ?', '/rɪvˈaɪzd/', '/rɪvˈaɪzd/', card.id);
      } else if (clean === 'packing') {
        await connection.runAsync('UPDATE cards SET ipa_us = ?, ipa_uk = ? WHERE id = ?', '/ˈpæk.ɪŋ/', '/ˈpæk.ɪŋ/', card.id);
      } else if (clean === 'ink') {
        await connection.runAsync('UPDATE cards SET ipa_us = ?, ipa_uk = ? WHERE id = ?', '/ˈɪŋk/', '/ˈɪŋk/', card.id);
      }
    }
  } catch (err) {
    console.warn('IPA migration backfill warning:', err);
  }
}

async function seedInitialDataIfEmpty(connection: SQLite.SQLiteDatabase) {
  const existingCards = await connection.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cards');
  if (existingCards && existingCards.count > 0) {
    return;
  }

  // Clean any partial seed if interrupted
  await connection.runAsync('DELETE FROM decks');
  await connection.runAsync('DELETE FROM cards');
  await connection.runAsync('DELETE FROM fsrs_states');
  await connection.runAsync('DELETE FROM review_logs');

  const now = Date.now();
  const idGen = () => Crypto.randomUUID();

  // Decks matching Mochi Screenshots
  const deckWhenId = idGen();
  const deckNotesId = idGen();
  const deckWhoId = idGen();

  await connection.runAsync('INSERT INTO decks (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    deckWhenId, 'When', 'Time expressions, conjunctions and adverbs', now - 86400000 * 5, now - 86400000 * 5);
  await connection.runAsync('INSERT INTO decks (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    deckNotesId, 'Notes', 'General study notes and markdown cards', now - 86400000 * 10, now - 86400000 * 10);
  await connection.runAsync('INSERT INTO decks (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    deckWhoId, 'Who', 'People, pronouns and relationships', now - 86400000 * 8, now - 86400000 * 8);

  // Cards in "When" Deck (Screenshot 1: packing, revised, ink)
  const whenCards = [
    {
      front: 'packing',
      back: 'đóng gói',
      content: 'packing\n---\nđóng gói',
      state: 'learning',
      reps: 1,
      scheduledDays: 0,
      ipaUs: '/ˈpæk.ɪŋ/',
      ipaUk: '/ˈpæk.ɪŋ/'
    },
    {
      front: 'revised',
      back: 'đã duyệt lại; sửa đổi',
      content: 'revised\n---\nđã duyệt lại; sửa đổi',
      state: 'new',
      reps: 0,
      scheduledDays: 0,
      ipaUs: '/rɪvˈaɪzd/',
      ipaUk: '/rɪvˈaɪzd/'
    },
    {
      front: 'ink',
      back: 'mực viết',
      content: 'ink\n---\nmực viết',
      state: 'new',
      reps: 0,
      scheduledDays: 0,
      ipaUs: '/ˈɪŋk/',
      ipaUk: '/ˈɪŋk/'
    }
  ];

  const validCardIds: string[] = [];

  for (const c of whenCards) {
    const cardId = idGen();
    validCardIds.push(cardId);
    await connection.runAsync(
      `INSERT INTO cards (id, deck_id, front, back, content, card_type, objective, created_at, updated_at, archived_at, trashed_at, is_pinned, review_reverse, ipa_us, ipa_uk)
       VALUES (?, ?, ?, ?, ?, 'basic', 'meaning_en_vi', ?, ?, NULL, NULL, 0, 0, ?, ?)`,
      cardId, deckWhenId, c.front, c.back, c.content, now, now, c.ipaUs, c.ipaUk
    );
    // Add FSRS state
    await connection.runAsync(
      `INSERT INTO fsrs_states (card_id, objective, state, due_at, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, last_review_at, raw_json)
       VALUES (?, 'meaning_en_vi', ?, ?, 1.2, 0, 0, ?, ?, 0, ?, '{}')`,
      cardId, c.state || 'new', now, c.scheduledDays || 0, c.reps || 0, c.reps > 0 ? now - 3600000 : null
    );
  }

  // Cards in "Notes" Deck
  const notesCards = [
    {
      front: 'Spaced Repetition',
      back: 'An evidence-based learning technique that incorporates increasing intervals of time between subsequent review of previously learned material to exploit the psychological spacing effect.',
      content: 'Spaced Repetition\n---\nAn evidence-based learning technique that incorporates increasing intervals of time between subsequent review of previously learned material to exploit the psychological spacing effect.'
    },
    {
      front: 'Mochi Markdown syntax',
      back: 'Use `---` on its own line to create hidden card sides. Use `<<word>>` for cloze deletion.',
      content: 'Mochi Markdown syntax\n---\nUse `---` on its own line to create hidden card sides.\n\nUse `<<word>>` for cloze deletion.'
    }
  ];

  for (const c of notesCards) {
    const cardId = idGen();
    validCardIds.push(cardId);
    await connection.runAsync(
      `INSERT INTO cards (id, deck_id, front, back, content, card_type, objective, created_at, updated_at, archived_at, trashed_at, is_pinned, review_reverse)
       VALUES (?, ?, ?, ?, ?, 'basic', 'meaning_en_vi', ?, ?, NULL, NULL, 0, 0)`,
      cardId, deckNotesId, c.front, c.back, c.content, now - 86400000, now - 86400000
    );
    await connection.runAsync(
      `INSERT INTO fsrs_states (card_id, objective, state, due_at, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, last_review_at, raw_json)
       VALUES (?, 'meaning_en_vi', 'new', ?, 0, 0, 0, 0, 0, 0, NULL, '{}')`,
      cardId, now
    );
  }

  // Add sample trashed cards (to match the 12 badge in sidebar)
  for (let i = 1; i <= 12; i++) {
    const cardId = idGen();
    await connection.runAsync(
      `INSERT INTO cards (id, deck_id, front, back, content, card_type, objective, created_at, updated_at, archived_at, trashed_at, is_pinned, review_reverse)
       VALUES (?, ?, ?, ?, ?, 'basic', 'meaning_en_vi', ?, ?, NULL, ?, 0, 0)`,
      cardId, deckWhenId, `Old archived note #${i}`, 'Content deleted', `Old archived note #${i}\n---\nContent deleted`, now - 86400000 * 20, now - 86400000 * 2, now - 86400000 * 2
    );
  }

  // Add sample review logs to populate the Dashboard activity heatmap & stats
  if (validCardIds.length > 0) {
    const sampleLogCount = 26;
    for (let i = 0; i < sampleLogCount; i++) {
      const logId = idGen();
      const reviewTime = now - (i % 2 === 0 ? 3600000 * 2 : 86400000 * 3);
      const targetCardId = validCardIds[i % validCardIds.length];
      await connection.runAsync(
        `INSERT INTO review_logs (id, card_id, objective, rating, reviewed_at, state_before, state_after, scheduled_days, elapsed_days, review_json)
         VALUES (?, ?, 'meaning_en_vi', 'good', ?, 'new', 'review', 1, 0, '{}')`,
        logId, targetCardId, reviewTime
      );
    }
  }

  // User setting default
  await connection.runAsync("INSERT OR IGNORE INTO user_settings (key, value) VALUES ('userName', 'Quang')");
  await connection.runAsync("INSERT OR IGNORE INTO user_settings (key, value) VALUES ('theme', 'light')");
  await connection.runAsync("INSERT OR IGNORE INTO user_settings (key, value) VALUES ('desiredRetention', '0.9')");
}

export async function withTransaction<T>(work: (connection: SQLite.SQLiteDatabase) => Promise<T>) {
  const connection = await database();
  await connection.execAsync('BEGIN IMMEDIATE');
  try {
    const value = await work(connection);
    await connection.execAsync('COMMIT');
    return value;
  } catch (error) {
    await connection.execAsync('ROLLBACK');
    throw error;
  }
}
