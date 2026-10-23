/* =====================================================================
   TRANG FACEBOOK · DOANH THU — dạng bảng điều khiển (học từ tab DASHBOARD_CHUNG của Sheet Pancake)
   Bản vận hành (HOST_MODE !== "admin"): chỉ hiện doanh thu, đơn, chi phí quảng cáo và phí vận chuyển.
   Trang quản trị (HOST_MODE === "admin"): hiện đủ giá vốn, phí hoàn, lãi gộp, lãi đóng góp kênh.
   Số lấy theo kỳ chọn ở thanh trên: Sheet Pancake đến 29/9, từ 30/9 dựng từ số tự động (adfMergeDays trong adsday.js).
   ===================================================================== */
/* Chi phí quảng cáo một ngày (chưa thuế).
   Từ 01/10/2026: số Facebook BM kéo mỗi sáng (ads_fb); chị Hoa mới gộp các tài khoản vào một BM nên BM chỉ đủ số từ tháng 10.
   Trước 01/10: báo cáo Digital (Kho lưu trữ), cộng 10% thuế. Tháng 7, 8 theo ngày; tháng 9 lấy tổng tháng rồi chia theo nhịp chi từng ngày của BM. */
const FBD_QC_API_FROM="2026-10-01",FBD_TAX_BM=1.04;
/* Hệ số thuế: tháng 10 theo tiền thật Facebook đã trừ (371,8 triệu đã trừ / 357,3 triệu chi tiêu, 01–21/10); trước đó 1,10 theo báo cáo Digital. */
/* Tháng đã chốt: chi phí quảng cáo lấy đúng tổng tiền Facebook đã trừ trong nhật ký giao dịch có sẵn trên web (ads_fb.billing, máy chủ ghi mỗi sáng, cùng nguồn trang Giao dịch thanh toán Facebook của vận hành), đã gồm thuế nên không nhân 1,1.
   Chỉ dùng cho tháng mà nhật ký ghi đủ từ đầu tháng (máy ghi từ 14/10/2026 nên tháng 11 trở đi) và tháng đã kết thúc. */
let FBD_BMC={key:"",m:{}};
function fbdBmMonth(m){
  const R=typeof ADF!=="undefined"&&ADF.raw?ADF.raw:null;if(!R||!R.billing||!R.days)return null;
  const key=(R.at||"")+"|"+R.billing.length;if(FBD_BMC.key!==key)FBD_BMC={key,m:{}};if(m in FBD_BMC.m)return FBD_BMC.m[m];
  const vn=t=>new Date(Date.parse(t)+7*36e5).toISOString().slice(0,10),ch=R.billing.filter(x=>x.kind==="tru"&&x.time),ds=ch.map(x=>vn(x.time)).sort();
  let out=null;
  if(ds.length){const start=ds[0],mStart=m+"-01",last=Object.keys(R.days).sort().pop(),mEnd=new Date(+m.slice(0,4),+m.slice(5,7),0).getDate(),mLast=m+"-"+String(mEnd).padStart(2,"0");
    if(mStart>=start&&last>mLast){const total=sum(ch.filter(x=>vn(x.time).slice(0,7)===m),x=>x.amount);if(total>0)out={total,final:true}}}
  FBD_BMC.m[m]=out;return out;
}
const fbdFinal=k=>fbdBmMonth(k.slice(0,7));
const fbdTax=k=>fbdFinal(k)?1:1+FB_ADS_TAX;
/* Số Digital hàng ngày có sẵn trên web: chi tiêu Facebook của các chiến dịch thuộc 3 người chạy ads (cùng số trang Hiệu quả Ads của vận hành đang hiện). Chiến dịch chưa rõ người không nằm trong số này. */
const FBD_DIG_OWNERS=["Việt Anh","Thảo","Duẩn"];
const fbdDigDay=k=>{const d=typeof ADF!=="undefined"&&ADF.raw&&ADF.raw.days&&ADF.raw.days[k];if(!d||typeof adfParse!=="function")return 0;return sum(d.fb||[],c=>FBD_DIG_OWNERS.includes(adfParse(c.campaign,c.account).owner)?c.spend:0)};
const fbdApiDay=k=>{const d=typeof ADF!=="undefined"&&ADF.raw&&ADF.raw.days&&ADF.raw.days[k];return d?sum(d.fb||[],c=>c.spend):0};
function fbdQcRaw(k){
  const F=typeof FBC!=="undefined"&&FBC.raw?FBC.raw:null;
  /* Giống trang "Giao dịch thanh toán Facebook" của vận hành: tháng 10 lấy số Facebook (cả chiến dịch chưa rõ người), tháng 9 lấy báo cáo Digital, nhân 1,1 để ra tiền Facebook trừ. */
  const fin=fbdFinal(k);
  if(fin){const m=k.slice(0,7),ks=Object.keys((typeof ADF!=="undefined"&&ADF.raw&&ADF.raw.days)||{}).filter(x=>x.slice(0,7)===m),tot=sum(ks,fbdApiDay);
    if(tot>0)return fin.total*fbdApiDay(k)/tot;return fin.total/new Date(+m.slice(0,4),+m.slice(5,7),0).getDate()}
  const dsum=sum(Object.keys(DAYD.ads||{}),x=>((DAYD.ads[x]||{})[k]||[0])[0]);
  if(k>=FBD_QC_API_FROM){const w=fbdApiDay(k);return w||dsum}
  if(k.slice(0,7)==="2026-09"&&dsum)return dsum;
  if(F&&F.qc&&F.qc[k]!=null)return F.qc[k];
  const m=k.slice(0,7);
  if(F&&F.qcMon&&F.qcMon[m]!=null){
    const ks=Object.keys(ADF.raw&&ADF.raw.days||{}).filter(x=>x.slice(0,7)===m),tot=sum(ks,fbdApiDay);
    if(tot>0)return F.qcMon[m]*fbdApiDay(k)/tot;
    const dim=new Date(+m.slice(0,4),+m.slice(5,7),0).getDate();return F.qcMon[m]/dim;
  }
  return sum(Object.keys(DAYD.ads||{}),w=>((DAYD.ads[w]||{})[k]||[0])[0]);
}
const FBD_SHIP=0.096,FBD_SHIP_RET=29900,FBD_TARGET=18.5;
const fbdFull=()=>typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
const fbdRange=(a,b)=>{const o=[];for(let d=pdate(a);iso(d)<=b&&o.length<800;d=addD(d,1))o.push(iso(d));return o};
const fbdPct=(a,b,dg=1)=>b?(a/b*100).toLocaleString("vi-VN",{maximumFractionDigits:dg})+"%":"—";
function fbdAgg(days){
  const a={tao:0,chot:0,huy:0,hoan:0,giao:0,dtGiao:0,dtChot:0,gv:0,qc:0,qcT:0,n:0,hasQc:false};
  days.forEach(k=>{const r=(DAYD.fb||{})[k];if(r){a.n++;a.tao+=r[0]||0;a.chot+=r[1]||0;a.huy+=r[2]||0;a.hoan+=r[3]||0;a.giao+=r[4]||0;a.dtGiao+=r[5]||0;a.dtChot+=r[6]||0;a.gv+=r[7]||0}
    {const q=fbdQcRaw(k);if(q){a.qc+=q;a.qcT+=q*fbdTax(k);a.hasQc=true}}});
  return a;
}
const fbdSeries=(days,f)=>days.map(k=>f(k));
const fbdDay=k=>{const r=(DAYD.fb||{})[k];return r?r[6]||0:0};
const fbdQc=k=>fbdQcRaw(k)*fbdTax(k);
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
/* Lưới chỉ số gọn kiểu Pancake: mỗi nhóm một dòng tiêu đề, nhiều ô nhỏ. Mỗi ô = [nhãn, số, so kỳ trước, ghi chú, "bad"|"ok"] */
const fbdTile=t=>`<div class="fbd-gt${t[4]?" "+t[4]:""}"><div class="l">${t[0]}</div><div class="v">${t[1]}</div><div class="s">${t[2]||""}${t[3]?`<span>${t[3]}</span>`:""}</div></div>`;
const fbdGrid=groups=>groups.map(([n,L])=>`<section class="fbd-gs"><h4>${n}</h4><div class="fbd-gr">${L.map(fbdTile).join("")}</div></section>`).join("");
const fbdN2=v=>v?v.toLocaleString("vi-VN",{maximumFractionDigits:2}):"—";
/* Biểu đồ cột doanh thu + đường chi phí QC. Kỳ dài hơn 92 ngày thì gộp theo tháng. */
function fbdChart(days,dtFn=fbdDay,qcFn=fbdQc,l1="Doanh thu chốt",l2="Chi phí QC sau thuế"){
  const byM=days.length>92,groups=[];
  if(byM){const m={};days.forEach(k=>{const g=k.slice(0,7);(m[g]=m[g]||[]).push(k)});Object.keys(m).sort().forEach(g=>groups.push({l:g.slice(5)+"/"+g.slice(2,4),ks:m[g]}))}
  else days.forEach(k=>groups.push({l:k.slice(8)+"/"+k.slice(5,7),ks:[k]}));
  const dt=groups.map(g=>sum(g.ks,dtFn)),qc=groups.map(g=>sum(g.ks,qcFn)),hasQ=qc.some(x=>x>0);
  if(!dt.some(x=>x>0))return `<p class="empty">Kỳ này chưa có doanh thu theo ngày.</p>`;
  const W=760,Hh=150,pl=48,pr=10,pt=12,pb=26,iw=W-pl-pr,ih=Hh-pt-pb,mx0=Math.max(1,...dt,...qc),p10=Math.pow(10,Math.floor(Math.log10(mx0))),mx=Math.ceil(mx0/p10*2)/2*p10||mx0;
  const n=groups.length,bw=iw/n,x=i=>pl+i*bw+bw/2,y=v=>pt+ih-v/mx*ih;
  const grid=[0,.25,.5,.75,1].map(f=>`<line x1="${pl}" x2="${W-pr}" y1="${y(mx*f)}" y2="${y(mx*f)}" stroke="#e9ecf3"/><text x="${pl-6}" y="${y(mx*f)+4}" text-anchor="end" font-size="10" fill="#7a8397">${money(mx*f)}</text>`).join("");
  const bars=dt.map((v,i)=>`<rect x="${(x(i)-Math.max(1.5,bw*.62)/2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${Math.max(1.5,bw*.62).toFixed(1)}" height="${Math.max(0,pt+ih-y(v)).toFixed(1)}" rx="2" fill="url(#fbdg)"><title>${groups[i].l}: doanh thu ${money(v)}${hasQ?" · chi phí "+money(qc[i]):""}</title></rect>`).join("");
  const line=hasQ?`<polyline points="${qc.map((v,i)=>x(i).toFixed(1)+","+y(v).toFixed(1)).join(" ")}" fill="none" stroke="#f59f00" stroke-width="2.2" stroke-linejoin="round"/>`:"";
  const step=Math.max(1,Math.ceil(n/12)),lbl=groups.map((g,i)=>i%step===0?`<text x="${x(i).toFixed(1)}" y="${Hh-8}" text-anchor="middle" font-size="10" fill="#7a8397">${g.l}</text>`:"").join("");
  return `<svg class="fbd-chart" viewBox="0 0 ${W} ${Hh}"><defs><linearGradient id="fbdg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7357b"/><stop offset="1" stop-color="#f08ab3"/></linearGradient></defs>${grid}${bars}${line}${lbl}</svg><div class="fbd-leg"><i style="background:#e7357b"></i>${l1}${hasQ?`<i style="background:#f59f00"></i>${l2}`:""}${byM?" · gộp theo tháng":""}</div>`;
}
const FBD_SRC={"Webcake Landing":["Trang bán hàng (Webcake)","#e7357b"],"Facebook":["Inbox Facebook","#3b5bdb"],"CSKH":["Chăm sóc khách hàng","#0ca678"]};
function fbdSources(days){
  const R=typeof ADF!=="undefined"&&ADF.raw&&ADF.raw.days;if(!R)return [];
  const m={};days.forEach(k=>((R[k]||{}).pos||[]).forEach(p=>{const s=p.source||"Nguồn khác",t=m[s]||(m[s]={s,o:0,rev:0,can:0});t.o+=p.orders||0;t.rev+=p.revenue||0;t.can+=p.canceled||0}));
  const pal=["#7048e8","#f59f00","#15aabf","#868e96"];let pi=0;
  return Object.values(m).sort((a,b)=>b.rev-a.rev).map(t=>({n:(FBD_SRC[t.s]||[t.s])[0],c:(FBD_SRC[t.s]||[0,pal[pi++%pal.length]])[1],o:t.o,rev:t.rev,can:t.can}));
}
function fbdRow(l,v,p,col,sub){return `<div class="fbd-row"><div class="fbd-rl">${l}${sub?`<small>${sub}</small>`:""}</div><div class="fbd-rb"><i style="width:${Math.max(0,Math.min(100,p||0)).toFixed(1)}%;background:${col}"></i></div><div class="fbd-rv">${v}</div></div>`}
function pFbdash(m,forceOps){
  adfLoad();fbsLoad();fbcLoad();adfMergeDays();
  const all=fbdRange(PERIOD.from,PERIOD.to),lastK=all.filter(k=>(DAYD.fb||{})[k]).pop()||PERIOD.to,days=all.filter(k=>k<=lastK),A=fbdAgg(days),len=days.length;
  const pf=iso(addD(pdate(PERIOD.from),-len)),pt=iso(addD(pdate(PERIOD.from),-1)),P=fbdAgg(fbdRange(pf,pt)),full=forceOps?false:fbdFull();
  const head=H("Facebook",full?"Lãi lỗ (P&L) kênh Facebook · doanh thu, giá vốn, vận chuyển, quảng cáo từ Pancake, Sheet và Facebook Ads":"Doanh thu kênh Facebook · số lấy từ Pancake và Facebook Ads");
  if(!A.n)return m.innerHTML=head+`<section class="card"><p class="empty">Kỳ đã chọn chưa có số Facebook.${typeof lastDataMonth==="function"&&lastDataMonth()?" Số có đến tháng "+lastDataMonth().slice(5)+"/"+lastDataMonth().slice(0,4)+".":""}</p></section>`;
  const est=(typeof ADF!=="undefined"&&ADF.mgEst)?days.some(k=>ADF.mgEst.has(k)):false;
  const roasPre0=A.qc?A.dtChot/A.qc:0,dtSer=fbdSeries(days,fbdDay),aov=A.chot?A.dtChot/A.chot:0,aovP=P.chot?P.dtChot/P.chot:0,cpo=A.hasQc&&A.chot?A.qcT/A.chot:0,roas=A.qcT?A.dtChot/A.qcT:0;
  const C=fbdCost(days),ship=A.dtGiao*FBD_SHIP,shipRet=A.hoan*FBD_SHIP_RET,gv=A.gv;
  const gop=A.dtGiao-gv-ship-shipRet,after=gop-A.qcT,opex=0,profit=after-opex,gopPct=A.dtGiao?gop/A.dtGiao*100:0,ceil=gopPct-FBD_TARGET;
  const srcs=fbdSources(days),srcTot=sum(srcs,s=>s.rev);
  const upd=typeof ADF!=="undefined"&&ADF.raw&&ADF.raw.at?new Date(ADF.raw.at).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"}):"";
  const hero=`<section class="fbd-hero"><div class="fbd-h1"><div class="fbd-hl">Doanh thu chốt · ${esc(pLabel())}</div><div class="fbd-hv">${money(A.dtChot)}</div><div class="fbd-hs">${fbdDelta(A.dtChot,P.dtChot)||""}<span>${P.dtChot?"so với "+len+" ngày liền trước":""}</span></div>${fbdSpark(dtSer,260,54,"#e7357b")}</div>
    <div class="fbd-h2">${(full?[["Chi phí QC sau thuế",A.hasQc?money(A.qcT):"—",A.hasQc?`<span>${fbdPct(A.qcT,A.dtChot)} doanh thu chốt · số thật</span>`:"<span>chưa có số quảng cáo</span>"],["Lãi gộp",C.n?money(C.gop):"<span class=\"fbd-nc\">chưa tính được</span>",C.n?`<span>${fbdPct(C.gop,C.dt)} · giá vốn, vận chuyển thật</span>`:"<span>thiếu giá vốn, chi phí vận chuyển thật</span>"],["Lãi đóng góp kênh",C.n&&A.hasQc?money(C.gop-C.qcT):"<span class=\"fbd-nc\">chưa tính được</span>",C.n&&A.hasQc?`<span>${fbdPct(C.gop-C.qcT,C.dt)} · sau quảng cáo</span>`:"<span>thiếu số thật</span>"],["Lợi nhuận","<span class=\"fbd-nc\">chưa tính được</span>","<span>cần chi phí vận hành</span>"]]:[["Đơn chốt",nf(A.chot),fbdDelta(A.chot,P.chot)||`<span>trên ${nf(A.tao)} đơn tạo</span>`],["Giá trị TB / đơn",aov?nf(Math.round(aov))+"đ":"—",fbdDelta(aov,aovP)||"<span>doanh thu / đơn chốt</span>"],["Chi phí QC sau thuế",A.hasQc?money(A.qcT):"—",A.hasQc?`<span>${fbdPct(A.qcT,A.dtChot)} doanh thu chốt</span>`:"<span>chưa có số quảng cáo</span>"],["ROAS",A.hasQc&&roas?roas.toLocaleString("vi-VN",{maximumFractionDigits:2}):"—",`<span>chưa thuế ${roasPre0?roasPre0.toLocaleString("vi-VN",{maximumFractionDigits:2}):"—"} · hòa vốn 1,8</span>`]]).map(([l,v,s])=>`<div class="fbd-hm"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("")}</div></section>`;
  const tiles=`<div class="fbd-tiles">
    <div class="fbd-t"><div class="fbd-tr">${fbdRing(A.tao?A.chot/A.tao*100:0,"#087a55",A.tao?Math.round(A.chot/A.tao*100)+"%":"—")}<div><div class="l">Tỷ lệ chốt</div><div class="s">${nf(A.chot)} / ${nf(A.tao)} đơn</div></div></div></div>
    <div class="fbd-t"><div class="fbd-tr">${fbdRing(A.tao?A.huy/A.tao*100:0,A.tao&&A.huy/A.tao>.2?"#b42318":"#f59f00",A.tao?Math.round(A.huy/A.tao*100)+"%":"—")}<div><div class="l">Tỷ lệ hủy</div><div class="s">${nf(A.huy)} đơn hủy</div></div></div></div>
    <div class="fbd-t"><div class="fbd-tr">${fbdRing(A.giao+A.hoan?A.hoan/(A.giao+A.hoan)*100:0,"#6941c6",A.giao+A.hoan?Math.round(A.hoan/(A.giao+A.hoan)*100)+"%":"—")}<div><div class="l">Tỷ lệ hoàn${est?" (ước tính)":""}</div><div class="s">${nf(A.hoan)} đơn hoàn</div></div></div></div>
    <div class="fbd-t"><div class="fbd-tr">${fbdRing(A.dtChot&&A.hasQc?A.qcT/A.dtChot*100:0,"#e7357b",A.hasQc&&A.dtChot?Math.round(A.qcT/A.dtChot*100)+"%":"—")}<div><div class="l">Chi phí QC / doanh thu</div><div class="s">${A.hasQc&&A.chot?"CPO "+nf(Math.round(cpo))+"đ / đơn":"chưa có số QC"}</div></div></div></div></div>`;
  const nd=A.n||1,hu=A.tao?A.huy/A.tao:0,ho=A.giao+A.hoan?A.hoan/(A.giao+A.hoan):0,qcr=A.dtChot&&A.hasQc?A.qcT/A.dtChot:0,rt=(a,b)=>b?fbdPct(a,b):"—";
  const grid=fbdGrid([
    ["Doanh thu",[["Doanh thu chốt",money(A.dtChot),fbdDelta(A.dtChot,P.dtChot),"đơn đã chốt"],["Doanh thu giao thành công",money(A.dtGiao),fbdDelta(A.dtGiao,P.dtGiao),"đơn khách đã nhận"],["Giá trị TB / đơn chốt",aov?nf(Math.round(aov))+"đ":"—",fbdDelta(aov,aovP)],["Giá trị TB / đơn giao",A.giao?nf(Math.round(A.dtGiao/A.giao))+"đ":"—","","đơn giao thành công"],["Doanh thu / ngày",money(A.dtChot/nd),"",nd+" ngày có số"]]],
    ["Đơn hàng",[["Đơn tạo",nf(A.tao),fbdDelta(A.tao,P.tao)],["Đơn chốt",nf(A.chot),fbdDelta(A.chot,P.chot)],["Đơn hủy",nf(A.huy),fbdDelta(A.huy,P.huy,true),"",hu>.2?"bad":""],["Giao thành công"+(est?"*":""),nf(A.giao),fbdDelta(A.giao,P.giao)],["Đơn hoàn"+(est?"*":""),nf(A.hoan),fbdDelta(A.hoan,P.hoan,true),"",ho>.09?"bad":""],["Đơn tạo / ngày",nf(Math.round(A.tao/nd)),"",nd+" ngày có số"]]],
    ["Tỷ lệ",[["Tỷ lệ chốt",rt(A.chot,A.tao),"","chốt / tạo"],["Tỷ lệ hủy",rt(A.huy,A.tao),"","ngưỡng 20%",hu>.2?"bad":"ok"],["Tỷ lệ hoàn",rt(A.hoan,A.giao+A.hoan),"","ngưỡng 9%",ho>.09?"bad":"ok"],["Giao thành công / tạo",rt(A.giao,A.tao)],["Chi phí QC / doanh thu",A.hasQc?fbdPct(A.qcT,A.dtChot):"—","","ngưỡng 35%",qcr>.35?"bad":(A.hasQc?"ok":"")]]],
    ["Quảng cáo và vận chuyển",[["Chi phí QC sau thuế",A.hasQc?money(A.qcT):"—",fbdDelta(A.qcT,P.qcT,true)],["Chi phí QC chưa thuế",A.hasQc?money(A.qc):"—"],["CPO (chi phí / đơn chốt)",A.hasQc&&A.chot?nf(Math.round(cpo))+"đ":"—"],["ROAS sau thuế",fbdN2(roas),"","hòa vốn 1,8",A.hasQc&&roas&&roas<1.8?"bad":""],["ROAS chưa thuế",fbdN2(roasPre0),"","hòa vốn 1,8",A.hasQc&&roasPre0&&roasPre0<1.8?"bad":(roasPre0?"ok":"")],["Chi phí vận chuyển",C.n?money(C.ship):"—","","số thật theo đơn"],["Vận chuyển / doanh thu giao",C.n&&C.dt?fbdPct(C.ship,C.dt):"—","","ngưỡng 10%",C.n&&C.dt&&C.ship/C.dt>.1?"bad":""]]]
  ]);
  const funnel=`<section class="fbd-card"><h3>Phễu đơn hàng</h3>${fbdRow("Đơn tạo",nf(A.tao),100,"#3b5bdb")}${fbdRow("Đã chốt",nf(A.chot),A.tao?A.chot/A.tao*100:0,"#087a55",fbdPct(A.chot,A.tao))}${fbdRow("Giao thành công"+(est?"*":""),nf(A.giao),A.tao?A.giao/A.tao*100:0,"#0ca678",fbdPct(A.giao,A.tao))}${fbdRow("Đơn hủy",nf(A.huy),A.tao?A.huy/A.tao*100:0,"#e03131",fbdPct(A.huy,A.tao))}${fbdRow("Đơn hoàn"+(est?"*":""),nf(A.hoan),A.tao?A.hoan/A.tao*100:0,"#7048e8",fbdPct(A.hoan,A.tao))}${est?`<p class="fbd-note">* Một số ngày chưa có số đơn hoàn thật từ Pancake nên đơn hoàn và đơn giao xong là ước tính.</p>`:""}</section>`;
  const chart=`<section class="fbd-card fbd-c2"><h3>Doanh thu và chi phí quảng cáo theo ngày</h3>${fbdChart(days)}</section>`;
  const srcCard=srcs.length?`<section class="fbd-card"><h3>Doanh thu theo nguồn đơn</h3><div class="fbd-stack">${srcs.map(s=>`<i style="width:${srcTot?s.rev/srcTot*100:0}%;background:${s.c}" title="${esc(s.n)}"></i>`).join("")}</div>${srcs.map(s=>`<div class="fbd-sl"><span><i style="background:${s.c}"></i>${esc(s.n)}</span><b>${money(s.rev)}</b><em>${fbdPct(s.rev,srcTot)} · ${nf(s.o)} đơn · hủy ${fbdPct(s.can,s.o)}</em></div>`).join("")}<p class="fbd-note">Doanh thu theo nguồn tạo đơn trên Pancake, tính cả đơn chưa chốt.</p></section>`:"";
  const T0='<span class="fbd-todo">chưa có số</span>',NC0='<span class="fbd-nc">chưa tính được</span>',R0=(l,sub)=>fbdRow(l,T0,0,"#ced4da",sub);
  const lastC=C.last?C.last.slice(8)+"/"+C.last.slice(5,7):"";
  const cNote=C.n?`Tính cho ${C.n} ngày có số trong Sheet Pancake (đến ${lastC}): doanh thu giao thành công, giá vốn, phí vận chuyển lấy theo từng đơn; chi phí quảng cáo lấy đúng các ngày đó. Đơn mới tạo chưa kịp giao nên các ngày gần đây doanh thu còn thấp.`:"";
  const costItems=C.n?[{n:"Giá vốn hàng bán",v:C.gv,c:"#7048e8"},{n:"Chi phí vận chuyển",v:C.ship,c:"#3b5bdb"},{n:"Ship đơn hoàn hai chiều",v:C.shipRet,c:"#0ca678"},{n:"Chi phí quảng cáo (gồm thuế)",v:A.hasQc?C.qcT:0,c:"#f59f00"}]:[],costTot=sum(costItems,x=>x.v),profitT=C.dt-costTot;
  const costRow=x=>`<div class="fbd-cr"><span class="d" style="background:${x.c}"></span><span class="n">${x.n}</span><b>${money(x.v)}</b><em>${fbdPct(x.v,costTot)} chi phí</em><em>${fbdPct(x.v,C.dt)} doanh thu</em></div>`;
  const costCard=C.n?`<section class="fbd-card fbd-c2"><h3>Cơ cấu chi phí</h3><div class="fbd-cost">${fbdDonut(costItems,costTot,money(costTot))}<div class="fbd-cl">${costItems.map(costRow).join("")}<div class="fbd-cr"><span class="d" style="background:#ced4da"></span><span class="n">Chi phí vận hành <small>lương, kho, mặt bằng, quản lý</small></span><span class="fbd-todo">chưa nhập</span></div></div></div><p class="fbd-note">${cNote}</p></section>`:`<section class="fbd-card fbd-c2"><h3>Cơ cấu chi phí</h3><p class="empty">Kỳ này chưa có giá vốn và chi phí vận chuyển thật nên chưa dựng được cơ cấu chi phí.</p></section>`;
  const heroA=C.n?`<section class="fbd-hero"><div class="fbd-h1"><div class="fbd-hl">Tổng doanh thu · đơn giao thành công · ${esc(pLabel())}</div><div class="fbd-hv">${money(C.dt)}</div><div class="fbd-hs"><span>${C.n} ngày có số trong Sheet Pancake (đến ${C.last.slice(8)+"/"+C.last.slice(5,7)})</span></div>${fbdSpark(days.map(k=>((FBC.raw.days||{})[k]||{g:[0,0]}).g[1]),260,30,"#e7357b")}</div>
    <div class="fbd-h2">${[["Tổng chi phí",money(costTot),`<span>${fbdPct(costTot,C.dt)} doanh thu · chưa gồm chi phí vận hành</span>`],["Lợi nhuận",money(profitT),`<span>tạm tính, chưa trừ chi phí vận hành</span>`],["Biên lợi nhuận",fbdPct(profitT,C.dt),`<span>lợi nhuận / doanh thu</span>`],["Doanh thu chốt",money(A.dtChot),`<span>gốc đơn chốt, ${nf(A.chot)} đơn · ROAS ${A.qcT?(A.dtChot/A.qcT).toLocaleString("vi-VN",{maximumFractionDigits:2}):"—"}</span>`]].map(([l,v,s2])=>`<div class="fbd-hm"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s2}</div></div>`).join("")}</div></section>`:"";
  const cdays=days.filter(k=>((FBC.raw&&FBC.raw.days)||{})[k]),cDt=k=>(((FBC.raw||{}).days||{})[k]||{g:[0,0,0,0]}).g[1],cCost=k=>{const d=((FBC.raw||{}).days||{})[k];return d?d.g[2]+d.g[3]+2*d.h[1]+fbdQc(k):0};
  const chartA=`<section class="fbd-card fbd-wide"><h3>Doanh thu và tổng chi phí theo ngày</h3>${fbdChart(cdays,cDt,cCost,"Doanh thu giao thành công","Tổng chi phí (giá vốn, vận chuyển, quảng cáo)")}</section>`;
  const wf=full
    ?`<section class="fbd-card"><h3>Từ doanh thu đến lợi nhuận</h3>${C.n?fbdRow("Doanh thu đơn giao thành công",money(C.dt),100,"#3b5bdb","số thật theo đơn"):fbdRow("Doanh thu đơn giao thành công",money(A.dtGiao),100,"#3b5bdb","số thật từ Pancake")}${C.n?fbdRow("− Giá vốn hàng bán",money(C.gv),C.dt?C.gv/C.dt*100:0,"#adb5bd",fbdPct(C.gv,C.dt)+" · số thật"):R0("− Giá vốn hàng bán","chờ giá vốn thật theo sản phẩm")}${C.n?fbdRow("− Chi phí vận chuyển",money(C.ship),C.dt?C.ship/C.dt*100:0,"#adb5bd",fbdPct(C.ship,C.dt)+" · số thật"):R0("− Chi phí vận chuyển","chờ phí vận chuyển thật")}${C.n?fbdRow("− Ship đơn hoàn hai chiều",money(C.shipRet),C.dt?C.shipRet/C.dt*100:0,"#adb5bd",fbdPct(C.shipRet,C.dt)+" · số thật"):R0("− Ship đơn hoàn hai chiều","chờ phí vận chuyển thật")}${C.n?fbdRow("= Lãi gộp",money(C.gop),C.dt?Math.max(0,C.gop/C.dt*100):0,"#087a55",fbdPct(C.gop,C.dt)):fbdRow("= Lãi gộp",NC0,0,"#ced4da")}${fbdRow("− Chi phí quảng cáo sau thuế",A.hasQc?money(C.n?C.qcT:A.qcT):"—",(C.n?C.dt:A.dtGiao)?(C.n?C.qcT:A.qcT)/(C.n?C.dt:A.dtGiao)*100:0,"#f59f00",A.hasQc?fbdPct(C.n?C.qcT:A.qcT,C.n?C.dt:A.dtGiao)+" · số thật từ Facebook":"")}${C.n&&A.hasQc?fbdRow("= Lãi đóng góp kênh",money(C.gop-C.qcT),C.dt?Math.max(0,(C.gop-C.qcT)/C.dt*100):0,C.gop-C.qcT>=0?"#0b7285":"#e03131",fbdPct(C.gop-C.qcT,C.dt)):fbdRow("= Lãi đóng góp kênh",NC0,0,"#ced4da")}${fbdRow("− Chi phí vận hành",'<span class="fbd-todo">chưa nhập</span>',0,"#ced4da","lương, kho, mặt bằng, quản lý")}${fbdRow("= Lợi nhuận",NC0,0,"#ced4da","cần chi phí vận hành")}<p class="fbd-note">${cNote||"Chưa có giá vốn và chi phí vận chuyển thật cho kỳ này nên chưa tính lãi."}</p></section>`
    :`<section class="fbd-card fbd-c2"><h3>Doanh thu, vận chuyển và quảng cáo</h3>${C.n?fbdRow("Doanh thu đơn giao thành công",money(C.dt),100,"#3b5bdb","số thật theo đơn"):fbdRow("Doanh thu đơn giao thành công",money(A.dtGiao),100,"#3b5bdb","số thật từ Pancake")}${C.n?fbdRow("− Chi phí vận chuyển",money(C.ship),C.dt?C.ship/C.dt*100:0,"#adb5bd",fbdPct(C.ship,C.dt)+" · số thật"):R0("− Chi phí vận chuyển","chờ phí vận chuyển thật")}${fbdRow("− Chi phí quảng cáo sau thuế",A.hasQc?money(C.n?C.qcT:A.qcT):"—",(C.n?C.dt:A.dtGiao)?(C.n?C.qcT:A.qcT)/(C.n?C.dt:A.dtGiao)*100:0,"#f59f00",A.hasQc?fbdPct(C.n?C.qcT:A.qcT,C.n?C.dt:A.dtGiao)+" · số thật":"")}${C.n&&A.hasQc?fbdRow("= Còn lại sau vận chuyển và quảng cáo",money(C.dt-C.ship-C.qcT),C.dt?Math.max(0,(C.dt-C.ship-C.qcT)/C.dt*100):0,"#0b7285"):""}<p class="fbd-note">${cNote||"Chưa có chi phí vận chuyển thật cho kỳ này."} Giá vốn và các chi phí khác xem ở trang quản trị.</p></section>`;
  const al=[],fin=A.giao+A.hoan,roasPre=A.qc?A.dtChot/A.qc:0,aovG=A.giao?A.dtGiao/A.giao:aov;
  /* Ngưỡng đã chốt (skill báo cáo Facebook): hủy > 20% trên đơn tạo, hoàn > 9%, chi phí QC > 35% doanh thu, ROAS chưa thuế < 1,8 là dưới hòa vốn, ship > 10%. Mỗi cảnh báo kèm việc cần làm và quy ra tiền. */
  if(A.tao&&A.huy/A.tao>.2){const ex=Math.round(A.huy-.2*A.tao);al.push(["red",`Hủy ${fbdPct(A.huy,A.tao)} (ngưỡng 20%). Kéo về ngưỡng cứu khoảng ${nf(ex)} đơn ≈ ${money(ex*aov)}: nghe lại cuộc gọi hủy của người hủy cao, tách do khách hay do kịch bản chốt`])}
  if(fin&&A.hoan/fin>.09){const ex=Math.round(A.hoan-.09*fin);al.push(["red",`Hoàn ${fbdPct(A.hoan,fin)} (ngưỡng 9%). Mỗi đơn hoàn mất ship hai chiều; kéo về 9% cứu khoảng ${nf(ex)} đơn ≈ ${money(ex*FBD_SHIP_RET)} phí ship, chưa kể hàng: xem lý do hoàn theo hãng vận chuyển và sản phẩm`])}
  if(A.hasQc&&roasPre&&roasPre<1.8)al.push(["red",`ROAS ${roasPre.toLocaleString("vi-VN",{maximumFractionDigits:2})} (chưa thuế) dưới điểm hòa vốn 1,8. Thiếu ${money(1.8*A.qc-A.dtChot)} doanh thu mới hòa vốn với mức chi hiện tại: cắt chiến dịch dưới ngưỡng, dồn ngân sách sang mã đang lãi`]);
  else if(A.hasQc&&A.dtChot&&A.qcT/A.dtChot>.35)al.push(["amb",`Chi phí quảng cáo ${fbdPct(A.qcT,A.dtChot)} doanh thu chốt (gồm thuế), trên mức theo dõi 35%. ROAS chưa thuế ${roasPre.toLocaleString("vi-VN",{maximumFractionDigits:2})}, còn trên hòa vốn 1,8 nhưng biên mỏng: soát các chiến dịch chi cao mà ít đơn`]);
  if(C.n&&C.dt&&C.ship/C.dt>.1)al.push(["amb",`Phí vận chuyển ${fbdPct(C.ship,C.dt)} doanh thu, trên mức 10%: kiểm tra phí theo hãng và đơn hoàn`]);
  if(!A.hasQc)al.push(["amb","Kỳ này chưa có số chi phí quảng cáo"]);
  if(A.dtChot&&P.dtChot&&A.dtChot<P.dtChot*.8)al.push(["amb",`Doanh thu thấp hơn kỳ trước ${Math.round((1-A.dtChot/P.dtChot)*100)}%`]);
  if(est)al.push(["blu","Có ngày dùng số tự động từ Pancake: đơn giao xong là ước tính. Vài ngày cuối kỳ tỷ lệ hủy thấp giả vì sale chưa gọi hết đơn mới"]);
  const alF=full?al.filter(x=>/Chi phí quảng cáo|Phí vận chuyển|chưa có số chi phí|ROAS|thấp hơn kỳ trước/.test(x[1])):al;
  const alerts=alF.length?`<div class="fbd-al">${alF.map(([c,t])=>`<span class="fbd-ch ${c}">${c==="red"?"⚠":c==="amb"?"●":"ⓘ"} ${t}</span>`).join("")}</div>`:"";
  const Dd=KDX.fbDash||{},N=KDX.fbNhom||[];
  const nhom=N.length?`<section class="fbd-card fbd-wide"><h3>Theo nhóm sản phẩm · tháng 9</h3>${tbl(full?["Nhóm hàng","Số đơn","Số lượng","Doanh thu","Giá vốn","Biên gộp"]:["Nhóm hàng","Số đơn","Số lượng","Doanh thu"],N.map(x=>`<tr><td><b>${esc(x.n)}</b></td><td class="n">${nf(x.don)}</td><td class="n">${nf(x.sl)}</td><td class="n">${tr(x.dt)}</td>${full?`<td class="n">${tr(x.gv)}</td><td class="n">${x.dt?pill(Math.round((x.dt-x.gv)/x.dt*100)+"%",(x.dt-x.gv)/x.dt>.6?"grn":"amb"):"—"}</td>`:""}</tr>`))}</section>`:"";
  const pl=full&&Dd.dt?`<section class="fbd-card fbd-wide"><h3>Lãi đóng góp kênh · kỳ ${esc(Dd.ky||"")} (Sheet Pancake)</h3>${tbl(["Khoản","Số tiền","% doanh thu"],[["Doanh thu ghi nhận",Dd.dt],["− Giá vốn hàng bán",Dd.gv],["− Phí vận chuyển",Dd.vc],["− Ship đơn hoàn (2 chiều)",Dd.hoan],["= Lãi gộp",Dd.laigop]].map(([l,v])=>`<tr class="${l.startsWith("=")?"tot":""}"><td>${l}</td><td class="n">${nf(v)}</td><td class="n">${Dd.dt?Math.abs(v/Dd.dt*100).toFixed(1)+"%":"—"}</td></tr>`))}</section>`:"";
  const heroUse=(full&&heroA)?heroA:hero;
  m.innerHTML=head+`<div class="fbd-meta"><span class="pill p-blu">${esc(pLabel())}</span><span>${A.n}/${len} ngày có số${len<all.length?" (kỳ chọn còn "+(all.length-len)+" ngày chưa tới)":""}</span>${upd?`<span>số tự động cập nhật ${upd}</span>`:""}</div>${heroUse}${alerts}${full?"":tiles+grid}<div class="fbd-grid">${full?costCard+wf+chartA:chart+funnel+srcCard+wf}${full?fbdProdCard(days):""}${nhom}${pl}</div>
  ${full?"":`<details class="fbd-card fbd-wide fbd-det"><summary>Phễu đơn hàng theo tháng (báo cáo Pancake)</summary>${fbFunnel()}</details>`}
  ${srcNote("Pancake POS (đơn, doanh thu, theo ngày tạo đơn) và Facebook Ads (chi phí). Sheet Pancake đến 29/9, từ 30/9 lấy tự động mỗi sáng.")}`;
}
PAGES.bc_fb=m=>pFbdash(m);

/* ---- Số bán hàng theo người xử lý đơn (blob fb_sale_days, máy chủ tự kéo từ Pancake mỗi sáng) ---- */
const FBS={raw:null,at:0,busy:false},FBS_KPI=["Mai Hương","Huyền Phạm","Linh Ha"];/* người tính KPI: chị Hoa chốt 22/10/2026 (Dũng Hoàng đã nghỉ) */
async function fbsLoad(force){
  if(typeof svApi!=="function"||FBS.busy||(!force&&Date.now()-FBS.at<1800000))return;FBS.busy=true;
  try{const r=await svApi("/api/hub/blob/fb_sale_days");const ch=(r&&r.at)!==(FBS.raw&&FBS.raw.at);FBS.raw=r;if(r)FBS.at=Date.now();if(ch&&(PAGE==="bc_fb"||PAGE==="fb_sale")&&!svTyping())renderMain()}catch(e){}finally{FBS.busy=false}
}
function fbsPeople(days){
  const R=FBS.raw;if(!R||!R.days)return null;const m={};let n=0;
  days.forEach(k=>{const rows=R.days[k];if(!rows)return;n++;rows.forEach(r=>{const nm=r.u?(((R.names||{})[r.u]||"Người "+r.u.slice(0,6)).replace(/^API_CONNECTION$/,"Đơn tự động từ trang bán hàng (API)").replace(/^Thảo Đĩnh$/,"Thảo Đĩnh (Thảo ads)")):"(chưa gán)",t=m[nm]||(m[nm]={u:r.u,tao:0,huy:0,hoan:0,giao:0,dt:0});t.tao+=r.tao;t.huy+=r.huy;t.hoan+=r.hoan;t.giao+=r.giao;t.dt+=r.dt-(r.hoanDt||0)})});
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
  const fold=t=>String(t).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").toLowerCase().trim(),isK=x=>FBS_KPI.some(n=>fold(n)===fold(x.n));
  const K=P.list.filter(isK),S=P.list.filter(x=>!isK(x)),sumL=(L,n)=>Object.assign(L.reduce((a,x)=>({tao:a.tao+x.tao,huy:a.huy+x.huy,hoan:a.hoan+x.hoan,giao:a.giao+x.giao,dt:a.dt+x.dt}),{tao:0,huy:0,hoan:0,giao:0,dt:0}),{n});
  const head=t=>`<tr class="fbd-grp"><td colspan="11">${t}</td></tr>`;
  const rows=[head("Người tính KPI")].concat(K.map((x,i)=>row(x,i)),K.length?[row(sumL(K,"Cộng nhóm tính KPI"),-1)]:[],[head("Hỗ trợ, đơn tự động, chưa gán người (không tính KPI)")],S.map((x,i)=>row(x,K.length+i)),[row(Object.assign({},T,{n:"Tổng"}),-1)]);
  return tbl(["Hạng","Người xử lý đơn","Doanh thu","Đơn tạo","Chốt","Giao TC","Hủy","Hoàn","Tỷ lệ chốt","Tỷ lệ hủy","Cảnh báo"],rows)+`<p class="fbd-note">Doanh thu = đơn đã xác nhận, đã trừ đơn hoàn và đơn hủy, xếp theo ngày tạo đơn. Người xử lý là người bán hàng gắn trên đơn Pancake. Người tính KPI: ${FBS_KPI.join(", ")} (Huyền Phạm đã đi làm lại, Dũng Hoàng đã nghỉ). Đơn hoàn tính theo ngày hoàn nên có thể nằm khác ngày với đơn gốc.</p>`;
}

/* ---- Giá vốn, phí vận chuyển thật theo ngày (blob fb_cost_days, lấy từ Sheet Pancake: giá vốn và phí ship từng đơn) ---- */
const FBC={raw:null,at:0,busy:false};
async function fbcLoad(force){
  if(typeof svApi!=="function"||FBC.busy||(!force&&Date.now()-FBC.at<1800000))return;FBC.busy=true;
  try{const r=await svApi("/api/hub/blob/fb_cost_days");const ch=(r&&r.at)!==(FBC.raw&&FBC.raw.at);FBC.raw=r;if(r)FBC.at=Date.now();if(ch&&(PAGE==="bc_fb")&&!svTyping())renderMain()}catch(e){}finally{FBC.busy=false}
}
function fbdCost(days){
  const R=FBC.raw&&FBC.raw.days,o={n:0,dt:0,gv:0,ship:0,shipRet:0,qc:0,qcT:0,last:"",gop:0,fN:0,fRev:0,fGv:0};if(!R)return o;
  days.forEach(k=>{const d=R[k];if(!d)return;o.n++;o.dt+=d.g[1];o.gv+=d.g[2];o.ship+=d.g[3];o.shipRet+=2*d.h[1];const qr=fbdQcRaw(k);o.qc+=qr;o.qcT+=qr*fbdTax(k);if(d.f){o.fN+=d.f[0];o.fRev+=d.f[1];o.fGv+=d.f[2]};o.last=k});
  o.gop=o.dt-o.gv-o.ship-o.shipRet;return o;
}

/* Hiệu quả theo sản phẩm (chỉ trang quản trị): doanh thu, giá vốn, lãi gộp từng sản phẩm, đơn đã giao thành công theo Sheet Pancake. */
function fbdProdCard(days,topN,title){
  const F=FBC.raw;if(!F||!F.p||!F.sk)return "";
  const m={};let n=0;
  days.forEach(k=>{const r=F.p[k];if(!r)return;n++;r.forEach(([i,q,dt,gv])=>{const t=m[i]||(m[i]={i,q:0,dt:0,gv:0});t.q+=q;t.dt+=dt*1000;t.gv+=gv*1000})});
  if(!n)return "";
  const L=Object.values(m).map(x=>{const s=F.sk[x.i]||["?","?",""];return Object.assign(x,{c:s[0],n:s[1],g:s[2]||"(chưa nhóm)",lg:x.dt-x.gv})}).sort((a,b)=>b.dt-a.dt);
  const T=L.reduce((a,x)=>({q:a.q+x.q,dt:a.dt+x.dt,gv:a.gv+x.gv}),{q:0,dt:0,gv:0}),top=L.slice(0,topN||18),rest=L.slice(topN||18);
  const row=x=>{const b=x.dt?x.lg/x.dt*100:0;return `<tr><td><b>${esc(x.n)}</b><small>${esc(x.c)} · ${esc(x.g)}</small></td><td class="n">${nf(x.q)}</td><td class="n">${tr(x.dt)}</td><td class="n">${tr(x.gv)}</td><td class="n">${tr(x.lg)}</td><td class="n">${x.dt?pill(Math.round(b)+"%",b>=70?"grn":b>=40?"amb":"red"):"—"}</td><td class="n">${fbdPct(x.dt,T.dt)}</td></tr>`};
  const ro=rest.length?row({n:"Còn lại ("+rest.length+" sản phẩm)",c:"",g:"",q:sum(rest,x=>x.q),dt:sum(rest,x=>x.dt),gv:sum(rest,x=>x.gv),lg:sum(rest,x=>x.lg)}):"";
  return `<section class="fbd-card fbd-wide"><h3>${title||"Hiệu quả theo sản phẩm"} · ${n} ngày có số</h3>${tbl(["Sản phẩm","Số lượng","Doanh thu","Giá vốn","Lãi gộp","Biên gộp","% doanh thu"],top.map(row).concat(ro?[ro]:[],[row({n:"Tổng",c:"",g:"",q:T.q,dt:T.dt,gv:T.gv,lg:T.dt-T.gv})]))}<p class="fbd-note">Đơn đã giao thành công, giá vốn theo bảng quy đổi sản phẩm trong Sheet Pancake. Lãi gộp ở đây chưa trừ vận chuyển và quảng cáo (chưa phân bổ theo từng sản phẩm).</p></section>`;
}

/* Vòng cơ cấu chi phí */
function fbdDonut(items,total,mid){
  const r=44,C2=2*Math.PI*r;let off=0;
  const seg=items.filter(x=>x.v>0).map(x=>{const d=x.v/total*C2,o=`<circle cx="60" cy="60" r="${r}" fill="none" stroke="${x.c}" stroke-width="16" stroke-dasharray="${d.toFixed(2)} ${(C2-d).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"><title>${x.n}: ${money(x.v)}</title></circle>`;off+=d;return o}).join("");
  return `<svg class="fbd-donut" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="#eef0f5" stroke-width="16"/>${seg}<text x="60" y="56" text-anchor="middle" font-size="9" fill="#7a8397">Tổng chi phí</text><text x="60" y="72" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${mid}</text></svg>`;
}

