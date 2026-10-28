/* =====================================================================
   SẢN PHẨM & COMBO (chị Hoa duyệt demo 28/10/2026, C:\Users\ADMIN\Downloads\demo-san-pham-combo.html)
   Quản trị › Cấu hình › Sản phẩm & combo (spcombo): 3 tab Combo theo kênh · Sản phẩm gốc · Mã chưa quy đổi.
   Vận hành › Kho – Sản xuất › Danh mục › Combo soạn hàng (kho_combo): kho chỉ xem combo gồm gì, không giá, không sửa.
   Máy chủ: /api/hub/sanpham (routes/sanpham.ts). Hàm thuần: spccalc.js. Chỉ CEO và kế toán sửa (máy chủ chặn).
   Giá vốn sản phẩm gốc ghi vào Giá vốn SKU (D().skus, tháng hiện tại) như trang Giá vốn SKU.
   ===================================================================== */
const SPCB={tab:"combo",ch:"SHOPEE",shop:"",f:"all",q:"",pf:"on",pq:"",kq:"",busy:false,err:"",at:0,ed:null,hist:null};
const spcApi=(p,o)=>svApi("/api/hub/sanpham"+p,o);
const spcKy=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,7);
const spcToday=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
/* Thấy giá vốn: CEO hoặc người có quyền xem số tiền (kế toán). */
const spcSeeCost=()=>typeof SV!=="undefined"&&!!SV.me&&(SV.me.role==="CEO"||(SV.perms||[]).includes("debt.read.all")||(SV.perms||[]).includes("order.accounting.confirm"));
const spcPage=()=>PAGE==="spcombo"||PAGE==="kho_combo"||PAGE==="kho_qd";
async function spcLoad(force){
  if(SPCB.busy)return;if(!force&&SPCB.at&&Date.now()-SPCB.at<60000)return;
  SPCB.busy=true;
  try{
    const [cb,pr,un,cat,cost]=await Promise.all([spcApi("/combos"),spcApi("/products"),spcApi("/unmapped"),kApi("/catalog").catch(()=>({items:[]})),spcSeeCost()?kApi("/costs").catch(()=>[]):[]]);
    SPCB.rows=cb.rows||[];SPCB.sales=cb.sales||[];SPCB.can=!!cb.can_edit;SPCB.prods=pr.items||[];SPCB.khomap=pr.kho_map||[];SPCB.un=un||[];
    SPCB.items=new Map(((cat&&cat.items)||[]).map(i=>[spcLow(i.code),i]));SPCB.cost=cost||[];SPCB.err="";
  }catch(e){SPCB.err=e.message||"Không tải được"}
  SPCB.busy=false;SPCB.at=Date.now();if(spcPage())renderMain();
}
function spcCtx(){
  const combos=spcGroup(SPCB.rows,SPCB.sales,spcToday()),items=new Set([...SPCB.items.keys()]);
  const g=spcSeeCost()?spcGvMap((typeof D==="function"&&D()&&D().skus)||[],SPCB.cost,spcKy()):null;
  const used={};combos.forEach(c=>c.active&&c.parts.forEach(p=>{const k=spcLow(p.code);used[k]=(used[k]||0)+1}));
  return {combos,items,g,used};
}
const spcChip=(p,items)=>p.kind==="skip"?`<span class="pill p-gry">bỏ qua</span> `:
  `<span class="pill ${!items.has(spcLow(p.code))?"p-red":p.kind==="gift"?"p-vio":p.kind==="pack"?"p-gry":"p-grn"}" title="${esc(p.label)}">${p.kind==="gift"?"🎁 ":""}${p.qty!=1?p.qty+" × ":""}${esc(p.code)}</span> `;
const spcShop=s=>`<small class="pill p-gry">${esc(String(s).replace(/^(Landing|Page): /,""))}</small> `;
const spcDd=d=>d?d.slice(8,10)+"/"+d.slice(5,7):"";

function pSpcombo(m){
  const T="Sản phẩm & combo",S="Sản phẩm gốc (mã kho/MISA) và combo từng kênh: dùng để tính phiếu xuất kho hằng ngày và giá vốn từng kênh";
  spcLoad();
  if(SPCB.err){m.innerHTML=H(T,S)+`<div class="note red">${esc(SPCB.err)}</div>`;return}
  if(!SPCB.rows){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  const C=spcCtx(),act=C.combos.filter(c=>c.active),U=spcUnSum(SPCB.un);
  const pUsed=SPCB.prods.filter(p=>p.active&&C.used[spcLow(p.code)]),pNoGv=C.g?pUsed.filter(p=>!C.g[spcLow(p.code)]).length:0;
  const noGv=C.g?act.filter(c=>spcCost(c.parts,C.g).u==null).length:0,flag=act.filter(c=>c.flag).length;
  const go=(t,h)=>`<span data-spct="${t}" style="cursor:pointer">${h}</span>`;
  const kp=`<div class="grid kpis">${go("sp",kpi("Sản phẩm gốc",nf(SPCB.prods.filter(p=>p.active).length),`${nf(pUsed.length)} mã đang nằm trong combo${C.g?" · "+nf(pNoGv)+" mã đó chưa có giá vốn":""}`))}
    ${go("combo",kpi("Combo đang dùng",nf(act.length),SPC_CH.map(([k,n])=>n+" "+act.filter(c=>c.ch===k).length).join(" · ")))}
    ${C.g?go("combo",kpi("Combo chưa tính được giá vốn",nf(noGv),`món bên trong chưa có giá vốn · ${nf(flag)} combo cần kế toán xác nhận`,noGv?"#b54708":"")):""}
    ${go("un",kpi("Mã chưa quy đổi",nf(U.codes),`${nf(U.orders)} đơn kho đã xuất, chưa tính giá vốn`,U.codes?"#b42318":""))}</div>`;
  const tabs=`<nav class="settabs">${[["combo","Combo theo kênh"],["sp","Sản phẩm gốc"],["un","Mã chưa quy đổi"+(U.codes?" ("+U.codes+")":"")]].map(([k,t])=>`<button class="${SPCB.tab===k?"on":""}" data-spct="${k}">${t}</button>`).join("")}</nav>`;
  const body=SPCB.tab==="sp"?spcProdView(C):SPCB.tab==="un"?spcUnView(C):spcComboView(C);
  m.innerHTML=H(T,S)+kp+tabs+body+(SPCB.can?"":`<p class="hint pad">Bạn chỉ xem. CEO và kế toán mới sửa được.</p>`);
  m.querySelectorAll("[data-spct]").forEach(b=>b.onclick=()=>{SPCB.tab=b.dataset.spct;renderMain()});
  spcBind(m,C);
}
/* Bảng combo kiểu bảng quy đổi cũ bên vận hành (chị Hoa góp ý 28/10: dễ nhìn hơn): mỗi món một dòng, sửa mã / loại / số lượng ngay trong ô,
   dòng đầu mỗi combo có mã sàn, trạng thái và nút Xác nhận / Lưu. Sửa xong chưa lưu thì giữ nháp ở SPCB.dr[key]. */
const SPC_KOPT=[["sp","Sản phẩm"],["gift","Quà tặng"],["pack","Bao bì"],["skip","Bỏ qua"]];
const spcDraft=c=>(SPCB.dr||{})[c.key];
function spcComboView(C){
  SPCB.dr=SPCB.dr||{};
  const shops=[...new Set(C.combos.filter(c=>c.ch===SPCB.ch).flatMap(c=>c.shops))].sort();
  let L=C.combos.filter(c=>c.ch===SPCB.ch);
  if(SPCB.shop)L=L.filter(c=>c.shops.includes(SPCB.shop));
  if(SPCB.f==="flag")L=L.filter(c=>c.active&&(c.flag||c.parts.some(p=>p.kind!=="skip"&&!C.items.has(spcLow(p.code)))));
  else if(SPCB.f==="gv"&&C.g)L=L.filter(c=>c.active&&spcCost(c.parts,C.g).u==null);
  else if(SPCB.f==="off")L=L.filter(c=>!c.active);else L=L.filter(c=>c.active);
  const fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPCB.q||"").trim();
  if(q)L=L.filter(c=>q.split(/\s+/).every(w=>fold(c.sku+" "+c.variant+" "+c.parts.map(p=>p.code+" "+p.label).join(" ")).includes(w)));
  L.sort((a,b)=>(spcDraft(b)?1:0)-(spcDraft(a)?1:0)||b.orders-a.orders||a.sku.localeCompare(b.sku));
  const fo=[["all","Đang dùng"],["flag","Cần kế toán xác nhận"]].concat(C.g?[["gv","Chưa tính được giá vốn"]]:[],[["off","Đã ngừng dùng"]]);
  const can=SPCB.can,nm=code=>{const it=SPCB.items.get(spcLow(code));return it?it.name:""};
  const rows=[];
  L.slice(0,150).forEach(c=>{
    const P=spcDraft(c)||c.parts,dirty=!!spcDraft(c),st=spcStatus({...c,parts:P},C.items,C.g),x=C.g?spcCost(P,C.g):null,da=`data-k="${esc(c.key)}"`,ed=can&&c.active;
    P.forEach((p,j)=>{const first=j===0,gv=C.g&&C.g[spcLow(p.code)],bad=p.kind!=="skip"&&!C.items.has(spcLow(p.code));
      rows.push(`<tr${first?' style="border-top:2px solid #d9dde3"':""}${c.active?"":' class="muted"'}>
       <td>${first?`<b class="mono">${esc(c.sku)}</b>${c.variant?`<br><small class="hint">${esc(c.variant)}</small>`:""}<br><small class="hint" title="${esc(c.shops.join(", "))}">${c.orders?nf(c.orders)+" đơn · ":""}${c.shops.length} ${SPCB.ch==="FACEBOOK"?"nguồn":"shop"}</small>`:""}</td>
       <td>${ed?`<input class="spi-c mono" ${da} data-j="${j}" value="${esc(p.kind==="skip"?"":p.code)}" placeholder="${p.kind==="skip"?"bỏ qua":"Gõ mã hoặc tên"}" style="width:150px${bad?";border-color:#d92d20":""}">`:`<span class="mono">${esc(p.code)}</span>`}</td>
       <td>${p.kind==="skip"?`<span class="hint">không trừ kho</span>`:bad?`<span class="t-red">chưa có mã kho: ${esc(p.label)}</span>`:esc(nm(p.code))}</td>
       <td>${ed?`<select class="spi-k" ${da} data-j="${j}" style="min-width:110px">${opt(SPC_KOPT,p.kind)}</select>`:esc((SPC_KOPT.find(k=>k[0]===p.kind)||["",""])[1])}</td>
       <td class="n">${ed?`<input class="spi-q n" type="number" min="0" step="any" ${da} data-j="${j}" value="${p.qty}" style="width:64px">`:p.qty}</td>
       ${C.g?`<td class="n">${p.kind==="skip"?"":gv?nf(gv.u*p.qty):p.kind==="pack"?`<small class="hint">—</small>`:`<small class="t-amb">chưa có giá</small>`}</td>`:""}
       <td>${first?`${pill(dirty?"Chưa lưu":st[1],dirty?"blu":st[0])}${c.flag?`<div><small class="t-amb">❓ ${esc(c.flag)}</small></div>`:""}`:""}</td>
       <td style="white-space:nowrap">${ed?(first?(dirty?`<button class="btn sm pri" data-spsv="${esc(c.key)}">Lưu</button> <button class="btn sm" data-spun2="${esc(c.key)}">Bỏ sửa</button>`:c.flag?`<button class="btn sm pri" data-spok="${esc(c.key)}" title="Combo quy đổi đúng: bỏ dấu cần xác nhận">✓ Xác nhận</button>`:"")+` <button class="btn sm" data-sped="${esc(c.key)}" title="Lịch sử sửa, đổi combo từ ngày, ngừng dùng">⋯</button>`:"")+(P.length>1?` <button class="btn sm" data-sprm2="${esc(c.key)}" data-j="${j}" title="Bỏ món này">✕</button>`:""):first?`<button class="btn sm" data-sped="${esc(c.key)}">${can?"Dùng lại / lịch sử":"Xem"}</button>`:""}</td></tr>`)});
    rows.push(`<tr><td></td><td colspan="${C.g?7:6}" style="padding-top:2px">${ed?`<a href="#" data-spadd3="${esc(c.key)}">+ thêm món</a>`:""}${C.g?` <span class="hint" style="float:right">Giá vốn 1 combo: <b>${x.u==null?"chưa tính được":nf(x.u)+"đ"}</b></span>`:""}</td></tr>`);
  });
  return `<section class="card flush"><div class="card-h pad"><div class="filters">
    <div class="seg">${SPC_CH.map(([k,n])=>`<button class="${SPCB.ch===k?"on":""}" data-spch="${k}">${n} (${C.combos.filter(c=>c.ch===k&&c.active).length})</button>`).join("")}</div>
    ${shops.length>1?`<select id="spc-shop"><option value="">Mọi ${SPCB.ch==="FACEBOOK"?"nguồn":"shop"} (${shops.length})</option>${opt(shops,SPCB.shop)}</select>`:""}
    <select id="spc-f">${opt(fo,SPCB.f)}</select><input id="spc-q" placeholder="Tìm mã sàn, phân loại, mã sản phẩm…" value="${esc(SPCB.q)}" style="max-width:240px"><span class="hint">${nf(L.length)} combo</span></div>
    ${can?`<button class="btn pri" data-spnew="1">+ Thêm combo</button>`:""}</div>
   <p class="hint pad" style="padding-top:0">Mỗi combo bán trên sàn gồm những món nào. Sửa mã, loại, số lượng ngay trong ô rồi bấm <b>Lưu</b>; combo có dấu ❓ đúng rồi thì bấm <b>✓ Xác nhận</b>. Lưu xong web tự tính lại phiếu xuất kho các ngày có đơn của mã đó. Nút ⋯: lịch sử sửa, shop đổi combo từ ngày, ngừng dùng.</p>
   ${rows.length?tbl(["Mã trên sàn","Mã kho","Tên sản phẩm","Loại","SL / 1 combo"].concat(C.g?["Giá vốn"]:[],["Trạng thái",""]),rows):`<p class="hint pad">Không có combo nào.</p>`}
   ${L.length>150?`<p class="hint pad">Đang hiện 150 / ${nf(L.length)} combo. Gõ vào ô tìm để thu hẹp.</p>`:""}</section>`;
}
/* Lưu một combo từ bảng (Lưu nháp hoặc Xác nhận nguyên trạng). */
async function spcSaveInline(c,parts,msg){
  const P=parts.filter(p=>(p.code||p.kind==="skip")&&p.qty>0);
  if(!P.some(p=>p.kind==="sp"||p.kind==="skip")){toast("Combo cần ít nhất 1 sản phẩm");spcLoad(true);return}
  const bad=P.find(p=>p.kind!=="skip"&&!SPCB.items.has(spcLow(p.code)));if(bad){toast(`"${bad.code||bad.label}" chưa có trong Sản phẩm gốc. Gõ mã khác hoặc thêm sản phẩm gốc trước.`);renderMain();return}
  try{const r=await spcApi("/combo",{method:"PUT",body:JSON.stringify({channel:c.ch,sku:c.sku,variant:c.variant,from_day:c.cur.from,parts:P.map(p=>({item_label:p.kind==="skip"?"BỎ QUA":p.code,qty:p.qty,kind:p.kind}))})});
    delete SPCB.dr[c.key];toast(msg+" "+c.sku+(r.recomputed_days?` · tính lại phiếu xuất ${r.recomputed_days} ngày`:""));SPCB.at=0;spcLoad(true)}
  catch(e){toast(e.message);renderMain()}
}
function spcProdView(C){
  let L=SPCB.prods.map(p=>({...p,crm:SPCB.khomap.filter(k=>spcLow(k.misa_code)===spcLow(p.code)).map(k=>k.crm_sku),used:C.used[spcLow(p.code)]||0,gv:C.g&&C.g[spcLow(p.code)]}));
  if(SPCB.pf==="on")L=L.filter(p=>p.active);else if(SPCB.pf==="combo")L=L.filter(p=>p.used);else if(SPCB.pf==="nogv")L=L.filter(p=>p.active&&!p.gv);else if(SPCB.pf==="off")L=L.filter(p=>!p.active);
  const fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPCB.pq||"").trim();
  if(q)L=L.filter(p=>q.split(/\s+/).every(w=>fold(p.code+" "+p.name+" "+p.crm.join(" ")).includes(w)));
  L.sort((a,b)=>b.used-a.used||a.code.localeCompare(b.code));
  const fo=[["on","Đang dùng"],["combo","Đang nằm trong combo"]].concat(C.g?[["nogv","Chưa có giá vốn"]]:[],[["off","Ngừng dùng"]]);
  return `<section class="card flush"><div class="card-h pad"><div class="filters"><select id="spc-pf">${opt(fo,SPCB.pf)}</select><input id="spc-pq" placeholder="Tìm mã, tên…" value="${esc(SPCB.pq)}" style="max-width:240px"><span class="hint">${nf(L.length)} mã</span></div>
    ${SPCB.can?`<button class="btn pri" data-spadd="1">+ Thêm sản phẩm</button>`:""}</div>
   <p class="hint pad" style="padding-top:0">Sản phẩm gốc = mã kho/MISA (thành phẩm, hàng hóa, quà). Một mã dùng chung cho kho, Kênh phân phối và combo các sàn.${C.g?" Giá vốn lấy ở Giá vốn SKU, chưa có thì lấy giá nhập kho bình quân.":""}</p>
   ${tbl(["Mã kho / MISA","Tên","ĐVT","Loại","Mã bán Kênh phân phối"].concat(C.g?["Giá vốn"]:[],["Trong combo",""]),L.slice(0,400).map(p=>`<tr${p.active?"":' style="opacity:.55"'}><td class="mono"><b>${esc(p.code)}</b></td><td>${esc(p.name)}${p.active?"":" <small class='hint'>(ngừng dùng)</small>"}</td><td>${esc(p.unit)}</td><td>${p.cls==="TP"?"Thành phẩm":"Hàng hóa / quà"}</td><td class="mono">${p.crm.map(esc).join(", ")||"—"}</td>
     ${C.g?`<td class="n">${SPCB.can&&p.active?`<input class="spp-gvi n" inputmode="numeric" data-c="${esc(p.code)}" data-n="${esc(p.name)}" value="${p.gv&&/^Giá vốn SKU/.test(p.gv.src)?Math.round(p.gv.u):""}" placeholder="${p.gv?nf(p.gv.u):"chưa có"}" style="width:110px${p.gv?"":";border-color:#f79009"}">`:p.gv?nf(p.gv.u)+"đ":pill("chưa có","amb")}${p.gv?`<br><small style="color:#667085;font-weight:400">${esc(p.gv.src)}</small>`:""}</td>`:""}<td class="n">${p.used||""}</td><td>${SPCB.can?`<button class="btn sm" data-spp="${esc(p.code)}">Sửa</button>`:""}</td></tr>`))}
   ${L.length>400?`<p class="hint pad">Đang hiện 400 / ${nf(L.length)}. Gõ vào ô tìm để thu hẹp.</p>`:""}</section>`;
}
function spcUnView(){
  const L=SPCB.un||[];
  return `<section class="card flush"><p class="hint pad">Web tự liệt kê mã trên đơn sàn mà <b>chưa có combo</b>. Kho vẫn soạn và xuất hàng bình thường; các đơn này <b>chưa tính giá vốn</b> (không ước số) và sổ tồn chưa trừ. Kế toán bấm <b>Nhập combo</b>; lưu xong web tự tính lại phiếu xuất và giá vốn các đơn đó, việc ở Việc hôm nay tự đóng khi hết mã.</p>
   ${tbl(["Kênh","Mã trên đơn","Tên trên sàn","Đơn","Ngày",""],L.map((u,i)=>`<tr><td>${SPC_CHN(u.channel)}<br>${(u.shops||[]).map(spcShop).join("")}</td><td><b class="mono">${esc(u.sku)}</b>${u.variant?`<br><small class="hint">${esc(u.variant)}</small>`:""}</td><td><small>${esc(String(u.name||"").slice(0,90))}</small></td><td class="n">${nf(u.orders)}</td>
     <td>${spcDd(u.first_day)}${u.last_day!==u.first_day?"–"+spcDd(u.last_day):""}<br>${pill("chưa tính giá vốn","amb")}</td><td>${SPCB.can?`<button class="btn sm pri" data-spun="${i}">Nhập combo</button>`:""}</td></tr>`))}
   </section>`;
}
function spcBind(m,C){
  const keep=(id,f)=>{const e=$(id);if(!e)return;e.oninput=()=>{f(e.value);const p=e.selectionStart;renderMain();const x=$(id);if(x){x.focus();x.setSelectionRange(p,p)}}};
  keep("#spc-q",v=>SPCB.q=v);keep("#spc-pq",v=>SPCB.pq=v);
  const ch=(id,f)=>{const e=$(id);if(e)e.onchange=()=>{f(e.value);renderMain()}};
  ch("#spc-f",v=>SPCB.f=v);ch("#spc-shop",v=>SPCB.shop=v);ch("#spc-pf",v=>SPCB.pf=v);
  m.querySelectorAll("[data-spch]").forEach(b=>b.onclick=()=>{SPCB.ch=b.dataset.spch;SPCB.shop="";renderMain()});
  m.querySelectorAll("[data-sped]").forEach(b=>b.onclick=()=>{const c=C.combos.find(x=>x.key===b.dataset.sped);if(c)spcbEdit(c)});
  m.querySelectorAll("[data-spun]").forEach(b=>b.onclick=()=>spcbEdit(null,SPCB.un[+b.dataset.spun]));
  m.querySelectorAll("[data-spnew]").forEach(b=>b.onclick=()=>spcbEdit(null,null));
  m.querySelectorAll("[data-spadd]").forEach(b=>b.onclick=()=>spcProd(null));
  m.querySelectorAll("[data-spp]").forEach(b=>b.onclick=()=>spcProd(SPCB.prods.find(p=>p.code===b.dataset.spp)));
  m.querySelectorAll(".spp-gvi").forEach(x=>{x.onkeydown=e=>{if(e.key==="Enter")x.blur()};x.onchange=()=>{const v=+String(x.value).replace(/[^0-9]/g,"");if(!(v>0)){toast("Giá vốn phải lớn hơn 0");return}if(spcSetGv(x.dataset.c,x.dataset.n,v)){toast("Đã lưu giá vốn "+x.dataset.c+": "+nf(v)+"đ (tháng "+spcKy().slice(5)+")");renderMain()}}});
  /* Sửa ngay trong bảng combo: lần sửa đầu chép combo ra nháp. */
  const cOf=k=>C.combos.find(x=>x.key===k),dr=c=>SPCB.dr[c.key]||(SPCB.dr[c.key]=c.parts.map(p=>({...p})));
  m.querySelectorAll(".spi-q").forEach(x=>x.onchange=()=>{const c=cOf(x.dataset.k);if(!c)return;dr(c)[+x.dataset.j].qty=+String(x.value).replace(",",".")||0;renderMain()});
  m.querySelectorAll(".spi-k").forEach(x=>x.onchange=()=>{const c=cOf(x.dataset.k);if(!c)return;dr(c)[+x.dataset.j].kind=x.value;renderMain()});
  if(typeof khoLoad==="function")khoLoad();
  m.querySelectorAll(".spi-c").forEach(x=>{const set=it=>{const c=cOf(x.dataset.k);if(!c||!it)return;const p=dr(c)[+x.dataset.j];p.code=it.code;p.label=it.code+" - "+it.name;if(p.kind==="skip")p.kind="sp";renderMain()};
    if(typeof khoPick==="function"&&typeof KHO!=="undefined"&&KHO.items&&KHO.items.size)khoPick(x,null,set);
    x.onchange=()=>{const it=SPCB.items.get(spcLow(x.value.split(" - ")[0]));if(it)set(it)}});
  m.querySelectorAll("[data-sprm2]").forEach(b=>b.onclick=()=>{const c=cOf(b.dataset.sprm2);if(!c)return;dr(c).splice(+b.dataset.j,1);renderMain()});
  m.querySelectorAll("[data-spadd3]").forEach(a=>a.onclick=e=>{e.preventDefault();const c=cOf(a.dataset.spadd3);if(!c)return;dr(c).push({code:"",label:"",qty:1,kind:"gift"});renderMain()});
  m.querySelectorAll("[data-spun2]").forEach(b=>b.onclick=()=>{delete SPCB.dr[b.dataset.spun2];renderMain()});
  m.querySelectorAll("[data-spsv]").forEach(b=>b.onclick=()=>{const c=cOf(b.dataset.spsv);if(c){b.disabled=true;spcSaveInline(c,SPCB.dr[c.key]||c.parts,"Đã lưu")}});
  m.querySelectorAll("[data-spok]").forEach(b=>b.onclick=()=>{const c=cOf(b.dataset.spok);if(c){b.disabled=true;spcSaveInline(c,c.parts,"Đã xác nhận")}});
}
/* ---------- Ô sửa combo (ngăn kéo bên phải) ---------- */
function spcbEdit(c,fromUn){
  const v=c?c.cur:null;
  SPCB.ed={c,fromUn,ch:c?c.ch:fromUn?fromUn.channel:SPCB.ch,sku:c?c.sku:fromUn?fromUn.sku:"",variant:c?c.variant:fromUn?fromUn.variant:"",from:v?v.from:"",
    parts:v?v.parts.map(p=>({...p})):[{label:"",code:"",qty:1,kind:"sp"}],shops:c?c.shops:fromUn?fromUn.shops||[]:[]};
  SPCB.hist=null;spcEdDraw();
  if(c)spcApi(`/history?channel=${c.ch}&sku=${encodeURIComponent(c.sku)}`).then(r=>{SPCB.hist=r;if(SPCB.ed&&SPCB.ed.c===c)spcEdDraw()}).catch(()=>{SPCB.hist=[]});
}
function spcEdRead(){
  const E=SPCB.ed;if(!E)return;
  document.querySelectorAll("#drawerIn .spc-row").forEach(r=>{const p=E.parts[+r.dataset.i];if(!p)return;const v=r.querySelector(".spc-pc").value.trim(),it=SPCB.items.get(spcLow(spcCode(v)));
    p.code=it?it.code:spcCode(v);p.label=it?it.code+" - "+it.name:v;p.qty=+String(r.querySelector(".spc-pq").value).replace(",",".")||0;const k=r.querySelector(".spc-pk");if(k)p.kind=k.value});
  ["sku","variant"].forEach(k=>{const e=$("#spc-e-"+k);if(e)E[k]=e.value.trim()});const ch=$("#spc-e-ch");if(ch)E.ch=ch.value;
}
function spcEdDraw(){
  const E=SPCB.ed,c=E.c,can=SPCB.can,g=spcSeeCost()?spcGvMap((D()&&D().skus)||[],SPCB.cost,spcKy()):null;
  const nm=code=>{const it=SPCB.items.get(spcLow(code));return it?it.name:""};
  const row=(p,i)=>{const gv=g&&g[spcLow(p.code)];return `<tr class="spc-row" data-i="${i}"><td><input class="spc-pc mono" value="${esc(p.kind==="skip"?"":p.code)}" placeholder="Gõ mã hoặc tên" style="width:140px" ${can?"":"disabled"}></td><td>${esc(nm(p.code)||(p.code?"chưa có mã kho":""))}</td>
    <td><select class="spc-pk" style="min-width:110px" ${can?"":"disabled"}>${opt(SPC_KOPT,p.kind)}</select></td><td><input class="spc-pq n" type="number" min="0" step="any" value="${p.qty}" style="width:60px" ${can?"":"disabled"}></td>${g?`<td class="n">${p.kind==="skip"?"":gv?nf(gv.u*p.qty):p.kind==="pack"?"—":"<small class=t-amb>chưa có giá</small>"}</td>`:""}<td>${can?`<button class="btn sm" data-sprm="${i}" title="Bỏ dòng">✕</button>`:""}</td></tr>`};
  const x=g?spcCost(E.parts.filter(p=>p.code||p.kind==="skip"),g):null;
  const H2=SPCB.hist;const lb={KHO_ONLINE_MAP:"Lưu",KHO_ONLINE_MAP_SWAP:"Đổi mã",KHO_ONLINE_MAP_CONFIRM:"Xác nhận",KHO_ONLINE_MAP_VERSION:"Bản mới theo ngày",KHO_ONLINE_MAP_CLONE:"Sao chép",SP_COMBO_ADD:"Thêm",SP_COMBO_SAVE:"Sửa",SP_COMBO_STOP:"Ngừng dùng",SP_COMBO_RESUME:"Dùng lại"};
  const hs=h=>{let a={};try{a=JSON.parse(h.after_json||"{}")}catch(e){}const ps=a.parts?a.parts.map(x=>(x[1]!=1?x[1]+"×":"")+spcCode(x[0])).join(", "):a.item_label?(a.qty!=1?a.qty+"×":"")+spcCode(a.item_label):"";
    return `<div style="padding:5px 0;border-bottom:1px solid var(--line,#eee)"><b>${esc(String(h.created_at||"").slice(8,10)+"/"+String(h.created_at||"").slice(5,7)+" "+String(h.created_at||"").slice(11,16))}</b> · ${esc(h.by_name||"")} · ${lb[h.action]||esc(h.action)}${a.from_day?" (từ "+spcDd(a.from_day)+")":""}${a.off_from?" từ "+spcDd(a.off_from):""}${ps?": "+esc(ps):""}</div>`};
  openDrawerHTML(`<h2>${c?(can?"Sửa combo":"Combo"):"Thêm combo"} · ${SPC_CHN(E.ch)}</h2>
   ${E.fromUn?`<div class="note amb">Mã mới từ đơn: ${nf(E.fromUn.orders)} đơn kho đã xuất, đang chờ tính giá vốn.</div>`:""}
   ${c&&c.flag?`<div class="note amb">❓ Cần kế toán xác nhận: ${esc(c.flag)}</div>`:""}
   <div class="filters"><label class="inl">Kênh <select id="spc-e-ch" ${c||E.fromUn?"disabled":""}>${opt(SPC_CH,E.ch)}</select></label></div>
   <div class="filters"><label class="inl">Mã trên sàn <input id="spc-e-sku" value="${esc(E.sku)}" ${c||E.fromUn?"readonly":""}></label><label class="inl">Phân loại <input id="spc-e-variant" value="${esc(E.variant)}" placeholder="trống = mọi phân loại" ${c||E.fromUn?"readonly":""}></label></div>
   ${E.shops.length?`<p class="hint">Đang bán ở: ${E.shops.map(spcShop).join("")}</p>`:""}
   ${c&&c.versions.length>1?`<p class="hint">Combo có ${c.versions.length} bản theo ngày: ${c.versions.map(v=>v.from?"từ "+spcDd(v.from):"từ đầu").join(", ")}. Đang sửa bản ${E.from?"từ "+spcDd(E.from):"từ đầu"}.</p>`:""}
   <h3 style="margin:14px 0 6px">Combo gồm</h3>${tbl(["Mã kho","Tên sản phẩm","Loại","SL"].concat(g?["Giá vốn"]:[],[""]),E.parts.map(row))}${can?`<a href="#" data-spadd2="sp">+ thêm món</a> <small class="hint">Loại: sản phẩm · quà tặng (tính giá vốn, kho xuất kèm) · bao bì (hộp, thùng) · bỏ qua (không trừ kho)</small>`:""}
   ${E.parts.some(p=>p.kind==="skip")?`<p class="hint">Có dòng "Bỏ qua": mã này không trừ kho.</p>`:""}
   ${g?`<div class="note" style="margin-top:12px">Giá vốn 1 combo (sản phẩm + quà): <b>${x.u==null?"chưa tính được — thiếu giá "+esc(x.miss.join(", ")):nf(x.u)+"đ"}</b></div>`:""}
   ${can&&c?`<h3 style="margin:14px 0 6px">Áp dụng</h3><label class="inl"><input type="radio" name="spc-ap" value="" checked style="width:auto"> Sửa cho mọi ngày của bản này (nhập sai)</label><br>
     <label class="inl"><input type="radio" name="spc-ap" value="d" style="width:auto"> Shop đổi combo từ ngày <input type="date" id="spc-e-from" value="${spcToday()}"> — các ngày trước giữ cách cũ</label>`:""}
   ${can?`<div class="filters" style="margin-top:14px"><button class="btn pri" id="spc-save">Lưu</button>${c?(c.active?`<button class="btn" id="spc-stop" style="margin-left:auto">Ngừng dùng combo</button>`:`<button class="btn" id="spc-resume" style="margin-left:auto">Dùng lại</button>`):""}</div>`:""}
   ${c?`<h3 style="margin:16px 0 6px">Lịch sử sửa</h3><div style="max-height:220px;overflow:auto;font-size:13px">${H2==null?`<p class="hint">Đang tải…</p>`:H2.length?H2.map(hs).join(""):`<p class="hint">Chưa có lần sửa nào được ghi.</p>`}</div>`:""}`);
  const dr=$("#drawerIn");
  dr.querySelectorAll("[data-sprm]").forEach(b=>b.onclick=()=>{spcEdRead();E.parts.splice(+b.dataset.sprm,1);spcEdDraw()});
  dr.querySelectorAll("[data-spadd2]").forEach(b=>b.onclick=e=>{e.preventDefault();spcEdRead();E.parts.push({label:"",code:"",qty:1,kind:b.dataset.spadd2});spcEdDraw()});
  if($("#spc-save"))$("#spc-save").onclick=spcSave;
  if($("#spc-stop"))$("#spc-stop").onclick=async()=>{const d=prompt("Ngừng dùng combo "+c.sku+" từ ngày (YYYY-MM-DD). Đơn trước ngày này giữ cách tính cũ; đơn từ ngày này sẽ vào Mã chưa quy đổi.",spcToday());if(!d)return;
    try{const r=await spcApi("/combo/stop",{method:"POST",body:JSON.stringify({channel:c.ch,sku:c.sku,variant:c.variant,off_from:d.trim()})});closeDrawer();toast("Đã ngừng dùng "+c.sku+(r.recomputed_days?" · tính lại "+r.recomputed_days+" ngày":""));spcLoad(true)}catch(e){toast(e.message)}};
  if($("#spc-resume"))$("#spc-resume").onclick=async()=>{try{const r=await spcApi("/combo/stop",{method:"POST",body:JSON.stringify({channel:c.ch,sku:c.sku,variant:c.variant,off_from:""})});closeDrawer();toast("Đã dùng lại "+c.sku+(r.recomputed_days?" · tính lại "+r.recomputed_days+" ngày":""));spcLoad(true)}catch(e){toast(e.message)}};
  dr.querySelectorAll(".spc-pc,.spc-pq,.spc-pk").forEach(i=>i.onchange=()=>{spcEdRead();spcEdDraw()});
  if(typeof khoPick==="function"&&typeof KHO!=="undefined"&&KHO.items&&KHO.items.size)dr.querySelectorAll(".spc-pc").forEach(i=>khoPick(i,null,it=>{i.value=it.code;spcEdRead();spcEdDraw()}));
}
async function spcSave(){
  spcEdRead();const E=SPCB.ed,c=E.c;
  const parts=E.parts.filter(p=>(p.code||p.kind==="skip")&&p.qty>0);
  if(!E.sku){toast("Cần mã trên sàn");return}
  if(!parts.some(p=>p.kind==="sp"||p.kind==="skip")){toast("Combo cần ít nhất 1 sản phẩm");return}
  const bad=parts.find(p=>p.kind!=="skip"&&!SPCB.items.has(spcLow(p.code)));if(bad){toast(`"${bad.label}" chưa có trong Sản phẩm gốc. Thêm sản phẩm gốc trước.`);return}
  const ap=document.querySelector("input[name=spc-ap]:checked"),nf2=ap&&ap.value?($("#spc-e-from")||{}).value:"";
  if(ap&&ap.value&&!nf2){toast("Chọn ngày áp dụng");return}
  const b=$("#spc-save");if(b)b.disabled=true;
  try{const r=await spcApi("/combo",{method:"PUT",body:JSON.stringify({channel:E.ch,sku:E.sku,variant:E.variant,from_day:nf2||E.from,parts:parts.map(p=>({item_label:p.kind==="skip"?"BỎ QUA":p.code,qty:p.qty,kind:p.kind}))})});
    closeDrawer();toast(`Đã lưu ${E.sku}`+(r.recomputed_days?` · tính lại phiếu xuất ${r.recomputed_days} ngày (${nf(r.orders)} đơn)`:"")+(r.unmapped_left?` · còn ${r.unmapped_left} mã chưa quy đổi`:""));SPCB.at=0;spcLoad(true)}
  catch(e){toast(e.message);if(b)b.disabled=false}
}
/* ---------- Sản phẩm gốc: thêm một bước / sửa ---------- */
/* Ghi giá vốn tháng hiện tại vào Giá vốn SKU (D().skus), như trang Giá vốn SKU. */
function spcSetGv(code,name,v){if(!(v>0)||typeof DB==="undefined")return false;const ky=spcKy();
  /* Lưu vết: giá cũ (đang dùng) → giá mới, ai sửa, lúc nào (nhật ký máy chủ, xem ở Sửa › Lịch sử giá vốn). */
  const g0=spcGvMap((D()&&D().skus)||[],SPCB.cost,ky)[spcLow(code)],old=g0?Math.round(g0.u):null;if(old===Math.round(v))return false;
  spcApi("/cost-log",{method:"POST",body:JSON.stringify({code,ky,old,new:Math.round(v)})}).catch(e=>toast("Đã lưu giá nhưng chưa ghi được lịch sử: "+e.message));
  DB.mutate(ME.name,"giá vốn "+code+" tháng "+ky,dt=>{dt.skus=dt.skus||[];let s=dt.skus.find(x=>spcLow(x.ma)===spcLow(code));if(!s){s={ma:code,ten:name,k:typeof guessSku==="function"?guessSku(name)||"KHAC":"KHAC",qc:"",giaVon:{},giaBan:0,active:true};dt.skus.push(s)}s.giaVon=s.giaVon||{};s.giaVon[ky]=Math.round(v)});return true}
function spcProd(p){
  const g=spcSeeCost()?spcGvMap((D()&&D().skus)||[],SPCB.cost,spcKy()):null,gv=p&&g&&g[spcLow(p.code)];
  const crm=p?SPCB.khomap.filter(k=>spcLow(k.misa_code)===spcLow(p.code)).map(k=>k.crm_sku):[];
  openDrawerHTML(`<h2>${p?"Sửa sản phẩm gốc":"Thêm sản phẩm — một bước"}</h2>
   <div class="filters"><label class="inl" style="flex:1">Tên sản phẩm <input id="spp-n" value="${esc(p?p.name:"")}" placeholder="Ví dụ: Nước lau sàn Ailla 1L hương Quế" style="width:100%"></label></div>
   <div class="filters"><label class="inl">Đơn vị <input id="spp-u" value="${esc(p?p.unit:"Chai")}" style="width:100px"></label>
    ${p?"":`<label class="inl">Loại <select id="spp-c">${opt([["TP","Thành phẩm"],["HH","Hàng hóa / quà"]],"TP")}</select></label>`}
    <label class="inl">Mã kho / MISA <input id="spp-code" class="mono" value="${esc(p?p.code:"")}" ${p?"readonly":""} placeholder="web tự gợi ý từ tên"></label>
    ${g?`<label class="inl">Giá vốn tháng ${spcKy().slice(5)}/${spcKy().slice(0,4)} (đ) <input id="spp-gv" inputmode="numeric" value="${gv?Math.round(gv.u):""}" style="width:130px"></label>`:""}</div>
   ${p?`<p class="hint">Mã kho không đổi được (đã có phiếu kho, MISA dùng). Mã bán Kênh phân phối: ${crm.map(esc).join(", ")||"chưa có"}.${gv?" Giá vốn đang dùng: "+nf(gv.u)+"đ ("+esc(gv.src)+").":""}</p>`
     :`<label class="inl"><input type="checkbox" id="spp-kpp" checked style="width:auto"> Bán cho Kênh phân phối (tạo mã bán cùng mã và nối mã kho)</label>
       <div class="note" style="margin-top:8px">Bấm Lưu là web tự: tạo mã kho/MISA · tạo mã bán Kênh phân phối cùng mã · nối mã bán ↔ mã kho (hệ số 1)${g?" · ghi giá vốn vào Giá vốn SKU":""}. Giá bán 8 cấp vẫn đặt ở Bảng giá.</div>`}
   ${p?`<h3 style="margin:16px 0 6px">Lịch sử giá vốn và sửa sản phẩm</h3><div id="spp-hist" style="max-height:220px;overflow:auto;font-size:13px"><p class="hint">Đang tải…</p></div>`:""}
   <div class="filters" style="margin-top:14px"><button class="btn pri" id="spp-save">Lưu</button>${p?(p.active?`<button class="btn" id="spp-off" style="margin-left:auto">Ngừng dùng</button>`:`<button class="btn" id="spp-on" style="margin-left:auto">Dùng lại</button>`):""}</div>`);
  if(p)spcApi("/cost-history?code="+encodeURIComponent(p.code)).then(L=>{const el=$("#spp-hist");if(!el)return;const t=x=>String(x||"");
    el.innerHTML=L.length?L.map(h=>{let a={},b={};try{a=JSON.parse(h.after_json||"{}");b=JSON.parse(h.before_json||"{}")}catch(e){}const at=t(h.created_at);
      const what=h.action==="SP_GIA_VON"?`giá vốn tháng ${esc(t(a.ky).slice(5))}/${esc(t(a.ky).slice(0,4))}: ${b.gia?nf(b.gia)+"đ → ":""}<b>${nf(a.gia)}đ</b>`:h.action==="SP_PRODUCT_ADD"?"tạo sản phẩm":"sửa "+[a.name!==b.name?"tên":"",a.unit!==b.unit?"đơn vị":"",a.active!==b.active?(a.active?"dùng lại":"ngừng dùng"):""].filter(Boolean).join(", ");
      return `<div style="padding:5px 0;border-bottom:1px solid var(--line,#eee)"><b>${esc(at.slice(8,10)+"/"+at.slice(5,7)+" "+at.slice(11,16))}</b> · ${esc(h.by_name||"")} · ${what}</div>`}).join(""):`<p class="hint">Chưa có lần sửa nào được ghi (giá nhập trước 28/10 ở trang Giá vốn SKU chưa có lịch sử).</p>`}).catch(()=>{});
  if(!p){const n=$("#spp-n"),cd=$("#spp-code");n.oninput=()=>{if(!cd.dataset.t)cd.value=spcSuggestCode(n.value)};cd.oninput=()=>{cd.dataset.t=1}}
  const setGv=spcSetGv;
  $("#spp-save").onclick=async()=>{const name=$("#spp-n").value.trim(),unit=$("#spp-u").value.trim(),v=$("#spp-gv")?+String($("#spp-gv").value).replace(/[^0-9]/g,""):0;
    if(!name){toast("Cần tên sản phẩm");return}
    try{
      if(p){await spcApi("/products/"+encodeURIComponent(p.code),{method:"PATCH",body:JSON.stringify({name,unit})});if(v&&(!gv||Math.round(gv.u)!==Math.round(v)))setGv(p.code,name,v);toast("Đã lưu "+p.code)}
      else{const code=$("#spp-code").value.trim();if(!code){toast("Cần mã kho");return}
        const r=await spcApi("/products",{method:"POST",body:JSON.stringify({code,name,unit,cls:$("#spp-c").value,kpp:$("#spp-kpp").checked})});
        setGv(r.code,name,v);toast("Đã tạo "+r.code+": mã kho"+(r.product_id?", mã bán Kênh phân phối, nối mã":"")+(v>0?", giá vốn":""));SPCB.pq=r.code;SPCB.pf="on"}
      closeDrawer();if(typeof KHO!=="undefined")KHO.cat=null;spcLoad(true)}catch(e){toast(e.message)}};
  const act=a=>async()=>{if(!a&&!confirm(p.code+" sẽ không chọn được cho combo mới; combo cũ vẫn tính. Ngừng dùng?"))return;
    try{await spcApi("/products/"+encodeURIComponent(p.code),{method:"PATCH",body:JSON.stringify({active:a})});closeDrawer();toast(a?"Đã dùng lại "+p.code:"Đã ngừng dùng "+p.code);spcLoad(true)}catch(e){toast(e.message)}};
  if($("#spp-off"))$("#spp-off").onclick=act(false);if($("#spp-on"))$("#spp-on").onclick=act(true);
}
/* ---------- Vận hành › Kho: combo gồm gì để soạn hàng (chỉ xem, không giá) ---------- */
function pKhoCombo(m){
  const T="Combo soạn hàng",S="Gõ mã trên đơn sàn để xem combo gồm những gì. Kế toán nhập và sửa combo ở web quản trị.";
  spcLoad();
  if(SPCB.err){m.innerHTML=H(T,S)+`<div class="note red">${esc(SPCB.err)}</div>`;return}
  if(!SPCB.rows){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  const all=spcGroup(SPCB.rows,SPCB.sales,spcToday()).filter(c=>c.active),fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPCB.kq||"").trim();
  const L=(q?all.filter(c=>q.split(/\s+/).every(w=>fold(c.sku+" "+c.variant+" "+c.parts.map(p=>p.label).join(" ")).includes(w))):all.slice().sort((a,b)=>b.orders-a.orders)).slice(0,40);
  const nm=p=>{const it=SPCB.items.get(spcLow(p.code));return it?it.name:p.label};
  m.innerHTML=H(T,S)+`<section class="card"><input id="spk-q" placeholder="Gõ mã trên phiếu / đơn sàn, ví dụ RC800C, 2TL" value="${esc(SPCB.kq)}" style="width:100%">
   <p class="hint">${q?nf(L.length)+" combo khớp":"Combo bán nhiều nhất"} · ${nf(all.length)} combo đang dùng · ${nf((SPCB.un||[]).length)} mã mới đang chờ kế toán nhập (kho vẫn xuất bình thường).</p></section>
   ${L.map(c=>`<section class="card"><div class="card-h"><h2 class="mono">${esc(c.sku)}${c.variant?` <small class="hint">· ${esc(c.variant)}</small>`:""}</h2><span class="hint">${SPC_CHN(c.ch)}</span></div>
     ${c.parts.filter(p=>p.kind!=="skip").map(p=>`<div style="padding:4px 0">☐ <b>${p.qty}</b> × ${esc(nm(p))} <small class="hint mono">${esc(p.code)}</small>${p.kind==="gift"?" "+pill("quà tặng","vio"):p.kind==="pack"?" "+pill("bao bì","gry"):""}</div>`).join("")||`<p class="hint">Mã này không trừ kho.</p>`}</section>`).join("")||`<p class="hint pad">Không thấy combo này. Báo kế toán nhập ở web quản trị.</p>`}`;
  const e=$("#spk-q");e.oninput=()=>{SPCB.kq=e.value;const p=e.selectionStart;renderMain();const x=$("#spk-q");if(x){x.focus();x.setSelectionRange(p,p)}};
}
PAGES.spcombo=pSpcombo;
PAGES.kho_combo=pKhoCombo;
/* Quy đổi mã các sàn (trang cũ ở quản trị): mở thẳng Sản phẩm & combo; các nút "Mở Quy đổi mã các sàn" ở TikTok/Shopee về đây. */
PAGES.kho_qd=pSpcombo;
/* Đưa trang vào kho trang để menubang.js xếp: quản trị › Cấu hình › Danh mục; vận hành › Kho – Sản xuất › Danh mục. */
MODULES.push({k:"q_spc",adm:true,zone:"Quản trị",ic:"box",n:"Sản phẩm & combo",sub:"",groups:()=>[["",[MI("spcombo","Sản phẩm & combo",()=>typeof mhManage==="function"&&mhManage())]]]});
MODULES.push({k:"spc_kho",zone:"Vận hành",ic:"box",n:"Combo soạn hàng",sub:"",groups:()=>[["",[MI("kho_combo","Combo soạn hàng")]]]});
