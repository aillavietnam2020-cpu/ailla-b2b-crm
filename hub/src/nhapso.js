/* =====================================================================
   Ô NHẬP SỐ KIỂU VIỆT NAM (chị Huệ báo 08/11: gõ "1,0" lên web thành 10)
   Các ô định mức / số lượng ở kho, sản xuất, mua hàng trước là type="number": trình duyệt bỏ dấu phẩy nên 1,0 → 10, 0,0001 → 1.
   Ở đây đổi các ô đó sang ô chữ (inputmode="decimal", điện thoại vẫn hiện bàn phím số) và đọc bằng kfNum (kho.js):
   "1,0" → 1 · "0,0001" → 0.0001 · "1.234,5" → 1234.5 · "1.5" → 1.5.
   Lúc ô đổi giá trị / rời ô / gửi form, số được ghi lại dạng chuẩn (dấu chấm thập phân) TRƯỚC khi code cũ đọc +value,
   nên không phải sửa từng trang. Ô tiền (đơn giá) không đổi ở đây.
   ===================================================================== */
const VN_QTY=".be-q,.kt-min,.cb-q,.mp-qi,.rt-r,.rt-b,.sdm-q,.mh-q,.mhr-q,.mhx-q,.mhm-q";
function vnFix(inp){if(!inp||inp.dataset.vn)return;inp.dataset.vn="1";if(inp.type==="number"){inp.type="text";inp.setAttribute("inputmode","decimal");inp.setAttribute("autocomplete","off")}}
function vnNorm(inp,fire){const s=String(inp.value||"").trim();if(s==="")return;const n=kfNum(s);if(!isFinite(n))return;const v=String(Math.round(n*1e9)/1e9);if(v===s)return;inp.value=v;if(fire)inp.dispatchEvent(new Event("input",{bubbles:true}))}
(function(){
  const scan=root=>{if(!root||!root.querySelectorAll)return;if(root.matches&&root.matches(VN_QTY))vnFix(root);root.querySelectorAll(VN_QTY).forEach(vnFix)};
  new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)}))).observe(document.documentElement,{childList:true,subtree:true});
  scan(document);
  /* Bắt ở pha capture: chạy trước onchange / onsubmit của trang. */
  document.addEventListener("change",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.vn)vnNorm(t,false)},true);
  document.addEventListener("focusout",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.vn)vnNorm(t,true)},true);
  document.addEventListener("submit",e=>{const f=e.target;if(f&&f.querySelectorAll)f.querySelectorAll("[data-vn]").forEach(i=>vnNorm(i,true))},true);
})();
