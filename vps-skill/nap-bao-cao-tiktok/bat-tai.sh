#!/bin/bash
# Gài bẫy tải trong một tab Chrome của chị Hoa: chặn Chrome lưu file xuống máy (không bật hộp Save As),
# chỉ giữ lại đường link file để VPS tự tải về. Dùng TRƯỚC khi bấm nút Tải xuống / ⬇ / Xuất.
#   bat-tai.sh <tab>        ví dụ: bat-tai.sh t5
TAB="$1"; [ -z "$TAB" ] && { echo "Thiếu tab (vd t5). Xem: openclaw browser --browser-profile chrome tabs"; exit 1; }
export XDG_RUNTIME_DIR=/run/user/0
openclaw browser --browser-profile chrome evaluate --target-id "$TAB" --fn '() => { window.__cap=[]; if(!window.__capOn){ window.__capOn=1; const oc=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ window.__cap.push(this.href); if(this.href && this.href.indexOf("blob:")!==0) return; return oc.call(this) }; window.open=function(u){ window.__cap.push(String(u)); return null }; document.addEventListener("click",function(e){ const a=e.target&&e.target.closest&&e.target.closest("a[href]"); if(a&&(a.hasAttribute("download")||/download|wsos|export|tos-/i.test(a.href))){ window.__cap.push(a.href); e.preventDefault() } },true) } return "da gai bay tai" }' 2>&1 | tail -1
