import { describe, expect, it } from 'vitest';
import { leadsOf, maMoi, mauDau, muaDau, quaHan, soPhieu, traDong } from '../../src/server/services/doDung';

describe('đồ dùng: luật thuần', () => {
  it('mã đồ và số phiếu tăng dần', () => {
    expect(maMoi('tb', ['TB-001', 'TB-009', 'VP-002'])).toBe('TB-010');
    expect(maMoi('th', [])).toBe('VP-001');
    expect(soPhieu('PL', '2026-11-11', ['PL2611-001', 'PL2611-004', 'PL2610-009'])).toBe('PL2611-005');
  });
  it('Lead cùng phòng, không tính người gửi', () => {
    const u = { a: { name: 'A', pb: 'C', role: 'lead', hr: false }, b: { name: 'B', pb: 'C', role: 'content', hr: false }, c: { name: 'C', pb: 'K', role: 'lead', hr: false } };
    expect(leadsOf(u, 'C', 'b')).toEqual(['a']);
    expect(leadsOf(u, 'C', 'a')).toEqual([]);
    expect(leadsOf(u, '', 'b')).toEqual([]);
  });
  it('bước đầu', () => {
    expect(mauDau({ laCeo: false, laLead: false, coLead: true })).toBe('lead');
    expect(mauDau({ laCeo: false, laLead: false, coLead: false })).toBe('kho');
    expect(muaDau({ laCeo: false, laLead: false, coLead: true, laQl: false })).toBe('lead');
    expect(muaDau({ laCeo: false, laLead: true, coLead: false, laQl: false })).toBe('ql');
    expect(muaDau({ laCeo: false, laLead: false, coLead: false, laQl: true })).toBe('mua');
    expect(muaDau({ laCeo: true, laLead: false, coLead: true, laQl: false })).toBe('mua');
  });
  it('trả đồ', () => {
    expect(traDong('tb', 2, 2, '')).toEqual({ tra: 2, dung: 0, tinh: 'Tốt' });
    expect(traDong('tb', 2, 1, '').err).toBeTruthy();
    expect(traDong('tb', 2, 1, 'Mất')).toEqual({ tra: 1, dung: 0, tinh: 'Mất' });
    expect(traDong('mau', 3, 1, '')).toEqual({ tra: 1, dung: 2, tinh: '' });
    expect(traDong('mau', 3, 4, '').err).toBeTruthy();
  });
  it('quá hạn', () => {
    expect(quaHan('2026-11-10T17:00', '2026-11-11T08:00')).toBe(true);
    expect(quaHan('2026-11-11T18:00', '2026-11-11T08:00')).toBe(false);
    expect(quaHan(null, '2026-11-11T08:00')).toBe(false);
  });
});
