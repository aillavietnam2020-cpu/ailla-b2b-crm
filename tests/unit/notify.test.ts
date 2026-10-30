import { describe, expect, it } from 'vitest';
import { clampSince } from '../../src/server/routes/notify';

describe('thông báo của tôi: mốc since', () => {
  const now = Date.parse('2026-10-30T10:00:00.000Z');
  it('không có mốc thì lấy bây giờ (lần đầu không báo dồn việc cũ)', () => {
    expect(clampSince(undefined, now)).toBe('2026-10-30T10:00:00.000Z');
    expect(clampSince('rác', now)).toBe('2026-10-30T10:00:00.000Z');
  });
  it('mốc cũ quá 24 giờ thì kéo về 24 giờ trước', () => {
    expect(clampSince('2026-10-20T00:00:00.000Z', now)).toBe('2026-10-29T10:00:00.000Z');
  });
  it('mốc trong khoảng thì giữ nguyên, mốc ở tương lai thì về bây giờ', () => {
    expect(clampSince('2026-10-30T09:59:00.000Z', now)).toBe('2026-10-30T09:59:00.000Z');
    expect(clampSince('2026-11-01T00:00:00.000Z', now)).toBe('2026-10-30T10:00:00.000Z');
  });
});
