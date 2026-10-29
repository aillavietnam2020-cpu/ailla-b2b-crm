#!/usr/bin/env bash
# Chờ chị Hoa xử lý hộp mật khẩu / hộp kiểm tra kéo hình của Shopee trên tab <tab>.
# Dùng: bash cho-chi.sh <tab> [số phút, mặc định 10]
# Thoát 0 khi hộp đã biến mất (làm tiếp được), 1 khi hết giờ vẫn còn hộp.
# Agent phải CHẠY LỆNH NÀY và đợi nó xong, không được trả lời "em đang chờ" rồi kết thúc lượt.
TAB="$1"; PHUT="${2:-10}"; export XDG_RUNTIME_DIR=/run/user/0
[ -z "$TAB" ] && { echo "Thiếu tab"; exit 2; }
con_hop() {
  local t; t=$(timeout 40 openclaw browser --browser-profile chrome evaluate --target-id "$TAB" \
    --fn '() => location.href + "\n" + document.body.innerText.slice(0,3000)' 2>/dev/null)
  [ -z "$t" ] && return 0
  echo "$t" | grep -qiE 'verify/(captcha|traffic)|Kéo qua để hoàn thiện|Xác nhận để tiếp tục|vui lòng nhập mật khẩu'
}
for ((i=0; i<PHUT; i++)); do
  if ! con_hop; then sleep 5; echo "HET_HOP"; exit 0; fi
  sleep 60
done
con_hop && { echo "VAN_CON_HOP sau ${PHUT} phút"; exit 1; }
echo "HET_HOP"; exit 0
