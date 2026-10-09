/* =====================================================================
   NHẬP HIỆU QUẢ THỰC TẾ TỪ EXCEL (nút ở ③ Kho video)
   File có sheet "Đã duyệt - Chưa đăng" (video chờ đăng) và sheet "Video Đã Đăng Tháng 10" (video đã đăng).
   - Đã đăng: tạo thẻ video đã đăng, rải đều các ngày từ 1 đến hôm nay trong tháng (không cần đúng ngày thật).
   - Chờ đăng: tạo thẻ chờ đăng, chưa xếp ngày (người giữ kênh tự xếp).
   Tài khoản đăng: aillavietnamstore = TT chính · aillavietnamstore 2 = Via 2 · gia dụng aibio = Via 1 (không ghi thì TT chính).
   Nhập lại cùng file thì bỏ qua video đã nhập (khớp ID TikTok hoặc sản phẩm + tên video).
   ===================================================================== */
const NT_SKU=s=>{s=String(s||"").trim().toLowerCase();return /tinh d/.test(s)?"TD":/bột tẩy|bot tay/.test(s)?"BT":/muỗi|muoi/.test(s)?"XM":/ruồi|ruoi/.test(s)?"XR":/sáp|sap/.test(s)?"SAP":/lau sàn|lau san/.test(s)?"LS":"BT"};
const NT_USER=s=>{s=String(s||"").trim().toLowerCase();const u=(D().users||[]).find(x=>x.active!==false&&String(x.name||"").trim().toLowerCase()===s);return u?u.id:""};
const NT_KENH=a=>{a=ntFold(a);return /aibio|gia dung/.test(a)?"TikTok Via 1":/aillavietnamstore[ ]*2/.test(a)?"TikTok Via 2":"TikTok chính"};
const ntFold=s=>String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().trim();
const ntClean=s=>String(s==null?"":s).replace(/\.(mp4|mov)\s*(kb)?\s*$/i,"").trim();
const ntUrl=s=>/^https?:/.test(String(s||"").trim());
function ntRows(wb,rx){
  const nm=wb.SheetNames.find(n=>rx.test(ntFold(n)));if(!nm)return null;
  const A=XLSX.utils.sheet_to_json(wb.Sheets[nm],{header:1,raw:true,defval:""}),hi=A.findIndex(r=>r.some(c=>ntFold(c)==="ma video")&&r.some(c=>ntFold(c)==="sku"));if(hi<0)return null;
  const H=A[hi].map(c=>String(c||"").replace(/\s+/g," ").trim());
  const ws=wb.Sheets[nm],R0=XLSX.utils.decode_range(ws["!ref"]||"A1").s.r,LK=H.map(h=>ntFold(h)==="link video"?1:ntFold(h)==="link dang"?2:0);
  return A.slice(hi+1).map((r,k)=>{const ri=hi+1+k+R0;return {r,ri}}).filter(x=>x.r.some(c=>c!==""&&c!=null)).map(({r,ri})=>{const o={};H.forEach((h,i)=>{if(h)o[h]=r[i];if(LK[i]){const c=ws[XLSX.utils.encode_cell({r:ri,c:i})];if(c&&c.l&&c.l.Target)o["__href"+LK[i]]=c.l.Target}});return o})
}
const ntG=(r,...ks)=>{for(const k of ks){const f=Object.keys(r).find(x=>ntFold(x)===ntFold(k));if(f&&r[f]!==""&&r[f]!=null)return r[f]}return ""};
function ntCard(dt,r,step,kenh,day,seq){
  const id="TT-"+String(seq).padStart(4,"0"),sku=NT_SKU(ntG(r,"SKU")),lk=String(ntG(r,"Link video")).trim(),hook=String(ntG(r,"Hook text","Ý tưởng")).trim()||(ntUrl(lk)?"":ntClean(lk))||String(ntG(r,"Mã video")).trim()||"Video "+sku+" nhập từ Excel";
  const link=String(r.__href2||ntG(r,"Link đăng")).trim(),idv=String(ntG(r,"ID video TikTok (nhân sự nhập)")||(link.match(/\d{19}/)||[""])[0]).trim();
  const kb=NT_USER(ntG(r,"Người lên nội dung")),ed=NT_USER(ntG(r,"Người dựng"))||kb,tuan=weekOf(day||1)||1;
  return {id,thang:MONTH.key,day,qday:0,sku,kenh,ct:"DT",maTuyen:"",tuyen:"",mucTieu:"",nguon:/cu/.test(ntFold(ntG(r,"Nguồn")))?"Lịch đăng cũ":"Quay mới",uuTien:"Trung bình",dangVideo:"One shot",
    yTuong:"",noiDung:String(ntG(r,"Nội dung chi tiết")).trim(),canhQuay:"",hookText:hook.slice(0,300),daoCu:"",caption:String(ntG(r,"Caption")).trim(),nguoi:kb||ed,goiy:"",host:"",nguoiDung:"",ngayQuay:"",
    linkVideo:ntUrl(lk)?lk:(r.__href1||""),linkFinal:ntUrl(lk)?lk:(r.__href1||""),ceo:/pass/i.test(String(ntG(r,"Ceo check")))?"PASS":"CẦN KIỂM TRA",ngayDang:step==="xong"?day:"",linkDang:link,tiktokId:idv.length===19?idv:"",briefHinh:"",linkAnh:"",ketQua:"",order:"",winSrc:"",
    view:+ntG(r,"View")||0,giuChan:+ntG(r,"Giữ chân %")||0,click:+ntG(r,"Click")||0,don:+ntG(r,"Đơn")||0,gmv:+ntG(r,"GMV")||0,step,gopy:[],history:[{t:new Date().toLocaleString("vi-VN"),who:"Nhập từ Excel",to:step}],files:[],createdAt:Date.now(),
    mix:"oneshot",loai:"moi",oneShot:true,giao:kb||ed,nguoiKB:kb,nguoiEdit:ed,duyet:"Đã duyệt",batDau:1,han:0,tuan,nhapExcel:true}
}
function ntBtnHtml(){return xvGive()?`<span class="ntbar"><button type="button" class="btn sm" data-ntimp="1" title="Nhập video đã đăng và video chờ đăng từ file Excel">⬆ Nhập hiệu quả từ Excel</button><input type="file" id="nt-file" accept=".xlsx,.xlsm,.xls" hidden></span>`:""}
function ntBind(b){
  const bt=b.querySelector("[data-ntimp]"),fi=b.querySelector("#nt-file");if(!bt||!fi)return;
  bt.onclick=()=>fi.click();
  fi.onchange=()=>{const f=fi.files[0];fi.value="";if(f)ntImportFile(f)}
}

/* =====================================================================
   TRANG "NHẬP BÁO CÁO" (menu Marketing): mọi chỗ tải báo cáo / file Excel nằm ở đây, kèm lịch sử nhập.
   Tab: Báo cáo video TikTok (Video Performance List: số inhouse và KOC cùng cập nhật) · Báo cáo Ads Facebook ·
        Video đã đăng / chờ đăng (Excel) · Lịch sử nhập
   ===================================================================== */
function ntTabs(tab){return `<div class="tabs">${[["tt","Báo cáo video TikTok"],["tq","Báo cáo tổng quan TikTok"],["ads","Báo cáo Ads Facebook"],["xl","Video đã đăng / chờ đăng (Excel)"],["ls","Lịch sử nhập"]].map(([k,t])=>`<button data-ntt="${k}" class="${k===tab?"on":""}">${t}</button>`).join("")}</div>`}
function ntHistory(){
  const L=(D().imports||[]);
  return `<section class="card">${L.length?tbl(["Lúc","Loại","Tài khoản / nơi nhập","Người nhập","File","Khoảng ngày dữ liệu","Kết quả"],L.map(i=>`<tr><td>${esc(i.at)}</td><td>${pill(i.loai,i.loai==="TikTok"?"pnk":i.loai==="Excel"?"grn":/Tổng quan/.test(i.loai)?"amb":"blu")}</td><td>${esc(i.kenh)}</td><td>${esc(i.by)}</td><td>${esc(i.file)}</td><td>${esc(String(i.range||"").replace(/^Phạm vi ngày:\s*/i,"")||"—")}</td><td>${i.loai==="TikTok"?`${i.sum.match.n} khớp · ${i.sum.stray.n} chưa có thẻ · ${i.sum.auto.n} tự tạo`:(i.loai==="Excel"||/Tổng quan/.test(i.loai))?esc(i.ketQua||""):`chi ${money(i.sum.chi)} · ${nf(i.sum.mua)} đơn`}</td></tr>`)):`<p class="empty">Chưa nhập lần nào.</p>`}</section>`
}
PAGES.nhaplieu=function(m){
  const tab=SUB.nhaplieu||"tt";SUB.nhaplieu=tab;
  const bindT=()=>m.querySelectorAll("[data-ntt]").forEach(b=>b.onclick=()=>{SUB.nhaplieu=b.dataset.ntt;renderMain()});
  if(tab==="ls"||tab==="xl"||tab==="tq"){
    m.innerHTML=H("Nhập báo cáo","Tải báo cáo và file Excel vào web · lịch sử mọi lần nhập")+ntTabs(tab)+(tab==="ls"?ntHistory():tab==="tq"?ntTq():`<section class="card"><div class="card-h"><h2>Video đã đăng và video chờ đăng từ Excel</h2></div><ol class="lessons"><li>File có sheet <b>"Đã duyệt - Chưa đăng"</b> (video chờ đăng) và sheet <b>"Video Đã Đăng Tháng 10"</b> (video đã đăng).</li><li>Video đã đăng được rải đều từ ngày 1 đến hôm nay, không cần đúng ngày thật. Video chờ đăng chỉ để ở "Chờ đăng", người giữ kênh tự xếp ngày.</li><li>Tài khoản đăng: aillavietnamstore = TT chính · aillavietnamstore 2 = Via 2 · gia dụng aibio = Via 1. Không ghi thì xếp vào TT chính.</li><li>Nhập lại cùng file thì web bỏ qua video đã nhập, không bị trùng.</li></ol><p>${ntBtnHtml()||'<span class="hint">Chỉ lead hoặc CEO mới nhập được.</span>'}</p></section>`);
    bindT();ntBind(m);ntTqBind(m);return}
  SUB.baocao=tab;pBaoCao(m);
  const h1=m.querySelector(".ph h1");if(h1)h1.textContent="Nhập báo cáo";
  const t=m.querySelector(".tabs");if(t)t.outerHTML=ntTabs(tab);bindT();
  const last=(D().imports||[]).find(i=>i.loai==="TikTok"),b=m.querySelector("#bb");
  if(tab==="tt"&&b)b.insertAdjacentHTML("afterbegin",`<div class="note">Một file Video Performance List cập nhật cả video inhouse (ở Video win) lẫn video KOC. ${last?"Lần gần nhất: <b>"+esc(last.kenh)+"</b>, dữ liệu "+esc(String(last.range||"").replace(/^Phạm vi ngày:\s*/i,"")||"không rõ ngày")+", tải lúc "+esc(last.at)+".":"Chưa tải lần nào."}</div>`)
};

/* Báo cáo tổng quan TikTok: giao diện tạm. Web nhận file và ghi vào lịch sử, chưa đọc số liệu (sẽ làm sau khi có file mẫu). */
function ntTq(){
  const L=(D().imports||[]).filter(i=>/Tổng quan/.test(i.loai));
  return `<section class="card"><div class="card-h"><h2>Báo cáo tổng quan TikTok</h2><span class="hint">giao diện tạm · web ghi nhận file đã tải, chưa đọc số liệu</span></div>
   <ol class="lessons"><li>TikTok Shop → Phân tích → Tổng quan → chọn khoảng ngày → Xuất.</li><li>Chọn tài khoản, kéo file vào ô dưới. Tải xong, lần tải hiện ở "Lịch sử nhập".</li></ol>
   <div class="frm row4"><label class="field">Tài khoản<select id="tq-k">${opt(CHANNELS.filter(c=>c.needId).map(c=>c.k),"TikTok chính")}</select></label></div>
   ${dropZone("tq")}
   <p class="hint">${L.length?"Đã tải "+L.length+" lần, gần nhất "+esc(L[0].at)+" · "+esc(L[0].kenh)+" · "+esc(L[0].file):"Chưa tải lần nào."}</p></section>`
}
function ntTqBind(m){
  if(!m.querySelector("#dz-tq"))return;
  bindDrop("tq",f=>{const kk=m.querySelector("#tq-k").value;DB.mutate(ME.name,"tải báo cáo tổng quan TikTok "+kk,dt=>{dt.imports=dt.imports||[];dt.imports.unshift({id:uid("i"),loai:"Tổng quan TikTok",kenh:kk,at:new Date().toLocaleString("vi-VN"),by:ME.name,file:f.name,range:"",tuan:weekOf(dt.settings.today)||1,ketQua:"Đã nhận file, chưa đọc số liệu",sum:{chi:0,mua:0,gt:0,match:{n:0},stray:{n:0},auto:{n:0}}})});toast("Đã nhận file "+f.name+" (chưa đọc số liệu)");renderMain()})
}

/* đọc file Excel hiệu quả thực tế và nhập (dùng chung cho nút ở Kho video, trang Nhập báo cáo) */
function ntImportFile(f){
  if(typeof XLSX==="undefined"){toast("Cần mạng để đọc file Excel");return}
  const fr=new FileReader();fr.onload=()=>{try{
    const wb=XLSX.read(fr.result,{type:"array"}),da=ntRows(wb,/da dang/)||[],cho=ntRows(wb,/da duyet.*chua dang|chua dang/)||[];
    if(!da.length&&!cho.length){toast("Không thấy sheet 'Đã duyệt - Chưa đăng' hoặc 'Video Đã Đăng' trong file");return}
    const d=D(),have=new Set(d.cards.filter(c=>c.nhapExcel).map(c=>(c.tiktokId||"")+"|"+c.sku+"|"+ntFold(c.hookText)));
    const key=(r,k)=>{const sku=NT_SKU(ntG(r,"SKU")),link=String(ntG(r,"Link đăng")).trim(),idv=String(ntG(r,"ID video TikTok (nhân sự nhập)")||(link.match(/\d{19}/)||[""])[0]).trim(),lk=String(ntG(r,"Link video")).trim(),hook=String(ntG(r,"Hook text","Ý tưởng")).trim()||(ntUrl(lk)?"":ntClean(lk))||String(ntG(r,"Mã video")).trim()||lk;return (idv.length===19?idv:"")+"|"+sku+"|"+ntFold(hook.slice(0,300))};
    const drv=u=>{const m=String(u||"").match(/[/]d[/]([A-Za-z0-9_-]{10,})/);return m?m[1]:""},rowId=r=>{const lk=String(ntG(r,"Link video")).trim();return drv(ntUrl(lk)?lk:r.__href1)},cardId=c=>drv(c.linkVideo||c.linkFinal);
    const exist=d.cards.filter(c=>c.nhapExcel&&c.step==="dang"),newIds=new Set(cho.map(rowId).filter(Boolean));
    const drop=cho.length?exist.filter(c=>!newIds.has(cardId(c))&&!c.linkDang&&!String(c.caption||"").trim()):[],dropIds=new Set(drop.map(c=>c.id));
    const have2=new Set(d.cards.filter(c=>c.nhapExcel&&!dropIds.has(c.id)).map(c=>(c.tiktokId||"")+"|"+c.sku+"|"+ntFold(c.hookText))),keepIds=new Set(exist.filter(c=>!dropIds.has(c.id)).map(cardId).filter(Boolean));
    const allIds=new Set(d.cards.filter(c=>c.nhapExcel).map(cardId).filter(Boolean)),isOld=r=>{const id=rowId(r);return (id&&allIds.has(id))||have.has(key(r))};
    const daN=da.filter(r=>!isOld(r)),choN=cho.filter(r=>{const id=rowId(r);return id?!keepIds.has(id):!have2.has(key(r))});
      const byKey={};d.cards.filter(c=>c.nhapExcel).forEach(c=>{byKey[(c.tiktokId||"")+"|"+c.sku+"|"+ntFold(c.hookText)]=c.id;const ci=cardId(c);if(ci)byKey["id:"+ci]=c.id});
      const fill=da.concat(cho).filter(r=>isOld(r)&&(byKey["id:"+rowId(r)]||byKey[key(r)])).map(r=>({id:byKey["id:"+rowId(r)]||byKey[key(r)],href:r.__href1||"",href2:r.__href2||""})).filter(x=>{const c=d.cards.find(y=>y.id===x.id);return c&&((x.href&&!c.linkVideo)||(x.href2&&!c.linkDang))});
      if(!daN.length&&!choN.length&&!fill.length&&!drop.length){toast("Các video trong file đã nhập rồi");return}
    const end=Math.max(1,Math.min(MONTH.ndays,d.settings.today)),cnt={};daN.forEach(r=>{const k=NT_KENH(ntG(r,"Tài khoản đăng"));cnt[k]=(cnt[k]||0)+1});
    const msg="Nhập từ file:\n• "+daN.length+" video ĐÃ ĐĂNG ("+Object.entries(cnt).map(([k,n])=>chOf(k).short+" "+n).join(", ")+"), rải đều từ ngày 1 đến "+end+"\n• "+choN.length+" video CHỜ ĐĂNG (chưa xếp ngày)\n"+((da.length-daN.length)+(cho.length-choN.length)?"• Bỏ qua "+((da.length-daN.length)+(cho.length-choN.length))+" video đã nhập trước đó\n":"")+(fill.length?"• Bổ sung link video cho "+fill.length+" video đã nhập trước đó\n":"")+(drop.length?"• Bỏ "+drop.length+" video chờ đăng cũ không còn trong sheet (chưa ai làm gì trên đó)\n":"")+"\nTiếp tục?";
    if(!confirm(msg))return;
    DB.mutate(ME.name,"nhập hiệu quả từ Excel: "+daN.length+" đã đăng, "+choN.length+" chờ đăng"+(fill.length?", bổ sung link "+fill.length:"")+(drop.length?", bỏ "+drop.length+" chờ đăng cũ":""),dt=>{
      if(drop.length){const ids=new Set(drop.map(c=>c.id));dt.cards=dt.cards.filter(c=>!ids.has(c.id))}
        fill.forEach(x=>{const c=dt.cards.find(y=>y.id===x.id);if(!c)return;if(x.href&&!c.linkVideo){c.linkVideo=x.href;c.linkFinal=x.href}if(x.href2&&!c.linkDang){c.linkDang=x.href2;const m=x.href2.match(/[0-9]{19}/);if(m&&!c.tiktokId)c.tiktokId=m[0]}});
      let seq=Math.max(0,...dt.cards.map(c=>+String(c.id||"").replace(/\D/g,"")||0));
      const byK={};daN.forEach(r=>{const k=NT_KENH(ntG(r,"Tài khoản đăng"));(byK[k]=byK[k]||[]).push(r)});
      Object.entries(byK).forEach(([k,L])=>L.forEach((r,i)=>{dt.cards.push(ntCard(dt,r,"xong",k,1+Math.floor(i*end/L.length),++seq))}));
      choN.forEach(r=>{const all=Object.values(r).join(" "),k=/gia dung aibio/.test(ntFold(all))?"TikTok Via 1":/aillavietnamstore[ ]*2/.test(ntFold(all))?"TikTok Via 2":NT_KENH(ntG(r,"Tài khoản đăng"));dt.cards.push(ntCard(dt,r,"dang",k,0,++seq))})});
    DB.mutate(ME.name,"ghi lịch sử nhập Excel",dt=>{dt.imports=dt.imports||[];dt.imports.unshift({id:uid("i"),loai:"Excel",kenh:"Kho video",at:new Date().toLocaleString("vi-VN"),by:ME.name,file:f.name,range:"",tuan:weekOf(dt.settings.today)||1,ketQua:daN.length+" đã đăng mới · "+choN.length+" chờ đăng mới"+(fill.length?" · bổ sung link cho "+fill.length+" video":"")+(drop.length?" · bỏ "+drop.length+" chờ đăng cũ":""),sum:{chi:0,mua:0,gt:0,match:{n:0},stray:{n:0},auto:{n:0}}})});
    toast("Đã nhập "+daN.length+" video đã đăng và "+choN.length+" video chờ đăng"+(fill.length?", bổ sung link cho "+fill.length+" video":"")+(drop.length?", bỏ "+drop.length+" chờ đăng cũ":""));XV.ks="sx";renderMain()
  }catch(e){toast("Không đọc được file: "+(e&&e.message||e))}};fr.readAsArrayBuffer(f)
}
/* file "Hệ thống quản trị content" (có sheet Video Đã Đăng) đưa nhầm vào ô báo cáo TikTok: tự chuyển sang nhập hiệu quả thực tế */
function ntIsContentFile(f){return new Promise(res=>{if(typeof XLSX==="undefined"){res(false);return}const r=new FileReader();r.onload=()=>{try{const wb=XLSX.read(r.result,{type:"array",bookSheets:true});res(wb.SheetNames.some(n=>/da dang/.test(ntFold(n))&&/video/.test(ntFold(n))))}catch(e){res(false)}};r.onerror=()=>res(false);r.readAsArrayBuffer(f)})}

