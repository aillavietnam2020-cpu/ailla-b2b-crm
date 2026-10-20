/* =====================================================================
   BÁO CÁO ADS THEO NGÀY (Marketing › Quảng cáo › Chi theo ngày)
   Lấy thẳng file "BÁO CÁO DIGITAL MKT 2026 FINAL" của team Digital: VPS đọc 3 tab
   Ads Việt Anh / Thảo / Duẩn mỗi sáng 8h và đẩy lên máy chủ (blob ads_live).
   Mỗi tab: các khối sản phẩm (SYS_ID, ví dụ RUOI_CD, MUOI_MESS) × chỉ số × ngày 1–31.
   ===================================================================== */
const ADL={raw:null,at:0,busy:false,who:"",day:"",open:""};
async function adlLoad(force){
  if(typeof svApi!=="function"||ADL.busy||(!force&&Date.now()-ADL.at<1800000))return;ADL.busy=true;
  try{const r=await svApi("/api/hub/blob/ads_live");const ch=JSON.stringify(r)!==JSON.stringify(ADL.raw);ADL.raw=r;ADL.at=Date.now();if(ch&&PAGE==="fb_ads"&&!svTyping())renderMain()}catch(e){}finally{ADL.busy=false}
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
  try{const r=await svApi("/api/hub/blob/ads_fb");const ch=JSON.stringify(r)!==JSON.stringify(ADF.raw);ADF.raw=r;ADF.at=Date.now();if(ch&&(PAGE==="fb_ads"||PAGE==="dg_tq"||PAGE==="adshieuqua"||PAGE==="adssp")&&!svTyping())renderMain()}catch(e){}finally{ADF.busy=false}
}
const ADF_ACC={"2438831049860777":"Việt Anh","1721213761771236":"Việt Anh","1340771911416054":"Thảo","187878951968758":"Thảo","1354614543145294":"Thảo"};
const ADF_PROD={TLAI:"Tẩy lồng Ailla (TLAi)",AIBIO:"Tẩy lồng Aibio",TLG:"Tẩy lồng giặt (TLG)",TINHDAU:"Tinh dầu giặt sấy",LS:"Nước lau sàn",MUOI:"Xịt muỗi",RUOI:"Xịt ruồi"};
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
  return {days:r.days,keys,names,last,at:r.at};
}
const adfPeriod=(D,per)=>{
  const mo=D.last.slice(0,7);
  if(per==="m0")return D.keys.filter(k=>k.slice(0,7)===mo);
  if(per==="m1"){const t=new Date(+mo.slice(0,4),+mo.slice(5,7)-2,1),p=t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0");return D.keys.filter(k=>k.slice(0,7)===p)}
  if(per==="d7")return D.keys.filter(k=>k<=D.last).slice(-7);
  return D.keys.filter(k=>k===per);
};
function adfAgg(D,days){
  const C={},US={};let unmatched=0,unOrders=0;
  const get=(id)=>C[id]||(C[id]=Object.assign({id,spend:0,msgs:0,orders:0,rev:0},(()=>{const nm=D.names[id]||{};const p=adfParse(nm.name,nm.account);return {name:nm.name||"",account:nm.account||"",owner:p.owner,prod:p.prod,typ:p.typ}})()));
  days.forEach(k=>{const d=D.days[k];if(!d)return;
    (d.fb||[]).forEach(c=>{const x=get(c.campaign_id);x.spend+=c.spend||0;x.msgs+=c.messages||0});
    (d.pos||[]).forEach(p=>{if(p.campaign_id&&D.names[p.campaign_id]){const x=get(p.campaign_id);x.orders+=p.orders||0;x.rev+=p.revenue||0}else{unmatched+=p.revenue||0;unOrders+=p.orders||0;const sn=p.source||"(chưa rõ nguồn)";const u=US[sn]||(US[sn]={name:sn,orders:0,rev:0});u.orders+=p.orders||0;u.rev+=p.revenue||0}});
  });
  const links={};days.forEach(k=>((D.days[k]||{}).link||[]).forEach(l=>{const key=l.name||"(trang chưa có tên)";const t=links[key]||(links[key]={name:key,orders:0,rev:0});t.orders+=l.orders||0;t.rev+=l.revenue||0}));
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
/* Bảng từng ngày như file Excel: mỗi chỉ số một hàng, mỗi ngày một cột, có cột Tổng. */
function adfDaily(D,keys,ids){
  const pick=k=>adfSum(adfAgg(D,k).C.filter(c=>ids.has(c.id))),per=keys.map(k=>pick([k])),tot=pick(keys);
  const R=[["Chi Ads",s=>s.spend?nf(Math.round(s.spend)):""],["Tin nhắn",s=>s.msgs?nf(s.msgs):""],["Giá tin nhắn",s=>s.msgs?nf(Math.round(s.giaMsg)):""],["Đơn",s=>s.orders?nf(s.orders):""],["Doanh số",s=>s.rev?nf(Math.round(s.rev)):""],["Chi/đơn",s=>s.orders?nf(Math.round(s.cpo)):""],["% CP/DS",s=>s.rev?adlPct(s.pct):""],["ROAS",s=>s.spend&&s.rev?adlR(s.roas):""]];
  return `<div class="tbl adl-days"><table><thead><tr><th>Chỉ số</th><th class="n">Tổng</th>${keys.map(k=>`<th class="n">${+k.slice(8)}/${+k.slice(5,7)}</th>`).join("")}</tr></thead><tbody>${R.map(([n,f])=>`<tr><td><b>${n}</b></td><td class="n"><b>${f(tot)}</b></td>${per.map(s=>`<td class="n">${f(s)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function pAdsFb(m){
  const D=adfData(),{C,unmatched,unOrders,unSrc,links}=adfAgg(D,adfPeriod(D,ADF.per)),days=adfPeriod(D,ADF.per);
  const L=C.filter(x=>x.spend||x.rev),owners=["Việt Anh","Thảo","Duẩn","Chưa rõ người"].filter(w=>L.some(x=>x.owner===w)&&(!ADF.who||ADF.who===w));
  const T=adfSum(ADF.who?L.filter(x=>x.owner===ADF.who):L),at=new Date(D.at),atS=at.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+" "+at.toLocaleDateString("vi-VN");
  const lbl=days.length?(days.length===1?"ngày "+days[0].slice(8)+"/"+days[0].slice(5,7):`${days[0].slice(8)}/${days[0].slice(5,7)} – ${days[days.length-1].slice(8)}/${days[days.length-1].slice(5,7)}`):"";
  const cells=s=>`<td class="n">${s.spend?money(s.spend):"—"}</td><td class="n">${s.msgs?nf(s.msgs):"—"}</td><td class="n">${s.msgs?money(s.giaMsg):"—"}</td><td class="n">${s.orders?nf(s.orders):"—"}</td><td class="n">${s.rev?money(s.rev):"—"}</td><td class="n">${s.orders?money(s.cpo):"—"}</td><td class="n">${s.rev?adlPct(s.pct):"—"}</td><td class="n"><b>${s.spend&&s.rev?adlR(s.roas):"—"}</b></td>`;
  const HEAD=`<thead><tr><th>Mã · sản phẩm</th><th class="n">Chi Ads</th><th class="n">Tin nhắn</th><th class="n">Giá tin nhắn</th><th class="n">Đơn</th><th class="n">Doanh số</th><th class="n">Chi/đơn</th><th class="n">% CP/DS</th><th class="n">ROAS</th></tr></thead>`;
  const section=w=>{const mine=L.filter(x=>x.owner===w),G={};mine.forEach(x=>{const k=(x.prod||"?")+"|"+x.typ;(G[k]||(G[k]=[])).push(x)});
    const rows=Object.entries(G).map(([k,a])=>({k:w+"|"+k,prod:a[0].prod,typ:a[0].typ,list:a,s:adfSum(a)})).sort((a,b)=>b.s.spend-a.s.spend);
    const ids=l=>new Set(l.map(c=>c.id)),allKey=w+"|ALL";
    return `<section class="card flush"><div class="card-h pad"><h2>${esc(w)}</h2><span class="hint">${mine.length} chiến dịch · ${lbl} · bấm một dòng để xem từng ngày</span></div><div class="tbl"><table>${HEAD}<tbody>${rows.map(r=>`<tr class="clk${ADF.open===r.k?" on":""}" data-adfo="${esc(r.k)}"><td><b>${esc(ADF_PROD[r.prod]||"Chưa rõ sản phẩm")}</b><small>${r.typ} · ${r.list.length} chiến dịch</small></td>${cells(r.s)}</tr>${ADF.open===r.k?`<tr class="sub"><td colspan="9">${adfDaily(D,days,ids(r.list))}<div class="tbl"><table><tbody>${r.list.slice().sort((a,b)=>b.spend-a.spend).map(c=>`<tr><td><span class="mono">${esc(c.name||c.id)}</span></td>${cells(adfSum([c]))}</tr>`).join("")}</tbody></table></div></td></tr>`:""}`).join("")}<tr class="tot clk${ADF.open===allKey?" on":""}" data-adfo="${esc(allKey)}"><td><b>Tổng ${esc(w)}</b><small>bấm để xem từng ngày</small></td>${cells(adfSum(mine))}</tr>${ADF.open===allKey?`<tr class="sub"><td colspan="9">${adfDaily(D,days,ids(mine))}</td></tr>`:""}</tbody></table></div></section>`};
  const perOpt=[["m0","Tháng "+D.last.slice(5,7)+" (từ đầu tháng)"],["d7","7 ngày gần nhất"]].concat(D.keys.some(k=>k.slice(0,7)!==D.last.slice(0,7))?[["m1","Tháng trước (phần đã có)"]]:[]).concat(D.keys.filter(k=>k<=D.last).slice(-14).reverse().map(k=>[k,"Ngày "+k.slice(8)+"/"+k.slice(5,7)]));
  const part=days.length?adfPartial(D,ADF.per==="m1"?D.keys[0].slice(0,7)+"-01":days[0].slice(0,7)+"-01",""):"";
  m.innerHTML=H("Báo cáo Ads theo ngày",`Tự lấy từ Facebook (chi phí, tin nhắn) và Pancake (đơn, doanh số) mỗi sáng · lần cuối ${atS}`)+`
  <div class="filters"><select id="adf-w">${opt([["","Tất cả người chạy"]].concat(["Việt Anh","Thảo","Duẩn"].map(w=>[w,w])),ADF.who)}</select>
  <select id="adf-p">${opt(perOpt,ADF.per)}</select>
  <span class="hint">Doanh số lấy từ Pancake, ghép vào chiến dịch theo mã chiến dịch trên đơn. Người, sản phẩm, loại đọc từ tên chiến dịch (VA, DUAN, TĐ…).</span></div>
  ${ADF.per==="m0"||ADF.per==="m1"?part:""}<div class="grid kpis">${kpi("Chi Ads",money(T.spend),lbl)}${kpi("Tin nhắn",nf(T.msgs),T.msgs?"giá "+money(T.giaMsg):"")}${kpi("Đơn (Pancake)",nf(T.orders),"gắn được vào chiến dịch")}${kpi("Doanh số (Pancake)",money(T.rev),T.orders?"TB đơn "+money(T.rev/T.orders):"")}${kpi("ROAS",adlR(T.roas),"doanh số / chi ads")}${kpi("% CP / doanh số",T.rev?adlPct(T.pct):"—","chi phí gồm thuế 10%")}${ADF.who?"":kpi("Doanh số chưa gắn chiến dịch",money(unmatched),nf(unOrders)+" đơn · khách tự vào, tin nhắn, chăm sóc")}</div>
  <p class="hint">Bấm một dòng để xem từng chiến dịch. Chiến dịch tin nhắn chưa có doanh số vì đơn chốt qua inbox không mang mã chiến dịch (nằm ở dòng "chưa gắn chiến dịch").</p>
  ${owners.map(section).join("")||`<section class="card"><p class="empty">Chưa có số liệu trong kỳ này.</p></section>`}
  ${ADF.who||!unSrc.length?"":`<section class="card flush"><div class="card-h pad"><h2>Doanh số chưa gắn chiến dịch, theo nguồn đơn</h2><span class="hint">${lbl} · đơn không mang mã chiến dịch Facebook, ví dụ khách nhắn tin rồi chốt, khách tự vào, chăm sóc</span></div><div class="tbl"><table><thead><tr><th>Nguồn đơn</th><th class="n">Đơn</th><th class="n">Doanh số</th></tr></thead><tbody>${unSrc.map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${nf(x.orders)}</td><td class="n">${money(x.rev)}</td></tr>`).join("")}</tbody></table></div></section>`}
  <section class="card flush"><div class="card-h pad"><h2>Doanh số theo trang bán hàng (Pancake)</h2><span class="hint">đúng tên "Nguồn đơn" trên Pancake · ${lbl}</span></div><div class="tbl"><table><thead><tr><th>Nguồn đơn</th><th class="n">Đơn</th><th class="n">Doanh số</th></tr></thead><tbody>${links.filter(x=>!ADF.who||x.name.toLowerCase().includes(ADF.who.toLowerCase())).map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${nf(x.orders)}</td><td class="n">${money(x.rev)}</td></tr>`).join("")||`<tr><td colspan="3" class="empty">Chưa có.</td></tr>`}</tbody></table></div></section>`;
  $("#adf-w").onchange=e=>{ADF.who=e.target.value;renderMain()};
  $("#adf-p").onchange=e=>{ADF.per=e.target.value;renderMain()};
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
