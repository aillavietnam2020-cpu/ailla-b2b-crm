import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Logic công đoạn của Task giao việc (hub/src/congviec.js): làm lần lượt, song song, duyệt, trả lại, báo chuông. */
function load() {
  const src = readFileSync('hub/src/congviec.js', 'utf8');
  const a = src.indexOf('function tkActive(x)');
  const b = src.indexOf('/* Việc của tôi (mọi người)');
  const data: { tasks: any[]; settings: { today: number } } = { tasks: [], settings: { today: 20 } };
  const notes: Array<[string, string]> = [];
  const ME = { id: 'u_chi', name: 'Chị Hoa', role: 'admin' };
  const fn = new Function(
    'D',
    'DB',
    'ME',
    'notifyU',
    'dd',
    `${src.slice(a, b)}\nreturn {tkActive,tkSync,tkCdAct};`,
  );
  const api = fn(
    () => data,
    { mutate: (_u: string, _m: string, f: (d: unknown) => void) => f(data) },
    ME,
    (_dt: unknown, ids: string[], txt: string) => notes.push([ids.filter((i) => i !== ME.id).join(','), txt]),
    (n: number) => `${n}/10`,
  );
  return { data, notes, ...api };
}

const task = () => ({
  id: 't1',
  ten: 'Video sale',
  tao: 'u_chi',
  st: 'todo',
  cd: [
    { id: 'a', ten: 'Kịch bản', nguoi: 'u_q', han: 22, loai: 'lam', st: 'cho' },
    { id: 'b', ten: 'Quay', nguoi: 'u_m', han: 23, loai: 'lam', st: 'cho' },
    { id: 'c', ten: 'Duyệt', nguoi: 'u_chi', han: 25, loai: 'duyet', st: 'cho' },
  ],
});

describe('Công đoạn của việc giao', () => {
  it('làm lần lượt: xong bước này tới người sau, báo chuông, duyệt xong mới hoàn thành', () => {
    const h = load();
    const t: any = task();
    h.data.tasks.push(t);
    h.tkSync(t);
    expect([t.nguoi, t.han, t.st]).toEqual(['u_q', 22, 'todo']);
    h.tkCdAct('t1', 'a', 'xong');
    expect([t.nguoi, t.han, t.st]).toEqual(['u_m', 23, 'doing']);
    expect(h.notes.some(([to, tx]: [string, string]) => to === 'u_m' && /Đến lượt bạn/.test(tx))).toBe(true);
    h.tkCdAct('t1', 'b', 'xong');
    expect([t.nguoi, t.st]).toEqual(['u_chi', 'review']);
    h.tkCdAct('t1', 'c', 'xong');
    expect(t.st).toBe('done');
    expect(h.notes.some(([, tx]: [string, string]) => /đã xong hết/.test(tx))).toBe(true);
  });

  it('duyệt trả lại: mở lại công đoạn làm gần nhất và báo người làm', () => {
    const h = load();
    const t: any = task();
    h.data.tasks.push(t);
    h.tkSync(t);
    h.tkCdAct('t1', 'a', 'xong');
    h.tkCdAct('t1', 'b', 'xong');
    h.tkCdAct('t1', 'c', 'tra', 'Sửa hook');
    expect([t.cd[1].st, t.nguoi, t.st]).toEqual(['lam', 'u_m', 'doing']);
    expect(h.notes.some(([to, tx]: [string, string]) => to === 'u_m' && /trả lại/.test(tx))).toBe(true);
  });

  it('làm song song: mọi công đoạn chưa xong cùng đến lượt', () => {
    const h = load();
    const p: any = {
      id: 't2',
      ten: 'Song song',
      tao: 'u_chi',
      tuanTu: false,
      st: 'todo',
      cd: [
        { id: 'x', ten: 'A', nguoi: 'u_q', han: 21, loai: 'lam', st: 'cho' },
        { id: 'y', ten: 'B', nguoi: 'u_m', han: 22, loai: 'lam', st: 'cho' },
      ],
    };
    h.data.tasks.push(p);
    h.tkSync(p);
    expect(h.tkActive(p)).toHaveLength(2);
  });
});
