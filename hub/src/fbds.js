/* =====================================================================
   ĐỐI SOÁT TIỀN VỀ FACEBOOK (chị Huệ dạy agent 17–18/11/2026, chị Hoa bảo web làm theo 18/11).
   Trang Facebook (quản trị): kế toán nạp file "Đơn FB tháng …" + các file tiền về SPX/Best của tháng, web ghép mã vận đơn (fbdscalc.js),
   lưu bản tóm tắt theo tháng (/api/hub/bc-file/fb) và cất file gốc + file tính toán lên Drive (bcSaveSet, thư mục "Facebook").
   Tháng nào đã đối soát: doanh thu Facebook = COD hãng vận chuyển đã trả (đơn COD > 0), số đơn = số đơn đó,
   phí = phí hãng của mọi đơn tháng đó + thuế 1,5%, giá vốn giữ tỷ lệ giá vốn / doanh thu web đang tính (cùng rổ đơn đã gửi).
   ===================================================================== */
const FDS={m:null,busy:0,at:0,ky:"",run:null,err:""};
function fdsLoad(force){if(FDS.busy||typeof svApi!=="function"||(FDS.m&&!force&&Date.now()-FDS.at<600000))return;FDS.busy=1;
  svApi("/api/hub/bc-file/fb").then(r=>{FDS.m=r||{};FDS.at=Date.now();if(typeof dtRe==="function")dtRe();else if(typeof renderMain==="function")renderMain()})
    .catch(()=>{FDS.m=FDS.m||{}}).finally(()=>{FDS.busy=0})}
/* Doanh thu Facebook một tháng đủ ngày: thay bằng số đối soát tiền về nếu tháng đó đã nạp. */
{const _t=tqRevB2C;tqRevB2C=function(N,from,to){const out=_t.apply(this,arguments);
  try{fdsLoad();const ms=tqMonths(from,to);if(ms.length!==1||!fullMonth(ms[0],from,to))return out;
    const s=FDS.m&&FDS.m[ms[0]];if(!s||!(s.dt>0))return out;const f=out.fb||{};
    const r=f.dt>0&&f.gv!=null?f.gv/f.dt:null,gv=r==null?null:s.dt*r,phi=s.ship+s.dt*0.015,ads=+f.ads||0,khac=+f.khac||0;
    out.fb={...f,dt:s.dt,don:s.don,gv,phi,ads,khac,lai:gv==null?null:s.dt-gv-phi-ads-khac,dang:0,dangDt:0,tam:false,fds:s,
      src:`tiền về SPX/Best (đối soát file, ${nf(s.don)} đơn COD > 0) · phí hãng vận chuyển + thuế 1,5% · giá vốn theo tỷ lệ đơn đã gửi`}}catch(e){}
  return out}}

async function fdsAoa(f){const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});return wb.SheetNames.map(n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:null}))}
function fdsBook(R,ky,names){const vn=k=>({ve:"Đã về tiền",lech:"Đã về tiền · lệch COD, cần kiểm",cod0:"Hãng trả COD 0 (coi như hoàn)",chua:"Chưa về tiền (theo dõi kỳ sau)",hoan:"Hoàn/trả"})[k];
  const head=["Mã đơn","Mã vận đơn","Trạng thái đơn FB","Sản phẩm (tên × SL)","COD Facebook","Nguồn tiền về","COD hãng trả","Phí hãng","Web tính doanh thu","Doanh thu web","Kết quả"];
  const rows=R.list.map(o=>{const tinh=o.k==="ve"||o.k==="lech";return [o.id,o.track,o.st,o.sp.map(p=>`${p[0]} × ${p[1]}`).join("; "),o.cod,o.src,o.codvc,o.fee,tinh?"Có":"Không",tinh?o.codvc:0,vn(o.k)]});
  const s=R.sum,g=s.g,tong=[["Facebook · tháng "+ky.slice(5)+"/"+ky.slice(0,4)+" · đối soát tiền về, file tính toán web ABOS, tạo "+bcStamp()],["File: "+names.join(" | ")],[],
    ["Nhóm","Số đơn","COD Facebook","COD hãng trả"],["Đã về tiền, khớp COD",...g.ve],["Đã về tiền, lệch COD (cần kiểm)",...g.lech],["Hãng trả COD 0 (coi như hoàn)",...g.cod0],["Chưa về tiền",...g.chua],["Hoàn/trả",...g.hoan],
    ["Tổng đơn trong file FB",s.tong,s.codFb,""],[],["Doanh thu web (COD hãng trả của đơn COD > 0)",s.don,"",Math.round(s.dt)],["Phí hãng vận chuyển (mọi đơn có trong file hãng)","","",Math.round(s.ship)],[],
    ["Nguồn","Loại","Số vận đơn đọc được"],...R.src.map(x=>[x.name,x.loai,x.n])];
  const cach=[["Cách web tính Facebook (cách chị Huệ dạy agent kế toán trưởng 18/11/2026)"],[],["1. Gốc là file Đơn FB của tháng; mỗi đơn tính COD một lần. Ghép mã vận đơn với file tiền về SPX trước, rồi Best (nguồn đặt theo tên file)."],
    ["2. Đơn FB ghi hoàn/trả: không tính. Đơn hãng trả COD = 0: coi như hoàn, không tính, không thống kê sản phẩm."],["3. Đơn có trong file hãng và COD > 0: doanh thu = COD hãng trả. COD hãng khác COD Facebook thì để ở nhóm lệch để kế toán kiểm."],
    ["4. Đơn chưa có trong file hãng: chưa về tiền, không tính, theo dõi kỳ sau."],["5. Phí = phí hãng của mọi đơn trong file hãng (kể cả đơn hoàn) + thuế 1,5% doanh thu. Giá vốn theo tỷ lệ giá vốn / doanh thu của đơn đã gửi trên web."]];
  const wb=XLSX.utils.book_new(),sh=(a,w)=>{const x=XLSX.utils.aoa_to_sheet(a);x["!cols"]=w.map(c=>({wch:c}));return x};
  XLSX.utils.book_append_sheet(wb,sh(tong,[48,14,16,16]),"Tong");
  XLSX.utils.book_append_sheet(wb,sh([head,...rows],[18,20,16,50,12,18,12,10,9,12,30]),"Tung don");
  XLSX.utils.book_append_sheet(wb,sh([head,...rows.filter(r=>r[8]!=="Có"||/lệch/.test(r[10]))],[18,20,16,50,12,18,12,10,9,12,30]),"Don bi loai - can kiem");
  XLSX.utils.book_append_sheet(wb,sh(cach,[120]),"Cach tinh");
  return {name:`Facebook ${ky} tinh toan (${bcStamp()}).xlsx`,data:XLSX.write(wb,{type:"base64",bookType:"xlsx"})}}

function fdsCan(){return typeof SV!=="undefined"&&!!SV.me&&(SV.me.role==="CEO"||(SV.perms||[]).includes("debt.read.all"))}
function fdsCard(){fdsLoad();const ky=FDS.ky||PERIOD.from.slice(0,7),s=FDS.m&&FDS.m[ky],R=FDS.run,vn=v=>nf(Math.round(v))+"đ";
  const cur=s?`<p style="margin:0 0 8px">Tháng ${ky.slice(5)}/${ky.slice(0,4)} đã đối soát: <b>${vn(s.dt)}</b> · ${nf(s.don)} đơn đã về tiền · phí hãng ${vn(s.ship)} <span class="hint">(nạp ${esc(String(s.at||"").slice(0,16).replace("T"," "))}${s.by?" · "+esc(s.by):""})</span></p>`:`<p class="hint" style="margin:0 0 8px">Tháng ${ky.slice(5)}/${ky.slice(0,4)} chưa đối soát tiền về: doanh thu đang tạm lấy theo đơn giao thành công trên Pancake.</p>`;
  const prev=R?`<div class="note" style="margin-top:10px"><b>Kết quả (chưa lưu):</b> ${nf(R.sum.tong)} đơn trong file FB → <b>${nf(R.sum.don)} đơn đã về tiền, ${vn(R.sum.dt)}</b> · chưa về tiền ${nf(R.sum.g.chua[0])} đơn (${vn(R.sum.g.chua[1])}) · lệch COD ${nf(R.sum.g.lech[0])} đơn · hoàn ${nf(R.sum.g.hoan[0]+R.sum.g.cod0[0])} đơn · phí hãng ${vn(R.sum.ship)}
     <div class="hint" style="margin-top:4px">${R.web?`Đơn lấy từ dữ liệu web kéo hằng ngày (đơn tạo trong tháng): ${nf(R.web.n)} đơn${R.web.noTrack?` · <b>${nf(R.web.noTrack)} đơn chưa có mã vận đơn</b>, nên nạp file đơn FB`:""}. `:"Đơn lấy từ file đơn FB. "}${R.src.map(x=>`${esc(x.name)}: ${nf(x.n)} vận đơn`).join(" · ")}</div>
     <div class="acts" style="margin-top:8px"><button class="btn pri" id="fds-save">Lưu số tháng ${ky.slice(5)}/${ky.slice(0,4)} + cất file lên Drive</button></div></div>`:"";
  return `<section class="card"><div class="card-h"><h2>Đối soát tiền về (SPX, Best)</h2></div>${cur}
    <div class="filters" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
      <label>Tháng<br><input type="month" id="fds-ky" value="${ky}"></label>
      <label>File đơn FB (không bắt buộc: bỏ trống thì web dùng đơn đã kéo từ Pancake)<br><input type="file" id="fds-fb" accept=".xlsx,.xls"></label>
      <label>File tiền về SPX (chọn nhiều)<br><input type="file" id="fds-spx" accept=".xlsx,.xls" multiple></label>
      <label>File Best (chọn nhiều, nguồn theo tên file)<br><input type="file" id="fds-best" accept=".xlsx,.xls" multiple></label>
      <button class="btn" id="fds-go">Đối soát</button></div>${FDS.err?`<p class="note amb">${esc(FDS.err)}</p>`:""}${prev}</section>`}
function fdsBind(m){const q=s=>m.querySelector(s);if(!q("#fds-go"))return;
  q("#fds-ky").onchange=e=>{FDS.ky=e.target.value;FDS.run=null;renderMain()};
  q("#fds-go").onclick=async()=>{const fb=q("#fds-fb").files[0],spx=[...q("#fds-spx").files],best=[...q("#fds-best").files];FDS.err="";
    if(!(spx.length+best.length)){toast("Chọn ít nhất một file tiền về SPX hoặc Best");return}
    try{const ky=q("#fds-ky").value;let src,web=null;
      if(fb)src=(await fdsAoa(fb))[0];else{web=await svApi("/api/hub/bc-file/fb-orders?ky="+ky);if(!web.orders.length)throw new Error("Web chưa có đơn Facebook tạo trong tháng này (hoặc chưa kéo mã vận đơn): nạp file đơn FB.");src={web:web.orders}}
      const R=fdsBuild(src,await Promise.all(spx.map(async f=>({name:f.name,rows:(await fdsAoa(f))[0]}))),await Promise.all(best.map(async f=>({name:f.name,sheets:await fdsAoa(f)}))));
      R.files=[fb,...spx,...best].filter(Boolean);R.ky=ky;FDS.ky=ky;R.web=web?{n:web.orders.length,noTrack:web.orders.filter(o=>!o.track).length,noCreated:web.noCreated}:null;FDS.run=R}catch(e){FDS.err=e.message;FDS.run=null}renderMain()};
  if(q("#fds-save"))q("#fds-save").onclick=async e=>{const R=FDS.run,ky=R.ky;e.target.disabled=true;
    try{await svApi("/api/hub/bc-file/fb",{method:"PUT",body:JSON.stringify({ky,s:fdsSummary(R,ky,R.files.map(f=>f.name))})});
      toast("Đã lưu số đối soát Facebook tháng "+ky.slice(5)+"/"+ky.slice(0,4));
      const n=await bcSaveSet({ky,kenh:"fb",nhom:"Facebook",raw:R.files,book:fdsBook(R,ky,R.files.map(f=>f.name))});if(n)toast("Đã cất "+n+" file lên Drive");
      FDS.run=null;fdsLoad(true)}catch(x){toast(x.message);e.target.disabled=false}}}
{const _p=PAGES.bc_fb;PAGES.bc_fb=m=>{_p(m);try{if(typeof APP_MODE!=="undefined"&&APP_MODE==="admin"&&fdsCan()&&typeof fbdFull==="function"&&fbdFull()){
  const h=m.querySelector(".settabs, nav")||m.firstElementChild;const d=document.createElement("div");d.innerHTML=fdsCard();
  if(h&&h.parentNode===m)h.after(d.firstElementChild);else m.prepend(d.firstElementChild);fdsBind(m)}}catch(e){console.warn("đối soát FB",e)}}}
