/* =====================================================================
   LƯU FILE BÁO CÁO THÁNG LÊN DRIVE (chị Hoa duyệt 16/11/2026)
   Kế toán tải báo cáo kênh lên trang quản trị → web cất nguyên file gốc từ sàn + file tính toán (từng đơn ra số trên web)
   vào Drive: "Báo cáo kênh (web ABOS)" › tháng › kênh/shop › "1. File gốc" | "2. File tính toán". Máy chủ: routes/baocaoFile.ts.
   Trang Đối chiếu doanh thu hiện file đã lưu của từng kênh. Đợt 1: Shopee; TikTok, Facebook làm tiếp.
   ===================================================================== */
const BCF={ky:"",files:null,ready:false,busy:false};
function bcLoad(ky,force){
  if(BCF.busy||(!force&&BCF.ky===ky&&BCF.files))return;
  BCF.busy=true;BCF.ky=ky;
  svApi("/api/hub/bc-file?ky="+ky).then(r=>{BCF.files=r.files||[];BCF.ready=!!r.ready}).catch(()=>{BCF.files=[]}).finally(()=>{BCF.busy=false;if(PAGE==="dt_dc")renderMain()});
}
const bcB64=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).replace(/^data:[^,]*,/,""));r.onerror=()=>no(new Error("Không đọc được file "+f.name));r.readAsDataURL(f)});
async function bcUp(meta){return svApi("/api/hub/bc-file",{method:"POST",body:JSON.stringify(meta)})}
/* Cất file gốc + file tính toán của một kênh/shop. Lỗi không chặn việc lưu số, chỉ báo. */
async function bcSaveSet({ky,kenh,nhom,raw,book}){
  const st=svApi("/api/hub/bc-file?ky="+ky).catch(()=>({ready:false}));
  if(!(await st).ready){toast("Chưa nối Drive nên chưa lưu được file báo cáo.");return 0}
  let n=0;
  for(const f of raw.filter(Boolean)){try{await bcUp({ky,kenh,nhom,loai:"goc",name:f.name,mime:f.type||"application/octet-stream",data:await bcB64(f)});n++}catch(e){toast(`${nhom}: ${e.message}`)}}
  if(book){try{await bcUp({ky,kenh,nhom,loai:"tinh",name:book.name,mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",data:book.data});n++}catch(e){toast(`${nhom}: ${e.message}`)}}
  BCF.files=null;return n;
}
const bcStamp=()=>{const d=new Date(Date.now()+7*3600e3).toISOString();return d.slice(8,10)+"-"+d.slice(5,7)+" "+d.slice(11,13)+"h"+d.slice(14,16)};
/* Ô "File đã lưu" ở trang Đối chiếu: theo từng nhóm (shop), số file gốc / tính toán + link thư mục Drive. */
function bcCell(kenh){
  if(!BCF.files)return `<span class="hint">…</span>`;
  const L=BCF.files.filter(f=>f.kenh===kenh);
  if(!L.length)return `<span class="hint">${kenh==="spe"?"chưa lưu file":"chưa làm"}</span>`;
  const by={};L.forEach(f=>{(by[f.nhom]=by[f.nhom]||[]).push(f)});
  /* Mỗi shop một khối: tên shop, hai nút rõ ràng (thư mục Drive, file tính toán mới nhất), số file gốc (chị Hoa 16/11 "trình bày tử tế"). */
  return Object.entries(by).map(([n,fs])=>{const gs=fs.filter(f=>f.loai==="goc"),g=gs.length,t=fs.filter(f=>f.loai==="tinh"),gl=gs[gs.length-1],tt=t[t.length-1];
    return `<div style="margin-bottom:8px;white-space:nowrap"><b>${esc(n)}</b> <small class="hint">· ${g} file gốc</small><div style="margin-top:3px;display:flex;gap:6px">
      ${gl?`<a class="btn sm" href="${esc(gl.folderUrl)}" target="_blank" rel="noopener" title="Thư mục 1. File gốc trên Drive: file tải từ sàn">📁 File gốc</a>`:""}${tt?`<a class="btn sm" href="${esc(tt.url)}" target="_blank" rel="noopener" title="File tính toán mới nhất (thư mục 2. File tính toán)">📊 File tính toán</a>`:""}</div></div>`}).join("");
}

/* ---------- File tính toán Shopee: mỗi đơn một dòng, cộng lại ra đúng số web ---------- */
function speCalcBook(x){
  const M=x.M,L=M.L||[],F=M.F||{},G=SPE_FEE_GROUPS.map(g=>g[0]),NG=G.length,byK={};(M.rows||[]).forEach(r=>byK[r.k]=r);
  const O={};L.forEach(l=>{const o=O[l.o]||(O[l.o]={d:l.d,lines:[]});o.lines.push(l)});
  Object.keys(F).forEach(id=>{if(!O[id])O[id]={d:F[id].d,lines:[]}});
  const vn=d=>d?d.split("-").reverse().join("/"):"";
  const head=["Mã đơn","Ngày đặt","Sản phẩm (tên – phân loại × SL)","Có trong file đơn","Có trong Tài chính","Web tính","Lý do","Doanh thu web",...G.map(g=>g+" (web)"),"Cộng phí web","Giá vốn web",
    "TC: Giá sản phẩm","TC: Số tiền hoàn lại","TC: Mã ưu đãi người bán chịu",...G.map(g=>"TC: "+g),"TC: Cộng phí"];
  const rows=[],T=new Array(head.length).fill(0);
  Object.entries(O).sort((a,b)=>(a[1].d||"").localeCompare(b[1].d||"")||a[0].localeCompare(b[0])).forEach(([id,o])=>{
    const f=F[id],ls=o.lines,ok=ls.filter(l=>!l.huy&&l.wf),bo=ls.filter(l=>l.huy),cho=ls.filter(l=>!l.huy&&!l.wf);
    let tinh,why;
    if(!ls.length){tinh="Không";why=`Không có trong file đơn tháng ${M.ky.slice(5)}/${M.ky.slice(0,4)}${o.d&&o.d.slice(0,7)!==M.ky?" (đặt ngày "+vn(o.d)+")":""}`}
    else{const r=bo.map(l=>l.st==="Đã hủy"?"đơn hủy":l.rq>0?"có hàng trả":M.hoanSet&&M.hoanSet.has(id)?"Tài chính hoàn tiền toàn bộ":"loại").filter((v,i,a)=>a.indexOf(v)===i);
      if(!ok.length&&cho.length){tinh="Không";why="Chưa về tiền (chưa có trong Tài chính): theo dõi sang kỳ sau"}
      else if(!ok.length){tinh="Không";why="Bỏ cả đơn: "+r.join(", ")}
      else if(ok.every(l=>l.full)){tinh="Chỉ phí";why="Hoàn tiền toàn bộ: không tính tiền hàng, chỉ tính phí Shopee vẫn thu"}
      else if(bo.length){tinh="Một phần";why="Bỏ dòng: "+r.join(", ")}
      else{tinh="Có";why=f?(ls.some(l=>l.tra)?"Có hàng trả: tính phần Shopee thực thu theo Tài chính":""):"Chưa có trong Tài chính: phí ước theo tỷ lệ trung bình"}}
    const wf=new Array(NG).fill(0);let wdt=0,gv=0;ok.forEach(l=>{wdt+=l.wdt||0;(l.wf||[]).forEach((v,i)=>wf[i]+=v);const r=byK[speKey(l.pn,l.vr)];if(r&&!r.uoc)gv+=r.u*l.q});
    const tf=f?f.f:new Array(NG).fill(0);
    const row=[id,vn(o.d),ls.map(l=>`${l.pn}${l.vr?" – "+l.vr:""} × ${l.q}`).join("; "),ls.length?"Có":"Không",f?"Có":"Không",tinh,why,Math.round(wdt),...wf,wf.reduce((a,b)=>a+b,0),Math.round(gv),
      f?f.gross:0,f?f.hoan:0,f?f.vou:0,...tf.map(Math.round),Math.round(tf.reduce((a,b)=>a+b,0))];
    row.forEach((v,i)=>{if(i>=7&&typeof v==="number")T[i]+=v});rows.push(row)});
  const sum=k=>T[head.indexOf(k)];
  const tcPhi=G.map(g=>sum("TC: "+g)),webPhi=G.map(g=>sum(g+" (web)"));
  const nDon=rows.filter(r=>r[5]!=="Không"&&r[5]!=="Chỉ phí").length,nTc=rows.filter(r=>r[4]==="Có").length;
  const tong=[["Shopee "+speShopL(M.shop)+" · tháng "+M.ky.slice(5)+"/"+M.ky.slice(0,4)+" · file tính toán web ABOS, tạo "+bcStamp()],
    ["Tài chính từ "+vn(M.inc&&M.inc.from)+" đến "+vn(M.inc&&M.inc.to)+" · file: "+[x.files.orders,x.files.fin,x.files.ads].filter(Boolean).join(" | ")],[],
    ["Khoản","Số trên web","Cộng lại từ trang Từng đơn","Lệch (làm tròn)","Cả file Tài chính (mọi đơn trong file)","Kế toán (nhập để so)","Web − Kế toán"],
    ["Số đơn",M.don,nDon,M.don-nDon,nTc,"",""],
    ["Doanh thu (giá gốc − người bán trợ giá + mã ưu đãi)",M.dt,sum("Doanh thu web"),M.dt-sum("Doanh thu web"),sum("TC: Giá sản phẩm"),"",""],
    ...G.map((g,i)=>[g,Math.round(M.fees[i][1]),webPhi[i],Math.round(M.fees[i][1])-webPhi[i],tcPhi[i],"",""]),
    ["Cộng phí sàn + ship + thuế",M.phi,sum("Cộng phí web"),M.phi-sum("Cộng phí web"),sum("TC: Cộng phí"),"",""],
    ["Giá vốn",M.gv,sum("Giá vốn web"),M.gv-sum("Giá vốn web"),"","",""],
    ["Lãi gộp (doanh thu + phí − giá vốn)",M.lg,"","","","",""]];
  const n0=tong.length;for(let r=4;r<n0;r++){if(tong[r][0].startsWith("Lãi"))continue;const R=r+1;tong[r][6]={f:`IF(F${R}="","",B${R}-F${R})`}}
  const loai=rows.filter(r=>r[5]!=="Có"||r[6]);
  const cach=[["Cách web tính số Shopee (đọc để đối soát)"],[],
    ["1. Đơn lấy từ file đơn hàng (đặt trong tháng). Đơn có trong file Tài chính mà không có trong file đơn tháng này thì web KHÔNG tính (cột Web tính = Không)."],
    ["2. Dòng sản phẩm đã hủy, hoặc Tài chính ghi hoàn tiền toàn bộ: web bỏ dòng đó. Đơn có hàng trả mà Shopee vẫn thu tiền: tiền hàng theo Tài chính (giá sản phẩm + hoàn lại), phí theo Tài chính, giá vốn trừ số lượng trả. Đơn có hàng trả chưa có trong Tài chính: bỏ dòng đó."],
    ["3. Phí của từng đơn lấy từ file Tài chính, chia cho các dòng sản phẩm theo tỷ lệ doanh thu dòng."],
    ["4. Đơn chưa có trong Tài chính (chưa về tiền): báo cáo đủ tháng thì không tính doanh thu, theo dõi sang kỳ sau (cách chị Huệ). Báo cáo giữa tháng thì ước phí theo tỷ lệ trung bình."],
    ["5. Phí vận chuyển ròng (gồm Phí dịch vụ PiShip) và Thuế sàn khấu trừ là cột riêng. Phí sàn = Hoa hồng cố định + Phí dịch vụ + Phí xử lý giao dịch + Affiliate + Thuế."],
    ["6. Giá vốn = số lượng × giá thành web của mã; mã chưa có giá thành để 0 (không ước)."],
    ["7. Cột TC: … là số nguyên trong file Tài chính của đơn đó để kế toán so trực tiếp."]];
  const wb=XLSX.utils.book_new();
  const sh=(aoa,w)=>{const s=XLSX.utils.aoa_to_sheet(aoa);if(w)s["!cols"]=w.map(x=>({wch:x}));return s};
  XLSX.utils.book_append_sheet(wb,sh(tong,[46,16,22,14,24,18,16]),"Tong");
  XLSX.utils.book_append_sheet(wb,sh([head,...rows,["Cộng","","","","","","",...T.slice(7)]],[22,11,50,9,9,9,40]),"Tung don");
  XLSX.utils.book_append_sheet(wb,sh([head,...loai],[22,11,50,9,9,9,40]),"Don bi loai - uoc");
  XLSX.utils.book_append_sheet(wb,sh(cach,[120]),"Cach tinh");
  return {name:`Shopee ${speShopL(M.shop)} ${M.ky} tinh toan (${bcStamp()}).xlsx`,data:XLSX.write(wb,{type:"base64",bookType:"xlsx"})};
}

/* ---------- File tính toán TikTok (cùng cấu trúc Shopee): mỗi đơn một dòng, cộng lại ra đúng số web ---------- */
function ttCalcBook(V){
  const M=V.M,P=V.P,L=M._L||[],F=M._F||{},G=TT_FEE_GROUPS.map(g=>g[0]),NG=G.length,vn=d=>d?d.split("-").reverse().join("/"):"";
  const O={};L.forEach(l=>{(O[l.o]=O[l.o]||{d:l.d,lines:[]}).lines.push(l)});
  const head=["Mã đơn","Ngày tạo","Sản phẩm (tên – phân loại × SL)","Trạng thái file đơn","Có trong Tài chính","Web tính","Lý do","Doanh thu web",...G.map(g=>g+" (web)"),"Cộng phí web","TC: Tổng doanh thu","TC: Tổng phí"];
  const rows=[],T=new Array(head.length).fill(0);
  Object.entries(O).sort((a,b)=>a[1].d.localeCompare(b[1].d)||a[0].localeCompare(b[0])).forEach(([id,o])=>{
    const f=F[id],ls=o.lines,ok=ls.filter(l=>l.wf);let tinh,why="";
    if(!ok.length){tinh="Không";why=f?"":ls.every(l=>l.huy)?"Đơn hủy, chưa có trong Tài chính":"Chưa về tiền (chưa có trong Tài chính): theo dõi sang kỳ sau"}
    else if(ok.every(l=>l.full)){tinh="Chỉ phí";why="Tổng doanh thu Tài chính = 0 (hủy/hoàn hết): chỉ tính phí sàn vẫn thu"}
    else{tinh="Có";why=!f?"Chưa có trong Tài chính: phí ước theo tỷ lệ trung bình (báo cáo giữa tháng)":ls.some(l=>l.rq>0)?"Có hàng trả: tiền theo Tài chính, trừ số lượng trả khỏi giá vốn":""}
    const wf=new Array(NG).fill(0);let wdt=0;ok.forEach(l=>{wdt+=l.dt;l.wf.forEach((v,i)=>wf[i]+=v)});
    const row=[id,vn(o.d),ls.map(l=>`${l.pn}${l.vr?" – "+l.vr:""} × ${l.q}${l.rq?" (trả "+l.rq+")":""}`).join("; "),[...new Set(ls.map(l=>l.st))].join(", "),f?"Có":"Không",tinh,why,Math.round(wdt),...wf,wf.reduce((a,b)=>a+b,0),f?Math.round(f.dt||0):0,f?Math.round(f[NG]):0];
    row.forEach((v,i)=>{if(i>=7&&typeof v==="number")T[i]+=v});rows.push(row)});
  let tcDt=0,tcPhi=0,tcN=0;Object.values(F).forEach(f=>{tcDt+=f.dt||0;tcPhi+=f[NG];tcN++});
  const sum=k=>T[head.indexOf(k)];
  const tong=[["TikTok Shop · tháng "+M.ky.slice(5)+"/"+M.ky.slice(0,4)+" · file tính toán web ABOS, tạo "+bcStamp()],
    ["Tài chính từ "+vn(M.inc&&M.inc.from)+" đến "+vn(M.inc&&M.inc.to)+" · file: "+[V.files.orders,V.files.income,V.files.camp].filter(Boolean).join(" | ")],[],
    ["Khoản","Số trên web","Cộng lại từ trang Từng đơn","Lệch (làm tròn)","Cả file Tài chính (đơn tạo trong tháng)","Kế toán (nhập để so)","Web − Kế toán"],
    ["Số đơn",P.don,rows.filter(r=>r[5]==="Có").length,P.don-rows.filter(r=>r[5]==="Có").length,tcN,"",""],
    ["Doanh thu (Tổng doanh thu Tài chính)",P.dt,sum("Doanh thu web"),P.dt-sum("Doanh thu web"),Math.round(tcDt),"",""],
    ...P.fees.map((x,i)=>[x[0],Math.round(x[1]),sum(G[i]+" (web)"),Math.round(x[1])-sum(G[i]+" (web)"),"","",""]),
    ["Cộng phí sàn",Math.round(P.phi),sum("Cộng phí web"),Math.round(P.phi)-sum("Cộng phí web"),Math.round(tcPhi),"",""],
    ["Giá vốn",P.gv,"","","","",""],["Quảng cáo (chi tiêu + VAT 10%)",P.ads,"","","","",""]];
  for(let r=4;r<tong.length;r++){const R=r+1;if(tong[r][0]==="Giá vốn"||tong[r][0].startsWith("Quảng cáo"))continue;tong[r][6]={f:`IF(F${R}="","",B${R}-F${R})`}}
  const cach=[["Cách web tính số TikTok (cách chị Huệ, chị Hoa duyệt 16/11/2026)"],[],
    ["1. Chỉ lấy đơn TẠO trong tháng. File đơn chỉ dùng mã SKU, trạng thái, số lượng; tiền và phí lấy từ file Tài chính (tab Chi tiết đơn hàng) theo mã đơn."],
    ["2. Doanh thu = cột \"Tổng doanh thu\" (đã trừ hoàn tiền). Phí = cột \"Tổng phí\" (đã gồm thuế giữ hộ), chia nhóm theo từng cột phí; phần dư vào \"Phí khác\"."],
    ["3. Đơn file đơn ghi hủy/hoàn nhưng có trong Tài chính: vẫn tính đúng số Tài chính. Tổng doanh thu = 0 thì chỉ tính phí, không đếm đơn."],
    ["4. Đơn chưa có trong Tài chính: báo cáo đủ tháng thì không tính (theo dõi kỳ sau); báo cáo giữa tháng thì ước phí theo tỷ lệ bình quân."],
    ["5. Có hàng trả và Tài chính đã trừ tiền: giá vốn tính trên số lượng bán − số lượng trả. Quảng cáo = chi tiêu Campaign + VAT 10%."]];
  const wb=XLSX.utils.book_new(),sh=(aoa,w)=>{const s=XLSX.utils.aoa_to_sheet(aoa);if(w)s["!cols"]=w.map(x=>({wch:x}));return s};
  XLSX.utils.book_append_sheet(wb,sh(tong,[40,16,22,14,26,18,16]),"Tong");
  XLSX.utils.book_append_sheet(wb,sh([head,...rows,["Cộng","","","","","","",...T.slice(7)]],[22,11,50,16,9,9,40]),"Tung don");
  XLSX.utils.book_append_sheet(wb,sh([head,...rows.filter(r=>r[5]!=="Có"||r[6])],[22,11,50,16,9,9,40]),"Don bi loai - uoc");
  XLSX.utils.book_append_sheet(wb,sh(cach,[120]),"Cach tinh");
  return {name:`TikTok Shop ${M.ky} tinh toan (${bcStamp()}).xlsx`,data:XLSX.write(wb,{type:"base64",bookType:"xlsx"})};
}

/* ---------- Mục "Tải báo cáo" dùng chung các kênh (chị Hoa 18/11/2026): bảng đủ các tháng, nút file Excel / thư mục gốc, link Drive ---------- */
const BCA={files:null,links:null,busy:0,at:0};
function bcAllLoad(force){if(BCA.busy||typeof svApi!=="function"||(!force&&BCA.files&&Date.now()-BCA.at<300000))return;BCA.busy=1;
  Promise.all([svApi("/api/hub/bc-file").catch(()=>({files:[]})),svApi("/api/hub/bc-file/link").catch(()=>({}))]).then(([f,l])=>{BCA.files=f.files||[];BCA.links=l||{};BCA.at=Date.now();if(typeof renderMain==="function")renderMain()}).finally(()=>{BCA.busy=0})}
function bcFileBtns(kenh,ky,nhom){const L=(BCA.files||[]).filter(f=>f.kenh===kenh&&f.ky===ky&&(!nhom||f.nhom===nhom)),t=L.filter(f=>f.loai==="tinh").pop(),g=L.filter(f=>f.loai==="goc").pop();
  if(!t&&!g)return `<span class="hint">—</span>`;
  return `<span style="white-space:nowrap">${t?`<a class="btn sm" href="${esc(t.url)}" target="_blank" rel="noopener" title="File Excel tính từng đơn ra số web">📊 Tính toán</a> `:""}${g?`<a class="btn sm" href="${esc(g.folderUrl)}" target="_blank" rel="noopener" title="Thư mục file gốc trên Drive">📁 Gốc</a>`:""}</span>`}
function bcLinkBtns(kenh,ky){const u=BCA.links&&BCA.links[kenh+"|"+ky];
  return u?`<span style="white-space:nowrap"><a class="btn sm" href="${esc(u)}" target="_blank" rel="noopener">Mở ↗</a> <button class="btn sm" data-bclink="${kenh}|${ky}">Sửa</button></span>`:`<button class="btn sm" data-bclink="${kenh}|${ky}">🔗 Điền</button>`}
function bcLinkBind(m){m.querySelectorAll("[data-bclink]").forEach(b=>b.onclick=async()=>{const [kenh,ky]=b.dataset.bclink.split("|"),cur=(BCA.links||{})[kenh+"|"+ky]||"";
  const v=prompt(`Dán link thư mục Google Drive của tháng ${ky.slice(5)}/${ky.slice(0,4)} (để trống là xóa link):`,cur);if(v===null)return;
  try{BCA.links=await svApi("/api/hub/bc-file/link",{method:"PUT",body:JSON.stringify({kenh,ky,link:v.trim()})});toast(v.trim()?"Đã lưu link Drive":"Đã xóa link");renderMain()}catch(e){toast(e.message)}})}
/* Các tháng cần hiện: tháng có số, có file, có link, và 3 tháng gần nhất. */
function bcMonths(kenh,extra){const t=iso(new Date()).slice(0,7),set=new Set(extra||[]);
  for(let i=0;i<3;i++){const d=new Date(+t.slice(0,4),+t.slice(5,7)-1-i,1);set.add(iso(d).slice(0,7))}
  (BCA.files||[]).filter(f=>f.kenh===kenh).forEach(f=>set.add(f.ky));Object.keys(BCA.links||{}).filter(k=>k.startsWith(kenh+"|")).forEach(k=>set.add(k.split("|")[1]));
  return [...set].filter(k=>/^\d{4}-\d{2}$/.test(k)).sort().reverse()}
/* Bảng "File & link Drive các tháng" cho TikTok, Shopee (cùng kiểu mục Tải báo cáo Facebook). rows: [{ky, nhom, so, cells[]}]. */
const bcVnAt=a=>{if(!a)return "";const v=new Date(Date.parse(a)+7*3600e3).toISOString();return v.slice(8,10)+"/"+v.slice(5,7)+" "+v.slice(11,16)};
function bcThangCard(kenh,title,heads,rows){bcAllLoad();
  const body=rows.map(r=>`<tr><td><b>T${r.ky.slice(5)}/${r.ky.slice(0,4)}</b>${r.nhom?`<br><small class="hint">${esc(r.nhom)}</small>`:""}</td><td>${r.so}</td>${r.cells.map(c=>`<td class="n">${c}</td>`).join("")}<td>${bcFileBtns(kenh,r.ky,r.nhom)}</td><td>${bcLinkBtns(kenh,r.ky)}</td></tr>`).join("");
  return `<section class="card"><div class="card-h"><h2>${title}</h2><span class="hint">lưu đủ mọi tháng · file gốc và file tính toán nằm trên Drive</span></div>
   <div class="tbl"><table><thead><tr><th>Tháng</th><th>Số liệu</th>${heads.map(h=>`<th class="n">${h}</th>`).join("")}<th>File</th><th>Link Drive</th></tr></thead><tbody>${body||`<tr><td colspan="${heads.length+4}" class="hint">Chưa có tháng nào.</td></tr>`}</tbody></table></div>
   <p class="hint" style="margin:8px 0 0">"Điền" để dán link thư mục Drive kế toán đang giữ file của tháng đó.</p></section>`}
