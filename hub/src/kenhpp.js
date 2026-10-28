/* =====================================================================
   TRANG KÊNH PHÂN PHỐI BẢN MỚI (chị Hoa duyệt demo 28/10/2026, demo do chat Báo cáo sàn làm). Thay trang lãi lỗ cũ của b2bpl.js.
   - Quản trị: 6 ô (doanh thu thực, giá vốn, chi phí kênh, lãi đóng góp, chi chung phân bổ, lãi ròng); công nợ (phải thu, tuổi nợ,
     nợ cũ chưa có ngày tách riêng, DSO, top khách nợ) với cột cảnh báo & đề xuất bên phải; cơ cấu doanh thu theo cấp khách và
     cơ cấu chi phí bấm xổ; top sản phẩm; top nhân viên sale.
   - Vận hành (team Sale, không có giá vốn, lãi): doanh thu tháng, đơn tuần, tái mua, khách mới, chờ thu tiền, khách cần chăm;
     việc cần làm; 4 thẻ Đơn hàng, Đơn đang chờ, Khách cần chăm, Khách nợ cần nhắc; khách hàng; top sale; top sản phẩm.
   Số doanh thu, giá vốn, chi phí, lãi lấy từ dòng Kênh phân phối của tqKenhRows (cùng số Tổng quan, Lãi lỗ, Đối chiếu doanh thu).
   Không ước giá vốn: hàng chưa có giá vốn để riêng. Thưởng cấp đơn là chi phí kênh. Chi phí đọc từ Sổ chi phí (không sửa ở đây).
   Đơn, khách, sản phẩm: /api/dashboards/kenh-pp (nhân viên chỉ thấy khách mình). Công nợ: /api/debts/aging (phaithu.js).
   ===================================================================== */
const KP={key:"",d:null,busy:false,err:"",al:"tuan",open:{}};
const KP_C=["#5b4bdb","#e0607e","#f0a020","#2a9d8f","#17804a","#3d8bd9","#b06ab3","#8a8799","#a3a1b5"];
const kpF=v=>v==null?"—":nf(Math.round(v));
const kpP=(a,b)=>b?(a/b*100).toFixed(1).replace(".",",")+"%":"—";
const kpVn=d=>d?d.slice(8,10)+"/"+d.slice(5,7):"";
const kpAdd=(d,n)=>new Date(Date.parse(d+"T00:00:00Z")+n*864e5).toISOString().slice(0,10);
const kpDays=(a,b)=>Math.round((Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/864e5);
const kpRev=o=>(+o.subtotal||0)-(+o.discount_amount||0);
const kpOk=o=>o.approval_status==="APPROVED";
async function kpLoad(){const key=PERIOD.from+"|"+PERIOD.to;if(KP.busy||(KP.key===key&&(KP.d||KP.err)))return;
  KP.busy=true;KP.key=key;KP.err="";
  const pf=plYmAdd(PERIOD.from.slice(0,7),-1)+"-01",since=kpAdd(PERIOD.from,-92)<pf?kpAdd(PERIOD.from,-92):pf;
  try{KP.d=await svApi(`/api/dashboards/kenh-pp?from=${PERIOD.from}&to=${PERIOD.to}&since=${since}`)}catch(e){KP.d=null;KP.err=e.message||"Không tải được đơn Kênh phân phối"}
  KP.busy=false;if(PAGE==="bc_b2b")renderMain()}

/* Số tính từ đơn, khách (dùng cho cả hai web). */
function kpCalc(d){
  const today=typeof dtToday==="function"?dtToday():new Date().toISOString().slice(0,10),ref=PERIOD.to<today?PERIOD.to:today;
  const pym=plYmAdd(PERIOD.from.slice(0,7),-1),pf=pym+"-01",pt=plYmEnd(pym);
  const C=new Map((d.customers||[]).map(c=>[c.id,c])),O=d.orders||[],ok=O.filter(kpOk);
  const inP=o=>o.order_date>=PERIOD.from&&o.order_date<=PERIOD.to,inPrev=o=>o.order_date>=pf&&o.order_date<=pt;
  const cur=ok.filter(inP),prev=ok.filter(inPrev),sumR=a=>a.reduce((t,o)=>t+kpRev(o),0);
  const buyers=[...new Set(cur.map(o=>o.customer_id))],pBuyers=[...new Set(prev.map(o=>o.customer_id))];
  const fo=id=>(C.get(id)||{}).first_order||"";
  const re=buyers.filter(id=>fo(id)&&fo(id)<PERIOD.from),pRe=pBuyers.filter(id=>fo(id)&&fo(id)<pf);
  const moi=buyers.filter(id=>fo(id)>=PERIOD.from),pMoi=pBuyers.filter(id=>fo(id)>=pf&&fo(id)<=pt);
  /* tuần: thứ Hai → Chủ nhật, tuần này tính đến ngày tham chiếu */
  const dow=(new Date(ref+"T00:00:00Z").getUTCDay()+6)%7,w0=kpAdd(ref,-dow);
  const wk=i=>{const a=kpAdd(w0,-7*i),b=i?kpAdd(a,6):ref,L=ok.filter(o=>o.order_date>=a&&o.order_date<=b);return {a,b,n:L.length,v:sumR(L)}};
  const W=[wk(0),wk(1),wk(2)],hn=ok.filter(o=>o.order_date===ref);
  /* khách quá chu kỳ đặt hàng (mặc định 30 ngày) */
  const spent=new Map();ok.forEach(o=>spent.set(o.customer_id,(spent.get(o.customer_id)||0)+kpRev(o)));
  const late=[...C.values()].filter(c=>c.last_order&&+c.n_orders>0).map(c=>({...c,cyc:+c.reorder_cycle_days||30,days:kpDays(c.last_order,ref),spent:spent.get(c.id)||0})).filter(c=>c.days>c.cyc).sort((a,b)=>b.spent-a.spent||b.days-a.days);
  /* đơn chưa thu đủ tiền (đơn đã duyệt trong kỳ) */
  const owe=cur.map(o=>({...o,left:(+o.total_amount||0)-(+o.received||0)})).filter(o=>o.left>0);
  const wait={cho:O.filter(o=>o.approval_status==="PENDING_APPROVAL").length,xuat:ok.filter(o=>o.delivery_status==="CHUA_XUAT").length,kt:ok.filter(o=>o.accounting_status==="CHUA_XAC_NHAN").length};
  /* theo cấp khách */
  const tierOf=id=>(C.get(id)||{}).tier||"Chưa xếp cấp",tiers=new Map();
  cur.forEach(o=>{const t=tierOf(o.customer_id),x=tiers.get(t)||{n:t,v:0,pv:0,kh:new Map()};x.v+=kpRev(o);x.kh.set(o.customer_id,(x.kh.get(o.customer_id)||0)+kpRev(o));tiers.set(t,x)});
  prev.forEach(o=>{const t=tierOf(o.customer_id),x=tiers.get(t)||{n:t,v:0,pv:0,kh:new Map()};x.pv+=kpRev(o);tiers.set(t,x)});
  /* theo người phụ trách khách */
  const ownOf=id=>(C.get(id)||{}).owner_name||"",own=new Map(),gO=n=>own.get(n)||own.set(n,{n,v:0,pv:0,don:0,kh:new Set(),moi:new Set(),thu:0,no:0,nkh:0,late:0}).get(n);
  cur.forEach(o=>{const x=gO(ownOf(o.customer_id));x.v+=kpRev(o);x.don++;x.kh.add(o.customer_id);if(fo(o.customer_id)>=PERIOD.from)x.moi.add(o.customer_id);x.thu+=Math.min(+o.received||0,+o.total_amount||0);x.no+=Math.max(0,(+o.total_amount||0)-(+o.received||0))});
  prev.forEach(o=>{gO(ownOf(o.customer_id)).pv+=kpRev(o)});
  C.forEach(c=>{const x=gO(c.owner_name||"");x.nkh++});late.forEach(c=>{gO(c.owner_name||"").late++});
  const dt=sumR(cur),owners=[...own.values()].filter(x=>x.v||x.pv||x.nkh).sort((a,b)=>b.v-a.v||b.pv-a.pv);
  const topOwn=owners.find(x=>x.n)||null,conc=topOwn&&dt?topOwn.v/dt:0;
  const noTier=buyers.filter(id=>!(C.get(id)||{}).tier),noTierV=cur.filter(o=>!(C.get(o.customer_id)||{}).tier).reduce((t,o)=>t+kpRev(o),0);
  const tiem=[...C.values()].filter(c=>!+c.n_orders),tiemMoi=PERIOD.from>="2026-11-01"?tiem.filter(c=>String(c.created_at||"").slice(0,10)>=PERIOD.from&&String(c.created_at||"").slice(0,10)<=PERIOD.to).length:null;
  return {today,ref,pym,cur,prev,dt,pdt:sumR(prev),buyers,pBuyers,re,pRe,moi,pMoi,W,hn:{n:hn.length,v:sumR(hn)},late,owe,wait,C,
    tiers:[...tiers.values()].sort((a,b)=>b.v-a.v),owners,topOwn,conc,noTier,noTierV,tiem,tiemMoi};
}
/* Công nợ Kênh phân phối từ /api/debts/aging. */
function kpDebt(){if(typeof PT==="undefined"||!PT.d||PT.d.err||!PT.d.rows)return null;
  const rows=PT.d.rows.filter(r=>r.kenh!=="GIA_CONG"),t=(PT.d.by_kenh||{}).B2B||{};
  const s=k=>rows.reduce((a,r)=>a+(+r[k]||0),0);
  return {rows,debt:s("official_debt"),b30:s("b30"),b60:s("b60"),b90:s("b90"),b90p:s("b90p"),old:s("old"),nOld:rows.filter(r=>r.old>0).length,dso:t.dso,rev90:t.rev90,asOf:PT.d.as_of}}
const kpAl=a=>`<div class="tb-al tb-${a[0]}"><b>${esc(a[1])}</b>${esc(a[2]||"")}${a[3]?` <i>· ${esc(a[3])}</i>`:""}</div>`;
const kpPct=v=>Math.round(v*100)+"%";

/* ---------- Quản trị ---------- */
function kpAdm(m,K,X,r,D2){
  const dt=r.dt||0,cv=X.covRev,gv=X.cost,ngv=r.ngv||0,bo=X.bonus||0,lg=r.luong||0,lai=r.lai,chia=r.chia||0;
  const one=PERIOD.from.slice(0,7)===PERIOD.to.slice(0,7),ym=PERIOD.from.slice(0,7),PB=one&&typeof dtPB==="function"?dtPB(ym):null;
  /* chi phí kênh: thưởng cấp đơn + Sổ chi phí bổ về Kênh phân phối + lương làm riêng cho kênh */
  const S=typeof dtSoCp==="function"?dtSoCp(PERIOD.from,PERIOD.to):null,gd=(S&&S.gd&&S.gd.b2b)||{};
  const gName=g=>typeof scG==="function"?scG(g).n:g;
  const cpL=[];if(bo)cpL.push({n:"Thưởng cấp đơn (trừ ngay trên đơn)",t:bo,h:"theo cơ chế cấp khách"});
  Object.entries(gd).sort((a,b)=>b[1]-a[1]).forEach(([g,t])=>{if(t)cpL.push({n:gName(g),t,h:"Sổ chi phí"})});
  if(lg)cpL.push({n:"Lương làm riêng cho kênh",t:lg,h:"bảng lương đã chốt"});
  const cp=cpL.reduce((a,x)=>a+x.t,0),hasChia=chia>0,ln=hasChia&&lai!=null?lai-chia:null;
  const whyChia=!one?"chọn một tháng để xem chi chung phân bổ":PB&&PB.loi&&PB.loi.length?"chưa chia được: "+PB.loi[0]:"Sổ chi phí tháng này chưa chia chi chung cho kênh";
  const kp=`<div class="grid kpis">${kpi("Doanh thu thực",tr(dt),`${nf(X.orders)} đơn đã duyệt · ${K.buyers.length} khách`)}${kpi("Giá vốn",X.cover?tr(gv):"—",X.cover?`${kpP(gv,cv)} doanh thu hàng có giá vốn (${tr(cv)})${ngv?`<br><span class="t-red">${tr(ngv)} hàng chưa có giá vốn</span>`:""}`:"chưa có giá vốn")}${kpi("Chi phí kênh",tr(cp),`${kpP(cp,dt)} doanh thu${cpL.length?" · "+cpL.map(x=>x.n.replace(/ \(.*\)/,"").toLowerCase()+" "+tr(x.t)).join(", "):""}`)}${kpi("Lãi đóng góp kênh",lai==null?"—":tr(lai),lai==null?"chưa có giá vốn":kpP(lai,dt)+" · trước chi chung","var(--green)")}${kpi("Chi chung phân bổ",hasChia?tr(chia):"—",hasChia?"theo Quy tắc phân bổ ở Sổ chi phí":whyChia)}${kpi("Lãi ròng kênh",ln==null?"—":tr(ln),ln==null?"chờ chi chung":kpP(ln,dt)+" · sau chi chung","var(--green)")}</div>`;
  /* công nợ */
  const no=!D2?`<section class="card"><div class="card-h"><h2>Công nợ Kênh phân phối</h2></div><p class="hint">${typeof PT!=="undefined"&&PT.d&&PT.d.err?esc(PT.d.err):"Đang tải công nợ…"}</p></section>`:(()=>{
    const T=D2.debt||1,seg=[["≤30 ngày",D2.b30,"#17804a"],["31–60 ngày",D2.b60,"#f0a020"],["61–90 ngày",D2.b90,"#e07a3f"],["Quá 90 ngày",D2.b90p,"#c0392b"],["Nợ cũ chưa có ngày",D2.old,"repeating-linear-gradient(45deg,#c0392b 0 6px,#d8604f 6px 12px)"]].filter(s=>s[1]>0);
    const top=D2.rows.slice().sort((a,b)=>b.official_debt-a.official_debt).slice(0,8),has90=D2.b90p>0;
    return `<section class="card"><div class="card-h"><h2>Công nợ Kênh phân phối</h2><span class="hint">tính đến ${kpVn(D2.asOf)} · ${D2.rows.length} khách đang nợ</span></div>
    <div class="grid kpis" style="margin-bottom:10px">${kpi("Phải thu",tr(D2.debt),D2.rows.length+" khách")}${kpi("DSO",D2.dso==null?"—":D2.dso+" ngày",D2.rev90?"doanh thu 90 ngày "+tr(D2.rev90):"",D2.dso>60?"var(--red)":"")}${kpi("Quá 90 ngày",tr(D2.b90p),"theo ngày đơn")}${kpi("Nợ cũ chưa có ngày",tr(D2.old),D2.nOld?D2.nOld+" khách · chưa có ngày đơn":"không có",D2.old?"var(--red)":"")}</div>
    <div class="tb-bar">${seg.map(s=>`<div style="width:${(s[1]/T*100).toFixed(2)}%;background:${s[2]}" title="${esc(s[0])} ${kpF(s[1])}">${s[1]/T>=.12?esc(s[0])+" "+tr(s[1]):s[1]/T>=.04?tr(s[1]):""}</div>`).join("")}</div>
    ${tbl(["Khách","Đang nợ","≤30","31–60","61–90"].concat(has90?["Quá 90"]:[]).concat(["Nợ cũ chưa có ngày","Đơn nợ lâu nhất"]),top.map(x=>`<tr><td>${esc(x.customer_name)}</td><td class="n"><b>${tr(x.official_debt)}</b></td><td class="n">${tr(x.b30)}</td><td class="n">${tr(x.b60)}</td><td class="n">${tr(x.b90)}</td>${has90?`<td class="n t-red">${tr(x.b90p)}</td>`:""}<td class="n ${x.old?"t-red":""}">${tr(x.old)}</td><td class="n">${x.oldest_days?x.oldest_days+" ngày":"—"}</td></tr>`))}
    ${D2.old?`<p class="hint">Nợ cũ chưa có ngày (${tr(D2.old)}) là dư nợ cũ chưa nối với đơn nào nên chưa biết đã quá 90 ngày hay chưa. Khi nhập đủ ngày đơn, số sẽ tự vào đúng cột tuổi nợ.</p>`:""}</section>`})();
  /* cảnh báo & đề xuất */
  const W=K.W,AW={c:[],d:[]},AM={c:[],d:[]};
  if(W[1].v&&W[2].v){const ch=W[1].v/W[2].v-1;if(ch<=-.2)AW.c.push(["r",`Doanh số tuần giảm ${kpPct(-ch)}`,`${tr(W[2].v)} → ${tr(W[1].v)}; ${W[2].n} → ${W[1].n} đơn (tuần ${kpVn(W[1].a)}–${kpVn(W[1].b)}).`,"Team Sale"]);else if(ch>=.2)AW.c.push(["g",`Doanh số tuần tăng ${kpPct(ch)}`,`${tr(W[2].v)} → ${tr(W[1].v)}.`,""])}
  if(K.late.length){AW.c.push(["a",`${K.late.length} khách quá chu kỳ đặt hàng`,K.late.slice(0,3).map(c=>`${c.name} ${c.days} ngày`).join(", ")+(K.late.length>3?"…":""),"Team Sale"]);
    AW.d.push(["b","Gọi lại khách quá chu kỳ trong tuần này","Ưu tiên "+K.late.slice(0,3).map(c=>c.name+(c.tier?` (${c.tier}${c.spent?", "+tr(c.spent)+" đã mua":""})`:"")).join(", ")+".",""])}
  if(D2){if(D2.dso!=null&&D2.dso>60)AM.c.push(["r",`DSO ${D2.dso} ngày, phải thu ${tr(D2.debt)}`,D2.rev90?`So với doanh thu 90 ngày ${tr(D2.rev90)}.`:"","Kế toán + Sale"]);
    if(D2.old)AM.c.push(["a",`${tr(D2.old)} nợ cũ chưa có ngày đơn`,`${D2.nOld} khách.`,"Nhập ngày đơn cho nợ cũ"]);
    const n60=D2.rows.filter(x=>x.b60>0).sort((a,b)=>b.b60-a.b60).slice(0,3);if(n60.length)AM.d.push(["b","Nhắc nợ nhóm 31–60 ngày",n60.map(x=>`${x.customer_name} ${tr(x.b60)}`).join(", ")+".",""])}
  if(K.pdt){const ra=K.dt/K.pdt,part=K.ref<PERIOD.to;if(ra<.8){const dr=K.tiers.filter(t=>t.pv>0).map(t=>({...t,dd:t.pv-t.v})).sort((a,b)=>b.dd-a.dd)[0];AM.c.push(["a",`Doanh thu${part?" đến "+kpVn(K.ref):""} mới bằng ${kpPct(ra)} tháng ${K.pym.slice(5)}`,`${tr(K.dt)} so với ${tr(K.pdt)}`+(dr&&dr.dd>0?`; ${dr.n} giảm từ ${tr(dr.pv)} xuống ${tr(dr.v)}.`:"."),"Team Sale"])}}
  const miss=[...X.miss.values()].sort((a,b)=>b.rev-a.rev);if(miss.length)AM.c.push(["a",`${miss.length} mã chưa có giá vốn (${tr(ngv)})`,miss.slice(0,3).map(x=>x.sku).join(", ")+" lớn nhất.","Kế toán"]);
  if(K.topOwn&&K.conc>=.8){const oth=K.owners.filter(x=>x.n&&x!==K.topOwn&&(x.v||x.pv)).slice(0,2);AM.c.push(["a",`${kpPct(K.conc)} doanh số gắn tài khoản ${K.topOwn.n}`,"Chưa đánh giá được từng sale"+(oth.length?"; "+oth.map(x=>`${x.n} ${tr(x.v)} (tháng ${K.pym.slice(5)}: ${tr(x.pv)})`).join(", "):"")+".","Gán người phụ trách khách"])}
  if(K.noTier.length)AM.c.push(["a",`${K.noTier.length} khách chưa xếp cấp (${tr(K.noTierV)})`,"Chưa áp đúng giá và thưởng cấp.","Sale"]);
  const ngw=typeof dhGet==="function"&&D().fin?dhGet().nguong:{bienTier:.25},minB=ngw.bienTier||.25;
  const grp=[...X.grp.values()].filter(g=>g.cov>0).map(g=>({...g,b:(g.cov-g.cost)/g.cov}));
  grp.filter(g=>g.b<0).forEach(g=>AM.c.push(["r",`Nhóm ${g.n} biên ${kpPct(g.b)}`,`Doanh thu có giá vốn ${tr(g.cov)}, giá vốn ${tr(g.cost)}: nghi giá vốn nhập sai.`,"Kế toán kiểm Giá vốn SKU"]));
  const main=grp.filter(g=>g.cov>=cv*.05),best=main.slice().sort((a,b)=>b.b-a.b)[0];
  if(best&&best.b>.4)AM.d.push(["b",`Đẩy nhóm ${best.n}`,`Biên ${kpPct(best.b)}, cao nhất kênh.`,""]);
  if(main.length&&main.every(g=>g.b>=minB)&&cv)AM.d.push(["g",`✓ Biên gộp phần có giá vốn ${kpP(cv-gv,cv)}`,`Các nhóm chính đều trên mức tối thiểu ${kpPct(minB)}.`,""]);
  const AL=KP.al==="tuan"?AW:AM,chot=r.chot==="chot"&&r.frozen,nx=plYmAdd(ym,1);
  const side=`<aside><section class="card"><div class="card-h"><h2>⚠️ Cảnh báo & đề xuất</h2></div>
    <div class="chips" style="margin:0 0 8px"><button class="chip${KP.al==="tuan"?" on":""}" data-kpal="tuan">Tuần ${kpVn(W[1].a)}–${kpVn(W[1].b)}</button><button class="chip${KP.al==="thang"?" on":""}" data-kpal="thang">${one?"Tháng "+ym.slice(5):"Cả kỳ"}</button></div>
    ${AL.c.length?`<h4 class="kp-h4">Cảnh báo</h4>${AL.c.map(kpAl).join("")}`:`<p class="hint">Không có cảnh báo.</p>`}${AL.d.length?`<h4 class="kp-h4">Đề xuất</h4>${AL.d.map(kpAl).join("")}`:""}</section>
    <div class="note dt-ban" style="margin-top:12px"><b>Doanh thu thực ${esc(pLabel())}: ${tr(dt)}</b> ${pill(chot?"đã chốt":one?"chưa chốt · chốt 10/"+nx.slice(5):"chưa chốt",chot?"grn":"amb")}<br><small class="hint">đơn đã duyệt trên CRM, chưa trừ thưởng cấp đơn (thưởng tính vào chi phí) · cùng số với Tổng quan công ty, Lãi lỗ, Đối chiếu doanh thu</small></div></aside>`;
  /* cơ cấu doanh thu theo cấp khách */
  const TT=K.tiers.reduce((a,t)=>a+t.v,0)||1;let acc=0;const cg=K.tiers.map((t,i)=>{const a=acc;acc+=t.v/TT*100;return `${KP_C[i%KP_C.length]} ${a}% ${acc}%`}).join(",");
  const tRows=K.tiers.map((t,i)=>{const c=KP_C[i%KP_C.length],k="t"+i,kh=[...t.kh.entries()].sort((a,b)=>b[1]-a[1]),nT=kh.length;
    return `<tr class="tb-tg" data-kptg="${k}"><td><span class="tb-car" data-kpcar="${k}">${KP.open[k]?"▾":"▸"}</span><span class="tb-dot" style="background:${c}"></span><b>${esc(t.n)}</b></td><td class="n">${tr(t.v)}</td><td><div class="tb-mini"><i style="width:${(t.v/(K.tiers[0].v||1)*100).toFixed(1)}%;background:${c}"></i></div><b>${kpP(t.v,TT)}</b></td><td class="n">${nT}</td><td class="n ${t.pv>t.v*1.5?"t-red":""}">${t.pv?tr(t.pv):"—"}</td></tr>`
     +kh.slice(0,12).map(([id,v])=>`<tr class="tb-sub" data-kps="${k}" style="${KP.open[k]?"":"display:none"}"><td>${esc((K.C.get(id)||{}).name||"")}</td><td class="n">${tr(v)}</td><td></td><td></td><td></td></tr>`).join("")}).join("");
  const coDt=`<div><h2 class="kp-h2">Cơ cấu doanh thu</h2><div class="hint">theo cấp khách · đơn đã duyệt ${esc(pLabel())} · bấm cấp để xem khách</div>
    <div style="display:flex;gap:16px;align-items:center;flex-direction:column;margin-top:8px"><div class="tb-donut" style="background:conic-gradient(${cg||"#ddd 0 100%"})"><div class="ct">Doanh thu<b>${tr(K.dt)}</b></div></div>
    <table class="tb-src"><colgroup><col style="width:32%"><col style="width:16%"><col style="width:24%"><col style="width:10%"><col style="width:18%"></colgroup><thead><tr><th>Cấp khách</th><th class="n">Doanh thu</th><th>Tỷ trọng</th><th class="n">Khách</th><th class="n">Tháng ${K.pym.slice(5)}</th></tr></thead><tbody>${tRows}</tbody></table></div>
    ${K.noTier.length?`<p class="hint">${K.noTier.length} khách (${tr(K.noTierV)}) chưa xếp cấp nên chưa áp đúng bảng giá và thưởng cấp.</p>`:""}</div>`;
  /* cơ cấu chi phí */
  const bar=[["Giá vốn",gv,"#8a8799"],["?",ngv,"repeating-linear-gradient(45deg,#c9c7d6 0 6px,#e4e2ee 6px 12px)"],["Chi phí kênh",cp,"#b06ab3"],["Lãi đóng góp",lai>0?lai:0,"#17804a"]].filter(b=>b[1]>0),BT=dt||1;
  const sub=(k,L)=>L.map(x=>`<tr class="tb-sub" data-kps="${k}" style="${KP.open[k]?"":"display:none"}"><td>${esc(x.n)}</td><td class="n">${kpF(x.t)}</td><td class="n">${kpP(x.t,dt)}</td><td class="hint">${esc(x.h||"")}</td></tr>`).join("");
  const tg=(k,c,n,t,h,L)=>`<tr class="${L&&L.length?"tb-tg":""}" ${L&&L.length?`data-kptg="${k}"`:""}><td><span class="tb-car" data-kpcar="${k}">${L&&L.length?(KP.open[k]?"▾":"▸"):""}</span><span class="tb-dot" style="background:${c}"></span>${L&&L.length?`<b>${esc(n)}</b>`:esc(n)}</td><td class="n">${t==null?`<span class="hint">chưa có số</span>`:kpF(t)}</td><td class="n">${t==null?"":kpP(t,dt)}</td><td class="hint">${esc(h)}</td></tr>`+(L?sub(k,L):"");
  const missL=miss.slice(0,4).map(x=>({n:x.sku+" "+(x.name||""),t:x.rev})).concat(miss.length>4?[{n:miss.slice(4,7).map(x=>x.sku).join(", ")+(miss.length>7?` và ${miss.length-7} mã khác`:""),t:miss.slice(4).reduce((a,x)=>a+x.rev,0),h:"nhập ở Giá vốn SKU"}]:[]);
  const coCp=`<div><h2 class="kp-h2">Cơ cấu chi phí</h2><div class="hint">mọi khoản chi của kênh tính trên doanh thu thực ${tr(dt)} · khoản nào có số mới hiện dòng</div>
    <div class="tb-bar">${bar.map(b=>`<div style="width:${(b[1]/BT*100).toFixed(2)}%;background:${b[2]};${b[0]==="?"?"color:#555":""}" title="${esc(b[0])} ${kpF(b[1])}">${b[1]/BT>=.15?esc(b[0])+" "+kpP(b[1],dt):b[0]==="?"?"?":""}</div>`).join("")}</div>
    ${tbl(["Khoản","Số tiền (đ)","% doanh thu","Ghi chú"],[
      tg("gv","#8a8799","Giá vốn hàng bán",X.cover?gv:null,X.cover?`giá vốn SKU của ${tr(cv)} hàng`:"chưa có giá vốn"),
      ngv?tg("miss","#c9c7d6",`Hàng chưa có giá vốn (${miss.length} mã)`,ngv,"không ước, không tính lãi phần này · bấm xem mã",missL):"",
      tg("cp","#b06ab3","Chi phí kênh",cp,cpL.length?"bấm xem từng khoản":"chưa có khoản nào",cpL),
      `<tr class="tb-sum"><td><span class="tb-car"></span>Lãi đóng góp kênh</td><td class="n">${kpF(lai)}</td><td class="n">${lai==null?"":kpP(lai,dt)}</td><td class="hint">phần hàng có giá vốn, trước chi chung</td></tr>`,
      tg("ch","#5d6d8e","Chi phí chung phân bổ",hasChia?chia:null,hasChia?"theo Quy tắc phân bổ ở Sổ chi phí":whyChia),
      `<tr class="tb-sum"><td><span class="tb-car"></span>Lãi ròng kênh</td><td class="n">${ln==null?`<span class="hint">chưa có số</span>`:kpF(ln)}</td><td class="n">${ln==null?"":kpP(ln,dt)}</td><td></td></tr>`].filter(Boolean))}
    <p class="hint">Các khoản chi phí kênh tự hiện khi có số trong Sổ chi phí: quảng cáo, thưởng tháng, thưởng quý, vận chuyển, chương trình khuyến mại, hàng mẫu, lương sale…</p></div>`;
  /* top sản phẩm */
  const sk=new Map();(B2BR.data.lines||[]).filter(l=>l.channel==="B2B").forEach(l=>{const x=sk.get(l.sku)||{sku:l.sku,n:l.name,q:0,v:0,c:0,cov:0,miss:false};const u=b2bUnitCost(l.sku,l.month),rv=+l.revenue||0;x.q+=+l.qty||0;x.v+=rv;if(u==null)x.miss=true;else{x.c+=u*(+l.qty||0);x.cov+=rv}sk.set(l.sku,x)});
  const SP=[...sk.values()].sort((a,b)=>b.v-a.v),dg=b=>b==null?pill("Nhập giá vốn","blu"):b<0?pill("Lỗ · kiểm giá vốn","red"):b<minB?pill("Dưới mức","red"):b<minB+.1?pill("Sát mức","amb"):b>=.6?pill("Biên cao","grn"):pill("Đạt","grn");
  const spRow=(x,i)=>{const b=x.cov?(x.cov-x.c)/x.cov:null;return `<tr${x.miss&&!x.cov?` style="background:rgba(240,160,32,.08)"`:""}><td>${i!=null?`<span class="tb-rk">${i+1}</span>`:""}</td><td>${esc(x.n||x.sku)}</td><td class="n">${nf(x.q)}</td><td class="n">${tr(x.v)}</td><td class="n">${kpP(x.v,X.revLines)}</td><td class="n">${x.cov?tr(x.cov-x.c):`<span class="hint">chưa có giá vốn</span>`}</td><td class="n">${b==null?"—":kpPct(b)}</td><td>${dg(b)}</td></tr>`};
  const top8=SP.filter(x=>x.cov).slice(0,8),topMiss=SP.filter(x=>!x.cov).slice(0,2);
  const top=`<section class="card"><div class="card-h"><h2>Top sản phẩm</h2><span class="hint">biên gộp tối thiểu ${kpPct(minB)} · giá vốn theo Giá vốn SKU tháng gần nhất</span></div>${tbl(["#","Sản phẩm","SL","Doanh thu","% kênh","Lãi gộp","Biên","Đánh giá"],top8.map(spRow).concat(topMiss.map(x=>spRow(x,null))))}</section>`;
  /* top nhân viên sale */
  const ow=K.owners,dRow=n=>D2?D2.rows.filter(x=>(x.owner_name||"")===n):[];
  const saleRow=x=>{const dr=dRow(x.n),dno=dr.reduce((a,y)=>a+y.official_debt,0),d30=dr.reduce((a,y)=>a+y.b60+y.b90+y.b90p,0),ch=x.pv?x.v/x.pv-1:null;
    const ev=!x.n?pill("Gán người","amb"):x===K.topOwn&&K.conc>=.8?pill("Chưa tách người","amb"):ch!=null&&ch<=-.3?pill("Doanh số giảm "+kpPct(-ch),"red"):ch!=null&&ch>=.2?pill("Tăng "+kpPct(ch),"grn"):pill("Ổn","grn");
    return `<tr${x.n?"":` style="background:rgba(240,160,32,.08)"`}><td><b>${esc(x.n||"Khách chưa gán người")}</b></td><td class="n">${tr(x.v)}</td><td class="n">${tr(x.pv)}</td><td class="n">${x.don}</td><td class="n">${x.kh.size} · ${x.moi.size}</td><td class="n">${tr(x.thu)} / <span class="${x.no?"t-red":""}">${tr(x.no)}</span></td><td class="n">${x.nkh} · <span class="${x.late?"t-red":""}">${x.late}</span></td><td class="n">${D2?`${tr(dno)} · <span class="${d30?"t-red":""}">${tr(d30)}</span>`:"—"}</td><td>${ev}</td></tr>`};
  const sale=`<section class="card"><div class="card-h"><h2>Top nhân viên sale</h2><span class="hint">xếp theo doanh số · theo người phụ trách khách trên CRM · so tháng ${K.pym.slice(5)}${D2?" · nợ tính đến "+kpVn(D2.asOf):""}</span></div>
    ${tbl(["Người",`Doanh số`,`Tháng ${K.pym.slice(5)}`,"Đơn","Khách mua · mới","Đã thu / còn nợ (đơn trong kỳ)","Khách phụ trách · quá chu kỳ","Nợ đang giữ · quá 30 ngày","Đánh giá"],ow.map(saleRow))}
    ${K.topOwn&&K.conc>=.8?`<p class="hint"><b>${kpPct(K.conc)} doanh số đang gắn tài khoản ${esc(K.topOwn.n)}</b> nên chưa đánh giá được từng sale. Gán đúng người phụ trách cho từng khách trên CRM thì bảng tự tách doanh số, thu tiền, khách quá chu kỳ, nợ theo từng người.</p>`:""}</section>`;
  m.innerHTML=H("Kênh phân phối","Đại lý, NPP · đơn đã duyệt trên CRM · "+pLabel())+kp+
    `<div class="kp-lay"><div>${no}</div>${side}</div><section class="card"><div class="kp-halves">${coDt}${coCp}</div></section>${top}${sale}`+
    srcNote("Đơn đã duyệt trên CRM · giá vốn SKU tháng gần nhất không sau tháng bán (không ước phần chưa có) · chi phí kênh và chi chung từ Sổ chi phí · công nợ đã kế toán xác nhận.");
}

/* ---------- Vận hành (team Sale): không có giá vốn, lãi ---------- */
function kpOps(m,K,D2){
  const W=K.W,pm=K.pym.slice(5),reP=K.buyers.length?K.re.length/K.buyers.length:null,preP=K.pBuyers.length?K.pRe.length/K.pBuyers.length:null,oweV=K.owe.reduce((a,o)=>a+o.left,0);
  const kp=`<div class="grid kpis">${kpi("Doanh thu tháng",tr(K.dt),`${K.cur.length} đơn · ${K.buyers.length} khách · tháng ${pm}: ${tr(K.pdt)}`)}${kpi(`Đơn tuần này (${kpVn(W[0].a)}–${kpVn(W[0].b)})`,nf(W[0].n),`${tr(W[0].v)} · hôm nay ${K.hn.n} đơn${K.hn.n?" "+tr(K.hn.v):""}`)}${kpi("Tỷ lệ tái mua",reP==null?"—":kpPct(reP),`${K.re.length}/${K.buyers.length} khách đã từng mua${preP==null?"":` · T${pm}: ${kpPct(preP)}`}`)}${kpi("Khách mới mua",nf(K.moi.length),`đơn đầu tiên trong kỳ · T${pm}: ${K.pMoi.length}`)}${kpi("Chờ thu tiền",K.owe.length+" đơn",`còn ${tr(oweV)} (đơn trong kỳ)`,K.owe.length?"var(--red)":"")}${kpi("Khách cần chăm",nf(K.late.length),"quá chu kỳ đặt hàng",K.late.length?"var(--red)":"")}</div>`;
  const n60=D2?D2.rows.filter(x=>x.b60>0).sort((a,b)=>b.b60-a.b60).slice(0,2):[];
  const todo=[K.late.length?["red",`Gọi lại ${K.late.length} khách quá chu kỳ`]:null,n60.length?["red","Nhắc nợ 31–60 ngày: "+n60.map(x=>x.customer_name).join(", ")]:null,K.noTier.length?["amb",`Xếp cấp cho ${K.noTier.length} khách`]:null,(K.topOwn&&K.conc>=.8)||K.owners.some(x=>!x.n&&x.nkh)?["amb","Gán người phụ trách khách trên CRM"]:null].filter(Boolean);
  const row=(a,b,c)=>`<div class="row"><span>${esc(a)}</span><b${c?` class="t-red"`:""}>${b}</b></div>`;
  const ch=W[1].v&&W[2].v?W[1].v/W[2].v-1:null;
  const c1=`<div class="tb-team"><h3><span class="tb-ico" style="background:#efecff">🧾</span>Đơn hàng</h3>${row("Hôm nay",`${K.hn.n} đơn${K.hn.n?" · "+tr(K.hn.v):""}`)}${W.map((w,i)=>row(i?`Tuần ${kpVn(w.a)}–${kpVn(w.b)}`:`Tuần này ${kpVn(w.a)}–${kpVn(w.b)}`,`${w.n} đơn · ${tr(w.v)}`)).join("")}
    ${ch!=null&&ch<=-.2?kpAl(["r",`Tuần ${kpVn(W[1].a)}–${kpVn(W[1].b)} giảm ${kpPct(-ch)}`,"Đề xuất: gọi khách đến kỳ đặt hàng, chào nhóm hàng bán chạy."]):ch!=null&&ch>=.2?kpAl(["g",`Tuần ${kpVn(W[1].a)}–${kpVn(W[1].b)} tăng ${kpPct(ch)}`,""]):""}</div>`;
  const c2=`<div class="tb-team"><h3><span class="tb-ico" style="background:#fff4dc">⏳</span>Đơn đang chờ</h3>${row("Chờ duyệt",nf(K.wait.cho))}${row("Đã duyệt, chờ xuất kho",nf(K.wait.xuat))}${row("Kế toán chưa xác nhận",nf(K.wait.kt))}${row("Chưa thu đủ tiền",`${K.owe.length} đơn · ${tr(oweV)}`,K.owe.length)}</div>`;
  const c3=`<div class="tb-team"><h3><span class="tb-ico" style="background:#e6f6ed">🤝</span>Khách cần chăm <span class="pill p-${K.late.length?"red":"grn"}" style="margin-left:auto">${K.late.length} khách</span></h3>${K.late.length?K.late.slice(0,5).map(c=>row(c.name+(c.tier?` (${c.tier})`:""),`${c.days} ngày chưa đặt`)).join(""):`<p class="hint">Không có khách quá chu kỳ.</p>`}
    ${K.late.length?kpAl(["b","Đề xuất","Gọi hỏi tồn kho và chào hàng mới trong tuần; chu kỳ đặt mặc định 30 ngày nếu khách chưa ghi chu kỳ."]):""}</div>`;
  const nn=D2?D2.rows.filter(x=>x.b60+x.b90+x.b90p>0).sort((a,b)=>(b.b60+b.b90+b.b90p)-(a.b60+a.b90+a.b90p)).slice(0,4):[];
  const c4=`<div class="tb-team"><h3><span class="tb-ico" style="background:#fdeceb">💰</span>Khách nợ cần nhắc</h3>${!D2?`<p class="hint">Đang tải công nợ…</p>`:nn.length?nn.map(x=>{const k=x.b90p?["Quá 90 ngày",x.b90p]:x.b90>x.b60?["61–90 ngày",x.b90]:["31–60 ngày",x.b60];return row(x.customer_name,`${k[0]}: ${tr(k[1])}`)}).join(""):`<p class="hint">Không có khách nợ quá 30 ngày.</p>`}
    ${D2&&D2.debt?kpAl([D2.dso>60?"r":"a",`Phải thu ${tr(D2.debt)}${D2.dso!=null?", thu chậm "+D2.dso+" ngày":""}`,"Đề xuất: hẹn lịch thu với từng khách trên, ghi vào CRM."]):""}</div>`;
  const kh=`<section class="card" style="margin-top:12px"><div class="card-h"><h2>Khách hàng</h2><span class="hint">khách mua trong kỳ, tái mua, khách mới, khách tiềm năng chưa mua</span></div><div class="grid kpis">${kpi("Khách mua trong kỳ",nf(K.buyers.length),`tháng ${pm}: ${K.pBuyers.length}`)}${kpi("Khách tái mua",`${K.re.length} · ${reP==null?"—":kpPct(reP)}`,`đã mua trước kỳ${preP==null?"":` · T${pm}: ${K.pRe.length} · ${kpPct(preP)}`}`)}${kpi("Khách mới mua",nf(K.moi.length),`T${pm}: ${K.pMoi.length}`)}${kpi("Khách tiềm năng chưa mua",nf(K.tiem.length),"trên CRM, chưa có đơn nào")}${kpi("Khách tiềm năng mới",K.tiemMoi==null?"—":nf(K.tiemMoi),K.tiemMoi==null?"CRM nhập lại 10/2026 nên chưa đếm theo tháng; từ tháng 11 tính theo ngày tạo khách":"tạo trên CRM trong kỳ, chưa có đơn")}</div></section>`;
  const dRow=n=>D2?D2.rows.filter(x=>(x.owner_name||"")===n):[];
  const sale=`<section class="card" style="margin-top:12px"><div class="card-h"><h2>Top nhân viên sale</h2><span class="hint">xếp theo doanh số kỳ này</span></div>${tbl(["#","Nhân viên",`Doanh số · T${pm}`,"Đơn","Khách mua · mới","Còn phải thu (đơn trong kỳ)","Khách quá chu kỳ","Nợ quá 30 ngày"],K.owners.map((x,i)=>{const d30=dRow(x.n).reduce((a,y)=>a+y.b60+y.b90+y.b90p,0);return `<tr${x.n?"":` style="background:rgba(240,160,32,.08)"`}><td>${x.n?`<span class="tb-rk">${i+1}</span>`:""}</td><td><b>${esc(x.n||"Khách chưa gán người")}</b></td><td class="n">${tr(x.v)} · ${tr(x.pv)}</td><td class="n">${x.don}</td><td class="n">${x.kh.size} · ${x.moi.size}</td><td class="n ${x.no?"t-red":""}">${tr(x.no)}</td><td class="n ${x.late?"t-red":""}">${x.late}</td><td class="n ${d30?"t-red":""}">${D2?tr(d30):"—"}</td></tr>`}))}
    ${K.topOwn&&K.conc>=.8?`<p class="hint">${kpPct(K.conc)} đơn đang gắn tài khoản ${esc(K.topOwn.n)}: gán đúng người phụ trách khách trên CRM để tính đúng từng sale.</p>`:""}</section>`;
  const IT=(KP.d.items||[]),IV=IT.reduce((a,x)=>a+(+x.revenue||0),0);
  const sp=`<section class="card" style="margin-top:12px"><div class="card-h"><h2>Top sản phẩm bán chạy</h2><span class="hint">theo doanh thu đơn đã duyệt</span></div>${tbl(["#","Sản phẩm","Số bán","Doanh thu","% kênh","Nhóm"],IT.slice(0,8).map((x,i)=>`<tr><td><span class="tb-rk">${i+1}</span></td><td>${esc(x.name||x.sku)}</td><td class="n">${nf(x.qty)}</td><td class="n">${tr(x.revenue)}</td><td class="n">${kpP(+x.revenue||0,IV)}</td><td>${esc(x.group_name||"")}</td></tr>`))}</section>`;
  m.innerHTML=H("Kênh phân phối · Việc của team Sale",pLabel())+kp+
    (todo.length?`<section class="card" style="padding:10px 14px"><div class="tb-todo"><b>Việc cần làm (${todo.length}):</b>${todo.map(t=>pill(t[1],t[0])).join("")}</div></section>`:"")+
    `<div class="tb-teams">${c1}${c2}${c3}${c4}</div>${kh}${sale}${sp}`;
}

function kpBind(m){
  m.querySelectorAll("[data-kpal]").forEach(b=>b.onclick=()=>{KP.al=b.dataset.kpal;renderMain()});
  m.querySelectorAll("[data-kptg]").forEach(tr0=>tr0.onclick=()=>{const k=tr0.dataset.kptg;KP.open[k]=!KP.open[k];
    m.querySelectorAll(`[data-kps="${k}"]`).forEach(x=>x.style.display=KP.open[k]?"":"none");const c=m.querySelector(`[data-kpcar="${k}"]`);if(c)c.textContent=KP.open[k]?"▾":"▸"})}

function kpPage(m){
  kpLoad();if(typeof ptLoad==="function")ptLoad();
  const adm=IS_ADMIN_HOST()&&(typeof dhOk!=="function"||dhOk());if(adm)b2bLoad();
  const head=t=>H("Kênh phân phối",pLabel())+`<section class="card"><p class="hint pad">${t}</p></section>`;
  if(KP.err){m.innerHTML=H("Kênh phân phối",pLabel())+`<div class="note red">${esc(KP.err)}</div>`;return}
  if(!KP.d||KP.key!==PERIOD.from+"|"+PERIOD.to){m.innerHTML=head("Đang tải đơn Kênh phân phối…");return}
  const K=kpCalc(KP.d),D2=kpDebt();
  if(!adm){kpOps(m,K,D2);kpBind(m);return}
  if(B2BR.err){m.innerHTML=H("Kênh phân phối",pLabel())+`<div class="note red">${esc(B2BR.err)}</div>`;return}
  const X=b2bChannel("B2B");if(!X){m.innerHTML=head("Đang tải doanh thu…");return}
  if(!X.has){m.innerHTML=head("Kỳ này chưa có đơn Kênh phân phối đã duyệt.");return}
  const r=tqKenhRows().find(z=>z.k==="B2B");if(!r||r.dt==null){m.innerHTML=head("Đang tải doanh thu…");return}
  kpAdm(m,K,X,r,D2);kpBind(m);
}
(function(){if(typeof document==="undefined"||document.getElementById("kpp-css"))return;const s=document.createElement("style");s.id="kpp-css";s.textContent=`
.kp-lay{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}@media(max-width:1000px){.kp-lay{grid-template-columns:1fr}}
.kp-halves{display:grid;grid-template-columns:1fr 1fr;gap:22px}@media(max-width:1000px){.kp-halves{grid-template-columns:1fr}}
.kp-h2{font-size:16px;margin:0 0 2px}.kp-h4{font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;opacity:.65;margin:10px 0 6px}`;document.head.appendChild(s)})();
