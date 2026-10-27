/* =====================================================================
   TỔNG QUAN CÔNG TY (trang quản trị) = Tổng quan cũ + Phòng điều hành gộp làm một, chị Hoa duyệt 25/10/2026.
   Tab: Hôm nay · Lãi theo kênh · Giá thành & cảnh báo · Tiền & cảnh báo · Tháng chốt · Thiết lập.
   MỘT định nghĩa doanh thu cho mọi chỗ trên trang quản trị = DOANH THU THỰC (chị chốt):
   - TikTok: doanh thu thuần theo báo cáo quyết toán tháng đã lưu; tháng chưa chốt = tạm tính
     (số đơn xuất kho thật từ Poscake × giá trị đơn trung bình tháng chốt gần nhất), KHÔNG dùng GMV.
   - Facebook: doanh thu đơn GIAO THÀNH CÔNG (Pancake). Không nhân tỷ lệ ước. Đơn đang giao ghi riêng, không cộng.
   - Shopee: số theo ngày nếu có; chưa có thì chỉ ghi số đơn xuất kho (Poscake).
   - Kênh phân phối, Kênh OEM: đơn đã duyệt trên CRM (b2bpl.js).
   Lãi = lãi đóng góp kênh (chưa trừ lương, chi phí chung). Ghi rõ nguồn dưới mỗi số.
   ===================================================================== */
const TQ={co:{},coBusy:{}};
/* Số đơn xuất kho Poscake theo kênh trong khoảng ngày (null khi chưa tải xong). */
function tqCo(from,to){const k=from+"|"+to;if(TQ.co[k]!==undefined)return TQ.co[k];if(!TQ.coBusy[k]){TQ.coBusy[k]=1;svApi("/api/hub/dieuhanh/channel-orders?from="+from+"&to="+to).then(r=>{const o={};(r||[]).forEach(x=>{o[x.channel]=(o[x.channel]||0)+(+x.orders||0)});TQ.co[k]=o}).catch(()=>{TQ.co[k]={}}).finally(()=>{TQ.coBusy[k]=0;if(["exec","bc_tong","pl","muctieu"].includes(PAGE))renderMain()})}return null}
const tqMonths=(from,to)=>{const ms=[];for(let d=pdate(from.slice(0,7)+"-01");iso(d)<=to;d=new Date(d.getFullYear(),d.getMonth()+1,1))ms.push(iso(d).slice(0,7));return ms};
/* Doanh thu thực + lãi đóng góp từng kênh Kênh bán lẻ trong khoảng ngày. N = số gốc của execNums (trước khi đổi). */
function tqRevB2C(N,from,to){
  const ms=tqMonths(from,to),full=ms.every(k=>fullMonth(k,from,to)),S=(typeof TSB!=="undefined"&&TSB.sum)||{},rs=(i,src)=>rSum(src,i,from,to).v,co=tqCo(from,to)||{};
  const out={};
  /* TikTok: từng tháng trong kỳ, CHỈ lấy doanh thu thực từ báo cáo đã tải (chốt sổ hoặc giữa tháng "đến ngày X"; tải hàng tuần).
     Ngày sau lần tải gần nhất để trống, ghi "chờ tải báo cáo" — không ước từ Poscake (chị Hoa 27/10: không lấy số ước). */
  {const vn=d=>d.slice(8,10)+"/"+d.slice(5,7);
   let dt=0,gv=0,phi=0,ads=0,khac=0,lai=0,don=0,den="",parts=[],cho=[],got=false;
   ms.forEach(k=>{const s=S[k],mEnd=k+"-"+String(ttKyDays(k)).padStart(2,"0"),a=from>k+"-01"?from:k+"-01",b=to<mEnd?to:mEnd;
     let upto="";
     if(s&&s.dt){const cov=s.den||mEnd,wholeMonth=a===k+"-01"&&b>=cov;
       let pdt=0,pdon=0;
       if(wholeMonth&&(!s.den||b>=s.den)){pdt=s.dt;pdon=s.don}
       else if(s.days){Object.entries(s.days).forEach(([d,x])=>{if(d>=a&&d<=b&&d<=cov){pdt+=+x[0]||0;pdon+=+x[1]||0}})}
       else{const nd=Math.max(0,(pdate(b<cov?b:cov)-pdate(a))/864e5+1),tot=+cov.slice(8,10);pdt=s.dt*nd/tot;pdon=s.don*nd/tot}
       const r=s.dt?pdt/s.dt:0;dt+=pdt;don+=pdon;gv+=s.gv*r;phi+=-s.phi*r;ads+=s.ads*r;khac+=((s.extraT||0)-(s.adj||0))*r;lai+=s.lai*r;got=true;
       upto=cov<b?cov:b;if(upto>den)den=upto;parts.push(s.den?`báo cáo đến ${vn(s.den)}`:"báo cáo chốt sổ")}
     const ta=upto?iso(addD(pdate(upto),1)):a,today=iso(new Date()),tb=b<today?b:today;
     if(ta<=tb)cho.push(ta===tb?vn(ta):`${vn(ta)}–${vn(tb)}`)});
   const choTxt=cho.length?` · chờ tải báo cáo ngày ${cho.join(", ")}`:"";
   if(got)out.tts={dt,gv,phi,ads,khac,lai,don,tam:false,den,thieu:cho.length>0,src:"doanh thu thuần · "+parts.join(" · ")+(den?` · có số đến ngày ${vn(den)} từ báo cáo tải lên`:"")+choTxt};
   else out.tts={dt:null,lai:null,don:null,src:"chờ tải báo cáo TikTok"+(cho.length?" ngày "+cho.join(", "):"")+" (Tổng quan › Doanh thu › TikTok Shop › Tải file tháng)"}}
  /* Facebook: giao thành công */
  {const dtG=rs(5,"fb"),dtC=rs(6,"fb"),giao=rs(4,"fb"),chot=rs(1,"fb"),hoan=rs(3,"fb"),gvC=rs(7,"fb");
   if(dtG>0){const Dd=(typeof KDX!=="undefined"&&KDX.fbDash)||{},pr=Dd.dt>0?(-(+Dd.vc||0)-(+Dd.hoan||0))/Dd.dt+0.015:0.015,gv=dtC?gvC*dtG/dtC:0,ads=rAds(0,from,to)*(1+(typeof FB_ADS_TAX!=="undefined"?FB_ADS_TAX:0.1)),phi=dtG*pr;
     out.fb={dt:dtG,gv,phi,ads,khac:0,lai:dtG-gv-phi-ads,don:giao,dang:Math.max(0,chot-giao-hoan),dangDt:Math.max(0,dtC-dtG),src:`giao thành công · Pancake · phí ship và thuế ${(pr*100).toFixed(1).replace(".",",")}%`,tam:false}}
   else out.fb={dt:null,lai:null,don:null,src:"chờ dữ liệu Pancake"}}
  /* Shopee */
  {const dt=rs(0,"spe");if(dt>0){const gv=rs(2,"spe"),phi=-rs(1,"spe");out.spe={dt,gv,phi,ads:0,khac:0,lai:dt-gv-phi,don:rs(4,"spe"),src:"doanh thu Shopee theo ngày (chưa trừ Shopee Ads)",tam:false}}
   else{const don=co.SHOPEE||0;out.spe={dt:null,lai:null,don:don||null,src:don?`chờ tải báo cáo Shopee · đã có ${nf(don)} đơn xuất kho (Poscake)`:"chờ tải báo cáo Shopee"}}}
  return out;
}
/* Mọi chỗ dùng execNums (Tổng quan, Báo cáo kết quả kinh doanh; cả web vận hành từ 27/10) nhận doanh thu thực.
   Chỉ tài khoản CEO / kế toán (dhOk) mới có số báo cáo TikTok nên người khác giữ số cũ. */
{const _en=execNums;execNums=function(from,to){const N=_en(from,to);
  if(!dhOk())return N;
  try{const R=tqRevB2C(N,from,to);N.raw={tt:N.tt,fbDT:N.fbDT,spDT:N.spDT,tong:N.tong};N.rev=R;
    N.tt=R.tts.dt||0;N.fbDT=R.fb.dt||0;N.fbGiao=R.fb.dt||0;N.spDT=R.spe.dt||0;N.tong=N.tt+N.fbDT+N.spDT;
    N.L.tts=R.tts.lai;N.L.fb=R.fb.lai;N.L.spe=R.spe.lai;
    N.C.gvTT=R.tts.gv||0;N.C.phiTT=R.tts.phi||0;N.C.adsTT=R.tts.ads||0;N.C.khacTT=R.tts.khac||0;N.C.gvFB=R.fb.gv||0;N.C.adsFB=R.fb.ads||0;N.C.phiFB=R.fb.phi||0;
    N.n.tts=R.tts.dt?1:0;N.n.fb=R.fb.dt?1:0;N.n.spe=R.spe.dt?1:0}catch(e){}
  return N}}
{const _o=execOrders;execOrders=function(from,to){const O=_o(from,to);if(!dhOk())return O;try{const R=execNums(from,to).rev;if(R){O.tts=R.tts.don||0;O.fb=R.fb.don||0;O.spe=R.spe.don||0}}catch(e){}return O}}

/* Bảng kênh: mỗi kênh một dòng, doanh thu thực và lãi đóng góp (một chỗ duy nhất trên trang). */
function tqKenhRows(){
  const N=execNums(PERIOD.from,PERIOD.to),R=N.rev||{},B=typeof b2bChannel==="function"?b2bChannel("B2B"):null,G=typeof b2bChannel==="function"?b2bChannel("GIA_CONG"):null;
  const susp=ch=>{if(typeof B2BR==="undefined"||!B2BR.data)return [];return B2BR.data.lines.filter(l=>l.channel===ch&&!(+l.revenue>0)).map(l=>{const u=b2bUnitCost(l.sku,l.month);return {...l,cost:u==null?0:u*(+l.qty||0)}}).filter(l=>l.cost>5e6)};
  const b2b=(X,ch,n,go,src)=>{if(!X)return {k:ch,n,go,mang:ch==="GIA_CONG"?"Gia công":"Phân phối",dt:null,lai:null,src:"đang tải…"};if(!X.has)return {k:ch,n,go,mang:ch==="GIA_CONG"?"Gia công":"Phân phối",dt:0,lai:0,don:0,src:ch==="GIA_CONG"?"không có đơn gia công trong kỳ":"không có đơn trong kỳ"};
    const sp=susp(ch),ex=sp.reduce((a,l)=>a+l.cost,0);
    if(!X.cover)return {k:ch,n,go,mang:ch==="GIA_CONG"?"Gia công":"Phân phối",dt:X.net,gv:null,phi:0,ads:0,lai:null,don:X.orders,src:src+" · chưa có giá vốn nên chưa tính lãi"};
    return {k:ch,n,go,mang:ch==="GIA_CONG"?"Gia công":"Phân phối",dt:X.net,gv:X.costAll-ex,phi:0,ads:0,lai:X.gross+ex,don:X.orders,src:src+(X.cover<0.95?` · ${(100-X.cover*100).toFixed(1).replace(".",",")}% doanh thu ước tính giá vốn`:"")+(ex?` · đã tạm loại ${tr(ex)} giá vốn dòng giá 0đ nghi nhập sai`:""),susp:sp}};
  const ch=(k,n,go)=>({k,n,go,mang:"Bán lẻ",...(R[k]||{dt:null,lai:null,src:"chờ tải báo cáo"})});
  return [ch("tts","TikTok Shop","bc_tiktok"),ch("fb","Facebook","bc_fb"),ch("spe","Shopee","bc_shopee"),b2b(B,"B2B","Kênh phân phối","bc_b2b","đơn đã duyệt · CRM"),b2b(G,"GIA_CONG","Kênh OEM","bc_gc","đơn đã duyệt · CRM")];
}
function tqTot(rows){const has=rows.filter(r=>r.dt!=null);return {dt:has.reduce((a,r)=>a+r.dt,0),lai:has.filter(r=>r.lai!=null).reduce((a,r)=>a+r.lai,0),cp:has.reduce((a,r)=>a+(r.gv||0)+(r.phi||0)+(r.ads||0)+(r.khac||0),0),don:rows.reduce((a,r)=>a+(+r.don||0),0),tam:has.some(r=>r.tam),thieu:rows.filter(r=>r.dt==null).map(r=>r.n)}}
function tqTabKenh(){
  const rows=tqKenhRows(),T=tqTot(rows),ng=dhGet().nguong;
  const warn=r=>{const w=[];if(r.dt&&r.ads/r.dt>ng.qcMax)w.push(pill(`quảng cáo ${dhPct(r.ads/r.dt)} doanh thu`,"red"));if(r.dt&&r.lai!=null&&r.lai/r.dt<ng.bienKenh)w.push(pill("biên dưới "+dhPct(ng.bienKenh),"amb"));if(r.tam)w.push(pill("tạm tính","blu"));if(r.dt==null)w.push(pill("chờ tải báo cáo","gry"));return w.join(" ")};
  const row=r=>`<tr class="clk" data-go="${r.go}"><td><b>${r.n}</b><br><small class="hint">${esc(r.src||"")}</small>${r.dang?`<br><small class="hint">đang giao, chưa tính: ${nf(r.dang)} đơn · ${tr(r.dangDt)}</small>`:""}</td><td class="n">${r.dt==null?"—":r.dt===0?"0 đ":tr(r.dt)}</td><td class="n">${r.don?nf(r.don):r.dt===0?"0":"—"}</td><td class="n">${r.gv?tr(r.gv):"—"}</td><td class="n">${r.phi?tr(r.phi):"—"}</td><td class="n">${r.ads?tr(r.ads):"—"}</td><td class="n"><b class="${r.lai<0?"t-red":""}">${r.lai==null?"—":tr(r.lai)}</b></td><td class="n">${r.dt&&r.lai!=null?dhPct(r.lai/r.dt):"—"}</td><td>${warn(r)}</td></tr>`;
  const sub=(m)=>{const R=rows.filter(r=>r.mang===m),t=tqTot(R);return `<tr class="tot"><td>${m}</td><td class="n">${tr(t.dt)}</td><td class="n">${t.don?nf(t.don):"—"}</td><td></td><td></td><td></td><td class="n">${tr(t.lai)}</td><td class="n">${t.dt?dhPct(t.lai/t.dt):"—"}</td><td></td></tr>`};
  return `<section class="card flush"><div class="card-h pad"><h2>Lãi theo kênh</h2><span class="hint">${esc(pLabel())} · doanh thu thực · lãi đóng góp (chưa trừ lương, chi phí chung)</span></div>
   <div class="tbl"><table><thead><tr><th>Kênh · nguồn số</th><th class="n">Doanh thu thực</th><th class="n">Đơn</th><th class="n">Giá vốn</th><th class="n">Phí sàn / ship, thuế</th><th class="n">Quảng cáo</th><th class="n">Lãi đóng góp</th><th class="n">Biên</th><th>Cảnh báo</th></tr></thead><tbody>
   ${rows.filter(r=>r.mang==="Bán lẻ").map(row).join("")}${sub("Bán lẻ")}${rows.filter(r=>r.mang!=="Bán lẻ").map(row).join("")}
   <tr class="tot"><td><b>Tổng công ty</b>${T.thieu.length?`<br><small class="hint">chờ tải báo cáo: ${esc(T.thieu.join(", "))}</small>`:""}</td><td class="n"><b>${tr(T.dt)}</b></td><td class="n">${nf(T.don)}</td><td></td><td></td><td></td><td class="n"><b>${tr(T.lai)}</b></td><td class="n">${T.dt?dhPct(T.lai/T.dt):"—"}</td><td></td></tr></tbody></table></div>
   <p class="hint pad">Doanh thu thực: TikTok là doanh thu thuần theo quyết toán (tháng chưa chốt thì tạm tính từ đơn xuất kho, không dùng GMV); Facebook là đơn giao thành công (đơn đang giao chưa tính); Kênh phân phối, Kênh OEM là đơn đã duyệt. Bấm từng dòng để xem chi tiết kênh.</p></section>`+dhTabBaTang();
}
/* Tab Hôm nay: dùng nội dung Tổng quan cũ, thay 4 ô số đầu bằng số chung, bỏ bảng kênh (đã ở tab Lãi theo kênh). */
function tqPatchHomNay(m){
  const rows=tqKenhRows(),T=tqTot(rows),strip=m.querySelector(".xkstrip");
  if(strip){const cells=[...strip.children],mk=(ic,l,v,h,go)=>`<button type="button" class="xk${v==null?" mut":""}" ${go?`data-sub="${go}"`:""}><span class="xkh"><span class="kic k-${ic}">${ico(ic)}</span><span class="xkl">${l}</span></span><span class="xkv numeric">${v==null?"Chưa đủ dữ liệu":v}</span><span class="xkm" style="white-space:normal">${h}</span></button>`;
    const nw=[mk("money","Doanh thu thực",T.dt?tr(T.dt):null,T.tam?"có phần tạm tính":"nguồn ở tab Lãi theo kênh","kenh"),mk("wallet","Chi phí trực tiếp",T.cp?tr(T.cp):null,`${T.dt?dhPct(T.cp/T.dt):""} doanh thu`,"kenh"),mk("trend","Lãi đóng góp",T.dt?tr(T.lai):null,`${T.dt?dhPct(T.lai/T.dt):""} · trước lương`,"kenh"),mk("cart","Đơn hàng",T.don?nf(T.don):null,"tất cả kênh","kenh")];
    const tmp=document.createElement("div");tmp.innerHTML=nw.join("");cells.slice(0,4).forEach((c,i)=>c.replaceWith(tmp.children[0]))}
  m.querySelectorAll(".card").forEach(c=>{const h=c.querySelector(".card-h h2");if(h&&/Hiệu quả kinh doanh theo kênh/.test(h.textContent)){const p=c.parentElement;c.remove();if(p&&p.classList.contains("xrow2"))p.style.gridTemplateColumns="1fr"}});
  /* Ô "Doanh thu kỳ" ở khối Kênh bán lẻ dùng cùng số doanh thu thực (execNums đã đổi), ghi rõ. */
}
const TQ_TABS=[["homnay","Hôm nay"],["kenh","Lãi theo kênh"],["gia","Giá thành & cảnh báo"],["tien","Tiền & cảnh báo"],["thang","Tháng chốt"],["caidat","Thiết lập"]];
{const _ex=PAGES.exec;PAGES.exec=function(m){
  if(!(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin"&&dhOk()))return _ex.apply(this,arguments);
  dhLoad();if(typeof b2bLoad==="function")b2bLoad();try{if(typeof adfLoad==="function"){adfLoad();adfMergeDays()}}catch(e){}
  const tab=SUB.exec||"homnay",bar=`<div class="tabs" style="margin-bottom:12px">${TQ_TABS.map(([k,t])=>`<button data-sub="${k}" class="${k===tab?"on":""}">${t}</button>`).join("")}</div>`;
  if(tab==="homnay"){_ex.apply(this,arguments);try{tqPatchHomNay(m)}catch(e){}const hd=m.querySelector(".xhead")||m.querySelector(".ph");if(hd)hd.insertAdjacentHTML("afterend",bar);else m.insertAdjacentHTML("afterbegin",bar);return}
  let body="";try{body=DH.busy&&!DH.at?`<p class="hint pad">Đang tải…</p>`:tab==="kenh"?tqTabKenh():tab==="gia"?dhTabGia():tab==="tien"?dhTabTien():tab==="thang"?dhTabThang():dhTabCaiDat()}catch(e){body=`<div class="note red">Lỗi tính: ${esc(e.message)}</div>`}
  m.innerHTML=H("Tổng quan công ty",esc(pLabel()))+bar+body;dhBind(m,tab==="kenh"?"batang":tab);
}}
PAGES.dh=m=>{SUB.exec=({tongquan:"kenh",homnay:"kenh",batang:"kenh"})[SUB.dh]||SUB.dh||"kenh";PAGE="exec";render()};
/* Cảnh báo: quảng cáo kênh vượt 40% doanh thu thực. */
{const _ea=execAlerts;execAlerts=function(){const A=_ea.apply(this,arguments);try{if(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin"&&dhOk()){const R=(execNums(PERIOD.from,PERIOD.to).rev)||{};[["tts","TikTok Shop"],["fb","Facebook"]].forEach(([k,n])=>{const r=R[k];if(r&&r.dt&&r.ads/r.dt>dhGet().nguong.qcMax)A.unshift(["red",`${n}: quảng cáo ${dhPct(r.ads/r.dt)} doanh thu thực`,"Tổng quan › Lãi theo kênh","exec"])})}}catch(e){}return A}}

/* =====================================================================
   LÃI LỖ P&L CÔNG TY · SO SÁNH KÊNH · KẾ HOẠCH DOANH THU (trang quản trị, chị Hoa duyệt 25/10/2026).
   Cùng một định nghĩa với Tổng quan: doanh thu thực, lãi đóng góp kênh (tqKenhRows).
   Chi phí chung lấy từ Sổ chi phí qua spChungTheoThang(ym) (chat Dựng trang quản trị làm); chưa có thì ghi "chưa có số", không để 0.
   Kế hoạch doanh thu theo tháng, theo kênh: D().targets.thang["yyyy-mm"] = {tts,spe,fb,b2b,gc} (doanh thu thực, đ).
   ===================================================================== */
const PLK=[["tts","TikTok Shop"],["spe","Shopee"],["fb","Facebook"],["b2b","Kênh phân phối"],["gc","Kênh OEM"]];
const PLB={},PLBB={};
const plYmEnd=ym=>ym+"-"+String(ttKyDays(ym)).padStart(2,"0");
const plYmAdd=(ym,n)=>{const [y,m]=ym.split("-").map(Number);const d=new Date(y,m-1+n,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")};
const plRange=ym=>{const t=iso(new Date()),e=plYmEnd(ym);return {from:ym+"-01",to:e<t?e:t,partial:e>t}};
const plYmNow=()=>{const t=iso(new Date()),p=PERIOD&&PERIOD.to?PERIOD.to:t;return (p>t?t:p).slice(0,7)};
/* Doanh thu Kênh phân phối, gia công của một khoảng ngày bất kỳ (không đụng kỳ đang chọn). */
function plB2b(from,to){const k=from+"|"+to;if(B2BR.key===k&&B2BR.data)return B2BR.data;if(PLB[k])return PLB[k];
  if(!PLBB[k]){PLBB[k]=1;(async()=>{try{if(!B2BR.map){const mp=await kApi("/map").catch(()=>({map:[]}));B2BR.map=new Map((mp.map||[]).map(r=>[String(r.crm_sku).toLowerCase(),r]))}PLB[k]=await svApi("/api/dashboards/b2b-sku?from="+from+"&to="+to)}catch(e){PLB[k]={lines:[],months:[],err:e.message}}PLBB[k]=0;if(["pl","bc_tong","muctieu","exec"].includes(PAGE))renderMain()})()}
  return null}
/* Các dòng kênh (như tqKenhRows) cho một khoảng ngày bất kỳ. */
function plRowsFor(from,to){
  const sv=PERIOD,bk={key:B2BR.key,data:B2BR.data},data=plB2b(from,to);
  PERIOD={...sv,from,to};if(data){B2BR.key=from+"|"+to;B2BR.data=data}else B2BR.key="";
  try{return tqKenhRows()}finally{PERIOD=sv;B2BR.key=bk.key;B2BR.data=bk.data}}
const plKey=r=>({tts:"tts",spe:"spe",fb:"fb",B2B:"b2b",GIA_CONG:"gc"})[r.k];
/* Một kênh → các dòng P&L. Phí sàn và vận chuyển = phần còn lại để các dòng cộng khớp lãi đóng góp. */
function plCol(r){if(!r||r.dt==null)return null;if(r.dt===0)return {dt:0,gv:0,lg:0,phi:0,ads:0,cpk:r.cpk||0,luong:r.luong||0,chia:r.chia||0,lai:r.lai==null?0:r.lai,tam:false,src:r.src,don:0};const dt=r.dt,gv=r.gv,ads=r.ads||0,lai=r.lai,cpk=r.cpk||0,luong=r.luong||0,chia=r.chia||0;
  const lg=gv==null?null:dt-gv,phi=lai==null||gv==null?(r.phi||0):dt-gv-ads-cpk-luong-lai;return {dt,gv,lg,phi,ads,cpk,luong,lai,chia,lsp:lai==null?null:lai-chia,tam:!!r.tam,src:r.src,don:r.don}}
function plSum(cols,names){const ok=cols.filter(Boolean);if(!ok.length)return null;const s=k=>ok.reduce((a,c)=>a+(c[k]||0),0);
  const thieuGv=cols.map((c,i)=>c&&c.gv==null?names[i]:null).filter(Boolean);
  return {dt:s("dt"),gv:s("gv"),lg:s("lg"),phi:s("phi"),ads:s("ads"),cpk:s("cpk"),luong:s("luong"),lai:s("lai"),chia:s("chia"),thieuGv,tam:ok.some(c=>c.tam)}}
function mtGet(ym){const t=D().targets,x=t&&t.thang&&t.thang[ym];if(!x)return null;const o={};let tong=0,co=false;PLK.forEach(([k])=>{const v=+x[k]||0;o[k]=v||null;if(v){tong+=v;co=true}});o.tong=co?tong:null;return co?o:null}
function plChung(ym){try{if(typeof spChungTheoThang!=="function")return null;const v=spChungTheoThang(ym);return v!=null&&isFinite(+v)&&+v>0?+v:null}catch(e){return null}}
function plMonth(ym){const R=plRange(ym),rows=plRowsFor(R.from,R.to),by={};rows.forEach(r=>by[plKey(r)]=r);
  const cols={};PLK.forEach(([k])=>cols[k]=plCol(by[k]));const tot=plSum(PLK.map(([k])=>cols[k]),PLK.map(x=>x[1])),chung=plChung(ym);
  let sx=0;try{const S=typeof dtSoCp==="function"?dtSoCp(R.from,R.to):null;sx=S?S.v.sx:0}catch(e){}
  /* Lương chưa gắn kênh trong bảng lương đã chốt (scPLKenh) không có trong spChungTheoThang nên cộng vào chi chung. Cột công ty: lãi sau phân bổ = tổng lãi đóng góp − tổng chi chung được chia, dòng chi chung chỉ còn phần chưa chia, nên Lợi nhuận hoạt động không đổi theo cách chia. */
  const L=typeof dtPB==="function"?dtPB(ym):null,lc=L?+L.luongChung||0:0,cAll=chung==null&&!lc?null:(chung||0)+lc;
  if(tot){tot.lsp=tot.lai-tot.chia;tot.chung=cAll==null?null:cAll-tot.chia}
  return {ym,R,by,cols,tot,chung:cAll,sx,pb:L,ln:tot&&cAll!=null?tot.lai-cAll-sx:null,thieu:PLK.filter(([k])=>!cols[k]).map(x=>x[1]),loading:rows.some(r=>r.src==="đang tải…")}}
const PLS={ym:""};
function pPLCty(m){
  if(!dhOk()){m.innerHTML=H("Lãi lỗ P&L","")+`<div class="note">Trang này chỉ dành cho CEO và kế toán.</div>`;return}
  dhLoad();const ym=PLS.ym||plYmNow(),A=plMonth(ym),P=plMonth(plYmAdd(ym,-1)),KH=mtGet(ym),vn=x=>x.slice(5,7)+"/"+x.slice(0,4);
  const f=v=>v==null?`<span class="hint">—</span>`:`<span class="${v<0?"t-red":""}">${nf(Math.round(v))}</span>`;
  const pct=(a,b)=>a==null||!b?"—":dhPct(a/b);
  const ROWS=[["dt","Doanh thu thực","tot"],["gv","− Giá vốn",""],["lg","= Lãi gộp","tot"],["phi","− Phí sàn và vận chuyển",""],["ads","− Quảng cáo",""],["cpk","− Chi phí trực tiếp kênh (Sổ chi phí)",""],["luong","− Lương làm riêng cho kênh",""],["lai","= Lãi đóng góp","tot"],["chia","− Chi phí chung được chia (Quy tắc phân bổ)",""],["lsp","= Lãi sau phân bổ","tot"],["chung","− Chi phí chung chưa chia cho kênh",""],["sx","− Chi phí Sản xuất (Sổ chi phí)",""],["ln","= Lợi nhuận hoạt động","tot big"]];
  const cell=(c,k)=>{if(!c)return `<td class="n hint">chờ số</td>`;if(k==="chung"||k==="sx"||k==="ln")return `<td class="n hint"></td>`;return `<td class="n">${f(c[k])}</td>`};
  const cty=(X,k)=>{if(!X.tot)return `<td class="n hint">—</td>`;if(k==="sx")return `<td class="n">${f(X.sx||0)}</td>`;if(k==="chung")return X.tot.chung==null?`<td class="n"><span class="pill p-gry">chưa có số</span></td>`:`<td class="n">${f(X.tot.chung)}</td>`;if(k==="ln")return X.ln==null?`<td class="n"><span class="pill p-gry">chưa có số</span></td>`:`<td class="n"><b>${f(X.ln)}</b></td>`;return `<td class="n"><b>${f(X.tot[k])}</b></td>`};
  const kh=k=>k==="dt"&&KH?`<td class="n">${f(KH.tong)}<br><small class="hint">đạt ${pct(A.tot&&A.tot.dt,KH.tong)}</small></td>`:`<td class="n hint">${k==="dt"?"chưa đặt":""}</td>`;
  const body=ROWS.map(([k,l,c])=>`<tr class="${c.includes("tot")?"tot":""}"><td>${c.includes("big")?`<b>${l}</b>`:l}</td>${PLK.map(([kk])=>cell(A.cols[kk],k)).join("")}${cty(A,k)}${cty(P,k)}${kh(k)}</tr>`).join("");
  const bien=(l,k)=>`<tr><td class="hint">${l}</td>${PLK.map(([kk])=>{const c=A.cols[kk];return `<td class="n hint">${c&&c[k]!=null&&k!=="ln"?pct(c[k],c.dt):""}</td>`}).join("")}<td class="n hint">${A.tot?pct(k==="ln"?A.ln:A.tot[k],A.tot.dt):""}</td><td class="n hint">${P.tot?pct(k==="ln"?P.ln:P.tot[k],P.tot.dt):""}</td><td></td></tr>`;
  const src=PLK.map(([k,n])=>{const r=A.by[k];return `<li><b>${n}:</b> ${esc(r?r.src||"":"chờ số")}${r&&r.dang?` · đang giao chưa tính ${nf(r.dang)} đơn (${tr(r.dangDt)})`:""}</li>`}).join("");
  const opts=[];for(let i=-12;i<=0;i++){const k=plYmAdd(plYmNow(),i);opts.push(`<option value="${k}" ${k===ym?"selected":""}>Tháng ${vn(k)}</option>`)}
  m.innerHTML=H("Lãi lỗ P&L công ty",`Tháng ${vn(ym)}${A.R.partial?" · đến hôm nay "+A.R.to.slice(8,10)+"/"+A.R.to.slice(5,7):""} · doanh thu thực · số quản trị nội bộ, sổ sách chính thức ở MISA`)+`
  <div class="acts" style="margin-bottom:10px"><select id="pl-ym" style="width:auto">${opts.join("")}</select><button class="btn" id="pl-mt">Đặt kế hoạch tháng</button></div>
  ${A.thieu.length?`<div class="note amb">Cột CÔNG TY chưa gồm: ${esc(A.thieu.join(", "))} (chờ tải báo cáo). ${A.loading?"Đang tải B2B…":""}</div>`:""}
  ${A.tot&&A.tot.thieuGv.length?`<div class="note amb">${esc(A.tot.thieuGv.join(", "))} chưa có giá vốn: cột CÔNG TY chỉ cộng giá vốn, lãi của các kênh đã có giá vốn.</div>`:""}
  ${A.tot&&A.tot.tam?`<div class="note">Có phần doanh thu <b>tạm tính</b> (ngày chưa có báo cáo sàn), số sẽ chốt khi tải báo cáo tháng.</div>`:""}
  <section class="card flush"><div class="tbl"><table><thead><tr><th>Chỉ tiêu (đ)</th>${PLK.map(([,n])=>`<th class="n">${n}</th>`).join("")}<th class="n">CÔNG TY</th><th class="n">Tháng trước<br><small>${vn(P.ym)}</small></th><th class="n">Kế hoạch</th></tr></thead><tbody>
   ${body}${bien("Biên lãi gộp","lg")}${bien("Biên đóng góp","lai")}${bien("Biên lợi nhuận hoạt động","ln")}</tbody></table></div>
   <p class="hint pad">Lãi đóng góp = doanh thu thực − giá vốn − phí sàn, vận chuyển, thuế − quảng cáo − chi phí Sổ chi phí bổ thẳng về kênh − lương làm riêng cho kênh (bảng lương đã chốt). So hiệu quả các kênh dùng lãi đóng góp. Lãi sau phân bổ = lãi đóng góp − phần chi phí chung được chia theo Quy tắc phân bổ ở Sổ chi phí; phần chưa chia chỉ trừ ở cột CÔNG TY. Lợi nhuận hoạt động = tổng lãi đóng góp − toàn bộ chi phí chung − chi phí Sản xuất. Thu nhập, chi phí khác (bồi thường sàn…) và thuế TNDN chưa có chỗ nhập nên chưa ra lợi nhuận trước thuế và sau thuế. ${A.chung==null?"Chi phí chung lấy từ Sổ chi phí: tháng này chưa có số nên chưa ra lợi nhuận hoạt động.":""}${A.pb&&A.pb.loi&&A.pb.loi.length?" Chưa chia được: "+esc(A.pb.loi.join("; "))+".":""}</p></section>
  <section class="card"><div class="card-h"><h2>Nguồn số từng kênh</h2></div><ul class="lessons">${src}</ul></section>`;
  m.querySelector("#pl-ym").onchange=e=>{PLS.ym=e.target.value;renderMain()};
  m.querySelector("#pl-mt").onclick=()=>{MT.ym=ym;PAGE="muctieu";renderMain();scrollTo(0,0)};
}
PAGES.pl=m=>{if(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin")return pPLCty(m);return pPL(m)};

/* ---------- So sánh kênh (trang bc_tong bên quản trị) ---------- */
function tqHuyHoan(k,from,to){
  if(k==="fb"){const tao=rSum("fb",0,from,to).v,h=rSum("fb",2,from,to).v+rSum("fb",3,from,to).v;return tao?h/tao:null}
  if(k==="tts"){const S=(typeof TSB!=="undefined"&&TSB.sum)||{};let a=0,b=0;tqMonths(from,to).forEach(ym=>{const s=S[ym];if(s&&s.hhRate!=null&&s.don){a+=s.hhRate*s.don;b+=s.don}});return b?a/b:null}
  return null}
function tqSoSanhKenh(m){
  if(!dhOk())return pKetQuaKenh(m);
  dhLoad();if(typeof b2bLoad==="function")b2bLoad();
  const rows=tqKenhRows(),T=tqTot(rows),ng=dhGet().nguong,ok=rows.filter(r=>r.dt!=null&&r.dt>0);
  const rk=ok.filter(r=>r.lai!=null).sort((a,b)=>b.lai-a.lai);rk.forEach((r,i)=>r.rank=i+1);
  const list=[...rk,...rows.filter(r=>!rk.includes(r))];
  const p=v=>v==null||!isFinite(v)?"—":dhPct(v);
  const row=r=>{const v=r.dt!=null&&r.dt>0,c=v?plCol(r):null,hh=v?tqHuyHoan(r.k,PERIOD.from,PERIOD.to):null,qc=v?(r.ads||0)/r.dt:null;
    return `<tr class="clk${v?"":" mut"}" data-go="${r.go}"><td class="n"><b>${r.rank||""}</b></td><td><b>${esc(r.n)}</b><br><small class="hint">${esc(r.src||"")}</small></td>
    <td class="n">${r.dt==null?`<span class="pill p-gry">chờ tải báo cáo</span>`:r.dt===0?"0 đ":tr(r.dt)}</td><td class="n">${v?p(r.dt/T.dt):"—"}</td>
    <td class="n">${c&&c.lg!=null?p(c.lg/r.dt):"—"}</td><td class="n">${c?p(c.phi/r.dt):"—"}</td>
    <td class="n">${v?(qc>ng.qcMax?`<b class="t-red">${p(qc)}</b>`:p(qc)):"—"}</td>
    <td class="n"><b class="${r.lai<0?"t-red":""}">${r.lai==null?"—":tr(r.lai)}</b></td><td class="n">${v&&r.lai!=null?p(r.lai/r.dt):"—"}</td>
    <td class="n">${p(hh)}</td></tr>`};
  const best=rk[0];
  m.innerHTML=H("So sánh kênh",esc(pLabel())+" · doanh thu thực · xếp hạng theo lãi đóng góp")+`
  <div class="xkstrip" style="margin-bottom:12px">
   <div class="xk"><span class="xkh"><span class="xkl">Doanh thu thực</span></span><span class="xkv numeric">${T.dt?tr(T.dt):"—"}</span><span class="xkm" style="white-space:normal">${ok.length} kênh có số${T.tam?" · có phần tạm tính":""}</span></div>
   <div class="xk"><span class="xkh"><span class="xkl">Lãi đóng góp</span></span><span class="xkv numeric">${T.dt?tr(T.lai):"—"}</span><span class="xkm" style="white-space:normal">${T.dt?p(T.lai/T.dt)+" doanh thu · trước chi phí chung":""}</span></div>
   <div class="xk"><span class="xkh"><span class="xkl">Kênh lãi nhiều nhất</span></span><span class="xkv">${best?esc(best.n):"—"}</span><span class="xkm" style="white-space:normal">${best?tr(best.lai):""}</span></div>
   <div class="xk"><span class="xkh"><span class="xkl">Chờ tải báo cáo</span></span><span class="xkv">${T.thieu.length||"Không"}</span><span class="xkm" style="white-space:normal">${esc(T.thieu.join(", "))}</span></div></div>
  <section class="card flush"><div class="tbl"><table><thead><tr><th class="n">Hạng</th><th>Kênh · nguồn số</th><th class="n">Doanh thu thực</th><th class="n">% trong tổng</th><th class="n">Biên lãi gộp</th><th class="n">Phí sàn, ship, thuế %</th><th class="n">Quảng cáo %</th><th class="n">Lãi đóng góp</th><th class="n">Biên đóng góp</th><th class="n">Hủy/hoàn %</th></tr></thead>
   <tbody>${list.map(row).join("")}<tr class="tot"><td></td><td><b>Tổng công ty</b></td><td class="n"><b>${tr(T.dt)}</b></td><td class="n">100%</td><td></td><td></td><td></td><td class="n"><b>${tr(T.lai)}</b></td><td class="n">${T.dt?p(T.lai/T.dt):"—"}</td><td></td></tr></tbody></table></div>
   <p class="hint pad">Các % tính trên doanh thu thực của từng kênh. Quảng cáo trên ${p(ng.qcMax)} báo đỏ (sửa ngưỡng ở Tổng quan › Thiết lập). Hủy/hoàn: TikTok theo báo cáo tháng đã tải, Facebook = (hủy + hoàn) / đơn tạo; Kênh phân phối, Kênh OEM không tính. Bấm từng dòng để xem chi tiết kênh.</p></section>`;
  m.querySelectorAll("tr[data-go]").forEach(t=>t.onclick=()=>{PAGE=t.dataset.go;MOD="";render();scrollTo(0,0)});
}

/* ---------- Kế hoạch doanh thu theo kênh và tiến độ ---------- */
const MT={ym:""};
function mtProg(ym){const KH=mtGet(ym);if(!KH)return null;const A=plMonth(ym),R=A.R,nd=ttKyDays(ym),qua=R.partial?+R.to.slice(8,10):nd;
  const L=PLK.map(([k,n])=>{const c=A.cols[k],kh=KH[k],tt=c?c.dt:null;return {k,n,kh,tt,dat:kh&&tt!=null?tt/kh:null,thieu:kh&&tt!=null?Math.max(0,kh-tt):null,ngay:kh&&tt!=null&&nd>qua?Math.max(0,kh-tt)/(nd-qua):null,tam:c&&c.tam}});
  const tt=A.tot?A.tot.dt:null;return {ym,KH,A,L,nhip:qua/nd,qua,nd,tong:{kh:KH.tong,tt,dat:tt!=null&&KH.tong?tt/KH.tong:null,thieu:tt!=null?Math.max(0,KH.tong-tt):null,ngay:tt!=null&&nd>qua?Math.max(0,KH.tong-tt)/(nd-qua):null}}}
const mtBar=(dat,nhip)=>{const w=Math.max(0,Math.min(100,(dat||0)*100)),col=dat==null?"#c9ced8":dat>=nhip?"var(--green)":dat>=nhip*0.9?"#e8a23a":"var(--red)";return `<div style="position:relative;height:10px;background:#eef0f5;border-radius:99px;min-width:120px"><i style="display:block;height:100%;width:${w}%;background:${col};border-radius:99px"></i><span title="nhịp cần đạt theo số ngày đã qua" style="position:absolute;top:-3px;left:${Math.min(100,nhip*100)}%;width:2px;height:16px;background:#333"></span></div>`};
function pMucTieu(m){
  if(!dhOk()){m.innerHTML=H("Kế hoạch doanh thu","")+`<div class="note">Trang này chỉ dành cho CEO và kế toán.</div>`;return}
  dhLoad();const ym=MT.ym||plYmNow(),G=mtProg(ym),vn=x=>x.slice(5,7)+"/"+x.slice(0,4),p=v=>v==null?"—":dhPct(v);
  const ms=[];for(let i=-2;i<=3;i++)ms.push(plYmAdd(ym,i));
  const T=D().targets||{},th=T.thang||{};
  const prog=G?`<section class="card flush"><div class="card-h pad"><h2>Tiến độ tháng ${vn(ym)}</h2><span class="hint">đã qua ${G.qua}/${G.nd} ngày · nhịp cần ${p(G.nhip)} · vạch đen là nhịp cần</span></div><div class="tbl"><table><thead><tr><th>Kênh</th><th class="n">Kế hoạch</th><th class="n">Đã đạt (doanh thu thực)</th><th class="n">% đạt</th><th style="min-width:160px">Tiến độ</th><th class="n">Còn thiếu</th><th class="n">Cần mỗi ngày còn lại</th></tr></thead><tbody>
    ${G.L.map(r=>`<tr><td><b>${r.n}</b>${r.tam?` <span class="pill p-blu">tạm tính</span>`:""}</td><td class="n">${r.kh?tr(r.kh):`<span class="hint">chưa đặt</span>`}</td><td class="n">${r.tt==null?`<span class="pill p-gry">chờ số</span>`:tr(r.tt)}</td><td class="n">${p(r.dat)}</td><td>${r.kh?mtBar(r.dat,G.nhip):""}</td><td class="n">${r.thieu==null?"—":tr(r.thieu)}</td><td class="n">${r.ngay==null?"—":tr(r.ngay)}</td></tr>`).join("")}
    <tr class="tot"><td><b>Cả công ty</b></td><td class="n"><b>${tr(G.tong.kh)}</b></td><td class="n"><b>${G.tong.tt==null?"—":tr(G.tong.tt)}</b></td><td class="n">${p(G.tong.dat)}</td><td>${mtBar(G.tong.dat,G.nhip)}</td><td class="n">${G.tong.thieu==null?"—":tr(G.tong.thieu)}</td><td class="n">${G.tong.ngay==null?"—":tr(G.tong.ngay)}</td></tr></tbody></table></div>
    ${G.A.thieu.length?`<p class="hint pad">Chưa có số thực: ${esc(G.A.thieu.join(", "))}, nên cả công ty đang thiếu phần này.</p>`:""}</section>`:`<div class="note">Tháng ${vn(ym)} chưa đặt kế hoạch. Nhập ở bảng dưới rồi bấm Lưu.</div>`;
  const inp=(k2,k)=>{const v=th[k2]&&th[k2][k];return `<input type="text" inputmode="numeric" data-mt-ym="${k2}" data-mt-k="${k}" value="${v?nf(v):""}" style="width:120px;text-align:right">`};
  m.innerHTML=H("Kế hoạch doanh thu theo kênh","Kế hoạch doanh thu thực từng tháng, từng kênh · dùng cho cột Kế hoạch ở Lãi lỗ P&L và thanh tiến độ ở Tổng quan")+`
  <div class="acts" style="margin-bottom:10px"><button class="btn" id="mt-prev">‹ Tháng trước</button><b style="padding:6px 10px">Tháng ${vn(ym)}</b><button class="btn" id="mt-next">Tháng sau ›</button></div>${prog}
  <section class="card flush"><div class="card-h pad"><h2>Nhập kế hoạch (đ, doanh thu thực)</h2><span class="hint">TikTok, Shopee: doanh thu thuần sau hủy hoàn · Facebook: giao thành công · Kênh phân phối, Kênh OEM: đơn đã duyệt</span></div>
   <div class="tbl"><table><thead><tr><th>Tháng</th>${PLK.map(([,n])=>`<th class="n">${n}</th>`).join("")}<th class="n">Cộng</th></tr></thead><tbody>
   ${ms.map(k2=>{const KH=mtGet(k2);return `<tr class="${k2===ym?"sel":""}"><td><b>${vn(k2)}</b></td>${PLK.map(([k])=>`<td class="n">${inp(k2,k)}</td>`).join("")}<td class="n"><b>${KH?tr(KH.tong):"—"}</b></td></tr>`}).join("")}</tbody></table></div>
   <div class="acts pad"><button class="btn pri" id="mt-save">Lưu kế hoạch</button><span class="hint">Để trống nếu kênh đó chưa đặt.</span></div></section>`;
  m.querySelector("#mt-prev").onclick=()=>{MT.ym=plYmAdd(ym,-1);renderMain()};m.querySelector("#mt-next").onclick=()=>{MT.ym=plYmAdd(ym,1);renderMain()};
  m.querySelectorAll("[data-mt-k]").forEach(i=>i.onblur=()=>{const v=+String(i.value).replace(/\D/g,"");i.value=v?nf(v):""});
  m.querySelector("#mt-save").onclick=()=>{const V={};m.querySelectorAll("[data-mt-k]").forEach(i=>{const v=+String(i.value).replace(/\D/g,"")||0;(V[i.dataset.mtYm]=V[i.dataset.mtYm]||{})[i.dataset.mtK]=v});
    DB.mutate(ME.name,"sửa kế hoạch doanh thu theo kênh",dt=>{if(typeof execTargets==="function")execTargets();dt.targets=dt.targets||{};dt.targets.thang=dt.targets.thang||{};Object.entries(V).forEach(([k2,o])=>{if(Object.values(o).some(Boolean))dt.targets.thang[k2]=o;else delete dt.targets.thang[k2]})});toast("Đã lưu kế hoạch");renderMain()};
}
PAGES.muctieu=pMucTieu;
/* Tổng quan › Hôm nay: thanh tiến độ kế hoạch tháng. */
function tqTienDoCard(){const ym=plYmNow(),G=mtProg(ym),vn=ym.slice(5,7)+"/"+ym.slice(0,4);
  if(!G)return `<section class="card"><div class="card-h"><h2>Tiến độ kế hoạch tháng ${vn}</h2><button class="btn sm" data-tq-mt>Đặt kế hoạch</button></div><p class="hint">Chưa đặt kế hoạch doanh thu tháng này.</p></section>`;
  return `<section class="card"><div class="card-h"><h2>Tiến độ kế hoạch tháng ${vn}</h2><span class="hint">đã qua ${G.qua}/${G.nd} ngày · vạch đen là nhịp cần</span><button class="btn sm" data-tq-mt>Chi tiết</button></div>
   <div style="display:grid;grid-template-columns:150px 1fr 190px;gap:8px 12px;align-items:center">${[{n:"Cả công ty",...G.tong,b:1}].concat(G.L.filter(r=>r.kh)).map(r=>`<div>${r.b?"<b>":""}${r.n}${r.b?"</b>":""}</div>${mtBar(r.dat,G.nhip)}<div style="text-align:right">${r.tt==null?"chờ số":tr(r.tt)} / ${tr(r.kh)} · <b>${r.dat==null?"—":dhPct(r.dat)}</b></div>`).join("")}</div></section>`}
{const _ex=PAGES.exec;PAGES.exec=function(m){_ex.apply(this,arguments);try{if(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin"&&dhOk()&&(SUB.exec||"homnay")==="homnay"){const s=m.querySelector(".xkstrip");if(s){s.insertAdjacentHTML("afterend",tqTienDoCard());m.querySelectorAll("[data-tq-mt]").forEach(b=>b.onclick=()=>{MT.ym="";PAGE="muctieu";renderMain();scrollTo(0,0)})}}}catch(e){}}}
