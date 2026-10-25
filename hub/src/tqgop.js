/* =====================================================================
   TỔNG QUAN CÔNG TY (trang quản trị) = Tổng quan cũ + Phòng điều hành gộp làm một, chị Hoa duyệt 25/10/2026.
   Tab: Hôm nay · Lãi theo kênh · Giá thành & cảnh báo · Tiền & cảnh báo · Tháng chốt · Thiết lập.
   MỘT định nghĩa doanh thu cho mọi chỗ trên trang quản trị = DOANH THU THỰC (chị chốt):
   - TikTok: doanh thu thuần theo báo cáo quyết toán tháng đã lưu; tháng chưa chốt = tạm tính
     (số đơn xuất kho thật từ Poscake × giá trị đơn trung bình tháng chốt gần nhất), KHÔNG dùng GMV.
   - Facebook: doanh thu đơn GIAO THÀNH CÔNG (Pancake). Không nhân tỷ lệ ước. Đơn đang giao ghi riêng, không cộng.
   - Shopee: số theo ngày nếu có; chưa có thì chỉ ghi số đơn xuất kho (Poscake).
   - B2B, gia công: đơn đã duyệt trên CRM (b2bpl.js).
   Lãi = lãi đóng góp kênh (chưa trừ lương, chi phí chung). Ghi rõ nguồn dưới mỗi số.
   ===================================================================== */
const TQ={co:{},coBusy:{}};
/* Số đơn xuất kho Poscake theo kênh trong khoảng ngày (null khi chưa tải xong). */
function tqCo(from,to){const k=from+"|"+to;if(TQ.co[k]!==undefined)return TQ.co[k];if(!TQ.coBusy[k]){TQ.coBusy[k]=1;svApi("/api/hub/dieuhanh/channel-orders?from="+from+"&to="+to).then(r=>{const o={};(r||[]).forEach(x=>{o[x.channel]=(o[x.channel]||0)+(+x.orders||0)});TQ.co[k]=o}).catch(()=>{TQ.co[k]={}}).finally(()=>{TQ.coBusy[k]=0;if(PAGE==="exec"||PAGE==="bc_tong")renderMain()})}return null}
const tqMonths=(from,to)=>{const ms=[];for(let d=pdate(from.slice(0,7)+"-01");iso(d)<=to;d=new Date(d.getFullYear(),d.getMonth()+1,1))ms.push(iso(d).slice(0,7));return ms};
/* Doanh thu thực + lãi đóng góp từng kênh B2C trong khoảng ngày. N = số gốc của execNums (trước khi đổi). */
function tqRevB2C(N,from,to){
  const ms=tqMonths(from,to),full=ms.every(k=>fullMonth(k,from,to)),S=(typeof TSB!=="undefined"&&TSB.sum)||{},rs=(i,src)=>rSum(src,i,from,to).v,co=tqCo(from,to)||{};
  const out={};
  /* TikTok */
  {const all=full&&ms.every(k=>S[k]);
   if(all){const A=ms.map(k=>S[k]),s=f=>A.reduce((a,x)=>a+(+f(x)||0),0);out.tts={dt:s(x=>x.dt),gv:s(x=>x.gv),phi:-s(x=>x.phi),ads:s(x=>x.ads),khac:s(x=>(x.extraT||0)-(x.adj||0)),lai:s(x=>x.lai),don:s(x=>x.don),src:"doanh thu thuần · báo cáo quyết toán đã lưu",tam:false}}
   else{const M=(typeof TSB!=="undefined"&&TSB.months)||[],L=M.length?M[M.length-1]:null,s=L&&L.summary,don=co.TIKTOK||0;
     if(s&&s.dt&&s.don&&don){const aov=s.dt/s.don,dt=don*aov,adsReal=rs(10,"tts"),ads=adsReal||dt*(s.ads/s.dt),gv=dt*s.gv/s.dt,phi=dt*(-s.phi)/s.dt;
       out.tts={dt,gv,phi,ads,khac:0,lai:dt-gv-phi-ads,don,tam:true,src:`tạm tính · ${nf(don)} đơn xuất kho (Poscake) × ${nf(aov)}đ giá trị đơn TB tháng ${L.ky.slice(5)}/${L.ky.slice(0,4)}${adsReal?"":" · quảng cáo theo tỷ lệ tháng chốt"}`}}
     else out.tts={dt:null,lai:null,don:don||null,src:don?`${nf(don)} đơn xuất kho (Poscake) · chưa có tháng chốt để tạm tính tiền`:"chưa có số"}}}
  /* Facebook: giao thành công */
  {const dtG=rs(5,"fb"),dtC=rs(6,"fb"),giao=rs(4,"fb"),chot=rs(1,"fb"),hoan=rs(3,"fb"),gvC=rs(7,"fb");
   if(dtG>0){const Dd=(typeof KDX!=="undefined"&&KDX.fbDash)||{},pr=Dd.dt>0?(-(+Dd.vc||0)-(+Dd.hoan||0))/Dd.dt+0.015:0.015,gv=dtC?gvC*dtG/dtC:0,ads=rAds(0,from,to)*(1+(typeof FB_ADS_TAX!=="undefined"?FB_ADS_TAX:0.1)),phi=dtG*pr;
     out.fb={dt:dtG,gv,phi,ads,khac:0,lai:dtG-gv-phi-ads,don:giao,dang:Math.max(0,chot-giao-hoan),dangDt:Math.max(0,dtC-dtG),src:`giao thành công · Pancake · phí ship và thuế ${(pr*100).toFixed(1).replace(".",",")}%`,tam:false}}
   else out.fb={dt:null,lai:null,don:null,src:"chưa có số Pancake"}}
  /* Shopee */
  {const dt=rs(0,"spe");if(dt>0){const gv=rs(2,"spe"),phi=-rs(1,"spe");out.spe={dt,gv,phi,ads:0,khac:0,lai:dt-gv-phi,don:rs(4,"spe"),src:"doanh thu Shopee theo ngày (chưa trừ Shopee Ads)",tam:false}}
   else{const don=co.SHOPEE||0;out.spe={dt:null,lai:null,don:don||null,src:don?`${nf(don)} đơn xuất kho (Poscake) · chưa có báo cáo tiền Shopee`:"chưa có số"}}}
  return out;
}
/* Mọi chỗ dùng execNums trên trang quản trị (Tổng quan, Báo cáo kết quả kinh doanh) nhận doanh thu thực. */
{const _en=execNums;execNums=function(from,to){const N=_en(from,to);
  if(!(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin")||!dhOk())return N;
  try{const R=tqRevB2C(N,from,to);N.raw={tt:N.tt,fbDT:N.fbDT,spDT:N.spDT,tong:N.tong};N.rev=R;
    N.tt=R.tts.dt||0;N.fbDT=R.fb.dt||0;N.fbGiao=R.fb.dt||0;N.spDT=R.spe.dt||0;N.tong=N.tt+N.fbDT+N.spDT;
    N.L.tts=R.tts.lai;N.L.fb=R.fb.lai;N.L.spe=R.spe.lai;
    N.C.gvTT=R.tts.gv||0;N.C.phiTT=R.tts.phi||0;N.C.adsTT=R.tts.ads||0;N.C.khacTT=R.tts.khac||0;N.C.gvFB=R.fb.gv||0;N.C.adsFB=R.fb.ads||0;N.C.phiFB=R.fb.phi||0;
    N.n.tts=R.tts.dt?1:0;N.n.fb=R.fb.dt?1:0;N.n.spe=R.spe.dt?1:0}catch(e){}
  return N}}
{const _o=execOrders;execOrders=function(from,to){const O=_o(from,to);if(!(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin")||!dhOk())return O;try{const R=execNums(from,to).rev;if(R){O.tts=R.tts.don||0;O.fb=R.fb.don||0;O.spe=R.spe.don||0}}catch(e){}return O}}

/* Bảng kênh: mỗi kênh một dòng, doanh thu thực và lãi đóng góp (một chỗ duy nhất trên trang). */
function tqKenhRows(){
  const N=execNums(PERIOD.from,PERIOD.to),R=N.rev||{},B=typeof b2bChannel==="function"?b2bChannel("B2B"):null,G=typeof b2bChannel==="function"?b2bChannel("GIA_CONG"):null;
  const susp=ch=>{if(typeof B2BR==="undefined"||!B2BR.data)return [];return B2BR.data.lines.filter(l=>l.channel===ch&&!(+l.revenue>0)).map(l=>{const u=b2bUnitCost(l.sku,l.month);return {...l,cost:u==null?0:u*(+l.qty||0)}}).filter(l=>l.cost>5e6)};
  const b2b=(X,ch,n,go,src)=>{if(!X)return {k:ch,n,go,mang:ch==="GIA_CONG"?"Gia công":"Phân phối",dt:null,lai:null,src:"đang tải…"};if(!X.has)return {k:ch,n,go,mang:ch==="GIA_CONG"?"Gia công":"Phân phối",dt:0,lai:0,don:0,src:ch==="GIA_CONG"?"không có đơn gia công trong kỳ":"không có đơn trong kỳ"};
    const sp=susp(ch),ex=sp.reduce((a,l)=>a+l.cost,0);
    if(!X.cover)return {k:ch,n,go,mang:ch==="GIA_CONG"?"Gia công":"Phân phối",dt:X.net,gv:null,phi:0,ads:0,lai:null,don:X.orders,src:src+" · chưa có giá vốn nên chưa tính lãi"};
    return {k:ch,n,go,mang:ch==="GIA_CONG"?"Gia công":"Phân phối",dt:X.net,gv:X.costAll-ex,phi:0,ads:0,lai:X.gross+ex,don:X.orders,src:src+(X.cover<0.95?` · ${(100-X.cover*100).toFixed(1).replace(".",",")}% doanh thu ước tính giá vốn`:"")+(ex?` · đã tạm loại ${tr(ex)} giá vốn dòng giá 0đ nghi nhập sai`:""),susp:sp}};
  const ch=(k,n,go)=>({k,n,go,mang:"Bán lẻ",...(R[k]||{dt:null,lai:null,src:"chưa có số"})});
  return [ch("tts","TikTok Shop","bc_tiktok"),ch("fb","Facebook","bc_fb"),ch("spe","Shopee","bc_shopee"),b2b(B,"B2B","Phân phối (NPP, đại lý)","bc_b2b","đơn đã duyệt · CRM"),b2b(G,"GIA_CONG","Gia công","bc_gc","đơn đã duyệt · CRM")];
}
function tqTot(rows){const has=rows.filter(r=>r.dt!=null);return {dt:has.reduce((a,r)=>a+r.dt,0),lai:has.filter(r=>r.lai!=null).reduce((a,r)=>a+r.lai,0),cp:has.reduce((a,r)=>a+(r.gv||0)+(r.phi||0)+(r.ads||0)+(r.khac||0),0),don:rows.reduce((a,r)=>a+(+r.don||0),0),tam:has.some(r=>r.tam),thieu:rows.filter(r=>r.dt==null).map(r=>r.n)}}
function tqTabKenh(){
  const rows=tqKenhRows(),T=tqTot(rows),ng=dhGet().nguong;
  const warn=r=>{const w=[];if(r.dt&&r.ads/r.dt>0.4)w.push(pill(`quảng cáo ${dhPct(r.ads/r.dt)} doanh thu`,"red"));else if(r.dt&&r.ads/r.dt>0.25)w.push(pill(`quảng cáo ${dhPct(r.ads/r.dt)}`,"amb"));if(r.dt&&r.lai!=null&&r.lai/r.dt<ng.bienKenh)w.push(pill("biên dưới "+dhPct(ng.bienKenh),"amb"));if(r.tam)w.push(pill("tạm tính","blu"));if(r.dt==null)w.push(pill("chưa có số","gry"));return w.join(" ")};
  const row=r=>`<tr class="clk" data-go="${r.go}"><td><b>${r.n}</b><br><small class="hint">${esc(r.src||"")}</small>${r.dang?`<br><small class="hint">đang giao, chưa tính: ${nf(r.dang)} đơn · ${tr(r.dangDt)}</small>`:""}</td><td class="n">${r.dt==null?"—":r.dt===0?"0 đ":tr(r.dt)}</td><td class="n">${r.don?nf(r.don):r.dt===0?"0":"—"}</td><td class="n">${r.gv?tr(r.gv):"—"}</td><td class="n">${r.phi?tr(r.phi):"—"}</td><td class="n">${r.ads?tr(r.ads):"—"}</td><td class="n"><b class="${r.lai<0?"t-red":""}">${r.lai==null?"—":tr(r.lai)}</b></td><td class="n">${r.dt&&r.lai!=null?dhPct(r.lai/r.dt):"—"}</td><td>${warn(r)}</td></tr>`;
  const sub=(m)=>{const R=rows.filter(r=>r.mang===m),t=tqTot(R);return `<tr class="tot"><td>${m}</td><td class="n">${tr(t.dt)}</td><td class="n">${t.don?nf(t.don):"—"}</td><td></td><td></td><td></td><td class="n">${tr(t.lai)}</td><td class="n">${t.dt?dhPct(t.lai/t.dt):"—"}</td><td></td></tr>`};
  return `<section class="card flush"><div class="card-h pad"><h2>Lãi theo kênh</h2><span class="hint">${esc(pLabel())} · doanh thu thực · lãi đóng góp (chưa trừ lương, chi phí chung)</span></div>
   <div class="tbl"><table><thead><tr><th>Kênh · nguồn số</th><th class="n">Doanh thu thực</th><th class="n">Đơn</th><th class="n">Giá vốn</th><th class="n">Phí sàn / ship, thuế</th><th class="n">Quảng cáo</th><th class="n">Lãi đóng góp</th><th class="n">Biên</th><th>Cảnh báo</th></tr></thead><tbody>
   ${rows.filter(r=>r.mang==="Bán lẻ").map(row).join("")}${sub("Bán lẻ")}${rows.filter(r=>r.mang!=="Bán lẻ").map(row).join("")}
   <tr class="tot"><td><b>Tổng công ty</b>${T.thieu.length?`<br><small class="hint">chưa có số: ${esc(T.thieu.join(", "))}</small>`:""}</td><td class="n"><b>${tr(T.dt)}</b></td><td class="n">${nf(T.don)}</td><td></td><td></td><td></td><td class="n"><b>${tr(T.lai)}</b></td><td class="n">${T.dt?dhPct(T.lai/T.dt):"—"}</td><td></td></tr></tbody></table></div>
   <p class="hint pad">Doanh thu thực: TikTok là doanh thu thuần theo quyết toán (tháng chưa chốt thì tạm tính từ đơn xuất kho, không dùng GMV); Facebook là đơn giao thành công (đơn đang giao chưa tính); B2B, gia công là đơn đã duyệt. Bấm từng dòng để xem chi tiết kênh.</p></section>`+dhTabBaTang();
}
/* Tab Hôm nay: dùng nội dung Tổng quan cũ, thay 4 ô số đầu bằng số chung, bỏ bảng kênh (đã ở tab Lãi theo kênh). */
function tqPatchHomNay(m){
  const rows=tqKenhRows(),T=tqTot(rows),strip=m.querySelector(".xkstrip");
  if(strip){const cells=[...strip.children],mk=(ic,l,v,h,go)=>`<button type="button" class="xk${v==null?" mut":""}" ${go?`data-sub="${go}"`:""}><span class="xkh"><span class="kic k-${ic}">${ico(ic)}</span><span class="xkl">${l}</span></span><span class="xkv numeric">${v==null?"Chưa đủ dữ liệu":v}</span><span class="xkm">${h}</span></button>`;
    const nw=[mk("money","Doanh thu thực",T.dt?tr(T.dt):null,`${T.tam?"có phần tạm tính · ":""}giao thành công, quyết toán, đơn đã duyệt`,"kenh"),mk("wallet","Chi phí trực tiếp",T.cp?tr(T.cp):null,`giá vốn, phí sàn/ship, quảng cáo · ${T.dt?dhPct(T.cp/T.dt):""} doanh thu`,"kenh"),mk("trend","Lãi đóng góp",T.dt?tr(T.lai):null,`${T.dt?dhPct(T.lai/T.dt):""} · chưa trừ lương, chi phí chung`,"kenh"),mk("cart","Đơn hàng",T.don?nf(T.don):null,"đơn giao thành công, xuất kho, đã duyệt","kenh")];
    const tmp=document.createElement("div");tmp.innerHTML=nw.join("");cells.slice(0,4).forEach((c,i)=>c.replaceWith(tmp.children[0]))}
  m.querySelectorAll(".card").forEach(c=>{const h=c.querySelector(".card-h h2");if(h&&/Hiệu quả kinh doanh theo kênh/.test(h.textContent)){const p=c.parentElement;c.remove();if(p&&p.classList.contains("xrow2"))p.style.gridTemplateColumns="1fr"}});
  /* Ô "Doanh thu kỳ" ở khối Kinh doanh B2C dùng cùng số doanh thu thực (execNums đã đổi), ghi rõ. */
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
{const _ea=execAlerts;execAlerts=function(){const A=_ea.apply(this,arguments);try{if(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin"&&dhOk()){const R=(execNums(PERIOD.from,PERIOD.to).rev)||{};[["tts","TikTok Shop"],["fb","Facebook"]].forEach(([k,n])=>{const r=R[k];if(r&&r.dt&&r.ads/r.dt>0.4)A.unshift(["red",`${n}: quảng cáo ${dhPct(r.ads/r.dt)} doanh thu thực`,"Tổng quan › Lãi theo kênh","exec"])})}}catch(e){}return A}}
