/* =====================================================================
   TIỀN & LỊCH CHI (trang quản trị › Chi phí & Tiền).
   1) Số dư tài khoản: kế toán nhập mỗi thứ Hai (ngân hàng + tiền mặt), lưu từng lần để xem lại. Chị Hoa, Thảo, Huệ nhập thẳng.
   2) Số ngày dự trữ tiền mặt = tổng tiền hiện có ÷ mức chi trung bình mỗi ngày trong kỳ đang xem (cả quảng cáo).
   3) Lịch chi 4 tuần tới: tiền còn phải trả nhà cung cấp, xếp theo hạn trả (công nợ N ngày; chuyển khoản sau nhận hàng = trả ngay; chuyển khoản trước theo ngày hẹn giao).
   ===================================================================== */
const TL={busy:false,tried:false};
const tlAccts=()=>{const a=(MH.accts||[]).map(x=>({k:x.id,n:mhAcctLabel(x)||x.bank||"Tài khoản"}));a.push({k:"TIEN_MAT",n:"Tiền mặt tại công ty"});return a};
function tlLatest(){const o={};(D().balances||[]).forEach(b=>{const c=o[b.acct];if(!c||b.ngay>c.ngay||(b.ngay===c.ngay&&String(b.id)>String(c.id)))o[b.acct]=b});return o}
const tlDays=(a,b)=>Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/864e5);
function tlSchedule(){
  const today=mhToday(),W=[0,1,2,3].map(()=>({sum:0,rows:[]})),late={sum:0,rows:[]},unk={sum:0,rows:[]};
  (MH.orders||[]).forEach(p=>{if(p.status==="HUY")return;
    let M,st;try{M=mhPoMoney(p);st=mhStage(p,M)}catch(e){return}
    const k=st[0],T=mhTermOf(p).pay_terms,val=M.invTotal||mhValue(p)||0,left=Math.round(val-M.paid);if(left<=1)return;
    const row={left,txt:(p.supplier_name||"")+" · "+(p.no||"")};
    let due="";
    if(k==="no")due=T==="CONG_NO"?mhDueOf(p):today;
    else if(k==="tr")due=p.expected_date||"";
    else if(k==="ct"||k==="gia")due=T==="CONG_NO"?mhDueOf(p):"";
    else return;
    if(!due){unk.sum+=left;unk.rows.push(row);return}
    row.due=due;const d=tlDays(today,due);
    if(d<0){late.sum+=left;late.rows.push(row)}else if(d<28){const w=Math.floor(d/7);W[w].sum+=left;W[w].rows.push(row)}
  });
  return {W,late,unk,today}}
function tlLoad(){if(TL.busy||TL.tried)return;TL.busy=TL.tried=true;
  Promise.all([mhAccts(),mhLoad(),mhLoadInv(),mhLoadPay(),typeof spLoadShip==="function"?spLoadShip():0]).catch(()=>{}).finally(()=>{TL.busy=false;if(PAGE==="tien_lich")renderMain()})}
function pTienLich(m){
  tlLoad();
  const T="Tiền & lịch chi",S="Tiền đang có ở đâu, đủ dùng bao nhiêu ngày, 4 tuần tới phải trả những gì";
  if(!MH.accts||!MH.orders||!MH.inv||!MH.pay){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  const ed=mhManage()||can(ME,"chiphi.nhap"),ac=tlAccts(),L=tlLatest(),today=mhToday();
  const tot=ac.reduce((t,a)=>t+(L[a.k]?+L[a.k].tien||0:0),0),have=ac.some(a=>L[a.k]);
  const lastD=ac.map(a=>L[a.k]&&L[a.k].ngay).filter(Boolean).sort().pop()||"";
  const stale=lastD?tlDays(lastD,today):null;
  let avg=0,days=null;
  try{const rows=spRows(),to=PERIOD.to<today?PERIOD.to:today,n=Math.max(1,tlDays(PERIOD.from,to)+1);avg=rows.reduce((t,x)=>t+x.tien,0)/n;if(have&&avg>0)days=Math.floor(tot/avg)}catch(e){}
  const S4=tlSchedule(),sum4=S4.W.reduce((t,w)=>t+w.sum,0)+S4.late.sum;
  const wl=["Tuần này","Tuần sau","Tuần thứ 3","Tuần thứ 4"],ds=i=>{const a=new Date(today+"T00:00:00");a.setDate(a.getDate()+i*7);const b=new Date(a);b.setDate(b.getDate()+6);const f=d=>String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0");return f(a)+" – "+f(b)};
  const sec=(title,w,hint)=>`<div class="tlw"><div class="tlwh"><b>${title}</b><small>${hint||""}</small><span class="tlsum${w.sum?"":" z"}">${w.sum?nf(w.sum)+" đ":"—"}</span></div>${w.rows.map(r=>`<div class="tlr"><span>${esc(r.txt)}${r.due?` <small>hạn ${esc(mhDM(r.due))}</small>`:""}</span><b>${nf(r.left)}</b></div>`).join("")}</div>`;
  m.innerHTML=H(T,S)+`<div class="grid kpis">${kpi("Tiền đang có",have?nf(Math.round(tot)):"—",have?"cập nhật "+kDd(lastD)+(stale>7?" · đã "+stale+" ngày chưa cập nhật":""):"chưa nhập số dư")}${kpi("Đủ dùng khoảng",days!=null?days+" ngày":"—",avg>0?"chi trung bình "+nf(Math.round(avg))+" đ/ngày (kỳ đang xem)":"chưa có số chi trong kỳ")}${kpi("Phải trả nhà cung cấp 4 tuần tới",nf(Math.round(sum4)),S4.late.sum?"trong đó quá hạn "+nf(Math.round(S4.late.sum)):"không có khoản quá hạn")}${kpi("Sau khi trả hết",have?nf(Math.round(tot-sum4)):"—","tiền có trừ khoản phải trả bên dưới")}</div>
  <div class="card pad"><div class="tlh"><b>Số dư tài khoản</b>${ed?`<button class="btn pri sm" id="tl-up">Cập nhật số dư</button>`:""}</div>
  <table class="tbl"><thead><tr><th>Tài khoản</th><th class="n">Số dư</th><th>Cập nhật</th></tr></thead><tbody>${ac.map(a=>{const b=L[a.k];return `<tr><td>${esc(a.n)}</td><td class="n">${b?nf(b.tien):"—"}</td><td>${b?esc(kDd(b.ngay))+(b.by?` <small class="hint">· ${esc(b.by)}</small>`:""):"chưa nhập"}</td></tr>`}).join("")}</tbody></table>
  <p class="hint">Nên cập nhật mỗi sáng thứ Hai. Mỗi lần cập nhật được lưu lại, số mới nhất của từng tài khoản được dùng để tính.</p></div>
  <div class="card pad"><div class="tlh"><b>Lịch trả nhà cung cấp 4 tuần tới</b></div>
  ${S4.late.rows.length?sec("Quá hạn",S4.late,"trả ngay"):""}${S4.W.map((w,i)=>sec(wl[i],w,ds(i))).join("")}${S4.unk.rows.length?sec("Chưa rõ ngày trả",S4.unk,"chưa có hạn công nợ hoặc ngày hẹn giao"):""}
  <p class="hint">Chưa gồm lương, thuê mặt bằng, quảng cáo. Những khoản đó có trong Sổ chi phí sau khi ghi.</p></div>`;
  const up=m.querySelector("#tl-up");if(up)up.onclick=()=>tlForm(ac,L)}
function tlForm(ac,L){
  openDrawerHTML(`<h2>Cập nhật số dư</h2><p class="hint">Nhập số tiền đang có ở từng tài khoản. Để trống tài khoản nào thì giữ số cũ.</p><form class="frm" id="tlf"><label class="field">Số dư tính tới ngày<input id="tlf-d" type="date" value="${mhToday()}" required></label>
   ${ac.map(a=>`<label class="field">${esc(a.n)}<input type="number" min="0" step="1" data-tla="${esc(a.k)}" placeholder="${L[a.k]?nf(L[a.k].tien):"chưa có"}"></label>`).join("")}
   <div id="tlf-e"></div><button class="btn pri">Lưu số dư</button></form>`);
  $("#tlf").onsubmit=e=>{e.preventDefault();const ngay=$("#tlf-d").value,vals=[...document.querySelectorAll("[data-tla]")].filter(i=>i.value!=="").map(i=>({acct:i.dataset.tla,tien:Math.round(+i.value)}));
    if(!vals.length){$("#tlf-e").innerHTML=`<div class="note red">Nhập ít nhất một tài khoản</div>`;return}
    DB.mutate(ME.name,"cập nhật số dư",dt=>{dt.balances=dt.balances||[];vals.forEach(v=>dt.balances.push({id:uid("sd"),ngay,acct:v.acct,tien:v.tien,by:ME.name}))});
    closeDrawer();toast("Đã lưu số dư");renderMain()}}
PAGES.tien_lich=pTienLich;
