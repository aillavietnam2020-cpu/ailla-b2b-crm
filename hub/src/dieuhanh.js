/* =====================================================================
   PHÒNG ĐIỀU HÀNH (trang quản trị, chỉ CEO và kế toán), chị Hoa duyệt 24/10/2026.
   Một chỗ để CEO xem và quyết định, theo 3 loại số: tạm tính hằng ngày · tháng chốt (ngày 8) · tiền.
   Tab: Hôm nay/Tuần · Giá thành & cảnh báo · Tiền & cảnh báo · Lãi theo kênh 3 tầng · Tháng chốt · Thiết lập.
   "Dựng trước nhập sau": chỗ nào chưa có số thì ghi rõ cần ai nhập ở đâu. Tính toán ở dhcalc.js.
   Số tiền, thiết lập lưu ở D().fin (ngăn riêng, chỉ CEO và kế toán đọc được).
   ===================================================================== */
const DH={busy:false,at:0,err:""};
const dhOk=()=>typeof SV!=="undefined"&&SV.acct;
const dhGet=()=>dhCfg(((D().fin||{}).dh));
const dhSave=(why,f)=>{DB.mutate(ME.name,why,dt=>{dt.fin=dt.fin||{};const c=dhCfg(dt.fin.dh);f(c);dt.fin.dh=c});toast("Đã lưu");renderMain()};
const dhPrevMonth=k=>{const [y,m]=k.split("-").map(Number);return m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,"0")}`};
const dhPct=v=>v==null||!isFinite(v)?"—":(v*100).toFixed(1).replace(".",",")+"%";
const dhN=v=>v==null?"—":nf(Math.round(v));
const dhDen=(ok,warn)=>pill(ok?"Ổn":warn?"Theo dõi":"Cần xử lý",ok?"grn":warn?"amb":"red");

async function dhLoad(force){
  if(DH.busy||(!force&&DH.at&&Date.now()-DH.at<60000))return;DH.busy=true;
  const mo=MONTH.key||iso(new Date()).slice(0,7),safe=p=>p.catch(e=>({__err:e.message}));
  try{
    const [cur,prev,sell,debts,ceo]=await Promise.all([safe(kApi("/mh/material-prices?month="+mo)),safe(kApi("/mh/material-prices?month="+dhPrevMonth(mo))),safe(svApi("/api/hub/dieuhanh/sell-prices")),safe(kApi("/mh/debts")),safe(svApi("/api/dashboards/ceo"))]);
    if(typeof khoLoad==="function")await khoLoad();
    Object.assign(DH,{mo,cur:cur.rows||[],prev:prev.rows||[],sell:sell.__err?null:sell,sellErr:sell.__err||"",debts:Array.isArray(debts)?debts:[],ceo:ceo.__err?null:ceo,err:cur.__err||""});
    if(typeof tsbLoadMonths==="function")tsbLoadMonths();
  }catch(e){DH.err=e.message}
  DH.busy=false;DH.at=Date.now();if(PAGE==="dh"||PAGE==="exec")renderMain();
}
/* ---------- Giá thành: dùng định mức kho + giá nguyên liệu tháng này ---------- */
function dhCalcGia(){
  const cfg=dhGet(),ng=cfg.nguong,nvl=dhNvl(DH.cur,DH.prev,ng.nvlTang);
  const pmap=new Map((DH.cur||[]).map(r=>[r.item,r])),pNew=c=>{const r=pmap.get(c);return r?r.last_price:0},pAvg=c=>{const r=pmap.get(c);return r?(r.avg_price||r.last_price):0};
  const bom=(typeof KHO!=="undefined"&&KHO.bom)||new Map(),items=(typeof KHO!=="undefined"&&KHO.items)||new Map();
  const codes=[...bom.keys()].filter(c=>{const i=items.get(c);return !i||i.active!==0}),gt=dhGiaThanh(codes,bom,pNew,pAvg),gmap=new Map(gt.map(g=>[g.code,g]));
  const S=D().skus||[],kt=c=>{const s=S.find(x=>String(x.ma).toLowerCase()===String(c).toLowerCase());if(!s||!s.giaVon)return null;const ms=Object.keys(s.giaVon).sort();return ms.length?+s.giaVon[ms[ms.length-1]]:null};
  gt.forEach(g=>{g.kt=kt(g.code);const i=items.get(g.code);g.name=i?i.name:g.code;g.unit=i?i.unit:""});
  let sell=[];
  if(DH.sell){const map=new Map((DH.sell.map||[]).map(r=>[String(r.crm_sku).toLowerCase(),r])),tn=new Map((DH.sell.tiers||[]).map(t=>[t.id,t.name]));
    const lines=(DH.sell.tier_prices||[]).map(p=>({kind:"tier",who:tn.get(p.tier_id)||p.tier_id,sku:p.sku,name:p.name,price:p.amount})).concat((DH.sell.customer_prices||[]).map(p=>({kind:"kh",who:p.customer,sku:p.sku,name:p.name,price:p.amount})));
    sell=dhSellCheck(lines,map,c=>gmap.get(c)||null,ng)}
  return {cfg,nvl,gt,sell,up:nvl.filter(x=>x.up),red:sell.filter(x=>x.red)};
}
/* ---------- Tiền ---------- */
function dhCalcTien(){
  const cfg=dhGet(),last=cfg.tien.slice().sort((a,b)=>a.ngay<b.ngay?1:-1)[0]||null;
  const tra=(DH.debts||[]).reduce((a,r)=>a+Math.max(0,+r.balance||0),0),thu=DH.ceo?(+DH.ceo.official_debt||0):null;
  const pAvg=new Map((DH.cur||[]).map(r=>[r.item,r.avg_price||r.last_price]));let ton=0,tonThieu=0;
  if(typeof KHO!=="undefined"&&KHO.stock)KHO.stock.forEach((q,c)=>{if(q>0){const p=pAvg.get(c);if(p)ton+=q*p;else tonThieu++}});
  const d=D(),pm=dhPrevMonth(MONTH.key),chiThang=(d.costs||[]).filter(c=>c.thang===pm).reduce((a,c)=>a+(+c.tien||0),0),chiNgay=cfg.chiNgay||(chiThang?chiThang/30:0);
  const vi=last?(+last.viTT||0)+(+last.viSPE||0):0,R=dhRunway({tien:last?last.tien:0,vi,thu:thu||0,tra,chiNgay});
  return {cfg,last,tra,thu,ton,tonThieu,chiNgay,chiTu:cfg.chiNgay?"nhập tay":chiThang?"chi phí tháng "+pm.slice(5)+" ÷ 30":"",vi,R};
}
/* ---------- Lãi tạm tính trong kỳ chọn ---------- */
/* Tỷ lệ tạm tính lấy từ số thật (trừ khi người dùng tự nhập ở Thiết lập):
   Facebook: doanh thu giao thành công ÷ doanh thu chốt của các ngày đã đủ 14 ngày (đơn đã giao xong), 60 ngày gần nhất;
   TikTok: doanh thu thuần ÷ GMV, giá vốn và phí sàn của tháng đã lưu gần nhất. */
function dhAutoRates(cfg){
  const K=JSON.parse(JSON.stringify(cfg.kenh)),src={};
  try{const F=(typeof DAYD!=="undefined"&&DAYD.fb)||{},ks=Object.keys(F).sort(),last=ks[ks.length-1];
    if(last&&!K.fb.tay){const cut=iso(addD(pdate(last),-14)),from=iso(addD(pdate(cut),-60));let c=0,g=0,n=0;ks.forEach(k=>{if(k>from&&k<=cut){c+=+F[k][6]||0;g+=+F[k][5]||0;n++}});if(c>0&&n>=7){K.fb.thuan=g/c;src.fb=`giao thành công thật ${dhPct(g/c)} (${n} ngày đã giao xong)`}}}catch(e){}
  try{if(!K.tts.tay&&typeof TSB!=="undefined"&&TSB.months&&TSB.months.length){const L=TSB.months[TSB.months.length-1],s=L.summary;let gmv=0;Object.entries((TSB.all&&TSB.all.days)||{}).forEach(([d,x])=>{if(d.startsWith(L.ky)&&x.km)gmv+=x.km.gmv||0});
    if(s.dt&&gmv){K.tts.thuan=s.dt/gmv;K.tts.gv=s.gv/s.dt;K.tts.phi=-s.phi/s.dt;src.tts=`tỷ lệ tháng ${L.ky.slice(5)}/${L.ky.slice(0,4)} đã lưu`}}}catch(e){}
  ["tts","spe","fb"].forEach(k=>{if(K[k].tay)src[k]="tỷ lệ nhập tay ở Thiết lập";else if(!src[k])src[k]=k==="spe"?"doanh thu Shopee đã trừ hủy/hoàn":"tỷ lệ mặc định (chưa đủ số thật)"});
  return {K,src};
}
function dhCalcNgay(){
  const cfg=dhGet(),AR=dhAutoRates(cfg),n=pDays().length,g=(s,i)=>pSum(s,i).v,A=typeof adsSum==="function"?adsSum():{},fbAds=Object.values(A).reduce((a,x)=>a+(x.chi||0),0)*(1+(typeof FB_ADS_TAX!=="undefined"?FB_ADS_TAX:0.1));
  const rows=[["tts",{ban:g("tts",0),don:g("tts",1),ads:g("tts",10)},"GMV cả shop (Key metrics)"],["spe",{ban:g("spe",0),don:g("spe",4),ads:0,gv:g("spe",2),phi:-g("spe",1)},"doanh thu Shopee theo ngày"],["fb",{ban:g("fb",6),don:g("fb",1),ads:fbAds,gv:g("fb",7)},"doanh thu chốt Pancake"]]
   .map(([ch,x,src])=>({ch,n:(DH_CH.find(c=>c[0]===ch)||[])[1],src,tyle:AR.src[ch],co:x.ban>0,...dhTamTinh(x,AR.K[ch]||{thuan:1,gv:0,phi:0},dhLuongKenh(cfg.luong,ch,n)),ban:x.ban}));
  return {cfg,n,rows,AR};
}
/* ---------- Lãi theo kênh 3 tầng (tháng trọn) ---------- */
function dhCalcBaTang(mo){
  const cfg=dhGet(),[y,m]=mo.split("-").map(Number),from=mo+"-01",to=iso(new Date(y,m,0)),N=execNums(from,to),S=(typeof TSB!=="undefined"&&TSB.sum&&TSB.sum[mo])||null,d=D();
  const rows=[];
  if(S)rows.push({ch:"tts",n:"TikTok Shop",dt:S.dt,lai:S.lai,don:S.don});else if(N.tt)rows.push({ch:"tts",n:"TikTok Shop",dt:N.tt,lai:null,don:N.n.tts,thieu:"chưa có báo cáo tháng (Doanh thu › TikTok)"});
  if(N.fbGiao)rows.push({ch:"fb",n:"Facebook",dt:N.fbGiao,lai:N.L.fb,don:rSum("fb",4,from,to).v});
  if(N.spDT)rows.push({ch:"spe",n:"Shopee",dt:N.spDT,lai:N.L.spe,don:rSum("spe",4,from,to).v});
  const cats=new Map((d.costCats||[]).map(c=>[c.k,c])),coLuong=cfg.luong.length>0;
  const chungL=(d.costs||[]).filter(c=>c.thang===mo).filter(c=>{const k=cats.get(c.cat)||{};if(k.phanBo==="Kênh")return false;if(coLuong&&["LUONG","THUONG","BH"].includes(c.cat))return false;return true});
  const chung=chungL.reduce((a,c)=>a+(+c.tien||0),0),ok=rows.filter(r=>r.lai!=null);
  return {cfg,mo,rows:dhBaTang(ok,cfg,chung).concat(rows.filter(r=>r.lai==null)),chung,nChung:chungL.length,coLuong};
}

/* ---------- Giao diện ---------- */
/* ---------- Tổng quan: một màn hình, 3 mảng kinh doanh (Bán lẻ · Phân phối · Gia công) ---------- */
(()=>{try{if(document.getElementById("dh-css"))return;const st=document.createElement("style");st.id="dh-css";st.textContent=`
.xkstrip .xk{border-radius:0}
.dh3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:16px}
.dhm{background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);padding:16px 18px;text-align:left;font:inherit;color:inherit;cursor:pointer;display:flex;flex-direction:column;gap:6px}
.dhm:hover{border-color:#c5cee0}
.dhm-h{display:flex;align-items:center;gap:10px}.dhm-h .kic{flex:none}.dhm-h b{font-size:16px}.dhm-h small{display:block;color:var(--muted);font-size:12.5px;font-weight:500}
.dhm-v{font-size:28px;font-weight:800;letter-spacing:-.02em;margin-top:4px}
.dhm-l{font-size:13.5px;color:var(--muted)}.dhm-l b{color:#087a55}.dhm-l b.neg{color:#c92a2a}
.dhb{display:grid;grid-template-columns:110px 1fr 76px;gap:6px 8px;align-items:center;font-size:13px;margin-top:6px}
.dhb i{display:block;height:8px;border-radius:4px;background:var(--dhc,#2f6fde)}.dhb span:nth-child(3n){text-align:right;font-weight:600}
.dhm-n{font-size:12.5px;color:#9a5b00;background:#fff6e5;border-radius:8px;padding:6px 9px;margin-top:auto}
.dhm-ok{font-size:12.5px;color:#087a55;background:#e9f7ef;border-radius:8px;padding:6px 9px;margin-top:auto}
@media (max-width:1100px){.dh3{grid-template-columns:1fr}}`;document.head.appendChild(st)}catch(e){}})();
async function dhLoadPrevB2b(pr){const key=pr.from+"|"+pr.to;if(DH.b2bPrevKey===key)return;DH.b2bPrevKey=key;DH.b2bPrev=null;try{const r=await svApi("/api/dashboards/b2b-sku?from="+pr.from+"&to="+pr.to);const o={};(r.months||[]).forEach(x=>{o[x.channel]=(o[x.channel]||0)+(+x.revenue||0)});DH.b2bPrev=o}catch(e){DH.b2bPrev={}}if(PAGE==="dh")renderMain()}
function dhTongQuan(){
  if(typeof b2bLoad==="function")b2bLoad();
  const full=(()=>{const ms=[];for(let d=pdate(PERIOD.from.slice(0,7)+"-01");iso(d)<=PERIOD.to;d=new Date(d.getFullYear(),d.getMonth()+1,1))ms.push(iso(d).slice(0,7));return ms.every(k=>fullMonth(k,PERIOD.from,PERIOD.to))?ms:null})();
  /* Chọn trọn tháng thì so với đúng số tháng liền trước; không thì so với số ngày liền trước. */
  const pr=full?(()=>{const f=pdate(PERIOD.from),a=new Date(f.getFullYear(),f.getMonth()-full.length,1),b=addD(f,-1);return {from:iso(a),to:iso(b)}})():prevRange();dhLoadPrevB2b(pr);
  const C=dhCalcNgay(),P=execNums(pr.from,pr.to);
  const S=typeof TSB!=="undefined"&&TSB.sum?TSB.sum:{},ttM=full&&full.every(k=>S[k])?full.map(k=>S[k]):null;
  const R=C.rows.map(r=>r.ch==="tts"&&ttM?{...r,dt:ttM.reduce((a,x)=>a+x.dt,0),t2:ttM.reduce((a,x)=>a+x.lai,0),chot:1,co:true}:r);
  const pv={tts:P.tt*((C.cfg.kenh.tts||{}).thuan||1),fb:P.fbDT*((C.cfg.kenh.fb||{}).thuan||1),spe:P.spDT};
  /* Kỳ trước thiếu số của kênh nào đang có số thì không so (so lệch kênh sẽ ra % ảo). */
  const leOK=R.filter(r=>r.co).every(r=>(P.n[r.ch]||0)>0);
  const le={dt:R.reduce((a,r)=>a+(r.co?r.dt:0),0),lai:R.reduce((a,r)=>a+(r.co?r.t2:0),0),prev:leOK?pv.tts+pv.fb+pv.spe:0};
  const B=typeof b2bChannel==="function"?b2bChannel("B2B"):null,G=typeof b2bChannel==="function"?b2bChannel("GIA_CONG"):null,bp=DH.b2bPrev||{};
  if(!B&&!DH.b2bWait){DH.b2bWait=1;setTimeout(()=>{DH.b2bWait=0;if(PAGE==="dh")renderMain()},1200)}
  /* Dòng xuất giá 0đ mà giá vốn lớn (trên 5 triệu) gần như chắc là nhập sai số lượng hoặc đơn vị (thùng/chai):
     tạm loại khỏi lãi để số không bị méo, và đưa vào "Cần xử lý" để kế toán kiểm đơn. */
  const susp=ch=>{if(typeof B2BR==="undefined"||!B2BR.data)return [];return B2BR.data.lines.filter(l=>l.channel===ch&&!(+l.revenue>0)).map(l=>{const u=b2bUnitCost(l.sku,l.month);return {...l,cost:u==null?0:u*(+l.qty||0)}}).filter(l=>l.cost>5e6)};
  const sB=susp("B2B"),sG=susp("GIA_CONG"),sum0=a=>a.reduce((x,l)=>x+l.cost,0);
  const pp={dt:B&&B.has?B.net:0,lai:B&&B.has?B.gross+sum0(sB):0,prev:bp.B2B||0},gc={dt:G&&G.has?G.net:0,lai:G&&G.has?G.gross+sum0(sG):0,prev:bp.GIA_CONG||0};
  const tong=le.dt+pp.dt+gc.dt,lai=le.lai+pp.lai+gc.lai,tongP=leOK&&(!pp.dt||pp.prev)?le.prev+pp.prev+gc.prev:0;
  const Gc=dhCalcGia(),T=dhCalcTien(),todo=[];
  if(ttM){const td=(TSB.data&&Object.values(TSB.data).find(x=>x&&x.data&&full.includes(x.data.ky)));const t=td&&td.data&&td.data.todo;if(t&&(t.noMap.length||t.miss.length))todo.push(["red",`TikTok: ${t.noMap.length} mã chưa quy đổi, ${t.miss.length} mã thiếu giá vốn`,"kế toán","bc_tiktok"])}
  R.filter(r=>r.co&&r.dt&&r.ads/r.dt>0.25).forEach(r=>todo.push(["amb",`${r.n}: quảng cáo ${dhPct(r.ads/r.dt)} doanh thu`,"team "+r.n,"dh"]));
  R.filter(r=>!r.co).forEach(r=>todo.push(["amb",`${r.n}: chưa có số trong kỳ`,r.ch==="spe"?"team Shopee tải file":"tải số liệu","bc_"+(r.ch==="tts"?"tiktok":r.ch==="spe"?"shopee":"fb")]));
  sB.concat(sG).forEach(l=>todo.unshift(["red",`${l.channel==="GIA_CONG"?"Gia công":"Phân phối"}: ${l.name} (${l.sku}) xuất ${nf(l.qty)} giá 0đ, giá vốn ${tr(l.cost)} — nghi nhập sai, đã tạm loại khỏi lãi`,"kế toán kiểm đơn",l.channel==="GIA_CONG"?"bc_gc":"bc_b2b"]));
  if(B&&B.has&&B.cover<0.95)todo.push(["amb",`Phân phối: ${dhPct(1-B.cover)} doanh thu chưa có giá vốn`,"kế toán","bc_b2b"]);
  if(Gc.up.length)todo.push(["red",`${Gc.up.length} nguyên liệu tăng giá`,"kế toán, sản xuất","dh"]);
  if(Gc.red.length)todo.push(["red",`${Gc.red.length} giá bán / báo giá gia công dưới ngưỡng`,"CEO quyết giá","dh"]);
  if(!T.last)todo.push(["amb","Chưa nhập số dư tiền tuần này","kế toán","dh"]);
  const bars=(rows,col)=>{const mx=Math.max(1,...rows.map(x=>x[1]));return rows.length?`<div class="dhb" style="--dhc:${col}">${rows.map(([n,v])=>`<span>${esc(n)}</span><i style="width:${Math.max(2,v/mx*100)}%"></i><span>${tr(v)}</span>`).join("")}</div>`:""};
  const chg=(a,b)=>!b?`<span class="kchg">kỳ trước chưa đủ số</span>`:exChg(a,b);
  const laiTxt=(v,dt,ghi)=>v==null?`<span class="dhm-l">${ghi||"chưa tính được lãi"}</span>`:`<span class="dhm-l">lãi <b class="${v<0?"neg":""}">${tr(v)}</b> · ${dhPct(dt?v/dt:null)}${ghi?" · "+ghi:""}</span>`;
  const leNote=R.filter(r=>!r.co).map(r=>r.n).join(", "),grpTop=g=>g&&g.grp?[...g.grp.values()].sort((a,b)=>b.rev-a.rev).slice(0,3).map(x=>[x.n||"Khác",x.rev]):[];
  const K=[["money","Tổng doanh thu",tr(tong),chg(tong,tongP)],["trend","Lãi đóng góp",tr(lai),`<span class="kchg">${dhPct(tong?lai/tong:null)} doanh thu</span>`],["bag","Bán lẻ",tr(le.dt),chg(le.dt,le.prev)],["box","Phân phối",tr(pp.dt),chg(pp.dt,pp.prev)],["fac","Gia công",tr(gc.dt),chg(gc.dt,gc.prev)],["wallet","Tiền đủ chạy",T.R.ngay==null?"—":nf(T.R.ngay)+" ngày",`<span class="kchg">${T.last?"số dư "+vnd(T.last.ngay):"chưa nhập số dư"}</span>`]];
  return `<section class="xkstrip" aria-label="Chỉ số chính">${K.map(([ic,l,v,h])=>`<div class="xk ro${v==="—"?" mut":""}"><span class="xkh"><span class="kic k-${ic}">${ico(ic)}</span><span class="xkl">${l}</span></span><span class="xkv numeric">${v==="—"?"Chưa có số":v}</span><span class="xkm">${h}</span></div>`).join("")}</section>
  <div class="dh3">
   <button type="button" class="dhm" data-go="bc_tiktok"><div class="dhm-h"><span class="kic k-bag">${ico("bag")}</span><div><b>Bán lẻ</b><small>TikTok · Facebook · Shopee</small></div></div><div class="dhm-v numeric">${tr(le.dt)}</div>${chg(le.dt,le.prev)}${laiTxt(le.lai,le.dt,R.some(r=>r.co&&!r.chot)?"tạm tính":"")}
    ${bars(R.filter(r=>r.co).map(r=>[r.n,r.dt]),"#e7357b")}<div class="hint" style="font-size:12px;line-height:1.45">${R.filter(r=>r.co).map(r=>esc(r.n+": "+(r.chot?"số tháng đã lưu":r.tyle))).join("<br>")}</div>${leNote?`<div class="dhm-n">Chưa có số: ${esc(leNote)}</div>`:`<div class="dhm-ok">Đủ số các kênh</div>`}</button>
   <button type="button" class="dhm" data-go="bc_b2b"><div class="dhm-h"><span class="kic k-box">${ico("box")}</span><div><b>Phân phối</b><small>NPP · đại lý (CRM B2B)</small></div></div><div class="dhm-v numeric">${B?tr(pp.dt):"…"}</div>${chg(pp.dt,pp.prev)}${B&&B.has?laiTxt(pp.lai,pp.dt,"sau giá vốn"):laiTxt(null,0,B?"kỳ này chưa có đơn":"đang tải")}
    ${bars(grpTop(B),"#2f9e44")}${sB.length?`<div class="dhm-n" style="background:#fdecea;color:#b42318">Đã tạm loại ${tr(sum0(sB))} giá vốn của ${sB.length} dòng giá 0đ nghi nhập sai</div>`:""}${B&&B.has&&B.cover<0.95?`<div class="dhm-n">${dhPct(1-B.cover)} doanh thu chưa có giá vốn (đang ước tính)</div>`:B&&B.has?`<div class="dhm-ok">Đủ giá vốn</div>`:""}</button>
   <button type="button" class="dhm" data-go="bc_gc"><div class="dhm-h"><span class="kic k-fac">${ico("fac")}</span><div><b>Gia công</b><small>khách đặt sản xuất</small></div></div><div class="dhm-v numeric">${G?tr(gc.dt):"…"}</div>${chg(gc.dt,gc.prev)}${G&&G.has?laiTxt(gc.lai,gc.dt,"sau giá vốn"):laiTxt(null,0,G?"kỳ này chưa có đơn gia công":"đang tải")}
    ${bars(grpTop(G),"#f59f00")}${Gc.red.filter(x=>x.kind==="kh").length?`<div class="dhm-n">${Gc.red.filter(x=>x.kind==="kh").length} báo giá dưới ngưỡng biên</div>`:`<div class="dhm-ok">Báo giá chưa có cảnh báo</div>`}</button>
  </div>
  <div class="xbot">
   <section class="card"><div class="card-h"><h2>Cần xử lý</h2>${pill(todo.length,todo.length?"red":"grn")}</div>${todo.length?todo.map(t=>`<button type="button" class="xal1 lnk" data-go="${t[3]}" style="width:100%;text-align:left">${exDot(t[0])}<span>${esc(t[1])} <span class="hint">· ${esc(t[2])}</span></span></button>`).join(""):`<p class="empty">Không có việc nào.</p>`}</section>
   <section class="card"><div class="card-h"><h2>Tiền</h2><button class="lnk" data-sub="tien">Chi tiết →</button></div>
    ${[["Đang có (ngân hàng, tiền mặt, ví sàn)",T.last?tr(T.R.co):"chưa nhập"],["Khách còn nợ",T.thu==null?"—":tr(T.thu)],["Nợ nhà cung cấp",tr(T.tra)],["Tiền nằm trong hàng tồn",T.ton?tr(T.ton):"—"],["Đủ chạy",T.R.ngay==null?"— ngày":nf(T.R.ngay)+" ngày"]].map(([l,v])=>`<div class="xal1 ok" style="display:flex;justify-content:space-between"><span>${l}</span><b style="color:#14213d">${v}</b></div>`).join("")}</section>
  </div>
  <p class="hint">${esc(pLabel())} · so với ${vnd(pr.from)} – ${vnd(pr.to)}. Bán lẻ: doanh thu dự kiến sau hủy/hoàn và lãi tạm tính${ttM?"; TikTok dùng số tháng đã chốt":""}. Phân phối, gia công: đơn đã duyệt trong CRM, lãi sau giá vốn (chưa trừ chi phí chung). Bấm từng mảng để xem chi tiết.</p>`;
}
const DH_TABS=[["tongquan","Tổng quan"],["homnay","Lãi tạm tính theo kênh"],["gia","Giá thành & cảnh báo"],["tien","Tiền & cảnh báo"],["batang","Lãi theo kênh 3 tầng"],["thang","Tháng chốt"],["caidat","Thiết lập"]];
function dhNeed(t,ai){return `<div class="note amb"><b>Chưa có số:</b> ${t}${ai?` <span class="hint">· ${ai}</span>`:""}</div>`}
function dhTabNgay(){
  const C=dhCalcNgay(),co=C.rows.filter(r=>r.co),T=co.reduce((a,r)=>({dt:a.dt+r.dt,t2:a.t2+r.t2,ads:a.ads+r.ads}),{dt:0,t2:0,ads:0}),ng=C.cfg.nguong;
  return `<div class="grid kpis">${kpi("Doanh thu dự kiến",tr(T.dt),"đã trừ hủy/hoàn dự kiến · "+C.n+" ngày")}${kpi("Lãi tạm tính",tr(T.t2),dhPct(T.dt?T.t2/T.dt:null)+" doanh thu",T.t2<0?"var(--red)":"var(--green)")}${kpi("Quảng cáo đã chi",tr(T.ads),dhPct(T.dt?T.ads/T.dt:null)+" doanh thu")}</div>
  <section class="card"><div class="card-h"><h2>Lãi tạm tính theo kênh</h2><span class="pill p-blu">${esc(pLabel())}</span></div>
  ${tbl(["Kênh","Doanh số ghi nhận","Doanh thu dự kiến","Giá vốn","Phí sàn","Quảng cáo","Đóng gói","Lương team","Lãi tạm tính","Biên",""],C.rows.map(r=>r.co?`<tr><td><b>${r.n}</b><br><small class="hint">${esc(r.src)}</small></td><td class="n">${dhN(r.ban)}</td><td class="n">${dhN(r.dt)}</td><td class="n">${dhN(r.gv)}</td><td class="n">${dhN(r.phi)}</td><td class="n">${dhN(r.ads)}</td><td class="n">${r.dg?dhN(r.dg):"—"}</td><td class="n">${r.luong?dhN(r.luong):"—"}</td><td class="n"><b class="${r.t2<0?"t-red":""}">${dhN(r.t2)}</b></td><td class="n">${dhPct(r.bien)}</td><td>${dhDen(r.bien>=ng.bienKenh,r.bien>=0)}</td></tr>`:`<tr><td><b>${r.n}</b></td><td colspan="10" class="hint">Kỳ này chưa có số ${esc(r.src)}</td></tr>`))}
  <p class="hint">Số tạm tính để điều chỉnh ngay trong tháng: doanh thu nhân tỷ lệ còn lại sau hủy/hoàn dự kiến, giá vốn và phí sàn theo tỷ lệ (Shopee, Facebook dùng số thật nếu có), quảng cáo theo số đã chi, lương chia theo ngày. Ngày 8 tháng sau có số chốt ở tab "Tháng chốt".${C.cfg.luong.length?"":" Chưa trừ lương team: nhập ở tab Thiết lập."}</p></section>`;
}
function dhTabGia(){
  const G=dhCalcGia(),ng=G.cfg.nguong;
  const nvlT=G.nvl.length?tbl(["Nguyên vật liệu","ĐVT","Giá mới nhất","So với","Tăng / giảm","Giá bình quân (kế toán)","Mới so bình quân",""],G.nvl.slice(0,60).map(x=>`<tr><td><b>${esc(x.name)}</b><br><small class="mono hint">${esc(x.item)}</small></td><td>${esc(x.unit)}</td><td class="n">${dhN(x.last)}</td><td class="n">${x.base?dhN(x.base):"—"}</td><td class="n"><b class="${x.chg>0?"t-red":""}">${x.base?(x.chg>0?"+":"")+dhPct(x.chg):"—"}</b></td><td class="n">${dhN(x.avg)}</td><td class="n">${(x.gap>0?"+":"")+dhPct(x.gap)}</td><td>${x.up?pill("Tăng giá","red"):""}</td></tr>`)):dhNeed("tháng này chưa có giá nhập nguyên liệu nào trên web.","Kế toán nhập đơn giá ở Mua hàng (nhận hàng, chứng từ nhà cung cấp) hoặc phiếu nhập kho; giá vào là web tự so.");
  const gtR=G.gt.filter(g=>g.moi>0).sort((a,b)=>b.chenh-a.chenh);
  const gtT=gtR.length?tbl(["Sản phẩm","ĐVT","Giá thành theo giá mới","Giá thành bình quân","Chênh","Giá vốn SKU (kế toán)","Ghi chú"],gtR.slice(0,80).map(g=>`<tr><td><b>${esc(g.name)}</b><br><small class="mono hint">${esc(g.code)}</small></td><td>${esc(g.unit)}</td><td class="n"><b>${dhN(g.moi)}</b></td><td class="n">${dhN(g.bq)}</td><td class="n ${g.chenh>0.001?"t-red":""}">${(g.chenh>0?"+":"")+dhPct(g.chenh)}</td><td class="n">${g.kt?dhN(g.kt):"—"}</td><td class="hint">${g.miss.length?"Thiếu giá "+g.miss.length+" vật tư: "+esc(g.miss.slice(0,3).join(", "))+(g.miss.length>3?"…":""):""}</td></tr>`)):dhNeed(`${G.gt.length} sản phẩm đã có định mức nhưng chưa tính được giá thành vì vật tư chưa có giá nhập.`,"Có giá nhập nguyên liệu là cột này tự ra.");
  const red=G.sell.filter(x=>x.red),why=G.sell.filter(x=>x.why);
  const sellT=!DH.sell?dhNeed("không tải được bảng giá bán.",DH.sellErr):red.length?tbl(["Bảng giá / khách","Sản phẩm","Giá bán","Giá thành mới","Biên","Ngưỡng","Giá tối thiểu nên đặt",""],red.map(x=>`<tr><td>${x.kind==="kh"?pill("Gia công","amb"):pill("Bảng giá","blu")} ${esc(x.who)}</td><td><b>${esc(x.name)}</b><br><small class="mono hint">${esc(x.sku)}</small></td><td class="n">${dhN(x.price)}</td><td class="n">${dhN(x.cost)}</td><td class="n"><b class="t-red">${dhPct(x.bien)}</b></td><td class="n">${dhPct(x.thr)}</td><td class="n"><b>${dhN(x.min)}</b></td><td>${x.lo?pill("Bán dưới giá thành","red"):pill("Biên mỏng","amb")}</td></tr>`)):`<p class="empty">${G.sell.some(x=>x.bien!=null)?"Không có giá bán nào dưới ngưỡng biên.":"Chưa so được giá bán nào với giá thành (cần giá nhập nguyên liệu và định mức)."}</p>`;
  return `<div class="grid kpis">${kpi("Nguyên liệu tăng giá",G.up.length?nf(G.up.length):"0","tăng từ "+dhPct(ng.nvlTang)+" so với lần nhập trước",G.up.length?"var(--red)":"")}${kpi("Giá bán / báo giá dưới ngưỡng",nf(red.length),"bảng giá cấp dưới "+dhPct(ng.bienTier)+" · gia công dưới "+dhPct(ng.bienGC),red.length?"var(--red)":"")}${kpi("Sản phẩm có giá thành",nf(gtR.length)+" / "+nf(G.gt.length),"theo định mức kho")}${kpi("Dòng giá chưa so được",nf(why.length),"thiếu nối mã, định mức hoặc giá")}</div>
  <section class="card"><div class="card-h"><h2>Giá bán, báo giá gia công dưới ngưỡng biên</h2></div><p class="hint">So giá đang áp dụng với giá thành tính theo giá nhập nguyên liệu mới nhất. Giá tối thiểu = giá thành ÷ (1 − ngưỡng biên).</p>${sellT}</section>
  <section class="card"><div class="card-h"><h2>Giá nguyên liệu tháng ${esc((DH.mo||"").slice(5))}</h2></div>${nvlT}</section>
  <section class="card"><div class="card-h"><h2>Giá thành: giá mới so với bình quân</h2><span class="hint">giá mới dùng để báo giá; bình quân là cách kế toán lên sổ</span></div>${gtT}</section>
  ${why.length?`<section class="card"><div class="card-h"><h2>Dòng giá chưa so được (${why.length})</h2></div>${tbl(["Bảng giá / khách","Sản phẩm","Giá bán","Lý do"],why.slice(0,100).map(x=>`<tr><td>${esc(x.who)}</td><td>${esc(x.name)} <small class="mono hint">${esc(x.sku)}</small></td><td class="n">${dhN(x.price)}</td><td class="hint">${esc(x.why)}</td></tr>`))}</section>`:""}`;
}
function dhTabTien(){
  const T=dhCalcTien(),ng=T.cfg.nguong,R=T.R,l=T.last;
  const den=R.ngay==null?pill("Chưa tính được","gry"):R.ngay<ng.runway?pill("Dưới "+ng.runway+" ngày","red"):pill("Ổn","grn");
  return `<div class="grid kpis">${kpi("Tiền đang có",l?tr(R.co):"—",l?"ngân hàng, tiền mặt, ví sàn · ngày "+vnd(l.ngay):"chưa nhập số dư")}${kpi("Đủ chạy",R.ngay==null?"—":nf(R.ngay)+" ngày",R.ngay2!=null?"tính cả nợ phải thu, phải trả: "+nf(R.ngay2)+" ngày":"",R.ngay!=null&&R.ngay<ng.runway?"var(--red)":"")}${kpi("Khách còn nợ",T.thu==null?"—":tr(T.thu),"công nợ chính thức (CRM)")}${kpi("Nợ nhà cung cấp",tr(T.tra),(DH.debts||[]).filter(r=>r.balance>0).length+" nhà cung cấp")}${kpi("Tiền nằm trong hàng tồn",T.ton?tr(T.ton):"—",T.tonThieu?T.tonThieu+" mã tồn chưa có giá":"theo giá bình quân")}</div>
  <section class="card"><div class="card-h"><h2>Tiền đủ chạy bao lâu</h2>${den}</div>
   ${tbl(["Khoản","Số tiền","Lấy từ"],[["Ngân hàng + tiền mặt",l?l.tien:null,l?"kế toán nhập ngày "+vnd(l.ngay):"chưa nhập"],["Ví TikTok Shop chưa rút",l?l.viTT:null,"kế toán nhập"],["Ví Shopee chưa rút",l?l.viSPE:null,"kế toán nhập"],["Khách còn nợ (sắp về)",T.thu,"CRM B2B"],["Nợ nhà cung cấp (sắp trả)",-T.tra,"Mua hàng › Công nợ nhà cung cấp"],["Chi trung bình mỗi ngày",T.chiNgay||null,T.chiTu||"chưa có: nhập ở Thiết lập hoặc Chi phí theo tháng"]].map(r=>`<tr><td>${r[0]}</td><td class="n">${r[1]==null?"—":dhN(r[1])}</td><td class="hint">${esc(r[2])}</td></tr>`))}
   ${R.ngay==null?dhNeed("cần số dư tiền và chi trung bình mỗi ngày để tính.","Kế toán nhập số dư hằng tuần ở ô dưới; chi mỗi ngày nhập ở Thiết lập."):""}</section>
  <section class="card"><div class="card-h"><h2>Nhập số dư tiền (hằng tuần)</h2></div><form class="frm" id="dh-tf"><div class="row4"><label class="field">Ngày<input type="date" id="dh-t-d" value="${iso(new Date())}" required></label><label class="field">Ngân hàng + tiền mặt (đ)<input type="number" id="dh-t-t" min="0" required></label><label class="field">Ví TikTok Shop (đ)<input type="number" id="dh-t-v1" min="0"></label><label class="field">Ví Shopee (đ)<input type="number" id="dh-t-v2" min="0"></label></div><label class="field">Ghi chú<input id="dh-t-n"></label><button class="btn pri">Lưu số dư</button></form>
   ${T.cfg.tien.length?tbl(["Ngày","Ngân hàng + tiền mặt","Ví TikTok","Ví Shopee","Ghi chú",""],T.cfg.tien.slice().sort((a,b)=>a.ngay<b.ngay?1:-1).slice(0,12).map(x=>`<tr><td>${vnd(x.ngay)}</td><td class="n">${dhN(x.tien)}</td><td class="n">${dhN(x.viTT)}</td><td class="n">${dhN(x.viSPE)}</td><td>${esc(x.note||"")}</td><td><button class="lnk" data-dhtx="${esc(x.id)}">Xóa</button></td></tr>`)):""}</section>
  <section class="card"><div class="card-h"><h2>Nợ nhà cung cấp</h2><button class="lnk" data-go="mh_no">Mở Công nợ nhà cung cấp →</button></div>${(DH.debts||[]).filter(r=>r.balance>0).length?tbl(["Nhà cung cấp","Còn nợ"],(DH.debts||[]).filter(r=>r.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,15).map(r=>`<tr><td>${esc(r.name)}</td><td class="n">${dhN(r.balance)}</td></tr>`)):`<p class="empty">Chưa có nợ nhà cung cấp nào trên web.</p>`}</section>`;
}
function dhTabBaTang(){
  const months=[...new Set(Object.keys((DAYD&&DAYD.fb)||{}).concat(Object.keys((DAYD&&DAYD.tts)||{})).map(k=>k.slice(0,7)))].sort(),cur=MONTH.key,full=months.filter(k=>k<cur);
  const mo=DH.bmo&&full.includes(DH.bmo)?DH.bmo:(full[full.length-1]||dhPrevMonth(cur)),B=dhCalcBaTang(mo),ng=B.cfg.nguong;
  return `<div class="filters"><label class="inl">Tháng <select id="dh-bmo">${(full.length?full:[mo]).map(k=>`<option value="${k}"${k===mo?" selected":""}>${k.slice(5)}/${k.slice(0,4)}</option>`).join("")}</select></label></div>
  <section class="card"><div class="card-h"><h2>Lãi theo kênh 3 tầng · ${mo.slice(5)}/${mo.slice(0,4)}</h2></div>
  ${B.rows.length?tbl(["Kênh","Doanh thu","Lãi đóng góp (trước lương, đóng gói)","− Lương team","− Đóng gói","= Lãi sau chi phí trực tiếp","Biên","− Chi phí chung chia theo doanh thu","= Lãi kênh sau phân bổ","Biên"],B.rows.map(r=>r.lai==null?`<tr><td><b>${r.n}</b></td><td class="n">${dhN(r.dt)}</td><td colspan="8" class="hint">${esc(r.thieu||"chưa có số")}</td></tr>`:`<tr><td><b>${r.n}</b></td><td class="n">${dhN(r.dt)}</td><td class="n">${dhN(r.lai)}</td><td class="n">${r.luong?dhN(-r.luong):"—"}</td><td class="n">${r.dg?dhN(-r.dg):"—"}</td><td class="n"><b class="${r.t2<0?"t-red":""}">${dhN(r.t2)}</b></td><td class="n">${dhPct(r.bien2)} ${r.bien2<ng.bienKenh?pill("thấp","amb"):""}</td><td class="n">${r.pb?dhN(-r.pb):"—"}</td><td class="n"><b class="${r.t3<0?"t-red":""}">${dhN(r.t3)}</b></td><td class="n">${dhPct(r.bien3)}</td></tr>`)):dhNeed("tháng này chưa có số kênh nào.")}
  <p class="hint">Tầng 1: giá vốn, phí sàn, quảng cáo (số của từng kênh). Tầng 2: trừ lương team gắn kênh và chi phí đóng gói theo số đơn (Thiết lập). Tầng 3: chia ${dhN(B.chung)}đ chi phí dùng chung trong tháng (${B.nChung} khoản ở Chi phí theo tháng${B.coLuong?", đã bỏ lương để không trừ hai lần":""}) theo tỷ trọng doanh thu. B2B, gia công sẽ thêm khi có lãi theo tháng của hai kênh này.</p>
  ${!B.cfg.luong.length?dhNeed("chưa nhập lương team gắn kênh.","Tab Thiết lập › Lương team theo kênh."):""}</section>`;
}
function dhTabThang(){
  return `<section class="card"><div class="card-h"><h2>Báo cáo tháng đã chốt theo kênh</h2></div><p class="hint">Số chốt sau ngày 8 tháng sau (đã biết đơn giao xong, hoàn, phí sàn thật). Mở từng kênh để xem chi tiết.</p><div class="acts">${[["bc_tiktok","TikTok Shop"],["bc_shopee","Shopee"],["bc_fb","Facebook"],["bc_b2b","B2B / Đại lý"],["bc_gc","Gia công"],["pl","Lãi lỗ (P&L)"]].map(([k,t])=>`<button class="btn" data-go="${k}">${t} →</button>`).join("")}</div></section>${typeof tsbMonthsView==="function"?tsbMonthsView():""}`;
}
function dhTabCaiDat(){
  const c=dhGet(),AR=dhAutoRates(c),ng=c.nguong,K=c.kenh,chs=[["tts","TikTok"],["spe","Shopee"],["fb","Facebook"],["b2b","B2B / NPP"],["gc","Gia công"]];
  const L=c.luong.length?c.luong:[{team:"",tien:0,pt:{}}];
  return `<form class="frm" id="dh-cf">
  <section class="card"><div class="card-h"><h2>Ngưỡng cảnh báo</h2></div><div class="row4">
   <label class="field">Giá nguyên liệu tăng từ (%)<input type="number" step="0.1" id="dh-n1" value="${ng.nvlTang*100}"></label>
   <label class="field">Biên tối thiểu bảng giá cấp (%)<input type="number" step="0.1" id="dh-n2" value="${ng.bienTier*100}"></label>
   <label class="field">Biên tối thiểu báo giá gia công (%)<input type="number" step="0.1" id="dh-n3" value="${ng.bienGC*100}"></label>
   <label class="field">Biên đóng góp kênh mục tiêu (%)<input type="number" step="0.1" id="dh-n4" value="${ng.bienKenh*100}"></label>
   <label class="field">Tiền đủ chạy tối thiểu (ngày)<input type="number" id="dh-n5" value="${ng.runway}"></label>
   <label class="field">Chi trung bình mỗi ngày (đ, để trống = lấy chi phí tháng trước ÷ 30)<input type="number" id="dh-cn" value="${c.chiNgay||""}"></label></div></section>
  <section class="card"><div class="card-h"><h2>Tỷ lệ tạm tính theo kênh</h2></div>
   ${tbl(["Kênh","Tự lấy từ số thật","Còn lại sau hủy/hoàn (%)","Giá vốn / doanh thu (%)","Phí sàn / doanh thu (%)","Đóng gói mỗi đơn (đ)","Đang dùng"],["tts","spe","fb"].map(k=>{const auto=!K[k].tay,V=auto?AR.K[k]:K[k];return `<tr><td><b>${(DH_CH.find(x=>x[0]===k)||[])[1]}</b></td><td><input type="checkbox" class="dh-auto" data-k="${k}"${auto?" checked":""}></td>${["thuan","gv","phi"].map(f=>`<td><input type="number" step="0.1" class="dh-k" data-k="${k}" data-f="${f}" value="${+(V[f]*100).toFixed(2)}"${auto?" disabled":""}></td>`).join("")}<td><input type="number" class="dh-k" data-k="${k}" data-f="dongGoi" value="${K[k].dongGoi||0}"></td><td class="hint">${esc(AR.src[k])}</td></tr>`}))}
   <p class="hint">Mặc định web tự lấy tỷ lệ từ số thật: Facebook theo tỷ lệ giao thành công của các ngày đã giao xong; TikTok theo tháng đã lưu (doanh thu thuần ÷ GMV, giá vốn, phí sàn). Bỏ tick để tự nhập.</p></section>
  <section class="card"><div class="card-h"><h2>Lương team theo kênh</h2></div><p class="hint">Lương tháng của từng team và phần trăm công sức cho từng kênh. Người làm cho nhiều kênh thì chia %; kế toán, kho, văn phòng để ở chi phí dùng chung (không nhập ở đây).</p>
   <div class="tbl edit"><table><thead><tr><th>Team</th><th>Lương tháng (đ)</th>${chs.map(x=>`<th>% ${x[1]}</th>`).join("")}<th></th></tr></thead><tbody>${L.map((t,i)=>`<tr><td><input class="dh-l" data-i="${i}" data-f="team" value="${esc(t.team||"")}" placeholder="VD: Content & Media"></td><td><input type="number" class="dh-l" data-i="${i}" data-f="tien" value="${t.tien||""}"></td>${chs.map(x=>`<td><input type="number" class="dh-l" data-i="${i}" data-f="pt.${x[0]}" value="${(t.pt||{})[x[0]]||""}" style="width:70px"></td>`).join("")}<td><button type="button" class="lnk" data-dhlx="${i}">✕</button></td></tr>`).join("")}</tbody></table></div>
   <button type="button" class="btn sm" id="dh-ladd">+ Thêm team</button></section>
  <button class="btn pri">Lưu thiết lập</button></form>`;
}
function pDieuHanh(m){
  if(!dhOk()){m.innerHTML=H("Phòng điều hành","")+`<section class="card"><p>Chỉ CEO và kế toán xem được.</p></section>`;return}
  dhLoad();
  const tab=SUB.dh||"tongquan";
  let body="";try{body=DH.busy&&!DH.at?`<p class="hint pad">Đang tải…</p>`:tab==="tongquan"?dhTongQuan():tab==="homnay"?dhTabNgay():tab==="gia"?dhTabGia():tab==="tien"?dhTabTien():tab==="batang"?dhTabBaTang():tab==="thang"?dhTabThang():dhTabCaiDat()}catch(e){body=`<div class="note red">Lỗi tính: ${esc(e.message)}</div>`}
  m.innerHTML=H("Phòng điều hành",esc(pLabel()))+`<div class="tabs">${DH_TABS.map(([k,t])=>`<button data-sub="${k}" class="${k===tab?"on":""}">${t}</button>`).join("")}</div>`+(DH.err?`<div class="note red">${esc(DH.err)}</div>`:"")+body;
  dhBind(m,tab);
}
function dhBind(m,tab){
  const bmo=m.querySelector("#dh-bmo");if(bmo)bmo.onchange=()=>{DH.bmo=bmo.value;renderMain()};
  const tf=m.querySelector("#dh-tf");if(tf)tf.onsubmit=e=>{e.preventDefault();const v=id=>+(m.querySelector(id).value)||0;dhSave("nhập số dư tiền",c=>c.tien.push({id:uid("t"),ngay:m.querySelector("#dh-t-d").value,tien:v("#dh-t-t"),viTT:v("#dh-t-v1"),viSPE:v("#dh-t-v2"),note:m.querySelector("#dh-t-n").value,by:ME.name}))};
  m.querySelectorAll("[data-dhtx]").forEach(b=>b.onclick=()=>{if(confirm("Xóa dòng số dư này?"))dhSave("xóa số dư tiền",c=>{c.tien=c.tien.filter(x=>x.id!==b.dataset.dhtx)})});
  if(tab!=="caidat")return;
  const cur=dhGet();DH.form=DH.form||{luong:cur.luong.length?JSON.parse(JSON.stringify(cur.luong)):[{team:"",tien:0,pt:{}}]};
  m.querySelectorAll(".dh-l").forEach(x=>x.oninput=()=>{const t=DH.form.luong[+x.dataset.i]||(DH.form.luong[+x.dataset.i]={pt:{}}),f=x.dataset.f;if(f.startsWith("pt."))(t.pt=t.pt||{})[f.slice(3)]=+x.value||0;else t[f]=f==="tien"?(+x.value||0):x.value});
  const add=m.querySelector("#dh-ladd");if(add)add.onclick=()=>{const L=DH.form.luong.filter(t=>t.team||t.tien).concat([{team:"",tien:0,pt:{}}]);DH.form=null;dhSave("thêm team lương",c=>{c.luong=L})};
  m.querySelectorAll("[data-dhlx]").forEach(b=>b.onclick=()=>{const L=DH.form.luong.filter((t,i)=>i!==+b.dataset.dhlx&&(t.team||t.tien));DH.form=null;dhSave("xóa team lương",c=>{c.luong=L})});
  m.querySelectorAll(".dh-auto").forEach(x=>x.onchange=()=>m.querySelectorAll(`.dh-k[data-k="${x.dataset.k}"]:not([data-f="dongGoi"])`).forEach(i=>i.disabled=x.checked));
  const ft=m.querySelector("#dh-fromtt");if(ft)ft.onclick=()=>{const L=TSB.months[TSB.months.length-1],s=L.summary;let gmv=0;Object.entries((TSB.all&&TSB.all.days)||{}).forEach(([d,x])=>{if(d.startsWith(L.ky)&&x.km)gmv+=x.km.gmv||0});
    if(!s.dt){toast("Tháng đã lưu chưa có doanh thu");return}
    dhSave("lấy tỷ lệ TikTok tháng "+L.ky,c=>{c.kenh.tts.gv=s.gv/s.dt;c.kenh.tts.phi=-s.phi/s.dt;if(gmv)c.kenh.tts.thuan=s.dt/gmv})};
  const f=m.querySelector("#dh-cf");if(f)f.onsubmit=e=>{e.preventDefault();const g=id=>+(m.querySelector(id).value),L=DH.form.luong.filter(t=>t.team||t.tien);DH.form=null;
    dhSave("sửa thiết lập Phòng điều hành",c=>{c.nguong={nvlTang:g("#dh-n1")/100,bienTier:g("#dh-n2")/100,bienGC:g("#dh-n3")/100,bienKenh:g("#dh-n4")/100,runway:g("#dh-n5")||30};c.chiNgay=+m.querySelector("#dh-cn").value||0;
      m.querySelectorAll(".dh-k").forEach(x=>{const k=x.dataset.k,fl=x.dataset.f;if(!x.disabled||fl==="dongGoi")c.kenh[k][fl]=fl==="dongGoi"?(+x.value||0):(+x.value||0)/100});
      m.querySelectorAll(".dh-auto").forEach(x=>{c.kenh[x.dataset.k].tay=!x.checked});
      c.luong=L})};
}
PAGES.dh=pDieuHanh;

/* Menu trang quản trị: "Phòng điều hành" đứng ngay sau "Tổng quan công ty". */
if(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin"){
  /* Gom về một chỗ: mọi báo cáo kết quả, doanh thu theo kênh nằm dưới Phòng điều hành (chỗ CEO xem, quyết định);
     "Tài chính" cũ chỉ còn việc của kế toán (chi phí, đối soát, bill, tài khoản nhận tiền) nên đổi tên "Việc kế toán". */
  const REP=["bc_tong","pl","bc_tiktok","bc_shopee","bc_fb","cskh_cu","bc_b2b","bc_gc"],fin=MODULES.find(x=>x.k==="q_fin"),finG=fin?fin.groups:()=>[];
  const reports=()=>{const its=finG().flatMap(g=>g[1]);return REP.map(k=>its.find(i=>i[0]===k)).filter(Boolean)};
  if(fin){fin.n="Việc kế toán";fin.groups=()=>finG().map(([g,its])=>[g,its.filter(i=>!REP.includes(i[0]))]).filter(g=>g[1].length)}
  const mod={k:"q_dh",adm:true,zone:"Quản trị",ic:"trend",n:"Phòng điều hành",sub:"",groups:()=>[["",[MI("dh","Phòng điều hành",u=>u.role==="admin"||dhOk())].concat(reports())]]};
  const i=MODULES.findIndex(x=>x.k==="q_tq");MODULES.splice(i>=0?i+1:MODULES.length,0,mod);
}
/* Cảnh báo điều hành ở Tổng quan công ty: giá nguyên liệu tăng, giá bán dưới ngưỡng, tiền đủ chạy thấp. */
{const _ea=execAlerts;execAlerts=function(){const A=_ea.apply(this,arguments);
  try{if(dhOk()&&typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin"){dhLoad();if(DH.at){const G=dhCalcGia(),T=dhCalcTien(),out=[];
    if(G.up.length)out.push(["red",`${G.up.length} nguyên liệu tăng giá từ ${dhPct(G.cfg.nguong.nvlTang)}`,"Phòng điều hành › Giá thành & cảnh báo","dh"]);
    if(G.red.length)out.push(["red",`${G.red.length} giá bán / báo giá gia công dưới ngưỡng biên`,"Phòng điều hành › Giá thành & cảnh báo","dh"]);
    if(T.R.ngay!=null&&T.R.ngay<T.cfg.nguong.runway)out.push(["red",`Tiền chỉ đủ chạy ${T.R.ngay} ngày`,"Phòng điều hành › Tiền & cảnh báo","dh"]);
    return out.concat(A)}}}catch(e){}
  return A}}
