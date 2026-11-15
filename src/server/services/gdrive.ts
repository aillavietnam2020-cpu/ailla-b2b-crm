import { AppError } from '../lib/http';
import type { DriveMeta } from '../lib/driveAccess';

/**
 * Đọc Google Drive bằng tài khoản máy (service account) của web, quyền CHỈ XEM (drive.readonly).
 * Tài khoản máy chỉ thấy những thư mục chị Hoa chia sẻ cho email của nó; web không sửa, không xóa gì trên Drive.
 * Khóa JSON của tài khoản máy đặt bằng `wrangler secret put GDRIVE_SA_JSON` (file .bat chị tự chạy), không ghi vào mã nguồn.
 */
type SaKey = { client_email: string; private_key: string };

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const API = 'https://www.googleapis.com/drive/v3';
const COMMON = 'supportsAllDrives=true&includeItemsFromAllDrives=true';
export const FILE_FIELDS =
  'id,name,mimeType,modifiedTime,size,webViewLink,parents,hasThumbnail,lastModifyingUser(displayName),shortcutDetails(targetId,targetMimeType)';

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
  lastModifyingUser?: { displayName?: string };
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
  hasThumbnail?: boolean;
};

export function saKey(json: string | undefined): SaKey | null {
  if (!json) return null;
  try {
    // Bỏ ký tự BOM mà PowerShell trên Windows tự chèn vào đầu khi đặt khóa (NOI-GOOGLE-DRIVE.bat).
    const k = JSON.parse(json.replace(/^﻿/, '').trim()) as Partial<SaKey>;
    return k.client_email && k.private_key ? { client_email: k.client_email, private_key: k.private_key } : null;
  } catch {
    return null;
  }
}

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Quyền đầy đủ chỉ dùng cho việc cấp / gỡ quyền chia sẻ theo danh sách nhân viên (driveSync.ts); mọi chỗ khác dùng quyền chỉ xem. */
const SCOPE_SHARE = 'https://www.googleapis.com/auth/drive';
const TOKENS = new Map<string, { value: string; exp: number }>();

async function accessToken(key: SaKey, scope = SCOPE): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const hit = TOKENS.get(`${key.client_email}|${scope}`);
  if (hit && hit.exp - 120 > now) return hit.value;
  const pem = key.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0));
  const pk = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({ iss: key.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }),
  )}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pk, new TextEncoder().encode(unsigned));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${b64url(sig)}`,
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!r.ok || !j.access_token) {
    console.error('[drive] token', r.status);
    throw new AppError(502, 'DRIVE_AUTH', 'Web chưa đăng nhập được Google Drive (khóa tài khoản máy sai hoặc đã bị xóa).');
  }
  TOKENS.set(`${key.client_email}|${scope}`, { value: j.access_token, exp: now + (j.expires_in ?? 3600) });
  return j.access_token;
}

async function get<T>(key: SaKey, url: string): Promise<T | null> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(key)}` } });
  if (r.status === 404) return null;
  if (!r.ok) {
    console.error('[drive]', r.status, url.replace(/\?.*/, ''));
    if (r.status === 403 || r.status === 401) return null;
    throw new AppError(502, 'DRIVE_ERROR', 'Google Drive đang lỗi, thử lại sau ít phút.');
  }
  return (await r.json()) as T;
}

/* Bộ nhớ tạm trong máy chủ: tên + cha của thư mục ít đổi, giữ 10 phút; danh sách trong thư mục giữ 30 giây. */
const META = new Map<string, { v: DriveMeta | null; at: number }>();
const LIST = new Map<string, { v: DriveFile[]; at: number }>();

export async function meta(key: SaKey, id: string): Promise<DriveMeta | null> {
  const hit = META.get(id);
  // Không đọc được (chưa chia sẻ) chỉ nhớ 30 giây: chia sẻ xong là web thấy ngay.
  if (hit && Date.now() - hit.at < (hit.v ? 600_000 : 30_000)) return hit.v;
  const f = await get<DriveFile>(key, `${API}/files/${encodeURIComponent(id)}?fields=id,name,parents,trashed&${COMMON}`);
  const v = f && !(f as { trashed?: boolean }).trashed ? { name: f.name, parents: f.parents ?? [] } : null;
  if (META.size > 5000) META.clear();
  META.set(id, { v, at: Date.now() });
  return v;
}

async function listQuery(key: SaKey, q: string, orderBy: string, max: number): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let page = '';
  do {
    const url =
      `${API}/files?q=${encodeURIComponent(q)}&orderBy=${encodeURIComponent(orderBy)}&pageSize=${Math.min(max, 200)}` +
      `&fields=${encodeURIComponent(`nextPageToken,files(${FILE_FIELDS})`)}&${COMMON}&corpora=allDrives${page ? `&pageToken=${page}` : ''}`;
    const j = await get<{ files?: DriveFile[]; nextPageToken?: string }>(key, url);
    if (!j) break;
    out.push(...(j.files ?? []));
    page = j.nextPageToken ?? '';
  } while (page && out.length < max);
  for (const f of out) META.set(f.id, { v: { name: f.name, parents: f.parents ?? [] }, at: Date.now() });
  return out.slice(0, max);
}

/** Thư mục con và file nằm ngay trong một thư mục (thư mục trước, mới sửa trước). */
export async function children(key: SaKey, folderId: string): Promise<DriveFile[]> {
  const hit = LIST.get(folderId);
  if (hit && Date.now() - hit.at < 30_000) return hit.v;
  const v = await listQuery(key, `'${folderId}' in parents and trashed = false`, 'folder,modifiedTime desc', 1000);
  if (LIST.size > 500) LIST.clear();
  LIST.set(folderId, { v, at: Date.now() });
  return v;
}

/** File (không tính thư mục) tài khoản máy thấy được, mới sửa trước; có `name` thì lọc theo tên. */
export async function recentFiles(key: SaKey, name: string, max: number): Promise<DriveFile[]> {
  const n = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `trashed = false and mimeType != 'application/vnd.google-apps.folder'${n ? ` and name contains '${n}'` : ''}`;
  return listQuery(key, q, 'modifiedTime desc', max);
}

/* ---------- Đào tạo (routes/daoTao.ts): đọc nội dung một Google Docs để hiện trong tài liệu đào tạo. Vẫn chỉ xem. ---------- */
export async function fileInfo(key: SaKey, id: string): Promise<DriveFile | null> {
  const f = await get<DriveFile & { trashed?: boolean }>(key, `${API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(FILE_FIELDS + ',trashed')}&${COMMON}`);
  return f && !f.trashed ? f : null;
}

/** Nội dung Google Docs dạng markdown (Drive xuất sẵn); không được thì lấy chữ thường. File không phải Google Docs trả null. */
export async function exportDocText(key: SaKey, id: string): Promise<string | null> {
  const token = await accessToken(key);
  for (const mime of ['text/markdown', 'text/plain']) {
    const r = await fetch(`${API}/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(mime)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) return await r.text();
    if (r.status === 401 || r.status === 403 || r.status === 404) return null;
  }
  return null;
}

/* ---------- Quyền chia sẻ thư mục (chỉ driveSync.ts gọi) ---------- */
export type DrivePermission = { id: string; emailAddress?: string; role: string; type: string };

async function shareCall(key: SaKey, method: string, url: string, body?: unknown): Promise<{ ok: boolean; status: number; json: unknown }> {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await accessToken(key, SCOPE_SHARE)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) console.error('[drive share]', method, r.status, url.replace(/\?.*/, ''));
  return { ok: r.ok, status: r.status, json };
}

export async function listPermissions(key: SaKey, fileId: string): Promise<DrivePermission[] | null> {
  const out: DrivePermission[] = [];
  let page = '';
  do {
    const r = await shareCall(key, 'GET', `${API}/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&pageSize=100&fields=nextPageToken,permissions(id,emailAddress,role,type)${page ? `&pageToken=${page}` : ''}`);
    if (!r.ok) return null;
    const j = r.json as { permissions?: DrivePermission[]; nextPageToken?: string };
    out.push(...(j.permissions ?? []));
    page = j.nextPageToken ?? '';
  } while (page);
  return out;
}

/** Cấp quyền cho một email (không gửi thư báo). */
export async function addPermission(key: SaKey, fileId: string, email: string, role: 'writer' | 'reader') {
  return (await shareCall(key, 'POST', `${API}/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, { type: 'user', role, emailAddress: email })).ok;
}
export async function setPermissionRole(key: SaKey, fileId: string, permId: string, role: 'writer' | 'reader') {
  return (await shareCall(key, 'PATCH', `${API}/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permId)}?supportsAllDrives=true`, { role })).ok;
}
export async function removePermission(key: SaKey, fileId: string, permId: string) {
  return (await shareCall(key, 'DELETE', `${API}/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permId)}?supportsAllDrives=true`)).ok;
}

/** Ảnh thu nhỏ của file (Drive tự tạo cho ảnh, video, PDF, Docs…). Trả ảnh để máy chủ chuyển tiếp; không có thì null. */
export async function thumbnail(key: SaKey, fileId: string, size = 400): Promise<Response | null> {
  const f = await get<{ thumbnailLink?: string }>(key, `${API}/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&${COMMON}`);
  if (!f?.thumbnailLink) return null;
  const url = f.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(key)}` } });
  return r.ok ? r : null;
}

/**
 * Phát video ngay trên web (nút "Xem" ở Duyệt video, chị Hoa 07/11/2026): chuyển tiếp dữ liệu từ Drive, giữ yêu cầu
 * "Range" để trình duyệt tua được. Chỉ nhận file video; file khác trả null.
 */
export async function streamVideo(key: SaKey, fileId: string, range: string | null): Promise<Response | null> {
  const f = await get<{ mimeType: string }>(key, `${API}/files/${encodeURIComponent(fileId)}?fields=mimeType&${COMMON}`);
  if (!f || !f.mimeType.startsWith('video/')) return null;
  const h: Record<string, string> = { Authorization: `Bearer ${await accessToken(key)}` };
  if (range && /^bytes=\d*-\d*$/.test(range)) h.Range = range;
  const r = await fetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, { headers: h });
  if (!r.ok && r.status !== 206) {
    console.error('[drive] video', r.status);
    return null;
  }
  const out = new Headers({ 'Content-Type': f.mimeType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=600', 'Content-Disposition': 'inline' });
  for (const k of ['Content-Length', 'Content-Range']) {
    const v = r.headers.get(k);
    if (v) out.set(k, v);
  }
  return new Response(r.body, { status: r.status, headers: out });
}

/** Tải file gốc (đúng độ phân giải, đúng dung lượng như trên Drive). File Google Docs / Sheets / Slides không có bản gốc để tải: trả null. */
export async function download(key: SaKey, fileId: string): Promise<{ body: ReadableStream | null; name: string; mime: string; size: string | null } | null> {
  const f = await get<{ name: string; mimeType: string }>(key, `${API}/files/${encodeURIComponent(fileId)}?fields=name,mimeType&${COMMON}`);
  if (!f || f.mimeType.startsWith('application/vnd.google-apps')) return null;
  const r = await fetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${await accessToken(key)}` },
  });
  if (!r.ok) {
    console.error('[drive] download', r.status);
    return null;
  }
  return { body: r.body, name: f.name, mime: r.headers.get('Content-Type') ?? f.mimeType, size: r.headers.get('Content-Length') };
}
