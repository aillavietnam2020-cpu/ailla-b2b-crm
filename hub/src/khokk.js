/* =====================================================================
   KIỂM KÊ VÀ ĐIỀU CHỈNH (chị Hoa duyệt bản xem thử 18/11/2026). Trang Kho – Sản xuất › Kiểm kê tồn.
   - Phiếu kiểm tồn (KK): kho / kế toán ghi số đếm + đơn giá (gõ tay hoặc tải Excel). Không đổi sổ.
   - Mở phiếu: bảng chênh lệch số đếm − số sổ; Kế toán lập Phiếu điều chỉnh (DC): thừa cộng, thiếu trừ; dòng chưa rõ nguyên nhân thì treo.
   - Phiếu treo: Gỡ treo (đã tìm ra) hoặc Hạch toán (cuối năm).
   - Tồn đầu kỳ: Kế toán lập, CEO duyệt. Phiếu tồn cũ sau mốc: CEO đổi thành phiếu kiểm tồn.
   Nạp SAU kho.js, kho2.js.
   ===================================================================== */
Object.assign(KHO_TYPES,{
  KK:{page:"kho_kk",name:"Phiếu kiểm tồn",who:["sx.kiemke","order.approve.normal","order.accounting.confirm"],hint:"Số đếm thực tế từng mã và đơn giá. Sổ kho không đổi; mở phiếu để xem chênh lệch và lập phiếu điều chỉnh."},
  DC:{page:"kho_kk",name:"Phiếu điều chỉnh kiểm kê",who:[],hint:"Lập từ bảng chênh lệch của phiếu kiểm tồn."}});
KHO_TYPES.TB.hint="Đếm thực tế rồi ghi số đếm và đơn giá từng mã, ngày phiếu = ngày đếm. Phiếu kiểm tồn không đổi sổ: mở phiếu để xem chênh lệch với sổ, Kế toán lập phiếu điều chỉnh (thừa nhập, thiếu xuất, chưa rõ nguyên nhân thì treo).";
const KKX={docs:null,treo:null,busy:false};
const kkKeToan=()=>!!ME&&(ME.role==="admin"||can(ME,"order.accounting.confirm"));
const kkCanLap=()=>!!ME&&(ME.role==="admin"||kCan("KK"));
async function kkLoadAll(){if(KKX.busy)return;KKX.busy=true;
  try{const [d,t]=await Promise.all([kApi("/docs?type=KK"),kApi("/treo")]);KKX.docs=d;KKX.treo=t}catch(e){KKX.docs=KKX.docs||[];KKX.treo=KKX.treo||[];toast(e.message)}
  KKX.busy=false;if(PAGE==="kho_kk")renderMain()}
const kkEx=d=>{try{return JSON.parse(d.extra||"{}")}catch(e){return {}}};
function kkCard(m){
  if(!KKX.docs&&!KKX.busy)kkLoadAll();
  const D=KKX.docs,T=KKX.treo||[],kt=kkKeToan(),nTreo=T.filter(x=>x.st==="TREO").length;
  const card=document.createElement("section");card.className="card flush";card.style.marginBottom="12px";
  card.innerHTML=`<div class="card-h pad"><h2>Phiếu kiểm tồn & điều chỉnh</h2><span class="hint">Đếm thực tế ghi vào phiếu kiểm tồn (sổ không đổi). Bấm số phiếu xem chênh lệch với sổ, Kế toán lập phiếu điều chỉnh: thừa nhập, thiếu xuất, chưa rõ nguyên nhân thì treo.</span><span class="sp"></span>
   ${kkCanLap()?`<button class="btn pri" id="kk-new">+ Lập phiếu kiểm tồn</button> <button class="btn" id="kk-up">⬆ Tải phiếu kiểm tồn từ Excel</button> <button class="btn" id="kk-tpl">⬇ File mẫu kiểm tồn</button>`:""}
   ${kt&&ME.role!=="admin"?` <button class="btn" id="kk-td2">Lập phiếu tồn đầu kỳ (CEO duyệt)</button>`:""}</div>
   ${D?(D.length?tbl(["Số phiếu","Ngày đếm","Số mã","Người lập","Trạng thái"],D.map(d=>{const ex=kkEx(d);return `<tr class="clk" data-kk="${d.id}"><td><b>${esc(d.no)}</b>${ex.tu_td?`<small class="hint" style="display:block">từ phiếu tồn ${esc(ex.tu_td)}</small>`:""}</td><td>${kDd(d.doc_date)}</td><td class="n">${(ex.lines||[]).length}</td><td>${esc(d.created_by_name||"—")}</td><td>${d.status==="OK"?pill("Hiệu lực","grn"):pill("Đã hủy","gry")}</td></tr>`})):`<p class="hint pad">Chưa có phiếu kiểm tồn.</p>`):`<p class="hint pad">Đang tải…</p>`}`;
  const tc=document.createElement("section");tc.className="card flush";tc.style.marginBottom="12px";
  tc.innerHTML=`<div class="card-h pad"><h2>Phiếu treo · ${nTreo} dòng đang treo</h2><span class="hint">Chênh lệch chưa rõ nguyên nhân: kho đã theo số đếm, tiền chưa hạch toán chi phí. Tìm ra thì Gỡ treo, cuối năm còn lại thì Hạch toán.</span></div>
   ${T.length?tbl(["Phiếu điều chỉnh","Ngày","Phiếu kiểm","Mã","Số lượng","Giá trị","Lý do","Trạng thái",""],T.map((x,i)=>{const it=KHO.items.get(x.item);return `<tr><td class="mono"><a href="#" class="lnk" data-dd="${x.doc_id}">${esc(x.no)}</a></td><td>${kDd(x.doc_date)}</td><td class="mono">${esc(x.kk||"")}</td><td>${esc(x.item)}<small class="hint" style="display:block">${esc(it?it.name:"")}</small></td><td class="n">${knum(x.qty)}</td><td class="n">${x.gia!=null?nf(Math.round(x.qty*x.gia)):"—"}</td><td>${esc(x.ly_do||"")}${x.ghi_chu?`<small class="hint" style="display:block">${esc(x.ghi_chu)}</small>`:""}</td><td>${x.st==="TREO"?pill("Đang treo","amb"):x.st==="DA_GO"?pill("Đã gỡ treo","grn"):pill("Đã hạch toán","gry")}</td><td style="white-space:nowrap">${kt&&x.st==="TREO"?`<button class="btn sm" data-tg="${i}" data-a="go">Gỡ treo</button> <button class="btn sm" data-tg="${i}" data-a="ht">Hạch toán</button>`:""}</td></tr>`})):`<p class="hint pad">Không có dòng treo.</p>`}`;
  const first=m.querySelector("section.card");if(first){first.before(card);card.after(tc)}else{m.appendChild(card);m.appendChild(tc)}
  card.querySelectorAll("[data-kk]").forEach(tr=>tr.onclick=()=>kkOpen(+tr.dataset.kk));
  tc.querySelectorAll("[data-dd]").forEach(a=>a.onclick=e=>{e.preventDefault();khoOpenDoc(+a.dataset.dd)});
  tc.querySelectorAll("[data-tg]").forEach(b=>b.onclick=async()=>{const x=T[+b.dataset.tg],go=b.dataset.a==="go";
    const g=prompt(go?"Gỡ treo "+x.item+": ghi nguyên nhân đã tìm ra / phiếu đã lập":"Hạch toán dòng treo "+x.item+" vào chi phí: ghi chú");if(g===null)return;
    try{await kApi("/dc/"+x.doc_id+"/treo",{method:"POST",body:JSON.stringify({item:x.item,action:go?"go":"ht",ghi_chu:g})});toast(go?"Đã gỡ treo":"Đã hạch toán");KKX.docs=null;kkLoadAll()}catch(e){toast(e.message)}});
  if($("#kk-new"))$("#kk-new").onclick=()=>khoForm("TB");
  if($("#kk-tpl"))$("#kk-tpl").onclick=async()=>{const b=$("#kk-tpl");b.disabled=true;try{await kkTemplate()}catch(e){toast(e.message)}b.disabled=false};
  if($("#kk-up"))$("#kk-up").onclick=kkUpload;
  if($("#kk-td2"))$("#kk-td2").onclick=()=>khoTdImport();
}
/* Mở phiếu kiểm tồn: bảng chênh lệch + lập phiếu điều chỉnh. */
async function kkOpen(id){
  let r;try{r=await kApi("/kk/"+id)}catch(e){toast(e.message);return}
  const kt=kkKeToan(),lech=r.rows.filter(x=>x.cl!==0),val=x=>x.gia!=null?Math.round(x.cl*x.gia):null;
  const tot=lech.reduce((s,x)=>s+(val(x)||0),0),thua=lech.filter(x=>x.cl>0).length;
  const row=(x,i)=>{const it=KHO.items.get(x.item)||{name:"",unit:""};return `<tr${x.cl===0?' class="kk-khop" hidden':""}><td class="mono">${esc(x.item)}</td><td>${esc(it.name)}</td><td>${esc(it.unit)}</td><td class="n">${knum(x.so)}</td><td class="n"><b>${knum(x.dem)}</b></td><td class="n">${x.cl===0?pill("Khớp","grn"):x.cl>0?pill("Thừa "+knum(x.cl),"blu"):pill("Thiếu "+knum(-x.cl),"red")}</td><td class="n">${val(x)!=null&&x.cl?nf(val(x)):""}</td>
    <td>${x.cl&&!r.dc&&kt?`<label class="inl"><input type="checkbox" class="kk-tr" data-i="${esc(x.item)}"> Treo</label>`:x.cl&&!r.dc?"—":""}</td><td>${x.cl&&!r.dc&&kt?`<input class="kk-ly" data-i="${esc(x.item)}" placeholder="Lý do" style="width:100%">`:esc(x.note||"")}</td></tr>`};
  openDrawerHTML(`<h2>${esc(r.doc.no)} · Phiếu kiểm tồn ${r.doc.status==="OK"?pill("Hiệu lực","grn"):pill("Đã hủy","gry")}</h2>
   <p class="hint">Ngày đếm ${kDd(r.doc.doc_date)} · ${r.rows.length} mã · <b>${lech.length}</b> mã lệch (${thua} thừa, ${lech.length-thua} thiếu)${tot?` · giá trị chênh ${nf(tot)} đ`:""}. Số sổ = tồn trên web đến hết ngày đếm${r.dc?", trước điều chỉnh":""}.</p>
   ${r.dc?`<div class="note">Đã điều chỉnh bằng phiếu <a href="#" class="lnk" id="kk-dc">${esc(r.dc.no)}</a>. Muốn làm lại thì hủy phiếu điều chỉnh đó rồi lập lại.</div>`:""}
   <label class="inl"><input type="checkbox" id="kk-all"> Hiện cả mã khớp</label>
   <div class="tbl"><table><thead><tr><th>Mã</th><th>Tên</th><th>ĐVT</th><th class="n">Số sổ</th><th class="n">Số đếm</th><th class="n">Chênh lệch</th><th class="n">Giá trị</th><th>Treo</th><th>Lý do / ghi chú</th></tr></thead><tbody>${r.rows.map(row).join("")}</tbody></table></div>
   ${!r.dc&&kt&&lech.length&&r.doc.status==="OK"?`<div class="row7"><button class="btn pri" id="kk-go">Lập phiếu điều chỉnh (${lech.length} dòng)</button><span class="hint">Thừa: nhập; thiếu: xuất; dòng tích Treo: vẫn vào kho, tiền chưa hạch toán chi phí.</span></div>`:""}
   <div class="row7"><button class="btn" id="kk-base">Xem phiếu gốc / in / hủy</button></div>`);
  $("#kk-all").onchange=e=>document.querySelectorAll("#drawer .kk-khop").forEach(tr=>tr.hidden=!e.target.checked);
  if($("#kk-dc"))$("#kk-dc").onclick=e=>{e.preventDefault();khoOpenDoc(r.dc.id)};
  $("#kk-base").onclick=()=>kkOrig(id);
  if($("#kk-go"))$("#kk-go").onclick=async()=>{
    const treo={},ly={};document.querySelectorAll("#drawer .kk-ly").forEach(i=>{if(i.value.trim())ly[i.dataset.i]=i.value.trim()});
    document.querySelectorAll("#drawer .kk-tr").forEach(c=>{if(c.checked)treo[c.dataset.i]=ly[c.dataset.i]||""});
    if(!confirm(`Lập phiếu điều chỉnh ${lech.length} dòng${Object.keys(treo).length?" ("+Object.keys(treo).length+" dòng treo)":""}? Tồn ngày ${kDd(r.doc.doc_date)} sẽ theo số đếm.`))return;
    $("#kk-go").disabled=true;
    try{const x=await kApi("/kk/"+id+"/dieu-chinh",{method:"POST",body:JSON.stringify({treo,ly_do:ly})});toast("Đã lập phiếu "+x.no);KKX.docs=null;KHO.at=0;KHO.nxt=null;await khoLoad(true);kkLoadAll();kkOpen(id)}
    catch(e){$("#kk-go").disabled=false;toast(e.message)}};
}
/* File mẫu kiểm tồn: mọi mã đang dùng, điền số đếm + đơn giá vào ô vàng; mã không đếm thì để trống. */
async function kkTemplate(){
  await khoLoadExcelJS();
  const wb=new ExcelJS.Workbook(),thin={style:"thin",color:{argb:"FFB8C0CC"}},bd={top:thin,left:thin,bottom:thin,right:thin},solid=h=>({type:"pattern",pattern:"solid",fgColor:{argb:"FF"+h}});
  const ORD=["NVL","BTP","TP","HH","CCDC","COMBO"];
  const A=[...KHO.items.values()].filter(i=>i.active&&i.cls!=="COMBO").sort((a,b)=>ORD.indexOf(a.cls)-ORD.indexOf(b.cls)||String(a.grp||"").localeCompare(String(b.grp||""),"vi")||a.name.localeCompare(b.name,"vi"));
  const ws=wb.addWorksheet("KIEM_TON",{views:[{state:"frozen",ySplit:4}]});
  ws.columns=[{width:22},{width:50},{width:9},{width:22},{width:18},{width:16},{width:30}];
  ws.mergeCells("A1:G1");const t=ws.getCell("A1");t.value="PHIẾU KIỂM TỒN";t.font={name:"Arial",size:16,bold:true,color:{argb:"FFFFFFFF"}};t.fill=solid("1B2A49");t.alignment={vertical:"middle",horizontal:"center"};ws.getRow(1).height=30;
  ws.mergeCells("A2:G2");const h=ws.getCell("A2");h.value="Điền SỐ LƯỢNG ĐẾM và ĐƠN GIÁ vào các ô màu vàng. Mã không đếm thì để trống (không ghi 0). Đếm được 0 thì ghi 0. Không sửa cột Mã. Ngày đếm chọn trên web khi tải lên.";h.font={name:"Arial",size:10,italic:true,color:{argb:"FF4A5568"}};h.alignment={wrapText:true,vertical:"middle"};ws.getRow(2).height=34;
  const head=ws.getRow(4);["Mã","Tên","ĐVT","Nhóm","Số lượng đếm","Đơn giá","Ghi chú"].forEach((x,i)=>{const c=head.getCell(i+1);c.value=x;c.font={name:"Arial",bold:true,color:{argb:"FFFFFFFF"}};c.fill=solid("1B2A49");c.border=bd;c.alignment={horizontal:"center",vertical:"middle"}});head.height=24;
  A.forEach((it,k)=>{const row=ws.getRow(5+k);row.getCell(1).value=it.code;row.getCell(2).value=it.name;row.getCell(3).value=it.unit;row.getCell(4).value=(KHO_CLS[it.cls]||it.cls)+(it.grp?" · "+it.grp:"");
    for(let c=1;c<=7;c++){const x=row.getCell(c);x.border=bd;x.font={name:"Arial",size:10};x.fill=solid(c===5||c===6?"FFF59D":k%2?"F4F6FA":"FFFFFF")}
    row.getCell(1).font={name:"Consolas",size:10};row.getCell(5).numFmt="#,##0.###";row.getCell(6).numFmt="#,##0"});
  const buf=await wb.xlsx.writeBuffer(),a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));a.download="Mau_kiem_ton.xlsx";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
/* Tải phiếu kiểm tồn từ Excel (file mẫu hoặc bảng có cột Mã, Số lượng đếm, Đơn giá). */
function kkUpload(){
  openDrawerHTML(`<h2>Tải phiếu kiểm tồn từ Excel</h2><p class="hint">Dùng file mẫu kiểm tồn (nút "File mẫu kiểm tồn"), hoặc bảng có cột Mã, Số lượng đếm, Đơn giá. Chỉ dòng có số đếm mới vào phiếu. Xem trước rồi mới ghi.</p>
   <div class="row7"><label class="field">Ngày đếm<input type="date" id="ku-d" value="${kToday()}"></label><label class="btn pri">Chọn file Excel<input type="file" id="ku-f" accept=".xlsx,.xls" hidden></label></div><div id="ku-out"></div>`);
  $("#ku-f").onchange=async e=>{const file=e.target.files[0];if(!file)return;const out=$("#ku-out");
    try{if(typeof XLSX==="undefined")throw new Error("Chưa tải được thư viện đọc Excel");
      const raw=khoParseTdFile(XLSX.read(await file.arrayBuffer(),{type:"array"}));
      const good=new Map(),bad=[],unknown=[],dup=[];
      raw.forEach(r=>{if(!Number.isFinite(r.qty)||r.qty<0){bad.push(r);return}const m=khoTdResolve(r.raw);if(!m.code){unknown.push(r);return}
        if(good.has(m.code)){dup.push(r);good.get(m.code).qty+=r.qty;return}good.set(m.code,{item:m.code,qty:r.qty,price:Number.isFinite(r.price)?r.price:undefined})});
      const L=[...good.values()],miss=a=>a.slice(0,15).map(r=>esc(r.raw)+" (dòng "+r.line+")").join(", ");
      out.innerHTML=`<div class="grid kpis">${kpi("Mã ghi được",L.length)}${kpi("Không ra mã",unknown.length)}${kpi("Số lỗi",bad.length)}${kpi("Mã lặp (đã cộng)",dup.length)}</div>
       ${unknown.length?`<div class="note amb">Không tìm ra mã: ${miss(unknown)}</div>`:""}${bad.length?`<div class="note amb">Số đếm không đọc được: ${miss(bad)}</div>`:""}
       ${L.length?tbl(["Mã","Tên","ĐVT","Số đếm","Đơn giá","Tồn sổ hiện tại"],L.slice(0,300).map(g=>{const it=KHO.items.get(g.item);return `<tr><td class="mono">${esc(g.item)}</td><td>${esc(it.name)}</td><td>${esc(it.unit)}</td><td class="n"><b>${knum(g.qty)}</b></td><td class="n">${g.price!=null?nf(g.price):"—"}</td><td class="n">${knum(khoStock(g.item))}</td></tr>`}))+`<div class="row7"><button class="btn pri" id="ku-ok">Ghi phiếu kiểm tồn (${L.length} mã)</button></div>`:`<p class="hint">Không có dòng nào có số đếm.</p>`}`;
      if($("#ku-ok"))$("#ku-ok").onclick=async()=>{const d=$("#ku-d").value;if(!d){toast("Chọn ngày đếm");return}$("#ku-ok").disabled=true;
        try{const r=await kApi("/docs",{method:"POST",body:JSON.stringify({type:"KK",date:d,note:"Tải từ file "+file.name,lines:L})});toast("Đã ghi phiếu "+r.no);KKX.docs=null;kkLoadAll();kkOpen(r.id)}catch(err){$("#ku-ok").disabled=false;toast(err.message)}};
    }catch(err){out.innerHTML=`<div class="note red">Chưa đọc được file: ${esc(err.message)}</div>`}finally{e.target.value=""}};
}
/* Phiếu gốc (xem / in / hủy) dùng màn chung; phiếu tồn chờ duyệt có nút CEO duyệt, phiếu tồn sau mốc có nút đổi thành phiếu kiểm tồn. */
const kkOrig=khoOpenDoc;
khoOpenDoc=async function(id,w){
  let d=null;try{d=(await kApi("/docs/"+id)).doc}catch(e){}
  if(d&&d.type==="KK"&&!w&&!kkOpen._base){return kkOpen(id)}
  kkOpen._base=false;await kkOrig(id,w);if(!d||d.type!=="TD"||ME.role!=="admin")return;
  const h=document.querySelector("#drawerIn h2");if(!h)return;
  const moc=typeof KTON!=="undefined"&&KTON.moc?KTON.moc.moc:null;
  if(d.status==="CHO")h.insertAdjacentHTML("afterend",`<div class="note amb">Phiếu tồn đầu kỳ do Kế toán lập, đang chờ CEO duyệt. Duyệt xong mới vào sổ${kkEx(d).moc?" và thành mốc tồn chung":""}. <button class="btn pri" id="kk-duyet">CEO duyệt</button></div>`);
  else if(d.status==="OK"&&moc&&d.doc_date>moc)h.insertAdjacentHTML("afterend",`<div class="note">Phiếu tồn sau mốc chung đang ghi đè sổ các mã trong phiếu. <button class="btn" id="kk-tokk">Đổi thành phiếu kiểm tồn</button> (ra bảng chênh lệch để lập phiếu điều chỉnh)</div>`);
  if($("#kk-duyet"))$("#kk-duyet").onclick=async()=>{try{await kApi("/docs/"+id+"/duyet",{method:"POST",body:"{}"});toast("Đã duyệt");KHO.at=0;KHO.list={};await khoLoad(true);khoOpenDoc(id)}catch(e){toast(e.message)}};
  if($("#kk-tokk"))$("#kk-tokk").onclick=async()=>{if(!confirm("Đổi phiếu "+d.no+" thành phiếu kiểm tồn? Sổ các mã trong phiếu sẽ tính liên tục, chênh lệch xử lý bằng phiếu điều chỉnh."))return;
    try{await kApi("/docs/"+id+"/to-kk",{method:"POST",body:"{}"});toast("Đã đổi");KHO.at=0;KHO.list={};KKX.docs=null;await khoLoad(true);kkLoadAll();kkOpen(id)}catch(e){toast(e.message)}};
};
{const _kk=PAGES.kho_kk;if(_kk)PAGES.kho_kk=function(m){const r=_kk.apply(this,arguments);kkCard(m);return r}}
