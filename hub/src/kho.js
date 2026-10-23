/* =====================================================================
   KHO VẬT TƯ (khối Sản xuất & kho) — thay file Google Sheet AILLA_Kho_SanXuat_NXT.
   Luồng: nhập NVL → pha chế BTP → kiểm kê đóng gói (tự trừ BTP, vỏ, tem theo định mức) → xuất kho → hàng hoàn.
   Dữ liệu nằm ở các bảng kho_* trong D1 (không nằm trong hub_state); mỗi phiếu ghi sổ theo từng dòng, sai thì HỦY rồi lập lại.
   Telegram: làm sau, đã có /api/hub/kho/alerts để bot đọc.
   ===================================================================== */
const KHO_SUB=[["kho_ton","Tồn kho"],["kho_nhap","Nhập nguyên vật liệu"],["kho_nhap_tp","Nhập thành phẩm"],["kho_pc","Pha chế"],["sx_lo","Kiểm kê đóng gói"],["kho_xuat_b2b","Xuất B2B"],["kho_online","Xuất B2C"],["kho_xuat","Xuất khác"],["kho_hoan","Hàng hoàn"],["kho_nxt","Nhập – xuất – tồn"],["kho_cl","Chênh lệch & cảnh báo"],["kho_dm","Danh mục & định mức"],["kho_boc","Định mức & giá thành"],["kho_vo","Vỏ can, chai & thùng"],["kho_map","Đồng bộ mã B2B"]];
const KHO_GRP=[["Tồn kho",["kho_ton"]],["Nhập kho",["kho_nhap","kho_nhap_tp","kho_hoan"]],["Xuất kho",["kho_xuat_b2b","kho_online","kho_xuat"]],["Đối chiếu",["kho_nxt","kho_cl"]],["Danh mục",["kho_dm","kho_boc","kho_vo","kho_map"]]];
const khoNav=key=>{if(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin")return "";const GV=KHO_GRP.map(([t,ids])=>[t,ids.filter(i=>!(typeof OPSV==="function"&&OPSV()&&typeof OPS_HIDE!=="undefined"&&OPS_HIDE.includes(i)))]).filter(g=>g[1].length);const g=GV.find(x=>x[1].includes(key))||GV[0],nm=id=>(KHO_SUB.find(s=>s[0]===id)||[])[1]||id;return `<nav class="kgtabs">${GV.map(([t,ids])=>`<button class="${ids.includes(key)?"on":""}" data-sxt="${ids[0]}">${t}${ids.length>1?`<i>${ids.length}</i>`:""}</button>`).join("")}</nav>${g[1].length>1?`<nav class="kgsub">${g[1].map(id=>`<button class="${id===key?"on":""}" data-sxt="${id}">${nm(id)}</button>`).join("")}</nav>`:""}`};
const KHO_TYPES={
  PN:{page:"kho_nhap",name:"Phiếu nhập kho",who:["sx.kiemke"],hint:"Hàng mua về: nguyên vật liệu, vỏ, tem, hàng hóa. Kế toán kho ghi theo số thực nhận."},
  PC:{page:"kho_pc",name:"Phiếu pha chế",who:["sx.kythuat","sx.kiemke"],hint:"Mỗi mẻ pha một phiếu, pha theo phiếu sản xuất của Thảo. Ghi số lít thực tế và số thực tế từng nguyên liệu (nguyên liệu không dùng ghi 0)."},
  KS:{page:"sx_lo",name:"Phiếu kiểm kê đóng gói",who:["sx.kiemke"],hint:"Chúc kiểm kê sau khi đóng gói xong. Hệ thống tự trừ bán thành phẩm, vỏ, tem theo định mức."},
  XB:{page:"kho_xuat",name:"Phiếu xuất kho",who:["sx.kiemke"],hint:"Xuất ngoài bán hàng: gia công, bán nguyên liệu, hàng mẫu, hủy hỏng. Đơn B2B ở tab Xuất B2B, bán lẻ TikTok, Shopee, Facebook ở tab Xuất B2C."},
  TL:{page:"kho_hoan",name:"Phiếu nhập hàng hoàn",who:["sx.kiemke"],hint:"Hàng hoàn về kho: chọn Bán tiếp (cộng tồn) hoặc Bỏ (chỉ ghi nhận)."},
  TD:{page:"kho_ton",name:"Tồn đầu kỳ",who:[],hint:"Số kiểm kê tại ngày chốt. Chỉ CEO nhập."}};
const KHO_CLS={NVL:"Nguyên vật liệu",BTP:"Bán thành phẩm",TP:"Thành phẩm",HH:"Hàng hóa",CCDC:"Công cụ",COMBO:"Combo"};
const KHO_XK_KIND=["Gia công","Bán nguyên liệu","Hàng mẫu","Hủy hỏng","Khác"];
const KHO={cat:null,items:new Map(),bom:new Map(),stock:new Map(),alerts:null,at:0,busy:false,err:"",f:{q:"",cls:"",low:false},list:{},nxt:null,cl:null,period:null};
const kApi=(p,o)=>svApi("/api/hub/kho"+p,o);
const kfold=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/gi,"d").toLowerCase();
const kq=n=>Math.round((+n||0)*1000)/1000;
const knum=n=>(+n||0).toLocaleString("vi-VN",{maximumFractionDigits:6});
const kToday=()=>typeof sxToday==="function"?sxToday():new Date().toISOString().slice(0,10);
const kDd=s=>s?s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4):"—";
const kCan=t=>ME&&(ME.role==="admin"||KHO_TYPES[t].who.some(p=>can(ME,p)));
const kMonth=()=>{const t=kToday();return {from:t.slice(0,8)+"01",to:t}};
/* Kỳ xem số liệu kho: theo bộ chọn thời gian ở thanh trên cùng, không có ô chọn ngày riêng. */
const kPer=()=>typeof PERIOD!=="undefined"&&PERIOD&&PERIOD.from&&PERIOD.to?{from:PERIOD.from,to:PERIOD.to}:kMonth();
const kPerLabel=P=>kDd(P.from)+(P.from===P.to?"":" – "+kDd(P.to));

const khoHasBom=code=>KHO.bomHidden?KHO.bomHas.has(code):(KHO.bom.get(code)||[]).length>0;
/* Lượng vật tư cần cho [[sản phẩm, số lượng]...]. Người xem được định mức tính ngay trên máy; người khác hỏi máy chủ (có nhớ lại). */
async function khoExpand(pairs){
  if(!KHO.bomHidden)return pairs.map(([p,q])=>[p,q,(KHO.bom.get(p)||[]).map(b=>({item:b.item,need:b.qty*q,kind:b.kind}))]);
  const miss=pairs.filter(([p,q])=>!KHO.exp.has(p+"|"+q));
  if(miss.length){const r=await kApi("/bom/expand",{method:"POST",body:JSON.stringify({lines:miss.map(([product,qty])=>({product,qty}))})});r.forEach(x=>KHO.exp.set(x.product+"|"+x.qty,x.rows))}
  return pairs.map(([p,q])=>[p,q,KHO.exp.get(p+"|"+q)||[]]);
}
/* Bản đồng bộ cho ô xem trước: chưa có số thì trả null, tự hỏi máy chủ rồi gọi lại cb. */
function khoNeedRows(item,q,cb){
  if(!KHO.bomHidden)return (KHO.bom.get(item)||[]).map(b=>({item:b.item,need:b.qty*q}));
  const k=item+"|"+q,got=KHO.exp.get(k);if(got)return got;
  if(!khoHasBom(item))return [];
  KHO.pend=KHO.pend||new Set();if(!KHO.pend.has(k)){KHO.pend.add(k);khoExpand([[item,q]]).then(()=>{KHO.pend.delete(k);if(cb)cb()}).catch(()=>{KHO.pend.delete(k)})}
  return null;
}
async function khoLoad(force){
  if(KHO.busy||(!force&&KHO.cat&&Date.now()-KHO.at<20000))return;
  KHO.busy=true;
  try{
    const [cat,stock,alerts]=await Promise.all([KHO.cat&&!force?KHO.cat:kApi("/catalog"),kApi("/stock"),kApi("/alerts")]);
    KHO.cat=cat;KHO.items=new Map(cat.items.map(i=>[i.code,i]));
    KHO.bom=new Map();cat.bom.forEach(b=>{if(!KHO.bom.has(b.product))KHO.bom.set(b.product,[]);KHO.bom.get(b.product).push(b)});
    /* Người không được xem bảng định mức chỉ nhận: sản phẩm nào có định mức, BTP của từng sản phẩm; lượng cần dùng hỏi máy chủ theo từng mẻ. */
    KHO.bomHidden=!!cat.bom_hidden;KHO.bomHas=new Set(cat.bom_has||[]);KHO.btpOf=cat.btp_of||{};if(!KHO.exp)KHO.exp=new Map();
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
  m.innerHTML=`<div class="sxhead"><div><h1>${title}</h1><div class="ph-sub">${sub}</div></div></div><nav class="sxtabs">${top}</nav>
  ${khoNav(key).replace("</nav>",`<span class="kact">${actions}</span></nav>`)}
  ${KHO.err?`<div class="note"><b>Chưa tải được kho:</b> ${esc(KHO.err)} <button class="lnk" id="kho-retry">Thử lại</button></div>`:!KHO.cat?`<p class="hint">Đang tải kho…</p>`:body}`;
  m.querySelectorAll("[data-sxt]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.sxt;renderMain();scrollTo(0,0)});
  if($("#kho-retry"))$("#kho-retry").onclick=()=>khoLoad(true);
}
const khoRows=(head,rows,cls)=>rows.length?tbl(head,rows,cls):`<p class="hint pad">Chưa có dữ liệu.</p>`;

/* ---------- Chọn mã hàng: gõ vài chữ của mã hoặc tên, chọn trong danh sách ---------- */
function khoPick(inp,classes,onPick){
  let pop=$("#khopop");if(!pop){pop=document.createElement("div");pop.id="khopop";pop.className="khopop";pop.hidden=true;document.body.appendChild(pop)}
  const PER=30;let page=0,lastQ="";
  /* Hiện ĐỦ mọi mã khớp, chia trang 30 mã một trang (trước đây cắt ở 60 mã nên thiếu). */
  const show=(keep)=>{const q=kfold(inp.value).trim();if(!q){pop.hidden=true;return}
    if(q!==lastQ){page=0;lastQ=q}
    const L=[];for(const it of KHO.items.values()){if(classes&&!(classes.includes(it.cls)||(classes.includes("TP_MUA")&&it.cls==="TP"&&!khoHasBom(it.code)))||!it.active)continue;const hay=kfold(it.code+" "+it.name);if(q.split(/\s+/).every(w=>hay.includes(w)))L.push(it)}
    const pages=Math.max(1,Math.ceil(L.length/PER));if(page>=pages)page=pages-1;
    const r=inp.getBoundingClientRect();pop.style.left=r.left+"px";pop.style.top=r.bottom+window.scrollY+"px";pop.style.minWidth=Math.max(r.width,320)+"px";
    const rows=L.slice(page*PER,page*PER+PER);
    pop.innerHTML=(rows.length?rows.map(it=>`<button type="button" data-c="${esc(it.code)}"><b>${esc(it.code)}</b> ${esc(it.name)} <small>${it.cls==="TP"?"thành phẩm · ":""}${esc(it.unit)} · tồn ${knum(khoStock(it.code))}</small></button>`).join(""):`<div class="hint pad">Không có mã nào khớp${classes?" trong loại hàng này":""}.</div>`)
      +(L.length>PER?`<div class="khopg"><button type="button" data-pg="-1" ${page===0?"disabled":""}>‹ Trước</button><span>${page*PER+1}–${Math.min(L.length,page*PER+PER)} / ${L.length} mã · trang ${page+1}/${pages}</span><button type="button" data-pg="1" ${page>=pages-1?"disabled":""}>Sau ›</button></div>`:L.length?`<div class="khopg"><span>${L.length} mã</span></div>`:"");
    pop.hidden=false;if(!keep)pop.scrollTop=0;
    pop.querySelectorAll("button[data-c]").forEach(b=>b.onmousedown=e=>{e.preventDefault();const it=KHO.items.get(b.dataset.c);inp.value=it.code;inp.dataset.code=it.code;pop.hidden=true;onPick(it)});
    pop.querySelectorAll("button[data-pg]").forEach(b=>b.onmousedown=e=>{e.preventDefault();if(b.disabled)return;page+=+b.dataset.pg;show(false)})};
  inp.addEventListener("input",()=>{inp.dataset.code="";show()});inp.addEventListener("focus",()=>show());inp.addEventListener("blur",()=>setTimeout(()=>pop.hidden=true,150));
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
async function khoFillFromPsx(type,id,addLine){
  const r=khoPsxList(type).find(x=>x.id===id);if(!r)return;
  $("#kf-r").value=r.id;
  const misa=typeof khoMisaOf==="function"?khoMisaOf(r.sp):"";
  if(!misa){toast("Sản phẩm này chưa nối mã MISA nên chưa tự điền được. Chọn mã tay hoặc nối mã ở bước kiểm kê lô.");return}
  if(type==="PC"){
    let btCode="",lit=null;
    if(!KHO.bomHidden){const bt=(KHO.bom.get(misa)||[]).find(b=>(KHO.items.get(b.item)||{}).cls==="BTP");if(bt){btCode=bt.item;if(r.sl)lit=Math.round(bt.qty*r.sl*1000)/1000}}
    else{btCode=KHO.btpOf[misa]||"";if(btCode&&r.sl){try{const [[,,rows]]=await khoExpand([[misa,+r.sl]]);const row=rows.find(x=>x.item===btCode);if(row)lit=Math.round(row.need*1000)/1000}catch(e){toast(e.message);return}}}
    if(!btCode){toast("Sản phẩm "+misa+" không có bán thành phẩm trong định mức");return}
    $("#kf-btp").value=btCode;$("#kf-btp").dataset.code=btCode;
    if(lit!=null){$("#kf-lit").value=lit;$("#kf-rq").value=lit}
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
function khoForm(type,pre,clsO){
  const T=KHO_TYPES[type],price=KHO.cat.can_price;
  const isPC=type==="PC",isKS=type==="KS",isOut=type==="XB",isTL=type==="TL",isPN=type==="PN"||type==="TD";
  const head=`<div class="row7"><label class="field">Ngày<input type="date" id="kf-d" value="${kToday()}" required></label>
   ${type==="PN"?`<label class="field grow">Thuộc phiếu mua<select id="kf-po"><option value="">Đang tải phiếu mua…</option></select></label><label class="field grow">Nhà cung cấp<input id="kf-p" placeholder="Tên nhà cung cấp"></label>`:""}
   ${isOut?`<label class="field">Loại<select id="kf-k"><option value="XB">Xuất bán: NPP, đại lý, gia công, bán nguyên liệu (XB)</option><option value="XK">Xuất khác: hàng mẫu, hủy hỏng (XK)</option></select></label><label class="field grow">Khách hàng / nơi nhận<input id="kf-p" required></label><label class="field">Mã đơn của sale<input id="kf-r"></label>`:""}
   ${isPC?`<label class="field grow">Bán thành phẩm<input id="kf-btp" placeholder="Gõ tên BTP rồi chọn" autocomplete="off" required></label><label class="field">Số lít thực tế<input id="kf-lit" type="number" step="any" min="0" required></label><label class="field grow">Phiếu sản xuất của Thảo<select id="kf-psx">${khoPsxOpts(type)}</select></label><label class="field">Hoặc tự nhập số phiếu<input id="kf-r" placeholder="PSX…"></label><label class="field">Số lít theo phiếu<input id="kf-rq" type="number" step="any" min="0"></label>`:""}
   ${isKS?`<label class="field grow">Phiếu sản xuất của Thảo<select id="kf-psx">${khoPsxOpts(type)}</select></label><label class="field">Hoặc tự nhập số phiếu<input id="kf-r" placeholder="PSX…"></label>`:""}</div>`;
  const colHead=isPC?["Nguyên vật liệu","ĐVT","Định mức","Thực tế dùng","Tồn kho",""]:isKS?["Thành phẩm đếm được","ĐVT","Số lượng","Theo phiếu SX","Tồn",""]:isTL?["Mã hàng","ĐVT","Số lượng","Xử lý",""]:isPN?["Mã hàng","ĐVT","Số lượng",...(price&&type==="PN"?["Đơn giá"]:[]),"Tồn",""]:["Mã hàng","ĐVT","Số lượng","Tồn",""];
  openDrawerHTML(`<h2>${T.name}</h2><p class="hint">${T.hint}</p><form class="frm" id="kf">${head}
   <div class="tbl edit"><table><thead><tr>${colHead.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody id="kf-b"></tbody></table></div>
   <div class="row7"><button type="button" class="btn" id="kf-add">+ Thêm dòng</button>${isOut?`<button type="button" class="btn" id="kf-box">+ Thêm vỏ thùng</button>`:""}<label class="field grow">Ghi chú<input id="kf-n"></label></div>
   ${isKS?`<div id="kf-prev"></div>`:""}<div id="kf-warn"></div>
   <div class="row7"><button class="btn pri" id="kf-ok">Ghi phiếu</button><button type="button" class="btn" id="kf-print">In bản điền tay</button><span class="hint" id="kf-msg"></span></div></form>`);
  const body=$("#kf-b"),cls=clsO||KHO_LINE_CLS[type];
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
    if(isKS){const need=new Map();lines().forEach(l=>{const q=+l.qty;if(!l.item||!(q>0))return;(khoNeedRows(l.item,q,refresh)||[]).forEach(b=>need.set(b.item,(need.get(b.item)||0)+b.need));if(!khoHasBom(l.item))w.push(`${l.item} chưa có định mức, chưa tự trừ vỏ / tem / BTP.`)});
      $("#kf-prev").innerHTML=need.size?`<div class="card flush"><div class="card-h pad"><h3>Hệ thống sẽ tự trừ</h3></div>${tbl(["Vật tư","Cần","Tồn","Sau phiếu"],[...need].map(([c,q])=>{const it=KHO.items.get(c)||{},after=khoStock(c)-q;if(after<0)w.push(`${c} sẽ âm kho (còn ${knum(khoStock(c))}, cần ${knum(q)}).`);return `<tr><td>${esc(c)} <small>${esc(it.name||"")}</small></td><td class="n">${knum(q)} ${esc(it.unit||"")}</td><td class="n">${knum(khoStock(c))}</td><td class="n ${after<0?"t-red":""}">${knum(after)}</td></tr>`}))}</div>`:""}
    else if(!isPC&&!isPN&&!isTL){lines().forEach(l=>{const q=+l.qty;if(l.item&&q>khoStock(l.item))w.push(`${l.item}: xuất ${knum(q)} nhưng tồn chỉ ${knum(khoStock(l.item))}.`)})}
    else if(isPC){lines().forEach(l=>{const q=+l.qty,s=l.std_qty;if(l.item&&q>khoStock(l.item))w.push(`${l.item}: dùng ${knum(q)} nhưng tồn chỉ ${knum(khoStock(l.item))}.`);if(s>0&&q>=0&&Math.abs(q-s)*100/s>5)l.tr.classList.add("lech");else l.tr.classList.remove("lech")})}
    $("#kf-warn").innerHTML=w.length?`<div class="note amb">${w.map(esc).join("<br>")}<br><small>Vẫn ghi được; kiểm tra lại số trước khi bấm Ghi phiếu.</small></div>`:""}
  if(isPC){
    let fillTok=0;
    const fill=async()=>{const c=$("#kf-btp").dataset.code,lit=+$("#kf-lit").value;if(!c||!(lit>0))return;const my=++fillTok;let B;
      if(KHO.bomHidden){try{const [[,,rows]]=await khoExpand([[c,lit]]);B=rows.map(x=>({item:x.item,need:x.need}))}catch(e){toast(e.message);return}if(my!==fillTok)return}
      else B=KHO.bom.get(c)||[];
      body.innerHTML="";
      B.forEach(b=>{const std=kq(b.need!=null?b.need:b.qty*lit),tr=addLine({item:b.item,qty:std,std,fixed:true});tr.dataset.std=std});
      if(!B.length)$("#kf-warn").innerHTML=`<div class="note amb">${esc(c)} chưa có định mức. Thêm nguyên liệu bằng nút "+ Thêm dòng".</div>`;else refresh()};
    khoPick($("#kf-btp"),["BTP"],fill);$("#kf-lit").oninput=fill;
    $("#kf-add").onclick=()=>{const tr=addLine({});tr.dataset.std=0}}
  else{$("#kf-add").onclick=()=>addLine({});if(isOut)$("#kf-box").onclick=()=>addLine({cls:["NVL","HH","CCDC"]});addLine({})}
  if($("#kf-psx"))$("#kf-psx").onchange=()=>{if($("#kf-psx").value)khoFillFromPsx(type,$("#kf-psx").value,addLine)};
  if(type==="PN"&&$("#kf-po")){
    /* Hàng về theo một phiếu mua (Thảo lập ở trang quản trị): chọn phiếu thì điền sẵn nhà cung cấp và số còn thiếu; lưu xong phiếu mua tự nhảy "đã nhập kho" */
    (async()=>{try{await mhLoad(true)}catch(e){}
      const sel=$("#kf-po");if(!sel)return;const O=(typeof MH!=="undefined"&&MH.orders||[]).filter(p=>p.status==="DAT"||p.status==="DANG_GIAO");
      sel.innerHTML='<option value="">Không có phiếu đặt: web tự tạo phiếu mua theo nhà cung cấp, Thảo nhập giá sau</option>'+O.map(p=>`<option value="${esc(p.id)}">${esc(p.no)} · ${esc(p.supplier_name)} · ${esc(p.lines.slice(0,2).map(l=>l.name||l.item).join(", "))}</option>`).join("")})();
    $("#kf-po").onchange=()=>{const p=(MH.orders||[]).find(x=>x.id===$("#kf-po").value);if(!p)return;
      $("#kf-p").value=p.supplier_name;body.innerHTML="";const rest=p.lines.filter(l=>l.qty-l.received>1e-9);
      (rest.length?rest:p.lines).forEach(l=>addLine({item:l.item,qty:rest.length?Math.round((l.qty-l.received)*1e6)/1e6:l.qty}));refresh()}}
  if(pre)pre(addLine);
  $("#kf-print").onclick=()=>{
    const L=lines().filter(l=>l.item),dt=$("#kf-d").value,tp=isOut?$("#kf-k").value:type;
    const mv=L.map(l=>{const it=KHO.items.get(l.item)||{name:"",unit:""};return {item:l.item,name:it.name,unit:it.unit,qty:0,std_qty:l.std_qty!=null?l.std_qty:null,price:null,role:isPC?"USE":"IN",note:""}});
    if(isPC&&$("#kf-btp").dataset.code){const bt=KHO.items.get($("#kf-btp").dataset.code)||{};mv.unshift({item:bt.code,name:bt.name,unit:bt.unit,qty:0,std_qty:null,price:null,role:"PRODUCT",note:""})}
    khoPrintDoc({doc:{no:"(chưa ghi sổ)",type:tp,doc_date:dt,partner:$("#kf-p")?$("#kf-p").value:"",ref_no:$("#kf-r")?$("#kf-r").value:"",ref_qty:isPC&&$("#kf-rq")&&$("#kf-rq").value!==""?+$("#kf-rq").value:null,note:"",status:"OK"},moves:mv},Object.assign({},KHO_TYPES[tp]||T),false,{},true)};
  $("#kf").onsubmit=async e=>{e.preventDefault();const ok=$("#kf-ok");ok.disabled=true;$("#kf-msg").textContent="Đang ghi…";
    try{const L=lines().filter(l=>l.item);const body={type:isOut?$("#kf-k").value:type,date:$("#kf-d").value,partner:$("#kf-p")?$("#kf-p").value:"",ref_no:$("#kf-r")?$("#kf-r").value:"",note:$("#kf-n").value,
      lines:L.map(l=>({item:l.item,qty:l.qty===""?undefined:+l.qty,ref_qty:l.ref_qty===""?undefined:+l.ref_qty,verdict:l.verdict||undefined,price:l.price===""?undefined:+l.price,std_qty:l.std_qty}))};
      if($("#kf-po")&&$("#kf-po").value)body.po_id=$("#kf-po").value;
      if(isPC){body.btp=$("#kf-btp").dataset.code;body.liters=+$("#kf-lit").value;body.ref_qty=$("#kf-rq").value===""?undefined:+$("#kf-rq").value}
      if(L.some(l=>l.qty===""))throw new Error("Còn dòng chưa ghi số lượng");
      const r=await kApi("/docs",{method:"POST",body:JSON.stringify(body)});closeDrawer();KHO.at=0;KHO.list={};KHO.nxt=null;KHO.cl=null;KHO.mp=null;await khoLoad(true);renderMain();toast("Đã ghi phiếu "+r.no);khoOpenDoc(r.id,r.warnings)}
    catch(err){$("#kf-msg").textContent="";$("#kf-warn").innerHTML=`<div class="note red">${esc(err.message)}</div>`;ok.disabled=false}};
}

/* ---------- Xem / in / hủy một phiếu ---------- */
/* Kiểm kê và pha chế mỗi lần ghi ra HAI phiếu riêng: phiếu nhập (thành phẩm / bán thành phẩm) và phiếu xuất vật tư.
   Số phiếu lấy theo số phiếu gốc (KS2610-001 → NT2610-001 và XT2610-001; PC2610-001 → NB2610-001 và XN2610-001). */
const KHO_SPLIT={KS:{inP:"NT",outP:"XT",inName:"Phiếu nhập thành phẩm",outName:"Phiếu xuất vật tư đóng gói",inRole:"PRODUCT",outRole:"AUTO"},
  PC:{inP:"NB",outP:"XN",inName:"Phiếu nhập bán thành phẩm",outName:"Phiếu xuất nguyên vật liệu pha chế",inRole:"PRODUCT",outRole:"USE"}};
const khoSubNos=d=>{const sp=KHO_SPLIT[d.type];return sp?[sp.inP+String(d.no).slice(2),sp.outP+String(d.no).slice(2)]:null};
async function khoOpenDoc(id,warnings){
  let r;try{r=await kApi("/docs/"+id)}catch(e){toast(e.message);return}
  const d=r.doc,price=KHO.cat&&KHO.cat.can_price,T=KHO_TYPES[d.type],cancelled=d.status==="HUY",ex=(()=>{try{return JSON.parse(d.extra||"{}")}catch(e){return {}}})();
  const rows=r.moves.map(m=>`<tr><td>${esc(m.item)}</td><td>${esc(m.name)}</td><td>${esc(m.unit)}</td><td class="n">${knum(m.qty)}</td>${d.type==="PC"?`<td class="n">${m.role==="USE"?knum(m.std_qty):"—"}</td>`:""}${price&&d.type==="PN"?`<td class="n">${m.price!=null?nf(m.price):"—"}</td>`:""}<td>${esc({IN:"Nhập",USE:"Dùng",OUT:"Xuất",PRODUCT:d.type==="PC"?"Thu được":"Thành phẩm",AUTO:"Tự trừ theo định mức",RETURN:"Bán tiếp",DROP:"Bỏ"}[m.role]||m.role)}${m.note?` · ${esc(m.note)}`:""}</td></tr>`).join("");
  const head=["Mã","Tên","ĐVT","Số lượng"].concat(d.type==="PC"?["Định mức"]:[]).concat(price&&d.type==="PN"?["Đơn giá"]:[]).concat(["Ghi chú"]);
  openDrawerHTML(`<h2>${esc(d.no)} ${cancelled?pill("Đã hủy","gry"):pill("Hiệu lực","grn")}</h2><p>${esc(T.name)} · ngày ${kDd(d.doc_date)} · lập bởi ${esc(d.created_by_name||"—")}${d.partner?` · ${esc(d.partner)}`:""}${d.ref_no?` · tham chiếu ${esc(d.ref_no)}`:""}${d.ref_qty!=null?` · theo phiếu ${knum(d.ref_qty)}`:""}</p>
   ${d.note?`<p class="hint">${esc(d.note)}</p>`:""}${cancelled?`<div class="note red">Đã hủy bởi ${esc(d.cancelled_by_name||"—")} lúc ${esc(String(d.cancelled_at||"").slice(0,16).replace("T"," "))}. Lý do: ${esc(d.cancel_reason||"")}</div>`:""}
   ${warnings&&warnings.length?`<div class="note amb"><b>Cảnh báo khi ghi:</b><br>${warnings.map(esc).join("<br>")}</div>`:""}
   ${KHO_SPLIT[d.type]?(()=>{const sp=KHO_SPLIT[d.type],[nIn,nOut]=khoSubNos(d),mk=role=>r.moves.filter(m=>m.role===role).map(m=>`<tr><td>${esc(m.item)}</td><td>${esc(m.name)}</td><td>${esc(m.unit)}</td><td class="n">${knum(Math.abs(m.qty))}</td>${d.type==="PC"&&role==="USE"?`<td class="n">${m.std_qty!=null?knum(m.std_qty):"—"}</td>`:""}</tr>`).join("");
     return `<h3 style="margin:10px 0 4px">${esc(sp.inName)} <span class="mono">${nIn}</span></h3><div class="card flush">${tbl(["Mã","Tên","ĐVT","Số lượng"],[mk(sp.inRole)])}</div>
      <h3 style="margin:14px 0 4px">${esc(sp.outName)} <span class="mono">${nOut}</span></h3><div class="card flush">${tbl(["Mã","Tên","ĐVT","Số lượng"].concat(d.type==="PC"?["Định mức"]:[]),[mk(sp.outRole)])}</div>
      <p class="hint">Hai phiếu này sinh ra cùng lúc từ ${esc(T.name.toLowerCase())} ${esc(d.no)}. Hủy hoặc sửa ${esc(d.no)} thì cả hai cùng đổi.</p>`})():`<div id="kdoc">${tbl(head,[rows])}</div>`}
   <div class="row7">${KHO_SPLIT[d.type]?`<button class="btn" id="kd-pa">In ${khoSubNos(d)[0]}</button><button class="btn" id="kd-pb">In ${khoSubNos(d)[1]}</button>`:`<button class="btn" id="kd-print">In phiếu</button><button class="btn" id="kd-blank">In bản điền tay</button>`}${!cancelled&&(d.type==="TD"?ME.role==="admin":(kCan(d.type)||ME.role==="admin"))?`<button class="btn" id="kd-cancel">Hủy phiếu</button>`:""}</div>`);
  if(KHO_SPLIT[d.type]){const sp=KHO_SPLIT[d.type],nos=khoSubNos(d),sub=(role,no,typ,nm,neg)=>({doc:Object.assign({},d,{no,type:typ}),moves:r.moves.filter(m=>m.role===role).map(m=>Object.assign({},m,{qty:Math.abs(m.qty),role:neg?"OUT":"IN"}))});
    $("#kd-pa").onclick=()=>khoPrintDoc(sub(sp.inRole,nos[0],"PN",sp.inName,false),Object.assign({},KHO_TYPES.PN,{name:sp.inName}),price,ex);
    $("#kd-pb").onclick=()=>khoPrintDoc(sub(sp.outRole,nos[1],"XK",sp.outName,true),Object.assign({},KHO_TYPES.XB,{name:sp.outName}),price,ex)}
  else{$("#kd-print").onclick=()=>khoPrintDoc(r,T,price,ex);
  $("#kd-blank").onclick=()=>khoPrintDoc(r,T,price,ex,true)}
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
async function khoLoadList(type,key,cls,page){
  key=key||type;const L=KHO.list[key]||(KHO.list[key]={rows:null,busy:false});if(L.busy)return;L.busy=true;
  try{L.rows=await kApi("/docs?type="+type+(cls?"&cls="+cls:""))}catch(e){L.rows=[];toast(e.message)}finally{L.busy=false;if(PAGE===(page||KHO_TYPES[type].page))renderMain()}
}
/* v: biến thể của trang phiếu (Nhập NVL / Nhập thành phẩm dùng chung phiếu nhập, chỉ khác nhóm hàng). */
function pKhoDocs(m,type,v){
  const T=Object.assign({},KHO_TYPES[type],v?{page:v.page,name:v.name,hint:v.hint}:{}),key=v?v.key:type,L=KHO.list[key];if(!L||(!L.rows&&!L.busy))khoLoadList(type,key,v&&v.cls,T.page);
  let rows=L&&L.rows;if(type==="XB"&&L&&!L.x){L.x=true;kApi("/docs?type=XK").then(r=>{L.rows=(L.rows||[]).concat(r).sort((a,b)=>String(b.doc_date).localeCompare(a.doc_date)||b.id-a.id);if(PAGE===T.page)renderMain()}).catch(()=>{})}
  /* Lọc theo kỳ chọn ở thanh trên cùng (ngày phiếu); bấm "Xem tất cả" để bỏ lọc. */
  const P=kPer(),allRows=rows;let nAll=0;
  if(rows){nAll=rows.length;if(!KHO.docAll)rows=rows.filter(r=>String(r.doc_date)>=P.from&&String(r.doc_date)<=P.to)}
  const can_=kCan(type);
  khoFrame(m,T.page,T.name,T.hint,`<section class="card flush"><div class="card-h pad"><h2>${KHO.docAll?"Tất cả phiếu":"Phiếu trong kỳ "+kPerLabel(P)}</h2><span class="hint">${rows?rows.length+" / "+nAll+" phiếu · ":""}<button class="lnk" id="kho-all">${KHO.docAll?"Chỉ xem theo kỳ":"Xem tất cả"}</button> · bấm vào số phiếu để xem, in hoặc hủy</span></div>
   ${rows&&!rows.length&&nAll?`<p class="hint pad">Không có phiếu nào trong kỳ này. Bấm "Xem tất cả" để xem các phiếu ngoài kỳ.</p>`:rows?khoRows(["Số phiếu","Ngày","Đối tác / tham chiếu","Số dòng","Người lập","Trạng thái"].concat(KHO_SPLIT[type]?["Phiếu nhập","Phiếu xuất vật tư"]:[]),rows.map(r=>`<tr class="clk" data-doc="${r.id}"><td><b>${esc(r.no)}</b></td><td>${kDd(r.doc_date)}</td><td>${esc([r.partner,r.ref_no].filter(Boolean).join(" · "))}</td><td class="n">${r.n_lines}</td><td>${esc(r.created_by_name||"—")}</td><td>${r.status==="OK"?pill("Hiệu lực","grn"):pill("Đã hủy","gry")}</td>${KHO_SPLIT[type]?`<td class="mono">${khoSubNos({type,no:r.no})[0]}</td><td class="mono">${khoSubNos({type,no:r.no})[1]}</td>`:""}</tr>`)):`<p class="hint pad">Đang tải…</p>`}</section>`,
   can_?`<button class="btn pri" id="kho-new">+ Lập phiếu ${type==="PN"?"nhập":type==="XB"?"xuất":"mới"}</button>`:`<span class="hint">Bạn chỉ xem được loại phiếu này</span>`);
  if($("#kho-new"))$("#kho-new").onclick=()=>khoForm(type,null,v&&v.formCls);
  if($("#kho-all"))$("#kho-all").onclick=()=>{KHO.docAll=!KHO.docAll;renderMain()};
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
    ${ME.role==="admin"?`<span><button class="btn" id="kt-tdx">Nạp tồn đầu từ Excel</button> <button class="btn" id="kt-td">Nhập tồn đầu kỳ (gõ tay)</button></span>`:""}</div>
    ${khoRows(["Mã","Tên","ĐVT","Loại","Tồn kho","Tồn tối thiểu","Trạng thái"],L.map(i=>{const s=khoStock(i.code),low=i.min_stock>0&&s<i.min_stock;return `<tr><td class="mono">${esc(i.code)}</td><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td>${esc(KHO_CLS[i.cls]||i.cls)}</td><td class="n"><b>${knum(s)}</b></td><td class="n">${ed?`<input class="kt-min n" data-c="${esc(i.code)}" type="number" min="0" step="any" value="${i.min_stock||""}" placeholder="—">`:knum(i.min_stock)}</td><td>${s<0?pill("Âm kho","red"):low?pill("Dưới tối thiểu","amb"):s>0?pill("Còn hàng","grn"):""}</td></tr>`}))}
    ${total>300?`<p class="hint pad">Đang hiện 300 / ${total} mã. Gõ vào ô tìm để thu hẹp.</p>`:""}</section>`})());
  const re=()=>{KHO.f.q=$("#kt-q").value;KHO.f.cls=$("#kt-c").value;KHO.f.low=$("#kt-l").checked;const p=$("#kt-q").selectionStart;renderMain();const q=$("#kt-q");if(q){q.focus();q.setSelectionRange(p,p)}};
  if($("#kt-q")){$("#kt-q").oninput=re;$("#kt-c").onchange=re;$("#kt-l").onchange=re;
    m.querySelectorAll(".kt-min").forEach(x=>x.onchange=async()=>{try{await kApi("/items/"+encodeURIComponent(x.dataset.c),{method:"PUT",body:JSON.stringify({min_stock:+x.value||0})});KHO.items.get(x.dataset.c).min_stock=+x.value||0;toast("Đã lưu tồn tối thiểu");KHO.at=0;khoLoad(true)}catch(e){toast(e.message)}});
    if($("#kt-td"))$("#kt-td").onclick=()=>khoForm("TD");
    if($("#kt-tdx"))$("#kt-tdx").onclick=()=>khoTdImport()}
}

/* ---------- Nhập – xuất – tồn ---------- */
async function khoLoadNxt(){const P=kPer();KHO.nxtKey=P.from+"|"+P.to;KHO.nxt={busy:true,rows:null};try{KHO.nxt.rows=await kApi(`/nxt?from=${P.from}&to=${P.to}`)}catch(e){toast(e.message);KHO.nxt.rows=[]}KHO.nxt.busy=false;if(PAGE==="kho_nxt")renderMain()}
function pKhoNxt(m){
  const P=kPer();if(!KHO.nxt||KHO.nxtKey!==P.from+"|"+P.to)khoLoadNxt();const R=(KHO.nxt&&KHO.nxt.rows)||null;
  const rows=R?R.filter(r=>r.opening||r.qty_in||r.qty_out||r.closing).map(r=>({...r,it:KHO.items.get(r.code)||{name:r.code,unit:"",cls:""}})).sort((a,b)=>a.code.localeCompare(b.code)):null;
  khoFrame(m,"kho_nxt","Nhập – xuất – tồn","Tồn đầu kỳ + nhập − xuất = tồn cuối kỳ, theo từng mã. Kỳ lấy theo bộ chọn thời gian ở trên cùng.",`<section class="card flush"><div class="card-h pad"><div class="filters"><b>Kỳ: ${kPerLabel(P)}</b></div><button class="btn" id="nx-x">Tải Excel</button></div>
   ${rows?khoRows(["Mã","Tên","ĐVT","Loại","Tồn đầu","Nhập","Xuất","Tồn cuối"],rows.map(r=>`<tr><td class="mono">${esc(r.code)}</td><td>${esc(r.it.name)}</td><td>${esc(r.it.unit)}</td><td>${esc(KHO_CLS[r.it.cls]||"")}</td><td class="n">${knum(r.opening)}</td><td class="n">${knum(r.qty_in)}</td><td class="n">${knum(r.qty_out)}</td><td class="n"><b>${knum(r.closing)}</b></td></tr>`)):`<p class="hint pad">Đang tải…</p>`}</section>`);
  if($("#nx-x"))$("#nx-x").onclick=()=>{if(!rows||typeof XLSX==="undefined"){toast("Chưa có dữ liệu để tải");return}const ws=XLSX.utils.aoa_to_sheet([["Mã","Tên","ĐVT","Loại","Tồn đầu","Nhập","Xuất","Tồn cuối"],...rows.map(r=>[r.code,r.it.name,r.it.unit,KHO_CLS[r.it.cls]||"",r.opening,r.qty_in,r.qty_out,r.closing])]),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"NXT");XLSX.writeFile(wb,`NXT_${P.from}_${P.to}.xlsx`)};
}

/* ---------- Chênh lệch định mức & cảnh báo ---------- */
async function khoLoadCl(){const P=kPer();KHO.clKey=P.from+"|"+P.to;KHO.cl={busy:true};try{KHO.cl.v=await kApi(`/variance?from=${P.from}&to=${P.to}`)}catch(e){toast(e.message);KHO.cl.v={rows:[],tolerance_pct:5}}KHO.cl.busy=false;if(PAGE==="kho_cl")renderMain()}
function pKhoCl(m){
  const P=kPer();if(!KHO.cl||KHO.clKey!==P.from+"|"+P.to)khoLoadCl();const V=KHO.cl&&KHO.cl.v,A=KHO.alerts||{low:[],negative:[],variance:[]};
  const nm=c=>(KHO.items.get(c)||{name:c}).name,un=c=>(KHO.items.get(c)||{unit:""}).unit;
  khoFrame(m,"kho_cl","Chênh lệch & cảnh báo","So số thực tế pha chế với định mức. Chênh lệch không mặc định là sai phạm, cần ghi lý do trong ghi chú phiếu.",`
  <section class="card"><div class="card-h"><h2>Cần chú ý hôm nay</h2></div>
   ${[...A.negative.map(r=>["red",`${r.code} · ${r.name}: <b>âm kho ${knum(r.qty)} ${esc(r.unit)}</b>. Kiểm tra phiếu nhập / pha chế còn thiếu.`]),...A.low.map(r=>["amb",`${r.code} · ${r.name}: còn <b>${knum(r.qty)}</b>, tối thiểu ${knum(r.min_stock)} ${esc(r.unit)}.`]),...A.variance.map(r=>["amb",`${r.no} (${kDd(r.doc_date)}): ${r.code} · ${r.name} dùng ${knum(r.actual_qty)}, định mức ${knum(r.std_qty)} (lệch quá ${V?V.tolerance_pct:5}%).`])].map(([c,t])=>`<div class="note ${c}">${t}</div>`).join("")||`<p class="hint">Không có cảnh báo nào.</p>`}</section>
  <section class="card flush"><div class="card-h pad"><h2>Chênh lệch theo nguyên vật liệu</h2><div class="filters"><b>Kỳ: ${kPerLabel(P)}</b></div></div>
   ${V?khoRows(["Mã","Tên","ĐVT","Số mẻ","Theo định mức","Thực tế","Chênh lệch","%"],V.rows.map(r=>{const d=r.actual_qty-r.std_qty,p=r.std_qty?d*100/r.std_qty:0;return `<tr><td class="mono">${esc(r.code)}</td><td>${esc(nm(r.code))}</td><td>${esc(un(r.code))}</td><td class="n">${r.batches}</td><td class="n">${knum(r.std_qty)}</td><td class="n">${knum(r.actual_qty)}</td><td class="n ${Math.abs(p)>V.tolerance_pct?"t-red":""}">${d>0?"+":""}${knum(d)}</td><td class="n">${r.std_qty?(p>0?"+":"")+p.toFixed(1)+"%":"—"}</td></tr>`})):`<p class="hint pad">Đang tải…</p>`}</section>`);
}

/* ---------- Danh mục & định mức ---------- */
/* Khi bấm xóa / ngừng dùng, trang vẽ lại; nhớ vị trí cuộn để quay đúng chỗ đang làm (không nhảy về dòng đầu). */
function khoScrollBox(m){let e=m;while(e&&e!==document.body){const cs=getComputedStyle(e);if(/(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight)return e;e=e.parentElement}return document.scrollingElement||document.documentElement}
function khoKeepScroll(S,m){const b=khoScrollBox(m),w=m.querySelector(".dmwrap");S.keep={y:b.scrollTop,w:w?w.scrollTop:0,until:Date.now()+4000}}
function pKhoDm(m){
  const S=KHO.dm||(KHO.dm={q:"",sel:""});
  const canEd=khoCanMisa();
  khoFrame(m,"kho_dm","Danh mục & định mức","Mã vật tư lấy từ MISA. Định mức: 1 dòng = 1 vật tư dùng cho 1 đơn vị sản phẩm (1 lít BTP, 1 can / chai thành phẩm).",(()=>{
    if(!S.size)S.size=100;if(!S.page)S.page=1;if(S.cls==null)S.cls="";if(!S.pick)S.pick=new Set();const canEd=khoCanMisa();
    const all=[...KHO.items.values()],q=kfold(S.q).trim(),sel=KHO.items.get(S.sel),B=sel?(KHO.bom.get(sel.code)||[]):[];
    const cnt=k=>all.filter(i=>k==="off"?!i.active:k==="nobom"?(i.active&&i.cls==="TP"&&!khoHasBom(i.code)):i.cls===k).length;
    const L=all.filter(i=>(!S.cls||(S.cls==="off"?!i.active:S.cls==="nobom"?(i.active&&i.cls==="TP"&&!khoHasBom(i.code)):i.cls===S.cls))&&(!q||q.split(/\s+/).every(w=>kfold(i.code+" "+i.name).includes(w)))).sort((a,b)=>String(a.code).localeCompare(String(b.code),"vi"));
    const pages=Math.max(1,Math.ceil(L.length/S.size));if(S.page>pages)S.page=pages;
    const from=(S.page-1)*S.size,rows=L.slice(from,from+S.size);
    const chip=(k,t,n)=>`<button class="dmchip${S.cls===k?" on":""}" data-dmc="${k}">${t}<b>${knum(n)}</b></button>`;
    const pgList=(()=>{const out=[],add=n=>out.push(n);if(pages<=7){for(let n=1;n<=pages;n++)add(n)}else{add(1);if(S.page>3)add("…");for(let n=Math.max(2,S.page-1);n<=Math.min(pages-1,S.page+1);n++)add(n);if(S.page<pages-2)add("…");add(pages)}return out})();
    return `<section class="card flush"><div class="pad" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input id="dm-q" placeholder="Gõ mã hoặc tên để tìm" value="${esc(S.q)}" style="flex:1 1 280px;min-width:200px;margin:0"><select id="dm-cls" title="Lọc theo loại" style="width:auto;min-width:220px;margin:0"><option value=""${S.cls===""?" selected":""}>Tất cả (${knum(all.length)})</option>${Object.entries(KHO_CLS).filter(([k])=>cnt(k)>0).map(([k,t])=>`<option value="${k}"${S.cls===k?" selected":""}>${t} (${knum(cnt(k))})</option>`).join("")}${cnt("nobom")?`<option value="nobom"${S.cls==="nobom"?" selected":""}>Thành phẩm chưa có định mức (${knum(cnt("nobom"))})</option>`:""}${cnt("off")?`<option value="off"${S.cls==="off"?" selected":""}>Ngừng dùng (${knum(cnt("off"))})</option>`:""}</select>${khoCanMisa()?`<button class="btn pri" id="dm-new" style="white-space:nowrap">+ Thêm mã mới</button>`:""}</div>
     <div id="dm-bulk" class="dmbulktop"></div>
     ${rows.length?`<div class="dmwrap"><table class="tbl dmtbl"><colgroup>${canEd?'<col style="width:38px">':""}<col style="width:17%"><col><col style="width:104px"><col style="width:112px"><col style="width:84px">${canEd?'<col style="width:150px">':""}</colgroup><thead><tr>${canEd?`<th><input type="checkbox" id="dm-all" title="Chọn cả trang này"${rows.length&&rows.every(i=>S.pick.has(i.code))?" checked":""}></th>`:""}<th>Mã</th><th>Tên</th><th>ĐVT</th><th>Loại</th><th class="n">Định mức</th>${canEd?"<th></th>":""}</tr></thead><tbody>${rows.map(i=>`<tr class="clk${i.code===S.sel?" sel":""}" data-it="${esc(i.code)}">${canEd?`<td class="dmck"><input type="checkbox" class="dm-ck" data-ck="${esc(i.code)}"${S.pick.has(i.code)?" checked":""}></td>`:""}<td class="mono">${esc(i.code)}</td><td>${esc(i.name)}${i.active?"":` <span class="tag">ngừng dùng</span>`}</td><td>${esc(i.unit)}</td><td>${esc(KHO_CLS[i.cls]||i.cls)}</td><td class="n">${(KHO.bom.get(i.code)||[]).length||""}</td>${canEd?`<td class="nowrap"><button class="lnk" data-dmo="${esc(i.code)}">${i.active?"Ngừng dùng":"Dùng lại"}</button> · <button class="lnk" data-dmd="${esc(i.code)}" style="color:#b42318">Xóa</button></td>`:""}</tr>`).join("")}</tbody></table></div>`:`<p class="hint pad">${q||S.cls?"Không có mã nào khớp.":"Chưa có mã nào."}</p>`}
     <div class="dmfoot"><span class="dmsum">${L.length?`Hiện <b>${knum(from+1)}–${knum(from+rows.length)}</b> / <b>${knum(L.length)}</b> mã`:"0 mã"}</span><span class="dmpg"><button data-dmp="${S.page-1}"${S.page<=1?" disabled":""}>‹</button>${pgList.map(n=>n==="…"?`<span class="dmdots">…</span>`:`<button class="${n===S.page?"on":""}" data-dmp="${n}">${n}</button>`).join("")}<button data-dmp="${S.page+1}"${S.page>=pages?" disabled":""}>›</button><select id="dm-size">${[50,100,200,500].map(n=>`<option value="${n}"${n===S.size?" selected":""}>${n} / trang</option>`).join("")}</select></span></div></section>
     ${sel?`<section class="card"><div class="card-h"><h2>${esc(sel.code)} · ${esc(sel.name)}</h2>${khoCanMisa()?`<span><button class="btn" id="dm-edit">Sửa định mức</button> <button class="btn" id="dm-off">${sel.active?"Ngừng dùng mã":"Dùng lại mã"}</button> <button class="btn" id="dm-del" style="color:#b42318">Xóa mã</button></span>`:""}</div>${sel.active?"":`<p class="hint pad"><b>Mã này đang ngừng dùng</b>: không hiện ở các ô chọn mã khi lập phiếu.</p>`}${B.length?tbl(["Vật tư dùng","Tên","ĐVT","Định mức","Loại","Ghi chú"],B.map(b=>{const it=KHO.items.get(b.item)||{};return `<tr><td class="mono">${esc(b.item)}</td><td>${esc(it.name||"")}</td><td>${esc(it.unit||"")}</td><td class="n">${knum(b.qty)}</td><td>${esc(b.kind)}</td><td>${esc(b.note)}</td></tr>`})):`<p class="hint">Mã này chưa có định mức.</p>`}</section>`:""}`})());
  if($("#dm-q"))$("#dm-q").oninput=()=>{S.q=$("#dm-q").value;S.page=1;const p=$("#dm-q").selectionStart;renderMain();const q=$("#dm-q");q.focus();q.setSelectionRange(p,p)};
  m.querySelectorAll("[data-it]").forEach(r=>r.onclick=()=>{S.sel=r.dataset.it;khoKeepScroll(S,m);renderMain()});
  if($("#dm-cls"))$("#dm-cls").onchange=e=>{S.cls=e.target.value;S.page=1;renderMain()};
  m.querySelectorAll("[data-dmp]").forEach(x=>x.onclick=()=>{const n=+x.dataset.dmp;if(n>=1){S.page=n;window.RM_TOP=true;renderMain();const w=m.querySelector(".dmwrap");if(w)w.scrollTop=0}});
  if($("#dm-size"))$("#dm-size").onchange=e=>{S.size=+e.target.value;S.page=1;window.RM_TOP=true;renderMain()};
  if($("#dm-new"))$("#dm-new").onclick=()=>khoNewItem();if($("#dm-edit"))$("#dm-edit").onclick=()=>khoEditBom(S.sel);
  if(S.keep&&Date.now()<S.keep.until){const k=S.keep;requestAnimationFrame(()=>{const b=khoScrollBox(m),w=m.querySelector(".dmwrap");if(b)b.scrollTop=k.y;if(w)w.scrollTop=k.w})}
  const dmOff=async code=>{const it=KHO.items.get(code);if(!it)return;const to=!it.active;
    if(!to&&!confirm("Ngừng dùng mã "+it.code+"? Mã vẫn nằm trong lịch sử kho, chỉ không hiện ở các ô chọn mã nữa."))return;
    khoKeepScroll(S,m);try{await kApi("/items/"+encodeURIComponent(it.code)+"/active",{method:"POST",body:JSON.stringify({active:to})});toast(to?"Đã bật dùng lại "+it.code:"Đã ngừng dùng "+it.code);await khoLoad(true);renderMain()}catch(e){toast(e.message)}};
  const dmDel=async code=>{const it=KHO.items.get(code);if(!it)return;
    if(!confirm("Xóa hẳn mã "+it.code+" ("+it.name+")?\n\nMã xóa sẽ mang theo định mức riêng của nó. Mã đã có phiếu kho, đang nằm trong định mức của sản phẩm khác hoặc đang được CRM quy đổi thì không xóa được. Không hoàn tác được."))return;
    khoKeepScroll(S,m);try{await kApi("/items/"+encodeURIComponent(it.code),{method:"DELETE"});toast("Đã xóa "+it.code);S.pick.delete(code);if(S.sel===code)S.sel="";await khoLoad(true);renderMain()}
    catch(e){toast(e.message)}};
  if($("#dm-off"))$("#dm-off").onclick=()=>dmOff(S.sel);
  if($("#dm-del"))$("#dm-del").onclick=()=>dmDel(S.sel);
  m.querySelectorAll(".dmck").forEach(td=>td.onclick=e=>e.stopPropagation());
  /* Tick chọn chỉ đổi dấu tick và thanh thao tác ở chân bảng, KHÔNG vẽ lại bảng nên không bao giờ làm nhảy vị trí. */
  m.querySelectorAll(".dm-ck").forEach(x=>x.onchange=()=>{if(x.checked)S.pick.add(x.dataset.ck);else S.pick.delete(x.dataset.ck);dmBar()});
  if($("#dm-all"))$("#dm-all").onchange=e=>{m.querySelectorAll(".dm-ck").forEach(x=>{x.checked=e.target.checked;if(e.target.checked)S.pick.add(x.dataset.ck);else S.pick.delete(x.dataset.ck)});dmBar()};
  const bulk=async(action,label)=>{const codes=[...S.pick];if(!codes.length)return;
    const warn=action==="delete"?"\n\nMã xóa sẽ mang theo định mức riêng của nó. Mã đã có phiếu kho, đang nằm trong định mức của sản phẩm khác hoặc đang được CRM quy đổi thì không xóa được. Không hoàn tác được.":"";
    if(!confirm(label+" "+codes.length+" mã đã chọn?"+warn))return;
    khoKeepScroll(S,m);
    try{const r=await kApi("/items/bulk",{method:"POST",body:JSON.stringify({action:action,codes:codes})});
      r.done.forEach(c=>S.pick.delete(c));
      if(S.sel&&r.done.includes(S.sel)&&action==="delete")S.sel="";
      toast("Đã "+label.toLowerCase()+" "+r.done.length+" mã"+(r.blocked.length?" · "+r.blocked.length+" mã chưa xóa được":""));
      if(r.blocked.length)alert(r.blocked.length+" mã chưa xóa được vì còn dùng ở chỗ khác:\n\n"+r.blocked.slice(0,12).map(c=>"• "+c+": "+((r.reasons&&r.reasons[c])||[]).join("; ")).join("\n")+(r.blocked.length>12?"\n… và "+(r.blocked.length-12)+" mã nữa":"")+"\n\nMuốn xóa thì làm trước:\n1. Mã đang được CRM quy đổi → vào Đồng bộ mã B2B, bấm Gỡ ở dòng quy đổi.\n2. Mã nằm trong định mức của sản phẩm khác → vào Danh mục & định mức, sửa định mức của sản phẩm đó để bỏ mã này.\n3. Mã đã có phiếu kho hoặc số bán qua sàn → không xóa được, chọn Ngừng dùng để ẩn.");
      await khoLoad(true);renderMain()}catch(e){toast(e.message)}};
  function dmBar(){const el=$("#dm-bulk");if(!el)return;
    el.className="dmbulktop"+(canEd&&S.pick.size?" on":"");
    el.innerHTML=!canEd?"":S.pick.size?`<b>Đã chọn ${S.pick.size}</b><button class="btn sm" id="bk-off">Ngừng dùng</button><button class="btn sm" id="bk-on">Dùng lại</button><button class="btn sm" id="bk-del" style="color:#b42318">Xóa</button><button class="lnk" id="bk-clr">Bỏ chọn</button>`:`<span class="muted">Tick ô ở đầu dòng để chọn nhiều mã, rồi ngừng dùng hoặc xóa một lần.</span>`;
    if($("#bk-off"))$("#bk-off").onclick=()=>bulk("deactivate","Ngừng dùng");
    if($("#bk-on"))$("#bk-on").onclick=()=>bulk("activate","Dùng lại");
    if($("#bk-del"))$("#bk-del").onclick=()=>bulk("delete","Xóa");
    if($("#bk-clr"))$("#bk-clr").onclick=()=>{S.pick.clear();m.querySelectorAll(".dm-ck").forEach(x=>x.checked=false);dmBar()};
    const all=$("#dm-all");if(all){const cks=[...m.querySelectorAll(".dm-ck")];all.checked=cks.length>0&&cks.every(x=>x.checked)}}
  dmBar();
  m.querySelectorAll("[data-dmo]").forEach(b=>b.onclick=e=>{e.stopPropagation();dmOff(b.dataset.dmo)});
  m.querySelectorAll("[data-dmd]").forEach(b=>b.onclick=e=>{e.stopPropagation();dmDel(b.dataset.dmd)});
}
/* Người được thêm mã MISA mới / gắn mã: CEO, quản lý điều phối, kế toán (chị Huệ). Kế toán kho không thêm mã. */
const khoCanMisa=()=>ME&&(ME.role==="admin"||((typeof SV!=="undefined"&&SV.perms)||[]).some(p=>p==="order.approve.normal"||p==="order.accounting.confirm"));
function khoNewItem(pre){
  pre=pre||{};
  openDrawerHTML(`<h2>Thêm mã vật tư</h2><p class="hint">Dùng khi MISA có mã mới. Mã phải đúng như trong MISA.${pre.name?" Tên đã điền sẵn theo tên trên sàn, sửa lại cho đúng tên trong MISA.":""}</p><form class="frm" id="ni"><label class="field">Mã<input id="ni-c" required></label><label class="field">Tên<input id="ni-n" required value="${esc(pre.name||"")}"></label><label class="field">ĐVT<input id="ni-u" placeholder="Cái, Lít, Kg…"></label><label class="field">Loại hàng<select id="ni-k">${opt(Object.entries(KHO_CLS),pre.cls||"NVL")}</select></label><label class="field">Tồn tối thiểu<input id="ni-m" type="number" min="0" step="any"></label><button class="btn pri">Thêm mã</button><div id="ni-e"></div></form>`);
  $("#ni").onsubmit=async e=>{e.preventDefault();const nc=$("#ni-c").value;try{await kApi("/items",{method:"POST",body:JSON.stringify({code:nc,name:$("#ni-n").value,unit:$("#ni-u").value,cls:$("#ni-k").value,min_stock:+$("#ni-m").value||0})});closeDrawer();toast("Đã thêm mã");await khoLoad(true);if(typeof pre.onDone==="function")await pre.onDone(nc)}catch(err){$("#ni-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}}}
function khoEditBom(code){
  const B=(KHO.bom.get(code)||[]).map(b=>({...b}));
  const draw=()=>{$("#be-b").innerHTML=B.map((b,i)=>`<tr><td><input class="be-i" data-i="${i}" value="${esc(b.item)}" data-code="${esc(b.item)}"></td><td><input class="be-q n" data-i="${i}" type="number" step="any" min="0" value="${b.qty}"></td><td><input class="be-k" data-i="${i}" value="${esc(b.kind||"")}"></td><td><input class="be-n" data-i="${i}" value="${esc(b.note||"")}"></td><td><button type="button" class="lnk" data-rm="${i}">✕</button></td></tr>`).join("");
    document.querySelectorAll(".be-i").forEach(x=>khoPick(x,null,it=>{B[+x.dataset.i].item=it.code}));document.querySelectorAll(".be-q").forEach(x=>x.oninput=()=>B[+x.dataset.i].qty=+x.value);document.querySelectorAll(".be-k").forEach(x=>x.oninput=()=>B[+x.dataset.i].kind=x.value);document.querySelectorAll(".be-n").forEach(x=>x.oninput=()=>B[+x.dataset.i].note=x.value);document.querySelectorAll("[data-rm]").forEach(x=>x.onclick=()=>{B.splice(+x.dataset.rm,1);draw()})};
  openDrawerHTML(`<h2>Sửa định mức · ${esc(code)}</h2><p class="hint">Chỉ áp cho phiếu lập SAU này; phiếu đã ghi giữ nguyên số đã trừ.</p><form class="frm" id="be"><div class="tbl edit"><table><thead><tr><th>Vật tư</th><th>Định mức</th><th>Loại</th><th>Ghi chú</th><th></th></tr></thead><tbody id="be-b"></tbody></table></div><div class="row7"><button type="button" class="btn" id="be-add">+ Thêm dòng</button><button class="btn pri">Lưu định mức</button></div><div id="be-e"></div></form>`);
  draw();$("#be-add").onclick=()=>{B.push({item:"",qty:1,kind:"",note:""});draw()};
  $("#be").onsubmit=async e=>{e.preventDefault();try{await kApi("/bom/"+encodeURIComponent(code),{method:"PUT",body:JSON.stringify({lines:B.filter(b=>b.item)})});closeDrawer();toast("Đã lưu định mức");await khoLoad(true);renderMain()}catch(err){$("#be-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}}}


/* ---------- Định mức & giá thành (dạng bảng định mức nguyên vật liệu như MISA) ---------- */
/* Giá vốn từng mã: giá nhập gần nhất hoặc bình quân (lấy từ phiếu nhập); mã có định mức thì cộng từ thành phần. */
async function khoLoadCosts(){
  if(KHO.costs||KHO.costsBusy)return;KHO.costsBusy=true;
  try{const r=await kApi("/costs");KHO.costs=new Map(r.map(x=>[x.item,x]))}catch(e){KHO.costs=new Map();KHO.costErr=e.message}
  KHO.costsBusy=false;if(PAGE==="kho_boc")renderMain();
}
function khoCostOf(code,mode,memo,path){
  memo=memo||new Map();path=path||[];
  if(memo.has(code))return memo.get(code);
  const B=KHO.bom.get(code)||[];let r;
  if(B.length&&!path.includes(code)){
    let sum=0,miss=0;B.forEach(b=>{const c=khoCostOf(b.item,mode,memo,path.concat(code));sum+=b.qty*c.cost;miss+=c.miss});
    r={cost:sum,miss:miss}
  }else{const c=KHO.costs&&KHO.costs.get(code),v=c?(mode==="avg"?c.avg:c.last):0;r={cost:v,miss:v>0?0:1}}
  memo.set(code,r);return r;
}
/* Bóc nhiều bậc: mỗi dòng là một vật tư trong định mức; bán thành phẩm có định mức thì bóc tiếp xuống nguyên liệu. */
function khoBoc(code,qty,mode){
  const rows=[],memo=new Map(),walk=(c,q,lv,path)=>{(KHO.bom.get(c)||[]).forEach(b=>{const need=b.qty*q,it=KHO.items.get(b.item)||{},sub=KHO.bom.get(b.item)||[],cs=khoCostOf(b.item,mode,memo);
    rows.push({lv:lv,item:b.item,name:it.name||"",unit:it.unit||"",per:b.qty,need:need,stock:khoStock(b.item),hasSub:sub.length>0,price:cs.cost,amount:cs.cost*need,miss:cs.miss});
    if(sub.length&&lv<4&&!path.includes(b.item))walk(b.item,need,lv+1,path.concat(b.item))})};
  walk(code,qty,0,[code]);
  const tot=khoCostOf(code,mode,memo);
  return {rows:rows,unitCost:tot.cost,miss:tot.miss};
}
const khoVnd=n=>Math.round(+n||0).toLocaleString("vi-VN");
function pKhoBoc(m){
  const S=KHO.boc||(KHO.boc={code:"",qty:1,mode:"last"});
  const canEd=khoCanMisa();
  /* Vẽ lại (tick chọn, đổi trang, mở / đóng chi tiết) không được làm bảng nhảy về dòng đầu: nhớ vị trí rồi trả lại. */
  const oldW=m.querySelector(".dmwrap"),keepW=oldW?oldW.scrollTop:0,sb=khoScrollBox(m),keepY0=sb.scrollTop,noKeep=S.noKeep;S.noKeep=false;
  khoLoadCosts();
  khoFrame(m,"kho_boc","Định mức & giá thành","Bảng định mức nguyên vật liệu cấu thành từng sản phẩm: cần bao nhiêu, giá vốn từng dòng và giá thành sản phẩm. Giá vốn lấy từ phiếu nhập kho.",(()=>{
    const canEd=khoCanMisa();
    const sel=KHO.items.get(S.code),hasP=KHO.cat&&KHO.cat.can_price,R=sel&&S.qty>0?khoBoc(S.code,+S.qty,S.mode):null;
    const leaves=R?R.rows.filter(r=>!r.hasSub):[],lack=leaves.filter(r=>r.need>r.stock+1e-9).length;
    const all=[...KHO.items.values()].filter(i=>i.active&&(KHO.bom.get(i.code)||[]).length);
    const memo=new Map(),list=hasP&&KHO.costs?all.map(i=>({i:i,c:khoCostOf(i.code,S.mode,memo)})).sort((a,b)=>a.i.code.localeCompare(b.i.code)):[];
    const lb="display:flex;align-items:center;gap:8px;white-space:nowrap;margin:0";
    const ctl=`<div class="pad" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding-top:12px;padding-bottom:12px"><label style="${lb};flex:1 1 300px"><span>Sản phẩm</span><input id="bc-i" placeholder="Gõ mã hoặc tên sản phẩm để xem định mức" value="" autocomplete="off" style="flex:1;margin:0;min-width:180px"></label>${hasP?`<label style="${lb}"><span>Giá vốn</span><select id="bc-m" style="width:auto;margin:0"><option value="last"${S.mode==="last"?" selected":""}>Giá nhập gần nhất</option><option value="avg"${S.mode==="avg"?" selected":""}>Bình quân các lần nhập</option></select></label>`:""}</div>`;
    let body="";
    if(!sel)body="";
    else if(!R.rows.length)body=`<p class="hint pad"><b>${esc(sel.code)}</b> chưa có định mức. ${canEd?`<button class="btn sm pri" data-be="${esc(sel.code)}">Sửa định mức</button>`:"Vào <b>Danh mục & định mức</b>, chọn mã này rồi bấm Sửa định mức."}</p>`;
    else body=`${canEd?`<div class="pad" style="padding-bottom:0;text-align:right"><button class="btn sm pri" data-be="${esc(sel.code)}">Sửa định mức</button> <button class="btn sm" data-bo="${esc(sel.code)}">Ngừng dùng mã này</button> <button class="btn sm" data-bx="${esc(sel.code)}" style="color:#b42318">Xóa định mức</button></div>`:""}<div class="pad"><h2 style="margin:0">${esc(sel.code)} · ${esc(sel.name)}</h2><p class="hint">Đơn vị tính: ${esc(sel.unit||"")}. Định mức cho <b>1 ${esc(sel.unit||"đơn vị")}</b>; cột "Cần" tính cho <b>${knum(S.qty)}</b>.${lack?` <b style="color:#c0392b">Thiếu ${lack} loại vật tư trong kho (dòng đỏ).</b>`:" Đủ vật tư trong kho."}</p></div>`+
      khoRows(["STT","Mã vật tư","Tên vật tư","ĐVT","Định mức / 1","Cần","Tồn kho","Còn thiếu"].concat(hasP?["Đơn giá","Thành tiền"]:[]),R.rows.map((r,n)=>{const sh=Math.max(0,r.need-r.stock),leaf=!r.hasSub;return `<tr${leaf&&sh>0?' style="background:#fdecea"':""}><td>${n+1}</td><td class="mono" style="padding-left:${12+r.lv*18}px">${r.lv?"↳ ":""}${esc(r.item)}</td><td>${esc(r.name)}${r.hasSub?' <small class="muted">(bán thành phẩm, bóc tiếp)</small>':""}</td><td>${esc(r.unit)}</td><td class="n">${knum(r.per)}</td><td class="n">${knum(r.need)}</td><td class="n">${knum(r.stock)}</td><td class="n">${sh>0?`<b${leaf?' style="color:#c0392b"':""}>${knum(sh)}</b>`:""}</td>${hasP?`<td class="n">${r.price?khoVnd(r.price):'<span class="muted">chưa có giá</span>'}</td><td class="n">${r.hasSub?"":khoVnd(r.amount)}</td>`:""}</tr>`}))+
      (hasP?`<div class="pad" style="text-align:right"><div>Giá thành 1 ${esc(sel.unit||"đơn vị")}: <b style="font-size:18px">${khoVnd(R.unitCost)} đ</b></div><div class="hint">Cho ${knum(S.qty)}: <b>${khoVnd(R.unitCost*S.qty)} đ</b>${R.miss?` · <span style="color:#c0392b">còn ${R.miss} vật tư chưa có giá nhập nên giá thành đang thấp hơn thực tế</span>`:""}</div></div>`:`<p class="hint pad">Giá vốn chỉ CEO và kế toán xem được.</p>`);
    if(!S.bpick)S.bpick=new Set();if(!S.psize)S.psize=100;if(!S.ppage)S.ppage=1;
    const ppages=Math.max(1,Math.ceil(list.length/S.psize));if(S.ppage>ppages)S.ppage=ppages;
    const pfrom=(S.ppage-1)*S.psize,prows=list.slice(pfrom,pfrom+S.psize);
    const pgl=(()=>{const o=[],pg=S.ppage;if(ppages<=7){for(let n=1;n<=ppages;n++)o.push(n)}else{o.push(1);if(pg>3)o.push("…");for(let n=Math.max(2,pg-1);n<=Math.min(ppages-1,pg+1);n++)o.push(n);if(pg<ppages-2)o.push("…");o.push(ppages)}return o})();
    const tb=hasP?`<section class="card flush"><div class="card-h pad"><h2>Giá thành các sản phẩm đã khai định mức</h2></div>
      <div id="bb-bulk" class="dmbulktop"></div>
      ${!KHO.costs?`<p class="hint pad">Đang tính giá…</p>`:KHO.costErr?`<p class="hint pad">${esc(KHO.costErr)}</p>`:`<div class="dmwrap"><table class="tbl dmtbl"><colgroup>${canEd?'<col style="width:38px">':""}<col style="width:20%"><col><col style="width:84px"><col style="width:120px"><col style="width:84px"><col style="width:132px">${canEd?'<col style="width:232px">':""}</colgroup><thead><tr>${canEd?`<th><input type="checkbox" id="bb-all" title="Chọn cả trang này"${prows.length&&prows.every(x=>S.bpick.has(x.i.code))?" checked":""}></th>`:""}<th>Mã</th><th>Tên</th><th>ĐVT</th><th class="n">Giá thành / 1</th><th class="n">Định mức</th><th>Ghi chú</th>${canEd?"<th></th>":""}</tr></thead><tbody>${prows.map(x=>`<tr class="clk${x.i.code===S.code?" sel":""}" data-pick="${esc(x.i.code)}">${canEd?`<td class="dmck"><input type="checkbox" class="bb-ck" data-bk="${esc(x.i.code)}"${S.bpick.has(x.i.code)?" checked":""}></td>`:""}<td class="mono">${esc(x.i.code)}</td><td>${esc(x.i.name)}</td><td>${esc(x.i.unit)}</td><td class="n">${x.c.cost?khoVnd(x.c.cost):"—"}</td><td class="n">${(KHO.bom.get(x.i.code)||[]).length}</td><td>${x.c.miss?`<span style="color:#c0392b">thiếu giá ${x.c.miss} vật tư</span>`:""}</td>${canEd?`<td class="nowrap"><button class="lnk" data-bo="${esc(x.i.code)}">Ngừng dùng</button> · <button class="lnk" data-bx="${esc(x.i.code)}" style="color:#b42318">Xóa định mức</button></td>`:""}</tr>`).join("")}</tbody></table></div>
      <div class="dmfoot"><span class="dmsum">${list.length?`Hiện <b>${knum(pfrom+1)}–${knum(pfrom+prows.length)}</b> / <b>${knum(list.length)}</b> sản phẩm`:"0 sản phẩm"}</span><span class="dmpg"><button data-bpp="${S.ppage-1}"${S.ppage<=1?" disabled":""}>‹</button>${pgl.map(n=>n==="…"?`<span class="dmdots">…</span>`:`<button class="${n===S.ppage?"on":""}" data-bpp="${n}">${n}</button>`).join("")}<button data-bpp="${S.ppage+1}"${S.ppage>=ppages?" disabled":""}>›</button><select id="bb-size">${[50,100,200,500].map(n=>`<option value="${n}"${n===S.psize?" selected":""}>${n} / trang</option>`).join("")}</select></span></div>`}</section>`:"";
    KHO.bocModal=sel?`<div id="boc-modal" style="position:fixed;inset:0;background:rgba(15,18,30,.45);z-index:60;overflow:auto;padding:24px 12px"><div style="background:#fff;color:inherit;border-radius:14px;max-width:1100px;margin:0 auto;padding:14px 16px 18px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><label style="${lb}"><span>Số lượng làm</span><input id="bc-q" type="number" min="0" step="any" value="${S.qty}" style="width:84px;margin:0"></label>${R&&R.rows.length?`<button class="btn" id="bc-x">Tải Excel</button><button class="btn" id="bc-p">In</button>`:""}<button class="btn" id="bc-close">Đóng</button></div>${body}</div></div>`:"";
    return `<section class="card flush">${ctl}</section>${tb?`<div style="height:12px"></div>`+tb:""}`})());
  {const R0=document.getElementById("boc-modal-root");
    if(!KHO.bocModal){if(R0)R0.remove()}
    else{let R=R0;if(!R){R=document.createElement("div");R.id="boc-modal-root";document.body.appendChild(R)}R.innerHTML=KHO.bocModal}
    if(!window.__bocWatch)window.__bocWatch=setInterval(()=>{if(PAGE!=="kho_boc"){const r=document.getElementById("boc-modal-root");if(r)r.remove()}},400)}
  if(!noKeep)requestAnimationFrame(()=>{const w=m.querySelector(".dmwrap");if(w)w.scrollTop=keepW;sb.scrollTop=keepY0});
  const q=$("#bc-q");if(q)q.oninput=()=>{S.qty=+q.value||0;const p=q.selectionStart;renderMain();const n=$("#bc-q");n.focus();try{n.setSelectionRange(p,p)}catch(e){}};
  const i=$("#bc-i");if(i)khoPick(i,null,it=>{S.code=it.code;S.noKeep=true;window.RM_TOP=true;renderMain()});
  if($("#bc-close"))$("#bc-close").onclick=()=>{S.code="";renderMain()};
  if($("#boc-modal"))$("#boc-modal").onmousedown=e=>{if(e.target.id==="boc-modal"){S.code="";renderMain()}};
  if($("#bc-m"))$("#bc-m").onchange=e=>{S.mode=e.target.value;renderMain()};
  m.querySelectorAll("[data-pick]").forEach(r=>r.onclick=()=>{S.code=r.dataset.pick;renderMain()});
  m.querySelectorAll(".dmck").forEach(td=>td.onclick=e=>e.stopPropagation());
  m.querySelectorAll(".bb-ck").forEach(x=>x.onchange=()=>{if(x.checked)S.bpick.add(x.dataset.bk);else S.bpick.delete(x.dataset.bk);bbBar()});
  if($("#bb-all"))$("#bb-all").onchange=e=>{m.querySelectorAll(".bb-ck").forEach(x=>{x.checked=e.target.checked;if(e.target.checked)S.bpick.add(x.dataset.bk);else S.bpick.delete(x.dataset.bk)});bbBar()};
  m.querySelectorAll("[data-bpp]").forEach(x=>x.onclick=()=>{const n=+x.dataset.bpp;if(n>=1){S.ppage=n;S.noKeep=true;window.RM_TOP=true;renderMain()}});
  if($("#bb-size"))$("#bb-size").onchange=e=>{S.psize=+e.target.value;S.ppage=1;S.noKeep=true;window.RM_TOP=true;renderMain()};
  const bbRun=async(kind)=>{const codes=[...S.bpick];if(!codes.length)return;
    const msg=kind==="off"?"Ngừng dùng "+codes.length+" sản phẩm đã chọn? Mã bị ẩn khỏi danh sách này, lịch sử kho giữ nguyên.":"Xóa toàn bộ định mức của "+codes.length+" sản phẩm đã chọn?\n\nSau đó sản xuất các mã này web không tự trừ vật tư nữa. Phiếu kho đã lập giữ nguyên.";
    if(!confirm(msg))return;const b=khoScrollBox(m),y=b.scrollTop;
    try{
      if(kind==="off"){const r=await kApi("/items/bulk",{method:"POST",body:JSON.stringify({action:"deactivate",codes:codes})});r.done.forEach(c=>S.bpick.delete(c));toast("Đã ngừng dùng "+r.done.length+" mã")}
      else{const r=await kApi("/bom/bulk-clear",{method:"POST",body:JSON.stringify({products:codes})});codes.forEach(c=>S.bpick.delete(c));toast("Đã xóa định mức của "+r.cleared+" sản phẩm")}
      if(codes.includes(S.code))S.code="";await khoLoad(true);renderMain();requestAnimationFrame(()=>{b.scrollTop=y})
    }catch(e){toast(e.message)}};
  function bbBar(){const el=$("#bb-bulk");if(!el)return;
    el.className="dmbulktop"+(canEd&&S.bpick.size?" on":"");
    el.innerHTML=!canEd?"":S.bpick.size?`<b>Đã chọn ${S.bpick.size}</b><button class="btn sm" id="bb-off">Ngừng dùng</button><button class="btn sm" id="bb-del" style="color:#b42318">Xóa định mức</button><button class="lnk" id="bb-clr">Bỏ chọn</button>`:`<span class="muted">Tick ô ở đầu dòng để chọn nhiều sản phẩm, rồi ngừng dùng hoặc xóa định mức một lần.</span>`;
    if($("#bb-off"))$("#bb-off").onclick=()=>bbRun("off");
    if($("#bb-del"))$("#bb-del").onclick=()=>bbRun("del");
    if($("#bb-clr"))$("#bb-clr").onclick=()=>{S.bpick.clear();m.querySelectorAll(".bb-ck").forEach(x=>x.checked=false);bbBar()};
    const all=$("#bb-all");if(all){const cks=[...m.querySelectorAll(".bb-ck")];all.checked=cks.length>0&&cks.every(x=>x.checked)}}
  bbBar();
  const keepY=()=>{const b=khoScrollBox(m),y=b.scrollTop;return ()=>requestAnimationFrame(()=>{b.scrollTop=y})};
  document.querySelectorAll("[data-be]").forEach(b=>b.onclick=()=>khoEditBom(b.dataset.be));
  document.querySelectorAll("[data-bo]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const code=b.dataset.bo,it=KHO.items.get(code);if(!it)return;
    if(!confirm("Ngừng dùng mã "+code+"? Mã không còn hiện ở danh sách này và các ô chọn mã, lịch sử kho giữ nguyên."))return;
    const back=keepY();try{await kApi("/items/"+encodeURIComponent(code)+"/active",{method:"POST",body:JSON.stringify({active:false})});toast("Đã ngừng dùng "+code);if(S.code===code)S.code="";await khoLoad(true);renderMain();back()}catch(err){toast(err.message)}});
  document.querySelectorAll("[data-bx]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const code=b.dataset.bx,n=(KHO.bom.get(code)||[]).length;
    if(!confirm("Xóa toàn bộ "+n+" dòng định mức của "+code+"?\n\nSau đó khi sản xuất mã này web không tự trừ vật tư nữa. Phiếu kho đã lập giữ nguyên. Muốn khai lại thì vào Danh mục & định mức, Sửa định mức."))return;
    const back=keepY();try{await kApi("/bom/"+encodeURIComponent(code),{method:"PUT",body:JSON.stringify({lines:[]})});toast("Đã xóa định mức của "+code);if(S.code===code)S.code="";await khoLoad(true);renderMain();back()}catch(err){toast(err.message)}});
  const sheet=()=>{const R=khoBoc(S.code,+S.qty,S.mode),P=KHO.cat&&KHO.cat.can_price,it=KHO.items.get(S.code);
    const head=["STT","Mã vật tư","Tên vật tư","ĐVT","Định mức / 1","Cần","Tồn kho","Còn thiếu"].concat(P?["Đơn giá","Thành tiền"]:[]);
    const body=R.rows.map((r,n)=>[n+1,(r.lv?"  ".repeat(r.lv)+"↳ ":"")+r.item,r.name,r.unit,r.per,r.need,r.stock,Math.max(0,r.need-r.stock)].concat(P?[r.price||"",r.hasSub?"":Math.round(r.amount)]:[]));
    return {R:R,P:P,it:it,head:head,body:body}};
  if($("#bc-x"))$("#bc-x").onclick=()=>{if(typeof XLSX==="undefined"){toast("Chưa tải được công cụ Excel");return}const d=sheet(),aoa=[["ĐỊNH MỨC NGUYÊN VẬT LIỆU"],["Sản phẩm",d.it.code,d.it.name,"ĐVT",d.it.unit||""],["Số lượng",S.qty],[],d.head].concat(d.body);if(d.P)aoa.push([],["Giá thành / 1 "+(d.it.unit||""),Math.round(d.R.unitCost)],["Giá thành cho "+S.qty,Math.round(d.R.unitCost*S.qty)]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),"Dinh muc");XLSX.writeFile(wb,"dinh-muc-"+S.code+".xlsx")};
  if($("#bc-p"))$("#bc-p").onclick=()=>{const d=sheet(),w=window.open("","_blank");if(!w){toast("Trình duyệt chặn cửa sổ in");return}
    w.document.write(`<html><head><meta charset="utf-8"><title>Định mức ${esc(d.it.code)}</title><style>body{font:13px Arial;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:4px 6px}th{background:#eee}.n{text-align:right}</style></head><body><h2 style="text-align:center">ĐỊNH MỨC NGUYÊN VẬT LIỆU</h2><p><b>Sản phẩm:</b> ${esc(d.it.code)} – ${esc(d.it.name)} · <b>ĐVT:</b> ${esc(d.it.unit||"")} · <b>Số lượng:</b> ${knum(S.qty)}</p><table><tr>${d.head.map(h=>"<th>"+h+"</th>").join("")}</tr>${d.body.map(r=>"<tr>"+r.map((c,k)=>`<td class="${k>=4?"n":""}">${typeof c==="number"?knum(c):esc(c)}</td>`).join("")+"</tr>").join("")}</table>${d.P?`<p style="text-align:right"><b>Giá thành / 1 ${esc(d.it.unit||"")}: ${khoVnd(d.R.unitCost)} đ</b><br>Cho ${knum(S.qty)}: ${khoVnd(d.R.unitCost*S.qty)} đ</p>`:""}</body></html>`);w.document.close();w.print()};
}

Object.assign(PAGES,{kho_boc:pKhoBoc,kho_ton:pKhoTon,kho_nhap:m=>pKhoDocs(m,"PN",{key:"PN_NVL",page:"kho_nhap",cls:"NVL",formCls:["NVL","CCDC"],name:"Nhập nguyên vật liệu",hint:"Hàng mua về: nguyên vật liệu, vỏ, tem, bao bì, công cụ. Kế toán kho ghi theo số thực nhận."}),kho_nhap_tp:m=>pKhoDocs(m,"PN",{key:"PN_TP",page:"kho_nhap_tp",cls:"TP",formCls:["TP","HH"],name:"Nhập thành phẩm",hint:"Thành phẩm, hàng hóa nhập về kho (mua ngoài, gia công xong giao về). Ghi theo số thực nhận."}),kho_pc:m=>pKhoDocs(m,"PC"),kho_ks:m=>pKhoDocs(m,"KS"),kho_xuat:m=>pKhoDocs(m,"XB"),kho_hoan:m=>pKhoDocs(m,"TL"),kho_nxt:pKhoNxt,kho_cl:pKhoCl,kho_dm:pKhoDm});
