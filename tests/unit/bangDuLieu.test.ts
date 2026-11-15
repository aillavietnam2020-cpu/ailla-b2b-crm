import { describe, expect, it } from 'vitest';
import { canAddRow, canDesign, canEditRow, canView, describeDefChange, sanitizeDef, sanitizeRow } from '../../src/server/lib/bangDuLieu';

/** Bảng dữ liệu (Quản trị phòng ban đợt 3): kiểm cấu trúc, kiểm ô, ai xem / ai sửa. */
const def = () =>
  sanitizeDef({
    cols: [
      { k: 'cy', t: 'Ý tưởng', ty: 'text' },
      { k: 'cst', t: 'Trạng thái', ty: 'sel', opts: ['Ý tưởng', 'Đã quay', 'Ý tưởng'] },
      { k: 'cng', t: 'Người phụ trách', ty: 'user' },
      { k: 'clx', t: 'Lượt xem', ty: 'num' },
      { k: 'BAD KEY', t: 'x', ty: 'text' },
      { k: 'cz', t: 'Lạ', ty: 'giavon' },
    ],
    metrics: [
      { t: 'Đã quay', kind: 'dem', fc: 'cst', fv: 'Đã quay' },
      { t: 'Tổng xem', kind: 'tong', col: 'clx' },
      { t: 'Tổng sai cột', kind: 'tong', col: 'cy' },
      { t: 'Tỉ lệ không điều kiện', kind: 'tile' },
    ],
    xem: { mode: 'phong', them: ['ADS'] },
    sua: 'phutrach',
    kan: 'cst',
  });

describe('Bảng dữ liệu: cấu trúc', () => {
  it('bỏ cột sai khóa / sai kiểu, bỏ lựa chọn trùng, bỏ chỉ số sai', () => {
    const d = def();
    expect(d.cols.map((c) => c.k)).toEqual(['cy', 'cst', 'cng', 'clx']);
    expect(d.cols[1]!.opts).toEqual(['Ý tưởng', 'Đã quay']);
    expect(d.metrics.map((m) => m.t)).toEqual(['Đã quay', 'Tổng xem']);
    expect(d.kan).toBe('cst');
    expect(sanitizeDef({ sua: 'ai cũng sửa', xem: { mode: 'ca cong ty' } })).toMatchObject({ sua: 'lead', xem: { mode: 'phong', them: [] } });
  });
  it('ô dữ liệu đúng kiểu; giữ ô của cột đã bỏ', () => {
    const d = def();
    const r = sanitizeRow({ cy: ' Áo trắng ', cst: 'Không có', clx: '48.200', cng: 'u_nv', khac: 'x' }, d, { cold: 'giữ' });
    expect(r).toEqual({ cy: 'Áo trắng', clx: 48200, cng: 'u_nv', cold: 'giữ' });
    expect(sanitizeRow({ cy: '' }, d, r)).not.toHaveProperty('cy');
  });
  it('nhật ký mô tả đổi cột', () => {
    const d0 = def();
    const d1 = sanitizeDef({ ...d0, cols: [...d0.cols.slice(0, 3), { k: 'cnq', t: 'Ngày quay', ty: 'date' }] });
    expect(describeDefChange('Hook', d0, 'Hook', d1)).toBe('Bảng "Hook": thêm cột "Ngày quay"; bỏ cột "Lượt xem"; sửa chỉ số tự tính');
  });
});

describe('Bảng dữ liệu: ai xem, ai sửa', () => {
  const lead = { hubId: 'u_lead', dept: 'CM', leadDept: 'CM', ceo: false };
  const nv = { hubId: 'u_nv', dept: 'CM', leadDept: '', ceo: false };
  const ads = { hubId: 'u_ads', dept: 'ADS', leadDept: '', ceo: false };
  const kt = { hubId: 'u_kt', dept: 'KT', leadDept: '', ceo: false };
  it('xem: cả phòng + phòng được mời; chỉ Lead thì người khác không xem', () => {
    const d = def();
    expect([lead, nv, ads, kt].map((v) => canView('CM', d, v))).toEqual([true, true, true, false]);
    const d2 = sanitizeDef({ ...d, xem: { mode: 'lead', them: ['ADS'] } });
    expect([lead, nv, ads].map((v) => canView('CM', d2, v))).toEqual([true, false, false]);
  });
  it('Lead + người phụ trách: NV sửa dòng mình thêm hoặc có tên mình; phòng được mời chỉ xem', () => {
    const d = def();
    expect(canDesign('CM', nv)).toBe(false);
    expect(canAddRow('CM', d, nv)).toBe(true);
    expect(canAddRow('CM', d, ads)).toBe(false);
    expect(canEditRow('CM', d, nv, { by_id: 'u_lead', data: { cng: 'u_nv' } })).toBe(true);
    expect(canEditRow('CM', d, nv, { by_id: 'u_nv', data: {} })).toBe(true);
    expect(canEditRow('CM', d, nv, { by_id: 'u_lead', data: { cng: 'u_khac' } })).toBe(false);
    expect(canEditRow('CM', d, ads, { by_id: 'u_ads', data: {} })).toBe(false);
    const chiLead = sanitizeDef({ ...d, sua: 'lead' });
    expect(canAddRow('CM', chiLead, nv)).toBe(false);
    expect(canEditRow('CM', chiLead, lead, { by_id: 'x', data: {} })).toBe(true);
  });
});
