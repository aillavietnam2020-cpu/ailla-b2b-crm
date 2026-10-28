#!/bin/bash
# Shopee: trang tự tạo file trong trình duyệt (blob) rồi mới tải. Gài bẫy giữ lại file đó và CHẶN Chrome lưu xuống máy chị.
# Dùng TRƯỚC khi bấm "Tải về" / "Tải dữ liệu" trên Kênh Người bán. Sau đó: lay-blob.sh <tab> <file>.
#   bat-tai-blob.sh <tab>
TAB="$1"; [ -z "$TAB" ] && { echo "Thiếu tab (vd t5)"; exit 1; }
export XDG_RUNTIME_DIR=/run/user/0
openclaw browser --browser-profile chrome evaluate --target-id "$TAB" --fn '() => { window.__blobs=[]; if(!window.__blobOn){ window.__blobOn=1; const oc=URL.createObjectURL; URL.createObjectURL=function(b){ try{ if(b instanceof Blob) window.__blobs.push(b) }catch(e){} return oc.apply(this,arguments) }; URL.revokeObjectURL=function(){}; const ac=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ if(this.href&&(this.href.indexOf("blob:")===0||this.hasAttribute("download"))) return; return ac.call(this) }; window.open=function(){ return null } } return "da gai bay blob" }' 2>&1 | tail -1
