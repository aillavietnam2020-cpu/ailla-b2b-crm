import { describe, expect, it } from 'vitest';
import { canSeeTeam, fileKind, folderIdFrom, locate, normalizeConfig, rootsFor, teamsFor, type DriveMeta } from '../../src/server/lib/driveAccess';

const ID_CM = '1AbCdEfGhIjKlMnOpQrStUv';
const ID_ADS = '1ZyXwVuTsRqPoNmLkJiHgFe';

describe('folderIdFrom', () => {
  it('lấy mã từ các kiểu link Drive', () => {
    expect(folderIdFrom(`https://drive.google.com/drive/folders/${ID_CM}?usp=sharing`)).toBe(ID_CM);
    expect(folderIdFrom(`https://drive.google.com/drive/u/2/folders/${ID_CM}`)).toBe(ID_CM);
    expect(folderIdFrom(`https://drive.google.com/open?id=${ID_CM}`)).toBe(ID_CM);
    expect(folderIdFrom(ID_CM)).toBe(ID_CM);
  });
  it('từ chối chữ lạ (không cho chèn vào câu hỏi Drive)', () => {
    expect(folderIdFrom("abc' or '1'='1")).toBeNull();
    expect(folderIdFrom('')).toBeNull();
    expect(folderIdFrom('ngắn')).toBeNull();
  });
});

describe('quyền xem thư mục phòng ban', () => {
  const cfg = normalizeConfig({
    teams: [
      { pb: 'CM', folderId: ID_CM, viewers: [] },
      { pb: 'ADS', folderId: `https://drive.google.com/drive/folders/${ID_ADS}`, viewers: ['lead:CM', 'pb:KT', 'xau'] },
    ],
  });
  it('chuẩn hóa cấu hình: nhận link, bỏ quyền sai dạng', () => {
    expect(cfg.teams[1]).toEqual({ pb: 'ADS', folderId: ID_ADS, viewers: ['lead:CM', 'pb:KT'] });
  });
  it('nhân viên chỉ thấy phòng mình', () => {
    expect(teamsFor(cfg, { phongBan: 'CM', role: 'content' }, false).map((t) => t.pb)).toEqual(['CM']);
  });
  it('Lead Content thấy thêm thư mục Ads; cả phòng Kế toán thấy Ads', () => {
    expect(teamsFor(cfg, { phongBan: 'CM', role: 'lead' }, false).map((t) => t.pb)).toEqual(['CM', 'ADS']);
    expect(teamsFor(cfg, { phongBan: 'KT', role: 'nhanvien' }, false).map((t) => t.pb)).toEqual(['ADS']);
  });
  it('CEO thấy hết; tài khoản bị khóa hoặc không gắn ai thì không thấy gì', () => {
    expect(teamsFor(cfg, null, true)).toHaveLength(2);
    expect(teamsFor(cfg, null, false)).toHaveLength(0);
    expect(canSeeTeam(cfg.teams[0], { phongBan: 'CM', active: false }, false)).toBe(false);
  });
  it('lead:* cho trưởng nhóm, trưởng phòng mọi phòng', () => {
    const t = { pb: 'KT', folderId: ID_CM, viewers: ['lead:*'] };
    expect(canSeeTeam(t, { phongBan: 'SX', role: 'truongphong' }, false)).toBe(true);
    expect(canSeeTeam(t, { phongBan: 'SX', role: 'nhanvien' }, false)).toBe(false);
  });
});

describe('locate: thư mục có nằm dưới thư mục gốc của phòng không', () => {
  const tree: Record<string, DriveMeta> = {
    root: { name: 'CONTENT', parents: ['mydrive'] },
    a: { name: 'Kịch bản', parents: ['root'] },
    b: { name: 'Tháng 11', parents: ['a'] },
    other: { name: 'KẾ TOÁN', parents: ['mydrive'] },
    x: { name: 'Lương', parents: ['other'] },
  };
  const meta = async (id: string) => tree[id] ?? null;
  const roots = new Map([['root', 'CM']]);
  it('trả đường dẫn từ gốc xuống', async () => {
    expect(await locate('b', roots, meta)).toEqual({
      pb: 'CM',
      path: [
        { id: 'root', name: 'CONTENT' },
        { id: 'a', name: 'Kịch bản' },
        { id: 'b', name: 'Tháng 11' },
      ],
    });
  });
  it('thư mục phòng khác thì không cho', async () => {
    expect(await locate('x', roots, meta)).toBeNull();
  });
  it('không lặp vô hạn khi cây vòng', async () => {
    const loop = async (id: string) => ({ name: id, parents: [id === 'p' ? 'q' : 'p'] });
    expect(await locate('p', roots, loop)).toBeNull();
  });
});

describe('fileKind', () => {
  it('nhận loại file', () => {
    expect(fileKind('application/vnd.google-apps.spreadsheet')).toBe('sheet');
    expect(fileKind('application/octet-stream', 'bao-cao.xlsx')).toBe('sheet');
    expect(fileKind('video/quicktime')).toBe('vid');
    expect(fileKind('application/vnd.google-apps.folder')).toBe('folder');
  });
});

describe('saKey', () => {
  it('đọc được khóa có BOM ở đầu (PowerShell chèn vào)', async () => {
    const { saKey } = await import('../../src/server/services/gdrive');
    const k = saKey('﻿{"client_email":"a@b.iam.gserviceaccount.com","private_key":"x"}\r\n');
    expect(k?.client_email).toBe('a@b.iam.gserviceaccount.com');
    expect(saKey('khong phai json')).toBeNull();
  });
});

describe('thư mục dùng chung chứa thư mục phòng', () => {
  // AILLA CENTER AI (chung, mọi người) chứa TEAM CONTENT (CM) và TEAM DIGITAL (ADS)
  const tree: Record<string, DriveMeta> = {
    center: { name: 'AILLA CENTER AI', parents: ['mydrive'] },
    content: { name: 'TEAM CONTENT', parents: ['center'] },
    digital: { name: 'TEAM DIGITAL', parents: ['center'] },
    dx: { name: 'Báo cáo Ads', parents: ['digital'] },
    brand: { name: 'BRAND ASSETS', parents: ['center'] },
  };
  const meta = async (id: string) => tree[id] ?? null;
  const cfg = normalizeConfig({
    teams: [
      { pb: 'CM', folderId: 'content', viewers: [] },
      { pb: 'ADS', folderId: 'digital', viewers: [] },
      { pb: 'chung1', folderId: 'center', viewers: ['all'], name: 'AILLA CENTER AI' },
    ],
  });
  it('mã thư mục sai dạng (quá ngắn) bị bỏ', () => expect(cfg.teams).toHaveLength(0));
  const cfg2 = { teams: [
    { pb: 'CM', folderId: 'content', viewers: [] },
    { pb: 'ADS', folderId: 'digital', viewers: [] },
    { pb: 'chung1', folderId: 'center', viewers: ['all'], name: 'AILLA CENTER AI' },
  ] };
  const nv = { phongBan: 'CM', role: 'content' };
  it('mọi người thấy thư mục chung', () => {
    expect(teamsFor(cfg2, nv, false).map((t) => t.pb)).toEqual(['CM', 'chung1']);
  });
  it('đi từ thư mục chung vào thư mục Digital thì bị chặn (gốc gần nhất là Digital)', async () => {
    const roots = rootsFor(cfg2, nv, false);
    expect((await locate('dx', roots, meta))?.pb).toBe('');
    expect((await locate('brand', roots, meta))?.pb).toBe('chung1');
    expect((await locate('content', roots, meta))?.pb).toBe('CM');
  });
  it('nhận tên thư mục chung và quyền all', () => {
    const c = normalizeConfig({ teams: [{ pb: 'chung1', folderId: ID_CM, viewers: ['all', 'bad'], name: '  Kho ảnh  ' }] });
    expect(c.teams[0]).toEqual({ pb: 'chung1', folderId: ID_CM, viewers: ['all'], name: 'Kho ảnh' });
  });
});
