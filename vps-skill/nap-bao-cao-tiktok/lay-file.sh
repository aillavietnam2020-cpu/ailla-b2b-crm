#!/bin/bash
# Sau khi đã bat-tai.sh và bấm nút tải: đọc đường link file vừa bắt được rồi VPS tự tải về (không qua máy chị).
#   lay-file.sh <tab> <đường dẫn file lưu trên VPS> [số giây chờ, mặc định 60]
TAB="$1"; OUT="$2"; WAIT="${3:-60}"
[ -z "$TAB" ] || [ -z "$OUT" ] && { echo "Cách dùng: lay-file.sh t5 /root/bao-cao-san/2026-10/03_campaign.xlsx"; exit 1; }
export XDG_RUNTIME_DIR=/run/user/0
mkdir -p "$(dirname "$OUT")"
for i in $(seq 1 "$WAIT"); do
  U=$(openclaw browser --browser-profile chrome evaluate --target-id "$TAB" --fn '() => (window.__cap||[]).filter(u=>/^https?:/.test(u)).pop()||""' 2>/dev/null | tail -1 | sed 's/^"//; s/"$//')
  [ -n "$U" ] && [ "$U" != "null" ] && break
  sleep 1
done
[ -z "$U" ] || [ "$U" = "null" ] && { echo "Chưa bắt được link file. Kiểm tra đã chạy bat-tai.sh trước khi bấm tải, rồi bấm lại."; exit 2; }
CODE=$(curl -s -L -o "$OUT" -w "%{http_code}" "$U")
openclaw browser --browser-profile chrome evaluate --target-id "$TAB" --fn '() => { window.__cap=[]; return "ok" }' >/dev/null 2>&1
SIZE=$(stat -c %s "$OUT" 2>/dev/null || echo 0)
[ "$CODE" != "200" ] || [ "$SIZE" -lt 200 ] && { echo "Tải hỏng (http $CODE, $SIZE byte). Bấm tải lại."; exit 3; }
echo "Đã lấy: $OUT ($SIZE byte, $(file -b "$OUT" | cut -c1-40))"
