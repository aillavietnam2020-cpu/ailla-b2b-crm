/* =====================================================================
   KÊNH SHOPEE trên web (2 shop: Mall aillavn + thường aillavn1), làm 27/10/2026 theo cách của TikTok.
   - Quản trị › Kênh bán hàng › Shopee: kế toán (hoặc agent) kéo file đơn + Tài chính + quảng cáo của từng shop,
     xem trước, bấm lưu. Tải giữa tháng mỗi tuần được (số "đến ngày X"); chốt sổ: Tài chính tới 08 tháng sau.
   - Số theo ngày của các shop gộp vào DAYD.spe (đúng chỗ Tổng quan, Lãi lỗ, Sổ chi phí, Đối chiếu doanh thu đang đọc).
     Tháng đã có báo cáo tải lên thì thay số cũ của tháng đó trong DAYD.spe.
   - Kỳ chưa đủ báo cáo của mọi shop thì đánh dấu "thiếu" để không tự chốt doanh thu (giống TikTok).
   Tính toán ở specalc.js; file đơn chỉ đọc trong trình duyệt.
   ===================================================================== */
const SPE={sums:null,busy:"",err:"",up:{orders:[],fin:[],ads:[]},prev:null,cost:null,loading:false};
const SPE_SHOPS={aillavn:"Shopee Mall (aillavn)",aillavn1:"Shopee thường (aillavn1)"};
const speApi=(p,o)=>svApi("/api/hub/shopee"+p,o);
const speShopL=s=>SPE_SHOPS[s]||s;
const speAcct=()=>typeof SV!=="undefined"&&SV.acct;
const speRe=()=>{if(typeof svTyping==="function"&&svTyping())return;if(PAGE==="bc_shopee"||(typeof DT_PAGES!=="undefined"&&DT_PAGES.includes(PAGE))||["sochi","socp","bc_tong","exec","pl"].includes(PAGE))renderMain()};
const speShopsAll=()=>[...new Set(Object.keys(SPE_SHOPS).concat((SPE.sums||[]).map(x=>x.shop)))];

/* ---------- Nạp số đã lưu và gộp vào DAYD.spe ---------- */
async function speLoad(force){
  if(!speAcct()||SPE.loading||(SPE.sums&&!force))return;SPE.loading=true;
  try{SPE.sums=(await speApi("/months")).map(r=>({...r.summary,ky:r.ky,shop:r.shop,at:r.updated_at,by:r.updated_by}));speMerge()}catch(e){SPE.sums=SPE.sums||[];SPE.err=e.message}
  SPE.loading=false;speRe();
}
function speMerge(){
  if(typeof DAYD==="undefined"||!DAYD||!SPE.sums||!SPE.sums.length)return;DAYD.spe=DAYD.spe||{};
  const kys=new Set(SPE.sums.map(s=>s.ky));Object.keys(DAYD.spe).forEach(d=>{if(kys.has(d.slice(0,7)))delete DAYD.spe[d]});
  Object.assign(DAYD.spe,speDayd(SPE.sums));
}
{const _l=DB.load;DB.load=async function(){const r=await _l.apply(this,arguments);try{speLoad(true)}catch(e){}return r}}

/* Kỳ có tháng đã tải báo cáo Shopee mà chưa đủ mọi shop / mọi ngày: ghi rõ chờ tải ngày nào và đánh dấu thiếu (không tự chốt). */
{const _r=tqRevB2C;tqRevB2C=function(N,from,to){const out=_r.apply(this,arguments);
  try{const S=SPE.sums,sp=out&&out.spe;if(S&&S.length&&sp&&sp.dt!=null){const min=S.reduce((m,s)=>s.ky<m?s.ky:m,"9999")+"-01",a=from<min?min:from,today=iso(new Date());
    if(a<=to&&a<=today){const C=speCoverage(S,speShopsAll(),a,to,today),vn=s=>s.split("-").reverse().join("/");
      if(C.miss.length){sp.thieu=true;sp.src+=" · chờ tải báo cáo "+C.miss.map(x=>`${speShopL(x.shop)} ngày ${x.from===x.to?vn(x.from):vn(x.from)+"–"+vn(x.to)}`).join("; ")}
      else sp.src+=" · báo cáo Shopee tải lên đủ các shop"}}}catch(e){}
  return out}}

/* ---------- Giá vốn: Quy đổi mã các sàn kênh Shopee trên web, thiếu thì định mức của skill ---------- */
async function speCostOf(ky){
  if(!SPE.cost){const [map,cat,costs]=await Promise.all([kApi("/online/map?channel=SHOPEE").catch(()=>[]),kApi("/catalog").catch(()=>null),kApi("/costs").catch(()=>[])]);
    const items=new Map(((cat&&cat.items)||[]).map(i=>[String(i.code).toLowerCase(),i]));
    const bom=Object.entries(SPE_BOM).flatMap(([k,cs])=>cs.map(([code,q])=>({sku:k,variant:"",from_day:"",item_label:code,qty:q})));
    SPE.cost={web:Array.isArray(map)?map:[],bom,items,kho:Object.fromEntries((costs||[]).map(c=>[c.item,c.avg]))}}
  const C=SPE.cost,isPack=code=>{const it=C.items.get(String(code).toLowerCase());return !!it&&/đóng gói|hộp|thùng|bao bì/i.test((it.grp||"")+" "+(it.name||""))&&it.cls==="NVL"};
  const web=ttMakeCostOf({ky,mapRows:C.web,skus:D().skus||[],khoCost:C.kho,isPack}),bom=ttMakeCostOf({ky,mapRows:C.bom,skus:D().skus||[],khoCost:C.kho,isPack});
  return s=>{const tries=[()=>s.sv?web(s.sv,s.sp,s.vr):null,()=>s.sp?web(s.sp,null,s.vr):null,()=>web(s.pn,null,s.vr),()=>bom(speKey(s.pn,s.vr),null,"")];
    let best=null;for(const t of tries){const c=t();if(!c)continue;if(c.u!=null)return c;if(!best||/^Thiếu/.test(c.why))best=c}
    return best||{u:null,why:"Chưa quy đổi mã"}};
}

/* ---------- Đọc file ở trình duyệt, ghép file theo shop ---------- */
async function speFiles(fs){
  SPE.busy="Đang đọc "+fs.length+" file…";SPE.err="";renderMain();
  for(const f of fs){try{
    const sh=await tsbRead(f),kind=speKind(sh);
    if(kind==="orders")SPE.up.orders=SPE.up.orders.filter(x=>x.name!==f.name).concat([{name:f.name,aoa:speOrderSheet(sh)}]);
    else if(kind==="fin")SPE.up.fin=SPE.up.fin.filter(x=>x.name!==f.name).concat([{name:f.name,sh,meta:speFinMeta(sh)}]);
    else if(kind==="ads"){const A=speReadAds(sh.csv);if(A.err)throw new Error(A.err);SPE.up.ads=SPE.up.ads.filter(x=>x.name!==f.name).concat([{name:f.name,A}])}
    else SPE.err=`File "${f.name}" không phải file Shopee cần (đơn hàng, Tài chính › Doanh thu, hoặc lịch sử giao dịch quảng cáo).`;
  }catch(e){SPE.err=e.message}}
  SPE.busy="";await speCompute();
}
/* File đơn không ghi tên shop: ghép với file Tài chính có nhiều mã đơn trùng nhất. */
function spePair(){
  const U=SPE.up,ids=o=>{const H=ttHead(o.aoa,["Mã đơn hàng"],5);const s=new Set();if(H)for(let r=H.at+1;r<o.aoa.length;r++){const v=ttCell((o.aoa[r]||[])[H.ix["Mã đơn hàng"]]);if(v)s.add(v)}return s};
  return U.fin.map(F=>{const raw=speReadFin(F.sh,null),keys=Object.keys(raw.ord||{});let best=null,bn=0;
    U.orders.forEach(o=>{o.ids=o.ids||ids(o);const n=keys.filter(k=>o.ids.has(k)).length;if(n>bn){bn=n;best=o}});
    return {shop:F.meta.shop,F,O:best,A:(U.ads.find(a=>a.A.shop===F.meta.shop)||{}).A||null,adsName:(U.ads.find(a=>a.A.shop===F.meta.shop)||{}).name||""}});
}
async function speCompute(){
  SPE.prev=null;const U=SPE.up;if(!U.fin.length){renderMain();return}
  SPE.busy="Đang tính số Shopee…";renderMain();await new Promise(r=>setTimeout(r,30));
  const res=[];
  for(const p of spePair()){const x={shop:p.shop,files:{fin:p.F.name,orders:p.O?p.O.name:"",ads:p.adsName}};
    try{if(!p.shop)throw new Error(`File ${p.F.name}: không đọc được tên shop (dòng Người Bán).`);
      if(!p.O)throw new Error(`Shop ${speShopL(p.shop)}: chưa có file đơn hàng của shop này.`);
      const ky=speGuessKy(p.O.aoa),O=speReadOrders(p.O.aoa,ky);if(O.err)throw new Error(O.err);
      const F=speReadFin(p.F.sh,ky);if(F.err)throw new Error(`Shop ${speShopL(p.shop)}: ${F.err}`);
      const M=speBuildMonth({ky,shop:p.shop,orders:O,fin:F,ads:p.A,costOf:await speCostOf(ky)});if(M.err)throw new Error(M.err);
      x.ky=ky;x.M=M}catch(e){x.err=e.message}
    res.push(x)}
  SPE.prev=res;SPE.busy="";renderMain();
}
async function speSave(){
  const ok=(SPE.prev||[]).filter(x=>x.M);if(!ok.length)return;
  if(!confirm(`Lưu báo cáo Shopee: ${ok.map(x=>`${speShopL(x.shop)} T${x.ky.slice(5)}/${x.ky.slice(0,4)}${x.M.den?" (đến "+x.M.den.split("-").reverse().join("/")+")":""}`).join(", ")}?\n\nTháng đã có bản lưu thì bản mới thay bản cũ.`))return;
  SPE.busy="Đang lưu…";renderMain();const done=[];
  for(const x of ok){try{await speApi(`/month/${x.ky}/${encodeURIComponent(x.shop)}`,{method:"PUT",body:JSON.stringify({data:{rows:speRowsPack(x.M),fees:x.M.fees,n:x.M.n,files:x.files,at:new Date().toISOString(),by:ME.name},summary:speSummary(x.M),files:x.files})});done.push(x)}catch(e){toast(`${speShopL(x.shop)}: ${e.message}`)}}
  if(done.length)toast("Đã lưu "+done.map(x=>speShopL(x.shop)).join(", "));
  SPE.prev=null;SPE.up={orders:[],fin:[],ads:[]};SPE.busy="";await speLoad(true);renderMain();
}

/* ---------- Giao diện ---------- */
const speN=v=>v==null?"—":nf(Math.round(v));
const speVn=s=>s?s.split("-").reverse().join("/"):"";
const spePct=(a,b)=>b?(a/b*100).toFixed(1).replace(".",",")+"%":"—";
function speUpCard(){
  const U=SPE.up,chip=(t,a)=>`<b>${t}</b>${a.length?a.map(x=>pill(x.name,"grn")).join(""):pill("Chưa có","gry")}`;
  const P=SPE.prev||[];
  return `<section class="card"><div class="card-h"><h2>Tải báo cáo Shopee (kế toán)</h2><span class="hint">đọc ngay trên máy, chỉ gửi lên web số tiền, tên sản phẩm, ngày</span></div>
   <ol class="lessons"><li><b>Đơn hàng</b>: Kênh Người bán › Đơn hàng › Xuất, lọc theo ngày đặt hàng từ ngày 01 của tháng.</li><li><b>Tài chính</b>: Tài chính › Doanh thu › Xuất, <b>từ ngày 01 của tháng</b> đến hôm nay (chốt sổ: tới ngày 08 tháng sau).</li><li><b>Quảng cáo</b>: Kênh Marketing › Quảng cáo Shopee › Lịch sử giao dịch › Tải CSV (không bắt buộc, nên có).</li></ol>
   <p class="hint">Mỗi shop 3 file; kéo file của cả hai shop vào một lần được, web tự ghép theo tên shop. Tải mỗi tuần: số "đến ngày X", bản mới thay bản cũ; đơn chưa quyết toán dùng phí ước tính.</p>
   ${tsbFileInput("speup",true).replace("Kéo file TikTok","Kéo file Shopee")}
   <div class="chips" style="margin-top:10px">${chip("Đơn hàng",U.orders)}${chip("Tài chính",U.fin)}${chip("Quảng cáo",U.ads)}</div>
   ${SPE.busy?`<p class="note">${esc(SPE.busy)}</p>`:""}${SPE.err?`<div class="note red">${esc(SPE.err)}</div>`:""}
   ${P.length?`<h3>Xem trước</h3>${tbl(["Shop","Tháng","Có số đến","Doanh thu","Phí sàn","Giá vốn","Lãi gộp sau phí sàn","Quảng cáo","Đơn","Ghi chú"],P.map(x=>x.M?`<tr><td><b>${esc(speShopL(x.shop))}</b></td><td>T${x.ky.slice(5)}/${x.ky.slice(0,4)}</td><td>${x.M.den?speVn(x.M.den):"đủ tháng"}</td><td class="n">${speN(x.M.dt)}</td><td class="n">${speN(x.M.phi)}</td><td class="n">${speN(x.M.gv)}</td><td class="n">${speN(x.M.lg)}</td><td class="n">${x.M.hasAds?speN(x.M.ads):"chưa có file"}</td><td class="n">${nf(x.M.don)}</td><td class="hint">${[x.M.dtUoc?`${spePct(x.M.dtUoc,x.M.dt)} doanh thu chưa quyết toán (phí ước tính)`:"",x.M.dtUocGv?`${spePct(x.M.dtUocGv,x.M.dt)} doanh thu giá vốn ước tính (chưa quy đổi mã)`:"",x.M.lech?`${x.M.lech} dòng đã hoàn theo Tài chính`:"",x.M.n.outside?`${x.M.n.outside} dòng ngoài tháng đã bỏ`:""].filter(Boolean).map(esc).join("<br>")}</td></tr>`:`<tr><td><b>${esc(speShopL(x.shop||"?"))}</b></td><td colspan="9"><span class="t-red">${esc(x.err)}</span></td></tr>`))}
   <div class="acts"><button class="btn pri" id="spe-save" ${P.some(x=>x.M)?"":"disabled"}>Lưu báo cáo</button><button class="btn" id="spe-clr">Bỏ, tải lại</button></div>`:""}</section>`;
}
function speSumCard(){
  const S=(SPE.sums||[]).slice().sort((a,b)=>a.ky<b.ky?1:a.ky>b.ky?-1:a.shop<b.shop?-1:1);
  if(!S.length)return `<section class="card"><div class="card-h"><h2>Báo cáo Shopee đã tải lên</h2></div><p class="empty">${SPE.sums?"Chưa có tháng nào. Kế toán tải 3 file của từng shop ở trang quản trị.":"Đang tải…"}</p></section>`;
  return `<section class="card"><div class="card-h"><h2>Báo cáo Shopee đã tải lên</h2><span class="hint">số này vào Tổng quan, Lãi lỗ, Sổ chi phí, Đối chiếu doanh thu</span></div>
   ${tbl(["Tháng","Shop","Có số đến","Doanh thu","Phí sàn","Giá vốn","Lãi gộp sau phí sàn","Quảng cáo Shopee","Lãi sau quảng cáo","Đơn","Doanh thu KOC","Cập nhật"],S.map(s=>`<tr><td><b>T${s.ky.slice(5)}/${s.ky.slice(0,4)}</b></td><td>${esc(speShopL(s.shop))}</td><td>${s.den?pill("đến "+speVn(s.den),"blu"):pill("đủ tháng","grn")}</td><td class="n">${speN(s.dt)}</td><td class="n">${speN(s.phi)}</td><td class="n">${speN(s.gv)}${s.dtUocGv?` ${pill("có ước tính","amb")}`:""}</td><td class="n">${speN(s.lg)}</td><td class="n">${s.hasAds?speN(s.ads):"—"}</td><td class="n">${s.hasAds?speN(s.lg-s.ads):"—"}</td><td class="n">${nf(s.don||0)}</td><td class="n">${speN(s.koc)}</td><td class="hint">${esc(speVn((s.at||"").slice(0,10)))}</td></tr>`))}
   <p class="hint">Quảng cáo Shopee lấy từ file Lịch sử giao dịch Dịch vụ Hiển thị (đã bỏ tiền nạp ví). Giá vốn theo Quy đổi mã các sàn kênh Shopee, mã chưa khai thì theo định mức báo cáo quản trị Shopee.</p></section>`;
}
{const _p=PAGES.bc_shopee;PAGES.bc_shopee=function(m){
  if(typeof SP!=="undefined"&&SP)_p(m);else _pb(x=>{x.innerHTML=H("Kênh Shopee (2 shop)","Mall aillavn · shop thường aillavn1")},"spe")(m);
  if(!speAcct())return;if(!SPE.sums)speLoad();
  const ph=m.querySelector(".ph"),adm=typeof tsbAdm==="function"&&tsbAdm();
  const html=(adm?speUpCard():"")+speSumCard();if(ph)ph.insertAdjacentHTML("afterend",html);else m.insertAdjacentHTML("afterbegin",html);
  m.querySelectorAll(".waitf").forEach(x=>x.remove());
  if(adm){tsbBindFiles("speup",speFiles);const sv=$("#spe-save");if(sv)sv.onclick=speSave;const cl=$("#spe-clr");if(cl)cl.onclick=()=>{SPE.prev=null;SPE.up={orders:[],fin:[],ads:[]};SPE.err="";renderMain()}}
}}
