#!/bin/bash
# Sau bat-tai-blob.sh và bấm tải: lấy file trang vừa tạo về VPS (không qua máy chị).
#   lay-blob.sh <tab> <đường dẫn file trên VPS> [số giây chờ, mặc định 120]
# File Tài chính Shopee tải về là .zip: tự giải nén, giữ file "Income…" (bỏ file "shopee_xi…").
TAB="$1"; OUT="$2"; WAIT="${3:-120}"; export XDG_RUNTIME_DIR=/run/user/0; B="openclaw browser --browser-profile chrome"
[ -z "$TAB" ] || [ -z "$OUT" ] && { echo "Cách dùng: lay-blob.sh t5 /root/bao-cao-san/2026-10/spe/01_DonHang_aillavn1_….xlsx"; exit 1; }
mkdir -p "$(dirname "$OUT")"
PICK='(window.__blobs||[]).filter(x=>x.size>200&&!/javascript|svg|html/.test(x.type))'
for i in $(seq 1 "$WAIT"); do
  C=$($B evaluate --target-id "$TAB" --fn "() => String($PICK.length)" 2>/dev/null | tail -1 | tr -d '"')
  [ -n "$C" ] && [ "$C" != "0" ] && break; sleep 1
done
[ -z "$C" ] || [ "$C" = "0" ] && { echo "Chưa bắt được file. Chạy lại bat-tai-blob.sh rồi bấm tải lại."; exit 2; }
N=$($B evaluate --target-id "$TAB" --timeout-ms 300000 --fn "async () => { const L=$PICK; const b=new Uint8Array(await L[L.length-1].arrayBuffer()); let s=''; for(let i=0;i<b.length;i+=32768){ s+=String.fromCharCode.apply(null,b.subarray(i,i+32768)) } window.__b64=btoa(s); return String(window.__b64.length) }" 2>/dev/null | tail -1 | tr -d '"')
case "$N" in ''|ERR*) echo "Tải hỏng ($N)"; exit 3;; esac
TMP="$OUT.b64"; : > "$TMP"; CH=180000
for ((o=0;o<N;o+=CH)); do $B evaluate --target-id "$TAB" --fn "() => window.__b64.slice($o,$o+$CH)" 2>/dev/null | tail -1 | sed 's/^"//; s/"$//' | tr -d '\n' >> "$TMP"; done
[ "$(stat -c %s "$TMP")" = "$N" ] || { echo "Chuyển file thiếu phần. Chạy lại lay-blob.sh."; rm -f "$TMP"; exit 4; }
base64 -d "$TMP" > "$OUT.tmp"; rm -f "$TMP"
$B evaluate --target-id "$TAB" --fn '() => { delete window.__b64; window.__blobs=[]; return 1 }' >/dev/null 2>&1
if [ "$(head -c 2 "$OUT.tmp")" = "PK" ] && python3 -c "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);sys.exit(0 if any(n.lower().endswith('.xlsx') for n in z.namelist()) and not any(n.startswith('xl/') for n in z.namelist()) else 1)" "$OUT.tmp"; then
  python3 -c "
import zipfile,sys
z=zipfile.ZipFile(sys.argv[1]);L=[n for n in z.namelist() if n.lower().endswith('.xlsx')]
L=sorted(L,key=lambda n:('shopee_xi' in n.lower(),n))
open(sys.argv[2],'wb').write(z.read(L[0]));print('giải nén:',len(L),'file, giữ 1')" "$OUT.tmp" "$OUT"; rm -f "$OUT.tmp"
else mv "$OUT.tmp" "$OUT"; fi
echo "Đã lấy: $OUT ($(stat -c %s "$OUT") byte, $(file -b "$OUT" | cut -c1-30))"
