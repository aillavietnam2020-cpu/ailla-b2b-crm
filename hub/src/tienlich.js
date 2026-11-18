/* =====================================================================
   DÒNG TIỀN QUẢN TRỊ (quản trị › Tài chính – Kế toán › Dòng tiền; khóa trang tien_lich giữ nguyên để link cũ không gãy).
   CEO duyệt demo 18/11/2026 ("Dòng tiền quản trị AILLA"). Lựa chọn của CEO: chỉ dùng phiếu trên web, mốc đầu kỳ 30/09/2026,
   chốt sổ theo tháng, xem theo ngày, dự báo 4 tuần. Năm phần:
   1) Tổng quan: tiền đang có từng tài khoản (web tính so với sao kê), số dư 30 ngày, thu chi theo nguồn, việc cần xử lý.
   2) Sổ tiền theo ngày: TK 111 / từng TK 112, đầu ngày + thu − chi = cuối ngày; bấm ngày xem phiếu, gán tài khoản / mã B03.
   3) Lưu chuyển tiền tệ mẫu B03-DNN (mã 01 → 70, kỳ này / kỳ trước, tháng đã chốt lấy bản chốt), tải Excel.
   4) Dự báo 4 tuần + kế hoạch chi chờ CEO duyệt + nợ đến hạn.
   5) Đối chiếu & chốt sổ: số dư đầu kỳ (mốc 30/09), sao kê cuối tháng, phiếu cần gán, chốt / mở khóa.
   Luật tính ở tiencalc.js (tcnB03Of, tcnGan, tcnB03, tcnSoNgay, tcnSoDuNgay, tcnChotLyDo, tcnDuBao…), chứng từ ở tiencn.js (tcnDongTien).
   Lưu trong ngăn tài chính D().fin (chỉ CEO, kế toán): balances (số dư nhập: mốc 30/09 + sao kê), cashTag (gán tài khoản / mã B03),
   cashClose (bản chốt tháng), cashCloseLog (mở khóa), tcp (phiếu thu / chi khác), chiPlan (kế hoạch chi), ck (chuyển nội bộ).
   Không sửa phiếu gốc ở trang khác. Dòng nào chưa có phiếu thì để "chưa có", không ước số.
   ===================================================================== */
const TL={busy:false,tried:false,tab:"tq",acct:"",day:""};
try{const t=localStorage.getItem("ailla_tl_tab2");if(t)TL.tab=t}catch(e){}
const tlAccts=()=>{const a=(MH.accts||[]).map(x=>({k:x.id,n:mhAcctLabel(x)||x.bank||"Tài khoản"}));a.push({k:"TIEN_MAT",n:"Tiền mặt tại công ty"},{k:"VI_TT",n:"Ví TikTok Shop (chưa rút)"},{k:"VI_SPE",n:"Ví Shopee (chưa rút)"});return a};
function tlLatest(){const o={};((D().fin||{}).balances||[]).forEach(b=>{const c=o[b.acct];if(!c||b.ngay>c.ngay||(b.ngay===c.ngay&&String(b.id)>String(c.id)))o[b.acct]=b});return o}
const tlDays=(a,b)=>Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/864e5);
function tlSchedule(){
  const today=mhToday(),W=[0,1,2,3].map(()=>({sum:0,rows:[]})),late={sum:0,rows:[]},unk={sum:0,rows:[]};
  (MH.orders||[]).forEach(p=>{if(p.status==="HUY")return;
    let M,st;try{M=mhPoMoney(p);st=mhStage(p,M)}catch(e){return}
    const k=st[0],T=mhTermOf(p).pay_terms,val=M.invTotal||mhValue(p)||0,left=Math.round(val-M.paid);if(left<=1)return;
    const row={left,txt:(p.supplier_name||"")+" · "+(p.no||""),sup:p.supplier_name||"",no:p.no||""};
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

/* ---------- Số dùng chung ---------- */
const tlYmAdd=(ym,n)=>{const d=new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7)-1+n,1));return d.toISOString().slice(0,7)};
const tlEnd=ym=>new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7),0)).toISOString().slice(0,10);
const tlTr=v=>v==null?"—":(v<0?"−":"")+(Math.abs(v)/1e6).toLocaleString("vi-VN",{minimumFractionDigits:1,maximumFractionDigits:1});
const tlN=v=>v==null?"—":(v<0?"−":"")+nf(Math.round(Math.abs(v)));
const tlVn=ym=>"Tháng "+ym.slice(5,7)+"/"+ym.slice(0,4);
const tlFin=()=>D().fin||{};
const tlEd=()=>!!ME&&(mhManage()||can(ME,"chiphi.nhap"));
const tlCeo=()=>!!ME&&ME.role==="admin";
const tlKhoa=ngay=>!!((tlFin().cashClose||{})[String(ngay||"").slice(0,7)]);
/* Bối cảnh tính một lần mỗi lần vẽ: tài khoản tiền 111/112, phiếu đã áp phần gán, số dư mốc, hàm số dư theo ngày. */
function tlCtx(X,ym){
  const B=tlFin().balances||[],acc=X.accounts.filter(a=>a.active||X.docs.some(d=>d.acct===a.id)).map(a=>({k:a.id,n:[a.bank,a.account_no].filter(Boolean).join(" · ")||"Ngân hàng",tk:"112"})).concat([{k:"TIEN_MAT",n:"Tiền mặt tại công ty",tk:"111"}]);
  const ks=new Set(acc.map(a=>a.k)),docs=tcnGan(X.docs,tlFin().cashTag).filter(d=>d.date>TCN_MOC);
  const by={};acc.forEach(a=>by[a.k]=[]);docs.forEach(d=>{if(by[d.acct])by[d.acct].push(d)});
  const moc={};acc.forEach(a=>{const b=tcnSoDu(B,a.k,TCN_MOC);moc[a.k]=b?+b.tien||0:null});
  const bal=(k,ngay)=>moc[k]==null?null:tcnSoDuNgay(moc[k],by[k],ngay);
  const tong=ngay=>{let t=0,co=0;acc.forEach(a=>{const v=bal(a.k,ngay);if(v!=null){t+=v;co++}});return co?t:null};
  const f=ym+"-01",e=tlEnd(ym),today=mhToday();
  const canGan=docs.filter(d=>d.date>=f&&d.date<=e&&d.code!=="noibo"&&(!ks.has(d.acct)||!d.code));
  return {B,acc,ks,docs,by,moc,bal,tong,f,e,today,canGan,thieuMoc:acc.filter(a=>moc[a.k]==null&&by[a.k].length).length}}
/* Chứng từ tiền từ ngày sau mốc (01/10/2026) tới hết tháng đang xem hoặc hôm nay. */
function tlDocs(ym){const today=mhToday(),end=tlEnd(ym);return tcnDongTien("2026-10-01",end>today?end:today)}
const tlChip=(t,c)=>`<span class="tlchip ${c||"ok"}">${t}</span>`;

/* ---------- 1. Tổng quan ---------- */
function tlLine(C){const N=30,pts=[];for(let i=N-1;i>=0;i--){const d=new Date(C.today+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-i);const k=d.toISOString().slice(0,10);if(k<=TCN_MOC)continue;const v=C.tong(k);if(v!=null)pts.push([k,v])}
  if(pts.length<2)return `<p class="empty">Chưa đủ số (cần số dư đầu kỳ 30/09 các tài khoản).</p>`;
  const vs=pts.map(p=>p[1]),mx=Math.max(...vs),mn=Math.min(0,...vs),W=440,H=180,L=6,T=16,B=20,ph=H-T-B,dx=(W-2*L)/(pts.length-1),y=v=>T+(mx-v)/((mx-mn)||1)*ph;
  let s=`<line x1="${L}" x2="${W-L}" y1="${y(0)}" y2="${y(0)}" stroke="#d0d5dd"/><path d="M${pts.map((p,i)=>`${L+i*dx},${y(p[1])}`).join(" L")}" fill="none" stroke="#0e9384" stroke-width="2"/>`;
  const last=pts[pts.length-1];s+=`<circle cx="${L+(pts.length-1)*dx}" cy="${y(last[1])}" r="3.5" fill="#0e9384"/><text x="${W-L}" y="${y(last[1])-8}" text-anchor="end" font-size="11" fill="currentColor">${tlTr(last[1])} tr</text>`;
  [0,Math.floor((pts.length-1)/2),pts.length-1].forEach(i=>{s+=`<text x="${Math.min(W-30,Math.max(20,L+i*dx))}" y="${H-5}" text-anchor="middle" font-size="10" fill="#667085">${tcnDd(pts[i][0]).slice(0,5)}</text>`});
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Số dư tiền 30 ngày">${s}</svg>`}
function tlTabTq(X,C,ym){
  const A=tcnLctt(C.docs,C.f,C.e),Lt=tlLatest(),F=tlDuBao(X,C);
  const now=C.tong(C.today),pm=tlYmAdd(ym,-1),pmChot=tlKhoa(pm+"-01")||pm<=TCN_MOC.slice(0,7);
  const low=F.F.st.findIndex(s=>s==="THIEU"||s==="SAT");
  const viec=[];if(C.thieuMoc)viec.push(`${C.thieuMoc} tài khoản có phiếu nhưng chưa có số dư đầu kỳ 30/09`);if(C.canGan.length)viec.push(`${C.canGan.length} phiếu tháng này chưa có tài khoản hoặc mã B03 (${tlTr(C.canGan.reduce((t,d)=>t+Math.abs(d.amount),0))} tr)`);if(!pmChot)viec.push(`${tlVn(pm)} chưa chốt sổ`);
  const rows=C.acc.map(a=>{const w=C.bal(a.k,C.today),sk=Lt[a.k],wAt=sk?C.bal(a.k,sk.ngay):null,l=sk&&wAt!=null?(+sk.tien||0)-wAt:null;
    return `<tr><td>${esc(a.n)}</td><td>${a.tk}</td><td class="n">${C.moc[a.k]==null?`<span class="hint">chưa nhập</span>`:nf(C.moc[a.k])}</td><td class="n"><b>${tlN(w)}</b></td><td class="n">${sk?nf(sk.tien)+` <small class="hint">${tcnDd(sk.ngay).slice(0,5)}</small>`:`<span class="hint">—</span>`}</td><td class="n">${l==null?"—":Math.abs(l)<1?tlChip("khớp"):`<b class="t-red">${tlN(l)}</b>`}</td></tr>`}).join("");
  const src=TCN_LC.map(r=>{const v=A.v[r[0]];if(!v)return "";return `<tr class="clk" data-tllc="${r[0]}"><td>${esc(r[3])}</td><td class="n">${v>0?tlTr(v):""}</td><td class="n">${v<0?tlTr(-v):""}</td><td class="hint">${esc(r[4])}</td></tr>`}).join("");
  return `<div class="grid kpis">${kpi("Tiền đang có (111 + 112)",now==null?"—":tlTr(now)+" tr",now==null?"cần số dư đầu kỳ 30/09":"web tính tới hôm nay")}${kpi("Tiền vào "+tlVn(ym).toLowerCase(),tlTr(A.vao)+" tr","phiếu thu đã xác nhận")}${kpi("Tiền ra "+tlVn(ym).toLowerCase(),tlTr(A.ra)+" tr","phiếu chi (cả khoản chờ CEO duyệt)")}${kpi("Lưu chuyển thuần",(A.net>0?"+":"")+tlTr(A.net)+" tr","mã 50, chưa chốt",A.net<0?"var(--red)":"")}${kpi("Tuần sắp thiếu tiền",low<0?"Không":"Tuần "+(low+1),low<0?(F.min?"4 tuần tới đủ mức tối thiểu":"chưa tính được mức tối thiểu"):F.wl[low]+" còn "+tlTr(F.F.close[low])+" tr",low<0?"":"var(--red)")}</div>
  ${viec.length?`<div class="note red"><b>Cần kế toán xử lý:</b> ${viec.map(esc).join(" · ")}. <button class="lnk" data-tlt2="chot">Mở Đối chiếu & chốt sổ →</button></div>`:""}
  <div class="tlg2"><section class="card pad"><b>Tiền đang có từng tài khoản</b><p class="hint">Web tính = số dư đầu kỳ 30/09 + phiếu thu − phiếu chi. Sao kê = số kế toán nhập gần nhất; lệch so với web tính cùng ngày đó.</p>
    <div class="nsw"><table class="tbl gd"><thead><tr><th>Tài khoản</th><th>TK</th><th class="n">Đầu kỳ 30/09</th><th class="n">Web tính hôm nay</th><th class="n">Sao kê gần nhất</th><th class="n">Lệch</th></tr></thead><tbody>${rows}</tbody></table></div></section>
   <section class="card pad"><b>Số dư tiền 30 ngày</b><p class="hint">Tổng TK 111 + 112 cuối mỗi ngày, web tính từ phiếu.</p>${tlLine(C)}</section></div>
  <section class="card pad"><b>Thu chi theo nguồn · ${tlVn(ym)}</b><p class="hint">Bấm một dòng để xem phiếu. Triệu đồng.</p>
   ${src?`<div class="nsw"><table class="tbl gd"><thead><tr><th>Nguồn</th><th class="n">Tiền vào</th><th class="n">Tiền ra</th><th>Lấy từ</th></tr></thead><tbody>${src}</tbody></table></div>`:`<p class="empty">Tháng này chưa có phiếu thu chi nào.</p>`}</section>`}
function tlLcOpen(C,key,ym){const r=TCN_LC.find(x=>x[0]===key);if(!r)return;const L=C.docs.filter(d=>d.date>=C.f&&d.date<=C.e&&tcnLcKey(d)===key);
  openDrawerHTML(`<h2>${esc(r[3])}</h2><p class="hint">${tlVn(ym)} · ${esc(r[4])}</p>${L.length?tlDocTbl(L,C)+`<p class="hint">Cộng ${L.length} phiếu: <b>${tlN(L.reduce((t,d)=>t+d.amount,0))}</b> đ</p>`:`<p class="empty">Không có phiếu trong tháng.</p>`}${key==="kpp"||key==="oem"?`<p class="hint">Cùng số với Thu chi › Kho bill giao dịch › Báo cáo tháng (cột đã xác nhận); báo cáo đó còn gồm tiền chờ xác nhận và bù trừ cước khách trả hộ, hai loại này không phải tiền đã về.</p>`:""}`);tcnBindDr()}
/* Bảng phiếu (dùng chung ở sổ ngày, nguồn, B03). gan: cho kế toán gán tài khoản / mã B03 ngay trên dòng. */
function tlDocTbl(L,C,gan){const ao=a=>`<option value="${esc(a.k)}">${a.tk} · ${esc(a.n)}</option>`,co=c=>`<option value="${c}">${c}</option>`;
  return tcnGd(["Ngày","Loại","Phiếu","Bên kia","Liên quan","Tài khoản","Mã B03","Số tiền"],L.map(d=>{const g=gan&&tlEd()&&!tlKhoa(d.date)&&d.id;
    const tk=C.ks.has(d.acct)?(C.acc.find(a=>a.k===d.acct)||{}).tk+" · "+esc(tcnAcctTen(d.acct)):d.code==="noibo"&&TCN_VI.includes(d.acct)?esc(tcnAcctTen(d.acct)):`<span class="t-red">chưa rõ</span>`;
    return `<tr><td>${tcnDd(d.date)}</td><td>${esc(TCN_LOAI[d.loai]||d.loai)}${d.ceo==="CHO"?" "+pill("chờ CEO duyệt","amb"):""}</td><td class="mono">${esc(d.ref||"")}</td><td class="gdd" title="${esc(d.party||"")}">${esc(d.party||"")}</td><td>${tcnDon(d.lq)}</td>
     <td>${g&&!C.ks.has(d.acct)&&d.code!=="noibo"?`<select data-tlga="${esc(d.id)}"><option value="">— chọn —</option>${C.acc.map(ao).join("")}</select>`:tk}</td>
     <td>${d.code==="noibo"?`<span class="hint">nội bộ</span>`:g?`<select data-tlgc="${esc(d.id)}">${d.code?"":`<option value="">— chọn —</option>`}${TCN_B03_MA.map(co).join("")}</select>`.replace(`value="${d.code}"`,`value="${d.code}" selected`):d.code||`<span class="t-red">chưa có</span>`}</td>
     <td class="n">${tlN(d.amount)}</td></tr>`}))}
function tlGanBind(root){if(!root)return;
  root.querySelectorAll("[data-tlga],[data-tlgc]").forEach(s=>s.onchange=()=>{const id=s.dataset.tlga||s.dataset.tlgc,k=s.dataset.tlga?"acct":"code",v=s.value;if(!v)return;
    DB.mutate(ME.name,"gán "+(k==="acct"?"tài khoản":"mã B03")+" cho phiếu tiền",dt=>{dt.fin=dt.fin||{};dt.fin.cashTag=dt.fin.cashTag||{};dt.fin.cashTag[id]={...(dt.fin.cashTag[id]||{}),[k]:v}});toast("Đã gán");renderMain()})}

/* ---------- 2. Sổ tiền theo ngày ---------- */
function tlTabSo(X,C,ym){
  const ks=TL.acct&&C.ks.has(TL.acct)?[TL.acct]:C.acc.map(a=>a.k),to=C.e<C.today?C.e:C.today;
  const dau0=ks.reduce((t,k)=>{const v=C.bal(k,tcnPrevDay(C.f));return v==null?t:(t||0)+v},null);
  const docs=ks.length===1?C.by[ks[0]]:C.docs.filter(d=>C.ks.has(d.acct)&&d.code!=="noibo");
  const R=tcnSoNgay(docs,dau0,C.f,to),day=TL.day&&R.some(r=>r.d===TL.day)?TL.day:(R.length?R[R.length-1].d:"");
  const chua=C.docs.filter(d=>d.date>=C.f&&d.date<=C.e&&!C.ks.has(d.acct)&&d.code!=="noibo");
  const L=docs.filter(d=>d.date===day);
  return `<section class="card pad"><div class="tlh"><b>Sổ tiền theo ngày · ${tlVn(ym)}</b><span class="tlacts"><select id="tl-acct"><option value="">Tất cả (111 + 112)</option>${C.acc.map(a=>`<option value="${esc(a.k)}"${TL.acct===a.k?" selected":""}>${a.tk} · ${esc(a.n)}</option>`).join("")}</select>
   ${tlEd()?`<button class="btn sm" id="tl-tcp">+ Phiếu thu / chi khác</button> <button class="btn sm" id="tl-ck">Chuyển nội bộ</button>`:""}</span></div>
   <p class="hint">Như sổ quỹ tiền mặt / sổ tiền gửi: đầu ngày + thu − chi = cuối ngày. ${ks.length>1?"Xem tất cả thì chuyển nội bộ giữa các tài khoản không tính. ":""}Bấm một ngày để xem phiếu.${dau0==null?" <b>Chưa có số dư đầu kỳ 30/09</b> nên cột đầu ngày tính từ 0.":""}</p>
   ${R.length?`<div class="nsw"><table class="tbl gd"><thead><tr><th>Ngày</th><th class="n">Đầu ngày</th><th class="n">Thu</th><th class="n">Chi</th><th class="n">Cuối ngày</th><th class="n">Số phiếu</th></tr></thead><tbody>${R.map(r=>`<tr class="clk${r.d===day?" tlon":""}" data-tlday="${r.d}"><td>${tcnDd(r.d)}</td><td class="n">${tlN(r.dau)}</td><td class="n">${r.thu?tlN(r.thu):"–"}</td><td class="n">${r.chi?tlN(r.chi):"–"}</td><td class="n"><b>${tlN(r.cuoi)}</b></td><td class="n">${r.n}</td></tr>`).join("")}
    <tr class="tltot"><td>Cộng tháng</td><td class="n">${tlN(dau0||0)}</td><td class="n">${tlN(R.reduce((t,r)=>t+r.thu,0))}</td><td class="n">${tlN(R.reduce((t,r)=>t+r.chi,0))}</td><td class="n">${tlN(R[R.length-1].cuoi)}</td><td class="n">${R.reduce((t,r)=>t+r.n,0)}</td></tr></tbody></table></div>`:`<p class="empty">Tháng này chưa có phiếu nào ở tài khoản đang chọn.</p>`}
   ${day?`<div class="tldr"><b>Phiếu ngày ${tcnDd(day)}</b>${tlDocTbl(L,C,true)}</div>`:""}</section>
   ${chua.length?`<section class="card pad"><b>Phiếu chưa rõ tài khoản · ${chua.length} phiếu</b><p class="hint">Chưa vào sổ tài khoản nào. Kế toán chọn tài khoản ngay trên dòng (chỉ ghi phân loại, không sửa phiếu gốc).</p>${tlDocTbl(chua,C,true)}</section>`:""}
   ${tlTcpList()}${tlCkList(tlEd())}`}

/* ---------- 3. Lưu chuyển tiền tệ B03 ---------- */
const TL_B03_SRC={"01":"tiền khách Kênh phân phối / OEM đã xác nhận, ví sàn rút về, Sổ thu, phiếu COD Facebook về","02":"phiếu chi nhà cung cấp, vận chuyển, dòng tiền thật Sổ chi phí (hàng hóa, dịch vụ)","03":"chi lương bằng QR, Sổ chi phí G07, G08","04":"phiếu trả lãi vay","05":"phiếu nộp thuế TNDN","06":"Sổ thu (nhà cung cấp hoàn tiền, thu khác), phiếu thu khác","07":"thưởng NPP, hoàn bù khách, phí ngân hàng, thuế khác, chi khác","21":"Sổ chi phí G28 (mua TSCĐ / CCDC)","22":"Tài sản & CCDC › ghi giảm có thu tiền","23":"chưa có loại phiếu","24":"chưa có loại phiếu","25":"phiếu lãi tiền gửi","31":"phiếu chủ sở hữu góp vốn","32":"phiếu trả lại vốn góp","33":"phiếu tiền vay","34":"phiếu trả nợ gốc vay","35":"phiếu chia lợi nhuận"};
function tlB03Thang(C,ym){const cl=(tlFin().cashClose||{})[ym];if(cl&&cl.b03)return {v:cl.b03,chot:cl,co:new Set(Object.keys(cl.b03))};
  const f=ym+"-01",e=tlEnd(ym),dau=C.tong(tcnPrevDay(f));const r=tcnB03(C.docs.filter(d=>C.ks.has(d.acct)),f,e,dau);return {v:r.v,co:r.co,chot:null}}
function tlTabB03(X,C,ym){
  const pm=tlYmAdd(ym,-1),A=tlB03Thang(C,ym),P=pm<"2026-10"?null:tlB03Thang(C,pm);
  const st=x=>x&&x.chot?tlChip("đã chốt "+tcnDd(String(x.chot.atD||"")).slice(0,5)):tlChip("chưa chốt","no");
  const cell=(x,c)=>{if(!x)return `<td class="n hint">—</td>`;const v=x.v[c];return `<td class="n">${v==null?"—":tlN(v)}</td>`};
  const body=TCN_B03.map(([c,t])=>{if(/^I+$/.test(c))return `<tr class="tlsec"><td colspan="5">${esc(t)}</td></tr>`;
    const tot=["20","30","40","50","60","61","70"].includes(c);
    return `<tr class="${c==="50"||c==="70"?"tlgrand":tot?"tltot":"clk"}"${tot?"":` data-tlb03="${c}"`}><td${tot?"":` class="tlsub"`}>${esc(t)}</td><td class="c">${c}</td>${cell(A,c)}${cell(P,c)}<td class="hint">${tot?(c==="60"?"số dư cuối tháng trước (mốc 30/09 nhập từ MISA)":c==="70"?"phải bằng tổng số dư TK 111 + 112":c==="61"?"không có ngoại tệ":""):(A.co.has(c)?tlChip("có phiếu")+" ":TL_B03_SRC[c]&&/chưa có/.test(TL_B03_SRC[c])?tlChip("chưa có","no")+" ":"")+esc(TL_B03_SRC[c]||"")}</td></tr>`}).join("");
  return `<section class="card pad"><div class="tlh"><b>Báo cáo lưu chuyển tiền tệ (phương pháp trực tiếp) · Mẫu B03-DNN</b><span class="tlacts"><button class="btn sm" id="tl-xls">Tải Excel theo mẫu MISA</button></span></div>
   <p class="hint">Theo Thông tư 133/2016/TT-BTC, cùng mã số với MISA. ${tlVn(ym)} ${st(A)} · ${P?tlVn(pm)+" "+st(P):"kỳ trước: trước mốc 30/09"}. Đơn vị: đồng. Bấm một dòng để xem phiếu.${C.canGan.length?` <span class="t-red">Còn ${C.canGan.length} phiếu tháng này chưa có tài khoản / mã B03 nên chưa vào báo cáo.</span>`:""}</p>
   <div class="nsw"><table class="tbl gd tllc"><thead><tr><th>Chỉ tiêu</th><th class="c">Mã số</th><th class="n">Kỳ này (${ym.slice(5)}/${ym.slice(0,4)})</th><th class="n">Kỳ trước (${pm.slice(5)}/${pm.slice(0,4)})</th><th>Lấy từ phiếu nào trên web</th></tr></thead><tbody>${body}</tbody></table></div></section>`}
function tlB03Open(C,ym,code){const r=TCN_B03.find(x=>x[0]===code),L=C.docs.filter(d=>d.date>=C.f&&d.date<=C.e&&d.code===code&&C.ks.has(d.acct));
  openDrawerHTML(`<h2>${code} · ${esc(r?r[1]:"")}</h2><p class="hint">${tlVn(ym)} · ${esc(TL_B03_SRC[code]||"")}</p>${L.length?tlDocTbl(L,C,true)+`<p class="hint">Cộng ${L.length} phiếu: <b>${tlN(L.reduce((t,d)=>t+d.amount,0))}</b> đ</p>`:`<p class="empty">Không có phiếu.</p>`}`);tcnBindDr();tlGanBind(document.getElementById("drawerIn"))}
function tlXls(C,ym){if(typeof XLSX==="undefined"){toast("Chưa tải được bộ xuất Excel");return}
  const pm=tlYmAdd(ym,-1),A=tlB03Thang(C,ym),P=pm<"2026-10"?null:tlB03Thang(C,pm);
  const rows=[["BÁO CÁO LƯU CHUYỂN TIỀN TỆ"],["(Theo phương pháp trực tiếp) · Mẫu số B03-DNN"],[tlVn(ym)],["Đơn vị tính: VND"],[],["Chỉ tiêu","Mã số","Thuyết minh","Kỳ này","Kỳ trước"],["1","2","3","4","5"]]
    .concat(TCN_B03.map(([c,t])=>/^I+$/.test(c)?[t,"","","",""]:[t,c,c==="70"?"VII":"",A.v[c]==null?"":Math.round(A.v[c]),P&&P.v[c]!=null?Math.round(P.v[c]):""]));
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:80},{wch:8},{wch:10},{wch:18},{wch:18}];XLSX.utils.book_append_sheet(wb,ws,"B03-DNN");XLSX.writeFile(wb,`B03_DNN_LCTT_${ym}.xlsx`)}

/* ---------- 4. Dự báo 4 tuần + kế hoạch chi + nợ đến hạn ---------- */
function tlDuBao(X,C){
  const B=C.B,today=C.today,wk=tcnTuan(today),S4=tlSchedule(),wl=wk.map(w=>tcnDd(w.tu).slice(0,5)+"–"+tcnDd(w.den).slice(0,5));
  const vi=["VI_TT","VI_SPE"].map(a=>tcnSoDu(B,a,today)).filter(Boolean),viT=vi.reduce((t,b)=>t+(+b.tien||0),0);
  const bud=g=>ym=>{const o=(tlFin().budgets||{})[ym]||{};return Object.entries(o).filter(([k])=>g.includes(k.split("||")[0])).reduce((t,[,v])=>t+(+v||0),0)};
  const hasBud=g=>wk.some(w=>[w.tu.slice(0,7),w.den.slice(0,7)].some(ym=>bud(g)(ym)>0));
  const G_QC=["Marketing"],G_KHAC=["Vận hành","Logistics","Bán hàng","Tài chính","Khác"];
  /* Lương trả ngày 10: bảng lương đã chốt của tháng trước ngày 10 đó, trừ phần đã chi bằng QR. */
  const lg=[0,0,0,0];let lgNote="",lgOk=false;
  wk.forEach((w,i)=>{for(let d=new Date(w.tu+"T00:00:00Z");d.toISOString().slice(0,10)<=w.den;d.setUTCDate(d.getUTCDate()+1)){if(d.getUTCDate()!==10)continue;const pm=tlYmAdd(d.toISOString().slice(0,7),-1);
    try{const R=typeof cpLgRows==="function"?cpLgRows(pm):null;if(R&&R.ok&&R.chot){const daChi=Object.values(((((D().hr||{}).payroll||{})[pm]||{}).chi||{}).list||{}).filter(c=>c&&c.st==="da").reduce((t,c)=>t+(+c.tien||0),0);
      lg[i]+=Math.max(0,R.rows.reduce((t,r)=>t+(+r.tong||0),0)-daChi);lgOk=true;lgNote="bảng lương "+pm.slice(5)+"/"+pm.slice(0,4)+" đã chốt, trả ngày 10"}else lgNote="bảng lương "+pm.slice(5)+"/"+pm.slice(0,4)+" chưa chốt"}catch(e){lgNote="chưa đọc được bảng lương"}}});
  /* Kế hoạch chi (chờ duyệt / đã duyệt) theo tuần. */
  const plan=(tlFin().chiPlan||[]).filter(p=>p.st!=="XONG"),pw=st=>wk.map(w=>plan.filter(p=>p.st===st&&p.ngay>=w.tu&&p.ngay<=w.den).reduce((t,p)=>t+(+p.tien||0),0)),pLate=st=>plan.filter(p=>p.st===st&&p.ngay<today).reduce((t,p)=>t+(+p.tien||0),0);
  const pD=pw("DUYET"),pC=pw("CHO");pD[0]+=pLate("DUYET");pC[0]+=pLate("CHO");
  const thu=[{n:"Khách Kênh phân phối, Kênh OEM trả nợ đến hạn",v:null,s:"chưa có: chưa chốt số ngày khách được nợ nên chưa có hạn"},
    {n:"Tiền ví sàn chờ rút (TikTok, Shopee)",v:vi.length?[viT,0,0,0]:null,s:vi.length?"số dư ví kế toán nhập; ngày sàn trả chưa biết, xếp tuần 1":"chưa nhập số dư ví sàn"},
    {n:"COD Facebook về",v:null,s:"chưa có lịch COD về; phiếu COD đã ghi nằm ở sổ tiền"}];
  const chi=[{n:"Trả nhà cung cấp đến hạn",v:[S4.W[0].sum+S4.late.sum,S4.W[1].sum,S4.W[2].sum,S4.W[3].sum],s:"Mua hàng, theo hạn trả từng đơn mua"+(S4.late.sum?" · tuần 1 gồm "+tlTr(S4.late.sum)+" tr quá hạn":"")+(S4.unk.sum?" · chưa rõ ngày trả "+tlTr(S4.unk.sum)+" tr (không xếp tuần)":"")},
    {n:"Lương",v:lgOk?lg:null,s:lgNote||"không có ngày 10 trong 4 tuần"},
    {n:"Quảng cáo",v:hasBud(G_QC)?tcnChiaTuan(wk,bud(G_QC)):null,s:hasBud(G_QC)?"Ngân sách nhóm Marketing chia đều theo ngày":"chưa đặt Ngân sách nhóm Marketing"},
    {n:"Chi cố định, vận hành khác",v:hasBud(G_KHAC)?tcnChiaTuan(wk,bud(G_KHAC)):null,s:hasBud(G_KHAC)?"Ngân sách Vận hành, Logistics, Bán hàng, Tài chính, Khác chia theo ngày":"chưa đặt Ngân sách các nhóm này"},
    {n:"Kế hoạch chi đã duyệt",v:pD.some(Boolean)?pD:null,s:pD.some(Boolean)?"khoản CEO đã duyệt ở bảng Kế hoạch chi":"chưa có khoản nào"},
    {n:"Kế hoạch chi chờ CEO duyệt",v:pC.some(Boolean)?pC:null,s:pC.some(Boolean)?"tính trước để thấy nếu duyệt hết":"chưa có khoản nào"}];
  let cb={v:0};try{cb=tcnChiBq()}catch(e){}
  const runway=(typeof dhGet==="function"&&D().fin?dhGet().nguong.runway:30)||30,min=cb.v>0?Math.round(runway*cb.v):0;
  return {F:tcnDuBao(C.tong(today),thu,chi,min),thu,chi,wl,wk,min,runway,cb,S4,plan}}
function tlTabDb(X,C){
  const D0=tlDuBao(X,C),F=D0.F,wl=D0.wl,ed=tlEd(),ceo=tlCeo();
  const cell=v=>`<td class="n">${v==null?"—":v===0?"–":tlTr(v)}</td>`,ro=(r,neg)=>`<tr><td class="tlsub">${esc(r.n)} <span class="hint">${esc(r.s)}</span></td>${r.v==null?`<td colspan="4">${tlChip("chưa có","no")}</td>`:r.v.map(v=>cell(neg?-v:v)).join("")}</tr>`;
  const chip=s=>s==="THIEU"?pill("Thiếu","red"):s==="SAT"?pill("Sát mức","amb"):s==="DU"?pill("Đủ","grn"):`<span class="hint">—</span>`;
  const low=F.st.map((s,i)=>[s,i]).filter(x=>x[0]==="THIEU"||x[0]==="SAT");
  const warn=F.open[0]==null?`<div class="note">Chưa có số dư đầu kỳ 30/09 nên chưa tính được tiền đầu tuần. Kế toán nhập ở Đối chiếu & chốt sổ.</div>`
    :low.length?`<div class="note red"><b>Tuần ${low[0][1]+1} (${wl[low[0][1]]}) tiền cuối tuần còn ${tlTr(F.close[low[0][1]])} tr, ${F.st[low[0][1]]==="THIEU"?"dưới":"sát"} mức tối thiểu ${tlTr(D0.min)} tr.</b> Chi lớn nhất tuần đó: ${esc(D0.chi.filter(r=>r.v).sort((a,b)=>b.v[low[0][1]]-a.v[low[0][1]])[0].n.toLowerCase())}. Có thể dời khoản chờ duyệt ở bảng Kế hoạch chi. Dòng thu "chưa có" chưa được cộng.</div>`:"";
  const P=D0.plan.slice().sort((a,b)=>a.ngay<b.ngay?-1:1);
  const det=(title,w)=>w.rows.length?`<tr class="tlsec"><td colspan="4">${title} · ${nf(w.sum)} đ</td></tr>`+w.rows.map(r=>`<tr><td class="gdd" title="${esc(r.sup)}">${esc(r.sup)}</td><td>${r.no?tcnDon(r.no):"—"}</td><td>${r.due?esc(mhDM(r.due)):"—"}</td><td class="n">${nf(r.left)}</td></tr>`).join(""):"";
  const K=TCN.th&&TCN.th.khach?TCN.th.khach.rows.slice().sort((a,b)=>b.official_debt-a.official_debt).slice(0,8):[];
  return `${warn}<section class="card pad"><b>Dự báo tiền 4 tuần tới</b><p class="hint">Bắt đầu từ số dư TK 111 + 112 web tính hôm nay. Mức tối thiểu cần giữ: ${D0.min?`<b>${tlTr(D0.min)} tr</b> (${D0.runway} ngày × chi bình quân ${nf(Math.round(D0.cb.v))} đ/ngày, ngưỡng ở Cấu hình › Ngưỡng cảnh báo)`:"chưa tính được (chưa có số chi bình quân)"}. Triệu đồng.</p>
  <div class="nsw"><table class="tbl gd tllc"><thead><tr><th>Tuần</th>${wl.map((w,i)=>`<th class="n">Tuần ${i+1} · ${w}</th>`).join("")}</tr></thead><tbody>
  <tr class="tltot"><td>Tiền đầu tuần</td>${F.open.map(cell).join("")}</tr>
  <tr class="tlsec"><td colspan="5">Tiền sắp vào</td></tr>${D0.thu.map(r=>ro(r)).join("")}<tr class="tltot"><td>Cộng tiền vào</td>${F.ti.map(cell).join("")}</tr>
  <tr class="tlsec"><td colspan="5">Tiền phải ra</td></tr>${D0.chi.map(r=>ro(r,true)).join("")}<tr class="tltot"><td>Cộng tiền ra</td>${F.ci.map(v=>cell(-v)).join("")}</tr>
  <tr class="tlgrand"><td>Tiền cuối tuần</td>${F.close.map(cell).join("")}</tr>
  <tr><td>So với mức tối thiểu</td>${F.st.map(s=>`<td class="n">${chip(s)}</td>`).join("")}</tr></tbody></table></div></section>
  <div class="tlg2"><section class="card pad"><div class="tlh"><b>Kế hoạch chi</b>${ed?`<button class="btn sm" id="tl-plan">+ Thêm khoản sắp chi</button>`:""}</div><p class="hint">Khoản sắp chi ngoài lịch trả nhà cung cấp (máy móc, thuế, khoản lớn). CEO duyệt hoặc dời ngày; dự báo tính lại ngay. Chi xong thì bấm "Đã chi" và ghi phiếu như thường.</p>
   ${P.length?`<div class="nsw"><table class="tbl gd"><thead><tr><th>Ngày dự chi</th><th>Khoản</th><th class="n">Số tiền</th><th>Trạng thái</th><th></th></tr></thead><tbody>${P.map(p=>`<tr><td>${tcnDd(p.ngay)}</td><td class="gdd" title="${esc(p.nd)}">${esc(p.nd)} <small class="hint">· ${esc(p.by||"")}</small></td><td class="n">${nf(p.tien)}</td><td>${p.st==="DUYET"?pill("đã duyệt","grn"):pill("chờ CEO duyệt","amb")}</td><td>${ceo&&p.st==="CHO"?`<button class="btn pri sm" data-tlpd="${esc(p.id)}">Duyệt</button> `:""}${ceo||ed?`<button class="lnk" data-tlpr="${esc(p.id)}">Dời ngày</button> · <button class="lnk" data-tlpx="${esc(p.id)}">${p.st==="DUYET"?"Đã chi":"Bỏ"}</button>`:""}</td></tr>`).join("")}</tbody></table></div>`:`<p class="empty">Chưa có khoản nào.</p>`}</section>
   <section class="card pad"><b>Nợ đến hạn</b><p class="hint">Phải trả nhà cung cấp theo hạn trên đơn mua (4 tuần + quá hạn). Phải thu khách chưa có hạn nợ nên xếp theo số nợ, chưa đưa vào dự báo.</p>
   <div class="nsw"><table class="tbl gd"><thead><tr><th>Bên</th><th>Loại</th><th>Hạn</th><th class="n">Số tiền</th></tr></thead><tbody>
   ${[...D0.S4.late.rows,...D0.S4.W.flatMap(w=>w.rows)].slice(0,12).map(r=>`<tr><td class="gdd" title="${esc(r.sup)}">${esc(r.sup)}</td><td>Phải trả · ${r.no?tcnDon(r.no):""}</td><td>${r.due?esc(mhDM(r.due)):"—"}</td><td class="n">${nf(r.left)}</td></tr>`).join("")}
   ${K.map(r=>`<tr><td class="gdd" title="${esc(r.customer_name)}">${esc(r.customer_name)}</td><td>Phải thu · ${r.kenh==="GIA_CONG"?"Kênh OEM":"Kênh phân phối"}</td><td class="hint">chưa có hạn${r.oldest_days?" · đơn cũ nhất "+r.oldest_days+" ngày":""}</td><td class="n">${nf(Math.round(r.official_debt))}</td></tr>`).join("")}</tbody></table></div></section></div>
  <section class="card pad"><b>Trả nhà cung cấp theo hạn (chi tiết)</b>
  ${D0.S4.late.rows.length||D0.S4.W.some(w=>w.rows.length)||D0.S4.unk.rows.length?`<div class="nsw"><table class="tbl gd"><thead><tr><th>Nhà cung cấp</th><th>Liên quan</th><th>Hạn trả</th><th class="n">Còn phải trả</th></tr></thead><tbody>${det("Quá hạn",D0.S4.late)}${D0.S4.W.map((w,i)=>det("Tuần "+(i+1)+" · "+wl[i],w)).join("")}${det("Chưa rõ ngày trả",D0.S4.unk)}</tbody></table></div>`:`<p class="empty">Không còn khoản phải trả nhà cung cấp nào.</p>`}</section>`}
function tlPlanForm(){
  openDrawerHTML(`<h2>Thêm khoản sắp chi</h2><p class="hint">Khoản sẽ chờ CEO duyệt. Chưa phải phiếu chi: chi xong vẫn ghi phiếu ở trang tương ứng.</p><form class="frm" id="tlp"><label class="field">Ngày dự chi<input id="tlp-d" type="date" value="${mhToday()}" required></label>
   <label class="field">Khoản chi<input id="tlp-n" required placeholder="Ví dụ: Thuế GTGT tháng 11, mua máy chiết rót"></label><label class="field">Số tiền (đ)<input id="tlp-t" type="number" min="1" step="1" required></label><button class="btn pri">Lưu</button></form>`);
  $("#tlp").onsubmit=e=>{e.preventDefault();const x={id:uid("kp"),ngay:$("#tlp-d").value,nd:$("#tlp-n").value.trim(),tien:Math.round(+$("#tlp-t").value),st:tlCeo()?"DUYET":"CHO",by:ME.name,at:Date.now()};if(!x.nd||!(x.tien>0))return;
    DB.mutate(ME.name,"thêm kế hoạch chi",dt=>{dt.fin=dt.fin||{};dt.fin.chiPlan=dt.fin.chiPlan||[];dt.fin.chiPlan.push(x)});closeDrawer();toast(x.st==="DUYET"?"Đã thêm":"Đã thêm, chờ CEO duyệt");renderMain()}}
function tlPlanSet(id,f,why){DB.mutate(ME.name,why,dt=>{const p=((dt.fin||{}).chiPlan||[]).find(x=>x.id===id);if(p)f(p)});renderMain()}

/* ---------- Phiếu thu / chi khác (khoản web chưa có chỗ ghi) ---------- */
function tlTcpForm(C){const ao=a=>`<option value="${esc(a.k)}">${a.tk} · ${esc(a.n)}</option>`;
  openDrawerHTML(`<h2>Phiếu thu / chi khác</h2><p class="hint">Cho khoản chưa có chỗ ghi ở trang khác: tiền COD Facebook về, vay, trả nợ vay, lãi vay, góp / trả vốn, chia lợi nhuận, nộp thuế, phí ngân hàng. Khoản đã có trang riêng (khách trả tiền, trả nhà cung cấp, vận chuyển, chi phí, lương) thì ghi ở trang đó để khỏi tính hai lần.</p>
  <form class="frm" id="tlt"><label class="field">Loại<select id="tlt-l">${TCN_TCP.map(t=>`<option value="${t[0]}">${t[3]>0?"Thu":"Chi"} · ${esc(t[1])} (mã ${t[2]})</option>`).join("")}</select></label>
   <label class="field">Ngày<input id="tlt-d" type="date" value="${mhToday()}" required></label><label class="field">Tài khoản<select id="tlt-a">${C.acc.map(ao).join("")}</select></label>
   <label class="field">Số tiền (đ)<input id="tlt-t" type="number" min="1" step="1" required></label><label class="field">Nội dung<input id="tlt-n" placeholder="Ví dụ: GHN trả COD bảng kê 17/11"></label><div id="tlt-e"></div><button class="btn pri">Lưu phiếu</button></form>`);
  $("#tlt").onsubmit=e=>{e.preventDefault();const x={id:uid("tp"),loai:$("#tlt-l").value,ngay:$("#tlt-d").value,acct:$("#tlt-a").value,tien:Math.round(+$("#tlt-t").value),note:$("#tlt-n").value.trim(),by:ME.name,at:Date.now()};
    if(tlKhoa(x.ngay)){$("#tlt-e").innerHTML=`<div class="note red">Tháng ${x.ngay.slice(5,7)} đã chốt sổ. CEO mở khóa rồi mới ghi được.</div>`;return}
    if(!(x.tien>0)){$("#tlt-e").innerHTML=`<div class="note red">Nhập số tiền</div>`;return}
    DB.mutate(ME.name,"ghi phiếu thu / chi khác",dt=>{dt.fin=dt.fin||{};dt.fin.tcp=dt.fin.tcp||[];dt.fin.tcp.push(x)});closeDrawer();toast("Đã ghi phiếu");renderMain()}}
function tlTcpList(){const L=((tlFin().tcp)||[]).slice().sort((a,b)=>a.ngay<b.ngay?1:-1).slice(0,30);if(!L.length)return "";const ed=tlEd();
  return `<section class="card pad"><b>Phiếu thu / chi khác gần đây</b><div class="nsw"><table class="tbl gd"><thead><tr><th>Ngày</th><th>Loại</th><th>Tài khoản</th><th class="n">Số tiền</th><th>Nội dung</th><th>Người ghi</th><th></th></tr></thead><tbody>${L.map(x=>{const t=TCN_TCP.find(z=>z[0]===x.loai)||["","?","",1];
    return `<tr><td>${tcnDd(x.ngay)}</td><td>${esc(t[1])} <small class="hint">mã ${t[2]}</small></td><td>${esc(tcnAcctTen(x.acct))}</td><td class="n">${tlN(t[3]*x.tien)}</td><td class="gdd" title="${esc(x.note||"")}">${esc(x.note||"")}</td><td class="hint">${esc(x.by||"")}</td><td>${ed&&!tlKhoa(x.ngay)?`<button class="lnk" data-tltx="${esc(x.id)}">Xóa</button>`:""}</td></tr>`}).join("")}</tbody></table></div></section>`}
function tlTcpXoa(id){const x=((tlFin().tcp)||[]).find(y=>y.id===id);if(!x)return;if(!confirm(`Xóa phiếu ${nf(x.tien)} đ ngày ${tcnDd(x.ngay)}? Chỉ xóa phiếu ghi nhầm.`))return;
  DB.mutate(ME.name,"xóa phiếu thu / chi khác ("+nf(x.tien)+" đ, "+x.ngay+")",dt=>{dt.fin.tcp=(dt.fin.tcp||[]).filter(y=>y.id!==id)});toast("Đã xóa phiếu");renderMain()}

/* ---------- 5. Đối chiếu & chốt sổ ---------- */
function tlChotRows(C,ym){const f=ym+"-01",e=tlEnd(ym);
  return C.acc.filter(a=>C.moc[a.k]!=null||C.by[a.k].length).map(a=>{const dau=C.bal(a.k,tcnPrevDay(f)),L=C.by[a.k].filter(d=>d.date>=f&&d.date<=e);
    const thu=L.filter(d=>d.amount>0).reduce((t,d)=>t+d.amount,0),chi=-L.filter(d=>d.amount<0).reduce((t,d)=>t+d.amount,0),cuoi=dau==null?null:dau+thu-chi;
    const sk=C.B.filter(b=>b.acct===a.k&&b.ngay===e).sort((x,y)=>String(x.id)<String(y.id)?1:-1)[0];
    return {k:a.k,n:a.tk+" · "+a.n,dau,thu,chi,cuoi,sk:sk?+sk.tien||0:null}})}
function tlTabChot(X,C,ym){
  const ed=tlEd(),ceo=tlCeo(),cl=tlFin().cashClose||{},me=cl[ym],e=tlEnd(ym),R=tlChotRows(C,ym),ly=tcnChotLyDo(R.map(r=>r.cuoi==null?{...r,sk:null,n:r.n+" (chưa có số dư đầu kỳ)"}:r),C.canGan.length),xong=e<C.today;
  const live70=C.tong(e),lech70=me&&live70!=null&&me.c70!=null?live70-me.c70:null;
  const mocRows=C.acc.map(a=>`<tr><td>${a.tk} · ${esc(a.n)}</td><td class="n">${C.moc[a.k]==null?`<span class="hint">chưa nhập</span>`:nf(C.moc[a.k])}</td></tr>`).join("");
  const hist=Object.keys(cl).sort().reverse().map(k=>`<tr><td>${k.slice(5)}/${k.slice(0,4)}</td><td>${pill("đã chốt","grn")}</td><td class="n">${tlN(cl[k].c70)}</td><td>${esc(cl[k].by||"")}</td><td>${tcnDd(cl[k].atD||"")}</td><td>${ceo?`<button class="lnk" data-tlmo="${k}">Mở khóa</button>`:""}</td></tr>`).join("");
  return `<section class="card pad"><div class="tlh"><b>Số dư đầu kỳ (mốc 30/09/2026)</b>${ed&&!tlKhoa("2026-10-01")?`<button class="btn sm" id="tl-moc">Nhập số dư đầu kỳ</button>`:""}</div><p class="hint">Nhập một lần: số dư cuối ngày 30/09/2026 của TK 111 và từng TK 112, lấy từ MISA. Từ đó web tự cộng phiếu thu, trừ phiếu chi. Tháng 10 đã chốt thì không sửa được nữa.</p>
   <div class="nsw"><table class="tbl gd"><thead><tr><th>Tài khoản</th><th class="n">Số dư 30/09/2026</th></tr></thead><tbody>${mocRows}</tbody></table></div></section>
  <section class="card pad"><div class="tlh"><b>Đối chiếu số dư ${tlVn(ym).toLowerCase()}</b>${ed&&!me?`<button class="btn sm" id="tl-sk">Nhập sao kê ${tcnDd(e)}</button>`:""}</div>
   <p class="hint">Đầu kỳ = số dư web tính cuối tháng trước. Cuối kỳ web = đầu kỳ + thu − chi (kể cả chuyển nội bộ). Sao kê = số trên sao kê ngân hàng / kiểm quỹ ngày ${tcnDd(e)} kế toán nhập. Lệch phải về 0 mới chốt được.</p>
   <div class="nsw"><table class="tbl gd"><thead><tr><th>Tài khoản</th><th class="n">Đầu kỳ</th><th class="n">Thu</th><th class="n">Chi</th><th class="n">Cuối kỳ web</th><th class="n">Sao kê ${tcnDd(e).slice(0,5)}</th><th class="n">Lệch</th></tr></thead><tbody>${R.map(r=>`<tr><td>${esc(r.n)}</td><td class="n">${tlN(r.dau)}</td><td class="n">${tlN(r.thu)}</td><td class="n">${tlN(r.chi)}</td><td class="n"><b>${tlN(r.cuoi)}</b></td><td class="n">${r.sk==null?`<span class="hint">chưa nhập</span>`:nf(r.sk)}</td><td class="n">${r.sk==null||r.cuoi==null?"—":Math.abs(r.sk-r.cuoi)<1?tlChip("khớp"):`<b class="t-red">${tlN(r.sk-r.cuoi)}</b>`}</td></tr>`).join("")}</tbody></table></div></section>
  ${C.canGan.length?`<section class="card pad"><b>Cần kế toán gán trước khi chốt · ${C.canGan.length} phiếu</b><p class="hint">Phiếu thiếu tài khoản tiền hoặc chưa xếp được mã B03. Gán ở đây chỉ ghi thêm phân loại cho sổ tiền và báo cáo, không sửa phiếu gốc.</p>${tlDocTbl(C.canGan,C,true)}</section>`:""}
  <section class="card pad"><div class="tlh"><b>Chốt sổ ${tlVn(ym).toLowerCase()}</b>${me?pill("đã chốt "+tcnDd(me.atD||"")+" · "+(me.by||""),"grn"):ed?`<button class="btn pri sm" id="tl-chot"${ly.length||!xong?" disabled":""}>Chốt sổ ${tlVn(ym).toLowerCase()}</button>`:""}</div>
   <p class="hint">Chốt xong: số cuối tháng thành đầu kỳ tháng sau, báo cáo B03 tháng này giữ nguyên, không ghi / sửa / xóa phiếu tiền ngày trong tháng này được nữa. Mở khóa chỉ CEO, phải ghi lý do.</p>
   ${me?(lech70!=null&&Math.abs(lech70)>=1?`<div class="note red">Sau khi chốt có phiếu thay đổi: số web tính cuối tháng nay lệch bản chốt ${tlN(lech70)} đ. CEO mở khóa để kế toán xem lại, hoặc giữ bản chốt.</div>`:""):!xong?`<div class="note">Tháng chưa hết, chốt được từ ngày ${tcnDd(tcnPrevDay(tlYmAdd(ym,1)+"-02"))}.</div>`:ly.length?`<div class="note red"><b>Chưa chốt được:</b> ${ly.map(esc).join(" · ")}.</div>`:`<div class="note grn" style="border-left-color:#067647;background:#ecfdf3">Đủ điều kiện chốt sổ.</div>`}
   ${hist?`<div class="nsw"><table class="tbl gd"><thead><tr><th>Tháng</th><th>Trạng thái</th><th class="n">Tiền cuối kỳ (mã 70)</th><th>Người chốt</th><th>Ngày</th><th></th></tr></thead><tbody>${hist}</tbody></table></div>`:""}</section>`}
function tlChot(X,C,ym){const R=tlChotRows(C,ym),ly=tcnChotLyDo(R,C.canGan.length);if(ly.length){toast(ly[0]);return}
  const A=tcnB03(C.docs.filter(d=>C.ks.has(d.acct)),ym+"-01",tlEnd(ym),C.tong(tcnPrevDay(ym+"-01")));
  if(!confirm(`Chốt sổ ${tlVn(ym).toLowerCase()}? Tiền cuối kỳ ${tlN(A.v["70"])} đ. Sau khi chốt không ghi, sửa phiếu tiền trong tháng được nữa.`))return;
  const snap={at:Date.now(),atD:mhToday(),by:ME.name,b03:A.v,c70:A.v["70"],acct:Object.fromEntries(R.map(r=>[r.k,{dau:r.dau,thu:r.thu,chi:r.chi,cuoi:r.cuoi,sk:r.sk}]))};
  DB.mutate(ME.name,"chốt sổ tiền "+ym,dt=>{dt.fin=dt.fin||{};dt.fin.cashClose=dt.fin.cashClose||{};dt.fin.cashClose[ym]=snap});toast("Đã chốt sổ "+tlVn(ym).toLowerCase());renderMain()}
function tlMoKhoa(ym){const ly=prompt(`Lý do mở khóa sổ tiền tháng ${ym.slice(5)}/${ym.slice(0,4)}?`);if(!ly||ly.trim().length<3){toast("Cần ghi lý do");return}
  DB.mutate(ME.name,"mở khóa sổ tiền "+ym+": "+ly.trim(),dt=>{const c=(dt.fin.cashClose||{})[ym];if(!c)return;dt.fin.cashCloseLog=dt.fin.cashCloseLog||[];dt.fin.cashCloseLog.push({ym,ly:ly.trim(),by:ME.name,at:Date.now(),ban:c});delete dt.fin.cashClose[ym]});toast("Đã mở khóa");renderMain()}
/* Nhập số dư theo ngày cố định (mốc đầu kỳ 30/09 hoặc sao kê cuối tháng) cho các tài khoản 111 / 112 (và ví sàn khi là sao kê). */
function tlForm(ac,L,ngay,title,hint){
  openDrawerHTML(`<h2>${esc(title||"Cập nhật số dư")}</h2><p class="hint">${esc(hint||"Nhập số tiền đang có ở từng tài khoản. Để trống tài khoản nào thì giữ số cũ.")}</p><form class="frm" id="tlf"><label class="field">Số dư cuối ngày<input id="tlf-d" type="date" value="${ngay||mhToday()}" ${ngay?"readonly":""} required></label>
   ${ac.map(a=>`<label class="field">${esc(a.n)}<input type="number" step="1" data-tla="${esc(a.k)}" placeholder="${L[a.k]!=null?nf(L[a.k]):"chưa có"}"></label>`).join("")}
   <div id="tlf-e"></div><button class="btn pri">Lưu số dư</button></form>`);
  $("#tlf").onsubmit=e=>{e.preventDefault();const ngay=$("#tlf-d").value,vals=[...document.querySelectorAll("[data-tla]")].filter(i=>i.value!=="").map(i=>({acct:i.dataset.tla,tien:Math.round(+i.value)}));
    if(!vals.length){$("#tlf-e").innerHTML=`<div class="note red">Nhập ít nhất một tài khoản</div>`;return}
    DB.mutate(ME.name,"nhập số dư tiền ngày "+ngay,dt=>{dt.fin=dt.fin||{};dt.fin.balances=dt.fin.balances||[];vals.forEach(v=>dt.fin.balances.push({id:uid("sd"),ngay,acct:v.acct,tien:v.tien,by:ME.name}));
      /* đồng bộ sang Tổng quan › Tiền & cảnh báo (một nguồn số dư): ngân hàng + tiền mặt, ví TikTok, ví Shopee */
      if(typeof dhCfg==="function"){const c=dhCfg(dt.fin.dh),last={};dt.fin.balances.forEach(b=>{const x=last[b.acct];if(!x||b.ngay>=x.ngay)last[b.acct]=b});
        const bank=Object.entries(last).filter(([k])=>k!=="VI_TT"&&k!=="VI_SPE").reduce((t,[,b])=>t+(+b.tien||0),0);
        c.tien=c.tien.filter(x=>!(x.ngay===ngay&&x.src==="tl"));c.tien.push({id:uid("t"),ngay,tien:bank,viTT:last.VI_TT?+last.VI_TT.tien:0,viSPE:last.VI_SPE?+last.VI_SPE.tien:0,note:"từ Dòng tiền",by:ME.name,src:"tl"});dt.fin.dh=c}});
    closeDrawer();toast("Đã lưu số dư");renderMain()}}
/* ---------- Phiếu chuyển tiền nội bộ (CEO đồng ý 31/10) ----------
   Lưu ở D().fin.ck: {id,ngay,tu,den,tien,note,by,at}. Rút ngân hàng về quỹ tiền mặt, nộp tiền mặt vào ngân hàng, chuyển giữa hai
   tài khoản ngân hàng, rút tiền ví TikTok / Shopee về tài khoản. Chứng từ tính ở tcnCkDocs (tiencalc.js): giữa ngân hàng và tiền mặt
   thì công ty không thêm bớt tiền, chỉ đổi chỗ; ví sàn rút về là tiền vào (mã 01). */
function tlCkList(ed){const L=(((D().fin||{}).ck)||[]).slice().sort((a,b)=>a.ngay<b.ngay?1:-1).slice(0,30);if(!L.length)return "";
  return `<section class="card pad"><b>Chuyển tiền nội bộ gần đây</b><div class="nsw"><table class="tbl gd"><thead><tr><th>Ngày</th><th>Từ</th><th>Đến</th><th class="n">Số tiền</th><th>Ghi chú</th><th>Người ghi</th><th></th></tr></thead><tbody>${L.map(x=>`<tr><td>${tcnDd(x.ngay)}</td><td>${esc(tcnAcctTen(x.tu))}</td><td>${esc(tcnAcctTen(x.den))}</td><td class="n">${nf(x.tien)}</td><td class="gdd" title="${esc(x.note||"")}">${esc(x.note||"")}</td><td class="hint">${esc(x.by||"")}</td><td>${ed&&!tlKhoa(x.ngay)?`<button class="lnk" data-tlckx="${esc(x.id)}">Xóa</button>`:""}</td></tr>`).join("")}</tbody></table></div></section>`}
function tlCkForm(){const ac=tlAccts(),o=a=>`<option value="${esc(a.k)}">${esc(a.n)}</option>`,cash=ac.filter(a=>!TCN_VI.includes(a.k));
  openDrawerHTML(`<h2>Chuyển tiền nội bộ</h2><p class="hint">Ghi khi rút tiền ngân hàng về quỹ tiền mặt, nộp tiền mặt vào ngân hàng, chuyển giữa hai tài khoản công ty, hoặc rút tiền ví TikTok Shop / Shopee về tài khoản. Không phải thu chi: tiền chỉ đổi chỗ (riêng tiền ví sàn rút về được tính là tiền sàn về).</p>
  <form class="frm" id="tlck"><label class="field">Ngày<input id="tlck-d" type="date" value="${mhToday()}" required></label>
   <label class="field">Từ<select id="tlck-tu">${ac.map(o).join("")}</select></label>
   <label class="field">Đến<select id="tlck-den">${cash.map(o).join("")}</select></label>
   <label class="field">Số tiền (đ)<input id="tlck-t" type="number" min="1" step="1" required></label>
   <label class="field">Ghi chú<input id="tlck-n" placeholder="Ví dụ: rút tiền mặt trả lương thời vụ"></label>
   <div id="tlck-e"></div><button class="btn pri">Lưu phiếu</button></form>`);
  $("#tlck").onsubmit=e=>{e.preventDefault();const x={id:uid("ck"),ngay:$("#tlck-d").value,tu:$("#tlck-tu").value,den:$("#tlck-den").value,tien:Math.round(+$("#tlck-t").value),note:$("#tlck-n").value.trim(),by:ME.name,at:Date.now()};
    if(tlKhoa(x.ngay)){$("#tlck-e").innerHTML=`<div class="note red">Tháng ${x.ngay.slice(5,7)} đã chốt sổ. CEO mở khóa rồi mới ghi được.</div>`;return}
    if(x.tu===x.den){$("#tlck-e").innerHTML=`<div class="note red">Chọn hai tài khoản khác nhau</div>`;return}
    if(!(x.tien>0)){$("#tlck-e").innerHTML=`<div class="note red">Nhập số tiền</div>`;return}
    DB.mutate(ME.name,"ghi chuyển tiền nội bộ",dt=>{dt.fin=dt.fin||{};dt.fin.ck=dt.fin.ck||[];dt.fin.ck.push(x)});closeDrawer();toast("Đã ghi phiếu chuyển tiền");renderMain()}}
function tlCkXoa(id){const x=(((D().fin||{}).ck)||[]).find(y=>y.id===id);if(!x)return;
  if(!confirm(`Xóa phiếu chuyển ${nf(x.tien)} đ từ ${tcnAcctTen(x.tu)} sang ${tcnAcctTen(x.den)} ngày ${tcnDd(x.ngay)}? Chỉ xóa phiếu ghi nhầm.`))return;
  DB.mutate(ME.name,"xóa phiếu chuyển tiền nội bộ ("+nf(x.tien)+" đ, "+x.ngay+")",dt=>{dt.fin.ck=(dt.fin.ck||[]).filter(y=>y.id!==id)});toast("Đã xóa phiếu");renderMain()}

/* ---------- Trang ---------- */
const TL_CSS=`.tlchip{display:inline-block;font-size:11px;padding:0 7px;border-radius:999px;white-space:nowrap;background:#ecfdf3;color:#067647}.tlchip.no{background:#fffaeb;color:#b54708}
table.tllc tr.tlsec td{background:#f3f5f9;font-weight:600;color:#1f3a5f}table.tllc td.tlsub{padding-left:20px}table.tllc tr.tltot td{font-weight:700;border-top:1px solid #d0d5dd}table.tllc tr.tlgrand td{font-weight:700;background:#e6f5f3}
table.gd tr.tlon td{background:#eef4ff}.tldr{margin-top:10px;padding-top:8px;border-top:1px dashed #e3e8ef}.tlacts{display:inline-flex;gap:6px;flex-wrap:wrap;align-items:center}
.tlg2{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:12px}@media(max-width:900px){.tlg2{grid-template-columns:1fr}}table.gd select{font-size:12px;padding:2px 4px;max-width:200px}`;
function pTienLich(m){
  tlLoad();tcnLoad();if(typeof gdCss==="function")gdCss();
  if(!document.getElementById("tl-css")){const s=document.createElement("style");s.id="tl-css";s.textContent=TL_CSS;document.head.appendChild(s)}
  const T="Dòng tiền",S="Tiền đang có ở đâu, vào ra từng ngày, báo cáo lưu chuyển tiền tệ, tuần nào sắp thiếu";
  if(!tcnOk()){m.innerHTML=H(T,S)+`<div class="note">Chỉ CEO và kế toán xem trang này.</div>`;return}
  const ym0=PERIOD.to.slice(0,7),ym=ym0<"2026-10"?"2026-10":ym0,X=MH.accts&&MH.orders&&MH.inv&&MH.pay?tlDocs(ym):null;
  if(!X){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  const C=tlCtx(X,ym),tabs=[["tq","Tổng quan"],["so","Sổ tiền theo ngày"],["b03","Lưu chuyển tiền tệ B03"],["db","Dự báo & kế hoạch chi"],["chot","Đối chiếu & chốt sổ"]];
  if(!tabs.some(t=>t[0]===TL.tab))TL.tab="tq";
  let body="";try{body=TL.tab==="so"?tlTabSo(X,C,ym):TL.tab==="b03"?tlTabB03(X,C,ym):TL.tab==="db"?tlTabDb(X,C):TL.tab==="chot"?tlTabChot(X,C,ym):tlTabTq(X,C,ym)}catch(e){body=`<div class="note red">Lỗi tính: ${esc(e.message)}</div>`}
  m.innerHTML=H(T,S)+(X.err?`<div class="note red">Chưa tải được chứng từ tiền: ${esc(X.err)}</div>`:"")+(ym!==ym0?`<div class="note">Sổ tiền bắt đầu từ mốc 30/09/2026 nên đang xem tháng 10/2026.</div>`:"")+`<div class="tabs">${tabs.map(([k,n])=>`<button class="tab${TL.tab===k?" on":""}" data-tlt="${k}">${n}</button>`).join("")}</div>${body}
  <p class="hint pad">${tlVn(ym)} theo ô chọn kỳ trên cùng. Chỉ tính phiếu trên web, mốc đầu kỳ 30/09/2026. Định nghĩa từng chỉ số: Công nợ › Đối chiếu công nợ & tiền › Định nghĩa.</p>`;
  const go=t=>{TL.tab=t;try{localStorage.setItem("ailla_tl_tab2",t)}catch(e){}renderMain();scrollTo(0,0)};
  m.querySelectorAll("[data-tlt]").forEach(b=>b.onclick=()=>go(b.dataset.tlt));
  m.querySelectorAll("[data-tlt2]").forEach(b=>b.onclick=()=>go(b.dataset.tlt2));
  m.querySelectorAll("[data-tllc]").forEach(r=>r.onclick=()=>tlLcOpen(C,r.dataset.tllc,ym));
  m.querySelectorAll("[data-tlb03]").forEach(r=>r.onclick=()=>tlB03Open(C,ym,r.dataset.tlb03));
  m.querySelectorAll("[data-tlday]").forEach(r=>r.onclick=()=>{TL.day=r.dataset.tlday;renderMain()});
  const on=(id,f)=>{const el=m.querySelector(id);if(el)el.onclick=f};
  const sa=m.querySelector("#tl-acct");if(sa)sa.onchange=()=>{TL.acct=sa.value;TL.day="";renderMain()};
  on("#tl-tcp",()=>tlTcpForm(C));on("#tl-ck",()=>tlCkForm());on("#tl-plan",()=>tlPlanForm());on("#tl-xls",()=>tlXls(C,ym));
  on("#tl-moc",()=>tlForm(C.acc.map(a=>({k:a.k,n:a.tk+" · "+a.n})),C.moc,TCN_MOC,"Số dư đầu kỳ 30/09/2026","Số dư cuối ngày 30/09/2026 trên MISA (TK 111, từng TK 112). Nhập lại thì lấy lần nhập sau."));
  on("#tl-sk",()=>{const e=tlEnd(ym),ac=tlAccts();const L={};ac.forEach(a=>{const b=C.B.find(x=>x.acct===a.k&&x.ngay===e);if(b)L[a.k]=+b.tien});tlForm(ac,L,e,"Sao kê cuối "+tlVn(ym).toLowerCase(),"Số trên sao kê ngân hàng / kiểm quỹ tiền mặt cuối ngày "+tcnDd(e)+". Ví sàn nhập để theo dõi tiền chờ rút.")});
  on("#tl-chot",()=>tlChot(X,C,ym));
  m.querySelectorAll("[data-tlmo]").forEach(b=>b.onclick=()=>tlMoKhoa(b.dataset.tlmo));
  m.querySelectorAll("[data-tlckx]").forEach(b=>b.onclick=()=>tlCkXoa(b.dataset.tlckx));
  m.querySelectorAll("[data-tltx]").forEach(b=>b.onclick=()=>tlTcpXoa(b.dataset.tltx));
  m.querySelectorAll("[data-tlpd]").forEach(b=>b.onclick=()=>tlPlanSet(b.dataset.tlpd,p=>{p.st="DUYET";p.duyet=ME.name;p.duyetAt=Date.now()},"duyệt kế hoạch chi"));
  m.querySelectorAll("[data-tlpr]").forEach(b=>b.onclick=()=>{const d=prompt("Dời sang ngày (năm-tháng-ngày, ví dụ 2026-12-05)");if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d)){if(d)toast("Ngày chưa đúng dạng");return}tlPlanSet(b.dataset.tlpr,p=>{p.ngay=d},"dời kế hoạch chi sang "+d)});
  m.querySelectorAll("[data-tlpx]").forEach(b=>b.onclick=()=>tlPlanSet(b.dataset.tlpx,p=>{p.st="XONG";p.xongBy=ME.name;p.xongAt=Date.now()},"đóng kế hoạch chi"));
  tlGanBind(m);if(typeof gdBind==="function")gdBind(m)}
PAGES.tien_lich=pTienLich;
