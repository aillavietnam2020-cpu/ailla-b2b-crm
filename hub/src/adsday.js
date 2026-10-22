/* =====================================================================
   BÁO CÁO ADS THEO NGÀY (Marketing › Quảng cáo › Chi theo ngày)
   Lấy thẳng file "BÁO CÁO DIGITAL MKT 2026 FINAL" của team Digital: VPS đọc 3 tab
   Ads Việt Anh / Thảo / Duẩn mỗi sáng 8h và đẩy lên máy chủ (blob ads_live).
   Mỗi tab: các khối sản phẩm (SYS_ID, ví dụ RUOI_CD, MUOI_MESS) × chỉ số × ngày 1–31.
   ===================================================================== */
const ADL={raw:null,at:0,busy:false,who:"",day:"",open:""};
async function adlLoad(force){
  if(typeof svApi!=="function"||ADL.busy||(!force&&Date.now()-ADL.at<1800000))return;ADL.busy=true;
  try{const r=await svApi("/api/hub/blob/ads_live");const ch=JSON.stringify(r)!==JSON.stringify(ADL.raw);ADL.raw=r;ADL.at=Date.now();if(ch&&(PAGE==="fb_ads"||PAGE==="fb_gd"||PAGE==="dg_tq"||PAGE==="adshieuqua"||PAGE==="adssp")&&!svTyping())renderMain()}catch(e){}finally{ADL.busy=false}
}


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

function pAdsDaySheet(m){
  adlLoad();const D_=adlData();
  if(!D_){m.innerHTML=H("Báo cáo Ads theo ngày","Lấy từ file BÁO CÁO DIGITAL MKT 2026 FINAL")+`<section class="card"><p class="empty">${ADL.at?"Chưa có số liệu từ file báo cáo Digital.":"Đang tải số liệu…"}</p></section>`;return}
  const {B,last,mo,yr}=D_;
  if(!ADL.day)ADL.day=String(last||1);
  const days=ADL.day==="all"?Array.from({length:last},(_,i)=>i+1):[+ADL.day];
  const S=adlStats(B.filter(b=>!ADL.who||b.who===ADL.who),days);
  const at=new Date(D_.at),atS=at.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+" "+at.toLocaleDateString("vi-VN");
  // Tách theo người chạy: mỗi người một bảng, ai chạy mã nào thì có mã đó (mã có số trong tháng).
  const MON=Array.from({length:last},(_,i)=>i+1),dayLbl=ADL.day==="all"?`cả tháng ${mo}/${yr} (1–${last})`:`ngày ${ADL.day}/${mo}/${yr}`;
  const cells=s=>`<td class="n">${s.spend?money(s.spend):"—"}</td><td class="n">${s.data?nf(s.data):"—"}</td><td class="n">${s.data?money(s.giaData):"—"}</td><td class="n">${s.orders?nf(s.orders):"—"}</td><td class="n">${s.rev?money(s.rev):"—"}</td><td class="n">${s.orders?money(s.cpo):"—"}</td><td class="n">${s.rev?adlPct(s.pct):"—"}</td><td class="n">${s.data?adlPct(s.chot):"—"}</td><td class="n"><b>${s.spend&&s.rev?adlR(s.roas):"—"}</b></td>`;
  const HEAD=`<thead><tr><th>Mã · sản phẩm</th><th class="n">Chi Ads</th><th class="n">Data</th><th class="n">Giá data</th><th class="n">Đơn</th><th class="n">Doanh số</th><th class="n">Chi/đơn</th><th class="n">% CP/DS</th><th class="n">Tỷ lệ chốt</th><th class="n">ROAS</th></tr></thead>`;
  const section=w=>{const L=B.filter(b=>b.who===w).map(b=>({b,key:w+"|"+b.id,s:adlStats([b],days),mon:adlStats([b],MON)})).filter(x=>x.mon.spend||x.mon.orders||x.mon.rev).sort((a,c)=>c.s.spend-a.s.spend||c.mon.spend-a.mon.spend),T=adlStats(L.map(x=>x.b),days);
    return `<section class="card flush"><div class="card-h pad"><h2>${esc(w)}</h2><span class="hint">${L.length} mã đang chạy trong tháng · ${dayLbl}</span></div><div class="tbl"><table>${HEAD}<tbody>${L.map(x=>`<tr class="clk${ADL.open===x.key?" on":""}${x.s.spend||x.s.orders?"":" dim"}" data-adlo="${esc(x.key)}"><td><b class="mono">${esc(x.b.id)}</b><small>${esc(x.b.name)} · ${x.b.fun}</small></td>${cells(x.s)}</tr>${ADL.open===x.key?`<tr class="sub"><td colspan="10">${adlDaily([x.b],last)}</td></tr>`:""}`).join("")||`<tr><td colspan="10" class="empty">Chưa có mã nào có số trong tháng.</td></tr>`}<tr class="tot"><td><b>Tổng ${esc(w)}</b></td>${cells(T)}</tr></tbody></table></div></section>`};
  const people=D_.who.map(w=>{const s=adlStats(B.filter(b=>b.who===w),days);return `<tr><td><b>${esc(w)}</b></td>${cells(s)}</tr>`}).join("");
  m.innerHTML=H("Báo cáo Ads theo ngày",`Theo file BÁO CÁO DIGITAL của team · cập nhật mỗi sáng 8h · lần cuối ${atS}`)+`
  <div class="filters"><select id="adl-w">${opt([["","Tất cả người chạy"]].concat(D_.who.map(w=>[w,w])),ADL.who)}</select>
  <select id="adl-d">${opt([["all","Cả tháng "+mo]].concat(Array.from({length:last},(_,i)=>[String(last-i),`Ngày ${last-i}/${mo}`+(i===0?" (mới nhất)":"")])),ADL.day)}</select>
  <span class="hint">Số liệu lấy từ file báo cáo Digital lúc 8h sáng mỗi ngày. Thêm mã mới: thêm khối mã đó vào tab Ads của người chạy trong file, hôm sau web tự hiện.</span></div>
  <div class="grid kpis">${kpi("Chi Ads",money(S.spend),dayLbl)}${kpi("Data / tin nhắn",nf(S.data),S.data?"giá data "+money(S.giaData):"")}${kpi("Đơn chốt",nf(S.orders),S.data?"tỷ lệ chốt "+adlPct(S.chot):"")}${kpi("Doanh số",money(S.rev),S.orders?"TB đơn "+money(S.tbDon):"")}${kpi("ROAS",adlR(S.roas),"doanh số / chi ads")}${kpi("% CPQC / doanh số",S.rev?adlPct(S.pct):"—","chi phí gồm thuế")}${kpi("Chi / đơn",S.orders?money(S.cpo):"—","")}</div>
  ${ADL.who?"":`<section class="card flush"><div class="card-h pad"><h2>So sánh người chạy · ${dayLbl}</h2></div><div class="tbl"><table><thead><tr><th>Người chạy</th>${HEAD.replace(/^.*?<th>Mã · sản phẩm<\/th>/,"").replace("</tr></thead>","")}</tr></thead><tbody>${people}</tbody></table></div></section>`}
  <p class="hint">Bấm một mã để xem từng ngày như trong file báo cáo.</p>
  ${D_.who.filter(w=>!ADL.who||w===ADL.who).map(section).join("")}`;
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
/* =====================================================================
   SỐ LIỆU TỰ ĐỘNG: chi phí + tin nhắn từ Facebook, đơn + doanh số từ Pancake.
   VPS (ads-fb.py) đẩy mỗi sáng vào blob ads_fb: days[ngày] = {fb:[chiến dịch], pos:[doanh số theo mã chiến dịch], link:[theo trang bán hàng]}.
   Doanh số Pancake ghép vào chiến dịch theo mã chiến dịch trên đơn (utm_campaign); người, sản phẩm, loại đọc từ tên chiến dịch.
   ===================================================================== */
const ADF={raw:null,at:0,busy:false,who:"",per:"m0",open:""};
async function adfLoad(force){
  if(typeof svApi!=="function"||ADF.busy||(!force&&Date.now()-ADF.at<1800000))return;ADF.busy=true;
  try{const r=await svApi("/api/hub/blob/ads_fb");const ch=JSON.stringify(r)!==JSON.stringify(ADF.raw);ADF.raw=r;ADF.at=Date.now();if(ch&&(PAGE==="fb_ads"||PAGE==="dg_tq"||PAGE==="adshieuqua"||PAGE==="adssp"||PAGE==="bc_fb"||PAGE==="fb_sale")&&!svTyping())renderMain()}catch(e){}finally{ADF.busy=false}
}
/* Trang Facebook (Doanh thu, Hoạt động team Sale): Sheet Pancake chỉ có đến 29/9, nên ngày nào Sheet không có thì dựng từ số tự động (ads_fb).
   Đơn tạo = đơn; hủy = đơn hủy; chốt = đơn − hủy; Pancake chỉ trả doanh số hoàn nên số đơn hoàn là ước lượng (250 nghìn/đơn hoàn, hiệu chỉnh theo 8/8–29/9);
   giá vốn ước tính 15,6% doanh thu giao xong. Đối chiếu 8/8–29/9 với Sheet: đơn lệch 0,2%, doanh thu chốt lệch 0,4%. Chi phí QC theo chiến dịch Facebook, gộp theo người chạy. */
const ADF_RET_AVG=250000,ADF_GV=0.156;
function adfMergeDays(){
  const R=ADF.raw;if(!(R&&R.days)||typeof DAYD==="undefined"||!DAYD)return;
  DAYD.fb=DAYD.fb||{};DAYD.ads=DAYD.ads||{};
  if(ADF.mgFor!==DAYD){ADF.mgFor=DAYD;ADF.mgAt="";ADF.mgFb=new Set();ADF.mgAds=[]}
  const sig=R.at+"|"+((typeof FBS!=="undefined"&&FBS.raw)?FBS.raw.at:"");if(ADF.mgAt===sig)return;ADF.mgAt=sig;
  ADF.mgFb.forEach(k=>delete DAYD.fb[k]);ADF.mgFb.clear();ADF.mgEst=new Set();ADF.mgAds.forEach(([o,k])=>{if(DAYD.ads[o])delete DAYD.ads[o][k]});ADF.mgAds=[];
  const sheetAds=new Set();Object.values(DAYD.ads).forEach(o=>Object.keys(o).forEach(k=>sheetAds.add(k)));
  const names={};Object.values(R.days).forEach(d=>(d.fb||[]).forEach(c=>{names[c.campaign_id]={name:c.campaign,account:c.account}}));
  Object.keys(R.days).sort().forEach(k=>{const d=R.days[k],pos=d.pos||[];
    if(pos.length&&!DAYD.fb[k]){let o=0,can=0,del=0,rev=0,dr=0,rt=0;pos.forEach(p=>{o+=p.orders||0;can+=p.canceled||0;del+=p.delivered||0;rev+=p.revenue||0;dr+=p.delivered_rev||0;rt+=p.returned_rev||0});
      const fs=(typeof FBS!=="undefined"&&FBS.raw&&FBS.raw.days||{})[k],hoan=fs?Math.min(del,sum(fs,r=>r.hoan)):Math.min(del,Math.round(rt/ADF_RET_AVG)),dtG=Math.max(0,dr-rt);if(!fs)ADF.mgEst=(ADF.mgEst||new Set()).add(k);
      DAYD.fb[k]=[o,Math.max(0,o-can),can,hoan,Math.max(0,del-hoan),dtG,rev,Math.round(dtG*ADF_GV),0,0];ADF.mgFb.add(k)}
    if(!sheetAds.has(k)&&(d.fb||[]).length){const by={};
      (d.fb||[]).forEach(c=>{const p=adfParse(c.campaign,c.account),a=by[p.owner]||(by[p.owner]=[0,0,0,0]);a[0]+=c.spend||0;a[1]+=p.typ==="Tin nhắn"?(c.messages||0):(c.leads!=null?c.leads:(c.messages||0))});
      pos.forEach(p=>{const n=names[p.campaign_id];if(!n)return;const w=adfParse(n.name,n.account).owner,a=by[w]||(by[w]=[0,0,0,0]);a[2]+=p.orders||0;a[3]+=p.revenue||0});
      Object.entries(by).forEach(([w,a])=>{(DAYD.ads[w]=DAYD.ads[w]||{})[k]=a;ADF.mgAds.push([w,k])})}
  });
}
const ADF_ACC={"2438831049860777":"Việt Anh","1721213761771236":"Việt Anh","1340771911416054":"Thảo","187878951968758":"Thảo","1354614543145294":"Thảo"};
const ADF_PROD={LANDING:"Đơn trang bán hàng chưa gắn chiến dịch",INBOX:"Đơn chốt qua inbox (chưa chia sản phẩm)",TLAI:"Tẩy lồng Ailla (TLAi)",AIBIO:"Tẩy lồng Aibio",TLG:"Tẩy lồng giặt (TLG)",TINHDAU:"Tinh dầu giặt sấy",LS:"Nước lau sàn",MUOI:"Xịt muỗi",RUOI:"Xịt ruồi"};
/* Đọc tên chiến dịch: VA-TLAi-CD-… | DUAN-TD-CD-… | TĐ - TLAi - 23.9 - … | MESS - … (không ghi người: lấy theo tài khoản). */
function adfParse(name,account){
  const raw=String(name||""),n=raw.toUpperCase().replace(/Đ/g,"D"),tk=n.split(/[^A-Z0-9]+/).filter(Boolean);
  let owner="",rest=tk;
  if(tk[0]==="VA"||tk[0]==="VIETANH"){owner="Việt Anh";rest=tk.slice(1)}
  else if(tk[0]==="DUAN"||tk[0]==="DUAN1"){owner="Duẩn";rest=tk.slice(1)}
  else if(tk[0]==="TD"&&/^T[ĐD]\s*-\s/i.test(raw)){owner="Thảo";rest=tk.slice(1)}
  else if(tk[0]==="THAO"){owner="Thảo";rest=tk.slice(1)}
  else if(tk.includes("DUAN"))owner="Duẩn";
  if(!owner)owner=ADF_ACC[account]||"Chưa rõ người";
  const has=f=>rest.some(f);let prod="";
  if(has(t=>t==="TLAI"))prod="TLAI";else if(has(t=>t.includes("AIBIO")))prod="AIBIO";else if(has(t=>t==="TLG"||t.startsWith("TLG")))prod="TLG";
  else if(has(t=>t==="TD"||t==="TINHDAU"))prod="TINHDAU";else if(has(t=>t==="LS"||t==="LAUSAN"))prod="LS";
  else if(has(t=>t==="XM"||t==="MUOI"))prod="MUOI";else if(has(t=>t==="XR"||t==="RUOI"))prod="RUOI";
  const typ=tk.includes("MESS")||/(^|[^A-Z])MESS([^A-Z]|$)/.test(n)?"Tin nhắn":"Chuyển đổi";
  return {owner,prod,typ};
}
function adfData(){
  const r=ADF.raw;if(!r||!r.days)return null;
  const keys=Object.keys(r.days).sort(),names={};
  keys.forEach(k=>(r.days[k].fb||[]).forEach(c=>{names[c.campaign_id]={name:c.campaign,account:c.account}}));
  const last=keys.filter(k=>(r.days[k].fb||[]).length||(r.days[k].pos||[]).length).pop()||keys[keys.length-1];
  return {days:r.days,keys,names,last,at:r.at,campPage:r.camp_page||{}};
}
const adfPeriod=(D,per)=>{
  const mo=D.last.slice(0,7);
  if(per==="m0")return D.keys.filter(k=>k.slice(0,7)===mo);
  if(per==="m1"){const t=new Date(+mo.slice(0,4),+mo.slice(5,7)-2,1),p=t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0");return D.keys.filter(k=>k.slice(0,7)===p)}
  if(per==="d7")return D.keys.filter(k=>k<=D.last).slice(-7);
  return D.keys.filter(k=>k===per);
};
/* Doanh số, đơn của quảng cáo TIN NHẮN: lấy theo số sale nhập trong file BÁO CÁO DIGITAL (web đọc lại mỗi sáng). Tin nhắn chốt qua inbox không mang mã chiến dịch nên Pancake không tách được. */
const adfSheetProd=id=>{id=String(id||"").toUpperCase();return id.startsWith("RUOI")?"RUOI":id.startsWith("MUOI")?"MUOI":id.startsWith("AIBIO")?"AIBIO":id.startsWith("TLG")?"TLG":/^(TD|TINH)/.test(id)?"TINHDAU":/^(LS|LAU)/.test(id)?"LS":""};
const ADF_PAGE_OWNER={"105017945992971":"Việt Anh","61585541043585":"Việt Anh","100089661122548":"Thảo","61592606507215":"Duẩn","61566319940808":"Duẩn","61577468900810":"Duẩn"};
/* Tên nguồn đơn Pancake (ví dụ "Thảo-TLG-Aibio", "Việt Anh-Muỗi", "TLG Aibio Duẩn") -> người chạy */
const adfLinkWho=n=>{n=String(n||"").toLowerCase();return /vi[eệ]t anh/.test(n)?"Việt Anh":/th[aả]o/.test(n)?"Thảo":/du[aẩ]n/.test(n)?"Duẩn":""};
const ADF_MESS={"Việt Anh":{pages:["105017945992971","61585541043585"],prods:["TLG"]}};
const ADF_MESS_PROD={TLG:"TLG"};
const adfWho=n=>{n=String(n||"").toLowerCase();return /vi[eệ]t anh/.test(n)?"Việt Anh":/th[aả]o/.test(n)?"Thảo":/du[aẩ]n/.test(n)?"Duẩn":"Chưa rõ người"};
function adfSheetMess(){
  if(typeof adlLoad!=="function")return null;adlLoad();const S=adlData();if(!S)return null;
  return {mo:S.yr+"-"+String(S.mo).padStart(2,"0"),rows:S.B.filter(b=>b.fun==="Tin nhắn"&&b.m).map(b=>({who:b.who,prod:adfSheetProd(b.id),orders:b.m.orders||[],rev:b.m.rev||[]}))};
}
function adfAgg(D,days){
  const C={},US={};let unmatched=0,unOrders=0;
  const get=(id)=>C[id]||(C[id]=Object.assign({id,spend:0,msgs:0,orders:0,rev:0},(()=>{const nm=D.names[id]||{};const p=adfParse(nm.name,nm.account);const pgo=ADF_PAGE_OWNER[(D.campPage||{})[id]];return {name:nm.name||"",account:nm.account||"",owner:p.owner==="Chưa rõ người"&&pgo?pgo:p.owner,prod:p.prod,typ:p.typ}})()));
  days.forEach(k=>{const d=D.days[k];if(!d)return;
    (d.fb||[]).forEach(c=>{const x=get(c.campaign_id);x.spend+=c.spend||0;/* Data: quảng cáo tin nhắn = số tin nhắn; quảng cáo chuyển đổi = số khách để lại thông tin (đăng ký hoàn tất) */x.msgs+=x.typ==="Tin nhắn"?(c.messages||0):(c.leads!=null?c.leads:(c.messages||0))});
    (d.pos||[]).forEach(p=>{const od=(p.orders||0)-(p.canceled||0);/* don chot = tru don huy, giong Pancake */if(p.campaign_id&&D.names[p.campaign_id]){const x=get(p.campaign_id);x.orders+=od;x.rev+=p.revenue||0}else{unmatched+=p.revenue||0;unOrders+=od;const sn=p.source||"(chưa rõ nguồn)";const u=US[sn]||(US[sn]={name:sn,orders:0,rev:0});u.orders+=od;u.rev+=p.revenue||0}});
  });
  const SH=adfSheetMess();
  /* Doanh số tin nhắn: đơn nguồn Facebook, đúng page của người chạy, đúng sản phẩm chạy quảng cáo tin nhắn (quy ước chị Hoa 21/10). */
  let attRev=0,attOrd=0;
  days.forEach(k=>{const rows=(D.days[k]||{}).fbp;if(!Array.isArray(rows))return;rows.forEach(r=>{Object.entries(ADF_MESS).forEach(([who,cf])=>{if(!cf.pages.includes(r.page)||!cf.prods.includes(String(r.code).toUpperCase()))return;const prod=ADF_MESS_PROD[String(r.code).toUpperCase()]||String(r.code).toUpperCase(),id="__mess_"+who+"_"+prod,x=C[id]||(C[id]={id,name:"Doanh số tin nhắn của "+who+" (Pancake: đơn từ page của "+who+", sản phẩm "+(r.name||r.code)+")",account:"",owner:who,prod,typ:"Tin nhắn",spend:0,msgs:0,orders:0,rev:0});x.orders+=r.orders||0;x.rev+=r.revenue||0;attRev+=r.revenue||0;attOrd+=r.orders||0})})});
  if(attRev||attOrd){unmatched=Math.max(0,unmatched-attRev);unOrders=Math.max(0,unOrders-attOrd);if(US.Facebook){US.Facebook.rev=Math.max(0,US.Facebook.rev-attRev);US.Facebook.orders=Math.max(0,US.Facebook.orders-attOrd);if(!US.Facebook.rev&&!US.Facebook.orders)delete US.Facebook}}
  if(SH)days.forEach(k=>{if(Array.isArray((D.days[k]||{}).fbp))return;if(k.slice(0,7)!==SH.mo)return;const di=+k.slice(8)-1;SH.rows.forEach(r=>{const o=r.orders[di]||0,v=r.rev[di]||0;if(!o&&!v)return;const id="__sheet_"+r.who+"_"+r.prod;const x=C[id]||(C[id]={id,name:"Doanh số tin nhắn theo báo cáo Sheet ("+(ADF_PROD[r.prod]||"chưa rõ sản phẩm")+")",account:"",owner:r.who,prod:r.prod,typ:"Tin nhắn",spend:0,msgs:0,orders:0,rev:0});x.orders+=o;x.rev+=v})});
  /* Đơn từ trang bán hàng không mang mã chiến dịch: Pancake vẫn biết trang đó của ai (tên nguồn đơn). Phần chênh giữa doanh số theo trang và doanh số đã gắn chiến dịch của người đó được tính cho người đó. */
  const LW={},LO={};days.forEach(k=>((D.days[k]||{}).link||[]).forEach(l=>{const w=adfLinkWho(l.name);if(!w)return;LW[w]=(LW[w]||0)+(l.revenue||0);LO[w]=(LO[w]||0)+Math.max(0,(l.orders||0)-(l.canceled||0))}));
  const MW={},MO={};Object.values(C).forEach(x=>{if(x.id.startsWith("__")||x.typ==="Tin nhắn")return;MW[x.owner]=(MW[x.owner]||0)+x.rev;MO[x.owner]=(MO[x.owner]||0)+x.orders});
  let landRev=0,landOrd=0;
  Object.keys(LW).forEach(w=>{const rv=Math.max(0,LW[w]-(MW[w]||0)),od=Math.max(0,LO[w]-(MO[w]||0));if(!rv&&!od)return;const id="__land_"+w;C[id]={id,name:"Đơn trang bán hàng chưa gắn chiến dịch (theo tên nguồn đơn của "+w+")",account:"",owner:w,prod:"LANDING",typ:"Chuyển đổi",spend:0,msgs:0,orders:od,rev:rv};landRev+=rv;landOrd+=od});
  if(landRev||landOrd){unmatched=Math.max(0,unmatched-landRev);unOrders=Math.max(0,unOrders-landOrd);const W=US["Webcake Landing"];if(W){W.rev=Math.max(0,W.rev-landRev);W.orders=Math.max(0,W.orders-landOrd);if(!W.rev&&!W.orders)delete US["Webcake Landing"]}}
  const links={};days.forEach(k=>((D.days[k]||{}).link||[]).forEach(l=>{const key=l.name||"(trang chưa có tên)";const t=links[key]||(links[key]={name:key,orders:0,rev:0});t.orders+=l.orders||0;t.rev+=l.revenue||0}));
  /* Người chỉ chạy tin nhắn cho đúng một sản phẩm thì doanh số tin nhắn (theo page) tính vào sản phẩm đó. */
  const MP={};Object.values(C).forEach(x=>{if(x.typ==="Tin nhắn"&&x.prod&&x.prod!=="INBOX"&&x.spend>0)(MP[x.owner]=MP[x.owner]||new Set()).add(x.prod)});
  Object.values(C).forEach(x=>{if(x.prod==="INBOX"&&MP[x.owner]&&MP[x.owner].size===1)x.prod=[...MP[x.owner]][0]});
  return {C:Object.values(C),unmatched,unOrders,unSrc:Object.values(US).sort((a,b)=>b.rev-a.rev),links:Object.values(links).sort((a,b)=>b.rev-a.rev)};
}
const adfSum=L=>{const s=L.reduce((a,x)=>({spend:a.spend+x.spend,msgs:a.msgs+x.msgs,orders:a.orders+x.orders,rev:a.rev+x.rev}),{spend:0,msgs:0,orders:0,rev:0});
  return Object.assign(s,{giaMsg:s.msgs?s.spend/s.msgs:0,cpo:s.orders?s.spend/s.orders:0,pct:s.rev?s.spend*1.1/s.rev:0,roas:s.spend?s.rev/s.spend:0})};
/* Tổng quan Digital: số tự động theo kỳ chị chọn ở thanh trên (PERIOD). Trả về null nếu chưa có số tự động. */
const adfPartial=(D,from,to)=>from<D.keys[0]?`<div class="note">Số tự động mới có từ ngày ${vnd(D.keys[0])}, nên kỳ này chưa đủ từ ${vnd(from)}. Phần trước ngày đó chưa có.</div>`:"";
function adfOverview(){
  adfLoad();if(!(ADF.raw&&ADF.raw.days))return null;const D=adfData();if(!D.keys.length)return null;
  const days=D.keys.filter(k=>k>=PERIOD.from&&k<=PERIOD.to);
  if(!days.length)return `<div class="note">Chưa có số quảng cáo tự động trong kỳ ${esc(pLabel())}. Số có từ ${vnd(D.keys[0])} đến ${vnd(D.last)}: chọn "Tháng này" hoặc "7 ngày qua" ở thanh trên.</div>`;
  const {C,unmatched,unOrders}=adfAgg(D,days),L=C.filter(x=>x.spend||x.rev),T=adfSum(L);
  const part=adfPartial(D,PERIOD.from,PERIOD.to);
  const row=(name,sub,s)=>`<tr><td><b>${esc(name)}</b>${sub?`<small>${sub}</small>`:""}</td><td class="n">${s.rev?money(s.rev):"—"}</td><td class="n">${s.spend?money(s.spend):"—"}</td><td class="n">${s.rev?adlPct(s.pct):"—"}</td><td class="n">${s.orders?nf(s.orders):"—"}</td><td class="n">${s.orders?money(s.cpo):"—"}</td><td class="n"><b>${s.spend&&s.rev?adlR(s.roas):"—"}</b></td></tr>`;
  const HEAD=`<thead><tr><th>{h}</th><th class="n">Doanh số</th><th class="n">Chi Ads</th><th class="n">% CP/DS</th><th class="n">Đơn</th><th class="n">Chi/đơn</th><th class="n">ROAS</th></tr></thead>`;
  const ppl=["Việt Anh","Thảo","Duẩn","Chưa rõ người"].map(w=>[w,L.filter(x=>x.owner===w)]).filter(x=>x[1].length).map(([w,a])=>[w,adfSum(a),a.length]).sort((a,b)=>b[1].rev-a[1].rev);
  const pr={};L.forEach(x=>{const k=x.prod||"?";(pr[k]||(pr[k]=[])).push(x)});
  const prods=Object.entries(pr).map(([k,a])=>[ADF_PROD[k]||"Chưa rõ sản phẩm",adfSum(a),a.length]).sort((a,b)=>b[1].rev-a[1].rev);
  const at=new Date(D.at);
  return part+`<div class="grid kpis">${kpi("Chi Ads",money(T.spend),esc(pLabel()))}${kpi("Doanh số mang về",money(T.rev),"Pancake, gắn vào chiến dịch")}${kpi("ROAS",adlR(T.roas),"doanh số / chi ads")}${kpi("Đơn chốt",nf(T.orders),T.orders?"chi / đơn "+money(T.cpo):"")}${kpi("Chi Ads / doanh số",T.rev?adlPct(T.pct):"—","gồm thuế 10% · mục tiêu ≤ 35%")}${kpi("Doanh số chưa gắn chiến dịch",money(unmatched),nf(unOrders)+" đơn")}</div>
  <div class="note">Tự lấy từ Facebook và Pancake mỗi sáng 8h (lần cuối ${at.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})} ${at.toLocaleDateString("vi-VN")}). Số có tới ngày ${vnd(D.last)}. Xem từng ngày như file Excel ở <a href="#" data-go="fb_ads">Báo cáo theo ngày</a>.</div>
  <section class="card flush"><div class="card-h pad"><h2>Top nhân sự</h2><span class="hint">xếp theo doanh số mang về</span></div><div class="tbl"><table>${HEAD.replace("{h}","Nhân sự")}<tbody>${ppl.map(([w,s,n])=>row(w,n+" chiến dịch",s)).join("")}</tbody></table></div></section>
  <section class="card flush"><div class="card-h pad"><h2>Top sản phẩm</h2><span class="hint">xếp theo doanh số mang về</span></div><div class="tbl"><table>${HEAD.replace("{h}","Sản phẩm")}<tbody>${prods.map(([n,s,c])=>row(n,c+" chiến dịch",s)).join("")}</tbody></table></div></section>`;
}
/* Thanh toán Facebook: từng lần trừ tiền / nạp tiền của tài khoản quảng cáo, cho kế toán đối soát. Lấy từ nhật ký tài khoản, máy dồn lại mỗi sáng. */
const adfVn=t=>{const d=new Date(String(t||"").replace(/\+0000$/,"Z"));return isNaN(d)?null:new Date(d.getTime()+7*3600000)};
const adfDt=t=>{const d=adfVn(t);return d?d.toISOString().slice(0,10):""};
const adfDtm=t=>{const d=adfVn(t);return d?d.toISOString().slice(0,16).replace("T"," "):""};
function adfBills(D,days){
  const all=(ADF.raw&&ADF.raw.billing)||[],lo=days.length?days[0]:PERIOD.from,hi=days.length?days[days.length-1]:PERIOD.to;
  const L=all.filter(b=>{const d=adfDt(b.time);return d>=PERIOD.from&&d<=PERIOD.to});
  return {L,all,earliest:all.length?adfDt(all[all.length-1].time):""};
}
function adfBillHtml(D,days){
  const {L,all,earliest}=adfBills(D,days);
  if(!all.length)return `<section class="card"><div class="card-h"><h2>Đối soát thanh toán Facebook</h2></div><p class="empty">Chưa có lịch sử trừ tiền. Máy sẽ ghi lại từ lần kéo số kế tiếp (mỗi sáng 8h).</p></section>`;
  const spend={};days.forEach(k=>((D.days[k]||{}).fb||[]).forEach(c=>{spend[c.account]=(spend[c.account]||0)+(c.spend||0)}));
  const by={};L.forEach(b=>{const t=by[b.account]||(by[b.account]={name:b.name||b.account,tru:0,nTru:0,nap:0,nNap:0});if(b.kind==="tru"){t.tru+=b.amount;t.nTru++}else{t.nap+=b.amount;t.nNap++}});
  Object.keys(spend).forEach(a=>{if(!by[a])by[a]={name:(all.find(b=>b.account===a)||{}).name||a,tru:0,nTru:0,nap:0,nNap:0}});
  const rows=Object.entries(by).sort((a,b)=>b[1].tru-a[1].tru),T=rows.reduce((a,[,v])=>({tru:a.tru+v.tru,nap:a.nap+v.nap,sp:a.sp+0}),{tru:0,nap:0,sp:0}),spT=sum(Object.values(spend),v=>v);
  return `<section class="card flush"><div class="card-h pad"><h2>Đối soát thanh toán Facebook</h2><span class="hint">${esc(pLabel())} · lịch sử máy ghi lại từ ${earliest?vnd(earliest):"—"} (Facebook chỉ giữ khoảng 7 ngày; khoản cũ hơn tải tay file giao dịch từ Facebook)</span><button class="btn" id="adf-csv" style="margin-left:auto">Tải Excel (CSV)</button></div>
  <div class="tbl"><table><thead><tr><th>Tài khoản quảng cáo</th><th class="n">Số lần trừ</th><th class="n">Tổng tiền bị trừ</th><th class="n">Số lần nạp</th><th class="n">Tổng nạp</th><th class="n">Chi phí quảng cáo cùng kỳ</th></tr></thead><tbody>${rows.map(([a,v])=>`<tr><td><b>${esc(v.name)}</b><small class="mono">${esc(a)}</small></td><td class="n">${nf(v.nTru)}</td><td class="n">${nf(v.tru)}</td><td class="n">${nf(v.nNap)}</td><td class="n">${nf(v.nap)}</td><td class="n">${nf(Math.round(spend[a]||0))}</td></tr>`).join("")||`<tr><td colspan="6" class="empty">Chưa có giao dịch trong kỳ này.</td></tr>`}<tr class="tot"><td><b>Tổng</b></td><td class="n"></td><td class="n">${nf(T.tru)}</td><td class="n"></td><td class="n">${nf(T.nap)}</td><td class="n">${nf(Math.round(spT))}</td></tr></tbody></table></div>
  <div class="tbl"><table><thead><tr><th>Giờ (VN)</th><th>Tài khoản</th><th>Loại</th><th class="n">Số tiền (đ)</th><th>Mã giao dịch</th></tr></thead><tbody>${L.slice(0,300).map(b=>`<tr><td>${adfDtm(b.time)}</td><td>${esc(b.name||b.account)}</td><td>${b.kind==="tru"?"Trừ tiền":"Nạp tiền"}</td><td class="n">${nf(b.amount)}</td><td class="mono">${esc(b.tx||"")}</td></tr>`).join("")||`<tr><td colspan="5" class="empty">Chưa có.</td></tr>`}</tbody></table></div></section>`;
}
function adfBillCsv(D,days){
  const {L}=adfBills(D,days),q=v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"';
  const NL=String.fromCharCode(10),txt=String.fromCharCode(65279)+["Giờ (VN)","Tài khoản","Mã tài khoản","Loại","Số tiền","Tiền tệ","Mã giao dịch"].map(q).join(",")+NL+L.map(b=>[adfDtm(b.time),b.name,b.account,b.kind==="tru"?"Trừ tiền":"Nạp tiền",b.amount,b.currency,b.tx].map(q).join(",")).join(NL);
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"text/csv;charset=utf-8"}));a.download=`thanh-toan-facebook-${PERIOD.from}-${PERIOD.to}.csv`;document.body.appendChild(a);a.click();a.remove();
}
/* Bảng từng ngày như file Excel, co gọn cho vừa một màn hình: tiền tính bằng nghìn đồng, mỗi ngày một cột hẹp. */
function adfDaily(D,keys,ids,dl){
  dl=dl||"Data";
  const pick=k=>adfSum(adfAgg(D,k).C.filter(c=>ids.has(c.id))),per=keys.map(k=>pick([k])),tot=pick(keys),kk=v=>nf(Math.round(v/1000));
  const R=[["Doanh số",s=>s.rev?kk(s.rev):""],["Chi Ads",s=>s.spend?kk(s.spend):""],["% CP/DS",s=>s.rev?Math.round(s.pct*100)+"%":""],["ROAS",s=>s.spend&&s.rev?adlR(s.roas):""],["Đơn",s=>s.orders?nf(s.orders):""],["Chi/đơn",s=>s.orders?kk(s.cpo):""],[dl,s=>s.msgs?nf(s.msgs):""],["Giá "+dl.toLowerCase(),s=>s.msgs?kk(s.giaMsg):""]];
  const mo=keys.length?keys[0].slice(5,7)+"/"+keys[0].slice(0,4):"";
  return `<div class="adf-days"><div class="hint">Từng ngày · tháng ${mo} · tiền tính bằng nghìn đồng</div><table><thead><tr><th>Chỉ số</th><th>Tổng</th>${keys.map(k=>`<th>${+k.slice(8)}</th>`).join("")}</tr></thead><tbody>${R.map(([n,f])=>`<tr><td><b>${n}</b></td><td><b>${f(tot)}</b></td>${per.map(s=>`<td>${f(s)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
const ADF_CSS=`<style>.adf-days{padding:2px 10px 10px;overflow-x:auto}.adf-days .hint{margin:2px 0 6px;font-size:12px}.adf-days table{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;font-size:12px}.adf-days th,.adf-days td{padding:4px 9px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--line)}.adf-days th{font-weight:600;color:var(--muted);background:var(--surface)}.adf-days td:first-child,.adf-days th:first-child{position:sticky;left:0;z-index:2;background:var(--surface);text-align:left;min-width:92px}.adf-days td:nth-child(2),.adf-days th:nth-child(2){position:sticky;left:92px;z-index:2;background:var(--surface);min-width:74px;border-right:1px solid var(--line);font-weight:700}.adf-days td:nth-child(n+3){min-width:52px}.adf-camps{padding:0 10px 8px}.adf-camps table{table-layout:fixed;width:100%;font-size:12px}.adf-camps td,.adf-camps th{padding:4px 8px}.adf-camps td:first-child,.adf-camps th:first-child{width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style>`;
function pAdsFb(m){
  const D=adfData(),days=D.keys.filter(k=>k>=PERIOD.from&&k<=PERIOD.to),{C,unmatched,unOrders,unSrc,links}=adfAgg(D,days);
  const L=C.filter(x=>x.spend||x.rev),owners=["Việt Anh","Thảo","Duẩn","Chưa rõ người"].filter(w=>L.some(x=>x.owner===w)&&(!ADF.who||ADF.who===w));
  const T=adfSum(ADF.who?L.filter(x=>x.owner===ADF.who):L),at=new Date(D.at),atS=at.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+" "+at.toLocaleDateString("vi-VN");
  const lbl=days.length?(days.length===1?"ngày "+days[0].slice(8)+"/"+days[0].slice(5,7):`${days[0].slice(8)}/${days[0].slice(5,7)} – ${days[days.length-1].slice(8)}/${days[days.length-1].slice(5,7)}`):"";
  const cells=s=>`<td class="n"><b>${s.rev?money(s.rev):"—"}</b></td><td class="n">${s.spend?money(s.spend):"—"}</td><td class="n">${s.rev?adlPct(s.pct):"—"}</td><td class="n"><b>${s.spend&&s.rev?adlR(s.roas):"—"}</b></td><td class="n">${s.orders?nf(s.orders):"—"}</td><td class="n">${s.orders?money(s.cpo):"—"}</td><td class="n">${s.msgs?nf(s.msgs):"—"}</td><td class="n">${s.msgs?money(s.giaMsg):"—"}</td>`;
  const HEAD=`<thead><tr><th>Mã · sản phẩm</th><th class="n">Doanh số</th><th class="n">Chi Ads</th><th class="n">% CP/DS</th><th class="n">ROAS</th><th class="n">Đơn</th><th class="n">Chi/đơn</th><th class="n">Data</th><th class="n">Giá data</th></tr></thead>`;
  const section=w=>{const mine=L.filter(x=>x.owner===w),G={};mine.forEach(x=>{const k=(x.prod||"?")+"|"+x.typ;(G[k]||(G[k]=[])).push(x)});
    const rows=Object.entries(G).map(([k,a])=>({k:w+"|"+k,prod:a[0].prod,typ:a[0].typ,list:a,s:adfSum(a)})).sort((a,b)=>b.s.spend-a.s.spend);
    const ids=l=>new Set(l.map(c=>c.id)),allKey=w+"|ALL";
    return `<section class="card flush"><div class="card-h pad"><h2>${esc(w)}</h2><span class="hint">${mine.length} chiến dịch · ${lbl} · bấm một dòng để xem từng ngày</span></div><div class="tbl"><table>${HEAD}<tbody>${rows.map(r=>`<tr class="clk${ADF.open===r.k?" on":""}" data-adfo="${esc(r.k)}"><td><b>${esc(ADF_PROD[r.prod]||"Chưa rõ sản phẩm")}</b><small>${r.typ} · ${r.list.length} chiến dịch</small></td>${cells(r.s)}</tr>${ADF.open===r.k?`<tr class="sub"><td colspan="9">${adfDaily(D,days,ids(r.list),r.typ==="Tin nhắn"?"Tin nhắn":"Data")}<div class="adf-camps"><table>${HEAD.replace("Mã · sản phẩm","Chiến dịch")}<tbody>${r.list.slice().sort((a,b)=>b.spend-a.spend).map(c=>`<tr><td title="${esc(c.name||c.id)}"><span class="mono">${esc(c.name||c.id)}</span></td>${cells(adfSum([c]))}</tr>`).join("")}</tbody></table></div></td></tr>`:""}`).join("")}<tr class="tot clk${ADF.open===allKey?" on":""}" data-adfo="${esc(allKey)}"><td><b>Tổng ${esc(w)}</b><small>bấm để xem từng ngày</small></td>${cells(adfSum(mine))}</tr>${ADF.open===allKey?`<tr class="sub"><td colspan="9">${adfDaily(D,days,ids(mine))}</td></tr>`:""}</tbody></table></div></section>`};
  const part=adfPartial(D,PERIOD.from,PERIOD.to);
  m.innerHTML=ADF_CSS+H("Báo cáo Ads theo ngày",`Tự lấy từ Facebook (chi phí, tin nhắn) và Pancake (đơn, doanh số) mỗi sáng · lần cuối ${atS}`)+`
  <div class="filters"><select id="adf-w">${opt([["","Tất cả người chạy"]].concat(["Việt Anh","Thảo","Duẩn"].map(w=>[w,w])),ADF.who)}</select>
  <span class="hint">Chọn ngày hoặc tháng ở thanh thời gian phía trên. Doanh số lấy từ Pancake, ghép vào chiến dịch theo mã chiến dịch trên đơn.</span></div>
  ${part}<div class="grid kpis">${kpi("Chi Ads",money(T.spend),lbl)}${kpi("Data / tin nhắn",nf(T.msgs),T.msgs?"giá "+money(T.giaMsg):"")}${kpi("Đơn (Pancake)",nf(T.orders),"gắn được vào chiến dịch")}${kpi("Doanh số (Pancake)",money(T.rev),T.orders?"TB đơn "+money(T.rev/T.orders):"")}${kpi("ROAS",adlR(T.roas),"doanh số / chi ads")}${kpi("% CP / doanh số",T.rev?adlPct(T.pct):"—","chi phí gồm thuế 10%")}${ADF.who?"":kpi("Doanh số chưa gắn chiến dịch",money(unmatched),nf(unOrders)+" đơn · khách tự vào, tin nhắn, chăm sóc")}</div>
  <p class="hint">Bấm một dòng để xem từng chiến dịch. Chiến dịch tin nhắn chưa có doanh số vì đơn chốt qua inbox không mang mã chiến dịch (nằm ở dòng "chưa gắn chiến dịch").</p>
  ${owners.map(section).join("")||`<section class="card"><p class="empty">Chưa có số liệu trong kỳ này.</p></section>`}
  ${ADF.who||!unSrc.length?"":`<section class="card flush"><div class="card-h pad"><h2>Doanh số chưa gắn chiến dịch, theo nguồn đơn</h2><span class="hint">${lbl} · đơn không mang mã chiến dịch Facebook, ví dụ khách nhắn tin rồi chốt, khách tự vào, chăm sóc</span></div><div class="tbl"><table><thead><tr><th>Nguồn đơn</th><th class="n">Đơn</th><th class="n">Doanh số</th></tr></thead><tbody>${unSrc.map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${nf(x.orders)}</td><td class="n">${money(x.rev)}</td></tr>`).join("")}</tbody></table></div></section>`}
  ${ADF.who?"":adfBillHtml(D,days)}
  <section class="card flush"><div class="card-h pad"><h2>Doanh số theo trang bán hàng (Pancake)</h2><span class="hint">đúng tên "Nguồn đơn" trên Pancake · ${lbl}</span></div><div class="tbl"><table><thead><tr><th>Nguồn đơn</th><th class="n">Đơn</th><th class="n">Doanh số</th></tr></thead><tbody>${links.filter(x=>!ADF.who||x.name.toLowerCase().includes(ADF.who.toLowerCase())).map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${nf(x.orders)}</td><td class="n">${money(x.rev)}</td></tr>`).join("")||`<tr><td colspan="3" class="empty">Chưa có.</td></tr>`}</tbody></table></div></section>`;
  $("#adf-w").onchange=e=>{ADF.who=e.target.value;renderMain()};
  if($("#adf-csv"))$("#adf-csv").onclick=()=>adfBillCsv(D,days);
  m.querySelectorAll("[data-adfo]").forEach(r=>r.onclick=()=>{ADF.open=ADF.open===r.dataset.adfo?"":r.dataset.adfo;renderMain()});
}
/* Có số liệu tự động thì dùng; chưa có thì dùng bản đọc từ file báo cáo Digital. */
function pAdsDay(m){
  adfLoad();
  if(ADF.raw&&ADF.raw.days&&adfData().keys.length)return pAdsFb(m);
  if(!ADF.at){m.innerHTML=H("Báo cáo Ads theo ngày","Đang tải…")+`<section class="card"><p class="empty">Đang tải số liệu…</p></section>`;return}
  return pAdsDaySheet(m);
}

/* ---- Hiệu quả Ads và Ads theo sản phẩm: dùng số tự động theo kỳ chọn ở thanh trên; chưa có số thì giữ bản cũ ---- */
const _adsHQ_old=PAGES.adshieuqua,_adsSP_old=PAGES.adssp;
const adfLive=()=>{adfLoad();return ADF.raw&&ADF.raw.days&&adfData().keys.length?adfData():null};
const adfTarget=(n,mo)=>{const t=D().adsTargets||{},v=(t[mo]||{})[n];if(v!=null)return v;const pv=Object.keys(t).sort().filter(k=>k<=mo).pop();if(pv&&t[pv][n]!=null)return t[pv][n];const p=(KDX.adsPeople||[]).find(x=>String(x.n).includes(n.split(" ").pop()));return p?p.kpi:0};
PAGES.adshieuqua=function(m){
  const D_=adfLive();if(!D_)return _adsHQ_old(m);
  const days=D_.keys.filter(k=>k>=PERIOD.from&&k<=PERIOD.to),{C,unmatched,unOrders}=adfAgg(D_,days),L=C.filter(x=>x.spend||x.rev),T=adfSum(L),mo=PERIOD.to.slice(0,7);
  const whole=PERIOD.from.slice(8)==="01"&&PERIOD.from.slice(0,7)===mo&&new Date(+mo.slice(0,4),+mo.slice(5,7),0).getDate()===+PERIOD.to.slice(8);
  const ed=can(ME,"kehoach.duyet")||can(ME,"viec.giao"),ppl=["Việt Anh","Thảo","Duẩn"].map(w=>{const s=adfSum(L.filter(x=>x.owner===w));return Object.assign(s,{n:w,kpi:adfTarget(w,mo)})});
  const other=adfSum(L.filter(x=>!["Việt Anh","Thảo","Duẩn"].includes(x.owner))),KPI=sum(ppl,p=>p.kpi);
  const months=[...new Set(D_.keys.map(k=>k.slice(0,7)))].map(mm=>{const g=adfAgg(D_,D_.keys.filter(k=>k.slice(0,7)===mm)).C.filter(x=>x.spend||x.rev),by=w=>adfSum(g.filter(x=>x.owner===w)).rev,t=adfSum(g),first=D_.keys.find(k=>k.slice(0,7)===mm);return {m:mm,va:by("Việt Anh"),thao:by("Thảo"),duan:by("Duẩn"),tong:t.rev,cpo:t.cpo,roas:t.roas,part:first&&first.slice(8)!=="01"?first:""}});
  const at=new Date(D_.at);
  m.innerHTML=H("Hiệu quả Ads Facebook",esc(pLabel())+" · 3 bạn chạy Ads: Việt Anh, Thảo, Duẩn")+adfPartial(D_,PERIOD.from,PERIOD.to)+`<div class="grid kpis">${kpi("Chi Ads",tr(T.spend),days.length+" ngày có số")}${kpi("Doanh số mang về",tr(T.rev),whole&&KPI?"mục tiêu "+tr(KPI)+" · đạt "+pc(T.rev,KPI):"Pancake, gắn vào chiến dịch")}${kpi("ROAS",T.spend?(T.rev/T.spend).toFixed(2):"—","trên doanh số chốt")}${kpi("Đơn chốt",nf(T.orders),"chi / đơn "+(T.orders?nf(Math.round(T.spend/T.orders))+"đ":"—"))}${kpi("Chi Ads / doanh số",T.rev?adlPct(T.spend*1.1/T.rev):"—","gồm thuế 10% · mục tiêu ≤ 35%",T.rev&&T.spend*1.1/T.rev>.35?"var(--orange)":"var(--green)")}${kpi("Doanh số chưa gắn chiến dịch",tr(unmatched),nf(unOrders)+" đơn")}</div>
  <div class="note">Tự lấy từ Facebook và Pancake mỗi sáng 8h (lần cuối ${at.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})} ${at.toLocaleDateString("vi-VN")}). Số có tới ngày ${vnd(D_.last)}.</div>
  <section class="card"><div class="card-h"><h2>Bảng xếp hạng nhân sự</h2><span class="hint">xếp theo doanh số mang về${whole?"":" · mục tiêu và % đạt chỉ hiện khi chọn cả tháng"}</span></div>${tbl(["Nhân sự","Mục tiêu doanh số","Doanh số mang về","% đạt mục tiêu","Chi Ads","Chi / doanh số","Đơn chốt","Chi / đơn","ROAS"],ppl.slice().sort((a,b)=>b.rev-a.rev).map((p,i)=>`<tr><td><b>${i+1}. ${esc(p.n)}</b></td><td class="n">${ed?`<input class="num" data-adt="${esc(p.n)}" value="${Math.round(p.kpi/1e6)}" title="triệu đồng, mục tiêu tháng ${mo.slice(5)}" style="width:80px"> tr`:tr(p.kpi)}</td><td class="n">${tr(p.rev)}</td><td class="n">${whole&&p.kpi?pill(pc(p.rev,p.kpi),p.rev>=p.kpi?"grn":"amb"):"—"}</td><td class="n">${tr(p.spend)}</td><td class="n">${p.rev?adlPct(p.spend*1.1/p.rev):"—"}</td><td class="n">${nf(p.orders)}</td><td class="n">${p.orders?nf(Math.round(p.cpo))+"đ":"—"}</td><td class="n">${p.spend?(p.rev/p.spend).toFixed(2):"—"}</td></tr>`).concat(other.spend||other.rev?[`<tr><td>Chưa rõ người (chiến dịch cũ không ghi tên)</td><td class="n">—</td><td class="n">${tr(other.rev)}</td><td class="n">—</td><td class="n">${tr(other.spend)}</td><td class="n">${other.rev?adlPct(other.spend*1.1/other.rev):"—"}</td><td class="n">${nf(other.orders)}</td><td class="n">—</td><td class="n">${other.spend?(other.rev/other.spend).toFixed(2):"—"}</td></tr>`]:[]))}</section>
  <section class="card"><div class="card-h"><h2>Theo tháng</h2><span class="hint">doanh số Pancake gắn vào chiến dịch của từng người</span></div>${tbl(["Tháng","Việt Anh","Thảo","Duẩn","Tổng","Chi / đơn","ROAS"],months.map(r=>`<tr><td><b>${r.m.slice(5)}/${r.m.slice(0,4)}</b>${r.part?`<small>có từ ${vnd(r.part)}</small>`:""}</td><td class="n">${tr(r.va)}</td><td class="n">${tr(r.thao)}</td><td class="n">${tr(r.duan)}</td><td class="n"><b>${tr(r.tong)}</b></td><td class="n">${nf(Math.round(r.cpo))}</td><td class="n">${(+r.roas).toFixed(2)}</td></tr>`))}</section>
  ${srcNote("Facebook Marketing API (chi phí) và Pancake POS (đơn, doanh số), kéo mỗi sáng 8h.")}`;
  m.querySelectorAll("[data-adt]").forEach(i=>i.onchange=()=>{const n=i.dataset.adt,v=Math.round((+String(i.value).replace(",",".")||0)*1e6);DB.mutate(ME.name,`giao mục tiêu Ads tháng ${mo.slice(5)} cho ${n}: ${tr(v)}`,d=>{d.adsTargets=d.adsTargets||{};(d.adsTargets[mo]=d.adsTargets[mo]||{})[n]=v});toast("Đã giao mục tiêu");renderMain()});
};
PAGES.adssp=function(m){
  const D_=adfLive();if(!D_)return _adsSP_old(m);
  const days=D_.keys.filter(k=>k>=PERIOD.from&&k<=PERIOD.to),{C}=adfAgg(D_,days),L=C.filter(x=>x.spend||x.rev),G={};
  L.forEach(x=>{const k=(x.prod||"?")+"|"+x.owner;(G[k]=G[k]||[]).push(x)});
  const rows=Object.values(G).map(a=>({prod:a[0].prod,who:a[0].owner,s:adfSum(a)})).sort((a,b)=>b.s.rev-a.s.rev),T=adfSum(L);
  const old=document.createElement("div");try{_adsSP_old(old)}catch(e){}
  const tran=[...old.querySelectorAll("section.card")].find(s=>/trần/i.test((s.querySelector(".card-h h2")||{}).textContent||""));
  m.innerHTML=H("Ads theo sản phẩm & trần KPI",esc(pLabel()))+adfPartial(D_,PERIOD.from,PERIOD.to)+`<div class="note">Mọi chiến dịch đều được xếp vào sản phẩm theo tên chiến dịch. Chiến dịch tin nhắn cũ không ghi sản phẩm nằm ở dòng "Chưa rõ sản phẩm". Doanh số lấy từ Pancake theo mã chiến dịch.</div>
  <section class="card">${tbl(["Sản phẩm","Người chạy","Chi Ads","Tin nhắn","Đơn","Doanh số","Chi / đơn","ROAS"],rows.map(r=>`<tr><td><b>${esc(ADF_PROD[r.prod]||"Chưa rõ sản phẩm")}</b></td><td>${esc(r.who)}</td><td class="n">${tr(r.s.spend)}</td><td class="n">${nf(r.s.msgs)}</td><td class="n">${nf(r.s.orders)}</td><td class="n">${tr(r.s.rev)}</td><td class="n">${r.s.orders?nf(Math.round(r.s.cpo)):"—"}</td><td class="n">${r.s.spend&&r.s.rev?pill((r.s.rev/r.s.spend).toFixed(2),r.s.rev/r.s.spend>=2.5?"grn":"amb"):"—"}</td></tr>`).concat([`<tr class="tot"><td><b>Tổng</b></td><td></td><td class="n">${tr(T.spend)}</td><td class="n">${nf(T.msgs)}</td><td class="n">${nf(T.orders)}</td><td class="n">${tr(T.rev)}</td><td class="n">${T.orders?nf(Math.round(T.cpo)):"—"}</td><td class="n">${T.spend&&T.rev?(T.rev/T.spend).toFixed(2):"—"}</td></tr>`]))}</section>`;
  if(tran)m.appendChild(tran);
};
PAGES.fb_ads=pAdsDay;
/* =====================================================================
   GIAO DỊCH THANH TOÁN FACEBOOK (Digital Marketing › Giao dịch thanh toán)
   Từng lần Facebook trừ tiền / nạp tiền của tài khoản quảng cáo trong BM, cho kế toán đối soát.
   Nguồn: nhật ký tài khoản quảng cáo; Facebook chỉ giữ khoảng 7 ngày nên máy chủ ghi dồn lại mỗi sáng 8h.
   ===================================================================== */
const ADG={acc:"",kind:""};
/* Facebook ghi số tiền trừ trước VAT; BM hiện số gồm VAT 10% (ví dụ 23.502.990 -> 25.853.289). Nạp tiền không có VAT. */
const vatAmt=b=>b.kind==="tru"?Math.round((b.amount||0)*1.1):(b.amount||0);
function adgCsv(L){
  const NL=String.fromCharCode(10),q=v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"';
  const txt=String.fromCharCode(65279)+["Giờ (VN)","Tài khoản","Mã tài khoản","Loại","Số tiền gồm VAT 10%","Số tiền trước VAT","Tiền tệ","Mã giao dịch"].map(q).join(",")+NL+L.map(b=>[adfDtm(b.time),b.name,b.account,b.kind==="tru"?"Trừ tiền":"Nạp tiền",vatAmt(b),b.amount,b.currency,b.tx].map(q).join(",")).join(NL);
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"text/csv;charset=utf-8"}));a.download="giao-dich-facebook-"+PERIOD.from+"-"+PERIOD.to+".csv";document.body.appendChild(a);a.click();a.remove();
}
/* Theo tháng: tháng chưa có lịch sử giao dịch thì ước tính = chi phí quảng cáo x 1,1 (VAT 10%). Tháng 9 lấy từ báo cáo Digital, các tháng sau lấy từ Facebook. */
function adgMonths(D,bills){
  const P=["Việt Anh","Thảo","Duẩn"],out=[],dig={};
  Object.entries(DAYD.ads||{}).forEach(([nv,days])=>Object.keys(days).forEach(k=>{const m=k.slice(0,7),w=adfWho(nv),w2=w==="Chưa rõ người"?nv:w,o=dig[m]||(dig[m]={});o[w2]=(o[w2]||0)+(+days[k][0]||0)}));
  Object.keys(dig).sort().forEach(m=>{const o=dig[m];out.push({m,src:"báo cáo Digital",p:P.map(w=>o[w]||0),other:Object.entries(o).filter(([w])=>!P.includes(w)).reduce((x,[,v])=>x+v,0)})});
  const last=Object.keys(dig).sort().pop()||"";
  if(D)[...new Set(D.keys.map(k=>k.slice(0,7)))].filter(m=>m>last).sort().forEach(m=>{const g=adfAgg(D,D.keys.filter(k=>k.slice(0,7)===m)).C.filter(x=>x.spend),by=w=>g.filter(x=>x.owner===w).reduce((a,x)=>a+x.spend,0);out.push({m,src:"Facebook",p:P.map(by),other:by("Chưa rõ người")})});
  out.forEach(r=>{r.tot=r.p.reduce((a,b)=>a+b,0)+r.other;r.est=Math.round(r.tot*1.1);const bm=bills.filter(b=>b.kind==="tru"&&adfDt(b.time).slice(0,7)===r.m);r.real=bm.length?bm.reduce((a,b)=>a+vatAmt(b),0):null});
  return out;
}
function pFbGd(m){
  adfLoad();const R=ADF.raw;
  if(!R){m.innerHTML=H("Giao dịch thanh toán Facebook","Đang tải…")+`<section class="card"><p class="empty">Đang tải số liệu…</p></section>`;return}
  const bills=R.billing||[],info=R.acc_info||[],D=adfData(),days=D?D.keys.filter(k=>k>=PERIOD.from&&k<=PERIOD.to):[];
  const inP=bills.filter(b=>{const d=adfDt(b.time);return d>=PERIOD.from&&d<=PERIOD.to});
  const names={};bills.forEach(b=>{if(b.name)names[b.account]=b.name});info.forEach(i=>{if(i.name)names[i.account]=i.name});
  const accIds=[...new Set(bills.map(b=>b.account).concat(info.map(i=>i.account)))];
  const L=inP.filter(b=>(!ADG.acc||b.account===ADG.acc)&&(!ADG.kind||b.kind===ADG.kind));
  const first=bills.length?adfDt(bills[bills.length-1].time):"";
  const spend={};days.filter(k=>!first||k>=first).forEach(k=>((D.days[k]||{}).fb||[]).forEach(c=>{spend[c.account]=(spend[c.account]||0)+(c.spend||0)}));
  const tru=inP.filter(b=>b.kind==="tru"),nap=inP.filter(b=>b.kind==="nap"),sm=a=>a.reduce((x,b)=>x+vatAmt(b),0);
  const rows=accIds.map(a=>{const t=inP.filter(b=>b.account===a&&b.kind==="tru"),n=inP.filter(b=>b.account===a&&b.kind==="nap"),i=info.find(x=>x.account===a)||{};return {a,name:names[a]||a,nTru:t.length,tru:sm(t),nNap:n.length,nap:sm(n),sp:spend[a]||0,spent:i.amount_spent,bal:i.balance}}).filter(r=>r.nTru||r.nNap||r.sp).sort((x,y)=>y.tru-x.tru);
  const T=rows.reduce((o,r)=>({tru:o.tru+r.tru,nap:o.nap+r.nap,sp:o.sp+r.sp,spent:o.spent+(r.spent||0),bal:o.bal+(r.bal||0)}),{tru:0,nap:0,sp:0,spent:0,bal:0});
  const at=new Date(R.at);
  m.innerHTML=ADF_CSS+H("Giao dịch thanh toán Facebook","Lấy từ Business Manager · lần cuối "+at.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+" "+at.toLocaleDateString("vi-VN"))+`
  <div class="filters"><select id="adg-a">${opt([["","Tất cả tài khoản"]].concat(accIds.map(a=>[a,names[a]||a])),ADG.acc)}</select>
  <select id="adg-k">${opt([["","Trừ tiền và nạp tiền"],["tru","Chỉ trừ tiền"],["nap","Chỉ nạp tiền"]],ADG.kind)}</select>
  <span class="hint">Chọn kỳ ở thanh thời gian phía trên. Facebook chỉ giữ nhật ký khoảng 7 ngày, máy chủ ghi lại từ ${first?vnd(first):"—"}; khoản cũ hơn tải tay file giao dịch từ Facebook.</span>
  <button class="btn" id="adg-csv" style="margin-left:auto">Tải Excel (CSV)</button></div>
  <div class="grid kpis">${kpi("Tiền Facebook đã trừ (gồm VAT 10%)",nf(T.tru)+"đ",tru.length+" lần · "+esc(pLabel()))}${kpi("Tiền đã nạp",nf(T.nap)+"đ",nap.length+" lần")}${kpi("Chi phí quảng cáo cùng giai đoạn",nf(Math.round(T.sp))+"đ",first?"từ "+vnd(first)+", theo báo cáo chiến dịch":"theo báo cáo chiến dịch")}${kpi("Dư nợ hiện tại",info.length?nf(T.bal)+"đ":"—","Facebook chưa trừ")}${kpi("Tổng đã chi từ trước tới nay",info.length?nf(T.spent)+"đ":"—","cộng các tài khoản")}</div>
  <section class="card flush"><div class="card-h pad"><h2>Theo tháng</h2><span class="hint">tiền Facebook trừ ước tính = chi phí quảng cáo × 1,1 (VAT 10%); có giao dịch BM thì hiện thêm số thực tế</span></div><div class="tbl"><table><thead><tr><th>Tháng</th><th class="n">Việt Anh</th><th class="n">Thảo</th><th class="n">Duẩn</th><th class="n">Chưa rõ người</th><th class="n">Tổng chi phí quảng cáo</th><th class="n">Tiền Facebook trừ ước tính (× 1,1)</th><th class="n">Giao dịch thực tế trong BM (gồm VAT)</th></tr></thead><tbody>${adgMonths(D,bills).map(r=>`<tr><td><b>${r.m.slice(5)}/${r.m.slice(0,4)}</b><small>nguồn: ${r.src}</small></td>${r.p.map(v=>`<td class="n">${v?nf(Math.round(v)):"—"}</td>`).join("")}<td class="n">${r.other?nf(Math.round(r.other)):"—"}</td><td class="n">${nf(Math.round(r.tot))}</td><td class="n"><b>${nf(r.est)}</b></td><td class="n">${r.real==null?"chưa có (máy ghi từ "+(first?vnd(first):"—")+")":nf(r.real)}</td></tr>`).join("")||`<tr><td colspan="8" class="empty">Chưa có số.</td></tr>`}</tbody></table></div></section>
  <section class="card flush"><div class="card-h pad"><h2>Theo từng tài khoản quảng cáo</h2><span class="hint">${esc(pLabel())}</span></div><div class="tbl"><table><thead><tr><th>Tài khoản</th><th class="n">Số lần trừ</th><th class="n">Tiền bị trừ (gồm VAT)</th><th class="n">Số lần nạp</th><th class="n">Tiền nạp</th><th class="n">Chi phí quảng cáo cùng giai đoạn</th><th class="n">Dư nợ hiện tại</th><th class="n">Tổng đã chi từ trước</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.name)}</b><small class="mono">${esc(r.a)}</small></td><td class="n">${nf(r.nTru)}</td><td class="n">${nf(r.tru)}</td><td class="n">${nf(r.nNap)}</td><td class="n">${nf(r.nap)}</td><td class="n">${nf(Math.round(r.sp))}</td><td class="n">${r.bal==null?"—":nf(r.bal)}</td><td class="n">${r.spent==null?"—":nf(r.spent)}</td></tr>`).join("")||`<tr><td colspan="8" class="empty">Chưa có giao dịch trong kỳ này.</td></tr>`}<tr class="tot"><td><b>Tổng</b></td><td class="n"></td><td class="n">${nf(T.tru)}</td><td class="n"></td><td class="n">${nf(T.nap)}</td><td class="n">${nf(Math.round(T.sp))}</td><td class="n">${nf(T.bal)}</td><td class="n">${nf(T.spent)}</td></tr></tbody></table></div></section>
  <section class="card flush"><div class="card-h pad"><h2>Từng lần trừ tiền, nạp tiền</h2><span class="hint">${L.length} giao dịch${L.length>400?" · hiện 400 dòng đầu, tải Excel để lấy đủ":""}</span></div><div class="tbl"><table><thead><tr><th>Giờ (VN)</th><th>Tài khoản</th><th>Loại</th><th class="n">Số tiền gồm VAT 10% (đ)</th><th class="n">Trước VAT (đ)</th><th>Mã giao dịch</th></tr></thead><tbody>${L.slice(0,400).map(b=>`<tr><td>${adfDtm(b.time)}</td><td>${esc(b.name||b.account)}</td><td>${b.kind==="tru"?"Trừ tiền":"Nạp tiền"}</td><td class="n"><b>${nf(vatAmt(b))}</b></td><td class="n">${b.kind==="tru"?nf(b.amount):"—"}</td><td class="mono">${esc(b.tx||"")}</td></tr>`).join("")||`<tr><td colspan="6" class="empty">Chưa có giao dịch nào trong kỳ và bộ lọc này.</td></tr>`}</tbody></table></div></section>
  ${srcNote("Nhật ký tài khoản quảng cáo của Facebook (Marketing API), máy chủ ghi lại mỗi sáng 8h. Dư nợ và tổng đã chi lấy trực tiếp từ từng tài khoản.")}`;
  $("#adg-a").onchange=e=>{ADG.acc=e.target.value;renderMain()};
  $("#adg-k").onchange=e=>{ADG.kind=e.target.value;renderMain()};
  $("#adg-csv").onclick=()=>adgCsv(L);
}
PAGES.fb_gd=pFbGd;
/* Thêm tab "Giao dịch thanh toán" vào nhóm Digital Marketing (không sửa file menu chung). */
(function(){try{
  const st=PAGE_SETS.find(x=>x.n==="Digital Marketing");
  if(st&&!st.ids.includes("fb_gd")){const i=st.ids.indexOf("fb_ads")+1;st.ids.splice(i,0,"fb_gd");st.labels.splice(i,0,"Giao dịch thanh toán")}
  const mk=MODULES.find(x=>x.k==="mkt");
  if(mk&&!mk._gd){mk._gd=1;const g0=mk.groups;mk.groups=function(){const r=g0.apply(this,arguments);r.forEach(gr=>{const arr=gr[1],j=arr.findIndex(it=>it&&it[0]==="fb_ads");if(j>=0&&!arr.some(it=>it&&it[0]==="fb_gd"))arr.splice(j+1,0,MI("fb_gd","Giao dịch thanh toán",tm("ads",dgOk)))});return r}}
}catch(e){console.warn("menu giao dịch",e)}})();

