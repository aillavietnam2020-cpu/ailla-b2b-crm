/* =====================================================================
   KÊNH TIKTOK SHOP trên web (thay file Excel + HTML), chị Hoa duyệt 24/10/2026.
   - Trang quản trị › Tài chính › Doanh thu › TikTok: lãi lỗ tháng, sản phẩm/SKU, phí sàn 7 nhóm, chi phí riêng kênh,
     cảnh báo 3 nhóm, chất lượng dữ liệu, khoá sổ, so nhiều tháng. Kế toán tải OrderSKUList + income + Campaign overview.
   - Trang vận hành › Kinh doanh B2C › TikTok: hiệu suất theo ngày (5 làn, quảng cáo, KOC, video & LIVE), không có giá vốn.
     Team TikTok tải Key metrics, LIVE, Transaction Analysis, Creator List hằng tuần.
   Tính toán nằm ở ttcalc.js. File đơn chỉ đọc trong trình duyệt, máy chủ không nhận thông tin khách.
   ===================================================================== */
const TSB={sum:null,months:null,data:{},ky:"",all:null,allBusy:false,up:{},prev:null,busy:"",err:"",cost:null};
const tsbApi=(p,o)=>svApi("/api/hub/tiktok"+p,o);
const tsbAdm=()=>typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
const tsbKyL=k=>k?`T${k.slice(5)}/${k.slice(0,4)}`:"";
const tsbVn=s=>s?s.split("-").reverse().join("/"):"";
const tsbPct=(a,b)=>b?(a/b*100).toFixed(1).replace(".",",")+"%":"—";
const tsbCanUp=()=>!!ME&&(ME.role==="admin"||ME.role==="lead"||can(ME,"baocao.tiktok")||(typeof SV!=="undefined"&&SV.acct));
const tsbRe=()=>{if(["bc_tiktok","nhaplieu","exec","bc_tong"].includes(PAGE))renderMain()};

/* ---------- Nạp dữ liệu ---------- */
async function tsbLoadAll(force){
  if(TSB.allBusy||(TSB.all&&!force))return;TSB.allBusy=true;
  try{TSB.all=await tsbApi("/days?from=2025-01-01&to="+iso(addD(new Date(),1)));tsbMergeDayd()}catch(e){TSB.all=TSB.all||{days:{},ranges:[],last:[]};TSB.allErr=e.message}
  TSB.allBusy=false;tsbRe();
}
/* Đưa số theo ngày vào DAYD.tts dùng chung (khối "TikTok Shop trong kỳ đã chọn", Tổng quan). */
function tsbMergeDayd(){
  if(typeof DAYD==="undefined"||!DAYD||!TSB.all)return;DAYD.tts=DAYD.tts||{};
  Object.entries(TSB.all.days).forEach(([d,x])=>{if(x.km)DAYD.tts[d]=ttDaydRow(x);else if(x.ads&&DAYD.tts[d])DAYD.tts[d][10]=ttDaydRow(x)[10]});
}
async function tsbLoadMonths(force){
  if(!(typeof SV!=="undefined"&&SV.acct))return;if(TSB.months&&!force)return;
  try{TSB.months=await tsbApi("/months");TSB.sum={};TSB.months.forEach(m=>TSB.sum[m.ky]=m.summary);if(!TSB.ky&&TSB.months.length)TSB.ky=TSB.months[TSB.months.length-1].ky}catch(e){TSB.months=[];TSB.err=e.message}
  tsbRe();
}
async function tsbLoadMonth(ky){
  if(!ky||TSB.data[ky]!==undefined)return;TSB.data[ky]=null;
  try{const r=await tsbApi("/month/"+ky);TSB.data[ky]=r?{...r,pl:ttUnpackPL(r.data.pl)}:false}catch(e){TSB.data[ky]=false;toast(e.message)}
  tsbRe();
}
{const _l=DB.load;DB.load=async function(){const r=await _l.apply(this,arguments);try{tsbLoadAll();if(tsbAdm())tsbLoadMonths()}catch(e){}return r}}

/* ---------- Đọc file ở trình duyệt ---------- */
function tsbRead(f){return new Promise((res,rej)=>{
  const csv=/\.csv$/i.test(f.name);if(!csv&&typeof XLSX==="undefined"){rej(new Error("Chưa tải được thư viện đọc Excel (cần mạng)"));return}
  const r=new FileReader();r.onerror=()=>rej(new Error("Không đọc được file "+f.name));
  r.onload=()=>{try{res(csv?{csv:ttCsv(String(r.result))}:ttSheets(XLSX,XLSX.read(r.result,{type:"array"})))}catch(e){rej(new Error("Không đọc được file "+f.name))}};
  if(csv)r.readAsText(f,"utf-8");else r.readAsArrayBuffer(f)})}
const tsbFileInput=(id,multi)=>`<label class="drop" id="dz-${id}"><b>Kéo file TikTok vào đây</b><span>hoặc bấm để chọn (.xlsx, .csv)${multi?" · chọn được nhiều file một lần":""}</span><input type="file" id="fi-${id}" accept=".xlsx,.xls,.csv"${multi?" multiple":""} hidden></label>`;
function tsbBindFiles(id,fn){const z=$("#dz-"+id);if(!z)return;
  ["dragover","dragenter"].forEach(ev=>z.addEventListener(ev,e=>{e.preventDefault();z.classList.add("on")}));
  ["dragleave","drop"].forEach(ev=>z.addEventListener(ev,e=>{e.preventDefault();z.classList.remove("on")}));
  z.addEventListener("drop",e=>{const fs=[...e.dataTransfer.files];if(fs.length)fn(fs)});$("#fi-"+id).onchange=e=>{const fs=[...e.target.files];e.target.value="";if(fs.length)fn(fs)}}

/* ---------- Giá vốn từ web: Quy đổi mã các sàn + Giá vốn SKU + giá nhập kho ---------- */
async function tsbCostOf(ky){
  if(!TSB.cost){const [map,cat,costs]=await Promise.all([kApi("/online/map?channel=TIKTOK"),kApi("/catalog"),kApi("/costs").catch(()=>[])]);
    const items=new Map(((cat&&cat.items)||[]).map(i=>[String(i.code).toLowerCase(),i]));
    TSB.cost={map:Array.isArray(map)?map:(map.map||map.rows||[]),items,kho:Object.fromEntries((costs||[]).map(c=>[c.item,c.avg]))}}
  const C=TSB.cost,isPack=code=>{const it=C.items.get(String(code).toLowerCase());return !!it&&/đóng gói|hộp|thùng|bao bì/i.test((it.grp||"")+" "+(it.name||""))&&it.cls==="NVL"};
  return ttMakeCostOf({ky,mapRows:C.map,skus:D().skus||[],khoCost:C.kho,isPack});
}
/* Chi phí gắn kênh TikTok nhập ở "Chi phí theo tháng" (agency, hàng mẫu KOC, livestream, quảng cáo ngoài GMV Max). */
function tsbExtra(ky){
  const d=D(),cat=k=>(d.costCats||[]).find(c=>c.k===k)||{n:k};
  return (d.costs||[]).filter(c=>c.thang===ky&&/tik\s*tok/i.test(c.kenh||"")&&c.cat!=="PHI-SAN"&&!(c.cat==="ADS-TT"&&/gmv\s*max/i.test(c.note||""))).map(c=>({n:cat(c.cat).n+(c.note?" · "+c.note:""),v:+c.tien||0}));
}

/* ---------- Kế toán tải 3 file tháng → xem trước → lưu ---------- */
async function tsbAdmFiles(fs){
  TSB.busy="Đang đọc "+fs.length+" file…";TSB.err="";renderMain();
  for(const f of fs){try{
    const sh=await tsbRead(f),kind=ttKind(sh);
    if(!["orders","income","camp"].includes(kind)){TSB.err=`File "${f.name}" không phải file kế toán cần (${kind?TT_KIND_NAME[kind]+" là file của team TikTok, tải ở trang vận hành":"không nhận ra loại file"}).`;continue}
    if(kind==="orders"){const a=sh[Object.keys(sh)[0]];TSB.up.orders={name:f.name,aoa:a,ky:ttGuessKy(a)}}
    else TSB.up[kind]={name:f.name,sh}
  }catch(e){TSB.err=e.message}}
  if(TSB.up.orders&&!TSB.up.ky)TSB.up.ky=TSB.up.orders.ky;
  TSB.busy="";await tsbAdmCompute();
}
async function tsbAdmCompute(){
  const U=TSB.up,ky=U.ky;TSB.prev=null;
  if(!(U.orders&&U.income&&U.camp&&ky)){renderMain();return}
  TSB.busy="Đang tính lãi lỗ tháng "+tsbKyL(ky)+"…";renderMain();await new Promise(r=>setTimeout(r,30));
  try{
    const o=ttReadOrders(U.orders.aoa,ky);if(o.err)throw new Error(o.err);
    const inc=ttReadIncome(U.income.sh,ky);if(inc.err)throw new Error(inc.err);
    const sh=U.camp.sh,camp=ttReadCampaign(sh[Object.keys(sh)[0]]);if(camp.err)throw new Error(camp.err);
    const M=ttBuildMonth({ky,orders:o,income:inc,camp});if(M.err)throw new Error(M.err);
    const P=ttPL(M,await tsbCostOf(ky),tsbExtra(ky));
    TSB.prev={ky,M,P,files:{orders:U.orders.name,income:U.income.name,camp:U.camp.name},campDays:camp.days};
    SUB.bc_tiktok="pl";
  }catch(e){TSB.err=e.message}
  TSB.busy="";renderMain();
}
async function tsbSavePrev(){
  const V=TSB.prev;if(!V)return;const cur=TSB.data[V.ky];
  if(cur&&cur.locked_at){toast("Tháng này đã khoá sổ");return}
  const curS=(TSB.sum||{})[V.ky];
  if(V.M.den&&curS&&!curS.den){toast("Tháng này đã có báo cáo chốt sổ đầy đủ, không thay bằng bản giữa tháng");return}
  if(!confirm(`Lưu báo cáo TikTok ${tsbKyL(V.ky)}${V.M.den?" (giữa tháng, số đến "+tsbVn(V.M.den)+")":""}?${curS?"\n\nTháng này đã có bản lưu"+(curS.den?" đến "+tsbVn(curS.den):"")+", bản mới sẽ thay bản cũ.":""}`))return;
  TSB.busy="Đang lưu…";renderMain();
  try{
    const data={ky:V.ky,M:V.M,pl:ttPackPL(V.P),todo:ttTodo(V.P),files:V.files,at:new Date().toISOString(),by:ME.name};
    await tsbApi("/month/"+V.ky,{method:"PUT",body:JSON.stringify({data,summary:ttSummary(V.P),files:V.files})});
    if(V.campDays){const ad={};Object.entries(V.campDays).forEach(([d,x])=>{if(d.slice(0,7)===V.ky)ad[d]=x});if(Object.keys(ad).length)await tsbApi("/days",{method:"PUT",body:JSON.stringify({src:"ads",days:ad,file:V.files.camp})})}
    toast("Đã lưu báo cáo "+tsbKyL(V.ky));TSB.ky=V.ky;delete TSB.data[V.ky];TSB.prev=null;TSB.up={};
    await Promise.all([tsbLoadMonths(true),tsbLoadMonth(V.ky),tsbLoadAll(true)]);
  }catch(e){toast(e.message)}
  TSB.busy="";renderMain();
}
async function tsbRecalc(){
  const S=TSB.data[TSB.ky];if(!S)return;TSB.cost=null;TSB.busy="Đang tính lại giá vốn…";renderMain();
  try{const M=S.data.M;TSB.prev={ky:M.ky,M,P:ttPL(M,await tsbCostOf(M.ky),tsbExtra(M.ky)),files:S.data.files,recalc:true}}catch(e){toast(e.message)}
  TSB.busy="";renderMain();
}
async function tsbLock(lock){
  const ky=TSB.ky;if(lock&&((TSB.sum||{})[ky]||{}).den){toast("Bản này là báo cáo giữa tháng. Tải báo cáo chốt sổ (income tới ngày 08 tháng sau) rồi mới khoá sổ.");return}if(!confirm(lock?`Khoá sổ TikTok ${tsbKyL(ky)}? Sau khi khoá không tải lại file tháng này được nữa.`:`Mở khoá sổ ${tsbKyL(ky)}?`))return;
  try{await tsbApi("/month/"+ky+"/lock",{method:"POST",body:JSON.stringify({lock})});toast(lock?"Đã khoá sổ":"Đã mở khoá");delete TSB.data[ky];await Promise.all([tsbLoadMonths(true),tsbLoadMonth(ky)])}catch(e){toast(e.message)}
}

/* ---------- Trang quản trị ---------- */
const tsbN=v=>v==null?"—":nf(Math.round(v));
const tsbRed=v=>v<0?`<span class="t-red">${tsbN(v)}</span>`:tsbN(v);
const tsbDg=s=>s?pill(s,/^Lỗ/.test(s)?"red":/mỏng/.test(s)?"amb":"grn"):"";
function tsbPLTbl(P){
  const L=[["Doanh thu bán hàng",P.dt,"Đã trừ giảm giá của shop, đã loại đơn hủy/hoàn"],["Giá vốn hàng bán",-P.gv,P.dtUocGv?`Có ${tsbN(P.dtUocGv)}đ doanh thu đang ước tính giá vốn (mã thiếu giá)`:"Theo Quy đổi mã các sàn và Giá vốn SKU"],["LÃI GỘP TRƯỚC PHÍ SÀN",P.lgTruoc,"",1],["Phí sàn TikTok",P.phi,"Chi tiết 7 nhóm ở bảng bên"],["LÃI GỘP SAU PHÍ SÀN",P.lg,"Dùng để xét từng SKU có gánh nổi quảng cáo không",1],["Quảng cáo GMV Max (đã VAT 10%)",-P.ads,`Theo kỳ chi tiêu: trước VAT ${tsbN(P.adsChi)}đ. Số trừ ví trong tháng ${tsbN(P.adsVi)}đ chỉ dùng cho dòng tiền.`],["Điều chỉnh khác từ TikTok",P.adj,"Bồi thường vận chuyển, kho vận"]]
   .concat(P.extra.length?[["Chi phí riêng của kênh (nhập trên web)",-P.extraT,P.extra.map(x=>x.n).join("; ")]]:[]).concat([["LÃI ĐÓNG GÓP KÊNH TIKTOK",P.lai,"Chưa trừ lương, kho vận, chi phí chung",1]]);
  return tbl(["Chỉ tiêu","Số tiền (đ)","% doanh thu","Ghi chú"],L.map(([l,v,h,b])=>`<tr class="${b?"tot":""}"><td>${b?`<b>${l}</b>`:l}</td><td class="n">${tsbRed(v)}</td><td class="n">${tsbPct(v,P.dt)}</td><td class="hint">${esc(h||"")}</td></tr>`));
}
function tsbFeeTbl(P){return tbl(["Nhóm phí","Số tiền (đ)","% doanh thu","Diễn giải"],P.fees.map(f=>`<tr><td>${f[0]}</td><td class="n">${tsbRed(f[1])}</td><td class="n">${tsbPct(-f[1],P.dt)}</td><td class="hint">${esc(f[2]||"")}</td></tr>`).concat([`<tr class="tot"><td><b>Tổng phí sàn</b></td><td class="n">${tsbRed(P.phi)}</td><td class="n">${tsbPct(-P.phi,P.dt)}</td><td></td></tr>`]))}
function tsbSkuTbl(rows,lim){return tbl(["SKU","Seller SKU","Sản phẩm · phân loại","SL bán","Doanh thu","Giá vốn","Phí sàn","Lãi gộp sau phí sàn","Biên","Trần ads chịu được","Đánh giá","Giá vốn lấy từ"],rows.slice(0,lim||rows.length).map(r=>`<tr><td class="mono">${esc(r.id)}</td><td>${esc(r.ss)}</td><td>${esc(r.pn.slice(0,60))}${r.vr?`<br><small class="hint">${esc(r.vr)}</small>`:""}</td><td class="n">${nf(r.q)}</td><td class="n">${tsbN(r.dt)}</td><td class="n">${tsbN(r.gv)}${r.uoc?` ${pill("ước tính","amb")}`:""}</td><td class="n">${tsbRed(r.phi)}</td><td class="n">${tsbRed(r.lg)}</td><td class="n">${tsbPct(r.lg,r.dt)}</td><td class="n">${tsbPct(r.lg,r.dt)}</td><td>${tsbDg(r.dg)}</td><td class="hint">${esc(r.c?(r.c.u==null?r.c.why:(r.c.src||"")+(r.c.pack&&r.c.pack.length?" · bao bì chưa có giá: "+r.c.pack.join(", "):"")):"")}</td></tr>`))}
function tsbSpTbl(P){return tbl(["Sản phẩm","Số SKU","SL bán","Doanh thu","Giá vốn","Phí sàn","Lãi gộp sau phí sàn","Biên","% doanh thu","% lãi gộp","Đánh giá"],P.sp.map(p=>`<tr><td>${esc(p.n)}${p.uoc?` ${pill("có giá vốn ước tính","amb")}`:""}</td><td class="n">${p.nsku}</td><td class="n">${nf(p.q)}</td><td class="n">${tsbN(p.dt)}</td><td class="n">${tsbN(p.gv)}</td><td class="n">${tsbRed(p.phi)}</td><td class="n">${tsbRed(p.lg)}</td><td class="n">${tsbPct(p.lg,p.dt)}</td><td class="n">${tsbPct(p.dt,P.dt)}</td><td class="n">${tsbPct(p.lg,P.lg)}</td><td>${tsbDg(p.dg)}</td></tr>`))}
function tsbWarn(P){
  const blk=(t,note,rows,c)=>`<section class="card"><div class="card-h"><h2>${t}</h2>${pill(rows.length+" SKU",rows.length?c:"grn")}</div><p class="hint">${note}</p>${rows.length?tbl(["Sản phẩm · phân loại","Doanh thu","Lãi gộp sau phí sàn","Biên","Giá vốn"],rows.map(r=>`<tr><td>${esc(r.pn.slice(0,70))}<br><small class="hint">${esc(r.vr||r.ss||r.id)}</small></td><td class="n">${tsbN(r.dt)}</td><td class="n">${tsbRed(r.lg)}</td><td class="n">${tsbPct(r.lg,r.dt)}</td><td class="hint">${r.uoc?esc(r.c?r.c.why:"Thiếu giá vốn"):"Đã có"}</td></tr>`)):`<p class="empty">Không có SKU nào trong nhóm này.</p>`}</section>`;
  return blk("Nhóm 1 · SKU lỗ ngay khi chưa tính quảng cáo","Bán càng nhiều càng mất tiền. Nếu giá vốn đang ước tính hoặc ghi theo thùng thay vì theo chai thì có thể là lỗ giả: xác nhận giá vốn trước khi quyết định.",P.g1,"red")
   +blk("Nhóm 2 · SKU biên mỏng, sát ngưỡng quảng cáo",`Toàn kênh đang chi quảng cáo ${tsbPct(P.ads,P.dt)} doanh thu, ngưỡng cảnh báo ${(P.ng2*100).toFixed(1).replace(".",",")}% (cộng 10 điểm đệm). Hạn chế đẩy quảng cáo nhóm này, dồn ngân sách sang nhóm biên dày.`,P.g2,"amb")
   +blk("Nhóm 3 · Nợ dữ liệu: SKU chưa quy đổi mã hoặc thiếu giá vốn","Lãi của các SKU này đang dùng giá vốn ước tính (theo tỷ lệ giá vốn bình quân), chưa đáng tin. Kế toán bổ sung ở Quy đổi mã các sàn hoặc Giá vốn SKU rồi bấm \"Tính lại giá vốn\".",P.g3,"amb");
}
function tsbChecks(P,todo){
  const v=x=>typeof x==="number"?tsbPct(x,1):esc(x);
  return `<section class="card"><div class="card-h"><h2>Chất lượng dữ liệu · 6 kiểm tra</h2></div>${tbl(["Kiểm tra","Kết quả","Chuẩn cần đạt",""],P.checks.map(c=>`<tr><td>${c[0]}</td><td class="n">${v(c[1])}</td><td class="hint">${c[2]}</td><td>${pill(c[3]?"Đạt":"Cần xử lý",c[3]?"grn":"amb")}</td></tr>`))}</section>
  <section class="card"><div class="card-h"><h2>Việc của kế toán</h2><button class="lnk" data-go="kho_qd">Mở Quy đổi mã các sàn →</button><button class="lnk" data-go="sku">Mở Giá vốn SKU →</button></div>
   ${todo.noMap.length?`<h3>SKU TikTok chưa quy đổi ra mã hàng (${todo.noMap.length})</h3>${tbl(["SKU ID","Seller SKU","Sản phẩm · phân loại","SL bán","Doanh thu"],todo.noMap.map(r=>`<tr><td class="mono">${esc(r.id)}</td><td>${esc(r.ss)}</td><td>${esc(r.pn.slice(0,60))}<br><small class="hint">${esc(r.vr)}</small></td><td class="n">${nf(r.q)}</td><td class="n">${tsbN(r.dt)}</td></tr>`))}`:""}
   ${todo.miss.length?`<h3>Mã hàng chưa có giá vốn (${todo.miss.length})</h3>${tbl(["Mã hàng","Số SKU dùng mã này","Doanh thu bị ảnh hưởng"],todo.miss.map(x=>`<tr><td class="mono">${esc(x.code)}</td><td class="n">${x.n}</td><td class="n">${tsbN(x.dt)}</td></tr>`))}`:""}
   ${todo.pack.length?`<h3>Hộp, thùng đóng gói chưa có giá (chưa cộng vào giá vốn) (${todo.pack.length})</h3>${tbl(["Mã bao bì","Số SKU dùng","Doanh thu liên quan"],todo.pack.map(x=>`<tr><td class="mono">${esc(x.code)}</td><td class="n">${x.n}</td><td class="n">${tsbN(x.dt)}</td></tr>`))}`:""}
   ${!todo.noMap.length&&!todo.miss.length&&!todo.pack.length?`<p class="empty">Không còn việc nào: mọi SKU đã có quy đổi và giá vốn.</p>`:""}</section>`;
}
function tsbMonthsView(){
  const S=(TSB.months||[]).map(m=>({ky:m.ky,s:m.summary,lock:!!m.locked_at}));
  if(typeof TT!=="undefined"&&TT&&!S.some(x=>x.ky==="2026-07")){const dt=plv(TT.pl,/^Doanh thu thuần/),lai=plv(TT.pl,/^LÃI ĐÓNG GÓP/);if(dt)S.unshift({ky:"2026-07",s:{dt,lai,ads:-plv(TT.pl,/Quảng cáo/),gv:-plv(TT.pl,/Giá vốn/),phi:plv(TT.pl,/^Phí sàn/),don:0},old:1,lock:1})}
  S.sort((a,b)=>a.ky<b.ky?-1:1);
  if(!S.length)return `<section class="card"><p class="empty">Chưa có tháng nào được lưu.</p></section>`;
  const mx=Math.max(1,...S.map(x=>x.s.dt)),W=Math.max(300,S.length*110),Hh=170,gw=W/S.length,bw=gw*.3;
  const bars=`<div class="xleg"><span><i style="background:#14213d"></i>Doanh thu</span><span><i style="background:#2f9e44"></i>Lãi đóng góp kênh</span></div><div class="chartx"><svg viewBox="0 0 ${W} ${Hh+26}" style="width:100%;max-width:${W}px">${S.map((x,i)=>{const h1=x.s.dt/mx*(Hh-10),h2=Math.max(0,x.s.lai)/mx*(Hh-10),x0=i*gw+gw*.18;return `<rect x="${x0}" y="${Hh-h1}" width="${bw}" height="${h1}" rx="3" fill="#14213d"><title>${tsbKyL(x.ky)} · doanh thu ${nf(x.s.dt)}</title></rect><rect x="${x0+bw+4}" y="${Hh-h2}" width="${bw}" height="${h2}" rx="3" fill="#2f9e44"><title>${tsbKyL(x.ky)} · lãi ${nf(x.s.lai)}</title></rect><text x="${x0+bw}" y="${Hh+16}" font-size="12" text-anchor="middle" fill="#6b7280">${tsbKyL(x.ky)}</text>`}).join("")}</svg></div>`;
  return `<section class="card"><div class="card-h"><h2>So sánh các tháng</h2><span class="hint">số đã lưu; tháng khoá sổ không đổi khi cập nhật giá vốn</span></div>${bars}
  ${tbl(["Tháng","Doanh thu","Giá vốn","Phí sàn","Quảng cáo (đã VAT)","Lãi đóng góp kênh","Biên đóng góp","Số đơn","Hủy/hoàn","Trạng thái"],S.map(x=>`<tr class="${x.old?"":"clk"}" ${x.old?"":`data-tsbky="${x.ky}"`}><td><b>${tsbKyL(x.ky)}</b></td><td class="n">${tsbN(x.s.dt)}</td><td class="n">${tsbN(x.s.gv)}</td><td class="n">${tsbN(Math.abs(x.s.phi))}</td><td class="n">${tsbN(x.s.ads)}</td><td class="n">${tsbRed(x.s.lai)}</td><td class="n">${tsbPct(x.s.lai,x.s.dt)}</td><td class="n">${x.s.don?nf(x.s.don):"—"}</td><td class="n">${x.s.hhRate!=null?tsbPct(x.s.hhRate,1):"—"}</td><td>${x.old?pill("file Excel cũ","gry"):pill(x.lock?"Đã khoá sổ":x.s.den?"Giữa tháng, đến "+tsbVn(x.s.den):"Bản nháp",x.lock?"grn":x.s.den?"blu":"amb")}</td></tr>`))}</section>`;
}
function tsbUpAdmCard(){
  const U=TSB.up,st=k=>U[k]?pill("Đã nhận: "+U[k].name,"grn"):pill("Chưa có","gry");
  return `<section class="card"><div class="card-h"><h2>Tải file tháng (kế toán)</h2><span class="hint">đọc ngay trên máy, chỉ gửi lên web số tiền, mã sản phẩm, trạng thái, ngày</span></div>
   <ol class="lessons"><li><b>OrderSKUList</b>: TikTok Shop › Đơn hàng › Xuất, lọc theo ngày tạo đơn, từ ngày 01 của tháng (.csv hoặc .xlsx).</li><li><b>income</b>: Tài chính › Quyết toán › Chi tiết đơn hàng, <b>từ ngày 01 của tháng</b>.</li><li><b>Campaign overview</b>: Quảng cáo GMV Max › Tổng quan chiến dịch › theo ngày, từ ngày 01 của tháng.</li></ol>
   <p class="hint"><b>Tải giữa tháng</b> (mỗi tuần hoặc mỗi ngày) được: xuất 3 file từ ngày 01 đến hôm nay, web tính doanh thu thực, phí sàn, quảng cáo <b>đến ngày đó</b>; đơn chưa quyết toán dùng phí ước tính. Tải lại thì bản mới thay bản cũ. <b>Chốt sổ</b>: income xuất từ 01 tới ít nhất ngày 08 tháng sau, bản này thay hết các bản giữa tháng.</p>
   ${tsbFileInput("tsbadm",true)}
   <div class="chips" style="margin-top:10px"><b>Đơn hàng</b>${st("orders")}<b>Quyết toán</b>${st("income")}<b>Quảng cáo</b>${st("camp")}</div>
   ${U.orders?`<div class="frm row4" style="margin-top:8px"><label class="field">Tháng báo cáo<input type="month" id="tsb-ky" value="${U.ky||""}"></label></div>`:""}
   ${TSB.busy?`<p class="note">${esc(TSB.busy)}</p>`:""}${TSB.err?`<div class="note red">${esc(TSB.err)}</div>`:""}</section>`;
}
function tsbAdmPage(m){
  if(!(typeof SV!=="undefined"&&SV.acct)){m.innerHTML=H("Kênh TikTok Shop","Báo cáo quản trị tháng")+`<section class="card"><p>Chỉ CEO và kế toán xem được lãi lỗ kênh.</p></section>`;return}
  if(!TSB.months){tsbLoadMonths();m.innerHTML=H("Kênh TikTok Shop","Đang tải…");return}
  /* Tháng theo ô chọn thời gian; bấm nút tháng trên trang thì giữ tháng đó tới khi đổi kỳ. Tháng chưa tải báo cáo thì báo chờ tải, không hiện tháng khác. */
  {const pk=PERIOD.from+"|"+PERIOD.to;if(TSB.pk!==pk){TSB.pk=pk;const pym=plYmNow();TSB.ky=TSB.months.some(x=>x.ky===pym)?pym:"";TSB.noRep=TSB.ky?"":pym}}
  const V=TSB.prev,ky=V?V.ky:TSB.ky;if(!V&&ky)tsbLoadMonth(ky);
  const S=!V&&ky?TSB.data[ky]:null,P=V?V.P:S?S.pl:null,todo=V?ttTodo(V.P):S?(S.data.todo||ttTodo(S.pl)):null;
  const tab=SUB.bc_tiktok||"pl",lock=S&&S.locked_at,chot=ky?"08/"+ttKyNext(ky).slice(5)+"/"+ttKyNext(ky).slice(0,4):"";
  const chips=(TSB.months||[]).map(x=>`<button class="chip${!V&&x.ky===TSB.ky?" on":""}" data-tsbky="${x.ky}">${tsbKyL(x.ky)}${x.summary&&x.summary.den?" · đến "+tsbVn(x.summary.den).slice(0,5):""}${x.locked_at?" ✓":""}</button>`).join("");
  const tabs=[["pl","Lãi lỗ"],["sp","Sản phẩm & SKU"],["cb","Cảnh báo"],["dl","Chất lượng dữ liệu"],["thang","Các tháng"],["up","Tải file tháng"]];
  let body="";
  if(tab==="up")body=tsbUpAdmCard();
  else if(tab==="thang")body=tsbMonthsView();
  else if(!P)body=ky&&!V&&TSB.data[ky]===null?`<section class="card"><p class="hint">Đang tải ${tsbKyL(ky)}…</p></section>`:`<section class="card"><p class="empty">${TSB.months.length&&TSB.noRep?`Tháng ${tsbKyL(TSB.noRep)} chưa tải báo cáo TikTok. Bấm <b>Tải file tháng</b> để tải báo cáo tuần này (income đến ngày gần nhất), hoặc bấm tháng khác ở trên để xem.`:`Chưa có tháng nào. Bấm <b>Tải file tháng</b> để kế toán tải 3 file TikTok.`}</p></section>`;
  else if(tab==="pl")body=`<section class="card"><div class="card-h"><h2>Lãi lỗ kênh ${tsbKyL(ky)}</h2></div>${tsbPLTbl(P)}</section><section class="card"><div class="card-h"><h2>Phí sàn 7 nhóm</h2></div>${tsbFeeTbl(P)}</section>
    <section class="card"><div class="card-h"><h2>Chỉ số điều hành</h2></div>${tbl(["Chỉ số","Giá trị","Ý nghĩa"],[["Mức chi quảng cáo trên doanh thu",tsbPct(P.ads,P.dt),"Ngưỡng quan trọng nhất: SKU có biên lãi gộp thấp hơn mức này là đang lỗ nếu bị đẩy quảng cáo ở mức trung bình"],["Số đơn bán được",nf(P.don),""],["Số món bán ra",nf(P.mon),""],["Giá trị đơn trung bình",nf(P.aov),"Doanh thu chia số đơn"],["Giá trị hàng hủy/hoàn",tsbN(P.hh),"Không ghi doanh thu, không ghi giá vốn"],["Tỷ lệ hủy/hoàn theo giá trị",tsbPct(P.hhRate,1),""],["Số SKU có bán",nf(P.nSku),""],["Chi phí riêng của kênh nhập trên web",P.extra.length?tsbN(P.extraT):"Chưa có","Khoản ở Chi phí theo tháng gắn kênh TikTok (agency, hàng mẫu KOC, livestream, quảng cáo ngoài GMV Max)"]].map(r=>`<tr><td>${r[0]}</td><td class="n"><b>${r[1]}</b></td><td class="hint">${esc(r[2])}</td></tr>`))}</section>`;
  else if(tab==="sp")body=`<section class="card"><div class="card-h"><h2>Lãi lỗ theo sản phẩm</h2><span class="hint">gộp mọi phân loại, combo của cùng sản phẩm</span></div>${tsbSpTbl(P)}</section><section class="card"><div class="card-h"><h2>Lãi lỗ theo SKU</h2><span class="hint">"Trần ads chịu được" = biên lãi gộp sau phí sàn</span></div>${tsbSkuTbl(P.rows.filter(r=>r.q>0||r.dt))}</section>`;
  else if(tab==="cb")body=tsbWarn(P);
  else if(tab==="dl")body=tsbChecks(P,todo);
  const kp=P&&tab!=="thang"&&tab!=="up"?`<div class="grid kpis">${kpi("Doanh thu",tr(P.dt),nf(P.don)+" đơn · TB "+tr(P.aov)+"/đơn")}${kpi("Lãi gộp sau phí sàn",tr(P.lg),tsbPct(P.lg,P.dt)+" doanh thu")}${kpi("Phí sàn",tr(-P.phi),tsbPct(-P.phi,P.dt)+" doanh thu")}${kpi("Quảng cáo (đã VAT)",tr(P.ads),tsbPct(P.ads,P.dt)+" doanh thu")}${kpi("Lãi đóng góp kênh",tr(P.lai),tsbPct(P.lai,P.dt)+" doanh thu","var(--green)")}${kpi("Hủy/hoàn",tsbPct(P.hhRate,1),tr(P.hh)+" giá trị")}</div>`:"";
  const prevBar=V?`<section class="card" style="border:2px solid var(--orange)"><div class="card-h"><h2>Bảng xem trước ${tsbKyL(V.ky)}${V.M.den?" · giữa tháng, số đến "+tsbVn(V.M.den):""} · chưa lưu</h2><span class="hint">${V.recalc?"tính lại giá vốn theo dữ liệu web hiện tại":esc(Object.values(V.files||{}).join(" · "))}</span></div><p class="hint">Xem kỹ các tab Lãi lỗ, Cảnh báo, Chất lượng dữ liệu. Bấm lưu thì số mới ghi lên web.</p>${P.dtUocGv/P.dt>0.05?`<div class="note red">Còn <b>${tsbPct(P.dtUocGv,P.dt)}</b> doanh thu chưa có giá vốn thật (đang ước tính${P.gvRate?"":", và chưa có mã nào có giá vốn nên đang tính 0"}). Chưa nên dùng số lãi theo sản phẩm để quyết định cắt hay đẩy. Xem tab Chất lượng dữ liệu.</div>`:P.dtUocGv?`<p class="hint">Còn ${tsbPct(P.dtUocGv,P.dt)} doanh thu đang ước tính giá vốn.</p>`:""}<div class="acts"><button class="btn pri" id="tsb-save"${TSB.busy?" disabled":""}>Lưu báo cáo ${tsbKyL(V.ky)}</button><button class="btn" id="tsb-cancel">Bỏ bản xem trước</button></div></section>`:"";
  const stat=S?`<span class="hint">${lock?`Đã khoá sổ ${new Date(S.locked_at).toLocaleDateString("vi-VN")}`:`${S.data&&S.data.M&&S.data.M.den?"Báo cáo giữa tháng, số đến "+tsbVn(S.data.M.den)+" · ":"Bản nháp · "}lưu ${new Date(S.updated_at).toLocaleString("vi-VN")} · chốt sổ từ ngày ${chot}`}</span>${lock?(isCeo()?`<button class="btn sm" id="tsb-unlock">Mở khoá</button>`:""):`<button class="btn sm" id="tsb-recalc">Tính lại giá vốn</button><button class="btn sm pri" id="tsb-lock">Khoá sổ ${tsbKyL(ky)}</button>`}`:"";
  m.innerHTML=H("Kênh TikTok Shop",`Báo cáo quản trị tháng · chốt sổ ngày 8 tháng sau${ky?" · "+tsbKyL(ky):""}`)
   +`<div class="filters"><div class="chips"><b>Tháng</b>${chips||`<span class="hint">chưa có tháng nào</span>`}${V?`<button class="chip on">${tsbKyL(V.ky)} · xem trước</button>`:""}</div>${stat}</div>`
   +prevBar+kp+`<div class="tabs">${tabs.map(([k,t])=>`<button data-sub="${k}" class="${k===tab?"on":""}">${t}</button>`).join("")}</div>`+body
   +srcNote("File TikTok Shop do kế toán tải (OrderSKUList, income, Campaign overview). Giá vốn lấy từ Quy đổi mã các sàn và Giá vốn SKU. Quy tắc: báo cáo quản trị TikTok (skill ailla-baocao-quantri-tiktok).");
  m.querySelectorAll("[data-tsbky]").forEach(b=>b.onclick=()=>{TSB.prev=null;TSB.ky=b.dataset.tsbky;TSB.noRep="";if(SUB.bc_tiktok==="thang"||SUB.bc_tiktok==="up")SUB.bc_tiktok="pl";renderMain()});
  tsbBindFiles("tsbadm",tsbAdmFiles);
  const ki=$("#tsb-ky");if(ki)ki.onchange=()=>{TSB.up.ky=ki.value;tsbAdmCompute()};
  const on=(id,f)=>{const b=$("#"+id);if(b)b.onclick=f};
  on("tsb-save",tsbSavePrev);on("tsb-cancel",()=>{TSB.prev=null;renderMain()});on("tsb-recalc",tsbRecalc);on("tsb-lock",()=>tsbLock(true));on("tsb-unlock",()=>tsbLock(false));
}

/* ---------- Trang vận hành: hiệu suất theo ngày ---------- */
function tsbOpsAgg(from,to){
  const A=TSB.all||{days:{}},S={km:{},live:{},ads:{},nKm:0,nAds:0,nLive:0};
  Object.entries(A.days).forEach(([d,x])=>{if(d<from||d>to)return;
    if(x.km){S.nKm++;Object.entries(x.km).forEach(([k,v])=>S.km[k]=(S.km[k]||0)+v)}
    if(x.live){S.nLive++;Object.entries(x.live).forEach(([k,v])=>S.live[k]=(S.live[k]||0)+v)}
    if(x.ads){S.nAds++;Object.entries(x.ads).forEach(([k,v])=>S.ads[k]=(S.ads[k]||0)+v)}});
  return S;
}
function tsbOpsBody(){
  const from=PERIOD.from,to=PERIOD.to,S=tsbOpsAgg(from,to),K=S.km,gmv=K.gmv||0,adsV=Math.round((S.ads.chi||0)*(1+TT_ADS_VAT));
  const g=k=>d=>(((TSB.all.days[d]||{}).km)||{})[k]||0,ga=k=>d=>(((TSB.all.days[d]||{}).ads)||{})[k]||0;
  const lanes=`<section class="card"><div class="card-h"><h2>5 làn GMV</h2><span class="hint">GMV theo nguồn (số đo hiệu suất, chưa trừ hủy, hoàn) · ${S.nKm} ngày có số</span></div>
   ${S.nKm?tbl(["Làn","GMV","% GMV"],TT_LANES.map(([k,n])=>`<tr><td>${n}</td><td class="n">${tsbN(K[k])}</td><td class="n">${tsbPct(K[k],gmv)}</td></tr>`).concat([`<tr class="tot"><td><b>Tổng GMV</b></td><td class="n">${tsbN(gmv)}</td><td class="n">${tsbPct(TT_LANES.reduce((a,[k])=>a+(K[k]||0),0),gmv)}</td></tr>`])):`<p class="empty">Kỳ này chưa có số Key metrics.</p>`}</section>`;
  const ads=`<section class="card"><div class="card-h"><h2>Quảng cáo GMV Max</h2><span class="hint">${S.nAds} ngày có số</span></div>
   ${S.nAds?`<div class="grid kpis">${kpi("Chi phí quảng cáo (đã VAT)",tr(adsV),"trước VAT "+tr(S.ads.chi))}${kpi("ROAS trên GMV cả shop",adsV&&gmv?(gmv/adsV).toFixed(2).replace(".",","):"—","GMV cả shop chia chi phí quảng cáo")}${kpi("Quảng cáo trên GMV",tsbPct(adsV,gmv))}${kpi("GMV do quảng cáo (TikTok tự khai)",tr(S.ads.gmv),"ROI tự khai "+(S.ads.chi?(S.ads.gmv/S.ads.chi).toFixed(2).replace(".",","):"—"))}${kpi("Đơn từ quảng cáo",nf(S.ads.don),"chi / đơn "+(S.ads.don?nf(S.ads.chi/S.ads.don):"—"))}</div>${seriesBars([{n:"Chi phí quảng cáo (đã VAT)",c:"#e03131",get:d=>ga("chi")(d)*(1+TT_ADS_VAT)},{n:"GMV cả shop",c:"#14213d",get:g("gmv")}])}<p class="hint">ROI trong trang quảng cáo là số TikTok tự khai, thường cao hơn thực tế. Số để quyết định là ROAS trên GMV cả shop.</p>`:`<p class="empty">Kỳ này chưa có số quảng cáo (file Campaign overview).</p>`}</section>`;
  const R=(TSB.all.ranges||[]).filter(r=>r.from>=from&&r.to<=to||r.from<=to&&r.to>=from),pick=k=>R.filter(r=>r.kind===k).sort((a,b)=>(b.to.localeCompare(a.to))||(a.from.localeCompare(b.from)))[0];
  const kc=pick("koc"),cr=pick("creators"),rg=r=>`${tsbVn(r.from)} – ${tsbVn(r.to)}`,M=kc&&kc.data||{};
  const koc=`<section class="card"><div class="card-h"><h2>KOC & nhà sáng tạo</h2>${kc||cr?`<span class="hint">số cả khoảng ${esc(rg(kc||cr))}${(kc||cr).from<from||(kc||cr).to>to?" (khác kỳ đang chọn)":""}</span>`:""}</div>
   ${kc?`<div class="grid kpis">${kpi("GMV nhờ nhà sáng tạo",tr(M["GMV nhờ nhà sáng tạo"]),nf(M["Số món bán ra nhờ nhà sáng tạo"])+" món")}${kpi("Nhà sáng tạo có doanh số",nf(M["Nhà sáng tạo có doanh số"]),nf(M["Nhà sáng tạo đã đăng nội dung"])+" người đã đăng nội dung")}${kpi("Video có doanh số",nf(M["Video có doanh số"]),"trên "+nf(M["Video"])+" video")}${kpi("LIVE có doanh số",nf(M["Buổi LIVE có doanh số"]),"trên "+nf(M["Buổi LIVE"])+" buổi")}${kpi("Hoa hồng ước tính",tr(M["Hoa hồng ước tính"]))}${kpi("Hàng mẫu đã gửi",nf(M["Hàng mẫu đã vận chuyển"]))}</div>`:`<p class="hint">Chưa có file Transaction Analysis cho kỳ này.</p>`}
   ${cr?`<h3>Nhà sáng tạo bán tốt nhất</h3><p class="hint">${nf(cr.data.nCo)} người có doanh số / ${nf(cr.data.n)} người trong danh sách · tổng GMV liên kết ${tr(cr.data.gmv)}</p>${tbl(["#","Nhà sáng tạo","GMV","GMV video","GMV LIVE","GMV thẻ SP","Đơn","Hoa hồng ước tính","Hoàn tiền","Người theo dõi"],cr.data.top.slice(0,20).map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.u)}</b></td><td class="n">${tsbN(x.gmv)}</td><td class="n">${tsbN(x.video)}</td><td class="n">${tsbN(x.live)}</td><td class="n">${tsbN(x.the)}</td><td class="n">${nf(x.don)}</td><td class="n">${tsbN(x.hh)}</td><td class="n">${tsbN(x.hoan)}</td><td class="n">${nf(x.fl)}</td></tr>`))}`:`<p class="hint">Chưa có file Creator List cho kỳ này.</p>`}</section>`;
  const L=S.live,vl=`<section class="card"><div class="card-h"><h2>Video & LIVE</h2></div><div class="grid kpis">${kpi("Video inhouse",tr(K.vInh),tsbPct(K.vInh,gmv)+" GMV")}${kpi("Video KOC",tr(K.vKoc),tsbPct(K.vKoc,gmv)+" GMV")}${kpi("LIVE người bán",tr(K.lShop),tsbPct(K.lShop,gmv)+" GMV")}${kpi("Buổi LIVE",S.nLive?nf(L.phien):"—",S.nLive?nf(L.phienGmv)+" buổi có GMV":"chưa có file LIVE")}${kpi("GMV từ buổi LIVE",S.nLive?tr(L.gmv):"—",S.nLive?nf(L.don)+" đơn · "+nf(L.xem)+" lượt xem":"")}</div></section>`;
  const days=pDays().filter(d=>TSB.all.days[d]).reverse();
  const daily=`<section class="card"><div class="card-h"><h2>Diễn biến từng ngày</h2></div>${days.length?tbl(["Ngày","GMV","Đơn","Video inhouse","Video KOC","Thẻ SP","LIVE","Chi phí quảng cáo (đã VAT)","ROAS"],days.map(d=>{const x=TSB.all.days[d],k=x.km||{},a=x.ads?Math.round(x.ads.chi*(1+TT_ADS_VAT)):0;return `<tr><td>${vnd(d)}</td><td class="n">${x.km?tsbN(k.gmv):"—"}</td><td class="n">${x.km?nf(k.don):"—"}</td><td class="n">${tsbN(k.vInh)}</td><td class="n">${tsbN(k.vKoc)}</td><td class="n">${tsbN(k.the)}</td><td class="n">${tsbN((k.lShop||0)+(k.lKoc||0))}</td><td class="n">${a?tsbN(a):"—"}</td><td class="n">${a&&k.gmv?(k.gmv/a).toFixed(2).replace(".",","):"—"}</td></tr>`})):`<p class="empty">Kỳ này chưa có số theo ngày.</p>`}</section>`;
  return lanes+ads+vl+koc+daily;
}
/* Ô tải số liệu cho team TikTok (dùng ở trang TikTok và ở Nhập báo cáo). */
function tsbUpOpsCard(){
  const last=(TSB.all&&TSB.all.last)||[],L=k=>{const x=last.find(r=>r.src===k);return x?`có tới ${tsbVn(x.day)}`:"chưa có"};
  const P=TSB.opsPrev;
  return `<section class="card"><div class="card-h"><h2>Tải số liệu TikTok</h2><span class="hint">mỗi tuần một lần · tải lại thì ghi đè đúng ngày</span></div>
   <ol class="lessons"><li><b>Key metrics</b>: Phân tích › Tổng quan shop › Xuất (theo ngày) · ${L("km")}.</li><li><b>Live Performance Core Stats</b>: Phân tích › LIVE › Xuất · ${L("live")}.</li><li><b>Transaction Analysis</b> và <b>Creator List</b>: Tiếp thị liên kết › Phân tích › Xuất (giữ nguyên tên file TikTok đặt, trong tên có khoảng ngày).</li><li>Có thể tải thêm <b>Campaign overview</b> (Quảng cáo GMV Max theo ngày) để thấy ROAS sớm · ${L("ads")}.</li></ol>
   ${tsbFileInput("tsbops",true)}
   ${P&&P.length?`<h3>Xem trước</h3>${tbl(["File","Loại","Khoảng ngày","Nội dung",""],P.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${x.kind?esc(TT_KIND_NAME[x.kind]):pill("Không nhận ra","red")}</td><td>${x.range?esc(tsbVn(x.range.from)+" – "+tsbVn(x.range.to)):"—"}</td><td class="hint">${esc(x.note||x.err||"")}</td><td>${x.ok?pill("Sẵn sàng","grn"):pill("Bỏ qua","amb")}</td></tr>`))}<div class="acts"><button class="btn pri" id="tsb-opsave"${P.some(x=>x.ok)?"":" disabled"}>Lưu ${P.filter(x=>x.ok).length} file lên web</button><button class="btn" id="tsb-opcancel">Bỏ</button></div>`:""}
   ${TSB.opsBusy?`<p class="note">${esc(TSB.opsBusy)}</p>`:""}</section>`;
}
async function tsbOpsFiles(fs){
  TSB.opsBusy="Đang đọc "+fs.length+" file…";renderMain();const out=[];
  for(const f of fs){const x={name:f.name};try{const sh=await tsbRead(f),k=ttKind(sh),a=sh[Object.keys(sh)[0]];x.kind=k;
    const days=o=>{const ks=Object.keys(o.days).sort();x.range={from:ks[0],to:ks[ks.length-1]};x.note=ks.length+" ngày"};
    if(k==="km"){const r=ttReadKeyMetrics(a);if(r.err)x.err=r.err;else{x.pay={src:"km",days:r.days};days(r);x.note+=" · GMV "+nf(Object.values(r.days).reduce((s,d)=>s+d.gmv,0))}}
    else if(k==="live"){const r=ttReadLive(a);if(r.err)x.err=r.err;else{x.pay={src:"live",days:r.days};days(r)}}
    else if(k==="camp"){const r=ttReadCampaign(a);if(r.err)x.err=r.err;else{x.pay={src:"ads",days:r.days};days(r);x.note+=" · chi "+nf(Object.values(r.days).reduce((s,d)=>s+d.chi,0))+" trước VAT"}}
    else if(k==="koc"){const r=ttReadKoc(a,f.name);if(r.err)x.err=r.err;else{x.rpay={kind:"koc",from:r.range.from,to:r.range.to,data:r.m};x.range=r.range;x.note="GMV nhờ nhà sáng tạo "+nf(r.m["GMV nhờ nhà sáng tạo"]||0)}}
    else if(k==="creators"){const r=ttReadCreators(a,f.name);if(r.err)x.err=r.err;else{x.rpay={kind:"creators",from:r.range.from,to:r.range.to,data:{n:r.n,nCo:r.nCo,gmv:r.gmv,top:r.top}};x.range=r.range;x.note=nf(r.nCo)+" người có doanh số, giữ "+r.top.length+" người cao nhất"}}
    else if(k==="orders"||k==="income")x.err="File của kế toán: tải ở trang quản trị › Doanh thu › TikTok.";
    else x.err="Không nhận ra loại file TikTok.";
    x.ok=!!(x.pay||x.rpay)}catch(e){x.err=e.message}out.push(x)}
  TSB.opsPrev=out;TSB.opsBusy="";renderMain();
}
async function tsbOpsSave(){
  const P=(TSB.opsPrev||[]).filter(x=>x.ok);if(!P.length)return;TSB.opsBusy="Đang lưu…";renderMain();const done=[];
  try{for(const x of P){if(x.pay)await tsbApi("/days",{method:"PUT",body:JSON.stringify({...x.pay,file:x.name})});else await tsbApi("/range",{method:"PUT",body:JSON.stringify({...x.rpay,file:x.name})});done.push(x)}
    DB.mutate(ME.name,"tải số liệu TikTok",dt=>{dt.imports=dt.imports||[];done.forEach(x=>dt.imports.unshift({id:uid("i"),loai:"Tổng quan TikTok",kenh:TT_KIND_NAME[x.kind],at:new Date().toLocaleString("vi-VN"),by:ME.name,file:x.name,range:x.range?tsbVn(x.range.from)+" – "+tsbVn(x.range.to):"",tuan:weekOf(dt.settings.today)||1,ketQua:"Đã lưu: "+(x.note||""),sum:{chi:0,mua:0,gt:0,match:{n:0},stray:{n:0},auto:{n:0}}}))});
    toast("Đã lưu "+done.length+" file");TSB.opsPrev=null}catch(e){toast(e.message)}
  TSB.opsBusy="";await tsbLoadAll(true);renderMain();
}
function tsbOpsBind(m){tsbBindFiles("tsbops",tsbOpsFiles);const s=m.querySelector("#tsb-opsave");if(s)s.onclick=tsbOpsSave;const c=m.querySelector("#tsb-opcancel");if(c)c.onclick=()=>{TSB.opsPrev=null;renderMain()}}
function tsbOpsPage(m){
  if(!TSB.all){tsbLoadAll();m.innerHTML=H("Kênh TikTok Shop","Đang tải số liệu…");return}
  const last=(TSB.all.last||[]).find(r=>r.src==="km");
  m.innerHTML=H("Kênh TikTok Shop",`Hiệu suất bán hàng theo ngày${last?" · số có tới "+tsbVn(last.day):""}`)+tsbOpsBody()+(tsbCanUp()?tsbUpOpsCard():"")
   +srcNote("File TikTok Shop do team TikTok tải: Key metrics (5 làn GMV theo ngày), Live Performance, Transaction Analysis, Creator List; quảng cáo từ Campaign overview.");
  tsbOpsBind(m);
}
PAGES.bc_tiktok=m=>{if(tsbAdm())return tsbAdmPage(m);_pb(tsbOpsPage,"tts")(m)};

/* Nhập báo cáo › tab "Báo cáo tổng quan TikTok": dùng chung ô tải của team TikTok. */
ntTq=function(){if(!TSB.all)tsbLoadAll();return tsbUpOpsCard()+`<p class="hint" style="margin:8px 4px">Số đã lưu hiện ở <button class="lnk" data-go="bc_tiktok">Kinh doanh B2C › TikTok →</button></p>`};
ntTqBind=function(m){tsbOpsBind(m)};

/* Tổng quan công ty (trang quản trị): kỳ chọn trọn các tháng đã lưu thì dòng TikTok lấy lãi đóng góp kênh của tháng. */
{const _en=execNums;execNums=function(from,to){const N=_en(from,to);
  if(!tsbAdm()||!TSB.sum)return N;const ms=[];for(let d=pdate(from.slice(0,7)+"-01");iso(d)<=to;d=new Date(d.getFullYear(),d.getMonth()+1,1))ms.push(iso(d).slice(0,7));
  if(!ms.length||!ms.every(k=>TSB.sum[k]&&fullMonth(k,from,to)))return N;
  const S=ms.map(k=>TSB.sum[k]),s=f=>S.reduce((a,x)=>a+(+f(x)||0),0);
  N.C.gvTT=s(x=>x.gv);N.C.phiTT=-s(x=>x.phi);N.C.adsTT=s(x=>x.ads);N.C.khacTT=s(x=>(x.extraT||0)-(x.adj||0));N.L.tts=s(x=>x.lai);N.tFull=true;
  return N}}
