/* =====================================================================
   TIỀN & CÔNG NỢ DÙNG CHUNG HAI WEB (chuẩn hóa 27/10/2026). Định nghĩa chỉ số: đầu file tiencalc.js.
   Một nguồn số:
   - Máy chủ /api/hub/dieuhanh/tien (src/server/routes/tienCongNo.ts): phải thu theo kênh + tuổi nợ + DSO (cùng /api/debts/aging),
     phải trả nhà cung cấp + tuổi nợ (cùng Mua hàng), đối chiếu từng khách / nhà cung cấp, chứng từ tiền trên web theo tài khoản.
   - Ngăn tài chính (D().fin, D().thuTay): số dư kế toán nhập (Dòng tiền), phiếu thu Sổ thu đã xác nhận, dòng tiền thật Sổ chi phí.
   Các trang chỉ đọc từ đây: Dòng tiền (tien_lich), Phải thu (phai_thu), Công nợ OEM (gc_cn), Tổng quan công ty (ô Sức khỏe,
   tab Tiền), trang mới Đối chiếu công nợ & tiền (tcn_dc, quản trị › Tài chính – Kế toán › Công nợ).
   Trang này chỉ ĐỌC: không sửa tiền, công nợ, phiếu thu chi nào.
   ===================================================================== */
const TCN={th:null,thAt:0,busy:false,err:"",dc:null,dcKey:"",dt:{},tab:"kh",q:"",kenh:"",lech:false,pg:{}};
const tcnOk=()=>typeof dhOk==="function"&&!!dhOk();
const tcnApi=p=>svApi("/api/hub/dieuhanh/tien"+p);
const TCN_PAGES=["tien_lich","phai_thu","gc_cn","exec","dieuhanh","tcn_dc","bc_b2b"];
const tcnRe=()=>{if(TCN_PAGES.includes(PAGE)&&!(typeof svTyping==="function"&&svTyping())&&!document.querySelector("#drawer:not([hidden])"))renderMain()};
const tcnPrevDay=d=>{const x=new Date(d+"T00:00:00Z");x.setUTCDate(x.getUTCDate()-1);return x.toISOString().slice(0,10)};
const tcnDd=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"—";
const TCN_SRC={
  thu:"Nguồn: công nợ chính thức (đơn đã giao/xuất + kế toán xác nhận − tiền đã xác nhận − hàng trả lại đã giảm nợ). Đối chiếu từng khách: quản trị › Tài chính – Kế toán › Công nợ › Đối chiếu công nợ & tiền.",
  tra:"Nguồn: Mua hàng (đầu kỳ + hóa đơn + phiếu mua chưa chứng từ − đã chi). Đối chiếu: Đối chiếu công nợ & tiền › Nhà cung cấp.",
  tien:"Nguồn: số dư kế toán nhập ở Dòng tiền (mới nhất từng tài khoản). So với số dư tính từ chứng từ: Đối chiếu công nợ & tiền › Tài khoản tiền."};

/* ---------- Nạp số ---------- */
function tcnLoad(force){
  if(!tcnOk()||TCN.busy||(!force&&TCN.th&&Date.now()-TCN.thAt<60000))return;TCN.busy=true;
  tcnApi("/tong-hop").then(r=>{TCN.th=r;TCN.err="";if(typeof PT!=="undefined")PT.d=r.khach}).catch(e=>{TCN.err=e.message||"Không tải được công nợ"})
    .finally(()=>{TCN.thAt=Date.now();TCN.busy=false;tcnRe()})}
/* Chứng từ tiền trên web trong khoảng ngày (máy chủ), nạp một lần mỗi khoảng. */
function tcnDongTienWeb(from,to){const k=from+"|"+to,c=TCN.dt[k];if(c)return c.busy?null:c;TCN.dt[k]={busy:true};
  tcnApi(`/dong-tien?from=${from}&to=${to}`).then(r=>{TCN.dt[k]=r}).catch(e=>{TCN.dt[k]={err:e.message,accounts:[],docs:[]}}).finally(tcnRe);return null}
/* Chứng từ tiền nằm trong ngăn tài chính: phiếu thu Sổ thu đã xác nhận, dòng tiền thật (TK 111/112) Sổ chi phí. */
function tcnDocsSo(from,to,accts){const d=D(),f=d.fin||{},o=[];
  (d.thuTay||[]).forEach(x=>{const n=x.ngay||"";if(n>=from&&n<=to)o.push({date:n,loai:"THU_SO",ref:"Sổ thu",party:x.note||"",amount:+x.tien||0,acct:tcnAcctOf(x.acct,accts),acct_text:x.acct||"",ceo:"",nguon:x.nguon||"khac"})});
  (f.nkc||[]).forEach(x=>{const n=String(x.d||"");if(n<from||n>to||!/^11[12]/.test(String(x.tk)))return;o.push({date:n,loai:"CHI_SO",ref:x.ct||"Sổ chi phí",party:x.dg||"",amount:-(+x.t||0),acct:tcnAcctOf(x.tkc,accts,x.tk),acct_text:x.tkc||(String(x.tk).startsWith("111")?"Tiền mặt":"Ngân hàng (sổ không ghi tài khoản)"),ceo:"",g:x.g||""})});
  /* Thanh lý tài sản có thu tiền (Tài sản & CCDC › ghi giảm). */
  (((f.ts||{}).a)||[]).forEach(x=>{const z=x.gg;if(!z||!(+z.thu>0))return;const n=String(z.d||"");if(n<from||n>to)return;o.push({date:n,loai:"TS_TL",ref:x.ma||"Thanh lý",party:x.ten||"",amount:+z.thu,acct:"",acct_text:"Tài sản & CCDC (không ghi tài khoản)",ceo:""})});
  return o}
/* Mọi chứng từ tiền trong khoảng ngày (null = đang tải). */
function tcnDongTien(from,to){const w=tcnDongTienWeb(from,to);if(!w)return null;const docs=w.docs.concat(tcnDocsSo(from,to,w.accounts)).sort((a,b)=>a.date.localeCompare(b.date));return {accounts:w.accounts,docs,err:w.err}}
const TCN_LOAI={TS_TL:"Thanh lý tài sản",THU:"Tiền khách trả (đã xác nhận)",THU_SO:"Phiếu thu Sổ thu",HOAN:"Bút toán đảo / hoàn tiền khách",CHI_NCC:"Phiếu chi nhà cung cấp",CHI_VC:"Phiếu chi vận chuyển",CHI_THUONG:"Phiếu chi thưởng NPP",CHI_SO:"Sổ chi phí (tiền thật)"};
function tcnTongTien(docs){const by={};let thu=0,chi=0,choCeo=0;(docs||[]).forEach(d=>{by[d.loai]=(by[d.loai]||0)+d.amount;if(d.amount>0)thu+=d.amount;else chi-=d.amount;if(d.ceo==="CHO")choCeo-=d.amount});return {thu,chi,thuan:thu-chi,by,choCeo}}

/* ---------- Tiền đang có + đủ dùng: một luật cho Dòng tiền, Tổng quan (Sức khỏe, tab Tiền) ---------- */
function tcnTienNow(){
  const f=(D().fin||{}),B=f.balances||[],last={};B.forEach(b=>{const x=last[b.acct];if(!x||b.ngay>x.ngay||(b.ngay===x.ngay&&String(b.id)>String(x.id)))last[b.acct]=b});
  const ks=Object.keys(last);
  if(!ks.length)return null;
  const g=k=>last[k]?+last[k].tien||0:0,bank=ks.filter(k=>k!=="VI_TT"&&k!=="VI_SPE").reduce((t,k)=>t+g(k),0),ngay=ks.map(k=>last[k].ngay).sort().pop();
  return {ngay,tien:bank,viTT:g("VI_TT"),viSPE:g("VI_SPE"),co:bank+g("VI_TT")+g("VI_SPE"),src:"số dư kế toán nhập ở Dòng tiền",by:last}}
function tcnChiBq(){const c=typeof dhGet==="function"&&D().fin?dhGet():{},t=mhToday(),d=new Date(t.slice(0,7)+"-01T00:00:00Z");d.setUTCDate(0);
  const to=d.toISOString().slice(0,10),from=to.slice(0,8)+"01",ym=to.slice(0,7);if(+c.chiNgay>0)return tcnChiNgay(c.chiNgay,0,ym);
  const x=tcnDongTien(from,to);if(!x)return {v:0,src:"đang tải chứng từ chi tháng trước",loading:true};return tcnChiNgay(0,tcnTongTien(x.docs).chi,ym)}
function tcnTien(){const now=tcnTienNow(),cb=tcnChiBq(),K=TCN.th&&TCN.th.khach,N=TCN.th&&TCN.th.ncc;
  const thu=K?K.totals.debt:null,tra=N?tcnTong(N,"balance").duong:null,R=tcnRunway(now?now.co:0,cb.v,thu,tra);
  return {now,cb,thu,tra,R:now?R:{co:0,ngay:null,ngay2:null}}}
/* Tổng quan › tab Tiền và ô Sức khỏe dùng cùng số. */
if(typeof dhCalcTien==="function"){const _d=dhCalcTien;dhCalcTien=function(){const o=_d.apply(this,arguments);if(!tcnOk())return o;tcnLoad();
  try{const T=tcnTien();if(T.now)o.last={ngay:T.now.ngay,tien:T.now.tien,viTT:T.now.viTT,viSPE:T.now.viSPE};else o.last=null;
    if(T.thu!=null)o.thu=T.thu;if(T.tra!=null)o.tra=T.tra;o.chiNgay=T.cb.v;o.chiTu=T.cb.src;o.vi=T.now?T.now.viTT+T.now.viSPE:0;o.R=T.R}catch(e){}
  return o}}

/* ---------- Ghi nguồn dưới ô ---------- */
function tcnTag(m,map){if(!m)return;m.querySelectorAll(".kpi").forEach(k=>{const l=((k.querySelector(".l")||{}).textContent||"").trim(),t=map[l];if(t&&!k.querySelector(".tsrc")){(k.querySelector(".kb")||k).insertAdjacentHTML("beforeend",`<div class="tsrc hint" style="font-size:11px;line-height:1.3;margin-top:3px">${t}</div>`)}})}
{const _t=PAGES.tien_lich;if(_t)PAGES.tien_lich=function(m){tcnLoad();const r=_t.apply(this,arguments);try{tcnTag(m,{"Tiền đang có":TCN_SRC.tien,"Đủ dùng khoảng":"Tiền đang có ÷ chi bình quân mỗi ngày ("+(tcnChiBq().src||"chưa có số chi")+").","Phải trả nhà cung cấp 4 tuần tới":"Nguồn: phiếu mua còn phải trả, xếp theo hạn trả (Mua hàng)."})}catch(e){}return r}}
{const _p=PAGES.phai_thu;if(_p)PAGES.phai_thu=function(m){tcnLoad();return _p.apply(this,arguments)}}
{const _e=PAGES.exec;if(_e)PAGES.exec=function(m){if(tcnOk())tcnLoad();return _e.apply(this,arguments)}}

/* ---------- Trang Đối chiếu công nợ & tiền ---------- */
function tcnDcLoad(P){const key=P.from+"|"+P.to;if(TCN.dcKey===key)return;TCN.dcKey=key;TCN.dc=null;
  const B=(D().fin||{}).balances||[],moc=[...new Set(B.map(b=>b.acct))].map(a=>tcnSoDu(B,a,tcnPrevDay(P.from))).filter(Boolean).map(b=>b.ngay).sort()[0];
  const tf=moc&&moc<P.from?moc:P.from;
  tcnApi(`/doi-chieu?from=${P.from}&to=${P.to}&tien_from=${tf}`).then(r=>{if(TCN.dcKey===key){r.tienFrom=tf;TCN.dc=r}}).catch(e=>{if(TCN.dcKey===key)TCN.dc={err:e.message}}).finally(()=>{if(PAGE==="tcn_dc")tcnRe()})}
function tcnAcctRows(dc,P){
  const B=(D().fin||{}).balances||[],docs=dc.tien.docs.concat(tcnDocsSo(dc.tienFrom||P.from,P.to,dc.tien.accounts)),lb=a=>[a.bank,a.account_no,a.account_name].filter(Boolean).join(" · ");
  const L=dc.tien.accounts.map(a=>({k:a.id,n:lb(a)+(a.active?"":" (ngừng dùng)")})).concat([{k:"TIEN_MAT",n:"Tiền mặt tại công ty"},{k:"VI_TT",n:"Ví TikTok Shop (chưa rút)"},{k:"VI_SPE",n:"Ví Shopee (chưa rút)"},{k:"",n:"Chưa rõ tài khoản (phiếu không ghi tài khoản)"}]);
  return L.map(a=>{const D0=docs.filter(d=>d.acct===a.k),moc=a.k?tcnSoDu(B,a.k,tcnPrevDay(P.from)):null,kt=a.k?tcnSoDu(B,a.k,P.to):null,ktIn=kt&&kt.ngay>=P.from?kt:null;
    const inP=D0.filter(d=>d.date>=P.from&&d.date<=P.to),t=tcnTongTien(inP),s=tcnSoDuTinh(moc,D0,ktIn?ktIn.ngay:P.to);
    return {...a,docs:D0,inP,thu:t.thu,chi:t.chi,moc,s,kt:ktIn,chenh:ktIn&&s.tinh!=null?(+ktIn.tien||0)-s.tinh:null}}).filter(r=>r.k===""?r.inP.length:true)}
function pTcnDc(m){
  const T="Đối chiếu công nợ & tiền",P=PERIOD;tcnLoad();if(typeof gdCss==="function")gdCss();
  const S="Khách, nhà cung cấp: nợ đầu + phát sinh − đã trả − hàng trả lại = nợ cuối · Tài khoản: số dư đầu + thu − chi = số dư tính, so với số kế toán nhập";
  if(!tcnOk()){m.innerHTML=H(T,S)+`<div class="note">Chỉ CEO và kế toán xem trang này.</div>`;return}
  tcnDcLoad(P);const dc=TCN.dc,th=TCN.th;
  if(!dc||!th){m.innerHTML=H(T,S)+(dc&&dc.err||TCN.err?`<div class="note red">${esc((dc&&dc.err)||TCN.err)}</div>`:`<p class="hint pad">Đang tải…</p>`);return}
  if(dc.err){m.innerHTML=H(T,S)+`<div class="note red">${esc(dc.err)}</div>`;return}
  const K=th.khach,bk=K.by_kenh,nccT=tcnTong(th.ncc,"balance"),khT=tcnTong(dc.khach,"hien"),ac=tcnAcctRows(dc,P),tt=tcnTongTien(ac.flatMap(a=>a.inP));
  const pc=(v,t)=>t?Math.round(v/t*100)+"%":"—",late=x=>x.b90p+x.old;
  const tabs=[["kh","Khách hàng"],["ncc","Nhà cung cấp"],["tk","Tài khoản tiền"],["dn","Định nghĩa"]];
  let body="";
  if(TCN.tab==="kh"||TCN.tab==="ncc"){
    const isK=TCN.tab==="kh",q=kfold(TCN.q||"").trim();
    let R=(isK?dc.khach:dc.ncc).filter(r=>(!q||kfold(r.name).includes(q))&&(!isK||!TCN.kenh||r.kenh===TCN.kenh)&&(!TCN.lech||!tcnKhop(r)));
    R=R.sort((a,b)=>(tcnKhop(a)-tcnKhop(b))||Math.abs(b.cuoi)-Math.abs(a.cuoi));
    const sum=k=>R.reduce((t,r)=>t+(+r[k]||0),0),nLech=(isK?dc.khach:dc.ncc).filter(r=>!tcnKhop(r)).length;
    /* Chân bảng kiểu Poscake (gdbang.js): tổng cộng + phân trang, dính đáy màn hình. */
    const pk="tcn"+TCN.tab,pg=TCN.pg[pk]||(TCN.pg[pk]={co:typeof gdCoNho==="function"?gdCoNho(pk,100):100,trang:1});
    const tong=`<span>Cộng <b>${R.length}</b> ${isK?"khách":"nhà cung cấp"}${R.length<(isK?dc.khach:dc.ncc).length?" (đang lọc)":""}</span><span>nợ đầu <b>${nf(tcnR(sum("dau")))}</b></span><span>phát sinh <b>${nf(tcnR(sum("phat_sinh")))}</b></span><span>đã trả <b>${nf(tcnR(sum("da_tra")))}</b></span>${isK?`<span>trả lại <b>${nf(tcnR(sum("tra_lai")))}</b></span>`:""}<span>nợ cuối <b>${nf(tcnR(sum("cuoi")))}</b></span><span class="hint">trang đang hiện ${nf(tcnR(sum("hien")))}</span>${isK?`<span class="hint">chờ ghi nợ ${nf(tcnR(sum("cho_ghi_no")))} · chờ tiền về ${nf(tcnR(sum("cho_tien_ve")))}</span>`:""}`;
    body=`<div class="filters"><input id="tcn-q" class="mhq" placeholder="Tìm ${isK?"khách":"nhà cung cấp"}…" value="${esc(TCN.q||"")}">${isK?`<select id="tcn-k">${opt([["","Mọi kênh"],...TCN_KENH],TCN.kenh)}</select>`:""}<label class="chk"><input type="checkbox" id="tcn-l" ${TCN.lech?"checked":""}> Chỉ dòng lệch (${nLech})</label></div>
    <section class="card flush"><div class="nsw"><table class="tbl gd"><thead><tr><th>${isK?"Khách":"Nhà cung cấp"}</th>${isK?"<th>Kênh</th>":""}<th class="n">Nợ đầu kỳ</th><th class="n">Phát sinh</th><th class="n">Đã trả</th>${isK?`<th class="n">Hàng trả lại</th>`:""}<th class="n">Nợ cuối</th><th class="n">Trang đang hiện</th><th>Khớp</th>${isK?`<th class="n">Chờ ghi nợ</th><th class="n">Chờ tiền về</th>`:""}<th>Liên quan</th></tr></thead><tbody>
    ${R.length?(typeof gdCat==="function"?gdCat(R,pg):R).map(r=>`<tr class="clk" data-tcn="${esc(r.id)}"><td><b>${esc(r.name)}</b></td>${isK?`<td>${esc((TCN_KENH.find(x=>x[0]===r.kenh)||["",""])[1])}</td>`:""}<td class="n">${nf(tcnR(r.dau))}</td><td class="n">${nf(tcnR(r.phat_sinh))}</td><td class="n">${nf(tcnR(r.da_tra))}</td>${isK?`<td class="n">${r.tra_lai?nf(tcnR(r.tra_lai)):"—"}</td>`:""}<td class="n"><b>${nf(tcnR(r.cuoi))}</b></td><td class="n">${nf(tcnR(r.hien))}</td><td>${tcnKhop(r)?pill("Khớp","grn"):pill("Lệch "+nf(tcnR(r.hien-r.cuoi)),"red")}</td>${isK?`<td class="n hint">${r.cho_ghi_no?nf(tcnR(r.cho_ghi_no)):"—"}</td><td class="n hint">${r.cho_tien_ve?nf(tcnR(r.cho_tien_ve)):"—"}</td>`:""}<td>${tcnLk("Chứng từ",`data-tcnct="${esc(r.id)}"`,"Xem từng đơn, phiếu thu, hàng trả lại")}</td></tr>`).join("")
      
      :`<tr><td colspan="12" class="empty">Không có dòng nào.</td></tr>`}</tbody></table></div>${R.length&&typeof gdChan==="function"?gdChan(tong,R.length,pg,pk):""}</section>
    <p class="hint pad">Chỉ cộng chứng từ đã vào công nợ chính thức${isK?" (đơn kế toán đã xác nhận, tiền kế toán đã xác nhận, hàng trả lại đã giảm nợ). Chờ ghi nợ, chờ tiền về chỉ để xem":" (sau ngày chốt đầu kỳ của nhà cung cấp, như Mua hàng)"}. Ngày theo ngày ${isK?"đơn / ngày tiền về / ngày trả hàng":"chứng từ / ngày chi"}. "Trang đang hiện" = số ở ${isK?"Công nợ khách hàng, Phải thu":"Mua hàng › Công nợ nhà cung cấp"} hôm nay; lệch khi có chứng từ ghi ngày sau kỳ đang xem (chọn kỳ tới hôm nay để so) hoặc dữ liệu sai. Bấm một dòng để xem từng chứng từ.</p>`;
  }else if(TCN.tab==="tk"){
    const unk=ac.find(a=>a.k==="");
    body=`<div class="grid kpis">${kpi("Tiền thu đã xác nhận",nf(tcnR(tt.thu)),"trong kỳ, mọi tài khoản")}${kpi("Tiền chi đã duyệt",nf(tcnR(tt.chi)),tt.choCeo?"gồm "+nf(tcnR(tt.choCeo))+" chờ CEO duyệt (tiền đã ra)":"")}${kpi("Dòng tiền thuần",nf(tcnR(tt.thuan)),"thu − chi trong kỳ",tt.thuan<0?"var(--red)":"")}${kpi("Chưa rõ tài khoản",unk?nf(tcnR(unk.thu+unk.chi)):"0",unk?unk.inP.length+" chứng từ không ghi tài khoản":"mọi chứng từ đã có tài khoản")}</div>
    <section class="card flush"><div class="nsw"><table class="tbl gd"><thead><tr><th>Tài khoản</th><th class="n">Số dư đầu (kế toán nhập)</th><th class="n">Thu</th><th class="n">Chi</th><th class="n">Số dư tính</th><th class="n">Số dư thật (kế toán nhập)</th><th class="n">Chênh lệch</th><th>Liên quan</th></tr></thead><tbody>
    ${ac.map(a=>`<tr class="clk" data-tcna="${esc(a.k||"_")}"><td><b>${esc(a.n)}</b></td><td class="n">${a.moc?nf(tcnR(a.moc.tien))+` <small class="hint">${tcnDd(a.moc.ngay)}</small>`:a.k?`<span class="hint">chưa nhập</span>`:"—"}</td><td class="n">${a.thu?nf(tcnR(a.thu)):"—"}</td><td class="n">${a.chi?nf(tcnR(a.chi)):"—"}</td><td class="n">${a.s.tinh!=null?`<b>${nf(tcnR(a.s.tinh))}</b>`+(a.kt?` <small class="hint">tới ${tcnDd(a.kt.ngay)}</small>`:""):"—"}</td><td class="n">${a.kt?nf(tcnR(a.kt.tien))+` <small class="hint">${tcnDd(a.kt.ngay)}</small>`:a.k?`<span class="hint">chưa nhập trong kỳ</span>`:"—"}</td><td class="n">${a.chenh==null?"—":Math.abs(a.chenh)<1?pill("Khớp","grn"):`<b style="color:var(--red)">${nf(tcnR(a.chenh))}</b>`}</td><td>${a.docs.length?tcnLk(a.inP.length+" chứng từ",`data-tcnca="${esc(a.k||"_")}"`,"Xem từng phiếu thu, phiếu chi"):""}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card pad"><b>Thu chi trong kỳ theo loại chứng từ</b>${tcnGd(["Loại","Số tiền"],Object.keys(TCN_LOAI).filter(k=>tt.by[k]).map(k=>`<tr><td>${TCN_LOAI[k]}</td><td class="n">${nf(tcnR(tt.by[k]))}</td></tr>`))}
    <p class="hint">Tiền sàn (TikTok, Shopee) và COD Facebook về tài khoản chưa có chứng từ trên web nên chưa cộng vào thu: số dư thật sẽ cao hơn số dư tính đúng bằng phần đó cho tới khi kế toán ghi phiếu thu. Số dư đầu = số kế toán nhập gần nhất trước ${tcnDd(P.from)}; số dư tính tính tới ngày của số dư thật trong kỳ.</p></section>`;
  }else body=`<section class="card pad">${tbl(["Chỉ số","Cách tính"],TCN_DN.map(([a,b])=>`<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`))}</section>`;
  m.innerHTML=H(T,S)+`<div class="grid kpis">${kpi("Phải thu Kênh phân phối",nf(tcnR(bk.B2B.debt)),bk.B2B.customers+" khách · nợ quá 90 ngày "+pc(late(bk.B2B),bk.B2B.debt)+" · DSO "+(bk.B2B.dso!=null?bk.B2B.dso+" ngày":"—"))}${kpi("Phải thu Kênh OEM",nf(tcnR(bk.GIA_CONG.debt)),bk.GIA_CONG.customers+" khách · DSO "+(bk.GIA_CONG.dso!=null?bk.GIA_CONG.dso+" ngày":"—"))}${kpi("Khách trả thừa",nf(tcnR(khT.am)),"nợ âm, để riêng, không trừ vào phải thu")}${kpi("Phải trả nhà cung cấp",nf(tcnR(nccT.duong)),nccT.am?"mình trả trước "+nf(tcnR(nccT.am))+" (để riêng)":th.ncc.filter(r=>r.balance>0).length+" nhà cung cấp")}</div>
  <div class="tabs">${tabs.map(([k,n])=>`<button class="tab${TCN.tab===k?" on":""}" data-tcnt="${k}">${n}</button>`).join("")}</div>${body}
  <p class="hint pad">Kỳ ${esc(pLabel())}. Trang chỉ đọc số; thấy sai thì ghi lại để chị Hoa quyết, không sửa ở đây.</p>`;
  m.querySelectorAll("[data-tcnt]").forEach(b=>b.onclick=()=>{TCN.tab=b.dataset.tcnt;renderMain()});
  const qi=m.querySelector("#tcn-q");if(qi)qi.oninput=()=>{TCN.q=qi.value;tcnPg1();const p=qi.selectionStart;renderMain();const n=document.querySelector("#tcn-q");if(n){n.focus();n.setSelectionRange(p,p)}};
  const ks=m.querySelector("#tcn-k");if(ks)ks.onchange=e=>{TCN.kenh=e.target.value;tcnPg1();renderMain()};
  const lc=m.querySelector("#tcn-l");if(lc)lc.onchange=e=>{TCN.lech=e.target.checked;tcnPg1();renderMain()};
  m.querySelectorAll("[data-tcn]").forEach(r=>r.onclick=()=>tcnCtOpen(TCN.tab,r.dataset.tcn,P));
  m.querySelectorAll("[data-tcnct]").forEach(el=>el.onclick=ev=>{ev.stopPropagation();tcnCtOpen(TCN.tab,el.dataset.tcnct,P)});
  const acOpen=k0=>{const k=k0==="_"?"":k0,a=ac.find(x=>x.k===k);if(a)tcnAcctOpen(a,P)};
  m.querySelectorAll("[data-tcna]").forEach(r=>r.onclick=()=>acOpen(r.dataset.tcna));
  m.querySelectorAll("[data-tcnca]").forEach(el=>el.onclick=ev=>{ev.stopPropagation();acOpen(el.dataset.tcnca)});
  if(typeof gdBind==="function")gdBind(m);
  const pk="tcn"+TCN.tab;if(TCN.pg[pk]&&typeof gdChanBind==="function")gdChanBind(m,pk,TCN.pg[pk],renderMain);
}
const tcnPg1=()=>{Object.values(TCN.pg).forEach(p=>p.trang=1)};
function tcnCtOpen(tab,id,P,name){
  const isK=tab==="kh",r=TCN.dc&&!TCN.dc.err?(isK?TCN.dc.khach:TCN.dc.ncc).find(x=>x.id===id):null,nm=r?r.name:name||"";
  openDrawerHTML(`<h2>${esc(nm)}</h2><p class="hint">Đang tải chứng từ…</p>`);
  tcnApi(`/chung-tu?kind=${isK?"kh":"ncc"}&id=${encodeURIComponent(id)}`).then(d=>{
    const open=+d.opening_debt||0;let bal=open;
    const rows=d.rows.map(x=>{const v=isK&&x.loai!=="Đơn đã giao / xuất kho"?-x.amount:x.amount;if(x.tinh)bal+=v;return {...x,v,bal}});
    openDrawerHTML(`<h2>${esc(nm)}</h2>${r?`<p class="hint">Nợ đầu kỳ ${nf(tcnR(r.dau))} + phát sinh ${nf(tcnR(r.phat_sinh))} − đã trả ${nf(tcnR(r.da_tra))}${isK?" − hàng trả lại "+nf(tcnR(r.tra_lai)):""} = <b>${nf(tcnR(r.cuoi))}</b> (kỳ ${tcnDd(P.from)} – ${tcnDd(P.to)})</p>`:""}
    ${tcnGd(["Ngày","Loại","Số chứng từ","Liên quan","Ghi chú","Tăng / giảm nợ","Dư nợ sau dòng"],[`<tr><td>${isK?"—":tcnDd(d.opening_date)}</td><td>${isK?"Dư nợ cũ đầu kỳ (nạp lúc bắt đầu dùng web)":"Công nợ đầu kỳ (ngày chốt)"}</td><td></td><td></td><td></td><td class="n">${nf(tcnR(open))}</td><td class="n">${nf(tcnR(open))}</td></tr>`].concat(rows.map(x=>`<tr style="${x.tinh?"":"opacity:.55;"}${P&&x.date>=P.from&&x.date<=P.to?"background:#f5f7fb":""}"><td>${tcnDd(x.date)}</td><td>${esc(x.loai)}${x.tinh?"":` <small>(${isK?"chưa xác nhận, chưa tính":"trước ngày chốt, không tính"})</small>`}${x.ceo==="CHO"?" "+pill("chờ CEO duyệt","amb"):""}</td><td class="mono">${esc(x.ref||"")}</td><td>${tcnDon(x.lq)}</td><td class="gdd" title="${esc(x.note||"")}">${esc(x.note||"")}</td><td class="n">${nf(tcnR(x.v))}</td><td class="n">${x.tinh?nf(tcnR(x.bal)):"—"}</td></tr>`)))}
    <p class="hint">Dòng mờ: chưa vào công nợ chính thức. Dòng nền nhạt: trong kỳ đang xem. Bấm mã ở cột Liên quan để mở đơn.</p>`);tcnBindDr()
  }).catch(e=>openDrawerHTML(`<h2>${esc(nm)}</h2><div class="note red">${esc(e.message)}</div>`))}
function tcnAcctOpen(a,P){
  let run=a.moc?+a.moc.tien||0:0;const L=a.docs.filter(d=>d.date>(a.moc?a.moc.ngay:"")&&d.date<=P.to).map(d=>{run+=d.amount;return {...d,run}});
  openDrawerHTML(`<h2>${esc(a.n)}</h2><p class="hint">${a.moc?"Số dư kế toán nhập "+tcnDd(a.moc.ngay)+": "+nf(tcnR(a.moc.tien)):"Chưa có số dư đầu: chỉ cộng thu chi."}${a.kt?" · số dư thật "+tcnDd(a.kt.ngay)+": "+nf(tcnR(a.kt.tien)):""}</p>
  ${L.length?tcnGd(["Ngày","Loại","Chứng từ","Bên kia","Liên quan","Ghi trên phiếu","Số tiền",a.moc?"Số dư tính":""],L.map(d=>`<tr><td>${tcnDd(d.date)}</td><td>${esc(TCN_LOAI[d.loai]||d.loai)}${d.ceo==="CHO"?" "+pill("chờ CEO duyệt","amb"):""}</td><td class="mono">${esc(d.ref||"")}</td><td class="gdd" title="${esc(d.party||"")}">${esc(d.party||"")}</td><td>${tcnDon(d.lq)}</td><td class="gdd hint" title="${esc(d.acct_text||"")}">${esc(d.acct_text||"")}</td><td class="n">${nf(tcnR(d.amount))}</td><td class="n">${a.moc?nf(tcnR(d.run)):""}</td></tr>`)):`<p class="empty">Không có chứng từ.</p>`}`);tcnBindDr()}
/* Kiểu bảng giao dịch chung (gdbang.js): một dòng một giao dịch, cột Liên quan bấm mở đơn. */
const tcnGd=(h,r)=>{if(typeof gdCss==="function")gdCss();return tbl(h,r).replace("<table>",'<table class="gd">')};
const tcnLk=(t,a,ti)=>typeof gdLink==="function"?gdLink(t,a,ti):`<a class="lnk" ${a}>${esc(t)}</a>`;
const tcnDon=s=>s?(typeof gdDonLinks==="function"?gdDonLinks(s):esc(s)):"";
function tcnBindDr(){const d=document.getElementById("drawerIn");if(d&&typeof gdBind==="function")gdBind(d)}
PAGES.tcn_dc=pTcnDc;
MODULES.push({k:"q_tcn",adm:true,zone:"Quản trị",ic:"fin",n:"Đối chiếu công nợ & tiền",sub:"",groups:()=>[["",[MI("tcn_dc","Đối chiếu công nợ & tiền",()=>tcnOk())]]]});
