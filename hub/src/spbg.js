/* =====================================================================
   BẢNG GIÁ KÊNH PHÂN PHỐI: PHIẾU ĐIỀU CHỈNH GIÁ + BÁO GIÁ GỬI KHÁCH (chị Hoa duyệt 16/11)
   1. Phiếu giá (d.giaPhieu): sửa ô giá / thêm mã mới trên bảng giá (spcfg.js) → "Tạo phiếu" (lý do, ngày hiệu lực).
      Giá chỉ đổi khi CEO bấm Duyệt phiếu: web gọi /api/products (mã mới) rồi /api/prices từng ô bằng quyền CEO
      (giá có hiệu lực ngay từ ngày của phiếu, lịch sử ghi "Phiếu PG-…: lý do"). Phiếu hiện ở Phê duyệt, CEO nhận chuông.
   2. Báo giá gửi khách: chọn cấp, bỏ tích mã không bán (web nhớ theo cấp, d.bgCfg), sửa tên công ty, tiêu đề,
      ghi chú từng cấp (vd cấp được miễn phí vận chuyển), tải ảnh PNG hoặc PDF (html2canvas + jsPDF từ cdnjs).
   ===================================================================== */
const SPBG={open:null};
const spbgD=()=>{try{return D()}catch(e){return {}}};
const spbgList=()=>Array.isArray(spbgD().giaPhieu)?spbgD().giaPhieu:[];
const spbgIsCeo=()=>typeof spcfB2bRole==="function"&&spcfB2bRole()==="ok";
const spbgCeoIds=()=>((spbgD().users)||[]).filter(u=>u.active&&u.role==="admin").map(u=>u.id);
const spbgMa=()=>{const t=new Date(Date.now()+7*36e5).toISOString().slice(2,10).replace(/-/g,""),n=spbgList().filter(p=>String(p.ma||"").startsWith("PG-"+t)).length+1;return "PG-"+t+"-"+String(n).padStart(2,"0")};
const SPBG_TT={cho:["Chờ chị duyệt","amb"],ok:["Đã duyệt","grn"],tralai:["Bị trả lại","red"],dang:["Đang áp giá…","blu"]};

/* ---------- Thêm mã / sản phẩm mới vào phiếu (chưa tạo trên web cho tới khi duyệt) ---------- */
function spbgNewProd(){
  const B=SPCF.b2b||{},T=(B.tiers||[]),G=[...new Map((B.products||[]).filter(p=>p.group_id).map(p=>[p.group_id,p.group_name])).entries()];
  const R=spcfModal("Thêm mã / sản phẩm mới",
    spcfSec("Thông tin",spcfBox(spcfRow("Mã KPP (SKU) *",`<input id="np-sku" placeholder="ví dụ SECRET5ML">`)+spcfRow("Tên sản phẩm *",`<input id="np-ten">`)+spcfRow("Đơn vị tính",`<input id="np-dvt" value="Chai">`)+spcfRow("Quy cách (số / thùng)",`<input id="np-qc" placeholder="ví dụ 240">`)+spcfRow("Nhóm hàng",`<select id="np-g"><option value="">Chưa xếp nhóm</option>${G.map(([id,n])=>`<option value="${esc(id)}">${esc(n)}</option>`).join("")}</select>`)))+
    spcfSec("Giá từng cấp",spcfBox(T.map(t=>spcfRow(esc(t.name),`<input class="np-p" data-t="${esc(t.id)}" data-n="${esc(t.name)}" inputmode="numeric" style="text-align:right" placeholder="chưa có">`)).join("")),"Giá mỗi chai / can. Cấp để trống là chưa bán cho cấp đó."),
    `<button class="btn pri" id="np-ok">Đưa vào phiếu</button>`);
  R.querySelector("#np-ok").onclick=()=>{const g=s=>R.querySelector(s).value.trim(),sku=g("#np-sku").toUpperCase(),ten=g("#np-ten");if(!sku||!ten){toast("Cần mã và tên sản phẩm");return}
    if((B.products||[]).some(p=>String(p.sku).toUpperCase()===sku)||(SPCF.newP||[]).some(p=>p.sku===sku)){toast("Mã "+sku+" đã có");return}
    const prices={};R.querySelectorAll(".np-p").forEach(i=>{const v=spcfNum(i.value);if(v)prices[i.dataset.t]={amount:v,tier:i.dataset.n}});
    const gs=R.querySelector("#np-g");(SPCF.newP=SPCF.newP||[]).push({tmp:"n"+Date.now(),sku,name:ten,unit:g("#np-dvt")||null,pack_size:g("#np-qc")||null,group_id:gs.value||null,group_name:gs.value?gs.selectedOptions[0].text:"",prices});closeCM();renderMain()}}
/* Danh sách mã mới đang chờ đưa vào phiếu (hiện trên bảng khi đang sửa) */
function spbgNewView(){const L=SPCF.newP||[];if(!L.length)return "";
  return `<div class="note" style="margin:0 14px 10px"><b>Mã mới sẽ thêm khi chị duyệt phiếu:</b> ${L.map((p,i)=>`<span class="spf-chip"><span class="spf-tag" style="margin:0">${esc(p.sku)}</span>${esc(p.name)} · ${Object.keys(p.prices).length} cấp có giá<button data-npdel="${i}" title="Bỏ">✕</button></span>`).join(" ")}</div>`}

/* ---------- Tạo phiếu từ các ô đã sửa + mã mới ---------- */
function spbgCreate(){
  const B=SPCF.b2b||{},T=B.tiers||[],chg=SPCF.chg||{},NP=SPCF.newP||[];
  const lines=Object.keys(chg).map(k=>{const [pid,tid]=k.split("|"),p=(B.products||[]).find(x=>x.id===pid)||{},t=T.find(x=>x.id===tid)||{};return {pid,sku:p.sku,ten:p.name,tid,tier:t.name,cu:p.prices?p.prices[t.code]:null,moi:chg[k]}});
  if(!lines.length&&!NP.length){toast("Chưa sửa ô giá nào");return}
  const R=spcfModal("Lưu giá: phiếu điều chỉnh giá",
    spcfSec("Phiếu",spcfBox(spcfRow("Lý do điều chỉnh *",`<input id="pg-ly" placeholder="ví dụ: giá vỏ can tăng">`)+spcfRow("Áp dụng từ ngày *",`<input type="date" id="pg-tu" value="${spcfToday()}">`)))+
    spcfSec("Các thay đổi",`<div class="spf-box" style="padding:0">${tbl(["Sản phẩm","Cấp","Giá cũ","Giá mới","Chênh"],lines.map(l=>`<tr><td><span class="spf-tag">${esc(l.sku)}</span>${esc(l.ten)}</td><td>${esc(l.tier)}</td><td class="n">${l.cu!=null?nf(l.cu):"chưa có"}</td><td class="n"><b>${l.moi!=null?nf(l.moi):"bỏ giá"}</b></td><td class="n">${l.cu!=null&&l.moi!=null?`<span class="${l.moi>l.cu?"t-red":"t-grn"}">${l.moi>l.cu?"+":""}${nf(l.moi-l.cu)}</span>`:""}</td></tr>`).concat(NP.map(p=>`<tr><td><span class="spf-tag">${esc(p.sku)}</span>${esc(p.name)} ${pill("mã mới","amb")}</td><td colspan="4" class="hint">${Object.values(p.prices).map(x=>esc(x.tier)+" "+nf(x.amount)).join(" · ")||"chưa đặt giá"}</td></tr>`)))}</div>`,(lines.length?lines.length+" ô giá":"")+(NP.length?(lines.length?", ":"")+NP.length+" mã mới":"")),
    `<button class="btn pri" id="pg-ok">${spbgIsCeo()?"Lưu phiếu":"Lưu và gửi chị duyệt"}</button>`);
  R.querySelector("#pg-ok").onclick=()=>{const ly=R.querySelector("#pg-ly").value.trim(),tu=R.querySelector("#pg-tu").value;if(!ly){toast("Ghi lý do điều chỉnh");return}if(!tu){toast("Chọn ngày áp dụng");return}
    const ph={id:"pg"+Date.now(),ma:spbgMa(),ly,tu,lines,moi:NP,by:ME.name||"",byId:ME.id||"",at:new Date().toISOString(),tt:"cho"};
    DB.mutate(ME.name,"tạo phiếu giá "+ph.ma,d=>{d.giaPhieu=Array.isArray(d.giaPhieu)?d.giaPhieu:[];d.giaPhieu.push(ph);try{if(typeof notifyU==="function")notifyU(d,spbgCeoIds(),`${ME.name||""} gửi phiếu điều chỉnh giá ${ph.ma}: ${ly}`,"page:sp_gia")}catch(e){}});
    SPCF.chg={};SPCF.newP=[];SPCF.b2bEd=false;closeCM();toast(spbgIsCeo()?"Đã lưu phiếu "+ph.ma+", bấm Duyệt phiếu ở cuối bảng để áp giá":"Đã lưu và gửi chị duyệt phiếu "+ph.ma);renderMain()}}

/* ---------- Danh sách phiếu (dưới bảng giá) ---------- */
function spbgListView(){const L=spbgList().slice().reverse().slice(0,12);if(!L.length)return "";const ceo=spbgIsCeo();
  return `<section class="card flush"><div class="spf-bar"><b>Phiếu điều chỉnh giá</b><span class="hint">giá chỉ đổi khi chị duyệt phiếu</span></div>
   ${tbl(["Phiếu","Lý do","Áp dụng từ","Thay đổi","Người lập","Trạng thái",""],L.map(p=>{const s=SPBG_TT[p.tt]||["?","gry"];return `<tr><td><button class="lnk" data-pgview="${esc(p.id)}"><b>${esc(p.ma)}</b></button></td><td>${esc(p.ly)}</td><td>${esc(spcfVN(p.tu))}</td><td class="hint">${(p.lines||[]).length} ô giá${(p.moi||[]).length?", "+p.moi.length+" mã mới":""}</td><td class="hint">${esc(p.by)}<br>${esc(String(p.at||"").slice(0,10).split("-").reverse().join("/"))}</td>
     <td>${pill(s[0],s[1])}${p.tt==="tralai"&&p.lyTra?`<br><small class="t-red">${esc(p.lyTra)}</small>`:""}${p.loi&&p.loi.length?`<br><small class="t-red">${esc(p.loi[0])}</small>`:""}</td>
     <td style="white-space:nowrap">${ceo&&p.tt==="cho"?`<button class="btn sm pri" data-pgok="${esc(p.id)}">Duyệt phiếu</button> <button class="btn sm" data-pgno="${esc(p.id)}">Trả lại</button>`:""}${p.byId===ME.id&&p.tt!=="ok"&&p.tt!=="dang"?` <button class="btn sm" data-pgdel="${esc(p.id)}">Xóa</button>`:""}</td></tr>`}))}</section>`}
function spbgView(id){const p=spbgList().find(x=>x.id===id);if(!p)return;
  spcfModal(`Phiếu ${esc(p.ma)} · ${esc(p.ly)}`,spcfSec("Thay đổi",`<div class="spf-box" style="padding:0">${tbl(["Sản phẩm","Cấp","Giá cũ","Giá mới",""],(p.lines||[]).map(l=>`<tr><td><span class="spf-tag">${esc(l.sku)}</span>${esc(l.ten)}</td><td>${esc(l.tier)}</td><td class="n">${l.cu!=null?nf(l.cu):"chưa có"}</td><td class="n"><b>${l.moi!=null?nf(l.moi):"bỏ giá"}</b></td><td>${l.done?pill("đã áp","grn"):""}</td></tr>`).concat((p.moi||[]).map(n=>`<tr><td><span class="spf-tag">${esc(n.sku)}</span>${esc(n.name)} ${pill("mã mới","amb")}</td><td colspan="3" class="hint">${Object.values(n.prices||{}).map(x=>esc(x.tier)+" "+nf(x.amount)).join(" · ")}</td><td>${n.done?pill("đã tạo","grn"):""}</td></tr>`)))}</div>`,
    `Lập: ${esc(p.by)} · áp dụng từ ${esc(spcfVN(p.tu))}${p.duyet?` · duyệt: ${esc(p.duyet.by)} ${esc(String(p.duyet.at).slice(0,16).replace("T"," "))}`:""}`),"")}
/* CEO duyệt: tạo mã mới, rồi đặt từng ô giá bằng quyền CEO (có hiệu lực từ ngày của phiếu). Lỗi ô nào thì giữ phiếu chờ, ô đã áp không làm lại. */
async function spbgDuyet(id){if(!spbgIsCeo())return;const p0=spbgList().find(x=>x.id===id);if(!p0||p0.tt!=="cho")return;
  if(!confirm(`Duyệt phiếu ${p0.ma}: ${(p0.lines||[]).length} ô giá${(p0.moi||[]).length?", "+p0.moi.length+" mã mới":""}, áp dụng từ ${spcfVN(p0.tu)}?`))return;
  const p=JSON.parse(JSON.stringify(p0)),why="Phiếu "+p.ma+": "+p.ly,loi=[];toast("Đang áp giá phiếu "+p.ma+"…");
  const put=async(product_id,tier_id,amount)=>svApi("/api/prices",{method:"POST",body:JSON.stringify({product_id,tier_id,amount,valid_from:p.tu,reason:why})});
  for(const n of (p.moi||[])){if(n.done)continue;try{if(!n.id){const r=await svApi("/api/products",{method:"POST",body:JSON.stringify({sku:n.sku,name:n.name,unit:n.unit,pack_size:n.pack_size,group_id:n.group_id})});n.id=r.id}
      for(const [tid,x] of Object.entries(n.prices||{})){if(x.done)continue;await put(n.id,tid,x.amount);x.done=true}n.done=true}catch(e){loi.push(n.sku+": "+e.message)}}
  for(const l of (p.lines||[])){if(l.done)continue;try{await put(l.pid,l.tid,l.moi);l.done=true}catch(e){loi.push(l.sku+" "+l.tier+": "+e.message)}}
  DB.mutate(ME.name,"duyệt phiếu giá "+p.ma,d=>{const x=(d.giaPhieu||[]).find(y=>y.id===id);if(!x)return;x.lines=p.lines;x.moi=p.moi;x.loi=loi;
    if(!loi.length){x.tt="ok";x.duyet={by:ME.name||"",at:new Date().toISOString()};try{if(typeof notifyU==="function")notifyU(d,[x.byId],`Chị đã duyệt phiếu giá ${x.ma}, giá mới áp dụng từ ${spcfVN(x.tu)}`,"page:sp_gia")}catch(e){}}});
  toast(loi.length?`Còn ${loi.length} ô chưa áp được: ${loi[0]}`:`Đã duyệt phiếu ${p.ma}, giá mới đã vào bảng giá`);SPCF.b2b=null;if(typeof spcfB2bLoad==="function")spcfB2bLoad(true);renderMain()}
function spbgTraLai(id,ly){if(!spbgIsCeo())return;DB.mutate(ME.name,"trả lại phiếu giá",d=>{const x=(d.giaPhieu||[]).find(y=>y.id===id);if(!x||x.tt!=="cho")return;x.tt="tralai";x.lyTra=ly||"";x.duyet={by:ME.name||"",at:new Date().toISOString()};
  try{if(typeof notifyU==="function")notifyU(d,[x.byId],`Phiếu giá ${x.ma} bị trả lại: ${ly||""}`,"page:sp_gia")}catch(e){}});renderMain()}
function spbgBind(m){const on=(s,f)=>m.querySelectorAll(s).forEach(b=>b.onclick=()=>f(b));
  on("[data-pgview]",b=>spbgView(b.dataset.pgview));on("[data-pgok]",b=>spbgDuyet(b.dataset.pgok));
  on("[data-pgno]",b=>{const ly=prompt("Lý do trả lại phiếu:");if(ly)spbgTraLai(b.dataset.pgno,ly)});
  on("[data-pgdel]",b=>{if(!confirm("Xóa phiếu này?"))return;DB.mutate(ME.name,"xóa phiếu giá",d=>{d.giaPhieu=(d.giaPhieu||[]).filter(x=>!(x.id===b.dataset.pgdel&&x.byId===ME.id&&x.tt!=="ok"))});renderMain()});
  on("[data-npdel]",b=>{(SPCF.newP||[]).splice(+b.dataset.npdel,1);renderMain()});
  on("[data-spbgnew]",()=>spbgNewProd());on("[data-spbgbq]",()=>spbgBaoGia())}

/* ============================== BÁO GIÁ GỬI KHÁCH ============================== */
/* Báo giá mẫu (chị Hoa 16/11): mở "Báo giá gửi khách" là ra danh sách mẫu đã lưu. "Lấy báo giá" = ra luôn tờ báo giá
   theo mẫu (giá lấy mới nhất từ bảng giá), tải ảnh / PDF. "+ Tạo báo giá mới" (góc phải) mới hiện chỗ chọn cấp, mã, ghi chú;
   chọn xong đặt tên và Lưu mẫu, lần sau cứ thế dùng. Mẫu: d.bgMau [{id, ten, tier, an:[mã ẩn], ghi, tieuDe}];
   tên công ty, dòng dưới dùng chung: d.bgCfg {cty, sub}. */
const SPBG_GHI="Giá trên đã bao gồm thuế GTGT\nGiá chưa bao gồm chi phí vận chuyển\nKhông công nợ, chuyển khoản trước giao hàng sau\nThời gian xuất hàng 3-7 ngày làm việc\nBáo giá có hiệu lực từ ngày {ngay} tới khi có thông báo mới";
const spbgCfg=()=>{const c=spbgD().bgCfg||{};return {cty:c.cty||"CÔNG TY AILLA VIỆT NAM",sub:c.sub||""}};
const spbgMau=()=>Array.isArray(spbgD().bgMau)?spbgD().bgMau:[];
const spbgTiers=()=>((SPCF.b2b&&SPCF.b2b.tiers)||[]).filter(t=>t.code!=="BAN_LE"&&t.code!=="NHAN_VIEN");
const spbgRows=()=>spcfB2bRows((SPCF.b2b&&SPCF.b2b.products)||[]).sort((a,b)=>String(a.g).localeCompare(String(b.g),"vi"));
/* Thứ tự mã trên báo giá (chị Hoa 17/11: kéo thả / mũi tên để chọn cái nào hiện trước) */
const spbgOrd=(rows,thu)=>{if(!Array.isArray(thu)||!thu.length)return rows;const ix=new Map(thu.map((id,i)=>[id,i]));return rows.map((r,i)=>[r,ix.has(r.le.id)?ix.get(r.le.id):1e6+i]).sort((a,b)=>a[1]-b[1]).map(x=>x[0])};
function spbgReady(){if(!SPCF.b2b||!SPCF.b2b.products){toast("Đang tải bảng giá, thử lại sau giây lát");return false}return true}
/* Tờ báo giá (dùng cho xem trước, ảnh và PDF) */
function spbgSheet(m,cf){
  const B=SPCF.b2b,LE=(B.tiers||[]).find(t=>t.code==="BAN_LE"),t=(B.tiers||[]).find(x=>x.code===m.tier)||{},an=new Set(m.an||[]);
  const show=spbgOrd(spbgRows(),m.thu).filter(r=>r.le.prices[t.code]!=null&&!an.has(r.le.id)),title=m.tieuDe||("BẢNG GIÁ "+String(t.name||"").toUpperCase()+" AILLA"),ghi=(m.ghi||SPBG_GHI).replace(/\{ngay\}/g,spcfVN(spcfToday()));
  const bd="1px solid #f6c3d8";
  return `<div id="bg-sheet" style="width:860px;background:#fff;color:#2b2b2b;font-family:'Be Vietnam Pro',system-ui,sans-serif;padding:26px 30px 22px;margin:0 auto">
    <div style="text-align:center"><img src="data:image/png;base64,${LOGO}" alt="Ailla" style="height:92px;object-fit:contain"></div>
    <div style="text-align:center;font-size:34px;font-weight:800;color:#e7357b;letter-spacing:.5px;margin:8px 0 2px;line-height:1.15">${esc(title)}</div>
    <div style="text-align:center;font-size:16px;font-weight:700;color:#9d1b55;letter-spacing:.3px">${esc(cf.cty)}</div>
    ${cf.sub?`<div style="text-align:center;font-size:13px;color:#6b5560;margin-top:2px">${esc(cf.sub)}</div>`:""}
    <table style="width:100%;border-collapse:separate;border-spacing:0;margin-top:16px;font-size:14px;border:1.5px solid #e7357b;border-radius:12px;overflow:hidden">
     <tr>${["STT","SẢN PHẨM","QUY CÁCH","GIÁ NIÊM YẾT",String(t.name||"").toUpperCase()].map((h,k)=>`<th style="background:#e7357b;color:#fff;font-weight:800;padding:10px 8px;font-size:14px;text-align:${k===1?"left":"center"}">${esc(h)}</th>`).join("")}</tr>
     ${show.map((r,k)=>{const b=k===show.length-1?"0":bd,v=r.le.eff_prices&&r.le.eff_prices[t.code]!=null?r.le.eff_prices[t.code]:r.le.prices[t.code];return `<tr><td style="text-align:center;padding:7px 6px;border-bottom:${b};border-right:${bd};width:48px">${k+1}</td><td style="padding:7px 10px;border-bottom:${b};border-right:${bd}">${esc(r.le.name)}</td><td style="text-align:center;padding:7px 6px;border-bottom:${b};border-right:${bd};width:90px">${esc(String(r.q||""))}</td><td style="text-align:right;padding:7px 12px;border-bottom:${b};border-right:${bd};width:130px">${LE&&r.le.prices[LE.code]!=null?nf(r.le.prices[LE.code]):""}</td><td style="text-align:right;padding:7px 12px;border-bottom:${b};width:140px;font-weight:700;color:#9d1b55;background:#fff0f6">${nf(v)}</td></tr>`}).join("")}
    </table>
    <div style="margin-top:12px;font-size:13px;color:#7a3352;line-height:1.7">${ghi.split("\n").filter(s=>s.trim()).map(s=>"- "+esc(s.trim())).join("<br>")}</div></div>`;
}
/* Nút tải ảnh / PDF cho tờ đang hiện */
function spbgDl(R,m){const t=spbgTiers().find(x=>x.code===m.tier)||{},file=(m.ten||("Bang-gia-"+(t.name||""))).replace(/[\\/:*?"<>|]+/g,"").replace(/\s+/g,"-")+"-"+spcfToday();
  const png=R.querySelector("#bg-png"),pdf=R.querySelector("#bg-pdf");
  if(png)png.onclick=async()=>{try{toast("Đang tạo ảnh…");const cv=await spbgShot();const bl=await new Promise((ok,no)=>cv.toBlob(b=>b?ok(b):no(new Error("Không tạo được ảnh")),"image/png"));
    const u=URL.createObjectURL(bl),a=document.createElement("a");a.href=u;a.download=file+".png";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}catch(e){toast(e.message)}};
  if(pdf)pdf.onclick=async()=>{try{const cv=await spbgShot();await spbgLib("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:"mm",format:"a4"}),W=210,H=297,mg=8,w=W-2*mg,ph=(H-2*mg)*cv.width/w;let y=0,first=true;
    while(y<cv.height){const h=Math.min(ph,cv.height-y),c=document.createElement("canvas");c.width=cv.width;c.height=h;c.getContext("2d").drawImage(cv,0,y,cv.width,h,0,0,cv.width,h);
      if(!first)doc.addPage();doc.addImage(c.toDataURL("image/jpeg",.92),"JPEG",mg,mg,w,h*w/cv.width);first=false;y+=h}
    doc.save(file+".pdf")}catch(e){toast(e.message)}}}
const spbgWide=R=>{const i=R.querySelector(".cm-in");if(i)i.style.width="min(1440px,97vw)";return R};
/* 1. Danh sách báo giá mẫu */
function spbgBaoGia(){if(!spbgReady())return;const L=spbgMau().slice().reverse(),T=spbgTiers();
  const R=spbgWide(spcfModal("Báo giá gửi khách",`<div style="padding:16px 0">${L.length?`<div class="spf-box" style="padding:0">${tbl(["Tên báo giá","Cấp","Số mã","Lưu lúc",""],L.map(m=>{const t=T.find(x=>x.code===m.tier)||{},n=spbgRows().filter(r=>r.le.prices[m.tier]!=null&&!(m.an||[]).includes(r.le.id)).length;
      return `<tr><td><b>${esc(m.ten)}</b></td><td>${esc(t.name||m.tier)}</td><td class="n">${n}</td><td class="hint">${esc(m.by||"")} · ${esc(String(m.at||"").slice(0,10).split("-").reverse().join("/"))}</td><td style="white-space:nowrap;text-align:right"><button class="btn sm pri" data-bgget="${esc(m.id)}">Lấy báo giá</button> <button class="btn sm" data-bged="${esc(m.id)}">Sửa</button> <button class="btn sm" data-bgrm="${esc(m.id)}">Xóa</button></td></tr>`}))}</div>`
      :`<div class="note">Chưa có báo giá mẫu nào. Bấm <b>+ Tạo báo giá mới</b> ở góc phải: chọn cấp, bỏ tích mã không bán, sửa ghi chú, đặt tên rồi Lưu mẫu. Lần sau chỉ cần bấm Lấy báo giá.</div>`}</div>`,""));
  const h=R.querySelector(".cm-h"),x=h&&h.querySelector(".x");if(x)x.insertAdjacentHTML("beforebegin",`<button class="btn pri" id="bg-new" style="margin-left:auto;margin-right:10px">+ Tạo báo giá mới</button>`);
  R.querySelector("#bg-new").onclick=()=>spbgEdit(null);
  R.querySelectorAll("[data-bgget]").forEach(b=>b.onclick=()=>spbgGet(b.dataset.bgget));
  R.querySelectorAll("[data-bged]").forEach(b=>b.onclick=()=>spbgEdit(b.dataset.bged));
  R.querySelectorAll("[data-bgrm]").forEach(b=>b.onclick=()=>{const m=spbgMau().find(y=>y.id===b.dataset.bgrm);if(!m||!confirm("Xóa báo giá mẫu \""+m.ten+"\"?"))return;DB.mutate(ME.name,"xóa báo giá mẫu",d=>{d.bgMau=(d.bgMau||[]).filter(y=>y.id!==m.id)});setTimeout(spbgBaoGia,50)})}
/* 2. Lấy báo giá đã lưu: ra luôn tờ báo giá, tải ảnh / PDF */
function spbgGet(id){if(!spbgReady())return;const m=spbgMau().find(x=>x.id===id);if(!m)return;
  const R=spbgWide(spcfModal(esc(m.ten),`<div style="padding:16px 0;background:var(--canvas)">${spbgSheet(m,spbgCfg())}</div>`,
    `<button class="btn" id="bg-back" style="margin-right:auto;order:-1">← Danh sách</button><button class="btn" id="bg-ed">Sửa mẫu</button><button class="btn" id="bg-png">Tải ảnh (PNG)</button><button class="btn pri" id="bg-pdf">Tải PDF</button>`));
  R.querySelector("#bg-back").onclick=()=>spbgBaoGia();R.querySelector("#bg-ed").onclick=()=>spbgEdit(id);spbgDl(R,m)}
/* 3. Tạo / sửa báo giá mẫu: chọn cấp, bỏ tích mã, ghi chú, tên; xem trước bên phải (tích không làm nhảy danh sách) */
function spbgEdit(id){if(!spbgReady())return;const T=spbgTiers(),old=id?spbgMau().find(x=>x.id===id):null,cf=spbgCfg();
  const m=old?JSON.parse(JSON.stringify(old)):{id:"",ten:"",tier:(T.find(t=>t.code==="DAI_SU")||T[0]||{}).code||"",an:[],thu:[],ghi:"",tieuDe:""};
  const draw=()=>{const t=T.find(x=>x.code===m.tier)||{},rows=spbgOrd(spbgRows(),m.thu).filter(r=>r.le.prices[t.code]!=null),an=new Set(m.an);
    const R=spbgWide(spcfModal(old?"Sửa báo giá mẫu":"Tạo báo giá mới",`<div style="display:grid;grid-template-columns:320px minmax(0,1fr);gap:16px;padding:16px 0;align-items:start">
      <div>
       <div class="spf-box" style="padding:4px 12px;margin-bottom:10px">${spcfRow("Tên báo giá *",`<input id="bg-name" value="${esc(m.ten)}" placeholder="ví dụ: Đại sứ - bỏ hàng gội, xả">`)}</div>
       <div class="spf-box" style="padding:10px 12px;margin-bottom:10px"><b style="font-size:13px">Cấp</b><div class="settabs" style="margin:6px 0 0">${T.map(x=>`<button class="${x.code===t.code?"on":""}" data-bgt="${esc(x.code)}">${esc(x.name)}</button>`).join("")}</div></div>
       <div class="spf-box" style="padding:4px 12px;margin-bottom:10px">${spcfRow("Tiêu đề",`<input id="bg-ten" value="${esc(m.tieuDe)}" placeholder="${esc("BẢNG GIÁ "+String(t.name||"").toUpperCase()+" AILLA")}">`)}${spcfRow("Tên công ty",`<input id="bg-cty" value="${esc(cf.cty)}">`)}${spcfRow("Dòng dưới",`<input id="bg-sub" value="${esc(cf.sub)}" placeholder="hotline, địa chỉ (không bắt buộc)">`)}</div>
       <div class="spf-box" style="padding:8px 12px;margin-bottom:10px"><b style="font-size:13px">Ghi chú cuối báo giá</b><p class="hint" style="margin:2px 0 6px;font-size:12px">Mỗi dòng một ý. Cấp được miễn phí vận chuyển thì ghi vào đây.</p><textarea id="bg-ghi" rows="7" style="width:100%;font-size:13px">${esc(m.ghi||SPBG_GHI)}</textarea></div>
       <div class="spf-box" style="padding:8px 12px"><b style="font-size:13px">Mã hiện trên báo giá</b> <span class="hint" style="font-size:12px" id="bg-cnt"></span><p class="hint" style="font-size:12px;margin:2px 0 0">Kéo ⠿ hoặc bấm ▲▼ để đổi thứ tự.</p>
        <div style="display:flex;gap:6px;margin:6px 0"><button class="btn sm" id="bg-all">Chọn hết</button><button class="btn sm" id="bg-none">Bỏ hết</button></div>
        <div id="bg-list" style="max-height:420px;overflow:auto"></div>
        ${spbgRows().length>rows.length?`<p class="hint" style="font-size:12px;margin:6px 0 0">${spbgRows().length-rows.length} mã chưa có giá cấp này nên không hiện.</p>`:""}</div>
      </div>
      <div id="bg-prev" style="background:var(--canvas);border-radius:12px;padding:14px;overflow:auto"></div></div>`,
      `<button class="btn" id="bg-back" style="margin-right:auto;order:-1">← Danh sách</button><button class="btn" id="bg-png">Tải ảnh (PNG)</button><button class="btn" id="bg-pdf">Tải PDF</button><button class="btn pri" id="bg-save">Lưu mẫu</button>`));
    const cfNow=()=>({cty:R.querySelector("#bg-cty").value.trim()||"CÔNG TY AILLA VIỆT NAM",sub:R.querySelector("#bg-sub").value.trim()});
    const rd=()=>{m.ten=R.querySelector("#bg-name").value.trim();m.tieuDe=R.querySelector("#bg-ten").value.trim();m.ghi=R.querySelector("#bg-ghi").value};
    /* chỉ vẽ lại tờ xem trước, không vẽ lại danh sách mã (giữ nguyên chỗ đang cuộn) */
    const prev=()=>{rd();R.querySelector("#bg-prev").innerHTML=spbgSheet(m,cfNow());const sh=new Set(m.an);R.querySelector("#bg-cnt").textContent=rows.filter(r=>!sh.has(r.le.id)).length+" / "+rows.length+" mã · bỏ tích để ẩn"};
    const list=R.querySelector("#bg-list");
    const drawList=()=>{const sh=new Set(m.an);list.innerHTML=rows.map((r,i)=>`<div class="bg-row" draggable="true" data-i="${i}" style="display:flex;gap:6px;align-items:center;padding:3px 0;font-size:13px;border-bottom:1px solid #f0f1f5"><span title="Kéo để đổi thứ tự" style="cursor:grab;color:#9aa0ae;padding:0 2px">⠿</span><input type="checkbox" class="bg-on" data-id="${esc(r.le.id)}" ${sh.has(r.le.id)?"":"checked"} style="width:auto;margin:0"><span style="flex:1">${esc(r.le.name)}</span><button class="btn sm" data-up="${i}" ${i?"":"disabled"} style="padding:0 6px" title="Lên">▲</button><button class="btn sm" data-dn="${i}" ${i<rows.length-1?"":"disabled"} style="padding:0 6px" title="Xuống">▼</button></div>`).join("");
      list.querySelectorAll(".bg-on").forEach(c=>c.onchange=()=>{const s=new Set(m.an);c.checked?s.delete(c.dataset.id):s.add(c.dataset.id);m.an=[...s];prev()});
      list.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>mv(+b.dataset.up,+b.dataset.up-1));
      list.querySelectorAll("[data-dn]").forEach(b=>b.onclick=()=>mv(+b.dataset.dn,+b.dataset.dn+1));
      let from=-1;list.querySelectorAll(".bg-row").forEach(el=>{el.ondragstart=e=>{from=+el.dataset.i;e.dataTransfer.effectAllowed="move"};el.ondragover=e=>{e.preventDefault();el.style.borderTop="2px solid var(--pri)"};el.ondragleave=()=>{el.style.borderTop=""};el.ondrop=e=>{e.preventDefault();el.style.borderTop="";if(from>=0)mv(from,+el.dataset.i);from=-1}})};
    const mv=(a,b)=>{if(a===b||b<0||b>=rows.length)return;const y=list.scrollTop;const [x]=rows.splice(a,1);rows.splice(b,0,x);m.thu=rows.map(r=>r.le.id);drawList();list.scrollTop=y;prev()};
    drawList();prev();
    R.querySelectorAll("[data-bgt]").forEach(b=>b.onclick=()=>{rd();m.tier=b.dataset.bgt;draw()});
    ["#bg-ten","#bg-cty","#bg-sub","#bg-ghi"].forEach(s=>R.querySelector(s).oninput=prev);
    const setAll=on=>{R.querySelectorAll(".bg-on").forEach(c=>{c.checked=on});m.an=on?[]:rows.map(r=>r.le.id);prev()};
    R.querySelector("#bg-all").onclick=()=>setAll(true);R.querySelector("#bg-none").onclick=()=>setAll(false);
    R.querySelector("#bg-back").onclick=()=>spbgBaoGia();
    R.querySelector("#bg-save").onclick=()=>{rd();if(!m.ten){toast("Đặt tên cho báo giá mẫu");R.querySelector("#bg-name").focus();return}const c=cfNow(),isNew=!m.id;if(isNew)m.id="bq"+Date.now();
      const rec={id:m.id,ten:m.ten,tier:m.tier,an:m.an,thu:m.thu||[],ghi:m.ghi,tieuDe:m.tieuDe,by:ME.name||"",byId:ME.id||"",at:new Date().toISOString()};
      DB.mutate(ME.name,"lưu báo giá mẫu "+m.ten,d=>{d.bgCfg={cty:c.cty,sub:c.sub};d.bgMau=Array.isArray(d.bgMau)?d.bgMau:[];const i=d.bgMau.findIndex(y=>y.id===rec.id);if(i>=0)d.bgMau[i]=rec;else d.bgMau.push(rec)});
      toast("Đã lưu báo giá mẫu \""+m.ten+"\"");setTimeout(spbgBaoGia,50)};
    spbgDl(R,m)};
  draw()}
const spbgLib=src=>new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`)&&(window.html2canvas||window.jspdf)&&(src.includes("html2canvas")?window.html2canvas:window.jspdf))return res();const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("Không tải được công cụ tạo ảnh / PDF, kiểm tra mạng rồi thử lại"));document.head.appendChild(s)});
async function spbgShot(){await spbgLib("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");const el=document.getElementById("bg-sheet");if(!el)throw new Error("Chưa có báo giá");
  return window.html2canvas(el,{scale:2,backgroundColor:"#ffffff",useCORS:true})}
