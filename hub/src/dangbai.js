/* =====================================================================
   FANPAGE: LỊCH ĐĂNG BÀI KIỂU POSTIZ (đặt trên đầu trang ② Lịch đăng chi tiết của kênh Fanpage)
   Cấu trúc theo Postiz: thanh công cụ (Tuần / Tháng, điều hướng ngày, công tắc đăng tự động, Tạo bài)
   · cột Kênh (các page) bên trái · lịch ở giữa, bài là thẻ nhỏ, kéo thả để đổi ngày giờ
   · bấm ô trống hoặc thẻ bài mở cửa sổ soạn bài: chọn page, nội dung, ảnh/video, ngày giờ + xem trước giống Facebook.
   Quy tắc: máy chỉ đăng bài ở trạng thái "Đã duyệt". Agent Fanpage trên VPS giữ mã page, mỗi giờ hỏi /api/fp/due
   để lấy bài tới giờ, đăng rồi báo /api/fp/done. Bài là thẻ video kênh Fanpage (d.cards), không có kho dữ liệu riêng.
   ===================================================================== */
const FPC={view:"month",y:0,m:0,anchor:"",hide:new Set(),st:null,err:"",loading:false,ed:null,drag:""};
const fpcPad=n=>String(n).padStart(2,"0");
const fpcIso=(y,m,d)=>y+"-"+fpcPad(m)+"-"+fpcPad(d);
const fpcDt=s=>{const a=String(s).split("-");return new Date(+a[0],+a[1]-1,+a[2])};
const fpcDs=t=>fpcIso(t.getFullYear(),t.getMonth()+1,t.getDate());
const fpcAdd=(s,n)=>{const t=fpcDt(s);t.setDate(t.getDate()+n);return fpcDs(t)};
const fpcDM=s=>{const a=String(s).split("-");return a[2]+"/"+a[1]};
const fpcToday=()=>fpcDs(new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Ho_Chi_Minh"})));
/* Ngày đăng đầy đủ của bài: pdate nếu có, không thì tháng của thẻ + ngày (thẻ cũ chưa có pdate) */
const fpcDate=c=>c.pdate||(+c.day?(c.thang||MONTH.key)+"-"+fpcPad(+c.day):"");
function fpcInit(){if(!FPC.y){const t=fpcToday().split("-");FPC.y=+t[0];FPC.m=+t[1];FPC.anchor=fpcToday()}}
const FPC_HOURS=Array.from({length:17},(_,i)=>i+7);
const FPC_ST={nhap:["Nháp","#64748b","#f1f5f9"],cho:["Chờ duyệt","#b45309","#fff4e5"],lich:["Đã lên lịch","#4b54d1","#eef0ff"],xong:["Đã đăng","#087a55","#e8f8f0"],loi:["Lỗi","#b42318","#fff1f0"]};
const fpcStOf=c=>c.fbState==="error"?"loi":c.step==="xong"?"xong":c.step==="dang"?"lich":["dvd","dceo","dkb"].includes(c.step)?"cho":"nhap";
const fpcHue=s=>{let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))%360;return h};
const fpcAv=(p,sz)=>`<span class="fpc-av" style="width:${sz||28}px;height:${sz||28}px;background:hsl(${fpcHue(p.page_id)} 55% 48%)" title="${esc(p.name)}">${esc((p.name||"?").trim().charAt(0).toUpperCase())}</span>`;
function fpcDirect(u){const m=/drive\.google\.com\/file\/d\/([\w-]+)/.exec(u||"")||/drive\.google\.com\/open\?id=([\w-]+)/.exec(u||"");return m?"https://drive.google.com/uc?export=download&id="+m[1]:(u||"").trim()}
const fpcPages=()=>((FPC.st&&FPC.st.pages)||[]).filter(p=>p.active);
const fpcPage=id=>fpcPages().find(p=>p.page_id===id);
async function fpcLoad(){FPC.loading=true;try{FPC.st=await svApi("/api/hub/fp-publish");FPC.err=""}catch(e){FPC.err=e&&e.message||String(e)}FPC.loading=false;renderMain()}
function fpcPosts(){const d=D();return d.cards.filter(c=>c.kenh===BV.k&&fpcDate(c)&&(!c.pageId||!FPC.hide.has(c.pageId)))}
function fpcBoss(){return xvGive()||can(ME,"viec.duyet")||ME.role==="admin"}
function fpcWeek(anchor){const t=fpcDt(anchor||fpcToday()),mon=fpcAdd(fpcDs(t),-((t.getDay()+6)%7));
  return Array.from({length:7},(_,i)=>{const ds=fpcAdd(mon,i);return{ds,d:+ds.slice(8),dow:i}})}
const FPC_DOW=["T2","T3","T4","T5","T6","T7","CN"];

function fpcChip(c){
  const s=FPC_ST[fpcStOf(c)],p=fpcPage(c.pageId),txt=(c.noiDung||c.hookText||c.chuDe||"(chưa có nội dung)").replace(/\s+/g," ").slice(0,48);
  return `<div class="fpc-chip" draggable="${fpcStOf(c)==="xong"?"false":"true"}" data-fpcp="${esc(c.id)}" style="border-left-color:${s[1]};background:${s[2]}" title="${esc(s[0])}">${p?fpcAv(p,18):`<span class="fpc-av" style="width:18px;height:18px;background:#cbd5e1">?</span>`}<span class="fpc-ct">${c.gio?`<b>${esc(c.gio.slice(0,5))}</b> `:""}${esc(txt)}</span></div>`}
function fpcMonth(){
  const y=FPC.y,mo=FPC.m,nd=new Date(y,mo,0).getDate(),lead=(new Date(y,mo-1,1).getDay()+6)%7,today=fpcToday(),P=fpcPosts(),cells=[];
  for(let i=0;i<lead;i++)cells.push(`<div class="fpc-cell off"></div>`);
  for(let x=1;x<=nd;x++){const ds=fpcIso(y,mo,x),L=P.filter(c=>fpcDate(c)===ds).sort((a,b)=>String(a.gio||"").localeCompare(String(b.gio||"")));
    cells.push(`<div class="fpc-cell${ds===today?" today":""}" data-fpcd="${ds}"><div class="fpc-dn">${x}<button type="button" class="fpc-plus" data-fpcnew="${ds}" title="Tạo bài ngày ${fpcDM(ds)}">+</button></div>${L.slice(0,4).map(fpcChip).join("")}${L.length>4?`<div class="fpc-more" data-fpcwk="${ds}">+${L.length-4} bài nữa</div>`:""}</div>`)}
  return `<div class="fpc-mh">${FPC_DOW.map(w=>`<div>${w}</div>`).join("")}</div><div class="fpc-mg">${cells.join("")}</div>`}
function fpcWeekView(){
  const W=fpcWeek(FPC.anchor),P=fpcPosts(),today=fpcToday();
  return `<div class="fpc-wg"><div class="fpc-wh"></div>${W.map(w=>`<div class="fpc-wh${w.ds===today?" today":""}">${FPC_DOW[w.dow]}<b>${w.d}</b></div>`).join("")}
   ${FPC_HOURS.map(h=>`<div class="fpc-hr">${fpcPad(h)}:00</div>${W.map(w=>{const L=P.filter(c=>fpcDate(c)===w.ds&&parseInt(c.gio,10)===h).sort((a,b)=>String(a.gio).localeCompare(String(b.gio)));return `<div class="fpc-slot" data-fpcd="${w.ds}" data-fpch="${h}">${L.map(fpcChip).join("")}${!L.length?`<button type="button" class="fpc-plus" data-fpcnew="${w.ds}" data-fpch="${h}">+</button>`:""}</div>`}).join("")}`).join("")}</div>`}
function fpcRail(){
  const ceo=isCeo(),pages=fpcPages();
  return `<aside class="fpc-rail"><div class="fpc-rh">Kênh</div>${pages.map(p=>{const off=FPC.hide.has(p.page_id);return `<div class="fpc-pg${off?" off":""}"><button type="button" class="fpc-pgb" data-fpcpg="${esc(p.page_id)}" title="Bấm để ẩn / hiện bài của page này">${fpcAv(p,32)}<span><b>${esc(p.name)}</b><small>${p.is_test?"Page thử":"Page thật"}</small></span></button>${ceo?`<button type="button" class="fpc-x" data-fpcpdel="${esc(p.page_id)}" title="Ngắt page">✕</button>`:""}</div>`}).join("")||`<p class="hint">Chưa có page.</p>`}
   ${ceo?`<details class="fpc-add"><summary>+ Thêm page</summary><input id="fpc-pid" placeholder="Mã page (dãy số)"><input id="fpc-nm" placeholder="Tên page"><label><input type="checkbox" id="fpc-test" checked style="width:auto"> Page thử</label><button type="button" class="btn sm pri" data-fpcaddpg="1">Thêm</button><p class="hint">Mã truy cập nằm ở agent trên VPS; web không giữ mã nào.</p></details>`:""}</aside>`}
function fpcBar(){
  const st=FPC.st,mode=st?st.mode:"off",ceo=isCeo(),mv=FPC.view==="month",
   label=mv?`Tháng ${FPC.m}/${FPC.y}`:(()=>{const W=fpcWeek(FPC.anchor);return `${fpcDM(W[0].ds)} – ${fpcDM(W[6].ds)}/${W[6].ds.slice(0,4)}`})();
  return `<div class="fpc-bar"><div class="fpc-seg"><button type="button" class="${FPC.view==="week"?"on":""}" data-fpcv="week">Tuần</button><button type="button" class="${mv?"on":""}" data-fpcv="month">Tháng</button></div>
   <button type="button" class="fpc-nav" data-fpcnav="-1">‹</button><b class="fpc-lb">${label}</b><button type="button" class="fpc-nav" data-fpcnav="1">›</button><button type="button" class="fpc-nav" data-fpcnav="0">Hôm nay</button>
   <span class="sp"></span>
   ${st?`<select data-fpcmode="1" ${ceo?"":"disabled"} class="fpc-mode m-${mode}">${opt([["off","Đăng tự động: Tắt"],["test","Đăng tự động: chỉ page thử"],["on","Đăng tự động: Bật"]],mode)}</select><button type="button" class="fpc-stop" data-fpcstop="1" ${ceo?"":"disabled"}>DỪNG KHẨN</button>`:`<span class="hint">${esc(FPC.err||"Đang tải…")}</span>`}
   <button type="button" class="btn pri" data-fpcnew="${mv&&!(FPC.y+"-"+fpcPad(FPC.m)===fpcToday().slice(0,7))?fpcIso(FPC.y,FPC.m,1):fpcToday()}">+ Tạo bài</button></div>`}
function fpcPreview(e){
  const p=fpcPage(e.pageId),media=e.media&&e.fmt==="Ảnh"?`<img src="${esc(e.media)}" alt="" onerror="this.style.display='none'">`:e.media&&e.fmt==="Video"?`<div class="fpc-vid">▶ Video</div>`:"";
  return `<div class="fpc-fb"><div class="fpc-fbh">${p?fpcAv(p,38):`<span class="fpc-av" style="width:38px;height:38px;background:#cbd5e1">?</span>`}<div><b>${esc(p?p.name:"Chọn page")}</b><small>Bây giờ · 🌐</small></div></div>
   <div class="fpc-fbt">${e.text?esc(e.text).replace(/\n/g,"<br>"):`<span class="hint">Nội dung bài sẽ hiện ở đây…</span>`}</div>${media}${e.link?`<div class="fpc-lk">${esc(e.link.replace(/^https?:\/\//,"").slice(0,60))}</div>`:""}
   <div class="fpc-fbf">👍 Thích &nbsp; 💬 Bình luận &nbsp; ↗ Chia sẻ</div></div>`}
function fpcModal(){
  const e=FPC.ed;if(!e)return;const pages=fpcPages(),ro=e.st==="xong",boss=fpcBoss();
  crmModal(e.id?"Sửa bài":"Tạo bài mới",`<div class="fpc-md"><div class="fpc-mf">
    <div class="fpc-lab">Đăng lên page</div><div class="fpc-pick">${pages.map(p=>`<button type="button" class="fpc-pk${e.pageId===p.page_id?" on":""}" data-fpcpick="${esc(p.page_id)}" ${ro?"disabled":""}>${fpcAv(p,34)}<small>${esc(p.name)}${p.is_test?" (thử)":""}</small></button>`).join("")||`<span class="hint">Thêm page ở cột Kênh trước.</span>`}</div>
    <div class="fpc-lab">Nội dung</div><textarea id="fpc-tx" rows="8" placeholder="Viết nội dung bài…" ${ro?"disabled":""}>${esc(e.text)}</textarea>
    <div class="fpc-row"><label>Dạng bài<select id="fpc-fmt" ${ro?"disabled":""}>${opt([["","Chỉ chữ"],["Ảnh","Ảnh"],["Video","Video"]],e.fmt)}</select></label>
     <label class="g">Link ảnh / video (link tải trực tiếp)<input id="fpc-md" value="${esc(e.media)}" placeholder="https://…" ${ro?"disabled":""}></label></div>
    <label>Link trang bán (đính kèm bài chữ)<input id="fpc-lk" value="${esc(e.link)}" placeholder="https://…" ${ro?"disabled":""}></label>
    ${e.fmt==="Video"&&!ro?`<label>Lấy video từ kho<select id="fpc-vid"><option value="">Chọn video trong kho…</option>${D().cards.filter(c=>c.kenh!==BV.k&&(c.linkFinal||c.linkVideo)).slice(0,200).map(v=>`<option value="${esc(v.id)}">${esc((v.hookText||v.chuDe||v.id).slice(0,60))}</option>`).join("")}</select></label>`:""}
    <div class="fpc-row"><label>Ngày<input type="date" id="fpc-dy" value="${esc(e.date)}" ${ro?"disabled":""}></label>
     <label>Giờ<select id="fpc-gio" ${ro?"disabled":""}>${opt([["","— giờ —"]].concat(FPC_HOURS.map(h=>[fpcPad(h),fpcPad(h)+" giờ"])),(e.gio||"").slice(0,2))}</select></label>
     <label>Phút<select id="fpc-ph" ${ro?"disabled":""}>${opt(["00","15","30","45"].map(x=>[x,x]),(e.gio||"").slice(3,5)||"00")}</select></label></div>
    ${e.err?`<p class="fpc-err">${esc(e.err)}</p>`:""}
   </div><div class="fpc-mp"><div class="fpc-lab">Xem trước</div><div id="fpc-pv">${fpcPreview(e)}</div></div></div>
   <div class="fpc-mfoot"><span class="pill" style="background:${FPC_ST[e.st][2]};color:${FPC_ST[e.st][1]}">${FPC_ST[e.st][0]}</span><span class="sp"></span>
    ${e.id&&!ro?`<button type="button" class="lnk danger" data-fpcdo="del">Xóa</button>`:""}${ro?"":`<button type="button" class="btn" data-fpcdo="nhap">Lưu nháp</button><button type="button" class="btn" data-fpcdo="cho">Gửi duyệt</button><button type="button" class="btn pri" data-fpcdo="lich" ${boss?"":"disabled title=\"Chỉ người duyệt\""}>Duyệt &amp; lên lịch</button>`}</div>`,true);
  const sync=()=>{const g=id=>document.getElementById(id);e.text=g("fpc-tx").value;e.fmt=g("fpc-fmt").value;e.media=fpcDirect(g("fpc-md").value);e.link=g("fpc-lk").value.trim();e.date=g("fpc-dy").value;e.gio=g("fpc-gio").value?g("fpc-gio").value+":"+g("fpc-ph").value:"";g("fpc-pv").innerHTML=fpcPreview(e)};
  ["fpc-tx","fpc-md","fpc-lk","fpc-dy","fpc-gio","fpc-ph"].forEach(i=>{const el=document.getElementById(i);if(el)el.oninput=el.onchange=sync});
  const fm=document.getElementById("fpc-fmt");if(fm)fm.onchange=()=>{sync();fpcModal()};
  const vd=document.getElementById("fpc-vid");if(vd)vd.onchange=()=>{const v=D().cards.find(x=>x.id===vd.value);if(v){e.media=fpcDirect(v.linkFinal||v.linkVideo);fpcModal()}};
  document.querySelectorAll("[data-fpcpick]").forEach(b=>b.onclick=()=>{sync();e.pageId=b.dataset.fpcpick;fpcModal()});
  document.querySelectorAll("[data-fpcdo]").forEach(b=>b.onclick=()=>{sync();fpcSave(b.dataset.fpcdo)})}
function fpcOpen(id,date,gio){
  const c=id?D().cards.find(x=>x.id===id):null;
  FPC.ed=c?{id:c.id,st:fpcStOf(c),pageId:c.pageId||"",text:c.noiDung||c.hookText||"",fmt:c.mediaUrl?(/video/i.test(c.dangVideo||"")?"Video":"Ảnh"):"",media:c.mediaUrl||"",link:c.linkLanding||"",date:fpcDate(c)||fpcToday(),gio:c.gio||"",err:c.fbLoi||""}
   :{id:"",st:"nhap",pageId:(fpcPages().filter(p=>!FPC.hide.has(p.page_id))[0]||{}).page_id||"",text:"",fmt:"",media:"",link:"",date:date||fpcToday(),gio:gio?fpcPad(gio)+":00":"",err:""};
  fpcModal()}
function fpcSave(to){
  const e=FPC.ed,k=BV.k;
  if(to==="del"){if(!confirm("Xóa bài này khỏi lịch?"))return;DB.mutate(ME.name,"Fanpage: xóa bài "+e.id,dt=>{dt.cards=dt.cards.filter(c=>c.id!==e.id)});closeCM();FPC.ed=null;renderMain();return}
  if(!e.text.trim()&&!e.media){e.err="Bài chưa có nội dung";return fpcModal()}
  if(to==="lich"){if(!fpcBoss()){e.err="Chỉ người duyệt mới được duyệt";return fpcModal()}
    if(!e.pageId||!e.gio||!e.date){e.err="Chọn page, ngày và giờ trước khi duyệt & lên lịch";return fpcModal()}}
  const step={nhap:"kb",cho:"dvd",lich:"dang"}[to];
  DB.mutate(ME.name,"Fanpage: "+(e.id?"sửa":"tạo")+" bài ("+to+")",dt=>{
    let c=e.id&&dt.cards.find(x=>x.id===e.id);if(!c){c=fpNewPost(dt,k,"");dt.cards.push(c)}
    c.noiDung=e.text;c.hookText=(e.text.split("\n")[0]||"").slice(0,90);c.pageId=e.pageId;c.pdate=e.date;c.day=+e.date.slice(8);c.gio=e.gio;c.mediaUrl=e.media;c.linkLanding=e.link;c.dangVideo=e.fmt||"Ảnh";
    if(c.fbState==="error"){delete c.fbState;delete c.fbLoi}
    c.step=step;c.history=(c.history||[]).concat({t:new Date().toLocaleString("vi-VN"),who:ME.name,to:step})});
  closeCM();FPC.ed=null;toast(to==="lich"?"Đã duyệt: agent sẽ đăng vào "+(e.gio||"")+" ngày "+fpcDM(e.date):to==="cho"?"Đã gửi duyệt":"Đã lưu nháp");renderMain()}
async function fpcApi(path,method,body){try{const r=await svApi("/api/hub/fp-publish"+path,{method:method||"POST",body:body?JSON.stringify(body):undefined});await fpcLoad();return r}catch(e){toast(e&&e.message||String(e))}}
function fpcBind(m){
  m.querySelectorAll("[data-fpcv]").forEach(b=>b.onclick=()=>{FPC.view=b.dataset.fpcv;if(FPC.view==="week"){const t=fpcToday();FPC.anchor=t.slice(0,7)===FPC.y+"-"+fpcPad(FPC.m)?t:fpcIso(FPC.y,FPC.m,1)}renderMain()});
  m.querySelectorAll("[data-fpcnav]").forEach(b=>b.onclick=()=>{const n=+b.dataset.fpcnav;
    if(!n){const t=fpcToday().split("-");FPC.y=+t[0];FPC.m=+t[1];FPC.anchor=fpcToday()}
    else if(FPC.view==="week"){FPC.anchor=fpcAdd(FPC.anchor,7*n);FPC.y=+FPC.anchor.slice(0,4);FPC.m=+FPC.anchor.slice(5,7)}
    else{const t=new Date(FPC.y,FPC.m-1+n,1);FPC.y=t.getFullYear();FPC.m=t.getMonth()+1}
    renderMain()});
  m.querySelectorAll("[data-fpcwk]").forEach(b=>b.onclick=()=>{FPC.anchor=b.dataset.fpcwk;FPC.view="week";renderMain()});
  m.querySelectorAll("[data-fpcnew]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();fpcOpen("",b.dataset.fpcnew,b.dataset.fpch?+b.dataset.fpch:0)});
  m.querySelectorAll("[data-fpcp]").forEach(b=>{b.onclick=ev=>{ev.stopPropagation();fpcOpen(b.dataset.fpcp)};b.ondragstart=ev=>{FPC.drag=b.dataset.fpcp;ev.dataTransfer.effectAllowed="move";ev.dataTransfer.setData("text/plain",FPC.drag)}});
  m.querySelectorAll("[data-fpcd]").forEach(z=>{z.ondragover=ev=>{ev.preventDefault();z.classList.add("drop")};z.ondragleave=()=>z.classList.remove("drop");
    z.ondrop=ev=>{ev.preventDefault();z.classList.remove("drop");const id=FPC.drag;FPC.drag="";const ds=z.dataset.fpcd,h=z.dataset.fpch;if(!id)return;
      const c=D().cards.find(x=>x.id===id);if(!c||fpcStOf(c)==="xong"||c.fbState==="sending")return;
      DB.mutate(ME.name,"Fanpage: dời bài "+id+" sang ngày "+ds,dt=>{const k=dt.cards.find(x=>x.id===id);if(!k)return;k.pdate=ds;k.day=+ds.slice(8);if(h)k.gio=fpcPad(+h)+":"+((k.gio||"").slice(3,5)||"00");if(k.fbState==="error"){delete k.fbState;delete k.fbLoi}});renderMain()}});
  m.querySelectorAll("[data-fpcpg]").forEach(b=>b.onclick=()=>{const id=b.dataset.fpcpg;FPC.hide.has(id)?FPC.hide.delete(id):FPC.hide.add(id);renderMain()});
  m.querySelectorAll("[data-fpcpdel]").forEach(b=>b.onclick=async()=>{if(!confirm("Ngắt page này? Bài đã chọn page này sẽ không đăng được."))return;await fpcApi("/pages/"+encodeURIComponent(b.dataset.fpcpdel),"DELETE")});
  m.querySelectorAll("[data-fpcaddpg]").forEach(b=>b.onclick=async()=>{const pid=$("#fpc-pid").value.trim(),nm=$("#fpc-nm").value.trim();if(!pid||!nm){toast("Cần ghi cả mã page và tên page");return}
    const r=await fpcApi("/pages","POST",{page_id:pid,name:nm,is_test:$("#fpc-test").checked});if(r)toast("Đã thêm page "+r.name)});
  m.querySelectorAll("[data-fpcmode]").forEach(s=>s.onchange=async()=>{const v=s.value;if(v==="on"&&!confirm("Bật đăng cả page thật? Bài đã duyệt tới giờ sẽ được đăng thật."))return renderMain();await fpcApi("/mode","POST",{mode:v});toast("Đã đổi công tắc")});
  m.querySelectorAll("[data-fpcstop]").forEach(b=>b.onclick=async()=>{await fpcApi("/mode","POST",{mode:"off"});toast("Đã DỪNG: agent không đăng thêm bài nào")})}
const fpcStyle=`<style>
.fpc{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);margin-bottom:16px;overflow:hidden}
.fpc-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--line)}.fpc-bar .sp,.fpc-mfoot .sp{flex:1}
.fpc-seg{display:inline-flex;background:#f1f2f9;border-radius:10px;padding:3px}.fpc-seg button{border:0;background:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-weight:600;color:#4b5167}.fpc-seg .on{background:#fff;color:#4b54d1;box-shadow:0 1px 3px rgba(30,35,80,.15)}
.fpc-nav{border:1px solid var(--line);background:#fff;border-radius:8px;padding:5px 11px;cursor:pointer}.fpc-lb{font-size:16px;min-width:120px;text-align:center}
.fpc-mode{width:auto;font-weight:600}.fpc-mode.m-on{border-color:#087a55;color:#087a55}.fpc-mode.m-test{border-color:#4b54d1;color:#4b54d1}.fpc-mode.m-off{color:#b45309;border-color:#f2c48a}
.fpc-stop{border:0;background:#dc2626;color:#fff;font-weight:700;border-radius:10px;padding:8px 14px;cursor:pointer}.fpc-stop:disabled{opacity:.4;cursor:default}
.fpc-body{display:grid;grid-template-columns:220px minmax(0,1fr)}
.fpc-rail{border-right:1px solid var(--line);padding:14px 12px;background:#fafbff}.fpc-rh{font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5b6176;margin:0 4px 10px}
.fpc-pg{display:flex;align-items:center;gap:4px;margin-bottom:6px}.fpc-pg.off{opacity:.38}.fpc-pgb{flex:1;display:flex;align-items:center;gap:10px;border:0;background:none;text-align:left;padding:6px;border-radius:10px;cursor:pointer;min-width:0}.fpc-pgb:hover{background:#eef0ff}
.fpc-pgb span{display:flex;flex-direction:column;min-width:0}.fpc-pgb b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fpc-pgb small{color:#5b6176;font-size:12px}.fpc-x{border:0;background:none;color:#9aa0b5;cursor:pointer}
.fpc-av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:700;font-size:12px;flex:none}
.fpc-add{margin-top:12px;font-size:14px}.fpc-add summary{cursor:pointer;color:#4b54d1;font-weight:600}.fpc-add input{margin-top:6px}
.fpc-cal{padding:12px;overflow-x:auto}
.fpc-mh{display:grid;grid-template-columns:repeat(7,minmax(110px,1fr));font-size:12px;font-weight:700;color:#5b6176;text-align:center;padding-bottom:6px}
.fpc-mg{display:grid;grid-template-columns:repeat(7,minmax(110px,1fr));gap:6px}
.fpc-cell{min-height:118px;border:1px solid var(--line);border-radius:12px;padding:6px;background:#fff;display:flex;flex-direction:column;gap:4px}.fpc-cell.off{background:transparent;border-color:transparent}.fpc-cell.today{border-color:#4b54d1;box-shadow:0 0 0 1px #4b54d1 inset}.drop{background:#eef0ff!important}
.fpc-dn{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;color:#4b5167}.fpc-plus{opacity:0;border:0;background:#eef0ff;color:#4b54d1;border-radius:6px;width:22px;height:22px;cursor:pointer;font-weight:700}.fpc-cell:hover .fpc-plus,.fpc-slot:hover .fpc-plus{opacity:1}
.fpc-chip{display:flex;align-items:center;gap:6px;border-left:3px solid;border-radius:8px;padding:3px 6px;font-size:12px;cursor:pointer;min-width:0}.fpc-chip:hover{filter:brightness(.97)}.fpc-ct{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fpc-more{font-size:12px;color:#4b54d1;cursor:pointer;font-weight:600}
.fpc-wg{display:grid;grid-template-columns:54px repeat(7,minmax(120px,1fr));gap:0;font-size:13px}
.fpc-wh{text-align:center;padding:6px 0;font-weight:600;color:#4b5167;position:sticky;top:0;background:#fff}.fpc-wh b{display:block;font-size:18px}.fpc-wh.today b{color:#4b54d1}.fpc-wh.off{opacity:.35}
.fpc-hr{font-size:11px;color:#8a90a6;text-align:right;padding:4px 8px 0 0;border-top:1px solid var(--line);height:50px}
.fpc-slot{border-top:1px solid var(--line);border-left:1px solid var(--line);height:50px;padding:2px;display:flex;flex-direction:column;gap:2px;overflow:hidden}.fpc-slot.off{background:#fafafa}
.fpc-md{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:20px}.fpc-mf{display:flex;flex-direction:column;gap:10px}.fpc-mf label{font-size:13px;color:#4b5167;display:flex;flex-direction:column;gap:4px}
.fpc-lab{font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#5b6176}.fpc-row{display:flex;gap:10px}.fpc-row label{flex:1}.fpc-row .g{flex:2}
.fpc-pick{display:flex;gap:8px;flex-wrap:wrap}.fpc-pk{display:flex;flex-direction:column;align-items:center;gap:4px;border:2px solid transparent;border-radius:12px;background:#f6f7fb;padding:8px 10px;cursor:pointer;max-width:96px}.fpc-pk.on{border-color:#4b54d1;background:#eef0ff}.fpc-pk small{font-size:11px;text-align:center;line-height:1.2}
.fpc-err{color:#b42318;font-weight:600;margin:0}.fpc-mfoot{display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:12px;border-top:1px solid var(--line);flex-wrap:wrap}
.fpc-fb{border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px;font-size:14px}.fpc-fbh{display:flex;gap:10px;align-items:center;margin-bottom:8px}.fpc-fbh small{display:block;color:#65676b;font-size:12px}
.fpc-fbt{margin-bottom:8px;word-break:break-word}.fpc-fb img{width:100%;border-radius:8px;margin-bottom:8px}.fpc-vid{background:#111;color:#fff;text-align:center;padding:40px 0;border-radius:8px;margin-bottom:8px}
.fpc-lk{background:#f0f2f5;border-radius:8px;padding:8px 10px;font-size:12px;color:#65676b;margin-bottom:8px}.fpc-fbf{border-top:1px solid var(--line);padding-top:8px;color:#65676b;font-size:13px}
@media(max-width:900px){.fpc-body{grid-template-columns:1fr}.fpc-rail{border-right:0;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:6px;align-items:center}.fpc-md{grid-template-columns:1fr}}
</style>`;
const fpcOrig=pFanpageLich;
pFanpageLich=function(m,chs){
  fpcOrig(m,chs);
  if(!FPC.st&&!FPC.loading&&!FPC.err)fpcLoad();
  fpcInit();
  const box=document.createElement("div");
  box.innerHTML=`${fpcStyle}<section class="fpc">${fpcBar()}<div class="fpc-body">${fpcRail()}<div class="fpc-cal">${FPC.view==="week"?fpcWeekView():fpcMonth()}</div></div></section>`;
  m.insertBefore(box,m.firstChild);
  fpcBind(m)
};
