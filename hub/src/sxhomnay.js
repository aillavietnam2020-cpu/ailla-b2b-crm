/* =====================================================================
   ĐIỀU PHỐI SẢN XUẤT (chị Hoa duyệt demo v5 21/11/2026) — trang cho CEO và người quản lý điều phối sản xuất.
   4 tab:
   · Kế hoạch: 4 ô số · thanh tải xưởng (hôm nay + 5 ngày, bấm để lọc) · một danh sách lệnh xếp theo ưu tiên
     (Quá hạn / Hôm nay / từng ngày đề xuất; kéo thả đổi thứ tự trong ngày) · khung Đơn cần xuất bên phải.
     Lịch đề xuất do máy chủ tính: /api/hub/kho/lich-sx (services/lichSx.ts); chốt ngày đầu → tạo lệnh sản xuất.
   · Màn hình xưởng (điện thoại): Bắt đầu (số người) · Tạm dừng (lý do → giờ gián tiếp) · Xong (số lượng → báo hoàn thành,
     chuyển kế toán kiểm như trang Tiến độ xưởng). Web tự ghi giờ vào báo cáo sản lượng.
   · Báo cáo sản lượng: tự lập từ màn hình xưởng, sửa / thêm tay được. "Công việc gián tiếp" không tính vào giá thành.
   · Định mức năng suất: tổng sản lượng ÷ tổng giờ công, gom theo lệnh; áp dụng khi sản phẩm có từ 3 lần làm.
   Sổ ghi lưu trong dữ liệu Sản xuất (SX().nk), ghi qua sxMut như các thao tác sản xuất khác.
   Dòng nk: {id, ngay, sp, psx?, nguoi, tu, den, sl, ghi, by, at, live?} — live = đang chạy ở màn hình xưởng (chưa có giờ kết thúc).
   ===================================================================== */
const HN={tab:"kh",day:"",draft:null,draftDay:"",orders:null,at:0,busy:false,err:"",lich:null,lichAt:0,lichBusy:false,lichErr:"",off:{},f:null,cfg:false,dirty:false,drag:""};
const hnOk=()=>typeof mhManage==="function"&&mhManage();
const HN_KHAC="__khac";
/* "7:30" → 7.5 giờ; sai định dạng → NaN */
const hnH=t=>{const m=String(t||"").trim().match(/^(\d{1,2})(?:[:h.](\d{0,2}))?$/i);return m?(+m[1])+(+(m[2]||0))/60:NaN};
/* giá trị cho ô giờ (type=time cần dạng 07:30) */
const hnTime=t=>{const h=hnH(t);if(!isFinite(h))return "";const H=Math.floor(h),M=Math.round((h-H)*60);return sxPad(H)+":"+sxPad(M)};
const hnHours=r=>{const a=hnH(r.tu),b=hnH(r.den);return isFinite(a)&&isFinite(b)&&b>a?b-a:0};
const hnCong=r=>(+r.nguoi||0)*hnHours(r);
const hnR1=x=>Math.round(x*10)/10;
const hnAdd=(d,n)=>{const t=new Date(d+"T00:00:00");t.setDate(t.getDate()+n);return `${t.getFullYear()}-${sxPad(t.getMonth()+1)}-${sxPad(t.getDate())}`};
const hnUnit=sp=>{const p=sxP(sp);return p.dvt&&p.dvt!=="sp"?p.dvt:"cái"};
const hnNowT=()=>{const t=new Date();return sxPad(t.getHours())+":"+sxPad(t.getMinutes())};
const hnDays=(a,b)=>Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/864e5);
/* Đồng hồ màn hình xưởng: thời gian đã chạy từ giờ bắt đầu (hôm nay) */
const hnEl=tu=>{const a=hnH(tu);if(!isFinite(a))return "";const t=new Date(),m=Math.max(0,Math.round((t.getHours()+t.getMinutes()/60-a)*60));return "⏱ "+sxPad(Math.floor(m/60))+":"+sxPad(m%60)};
const hnLive=(s,id)=>(s.nk||[]).find(r=>r.psx===id&&r.live);

function hnLoadLich(force){
  if(HN.lichBusy||(!force&&HN.lich&&Date.now()-HN.lichAt<60000))return;HN.lichBusy=true;
  svApi("/api/hub/kho/lich-sx").then(r=>{HN.lich=r;HN.lichErr=""}).catch(e=>{HN.lichErr=e.message})
    .finally(()=>{HN.lichBusy=false;HN.lichAt=Date.now();if(PAGE==="sx_hn"&&!svTyping())renderMain()})}
function hnLoadOrders(force){
  if(HN.busy||(!force&&HN.orders&&Date.now()-HN.at<30000))return;HN.busy=true;
  svApi("/api/hub/kho/b2b-pending").then(r=>{HN.orders=r||[];HN.err=""}).catch(e=>{HN.err=e.message;HN.orders=HN.orders||[]})
    .finally(()=>{HN.busy=false;HN.at=Date.now();if(PAGE==="sx_hn"&&!svTyping())renderMain()})}
const HN_THU=["Chủ nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"],HN_T=["CN","T2","T3","T4","T5","T6","T7"];
const hnThu=d=>HN_THU[new Date(d+"T00:00:00").getDay()]+" "+d.slice(8,10)+"/"+d.slice(5,7);
const hnT=d=>HN_T[new Date(d+"T00:00:00").getDay()]+" "+d.slice(8,10)+"/"+d.slice(5,7);

/* Lệnh của hôm nay: đến hạn (hạn ≤ hôm nay) hoặc đang làm — cùng điều kiện với máy chủ (task.now). Xong hôm nay: đã báo hoàn thành trong ngày. */
function hnToday(s,today){
  const open=s.requests.filter(r=>["CAN_LAM","DANG_LAM"].includes(r.st)&&((r.han&&r.han<=today)||r.st==="DANG_LAM"));
  const byHan=(a,b)=>String(a.han||"9").localeCompare(String(b.han||"9"));
  const late=open.filter(r=>r.han&&r.han<today).sort(byHan),now=open.filter(r=>!(r.han&&r.han<today)).sort(byHan);
  const done=s.requests.filter(r=>["CHO_KIEM","HOAN_TAT"].includes(r.st)&&s.batches.some(b=>b.req===r.id&&String(b.baoLuc||"").startsWith(today)));
  return {late,now,done}}

/* ---------- Tab Kế hoạch ---------- */
const hnDot=(c,t)=>`<span class="hn-dot"><i class="d-${c}"></i>${esc(t)}</span>`;
function hnVt(t){
  if(!t)return `<span class="hn-sub">—</span>`;
  if(t.noBom)return hnDot("gry","Chưa có định mức");
  if(t.lack&&t.lack.length)return `<span title="${esc(t.lack.map(x=>x.name).join(", "))}">${hnDot("red","Thiếu "+t.lack[0].name+(t.lack.length>1?" +"+(t.lack.length-1):""))}</span> <button class="lnk hn-buy" data-go="mh_po">+ Mua</button>`;
  return hnDot("grn","Đủ")}
const HN_ST={de:["Đề xuất","de"],chot:["Đã chốt","chot"],lam:["Đang làm","lam"],xong:["Xong","xong"]};
const hnSt=k=>`<span class="hn-st s-${HN_ST[k][1]}">${HN_ST[k][0]}</span>`;
function hnTag(t){
  if(t.kind==="TON")return `<span class="hn-tag t-ton">Bổ sung tồn</span>`;
  if(t.kind==="LENH")return `<span class="hn-tag t-don">Lệnh đang mở</span>`;
  const m=String(t.reason).match(/^Đơn (OEM|phân phối) (.+?) · giao/);
  return m?`<span class="hn-tag ${m[1]==="OEM"?"t-oem":"t-don"}">${esc((m[1]==="OEM"?"OEM ":"")+m[2])}</span>`:`<span class="hn-tag t-don">Theo đơn</span>`}

function hnPlan(s,today,T){
  const L=HN.lich,cols=8;
  if(HN.lichErr)return `<div class="note red">${esc(HN.lichErr)}</div>`;
  const hm=L?L.homNay||[]:[],hmOf=id=>hm.find(t=>t.refs.includes(id));
  let rank=0;
  const grp=(t,n,cls="")=>`<tr class="hn-grp ${cls}"><td colspan="${cols}">${t}${n!=null?" · "+n:""}</td></tr>`;
  /* Dòng lệnh đã có (PSX) — Quá hạn / Hôm nay */
  const reqTr=(r,st)=>{const t=hmOf(r.id),lt=r.han&&r.han<today;rank++;
    return `<tr class="${lt?"hn-late":""}"><td class="hn-drag"></td><td><span class="hn-rank">${rank}</span></td><td class="hn-prod"><b>${esc(sxP(r.sp).ten)}</b><span><span class="mono">${esc(r.id)}</span>${r.ghiChu?" · "+esc(r.ghiChu):""}</span></td>
      <td class="n"><b>${r.sl?nf(r.sl):"—"}</b> ${esc(hnUnit(r.sp))}</td><td>${r.nguon?`<span class="hn-tag ${/Gia công|OEM/.test(r.nguon)?"t-oem":/tồn/i.test(r.nguon)?"t-ton":"t-don"}">${esc(r.nguon)}</span>`:""}</td>
      <td>${r.han?(lt?`<b class="hn-red">${esc(sxDd(r.han).slice(0,5))}</b><span class="hn-fix">Trễ ${hnDays(r.han,today)} ngày</span>`:esc(sxDd(r.han).slice(0,5))):"—"}</td><td>${st==="xong"?`<span class="hn-sub">—</span>`:hnVt(t)}</td><td>${hnSt(st)}</td></tr>`};
  /* Dòng việc đề xuất trong lịch (ngày di) */
  const tkTr=(t,di)=>{rank++;const off=HN.off[t.key];
    return `<tr class="${t.late?"hn-late":""}${off?" hn-offr":""}" draggable="true" data-hnit="${esc(t.item)}"><td class="hn-drag" title="Kéo để đổi thứ tự">⋮⋮${di===0?`<input type="checkbox" class="hn-cb" data-hnoff="${esc(t.key)}"${off?"":" checked"} title="Bỏ chọn nếu không làm ngày này">`:""}</td>
      <td><span class="hn-rank">${rank}</span></td>
      <td class="hn-prod"><b>${esc(t.name)}</b><span>${t.part?esc(t.part)+" · ":""}${esc(t.reason)}</span></td>
      <td class="n" title="${t.hoursEst?"Chưa có định mức năng suất, tạm ước "+L.cfg.gioMacDinh+" giờ công":hnR1(t.hours)+" giờ công"}"><b>${nf(t.qty)}</b> ${esc(t.unit)}<span class="hn-sub">${t.hoursEst?"≈ ":""}${hnR1(t.hours)} giờ công</span></td>
      <td>${hnTag(t)}</td><td>${t.kind==="TON"||!t.due?"—":t.late?`<b class="hn-red">${esc(sxDd(t.due).slice(0,5))}</b><span class="hn-fix">Đề xuất dời giao ${esc(sxDd(L.days[di].date).slice(0,5))}</span>`:esc(sxDd(t.due).slice(0,5))}</td>
      <td>${hnVt(t)}</td><td>${hnSt(t.kind==="LENH"?"chot":"de")}</td></tr>`};
  const f=HN.f,show=k=>f==null||f===k;
  let body="";
  if(show("hn")){
    if(T.late.length)body+=grp("Quá hạn",T.late.length,"red")+T.late.map(r=>reqTr(r,r.st==="DANG_LAM"?"lam":"chot")).join("");
    const nowRows=T.now.map(r=>reqTr(r,r.st==="DANG_LAM"?"lam":"chot")).concat(T.done.map(r=>reqTr(r,"xong")));
    body+=grp(`Hôm nay · ${hnThu(today)}`,(T.now.length+T.done.length)+" lệnh")+(nowRows.join("")||`<tr><td colspan="${cols}" class="empty">Chưa có lệnh nào cho hôm nay.</td></tr>`)}
  if(L)L.days.forEach((d,di)=>{if(!show(di))return;
    body+=grp(`${hnThu(d.date)} · ${d.tasks.length} việc · ${hnR1(d.used)}/${hnR1(d.cap)} giờ công · ${di===0?"chờ chốt":"dự kiến"}`,null)+(d.tasks.map(t=>tkTr(t,di)).join("")||`<tr><td colspan="${cols}" class="empty">Còn trống, có thể nhận đơn gấp.</td></tr>`)});
  else body+=`<tr><td colspan="${cols}" class="empty">Đang tính lịch đề xuất…</td></tr>`;
  const DO=L?L.doi||[]:[],ra=DO.filter(x=>x.kind!=="TON"&&!x.newDate),sau=L?(L.overflow||[]).length:0;
  const TH=L?L.thieu||[]:[];
  const uu=s.cfg&&s.cfg.lich&&s.cfg.lich.uu&&s.cfg.lich.uu.ngay===today;
  const d0=L&&L.days[0];
  return `<div class="tbl hn-list"><table><thead><tr><th></th><th>#</th><th>Sản phẩm</th><th class="n">Số lượng</th><th>Làm cho</th><th>Hạn giao</th><th>Vật tư</th><th>Trạng thái</th></tr></thead><tbody id="hn-body">${body}</tbody></table></div>
    ${sau?`<p class="hint" style="text-align:center">+ ${sau} việc làm tiếp sau ${L.days.length} ngày</p>`:""}
    ${ra.length?`<div class="hn-doi"><b>${pill(ra.length+" đơn / lệnh","red")} quá 30 ngày làm việc vẫn chưa xếp kịp — cần bàn lại với khách:</b> ${ra.map(x=>esc(x.name)+(x.refs.length?" ("+esc(x.refs.join(", "))+")":"")).join(" · ")}</div>`:""}
    ${TH.length?`<details class="hn-det"><summary>${pill(TH.length+" vật tư","amb")} cần chuẩn bị cho lịch (tồn trên web không đủ) — bấm để xem</summary>
    <div class="tbl"><table><thead><tr><th>Vật tư</th><th class="n">Cần</th><th class="n">Tồn trên web</th><th class="n">Thiếu</th><th>Dùng cho</th></tr></thead><tbody>${TH.map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${nf(x.need)} ${esc(x.unit)}</td><td class="n">${nf(x.have)}</td><td class="n"><b>${nf(x.short)}</b></td><td class="hn-sub">${esc(x.for.slice(0,3).join(", "))}${x.for.length>3?` +${x.for.length-3}`:""}</td></tr>`).join("")}</tbody></table></div></details>`:""}
    <div class="hn-legend">${hnDot("grn","Đủ vật tư")}${hnDot("red","Thiếu theo tồn trên web")}${hnDot("gry","Chưa có định mức vật tư")}<span>Nền đỏ: trễ hoặc không kịp hạn giao</span>${uu?`<button class="lnk" id="hn-uu0">Bỏ thứ tự đã kéo, xếp lại tự động</button>`:""}</div>
    <div class="hn-act"><span class="hint">Lệnh "Đề xuất" do web tự lập từ đơn chờ xuất và tồn kho. Bỏ tích việc không làm trước khi chốt.</span><span class="sp"></span>${d0&&d0.tasks.length?`<button class="btn pri hn-chotb">Chốt kế hoạch ${hnThu(d0.date)}</button>`:""}</div>`}

function hnStrip(T,today){
  const L=HN.lich;
  const chip=(k,lbl,n,used,cap)=>{const p=cap?Math.min(100,Math.round(used/cap*100)):0;
    return `<button class="hn-dc${HN.f===k?" on":""}" data-hnf="${k}"><b>${lbl}</b><span class="hn-load"><i class="${p>95?"r":p>75?"a":"g"}" style="width:${p}%"></i></span><small>${n?n+" lệnh · "+hnR1(used)+"/"+hnR1(cap)+" giờ":"trống"}</small></button>`};
  const hm=L?L.homNay||[]:[],cap=L?L.days[0]?L.days[0].cap:0:0;
  return `<div class="hn-week">${chip("hn","Hôm nay · "+hnT(today),T.late.length+T.now.length+T.done.length,hm.reduce((a,t)=>a+t.hours,0),cap)}${L?L.days.map((d,i)=>chip(i,hnT(d.date),d.tasks.length,d.used,d.cap)).join(""):""}</div>`}

function hnOrders(today){
  if(HN.err)return `<div class="note red">${esc(HN.err)}</div>`;
  if(!HN.orders)return `<p class="hint">Đang tải…</p>`;
  const L=HN.lich,oDay=o=>String(o.ship_date||o.need_date||"").slice(0,10);
  const d2=L&&L.days.length>1?L.days[1].date:hnAdd(today,2);
  const all=(HN.orders||[]).filter(o=>{const d=oDay(o);return d&&d<=d2}).sort((a,b)=>oDay(a).localeCompare(oDay(b)));
  const st=o=>{if(!L)return `<span class="hn-st s-de">Chờ xuất kho</span>`;
    const dz=(L.doi||[]).find(x=>x.kind!=="TON"&&x.refs.includes(o.order_no));
    if(dz)return `<span class="hn-st s-red">${dz.newDate?"Không kịp, đề xuất "+esc(sxDd(dz.newDate).slice(0,5)):"Không kịp, cần bàn lại"}</span>`;
    const di=L.days.findIndex(d=>d.tasks.some(t=>t.refs.includes(o.order_no)));
    if(di>=0)return `<span class="hn-st s-lam">Chờ sản xuất · ${esc(hnT(L.days[di].date))}</span>`;
    return `<span class="hn-st s-de">Chờ xuất kho</span>`};
  const card=o=>{const Ls=o.lines||[];return `<div class="hn-ord"><div class="hn-l1"><b>${esc(o.customer_name)}</b>${st(o)}</div><div class="hn-sub"><span class="mono">${esc(o.order_no)}</span> · ${o.kenh==="GIA_CONG"?"Kênh OEM":"Kênh phân phối"} · giao ${esc(sxDd(oDay(o)).slice(0,5))}</div><div class="hn-items">${Ls.slice(0,2).map(l=>esc(l.name)+" ×"+nf(l.qty)).join(" · ")}${Ls.length>2?` · +${Ls.length-2} mã`:""}</div></div>`};
  const sec=(t,rows,cls="")=>rows.length?`<div class="hn-sec ${cls}">${t} · ${rows.length}</div>`+rows.map(card).join(""):"";
  const h=sec("Trễ hạn",all.filter(o=>oDay(o)<today),"red")+sec("Giao hôm nay",all.filter(o=>oDay(o)===today))+sec("Giao 2 ngày tới",all.filter(o=>oDay(o)>today));
  return h||`<p class="hint">Không có đơn cần xuất trong 2 ngày tới.</p>`}

/* ---------- Tab Màn hình xưởng ---------- */
const HN_PZ=["Chờ vật tư","Sửa máy","Vệ sinh","Chuyển việc khác"];
function hnXuong(s,T,today){
  const jobs=T.late.concat(T.now);
  const card=(r,i)=>{const w=hnLive(s,r.id),k=w&&w.sp===HN_KHAC,seg=(s.nk||[]).filter(x=>x.psx===r.id&&x.sp!==HN_KHAC&&!x.live),u=hnUnit(r.sp);
    const last=seg[seg.length-1];
    let act;
    if(w&&!k)act=`<div class="hn-jr"><select class="hn-big gray" data-hnpz="${esc(r.id)}"><option value="">⏸ Tạm dừng</option>${HN_PZ.map(x=>`<option>${x}</option>`).join("")}</select><button class="hn-big stop" data-hnxong="${esc(r.id)}">■ Xong</button></div>`;
    else if(k)act=`<div class="hn-jr"><span class="hn-sub">Đang tạm dừng: ${esc(String(w.ghi||"").replace(/^Tạm dừng: /,"").split(" · ")[0])}</span><button class="hn-big go" data-hngo="${esc(r.id)}">▶ Làm tiếp</button></div>`;
    else act=`<div class="hn-jr"><label class="hn-sub">Số người <input class="hn-inp" data-hnng="${esc(r.id)}" inputmode="numeric" value="${esc(last?last.nguoi:"")}"></label><button class="hn-big go" data-hngo="${esc(r.id)}">▶ ${seg.length?"Làm tiếp":"Bắt đầu"}</button></div>${r.st==="DANG_LAM"?`<div class="hn-jr"><span class="sp"></span><button class="lnk" data-hnxong="${esc(r.id)}">■ Báo xong</button></div>`:""}`;
    return `<div class="hn-job${w?k?" pz":" on":""}"><div class="hn-jr0"><b>${i+1}. ${esc(sxP(r.sp).ten)}</b>${w?`<span class="hn-timer" data-hnt="${esc(w.tu)}">${hnEl(w.tu)}</span>`:r.han&&r.han<today?`<span class="hn-st s-red">Trễ hạn</span>`:""}</div>
      <div class="hn-sub">${r.sl?nf(r.sl)+" "+esc(u):"chưa chốt số lượng"} · <span class="mono">${esc(r.id)}</span>${w&&!k?" · "+esc(w.nguoi)+" người từ "+esc(w.tu):""}</div>${act}</div>`};
  const doneCard=r=>{const seg=(s.nk||[]).filter(x=>x.psx===r.id&&x.sp!==HN_KHAC&&x.ngay===today),sl=seg.reduce((a,x)=>a+(+x.sl||0),0),c=seg.reduce((a,x)=>a+hnCong(x),0);
    return `<div class="hn-job done"><div class="hn-jr0"><b>${esc(sxP(r.sp).ten)}</b>${hnSt("xong")}</div><div class="hn-sub">${sl?nf(sl)+" "+esc(hnUnit(r.sp))+" · ":""}${seg.length?esc(seg[0].tu)+"–"+esc(seg[seg.length-1].den):""}${c&&sl?" · "+nf(sl/c)+" "+esc(hnUnit(r.sp))+"/giờ công":""}</div></div>`};
  return `<div class="hn-two"><div class="hn-phone"><div class="hn-jr0" style="margin-bottom:10px"><b>Xưởng · ${hnThu(today)}</b><span class="hn-sub">${jobs.length} lệnh</span></div>
    ${jobs.map(card).join("")||`<p class="hint">Chưa có lệnh nào cho hôm nay. Quản lý chốt kế hoạch ở tab Kế hoạch.</p>`}${T.done.map(doneCard).join("")}</div>
   <section class="card"><h2>Xưởng dùng thế nào</h2>
    <div class="hn-step"><i>1</i><div>Mở trang này trên điện thoại, tab <b>Màn hình xưởng</b>: các lệnh hôm nay theo đúng thứ tự ưu tiên đã chốt.</div></div>
    <div class="hn-step"><i>2</i><div>Gõ số người rồi bấm <b>▶ Bắt đầu</b>. Web tự ghi giờ bắt đầu.</div></div>
    <div class="hn-step"><i>3</i><div>Phải dừng (chờ vật tư, sửa máy, vệ sinh) thì chọn lý do ở <b>⏸ Tạm dừng</b>. Thời gian dừng là giờ gián tiếp, không tính vào giá thành. Bấm <b>▶ Làm tiếp</b> khi làm lại.</div></div>
    <div class="hn-step"><i>4</i><div>Làm xong bấm <b>■ Xong</b>, gõ số lượng và người làm. Lệnh chuyển sang chờ kế toán kiểm như ở Tiến độ xưởng; giờ công và năng suất tự vào Báo cáo sản lượng.</div></div>
    <div class="note" style="margin-top:10px">Không cần gõ giờ tay. Sau 1–2 tuần web có định mức năng suất từng sản phẩm để tính tải xưởng sát thực tế.</div></section></div>`}
function hnStart(id,nguoi){
  const now=hnNowT(),today=sxToday();
  sxMut("xưởng bắt đầu "+id,s2=>{s2.nk=s2.nk||[];const r=s2.requests.find(x=>x.id===id);if(!r)return;
    s2.nk.filter(x=>x.psx===id&&x.live).forEach(x=>{x.den=now;delete x.live});
    s2.nk.push({id:"NK-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),ngay:today,sp:r.sp,psx:id,nguoi,tu:now,den:"",sl:0,ghi:"",by:ME.name,at:sxNow(),live:1});
    if(r.st==="CAN_LAM"){r.st="DANG_LAM";r.batDau=sxNow();r.hist.push({at:sxNow(),by:ME.name,act:"Xưởng bắt đầu làm ("+nguoi+" người)"})}});
  renderMain()}
function hnPause(id,ly){
  const now=hnNowT(),today=sxToday();
  sxMut("xưởng tạm dừng "+id+": "+ly,s2=>{s2.nk=s2.nk||[];const w=s2.nk.find(x=>x.psx===id&&x.live);if(!w)return;w.den=now;delete w.live;
    s2.nk.push({id:"NK-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),ngay:today,sp:HN_KHAC,psx:id,nguoi:w.nguoi,tu:now,den:"",sl:0,ghi:"Tạm dừng: "+ly+" · "+sxP(w.sp).ten,by:ME.name,at:sxNow(),live:1})});
  renderMain()}
/* Xong: dùng đúng mẫu Báo hoàn thành của Tiến độ xưởng (tạo lô chờ kế toán kiểm); khi gửi thì đóng đoạn đang chạy và ghi số lượng vào báo cáo sản lượng. */
function hnDone(id){
  const end=hnNowT();sxDoneForm(id);
  const f=$("#sdf"),slEl=$("#sd-sl");if(!f||!slEl)return;
  f.addEventListener("submit",()=>{const sl=+slEl.value;if(!(sl>0))return;
    sxMut("ghi sản lượng "+id+": "+sl,s2=>{s2.nk=s2.nk||[];const live=s2.nk.filter(x=>x.psx===id&&x.live);
      live.forEach(x=>{x.den=end;delete x.live});
      const w=live.find(x=>x.sp!==HN_KHAC)||s2.nk.filter(x=>x.psx===id&&x.sp!==HN_KHAC).pop();if(w)w.sl=(+w.sl||0)+sl});
    setTimeout(()=>hnLoadLich(true),1500)})}

/* ---------- Tab Báo cáo sản lượng ---------- */
function hnRowsOf(day){return (SX().nk||[]).filter(r=>r.ngay===day)}
function hnDraft(day){
  if(HN.draftDay!==day||!HN.draft||!HN.dirty){HN.draftDay=day;HN.draft=hnRowsOf(day).filter(r=>!r.live).map(r=>({...r}));if(!HN.draft.length)HN.draft=[{sp:"",nguoi:"",tu:"",den:"",sl:"",ghi:""}]}
  return HN.draft}
function hnBaoCao(s,today,day){
  const dr=hnDraft(day),prods=s.products.filter(p=>p.active!==false).slice().sort((a,b)=>String(a.ten).localeCompare(String(b.ten),"vi"));
  const live=hnRowsOf(day).filter(r=>r.live);
  const opt=v=>`<option value="">— Chọn sản phẩm / công việc —</option><option value="${HN_KHAC}"${v===HN_KHAC?" selected":""}>Công việc gián tiếp (chờ vật tư, vệ sinh, sửa máy)</option><optgroup label="Sản phẩm">`+prods.map(p=>`<option value="${esc(p.ma)}"${p.ma===v?" selected":""}>${esc(p.ten)}</option>`).join("")+`</optgroup>`;
  const logRows=dr.map((r,i)=>{const k=r.sp===HN_KHAC,c=hnCong(r),rate=!k&&c>0&&+r.sl>0?nf(+r.sl/c)+" "+esc(hnUnit(r.sp)):"—";
    return `<tr${k?' class="hn-oth"':""}><td class="hn-i">${i+1}</td><td><select class="hn-in" data-hn="sp" data-i="${i}">${opt(r.sp)}</select>${r.psx?`<div class="hn-sub">Màn hình xưởng · <span class="mono">${esc(r.psx)}</span></div>`:""}</td><td><input class="hn-in hn-num" data-hn="nguoi" data-i="${i}" value="${esc(r.nguoi)}" inputmode="numeric"></td><td><input class="hn-in hn-t" type="time" data-hn="tu" data-i="${i}" value="${esc(hnTime(r.tu))}"></td><td><input class="hn-in hn-t" type="time" data-hn="den" data-i="${i}" value="${esc(hnTime(r.den))}"></td><td>${k?`<span class="hn-dash">—</span>`:`<input class="hn-in hn-num" data-hn="sl" data-i="${i}" value="${esc(r.sl)}" inputmode="numeric">`}</td><td class="n hn-calc">${c?hnR1(c):"—"}</td><td class="n hn-calc">${rate}</td><td><input class="hn-in" data-hn="ghi" data-i="${i}" value="${esc(r.ghi)}" placeholder="Ghi chú"></td><td><button class="lnk hn-del" data-hndel="${i}" title="Xóa dòng">✕</button></td></tr>`});
  const sum=f=>dr.reduce((a,r)=>a+f(r),0),tC=sum(r=>r.sp&&r.sp!==HN_KHAC?hnCong(r):0),tK=sum(r=>r.sp===HN_KHAC?hnCong(r):0);
  return `<section class="card"><div class="card-h hn-h"><h2>Báo cáo sản lượng</h2><label class="hn-day">Ngày báo cáo <input type="date" id="hn-day" value="${esc(day)}" max="${esc(today)}"></label></div>
   ${live.length?`<div class="note">${live.length} việc đang chạy ở màn hình xưởng (${esc(live.map(r=>r.sp===HN_KHAC?"tạm dừng":sxP(r.sp).ten).join(", "))}) — tự vào bảng khi bấm Tạm dừng hoặc Xong.</div>`:""}
   <div class="tbl hn-log"><table><thead><tr><th>#</th><th>Công việc / sản phẩm</th><th>Số lao động</th><th>Bắt đầu</th><th>Kết thúc</th><th>Sản lượng</th><th class="n">Giờ công</th><th class="n">Năng suất / giờ công</th><th>Ghi chú</th><th></th></tr></thead>
   <tbody>${logRows.join("")}</tbody>
   <tfoot><tr><td></td><td colspan="5"><b>Tổng</b> <span class="hn-sub">trực tiếp <b id="hn-tc">${hnR1(tC)}</b> giờ · gián tiếp <b id="hn-tk">${hnR1(tK)}</b> giờ</span></td><td class="n"><b id="hn-tt">${hnR1(tC+tK)}</b></td><td colspan="3"></td></tr></tfoot></table></div>
   <div class="hn-act"><button class="btn" id="hn-add">+ Thêm dòng</button><span class="hint" id="hn-msg">${HN.dirty?"Có thay đổi chưa lưu.":""}</span><span class="sp"></span><button class="btn pri" id="hn-save">Lưu báo cáo</button></div>
   <p class="hint">Bảng tự lập từ màn hình xưởng; việc không bấm trên điện thoại thì thêm dòng tay. Một lệnh tạm dừng rồi làm tiếp có nhiều dòng, số lượng ghi ở dòng cuối. Thời gian chờ vật tư, vệ sinh, sửa máy là "Công việc gián tiếp", không tính vào giá thành.</p></section>`}

/* ---------- Tab Định mức năng suất: gom theo lệnh (nhiều đoạn một lệnh), rồi theo sản phẩm ---------- */
function hnDinhMuc(s){
  const J={};(s.nk||[]).forEach((r,i)=>{if(!r.sp||r.sp===HN_KHAC)return;const j=J[r.psx?"P:"+r.psx:"R:"+(r.id||i)]||(J[r.psx?"P:"+r.psx:"R:"+(r.id||i)]={sp:r.sp,c:0,sl:0});j.c+=hnCong(r);j.sl+=+r.sl||0});
  const G={};Object.values(J).forEach(j=>{if(!(j.c>0&&j.sl>0))return;const g=G[j.sp]||(G[j.sp]={n:0,c:0,sl:0});g.n++;g.c+=j.c;g.sl+=j.sl});
  const rows=Object.entries(G).sort((a,b)=>b[1].n-a[1].n).map(([sp,g])=>`<tr><td>${esc(sxP(sp).ten)}</td><td class="n">${g.n}</td><td class="n">${hnR1(g.c)}</td><td class="n">${nf(g.sl)}</td><td class="n"><b>${nf(g.sl/g.c)} ${esc(hnUnit(sp))}</b></td><td>${g.n<3?pill("Chưa đủ dữ liệu","amb"):pill("Áp dụng","grn")}</td></tr>`);
  return `<section class="card"><div class="card-h hn-h"><h2>Định mức năng suất</h2><span class="hint">Tính từ báo cáo sản lượng · áp dụng khi sản phẩm có từ 3 lần làm</span></div>
   <div class="tbl"><table><thead><tr><th>Sản phẩm</th><th class="n">Số lần làm</th><th class="n">Tổng giờ công</th><th class="n">Tổng sản lượng</th><th class="n">1 giờ công làm được</th><th>Trạng thái</th></tr></thead><tbody>${rows.join("")||`<tr><td colspan="6" class="empty">Chưa có báo cáo sản lượng.</td></tr>`}</tbody></table></div>
   <p class="hint">Lịch đề xuất dùng định mức này để tính giờ công từng việc; sản phẩm chưa có định mức tạm ước ${HN.lich?HN.lich.cfg.gioMacDinh:4} giờ công mỗi việc (dấu ≈).</p></section>`}

function hnChot(){
  const L=HN.lich;if(!L)return;const d=L.days[0],sel=d.tasks.filter(t=>!HN.off[t.key]);
  const pick=sel.filter(t=>(t.newQty??(t.kind==="LENH"?0:t.qty))>0),lenh=sel.filter(t=>t.refs.some(r=>/^PSX/.test(r)));
  if(!sel.length)return toast("Chưa chọn việc nào");
  if(!confirm(`Chốt kế hoạch ${hnThu(d.date)}: tạo ${pick.length} lệnh sản xuất mới${lenh.length?`, đặt hạn các lệnh đang mở`:""}?`))return;
  const codes=[];
  sxMut(`chốt kế hoạch sản xuất ${hnThu(d.date)}`,s2=>{
    pick.forEach(t=>{const code=sxReqCode(s2,sxToday());codes.push(code);const q=t.newQty??t.qty,don=t.refs.filter(r=>!/^PSX/.test(r));
      s2.requests.push({id:code,sp:t.item,sl:q,nguon:don.length?(/OEM/.test(t.reason)?"Gia công":"Đơn B2B"):"Bổ sung tồn",uu:t.late||don.length?"Gấp":"Bình thường",han:d.date,ghiChu:t.reason+(don.length?" · "+don.join(", "):""),st:"CAN_LAM",tao:ME.name,taoLuc:sxToday(),batDau:"",lots:[],hist:[{at:sxNow(),by:ME.name,act:"Tạo từ kế hoạch sản xuất ("+hnThu(d.date)+")"}]})});
    lenh.forEach(t=>t.refs.filter(r=>/^PSX/.test(r)).forEach(id=>{const r=s2.requests.find(x=>x.id===id);if(r&&!r.han){r.han=d.date;r.hist=(r.hist||[]).concat([{at:sxNow(),by:ME.name,act:"Đặt hạn theo kế hoạch sản xuất "+hnThu(d.date)}])}}))});
  toast(codes.length?`Đã tạo ${codes.length} lệnh sản xuất: ${codes.join(", ")}`:"Đã chốt kế hoạch");HN.off={};setTimeout(()=>hnLoadLich(true),1500);renderMain()}

function pSxHn(m){
  const TT="Điều phối sản xuất";
  if(!hnOk()){m.innerHTML=H(TT,"")+`<div class="note">Trang này chỉ dành cho CEO và quản lý điều phối sản xuất.</div>`;return}
  const s=SX(),today=sxToday(),day=HN.day||today;hnLoadOrders();hnLoadLich();
  const T=hnToday(s,today),L=HN.lich;
  const saved=hnRowsOf(today).filter(r=>!r.live),congHN=saved.filter(r=>r.sp!==HN_KHAC).reduce((a,r)=>a+hnCong(r),0),khac=saved.filter(r=>r.sp===HN_KHAC),khacHN=khac.reduce((a,r)=>a+hnCong(r),0);
  const oDay=o=>String(o.ship_date||o.need_date||"").slice(0,10),due=(HN.orders||[]).filter(o=>{const d=oDay(o);return d&&d<=today}),dueLate=due.filter(o=>oDay(o)<today);
  const box=(ic,l,v,h,c)=>`<div class="sxk hn-k t-${c}"><i>${ico(ic)}</i><span><small>${l}</small><b>${v}</b>${h?`<em>${h}</em>`:""}</span></div>`;
  const nL=T.late.length+T.now.length+T.done.length,lam=T.late.concat(T.now).filter(r=>r.st==="DANG_LAM").length;
  const kz=[...new Set(khac.map(r=>String(r.ghi||"").replace(/^Tạm dừng: /,"").split(" · ")[0]).filter(Boolean))].slice(0,2).join(", ");
  const tabs=[["kh","Kế hoạch"],["xuong","Màn hình xưởng"],["bc","Báo cáo sản lượng"],["dm","Định mức năng suất"]];
  const d0=L&&L.days[0];
  let body="";
  if(HN.tab==="kh"){
    const c=L?L.cfg:null;
    body=`<div class="sxkpis s4">${box("task","Lệnh hôm nay",nL,(lam?lam+" đang làm · ":"")+T.done.length+" xong"+(T.late.length?" · "+T.late.length+" quá hạn":""),T.late.length?"red":"blu")}${box("box","Đơn cần xuất hôm nay",HN.orders?due.length:"…",dueLate.length?dueLate.length+" đơn trễ hạn":"",dueLate.length?"red":"org")}${box("clock","Giờ công trực tiếp hôm nay",hnR1(congHN)+" giờ","tự ghi từ màn hình xưởng","grn")}${box("alert","Giờ công gián tiếp hôm nay",hnR1(khacHN)+" giờ",kz,"vio")}</div>
    <section class="card"><div class="card-h hn-h"><h2>Tải xưởng theo ngày</h2><span class="hint">${c?`${hnR1(c.cong*(1-c.duPhong/100))} giờ công/ngày (đã chừa ${c.duPhong}% cho đơn gấp) · tối đa ${c.maxMa} mã/ngày · `:""}bấm một ngày để lọc danh sách${HN.f!=null?` · <button class="lnk" data-hnf="all">Xem tất cả</button>`:""}</span></div>
     ${HN.cfg?`<div class="hn-cfg hn-cfgbox">Sức xưởng <input id="hn-cong" value="${esc(c?c.cong:"")}" inputmode="numeric"> giờ công/ngày · Dự phòng đơn gấp <input id="hn-dp" value="${esc(c?c.duPhong:"")}" inputmode="numeric">% · Tối đa <input id="hn-ma" value="${esc(c?c.maxMa:"")}" inputmode="numeric"> mã/ngày <button class="btn sm pri" id="hn-tinh">Lưu và tính lại</button></div>`:""}
     ${hnStrip(T,today)}</section>
    <div class="hn-main"><section class="card"><div class="card-h hn-h"><h2>Lệnh sản xuất — xếp theo ưu tiên</h2><span class="hint">Kéo ⋮⋮ để đổi thứ tự · web tự xếp lại ngày làm và kiểm lại vật tư</span></div>${hnPlan(s,today,T)}</section>
     <section class="card"><div class="card-h hn-h"><h2>Đơn cần xuất</h2><button class="lnk" data-go="kho_xuat_b2b">Xuất kho đơn ›</button></div>${hnOrders(today)}</section></div>`}
  else if(HN.tab==="xuong")body=hnXuong(s,T,today);
  else if(HN.tab==="bc")body=hnBaoCao(s,today,day);
  else body=hnDinhMuc(s);
  m.innerHTML=`<div class="hn-top">${H(TT,hnThu(today)+" · kế hoạch, màn hình xưởng, báo cáo sản lượng và định mức năng suất")}<div class="hn-topb"><button class="btn" id="hn-cfgb">⚙ Sức xưởng</button><button class="btn" data-go="sx_nc">+ Thêm lệnh</button>${d0&&d0.tasks.length?`<button class="btn pri hn-chotb">Chốt kế hoạch ${hnThu(d0.date)}</button>`:""}</div></div>
   <div class="sxtabs">${tabs.map(([k,t])=>`<button class="${HN.tab===k?"on":""}" data-hntab="${k}">${t}</button>`).join("")}</div>${body}`;
  /* Nút data-go do bindCommon (app.js) gắn sẵn. */
  m.querySelectorAll("[data-hntab]").forEach(b=>b.onclick=()=>{if(HN.dirty&&HN.tab==="bc"&&b.dataset.hntab!=="bc"&&!confirm("Báo cáo sản lượng có thay đổi chưa lưu. Bỏ thay đổi?"))return;if(b.dataset.hntab!=="bc"){HN.dirty=false;HN.draft=null}HN.tab=b.dataset.hntab;renderMain()});
  $("#hn-cfgb").onclick=()=>{HN.tab="kh";HN.cfg=!HN.cfg;renderMain()};
  m.querySelectorAll(".hn-chotb").forEach(b=>b.onclick=hnChot);
  if(HN.tab==="kh"){
    m.querySelectorAll("[data-hnf]").forEach(b=>b.onclick=()=>{const v=b.dataset.hnf,k=v==="all"?null:v==="hn"?"hn":+v;HN.f=HN.f===k?null:k;renderMain()});
    m.querySelectorAll("[data-hnoff]").forEach(c=>c.onchange=()=>{if(c.checked)delete HN.off[c.dataset.hnoff];else HN.off[c.dataset.hnoff]=1;c.closest("tr").classList.toggle("hn-offr",!c.checked)});
    if($("#hn-uu0"))$("#hn-uu0").onclick=()=>{sxMut("bỏ thứ tự ưu tiên đã kéo",s2=>{if(s2.cfg.lich)delete s2.cfg.lich.uu});toast("Đang xếp lại tự động…");setTimeout(()=>hnLoadLich(true),1500)};
    if($("#hn-tinh"))$("#hn-tinh").onclick=()=>{const cong=+$("#hn-cong").value,dp=+$("#hn-dp").value,ma=+$("#hn-ma").value;
      if(!(cong>0)||!(dp>=0&&dp<100)||!(ma>=1))return toast("Sức xưởng phải lớn hơn 0, dự phòng từ 0 đến 99%, số mã/ngày từ 1 trở lên");
      sxMut("đặt sức xưởng "+cong+" giờ công/ngày, dự phòng "+dp+"%, tối đa "+ma+" mã/ngày",s2=>{s2.cfg.lich={...(s2.cfg.lich||{}),cong,duPhong:dp,maxMa:Math.round(ma)}});
      HN.cfg=false;toast("Đang tính lại lịch…");setTimeout(()=>hnLoadLich(true),1500)};
    /* Kéo thả: đổi chỗ dòng trên màn hình, rồi lưu thứ tự mã (chỉ có hiệu lực hôm nay) để máy chủ xếp lại ngày làm. */
    const tb=$("#hn-body");
    if(tb){tb.querySelectorAll("tr[data-hnit]").forEach(tr=>{
      tr.addEventListener("dragstart",e=>{HN.drag=tr;tr.classList.add("hn-dragging");e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",tr.dataset.hnit)}catch(_){}});
      tr.addEventListener("dragend",()=>tr.classList.remove("hn-dragging"));
      tr.addEventListener("dragover",e=>{if(HN.drag&&HN.drag!==tr){e.preventDefault();const r=tr.getBoundingClientRect();tb.insertBefore(HN.drag,e.clientY<r.top+r.height/2?tr:tr.nextSibling)}});
      tr.addEventListener("drop",e=>{e.preventDefault();const items=[...new Set([...tb.querySelectorAll("tr[data-hnit]")].map(x=>x.dataset.hnit))];HN.drag="";
        sxMut("đổi thứ tự ưu tiên sản xuất",s2=>{s2.cfg.lich={...(s2.cfg.lich||{}),uu:{ngay:sxToday(),items}}});toast("Đang xếp lại ngày làm theo thứ tự mới…");setTimeout(()=>hnLoadLich(true),1500)})})}
  }
  if(HN.tab==="xuong"){
    m.querySelectorAll("[data-hngo]").forEach(b=>b.onclick=()=>{const id=b.dataset.hngo,w=hnLive(SX(),id),inp=m.querySelector(`[data-hnng="${CSS.escape(id)}"]`);
      const n=w?+w.nguoi:+(inp&&inp.value);if(!(n>0)){toast("Gõ số người làm trước khi bắt đầu");inp&&inp.focus();return}hnStart(id,n)});
    m.querySelectorAll("[data-hnpz]").forEach(sel=>sel.onchange=()=>{if(sel.value)hnPause(sel.dataset.hnpz,sel.value)});
    m.querySelectorAll("[data-hnxong]").forEach(b=>b.onclick=()=>hnDone(b.dataset.hnxong));
  }
  if(HN.tab==="bc"){
    /* Gõ số thì chỉ cập nhật ô Giờ công / năng suất của dòng đó, không vẽ lại cả trang. */
    const recalc=i=>{const r=HN.draft[i],tr=m.querySelector(`[data-hn][data-i="${i}"]`).closest("tr"),c=hnCong(r),k=r.sp===HN_KHAC;
      tr.cells[6].textContent=c?hnR1(c):"—";tr.cells[7].textContent=!k&&c>0&&+r.sl>0?nf(+r.sl/c)+" "+hnUnit(r.sp):"—";$("#hn-msg").textContent="Có thay đổi chưa lưu.";
      const t=f=>HN.draft.reduce((a,x)=>a+f(x),0),tc=t(x=>x.sp&&x.sp!==HN_KHAC?hnCong(x):0),tk=t(x=>x.sp===HN_KHAC?hnCong(x):0);$("#hn-tc").textContent=hnR1(tc);$("#hn-tk").textContent=hnR1(tk);$("#hn-tt").textContent=hnR1(tc+tk)};
    m.querySelectorAll("[data-hn]").forEach(el=>{const ev=el.tagName==="SELECT"?"change":"input";el.addEventListener(ev,()=>{const i=+el.dataset.i,r=HN.draft[i];r[el.dataset.hn]=el.value;HN.dirty=true;
      if(el.tagName==="SELECT"){if(el.value===HN_KHAC)r.sl="";renderMain()}else recalc(i)})});
    m.querySelectorAll("[data-hndel]").forEach(b=>b.onclick=()=>{HN.draft.splice(+b.dataset.hndel,1);if(!HN.draft.length)HN.draft.push({sp:"",nguoi:"",tu:"",den:"",sl:"",ghi:""});HN.dirty=true;renderMain()});
    $("#hn-add").onclick=()=>{const last=HN.draft[HN.draft.length-1]||{};HN.draft.push({sp:"",nguoi:last.nguoi||"",tu:last.den||"",den:"",sl:"",ghi:""});HN.dirty=true;renderMain()};
    $("#hn-day").onchange=e=>{if(HN.dirty&&!confirm("Có thay đổi chưa lưu ở ngày đang mở. Bỏ thay đổi và chuyển ngày?")){e.target.value=day;return}HN.day=e.target.value||today;HN.draft=null;HN.dirty=false;renderMain()};
    $("#hn-save").onclick=()=>{
      const rows=HN.draft.filter(r=>r.sp||r.nguoi||r.tu||r.den||r.sl);
      for(const [i,r] of rows.entries()){
        if(!r.sp)return toast("Dòng "+(i+1)+": chưa chọn sản phẩm hoặc công việc gián tiếp");
        if(!(+r.nguoi>0))return toast("Dòng "+(i+1)+": chưa ghi số lao động");
        if(!hnHours(r))return toast("Dòng "+(i+1)+": giờ chưa đúng (ví dụ 7:30 đến 11:30)");
        if(r.sp!==HN_KHAC&&!(+r.sl>=0&&String(r.sl).trim()!==""))return toast("Dòng "+(i+1)+": chưa ghi sản lượng")}
      const clean=rows.map(r=>({id:r.id||("NK-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),ngay:day,sp:r.sp,...(r.psx?{psx:r.psx}:{}),nguoi:+r.nguoi,tu:String(r.tu).trim(),den:String(r.den).trim(),sl:r.sp===HN_KHAC?0:+r.sl,ghi:String(r.ghi||"").trim(),by:r.by||ME.name,at:r.at||sxNow()}));
      /* Giữ nguyên các dòng đang chạy ở màn hình xưởng (live). */
      sxMut("Báo cáo sản lượng ngày "+sxDd(day)+" ("+clean.length+" dòng)",d=>{d.nk=(d.nk||[]).filter(r=>r.ngay!==day||r.live).concat(clean)});
      HN.draft=null;HN.dirty=false;toast("Đã lưu báo cáo sản lượng ngày "+sxDd(day));setTimeout(()=>hnLoadLich(true),1500);renderMain()};
  }
}
PAGES.sx_hn=sxInit(pSxHn);
/* Đồng hồ màn hình xưởng: chỉ đổi chữ, không vẽ lại trang. */
setInterval(()=>{if(typeof PAGE==="undefined"||PAGE!=="sx_hn")return;document.querySelectorAll("[data-hnt]").forEach(el=>{el.textContent=hnEl(el.dataset.hnt)})},20000);
{
  const sx=MODULES.find(x=>x.k==="sx");
  if(sx){const g0=sx.groups;sx.groups=function(){const r=g0.apply(this,arguments)||[];if(r.some(g=>g[1].some(i=>i[0]==="sx_hn")))return r;
    const it=MI("sx_hn","Điều phối sản xuất",()=>hnOk());const g=r.find(x=>x[0]==="Sản xuất");if(g)g[1]=[it].concat(g[1]);else r.push(["Sản xuất",[it]]);return r}}
}
