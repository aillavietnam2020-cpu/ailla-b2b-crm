/* =====================================================================
   ĐIỀU HÀNH: một trang duy nhất cho việc điều phối sản xuất, kho và đơn chờ xuất, đặt đầu "Sản xuất & kho".
   Thay cho 4 trang rời (Điều phối, Cần xử lý, Việc từng người, Theo dõi đơn): mọi việc cần làm gom vào MỘT danh sách,
   mỗi dòng có nút làm ngay; ô số bên trên bấm để lọc. Số liệu và cách tính giữ nguyên (xem trungtam.js).
   Hai trang còn lại (Việc từng người, Theo dõi đơn) mở bằng liên kết ở cuối trang.
   ===================================================================== */
TTX.f="";
const TT_KIND={quyet:["Cần quyết định","red"],xuat:["Chờ xuất kho","blu"],nhap:["Hàng chờ nhập","gry"],kiem:["Chờ kiểm kê","amb"]};
function ttTasks(){
  const out=[],today=ttDay(0);
  if(ttDp())ttDecisions().forEach(d=>out.push({k:"quyet",lv:d.c==="red"?0:1,c:d.c,t:d.t,h:d.h||"",btn:d.btn,go:d.go,act:d.act}));
  if(ttKho()){
    const k=ttKhoItems();
    k.ship.forEach(o=>{const due=o.ship_date||o.need_date||"",late=due&&due<today,soon=due===today;
      out.push({k:"xuat",lv:late?0:soon?1:2,c:late?"red":soon?"amb":"gry",t:`${o.order_no} · ${o.customer_name}`,h:`${o.lines.length} mã · Sale: ${o.owner_name||"—"}${due?" · "+(late?"quá hẹn ":soon?"hẹn hôm nay ":"hẹn ")+ttDd(due):""}`,btn:"Xuất kho",go:"kho_xuat_b2b"})});
    k.inb.forEach(p=>{const late=p.ngayVe&&p.ngayVe<today;
      out.push({k:"nhap",lv:late?0:2,c:late?"red":"gry",t:p.ten,h:`${nf(p.sl)} ${p.dvt||""}${p.ncc?" · "+p.ncc:""}${p.ngayVe?" · dự kiến về "+ttDd(p.ngayVe):""}${late?" · chậm":""}`,btn:"Nhập kho",go:"kho_nhap"})});
    k.kk.forEach(b=>out.push({k:"kiem",lv:1,c:"amb",t:sxP(b.sp).ten,h:`Xưởng báo ${nf(b.baoSL)} · ${(b.nguoi||[]).join(", ")}`,btn:"Kiểm kê",kk:b.id}));
  }
  return out.sort((a,b)=>a.lv-b.lv);
}
/* Một màn hình bao quát: 3 mảng (Đơn hàng · Sản xuất · Kho & mua hàng), mỗi dòng là một con số bấm được; số đang kẹt có chữ "kẹt" + tô đỏ. */
function ttBoard(){
  const today=ttDay(0),s=ttSx(),P=TTX.pend||[],cnt=(a,f)=>a.filter(f).length;
  let choDuyet=0;try{choDuyet=(D().b2b?D().b2b.orders.flatMap(o=>o.approvals||[]).filter(a=>a.status==="PENDING").length:0)}catch(e){}
  const quaHen=cnt(P,o=>{const d=o.ship_date||o.need_date||"";return d&&d<today});
  const R=s?s.requests:[],B=s?s.batches:[],PU=s?s.purchases:[];
  const ve=PU.filter(p=>p.st==="Đã đặt"),veCham=cnt(ve,p=>p.ngayVe&&p.ngayVe<today);
  const low=TTX.low||{},neg=(low.negative||[]).length,under=(low.low||[]).length;
  const T=(label,n,go,bad,note)=>({label,n,go,bad:!!bad&&n>0,note:note||""});
  return [
   ["Đơn hàng",[T("Chờ duyệt",choDuyet,"b2b_don",false),T("Chờ xuất kho",TTX.pend?P.length:"…","kho_xuat_b2b",false),T("Quá hẹn xuất",TTX.pend?quaHen:"…","kho_xuat_b2b",true,"kẹt"),T("Đã xuất 7 ngày qua",TTX.ship?TTX.ship.length:"…","tt_td",false)]],
   ["Sản xuất",[T("Cần làm",cnt(R,r=>r.st==="CAN_LAM"),"sx_nc",false),T("Đang làm",cnt(R,r=>r.st==="DANG_LAM"),"sx_td",false),T("Chờ kiểm kê",cnt(B,b=>b.st==="CHO_KIEM"),"sx_lo",false),T("Đã kiểm, chờ in tem / nhập kho",cnt(B,b=>["DA_KIEM","TEM_SAN","DA_IN"].includes(b.st)),"sx_lo",false)]],
   ["Kho & mua hàng",[T("Hàng đã đặt, chờ về",ve.length,"sx_mh",false),T("Hàng về chậm",veCham,"sx_mh",true,"kẹt"),T("Nguyên vật liệu dưới mức tối thiểu",TTX.low?under:"…","sx_mh",true,"thiếu"),T("Mã tồn kho đang âm",TTX.low?neg:"…","kho_ton",true,"cần đối chiếu")]]
  ];
}
/* Lịch việc của kho, theo NGÀY: đơn cần xuất ngày nào, hàng đặt dự kiến về ngày nào (trễ thì báo Thảo), lô chờ kiểm kê. */
const TT_WD=["Chủ nhật","Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"];
function ttDayLabel(d){const t=ttDay(0);if(!d)return "Chưa hẹn ngày";if(d<t)return "Quá hẹn";const dt=new Date(d+"T00:00:00Z"),w=TT_WD[dt.getUTCDay()]+" "+ttDd(d);return d===t?"Hôm nay · "+w:d===ttDay(1)?"Ngày mai · "+w:w}
function ttShipGroups(){
  const P=(TTX.pend||[]).slice().sort((a,b)=>String(a.ship_date||a.need_date||"9999").localeCompare(String(b.ship_date||b.need_date||"9999")));
  const thieu=new Set();ttShort().forEach(x=>x.orders.forEach(o=>thieu.add(o)));
  const G=new Map();
  P.forEach(o=>{const d=o.ship_date||o.need_date||"",k=!d?"~":d<ttDay(0)?"!":d;if(!G.has(k))G.set(k,{d,rows:[]});G.get(k).rows.push(o)});
  const keys=[...G.keys()].sort((a,b)=>(a==="!"?"":a==="~"?"~":a).localeCompare(b==="!"?"":b==="~"?"~":b));
  return keys.map(k=>({k,d:G.get(k).d,rows:G.get(k).rows})).map(g=>({...g,label:g.k==="!"?"Quá hẹn xuất":ttDayLabel(g.d),bad:g.k==="!",thieu}));
}
function ttKhoView(){
  const s=ttSx(),today=ttDay(0),G=ttShipGroups();
  const shipRows=G.length?G.map(g=>`<div class="ttday${g.bad?" bad":g.d===today?" today":""}"><h3>${esc(g.label)}<span>${g.rows.length} đơn</span></h3>${g.rows.map(o=>ttRow(`<b>${esc(o.order_no)} · ${esc(o.customer_name)}</b>${g.thieu.has(o.order_no)?` <em class="ttem">đang thiếu hàng</em>`:""}<br><small>${o.lines.length} mã · Sale: ${esc(o.owner_name||"—")}${o.kho_note?" · "+esc(o.kho_note):""}</small>`,`<button class="btn sm" data-ttprint="${o.id}">In phiếu</button> <button class="btn sm pri" data-ttgo="kho_xuat_b2b">Ghi thực xuất</button>`)).join("")}</div>`).join(""):`<p class="empty pad">${TTX.pend?"Không có đơn nào chờ xuất.":"Đang tải…"}</p>`;
  const PU=(s?s.purchases:[]).filter(p=>p.st==="Đã đặt").sort((a,b)=>String(a.ngayVe||"9999").localeCompare(String(b.ngayVe||"9999")));
  const buyRows=PU.length?PU.map(p=>{const late=p.ngayVe&&p.ngayVe<today,days=late?Math.round((new Date(today)-new Date(p.ngayVe))/864e5):0;
    const state=!p.ngayVe?`<em class="ttem">chưa ghi ngày dự kiến về</em>`:late?`<em class="ttem">trễ ${days} ngày</em>`:p.ngayVe===today?`<em class="ttem amb">về hôm nay</em>`:"";
    const btn=p.baoKt?`<span class="hint">Đã báo chị Thảo ${esc(String(p.baoKt.at||"").slice(0,16))}</span>`:(late||!p.ngayVe)?`<button class="btn sm" data-ttbao="${p.id}">Báo chị Thảo kiểm tra</button>`:"";
    return ttRow(`<b>${esc(p.ten)}</b> ${state}<br><small>${nf(p.sl)} ${esc(p.dvt||"")}${p.ncc?" · "+esc(p.ncc):" · chưa ghi nhà cung cấp"}${p.ngayVe?" · dự kiến về "+ttDd(p.ngayVe):""}</small>`,`${btn} <button class="btn sm${late||p.ngayVe===today?" pri":""}" data-ttgo="kho_nhap">Nhập kho</button>`)}).join(""):`<p class="empty pad">Không có hàng nào đang chờ về.</p>`;
  const kk=(s?s.batches:[]).filter(b=>b.st==="CHO_KIEM"),sau=(s?s.batches:[]).filter(b=>["DA_KIEM","TEM_SAN","DA_IN"].includes(b.st));
  const kkRows=kk.map(b=>ttRow(`<b>${esc(sxP(b.sp).ten)}</b><br><small>Xưởng báo ${nf(b.baoSL)} · ${esc((b.nguoi||[]).join(", "))}</small>`,`<button class="btn sm pri" data-kk="${b.id}">Kiểm kê</button>`)).join("")+sau.map(b=>ttRow(`<b>${esc(sxP(b.sp).ten)}</b> ${pill("đã kiểm","grn")}<br><small>Lô ${esc(b.ma||"")} · còn in tem / nhập kho</small>`,`<button class="btn sm" data-ttgo="sx_lo">Mở</button>`)).join("");
  const none=!PU.length&&!kkRows;
  return `<section class="card ttw"><div class="card-h"><h2>Đơn cần xuất, theo ngày</h2><span class="hint">${TTX.pend?TTX.pend.length+" đơn":"đang tải…"}</span></div>${shipRows}</section>
   ${none?`<p class="ttnone">Hàng đặt đang chờ về: không có · Lô chờ kiểm kê: không có</p>`:`<div class="sxgrid2 ttgrid"><section class="card"><div class="card-h"><h2>Hàng đặt, chờ về</h2><span class="hint">trễ hoặc chưa có ngày thì báo chị Thảo</span></div><div class="sxalerts">${buyRows}</div></section>
   <section class="card"><div class="card-h"><h2>Kiểm kê hàng sản xuất</h2></div><div class="sxalerts">${kkRows||`<p class="empty pad">Không có lô nào chờ kiểm kê.</p>`}</div></section></div>`}`;
}
function ttKhoBind(m){
  m.querySelectorAll("[data-ttprint]").forEach(b=>b.onclick=()=>window.open("/print/orders/"+b.dataset.ttprint+"?type=ship","_blank"));
  m.querySelectorAll("[data-ttbao]").forEach(b=>b.onclick=()=>{const id=b.dataset.ttbao;sxMut("báo chị Thảo kiểm tra hàng đặt "+id,s=>{const x=s.purchases.find(q=>q.id===id);if(x)x.baoKt={at:sxNow(),by:ME.name}});toast("Đã báo chị Thảo kiểm tra hàng này");renderMain()});
}
PAGES.tt_home=m=>{
  const all=ttTasks().slice(0,6),B=ttBoard();
  const tile=t=>`<button type="button" class="tttile${t.bad?" bad":""}" data-ttgo="${t.go}"><span class="ttl">${esc(t.label)}${t.bad?` <em>${esc(t.note)}</em>`:""}</span><b class="ttn">${t.n}</b></button>`;
  const col=([name,rows])=>{const bad=rows.filter(r=>r.bad).length;return `<section class="ttcol${bad?" hasbad":""}"><h2>${name}${bad?`<span class="ttwarn">${bad} chỗ kẹt</span>`:`<span class="ttok">ổn</span>`}</h2>${rows.map(tile).join("")}</section>`};
  const rows=all.length?all.map(x=>{
    const btn=x.act==="req"?`<button class="btn sm pri" data-ttreq="1">${esc(x.btn)}</button>`:x.kk?`<button class="btn sm pri" data-kk="${x.kk}">${esc(x.btn)}</button>`:`<button class="btn sm${x.lv===0?" pri":""}" data-ttgo="${x.go}">${esc(x.btn||"Xem")}</button>`;
    return ttRow(`${pill(TT_KIND[x.k][0],x.c)} <b>${esc(x.t)}</b>${x.h?`<br><small>${esc(x.h)}</small>`:""}`,btn)}).join(""):`<p class="empty pad">${TTX.pend||TTX.low?"Hôm nay không có việc gấp nào.":"Đang tải…"}</p>`;
  ttFrame(m,"tt_home",ttDp()?"Điều hành":"Việc của kho",ttDp()?"Bao quát, quyết định và theo dõi việc kho":"Đơn cần xuất theo ngày, hàng chờ về, kiểm kê",
   `${ttDp()?`<div class="ttb">${B.map(col).join("")}</div>
   <section class="card ttw"><div class="card-h"><h2>Cần quyết định</h2></div><div class="sxalerts">${ttDecisions().length?ttDecisions().map(d=>ttRow(`${pill(d.c==="red"?"Gấp":"Lưu ý",d.c)} <b>${esc(d.t)}</b>${d.h?`<br><small>${esc(d.h)}</small>`:""}`,d.act==="req"?`<button class="btn sm pri" data-ttreq="1">${esc(d.btn)}</button>`:`<button class="btn sm${d.c==="red"?" pri":""}" data-ttgo="${d.go}">${esc(d.btn||"Xem")}</button>`)).join(""):`<p class="empty pad">Hiện chưa có việc nào cần quyết định.</p>`}</div></section>`:""}
   ${ttKho()||ttDp()?ttKhoView():""}
   <div class="acts">${ttDp()?`<button class="btn" data-ttgo="tt_nv">Việc của từng người →</button>`:""}<button class="btn" data-ttgo="tt_td">Theo dõi đơn theo bước →</button></div>`);
  m.querySelectorAll("[data-ttreq]").forEach(b=>b.onclick=()=>{PAGE="sx_nc";renderMain();setTimeout(()=>{if($("#sx-new"))$("#sx-new").click()},60)});
  ttKhoBind(m);
};
/* Hai trang phụ: thêm nút quay về Điều hành ở đầu trang */
["tt_nv","tt_td","tt_dp","tt_xl"].forEach(k=>{const f=PAGES[k];if(!f)return;PAGES[k]=function(m){f.apply(this,arguments);if(m.querySelector(".ttback"))return;const h=m.querySelector(".sxhead");if(h)h.insertAdjacentHTML("beforebegin",`<p class="ttback"><button class="lnk" data-ttgo="tt_home">← Về Điều hành</button></p>`);m.querySelectorAll(".ttback [data-ttgo]").forEach(b=>b.onclick=()=>{PAGE="tt_home";renderMain();scrollTo(0,0)})}});
/* Dùng luôn "Tổng quan Sản xuất" làm trang việc: đầu trang là việc cần làm (kho: đơn xuất theo ngày, hàng chờ về, kiểm kê;
   điều phối: thêm "Cần quyết định"), bên dưới là luồng sản xuất như cũ. Không còn mục "Điều hành" riêng. */
function ttDecisionCard(){
  const D0=ttDecisions();
  return `<section class="card ttw"><div class="card-h"><h2>Cần quyết định</h2></div><div class="sxalerts">${D0.length?D0.map(d=>ttRow(`${pill(d.c==="red"?"Gấp":"Lưu ý",d.c)} <b>${esc(d.t)}</b>${d.h?`<br><small>${esc(d.h)}</small>`:""}`,d.act==="req"?`<button class="btn sm pri" data-ttreq="1">${esc(d.btn)}</button>`:`<button class="btn sm${d.c==="red"?" pri":""}" data-ttgo="${d.go}">${esc(d.btn||"Xem")}</button>`)).join(""):`<p class="empty pad">Hiện chưa có việc nào cần quyết định.</p>`}</div></section>`;
}
function ttInject(m){
  if(!ttAny()||m.querySelector(".ttwork"))return;
  if(!TTX.at)ttLoad();
  const k=m.querySelector(".sxgrid3")||m.querySelector(".sxkpis");if(!k)return;
  k.insertAdjacentHTML("beforebegin",`<div class="ttwork">${ttDp()?ttDecisionCard():""}${ttKhoView()}</div>`);
  const w=m.querySelector(".ttwork");
  w.querySelectorAll("[data-ttgo]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.ttgo;renderMain();scrollTo(0,0)});
  w.querySelectorAll("[data-ttreq]").forEach(b=>b.onclick=()=>{PAGE="sx_nc";renderMain();setTimeout(()=>{if($("#sx-new"))$("#sx-new").click()},60)});
  w.querySelectorAll("[data-kk]").forEach(b=>b.onclick=()=>sxInspect(b.dataset.kk));
  ttKhoBind(w);
}
["sx","sx_tq"].forEach(k=>{const f=PAGES[k];if(!f)return;PAGES[k]=function(m){const r=f.apply(this,arguments);ttInject(m);return r}});
PAGES.tt_home=m=>{PAGE="sx_tq";PAGES.sx_tq(m)};
{
  const i=MODULES.findIndex(x=>x.k==="tt"),sx=MODULES.find(x=>x.k==="sx");
  if(i>=0)MODULES.splice(i,1);
  if(sx){
    const g0=sx.groups;
    sx.groups=()=>g0().map(([n,its])=>[n,its.map(it=>it[0]==="sx_tq"?[it[0],it[1],it[2],()=>{try{return ttCount()||""}catch(e){return ""}}]:it)]);
  }
}
