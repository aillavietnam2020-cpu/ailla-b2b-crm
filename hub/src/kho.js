/* =====================================================================
   KHO VẬT TƯ (khối Sản xuất & kho) — thay file Google Sheet AILLA_Kho_SanXuat_NXT.
   Luồng: nhập NVL → pha chế BTP → kiểm kê đóng gói (tự trừ BTP, vỏ, tem theo định mức) → xuất kho → hàng hoàn.
   Dữ liệu nằm ở các bảng kho_* trong D1 (không nằm trong hub_state); mỗi phiếu ghi sổ theo từng dòng, sai thì HỦY rồi lập lại.
   Telegram: làm sau, đã có /api/hub/kho/alerts để bot đọc.
   ===================================================================== */
const KHO_SUB=[["kho_ton","Tồn kho"],["kho_nhap","Nhập kho"],["kho_pc","Pha chế"],["sx_lo","Kiểm kê đóng gói"],["kho_xuat","Xuất kho"],["kho_hoan","Hàng hoàn"],["kho_nxt","Nhập – xuất – tồn"],["kho_cl","Chênh lệch & cảnh báo"],["kho_dm","Danh mục & định mức"],["kho_map","Đồng bộ mã B2B"]];
const KHO_TYPES={
  PN:{page:"kho_nhap",name:"Phiếu nhập kho",who:["sx.kiemke"],hint:"Hàng mua về: nguyên vật liệu, vỏ, tem, hàng hóa. Kế toán kho ghi theo số thực nhận."},
  PC:{page:"kho_pc",name:"Phiếu pha chế",who:["sx.kythuat","sx.kiemke"],hint:"Mỗi mẻ pha một phiếu, pha theo phiếu sản xuất của Thảo. Ghi số lít thực tế và số thực tế từng nguyên liệu (nguyên liệu không dùng ghi 0)."},
  KS:{page:"sx_lo",name:"Phiếu kiểm kê đóng gói",who:["sx.kiemke"],hint:"Chúc kiểm kê sau khi đóng gói xong. Hệ thống tự trừ bán thành phẩm, vỏ, tem theo định mức."},
  XB:{page:"kho_xuat",name:"Phiếu xuất kho",who:["sx.kiemke"],hint:"Thủ kho ghi số thực xuất. Vỏ thùng của từng đơn ghi ngay trong phiếu. Đơn TikTok, Shopee, Facebook, B2B trừ ở nơi khác."},
  TL:{page:"kho_hoan",name:"Phiếu nhập hàng hoàn",who:["sx.kiemke"],hint:"Hàng hoàn về kho: chọn Bán tiếp (cộng tồn) hoặc Bỏ (chỉ ghi nhận)."},
  TD:{page:"kho_ton",name:"Tồn đầu kỳ",who:[],hint:"Số kiểm kê tại ngày chốt. Chỉ CEO nhập."}};
const KHO_CLS={NVL:"Nguyên vật liệu",BTP:"Bán thành phẩm",TP:"Thành phẩm",HH:"Hàng hóa",CCDC:"Công cụ",COMBO:"Combo"};
const KHO_XK_KIND=["Gia công","Bán nguyên liệu","Hàng mẫu","Hủy hỏng","Khác"];
const KHO={cat:null,items:new Map(),bom:new Map(),stock:new Map(),alerts:null,at:0,busy:false,err:"",f:{q:"",cls:"",low:false},list:{},nxt:null,cl:null,period:null};
const kApi=(p,o)=>svApi("/api/hub/kho"+p,o);
const kfold=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/gi,"d").toLowerCase();
const kq=n=>Math.round((+n||0)*1000)/1000;
const knum=n=>(+n||0).toLocaleString("vi-VN",{maximumFractionDigits:3});
const kToday=()=>typeof sxToday==="function"?sxToday():new Date().toISOString().slice(0,10);
const kDd=s=>s?s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4):"—";
const kCan=t=>ME&&(ME.role==="admin"||KHO_TYPES[t].who.some(p=>can(ME,p)));
const kMonth=()=>{const t=kToday();return {from:t.slice(0,8)+"01",to:t}};

async function khoLoad(force){
  if(KHO.busy||(!force&&KHO.cat&&Date.now()-KHO.at<20000))return;
  KHO.busy=true;
  try{
    const [cat,stock,alerts]=await Promise.all([KHO.cat&&!force?KHO.cat:kApi("/catalog"),kApi("/stock"),kApi("/alerts")]);
    KHO.cat=cat;KHO.items=new Map(cat.items.map(i=>[i.code,i]));
    KHO.bom=new Map();cat.bom.forEach(b=>{if(!KHO.bom.has(b.product))KHO.bom.set(b.product,[]);KHO.bom.get(b.product).push(b)});
    KHO.stock=new Map(stock.map(s=>[s.code,s.qty]));KHO.alerts=alerts;KHO.at=Date.now();KHO.err="";
  }catch(e){KHO.err=e.message||"Không tải được dữ liệu kho"}
  finally{KHO.busy=false;if(/^kho_/.test(PAGE)&&!document.querySelector("#drawer:not([hidden])"))renderMain()}
}
const khoStock=c=>KHO.stock.get(c)||0;

/* ---------- Khung trang: thanh tab của khối Sản xuất, hàng phụ của kho ---------- */
function khoFrame(m,key,title,sub,body,actions=""){
  const pp=$("#khopop");if(pp)pp.hidden=true;
  khoLoad();
  const top=SX_TABS.map(([k,t])=>`<button class="${k==="kho_ton"?"on":""}" data-sxt="${k}">${t}</button>`).join("");
  m.innerHTML=`<div class="sxhead"><div><h1>${title}</h1><div class="ph-sub">${sub}</div></div><div class="sxact">${actions}</div></div><nav class="sxtabs">${top}</nav>
  <nav class="settabs">${KHO_SUB.map(([k,t])=>`<button class="${k===key?"on":""}" data-sxt="${k}">${t}</button>`).join("")}</nav>
  ${KHO.err?`<div class="note"><b>Chưa tải được kho:</b> ${esc(KHO.err)} <button class="lnk" id="kho-retry">Thử lại</button></div>`:!KHO.cat?`<p class="hint">Đang tải kho…</p>`:body}`;
  m.querySelectorAll("[data-sxt]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.sxt;renderMain();scrollTo(0,0)});
  if($("#kho-retry"))$("#kho-retry").onclick=()=>khoLoad(true);
}
const khoRows=(head,rows,cls)=>rows.length?tbl(head,rows,cls):`<p class="hint pad">Chưa có dữ liệu.</p>`;

/* ---------- Chọn mã hàng: gõ vài chữ của mã hoặc tên, chọn trong danh sách ---------- */
function khoPick(inp,classes,onPick){
  let pop=$("#khopop");if(!pop){pop=document.createElement("div");pop.id="khopop";pop.className="khopop";pop.hidden=true;document.body.appendChild(pop)}
  const show=()=>{const q=kfold(inp.value).trim();if(!q){pop.hidden=true;return}
    const L=[];for(const it of KHO.items.values()){if(classes&&!classes.includes(it.cls)||!it.active)continue;const hay=kfold(it.code+" "+it.name);if(q.split(/\s+/).every(w=>hay.includes(w))){L.push(it);if(L.length>=12)break}}
    const r=inp.getBoundingClientRect();pop.style.left=r.left+"px";pop.style.top=r.bottom+window.scrollY+"px";pop.style.minWidth=Math.max(r.width,320)+"px";
    pop.innerHTML=L.length?L.map(it=>`<button type="button" data-c="${esc(it.code)}"><b>${esc(it.code)}</b> ${esc(it.name)} <small>${esc(it.unit)} · tồn ${knum(khoStock(it.code))}</small></button>`).join(""):`<div class="hint pad">Không có mã nào khớp${classes?" trong loại hàng này":""}.</div>`;
    pop.hidden=false;pop.querySelectorAll("button").forEach(b=>b.onmousedown=e=>{e.preventDefault();const it=KHO.items.get(b.dataset.c);inp.value=it.code;inp.dataset.code=it.code;pop.hidden=true;onPick(it)})};
  inp.addEventListener("input",()=>{inp.dataset.code="";show()});inp.addEventListener("focus",show);inp.addEventListener("blur",()=>setTimeout(()=>pop.hidden=true,150));
}

/* Phiếu sản xuất = "Phiếu sản xuất" Thảo tạo ở tab Phiếu sản xuất (số PSX…). Chọn là tự điền số phiếu, số lượng yêu cầu, sản phẩm. */
function khoPsxList(type){
  const open=type==="PC"?["CAN_LAM","DANG_LAM"]:["DANG_LAM","CHO_KIEM"];
  try{return (SX().requests||[]).filter(r=>open.includes(r.st)).sort((a,b)=>String(b.id).localeCompare(a.id))}catch(e){return []}
}
function khoPsxOpts(type){
  const L=khoPsxList(type);
  return '<option value="">'+(L.length?"— Chọn phiếu sản xuất —":"— Chưa có phiếu sản xuất đang mở —")+'</option>'+L.map(r=>{const p=typeof sxP==="function"?sxP(r.sp):{ten:r.sp};return '<option value="'+esc(r.id)+'">'+esc(r.id+" · "+p.ten+" · "+(r.sl?knum(r.sl):"chưa chốt SL"))+'</option>'}).join("");
}
/* Điền form từ phiếu sản xuất đã chọn. PC: tự chọn bán thành phẩm và số lít theo định mức; KS: tự thêm thành phẩm và số theo phiếu. */
function khoFillFromPsx(type,id,addLine){
  const r=khoPsxList(type).find(x=>x.id===id);if(!r)return;
  $("#kf-r").value=r.id;
  const misa=typeof khoMisaOf==="function"?khoMisaOf(r.sp):"";
  if(!misa){toast("Sản phẩm này chưa nối mã MISA nên chưa tự điền được. Chọn mã tay hoặc nối mã ở bước kiểm kê lô.");return}
  if(type==="PC"){
    const B=KHO.bom.get(misa)||[],bt=B.find(b=>(KHO.items.get(b.item)||{}).cls==="BTP");
    if(!bt){toast("Sản phẩm "+misa+" không có bán thành phẩm trong định mức");return}
    $("#kf-btp").value=bt.item;$("#kf-btp").dataset.code=bt.item;
    if(r.sl){const lit=Math.round(bt.qty*r.sl*1000)/1000;$("#kf-lit").value=lit;$("#kf-rq").value=lit}
    $("#kf-lit").dispatchEvent(new Event("input"));
  }else{
    const rows=[...document.querySelectorAll("#kf-b tr")],first=rows.find(tr=>!tr.querySelector(".kf-i").dataset.code)||addLine({});
    const inp=first.querySelector(".kf-i");inp.value=misa;inp.dataset.code=misa;
    const it=KHO.items.get(misa);first.querySelector(".kf-nm").textContent=it?it.name:"";first.querySelector(".kf-u").textContent=it?it.unit:"";
    const st=first.querySelector(".kf-st");if(st)st.textContent=it?knum(khoStock(misa)):"";
    if(first.querySelector(".kf-rq")&&r.sl)first.querySelector(".kf-rq").value=r.sl;
    first.querySelector(".kf-q").dispatchEvent(new Event("input"));
  }
}

/* ---------- Form lập phiếu (mở trong ngăn bên, không mất khi trang tự làm mới) ---------- */
const KHO_LINE_CLS={PN:["NVL","HH","CCDC"],KS:["TP"],XB:null,TL:null,PC:null,TD:null};
function khoForm(type,pre){
  const T=KHO_TYPES[type],price=KHO.cat.can_price;
  const isPC=type==="PC",isKS=type==="KS",isOut=type==="XB",isTL=type==="TL",isPN=type==="PN"||type==="TD";
  const head=`<div class="row7"><label class="field">Ngày<input type="date" id="kf-d" value="${kToday()}" required></label>
   ${type==="PN"?`<label class="field grow">Nhà cung cấp<input id="kf-p" placeholder="Tên nhà cung cấp"></label>`:""}
   ${isOut?`<label class="field">Loại<select id="kf-k"><option value="XB">Xuất bán: NPP, đại lý, gia công, bán nguyên liệu (XB)</option><option value="XK">Xuất khác: hàng mẫu, hủy hỏng (XK)</option></select></label><label class="field grow">Khách hàng / nơi nhận<input id="kf-p" required></label><label class="field">Mã đơn của sale<input id="kf-r"></label>`:""}
   ${isPC?`<label class="field grow">Bán thành phẩm<input id="kf-btp" placeholder="Gõ tên BTP rồi chọn" autocomplete="off" required></label><label class="field">Số lít thực tế<input id="kf-lit" type="number" step="any" min="0" required></label><label class="field grow">Phiếu sản xuất của Thảo<select id="kf-psx">${khoPsxOpts(type)}</select></label><label class="field">Hoặc tự nhập số phiếu<input id="kf-r" placeholder="PSX…"></label><label class="field">Số lít theo phiếu<input id="kf-rq" type="number" step="any" min="0"></label>`:""}
   ${isKS?`<label class="field grow">Phiếu sản xuất của Thảo<select id="kf-psx">${khoPsxOpts(type)}</select></label><label class="field">Hoặc tự nhập số phiếu<input id="kf-r" placeholder="PSX…"></label>`:""}</div>`;
  const colHead=isPC?["Nguyên vật liệu","ĐVT","Định mức","Thực tế dùng","Tồn kho",""]:isKS?["Thành phẩm đếm được","ĐVT","Số lượng","Theo phiếu SX","Tồn",""]:isTL?["Mã hàng","ĐVT","Số lượng","Xử lý",""]:isPN?["Mã hàng","ĐVT","Số lượng",...(price&&type==="PN"?["Đơn giá"]:[]),"Tồn",""]:["Mã hàng","ĐVT","Số lượng","Tồn",""];
  openDrawerHTML(`<h2>${T.name}</h2><p class="hint">${T.hint}</p><form class="frm" id="kf">${head}
   <div class="tbl edit"><table><thead><tr>${colHead.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody id="kf-b"></tbody></table></div>
   <div class="row7"><button type="button" class="btn" id="kf-add">+ Thêm dòng</button>${isOut?`<button type="button" class="btn" id="kf-box">+ Thêm vỏ thùng</button>`:""}<label class="field grow">Ghi chú<input id="kf-n"></label></div>
   ${isKS?`<div id="kf-prev"></div>`:""}<div id="kf-warn"></div>
   <div class="row7"><button class="btn pri" id="kf-ok">Ghi phiếu</button><button type="button" class="btn" id="kf-print">In bản điền tay</button><span class="hint" id="kf-msg"></span></div></form>`);
  const body=$("#kf-b"),cls=KHO_LINE_CLS[type];
  const addLine=(o={})=>{const tr=document.createElement("tr");tr.innerHTML=
    `<td><input class="kf-i" autocomplete="off" placeholder="Gõ mã hoặc tên rồi chọn" value="${esc(o.item||"")}" data-code="${esc(o.item||"")}"${o.fixed?" readonly":""}><small class="kf-nm">${o.item&&KHO.items.get(o.item)?esc(KHO.items.get(o.item).name):""}</small></td>
     <td class="kf-u">${o.item&&KHO.items.get(o.item)?esc(KHO.items.get(o.item).unit):""}</td>
     ${isPC?`<td class="n kf-std">${o.std!=null?knum(o.std):"—"}</td>`:""}
     <td><input class="kf-q n" type="number" step="any" min="0" value="${o.qty!=null?o.qty:""}"></td>
     ${isKS?`<td><input class="kf-rq n" type="number" step="any" min="0"></td>`:""}
     ${isTL?`<td><select class="kf-v"><option value="">Chọn…</option><option value="ban_tiep">Bán tiếp</option><option value="bo">Bỏ</option></select></td>`:""}
     ${price&&type==="PN"?`<td><input class="kf-pr n" type="number" step="any" min="0"></td>`:""}
     ${!isTL?`<td class="n kf-st"></td>`:""}<td>${o.fixed?"":`<button type="button" class="lnk kf-x">✕</button>`}</td>`;
    body.appendChild(tr);const inp=tr.querySelector(".kf-i");
    const upd=()=>{const c=inp.dataset.code,it=KHO.items.get(c);tr.querySelector(".kf-nm").textContent=it?it.name:"";tr.querySelector(".kf-u").textContent=it?it.unit:"";const st=tr.querySelector(".kf-st");if(st)st.textContent=it?knum(khoStock(c)):"";refresh()};
    if(!o.fixed)khoPick(inp,o.cls||cls,it=>{upd();tr.querySelector(".kf-q").focus()});
    tr.querySelector(".kf-q").oninput=refresh;if(tr.querySelector(".kf-rq"))tr.querySelector(".kf-rq").oninput=refresh;
    if(tr.querySelector(".kf-x"))tr.querySelector(".kf-x").onclick=()=>{tr.remove();refresh()};
    if(o.item)upd();return tr};
  function lines(){return [...body.querySelectorAll("tr")].map(tr=>({item:tr.querySelector(".kf-i").dataset.code,qty:tr.querySelector(".kf-q").value,ref_qty:tr.querySelector(".kf-rq")?tr.querySelector(".kf-rq").value:"",verdict:tr.querySelector(".kf-v")?tr.querySelector(".kf-v").value:"",price:tr.querySelector(".kf-pr")?tr.querySelector(".kf-pr").value:"",std_qty:tr.dataset.std!=null?+tr.dataset.std:undefined,tr})).filter(l=>l.item||l.qty!=="")}
  function refresh(){const w=[];
    if(isKS){const need=new Map();lines().forEach(l=>{const q=+l.qty;if(!l.item||!(q>0))return;(KHO.bom.get(l.item)||[]).forEach(b=>need.set(b.item,(need.get(b.item)||0)+b.qty*q));if(!(KHO.bom.get(l.item)||[]).length)w.push(`${l.item} chưa có định mức, chưa tự trừ vỏ / tem / BTP.`)});
      $("#kf-prev").innerHTML=need.size?`<div class="card flush"><div class="card-h pad"><h3>Hệ thống sẽ tự trừ</h3></div>${tbl(["Vật tư","Cần","Tồn","Sau phiếu"],[...need].map(([c,q])=>{const it=KHO.items.get(c)||{},after=khoStock(c)-q;if(after<0)w.push(`${c} sẽ âm kho (còn ${knum(khoStock(c))}, cần ${knum(q)}).`);return `<tr><td>${esc(c)} <small>${esc(it.name||"")}</small></td><td class="n">${knum(q)} ${esc(it.unit||"")}</td><td class="n">${knum(khoStock(c))}</td><td class="n ${after<0?"t-red":""}">${knum(after)}</td></tr>`}))}</div>`:""}
    else if(!isPC&&!isPN&&!isTL){lines().forEach(l=>{const q=+l.qty;if(l.item&&q>khoStock(l.item))w.push(`${l.item}: xuất ${knum(q)} nhưng tồn chỉ ${knum(khoStock(l.item))}.`)})}
    else if(isPC){lines().forEach(l=>{const q=+l.qty,s=l.std_qty;if(l.item&&q>khoStock(l.item))w.push(`${l.item}: dùng ${knum(q)} nhưng tồn chỉ ${knum(khoStock(l.item))}.`);if(s>0&&q>=0&&Math.abs(q-s)*100/s>5)l.tr.classList.add("lech");else l.tr.classList.remove("lech")})}
    $("#kf-warn").innerHTML=w.length?`<div class="note amb">${w.map(esc).join("<br>")}<br><small>Vẫn ghi được; kiểm tra lại số trước khi bấm Ghi phiếu.</small></div>`:""}
  if(isPC){
    const fill=()=>{const c=$("#kf-btp").dataset.code,lit=+$("#kf-lit").value;if(!c||!(lit>0))return;const B=KHO.bom.get(c)||[];body.innerHTML="";
      B.forEach(b=>{const std=kq(b.qty*lit),tr=addLine({item:b.item,qty:std,std,fixed:true});tr.dataset.std=std});
      if(!B.length)$("#kf-warn").innerHTML=`<div class="note amb">${esc(c)} chưa có định mức. Thêm nguyên liệu bằng nút "+ Thêm dòng".</div>`;else refresh()};
    khoPick($("#kf-btp"),["BTP"],fill);$("#kf-lit").oninput=fill;
    $("#kf-add").onclick=()=>{const tr=addLine({});tr.dataset.std=0}}
  else{$("#kf-add").onclick=()=>addLine({});if(isOut)$("#kf-box").onclick=()=>addLine({cls:["NVL","HH","CCDC"]});addLine({})}
  if($("#kf-psx"))$("#kf-psx").onchange=()=>{if($("#kf-psx").value)khoFillFromPsx(type,$("#kf-psx").value,addLine)};
  if(pre)pre(addLine);
  $("#kf-print").onclick=()=>{
    const L=lines().filter(l=>l.item),dt=$("#kf-d").value,tp=isOut?$("#kf-k").value:type;
    const mv=L.map(l=>{const it=KHO.items.get(l.item)||{name:"",unit:""};return {item:l.item,name:it.name,unit:it.unit,qty:0,std_qty:l.std_qty!=null?l.std_qty:null,price:null,role:isPC?"USE":"IN",note:""}});
    if(isPC&&$("#kf-btp").dataset.code){const bt=KHO.items.get($("#kf-btp").dataset.code)||{};mv.unshift({item:bt.code,name:bt.name,unit:bt.unit,qty:0,std_qty:null,price:null,role:"PRODUCT",note:""})}
    khoPrintDoc({doc:{no:"(chưa ghi sổ)",type:tp,doc_date:dt,partner:$("#kf-p")?$("#kf-p").value:"",ref_no:$("#kf-r")?$("#kf-r").value:"",ref_qty:isPC&&$("#kf-rq")&&$("#kf-rq").value!==""?+$("#kf-rq").value:null,note:"",status:"OK"},moves:mv},Object.assign({},KHO_TYPES[tp]||T),false,{},true)};
  $("#kf").onsubmit=async e=>{e.preventDefault();const ok=$("#kf-ok");ok.disabled=true;$("#kf-msg").textContent="Đang ghi…";
    try{const L=lines().filter(l=>l.item);const body={type:isOut?$("#kf-k").value:type,date:$("#kf-d").value,partner:$("#kf-p")?$("#kf-p").value:"",ref_no:$("#kf-r")?$("#kf-r").value:"",note:$("#kf-n").value,
      lines:L.map(l=>({item:l.item,qty:l.qty===""?undefined:+l.qty,ref_qty:l.ref_qty===""?undefined:+l.ref_qty,verdict:l.verdict||undefined,price:l.price===""?undefined:+l.price,std_qty:l.std_qty}))};
      if(isPC){body.btp=$("#kf-btp").dataset.code;body.liters=+$("#kf-lit").value;body.ref_qty=$("#kf-rq").value===""?undefined:+$("#kf-rq").value}
      if(L.some(l=>l.qty===""))throw new Error("Còn dòng chưa ghi số lượng");
      const r=await kApi("/docs",{method:"POST",body:JSON.stringify(body)});closeDrawer();KHO.at=0;KHO.list={};KHO.nxt=null;KHO.cl=null;KHO.mp=null;await khoLoad(true);renderMain();toast("Đã ghi phiếu "+r.no);khoOpenDoc(r.id,r.warnings)}
    catch(err){$("#kf-msg").textContent="";$("#kf-warn").innerHTML=`<div class="note red">${esc(err.message)}</div>`;ok.disabled=false}};
}

/* ---------- Xem / in / hủy một phiếu ---------- */
async function khoOpenDoc(id,warnings){
  let r;try{r=await kApi("/docs/"+id)}catch(e){toast(e.message);return}
  const d=r.doc,price=KHO.cat&&KHO.cat.can_price,T=KHO_TYPES[d.type],cancelled=d.status==="HUY",ex=(()=>{try{return JSON.parse(d.extra||"{}")}catch(e){return {}}})();
  const rows=r.moves.map(m=>`<tr><td>${esc(m.item)}</td><td>${esc(m.name)}</td><td>${esc(m.unit)}</td><td class="n">${knum(m.qty)}</td>${d.type==="PC"?`<td class="n">${m.role==="USE"?knum(m.std_qty):"—"}</td>`:""}${price&&d.type==="PN"?`<td class="n">${m.price!=null?nf(m.price):"—"}</td>`:""}<td>${esc({IN:"Nhập",USE:"Dùng",OUT:"Xuất",PRODUCT:d.type==="PC"?"Thu được":"Thành phẩm",AUTO:"Tự trừ theo định mức",RETURN:"Bán tiếp",DROP:"Bỏ"}[m.role]||m.role)}${m.note?` · ${esc(m.note)}`:""}</td></tr>`).join("");
  const head=["Mã","Tên","ĐVT","Số lượng"].concat(d.type==="PC"?["Định mức"]:[]).concat(price&&d.type==="PN"?["Đơn giá"]:[]).concat(["Ghi chú"]);
  openDrawerHTML(`<h2>${esc(d.no)} ${cancelled?pill("Đã hủy","gry"):pill("Hiệu lực","grn")}</h2><p>${esc(T.name)} · ngày ${kDd(d.doc_date)} · lập bởi ${esc(d.created_by_name||"—")}${d.partner?` · ${esc(d.partner)}`:""}${d.ref_no?` · tham chiếu ${esc(d.ref_no)}`:""}${d.ref_qty!=null?` · theo phiếu ${knum(d.ref_qty)}`:""}</p>
   ${d.note?`<p class="hint">${esc(d.note)}</p>`:""}${cancelled?`<div class="note red">Đã hủy bởi ${esc(d.cancelled_by_name||"—")} lúc ${esc(String(d.cancelled_at||"").slice(0,16).replace("T"," "))}. Lý do: ${esc(d.cancel_reason||"")}</div>`:""}
   ${warnings&&warnings.length?`<div class="note amb"><b>Cảnh báo khi ghi:</b><br>${warnings.map(esc).join("<br>")}</div>`:""}
   <div id="kdoc">${tbl(head,[rows])}</div>
   <div class="row7"><button class="btn" id="kd-print">In phiếu</button><button class="btn" id="kd-blank">In bản điền tay</button>${!cancelled&&(kCan(d.type)||ME.role==="admin")&&d.type!=="TD"?`<button class="btn" id="kd-cancel">Hủy phiếu</button>`:""}</div>`);
  $("#kd-print").onclick=()=>khoPrintDoc(r,T,price,ex);
  $("#kd-blank").onclick=()=>khoPrintDoc(r,T,price,ex,true);
  if($("#kd-cancel"))$("#kd-cancel").onclick=async()=>{const why=prompt("Lý do hủy phiếu "+d.no+" (bắt buộc). Phiếu hủy vẫn còn dấu vết, số kho được trả lại như chưa có phiếu:");if(!why||why.trim().length<3)return;
    try{await kApi("/docs/"+id+"/cancel",{method:"POST",body:JSON.stringify({reason:why})});toast("Đã hủy "+d.no);closeDrawer();KHO.at=0;KHO.list={};await khoLoad(true);renderMain()}catch(e){toast(e.message)}};
}


/* ---------- In phiếu: A4 dọc, logo Ailla, bảng kẻ có tô màu, 3 ô ký tên ---------- */
const KHO_ROLE={IN:"Nhập",USE:"Dùng",OUT:"Xuất",PRODUCT:"Thu được",AUTO:"Tự trừ theo định mức",RETURN:"Bán tiếp",DROP:"Bỏ (không cộng tồn)"};
/* blank=true: bản ĐIỀN TAY — giữ mã, tên, ĐVT, định mức; để trống ô số thực tế (nền vàng) và thêm vài dòng trống để ghi thêm. */
function khoPrintDoc(r,T,price,ex,blank){
  const d=r.doc,isPC=d.type==="PC",isPN=d.type==="PN"&&price&&!blank,cancelled=!blank&&d.status==="HUY";
  const meta=[["Số phiếu",d.no],["Ngày",kDd(d.doc_date)],d.partner?[d.type==="PN"?"Nhà cung cấp":d.type==="XB"||d.type==="XK"?"Khách hàng / nơi nhận":"Đối tác",d.partner]:null,d.ref_no?[d.type==="PC"||d.type==="KS"?"Phiếu sản xuất / lô":"Tham chiếu",d.ref_no]:null,
    d.ref_qty!=null?["Số lượng theo phiếu sản xuất",knum(d.ref_qty)]:null,isPC&&(blank||ex.liters)?["Số lít thực tế thu được",blank?"…………… lít":knum(ex.liters)]:null,ex.kind?["Loại xuất",ex.kind]:null,["Người lập",blank?"……………………":(d.created_by_name||"—")]].filter(Boolean);
  const cols=["STT","Mã hàng","Tên hàng","ĐVT"].concat(isPC?["Định mức","Thực tế dùng","Chênh lệch"]:["Số lượng"]).concat(isPN?["Đơn giá","Thành tiền"]:[]).concat(["Ghi chú"]);
  let tong=0;
  const body=r.moves.map((m,i)=>{const q=isPC?(m.role==="PRODUCT"?m.qty:-m.qty):Math.abs(m.qty);const qshow=d.type==="TL"&&m.role==="DROP"?knum(m.std_qty):knum(q);
    let cells=[i+1,m.item,m.name,m.unit];
    if(isPC){const std=m.role==="USE"?m.std_qty:null,lech=std!=null&&std>0?q-std:null,pc=lech!=null?lech*100/std:0;cells=cells.concat([std!=null?knum(std):"—",qshow,lech==null?"—":(lech>0?"+":"")+knum(lech)+(Math.abs(pc)>=0.05?" ("+(pc>0?"+":"")+pc.toFixed(1)+"%)":"")])}
    else cells.push(qshow);
    if(isPN){const th=(m.price||0)*q;tong+=th;cells=cells.concat([m.price!=null?nf(m.price):"—",m.price!=null?nf(th):"—"])}
    const nt=[KHO_ROLE[m.role]&&!["IN","OUT"].includes(m.role)?KHO_ROLE[m.role]:"",m.note].filter(Boolean).join(" · ");cells.push(nt);
    if(blank){if(isPC){if(m.role==="PRODUCT")cells=cells.slice(0,4).concat(["—","",""]);else cells[5]="",cells[6]="";cells[7]=""}else{cells[4]="";cells[cells.length-1]=""}}
    const fillIdx=blank?(isPC?[5,6,cells.length-1]:[4,cells.length-1]):[];const num=isPC?[4,5,6]:[4];const rowCls=m.role==="PRODUCT"?" class=\"pr\"":!blank&&isPC&&m.role==="USE"&&m.std_qty>0&&Math.abs(-m.qty-m.std_qty)*100/m.std_qty>5?" class=\"lech\"":"";
    return "<tr"+rowCls+">"+cells.map((c,j)=>"<td class=\""+(num.includes(j)&&j>=4?"n ":"")+(j===0?"c ":"")+(fillIdx.includes(j)?"fill":"")+"\">"+esc(String(c))+"</td>").join("")+"</tr>"}).join("");
  const sign=d.type==="PN"?["Người giao hàng","Thủ kho","Kế toán"]:isPC?["Quản lý sản xuất","Kỹ thuật pha chế","Thủ kho"]:d.type==="KS"?["Quản lý sản xuất","Kế toán kho","Thủ kho"]:["Người nhận hàng","Thủ kho","Kế toán"];
  const w=khoPrintWin();
  w.document.write("<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\"><title>"+esc(d.no)+"</title><style>"+
  "@page{size:A4 portrait;margin:12mm 12mm 14mm}*{box-sizing:border-box}body{font:12.5px/1.45 'Segoe UI',Arial,sans-serif;color:#1d2433;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}"+
  "@media screen{html{background:#dfe4f3}body{max-width:210mm;margin:12px auto;padding:12mm;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.18)}}@media print{body{max-width:none;padding:0;margin:0}}"+
  ".top{display:flex;align-items:center;gap:14px;border-bottom:3px solid #2b3a8c;padding-bottom:10px}.top img{height:54px}.co{flex:1}.co b{display:block;font-size:13px;color:#2b3a8c;letter-spacing:.2px}.co span{font-size:11px;color:#667085}"+
  ".no{text-align:right}.no b{display:block;font-size:15px;color:#e7357b}.no span{font-size:11px;color:#667085}"+
  "h1{margin:14px 0 4px;text-align:center;font-size:21px;letter-spacing:.8px;color:#2b3a8c;text-transform:uppercase}"+
  ".st{text-align:center;margin:0 0 10px}.st i{font-style:normal;display:inline-block;padding:2px 12px;border-radius:99px;font-size:11px;font-weight:700}.bl{background:#fff4c2;color:#7a5b00}.ok{background:#e3f7ec;color:#0a7a3d}.hu{background:#fde8e8;color:#b42318}"+
  ".meta{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #c9d1ea;border-radius:8px;overflow:hidden;margin-bottom:12px}.meta div{padding:6px 12px;border-bottom:1px solid #e4e8f5;display:flex;gap:8px}.meta div:nth-child(odd){background:#f5f7ff}.meta label{color:#667085;min-width:150px}.meta b{color:#1d2433}"+
  "table{width:100%;border-collapse:collapse}th{background:#2b3a8c;color:#fff;font-weight:600;padding:7px 8px;border:1px solid #2b3a8c;font-size:12px;text-align:left}td{padding:6px 8px;border:1px solid #c9d1ea;vertical-align:top}tbody tr:nth-child(even) td{background:#f5f7ff}td.n{text-align:right;font-variant-numeric:tabular-nums}td.c{text-align:center;width:34px}td.fill{background:#fffbe0!important;min-width:70px;height:26px}"+
  "tr.pr td{background:#fff0f6!important;font-weight:700}tr.lech td{background:#fff4e0!important}tfoot td{background:#eef1fb;font-weight:700}"+
  ".note{margin-top:10px;padding:8px 12px;border-left:4px solid #e7357b;background:#fff7fb;border-radius:4px}.can{margin-top:10px;padding:8px 12px;border-left:4px solid #b42318;background:#fff1f0;color:#b42318}"+
  ".sig{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px;text-align:center}.sig div{border-top:2px solid #2b3a8c;padding-top:6px}.sig b{display:block;color:#2b3a8c}.sig span{font-size:11px;color:#667085}"+
  ".foot{margin-top:18px;font-size:10.5px;color:#98a2b3;text-align:center}tr{page-break-inside:avoid}</style></head><body>"+
  "<div class=\"top\"><img src=\"data:image/png;base64,"+LOGO+"\" alt=\"Ailla\"><div class=\"co\"><b>CÔNG TY CỔ PHẦN THƯƠNG MẠI VÀ XNK AILLA VIỆT NAM</b><span>Phiếu kho – sản xuất nội bộ</span></div><div class=\"no\"><b>"+esc(d.no)+"</b><span>Ngày in: "+kDd(kToday())+"</span></div></div>"+
  "<h1>"+esc(T.name)+"</h1><p class=\"st\"><i class=\""+(blank?"bl\">BẢN ĐIỀN TAY · ô nền vàng ghi tay, sau đó nhập vào hệ thống":cancelled?"hu\">ĐÃ HỦY":"ok\">HIỆU LỰC")+"</i></p>"+
  "<div class=\"meta\">"+meta.map(([a,b])=>"<div><label>"+esc(a)+":</label><b>"+esc(String(b))+"</b></div>").join("")+"</div>"+
  "<table><thead><tr>"+cols.map(c=>"<th>"+c+"</th>").join("")+"</tr></thead><tbody>"+body+(blank?Array.from({length:5},(_,i)=>"<tr>"+cols.map((c,j)=>"<td class=\""+(j===0?"c ":"")+(j>=4?"fill":"")+"\">"+(j===0?r.moves.length+i+1:"")+"</td>").join("")+"</tr>").join(""):"")+"</tbody>"+(isPN?"<tfoot><tr><td colspan=\""+(cols.length-2)+"\" style=\"text-align:right\">Tổng cộng</td><td class=\"n\">"+nf(tong)+"</td><td></td></tr></tfoot>":"")+"</table>"+
  (d.note&&!blank?"<div class=\"note\"><b>Ghi chú:</b> "+esc(d.note)+"</div>":"")+
  (cancelled?"<div class=\"can\"><b>Phiếu đã hủy</b> bởi "+esc(d.cancelled_by_name||"—")+". Lý do: "+esc(d.cancel_reason||"")+"</div>":"")+
  "<div class=\"sig\">"+sign.map(x=>"<div><b>"+x+"</b><span>(ký, ghi rõ họ tên)</span></div>").join("")+"</div>"+
  "<div class=\"foot\">Phiếu in từ hệ thống quản trị Ailla · "+esc(d.no)+"</div></body></html>");
  w.document.close();w.focus();setTimeout(()=>w.print(),400);
}

/* ---------- Trang danh sách phiếu theo loại ---------- */
async function khoLoadList(type){
  const L=KHO.list[type]||(KHO.list[type]={rows:null,busy:false});if(L.busy)return;L.busy=true;
  try{L.rows=await kApi("/docs?type="+type+(type==="XB"?"":""))}catch(e){L.rows=[];toast(e.message)}finally{L.busy=false;if(PAGE===KHO_TYPES[type].page)renderMain()}
}
function pKhoDocs(m,type){
  const T=KHO_TYPES[type],L=KHO.list[type];if(!L||(!L.rows&&!L.busy))khoLoadList(type);
  let rows=L&&L.rows;if(type==="XB"&&L&&!L.x){L.x=true;kApi("/docs?type=XK").then(r=>{L.rows=(L.rows||[]).concat(r).sort((a,b)=>String(b.doc_date).localeCompare(a.doc_date)||b.id-a.id);if(PAGE===T.page)renderMain()}).catch(()=>{})}
  const can_=kCan(type);
  khoFrame(m,T.page,T.name,T.hint,`<section class="card flush"><div class="card-h pad"><h2>Phiếu gần đây</h2><span class="hint">bấm vào số phiếu để xem, in hoặc hủy</span></div>
   ${rows?khoRows(["Số phiếu","Ngày","Đối tác / tham chiếu","Số dòng","Người lập","Trạng thái"],rows.map(r=>`<tr class="clk" data-doc="${r.id}"><td><b>${esc(r.no)}</b></td><td>${kDd(r.doc_date)}</td><td>${esc([r.partner,r.ref_no].filter(Boolean).join(" · "))}</td><td class="n">${r.n_lines}</td><td>${esc(r.created_by_name||"—")}</td><td>${r.status==="OK"?pill("Hiệu lực","grn"):pill("Đã hủy","gry")}</td></tr>`)):`<p class="hint pad">Đang tải…</p>`}</section>`,
   can_?`<button class="btn pri" id="kho-new">+ Lập ${T.name.toLowerCase()}</button>`:`<span class="hint">Bạn chỉ xem được loại phiếu này</span>`);
  if($("#kho-new"))$("#kho-new").onclick=()=>khoForm(type);
  m.querySelectorAll("[data-doc]").forEach(r=>r.onclick=()=>khoOpenDoc(+r.dataset.doc));
}

/* ---------- Tồn kho ---------- */
function pKhoTon(m){
  const F=KHO.f,A=KHO.alerts||{low:[],negative:[]},ed=ME.role==="admin"||can(ME,"sx.kiemke");
  khoFrame(m,"kho_ton","Kho vật tư","Tồn kho nguyên vật liệu, bán thành phẩm, thành phẩm. Số tự tính từ các phiếu, không gõ đè.",(()=>{
    const q=kfold(F.q).trim(),all=[...KHO.items.values()].filter(i=>i.active),hasStock=all.filter(i=>khoStock(i.code)!==0);
    let L=all.filter(i=>(!F.cls||i.cls===F.cls)&&(!q||q.split(/\s+/).every(w=>kfold(i.code+" "+i.name).includes(w)))&&(!F.low||(khoStock(i.code)<0||(i.min_stock>0&&khoStock(i.code)<i.min_stock))));
    if(!q&&!F.cls&&!F.low)L=L.filter(i=>khoStock(i.code)!==0);
    const total=L.length;L=L.slice(0,300);
    return `<div class="grid kpis">${kpi("Mã đang có tồn",hasStock.length)}${kpi("Dưới mức tối thiểu",A.low.length)}${kpi("Tồn âm (cần kiểm tra)",A.negative.length)}${kpi("Tổng số mã",all.length)}</div>
    <section class="card flush"><div class="card-h pad"><div class="filters"><input id="kt-q" placeholder="Tìm theo mã hoặc tên" value="${esc(F.q)}"><select id="kt-c">${opt([["","Mọi loại hàng"],...Object.entries(KHO_CLS)],F.cls)}</select><label class="inl"><input type="checkbox" id="kt-l"${F.low?" checked":""}> Chỉ hàng cần chú ý</label></div>
    ${ME.role==="admin"?`<button class="btn" id="kt-td">Nhập tồn đầu kỳ</button>`:""}</div>
    ${khoRows(["Mã","Tên","ĐVT","Loại","Tồn kho","Tồn tối thiểu","Trạng thái"],L.map(i=>{const s=khoStock(i.code),low=i.min_stock>0&&s<i.min_stock;return `<tr><td class="mono">${esc(i.code)}</td><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td>${esc(KHO_CLS[i.cls]||i.cls)}</td><td class="n"><b>${knum(s)}</b></td><td class="n">${ed?`<input class="kt-min n" data-c="${esc(i.code)}" type="number" min="0" step="any" value="${i.min_stock||""}" placeholder="—">`:knum(i.min_stock)}</td><td>${s<0?pill("Âm kho","red"):low?pill("Dưới tối thiểu","amb"):s>0?pill("Còn hàng","grn"):""}</td></tr>`}))}
    ${total>300?`<p class="hint pad">Đang hiện 300 / ${total} mã. Gõ vào ô tìm để thu hẹp.</p>`:""}</section>`})());
  const re=()=>{KHO.f.q=$("#kt-q").value;KHO.f.cls=$("#kt-c").value;KHO.f.low=$("#kt-l").checked;const p=$("#kt-q").selectionStart;renderMain();const q=$("#kt-q");if(q){q.focus();q.setSelectionRange(p,p)}};
  if($("#kt-q")){$("#kt-q").oninput=re;$("#kt-c").onchange=re;$("#kt-l").onchange=re;
    m.querySelectorAll(".kt-min").forEach(x=>x.onchange=async()=>{try{await kApi("/items/"+encodeURIComponent(x.dataset.c),{method:"PUT",body:JSON.stringify({min_stock:+x.value||0})});KHO.items.get(x.dataset.c).min_stock=+x.value||0;toast("Đã lưu tồn tối thiểu");KHO.at=0;khoLoad(true)}catch(e){toast(e.message)}});
    if($("#kt-td"))$("#kt-td").onclick=()=>khoForm("TD")}
}

/* ---------- Nhập – xuất – tồn ---------- */
async function khoLoadNxt(){const P=KHO.period||(KHO.period=kMonth());KHO.nxt={busy:true,rows:null};try{KHO.nxt.rows=await kApi(`/nxt?from=${P.from}&to=${P.to}`)}catch(e){toast(e.message);KHO.nxt.rows=[]}KHO.nxt.busy=false;if(PAGE==="kho_nxt")renderMain()}
function pKhoNxt(m){
  const P=KHO.period||(KHO.period=kMonth());if(!KHO.nxt)khoLoadNxt();const R=(KHO.nxt&&KHO.nxt.rows)||null;
  const rows=R?R.filter(r=>r.opening||r.qty_in||r.qty_out||r.closing).map(r=>({...r,it:KHO.items.get(r.code)||{name:r.code,unit:"",cls:""}})).sort((a,b)=>a.code.localeCompare(b.code)):null;
  khoFrame(m,"kho_nxt","Nhập – xuất – tồn","Tồn đầu kỳ + nhập − xuất = tồn cuối kỳ, theo từng mã. Chọn kỳ rồi bấm Xem.",`<section class="card flush"><div class="card-h pad"><div class="filters"><label class="inl">Từ <input type="date" id="nx-f" value="${P.from}"></label><label class="inl">Đến <input type="date" id="nx-t" value="${P.to}"></label><button class="btn" id="nx-go">Xem</button></div><button class="btn" id="nx-x">Tải Excel</button></div>
   ${rows?khoRows(["Mã","Tên","ĐVT","Loại","Tồn đầu","Nhập","Xuất","Tồn cuối"],rows.map(r=>`<tr><td class="mono">${esc(r.code)}</td><td>${esc(r.it.name)}</td><td>${esc(r.it.unit)}</td><td>${esc(KHO_CLS[r.it.cls]||"")}</td><td class="n">${knum(r.opening)}</td><td class="n">${knum(r.qty_in)}</td><td class="n">${knum(r.qty_out)}</td><td class="n"><b>${knum(r.closing)}</b></td></tr>`)):`<p class="hint pad">Đang tải…</p>`}</section>`);
  if($("#nx-go"))$("#nx-go").onclick=()=>{KHO.period={from:$("#nx-f").value,to:$("#nx-t").value};khoLoadNxt();renderMain()};
  if($("#nx-x"))$("#nx-x").onclick=()=>{if(!rows||typeof XLSX==="undefined"){toast("Chưa có dữ liệu để tải");return}const ws=XLSX.utils.aoa_to_sheet([["Mã","Tên","ĐVT","Loại","Tồn đầu","Nhập","Xuất","Tồn cuối"],...rows.map(r=>[r.code,r.it.name,r.it.unit,KHO_CLS[r.it.cls]||"",r.opening,r.qty_in,r.qty_out,r.closing])]),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"NXT");XLSX.writeFile(wb,`NXT_${P.from}_${P.to}.xlsx`)};
}

/* ---------- Chênh lệch định mức & cảnh báo ---------- */
async function khoLoadCl(){const P=KHO.period||(KHO.period=kMonth());KHO.cl={busy:true};try{KHO.cl.v=await kApi(`/variance?from=${P.from}&to=${P.to}`)}catch(e){toast(e.message);KHO.cl.v={rows:[],tolerance_pct:5}}KHO.cl.busy=false;if(PAGE==="kho_cl")renderMain()}
function pKhoCl(m){
  const P=KHO.period||(KHO.period=kMonth());if(!KHO.cl)khoLoadCl();const V=KHO.cl&&KHO.cl.v,A=KHO.alerts||{low:[],negative:[],variance:[]};
  const nm=c=>(KHO.items.get(c)||{name:c}).name,un=c=>(KHO.items.get(c)||{unit:""}).unit;
  khoFrame(m,"kho_cl","Chênh lệch & cảnh báo","So số thực tế pha chế với định mức. Chênh lệch không mặc định là sai phạm, cần ghi lý do trong ghi chú phiếu.",`
  <section class="card"><div class="card-h"><h2>Cần chú ý hôm nay</h2></div>
   ${[...A.negative.map(r=>["red",`${r.code} · ${r.name}: <b>âm kho ${knum(r.qty)} ${esc(r.unit)}</b>. Kiểm tra phiếu nhập / pha chế còn thiếu.`]),...A.low.map(r=>["amb",`${r.code} · ${r.name}: còn <b>${knum(r.qty)}</b>, tối thiểu ${knum(r.min_stock)} ${esc(r.unit)}.`]),...A.variance.map(r=>["amb",`${r.no} (${kDd(r.doc_date)}): ${r.code} · ${r.name} dùng ${knum(r.actual_qty)}, định mức ${knum(r.std_qty)} (lệch quá ${V?V.tolerance_pct:5}%).`])].map(([c,t])=>`<div class="note ${c}">${t}</div>`).join("")||`<p class="hint">Không có cảnh báo nào.</p>`}</section>
  <section class="card flush"><div class="card-h pad"><h2>Chênh lệch theo nguyên vật liệu</h2><div class="filters"><label class="inl">Từ <input type="date" id="cl-f" value="${P.from}"></label><label class="inl">Đến <input type="date" id="cl-t" value="${P.to}"></label><button class="btn" id="cl-go">Xem</button></div></div>
   ${V?khoRows(["Mã","Tên","ĐVT","Số mẻ","Theo định mức","Thực tế","Chênh lệch","%"],V.rows.map(r=>{const d=r.actual_qty-r.std_qty,p=r.std_qty?d*100/r.std_qty:0;return `<tr><td class="mono">${esc(r.code)}</td><td>${esc(nm(r.code))}</td><td>${esc(un(r.code))}</td><td class="n">${r.batches}</td><td class="n">${knum(r.std_qty)}</td><td class="n">${knum(r.actual_qty)}</td><td class="n ${Math.abs(p)>V.tolerance_pct?"t-red":""}">${d>0?"+":""}${knum(d)}</td><td class="n">${r.std_qty?(p>0?"+":"")+p.toFixed(1)+"%":"—"}</td></tr>`})):`<p class="hint pad">Đang tải…</p>`}</section>`);
  if($("#cl-go"))$("#cl-go").onclick=()=>{KHO.period={from:$("#cl-f").value,to:$("#cl-t").value};KHO.nxt=null;khoLoadCl();renderMain()};
}

/* ---------- Danh mục & định mức ---------- */
function pKhoDm(m){
  const S=KHO.dm||(KHO.dm={q:"",sel:""});
  khoFrame(m,"kho_dm","Danh mục & định mức","Mã vật tư lấy từ MISA. Định mức: 1 dòng = 1 vật tư dùng cho 1 đơn vị sản phẩm (1 lít BTP, 1 can / chai thành phẩm).",(()=>{
    const q=kfold(S.q).trim(),L=q?[...KHO.items.values()].filter(i=>q.split(/\s+/).every(w=>kfold(i.code+" "+i.name).includes(w))).slice(0,60):[],sel=KHO.items.get(S.sel),B=sel?(KHO.bom.get(sel.code)||[]):[];
    return `<section class="card flush"><div class="card-h pad"><div class="filters"><input id="dm-q" placeholder="Gõ mã hoặc tên sản phẩm / BTP để xem định mức" value="${esc(S.q)}" style="min-width:320px"></div>${ME.role==="admin"||can(ME,"sx.kiemke")?`<button class="btn" id="dm-new">+ Thêm mã mới</button>`:""}</div>
     ${L.length?khoRows(["Mã","Tên","ĐVT","Loại","Số dòng định mức"],L.map(i=>`<tr class="clk" data-it="${esc(i.code)}"><td class="mono">${esc(i.code)}</td><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td>${esc(KHO_CLS[i.cls]||i.cls)}</td><td class="n">${(KHO.bom.get(i.code)||[]).length||""}</td></tr>`)):`<p class="hint pad">${q?"Không có mã nào khớp.":"Gõ vào ô tìm để xem danh mục (có "+KHO.items.size+" mã)."}</p>`}</section>
     ${sel?`<section class="card"><div class="card-h"><h2>${esc(sel.code)} · ${esc(sel.name)}</h2>${ME.role==="admin"?`<button class="btn" id="dm-edit">Sửa định mức</button>`:""}</div>${B.length?tbl(["Vật tư dùng","Tên","ĐVT","Định mức","Loại","Ghi chú"],B.map(b=>{const it=KHO.items.get(b.item)||{};return `<tr><td class="mono">${esc(b.item)}</td><td>${esc(it.name||"")}</td><td>${esc(it.unit||"")}</td><td class="n">${knum(b.qty)}</td><td>${esc(b.kind)}</td><td>${esc(b.note)}</td></tr>`})):`<p class="hint">Mã này chưa có định mức.</p>`}</section>`:""}`})());
  if($("#dm-q"))$("#dm-q").oninput=()=>{S.q=$("#dm-q").value;const p=$("#dm-q").selectionStart;renderMain();const q=$("#dm-q");q.focus();q.setSelectionRange(p,p)};
  m.querySelectorAll("[data-it]").forEach(r=>r.onclick=()=>{S.sel=r.dataset.it;renderMain()});
  if($("#dm-new"))$("#dm-new").onclick=khoNewItem;if($("#dm-edit"))$("#dm-edit").onclick=()=>khoEditBom(S.sel);
}
function khoNewItem(){
  openDrawerHTML(`<h2>Thêm mã vật tư</h2><p class="hint">Dùng khi MISA có mã mới. Mã phải đúng như trong MISA.</p><form class="frm" id="ni"><label class="field">Mã<input id="ni-c" required></label><label class="field">Tên<input id="ni-n" required></label><label class="field">ĐVT<input id="ni-u" placeholder="Cái, Lít, Kg…"></label><label class="field">Loại hàng<select id="ni-k">${opt(Object.entries(KHO_CLS),"NVL")}</select></label><label class="field">Tồn tối thiểu<input id="ni-m" type="number" min="0" step="any"></label><button class="btn pri">Thêm mã</button><div id="ni-e"></div></form>`);
  $("#ni").onsubmit=async e=>{e.preventDefault();try{await kApi("/items",{method:"POST",body:JSON.stringify({code:$("#ni-c").value,name:$("#ni-n").value,unit:$("#ni-u").value,cls:$("#ni-k").value,min_stock:+$("#ni-m").value||0})});closeDrawer();toast("Đã thêm mã");await khoLoad(true)}catch(err){$("#ni-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}}}
function khoEditBom(code){
  const B=(KHO.bom.get(code)||[]).map(b=>({...b}));
  const draw=()=>{$("#be-b").innerHTML=B.map((b,i)=>`<tr><td><input class="be-i" data-i="${i}" value="${esc(b.item)}" data-code="${esc(b.item)}"></td><td><input class="be-q n" data-i="${i}" type="number" step="any" min="0" value="${b.qty}"></td><td><input class="be-k" data-i="${i}" value="${esc(b.kind||"")}"></td><td><input class="be-n" data-i="${i}" value="${esc(b.note||"")}"></td><td><button type="button" class="lnk" data-rm="${i}">✕</button></td></tr>`).join("");
    document.querySelectorAll(".be-i").forEach(x=>khoPick(x,null,it=>{B[+x.dataset.i].item=it.code}));document.querySelectorAll(".be-q").forEach(x=>x.oninput=()=>B[+x.dataset.i].qty=+x.value);document.querySelectorAll(".be-k").forEach(x=>x.oninput=()=>B[+x.dataset.i].kind=x.value);document.querySelectorAll(".be-n").forEach(x=>x.oninput=()=>B[+x.dataset.i].note=x.value);document.querySelectorAll("[data-rm]").forEach(x=>x.onclick=()=>{B.splice(+x.dataset.rm,1);draw()})};
  openDrawerHTML(`<h2>Sửa định mức · ${esc(code)}</h2><p class="hint">Chỉ áp cho phiếu lập SAU này; phiếu đã ghi giữ nguyên số đã trừ.</p><form class="frm" id="be"><div class="tbl edit"><table><thead><tr><th>Vật tư</th><th>Định mức</th><th>Loại</th><th>Ghi chú</th><th></th></tr></thead><tbody id="be-b"></tbody></table></div><div class="row7"><button type="button" class="btn" id="be-add">+ Thêm dòng</button><button class="btn pri">Lưu định mức</button></div><div id="be-e"></div></form>`);
  draw();$("#be-add").onclick=()=>{B.push({item:"",qty:1,kind:"",note:""});draw()};
  $("#be").onsubmit=async e=>{e.preventDefault();try{await kApi("/bom/"+encodeURIComponent(code),{method:"PUT",body:JSON.stringify({lines:B.filter(b=>b.item)})});closeDrawer();toast("Đã lưu định mức");await khoLoad(true);renderMain()}catch(err){$("#be-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}}}

Object.assign(PAGES,{kho_ton:pKhoTon,kho_nhap:m=>pKhoDocs(m,"PN"),kho_pc:m=>pKhoDocs(m,"PC"),kho_ks:m=>pKhoDocs(m,"KS"),kho_xuat:m=>pKhoDocs(m,"XB"),kho_hoan:m=>pKhoDocs(m,"TL"),kho_nxt:pKhoNxt,kho_cl:pKhoCl,kho_dm:pKhoDm});
