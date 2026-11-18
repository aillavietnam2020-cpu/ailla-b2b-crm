/* =====================================================================
   NẠP LỆNH SẢN XUẤT TỪ MISA (chị Hoa 18/11/2026). Trang Pha chế › Yêu cầu & phiếu, chỉ CEO / Kế toán.
   Đọc file Excel: (a) MISA in mẫu "Lệnh sản xuất (Chi tiết NVL)" rồi Xuất khẩu (chọn nhiều file một lúc được), hoặc
   (b) bảng mỗi nguyên liệu một dòng: so_lenh, ngay, ma_tp, sl_tp, pxk, pnk, ma_nvl, sl_nvl (dong_tp nếu một thành phẩm lặp 2 lần).
   Lệnh ra bán thành phẩm → phiếu pha chế (PC); lệnh ra thành phẩm → phiếu đóng gói (KS). Số lấy đúng số MISA, ghi số LX / PXK / PNK.
   Lệnh đã nạp thì bỏ qua (máy chủ chặn trùng).
   ===================================================================== */
const KMS={rows:null,done:null,busy:false,log:[]};
const kmsCan=()=>typeof pchKeToanMe==="function"&&pchKeToanMe();
const kmsDate=v=>{if(typeof v==="number"){const d=new Date(Math.round((v-25569)*864e5));return d.toISOString().slice(0,10)}const s=String(v||"").trim();let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;m=s.match(/^\d{4}-\d{2}-\d{2}/);return m?m[0]:""};
const kmsNum=v=>typeof v==="number"?v:Number(String(v||"").replace(/\./g,"").replace(",","."));
/* Từng thành phẩm của từng lệnh: {lx, ngay, tp, sl, pxk, pnk, nvl:[{item, qty}]}. Một lệnh có trong 2 file thì chỉ lấy lần đầu. */
function kmsParse(sheets){
  const out=new Map(),seen=new Set();
  for(const [,A] of sheets){
    const mine=new Set(),hi=A.findIndex(r=>r&&r.some(c=>String(c).trim()==="so_lenh"));
    if(hi>=0){const H=A[hi].map(c=>String(c||"").trim()),ix=n=>H.indexOf(n);
      for(const r of A.slice(hi+1)){const lx=String(r[ix("so_lenh")]||"").trim().toUpperCase();if(!lx||(seen.has(lx)&&!mine.has(lx)))continue;mine.add(lx);
        const tp=String(r[ix("ma_tp")]).trim(),k=lx+"|"+tp+"|"+(ix("dong_tp")>=0?r[ix("dong_tp")]:"");
        if(!out.has(k))out.set(k,{lx,ngay:kmsDate(r[ix("ngay")]),tp,sl:kmsNum(r[ix("sl_tp")]),pxk:String(r[ix("pxk")]||"").trim(),pnk:String(r[ix("pnk")]||"").trim(),nvl:[]});
        out.get(k).nvl.push({item:String(r[ix("ma_nvl")]).trim(),qty:kmsNum(r[ix("sl_nvl")])})}
    }else{
      /* Mẫu in MISA: "Số:" LX… "Ngày:" …; "Thành phẩm:" "MÃ - tên" ĐVT SL; các dòng NVL: mã, tên, [quy cách], ĐVT, SL, đối tượng THCP. */
      let lx="",ngay="",cur=null,skip=false;
      for(const r0 of A){const r=(r0||[]).filter(c=>c!==null&&c!=="");if(!r.length)continue;const a=String(r[0]).trim();
        if(a==="Số:"){lx=String(r[1]).trim().toUpperCase();ngay=kmsDate(r[3]);cur=null;skip=seen.has(lx)&&!mine.has(lx);mine.add(lx)}
        else if(skip)continue;
        else if(a==="Thành phẩm:"){const tp=String(r[1]).split(" - ")[0].trim();cur={lx,ngay,tp,sl:kmsNum(r[r.length-2]),pxk:"",pnk:"",nvl:[]};out.set(lx+"|"+tp+"|"+out.size,cur)}
        else if(cur&&r.length>=4&&typeof r[r.length-2]==="number")cur.nvl.push({item:a,qty:r[r.length-2]})}
    }
    mine.forEach(x=>seen.add(x));
  }
  return [...out.values()];
}
/* Gộp theo lệnh. Lệnh toàn bán thành phẩm = pha chế, còn lại = đóng gói. */
function kmsLenh(parts){const m=new Map();for(const p of parts){if(!m.has(p.lx))m.set(p.lx,{lx:p.lx,ngay:p.ngay,pxk:p.pxk,pnk:p.pnk,parts:[]});m.get(p.lx).parts.push(p)}
  return [...m.values()].map(x=>Object.assign(x,{kind:x.parts.every(p=>(KHO.items.get(p.tp)||{}).cls==="BTP")?"PC":"KS"}))}
function kmsStatus(x){
  const nap=KMS.done&&KMS.done.get(x.lx);
  if(nap)return {ok:false,t:"Đã nạp "+nap,c:"grn"};
  const thieu=[...new Set(x.parts.flatMap(p=>[p.tp,...p.nvl.map(l=>l.item)]).filter(c=>!KHO.items.get(c)))];
  if(thieu.length)return {ok:false,t:"Chưa có mã "+thieu.join(", "),c:"red"};
  if(x.kind==="PC"&&x.parts.length>1)return {ok:false,t:"Lệnh pha chế có nhiều bán thành phẩm",c:"red"};
  if(!x.ngay||x.parts.some(p=>!(p.sl>0)||p.nvl.some(l=>!(l.qty>=0))))return {ok:false,t:"Thiếu ngày / số lượng",c:"red"};
  return {ok:true,t:"Sẵn sàng",c:"blu"};
}
function kmsCard(m){
  if(!kmsCan())return;
  const card=document.createElement("section");card.className="card flush";card.style.marginBottom="12px";
  const R=KMS.rows?kmsLenh(KMS.rows):null,S=R?R.map(kmsStatus):[],nOk=S.filter(s=>s.ok).length;
  const nm=c=>{const it=KHO.items.get(c);return it?it.name:c};
  card.innerHTML=`<div class="card-h pad"><h2>Nạp lệnh sản xuất từ MISA</h2><span class="hint">File Excel MISA (in mẫu "Lệnh sản xuất (Chi tiết NVL)" rồi Xuất khẩu, chọn nhiều file một lúc được) hoặc bảng có cột so_lenh, ngay, ma_tp, sl_tp, pxk, pnk, ma_nvl, sl_nvl. Lệnh ra bán thành phẩm thành phiếu pha chế, lệnh ra thành phẩm thành phiếu đóng gói. Số lấy đúng số MISA. Lệnh đã nạp tự bỏ qua.</span><span class="sp"></span><label class="btn">⬆ Chọn file<input type="file" accept=".xlsx,.xls" id="kms-f" multiple hidden></label></div>`+
    (R?`<div class="pad"><b>${R.length}</b> lệnh trong file · <b>${nOk}</b> sẵn sàng ghi${KMS.busy?" · đang ghi…":""} ${nOk&&!KMS.busy?`<button class="btn pri" id="kms-go">Ghi ${nOk} phiếu</button>`:""}</div>`+
      tbl(["Lệnh","Ngày","Loại","Thành phẩm / bán thành phẩm","Số lượng","Nguyên liệu","PXK · PNK","Trạng thái"],R.map((x,i)=>{const p0=x.parts[0];
        return `<tr><td class="mono">${esc(x.lx)}</td><td>${x.ngay?kDd(x.ngay):"—"}</td><td>${x.kind==="PC"?"Pha chế":"Đóng gói"}</td><td title="${esc(x.parts.map(p=>p.tp+" × "+p.sl).join("\n"))}">${x.parts.length>1?`${x.parts.length} thành phẩm`:`${esc(nm(p0.tp))}<small class="hint mono" style="display:block">${esc(p0.tp)}</small>`}</td><td class="n">${knum(x.parts.reduce((s,p)=>s+p.sl,0))}</td><td class="n">${x.parts.reduce((s,p)=>s+p.nvl.length,0)} dòng</td><td class="mono">${esc([x.pxk,x.pnk].filter(Boolean).join(" · ")||"—")}</td><td>${pill(S[i].t,S[i].c)}</td></tr>`})):"")+
    (KMS.log.length?`<div class="pad hint">${KMS.log.map(esc).join("<br>")}</div>`:"");
  const first=m.querySelector("section.card");if(first)first.before(card);else m.appendChild(card);
  card.querySelector("#kms-f").onchange=async e=>{const fs=[...e.target.files];if(!fs.length)return;
    try{let sh=[];for(const f of fs)sh=sh.concat(await xReadFile(f));KMS.rows=kmsParse(sh);KMS.log=[];if(!KMS.rows.length)toast("Không thấy lệnh nào trong file");await kmsLoadDone();renderMain()}catch(err){}};
  const go=card.querySelector("#kms-go");if(go)go.onclick=kmsWrite;
}
async function kmsLoadDone(){const r=await kApi("/misa-lx");KMS.done=new Map(r.map(x=>[String(x.lx).toUpperCase(),x.no]))}
function kmsBody(x){const misa={lx:x.lx,pxk:x.pxk,pnk:x.pnk},note="Nạp từ lệnh sản xuất MISA "+x.lx;
  if(x.kind==="PC"){const p=x.parts[0];return {type:"PC",date:x.ngay,btp:p.tp,liters:p.sl,ref_no:x.lx,note,misa,lines:p.nvl.map(l=>({item:l.item,qty:l.qty,std_qty:l.qty}))}}
  return {type:"KS",date:x.ngay,ref_no:x.lx,note,misa,lines:x.parts.map(p=>({item:p.tp,qty:p.sl,nvl:p.nvl}))}}
async function kmsWrite(){
  const L=kmsLenh(KMS.rows).filter(x=>kmsStatus(x).ok);if(!L.length||KMS.busy)return;
  if(!confirm(`Ghi ${L.length} phiếu từ lệnh sản xuất MISA vào sổ kho?`))return;
  KMS.busy=true;KMS.log=[];renderMain();let n=0;
  for(const x of L){
    try{const r=await kApi("/docs",{method:"POST",body:JSON.stringify(kmsBody(x))});n++;KMS.done.set(x.lx,r.no)}
    catch(e){KMS.log.push(x.lx+": "+(e.message||"lỗi"))}
  }
  KMS.busy=false;KMS.log.unshift(`Đã ghi ${n}/${L.length} phiếu.`);
  if(KHO.list){if(KHO.list.PC)KHO.list.PC.rows=null;if(KHO.list.KS)KHO.list.KS.rows=null}toast(`Đã ghi ${n} phiếu`);renderMain();
}
{const _pc=PAGES.kho_pc;if(_pc)PAGES.kho_pc=function(m){const r=_pc.apply(this,arguments);if(typeof PCH==="undefined"||PCH.tab==="yc")kmsCard(m);return r}}
