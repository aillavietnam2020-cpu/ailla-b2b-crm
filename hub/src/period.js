/* =====================================================================
   CHỌN THỜI GIAN dùng chung: ngày, tuần, tháng, quý, năm, khoảng tùy chọn
   ===================================================================== */
const FB_ADS_TAX=0.1;
let DAYD=(KDX&&KDX.day)||{tts:{},spe:{},fb:{},ads:{}};
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const pdate=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const vnd=s=>{const [y,m,d]=s.split("-");return `${d}/${m}/${y}`};
function presetRange(k,ref){
  const t=ref?pdate(ref):new Date();t.setHours(0,0,0,0);const wd=(t.getDay()+6)%7,y=t.getFullYear(),mo=t.getMonth(),q=Math.floor(mo/3);
  const R={today:[t,t,"Hôm nay"],yday:[addD(t,-1),addD(t,-1),"Hôm qua"],d7:[addD(t,-6),t,"7 ngày qua"],d30:[addD(t,-29),t,"30 ngày qua"],wk:[addD(t,-wd),addD(t,6-wd),"Tuần này"],lwk:[addD(t,-wd-7),addD(t,-wd-1),"Tuần trước"],mo:[new Date(y,mo,1),new Date(y,mo+1,0),"Tháng này"],lmo:[new Date(y,mo-1,1),new Date(y,mo,0),"Tháng trước"],q:[new Date(y,q*3,1),new Date(y,q*3+3,0),"Quý này"],lq:[new Date(y,q*3-3,1),new Date(y,q*3,0),"Quý trước"],yr:[new Date(y,0,1),new Date(y,11,31),"Năm nay"]}[k];
  return R?{k,from:iso(R[0]),to:iso(R[1]),label:R[2]}:null;
}
let PERIOD=(()=>{try{const s=JSON.parse(sessionStorage.getItem("ailla_period")||"null");if(s&&s.from)return s}catch(e){}return presetRange("mo")})();
function setPeriod(p){PERIOD=p;try{sessionStorage.setItem("ailla_period",JSON.stringify(p))}catch(e){}render()}
const inP=s=>s>=PERIOD.from&&s<=PERIOD.to;
const pLabel=()=>`${PERIOD.label?PERIOD.label+" · ":""}${PERIOD.from===PERIOD.to?vnd(PERIOD.from):vnd(PERIOD.from).slice(0,5)+" – "+vnd(PERIOD.to)}`;
const pDays=()=>{const o=[];for(let d=pdate(PERIOD.from);iso(d)<=PERIOD.to&&o.length<800;d=addD(d,1))o.push(iso(d));return o};
function pSum(src,idx){const D=DAYD[src]||{};let v=0,n=0;for(const k in D)if(inP(k)){v+=+D[k][idx]||0;n++}return {v,n}}
function adsSum(){const out={};for(const nv in DAYD.ads||{}){const a=[0,0,0,0];let n=0;for(const k in DAYD.ads[nv])if(inP(k)){DAYD.ads[nv][k].forEach((x,i)=>a[i]+=+x||0);n++}out[nv]={chi:a[0],data:a[1],don:a[2],dt:a[3],n}}return out}
function coverage(src){const ks=Object.keys(src==="ads"?(Object.values(DAYD.ads||{})[0]||{}):(DAYD[src]||{})).sort();if(!ks.length)return {has:0,from:"",to:""};const days=pDays(),has=days.filter(d=>ks.includes(d)).length;return {has,total:days.length,from:ks[0],to:ks[ks.length-1]}}
const covTxt=src=>{const c=coverage(src);if(!c.from)return "chưa có số theo ngày";return c.has?`${c.has}/${c.total} ngày có số`:`chưa có số trong kỳ này (có từ ${vnd(c.from)} đến ${vnd(c.to)})`};
/* Màu biểu đồ trên nền navy: đổi bảng màu cũ (nền sáng) sang chart theme chung. */
const CHART_MAP={};
const chartC=c=>CHART_MAP[String(c).toLowerCase()]||c;
/* Kỳ chưa có số: chỉ tháng gần nhất đang có số, kèm nút nhảy tới đó */
function lastDataMonth(){let mx="";["tts","spe","fb"].forEach(sn=>{const d=DAYD[sn]||{};for(const k in d)if(k>mx)mx=k});for(const nv in DAYD.ads||{}){for(const k in DAYD.ads[nv])if(k>mx)mx=k}return mx.slice(0,7)}
function emptyPeriodHtml(){return ""}
function seriesBars(srcs,fmt=money){srcs=srcs.map(s=>Object.assign({},s,{c:chartC(s.c)}));const days=pDays().filter(d=>srcs.some(s=>s.get(d)));if(!days.length)return emptyPeriodHtml();
  const byMonth=days.length>62,keys=byMonth?[...new Set(days.map(d=>d.slice(0,7)))]:days,val=(s,k)=>byMonth?sum(days.filter(d=>d.startsWith(k)),d=>s.get(d)||0):(s.get(k)||0);
  const mx=Math.max(1,...keys.flatMap(k=>srcs.map(s=>val(s,k)))),W=Math.max(320,keys.length*srcs.length*9+keys.length*8),Hh=170,gw=W/keys.length,bw=Math.max(3,gw*.78/srcs.length);
  return `<div class="xleg">${srcs.map(s=>`<span><i style="background:${s.c}"></i>${s.n}</span>`).join("")}</div><div class="chartx"><svg viewBox="0 0 ${W} ${Hh+22}" style="min-width:${Math.min(W,1400)}px;width:100%" class="xchart">${[.5,1].map(t=>`<line x1="0" x2="${W}" y1="${Hh-t*(Hh-10)}" y2="${Hh-t*(Hh-10)}" stroke="#e8ebf3"/><text x="2" y="${Hh-t*(Hh-10)-3}" font-size="10" fill="#8a94a8">${fmt(mx*t)}</text>`).join("")}${keys.map((k,i)=>srcs.map((s,j)=>{const v=val(s,k),h=v/mx*(Hh-10);return v?`<rect x="${i*gw+gw*.11+j*bw}" y="${Hh-h}" width="${bw-1}" height="${h}" rx="2" fill="${s.c}"><title>${s.n} ${byMonth?k.slice(5)+"/"+k.slice(0,4):vnd(k)}: ${fmt(v)}</title></rect>`:""}).join("")+((byMonth||keys.length<=16||i%Math.ceil(keys.length/16)===0)?`<text x="${i*gw+gw/2}" y="${Hh+15}" text-anchor="middle" font-size="10" fill="#6b7280">${byMonth?"T"+(+k.slice(5)):k.slice(8)+"/"+k.slice(5,7)}</text>`:"")).join("")}</svg></div>`}
const getD=(src,idx)=>d=>((DAYD[src]||{})[d]||[])[idx]||0;
const getAds=idx=>d=>sum(Object.values(DAYD.ads||{}),o=>((o[d]||[])[idx])||0);
const PP_PRESETS=["today","yday","d7","d30","wk","lwk","mo","lmo","q","lq","yr"];
function periodPicker(){return `<div class="pp"><button class="ppb" id="ppb">${ico("cal")}<span>${esc(pLabel())}</span><i>▾</i></button></div>`}
function bindPeriodPicker(){
  const b=$("#ppb");if(!b)return;
  const L={today:"Hôm nay",yday:"Hôm qua",d7:"7 ngày qua",d30:"30 ngày qua",wk:"Tuần này",lwk:"Tuần trước",mo:"Tháng này",lmo:"Tháng trước",q:"Quý này",lq:"Quý trước",yr:"Năm nay"};
  const presets=PP_PRESETS.map(k=>[k,L[k],()=>{const r=presetRange(k);return {from:r.from,to:r.to}}]);
  b.onclick=e=>{e.stopPropagation();drpOpen(b,{from:PERIOD.from,to:PERIOD.to,preset:PERIOD.k},presets,r=>{
    if(r.preset&&PP_PRESETS.includes(r.preset))setPeriod(presetRange(r.preset));
    else setPeriod({k:"c",from:r.from,to:r.to,label:"Tùy chọn"})})};
}
/* ---------- Khối "trong kỳ đã chọn" cho từng trang ---------- */
function periodBlock(kind){
  const bar=(t,h)=>`<section class="card pblk"><div class="card-h"><h2>${t}</h2><span class="pill p-blu">${esc(pLabel())}</span></div>${h}</section>`;
  if(kind==="fb"){const g=i=>pSum("fb",i).v,tao=g(0),chot=g(1),dtChot=g(6),huy=g(2),hoan=g(3),giao=g(4),dtGiao=g(5),gv=g(7);const A=adsSum(),chi=sum(Object.values(A),a=>a.chi),adsDT=sum(Object.values(A),a=>a.dt),thue=FB_ADS_TAX,chiT=chi*(1+thue),hasAds=Object.values(A).some(a=>a.n);
    const k7=(l,v,h,c)=>`<div class="fk t-${c}"><div class="l">${l}</div><div class="v">${v}</div><div class="h">${h||""}</div></div>`;
    return bar("Facebook — chỉ số chính",`<div class="fk7">${k7("Doanh thu chốt",tr(dtChot),covTxt("fb"),"pnk")}${k7("Chi phí QC sau thuế",hasAds?tr(chiT):"—",hasAds?`<b>${pc(chiT,dtChot)}</b> doanh thu chốt · trước thuế ${tr(chi)}`:"chưa có số Ads trong kỳ","org")}${k7("Số đơn chốt",nf(chot),`trên ${nf(tao)} đơn tạo · chốt ${pc(chot,tao)}`,"blu")}${k7("Tỷ lệ hủy (dự kiến)",pc(huy,tao),nf(huy)+" đơn hủy / đơn tạo","red")}${k7("Tỷ lệ hoàn (dự kiến)",pc(hoan,giao+hoan),nf(hoan)+" đơn hoàn / đơn đã giao xong","red")}${k7("Giá trị TB đơn",chot?nf(Math.round(dtChot/chot))+"đ":"—","doanh thu chốt / đơn chốt","teal")}${k7("CPO",hasAds&&chot?nf(Math.round(chiT/chot))+"đ":"—","chi QC sau thuế / đơn chốt","org")}</div>
    <p class="hint">Doanh thu, đơn lấy từ Pancake theo ngày tạo đơn. Chi phí QC lấy từ <b>báo cáo Digital</b> (Ads Facebook), cộng thuế ${Math.round(thue*100)}%. "Dự kiến" vì còn đơn đang giao. Đối chiếu: Digital báo doanh số Ads ${tr(adsDT)} trong kỳ, Pancake ghi doanh thu chốt ${tr(dtChot)}${adsDT&&dtChot?" (lệch "+pc(Math.abs(adsDT-dtChot),dtChot)+")":""}. Đã giao thành công: ${nf(giao)} đơn · ${tr(dtGiao)} · lãi gộp ${tr(dtGiao-gv)}.</p>
`)}
  if(kind==="tts"){const g=i=>pSum("tts",i).v,gmv=g(0),ads=g(10);return bar("TikTok Shop trong kỳ đã chọn",`<div class="grid kpis">${kpi("GMV",tr(gmv),covTxt("tts"))}${kpi("Đơn hàng",g(1)?nf(g(1)):"—")}${kpi("Video KOC",tr(g(7)),pc(g(7),gmv))}${kpi("Video của shop",tr(g(8)),pc(g(8),gmv))}${kpi("Quảng cáo (+thuế)",tr(ads),"GMV / ads "+(ads?(gmv/ads).toFixed(2):"—"))}</div>${seriesBars([{n:"Video KOC",c:"#e7357b",get:getD("tts",7)},{n:"Video shop",c:"#14213d",get:getD("tts",8)},{n:"Thẻ SP / tìm kiếm",c:"#f59f00",get:getD("tts",9)},{n:"Live",c:"#3b5bdb",get:d=>getD("tts",5)(d)+getD("tts",6)(d)}])}`)}
  if(kind==="spe"){const g=i=>pSum("spe",i).v,dt=g(0);return bar("Shopee trong kỳ đã chọn",`<div class="grid kpis">${kpi("Doanh thu",tr(dt),covTxt("spe"))}${kpi("Số đơn",nf(g(4)))}${kpi("Phí sàn",tr(-g(1)),pc(-g(1),dt))}${kpi("Giá vốn",tr(g(2)))}${kpi("Lãi gộp sau phí sàn",tr(g(3)),pc(g(3),dt))}</div>${seriesBars([{n:"Doanh thu",c:"#f59f00",get:getD("spe",0)},{n:"Lãi gộp",c:"#2f9e44",get:getD("spe",3)}])}<p class="hint">Chưa trừ Shopee Ads (Shopee chỉ có số ads theo tháng).</p>`)}
  if(kind==="ads"){const A=adsSum(),T={chi:0,dt:0,don:0,data:0};Object.values(A).forEach(a=>{T.chi+=a.chi;T.dt+=a.dt;T.don+=a.don;T.data+=a.data});return bar("Ads Facebook trong kỳ đã chọn",`<div class="grid kpis">${kpi("Chi Ads",tr(T.chi),covTxt("ads"))}${kpi("Doanh số",tr(T.dt),"ROAS "+(T.chi?(T.dt/T.chi).toFixed(2):"—"))}${kpi("Đơn chốt",nf(T.don),"chi / đơn "+(T.don?nf(Math.round(T.chi/T.don)):"—"))}${kpi("Data / tin nhắn",nf(T.data),"tỷ lệ chốt "+pc(T.don,T.data))}</div>`)}
  return "";
}

Object.assign(PAGES,{bc_fb:_pb(pBcFb,"fb"),fb_don:_pb(pFbDon,"fb"),fb_sale:pFbSale,fb_ads:m=>{_pb(pAdsHieuQua,"ads")(m);const ph=m.querySelector(".ph h1");if(ph)ph.textContent="Facebook · Quảng cáo"},bc_tiktok:_pb(pBcTikTok,"tts"),bc_shopee:_pb(pBcShopee,"spe"),adshieuqua:_pb(pAdsHieuQua,"ads")});
