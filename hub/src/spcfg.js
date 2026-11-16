/* =====================================================================
   VẬN HÀNH › CẤU HÌNH › SẢN PHẨM VÀ COMBO (chị Hoa duyệt demo 16/11, C:\Users\ADMIN\Downloads\demo-cau-hinh-san-pham-combo.html)
   Một chỗ cho các bộ phận, mỗi người chỉ thấy tab của phòng mình, không hiện giá vốn:
     Ads Facebook (phòng ADS)  : sản phẩm + combo Ads (spdangchay.js, d.fbCat), gửi kế toán duyệt như cũ
     TikTok (phòng CM)         : xem combo TikTok đang có; khai combo mới (d.ttCombo) → kế toán khai quy đổi
     CSKH (phòng CSKH / B2C)   : sản phẩm + combo riêng của CSKH (d.cskhCat), không chạy ads
     Kênh phân phối (phòng KV) : xem sản phẩm và bảng giá 8 cấp (chỉ xem)
     Khuyến mại                : mỗi bộ phận thêm chương trình của mình (d.kmCat), kế toán duyệt rồi mới áp dụng
   Nút Đồng bộ Pancake (Ads, CSKH): chỉ đọc mã và giá trên Pancake về so; ghi lên Pancake chờ chị duyệt riêng.
   CEO, Ban điều hành (BDH), kế toán (KT) thấy hết các tab.
   ===================================================================== */
const SPCF={tab:"",km:null,tt:null,b2b:null,b2bBusy:false,q:""};
const spcfAll=u=>!!u&&(u.role==="admin"||["BDH","KT"].includes(u.phongBan));
const SPCF_BP={ads:"Ads Facebook",tt:"TikTok",cskh:"CSKH",b2b:"Kênh phân phối"};
const SPCF_TABS=[
  ["ads","Ads Facebook",u=>spcfAll(u)||u.phongBan==="ADS"||u.role==="digital"],
  ["tt","TikTok",u=>spcfAll(u)||u.phongBan==="CM"],
  ["cskh","CSKH",u=>spcfAll(u)||["CSKH","B2C"].includes(u.phongBan)],
  ["b2b","Kênh phân phối",u=>spcfAll(u)||u.phongBan==="KV"],
  ["km","Khuyến mại",u=>SPCF_TABS.slice(0,4).some(t=>t[2](u))]];
const spcfTabs=u=>SPCF_TABS.filter(t=>t[2](u));
/* Bộ phận của người đang xem (để gắn khuyến mại, combo TikTok); người thấy hết thì chọn khi thêm. */
const spcfMyBp=u=>SPCF_TABS.slice(0,4).filter(t=>t[2](u)).map(t=>t[0]);
const spcfList=k=>{try{const a=D()[k];return Array.isArray(a)?a:[]}catch(e){return []}};
const spcfCanDuyet=()=>typeof spcCanDuyet==="function"&&spcCanDuyet();
const spcfVN=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"";

function pSpcfg(m){
  const T=spcfTabs(ME);
  if(!T.length){m.innerHTML=H("Sản phẩm và combo","")+`<div class="note">Trang này dành cho phòng Ads, Content (TikTok), CSKH, Kênh phân phối và kế toán.</div>`;return}
  if(!T.some(t=>t[0]===SPCF.tab))SPCF.tab=T[0][0];
  const nav=`<nav class="settabs">${T.map(([k,t])=>`<button class="${SPCF.tab===k?"on":""}" data-spcf="${k}">${t}${k==="km"&&spcfCanDuyet()?spcfKmCho():""}</button>`).join("")}</nav>`;
  const sub="Mỗi bộ phận chỉ thấy phần của mình · combo, khuyến mại mới chờ kế toán duyệt · không hiện giá vốn";
  let body="";
  if(SPCF.tab==="ads"){SPC.bpView="ADS";body=spcEditor(null,[],{van:true})+spbPkView("ADS")}
  else if(SPCF.tab==="cskh"){SPC.bpView="CSKH";body=spcEditor(null,[],{van:true})+spbPkView("CSKH")}
  else if(SPCF.tab==="tt")body=spcfTtView();
  else if(SPCF.tab==="b2b")body=spcfB2bView();
  else body=spcfKmView();
  m.innerHTML=H("Sản phẩm và combo",sub)+nav+body;
  m.querySelectorAll("[data-spcf]").forEach(b=>b.onclick=()=>{SPCF.tab=b.dataset.spcf;SPCF.km=null;SPCF.tt=null;renderMain()});
  m.querySelectorAll("[data-spbpk]").forEach(b=>b.onclick=()=>spbPkLoad());
  if(typeof spbPkBind==="function")spbPkBind(m);
  spcfBind(m);
}
const spcfKmCho=()=>{const n=spcfList("kmCat").filter(k=>k.tt==="cho").length;return n?` <b class="pdn">${n}</b>`:""};

/* ---------- TikTok: combo đang có (bảng quy đổi) + khai combo mới ---------- */
function spcfTtView(){
  spcLoad();
  const P=spcfList("ttCombo").filter(x=>x.tt!=="xong").slice().reverse(),ed=SPCF_TABS[1][2](ME);
  const nm=p=>p.qty+" × "+((SPCB.items&&SPCB.items.get(spcLow(p.code))||{}).name||p.label);
  const L=SPCB.rows?spcGroup(SPCB.rows.filter(r=>r.channel==="TIKTOK"),SPCB.sales,spcToday()).filter(c=>c.active).sort((a,b)=>b.orders-a.orders):null;
  const f=SPCF.tt;
  return `<section class="card"><div class="card-h"><h2>Combo TikTok mới đã khai</h2>${ed?`<button class="btn pri" data-spcftt="1">+ Khai combo mới</button>`:""}</div>
   <p class="hint">Team TikTok lên combo mới trên sàn thì khai ở đây: mã trên sàn, gồm sản phẩm nào, quà gì. Kế toán khai vào bảng quy đổi (để trừ kho, tính giá vốn) rồi combo chuyển xuống danh sách bên dưới. Giá bán nằm trên TikTok.</p>
   ${f?`<div class="note"><div class="filters"><label class="inl">Mã trên sàn (SKU) <input id="tt-sku" value="${esc(f.sku||"")}"></label><label class="inl">Phân loại <input id="tt-vr" value="${esc(f.variant||"")}" placeholder="nếu có"></label></div>
     <div class="filters"><label class="inl" style="flex:1">Gồm <input id="tt-gom" style="width:100%" placeholder="ví dụ: 2 Tẩy lồng Ailla 300g + 1 Tẩy mốc gioăng"></label></div>
     <div class="filters"><label class="inl" style="flex:1">Quà tặng <input id="tt-qua" style="width:100%" placeholder="nếu có"></label><label class="inl" style="flex:1">Ghi chú <input id="tt-ghi" style="width:100%" placeholder="áp dụng từ ngày, chương trình…"></label></div>
     <div class="filters"><button class="btn pri" data-spcftts="1">Gửi kế toán</button><button class="btn" data-spcfttx="1">Hủy</button></div></div>`:""}
   ${tbl(["Mã trên sàn","Gồm","Quà","Người khai","Trạng thái"],P.map(x=>`<tr><td><b class="mono">${esc(x.sku)}</b>${x.variant?`<br><small class="hint">${esc(x.variant)}</small>`:""}</td><td>${esc(x.gom)}</td><td class="hint">${esc(x.qua||"")}</td><td class="hint">${esc(x.by||"")}<br>${esc(typeof spcAt==="function"?spcAt(x.at):"")}</td><td>${pill("chờ kế toán khai","amb")}</td></tr>`))}</section>
   <section class="card flush"><div class="card-h pad"><h2>Combo TikTok đang dùng</h2><span class="hint">${L?nf(L.length)+" combo":"Đang tải…"}</span></div>
   ${L?tbl(["Mã trên sàn","Gồm","Quà","Đơn"],L.slice(0,200).map(c=>`<tr><td><b class="mono">${esc(c.sku)}</b>${c.variant?`<br><small class="hint">${esc(c.variant)}</small>`:""}</td><td><small>${esc(c.parts.filter(p=>p.kind==="sp").map(nm).join(" + "))}</small></td><td><small>${esc(c.parts.filter(p=>p.kind==="gift").map(nm).join(" + "))}</small></td><td class="n">${c.orders||""}</td></tr>`)):""}</section>`;
}
/* Kế toán khai xong (lưu combo ở Sản phẩm & combo) thì đánh dấu đề xuất là xong. */
function spcfTtDone(id){DB.mutate(ME.name,"đã khai combo TikTok",d=>{const x=(d.ttCombo||[]).find(y=>y.id===id);if(x){x.tt="xong";x.xong={by:ME.name||"",at:new Date().toISOString()}}})}
/* Mở ô khai combo của kế toán, điền sẵn theo đề xuất (từ trang Phê duyệt). */
async function spcfTtOpen(id){const x=spcfList("ttCombo").find(y=>y.id===id);if(!x)return;SPCB.at=0;await spcLoad(true);
  spcbEdit(null,{channel:"TIKTOK",sku:x.sku,variant:x.variant||"",shops:[],orders:0,ttId:x.id,name:"Team TikTok khai: "+[x.gom,x.qua?"tặng "+x.qua:"",x.ghi].filter(Boolean).join(" · "),ttNote:[x.gom,x.qua?"tặng "+x.qua:"",x.ghi].filter(Boolean).join(" · ")})}

/* ---------- Kênh phân phối: sản phẩm + bảng giá 8 cấp (chỉ xem) ---------- */
async function spcfB2bLoad(){if(SPCF.b2bBusy)return;SPCF.b2bBusy=true;try{SPCF.b2b=await svApi("/api/prices?limit=1000")}catch(e){SPCF.b2b={err:e.message}}SPCF.b2bBusy=false;if(PAGE==="sp_cfg")renderMain()}
function spcfB2bView(){
  if(!SPCF.b2b){spcfB2bLoad();return `<p class="hint pad">Đang tải…</p>`}
  if(SPCF.b2b.err)return `<div class="note red">${esc(SPCF.b2b.err)}</div>`;
  const T=SPCF.b2b.tiers||[],fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPCF.q||"").trim();
  const L=(SPCF.b2b.products||[]).filter(p=>!q||fold(p.sku+" "+p.name).includes(q));
  return `<section class="card flush"><div class="card-h pad"><div class="filters"><input id="spcf-q" placeholder="Tìm mã, tên…" value="${esc(SPCF.q)}" style="max-width:240px"><span class="hint">${nf(L.length)} sản phẩm · bảng giá 8 cấp, chỉ xem · sửa giá ở Bảng giá (quản lý)</span></div></div>
   ${tbl(["Mã","Sản phẩm","ĐVT"].concat(T.map(t=>t.name)),L.slice(0,300).map(p=>`<tr><td class="mono">${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.unit||"")}</td>${T.map(t=>`<td class="n">${p.prices&&p.prices[t.code]!=null?nf(p.prices[t.code]):"—"}</td>`).join("")}</tr>`))}
   ${L.length>300?`<p class="hint pad">Hiện 300 / ${nf(L.length)}. Gõ để thu hẹp.</p>`:""}</section>`;
}

/* ---------- Khuyến mại: mỗi bộ phận thêm của mình, kế toán duyệt ---------- */
const SPCF_KT={cho:["Chờ kế toán duyệt","amb"],ok:["Đã duyệt","grn"],tralai:["Bị trả lại","red"]};
function spcfKmView(){
  const all=spcfAll(ME),mine=spcfMyBp(ME),dy=spcfCanDuyet(),t=new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
  const L=spcfList("kmCat").filter(k=>all||dy||mine.includes(k.bp)).slice().sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
  const f=SPCF.km,st=k=>k.tt==="ok"?(k.den&&k.den<t?["Đã hết","gry"]:k.tu&&k.tu>t?["Sắp chạy","blu"]:["Đang chạy","grn"]):SPCF_KT[k.tt]||["?","gry"];
  return `<section class="card"><div class="card-h"><h2>Chương trình khuyến mại${all||dy?" (mọi bộ phận)":" · "+mine.map(b=>SPCF_BP[b]).join(", ")}</h2>${mine.length?`<button class="btn pri" data-spcfkm="1">+ Thêm khuyến mại</button>`:""}</div>
   <p class="hint">Thêm xong là "chờ kế toán duyệt", duyệt rồi mới áp dụng. Mỗi bộ phận chỉ thấy khuyến mại của mình.</p>
   ${f?`<div class="note"><div class="filters"><label class="inl">Bộ phận <select id="km-bp">${opt(mine.map(b=>[b,SPCF_BP[b]]),f.bp||mine[0])}</select></label><label class="inl" style="flex:1">Tên chương trình <input id="km-t" style="width:100%" placeholder="ví dụ: Sale 11/11, Khách cũ mua lại"></label></div>
     <div class="filters"><label class="inl" style="flex:1">Áp dụng cho sản phẩm / combo <input id="km-s" style="width:100%" placeholder="ví dụ: Tẩy lồng Ailla 300g, combo 2 Lồng + 1 Mốc"></label><label class="inl">Giá khuyến mại (đ) <input id="km-g" inputmode="numeric" style="width:130px"></label></div>
     <div class="filters"><label class="inl">Từ ngày <input type="date" id="km-a" value="${t}"></label><label class="inl">Đến ngày <input type="date" id="km-b"></label><label class="inl" style="flex:1">Ghi chú <input id="km-n" style="width:100%" placeholder="điều kiện, quà kèm…"></label></div>
     <div class="filters"><button class="btn pri" data-spcfkms="1">Gửi kế toán duyệt</button><button class="btn" data-spcfkmx="1">Hủy</button></div></div>`:""}
   ${tbl(["Bộ phận","Chương trình","Áp dụng cho","Giá KM","Thời gian","Người thêm","Trạng thái",""],L.map(k=>{const s=st(k);return `<tr><td>${pill(SPCF_BP[k.bp]||k.bp,"vio")}</td><td><b>${esc(k.ten)}</b>${k.ghi?`<br><small class="hint">${esc(k.ghi)}</small>`:""}</td><td>${esc(k.ap)}</td><td class="n">${k.gia?nf(k.gia):"—"}</td>
     <td class="hint">${spcfVN(k.tu)}${k.den?" → "+spcfVN(k.den):""}</td><td class="hint">${esc(k.by||"")}</td><td>${pill(s[0],s[1])}${k.tt==="tralai"&&k.ly?`<br><small class="t-red">${esc(k.ly)}</small>`:""}</td>
     <td style="white-space:nowrap">${dy&&k.tt==="cho"?`<button class="btn sm pri" data-spcfkmok="${esc(k.id)}">Duyệt</button> <button class="btn sm" data-spcfkmno="${esc(k.id)}">Trả lại</button>`:""}${k.byId===ME.id&&k.tt!=="ok"?` <button class="btn sm" data-spcfkmdel="${esc(k.id)}">Xóa</button>`:""}</td></tr>`}))}</section>`;
}
function spcfKmDuyet(id,ok,ly){if(!spcfCanDuyet())return;DB.mutate(ME.name,(ok?"duyệt":"trả lại")+" khuyến mại",d=>{const k=(d.kmCat||[]).find(x=>x.id===id);if(!k||k.tt!=="cho")return;k.tt=ok?"ok":"tralai";k.duyet={by:ME.name||"",at:new Date().toISOString()};if(ly)k.ly=ly;
  try{if(typeof notifyU==="function")notifyU(d,[k.byId],ok?`Kế toán đã duyệt khuyến mại “${k.ten}”`:`Khuyến mại “${k.ten}” bị trả lại: ${ly||""}`,"page:sp_cfg")}catch(e){}});toast(ok?"Đã duyệt khuyến mại":"Đã trả lại");renderMain()}

function spcfBind(m){
  const q=$("#spcf-q");if(q)q.oninput=()=>{SPCF.q=q.value;const p=q.selectionStart;renderMain();const x=$("#spcf-q");if(x){x.focus();x.setSelectionRange(p,p)}};
  const on=(sel,f)=>m.querySelectorAll(sel).forEach(b=>b.onclick=()=>f(b));
  on("[data-spcftt]",()=>{SPCF.tt={};renderMain()});on("[data-spcfttx]",()=>{SPCF.tt=null;renderMain()});
  on("[data-spcftts]",()=>{const sku=$("#tt-sku").value.trim(),gom=$("#tt-gom").value.trim();if(!sku||!gom){toast("Cần mã trên sàn và gồm sản phẩm nào");return}
    const x={id:"tt"+Date.now(),sku,variant:$("#tt-vr").value.trim(),gom,qua:$("#tt-qua").value.trim(),ghi:$("#tt-ghi").value.trim(),by:ME.name||"",byId:ME.id||"",at:new Date().toISOString(),tt:"cho"};
    DB.mutate(ME.name,"khai combo TikTok "+sku,d=>{d.ttCombo=Array.isArray(d.ttCombo)?d.ttCombo:[];d.ttCombo.push(x)});SPCF.tt=null;toast("Đã gửi kế toán khai combo "+sku);renderMain()});
  on("[data-spcfkm]",()=>{SPCF.km={};renderMain()});on("[data-spcfkmx]",()=>{SPCF.km=null;renderMain()});
  on("[data-spcfkms]",()=>{const ten=$("#km-t").value.trim(),ap=$("#km-s").value.trim(),gia=+String($("#km-g").value).replace(/[^0-9]/g,"")||0,tu=$("#km-a").value,den=$("#km-b").value;
    if(!ten||!ap){toast("Cần tên chương trình và áp dụng cho sản phẩm / combo nào");return}if(!tu){toast("Chọn ngày bắt đầu");return}if(den&&den<tu){toast("Đến ngày phải sau ngày bắt đầu");return}
    const k={id:"km"+Date.now(),bp:$("#km-bp").value,ten,ap,gia,tu,den,ghi:$("#km-n").value.trim(),by:ME.name||"",byId:ME.id||"",at:new Date().toISOString(),tt:"cho"};
    DB.mutate(ME.name,"thêm khuyến mại "+ten,d=>{d.kmCat=Array.isArray(d.kmCat)?d.kmCat:[];d.kmCat.push(k)});SPCF.km=null;toast("Đã gửi kế toán duyệt khuyến mại");renderMain()});
  on("[data-spcfkmok]",b=>{if(confirm("Duyệt khuyến mại này?"))spcfKmDuyet(b.dataset.spcfkmok,true)});
  on("[data-spcfkmno]",b=>{const ly=prompt("Lý do trả lại:");if(ly)spcfKmDuyet(b.dataset.spcfkmno,false,ly)});
  on("[data-spcfkmdel]",b=>{if(!confirm("Xóa khuyến mại này?"))return;DB.mutate(ME.name,"xóa khuyến mại",d=>{d.kmCat=(d.kmCat||[]).filter(x=>!(x.id===b.dataset.spcfkmdel&&x.byId===ME.id&&x.tt!=="ok"))});renderMain()});
}
/* Phê duyệt (pdcalc.js): khuyến mại chờ duyệt + combo TikTok chờ kế toán khai */
function spcfPdSrc(d){return {kmCho:((d&&d.kmCat)||[]).filter(k=>k.tt==="cho"),ttCho:((d&&d.ttCombo)||[]).filter(x=>x.tt==="cho")}}

/* ---------- CSKH tạo đơn (cskh.js csDonForm) dùng danh mục CSKH (chị Hoa 16/11) ----------
   Ô tìm sản phẩm: combo CSKH đang chạy → sản phẩm CSKH (giá CSKH) → mọi sản phẩm Pancake còn lại.
   Chọn combo: thêm từng món theo giá CSKH (quà giá 0), phần chênh với giá combo cộng vào ô Giảm giá. */
const spcfToday=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
const spcfCk=()=>{try{return D().cskhCat||{}}catch(e){return {}}};
function spcfDonList(list){
  const ck=spcfCk(),byId=new Map((list||[]).map(x=>[x.id,x])),t=spcfToday(),mine=[];
  (ck.sp||[]).forEach(p=>(p.bt||[]).forEach(v=>{if(v.on===false)return;const pv=v.pkId&&byId.get(v.pkId);mine.push({id:pv?pv.id:(v.pkId||""),name:pv?pv.name:p.ten,price:v.gia||(pv?pv.price:0),cskh:true})}));
  const ids=new Set(mine.map(x=>x.id));
  const combos=(ck.combos||[]).filter(c=>(c.tt||"ok")==="ok"&&!(c.den&&c.den<t)&&!(c.tu&&c.tu>t)).map(c=>({combo:c,name:"Combo CSKH: "+(c.nhom||"")+(c.combo?" · "+c.combo:""),price:+c.gia||0,id:"combo"}));
  return combos.concat(mine,(list||[]).filter(x=>!ids.has(x.id)));
}
function spcfDonCombo(c,list){
  const ck=spcfCk(),byId=new Map((list||[]).map(x=>[x.id,x])),items=[];let sum=0;
  const vOf=ma=>{for(const p of (ck.sp||[]))for(const v of (p.bt||[]))if(v.ma===ma)return {p,v};return null};
  const add=(x,gift)=>{const lk=x.ma?vOf(x.ma):null,pv=lk&&lk.v.pkId?byId.get(lk.v.pkId):null,price=gift?0:(lk&&lk.v.gia)||(pv?pv.price:0),q=+x.sl||1;
    items.push({n:pv?pv.name:(lk?lk.p.ten:(x.ten||x.ma||"")),vid:pv?pv.id:"",q,price});sum+=q*price};
  (c.gom||[]).forEach(x=>add(x,false));(c.tang||[]).forEach(x=>add(x,true));
  return {items,disc:Math.max(0,sum-(+c.gia||0))};
}
/* Khuyến mại CSKH đang chạy (kế toán đã duyệt) hiện nhắc trong ô tạo đơn */
function spcfDonKm(){const t=spcfToday(),L=((typeof D==="function"&&D()&&D().kmCat)||[]).filter(k=>k.bp==="cskh"&&k.tt==="ok"&&!(k.tu&&k.tu>t)&&!(k.den&&k.den<t));
  return L.length?`<div class="note" style="margin-top:8px"><b>Khuyến mại CSKH đang chạy:</b> ${L.map(k=>esc(k.ten)+" · "+esc(k.ap)+(k.gia?" · "+nf(k.gia)+" đ":"")+(k.den?" (đến "+esc(k.den.slice(8,10)+"/"+k.den.slice(5,7))+")":"")).join("; ")}</div>`:""}
PAGES.sp_cfg=pSpcfg;
/* Trang cũ dồn về đây */
PAGES.dg_sp=m=>{SPCF.tab="ads";pSpcfg(m)};
PAGES.kd_combo=m=>{SPCF.tab="cskh";pSpcfg(m)};
MODULES.push({k:"spcf",zone:"Vận hành",ic:"gear",n:"Sản phẩm và combo",sub:"",groups:()=>[["",[MI("sp_cfg","Sản phẩm và combo",u=>spcfTabs(u).length>0)]]]});
