/* =====================================================================
   TRANG FACEBOOK · DOANH THU — dạng bảng điều khiển (học từ tab DASHBOARD_CHUNG của Sheet Pancake)
   Bản vận hành (HOST_MODE !== "admin"): chỉ hiện doanh thu, đơn, chi phí quảng cáo và phí vận chuyển.
   Trang quản trị (HOST_MODE === "admin"): hiện đủ giá vốn, phí hoàn, lãi gộp, lãi đóng góp kênh.
   Số lấy theo kỳ chọn ở thanh trên: Sheet Pancake đến 29/9, từ 30/9 dựng từ số tự động (adfMergeDays trong adsday.js).
   ===================================================================== */
const FBD_SHIP=0.096,FBD_SHIP_RET=29900,FBD_TARGET=18.5;
const fbdFull=()=>typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
const fbdRange=(a,b)=>{const o=[];for(let d=pdate(a);iso(d)<=b&&o.length<800;d=addD(d,1))o.push(iso(d));return o};
const fbdPct=(a,b,dg=1)=>b?(a/b*100).toLocaleString("vi-VN",{maximumFractionDigits:dg})+"%":"—";
function fbdAgg(days){
  const a={tao:0,chot:0,huy:0,hoan:0,giao:0,dtGiao:0,dtChot:0,gv:0,qc:0,n:0,hasQc:false};
  days.forEach(k=>{const r=(DAYD.fb||{})[k];if(r){a.n++;a.tao+=r[0]||0;a.chot+=r[1]||0;a.huy+=r[2]||0;a.hoan+=r[3]||0;a.giao+=r[4]||0;a.dtGiao+=r[5]||0;a.dtChot+=r[6]||0;a.gv+=r[7]||0}
    for(const o in DAYD.ads||{}){const x=DAYD.ads[o][k];if(x){a.qc+=+x[0]||0;a.hasQc=true}}});
  a.qcT=a.qc*(1+FB_ADS_TAX);return a;
}
const fbdSeries=(days,f)=>days.map(k=>f(k));
const fbdDay=k=>{const r=(DAYD.fb||{})[k];return r?r[6]||0:0};
const fbdQc=k=>{let s=0;for(const o in DAYD.ads||{}){const x=DAYD.ads[o][k];if(x)s+=+x[0]||0}return s*(1+FB_ADS_TAX)};
function fbdSpark(v,w,h,col){
  const mx=Math.max(1,...v),n=v.length;if(n<2)return "";
  const pts=v.map((y,i)=>[i/(n-1)*w,h-2-y/mx*(h-6)]);
  return `<svg class="fbd-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polygon points="0,${h} ${pts.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ")} ${w},${h}" fill="${col}" opacity=".18"/><polyline points="${pts.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ")}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function fbdRing(p,col,txt){
  const r=26,C=2*Math.PI*r,d=Math.max(0,Math.min(100,p||0))/100*C;
  return `<svg class="fbd-ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" fill="none" stroke="#e9ecf3" stroke-width="7"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${d.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="36" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${txt}</text></svg>`;
}
const fbdDelta=(cur,prev,rev)=>{if(!prev||!cur&&!prev)return "";const d=(cur-prev)/prev*100,up=d>=0,good=rev?!up:up;return `<span class="fbd-dl ${good?"g":"r"}">${up?"▲":"▼"} ${Math.abs(d).toLocaleString("vi-VN",{maximumFractionDigits:1})}%</span>`};
/* Biểu đồ cột doanh thu + đường chi phí QC. Kỳ dài hơn 92 ngày thì gộp theo tháng. */
function fbdChart(days){
  const byM=days.length>92,groups=[];
  if(byM){const m={};days.forEach(k=>{const g=k.slice(0,7);(m[g]=m[g]||[]).push(k)});Object.keys(m).sort().forEach(g=>groups.push({l:g.slice(5)+"/"+g.slice(2,4),ks:m[g]}))}
  else days.forEach(k=>groups.push({l:k.slice(8)+"/"+k.slice(5,7),ks:[k]}));
  const dt=groups.map(g=>sum(g.ks,fbdDay)),qc=groups.map(g=>sum(g.ks,fbdQc)),hasQ=qc.some(x=>x>0);
  if(!dt.some(x=>x>0))return `<p class="empty">Kỳ này chưa có doanh thu theo ngày.</p>`;
  const W=760,Hh=150,pl=48,pr=10,pt=12,pb=26,iw=W-pl-pr,ih=Hh-pt-pb,mx0=Math.max(1,...dt,...qc),p10=Math.pow(10,Math.floor(Math.log10(mx0))),mx=Math.ceil(mx0/p10*2)/2*p10||mx0;
  const n=groups.length,bw=iw/n,x=i=>pl+i*bw+bw/2,y=v=>pt+ih-v/mx*ih;
  const grid=[0,.25,.5,.75,1].map(f=>`<line x1="${pl}" x2="${W-pr}" y1="${y(mx*f)}" y2="${y(mx*f)}" stroke="#e9ecf3"/><text x="${pl-6}" y="${y(mx*f)+4}" text-anchor="end" font-size="10" fill="#7a8397">${money(mx*f)}</text>`).join("");
  const bars=dt.map((v,i)=>`<rect x="${(x(i)-Math.max(1.5,bw*.62)/2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${Math.max(1.5,bw*.62).toFixed(1)}" height="${Math.max(0,pt+ih-y(v)).toFixed(1)}" rx="2" fill="url(#fbdg)"><title>${groups[i].l}: doanh thu ${money(v)}${hasQ?" · chi phí QC "+money(qc[i]):""}</title></rect>`).join("");
  const line=hasQ?`<polyline points="${qc.map((v,i)=>x(i).toFixed(1)+","+y(v).toFixed(1)).join(" ")}" fill="none" stroke="#f59f00" stroke-width="2.2" stroke-linejoin="round"/>`:"";
  const step=Math.max(1,Math.ceil(n/12)),lbl=groups.map((g,i)=>i%step===0?`<text x="${x(i).toFixed(1)}" y="${Hh-8}" text-anchor="middle" font-size="10" fill="#7a8397">${g.l}</text>`:"").join("");
  return `<svg class="fbd-chart" viewBox="0 0 ${W} ${Hh}"><defs><linearGradient id="fbdg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7357b"/><stop offset="1" stop-color="#f08ab3"/></linearGradient></defs>${grid}${bars}${line}${lbl}</svg><div class="fbd-leg"><i style="background:#e7357b"></i>Doanh thu chốt${hasQ?`<i style="background:#f59f00"></i>Chi phí QC sau thuế`:""}${byM?" · gộp theo tháng":""}</div>`;
}
const FBD_SRC={"Webcake Landing":["Trang bán hàng (Webcake)","#e7357b"],"Facebook":["Inbox Facebook","#3b5bdb"],"CSKH":["Chăm sóc khách hàng","#0ca678"]};
function fbdSources(days){
  const R=typeof ADF!=="undefined"&&ADF.raw&&ADF.raw.days;if(!R)return [];
  const m={};days.forEach(k=>((R[k]||{}).pos||[]).forEach(p=>{const s=p.source||"Nguồn khác",t=m[s]||(m[s]={s,o:0,rev:0,can:0});t.o+=p.orders||0;t.rev+=p.revenue||0;t.can+=p.canceled||0}));
  const pal=["#7048e8","#f59f00","#15aabf","#868e96"];let pi=0;
  return Object.values(m).sort((a,b)=>b.rev-a.rev).map(t=>({n:(FBD_SRC[t.s]||[t.s])[0],c:(FBD_SRC[t.s]||[0,pal[pi++%pal.length]])[1],o:t.o,rev:t.rev,can:t.can}));
}
function fbdRow(l,v,p,col,sub){return `<div class="fbd-row"><div class="fbd-rl">${l}${sub?`<small>${sub}</small>`:""}</div><div class="fbd-rb"><i style="width:${Math.max(0,Math.min(100,p||0)).toFixed(1)}%;background:${col}"></i></div><div class="fbd-rv">${v}</div></div>`}
function pFbdash(m){
  adfLoad();fbsLoad();fbcLoad();adfMergeDays();
  const all=fbdRange(PERIOD.from,PERIOD.to),lastK=all.filter(k=>(DAYD.fb||{})[k]).pop()||PERIOD.to,days=all.filter(k=>k<=lastK),A=fbdAgg(days),len=days.length;
  const pf=iso(addD(pdate(PERIOD.from),-len)),pt=iso(addD(pdate(PERIOD.from),-1)),P=fbdAgg(fbdRange(pf,pt)),full=fbdFull();
  const head=H("Facebook","Doanh thu kênh Facebook · số lấy từ Pancake và Facebook Ads");
  if(!A.n)return m.innerHTML=head+`<section class="card"><p class="empty">Kỳ đã chọn chưa có số Facebook.${typeof lastDataMonth==="function"&&lastDataMonth()?" Số có đến tháng "+lastDataMonth().slice(5)+"/"+lastDataMonth().slice(0,4)+".":""}</p></section>`;
  const est=(typeof ADF!=="undefined"&&ADF.mgEst)?days.some(k=>ADF.mgEst.has(k)):false;
  const dtSer=fbdSeries(days,fbdDay),aov=A.chot?A.dtChot/A.chot:0,aovP=P.chot?P.dtChot/P.chot:0,cpo=A.hasQc&&A.chot?A.qcT/A.chot:0,roas=A.qcT?A.dtChot/A.qcT:0;
  const C=fbdCost(days),ship=A.dtGiao*FBD_SHIP,shipRet=A.hoan*FBD_SHIP_RET,gv=A.gv;
  const gop=A.dtGiao-gv-ship-shipRet,after=gop-A.qcT,opex=0,profit=after-opex,gopPct=A.dtGiao?gop/A.dtGiao*100:0,ceil=gopPct-FBD_TARGET;
  const srcs=fbdSources(days),srcTot=sum(srcs,s=>s.rev);
  const upd=typeof ADF!=="undefined"&&ADF.raw&&ADF.raw.at?new Date(ADF.raw.at).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"}):"";
  const hero=`<section class="fbd-hero"><div class="fbd-h1"><div class="fbd-hl">Doanh thu chốt · ${esc(pLabel())}</div><div class="fbd-hv">${money(A.dtChot)}</div><div class="fbd-hs">${fbdDelta(A.dtChot,P.dtChot)||""}<span>${P.dtChot?"so với "+len+" ngày liền trước":""}</span></div>${fbdSpark(dtSer,260,54,"#ffffff")}</div>
    <div class="fbd-h2">${(full?[["Chi phí QC sau thuế",A.hasQc?money(A.qcT):"—",A.hasQc?`<span>${fbdPct(A.qcT,A.dtChot)} doanh thu chốt · số thật</span>`:"<span>chưa có số quảng cáo</span>"],["Lãi gộp",C.n?money(C.gop):"<span class=\"fbd-nc\">chưa tính được</span>",C.n?`<span>${fbdPct(C.gop,C.dt)} · giá vốn, vận chuyển thật</span>`:"<span>thiếu giá vốn, chi phí vận chuyển thật</span>"],["Lãi đóng góp kênh",C.n&&A.hasQc?money(C.gop-C.qcT):"<span class=\"fbd-nc\">chưa tính được</span>",C.n&&A.hasQc?`<span>${fbdPct(C.gop-C.qcT,C.dt)} · sau quảng cáo</span>`:"<span>thiếu số thật</span>"],["Lợi nhuận","<span class=\"fbd-nc\">chưa tính được</span>","<span>cần chi phí vận hành</span>"]]:[["Đơn chốt",nf(A.chot),fbdDelta(A.chot,P.chot)||`<span>trên ${nf(A.tao)} đơn tạo</span>`],["Giá trị TB / đơn",aov?nf(Math.round(aov))+"đ":"—",fbdDelta(aov,aovP)||"<span>doanh thu / đơn chốt</span>"],["Chi phí QC sau thuế",A.hasQc?money(A.qcT):"—",A.hasQc?`<span>${fbdPct(A.qcT,A.dtChot)} doanh thu chốt</span>`:"<span>chưa có số quảng cáo</span>"],["ROAS",A.hasQc&&roas?roas.toLocaleString("vi-VN",{maximumFractionDigits:2}):"—","<span>doanh thu chốt / chi phí QC</span>"]]).map(([l,v,s])=>`<div class="fbd-hm"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("")}</div></section>`;
  const tiles=`<div class="fbd-tiles">
    <div class="fbd-t"><div class="fbd-tr">${fbdRing(A.tao?A.chot/A.tao*100:0,"#087a55",A.tao?Math.round(A.chot/A.tao*100)+"%":"—")}<div><div class="l">Tỷ lệ chốt</div><div class="s">${nf(A.chot)} / ${nf(A.tao)} đơn</div></div></div></div>
    <div class="fbd-t"><div class="fbd-tr">${fbdRing(A.tao?A.huy/A.tao*100:0,A.tao&&A.huy/A.tao>.2?"#b42318":"#f59f00",A.tao?Math.round(A.huy/A.tao*100)+"%":"—")}<div><div class="l">Tỷ lệ hủy</div><div class="s">${nf(A.huy)} đơn hủy</div></div></div></div>
    <div class="fbd-t"><div class="fbd-tr">${fbdRing(A.giao+A.hoan?A.hoan/(A.giao+A.hoan)*100:0,"#6941c6",A.giao+A.hoan?Math.round(A.hoan/(A.giao+A.hoan)*100)+"%":"—")}<div><div class="l">Tỷ lệ hoàn${est?" (ước tính)":""}</div><div class="s">${nf(A.hoan)} đơn hoàn</div></div></div></div>
    <div class="fbd-t"><div class="fbd-tr">${fbdRing(A.dtChot&&A.hasQc?A.qcT/A.dtChot*100:0,"#e7357b",A.hasQc&&A.dtChot?Math.round(A.qcT/A.dtChot*100)+"%":"—")}<div><div class="l">Chi phí QC / doanh thu</div><div class="s">${A.hasQc&&A.chot?"CPO "+nf(Math.round(cpo))+"đ / đơn":"chưa có số QC"}</div></div></div></div></div>`;
  const funnel=`<section class="fbd-card"><h3>Phễu đơn hàng</h3>${fbdRow("Đơn tạo",nf(A.tao),100,"#3b5bdb")}${fbdRow("Đã chốt",nf(A.chot),A.tao?A.chot/A.tao*100:0,"#087a55",fbdPct(A.chot,A.tao))}${fbdRow("Giao thành công"+(est?"*":""),nf(A.giao),A.tao?A.giao/A.tao*100:0,"#0ca678",fbdPct(A.giao,A.tao))}${fbdRow("Đơn hủy",nf(A.huy),A.tao?A.huy/A.tao*100:0,"#e03131",fbdPct(A.huy,A.tao))}${fbdRow("Đơn hoàn"+(est?"*":""),nf(A.hoan),A.tao?A.hoan/A.tao*100:0,"#7048e8",fbdPct(A.hoan,A.tao))}${est?`<p class="fbd-note">* Một số ngày chưa có số đơn hoàn thật từ Pancake nên đơn hoàn và đơn giao xong là ước tính.</p>`:""}</section>`;
  const chart=`<section class="fbd-card fbd-c2"><h3>Doanh thu và chi phí quảng cáo theo ngày</h3>${fbdChart(days)}</section>`;
  const srcCard=srcs.length?`<section class="fbd-card"><h3>Doanh thu theo nguồn đơn</h3><div class="fbd-stack">${srcs.map(s=>`<i style="width:${srcTot?s.rev/srcTot*100:0}%;background:${s.c}" title="${esc(s.n)}"></i>`).join("")}</div>${srcs.map(s=>`<div class="fbd-sl"><span><i style="background:${s.c}"></i>${esc(s.n)}</span><b>${money(s.rev)}</b><em>${fbdPct(s.rev,srcTot)} · ${nf(s.o)} đơn · hủy ${fbdPct(s.can,s.o)}</em></div>`).join("")}<p class="fbd-note">Doanh thu theo nguồn tạo đơn trên Pancake, tính cả đơn chưa chốt.</p></section>`:"";
  const T0='<span class="fbd-todo">chưa có số</span>',NC0='<span class="fbd-nc">chưa tính được</span>',R0=(l,sub)=>fbdRow(l,T0,0,"#ced4da",sub);
  const lastC=C.last?C.last.slice(8)+"/"+C.last.slice(5,7):"";
  const cNote=C.n?`Tính cho ${C.n} ngày có số trong Sheet Pancake (đến ${lastC}): doanh thu giao thành công, giá vốn, phí vận chuyển lấy theo từng đơn; chi phí quảng cáo lấy đúng các ngày đó. Đơn mới tạo chưa kịp giao nên các ngày gần đây doanh thu còn thấp.`:"";
  const wf=full
    ?`<section class="fbd-card fbd-c2"><h3>Từ doanh thu đến lợi nhuận</h3>${C.n?fbdRow("Doanh thu đơn giao thành công",money(C.dt),100,"#3b5bdb","số thật theo đơn"):fbdRow("Doanh thu đơn giao thành công",money(A.dtGiao),100,"#3b5bdb","số thật từ Pancake")}${C.n?fbdRow("− Giá vốn hàng bán",money(C.gv),C.dt?C.gv/C.dt*100:0,"#adb5bd",fbdPct(C.gv,C.dt)+" · số thật"):R0("− Giá vốn hàng bán","chờ giá vốn thật theo sản phẩm")}${C.n?fbdRow("− Chi phí vận chuyển",money(C.ship),C.dt?C.ship/C.dt*100:0,"#adb5bd",fbdPct(C.ship,C.dt)+" · số thật"):R0("− Chi phí vận chuyển","chờ phí vận chuyển thật")}${C.n?fbdRow("− Ship đơn hoàn hai chiều",money(C.shipRet),C.dt?C.shipRet/C.dt*100:0,"#adb5bd",fbdPct(C.shipRet,C.dt)+" · số thật"):R0("− Ship đơn hoàn hai chiều","chờ phí vận chuyển thật")}${C.n?fbdRow("= Lãi gộp",money(C.gop),C.dt?Math.max(0,C.gop/C.dt*100):0,"#087a55",fbdPct(C.gop,C.dt)):fbdRow("= Lãi gộp",NC0,0,"#ced4da")}${fbdRow("− Chi phí quảng cáo sau thuế",A.hasQc?money(C.n?C.qcT:A.qcT):"—",(C.n?C.dt:A.dtGiao)?(C.n?C.qcT:A.qcT)/(C.n?C.dt:A.dtGiao)*100:0,"#f59f00",A.hasQc?fbdPct(C.n?C.qcT:A.qcT,C.n?C.dt:A.dtGiao)+" · số thật từ Facebook":"")}${C.n&&A.hasQc?fbdRow("= Lãi đóng góp kênh",money(C.gop-C.qcT),C.dt?Math.max(0,(C.gop-C.qcT)/C.dt*100):0,C.gop-C.qcT>=0?"#0b7285":"#e03131",fbdPct(C.gop-C.qcT,C.dt)):fbdRow("= Lãi đóng góp kênh",NC0,0,"#ced4da")}${fbdRow("− Chi phí vận hành",'<span class="fbd-todo">chưa nhập</span>',0,"#ced4da","lương, kho, mặt bằng, quản lý")}${fbdRow("= Lợi nhuận",NC0,0,"#ced4da","cần chi phí vận hành")}<p class="fbd-note">${cNote||"Chưa có giá vốn và chi phí vận chuyển thật cho kỳ này nên chưa tính lãi."}</p></section>`
    :`<section class="fbd-card fbd-c2"><h3>Doanh thu, vận chuyển và quảng cáo</h3>${C.n?fbdRow("Doanh thu đơn giao thành công",money(C.dt),100,"#3b5bdb","số thật theo đơn"):fbdRow("Doanh thu đơn giao thành công",money(A.dtGiao),100,"#3b5bdb","số thật từ Pancake")}${C.n?fbdRow("− Chi phí vận chuyển",money(C.ship),C.dt?C.ship/C.dt*100:0,"#adb5bd",fbdPct(C.ship,C.dt)+" · số thật"):R0("− Chi phí vận chuyển","chờ phí vận chuyển thật")}${fbdRow("− Chi phí quảng cáo sau thuế",A.hasQc?money(C.n?C.qcT:A.qcT):"—",(C.n?C.dt:A.dtGiao)?(C.n?C.qcT:A.qcT)/(C.n?C.dt:A.dtGiao)*100:0,"#f59f00",A.hasQc?fbdPct(C.n?C.qcT:A.qcT,C.n?C.dt:A.dtGiao)+" · số thật":"")}${C.n&&A.hasQc?fbdRow("= Còn lại sau vận chuyển và quảng cáo",money(C.dt-C.ship-C.qcT),C.dt?Math.max(0,(C.dt-C.ship-C.qcT)/C.dt*100):0,"#0b7285"):""}<p class="fbd-note">${cNote||"Chưa có chi phí vận chuyển thật cho kỳ này."} Giá vốn và các chi phí khác xem ở trang quản trị.</p></section>`;
  const al=[];
  if(A.tao&&A.huy/A.tao>.2)al.push(["red",`Tỷ lệ hủy ${fbdPct(A.huy,A.tao)} đang vượt ngưỡng 20%`]);
  if(!A.hasQc)al.push(["amb","Kỳ này chưa có số chi phí quảng cáo"]);
  if(A.dtChot&&P.dtChot&&A.dtChot<P.dtChot*.8)al.push(["amb",`Doanh thu thấp hơn kỳ trước ${Math.round((1-A.dtChot/P.dtChot)*100)}%`]);
  if(est)al.push(["blu","Có ngày dùng số tự động từ Pancake: đơn hoàn, đơn giao xong là ước tính"]);
  const alerts=al.length?`<div class="fbd-al">${al.map(([c,t])=>`<span class="fbd-ch ${c}">${c==="red"?"⚠":c==="amb"?"●":"ⓘ"} ${t}</span>`).join("")}</div>`:"";
  const Dd=KDX.fbDash||{},N=KDX.fbNhom||[];
  const nhom=N.length?`<section class="fbd-card fbd-wide"><h3>Theo nhóm sản phẩm · tháng 9</h3>${tbl(full?["Nhóm hàng","Số đơn","Số lượng","Doanh thu","Giá vốn","Biên gộp"]:["Nhóm hàng","Số đơn","Số lượng","Doanh thu"],N.map(x=>`<tr><td><b>${esc(x.n)}</b></td><td class="n">${nf(x.don)}</td><td class="n">${nf(x.sl)}</td><td class="n">${tr(x.dt)}</td>${full?`<td class="n">${tr(x.gv)}</td><td class="n">${x.dt?pill(Math.round((x.dt-x.gv)/x.dt*100)+"%",(x.dt-x.gv)/x.dt>.6?"grn":"amb"):"—"}</td>`:""}</tr>`))}</section>`:"";
  const pl=full&&Dd.dt?`<section class="fbd-card fbd-wide"><h3>Lãi đóng góp kênh · kỳ ${esc(Dd.ky||"")} (Sheet Pancake)</h3>${tbl(["Khoản","Số tiền","% doanh thu"],[["Doanh thu ghi nhận",Dd.dt],["− Giá vốn hàng bán",Dd.gv],["− Phí vận chuyển",Dd.vc],["− Ship đơn hoàn (2 chiều)",Dd.hoan],["= Lãi gộp",Dd.laigop]].map(([l,v])=>`<tr class="${l.startsWith("=")?"tot":""}"><td>${l}</td><td class="n">${nf(v)}</td><td class="n">${Dd.dt?Math.abs(v/Dd.dt*100).toFixed(1)+"%":"—"}</td></tr>`))}</section>`:"";
  m.innerHTML=head+`<div class="fbd-meta"><span class="pill p-blu">${esc(pLabel())}</span><span>${A.n}/${len} ngày có số${len<all.length?" (kỳ chọn còn "+(all.length-len)+" ngày chưa tới)":""}</span>${upd?`<span>số tự động cập nhật ${upd}</span>`:""}</div>${hero}${alerts}${tiles}<div class="fbd-grid">${full?wf+funnel+chart+srcCard:chart+funnel+srcCard+wf}${full?fbdProdCard(days):""}${nhom}${pl}</div>
  <details class="fbd-card fbd-wide fbd-det"><summary>Phễu đơn hàng theo tháng (báo cáo Pancake)</summary>${fbFunnel()}</details>
  ${srcNote("Pancake POS (đơn, doanh thu, theo ngày tạo đơn) và Facebook Ads (chi phí). Sheet Pancake đến 29/9, từ 30/9 lấy tự động mỗi sáng.")}`;
}
PAGES.bc_fb=pFbdash;

/* ---- Số bán hàng theo người xử lý đơn (blob fb_sale_days, máy chủ tự kéo từ Pancake mỗi sáng) ---- */
const FBS={raw:null,at:0,busy:false};
async function fbsLoad(force){
  if(typeof svApi!=="function"||FBS.busy||(!force&&Date.now()-FBS.at<1800000))return;FBS.busy=true;
  try{const r=await svApi("/api/hub/blob/fb_sale_days");const ch=(r&&r.at)!==(FBS.raw&&FBS.raw.at);FBS.raw=r;if(r)FBS.at=Date.now();if(ch&&(PAGE==="bc_fb"||PAGE==="fb_sale")&&!svTyping())renderMain()}catch(e){}finally{FBS.busy=false}
}
function fbsPeople(days){
  const R=FBS.raw;if(!R||!R.days)return null;const m={};let n=0;
  days.forEach(k=>{const rows=R.days[k];if(!rows)return;n++;rows.forEach(r=>{const nm=r.u?(((R.names||{})[r.u]||"Người "+r.u.slice(0,6)).replace(/^API_CONNECTION$/,"Đơn tự động từ trang bán hàng (API)")):"(chưa gán)",t=m[nm]||(m[nm]={u:r.u,tao:0,huy:0,hoan:0,giao:0,dt:0});t.tao+=r.tao;t.huy+=r.huy;t.hoan+=r.hoan;t.giao+=r.giao;t.dt+=r.dt})});
  if(!n)return null;
  return {n,list:Object.entries(m).map(([n,x])=>Object.assign(x,{n})).sort((a,b)=>b.tao-a.tao)};
}
function fbsHint(){const P=fbsPeople(fbdRange(PERIOD.from,PERIOD.to));return P?`${esc(pLabel())} · ${P.n} ngày có số · lấy tự động từ Pancake`:`kỳ ${esc((KDX.fbDash||{}).ky||"")}`}
function fbsTbl(){
  adfLoad();fbsLoad();
  const P=fbsPeople(fbdRange(PERIOD.from,PERIOD.to));if(!P)return fbSaleTbl();
  const T=P.list.reduce((a,x)=>({tao:a.tao+x.tao,huy:a.huy+x.huy,hoan:a.hoan+x.hoan,giao:a.giao+x.giao,dt:a.dt+x.dt}),{tao:0,huy:0,hoan:0,giao:0,dt:0});
  const row=(x,i)=>{const chot=x.tao-x.huy,w=[];if(x.tao>=20&&x.huy/x.tao>.2)w.push(pill("hủy cao","red"));if(x.n==="(chưa gán)")w.push(pill("chưa gán người","amb"));
    return `<tr${i<0?' class="tot"':""}><td>${i<0?"":i+1}</td><td><b>${esc(x.n)}</b></td><td class="n">${tr(x.dt)}</td><td class="n">${nf(x.tao)}</td><td class="n">${nf(chot)}</td><td class="n">${nf(x.giao)}</td><td class="n">${nf(x.huy)}</td><td class="n">${nf(x.hoan)}</td><td class="n">${fbdPct(chot,x.tao)}</td><td class="n">${fbdPct(x.huy,x.tao)}</td><td>${w.join(" ")||"—"}</td></tr>`};
  return tbl(["Hạng","Người xử lý đơn","Doanh thu","Đơn tạo","Chốt","Giao TC","Hủy","Hoàn","Tỷ lệ chốt","Tỷ lệ hủy","Cảnh báo"],P.list.map((x,i)=>row(x,i)).concat([row(Object.assign({},T,{n:"Tổng"}),-1)]))+`<p class="fbd-note">Số theo ngày tạo đơn, người xử lý là người bán hàng gắn trên đơn Pancake. Đơn hoàn tính theo ngày hoàn nên có thể nằm khác ngày với đơn gốc.</p>`;
}

/* ---- Giá vốn, phí vận chuyển thật theo ngày (blob fb_cost_days, lấy từ Sheet Pancake: giá vốn và phí ship từng đơn) ---- */
const FBC={raw:null,at:0,busy:false};
async function fbcLoad(force){
  if(typeof svApi!=="function"||FBC.busy||(!force&&Date.now()-FBC.at<1800000))return;FBC.busy=true;
  try{const r=await svApi("/api/hub/blob/fb_cost_days");const ch=(r&&r.at)!==(FBC.raw&&FBC.raw.at);FBC.raw=r;if(r)FBC.at=Date.now();if(ch&&(PAGE==="bc_fb")&&!svTyping())renderMain()}catch(e){}finally{FBC.busy=false}
}
function fbdCost(days){
  const R=FBC.raw&&FBC.raw.days,o={n:0,dt:0,gv:0,ship:0,shipRet:0,qc:0,qcT:0,last:"",gop:0};if(!R)return o;
  days.forEach(k=>{const d=R[k];if(!d)return;o.n++;o.dt+=d.g[1];o.gv+=d.g[2];o.ship+=d.g[3];o.shipRet+=2*d.h[1];o.qc+=sum(Object.keys(DAYD.ads||{}),w=>((DAYD.ads[w]||{})[k]||[0])[0]);o.last=k});
  o.qcT=o.qc*(1+FB_ADS_TAX);o.gop=o.dt-o.gv-o.ship-o.shipRet;return o;
}

/* Hiệu quả theo sản phẩm (chỉ trang quản trị): doanh thu, giá vốn, lãi gộp từng sản phẩm, đơn đã giao thành công theo Sheet Pancake. */
function fbdProdCard(days){
  const F=FBC.raw;if(!F||!F.p||!F.sk)return "";
  const m={};let n=0;
  days.forEach(k=>{const r=F.p[k];if(!r)return;n++;r.forEach(([i,q,dt,gv])=>{const t=m[i]||(m[i]={i,q:0,dt:0,gv:0});t.q+=q;t.dt+=dt*1000;t.gv+=gv*1000})});
  if(!n)return "";
  const L=Object.values(m).map(x=>{const s=F.sk[x.i]||["?","?",""];return Object.assign(x,{c:s[0],n:s[1],g:s[2]||"(chưa nhóm)",lg:x.dt-x.gv})}).sort((a,b)=>b.dt-a.dt);
  const T=L.reduce((a,x)=>({q:a.q+x.q,dt:a.dt+x.dt,gv:a.gv+x.gv}),{q:0,dt:0,gv:0}),top=L.slice(0,18),rest=L.slice(18);
  const row=x=>{const b=x.dt?x.lg/x.dt*100:0;return `<tr><td><b>${esc(x.n)}</b><small>${esc(x.c)} · ${esc(x.g)}</small></td><td class="n">${nf(x.q)}</td><td class="n">${tr(x.dt)}</td><td class="n">${tr(x.gv)}</td><td class="n">${tr(x.lg)}</td><td class="n">${x.dt?pill(Math.round(b)+"%",b>=70?"grn":b>=40?"amb":"red"):"—"}</td><td class="n">${fbdPct(x.dt,T.dt)}</td></tr>`};
  const ro=rest.length?row({n:"Còn lại ("+rest.length+" sản phẩm)",c:"",g:"",q:sum(rest,x=>x.q),dt:sum(rest,x=>x.dt),gv:sum(rest,x=>x.gv),lg:sum(rest,x=>x.lg)}):"";
  return `<section class="fbd-card fbd-wide"><h3>Hiệu quả theo sản phẩm · ${n} ngày có số</h3>${tbl(["Sản phẩm","Số lượng","Doanh thu","Giá vốn","Lãi gộp","Biên gộp","% doanh thu"],top.map(row).concat(ro?[ro]:[],[row({n:"Tổng",c:"",g:"",q:T.q,dt:T.dt,gv:T.gv,lg:T.dt-T.gv})]))}<p class="fbd-note">Đơn đã giao thành công, giá vốn theo bảng quy đổi sản phẩm trong Sheet Pancake. Lãi gộp ở đây chưa trừ vận chuyển và quảng cáo (chưa phân bổ theo từng sản phẩm).</p></section>`;
}
