/* =====================================================================
   DÒNG TIỀN (trang quản trị › Tài chính – Kế toán › Dòng tiền; khóa trang cũ tien_lich giữ nguyên để link cũ không gãy).
   Chị Hoa duyệt 31/10/2026 theo bản demo "Dòng tiền AILLA". Ba tab:
   1) Lưu chuyển tiền tệ (phương pháp trực tiếp) tháng của ô chọn kỳ + tháng trước: đầu kỳ, tiền vào, tiền ra, tiền kinh doanh
      tự sinh, cuối kỳ tính, lệch với số dư thật; thác nước; bảng I. Kinh doanh · II. Đầu tư · III. Tài chính; cầu nối lãi → tiền;
      xu hướng 6 tháng. Luật tính: tcnLctt (tiencalc.js), chứng từ: tcnDongTien (tiencn.js).
   2) Dự báo 4 tuần (thay "Lịch chi" cũ, phần trả nhà cung cấp theo hạn vẫn là tlSchedule): tiền đầu tuần, thu, chi, cuối tuần
      so với mức tối thiểu (ngưỡng ngày dự trữ × chi bình quân mỗi ngày).
   3) Số dư tài khoản: kế toán nhập mỗi thứ Hai (lưu từng lần ở D().fin.balances), so với số dư tính từ chứng từ.
   Dòng nào web chưa có chỗ ghi thì hiện "chưa có", KHÔNG ước số. Trang chỉ đọc, trừ form nhập số dư như cũ.
   ===================================================================== */
const TL={busy:false,tried:false,tab:"lc",dcm:{}};
try{const t=localStorage.getItem("ailla_tl_tab");if(t)TL.tab=t}catch(e){}
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
const tlTrS=v=>v==null?"—":(v>0?"+":"")+tlTr(v);
const tlVn=ym=>"Tháng "+ym.slice(5,7)+"/"+ym.slice(0,4);
const tlChip=ok=>ok?`<span class="tlchip ok">có trên web</span>`:`<span class="tlchip no">chưa có</span>`;
/* Tài khoản tiền (ngân hàng + tiền mặt), không gồm ví sàn. */
const tlCashAccts=X=>X.accounts.map(a=>a.id).concat(["TIEN_MAT"]);
/* Mọi chứng từ tiền từ đầu 6 tháng trước (hoặc từ lần nhập số dư sớm nhất) tới hết tháng đang xem / hôm nay. */
function tlDocs(ym){const B=(D().fin||{}).balances||[],f6=tlYmAdd(ym,-5)+"-01",b0=B.map(b=>b.ngay).sort()[0]||f6,today=mhToday(),end=tlEnd(ym);
  return tcnDongTien(b0<f6?b0:f6,end>today?end:today)}

/* ---------- Tab 1: Lưu chuyển tiền tệ ---------- */
function tlDcThang(ym){const k=ym,c=TL.dcm[k];if(c)return c.busy?null:c;TL.dcm[k]={busy:true};
  tcnApi(`/doi-chieu?from=${ym}-01&to=${tlEnd(ym)}`).then(r=>{TL.dcm[k]=r}).catch(e=>{TL.dcm[k]={err:e.message}}).finally(()=>{if(PAGE==="tien_lich")renderMain()});return null}
function tlCauNoi(ym,lcKd){
  let ln=null,kh=null,thu=null,tra=null;
  try{const P=plMonth(ym);if(P&&!P.loading)ln=P.ln}catch(e){}
  try{const r=typeof tsChiPhiThang==="function"?tsChiPhiThang(ym):null;if(r&&r.chay)kh=+r.tong||0}catch(e){}
  const dc=tlDcThang(ym);if(dc&&!dc.err){const s=(L,k)=>L.reduce((t,r)=>t+(+r[k]||0),0);thu=s(dc.khach,"cuoi")-s(dc.khach,"dau");tra=s(dc.ncc,"cuoi")-s(dc.ncc,"dau")}
  const R=[["Lợi nhuận hoạt động tháng (P&L công ty)",ln,"Lãi đóng góp các kênh − chi phí chung − chi phí Sản xuất"],
    ["+ Khấu hao, phân bổ công cụ",kh,kh==null?"Tài sản & CCDC chưa chạy khấu hao tháng này":"Tính vào chi phí nhưng không chi tiền ra"],
    ["− Khách nợ thêm (phải thu tăng)",thu==null?null:-thu,"Đã bán, đã tính lãi, chưa thu tiền (Kênh phân phối, Kênh OEM)"],
    ["− Hàng tồn kho tăng",null,"Chưa có: kho chưa có giá trị tồn đầu / cuối tháng"],
    ["+ Nợ nhà cung cấp tăng (phải trả tăng)",tra,"Đã nhận hàng, chưa trả tiền"]];
  const du=R.every((r,i)=>i===3||r[1]!=null),cn=du?R.reduce((t,r)=>t+(r[1]||0),0):null;
  return {R,cn,lcKd,chenh:cn==null?null:lcKd-cn,loading:!dc}}
function tlThacNuoc(dau,A,cuoi){
  const st=[["Đầu tháng",dau||0,"b"],["Thu KD",A.thu,"u"],["Chi KD",A.chiKd,"d"],["Đầu tư",A.dt,A.dt<0?"d":"u"],["Tài chính",A.tc,A.tc<0?"d":"u"],["Cuối tháng",cuoi||0,"b"]];
  let run=0;const bars=st.map(([n,v,t])=>{let a,b;if(t==="b"){a=0;b=v;run=v}else{a=run;b=run+v;run=b}return {n,v,t,lo:Math.min(a,b),hi:Math.max(a,b)}});
  const mx=Math.max(1,...bars.map(b=>b.hi)),mn=Math.min(0,...bars.map(b=>b.lo)),W=640,H=240,L=8,T=18,B=26,ph=H-T-B,bw=(W-L*2)/st.length,y=v=>T+(mx-v)/(mx-mn)*ph;
  let s=`<line x1="${L}" x2="${W-L}" y1="${y(0)}" y2="${y(0)}" stroke="#d0d5dd"/>`;
  bars.forEach((b,i)=>{const x=L+i*bw+bw*.18,w=bw*.64,c=b.t==="b"?"#1f3a5f":b.t==="u"?"#067647":"#b42318";
    s+=`<rect x="${x}" y="${y(b.hi)}" width="${w}" height="${Math.max(1,y(b.lo)-y(b.hi))}" fill="${c}" rx="3"/><text x="${x+w/2}" y="${y(b.hi)-5}" text-anchor="middle" font-size="11" fill="currentColor">${b.t==="b"?tlTr(b.v):tlTrS(b.v)}</text><text x="${x+w/2}" y="${H-8}" text-anchor="middle" font-size="11" fill="#667085">${b.n}</text>`});
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Thác nước dòng tiền tháng">${s}</svg>`}
function tlXuHuong(L){const W=640,H=180,T=18,B=24,ph=H-T-B,mx=Math.max(1,...L.map(x=>x.v)),mn=Math.min(0,...L.map(x=>x.v)),y=v=>T+(mx-v)/((mx-mn)||1)*ph,bw=W/L.length;
  let s=`<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="#d0d5dd"/>`;
  L.forEach((x,i)=>{const X=i*bw+bw*.25,w=bw*.5,top=Math.min(y(x.v),y(0)),h=Math.abs(y(x.v)-y(0));
    s+=`<rect x="${X}" y="${top}" width="${w}" height="${Math.max(1,h)}" fill="${x.v>=0?"#067647":"#b42318"}" rx="3"/><text x="${X+w/2}" y="${x.v>=0?top-5:top+h+12}" text-anchor="middle" font-size="11" fill="currentColor">${tlTrS(x.v)}</text><text x="${X+w/2}" y="${H-6}" text-anchor="middle" font-size="11" fill="#667085">${x.n}</text>`});
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Tiền kinh doanh 6 tháng">${s}</svg>`}
function tlTabLc(X,ym){
  const B=(D().fin||{}).balances||[],cash=tlCashAccts(X),pm=tlYmAdd(ym,-1),f=ym+"-01",e=tlEnd(ym),today=mhToday();
  const A=tcnLctt(X.docs,f,e),Ap=tcnLctt(X.docs,pm+"-01",tlEnd(pm));
  const dauO=tcnSoDuCong(B,cash,tcnPrevDay(f)),dau=dauO.tien,dauP=tcnSoDuCong(B,cash,tcnPrevDay(pm+"-01")).tien;
  const cuoi=dau==null?null:dau+A.net,cuoiP=dauP==null?null:dauP+Ap.net;
  /* Số dư thật cuối kỳ: lần nhập mới nhất trong tháng; so với số dư tính tới đúng ngày đó. */
  const inM=B.filter(b=>cash.includes(b.acct)&&b.ngay>=f&&b.ngay<=e).map(b=>b.ngay).sort().pop()||"";
  const that=inM?tcnSoDuCong(B,cash,inM):null,tinhAt=dau==null||!inM?null:dau+tcnLctt(X.docs,f,inM).net,lech=that&&that.tien!=null&&tinhAt!=null?that.tien-tinhAt:null;
  const mn=n=>n.thieu.length?` · thiếu số dư ${n.thieu.length} tài khoản`:"";
  const kp=`<div class="grid kpis">${kpi("Tiền đầu tháng "+tcnDd(f).slice(0,5),dau==null?"—":tlTr(dau)+" tr",dau==null?"chưa nhập số dư trước ngày "+tcnDd(f):"số dư kế toán nhập"+mn(dauO))}${kpi("Tiền vào trong tháng",tlTr(A.vao)+" tr","chứng từ thu đã xác nhận")}${kpi("Tiền ra trong tháng",tlTr(A.ra)+" tr","chứng từ chi đã duyệt (cả khoản chờ CEO duyệt)")}${kpi("Tiền kinh doanh tự sinh",tlTrS(A.kd)+" tr",A.kd>=0?"kinh doanh tự nuôi được":"đang ăn vào tiền dự trữ",A.kd<0?"var(--red)":"")}${kpi("Tiền cuối tháng (tính)",cuoi==null?"—":tlTr(cuoi)+" tr",cuoi==null?"cần số dư đầu tháng":"đầu tháng + vào − ra")}${kpi("Lệch với số dư thật",lech==null?"—":tlTrS(lech)+" tr",lech==null?(inM?"cần số dư đầu tháng":"chưa nhập số dư trong tháng"):"số thật "+tlTr(that.tien)+" tr ngày "+tcnDd(inM)+" · phần web chưa có chứng từ",lech!=null&&Math.abs(lech)>5e6?"var(--amb,#b54708)":"")}</div>`;
  const ln=r=>{const a=A.v[r[0]],b=Ap.v[r[0]];return `<tr class="clk" data-tllc="${r[0]}"><td class="tlsub">${esc(r[3])}</td><td class="n">${a==null?"—":tlTr(a)}</td><td class="n">${b==null?"—":tlTr(b)}</td><td>${tlChip(r[5])} <span class="hint">${esc(r[4])}</span></td></tr>`};
  const tot=(n,a,b,c)=>`<tr class="${c||"tltot"}"><td>${n}</td><td class="n">${tlTrS(a)}</td><td class="n">${tlTrS(b)}</td><td></td></tr>`;
  const grp=(g,dir)=>TCN_LC.filter(r=>r[1]===g&&(!dir||r[2]===dir)).map(ln).join("");
  const rows=`<tr class="tlsec"><td colspan="4">I. Tiền từ hoạt động kinh doanh</td></tr><tr><td colspan="4" class="hint">Tiền vào</td></tr>${grp("KD","thu")}<tr><td colspan="4" class="hint">Tiền ra</td></tr>${grp("KD","chi")}${tot("Tiền thuần từ kinh doanh",A.kd,Ap.kd)}
    <tr class="tlsec"><td colspan="4">II. Tiền từ hoạt động đầu tư</td></tr>${grp("DT")}${tot("Tiền thuần từ đầu tư",A.dt,Ap.dt)}
    <tr class="tlsec"><td colspan="4">III. Tiền từ hoạt động tài chính</td></tr>${grp("TC")}${tot("Tiền thuần từ tài chính",A.tc,Ap.tc)}
    ${tot("Tiền tăng / giảm trong tháng",A.net,Ap.net,"tlgrand")}
    <tr><td>Tiền đầu tháng</td><td class="n">${tlTr(dau)}</td><td class="n">${tlTr(dauP)}</td><td>${tlChip(1)} <span class="hint">Số dư kế toán nhập (ngân hàng + tiền mặt, không gồm ví sàn)</span></td></tr>
    <tr class="tltot"><td>Tiền cuối tháng (tính)</td><td class="n">${tlTr(cuoi)}</td><td class="n">${tlTr(cuoiP)}</td><td></td></tr>`;
  const C=tlCauNoi(ym,A.kd);
  const br=C.R.map(r=>`<div class="tlbr"><span>${esc(r[0])}</span><b class="${r[1]!=null&&r[1]<0?"t-red":""}">${r[1]==null?"chưa có":tlTrS(r[1])}</b><small>${esc(r[2])}</small></div>`).join("")
    +`<div class="tlbr tlbrt"><span>= Tiền kinh doanh theo lãi</span><b>${C.cn==null?(C.loading?"đang tải…":"chưa đủ số"):tlTrS(C.cn)}</b></div><div class="tlbr"><span>Tiền kinh doanh theo chứng từ (bảng dưới)</span><b>${tlTrS(A.kd)}</b>${C.chenh!=null?`<small>Chênh ${tlTrS(C.chenh)} tr: phần web chưa có chứng từ (tiền sàn, COD Facebook về tài khoản, thuế, tồn kho…), không phải tiền mất.</small>`:""}</div>`;
  const tr6=[];for(let i=5;i>=0;i--){const y=tlYmAdd(ym,-i);tr6.push({n:"T"+(+y.slice(5,7)),v:tcnLctt(X.docs,y+"-01",tlEnd(y)).kd})}
  return kp+`<div class="tlg2"><section class="card pad"><b>Tiền ${tlVn(ym).toLowerCase()} đi thế nào</b><p class="hint">Từ số dư đầu tháng, cộng tiền vào, trừ tiền ra theo ba nhóm hoạt động, ra số dư cuối tháng. Đơn vị: triệu đồng.${dau==null?" Chưa có số dư đầu tháng nên cột đầu, cuối để 0.":""}</p>${tlThacNuoc(dau,A,cuoi)}</section>
   <section class="card pad"><b>Vì sao lãi mà tiền không tăng bằng</b><p class="hint">Nối từ Lãi lỗ ${tlVn(ym).toLowerCase()} sang tiền kinh doanh. Đơn vị: triệu đồng.</p>${br}</section></div>
   <section class="card pad"><b>Báo cáo lưu chuyển tiền tệ (phương pháp trực tiếp)</b><p class="hint">Đơn vị: triệu đồng. Theo khung mẫu B03-DN, gom thành dòng dễ đọc. Bấm một dòng để xem từng chứng từ.</p>
   <div class="nsw"><table class="tbl gd tllc"><thead><tr><th>Khoản mục</th><th class="n">${tlVn(ym)}</th><th class="n">${tlVn(pm)}</th><th>Lấy số ở đâu</th></tr></thead><tbody>${rows}</tbody></table></div>
   <p class="hint">"Chưa có" là dòng web chưa có chỗ ghi chứng từ nên để trống, không ước số. Tiền sàn và COD Facebook về tài khoản: kế toán ghi phiếu thu ở Sổ thu, nguồn "Tiền sàn rút về" (hiện chưa tách từng sàn).</p></section>
   <section class="card pad"><b>Tiền kinh doanh 6 tháng</b><p class="hint">Cột xanh: tháng kinh doanh tự sinh ra tiền. Cột đỏ: tháng phải lấy tiền dự trữ ra bù. Chỉ tính chứng từ đã có trên web.</p>${tlXuHuong(tr6)}</section>`}
function tlLcOpen(X,key,ym){const r=TCN_LC.find(x=>x[0]===key);if(!r)return;const f=ym+"-01",e=tlEnd(ym),L=X.docs.filter(d=>d.date>=f&&d.date<=e&&tcnLcKey(d)===key);
  openDrawerHTML(`<h2>${esc(r[3])}</h2><p class="hint">${tlVn(ym)} · ${esc(r[4])}</p>${!r[5]?`<div class="note">Web chưa có chỗ ghi khoản này nên chưa có số.</div>`:L.length?tcnGd(["Ngày","Loại","Chứng từ","Bên kia","Liên quan","Tài khoản","Số tiền"],L.map(d=>`<tr><td>${tcnDd(d.date)}</td><td>${esc(TCN_LOAI[d.loai]||d.loai)}${d.ceo==="CHO"?" "+pill("chờ CEO duyệt","amb"):""}</td><td class="mono">${esc(d.ref||"")}</td><td class="gdd" title="${esc(d.party||"")}">${esc(d.party||"")}</td><td>${tcnDon(d.lq)}</td><td class="gdd hint" title="${esc(d.acct_text||"")}">${esc(d.acct_text||"")}</td><td class="n">${nf(tcnR(d.amount))}</td></tr>`))+`<p class="hint">Cộng ${L.length} chứng từ: <b>${nf(tcnR(L.reduce((t,d)=>t+d.amount,0)))}</b> đ</p>`:`<p class="empty">Không có chứng từ trong tháng.</p>`}`);tcnBindDr()}

/* ---------- Tab 2: Dự báo 4 tuần ---------- */
function tlTabDb(X){
  const B=(D().fin||{}).balances||[],today=mhToday(),wk=tcnTuan(today),cash=tlCashAccts(X),S4=tlSchedule();
  const st=tcnSoDuCong(B,cash,today),vi=["VI_TT","VI_SPE"].map(a=>tcnSoDu(B,a,today)).filter(Boolean),viT=vi.reduce((t,b)=>t+(+b.tien||0),0);
  const bud=g=>ym=>{const o=((D().fin||{}).budgets||{})[ym]||{};return Object.entries(o).filter(([k])=>g.includes(k.split("||")[0])).reduce((t,[,v])=>t+(+v||0),0)};
  const hasBud=g=>wk.some(w=>[w.tu.slice(0,7),w.den.slice(0,7)].some(ym=>bud(g)(ym)>0));
  const G_QC=["Marketing"],G_KHAC=["Vận hành","Logistics","Bán hàng","Tài chính","Khác"];
  /* Lương trả ngày 10: bảng lương đã chốt của tháng trước ngày 10 đó. */
  const lg=[0,0,0,0];let lgNote="",lgOk=false;
  wk.forEach((w,i)=>{for(let d=new Date(w.tu+"T00:00:00Z");d.toISOString().slice(0,10)<=w.den;d.setUTCDate(d.getUTCDate()+1)){if(d.getUTCDate()!==10)continue;const pm=tlYmAdd(d.toISOString().slice(0,7),-1);
    try{const R=typeof cpLgRows==="function"?cpLgRows(pm):null;if(R&&R.ok&&R.chot){lg[i]+=R.rows.reduce((t,r)=>t+(+r.tong||0),0);lgOk=true;lgNote="bảng lương "+pm.slice(5)+"/"+pm.slice(0,4)+" đã chốt, trả ngày 10"}else lgNote="bảng lương "+pm.slice(5)+"/"+pm.slice(0,4)+" chưa chốt"}catch(e){lgNote="chưa đọc được bảng lương"}}});
  const thu=[{n:"Khách Kênh phân phối, Kênh OEM trả nợ đến hạn",v:null,s:"chưa có: chị chưa chốt số ngày khách được nợ nên chưa có hạn"},
    {n:"Tiền ví sàn chờ rút (TikTok, Shopee)",v:vi.length?[viT,0,0,0]:null,s:vi.length?"số dư ví kế toán nhập; ngày sàn trả chưa biết, xếp tuần 1":"chưa nhập số dư ví sàn"},
    {n:"COD Facebook về",v:null,s:"chưa có chứng từ tiền COD về tài khoản"}];
  const chi=[{n:"Trả nhà cung cấp đến hạn",v:[S4.W[0].sum+S4.late.sum,S4.W[1].sum,S4.W[2].sum,S4.W[3].sum],s:"Mua hàng, theo hạn trả từng đơn mua"+(S4.late.sum?" · tuần 1 gồm "+tlTr(S4.late.sum)+" tr quá hạn":"")+(S4.unk.sum?" · chưa rõ ngày trả "+tlTr(S4.unk.sum)+" tr (không xếp tuần)":"")},
    {n:"Lương",v:lgOk?lg:null,s:lgNote||"không có ngày 10 trong 4 tuần"},
    {n:"Thuế",v:null,s:"chưa có: web chưa có lịch nộp thuế"},
    {n:"Quảng cáo",v:hasBud(G_QC)?tcnChiaTuan(wk,bud(G_QC)):null,s:hasBud(G_QC)?"Ngân sách nhóm Marketing chia đều theo ngày":"chưa đặt Ngân sách nhóm Marketing"},
    {n:"Chi cố định, vận hành khác",v:hasBud(G_KHAC)?tcnChiaTuan(wk,bud(G_KHAC)):null,s:hasBud(G_KHAC)?"Ngân sách các nhóm Vận hành, Logistics, Bán hàng, Tài chính, Khác chia theo ngày":"chưa đặt Ngân sách các nhóm này"}];
  let cb={v:0};try{cb=tcnChiBq()}catch(e){}
  const runway=(typeof dhGet==="function"&&D().fin?dhGet().nguong.runway:30)||30,min=cb.v>0?Math.round(runway*cb.v):0;
  const F=tcnDuBao(st.tien,thu,chi,min),wl=wk.map(w=>tcnDd(w.tu).slice(0,5)+"–"+tcnDd(w.den).slice(0,5));
  const cell=v=>`<td class="n">${v==null?"—":v===0?"–":tlTr(v)}</td>`,ro=(r,neg)=>`<tr><td class="tlsub">${esc(r.n)} <span class="hint">${esc(r.s)}</span></td>${r.v==null?`<td colspan="4" class="hint">${tlChip(0)}</td>`:r.v.map(v=>cell(neg?-v:v)).join("")}</tr>`;
  const chip=s=>s==="THIEU"?pill("Thiếu","red"):s==="SAT"?pill("Sát mức","amb"):s==="DU"?pill("Đủ","grn"):`<span class="hint">—</span>`;
  const low=F.st.map((s,i)=>[s,i]).filter(x=>x[0]==="THIEU"||x[0]==="SAT");
  const warn=st.tien==null?`<div class="note">Chưa có số dư ngân hàng + tiền mặt nên chưa tính được tiền đầu tuần. Kế toán nhập ở tab Số dư tài khoản.</div>`
    :low.length?`<div class="note red"><b>Tuần ${low[0][1]+1} (${wl[low[0][1]]}) tiền cuối tuần còn ${tlTr(F.close[low[0][1]])} tr, ${F.st[low[0][1]]==="THIEU"?"dưới":"sát"} mức tối thiểu ${tlTr(min)} tr.</b> Chi lớn nhất tuần đó: ${esc(chi.filter(r=>r.v).sort((a,b)=>b.v[low[0][1]]-a.v[low[0][1]])[0].n.toLowerCase())}. Dòng thu "chưa có" chưa được cộng nên số thật có thể khá hơn.</div>`:"";
  const det=(title,w)=>w.rows.length?`<tr class="tlsec"><td colspan="4">${title} · ${nf(w.sum)} đ</td></tr>`+w.rows.map(r=>`<tr><td class="gdd" title="${esc(r.sup)}">${esc(r.sup)}</td><td>${r.no?tcnDon(r.no):"—"}</td><td>${r.due?esc(mhDM(r.due)):"—"}</td><td class="n">${nf(r.left)}</td></tr>`).join(""):"";
  return `<div class="note"><b>Thay cho "Lịch chi" cũ.</b> Lịch chi cũ chỉ có tiền trả nhà cung cấp; bảng dưới gộp cả tiền sắp thu và các khoản chi khác để biết tuần nào thiếu tiền. Dòng "chưa có" là web chưa có số, không ước.</div>${warn}
  <section class="card pad"><b>Dự báo tiền 4 tuần tới</b><p class="hint">Bắt đầu từ số dư ngân hàng + tiền mặt kế toán nhập gần nhất${st.co?"":" (chưa có)"}. Mức tối thiểu cần giữ: ${min?`<b>${tlTr(min)} tr</b> (${runway} ngày × chi bình quân ${nf(Math.round(cb.v))} đ/ngày, ngưỡng ở Cấu hình › Ngưỡng cảnh báo)`:"chưa tính được (chưa có số chi bình quân)"}. Đơn vị: triệu đồng.</p>
  <div class="nsw"><table class="tbl gd tllc"><thead><tr><th>Tuần</th>${wl.map((w,i)=>`<th class="n">Tuần ${i+1} · ${w}</th>`).join("")}</tr></thead><tbody>
  <tr class="tltot"><td>Tiền đầu tuần</td>${F.open.map(cell).join("")}</tr>
  <tr class="tlsec"><td colspan="5">Tiền sắp vào</td></tr>${thu.map(r=>ro(r)).join("")}<tr class="tltot"><td>Cộng tiền vào</td>${F.ti.map(cell).join("")}</tr>
  <tr class="tlsec"><td colspan="5">Tiền phải ra</td></tr>${chi.map(r=>ro(r,true)).join("")}<tr class="tltot"><td>Cộng tiền ra</td>${F.ci.map(v=>cell(-v)).join("")}</tr>
  <tr class="tlgrand"><td>Tiền cuối tuần</td>${F.close.map(cell).join("")}</tr>
  <tr><td>So với mức tối thiểu</td>${F.st.map(s=>`<td class="n">${chip(s)}</td>`).join("")}</tr></tbody></table></div></section>
  <section class="card pad"><b>Trả nhà cung cấp theo hạn (chi tiết dòng "Trả nhà cung cấp đến hạn")</b>
  ${S4.late.rows.length||S4.W.some(w=>w.rows.length)||S4.unk.rows.length?`<div class="nsw"><table class="tbl gd"><thead><tr><th>Nhà cung cấp</th><th>Liên quan</th><th>Hạn trả</th><th class="n">Còn phải trả</th></tr></thead><tbody>${det("Quá hạn",S4.late)}${S4.W.map((w,i)=>det("Tuần "+(i+1)+" · "+wl[i],w)).join("")}${det("Chưa rõ ngày trả",S4.unk)}</tbody></table></div>`:`<p class="empty">Không còn khoản phải trả nhà cung cấp nào.</p>`}</section>`}

/* ---------- Tab 3: Số dư tài khoản ---------- */
function tlTabSd(X){
  const ed=mhManage()||can(ME,"chiphi.nhap"),ac=tlAccts(),Lt=tlLatest(),B=(D().fin||{}).balances||[],today=mhToday();
  const have=ac.some(a=>Lt[a.k]),lastD=ac.map(a=>Lt[a.k]&&Lt[a.k].ngay).filter(Boolean).sort().pop()||"",stale=lastD?tlDays(lastD,today):null;
  let T=null;try{T=tcnTien()}catch(e){}
  const rows=ac.map(a=>{const b=Lt[a.k],vi=a.k==="VI_TT"||a.k==="VI_SPE";if(!b)return {a,b:null};
    const prev=B.filter(x=>x.acct===a.k&&(x.ngay<b.ngay)).sort((x,y)=>x.ngay<y.ngay?1:-1)[0]||null;
    const s=vi||!prev?null:tcnSoDuTinh(prev,X.docs.filter(d=>d.acct===a.k),b.ngay);return {a,b,prev,s,lech:s&&s.tinh!=null?(+b.tien||0)-s.tinh:null,vi}});
  const sum=k=>rows.reduce((t,r)=>t+(r[k]!=null?+r[k]:0),0);
  return `<div class="grid kpis">${kpi("Tiền đang có",have?nf(Math.round(T&&T.now?T.now.co:0)):"—",have?"ngân hàng, tiền mặt, ví sàn · cập nhật "+kDd(lastD)+(stale>7?" · đã "+stale+" ngày chưa cập nhật":""):"chưa nhập số dư")}${kpi("Đủ dùng khoảng",T&&T.R.ngay!=null?T.R.ngay+" ngày":"—",T&&T.cb.v>0?"chi bình quân "+nf(Math.round(T.cb.v))+" đ/ngày ("+T.cb.src+")":"chưa có số chi tháng trước")}</div>
  <section class="card pad"><div class="tlh"><b>Số dư từng tài khoản</b>${ed?`<button class="btn pri sm" id="tl-up">Cập nhật số dư</button>`:""}</div>
  <p class="hint">Kế toán nhập mỗi sáng thứ Hai. Số dư tính = lần nhập trước + thu − chi theo chứng từ trên web tới ngày nhập lần này; lệch là khoản chưa ghi chứng từ (tiền sàn, COD về, phí ngân hàng…) hoặc ghi sai tài khoản.</p>
  <div class="nsw"><table class="tbl gd"><thead><tr><th>Tài khoản</th><th class="n">Số dư nhập</th><th>Ngày nhập</th><th class="n">Số dư tính</th><th class="n">Lệch</th><th>Liên quan</th></tr></thead><tbody>${rows.map(r=>{const b=r.b;if(!b)return `<tr><td>${esc(r.a.n)}</td><td class="n">—</td><td class="hint">chưa nhập</td><td class="n">—</td><td class="n">—</td><td></td></tr>`;
    return `<tr><td>${esc(r.a.n)}</td><td class="n">${nf(b.tien)}</td><td>${esc(kDd(b.ngay))}${b.by?` <small class="hint">· ${esc(b.by)}</small>`:""}</td><td class="n">${r.vi?`<span class="hint">ví sàn, không theo chứng từ</span>`:r.s&&r.s.tinh!=null?nf(tcnR(r.s.tinh))+` <small class="hint">từ ${tcnDd(r.prev.ngay)}</small>`:`<span class="hint">cần lần nhập trước</span>`}</td><td class="n">${r.lech==null?"—":Math.abs(r.lech)<1?pill("Khớp","grn"):`<b style="color:var(--red)">${nf(tcnR(r.lech))}</b>`}</td><td>${!r.vi?tcnLk("Chứng từ",`data-tlsd="${esc(r.a.k)}"`,"Xem thu chi của tài khoản"):""}</td></tr>`}).join("")}
   <tr class="tltot"><td>Cộng</td><td class="n">${nf(Math.round(rows.reduce((t,r)=>t+(r.b?+r.b.tien||0:0),0)))}</td><td></td><td></td><td class="n">${rows.some(r=>r.lech!=null)?nf(tcnR(sum("lech"))):"—"}</td><td></td></tr></tbody></table></div>
  <p class="hint">Mỗi lần cập nhật được lưu lại; số mới nhất của từng tài khoản dùng để tính tiền đang có, đủ dùng bao lâu và dự báo. Đối chiếu theo kỳ: Công nợ › Đối chiếu công nợ & tiền › Tài khoản tiền.</p></section>`}
function tlSdOpen(X,k){const a=tlAccts().find(x=>x.k===k);const L=X.docs.filter(d=>d.acct===k).slice(-200).reverse();
  openDrawerHTML(`<h2>${esc(a?a.n:k)}</h2><p class="hint">Thu chi theo chứng từ trên web, mới nhất trước (tối đa 200 dòng).</p>${L.length?tcnGd(["Ngày","Loại","Chứng từ","Bên kia","Liên quan","Số tiền"],L.map(d=>`<tr><td>${tcnDd(d.date)}</td><td>${esc(TCN_LOAI[d.loai]||d.loai)}</td><td class="mono">${esc(d.ref||"")}</td><td class="gdd" title="${esc(d.party||"")}">${esc(d.party||"")}</td><td>${tcnDon(d.lq)}</td><td class="n">${nf(tcnR(d.amount))}</td></tr>`)):`<p class="empty">Chưa có chứng từ nào ghi tài khoản này.</p>`}`);tcnBindDr()}

/* ---------- Trang ---------- */
const TL_CSS=`.tlchip{display:inline-block;font-size:11px;padding:0 7px;border-radius:999px;white-space:nowrap}.tlchip.ok{background:#ecfdf3;color:#067647}.tlchip.no{background:#fffaeb;color:#b54708}
table.tllc tr.tlsec td{background:#f3f5f9;font-weight:600;color:#1f3a5f}table.tllc td.tlsub{padding-left:20px}table.tllc tr.tltot td{font-weight:700;border-top:1px solid #d0d5dd}table.tllc tr.tlgrand td{font-weight:700;background:#e6f5f3}
.tlg2{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:12px}@media(max-width:900px){.tlg2{grid-template-columns:1fr}}
.tlbr{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:6px 0;border-bottom:1px dashed #e3e8ef;font-size:13px}.tlbr small{grid-column:1/-1;color:#667085;font-size:12px}.tlbrt{font-weight:700;border-bottom:0}`;
function pTienLich(m){
  tlLoad();tcnLoad();if(typeof gdCss==="function")gdCss();
  if(!document.getElementById("tl-css")){const s=document.createElement("style");s.id="tl-css";s.textContent=TL_CSS;document.head.appendChild(s)}
  const T="Dòng tiền",S="Tiền vào từ đâu, ra đi đâu, còn bao nhiêu, mấy tuần tới có thiếu không";
  if(!tcnOk()){m.innerHTML=H(T,S)+`<div class="note">Chỉ CEO và kế toán xem trang này.</div>`;return}
  const ym=PERIOD.to.slice(0,7),X=MH.accts&&MH.orders&&MH.inv&&MH.pay?tlDocs(ym):null;
  if(!X){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  const tabs=[["lc","Lưu chuyển tiền tệ"],["db","Dự báo 4 tuần"],["sd","Số dư tài khoản"]];
  let body="";try{body=TL.tab==="db"?tlTabDb(X):TL.tab==="sd"?tlTabSd(X):tlTabLc(X,ym)}catch(e){body=`<div class="note red">Lỗi tính: ${esc(e.message)}</div>`}
  m.innerHTML=H(T,S)+(X.err?`<div class="note red">Chưa tải được chứng từ tiền: ${esc(X.err)}</div>`:"")+`<div class="tabs">${tabs.map(([k,n])=>`<button class="tab${TL.tab===k?" on":""}" data-tlt="${k}">${n}</button>`).join("")}</div>${body}
  <p class="hint pad">${TL.tab==="lc"?"Tháng theo ô chọn kỳ trên cùng ("+tlVn(ym)+"). ":""}Định nghĩa từng chỉ số: Công nợ › Đối chiếu công nợ & tiền › Định nghĩa.</p>`;
  m.querySelectorAll("[data-tlt]").forEach(b=>b.onclick=()=>{TL.tab=b.dataset.tlt;try{localStorage.setItem("ailla_tl_tab",TL.tab)}catch(e){}renderMain()});
  m.querySelectorAll("[data-tllc]").forEach(r=>r.onclick=()=>tlLcOpen(X,r.dataset.tllc,ym));
  m.querySelectorAll("[data-tlsd]").forEach(el=>el.onclick=ev=>{ev.stopPropagation();tlSdOpen(X,el.dataset.tlsd)});
  const up=m.querySelector("#tl-up");if(up)up.onclick=()=>tlForm(tlAccts(),tlLatest());
  if(typeof gdBind==="function")gdBind(m)}
function tlForm(ac,L){
  openDrawerHTML(`<h2>Cập nhật số dư</h2><p class="hint">Nhập số tiền đang có ở từng tài khoản. Để trống tài khoản nào thì giữ số cũ.</p><form class="frm" id="tlf"><label class="field">Số dư tính tới ngày<input id="tlf-d" type="date" value="${mhToday()}" required></label>
   ${ac.map(a=>`<label class="field">${esc(a.n)}<input type="number" min="0" step="1" data-tla="${esc(a.k)}" placeholder="${L[a.k]?nf(L[a.k].tien):"chưa có"}"></label>`).join("")}
   <div id="tlf-e"></div><button class="btn pri">Lưu số dư</button></form>`);
  $("#tlf").onsubmit=e=>{e.preventDefault();const ngay=$("#tlf-d").value,vals=[...document.querySelectorAll("[data-tla]")].filter(i=>i.value!=="").map(i=>({acct:i.dataset.tla,tien:Math.round(+i.value)}));
    if(!vals.length){$("#tlf-e").innerHTML=`<div class="note red">Nhập ít nhất một tài khoản</div>`;return}
    DB.mutate(ME.name,"cập nhật số dư",dt=>{dt.fin=dt.fin||{};dt.fin.balances=dt.fin.balances||[];vals.forEach(v=>dt.fin.balances.push({id:uid("sd"),ngay,acct:v.acct,tien:v.tien,by:ME.name}));
      /* đồng bộ sang Tổng quan › Tiền & cảnh báo (một nguồn số dư): ngân hàng + tiền mặt, ví TikTok, ví Shopee */
      if(typeof dhCfg==="function"){const c=dhCfg(dt.fin.dh),last={};dt.fin.balances.forEach(b=>{const x=last[b.acct];if(!x||b.ngay>=x.ngay)last[b.acct]=b});
        const bank=Object.entries(last).filter(([k])=>k!=="VI_TT"&&k!=="VI_SPE").reduce((t,[,b])=>t+(+b.tien||0),0);
        c.tien=c.tien.filter(x=>!(x.ngay===ngay&&x.src==="tl"));c.tien.push({id:uid("t"),ngay,tien:bank,viTT:last.VI_TT?+last.VI_TT.tien:0,viSPE:last.VI_SPE?+last.VI_SPE.tien:0,note:"từ Dòng tiền › Số dư tài khoản",by:ME.name,src:"tl"});dt.fin.dh=c}});
    closeDrawer();toast("Đã lưu số dư");renderMain()}}
PAGES.tien_lich=pTienLich;
