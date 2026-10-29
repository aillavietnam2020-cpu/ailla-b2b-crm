/* =====================================================================
   KIỂU BẢNG GIAO DỊCH DÙNG CHUNG (kiểu Poscake, chị Hoa 29/10): mỗi giao dịch một dòng, chữ 12–13px, không khoảng trắng thừa,
   bấm dòng mở chi tiết, cột "Liên quan" có link thật sang đơn / phiếu gắn với giao dịch.
   Cách dùng ở trang khác:
     gdCss();                                   gọi một lần khi vẽ trang (chèn CSS chung)
     <table class="gd"> … </table>             hoặc tbl(head,rows).replace("<table>",'<table class="gd">')
     <td class="gdd">diễn giải dài</td>         ô chữ dài: một dòng, thừa thì "…" (đặt title để rê chuột xem đủ)
     gdLink(chữ, 'data-x="…"', tiêu đề)          link nhỏ trong ô; tự gắn onclick bằng data-* ở trang đó (nhớ ev.stopPropagation())
     gdMaDon(chuỗi) → ["DH…","PM…",…]          tách mã đơn trong ô ghi chữ tự do (phẩy, chấm phẩy, xuống dòng)
     gdDonLinks(chuỗi)                          link cho từng mã: đơn mua PM… mở mhDetail, đơn bán mở gdXemDon; chữ không khớp mã giữ nguyên
     gdChonDon(idInput) sau khi vẽ form          ô "tìm đơn" chọn được nhiều đơn bán / đơn mua, thêm mã vào ô chữ idInput (vẫn gõ chữ tự do được)
   ===================================================================== */
const GD_CSS=`table.gd td{padding:5px 8px;font-size:12.5px;vertical-align:middle;white-space:nowrap;line-height:1.35}table.gd th{white-space:nowrap;font-size:12px;padding:7px 8px}
table.gd td.gdd{max-width:280px;overflow:hidden;text-overflow:ellipsis}table.gd tr[data-x],table.gd tr[data-id],table.gd tr.clk{cursor:pointer}table.gd tbody tr:hover td{background:#f7f8fb}
table.gd .scp{white-space:nowrap;font-size:11.5px}
.gdlk{color:#5146c8;cursor:pointer;font-size:12px;text-decoration:none;border-bottom:1px dashed #b9b3f0}.gdlk:hover{border-bottom-style:solid}
.card:has(>.gdfoot),section:has(>.gdfoot){overflow:visible}.gdfoot{position:sticky;bottom:0;z-index:3;display:flex;align-items:center;gap:6px 18px;flex-wrap:wrap;background:#fff;border-top:1px solid #e3e6ee;padding:8px 14px;font-size:12.5px;box-shadow:0 -2px 6px rgba(16,24,40,.05)}.gdfoot b{font-variant-numeric:tabular-nums}.gdfoot .sp{flex:1}.gdpg{display:flex;align-items:center;gap:4px}.gdpg button{min-width:28px;height:26px;border:1px solid #e3e6ee;background:#fff;border-radius:6px;font:600 12px inherit;font-family:inherit;cursor:pointer;color:#344054}.gdpg button.on{border-color:#5146c8;color:#5146c8}.gdpg button:disabled{opacity:.4;cursor:default}.gdpg select{padding:3px 6px;font-size:12px;width:auto}
.gdchon{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px}.gdchon input{flex:1 1 220px}`;
function gdCss(){if(document.getElementById("gd-css"))return;const s=document.createElement("style");s.id="gd-css";s.textContent=GD_CSS;document.head.appendChild(s)}
const gdLink=(t,attrs,title)=>`<a class="gdlk" ${attrs||""} title="${esc(title||t)}">${esc(t)}</a>`;
const gdMaDon=s=>String(s||"").split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);
/* Mã giống mã đơn: đơn mua PM2610-009, đơn bán DH202610-0040 / IMP-… / chữ liền không dấu cách. */
const gdLaMa=t=>/^[A-Za-z]{1,6}[-_]?[\w-]*\d[\w-]*$/.test(t)&&!/\s/.test(t);
function gdDonLinks(s){const P=(typeof MH!=="undefined"&&MH.orders)||[];
  return gdMaDon(s).map(t=>{const p=P.find(o=>o.no===t);if(p)return gdLink(t,`data-gdpo="${esc(p.id)}"`,"Mở đơn mua "+t+" · "+(p.supplier_name||""));
    return gdLaMa(t)?gdLink(t,`data-gddon="${esc(t)}"`,"Mở đơn "+t):`<span class="hint">${esc(t)}</span>`}).join(", ")}
/* Xem nhanh đơn bán theo mã (tìm qua /api/orders?q=). */
async function gdXemDon(ma){openDrawerHTML(`<h2>Đơn ${esc(ma)}</h2><p class="hint">Đang tìm…</p>`);
  let L=[];try{const r=await svApi("/api/orders?q="+encodeURIComponent(ma)+"&limit=5");L=Array.isArray(r)?r:(r&&r.items)||[]}catch(e){}
  const o=L.find(x=>x.order_no===ma)||L[0];
  openDrawerHTML(o?`<h2>Đơn ${esc(o.order_no||ma)}</h2><div class="tbl"><table><tbody>${[["Khách",o.customer_name||o.customer||""],["Ngày",o.created_at?kDd(String(o.created_at).slice(0,10)):""],["Tổng tiền",o.total!=null?nf(Math.round(+o.total))+" đ":""],["Trạng thái",o.status||""],["Người bán",o.seller_name||o.created_by_name||""]].filter(z=>z[1]).map(([a,b])=>`<tr><td class="hint">${a}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>`
    :`<h2>Đơn ${esc(ma)}</h2><p class="hint">Không tìm thấy đơn bán có mã này (có thể là đơn trên sàn hoặc ghi chú tự do).</p>`)}
/* Gắn bấm link chung trong một vùng m (trang tự gọi sau khi vẽ). */
function gdBind(m){
  m.querySelectorAll("[data-gdpo]").forEach(el=>el.onclick=ev=>{ev.stopPropagation();const id=el.dataset.gdpo;Promise.resolve(typeof mhLoad==="function"?mhLoad():0).then(()=>mhDetail(id))});
  m.querySelectorAll("[data-gddon]").forEach(el=>el.onclick=ev=>{ev.stopPropagation();gdXemDon(el.dataset.gddon)})}
/* Ô tìm và chọn đơn (đơn bán + đơn mua) cạnh ô chữ idInput: chọn đơn nào thì thêm mã vào ô chữ; ô chữ vẫn gõ tự do được
   (một phiếu vận chuyển chở gộp nhiều đơn mà không bổ được thì ghi chữ, chị Hoa 29/10). */
function gdChonDon(idInput){
  const inp=document.getElementById(idInput);if(!inp||inp.dataset.gdchon)return;inp.dataset.gdchon="1";
  const box=document.createElement("div");box.className="gdchon";const dl="gddl-"+idInput;
  box.innerHTML=`<input id="${idInput}-tim" list="${dl}" placeholder="Bấm vào đây để chọn đơn (đơn bán cho khách hoặc đơn mua của nhà cung cấp)" autocomplete="off"><datalist id="${dl}"></datalist><span class="hint">gõ tên khách, nhà cung cấp hoặc mã đơn để tìm; chọn được nhiều đơn. Không có đơn thì gõ chữ ở ô trên.</span>`;
  inp.insertAdjacentElement("afterend",box);
  const tim=box.querySelector("input"),list=box.querySelector("datalist");let map={},t=0;
  const them=ma=>{const L=gdMaDon(inp.value);if(!L.includes(ma))L.push(ma);inp.value=L.join(", ");tim.value=""};
  /* dựng danh sách gợi ý: đơn bán (mã DH…, khách mua) và đơn mua (mã PM…, nhà cung cấp); bấm vào ô là hiện ngay các đơn gần đây */
  const nap=async v=>{const k=kfold(v||""),opts=[];
    ((typeof MH!=="undefined"&&MH.orders)||[]).slice().sort((a,b)=>String(b.order_date||"").localeCompare(String(a.order_date||""))).filter(p=>!k||kfold((p.no||"")+" "+(p.supplier_name||"")).includes(k)).slice(0,k?10:8).forEach(p=>opts.push([p.no+" · đơn mua của "+(p.supplier_name||"")+(p.order_date?" · "+kDd(p.order_date):""),p.no]));
    try{const r=await svApi("/api/orders?"+(k?"q="+encodeURIComponent(v)+"&":"")+"limit="+(k?15:10));(Array.isArray(r)?r:(r&&r.items)||[]).forEach(o=>o.order_no&&opts.push([o.order_no+" · đơn bán cho "+(o.customer_name||"")+(o.created_at?" · "+kDd(String(o.created_at).slice(0,10)):""),o.order_no]))}catch(e){}
    map={};list.innerHTML=opts.map(([l,ma])=>{map[l]=ma;return `<option value="${esc(l)}"></option>`}).join("")};
  tim.addEventListener("focus",()=>{if(!list.children.length)nap("")});
  tim.addEventListener("input",()=>{const v=tim.value.trim();if(map[v]){them(map[v]);nap("");return}clearTimeout(t);t=setTimeout(()=>nap(v),250)});
  Promise.resolve(typeof mhLoad==="function"?mhLoad():0).catch(()=>{})}
/* tbl() của app.js nhưng bảng mang kiểu giao dịch chung. */
const gdTbl=(head,rows,cls)=>tbl(head,rows,cls).replace("<table>",'<table class="gd">');
/* Chân bảng luôn hiện ở đáy màn hình (kiểu Poscake): tổng cộng bên trái, phân trang + số dòng mỗi trang bên phải.
   tong: chuỗi HTML tổng; n: số dòng; st: {trang, co} (đối tượng trạng thái của trang, sửa trực tiếp); key: tên để gắn sự kiện. */
const GD_CO=[50,100,200,500];
const gdCat=(L,st)=>{const co=st.co||100,max=Math.max(1,Math.ceil(L.length/co));if(!st.trang||st.trang>max)st.trang=1;return L.slice((st.trang-1)*co,st.trang*co)};
function gdChan(tong,n,st,key){const co=st.co||100,max=Math.max(1,Math.ceil(n/co)),p=st.trang||1,sh=new Set([1,max,p-1,p,p+1].filter(x=>x>=1&&x<=max));let last=0,b="";
  [...sh].sort((a,c)=>a-c).forEach(x=>{if(x-last>1)b+='<span class="hint">…</span>';b+=`<button type="button" class="${x===p?"on":""}" data-gdpg="${key}" data-p="${x}">${x}</button>`;last=x});
  return `<div class="gdfoot">${tong}<span class="sp"></span><span class="gdpg"><button type="button" data-gdpg="${key}" data-p="${p-1}"${p<=1?" disabled":""} aria-label="Trang trước">‹</button>${b}<button type="button" data-gdpg="${key}" data-p="${p+1}"${p>=max?" disabled":""} aria-label="Trang sau">›</button>
   <select data-gdco="${key}" aria-label="Số dòng mỗi trang">${GD_CO.map(c=>`<option value="${c}"${c===co?" selected":""}>${c} / trang</option>`).join("")}</select></span></div>`}
/* Gắn bấm phân trang: st là đối tượng trạng thái đã truyền cho gdChan, ve() vẽ lại trang. */
function gdChanBind(m,key,st,ve){
  m.querySelectorAll(`[data-gdpg="${key}"]`).forEach(b=>b.onclick=()=>{st.trang=+b.dataset.p;ve()});
  m.querySelectorAll(`[data-gdco="${key}"]`).forEach(s=>s.onchange=()=>{st.co=+s.value;st.trang=1;try{localStorage.setItem("gdco_"+key,s.value)}catch(e){}ve()})}
const gdCoNho=(key,def)=>{try{return +localStorage.getItem("gdco_"+key)||def}catch(e){return def}};
