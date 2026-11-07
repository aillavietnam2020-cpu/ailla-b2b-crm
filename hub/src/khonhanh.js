/* =====================================================================
   GHI NHANH PHIẾU KHO (chị Hoa duyệt 04/11, phương án C menu kho). Xem ghi chú ở kqInject: một nút "＋ Ghi nhanh" cho cả hai web.
   - Nút "＋ Lập phiếu nhanh" ở góc trên mọi trang Kho – Sản xuất (web vận hành): chọn loại phiếu, phiếu mở ngay tại chỗ.
     Chỉ hiện loại phiếu người đó được làm (cùng quyền như nút lập phiếu ở từng trang). Web quản trị không có nút này.
   - Trong phiếu: dán nhiều dòng từ Excel (mã, số lượng) vào ô mã hàng thì web tự thêm từng dòng.
   Không đổi cách ghi sổ: vẫn gọi đúng form và API phiếu kho như cũ.
   ===================================================================== */
const KQ_ADM=()=>typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
const KQ_GO=p=>{if(!PAGES[p])return;PAGE=p;renderMain();scrollTo(0,0)};
const KQ_MH=()=>typeof mhManage==="function"&&mhManage();
const KQ_CHI=()=>KQ_MH()||(typeof can==="function"&&can(ME,"chiphi.nhap"));
/* Chị Hoa 04/11: Ghi nhanh chỉ 5 việc, nằm trong mục Kho – Sản xuất (web vận hành). Không còn "xuất khác", pha chế, đóng gói, hàng hoàn, kiểm tồn ở đây.
   Phiếu xuất kho / nhập kho mở form chung cho cả hai kho: chọn mã nào thì sổ tự xếp vào kho nguyên vật liệu hay kho thành phẩm. */
const KQ_LIST=()=>[
  ["Lập phiếu thu",()=>KQ_CHI()&&typeof cptQuick==="function",()=>cptQuick(),false],
  ["Lập phiếu chi",()=>KQ_CHI()&&typeof spForm==="function",()=>spForm(),false],
  ["Lập phiếu mua hàng",()=>KQ_MH()&&typeof mhForm==="function",async()=>{try{await mhLoad()}catch(e){}for(let i=0;i<40&&!(MH&&MH.sup);i++)await new Promise(r=>setTimeout(r,150));mhForm(null)},false],
  ["Lập phiếu nhập kho",()=>kCan("PN")||KQ_MH(),()=>khoForm("PN",null,["NVL","CCDC","TP","HH"]),true],
  ["Lập phiếu xuất kho",()=>kCan("XB"),()=>khoForm("XB",null,null),true]]
  .filter(x=>{try{return x[1]()}catch(e){return false}});
function khoQuickBtn(){return ""}
const kqRun=async it=>{document.body.classList.remove("menu-open");if(it[3]){if(!KHO.cat){try{await khoLoad()}catch(err){}}if(!KHO.cat){toast("Đang tải kho, bấm lại sau vài giây");return}}try{await it[2]()}catch(e){toast(e.message||"Chưa mở được")}};
function kqInject(){
  if(typeof ME==="undefined"||!ME)return;
  /* Quản trị: Ghi nhanh sẵn có (admnav2.js) thêm 2 phiếu kho ở cuối: Lập phiếu nhập kho, Lập phiếu xuất kho (chị Hoa 04/11). */
  if(KQ_ADM()){const gp=document.getElementById("gnp");if(!gp||gp.querySelector("[data-kqa]"))return;let K=[];try{K=KQ_LIST().filter(x=>x[3])}catch(e){}if(!K.length)return;
    gp.insertAdjacentHTML("beforeend",K.map((x,i)=>`<button type="button" data-kqa="${i}"><b>${esc(x[0])}</b><small>${i===0?"Hàng mua về, chọn đơn mua để tự điền":"Xuất ngoài bán hàng: hàng mẫu, hủy hỏng, gia công"}</small></button>`).join(""));
    gp.querySelectorAll("button[data-kqa]").forEach(b=>b.onclick=e=>{e.stopPropagation();gp.hidden=true;kqRun(K[+b.dataset.kqa])});return}
  if(document.getElementById("kqside"))return;
  const top=document.querySelector('.side .top[data-mod="sx"]'),sub=top&&top.nextElementSibling;if(!sub||!sub.classList.contains("subnav"))return;
  let L=[];try{L=KQ_LIST()}catch(e){}if(!L.length)return;
  const w=document.createElement("div");w.id="kqside";w.className="gnbox kqin";
  w.innerHTML=`<button type="button" class="gnbtn kqbtn kqs"><span>＋ Ghi nhanh</span><span>▾</span></button>`;sub.prepend(w)}
{const _r=render;render=function(){const r=_r.apply(this,arguments);try{kqInject()}catch(e){}return r}}
function kqClose(){const p=document.getElementById("kqpop");if(p)p.remove()}
function kqOpen(btn){
  kqClose();const L=KQ_LIST();if(!L.length)return;const r=btn.getBoundingClientRect();
  const p=document.createElement("div");p.id="kqpop";p.className="kqpop";
  p.innerHTML=L.map(([t],i)=>`<button type="button" data-kq="${i}">${esc(t)}</button>`).join("");p.classList.add("one");
  document.body.appendChild(p);
  const w=p.offsetWidth,side=btn.classList.contains("kqs");p.style.top=(r.bottom+6)+"px";p.style.left=Math.max(8,Math.min(side?r.left:r.right-w,innerWidth-w-8))+"px";
  p.querySelectorAll("[data-kq]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const it=L[+b.dataset.kq];kqClose();document.body.classList.remove("menu-open");
    kqRun(it)});
}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest(".kqbtn");if(b){e.preventDefault();e.stopPropagation();if(document.getElementById("kqpop"))kqClose();else kqOpen(b);return}
  if(!(e.target.closest&&e.target.closest("#kqpop")))kqClose()},true);
addEventListener("scroll",e=>{if(!(e.target&&e.target.closest&&e.target.closest("#kqpop")))kqClose()},{passive:true,capture:false});

/* Trang Sản xuất (sxFrame: Tổng quan, Phiếu sản xuất, Tiến độ, Kiểm kê đóng gói, Báo cáo, Mua hàng): thêm nút vào ô thao tác. */
if(typeof sxFrame==="function"){const _sf=sxFrame;sxFrame=function(m,key,title,sub,body,actions){return _sf.call(this,m,key,title,sub,body,(actions||"")+(/btn pri|id="/.test(actions||"")?"":khoQuickBtn()))}}

/* Số kiểu Việt: 1.240 = một nghìn hai trăm bốn mươi; 2,5 = hai phẩy năm; 1.5 = một phẩy năm. */
function kqNum(x){x=String(x).replace(/\s/g,"");if(!x)return null;
  if(/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(x))x=x.replace(/\./g,"").replace(",",".");else if(/^-?\d+,\d+$/.test(x))x=x.replace(",",".");
  const n=+x;return isFinite(n)?n:null}
/* Dán nhiều dòng từ Excel vào ô mã hàng của phiếu: mỗi dòng "mã [tab] số lượng" (hoặc tên đúng như danh mục). */
if(typeof khoForm==="function"){const _kf=khoForm;khoForm=function(type,pre,clsO){
  let add=null;_kf.call(this,type,a=>{add=a;if(pre)pre(a)},clsO);
  const body=document.getElementById("kf-b");if(!body||type==="PC"||!add)return;
  body.addEventListener("paste",e=>{const inp=e.target;if(!inp.classList||!inp.classList.contains("kf-i"))return;
    const txt=(e.clipboardData||window.clipboardData).getData("text")||"";if(!/[\t\n]/.test(txt.trim()))return;
    e.preventDefault();const byName=new Map([...KHO.items.values()].map(i=>[kfold(i.name).trim(),i.code])),byCode=new Map([...KHO.items.keys()].map(c=>[c.toLowerCase(),c]));
    const bad=[];let n=0;
    txt.split(/\r?\n/).map(l=>l.split(/\t|;/).map(x=>x.trim())).filter(c=>c[0]).forEach(c=>{
      const key=c[0],code=byCode.get(key.toLowerCase())||byName.get(kfold(key).trim()),qs=c.slice(1).reverse().find(x=>x!==""&&kqNum(x)!=null);
      if(!code){bad.push(key);return}
      const q=qs==null?"":kqNum(qs);
      body.querySelectorAll("tr").forEach(tr=>{const i=tr.querySelector(".kf-i");if(i&&!i.dataset.code&&!i.value)tr.remove()});
      const tr=add({item:code,qty:q===""?undefined:q});n++;if(tr){const qi=tr.querySelector(".kf-q");if(qi)qi.dispatchEvent(new Event("input"))}});
    toast(`Đã thêm ${n} dòng`+(bad.length?` · không tìm thấy mã: ${bad.slice(0,5).join(", ")}${bad.length>5?"…":""}`:""))});
  const tip=document.querySelector("#kf .row7 .field.grow input#kf-n");if(tip&&type!=="PC"){const h=document.createElement("p");h.className="hint";h.textContent="Mẹo: dán nhiều dòng từ Excel (cột mã, cột số lượng) vào ô mã hàng, web tự thêm từng dòng.";const t=document.querySelector("#kf .tbl.edit");if(t)t.after(h)}
}}

/* Ô chọn sản phẩm dạng danh sách thả xuống (phiếu sản xuất, báo hoàn thành, kiểm kê phát sinh): không dán tên để tìm được.
   Thêm một ô gõ / dán ngay trên: gõ hoặc dán tên, mã → danh sách chỉ còn mã khớp và tự chọn mã đầu tiên (chị Hoa 06/11). */
function kqSearchSelect(sel){
  if(sel.dataset.kqs)return;sel.dataset.kqs="1";
  const all=[...sel.options].map(o=>({v:o.value,t:o.textContent}));
  const inp=document.createElement("input");inp.type="search";inp.placeholder="Gõ hoặc dán tên / mã sản phẩm để tìm";inp.className="kqsrch";inp.autocomplete="off";
  sel.parentNode.insertBefore(inp,sel);
  const fold=s=>(typeof kfold==="function"?kfold(s):String(s).toLowerCase());
  inp.oninput=()=>{const q=fold(inp.value).trim(),ws=q.split(/\s+/).filter(Boolean),cur=sel.value;
    const L=all.filter((o,i)=>i===0||!ws.length||ws.every(w=>fold(o.t+" "+o.v).includes(w)));
    sel.innerHTML=L.map(o=>`<option value="${esc(o.v)}">${esc(o.t)}</option>`).join("");
    const keep=L.find(o=>o.v===cur&&o.v);sel.value=keep?cur:(ws.length&&L[1]?L[1].v:"");
    if(sel.options[0])sel.options[0].textContent=ws.length?(L.length>1?`— ${L.length-1} mã khớp, chọn trong danh sách`:"— không có mã nào khớp"):all[0].t;
    sel.dispatchEvent(new Event("change",{bubbles:true}))};
}
new MutationObserver(()=>{document.querySelectorAll("select").forEach(s=>{const o=s.options[0];if(o&&!s.dataset.kqs&&/^— chọn sản phẩm/.test(o.textContent)&&s.options.length>8)kqSearchSelect(s)})}).observe(document.documentElement,{childList:true,subtree:true});

/* YÊU CẦU PHA CHẾ (chị Hoa 06/11): pha chế đi riêng, không theo phiếu sản xuất thành phẩm (pha theo bồn, làm dư).
   Thảo tạo Yêu cầu pha chế (bán thành phẩm + số lít) → giao việc + chuông cho kỹ thuật, In phiếu đưa kỹ thuật →
   kỹ thuật pha xong bấm "Nhập số thực tế" → phiếu pha chế: trừ nguyên vật liệu, cộng bán thành phẩm; yêu cầu tự xong.
   Phiếu sản xuất thành phẩm làm xong thì tự trừ bán thành phẩm, vỏ, tem theo định mức; sản phẩm bột trừ thẳng nguyên vật liệu.
   07/11: lưu ở sổ riêng trên máy chủ (bảng pc_req, phache.js), việc giao vào Công việc. */
const kqYcCan=()=>ME&&(ME.role==="admin"||(typeof mhManage==="function"&&mhManage())||(typeof sxCan==="function"&&sxCan("sx.dieuphoi")));
function kqYcCode(s,ngay){const d=ngay||(typeof sxToday==="function"?sxToday():new Date().toISOString().slice(0,10)),base="YCPC"+d.slice(2,4)+d.slice(5,7)+"-";let n=1;while((s.pcReq||[]).some(r=>r.id===base+String(n).padStart(3,"0")))n++;return base+String(n).padStart(3,"0")}
/* Mọi yêu cầu (chờ làm, đã làm, đã hủy) để danh sách giữ dấu vết; đã làm = có phiếu pha chế hiệu lực gắn mã yêu cầu. */
function kqPcAll(){
  /* 07/11: yêu cầu pha chế nằm ở sổ riêng trên máy chủ (phache.js tải về), không còn trong ngăn Sản xuất. */
  const L=typeof pchYcRows==="function"?pchYcRows():[];
  return L.slice().sort((a,b)=>(a.tt==="CHO"?0:1)-(b.tt==="CHO"?0:1)||String(b.id).localeCompare(a.id));
}
/* Người làm = người sản xuất ghi trong phiếu pha chế (nếu có), không thì người ghi phiếu. */
function kqPcWho(d){try{const ex=JSON.parse(d.extra||"{}");if(ex.nguoi&&ex.nguoi.length)return ex.nguoi.join(", ")}catch(e){}return d.created_by_name||""}
/* Hạn: đã pha thì so ngày làm với hạn (trước / đúng / trễ hạn); chưa làm thì báo quá hạn / hạn hôm nay. */
function kqHanPill(x){if(!x.han||x.tt==="HUY")return "";const t=kToday();
  if(x.tt==="XONG"){const d=x.doc.doc_date;return " "+(d<x.han?pill("Trước hạn","grn"):d===x.han?pill("Đúng hạn","blu"):pill("Trễ hạn","red"))}
  return t>x.han?" "+pill("Quá hạn","red"):t===x.han?" "+pill("Hạn hôm nay","amb"):""}
function kqPcPending(){return kqPcAll().filter(x=>x.tt==="CHO")}
async function kqPcOpen(id,print){
  if(!KHO.cat){try{await khoLoad()}catch(e){}}
  const r=kqPcAll().find(x=>x.id===id);if(!r){toast("Không tìm thấy yêu cầu "+id);return}
  khoForm("PC");const b=$("#kf-btp"),l=$("#kf-lit"),rr=$("#kf-r"),rq=$("#kf-rq");if(!b)return;
  const it=KHO.items.get(r.btp);b.value=it?it.code:r.btp;b.dataset.code=r.btp;if(rr)rr.value=r.id;if(rq&&r.lit)rq.value=r.lit;const bo=$("#kf-bon");if(bo)bo.value=r.bon||1;if(l&&r.lit){l.value=r.litBon||r.lit;l.dispatchEvent(new Event("input"))}
  if(print)setTimeout(()=>{const p=$("#kf-print");if(p)p.click()},900);
}
function kqYcForm(copy){
  const today=typeof sxToday==="function"?sxToday():new Date().toISOString().slice(0,10);
  openDrawerHTML(`<h2>Yêu cầu pha chế</h2><p class="hint">Giao kỹ thuật pha bán thành phẩm theo bồn. Kỹ thuật pha xong nhập số thực tế: trừ nguyên vật liệu, cộng bán thành phẩm.</p><form class="frm" id="ycf">
   <div class="row4"><label class="field">Ngày<input id="yc-ng" type="date" value="${today}" required></label><label class="field">Hạn cần<input id="yc-han" type="date"></label></div>
   <div class="tbl edit"><table><thead><tr><th>Bán thành phẩm (gõ hoặc dán tên, mã)</th><th style="width:150px">Số lít (1 bồn)</th><th style="width:76px"></th></tr></thead><tbody id="yc-b"></tbody></table></div>
   <label class="field">Ghi chú cho kỹ thuật<input id="yc-gc"></label><div id="yc-e"></div>
   <button class="btn pri big" id="yc-go">Tạo yêu cầu và báo kỹ thuật</button></form>`);
  const body=$("#yc-b");
  const add=after=>{const tr=document.createElement("tr");tr.innerHTML=`<td><input class="yc-i" autocomplete="off" placeholder="Gõ hoặc dán tên, mã rồi chọn"><small class="yc-n hint"></small></td><td><input class="yc-l n" type="text" inputmode="decimal"></td><td style="white-space:nowrap"><button type="button" class="btn sm yc-add">+</button> <button type="button" class="lnk yc-x">✕</button></td>`;
    if(after)after.after(tr);else body.appendChild(tr);const inp=tr.querySelector(".yc-i");
    khoPick(inp,["BTP"],it=>{inp.dataset.code=it.code;tr.querySelector(".yc-n").textContent=it.name;tr.querySelector(".yc-l").focus()});
    tr.querySelector(".yc-add").onclick=()=>add(tr);tr.querySelector(".yc-x").onclick=()=>{if(body.children.length>1)body.removeChild(tr)};
    tr.querySelector(".yc-l").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();add(tr)}};inp.focus()};
  add();
  if(copy){const tr=body.querySelector("tr"),it=KHO.items.get(copy.btp)||{};const i=tr.querySelector(".yc-i");i.value=copy.btp;i.dataset.code=copy.btp;tr.querySelector(".yc-n").textContent=it.name||"";tr.querySelector(".yc-l").value=copy.litBon||copy.lit;if(copy.ghiChu)$("#yc-gc").value=copy.ghiChu}
  $("#ycf").onsubmit=async e=>{e.preventDefault();const btn=$("#yc-go");if(btn.disabled)return;
    const L=[...body.querySelectorAll("tr")].map(tr=>{const lb=kfNum(tr.querySelector(".yc-l").value),bo=1;return {btp:tr.querySelector(".yc-i").dataset.code||"",raw:tr.querySelector(".yc-i").value.trim(),litBon:lb,bon:bo,lit:Math.round(lb*bo*1e6)/1e6}}).filter(x=>x.raw||isFinite(x.lit));
    const bad=L.filter(x=>!x.btp||!(x.lit>0));
    if(!L.length||bad.length){$("#yc-e").innerHTML=`<div class="note red">${!L.length?"Chưa có bán thành phẩm nào.":"Dòng chưa chọn bán thành phẩm trong danh sách hoặc chưa có số lít: "+bad.map(x=>esc(x.raw||"(trống)")).join(", ")}</div>`;return}
    btn.disabled=true;const ng=$("#yc-ng").value,han=$("#yc-han").value,gc=$("#yc-gc").value.trim(),codes=[];
    try{const made=await pchYcCreate({ngay:ng,han,ghi_chu:gc,items:L.map(x=>({btp:x.btp,lit_bon:x.litBon,bon:x.bon}))});made.forEach(x=>codes.push(x.id))}
    catch(err){btn.disabled=false;$("#yc-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`;return}
    let note="";try{const n=pchYcTasks(codes.map((id,k)=>({id,btp:L[k].btp,lit:L[k].lit,han,ghi_chu:gc})));const r=await kApi("/pc-notify",{method:"POST",body:JSON.stringify({items:L.map((x,k)=>({psx:codes[k],name:(KHO.items.get(x.btp)||{}).name||x.btp,sl:knum(x.lit)+" lít",han:han?kDd(han):"",han_iso:han||""}))})});note=n?`Đã giao việc vào Công việc của kỹ thuật pha chế (${n} việc) và báo chuông.`:"Chưa có tài khoản riêng của kỹ thuật pha chế (quyền Kỹ thuật pha chế) nên chưa giao việc được. In phiếu đưa kỹ thuật ở nút bên dưới.";void r}catch(err){note="Chưa báo được kỹ thuật: "+err.message}
    renderMain();
    openDrawerHTML(`<h2>Đã tạo ${codes.length} yêu cầu pha chế</h2><div id="yc-short"></div><div class="note ${/Chưa/.test(note)?"amb":"grn"}">${esc(note)}</div>${tbl(["Yêu cầu","Bán thành phẩm","Số lít",""],L.map((x,k)=>`<tr><td class="mono">${esc(codes[k])}</td><td>${esc((KHO.items.get(x.btp)||{}).name||x.btp)}</td><td class="n">${knum(x.lit)}</td><td><button class="btn sm pri" data-ycp="${esc(codes[k])}">In phiếu pha chế</button></td></tr>`))}`);
    document.querySelectorAll("#drawer [data-ycp]").forEach(b=>b.onclick=()=>kqPcOpen(b.dataset.ycp,true));
    kqShortCheck(codes.join(", "),L.map(x=>[x.btp,x.lit]),"yc-short")};
}
{const _pc=PAGES.kho_pc;if(_pc)PAGES.kho_pc=function(m){const r=_pc.apply(this,arguments);try{
  if(KQ_ADM())return r;{const kn=m.querySelector("#kho-new");if(kn&&kqYcCan()&&!m.querySelector("#yc-new"))kn.insertAdjacentHTML("beforebegin",`<button class="btn pri" id="yc-new">+ Yêu cầu pha chế</button> `);if(!kn&&kqYcCan()){const a=m.querySelector(".stepact,.kact,.sxact");if(a&&!m.querySelector("#yc-new"))a.insertAdjacentHTML("afterbegin",`<button class="btn pri" id="yc-new">+ Yêu cầu pha chế</button>`)}if(kn){kn.classList.remove("pri");kn.textContent="+ Phiếu pha không theo yêu cầu";kn.title="Kỹ thuật tự pha (không có yêu cầu pha chế): ghi số thực tế, trừ nguyên vật liệu, cộng bán thành phẩm"}}const P=kqPcPending(),ALL=kqPcAll();
  const card=document.createElement("section");card.className="card flush";card.style.marginBottom="12px";
  card.innerHTML=`<div class="card-h pad"><h2>Yêu cầu pha chế · ${P.length} chờ làm</h2><span class="hint">Quản lý mua hàng tạo yêu cầu → Kỹ thuật pha chế nhận ở Công việc → pha xong ghi số thực tế</span></div>`+(ALL.length?tbl(["Yêu cầu","Ngày","Bán thành phẩm","Số lít","Hạn","Người tạo","Người làm","Ngày làm","Trạng thái","","",""],ALL.map(x=>{const cho=x.tt==="CHO";return `<tr data-rm="1" class="clk" data-ycd="${esc(x.id)}" title="Bấm để xem chi tiết"${x.tt==="HUY"?' style="opacity:.6"':""}><td class="mono">${esc(x.id)}</td><td>${kDd(x.taoLuc)}</td><td><b>${esc((KHO.items.get(x.btp)||{}).name||x.btp)}</b>${x.ghiChu?`<small class="hint" style="display:block">${esc(x.ghiChu)}</small>`:""}</td><td class="n">${knum(x.lit)}${x.bon>1?`<small class="hint" style="display:block">${knum(x.bon)} bồn × ${knum(x.litBon)}</small>`:""}</td><td>${x.han?kDd(x.han):"—"}</td><td>${esc(x.tao||"")}</td><td>${x.doc?esc(kqPcWho(x.doc)):"—"}</td><td>${x.doc?kDd(x.doc.doc_date):"—"}</td><td>${x.tt==="HUY"?pill("Đã hủy","gry"):x.tt==="XONG"?pill("Đã pha","grn")+kqHanPill(x)+`<small class="hint" style="display:block"><a href="#" class="lnk" data-pcd="${x.doc.id}">${esc(x.doc.no)}</a> · ${esc(x.doc.created_by_name||"")}</small>`:pill("Chờ làm","amb")+kqHanPill(x)}</td><td>${cho?`<button class="btn sm" data-pcp="${esc(x.id)}">In phiếu</button>`:""}</td><td>${cho?`<button class="btn sm pri" data-pcn="${esc(x.id)}">Ghi số thực tế</button>`:""}</td><td>${kqYcCan()?`<button type="button" class="btn sm" data-ycm="${esc(x.id)}" data-cho="${cho?1:0}" title="Sửa, sao chép, hủy">⋯</button>`:""}</td></tr>`})):`<p class="hint pad">Chưa có yêu cầu pha chế nào.</p>`);
  const first=m.querySelector("section.card");if(first)first.before(card);else m.appendChild(card);
  card.querySelectorAll("[data-pcp]").forEach(b=>b.onclick=()=>kqPcOpen(b.dataset.pcp,true));
  card.querySelectorAll("[data-pcd]").forEach(a=>a.onclick=e=>{e.preventDefault();khoOpenDoc(+a.dataset.pcd)});
  card.querySelectorAll("[data-pcn]").forEach(b=>b.onclick=()=>kqPcOpen(b.dataset.pcn,false));
  if($("#yc-new"))$("#yc-new").onclick=()=>kqYcForm();
  card.querySelectorAll("tr[data-ycd]").forEach(tr=>tr.onclick=e=>{if(e.target.closest("button,a"))return;kqYcDetail(tr.dataset.ycd)});
  /* Nút ⋯ gom Sửa, Sao chép, Hủy yêu cầu vào một menu (chị Hoa 06/11). */
  card.querySelectorAll("[data-ycm]").forEach(b=>b.onclick=e=>{e.stopPropagation();const old=document.querySelector(".rmpop"),mine=old&&old._src===b;if(old)old.remove();if(mine)return;
    const id=b.dataset.ycm,cho=b.dataset.cho==="1",r=b.getBoundingClientRect(),pop=document.createElement("div");pop.className="rmpop";pop._src=b;
    const items=[cho?["Sửa",()=>kqYcEdit(id)]:null,["Sao chép",()=>{const x=kqPcAll().find(y=>y.id===id);if(x)kqYcForm(x)}],cho?["Hủy yêu cầu",()=>kqYcCancel(id),"dg"]:null].filter(Boolean);
    items.forEach(([t,f,c])=>{const it=document.createElement("button");it.type="button";it.textContent=t;if(c)it.className=c;it.onclick=ev=>{ev.stopPropagation();pop.remove();f()};pop.appendChild(it)});
    pop.style.top=Math.min(r.bottom+4,innerHeight-(items.length*38+16))+"px";pop.style.right=Math.max(8,innerWidth-r.right)+"px";document.body.appendChild(pop);
    setTimeout(()=>document.addEventListener("click",()=>{if(pop.isConnected)pop.remove()},{once:true}),0)});
}catch(e){}return r}}

/* Sửa / hủy yêu cầu pha chế chưa làm (chị Hoa 06/11). Hủy thì việc của kỹ thuật cũng xong theo. */
function kqYcEdit(id){
  const r=kqPcAll().find(x=>x.id===id);if(!r)return;const it=KHO.items.get(r.btp)||{};
  openDrawerHTML(`<h2>Sửa yêu cầu ${esc(id)}</h2><form class="frm" id="yce"><label class="field">Bán thành phẩm<input id="yce-b" value="${esc(r.btp)}" data-code="${esc(r.btp)}" autocomplete="off"><small class="hint" id="yce-n">${esc(it.name||"")}</small></label>
   <div class="row4"><label class="field">Số lít (1 bồn)<input id="yce-l" inputmode="decimal" value="${esc(String(r.litBon||r.lit))}"></label></div>
   <div class="row4"><label class="field">Hạn cần<input id="yce-h" type="date" value="${esc(r.han||"")}"></label></div>
   <label class="field">Ghi chú cho kỹ thuật<input id="yce-g" value="${esc(r.ghiChu||"")}"></label><div id="yce-e"></div><button class="btn pri">Lưu</button></form>`);
  khoPick($("#yce-b"),["BTP"],p=>{$("#yce-b").dataset.code=p.code;$("#yce-n").textContent=p.name});
  $("#yce").onsubmit=e=>{e.preventDefault();const btp=$("#yce-b").dataset.code,lb=kfNum($("#yce-l").value),bo=1;
    if(!btp||!(lb>0)){$("#yce-e").innerHTML=`<div class="note red">Chọn bán thành phẩm và số lít / bồn.</div>`;return}
    pApi("/yc/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({btp,lit_bon:lb,bon:bo,han:$("#yce-h").value,ghi_chu:$("#yce-g").value.trim()})})
      .then(()=>{pchYcTaskEdit(id,{btp,lit:Math.round(lb*bo*1e6)/1e6,han:$("#yce-h").value});closeDrawer();toast("Đã lưu "+id);pchLoadYc(true).then(pchRerender)})
      .catch(err=>{$("#yce-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`})};
}
function kqYcCancel(id){
  const ly=(prompt("Lý do hủy yêu cầu pha chế "+id+":")||"").trim();if(!ly)return;
  pApi("/yc/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({huy:true,ly_do:ly})})
    .then(()=>{pchTaskDone(t=>t.pcYc===id,"Yêu cầu đã hủy: "+ly);toast("Đã hủy "+id);pchLoadYc(true).then(pchRerender)})
    .catch(err=>toast(err.message));
}

/* Bấm một dòng: xem chi tiết yêu cầu pha chế (ai tạo, ai làm, ngày, hạn, trạng thái, lý do hủy, phiếu pha chế). */
function kqYcDetail(id){
  const x=kqPcAll().find(y=>y.id===id);if(!x)return;const it=KHO.items.get(x.btp)||{};
  const st=x.tt==="HUY"?pill("Đã hủy","gry"):x.tt==="XONG"?pill("Đã pha","grn"):pill("Chờ làm","amb");
  const rows=[["Bán thành phẩm",esc(it.name||x.btp)+` <small class="hint mono">${esc(x.btp)}</small>`],["Số lít (1 bồn)",knum(x.litBon||x.lit)+(x.bon>1?` <small class="hint">(${knum(x.bon)} bồn = ${knum(x.lit)} lít)</small>`:"")],["Ngày tạo",kDd(x.taoLuc)],["Hạn cần",x.han?kDd(x.han):"—"],["Người tạo",esc(x.tao||"")],["Ghi chú",esc(x.ghiChu||"—")],["Trạng thái",st+kqHanPill(x)]];
  if(x.tt==="HUY")rows.push(["Người hủy",esc(x.huyBy||"—")],["Lý do hủy",esc(x.lyDoHuy||"—")]);
  if(x.doc)rows.push(["Phiếu pha chế",`<a href="#" class="lnk" id="ycd-doc">${esc(x.doc.no)}</a>`],["Người làm",esc(kqPcWho(x.doc))],["Ngày làm",kDd(x.doc.doc_date)]);
  openDrawerHTML(`<h2>Yêu cầu pha chế ${esc(id)}</h2>${tbl(["",""],rows.map(([a,b])=>`<tr><td style="width:150px;color:#7a8199">${a}</td><td>${b}</td></tr>`))}`);
  const d=document.getElementById("ycd-doc");if(d)d.onclick=e=>{e.preventDefault();khoOpenDoc(x.doc.id)};
}

/* Kiểm vật tư đủ chưa khi tạo yêu cầu pha chế / phiếu sản xuất (chị Hoa 06/11): định mức × số lượng so với tồn hiện tại.
   Thiếu thì hiện cảnh báo ngay và giao việc cho người phụ trách mua hàng. */
async function kqShortage(pairs){
  pairs=pairs.filter(([c,q])=>c&&q>0);if(!pairs.length)return [];const need=new Map();
  (await khoExpand(pairs)).forEach(([,,rows])=>(rows||[]).forEach(b=>need.set(b.item,(need.get(b.item)||0)+(+b.need||0))));
  return [...need].map(([c,n])=>{const it=KHO.items.get(c)||{},t=khoStock(c);return {item:c,name:it.name||c,unit:it.unit||"",need:Math.round(n*1e6)/1e6,ton:t,thieu:Math.round((n-Math.max(t,0))*1e6)/1e6}}).filter(x=>x.thieu>1e-9);
}
function kqShortHtml(sh){return sh.length?`<div class="note red"><b>Tồn kho không đủ vật tư:</b>${tbl(["Vật tư","Cần","Tồn","Thiếu"],sh.map(x=>`<tr><td>${esc(x.name)}<small class="hint mono" style="display:block">${esc(x.item)}</small></td><td class="n">${knum(x.need)} ${esc(x.unit)}</td><td class="n">${knum(x.ton)}</td><td class="n"><b>${knum(x.thieu)}</b></td></tr>`))}<small>Đã giao việc cho phụ trách mua hàng (đặt hàng hoặc kiểm tra tồn lệch ở đâu) và nhắc kỹ thuật pha chế.</small></div>`:""}
/* Sau khi tạo: tính thiếu, có thiếu thì hiện cảnh báo (vào ô có sẵn hoặc mở khung mới) và giao việc. */
async function kqShortCheck(ref,pairs,slot,title){try{const sh=await kqShortage(pairs);if(!sh.length)return;kqShortTask(ref,sh);
  const el=slot&&document.getElementById(slot);if(el)el.innerHTML=kqShortHtml(sh);else openDrawerHTML(`<h2>${esc(title||"Thiếu vật tư")}</h2>${kqShortHtml(sh)}`)}catch(e){}}
function kqShortTask(ref,sh){kApi("/shortage-task",{method:"POST",body:JSON.stringify({ref,lines:sh.map(x=>({item:x.item,name:x.name,unit:x.unit,thieu:x.thieu}))})}).catch(()=>{})}
