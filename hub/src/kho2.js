/* =====================================================================
   KHO VẬT TƯ (phần 2): nối kiểm kê lô của khối Sản xuất với sổ kho + đồng bộ mã CRM B2B → mã MISA.
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

/* ---------- Đồng bộ mã CRM B2B → mã MISA ---------- */
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
function pKhoMap(m){
  if(!KHO.mp)khoLoadMap();
  const M=KHO.mp||{},ceo=ME.role==="admin";
  khoFrame(m,"kho_map","Đồng bộ mã B2B","Đơn B2B trừ kho ngay khi CRM bấm Đã xuất kho. Số trừ = số trên đơn × hệ số (1 thùng = số can / chai trong thùng). Mã chưa đồng bộ thì chưa trừ.",`
  <section class="card"><div class="card-h"><h2>Ngày bắt đầu trừ kho theo đơn B2B</h2></div>
   ${M.b2b_from?`<p>Đang trừ từ <b>${kDd(M.b2b_from)}</b>. Đơn xuất trước ngày này coi như đã nằm trong tồn đầu kỳ.</p>`:`<div class="note amb">Chưa đặt ngày bắt đầu nên <b>chưa trừ kho theo đơn B2B</b>. Nên đặt đúng ngày kiểm kê tồn đầu.</div>`}
   ${ceo?`<div class="filters"><input type="date" id="mp-d" value="${M.b2b_from||kToday()}"><button class="btn" id="mp-save">Đặt ngày</button></div>`:""}</section>
  ${M.unmapped&&M.unmapped.length?`<section class="card"><div class="card-h"><h2>Đã xuất kho nhưng chưa có mã MISA (kho chưa trừ)</h2></div>${tbl(["Mã CRM","Tên","ĐVT","Số lượng đã xuất"],M.unmapped.map(u=>`<tr><td class="mono">${esc(u.sku)}</td><td>${esc(u.name)}</td><td>${esc(u.unit)}</td><td class="n">${knum(u.qty)}</td></tr>`))}</section>`:""}
  <section class="card flush"><div class="card-h pad"><h2>Bảng đồng bộ (${(M.map||[]).length} mã CRM)</h2>${ceo?`<label class="btn">Nạp file đồng bộ (.xlsx / .csv)<input type="file" id="mp-f" accept=".xlsx,.xls,.csv" hidden></label>`:""}</div>
   ${M.map?khoRows(["Mã CRM","Tên CRM","Mã MISA","Tên MISA","ĐVT kho","Hệ số","Ghi chú"],M.map.map(r=>`<tr><td class="mono">${esc(r.crm_sku)}</td><td>${esc(r.crm_name||"—")}</td><td class="mono">${esc(r.misa_code)}</td><td>${esc(r.misa_name||"")}</td><td>${esc(r.misa_unit||"")}</td><td class="n">${knum(r.factor)}</td><td>${esc(r.note||"")}</td></tr>`)):`<p class="hint pad">Đang tải…</p>`}</section>`);
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
PAGES.kho_map=pKhoMap;
// Trang "Nguyên vật liệu" cũ đã bỏ (kỹ thuật ghi số thực tế ở phiếu Pha chế): ai còn nhớ đường dẫn cũ thì chuyển sang Pha chế.
PAGES.sx_nvl=m=>PAGES.kho_pc(m);
