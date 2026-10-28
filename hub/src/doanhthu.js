/* =====================================================================
   DOANH THU THỰC: MỘT CHỖ TÍNH CHO MỌI TRANG (chị Hoa chốt 26/10/2026). Luật ở dtcalc.js.
   - Facebook: đơn giao thành công theo ngày tạo đơn, lấy từ Pancake (blob fb_sale_days, cập nhật mỗi sáng).
     Ghi đè vào DAYD.fb để mọi trang cộng cột [5] ra cùng một số. Trước đây DAYD.fb là Sheet tải lên khoảng 26/9:
     các ngày 26–29/9 còn 0 vì đơn chưa giao xong, ngày 30/9 bù bằng số ước (adsday.js) nên hai web lệch nhau.
   - TikTok, Shopee: như tqRevB2C (tqgop.js). Kênh phân phối, Kênh OEM: đơn đã duyệt trên CRM (b2bpl.js).
   - Số đã chốt (từ ngày 10 tháng sau) lưu ở máy chủ (/api/hub/dieuhanh/doanhthu), trang nào cũng lấy số đó cho tháng đã chốt.
   - Trang Đối chiếu doanh thu (dt_dc): số web, số file nguồn, số kế toán nhập tay, chênh lệch, xem từng ngày / từng đơn.
   Nạp sau tqgop.js, b2bpl.js, fbpl.js, tiktok.js và trước menubang.js.
   ===================================================================== */
const DTS={rows:{},rowsAt:0,busy:false,err:"",live:0,fbFor:null,fbAt:"",fbMine:{},fbDay:{},fbGoc:{},mine:new WeakSet(),auto:{},inAuto:false,tsb:false};
const dtToday=()=>iso(new Date());
const dtOk=()=>typeof dhOk==="function"&&!!dhOk();
const DT_PAGES=["exec","pl","bc_tong","muctieu","dt_dc","bc_tiktok","bc_shopee","bc_fb","bc_b2b","bc_gc","so_cp"];
const dtRe=()=>{if(DT_PAGES.includes(PAGE)&&!(typeof svTyping==="function"&&svTyping()))renderMain()};
const dtYmVN=ym=>ym.slice(5,7)+"/"+ym.slice(0,4);
const DT_ROWK={tts:"tts",spe:"spe",fb:"fb",B2B:"b2b",GIA_CONG:"gc"};

/* ---------- Số đã chốt và số kế toán (máy chủ) ---------- */
function dtLoadRows(force){
  if(!dtOk()||DTS.busy||(!force&&DTS.rowsAt&&Date.now()-DTS.rowsAt<600000))return;DTS.busy=true;
  svApi("/api/hub/dieuhanh/doanhthu?from=2026-01&to=2030-12").then(r=>{const o={};(r||[]).forEach(x=>{(o[x.ym]=o[x.ym]||{})[x.channel]=x});DTS.rows=o;DTS.err=""})
    .catch(e=>{DTS.err=e.message}).finally(()=>{DTS.rowsAt=Date.now();DTS.busy=false;dtRe()})}
function dtSnap(ym,ch){const x=DTS.rows[ym]&&DTS.rows[ym][ch];if(!x||!x.closed_at||x.web_amount==null)return null;let d={};try{d=JSON.parse(x.web_json||"null")||{}}catch(e){}
  return {...d,dt:+x.web_amount,don:x.web_orders==null?d.don:+x.web_orders,closedAt:x.closed_at}}
/* Số đã chốt của cả kỳ (chỉ khi kỳ gồm trọn các tháng và tháng nào cũng đã chốt). */
function dtFrozen(ch,from,to){
  const ms=tqMonths(from,to),t=dtToday();if(!ms.length||!ms.every(k=>fullMonth(k,from,to)&&dtTrangThai(k,t)==="chot"))return null;
  const S=ms.map(k=>dtSnap(k,ch));if(S.some(s=>!s))return null;
  const f=k=>S.some(s=>s[k]!=null)?S.reduce((a,s)=>a+(+s[k]||0),0):null;
  return {dt:f("dt"),don:f("don"),gv:f("gv"),phi:f("phi"),ads:f("ads"),khac:f("khac"),lai:f("lai"),src:S.map(s=>s.src).filter(Boolean)[0]||"",frozen:true,closedAt:S[S.length-1].closedAt,ms}}

/* ---------- Facebook: đơn giao thành công từ Pancake ghi đè DAYD.fb ---------- */
function dtSyncFb(){
  if(typeof FBS==="undefined"||typeof DAYD==="undefined"||!DAYD)return;
  if(typeof fbsLoad==="function")fbsLoad();
  const F=FBS.raw&&FBS.raw.days;if(!F)return;DAYD.fb=DAYD.fb||{};
  if(DTS.fbFor!==DAYD){DTS.fbFor=DAYD;DTS.fbGoc={};DTS.fbAt=""}
  if(DTS.fbAt!==FBS.raw.at){DTS.fbAt=FBS.raw.at;DTS.fbMine={};DTS.fbDay={}}
  for(const k in F){const cur=DAYD.fb[k];if(cur&&cur===DTS.fbMine[k])continue;
    const a=DTS.fbDay[k]||(DTS.fbDay[k]=dtFbNgay(F[k])),est=typeof ADF!=="undefined"&&ADF.mgFb&&ADF.mgFb.has(k);
    if(cur&&!est&&!DTS.mine.has(cur)&&!DTS.fbGoc[k])DTS.fbGoc[k]=cur.slice();
    const g=DTS.fbGoc[k],ratio=g&&g[5]>0&&g[7]>0?g[7]/g[5]:(typeof ADF_GV!=="undefined"?ADF_GV:0.156);
    const row=[a.tao,Math.max(0,a.tao-a.huy),a.huy,a.hoan,a.giao,a.dtGiao,a.dt,Math.round(a.dtGiao*ratio),cur?+cur[8]||0:0,cur?+cur[9]||0:0];
    DAYD.fb[k]=row;DTS.fbMine[k]=row;DTS.mine.add(row)}}
/* Đơn Facebook đang giao trong khoảng ngày (doanh thu, số đơn). */
function dtFbDang(from,to){dtSyncFb();let v=0,n=0;for(const k in DTS.fbDay)if(k>=from&&k<=to){const a=DTS.fbDay[k];v+=a.dang;n+=Math.max(0,a.tao-a.huy-a.giao-a.hoan)}return {v,n}}
{const _r=rSum;rSum=function(src){if(src==="fb")try{dtSyncFb()}catch(e){}return _r.apply(this,arguments)}}
if(typeof adfMergeDays==="function"){const _m=adfMergeDays;adfMergeDays=function(){const x=_m.apply(this,arguments);try{dtSyncFb()}catch(e){}return x}}
if(typeof fbsLoad==="function"){const _l=fbsLoad;fbsLoad=async function(){const a=FBS.raw&&FBS.raw.at,x=await _l.apply(this,arguments);if((FBS.raw&&FBS.raw.at)!==a){dtSyncFb();dtRe()}return x}}
/* P&L Facebook (quản trị): ô doanh thu cùng số với các trang khác trên cùng các ngày Sheet có chi phí. */
if(typeof fbdCost==="function"){const _c=fbdCost;fbdCost=function(days){const o=_c.apply(this,arguments);try{dtSyncFb();const R=FBC.raw&&FBC.raw.days;if(R&&o.n){let d=0;days.forEach(k=>{if(R[k])d+=+((DAYD.fb||{})[k]||[])[5]||0});o.gop+=d-o.dt;o.dt=d}}catch(e){}return o}}

/* ---------- Nhãn chốt + số đã chốt áp vào từng dòng kênh ---------- */
function dtEnsure(){dtLoadRows();
  /* Quảng cáo Facebook theo ngày (ads_fb) chỉ có khi đã tải và gộp vào DAYD.ads: mở thẳng Lãi lỗ / So sánh kênh mà chưa qua trang Facebook thì quảng cáo bằng 0, lãi bị đội. */
  if(!DTS.adf&&typeof adfLoad==="function"&&typeof ADF!=="undefined"){DTS.adf=true;Promise.resolve(ADF.raw||adfLoad()).then(()=>{try{adfMergeDays()}catch(e){}dtRe()}).catch(()=>{DTS.adf=false})}if(!DTS.tsb&&typeof TSB!=="undefined"&&!TSB.months&&typeof tsbLoadMonths==="function"){DTS.tsb=true;Promise.resolve(tsbLoadMonths()).then(dtRe).catch(()=>{})}}
function dtLabel(r,ch,from,to){
  if(!r||r._dt)return r;r._dt=1;const t=dtToday(),ms=tqMonths(from,to);if(ms.length!==1)return r;
  const ym=ms[0],st=dtTrangThai(ym,t);r.chot=st;r.ym=ym;
  if(st==="chot"&&!fullMonth(ym,from,to))r.nhan="một phần tháng đã chốt, số tính theo ngày";
  else if(st==="chot"){r.nhan=r.frozen?dtNhan(ym,t):!DTS.rowsAt?"đã qua ngày chốt, đang tải số chốt":r.dt>0&&!r.tam&&!r.thieu?"đã qua ngày chốt, đang lưu số chốt":"đã qua ngày chốt, chưa đủ số để chốt"}
  else{r.dk=ch==="fb"&&r.dt!=null?dtDuKien(r.dt,r.dangDt||0,DT_HOAN_FB):r.dt;r.nhan=dtNhan(ym,t)+(ch==="fb"&&r.dangDt?` · dự kiến ${tr(r.dk)} khi ${nf(r.dang)} đơn đang giao có kết quả (hoàn dự kiến ${Math.round(DT_HOAN_FB*100)}%)`:"")}
  r.src=r.nhan+(r.src?" · "+r.src:"");return r}
{const _t=tqRevB2C;tqRevB2C=function(N,from,to){const out=_t.apply(this,arguments);if(DTS.live||!dtOk())return out;dtEnsure();
  try{if(out.fb&&out.fb.dt!=null){const d=dtFbDang(from,to);out.fb.dang=d.n;out.fb.dangDt=d.v}
    ["tts","fb","spe"].forEach(k=>{const f=dtFrozen(k,from,to);if(f)out[k]={...out[k],...f,src:f.src,tam:false,dang:0,dangDt:0};dtLabel(out[k],k,from,to)})}catch(e){}
  return out}}
if(typeof b2bChannel==="function"){const _b=b2bChannel;b2bChannel=function(ch){const X=_b.apply(this,arguments);if(!X||DTS.live||!dtOk())return X;
  const f=dtFrozen(ch==="GIA_CONG"?"gc":"b2b",PERIOD.from,PERIOD.to);if(!f)return X;const d=f.dt-(+X.net||0);return {...X,has:true,net:f.dt,orders:f.don!=null?f.don:X.orders,gross:(+X.gross||0)+d,frozen:true}}}
/* Chi phí Sổ chi phí bổ thẳng về kênh (luật ở dtcalc.js): trừ vào lãi đóng góp kênh, ghi ở r.cpk. Không áp khi tính số chốt (số chốt chỉ giữ doanh thu, chi phí sổ luôn lấy theo sổ hiện tại). */
const DT_NKC_ROW={tts:"tts",fb:"fb",spe:"spe",B2B:"b2b",GIA_CONG:"gc"};
function dtSoCp(from,to){const f=typeof D==="function"&&D()&&D().fin;if(!f||!f.nkc)return null;return dtNkcKenh(f.nkc,from,to,g=>typeof scG==="function"?scG(g).lo:"")}
function dtTruSoCp(rows,from,to){const S=dtSoCp(from,to);if(!S)return;rows.forEach(r=>{const k=DT_NKC_ROW[r.k],v=k?S.v[k]:0;if(!v||r._cpk||r.dt==null)return;r._cpk=1;r.cpk=(r.cpk||0)+v;r.khac=(r.khac||0)+v;if(r.lai!=null)r.lai-=v;
  r.src=(r.src?r.src+" · ":"")+`đã trừ ${tr(v)} chi phí Sổ chi phí bổ về kênh (${S.n[k]} dòng)`})}
/* Lương làm riêng cho kênh (bảng lương đã chốt) trừ ở lãi đóng góp; chi chung được chia theo Quy tắc phân bổ ghi ở r.chia cho dòng Lãi sau phân bổ.
   Hàm scPLKenh (scphanbo.js, chat Sổ chi phí) chỉ tính theo tháng nên chỉ áp khi kỳ nằm trong một tháng. Nó tự gọi lại doanh thu: cờ DTS.inPB chặn vòng lặp. */
const DT_SC_K={tts:["TikTok"],spe:["Shopee Mall","Shopee thường"],fb:["Facebook"],B2B:["NPP"],GIA_CONG:["Gia công"]};
/* scPLKenh nặng (tính lại doanh thu, chia chi chung) mà tqKenhRows gọi nhiều lần mỗi lần vẽ trang: nhớ kết quả 20 giây theo tháng (chị báo quản trị lag 28/10). */
const DT_PBC={};
function dtPB(ym){if(DTS.inPB||typeof scPLKenh!=="function")return null;const c=DT_PBC[ym];if(c&&Date.now()-c.t<20000)return c.v;
  DTS.inPB=true;try{const v=scPLKenh(ym);DT_PBC[ym]={t:Date.now(),v};return v}catch(e){return null}finally{DTS.inPB=false}}
function dtTruLuong(rows,from,to){const ym=from.slice(0,7);if(to.slice(0,7)!==ym)return;const L=dtPB(ym);if(!L)return;
  rows.forEach(r=>{const ks=DT_SC_K[r.k];if(!ks||r._lg||r.dt==null)return;r._lg=1;const s=o=>ks.reduce((a,k)=>a+(+(o||{})[k]||0),0),lg=s(L.luong);
    r.chia=s(L.chia);if(lg){r.luong=lg;r.khac=(r.khac||0)+lg;if(r.lai!=null)r.lai-=lg;r.src=(r.src?r.src+" · ":"")+`đã trừ ${tr(lg)} lương làm riêng cho kênh (bảng lương đã chốt)`}})}
{const _k=tqKenhRows;tqKenhRows=function(){const rows=_k.apply(this,arguments);if(DTS.live)return rows;try{dtTruSoCp(rows,PERIOD.from,PERIOD.to)}catch(e){}try{dtTruLuong(rows,PERIOD.from,PERIOD.to)}catch(e){}if(!dtOk())return rows;
  try{rows.forEach(r=>{if(r.k==="B2B"||r.k==="GIA_CONG"){const X=b2bChannel(r.k);if(X&&X.frozen)r.frozen=true;dtLabel(r,DT_ROWK[r.k],PERIOD.from,PERIOD.to)}})}catch(e){}
  try{dtAutoChot()}catch(e){}return rows}}

/* ---------- Số đang tính (chưa áp số chốt) của một tháng, mọi kênh ---------- */
function dtLiveMonth(ym){DTS.live++;try{const R=plRange(ym),rows=plRowsFor(R.from,R.to),o={};rows.forEach(r=>{o[DT_ROWK[r.k]]=r});
    o._loading=rows.some(r=>r.src==="đang tải…");if(o.fb&&o.fb.dt!=null){const d=dtFbDang(R.from,R.to);o.fb={...o.fb,dang:d.n,dangDt:d.v}}return o}
  finally{DTS.live--}}
/* Số trang hiện cho một tháng (đã áp số chốt + nhãn). */
function dtShownMonth(ym){const R=plRange(ym),rows=plRowsFor(R.from,R.to),o={};rows.forEach(r=>{o[DT_ROWK[r.k]]=r});return o}
/* Tới ngày 10 tháng sau: lưu số web các kênh đã đủ số (không lưu số trống, 0, số tạm tính hay báo cáo chưa phủ đủ tháng). */
function dtAutoChot(){
  if(DTS.inAuto||!dtOk()||!DTS.rowsAt||DTS.err)return;const t=dtToday();
  if(typeof TSB!=="undefined"&&!Array.isArray(TSB.months))return;if(typeof FBS!=="undefined"&&!FBS.raw)return;
  DTS.inAuto=true;
  try{for(let ym=DT_TU;dtTrangThai(ym,t)==="chot";ym=plYmAdd(ym,1)){if(DTS.auto[ym])continue;
      const need=["tts","spe","fb","b2b","gc"].filter(ch=>!dtSnap(ym,ch));if(!need.length){DTS.auto[ym]=1;continue}
      const L=dtLiveMonth(ym);if(L._loading)continue;
      const rows=need.map(ch=>{const r=L[ch];return r&&dtCanChot(ym,t,null,r.dt)&&!r.tam&&!r.thieu?{channel:ch,amount:Math.round(r.dt),orders:r.don==null?null:Math.round(+r.don||0),data:{dt:r.dt,don:r.don,gv:r.gv,phi:r.phi,ads:r.ads,khac:r.khac,lai:r.lai,src:r.src}}:null}).filter(Boolean);
      DTS.auto[ym]=1;if(!rows.length)continue;
      svApi("/api/hub/dieuhanh/doanhthu/chot",{method:"POST",body:JSON.stringify({ym,rows})}).then(()=>dtLoadRows(true)).catch(e=>{DTS.auto[ym]=0;console.warn("chốt doanh thu",ym,e.message)})}}
  finally{DTS.inAuto=false}}

/* ---------- Dòng doanh thu thực trên đầu trang từng kênh (hai web) ---------- */
[["bc_tiktok","tts"],["bc_shopee","spe"],["bc_fb","fb"],["bc_b2b","B2B"],["bc_gc","GIA_CONG"]].forEach(([id,k])=>{const _p=PAGES[id];if(typeof _p!=="function")return;
  PAGES[id]=function(m){const x=_p.apply(this,arguments);try{if(dtOk()){if(typeof b2bLoad==="function")b2bLoad();const r=tqKenhRows().find(z=>z.k===k),ph=m.querySelector(".ph");
    if(r&&ph&&!m.querySelector(".dt-ban"))ph.insertAdjacentHTML("afterend",`<div class="note dt-ban" style="margin-bottom:10px"><b>Doanh thu thực ${esc(pLabel())}: ${r.dt==null?"chưa có số":tr(r.dt)}</b>${r.chot?" "+pill(r.chot==="chot"&&r.frozen?"đã chốt":"chưa chốt",r.chot==="chot"&&r.frozen?"grn":"amb"):""}<br><small class="hint">${esc(r.src||"")} · cùng số với Tổng quan công ty, P&L, So sánh kênh và Đối chiếu doanh thu.</small></div>`)}}catch(e){}return x}});

/* ---------- Trang Đối chiếu doanh thu (quản trị › Điều hành CEO) ---------- */
const DTD={ym:"",open:"",orders:{},busy:{}};
function dtFile(ch,ym){
  const days=(o,i)=>{let v=0,n=0;for(const k in o||{})if(k.slice(0,7)===ym){v+=+o[k][i]||0;n++}return n?v:null};
  if(ch==="tts"){const s=(typeof TSB!=="undefined"&&TSB.sum||{})[ym];return s&&s.dt?{v:s.dt,n:"Báo cáo quyết toán TikTok "+(s.den?"đến ngày "+dtVN(s.den):"cả tháng")}:{v:null,n:"chưa tải báo cáo quyết toán TikTok"}}
  if(ch==="fb"){const R=typeof FBC!=="undefined"&&FBC.raw&&FBC.raw.days;if(!R)return {v:null,n:"Sheet Pancake đang tải…"};let v=0,n=0,last="";for(const k in R)if(k.slice(0,7)===ym){v+=+R[k].g[1]||0;n++;if(k>last)last=k}
    return n?{v,n:`Sheet Pancake (đơn giao thành công) cập nhật ${FBC.raw.at?dtVN(FBC.raw.at.slice(0,10)):""}, có đến ngày ${dtVN(last)}`}:{v:null,n:"Sheet Pancake chưa có tháng này"}}
  if(ch==="spe"){const v=days(DAYD.spe,0);return v==null?{v:null,n:"chưa tải báo cáo Shopee"}:{v,n:"File Shopee đã tải lên"}}
  if(ch==="cskh")return {v:null,n:"mảng chưa chạy"};
  return {v:null,n:"CRM là nguồn, không có file riêng"}}
function dtKt(ym,ch){const x=DTS.rows[ym]&&DTS.rows[ym][ch];return x&&x.kt_amount!=null?{v:+x.kt_amount,note:x.kt_note||"",at:x.kt_at}:null}
const dtMoney=v=>v==null?`<span class="hint">—</span>`:`<span class="${v<0?"t-red":""}">${nf(v)}</span>`;
const dtDiff=(a,b)=>{const d=dtLech(a,b);if(d==null)return `<span class="hint">—</span>`;const big=Math.abs(d)>Math.max(1e6,Math.abs(b||0)*0.01);return `<b class="${big?"t-red":""}">${d>0?"+":""}${nf(d)}</b>`};
function dtChiTiet(ch,ym){
  const vn=dtVN,end=plYmEnd(ym);
  if(ch==="fb"){dtSyncFb();const R=(typeof FBC!=="undefined"&&FBC.raw&&FBC.raw.days)||{},ks=[];for(let d=pdate(ym+"-01");iso(d)<=end;d=addD(d,1))ks.push(iso(d));
    let s=[0,0,0,0];const body=ks.map(k=>{const w=((DAYD.fb||{})[k]||[])[5],a=DTS.fbDay[k],sh=R[k]?+R[k].g[1]:null,g=DTS.fbGoc[k]?DTS.fbGoc[k][5]:null;if(w==null&&sh==null)return "";s[0]+=+w||0;s[1]+=+sh||0;s[2]+=a?a.dang:0;s[3]+=a?a.giao:0;
      return `<tr><td>${vn(k)}</td><td class="n">${dtMoney(w)}</td><td class="n">${a?nf(a.giao):"—"}</td><td class="n">${a?dtMoney(a.dang):"—"}</td><td class="n">${dtMoney(sh)}</td><td class="n">${dtDiff(w,sh)}</td><td class="n hint">${g==null?"—":nf(g)}</td></tr>`}).join("");
    return `<div class="tbl"><table><thead><tr><th>Ngày tạo đơn</th><th class="n">Số web: giao thành công (Pancake)</th><th class="n">Đơn giao TC</th><th class="n">Đang giao</th><th class="n">Sheet Pancake</th><th class="n">Web − Sheet</th><th class="n">Sheet cũ (tải ~26/9)</th></tr></thead><tbody>${body}
      <tr class="tot"><td>Cộng</td><td class="n">${nf(s[0])}</td><td class="n">${nf(s[3])}</td><td class="n">${nf(s[2])}</td><td class="n">${nf(s[1])}</td><td class="n">${dtDiff(s[0],s[1])}</td><td></td></tr></tbody></table></div>
      <p class="hint pad">Số web = đơn giao thành công theo ngày tạo đơn, Pancake cập nhật mỗi sáng${FBS.raw&&FBS.raw.at?" (lần gần nhất "+vn(FBS.raw.at.slice(0,10))+")":""}. Sheet Pancake chỉ cập nhật khi tải lên nên các ngày gần đây thấp hơn. "Sheet cũ" là số trước đây các trang cộng.</p>`}
  if(ch==="tts"){const s=(typeof TSB!=="undefined"&&TSB.sum||{})[ym];if(!s||!s.days)return `<p class="hint pad">${s?"Báo cáo tháng này không có số theo ngày.":"Chưa tải báo cáo quyết toán TikTok tháng này (Kênh bán hàng › TikTok Shop › Tải file tháng)."}</p>`;
    const ks=Object.keys(s.days).sort();let a=0,b=0;const body=ks.map(k=>{const x=s.days[k];a+=+x[0]||0;b+=+x[1]||0;return `<tr><td>${vn(k)}</td><td class="n">${nf(x[0])}</td><td class="n">${nf(x[1])}</td></tr>`}).join("");
    return `<div class="tbl"><table><thead><tr><th>Ngày</th><th class="n">Doanh thu thuần (báo cáo)</th><th class="n">Đơn</th></tr></thead><tbody>${body}<tr class="tot"><td>Cộng</td><td class="n">${nf(a)}</td><td class="n">${nf(b)}</td></tr></tbody></table></div>`}
  if(ch==="spe"){const D0=DAYD.spe||{},ks=Object.keys(D0).filter(k=>k.slice(0,7)===ym).sort();if(!ks.length)return `<p class="hint pad">Chưa tải báo cáo Shopee tháng này.</p>`;
    return `<div class="tbl"><table><thead><tr><th>Ngày</th><th class="n">Doanh thu (file Shopee)</th><th class="n">Đơn</th></tr></thead><tbody>${ks.map(k=>`<tr><td>${vn(k)}</td><td class="n">${nf(D0[k][0])}</td><td class="n">${nf(D0[k][4])}</td></tr>`).join("")}</tbody></table></div>`}
  if(ch==="b2b"||ch==="gc"){const c=ch==="b2b"?"B2B":"GIA_CONG",key=ym+"|"+c,L=DTD.orders[key];
    if(L===undefined){if(!DTD.busy[key]){DTD.busy[key]=1;svApi(`/api/hub/dieuhanh/doanhthu/b2b-orders?ym=${ym}&channel=${c}`).then(r=>{DTD.orders[key]=r||[]}).catch(e=>{DTD.orders[key]={err:e.message}}).finally(()=>{DTD.busy[key]=0;if(PAGE==="dt_dc")renderMain()})}return `<p class="hint pad">Đang tải đơn…</p>`}
    if(L.err)return `<div class="note red">${esc(L.err)}</div>`;if(!L.length)return `<p class="hint pad">Không có đơn đã duyệt trong tháng.</p>`;
    return `<div class="tbl"><table><thead><tr><th>Mã đơn</th><th>Ngày đơn</th><th>Khách</th><th class="n">Doanh thu (sau chiết khấu, trừ thưởng)</th></tr></thead><tbody>${L.map(o=>`<tr><td>${esc(o.order_no)}</td><td>${vn(String(o.order_date).slice(0,10))}</td><td>${esc(o.customer)}</td><td class="n">${nf(o.revenue)}</td></tr>`).join("")}
      <tr class="tot"><td colspan="3">Cộng ${nf(L.length)} đơn</td><td class="n">${nf(L.reduce((a,o)=>a+(+o.revenue||0),0))}</td></tr></tbody></table></div>`}
  return `<p class="hint pad">Mảng CSKH cũ chưa chạy nên chưa có số.</p>`}
function pDtDoiChieu(m){
  if(!dtOk()){m.innerHTML=H("Đối chiếu doanh thu","")+`<div class="note">Trang này chỉ dành cho CEO và kế toán.</div>`;return}
  dtEnsure();if(typeof dhLoad==="function")dhLoad();if(typeof fbcLoad==="function")fbcLoad();if(typeof adfLoad==="function"){adfLoad();adfMergeDays()}if(typeof tsbLoadAll==="function")tsbLoadAll();
  const t=dtToday(),cur=t.slice(0,7),pk=PERIOD.from+"|"+PERIOD.to;
  /* Tháng theo ô chọn thời gian (tháng của ngày cuối kỳ); bấm nút tháng trên trang thì giữ tháng đó tới khi đổi kỳ. */
  if(DTD.pk!==pk){DTD.pk=pk;DTD.ym="";DTD.open=""}
  const ym=DTD.ym||plYmNow(),st=dtTrangThai(ym,t);
  const S=dtShownMonth(ym),L=dtLiveMonth(ym),ceo=typeof isCeo==="function"&&isCeo();
  const tabs=[],tk=[];for(let i=-3;i<=0;i++){const k=plYmAdd(cur,i);if(k>="2026-08")tk.push(k)}if(!tk.includes(ym))tk.unshift(ym);tk.forEach(k=>{tabs.push(`<button data-dtym="${k}" class="${k===ym?"on":""}">Tháng ${dtYmVN(k)}</button>`)})
  const tot={w:0,f:0,k:0,hasF:false,hasK:false};
  const body=DT_KENH.map(([ch,n])=>{const r=S[ch]||{dt:null,src:"mảng chưa chạy, chưa có số"},l=L[ch]||{},F=dtFile(ch,ym),K=dtKt(ym,ch),snap=dtSnap(ym,ch);
    if(r.dt!=null)tot.w+=+r.dt||0;if(F.v!=null){tot.f+=F.v;tot.hasF=true}if(K){tot.k+=K.v;tot.hasK=true}
    const lab=st==="chot"?(snap?pill("đã chốt","grn")+`<br><small class="hint">số lưu ngày ${dtVN(String(snap.closedAt).slice(0,10))}</small>`:pill("chưa lưu số chốt","gry")):pill("chưa chốt – dự kiến","amb");
    const drift=snap&&l.dt!=null&&Math.abs(l.dt-snap.dt)>=1000?`<br><small class="hint">tính lại hôm nay: ${nf(l.dt)} (${l.dt-snap.dt>0?"+":""}${nf(l.dt-snap.dt)})</small>`:"";
    const dk=st!=="chot"&&r.dk!=null&&r.dk!==r.dt?`<br><small class="hint">dự kiến ${nf(r.dk)}</small>`:"";
    return `<tr class="clk${DTD.open===ch?" sel":""}" data-dtopen="${ch}"><td><b>${n}</b><br><small class="hint">${esc(r.src||"")}</small></td><td>${lab}${ceo&&snap&&ch!=="cskh"?`<br><button class="btn sm" data-dtre="${ch}" title="Chỉ khi số chốt sai">Chốt lại</button>`:""}</td>
      <td class="n"><b>${r.dt==null?`<span class="hint">chưa có số</span>`:nf(r.dt)}</b>${dk}${drift}</td>
      <td class="n">${dtMoney(F.v)}<br><small class="hint">${esc(F.n)}</small></td>
      <td class="n" data-stop="1">${ch==="cskh"?"":`<input type="text" inputmode="numeric" data-dtkt="${ch}" value="${K?nf(K.v):""}" placeholder="nhập số" style="width:130px;text-align:right"><br><input type="text" data-dtktn="${ch}" value="${esc(K?K.note:"")}" placeholder="ghi chú" style="width:130px;margin-top:3px">`}</td>
      <td class="n">${dtDiff(r.dt,F.v)}</td><td class="n">${dtDiff(r.dt,K?K.v:null)}</td></tr>`}).join("");
  const open=DTD.open?DT_KENH.find(x=>x[0]===DTD.open):null;
  m.innerHTML=H("Đối chiếu doanh thu",`Doanh thu thực từng kênh × tháng · số web (mọi trang dùng chung) so với file nguồn và số kế toán · chốt số ngày 10 tháng sau`)+`
  <div class="tabs" style="margin-bottom:10px">${tabs.join("")}</div>
  <div class="note ${st==="chot"?"":"amb"}">Tháng ${dtYmVN(ym)}: ${st==="chot"?`<b>đã tới ngày chốt ${dtVN(dtNgayChot(ym))}</b>. Số web đã lưu không đổi nữa; cột "tính lại hôm nay" chỉ để thấy dữ liệu nguồn có thay đổi sau ngày chốt.`:`<b>chưa chốt – dự kiến</b>. Số sẽ tự lưu (đóng băng) từ ngày ${dtVN(dtNgayChot(ym))}.`}${DTS.err?` <span class="t-red">Lỗi tải số chốt: ${esc(DTS.err)}</span>`:""}</div>
  <section class="card flush"><div class="tbl"><table><thead><tr><th>Kênh · cách tính</th><th>Nhãn</th><th class="n">Số web (doanh thu thực)</th><th class="n">Số file nguồn đã tải</th><th class="n">Số kế toán (nhập tay)</th><th class="n">Web − file</th><th class="n">Web − kế toán</th></tr></thead><tbody>${body}
   <tr class="tot"><td><b>Cộng các kênh</b></td><td></td><td class="n"><b>${nf(tot.w)}</b></td><td class="n">${tot.hasF?nf(tot.f):"—"}</td><td class="n">${tot.hasK?nf(tot.k):"—"}</td><td></td><td class="n">${tot.hasK?dtDiff(tot.w,tot.k):"—"}</td></tr></tbody></table></div>
   <div class="acts pad"><button class="btn pri" id="dt-kt-save">Lưu số kế toán</button><span class="hint">Số kế toán: chị Huệ nhập số đã chốt sổ của từng kênh (đ). Để trống ô nào thì xóa số ô đó. Bấm từng dòng để xem từng ngày / từng đơn tạo nên số web. Chênh lệch tô đỏ khi lệch trên 1% (tối thiểu 1 triệu).</span></div></section>
  ${open?`<section class="card flush"><div class="card-h pad"><h2>${open[1]} · tháng ${dtYmVN(ym)}: số web từng ngày / từng đơn</h2><button class="btn sm" id="dt-close">Đóng</button></div>${dtChiTiet(open[0],ym)}</section>`:""}
  <section class="card"><div class="card-h"><h2>Cách tính doanh thu thực (một cách cho mọi trang)</h2></div><ul class="lessons">
   <li><b>TikTok Shop:</b> doanh thu thuần theo báo cáo quyết toán đã tải lên; tải báo cáo hàng tuần; ngày chưa có báo cáo thì để trống, ghi "chờ tải báo cáo" (không ước từ số đơn). Tháng chỉ chốt khi báo cáo phủ đủ cả tháng. GMV chỉ là chỉ số hiệu suất.</li>
   <li><b>Shopee:</b> doanh thu theo file báo cáo Shopee tải lên; chưa tải thì để trống.</li>
   <li><b>Facebook:</b> đơn giao thành công theo ngày tạo đơn (Pancake, cập nhật mỗi sáng). Doanh thu chốt đơn chỉ là chỉ số hiệu suất. Dự kiến = giao thành công + đơn đang giao × (1 − ${Math.round(DT_HOAN_FB*100)}% hoàn dự kiến).</li>
   <li><b>Kênh phân phối, Kênh OEM:</b> đơn đã duyệt trên CRM theo ngày đơn (sau chiết khấu, trừ thưởng).</li>
   <li><b>Chốt số:</b> đơn tháng nào tính tháng đó. Từ ngày 10 tháng sau, số web được lưu lại và mọi trang hiện đúng số đã lưu. Kênh chưa có số, số 0 hoặc báo cáo chưa phủ đủ tháng thì chưa lưu, chờ đủ số.</li></ul></section>`;
  m.querySelectorAll("[data-dtym]").forEach(b=>b.onclick=()=>{DTD.ym=b.dataset.dtym;DTD.open="";renderMain()});
  m.querySelectorAll("[data-dtopen]").forEach(tr=>tr.onclick=e=>{if(e.target.closest("[data-stop],button,input"))return;DTD.open=DTD.open===tr.dataset.dtopen?"":tr.dataset.dtopen;renderMain()});
  const cl=m.querySelector("#dt-close");if(cl)cl.onclick=()=>{DTD.open="";renderMain()};
  m.querySelectorAll("[data-dtkt]").forEach(i=>i.onblur=()=>{const v=String(i.value).replace(/[^\d-]/g,"");i.value=v?nf(+v):""});
  m.querySelector("#dt-kt-save").onclick=async()=>{const jobs=[];DT_KENH.forEach(([ch])=>{const i=m.querySelector(`[data-dtkt="${ch}"]`),nt=m.querySelector(`[data-dtktn="${ch}"]`);if(!i)return;
      const raw=String(i.value).replace(/[^\d-]/g,""),v=raw===""?null:+raw,K=dtKt(ym,ch),note=nt?nt.value.trim():"";if((K?K.v:null)===v&&(K?K.note:"")===note)return;
      jobs.push(svApi("/api/hub/dieuhanh/doanhthu/ketoan",{method:"PUT",body:JSON.stringify({ym,channel:ch,amount:v,note})}))});
    if(!jobs.length){toast("Không có số nào thay đổi");return}
    try{await Promise.all(jobs);toast("Đã lưu số kế toán");dtLoadRows(true)}catch(e){toast(e.message)}};
  m.querySelectorAll("[data-dtre]").forEach(b=>b.onclick=async()=>{const ch=b.dataset.dtre,l=L[ch];if(!l||l.dt==null){toast("Chưa có số để chốt lại");return}
    const why=prompt(`Chốt lại ${DT_KENH.find(x=>x[0]===ch)[1]} tháng ${dtYmVN(ym)} bằng số tính hôm nay ${nf(l.dt)}? Ghi lý do:`);if(!why||why.trim().length<3)return;
    try{await svApi("/api/hub/dieuhanh/doanhthu/chot",{method:"POST",body:JSON.stringify({ym,force:true,reason:why.trim(),rows:[{channel:ch,amount:Math.round(l.dt),orders:l.don==null?null:Math.round(+l.don||0),data:{dt:l.dt,don:l.don,gv:l.gv,phi:l.phi,ads:l.ads,khac:l.khac,lai:l.lai,src:l.src}}]})});toast("Đã chốt lại");dtLoadRows(true)}catch(e){toast(e.message)}});
}
PAGES.dt_dc=pDtDoiChieu;
/* Đưa trang vào kho trang để menubang.js xếp vào Điều hành CEO › Kênh bán hàng. */
MODULES.push({k:"q_dt",adm:true,zone:"Quản trị",ic:"chart",n:"Đối chiếu doanh thu",sub:"",groups:()=>[["",[MI("dt_dc","Đối chiếu doanh thu",()=>dtOk())]]]});
