import { describe, expect, it } from 'vitest';
import { canSeeTeam, fileKind, folderIdFrom, locate, normalizeConfig, teamsFor, type DriveMeta } from '../../src/server/lib/driveAccess';

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
