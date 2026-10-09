/* =====================================================================
   TỔNG QUAN CÔNG TY & CÔNG VIỆC TOÀN CÔNG TY (bản điều hành)
   Mục tiêu: mở trang 5 giây là thấy công ty chạy thế nào, chỗ nào không đạt,
   việc gì chị phải xử lý / duyệt; ưu tiên ngoại lệ, cảnh báo, chênh lệch mục tiêu.
   Chỉ đọc số liệu sẵn có (không đổi nghiệp vụ, API).
   ===================================================================== */
const XB={ceo:null,ap:null,at:0,busy:false};
async function xbLoad(){
  if(typeof svApi!=="function"||XB.busy||Date.now()-XB.at<60000)return;XB.busy=true;
  try{const [c,a]=await Promise.all([svApi("/api/dashboards/ceo").catch(()=>null),svApi("/api/approvals").catch(()=>null)]);XB.ceo=c;XB.ap=a||[];XB.at=Date.now();if(PAGE==="exec")renderMain()}
  finally{XB.busy=false}
}
const XS={good:["s-grn","Tốt"],warn:["s-amb","Cần chú ý"],bad:["s-red","Nguy hiểm"],none:["s-gry","Chưa đủ dữ liệu"]};
const xsDot=k=>`<span class="xs"><i class="sdot ${XS[k][0]}"></i>${XS[k][1]}</span>`;
const xChg=(a,b,inv)=>!b||!a?"":`<span class="xc ${(a>=b)!==!!inv?"up":"dn"}">${a>=b?"▲":"▼"} ${Math.abs((a-b)/b*100).toFixed(0)}%</span>`;
function spark(get,keys,c="#2f6fde"){const v=keys.map(k=>+get(k)||0);if(!v.some(x=>x))return `<span class="hint">—</span>`;const mx=Math.max(...v),W=72,H=24;return `<svg class="spk" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline fill="none" stroke="${c}" stroke-width="1.6" points="${v.map((x,i)=>(v.length<2?W/2:i*W/(v.length-1)).toFixed(1)+","+(H-2-x/mx*(H-4)).toFixed(1)).join(" ")}"/></svg>`}
const depOfUser=id=>{const d=D(),u=d.users.find(x=>x.id===id);return u?((d.departments||[]).find(p=>p.k===u.phongBan)||{}).n||"":""};
const depOfName=n=>{const d=D(),u=d.users.find(x=>x.name===n);return u?depOfUser(u.id):""};
function itemDept(x){return x.src==="card"?"Marketing":x.src==="order"?"Marketing · Digital":(depOfUser(x.nguoi)||TEAMS[x.team]||"Chung")}

/* ---------- việc chị cần xử lý: chỉ ngoại lệ ---------- */
function execAttention(){
  const d=D(),today=d.settings.today,out=[],I=typeof cvItems==="function"?cvGroup(cvItems()):[];
  (XB.ap||[]).slice(0,4).forEach(a=>out.push({w:9,t:`Duyệt đơn B2B ${a.entity_label||""}${a.customer_name?" · "+a.customer_name:""}`,dep:"Kinh doanh B2B",who:a.requester_name||"",han:"Chờ duyệt",st:["Chờ duyệt","amb"],btn:"Duyệt",href:a.entity_id?"/admin/orders/"+a.entity_id:"/admin/orders"}));
  const vc=d.cards.filter(c=>c.step==="dceo");if(vc.length)out.push({w:9,t:`${vc.length} video chờ CEO duyệt`,dep:"Marketing",who:"Lead Content & Media đã duyệt",han:"Chờ duyệt",st:["Chờ duyệt","amb"],btn:"Duyệt",go:"cv"});
  (d.tasks||[]).filter(t=>(t.oanhOk||[]).length).forEach(t=>out.push({w:9,t:`Video nhân bản chờ CEO duyệt: ${t.ten.replace(/^Nhân bản video win: /,"")}`,dep:"Marketing",who:userName(t.nguoi),han:"Chờ duyệt",st:["Chờ duyệt","amb"],btn:"Duyệt",go:"win"}));
  execApprovals().filter(a=>!/video chờ CEO duyệt/.test(a[0])).forEach(a=>out.push({w:7,t:a[0],dep:a[1].split(" · ")[0],who:a[1].split(" · ")[1]||"",han:"Chờ duyệt",st:["Chờ duyệt","amb"],btn:"Duyệt",go:a[2]}));
  I.filter(x=>x.late).sort((a,b)=>b.lateD-a.lateD).slice(0,4).forEach(x=>out.push({w:8+Math.min(1,x.lateD/10),t:x.ten,dep:itemDept(x),who:userName(x.nguoi)||"Chưa giao",han:`Trễ ${x.lateD} ngày`,late:1,st:["Quá hạn","red"],btn:"Xử lý",open:x}));
  if(typeof execStock==="function"){const S=execStock()||[];S.filter(r=>r.st[1]==="red"||r.st[1]==="amb").slice(0,2).forEach(r=>out.push({w:r.st[1]==="red"?8:6,t:`${r.ten}: ${r.st[0].toLowerCase()} (tồn ${nf(r.ton)})`,dep:"Sản xuất & kho",who:"Kế toán kho",han:"Hôm nay",st:[r.st[0],r.st[1]],btn:"Xem",go:"sx_kho"}))}
  if(typeof SX==="function"&&SX()){const ck=SX().batches.filter(b=>b.st==="CHO_KIEM").length;if(ck)out.push({w:6,t:`${ck} lô chờ kế toán kiểm`,dep:"Sản xuất & kho",who:"Kế toán",han:"Hôm nay",st:["Chờ kiểm","amb"],btn:"Xem",go:"sx_lo"})}
  execAlerts().filter(a=>a[0]==="red"&&!/thẻ video trễ/.test(a[1])).forEach(a=>out.push({w:7,t:a[1],dep:a[2].split(" · ")[0],who:"",han:"—",st:["Cảnh báo","red"],btn:"Xem",go:a[3]}));
  I.filter(x=>!x.late&&x.st!=="done"&&x.han>=today&&x.han<=today+1&&x.uu==="Cao").slice(0,2).forEach(x=>out.push({w:5,t:x.ten,dep:itemDept(x),who:userName(x.nguoi)||"Chưa giao",han:x.han===today?"Hôm nay":"Ngày mai",st:["Sắp đến hạn","blu"],btn:"Xem",open:x}));
  return out.sort((a,b)=>b.w-a.w);
}

/* =========================== TỔNG QUAN CÔNG TY =========================== */
function pExec(m){
  xbLoad();
  const d=D(),N=execNums(PERIOD.from,PERIOD.to),pr=prevRange(),P=execNums(pr.from,pr.to),T=execTargets(),days=pDays(),k=days.length/30,ok=allOK(N,P);
  const cl=execCost(N),cTot=sum(cl.flatMap(g=>g[1]),x=>x[1]),cTotP=sum(execCost(P).flatMap(g=>g[1]),x=>x[1]),cOK=Object.keys(N.C).every(x=>!N.C[x]||P.C[x]);
  const lr=[N.L.fb,N.L.spe,N.L.tts].filter(x=>x!=null),lTot=sum(lr,x=>x),lP=[P.L.fb,P.L.spe,P.L.tts].filter(x=>x!=null),lTotP=sum(lP,x=>x),lDT=(N.L.fb!=null?N.fbGiao:0)+(N.L.spe!=null?N.spDT:0)+(N.L.tts!=null?N.tt:0);
  const O=execOrders(PERIOD.from,PERIOD.to),OP=execOrders(pr.from,pr.to),oTot=O.tts+O.spe+O.fb,oTotP=OP.tts+OP.spe+OP.fb;
  const AT=execAttention(),AL=execAlerts(),late=AT.filter(a=>a.late).length,wait=AT.filter(a=>a.st[0]==="Chờ duyệt").length;
  const tg=T.tong*k,margin=lDT?lTot/lDT:0,cr=N.tong?cTot/N.tong:0;
  const K=[
   {l:"Doanh số",ic:"money",v:N.tong?tr(N.tong):"",cmp:ok?xChg(N.tong,P.tong):"",tgt:tg?`${Math.round(N.tong/tg*100)}% mục tiêu`:"",st:!N.tong?"none":tg?(N.tong>=tg?"good":N.tong>=tg*.8?"warn":"bad"):ok&&N.tong<P.tong*.9?"warn":"good",go:"bc_tong"},
   {l:"Chi phí",ic:"wallet",v:cTot?tr(cTot):"",cmp:ok&&cOK?xChg(cTot,cTotP,true):"",tgt:N.tong?`${(cr*100).toFixed(0)}% doanh số`:"",st:!cTot?"none":cr>.55?"bad":cr>.45?"warn":"good",act:"cost"},
   {l:"Lợi nhuận",ic:"trend",v:lr.length?tr(lTot):"",cmp:ok&&lP.length===lr.length?xChg(lTot,lTotP):"",tgt:lDT?`biên ${(margin*100).toFixed(1)}% · MT 18,5%`:"",st:!lr.length?"none":margin>=.185?"good":margin>=.1?"warn":"bad",go:"pl"},
   {l:"Đơn hàng",ic:"cart",v:oTot?nf(oTot):"",cmp:ok&&oTotP?xChg(oTot,oTotP):"",tgt:"",st:!oTot?"none":ok&&oTotP&&oTot<oTotP*.9?"warn":"good",go:"bc_tong"},
   {l:"Việc cần xử lý",ic:"task",v:String(AT.length),cmp:"",tgt:`${late} quá hạn · ${wait} chờ duyệt`,st:late?"bad":AT.length?"warn":"good",go:"cv_nv",zero:!AT.length},
   {l:"Cảnh báo vận hành",ic:"alert",v:String(AL.length),cmp:"",tgt:AL.length?`${AL.filter(a=>a[0]==="red").length} nghiêm trọng`:"không có cảnh báo",st:AL.some(a=>a[0]==="red")?"bad":AL.length?"warn":"good",zero:!AL.length,anchor:"xal"}];
  const kcell=x=>{const none=!x.v;return `<button type="button" class="xk${none||x.zero?" mut":""}" ${x.go?`data-go="${x.go}"`:""} ${x.act?`data-kact="${x.act}"`:""} ${x.anchor?`data-anc="${x.anchor}"`:""}><span class="xkh"><span class="kic k-${x.ic}">${ico(x.ic)}</span><span class="xkl">${x.l}</span></span><span class="xkv numeric">${none?"Chưa đủ dữ liệu":x.v}</span><span class="xkm">${xsDot(x.st)}${x.cmp?` ${x.cmp}`:""}</span>${x.tgt?`<span class="xkm">${x.tgt}</span>`:""}</button>`};
  // kênh kinh doanh
  const CH=[["fb","Facebook",N.fbDT,P.fbDT,O.fb,N.C.gvFB+N.C.adsFB,N.L.fb,T.fb,getD("fb",6),"bc_fb"],["tts","TikTok Shop",N.tt,P.tt,O.tts,N.C.adsTT+N.C.gvTT+N.C.phiTT+N.C.khacTT,N.L.tts,T.tts,getD("tts",0),"bc_tiktok"],["spe","Shopee",N.spDT,P.spDT,O.spe,N.C.adsSPE+N.C.gvSPE+N.C.phiSPE,N.L.spe,T.spe,getD("spe",0),"bc_shopee"]];
  const ceo=XB.ceo;
  const chRow=([t,n,v,pv,o,c,l,tgM,get,go])=>{const tgv=tgM*k,flag=!v?["Chưa có dữ liệu","gry"]:symOK(N,P,t)&&pv&&v<pv*.9?["Đang giảm","red"]:c&&v&&c/v>.5&&(l==null||l/v<.1)?["Chi phí cao, lãi thấp","amb"]:null;
    return `<tr class="clk${v?"":" mut"}" data-go="${go}"><td><b>${n}</b>${flag?` ${pill(flag[0],flag[1])}`:""}</td><td class="n">${v?tr(v):"—"}</td><td class="n">${o?nf(o):"—"}</td><td class="n">${c?tr(c):"—"}</td><td class="n ${l<0?"t-red":""}">${l==null?"—":tr(l)}</td><td class="n">${tgv&&v?`<b class="${v>=tgv?"t-grn":v<tgv*.8?"t-red":""}">${Math.round(v/tgv*100)}%</b>`:"—"}</td><td class="n">${v&&symOK(N,P,t)?xChg(v,pv):"—"}</td><td>${spark(get,days)}</td></tr>`};
  const b2bRow=`<tr class="clk${ceo&&ceo.revenue_month?"":" mut"}" data-href="/admin/ceo"><td><b>B2B / Đại lý</b> ${ceo?"":pill("Đang tải","gry")}<small class="hint">tháng này · CRM</small></td><td class="n">${ceo&&ceo.revenue_month?tr(ceo.revenue_month):"—"}</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td><span class="hint">—</span></td></tr>`;
  // 4 mảng
  const fbTao=pSum("fb",0).v,fbHuy=pSum("fb",2).v,huy=fbTao?fbHuy/fbTao:0;
  const down=CH.filter(x=>symOK(N,P,x[0])&&x[3]&&x[2]<x[3]*.9).map(x=>x[1]);
  const al1=re=>{const a=AL.find(x=>re.test(x[3]));return a?`<div class="xal1"><i class="sdot ${a[0]==="red"?"s-red":"s-amb"}"></i>${esc(a[1])}</div>`:`<div class="xal1 ok"><i class="sdot s-grn"></i>Không có cảnh báo</div>`};
  const adsSpend=N.C.adsFB+N.C.adsTT+N.C.adsSPE,adsRaw=rAds(0,PERIOD.from,PERIOD.to),roas=adsRaw?N.adsDT/adsRaw:0;
  const mkWait=d.cards.filter(c=>["dkb","dvd","dceo"].includes(c.step)).length,mkLate=d.cards.filter(isLate).length;
  const sx=typeof SX==="function"&&SX(),stk=typeof execStock==="function"?execStock()||[]:[];
  const blk=(t,go,rows,alert)=>`<section class="card xblk"><div class="card-h"><h2>${t}</h2><button class="lnk" ${go.startsWith("/")?`data-href="${go}"`:`data-go="${go}"`}>Chi tiết →</button></div><dl class="xdl">${rows.map(([a,b,cl])=>`<dt>${a}</dt><dd class="numeric ${cl||""}">${b}</dd>`).join("")}</dl>${alert}</section>`;
  const blocks=[
   blk("Kinh doanh B2C","bc_tong",[["Doanh thu kỳ",N.tong?tr(N.tong):"Chưa đủ dữ liệu",N.tong?"":"mut"],["Đơn hàng",oTot?nf(oTot):"Chưa đủ dữ liệu",oTot?"":"mut"],["Tỷ lệ hủy FB",fbTao?(huy*100).toFixed(1)+"%":"Chưa đủ dữ liệu",huy>.2?"t-red":fbTao?"":"mut"],["Kênh đang giảm",down.length?down.join(", "):"Không có",down.length?"t-red":""]],al1(/fb_|bc_|doisoat/)),
   blk("Kinh doanh B2B","/admin/ceo",[["Khách theo dõi",ceo?`${nf(ceo.customers_total)} (${nf(ceo.customers_with_orders)} có đơn)`:"Đang tải…",""],["Pipeline","Chưa có","mut"],["Đơn chờ duyệt",XB.ap?nf(XB.ap.length):"—",XB.ap&&XB.ap.length?"t-amb":""],["Công nợ chính thức",ceo?tr(ceo.official_debt):"—",""]],XB.ap&&XB.ap.length?`<div class="xal1"><i class="sdot s-amb"></i>${XB.ap.length} đơn B2B đang chờ CEO duyệt</div>`:ceo&&ceo.data_quality&&ceo.data_quality.orders_needs_review?`<div class="xal1"><i class="sdot s-amb"></i>${ceo.data_quality.orders_needs_review} đơn cần kiểm dữ liệu</div>`:`<div class="xal1 ok"><i class="sdot s-grn"></i>Không có cảnh báo</div>`),
   blk("Marketing","hieuqua",[["Chi quảng cáo",adsSpend?tr(adsSpend):"Chưa đủ dữ liệu",adsSpend?"":"mut"],["Doanh thu Ads",N.adsDT?tr(N.adsDT):"Chưa đủ dữ liệu",N.adsDT?"":"mut"],["ROAS Ads FB",roas?roas.toFixed(2).replace(".",","):"—",roas&&roas<2?"t-red":""],["Nội dung chờ duyệt",nf(mkWait),mkWait?"t-amb":""]],mkLate?`<div class="xal1"><i class="sdot s-red"></i>${mkLate} thẻ video trễ hạn</div>`:al1(/ads|adshieuqua|kehoach|dieuchinh/)),
   blk("Sản xuất & kho","sx_tq",[["Đang sản xuất",sx?nf(sx.requests.filter(r=>r.st==="DANG_LAM").length)+" nhu cầu":"—",""],["Lô chờ kiểm",sx?nf(sx.batches.filter(b=>b.st==="CHO_KIEM").length):"—",sx&&sx.batches.some(b=>b.st==="CHO_KIEM")?"t-amb":""],["Sắp hết / âm kho",nf(stk.filter(r=>r.st[1]==="amb"||r.st[1]==="red").length),stk.some(r=>r.st[1]==="red")?"t-red":""],["NVL thiếu","Chưa theo dõi","mut"]],(()=>{const r=stk.find(x=>x.st[1]==="red")||stk.find(x=>x.st[1]==="amb");return r?`<div class="xal1"><i class="sdot ${r.st[1]==="red"?"s-red":"s-amb"}"></i>${esc(r.ten)}: ${r.st[0].toLowerCase()}</div>`:`<div class="xal1 ok"><i class="sdot s-grn"></i>Không có cảnh báo</div>`})())];
  const act=(d.activity||[]).slice(0,7);
  const actSt=msg=>/duyệt/i.test(msg)?["Đã duyệt","grn"]:/khóa|khoá|xóa|xoá|trả lại/i.test(msg)?["Thay đổi","amb"]:/giao/i.test(msg)?["Đã giao","blu"]:["Cập nhật","gry"];
  const upd=d.updatedAt?new Date(d.updatedAt):new Date(),updS=upd.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+" "+upd.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"});
  m.innerHTML=`<div class="xhead"><div class="xht"><h1>Tổng quan công ty</h1><span>${esc(pLabel())}</span><span class="sep" aria-hidden="true"></span><span>so với ${vnd(pr.from)} – ${vnd(pr.to)}</span><span class="xinfo" tabindex="0" title="Số liệu quản trị nội bộ để điều hành (ước tính, phân bổ, so mục tiêu), không phải báo cáo tài chính. Sổ sách chính thức do Kế toán quản lý trên MISA." aria-label="Số liệu quản trị nội bộ, sổ sách chính thức trên MISA">ⓘ</span></div><div class="xupd">${ico("clock")} Cập nhật <span class="numeric">${updS}</span></div></div>
  <section class="xkstrip" aria-label="Tóm tắt điều hành">${K.map(kcell).join("")}</section>
  <div class="xrow2">
   <section class="card flush"><div class="card-h pad"><h2>Hiệu quả kinh doanh theo kênh</h2><span class="hint">lãi đóng góp chưa trừ lương, kho, chi phí chung · <button class="lnk" id="tg-ed">Sửa mục tiêu</button></span></div>
    <div class="tbl"><table><thead><tr><th>Kênh</th><th class="n">Doanh thu</th><th class="n">Đơn</th><th class="n">Chi phí</th><th class="n">Lãi</th><th class="n">% MT</th><th class="n">Kỳ trước</th><th>Xu hướng</th></tr></thead><tbody>${CH.map(chRow).join("")}${b2bRow}
    <tr class="tot"><td>Tổng B2C</td><td class="n">${tr(N.tong)}</td><td class="n">${oTot?nf(oTot):"—"}</td><td class="n">${tr(cTot)}</td><td class="n">${lr.length?tr(lTot):"—"}</td><td class="n">${tg?Math.round(N.tong/tg*100)+"%":"—"}</td><td class="n">${ok?xChg(N.tong,P.tong):"—"}</td><td></td></tr></tbody></table></div></section>
   <section class="card flush xatt"><div class="card-h pad"><h2>Việc cần chị xử lý <span class="hint">${AT.length}</span></h2><button class="lnk" data-go="cv_nv">Tất cả việc →</button></div>
    ${AT.length?`<div class="xattl">${AT.slice(0,6).map((a,i)=>`<div class="xai"><i class="sdot s-${a.st[1]}"></i><div class="xat"><b>${esc(a.t)}</b><small>${esc(a.dep||"")}${a.who?" · "+esc(a.who):""} · <span class="${a.late?"t-red":""}">${esc(a.han)}</span></small></div>${pill(a.st[0],a.st[1])}<button class="btn sm${a.btn==="Duyệt"?" pri":""}" data-xai="${i}">${a.btn}</button></div>`).join("")}</div>`:`<p class="empty pad">Không có việc nào cần chị xử lý.</p>`}</section>
  </div>
  <div class="xrow3">${blocks.join("")}</div>
  <section class="card flush" id="xal"><div class="card-h pad"><h2>Hoạt động mới nhất</h2><span class="hint">${AL.length?`${AL.length} cảnh báo vận hành ở danh sách bên trên`:""}</span></div>
   <div class="tbl"><table><thead><tr><th>Thời gian</th><th>Nội dung thay đổi</th><th>Người thực hiện</th><th>Bộ phận</th><th>Trạng thái</th></tr></thead><tbody>${act.map(a=>{const s=actSt(a.msg);return `<tr><td class="numeric">${esc(a.t||"")} ${esc(String(a.d||"").replace(/\/\d{4}$/,""))}</td><td>${esc(a.msg)}</td><td>${esc(a.who)}</td><td>${esc(depOfName(a.who)||"—")}</td><td>${pill(s[0],s[1])}</td></tr>`}).join("")||`<tr><td colspan="5" class="empty">Chưa có hoạt động.</td></tr>`}</tbody></table></div></section>`;
  m.querySelectorAll("[data-href]").forEach(b=>b.onclick=()=>{location.href=b.dataset.href});
  m.querySelectorAll("[data-xai]").forEach(b=>b.onclick=()=>{const a=AT[+b.dataset.xai];if(a.href){location.href=a.href;return}if(a.open){if(a.open.src==="card")openCard(a.open.id);else if(a.open.src==="order"){PAGE="order";MOD="";render()}else openTask(a.open.id);return}if(a.go){PAGE=a.go;MOD="";render();scrollTo(0,0)}});
  m.querySelectorAll("[data-anc]").forEach(b=>b.onclick=()=>{const t=document.querySelector(".xatt");if(t)t.scrollIntoView({behavior:"smooth",block:"center"})});
  const cb=m.querySelector('[data-kact="cost"]');if(cb)cb.onclick=()=>openDrawerHTML(`<h2>Chi phí trong kỳ</h2><p class="hint">${esc(pLabel())} · tổng ${tr(cTot)}${N.tong?" · "+pc(cTot,N.tong)+" doanh số":""}</p>${cl.map(([g,L])=>`<h3>${g}</h3>${tbl(["Khoản","Số tiền","% doanh số"],L.map(x=>`<tr><td>${x[0]}</td><td class="n">${tr(x[1])}</td><td class="n">${pc(x[1],N.tong)}</td></tr>`))}`).join("")||`<p class="empty">Chưa có chi phí trong kỳ.</p>`}`);
  $("#tg-ed").onclick=()=>{const t=execTargets();openDrawerHTML(`<h2>Mục tiêu doanh số theo tháng</h2><form class="frm" id="tgf">${[["tong","Tổng doanh số"],["tts","TikTok Shop (GMV)"],["spe","Shopee"],["fb","Facebook (giao thành công)"],["ads","Ads Facebook (KPI doanh số đơn chốt)"]].map(([k2,l])=>`<label class="field">${l} (đ/tháng)<input type="number" min="0" id="tg-${k2}" value="${t[k2]||0}"></label>`).join("")}<p class="hint">Để 0 nếu chưa đặt.</p><button class="btn pri">Lưu</button></form>`);$("#tgf").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"sửa mục tiêu doanh số",dt=>{execTargets();["tong","tts","spe","fb","ads"].forEach(k2=>dt.targets[k2]=+$("#tg-"+k2).value||0)});closeDrawer();renderMain()}};
}
PAGES.exec=pExec;

/* =========================== CÔNG VIỆC TOÀN CÔNG TY =========================== */
let CVQ={f:"open"};
function pCvTong(m){
  const d=D(),today=d.settings.today,L=cvFilter(cvItems());
  const late=L.filter(x=>x.late),doing=L.filter(x=>x.st==="doing"),rv=L.filter(x=>x.st==="review"),cg=L.filter(x=>x.st==="cg"),done=L.filter(x=>x.st==="done");
  const due=L.filter(x=>x.han<=today),onT=due.filter(x=>x.st==="done"||!x.late),soon=L.filter(x=>!x.late&&x.st!=="done"&&x.han>=today&&x.han<=today+2);
  const stale=L.filter(x=>x.src==="card"&&x.st!=="done"&&!x.late&&x.st!=="cg"&&x.han&&x.han<today+0&&false);
  const F={open:["Việc cần xử lý",L.filter(x=>x.st!=="done").sort((a,b)=>(b.late-a.late)||(a.st==="review"?-1:0)-(b.st==="review"?-1:0)||a.han-b.han)],late:["Quá hạn",late],review:["Chờ duyệt",rv],cg:["Chưa giao",cg],doing:["Đang thực hiện",doing],all:["Tất cả",L],done:["Hoàn thành",done]};
  const cur=F[CVQ.f]||F.open,rows=cur[1].slice().sort((a,b)=>(b.late-a.late)||a.han-b.han),G=cvGroup(rows);
  const tgL={all:"Cả tháng",today:"Hôm nay",week:"Tuần này",lweek:"Tuần trước"};
  const st=(f,l,v,dot,h)=>`<button type="button" class="xk${!v?" mut":""}${CVQ.f===f?" on":""}" data-cvq="${f}"><span class="xkh"><i class="sdot ${dot}"></i><span class="xkl">${l}</span></span><span class="xkv numeric">${v}</span><span class="xkm">${h}</span></button>`;
  const prog=x=>{if(x.src==="card"&&x.cats&&x.n>1)return Math.round(((x.cats.duyet||0)+(x.cats.dang||0))/x.n*100);if(x.src==="card"){const c=d.cards.find(y=>y.id===x.id),i=c?Math.max(0,DP_STEPS.indexOf(c.step)):0;return Math.round(i/(DP_STEPS.length-1)*100)}if(x.ck&&x.ck.length)return Math.round(x.ck.filter(c=>c.x).length/x.ck.length*100);return x.st==="done"?100:x.st==="review"?80:x.st==="doing"?50:0};
  const stP=x=>x.late?["Quá hạn","red"]:x.st==="review"?["Chờ duyệt","amb"]:x.st==="cg"?["Chưa giao","gry"]:x.st==="done"?["Hoàn thành","grn"]:x.st==="doing"?["Đang làm","blu"]:x.st==="nhan"?["Đã nhận việc","blu"]:["Cần làm","gry"];
  const side=(t,I0,dot)=>{const I=cvGroup(I0);return `<div class="xcg"><div class="xcgh"><i class="sdot ${dot}"></i><b>${t}</b><span class="numeric">${I0.length}</span></div>${I.slice(0,3).map(x=>`<div class="xcgi clk" data-cv="${x.id}" data-src="${x.src}"${x.n>1?` data-grp="${x.ids.join(",")}"`:""}><span>${esc(x.ten||"")}</span><small>${esc(userName(x.nguoi)||"Chưa giao")} · ${x.late?`<b class="t-red">trễ ${x.lateD} ngày</b>`:(x.han?"hạn "+dd(x.han):"chưa có hạn")}</small></div>`).join("")||`<p class="hint">Không có.</p>`}${I.length>3?`<button class="lnk" data-cvq="${t==="Quá hạn"?"late":t==="Chờ duyệt"?"review":t==="Chưa có người làm"?"cg":"open"}">+${I.length-3} dòng nữa</button>`:""}</div>`};
  m.innerHTML=`<div class="xhead"><div class="xht"><h1>${CVF.scope==="mine"?"Việc của tôi":CVF.scope==="team"?"Công việc của team":"Công việc toàn công ty"}</h1><span>${tgL[CVQ.tg||CVF.tg]||"Cả tháng"} ${MONTH.mon}/${MONTH.year}</span><span class="sep" aria-hidden="true"></span><span><b class="t-red">${late.length} quá hạn</b> · <b class="t-amb">${rv.length} chờ duyệt</b> · ${doing.length} đang thực hiện</span></div><div>${newTaskBtn()}</div></div>
  <div class="xfbar"><input id="cv-q" placeholder="Tìm việc, mã thẻ, người…" value="${esc(CVF.q)}"><div class="seg" role="group" aria-label="Thời gian">${[["today","Hôm nay"],["week","Tuần này"],["lweek","Tuần trước"],["all","Cả tháng"]].map(([k2,t])=>`<button class="${CVF.tg===k2?"on":""}" data-tg="${k2}">${t}</button>`).join("")}</div>
   ${cvWhoSelect()}${ME.role==="admin"?`<select id="cv-team" aria-label="Team">${opt([["","Team"]].concat(Object.entries(TEAMS)),CVF.team)}</select>`:""}<select id="cv-st" aria-label="Trạng thái">${opt([["","Mọi trạng thái"],["todo","Cần làm"],["doing","Đang làm"],["review","Gửi duyệt"],["done","Hoàn thành"],["late","Trễ hạn"]],CVF.st)}</select><select id="cv-da" aria-label="Dự án">${opt([["","Dự án"]].concat((d.projects||[]).map(p=>[p.id,p.ten])),CVF.da)}</select><select id="cv-uu" aria-label="Ưu tiên">${opt([["","Ưu tiên"]].concat(UU),CVF.uu)}</select></div>
  <section class="xkstrip x6">${st("late","Quá hạn",late.length,"s-red",late.length?"cần xử lý ngay":"không có")}${st("review","Chờ duyệt",rv.length,"s-amb","kịch bản, video, việc")}${st("doing","Đang thực hiện",doing.length,"s-blu","đang chạy")}${st("cg","Chưa giao",cg.length,"s-gry","chưa có người làm")}${st("all","Tổng nhiệm vụ",L.length,"s-gry",done.length+" đã xong")}<div class="xk ro${due.length?"":" mut"}"><span class="xkh"><i class="sdot ${due.length&&onT.length/due.length<.8?"s-red":"s-grn"}"></i><span class="xkl">Tỷ lệ đúng hạn</span></span><span class="xkv numeric">${due.length?Math.round(onT.length/due.length*100)+"%":"Chưa đủ dữ liệu"}</span><span class="xkm">${onT.length}/${due.length} việc tới hạn</span></div></section>
  <div class="xrow2 cvq">
   <section class="card flush"><div class="card-h pad"><h2>${cur[0]} <span class="hint">${G.length}</span></h2><div class="seg" role="group" aria-label="Cách xem"><button class="on">Danh sách</button><button data-go="cv_kb">Kanban</button><button data-go="cv_lich">Lịch</button><button data-go="cv_da">Tiến độ</button></div></div>
    <div class="tbl"><table><thead><tr><th>Tên việc · bộ phận</th><th>Người phụ trách</th><th>Hạn</th><th>Ưu tiên</th><th>Tiến độ</th><th>Trạng thái</th></tr></thead><tbody>
    ${G.slice(0,14).map(x=>{const s=stP(x),p=prog(x);return `<tr class="clk" data-cv="${x.id}" data-src="${x.src}"${x.n>1?` data-grp="${x.ids.join(",")}"`:""}><td><div class="xtn"><i class="sdot s-${s[1]}"></i><div class="xtc"><span>${esc(x.ten||"")}</span><small>${x.sub?esc(x.sub):esc(itemDept(x))+(x.n>1?"":x.loai?" · "+esc(x.loai):"")}</small>${cvSegHtml(x)}</div></div></td><td>${avatar(x.nguoi)}${esc(userName(x.nguoi)||"Chưa giao")}</td><td class="${x.late?"t-red":""} xst">${x.late?`Trễ ${x.lateD} ngày`:dd(x.han)}</td><td class="xst">${x.uu==="Cao"?`<b class="t-red">Cao</b>`:esc(x.uu||"")}</td><td class="xst"><span class="xpb"><i style="width:${p}%"></i></span><small class="numeric">${p}%</small></td><td>${pill(s[0],s[1])}</td></tr>`}).join("")||`<tr><td colspan="7" class="empty">Không có việc.</td></tr>`}</tbody></table></div>${rows.length>14?`<p class="pad"><button class="lnk" data-go="cv_nv">Xem tất cả ${G.length} việc →</button></p>`:""}</section>
   <section class="card xatt"><div class="card-h"><h2>Cần chú ý</h2></div>${side("Quá hạn",late.slice().sort((a,b)=>b.lateD-a.lateD),"s-red")}${side("Chờ duyệt",rv,"s-amb")}${side("Chưa có người làm",cg,"s-gry")}${side("Sắp đến hạn (2 ngày)",soon.sort((a,b)=>a.han-b.han),"s-blu")}</section>
  </div>`;
  bindCvFilter(m);bindNew();bindCvCards(m);
  
  m.querySelectorAll("[data-cvq]").forEach(b=>b.onclick=()=>{CVQ.f=b.dataset.cvq;renderMain()});
}
PAGES.cv_tq=pCvTong;
