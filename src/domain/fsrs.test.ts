import { describe, expect, it } from 'vitest';
import { newFsrsState, schedule } from './fsrs';

describe('Mochi FSRS Spaced Repetition', () => {
  it('creates an initial new FSRS state', async () => {
    const state = await newFsrsState(new Date());
    expect(state.state).toBe('new');
    expect(state.stability).toBe(0);
    expect(state.difficulty).toBe(0);
    expect(state.reps).toBe(0);
  });

  it('schedules next review on Good recall', async () => {
    const now = new Date('2026-11-07T00:00:00Z');
    const state = await newFsrsState(now);
    const result = await schedule(state, 'good', now);

    expect(result.state.reps).toBe(1);
    expect(result.state.state).toBe('review');
    expect(result.state.dueAt).toBeGreaterThan(now.getTime());
  });

  it('handles Forgot (Again) rating correctly', async () => {
    const now = new Date('2026-11-07T00:00:00Z');
    const state = await newFsrsState(now);
    const result = await schedule(state, 'again', now);

    expect(result.state.lapses).toBe(0);
    expect(result.state.state).toBe('learning');
  });

  it('resets card back to day ~4-5 when reviewed after reset (not continuing old intervals)', async () => {
    const now = new Date('2026-11-07T00:00:00Z');
    // Giả sử thẻ cũ đã học 3 lần và có stability cao
    const oldState: any = {
      cardId: 'c1',
      objective: 'meaning_en_vi',
      state: 'new',
      dueAt: now.getTime(),
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      lastReviewAt: null,
      rawJson: '{"stability":22.75,"difficulty":4.5,"reps":3,"state":2}'
    };

    // Khi ôn tập thẻ này với 'good', vì state='new' và reps=0 (đã reset),
    // hệ thống PHẢI coi là thẻ mới tinh và cho scheduledDays ~ 4-5 ngày (không phải 30+ ngày)
    const result = await schedule(oldState, 'good', now);
    expect(result.state.reps).toBe(1);
    expect(result.state.scheduledDays).toBeLessThanOrEqual(6);
    expect(result.state.scheduledDays).toBeGreaterThanOrEqual(3);
  });

  it('correctly parses multiple hidden sides with ---', () => {
    const content = 'Side 1 (Front)\n---\nSide 2 (Hidden 1)\n---\nSide 3 (Hidden 2)\n---\nSide 4 (Hidden 3)';
    const sides = content.split(/\n\s*---\s*\n/).map(s => s.trim()).filter(Boolean);

    expect(sides).toHaveLength(4);
    expect(sides[0]).toBe('Side 1 (Front)');
    expect(sides[1]).toBe('Side 2 (Hidden 1)');
    expect(sides[2]).toBe('Side 3 (Hidden 2)');
    expect(sides[3]).toBe('Side 4 (Hidden 3)');

    const hiddenSidesCount = Math.max(0, sides.length - 1);
    expect(hiddenSidesCount).toBe(3);
  });
});
