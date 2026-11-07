/* =====================================================================
   PHA CHẾ (chị Hoa duyệt demo 07/11/2026)
   - Yêu cầu pha chế ở sổ riêng trên máy chủ (/api/hub/phache/yc). Tạo yêu cầu → việc vào Công việc của Kỹ thuật pha chế
     (bản chung D().tasks, loại "Pha chế", t.pcYc = mã yêu cầu). Mở việc có nút "Ghi số thực tế" → phiếu pha chế; ghi xong việc tự xong.
   - Công thức của Kỹ thuật (cho 1 lít BTP) + hướng dẫn pha. Phiếu pha chế lấy định lượng theo công thức đang dùng (kho.js fill).
     Kỹ thuật lập / điều chỉnh (bắt buộc lý do) → việc "Duyệt công thức" cho Trưởng kỹ thuật (quyền sx.congthuc);
     Trưởng kỹ thuật / CEO tự nhập thì dùng ngay. Lịch sử giữ đủ bản.
   - Báo tồn: Kỹ thuật đếm nguyên liệu. Dưới mức đặt mua (min_stock) → việc "Đặt hàng" cho Quản lý mua hàng;
     số đếm khác sổ → việc "Lệch kho cần kiểm tra" cho Quản lý mua hàng + Kỹ thuật. Không sửa sổ kho.
     Mã web thấy sắp hết → việc "Kiểm nguyên liệu sắp hết" cho Kỹ thuật.
   - Hao hụt: theo mẻ / người pha / nguyên liệu; ai lệch quá 5% từ 3 mẻ trong tháng → việc báo Trưởng kỹ thuật.
   Tên toàn cục bắt đầu bằng "pch".
   ===================================================================== */
const pApi=(p,o)=>svApi("/api/hub/phache"+p,o);
const PCH={yc:null,ycAt:0,ycBusy:null,ct:null,ctAt:0,ctOk:false,ctBusy:null,tab:"yc",dem:{},q:"",all:false,kq:null,ton:null,tonBusy:false,hh:null,hhKey:"",hhView:"me",kiemDay:"",err:""};
const PCH_TOL=5;
function pchRerender(){if(typeof svTyping==="function"&&svTyping())return;if(document.querySelector("#drawer:not([hidden])"))return;if(typeof renderMain==="function")renderMain()}
const pchName=c=>(typeof KHO!=="undefined"&&KHO.items&&KHO.items.get(c)||{}).name||c;
const pchUnit=c=>(typeof KHO!=="undefined"&&KHO.items&&KHO.items.get(c)||{}).unit||"";
const pchAdm=()=>!!ME&&ME.role==="admin";

/* ---------- Tải dữ liệu ---------- */
function pchLoadYc(force){
  if(!force&&PCH.yc&&Date.now()-PCH.ycAt<60000)return Promise.resolve(PCH.yc);
  if(PCH.ycBusy&&!force)return PCH.ycBusy;
  PCH.ycBusy=pApi("/yc").then(r=>{PCH.yc=r||[];PCH.ycAt=Date.now();PCH.ycBusy=null;return PCH.yc}).catch(e=>{PCH.ycBusy=null;PCH.err=e.message;throw e});
  return PCH.ycBusy;
}
function pchLoadCt(force){
  if(!force&&PCH.ct&&Date.now()-PCH.ctAt<60000)return Promise.resolve(PCH.ct);
  if(PCH.ctBusy&&!force)return PCH.ctBusy;
  PCH.ctBusy=pApi("/ct").then(r=>{PCH.ct=(r&&r.rows)||[];PCH.ctOk=!!(r&&r.can_approve);PCH.ctAt=Date.now();PCH.ctBusy=null;return PCH.ct}).catch(e=>{PCH.ctBusy=null;throw e});
  return PCH.ctBusy;
}
/* Yêu cầu theo dạng cũ khonhanh.js đang dùng (kqPcAll). Chưa tải thì tải rồi vẽ lại. */
function pchYcRows(){
  if(!PCH.yc){pchLoadYc().then(pchRerender).catch(()=>{});return []}
  return PCH.yc.map(r=>{const doc=r.doc_id?{id:r.doc_id,no:r.doc_no,doc_date:r.doc_date,extra:r.doc_extra,created_by_name:r.doc_by}:null;
    return {id:r.id,btp:r.btp,lit:r.lit,litBon:r.lit_bon||r.lit,bon:r.bon||1,han:r.han||"",ghiChu:r.ghi_chu||"",taoLuc:r.ngay,tao:r.created_by_name,st:r.status==="HUY"?"HUY":"CHO_LAM",lyDoHuy:r.ly_do_huy,huyBy:r.huy_by_name,doc,tt:r.status==="HUY"?"HUY":doc?"XONG":"CHO"}});
}
async function pchYcCreate(b){const r=await pApi("/yc",{method:"POST",body:JSON.stringify(b)});await pchLoadYc(true).catch(()=>{});return r}
/* Công thức đang dùng của một bán thành phẩm (null nếu chưa có). */
function pchCt(btp){return (PCH.ct||[]).find(r=>r.btp===btp&&r.status==="OK")||null}

/* ---------- Người nhận việc ---------- */
const pchUsers=()=>{try{return (D().users||[]).filter(u=>u&&u.active!==false)}catch(e){return []}};
/* Kỹ thuật pha chế: có quyền sx.kythuat, không phải điều phối / kế toán kho (CEO, kế toán cũng có sẵn quyền này). Người làm chính trước, Trưởng kỹ thuật sau. */
function pchKyThuat(){return pchUsers().filter(u=>u.role!=="admin"&&can(u,"sx.kythuat")&&!can(u,"sx.dieuphoi")&&!can(u,"sx.kiemke")).sort((a,b)=>can(a,"sx.congthuc")-can(b,"sx.congthuc"))}
function pchTruongKT(){const L=pchUsers().filter(u=>u.role!=="admin"&&can(u,"sx.congthuc"));return L.length?L:pchUsers().filter(u=>u.role==="admin")}
/* Quản lý mua hàng: người duyệt đơn / mua hàng ở máy chủ (không tính CEO), đổi sang người dùng web chung qua users[].crm. Chưa có ai thì về CEO. */
function pchLoadNguoi(){if(PCH.ng)return Promise.resolve(PCH.ng);return pApi("/nguoi").then(r=>{PCH.ng=r||{};return PCH.ng})}
function pchMuaHang(){const ids=new Set((PCH.ng&&PCH.ng.mua_hang)||[]);const L=pchUsers().filter(u=>u.role!=="admin"&&u.crm&&ids.has(u.crm));return L.length?L:pchUsers().filter(u=>u.role==="admin")}
const pchMeKT=()=>!!ME&&(can(ME,"sx.kythuat")||can(ME,"sx.congthuc"))&&ME.role!=="admin";
/* Hạn của việc trong Công việc là số ngày trong tháng đang mở. Hạn sang tháng sau thì để cuối tháng. */
function pchHan(iso){const td=D().settings.today;if(!iso)return td;const k=iso.slice(0,7);if(k===MONTH.key)return +iso.slice(8,10);return k<MONTH.key?td:MONTH.ndays}

/* ---------- Việc trong Công việc ---------- */
function pchNewTask(dt,o){
  dt.tasks=dt.tasks||[];
  const x=Object.assign({id:uid("tk"),ten:o.ten,moTa:o.moTa||"",team:"sx",da:"",nguoi:o.nguoi,phoi:(o.phoi||[]).filter((id,i,a)=>id&&id!==o.nguoi&&a.indexOf(id)===i),han:o.han,bd:0,uu:o.uu||"Cao",gap:false,st:"todo",checklist:[],files:[],loai:o.loai||"Pha chế",tao:ME.id},o.extra||{});
  if(typeof tkLog==="function")tkLog(x,ME.name+" "+(o.log||"giao việc"));
  dt.tasks.push(x);
  if(typeof notifyU==="function")notifyU(dt,[x.nguoi,...x.phoi],o.bell||("Việc mới: "+x.ten),"task:"+x.id);
  return x;
}
const pchOpenTasks=pred=>{try{return (D().tasks||[]).filter(t=>t.st!=="done"&&pred(t))}catch(e){return []}};
function pchTaskDone(pred,note){pchOpenTasks(pred).forEach(t=>{if(typeof tkSetSt==="function")tkSetSt(t.id,"done",{},note||"")})}
/* Yêu cầu mới → mỗi yêu cầu một việc cho Kỹ thuật pha chế (người làm chính + phối hợp). Trả về số việc đã giao. */
function pchYcTasks(list){
  const K=pchKyThuat();if(!K.length||!list.length)return 0;const [a,...rest]=K;
  DB.mutate(ME.name,"giao "+list.length+" việc pha chế",dt=>list.forEach(y=>{const nm=pchName(y.btp);
    pchNewTask(dt,{ten:`Pha ${nm} · ${knum(y.lit)} lít`,moTa:`Yêu cầu pha chế ${y.id}${y.han?" · hạn "+kDd(y.han):""}${y.ghi_chu?"\nGhi chú: "+y.ghi_chu:""}\nPha xong bấm "Ghi số thực tế" ngay trong việc này.`,
      nguoi:a.id,phoi:rest.map(u=>u.id),han:pchHan(y.han),extra:{pcYc:y.id},log:"giao việc pha chế "+y.id,bell:`Việc pha chế mới: ${nm} · ${knum(y.lit)} lít${y.han?" · hạn "+kDd(y.han):""}`})}));
  return list.length;
}
function pchYcTaskEdit(id,v){const L=pchOpenTasks(t=>t.pcYc===id);if(!L.length)return;
  DB.mutate(ME.name,"sửa việc pha chế "+id,dt=>dt.tasks.filter(t=>t.pcYc===id&&t.st!=="done").forEach(t=>{t.ten=`Pha ${pchName(v.btp)} · ${knum(v.lit)} lít`;t.han=pchHan(v.han);if(typeof tkLog==="function")tkLog(t,ME.name+" sửa yêu cầu "+id)}))}
/* kho.js gọi sau khi ghi phiếu pha chế. */
function pchAfterPc(body,r){
  const ref=String(body&&body.ref_no||"").trim();
  if(ref)pchTaskDone(t=>t.pcYc===ref,"Đã ghi phiếu pha chế "+r.no);
  pchLoadYc(true).then(pchRerender).catch(()=>{});
  setTimeout(()=>pchHhWatch(body&&body.nguoi||[]),1500);
}

/* Mở một việc pha chế trong Công việc: thêm khung thao tác ngay đầu ngăn. */
function pchTaskBox(t){
  if(t.pcYc){const x=pchYcRows().find(y=>y.id===t.pcYc);
    if(!x)return `<div class="note">Yêu cầu pha chế <b>${esc(t.pcYc)}</b>. <span class="hint">Đang tải…</span></div>`;
    if(x.tt==="HUY")return `<div class="note">Yêu cầu <b>${esc(x.id)}</b> đã hủy${x.lyDoHuy?": "+esc(x.lyDoHuy):""}.</div>`;
    if(x.tt==="XONG")return `<div class="note grn">Đã pha: phiếu <a href="#" class="lnk" data-pchdoc="${x.doc.id}">${esc(x.doc.no)}</a> ngày ${kDd(x.doc.doc_date)}.</div>`;
    const R=pchCt(x.btp);
    return `<div class="note amb"><b>Pha ${esc(pchName(x.btp))} · ${knum(x.lit)} lít</b><br>Yêu cầu ${esc(x.id)}${x.han?" · hạn "+kDd(x.han):""}${x.ghiChu?" · "+esc(x.ghiChu):""}<br>${R?`Theo công thức bản ${R.version}.`:`<span class="t-red">Chưa có công thức của Kỹ thuật, định lượng tạm theo định mức kế toán.</span>`}
      <div class="acts" style="margin-top:8px"><button type="button" class="btn pri" data-pchghi="${esc(x.id)}">Ghi số thực tế</button> <button type="button" class="btn" data-pchin="${esc(x.id)}">In phiếu</button>${R&&R.huong_dan?` <button type="button" class="btn" data-pchhd="${esc(x.btp)}">Hướng dẫn pha</button>`:""}</div></div>`}
  if(t.pcCt){const r=(PCH.ct||[]).find(y=>y.id===t.pcCt);if(!r)return `<div class="note">Phiếu điều chỉnh công thức. <span class="hint">Đang tải…</span></div>`;
    return `<div class="note ${r.status==="CHO"?"amb":""}">${pchCtCompare(r)}${r.status==="CHO"&&PCH.ctOk?`<div class="acts" style="margin-top:8px"><button type="button" class="btn pri" data-pchok="${r.id}">Duyệt, dùng từ hôm nay</button> <button type="button" class="btn" data-pchtra="${r.id}">Trả lại</button></div>`:r.status==="CHO"?`<p class="hint">Chờ Trưởng kỹ thuật duyệt.</p>`:`<p class="hint">${r.status==="TRA"?"Đã trả lại: "+esc(r.tra_ly_do||""):"Đã duyệt, đang dùng."}</p>`}</div>`}
  if(t.pcKiem||t.pcDat||t.pcLech)return `<div class="note amb">${t.pcKiem?"Đếm các nguyên liệu này ở xưởng rồi báo tồn: web tự báo Quản lý mua hàng đặt nếu hết thật.":t.pcDat?"Kỹ thuật đã đếm: các mã dưới đây còn dưới mức đặt mua. Lập đơn mua.":"Số đếm ở xưởng khác số trên web. Tìm phiếu nhập / xuất bị sót hoặc ghi sai, rồi báo kế toán kho lập phiếu kiểm kê."}
    <div class="acts" style="margin-top:8px">${t.pcKiem?`<button type="button" class="btn pri" data-pchgo="ton">Đếm và báo tồn</button>`:`<button type="button" class="btn pri" data-pchgo="kho_ton">Xem tồn kho nguyên vật liệu</button>`}</div></div>`;
  return "";
}
function pchBindBox(root){
  root.querySelectorAll("[data-pchghi]").forEach(b=>b.onclick=()=>kqPcOpen(b.dataset.pchghi,false));
  root.querySelectorAll("[data-pchin]").forEach(b=>b.onclick=()=>kqPcOpen(b.dataset.pchin,true));
  root.querySelectorAll("[data-pchdoc]").forEach(a=>a.onclick=e=>{e.preventDefault();khoOpenDoc(+a.dataset.pchdoc)});
  root.querySelectorAll("[data-pchhd]").forEach(b=>b.onclick=()=>pchHdShow(b.dataset.pchhd));
  root.querySelectorAll("[data-pchok]").forEach(b=>b.onclick=()=>pchCtApprove(+b.dataset.pchok));
  root.querySelectorAll("[data-pchtra]").forEach(b=>b.onclick=()=>pchCtReturn(+b.dataset.pchtra));
  root.querySelectorAll("[data-pchgo]").forEach(b=>b.onclick=()=>{closeDrawer();b.dataset.pchgo==="kho_ton"?pchGo("kho_ton"):pchGo("kho_pc",b.dataset.pchgo)});
}
if(typeof openTask==="function"){const _ot=openTask;openTask=function(id){const r=_ot.apply(this,arguments);try{
  const t=id&&D().tasks.find(x=>x.id===id);if(!t||!(t.pcYc||t.pcCt||t.pcKiem||t.pcDat||t.pcLech))return r;
  const draw=()=>{const h=document.querySelector("#drawerIn h2");if(!h)return;let box=document.getElementById("pch-box");if(!box){box=document.createElement("div");box.id="pch-box";h.after(box)}box.innerHTML=pchTaskBox(t);pchBindBox(box)};
  draw();if(t.pcYc&&!PCH.yc)pchLoadYc().then(draw).catch(()=>{});if((t.pcYc||t.pcCt)&&!PCH.ct)pchLoadCt().then(draw).catch(()=>{});
  if(typeof KHO!=="undefined"&&!KHO.cat&&typeof khoLoad==="function")khoLoad();
}catch(e){}return r}}
function pchGo(page,tab){if(tab)PCH.tab=tab;PAGE=page;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}if(typeof MOD!=="undefined")MOD="";if(typeof render==="function")render();else renderMain();scrollTo(0,0)}

/* ---------- Trang Pha chế: thanh tab ---------- */
const PCH_TABS=[["yc","Yêu cầu & phiếu"],["ct","Công thức"],["ton","Báo tồn"],["hh","Hao hụt"]];
function pchTabBar(){return `<nav class="pchtabs pchmain">${PCH_TABS.map(([k,t])=>`<button type="button" class="${PCH.tab===k?"on":""}" data-pcht="${k}">${t}${k==="ct"&&(PCH.ct||[]).some(r=>r.status==="CHO")?` <span class="pill p-amb">${(PCH.ct||[]).filter(r=>r.status==="CHO").length}</span>`:""}</button>`).join("")}</nav>`}
function pchCss(){if(document.getElementById("pch-css"))return;const s=document.createElement("style");s.id="pch-css";s.textContent=
  `.pchtabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 12px}.pchtabs button{border:1px solid #d9deea;background:#fff;border-radius:8px;padding:7px 12px;font:inherit;cursor:pointer}.pchtabs button.on{background:#fff0f6;border-color:#e7357b;color:#e7357b;font-weight:600}
  .pchhd{white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer;background:#f7f8fc;border-radius:8px;padding:8px 10px;margin-top:6px}.pchhd.open{display:block;-webkit-line-clamp:unset}
  .pchhd::after{content:""}.pchmore{font-size:12px;color:#e7357b;cursor:pointer}.pchcard{border:1px solid #e4e8f2;border-radius:10px;padding:10px 12px;margin-bottom:10px;background:#fff}
  .pchcard h3{margin:0 0 4px;font-size:15px}.pchgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px}
  tr.pchlech td{background:#fff4e0}input.pchdem{width:100px;text-align:right}input.pchmin{width:90px;text-align:right}
  @media(max-width:700px){.pchgrid{grid-template-columns:1fr}input.pchdem{width:72px}input.pchmin{width:64px}}`;document.head.appendChild(s)}
{const _pc=PAGES.kho_pc;if(_pc)PAGES.kho_pc=function(m){
  pchCss();if(!PCH.ct)pchLoadCt().then(pchRerender).catch(()=>{});
  if(!PCH_TABS.some(t=>t[0]===PCH.tab))PCH.tab="yc";
  if(PCH.tab==="yc"){const r=_pc.apply(this,arguments);pchMountTabs(m);pchBindBox(m);pchKiemCheck();return r}
  const body=PCH.tab==="ct"?pchViewCt():PCH.tab==="ton"?pchViewTon():pchViewHh();
  khoFrame(m,"kho_pc","Pha chế",PCH.tab==="ct"?"Công thức pha của Kỹ thuật (cho 1 lít bán thành phẩm) và hướng dẫn pha. Phiếu pha chế lấy định lượng theo công thức đang dùng.":PCH.tab==="ton"?"Kỹ thuật đếm nguyên liệu ở xưởng: hết thật thì báo Quản lý mua hàng đặt, lệch sổ thì báo kiểm tra. Không tự sửa tồn trên web.":"Hao hụt pha chế: số thực tế so với công thức, theo mẻ, theo người pha, theo nguyên liệu.",body);
  pchMountTabs(m);pchBind(m);pchKiemCheck();
}}
function pchMountTabs(m){m.querySelectorAll(".pchmain").forEach(x=>x.remove());const hd=m.querySelector(".sxhead");const w=document.createElement("div");w.innerHTML=pchTabBar();const nav=w.firstElementChild;if(hd)hd.after(nav);else m.prepend(nav);
  nav.querySelectorAll("[data-pcht]").forEach(b=>b.onclick=()=>{PCH.tab=b.dataset.pcht;PCH.kq=null;renderMain();scrollTo(0,0)})}

/* ---------- Công thức ---------- */
function pchCanCt(){return !!ME&&(pchAdm()||can(ME,"sx.kythuat")||can(ME,"sx.congthuc"))}
function pchHdHtml(txt){return txt?`<div class="pchhd" title="Bấm để xem hết / thu gọn">${esc(txt)}</div><span class="pchmore">Bấm vào để xem toàn bộ hướng dẫn</span>`:""}
function pchLinesTbl(lines,old){const om=new Map((old||[]).map(l=>[l.item,l.qty]));
  return tbl(["Nguyên liệu","ĐVT",...(old?["Đang dùng"]:[]),old?"Đề xuất / 1 lít":"/ 1 lít"],lines.map(l=>{const o=om.get(l.item),ch=old&&o!==l.qty;return `<tr${ch?' class="pchlech"':""}><td>${esc(pchName(l.item))}<small class="hint mono" style="display:block">${esc(l.item)}</small></td><td>${esc(pchUnit(l.item))}</td>${old?`<td class="n">${o==null?"—":knum(o)}</td>`:""}<td class="n">${ch?`<b>${knum(l.qty)}</b>`:knum(l.qty)}</td></tr>`}).concat(old?(old.filter(l=>!lines.some(x=>x.item===l.item)).map(l=>`<tr class="pchlech"><td>${esc(pchName(l.item))} <small class="hint">(bỏ)</small></td><td>${esc(pchUnit(l.item))}</td><td class="n">${knum(l.qty)}</td><td class="n"><b>0</b></td></tr>`)):[]))}
function pchCtCompare(r){const cur=pchCt(r.btp);
  return `<b>${r.status==="CHO"?"Phiếu điều chỉnh":"Công thức"} ${esc(pchName(r.btp))} · bản ${r.version}</b><br><span class="hint">${esc(r.created_by_name)} lập ${kDd(String(r.created_at).slice(0,10))}</span><div style="margin:6px 0"><b>Lý do:</b> ${esc(r.ly_do)}</div>${pchLinesTbl(r.lines,cur&&cur.id!==r.id?cur.lines:null)}${r.huong_dan?`<div style="margin-top:6px"><b>Hướng dẫn pha</b>${pchHdHtml(r.huong_dan)}</div>`:""}`}
function pchViewCt(){
  if(!PCH.ct)return `<p class="hint pad">Đang tải công thức…</p>`;
  const q=PCH.q.trim().toLowerCase(),fold=s=>typeof kfold==="function"?kfold(s):String(s).toLowerCase();
  const btps=[...new Set(PCH.ct.map(r=>r.btp))],cho=PCH.ct.filter(r=>r.status==="CHO");
  const allBtp=typeof KHO!=="undefined"&&KHO.items?[...KHO.items.values()].filter(i=>i.cls==="BTP"&&i.active!==0):[];
  const noCt=allBtp.filter(i=>!btps.includes(i.code));
  let h=`<div class="row7" style="margin-bottom:10px">${pchCanCt()?`<button type="button" class="btn pri" data-pchnew="1">+ Thêm công thức</button>`:""}<label class="field grow"><input id="pch-q" placeholder="Tìm bán thành phẩm" value="${esc(PCH.q)}"></label></div>`;
  h+=`<p class="hint">Số trong công thức là cho <b>1 lít</b> bán thành phẩm. ${PCH.ctOk?"Bạn là người duyệt công thức: lập hay điều chỉnh là dùng ngay.":"Kỹ thuật lập hoặc điều chỉnh thì chờ Trưởng kỹ thuật duyệt; chưa duyệt vẫn pha theo bản cũ."}</p>`;
  if(cho.length)h+=`<h3>Chờ Trưởng kỹ thuật duyệt · ${cho.length}</h3><div class="pchgrid">${cho.map(r=>`<div class="pchcard">${pchCtCompare(r)}<div class="acts" style="margin-top:8px">${PCH.ctOk?`<button type="button" class="btn pri" data-pchok="${r.id}">Duyệt, dùng từ hôm nay</button> <button type="button" class="btn" data-pchtra="${r.id}">Trả lại</button>`:`<span class="hint">Chờ duyệt</span>`}</div></div>`).join("")}</div>`;
  const list=btps.filter(b=>!q||fold(b+" "+pchName(b)).includes(fold(q)));
  h+=`<h3 style="margin-top:12px">Công thức · ${btps.length} bán thành phẩm</h3>`;
  h+=list.length?`<div class="pchgrid">${list.map(b=>{const all=PCH.ct.filter(r=>r.btp===b),R=all.find(r=>r.status==="OK"),pend=all.find(r=>r.status==="CHO"),his=all.filter(r=>r!==R&&r.status!=="CHO");
    return `<div class="pchcard"><div style="display:flex;justify-content:space-between;gap:8px"><h3>${esc(pchName(b))}</h3>${R?pill("Bản "+R.version,"blu"):pill("Chưa duyệt","amb")}</div><small class="hint mono">${esc(b)}</small>
     ${R?`<div class="hint">Dùng từ ${kDd(String(R.effective_at||R.created_at).slice(0,10))} · ${esc(R.created_by_name)} lập · ${R.tu_duyet?"người duyệt tự lập, dùng ngay":"duyệt: "+esc(R.approved_by_name||"")}</div><div class="hint">Lý do: ${esc(R.ly_do)}</div>${pchLinesTbl(R.lines)}${R.huong_dan?`<div style="margin-top:6px"><b>Hướng dẫn pha</b>${pchHdHtml(R.huong_dan)}</div>`:""}`:""}
     ${pend?`<div class="note amb" style="margin-top:6px">Phiếu điều chỉnh bản ${pend.version} đang chờ duyệt.${R?" Pha vẫn theo bản "+R.version+".":""}</div>`:""}
     ${his.length?`<details style="margin-top:6px"><summary class="hint">Lịch sử ${his.length} bản cũ / trả lại</summary>${tbl(["Bản","Ngày","Lý do","Người"],his.map(x=>`<tr data-pchv="${x.id}" class="clk"><td>${x.version}${x.status==="TRA"?" "+pill("Trả lại","red"):""}</td><td>${kDd(String(x.created_at).slice(0,10))}</td><td>${esc(x.ly_do)}${x.tra_ly_do?`<small class="hint" style="display:block">Trả lại: ${esc(x.tra_ly_do)}</small>`:""}</td><td>${esc(x.created_by_name)}${x.approved_by_name?`<small class="hint" style="display:block">${esc(x.approved_by_name)}</small>`:""}</td></tr>`))}</details>`:""}
     ${pchCanCt()&&!pend?`<div class="acts" style="margin-top:8px"><button type="button" class="btn" data-pchdc="${esc(b)}">${R?"Điều chỉnh công thức":"Lập lại công thức"}</button></div>`:""}</div>`}).join("")}</div>`:`<p class="hint">${btps.length?"Không có công thức nào khớp.":"Chưa có công thức nào. Bấm \"+ Thêm công thức\"."}</p>`;
  if(noCt.length)h+=`<details style="margin-top:12px"><summary class="hint">${noCt.length} bán thành phẩm chưa có công thức (phiếu pha đang tạm theo định mức kế toán)</summary><p>${noCt.map(i=>`${pchCanCt()?`<a href="#" class="lnk" data-pchnewb="${esc(i.code)}">${esc(i.name)}</a>`:esc(i.name)}`).join(" · ")}</p></details>`;
  return h;
}
function pchHdShow(btp){const R=pchCt(btp);if(!R)return;openDrawerHTML(`<h2>Hướng dẫn pha ${esc(pchName(btp))}</h2><p class="hint">Công thức bản ${R.version}</p><div style="white-space:pre-wrap">${esc(R.huong_dan)}</div>`)}
/* Thêm / điều chỉnh công thức (ngăn bên). */
function pchCtForm(btp){
  const R=btp?pchCt(btp):null,base=R?R.lines:(btp&&typeof KHO!=="undefined"&&KHO.bom&&!KHO.bomHidden?(KHO.bom.get(btp)||[]).map(b=>({item:b.item,qty:b.qty})):[]);
  const self=PCH.ctOk;
  openDrawerHTML(`<h2>${R?"Phiếu điều chỉnh công thức":"Thêm công thức pha"}</h2><form class="frm" id="pchf">
    <label class="field">Bán thành phẩm<input id="pchf-b" autocomplete="off" placeholder="Gõ tên bán thành phẩm rồi chọn" value="${esc(btp||"")}" data-code="${esc(btp||"")}" ${R?"readonly":""}><small class="hint" id="pchf-bn">${btp?esc(pchName(btp))+(R?" · bản "+R.version+" → "+(Math.max(...PCH.ct.filter(r=>r.btp===btp).map(r=>r.version))+1):""):""}</small></label>
    <p class="hint">Số cho <b>1 lít</b> bán thành phẩm. Dấu phẩy hay chấm đều được (0,12 · 0.004).${!R&&base.length?" Đã điền sẵn theo định mức kế toán, sửa lại theo công thức thực tế.":""}</p>
    <div class="tbl edit"><table><thead><tr><th>Nguyên liệu</th>${R?"<th>Đang dùng</th>":""}<th style="width:130px">Số / 1 lít</th><th>ĐVT</th><th></th></tr></thead><tbody id="pchf-l"></tbody></table></div>
    <button type="button" class="btn sm" id="pchf-add">+ Thêm nguyên liệu</button>
    <label class="field">Hướng dẫn pha chế <small class="hint">(thứ tự cho nguyên liệu, khuấy bao lâu, nhiệt độ, lưu ý…)</small><textarea id="pchf-hd" rows="6">${esc(R?R.huong_dan:"")}</textarea></label>
    <label class="field">Lý do ${R?"điều chỉnh":"thêm công thức"} <b class="t-red">*</b><textarea id="pchf-ly" rows="2" placeholder="${R?"Ví dụ: đổi nhà cung cấp SLES, độ đặc khác":"Ví dụ: công thức đầu cho bán thành phẩm mới"}"></textarea></label>
    <div class="note ${self?"grn":""}">${self?"Bạn là người duyệt công thức: lưu xong dùng ngay, không cần duyệt.":"Lưu xong gửi Trưởng kỹ thuật duyệt. Chưa duyệt thì phiếu pha vẫn theo bản cũ."}</div>
    <div id="pchf-e"></div><div class="row7"><button class="btn pri" id="pchf-ok">${self?"Lưu, dùng ngay":"Lưu và gửi duyệt"}</button></div></form>`);
  const body=$("#pchf-l"),old=new Map((R?R.lines:[]).map(l=>[l.item,l.qty]));
  const add=l=>{const tr=document.createElement("tr");tr.innerHTML=`<td><input class="pchf-i" autocomplete="off" placeholder="Gõ tên hoặc mã rồi chọn" value="${esc(l&&l.item?l.item:"")}" data-code="${esc(l&&l.item||"")}"><small class="hint pchf-n">${l&&l.item?esc(pchName(l.item)):""}</small></td>${R?`<td class="n">${l&&old.has(l.item)?knum(old.get(l.item)):"—"}</td>`:""}<td><input class="pchf-q n" inputmode="decimal" value="${l&&l.qty!=null?String(l.qty).replace(".",","):""}"></td><td class="pchf-u">${l&&l.item?esc(pchUnit(l.item)):""}</td><td><button type="button" class="lnk pchf-x">✕</button></td>`;
    body.appendChild(tr);const inp=tr.querySelector(".pchf-i");khoPick(inp,["NVL","BTP"],it=>{inp.dataset.code=it.code;tr.querySelector(".pchf-n").textContent=it.name;tr.querySelector(".pchf-u").textContent=it.unit||"";tr.querySelector(".pchf-q").focus()});
    tr.querySelector(".pchf-x").onclick=()=>tr.remove();return tr};
  (base.length?base:[null]).forEach(add);$("#pchf-add").onclick=()=>add(null);
  if(!R)khoPick($("#pchf-b"),["BTP"],it=>{$("#pchf-b").dataset.code=it.code;$("#pchf-bn").textContent=it.name;if(pchCt(it.code)){closeDrawer();pchCtForm(it.code);return}
    if(!body.querySelector(".pchf-i[data-code]:not([data-code=''])")&&typeof KHO!=="undefined"&&KHO.bom&&!KHO.bomHidden){body.innerHTML="";const B=KHO.bom.get(it.code)||[];(B.length?B.map(b=>({item:b.item,qty:b.qty})):[null]).forEach(add)}});
  if(typeof khoNoEnter==="function")khoNoEnter($("#pchf"));
  $("#pchf").onsubmit=async e=>{e.preventDefault();const ok=$("#pchf-ok");if(ok.disabled)return;
    const b=$("#pchf-b").dataset.code,ly=$("#pchf-ly").value.trim();
    const L=[...body.querySelectorAll("tr")].map(tr=>({item:tr.querySelector(".pchf-i").dataset.code||"",raw:tr.querySelector(".pchf-i").value.trim(),qty:kfNum(tr.querySelector(".pchf-q").value)})).filter(l=>l.raw||isFinite(l.qty));
    const err=!b?"Chưa chọn bán thành phẩm.":!L.length?"Chưa có nguyên liệu nào.":L.some(l=>!l.item)?"Có dòng chưa chọn nguyên liệu trong danh sách: "+L.filter(l=>!l.item).map(l=>l.raw).join(", "):L.some(l=>!(l.qty>=0))?"Có dòng chưa có số hoặc gõ sai số.":!ly?"Chưa ghi lý do.":"";
    if(err){$("#pchf-e").innerHTML=`<div class="note red">${esc(err)}</div>`;return}
    ok.disabled=true;
    try{const r=await pApi("/ct",{method:"POST",body:JSON.stringify({btp:b,lines:L.map(l=>({item:l.item,qty:l.qty})),huong_dan:$("#pchf-hd").value,ly_do:ly})});
      await pchLoadCt(true);
      if(r.status==="CHO"){const T=pchTruongKT();if(T.length)DB.mutate(ME.name,"gửi duyệt công thức "+b,dt=>pchNewTask(dt,{ten:`Duyệt công thức ${pchName(b)} bản ${r.version}`,moTa:`${ME.name} lập phiếu điều chỉnh công thức.\nLý do: ${ly}\nMở việc này để xem số cũ / mới và duyệt hoặc trả lại.`,nguoi:T[0].id,phoi:T.slice(1).map(u=>u.id),han:D().settings.today,loai:"Duyệt công thức",extra:{pcCt:r.id},log:"gửi duyệt công thức",bell:`${ME.name} gửi duyệt công thức ${pchName(b)}`}))}
      closeDrawer();toast(r.status==="OK"?"Đã lưu, từ giờ pha theo công thức bản "+r.version:"Đã gửi Trưởng kỹ thuật duyệt");PCH.tab="ct";renderMain()}
    catch(er){ok.disabled=false;$("#pchf-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`}};
}
async function pchCtApprove(id){
  if(!confirm("Duyệt công thức này? Phiếu pha từ giờ sẽ theo số mới."))return;
  try{const r=await pApi("/ct/"+id+"/duyet",{method:"POST",body:"{}"});await pchLoadCt(true);
    pchTaskDone(t=>t.pcCt===id,"Đã duyệt công thức");pchTellMaker(id,`Công thức ${pchName(r.btp)} bản ${r.version} đã được duyệt, từ giờ pha theo bản này.`);
    closeDrawer();toast("Đã duyệt công thức bản "+r.version);PCH.tab="ct";renderMain()}catch(e){toast(e.message)}
}
async function pchCtReturn(id){
  const ly=(prompt("Lý do trả lại phiếu điều chỉnh công thức:")||"").trim();if(!ly)return;
  try{await pApi("/ct/"+id+"/tra",{method:"POST",body:JSON.stringify({ly_do:ly})});await pchLoadCt(true);
    const r=PCH.ct.find(x=>x.id===id);pchTaskDone(t=>t.pcCt===id,"Trả lại: "+ly);pchTellMaker(id,`Phiếu điều chỉnh công thức ${pchName(r&&r.btp)} bị trả lại: ${ly}`);
    closeDrawer();toast("Đã trả lại");PCH.tab="ct";renderMain()}catch(e){toast(e.message)}
}
function pchTellMaker(id,text){const r=(PCH.ct||[]).find(x=>x.id===id);if(!r)return;const u=pchUsers().find(x=>x.crm&&x.crm===r.created_by)||pchUsers().find(x=>x.name===r.created_by_name);if(!u||u.id===ME.id)return;
  DB.mutate(ME.name,"báo kết quả duyệt công thức",dt=>{if(typeof notifyU==="function")notifyU(dt,[u.id],text,"page:kho_pc")})}

/* ---------- Báo tồn ---------- */
const pchCanMin=()=>!!ME&&(pchAdm()||(typeof mhManage==="function"&&mhManage())||can(ME,"sx.kiemke")||can(ME,"sx.dieuphoi"));
function pchTonItems(){
  if(typeof KHO==="undefined"||!KHO.items)return [];
  const inCt=new Set((PCH.ct||[]).filter(r=>r.status==="OK").flatMap(r=>r.lines.map(l=>l.item)));
  const all=[...KHO.items.values()].filter(i=>i.cls==="NVL"&&i.active!==0);
  const q=PCH.q.trim(),fold=s=>typeof kfold==="function"?kfold(s):String(s).toLowerCase();
  let L=PCH.all||!inCt.size?all:all.filter(i=>inCt.has(i.code));
  if(q)L=all.filter(i=>q.split(/\s+/).every(w=>fold(i.code+" "+i.name).includes(fold(w))));
  return L.sort((a,b)=>(pchLow(b.code)-pchLow(a.code))||String(a.name).localeCompare(b.name));
}
function pchTonRow(c){const r=typeof ktonRow==="function"?ktonRow(c):null,it=(KHO.items&&KHO.items.get(c))||{};return {ton:r?+r.ton:(typeof khoStock==="function"?khoStock(c):0),kd:r?+r.kha_dung:(typeof khoStock==="function"?khoStock(c):0),min:+(r?r.min_stock:it.min_stock)||0}}
const pchLow=c=>{const x=pchTonRow(c);return x.min>0&&x.kd<x.min?1:0};
function pchViewTon(){
  if(typeof ktonLoad==="function")ktonLoad();
  if(PCH.kq)return pchViewKq();
  const L=pchTonItems(),low=L.filter(i=>pchLow(i.code)),noMin=L.filter(i=>!pchTonRow(i.code).min).length,cm=pchCanMin();
  let h=`<div class="row7" style="margin-bottom:8px"><label class="field grow"><input id="pch-q" placeholder="Tìm nguyên liệu (tên hoặc mã)" value="${esc(PCH.q)}"></label><label class="inl"><input type="checkbox" id="pch-all"${PCH.all?" checked":""}> Hiện mọi nguyên vật liệu</label></div>
    <p class="hint">Đếm nguyên liệu ở xưởng, gõ số đếm được rồi bấm <b>Xem kết quả</b>. Mã chưa đếm để trống. ${PCH.all||!(PCH.ct||[]).length?"":"Đang hiện các nguyên liệu có trong công thức."}</p>`;
  if(low.length)h+=`<div class="note red"><b>Web báo sắp hết, cần đếm:</b> ${low.map(i=>esc(i.name)).join(", ")}</div>`;
  if(noMin)h+=`<div class="note amb">${noMin} mã chưa có <b>mức đặt mua</b> nên web chưa báo hết hàng được.${cm?" Gõ mức ở cột \"Đặt mua khi dưới\" (tự lưu).":" Quản lý mua hàng / kế toán kho đặt mức này (cột Tồn tối thiểu ở Kho nguyên vật liệu)."}</div>`;
  h+=`<div class="card flush">${tbl(["Nguyên liệu","Tồn web","Đếm được","Đặt mua khi dưới"],L.slice(0,300).map(i=>{const x=pchTonRow(i.code),lo=x.min>0&&x.kd<x.min;
    return `<tr${lo?' class="pchlech"':""}><td>${esc(i.name)}${lo?" "+pill("sắp hết","red"):""}<small class="hint mono" style="display:block">${esc(i.code)} · ${esc(i.unit||"")}</small></td><td class="n">${knum(x.ton)}</td><td class="n"><input class="pchdem" data-pchdem="${esc(i.code)}" inputmode="decimal" value="${PCH.dem[i.code]!=null?esc(PCH.dem[i.code]):""}" placeholder="${lo?"đếm":""}"></td><td class="n">${cm?`<input class="pchmin" data-pchmin="${esc(i.code)}" inputmode="decimal" value="${x.min?String(x.min).replace(".",","):""}" placeholder="chưa đặt">`:x.min?knum(x.min):"—"}</td></tr>`}))}</div>
    <div id="pch-e"></div><div class="row7" style="margin-top:10px"><button type="button" class="btn pri" id="pch-xem">Xem kết quả</button>${Object.keys(PCH.dem).length?`<button type="button" class="btn" id="pch-xoa">Xóa số đã gõ</button>`:""}</div>`;
  if(!PCH.ton&&!PCH.tonBusy){PCH.tonBusy=true;pApi("/ton").then(r=>{PCH.ton=r||[]}).catch(()=>{PCH.ton=[]}).finally(()=>{PCH.tonBusy=false;pchRerender()})}
  if(PCH.ton&&PCH.ton.length)h+=`<details style="margin-top:12px"><summary class="hint">Các lần báo tồn gần đây</summary>${tbl(["Lúc","Người đếm","Số mã","Cần đặt","Lệch"],PCH.ton.map(r=>`<tr><td>${esc(String(r.created_at).slice(0,16).replace("T"," "))}</td><td>${esc(r.created_by_name)}</td><td class="n">${r.lines.length}</td><td>${r.lines.filter(l=>l.dat).map(l=>esc(l.name)).join(", ")||"—"}</td><td>${r.lines.filter(l=>l.lech).map(l=>esc(l.name)+" ("+(l.dem-l.web>0?"+":"")+knum(Math.round((l.dem-l.web)*1e6)/1e6)+")").join(", ")||"—"}</td></tr>`))}</details>`;
  return h;
}
function pchViewKq(){
  const K=PCH.kq,dat=K.lines.filter(l=>l.dat),lech=K.lines.filter(l=>l.lech);
  return `<div class="card flush"><div class="card-h pad"><h2>Kết quả đếm ${K.lines.length} mã</h2></div>${tbl(["Nguyên liệu","Tồn web","Đếm được","Lệch","Kết luận"],K.lines.map(l=>{const cl=Math.round((l.dem-l.web)*1e6)/1e6;
    return `<tr${l.lech?' class="pchlech"':""}><td>${esc(l.name)}<small class="hint mono" style="display:block">${esc(l.item)}</small></td><td class="n">${knum(l.web)} ${esc(l.unit)}</td><td class="n"><b>${knum(l.dem)}</b></td><td class="n">${l.lech?(cl>0?"+":"")+knum(cl):"—"}</td><td>${l.dat?pill("Hết thật, cần đặt","red"):l.min>0?pill(l.web_sap_het?"Web báo sắp hết nhưng còn đủ, không đặt":"Còn đủ, không đặt","grn"):pill("Chưa có mức đặt mua","gry")}${l.lech?" "+pill(cl>0?"Thực tế nhiều hơn web":"Thực tế ít hơn web","amb"):""}</td></tr>`}))}</div>
   <div class="card pad" style="margin-top:10px"><h3>Bấm gửi thì web sẽ</h3>
    ${dat.length?`<div class="note red"><b>Giao Quản lý mua hàng đặt ${dat.length} mã:</b> ${dat.map(l=>esc(l.name)+" (còn "+knum(l.dem)+" "+esc(l.unit)+", đặt khi dưới "+knum(l.min)+")").join("; ")}</div>`:`<div class="note grn">Không mã nào cần đặt.</div>`}
    ${lech.length?`<div class="note amb"><b>Báo lệch kho ${lech.length} mã</b> cho Quản lý mua hàng và Kỹ thuật cùng kiểm tra: ${lech.map(l=>esc(l.name)+" (web "+knum(l.web)+", đếm "+knum(l.dem)+")").join("; ")}</div>`:""}
    <p class="hint">Số đếm chỉ để báo, không tự sửa tồn trên web. Kiểm xong chỗ lệch thì kế toán kho lập phiếu kiểm kê để sửa sổ.</p>
    <label class="field">Ghi chú<input id="pch-gc" placeholder="Ví dụ: cần gấp trước thứ Hai"></label>
    <div id="pch-e"></div><div class="row7"><button type="button" class="btn pri" id="pch-gui">Gửi báo cáo</button><button type="button" class="btn" id="pch-sua">Sửa số đếm</button></div></div>`;
}
async function pchTonSend(){
  const btn=$("#pch-gui");if(btn.disabled)return;btn.disabled=true;
  try{await pchLoadNguoi().catch(()=>{});const r=await pApi("/ton",{method:"POST",body:JSON.stringify({lines:PCH.kq.lines.map(l=>({item:l.item,dem:l.dem})),note:$("#pch-gc").value.trim()})});
    const dat=r.lines.filter(l=>l.dat),lech=r.lines.filter(l=>l.lech),gc=$("#pch-gc").value.trim(),MH=pchMuaHang(),han=D().settings.today;
    const fmtL=L=>L.map(l=>`• ${l.name} (${l.item}): web ${knum(l.web)} · đếm ${knum(l.dem)} ${l.unit}${l.min?" · đặt khi dưới "+knum(l.min):""}`).join("\n");
    if((dat.length||lech.length)&&MH.length)DB.mutate(ME.name,"báo tồn pha chế",dt=>{
      if(dat.length)pchNewTask(dt,{ten:`Đặt hàng ${dat.length} nguyên liệu: ${dat.slice(0,3).map(l=>l.name).join(", ")}${dat.length>3?"…":""}`,moTa:`${ME.name} đếm ở xưởng, các mã này còn dưới mức đặt mua:\n${fmtL(dat)}${gc?"\nGhi chú: "+gc:""}`,nguoi:MH[0].id,phoi:MH.slice(1).map(u=>u.id),han,loai:"Mua hàng",extra:{pcDat:r.id},log:"báo cần đặt hàng",bell:`${ME.name} báo cần đặt ${dat.length} nguyên liệu`});
      if(lech.length)pchNewTask(dt,{ten:`Lệch kho ${lech.length} nguyên liệu cần kiểm tra`,moTa:`Số đếm ở xưởng khác số trên web:\n${fmtL(lech)}\nTìm phiếu nhập / xuất bị sót hoặc ghi sai, rồi báo kế toán kho lập phiếu kiểm kê.${gc?"\nGhi chú: "+gc:""}`,nguoi:MH[0].id,phoi:[ME.id,...MH.slice(1).map(u=>u.id)],han,loai:"Lệch kho",extra:{pcLech:r.id},log:"báo lệch kho",bell:`Lệch kho ${lech.length} nguyên liệu, cần kiểm tra`})});
    /* Đếm xong các mã đang nhắc kiểm thì việc nhắc kiểm xong theo. */
    const counted=new Set(r.lines.map(l=>l.item));pchTaskDone(t=>t.pcKiem&&(t.pcItems||[]).every(c=>counted.has(c)),"Đã đếm và báo tồn");
    PCH.dem={};PCH.kq=null;PCH.ton=null;toast(dat.length||lech.length?`Đã gửi: ${dat.length} mã cần đặt, ${lech.length} mã lệch`:"Đã lưu số đếm, không mã nào cần đặt hay lệch");renderMain()}
  catch(e){btn.disabled=false;$("#pch-e").innerHTML=`<div class="note red">${esc(e.message)}</div>`}
}
/* Mã web thấy sắp hết → nhắc Kỹ thuật đếm (một việc đang mở, cập nhật danh sách). Chạy khi có người mở trang Pha chế hoặc vào web. */
function pchKiemCheck(){
  try{if(!ME||typeof KTON==="undefined"||!KTON.rows||!PCH.ct)return;const day=kToday();if(PCH.kiemDay===day)return;
    if(!(pchMeKT()||pchCanMin()||pchAdm()))return;
    const K=pchKyThuat();if(!K.length)return;PCH.kiemDay=day;
    const inCt=new Set(PCH.ct.filter(r=>r.status==="OK").flatMap(r=>r.lines.map(l=>l.item)));
    const low=KTON.rows.filter(r=>r.active!==0&&r.nhom==="NVL"&&r.cls==="NVL"&&+r.min_stock>0&&+r.kha_dung<+r.min_stock&&(!inCt.size||inCt.has(r.code)));
    if(!low.length)return;const codes=low.map(r=>r.code).sort(),open=pchOpenTasks(t=>t.pcKiem)[0];
    if(open&&JSON.stringify((open.pcItems||[]).slice().sort())===JSON.stringify(codes))return;
    const ten=`Kiểm ${low.length} nguyên liệu sắp hết, báo tồn để đặt hàng`,mo=`Web thấy các nguyên liệu này còn dưới mức đặt mua:\n${low.map(r=>`• ${r.name} (${r.code}): web còn ${knum(r.kha_dung)} ${r.unit} · đặt khi dưới ${knum(r.min_stock)}`).join("\n")}\nĐếm ở xưởng rồi vào Pha chế › Báo tồn: hết thật thì web báo Quản lý mua hàng đặt.`;
    DB.mutate(ME.name,"nhắc kiểm nguyên liệu sắp hết",dt=>{const o=open&&dt.tasks.find(t=>t.id===open.id);if(o){o.ten=ten;o.moTa=mo;o.pcItems=codes;return}
      pchNewTask(dt,{ten,moTa:mo,nguoi:K[0].id,phoi:K.slice(1).map(u=>u.id),han:dt.settings.today,loai:"Kiểm tồn",extra:{pcKiem:true,pcItems:codes},log:"web nhắc kiểm nguyên liệu sắp hết",bell:`Có ${low.length} nguyên liệu sắp hết, cần đếm và báo tồn`})});
  }catch(e){}
}

/* ---------- Hao hụt ---------- */
function pchHhLoad(){const P=kPer(),k=P.from+"|"+P.to;if(PCH.hhKey===k&&PCH.hh)return;PCH.hhKey=k;PCH.hh={busy:true};
  pApi(`/haohut?from=${P.from}&to=${P.to}`).then(r=>{if(PCH.hhKey===k)PCH.hh=r}).catch(e=>{if(PCH.hhKey===k)PCH.hh={err:e.message}}).finally(pchRerender)}
function pchHhCalc(r){
  const P=r.price,docs=new Map(r.docs.map(d=>{let ex={};try{ex=JSON.parse(d.extra||"{}")}catch(e){}return [d.id,{...d,ex,use:[],prod:null}]}));
  r.moves.forEach(m=>{const d=docs.get(m.doc_id);if(!d)return;if(m.role==="PRODUCT")d.prod=m;else if(m.role==="USE")d.use.push({item:m.item,act:-m.qty,std:+m.std_qty||0,note:m.note||""})});
  const D2=[...docs.values()].map(d=>{d.use.forEach(u=>{u.cl=Math.round((u.act-u.std)*1e6)/1e6;u.pct=u.std>0?u.cl*100/u.std:0;u.lech=u.std>0&&Math.abs(u.pct)>r.tol_pct;u.tien=P&&P[u.item]!=null?u.cl*P[u.item]:null});
    d.nguoi=(d.ex.nguoi&&d.ex.nguoi.length?d.ex.nguoi:[d.created_by_name||"?"]);d.lit=d.prod?d.prod.qty:+d.ex.liters||0;d.btp=d.prod?d.prod.item:d.ex.btp;d.can=d.yc_lit||d.ref_qty||null;
    d.soLech=d.use.filter(u=>u.lech).length;d.tien=P?d.use.reduce((a,u)=>a+(u.tien||0),0):null;return d});
  const byP=new Map(),byI=new Map();
  D2.forEach(d=>{d.nguoi.forEach(n=>{const g=byP.get(n)||{n,me:0,lech:0,tien:0,items:new Map()};g.me++;if(d.soLech)g.lech++;g.tien+=d.tien||0;d.use.filter(u=>u.lech).forEach(u=>g.items.set(u.item,(g.items.get(u.item)||0)+1));byP.set(n,g)});
    d.use.forEach(u=>{const g=byI.get(u.item)||{item:u.item,std:0,act:0,me:0,lech:0,tien:0};g.std+=u.std;g.act+=u.act;g.me++;if(u.lech)g.lech++;g.tien+=u.tien||0;byI.set(u.item,g)})});
  return {docs:D2,byP:[...byP.values()].sort((a,b)=>b.lech-a.lech||b.me-a.me),byI:[...byI.values()].map(g=>({...g,cl:Math.round((g.act-g.std)*1e6)/1e6,pct:g.std>0?(g.act-g.std)*100/g.std:0})).sort((a,b)=>Math.abs(b.tien||0)-Math.abs(a.tien||0)||Math.abs(b.pct)-Math.abs(a.pct)),price:!!P,tol:r.tol_pct};
}
function pchViewHh(){
  pchHhLoad();const H=PCH.hh,P=kPer();
  if(!H||H.busy)return `<p class="hint pad">Đang tính hao hụt ${kPerLabel(P)}…</p>`;if(H.err)return `<div class="note red">${esc(H.err)}</div>`;
  const C=pchHhCalc(H),vnd=n=>n==null?"—":(n>0?"+":"")+Math.round(n).toLocaleString("vi-VN")+" đ";
  const nv=[["me","Theo mẻ"],["ng","Theo người pha"],["nl","Theo nguyên liệu"]];
  const warn=C.byP.filter(g=>g.lech>=3);
  let h=`<p class="hint">Kỳ ${kPerLabel(P)} (đổi kỳ ở thanh trên cùng) · ${C.docs.length} mẻ pha · lệch là chênh quá ${C.tol}% so với công thức${C.price?" · tiền tính theo giá nhập bình quân":""}.</p>`;
  if(warn.length)h+=`<div class="note red"><b>Lệch nhiều:</b> ${warn.map(g=>`${esc(g.n)} lệch ${g.lech}/${g.me} mẻ`).join(" · ")}. Đã báo Trưởng kỹ thuật.</div>`;
  h+=`<nav class="pchtabs">${nv.map(([k,t])=>`<button type="button" class="${PCH.hhView===k?"on":""}" data-pchhv="${k}">${t}</button>`).join("")}</nav>`;
  if(!C.docs.length)return h+`<p class="hint">Kỳ này chưa có phiếu pha chế nào.</p>`;
  if(PCH.hhView==="me")h+=`<div class="card flush">${tbl(["Ngày","Phiếu","Bán thành phẩm","Lít thu / yêu cầu","Người pha","Dòng lệch","Lý do lệch",...(C.price?["Tiền lệch"]:[])],C.docs.map(d=>`<tr${d.soLech?' class="pchlech"':""}><td>${kDd(d.doc_date)}</td><td><a href="#" class="lnk" data-pchdoc="${d.id}">${esc(d.no)}</a></td><td>${esc(pchName(d.btp||""))}</td><td class="n">${knum(d.lit)}${d.can?` / ${knum(d.can)}`:""}${d.can&&Math.abs(d.lit-d.can)>1e-9?`<small class="hint" style="display:block">${d.lit-d.can>0?"+":""}${knum(Math.round((d.lit-d.can)*1e3)/1e3)} lít</small>`:""}</td><td>${esc(d.nguoi.join(", "))}</td><td class="n">${d.soLech||"—"}</td><td>${d.use.filter(u=>u.lech).map(u=>`${esc(pchName(u.item))} ${u.cl>0?"+":""}${u.pct.toFixed(1).replace(".",",")}%${u.note?": "+esc(u.note):""}`).join("<br>")||"—"}</td>${C.price?`<td class="n">${vnd(d.tien)}</td>`:""}</tr>`))}</div>`;
  if(PCH.hhView==="ng")h+=`<div class="card flush">${tbl(["Người pha","Số mẻ","Mẻ có lệch","Hay lệch ở",...(C.price?["Tiền lệch"]:[])],C.byP.map(g=>`<tr${g.lech>=3?' class="pchlech"':""}><td><b>${esc(g.n)}</b></td><td class="n">${g.me}</td><td class="n">${g.lech}</td><td>${[...g.items].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,n])=>esc(pchName(c))+" ("+n+")").join(", ")||"—"}</td>${C.price?`<td class="n">${vnd(g.tien)}</td>`:""}</tr>`))}</div>`;
  if(PCH.hhView==="nl")h+=`<div class="card flush">${tbl(["Nguyên liệu","ĐVT","Theo công thức","Thực tế","Chênh","%","Mẻ lệch",...(C.price?["Tiền"]:[])],C.byI.map(g=>`<tr${Math.abs(g.pct)>C.tol?' class="pchlech"':""}><td>${esc(pchName(g.item))}</td><td>${esc(pchUnit(g.item))}</td><td class="n">${knum(Math.round(g.std*1e3)/1e3)}</td><td class="n">${knum(Math.round(g.act*1e3)/1e3)}</td><td class="n">${g.cl>0?"+":""}${knum(Math.round(g.cl*1e3)/1e3)}</td><td class="n">${g.pct>0?"+":""}${g.pct.toFixed(1).replace(".",",")}%</td><td class="n">${g.lech}/${g.me}</td>${C.price?`<td class="n">${vnd(g.tien)}</td>`:""}</tr>`))}</div>`;
  /* Báo Trưởng kỹ thuật (một lần mỗi người mỗi tháng). */
  if(warn.length)pchHhTell(warn.map(g=>({n:g.n,lech:g.lech,me:g.me})));
  return h;
}
/* Sau khi ghi phiếu: xem tháng này người pha đã lệch từ 3 mẻ chưa. */
function pchHhWatch(nguoi){if(!nguoi||!nguoi.length)return;const t=kToday(),from=t.slice(0,8)+"01";
  pApi(`/haohut?from=${from}&to=${t}`).then(r=>{const C=pchHhCalc(r);pchHhTell(C.byP.filter(g=>g.lech>=3&&nguoi.includes(g.n)).map(g=>({n:g.n,lech:g.lech,me:g.me})))}).catch(()=>{})}
function pchHhTell(L){const T=pchTruongKT(),mon=kToday().slice(0,7);if(!T.length||!L.length)return;
  const need=L.filter(g=>!(D().tasks||[]).some(t=>t.pcHh===g.n+"|"+mon));if(!need.length)return;
  DB.mutate(ME.name,"báo hao hụt pha chế",dt=>need.forEach(g=>{if((dt.tasks||[]).some(t=>t.pcHh===g.n+"|"+mon))return;
    pchNewTask(dt,{ten:`Xem hao hụt pha chế: ${g.n} lệch ${g.lech}/${g.me} mẻ tháng này`,moTa:`Lệch quá ${PCH_TOL}% so với công thức từ 3 mẻ trở lên trong tháng.\nXem chi tiết ở Pha chế › Hao hụt › Theo người pha.`,nguoi:T[0].id,phoi:T.slice(1).map(u=>u.id),han:dt.settings.today,loai:"Hao hụt",extra:{pcHh:g.n+"|"+mon},log:"web báo hao hụt",bell:`Hao hụt pha chế: ${g.n} lệch ${g.lech} mẻ tháng này`})}))}

/* ---------- Gắn sự kiện ---------- */
function pchBind(m){
  const q=m.querySelector("#pch-q");if(q)q.oninput=()=>{PCH.q=q.value;clearTimeout(pchBind.t);pchBind.t=setTimeout(()=>{renderMain();const n=document.getElementById("pch-q");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},350)};
  const al=m.querySelector("#pch-all");if(al)al.onchange=()=>{PCH.all=al.checked;renderMain()};
  m.querySelectorAll("[data-pchnew]").forEach(b=>b.onclick=()=>pchCtForm(""));
  m.querySelectorAll("[data-pchnewb]").forEach(a=>a.onclick=e=>{e.preventDefault();pchCtForm(a.dataset.pchnewb)});
  m.querySelectorAll("[data-pchdc]").forEach(b=>b.onclick=()=>pchCtForm(b.dataset.pchdc));
  m.querySelectorAll(".pchhd").forEach(d=>{const t=()=>{d.classList.toggle("open");const s=d.nextElementSibling;if(s&&s.classList.contains("pchmore"))s.textContent=d.classList.contains("open")?"Thu gọn":"Bấm vào để xem toàn bộ hướng dẫn"};d.onclick=t;const s=d.nextElementSibling;if(s&&s.classList.contains("pchmore"))s.onclick=t});
  m.querySelectorAll("tr[data-pchv]").forEach(tr=>tr.onclick=()=>{const r=PCH.ct.find(x=>x.id===+tr.dataset.pchv);if(r)openDrawerHTML(`<h2>Công thức ${esc(pchName(r.btp))} · bản ${r.version}</h2>${pchCtCompare(r)}`)});
  m.querySelectorAll("[data-pchdem]").forEach(i=>i.oninput=()=>{const v=i.value.trim();if(v==="")delete PCH.dem[i.dataset.pchdem];else PCH.dem[i.dataset.pchdem]=v});
  m.querySelectorAll("[data-pchmin]").forEach(i=>i.onchange=async()=>{const v=i.value.trim()===""?0:kfNum(i.value);if(!(v>=0)){toast("Mức đặt mua phải là số");return}
    try{await kApi("/items/"+encodeURIComponent(i.dataset.pchmin),{method:"PUT",body:JSON.stringify({min_stock:v})});const it=KHO.items.get(i.dataset.pchmin);if(it)it.min_stock=v;const r=typeof ktonRow==="function"&&ktonRow(i.dataset.pchmin);if(r)r.min_stock=v;toast("Đã lưu mức đặt mua "+(it?it.name:""))}catch(e){toast(e.message)}});
  const xem=m.querySelector("#pch-xem");if(xem)xem.onclick=async()=>{const L=Object.entries(PCH.dem).map(([item,v])=>({item,dem:kfNum(v)}));
    if(!L.length){$("#pch-e").innerHTML=`<div class="note red">Chưa gõ số đếm mã nào.</div>`;return}
    const bad=L.filter(l=>!(l.dem>=0));if(bad.length){$("#pch-e").innerHTML=`<div class="note red">Số đếm gõ chưa đúng: ${bad.map(l=>esc(pchName(l.item))).join(", ")}</div>`;return}
    xem.disabled=true;try{PCH.kq=await pApi("/ton",{method:"POST",body:JSON.stringify({preview:true,lines:L})});renderMain();scrollTo(0,0)}catch(e){xem.disabled=false;$("#pch-e").innerHTML=`<div class="note red">${esc(e.message)}</div>`}};
  const xoa=m.querySelector("#pch-xoa");if(xoa)xoa.onclick=()=>{if(confirm("Xóa hết số đã gõ?")){PCH.dem={};renderMain()}};
  const gui=m.querySelector("#pch-gui");if(gui)gui.onclick=pchTonSend;
  const sua=m.querySelector("#pch-sua");if(sua)sua.onclick=()=>{PCH.kq=null;renderMain()};
  m.querySelectorAll("[data-pchhv]").forEach(b=>b.onclick=()=>{PCH.hhView=b.dataset.pchhv;renderMain()});
  pchBindBox(m);
}
/* Vào web: người làm pha chế / mua hàng thì kiểm một lần xem có nguyên liệu sắp hết cần nhắc kiểm không. */
setTimeout(()=>{try{if(!ME||!(pchMeKT()||pchCanMin()))return;if(typeof ktonLoad==="function")ktonLoad();pchLoadCt().then(()=>{let n=0;const w=()=>{if(typeof KTON!=="undefined"&&KTON.rows)pchKiemCheck();else if(++n<20)setTimeout(w,3000)};w()}).catch(()=>{})}catch(e){}},6000);
