/* =====================================================================
   FANPAGE: ĐĂNG BÀI TỰ ĐỘNG (gắn dưới khung "Yêu cầu tháng" của trang ② Lịch đăng chi tiết)
   - Chỉ bài đã DUYỆT (trạng thái "Đã duyệt") mới được đăng; máy không tự duyệt.
   - Chị đặt khung giờ mỗi ngày (d.fpSlots); "Tự xếp giờ" gán page + giờ cho bài đã duyệt chưa có giờ.
   - Công tắc chung: Tắt / Chỉ đăng page thử / Bật. Nút DỪNG KHẨN đưa về Tắt ngay.
   - Máy chủ kiểm tra mỗi giờ (phút 00), nên giờ đăng là giờ tròn.
   - Mã truy cập page chỉ chị Hoa dán vào, được mã hóa trên máy chủ, không hiện lại.
   ===================================================================== */
const FPD={st:null,busy:false,err:""};
const FPD_MODES=[["off","Tắt (không đăng gì)"],["test","Chỉ đăng vào page thử"],["on","Bật (đăng mọi page đã nối)"]];
const fpdSlots=d=>(Array.isArray(d.fpSlots)&&d.fpSlots.length?d.fpSlots:["09:00","12:00","20:00"]);
const fpdNorm=s=>{const m=/^(\d{1,2})(?::?(\d{2}))?$/.exec(String(s).trim());if(!m)return "";const h=+m[1];return h>23?"":String(h).padStart(2,"0")+":00"};
function fpdDriveDirect(u){const m=/drive\.google\.com\/file\/d\/([\w-]+)/.exec(u||"")||/drive\.google\.com\/open\?id=([\w-]+)/.exec(u||"");return m?"https://drive.google.com/uc?export=download&id="+m[1]:(u||"").trim()}
async function fpdLoad(re){
  try{FPD.st=await svApi("/api/hub/fp-publish");FPD.err=""}catch(e){FPD.err=e&&e.message||String(e)}
  if(re)renderMain()
}
function fpdStatus(c){
  if(c.fbState==="ok"||c.step==="xong"&&c.fbPostId)return `<span class="pill p-grn">Đã đăng</span>${c.linkDang?` <a href="${esc(c.linkDang)}" target="_blank" rel="noopener">xem</a>`:""}`;
  if(c.fbState==="sending")return `<span class="pill p-amb">Đang gửi / kẹt, kiểm tra trên page rồi bấm Mở lại</span>`;
  if(c.fbState==="error")return `<span class="pill p-red" title="${esc(c.fbLoi||"")}">Lỗi: ${esc((c.fbLoi||"").slice(0,70))}</span>`;
  if(!c.pageId||!c.gio||!+c.day)return `<span class="pill p-amb">Chưa đủ page / ngày / giờ</span>`;
  return `<span class="pill p-blu">Chờ tới ${esc(c.gio)} ngày ${dd(+c.day)}</span>`
}
function fpdHtml(d,kenh){
  const ceo=isCeo(),give=xvGive(),st=FPD.st,pages=(st&&st.pages)||[],mode=st?st.mode:"off",slots=fpdSlots(d);
  const rows=d.cards.filter(c=>c.kenh===kenh&&(c.step==="dang"||c.fbState)).sort((a,b)=>((+a.day||99)-(+b.day||99))||String(a.gio||"").localeCompare(String(b.gio||"")));
  const pgOpt=[["","— chọn page —"]].concat(pages.filter(p=>p.active).map(p=>[p.page_id,p.name+(p.is_test?" (thử)":"")]));
  const vids=d.cards.filter(c=>c.kenh!==kenh&&(c.linkFinal||c.linkVideo)&&/video|reel/i.test((c.dangVideo||"")+(c.loaiVideo||"")+(c.kenh||"")+"video")).slice(0,200);
  const can=ceo||give,dis=can?"":"disabled";
  const modeBox=!st?`<p class="hint">${esc(FPD.err||"Đang tải…")}</p>`:`<div class="acts"><label>Công tắc chung <select data-fpd="mode" ${ceo?"":"disabled"}>${opt(FPD_MODES,mode)}</select></label>
     <button type="button" class="btn sm" style="background:#dc2626;color:#fff" data-fpd="stop" ${ceo?"":"disabled"}>DỪNG KHẨN</button>
     <span class="pill ${mode==="off"?"p-amb":mode==="test"?"p-blu":"p-grn"}">${mode==="off"?"Đang tắt: máy không đăng gì":mode==="test"?"Chỉ đăng vào page thử":"Đang bật: đăng cả page thật"}</span></div>`;
  const pageBox=`<div class="fpdpg"><b>Page đã nối</b>${pages.length?`<table class="fptab"><thead><tr><th>Tên page</th><th>Mã page</th><th>Loại</th><th></th></tr></thead><tbody>${pages.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.page_id)}</td><td>${p.is_test?"Page thử":"Page thật"}</td><td>${ceo?`<button type="button" class="lnk danger" data-fpdpdel="${esc(p.page_id)}">Ngắt</button>`:""}</td></tr>`).join("")}</tbody></table>`:`<p class="hint">Chưa nối page nào.</p>`}
    ${ceo?`<div class="acts"><input id="fpd-pid" placeholder="Mã page (dãy số)" style="max-width:180px"><input id="fpd-tok" type="password" autocomplete="off" placeholder="Dán mã truy cập page" style="max-width:260px"><label><input type="checkbox" id="fpd-test" checked style="width:auto"> Page thử</label><button type="button" class="btn sm" data-fpd="addpage">Nối page</button></div><p class="hint">Mã truy cập chỉ dán một lần, được cất mã hóa và không hiện lại. Nối page thử trước, thử xong mới nối page thật.</p>`:""}</div>`;
  const slotBox=`<div class="acts"><label>Khung giờ mỗi ngày <input data-fpd="slots" value="${esc(slots.map(s=>s.slice(0,2)).join(", "))}" style="max-width:160px" ${dis} placeholder="9, 12, 20"></label>
    <label>Page mặc định <select data-fpd="defpage" ${dis}>${opt(pgOpt,d.fpPageDefault||"")}</select></label>
    <button type="button" class="btn pri sm" data-fpd="auto" ${dis}>Tự xếp page + giờ cho bài đã duyệt</button></div>`;
  const tbl=rows.length?`<div class="tbl"><table class="fptab"><thead><tr><th>Ngày</th><th>Giờ</th><th>Page</th><th>Bài</th><th>Ảnh / video (link tải trực tiếp)</th><th>Link trang bán</th><th>Tình trạng</th><th></th></tr></thead><tbody>${rows.map(c=>{
    const done=c.fbState==="ok"||c.step==="xong",ro=done||!can||c.fbState==="sending"?"disabled":"";
    return `<tr><td>${+c.day?dd(+c.day):"—"}</td>
     <td><select data-fpdc="${esc(c.id)}|gio" ${ro}>${opt([["","—"]].concat(slots.map(s=>[s,s])),c.gio||"")}</select></td>
     <td><select data-fpdc="${esc(c.id)}|pageId" ${ro}>${opt(pgOpt,c.pageId||"")}</select></td>
     <td>${esc((c.hookText||c.chuDe||c.id).slice(0,60))}<br><small>${esc(c.dangVideo||"Ảnh")}</small></td>
     <td><input class="fpi" data-fpdc="${esc(c.id)}|mediaUrl" value="${esc(c.mediaUrl||"")}" placeholder="https://… (để trống nếu chỉ đăng chữ)" ${ro}>${/video/i.test(c.dangVideo||"")&&vids.length&&!ro?`<select data-fpdvid="${esc(c.id)}"><option value="">Chọn từ kho video…</option>${vids.map(v=>`<option value="${esc(v.id)}">${esc((v.hookText||v.chuDe||v.id).slice(0,50))}</option>`).join("")}</select>`:""}</td>
     <td><input class="fpi" data-fpdc="${esc(c.id)}|linkLanding" value="${esc(c.linkLanding||"")}" placeholder="https://…" ${ro}></td>
     <td>${fpdStatus(c)}</td>
     <td>${ceo&&!done&&c.step==="dang"&&(!c.fbState||c.fbState==="error")?`<button type="button" class="lnk" data-fpdnow="${esc(c.id)}" title="Đăng ngay bài này, bỏ qua giờ (vẫn theo công tắc chung)">Đăng thử ngay</button>`:""}${ceo&&c.fbState&&!done?`<button type="button" class="lnk" data-fpdreset="${esc(c.id)}">Mở lại</button>`:""}</td></tr>`}).join("")}</tbody></table></div>`
    :`<p class="empty">Chưa có bài nào được duyệt. Duyệt bài ở bảng bên dưới (hoặc "3 · Duyệt cả tháng") thì bài hiện ở đây.</p>`;
  const logs=st&&st.logs&&st.logs.length?`<details><summary>Nhật ký đăng gần đây (${st.logs.length})</summary><ul class="hint">${st.logs.map(l=>`<li>${esc(new Date(l.created_at).toLocaleString("vi-VN"))} · ${esc(l.card_id)} · ${l.status==="ok"?"đã đăng":"lỗi: "+esc(l.error||"")}</li>`).join("")}</ul></details>`:"";
  return `<section class="card pad fpdang"><style>.fpdang .acts{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:8px 0}.fpdang label{font-size:12px;color:#6b7280}.fpdang .fpdpg{margin:10px 0}</style>
   <div class="card-h"><h2>Đăng bài tự động lên page</h2><span class="hint">Chỉ bài chị đã duyệt mới được đăng. Máy kiểm tra mỗi giờ tròn.</span></div>
   ${modeBox}${pageBox}${slotBox}${tbl}${logs}</section>`
}
const fpdOrig=pFanpageLich;
pFanpageLich=function(m,chs){
  fpdOrig(m,chs);
  const d=D(),kenh=BV.k;
  if(!FPD.st&&!FPD.busy){FPD.busy=true;fpdLoad(false).then(()=>{FPD.busy=false;renderMain()})}
  const box=document.createElement("div");box.innerHTML=fpdHtml(d,kenh);
  const top=m.querySelector(".bvtop")||m.firstChild;m.insertBefore(box.firstElementChild,top);
  fpdBind(m,d,kenh)
};
function fpdBind(m,d,kenh){
  const post=async(path,body,okMsg)=>{try{const r=await svApi("/api/hub/fp-publish"+path,{method:"POST",body:JSON.stringify(body||{})});if(okMsg)toast(okMsg);await fpdLoad(true);return r}catch(e){toast(e&&e.message||String(e))}};
  m.querySelectorAll("[data-fpd]").forEach(el=>{const k=el.dataset.fpd;
    if(k==="mode")el.onchange=()=>{const v=el.value;if(v==="on"&&!confirm("Bật đăng vào cả page thật? Bài đã duyệt tới giờ sẽ được đăng thật lên page."))return renderMain();post("/mode",{mode:v},"Đã đổi công tắc")};
    else if(k==="stop")el.onclick=()=>post("/mode",{mode:"off"},"Đã DỪNG: máy không đăng thêm bài nào");
    else if(k==="addpage")el.onclick=async()=>{const pid=$("#fpd-pid").value.trim(),tok=$("#fpd-tok").value.trim();if(!pid||!tok){toast("Cần dán cả mã page và mã truy cập");return}
      const r=await post("/pages",{page_id:pid,token:tok,is_test:$("#fpd-test").checked},"");if(r)toast("Đã nối page "+r.name)};
    else if(k==="slots")el.onchange=()=>{const L=el.value.split(/[,;\s]+/).map(fpdNorm).filter(Boolean);if(!L.length){toast("Ghi giờ như: 9, 12, 20");return renderMain()}
      DB.mutate(ME.name,"Fanpage: đặt khung giờ đăng",dt=>{dt.fpSlots=Array.from(new Set(L)).sort()});renderMain()};
    else if(k==="defpage")el.onchange=()=>{DB.mutate(ME.name,"Fanpage: page mặc định",dt=>{dt.fpPageDefault=el.value});renderMain()};
    else if(k==="auto")el.onclick=()=>{
      const slots=fpdSlots(D()),pg=D().fpPageDefault||"";if(!pg){toast("Chọn page mặc định trước");return}
      let n=0;
      DB.mutate(ME.name,"Fanpage: tự xếp page + giờ đăng",dt=>{const per={};
        dt.cards.filter(c=>c.kenh===kenh&&c.step==="dang"&&!c.fbState&&+c.day).sort((a,b)=>(+a.day)-(+b.day)).forEach(c=>{
          if(c.gio&&c.pageId)return;const used=per[c.day]=per[c.day]||new Set((dt.cards.filter(x=>x.kenh===kenh&&+x.day===+c.day&&x.gio).map(x=>x.gio)));
          const free=slots.find(s=>!used.has(s))||slots[used.size%slots.length];if(!c.gio){c.gio=free;used.add(free)}if(!c.pageId)c.pageId=pg;n++})});
      toast(n?"Đã xếp page + giờ cho "+n+" bài":"Không có bài nào cần xếp");renderMain()}});
  m.querySelectorAll("[data-fpdpdel]").forEach(b=>b.onclick=async()=>{if(!confirm("Ngắt page này? Bài đã chọn page này sẽ không đăng được."))return;
    try{await svApi("/api/hub/fp-publish/pages/"+encodeURIComponent(b.dataset.fpdpdel),{method:"DELETE"});toast("Đã ngắt page");fpdLoad(true)}catch(e){toast(e&&e.message||String(e))}});
  m.querySelectorAll("[data-fpdc]").forEach(i=>i.onchange=()=>{const [id,f]=i.dataset.fpdc.split("|"),v=f==="mediaUrl"?fpdDriveDirect(i.value):i.value.trim();
    DB.mutate(ME.name,"Fanpage: sửa thiết lập đăng "+id,dt=>{const c=dt.cards.find(x=>x.id===id);if(c)c[f]=v});renderMain()});
  m.querySelectorAll("[data-fpdvid]").forEach(s=>s.onchange=()=>{const id=s.dataset.fpdvid,v=D().cards.find(x=>x.id===s.value);if(!v)return;
    const u=fpdDriveDirect(v.linkFinal||v.linkVideo);DB.mutate(ME.name,"Fanpage: chọn video từ kho cho "+id,dt=>{const c=dt.cards.find(x=>x.id===id);if(c)c.mediaUrl=u});renderMain()});
  m.querySelectorAll("[data-fpdnow]").forEach(b=>b.onclick=async()=>{const id=b.dataset.fpdnow;if(!confirm("Đăng bài này ngay bây giờ theo công tắc chung hiện tại?"))return;
    try{const r=await svApi("/api/hub/fp-publish/post-now",{method:"POST",body:JSON.stringify({card_id:id})});toast(r.ok?"Đã đăng":"Chưa đăng: "+r.detail);svPoll();fpdLoad(true)}catch(e){toast(e&&e.message||String(e))}});
  m.querySelectorAll("[data-fpdreset]").forEach(b=>b.onclick=()=>{const id=b.dataset.fpdreset;if(!confirm("Mở lại bài này để đăng lại? Hãy kiểm tra trên page là bài CHƯA lên rồi hẵng bấm."))return;
    DB.mutate(ME.name,"Fanpage: mở lại bài đăng lỗi "+id,dt=>{const c=dt.cards.find(x=>x.id===id);if(c){delete c.fbState;delete c.fbLoi}});renderMain()});
}
