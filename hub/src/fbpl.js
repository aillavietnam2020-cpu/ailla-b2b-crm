/* =====================================================================
   TRANG QUẢN TRỊ: BẢNG ĐIỀU KHIỂN LÃI LỖ (P&L) KÊNH FACEBOOK
   Tab 1 Lãi lỗ: doanh thu, tổng chi phí, lợi nhuận, cơ cấu chi phí, so với cùng kỳ tháng trước, so với mục tiêu tháng, cảnh báo và đề xuất.
   Tab 2 Bán hàng: phần của team Sale và Digital (phễu đơn, hủy, hoàn, nguồn đơn) dùng chung bản của trang vận hành.
   Tab 3 Sản phẩm: lãi gộp từng sản phẩm, theo nhóm hàng.
   Dùng các hàm trong fbdash.js; nạp sau fbdash.js.
   ===================================================================== */
const FBD={tab:"pl"},FBD_RET_FC=0.08;/* tỷ lệ hoàn dự kiến 8%: chị Hoa thường dùng */
function fbdShiftMonth(k){const d=pdate(k),t=new Date(d.getFullYear(),d.getMonth()-1,1),last=new Date(d.getFullYear(),d.getMonth(),0).getDate();t.setDate(Math.min(d.getDate(),last));return iso(t)}
const fbdVN=k=>k.slice(8)+"/"+k.slice(5,7);
const fbdCostTot=(C,hasQc)=>C.gv+C.ship+C.shipRet+(hasQc?C.qcT:0);
const fbdPlPct=v=>v.toLocaleString("vi-VN",{maximumFractionDigits:1})+"%";
function fbdCmp(l,cur,prev,rev,fmt){const f=fmt||money,dl=prev?fbdDelta(cur,prev,rev):"";return `<tr><td>${l}</td><td class="n"><b>${f(cur)}</b></td><td class="n">${prev?f(prev):"—"}</td><td class="n">${dl||"—"}</td></tr>`}
/* Cảnh báo và đề xuất của P&L: mỗi mục nói rõ việc cần làm và quy ra tiền. */
function fbdAdvice(x){
  const L=[],{C,Cp,A,prof,days}=x,qcPct=C.dt?C.qcT/C.dt*100:0,margin=C.dt?prof/C.dt*100:0;
  if(C.dt&&margin<FBD_TARGET)L.push(["red","Biên lợi nhuận "+fbdPct(prof,C.dt)+" thấp hơn mục tiêu "+FBD_TARGET.toLocaleString("vi-VN")+"%","Muốn đạt mục tiêu cần thêm khoảng "+money(Math.max(0,FBD_TARGET/100*C.dt-prof))+" lợi nhuận: giảm chi phí quảng cáo hoặc tăng doanh thu ở mã lãi cao. Chi phí vận hành chưa trừ nên biên thật còn thấp hơn."]);
  if(C.dt&&qcPct>35)L.push([qcPct>40?"red":"amb","Chi phí quảng cáo "+fbdPct(C.qcT,C.dt)+" doanh thu (gồm thuế), trên mức theo dõi 35%","Mỗi 1 điểm giảm được ≈ "+money(C.dt*0.01)+". Soát chiến dịch dưới hòa vốn ở dưới đây và dồn ngân sách sang mã đang lãi."]);
  if(C.dt&&C.ship/C.dt>.1)L.push(["amb","Phí vận chuyển "+fbdPct(C.ship,C.dt)+" doanh thu, trên mức 10%","Mỗi 1 điểm giảm được ≈ "+money(C.dt*0.01)+". So phí theo hãng vận chuyển và giảm đơn hoàn."]);
  if(Cp.n&&Cp.dt&&C.dt){const gvP=Cp.gv/Cp.dt*100,gvN=C.gv/C.dt*100;if(gvN-gvP>1.5)L.push(["amb","Giá vốn tăng "+(gvN-gvP).toLocaleString("vi-VN",{maximumFractionDigits:1})+" điểm so với cùng kỳ tháng trước ("+fbdPct(C.gv,C.dt)+" so với "+fbdPct(Cp.gv,Cp.dt)+")","≈ "+money((gvN-gvP)/100*C.dt)+" chi phí tăng thêm. Kiểm tra mã mới bán nhiều, giá nhập đổi, hoặc quà tặng."])}
  if(Cp.n&&Cp.dt&&C.dt){const pp=Cp.gop-Cp.qcT,np=C.gop-C.qcT;if(pp>0&&np<pp*.8)L.push(["red","Lãi đóng góp giảm "+Math.round((1-np/pp)*100)+"% so với cùng kỳ tháng trước","Từ "+money(pp)+" xuống "+money(np)+". Xem doanh thu, chi phí quảng cáo hay giá vốn đang kéo xuống ở bảng so sánh."])}
  /* chiến dịch dưới hòa vốn (ROAS chưa thuế dưới 1,8) */
  try{const D=typeof adfLive==="function"?adfLive():null;if(D){const R=adfAgg(D,days).C.filter(c=>c.typ==="Chuyển đổi"&&c.spend>=3e6&&c.rev/c.spend<1.8).sort((a,b)=>b.spend-a.spend).slice(0,3);
    if(R.length)L.push(["red",R.length+" chiến dịch chuyển đổi dưới điểm hòa vốn (ROAS chưa thuế dưới 1,8)",R.map(c=>esc(c.name.slice(0,40))+": chi "+money(c.spend)+", doanh số "+money(c.rev)+" (ROAS "+(c.rev/c.spend).toLocaleString("vi-VN",{maximumFractionDigits:2})+")").join("; ")+". Đề xuất tắt hoặc sửa mẫu quảng cáo. Doanh số là số Pancake ghép theo mã chiến dịch."])}}catch(e){}
  /* sản phẩm bán lỗ, thiếu giá vốn, mã lãi cao nhất */
  const F=FBC.raw;
  if(F&&F.p&&F.sk){const m={};days.forEach(k=>(F.p[k]||[]).forEach(([i,q,dt,gv])=>{const t=m[i]||(m[i]={i,dt:0,gv:0});t.dt+=dt*1000;t.gv+=gv*1000}));
    const L2=Object.values(m).map(t=>Object.assign(t,{n:(F.sk[t.i]||["?","?"])[1]})).filter(t=>t.dt>=3e6);
    const neg=L2.filter(t=>t.dt-t.gv<0).sort((a,b)=>(a.dt-a.gv)-(b.dt-b.gv)).slice(0,3);
    if(neg.length)L.push(["red",neg.length+" sản phẩm bán lỗ ở mức giá vốn",neg.map(t=>esc(t.n)+" (lỗ gộp "+money(t.gv-t.dt)+" trên doanh thu "+money(t.dt)+")").join("; ")+". Đề xuất xem lại giá bán hoặc dừng bán lẻ mã này."]);
    const nogv=L2.filter(t=>!t.gv).slice(0,4);
    if(nogv.length)L.push(["amb",nogv.length+" sản phẩm chưa có giá vốn trong Sheet nên lãi bị thổi lên",nogv.map(t=>esc(t.n)).join(", ")+". Chị bổ sung giá vốn vào bảng NHAP_Gia_von để P&L đúng."]);
    const top=L2.filter(t=>t.gv).sort((a,b)=>(b.dt-b.gv)-(a.dt-a.gv))[0];
    if(top)L.push(["grn","Mã lãi gộp cao nhất: "+esc(top.n),"Lãi gộp "+money(top.dt-top.gv)+", biên "+fbdPct(top.dt-top.gv,top.dt,0)+". Ưu tiên ngân sách và nội dung cho mã này, tăng dần khoảng 20% mỗi ngày."])}
  if(!x.OP||!x.OP.has)L.push(["blu","Chi phí vận hành chưa nhập","Lợi nhuận trên đây chưa trừ lương, kho, mặt bằng, quản lý. Chị nhập ở tab Nhập chi phí, lợi nhuận tự tính lại."]);
  return L;
}
function pFbPL(m){
  adfLoad();fbsLoad();fbcLoad();adfMergeDays();
  const head=H("Facebook","Lãi lỗ (P&L) kênh Facebook · doanh thu từ Pancake, giá vốn và vận chuyển từ Sheet Pancake, quảng cáo từ Facebook Ads");
  const tabs=`<nav class="fbd-tabs">${[["pl","Lãi lỗ (P&L)"],["bh","Quảng cáo · Digital"],["sale","Team Sale"],["sp","Sản phẩm"],["nc","Nhập chi phí"]].map(([k,t])=>`<button type="button" data-fbdtab="${k}" class="${FBD.tab===k?"on":""}">${t}</button>`).join("")}</nav>`;
  const bind=()=>{m.querySelectorAll("[data-fbdtab]").forEach(b=>b.onclick=()=>{FBD.tab=b.dataset.fbdtab;renderMain()});fbdBindMet(m)};
  const all=fbdRange(PERIOD.from,PERIOD.to),lastK=all.filter(k=>(DAYD.fb||{})[k]).pop()||PERIOD.to,days=all.filter(k=>k<=lastK),A=fbdAgg(days),len=days.length;
  const meta=`<div class="fbd-meta"><span class="pill p-blu">${esc(pLabel())}</span><span>${A.n}/${len} ngày có số${len<all.length?" (kỳ chọn còn "+(all.length-len)+" ngày chưa tới)":""}</span></div>`;
  if(FBD.tab==="bh"){const t=document.createElement("div");pFbdash(t,true);const body=t.innerHTML.replace(/^<div class="ph">[\s\S]*?<\/div><\/div>/,"");m.innerHTML=head+tabs+meta+body;bind();return}
  if(FBD.tab==="sale"){m.innerHTML=head+tabs+meta+fbdSaleView();bind();return}
  if(FBD.tab==="nc"){fbdRenderNc(m,head,tabs);bind();return}
  const C=fbdCost(days),pdays=days.map(fbdShiftMonth),Cp=fbdCost(pdays);
  if(FBD.tab==="sp"){const N=KDX.fbNhom||[];
    const nhom=N.length?`<section class="fbd-card fbd-wide"><h3>Theo nhóm sản phẩm · tháng 9 (Sheet Pancake)</h3>${tbl(["Nhóm hàng","Số đơn","Số lượng","Doanh thu","Giá vốn","Biên gộp"],N.map(x=>`<tr><td><b>${esc(x.n)}</b></td><td class="n">${nf(x.don)}</td><td class="n">${nf(x.sl)}</td><td class="n">${tr(x.dt)}</td><td class="n">${tr(x.gv)}</td><td class="n">${x.dt?pill(Math.round((x.dt-x.gv)/x.dt*100)+"%",(x.dt-x.gv)/x.dt>.6?"grn":"amb"):"—"}</td></tr>`))}</section>`:"";
    m.innerHTML=head+tabs+meta+`<div class="fbd-grid">${fbdProdCard(days)||'<section class="fbd-card fbd-wide"><p class="empty">Kỳ này chưa có số theo sản phẩm.</p></section>'}${nhom}</div>`;bind();return}
  if(!C.n){m.innerHTML=head+tabs+meta+`<section class="fbd-card"><p class="empty">Kỳ này chưa có giá vốn và chi phí vận chuyển thật nên chưa dựng được P&L. Số thật có từ 01/08 đến 21/10; chọn kỳ trong khoảng đó.</p></section>`;bind();return}
  const OP=fbdOpex(days),OPp=fbdOpex(pdays),tot=fbdCostTot(C,A.hasQc)+OP.amt,prof=C.dt-tot,margin=C.dt?prof/C.dt*100:0,totP=fbdCostTot(Cp,true)+OPp.amt,profP=Cp.dt-totP;
  const items=[{n:"Giá vốn hàng bán",v:C.gv,c:"#7048e8"},{n:"Chi phí vận chuyển",v:C.ship,c:"#3b5bdb"},{n:"Ship đơn hoàn hai chiều",v:C.shipRet,c:"#0ca678"},{n:"Chi phí quảng cáo (gồm thuế)",v:A.hasQc?C.qcT:0,c:"#f59f00"}].concat(OP.has?[{n:"Chi phí vận hành (phân bổ cho Facebook)",v:OP.amt,c:"#868e96"}]:[]);
  const cRow=x=>`<div class="fbd-cr"><span class="d" style="background:${x.c}"></span><span class="n">${x.n}</span><b>${money(x.v)}</b><em>${fbdPct(x.v,tot)} chi phí</em><em>${fbdPct(x.v,C.dt)} doanh thu</em></div>`;
  const hs=[["Tổng chi phí",money(tot),(Cp.n?fbdDelta(tot,totP,true):"")||"<span>chưa gồm chi phí vận hành</span>"],["Lợi nhuận",money(prof),(Cp.n&&profP>0?fbdDelta(prof,profP):"")||"<span>tạm tính, chưa trừ chi phí vận hành</span>"],["Biên lợi nhuận",fbdPct(prof,C.dt),`<span>mục tiêu ${FBD_TARGET.toLocaleString("vi-VN")}%${Cp.n&&Cp.dt?" · tháng trước "+fbdPct(profP,Cp.dt):""}</span>`]];
  const gopP=Cp.gop,dcP=Cp.gop-Cp.qcT,dc=C.gop-C.qcT,cell=(l,v,d,sub,col)=>`<div class="c" style="border-top-color:${col}"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d||""}${sub?`<span>${sub}</span>`:""}</div></div>`;
  const cpo=A.hasQc&&A.chot?A.qcT/A.chot:0,roas=A.qcT?A.dtChot/A.qcT:0,sp=days.map(k=>((FBC.raw.days||{})[k]||{g:[0,0]}).g[1]),pr=(a,b)=>b?fbdPct(a,b):"—",hasCp=Cp.n&&Cp.dt,dl=(c,p,r)=>hasCp?fbdDelta(c,p,r):"";
  const hm=([l,v,s2])=>`<div class="fbd-hm"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s2}</div></div>`;
  const hero=side=>fbdMetPanel("pl",[{l:"Tổng doanh thu",t:"m",n:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[1]},{l:"Tổng chi phí",t:"m",rev:true,n:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[2]+((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[3]+2*((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).h[1]+fbdQc(k)},{l:"Lãi gộp",t:"m",n:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[1]-((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[2]-((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[3]-2*((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).h[1]},{l:"Lãi đóng góp kênh",t:"m",n:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[1]-((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[2]-((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[3]-2*((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).h[1]-fbdQc(k)},{l:"Biên lãi gộp",t:"p",n:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[1]-((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[2]-((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[3]-2*((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).h[1],d:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[1]},{l:"Biên lãi đóng góp",t:"p",n:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[1]-((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[2]-((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[3]-2*((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).h[1]-fbdQc(k),d:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[1]},{l:"Giá vốn",t:"m",rev:true,n:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[2]},{l:"Chi phí vận chuyển",t:"m",rev:true,n:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[3]},{l:"Chi phí quảng cáo",t:"m",rev:true,n:fbdQc},{l:"Chi phí QC / doanh thu",t:"p",rev:true,warn:v=>v>.35,n:fbdQc,d:k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0],h:[0,0]}).g[1]}],days.filter(k=>((FBC.raw||{}).days||{})[k]),pdays.filter((k,i)=>((FBC.raw||{}).days||{})[days[i]]),"Lãi lỗ kênh Facebook",side);
  /* so sánh cùng kỳ tháng trước + mục tiêu tháng */
  const tg=(typeof execTargets==="function"?(execTargets().fb||0):0),oneMonth=PERIOD.from.slice(0,7)===PERIOD.to.slice(0,7),startsDay1=PERIOD.from.slice(8)==="01";
  const y=+PERIOD.from.slice(0,4),mo=+PERIOD.from.slice(5,7),mDays=new Date(y,mo,0).getDate(),fc=oneMonth&&startsDay1&&A.n?A.dtChot/A.n*mDays:0,pctT=tg?A.dtChot/tg*100:0;
  const cmpRows=[fbdCmp("Doanh thu giao thành công",C.dt,Cp.dt),fbdCmp("Giá vốn",C.gv,Cp.gv,true),fbdCmp("Chi phí vận chuyển (gồm ship hoàn)",C.ship+C.shipRet,Cp.ship+Cp.shipRet,true),fbdCmp("Chi phí quảng cáo (gồm thuế)",C.qcT,Cp.qcT,true),fbdCmp("Tổng chi phí",tot,totP,true),fbdCmp("Lợi nhuận (chưa trừ vận hành)",prof,profP),fbdCmp("Biên lợi nhuận",margin,Cp.dt?profP/Cp.dt*100:0,false,fbdPlPct)].join("");
  const bar=(v,c)=>`<div class="fbd-rb big"><i style="width:${Math.max(0,Math.min(100,v)).toFixed(1)}%;background:${c}"></i></div>`;
  const goal=`<div class="fbd-goal"><div class="l">Mục tiêu doanh số Facebook tháng ${mo}/${y}</div>${tg?`<div class="v">${money(A.dtChot)} <small>/ ${money(tg)}</small></div>${bar(pctT,pctT>=100?"#087a55":"#e7357b")}<div class="s">đạt ${fbdPct(A.dtChot,tg)} mục tiêu (doanh thu đơn chốt)${fc?`; theo đà hiện tại cuối tháng khoảng <b>${money(fc)}</b> (${fbdPct(fc,tg,0)} mục tiêu)`:""}</div>`:`<div class="s">Chưa đặt mục tiêu doanh số Facebook. Chị đặt ở trang Tổng quan, mục "Mục tiêu doanh số theo tháng", em sẽ so sánh tại đây.</div>`}<div class="l" style="margin-top:12px">Biên lợi nhuận so với mục tiêu ${FBD_TARGET.toLocaleString("vi-VN")}%</div>${bar(margin/FBD_TARGET*100,margin>=FBD_TARGET?"#087a55":"#f59f00")}<div class="s">hiện ${fbdPct(prof,C.dt)} (chưa trừ chi phí vận hành)</div></div>`;
  /* Dự kiến khi các đơn đang giao có kết quả: chỉ hiện với kỳ còn đơn mới (14 ngày cuối của số liệu). Tháng đã đóng, tiền về hết thì số thật là số chuẩn. */
  const dataLast=Object.keys(DAYD.fb||{}).sort().pop()||lastK,matureEnd=iso(addD(pdate(dataLast),-14)),young=days.some(k=>k>matureEnd);
  let fcCard="";
  if(young&&C.fRev>0){const RET=FBD_RET_FC,add=C.fRev*(1-RET),dtF=C.dt+add,rate=C.dt?C.ship/C.dt:0,shipRetF=C.dt?C.shipRet*dtF/C.dt:0,costF=C.gv+C.fGv*(1-RET)+C.ship+rate*add+shipRetF+(A.hasQc?C.qcT:0)+OP.amt,profF=dtF-costF;
    fcCard=`<section class="fbd-card fbd-wide"><h3>Dự kiến khi các đơn đang giao có kết quả</h3><div class="fbd-fc">${[["Doanh thu dự kiến",money(dtF),"số thật "+money(C.dt)],["Tổng chi phí dự kiến",money(costF),"số thật "+money(tot)],["Lợi nhuận dự kiến",money(profF),OP.has?"đã trừ chi phí vận hành":"chưa trừ chi phí vận hành"],["Biên lợi nhuận dự kiến",fbdPct(profF,dtF),"số thật "+fbdPct(prof,C.dt)]].map(([l,v,s2])=>`<div><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s2}</div></div>`).join("")}</div><p class="fbd-note">Cách tính: doanh thu dự kiến = đơn đã giao thành công ${money(C.dt)} + (đơn đang vận chuyển và chưa giao ${money(C.fRev)}, ${nf(C.fN)} đơn) × (1 − ${Math.round(RET*100)}% hoàn dự kiến) = ${money(dtF)}. Giá vốn và phí vận chuyển của các đơn này tính theo giá vốn thật từng đơn và tỷ lệ phí hiện tại; chi phí quảng cáo giữ nguyên. Chỉ là ước tính; số chuẩn là số thật khi tiền đã về hết (khoảng 10 ngày sau khi hết tháng).</p></section>`}
  const cmp=`<section class="fbd-card fbd-wide"><h3>So sánh cùng kỳ tháng trước và mục tiêu tháng</h3><div class="fbd-cmpgrid"><div>${tbl(["Chỉ tiêu","Kỳ này","Cùng kỳ tháng trước","Chênh"],[cmpRows])}<p class="fbd-note">Kỳ này ${fbdVN(days[0])}–${fbdVN(days[days.length-1])}${Cp.n?`, tháng trước ${fbdVN(pdays[0])}–${fbdVN(pdays[pdays.length-1])} (${Cp.n} ngày có số)`:", chưa có số tháng trước để so"}. Mũi tên xanh là tốt: chi phí giảm, doanh thu và lợi nhuận tăng.</p></div>${goal}</div></section>`;
  const adv=fbdAdvice({C,Cp,A,prof,days,OP}).map(([lv,t,a],i)=>`<details class="fbd-adv ${lv}"${i<2?" open":""}><summary>${t}</summary><span>${a}</span></details>`).join("");
  const advCard=`<section class="fbd-card"><h3>Cảnh báo và đề xuất</h3><div class="fbd-advs">${adv}</div></section>`;
  const cost=`<section class="fbd-card fbd-c2"><h3>Cơ cấu chi phí</h3><div class="fbd-cost">${fbdDonut(items,tot,money(tot))}<div class="fbd-cl"><div class="fbd-cr fbd-ch0"><span></span><span>Khoản chi phí</span><b>Số tiền</b><em>% chi phí</em><em>% doanh thu</em></div>${items.map(cRow).join("")}${OP.has?"":'<div class="fbd-cr"><span class="d" style="background:#ced4da"></span><span class="n">Chi phí vận hành <small>lương, kho, mặt bằng, quản lý</small></span><span class="fbd-todo">chưa nhập</span></div>'}</div></div></section>`;
  const TODO='<span class="fbd-todo">chưa nhập</span>';
  const bridge=`<section class="fbd-card fbd-wide"><h3>Từ doanh thu đến lợi nhuận</h3>${fbdRow("Doanh thu đơn giao thành công",money(C.dt),100,"#3b5bdb")}${fbdRow("− Giá vốn hàng bán",money(C.gv),C.dt?C.gv/C.dt*100:0,"#adb5bd",fbdPct(C.gv,C.dt))}${fbdRow("− Chi phí vận chuyển",money(C.ship),C.dt?C.ship/C.dt*100:0,"#adb5bd",fbdPct(C.ship,C.dt))}${fbdRow("− Ship đơn hoàn hai chiều",money(C.shipRet),C.dt?C.shipRet/C.dt*100:0,"#adb5bd",fbdPct(C.shipRet,C.dt))}${fbdRow("= Lãi gộp",money(C.gop),C.dt?Math.max(0,C.gop/C.dt*100):0,"#087a55",fbdPct(C.gop,C.dt))}${fbdRow("− Chi phí quảng cáo sau thuế",money(C.qcT),C.dt?C.qcT/C.dt*100:0,"#f59f00",fbdPct(C.qcT,C.dt))}${fbdRow("= Lãi đóng góp kênh",money(C.gop-C.qcT),C.dt?Math.max(0,(C.gop-C.qcT)/C.dt*100):0,C.gop-C.qcT>=0?"#0b7285":"#e03131",fbdPct(C.gop-C.qcT,C.dt))}${fbdRow("− Chi phí vận hành",TODO,0,"#ced4da")}${fbdRow("= Lợi nhuận tạm tính",money(prof),C.dt?Math.max(0,prof/C.dt*100):0,prof>=0?"#087a55":"#e03131",fbdPct(prof,C.dt))}</section>`;
  const cdays=days.filter(k=>((FBC.raw||{}).days||{})[k]),cDt=k=>((FBC.raw.days||{})[k]||{g:[0,0,0,0]}).g[1],cCost=k=>{const d=(FBC.raw.days||{})[k];return d?d.g[2]+d.g[3]+2*d.h[1]+fbdQc(k):0};
  const chart=`<section class="fbd-card fbd-wide"><h3>Doanh thu và tổng chi phí theo ngày</h3>${fbdChart(cdays,cDt,cCost,"Doanh thu giao thành công","Tổng chi phí (giá vốn, vận chuyển, quảng cáo)")}</section>`;
  const top=fbdTopBars(days,8);
  m.innerHTML=head+tabs+meta+hero(fcCard)+`<div class="fbd-split"><div class="fbd-grid two">${cost}${top}${cmp}</div><aside class="fbd-side">${advCard}</aside></div><p class="fbd-note">P&L tính cho ${C.n} ngày có số trong Sheet Pancake (đến ${fbdVN(C.last)}): doanh thu giao thành công, giá vốn và phí vận chuyển lấy theo từng đơn; chi phí quảng cáo lấy từ Facebook Ads cộng thuế 10% cho đúng các ngày đó. Đơn mới tạo chưa kịp giao nên các ngày gần đây doanh thu còn thấp, làm lợi nhuận kỳ ngắn trông thấp hơn thực tế.</p>${srcNote("Pancake, Sheet Pancake (giá vốn, phí ship), Facebook Ads. Số liệu quản trị nội bộ.")}`;
  bind();
}
PAGES.bc_fb=m=>fbdFull()?pFbPL(m):pFbdash(m);

const FBD_PAL=["#e7357b","#3b5bdb","#087a55","#f59f00","#7048e8","#0ca678","#15aabf","#868e96"];
function fbdTopBars(days,n){
  const F=FBC.raw;if(!F||!F.p||!F.sk)return "";
  const m={};let nd=0;days.forEach(k=>{const r=F.p[k];if(!r)return;nd++;r.forEach(([i,q,dt,gv])=>{const t=m[i]||(m[i]={i,q:0,dt:0,gv:0});t.q+=q;t.dt+=dt*1000;t.gv+=gv*1000})});
  if(!nd)return "";
  const L=Object.values(m).map(x=>{const s2=F.sk[x.i]||["?","?",""];return Object.assign(x,{c:s2[0],n:s2[1],g:s2[2]||"chưa nhóm"})}).sort((a,b)=>b.dt-a.dt),T=sum(L,x=>x.dt),top=L.slice(0,n),mx=top[0]?top[0].dt:1;
  const rows=top.map((x,i)=>{const lg=x.dt-x.gv,b=x.dt?lg/x.dt*100:0;return `<div class="fbd-bl"><div class="n"><b>${esc(x.n)}</b><small>${nf(x.q)} sản phẩm · ${fbdPct(x.dt,T)} doanh thu</small></div><div class="bar"><i style="width:${(x.dt/mx*100).toFixed(1)}%;background:${FBD_PAL[i%FBD_PAL.length]}"></i></div><div class="v"><b>${money(x.dt)}</b><small>lãi gộp ${money(lg)} ${x.gv?pill(Math.round(b)+"%",b>=70?"grn":b>=40?"amb":"red"):'<span class="fbd-todo">chưa có giá vốn</span>'}</small></div></div>`}).join("");
  return `<section class="fbd-card fbd-wide"><h3>Top sản phẩm bán chạy · ${nd} ngày có số</h3><div class="fbd-bls">${rows}</div><div class="fbd-more"><button type="button" class="btn sm" data-fbdtab="sp">Xem đủ tất cả sản phẩm →</button></div></section>`;
}

/* Chi phí vận hành nhập tay (D().fbOpex[tháng] = [{n, amt, pct}]): amt là số cả công ty trong tháng, pct là phần phân bổ cho Facebook. Phân bổ theo số ngày của kỳ nằm trong tháng. */
const FBD_OPEX_DEFAULT=["Lương nhân sự văn phòng","Lương sản xuất và kho vận","Mặt bằng, nhà máy","Quản lý và chi phí chung khác"];
function fbdOpex(days){
  const O=(typeof D==="function"&&D().fbOpex)||{},byM={};let amt=0,has=false;
  days.forEach(k=>{const m=k.slice(0,7);byM[m]=(byM[m]||0)+1});
  Object.entries(byM).forEach(([m,n])=>{const L=O[m];if(!L||!L.length)return;const full=sum(L,x=>(+x.amt||0)*(+x.pct||0)/100);if(full>0){has=true;amt+=full*n/new Date(+m.slice(0,4),+m.slice(5,7),0).getDate()}});
  return {amt,has};
}
function fbdRenderNc(m,head,tabs){
  const now=new Date(),cur=PERIOD.from.slice(0,7),opts=[];
  for(let i=0;i<8;i++){const d=new Date(now.getFullYear(),now.getMonth()-i,1);opts.push(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"))}
  if(!opts.includes(cur))opts.unshift(cur);
  const month=FBD.ncMonth||cur,O=(D().fbOpex=D().fbOpex||{}),rows=(O[month]&&O[month].length)?O[month].map(x=>Object.assign({},x)):FBD_OPEX_DEFAULT.map(n=>({n,amt:0,pct:0})),tg=(typeof execTargets==="function"?execTargets():{}).fb||0;
  const fbCost=sum(rows,x=>(+x.amt||0)*(+x.pct||0)/100),all=sum(rows,x=>+x.amt||0);
  const line=(x,i)=>`<tr><td><input data-nc="n" data-i="${i}" value="${esc(x.n)}"></td><td class="n"><input type="number" min="0" data-nc="amt" data-i="${i}" value="${+x.amt||0}"></td><td class="n"><input type="number" min="0" max="100" step="0.1" data-nc="pct" data-i="${i}" value="${+x.pct||0}"></td><td class="n"><b>${money((+x.amt||0)*(+x.pct||0)/100)}</b></td></tr>`;
  m.innerHTML=head+tabs+`<section class="fbd-card fbd-wide"><h3>Chi phí vận hành tháng <select id="nc-m" class="fbd-sel">${opts.map(o=>`<option value="${o}"${o===month?" selected":""}>${o.slice(5)}/${o.slice(0,4)}</option>`).join("")}</select></h3><p class="fbd-note">Nhập số cả công ty trong tháng cho từng khoản, rồi % phân bổ cho kênh Facebook. Trang Lãi lỗ tự trừ phần phân bổ vào lợi nhuận, theo số ngày của kỳ chọn. Để 0 nếu chưa có.</p><div class="tbl"><table><thead><tr><th>Khoản</th><th class="n">Số tiền cả công ty (đ/tháng)</th><th class="n">% phân bổ cho Facebook</th><th class="n">Phân bổ cho Facebook</th></tr></thead><tbody>${rows.map(line).join("")}</tbody><tfoot><tr class="tot"><td>Tổng</td><td class="n">${money(all)}</td><td class="n">${all?fbdPct(fbCost,all):"—"}</td><td class="n">${money(fbCost)}</td></tr></tfoot></table></div><div class="acts"><button type="button" class="btn sm" id="nc-add">+ Thêm khoản</button><button type="button" class="btn pri" id="nc-save">Lưu chi phí vận hành</button></div></section>
  <section class="fbd-card fbd-wide"><h3>Mục tiêu doanh số Facebook (đ/tháng)</h3><div class="acts"><input type="number" min="0" id="nc-tg" value="${tg}" style="max-width:240px"><button type="button" class="btn pri" id="nc-tgs">Lưu mục tiêu</button></div><p class="fbd-note">Để 0 nếu chưa đặt. Trang Lãi lỗ so doanh thu đơn chốt với con số này và dự báo cuối tháng. Mục tiêu này dùng chung với mục "Sửa mục tiêu" ở trang Tổng quan.</p></section>`;
  const collect=()=>{const R=[];m.querySelectorAll("[data-nc][data-i]").forEach(el=>{const i=+el.dataset.i;R[i]=R[i]||{n:"",amt:0,pct:0};const k=el.dataset.nc;R[i][k]=k==="n"?el.value.trim():(+el.value||0)});return R.filter(x=>x&&(x.n||x.amt))};
  const save=(R,msg)=>{DB.mutate(ME.name,msg+" tháng "+month,dt=>{dt.fbOpex=dt.fbOpex||{};dt.fbOpex[month]=R});renderMain()};
  m.querySelector("#nc-m").onchange=e=>{FBD.ncMonth=e.target.value;renderMain()};
  m.querySelector("#nc-add").onclick=()=>{const R=collect();R.push({n:"Khoản mới",amt:0,pct:0});save(R,"thêm khoản chi phí vận hành")};
  m.querySelector("#nc-save").onclick=()=>save(collect(),"nhập chi phí vận hành");
  m.querySelector("#nc-tgs").onclick=()=>{const v=+m.querySelector("#nc-tg").value||0;DB.mutate(ME.name,"đặt mục tiêu doanh số Facebook",dt=>{if(typeof execTargets==="function")execTargets();dt.targets=dt.targets||{};dt.targets.fb=v});renderMain()};
}

/* ---- Tab / trang Team Sale kiểu Pancake: hàng chỉ số chọn được, biểu đồ theo ngày, bảng xếp hạng dày ---- */
function fbdSaleView(){
  adfLoad();fbsLoad();adfMergeDays();
  const all=fbdRange(PERIOD.from,PERIOD.to),R=FBS.raw&&FBS.raw.days;
  if(!R)return `<section class="pc-card"><p class="empty">Đang tải số bán hàng theo người từ Pancake…</p></section>`;
  const lastK=all.filter(k=>R[k]).pop(),days=lastK?all.filter(k=>k<=lastK):[];
  if(!days.length)return `<section class="pc-card"><p class="empty">Kỳ đã chọn chưa có số bán hàng theo người. Số có từ 30/09/2026.</p></section>`;
  const len=days.length,pf=iso(addD(pdate(PERIOD.from),-len)),pt=iso(addD(pdate(PERIOD.from),-1)),pall=fbdRange(pf,pt),havePrev=pall.filter(k=>R[k]).length>=len*.8,pdays=havePrev?pall:[];
  const rows=k=>R[k]||[],S=(k,f)=>sum(rows(k),f),tao=k=>S(k,r=>r.tao),huy=k=>S(k,r=>r.huy),chot=k=>tao(k)-huy(k),dt=k=>S(k,r=>r.dt-(r.hoanDt||0));
  const giao=k=>S(k,r=>r.giao),hoan=k=>S(k,r=>r.hoan),hoanDt=k=>S(k,r=>r.hoanDt||0);
  const defs=[{l:"Doanh thu ghi nhận",t:"m",n:dt},{l:"Đơn tạo",t:"n",n:tao},{l:"Đơn chốt",t:"n",n:chot},{l:"Đơn giao thành công",t:"n",n:giao},{l:"Tỷ lệ chốt",t:"p",n:chot,d:tao},{l:"Tỷ lệ hủy",t:"p",rev:true,warn:v=>v>.2,n:huy,d:tao},{l:"Tỷ lệ hoàn",t:"p",rev:true,warn:v=>v>.09,n:hoan,d:k=>giao(k)+hoan(k)},{l:"Giá trị TB / đơn chốt",t:"d",n:dt,d:chot},{l:"Doanh thu hoàn",t:"m",rev:true,n:hoanDt}];
  const panel=fbdMetPanel("sale",defs,days,pdays,"Bán hàng theo người xử lý đơn","",true);
  const P=fbsPeople(days),Pp=havePrev?fbsPeople(pdays):null,pm={};(Pp?Pp.list:[]).forEach(x=>pm[x.n]=x);
  const fold=t=>String(t).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").toLowerCase().trim(),isK=x=>FBS_KPI.some(n=>fold(n)===fold(x.n));
  const add=(L,n)=>Object.assign(L.reduce((a,x)=>({tao:a.tao+x.tao,huy:a.huy+x.huy,hoan:a.hoan+x.hoan,giao:a.giao+x.giao,dt:a.dt+x.dt,hd:a.hd+(x.hd||0)}),{tao:0,huy:0,hoan:0,giao:0,dt:0,hd:0}),{n});
  const rate=(a,b)=>b?fbdPct(a,b):"—",maxDt=Math.max(1,...P.list.map(x=>x.dt));
  /* Đánh giá từng người theo ngưỡng đã chốt: hủy trên 20%, hoàn trên 9%; dưới 20 đơn tạo thì chưa đủ để đánh giá */
  const grade=x=>{if(x.n==="(chưa gán)")return ["amb","Chưa gán người","gán người xử lý để tính đúng"];if(x.tao<20)return ["gry","Ít đơn","chưa đủ để đánh giá"];
    const h=x.huy/x.tao,fin=x.giao+x.hoan,r=fin?x.hoan/fin:0,bad=[];if(h>.2)bad.push("hủy "+rate(x.huy,x.tao));if(r>.09)bad.push("hoàn "+rate(x.hoan,fin));
    if(!bad.length)return ["grn","Tốt","hủy "+rate(x.huy,x.tao)+" · hoàn "+rate(x.hoan,fin)];
    const sev=bad.length>1||h>.3;return [sev?"red":"amb",sev?"Cần xử lý":"Cần cải thiện",bad.join(" · ")+" vượt ngưỡng"]};
  const tdr=(v,c,p,rev,cls)=>'<td class="n"><div class="pv'+(cls?" "+cls:"")+'">'+v+"</div></td>";/* chỉ cột doanh thu mới so kỳ trước, các cột khác để gọn */
  const rk=(x,i,q)=>{q=q||pm[x.n]||{};const ch=x.tao-x.huy,qc=(q.tao||0)-(q.huy||0),tot=i<0,g=tot?null:grade(x),fin=x.giao+x.hoan,qfin=(q.giao||0)+(q.hoan||0),hr=x.tao?x.huy/x.tao:0,rr=fin?x.hoan/fin:0;
    return `<tr${i===-1?' class="pc-tot"':""}><td>${tot?"":'<span class="pc-rk r'+(i<3?i+1:0)+'">'+(i+1)+"</span>"}</td><td><b>${esc(x.n)}</b></td><td class="n"><div class="pv">${money(x.dt)}</div><div class="pd">${q.dt?fbdDelta(x.dt,q.dt):"&nbsp;"}</div>${tot?"":'<div class="pc-bar"><i style="width:'+(x.dt/maxDt*100).toFixed(1)+'%"></i></div>'}</td>${tdr(nf(x.tao),x.tao,q.tao)}${tdr(nf(ch),ch,qc)}${tdr(nf(x.giao),x.giao,q.giao)}${tdr(nf(x.hoan),x.hoan,q.hoan,true,"")}${tdr(nf(x.huy),x.huy,q.huy,true,"")}${tdr(rate(ch,x.tao),x.tao?ch/x.tao:0,q.tao?qc/q.tao:0)}${tdr(rate(x.huy,x.tao),hr,q.tao?q.huy/q.tao:0,true,!tot&&x.tao>=20&&hr>.2?"neg":"")}${tdr(rate(x.hoan,fin),rr,qfin?(q.hoan||0)/qfin:0,true,!tot&&fin>=20&&rr>.09?"neg":"")}<td>${g?'<span class="pc-gr '+g[0]+'">'+g[1]+"</span><small>"+g[2]+"</small>":""}</td></tr>`};
  const grp=t=>`<tr class="pc-grp"><td colspan="12">${t}</td></tr>`,byDt=L=>L.slice().sort((a,b)=>b.dt-a.dt);
  let table="";
  if(P){const K=byDt(P.list.filter(isK)),O=byDt(P.list.filter(x=>!isK(x))),T=add(P.list,"Tổng tất cả"),Kt=add(K,"Cộng nhóm tính KPI"),Pk=Pp?add(Pp.list.filter(isK),""):{},Pt=Pp?add(Pp.list,""):{},Ot=add(O,"Khác (quản lý, hỗ trợ, chưa gán người)"),Pq=Pp?add(Pp.list.filter(x=>!isK(x)),""):{};
    const rank=`<section class="pc-card"><div class="pc-h"><b>Bảng xếp hạng sale</b><span>${esc(pLabel())} · ${P.n} ngày có số${havePrev?" · mũi tên so với "+fbdVN2(pdays[0])+"–"+fbdVN2(pdays[pdays.length-1]):""} · xếp theo doanh thu</span></div><div class="pc-tw"><table class="pc-t pc-rank"><thead><tr><th>Hạng</th><th>Người xử lý đơn</th><th class="n">Doanh thu</th><th class="n">Đơn tạo</th><th class="n">Chốt</th><th class="n">Giao TC</th><th class="n">Hoàn</th><th class="n">Hủy</th><th class="n">Tỷ lệ chốt</th><th class="n">Tỷ lệ hủy</th><th class="n">Tỷ lệ hoàn</th><th>Đánh giá</th></tr></thead><tbody>${[grp("Nhóm tính KPI")].concat(K.map((x,i)=>rk(x,i)),O.length?[rk(Ot,-2,Pq)]:[],[rk(T,-1,Pt)]).join("")}</tbody></table></div></section>`;
    const qrows=P.list.map(x=>{const ch=x.tao-x.huy;return `<tr><td><b>${esc(x.n)}</b></td>${tdr(nf(ch))}${tdr(ch?nf(Math.round(x.dt/ch))+"đ":"—")}${tdr(nf(x.giao))}${tdr(x.giao?nf(Math.round(x.dt/x.giao))+"đ":"—")}</tr>`}).join("");
    const quality=`<section class="pc-card"><div class="pc-h"><b>Chất lượng đơn theo người</b><span>giá trị trung bình mỗi đơn</span></div><div class="pc-tw"><table class="pc-t"><thead><tr><th>Người</th><th class="n">Đơn chốt</th><th class="n">TB / đơn chốt</th><th class="n">Giao TC</th><th class="n">TB / đơn giao</th></tr></thead><tbody>${qrows}</tbody></table></div></section>`;
    const lrows=P.list.map(x=>{const fin=x.giao+x.hoan;return `<tr><td><b>${esc(x.n)}</b></td>${tdr(nf(x.hoan))}${tdr(money(x.hd||0))}${tdr(rate(x.hoan,fin))}${tdr(x.dt+(x.hd||0)?fbdPct(x.hd||0,x.dt+(x.hd||0)):"—")}</tr>`}).join("");
    const loss=`<section class="pc-card"><div class="pc-h"><b>Thất thoát theo người</b><span>chỉ tính đơn hoàn, đơn hủy chưa mất hàng</span></div><div class="pc-tw"><table class="pc-t"><thead><tr><th>Người</th><th class="n">Đơn hoàn</th><th class="n">Doanh thu hoàn</th><th class="n">Tỷ lệ hoàn</th><th class="n">% doanh thu bị hoàn</th></tr></thead><tbody>${lrows}</tbody></table></div></section>`;
    const W2=[];P.list.forEach(x=>{const ch=x.tao-x.huy,fin=x.giao+x.hoan;if(x.n==="(chưa gán)"){if(x.tao)W2.push(["amb",x.n,nf(x.tao)+" đơn chưa gán người xử lý: gán người để tính doanh thu và hủy đúng."]);return}
      if(x.tao>=20&&x.huy/x.tao>.2)W2.push(["red",x.n,"Tỷ lệ hủy "+rate(x.huy,x.tao)+" (ngưỡng 20%): chốt ẩu hoặc kịch bản yếu. "+nf(x.tao)+" đơn tạo, chốt "+nf(ch)+", hủy "+nf(x.huy)+", hoàn "+nf(x.hoan)+"."]);
      if(fin>=20&&x.hoan/fin>.09)W2.push(["amb",x.n,"Tỷ lệ hoàn "+rate(x.hoan,fin)+" (ngưỡng 9%): "+nf(x.hoan)+" đơn hoàn, mất khoảng "+money(x.hd||0)+" doanh thu và phí ship hai chiều. Xem lý do hoàn."])});
    const warn=`<section class="pc-card"><div class="pc-h"><b>Cảnh báo và việc cần làm</b><span>ngưỡng hủy 20%, hoàn 9%</span></div><div class="pc-wl">${W2.length?W2.map(([c,n,t])=>`<div><i class="${c}"></i><b>${esc(n)}</b><span>${t}</span></div>`).join(""):'<div><i class="grn"></i><span>Không có người nào vượt ngưỡng.</span></div>'}</div></section>`;
    table=rank+'<div class="pc-2">'+quality+loss+"</div>"+warn+`<p class="fbd-note">Doanh thu = đơn đã xác nhận, đã trừ đơn hoàn và đơn hủy, xếp theo ngày tạo đơn. Người xử lý là người bán hàng gắn trên đơn Pancake. Người tính KPI: ${FBS_KPI.join(", ")}. Đơn hoàn tính theo ngày hoàn nên có thể nằm khác ngày với đơn gốc. Chưa có: số sản phẩm mỗi đơn và bảng người × nhóm sản phẩm (Sheet có, web cần kéo thêm từ Pancake).${havePrev?"":" Kỳ trước chưa có số theo người nên chưa so sánh."}</p>`}
  return panel+table;
}
PAGES.fb_sale=m=>{m.innerHTML=H("Hoạt động Sale Kênh bán lẻ","Facebook · người xử lý đơn trên Pancake (Sale + CSKH)")+fbdSaleView();fbdBindMet(m)};
