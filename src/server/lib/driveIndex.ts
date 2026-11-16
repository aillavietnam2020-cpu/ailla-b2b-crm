/**
 * Mục lục file của Thư mục làm việc (chị Hoa duyệt demo 16/11/2026): số file từng thư mục con, danh sách file kèm
 * "nằm ở đâu", tìm không dấu, việc cần xử lý (file lạc chỗ, tên chưa rõ, thư mục lâu không cập nhật).
 * Hàm thuần, không gọi Drive hay D1, để kiểm thử được. Máy chủ quét Drive ở services/driveIndex.ts.
 */
export type IdxFile = {
  i: string; // mã file trên Drive
  n: string; // tên
  k: string; // loại (fileKind)
  s: string; // thư mục con cấp 1 chứa file ('' = nằm ngay thư mục gốc)
  w: string; // đường dẫn dưới gốc, vd "MEDIA AILLA › THÁNG 11"
  m: string | null; // sửa lúc
  c: string | null; // tạo lúc
  b: string; // người sửa cuối (tên trên Google)
  z: number | null; // dung lượng
  l: string; // link mở trên Drive
  d: boolean; // tải được bản gốc (không phải Google Tài liệu / Trang tính)
  t: boolean; // có ảnh thu nhỏ
};
export type IdxSub = { id: string; n: string; c: number; last: string | null };
export type TeamIdx = { pb: string; root: string; at: string; subs: IdxSub[]; files: IdxFile[]; cut: boolean };

/** Bỏ dấu tiếng Việt, chữ thường: "Bột tẩy" → "bot tay". */
export const vnFold = (s: string) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Đếm file theo thư mục con cấp 1 (đếm cả file nằm sâu bên trong) và lần sửa mới nhất. */
export function countSubs(subs: { id: string; n: string }[], files: IdxFile[]): IdxSub[] {
  return subs.map((s) => {
    const fs = files.filter((f) => f.s === s.n);
    const last = fs.reduce<string | null>((a, f) => (f.m && (!a || f.m > a) ? f.m : a), null);
    return { id: s.id, n: s.n, c: fs.length, last };
  });
}

export type TodoItem = { lv: 'r' | 'a' | 'b'; k: string; pb: string; i?: string; tx: string; sub: string };

const COPY_RE = /^(bản sao của|copy of)\s/i;
const BAD_NAME_RE = /^(untitled|không có tiêu đề|tài liệu không có tiêu đề|bảng tính không có tiêu đề)|final[\s_-]*final|\(\d+\)(\.[a-z0-9]{2,5})?$/i;
const DAY = 86_400_000;

/**
 * Việc cần xử lý trong một thư mục (web chỉ nhắc, không tự xóa hay chuyển file):
 *  - "Bản sao lạc chỗ": file "Bản sao của…" / "Copy of…".
 *  - "Chưa xếp thư mục": file nằm ngay thư mục gốc, chưa vào thư mục con nào (lối tắt thì bỏ qua).
 *  - "Tên chưa rõ": Untitled, "final final", "(1)".
 *  - "Lâu không cập nhật": thư mục con của phòng (không tính thư mục dùng chung) 30 ngày không có file mới.
 * Thư mục dùng chung chỉ nhắc "Bản sao lạc chỗ".
 */
export function todoFor(idx: TeamIdx, name: string, shared: boolean, now: number): TodoItem[] {
  const out: TodoItem[] = [];
  const at = (f: IdxFile) => `${name}${f.w ? ' › ' + f.w : ''}`;
  for (const f of idx.files) {
    if (COPY_RE.test(f.n)) out.push({ lv: 'r', k: 'Bản sao lạc chỗ', pb: idx.pb, i: f.i, tx: f.n, sub: at(f) });
    // Thư mục dùng chung (kho ảnh, video đối tác, thư mục chung công ty) chỉ nhắc bản sao, tránh báo hàng trăm tên file máy quay.
    else if (shared) continue;
    else if (!f.s && f.k !== 'link') out.push({ lv: 'a', k: 'Chưa xếp thư mục', pb: idx.pb, i: f.i, tx: f.n, sub: `${name} · nằm ngay thư mục gốc` });
    else if (BAD_NAME_RE.test(f.n.trim())) out.push({ lv: 'a', k: 'Tên chưa rõ', pb: idx.pb, i: f.i, tx: f.n, sub: at(f) });
  }
  if (!shared)
    for (const s of idx.subs)
      if (s.c && s.last && now - Date.parse(s.last) > 30 * DAY)
        out.push({ lv: 'b', k: 'Lâu không cập nhật', pb: idx.pb, tx: `${s.n} 30 ngày không có file mới`, sub: `${name} › ${s.n}` });
  return out;
}

/** Số file thêm mới / được sửa trong 7 ngày. */
export function weekStats(files: IdxFile[], now: number) {
  const from = now - 7 * DAY;
  return {
    added: files.filter((f) => f.c && Date.parse(f.c) >= from).length,
    edited: files.filter((f) => f.m && Date.parse(f.m) >= from).length,
  };
}

/** Tìm không dấu theo tên file, thư mục, người sửa. */
export function searchIdx(files: IdxFile[], q: string, limit = 60): IdxFile[] {
  const words = vnFold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out: IdxFile[] = [];
  for (const f of files) {
    const hay = vnFold(`${f.n} ${f.w} ${f.b}`);
    if (words.every((w) => hay.includes(w))) out.push(f);
  }
  return out.sort((a, b) => (b.m ?? '').localeCompare(a.m ?? '')).slice(0, limit);
}

/**
 * Sửa mục lục sau khi chuyển một file hoặc một thư mục con cấp 1 trên Drive (không phải quét lại cả thư mục).
 * `toSub` = '' là chuyển vào thư mục gốc của phòng đích, khác '' là vào thư mục con cấp 1 tên đó.
 * src và dst có thể là cùng một mục lục (chuyển trong cùng phòng). Không thấy file / thư mục thì trả null.
 */
export function moveInIdx(src: TeamIdx, dst: TeamIdx, id: string, toSub: string): { src: TeamIdx; dst: TeamIdx } | null {
  const same = src === dst || src.pb === dst.pb;
  const s: TeamIdx = { ...src, files: [...src.files], subs: [...src.subs] };
  const d: TeamIdx = same ? s : { ...dst, files: [...dst.files], subs: [...dst.subs] };
  const fi = s.files.findIndex((f) => f.i === id);
  const si = s.subs.findIndex((x) => x.id === id);
  if (fi >= 0) {
    const [f] = s.files.splice(fi, 1);
    d.files.push({ ...f, s: toSub, w: toSub });
  } else if (si >= 0) {
    const [sub] = s.subs.splice(si, 1);
    const moved = s.files.filter((f) => f.s === sub.n);
    s.files = s.files.filter((f) => f.s !== sub.n);
    if (toSub) d.files.push(...moved.map((f) => ({ ...f, s: toSub, w: `${toSub} › ${f.w}` })));
    else {
      d.files.push(...moved);
      d.subs.push({ id: sub.id, n: sub.n, c: 0, last: null });
    }
  } else return null;
  s.subs = countSubs(s.subs, s.files);
  if (!same) d.subs = countSubs(d.subs, d.files);
  return { src: s, dst: d };
}

/** Thêm thư mục con cấp 1 mới (vừa tạo trên Drive) vào mục lục. */
export function addSubToIdx(idx: TeamIdx, sub: { id: string; n: string }): TeamIdx {
  return { ...idx, subs: countSubs([...idx.subs, sub], idx.files) };
}
