/* =====================================================================
   Kênh B2B (đại lý, NPP) và Gia công: doanh thu thật từ đơn đã duyệt trong CRM, ghép giá vốn SKU (qua bảng đồng bộ mã
   CRM → MISA) và chi phí phân bổ ra lãi lỗ. Gia công = khách chỉ dùng bảng giá riêng (không có cấp giá).
   Trang quản trị xem đủ giá vốn, chi phí, lãi; bên vận hành chỉ thấy doanh thu và đơn (opsview.js bỏ cột chi phí).
   Số liệu quản trị nội bộ; sổ sách chính thức vẫn ở MISA.
   ===================================================================== */
const B2BR={key:"",data:null,busy:false,err:"",map:null};
const B2B_CH={B2B:"Kênh phân phối",GIA_CONG:"Kênh OEM"};
const IS_ADMIN_HOST=()=>typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
async function b2bLoad(){
  const key=PERIOD.from+"|"+PERIOD.to;
  if(B2BR.busy||(B2BR.key===key&&(B2BR.data||B2BR.err)))return;
  B2BR.busy=true;B2BR.key=key;B2BR.err="";
  try{
    if(!B2BR.map){const mp=await kApi("/map").catch(()=>({map:[]}));B2BR.map=new Map((mp.map||[]).map(r=>[String(r.crm_sku).toLowerCase(),r]))}
    B2BR.data=await svApi("/api/dashboards/b2b-sku?from="+PERIOD.from+"&to="+PERIOD.to);
  }catch(e){B2BR.err=e.message||"Không tải được doanh thu Kênh phân phối";B2BR.data=null}
  B2BR.busy=false;
  if(["bc_b2b","bc_gc","bc_tong","exec"].includes(PAGE))renderMain();
}
/* Giá vốn 1 đơn vị CRM của một mã: lấy giá vốn SKU tháng gần nhất không sau tháng bán (nếu chưa có thì tháng đầu tiên có số). */
function b2bUnitCost(sku,month){
  const d=D(),S=d.skus||[],low=String(sku).toLowerCase(),mp=B2BR.map&&B2BR.map.get(low);
  const code=mp?String(mp.misa_code).toLowerCase():low,f=mp?(+mp.factor||1):1;
  const s=S.find(x=>String(x.ma).toLowerCase()===code);if(!s||!s.giaVon)return null;
  const ms=Object.keys(s.giaVon).sort();if(!ms.length)return null;
  const pick=ms.filter(m=>m<=month).pop()||ms[0],v=+s.giaVon[pick];
  return v>0?v*f:null;
}
/* Chi phí chung chia cho một kênh theo tỷ trọng doanh thu. Khoản gắn riêng quảng cáo, KOC, phí sàn của B2C thì không chia cho B2B / gia công. */
function b2bCosts(months,share){
  const d=D(),cats=new Map((d.costCats||[]).map(c=>[c.k,c])),rows=new Map();let total=0;
  (d.costs||[]).filter(c=>months.includes(c.thang)).forEach(c=>{
    const cat=cats.get(c.cat)||{n:c.cat,nhom:"Khác",phanBo:"Toàn công ty",pb:""};
    if(cat.phanBo==="Kênh"&&["ADS","KOC","B2C"].includes(cat.pb))return;
    const v=(+c.tien||0)*share;if(!v)return;
    const r=rows.get(c.cat)||{k:c.cat,n:cat.n,nhom:cat.nhom,cach:cat.phanBo==="Kênh"||cat.phanBo==="Sản phẩm"?"Theo tỷ trọng doanh thu":cat.phanBo+" · theo tỷ trọng doanh thu",v:0};
    r.v+=v;rows.set(c.cat,r);total+=v});
  return {rows:[...rows.values()].sort((a,b)=>b.v-a.v),total};
}
/* Doanh thu B2C (3 kênh sàn / Facebook) của kỳ đang chọn, dùng để chia chi phí chung. */
function b2cNet(){try{return execNums(PERIOD.from,PERIOD.to).tong||0}catch(e){return 0}}
/* Kết quả một kênh (B2B hoặc GIA_CONG) của kỳ đang chọn. Chưa tải xong thì trả null. */
function b2bChannel(ch){
  const R=B2BR.data;if(!R||B2BR.key!==PERIOD.from+"|"+PERIOD.to)return null;
  const lines=R.lines.filter(l=>l.channel===ch),ms=R.months.filter(x=>x.channel===ch);
  const netAll=sum(R.months,x=>+x.revenue||0)+b2cNet();
  const months=[...new Set(ms.map(x=>x.month))],net=sum(ms,x=>+x.revenue||0),orders=sum(ms,x=>+x.orders||0),adj=sum(ms,x=>+x.order_adjust||0),bonus=sum(ms,x=>+x.bonus||0);
  const revLines=sum(lines,l=>+l.revenue||0);
  let cost=0,covRev=0;const miss=new Map(),grp=new Map(),byMonth=new Map();
  lines.forEach(l=>{
    const u=b2bUnitCost(l.sku,l.month),c=u==null?null:u*(+l.qty||0),rv=+l.revenue||0;
    if(c==null){const x=miss.get(l.sku)||{sku:l.sku,name:l.name,rev:0,qty:0};x.rev+=rv;x.qty+=+l.qty||0;miss.set(l.sku,x)}else{cost+=c;covRev+=rv}
    const g=grp.get(l.group_name)||{n:l.group_name,qty:0,rev:0,cost:0,cov:0};g.qty+=+l.qty||0;g.rev+=rv;if(c!=null){g.cost+=c;g.cov+=rv}grp.set(l.group_name,g);
    const mo=byMonth.get(l.month)||{m:l.month,rev:0,cost:0,cov:0};mo.rev+=rv;if(c!=null){mo.cost+=c;mo.cov+=rv}byMonth.set(l.month,mo)});
  /* Không ước giá vốn (chị Hoa chốt 28/10): lãi gộp chỉ tính trên hàng đã có giá vốn, hàng chưa có giá vốn để riêng (uncovRev). */
  const uncovRev=revLines-covRev,estCost=0,costAll=cost;
  const share=netAll?net/netAll:1,CP=b2bCosts(months,share),gross=covRev-cost;
  return {ch,net,orders,adj,bonus,revLines,cost,covRev,uncovRev,estCost,costAll,cover:revLines?covRev/revLines:0,gross,cp:CP.total,cpRows:CP.rows,share,lai:gross-bonus-CP.total,miss,grp,byMonth,months,has:lines.length>0};
}
function b2bChannelPage(m,ch){
  b2bLoad();
  const nm=B2B_CH[ch],head=H(nm,ch==="GIA_CONG"?"Khách gia công: chỉ dùng bảng giá riêng (không có cấp giá) · doanh thu thật từ CRM":"Đại lý, NPP: doanh thu thật từ đơn đã duyệt trong CRM · giá vốn từ bảng giá vốn SKU · chi phí phân bổ");
  if(B2BR.err){m.innerHTML=head+`<div class="note red">${esc(B2BR.err)}</div>`;return}
  const S=b2bChannel(ch);
  if(!S){m.innerHTML=head+`<section class="card"><p class="hint pad">Đang tải doanh thu…</p></section>`;return}
  if(!S.has){m.innerHTML=head+`<section class="card"><p class="pad">${ch==="GIA_CONG"?"Kỳ này chưa có đơn gia công. Khách được tính là gia công khi chỉ dùng <b>bảng giá riêng</b> (Sản phẩm & giá › Bảng giá riêng từng khách) và không có cấp giá.":"Kỳ này chưa có đơn Kênh phân phối đã duyệt."}</p></section>`;return}
  const {net,orders,adj,revLines,covRev,uncovRev,estCost,costAll,cover,gross,cp,cpRows,share,lai,miss,grp,byMonth}=S;
  const miss10=[...miss.values()].sort((a,b)=>b.rev-a.rev).slice(0,10),b2c=b2cNet();
  const P=[["Doanh thu hàng (đơn đã duyệt)",revLines,""],["− Chiết khấu, trừ thưởng cấp đơn",-adj,""],["= Doanh thu thuần",net,"tot"],
    ["− Giá vốn hàng bán",-costAll,cover<1&&uncovRev>0?"đã ước tính "+tr(estCost)+" cho "+pc(uncovRev,revLines)+" doanh thu chưa có giá vốn":"đủ giá vốn"],
    ["= Lãi gộp",gross,"tot"]].concat(cpRows.map(r=>["− "+r.n,-r.v,r.cach])).concat(cpRows.length?[]:[["− Chi phí phân bổ",0,"chưa có khoản chi nào trong kỳ (nhập ở Tài chính › Chi phí)"]]).concat([["= Lãi ròng "+nm,lai,"tot"]]);
  const mrow=[...byMonth.values()].sort((a,b)=>a.m.localeCompare(b.m));
  m.innerHTML=head+`<div class="grid kpis">${kpi("Doanh thu thuần",tr(net),orders+" đơn đã duyệt · "+esc(pLabel()))}${kpi("Giá vốn",tr(costAll),"phủ giá vốn "+pc(covRev,revLines)+" doanh thu")}${kpi("Lãi gộp",tr(gross),net?pc(gross,net)+" doanh thu":"—",gross<0?"var(--red)":"var(--green)")}${kpi("Chi phí phân bổ",tr(cp),cpRows.length?"chia theo tỷ trọng doanh thu "+pc(net,net+(net/(share||1)-net)):"chưa nhập chi phí")}${kpi("Lãi ròng",tr(lai),net?pc(lai,net)+" doanh thu":"—",lai<0?"var(--red)":"var(--green)")}</div>
  <section class="card"><div class="card-h"><h2>Lãi lỗ ${esc(nm)}</h2><span class="pill p-blu">${esc(pLabel())}</span></div>${tbl(["Chỉ tiêu","Số tiền","% doanh thu thuần","Ghi chú"],P.map(r=>{const tot=r[2]==="tot";return `<tr class="${tot?"tot":""}"><td>${esc(r[0])}</td><td class="n">${nf(Math.round(r[1]))}</td><td class="n">${net?(r[1]/net*100).toFixed(1)+"%":"—"}</td><td class="hint">${tot?"":esc(r[2])}</td></tr>`}))}
   ${cover<.8?`<div class="note amb">Mới có giá vốn cho ${pc(covRev,revLines)} doanh thu. Phần còn lại em ước tính theo tỷ lệ giá vốn của phần đã có. Bổ sung giá vốn các mã ở bảng "Mã chưa có giá vốn" bên dưới để số chính xác.</div>`:""}</section>
  <section class="card flush"><div class="card-h pad"><h2>Theo nhóm sản phẩm</h2></div>${tbl(["Nhóm sản phẩm","Số lượng","Doanh thu","Giá vốn","Lãi gộp","Biên gộp","Phủ giá vốn"],[...grp.values()].sort((a,b)=>b.rev-a.rev).map(g=>{const ec=g.cov?g.cost+(g.rev-g.cov)*(g.cost/g.cov):0,lg=g.rev-ec;return `<tr><td><b>${esc(g.n)}</b></td><td class="n">${nf(g.qty)}</td><td class="n">${tr(g.rev)}</td><td class="n">${g.cov?tr(ec):"—"}</td><td class="n">${g.cov?(lg<0?`<span class="t-red">${tr(lg)}</span>`:tr(lg)):"—"}</td><td class="n">${g.cov&&g.rev?pill(Math.round(lg/g.rev*100)+"%",lg/g.rev>=.3?"grn":lg/g.rev>=.15?"amb":"red"):"—"}</td><td class="n">${pc(g.cov,g.rev)}</td></tr>`}))}</section>
  ${mrow.length>1?`<section class="card flush"><div class="card-h pad"><h2>Theo tháng</h2></div>${tbl(["Tháng","Doanh thu","Giá vốn","Lãi gộp","Biên gộp"],mrow.map(r=>{const ec=r.cov?r.cost+(r.rev-r.cov)*(r.cost/r.cov):0,lg=r.rev-ec;return `<tr><td>${esc(r.m)}</td><td class="n">${tr(r.rev)}</td><td class="n">${r.cov?tr(ec):"—"}</td><td class="n">${r.cov?tr(lg):"—"}</td><td class="n">${r.cov&&r.rev?pc(lg,r.rev):"—"}</td></tr>`}))}</section>`:""}
  ${miss10.length?`<section class="card flush"><div class="card-h pad"><h2>Mã chưa có giá vốn</h2><span class="hint">${miss.size} mã · ${pc(uncovRev,revLines)} doanh thu · hiện 10 mã lớn nhất</span></div>${tbl(["Mã CRM","Tên","Số lượng","Doanh thu"],miss10.map(x=>`<tr><td class="mono">${esc(x.sku)}</td><td>${esc(x.name)}</td><td class="n">${nf(x.qty)}</td><td class="n">${tr(x.rev)}</td></tr>`))}<p class="hint pad">Mã CRM nối với mã MISA ở Sản phẩm › Đồng bộ mã Kênh phân phối, giá vốn nhập ở Giá vốn SKU.</p></section>`:""}
  ${srcNote("CRM Kênh phân phối (đơn đã duyệt) + bảng giá vốn SKU + chi phí theo tháng. Giá vốn lấy tháng gần nhất không sau tháng bán.")}`;
}
PAGES.bc_b2b=m=>{if(typeof kpPage!=="function")return b2bChannelPage(m,"B2B");try{kpPage(m)}catch(e){console.error(e);b2bChannelPage(m,"B2B")}};
PAGES.bc_gc=m=>b2bChannelPage(m,"GIA_CONG");

/* ---------- Báo cáo kết quả kinh doanh theo kênh (trang quản trị) ---------- */
function pKetQuaKenh(m){
  b2bLoad();
  const N=execNums(PERIOD.from,PERIOD.to),C=N.C,L=N.L,head=H("Báo cáo kết quả kinh doanh","Doanh thu, giá vốn, chi phí và lãi từng kênh bán · "+pLabel());
  const B=b2bChannel("B2B"),G=b2bChannel("GIA_CONG"),dv=(x,nul)=>x==null||(nul&&!x)?"—":nf(Math.round(x));
  /* mỗi kênh: [tên, ghi chú, doanh thu, giá vốn, phí sàn & vận chuyển, quảng cáo, chi phí khác, lãi, trạng thái, trang] */
  const R=[
   ["TikTok Shop","GMV cả shop, đã trừ hủy hoàn",N.tt,C.gvTT,C.phiTT,C.adsTT,C.khacTT,L.tts,N.tt?"Có số":"Chưa có số trong kỳ","bc_tiktok"],
   ["Shopee","Doanh thu thuần",N.spDT,C.gvSPE,C.phiSPE,C.adsSPE,0,L.spe,N.spDT?"Có số":"Chưa có số trong kỳ","bc_shopee"],
   ["Facebook","Đơn giao thành công (Pancake)",N.fbDT,C.gvFB,0,C.adsFB,0,L.fb,N.fbDT?"Có số":"Chưa có số trong kỳ","bc_fb"],
   ["CSKH cũ","Mảng chăm sóc khách cũ",null,null,null,null,null,null,"Chờ triển khai","cskh_cu"],
   ["Kênh phân phối","Đơn đã duyệt trong CRM",B?B.net:null,B?B.costAll:null,0,0,B?B.cp:null,B?B.lai:null,B?(B.has?"Có số":"Chưa có đơn trong kỳ"):"Đang tải…","bc_b2b"],
   ["Kênh OEM","Khách dùng bảng giá riêng",G?G.net:null,G?G.costAll:null,0,0,G?G.cp:null,G?G.lai:null,G?(G.has?"Có số":"Chưa có đơn trong kỳ"):"Đang tải…","bc_gc"]];
  const has=r=>r[2]!=null&&r[2]>0,TOT=[0,0,0,0,0,0];
  R.forEach(r=>{if(!has(r))return;TOT[0]+=r[2]||0;TOT[1]+=r[3]||0;TOT[2]+=r[4]||0;TOT[3]+=r[5]||0;TOT[4]+=r[6]||0;if(r[7]!=null)TOT[5]+=r[7]});
  const lines=R.filter(has),laiAll=TOT[5],knownLai=R.some(r=>has(r)&&r[7]!=null);
  m.innerHTML=head+`<div class="grid kpis">${kpi("Doanh thu tất cả kênh",TOT[0]?tr(TOT[0]):"—",lines.length+" kênh có số trong kỳ")}${kpi("Giá vốn",TOT[1]?tr(TOT[1]):"—","")}${kpi("Lãi",knownLai?tr(laiAll):"—",TOT[0]&&knownLai?pc(laiAll,TOT[0])+" doanh thu":"","var(--green)")}</div>
  <section class="card flush"><div class="card-h pad"><h2>Kết quả từng kênh</h2><span class="hint">bấm tên kênh để xem chi tiết</span></div>${tbl(["Kênh","Doanh thu","Giá vốn","Phí sàn & vận chuyển","Quảng cáo","Chi phí khác","Lãi","Biên lãi","Dữ liệu"],R.map(r=>{const v=has(r),lai=r[7],bien=v&&lai!=null?pc(lai,r[2]):"—";return `<tr class="clk${v?"":" mut"}" data-go="${r[9]}"><td><b>${esc(r[0])}</b><div class="hint">${esc(r[1])}</div></td><td class="n">${v?nf(Math.round(r[2])):"—"}</td><td class="n">${v?dv(r[3],1):"—"}</td><td class="n">${v?dv(r[4],1):"—"}</td><td class="n">${v?dv(r[5],1):"—"}</td><td class="n">${v?dv(r[6],1):"—"}</td><td class="n">${v&&lai!=null?(lai<0?`<span class="t-red">${nf(Math.round(lai))}</span>`:nf(Math.round(lai))):"—"}</td><td class="n">${bien}</td><td>${pill(r[8],r[8]==="Có số"?"grn":r[8]==="Chờ triển khai"?"gry":"amb")}</td></tr>`}).concat([`<tr class="tot"><td><b>Tổng các kênh có số</b></td><td class="n">${nf(Math.round(TOT[0]))}</td><td class="n">${dv(TOT[1],1)}</td><td class="n">${dv(TOT[2],1)}</td><td class="n">${dv(TOT[3],1)}</td><td class="n">${dv(TOT[4],1)}</td><td class="n">${knownLai?nf(Math.round(laiAll)):"—"}</td><td class="n">${knownLai&&TOT[0]?pc(laiAll,TOT[0]):"—"}</td><td></td></tr>`]))}
   <p class="hint pad">Lãi mỗi kênh đã trừ giá vốn, phí sàn, quảng cáo và chi phí phân bổ của kênh đó. Chưa trừ lương, kho, chi phí chung của công ty. Kênh chưa có số trong kỳ thì để trống chứ không tính là 0.</p></section>
  ${srcNote("TikTok, Shopee: báo cáo quản trị chốt sổ ngày 8 · Facebook: Pancake + Báo cáo Ads · Kênh phân phối, Kênh OEM: CRM (đơn đã duyệt) · giá vốn SKU.")}`;
  m.querySelectorAll("tr[data-go]").forEach(tr0=>tr0.onclick=()=>{PAGE=tr0.dataset.go;MOD="";render();scrollTo(0,0)});
}
{const _tong=PAGES.bc_tong;PAGES.bc_tong=function(m){if(IS_ADMIN_HOST())return typeof tqSoSanhKenh==="function"?tqSoSanhKenh(m):pKetQuaKenh(m);return _tong.apply(this,arguments)}}

/* ---------- Tổng quan công ty: thêm kênh Kênh phân phối, Kênh OEM và cộng tổng mọi kênh ---------- */
{const _ex=PAGES.exec;if(_ex)PAGES.exec=function(m){
  _ex.apply(this,arguments);
  if(typeof b2bLoad==="function")b2bLoad();
  const B=b2bChannel("B2B"),G=b2bChannel("GIA_CONG");if(!B||!G)return;
  const adm=IS_ADMIN_HOST(),N=execNums(PERIOD.from,PERIOD.to),O=execOrders(PERIOD.from,PERIOD.to),oB2C=O.tts+O.spe+O.fb;
  /* Bảng kênh: vị trí cột theo tên cột (bên vận hành đã bỏ cột chi phí, lãi) */
  const tb=[...m.querySelectorAll("table")].find(t=>[...t.querySelectorAll("thead th")].some(h=>/^Kênh$/.test(opsvTxt?opsvTxt(h):h.textContent.trim())));
  if(tb){
    const ths=[...tb.querySelectorAll("thead th")].map(h=>h.textContent.trim()),ix=n=>ths.indexOf(n),iD=ix("Doanh thu"),iO=ix("Đơn"),iC=ix("Chi phí"),iL=ix("Lãi");
    const set=(tr,S)=>{const c=tr.children;if(iD>=0)c[iD].textContent=tr0(S.net);if(iO>=0)c[iO].textContent=nf(S.orders);if(iC>=0)c[iC].textContent=tr0(S.costAll+S.cp);if(iL>=0)c[iL].innerHTML=S.lai<0?`<span class="t-red">${tr0(S.lai)}</span>`:tr0(S.lai)};
    const tr0=v=>tr(v);
    const rowB=tb.querySelector('tr[data-href="/admin/ceo"]');
    if(rowB){
      rowB.classList.remove("mut");
      const b=rowB.querySelector("b");if(b)b.textContent="Kênh phân phối";const sm=rowB.querySelector("small");if(sm)sm.textContent="đơn đã duyệt · "+pLabel();
      set(rowB,B);rowB.removeAttribute("data-href");rowB.onclick=()=>{PAGE="bc_b2b";MOD="";render();scrollTo(0,0)};
      const rowG=rowB.cloneNode(true);rowG.querySelector("b").textContent="Kênh OEM";const sg=rowG.querySelector("small");if(sg)sg.textContent=G.has?"khách dùng bảng giá riêng":"chưa có đơn Kênh OEM trong kỳ";
      if(G.has){set(rowG,G);rowG.classList.remove("mut")}else{[...rowG.children].slice(1).forEach(c=>{c.textContent="—"});rowG.classList.add("mut")}
      rowG.onclick=()=>{PAGE="bc_gc";MOD="";render();scrollTo(0,0)};rowB.after(rowG);
      const totRow=tb.querySelector("tr.tot");
      if(totRow){
        const all=document.createElement("tr");all.className="tot";all.innerHTML=totRow.innerHTML;all.children[0].innerHTML="<b>Tổng tất cả kênh</b>";
        const sumNet=N.tong+B.net+G.net;if(iD>=0)all.children[iD].textContent=tr(sumNet);if(iO>=0)all.children[iO].textContent=nf(oB2C+B.orders+G.orders);
        const cB2C=(()=>{try{return sum(execCost(N).flatMap(g=>g[1]),x=>x[1])}catch(e){return 0}})();
        if(iC>=0)all.children[iC].textContent=tr(cB2C+B.costAll+B.cp+G.costAll+G.cp);
        const lr=[N.L.fb,N.L.spe,N.L.tts].filter(x=>x!=null);if(iL>=0)all.children[iL].textContent=tr(sum(lr,x=>x)+B.lai+G.lai);
        totRow.after(all);
      }
    }
  }
  /* Bốn ô đầu trang: số chung của mọi kênh bán hàng */
  const cB2C=(()=>{try{return sum(execCost(N).flatMap(g=>g[1]),x=>x[1])}catch(e){return 0}})(),lr=[N.L.fb,N.L.spe,N.L.tts].filter(x=>x!=null);
  const tot={"Doanh số":N.tong+B.net+G.net,"Đơn hàng":oB2C+B.orders+G.orders,"Chi phí":cB2C+B.costAll+B.cp+G.costAll+G.cp,"Lợi nhuận":sum(lr,x=>x)+B.lai+G.lai};
  m.querySelectorAll(".xk").forEach(k=>{const l=k.querySelector(".xkl"),v=k.querySelector(".xkv"),key=l&&l.textContent.trim();if(!(key in tot))return;
    k.classList.remove("mut");v.textContent=key==="Đơn hàng"?nf(tot[key]):tr(tot[key]);
    k.querySelectorAll(".xkm").forEach(x=>x.remove());
    const note=document.createElement("span");note.className="xkm";note.textContent="tất cả kênh: Kênh bán lẻ, Kênh phân phối, Kênh OEM";k.appendChild(note)});
}}
