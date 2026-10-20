/* =====================================================================
   TRUNG TÂM ĐIỀU HÀNH
   Mỗi người vào là thấy việc của mình: kế toán kho thấy "Cần xử lý" (đơn chờ xuất, hàng chờ nhập, lô chờ kiểm kê);
   Thảo (điều phối sản xuất) và CEO thấy "Điều phối" (cần quyết định, thiếu hàng, tồn đủ bao nhiêu ngày) và
   xem được việc của từng nhân sự. Giai đoạn 1 chỉ hiện SỐ THẬT, chưa tự đề xuất số lượng/thời gian về hàng.
   ===================================================================== */
const TTX={pend:null,ship:null,low:null,out:null,err:"",at:0,busy:false,who:"",timer:0};
const ttKho=()=>!!ME&&(ME.role==="admin"||(typeof SV!=="undefined"&&SV.perms&&SV.perms.includes("order.kho.process"))||can(ME,"sx.kiemke"));
const ttDp=()=>!!ME&&(ME.role==="admin"||can(ME,"sx.dieuphoi"));
const ttAny=()=>ttKho()||ttDp();
const ttDay=d=>{const x=new Date(Date.now()+7*3600e3+(d||0)*864e5);return x.toISOString().slice(0,10)};
const ttDd=s=>s?s.slice(8,10)+"/"+s.slice(5,7):"";
async function ttLoad(force){
  if(TTX.busy||!ttAny())return;
  if(!force&&TTX.at&&Date.now()-TTX.at<20000)return;
  TTX.busy=true;
  try{
    const jobs=[kApi("/b2b-pending"),kApi("/b2b-shipped?from="+ttDay(-7)+"&to="+ttDay(0))];
    if(ttDp()){jobs.push(kApi("/alerts"));jobs.push(kApi("/nxt?from="+ttDay(-30)+"&to="+ttDay(0)))}
    const r=await Promise.all(jobs.map(p=>p.catch(e=>null)));
    const prevN=TTX.pend?TTX.pend.length:null,prevC=TTX.at?ttCount():null;
    TTX.pend=r[0]||[];TTX.ship=r[1]||[];TTX.low=r[2]||null;TTX.out=r[3]||null;TTX.err=r[0]?"":"Không tải được đơn chờ xuất";TTX.at=Date.now();
    /* Đơn vừa được duyệt (số đơn chờ xuất tăng): báo cho kho, và cập nhật chấm đỏ trên menu. */
    if(prevN!==null&&ttKho()&&TTX.pend.length>prevN)toast("Có "+(TTX.pend.length-prevN)+" đơn mới được duyệt, chờ xuất kho");
    if(prevC!==null&&ttCount()!==prevC){const ae=document.activeElement,typing=ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName),modal=document.querySelector(".modal,.mdl,[role=dialog]");
      if(!typing&&!modal&&typeof render==="function")try{render()}catch(x){}}}
  catch(e){TTX.err=e.message||"Không tải được"}
  TTX.busy=false;
  if(/^tt_/.test(PAGE))renderMain();
}
/* ---------- Số liệu ---------- */
function ttSx(){try{sxShape(D());return SX()}catch(e){return null}}
function ttKhoItems(){
  const s=ttSx();if(!s)return {ship:[],inb:[],kk:[]};
  const today=ttDay(0);
  return {
    ship:TTX.pend||[],
    inb:s.purchases.filter(p=>p.st==="Đã đặt"||(p.st==="Đã duyệt"&&p.ngayVe)),
    kk:s.batches.filter(b=>b.st==="CHO_KIEM"),
    today};
}
/* Đơn chờ xuất cần bao nhiêu từng sản phẩm so với tồn sẵn sàng → mã thiếu. */
function ttShort(){
  const s=ttSx();if(!s||!TTX.pend)return [];
  const need={};
  TTX.pend.forEach(o=>(o.lines||[]).forEach(l=>{const m=sxMap(l.sku);if(!m||!m.sp)return;
    const q=l.qty*(m.heSo||1),k=m.sp;need[k]=need[k]||{sp:k,need:0,orders:new Set()};need[k].need+=q;need[k].orders.add(o.order_no)}));
  const stock={};sxStock().forEach(o=>stock[o.sp]=o);
  return Object.values(need).map(n=>{const st=stock[n.sp]||{san:0,dangLam:0,choNhap:0};return {sp:n.sp,need:n.need,san:st.san,thieu:Math.max(0,n.need-st.san),dangLam:st.dangLam||0,choNhap:st.choNhap||0,orders:[...n.orders]}}).filter(x=>x.thieu>0).sort((a,b)=>b.thieu-a.thieu);
}
function ttDecisions(){
  const s=ttSx();if(!s)return [];
  const A=[],today=ttDay(0);
  ttShort().forEach(x=>A.push({c:"red",t:`${sxP(x.sp).ten}: đơn đang chờ cần ${nf(x.need)}, sẵn sàng ${nf(x.san)}, thiếu ${nf(x.thieu)}`,h:`Đơn: ${x.orders.slice(0,4).join(", ")}${x.orders.length>4?"…":""}${x.dangLam?" · đã có "+x.dangLam+" phiếu đang làm":""}`,btn:"Tạo phiếu sản xuất",act:"req"}));
  s.requests.filter(r=>r.uu==="Gấp"&&r.st==="CAN_LAM").forEach(r=>A.push({c:"red",t:`${sxP(r.sp).ten}: phiếu sản xuất gấp chưa bắt đầu`,h:`${r.id} · ${r.nguon}`,btn:"Xem",go:"sx_td"}));
  s.purchases.filter(p=>p.st==="Đề nghị").forEach(p=>A.push({c:"amb",t:`Đề nghị mua chờ duyệt: ${p.ten}`,h:`${nf(p.sl)} ${p.dvt||""}${p.nguoi?" · "+p.nguoi:""}`,btn:"Xem",go:"sx_mh"}));
  s.purchases.filter(p=>p.st==="Đã đặt"&&p.baoKt).forEach(p=>A.push({c:"red",t:`Kho báo: ${p.ten} chưa thấy về`,h:`${p.baoKt.by||"Kho"} báo ${String(p.baoKt.at||"").slice(0,16)} · kiểm tra lại với nhà cung cấp${p.ncc?" ("+p.ncc+")":""}, rồi cập nhật ngày về hoặc bấm Đã về`,btn:"Xem",go:"sx_mh"}));
  s.purchases.filter(p=>p.st==="Đã đặt"&&p.ngayVe&&p.ngayVe<today).forEach(p=>A.push({c:"red",t:`${p.ten} về chậm`,h:`dự kiến ${ttDd(p.ngayVe)}${p.ncc?" · "+p.ncc:""}`,btn:"Xem",go:"sx_mh"}));
  if(TTX.low){
    /* Gộp: mỗi loại cảnh báo kho là MỘT dòng, không mỗi mã một dòng. */
    const neg=TTX.low.negative||[],low=TTX.low.low||[];
    const names=l=>l.slice(0,3).map(x=>x.name).join(", ")+(l.length>3?" và "+(l.length-3)+" mã khác":"");
    if(neg.length)A.push({c:"red",t:`${neg.length} mã trong kho đang âm tồn`,h:`${names(neg)}. Thường do chưa nhập tồn đầu hoặc nhập xuất sai mã, cần đối chiếu.`,btn:"Xem tồn kho",go:"kho_ton"});
    if(low.length)A.push({c:"amb",t:`${low.length} nguyên vật liệu dưới mức tối thiểu`,h:names(low),btn:"Mua hàng",go:"sx_mh"})}
  return A;
}
function ttCount(){
  if(!ttAny())return "";
  let n=0;
  if(ttKho()){const k=ttKhoItems();n+=k.ship.length+k.kk.length+k.inb.filter(p=>p.ngayVe&&p.ngayVe<=ttDay(0)).length}
  if(ttDp()&&!ttKho())n+=ttDecisions().length;
  else if(ttDp())n=Math.max(n,ttDecisions().length);
  return n||"";
}
/* ---------- Khung ---------- */
const TTX_TABS=[["tt_dp","Điều phối",ttDp],["tt_xl","Cần xử lý",ttKho],["tt_nv","Việc của từng người",ttDp],["tt_td","Theo dõi đơn",ttAny]];
function ttFrame(m,key,title,sub,body){
  const tabs=TTX_TABS.filter(t=>t[2]());
  m.innerHTML=`<div class="sxhead"><div><h1>${title}</h1><div class="ph-sub">${sub}</div></div><div class="sxact"><button class="btn sm" id="tt-re">Tải lại</button></div></div>
  <nav class="sxtabs">${tabs.map(([k,t])=>`<button class="${k===key?"on":""}" data-sxt="${k}">${t}</button>`).join("")}</nav>${TTX.err?`<div class="note red">${esc(TTX.err)}</div>`:""}${body}`;
  if(m.querySelector("#tt-re"))m.querySelector("#tt-re").onclick=()=>{ttLoad(true);toast("Đang tải lại…")};
  m.querySelectorAll("[data-ttgo]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.ttgo;renderMain();scrollTo(0,0)});
  sxBindCommon(m);
  if(!TTX.at)ttLoad();
}
const ttKpi=(l,v,h,c)=>`<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div>${h?`<div class="h">${h}</div>`:""}</div>`;
const ttRow=(left,right)=>`<div class="sxal"><span style="flex:1;min-width:0">${left}</span>${right||""}</div>`;
/* ---------- 1. Cần xử lý (kế toán kho) ---------- */
PAGES.tt_xl=m=>{
  const k=ttKhoItems(),today=ttDay(0);
  const ship=!TTX.pend?`<p class="hint pad">Đang tải…</p>`:k.ship.length?k.ship.map(o=>{const due=o.ship_date||o.need_date||"",late=due&&due<today,soon=due===today;
    return ttRow(`<b>${esc(o.order_no)} · ${esc(o.customer_name)}</b><br><small>${o.lines.length} mã · Sale: ${esc(o.owner_name||"")}</small><br>${due?pill((late?"Quá hẹn ":soon?"Hôm nay ":"Hẹn ")+ttDd(due),late?"red":soon?"amb":"gry"):pill("Không hẹn","gry")}`,`<button class="btn sm pri" data-ttgo="kho_xuat_b2b">Xuất kho</button>`)}).join(""):`<p class="empty pad">Không có đơn nào chờ xuất. Đơn được duyệt xong sẽ hiện ở đây.</p>`;
  const inb=k.inb.length?k.inb.map(p=>{const late=p.ngayVe&&p.ngayVe<today;return ttRow(`<b>${esc(p.ten)}</b><br><small>${nf(p.sl)} ${esc(p.dvt||"")}${p.ncc?" · "+esc(p.ncc):""}${p.ngayVe?" · dự kiến về "+ttDd(p.ngayVe):""}</small>`,`${late?pill("Chậm","red"):""}<button class="btn sm" data-ttgo="kho_nhap">Nhập kho</button>`)}).join(""):`<p class="empty pad">Chưa có hàng nào chờ về.</p>`;
  const kk=k.kk.length?k.kk.map(b=>ttRow(`<b>${esc(sxP(b.sp).ten)}</b><br><small>Xưởng báo ${nf(b.baoSL)} · ${esc((b.nguoi||[]).join(", "))}</small>`,`<button class="btn sm pri" data-kk="${b.id}">Kiểm kê</button>`)).join(""):`<p class="empty pad">Không có lô nào chờ kiểm kê.</p>`;
  ttFrame(m,"tt_xl","Cần xử lý hôm nay","Việc của kho: xuất hàng, nhập hàng, kiểm kê",
   `<div class="kpis">${ttKpi("Đơn chờ xuất",TTX.pend?k.ship.length:"…","đã duyệt, chưa xuất")}${ttKpi("Hàng chờ nhập",k.inb.length,"đã đặt, chưa về")}${ttKpi("Chờ kiểm kê",k.kk.length,"lô xưởng đã báo xong")}</div>
   <div class="sxgrid3"><section class="card"><div class="card-h"><h2>Đơn chờ xuất kho</h2><button class="lnk" data-ttgo="kho_xuat_b2b">Mở trang xuất kho ›</button></div><div class="sxalerts">${ship}</div></section>
   <section class="card"><div class="card-h"><h2>Hàng sắp về, chờ nhập kho</h2></div><div class="sxalerts">${inb}</div></section>
   <section class="card"><div class="card-h"><h2>Chờ kiểm kê</h2></div><div class="sxalerts">${kk}</div></section></div>`);
};
/* ---------- 2. Điều phối (Thảo, CEO) ---------- */
PAGES.tt_dp=m=>{
  const s=ttSx(),D0=ttDecisions(),stock=s?sxStock():[],today=ttDay(0);
  const out={};if(TTX.out)TTX.out.forEach(r=>out[r.code]=r.qty_out);
  const dec=D0.length?D0.map(d=>ttRow(`${pill(d.c==="red"?"Gấp":"Lưu ý",d.c)} <b>${esc(d.t)}</b>${d.h?`<br><small>${esc(d.h)}</small>`:""}`,d.act==="req"?`<button class="btn sm pri" id="tt-req">${d.btn}</button>`:`<button class="btn sm" data-ttgo="${d.go}">${d.btn}</button>`)).join(""):`<p class="empty pad">Hiện chưa có việc nào cần quyết định.</p>`;
  const rows=stock.map(o=>{const p=sxP(o.sp),q=out[o.sp]||0,avg=q/30,days=avg>0?o.san/avg:null,sh=ttShort().find(x=>x.sp===o.sp);
    const c=days===null?"gry":days<5?"red":days<10?"amb":"grn";
    return `<tr><td>${esc(p.ten)}</td><td class="n">${nf(o.san)}</td><td class="n">${avg?nf(Math.round(avg*10)/10):"—"}</td><td>${days===null?`<span class="hint">chưa có số bán</span>`:pill("đủ "+(days>=100?"100+":nf(Math.round(days*10)/10))+" ngày",c)}</td><td class="n">${o.dangLam?o.dangLam+" phiếu":"—"}</td><td>${sh?pill("thiếu "+nf(sh.thieu)+" cho đơn chờ","red"):`<span class="hint">không</span>`}</td></tr>`}).join("");
  const nvl=TTX.low?[...(TTX.low.negative||[]),...(TTX.low.low||[])]:[];
  const nvlRows=nvl.slice(0,12).map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${nf(x.qty)} ${esc(x.unit||"")}</td><td class="n">${x.min_stock?nf(x.min_stock):"—"}</td><td>${x.qty<0?pill("âm","red"):pill("dưới mức tối thiểu","amb")}</td></tr>`).join("");
  const mh=s?s.purchases.filter(p=>p.st!=="Đã về"&&p.st!=="Hủy"):[];
  ttFrame(m,"tt_dp","Điều phối","Cần quyết định gì, thiếu gì, đang chạy tới đâu",
   `<div class="kpis">${ttKpi("Cần quyết định",D0.length,"")}${ttKpi("Đơn chờ xuất",TTX.pend?TTX.pend.length:"…","")}${ttKpi("Mã thiếu cho đơn chờ",TTX.pend?ttShort().length:"…","")}${ttKpi("Đang sản xuất",s?s.requests.filter(r=>r.st==="DANG_LAM").length:"…","phiếu")}</div>
   <section class="card"><div class="card-h"><h2>Cần quyết định ngay</h2></div><div class="sxalerts">${dec}</div></section>
   <section class="card"><div class="card-h"><h2>Thành phẩm: tồn đủ bao nhiêu ngày bán</h2><span class="hint">bán trung bình 30 ngày gần nhất</span></div><p class="hint pad" style="margin:0">Chỉ hiện số thật. Chưa tự đoán nên làm bao nhiêu hay mua bao lâu: sẽ đề xuất sau khi vận hành đủ dữ liệu.</p>${rows?tbl(["Sản phẩm","Sẵn sàng","Bán TB/ngày","Đủ bán","Đang làm","Đơn chờ"],[rows]):`<p class="empty pad">Chưa có số liệu.</p>`}</section>
   <div class="sxgrid2"><section class="card"><div class="card-h"><h2>Nguyên vật liệu cần chú ý</h2><button class="lnk" data-ttgo="kho_ton">Xem kho ›</button></div>${nvlRows?tbl(["Nguyên vật liệu","Còn","Tối thiểu","Tình trạng"],[nvlRows]):`<p class="empty pad">Không có nguyên vật liệu nào dưới mức.</p>`}</section>
   <section class="card"><div class="card-h"><h2>Mua hàng đang mở</h2><button class="lnk" data-ttgo="sx_mh">Mở mua hàng ›</button></div><div class="sxalerts">${mh.slice(0,8).map(p=>ttRow(`<b>${esc(p.ten)}</b><br><small>${nf(p.sl)} ${esc(p.dvt||"")} · ${esc(p.st)}${p.ncc?" · "+esc(p.ncc):" · chưa ghi nhà cung cấp"}${p.ngayDat?" · đặt "+ttDd(p.ngayDat):""}${p.ngayVe?" · về "+ttDd(p.ngayVe):""}</small>`)).join("")||`<p class="empty pad">Không có đề nghị mua đang mở.</p>`}</div></section></div>`);
  if($("#tt-req"))$("#tt-req").onclick=()=>{PAGE="sx_nc";renderMain();setTimeout(()=>{if($("#sx-new"))$("#sx-new").click()},60)};
};
/* ---------- 3. Việc của từng người ---------- */
PAGES.tt_nv=m=>{
  const users=(D().users||[]).filter(u=>u.active!==false).map(u=>u.name).filter(Boolean);
  let items=[];try{items=cvItems()}catch(e){}
  const list=TTX.who?[TTX.who]:users;
  const open=x=>x.st!=="done";
  const card=p=>{const its=items.filter(x=>open(x)&&(x.nguoi===p||(x.phoi||[]).includes(p))).sort((a,b)=>(b.late?1:0)-(a.late?1:0)||String(a.han).localeCompare(String(b.han)));
    return its.length||TTX.who?`<section class="card"><div class="card-h"><h2>${esc(p)}</h2><span class="hint">${its.length} việc${its.some(x=>x.late)?" · "+its.filter(x=>x.late).length+" trễ":""}</span></div><div class="sxalerts">${its.slice(0,12).map(x=>ttRow(`<b>${esc(x.ten)}</b>${x.han?`<br><small>hạn ${esc(String(x.han))}</small>`:""}`,x.late?pill("Trễ","red"):pill(x.st==="doing"?"Đang làm":"Chờ làm","gry"))).join("")||`<p class="empty pad">Không có việc đang mở.</p>`}</div></section>`:""};
  ttFrame(m,"tt_nv","Việc của từng người","Chọn một người để xem họ đang giữ việc gì",
   `<div class="filters"><label>Xem việc của <select id="tt-who"><option value="">Tất cả mọi người</option>${users.map(u=>`<option ${u===TTX.who?"selected":""}>${esc(u)}</option>`).join("")}</select></label></div>
   <div class="sxgrid3">${list.map(card).join("")||`<p class="empty">Chưa có việc nào.</p>`}</div>`);
  if($("#tt-who"))$("#tt-who").onchange=e=>{TTX.who=e.target.value;renderMain()};
};
/* ---------- 4. Theo dõi đơn ---------- */
PAGES.tt_td=m=>{
  const S=["Duyệt","Chờ xuất","Đã xuất"];
  const step=(i)=>`<div class="steps">${S.map((x,j)=>`<span class="${j<i?"d":j===i?"c":""}">${x}</span>`).join("")}</div>`;
  const stl=`<style>.steps{display:flex;gap:4px;flex-wrap:wrap}.steps span{padding:2px 9px;border-radius:999px;background:#eceae4;color:#7a746a;font-size:12px}.steps span.d{background:#e6f4ea;color:#2f7d4f}.steps span.c{background:#1f6f5c;color:#fff;font-weight:600}</style>`;
  const p=(TTX.pend||[]).map(o=>ttRow(`<b>${esc(o.order_no)} · ${esc(o.customer_name)}</b><br><small>Sale: ${esc(o.owner_name||"")}${o.ship_date||o.need_date?" · hẹn "+ttDd(o.ship_date||o.need_date):""}</small>`,step(1))).join("");
  const sh=(TTX.ship||[]).slice(0,15).map(o=>ttRow(`<b>${esc(o.order_no)} · ${esc(o.customer_name)}</b><br><small>xuất ${ttDd(o.shipped_day)}${o.shipped_by_name?" bởi "+esc(o.shipped_by_name):""}</small>`,step(3))).join("");
  ttFrame(m,"tt_td","Theo dõi đơn","Mỗi đơn đang nằm ở bước nào",
   `${stl}<div class="sxgrid2"><section class="card"><div class="card-h"><h2>Đang chờ xuất</h2><span class="hint">${TTX.pend?TTX.pend.length:"…"} đơn</span></div><div class="sxalerts">${p||`<p class="empty pad">Không có đơn nào đang chờ xuất.</p>`}</div></section>
   <section class="card"><div class="card-h"><h2>Đã xuất 7 ngày qua</h2><span class="hint">${TTX.ship?TTX.ship.length:"…"} đơn</span></div><div class="sxalerts">${sh||`<p class="empty pad">Chưa có đơn nào xuất trong 7 ngày qua.</p>`}</div></section></div>`);
};
/* ---------- 5. Dòng sản xuất ---------- */
PAGES.tt_sx=m=>{
  const s=ttSx();if(!s){ttFrame(m,"tt_sx","Dòng sản xuất","","<p class=\"hint pad\">Đang tải…</p>");return}
  const R=s.requests,B=s.batches;
  const rq=r=>`<div class="sxmini" data-sxr="${r.id}"><b>${esc(sxP(r.sp).ten)}</b><div>${pill(r.nguon,"gry")} ${r.uu==="Gấp"?pill("Gấp","red"):""}</div><small>${esc(r.tao||"")} · SL: ${r.sl?nf(r.sl):"chưa chốt"}</small></div>`;
  const bt=b=>`<div class="sxmini" data-sxb="${b.id}"><b>${esc(sxP(b.sp).ten)}</b><small>${b.ma?"Lô "+esc(b.ma):"Xưởng báo "+nf(b.baoSL)} · ${esc((b.nguoi||[]).join(", ")||"—")}</small></div>`;
  const col=(t,c,items)=>`<div class="sxcol c-${c}"><h3>${t} (${items.length})</h3>${items.slice(0,8).join("")||`<p class="empty">—</p>`}</div>`;
  ttFrame(m,"tt_sx","Dòng sản xuất","Từ lúc tạo phiếu đến lúc nhập kho",
   `<section class="card"><div class="sxcols">${col("Cần làm","pnk",R.filter(r=>r.st==="CAN_LAM").map(rq))}${col("Đang sản xuất","grn",R.filter(r=>r.st==="DANG_LAM").map(rq))}${col("Chờ kiểm kê","org",B.filter(b=>b.st==="CHO_KIEM").map(bt))}${col("Đã kiểm, tạo tem","blu",B.filter(b=>["DA_KIEM","TEM_SAN","DA_IN"].includes(b.st)).map(bt))}${col("Đã nhập kho","vio",B.filter(b=>b.st==="SAN_SANG").slice(-6).map(bt))}</div></section>`);
};
/* ---------- Đăng ký menu ---------- */
{
  const first=()=>ttDp()?"tt_dp":"tt_xl";
  const mod={k:"tt",zone:"",ic:"home",n:"Trung tâm điều hành",sub:"",groups:()=>[["",[
    MI("tt_dp","Điều phối",()=>ttDp(),()=>ttDp()?ttCount():""),
    MI("tt_xl","Cần xử lý",()=>ttKho(),()=>ttKho()?ttCount():""),
    MI("tt_nv","Việc của từng người",()=>ttDp()),
    MI("tt_td","Theo dõi đơn",()=>ttAny())]]]};
  const i=MODULES.findIndex(x=>x.k==="exec");MODULES.splice(i+1,0,mod);
  setInterval(()=>{try{if(typeof ME!=="undefined"&&ME&&ttAny()&&document.visibilityState==="visible")ttLoad(true)}catch(e){}},120000);
  setTimeout(()=>{try{if(ME&&ttAny())ttLoad(true)}catch(e){}},4000);
}
