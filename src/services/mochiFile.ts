import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import * as Crypto from 'expo-crypto';
import { database, withTransaction } from '../data/database';
import { newFsrsState, schedule } from '../domain/fsrs';

const id = () => Crypto.randomUUID();
const dt = (value: any, fallback: number) => typeof value === 'object' && value?.['~#dt'] ? value['~#dt'] : fallback;
const stamp = (value: number) => `~t${value}`;

/** Compatible with Mochi's documented ZIP/data.json interchange container.
 * Templates/AI component cache are preserved as display metadata on export;
 * app scheduling remains FSRS rather than attempting to import Mochi's model. */
export const MochiFile = {
  async importFromPicker(): Promise<{ decks: number; cards: number }> {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/octet-stream', '*/*'], copyToCacheDirectory: true });
    if (result.canceled) return { decks: 0, cards: 0 };
    const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const source = zip.file('data.json');
    if (!source) throw new Error('Không tìm thấy data.json trong file .mochi.');
    const root = JSON.parse(await source.async('text'));
    if (!Array.isArray(root['~:decks'])) throw new Error('File .mochi không có danh sách bộ thẻ hợp lệ.');
    let decks = 0, cards = 0;
    for (const sourceDeck of root['~:decks']) {
      const deckId = id(); const now = Date.now(); const name = String(sourceDeck['~:name'] || 'Mochi import');
      await withTransaction(async tx => {
        await tx.runAsync('INSERT INTO decks(id,name,description,created_at,updated_at) VALUES(?,?,?,?,?)', deckId, name, 'Imported from Mochi', now, now);
        const sourceCards = sourceDeck['~:cards']?.['~#list'] || [];
        for (const item of sourceCards) {
          if (item['~:trashed?']) continue;
          const cardId = id(); const content = String(item['~:content'] || item['~:name'] || '').trim();
          if (!content) continue;
          const [front = '', ...rest] = content.split(/\n\s*---\s*\n/); const back = rest.join('\n---\n');
          const reviews = Array.isArray(item['~:reviews']) ? item['~:reviews'] : [];
          // Parent card first: imported review_logs have a foreign key to it.
          await tx.runAsync(`INSERT INTO cards(id,deck_id,front,back,content,card_type,objective,created_at,updated_at,archived_at,trashed_at,is_pinned,review_reverse)
            VALUES(?,?,?,?,?,'basic','meaning_en_vi',?,?,NULL,NULL,0,0)`, cardId, deckId, front.trim(), back.trim(), content, dt(item['~:created-at'], now), dt(item['~:updated-at'], now));
          let state = await newFsrsState(new Date(dt(item['~:created-at'], now))); state.cardId = cardId;
          for (const review of reviews) {
            const date = Number(String(review['~:date'] || '').replace('~t', '')) || now;
            const rating = review['~:remembered?'] ? 'good' : 'again';
            const before = state;
            const scheduled = await schedule(state, rating, new Date(date));
            state = scheduled.state; state.cardId = cardId;
            await tx.runAsync(`INSERT INTO review_logs(id,card_id,objective,rating,reviewed_at,state_before,state_after,scheduled_days,elapsed_days,review_json)
              VALUES(?,?,?,?,?,?,?,?,?,?)`, id(), cardId, 'meaning_en_vi', rating, date, before.state, state.state, state.scheduledDays, state.elapsedDays, JSON.stringify({ importedFrom: 'mochi', sourceDue: review['~:due'], sourceInterval: review['~:interval'], duration: review['~:duration'] }));
          }
          const finalDue = reviews.length ? Number(String(reviews[reviews.length - 1]['~:due'] || '').replace('~t', '')) : 0;
          if (finalDue) state.dueAt = finalDue;
          await tx.runAsync(`INSERT INTO fsrs_states(card_id,objective,state,due_at,stability,difficulty,elapsed_days,scheduled_days,reps,lapses,last_review_at,raw_json)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, state.cardId, state.objective, state.state, state.dueAt, state.stability, state.difficulty, state.elapsedDays, state.scheduledDays, state.reps, state.lapses, state.lastReviewAt, state.rawJson);
          for (const tag of item['~:tags']?.['~#set'] || []) {
            const tagName = String(tag).replace(/^#/, '').trim().toLowerCase(); if (!tagName) continue;
            await tx.runAsync('INSERT OR IGNORE INTO tags(id,name,created_at) VALUES(?,?,?)', id(), tagName, now);
            const tagRow = await tx.getFirstAsync<{ id: string }>('SELECT id FROM tags WHERE name=? COLLATE NOCASE', tagName);
            if (tagRow) await tx.runAsync('INSERT OR IGNORE INTO card_tags(card_id,tag_id) VALUES(?,?)', cardId, tagRow.id);
          }
          cards++;
        }
      });
      decks++;
    }
    return { decks, cards };
  },

  async exportAll(): Promise<void> {
    const db = await database(); const decks = await db.getAllAsync<any>('SELECT * FROM decks ORDER BY created_at');
    const outputDecks = [];
    for (const deck of decks) {
      const cards = await db.getAllAsync<any>(`SELECT c.*, f.*, GROUP_CONCAT(t.name, '|') tags FROM cards c JOIN fsrs_states f ON f.card_id=c.id AND f.objective='meaning_en_vi' LEFT JOIN card_tags ct ON ct.card_id=c.id LEFT JOIN tags t ON t.id=ct.tag_id WHERE c.deck_id=? GROUP BY c.id`, deck.id);
      const outputCards = [];
      for (const card of cards) {
        const logs = await db.getAllAsync<any>('SELECT * FROM review_logs WHERE card_id = ? AND objective = ? ORDER BY reviewed_at ASC', card.id, 'meaning_en_vi');
        // Newly created cards naturally export with an empty review list and
        // `new? = true`; their content already follows Mochi's `---` syntax.
        outputCards.push({
          '~:id': `~:${card.id}`, '~:name': card.front, '~:deck-id': `~:${deck.id}`, '~:content': card.content,
          '~:created-at': { '~#dt': card.created_at }, '~:updated-at': { '~#dt': card.updated_at }, '~:new?': card.state === 'new',
          '~:pos': card.id.slice(0, 6), '~:cloze/indexes': { '~#set': [] }, '~:references': { '~#set': [] },
          '~:tags': { '~#set': String(card.tags || '').split('|').filter(Boolean) },
          '~:reviews': logs.map((log: any, index: number) => ({
            '~:date': stamp(log.reviewed_at),
            '~:due': stamp(index === logs.length - 1 ? card.due_at : (logs[index + 1]?.reviewed_at || card.due_at)),
            '~:interval': log.scheduled_days || 0,
            '~:remembered?': log.rating !== 'again',
            ...(log.review_json ? { '~:duration': (() => { try { return JSON.parse(log.review_json)?.duration; } catch { return undefined; } })() } : {})
          }))
        });
      }
      outputDecks.push({ '~:id': `~:${deck.id}`, '~:sort': 0, '~:name': deck.name, '~:cards': { '~#list': outputCards } });
    }
    const root = { '~:version': 2, '~:schema/version': 35, '~:templates': { '~#list': [{ '~:id': '~:bioQaTmpl1', '~:name': 'Q&A card', '~:content': '<< Flashcard >>', '~:fields': { '~:name': { '~:id': '~:name', '~:name': 'Concept', '~:pos': 'a' }, '~:flashcard': { '~:id': '~:flashcard', '~:name': 'Flashcard', '~:pos': 'm', '~:source': '~:name', '~:type': '~:ai', '~:options': { '~:ai-task': 'question-answer' } } } }] }, '~:decks': outputDecks };
    const zip = new JSZip(); zip.file('data.json', JSON.stringify(root));
    const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
    const uri = `${FileSystem.cacheDirectory}mochi-export-${Date.now()}.mochi`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/zip', dialogTitle: 'Xuất dữ liệu Mochi' });
  }
};
