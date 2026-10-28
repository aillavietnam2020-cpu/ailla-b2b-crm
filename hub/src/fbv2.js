/* =====================================================================
   TRANG FACEBOOK BẢN MỚI (chị Hoa duyệt demo 28/10/2026, cùng khung TikTok tiktokv2.js / Shopee spev2.js).
   Đè lên PAGES.bc_fb của fbpl.js. Các tab cũ (Quảng cáo · Digital, Team Sale, Sản phẩm, Nhập chi phí) giữ nguyên ở fbpl.js.
   - Quản trị: một số doanh thu thực = đơn giao thành công (cùng số Tổng quan, Lãi lỗ, Đối chiếu doanh thu); giữa tháng hiện
     "Doanh thu dự kiến" = giao thành công + đơn đang giao × (1 − tỷ lệ hoàn thật tháng gần nhất đã chốt). 6 ô số, cơ cấu doanh thu
     theo nguồn đơn, cơ cấu chi phí bấm xổ, lãi sau quảng cáo theo nhóm hàng, top sản phẩm, cảnh báo & đề xuất tuần / tháng.
   - Vận hành: doanh thu thực + doanh thu chốt, đơn, quảng cáo, ROAS, hoàn; việc tuần này; 4 thẻ (Digital, Team Sale,
     CSKH & giao hàng, Nguồn đơn); top sản phẩm kèm ưu tiên quảng cáo (không lộ lãi); số chi tiết cũ để trong mục xổ.
   Hàm tính ở fbbc.js. Giá vốn, vận chuyển thật từ Sheet Pancake (fb_cost_days); ngày Sheet chưa có thì ước theo tỷ lệ.
   ===================================================================== */
const FBV={al:"tuan"};
/* Tỷ lệ hoàn dự kiến = tỷ lệ hoàn thật của tháng gần nhất đã chốt (ngày 10 tháng sau); chưa đủ số thì giữ 8%. */
function fbvRate(){
  const t=typeof dtToday==="function"?dtToday():iso(new Date());let y=+t.slice(0,4),m=+t.slice(5,7);
  for(let i=0;i<4;i++){m--;if(m<1){m=12;y--}const ym=y+"-"+String(m).padStart(2,"0");
    if(typeof dtTrangThai==="function"&&dtTrangThai(ym,t)!=="chot")continue;const r=fbbcHoan(DAYD.fb,ym);if(r!=null)return {r,ym}}
  return {r:0.08,ym:""};
}
{const _t=tqRevB2C;tqRevB2C=function(){try{if(typeof DT_HOAN_FB!=="undefined")DT_HOAN_FB=fbvRate().r}catch(e){}return _t.apply(this,arguments)}}

/* Số kỳ đang chọn: doanh thu cùng nguồn các trang khác; chi phí thật theo Sheet, ngày Sheet chưa có thì ước. */
function fbvData(){
  const all=fbdRange(PERIOD.from,PERIOD.to),lastK=all.filter(k=>(DAYD.fb||{})[k]).pop()||PERIOD.to,days=all.filter(k=>k<=lastK),A=fbdAgg(days);
  let R=null;try{R=tqRevB2C({},PERIOD.from,PERIOD.to).fb}catch(e){}
  const sumD=i=>days.reduce((a,k)=>a+(+((DAYD.fb||{})[k]||[])[i]||0),0);
  const dt=R&&R.dt!=null?R.dt:sumD(5),FR=(FBC.raw&&FBC.raw.days)||{},cov=days.filter(k=>FR[k]),unc=days.filter(k=>!FR[k]);
  const C=fbdCost(cov),dtCov=C.dt,dtUnc=unc.reduce((a,k)=>a+(+((DAYD.fb||{})[k]||[])[5]||0),0),shipRate=dtCov?C.ship/dtCov:FBD_SHIP,retRate=dtCov?C.shipRet/dtCov:0;
  const gv=C.gv+unc.reduce((a,k)=>a+(+((DAYD.fb||{})[k]||[])[7]||0),0),ship=C.ship+dtUnc*shipRate,shipRet=C.shipRet+dtUnc*retRate;
  const qcRaw=days.reduce((a,k)=>a+fbdQcRaw(k),0),qcT=days.reduce((a,k)=>a+fbdQc(k),0),lai=dt-gv-ship-shipRet-qcT;
  const RT=fbvRate(),dang=R&&R.dang!=null?{n:R.dang,v:R.dangDt||0}:(typeof dtFbDang==="function"?dtFbDang(PERIOD.from,PERIOD.to):{n:0,v:0});
  const ym=PERIOD.to.slice(0,7),chua=typeof dtTrangThai==="function"&&dtTrangThai(ym,dtToday())!=="chot",dk=chua&&dang.v>0?dt+dang.v*(1-RT.r):null;
  return {days,A,R,dt,dk,dang,RT,gv,ship,shipRet,qcRaw,qcT,tax:qcRaw?qcT/qcRaw:1+(typeof FB_ADS_TAX!=="undefined"?FB_ADS_TAX:0.1),lai,cov,unc,dtUnc,C,shipAll:(ship+shipRet)/(dt||1),
    lastCov:cov[cov.length-1]||"",lastK,chua,nhan:R&&R.nhan?R.nhan:""};
}
function fbvProds(days){const F=FBC.raw;if(!F||!F.p||!F.sk)return [];const m={};
  days.forEach(k=>(F.p[k]||[]).forEach(([i,q,dt,gv])=>{const t=m[i]||(m[i]={i,q:0,dt:0,gv:0});t.q+=q;t.dt+=dt*1000;t.gv+=gv*1000}));
  return Object.values(m).map(x=>{const s=F.sk[x.i]||["?","?",""];return {...x,c:s[0],n:s[1],g:s[2]||""}}).sort((a,b)=>b.dt-a.dt)}
function fbvCamps(days){try{const D=typeof adfLive==="function"?adfLive():null;return D?adfAgg(D,days).C:[]}catch(e){return []}}
function fbvLines(X){const days=X.cov.length?X.cov:X.days;return fbbcLines({prods:fbvProds(days),camps:fbvCamps(days),tax:X.tax,ship:X.shipAll})}
/* Cách ra doanh thu dự kiến, mỗi bước một dòng (chị Hoa 28/10: ghi dễ hiểu). */
const fbvDkTxt=X=>`Đã giao ${tr(X.dt)}<br>+ Đang giao ${tr(X.dang.v)}<br>− Hoàn dự kiến ${tbP(X.RT.r,1)}: ${tr(X.dang.v*X.RT.r)}`;
const fbvVn=k=>k?k.slice(8)+"/"+k.slice(5,7):"";
const fbvTabs=()=>`<nav class="fbd-tabs">${[["pl","Tổng quan"],["bh","Quảng cáo · Digital"],["sale","Team Sale"],["sp","Sản phẩm"]].map(([k,t])=>`<button type="button" data-fbdtab="${k}" class="${FBD.tab===k?"on":""}">${t}</button>`).join("")}</nav>`;
function fbvAlerts(X,L){
  const ky=X.lastK.slice(0,7),W=fbbcWeeks(DAYD.fb,ky,k=>fbdQc(k)),last2=fbbcLast2(W),P=typeof fbsPeople==="function"?fbsPeople(X.days):null,src=fbdSources(X.days);
  const camps=fbvCamps(X.days),web=camps.filter(c=>c.typ!=="Tin nhắn"),ib=camps.filter(c=>c.typ==="Tin nhắn"),s=(L2,f)=>L2.reduce((a,c)=>a+(+c[f]||0),0);
  const M={dt:X.dk!=null?X.dk:X.dt,qcT:X.qcT,tao:X.A.tao,huy:X.A.huy,hoan:X.A.hoan,giao:X.A.giao,inboxQc:s(ib,"spend"),webQc:s(web,"spend"),webRev:(src.find(x=>/webcake|trang/i.test(x.n))||{}).rev||0};
  const adsMax=typeof scQcMax==="function"?scQcMax():0.38;
  return {W,last2,P,src,camps,adsMax,AW:fbbcAlerts({last2,adsMax}),AM:fbbcAlerts({M,L,people:P?P.list:[],src,kpi:typeof FBS_KPI!=="undefined"?FBS_KPI:[],adsMax})};
}

/* ---------- Quản trị ---------- */
function fbvAdm(m){
  adfLoad();fbsLoad();fbcLoad();adfMergeDays();
  const X=fbvData(),dt=X.dt,ky=PERIOD.from.slice(0,7),oneMonth=ky===PERIOD.to.slice(0,7)&&PERIOD.from.slice(8)==="01"&&PERIOD.to===tbKyEnd(ky);
  const head=H("Kênh Facebook",`Báo cáo quản trị · ${esc(pLabel())}${X.nhan?" · "+esc(X.nhan.replace(/ · dự kiến.*$/,"")):""}`)+fbvTabs();
  if(!X.days.length||!dt){m.innerHTML=head+`<section class="card"><p class="empty">Kỳ này chưa có số Facebook.</p></section>`;fbvBind(m);return}
  const L=fbvLines(X),AL=fbvAlerts(X,L),so=oneMonth?bcSoCP(ky,["Facebook"],"Facebook"):{rieng:null,chung:null,whyR:"Chọn đủ một tháng để lấy Sổ chi phí",whyC:"Chọn đủ một tháng để lấy Sổ chi phí"};
  const OP=typeof fbdOpex==="function"?fbdOpex(X.days):{has:false};if(OP.has)so.rieng=(so.rieng||[]).concat([{n:"Chi phí vận hành nhập ở tab Nhập chi phí",t:OP.amt}]);
  const sumL=a=>(a||[]).reduce((s,x)=>s+(+x.t||0),0),Rr=so.rieng?sumL(so.rieng):null,Cc=so.chung?sumL(so.chung):null,ln=Rr!=null&&Cc!=null?X.lai-Rr-Cc:null,adsMax=AL.adsMax,uoc=X.unc.length?` · ${nf(X.unc.length)} ngày cuối ước theo tỷ lệ (Sheet có tới ${fbvVn(X.lastCov)})`:"";
  const dtK=X.dk!=null?kpi("Doanh thu dự kiến",tr(X.dk),fbvDkTxt(X)):kpi("Doanh thu thực",tr(dt),nf(X.A.giao)+" đơn giao · TB "+tr(X.A.giao?dt/X.A.giao:0)+"/đơn");
  const kp=`<div class="grid kpis">${dtK}${kpi("Giá vốn",tr(X.gv),tbP(X.gv,dt)+" doanh thu thực")}${kpi("Vận chuyển",tr(X.ship+X.shipRet),tbP(X.ship+X.shipRet,dt)+" · gồm ship hoàn "+tr(X.shipRet))}${kpi("Quảng cáo (gồm thuế)",tr(X.qcT),tbP(X.qcT,X.dk||dt)+(X.dk!=null?" doanh thu dự kiến":"")+" · ngưỡng "+tbP(adsMax,1),X.qcT/(X.dk||dt)>adsMax?"var(--red)":"")}${kpi("Lãi đóng góp kênh",tr(X.lai),tbP(X.lai,dt)+" · trước chi chung",X.lai<0?"var(--red)":"var(--green)")}${kpi("Lợi nhuận ròng kênh",ln==null?"—":tr(ln),ln==null?"chờ Sổ chi phí đủ số":tbP(ln,dt)+" · sau chi riêng, chi chung","var(--green)")}</div>`;
  /* Cơ cấu doanh thu theo nguồn đơn (Pancake): quảng cáo chuyển đổi gán cho trang bán hàng, quảng cáo tin nhắn gán cho inbox. */
  const S=AL.src,sTot=S.reduce((a,x)=>a+x.rev,0),cw=AL.camps.filter(c=>c.typ!=="Tin nhắn").reduce((a,c)=>a+c.spend,0)*X.tax,ci=AL.camps.filter(c=>c.typ==="Tin nhắn").reduce((a,c)=>a+c.spend,0)*X.tax;
  const qcOf=x=>/webcake|trang b[áa]n/i.test(x.n)?{v:cw,n:"chuyển đổi"}:/inbox|tin nh[ắa]n|messenger/i.test(x.n)?{v:ci,n:"tin nhắn"}:null;
  let acc=0;const cg=S.map(x=>{const a=acc;acc+=sTot?x.rev/sTot*100:0;return `${x.c} ${a}% ${acc}%`}).join(","),mx=Math.max(1,...S.map(x=>x.rev));
  const co=S.length?`<section class="card"><div class="card-h"><h2>Cơ cấu doanh thu</h2><span class="hint">theo nơi tạo đơn trên Pancake · tỷ trọng theo doanh số đơn chốt · quảng cáo chuyển đổi tính cho trang bán hàng, tin nhắn cho inbox</span></div>
   <div class="tb-co"><div class="tb-donut" style="background:conic-gradient(${cg})"><div class="ct">Doanh số chốt<b>${tr(sTot)}</b></div></div>
   <table class="tb-src"><colgroup><col style="width:32%"><col style="width:14%"><col style="width:22%"><col style="width:20%"><col style="width:12%"></colgroup>
   <thead><tr><th>Nguồn</th><th class="n">Doanh số</th><th>Tỷ trọng</th><th>Quảng cáo</th><th class="n">Tốn / 100đ</th></tr></thead><tbody>
   ${S.filter(x=>x.rev>0).slice(0,5).map(x=>{const q=qcOf(x);return `<tr><td><span class="tb-dot" style="background:${x.c}"></span><b>${esc(x.n)}</b></td><td class="n">${tr(x.rev)}</td><td><div class="tb-mini"><i style="width:${(x.rev/mx*100).toFixed(1)}%;background:${x.c}"></i></div><b>${tbP(x.rev,sTot)}</b></td><td>${q?tr(q.v)+" "+q.n:"không có"}</td><td class="n">${q&&x.rev?(q.v/x.rev*100).toFixed(1).replace(".",",")+"đ":"0đ"}</td></tr>`}).join("")}</tbody></table></div></section>`:"";
  /* Cơ cấu chi phí */
  const row=(k,c,n,t,h,sub)=>{const has=sub&&sub.length;
    return `<tr class="${has?"tb-tg":""}" ${has?`data-tbtg="${k}"`:""}><td>${has?`<span class="tb-car" data-car="${k}">▸</span>`:`<span class="tb-car"></span>`}<span class="tb-dot" style="background:${c}"></span>${has?`<b>${esc(n)}</b>`:esc(n)}</td><td class="n">${t==null?`<span class="hint">chưa có số</span>`:tbF(t)}</td><td class="n">${t==null?"":tbP(t,dt)}</td><td class="hint">${esc(h||"")}</td></tr>`
     +(has?sub.map(x=>`<tr class="tb-sub" data-tbs="${k}" style="display:none"><td>${esc(x.n)}</td><td class="n">${tbF(x.t)}</td><td class="n">${tbP(x.t,dt)}</td><td class="hint">${esc(x.h||"")}</td></tr>`).join(""):"")};
  const qcT=L.lines.reduce((a,x)=>a+x.qcT,0)+L.unk.qcT,ciT=ci,cwT=cw;
  const bar=[["Giá vốn",X.gv,"#8a8799"],["Ship",X.ship+X.shipRet,"#e07a3f"],["Quảng cáo",X.qcT,"#e2494a"]].concat(Rr?[["Chi riêng",Rr,"#b06ab3"]]:[]).concat(Cc?[["Chi chung",Cc,"#5d6d8e"]]:[]).concat([[ln!=null?"Lợi nhuận ròng":"Lãi đóng góp",ln!=null?ln:X.lai,"#17804a"]]);
  const cost=`<section class="card"><div class="card-h"><h2>Cơ cấu chi phí</h2><span class="hint">mọi khoản chi của kênh trên doanh thu thực ${tbF(dt)} đ${uoc}</span></div>
   <div class="tb-bar">${bar.filter(b=>b[1]>0).map(([n,t,c])=>{const ty=t/dt;return `<div style="width:${(ty*100).toFixed(2)}%;background:${c}" title="${esc(n)} ${tbF(t)}">${ty>=0.06?esc(n)+" "+tbP(t,dt):tbP(t,dt)}</div>`}).join("")}</div>
   ${tbl(["Khoản","Số tiền (đ)","% doanh thu","Ghi chú"],[
     row("gv","#8a8799","Giá vốn hàng bán",X.gv,X.unc.length?"giá vốn thật từng đơn (Sheet Pancake), ngày Sheet chưa có thì ước":"giá vốn thật từng đơn (Sheet Pancake)"),
     row("vc","#e07a3f","Vận chuyển",X.ship+X.shipRet,"bấm để xem",[{n:"Phí ship đơn giao",t:X.ship},{n:`Ship đơn hoàn hai chiều (${nf(X.A.hoan)} đơn)`,t:X.shipRet,h:"mất thêm vì hoàn"}]),
     row("qc","#e2494a","Quảng cáo Facebook (gồm thuế)",X.qcT,"bấm để xem theo loại",[{n:"Chiến dịch chuyển đổi (trang bán hàng)",t:cwT},{n:"Chiến dịch tin nhắn (inbox)",t:ciT},...(L.unk.qcT?[{n:"Trong đó chưa gán được nhóm hàng (tên chiến dịch không theo mã)",t:L.unk.qcT}]:[])].filter(x=>Math.round(x.t))),
     `<tr class="tb-sum"><td><span class="tb-car"></span>Lãi đóng góp kênh</td><td class="n">${tbF(X.lai)}</td><td class="n">${tbP(X.lai,dt)}</td><td class="hint">trước chi riêng khác và chi chung</td></tr>`,
     row("rieng","#b06ab3","Chi phí riêng khác của kênh",Rr,so.rieng?"bấm để xem từng khoản · Sổ chi phí":so.whyR,so.rieng),
     row("chung","#5d6d8e","Chi phí chung phân bổ",Cc,so.chung?"bấm để xem · theo Quy tắc phân bổ ở Sổ chi phí":so.whyC,so.chung),
     `<tr class="tb-sum"><td><span class="tb-car"></span>Lợi nhuận ròng kênh</td><td class="n">${ln==null?`<span class="hint">chưa có số</span>`:tbF(ln)}</td><td class="n">${ln==null?"":tbP(ln,dt)}</td><td class="hint">sau khi gánh hết chi phí riêng và chi chung</td></tr>`])}</section>`;
  /* Lãi sau quảng cáo theo nhóm hàng (riêng Facebook: chiến dịch đặt tên theo mã sản phẩm) */
  const dgP=s=>s?pill(s,/Lỗ|Dưới/.test(s)?"red":/mỏng/.test(s)?"amb":"grn"):"";
  const lines=`<section class="card"><div class="card-h"><h2>Lãi sau quảng cáo theo nhóm hàng</h2><span class="hint">quảng cáo gán theo mã trong tên chiến dịch · ROAS (doanh số Pancake / chi chưa thuế) hòa vốn ${String(FBBC_ROAS_HV).replace(".",",")} · "còn lại" = lãi gộp − quảng cáo − ship ${tbP(X.shipAll,1)}${X.cov.length&&X.unc.length?" · số tới "+fbvVn(X.lastCov):""}${X.chua?" · tháng chưa chốt: đơn mới chưa giao hết nên \"còn lại\" đang thấp hơn thực tế, xem ROAS là chính":""}</span></div>
   ${tbl(["Nhóm hàng","SL","Doanh thu","% kênh","Lãi gộp","Quảng cáo · ROAS","Còn lại","Đánh giá"],L.lines.map(x=>`<tr${/Lỗ|Dưới/.test(x.dg)?' style="background:rgba(240,160,32,.08)"':""}><td><b>${esc(x.n)}</b></td><td class="n">${nf(x.q)}</td><td class="n">${tr(x.dt)}</td><td class="n">${tbP(x.dt,L.dtAll)}</td><td class="n">${tr(x.lg)}</td><td class="n">${x.spend?tr(x.qcT)+" · "+tbX(x.roas):`<span class="hint">${x.k==="KH"?"không gán":"—"}</span>`}</td><td class="n${x.conPct!=null&&x.conPct<0?" t-red":""}">${x.k==="KH"?"—":x.conPct==null?"—":tbP(x.conPct,1)}</td><td>${dgP(x.dg)}</td></tr>`)
     .concat(L.unk.qcT?[`<tr><td class="hint">Quảng cáo chưa gán được nhóm hàng</td><td></td><td></td><td></td><td></td><td class="n">${tr(L.unk.qcT)}</td><td></td><td></td></tr>`]:[]))}</section>`;
  const P=fbvProds(X.cov.length?X.cov:X.days),pT=P.reduce((a,x)=>a+x.dt,0);
  const top=P.length?`<section class="card"><div class="card-h"><h2>Top sản phẩm theo doanh thu</h2><span class="hint">đơn giao thành công, giá vốn thật · lãi gộp chưa trừ ship, quảng cáo</span></div>
   ${tbl(["#","Sản phẩm","SL","Doanh thu","% kênh","Lãi gộp","Biên","Nhóm"],P.slice(0,8).map((x,i)=>`<tr><td><span class="tb-rk">${i+1}</span></td><td>${esc(x.n)}</td><td class="n">${nf(x.q)}</td><td class="n">${tr(x.dt)}</td><td class="n">${tbP(x.dt,pT)}</td><td class="n">${x.gv?tr(x.dt-x.gv):`<span class="hint">chưa có giá vốn</span>`}</td><td class="n">${x.gv&&x.dt>0?tbP(x.dt-x.gv,x.dt):"—"}</td><td class="hint">${esc((FBBC_LINES.find(Lz=>Lz[0]===fbbcLineOf(x.n,x.g))||[0,"Nhóm khác"])[1])}</td></tr>`)
     .concat(P.filter(x=>x.dt>=3e6&&x.dt-x.gv<0).slice(0,2).map(x=>`<tr style="background:rgba(240,160,32,.08)"><td></td><td>${esc(x.n)}</td><td class="n">${nf(x.q)}</td><td class="n">${tr(x.dt)}</td><td class="n">${tbP(x.dt,pT)}</td><td class="n t-red">${tr(x.dt-x.gv)}</td><td class="n t-red">âm</td><td>${pill("Lỗ ở giá vốn","red")}</td></tr>`)))}
   <div class="acts" style="justify-content:flex-end"><button class="btn sm" data-fbdtab="sp">Xem tất cả sản phẩm →</button></div></section>`:"";
  const lw=AL.last2?AL.last2[1]:null,A0=FBV.al==="tuan"?AL.AW:AL.AM;
  const side=`<aside class="tb-side"><section class="card"><div class="card-h"><h2>⚠️ Cảnh báo & đề xuất</h2></div>
    <div class="chips" style="margin:0 0 8px"><button class="chip${FBV.al==="tuan"?" on":""}" data-fbval="tuan">${lw?`Tuần ${lw.a}–${lw.b}/${X.lastK.slice(5,7)}`:"Tuần"}</button><button class="chip${FBV.al==="thang"?" on":""}" data-fbval="thang">Cả kỳ</button></div>
    ${A0.canh.length?`<h4>Cảnh báo</h4>${A0.canh.map(tbAl).join("")}`:`<p class="hint">${FBV.al==="tuan"&&!lw?"Chưa đủ 2 tuần số theo ngày để so.":"Không có cảnh báo."}</p>`}
    ${A0.de.length?`<h4>Đề xuất</h4>${A0.de.map(tbAl).join("")}`:""}</section></aside>`;
  m.innerHTML=head+kp+`<div class="tb-lay"><div>${co}${cost}${lines}${top}</div>${side}</div>`
   +srcNote("Doanh thu: đơn giao thành công trên Pancake (cùng số các trang khác). Giá vốn, phí ship: Sheet Pancake theo từng đơn. Quảng cáo: Facebook Ads cộng thuế. Chi riêng, chi chung: Sổ chi phí. Tỷ lệ hoàn dự kiến: tỷ lệ hoàn thật tháng gần nhất đã chốt.");
  fbvBind(m);
}
function fbvBind(m){
  m.querySelectorAll("[data-fbdtab]").forEach(b=>b.onclick=()=>{FBD.tab=b.dataset.fbdtab;renderMain()});
  m.querySelectorAll("[data-fbval]").forEach(b=>b.onclick=()=>{FBV.al=b.dataset.fbval;renderMain()});
  m.querySelectorAll("[data-tbtg]").forEach(tr=>tr.onclick=()=>{const k=tr.dataset.tbtg,L=m.querySelectorAll(`[data-tbs="${k}"]`),open=L.length&&L[0].style.display==="none";L.forEach(r=>r.style.display=open?"":"none");const c=m.querySelector(`[data-car="${k}"]`);if(c)c.textContent=open?"▾":"▸"});
  if(typeof fbdBindMet==="function")fbdBindMet(m);
}

/* ---------- Vận hành ---------- */
function fbvOps(m){
  adfLoad();fbsLoad();fbcLoad();adfMergeDays();
  const X=fbvData(),A=X.A,dt=X.dt;
  if(!X.days.length){m.innerHTML=H("Facebook · Hiệu quả Marketing & Sale","Kỳ này chưa có số.");return}
  const L=fbvLines(X),AL=fbvAlerts(X,L),todo=fbbcTodo({canh:AL.AW.canh.concat(AL.AM.canh)}),hr=A.giao+A.hoan?A.hoan/(A.giao+A.hoan):0,adsMax=AL.adsMax;
  const kp=`<div class="grid kpis">${kpi(X.dk!=null?"Doanh thu dự kiến":"Doanh thu thực",tr(X.dk!=null?X.dk:dt),X.dk!=null?fbvDkTxt(X):"đơn giao thành công · cùng số trang quản trị")}${kpi("Doanh thu chốt",tr(A.dtChot),nf(A.chot)+" đơn chốt · gồm đơn đang giao, sẽ hoàn")}${kpi("Đơn tạo",nf(A.tao),"chốt "+tbP(A.chot,A.tao)+" · hủy "+tbP(A.huy,A.tao))}${kpi("Chi phí quảng cáo",tr(X.qcT),tbP(X.qcT,X.dk||dt)+(X.dk!=null?" doanh thu dự kiến":" doanh thu thực")+" · ngưỡng "+tbP(adsMax,1))}${kpi("ROAS · chi / đơn chốt",tbX(X.qcT?A.dtChot/X.qcT:null),A.chot?nf(Math.round(X.qcT/A.chot))+"đ / đơn chốt":"")}${kpi("Hoàn",tbP(hr,1),nf(A.hoan)+" đơn · ngưỡng "+tbP(FBBC_HOAN,1),hr>FBBC_HOAN?"var(--red)":"")}</div>`;
  const td=`<section class="card" style="padding:10px 14px"><div class="tb-todo"><b>Việc cần làm (${todo.length}):</b>${todo.length?todo.map(x=>`<span class="pill ${x.lv==="r"?"red":"amb"}">${x.team?esc(x.team)+": ":""}${esc(x.t)}</span>`).join(""):`<span class="hint">không có việc gấp</span>`}</div></section>`;
  const row=(l,v)=>`<div class="row"><span>${l}</span><b>${v}</b></div>`,al=a=>`<div class="tb-al tb-${a.lv}" style="margin:8px 0 0"><b>${a.lv==="g"?"✓ ":""}${esc(a.t)}</b>${a.d?esc(a.d):""}</div>`;
  const card=(ic,bg,n,st,rows,als)=>`<div class="tb-team"><h3><span class="tb-ico" style="background:${bg}">${ic}</span>${n}<span style="margin-left:auto">${tbPill(st)}</span></h3>${rows}${als||""}</div>`;
  const C=AL.camps,sp=(f,t)=>C.filter(c=>t?c.typ===t:c.typ!=="Tin nhắn").reduce((a,c)=>a+(+c[f]||0),0),rw=sp("spend")?sp("rev")/sp("spend"):null,ri=sp("spend","Tin nhắn")?sp("rev","Tin nhắn")/sp("spend","Tin nhắn"):null;
  const bad=L.lines.filter(x=>/Lỗ|Dưới/.test(x.dg)),good=L.lines.filter(x=>x.pri==="Đẩy mạnh");
  const P=AL.P,kpiN=typeof FBS_KPI!=="undefined"?FBS_KPI:[],K=P?P.list.filter(x=>kpiN.includes(x.n)).sort((a,b)=>b.dt-a.dt):[],O=P?P.list.filter(x=>!kpiN.includes(x.n)):[],oS=f=>O.reduce((a,x)=>a+(+x[f]||0),0);
  const hd=P?P.list.reduce((a,x)=>a+(x.hd||0),0):0,mgr=P?P.list.find(x=>/quản lý/.test(x.n)):null,src=AL.src,sT=src.reduce((a,x)=>a+x.rev,0),lw=AL.last2;
  const cards=`<h3 style="margin:4px 0 8px">Hiệu quả từng team</h3><div class="tb-teams">
   ${card("📣","rgba(24,119,242,.12)","Digital (quảng cáo)",bad.length||X.qcT/(X.dk||dt)>adsMax?"Theo dõi":"Tốt",
     row("Chi quảng cáo (gồm thuế)",tr(X.qcT)+" · "+tbP(X.qcT,X.dk||dt))+row("ROAS chuyển đổi · tin nhắn",tbX(rw)+" · "+(ri!=null&&ri<FBBC_ROAS_HV?`<span class="t-red">${tbX(ri)}</span>`:tbX(ri)))
     +L.lines.filter(x=>x.spend).slice(0,3).map(x=>row("ROAS "+esc(x.n),x.roas<FBBC_ROAS_HV?`<span class="t-red">${tbX(x.roas)}</span>`:tbX(x.roas))).join("")+(L.unk.qcT?row("Chiến dịch chưa gán mã",tr(L.unk.qcT)):""),
     bad.length?al({lv:"a",t:bad.map(x=>x.n).join(", ")+" dưới hòa vốn / lỗ sau quảng cáo",d:good.length?"Đề xuất: dồn sang "+good.map(x=>x.n).join(", ")+".":""}):good.length?al({lv:"b",t:"Dồn quảng cáo sang "+good.map(x=>x.n).join(", "),d:""}):"")}
   ${card("☎️","rgba(91,75,219,.12)","Team Sale (chốt đơn)",K.some(x=>x.tao>=50&&x.huy/x.tao>FBBC_HUY)?"Theo dõi":"Tốt",
     (K.map(x=>row(esc(x.n),tr(x.dt)+" · "+(x.tao&&x.huy/x.tao>FBBC_HUY?`<span class="t-red">hủy ${tbP(x.huy,x.tao)}</span>`:"hủy "+tbP(x.huy,x.tao)))).join("")||row("Bán hàng theo người",`<span class="hint">chưa có số</span>`))
     +(O.length?row("Tài khoản quản lý, chưa gán",tr(oS("dt"))+" · "+nf(oS("tao"))+" đơn"):"")+row("TB / đơn chốt",A.chot?nf(Math.round(A.dtChot/A.chot))+"đ":"—"),
     K.filter(x=>x.tao>=50&&x.huy/x.tao>FBBC_HUY).slice(0,1).map(x=>al({lv:"r",t:`${x.n} hủy ${tbP(x.huy,x.tao)} (ngưỡng ${tbP(FBBC_HUY,1)})`,d:"Đề xuất: nghe lại cuộc gọi, sửa kịch bản chốt."})).join(""))}
   ${card("📦","rgba(224,49,49,.1)","CSKH & giao hàng",hr>FBBC_HOAN+0.02?"Kém":hr>FBBC_HOAN?"Theo dõi":"Tốt",
     row("Đơn hoàn · tỷ lệ",`<span${hr>FBBC_HOAN?' class="t-red"':""}>${nf(A.hoan)} · ${tbP(hr,1)}</span>`)+(hd?row("Doanh thu bị hoàn",tr(hd)):"")+row("Ship hoàn hai chiều",tr(X.shipRet))
     +(mgr&&mgr.giao+mgr.hoan?row("Hoàn ở tài khoản quản lý",nf(mgr.hoan)+" · "+tbP(mgr.hoan,mgr.giao+mgr.hoan)):"")+row("Tỷ lệ hoàn dự kiến cho đơn đang giao",tbP(X.RT.r,1)+(X.RT.ym?" (thật T"+X.RT.ym.slice(5)+")":"")),
     lw&&lw[0].hoan>=20&&lw[1].hoan>lw[0].hoan*1.3?al({lv:"r",t:`Tuần ${lw[1].a}–${lw[1].b} hoàn tăng ${tbP(lw[1].hoan-lw[0].hoan,lw[0].hoan)}`,d:"Đề xuất: gọi xác nhận trước giao, ghi lý do hoàn từng đơn."}):hr>FBBC_HOAN?al({lv:"a",t:"Hoàn vượt ngưỡng",d:"Đề xuất: gọi xác nhận trước giao, ghi lý do hoàn từng đơn."}):"")}
   ${card("🛒","rgba(23,128,74,.12)","Nguồn đơn & trang bán hàng",lw&&lw[1].dtChot<lw[0].dtChot*0.85?"Theo dõi":"Tốt",
     src.filter(x=>x.rev>0).slice(0,3).map(x=>row(esc(x.n),tr(x.rev)+" · "+tbP(x.rev,sT)+(x.o?" · hủy "+tbP(x.can,x.o):""))).join("")
     +(lw?row(`Doanh thu chốt tuần ${lw[0].a}–${lw[0].b} → ${lw[1].a}–${lw[1].b}`,tr(lw[0].dtChot)+" → "+tr(lw[1].dtChot))+row(`Đơn tạo tuần ${lw[1].a}–${lw[1].b}`,nf(lw[1].tao)+(lw[0].tao?" · "+(lw[1].tao>=lw[0].tao?"+":"−")+tbP(Math.abs(lw[1].tao-lw[0].tao),lw[0].tao):"")):""),"")}</div>`;
  const PR=fbvProds(X.cov.length?X.cov:X.days),pT=PR.reduce((a,x)=>a+x.dt,0),lineOf=x=>L.lines.find(l=>l.k===fbbcLineOf(x.n,x.g));
  const topP=PR.length?`<section class="card"><div class="card-h"><h2>Top sản phẩm bán chạy</h2><span class="hint">team thấy số bán và ROAS nhóm hàng, không thấy lãi · "Ưu tiên quảng cáo" do web tính từ lãi sau quảng cáo bên quản trị</span></div>
   ${tbl(["#","Sản phẩm","Số bán","Doanh thu","% kênh","ROAS nhóm","Ưu tiên quảng cáo"],PR.slice(0,8).map((x,i)=>{const l=lineOf(x);return `<tr><td><span class="tb-rk">${i+1}</span></td><td>${esc(x.n)}</td><td class="n">${nf(x.q)}</td><td class="n">${tr(x.dt)}</td><td class="n">${tbP(x.dt,pT)}</td><td class="n">${l&&l.roas!=null?tbX(l.roas):"—"}</td><td>${l&&l.pri?tbPill(l.pri):""}</td></tr>`}))}</section>`:"";
  const old=document.createElement("div");try{pFbdash(old,true)}catch(e){}
  m.innerHTML=H("Facebook · Hiệu quả Marketing & Sale",`${esc(pLabel())} · số tự cập nhật mỗi sáng từ Pancake, Facebook Ads`)+kp+td+cards+topP
   +`<details class="card"><summary><b>Số chi tiết: chỉ số theo ngày, nguồn đơn, nhân viên, nhóm sản phẩm</b></summary>${old.innerHTML.replace(/^<div class="ph">[\s\S]*?<\/div><\/div>/,"")}</details>`
   +srcNote("Pancake (đơn, doanh thu theo ngày tạo đơn), Facebook Ads (chi phí), Sheet Pancake (sản phẩm).");
  fbvBind(m);
}
PAGES.bc_fb=m=>{if(fbdFull())return FBD.tab==="pl"?fbvAdm(m):pFbPL(m);fbvOps(m)};
