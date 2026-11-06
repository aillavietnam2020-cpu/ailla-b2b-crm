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
   Lưu trong ngăn Sản xuất (SX().pcReq). */
const kqYcCan=()=>ME&&(ME.role==="admin"||(typeof mhManage==="function"&&mhManage())||(typeof sxCan==="function"&&sxCan("sx.dieuphoi")));
function kqYcCode(s,ngay){const d=ngay||(typeof sxToday==="function"?sxToday():new Date().toISOString().slice(0,10)),base="YCPC"+d.slice(2,4)+d.slice(5,7)+"-";let n=1;while((s.pcReq||[]).some(r=>r.id===base+String(n).padStart(3,"0")))n++;return base+String(n).padStart(3,"0")}
/* Mọi yêu cầu (chờ làm, đã làm, đã hủy) để danh sách giữ dấu vết; đã làm = có phiếu pha chế hiệu lực gắn mã yêu cầu. */
function kqPcAll(){
  let L=[];try{L=(SX().pcReq||[]).slice()}catch(e){}
  const rows=(KHO.list&&KHO.list.PC&&KHO.list.PC.rows)||[],doc=new Map(rows.filter(d=>d.status==="OK"&&d.ref_no).map(d=>[d.ref_no,d]));
  return L.map(r=>({...r,doc:doc.get(r.id)||null,tt:r.st==="HUY"?"HUY":doc.get(r.id)?"XONG":"CHO"})).sort((a,b)=>(a.tt==="CHO"?0:1)-(b.tt==="CHO"?0:1)||String(b.id).localeCompare(a.id));
}
function kqPcPending(){
  let L=[];try{L=(SX().pcReq||[]).filter(r=>r.st!=="HUY")}catch(e){}
  const rows=(KHO.list&&KHO.list.PC&&KHO.list.PC.rows)||[],done=new Set(rows.filter(d=>d.status==="OK"&&d.ref_no).map(d=>d.ref_no));
  return L.filter(r=>!done.has(r.id));
}
async function kqPcOpen(id,print){
  if(!KHO.cat){try{await khoLoad()}catch(e){}}
  const r=(SX().pcReq||[]).find(x=>x.id===id);if(!r){toast("Không tìm thấy yêu cầu "+id);return}
  khoForm("PC");const b=$("#kf-btp"),l=$("#kf-lit"),rr=$("#kf-r"),rq=$("#kf-rq");if(!b)return;
  const it=KHO.items.get(r.btp);b.value=it?it.code:r.btp;b.dataset.code=r.btp;if(rr)rr.value=r.id;if(rq&&r.lit)rq.value=r.lit;const bo=$("#kf-bon");if(bo)bo.value=r.bon||1;if(l&&r.lit){l.value=r.litBon||r.lit;l.dispatchEvent(new Event("input"))}
  if(print)setTimeout(()=>{const p=$("#kf-print");if(p)p.click()},900);
}
function kqYcForm(){
  const today=typeof sxToday==="function"?sxToday():new Date().toISOString().slice(0,10);
  openDrawerHTML(`<h2>Yêu cầu pha chế</h2><p class="hint">Giao kỹ thuật pha bán thành phẩm theo bồn. Kỹ thuật pha xong nhập số thực tế: trừ nguyên vật liệu, cộng bán thành phẩm.</p><form class="frm" id="ycf">
   <div class="row4"><label class="field">Ngày<input id="yc-ng" type="date" value="${today}" required></label><label class="field">Hạn cần<input id="yc-han" type="date"></label></div>
   <div class="tbl edit"><table><thead><tr><th>Bán thành phẩm (gõ hoặc dán tên, mã)</th><th style="width:130px">Số lít / bồn</th><th style="width:100px">Số bồn</th><th style="width:110px">Tổng lít</th><th style="width:76px"></th></tr></thead><tbody id="yc-b"></tbody></table></div>
   <label class="field">Ghi chú cho kỹ thuật<input id="yc-gc"></label><div id="yc-e"></div>
   <button class="btn pri big" id="yc-go">Tạo yêu cầu và báo kỹ thuật</button></form>`);
  const body=$("#yc-b");
  const add=after=>{const tr=document.createElement("tr");tr.innerHTML=`<td><input class="yc-i" autocomplete="off" placeholder="Gõ hoặc dán tên, mã rồi chọn"><small class="yc-n hint"></small></td><td><input class="yc-l n" type="text" inputmode="decimal"></td><td><input class="yc-bo n" type="text" inputmode="decimal" value="1"></td><td class="n yc-t"></td><td style="white-space:nowrap"><button type="button" class="btn sm yc-add">+</button> <button type="button" class="lnk yc-x">✕</button></td>`;
    if(after)after.after(tr);else body.appendChild(tr);const inp=tr.querySelector(".yc-i");
    khoPick(inp,["BTP"],it=>{inp.dataset.code=it.code;tr.querySelector(".yc-n").textContent=it.name;tr.querySelector(".yc-l").focus()});
    tr.querySelector(".yc-add").onclick=()=>add(tr);tr.querySelector(".yc-x").onclick=()=>{if(body.children.length>1)body.removeChild(tr)};
    const tot=()=>{const v=kfNum(tr.querySelector(".yc-l").value)*(kfNum(tr.querySelector(".yc-bo").value)||1);tr.querySelector(".yc-t").textContent=v>0?knum(Math.round(v*1e6)/1e6):""};tr.querySelector(".yc-l").oninput=tot;tr.querySelector(".yc-bo").oninput=tot;
    tr.querySelector(".yc-l").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();add(tr)}};inp.focus()};
  add();
  $("#ycf").onsubmit=async e=>{e.preventDefault();const btn=$("#yc-go");if(btn.disabled)return;
    const L=[...body.querySelectorAll("tr")].map(tr=>{const lb=kfNum(tr.querySelector(".yc-l").value),bo=kfNum(tr.querySelector(".yc-bo").value)||1;return {btp:tr.querySelector(".yc-i").dataset.code||"",raw:tr.querySelector(".yc-i").value.trim(),litBon:lb,bon:bo,lit:Math.round(lb*bo*1e6)/1e6}}).filter(x=>x.raw||isFinite(x.lit));
    const bad=L.filter(x=>!x.btp||!(x.lit>0));
    if(!L.length||bad.length){$("#yc-e").innerHTML=`<div class="note red">${!L.length?"Chưa có bán thành phẩm nào.":"Dòng chưa chọn bán thành phẩm trong danh sách hoặc chưa có số lít: "+bad.map(x=>esc(x.raw||"(trống)")).join(", ")}</div>`;return}
    btn.disabled=true;const ng=$("#yc-ng").value,han=$("#yc-han").value,gc=$("#yc-gc").value.trim(),codes=[];
    sxMut(`tạo ${L.length} yêu cầu pha chế`,s2=>{s2.pcReq=s2.pcReq||[];L.forEach(x=>{const id=kqYcCode(s2,ng);codes.push(id);s2.pcReq.push({id,btp:x.btp,lit:x.lit,litBon:x.litBon,bon:x.bon,han,ghiChu:gc,taoLuc:ng,tao:ME.name,st:"CHO_LAM",at:typeof sxNow==="function"?sxNow():new Date().toISOString()})})});
    let note="";try{const r=await kApi("/pc-notify",{method:"POST",body:JSON.stringify({items:L.map((x,k)=>({psx:codes[k],name:(KHO.items.get(x.btp)||{}).name||x.btp,sl:(x.bon>1?knum(x.bon)+" bồn × "+knum(x.litBon)+" = ":"")+knum(x.lit)+" lít",han:han?kDd(han):""}))})});note=r.no_kythuat?"Chưa có tài khoản riêng của kỹ thuật pha chế nên chưa giao việc được. In phiếu đưa kỹ thuật ở nút bên dưới.":`Đã giao việc và báo chuông cho kỹ thuật (${r.sent} yêu cầu).`}catch(err){note="Chưa báo được kỹ thuật: "+err.message}
    renderMain();
    openDrawerHTML(`<h2>Đã tạo ${codes.length} yêu cầu pha chế</h2><div class="note ${/Chưa/.test(note)?"amb":"grn"}">${esc(note)}</div>${tbl(["Yêu cầu","Bán thành phẩm","Số lít",""],L.map((x,k)=>`<tr><td class="mono">${esc(codes[k])}</td><td>${esc((KHO.items.get(x.btp)||{}).name||x.btp)}</td><td class="n">${knum(x.lit)}</td><td><button class="btn sm pri" data-ycp="${esc(codes[k])}">In phiếu pha chế</button></td></tr>`))}`);
    document.querySelectorAll("#drawer [data-ycp]").forEach(b=>b.onclick=()=>kqPcOpen(b.dataset.ycp,true))};
}
{const _pc=PAGES.kho_pc;if(_pc)PAGES.kho_pc=function(m){const r=_pc.apply(this,arguments);try{
  if(KQ_ADM())return r;{const kn=m.querySelector("#kho-new");if(kn){kn.textContent="+ Phiếu pha không theo yêu cầu";kn.title="Kỹ thuật tự pha (không có yêu cầu pha chế): ghi số thực tế, trừ nguyên vật liệu, cộng bán thành phẩm"}}const P=kqPcPending(),ALL=kqPcAll();
  const card=document.createElement("section");card.className="card flush";card.style.marginBottom="12px";
  card.innerHTML=`<div class="card-h pad"><h2>Yêu cầu pha chế · ${P.length} chờ làm</h2><span class="hint">Thảo tạo yêu cầu → kỹ thuật pha → nhập số thực tế</span>${kqYcCan()?`<button class="btn pri" id="yc-new">+ Yêu cầu pha chế</button>`:""}</div>`+(ALL.length?tbl(["Yêu cầu","Ngày","Bán thành phẩm","Số lít","Hạn","Người tạo","Trạng thái","","",""],ALL.map(x=>{const cho=x.tt==="CHO";return `<tr${x.tt==="HUY"?' style="opacity:.6"':""}><td class="mono">${esc(x.id)}</td><td>${kDd(x.taoLuc)}</td><td><b>${esc((KHO.items.get(x.btp)||{}).name||x.btp)}</b>${x.ghiChu?`<small class="hint" style="display:block">${esc(x.ghiChu)}</small>`:""}</td><td class="n">${knum(x.lit)}${x.bon>1?`<small class="hint" style="display:block">${knum(x.bon)} bồn × ${knum(x.litBon)}</small>`:""}</td><td>${x.han?kDd(x.han):"—"}</td><td>${esc(x.tao||"")}</td><td>${x.tt==="HUY"?pill("Đã hủy","gry")+`<small class="hint" style="display:block">${esc(x.huyBy||"")}${x.lyDoHuy?": "+esc(x.lyDoHuy):""}</small>`:x.tt==="XONG"?pill("Đã pha","grn")+`<small class="hint" style="display:block"><a href="#" class="lnk" data-pcd="${x.doc.id}">${esc(x.doc.no)}</a> · ${esc(x.doc.created_by_name||"")}</small>`:pill("Chờ làm","amb")}</td><td>${cho?`<button class="btn sm" data-pcp="${esc(x.id)}">In phiếu</button>`:""}</td><td>${cho?`<button class="btn sm pri" data-pcn="${esc(x.id)}">Nhập số thực tế</button>`:""}</td><td>${cho&&kqYcCan()?`<button class="lnk" data-yce="${esc(x.id)}">Sửa</button> <button class="lnk" data-ycx="${esc(x.id)}">Hủy yêu cầu</button>`:""}</td></tr>`})):`<p class="hint pad">Chưa có yêu cầu pha chế nào.</p>`);
  const first=m.querySelector("section.card");if(first)first.before(card);else m.appendChild(card);
  card.querySelectorAll("[data-pcp]").forEach(b=>b.onclick=()=>kqPcOpen(b.dataset.pcp,true));
  card.querySelectorAll("[data-pcd]").forEach(a=>a.onclick=e=>{e.preventDefault();khoOpenDoc(+a.dataset.pcd)});
  card.querySelectorAll("[data-pcn]").forEach(b=>b.onclick=()=>kqPcOpen(b.dataset.pcn,false));
  if($("#yc-new"))$("#yc-new").onclick=()=>kqYcForm();
  card.querySelectorAll("[data-yce]").forEach(b=>b.onclick=()=>kqYcEdit(b.dataset.yce));
  card.querySelectorAll("[data-ycx]").forEach(b=>b.onclick=()=>kqYcCancel(b.dataset.ycx));
  if(typeof rowMenus==="function")rowMenus(card);
}catch(e){}return r}}

/* Sửa / hủy yêu cầu pha chế chưa làm (chị Hoa 06/11). Hủy thì việc của kỹ thuật cũng xong theo. */
function kqYcEdit(id){
  const r=(SX().pcReq||[]).find(x=>x.id===id);if(!r)return;const it=KHO.items.get(r.btp)||{};
  openDrawerHTML(`<h2>Sửa yêu cầu ${esc(id)}</h2><form class="frm" id="yce"><label class="field">Bán thành phẩm<input id="yce-b" value="${esc(r.btp)}" data-code="${esc(r.btp)}" autocomplete="off"><small class="hint" id="yce-n">${esc(it.name||"")}</small></label>
   <div class="row4"><label class="field">Số lít / bồn<input id="yce-l" inputmode="decimal" value="${esc(String(r.litBon||r.lit))}"></label><label class="field">Số bồn<input id="yce-bo" inputmode="decimal" value="${esc(String(r.bon||1))}"></label></div>
   <div class="row4"><label class="field">Hạn cần<input id="yce-h" type="date" value="${esc(r.han||"")}"></label></div>
   <label class="field">Ghi chú cho kỹ thuật<input id="yce-g" value="${esc(r.ghiChu||"")}"></label><div id="yce-e"></div><button class="btn pri">Lưu</button></form>`);
  khoPick($("#yce-b"),["BTP"],p=>{$("#yce-b").dataset.code=p.code;$("#yce-n").textContent=p.name});
  $("#yce").onsubmit=e=>{e.preventDefault();const btp=$("#yce-b").dataset.code,lb=kfNum($("#yce-l").value),bo=kfNum($("#yce-bo").value)||1;
    if(!btp||!(lb>0)){$("#yce-e").innerHTML=`<div class="note red">Chọn bán thành phẩm và số lít / bồn.</div>`;return}
    sxMut("sửa yêu cầu pha chế "+id,s2=>{const x=(s2.pcReq||[]).find(y=>y.id===id);if(!x)return;Object.assign(x,{btp,litBon:lb,bon:bo,lit:Math.round(lb*bo*1e6)/1e6,han:$("#yce-h").value,ghiChu:$("#yce-g").value.trim()})});
    closeDrawer();toast("Đã lưu "+id);renderMain()};
}
function kqYcCancel(id){
  const ly=(prompt("Lý do hủy yêu cầu pha chế "+id+":")||"").trim();if(!ly)return;
  sxMut("hủy yêu cầu pha chế "+id,s2=>{const x=(s2.pcReq||[]).find(y=>y.id===id);if(x){x.st="HUY";x.lyDoHuy=ly;x.huyBy=ME.name}});
  kApi("/pc-task-close",{method:"POST",body:JSON.stringify({id})}).catch(()=>{});
  toast("Đã hủy "+id);renderMain();
}
