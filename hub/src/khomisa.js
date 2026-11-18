/* =====================================================================
   NẠP LỆNH PHA CHẾ TỪ MISA (chị Hoa 18/11/2026). Trang Pha chế › Yêu cầu & phiếu, chỉ CEO / Kế toán.
   Đọc file Excel: (a) MISA in mẫu "Lệnh sản xuất (Chi tiết NVL)" rồi Xuất khẩu, hoặc
   (b) bảng mỗi nguyên liệu một dòng: so_lenh, ngay, ma_tp, sl_tp, pxk, pnk, ma_nvl, sl_nvl.
   Mỗi lệnh bán thành phẩm thành một phiếu pha chế, số nguyên liệu đúng số MISA, ghi số LX / PXK / PNK.
   Lệnh đã nạp thì bỏ qua (máy chủ chặn trùng). Lệnh đóng gói thành phẩm chưa nạp ở đây.
   ===================================================================== */
const KMS={rows:null,done:null,busy:false,log:[]};
const kmsCan=()=>typeof pchKeToanMe==="function"&&pchKeToanMe();
const kmsDate=v=>{if(typeof v==="number"){const d=new Date(Math.round((v-25569)*864e5));return d.toISOString().slice(0,10)}const s=String(v||"").trim();let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;m=s.match(/^\d{4}-\d{2}-\d{2}/);return m?m[0]:""};
const kmsNum=v=>typeof v==="number"?v:Number(String(v||"").replace(/\./g,"").replace(",","."));
/* Trả về danh sách lệnh: {lx, ngay, tp, sl, pxk, pnk, nvl:[{item, qty}]} (mỗi thành phẩm của lệnh một phần tử). */
function kmsParse(sheets){
  const out=new Map(),put=(lx,ngay,tp,sl,pxk,pnk)=>{const k=lx+"|"+tp;if(!out.has(k))out.set(k,{lx,ngay,tp,sl,pxk:pxk||"",pnk:pnk||"",nvl:[]});return out.get(k)};
  for(const [,A] of sheets){
    const hi=A.findIndex(r=>r&&r.some(c=>String(c).trim()==="so_lenh"));
    if(hi>=0){const H=A[hi].map(c=>String(c||"").trim()),ix=n=>H.indexOf(n);
      for(const r of A.slice(hi+1)){const lx=String(r[ix("so_lenh")]||"").trim().toUpperCase();if(!lx)continue;
        put(lx,kmsDate(r[ix("ngay")]),String(r[ix("ma_tp")]).trim(),kmsNum(r[ix("sl_tp")]),String(r[ix("pxk")]||"").trim(),String(r[ix("pnk")]||"").trim()).nvl.push({item:String(r[ix("ma_nvl")]).trim(),qty:kmsNum(r[ix("sl_nvl")])})}
      continue}
    /* Mẫu in MISA: "Số:" LX… "Ngày:" …; "Thành phẩm:" "MÃ - tên" ĐVT SL; các dòng NVL: mã, tên, [quy cách], ĐVT, SL, đối tượng THCP. */
    let lx="",ngay="",cur=null;
    for(const r0 of A){const r=(r0||[]).filter(c=>c!==null&&c!=="");if(!r.length)continue;const a=String(r[0]).trim();
      if(a==="Số:"){lx=String(r[1]).trim().toUpperCase();ngay=kmsDate(r[3]);cur=null}
      else if(a==="Thành phẩm:"){const tp=String(r[1]).split(" - ")[0].trim();cur={lx,ngay,tp,sl:kmsNum(r[r.length-2]),pxk:"",pnk:"",nvl:[]};out.set(lx+"|"+tp+"|"+out.size,cur)}
      else if(cur&&r.length>=4&&typeof r[r.length-2]==="number")cur.nvl.push({item:a,qty:r[r.length-2]})}
  }
  return [...out.values()];
}
function kmsStatus(x){
  const it=KHO.items.get(x.tp),nap=KMS.done&&KMS.done.get(x.lx);
  if(nap)return {ok:false,t:"Đã nạp "+nap,c:"grn"};
  if(!it)return {ok:false,t:"Chưa có mã "+x.tp,c:"red"};
  if(it.cls!=="BTP")return {ok:false,t:"Lệnh đóng gói, nạp sau",c:"amb"};
  const thieu=x.nvl.filter(l=>!KHO.items.get(l.item)).map(l=>l.item);
  if(thieu.length)return {ok:false,t:"Chưa có mã "+thieu.join(", "),c:"red"};
  if(!x.ngay||!(x.sl>0)||x.nvl.some(l=>!(l.qty>=0)))return {ok:false,t:"Thiếu ngày / số lượng",c:"red"};
  return {ok:true,t:"Sẵn sàng",c:"blu"};
}
function kmsCard(m){
  if(!kmsCan())return;
  const card=document.createElement("section");card.className="card flush";card.style.marginBottom="12px";
  const R=KMS.rows,S=R?R.map(kmsStatus):[],nOk=S.filter(s=>s.ok).length;
  card.innerHTML=`<div class="card-h pad"><h2>Nạp lệnh pha chế từ MISA</h2><span class="hint">File Excel MISA (in mẫu "Lệnh sản xuất (Chi tiết NVL)" rồi Xuất khẩu) hoặc bảng có cột so_lenh, ngay, ma_tp, sl_tp, pxk, pnk, ma_nvl, sl_nvl. Số nguyên liệu lấy đúng số MISA. Lệnh đã nạp tự bỏ qua.</span><span class="sp"></span><label class="btn">⬆ Chọn file<input type="file" accept=".xlsx,.xls" id="kms-f" hidden></label></div>`+
    (R?`<div class="pad"><b>${R.length}</b> lệnh trong file · <b>${nOk}</b> sẵn sàng ghi${KMS.busy?" · đang ghi…":""} ${nOk&&!KMS.busy?`<button class="btn pri" id="kms-go">Ghi ${nOk} phiếu pha chế</button>`:""}</div>`+
      tbl(["Lệnh","Ngày","Bán thành phẩm","Số lít","Nguyên liệu","PXK · PNK","Trạng thái"],R.map((x,i)=>{const it=KHO.items.get(x.tp);
        return `<tr><td class="mono">${esc(x.lx)}</td><td>${x.ngay?kDd(x.ngay):"—"}</td><td>${esc(it?it.name:x.tp)}<small class="hint mono" style="display:block">${esc(x.tp)}</small></td><td class="n">${knum(x.sl)}</td><td class="n" title="${esc(x.nvl.map(l=>l.item+" "+l.qty).join("\n"))}">${x.nvl.length} dòng</td><td class="mono">${esc([x.pxk,x.pnk].filter(Boolean).join(" · ")||"—")}</td><td>${pill(S[i].t,S[i].c)}</td></tr>`})):"")+
    (KMS.log.length?`<div class="pad hint">${KMS.log.map(esc).join("<br>")}</div>`:"");
  const first=m.querySelector("section.card");if(first)first.before(card);else m.appendChild(card);
  card.querySelector("#kms-f").onchange=async e=>{const f=e.target.files[0];if(!f)return;
    try{const sh=await xReadFile(f);KMS.rows=kmsParse(sh);KMS.log=[];if(!KMS.rows.length)toast("Không thấy lệnh nào trong file");await kmsLoadDone();renderMain()}catch(err){}};
  const go=card.querySelector("#kms-go");if(go)go.onclick=kmsWrite;
}
async function kmsLoadDone(){const r=await kApi("/misa-lx");KMS.done=new Map(r.map(x=>[String(x.lx).toUpperCase(),x.no]))}
async function kmsWrite(){
  const L=KMS.rows.filter(x=>kmsStatus(x).ok);if(!L.length||KMS.busy)return;
  if(!confirm(`Ghi ${L.length} phiếu pha chế từ lệnh MISA vào sổ kho?`))return;
  KMS.busy=true;KMS.log=[];renderMain();let n=0;
  for(const x of L){
    try{const r=await kApi("/docs",{method:"POST",body:JSON.stringify({type:"PC",date:x.ngay,btp:x.tp,liters:x.sl,ref_no:x.lx,note:"Nạp từ lệnh sản xuất MISA "+x.lx,misa:{lx:x.lx,pxk:x.pxk,pnk:x.pnk},lines:x.nvl.map(l=>({item:l.item,qty:l.qty,std_qty:l.qty}))})});
      n++;KMS.done.set(x.lx,r.no)}
    catch(e){KMS.log.push(x.lx+": "+(e.message||"lỗi"))}
  }
  KMS.busy=false;KMS.log.unshift(`Đã ghi ${n}/${L.length} phiếu.`);
  if(KHO.list&&KHO.list.PC)KHO.list.PC.rows=null;toast(`Đã ghi ${n} phiếu pha chế`);renderMain();
}
{const _pc=PAGES.kho_pc;if(_pc)PAGES.kho_pc=function(m){const r=_pc.apply(this,arguments);if(typeof PCH==="undefined"||PCH.tab==="yc")kmsCard(m);return r}}
