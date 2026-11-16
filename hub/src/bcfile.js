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
  return Object.entries(by).map(([n,fs])=>{const g=fs.filter(f=>f.loai==="goc").length,t=fs.filter(f=>f.loai==="tinh"),last=fs[fs.length-1],tt=t[t.length-1];
    return `<div style="margin-bottom:8px;white-space:nowrap"><b>${esc(n)}</b> <small class="hint">· ${g} file gốc</small><div style="margin-top:3px;display:flex;gap:6px">
      <a class="btn sm" href="${esc(last.folderUrl||last.url)}" target="_blank" rel="noopener">📁 Thư mục</a>${tt?`<a class="btn sm" href="${esc(tt.url)}" target="_blank" rel="noopener">📊 File tính toán</a>`:""}</div></div>`}).join("");
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
