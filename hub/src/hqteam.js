/* =====================================================================
   HIỆU QUẢ TEAM (trang vận hành), chị Hoa duyệt 25/10/2026.
   Một trang cho lead và nhân viên xem kết quả của từng team trong kỳ đã chọn: doanh số, đơn, tỷ lệ, xếp hạng từng người.
   KHÔNG có giá vốn, phí sàn, lãi (riêng chi phí quảng cáo vẫn hiện vì là kết quả của team Ads).
   Nguồn: TikTok (file team TikTok tải), Pancake (sale Facebook), báo cáo Ads, CRM B2B (nhân viên chỉ thấy số của mình).
   ===================================================================== */
const HQ={b2b:{},busy:{}};
async function hqLoadB2b(mo){if(HQ.b2b[mo]!==undefined||HQ.busy[mo])return;HQ.busy[mo]=1;try{HQ.b2b[mo]=await svApi("/api/dashboards/sales?period="+mo)}catch(e){HQ.b2b[mo]=null}HQ.busy[mo]=0;if(PAGE==="hq")renderMain()}
const hqPct=(a,b)=>b?(a/b*100).toFixed(1).replace(".",",")+"%":"—";
const hqRow=(cols,cls)=>`<tr${cls?` class="${cls}"`:""}>${cols.map((c,i)=>`<td${i>1?' class="n"':""}>${c}</td>`).join("")}</tr>`;
function hqCard(o){
  return `<section class="card"><div class="card-h"><h2>${o.t}</h2>${o.sub?`<span class="hint">${o.sub}</span>`:""}${o.go?`<button class="lnk" data-go="${o.go}">Chi tiết →</button>`:""}</div>
   ${o.k&&o.k.length?`<div class="xkstrip" style="grid-template-columns:repeat(${Math.min(o.k.length,5)},minmax(0,1fr));box-shadow:none;margin-bottom:12px">${o.k.map(([l,v,h])=>`<div class="xk ro${v==="—"?" mut":""}" style="min-height:0"><span class="xkl">${l}</span><span class="xkv numeric" style="font-size:22px">${v==="—"?"Chưa có số":v}</span><span class="xkm">${h||""}</span></div>`).join("")}</div>`:""}
   ${o.body||""}${o.note?`<p class="hint">${o.note}</p>`:""}</section>`;
}
function pHieuQuaTeam(m){
  try{if(typeof adfLoad==="function"){adfLoad();adfMergeDays()}if(typeof fbsLoad==="function")fbsLoad();if(typeof tsbLoadAll==="function")tsbLoadAll()}catch(e){}
  const days=pDays(),g=(s,i)=>pSum(s,i).v,cards=[];
  /* TikTok Shop */
  {const A=typeof TSB!=="undefined"&&TSB.all?tsbOpsAgg(PERIOD.from,PERIOD.to):null,K=A?A.km:{},gmv=K.gmv||0,ads=A?Math.round((A.ads.chi||0)*1.1):0;
   const R=A?(TSB.all.ranges||[]).filter(r=>r.kind==="creators"&&r.from<=PERIOD.to&&r.to>=PERIOD.from).sort((a,b)=>b.to.localeCompare(a.to))[0]:null;
   cards.push(hqCard({t:"TikTok Shop",go:"bc_tiktok",sub:A?`${A.nKm} ngày có số`:"đang tải",k:[["GMV",gmv?tr(gmv):"—",K.don?nf(K.don)+" đơn":""],["ROAS trên GMV",ads&&gmv?(gmv/ads).toFixed(2).replace(".",","):"—",ads?"quảng cáo "+tr(ads):""],["Video inhouse",K.vInh?tr(K.vInh):"—",hqPct(K.vInh,gmv)+" GMV"],["Video KOC",K.vKoc?tr(K.vKoc):"—",hqPct(K.vKoc,gmv)+" GMV"],["LIVE",(K.lShop||0)+(K.lKoc||0)?tr((K.lShop||0)+(K.lKoc||0)):"—",hqPct((K.lShop||0)+(K.lKoc||0),gmv)+" GMV"]],
    body:R?`<h3>KOC bán tốt nhất</h3>${tbl(["#","Nhà sáng tạo","GMV","Đơn","Hoa hồng ước tính"],R.data.top.slice(0,5).map((x,i)=>hqRow([i+1,`<b>${esc(x.u)}</b>`,tr(x.gmv),nf(x.don),tr(x.hh)])))}`:"",
    note:A&&!A.nKm?"Kỳ này team TikTok chưa tải file Key metrics (Marketing › Nhập báo cáo).":""}))}
  /* Facebook: sale */
  {const P=typeof fbsPeople==="function"?fbsPeople(days):null,tao=g("fb",0),chot=g("fb",1),huy=g("fb",2),hoan=g("fb",3),giao=g("fb",4);
   cards.push(hqCard({t:"Sale Facebook",go:"fb_sale",sub:"Pancake, theo người xử lý đơn",k:[["Doanh thu chốt",g("fb",6)?tr(g("fb",6)):"—",nf(chot)+" đơn chốt"],["Tỷ lệ chốt",tao?hqPct(chot,tao):"—",nf(tao)+" đơn tạo"],["Tỷ lệ hủy",tao?hqPct(huy,tao):"—",nf(huy)+" đơn"],["Tỷ lệ hoàn",giao+hoan?hqPct(hoan,giao+hoan):"—",nf(hoan)+" đơn"]],
    body:P&&P.list.length?tbl(["#","Người xử lý đơn","Doanh thu","Đơn tạo","Chốt","Tỷ lệ chốt","Tỷ lệ hủy","Hoàn"],P.list.filter(x=>x.tao).sort((a,b)=>b.dt-a.dt).map((x,i)=>hqRow([i+1,`<b>${esc(x.n)}</b>`,tr(x.dt),nf(x.tao),nf(x.tao-x.huy),hqPct(x.tao-x.huy,x.tao),`<span class="${x.tao>=20&&x.huy/x.tao>.2?"t-red":""}">${hqPct(x.huy,x.tao)}</span>`,nf(x.hoan)]))):""}))}
  /* Ads Facebook (Digital) */
  {const A=typeof adsSum==="function"?adsSum():{},L=Object.entries(A).filter(([,a])=>a.n),T=L.reduce((s,[,a])=>({chi:s.chi+a.chi,dt:s.dt+a.dt,don:s.don+a.don,data:s.data+a.data}),{chi:0,dt:0,don:0,data:0});
   cards.push(hqCard({t:"Ads Facebook (Digital)",go:"fb_ads",sub:"báo cáo Digital, chi trước thuế",k:[["Chi quảng cáo",T.chi?tr(T.chi):"—",""],["Doanh số từ ads",T.dt?tr(T.dt):"—",nf(T.don)+" đơn chốt"],["ROAS",T.chi?(T.dt/T.chi).toFixed(2).replace(".",","):"—","doanh số ÷ chi"],["Chi mỗi đơn",T.don?tr(T.chi/T.don):"—",""]],
    body:L.length?tbl(["#","Người chạy ads","Chi","Doanh số","ROAS","Đơn","Chi / đơn"],L.sort((a,b)=>b[1].dt-a[1].dt).map(([n,a],i)=>hqRow([i+1,`<b>${esc(typeof adfWho==="function"?adfWho(n):n)}</b>`,tr(a.chi),tr(a.dt),a.chi?`<span class="${a.dt/a.chi<1.8?"t-red":""}">${(a.dt/a.chi).toFixed(2).replace(".",",")}</span>`:"—",nf(a.don),a.don?tr(a.chi/a.don):"—"]))):"",
    note:L.length?"ROAS dưới 1,8 (ngưỡng hành động của kênh Facebook) tô đỏ.":""}))}
  /* Phân phối: sale B2B (CRM) */
  {const ms=[...new Set(days.map(d=>d.slice(0,7)))];ms.forEach(hqLoadB2b);const S=ms.map(k=>HQ.b2b[k]).filter(Boolean),done=ms.every(k=>HQ.b2b[k]!==undefined);
   const ov=S.reduce((a,s)=>{const o=s.overview||{};a.rev+=+o.revenue||0;a.ord+=+o.orders||0;a.newc+=+o.new_first_order_customers||0;return a},{rev:0,ord:0,newc:0});
   const by={};S.forEach(s=>(s.by_sale||[]).forEach(x=>{const t=by[x.user_id]||(by[x.user_id]={n:x.display_name,rev:0,ord:0,newc:0,col:0});t.rev+=+x.revenue||0;t.ord+=+x.orders||0;t.newc+=+x.new_customers||0;t.col+=+x.collected||0}));
   const P=Object.values(by).filter(x=>x.rev||x.ord).sort((a,b)=>b.rev-a.rev);
   /* Đơn không có sale phụ trách (thường là đơn nhập từ file cũ) vẫn nằm trong tổng: hiện một dòng để cộng đủ. */
   const isEmp=SV&&SV.me&&SV.me.role==="EMPLOYEE",rest={rev:ov.rev-P.reduce((a,x)=>a+x.rev,0),ord:ov.ord-P.reduce((a,x)=>a+x.ord,0)};
   if(!isEmp&&(rest.rev>1000||rest.ord>0))P.push({n:"(đơn chưa gán sale)",rev:rest.rev,ord:rest.ord,newc:0,col:0,chua:1});
   cards.push(hqCard({t:"Phân phối (Sale B2B)",go:"b2b_perf",sub:ms.length>1?"tính theo tháng: "+ms.map(k=>k.slice(5)+"/"+k.slice(0,4)).join(", "):"tính theo tháng "+(ms[0]||"").slice(5),k:[["Doanh số",ov.rev?tr(ov.rev):done?"—":"…",nf(ov.ord)+" đơn đã duyệt"],["Giá trị đơn trung bình",ov.ord?tr(ov.rev/ov.ord):"—",""],["Khách mới",ov.newc?nf(ov.newc):"—","đặt đơn đầu tiên"]],
    body:P.length?tbl(["#","Sale","Doanh số","Đơn","Khách mới","Đã thu"],P.map((x,i)=>hqRow([x.chua?"":i+1,x.chua?`<span class="t-red">${esc(x.n)}</span>`:`<b>${esc(x.n)}</b>`,tr(x.rev),nf(x.ord),x.chua?"—":nf(x.newc),x.chua?"—":tr(x.col)]))):"",
    note:isEmp?"Bạn chỉ thấy số của chính mình.":rest.rev>1000?"Đơn chưa gán sale phụ trách: kế toán hoặc quản lý gán sale cho khách trên CRM thì số tự chia về từng người.":""}))}
  /* Shopee */
  {const dt=g("spe",0);cards.push(hqCard({t:"Shopee",go:"bc_shopee",k:[["Doanh thu",dt?tr(dt):"—",dt?nf(g("spe",4))+" đơn":"chưa có số trong kỳ"]],note:dt?"":"Chưa có số Shopee theo ngày trên web."}))}
  m.innerHTML=H("Hiệu quả team",esc(pLabel())+" · doanh số, đơn, tỷ lệ và xếp hạng từng người")+`<p class="hint" style="margin:-4px 0 12px">Chọn kỳ ở ô ngày phía trên. Bấm "Chi tiết" để xem trang riêng của từng team.</p>`+cards.join("");
}
PAGES.hq=pHieuQuaTeam;
/* Menu trang vận hành: "Hiệu quả team" ngay dưới "Tổng quan". */
if(typeof HOST_MODE==="undefined"||HOST_MODE!=="admin"){
  const i=MODULES.findIndex(x=>x.k==="exec");
  MODULES.splice(i>=0?i+1:0,0,{k:"hq",zone:"",ic:"users",n:"Hiệu quả team",sub:"",groups:()=>[["",[MI("hq","Hiệu quả team")]]]});
}
