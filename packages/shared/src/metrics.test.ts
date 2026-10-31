import { describe, expect, it } from 'vitest';
import { SLOTS, checkCount } from './constants';
import { emptyDay, keysBack, levelOf, metrics, nextStreakTier, rewardFor, scoreSession, streakMultiplier, streakOf, sumDays, tierFor } from './metrics';

const NOW = new Date(2026, 9, 30, 15).getTime();

describe('metrics', () => {
  it('bản đồ có 35 lô trống', () => expect(SLOTS.length).toBe(35));

  it('hạng công trình theo số phút', () => {
    expect([4, 5, 14, 15, 30, 59, 60, 180].map(tierFor)).toEqual([0, 1, 1, 2, 3, 3, 4, 4]);
  });

  it('giai đoạn nhà và mốc tiếp theo', () => {
    expect(levelOf(0)).toMatchObject({ lv: 1, next: { lv: 2 } });
    expect(levelOf(240)).toMatchObject({ lv: 4, next: { lv: 5 } });
    expect(levelOf(5000).next).toBeNull();
  });

  it('số câu kiểm tra hiện diện', () => {
    expect([5, 25, 60, 180].map((m) => checkCount('screen', m * 60))).toEqual([1, 2, 6, 6]);
    expect(checkCount('offline', 3600)).toBe(0);
  });

  it('điểm tập trung phiên trên máy', () => {
    const base = { mode: 'screen' as const, activeSec: 1500, self: 0 };
    expect(scoreSession({ ...base, awaySec: 0, distractions: 0, missed: 0, qa: 2, qc: 2 })).toBe(100);
    // 10% thời gian rời trang, 2 lần rời, 1 câu bỏ lỡ, đúng 1/2
    expect(scoreSession({ ...base, awaySec: 150, distractions: 2, missed: 1, qa: 2, qc: 1 })).toBe(Math.round((90 - 11) * 0.875));
  });

  it('điểm tập trung phiên ngoài màn hình', () => {
    expect(scoreSession({ mode: 'offline', activeSec: 0, awaySec: 0, distractions: 0, missed: 0, qa: 2, qc: 1, self: 5 })).toBe(70);
  });

  it('cộng ngày và điểm kỷ luật', () => {
    const k = keysBack(7, 0, NOW);
    expect(k).toHaveLength(7);
    expect(k[6]).toBe('2026-10-30');
    const days = { [k[6]]: { ...emptyDay(), s: 2, c: 1, q: 1, pl: 1200, ac: 900 }, [k[5]]: { ...emptyDay(), s: 1, c: 1, pl: 600, ac: 600 } };
    const t = sumDays(days, k);
    expect(t).toMatchObject({ s: 3, c: 2, act: 2 });
    const m = metrics(t, 7, NOW - 30 * 86400000, NOW);
    expect(m.disc).toBe(Math.round(100 * (0.4 * (2 / 3) + 0.3 * (1500 / 1800) + 0.3 * (2 / 7))));
  });

  it('chuỗi ngày bỏ qua hôm nay nếu chưa có phiên', () => {
    const k = keysBack(4, 0, NOW);
    const d = { ...emptyDay(), c: 1 };
    expect(streakOf({ [k[0]]: d, [k[1]]: d, [k[2]]: d }, NOW)).toBe(3);
    expect(streakOf({ [k[0]]: d, [k[2]]: d, [k[3]]: d }, NOW)).toBe(2);
  });

  it('hệ số thưởng theo chuỗi', () => {
    expect([0, 1, 4, 5, 9, 10, 14, 15, 40].map(streakMultiplier)).toEqual([1, 1, 1, 2, 2, 3, 3, 3.5, 3.5]);
    expect(rewardFor(1)).toEqual({ gold: 50, wood: 50, mult: 1 });
    expect(rewardFor(5)).toEqual({ gold: 100, wood: 100, mult: 2 });
    expect(rewardFor(15)).toEqual({ gold: 175, wood: 175, mult: 3.5 });
    expect(nextStreakTier(3)).toEqual({ at: 5, mult: 2 });
    expect(nextStreakTier(12)).toEqual({ at: 15, mult: 3.5 });
    expect(nextStreakTier(15)).toBeNull();
  });
});
