import { describe, expect, it } from 'vitest';
import {
  canEditDoc,
  canSeeDoc,
  canTrack,
  driveIdFrom,
  fromDriveMarkdown,
  gradeQuiz,
  isEditor,
  membersFromHub,
  publishStatus,
  requiredFor,
  viewerOf,
} from '../../src/server/services/daoTao';

const m = membersFromHub({
  users: [
    { crm: 'ceo', name: 'Chị Hoa', role: 'admin', phongBan: 'BDH' },
    { crm: 'hcns', name: 'HCNS', role: 'nhanvien', phongBan: 'HCNS' },
    { crm: 'qlkd', name: 'QL KD', role: 'truongphong', phongBan: 'KD' },
    { crm: 'nvkd', name: 'NV KD', role: 'nhanvien', phongBan: 'KD' },
    { crm: 'nvkho', name: 'NV Kho', role: 'nhanvien', phongBan: 'KHO' },
    { crm: 'nghi', name: 'Đã nghỉ', role: 'nhanvien', phongBan: 'KD', active: false },
    { name: 'Không có tài khoản', role: 'nhanvien', phongBan: 'KD' },
  ],
  departments: [{ k: 'KD', n: 'Kinh doanh' }, { k: 'KHO', n: 'Kho' }],
});
const V = (id: string, role = '', scopes: string[] = []) => viewerOf(id, role, m, scopes);
const teamKD = { nhom: 'team', teams: ['KD'], status: 'dang' };
const chung = { nhom: 'chung', teams: [], status: 'dang' };

describe('Đào tạo: danh sách người tin cậy', () => {
  it('bỏ người đã nghỉ và người không có tài khoản', () => {
    expect(Object.keys(m.users).sort()).toEqual(['ceo', 'hcns', 'nvkd', 'nvkho', 'qlkd']);
    expect(m.users.hcns.hr).toBe(true);
    expect(m.deps).toHaveLength(2);
  });
});

describe('Đào tạo: ai xem được', () => {
  it('tài liệu Chung và Sổ tay web: mọi người', () => {
    for (const id of ['nvkd', 'nvkho', 'qlkd']) {
      expect(canSeeDoc(V(id), chung)).toBe(true);
      expect(canSeeDoc(V(id), { ...chung, nhom: 'web' })).toBe(true);
    }
  });
  it('tài liệu team: chỉ team đó, CEO, nhân sự', () => {
    expect(canSeeDoc(V('nvkd'), teamKD)).toBe(true);
    expect(canSeeDoc(V('qlkd'), teamKD)).toBe(true);
    expect(canSeeDoc(V('nvkho'), teamKD)).toBe(false);
    expect(canSeeDoc(V('hcns'), teamKD)).toBe(true);
    expect(canSeeDoc(V('ceo'), teamKD)).toBe(true);
    expect(canSeeDoc(V('x', 'CEO'), teamKD)).toBe(true);
  });
  it('người lạ (chưa có trong danh sách) không thấy tài liệu team', () => {
    expect(canSeeDoc(V('la'), teamKD)).toBe(false);
    expect(canSeeDoc(V('la'), chung)).toBe(true);
  });
  it('bản nháp chỉ người soạn được thấy; chờ duyệt thì CEO thấy', () => {
    expect(canSeeDoc(V('nvkd'), { ...teamKD, status: 'nhap' })).toBe(false);
    expect(canSeeDoc(V('qlkd'), { ...teamKD, status: 'nhap' })).toBe(true);
    expect(canSeeDoc(V('nvkd'), { ...chung, status: 'cho_duyet' })).toBe(false);
    expect(canSeeDoc(V('ceo'), { ...chung, status: 'cho_duyet' })).toBe(true);
  });
});

describe('Đào tạo: ai soạn được', () => {
  it('quản lý chỉ soạn tài liệu team mình', () => {
    expect(canEditDoc(V('qlkd'), teamKD)).toBe(true);
    expect(canEditDoc(V('qlkd'), { nhom: 'team', teams: ['KD', 'KHO'] })).toBe(false);
    expect(canEditDoc(V('qlkd'), chung)).toBe(false);
  });
  it('nhân viên thường không soạn được, trừ khi CEO giao', () => {
    expect(isEditor(V('nvkd'))).toBe(false);
    expect(canEditDoc(V('nvkd'), teamKD)).toBe(false);
    expect(canEditDoc(V('nvkd', '', ['team:KD']), teamKD)).toBe(true);
    expect(canEditDoc(V('nvkd', '', ['web']), { nhom: 'web', teams: [] })).toBe(true);
    expect(canSeeDoc(V('nvkho', '', ['team:KD']), teamKD)).toBe(true);
  });
  it('ai không phải CEO đăng tài liệu đều phải chờ CEO duyệt', () => {
    expect(canEditDoc(V('hcns'), chung)).toBe(true);
    expect(publishStatus(V('hcns'), 'chung')).toBe('cho_duyet');
    expect(publishStatus(V('hcns'), 'web')).toBe('cho_duyet');
    expect(publishStatus(V('qlkd'), 'team')).toBe('cho_duyet');
    expect(publishStatus(V('ceo'), 'chung')).toBe('dang');
  });
});

describe('Đào tạo: theo dõi, bắt buộc, kiểm tra', () => {
  it('quản lý chỉ theo dõi người cùng phòng', () => {
    expect(canTrack(V('qlkd'), m.users.nvkd)).toBe(true);
    expect(canTrack(V('qlkd'), m.users.nvkho)).toBe(false);
    expect(canTrack(V('nvkd'), m.users.nvkd)).toBe(false);
    expect(canTrack(V('hcns'), m.users.nvkho)).toBe(true);
  });
  it('bắt buộc với nhân viên mới / mọi người', () => {
    expect(requiredFor({ bat_buoc: 'moi' }, true)).toBe(true);
    expect(requiredFor({ bat_buoc: 'moi' }, false)).toBe(false);
    expect(requiredFor({ bat_buoc: 'tat_ca' }, false)).toBe(true);
    expect(requiredFor({ bat_buoc: 'khong' }, true)).toBe(false);
  });
  it('đúng 4/5 là đạt, 3/5 chưa đạt, không có câu hỏi thì đạt', () => {
    const q = [0, 1, 2, 0, 1].map((a) => ({ q: 'c', o: ['a', 'b', 'c'], a }));
    expect(gradeQuiz(q, [0, 1, 2, 0, 0]).pass).toBe(true);
    expect(gradeQuiz(q, [0, 1, 0, 0, 0]).pass).toBe(false);
    expect(gradeQuiz([], undefined).pass).toBe(true);
  });
});

describe('Đào tạo: lấy nội dung Google Docs', () => {
  it('đọc mã file từ link', () => {
    expect(driveIdFrom('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp_q-r/edit?usp=sharing')).toBe('1AbCdEfGhIjKlMnOp_q-r');
    expect(driveIdFrom('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp')).toBe('1AbCdEfGhIjKlMnOp');
    expect(driveIdFrom('abc')).toBeNull();
    expect(driveIdFrom('')).toBeNull();
  });
  it('đổi markdown của Google sang kiểu chữ tài liệu', () => {
    const md = ['# **Nội quy**', '### Mục nhỏ', '* Gạch đầu dòng', '  * Dòng con', '1\. Bước một', 'Giờ làm 8:30 \- 17:30, *nghiêng*', '![][image1]', '', '', '', '[image1]: <data:image/png;base64,AAAA>'].join('\n');
    expect(fromDriveMarkdown(md)).toBe(['# **Nội quy**', '## Mục nhỏ', '- Gạch đầu dòng', '- Dòng con', '1. Bước một', 'Giờ làm 8:30 - 17:30, nghiêng'].join('\n'));
  });
});
