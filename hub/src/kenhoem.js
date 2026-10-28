/* =====================================================================
   TRANG KÊNH OEM BẢN MỚI (chị Hoa duyệt demo 28/10/2026, demo do chat Báo cáo sàn làm). Thay trang bc_gc cũ (b2bpl.js + dashb2b.js)
   và bản vận hành gc_tq. Cùng cách làm Kênh phân phối (kenhpp.js, dùng chung các hàm kp*).
   - Quản trị: 6 ô; công nợ (phải thu, ≤30 / 31–60 / >60, DSO, bảng đơn nợ) với cột cảnh báo & đề xuất dọc bên phải (không trượt
     theo, không rơi xuống dưới); bên dưới rộng hết trang: top đối tác OEM, cơ cấu chi phí bấm xổ, top đơn / sản phẩm OEM.
   - Vận hành (phụ trách OEM, sản xuất; không có giá vốn, lãi): doanh thu, chờ duyệt, đang sản xuất, sắp đến hạn giao 7 ngày
     (theo ngày "cần hàng" của đơn), trễ hạn, chờ thu tiền; việc cần làm; 4 thẻ; sản phẩm OEM bán ra.
   Doanh thu, giá vốn, lãi lấy từ dòng Kênh OEM của tqKenhRows (cùng số Tổng quan, Lãi lỗ, Đối chiếu). Không ước giá vốn.
   Công nợ tính từ đơn đã xuất kho chưa thu đủ tiền (gồm đơn kế toán chưa xác nhận), không dựa bảng tuổi nợ chung.
   ===================================================================== */
const KO={key:"",d:null,busy:false,err:"",al:"tuan",open:{}};
async function koLoad(){const key=PERIOD.from+"|"+PERIOD.to;if(KO.busy||(KO.key===key&&(KO.d||KO.err)))return;
  KO.busy=true;KO.key=key;KO.err="";
  const pf=plYmAdd(PERIOD.from.slice(0,7),-1)+"-01",since=kpAdd(PERIOD.from,-92)<pf?kpAdd(PERIOD.from,-92):pf;
  try{KO.d=await svApi(`/api/dashboards/kenh-pp?channel=GIA_CONG&from=${PERIOD.from}&to=${PERIOD.to}&since=${since}`)}catch(e){KO.d=null;KO.err=e.message||"Không tải được đơn Kênh OEM"}
  KO.busy=false;if(["bc_gc","gc_tq"].includes(PAGE))renderMain()}

const KO_XUAT=o=>o.delivery_status==="DA_XUAT_KHO"||o.delivery_status==="DA_GIAO"||o.kho_status==="DA_XUAT"||o.kho_status==="DA_CHOT_TIEN";
const KO_CHO_HANG=o=>o.kho_status==="THIEU_HANG"||o.kho_status==="CHO_HANG";
function koCalc(d){
  const K=kpCalc(d),ref=K.ref,O=d.orders||[],ok=O.filter(kpOk);
  const name=id=>(K.C.get(id)||{}).name||"";
  /* công nợ: đơn đã xuất kho chưa thu đủ */
  const no=ok.filter(KO_XUAT).map(o=>({...o,left:(+o.total_amount||0)-(+o.received||0),age:kpDays(String(o.delivered_at||o.order_date).slice(0,10),ref)})).filter(o=>o.left>0).sort((a,b)=>b.age-a.age);
  const b30=no.filter(o=>o.age<=30).reduce((a,o)=>a+o.left,0),b60=no.filter(o=>o.age>30&&o.age<=60).reduce((a,o)=>a+o.left,0),bx=no.filter(o=>o.age>60).reduce((a,o)=>a+o.left,0),debt=b30+b60+bx;
  const first=[...K.C.values()].map(c=>c.first_order).filter(Boolean).sort()[0]||"",d90=kpAdd(ref,-90);
  const rev90=ok.filter(o=>KO_XUAT(o)&&o.order_date>=d90&&o.order_date<=ref).reduce((a,o)=>a+(+o.total_amount||0),0);
  const dso=first&&first<=d90&&rev90?Math.round(debt/rev90*90):null;
  /* sản xuất, hạn giao */
  const open=ok.filter(o=>!KO_XUAT(o)),d7=kpAdd(ref,7);
  const sx=open.filter(KO_CHO_HANG),chuaSx=open.filter(o=>!KO_CHO_HANG(o)),sap=open.filter(o=>o.need_date&&o.need_date>=ref&&o.need_date<=d7),tre=open.filter(o=>o.need_date&&o.need_date<ref);
  const noNeed=K.cur.filter(o=>!o.need_date).length;
  return {...K,name,no,b30,b60,bx,debt,dso,rev90,first,open,sx,chuaSx,sap,tre,noNeed,cho:O.filter(o=>o.approval_status==="PENDING_APPROVAL")};
}
const koTag=t=>`<span class="pill p-gry">${esc(t||"chưa có số")}</span>`;
const koNoSt=o=>o.kho_status==="DA_CHOT_TIEN"?pill("Đã chốt tiền, chờ thu","amb"):o.delivery_status==="DA_GIAO"?pill("Đã giao, chờ thu","amb"):pill("Đã xuất kho, chờ chốt tiền","amb");

function koAdm(m,K,X,r){
  const dt=r.dt||0,cv=X.covRev,gv=r.gv,ngv=X.uncovRev>0?X.uncovRev:0,lai=r.lai,chia=r.chia||0,pm=K.pym.slice(5);
  const one=PERIOD.from.slice(0,7)===PERIOD.to.slice(0,7),ym=PERIOD.from.slice(0,7),PB=one&&typeof dtPB==="function"?dtPB(ym):null;
  const S=typeof dtSoCp==="function"?dtSoCp(PERIOD.from,PERIOD.to):null,gd=(S&&S.gd&&S.gd.gc)||{},gName=g=>typeof scG==="function"?scG(g).n:g;
  const cpL=[];if(X.bonus)cpL.push({n:"Thưởng, chiết khấu trên đơn",t:X.bonus,h:""});
  Object.entries(gd).sort((a,b)=>b[1]-a[1]).forEach(([g,t])=>{if(t)cpL.push({n:gName(g),t,h:"Sổ chi phí"})});if(r.luong)cpL.push({n:"Lương phụ trách OEM",t:r.luong,h:"bảng lương đã chốt"});
  const cp=cpL.reduce((a,x)=>a+x.t,0),hasChia=chia>0,ln=hasChia&&lai!=null?lai-chia:null,miss=[...X.miss.values()].sort((a,b)=>b.rev-a.rev);
  const whyChia=!one?"chọn một tháng để xem chi chung phân bổ":PB&&PB.loi&&PB.loi.length?"chưa chia được: "+PB.loi[0]:"Sổ chi phí tháng này chưa chia";
  const kp=`<div class="grid kpis">${kpi("Doanh thu thực",tr(dt),`${nf(X.orders)} đơn · ${K.buyers.length} khách · tháng ${pm} ${K.pdt?tr(K.pdt):koTag()}`)}${kpi("Giá vốn",X.cover?tr(gv):"—",(X.cover?kpP(gv,cv)+` doanh thu hàng có giá vốn (${tr(cv)})`:"")+(ngv?`${X.cover?"<br>":""}<span class="t-red">${tr(ngv)} hàng chưa có giá vốn</span> (${miss.length} mã)`:""))}${kpi("Chi phí kênh",cp?tr(cp):"—",cp?kpP(cp,dt)+" doanh thu · "+cpL.map(x=>x.n+" "+tr(x.t)).join(", "):"Sổ chi phí chưa có khoản nào cho Kênh OEM")}${kpi("Lãi đóng góp kênh",lai==null?"—":tr(lai),lai==null?"chờ giá vốn":kpP(lai,dt)+" · trước chi chung","var(--green)")}${kpi("Chi chung phân bổ",hasChia?tr(chia):"—",hasChia?"theo Quy tắc phân bổ ở Sổ chi phí":whyChia)}${kpi("Lãi ròng kênh",ln==null?"—":tr(ln),ln==null?(lai==null?"chờ giá vốn, chi chung":"chờ chi chung"):kpP(ln,dt)+" · sau chi chung","var(--green)")}</div>`;
  /* công nợ */
  const T=K.debt||1,seg=[["≤30 ngày",K.b30,"#17804a"],["31–60 ngày",K.b60,"#f0a020"],["Trên 60 ngày",K.bx,"#c0392b"]].filter(s=>s[1]>0);
  const nKh=new Set(K.no.map(o=>o.customer_id)).size;
  const no=`<section class="card"><div class="card-h"><h2>Công nợ Kênh OEM</h2><span class="hint">tính đến ${kpVn(K.ref)} · đơn đã xuất kho chưa thu đủ tiền</span></div>
    <div class="grid kpis" style="margin-bottom:10px">${kpi("Phải thu",tr(K.debt),K.no.length?`${nKh} khách · ${K.no.length} đơn chưa thu`:"không có đơn nợ")}${kpi("≤30 ngày",tr(K.b30),K.no.filter(o=>o.age<=30).length===1?"đơn "+kpVn(K.no.find(o=>o.age<=30).order_date):"")}${kpi("31–60 ngày",tr(K.b60),"")}${kpi("Trên 60 ngày",tr(K.bx),"",K.bx?"var(--red)":"")}${kpi("DSO",K.dso==null?"—":K.dso+" ngày",K.dso==null?"chưa đủ 90 ngày số":"doanh thu 90 ngày "+tr(K.rev90))}</div>
    ${K.debt?`<div class="tb-bar">${seg.map(s=>`<div style="width:${(s[1]/T*100).toFixed(2)}%;background:${s[2]}">${s[1]/T>=.1?esc(s[0])+" "+tr(s[1])+" · "+kpPct(s[1]/T):""}</div>`).join("")}</div>`:""}
    <div class="ko-w">${K.no.length?tbl(["Khách","Đơn","Ngày","Còn phải thu","Số ngày","Trạng thái"],K.no.slice(0,12).map(o=>`<tr><td>${esc(K.name(o.customer_id))}</td><td class="mono">${esc(o.order_no)}</td><td class="n">${kpVn(o.order_date)}</td><td class="n"><b>${tr(o.left)}</b></td><td class="n">${o.age}</td><td>${koNoSt(o)}</td></tr>`)):`<p class="hint">Không có đơn OEM nào chờ thu tiền.</p>`}</div>
    <p class="hint">Gồm cả đơn kế toán chưa xác nhận, nên có thể lớn hơn số công nợ chính thức ở Chi phí & Tiền › Phải thu.</p></section>`;
  /* cảnh báo & đề xuất */
  const AW={c:[],d:[]},AM={c:[],d:[]};
  K.no.filter(o=>o.age>=7).slice(0,3).forEach(o=>{AW.c.push(["a",`Đơn ${K.name(o.customer_id)} đã xuất kho ${o.age} ngày, chưa thu tiền`,tr(o.left)+".","Phụ trách OEM + Kế toán"]);AW.d.push(["b",`Chốt tiền đơn ${K.name(o.customer_id)}`,"Gửi đối chiếu, hẹn ngày thanh toán.",""])});
  K.tre.forEach(o=>AW.c.push(["r",`Đơn ${o.order_no} trễ hạn giao`,`Khách cần hàng ${kpVn(o.need_date)}, chưa xuất kho.`,"Sản xuất"]));
  K.sap.forEach(o=>AW.c.push(["a",`Đơn ${o.order_no} sắp đến hạn giao`,`Khách cần hàng ${kpVn(o.need_date)}.`,"Sản xuất"]));
  if(dt&&ngv)AM.c.push([ngv/dt>=.3?"r":"a",`${kpPct(ngv/dt)} doanh thu chưa có giá vốn`,miss.slice(0,3).map(x=>`${x.sku} (${x.name})`).join(", ")+".","Kế toán nhập định mức + giá vốn"]);
  if(K.buyers.length&&K.buyers.length<=2)AM.c.push(["a",`Chỉ ${K.buyers.length} khách, ${K.cur.length} đơn trong kỳ`,K.buyers.length===1?`Kênh phụ thuộc hoàn toàn vào ${K.name(K.buyers[0])}.`:"Kênh phụ thuộc vào ít khách.","Phụ trách OEM"]);
  if(!K.pdt)AM.c.push(["a",`Tháng ${pm} chưa có số OEM`,"Chưa có đơn OEM đã duyệt trên CRM.","Kế toán"]);
  K.no.filter(o=>o.age>60).forEach(o=>AM.c.push(["r",`Đơn ${o.order_no} nợ ${o.age} ngày`,`${K.name(o.customer_id)} còn ${tr(o.left)}.`,"Kế toán + Phụ trách OEM"]));
  if(miss.length)AM.d.push(["b",`Lập định mức cho ${miss[0].name||miss[0].sku}`,"NVL + bao bì theo đơn, để tính được lãi đơn OEM.",""]);
  if(K.buyers.length<=2)AM.d.push(["b","Tìm thêm khách OEM","Mỗi khách một bảng giá riêng, theo dõi ở Khách hàng OEM.",""]);
  const AL=KO.al==="tuan"?AW:AM,chot=r.chot==="chot"&&r.frozen,nx=plYmAdd(ym,1),W=K.W;
  const side=`<aside><section class="card"><div class="card-h"><h2>⚠️ Cảnh báo & đề xuất</h2></div>
    <div class="chips" style="margin:0 0 8px"><button class="chip${KO.al==="tuan"?" on":""}" data-koal="tuan">Tuần ${kpVn(W[1].a)}–${kpVn(W[1].b)}</button><button class="chip${KO.al==="thang"?" on":""}" data-koal="thang">${one?"Tháng "+ym.slice(5):"Cả kỳ"}</button></div>
    ${AL.c.length?`<h4 class="kp-h4">Cảnh báo</h4>${AL.c.map(kpAl).join("")}`:`<p class="hint">Không có cảnh báo.</p>`}${AL.d.length?`<h4 class="kp-h4">Đề xuất</h4>${AL.d.map(kpAl).join("")}`:""}</section>
    <div class="note dt-ban" style="margin-top:12px"><b>Doanh thu thực ${esc(pLabel())}: ${tr(dt)}</b> ${pill(chot?"đã chốt":one?"chưa chốt · chốt 10/"+nx.slice(5):"chưa chốt",chot?"grn":"amb")}<br><small class="hint">đơn OEM đã duyệt trên CRM · cùng số với Tổng quan công ty, Lãi lỗ, Đối chiếu doanh thu</small></div></aside>`;
  /* top đối tác */
  const L=KO.d.lines||[],by=new Map();K.cur.forEach(o=>{const x=by.get(o.customer_id)||{id:o.customer_id,don:0,v:0,last:""};x.don++;x.v+=kpRev(o);if(o.order_date>x.last)x.last=o.order_date;by.set(o.customer_id,x)});
  const pv=id=>K.prev.filter(o=>o.customer_id===id).reduce((a,o)=>a+kpRev(o),0),left=id=>K.no.filter(o=>o.customer_id===id).reduce((a,o)=>a+o.left,0);
  const mainSp=id=>{const l=L.filter(x=>x.customer_id===id).sort((a,b)=>b.revenue-a.revenue)[0];return l?l.name:""};
  const P=[...by.values()].sort((a,b)=>b.v-a.v);
  const doiTac=`<section class="card"><div class="card-h"><h2>Top đối tác OEM</h2><span class="hint">xếp theo doanh thu ${esc(pLabel())}</span></div><div class="ko-w">${P.length?tbl(["#","Đối tác","Đơn","Doanh thu","% kênh","Còn phải thu","Đơn gần nhất",`Tháng ${pm}`],P.map((x,i)=>{const c=K.C.get(x.id)||{},p=pv(x.id),lf=left(x.id),fs=c.first_order&&c.first_order>=PERIOD.from;return `<tr><td><span class="tb-rk">${i+1}</span></td><td><b>${esc(c.name||"")}</b><br><small class="hint">${esc(mainSp(x.id))}${fs?" · đơn đầu tiên":""}</small></td><td class="n">${x.don}</td><td class="n">${tr(x.v)}</td><td class="n">${kpP(x.v,K.dt)}</td><td class="n ${lf?"t-red":""}">${tr(lf)}</td><td class="n">${kpVn(x.last)}</td><td class="n">${p?tr(p):koTag()}</td></tr>`})):`<p class="hint">Kỳ này chưa có đơn OEM đã duyệt.</p>`}</div>
    <p class="hint">${K.C.size} đối tác có bảng giá riêng. Đối tác mới tự hiện ở đây khi được lập bảng giá riêng và có đơn.</p></section>`;
  /* cơ cấu chi phí */
  const skuC=new Map();L.forEach(l=>{const x=skuC.get(l.sku)||{sku:l.sku,n:l.name,q:0,v:0,c:null};x.q+=+l.qty||0;x.v+=+l.revenue||0;const u=b2bUnitCost(l.sku,String(l.order_date).slice(0,7));if(u!=null)x.c=(x.c||0)+u*(+l.qty||0);skuC.set(l.sku,x)});
  const gvSub=[...skuC.values()].sort((a,b)=>b.v-a.v).map(x=>({n:`${x.sku} · ${x.n} · ${nf(x.q)}`,t:x.c,v:x.v,h:x.c==null?"chưa có định mức / giá vốn":"giá vốn SKU"})).concat([{n:"Nhân công, chi phí sản xuất theo đơn",t:null,h:"Sổ chi phí: chưa có khoản gắn đơn OEM"}]);
  const sub=(k,A)=>A.map(x=>`<tr class="tb-sub" data-kos="${k}" style="${KO.open[k]?"":"display:none"}"><td>${esc(x.n)}</td><td class="n">${x.t==null?(x.v?`<span class="hint">doanh thu ${tr(x.v)}</span>`:koTag()):kpF(x.t)}</td><td class="n">${x.t==null?(x.v?kpP(x.v,dt):""):kpP(x.t,dt)}</td><td class="hint">${esc(x.h||"")}</td></tr>`).join("");
  const tg=(k,c,n,t,h,A)=>`<tr class="${A&&A.length?"tb-tg":""}" ${A&&A.length?`data-kotg="${k}"`:""}><td><span class="tb-car" data-kocar="${k}">${A&&A.length?(KO.open[k]?"▾":"▸"):""}</span><span class="tb-dot" style="background:${c}"></span>${A&&A.length?`<b>${esc(n)}</b>`:esc(n)}</td><td class="n">${t==null?koTag():kpF(t)}</td><td class="n">${t==null?"":kpP(t,dt)}</td><td class="hint">${esc(h)}</td></tr>`+(A?sub(k,A):"");
  const coCp=`<section class="card"><div class="card-h"><h2>Cơ cấu chi phí</h2><span class="hint">trên doanh thu thực ${tr(dt)} · khoản nào có số mới hiện dòng</span></div><div class="ko-w">${tbl(["Khoản","Số tiền (đ)","% doanh thu","Ghi chú"],[
    tg("gv","#8a8799","Giá vốn (NVL + bao bì + sản xuất)",X.cover?gv:null,"bấm xem mã",gvSub),
    tg("cp","#b06ab3","Chi phí kênh",cp||null,cp?"bấm xem từng khoản":"vận chuyển, hàng mẫu, chiết khấu, lương phụ trách OEM: hiện khi có",cpL),
    `<tr class="tb-sum"><td><span class="tb-car"></span>Lãi đóng góp kênh</td><td class="n">${lai==null?koTag():kpF(lai)}</td><td class="n">${lai==null?"":kpP(lai,dt)}</td><td class="hint">${lai==null?"chờ giá vốn":ngv?"chỉ phần hàng có giá vốn":""}</td></tr>`,
    tg("ch","#5d6d8e","Chi phí chung phân bổ",hasChia?chia:null,hasChia?"theo Quy tắc phân bổ ở Sổ chi phí":whyChia),
    `<tr class="tb-sum"><td><span class="tb-car"></span>Lãi ròng kênh</td><td class="n">${ln==null?koTag():kpF(ln)}</td><td class="n">${ln==null?"":kpP(ln,dt)}</td><td></td></tr>`])}</div></section>`;
  /* top đơn / sản phẩm */
  let flag=false;const top=`<section class="card"><div class="card-h"><h2>Top đơn / sản phẩm OEM</h2><span class="hint">${esc(pLabel())} · lãi hiện khi có giá vốn</span></div><div class="ko-w">${L.length?tbl(["#","Đơn · sản phẩm","Khách","SL","Doanh thu","Giá vốn","Lãi gộp","Trạng thái"],L.slice(0,12).map((l,i)=>{const u=b2bUnitCost(l.sku,String(l.order_date).slice(0,7)),c=u==null?null:u*(+l.qty||0),st=c==null&&!flag?(flag=true,pill("Nhập giá vốn","blu")):"";
      return `<tr><td>${i===0||l.order_no!==L[i-1].order_no?`<span class="tb-rk">${i+1}</span>`:""}</td><td>${esc(l.order_no)} · ${esc(l.name)}</td><td>${esc(K.name(l.customer_id))}</td><td class="n">${nf(l.qty)}</td><td class="n">${tr(l.revenue)}</td><td class="n">${c==null?`<span class="pill p-gry">chưa có giá vốn</span>`:tr(c)}</td><td class="n">${c==null?"—":tr(l.revenue-c)}</td><td>${st}</td></tr>`})):`<p class="hint">Kỳ này chưa có đơn OEM đã duyệt.</p>`}</div></section>`;
  m.innerHTML=H("Kênh OEM","Khách dùng bảng giá riêng · đơn OEM đã duyệt trên CRM · "+pLabel())+kp+`<div class="ko-lay"><div>${no}</div>${side}</div>${doiTac}${coCp}${top}`+
    srcNote("Đơn OEM đã duyệt trên CRM (khách chỉ dùng bảng giá riêng, không có cấp giá) · giá vốn SKU / định mức, không ước phần chưa có · chi phí từ Sổ chi phí.");
}

/* ---------- Vận hành ---------- */
function koOps(m,K){
  const pm=K.pym.slice(5),L=KO.d.items||[],LN=KO.d.lines||[],debt=K.debt,row=(a,b,c)=>`<div class="row"><span>${esc(a)}</span><b${c?` class="t-red"`:""}>${b}</b></div>`;
  const kp=`<div class="grid kpis">${kpi("Doanh thu tháng",tr(K.dt),`${K.cur.length} đơn · ${K.buyers.length} khách`)}${kpi("Đơn chờ duyệt",nf(K.cho.length),"")}${kpi("Đang sản xuất",nf(K.sx.length),K.sx.length?"đơn chờ hàng / thiếu hàng":"không có đơn chờ hàng")}${kpi("Sắp đến hạn giao (7 ngày)",nf(K.sap.length),K.noNeed?`${K.noNeed} đơn chưa ghi "cần hàng ngày"`:"theo ngày cần hàng của đơn")}${kpi("Trễ hạn",nf(K.tre.length),"",K.tre.length?"var(--red)":"")}${kpi("Chờ thu tiền",K.no.length+" đơn",K.no.length?`${tr(debt)}${K.no.length===1?" · đã xuất kho "+kpVn(String(K.no[0].delivered_at||K.no[0].order_date).slice(0,10)):""}`:"",K.no.length?"var(--red)":"")}</div>`;
  const todo=K.no.slice(0,2).map(o=>["amb",`Chốt tiền đơn ${K.name(o.customer_id)} (${tr(o.left)})`]).concat(K.noNeed?[["amb",`Ghi "cần hàng ngày" cho đơn OEM để theo dõi hạn giao`]]:[],K.tre.length?[["red",`Xử lý ${K.tre.length} đơn trễ hạn giao`]]:[],K.buyers.length<=2?[["amb","Tìm thêm khách OEM"]]:[]);
  const allZero=!K.chuaSx.length&&!K.sx.length&&!K.sap.length&&!K.tre.length;
  const c1=`<div class="tb-team"><h3><span class="tb-ico" style="background:#efecff">🏭</span>Tiến độ sản xuất ${allZero?`<span class="pill p-grn" style="margin-left:auto">Không có đơn chờ</span>`:""}</h3>${row("Đơn đã duyệt, chưa sản xuất",nf(K.chuaSx.length))}${row("Đang sản xuất",nf(K.sx.length))}${row("Sắp đến hạn giao (7 ngày)",nf(K.sap.length))}${row("Trễ hạn",nf(K.tre.length),K.tre.length)}
    ${K.noNeed?kpAl(["b","Đề xuất",`Đơn OEM ghi "cần hàng ngày" để web báo sắp đến hạn và trễ hạn.`]):""}</div>`;
  const nX=K.cur.filter(KO_XUAT).length,nG=K.cur.filter(o=>o.delivery_status==="DA_GIAO").length;
  const c2=`<div class="tb-team"><h3><span class="tb-ico" style="background:#fff4dc">🧾</span>Đơn OEM</h3>${row("Đơn trong kỳ",`${K.cur.length} · ${tr(K.dt)}`)}${row("Đã xuất kho",nf(nX))}${row("Đã giao",nf(nG))}${row(`Tháng ${pm}`,K.prev.length?`${K.prev.length} · ${tr(K.pdt)}`:koTag())}</div>`;
  const c3=`<div class="tb-team"><h3><span class="tb-ico" style="background:#e6f6ed">🤝</span>Khách OEM ${K.buyers.length<=2?`<span class="pill p-amb" style="margin-left:auto">Ít khách</span>`:""}</h3>${row("Khách có bảng giá riêng",nf(K.C.size))}${row("Khách đặt trong kỳ",nf(K.buyers.length))}${K.buyers.slice(0,4).map(id=>{const c=K.C.get(id)||{};return row(c.name||"",c.first_order>=PERIOD.from?"đơn đầu tiên "+kpVn(c.first_order):"đơn gần nhất "+kpVn(c.last_order))}).join("")}
    ${K.buyers.length===1?kpAl(["a","Phụ thuộc 1 khách","Đề xuất: lập bảng giá riêng, chào thêm khách OEM."]):""}</div>`;
  const c4=`<div class="tb-team"><h3><span class="tb-ico" style="background:#fdeceb">💰</span>Thu tiền</h3>${K.no.length?K.no.slice(0,4).map(o=>row(K.name(o.customer_id),`${tr(o.left)} · ${o.age} ngày`,o.age>30)).join(""):`<p class="hint">Không có đơn chờ thu tiền.</p>`}${row("Quá 30 ngày",tr(K.b60+K.bx),K.b60+K.bx)}
    ${K.no.length?kpAl(["b","Đề xuất",`Gửi đối chiếu, hẹn ngày thanh toán${K.no.length===1?" đơn "+kpVn(K.no[0].order_date):""}.`]):""}</div>`;
  const spm=new Map();LN.forEach(l=>{const k=l.sku+"|"+l.customer_id,x=spm.get(k)||{n:l.name,kh:K.name(l.customer_id),q:0,v:0};x.q+=+l.qty||0;x.v+=+l.revenue||0;spm.set(k,x)});
  const SP=spm.size?[...spm.values()].sort((a,b)=>b.v-a.v):L.map(x=>({n:x.name,kh:"",q:+x.qty||0,v:+x.revenue||0}));
  const sp=`<section class="card" style="margin-top:12px"><div class="card-h"><h2>Sản phẩm OEM bán ra</h2><span class="hint">theo đơn đã duyệt</span></div><div class="ko-w">${SP.length?tbl(["#","Sản phẩm","Khách","Số lượng","Doanh thu"],SP.slice(0,12).map((x,i)=>`<tr><td><span class="tb-rk">${i+1}</span></td><td>${esc(x.n)}</td><td>${esc(x.kh)}</td><td class="n">${nf(x.q)}</td><td class="n">${tr(x.v)}</td></tr>`)):`<p class="hint">Kỳ này chưa có đơn OEM.</p>`}</div></section>`;
  m.innerHTML=H("Kênh OEM · Việc của phụ trách OEM và sản xuất",pLabel())+kp+(todo.length?`<section class="card" style="padding:10px 14px"><div class="tb-todo"><b>Việc cần làm (${todo.length}):</b>${todo.map(t=>pill(t[1],t[0])).join("")}</div></section>`:"")+`<div class="tb-teams">${c1}${c2}${c3}${c4}</div>${sp}`;
}
function koBind(m){
  m.querySelectorAll("[data-koal]").forEach(b=>b.onclick=()=>{KO.al=b.dataset.koal;renderMain()});
  m.querySelectorAll("[data-kotg]").forEach(t0=>t0.onclick=()=>{const k=t0.dataset.kotg;KO.open[k]=!KO.open[k];
    m.querySelectorAll(`[data-kos="${k}"]`).forEach(x=>x.style.display=KO.open[k]?"":"none");const c=m.querySelector(`[data-kocar="${k}"]`);if(c)c.textContent=KO.open[k]?"▾":"▸"})}
function koPage(m){
  koLoad();const adm=IS_ADMIN_HOST()&&(typeof dhOk!=="function"||dhOk());if(adm)b2bLoad();
  const wait=t=>{m.innerHTML=H("Kênh OEM",pLabel())+`<section class="card"><p class="hint pad">${t}</p></section>`};
  if(KO.err){m.innerHTML=H("Kênh OEM",pLabel())+`<div class="note red">${esc(KO.err)}</div>`;return}
  if(!KO.d||KO.key!==PERIOD.from+"|"+PERIOD.to)return wait("Đang tải đơn Kênh OEM…");
  const K=koCalc(KO.d);
  if(!adm){koOps(m,K);koBind(m);return}
  if(B2BR.err){m.innerHTML=H("Kênh OEM",pLabel())+`<div class="note red">${esc(B2BR.err)}</div>`;return}
  const X=b2bChannel("GIA_CONG");if(!X)return wait("Đang tải doanh thu…");
  const r=tqKenhRows().find(z=>z.k==="GIA_CONG");if(!r||r.dt==null)return wait("Đang tải doanh thu…");
  koAdm(m,K,X,r);koBind(m);
}
{const _bc=PAGES.bc_gc,_tq=PAGES.gc_tq;
  PAGES.bc_gc=function(m){try{koPage(m)}catch(e){console.error(e);if(_bc)_bc.apply(this,arguments)}};
  if(_tq)PAGES.gc_tq=function(m){if(IS_ADMIN_HOST())return _tq.apply(this,arguments);try{koPage(m)}catch(e){console.error(e);_tq.apply(this,arguments)}}}
(function(){if(typeof document==="undefined"||document.getElementById("koem-css"))return;const s=document.createElement("style");s.id="koem-css";s.textContent=`
.ko-lay{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start;margin-bottom:12px}
.ko-w{overflow-x:auto}.ko-w table{min-width:100%}.ko-w th,.ko-w td{white-space:nowrap;word-break:normal}`;document.head.appendChild(s)})();
