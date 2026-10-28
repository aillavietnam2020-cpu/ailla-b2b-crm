/* =====================================================================
   TRANG FACEBOOK BẢN MỚI — hàm tính thuần (chị Hoa duyệt demo 28/10/2026, cùng khung TikTok / Shopee).
   - fbbcHoan: tỷ lệ hoàn thật một tháng (đơn hoàn / (giao thành công + hoàn)) từ DAYD.fb → tỷ lệ hoàn dự kiến cho đơn đang giao.
   - fbbcLines: lãi sau quảng cáo theo nhóm hàng (quảng cáo gán theo mã trong tên chiến dịch, adfParse ở adsday.js).
   - fbbcWeeks / fbbcLast2: số theo khối 7 ngày để so tuần (so theo doanh thu chốt: đơn tuần gần nhất chưa kịp giao nên doanh thu giao thành công luôn thấp). fbbcAlerts: cảnh báo & đề xuất tuần / tháng.
   DAYD.fb[ngày] = [đơn tạo, chốt, hủy, hoàn, giao thành công, doanh thu giao thành công, doanh thu chốt, giá vốn ước, …].
   ===================================================================== */
const FBBC_LINES=[["TL","Tẩy lồng giặt",["TLAI","AIBIO","TLG"],/t[ẩa]y\s*l[ồo]ng/i],["TD","Tinh dầu giặt sấy",["TINHDAU"],/tinh\s*d[ầa]u/i],
  ["LS","Lau sàn",["LS"],/lau\s*s[àa]n/i],["CT","Kiểm soát côn trùng",["MUOI","RUOI"],/mu[ỗo]i|ru[ồo]i|gi[áa]n|c[ôo]n\s*tr[ùu]ng/i]];
const FBBC_ROAS_HV=1.8,FBBC_HOAN=0.09,FBBC_HUY=0.2;
const fbbcF=v=>(Math.round(v*1000)/10).toString().replace(".",",")+"%";
const fbbcLineOf=(n,g)=>{for(const L of FBBC_LINES)if(g===L[1]||L[3].test(n||""))return L[0];return "KH"};

/* Tỷ lệ hoàn thật của tháng ym; null khi chưa đủ 200 đơn có kết quả. */
function fbbcHoan(dayd,ym){let h=0,g=0;for(const k in dayd||{})if(k.slice(0,7)===ym){const r=dayd[k]||[];h+=+r[3]||0;g+=+r[4]||0}return h+g>=200?h/(h+g):null}

/* prods = [{n, g, q, dt, gv}] (đơn giao thành công, Sheet Pancake), camps = [{prod, spend, rev}] (chi chưa thuế, doanh số Pancake ghép),
   tax = hệ số ra tiền Facebook trừ (gồm thuế), ship = tỷ lệ vận chuyển + ship hoàn trên doanh thu. */
function fbbcLines({prods,camps,tax,ship}){
  const M={};const get=k=>M[k]||(M[k]={k,n:k==="KH"?"Nhóm khác":FBBC_LINES.find(L=>L[0]===k)[1],q:0,dt:0,gv:0,spend:0,rev:0,sp:[]});
  (prods||[]).forEach(p=>{const x=get(fbbcLineOf(p.n,p.g));x.q+=+p.q||0;x.dt+=+p.dt||0;x.gv+=+p.gv||0;x.sp.push(p)});
  let unk=0;(camps||[]).forEach(c=>{const L=FBBC_LINES.find(L=>L[2].includes(c.prod));if(!L){unk+=+c.spend||0;return}const x=get(L[0]);x.spend+=+c.spend||0;x.rev+=+c.rev||0});
  const dtAll=Object.values(M).reduce((a,x)=>a+x.dt,0),t=tax||1;
  const lines=Object.values(M).filter(x=>x.dt>0||x.spend>0).map(x=>{const lg=x.dt-x.gv,qcT=x.spend*t,con=lg-qcT-x.dt*(ship||0),conPct=x.dt>0?con/x.dt:null,roas=x.spend?x.rev/x.spend:null;
    let dg="",pri="";
    if(x.k==="KH"){dg="";pri=""}
    else if(roas!=null&&x.spend>=3e6&&roas<FBBC_ROAS_HV){dg="Dưới hòa vốn";pri="Giảm"}
    else if(conPct!=null&&conPct<0){dg="Lỗ sau quảng cáo";pri="Giảm"}
    else if(conPct!=null&&conPct<0.1){dg="Biên mỏng";pri="Giữ mức"}
    else if(dtAll&&x.dt/dtAll<0.02){dg="Gánh được ads";pri="Thử thêm"}
    else{dg="Gánh được ads";pri="Đẩy mạnh"}
    return {...x,lg,qcT,con,conPct,roas,dg,pri}}).sort((a,b)=>(a.k==="KH")-(b.k==="KH")||b.dt-a.dt);
  return {lines,unk:{spend:unk,qcT:unk*t},dtAll};
}

/* Khối 7 ngày của tháng ky: đơn tạo, chốt, hủy, hoàn, giao, doanh thu giao thành công, doanh thu chốt, quảng cáo (qcOf: tiền / ngày). */
function fbbcWeeks(dayd,ky,qcOf){
  const last=new Date(+ky.slice(0,4),+ky.slice(5,7),0).getDate(),out=[];
  for(let a=1;a<=last;a+=7){const b=Math.min(last,a+6),w={a,b,tao:0,chot:0,huy:0,hoan:0,giao:0,dt:0,dtChot:0,qc:0,n:0};
    for(let d=a;d<=b;d++){const k=ky+"-"+String(d).padStart(2,"0"),r=(dayd||{})[k];if(qcOf)w.qc+=+qcOf(k)||0;if(!r)continue;w.n++;
      w.tao+=+r[0]||0;w.chot+=+r[1]||0;w.huy+=+r[2]||0;w.hoan+=+r[3]||0;w.giao+=+r[4]||0;w.dt+=+r[5]||0;w.dtChot+=+r[6]||0}
    w.du=w.n===b-a+1;out.push(w)}
  return out;
}
const fbbcLast2=W=>{const F=(W||[]).filter(w=>w.du&&w.b-w.a===6&&w.dtChot>0);return F.length>=2?[F[F.length-2],F[F.length-1]]:null};

/* Cảnh báo & đề xuất. Tuần: last2. Tháng: M = {dt, qcT, tao, huy, hoan, giao}, L = fbbcLines, people = fbsPeople().list, src = fbdSources, kpi = tên người tính KPI. */
function fbbcAlerts({last2,M,L,people,src,kpi,adsMax}){
  const canh=[],de=[],mx=adsMax||0.38,rt=(h,g)=>h+g?h/(h+g):0,tr1=v=>(Math.round(v/1e5)/10).toString().replace(".",",")+"tr";
  if(last2){const [p,c]=last2,hp=rt(p.hoan,p.giao),hc=rt(c.hoan,c.giao);
    if(p.hoan>=20&&c.hoan>p.hoan*1.3)canh.push({lv:hc>FBBC_HOAN?"r":"a",t:`Đơn hoàn tăng ${fbbcF(c.hoan/p.hoan-1)}: ${c.hoan} đơn`,d:`Tuần trước ${p.hoan} đơn; tỷ lệ ${fbbcF(hp)} → ${fbbcF(hc)}.`,ai:"CSKH + Sale"});
    if(p.dtChot>0&&c.dtChot<p.dtChot*0.85)canh.push({lv:c.dtChot<p.dtChot*0.75?"r":"a",t:`Doanh thu chốt tuần ${c.a}–${c.b} giảm ${fbbcF(1-c.dtChot/p.dtChot)}`,d:`${tr1(p.dtChot)} → ${tr1(c.dtChot)}.`,ai:"Team Digital + Sale"});
    if(c.dtChot&&c.qc/c.dtChot>mx)canh.push({lv:"a",t:`Quảng cáo ${fbbcF(c.qc/c.dtChot)} doanh thu chốt tuần, trên ngưỡng ${fbbcF(mx)}`,ai:"Team Digital"});
    if(c.tao>=50&&c.huy/c.tao>FBBC_HUY)canh.push({lv:"a",t:`Hủy tuần ${c.a}–${c.b} ${fbbcF(c.huy/c.tao)}`,ai:"Team Sale"});
    if(hc>FBBC_HOAN)de.push({lv:"b",t:"Gọi xác nhận đơn trước khi giao",d:"Ưu tiên đơn trang bán hàng, giá trị cao."});
    if(p.dtChot>0&&c.dtChot>=p.dtChot*1.05)de.push({lv:"g",t:`Doanh thu chốt tuần +${fbbcF(c.dtChot/p.dtChot-1)}`,d:`${tr1(p.dtChot)} → ${tr1(c.dtChot)}${p.qc?", quảng cáo "+(c.qc>=p.qc?"+":"−")+fbbcF(Math.abs(c.qc/p.qc-1)):""}.`})}
  if(M&&M.dt){const qp=M.qcT/M.dt,hr=rt(M.hoan,M.giao);
    if(qp>mx)canh.push({lv:"r",t:`Quảng cáo ${fbbcF(qp)} doanh thu, ngưỡng ${fbbcF(mx)}`,d:`Mỗi 1 điểm giảm được ≈ ${tr1(M.dt*0.01)}.`,ai:"Team Digital"});
    if(hr>FBBC_HOAN)canh.push({lv:hr>FBBC_HOAN+0.02?"r":"a",t:`Hoàn ${fbbcF(hr)} (ngưỡng ${fbbcF(FBBC_HOAN)})`,d:`${M.hoan} đơn hoàn.`,ai:"CSKH + Sale"});
    if(M.tao&&M.huy/M.tao>FBBC_HUY)canh.push({lv:"a",t:`Hủy ${fbbcF(M.huy/M.tao)} (ngưỡng ${fbbcF(FBBC_HUY)})`,ai:"Team Sale"});
    (L?L.lines:[]).filter(x=>x.dg==="Dưới hòa vốn"||x.dg==="Lỗ sau quảng cáo").forEach(x=>canh.push({lv:"a",t:`${x.n}: ${x.dg.toLowerCase()}`,d:x.roas!=null?`ROAS ${String(Math.round(x.roas*100)/100).replace(".",",")}, chi ${tr1(x.qcT)}.`:"",ai:"Team Digital"}));
    const qcAll=L?L.lines.reduce((a,x)=>a+x.qcT,0)+L.unk.qcT:0;
    if(L&&qcAll&&L.unk.qcT/qcAll>0.1)canh.push({lv:"a",t:`${tr1(L.unk.qcT)} quảng cáo chưa gán được nhóm hàng`,d:"Tên chiến dịch không theo mã sản phẩm.",ai:"Team Digital"});
    (people||[]).forEach(x=>{const isK=(kpi||[]).includes(x.n);if(isK&&x.tao>=50&&x.huy/x.tao>FBBC_HUY)canh.push({lv:"a",t:`${x.n} hủy ${fbbcF(x.huy/x.tao)}`,ai:"Team Sale"});
      if(!isK&&x.giao+x.hoan>=100&&rt(x.hoan,x.giao)>0.15)canh.push({lv:"a",t:`${x.n}: hoàn ${fbbcF(rt(x.hoan,x.giao))}`,d:`${x.hoan} đơn hoàn.`,ai:"Sale gán người, CSKH"})});
    const S=src||[],ib=S.find(s=>/inbox|tin nh[ắa]n|messenger/i.test(s.n));
    const good=(L?L.lines:[]).filter(x=>x.pri==="Đẩy mạnh").slice(0,2);
    if(good.length)de.push({lv:"b",t:`Dồn quảng cáo sang ${good.map(x=>x.n).join(", ")}`,d:`Còn lại ${good.map(x=>fbbcF(x.conPct)).join(" và ")} sau quảng cáo + ship.`});
    if(ib&&M.inboxQc&&ib.rev&&M.webQc&&M.webRev&&M.inboxQc/ib.rev>M.webQc/M.webRev*1.2)de.push({lv:"b",t:"Cắt bớt chiến dịch tin nhắn",d:`Inbox tốn ${Math.round(M.inboxQc/ib.rev*100)}đ quảng cáo / 100đ doanh số, trang bán hàng ${Math.round(M.webQc/M.webRev*100)}đ.`});
    if(L&&qcAll&&L.unk.qcT/qcAll>0.1)de.push({lv:"b",t:"Đặt tên chiến dịch đúng mã sản phẩm",d:"Để web tính được lãi sau quảng cáo cho phần tiền còn lại."});
    if(qp<=mx)de.push({lv:"g",t:`Quảng cáo ${fbbcF(qp)} < ngưỡng ${fbbcF(mx)}`})}
  return {canh,de};
}
const fbbcTodo=A=>(A.canh||[]).filter(x=>x.lv==="r"||x.lv==="a").slice(0,4).map(x=>({lv:x.lv,team:x.ai||"",t:x.t}));
