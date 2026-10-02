/* =====================================================================
   BÁO CÁO ADS THEO NGÀY (Marketing › Quảng cáo › Chi theo ngày)
   Lấy thẳng file "BÁO CÁO DIGITAL MKT 2026 FINAL" của team Digital: VPS đọc 3 tab
   Ads Việt Anh / Thảo / Duẩn 5 phút một lần và đẩy lên máy chủ (blob ads_live).
   Mỗi tab: các khối sản phẩm (SYS_ID, ví dụ RUOI_CD, MUOI_MESS) × chỉ số × ngày 1–31.
   ===================================================================== */
const ADL={raw:null,at:0,busy:false,who:"",day:"",open:""};
async function adlLoad(force){
  if(typeof svApi!=="function"||ADL.busy||(!force&&Date.now()-ADL.at<55000))return;ADL.busy=true;
  try{const r=await svApi("/api/hub/blob/ads_live");const ch=JSON.stringify(r)!==JSON.stringify(ADL.raw);ADL.raw=r;ADL.at=Date.now();if(ch&&PAGE==="fb_ads"&&!svTyping())renderMain()}catch(e){}finally{ADL.busy=false}
}
setInterval(()=>{if(ME&&PAGE==="fb_ads"&&!document.hidden)adlLoad()},60000);

const adlNum=v=>{const n=parseFloat(String(v==null?"":v).replace(/[^\d.,-]/g,"").replace(/,/g,""));return Number.isFinite(n)?n:0};
/* Một tab → các khối sản phẩm. */
function adlParse(rows){
  const out=[];let cur=null;
  const metric=l=>{l=String(l||"").toLowerCase();if(l.includes("%"))return "";if(l.includes("chi phí ads"))return "spend";if(l.includes("số data")||l.includes("số tin nhắn"))return "data";if(l.includes("số đơn"))return "orders";if(l.includes("doanh số"))return "rev";if(l.includes("cpqc"))return "cpqc";return ""};
  (rows||[]).forEach(r=>{
    if(r[0]==="SYS_ID"&&/^Chiến dịch/.test(r[1]||"")){cur={ids:{},name:"",m:{}};out.push(cur);return}
    if(!cur)return;
    if(r[0]&&r[0]!=="SYS_ID")cur.ids[r[0]]=(cur.ids[r[0]]||0)+1;
    if(!cur.name&&r[1])cur.name=String(r[1]);
    const k=metric(r[2]);if(k&&!cur.m[k])cur.m[k]=Array.from({length:31},(_,i)=>adlNum(r[4+i]));
  });
  return out.map(b=>{const id=Object.entries(b.ids).sort((a,c)=>c[1]-a[1])[0];const nm=b.name.split("\n");
    return {id:id?id[0]:nm[0],name:nm[0].trim(),fun:/mess/i.test(nm[1]||"")||/_MESS$/.test(id?id[0]:"")?"Tin nhắn":"Chuyển đổi",m:b.m}}).filter(b=>b.m.spend);
}
function adlData(){
  const r=ADL.raw;if(!r||!r.tabs)return null;
  const B=[];Object.entries(r.tabs).forEach(([who,rows])=>adlParse(rows).forEach(b=>B.push(Object.assign(b,{who}))));
  let last=0;B.forEach(b=>b.m.spend.forEach((v,i)=>{if(v>0&&i+1>last)last=i+1}));
  // File làm theo tháng: ngày có số lớn hơn hôm nay thì file đang là tháng trước.
  const t=new Date();let mo=t.getMonth()+1,yr=t.getFullYear();if(last>t.getDate()+1){mo--;if(!mo){mo=12;yr--}}
  return {B,last,mo,yr,at:r.at,who:Object.keys(r.tabs)};
}
const adlSum=(B,k,days)=>B.reduce((a,b)=>a+days.reduce((s,d)=>s+((b.m[k]||[])[d-1]||0),0),0);
function adlStats(B,days){
  const spend=adlSum(B,"spend",days),data=adlSum(B,"data",days),orders=adlSum(B,"orders",days),rev=adlSum(B,"rev",days),cp=B.reduce((a,b)=>a+days.reduce((t,d)=>{const sp=b.m.spend[d-1]||0,q=(b.m.cpqc||[])[d-1]||0;return t+(q>=sp&&q>0?q:sp*1.1)},0),0);
  return {spend,data,orders,rev,cp,giaData:data?spend/data:0,cpo:orders?spend/orders:0,pct:rev?cp/rev:0,chot:data?orders/data:0,roas:spend?rev/spend:0,tbDon:orders?rev/orders:0};
}
const adlPct=v=>(v*100).toFixed(1).replace(".",",")+"%";
const adlR=v=>v?v.toFixed(2).replace(".",","):"—";

function pAdsDay(m){
  adlLoad();const D_=adlData();
  if(!D_){m.innerHTML=H("Báo cáo Ads theo ngày","Lấy từ file BÁO CÁO DIGITAL MKT 2026 FINAL")+`<section class="card"><p class="empty">${ADL.at?"Chưa có số liệu từ file báo cáo Digital.":"Đang tải số liệu…"}</p></section>`;return}
  const {B,last,mo,yr}=D_;
  if(!ADL.day)ADL.day=String(last||1);
  const days=ADL.day==="all"?Array.from({length:last},(_,i)=>i+1):[+ADL.day];
  const scope=B.filter(b=>!ADL.who||b.who===ADL.who),S=adlStats(scope,days);
  const at=new Date(D_.at),atS=at.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+" "+at.toLocaleDateString("vi-VN");
  // gộp theo sản phẩm (cùng mã SYS_ID) qua các người chạy
  const G={};scope.forEach(b=>{(G[b.id]=G[b.id]||{id:b.id,name:b.name,fun:b.fun,L:[]}).L.push(b)});
  const P=Object.values(G).map(g=>Object.assign(g,{s:adlStats(g.L,days),mon:adlStats(g.L,Array.from({length:last},(_,i)=>i+1)),who:[...new Set(g.L.filter(b=>days.some(d=>(b.m.spend[d-1]||0)>0)).map(b=>b.who))]})).filter(g=>g.s.spend||g.s.orders||g.s.rev).sort((a,b)=>b.s.spend-a.s.spend);
  const dayLbl=ADL.day==="all"?`cả tháng ${mo}/${yr} (1–${last})`:`ngày ${ADL.day}/${mo}/${yr}`;
  const row=g=>{const s=g.s;return `<tr class="clk${ADL.open===g.id?" on":""}" data-adlo="${esc(g.id)}"><td><b>${esc(g.name)}</b><small>${esc(g.id)} · ${g.fun}</small></td><td>${g.who.map(esc).join(", ")||"—"}</td><td class="n">${money(s.spend)}</td><td class="n">${nf(s.data)}</td><td class="n">${s.data?money(s.giaData):"—"}</td><td class="n">${nf(s.orders)}</td><td class="n">${money(s.rev)}</td><td class="n">${s.orders?money(s.cpo):"—"}</td><td class="n">${s.rev?adlPct(s.pct):"—"}</td><td class="n">${s.data?adlPct(s.chot):"—"}</td><td class="n"><b>${adlR(s.roas)}</b></td></tr>${ADL.open===g.id?`<tr class="sub"><td colspan="11">${adlDaily(g.L,last)}</td></tr>`:""}`};
  const people=D_.who.map(w=>{const s=adlStats(B.filter(b=>b.who===w),days);return `<tr><td><b>${esc(w)}</b></td><td class="n">${money(s.spend)}</td><td class="n">${nf(s.data)}</td><td class="n">${nf(s.orders)}</td><td class="n">${money(s.rev)}</td><td class="n">${s.orders?money(s.cpo):"—"}</td><td class="n">${s.rev?adlPct(s.pct):"—"}</td><td class="n"><b>${adlR(s.roas)}</b></td></tr>`}).join("");
  m.innerHTML=H("Báo cáo Ads theo ngày",`Theo file BÁO CÁO DIGITAL của team · tự cập nhật 5 phút/lần · lần cuối ${atS}`)+`
  <div class="filters"><select id="adl-w">${opt([["","Tất cả người chạy"]].concat(D_.who.map(w=>[w,w])),ADL.who)}</select>
  <select id="adl-d">${opt([["all","Cả tháng "+mo]].concat(Array.from({length:last},(_,i)=>[String(last-i),`Ngày ${last-i}/${mo}`+(i===0?" (mới nhất)":"")])),ADL.day)}</select>
  <span class="hint">Chi phí Ads tự kéo từ Meta; đơn và doanh số do Sale nhập vào file, nhập xong vài phút là hiện ở đây.</span></div>
  <div class="grid kpis">${kpi("Chi Ads",money(S.spend),dayLbl)}${kpi("Data / tin nhắn",nf(S.data),S.data?"giá data "+money(S.giaData):"")}${kpi("Đơn chốt",nf(S.orders),S.data?"tỷ lệ chốt "+adlPct(S.chot):"")}${kpi("Doanh số",money(S.rev),S.orders?"TB đơn "+money(S.tbDon):"")}${kpi("ROAS",adlR(S.roas),"doanh số / chi ads")}${kpi("% CPQC / doanh số",S.rev?adlPct(S.pct):"—","chi phí gồm thuế")}${kpi("Chi / đơn",S.orders?money(S.cpo):"—","")}</div>
  <section class="card flush"><div class="card-h pad"><h2>Theo sản phẩm · ${dayLbl}</h2><span class="hint">bấm một dòng để xem từng ngày như file báo cáo</span></div>
  <div class="tbl"><table><thead><tr><th>Sản phẩm</th><th>Người chạy</th><th class="n">Chi Ads</th><th class="n">Data</th><th class="n">Giá data</th><th class="n">Đơn</th><th class="n">Doanh số</th><th class="n">Chi/đơn</th><th class="n">% CP/DS</th><th class="n">Tỷ lệ chốt</th><th class="n">ROAS</th></tr></thead><tbody>${P.map(row).join("")||`<tr><td colspan="11" class="empty">Không có số liệu ${dayLbl}.</td></tr>`}</tbody></table></div></section>
  <section class="card"><div class="card-h"><h2>Theo người chạy · ${dayLbl}</h2></div>${tbl(["Người chạy","Chi Ads","Data","Đơn","Doanh số","Chi/đơn","% CP/DS","ROAS"],[people])}</section>`;
  $("#adl-w").onchange=e=>{ADL.who=e.target.value;renderMain()};
  $("#adl-d").onchange=e=>{ADL.day=e.target.value;renderMain()};
  m.querySelectorAll("[data-adlo]").forEach(r=>r.onclick=()=>{ADL.open=ADL.open===r.dataset.adlo?"":r.dataset.adlo;renderMain()});
}
/* Bảng từng ngày của một sản phẩm: giống khối trong file báo cáo. */
function adlDaily(L,last){
  const D=Array.from({length:last},(_,i)=>i+1),st=D.map(d=>adlStats(L,[d]));
  const R=[["Chi Ads",s=>s.spend?nf(Math.round(s.spend)):""],["Data",s=>s.data?nf(s.data):""],["Giá data",s=>s.data?nf(Math.round(s.giaData)):""],["Đơn chốt",s=>s.orders?nf(s.orders):""],["Doanh số",s=>s.rev?nf(Math.round(s.rev)):""],["Chi/đơn",s=>s.orders?nf(Math.round(s.cpo)):""],["% CP/DS",s=>s.rev?adlPct(s.pct):""],["Tỷ lệ chốt",s=>s.data?adlPct(s.chot):""],["ROAS",s=>s.spend&&s.rev?adlR(s.roas):""]];
  const mon=adlStats(L,D);
  return `<div class="tbl adl-days"><table><thead><tr><th>Chỉ số</th><th class="n">Tổng</th>${D.map(d=>`<th class="n">${d}</th>`).join("")}</tr></thead><tbody>${R.map(([n,f])=>`<tr><td><b>${n}</b></td><td class="n"><b>${f(mon)}</b></td>${st.map(s=>`<td class="n">${f(s)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
PAGES.fb_ads=pAdsDay;
