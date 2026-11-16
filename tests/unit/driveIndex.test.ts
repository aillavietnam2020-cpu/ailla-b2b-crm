import { describe, expect, it } from 'vitest';
import { countSubs, searchIdx, todoFor, vnFold, weekStats, type IdxFile, type TeamIdx } from '../../src/server/lib/driveIndex';

const NOW = Date.parse('2026-11-16T03:00:00Z');
const f = (n: string, s = '', extra: Partial<IdxFile> = {}): IdxFile => ({
  i: n, n, k: 'sheet', s, w: s, m: '2026-11-15T03:00:00Z', c: '2026-11-15T03:00:00Z', b: 'Lead Content', z: 10, l: '', d: true, t: false, ...extra,
});

describe('mục lục Thư mục làm việc', () => {
  it('bỏ dấu tiếng Việt', () => {
    expect(vnFold('Bột tẩy VẠN NĂNG đây')).toBe('bot tay van nang day');
  });

  it('đếm file theo thư mục con cấp 1 và lần sửa mới nhất', () => {
    const files = [f('a', 'MEDIA', { m: '2026-10-01T00:00:00Z' }), f('b', 'MEDIA', { m: '2026-11-10T00:00:00Z' }), f('c', '')];
    expect(countSubs([{ id: '1', n: 'MEDIA' }, { id: '2', n: 'TRỐNG' }], files)).toEqual([
      { id: '1', n: 'MEDIA', c: 2, last: '2026-11-10T00:00:00Z' },
      { id: '2', n: 'TRỐNG', c: 0, last: null },
    ]);
  });

  it('việc cần xử lý: bản sao, chưa xếp thư mục, tên chưa rõ, thư mục lâu không cập nhật', () => {
    const idx: TeamIdx = {
      pb: 'CM', root: 'r', at: '', cut: false,
      subs: [{ id: '1', n: 'BÁO CÁO', c: 1, last: '2026-09-01T00:00:00Z' }, { id: '2', n: 'MEDIA', c: 2, last: '2026-11-15T00:00:00Z' }],
      files: [
        f('Bản sao của Báo cáo tháng 10', 'BÁO CÁO'),
        f('PHÂN TÍCH CAREFOR', ''),
        f('Lối tắt Knowledge Hub', '', { k: 'link' }),
        f('bot tay final final (1).mp4', 'MEDIA'),
        f('Video ổn.mp4', 'MEDIA'),
      ],
    };
    const t = todoFor(idx, 'Content & Media', false, NOW);
    expect(t.map((x) => [x.k, x.tx])).toEqual([
      ['Bản sao lạc chỗ', 'Bản sao của Báo cáo tháng 10'],
      ['Chưa xếp thư mục', 'PHÂN TÍCH CAREFOR'],
      ['Tên chưa rõ', 'bot tay final final (1).mp4'],
      ['Lâu không cập nhật', 'BÁO CÁO 30 ngày không có file mới'],
    ]);
    // Thư mục dùng chung chỉ nhắc bản sao
    expect(todoFor(idx, 'Kho ảnh', true, NOW).map((x) => x.k)).toEqual(['Bản sao lạc chỗ']);
  });

  it('số file thêm mới / được sửa trong 7 ngày', () => {
    const files = [f('mới'), f('cũ', '', { c: '2026-10-01T00:00:00Z', m: '2026-11-14T00:00:00Z' }), f('rất cũ', '', { c: '2026-01-01T00:00:00Z', m: '2026-01-01T00:00:00Z' })];
    expect(weekStats(files, NOW)).toEqual({ added: 1, edited: 2 });
  });

  it('tìm không dấu theo tên, thư mục, người sửa; mới sửa trước', () => {
    const files = [
      f('Bột tẩy vạn năng - review.mp4', 'MEDIA', { m: '2026-11-01T00:00:00Z' }),
      f('Kịch bản bột tẩy', 'KỊCH BẢN', { m: '2026-11-10T00:00:00Z' }),
      f('Báo cáo ads', 'BÁO CÁO'),
    ];
    expect(searchIdx(files, 'bot tay').map((x) => x.n)).toEqual(['Kịch bản bột tẩy', 'Bột tẩy vạn năng - review.mp4']);
    expect(searchIdx(files, 'kich ban tay').map((x) => x.n)).toEqual(['Kịch bản bột tẩy']);
    expect(searchIdx(files, '   ')).toEqual([]);
  });
});
