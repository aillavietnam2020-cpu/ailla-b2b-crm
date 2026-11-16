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

describe('thư mục mở thẳng trên Drive', () => {
  it('giữ cờ direct khi lưu cấu hình, bỏ giá trị lạ', async () => {
    const { normalizeConfig } = await import('../../src/server/lib/driveAccess');
    const cfg = normalizeConfig({ teams: [
      { pb: 'chung4', folderId: '1WB9GbF2xPg9dtgVVWdL7RqWlwwZJJO4v', viewers: ['pb:CM'], name: 'Booking video', direct: true },
      { pb: 'chung5', folderId: '1NNcrdHYg3X-FokcwTR0aXN_zDMcoHmEZ', viewers: ['all'], name: 'Ảnh sàn', direct: 'có' },
    ] });
    expect(cfg.teams[0].direct).toBe(true);
    expect('direct' in cfg.teams[1]).toBe(false);
  });
});

describe('chuyển file / thư mục con', () => {
  const mk = (pb: string, subs: string[], files: IdxFile[]): TeamIdx => ({
    pb, root: pb, at: '', cut: false, files, subs: countSubs(subs.map((n) => ({ id: `${pb}-${n}`, n })), files),
  });
  it('chuyển file sang thư mục con của phòng khác, số file hai bên đổi theo', async () => {
    const { moveInIdx } = await import('../../src/server/lib/driveIndex');
    const a = mk('CM', ['MEDIA', 'SKILL'], [f('skill.md', 'MEDIA'), f('v.mp4', 'MEDIA')]);
    const b = mk('ADS', ['BÁO CÁO'], []);
    const r = moveInIdx(a, b, 'skill.md', 'BÁO CÁO')!;
    expect(r.src.files.map((x) => x.n)).toEqual(['v.mp4']);
    expect(r.src.subs.find((x) => x.n === 'MEDIA')!.c).toBe(1);
    expect(r.dst.files[0]).toMatchObject({ n: 'skill.md', s: 'BÁO CÁO', w: 'BÁO CÁO' });
    expect(r.dst.subs[0].c).toBe(1);
    expect(a.files.length).toBe(2); // không sửa mục lục cũ
  });
  it('chuyển trong cùng phòng: từ MEDIA sang SKILL', async () => {
    const { moveInIdx } = await import('../../src/server/lib/driveIndex');
    const a = mk('CM', ['MEDIA', 'SKILL'], [f('skill.md', 'MEDIA')]);
    const r = moveInIdx(a, a, 'skill.md', 'SKILL')!;
    expect(r.src).toBe(r.dst);
    expect(r.src.subs.map((x) => [x.n, x.c])).toEqual([['MEDIA', 0], ['SKILL', 1]]);
  });
  it('chuyển cả thư mục con: vào gốc phòng khác thành thư mục con cấp 1, vào thư mục con thì nằm sâu hơn', async () => {
    const { moveInIdx } = await import('../../src/server/lib/driveIndex');
    const a = mk('CM', ['SKILL'], [f('a.md', 'SKILL', { w: 'SKILL › 2026' })]);
    const b = mk('ADS', ['TÀI LIỆU'], []);
    const r1 = moveInIdx(a, b, 'CM-SKILL', '')!;
    expect(r1.src.subs).toEqual([]);
    expect(r1.dst.subs.map((x) => [x.n, x.c])).toEqual([['TÀI LIỆU', 0], ['SKILL', 1]]);
    const r2 = moveInIdx(a, b, 'CM-SKILL', 'TÀI LIỆU')!;
    expect(r2.dst.files[0]).toMatchObject({ s: 'TÀI LIỆU', w: 'TÀI LIỆU › SKILL › 2026' });
    expect(moveInIdx(a, b, 'không có', '')).toBeNull();
  });
});

describe('xóa, tạo bản sao, tạo thư mục: sửa mục lục', () => {
  it('xóa file, xóa thư mục con kèm file bên trong, thêm bản sao, thêm thư mục mới', async () => {
    const { removeFromIdx, addFileToIdx, addSubToIdx } = await import('../../src/server/lib/driveIndex');
    const files = [f('a', 'MEDIA'), f('b', 'MEDIA'), f('c', 'BÁO CÁO')];
    const idx: TeamIdx = { pb: 'CM', root: 'r', at: '', cut: false, files, subs: countSubs([{ id: 's1', n: 'MEDIA' }, { id: 's2', n: 'BÁO CÁO' }], files) };
    expect(removeFromIdx(idx, 'a')!.subs.map((s) => s.c)).toEqual([1, 1]);
    const noMedia = removeFromIdx(idx, 's1')!;
    expect(noMedia.files.map((x) => x.n)).toEqual(['c']);
    expect(noMedia.subs.map((s) => s.n)).toEqual(['BÁO CÁO']);
    expect(removeFromIdx(idx, 'không có')).toBeNull();
    expect(addFileToIdx(idx, f('Bản sao của c', 'BÁO CÁO')).subs[1].c).toBe(2);
    expect(addSubToIdx(idx, { id: 's3', n: 'SKILL' }).subs.map((s) => [s.n, s.c])).toEqual([['MEDIA', 2], ['BÁO CÁO', 1], ['SKILL', 0]]);
  });
});
