/* =====================================================================
   Ô SỐ LIỆU: CHỮ NHỎ DƯỚI SỐ → BIỂU TƯỢNG ⓘ (chị Hoa 06/11/2026, cả quản trị lẫn vận hành)
   Dòng giải thích nhỏ dưới con số trong các ô số liệu đổi thành chữ i tròn; rê chuột, bấm hoặc chạm vào mới hiện nội dung.
   Áp cho: ô kpi() (app.js), ô Sức khỏe công ty (tongquan2.js), ô P&L (plcty.js), dải ô Tổng quan (dashv2.js, giữ dòng trạng thái / so kỳ trước).
   Không đổi chữ trong bảng, ghi chú cạnh tiêu đề khung. Dòng có chữ đỏ thì chữ i cũng đỏ để vẫn thấy cần chú ý.
   ===================================================================== */
const OI_SEL=".kpi .h,.tq2-skt small,.plc-kpi .plc-km,.xk .xkm";
function oiApply(root){
  (root||document).querySelectorAll(OI_SEL).forEach(el=>{
    if(el.dataset.oi)return;el.dataset.oi="1";
    if(el.matches(".xkm")&&el.querySelector(".xs,.xc,.sdot"))return;
    const t=(el.innerText||"").replace(/[ \t]+/g," ").replace(/\n\s*/g,"\n").trim();if(!t){el.style.display="none";return}
    const red=!!el.querySelector(".t-red,[style*='red']")||/var\(--red\)|t-red/.test(el.className);
    const b=document.createElement("span");b.className="oi"+(red?" oi-red":"");b.tabIndex=0;b.setAttribute("role","button");b.setAttribute("aria-label",t);b.dataset.tip=t;b.textContent="i";
    el.replaceWith(b)});
}
let OI_POP=null;
function oiShow(b){oiHide();const p=document.createElement("div");p.className="oi-pop";p.textContent=b.dataset.tip;document.body.appendChild(p);
  const r=b.getBoundingClientRect(),w=Math.min(300,innerWidth-16);p.style.maxWidth=w+"px";
  const x=Math.max(8,Math.min(innerWidth-p.offsetWidth-8,r.left+r.width/2-p.offsetWidth/2)),y=r.bottom+6+p.offsetHeight>innerHeight?r.top-p.offsetHeight-6:r.bottom+6;
  p.style.left=x+"px";p.style.top=y+"px";OI_POP=p}
function oiHide(){if(OI_POP){OI_POP.remove();OI_POP=null}}
if(typeof document!=="undefined"){
  document.addEventListener("mouseover",e=>{const b=e.target.closest&&e.target.closest(".oi");if(b)oiShow(b)});
  document.addEventListener("mouseout",e=>{const b=e.target.closest&&e.target.closest(".oi");if(b)oiHide()});
  document.addEventListener("focusin",e=>{if(e.target.classList&&e.target.classList.contains("oi"))oiShow(e.target)});
  document.addEventListener("focusout",e=>{if(e.target.classList&&e.target.classList.contains("oi"))oiHide()});
  /* bấm chữ i không mở trang của ô (ô là nút bấm), chỉ hiện giải thích; chạm lần nữa thì ẩn */
  document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest(".oi");if(!b){oiHide();return}e.stopPropagation();e.preventDefault();if(OI_POP&&OI_POP.textContent===b.dataset.tip)oiHide();else oiShow(b)},true);
  addEventListener("scroll",oiHide,true);
  let oiT=0;const go=()=>{clearTimeout(oiT);oiT=setTimeout(()=>{try{oiApply(document)}catch(e){}},30)};
  new MutationObserver(go).observe(document.documentElement,{childList:true,subtree:true});
  const s=document.createElement("style");s.textContent=`.oi{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;border:1px solid #b7bfce;color:#6b7590;font:italic 600 10px/1 Georgia,serif;cursor:help;margin-top:3px;flex:none;vertical-align:middle;background:#fff}
.oi:hover,.oi:focus{border-color:#2f6fde;color:#2f6fde;outline:none}.oi.oi-red{border-color:#e03131;color:#e03131}
.oi-pop{position:fixed;z-index:9999;background:#1f2a44;color:#fff;font-size:12px;line-height:1.45;padding:7px 10px;border-radius:7px;box-shadow:0 4px 14px rgba(0,0,0,.18);pointer-events:none;white-space:pre-line}`;
  document.head.appendChild(s);
}
