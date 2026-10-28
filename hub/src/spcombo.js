/* =====================================================================
   SẢN PHẨM & COMBO (chị Hoa duyệt demo 28/10/2026, C:\Users\ADMIN\Downloads\demo-san-pham-combo.html)
   Quản trị › Cấu hình › Sản phẩm & combo (spcombo): 3 tab Combo theo kênh · Sản phẩm gốc · Mã chưa quy đổi.
   Vận hành › Kho – Sản xuất › Danh mục › Combo soạn hàng (kho_combo): kho chỉ xem combo gồm gì, không giá, không sửa.
   Máy chủ: /api/hub/sanpham (routes/sanpham.ts). Hàm thuần: spccalc.js. Chỉ CEO và kế toán sửa (máy chủ chặn).
   Giá vốn sản phẩm gốc ghi vào Giá vốn SKU (D().skus, tháng hiện tại) như trang Giá vốn SKU.
   ===================================================================== */
const SPC={tab:"combo",ch:"SHOPEE",shop:"",f:"all",q:"",pf:"on",pq:"",kq:"",busy:false,err:"",at:0,ed:null,hist:null};
const spcApi=(p,o)=>svApi("/api/hub/sanpham"+p,o);
const spcKy=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,7);
const spcToday=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
/* Thấy giá vốn: CEO hoặc người có quyền xem số tiền (kế toán). */
const spcSeeCost=()=>typeof SV!=="undefined"&&!!SV.me&&(SV.me.role==="CEO"||(SV.perms||[]).includes("debt.read.all")||(SV.perms||[]).includes("order.accounting.confirm"));
const spcPage=()=>PAGE==="spcombo"||PAGE==="kho_combo"||PAGE==="kho_qd";
async function spcLoad(force){
  if(SPC.busy)return;if(!force&&SPC.at&&Date.now()-SPC.at<60000)return;
  SPC.busy=true;
  try{
    const [cb,pr,un,cat,cost]=await Promise.all([spcApi("/combos"),spcApi("/products"),spcApi("/unmapped"),kApi("/catalog").catch(()=>({items:[]})),spcSeeCost()?kApi("/costs").catch(()=>[]):[]]);
    SPC.rows=cb.rows||[];SPC.sales=cb.sales||[];SPC.can=!!cb.can_edit;SPC.prods=pr.items||[];SPC.khomap=pr.kho_map||[];SPC.un=un||[];
    SPC.items=new Map(((cat&&cat.items)||[]).map(i=>[spcLow(i.code),i]));SPC.cost=cost||[];SPC.err="";
  }catch(e){SPC.err=e.message||"Không tải được"}
  SPC.busy=false;SPC.at=Date.now();if(spcPage())renderMain();
}
function spcCtx(){
  const combos=spcGroup(SPC.rows,SPC.sales,spcToday()),items=new Set([...SPC.items.keys()]);
  const g=spcSeeCost()?spcGvMap((typeof D==="function"&&D()&&D().skus)||[],SPC.cost,spcKy()):null;
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
  if(SPC.err){m.innerHTML=H(T,S)+`<div class="note red">${esc(SPC.err)}</div>`;return}
  if(!SPC.rows){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  const C=spcCtx(),act=C.combos.filter(c=>c.active),U=spcUnSum(SPC.un);
  const pUsed=SPC.prods.filter(p=>p.active&&C.used[spcLow(p.code)]),pNoGv=C.g?pUsed.filter(p=>!C.g[spcLow(p.code)]).length:0;
  const noGv=C.g?act.filter(c=>spcCost(c.parts,C.g).u==null).length:0,flag=act.filter(c=>c.flag).length;
  const go=(t,h)=>`<span data-spct="${t}" style="cursor:pointer">${h}</span>`;
  const kp=`<div class="grid kpis">${go("sp",kpi("Sản phẩm gốc",nf(SPC.prods.filter(p=>p.active).length),`${nf(pUsed.length)} mã đang nằm trong combo${C.g?" · "+nf(pNoGv)+" mã đó chưa có giá vốn":""}`))}
    ${go("combo",kpi("Combo đang dùng",nf(act.length),SPC_CH.map(([k,n])=>n+" "+act.filter(c=>c.ch===k).length).join(" · ")))}
    ${C.g?go("combo",kpi("Combo chưa tính được giá vốn",nf(noGv),`món bên trong chưa có giá vốn · ${nf(flag)} combo cần kế toán xác nhận`,noGv?"#b54708":"")):""}
    ${go("un",kpi("Mã chưa quy đổi",nf(U.codes),`${nf(U.orders)} đơn kho đã xuất, chưa tính giá vốn`,U.codes?"#b42318":""))}</div>`;
  const tabs=`<nav class="settabs">${[["combo","Combo theo kênh"],["sp","Sản phẩm gốc"],["un","Mã chưa quy đổi"+(U.codes?" ("+U.codes+")":"")]].map(([k,t])=>`<button class="${SPC.tab===k?"on":""}" data-spct="${k}">${t}</button>`).join("")}</nav>`;
  const body=SPC.tab==="sp"?spcProdView(C):SPC.tab==="un"?spcUnView(C):spcComboView(C);
  m.innerHTML=H(T,S)+kp+tabs+body+(SPC.can?"":`<p class="hint pad">Bạn chỉ xem. CEO và kế toán mới sửa được.</p>`);
  m.querySelectorAll("[data-spct]").forEach(b=>b.onclick=()=>{SPC.tab=b.dataset.spct;renderMain()});
  spcBind(m,C);
}
function spcComboView(C){
  const shops=[...new Set(C.combos.filter(c=>c.ch===SPC.ch).flatMap(c=>c.shops))].sort();
  let L=C.combos.filter(c=>c.ch===SPC.ch);
  if(SPC.shop)L=L.filter(c=>c.shops.includes(SPC.shop));
  if(SPC.f==="flag")L=L.filter(c=>c.active&&(c.flag||c.parts.some(p=>p.kind!=="skip"&&!C.items.has(spcLow(p.code)))));
  else if(SPC.f==="gv"&&C.g)L=L.filter(c=>c.active&&spcCost(c.parts,C.g).u==null);
  else if(SPC.f==="off")L=L.filter(c=>!c.active);else L=L.filter(c=>c.active);
  const fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPC.q||"").trim();
  if(q)L=L.filter(c=>q.split(/\s+/).every(w=>fold(c.sku+" "+c.variant+" "+c.parts.map(p=>p.label).join(" ")).includes(w)));
  L.sort((a,b)=>b.orders-a.orders||a.sku.localeCompare(b.sku));
  const fo=[["all","Đang dùng"],["flag","Cần kế toán xác nhận"]].concat(C.g?[["gv","Chưa tính được giá vốn"]]:[],[["off","Đã ngừng dùng"]]);
  return `<section class="card flush"><div class="card-h pad"><div class="filters">
    <div class="seg">${SPC_CH.map(([k,n])=>`<button class="${SPC.ch===k?"on":""}" data-spch="${k}">${n} (${C.combos.filter(c=>c.ch===k&&c.active).length})</button>`).join("")}</div>
    ${shops.length>1?`<select id="spc-shop"><option value="">Mọi ${SPC.ch==="FACEBOOK"?"nguồn":"shop"} (${shops.length})</option>${opt(shops,SPC.shop)}</select>`:""}
    <select id="spc-f">${opt(fo,SPC.f)}</select><input id="spc-q" placeholder="Tìm mã sàn, phân loại, mã sản phẩm…" value="${esc(SPC.q)}" style="max-width:240px"><span class="hint">${nf(L.length)} combo</span></div>
    ${SPC.can?`<button class="btn pri" data-spnew="1">+ Thêm combo</button>`:""}</div>
   <p class="hint pad" style="padding-top:0">Mỗi combo = mã trên sàn (kèm phân loại nếu có) → sản phẩm gốc × số lượng, cộng quà tặng 🎁 và bao bì đóng gói. Lưu xong web tự tính lại phiếu xuất kho các ngày có đơn của mã đó.</p>
   ${tbl(["Mã trên sàn","Gồm"].concat(C.g?["Giá vốn 1 combo"]:[],["Đơn","Trạng thái",""]),L.slice(0,300).map(c=>{const st=spcStatus(c,C.items,C.g),x=C.g?spcCost(c.parts,C.g):null;
     return `<tr><td><b class="mono">${esc(c.sku)}</b>${c.variant?`<br><small class="hint">${esc(c.variant)}</small>`:""}${c.versions.length>1?`<br><small class="hint">${c.versions.length} bản theo ngày</small>`:""}<br>${c.shops.map(spcShop).join("")}</td>
       <td>${c.parts.map(p=>spcChip(p,C.items)).join("")}${c.flag?`<div><small class="t-amb">❓ ${esc(c.flag)}</small></div>`:""}</td>
       ${C.g?`<td class="n">${x.u==null?`<small class="hint">chưa tính được</small>`:nf(x.u)+"đ"}</td>`:""}<td class="n">${c.orders||""}</td>
       <td>${pill(st[1],st[0])}<br><small class="hint">sửa ${spcDd((c.upd||"").slice(0,10))}</small></td><td><button class="btn sm" data-sped="${esc(c.key)}">${SPC.can?"Sửa":"Xem"}</button></td></tr>`}))}
   ${L.length>300?`<p class="hint pad">Đang hiện 300 / ${nf(L.length)}. Gõ vào ô tìm để thu hẹp.</p>`:""}</section>`;
}
function spcProdView(C){
  let L=SPC.prods.map(p=>({...p,crm:SPC.khomap.filter(k=>spcLow(k.misa_code)===spcLow(p.code)).map(k=>k.crm_sku),used:C.used[spcLow(p.code)]||0,gv:C.g&&C.g[spcLow(p.code)]}));
  if(SPC.pf==="on")L=L.filter(p=>p.active);else if(SPC.pf==="combo")L=L.filter(p=>p.used);else if(SPC.pf==="nogv")L=L.filter(p=>p.active&&!p.gv);else if(SPC.pf==="off")L=L.filter(p=>!p.active);
  const fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPC.pq||"").trim();
  if(q)L=L.filter(p=>q.split(/\s+/).every(w=>fold(p.code+" "+p.name+" "+p.crm.join(" ")).includes(w)));
  L.sort((a,b)=>b.used-a.used||a.code.localeCompare(b.code));
  const fo=[["on","Đang dùng"],["combo","Đang nằm trong combo"]].concat(C.g?[["nogv","Chưa có giá vốn"]]:[],[["off","Ngừng dùng"]]);
  return `<section class="card flush"><div class="card-h pad"><div class="filters"><select id="spc-pf">${opt(fo,SPC.pf)}</select><input id="spc-pq" placeholder="Tìm mã, tên…" value="${esc(SPC.pq)}" style="max-width:240px"><span class="hint">${nf(L.length)} mã</span></div>
    ${SPC.can?`<button class="btn pri" data-spadd="1">+ Thêm sản phẩm</button>`:""}</div>
   <p class="hint pad" style="padding-top:0">Sản phẩm gốc = mã kho/MISA (thành phẩm, hàng hóa, quà). Một mã dùng chung cho kho, Kênh phân phối và combo các sàn.${C.g?" Giá vốn lấy ở Giá vốn SKU, chưa có thì lấy giá nhập kho bình quân.":""}</p>
   ${tbl(["Mã kho / MISA","Tên","ĐVT","Loại","Mã bán Kênh phân phối"].concat(C.g?["Giá vốn"]:[],["Trong combo",""]),L.slice(0,400).map(p=>`<tr${p.active?"":' style="opacity:.55"'}><td class="mono"><b>${esc(p.code)}</b></td><td>${esc(p.name)}${p.active?"":" <small class='hint'>(ngừng dùng)</small>"}</td><td>${esc(p.unit)}</td><td>${p.cls==="TP"?"Thành phẩm":"Hàng hóa / quà"}</td><td class="mono">${p.crm.map(esc).join(", ")||"—"}</td>
     ${C.g?`<td class="n">${p.gv?nf(p.gv.u)+"đ<br><small class='hint'>"+esc(p.gv.src)+"</small>":pill("chưa có","amb")}</td>`:""}<td class="n">${p.used||""}</td><td>${SPC.can?`<button class="btn sm" data-spp="${esc(p.code)}">Sửa</button>`:""}</td></tr>`))}
   ${L.length>400?`<p class="hint pad">Đang hiện 400 / ${nf(L.length)}. Gõ vào ô tìm để thu hẹp.</p>`:""}</section>`;
}
function spcUnView(){
  const L=SPC.un||[];
  return `<section class="card flush"><p class="hint pad">Web tự liệt kê mã trên đơn sàn mà <b>chưa có combo</b>. Kho vẫn soạn và xuất hàng bình thường; các đơn này <b>chưa tính giá vốn</b> (không ước số) và sổ tồn chưa trừ. Kế toán bấm <b>Nhập combo</b>; lưu xong web tự tính lại phiếu xuất và giá vốn các đơn đó, việc ở Việc hôm nay tự đóng khi hết mã.</p>
   ${tbl(["Kênh","Mã trên đơn","Tên trên sàn","Đơn","Ngày",""],L.map((u,i)=>`<tr><td>${SPC_CHN(u.channel)}<br>${(u.shops||[]).map(spcShop).join("")}</td><td><b class="mono">${esc(u.sku)}</b>${u.variant?`<br><small class="hint">${esc(u.variant)}</small>`:""}</td><td><small>${esc(String(u.name||"").slice(0,90))}</small></td><td class="n">${nf(u.orders)}</td>
     <td>${spcDd(u.first_day)}${u.last_day!==u.first_day?"–"+spcDd(u.last_day):""}<br>${pill("chưa tính giá vốn","amb")}</td><td>${SPC.can?`<button class="btn sm pri" data-spun="${i}">Nhập combo</button>`:""}</td></tr>`))}
   </section>`;
}
function spcBind(m,C){
  const keep=(id,f)=>{const e=$(id);if(!e)return;e.oninput=()=>{f(e.value);const p=e.selectionStart;renderMain();const x=$(id);if(x){x.focus();x.setSelectionRange(p,p)}}};
  keep("#spc-q",v=>SPC.q=v);keep("#spc-pq",v=>SPC.pq=v);
  const ch=(id,f)=>{const e=$(id);if(e)e.onchange=()=>{f(e.value);renderMain()}};
  ch("#spc-f",v=>SPC.f=v);ch("#spc-shop",v=>SPC.shop=v);ch("#spc-pf",v=>SPC.pf=v);
  m.querySelectorAll("[data-spch]").forEach(b=>b.onclick=()=>{SPC.ch=b.dataset.spch;SPC.shop="";renderMain()});
  m.querySelectorAll("[data-sped]").forEach(b=>b.onclick=()=>{const c=C.combos.find(x=>x.key===b.dataset.sped);if(c)spcEdit(c)});
  m.querySelectorAll("[data-spun]").forEach(b=>b.onclick=()=>spcEdit(null,SPC.un[+b.dataset.spun]));
  m.querySelectorAll("[data-spnew]").forEach(b=>b.onclick=()=>spcEdit(null,null));
  m.querySelectorAll("[data-spadd]").forEach(b=>b.onclick=()=>spcProd(null));
  m.querySelectorAll("[data-spp]").forEach(b=>b.onclick=()=>spcProd(SPC.prods.find(p=>p.code===b.dataset.spp)));
}
/* ---------- Ô sửa combo (ngăn kéo bên phải) ---------- */
function spcEdit(c,fromUn){
  const v=c?c.cur:null;
  SPC.ed={c,fromUn,ch:c?c.ch:fromUn?fromUn.channel:SPC.ch,sku:c?c.sku:fromUn?fromUn.sku:"",variant:c?c.variant:fromUn?fromUn.variant:"",from:v?v.from:"",
    parts:v?v.parts.map(p=>({...p})):[{label:"",code:"",qty:1,kind:"sp"}],shops:c?c.shops:fromUn?fromUn.shops||[]:[]};
  SPC.hist=null;spcEdDraw();
  if(c)spcApi(`/history?channel=${c.ch}&sku=${encodeURIComponent(c.sku)}`).then(r=>{SPC.hist=r;if(SPC.ed&&SPC.ed.c===c)spcEdDraw()}).catch(()=>{SPC.hist=[]});
}
function spcEdRead(){
  const E=SPC.ed;if(!E)return;
  document.querySelectorAll("#drawerIn .spc-row").forEach(r=>{const p=E.parts[+r.dataset.i];if(!p)return;const v=r.querySelector(".spc-pc").value.trim(),it=SPC.items.get(spcLow(spcCode(v)));
    p.code=it?it.code:spcCode(v);p.label=it?it.code+" - "+it.name:v;p.qty=+String(r.querySelector(".spc-pq").value).replace(",",".")||0});
  ["sku","variant"].forEach(k=>{const e=$("#spc-e-"+k);if(e)E[k]=e.value.trim()});const ch=$("#spc-e-ch");if(ch)E.ch=ch.value;
}
function spcEdDraw(){
  const E=SPC.ed,c=E.c,can=SPC.can,g=spcSeeCost()?spcGvMap((D()&&D().skus)||[],SPC.cost,spcKy()):null;
  const row=(p,i)=>{const gv=g&&g[spcLow(p.code)];return `<div class="spc-row filters" data-i="${i}" style="flex-wrap:nowrap"><input class="spc-pc" list="spc-dl" value="${esc(p.label)}" placeholder="Gõ mã hoặc tên sản phẩm gốc" style="flex:1;min-width:0" ${can?"":"disabled"}>
    <input class="spc-pq" type="number" min="0" step="any" value="${p.qty}" style="width:70px" ${can?"":"disabled"}>${g?`<small class="hint" style="width:90px;text-align:right">${gv?nf(gv.u*p.qty)+"đ":p.kind==="pack"?"bao bì":"chưa có giá"}</small>`:""}
    ${can?`<button class="btn sm" data-sprm="${i}" title="Bỏ dòng">✕</button>`:""}</div>`};
  const sec=(k,t,h)=>`<h3 style="margin:14px 0 6px">${t}</h3>${E.parts.map((p,i)=>p.kind===k?row(p,i):"").join("")}${can?`<button class="btn sm" data-spadd2="${k}">+ ${t.toLowerCase()}</button>`:""} ${h?`<small class="hint">${h}</small>`:""}`;
  const x=g?spcCost(E.parts.filter(p=>p.code),g):null;
  const H2=SPC.hist;const lb={KHO_ONLINE_MAP:"Lưu",KHO_ONLINE_MAP_SWAP:"Đổi mã",KHO_ONLINE_MAP_CONFIRM:"Xác nhận",KHO_ONLINE_MAP_VERSION:"Bản mới theo ngày",KHO_ONLINE_MAP_CLONE:"Sao chép",SP_COMBO_ADD:"Thêm",SP_COMBO_SAVE:"Sửa",SP_COMBO_STOP:"Ngừng dùng",SP_COMBO_RESUME:"Dùng lại"};
  const hs=h=>{let a={};try{a=JSON.parse(h.after_json||"{}")}catch(e){}const ps=a.parts?a.parts.map(x=>(x[1]!=1?x[1]+"×":"")+spcCode(x[0])).join(", "):a.item_label?(a.qty!=1?a.qty+"×":"")+spcCode(a.item_label):"";
    return `<div style="padding:5px 0;border-bottom:1px solid var(--line,#eee)"><b>${esc(String(h.created_at||"").slice(8,10)+"/"+String(h.created_at||"").slice(5,7)+" "+String(h.created_at||"").slice(11,16))}</b> · ${esc(h.by_name||"")} · ${lb[h.action]||esc(h.action)}${a.from_day?" (từ "+spcDd(a.from_day)+")":""}${a.off_from?" từ "+spcDd(a.off_from):""}${ps?": "+esc(ps):""}</div>`};
  const dl=[...SPC.items.values()].filter(i=>i.active!==0).map(i=>`<option value="${esc(i.code+" - "+i.name)}">`).join("");
  openDrawerHTML(`<h2>${c?(can?"Sửa combo":"Combo"):"Thêm combo"} · ${SPC_CHN(E.ch)}</h2>
   ${E.fromUn?`<div class="note amb">Mã mới từ đơn: ${nf(E.fromUn.orders)} đơn kho đã xuất, đang chờ tính giá vốn.</div>`:""}
   ${c&&c.flag?`<div class="note amb">❓ Cần kế toán xác nhận: ${esc(c.flag)}</div>`:""}
   <div class="filters"><label class="inl">Kênh <select id="spc-e-ch" ${c||E.fromUn?"disabled":""}>${opt(SPC_CH,E.ch)}</select></label></div>
   <div class="filters"><label class="inl">Mã trên sàn <input id="spc-e-sku" value="${esc(E.sku)}" ${c||E.fromUn?"readonly":""}></label><label class="inl">Phân loại <input id="spc-e-variant" value="${esc(E.variant)}" placeholder="trống = mọi phân loại" ${c||E.fromUn?"readonly":""}></label></div>
   ${E.shops.length?`<p class="hint">Đang bán ở: ${E.shops.map(spcShop).join("")}</p>`:""}
   ${c&&c.versions.length>1?`<p class="hint">Combo có ${c.versions.length} bản theo ngày: ${c.versions.map(v=>v.from?"từ "+spcDd(v.from):"từ đầu").join(", ")}. Đang sửa bản ${E.from?"từ "+spcDd(E.from):"từ đầu"}.</p>`:""}
   <datalist id="spc-dl">${dl}</datalist>
   ${sec("sp","Sản phẩm","")}${sec("gift","Quà tặng","tính vào giá vốn combo, kho xuất kèm")}${sec("pack","Bao bì đóng gói","hộp, thùng — kho xuất kèm")}
   ${E.parts.some(p=>p.kind==="skip")?`<p class="hint">Có dòng "Bỏ qua": mã này không trừ kho.</p>`:""}
   ${g?`<div class="note" style="margin-top:12px">Giá vốn 1 combo (sản phẩm + quà): <b>${x.u==null?"chưa tính được — thiếu giá "+esc(x.miss.join(", ")):nf(x.u)+"đ"}</b></div>`:""}
   ${can&&c?`<h3 style="margin:14px 0 6px">Áp dụng</h3><label class="inl"><input type="radio" name="spc-ap" value="" checked style="width:auto"> Sửa cho mọi ngày của bản này (nhập sai)</label><br>
     <label class="inl"><input type="radio" name="spc-ap" value="d" style="width:auto"> Shop đổi combo từ ngày <input type="date" id="spc-e-from" value="${spcToday()}"> — các ngày trước giữ cách cũ</label>`:""}
   ${can?`<div class="filters" style="margin-top:14px"><button class="btn pri" id="spc-save">Lưu</button>${c?(c.active?`<button class="btn" id="spc-stop" style="margin-left:auto">Ngừng dùng combo</button>`:`<button class="btn" id="spc-resume" style="margin-left:auto">Dùng lại</button>`):""}</div>`:""}
   ${c?`<h3 style="margin:16px 0 6px">Lịch sử sửa</h3><div style="max-height:220px;overflow:auto;font-size:13px">${H2==null?`<p class="hint">Đang tải…</p>`:H2.length?H2.map(hs).join(""):`<p class="hint">Chưa có lần sửa nào được ghi.</p>`}</div>`:""}`);
  const dr=$("#drawerIn");
  dr.querySelectorAll("[data-sprm]").forEach(b=>b.onclick=()=>{spcEdRead();E.parts.splice(+b.dataset.sprm,1);spcEdDraw()});
  dr.querySelectorAll("[data-spadd2]").forEach(b=>b.onclick=()=>{spcEdRead();E.parts.push({label:"",code:"",qty:1,kind:b.dataset.spadd2});spcEdDraw()});
  if($("#spc-save"))$("#spc-save").onclick=spcSave;
  if($("#spc-stop"))$("#spc-stop").onclick=async()=>{const d=prompt("Ngừng dùng combo "+c.sku+" từ ngày (YYYY-MM-DD). Đơn trước ngày này giữ cách tính cũ; đơn từ ngày này sẽ vào Mã chưa quy đổi.",spcToday());if(!d)return;
    try{const r=await spcApi("/combo/stop",{method:"POST",body:JSON.stringify({channel:c.ch,sku:c.sku,variant:c.variant,off_from:d.trim()})});closeDrawer();toast("Đã ngừng dùng "+c.sku+(r.recomputed_days?" · tính lại "+r.recomputed_days+" ngày":""));spcLoad(true)}catch(e){toast(e.message)}};
  if($("#spc-resume"))$("#spc-resume").onclick=async()=>{try{const r=await spcApi("/combo/stop",{method:"POST",body:JSON.stringify({channel:c.ch,sku:c.sku,variant:c.variant,off_from:""})});closeDrawer();toast("Đã dùng lại "+c.sku+(r.recomputed_days?" · tính lại "+r.recomputed_days+" ngày":""));spcLoad(true)}catch(e){toast(e.message)}};
  dr.querySelectorAll(".spc-pc,.spc-pq").forEach(i=>i.onchange=()=>{spcEdRead();spcEdDraw()});
}
async function spcSave(){
  spcEdRead();const E=SPC.ed,c=E.c;
  const parts=E.parts.filter(p=>p.code&&p.qty>0);
  if(!E.sku){toast("Cần mã trên sàn");return}
  if(!parts.some(p=>p.kind==="sp"||p.kind==="skip")){toast("Combo cần ít nhất 1 sản phẩm");return}
  const bad=parts.find(p=>p.kind!=="skip"&&!SPC.items.has(spcLow(p.code)));if(bad){toast(`"${bad.label}" chưa có trong Sản phẩm gốc. Thêm sản phẩm gốc trước.`);return}
  const ap=document.querySelector("input[name=spc-ap]:checked"),nf2=ap&&ap.value?($("#spc-e-from")||{}).value:"";
  if(ap&&ap.value&&!nf2){toast("Chọn ngày áp dụng");return}
  const b=$("#spc-save");if(b)b.disabled=true;
  try{const r=await spcApi("/combo",{method:"PUT",body:JSON.stringify({channel:E.ch,sku:E.sku,variant:E.variant,from_day:nf2||E.from,parts:parts.map(p=>({item_label:p.kind==="skip"?"BỎ QUA":p.code,qty:p.qty,kind:p.kind}))})});
    closeDrawer();toast(`Đã lưu ${E.sku}`+(r.recomputed_days?` · tính lại phiếu xuất ${r.recomputed_days} ngày (${nf(r.orders)} đơn)`:"")+(r.unmapped_left?` · còn ${r.unmapped_left} mã chưa quy đổi`:""));SPC.at=0;spcLoad(true)}
  catch(e){toast(e.message);if(b)b.disabled=false}
}
/* ---------- Sản phẩm gốc: thêm một bước / sửa ---------- */
function spcProd(p){
  const g=spcSeeCost()?spcGvMap((D()&&D().skus)||[],SPC.cost,spcKy()):null,gv=p&&g&&g[spcLow(p.code)];
  const crm=p?SPC.khomap.filter(k=>spcLow(k.misa_code)===spcLow(p.code)).map(k=>k.crm_sku):[];
  openDrawerHTML(`<h2>${p?"Sửa sản phẩm gốc":"Thêm sản phẩm — một bước"}</h2>
   <div class="filters"><label class="inl" style="flex:1">Tên sản phẩm <input id="spp-n" value="${esc(p?p.name:"")}" placeholder="Ví dụ: Nước lau sàn Ailla 1L hương Quế" style="width:100%"></label></div>
   <div class="filters"><label class="inl">Đơn vị <input id="spp-u" value="${esc(p?p.unit:"Chai")}" style="width:100px"></label>
    ${p?"":`<label class="inl">Loại <select id="spp-c">${opt([["TP","Thành phẩm"],["HH","Hàng hóa / quà"]],"TP")}</select></label>`}
    <label class="inl">Mã kho / MISA <input id="spp-code" class="mono" value="${esc(p?p.code:"")}" ${p?"readonly":""} placeholder="web tự gợi ý từ tên"></label>
    ${g?`<label class="inl">Giá vốn tháng ${spcKy().slice(5)}/${spcKy().slice(0,4)} (đ) <input id="spp-gv" type="number" min="0" value="${gv?Math.round(gv.u):""}" style="width:130px"></label>`:""}</div>
   ${p?`<p class="hint">Mã kho không đổi được (đã có phiếu kho, MISA dùng). Mã bán Kênh phân phối: ${crm.map(esc).join(", ")||"chưa có"}.${gv?" Giá vốn đang dùng: "+nf(gv.u)+"đ ("+esc(gv.src)+").":""}</p>`
     :`<label class="inl"><input type="checkbox" id="spp-kpp" checked style="width:auto"> Bán cho Kênh phân phối (tạo mã bán cùng mã và nối mã kho)</label>
       <div class="note" style="margin-top:8px">Bấm Lưu là web tự: tạo mã kho/MISA · tạo mã bán Kênh phân phối cùng mã · nối mã bán ↔ mã kho (hệ số 1)${g?" · ghi giá vốn vào Giá vốn SKU":""}. Giá bán 8 cấp vẫn đặt ở Bảng giá.</div>`}
   <div class="filters" style="margin-top:14px"><button class="btn pri" id="spp-save">Lưu</button>${p?(p.active?`<button class="btn" id="spp-off" style="margin-left:auto">Ngừng dùng</button>`:`<button class="btn" id="spp-on" style="margin-left:auto">Dùng lại</button>`):""}</div>`);
  if(!p){const n=$("#spp-n"),cd=$("#spp-code");n.oninput=()=>{if(!cd.dataset.t)cd.value=spcSuggestCode(n.value)};cd.oninput=()=>{cd.dataset.t=1}}
  const setGv=(code,name,v)=>{if(!(v>0)||typeof DB==="undefined")return;const ky=spcKy();
    DB.mutate(ME.name,"giá vốn "+code+" tháng "+ky,dt=>{dt.skus=dt.skus||[];let s=dt.skus.find(x=>spcLow(x.ma)===spcLow(code));if(!s){s={ma:code,ten:name,k:typeof guessSku==="function"?guessSku(name)||"KHAC":"KHAC",qc:"",giaVon:{},giaBan:0,active:true};dt.skus.push(s)}s.giaVon=s.giaVon||{};s.giaVon[ky]=Math.round(v)})};
  $("#spp-save").onclick=async()=>{const name=$("#spp-n").value.trim(),unit=$("#spp-u").value.trim(),v=$("#spp-gv")?+$("#spp-gv").value:0;
    if(!name){toast("Cần tên sản phẩm");return}
    try{
      if(p){await spcApi("/products/"+encodeURIComponent(p.code),{method:"PATCH",body:JSON.stringify({name,unit})});if(v&&(!gv||Math.round(gv.u)!==Math.round(v)))setGv(p.code,name,v);toast("Đã lưu "+p.code)}
      else{const code=$("#spp-code").value.trim();if(!code){toast("Cần mã kho");return}
        const r=await spcApi("/products",{method:"POST",body:JSON.stringify({code,name,unit,cls:$("#spp-c").value,kpp:$("#spp-kpp").checked})});
        setGv(r.code,name,v);toast("Đã tạo "+r.code+": mã kho"+(r.product_id?", mã bán Kênh phân phối, nối mã":"")+(v>0?", giá vốn":""));SPC.pq=r.code;SPC.pf="on"}
      closeDrawer();if(typeof KHO!=="undefined")KHO.cat=null;spcLoad(true)}catch(e){toast(e.message)}};
  const act=a=>async()=>{if(!a&&!confirm(p.code+" sẽ không chọn được cho combo mới; combo cũ vẫn tính. Ngừng dùng?"))return;
    try{await spcApi("/products/"+encodeURIComponent(p.code),{method:"PATCH",body:JSON.stringify({active:a})});closeDrawer();toast(a?"Đã dùng lại "+p.code:"Đã ngừng dùng "+p.code);spcLoad(true)}catch(e){toast(e.message)}};
  if($("#spp-off"))$("#spp-off").onclick=act(false);if($("#spp-on"))$("#spp-on").onclick=act(true);
}
/* ---------- Vận hành › Kho: combo gồm gì để soạn hàng (chỉ xem, không giá) ---------- */
function pKhoCombo(m){
  const T="Combo soạn hàng",S="Gõ mã trên đơn sàn để xem combo gồm những gì. Kế toán nhập và sửa combo ở web quản trị.";
  spcLoad();
  if(SPC.err){m.innerHTML=H(T,S)+`<div class="note red">${esc(SPC.err)}</div>`;return}
  if(!SPC.rows){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  const all=spcGroup(SPC.rows,SPC.sales,spcToday()).filter(c=>c.active),fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPC.kq||"").trim();
  const L=(q?all.filter(c=>q.split(/\s+/).every(w=>fold(c.sku+" "+c.variant+" "+c.parts.map(p=>p.label).join(" ")).includes(w))):all.slice().sort((a,b)=>b.orders-a.orders)).slice(0,40);
  const nm=p=>{const it=SPC.items.get(spcLow(p.code));return it?it.name:p.label};
  m.innerHTML=H(T,S)+`<section class="card"><input id="spk-q" placeholder="Gõ mã trên phiếu / đơn sàn, ví dụ RC800C, 2TL" value="${esc(SPC.kq)}" style="width:100%">
   <p class="hint">${q?nf(L.length)+" combo khớp":"Combo bán nhiều nhất"} · ${nf(all.length)} combo đang dùng · ${nf((SPC.un||[]).length)} mã mới đang chờ kế toán nhập (kho vẫn xuất bình thường).</p></section>
   ${L.map(c=>`<section class="card"><div class="card-h"><h2 class="mono">${esc(c.sku)}${c.variant?` <small class="hint">· ${esc(c.variant)}</small>`:""}</h2><span class="hint">${SPC_CHN(c.ch)}</span></div>
     ${c.parts.filter(p=>p.kind!=="skip").map(p=>`<div style="padding:4px 0">☐ <b>${p.qty}</b> × ${esc(nm(p))} <small class="hint mono">${esc(p.code)}</small>${p.kind==="gift"?" "+pill("quà tặng","vio"):p.kind==="pack"?" "+pill("bao bì","gry"):""}</div>`).join("")||`<p class="hint">Mã này không trừ kho.</p>`}</section>`).join("")||`<p class="hint pad">Không thấy combo này. Báo kế toán nhập ở web quản trị.</p>`}`;
  const e=$("#spk-q");e.oninput=()=>{SPC.kq=e.value;const p=e.selectionStart;renderMain();const x=$("#spk-q");if(x){x.focus();x.setSelectionRange(p,p)}};
}
PAGES.spcombo=pSpcombo;
PAGES.kho_combo=pKhoCombo;
/* Quy đổi mã các sàn (trang cũ ở quản trị): mở thẳng Sản phẩm & combo; các nút "Mở Quy đổi mã các sàn" ở TikTok/Shopee về đây. */
PAGES.kho_qd=pSpcombo;
/* Đưa trang vào kho trang để menubang.js xếp: quản trị › Cấu hình › Danh mục; vận hành › Kho – Sản xuất › Danh mục. */
MODULES.push({k:"q_spc",adm:true,zone:"Quản trị",ic:"box",n:"Sản phẩm & combo",sub:"",groups:()=>[["",[MI("spcombo","Sản phẩm & combo",()=>typeof mhManage==="function"&&mhManage())]]]});
MODULES.push({k:"spc_kho",zone:"Vận hành",ic:"box",n:"Combo soạn hàng",sub:"",groups:()=>[["",[MI("kho_combo","Combo soạn hàng")]]]});
