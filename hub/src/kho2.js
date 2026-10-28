/* =====================================================================
   KHO VẬT TƯ (phần 2): nối kiểm kê lô của khối Sản xuất với sổ kho + đồng bộ mã CRM Kênh phân phối → mã MISA.
   Nạp SAU kho.js và sanxuat.js.
   ===================================================================== */

/* ---------- Nối khối kiểm kê lô (Kiểm kê – Lô & Tem) với sổ kho ---------- */
const khoMisaOf=sp=>{
  const m=((SX().cfg||{}).khoMap||{})[sp];if(m&&KHO.items.get(m))return m;
  const hit=[...KHO.items.values()].find(i=>i.code.toLowerCase()===String(sp).toLowerCase()&&["TP","COMBO"].includes(i.cls));
  return hit?hit.code:"";
};
function khoAskMisa(sp){
  return new Promise(res=>{
    openDrawerHTML(`<h2>Chọn mã MISA cho sản phẩm</h2><p>${esc(sxP(sp).ten)}<br><span class="hint">Chọn 1 lần, lần sau lô của sản phẩm này tự nối kho.</span></p>
    <form class="frm" id="km"><label class="field">Mã thành phẩm trong MISA<input id="km-i" autocomplete="off" placeholder="Gõ mã hoặc tên rồi chọn" required></label><button class="btn pri">Lưu và ghi kho</button></form>`);
    khoPick($("#km-i"),["TP","COMBO"],()=>{});
    $("#km").onsubmit=e=>{e.preventDefault();const c=$("#km-i").dataset.code;if(!c){toast("Chọn mã trong danh sách gợi ý");return}
      sxMut("nối mã sản phẩm với MISA "+c,s2=>{s2.cfg.khoMap=s2.cfg.khoMap||{};s2.cfg.khoMap[sp]=c});closeDrawer();res(c)};
    $("#dx").onclick=()=>{closeDrawer();res("")};
  });
}
/* Ghi phiếu kiểm kê vào kho cho một lô đã kiểm: trừ BTP, vỏ, tem theo định mức; cộng thành phẩm ĐẠT.
   Điều chỉnh lô thì thay phiếu cũ (phiếu cũ chuyển sang Đã hủy, còn dấu vết). */
async function khoPostLot(batchId,reason){
  try{
    await khoLoad(true);
    const b=SX().batches.find(x=>x.id===batchId);if(!b||!b.ma||!b.tong)return;
    let misa=khoMisaOf(b.sp);if(!misa)misa=await khoAskMisa(b.sp);
    if(!misa){toast("Chưa ghi kho: lô "+b.ma+" chưa có mã MISA. Mở lô và bấm Ghi kho khi sẵn sàng.");return}
    const r=await kApi("/docs",{method:"POST",body:JSON.stringify({type:"KS",date:b.ngay,ref_no:b.ma,lot:b.ma,replace:!!b.khoDoc,reason:reason||"",note:"Lô "+b.ma,
      lines:[{item:misa,qty:b.tong,good_qty:b.dat,ref_qty:b.baoSL||undefined}]})});
    sxMut("ghi kho lô "+b.ma,s2=>{const x=s2.batches.find(y=>y.id===batchId);x.khoDoc=r.no;
      x.hist.push({at:sxNow(),by:ME.name,act:"Đã ghi kho "+r.no+" (trừ BTP, vỏ, tem theo định mức; cộng "+nf(b.dat)+" thành phẩm đạt)"})});
    KHO.at=0;KHO.list={};await khoLoad(true);
    toast("Đã ghi kho "+r.no+(r.warnings&&r.warnings.length?" · có cảnh báo, xem phiếu":""));
    if(r.warnings&&r.warnings.length)khoOpenDoc(r.id,r.warnings);
  }catch(e){toast("Chưa ghi được kho: "+e.message)}
}
async function khoCancelLot(code,reason){
  try{await kApi("/lots/"+encodeURIComponent(code)+"/cancel",{method:"POST",body:JSON.stringify({reason})});KHO.at=0;KHO.list={};khoLoad(true)}
  catch(e){toast("Chưa trả được kho: "+e.message)}
}

/* ---------- Đồng bộ mã CRM Kênh phân phối → mã MISA ---------- */
async function khoLoadMap(){
  KHO.mp={busy:true};
  try{Object.assign(KHO.mp,await kApi("/map"))}catch(e){toast(e.message);KHO.mp.map=[];KHO.mp.unmapped=[]}
  KHO.mp.busy=false;if(PAGE==="kho_map")renderMain();
}
function khoParseMapFile(wb){
  const ws=wb.Sheets[wb.SheetNames.find(n=>/DONG_BO/i.test(n))||wb.SheetNames[0]],A=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  const hi=A.findIndex(r=>r.some(c=>/^m[ãa]\s*crm/i.test(String(c).trim())));if(hi<0)throw new Error("Không thấy dòng tiêu đề 'Mã CRM hiện tại'");
  const H=A[hi].map(c=>String(c).trim().toLowerCase()),ix=re=>H.findIndex(h=>re.test(h));
  const cC=ix(/^m[ãa] crm/),cM=ix(/^m[ãa] misa/),cF=ix(/^h[ệe] s[ốo]/),cN=ix(/ghi ch/);
  if(cC<0||cM<0||cF<0)throw new Error("Thiếu cột Mã CRM / MÃ MISA / Hệ số");
  // Hệ số trong file có dạng "28." hoặc "0.04" hoặc "1,6": bỏ dấu chấm cuối, đổi phẩy thành chấm.
  const num=v=>typeof v==="number"?v:+String(v).trim().replace(/\.$/,"").replace(",",".");
  const rows=[],skip=[];
  A.slice(hi+1).forEach(r=>{const sku=String(r[cC]).trim(),code=String(r[cM]).trim();if(!sku)return;const f=num(r[cF]);
    if(!code||!(f>0)){skip.push(sku+(code?"":" (chưa có mã MISA)"));return}
    rows.push({crm_sku:sku,misa_code:code,factor:f,note:cN>=0?String(r[cN]||""):""})});
  return {rows,skip};
}
/* Gắn / sửa mã MISA cho một mã CRM: chọn mã trong danh mục kho, điền hệ số (1 đơn vị bán = bao nhiêu đơn vị kho). */
function khoMapForm(sku,pick){
  const M=KHO.mp||{},cur=(M.map||[]).find(r=>r.crm_sku===sku),un=(M.unmapped||[]).find(u=>u.sku===sku),name=cur?cur.crm_name:un?un.name:"";
  openDrawerHTML(`<h2>${cur?"Sửa":"Gắn"} mã MISA · ${esc(sku)}</h2><p class="hint">${esc(name||"")}${un?" · đã xuất "+knum(un.qty)+" "+esc(un.unit||""):""}</p><form class="frm" id="kmf">
   <label class="field">Mã MISA (gõ mã hoặc tên để tìm)<input id="kmf-c" value="${esc(pick||(cur?cur.misa_code:""))}" autocomplete="off" required></label><div class="hint" id="kmf-n">${esc(pick?mhName(pick):cur?cur.misa_name||"":"")}</div><p class="hint">Sản phẩm mới, MISA chưa có mã? <button type="button" class="lnk" id="kmf-new">+ Tạo mã mới trong danh mục kho</button> (đặt đúng mã sẽ tạo trên MISA), tạo xong quay lại đây gắn luôn.</p>
   <label class="field">Hệ số: 1 ${esc(un?un.unit||"đơn vị":"đơn vị")} bán ra bằng bao nhiêu đơn vị kho<input id="kmf-f" type="number" min="0" step="any" value="${cur?cur.factor:1}" required></label>
   <p class="hint">Thường là 1. Bán theo thùng thì điền số can / chai trong một thùng.</p>
   <label class="field">Ghi chú<input id="kmf-o" value="${esc(cur?cur.note||"":"")}"></label><div id="kmf-e"></div><button class="btn pri">Lưu</button></form>`);
  $("#kmf-new").onclick=()=>khoNewItem({name,cls:"TP",onDone:code=>khoMapForm(sku,code)});
  khoPick($("#kmf-c"),null,it=>{$("#kmf-c").value=it.code;$("#kmf-n").textContent=it.name+" · "+(it.unit||"")});
  $("#kmf").onsubmit=async e=>{e.preventDefault();
    try{await kApi("/map/"+encodeURIComponent(sku),{method:"PUT",body:JSON.stringify({misa_code:$("#kmf-c").value.trim(),factor:+$("#kmf-f").value,note:$("#kmf-o").value})});closeDrawer();toast("Đã gắn "+sku+" → "+$("#kmf-c").value.trim());KHO.at=0;await khoLoad(true);await khoLoadMap()}
    catch(err){$("#kmf-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}};
}
function pKhoMap(m){
  if(!KHO.mp)khoLoadMap();
  const M=KHO.mp||{},ceo=ME.role==="admin";
  khoFrame(m,"kho_map","Đồng bộ mã Kênh phân phối","Đơn Kênh phân phối trừ kho ngay khi CRM bấm Đã xuất kho. Số trừ = số trên đơn × hệ số (1 thùng = số can / chai trong thùng). Mã chưa đồng bộ thì chưa trừ.",`
  <section class="card kmfrom"><b>Trừ kho theo đơn Kênh phân phối từ ngày</b>${ceo?`<input type="date" id="mp-d" value="${M.b2b_from||kToday()}"><button class="btn sm" id="mp-save">Đặt ngày</button>`:`<b>${M.b2b_from?kDd(M.b2b_from):"chưa đặt"}</b>`}<span class="hint">${M.b2b_from?"Đơn xuất trước ngày này coi như đã nằm trong tồn đầu kỳ.":"Chưa đặt ngày nên <b>chưa trừ kho</b>. Nên đặt đúng ngày kiểm kê tồn đầu."}</span></section>
  ${M.unmapped&&M.unmapped.length?`<section class="card"><div class="card-h"><h2>Đã xuất kho nhưng chưa có mã MISA (kho chưa trừ)</h2>${khoCanMisa()?`<span class="hint">Bấm <b>Gắn mã MISA</b> ở từng dòng, gắn xong kho tự trừ số đã xuất.</span>`:""}</div>${tbl(["Mã CRM","Tên","ĐVT","Số lượng đã xuất"].concat(khoCanMisa()?[""]:[]),M.unmapped.map(u=>`<tr><td class="mono">${esc(u.sku)}</td><td>${esc(u.name)}</td><td>${esc(u.unit)}</td><td class="n">${knum(u.qty)}</td>${khoCanMisa()?`<td><button class="btn sm pri" data-mset="${esc(u.sku)}">Gắn mã MISA</button></td>`:""}</tr>`))}</section>`:""}
  <section class="card flush"><div class="card-h pad"><h2>Bảng đồng bộ (${(M.map||[]).length} mã CRM)</h2>${ceo?`<label class="btn">Nạp file đồng bộ (.xlsx / .csv)<input type="file" id="mp-f" accept=".xlsx,.xls,.csv" hidden></label>`:""}</div>
   ${M.map?khoRows(["Mã CRM","Tên CRM","Mã MISA","Tên MISA","ĐVT kho","Hệ số","Ghi chú"].concat(khoCanMisa()?[""]:[]),M.map.map(r=>`<tr><td class="mono">${esc(r.crm_sku)}</td><td>${esc(r.crm_name||"—")}</td><td class="mono">${esc(r.misa_code)}</td><td>${esc(r.misa_name||"")}</td><td>${esc(r.misa_unit||"")}</td><td class="n">${knum(r.factor)}</td><td>${esc(r.note||"")}</td>${khoCanMisa()?`<td class="nowrap"><button class="lnk" data-mset="${esc(r.crm_sku)}">Sửa</button> <button class="lnk" data-mgo="${esc(r.crm_sku)}" data-mc="${esc(r.misa_code)}" style="color:#b42318">Gỡ</button></td>`:""}</tr>`)):`<p class="hint pad">Đang tải…</p>`}</section>`);
  m.querySelectorAll("[data-mgo]").forEach(b=>b.onclick=async()=>{const sku=b.dataset.mgo;
    if(!confirm("Gỡ quy đổi "+sku+" → "+b.dataset.mc+"?\n\nSau đó đơn Kênh phân phối của mã CRM này sẽ KHÔNG trừ kho cho tới khi quy đổi lại. Mã MISA "+b.dataset.mc+" xóa được nếu không còn dùng ở chỗ khác."))return;
    try{await kApi("/map/"+encodeURIComponent(sku),{method:"DELETE"});toast("Đã gỡ quy đổi "+sku);KHO.at=0;await khoLoad(true);await khoLoadMap()}catch(e){toast(e.message)}});
  m.querySelectorAll("[data-mset]").forEach(b=>b.onclick=()=>khoMapForm(b.dataset.mset));
  if($("#mp-save"))$("#mp-save").onclick=async()=>{
    try{await kApi("/cfg/b2b-from",{method:"PUT",body:JSON.stringify({date:$("#mp-d").value})});toast("Đã đặt ngày");KHO.at=0;khoLoad(true);await khoLoadMap()}catch(e){toast(e.message)}};
  if($("#mp-f"))$("#mp-f").onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(typeof XLSX==="undefined")throw new Error("Chưa tải được thư viện đọc Excel");
      const {rows,skip}=khoParseMapFile(XLSX.read(await file.arrayBuffer(),{type:"array"}));
      if(!rows.length)throw new Error("Không có dòng nào dùng được");
      if(!confirm("Nạp "+rows.length+" mã CRM vào bảng đồng bộ (thay bảng hiện tại)?"+(skip.length?"\nBỏ qua "+skip.length+" dòng: "+skip.slice(0,8).join(", ")+(skip.length>8?"…":""):"")))return;
      await kApi("/map",{method:"PUT",body:JSON.stringify({rows})});
      toast("Đã nạp "+rows.length+" mã"+(skip.length?" · bỏ qua "+skip.length:""));KHO.at=0;await khoLoad(true);await khoLoadMap();
    }catch(err){alert("Chưa nạp được: "+err.message)}finally{e.target.value=""}
  };
}

/* ---------- Nạp tồn đầu kỳ từ Excel (CEO) ----------
   File mẫu: trang 1 kê TOÀN BỘ nguyên vật liệu theo nhóm (vỏ can/chai, hộp thùng, hóa chất, tem nhãn…), điền số vào ô vàng.
   Trang 2 cho bán thành phẩm / thành phẩm / hàng hóa: chọn trong danh sách hoặc gõ tên gợi nhớ, hệ thống tự tìm mã.
   Đọc xong cho xem trước (mã lạ, tên trùng cần chọn), rồi mới ghi MỘT phiếu TD. */
const KHO_TD_GRP=["Vỏ can, chai, túi","Hộp, thùng, phụ kiện đóng gói","Hóa chất, hương liệu","Tem nhãn","NVL khác"];
const KHO_TD_COL={"Vỏ can, chai, túi":["1F6FB2","DCEBF9"],"Hộp, thùng, phụ kiện đóng gói":["C2650A","FCE9D4"],"Hóa chất, hương liệu":["2E8B57","DDF1E4"],"Tem nhãn":["7A4FB5","EBE2F7"],"NVL khác":["5F6B7A","E8EBEF"]};
function khoLoadExcelJS(){
  if(window.ExcelJS)return Promise.resolve();
  return new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";s.onload=res;s.onerror=()=>rej(new Error("Không tải được công cụ tạo file Excel, kiểm tra mạng rồi thử lại"));document.head.appendChild(s)});
}
async function khoTdTemplate(){
  await khoLoadExcelJS();
  const wb=new ExcelJS.Workbook(),thin={style:"thin",color:{argb:"FFB8C0CC"}},bd={top:thin,left:thin,bottom:thin,right:thin};
  const solid=h=>({type:"pattern",pattern:"solid",fgColor:{argb:"FF"+h}});
  const A=[...KHO.items.values()].filter(i=>i.active);
  const nvl=A.filter(i=>i.cls==="NVL"),groups=new Map();
  nvl.forEach(i=>{const g=i.grp||"NVL khác";if(!groups.has(g))groups.set(g,[]);groups.get(g).push(i)});
  const order=[...KHO_TD_GRP.filter(g=>groups.has(g)),...[...groups.keys()].filter(g=>!KHO_TD_GRP.includes(g))];
  const ws=wb.addWorksheet("NGUYEN_VAT_LIEU",{views:[{state:"frozen",ySplit:4}]});
  ws.columns=[{width:20},{width:54},{width:10},{width:18},{width:30}];
  ws.mergeCells("A1:E1");const t=ws.getCell("A1");t.value="TỒN ĐẦU KỲ — NGUYÊN VẬT LIỆU";t.font={name:"Arial",size:16,bold:true,color:{argb:"FFFFFFFF"}};t.fill=solid("1B2A49");t.alignment={vertical:"middle",horizontal:"center"};ws.getRow(1).height=30;
  ws.mergeCells("A2:E2");const h=ws.getCell("A2");h.value="Điền số lượng đếm được vào các ô MÀU VÀNG. Mã nào không có thì để trống. Không sửa cột Mã. Bán thành phẩm / thành phẩm điền ở trang BTP_TP.";h.font={name:"Arial",size:10,italic:true,color:{argb:"FF4A5568"}};h.alignment={wrapText:true,vertical:"middle"};ws.getRow(2).height=32;
  const head=ws.getRow(4);["Mã","Tên vật tư","ĐVT","Số lượng đếm được","Ghi chú"].forEach((x,i)=>{const c=head.getCell(i+1);c.value=x;c.font={name:"Arial",bold:true,color:{argb:"FFFFFFFF"}};c.fill=solid("1B2A49");c.border=bd;c.alignment={horizontal:"center",vertical:"middle"}});head.height=24;
  let r=5;
  order.forEach(g=>{
    const [dark,light]=KHO_TD_COL[g]||["5F6B7A","E8EBEF"],L=groups.get(g).sort((a,b)=>a.name.localeCompare(b.name,"vi"));
    ws.mergeCells(r,1,r,5);const b=ws.getCell(r,1);b.value=g.toUpperCase()+"  ·  "+L.length+" mã";b.font={name:"Arial",bold:true,size:12,color:{argb:"FFFFFFFF"}};b.fill=solid(dark);b.alignment={vertical:"middle"};ws.getRow(r).height=24;r++;
    L.forEach(i=>{const row=ws.getRow(r);row.getCell(1).value=i.code;row.getCell(2).value=i.name;row.getCell(3).value=i.unit;
      for(let c=1;c<=5;c++){const x=row.getCell(c);x.border=bd;x.font={name:"Arial",size:10};x.fill=solid(c===4?"FFF59D":c===5?"FFFFFF":light)}
      row.getCell(1).font={name:"Consolas",size:10};row.getCell(4).numFmt="#,##0.###";row.getCell(3).alignment={horizontal:"center"};r++});
  });
  // Trang 2: bán thành phẩm / thành phẩm / hàng hóa / công cụ, gõ tên gợi nhớ là ra.
  const dm=wb.addWorksheet("DANH_MUC",{state:"hidden"});
  const pool=A.filter(i=>["BTP","TP","HH","CCDC"].includes(i.cls)).sort((a,b)=>a.name.localeCompare(b.name,"vi"));
  pool.forEach((i,k)=>{dm.getCell(k+1,1).value=i.code+" | "+i.name});
  const w2=wb.addWorksheet("BTP_TP",{views:[{state:"frozen",ySplit:4}]});
  w2.columns=[{width:70},{width:18},{width:30}];
  w2.mergeCells("A1:C1");const t2=w2.getCell("A1");t2.value="TỒN ĐẦU KỲ — BÁN THÀNH PHẨM / THÀNH PHẨM";t2.font={name:"Arial",size:16,bold:true,color:{argb:"FFFFFFFF"}};t2.fill=solid("0F766E");t2.alignment={vertical:"middle",horizontal:"center"};w2.getRow(1).height=30;
  w2.mergeCells("A2:C2");const h2=w2.getCell("A2");h2.value="Mỗi dòng một sản phẩm: bấm vào ô cột A chọn trong danh sách, hoặc gõ tên gợi nhớ (ví dụ: nước giặt 10kg nâng mới). Hệ thống tự tìm mã; tên nào trùng nhiều mã sẽ hỏi lại khi nạp. Chỉ ghi sản phẩm có tồn.";h2.font={name:"Arial",size:10,italic:true,color:{argb:"FF4A5568"}};h2.alignment={wrapText:true,vertical:"middle"};w2.getRow(2).height=44;
  const h3=w2.getRow(4);["Mã hoặc tên gợi nhớ","Số lượng đếm được","Ghi chú"].forEach((x,i)=>{const c=h3.getCell(i+1);c.value=x;c.font={name:"Arial",bold:true,color:{argb:"FFFFFFFF"}};c.fill=solid("0F766E");c.border=bd;c.alignment={horizontal:"center",vertical:"middle"}});h3.height=24;
  for(let k=0;k<120;k++){const row=w2.getRow(5+k);for(let c=1;c<=3;c++){const x=row.getCell(c);x.border=bd;x.font={name:"Arial",size:10};x.fill=solid(c===2?"FFF59D":k%2?"EAF6F4":"FFFFFF")}
    row.getCell(2).numFmt="#,##0.###";
    if(pool.length)row.getCell(1).dataValidation={type:"list",allowBlank:true,formulae:[`DANH_MUC!$A$1:$A$${pool.length}`],showErrorMessage:false}}
  const buf=await wb.xlsx.writeBuffer(),a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));a.download="Mau_ton_dau_ky.xlsx";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
/* Tìm mã từ chữ trong ô: đúng mã, "mã | tên", hoặc tên gợi nhớ (mọi từ đều có trong tên). */
function khoTdResolve(text){
  const t=String(text).trim();if(!t)return {code:"",cands:[]};
  if(KHO.items.has(t))return {code:t,cands:[]};
  const head=t.split(" | ")[0].trim();if(t.includes(" | ")&&KHO.items.has(head))return {code:head,cands:[]};
  const ws=kfold(t).split(/\s+/).filter(Boolean),L=[];
  for(const it of KHO.items.values()){if(!it.active)continue;const hay=kfold(it.code+" "+it.name);if(ws.every(w=>hay.includes(w)))L.push(it)}
  if(L.length===1)return {code:L[0].code,cands:[]};
  L.sort((a,b)=>a.name.length-b.name.length);return {code:"",cands:L.slice(0,12)};
}
function khoParseTdFile(wb){
  const num=v=>{if(typeof v==="number")return v;const t=String(v).trim();if(!t)return NaN;return +t.replace(/\s/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",",".")};
  const isCode=c=>/^(m[ãa]( (misa|h[àa]ng|v[ậa]t t[ưu]|nvl|sp|kho))?( ho[ặa]c t[êe]n.*)?|code|sku|t[êe]n g[ợo]i nh[ớo].*)$/i.test(String(c).trim());
  const out=[];let found=false;
  wb.SheetNames.forEach(sn=>{
    const A=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:""});
    const hi=A.findIndex(r=>r.some(isCode));if(hi<0)return;found=true;
    const H=A[hi].map(c=>String(c).trim().toLowerCase()),cC=H.findIndex(isCode);
    let cQ=H.findIndex(h=>/(s[ốo] ki[ểe]m|th[ựu]c t[ếe]|t[ồo]n đ[ầa]u|t[ồo]n cu[ốo]i)/.test(h));
    if(cQ<0)cQ=H.findIndex(h=>/(s[ốo] l[ưu][ợo]ng|^sl|t[ồo]n)/.test(h));
    if(cQ<0)return;
    const cP=H.findIndex(h=>/đ[ơo]n gi[áa]/.test(h));
    A.slice(hi+1).forEach((r,i)=>{const raw=String(r[cC]).trim();if(!raw)return;
      const q=num(r[cQ]);if(!Number.isFinite(q)&&String(r[cQ]).trim()==="")return; /* dòng nhóm / ô chưa điền: bỏ qua */
      out.push({raw,qty:q,price:cP>=0?num(r[cP]):NaN,line:hi+i+2,sheet:sn})});
  });
  if(!found)throw new Error("Không thấy dòng tiêu đề có cột 'Mã' (hoặc 'Mã hoặc tên gợi nhớ') và cột 'Số lượng'");
  return out;
}
async function khoTdImport(){
  let docs=[];try{docs=(await kApi("/docs?type=TD")).filter(d=>d.status==="OK")}catch(e){}
  openDrawerHTML(`<h2>Nạp tồn đầu kỳ từ Excel</h2>
   <p class="hint">Tải file mẫu: trang <b>NGUYEN_VAT_LIEU</b> kê sẵn toàn bộ nguyên vật liệu theo nhóm, trang <b>BTP_TP</b> để chọn / gõ tên bán thành phẩm, thành phẩm. Điền số vào các ô vàng rồi chọn file lên đây. Hệ thống cho xem trước, chị kiểm lại rồi mới ghi <b>một phiếu</b>.</p>
   ${docs.length?`<div class="note amb"><b>Đã có phiếu tồn đầu kỳ:</b> ${docs.map(d=>esc(d.no)+" ("+kDd(d.doc_date)+", "+d.n_lines+" dòng)").join("; ")}. Nạp thêm sẽ <b>cộng dồn</b> vào tồn. Muốn nạp lại từ đầu thì hủy phiếu cũ trước.<div class="row7">${docs.map(d=>`<button class="btn td-cx" data-id="${d.id}" data-no="${esc(d.no)}">Hủy phiếu ${esc(d.no)}</button>`).join(" ")}</div></div>`:""}
   <div class="row7"><button class="btn pri" id="td-tpl">Tải file mẫu (có sẵn danh mục)</button><label class="btn">Chọn file Excel đã điền<input type="file" id="td-f" accept=".xlsx,.xls,.csv" hidden></label>
   <label class="field">Ngày chốt tồn<input type="date" id="td-d" value="${kToday()}"></label></div>
   <div id="td-out"></div>`);
  document.querySelectorAll(".td-cx").forEach(b=>b.onclick=async()=>{
    const r=prompt("Lý do hủy phiếu "+b.dataset.no+" (bắt buộc):");if(!r||r.trim().length<3)return;
    try{await kApi("/docs/"+b.dataset.id+"/cancel",{method:"POST",body:JSON.stringify({reason:r.trim()})});toast("Đã hủy phiếu "+b.dataset.no);KHO.at=0;await khoLoad(true);khoTdImport()}catch(e){toast(e.message)}});
  $("#td-tpl").onclick=async()=>{const b=$("#td-tpl");b.disabled=true;try{await khoTdTemplate()}catch(e){toast(e.message)}b.disabled=false};
  $("#td-f").onchange=async e=>{
    const file=e.target.files[0];if(!file)return;const out=$("#td-out");
    try{
      if(typeof XLSX==="undefined")throw new Error("Chưa tải được thư viện đọc Excel");
      const raw=khoParseTdFile(XLSX.read(await file.arrayBuffer(),{type:"array"}));
      const good=[],unknown=[],zero=[],bad=[],dup=[],amb=[],seen=new Map();
      const push=(code,r)=>{if(seen.has(code)){seen.get(code).qty+=r.qty;dup.push(r);return}const o={code,qty:r.qty,price:r.price,line:r.line};seen.set(code,o);good.push(o)};
      raw.forEach(r=>{
        if(!Number.isFinite(r.qty)||r.qty<0){bad.push(r);return}
        if(r.qty===0){zero.push(r);return}
        const m=khoTdResolve(r.raw);
        if(m.code){push(m.code,r);return}
        if(m.cands.length){amb.push({...r,cands:m.cands});return}
        unknown.push(r)});
      const sum=(a,n)=>a.length?`<div class="note amb"><b>${n}</b> (${a.length}): ${a.slice(0,12).map(r=>esc(r.raw)+" (dòng "+r.line+")").join(", ")}${a.length>12?"…":""}</div>`:"";
      out.innerHTML=`<div class="grid kpis">${kpi("Dòng ghi được",good.length)}${kpi("Cần chọn mã",amb.length)}${kpi("Không tìm ra mã",unknown.length)}${kpi("Lỗi số / bỏ qua",bad.length+zero.length)}</div>
       ${amb.length?`<section class="card flush"><div class="card-h pad"><h3>Tên gợi nhớ trùng nhiều mã, chọn đúng mã</h3></div>${tbl(["Chị ghi","Số lượng","Chọn mã đúng"],amb.map((a,i)=>`<tr><td>${esc(a.raw)}<small> dòng ${a.line}</small></td><td class="n">${knum(a.qty)}</td><td><select class="td-amb" data-i="${i}"><option value="">— chưa chọn (bỏ qua) —</option>${a.cands.map(c=>`<option value="${esc(c.code)}">${esc(c.code)} · ${esc(c.name)}</option>`).join("")}</select></td></tr>`))}</section>`:""}
       ${sum(unknown,"Không tìm ra mã nào khớp (kiểm tra lại tên hoặc thêm mã ở trang Danh mục)")}${sum(bad,"Số lượng không đọc được / âm")}${dup.length?sum(dup,"Mã lặp trong file, đã cộng gộp"):""}
       ${good.length||amb.length?`<section class="card flush">${tbl(["Mã","Tên","ĐVT","Số lượng","Tồn hiện tại","Sau khi nạp"],good.slice(0,300).map(g=>{const it=KHO.items.get(g.code);return `<tr><td class="mono">${esc(g.code)}</td><td>${esc(it.name)}</td><td>${esc(it.unit)}</td><td class="n"><b>${knum(g.qty)}</b></td><td class="n">${knum(khoStock(g.code))}</td><td class="n">${knum(khoStock(g.code)+g.qty)}</td></tr>`}))}${good.length>300?`<p class="hint pad">Đang hiện 300 / ${good.length} dòng.</p>`:""}</section>
       <div class="row7"><button class="btn pri" id="td-ok">Ghi phiếu tồn đầu kỳ</button><span class="hint" id="td-msg"></span></div>`:`<p class="hint">Không có dòng nào ghi được.</p>`}`;
      if($("#td-ok"))$("#td-ok").onclick=async()=>{
        const d=$("#td-d").value;if(!d){toast("Chọn ngày chốt tồn");return}
        const map=new Map(good.map(g=>[g.code,{...g}]));
        document.querySelectorAll(".td-amb").forEach(sel=>{const c=sel.value;if(!c)return;const a=amb[+sel.dataset.i];if(map.has(c))map.get(c).qty+=a.qty;else map.set(c,{code:c,qty:a.qty,price:a.price,line:a.line})});
        const lines=[...map.values()];if(!lines.length){toast("Chưa có dòng nào để ghi");return}
        if(!confirm("Ghi 1 phiếu tồn đầu kỳ ngày "+kDd(d)+" gồm "+lines.length+" mã"+(docs.length?"\n\nĐã có phiếu tồn đầu kỳ khác, số này sẽ CỘNG DỒN.":"")+"?"))return;
        $("#td-ok").disabled=true;
        try{
          const r=await kApi("/docs",{method:"POST",body:JSON.stringify({type:"TD",date:d,allow_more:docs.length>0,note:"Nạp từ file "+file.name,lines:lines.map(g=>({item:g.code,qty:g.qty,price:Number.isFinite(g.price)?g.price:undefined}))})});
          toast("Đã ghi phiếu "+r.no);KHO.at=0;KHO.list={};KHO.nxt=null;await khoLoad(true);khoTdImport()
        }catch(err){$("#td-ok").disabled=false;$("#td-msg").textContent=err.message}};
    }catch(err){out.innerHTML=`<div class="note red">Chưa đọc được file: ${esc(err.message)}</div>`}finally{e.target.value=""}
  };
}
PAGES.kho_map=pKhoMap;
/* ---------- Bán qua sàn (TikTok Shop, Shopee): nối thẳng Poscake, kế toán sửa bảng quy đổi ngay trên web ---------- */
const KHO_CH={TIKTOK:"TikTok Shop",SHOPEE:"Shopee",FACEBOOK:"Facebook"};
async function khoLoadOnline(){
  KHO.on=Object.assign(KHO.on||{},{busy:true});
  try{Object.assign(KHO.on,await kApi("/online"));KHO.src=await kApi("/online/source")}catch(e){toast(e.message);KHO.on.runs=KHO.on.runs||[];KHO.on.unmapped=KHO.on.unmapped||[];KHO.src=KHO.src||[]}
  KHO.on.busy=false;if(PAGE==="kho_online"||PAGE==="kho_qd")renderMain();
}
async function khoLoadChannel(ch){
  KHO.chd=KHO.chd||{};KHO.chd[ch]={busy:true};
  try{const rg=khoRange(KHO.onForm||{});const rq="&from="+rg.from+"&to="+rg.to;const [combos,map,recon]=await Promise.all([kApi("/online/combos?channel="+ch),kApi("/online/map?channel="+ch),kApi("/online/sheet?channel="+ch+rq)]);KHO.chd[ch]={combos,map,recon}}
  catch(e){toast(e.message);KHO.chd[ch]={combos:[],map:[],recon:null}}
  if(PAGE==="kho_online"||PAGE==="kho_qd")renderMain();
}
/* Đọc tab "Hàng lẻ theo ngày": dán từ Sheet (cột cách nhau bằng tab) hoặc mảng dòng từ file Excel. */
function khoParseOnline(A){
  const hi=A.findIndex(r=>r.some(c=>/^s[ảa]n ph[ẩa]m l[ẻe]/i.test(String(c).trim())));
  if(hi<0)throw new Error("Không thấy dòng tiêu đề. Cần copy cả tab 'Hàng lẻ theo ngày' (có dòng Ngày gửi / Sản phẩm lẻ / Số lượng xuất).");
  const H=A[hi].map(c=>String(c).trim().toLowerCase()),ix=re=>H.findIndex(h=>re.test(h));
  const cD=ix(/^ng[àa]y/),cL=ix(/^s[ảa]n ph[ẩa]m l[ẻe]/),cQ=ix(/^s[ốo] l[ưu][ợo]ng/),cO=ix(/^s[ốo] đ[ơo]n/);
  if(cD<0||cL<0||cQ<0)throw new Error("Thiếu cột Ngày gửi / Sản phẩm lẻ / Số lượng xuất");
  const toDay=v=>{
    if(typeof v==="number"&&v>30000){const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*864e5);return d.toISOString().slice(0,10)}
    const s=String(v).trim();let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
    m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[0]:null};
  const num=v=>typeof v==="number"?v:parseFloat(String(v).trim().replace(",","."));
  const days=new Map();let skipped=0;
  A.slice(hi+1).forEach(r=>{
    const day=toDay(r[cD]),label=String(r[cL]||"").trim(),qty=num(r[cQ]);
    if(!day||!label||!(qty>0)){if(label||String(r[cD]).trim())skipped++;return}
    if(!days.has(day))days.set(day,{day,orders:null,lines:[]});
    days.get(day).lines.push({label,qty});
    if(cO>=0){const o=num(r[cO]);if(o>0)days.get(day).orders=(days.get(day).orders||0)+o}
  });
  return {days:[...days.values()].sort((a,b)=>a.day.localeCompare(b.day)),skipped};
}
/* Đọc tab "Quy đổi combo" của Sheet cũ: Mã SKU | [Phân loại] | Tên trên đơn | Sản phẩm lẻ | SL / 1 combo | Ghi chú. Dòng bỏ trống mã SKU là dòng tiếp theo của combo trước. */
/* Đọc tab "Đơn đã gửi" của Sheet kế toán kho: Ngày gửi | Giờ gửi | (Shop/Nguồn) | Mã đơn … | Mã SKU / Sản phẩm trên đơn | Phân loại | (Tên) | Số lượng. */
function khoParseLines(A){
  const hi=A.findIndex(r=>r.some(c=>/^ng[àa]y g[ửu]i/i.test(String(c).trim())));
  if(hi<0)throw new Error("Không thấy dòng tiêu đề 'Ngày gửi'. Cần copy cả tab 'Đơn đã gửi'.");
  const H=A[hi].map(c=>String(c).trim().toLowerCase()),ix=re=>H.findIndex(h=>re.test(h));
  const cD=ix(/^ng[àa]y g[ửu]i/),cT=ix(/^gi[ờo] g[ửu]i/),cS=ix(/^shop|^ngu[ồo]n [đd][ơo]n/),cO=ix(/^m[ãa] [đd][ơo]n/),cK=ix(/^m[ãa] sku|^s[ảa]n ph[ẩa]m tr[êe]n [đd][ơo]n/),cV=ix(/^ph[âa]n lo[ạa]i/),cN=ix(/^t[êe]n tr[êe]n [đd][ơo]n/),cQ=ix(/^s[ốo] l[ượu][ợo]?ng/);
  if(cD<0||cO<0||cK<0||cQ<0)throw new Error("Thiếu cột Ngày gửi / Mã đơn / Mã SKU / Số lượng");
  const toDay=v=>{const s=String(v||"").trim();let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[0]:""};
  const by=new Map();
  A.slice(hi+1).forEach(r=>{const day=toDay(r[cD]),oid=String(r[cO]||"").trim(),sku=String(r[cK]||"").trim(),q=parseFloat(String(r[cQ]||"").replace(",","."));
    if(!day||!oid||!sku||!(q>0))return;
    const t=cT>=0?String(r[cT]||"").trim():"";
    const L=by.get(day)||[];L.push({order_id:oid,shipped_at:/^\d{1,2}:\d{2}$/.test(t)?day+"T"+t.padStart(5,"0")+":00+07:00":"",shop:cS>=0?String(r[cS]||"").trim():"",sku,variant:cV>=0?String(r[cV]||"").trim():"",name:cN>=0?String(r[cN]||"").trim():sku,qty:q});by.set(day,L)});
  return [...by].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,lines])=>({day,lines}));
}
function khoParseMap(A){
  const hi=A.findIndex(r=>r.some(c=>/^m[ãa] sku|^s[ảa]n ph[ẩa]m tr[êe]n [đd][ơo]n/i.test(String(c).trim())));
  if(hi<0)throw new Error("Không thấy dòng tiêu đề 'Mã SKU'. Cần copy cả tab 'Quy đổi combo'.");
  const H=A[hi].map(c=>String(c).trim().toLowerCase()),ix=re=>H.findIndex(h=>re.test(h));
  const cS=ix(/^m[ãa] sku|^s[ảa]n ph[ẩa]m tr[êe]n [đd][ơo]n/),cV=ix(/^ph[âa]n lo[ạa]i/),cI=ix(/^s[ảa]n ph[ẩa]m l[ẻe]/),cQ=ix(/^sl/),cN=ix(/^ghi ch/);
  if(cS<0||cI<0)throw new Error("Thiếu cột Mã SKU / Sản phẩm lẻ");
  const rows=[];let lastS="",lastV="";
  A.slice(hi+1).forEach(r=>{
    const s=String(r[cS]||"").trim(),v=cV>=0?String(r[cV]||"").trim():"",item=String(r[cI]||"").trim();
    if(s){lastS=s;lastV=v}
    const sku=s||lastS,variant=s?v:lastV;
    if(!sku||!item)return;
    const q=parseFloat(String(cQ>=0?r[cQ]:1).replace(",","."));
    rows.push({sku,variant,item_label:item,qty:q>0?q:1,note:cN>=0?String(r[cN]||"").replace(/^Nháp[^.]*\.?\s*/,""):""});
  });
  return rows;
}
function khoOnTab(S){return S.tab&&S.tab!=="ALL"?S.tab:"ALL"}
/* Thống kê nhanh: 7 ngày gần nhất theo từng kênh + sản phẩm bán nhiều nhất 14 ngày. */
function khoOnStats(O){
  const RG=KHO.onRange&&KHO.onRange.data,runs=RG?RG.runs:(O.runs||[]);if(!runs.length&&!(O.top||[]).length&&!RG)return "";
  const CH=["TIKTOK","SHOPEE","FACEBOOK"],SH={TIKTOK:"TikTok",SHOPEE:"Shopee",FACEBOOK:"Facebook"};
  const days=[...new Set(runs.map(r=>r.day))].sort().reverse().slice(0,RG?400:14);
  const get=(d,c)=>runs.find(r=>r.day===d&&r.channel===c)||{orders:0,qty:0,unmapped_qty:0};
  const tot=(d,c)=>(+get(d,c).qty||0)+(+get(d,c).unmapped_qty||0);
  const last7=days.slice(0,7),sum=f=>last7.reduce((s,d)=>s+f(d),0);
  const un=sum(d=>CH.reduce((s,c)=>s+(+get(d,c).unmapped_qty||0),0));
  const kpis=`<div class="grid kpis">${CH.map(c=>kpi("Đơn "+SH[c]+" (7 ngày)",knum(sum(d=>+get(d,c).orders||0)))).join("")}${kpi("Sản phẩm lẻ bán (7 ngày)",knum(sum(d=>CH.reduce((s,c)=>s+tot(d,c),0))))}${kpi("Chưa có mã vật tư",knum(un))}</div>`;
  const matrix=days.length?`<section class="card flush"><div class="card-h pad"><h2>Bán theo ngày</h2><span class="hint">Ngày tính theo giờ "đã gửi hàng". <b>Bấm vào một ngày để xem và in phiếu xuất của ngày đó.</b></span></div>
   <div class="filters pad" style="padding-top:0"><label class="inl">Từ ngày <input type="date" id="rg-f" value="${esc((KHO.onRange&&KHO.onRange.from)||"")}"></label><label class="inl">Đến ngày <input type="date" id="rg-t" value="${esc((KHO.onRange&&KHO.onRange.to)||"")}"></label><button class="btn" id="rg-go">Lọc</button><button class="btn" id="rg-7">7 ngày</button><button class="btn" id="rg-30">30 ngày</button><button class="btn" id="rg-clr">Bỏ lọc</button><button class="btn pri" id="rg-x">Tải báo cáo xuất theo ngày</button></div><div style="overflow:auto">${tbl(["Ngày"].concat(...CH.map(c=>[SH[c]+": đơn",SH[c]+": sản phẩm"]),["Tổng sản phẩm","Chưa có mã"]),days.map(d=>{const u=CH.reduce((s,c)=>s+(+get(d,c).unmapped_qty||0),0);return `<tr class="clk" data-dayv="${d}" title="Bấm để xem phiếu xuất trong ngày"><td>${kDd(d)}</td>${CH.map(c=>`<td class="n">${knum(get(d,c).orders||0)}</td><td class="n">${knum(tot(d,c))}</td>`).join("")}<td class="n"><b>${knum(CH.reduce((s,c)=>s+tot(d,c),0))}</b></td><td class="n">${u?"<b>"+knum(u)+"</b>":"0"}</td></tr>`}))}</div></section>`:"";
  const by=new Map();(O.top||[]).forEach(r=>{const x=by.get(r.code)||{code:r.code,name:r.name||r.code,unit:r.unit||"",TIKTOK:0,SHOPEE:0,FACEBOOK:0};x[r.channel]=+r.qty||0;by.set(r.code,x)});
  const T=r=>CH.reduce((s,c)=>s+(r[c]||0),0);
  const top=[...by.values()].sort((a,b)=>T(b)-T(a)).slice(0,15);
  const topT=top.length?`<section class="card flush"><div class="card-h pad"><h2>Sản phẩm bán nhiều nhất (14 ngày)</h2><span class="hint">Chỉ tính phần đã có mã vật tư.</span></div>${tbl(["Mã","Sản phẩm","ĐVT"].concat(CH.map(c=>SH[c]),["Tổng"]),top.map(r=>`<tr><td class="mono">${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.unit)}</td>${CH.map(c=>`<td class="n">${knum(r[c]||0)}</td>`).join("")}<td class="n"><b>${knum(T(r))}</b></td></tr>`))}</section>`:"";
  return kpis+matrix+topT;
}
/* Đối soát theo luồng: ① đơn trên sàn → ② quy đổi từng mã sàn (theo quy tắc nào) → ③ cộng theo mã vật tư = số trừ kho.
   Mỗi bước đều bấm ngược về được: mã vật tư → mã sàn nào góp vào; mã sàn → từng đơn. */
function khoReconCard(R,rd,runs){
  const wd=d=>["CN","T2","T3","T4","T5","T6","T7"][new Date(d+"T00:00:00").getDay()];
  const opts=[...(runs||[]).map(r=>[r.day,wd(r.day)+" "+kDd(r.day)+" · "+(r.orders==null?"?":r.orders)+" đơn"]),["7","7 ngày gần nhất"],["14","14 ngày gần nhất"],["30","30 ngày gần nhất"]];
  const sel=`<label class="inl">Xem <select id="rc-d"><option value=""${rd?"":" selected"}>Ngày gần nhất có đơn</option>${opts.map(([v,t])=>`<option value="${v}"${String(rd)===v?" selected":""}>${esc(t)}</option>`).join("")}</select></label>`;
  if(!R)return `<section class="card"><div class="card-h"><h2>Đối soát</h2></div><p class="hint">Đang tải…</p></section>`;
  const rows=(R.rows||[]).slice().sort((a,b)=>((b.flags||[]).length>0)-((a.flags||[]).length>0)||b.qty-a.qty),items=R.items||[];
  const idx=new Map((R.rows||[]).map((r,i)=>[r,i]));
  const inKho=label=>{if(!KHO.items)return true;const c=String(label).split(" - ")[0].trim();return !!(KHO.items&&(KHO.items.get(c)||[...KHO.items.keys()].some(x=>x.toLowerCase()===c.toLowerCase())))};
  const period=R.from===R.to?wd(R.to)+" "+kDd(R.to):kDd(R.from)+" → "+kDd(R.to);
  const box=(t,b)=>`<div class="kpi"><div class="hint">${t}</div><div style="font-size:1.4em;font-weight:700">${b}</div></div>`;
  const step=(n,t,h)=>`<h3 class="pad" style="margin-top:18px">${n} ${t}</h3>${h?`<p class="hint pad">${h}</p>`:""}`;
  /* ② từng mã sàn */
  const rule=r=>r.rule==="NONE"?`<span class="tag amb">Chưa có quy tắc</span>`
    :r.to.every(x=>x.label.trim().toUpperCase()==="BỎ QUA")?`<span class="tag amb">Bỏ qua, không trừ kho</span>`
    :`1 ${r.rule==="DIRECT"?"cái":"combo"} = ${r.to.filter(x=>x.label.trim().toUpperCase()!=="BỎ QUA").map(x=>"<b>"+knum(x.qty)+"</b> "+esc(x.label)).join(" + ")}<br><span class="hint">${r.rule==="DIRECT"?"Mã sàn trùng mã vật tư nên tự tính 1 đổi 1":"Theo bảng quy đổi"+(r.from_day?", bản áp dụng từ "+kDd(r.from_day):"")}</span>`;
  const res=r=>r.rule==="NONE"?`<span class="tag amb">${knum(r.qty)} chưa trừ kho</span>`
    :r.to.filter(x=>x.label.trim().toUpperCase()!=="BỎ QUA").map(x=>`${esc(x.label)}: ${knum(r.qty)} × ${knum(x.qty)} = <b>${knum(r.qty*x.qty)}</b>${inKho(x.label)?"":" <span class='tag amb'>mã chưa có trong danh mục kho, chưa trừ</span>"}`).join("<br>")||"—";
  const tr2=r=>{const i=idx.get(r);return `<tr><td><b class="mono">${esc(r.sku)}</b>${r.variant?"<br>Phân loại: "+esc(r.variant):""}<br><span class="hint">${esc(r.name||"")}</span></td>
    <td class="n"><b>${knum(r.qty)}</b><br><span class="hint">${knum(r.orders)} đơn</span><br><button class="btn sm rc-o" data-i="${i}">Xem đơn</button></td>
    <td style="text-align:center">→</td><td>${rule(r)}</td><td style="text-align:center">→</td><td>${res(r)}${(r.flags||[]).filter(f=>f!=="Chưa quy đổi"&&!f.startsWith("Đang bỏ qua")).map(f=>"<br><span class='tag amb'>"+esc(f)+"</span>").join("")}</td></tr>
    <tr><td colspan="6" class="rc-ol" data-i="${i}" hidden></td></tr>`};
  const t2=`<div style="overflow:auto"><table class="tbl"><thead><tr><th>Mã trên sàn</th><th class="n">Bán</th><th></th><th>Quy tắc quy đổi</th><th></th><th>Ra sản phẩm lẻ</th></tr></thead><tbody>${rows.map(tr2).join("")}</tbody></table></div>`;
  /* ③ cộng theo mã vật tư */
  const tr3=(it,i)=>{const ok=!it.unmapped&&inKho(it.label);const parts=(it.from||[]).slice().sort((a,b)=>b.out-a.out);
    return `<tr class="rc-b" data-i="${i}" style="cursor:pointer"><td>${ok?"":"<span class='tag amb'>Chưa trừ</span> "}<b>${esc(it.label)}</b></td>
    <td>${parts.slice(0,4).map(f=>knum(f.out)+" <span class='hint'>("+esc(f.sku)+")</span>").join(" + ")}${parts.length>4?` + … <span class="hint">(${parts.length} mã sàn, bấm để xem đủ)</span>`:""}</td><td class="n">= <b>${knum(it.total)}</b></td></tr>
    <tr class="rc-bd" data-i="${i}" hidden><td colspan="3"><table class="tbl"><thead><tr><th>Mã trên sàn</th><th>Phân loại</th><th class="n">Bán</th><th class="n">× mỗi combo</th><th class="n">= Ra</th></tr></thead><tbody>${parts.map(f=>`<tr><td class="mono">${esc(f.sku)}</td><td>${esc(f.variant||"—")}</td><td class="n">${knum(f.sold)}</td><td class="n">${knum(f.per)}</td><td class="n"><b>${knum(f.out)}</b></td></tr>`).join("")}<tr><td colspan="4"><b>Cộng</b></td><td class="n"><b>${knum(it.total)}</b></td></tr></tbody></table></td></tr>`};
  const okItems=items.filter(it=>!it.unmapped&&inKho(it.label)),badItems=items.filter(it=>!(!it.unmapped&&inKho(it.label)));
  const sum=a=>a.reduce((s,x)=>s+(+x.total||0),0);
  const t3=`<div style="overflow:auto"><table class="tbl"><thead><tr><th>Mã vật tư</th><th>Cộng từ các mã sàn</th><th class="n">Trừ kho</th></tr></thead><tbody>${okItems.map(it=>tr3(it,items.indexOf(it))).join("")}${badItems.map(it=>tr3(it,items.indexOf(it))).join("")}</tbody></table></div>`;
  return `<section class="card flush"><div class="card-h pad"><h2>Đối soát · ${esc(period)}</h2><div class="filters">${sel}<button class="btn sm" id="rc-csv">Tải về (CSV)</button></div></div>
   ${step("①","Đơn trên sàn","Lấy từ Poscake: đơn đã gửi đi trong ngày. Số đơn này để so với màn hình Poscake cùng ngày.")}
   <div class="grid kpis pad">${box("Số đơn",knum(R.orders))}${box("Số mã sàn khác nhau",knum((R.rows||[]).length))}${box("Tổng số lượng trên đơn",knum(R.raw_qty))}</div>
   ${step("②","Quy đổi từng mã sàn ra sản phẩm lẻ","Mỗi dòng: bán bao nhiêu → quy tắc nào → ra bao nhiêu sản phẩm lẻ. Dòng chưa có quy tắc hoặc đáng ngờ xếp lên đầu. Bấm “Xem đơn” để thấy từng mã đơn.")}
   ${rows.length?t2:`<p class="hint pad">Không có đơn trong kỳ này.</p>`}
   ${step("③","Cộng theo mã vật tư = số trừ kho","Mỗi mã vật tư bằng tổng các phần từ bước ②. Bấm một dòng để xem đủ bảng cộng.")}
   <div class="grid kpis pad">${box("Trừ kho",knum(sum(okItems)))}${box("Chưa trừ (thiếu quy tắc / thiếu mã)",knum(sum(badItems)))}</div>
   ${items.length?t3:`<p class="hint pad">Không có số liệu.</p>`}</section>`;
}
/* Đối soát: trình bày y như Sheet kế toán kho cũ (cùng tên tab, cùng cột). */
/* ---------- Chọn khoảng ngày: Hôm nay, Hôm qua, 7 ngày qua... hoặc tự chọn từ - đến ---------- */
const KHO_PRESETS=[["today","Hôm nay"],["yesterday","Hôm qua"],["d7","7 ngày qua"],["d30","30 ngày qua"],["d90","90 ngày qua"],["lastmonth","Tháng trước"],["week","Đầu tuần đến nay"],["month","Đầu tháng đến nay"]];
const khoVnToday=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
const khoAddDay=(d,n)=>{const x=new Date(d+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
function khoPresetRange(k){
  const t=khoVnToday(),dow=(new Date(t+"T00:00:00Z").getUTCDay()+6)%7;
  if(k==="today")return {from:t,to:t};
  if(k==="yesterday"){const y=khoAddDay(t,-1);return {from:y,to:y}}
  if(k==="d7")return {from:khoAddDay(t,-6),to:t};
  if(k==="d30")return {from:khoAddDay(t,-29),to:t};
  if(k==="d90")return {from:khoAddDay(t,-89),to:t};
  if(k==="week")return {from:khoAddDay(t,-dow),to:t};
  if(k==="month")return {from:t.slice(0,8)+"01",to:t};
  if(k==="lastmonth"){const f=t.slice(0,8)+"01",e=khoAddDay(f,-1);return {from:e.slice(0,8)+"01",to:e}}
  return {from:khoAddDay(t,-6),to:t}}
const khoRange=S=>{if(S.rg&&S.rg.from&&S.rg.to)return S.rg;const r=khoPresetRange("d7");return Object.assign({preset:"d7"},r)};
const khoRangeLabel=r=>{const p=KHO_PRESETS.find(x=>x[0]===r.preset);return (p?p[1]+" · ":"")+kDd(r.from)+(r.from===r.to?"":" – "+kDd(r.to))};
function khoRangeBind(S,tab){
  const btn=$("#rc-btn");if(!btn)return;
  const presets=KHO_PRESETS.map(([key,t])=>[key,t,()=>khoPresetRange(key)]);
  btn.onclick=e=>{e.stopPropagation();const rg=khoRange(S);drpOpen(btn,rg,presets,async r=>{S.rg={preset:r.preset,from:r.from,to:r.to};await khoLoadChannel(tab)})};
}
function khoSheetView(V,S,runs,ch,X){
  X=X||{};
  const wd=d=>["CN","T2","T3","T4","T5","T6","T7"][new Date(d+"T00:00:00").getDay()];
  const rg=khoRange(S);
  const sel=`<span class="inl rcw" style="display:inline-flex;align-items:center;gap:8px;margin:0"><button type="button" class="btn rcbtn" id="rc-btn">📅 ${esc(khoRangeLabel(rg))} ▾</button></span>`;
  const st0=S.st||"pivot",st=st0==="detail"?(S.dv==="raw"?"raw":S.dv==="orders"?"orders":"daily"):st0==="setup"?"map":st0;
  const tabKey=st==="raw"||st==="daily"||st==="orders"?"detail":st;
  const TABS=[["pivot","Tổng hợp"],["vouchers","Phiếu xuất theo ngày"],["detail","Chi tiết"],["missing","Cần xử lý"],["map","Quy đổi & cài đặt"]].filter(t=>t[0]!=="map"||!(typeof OPSV==="function"&&OPSV()));
  const dataTab=["pivot","vouchers","daily","raw","orders"].includes(st);
  const nav=`<nav class="settabs">${TABS.map(([k,t])=>`<button class="${k===tabKey?"on":""}" data-st="${k}">${t}${k==="missing"&&X.nMissing?" ("+X.nMissing+")":""}</button>`).join("")}</nav>`;
  const head=dataTab?`<div class="card-h pad"><h2>${st==="pivot"?"Tổng hợp theo sản phẩm lẻ":st==="daily"?"Chi tiết theo sản phẩm lẻ":st==="orders"?"Số đơn theo "+(ch==="FACEBOOK"?"nguồn đơn":"shop"):"Chi tiết theo đơn"}</h2><div class="filters">${sel}<button class="btn sm" id="rc-csv">Tải tab này (CSV)</button></div></div>`:`<div class="card-h pad"><h2>${KHO_CH[ch]}</h2></div>`;
  if(!dataTab)return nav+(st==="map"?(X.map||"")+(X.setup||""):(X[st]||""));
  if(!V)return `${nav}<section class="card flush">${head}<p class="hint pad">Đang tải…</p></section>`;
  const T=(h,rows)=>`<div style="overflow:auto"><table class="tbl"><thead><tr>${h.map(x=>`<th${x[1]?' class="n"':""}>${esc(x[0])}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  const n=v=>`<td class="n">${knum(v)}</td>`;
  const shopH=ch==="FACEBOOK"?"Nguồn đơn":"Shop";
  const vn=s=>s?new Date(Date.parse(s)+7*3600e3).toISOString().slice(11,16):"";
  const un=s=>String(s).startsWith("[Chưa quy đổi]")||!!(X.noMisa&&X.noMisa.has(s));
  let body="",note="";
  const sw=(st==="daily"||st==="raw"||st==="orders")?`<div class="pad" style="padding-bottom:0">Xem: ${[["daily","Theo sản phẩm lẻ"],["orders",ch==="FACEBOOK"?"Theo nguồn đơn":"Theo shop"],["raw","Theo đơn"]].map(([v,t])=>`<a href="#" data-dv="${v}" style="${st===v?"font-weight:700;text-decoration:none":""}">${t}</a>`).join(" · ")}</div>`:"";
  if(!(V.lines||[]).length&&!(V.daily||[]).length){const sd=V.start_day;return `${nav}<section class="card flush">${head}<p class="pad">${sd?`Chưa có số. ${KHO_CH[ch]} chỉ tính từ <b>${kDd(sd)}</b>: trước ngày đó Poscake đã đồng bộ lại toàn bộ đơn nên giờ gửi hàng của đơn cũ không còn đúng. Mỗi sáng 7 giờ web tự kéo ngày hôm trước, nên số ngày ${kDd(sd)} sẽ có vào sáng hôm sau. Số các ngày trước đó vẫn lấy từ Sheet cũ.`:"Chưa có đơn trong khoảng ngày này."}</p></section>`}
  if(st==="raw"){
    const q=kfold(S.rq||"").trim(),L=(V.lines||[]).filter(l=>!q||kfold(l.order_id+" "+l.sku+" "+l.variant+" "+l.name).includes(q));
    note="Mỗi dòng là một sản phẩm trên một đơn đã gửi, lấy thẳng từ Poscake. Gõ mã đơn hoặc mã SKU để tìm.";
    body=`<div class="filters pad"><input id="rc-q" placeholder="Tìm mã đơn, mã SKU, tên" value="${esc(S.rq||"")}"> <span class="hint">${knum(L.length)} dòng</span></div>`
      +T([["Ngày gửi"],["Giờ gửi"],[shopH],["Mã đơn"],["Mã SKU"],["Phân loại"],["Tên trên đơn"],["Số lượng",1]],L.map(l=>`<tr><td>${kDd(l.day)}</td><td>${vn(l.shipped_at)}</td><td>${esc(l.shop||"")}</td><td class="mono">${esc(l.order_id)}</td><td class="mono">${esc(l.sku)}</td><td>${esc(l.variant||"")}</td><td>${esc(l.name||"")}</td>${n(l.qty)}</tr>`));
  }else if(st==="orders"){
    note="Số đơn đã gửi mỗi ngày theo shop. Dùng để so với màn hình Poscake.";
    body=T([["Ngày gửi"],[shopH],["Số đơn đã gửi",1],["Tổng số sản phẩm (chưa tách combo)",1]],(V.orders||[]).map(o=>`<tr><td>${wd(o.day)} ${kDd(o.day)}</td><td>${esc(o.shop||"")}</td>${n(o.orders)}${n(o.qty)}</tr>`));
  }else if(st==="daily"){
    note="Sau khi tách combo theo tab Quy đổi combo: mỗi ngày, mỗi shop xuất bao nhiêu sản phẩm lẻ. Các dòng tô màu xếp ở cuối là chưa trừ kho: “[Chưa quy đổi]” là mã chưa có trong tab Quy đổi combo; dòng còn lại là tên chưa có mã MISA. Xử lý cả hai ở tab Mã cần bổ sung.";
    body=T([["Ngày gửi"],[shopH],["Mã MISA"],["Tên sản phẩm"],["Số lượng xuất",1],["Số đơn",1]],(V.daily||[]).slice().sort((a,b)=>un(a.item)-un(b.item)||a.day.localeCompare(b.day)||a.item.localeCompare(b.item)).map(d=>`<tr${un(d.item)?' style="background:#fff4e0"':""}><td>${kDd(d.day)}</td><td>${esc(d.shop||"")}</td>${khoCodeTd(d.item)}${n(d.qty)}${n(d.orders)}</tr>`));
  }else if(st==="vouchers"){
    note="";
    const CD={TIKTOK:"TT",SHOPEE:"SP",FACEBOOK:"FB"}[ch]||"XX",od={};
    (V.orders||[]).forEach(o=>{od[o.day]=(od[o.day]||0)+o.orders});
    const byDay=new Map();
    (V.daily||[]).forEach(d=>{if(un(d.item))return;const x=byDay.get(d.day)||{day:d.day,items:new Map()};x.items.set(d.item,(x.items.get(d.item)||0)+d.qty);byDay.set(d.day,x)});
    const days=[...byDay.values()].sort((a,b)=>b.day.localeCompare(a.day));
    S.vch={ch,CD,days:days.map(x=>({day:x.day,no:"XL-"+CD+"-"+x.day.replace(/-/g,""),orders:od[x.day]||0,lines:[...x.items].map(([item,qty])=>({item,qty})).sort((a,b)=>a.item.localeCompare(b.item))}))};
    body=days.length?T([["Số phiếu"],["Ngày xuất"],["Số mặt hàng",1],["Tổng số lượng",1],["Số đơn",1],[""]],S.vch.days.map((v,i)=>`<tr class="clk" data-vch="${i}"><td class="mono"><b>${v.no}</b></td><td>${kDd(v.day)}</td>${n(v.lines.length)}${n(v.lines.reduce((s,l)=>s+l.qty,0))}${n(v.orders)}<td class="nowrap"><button class="btn sm" data-vch="${i}">Xem phiếu</button></td></tr>`)):`<p class="hint pad">Không có ngày nào có hàng xuất trong khoảng này.</p>`;
  }else if(st==="pivot"){
    note="Mỗi ô là số sản phẩm lẻ xuất trong ngày (đã tách combo), cộng các shop. Dòng đầu là số đơn đã gửi để so với Poscake. Dòng tô màu là chưa trừ kho (xử lý ở tab Cần xử lý).";
    const od={};(V.orders||[]).forEach(o=>{od[o.day]=(od[o.day]||0)+o.orders});
    const days=[...new Set((V.daily||[]).map(d=>d.day))].sort(),P=new Map();
    (V.daily||[]).forEach(d=>{const x=P.get(d.item)||{item:d.item,t:0,by:{}};x.by[d.day]=(x.by[d.day]||0)+d.qty;x.t+=d.qty;P.set(d.item,x)});
    const rows=[...P.values()].sort((a,b)=>un(a.item)-un(b.item)||a.item.localeCompare(b.item));
    const tot={};days.forEach(d=>tot[d]=rows.filter(r=>!un(r.item)).reduce((s,r)=>s+(r.by[d]||0),0));
    body=T([["Mã MISA"],["Tên sản phẩm"],...days.map(d=>[d.slice(8,10)+"/"+d.slice(5,7),1]),["Tổng",1]],[`<tr style="background:#f3f4f6"><td colspan="2"><b>Số đơn đã gửi</b></td>${days.map(d=>`<td class="n"><b>${knum(od[d]||0)}</b></td>`).join("")}<td class="n"><b>${knum(days.reduce((s,d)=>s+(od[d]||0),0))}</b></td></tr>`].concat(rows.map(r=>`<tr${un(r.item)?' style="background:#fff4e0"':""}>${khoCodeTd(r.item)}${days.map(d=>`<td class="n">${r.by[d]?knum(r.by[d]):""}</td>`).join("")}<td class="n"><b>${knum(r.t)}</b></td></tr>`)).concat([`<tr><td colspan="2"><b>Cộng (đã có mã)</b></td>${days.map(d=>`<td class="n"><b>${knum(tot[d])}</b></td>`).join("")}<td class="n"><b>${knum(days.reduce((s,d)=>s+tot[d],0))}</b></td></tr>`]));
  }else{
    note="Mã SKU đã bán nhưng chưa có trong tab Quy đổi combo nên chưa trừ kho. Bổ sung ở tab "+KHO_CH[ch]+" › Cần xử lý.";
    body=(V.missing||[]).length?T([["Mã SKU"],["Phân loại"],["Tên trên đơn"],["Gặp lần đầu"],["Số lượng chưa quy đổi",1]],V.missing.map(m=>`<tr><td class="mono">${esc(m.sku)}</td><td>${esc(m.variant||"")}</td><td>${esc(m.name||"")}</td><td>${kDd(m.first)}</td>${n(m.qty)}</tr>`)):`<p class="hint pad">Không có mã nào cần bổ sung trong khoảng ngày này.</p>`;
  }
  const sd=(V.sheet_days||[]).length?`<p class="hint pad">Các ngày ${V.sheet_days.slice().sort().map(kDd).join(", ")} lấy theo số Sheet đã tách sẵn (Poscake ngày đó không tin được), nên không có chi tiết từng đơn trên web.</p>`:"";
  return `${nav}<section class="card flush">${head}${sw}${sd}${body}</section>`;
}
function khoSheetCsv(V,S,ch){
  const st=S.st==="detail"?(S.dv==="raw"?"raw":S.dv==="orders"?"orders":"daily"):"daily",q=s=>'"'+String(s==null?"":s).replace(/"/g,'""')+'"';let rows=[];
  if(st==="raw")rows=[["Ngày gửi","Shop","Mã đơn","Mã SKU","Phân loại","Tên trên đơn","Số lượng"]].concat((V.lines||[]).map(l=>[l.day,l.shop,l.order_id,l.sku,l.variant,l.name,l.qty]));
  else if(st==="orders")rows=[["Ngày gửi","Shop","Số đơn đã gửi","Tổng số sản phẩm (chưa tách combo)"]].concat((V.orders||[]).map(o=>[o.day,o.shop,o.orders,o.qty]));
  else if(st==="missing")rows=[["Mã SKU","Phân loại","Tên trên đơn","Gặp lần đầu","Số lượng chưa quy đổi"]].concat((V.missing||[]).map(m=>[m.sku,m.variant,m.name,m.first,m.qty]));
  else rows=[["Ngày gửi","Shop","Mã MISA","Tên sản phẩm","Số lượng xuất","Số đơn"]].concat((V.daily||[]).map(d=>[d.day,d.shop,khoSplit(d.item).code,khoSplit(d.item).name,d.qty,d.orders]));
  const blob=new Blob(["﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="doi-soat-"+ch+"-"+st+"-"+(V.to||"")+".csv";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
function khoReconCsv(R,ch){
  const days=R.days||[],q=s=>'"'+String(s==null?"":s).replace(/"/g,'""')+'"';
  const out=[["Mã vật tư (đã quy đổi)"].concat(days,["Tổng"]).map(q).join(",")];
  (R.items||[]).forEach(it=>out.push([it.label].concat(days.map(d=>(it.by_day||{})[d]||0),[it.total]).map(q).join(",")));
  out.push("");
  out.push(["Mã sàn","Phân loại","Tên"].concat(days,["Tổng","Quy ra"]).map(q).join(","));
  (R.rows||[]).forEach(r=>out.push([r.sku,r.variant,r.name].concat(days.map(d=>(r.by_day||{})[d]||0),[r.qty,r.rule==="NONE"?"CHƯA QUY ĐỔI":r.to.map(x=>x.label+" x"+x.qty).join(" + ")]).map(q).join(",")));
  const blob=new Blob(["﻿"+out.join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="doi-soat-"+ch+"-"+(R.to||"")+".csv";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
/* Dưới tên chưa có mã: những mã sàn (SKU + phân loại) đang dùng tên đó, để kế toán biết đó là sản phẩm nào trên sàn. */
function khoSkuNote(u){
  const S=u.skus||[];
  const loai=/lo[ạa]i theo đ[ơo]n/i.test(u.label||"");
  if(!S.length&&!loai)return "";
  return `<div class="hint" style="margin-top:4px">${S.length?"Mã sàn đang dùng tên này: "+S.map(s=>"<b class='mono'>"+esc(s.sku)+"</b>"+(s.variant?" ("+esc(s.variant)+")":"")).join("; "):""}${loai?"<br>“Loại theo đơn” nghĩa là khách tự chọn loại / hương khi đặt, nên chỉ chọn được một mã mặc định cho tên này (chọn loại bán nhiều nhất).":""}</div>`;
}
/* "AILLATLGSX - Tẩy lồng…" → {code:"AILLATLGSX", name: tên trong Danh mục kho}. Nhãn chưa có mã MISA: code rỗng, name = cả nhãn. */
function khoSplit(label){
  const s=String(label||"").trim();if(!s||/^\[chưa quy đổi\]|^\(chưa có mã\)|^bỏ qua$/i.test(s))return {code:"",name:s};
  const head=s.split(/\s+-\s+/)[0].trim(),M=KHO.items;
  let it=M&&(M.get(head)||M.get(s));
  if(!it&&M){const h=head.toLowerCase();for(const x of M.values())if(x.code.toLowerCase()===h){it=x;break}}
  if(it)return {code:it.code,name:it.name};
  const i=s.indexOf(" - ");return i>0?{code:"",name:s}:{code:"",name:s};
}
const khoCodeTd=label=>{const x=khoSplit(label);return `<td class="mono">${x.code?esc(x.code):"<span class='hint'>—</span>"}</td><td>${esc(x.name)}</td>`};
/* Bản nháp quy đổi của một combo chưa quy đổi: mỗi món một dòng. Đoán số dòng và số lượng theo "1Long+1Moc+1 TD". */
function khoCbDraft(S,c){
  S.cb=S.cb||{};const key=c.sku+"|"+(c.variant||"");
  if(!S.cb[key]){const src=String(c.variant||"").trim()||(String(c.sku||"").includes("+")?c.sku:"");
    const parts=src?src.split("+").map(x=>x.trim()).filter(Boolean):[""];
    S.cb[key]=parts.slice(0,6).map(x=>{const m=x.match(/^(\d+)/);return {code:"",name:"",qty:m?+m[1]:1}})}
  return S.cb[key];
}
function pKhoOnline(m){
  if(!KHO.on||!KHO.on.runs)khoLoadOnline();
  const S=KHO.onForm||(KHO.onForm={tab:"ALL",channel:"TIKTOK",text:"",parsed:null,mapText:"",mapParsed:null,mq:""});
  const O=KHO.on||{},ceo=ME.role==="admin",sv=(typeof SV!=="undefined"&&SV.perms)||[];
  const editMap=ceo||sv.includes("order.approve.normal")||sv.includes("order.accounting.confirm"),ed=editMap;
  /* Sửa combo: chỉ CEO và kế toán, và chỉ ở web quản trị (Cấu hình › Sản phẩm & combo, chị Hoa chốt 28/10). Bên vận hành kho chỉ xem. */
  const edCombo=(ceo||sv.includes("order.accounting.confirm"))&&!(typeof OPSV==="function"&&OPSV());
  const rawTab=khoOnTab(S),ds=rawTab.endsWith("_DS"),tab=ds?rawTab.slice(0,-3):rawTab,runs=O.runs||[],un=O.unmapped||[],src=(KHO.src||[]).find(x=>x.channel===tab);
  const tabs=`<nav class="settabs">${[["ALL","Tổng quan"],["FACEBOOK","Bán lẻ Facebook"],["TIKTOK","Bán lẻ TikTok"],["SHOPEE","Bán lẻ Shopee"]].map(([k,t])=>`<button class="${k===rawTab?"on":""}" data-ont="${k}">${t}</button>`).join("")}</nav>`;
  let body="";
  if(tab==="ALL"){
    const fb=(KHO.src||[]).find(x=>x.channel==="FACEBOOK");
    const fbCard=ceo?`<section class="card"><div class="card-h"><h2>Poscake Facebook (đối soát đơn hoàn)</h2>${fb?`<span class="tag">Đã nối cửa hàng ${esc(fb.shop_id)}</span>`:""}</div><p class="hint">Nối cửa hàng Poscake bán Facebook để web nhận ra đơn hoàn Facebook khi quét mã vận đơn. Chưa dùng để trừ kho hàng bán Facebook.</p><div class="filters"><label class="inl">Mã cửa hàng Poscake <input id="fb-shop" value="${fb?esc(fb.shop_id):"30005296"}"></label><label class="inl">Mã API <input id="fb-key" type="password" autocomplete="off" placeholder="${fb?"Để trống nếu giữ mã cũ":"Dán mã API của cửa hàng"}"></label><button class="btn pri" id="fb-save">Lưu</button></div></section>`:"";
    body=khoOnStats(O)+`<section class="card"><div class="card-h"><h2>Ngày bắt đầu trừ kho</h2></div>
     ${O.online_from?`<p>Đang trừ từ <b>${kDd(O.online_from)}</b>. Số bán trước ngày này coi như đã nằm trong tồn đầu kỳ.</p>`:`<div class="note amb">Chưa đặt ngày bắt đầu nên <b>chưa trừ kho theo hàng bán qua sàn</b>. Đặt đúng ngày kiểm kê tồn đầu.</div>`}
     ${ceo?`<div class="filters"><input type="date" id="on-d" value="${O.online_from||kToday()}"><button class="btn" id="on-save">Đặt ngày</button></div>`:""}</section>
    <section class="card"><div class="card-h"><h2>Các kênh</h2></div>${tbl(["Kênh","Nguồn Poscake","Lần kéo gần nhất","Ngày mới nhất"],["TIKTOK","SHOPEE","FACEBOOK"].map(c=>{const s=(KHO.src||[]).find(x=>x.channel===c);return `<tr class="clk" data-ont="${c}"><td><b>${KHO_CH[c]}</b></td><td>${s?"Đã nối (cửa hàng "+esc(s.shop_id)+")":'<span class="hint">Chưa nối</span>'}</td><td>${s&&s.last_sync_at?esc(String(s.last_sync_at).slice(0,16).replace("T"," "))+" · "+esc(s.last_sync_note||""):"—"}</td><td>${O.last_day&&O.last_day[c]?kDd(O.last_day[c]):"—"}</td></tr>`}))}</section>
    ${un.length?`<section class="card"><div class="card-h"><h2>Tên sản phẩm lẻ chưa có mã vật tư (kho chưa trừ)</h2></div>
     <p class="hint">Gõ vài chữ của mã hoặc tên vật tư rồi chọn đúng mã. Lưu xong, số đang chờ được trừ kho ngay.</p>
     ${tbl(["Kênh","Tên trên Sheet / bảng quy đổi","Số lượng chờ","Số ngày","Mã vật tư",""],un.map((u,i)=>`<tr><td>${esc(KHO_CH[u.channel]||u.channel||"")}</td><td>${esc(u.label)}${khoSkuNote(u)}</td><td class="n">${knum(u.qty)}</td><td class="n">${u.days}</td><td>${ed?`<input class="on-i" data-i="${i}" placeholder="Gõ mã hoặc tên vật tư" style="min-width:260px">`:"—"}</td><td>${ed?`<button class="btn sm on-s" data-i="${i}">Lưu</button> <button class="btn sm on-new" data-i="${i}" title="Mã này chưa có trong MISA / danh mục kho: thêm mã mới rồi tự gán">+ Mã mới</button>`:""}</td></tr>`))}</section>`:""}
    <details class="card"><summary><b>Nạp tay từ Sheet cũ (dự phòng)</b></summary>
     <p class="hint">Chỉ dùng khi chưa nối Poscake. Dán tab "Hàng lẻ theo ngày". Ngày nào đã kéo từ Poscake thì không bị đè.</p>
     <div class="filters"><select id="on-ch"><option value="TIKTOK"${S.channel==="TIKTOK"?" selected":""}>TikTok Shop</option><option value="SHOPEE"${S.channel==="SHOPEE"?" selected":""}>Shopee</option></select></div>
     <textarea id="on-t" rows="4" style="width:100%" placeholder="Dán nội dung tab 'Hàng lẻ theo ngày' vào đây">${esc(S.text)}</textarea>
     <div class="filters"><button class="btn" id="on-chk">Kiểm tra</button>${S.parsed?`<button class="btn pri" id="on-go">Nạp ${S.parsed.days.length} ngày</button>`:""}</div>
     ${S.parsed?`<p>Đọc được <b>${S.parsed.days.length}</b> ngày, ${S.parsed.days.reduce((s,d)=>s+d.lines.length,0)} dòng.</p>`:""}</details>
    <section class="card flush"><div class="card-h pad"><h2>Các ngày đã nạp (cả hai kênh)</h2></div>
     ${O.runs?khoRows(["Kênh","Ngày","Số đơn","Số dòng","Đã trừ kho","Chưa có mã","Nguồn"],runs.map(r=>`<tr><td>${esc(KHO_CH[r.channel]||r.channel)}</td><td>${kDd(r.day)}</td><td class="n">${r.orders==null?"—":r.orders}</td><td class="n">${r.lines}</td><td class="n">${knum(r.qty)}</td><td class="n">${r.unmapped_qty?`<b>${knum(r.unmapped_qty)}</b>`:"0"}</td><td>${r.source==="POSCAKE"?"Poscake":"Sheet"}</td></tr>`)):`<p class="hint pad">Đang tải…</p>`}</section>`;
  }else{
    if(!KHO.chd||!KHO.chd[tab])khoLoadChannel(tab);
    const D=(KHO.chd&&KHO.chd[tab])||{},combos=D.combos||[],map=D.map||[],mq=kfold(S.mq||"").trim();
    const mrows=map.filter(r=>!mq||kfold(r.sku+" "+r.variant+" "+r.item_label).includes(mq)).slice(0,200);
    const myRuns=runs.filter(r=>r.channel===tab);
    const wd=d=>["CN","T2","T3","T4","T5","T6","T7"][new Date(d+"T00:00:00").getDay()];
    const last=src&&src.last_sync_at?esc(String(src.last_sync_at).slice(0,16).replace("T"," ")):"chưa";
    const isErr=src&&String(src.last_sync_note||"").startsWith("LỖI");
    const status=src?`<section class="card"><div class="card-h"><h2>${KHO_CH[tab]} · Poscake</h2><span class="tag ${isErr?"amb":""}">${isErr?"Lần kéo gần nhất bị lỗi":"Đang nối"}</span></div>
      <p class="hint">Cửa hàng <b>${esc(src.shop_id)}</b> · tự kéo mỗi sáng 7 giờ (đơn hôm qua và hôm kia) · lần gần nhất <b>${last}</b>${src.last_sync_note?" · "+esc(src.last_sync_note):""}</p>
      ${editMap?`<div class="filters"><input type="date" id="ch-day" value="${kToday()}"><button class="btn" id="ch-sync1">Kéo ngày này</button><button class="btn" id="ch-sync3">Kéo 3 ngày gần nhất</button></div>`:""}</section>`
      :`<section class="card"><div class="note amb">Chưa nối Poscake cho kênh này.${ceo?" Mở mục “Kết nối Poscake” ở cuối trang để nối.":" Nhờ chị Hoa nối."}</div></section>`;
    const todo=`<section class="card"><div class="card-h"><h2>Cần xử lý${combos.length?" ("+combos.length+")":""}</h2></div>
     ${D.busy||!KHO.chd[tab].combos?`<p class="hint">Đang tải…</p>`:combos.length===0?(D.recon&&!(D.recon.lines||[]).length?`<p class="hint">Chưa có đơn ${KHO_CH[tab]} nào kéo thẳng từ Poscake${D.recon.start_day?" (kênh này tính từ "+kDd(D.recon.start_day)+")":""}, nên chưa có mã nào để kiểm. Số đang hiện là số Sheet đã tách sẵn.</p>`:`<p class="hint">✓ Mọi mã bán trên sàn đều đã có cách quy đổi.</p>`)
       :`<p class="hint">Đây là mã (SKU) <b>mới xuất hiện</b> hoặc chưa được quy đổi nên chưa trừ kho. Shop đổi combo / đổi quà thường đổi SKU: chọn <b>“Giống SKU cũ”</b> để sao chép cách quy đổi của SKU trước rồi chỉnh phần khác, hoặc chọn sản phẩm lẻ + số lượng rồi bấm Thêm (combo nhiều món thì thêm nhiều lần). Món không tính kho thì bấm Bỏ qua.</p>
       ${editMap?`<div class="filters"><label class="inl">Áp dụng từ ngày <input type="date" id="cb-from"> <span class="hint">(để trống = cho mọi ngày chưa có cách quy đổi)</span></label></div>`:""}
       ${tbl(["SKU / Phân loại","Tên trên đơn","Xuất hiện từ","SL bán","Gồm các sản phẩm lẻ (mỗi món một dòng)",""],combos.slice(0,60).map((c,i)=>{const P=khoCbDraft(S,c);return `<tr><td><b class="mono">${esc(c.sku)}</b>${c.variant?"<br><span class='hint'>"+esc(c.variant)+"</span>":""}</td><td>${esc(String(c.name||""))}</td><td>${c.first_day?kDd(c.first_day):"—"}</td><td class="n">${knum(c.qty)}</td><td>${editMap?P.map((p,j)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><input class="cb-i" data-i="${i}" data-j="${j}" value="${esc(p.code?p.code+" - "+(p.name||""):"")}" data-code="${esc(p.code||"")}" placeholder="Gõ mã hoặc tên sản phẩm lẻ" style="min-width:230px"> × <input class="cb-q n" data-i="${i}" data-j="${j}" type="number" min="0.001" step="any" value="${p.qty}" style="width:56px">${P.length>1?` <button class="btn sm cb-d" data-i="${i}" data-j="${j}" title="Bỏ dòng này">✕</button>`:""}</div>`).join("")+`<a href="#" class="cb-add" data-i="${i}">+ thêm món</a>`:"—"}</td><td style="white-space:nowrap">${editMap?`<button class="btn sm pri cb-s" data-i="${i}">Lưu quy đổi</button><br><button class="btn sm cb-c" data-i="${i}">Giống SKU cũ</button> <button class="btn sm cb-x" data-i="${i}">Bỏ qua</button>`:""}</td></tr>`}))}`}</section>`;
    /* Sửa combo chỉ còn ở trang Sản phẩm & combo (giữ loại món sản phẩm / quà / bao bì); ở đây chỉ liệt kê. */
    const goSpc=edCombo&&typeof PAGES!=="undefined"&&PAGES.spcombo?`<button class="btn pri" data-go="spcombo">Mở Sản phẩm &amp; combo</button>`:"";
    const todoV=`<section class="card"><div class="card-h"><h2>Mã combo chưa quy đổi${combos.length?" ("+combos.length+")":""}</h2>${goSpc}</div>
     <p class="hint">Kho vẫn soạn và xuất hàng bình thường. Kế toán nhập combo ở <b>web quản trị › Cấu hình › Sản phẩm &amp; combo</b>; nhập xong web tự trừ kho và tính giá vốn các đơn này.</p>
     ${combos.length?tbl(["SKU / Phân loại","Tên trên đơn","Xuất hiện từ","SL bán"],combos.slice(0,60).map(c=>`<tr><td><b class="mono">${esc(c.sku)}</b>${c.variant?"<br><span class='hint'>"+esc(c.variant)+"</span>":""}</td><td>${esc(String(c.name||""))}</td><td>${c.first_day?kDd(c.first_day):"—"}</td><td class="n">${knum(c.qty)}</td></tr>`)):`<p class="hint">✓ Mọi mã bán trên ${KHO_CH[tab]} đã có combo.</p>`}</section>`;
    const misaRows=un.map((u,i)=>[u,i]).filter(([u])=>u.channel===tab&&!String(u.label).startsWith("[Chưa quy đổi]"));
    const todoMisa=`<section class="card"><div class="card-h"><h2>Tên sản phẩm lẻ chưa có mã MISA${misaRows.length?" ("+misaRows.length+")":""}</h2></div>
     ${misaRows.length?`<p class="hint">Các tên này có trong bảng quy đổi nhưng chưa gắn với mã MISA trong danh mục kho nên <b>chưa trừ kho</b>. Gõ mã hoặc tên, chọn trong gợi ý rồi bấm Lưu; gán một lần là các ngày sau tự trừ. Món không có trong MISA (quà mua ngoài…) thì báo kế toán thêm vào Danh mục & định mức trước.</p>
     ${tbl(["Tên trong bảng quy đổi","Số lượng đang chờ","Mã MISA",""],misaRows.map(([u,i])=>`<tr><td>${esc(u.label)}${khoSkuNote(u)}</td><td class="n">${knum(u.qty)}</td><td>${ed?`<input class="on-i" data-i="${i}" placeholder="Gõ mã MISA hoặc tên" style="min-width:240px">`:"—"}</td><td>${ed?`<button class="btn sm on-s" data-i="${i}">Lưu</button> <button class="btn sm on-new" data-i="${i}" title="Mã này chưa có trong MISA / danh mục kho: thêm mã mới rồi tự gán">+ Mã mới</button>`:""}</td></tr>`))}`:`<p class="hint">✓ Mọi tên sản phẩm lẻ đều đã có mã MISA.</p>`}</section>`;
    const shown=myRuns;
    const runsCard=`<section class="card flush"><div class="card-h pad"><h2>Số bán theo ngày</h2><span class="hint">Chủ nhật thường không có đơn gửi đi nên có thể bằng 0.</span></div>
     ${shown.length?khoRows(["Ngày","Số đơn","Số dòng","Đã trừ kho","Chưa có mã","Nguồn"],shown.map(r=>`<tr><td>${wd(r.day)} ${kDd(r.day)}</td><td class="n">${r.orders==null?"—":r.orders}</td><td class="n">${r.lines}</td><td class="n">${knum(r.qty)}</td><td class="n">${r.unmapped_qty?`<b>${knum(r.unmapped_qty)}</b>`:"0"}</td><td>${r.source==="POSCAKE"?"Poscake":"Sheet"}</td></tr>`)):`<p class="hint pad">Chưa có ngày nào.</p>`}
</section>`;
    const mapCard=`<section class="card flush" id="mp-det"><div class="card-h pad"><h2>Quy đổi combo (${map.length} dòng)</h2></div><p class="hint pad">Một combo bán trên sàn gồm những sản phẩm lẻ nào. Sửa số lượng ngay trong ô; × để xóa một dòng; + món để thêm quà vào combo. Cột Phân loại để trống nghĩa là áp cho mọi phân loại của mã đó; dòng có ghi phân loại cụ thể được ưu tiên.</p>
     <div class="filters pad"><input id="mp-q" placeholder="Tìm mã, phân loại, sản phẩm" value="${esc(S.mq||"")}"></div>
     ${mrows.length?(()=>{const hasVer=mrows.some(r=>r.from_day);let prev="";return khoRows(["SKU","Phân loại"].concat(hasVer?["Áp dụng từ"]:[],["Mã MISA","Tên sản phẩm","SL / 1 combo","Ghi chú",""]),mrows.map(r=>{const g=r.sku+"|"+r.variant+"|"+(r.from_day||""),first=g!==prev;prev=g;const da=`data-k="${esc(r.sku)}" data-v="${esc(r.variant)}" data-f="${esc(r.from_day||"")}"`;return `<tr${first?' style="border-top:2px solid #ddd"':""}><td class="mono">${first?esc(r.sku):""}</td><td>${first?(r.variant?esc(r.variant):"<span class='hint' title='Để trống = áp cho mọi phân loại của mã này'></span>"):""}</td>${hasVer?`<td>${first?(r.from_day?kDd(r.from_day):"từ đầu"):""}</td>`:""}${editMap?`<td class="mono"><input class="mp-mi" ${da} data-l="${esc(r.item_label)}" value="${esc(khoSplit(r.item_label).code||"")}" placeholder="Gõ mã MISA" title="Quy đổi nhầm mã thì gõ mã đúng rồi chọn trong gợi ý" style="width:150px"></td><td>${esc(khoSplit(r.item_label).name)}</td>`:khoCodeTd(r.item_label)}<td class="n">${editMap?`<input class="mp-qi n" type="number" min="0.001" step="any" value="${r.qty}" ${da} data-l="${esc(r.item_label)}" style="width:72px">`:knum(r.qty)}</td><td>${/CẦN KẾ TOÁN/.test(r.note||"")?`<span class="t-red">❓ ${esc((r.note||"").replace(/^[^C]*/,""))}</span>`:esc(r.note||"")}</td><td style="white-space:nowrap">${editMap?`${first?`<button class="btn sm mp-ok" ${da} title="Quy đổi đúng, bỏ dòng cần xác nhận">✓ Đã kiểm</button> <button class="btn sm mp-a" ${da} title="Thêm một món vào combo này">+ món</button> `:""}<button class="btn sm mp-d" ${da} data-l="${esc(r.item_label)}" title="Xóa dòng này">×</button>`:""}</td></tr>`}))})()
       :`<p class="hint pad">Chưa có dòng quy đổi nào.</p>`}
     ${map.length>200?`<p class="hint pad">Đang hiện 200 / ${map.length} dòng. Gõ vào ô tìm để thu hẹp.</p>`:""}</section>`;
    const setup=(ceo||editMap)?`<section class="card"><div class="card-h"><h2>Kết nối Poscake và nạp từ Sheet cũ</h2></div>
      ${ceo?`<h3>${src?"Đổi mã cửa hàng / mã API":"Nối Poscake"}</h3>
       <div class="filters"><label class="inl">Mã cửa hàng Poscake <input id="ch-shop" value="${src?esc(src.shop_id):(tab==="TIKTOK"?"1635334048":tab==="FACEBOOK"?"30005296":"430024955")}"></label>
       <label class="inl">Mã API <input id="ch-key" type="password" autocomplete="off" placeholder="${src?"Để trống nếu giữ mã cũ":"Dán mã API của cửa hàng"}"></label>
       <button class="btn pri" id="ch-save">Lưu</button></div>
       <p class="hint">Mã API lấy ở Poscake: Cấu hình › Nâng cao › Kết nối bên thứ 3 › Webhook/API của cửa hàng ${KHO_CH[tab]}. Mã được mã hoá khi lưu, không hiện lại trên màn hình.</p>`:""}
      ${editMap?`<h3>Nạp chi tiết đơn từ Sheet (tab "Đơn đã gửi")</h3>
       <p class="hint">Dùng cho những ngày Poscake không còn đúng giờ gửi (TikTok trước 13/10). Mở Sheet kế toán kho ${KHO_CH[tab]}, tab "Đơn đã gửi", bôi đen cả bảng, copy, dán vào ô dưới. Mỗi ngày được thay nguyên theo Sheet; số hàng lẻ tính theo bảng quy đổi của web.</p>
       <textarea id="ln-t" rows="4" style="width:100%" placeholder="Dán nội dung tab 'Đơn đã gửi' vào đây"></textarea>
       <div class="filters"><label class="inl">Chỉ nạp các ngày trước <input type="date" id="ln-before" value="${tab==="TIKTOK"?"2026-10-13":""}"></label><button class="btn" id="ln-chk">Kiểm tra</button>${S.lnParsed?`<span class="hint">${S.lnParsed.length} ngày, ${S.lnParsed.reduce((s,d)=>s+d.lines.length,0)} dòng</span> <button class="btn pri" id="ln-go">Nạp</button>`:""}</div>`:""}
      ${editMap?`<h3>Nạp bảng quy đổi từ Sheet cũ</h3>
       <p class="hint">Mở Sheet kế toán kho ${KHO_CH[tab]}, tab "Quy đổi combo", bôi đen cả bảng, copy, dán vào ô dưới. Chỉ thay các dòng "từ đầu"; những bản đã tạo theo ngày được giữ nguyên.</p>
       <textarea id="mp-t" rows="4" style="width:100%" placeholder="Dán nội dung tab 'Quy đổi combo' vào đây">${esc(S.mapText||"")}</textarea>
       <div class="filters"><button class="btn" id="mp-chk">Kiểm tra</button>${S.mapParsed?`<button class="btn pri" id="mp-go">Nạp ${S.mapParsed.length} dòng</button>`:""}</div>`:""}
     </section>`:"";
    body=khoSheetView(D.recon,S,myRuns,tab,{map:`<section class="card"><div class="card-h"><h2>Bảng combo</h2>${goSpc}</div><p class="hint">Bảng quy đổi combo đã chuyển sang <b>web quản trị › Cấu hình › Sản phẩm &amp; combo</b> (chị Hoa chốt 28/10). Chỉ CEO và kế toán sửa ở đó.</p></section>`,missing:todoV+todoMisa,setup:status+setup,nMissing:combos.length+misaRows.length,noMisa:new Set(misaRows.map(([u])=>u.label))});
  }
  khoFrame(m,"kho_online","Xuất Kênh bán lẻ: bán lẻ Facebook, TikTok, Shopee","Số hàng lẻ bán mỗi ngày ở Facebook, TikTok, Shopee, lấy thẳng từ Poscake, trừ vào tồn kho từ ngày bắt đầu. Kế toán chỉ cần xử lý combo chưa quy đổi, không cần mở Sheet.",tabs+body);
  m.querySelectorAll("[data-ont]").forEach(b=>b.onclick=()=>{S.tab=b.dataset.ont;renderMain()});
  const ref=async()=>{KHO.at=0;await khoLoad(true);await khoLoadOnline();if(tab!=="ALL")await khoLoadChannel(tab)};
  if($("#fb-save"))$("#fb-save").onclick=async()=>{try{await kApi("/online/source",{method:"PUT",body:JSON.stringify({channel:"FACEBOOK",shop_id:$("#fb-shop").value.trim(),api_key:$("#fb-key").value.trim()})});toast("Đã lưu kết nối Poscake Facebook");KHO.src=await kApi("/online/source");renderMain()}catch(e){toast(e.message)}};
  if($("#on-save"))$("#on-save").onclick=async()=>{try{await kApi("/cfg/online-from",{method:"PUT",body:JSON.stringify({date:$("#on-d").value})});toast("Đã đặt ngày");await ref()}catch(e){toast(e.message)}};
  if($("#on-ch"))$("#on-ch").onchange=()=>{S.channel=$("#on-ch").value};
  if($("#on-t"))$("#on-t").oninput=()=>{S.text=$("#on-t").value;S.parsed=null};
  if($("#on-chk"))$("#on-chk").onclick=()=>{try{S.text=$("#on-t").value;S.channel=$("#on-ch").value;S.parsed=khoParseOnline(S.text.split(/\r?\n/).map(l=>l.split("\t")));if(!S.parsed.days.length)throw new Error("Không có dòng nào dùng được");renderMain()}catch(e){S.parsed=null;alert(e.message)}};
  if($("#on-go"))$("#on-go").onclick=async()=>{const P=S.parsed;if(!P||!confirm("Nạp số bán "+KHO_CH[S.channel]+" cho "+P.days.length+" ngày?"))return;
    try{const r=await kApi("/online/import",{method:"POST",body:JSON.stringify({channel:S.channel,days:P.days})});S.parsed=null;S.text="";toast("Đã nạp "+r.days+" ngày");await ref()}catch(e){alert("Chưa nạp được: "+e.message)}};
  m.querySelectorAll(".on-i").forEach(x=>khoPick(x,null,()=>{}));
  m.querySelectorAll(".cb-i").forEach(x=>khoPick(x,null,it=>{const D=(KHO.chd&&KHO.chd[khoOnTab(S).replace("_DS","")])||{},c=(D.combos||[])[+x.dataset.i];if(!c)return;const P=khoCbDraft(S,c);P[+x.dataset.j]={code:it.code,name:it.name,qty:P[+x.dataset.j]?P[+x.dataset.j].qty:1};x.value=it.code+" - "+it.name}));
  m.querySelectorAll(".on-new").forEach(b=>b.onclick=()=>{
    const u=un[+b.dataset.i];if(!u)return;
    khoNewItem({name:String(u.label).replace(/^\(chưa có mã\)\s*/i,"").replace(/^\[chưa quy đổi\]\s*/i,""),cls:"TP",
      onDone:async code=>{try{const r=await kApi("/online/alias",{method:"PUT",body:JSON.stringify({label:u.label,item:code})});toast("Đã thêm mã "+code+" và gán cho "+u.label+(r.moved?" · trừ kho "+r.moved+" dòng":""));await ref()}catch(e){toast("Đã thêm mã nhưng chưa gán được: "+e.message)}}})});
  m.querySelectorAll(".on-s").forEach(b=>b.onclick=async()=>{
    const i=+b.dataset.i,inp=m.querySelector('.on-i[data-i="'+i+'"]'),code=inp&&inp.dataset.code;
    if(!code){toast("Chọn mã vật tư trong danh sách gợi ý");return}
    try{const r=await kApi("/online/alias",{method:"PUT",body:JSON.stringify({label:un[i].label,item:code})});toast("Đã gán mã "+code+(r.moved?" · trừ kho "+r.moved+" dòng":""));await ref()}catch(e){toast(e.message)}});
  if(tab!=="ALL"){
    const D=(KHO.chd&&KHO.chd[tab])||{},combos=D.combos||[];
    if($("#rc-csv"))$("#rc-csv").onclick=()=>{if(D.recon)khoSheetCsv(D.recon,S,tab)};
    m.querySelectorAll("[data-st]").forEach(b=>b.onclick=()=>{S.st=b.dataset.st;renderMain()});
    m.querySelectorAll("[data-dv]").forEach(a=>a.onclick=e=>{e.preventDefault();S.st="detail";S.dv=a.dataset.dv;renderMain()});
    if($("#rc-q"))$("#rc-q").oninput=e=>{S.rq=e.target.value;clearTimeout(KHO.rqT);KHO.rqT=setTimeout(()=>{renderMain();const x=$("#rc-q");if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},350)};
    m.querySelectorAll(".rc-o").forEach(b=>b.onclick=async()=>{const box=m.querySelector('.rc-ol[data-i="'+b.dataset.i+'"]');if(!box)return;if(!box.hidden){box.hidden=true;return}box.hidden=false;box.innerHTML="Đang tải…";
      try{const R=D.recon,r=R.rows[+b.dataset.i];const L=await kApi("/online/orders?channel="+tab+"&sku="+encodeURIComponent(r.sku)+"&variant="+encodeURIComponent(r.variant||"")+"&from="+R.from+"&to="+R.to);
      box.innerHTML=L.length?`<table class="tbl"><thead><tr><th>Mã đơn</th><th>Ngày tính</th><th>Giờ gửi (Poscake)</th><th>Shop</th><th class="n">SL</th></tr></thead><tbody>${L.map(o=>`<tr><td class="mono">${esc(o.order_id)}</td><td>${kDd(o.day)}</td><td>${o.shipped_at?new Date(Date.parse(o.shipped_at)+7*3600e3).toISOString().slice(0,16).replace("T"," "):"—"}</td><td>${esc(o.shop||"")}</td><td class="n">${knum(o.qty)}</td></tr>`).join("")}</tbody></table>`:"Không có đơn."}catch(e){box.innerHTML=esc(e.message)}});
    m.querySelectorAll(".rc-b").forEach(r=>r.onclick=()=>{const x=m.querySelector('.rc-bd[data-i="'+r.dataset.i+'"]');if(x)x.hidden=!x.hidden});
    khoRangeBind(S,tab);
  if($("#ch-save"))$("#ch-save").onclick=async()=>{try{await kApi("/online/source",{method:"PUT",body:JSON.stringify({channel:tab,shop_id:$("#ch-shop").value.trim(),api_key:$("#ch-key").value.trim()})});toast("Đã lưu kết nối Poscake");await ref()}catch(e){toast(e.message)}};
    const doSync=async days=>{toast("Đang kéo từ Poscake…");try{const r=await kApi("/online/sync",{method:"POST",body:JSON.stringify({channel:tab,days})});
      const odd=r.filter(x=>!x.ok&&String(x.error||"").startsWith("BẤT THƯỜNG"));
      for(const x of odd){if(confirm(x.error+"\n\nVẫn ghi số này vào kho?")){try{const f=await kApi("/online/sync",{method:"POST",body:JSON.stringify({channel:tab,days:[x.day],force:true})});Object.assign(x,f[0]||{})}catch(e){x.error=e.message}}}
      const bad=r.filter(x=>!x.ok);toast(bad.length?"Chưa ghi: "+bad.map(x=>kDd(x.day)+" "+x.error).join(" | "):"Đã kéo "+r.map(x=>kDd(x.day)+": "+x.orders+" đơn").join(", "));await ref()}catch(e){toast(e.message)}};
    if($("#ch-sync1"))$("#ch-sync1").onclick=()=>doSync([$("#ch-day").value]);
    if($("#ch-sync3"))$("#ch-sync3").onclick=()=>{const t=kToday(),d=n=>{const x=new Date(t+"T00:00:00Z");x.setUTCDate(x.getUTCDate()-n);return x.toISOString().slice(0,10)};doSync([d(0),d(1),d(2)])};
    const mpArgs=b=>({channel:tab,sku:b.dataset.k,variant:b.dataset.v,from_day:b.dataset.f||""});
    m.querySelectorAll(".mp-v").forEach(b=>b.onclick=async()=>{
      const d=prompt("Shop đổi combo / đổi quà từ ngày nào? Gõ ngày dạng 2026-10-20 (ngày đó trở đi dùng cách quy đổi mới, các ngày trước giữ nguyên).","");
      if(!d)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(d.trim())){toast("Ngày phải dạng 2026-10-20");return}
      try{const a=mpArgs(b);const r=await kApi("/online/map/version",{method:"POST",body:JSON.stringify({channel:tab,sku:a.sku,variant:a.variant,from_day:d.trim()})});toast("Đã tạo bản mới từ "+d.trim()+" (sao chép "+r.rows+" dòng). Sửa SL / thêm món / xóa món ở các dòng có ngày đó.");await ref()}catch(e){toast(e.message)}});
    m.querySelectorAll(".mp-qi").forEach(x=>x.onchange=async()=>{const q=+String(x.value).replace(",",".");if(!(q>0)){toast("Số lượng phải lớn hơn 0");return}
      try{const a=mpArgs(x);await kApi("/online/map/add",{method:"POST",body:JSON.stringify({channel:tab,sku:a.sku,variant:a.variant,from_day:a.from_day,item_label:x.dataset.l,qty:q})});toast("Đã lưu, số các ngày liên quan tự tính lại");await ref()}catch(e){toast(e.message)}});
    m.querySelectorAll(".mp-q").forEach(b=>b.onclick=async()=>{
      const v=prompt("Số lượng mới cho "+b.dataset.l+" trong mỗi combo:",b.dataset.n);if(v==null)return;const q=+String(v).replace(",",".");if(!(q>0)){toast("Số lượng phải lớn hơn 0");return}
      try{const a=mpArgs(b);await kApi("/online/map/add",{method:"POST",body:JSON.stringify({channel:tab,sku:a.sku,variant:a.variant,from_day:a.from_day,item_label:b.dataset.l,qty:q})});toast("Đã sửa, số các ngày liên quan tự tính lại");await ref()}catch(e){toast(e.message)}});
    m.querySelectorAll(".mp-mi").forEach(x=>{
      khoPick(x,null,async it=>{
        const nl=it.code+" - "+it.name;if(nl===x.dataset.l)return;
        try{const a=mpArgs(x);await kApi("/online/map/swap",{method:"POST",body:JSON.stringify({channel:tab,sku:a.sku,variant:a.variant,from_day:a.from_day,old_label:x.dataset.l,new_label:nl})});toast("Đã đổi sang "+it.code+", dòng cần xác nhận của combo này đã bỏ");await ref()}catch(e){toast(e.message);await ref()}})});
    m.querySelectorAll(".mp-ok").forEach(b=>b.onclick=async()=>{
      try{const a=mpArgs(b);const r=await kApi("/online/map/confirm",{method:"POST",body:JSON.stringify({channel:tab,sku:a.sku,variant:a.variant,from_day:a.from_day})});toast(r.confirmed_rows?"Đã xác nhận quy đổi "+a.sku:"Combo này không còn dòng cần xác nhận");await ref()}catch(e){toast(e.message)}});
    m.querySelectorAll(".mp-a").forEach(b=>b.onclick=()=>{
      const a=mpArgs(b);
      openDrawerHTML(`<h2>Thêm món vào combo</h2><p class="hint">Combo <b>${esc(a.sku)}</b>${a.variant?" · "+esc(a.variant):""}. Thêm vỏ hộp, tem, quà tặng… để mỗi lần bán combo kho tự trừ thêm món này. Gõ vài chữ của mã hoặc tên (ví dụ “hộp”), chọn trong gợi ý.</p>
       <form class="frm" id="ma"><label class="field">Vật tư thêm vào<input id="ma-i" autocomplete="off" placeholder="Gõ mã hoặc tên, ví dụ: hộp 35*26*17" required></label>
       <label class="field">Số lượng trong mỗi combo<input id="ma-q" type="number" min="0.001" step="any" value="1" required></label>
       <button class="btn pri" id="ma-go">Thêm vào combo</button><div id="ma-e"></div></form>`);
      khoPick($("#ma-i"),null,()=>{});
      $("#ma").onsubmit=async e=>{e.preventDefault();
        const code=$("#ma-i").dataset.code,it=code&&KHO.items&&KHO.items.get(code),q=+String($("#ma-q").value).replace(",",".");
        if(!it){$("#ma-e").innerHTML=`<div class="note red">Chọn vật tư trong danh sách gợi ý (chưa có mã thì thêm ở Danh mục & định mức trước).</div>`;return}
        if(!(q>0)){$("#ma-e").innerHTML=`<div class="note red">Số lượng phải lớn hơn 0.</div>`;return}
        try{await kApi("/online/map/add",{method:"POST",body:JSON.stringify({channel:tab,sku:a.sku,variant:a.variant,from_day:a.from_day,item_label:code+" - "+it.name,qty:q})});closeDrawer();toast("Đã thêm "+code+" vào combo, kho trừ thêm món này mỗi lần bán");await ref()}catch(err){$("#ma-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}}});
    const addMap=async(c,item,qty)=>{try{await kApi("/online/map/add",{method:"POST",body:JSON.stringify({channel:tab,sku:c.sku,variant:c.variant,item_label:item,qty,from_day:($("#cb-from")&&$("#cb-from").value)||""})});toast("Đã thêm quy đổi");await ref()}catch(e){toast(e.message)}};
    const draftOf=i=>khoCbDraft(S,combos[i]);
    m.querySelectorAll(".cb-q").forEach(x=>x.onchange=()=>{const P=draftOf(+x.dataset.i);P[+x.dataset.j].qty=+String(x.value).replace(",",".")||1});
    m.querySelectorAll(".cb-add").forEach(a=>a.onclick=e=>{e.preventDefault();draftOf(+a.dataset.i).push({code:"",name:"",qty:1});renderMain()});
    m.querySelectorAll(".cb-d").forEach(b=>b.onclick=()=>{draftOf(+b.dataset.i).splice(+b.dataset.j,1);renderMain()});
    m.querySelectorAll(".cb-s").forEach(b=>b.onclick=async()=>{const i=+b.dataset.i,c=combos[i];
      /* Lấy món đã chọn ngay trên dòng (không phụ thuộc bản nháp: danh sách có thể vừa tải lại làm lệch thứ tự). */
      const row=b.closest("tr"),fromRow=row?[...row.querySelectorAll(".cb-i")].map(inp=>{const code=(inp.dataset.code||String(inp.value).split(" - ")[0]).trim(),it=code&&KHO.items&&KHO.items.get(code),q=row.querySelector('.cb-q[data-j="'+inp.dataset.j+'"]');return it?{code:it.code,name:it.name,qty:q?(+String(q.value).replace(",",".")||1):1}:null}):[];
      const P=fromRow.some(Boolean)?fromRow.filter(Boolean):draftOf(i).filter(p=>p.code);
      if(!P.length){toast("Chọn sản phẩm lẻ trong danh sách gợi ý");return}
      if(P.length<draftOf(i).length&&!confirm("Còn dòng chưa chọn sản phẩm, vẫn lưu "+P.length+" món?"))return;
      try{await kApi("/online/map/set",{method:"POST",body:JSON.stringify({channel:tab,sku:c.sku,variant:c.variant||"",from_day:($("#cb-from")&&$("#cb-from").value)||"",parts:P.map(p=>({item_label:p.code+" - "+(p.name||""),qty:p.qty}))})});
        delete S.cb[c.sku+"|"+(c.variant||"")];toast("Đã lưu quy đổi "+c.sku+": "+P.length+" món");await ref()}catch(e){toast(e.message)}});
    m.querySelectorAll(".cb-x").forEach(b=>b.onclick=()=>addMap(combos[+b.dataset.i],"BỎ QUA",1));
    m.querySelectorAll(".cb-c").forEach(b=>b.onclick=async()=>{
      const c=combos[+b.dataset.i];
      const v=prompt("SKU cũ nào có thành phần giống combo "+c.sku+"? Gõ mã SKU cũ:","");if(!v)return;
      const want=v.trim().toLowerCase(),hit=(D.map||[]).find(r=>String(r.sku).toLowerCase()===want);
      if(!hit){toast("Không thấy SKU này trong bảng quy đổi");return}
      try{const r=await kApi("/online/map/clone",{method:"POST",body:JSON.stringify({channel:tab,from_sku:hit.sku,from_variant:hit.variant||"",sku:c.sku,variant:c.variant||""})});toast("Đã sao chép "+r.rows+" dòng từ "+hit.sku+". Vào Bảng quy đổi để chỉnh quà / số lượng nếu khác.");await ref()}catch(e){toast(e.message)}});
    if($("#mp-det"))$("#mp-det").ontoggle=()=>{S.mapOpen=$("#mp-det").open};
    m.querySelectorAll(".mp-d").forEach(b=>b.onclick=async()=>{if(!confirm("Xóa dòng quy đổi này?"))return;
      try{await kApi("/online/map/remove",{method:"POST",body:JSON.stringify({channel:tab,sku:b.dataset.k,variant:b.dataset.v,from_day:b.dataset.f||"",item_label:b.dataset.l})});await ref()}catch(e){toast(e.message)}});
    if($("#mp-q"))$("#mp-q").oninput=()=>{S.mq=$("#mp-q").value;const p=$("#mp-q").selectionStart;renderMain();const q=$("#mp-q");if(q){q.focus();q.setSelectionRange(p,p)}};
    if($("#mp-t"))$("#mp-t").oninput=()=>{S.mapText=$("#mp-t").value;S.mapParsed=null};
    if($("#mp-chk"))$("#mp-chk").onclick=()=>{try{S.mapText=$("#mp-t").value;S.mapParsed=khoParseMap(S.mapText.split(/\r?\n/).map(l=>l.split("\t")));if(!S.mapParsed.length)throw new Error("Không có dòng nào dùng được");renderMain()}catch(e){S.mapParsed=null;alert(e.message)}};
    if($("#ln-chk"))$("#ln-chk").onclick=()=>{try{const before=$("#ln-before").value;let D=khoParseLines($("#ln-t").value.split(/\r?\n/).map(l=>l.split("\t")));if(before)D=D.filter(d=>d.day<before);if(!D.length)throw new Error("Không có ngày nào dùng được");S.lnParsed=D;S.lnText=$("#ln-t").value;renderMain();if($("#ln-t"))$("#ln-t").value=S.lnText}catch(e){S.lnParsed=null;alert(e.message)}};
    if($("#ln-go"))$("#ln-go").onclick=async()=>{const D=S.lnParsed;if(!D||!confirm("Nạp chi tiết đơn "+KHO_CH[tab]+" cho "+D.length+" ngày ("+D.map(d=>kDd(d.day)).join(", ")+")?"))return;
      try{let n=0;for(const d of D){await kApi("/online/lines",{method:"POST",body:JSON.stringify({channel:tab,days:[d]})});n++;toast("Đã nạp "+n+"/"+D.length+" ngày")}S.lnParsed=null;S.lnText="";await ref()}catch(e){alert("Chưa nạp được: "+e.message)}};
    if($("#mp-go"))$("#mp-go").onclick=async()=>{const R=S.mapParsed;if(!R||!confirm("Nạp "+R.length+" dòng quy đổi cho "+KHO_CH[tab]+"? Bảng hiện tại của kênh này sẽ bị thay."))return;
      try{const r=await kApi("/online/map",{method:"PUT",body:JSON.stringify({channel:tab,rows:R})});S.mapParsed=null;S.mapText="";toast("Đã nạp "+r.rows+" dòng, tính lại "+r.recomputed_days+" ngày");await ref()}catch(e){alert("Chưa nạp được: "+e.message)}};
  }
}
PAGES.kho_online=pKhoOnline;
/* Quy đổi mã các sàn (TikTok, Shopee, Facebook): chuyển về trang quản trị. Mở thẳng tab "Quy đổi & cài đặt". */
PAGES.kho_qd=m=>{const S=KHO.onForm||(KHO.onForm={tab:"ALL",channel:"TIKTOK",text:"",parsed:null,mapText:"",mapParsed:null,mq:""});if(!S.tab||S.tab==="ALL"||S.tab==="ALL_DS")S.tab="TIKTOK";if(!S.qdInit){S.st="map";S.qdInit=1}pKhoOnline(m)};

// Trang "Nguyên vật liệu" cũ đã bỏ (kỹ thuật ghi số thực tế ở phiếu Pha chế): ai còn nhớ đường dẫn cũ thì chuyển sang Pha chế.
PAGES.sx_nvl=m=>PAGES.kho_pc(m);

/* ---------- Vỏ can / chai / thùng: ảnh, mã MISA + mã chuẩn, ghép vào thành phẩm nào, nhà cung cấp ---------- */
const KHO_VO_LOAI=[["CAN","Can"],["CHAI","Chai / lọ"],["BINH","Bình"],["TUI","Túi"],["THUNG","Thùng"]];
const KHO_VO_NHOM=[["VO","Vỏ can / chai"],["THUNG","Vỏ thùng"],["PHUKIEN","Phụ kiện (vòi, nắp…)"],["KHAC","Khác (băng dính…)"]];
/* Nhóm: lấy theo lựa chọn đã lưu; chưa chọn thì đoán từ nhóm MISA và tên (sửa lại được trong hồ sơ). */
function khoVoNhom(i){
  if(i.grp_vo)return i.grp_vo;
  if(i.grp==="Vỏ can, chai, túi")return khoVoKind(i)==="THUNG"?"THUNG":"VO";
  const f=kfold(i.name+" "+i.code);
  if(/^vt(\s|\d)/.test(f))return "VO";
  if(khoVoKind(i)==="THUNG"||/thung|carton|(^|\s)hop(\s|$)/.test(f))return "THUNG";
  if(/(^|\s)(voi|nap|co|van|khoa|bom|vong|nut)(\s|$)/.test(f))return "PHUKIEN";
  if(/bang dinh|bang keo|day|mang|decal|keo|tui/.test(f))return "KHAC";
  return "PHUKIEN";
}
const KHO_VO_KIEU=[["6C","6 cạnh"],["GND","giọt nước"],["GL","giọt lệ"],["VUONG","vuông"],["TRON","tròn"],["VAT","vát"],["CV","cổ vịt"],["PET","chai PET"],["HD","chai HD"],["HAN","can hàn"],["XIT","có vòi xịt"],["DET","dẹt"],["ECO","eco"],["IN","in sẵn logo"],["KIN","không in"]];
const KHO_VO_MAU=[["TRANG","trắng"],["DEN","đen"],["DO","đỏ"],["HONG","hồng"],["XANH","xanh"],["TIM","tím"],["NAU","nâu"],["TRONG","trong suốt"]];
const KHO_VO_CAM=["mesy","azzen","nitat","metis","dossy","soli","luxi","ecohala","kosha","camila","ailla","nước giặt","nuoc giat","lau sàn","lau san","rửa chén","rua chen","siêu tẩy","sieu tay","xịt muỗi","xit muoi","tẩy lồng","tay long"];
/* Dung tích: số dưới 1 đổi sang ML (0.5 → 500ML); từ 1 trở lên giữ số (3.6, 5, 10); chữ thì viết hoa (500ML). */
function khoVoCap(v){
  const s=String(v==null?"":v).trim().replace(",",".");
  if(!s||s==="?")return "";
  if(/^\d+(\.\d+)?$/.test(s)){const n=+s;return n<1?Math.round(n*1000)+"ML":String(n)}
  return s.toUpperCase().replace(/\s+/g,"");
}
/* Ô loại / kiểu / màu để gõ chữ tự do: gõ "trắng", "giọt nước", "CAN" đều được. Khớp từ điển thì đổi ra mã chuẩn, không khớp thì viết HOA không dấu. */
function khoVoNorm(list,v){
  const t=String(v==null?"":v).trim();if(!t||t==="?")return "";
  const f=kfold(t).replace(/\s+/g," ");
  const hit=list.find(x=>kfold(x[0])===f||kfold(x[1])===f||kfold(x[1]).split(/[\s\/(]+/)[0]===f);
  return hit?hit[0]:f.toUpperCase().replace(/[^A-Z0-9]+/g,"");
}
/* Chỉ trả về mã khi chữ gõ khớp từ điển; không khớp thì "" (không đưa vào mã chuẩn). */
function khoVoStrict(list,v){
  const t=String(v==null?"":v).trim();if(!t||t==="?")return "";
  const f=kfold(t).replace(/\s+/g," "),hit=list.find(x=>kfold(x[0])===f||kfold(x[1])===f||kfold(x[1]).split(/[\s\/(]+/)[0]===f);
  return hit?hit[0]:"";
}
const khoVoKind=r=>khoVoNorm(KHO_VO_LOAI,r.kind),khoVoStyle=r=>khoVoNorm(KHO_VO_KIEU,r.style),khoVoColor=r=>khoVoNorm(KHO_VO_MAU,r.color);
const khoVoPart=(list,v)=>(list.find(x=>x[0]===v||x[0]===khoVoNorm(list,v))||[])[1]||String(v||"");
function khoVoComplete(r){return !!(khoVoKind(r)&&khoVoCap(r.capacity)&&khoVoColor(r))}
/* Mã chuẩn mới: VO-LOẠI-DUNG TÍCH-KIỂU-MÀU (+STT); thùng: TH-DUNG TÍCH-KIỂU-MÀU. Còn thiếu thì ghi ? đúng quy tắc. */
function khoVoNewCode(r){return String(r.new_code||"").trim()}
/* Một hệ mã duy nhất: mã MISA. Mã đề nghị chỉ là gợi ý bấm nút, người dùng tự quyết có đổi hay không. */
function khoVoCodeAuto(r){
  if(!r.kind&&!r.capacity&&!r.color)return "";
  const cap=khoVoCap(r.capacity)||"?",k=khoVoKind(r)||"?",c=khoVoColor(r)||"?";
  return (k==="THUNG"?"TH-"+cap:"VO-"+k+"-"+cap)+"-"+c+(r.seq?"-"+r.seq:"");
}
/* STT kế tiếp trong nhóm cùng loại + dung tích + màu: 01, 02, 03… Ảnh mới là thứ phân biệt hai vỏ, không phải dáng. */
function khoVoNextSeq(r,selfCode){
  const key=x=>khoVoKind(x)+"|"+khoVoCap(x.capacity)+"|"+khoVoColor(x),k0=key(r);
  const items=(KHO.vo&&KHO.vo.data&&KHO.vo.data.items)||[];let max=0;
  items.forEach(x=>{if(x.code===selfCode||key(x)!==k0)return;const n=parseInt(x.seq,10);if(n>max)max=n});
  return String(max+1).padStart(2,"0");
}
function khoVoTen(r){return String(r.std_name||"").trim()}
function khoVoTenAuto(r){
  const cap=khoVoCap(r.capacity),thung=khoVoKind(r)==="THUNG";
  const unit=/^\d/.test(cap)?(/ML$/.test(cap)?cap.replace(/ML$/,"ml"):(/KG$/.test(cap)?cap.replace(/KG$/,"kg"):(thung?cap:cap+"L"))):cap;
  const kind=(khoVoPart(KHO_VO_LOAI,r.kind)||"").split(/\s*\/\s*/)[0];
  return [kind,unit,khoVoPart(KHO_VO_MAU,r.color),r.seq?"số "+r.seq:""].filter(Boolean).join(" ");
}
/* Báo kết quả ngay trong cửa sổ vỏ: dải xanh "Đã lưu…" ở đầu cửa sổ, tự tắt sau vài giây (không dựng lại form). */
/* Thêm một ảnh vào vỏ đang mở (dán Ctrl+V từ Zalo, kéo thả, hoặc chọn file). Tự lấy ô ảnh trống kế tiếp (tối đa 4). */
async function khoVoAddPhoto(file){
  const S=KHO.vo;if(!S||!S.sel||!S.data)return;
  const cur=S.data.items.find(i=>i.code===S.sel);if(!cur)return;
  const have=khoVoHas(cur),idx=[1,2,3,4].find(n=>!have.includes(n));
  if(!idx){toast("Vỏ này đã đủ 4 ảnh. Xóa bớt một ảnh rồi thêm.");return}
  try{
    const im=await khoVoShrink(file);
    await kApi("/vo/"+encodeURIComponent(S.sel)+"/photo",{method:"PUT",body:JSON.stringify({image:im.image,thumb:im.thumb,idx:idx})});
    S.pi=idx;khoVoFlash("Đã thêm ảnh "+idx);await khoLoadVo(true);
  }catch(err){toast(err.message||"Chưa lưu được ảnh")}
}
function khoVoFlash(t){
  const S=KHO.vo;S.flash=t;clearTimeout(S._ft);
  S._ft=setTimeout(()=>{S.flash="";const e=document.getElementById("vo-flash");if(e)e.remove()},5000);
}
async function khoLoadVo(force){
  const S=KHO.vo||(KHO.vo={q:"",sel:"",data:null,busy:false});
  if(S.busy||(S.data&&!force))return;S.busy=true;
  try{S.data=await kApi("/vo")}catch(e){S.err=e.message}
  S.busy=false;if(PAGE==="kho_vo")renderMain();
}
/* File đơn giản: cột Mã MISA, Tên, Nhóm, Loại, Dung tích, Màu, STT, ĐVT, Ghi chú (tên cột gõ tiếng Việt, có dấu hay không đều được). */
function khoVoNhomFromText(t){
  const f=kfold(t);if(!f)return "";
  if(/thung|carton|hop/.test(f))return "THUNG";
  if(/phu kien|voi|nap|van|khoa/.test(f))return "PHUKIEN";
  if(/khac|bang|keo|day|decal|mang/.test(f))return "KHAC";
  return "VO";
}
function khoVoParseSimple(wb){
  const ws=wb.Sheets[wb.SheetNames[0]];if(!ws)return null;
  const g=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  const col=(h,names)=>h.findIndex(x=>names.some(n=>kfold(x).replace(/\s+/g," ").trim()===n||kfold(x).includes(n)));
  const hi=g.findIndex(r=>r.some(c=>/^ma(\s|$)/.test(kfold(c))||kfold(c).includes("ma misa")));
  if(hi<0)return null;
  const hn=g.findIndex(r=>r.some(c=>kfold(c).includes("hien tai")&&kfold(c).includes("ma")));
  if(hn>=0){
    const H=g[hn],f=c=>kfold(c).replace(/\s+/g," ");
    const cur=H.findIndex(c=>f(c).includes("ma")&&f(c).includes("hien tai")),fin=H.findIndex(c=>f(c).includes("ma")&&f(c).includes("chot"));
    const nCur=H.findIndex(c=>f(c).includes("ten")&&f(c).includes("hien tai")),nFin=H.findIndex(c=>f(c).includes("ten")&&f(c).includes("chot"));
    const gi=k=>H.findIndex(c=>f(c).includes(k)),iG=gi("nhom"),iK=gi("loai"),iC=gi("dung tich"),iM=gi("mau"),iS=H.findIndex(c=>f(c)==="stt"||f(c).includes("so thu tu")),iU=gi("dvt"),iN=gi("ghi chu");
    const v=(r,k)=>k>=0?String(r[k]==null?"":r[k]).trim():"";
    const out=[];
    g.slice(hn+1).forEach(r=>{
      const c0=v(r,cur),c1=v(r,fin),code=c0||c1;if(!code)return;
      const n0=v(r,nCur),n1=v(r,nFin);
      out.push({code:code,name:n1||n0,unit:v(r,iU),grp:khoVoNhomFromText(v(r,iG)),kind:khoVoNorm(KHO_VO_LOAI,v(r,iK)),capacity:khoVoCap(v(r,iC)),color:khoVoNorm(KHO_VO_MAU,v(r,iM)),seq:v(r,iS),note:v(r,iN),
        renameTo:c0&&c1&&c1!==c0?c1:"",rename:(c0&&c1&&c1!==c0)||(c0&&n1&&n0&&n1!==n0)?{code:c1||c0,name:n1||n0}:null})});
    return {vo:out,pack:[],err:"",simple:true};
  }
  const h=g[hi],ix={code:col(h,["ma misa","ma vat tu","ma"]),name:col(h,["ten"]),grp:col(h,["nhom"]),kind:col(h,["loai"]),cap:col(h,["dung tich"]),color:col(h,["mau"]),seq:col(h,["stt","so thu tu"]),unit:col(h,["dvt","don vi"]),note:col(h,["ghi chu"])};
  if(ix.code<0)return null;
  const val=(r,k)=>ix[k]>=0?String(r[ix[k]]==null?"":r[ix[k]]).trim():"";
  const vo=[];
  g.slice(hi+1).forEach(r=>{const code=val(r,"code");if(!code)return;
    vo.push({code:code,name:val(r,"name"),unit:val(r,"unit"),grp:khoVoNhomFromText(val(r,"grp")),kind:khoVoNorm(KHO_VO_LOAI,val(r,"kind")),capacity:khoVoCap(val(r,"cap")),color:khoVoNorm(KHO_VO_MAU,val(r,"color")),seq:val(r,"seq"),note:val(r,"note")})});
  return {vo:vo,pack:[],err:"",simple:true};
}
function khoVoParseFile(wb){
  if(!wb.Sheets["DOI_MA_VO"]&&!wb.Sheets["DM_THANH_PHAM"]){const sp=khoVoParseSimple(wb);if(sp)return sp;return {vo:[],pack:[],err:"Không đọc được file. Cần cột \"Mã MISA\" và \"Tên\" (bấm Tải file mẫu để xem)."}}
  const grid=n=>{const ws=wb.Sheets[n];return ws?XLSX.utils.sheet_to_json(ws,{header:1,defval:""}):null};
  const find=(rows,start)=>rows.findIndex(r=>String(r[0]||"").toLowerCase().startsWith(start));
  const out={vo:[],pack:[],err:""};
  const a=grid("DOI_MA_VO"),b=grid("DM_THANH_PHAM");
  if(!a&&!b){out.err="Không thấy sheet DOI_MA_VO hoặc DM_THANH_PHAM trong file.";return out}
  if(a){const h=find(a,"mã cũ");if(h>=0)a.slice(h+1).forEach(r=>{const code=String(r[0]||"").trim();if(!code)return;
    out.vo.push({code:code,kind:r[3],capacity:khoVoCap(r[4]),style:r[5],color:r[6],seq:r[7]})})}
  if(b){const h=find(b,"mã thành phẩm");if(h>=0)b.slice(h+1).forEach(r=>{const p=String(r[0]||"").trim();if(!p)return;
    out.pack.push({product:p,vo:r[7],thung:r[9]})})}
  return out;
}
/* Nén ảnh ở trình duyệt: cạnh dài tối đa 720px, JPEG ~80% (khoảng 50-100 KB). */
function khoVoShrink(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),img=new Image();
    const draw=(max,q)=>{const k=Math.min(1,max/Math.max(img.width,img.height)),cv=document.createElement("canvas");
      cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);
      const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(img,0,0,cv.width,cv.height);
      return cv.toDataURL("image/jpeg",q)};
    img.onload=()=>{const big=draw(720,0.8),thumb=draw(240,0.7);URL.revokeObjectURL(url);res({image:big,thumb:thumb})};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("Không đọc được ảnh "+file.name))};
    img.src=url;
  });
}
const khoVoSrc=(i,n,t)=>"/api/hub/kho/vo/"+encodeURIComponent(i.code)+"/photo?i="+(n||1)+(t?"&t=1":"")+"&v="+encodeURIComponent(i.photo_v||"");
const khoVoHas=i=>String(i.photo_idx||"").split(",").filter(Boolean).map(Number);
const khoVoImg=(i,big,n)=>khoVoHas(i).length&&khoVoHas(i).includes(n||1)?`<img src="${khoVoSrc(i,n,!big)}" alt="${esc(i.name)}" loading="lazy" style="width:100%;${big?"max-height:380px;":"height:150px;"}object-fit:contain;background:#f6f7f9;border-radius:8px">`
  :`<div style="height:${big?220:150}px;display:flex;align-items:center;justify-content:center;background:#f1f2f5;border-radius:8px;color:#9aa1ad;font-size:13px">Chưa có ảnh</div>`;
const khoVoOpts=(list,cur)=>`<option value="">? chưa rõ</option>`+list.map(x=>`<option value="${x[0]}"${x[0]===cur?" selected":""}>${x[0]} · ${x[1]}</option>`).join("")+(cur&&!list.some(x=>x[0]===cur)?`<option value="${esc(cur)}" selected>${esc(cur)}</option>`:"");

/* ---------- Tìm vỏ bằng ảnh: so hình dáng (bóng) của vỏ trong ảnh với ảnh các vỏ đã có, ngay trên trình duyệt ---------- */
function khoVoLoadImg(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error("Không đọc được ảnh"));im.src=src})}
function khoVoFeat(im){
  const N=64,cv=document.createElement("canvas");cv.width=N;cv.height=N;
  const cx=cv.getContext("2d",{willReadFrequently:true});cx.drawImage(im,0,0,N,N);
  const d=cx.getImageData(0,0,N,N).data,px=(x,y)=>{const i=(y*N+x)*4;return [d[i],d[i+1],d[i+2]]};
  let br=0,bg=0,bb=0,n=0;
  for(let i=0;i<N;i++)for(const [x,y] of [[i,0],[i,N-1],[0,i],[N-1,i]]){const c=px(x,y);br+=c[0];bg+=c[1];bb+=c[2];n++}
  br/=n;bg/=n;bb/=n;
  const fg=new Uint8Array(N*N);let x0=N,y0=N,x1=-1,y1=-1,cnt=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const c=px(x,y),dist=Math.abs(c[0]-br)+Math.abs(c[1]-bg)+Math.abs(c[2]-bb);
    if(dist>70){fg[y*N+x]=1;cnt++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
  if(cnt<N*N*0.02||cnt>N*N*0.92){x0=0;y0=0;x1=N-1;y1=N-1}
  const bw=x1-x0+1,bh=y1-y0+1,M=20,mask=new Uint8Array(M*M);
  for(let j=0;j<M;j++)for(let i=0;i<M;i++){let s2=0,t=0;
    const ax=x0+Math.floor(i*bw/M),bx=x0+Math.max(Math.floor((i+1)*bw/M),Math.floor(i*bw/M)+1),ay=y0+Math.floor(j*bh/M),by=y0+Math.max(Math.floor((j+1)*bh/M),Math.floor(j*bh/M)+1);
    for(let y=ay;y<by&&y<N;y++)for(let x=ax;x<bx&&x<N;x++){s2+=fg[y*N+x];t++}
    mask[j*M+i]=t&&s2/t>=0.5?1:0}
  return {mask:mask,asp:(bw*im.width/N)/(bh*im.height/N)};
}
function khoVoScore(a,b){
  let inter=0,uni=0;for(let i=0;i<a.mask.length;i++){const p=a.mask[i],q=b.mask[i];if(p&&q)inter++;if(p||q)uni++}
  const iou=uni?inter/uni:0;return iou-0.6*Math.abs(Math.log((a.asp||1)/(b.asp||1)));
}
async function khoVoImageSearch(file){
  const S=KHO.vo,D=S.data;if(!D)return;
  const url=URL.createObjectURL(file);
  try{
    const qi=await khoVoLoadImg(url),qf=khoVoFeat(qi);
    const cache=KHO.voFeat||(KHO.voFeat=new Map()),jobs=[];
    D.items.forEach(i=>khoVoHas(i).forEach(n=>jobs.push([i,n])));
    if(!jobs.length){toast("Chưa có vỏ nào có ảnh để so sánh. Hãy tải ảnh cho các vỏ trước.");return}
    toast("Đang so ảnh với "+jobs.length+" ảnh vỏ…");
    const best=new Map();
    for(let k=0;k<jobs.length;k+=6){
      await Promise.all(jobs.slice(k,k+6).map(async([i,n])=>{
        const key=i.code+"|"+n+"|"+(i.photo_v||"");let f=cache.get(key);
        if(!f){try{f=khoVoFeat(await khoVoLoadImg(khoVoSrc(i,n,true)));cache.set(key,f)}catch(e){return}}
        const sc=khoVoScore(qf,f);if(!best.has(i.code)||sc>best.get(i.code))best.set(i.code,sc)}));
    }
    S.imgRank=[...best.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(x=>x[0]);
    S.imgPrev=url;S.view="grid";S.sel="";renderMain();
  }catch(e){toast(e.message||"Chưa so được ảnh");URL.revokeObjectURL(url)}
}
function pKhoVo(m){
  const S=KHO.vo||(KHO.vo={q:"",sel:"",data:null,busy:false});
  if(!S.view)S.view="grid";if(S.flt==null)S.flt="";if(S.kind==null)S.kind="";if(S.pi==null)S.pi=1;if(S.tp==null)S.tp="";if(S.nhom==null)S.nhom="";
  S._modal="";
  khoLoadVo();
  khoFrame(m,"kho_vo","Vỏ can, chai & thùng","Tìm vỏ theo hình hoặc theo tên: bấm vào một vỏ để xem mã MISA, mã chuẩn mới, vỏ đó ghép vào thành phẩm nào và nhà cung cấp.",(()=>{
    const D=S.data;if(!D)return S.err?`<div class="note red">${esc(S.err)}</div>`:`<p class="hint">Đang tải danh sách vỏ…</p>`;
    const all=D.items,dupN=new Map();
    all.forEach(i=>{const t=khoVoNewCode(i);if(t&&t!==i.code)dupN.set(t,(dupN.get(t)||0)+1)});
    const allCodes=new Set([...KHO.items.keys()]);
    const isDup=i=>{const t=khoVoNewCode(i);return !!t&&t!==i.code&&(dupN.get(t)>1||allCodes.has(t))};
    const cnt={noimg:all.filter(i=>!khoVoHas(i).length).length,incomplete:all.filter(i=>!khoVoComplete(i)).length,nouse:all.filter(i=>!(D.used[i.code]||[]).length).length,noncc:all.filter(i=>!(D.ncc[i.code]||[]).length).length,dup:all.filter(isDup).length};
    const q=kfold(S.q).trim(),kinds=[...new Set(all.map(i=>khoVoKind(i)).filter(Boolean))].sort();
    const L0=all.filter(i=>(!S.kind||khoVoKind(i)===S.kind)&&(!S.tp||(D.used[i.code]||[]).includes(S.tp))
      &&(!S.nhom||khoVoNhom(i)===S.nhom)&&(!S.flt||(S.flt==="nocount"?i.count_qty==null:S.flt==="noimg"?!khoVoHas(i).length:S.flt==="incomplete"?!khoVoComplete(i):S.flt==="nouse"?!(D.used[i.code]||[]).length:S.flt==="noncc"?!(D.ncc[i.code]||[]).length:isDup(i)))
      &&(!q||q.split(/\s+/).every(w=>kfold([i.code,i.name,khoVoNewCode(i),khoVoTen(i),i.kind,i.capacity,i.style,i.color,i.note].concat((D.used[i.code]||[]).map(c=>c+" "+((KHO.items.get(c)||{}).name||""))).join(" ")).includes(w))));
    const L=S.imgRank?S.imgRank.map(c=>all.find(i=>i.code===c)).filter(Boolean):L0;
    const sel=all.find(i=>i.code===S.sel),use=sel?(D.used[sel.code]||[]):[],nccs=sel?(D.ncc[sel.code]||[]):[];
    const card=i=>{const n=(D.used[i.code]||[]).length,nc=khoVoNewCode(i),dp=isDup(i);return `<div class="vo-card" data-vo="${esc(i.code)}" style="cursor:pointer;border:1px solid ${i.code===S.sel?"#5b5bd6":"#e3e6ec"};border-radius:12px;padding:8px;background:#fff">
      ${khoVoImg(i)}<div style="font-weight:600;margin-top:6px;line-height:1.25">${esc(i.name)}</div>
      <div class="mono" style="font-size:12px;color:#555">${esc(i.code)}</div>
      
      ${n?`<div style="font-size:12px;color:#444;margin-top:4px;line-height:1.3">Dùng cho: ${(D.used[i.code]||[]).slice(0,2).map(c=>esc((KHO.items.get(c)||{}).name||c)).join("; ")}${n>2?" +"+(n-2)+" mã":""}</div>`:`<div style="font-size:12px;color:#9aa1ad;margin-top:4px">Chưa khai dùng cho mã nào</div>`}
      <div style="font-size:12px;color:#444;margin-top:4px">Tồn kho: <b>${knum(khoStock(i.code))}</b>${i.check_note?` · <span style="color:#b54708">${esc(i.check_note)}</span>`:""}</div>
      <div style="font-size:12px;margin-top:4px">${dp?`<span class="badge red">TRÙNG MÃ</span>`:""}</div></div>`};
    const tpName=S.tp?((KHO.items.get(S.tp)||{}).name||""):"";
    const isNew=!!S.adding,edit=D.can_edit&&(sel||isNew);
    const cur0=isNew?{code:"",name:"",kind:"",capacity:"",style:"",color:"",seq:"",note:"",new_code:"",std_name:"",grp_vo:S.nhom||"VO",grp:""}:sel,cur=cur0?Object.assign({},cur0):null;
    const ph=sel?khoVoHas(sel):[];
    let detail="";
    if(cur){
      const rowIn=(label,html,txt)=>`<tr><th style="width:190px">${label}</th><td>${edit?html:txt}</td></tr>`;
      const inp=(f,val,ph2,extra)=>`<input data-vf="${f}" value="${esc(val||"")}" placeholder="${esc(ph2||"")}" autocomplete="off" style="width:100%" ${extra||""}>`;
      
      detail=`<section id="vo-detail">${S.flash?`<div id="vo-flash" style="background:#ecfdf3;color:#067647;border:1px solid #abefc6;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-weight:600">✓ ${esc(S.flash)}</div>`:""}<div class="card-h"><h2>${isNew?"Thêm vỏ / thùng / phụ kiện mới":esc(sel.name)}</h2><span>${D.can_edit&&!isNew?`<button class="btn" id="vo-del">Gỡ khỏi danh sách</button> `:""}<button class="btn" id="vo-close">Đóng</button></span></div>
      <div style="display:grid;grid-template-columns:minmax(220px,340px) 1fr;gap:16px;align-items:start" class="vo-det">
        <div>${isNew?`<div style="height:200px;display:flex;align-items:center;justify-content:center;background:#f1f2f5;border-radius:8px;color:#9aa1ad;font-size:13px;text-align:center;padding:12px">Điền thông tin và bấm Lưu,<br>sau đó thêm ảnh ngay trong cửa sổ này</div>`:`${khoVoImg(sel,true,S.pi)}
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${[1,2,3,4].map(n=>ph.includes(n)?`<img src="${khoVoSrc(sel,n,true)}" data-pi="${n}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid ${n===S.pi?"#5b5bd6":"transparent"}">`:"").join("")}</div>
          ${edit?`<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn" id="vo-ph">${ph.length?"Thêm ảnh":"Tải ảnh"}</button>${ph.includes(S.pi)?`<button class="btn" id="vo-phd">Xóa ảnh này</button>`:""}<input type="file" id="vo-phf" accept="image/*" hidden></div><p class="hint">Ảnh 1 là ảnh chính diện, tối đa 4 ảnh. <b>Dán ảnh bằng Ctrl+V</b> (copy ảnh từ Zalo) hoặc kéo thả ảnh vào cửa sổ này.</p>`:""}`}</div>
        <div>
          <table class="data"><tbody>
            ${isNew?`<tr><th style="width:190px">Mã trong MISA *</th><td><input id="va-c" autocomplete="off" placeholder="Gõ để tìm mã có sẵn, hoặc nhập mã MISA mới" style="width:100%"></td></tr>
            <tr><th>Tên trong MISA *</th><td><input id="va-n" autocomplete="off" placeholder="Tên vỏ như trong MISA" style="width:100%"></td></tr>`
            :edit?`<tr><th style="width:190px">Mã trong MISA</th><td><input id="vo-code" value="${esc(cur.code)}" autocomplete="off" style="width:100%;font-family:monospace;font-weight:600"><div class="hint">Muốn đổi mã thì sửa thẳng ở đây rồi bấm Lưu. Web đổi mã ở mọi nơi dùng mã này; chị Huệ đổi cùng mã trên MISA.</div></td></tr>
            <tr><th>Tên trong MISA</th><td><input id="vo-name" value="${esc(cur.name)}" autocomplete="off" style="width:100%"></td></tr>`
            :`<tr><th style="width:190px">Mã trong MISA</th><td><b class="mono">${esc(cur.code)}</b></td></tr>
            <tr><th>Tên trong MISA</th><td>${esc(cur.name)}</td></tr>`}
            ${rowIn("Nhóm",`<select data-vf="grp" style="width:100%">${KHO_VO_NHOM.map(x=>`<option value="${x[0]}"${x[0]===khoVoNhom(cur)?" selected":""}>${x[1]}</option>`).join("")}</select>`,esc(khoVoPart(KHO_VO_NHOM,khoVoNhom(cur))))}
            ${rowIn("Loại",inp("kind",cur.kind,"can, chai, thùng…",'list="vo-dl-kind"'),esc(khoVoPart(KHO_VO_LOAI,cur.kind)||"—"))}
            ${rowIn("Dung tích",inp("capacity",cur.capacity,"3.6 · 5 · 0.5 · 500ml"),esc(khoVoCap(cur.capacity)||"—"))}
            ${rowIn("Màu",inp("color",cur.color,"trắng, đen, xanh…",'list="vo-dl-color"'),esc(khoVoPart(KHO_VO_MAU,cur.color)||"—"))}
            ${rowIn("Số thứ tự (STT)",`<input id="vo-seq" data-vf="seq" data-auto="0" value="${esc(cur.seq||"")}" autocomplete="off" style="width:120px"> <span class="hint">chỉ cần khi có nhiều vỏ giống nhau</span>`,esc(cur.seq||"—"))}
            ${isNew?"":`<tr><th>Tồn kho (hệ thống)</th><td><b>${knum(khoStock(cur.code))}</b> ${esc(cur.unit||"")}${cur.check_note?` · <span style="color:#b54708;font-weight:600">${esc(cur.check_note)}</span>`:""}<div class="hint">Số tự tính từ các phiếu nhập, xuất, kiểm kê. Chưa có phiếu thì bằng 0.</div></td></tr>`}
            ${rowIn("Ghi chú nhận biết (không bắt buộc)",inp("note",cur.note,"nắp xanh, có logo, cổ cao… hoặc để trống, nhìn ảnh là chính"),esc(cur.note||"—"))}
          </tbody></table>
          <datalist id="vo-dl-kind">${KHO_VO_LOAI.map(x=>`<option value="${x[1]}">`).join("")}</datalist>
          <datalist id="vo-dl-style">${KHO_VO_KIEU.map(x=>`<option value="${x[1]}">`).join("")}</datalist>
          <datalist id="vo-dl-color">${KHO_VO_MAU.map(x=>`<option value="${x[1]}">`).join("")}</datalist>
          ${!isNew&&isDup(sel)?`<div class="note red">Trùng mã với vỏ khác: đổi STT cho khác nhau.</div>`:""}
          
          <div id="vo-warn"></div>
          ${edit?`<div class="row7" style="margin:10px 0"><button class="btn pri" id="vo-save">${isNew?"Thêm vào danh sách":"Lưu"}</button><span id="vo-msg" class="hint"></span></div>`:""}
          ${isNew?"":`<h3 style="margin:14px 0 6px">Dùng cho ${use.length} thành phẩm</h3>
          <p class="hint">Có chai chỉ đóng nước giặt, có chai đóng lau sàn, có chai dùng cho nhiều mã. Khai ở đây để nhân sự nhìn chai ra ngay dùng cho mã nào.</p>
          ${use.length?`<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">${use.map(c=>{const byPack=(D.packed[sel.code]||[]).includes(c);return `<div style="display:flex;gap:8px;align-items:center;padding:4px 8px;border:1px solid #e3e6ec;border-radius:8px"><span class="mono" style="min-width:110px">${esc(c)}</span><span style="flex:1">${esc((KHO.items.get(c)||{}).name||"")}</span>${byPack?(edit?`<button class="lnk" data-uprm="${esc(c)}">✕ gỡ</button>`:""):'<span class="muted" style="font-size:12px">theo định mức</span>'}</div>`}).join("")}</div>`:`<p class="hint">Chưa khai thành phẩm nào.</p>`}
          ${edit?`<div style="display:flex;gap:8px;align-items:center"><input id="vo-up" placeholder="Gõ tên hoặc mã thành phẩm để thêm…" autocomplete="off" style="flex:1"><span id="vo-upmsg" class="hint"></span></div>`:""}
          <h3 style="margin:14px 0 6px">Nhà cung cấp</h3>
          ${edit?`<div id="vo-ncc">${(S.nccEdit||nccs).map((r,k)=>`<div class="frm" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin-bottom:6px;align-items:end">
              <label class="field">Tên NCC<input data-nf="name" data-k="${k}" value="${esc(r.name||"")}"></label>
              <label class="field">Mã / tên vỏ bên NCC<input data-nf="ncc_code" data-k="${k}" value="${esc(r.ncc_code||"")}"></label>
              ${D.can_price?`<label class="field">Giá báo<input data-nf="price" data-k="${k}" type="number" min="0" step="any" value="${r.price==null?"":r.price}"></label>`:""}
              <label class="field">Ngày báo giá<input data-nf="quote_date" data-k="${k}" type="date" value="${esc(r.quote_date||"")}"></label>
              <label class="field">Liên hệ<input data-nf="contact" data-k="${k}" value="${esc(r.contact||"")}"></label>
              <label class="inl"><input type="radio" name="vo-main" data-nm="${k}"${r.main?" checked":""}> NCC chính</label>
              <button class="lnk" data-nrm="${k}">✕ xóa</button></div>`).join("")||'<p class="hint">Chưa có nhà cung cấp.</p>'}
              <div class="row7"><button class="btn" id="vo-nadd">+ Thêm nhà cung cấp</button><button class="btn pri" id="vo-nsave">Lưu nhà cung cấp</button></div></div>`
          :(nccs.length?khoRows(["Nhà cung cấp","Mã bên NCC"].concat(D.can_price?["Giá báo"]:[]).concat(["Ngày","Liên hệ"]),nccs.map(r=>`<tr><td>${esc(r.name)}${r.main?' <span class="badge info">chính</span>':""}</td><td>${esc(r.ncc_code)}</td>${D.can_price?`<td class="n">${r.price==null?"":khoVnd(r.price)}</td>`:""}<td>${esc(r.quote_date)}</td><td>${esc(r.contact)}</td></tr>`)):`<p class="hint">Chưa có nhà cung cấp.</p>`)}`}
        </div></div></section>`;
    }
    S._modal=(sel||isNew)?`<div id="vo-modal" style="position:fixed;inset:0;background:rgba(15,18,30,.45);z-index:60;overflow:auto;padding:24px 12px"><div style="background:var(--card,#fff);color:inherit;border-radius:14px;max-width:1000px;margin:0 auto;padding:18px 20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.3)">${detail}</div></div>`:"";
    const modal="";
    const nh=k=>all.filter(i=>khoVoNhom(i)===k).length;
    const chip=(k,t,n)=>`<button class="btn${S.flt===k?" pri":""}" data-fl="${k}">${t}${n!=null?" ("+n+")":""}</button>`;
    return `<section class="card flush">
      <div class="pad" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="vo-q" placeholder="Tìm vỏ theo tên, mã, dung tích (3.6, 500ml) hoặc theo tên thành phẩm…" value="${esc(S.q)}" style="flex:1 1 260px;min-width:200px">
        ${D.can_edit?`<button class="btn pri" id="vo-new">+ Thêm vỏ mới</button>`:""}
        
        ${D.can_edit?`<button class="btn" id="vo-imp">Nạp từ file Excel</button><button class="btn" id="vo-tpl" title="Tải toàn bộ mã vỏ đang có để chốt mã rồi nạp lại">Tải danh sách mã hiện có</button><button class="btn" id="vo-rnl" title="Các vỏ đã đổi mã hoặc tên trên web, để chị Huệ đổi theo trên MISA">Tải danh sách đã đổi mã</button><input type="file" id="vo-file" accept=".xlsx,.xls" hidden>`:""}
      </div>
      <div class="pad" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-top:0">
        <span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm${S.nhom===""?" pri":""}" data-nh="">Tất cả (${all.length})</button>${KHO_VO_NHOM.map(x=>`<button class="btn sm${S.nhom===x[0]?" pri":""}" data-nh="${x[0]}">${x[1]} (${nh(x[0])})</button>`).join("")}</span>
        <span style="flex:1"></span>
        <button class="btn sm" id="vo-img">📷 Tìm bằng ảnh</button><input type="file" id="vo-imgf" accept="image/*" hidden>
        <span class="vo-seg" title="Kiểu hiển thị"><button class="${S.view==="grid"?"on":""}" data-vv="grid" title="Xem dạng ảnh">▦</button><button class="${S.view==="table"?"on":""}" data-vv="table" title="Xem dạng bảng">☰</button></span>
      </div>
      <p class="hint pad" style="padding-top:0">${L.length} / ${all.length} vỏ.${S.tp?` Đang lọc các vỏ dùng cho <b>${esc(tpName||S.tp)}</b>.`:""}${D.can_edit?"":" Bạn chỉ xem và tra cứu; CEO, Thảo và chị Huệ mới sửa được."}</p>
      ${S.imgRank?`<div class="pad" style="display:flex;gap:12px;align-items:center;background:#f4f3ff;border-radius:10px;margin:0 12px 8px"><img src="${S.imgPrev}" style="width:64px;height:64px;object-fit:contain;border-radius:8px;background:#fff"><div style="flex:1"><b>Gợi ý các vỏ có dáng gần giống ảnh chị tải lên</b><div class="hint">Xếp từ giống nhiều đến ít. Đây là gợi ý theo hình dáng, chị so lại bằng mắt rồi bấm vào vỏ để xem mã.</div></div><button class="btn" id="vo-imgx">Bỏ tìm bằng ảnh</button></div>`:""}
      ${all.length?"":`<p class="hint pad">Danh sách đang trống. Bấm <b>+ Thêm vỏ mới</b> để thêm từng mã.</p>`}
      ${S.view==="grid"?`<div class="pad" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px">${L.slice(0,120).map(card).join("")||'<p class="hint">Không có vỏ nào khớp.</p>'}</div>${L.length>120?`<p class="hint pad">Đang hiện 120 / ${L.length}. Gõ vào ô tìm để thu hẹp.</p>`:""}`
      :khoRows(["Ảnh","Mã MISA","Tên","Tồn kho","Ghi chú","Loại","Dung tích","Màu","Ghép vào"],L.slice(0,300).map(i=>{const n=(D.used[i.code]||[]).length;return `<tr class="clk" data-vo="${esc(i.code)}"><td style="width:56px">${khoVoHas(i).includes(1)?`<img src="${khoVoSrc(i,1,true)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px" loading="lazy">`:""}</td><td class="mono">${esc(i.code)}</td><td>${esc(i.name)}</td><td class="n">${knum(khoStock(i.code))}</td><td>${esc(i.check_note||"")}</td><td>${esc(i.kind)}</td><td>${esc(khoVoCap(i.capacity))}</td><td>${esc(i.color)}</td><td class="n">${n?n+" thành phẩm":""}</td></tr>`}))}
      </section>${modal}`})());
  {const R0=document.getElementById("vo-modal-root");
    if(!S._modal){if(R0)R0.remove()}
    else{let R=R0;if(!R){R=document.createElement("div");R.id="vo-modal-root";document.body.appendChild(R)}R.innerHTML=S._modal}
    if(!window.__voModalWatch)window.__voModalWatch=setInterval(()=>{if(PAGE!=="kho_vo"){const r=document.getElementById("vo-modal-root");if(r)r.remove()}},400)}
  if($("#vo-q"))$("#vo-q").oninput=()=>{S.q=$("#vo-q").value;const p=$("#vo-q").selectionStart;renderMain();const q=$("#vo-q");q.focus();try{q.setSelectionRange(p,p)}catch(e){}};
  if($("#vo-k"))$("#vo-k").onchange=e=>{S.kind=e.target.value;renderMain()};
  m.querySelectorAll("[data-vv]").forEach(b=>b.onclick=()=>{S.view=b.dataset.vv;renderMain()});
  m.querySelectorAll("[data-nh]").forEach(b=>b.onclick=()=>{S.nhom=b.dataset.nh;renderMain()});
  if($("#vo-nc0"))$("#vo-nc0").onclick=()=>{S.flt=S.flt==="nocount"?"":"nocount";renderMain()};
  if($("#vo-img"))$("#vo-img").onclick=()=>$("#vo-imgf").click();
  if($("#vo-imgf"))$("#vo-imgf").onchange=e=>{const f=e.target.files[0];e.target.value="";if(f)khoVoImageSearch(f)};
  if($("#vo-imgx"))$("#vo-imgx").onclick=()=>{S.imgRank=null;S.imgPrev="";renderMain()};
  m.querySelectorAll("[data-fl]").forEach(b=>b.onclick=()=>{S.flt=b.dataset.fl;renderMain()});
  m.querySelectorAll("[data-vo]").forEach(r=>r.onclick=()=>{S.sel=r.dataset.vo;S.pi=1;S.nccEdit=null;renderMain()});
  document.querySelectorAll("[data-pi]").forEach(b=>b.onclick=()=>{S.pi=+b.dataset.pi;renderMain()});
  const closeVo=()=>{S.sel="";S.adding=false;S.nccEdit=null;renderMain()};
  if($("#vo-close"))$("#vo-close").onclick=closeVo;
  if($("#vo-del"))$("#vo-del").onclick=async()=>{if(!confirm("Gỡ "+S.sel+" khỏi danh sách vỏ? Ảnh và nhà cung cấp của vỏ này sẽ mất; mã trong kho và định mức không bị ảnh hưởng."))return;
    try{await kApi("/vo/"+encodeURIComponent(S.sel),{method:"DELETE"});const c=S.sel;S.sel="";toast("Đã gỡ "+c);await khoLoadVo(true)}catch(err){toast(err.message)}};
  if($("#vo-modal"))$("#vo-modal").onmousedown=e=>{if(e.target.id==="vo-modal")closeVo()};
  if(S.escBound!==true){S.escBound=true;document.addEventListener("keydown",e=>{if(e.key==="Escape"&&PAGE==="kho_vo"&&(S.sel||S.adding)){S.sel="";S.adding=false;S.nccEdit=null;renderMain()}})}
  if($("#vo-new"))$("#vo-new").onclick=()=>{S.adding=true;S.sel="";renderMain();const c=$("#va-c");if(c)c.focus()};
  if($("#va-c"))khoPick($("#va-c"),null,it=>{$("#va-n").value=it.name;$("#va-n").dataset.exist="1"});
  /* Thông tin vỏ */
  const warn=()=>{const note=($("[data-vf=note]")||{}).value||"",f=kfold(note),hit=KHO_VO_CAM.find(w=>f.includes(kfold(w)));
    const stl=(($("[data-vf=style]")||{}).value||"").trim();
    if($("#vo-warn"))$("#vo-warn").innerHTML=stl.length>14?`<div class="note amb">Kiểu dáng đang dài. Nên ghi 1–2 từ (dẹt, vát, tròn…) và mô tả chi tiết ở ô "Điểm nhận biết" để mã chuẩn gọn.</div>`:hit?`<div class="note amb">"Điểm nhận biết" đang có "${esc(hit)}". Vỏ là đồ vật, không ghi thương hiệu hay tên sản phẩm ở đây.</div>`:""};
  const nf=$("[data-vf=note]");if(nf)nf.oninput=warn;warn();
  if($("#vo-save"))$("#vo-save").onclick=async()=>{
    const btn=$("#vo-save"),label=btn.textContent;
    const msg=t=>{if($("#vo-msg")){$("#vo-msg").textContent=t;$("#vo-msg").style.color="#b42318"}btn.disabled=false;btn.textContent=label};
    btn.disabled=true;btn.textContent="Đang lưu…";
    const body={};document.querySelectorAll("[data-vf]").forEach(x=>body[x.dataset.vf]=x.value);
    body.new_code="";body.std_name="";
    body.capacity=khoVoCap(body.capacity);body.kind=khoVoNorm(KHO_VO_LOAI,body.kind);body.style=khoVoStrict(KHO_VO_KIEU,body.style)||String(body.style||"").trim();body.color=khoVoNorm(KHO_VO_MAU,body.color);
    let code=S.sel;
    try{
      if(S.adding){
        code=($("#va-c").value||"").trim();const name=($("#va-n").value||"").trim();
        if(!code){msg("Cần nhập mã MISA");return}
        if(!KHO.items.has(code)){
          if(!name){msg("Mã này chưa có trong kho, cần nhập thêm tên");return}
          await kApi("/items",{method:"POST",body:JSON.stringify({code:code,name:name,unit:"Cái",cls:"NVL",grp:body.grp==="VO"?"Vỏ can, chai, túi":"Hộp, thùng, phụ kiện đóng gói"})});
        }
      }else{
        body.photo_url=(S.data.items.find(i=>i.code===S.sel)||{}).photo_url||"";
        const nc=($("#vo-code")||{}).value,nn=($("#vo-name")||{}).value,cur0=S.data.items.find(i=>i.code===S.sel)||{};
        const newCode=(nc==null?code:nc).trim(),newName=(nn==null?cur0.name:nn).trim();
        if(newCode!==code||newName!==cur0.name){
          if(!newCode||!newName){msg("Mã và tên không được để trống");return}
          if(newCode!==code&&!confirm("Đổi mã "+code+" thành "+newCode+"?\n\nWeb đổi mã này ở định mức, phiếu kho, ảnh và hồ sơ vỏ. Chị Huệ cần đổi cùng mã trên MISA để hai bên khớp."))return;
          await kApi("/vo/"+encodeURIComponent(code)+"/rename",{method:"POST",body:JSON.stringify({code:newCode,name:newName})});
          code=newCode;S.sel=newCode;
        }
      }
      await kApi("/vo/"+encodeURIComponent(code),{method:"PUT",body:JSON.stringify(body)});
      khoVoFlash(S.adding?"Đã thêm "+code+" vào danh sách":"Đã lưu thông tin vỏ "+code);
      S.adding=false;S.sel=code;S.pi=1;
      await khoLoad(true);await khoLoadVo(true);renderMain()
    }catch(e){msg(e.message||"Chưa lưu được")}};
  /* Thành phẩm dùng vỏ này */
  const saveUses=async list=>{try{await kApi("/vo/"+encodeURIComponent(S.sel)+"/uses",{method:"PUT",body:JSON.stringify({products:list})});khoVoFlash("Đã cập nhật các thành phẩm dùng vỏ này");await khoLoadVo(true)}catch(err){toast(err.message||"Chưa lưu được")}};
  if($("#vo-up"))khoPick($("#vo-up"),null,it=>{const cur=(S.data.packed[S.sel]||[]).slice();if(!cur.includes(it.code))cur.push(it.code);saveUses(cur)});
  document.querySelectorAll("[data-uprm]").forEach(b=>b.onclick=()=>saveUses((S.data.packed[S.sel]||[]).filter(c=>c!==b.dataset.uprm)));
  if(!window.__voPaste){window.__voPaste=true;
    document.addEventListener("paste",e=>{
      if(PAGE!=="kho_vo")return;const S2=KHO.vo;if(!S2||!S2.sel||!S2.data||!S2.data.can_edit)return;
      const it=[...((e.clipboardData&&e.clipboardData.items)||[])].find(x=>x.kind==="file"&&x.type.indexOf("image/")===0);
      if(!it)return;e.preventDefault();const f=it.getAsFile();if(f)khoVoAddPhoto(f)});
    document.addEventListener("dragover",e=>{if(PAGE==="kho_vo"&&KHO.vo&&KHO.vo.sel&&e.dataTransfer&&[...e.dataTransfer.types].includes("Files"))e.preventDefault()});
    document.addEventListener("drop",e=>{
      if(PAGE!=="kho_vo")return;const S2=KHO.vo;if(!S2||!S2.sel||!S2.data||!S2.data.can_edit)return;
      const fs=[...((e.dataTransfer&&e.dataTransfer.files)||[])].filter(f=>f.type.indexOf("image/")===0);
      if(!fs.length)return;e.preventDefault();(async()=>{for(const f of fs)await khoVoAddPhoto(f)})()})}
  /* Ảnh */
  const upPhoto=async(code,file,idx)=>{const im=await khoVoShrink(file);await kApi("/vo/"+encodeURIComponent(code)+"/photo",{method:"PUT",body:JSON.stringify({image:im.image,thumb:im.thumb,idx:idx||1})})};
  if($("#vo-ph"))$("#vo-ph").onclick=()=>$("#vo-phf").click();
  if($("#vo-phf"))$("#vo-phf").onchange=async e=>{const f=e.target.files[0];if(!f)return;
    const have=khoVoHas(S.data.items.find(i=>i.code===S.sel)||{}),idx=[1,2,3,4].find(n=>!have.includes(n));
    if(!idx){toast("Đã đủ 4 ảnh, xóa bớt một ảnh rồi thêm");e.target.value="";return}
    try{await upPhoto(S.sel,f,idx);S.pi=idx;khoVoFlash("Đã lưu ảnh");await khoLoadVo(true)}catch(err){toast(err.message||"Chưa lưu được ảnh")}e.target.value=""};
  if($("#vo-phd"))$("#vo-phd").onclick=async()=>{if(!confirm("Xóa ảnh này?"))return;
    try{await kApi("/vo/"+encodeURIComponent(S.sel)+"/photo/"+S.pi,{method:"DELETE"});S.pi=1;khoVoFlash("Đã xóa ảnh");await khoLoadVo(true)}catch(err){toast(err.message)}};
  if($("#vo-mph"))$("#vo-mph").onclick=()=>$("#vo-mphf").click();
  if($("#vo-mphf"))$("#vo-mphf").onchange=async e=>{const fs=[...e.target.files];if(!fs.length)return;
    const byKey=new Map(S.data.items.map(i=>[kfold(i.code).replace(/\s+/g,""),i.code]));let ok=0;const bad=[];
    for(const f of fs){const base=f.name.replace(/\.[^.]+$/,""),mm=/^(.*?)(?:[_-]([1-4]))?$/.exec(base),code=byKey.get(kfold(base).replace(/\s+/g,""))||byKey.get(kfold(mm[1]).replace(/\s+/g,"")),idx=byKey.get(kfold(base).replace(/\s+/g,""))?1:(mm[2]?+mm[2]:1);
      if(!code){bad.push(f.name);continue}
      try{await upPhoto(code,f,idx);ok++}catch(err){bad.push(f.name)}}
    toast("Đã tải "+ok+" ảnh"+(bad.length?" · "+bad.length+" ảnh không khớp mã: "+bad.slice(0,4).join(", "):""));
    await khoLoadVo(true);e.target.value=""};
  /* Nhà cung cấp */
  const nccRows=()=>S.nccEdit||(S.data.ncc[S.sel]||[]).map(r=>({...r}));
  const nccRead=()=>{const rows=nccRows();document.querySelectorAll("[data-nf]").forEach(x=>{const r=rows[+x.dataset.k];if(r)r[x.dataset.nf]=x.value});
    document.querySelectorAll("[data-nm]").forEach(x=>{const r=rows[+x.dataset.nm];if(r)r.main=x.checked?1:0});return rows};
  if($("#vo-nadd"))$("#vo-nadd").onclick=()=>{const r=nccRead();r.push({name:"",ncc_code:"",price:null,quote_date:"",contact:"",main:r.length?0:1});S.nccEdit=r;renderMain()};
  document.querySelectorAll("[data-nrm]").forEach(b=>b.onclick=()=>{const r=nccRead();r.splice(+b.dataset.nrm,1);S.nccEdit=r;renderMain()});
  if($("#vo-nsave"))$("#vo-nsave").onclick=async()=>{const rows=nccRead();
    try{await kApi("/vo/"+encodeURIComponent(S.sel)+"/ncc",{method:"PUT",body:JSON.stringify({rows:rows})});S.nccEdit=null;khoVoFlash("Đã lưu nhà cung cấp");await khoLoadVo(true)}catch(err){toast(err.message)}};
  /* Excel */
  if($("#vo-xl"))$("#vo-xl").onclick=()=>{
    if(typeof XLSX==="undefined"){toast("Chưa tải được công cụ Excel");return}
    const D=S.data,nm=c=>(KHO.items.get(c)||{}).name||"";
    const head=["Mã MISA","Tên","Nhóm","Loại","Dung tích","Kiểu","Màu","STT","Điểm nhận biết","Các sản phẩm đóng","NCC chính","Có ảnh"];
    const rows=D.items.map(i=>{const u=D.used[i.code]||[],n=(D.ncc[i.code]||[]).find(r=>r.main)||(D.ncc[i.code]||[])[0];
      return [i.code,i.name,khoVoPart(KHO_VO_NHOM,khoVoNhom(i)),i.kind,khoVoCap(i.capacity),i.style,i.color,i.seq,i.note,u.map(c=>c+" - "+nm(c)).join("; "),n?n.name:"",khoVoHas(i).length?"Có":""]});
    const pairs=[];D.items.forEach(i=>(D.used[i.code]||[]).forEach(c=>pairs.push([i.code,i.name,c,nm(c)])));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([head].concat(rows)),"VO_THUNG");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["Mã vỏ (MISA)","Tên vỏ","Mã thành phẩm","Tên thành phẩm"]].concat(pairs)),"VO_DUNG_CHO_TP");
    XLSX.writeFile(wb,"danh-muc-vo-"+new Date().toISOString().slice(0,10)+".xlsx")};
  /* Nạp file */
  if($("#vo-rnl"))$("#vo-rnl").onclick=async()=>{
    if(typeof XLSX==="undefined"){toast("Chưa tải được công cụ Excel");return}
    try{
      const R=await kApi("/vo/renames"),L=R.renamed||[],AD=R.added||[];
      if(!L.length&&!AD.length){toast("Chưa có vỏ nào đổi mã, đổi tên hoặc thêm mới trên web");return}
      const fd=t=>{const d=new Date(t);return isNaN(d)?"":d.toLocaleDateString("vi-VN")+" "+d.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})};
      const rows=[["STT","Mã MISA CŨ","Mã MISA MỚI","Loại thay đổi","Tên cũ","Tên mới","Ngày đổi trên web","Người đổi","Chị Huệ đã đổi trên MISA (ghi x)"]]
        .concat(L.map((r,k)=>[k+1,r.old_code,r.new_code,r.old_code!==r.new_code?"ĐỔI MÃ":"chỉ đổi tên",r.old_name,r.new_name,fd(r.at),r.by,""]));
      const ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
      ws["!cols"]=[{wch:5},{wch:24},{wch:24},{wch:14},{wch:34},{wch:34},{wch:18},{wch:14},{wch:24}];
      XLSX.utils.book_append_sheet(wb,ws,"DOI_MA");
      const ad=[["STT","Mã MISA mới thêm trên web","Tên","Ngày thêm","Người thêm","Chị Huệ đã tạo trên MISA (ghi x)"]].concat(AD.map((r,k)=>[k+1,r.code,r.name,fd(r.at),r.by,""]));
      const ws2=XLSX.utils.aoa_to_sheet(ad);ws2["!cols"]=[{wch:5},{wch:28},{wch:40},{wch:18},{wch:14},{wch:26}];
      XLSX.utils.book_append_sheet(wb,ws2,"MA_MOI_THEM");
      XLSX.writeFile(wb,"vo-da-doi-ma-"+new Date().toISOString().slice(0,10)+".xlsx");
      toast("Đã tải: "+L.length+" vỏ đổi mã / tên, "+AD.length+" mã mới thêm")
    }catch(err){toast(err.message||"Chưa tải được")}};
  if($("#vo-tpl"))$("#vo-tpl").onclick=()=>{
    if(typeof XLSX==="undefined"){toast("Chưa tải được công cụ Excel");return}
    const D=S.data,mine=new Map(D.items.map(i=>[i.code,i]));
    const base=[...KHO.items.values()].filter(i=>i.active&&(i.grp==="Vỏ can, chai, túi"||i.grp==="Hộp, thùng, phụ kiện đóng gói"||mine.has(i.code)));
    base.sort((a,b)=>a.code.localeCompare(b.code,"vi"));
    const rows=[["Mã MISA hiện tại","Mã MISA chốt (đổi thì sửa ở cột này)","Tên hiện tại","Tên chốt (đổi thì sửa ở cột này)","Nhóm","Loại","Dung tích","Màu","STT","ĐVT","Ghi chú"]];
    base.forEach(i=>{const v=mine.get(i.code)||{},it=Object.assign({},i,v);
      rows.push([i.code,i.code,i.name,i.name,khoVoPart(KHO_VO_NHOM,khoVoNhom(Object.assign({},it,{grp:i.grp,grp_vo:v.grp_vo||""}))),khoVoPart(KHO_VO_LOAI,v.kind||""),v.capacity||"",khoVoPart(KHO_VO_MAU,v.color||""),v.seq||"",i.unit||"Cái",v.note||""])});
    rows.push(["","","","","","","","","","","(Thêm mã mới: để trống 2 cột 'hiện tại', điền mã và tên vào 2 cột 'chốt')"]);
    const ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
    ws["!cols"]=[{wch:20},{wch:26},{wch:34},{wch:34},{wch:16},{wch:10},{wch:12},{wch:10},{wch:6},{wch:8},{wch:30}];ws["!freeze"]={ySplit:1};
    XLSX.utils.book_append_sheet(wb,ws,"VO");XLSX.writeFile(wb,"danh-sach-ma-vo-"+new Date().toISOString().slice(0,10)+".xlsx")};
  if($("#vo-imp"))$("#vo-imp").onclick=()=>$("#vo-file").click();
  if($("#vo-file"))$("#vo-file").onchange=async e=>{const f=e.target.files[0];if(!f)return;
    if(typeof XLSX==="undefined"){toast("Chưa tải được công cụ đọc Excel");return}
    try{const P=khoVoParseFile(XLSX.read(await f.arrayBuffer(),{type:"array"}));
      if(P.err){toast(P.err);return}
      if(!confirm("Nạp "+P.vo.length+" vỏ và "+P.pack.length+" thành phẩm từ file? Dữ liệu đã có sẽ được cập nhật theo file."))return;
      const ren=P.vo.filter(x=>x.rename);
      if(ren.length&&!confirm("File có "+ren.length+" vỏ đổi mã hoặc tên.\n\nWeb đổi ở định mức, phiếu kho, quy đổi, ảnh, hồ sơ vỏ. Chị Huệ cần đổi cùng như vậy trên MISA.\n\nTiếp tục?"))return;
      const r=await kApi("/vo/import",{method:"POST",body:JSON.stringify({vo:P.vo.map(x=>{const y=Object.assign({},x);delete y.rename;delete y.renameTo;return y}),pack:P.pack,create:!!P.simple})});
      let renOk=0;const renBad=[];
      for(const x of ren){
        try{await kApi("/vo/"+encodeURIComponent(x.code)+"/rename",{method:"POST",body:JSON.stringify({code:x.rename.code,name:x.rename.name})});renOk++}
        catch(e){renBad.push(x.code+": "+(e.message||"lỗi"))}
      }
      if(ren.length){toast("Đã đổi "+renOk+"/"+ren.length+" vỏ"+(renBad.length?" · lỗi: "+renBad.slice(0,3).join("; "):""));if(renOk)await khoLoad(true)}
      toast("Đã nạp "+r.vo+" vỏ"+(r.created?" (tạo mới "+r.created+" mã)":"")+(r.pack?", "+r.pack+" thành phẩm":"")+(r.missing.length?" · "+r.missing.length+" mã không có trong danh mục: "+r.missing.slice(0,5).join(", "):""));
      await khoLoadVo(true)}catch(err){toast(err.message||"Nạp file chưa được")}
    e.target.value=""};
}
PAGES.kho_vo=pKhoVo;

/* ---------- Xuất Kênh bán lẻ gọn 3 tầng: tab chính / một hàng nhóm + kênh + bộ lọc / tab nội dung + bảng ---------- */
function khoTidyOnline(m){
  const sub=m.querySelector("nav.kgsub");if(!sub||sub.dataset.tidy)return;
  const navs=[...m.querySelectorAll("nav.settabs")];
  const chNav=navs.find(n=>n.querySelector("[data-ont]")),viewNav=navs.find(n=>n.querySelector("[data-st]"));
  if(!chNav)return;sub.dataset.tidy="1";sub.classList.add("kg2");
  const dv=document.createElement("span");dv.className="dv";sub.appendChild(dv);
  [...chNav.querySelectorAll("button")].forEach(b=>{b.classList.add("chip");if(b.textContent.trim()==="Tổng quan")b.textContent="Tất cả";sub.appendChild(b)});
  chNav.remove();
  const head=m.querySelector("section.card > .card-h"),flt=head&&head.querySelector(".filters");
  if(flt){flt.classList.add("kg2r");const csv=flt.querySelector("#rc-csv");if(csv){csv.textContent="CSV ↓";csv.title="Tải tab này (CSV)";csv.setAttribute("aria-label","Tải tab này (CSV)")}sub.appendChild(flt)}
  if(head)head.remove();
  if(viewNav)viewNav.classList.add("uline")}
{const _o=PAGES.kho_online;PAGES.kho_online=m=>{_o(m);khoTidyOnline(m)}}

/* Lọc bảng Bán theo ngày theo khoảng ngày và tải báo cáo xuất (Excel): tổng hợp từng ngày + chi tiết từng dòng của các phiếu XL-<kênh>-<ngày>. */
async function khoOnRangeLoad(from,to){
  try{const d=await kApi(`/online/range?from=${from}&to=${to}`);KHO.onRange={from,to,data:d};renderMain()}catch(e){toast(e.message)}
}
function khoOnRangeBind(m){
  const iso=n=>{const d=new Date(Date.now()+7*3600e3-n*864e5);return d.toISOString().slice(0,10)};
  const go=(f,t)=>{if(!f||!t){toast("Chọn đủ từ ngày và đến ngày");return}khoOnRangeLoad(f,t)};
  const q=id=>m.querySelector(id);
  if(q("#rg-go"))q("#rg-go").onclick=()=>go(q("#rg-f").value,q("#rg-t").value);
  if(q("#rg-7"))q("#rg-7").onclick=()=>go(iso(6),iso(0));
  if(q("#rg-30"))q("#rg-30").onclick=()=>go(iso(29),iso(0));
  if(q("#rg-clr"))q("#rg-clr").onclick=()=>{KHO.onRange=null;renderMain()};
  if(q("#rg-x"))q("#rg-x").onclick=async()=>{
    if(typeof XLSX==="undefined"){toast("Chưa tải được công cụ Excel");return}
    let R=KHO.onRange&&KHO.onRange.data;
    if(!R){const f=q("#rg-f").value||iso(29),t=q("#rg-t").value||iso(0);try{R=await kApi(`/online/range?from=${f}&to=${t}`)}catch(e){toast(e.message);return}}
    const CHN={TIKTOK:"TikTok",SHOPEE:"Shopee",FACEBOOK:"Facebook"},CD={TIKTOK:"TT",SHOPEE:"SP",FACEBOOK:"FB"};
    const no=(c,d)=>"XL-"+CD[c]+"-"+String(d).replace(/-/g,"");
    const s1=[["Ngày","Số phiếu","Kênh","Số đơn","Sản phẩm đã trừ kho","Chưa có mã"]].concat(R.runs.map(r=>[r.day,no(r.channel,r.day),CHN[r.channel]||r.channel,r.orders==null?"":r.orders,r.qty,r.unmapped_qty]));
    const s2=[["Ngày","Số phiếu","Kênh","Mã","Tên sản phẩm","ĐVT","Số lượng"]].concat(R.lines.map(l=>[l.day,no(l.channel,l.day),CHN[l.channel]||l.channel,l.code,l.name,l.unit,l.qty]));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s1),"Tổng hợp theo ngày");XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s2),"Chi tiết phiếu");
    XLSX.writeFile(wb,"xuat-ban-le-"+R.from+"-den-"+R.to+".xlsx");
  };
}
/* Bảng "Bán theo ngày" ở tab Tất cả: bấm một ngày để xem các phiếu xuất bán lẻ của ngày đó (mỗi kênh một phiếu), in được. */
async function khoDayVouchers(day){
  let r;try{r=await kApi("/online/day?day="+day)}catch(e){toast(e.message);return}
  const CHN={TIKTOK:"TikTok",SHOPEE:"Shopee",FACEBOOK:"Facebook"};
  const blocks=r.vouchers.map(v=>{const tot=v.lines.reduce((s,l)=>s+l.qty,0);
    return `<section class="card" style="margin-bottom:10px"><div class="card-h"><h2>${v.no}</h2><span class="hint">Xuất bán lẻ ${CHN[v.channel]}${v.orders!=null?" · "+v.orders+" đơn":""}</span></div>
     ${v.lines.length?`<table class="tbl"><thead><tr><th>Mã</th><th>Sản phẩm</th><th class="n">Số lượng</th></tr></thead><tbody>${v.lines.map(l=>`<tr><td class="mono">${esc(l.code)}</td><td>${esc(l.name)}</td><td class="n">${knum(l.qty)}</td></tr>`).join("")}<tr><td colspan="2"><b>Tổng</b></td><td class="n"><b>${knum(tot)}</b></td></tr></tbody></table><div class="acts" style="margin-top:8px"><button class="btn" data-dvp="${v.channel}">In phiếu</button></div>`:`<p class="hint">Ngày này không có hàng trừ kho ở ${CHN[v.channel]} (không có đơn, hoặc chưa có mã vật tư).</p>`}</section>`}).join("");
  openDrawerHTML(`<h2>Phiếu xuất bán lẻ ngày ${kDd(day)}</h2><p class="hint">Tự lập từ đơn Poscake, sản phẩm đã tách combo. Mỗi ngày mỗi kênh một phiếu, số phiếu cố định.</p>${blocks}`);
  document.querySelectorAll("[data-dvp]").forEach(b=>b.onclick=()=>{
    const v=r.vouchers.find(x=>x.channel===b.dataset.dvp),tot=v.lines.reduce((s,l)=>s+l.qty,0),rows=v.lines.map(l=>`<tr><td>${esc(l.code)}</td><td>${esc(l.name)}</td><td class="n">${knum(l.qty)}</td></tr>`).join("");
    const w=window.open("","_blank");if(!w)return;
    w.document.write(`<html><head><meta charset="utf-8"><title>${v.no}</title><style>body{font:14px Arial;margin:28px}h1{font-size:20px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:14px}td,th{border:1px solid #444;padding:6px 8px;text-align:left}th.n,td.n{text-align:right}.sg{display:flex;justify-content:space-between;margin-top:46px;text-align:center}.sg div{width:30%}</style></head><body><h1>PHIẾU XUẤT KHO BÁN LẺ ${CHN[v.channel].toUpperCase()}</h1><div>Số phiếu: <b>${v.no}</b> · Ngày xuất: <b>${kDd(day)}</b>${v.orders!=null?" · Số đơn: "+v.orders:""}</div><table><thead><tr><th>Mã</th><th>Sản phẩm</th><th class="n">Số lượng</th></tr></thead><tbody>${rows}<tr><td colspan="2"><b>Tổng</b></td><td class="n"><b>${knum(tot)}</b></td></tr></tbody></table><div class="sg"><div>Người lập<br><br><br></div><div>Thủ kho<br><br><br></div><div>Kế toán<br><br><br></div></div><script>onload=()=>print()<\/script></body></html>`);w.document.close()});
}
/* Phiếu xuất bán lẻ theo ngày của từng kênh: mỗi ngày mỗi kênh một phiếu, số phiếu cố định XL-<kênh>-<ngày>. */
function khoVoucherOpen(i){
  const S=KHO.onForm||{},V=S.vch&&S.vch.days[i];if(!V)return;
  const CHN={TIKTOK:"TikTok",SHOPEE:"Shopee",FACEBOOK:"Facebook"}[S.vch.ch]||"";
  const rows=V.lines.map(l=>{const x=khoSplit(l.item);return `<tr><td class="mono">${esc(x.code)}</td><td>${esc(x.name)}</td><td class="n">${knum(l.qty)}</td></tr>`}).join("");
  const tot=V.lines.reduce((s,l)=>s+l.qty,0);
  openDrawerHTML(`<h2>${V.no}</h2><p class="hint">Phiếu xuất bán lẻ ${CHN} · ngày ${kDd(V.day)} · ${V.orders} đơn đã gửi · tự lập từ đơn Poscake, sản phẩm đã tách combo</p>
   <div class="card flush"><table class="tbl"><thead><tr><th>Mã</th><th>Sản phẩm</th><th class="n">Số lượng</th></tr></thead><tbody>${rows}<tr><td colspan="2"><b>Tổng</b></td><td class="n"><b>${knum(tot)}</b></td></tr></tbody></table></div>
   <div class="acts" style="margin-top:12px"><button class="btn pri" id="vch-pr">In phiếu</button></div>`);
  $("#vch-pr").onclick=()=>{const w=window.open("","_blank");if(!w)return;
    w.document.write(`<html><head><meta charset="utf-8"><title>${V.no}</title><style>body{font:14px Arial;margin:28px}h1{font-size:20px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:14px}td,th{border:1px solid #444;padding:6px 8px;text-align:left}th.n,td.n{text-align:right}.sg{display:flex;justify-content:space-between;margin-top:46px;text-align:center}.sg div{width:30%}</style></head><body><h1>PHIẾU XUẤT KHO BÁN LẺ ${CHN.toUpperCase()}</h1><div>Số phiếu: <b>${V.no}</b> · Ngày xuất: <b>${kDd(V.day)}</b> · Số đơn: ${V.orders}</div><table><thead><tr><th>Mã</th><th>Sản phẩm</th><th class="n">Số lượng</th></tr></thead><tbody>${rows}<tr><td colspan="2"><b>Tổng</b></td><td class="n"><b>${knum(tot)}</b></td></tr></tbody></table><div class="sg"><div>Người lập<br><br><br></div><div>Thủ kho<br><br><br></div><div>Kế toán<br><br><br></div></div><script>onload=()=>print()<\/script></body></html>`);w.document.close()}}
/* Bấm dòng hoặc nút "Xem phiếu" để mở phiếu xuất. Gắn cho cả trang vận hành (kho_online) và trang quản trị (kho_qd). */
for(const k of ["kho_online","kho_qd"]){const _o=PAGES[k];if(_o)PAGES[k]=m=>{_o(m);khoOnRangeBind(m);m.querySelectorAll("tr[data-dayv]").forEach(r=>r.onclick=()=>khoDayVouchers(r.dataset.dayv));m.querySelectorAll("tr[data-vch]").forEach(r=>r.onclick=e=>{if(e.target.closest("button")&&e.target.dataset.vch===undefined)return;khoVoucherOpen(+r.dataset.vch)})}}
