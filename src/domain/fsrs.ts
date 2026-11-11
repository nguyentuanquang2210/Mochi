import { DefaultScheduler, Rating as FsrsRating } from 'ts-fsrs';
import type { CardState, FsrsState, Rating } from './types';

const schedulerPromise = DefaultScheduler({ desiredRetention: 0.9 });
const ratingMap: Record<Rating, FsrsRating> = { again: FsrsRating.Again, hard: FsrsRating.Hard, good: FsrsRating.Good, easy: FsrsRating.Easy };

export async function newFsrsState(now = new Date()): Promise<FsrsState> {
  const scheduler = await schedulerPromise;
  const card = scheduler.newCard({ now });
  return asState('', 'meaning_en_vi', card);
}

export async function schedule(state: FsrsState, rating: Rating, now = new Date()) {
  const scheduler = await schedulerPromise;
  let card: any;
  try {
    const isBrandNew = !state.state || state.state === 'new' || state.reps === 0 || !state.lastReviewAt;
    if (isBrandNew) {
      // Nếu là thẻ mới hoặc thẻ đã được đặt lại lịch ôn tập (reset): BẮT BUỘC tạo thẻ mới tinh
      card = scheduler.newCard({ now });
    } else {
      const parsed = state.rawJson ? JSON.parse(state.rawJson) : null;
      if (parsed && typeof parsed.stability === 'number' && typeof parsed.difficulty === 'number' && Number(parsed.reps || 0) > 0) {
        card = reviveCard(parsed);
      } else {
        card = scheduler.newCard({ now: state.lastReviewAt ? new Date(state.lastReviewAt) : now });
      }
    }
  } catch {
    card = scheduler.newCard({ now });
  }

  try {
    const result = scheduler.review({ card, grade: ratingMap[rating] as 1 | 2 | 3 | 4, now });
    const nextState = applyMochiInterval(asState(state.cardId, state.objective, result.card), state, rating, now);
    return { state: nextState, review: result.revlog };
  } catch (err) {
    // If card state is invalid or empty, create a fresh card and review safely
    const freshCard = scheduler.newCard({ now });
    const result = scheduler.review({ card: freshCard, grade: ratingMap[rating] as 1 | 2 | 3 | 4, now });
    const nextState = applyMochiInterval(asState(state.cardId, state.objective, result.card), state, rating, now);
    return { state: nextState, review: result.revlog };
  }
}

// The learner requested Mochi's simple, predictable interval ladder. FSRS still
// records card state/difficulty/reviews; this function owns only the next due
// date shown to the learner. Forgetting enters a short relearning sequence.
const MOCHI_INTERVALS = [1, 2, 4, 7, 13, 23, 42, 76, 137];

function applyMochiInterval(next: FsrsState, previous: FsrsState, rating: Rating, now: Date): FsrsState {
  const current = Math.max(0, Math.round(previous.scheduledDays || 0));
  let scheduledDays: number;
  if (rating === 'again') {
    // A failed recall should be checked tomorrow, even for a mature card.
    // The card still retains its FSRS review history, then climbs 1 → 2 → 4…
    // again as the learner demonstrates that it is stable.
    scheduledDays = 1;
  } else if (rating === 'hard') {
    scheduledDays = current > 0 ? Math.max(1, Math.round(current * 1.25)) : 1;
  } else if (rating === 'easy') {
    scheduledDays = nextMochiInterval(current, 2.2);
  } else {
    scheduledDays = nextMochiInterval(current, 1.8);
  }
  const dueAt = now.getTime() + scheduledDays * 86400000;
  return { ...next, scheduledDays, dueAt, rawJson: updateRawSchedule(next.rawJson, dueAt, scheduledDays) };
}

function nextMochiInterval(current: number, multiplier: number): number {
  if (current <= 0) return 1;
  const index = MOCHI_INTERVALS.indexOf(current);
  if (index >= 0 && index < MOCHI_INTERVALS.length - 1) return MOCHI_INTERVALS[index + 1];
  return Math.max(current + 1, Math.round(current * multiplier));
}

function updateRawSchedule(rawJson: string, dueAt: number, scheduledDays: number): string {
  try {
    const raw = JSON.parse(rawJson);
    raw.dueAt = new Date(dueAt).toISOString(); raw.due = new Date(dueAt).toISOString();
    raw.scheduledDays = scheduledDays; raw.scheduled_days = scheduledDays;
    return JSON.stringify(raw);
  } catch { return rawJson; }
}

function asState(cardId: string, objective: FsrsState['objective'], raw: any): FsrsState {
  return {
    cardId, objective, state: stateName(raw.state),
    dueAt: new Date(raw.dueAt ?? raw.due).getTime(), stability: raw.stability ?? 0, difficulty: raw.difficulty ?? 0,
    elapsedDays: raw.elapsed_days ?? raw.elapsedDays ?? 0, scheduledDays: raw.scheduled_days ?? raw.scheduledDays ?? 0,
    reps: raw.reps ?? 0, lapses: raw.lapses ?? 0,
    lastReviewAt: raw.last_review ? new Date(raw.last_review).getTime() : raw.lastReviewAt ? new Date(raw.lastReviewAt).getTime() : raw.lastReview ? new Date(raw.lastReview).getTime() : null,
    rawJson: JSON.stringify(raw),
  };
}

function stateName(value: unknown): CardState {
  const numeric = Number(value);
  if (numeric === 1) return 'learning';
  if (numeric === 2) return 'review';
  if (numeric === 3) return 'relearning';
  return 'new';
}

function reviveCard(card: Record<string, unknown>) {
  const c: any = { ...card };
  if (c.dueAt) c.dueAt = new Date(c.dueAt);
  else if (c.due) c.dueAt = new Date(c.due);
  else c.dueAt = new Date();

  if (c.lastReviewAt) c.lastReviewAt = new Date(c.lastReviewAt);
  else if (c.last_review) c.lastReviewAt = new Date(c.last_review);
  else c.lastReviewAt = null;

  return c;
}
