/* =====================================================================
   SẢN XUẤT MỘT LUỒNG: Phiếu sản xuất → Pha chế → Đóng gói (tiến độ xưởng) → Kiểm kê, in tem.
   Bốn trang cũ nằm rải ở hai nơi; giờ chung một thanh bước ở đầu trang. Kho vật tư chỉ còn phần tổng hợp.
   ===================================================================== */
const SX_STEPS=[["sx_nc","1. Phiếu sản xuất"],["kho_pc","2. Pha chế"],["sx_td","3. Đóng gói"],["sx_lo","4. Kiểm kê, in tem"]];
function sxStepCount(k){
  try{const s=SX();
    if(k==="sx_nc")return s.requests.filter(r=>r.st==="CAN_LAM"||r.st==="DANG_LAM").length;
    if(k==="sx_td")return s.requests.filter(r=>r.st==="DANG_LAM").length;
    if(k==="sx_lo")return s.batches.filter(b=>b.st==="CHO_KIEM").length}catch(e){}
  return 0}
function sxStepNav(key){
  const nav=document.createElement("nav");nav.className="kgtabs stepnav";
  nav.innerHTML=SX_STEPS.map(([k,t])=>{const n=sxStepCount(k);return `<button class="${k===key?"on":""}" data-sxs="${k}">${t}${n?`<i>${n}</i>`:""}</button>`}).join("");
  nav.querySelectorAll("[data-sxs]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.sxs;renderMain();scrollTo(0,0)});
  return nav}
function sxStepWrap(key){
  const old=PAGES[key];if(!old)return;
  PAGES[key]=m=>{
    old(m);
    const nav=sxStepNav(key);
    // nút thao tác của trang (Tạo phiếu, Lập phiếu mới…) chuyển lên cùng hàng với các bước
    const acts=[m.querySelector(".kgtabs .kact"),m.querySelector(":scope > .sxhead .sxact")].filter(Boolean);
    acts.forEach(a=>{if(a.children.length){a.classList.add("stepact");nav.appendChild(a)}});
    m.querySelectorAll("nav.kgtabs:not(.stepnav),nav.kgsub").forEach(n=>n.remove());
    const hd=m.querySelector(":scope > .sxhead");
    if(hd)hd.after(nav);else m.prepend(nav)}}
["sx_nc","kho_pc","sx_td","sx_lo"].forEach(sxStepWrap);
if(PAGES.kho_ks&&PAGES.kho_ks!==PAGES.sx_lo)PAGES.kho_ks=PAGES.sx_lo;
