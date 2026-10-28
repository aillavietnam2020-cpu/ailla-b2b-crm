#!/bin/bash
# Sau khi đã bat-tai.sh và bấm nút tải: đọc đường link file vừa bắt được rồi đưa file về VPS (không qua ổ đĩa máy chị).
#   lay-file.sh <tab> <đường dẫn file lưu trên VPS> [số giây chờ, mặc định 60]
# Link ký sẵn (quảng cáo GMV Max) thì VPS tải thẳng. Link cần đăng nhập (quyết toán income, đơn hàng) thì trang tự tải
# bằng phiên đăng nhập của Chrome rồi chuyển từng phần về VPS (đã thử 28/10: income 2,9MB, đơn 10MB).
TAB="$1"; OUT="$2"; WAIT="${3:-60}"
[ -z "$TAB" ] || [ -z "$OUT" ] && { echo "Cách dùng: lay-file.sh t5 /root/bao-cao-san/2026-10/03_campaign.xlsx"; exit 1; }
export XDG_RUNTIME_DIR=/run/user/0
B="openclaw browser --browser-profile chrome"
mkdir -p "$(dirname "$OUT")"
for i in $(seq 1 "$WAIT"); do
  U=$($B evaluate --target-id "$TAB" --fn '() => (window.__cap||[]).filter(u=>/^https?:/.test(u)).pop()||""' 2>/dev/null | tail -1 | sed 's/^"//; s/"$//')
  [ -n "$U" ] && [ "$U" != "null" ] && break
  sleep 1
done
[ -z "$U" ] || [ "$U" = "null" ] && { echo "Chưa bắt được link file. Kiểm tra đã chạy bat-tai.sh trước khi bấm tải, rồi bấm lại."; exit 2; }
CODE=$(curl -s -L -o "$OUT" -w "%{http_code}" "$U")
SIZE=$(stat -c %s "$OUT" 2>/dev/null || echo 0)
if [ "$CODE" != "200" ] || [ "$SIZE" -lt 200 ]; then
  # Cần đăng nhập: trang tự tải rồi chuyển về VPS từng phần.
  N=$($B evaluate --target-id "$TAB" --timeout-ms 300000 --fn 'async () => { const u=(window.__cap||[]).filter(x=>/^https?:/.test(x)).pop(); const r=await fetch(u,{credentials:"include"}); if(!r.ok) return "ERR "+r.status; const b=new Uint8Array(await r.arrayBuffer()); let s=""; for(let i=0;i<b.length;i+=32768){ s+=String.fromCharCode.apply(null,b.subarray(i,i+32768)) } window.__b64=btoa(s); return String(window.__b64.length) }' 2>/dev/null | tail -1 | tr -d '"')
  case "$N" in ''|ERR*) echo "Tải hỏng ($N). Bấm tải lại."; exit 3;; esac
  TMP="$OUT.b64"; : > "$TMP"; C=180000
  for ((o=0;o<N;o+=C)); do $B evaluate --target-id "$TAB" --fn "() => window.__b64.slice($o,$o+$C)" 2>/dev/null | tail -1 | sed 's/^"//; s/"$//' | tr -d '\n' >> "$TMP"; done
  [ "$(stat -c %s "$TMP")" = "$N" ] || { echo "Chuyển file thiếu phần. Chạy lại lay-file.sh."; rm -f "$TMP"; exit 4; }
  base64 -d "$TMP" > "$OUT"; rm -f "$TMP"
  $B evaluate --target-id "$TAB" --fn '() => { delete window.__b64; return 1 }' >/dev/null 2>&1
fi
$B evaluate --target-id "$TAB" --fn '() => { window.__cap=[]; return "ok" }' >/dev/null 2>&1
SIZE=$(stat -c %s "$OUT" 2>/dev/null || echo 0)
echo "Đã lấy: $OUT ($SIZE byte, $(file -b "$OUT" | cut -c1-40))"
