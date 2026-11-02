-- Đào tạo & onboarding (web vận hành › Đào tạo), chị Hoa duyệt demo 02/11/2026. Chỉ THÊM bảng mới.
-- nhom   : chung (mọi nhân viên) | web (sổ tay web vận hành, mọi nhân viên) | team (chỉ các phòng ban trong teams + quản lý + CEO/HCNS)
-- teams  : JSON mảng mã phòng ban (d.departments[].k), chỉ dùng khi nhom = team
-- status : nhap (nháp) | cho_duyet (tài liệu Chung chờ CEO duyệt) | dang (đang hiện) | an (đã gỡ)
-- bat_buoc: moi (nhân viên mới phải đọc) | tat_ca (mọi người trong nhóm xem phải đọc) | khong
-- lo_trinh: d1 | w1 | m1 | '' (không đưa vào lộ trình onboarding)
-- quiz   : JSON [{q, o:[...], a: số thứ tự đáp án đúng}] — máy chủ chấm, không gửi đáp án cho người đọc
CREATE TABLE IF NOT EXISTS dt_doc (
  id TEXT PRIMARY KEY,
  nhom TEXT NOT NULL DEFAULT 'chung',
  teams TEXT NOT NULL DEFAULT '[]',
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'nhap',
  bat_buoc TEXT NOT NULL DEFAULT 'khong',
  lo_trinh TEXT NOT NULL DEFAULT '',
  han_ngay INTEGER NOT NULL DEFAULT 7,
  quiz TEXT NOT NULL DEFAULT '[]',
  sort INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  approved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_dt_doc_status ON dt_doc (status, nhom);

-- Người đọc bấm "Tôi đã đọc và hiểu": lưu bản (version) đã xác nhận; tài liệu lên bản mới thì phải xác nhận lại.
CREATE TABLE IF NOT EXISTS dt_ack (
  doc_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  score INTEGER,
  at TEXT NOT NULL,
  PRIMARY KEY (doc_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_dt_ack_user ON dt_ack (user_id);

-- Nhân viên mới: ngày vào làm + người kèm (quản lý / HCNS ghi). done_at: quản lý bấm xong onboarding.
CREATE TABLE IF NOT EXISTS dt_newbie (
  user_id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  mentor_id TEXT NOT NULL DEFAULT '',
  done_at TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

-- Người được CEO giao quyền soạn thêm (ngoài CEO, HCNS, quản lý team tự có quyền team mình).
-- scopes: JSON mảng 'chung' | 'web' | 'team:<mã phòng ban>'
CREATE TABLE IF NOT EXISTS dt_editor (
  user_id TEXT PRIMARY KEY,
  scopes TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

-- "Hỏi người soạn" dưới mỗi tài liệu.
CREATE TABLE IF NOT EXISTS dt_hoi (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  answer TEXT,
  answered_by TEXT,
  answered_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dt_hoi_doc ON dt_hoi (doc_id);

-- Ảnh chụp màn hình chèn trong tài liệu (chỉ ảnh, tối đa 1,5 MB, giống file hồ sơ nhân sự).
CREATE TABLE IF NOT EXISTS dt_img (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT ''
);
