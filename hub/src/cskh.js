/* =====================================================================
   CSKH KHÁCH LẺ (chị Hoa duyệt demo 10/11/2026) — mục "CSKH khách lẻ" ở Bán hàng.
   - Khách lấy tự động từ đơn Facebook giao thành công trên Poscake (máy chủ kéo mỗi sáng 7h + kéo bù), gom theo số điện thoại.
   - CSKH chỉ thấy khách được chia cho mình; Lead Sale (quyền cskh.quanly / trưởng nhóm phòng CSKH, Sale Kênh bán lẻ) và CEO thấy hết.
   - Trang: Tổng quan · Việc hôm nay · Khách hàng · Đơn hàng · Chia khách · Báo cáo · Cài đặt. Hồ sơ khách mở ngay trong trang.
   - Ghi kết quả bắt buộc chọn ngày gọi lại. Đơn tạo trên web gửi sang Poscake (trạng thái Mới). Doanh thu bán thêm máy chủ tự khớp.
   Tên toàn cục bắt đầu bằng "cs" / "CSK".
   ===================================================================== */
const csApi=(p,o)=>svApi("/api/hub/cskh"+p,o);
const CSK={me:null,meBusy:null,err:"",open:null,prof:null,today:null,list:null,lf:{q:"",tier:"",state:"",owner:""},orders:null,month:"",ov:null,rep:null,chia:null,chiaKind:"moi",prods:null,gq:"",gres:null,tf:"all",ptab:"don",busy:false};
const CS_PAGES=["cs_tq","cs_today","cs_kh","cs_don","cs_chia","cs_bc","cs_cd"];
const CS_ST={qua:["Quá hạn","red"],nay:["Hôm nay gọi","amb"],moi:["Khách mới, chưa gọi","blu"],ky:["Đến kỳ mua lại","vio"],ngung:["Ngừng chăm sóc","red"],cho:["Chưa tới hạn","grn"],chua:["Chưa chia","gry"]};
const csLead=()=>!!(CSK.me&&CSK.me.me.lead);
const csToday=()=>(CSK.me&&CSK.me.today)||new Date(Date.now()+7*36e5).toISOString().slice(0,10);
const csFd=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"";
const csAdd=(d,n)=>new Date(Date.parse(d+"T00:00:00Z")+n*864e5).toISOString().slice(0,10);
const csDiff=(a,b)=>Math.round((Date.parse(a+"T00:00:00Z")-Date.parse(b+"T00:00:00Z"))/864e5);
const csAddr=c=>[c.addr_street,c.addr_ward,c.addr_district,c.addr_province].filter(Boolean).join(", ");
const csPh=p=>{p=String(p||"");return p.length===10?p.slice(0,4)+" "+p.slice(4,7)+" "+p.slice(7):p};
const csTierTop=t=>{const T=(CSK.me&&CSK.me.settings&&CSK.me.settings.tiers)||[];return T.some(x=>x.n===t)};
const csTier=c=>c.tier?pill(c.tier,csTierTop(c.tier)?(((CSK.me.settings.tiers[0]||{}).n===c.tier)?"pnk":"vio"):"gry"):"";
const csStP=s=>{const x=CS_ST[s]||["",""];return x[0]?pill(x[0],x[1]):""};
const csContact=c=>`<div class="cs-ct"><b>📞 ${esc(csPh(c.phone))}${c.phone2?" · "+esc(c.phone2):""}</b><span>📍 ${esc(csAddr(c))||"<i>chưa có địa chỉ</i>"}</span></div>`;
const csCyc=p=>{const s=CSK.me&&CSK.me.settings;return s?(s.cycles[p]||s.defaultCycle):30};
function csGoiY(c){const p=c.last_product,d=c.last_order_day;if(!d)return "Khách chưa có đơn: hỏi nhu cầu, giới thiệu sản phẩm";const used=csDiff(csToday(),d),cy=csCyc(p);
  if(used>=cy-5)return `${p} mua ${used} ngày trước, thường dùng ${cy} ngày: hỏi đã gần hết chưa, mời mua lại`;
  if(c.order_count<=1&&used<=14)return `Đơn đầu ${p} giao ${csFd(d)}: hỏi đã nhận hàng chưa, hướng dẫn dùng đúng`;
  return `Hỏi cảm nhận ${p}, giới thiệu sản phẩm cùng bộ`}
/* Chỉ vẽ lại khi dữ liệu trang đang chờ vừa về. Không dùng svTyping() vì trang CSKH luôn có ô tìm khách (svTyping chặn 2 phút sau mỗi thao tác → trang treo "Đang tải…"). Chỉ hoãn khi đang gõ dở trong ô của trang hoặc đang mở hộp nhập. */
function csRe(){const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA)$/.test(a.tagName)&&a.closest("#main")&&a.value&&!/^cs/.test(a.id)){setTimeout(csRe,1500);return}if($("#crmm")&&!$("#crmm").hidden){setTimeout(csRe,1500);return}if(!(CS_PAGES.includes(PAGE)||PAGE==="fb_cskh"))return;const fid=a&&a.closest&&a.closest("#main")&&/^cs/.test(a.id)?a.id:"";renderMain();if(fid){const e=document.getElementById(fid);if(e){e.focus();try{e.setSelectionRange(e.value.length,e.value.length)}catch(er){}}}}
function csErr(e){toast(e&&e.message||"Lỗi");}

/* ---------- tải ---------- */
function csLoadMe(force){if(CSK.me&&!force)return Promise.resolve(CSK.me);if(CSK.meBusy)return CSK.meBusy;
  CSK.meBusy=csApi("/me").then(r=>{CSK.me=r;if(CSK.allToday===undefined)CSK.allToday=!!(r.me.lead&&!r.me.staff);CSK.err="";CSK.meBusy=null;return r}).catch(e=>{CSK.meBusy=null;CSK.err=e.message;CSK.me=null;throw e});return CSK.meBusy}
const csLoad=(k,p)=>csApi(p).then(r=>{CSK[k]=r;csRe();return r}).catch(e=>{CSK[k]={error:e.message};csRe()});

/* ---------- khung chung: tab, ô tìm, nút Thêm khách / Tạo đơn ---------- */
function csCss(){if($("#cskhcss"))return;const s=document.createElement("style");s.id="cskhcss";s.textContent=`
.cs-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}.cs-bar .cs-s{position:relative;flex:0 1 320px;min-width:200px}.cs-bar .cs-sp{flex:1}.cs-bar select{width:auto;flex:none;height:40px;padding:4px 10px;border-radius:12px}.cs-bar .cs-s input{width:100%;height:40px;border-radius:12px;padding-left:12px}
.cs-drop{position:absolute;left:0;right:0;top:44px;background:var(--card,#fff);border:1px solid var(--line,#e5e7f2);border-radius:14px;box-shadow:0 12px 30px rgba(20,20,60,.15);z-index:30;overflow:hidden}
.cs-drop button{display:block;width:100%;text-align:left;border:0;background:none;padding:9px 12px;border-bottom:1px solid var(--line,#eee);cursor:pointer}.cs-drop button:hover{background:rgba(114,83,224,.07)}.cs-drop .lk{opacity:.7;cursor:default}
.cs-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.cs-tabs button{border:1px solid var(--line,#e5e7f2);background:var(--card,#fff);border-radius:999px;padding:6px 13px;font-weight:600;cursor:pointer}.cs-tabs button.on{background:linear-gradient(90deg,#4b54d1,#7253e0);color:#fff;border-color:transparent}.cs-tabs em{font-style:normal;background:#c0352b;color:#fff;border-radius:999px;padding:0 6px;font-size:11px;margin-left:5px}
.cs-pg{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:14px;margin-top:14px;align-items:start}.cs-pl,.cs-pr{display:flex;flex-direction:column;gap:14px;min-width:0}.cs-pg h3{margin:0 0 10px;font-size:15px}.cs-pg .card{margin:0}.cs-gn{background:#f6f7fc;border-radius:8px;padding:6px 9px;margin-top:4px;white-space:pre-wrap}.cs-ph{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}.cs-pa{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:420px}.cs-facts{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:13.5px}.cs-ol>div{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--line,#eee);font-size:13.5px}.cs-ol>div>span:nth-child(2){flex:1;min-width:0}.cs-ol .hint{width:80px;flex:none}.cs-pomodal{width:min(1180px,96vw)!important;max-width:1180px!important;background:#f4f5fb}.cs-po{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:12px;align-items:start}.cs-pocol{display:flex;flex-direction:column;gap:12px;min-width:0}.cs-pbx{background:#fff;border:1px solid var(--line,#e5e7f2);border-radius:14px;padding:12px 14px}.cs-pbh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.cs-pg2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cs-psr{position:relative}.cs-psr input{width:100%}.cs-pem{border:1px dashed #d4d7e6;border-radius:12px;padding:26px;text-align:center;color:#8a90aa;margin-top:10px}.cs-pit{width:100%;border-collapse:collapse;margin-top:10px;font-size:13.5px}.cs-pit th{font-size:12px;color:#646a85;text-align:left;padding:6px;border-bottom:1px solid #eee}.cs-pit td{padding:6px;border-bottom:1px solid #f1f1f5}.cs-kvr{grid-template-columns:1fr auto;align-items:center}.cs-kvr dd{text-align:right}.cs-kvr input{width:120px;text-align:right}.cs-pof{position:sticky;bottom:-16px;display:flex;gap:10px;align-items:center;background:#fff;border-top:1px solid var(--line,#e5e7f2);margin:12px -18px -16px;padding:12px 18px}.cs-po .cs-f input,.cs-po .cs-f3 input,.cs-po textarea{width:100%}@media(max-width:860px){.cs-po,.cs-pg2{grid-template-columns:1fr}}.cs-flt{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px}.cs-flt input{flex:1;min-width:160px;width:auto;height:38px}.cs-ct{display:flex;flex-direction:column;gap:1px;font-size:13px}.cs-ct span{color:var(--muted,#646a85)}
.cs-tiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:12px}.cs-tile{background:var(--card,#fff);border:1px solid var(--line,#e5e7f2);border-radius:16px;padding:11px 13px;text-align:left;cursor:pointer;min-width:0}.cs-tile b{display:block;font-size:22px}.cs-tile span{font-size:12.5px;color:var(--muted,#646a85);font-weight:600}.cs-tile.on{outline:2px solid #7253e0}
.cs-task{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--line,#e5e7f2);border-radius:14px;background:var(--card,#fff);margin-bottom:8px}.cs-task .sb{width:4px;align-self:stretch;border-radius:4px;flex:none}.cs-task .bd{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.cs-task .ac{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.cs-task .gy{font-size:13px}
.cs-g2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.cs-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13.5px}.cs-kv dt{color:var(--muted,#646a85)}.cs-kv dd{margin:0;font-weight:600;min-width:0}
.cs-tl{display:flex;flex-direction:column;gap:10px}.cs-tl>div{border-left:3px solid #d9dcef;padding-left:10px}.cs-tl>div.buy{border-color:#7253e0}.cs-tl>div.no{border-color:#e6a23c}.cs-tl>div.ok{border-color:#2f9e6b}
.cs-chips{display:flex;gap:6px;flex-wrap:wrap}.cs-chip{border:1px solid var(--line,#e5e7f2);background:var(--card,#fff);border-radius:999px;padding:5px 12px;font-size:13px;font-weight:600;cursor:pointer}.cs-chip.on{background:#eef0ff;border-color:#7253e0;color:#4b54d1}
.cs-f{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cs-f3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.cs-fl{display:flex;flex-direction:column;gap:4px;min-width:0}.cs-fl>span{font-size:12.5px;color:var(--muted,#646a85);font-weight:600}.cs-fl input,.cs-fl select,.cs-fl textarea{width:100%}
.cs-sec{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#646a85);font-weight:700;margin:6px 0 2px}
.cs-it{display:flex;gap:8px;align-items:center;margin-bottom:6px}.cs-it select{flex:1;min-width:0}.cs-it input{width:70px;text-align:right}.cs-it .n{width:90px;text-align:right}
.cs-bars{display:flex;align-items:flex-end;gap:6px;height:150px}.cs-bars div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;height:100%;min-width:0}.cs-bars i{display:block;width:100%;max-width:28px;background:linear-gradient(180deg,#7253e0,#4b54d1);border-radius:6px 6px 2px 2px}.cs-bars span{font-size:10.5px;color:var(--muted,#646a85);white-space:nowrap}
.cs-fun div{display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:6px}.cs-fun em{font-style:normal;width:110px;flex:none;color:var(--muted,#646a85);font-weight:600}.cs-fun i{display:block;height:22px;border-radius:6px;background:#eef0ff;position:relative;min-width:40px}.cs-fun i b{position:absolute;left:8px;top:1px;color:#4b54d1;font-size:12.5px}
.cs-prog{height:8px;border-radius:99px;background:#eef0f6;overflow:hidden;min-width:80px}.cs-prog i{display:block;height:100%;background:linear-gradient(90deg,#4b54d1,#7253e0)}
@media(max-width:760px){.cs-pg{grid-template-columns:1fr}.cs-bar .cs-s{flex-basis:100%}.cs-bar>.btn{flex:1}.cs-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.cs-g2,.cs-f,.cs-f3{grid-template-columns:1fr}.cs-task{flex-wrap:wrap}.cs-task .ac{width:100%;justify-content:flex-start}.cs-hm{display:none}}`;document.head.appendChild(s)}

function csFrame(m,title,sub,body,bar){
  csCss();if(CSK.open&&CSK.openPage!==PAGE){CSK.open=null;CSK.prof=null}
  if(!CSK.me){if(CSK.err){m.innerHTML=H(title,"")+`<section class="card"><p>${esc(CSK.err)}</p><p class="hint">Mục này dành cho CSKH, Lead Sale, CEO. Cần cấp quyền ở Cài đặt › Tài khoản & phân quyền (nhóm "CSKH khách lẻ") hoặc xếp nhân sự vào phòng CSKH / Sale Kênh bán lẻ.</p></section>`;return}
    m.innerHTML=H(title,"")+`<section class="card"><p class="hint">Đang tải…</p></section>`;csLoadMe().then(csRe).catch(()=>csRe());return}
  const lead=csLead(),cnt=CSK.today&&CSK.today.rows?CSK.today.rows.filter(r=>["qua","nay","moi"].includes(r.state)).length:0;
  const tabs=[["cs_tq","Tổng quan"],["cs_today","Việc hôm nay",cnt],["cs_kh","Khách hàng"],["cs_don","Đơn hàng"]].concat(lead?[["cs_chia","Chia khách"],["cs_bc","Báo cáo"],["cs_cd","Cài đặt"]]:[]);
  const cur=PAGE==="fb_cskh"?"cs_tq":PAGE;
  if(CSK.open){m.innerHTML=H("Hồ sơ khách","")+csProfile();csBind(m);csProfBind(m);return}
  m.innerHTML=H(title,sub)+`<div class="cs-tabs">${tabs.map(([k,t,n])=>`<button data-csgo="${k}" class="${cur===k&&!CSK.open?"on":""}">${t}${n?`<em>${n}</em>`:""}</button>`).join("")}</div>
   <div class="cs-bar">${bar&&bar.search||`<div class="cs-s"><input id="csgq" placeholder="Tìm khách: SĐT, tên, mã đơn" value="${esc(CSK.gq)}" autocomplete="off">${csDrop()}</div>`}${bar&&bar.extra||""}<span class="cs-sp"></span>
   <button class="btn" data-csnewkh="1">＋ Thêm khách</button><button class="btn pri" data-csnewdon="">＋ Tạo đơn</button></div>`+(CSK.open?csProfile():body());
  csBind(m);
}
function csDrop(){if(!CSK.gq||CSK.gq.length<2||!CSK.gres)return "";const R=CSK.gres;
  return `<div class="cs-drop">${R.length?R.map(r=>r.lock?`<button class="lk" disabled><b>${esc(r.masked)}</b><div class="hint">Khách đang do ${esc(r.owner)} chăm, không xem được</div></button>`:`<button data-csopen="${r.phone}"><b>${esc(r.name)}</b> ${pill(r.tier,r.tier==="VIP"?"vio":"gry")}<div class="hint">${esc(csPh(r.phone))} · ${esc(r.addr)}</div></button>`).join(""):`<button data-csnewkh="${esc(CSK.gq.replace(/\D/g,""))}"><b>Không thấy khách "${esc(CSK.gq)}"</b><div class="hint">Bấm để thêm khách mới</div></button>`}</div>`}
let _csGqT=0;
function csBind(m){
  const gq=m.querySelector("#csgq");if(gq){gq.oninput=()=>{CSK.gq=gq.value;clearTimeout(_csGqT);if(CSK.gq.trim().length<2){CSK.gres=null;const d=m.querySelector(".cs-drop");if(d)d.remove();return}
    _csGqT=setTimeout(()=>csApi("/search?q="+encodeURIComponent(CSK.gq.trim())).then(r=>{CSK.gres=r;const box=m.querySelector(".cs-s");if(!box)return;const old=box.querySelector(".cs-drop");if(old)old.remove();box.insertAdjacentHTML("beforeend",csDrop());csBind2(box)}).catch(csErr),300)};
    gq.onkeydown=e=>{if(e.key==="Escape"){CSK.gq="";CSK.gres=null;renderMain()}}}
  csBind2(m);
}
function csBind2(root){
  root.querySelectorAll("[data-csgo]").forEach(b=>b.onclick=()=>{CSK.open=null;PAGE=b.dataset.csgo;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}window.RM_TOP=true;render()});
  root.querySelectorAll("[data-csquick]").forEach(b=>b.onclick=e=>{if(e.target.closest("button"))return;e.stopPropagation();csQuick(b.dataset.csquick)});
  root.querySelectorAll("[data-csopen]").forEach(b=>b.onclick=e=>{e.stopPropagation();csOpen(b.dataset.csopen)});
  root.querySelectorAll("[data-csnewkh]").forEach(b=>b.onclick=e=>{e.stopPropagation();csKhForm(null,b.dataset.csnewkh)});
  root.querySelectorAll("[data-csnewdon]").forEach(b=>b.onclick=e=>{e.stopPropagation();csDonForm(b.dataset.csnewdon||"")});
  root.querySelectorAll("[data-cslog]").forEach(b=>b.onclick=e=>{e.stopPropagation();csLogForm(b.dataset.cslog)});
  root.querySelectorAll("[data-csedit]").forEach(b=>b.onclick=e=>{e.stopPropagation();csKhForm(b.dataset.csedit)});
  root.querySelectorAll("[data-cscopy]").forEach(b=>b.onclick=e=>{e.stopPropagation();const t=b.dataset.cscopy;try{navigator.clipboard.writeText(t).then(()=>toast("Đã chép: "+t),()=>toast(t))}catch(er){toast(t)}});
}
function csOpen(phone){CSK.open=phone;CSK.openPage=PAGE;CSK.prof=null;CSK.gq="";CSK.gres=null;CSK.ptab="don";window.RM_TOP=true;
  csApi("/customer/"+phone).then(r=>{CSK.prof=r;renderMain()}).catch(e=>{CSK.open=null;csErr(e);renderMain()});renderMain()}

/* ---------- Tổng quan ---------- */
function pCsTq(m){
  const lead=csLead(),month=CSK.month||csToday().slice(0,7);
  if(CSK.me&&(!CSK.ov||CSK.ov.month!==month)&&!CSK.ov_busy){CSK.ov_busy=1;csApi("/overview?month="+month).then(r=>{CSK.ov=r;CSK.ov_busy=0;csRe()}).catch(e=>{CSK.ov_busy=0;CSK.ov={month,error:e.message};csRe()})}
  if(CSK.me&&!CSK.today)csLoad("today","/today");
  csFrame(m,"CSKH khách lẻ",lead?"Tổng quan cả nhóm CSKH":"Tổng quan của tôi",()=>{
    const O=CSK.ov;if(!O||O.month!==month)return `<section class="card"><p class="hint">Đang tải…</p></section>`;if(O.error)return `<section class="card"><p>${esc(O.error)}</p></section>`;
    const B=O.base||{},k=O.kpi||0,dt=O.upsell.total,pct=k?Math.round(dt/k*100):0,mx=Math.max(1,...O.days.map(d=>d.v)),F=O.funnel;
    const months=[0,1,2,3,4,5].map(i=>{const d=new Date(Date.parse(csToday().slice(0,7)+"-15T00:00:00Z"));d.setUTCMonth(d.getUTCMonth()-i);return d.toISOString().slice(0,7)});
    return `<div class="acts" style="justify-content:flex-end;margin-bottom:8px"><select id="csmon" style="width:auto">${opt(months.map(x=>[x,"Tháng "+x.slice(5)+"/"+x.slice(0,4)]),month)}</select></div>
    <div class="cs-tiles" style="grid-template-columns:repeat(4,minmax(0,1fr))">
     <div class="cs-tile"><b>${nf(B.total)}</b><span>${lead?"Tổng khách lẻ":"Khách phụ trách"}</span><div class="hint">+${nf(B.moi)} khách mới trong tháng${lead&&B.chua?` · ${nf(B.chua)} chưa chia`:""}</div></div>
     <div class="cs-tile"><b style="color:#4b54d1">${nf(B.vip)}</b><span>Khách VIP trở lên</span><div class="hint">Tỷ lệ mua lại ${B.buyers?Math.round(B.vip/B.buyers*100):0}%</div></div>
     <div class="cs-tile"><b style="color:#137a4b">${nf(dt)}</b><span>Doanh thu bán thêm (${nf(O.upsell.orders)} đơn)</span>${k?`<div class="cs-prog" style="margin-top:6px"><i style="width:${Math.min(100,pct)}%"></i></div><div class="hint">${pct}% chỉ tiêu ${nf(k)}</div>`:`<div class="hint">${lead?"Chưa đặt chỉ tiêu (Cài đặt)":""}</div>`}</div>
     <div class="cs-tile"><b style="color:#c0352b">${nf(B.qua)}</b><span>Khách quá hạn chưa gọi</span></div></div>
    <section class="card"><div class="card-h"><h2>Hôm nay${lead?" theo từng CSKH":""}</h2><span class="hint">tính theo lần ghi kết quả</span></div>
     ${tbl(["CSKH","Cần gọi","Đã gọi","Tiến độ","Chốt đơn","Quá hạn","Doanh thu tháng"],O.per.map(r=>`<tr><td><b>${esc(r.name||"(chưa rõ tên)")}</b></td><td class="n">${nf(r.can)}</td><td class="n">${nf(r.goi)}</td><td><div class="cs-prog"><i style="width:${r.can?Math.min(100,Math.round(r.goi/r.can*100)):0}%"></i></div></td><td class="n">${nf(r.chot)}</td><td class="n"${r.qua>4?' style="color:#c0352b;font-weight:700"':""}>${nf(r.qua)}</td><td class="n">${nf(r.dt)}</td></tr>`))}</section>
    <div class="cs-g2"><section class="card"><h2>Doanh thu bán thêm 10 ngày gần nhất</h2><div class="cs-bars">${O.days.map(d=>`<div><span>${d.v?Math.round(d.v/1e5)/10+"tr":""}</span><i style="height:${Math.round(d.v/mx*110)}px"></i><span>${d.day.slice(8)}/${d.day.slice(5,7)}</span></div>`).join("")}</div></section>
     <section class="card"><h2>Từ cuộc gọi tới đơn (tháng)</h2><div class="cs-fun">${[["Cuộc gọi",F.goi],["Khách bắt máy",F.bat],["Chốt đơn",F.chot],["Giao thành công",F.giao]].map(([t,n])=>`<div><em>${t}</em><i style="width:${F.goi?Math.max(12,Math.round(n/F.goi*100)):12}%"><b>${nf(n)}</b></i></div>`).join("")}</div><p class="hint">Chốt / bắt máy: ${F.bat?Math.round(F.chot/F.bat*100):0}%</p></section></div>
    <div class="cs-g2"><section class="card"><h2>Sản phẩm bán thêm nhiều nhất</h2>${O.products.length?tbl(["Sản phẩm","Số lượng","Doanh thu"],O.products.map(p=>`<tr><td>${esc(p.n)}</td><td class="n">${nf(p.q)}</td><td class="n">${nf(p.v)}</td></tr>`)):`<p class="hint">Chưa có đơn bán thêm trong tháng.</p>`}</section>
     <section class="card"><h2>🎂 Sinh nhật khách trong tháng</h2>${O.birthdays.length?tbl(["Khách","Sinh nhật"].concat(lead?["CSKH"]:[]),O.birthdays.map(b=>`<tr class="clk" data-csopen="${b.phone}"><td><b>${esc(b.name)}</b><br><span class="hint">${esc(csPh(b.phone))}</span></td><td>${esc(b.birthday)}</td>${lead?`<td>${esc(b.owner_name||"—")}</td>`:""}</tr>`)):`<p class="hint">Chưa có khách nào ghi sinh nhật tháng này. Hỏi sinh nhật khi gọi và ghi vào hồ sơ.</p>`}</section></div>
    <section class="card"><h2>Khách mới theo nguồn (tháng)</h2>${O.sources.length?tbl(["Nguồn","Khách mới"],O.sources.map(s=>`<tr><td>${esc(s.source||"Không rõ")}</td><td class="n">${nf(s.n)}</td></tr>`)):`<p class="hint">Chưa có.</p>`}</section>`});
  const ms=m.querySelector("#csmon");if(ms)ms.onchange=()=>{CSK.month=ms.value;renderMain()};
}

/* ---------- Việc hôm nay ---------- */
function pCsToday(m){
  if(CSK.me&&!CSK.today)csLoad("today","/today"+(csLead()&&CSK.allToday?"?all=1":""));
  csFrame(m,"Việc hôm nay",(csLead()?(CSK.allToday?"Tất cả CSKH":"Khách của tôi"):"")+" · "+csFd(csToday()),()=>{
    const T=CSK.today;if(!T)return `<section class="card"><p class="hint">Đang tải…</p></section>`;if(T.error)return `<section class="card"><p>${esc(T.error)}</p></section>`;
    const R=T.rows,g=k=>R.filter(r=>r.state===k),sn=R.filter(r=>r.bday),f=CSK.tf;
    const tile=(k,t,n,col)=>`<button class="cs-tile${f===k?" on":""}" data-cstf="${k}"><b style="color:${col}">${n}</b><span>${t}</span></button>`;
    const show=f==="all"?R.filter(r=>["qua","nay","moi"].includes(r.state)):f==="sn"?sn:g(f);
    return `${csLead()?`<div class="acts" style="margin-bottom:8px"><label class="ck"><input type="checkbox" id="csall" ${CSK.allToday?"checked":""}> Xem việc của mọi CSKH</label></div>`:""}
    <div class="cs-tiles">${tile("qua","Quá hạn, gọi trước",g("qua").length,"#c0352b")}${tile("nay","Hẹn gọi hôm nay",g("nay").length,"#a15c00")}${tile("moi","Khách mới, chưa gọi",g("moi").length,"#1d5fd1")}${tile("ky","Đến kỳ mua lại",g("ky").length,"#4b54d1")}${tile("sn","Sinh nhật tuần này",sn.length,"#7253e0")}</div>
    <p class="hint">Đã gọi hôm nay: <b>${nf(T.calledToday)}</b> khách.${f!=="all"?` <button class="lnk" data-cstf="all">← Xem tất cả việc cần gọi</button>`:""}</p>
    ${show.length?show.map(csTask).join(""):`<section class="card"><p class="hint">Không còn khách nào trong mục này. Khách đã hẹn ngày khác sẽ tự quay lại đúng ngày.</p></section>`}
    ${T.more?`<p class="hint">Còn ${nf(T.more)} khách nữa, gọi xong bớt sẽ hiện tiếp.</p>`:""}
    <p class="hint">Gọi xong phải ghi kết quả và chọn ngày gọi lần sau. Quên chọn ngày thì hôm sau khách tự chuyển sang Quá hạn.</p>`});
  m.querySelectorAll("[data-cstf]").forEach(b=>b.onclick=()=>{CSK.tf=b.dataset.cstf;renderMain()});
  const a=m.querySelector("#csall");if(a)a.onchange=()=>{CSK.allToday=a.checked;CSK.today=null;renderMain()};
}
function csTask(c){const col={qua:"#c0352b",nay:"#a15c00",moi:"#1d5fd1",ky:"#7253e0",cho:"#2f9e6b"}[c.state]||"#999";
  const sub=c.state==="qua"?`Hẹn ${csFd(c.next_call)}, trễ ${csDiff(csToday(),c.next_call)} ngày`:c.state==="nay"?"Hẹn gọi hôm nay":c.last_order_day?`Đơn gần nhất giao ${csFd(c.last_order_day)}`:"";
  return `<div class="cs-task"><span class="sb" style="background:${col}"></span><div class="bd">
   <div class="acts" style="gap:6px;margin:0"><b>${esc(c.name||"(chưa có tên)")}</b>${csTier(c)}${csStP(c.state)}${c.bday?pill("🎂 "+c.birthday,"vio"):""}${csLead()&&CSK.allToday?pill(c.owner_name||"","gry"):""}</div>
   ${csContact(c)}<div class="hint">${sub}${c.order_count?` · ${c.order_count} đơn`:""}${c.last_result?` · lần trước: ${esc(c.last_result)}`:""}</div>
   <div class="gy">💡 ${esc(csGoiY(c))}</div></div>
   <div class="ac"><button class="btn sm pri" data-cslog="${c.phone}">📝 Ghi cuộc gọi</button><button class="btn sm" data-csnewdon="${c.phone}">Tạo đơn</button><button class="btn sm" data-csopen="${c.phone}">Hồ sơ</button></div></div>`}

/* ---------- Khách hàng ---------- */
function pCsKh(m){
  const F=CSK.lf,key=JSON.stringify(F);
  if(CSK.me&&(!CSK.list||CSK.list.key!==key)&&!CSK.list_busy){CSK.list_busy=1;const q=new URLSearchParams({q:F.q,tier:F.tier,state:F.state,owner:F.owner});
    csApi("/list?"+q).then(r=>{CSK.list={...r,key};CSK.list_busy=0;csRe()}).catch(e=>{CSK.list={error:e.message,key};CSK.list_busy=0;csRe()})}
  csFrame(m,"Khách hàng",csLead()?"Toàn bộ khách lẻ Facebook":"Khách được chia cho tôi",()=>{
    const L=CSK.list,lead=csLead(),staff=(CSK.me.staff||[]);
    if(!L||L.key!==key)return `<section class="card"><p class="hint">Đang tải…</p></section>`;if(L.error)return `<section class="card"><p>${esc(L.error)}</p></section>`;
    return `<p class="hint">${nf(L.total)} khách${L.total>L.rows.length?` · hiện ${L.rows.length} khách mua gần nhất, gõ ô lọc để tìm thêm`:""}</p>
     <section class="card flush">${L.rows.length?tbl(["Khách","Liên hệ","Hạng","Số đơn","Tổng mua","Gọi lần sau"].concat(lead?["CSKH"]:[]).concat([""]),L.rows.map(c=>`<tr class="clk" data-csquick="${c.phone}"><td><b>${esc(c.name||"(chưa có tên)")}</b><br><span class="hint">${esc(c.source)}</span></td><td style="min-width:200px">${csContact(c)}</td><td>${csTier(c)}</td><td class="n">${nf(c.order_count)}</td><td class="n">${nf(c.total_spent)}</td><td>${c.next_call?pill(csFd(c.next_call),CS_ST[c.state]?CS_ST[c.state][1]:"gry"):csStP(c.state)}</td>${lead?`<td>${esc(c.owner_name||"—")}</td>`:""}<td style="white-space:nowrap"><button class="btn sm" data-csnewdon="${c.phone}" title="Tạo đơn cho khách này">＋ Đơn</button> <button class="btn sm pri" data-cslog="${c.phone}">📝 Ghi cuộc gọi</button></td></tr>`)):`<p class="hint pad">Chưa có khách. ${lead?"Máy chủ đang kéo khách từ Poscake, xem tiến độ ở Cài đặt.":"Lead Sale chưa chia khách cho bạn."}</p>`}</section>`},{search:`<div class="cs-s"><input id="cslq" placeholder="Tìm: tên, SĐT, tỉnh" value="${esc(F.q)}" autocomplete="off"></div>`,
    extra:`<select id="cslt">${opt([["","Hạng"]].concat(((CSK.me&&CSK.me.settings.tiers)||[]).map(t=>[t.n,t.n])).concat([["Thường","Thường"]]),F.tier)}</select><select id="csls">${opt([["","Trạng thái"],["qua","Quá hạn"],["nay","Hôm nay gọi"],["moi","Khách mới"],["ky","Đến kỳ mua lại"],["cho","Chưa tới hạn"],["ngung","Ngừng chăm sóc"]],F.state)}</select>${csLead()?`<select id="cslo">${opt([["","CSKH"],["_none","Chưa chia"]].concat((CSK.me&&CSK.me.staff||[]).map(x=>[x.id,x.name])),F.owner)}</select>`:""}`});
  let t=0;const q=m.querySelector("#cslq");if(q){q.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{F.q=q.value.trim();renderMain();const x=document.querySelector("#cslq");if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},400)}}
  [["#cslt","tier"],["#csls","state"],["#cslo","owner"]].forEach(([s,k])=>{const e=m.querySelector(s);if(e)e.onchange=()=>{F[k]=e.value;renderMain()}});
}

/* ---------- Hồ sơ ---------- */
const csTagsOf=c=>String(c.tags||"").split("|").filter(Boolean);
const CS_TRAITS0=["Có con nhỏ","Có người già","Dễ tính","Khó tính","Cả nể","Hay hỏi kỹ","Nhạy cảm về giá","Thích quà tặng","Mua làm quà","Chỉ nhắn Zalo","Ngại nghe điện thoại","Khách quen"];
const csItems=o=>{try{return JSON.parse(o.items)}catch(e){return []}};
function csLogsHtml(L,empty){return L.length?`<div class="cs-tl">${L.map(g=>`<div class="${g.result==="Đã chốt đơn"?"buy":["Không nghe máy","Hẹn gọi lại","Sai số / thuê bao"].includes(g.result)?"no":"ok"}"><div><b>${csFd(g.day)}</b> · ${esc(g.result)} <span class="hint">· ${esc(g.by_name||"")}${g.next_call?" · hẹn gọi lại "+csFd(g.next_call):""}</span></div>${g.note?`<div class="cs-gn">${esc(g.note)}</div>`:""}${g.reason?`<div class="hint">${g.result==="Khách từ chối"?"Lý do từ chối":"Lý do"}: ${esc(g.reason)}</div>`:""}${g.question?`<div class="hint">Khách hỏi: ${esc(g.question)}</div>`:""}</div>`).join("")}</div>`:`<p class="hint" style="margin:0">${empty}</p>`}
function csOrdList(P){return [...P.web.filter(w=>!w.pos_id||!P.orders.some(o=>String(o.id)===String(w.pos_id))).map(w=>({d:w.day,it:csItems(w),t:w.total,st:w.pos_id?"Chờ giao":"Chưa gửi Poscake"})),...P.orders.map(o=>({d:o.day,it:csItems(o),t:o.total,st:""}))].sort((a,b)=>String(b.d).localeCompare(String(a.d)))}
function csOrdHtml(ords){return ords.length?`<div class="cs-ol">${ords.map(o=>`<div><span class="hint">${csFd(o.d)}</span><span>${o.it.map(i=>esc(i.n)+(i.q>1?" × "+i.q:"")).join(", ")}${o.st?" "+pill(o.st,"amb"):""}</span><b>${nf(o.t)}</b></div>`).join("")}</div>`:`<p class="hint" style="margin:0">Chưa có đơn giao thành công.</p>`}
/* Bấm vào khách ở danh sách: cửa sổ xem nhanh. Nút "Xem hồ sơ chi tiết" mới sang trang hồ sơ (chị Hoa 10/11). */
function csQuick(phone){
  csApi("/customer/"+phone).then(P=>{const c=P.customer,tags=csTagsOf(c),ords=csOrdList(P);
    crmModal(esc(c.name||"(chưa có tên)")+" "+csTier(c),`${csContact(c)}
     <div class="cs-facts"><span><b>${c.order_count}</b> đơn</span><span><b>${nf(c.total_spent)}đ</b> tổng mua</span><span>Mua cuối <b>${c.last_order_day?csFd(c.last_order_day):"—"}</b></span><span>${c.next_call?"Gọi lại <b>"+csFd(c.next_call)+"</b>":csStP(c.state)}</span></div>
     ${tags.length?`<div class="cs-chips" style="margin-top:8px">${tags.map(t=>pill(t,"vio")).join("")}</div>`:""}
     ${c.stop_reason?`<div class="note red" style="margin-top:8px"><b>Đã ngừng chăm sóc:</b> ${esc(c.stop_reason)}${c.stop_note?" – "+esc(c.stop_note):""}</div>`:""}
     ${c.note?`<div class="cs-gn" style="margin-top:8px">📌 ${esc(c.note)}</div>`:""}
     <div class="cs-sec" style="margin-top:12px">Cuộc gọi gần nhất</div>${csLogsHtml(P.logs.slice(0,3),"Chưa gọi lần nào.")}
     <div class="cs-sec" style="margin-top:12px">Đơn gần nhất</div>${csOrdHtml(ords.slice(0,3))}
     <div class="acts" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="cqdon">Tạo đơn</button><button class="btn" id="cqlog">📝 Ghi cuộc gọi</button><button class="btn pri" id="cqopen">Xem hồ sơ chi tiết</button></div>`);
    $("#cqdon").onclick=()=>{closeCM();csDonForm(c.phone)};$("#cqlog").onclick=()=>{closeCM();csLogForm(c.phone)};$("#cqopen").onclick=()=>{closeCM();csOpen(c.phone)}}).catch(csErr)}
/* Ngừng chăm sóc: CSKH hoặc Lead bấm, chọn lý do (bắt buộc). Khách ra khỏi Việc hôm nay, không chia nữa; Lead / CEO bấm "Chăm sóc lại" khi cần. */
function csStopForm(phone){const R=(CSK.me&&CSK.me.stopReasons)||["Khách yêu cầu không gọi nữa","Sai số / không liên lạc được","Khách bom hàng, hay hoàn","Khách khiếu nại, không hài lòng","Là đại lý / khách sỉ","Khác"];let r="";
  crmModal("Ngừng chăm sóc khách",`<p class="hint" style="margin-top:0">Khách sẽ ra khỏi Việc hôm nay và không được chia nữa. Lịch sử vẫn giữ. Lead Sale / CEO cho chăm sóc lại được.</p>
   <div class="cs-chips">${R.map(x=>`<button type="button" class="cs-chip" data-sr="${esc(x)}">${esc(x)}</button>`).join("")}</div>
   <label class="cs-fl" style="margin-top:10px"><span>Ghi rõ (bắt buộc khi chọn Khác)</span><textarea id="csstn" rows="2"></textarea></label><div id="csste" class="err"></div>
   <div class="acts" style="justify-content:flex-end;margin-top:10px"><button class="btn" onclick="closeCM()">Hủy</button><button class="btn pri" id="csstok">Ngừng chăm sóc</button></div>`);
  $("#crmm").querySelectorAll("[data-sr]").forEach(b=>b.onclick=()=>{r=b.dataset.sr;$("#crmm").querySelectorAll("[data-sr]").forEach(x=>x.classList.toggle("on",x===b))});
  $("#csstok").onclick=()=>{if(!r){$("#csste").textContent="Chọn lý do";return}$("#csstok").disabled=true;csApi("/customer/"+phone+"/stop",{method:"POST",body:JSON.stringify({reason:r,note:$("#csstn").value})}).then(()=>{closeCM();toast("Đã ngừng chăm sóc khách");csAfterChange(phone)}).catch(e=>{$("#csstok").disabled=false;$("#csste").textContent=e.message})}}
/* Hồ sơ khách chi tiết, một trang (chị Hoa 10/11): trái = thông tin + đặc điểm + ghi nhớ; phải = ghi cuộc gọi tại chỗ + các lần gọi + đơn hàng. */
function csProfile(){
  const P=CSK.prof;if(!P)return `<p><button class="lnk" data-csback="1">← Quay lại</button></p><section class="card"><p class="hint">Đang tải hồ sơ…</p></section>`;
  const c=P.customer,tags=csTagsOf(c);
  const cnt={};P.orders.forEach(o=>csItems(o).forEach(i=>cnt[i.n]=(cnt[i.n]||0)+i.q));const fav=(Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]||[""])[0];
  const since=c.last_order_day?csDiff(csToday(),c.last_order_day):null,row=(k,v)=>`<dt>${k}</dt><dd>${v}</dd>`;
  const traits=[...new Set([...((CSK.me&&CSK.me.traits)||CS_TRAITS0),...tags])];
  const RES=(CSK.me&&CSK.me.results)||["Đã chốt đơn","Không nghe máy","Hẹn gọi lại","Kết nối Zalo","Khách từ chối","Sai số / thuê bao"],REA=(CSK.me&&CSK.me.reasons)||[],cy=csCyc(c.last_product);
  const ords=csOrdList(P);
  return `<p style="margin:0 0 10px"><button class="lnk" data-csback="1">← Quay lại</button></p>
  <section class="card"><div class="cs-ph"><div style="flex:1;min-width:240px"><h2 style="margin:0 0 6px">${esc(c.name||"(chưa có tên)")} ${csTier(c)} ${c.next_call?pill("Gọi lại "+csFd(c.next_call),CS_ST[c.state]?CS_ST[c.state][1]:"gry"):csStP(c.state)}</h2>${csContact(c)}
    ${tags.length?`<div class="cs-chips" style="margin-top:6px">${tags.map(t=>pill(t,"vio")).join("")}</div>`:""}</div>
   <div class="cs-pa"><button class="btn" data-csnewdon="${c.phone}">Tạo đơn</button><button class="btn" data-csedit="${c.phone}">✎ Sửa liên hệ, địa chỉ</button><button class="btn" data-cscopy="${esc(c.phone+" - "+(c.name||"")+" - "+csAddr(c))}">Chép SĐT + địa chỉ</button>${c.stop_reason?"":`<button class="btn" id="csstop" style="color:#c0352b">Ngừng chăm sóc</button>`}</div></div>
   ${c.stop_reason?`<div class="note red" style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1"><b>Đã ngừng chăm sóc:</b> ${esc(c.stop_reason)}${c.stop_note?" – "+esc(c.stop_note):""} <span class="hint">· ${esc(c.stop_by)} ${c.stop_at?csFd(new Date(Date.parse(c.stop_at)+7*36e5).toISOString().slice(0,10)):""}</span></span>${csLead()?`<button class="btn sm" id="csresume">Chăm sóc lại</button>`:`<span class="hint">Lead Sale / CEO mới cho chăm sóc lại được</span>`}</div>`:""}</section>
  <div class="cs-pg">
   <div class="cs-pl">
    <section class="card"><h3>Thông tin</h3><dl class="cs-kv">${row("Đã mua",`<b>${c.order_count}</b> đơn · ${nf(c.total_spent)}đ`)}${row("Mua cuối",since===null?"—":csFd(c.last_order_day)+` <span class="hint">(${since} ngày trước)</span>`)}${row("Hạng",`<select id="cstier" style="width:auto;padding:3px 8px">${opt([["","Tự động ("+(c.tier_manual?"theo số đơn":c.tier)+")"]].concat(((CSK.me&&CSK.me.settings.tiers)||[]).map(t=>[t.n,t.n])).concat([["Thường","Thường"]]),c.tier_manual||"")}</select>${c.tier_manual?` <span class="hint">gán tay</span>`:""}`)}${row("Hay mua",esc(fav)||"—")}${row("Sinh nhật",esc(c.birthday)||"<span class='hint'>chưa có</span>")}${c.phone2?row("Số phụ",esc(c.phone2)):""}${row("Nguồn",esc(c.source)||"—")}${row("CSKH",esc(c.owner_name)||"Chưa chia")}</dl></section>
    <section class="card"><h3>Đặc điểm khách</h3><div class="cs-chips" id="cstr">${traits.map(t=>`<button type="button" class="cs-chip${tags.includes(t)?" on":""}" data-tr="${esc(t)}">${tags.includes(t)?"✓ ":""}${esc(t)}</button>`).join("")}</div>
     <div class="acts" style="margin:8px 0 0"><input id="cstradd" placeholder="Thêm đặc điểm khác…" style="flex:1;min-width:140px"><button class="btn sm" id="cstraddb">Thêm</button></div>
     <label class="cs-fl" style="margin-top:10px"><span>Ghi nhớ về khách</span><textarea id="csmemo" rows="3" placeholder="Hoàn cảnh, thói quen, điều cần nhớ khi gọi…">${esc(c.note)}</textarea></label>
     <div class="acts" style="justify-content:flex-end;margin:8px 0 0"><span class="hint" id="cstrmsg" style="flex:1"></span><button class="btn pri sm" id="cstrsave">Lưu đặc điểm</button></div></section>
   </div>
   <div class="cs-pr">
    <section class="card"><h3>Ghi cuộc gọi</h3><div class="note" style="margin:0 0 10px">💡 ${esc(csGoiY(c))}</div>
     <div class="cs-chips" id="csres">${RES.map(r=>`<button type="button" class="cs-chip" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
     <div id="csrsn2" hidden class="cs-fl" style="margin-top:8px"><span>Lý do từ chối</span><select id="csreason2">${opt(REA,"")}</select></div>
     <textarea id="csnote2" rows="2" placeholder="Ghi chú cuộc gọi: khách nói gì, hẹn gì…" style="margin-top:8px;width:100%"></textarea>
     <input id="csq2" placeholder="Câu hỏi khó của khách (nếu có)" style="margin-top:8px;width:100%">
     <div class="acts" style="margin:8px 0 0;align-items:center"><span class="hint">Gọi lại:</span>${[["3 ngày",3],["7 ngày",7],["30 ngày",30],[cy+" ngày (chu kỳ)",cy]].map(([t,n])=>`<button type="button" class="cs-chip" data-n="${n}">${t}</button>`).join("")}<input type="date" id="cshen2" min="${csAdd(csToday(),1)}" style="width:auto"></div>
     <div class="acts" style="justify-content:flex-end;margin:10px 0 0"><span class="err" id="cserr2" style="flex:1"></span><button class="btn pri" id="cslogsave">Lưu cuộc gọi</button></div></section>
    <section class="card"><h3>Các lần gọi (${P.logs.length})</h3>${csLogsHtml(P.logs,"Chưa có cuộc gọi nào. Ghi cuộc gọi đầu tiên ở ô bên trên.")}</section>
    <section class="card"><h3>Đơn hàng (${ords.length})</h3>${csOrdHtml(ords)}</section>
   </div></div>`}
/* Gắn nút trong hồ sơ (gọi sau mỗi lần vẽ). */
function csProfBind(m){const P=CSK.prof;if(!P||!m.querySelector("#cslogsave"))return;const c=P.customer;let tags=csTagsOf(c),res="";
  const ts=m.querySelector("#cstier");if(ts)ts.onchange=()=>csApi("/customer/"+c.phone+"/tier",{method:"PUT",body:JSON.stringify({tier:ts.value})}).then(()=>{toast("Đã đổi hạng");csAfterChange(c.phone)}).catch(csErr);
  const st=m.querySelector("#csstop");if(st)st.onclick=()=>csStopForm(c.phone);
  const rs=m.querySelector("#csresume");if(rs)rs.onclick=()=>{rs.disabled=true;csApi("/customer/"+c.phone+"/resume",{method:"POST"}).then(()=>{toast("Khách được chăm sóc lại");csAfterChange(c.phone)}).catch(e=>{rs.disabled=false;csErr(e)})};
  const msg=()=>{m.querySelector("#cstrmsg").textContent="Chưa lưu"};
  const tog=t=>{tags=tags.includes(t)?tags.filter(x=>x!==t):tags.concat(t);m.querySelectorAll("#cstr [data-tr]").forEach(b=>{const on=tags.includes(b.dataset.tr);b.classList.toggle("on",on);b.textContent=(on?"✓ ":"")+b.dataset.tr});msg()};
  const bindTr=b=>b.onclick=()=>tog(b.dataset.tr);
  m.querySelectorAll("#cstr [data-tr]").forEach(bindTr);
  m.querySelector("#cstraddb").onclick=()=>{const v=m.querySelector("#cstradd").value.trim();if(!v)return;m.querySelector("#cstradd").value="";if(m.querySelector(`#cstr [data-tr="${CSS.escape(v)}"]`)){if(!tags.includes(v))tog(v);return}
    m.querySelector("#cstr").insertAdjacentHTML("beforeend",`<button type="button" class="cs-chip" data-tr="${esc(v)}">${esc(v)}</button>`);bindTr(m.querySelector("#cstr").lastElementChild);tog(v)};
  m.querySelector("#csmemo").oninput=msg;
  m.querySelector("#cstrsave").onclick=e=>{e.target.disabled=true;csApi("/customer/"+c.phone+"/traits",{method:"PUT",body:JSON.stringify({tags,note:m.querySelector("#csmemo").value})}).then(r=>{c.tags=r.tags;c.note=r.note;toast("Đã lưu đặc điểm khách");renderMain()}).catch(er=>{e.target.disabled=false;csErr(er)})};
  m.querySelectorAll("#csres [data-r]").forEach(b=>b.onclick=()=>{res=b.dataset.r;m.querySelectorAll("#csres [data-r]").forEach(x=>x.classList.toggle("on",x===b));m.querySelector("#csrsn2").hidden=res!=="Khách từ chối";m.querySelector("#cslogsave").textContent=res==="Đã chốt đơn"?"Lưu và tạo đơn":"Lưu cuộc gọi"});
  m.querySelectorAll(".cs-pr [data-n]").forEach(b=>b.onclick=()=>{m.querySelector("#cshen2").value=csAdd(csToday(),+b.dataset.n);m.querySelectorAll(".cs-pr [data-n]").forEach(x=>x.classList.toggle("on",x===b))});
  m.querySelector("#cslogsave").onclick=async e=>{const hen=m.querySelector("#cshen2").value,err=m.querySelector("#cserr2");
    if(!res){err.textContent="Chọn kết quả cuộc gọi";return}if(!hen||hen<=csToday()){err.textContent="Chọn ngày gọi lại (sau hôm nay)";return}
    e.target.disabled=true;try{await csApi("/log/"+c.phone,{method:"POST",body:JSON.stringify({result:res,reason:res==="Khách từ chối"?m.querySelector("#csreason2").value:"",note:m.querySelector("#csnote2").value,question:m.querySelector("#csq2").value,next_call:hen})});
      toast("Đã lưu cuộc gọi. Gọi lại "+csFd(hen));csAfterChange(c.phone);if(res==="Đã chốt đơn")csDonForm(c.phone)}catch(er){e.target.disabled=false;err.textContent=er.message}}}
document.addEventListener("click",e=>{const b=e.target.closest("[data-csback],[data-csptab]");if(!b||!$("#main")||!$("#main").contains(b))return;
  if(b.dataset.csback){CSK.open=null;CSK.prof=null;renderMain()}else{CSK.ptab=b.dataset.csptab;renderMain()}});

/* ---------- Ghi kết quả ---------- */
function csLogForm(phone){
  const RES=(CSK.me&&CSK.me.results)||["Đã chốt đơn","Không nghe máy","Hẹn gọi lại","Kết nối Zalo","Khách từ chối","Sai số / thuê bao"],REA=(CSK.me&&CSK.me.reasons)||[];
  const st={res:"",n:0};
  const draw=c=>{const cy=csCyc(c.last_product),q=[["+3 ngày",3],["+7 ngày",7],["+30 ngày",30],[`Theo chu kỳ (${cy} ngày)`,cy]];
    crmModal("Ghi cuộc gọi · "+esc(c.name||""),`${csContact(c)}
    <div class="cs-fl" style="margin-top:10px"><span>Kết quả cuộc gọi</span><div class="cs-chips">${RES.map(r=>`<button type="button" class="cs-chip${st.res===r?" on":""}" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div></div>
    <div id="csrsn" ${st.res==="Khách từ chối"?"":"hidden"} class="cs-fl" style="margin-top:8px"><span>Lý do từ chối</span><select id="csreason">${opt(REA,"")}</select></div>
    <div id="cschot" ${st.res==="Đã chốt đơn"?"":"hidden"} class="note" style="margin-top:8px">Khách đồng ý mua: lưu xong web mở luôn phiếu Tạo đơn, địa chỉ và số điện thoại điền sẵn.</div>
    <label class="cs-fl" style="margin-top:8px"><span>Ghi chú cuộc gọi</span><textarea id="csnote" rows="2" placeholder="Khách nói gì, cần nhớ gì cho lần sau"></textarea></label>
    <label class="cs-fl" style="margin-top:8px"><span>Câu hỏi khó của khách (nếu có)</span><input id="csq"></label>
    <div class="cs-sec" style="margin-top:12px">Thông tin khách (sửa ở đây là lưu vào hồ sơ)</div>
    <div class="cs-f"><label class="cs-fl"><span>Họ tên</span><input id="ci-name" value="${esc(c.name)}"></label><label class="cs-fl"><span>Sinh nhật (ngày/tháng)</span><input id="ci-bd" value="${esc(c.birthday)}" placeholder="18/06"></label>
     <label class="cs-fl"><span>Số phụ</span><input id="ci-ph2" inputmode="tel" value="${esc(c.phone2)}"></label><label class="cs-fl"><span>Số nhà, đường</span><input id="ci-st" value="${esc(c.addr_street)}"></label></div>
    <div class="cs-f3" style="margin-top:8px"><label class="cs-fl"><span>Phường / xã</span><input id="ci-wd" value="${esc(c.addr_ward)}"></label><label class="cs-fl"><span>Quận / huyện</span><input id="ci-ds" value="${esc(c.addr_district)}"></label><label class="cs-fl"><span>Tỉnh / thành</span><input id="ci-pv" value="${esc(c.addr_province)}"></label></div>
    <div class="cs-fl" style="margin-top:8px"><span>Đặc điểm khách</span><div class="cs-chips" id="ci-tags">${[...new Set([...((CSK.me&&CSK.me.traits)||CS_TRAITS0),...csTagsOf(c)])].map(t=>`<button type="button" class="cs-chip${csTagsOf(c).includes(t)?" on":""}" data-tg="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>
    <label class="cs-fl" style="margin-top:8px"><span>Ghi nhớ về khách (sở thích, hoàn cảnh, dùng sản phẩm gì…)</span><textarea id="ci-note" rows="2" placeholder="Ví dụ: nhà có trẻ nhỏ, dùng máy giặt cửa trước, thích giao giờ hành chính">${esc(c.note)}</textarea></label>
    <div class="cs-fl" style="margin-top:8px"><span>Gọi lại ngày (bắt buộc)</span><div class="cs-chips">${q.map(([t,n])=>`<button type="button" class="cs-chip" data-n="${n}">${t}</button>`).join("")}</div><input type="date" id="cshen" min="${csAdd(csToday(),1)}"></div>
    <div id="cserr" class="err"></div>
    <div class="acts" style="justify-content:flex-end;margin-top:10px"><button class="btn" id="csx">Hủy</button><button class="btn pri" id="csok">Lưu</button></div>`);
    const root=$("#crmm");
    root.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{st.res=b.dataset.r;root.querySelectorAll("[data-r]").forEach(x=>x.classList.toggle("on",x===b));$("#csrsn").hidden=st.res!=="Khách từ chối";$("#cschot").hidden=st.res!=="Đã chốt đơn";$("#csok").textContent=st.res==="Đã chốt đơn"?"Lưu và tạo đơn":"Lưu"});
    root.querySelectorAll("[data-tg]").forEach(b=>b.onclick=()=>b.classList.toggle("on"));
    root.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{$("#cshen").value=csAdd(csToday(),+b.dataset.n);root.querySelectorAll("[data-n]").forEach(x=>x.classList.toggle("on",x===b))});
    $("#csx").onclick=closeCM;
    $("#csok").onclick=async()=>{const hen=$("#cshen").value;if(!st.res){$("#cserr").textContent="Chọn kết quả cuộc gọi";return}if(!hen||hen<=csToday()){$("#cserr").textContent="Chọn ngày gọi lại (sau hôm nay), không thì mai khách sẽ báo Quá hạn";return}
      $("#csok").disabled=true;
      try{const info={tags:[...root.querySelectorAll("[data-tg].on")].map(b=>b.dataset.tg),name:$("#ci-name").value,birthday:$("#ci-bd").value,phone2:$("#ci-ph2").value,addr_street:$("#ci-st").value,addr_ward:$("#ci-wd").value,addr_district:$("#ci-ds").value,addr_province:$("#ci-pv").value,note:$("#ci-note").value};
        const changed=info.tags.join("|")!==csTagsOf(c).join("|")||["name","birthday","phone2","addr_street","addr_ward","addr_district","addr_province","note"].some(k=>String(info[k]||"").trim()!==String(c[k]||"").trim());
        if(changed){if(!info.name.trim()){$("#csok").disabled=false;$("#cserr").textContent="Cần họ tên khách";return}await csApi("/customer/"+c.phone,{method:"PUT",body:JSON.stringify(info)})}
        await csApi("/log/"+c.phone,{method:"POST",body:JSON.stringify({result:st.res,reason:st.res==="Khách từ chối"?$("#csreason").value:"",note:$("#csnote").value,question:$("#csq").value,next_call:hen})});
        closeCM();toast("Đã lưu. Gọi lại "+csFd(hen));csAfterChange(c.phone);if(st.res==="Đã chốt đơn")csDonForm(c.phone)}catch(e){$("#csok").disabled=false;$("#cserr").textContent=e.message}}};
  csGetCus(phone).then(draw).catch(csErr)}
function csGetCus(phone){if(CSK.prof&&CSK.prof.customer.phone===phone)return Promise.resolve(CSK.prof.customer);const T=CSK.today&&CSK.today.rows&&CSK.today.rows.find(r=>r.phone===phone);if(T)return Promise.resolve(T);return csApi("/customer/"+phone).then(r=>r.customer)}
function csAfterChange(phone){CSK.today=null;CSK.list=null;CSK.ov=null;if(CSK.open===phone)csApi("/customer/"+phone).then(r=>{CSK.prof=r;csRe()}).catch(()=>{});csRe()}

/* ---------- Thêm / sửa hồ sơ ---------- */
function csKhForm(phone,prefill){
  const go=c=>{const isNew=!c;c=c||{phone:prefill||"",name:"",phone2:"",birthday:"",addr_street:"",addr_ward:"",addr_district:"",addr_province:"",note:"",owner_id:CSK.me.me.id};
    const staff=CSK.me.staff||[];
    crmModal(isNew?"Thêm khách mới":"Sửa hồ sơ · "+esc(c.name),`${isNew?`<p class="hint">Dùng cho khách gọi hotline, nhắn Zalo, chưa có đơn trên Poscake. Khách có đơn Facebook thì web tự thêm, không cần nhập.</p>`:""}
     <div class="cs-sec">Liên hệ</div>
     <div class="cs-f"><label class="cs-fl"><span>Họ tên *</span><input id="ck-name" value="${esc(c.name)}"></label><label class="cs-fl"><span>Sinh nhật (ngày/tháng)</span><input id="ck-bd" value="${esc(c.birthday)}" placeholder="18/06"></label>
     <label class="cs-fl"><span>Số điện thoại chính *</span><input id="ck-ph" inputmode="tel" value="${esc(c.phone)}" ${isNew?"":"disabled"}></label><label class="cs-fl"><span>Số phụ</span><input id="ck-ph2" inputmode="tel" value="${esc(c.phone2)}"></label></div>
     <div class="cs-sec">Địa chỉ giao hàng</div>
     <label class="cs-fl"><span>Số nhà, đường, thôn/xóm</span><input id="ck-st" value="${esc(c.addr_street)}"></label>
     <div class="cs-f3" style="margin-top:8px"><label class="cs-fl"><span>Phường / xã</span><input id="ck-wd" value="${esc(c.addr_ward)}"></label><label class="cs-fl"><span>Quận / huyện</span><input id="ck-ds" value="${esc(c.addr_district)}"></label><label class="cs-fl"><span>Tỉnh / thành</span><input id="ck-pv" value="${esc(c.addr_province)}"></label></div>
     <div class="cs-sec">Khác</div>
     ${csLead()?`<label class="cs-fl"><span>CSKH phụ trách</span><select id="ck-own">${opt([["","— chưa chia"]].concat(staff.map(s=>[s.id,s.name])),c.owner_id||"")}</select></label>`:""}
     <label class="cs-fl" style="margin-top:8px"><span>Ghi chú về khách</span><textarea id="ck-note" rows="2">${esc(c.note)}</textarea></label>
     <div id="ckerr" class="err"></div>
     <div class="acts" style="justify-content:flex-end;margin-top:10px"><button class="btn" id="ckx">Hủy</button>${isNew?`<button class="btn" id="ckdon">Lưu và tạo đơn</button>`:""}<button class="btn pri" id="ckok">Lưu hồ sơ</button></div>`);
    $("#ckx").onclick=closeCM;
    const save=async toDon=>{const b={name:$("#ck-name").value,birthday:$("#ck-bd").value,phone:$("#ck-ph").value,phone2:$("#ck-ph2").value,addr_street:$("#ck-st").value,addr_ward:$("#ck-wd").value,addr_district:$("#ck-ds").value,addr_province:$("#ck-pv").value,note:$("#ck-note").value};
      if($("#ck-own")&&$("#ck-own").value)b.owner_id=$("#ck-own").value;
      try{const r=isNew?await csApi("/customer",{method:"POST",body:JSON.stringify(b)}):await csApi("/customer/"+c.phone,{method:"PUT",body:JSON.stringify(b)});
        closeCM();toast("Đã lưu hồ sơ");CSK.gq="";CSK.gres=null;csAfterChange(r.phone);if(toDon)csDonForm(r.phone);else if(isNew)csOpen(r.phone)}catch(e){$("#ckerr").textContent=e.message}};
    $("#ckok").onclick=()=>save(false);if($("#ckdon"))$("#ckdon").onclick=()=>save(true)};
  if(!phone)return go(null);csApi("/customer/"+phone).then(r=>go(r.customer)).catch(csErr)}

/* ---------- Tạo đơn (chị Hoa 10/11: làm giống màn Tạo đơn của Poscake) ----------
   Trái: Sản phẩm (ô tìm, bảng dòng) · Giá trị đơn hàng · Thanh toán · Ghi chú (Nội bộ / Để in).
   Phải: Thông tin (tạo lúc, người tạo) · Khách hàng · Nhận hàng. Dưới cùng: Tiền cần thu, COD, nút Tạo đơn. */
function csLoadProds(){if(CSK.prods)return Promise.resolve(CSK.prods);return csApi("/products").then(r=>{CSK.prods=r;return r})}
const csFold=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/gi,"d").toLowerCase();
function csDonForm(phone){
  const st={c:null,items:[],ship:0,disc:0,ck:0,noteIn:"",notePr:"",ntab:"in",r:{},save:true,pq:""};
  const prods=()=>(CSK.prods&&CSK.prods.list)||[];
  const num=v=>+String(v||"").replace(/\D/g,"")||0;
  const sub=()=>st.items.reduce((a,i)=>a+i.q*i.price,0);
  const total=()=>Math.max(0,sub()+st.ship-st.disc);
  const keep=()=>{const g=id=>{const e=document.getElementById(id);return e?e.value:undefined};
    ["rn","rp","st","wd","ds","pv"].forEach(k=>{const v=g("cd-"+k);if(v!==undefined)st.r[k]=v});
    const n1=g("cd-noteIn"),n2=g("cd-notePr");if(n1!==undefined)st.noteIn=n1;if(n2!==undefined)st.notePr=n2;
    const sv=document.getElementById("cd-save");if(sv)st.save=sv.checked};
  const money=()=>{const t=total(),cod=Math.max(0,t-st.ck);[["#cd-sub",sub()],["#cd-tot",t],["#cd-need",cod],["#cd-cod",cod]].forEach(([s,v])=>{const e=$("#crmm").querySelector(s);if(e)e.textContent=nf(v)+" đ"})};
  const draw=()=>{const c=st.c,P=prods(),now=new Date(Date.now()+7*36e5).toISOString();
    const pm=st.pq.trim().length>=1?P.filter(p=>csFold(p.name).includes(csFold(st.pq))).slice(0,8):[];
    const box=(t,h,x)=>`<section class="cs-pbx"><div class="cs-pbh"><b>${t}</b>${x||""}</div>${h}</section>`;
    const left=box("Sản phẩm",`<div class="cs-psr"><input id="cd-pq" placeholder="Tìm sản phẩm theo tên…" value="${esc(st.pq)}" autocomplete="off">${pm.length?`<div class="cs-drop">${pm.map(p=>`<button data-addp="${esc(p.name)}"><b>${esc(p.name)}</b> <span class="hint">${p.price?nf(p.price)+" đ":""}${p.id?"":" · chưa có mã Poscake"}</span></button>`).join("")}</div>`:""}</div>
      ${st.items.length?`<table class="cs-pit"><thead><tr><th>Sản phẩm</th><th class="n">SL</th><th class="n">Đơn giá</th><th class="n">Thành tiền</th><th></th></tr></thead><tbody>${st.items.map((it,i)=>`<tr><td>${esc(it.n)}${it.vid?"":` <span class="pill p-amb">chưa có mã Poscake</span>`}</td><td class="n"><input data-isq="${i}" type="number" min="1" value="${it.q}" style="width:64px;text-align:right"></td><td class="n"><input data-ispr="${i}" inputmode="numeric" value="${nf(it.price)}" style="width:100px;text-align:right"></td><td class="n" data-ist="${i}">${nf(it.q*it.price)}</td><td><button class="lnk" data-isd="${i}" aria-label="Bỏ">✕</button></td></tr>`).join("")}</tbody></table>`:`<div class="cs-pem">Chưa có sản phẩm. Gõ tên vào ô tìm ở trên để thêm.</div>`}
      ${CSK.prods&&CSK.prods.error&&!P.some(p=>p.id)?`<div class="note red" style="margin-top:8px">Chưa lấy được danh mục Poscake (${esc(CSK.prods.error)}). Đơn vẫn lưu trên web nhưng phải lên tay ở Poscake.</div>`:""}`)+
      `<div class="cs-pg2">`+box("Giá trị đơn hàng",`<dl class="cs-kv cs-kvr"><dt>Tiền hàng</dt><dd id="cd-sub">${nf(sub())} đ</dd><dt>Giảm giá</dt><dd><input id="cd-disc" inputmode="numeric" value="${nf(st.disc)}"></dd><dt>Phí vận chuyển</dt><dd><input id="cd-ship" inputmode="numeric" value="${nf(st.ship)}"></dd><dt><b>Tổng số tiền</b></dt><dd><b id="cd-tot">${nf(total())} đ</b></dd></dl>`)+
      box("Thanh toán",`<dl class="cs-kv cs-kvr"><dt>Tiền chuyển khoản</dt><dd><input id="cd-ck" inputmode="numeric" value="${nf(st.ck)}"></dd></dl><p class="hint" style="margin:8px 0 0">Khách đã chuyển khoản bao nhiêu thì ghi vào, phần còn lại thu khi giao (COD).</p>`)+`</div>`+
      box("Ghi chú",`<div class="cs-tabs" style="margin:0 0 8px"><button type="button" data-nt="in" class="${st.ntab==="in"?"on":""}">Nội bộ</button><button type="button" data-nt="pr" class="${st.ntab==="pr"?"on":""}">Để in</button></div>
        <textarea id="cd-noteIn" rows="3" placeholder="Ghi chú nội bộ (kho, sale đọc)" ${st.ntab==="in"?"":"hidden"}>${esc(st.noteIn)}</textarea><textarea id="cd-notePr" rows="3" placeholder="Ghi chú in trên phiếu giao (ví dụ: gọi trước khi giao)" ${st.ntab==="pr"?"":"hidden"}>${esc(st.notePr)}</textarea>`);
    const right=box("Thông tin",`<dl class="cs-kv cs-kvr"><dt>Tạo lúc</dt><dd>${now.slice(11,16)} ${csFd(now.slice(0,10))}</dd><dt>Người tạo</dt><dd>${esc(CSK.me.me.name)}</dd><dt>Nguồn</dt><dd>CSKH</dd></dl>`)+
      box("Khách hàng",c?`<div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1;min-width:0"><b>${esc(c.name)}</b> ${csTier(c)}<div class="hint">${esc(csPh(c.phone))}${c.birthday?" · 🎂 "+esc(c.birthday):""} · ${nf(c.order_count)} đơn</div>${csTagsOf(c).length?`<div class="cs-chips" style="margin-top:4px">${csTagsOf(c).map(t=>pill(t,"vio")).join("")}</div>`:""}</div><button class="btn sm" id="cdchg">Đổi</button></div>`:
        `<input id="cdq" placeholder="Tìm khách: SĐT hoặc tên…" autocomplete="off"><div id="cdres" class="cs-chips" style="margin-top:6px"></div>`)+
      (c?box("Nhận hàng",`<div class="cs-f"><input id="cd-rn" placeholder="Tên người nhận" value="${esc(st.r.rn??c.name)}"><input id="cd-rp" inputmode="tel" placeholder="Số điện thoại" value="${esc(st.r.rp??c.phone)}"></div>
        <input id="cd-st" placeholder="Địa chỉ chi tiết (số nhà, đường)" value="${esc(st.r.st??c.addr_street)}" style="margin-top:8px;width:100%">
        <div class="cs-f3" style="margin-top:8px"><input id="cd-wd" placeholder="Phường / xã" value="${esc(st.r.wd??c.addr_ward)}"><input id="cd-ds" placeholder="Quận / huyện" value="${esc(st.r.ds??c.addr_district)}"><input id="cd-pv" placeholder="Tỉnh / thành" value="${esc(st.r.pv??c.addr_province)}"></div>
        <label class="ck" style="margin-top:6px"><input type="checkbox" id="cd-save" ${st.save?"checked":""}> Cập nhật địa chỉ vào hồ sơ khách</label>`):"");
    crmModal("Tạo đơn",`<div class="cs-po"><div class="cs-pocol">${left}</div><div class="cs-pocol">${right}</div></div>
     <div class="cs-pof"><div><div>Tiền cần thu: <b id="cd-need">${nf(Math.max(0,total()-st.ck))} đ</b></div><div class="hint">COD: <b id="cd-cod" style="color:#c0352b">${nf(Math.max(0,total()-st.ck))} đ</b></div></div><span id="cderr" class="err" style="flex:1;text-align:center"></span><button class="btn" id="cdx">Hủy</button><button class="btn pri" id="cdok" ${c?"":"disabled"}>Tạo đơn</button></div>`,true);
    const R=$("#crmm");R.querySelector(".cm-in").classList.add("cs-pomodal");
    $("#cdx").onclick=closeCM;
    // tìm sản phẩm
    const pq=$("#cd-pq");pq.oninput=()=>{keep();st.pq=pq.value;draw();const x=$("#cd-pq");x.focus();x.setSelectionRange(x.value.length,x.value.length)};
    R.querySelectorAll("[data-addp]").forEach(b=>b.onclick=()=>{keep();const p=prods().find(x=>x.name===b.dataset.addp);const ex=st.items.find(i=>i.n===p.name);if(ex)ex.q++;else st.items.push({n:p.name,vid:p.id,q:1,price:p.price});st.pq="";draw()});
    R.querySelectorAll("[data-isq]").forEach(e=>e.oninput=()=>{const it=st.items[+e.dataset.isq];it.q=Math.max(1,+e.value||1);R.querySelector(`[data-ist="${e.dataset.isq}"]`).textContent=nf(it.q*it.price);money()});
    R.querySelectorAll("[data-ispr]").forEach(e=>e.oninput=()=>{const it=st.items[+e.dataset.ispr];it.price=num(e.value);R.querySelector(`[data-ist="${e.dataset.ispr}"]`).textContent=nf(it.q*it.price);money()});
    R.querySelectorAll("[data-isd]").forEach(e=>e.onclick=()=>{keep();st.items.splice(+e.dataset.isd,1);draw()});
    [["#cd-disc","disc"],["#cd-ship","ship"],["#cd-ck","ck"]].forEach(([s,k])=>{const e=R.querySelector(s);e.oninput=()=>{st[k]=num(e.value);money()};e.onblur=()=>{e.value=nf(st[k])}});
    R.querySelectorAll("[data-nt]").forEach(b=>b.onclick=()=>{keep();st.ntab=b.dataset.nt;draw()});
    // khách
    if(!c){let t=0;const q=$("#cdq");q.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{const v=q.value.trim();if(v.length<2){$("#cdres").innerHTML="";return}
      csApi("/search?q="+encodeURIComponent(v)).then(L=>{$("#cdres").innerHTML=L.filter(r=>!r.lock).map(r=>`<button class="cs-chip" data-pick="${r.phone}">${esc(r.name)} · ${esc(csPh(r.phone))}</button>`).join("")+`<button class="cs-chip" data-new="1">＋ Khách mới</button>`;
        $("#cdres").querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{keep();pick(b.dataset.pick)});const nb=$("#cdres").querySelector("[data-new]");if(nb)nb.onclick=()=>{closeCM();csKhForm(null,v.replace(/\D/g,""))}}).catch(csErr)},300)}}
    else $("#cdchg").onclick=()=>{keep();st.c=null;st.r={};draw()};
    $("#cdok").onclick=async()=>{keep();const err=$("#cderr");if(!st.c){err.textContent="Chọn khách";return}if(!st.items.length){err.textContent="Thêm sản phẩm";return}
      const addr={street:st.r.st,ward:st.r.wd,district:st.r.ds,province:st.r.pv},full=[addr.street,addr.ward,addr.district,addr.province].filter(Boolean).join(", ");
      if(!full){err.textContent="Cần địa chỉ nhận hàng";return}
      $("#cdok").disabled=true;$("#cdok").textContent="Đang gửi…";
      try{const r=await csApi("/order",{method:"POST",body:JSON.stringify({phone:st.c.phone,items:st.items.map(i=>({n:i.n,vid:i.vid||"",q:i.q,price:i.price})),recv_name:st.r.rn,recv_phone:st.r.rp,recv_addr:full,addr,save_addr:st.save,ship:st.ship,discount:st.disc,paid:st.ck,payment:st.ck>0?"CK":"COD",note:st.noteIn,note_print:st.notePr})});
        closeCM();CSK.orders=null;csAfterChange(st.c.phone);
        if(r.pos_id)toast(`Đã tạo đơn ${r.id}, đã gửi sang Poscake (#${r.pos_id})`);
        else crmModal("Đã lưu đơn "+esc(r.id),`<div class="note red">Poscake chưa nhận đơn: ${esc(r.error)}</div><p>Đơn đã lưu trên web. Lên đơn tay ở Poscake rồi ghi mã đơn Poscake ở mục <b>Đơn hàng</b> để tính doanh thu đúng người.</p><div class="acts" style="justify-content:flex-end"><button class="btn pri" onclick="closeCM()">Đã hiểu</button></div>`)}
      catch(e){$("#cdok").disabled=false;$("#cdok").textContent="Tạo đơn";err.textContent=e.message}}};
  const pick=ph=>csGetCus(ph).then(c=>{st.c=c;st.r={};if(!st.items.length){const lp=prods().find(p=>p.name===c.last_product);if(lp)st.items=[{n:lp.name,vid:lp.id,q:1,price:lp.price}]}draw()}).catch(csErr);
  csLoadProds().catch(e=>{CSK.prods={list:[],error:e.message}}).then(()=>{if(phone)pick(phone);else draw()});
}
/* ---------- Đơn hàng CSKH tạo ---------- */
function pCsDon(m){
  const month=CSK.dmonth||csToday().slice(0,7);
  if(CSK.me&&(!CSK.orders||CSK.orders.month!==month)&&!CSK.orders_busy){CSK.orders_busy=1;csApi("/orders?month="+month).then(r=>{CSK.orders={rows:r,month};CSK.orders_busy=0;csRe()}).catch(e=>{CSK.orders={error:e.message,month};CSK.orders_busy=0;csRe()})}
  csFrame(m,"Đơn hàng CSKH tạo","Gửi sang Poscake để kho đóng hàng như đơn thường",()=>{const O=CSK.orders;
    const months=[0,1,2,3,4,5].map(i=>{const d=new Date(Date.parse(csToday().slice(0,7)+"-15T00:00:00Z"));d.setUTCMonth(d.getUTCMonth()-i);return d.toISOString().slice(0,7)});
    const head=`<div class="acts" style="justify-content:flex-end;margin-bottom:8px"><select id="csdm" style="width:auto">${opt(months.map(x=>[x,"Tháng "+x.slice(5)+"/"+x.slice(0,4)]),month)}</select></div>`;
    if(!O||O.month!==month)return head+`<section class="card"><p class="hint">Đang tải…</p></section>`;if(O.error)return head+`<section class="card"><p>${esc(O.error)}</p></section>`;
    const it=w=>{try{return JSON.parse(w.items)}catch(e){return []}};
    return head+`<section class="card flush">${O.rows.length?tbl(["Mã đơn","Khách","Sản phẩm","Tổng tiền","Poscake"].concat(csLead()?["CSKH"]:[]),O.rows.map(w=>`<tr><td><b>${esc(w.id)}</b><br><span class="hint">${csFd(w.day)}</span></td><td class="clk" data-csopen="${w.phone}"><b>${esc(w.cus_name||w.recv_name)}</b><div class="cs-ct"><b>📞 ${esc(csPh(w.recv_phone))}</b><span>📍 ${esc(w.recv_addr)}</span></div></td><td>${it(w).map(i=>esc(i.n)+" × "+i.q).join("<br>")}</td><td class="n">${nf(w.total)}</td>
      <td>${w.pos_id?pill("#"+w.pos_id,"grn")+(w.delivered_day?"<br>"+pill("Giao thành công "+csFd(w.delivered_day),"grn"):"<br><span class='hint'>chờ giao</span>"):`${pill("Chưa gửi được","red")}<div class="hint">${esc(w.pos_error)}</div><div class="acts" style="margin:4px 0 0"><button class="btn sm" data-csres="${esc(w.id)}">Gửi lại</button><button class="btn sm" data-cspos="${esc(w.id)}">Đã lên tay, ghi mã</button></div>`}</td>${csLead()?`<td>${esc(w.by_name)}</td>`:""}</tr>`)):`<p class="hint pad">Chưa có đơn nào trong tháng. Bấm ＋ Tạo đơn ở trên.</p>`}</section>`});
  const s=m.querySelector("#csdm");if(s)s.onchange=()=>{CSK.dmonth=s.value;renderMain()};
  m.querySelectorAll("[data-csres]").forEach(b=>b.onclick=()=>{b.disabled=true;csApi("/order/"+b.dataset.csres+"/resend",{method:"POST"}).then(r=>{toast(r.pos_id?"Đã gửi sang Poscake #"+r.pos_id:"Vẫn chưa gửi được: "+r.error);CSK.orders=null;renderMain()}).catch(e=>{b.disabled=false;csErr(e)})});
  m.querySelectorAll("[data-cspos]").forEach(b=>b.onclick=()=>{crmModal("Ghi mã đơn Poscake · "+esc(b.dataset.cspos),`<label class="cs-fl"><span>Mã đơn trên Poscake</span><input id="cspid" inputmode="numeric"></label><div id="cspe" class="err"></div><div class="acts" style="justify-content:flex-end;margin-top:10px"><button class="btn" onclick="closeCM()">Hủy</button><button class="btn pri" id="cspok">Lưu</button></div>`);
    $("#cspok").onclick=()=>csApi("/order/"+b.dataset.cspos+"/pos",{method:"PUT",body:JSON.stringify({pos_id:$("#cspid").value})}).then(()=>{closeCM();toast("Đã ghi mã");CSK.orders=null;renderMain()}).catch(e=>{$("#cspe").textContent=e.message})});
}

/* ---------- Chia khách ---------- */
function pCsChia(m){
  const kind=CSK.chiaKind;
  if(CSK.me&&csLead()&&(!CSK.chia||CSK.chia.kind!==kind)&&!CSK.chia_busy){CSK.chia_busy=1;csApi("/chia?kind="+kind).then(r=>{CSK.chia={...r,kind};CSK.chia_busy=0;csRe()}).catch(e=>{CSK.chia={error:e.message,kind};CSK.chia_busy=0;csRe()})}
  csFrame(m,"Chia khách","Khách chưa có CSKH phụ trách",()=>{if(!csLead())return `<section class="card"><p>Chỉ Lead Sale, CEO chia khách.</p></section>`;const C=CSK.chia,S=CSK.me.settings,staff=CSK.me.staff||[];
    if(!C||C.kind!==kind)return `<section class="card"><p class="hint">Đang tải…</p></section>`;if(C.error)return `<section class="card"><p>${esc(C.error)}</p></section>`;
    return `<p class="hint">${S.chia==="auto"?"Đang bật <b>Web tự chia</b> (đổi ở Cài đặt): mỗi sáng web tự giao khách mới; danh sách dưới là khách còn sót hoặc khách cũ kéo về từ trước.":"Đang để <b>Lead Sale chia tay</b> (đổi ở Cài đặt)."} Khách từng có người chăm được trả về người cũ.</p>
    <div class="cs-tabs"><button data-csck="moi" class="${kind==="moi"?"on":""}">Khách mới (đơn đầu trong 14 ngày)${C.moi?`<em>${nf(C.moi)}</em>`:""}</button><button data-csck="cu" class="${kind==="cu"?"on":""}">Khách cũ chưa chia${C.cu?` · ${nf(C.cu)}`:""}</button></div>
    ${staff.length?"":`<div class="note red">Chưa có nhân sự CSKH nào: xếp nhân sự vào phòng CSKH / Sale Kênh bán lẻ hoặc cấp quyền "Chăm sóc khách lẻ" ở Tài khoản & phân quyền.</div>`}
    <div class="acts"><button class="btn" id="csauto" ${C.rows.length&&staff.length?"":"disabled"}>Chia đều ${nf(kind==="moi"?C.moi:C.cu)} khách cho CSKH đang nhận khách</button><span class="hint">hoặc chọn từng khách bên dưới rồi bấm Lưu phân chia</span></div>
    <div class="acts"><select id="csrel" style="width:auto">${opt([["","Mọi CSKH"]].concat(staff.map(s=>[s.id,s.name])),"")}</select><button class="btn" id="csrelb">Thu hồi khách chưa gọi</button><span class="hint">đưa khách đã chia mà chưa có lần gọi nào về lại chưa chia (chia nhầm, người nghỉ)</span></div>
    <section class="card flush">${C.rows.length?tbl(["Khách","Mua gần nhất","Cũ / mới","Giao cho"],C.rows.map(c=>`<tr><td><b>${esc(c.name||"(chưa có tên)")}</b>${csContact(c)}</td><td>${esc(c.last_product||"")}<br><span class="hint">${csFd(c.last_order_day)} · ${nf(c.order_count)} đơn · ${esc(c.source)}</span></td><td>${c.owner_prev?pill("Khách cũ","vio"):pill(kind==="moi"?"Khách mới":"Chưa ai chăm","blu")}</td><td style="min-width:140px"><select data-csas="${c.phone}">${opt([["","Chọn CSKH"]].concat(staff.map(s=>[s.id,s.name])),c.owner_prev&&staff.some(s=>s.id===c.owner_prev)?c.owner_prev:"")}</select></td></tr>`)):`<p class="hint pad">Không còn khách nào chưa chia.</p>`}</section>
    ${C.rows.length?`<div class="acts" style="justify-content:flex-end"><button class="btn pri" id="cssave">Lưu phân chia</button></div>`:""}`});
  m.querySelectorAll("[data-csck]").forEach(b=>b.onclick=()=>{CSK.chiaKind=b.dataset.csck;renderMain()});
  const rb=m.querySelector("#csrelb");if(rb)rb.onclick=()=>{const o=m.querySelector("#csrel").value,nm=o?(m.querySelector("#csrel").selectedOptions[0].textContent):"mọi CSKH";crmModal("Thu hồi khách chưa gọi",`<p>Đưa toàn bộ khách đã chia cho <b>${esc(nm)}</b> mà chưa có lần gọi nào về lại <b>Chưa chia</b>. Khách đã gọi, đã tạo đơn, khách thêm tay giữ nguyên.</p><div class="acts" style="justify-content:flex-end"><button class="btn" onclick="closeCM()">Hủy</button><button class="btn pri" id="csrelok">Thu hồi</button></div>`);$("#csrelok").onclick=()=>{$("#csrelok").disabled=true;csApi("/chia/thu-hoi",{method:"POST",body:JSON.stringify({owner_id:o})}).then(r=>{closeCM();toast(`Đã thu hồi ${nf(r.released)} khách`);CSK.chia=null;CSK.ov=null;CSK.today=null;CSK.list=null;renderMain()}).catch(e=>{closeCM();csErr(e)})}};
  const a=m.querySelector("#csauto");if(a)a.onclick=()=>{a.disabled=true;csApi("/chia",{method:"POST",body:JSON.stringify({auto:true,kind})}).then(r=>{toast(`Đã chia ${nf(r.assigned)} khách`);CSK.chia=null;CSK.ov=null;CSK.today=null;renderMain()}).catch(e=>{a.disabled=false;csErr(e)})};
  const s=m.querySelector("#cssave");if(s)s.onclick=()=>{const as={};m.querySelectorAll("[data-csas]").forEach(x=>{if(x.value)as[x.dataset.csas]=x.value});if(!Object.keys(as).length){toast("Chọn CSKH cho khách");return}
    s.disabled=true;csApi("/chia",{method:"POST",body:JSON.stringify({assign:as})}).then(r=>{toast(`Đã giao ${nf(r.assigned)} khách`);CSK.chia=null;CSK.ov=null;CSK.today=null;renderMain()}).catch(e=>{s.disabled=false;csErr(e)})};
}

/* ---------- Báo cáo ---------- */
function pCsBc(m){
  const month=CSK.rmonth||csToday().slice(0,7);
  if(CSK.me&&csLead()&&(!CSK.rep||CSK.rep.month!==month)&&!CSK.rep_busy){CSK.rep_busy=1;csApi("/report?month="+month).then(r=>{CSK.rep=r;CSK.rep_busy=0;csRe()}).catch(e=>{CSK.rep={error:e.message,month};CSK.rep_busy=0;csRe()})}
  csFrame(m,"Báo cáo CSKH","Theo nhân viên, theo tháng",()=>{if(!csLead())return `<section class="card"><p>Chỉ Lead Sale, CEO xem báo cáo.</p></section>`;const R=CSK.rep;
    const months=[0,1,2,3,4,5].map(i=>{const d=new Date(Date.parse(csToday().slice(0,7)+"-15T00:00:00Z"));d.setUTCMonth(d.getUTCMonth()-i);return d.toISOString().slice(0,7)});
    const head=`<div class="acts" style="justify-content:flex-end;margin-bottom:8px"><select id="csrm" style="width:auto">${opt(months.map(x=>[x,"Tháng "+x.slice(5)+"/"+x.slice(0,4)]),month)}</select></div>`;
    if(!R||R.month!==month)return head+`<section class="card"><p class="hint">Đang tải…</p></section>`;if(R.error)return head+`<section class="card"><p>${esc(R.error)}</p></section>`;
    return head+`<section class="card flush">${tbl(["CSKH","Khách phụ trách","Đã gọi","Bắt máy","Đơn bán thêm","Doanh thu bán thêm","Trung bình 1 đơn","Quá hạn"],R.rows.map(r=>`<tr><td><b>${esc(r.name||"(chưa rõ tên)")}</b></td><td class="n">${nf(r.khach)}</td><td class="n">${nf(r.goi)}</td><td class="n">${nf(r.bat)}</td><td class="n">${nf(r.don)}</td><td class="n">${nf(r.dt)}</td><td class="n">${nf(r.tb)}</td><td class="n"${r.qua>4?' style="color:#c0352b;font-weight:700"':""}>${nf(r.qua)}</td></tr>`))}</section>
    <p class="hint">Doanh thu bán thêm = đơn của khách giao thành công, tạo trong 7 ngày sau cuộc gọi "Đã chốt đơn" của CSKH đó, hoặc đơn CSKH tạo trên web. Không nhập tay. Đã gọi, bắt máy tính theo số khách.</p>
    <div class="cs-g2"><section class="card"><h2>Kết quả cuộc gọi</h2>${R.results.length?tbl(["Kết quả","Số lần"],R.results.map(x=>`<tr><td>${esc(x.result)}</td><td class="n">${nf(x.n)}</td></tr>`)):`<p class="hint">Chưa có.</p>`}</section>
     <section class="card"><h2>Khách từ chối vì</h2>${R.reasons.length?tbl(["Lý do","Số lần"],R.reasons.map(x=>`<tr><td>${esc(x.reason||"Không ghi")}</td><td class="n">${nf(x.n)}</td></tr>`)):`<p class="hint">Chưa có.</p>`}</section></div>
    <section class="card"><h2>Câu hỏi khó của khách</h2>${R.questions.length?`<ul>${R.questions.map(q=>`<li>${esc(q.question)} <span class="hint">· ${esc(q.by_name)} ${csFd(q.day)}</span></li>`).join("")}</ul>`:`<p class="hint">Chưa có.</p>`}</section>`});
  const s=m.querySelector("#csrm");if(s)s.onchange=()=>{CSK.rmonth=s.value;renderMain()};
}

/* ---------- Cài đặt ---------- */
function pCsCd(m){
  csFrame(m,"Cài đặt CSKH","Chia khách, kéo khách từ Poscake, hạng khách, chu kỳ sản phẩm",()=>{if(!csLead())return `<section class="card"><p>Chỉ Lead Sale, CEO sửa cài đặt.</p></section>`;
    const S=CSK.me.settings,staff=CSK.me.staff||[],bf=CSK.me.backfill;const cyc=Object.entries(S.cycles).sort((a,b)=>a[0].localeCompare(b[0],"vi"));
    const radio=(v,t,sub)=>`<label class="cs-chip${S.chia===v?" on":""}" style="display:flex;gap:8px;align-items:flex-start;border-radius:12px;padding:9px 12px"><input type="radio" name="cschia" value="${v}" ${S.chia===v?"checked":""} style="width:auto;margin-top:3px"><span><b>${t}</b><br><span class="hint" style="font-weight:500">${sub}</span></span></label>`;
    return `<section class="card"><h2>Chia khách mới</h2><div class="cs-f">${radio("auto","Web tự chia","Mỗi sáng sau khi kéo đơn, chia xoay vòng đều cho CSKH đang nhận khách")}${radio("tay","Lead Sale chia tay","Khách mới nằm chờ ở mục Chia khách")}</div>
     <div class="cs-f" style="margin-top:10px"><label class="cs-fl"><span>Khách từng có người chăm</span><select id="cs-kc">${opt([["cu","Trả về đúng CSKH cũ"],["moi","Chia như khách mới"]],S.khachCu)}</select></label></div>
     <div class="cs-fl" style="margin-top:10px"><span>CSKH đang nhận khách (bỏ chọn khi nghỉ phép)</span><div class="cs-chips">${staff.length?staff.map(s=>`<label class="cs-chip${S.staffOff.includes(s.id)?"":" on"}"><input type="checkbox" data-cson="${s.id}" ${S.staffOff.includes(s.id)?"":"checked"} style="width:auto"> ${esc(s.name)}${s.lead?" (Lead)":""}</label>`).join(""):`<span class="hint">Chưa có ai. Xếp nhân sự vào phòng CSKH / Sale Kênh bán lẻ, hoặc cấp quyền "Chăm sóc khách lẻ" ở Tài khoản & phân quyền.</span>`}</div></div></section>
    <section class="card"><h2>Kéo khách từ Poscake</h2>
     <p class="hint" style="margin-top:0">Mỗi sáng 7h web tự kéo lại đơn Facebook giao thành công của 7 ngày gần nhất (khoảng 150–300 đơn mỗi ngày; kéo trùng không bị đếm hai lần, lỡ một sáng lỗi mạng vẫn không sót). Dữ liệu cũ hơn chỉ kéo khi bấm ở dưới.</p>
     <div class="acts"><button class="btn" id="cspull">Kéo đơn mới ngay</button></div>
     <div class="cs-sec" style="margin-top:10px">Kéo dữ liệu cũ</div>
     <div class="cs-f3"><label class="cs-fl"><span>Từ ngày</span><input type="date" id="cs-bf-from" value="${esc(bf&&bf.from||"")}" max="${csToday()}"></label><label class="cs-fl"><span>Đến ngày</span><input type="date" id="cs-bf-to" value="${esc(bf&&bf.to||csToday())}" max="${csToday()}"></label><div class="cs-fl"><span>&nbsp;</span>${bf&&bf.active?`<button class="btn" id="csbfstop">Dừng kéo</button>`:`<button class="btn pri" id="csbfgo">Bắt đầu kéo</button>`}</div></div>
     <div style="margin-top:8px">${bf&&bf.active?`<div class="note">Đang kéo từ ${csFd(bf.from||bf.target)} đến ${csFd(bf.to||"")}: đã xong tới ngày <b>${csFd(bf.cursor)}</b>, còn khoảng ${nf(Math.max(0,csDiff(bf.cursor,bf.target)))} ngày. Máy chủ tự kéo tiếp 4 ngày mỗi 15 phút (khoảng 16 ngày mỗi giờ), không cần để máy mở.</div>`:bf&&bf.from?`<p class="hint">Lần kéo gần nhất: ${csFd(bf.from)} – ${csFd(bf.to||"")}${bf.cursor<=bf.target?", đã xong":", đã dừng ở ngày "+csFd(bf.cursor)}.</p>`:""}${bf&&bf.last?`<div class="hint">${esc(bf.last)}</div>`:""}</div></section>
    <section class="card"><h2>Hạng khách</h2><p class="hint" style="margin-top:0">Xếp từ hạng cao xuống. Khách đạt <b>số đơn</b> hoặc <b>tổng mua</b> của hạng nào thì vào hạng đó; không đạt hạng nào là "Thường". Trong hồ sơ vẫn gán hạng tay được.</p>
     <div id="cstiers">${S.tiers.map((t,i)=>`<div class="cs-it"><input data-tn="${i}" value="${esc(t.n)}" placeholder="Tên hạng" style="flex:1;width:auto;text-align:left"><span class="hint">từ</span><input data-to="${i}" type="number" min="0" value="${t.o}"><span class="hint">đơn hoặc</span><input data-ts="${i}" inputmode="numeric" value="${t.s?nf(t.s):""}" style="width:120px"><span class="hint">đ</span></div>`).join("")}</div>
     <div class="acts"><button class="btn sm" id="cstieradd">＋ Thêm hạng</button></div></section>
    <section class="card"><h2>Chỉ tiêu và lịch gọi</h2><div class="cs-f3"><label class="cs-fl"><span>Gọi khách mới sau khi giao (ngày)</span><input type="number" id="cs-first" min="0" value="${S.firstCallDays}"></label><label class="cs-fl"><span>Chỉ tiêu bán thêm / tháng cả nhóm (đồng)</span><input id="cs-kpi" inputmode="numeric" value="${S.kpi?nf(S.kpi):""}"></label></div></section>
    <section class="card"><h2>Chu kỳ dùng hết sản phẩm</h2><p class="hint">Số ngày khách thường dùng hết một sản phẩm, để web đưa khách vào mục "Đến kỳ mua lại" và gợi ý ngày gọi. Sản phẩm chưa ghi thì tính <input type="number" id="cs-defc" value="${S.defaultCycle}" style="width:70px"> ngày.</p>
     <div id="cscyc">${cyc.map(([p,n],i)=>`<div class="cs-it"><input data-cycn="${i}" value="${esc(p)}" style="flex:1;width:auto;text-align:left"><input data-cycd="${i}" type="number" min="1" value="${n}"><span class="hint">ngày</span></div>`).join("")}</div>
     <div class="acts"><select id="cs-addp"><option value="">＋ Thêm sản phẩm…</option></select></div></section>
    <div class="acts" style="justify-content:flex-end"><button class="btn pri" id="cssv">Lưu cài đặt</button></div>`});
  if(!csLead()||!CSK.me)return;
  m.querySelectorAll("input[name=cschia]").forEach(r=>r.onchange=()=>{m.querySelectorAll("input[name=cschia]").forEach(x=>x.closest("label").classList.toggle("on",x.checked))});
  m.querySelectorAll("[data-cson]").forEach(c=>c.onchange=()=>c.closest("label").classList.toggle("on",c.checked));
  const ap=m.querySelector("#cs-addp");if(ap){csLoadProds().then(r=>{const have=new Set(Object.keys(CSK.me.settings.cycles));const names=[...new Set((r.list||[]).map(p=>p.name.split(" - ")[0]))].filter(n=>!have.has(n));ap.innerHTML=`<option value="">＋ Thêm sản phẩm…</option>`+opt(names,"")}).catch(()=>{});
    ap.onchange=()=>{if(!ap.value)return;const box=m.querySelector("#cscyc"),i=box.children.length;box.insertAdjacentHTML("beforeend",`<div class="cs-it"><input data-cycn="${i}" value="${esc(ap.value)}" style="flex:1;width:auto;text-align:left"><input data-cycd="${i}" type="number" min="1" value="30"><span class="hint">ngày</span></div>`);ap.value=""}}
  const csAfterPull=()=>{CSK.me=null;CSK.today=null;CSK.ov=null;CSK.chia=null;CSK.list=null;csLoadMe().then(csRe)};
  m.querySelector("#cspull").onclick=e=>{const b=e.target;b.disabled=true;b.textContent="Đang kéo…";csApi("/pull",{method:"POST"}).then(r=>{toast("Đã kéo: "+r.recent.map(x=>x.note).join(" · "));csAfterPull()}).catch(er=>{b.disabled=false;b.textContent="Kéo đơn mới ngay";csErr(er)})};
  const go=m.querySelector("#csbfgo");if(go)go.onclick=()=>{const f=m.querySelector("#cs-bf-from").value,t=m.querySelector("#cs-bf-to").value;if(!f){toast("Chọn từ ngày");return}
    go.disabled=true;go.textContent="Đang bắt đầu…";csApi("/pull-range",{method:"POST",body:JSON.stringify({from:f,to:t})}).then(r=>{toast("Đã bắt đầu kéo. "+(r.first&&r.first.note||""));csAfterPull()}).catch(er=>{go.disabled=false;go.textContent="Bắt đầu kéo";csErr(er)})};
  const sp=m.querySelector("#csbfstop");if(sp)sp.onclick=()=>{sp.disabled=true;csApi("/pull-stop",{method:"POST"}).then(()=>{toast("Đã dừng kéo");csAfterPull()}).catch(er=>{sp.disabled=false;csErr(er)})};
  m.querySelector("#cstieradd").onclick=()=>{const box=m.querySelector("#cstiers"),i=box.children.length;box.insertAdjacentHTML("beforeend",`<div class="cs-it"><input data-tn="${i}" placeholder="Tên hạng" style="flex:1;width:auto;text-align:left"><span class="hint">từ</span><input data-to="${i}" type="number" min="0" value="0"><span class="hint">đơn hoặc</span><input data-ts="${i}" inputmode="numeric" style="width:120px"><span class="hint">đ</span></div>`)};
  m.querySelector("#cssv").onclick=e=>{const cyc={};m.querySelectorAll("[data-cycn]").forEach(x=>{const d=m.querySelector(`[data-cycd="${x.dataset.cycn}"]`);if(x.value.trim()&&d&&+d.value>0)cyc[x.value.trim()]=+d.value});
    const on=new Set([...m.querySelectorAll("[data-cson]")].filter(x=>x.checked).map(x=>x.dataset.cson));
    const b={chia:(m.querySelector("input[name=cschia]:checked")||{}).value||"tay",khachCu:m.querySelector("#cs-kc").value,staffOff:(CSK.me.staff||[]).map(s=>s.id).filter(id=>!on.has(id)),tiers:[...m.querySelectorAll("[data-tn]")].map(x=>{const i=x.dataset.tn;return {n:x.value.trim(),o:+(m.querySelector(`[data-to="${i}"]`).value||0),s:+(m.querySelector(`[data-ts="${i}"]`).value.replace(/\D/g,"")||0)}}).filter(t=>t.n),firstCallDays:+m.querySelector("#cs-first").value,kpi:+m.querySelector("#cs-kpi").value.replace(/\D/g,"")||0,defaultCycle:+m.querySelector("#cs-defc").value,cycles:cyc};
    e.target.disabled=true;csApi("/settings",{method:"PUT",body:JSON.stringify(b)}).then(s=>{CSK.me.settings=s;toast("Đã lưu cài đặt");CSK.ov=null;CSK.today=null;renderMain()}).catch(er=>{e.target.disabled=false;csErr(er)})};
}

/* ---------- Gắn vào web: trang, menu, quyền ---------- */
Object.assign(PAGES,{cs_tq:pCsTq,cs_today:pCsToday,cs_kh:pCsKh,cs_don:pCsDon,cs_chia:pCsChia,cs_bc:pCsBc,cs_cd:pCsCd});
/* Trang "Chăm sóc khách hàng" cũ ở Kênh bán lẻ (chỉ ghi "Sắp triển khai") nay mở Tổng quan CSKH. */
PAGES.fb_cskh=pCsTq;
/* Quyền ở Tài khoản & phân quyền. */
if(typeof PERMS!=="undefined"&&!PERMS.some(g=>g[0]==="CSKH khách lẻ"))PERMS.push(["CSKH khách lẻ",[["cskh.lam","Chăm sóc khách lẻ được chia (CSKH)"],["cskh.quanly","Chia khách, xem mọi khách, báo cáo, cài đặt CSKH (Lead Sale)"]]]);
const csSee=u=>!!u&&(u.role==="admin"||["CSKH","B2C","BDH"].includes(u.phongBan)||can(u,"cskh.lam")||can(u,"cskh.quanly"));
const csLeadSee=u=>!!u&&(u.role==="admin"||can(u,"cskh.quanly")||(["CSKH","B2C"].includes(u.phongBan)&&["lead","truongphong"].includes(u.role)));
{const i=MODULES.findIndex(x=>x.k==="b2c");
 MODULES.splice(i>=0?i+1:MODULES.length,0,{k:"cskh",zone:"Bán hàng",ic:"users",n:"CSKH khách lẻ",sub:"Khách Facebook · gọi chăm sóc",groups:()=>{
   if(!csSee(ME))return [];if(!CSK.me&&!CSK.meBusy&&!CSK.err)csLoadMe().then(()=>{if(typeof render==="function"&&!(typeof svTyping==="function"&&svTyping()))render()}).catch(()=>{});
   const n=()=>{const T=CSK.today&&CSK.today.rows;return T?T.filter(r=>["qua","nay","moi"].includes(r.state)).length||"":""};
   return [["",[MI("cs_tq","Tổng quan"),MI("cs_today","Việc hôm nay",null,n),MI("cs_kh","Khách hàng"),MI("cs_don","Đơn hàng"),MI("cs_chia","Chia khách",csLeadSee),MI("cs_bc","Báo cáo",csLeadSee),MI("cs_cd","Cài đặt",csLeadSee)]]]}})}
