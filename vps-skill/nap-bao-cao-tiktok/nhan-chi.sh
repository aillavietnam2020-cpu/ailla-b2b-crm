#!/bin/bash
# Nhắn chị Hoa khi cần chị làm một việc (vd nhập mật khẩu Shopee): gửi Telegram từ bot Kế toán trưởng
# và hiện luôn trong khung chat agent Kế toán trưởng trên web ABOS (Điều hành agent).
#   nhan-chi.sh "nội dung"
MSG="$1"; AG=ke-toan-truong-ailla; [ -z "$MSG" ] && { echo "Thiếu nội dung"; exit 1; }
export XDG_RUNTIME_DIR=/run/user/0
openclaw message send --channel telegram --account "$AG" --target 8959489474 -m "$MSG" >/dev/null 2>&1 && echo "Đã nhắn Telegram" || echo "Không nhắn được Telegram"
set -a; . /root/.config/abos-relay.env 2>/dev/null; set +a
python3 - "$MSG" "$AG" <<'PY'
import json,os,sys,time,urllib.request
ts=int(time.time()*1000)
b={"items":[{"agent":sys.argv[2],"role":"AGENT","body":sys.argv[1],"ext_id":"nap-san-%d"%ts,"ts":ts}]}
try:
    r=urllib.request.Request(os.environ.get("ABOS_URL","https://vanhanh.ailla.vn").rstrip("/")+"/api/agent-relay/sync",data=json.dumps(b).encode(),method="POST",
        headers={"Content-Type":"application/json","User-Agent":"abos-relay/2","X-Relay-Key":os.environ.get("ABOS_RELAY_KEY","")})
    print("Đã hiện trên web" if urllib.request.urlopen(r,timeout=30).status==200 else "Web không nhận")
except Exception as e:
    print("Web không nhận:",str(e)[:80])
PY
