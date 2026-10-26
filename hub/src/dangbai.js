/* =====================================================================
   FANPAGE: LỊCH ĐĂNG BÀI KIỂU POSTIZ (đặt trên đầu trang ② Lịch đăng chi tiết của kênh Fanpage)
   Cấu trúc theo Postiz: thanh công cụ (Tuần / Tháng, điều hướng ngày, công tắc đăng tự động, Tạo bài)
   · cột Kênh (các page) bên trái · lịch ở giữa, bài là thẻ nhỏ, kéo thả để đổi ngày giờ
   · bấm ô trống hoặc thẻ bài mở cửa sổ soạn bài: chọn page, nội dung, ảnh/video, ngày giờ + xem trước giống Facebook.
   Quy tắc: máy chỉ đăng bài ở trạng thái "Đã duyệt". Agent Fanpage trên VPS giữ mã page, mỗi giờ hỏi /api/fp/due
   để lấy bài tới giờ, đăng rồi báo /api/fp/done. Bài là thẻ video kênh Fanpage (d.cards), không có kho dữ liệu riêng.
   ===================================================================== */
const FPC={view:"month",y:0,m:0,anchor:"",sel:new Set(),dd:false,st:null,err:"",loading:false,ed:null,drag:""};
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
function fpcPosts(){const d=D();return d.cards.filter(c=>c.kenh===BV.k&&fpcDate(c)&&(!FPC.sel.size||!c.pageId||FPC.sel.has(c.pageId)))}
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
function fpcPicker(){
  const ceo=isCeo(),pages=fpcPages(),n=FPC.sel.size,lab=!pages.length?"Kênh: chưa có page":n?(n===1?"Kênh: "+esc((fpcPage([...FPC.sel][0])||{name:"1 page"}).name.slice(0,22)):"Kênh: "+n+" page"):"Kênh: tất cả ("+pages.length+")";
  const av=n?pages.filter(p=>FPC.sel.has(p.page_id)).slice(0,4).map(p=>fpcAv(p,22)).join(""):"";
  return `<div class="fpc-dd"><button type="button" class="fpc-ddb" data-fpcdd="1">${av}<span>${lab}</span> ▾</button>
   ${FPC.dd?`<div class="fpc-pop"><input type="search" id="fpc-q" placeholder="Tìm page…" autocomplete="off"><div class="fpc-popa"><button type="button" class="lnk" data-fpcall="1">Chọn tất cả</button><button type="button" class="lnk" data-fpcnone="1">Bỏ chọn (xem tất cả)</button></div>
    <div class="fpc-pl">${pages.map(p=>`<div class="fpc-pr" data-fpcname="${esc(fpFold(p.name))}"><label>${'<input type="checkbox" data-fpcpg="'+esc(p.page_id)+'"'+(FPC.sel.has(p.page_id)?" checked":"")+' style="width:auto">'}${fpcAv(p,24)}<span>${esc(p.name)}</span>${p.is_test?'<em class="fpc-tag">thử</em>':""}</label>${ceo?`<button type="button" class="lnk" data-fpctest="${esc(p.page_id)}" title="Đổi giữa page thử và page thật">${p.is_test?"bỏ thử":"đặt là thử"}</button><button type="button" class="fpc-x" data-fpcpdel="${esc(p.page_id)}" title="Ngắt page">✕</button>`:""}</div>`).join("")||`<p class="hint">Chưa có page.</p>`}</div>
    ${ceo?`<details class="fpc-add"><summary>+ Thêm page</summary><input id="fpc-pid" placeholder="Mã page (dãy số)"><input id="fpc-nm" placeholder="Tên page"><label><input type="checkbox" id="fpc-test" style="width:auto"> Page thử</label><button type="button" class="btn sm pri" data-fpcaddpg="1">Thêm</button></details>`:""}</div>`:""}</div>`}
function fpcBar(){
  const st=FPC.st,mode=st?st.mode:"off",ceo=isCeo(),mv=FPC.view==="month",
   label=mv?`Tháng ${FPC.m}/${FPC.y}`:(()=>{const W=fpcWeek(FPC.anchor);return `${fpcDM(W[0].ds)} – ${fpcDM(W[6].ds)}/${W[6].ds.slice(0,4)}`})();
  return `<div class="fpc-bar"><div class="fpc-seg"><button type="button" class="${FPC.view==="week"?"on":""}" data-fpcv="week">Tuần</button><button type="button" class="${mv?"on":""}" data-fpcv="month">Tháng</button></div>
   <button type="button" class="fpc-nav" data-fpcnav="-1">‹</button><b class="fpc-lb">${label}</b><button type="button" class="fpc-nav" data-fpcnav="1">›</button><button type="button" class="fpc-nav" data-fpcnav="0">Hôm nay</button>
   ${fpcPicker()}<span class="sp"></span>
   ${st?`<select data-fpcmode="1" ${ceo?"":"disabled"} class="fpc-mode m-${mode}">${opt([["off","Đăng tự động: Tắt"],["test","Đăng tự động: chỉ page thử"],["on","Đăng tự động: Bật"]],mode)}</select><button type="button" class="fpc-stop" data-fpcstop="1" ${ceo?"":"disabled"}>DỪNG KHẨN</button>`:`<span class="hint">${esc(FPC.err||"Đang tải…")}</span>`}
   <button type="button" class="btn" data-fchopen="1" title="Mở cửa sổ chat với agent Lead Content: nhờ lên lịch, viết bài, chọn video">Chat với agent${fchBadge()}</button>
   <button type="button" class="btn pri" data-fpcnew="${mv&&!(FPC.y+"-"+fpcPad(FPC.m)===fpcToday().slice(0,7))?fpcIso(FPC.y,FPC.m,1):fpcToday()}">+ Tạo bài</button></div>`}
function fpcPreview(e){
  const p=fpcPage(e.pageId),media=e.media&&e.fmt==="Ảnh"?`<img src="${esc(e.media)}" alt="" onerror="this.style.display='none'">`:e.media&&e.fmt==="Video"?`<div class="fpc-vid">▶ Video</div>`:"";
  return `<div class="fpc-fb"><div class="fpc-fbh">${p?fpcAv(p,38):`<span class="fpc-av" style="width:38px;height:38px;background:#cbd5e1">?</span>`}<div><b>${esc(p?p.name:"Chọn page")}</b><small>Bây giờ · 🌐</small></div></div>
   <div class="fpc-fbt">${e.text?esc(e.text).replace(/\n/g,"<br>"):`<span class="hint">Nội dung bài sẽ hiện ở đây…</span>`}</div>${media}${e.link?`<div class="fpc-lk">${esc(e.link.replace(/^https?:\/\//,"").slice(0,60))}</div>`:""}
   <div class="fpc-fbf">👍 Thích &nbsp; 💬 Bình luận &nbsp; ↗ Chia sẻ</div></div>`}
function fpcModal(){
  const e=FPC.ed;if(!e)return;const pages=fpcPages(),ro=e.st==="xong",boss=fpcBoss();
  crmModal(e.id?"Sửa bài":"Tạo bài mới",`<div class="fpc-md"><div class="fpc-mf">
    ${e.st==="xong"?`<div class="fpc-done"><b>Bài đã đăng</b>${e.linkDang?` · <a href="${esc(e.linkDang)}" target="_blank" rel="noopener">Xem bài trên Facebook</a>`:` · <span class="hint">chưa có link bài</span>`}${(e.cm||[]).length?`<div class="hint" style="margin-top:4px">Bình luận đã đăng (${e.cm.length}):</div>`+e.cm.map(x=>`<div class="fpc-cmd">${esc(x.text||"")}${x.image?` <a href="${esc(x.image)}" target="_blank" rel="noopener">ảnh</a>`:""}</div>`).join(""):""}</div>`:""}
    <div class="fpc-lab">Đăng lên page</div><select id="fpc-pgsel" ${ro?"disabled":""}>${opt([["","— chọn page —"]].concat(pages.map(p=>[p.page_id,p.name+(p.is_test?" (page thử)":"")])),e.pageId)}</select>
    <div class="fpc-lab">Nội dung</div><textarea id="fpc-tx" rows="8" placeholder="Viết nội dung bài…" ${ro?"disabled":""}>${esc(e.text)}</textarea>
    <div class="fpc-row"><label>Dạng bài<select id="fpc-fmt" ${ro?"disabled":""}>${opt([["","Chỉ chữ"],["Ảnh","Ảnh"],["Video","Video"]],e.fmt)}</select></label>
     <label class="g">Link ảnh / video (link tải trực tiếp)<input id="fpc-md" value="${esc(e.media)}" placeholder="https://…" ${ro?"disabled":""}></label></div>
    <label>Link trang bán (đính kèm bài chữ)<input id="fpc-lk" value="${esc(e.link)}" placeholder="https://…" ${ro?"disabled":""}></label>
    <label>Bình luận đầu (agent đăng ngay sau bài, thường kèm link bán hàng)<textarea id="fpc-cm" rows="2" ${ro?"disabled":""}>${esc(e.comment)}</textarea></label>
    <label>Ảnh trong bình luận (link ảnh, tùy chọn)<input id="fpc-ci" value="${esc(e.commentImg)}" placeholder="https://…" ${ro?"disabled":""}></label>
    ${e.fmt==="Video"&&!ro?`<label>Lấy video từ kho<select id="fpc-vid"><option value="">Chọn video trong kho…</option>${D().cards.filter(c=>c.kenh!==BV.k&&(c.linkFinal||c.linkVideo)).slice(0,200).map(v=>`<option value="${esc(v.id)}">${esc((v.hookText||v.chuDe||v.id).slice(0,60))}</option>`).join("")}</select></label>`:""}
    <div class="fpc-row"><label>Ngày<input type="date" id="fpc-dy" value="${esc(e.date)}" ${ro?"disabled":""}></label>
     <label>Giờ<select id="fpc-gio" ${ro?"disabled":""}>${opt([["","— giờ —"]].concat(FPC_HOURS.map(h=>[fpcPad(h),fpcPad(h)+" giờ"])),(e.gio||"").slice(0,2))}</select></label>
     <label>Phút<select id="fpc-ph" ${ro?"disabled":""}>${opt(["00","15","30","45"].map(x=>[x,x]),(e.gio||"").slice(3,5)||"00")}</select></label></div>
    ${e.err?`<p class="fpc-err">${esc(e.err)}</p>`:""}
   </div><div class="fpc-mp"><div class="fpc-lab">Xem trước</div><div id="fpc-pv">${fpcPreview(e)}</div></div></div>
   <div class="fpc-mfoot"><span class="pill" style="background:${FPC_ST[e.st][2]};color:${FPC_ST[e.st][1]}">${FPC_ST[e.st][0]}</span><span class="sp"></span>
    ${e.id&&!ro?`<button type="button" class="lnk danger" data-fpcdo="del">Xóa</button>`:""}${e.id&&!ro&&boss?`<button type="button" class="lnk" data-fpcdo="posted" title="Bài đã được đăng lên Facebook ngoài lịch (ví dụ nhờ agent đăng trong chat): dán link để lịch khớp">Đánh dấu đã đăng</button>`:""}${ro?"":`<button type="button" class="btn" data-fpcdo="nhap">Lưu nháp</button><button type="button" class="btn" data-fpcdo="cho">Gửi duyệt</button><button type="button" class="btn pri" data-fpcdo="lich" ${boss?"":"disabled title=\"Chỉ người duyệt\""}>Duyệt &amp; lên lịch</button>`}</div>`,true);
  const sync=()=>{const g=id=>document.getElementById(id);e.text=g("fpc-tx").value;e.fmt=g("fpc-fmt").value;e.media=fpcDirect(g("fpc-md").value);e.link=g("fpc-lk").value.trim();e.comment=g("fpc-cm").value;e.commentImg=fpcDirect(g("fpc-ci").value);e.date=g("fpc-dy").value;e.gio=g("fpc-gio").value?g("fpc-gio").value+":"+g("fpc-ph").value:"";g("fpc-pv").innerHTML=fpcPreview(e)};
  ["fpc-tx","fpc-md","fpc-lk","fpc-cm","fpc-ci","fpc-dy","fpc-gio","fpc-ph"].forEach(i=>{const el=document.getElementById(i);if(el)el.oninput=el.onchange=sync});
  const fm=document.getElementById("fpc-fmt");if(fm)fm.onchange=()=>{sync();fpcModal()};
  const vd=document.getElementById("fpc-vid");if(vd)vd.onchange=()=>{const v=D().cards.find(x=>x.id===vd.value);if(v){e.media=fpcDirect(v.linkFinal||v.linkVideo);fpcModal()}};
  const ps=document.getElementById("fpc-pgsel");if(ps)ps.onchange=()=>{sync();e.pageId=ps.value;fpcModal()};
  document.querySelectorAll("[data-fpcdo]").forEach(b=>b.onclick=()=>{sync();fpcSave(b.dataset.fpcdo)})}
function fpcOpen(id,date,gio){
  const c=id?D().cards.find(x=>x.id===id):null;
  FPC.ed=c?{id:c.id,st:fpcStOf(c),pageId:c.pageId||"",text:c.noiDung||c.hookText||"",fmt:c.mediaUrl?(/video/i.test(c.dangVideo||"")?"Video":"Ảnh"):"",media:c.mediaUrl||"",link:c.linkLanding||"",comment:c.firstComment||"",commentImg:c.firstCommentImg||"",linkDang:c.linkDang||"",cm:c.cmDaDang||[],date:fpcDate(c)||fpcToday(),gio:c.gio||"",err:c.fbLoi||""}
   :{id:"",st:"nhap",pageId:FPC.sel.size===1?[...FPC.sel][0]:"",text:"",fmt:"",media:"",link:"",comment:"",commentImg:"",linkDang:"",cm:[],date:date||fpcToday(),gio:gio?fpcPad(gio)+":00":"",err:""};
  fpcModal()}
function fpcSave(to){
  const e=FPC.ed,k=BV.k;
  if(to==="posted"){const u=(prompt("Dán link bài đã đăng trên Facebook (để trống nếu chưa có):")||"").trim();if(u&&!/^https:\/\//.test(u)){e.err="Link phải bắt đầu bằng https://";return fpcModal()}
    DB.mutate(ME.name,"Fanpage: đánh dấu đã đăng "+e.id,dt=>{const c=dt.cards.find(x=>x.id===e.id);if(!c)return;c.noiDung=e.text||c.noiDung;c.step="xong";c.fbState="ok";c.fbPostId=c.fbPostId||"tay";c.dangLuc=new Date().toISOString();if(u)c.linkDang=u;c.ngayDang=dt.settings.today;c.history=(c.history||[]).concat({t:new Date().toLocaleString("vi-VN"),who:ME.name,to:"xong"})});
    closeCM();FPC.ed=null;toast("Đã đánh dấu đã đăng");renderMain();return}
  if(to==="del"){if(!confirm("Xóa bài này khỏi lịch?"))return;DB.mutate(ME.name,"Fanpage: xóa bài "+e.id,dt=>{dt.cards=dt.cards.filter(c=>c.id!==e.id)});closeCM();FPC.ed=null;renderMain();return}
  if(!e.text.trim()&&!e.media){e.err="Bài chưa có nội dung";return fpcModal()}
  if(to==="lich"){if(!fpcBoss()){e.err="Chỉ người duyệt mới được duyệt";return fpcModal()}
    if(!e.pageId||!e.gio||!e.date){e.err="Chọn page, ngày và giờ trước khi duyệt & lên lịch";return fpcModal()}}
  const step={nhap:"kb",cho:"dvd",lich:"dang"}[to];
  DB.mutate(ME.name,"Fanpage: "+(e.id?"sửa":"tạo")+" bài ("+to+")",dt=>{
    let c=e.id&&dt.cards.find(x=>x.id===e.id);if(!c){c=fpNewPost(dt,k,"");dt.cards.push(c)}
    c.noiDung=e.text;c.hookText=(e.text.split("\n")[0]||"").slice(0,90);c.pageId=e.pageId;c.pdate=e.date;c.day=+e.date.slice(8);c.gio=e.gio;c.mediaUrl=e.media;c.linkLanding=e.link;c.firstComment=e.comment;c.firstCommentImg=e.commentImg;c.dangVideo=e.fmt||"Ảnh";
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
  m.querySelectorAll("[data-fpcdd]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();FPC.dd=!FPC.dd;renderMain()});
  m.querySelectorAll("[data-fpcpg]").forEach(c=>c.onchange=()=>{const id=c.dataset.fpcpg;c.checked?FPC.sel.add(id):FPC.sel.delete(id);FPC.keepOpen=1;renderMain()});
  m.querySelectorAll("[data-fpcall]").forEach(b=>b.onclick=()=>{fpcPages().forEach(p=>FPC.sel.add(p.page_id));renderMain()});
  m.querySelectorAll("[data-fpcnone]").forEach(b=>b.onclick=()=>{FPC.sel.clear();renderMain()});
  m.querySelectorAll("[data-fpctest]").forEach(b=>b.onclick=async()=>{const p=fpcPage(b.dataset.fpctest);if(!p)return;await fpcApi("/pages","POST",{page_id:p.page_id,name:p.name,is_test:!p.is_test});toast(p.is_test?"Đã bỏ nhãn page thử":"Đã đặt làm page thử")});
  const q=m.querySelector("#fpc-q");if(q){q.oninput=()=>{const t=fpFold(q.value);m.querySelectorAll("[data-fpcname]").forEach(r=>r.style.display=!t||r.dataset.fpcname.includes(t)?"":"none")};q.focus()}
  const pop=m.querySelector(".fpc-pop");if(pop)pop.onclick=ev=>ev.stopPropagation();
  m.querySelectorAll("[data-fpcpdel]").forEach(b=>b.onclick=async()=>{if(!confirm("Ngắt page này? Bài đã chọn page này sẽ không đăng được."))return;await fpcApi("/pages/"+encodeURIComponent(b.dataset.fpcpdel),"DELETE")});
  m.querySelectorAll("[data-fpcaddpg]").forEach(b=>b.onclick=async()=>{const pid=$("#fpc-pid").value.trim(),nm=$("#fpc-nm").value.trim();if(!pid||!nm){toast("Cần ghi cả mã page và tên page");return}
    const r=await fpcApi("/pages","POST",{page_id:pid,name:nm,is_test:$("#fpc-test").checked});if(r)toast("Đã thêm page "+r.name)});
  m.querySelectorAll("[data-fpcmode]").forEach(s=>s.onchange=async()=>{const v=s.value;if(v==="on"&&!confirm("Bật đăng cả page thật? Bài đã duyệt tới giờ sẽ được đăng thật."))return renderMain();await fpcApi("/mode","POST",{mode:v});toast("Đã đổi công tắc")});
  m.querySelectorAll("[data-fchopen]").forEach(b=>b.onclick=()=>fchToggle(true));
  m.querySelectorAll("[data-fpcb]").forEach(i=>i.onchange=()=>{const f=i.dataset.fpcb,v=i.value;DB.mutate(ME.name,"Fanpage: sửa yêu cầu chung của tháng",dt=>{dt.fpBrief=Object.assign({mucTieu:"",giong:"",spDay:"",luuY:""},dt.fpBrief||{});dt.fpBrief[f]=v});toast("Đã lưu yêu cầu chung")});
  m.querySelectorAll("[data-fpclt]").forEach(b=>b.onclick=()=>{FPC.ls=b.dataset.fpclt;FPC.lsUser=true;FPC.pick.clear();renderMain()});
  m.querySelectorAll("[data-fpclp]").forEach(c=>c.onchange=()=>{c.checked?FPC.pick.add(c.dataset.fpclp):FPC.pick.delete(c.dataset.fpclp);renderMain()});
  m.querySelectorAll("[data-fpclall]").forEach(c=>c.onchange=()=>{const ids=fpcInRange().filter(r=>fpcStOf(r)==="cho").map(r=>r.id);c.checked?ids.forEach(i=>FPC.pick.add(i)):FPC.pick.clear();renderMain()});
  m.querySelectorAll("[data-fpclr]").forEach(r=>r.onclick=ev=>{if(ev.target.closest("input"))return;fpcOpen(r.dataset.fpclr)});
  m.querySelectorAll("[data-fpclok]").forEach(b=>b.onclick=()=>{
    const ids=[...FPC.pick],cards=D().cards.filter(c=>ids.includes(c.id)),ok=cards.filter(c=>c.pageId&&c.gio&&fpcDate(c)&&(c.noiDung||c.mediaUrl)),bad=cards.length-ok.length;
    if(!ok.length){toast("Các bài đã chọn còn thiếu page, ngày giờ hoặc nội dung. Mở từng bài để bổ sung");return}
    if(!confirm("Duyệt "+ok.length+" bài?"+(bad?" ("+bad+" bài thiếu page/giờ/nội dung sẽ bỏ qua.)":"")+" Bài đã duyệt sẽ được agent đăng khi tới giờ, theo công tắc đang bật."))return;
    const set=new Set(ok.map(c=>c.id));
    DB.mutate(ME.name,"Fanpage: duyệt "+ok.length+" bài",dt=>{dt.cards.forEach(c=>{if(!set.has(c.id))return;c.step="dang";c.history=(c.history||[]).concat({t:new Date().toLocaleString("vi-VN"),who:ME.name,to:"dang"})})});
    FPC.pick.clear();toast("Đã duyệt "+ok.length+" bài");renderMain()});
  m.querySelectorAll("[data-fpcagt]").forEach(b=>b.onclick=()=>{FPC.at.open=!FPC.at.open;renderMain()});
  const agt=m.querySelector("#fpc-agt");if(agt)agt.oninput=()=>{FPC.at.text=agt.value};
  m.querySelectorAll("[data-fpcagq]").forEach(b=>b.onclick=()=>{FPC.at.text=b.dataset.fpcagq+(FPC.at.text&&!FPC.at.text.startsWith(b.dataset.fpcagq)?". "+FPC.at.text:"");renderMain()});
  m.querySelectorAll("[data-fpcago]").forEach(b=>b.onclick=async()=>{const t=(FPC.at.text||"").trim();if(t.length<6){toast("Chị ghi rõ hơn việc cần agent làm");return}
    if(!fpcPages().length){toast("Chưa có page nào. Thêm page ở ô Kênh trước");return}
    FPC.at.busy=true;renderMain();
    try{await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"fp_plan",ref:BV.k,payload:fpcAtPayload(t)})});FPC.at.text="";toast("Đã giao cho agent. Bài sẽ hiện ở lịch (Chờ duyệt) sau vài phút");FPC.at.busy=false;await fpcAtLoad();renderMain()}
    catch(e){FPC.at.busy=false;toast("Không giao được: "+(e&&e.message||e));renderMain()}});
  m.querySelectorAll("[data-fpcstop]").forEach(b=>b.onclick=async()=>{await fpcApi("/mode","POST",{mode:"off"});toast("Đã DỪNG: agent không đăng thêm bài nào")})}
const fpcStyle=`<style>
.fpc{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);margin-bottom:16px;overflow:hidden}
.fpc-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--line)}.fpc-bar .sp,.fpc-mfoot .sp{flex:1}
.fpc-seg{display:inline-flex;background:#f1f2f9;border-radius:10px;padding:3px}.fpc-seg button{border:0;background:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-weight:600;color:#4b5167}.fpc-seg .on{background:#fff;color:#4b54d1;box-shadow:0 1px 3px rgba(30,35,80,.15)}
.fpc-nav{border:1px solid var(--line);background:#fff;border-radius:8px;padding:5px 11px;cursor:pointer}.fpc-lb{font-size:16px;min-width:120px;text-align:center}
.fpc-mode{width:auto;font-weight:600}.fpc-mode.m-on{border-color:#087a55;color:#087a55}.fpc-mode.m-test{border-color:#4b54d1;color:#4b54d1}.fpc-mode.m-off{color:#b45309;border-color:#f2c48a}
.fpc-stop{border:0;background:#dc2626;color:#fff;font-weight:700;border-radius:10px;padding:8px 14px;cursor:pointer}.fpc-stop:disabled{opacity:.4;cursor:default}
.fpc-dd{position:relative}.fpc-ddb{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:#fff;border-radius:10px;padding:7px 12px;cursor:pointer;font-weight:600}.fpc-ddb .fpc-av{margin-right:-10px;border:2px solid #fff}
.fpc-pop{position:absolute;top:calc(100% + 6px);left:0;z-index:20;width:360px;max-width:90vw;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 32px rgba(30,35,80,.18);padding:12px}.fpc-popa{display:flex;justify-content:space-between;margin:8px 2px}
.fpc-pl{max-height:320px;overflow:auto}.fpc-pr{display:flex;align-items:center;gap:6px;padding:4px 2px;border-radius:8px}.fpc-pr:hover{background:#f3f4fb}.fpc-pr label{flex:1;display:flex;align-items:center;gap:8px;min-width:0;cursor:pointer;font-size:14px;color:var(--ink)}.fpc-pr label span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fpc-tag{font-style:normal;font-size:11px;background:#eef0ff;color:#4b54d1;border-radius:6px;padding:1px 6px}.fpc-pr .lnk{font-size:12px;white-space:nowrap}
.fpc-body{display:block}
.fpc-done{background:#e8f8f0;border:1px solid #bfe6d2;border-radius:10px;padding:8px 12px;font-size:13px}.fpc-cmd{margin-top:4px;padding-left:8px;border-left:3px solid #bfe6d2}
.fpc-list{margin-top:16px}.fpc-lt{display:flex;gap:6px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--line)}.fpc-lt button{border:0;background:#f1f2f9;border-radius:99px;padding:5px 14px;cursor:pointer;font-weight:600;color:#4b5167}.fpc-lt button span{font-weight:700;margin-left:4px}.fpc-lt .on{background:#4b54d1;color:#fff}
.fpc-tb tr[data-fpclr]{cursor:pointer}.fpc-tb tr[data-fpclr]:hover{background:#f6f7fd}.fpc-tc{max-width:340px}.fpc-all{font-size:13px;display:flex;gap:6px;align-items:center}
.fpc-bd{margin:6px 0;font-size:13px}.fpc-bd summary{cursor:pointer;color:#4b54d1;font-weight:600}.fpc-brief{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:8px}.fpc-brief label{font-size:12px;color:#5b6176;display:flex;flex-direction:column;gap:3px}@media(max-width:800px){.fpc-brief{grid-template-columns:1fr}}
.fpc-ag{padding:12px 16px;border-bottom:1px solid var(--line);background:#fbfbff}.fpc-agh{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:6px}.fpc-agh .hint{flex:1;min-width:200px;margin:0}
.fpc-ag textarea{width:100%}.fpc-agr{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}.fpc-agr .sp{flex:1}
.fpc-chipb{border:1px solid var(--line);background:#fff;border-radius:99px;padding:4px 12px;cursor:pointer;font-size:13px}.fpc-chipb:hover{background:#eef0ff}
.fpc-agl{margin-top:10px;display:flex;flex-direction:column;gap:6px}.fpc-agi{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px}.fpc-agt{flex:1;min-width:160px;color:var(--ink)}
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
/* ---------- Giao việc cho agent: chị gõ yêu cầu, agent tự viết bài, chọn video, đặt lịch; bài hiện ở lịch trạng thái Chờ duyệt ---------- */
FPC.at={text:"",busy:false,open:true,tasks:[],seen:{}};
const FPC_QUICK=["Lên lịch tuần này","Lên lịch tuần sau","Lên lịch cả tháng này"];
function fpcAtState(t){
  const r=t.result||{};
  if(t.status==="queued")return `<span class="pill p-amb">Đã giao, chờ agent nhận</span>`;
  if(t.status==="error")return `<span class="pill p-red" title="${esc(t.detail||"")}">Lỗi: ${esc((t.detail||"agent báo lỗi").slice(0,80))}</span>`;
  if(t.status==="done")return `<span class="pill p-grn">Xong${r.created!=null?": tạo "+(+r.created)+" bài":""}</span>${t.detail?` <small>${esc(String(t.detail).slice(0,100))}</small>`:""}`;
  return `<span class="pill p-blu">Agent đang làm${t.detail?": "+esc(String(t.detail).slice(0,60)):""}</span>`}
function fpcAgentBox(){
  if(!xvGive())return "";
  const A=FPC.at,L=A.tasks.slice(0,4);
  return `<div class="fpc-ag"><div class="fpc-agh"><b>Giao việc cho agent</b><span class="hint">Chị nói như nhờ người: agent tự viết bài, tạo ảnh, chọn video, đặt lịch. Bài hiện trên lịch ở <b>Chờ duyệt</b>, chị duyệt rồi mới đăng.</span><button type="button" class="lnk" data-fpcagt="1">${A.open?"Thu gọn":"Mở"}</button></div>
   ${A.open?`<details class="fpc-bd"><summary>Yêu cầu chung của tháng (agent đọc cùng mỗi lần giao việc)</summary>${fpcBriefHtml()}</details>`:""}
   ${A.open?`<textarea id="fpc-agt" rows="3" placeholder="VD: Lên lịch tuần này cho page Tẩy Lồng Giặt, mỗi ngày 2 bài (9:00 và 20:00), đẩy bột tẩy vạn năng, có 2 video lấy từ kho, bình luận đầu kèm link bán hàng.">${esc(A.text)}</textarea>
   <div class="fpc-agr">${FPC_QUICK.map(q=>`<button type="button" class="fpc-chipb" data-fpcagq="${esc(q)}">${esc(q)}</button>`).join("")}<span class="sp"></span><span class="hint">Page: ${FPC.sel.size?FPC.sel.size+" page đã chọn ở ô Kênh":"agent tự chọn trong tất cả page (nên chọn ở ô Kênh cho gọn)"}</span><button type="button" class="btn pri" data-fpcago="1" ${A.busy?"disabled":""}>${A.busy?"Đang giao…":"Giao cho agent"}</button></div>`:""}
   ${L.length?`<div class="fpc-agl">${L.map(t=>`<div class="fpc-agi"><span class="fpc-agt">${esc(String((t.payload||{}).yeuCau||"").slice(0,90))}</span>${fpcAtState(t)}<small>${esc(new Date(t.created_at).toLocaleString("vi-VN"))}</small></div>`).join("")}</div>`:""}</div>`}
async function fpcAtLoad(){
  try{const L=(await svApi("/api/hub/worker-tasks?kind=fp"))||[],mine=L.filter(t=>t.kind==="fp_plan").sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    let fin=false;mine.forEach(t=>{const k=t.id+":"+t.status;if(FPC.at.seen[t.id]&&FPC.at.seen[t.id]!==k&&t.status==="done")fin=true;FPC.at.seen[t.id]=k});
    const same=JSON.stringify(mine.slice(0,4).map(t=>[t.id,t.status,t.detail]))===JSON.stringify(FPC.at.tasks.slice(0,4).map(t=>[t.id,t.status,t.detail]));
    FPC.at.tasks=mine;if(fin&&typeof svPoll==="function"){await svPoll()}
    if(!same||fin){const ae=document.activeElement;if(!(ae&&ae.id==="fpc-agt"))renderMain()}
  }catch(e){}}
function fpcAtPayload(text){
  const d=D(),pages=fpcPages(),chosen=FPC.sel.size?pages.filter(p=>FPC.sel.has(p.page_id)):pages;
  const from=FPC.view==="week"?fpcWeek(FPC.anchor)[0].ds:fpcIso(FPC.y,FPC.m,1),to=FPC.view==="week"?fpcWeek(FPC.anchor)[6].ds:fpcIso(FPC.y,FPC.m,new Date(FPC.y,FPC.m,0).getDate());
  return {yeuCau:text,hienTai:fpcToday(),khungXem:{tu:from,den:to},
   pages:chosen.map(p=>({page_id:p.page_id,ten:p.name,laPageThu:!!p.is_test})),chonRieng:!!FPC.sel.size,
   brief:d.fpBrief||{},tuyen:(d.fpPlan||[]).map(r=>({ten:r.tuyen,mucTieu:r.mucTieu,soBai:r.sl,dang:r.dang})),
   sanPham:(d.catalog||[]).filter(p=>p&&p.n).slice(0,60).map(p=>({ten:p.n,gia:p.gia||"",mo:p.mo||"",pain:p.pain||"",claim:p.claim||""})),
   khoVideo:d.cards.filter(c=>c.kenh!==BV.k&&(c.linkFinal||c.linkVideo)&&["xong","dang"].includes(c.step)).slice(0,80).map(c=>({id:c.id,ten:String(c.hookText||c.chuDe||c.id).slice(0,70),sku:c.sku||"",link:c.linkFinal||c.linkVideo})),
   daCoTrenLich:d.cards.filter(c=>c.kenh===BV.k&&fpcDate(c)&&fpcDate(c)>=from&&fpcDate(c)<=to).slice(0,150).map(c=>({page_id:c.pageId||"",ngay:fpcDate(c),gio:c.gio||"",noiDung:String(c.noiDung||c.hookText||"").slice(0,60)})),
   quyTac:["Chỉ tạo bài bằng POST /api/fp/draft; bài luôn vào Chờ duyệt, KHÔNG tự duyệt.","Giờ đăng theo bước 15 phút, ngày từ hôm nay trở đi.","Không bịa số liệu/claim; chỉ dùng claim trong sanPham.","Không trùng bài đã có trên lịch (daCoTrenLich).","Có thể gắn video từ khoVideo (video_card_id + media_url) và bình luận đầu kèm link."]}}
/* ---------- Danh sách bài (theo ô Kênh + khung đang xem), duyệt nhiều bài một lần ---------- */
FPC.ls="cho";FPC.lsUser=false;FPC.pick=new Set();
const FPC_TABS=[["cho","Chờ duyệt"],["lich","Đã lên lịch"],["xong","Đã đăng"],["loi","Lỗi"],["nhap","Nháp"],["all","Tất cả"]];
function fpcRange(){return FPC.view==="week"?[fpcWeek(FPC.anchor)[0].ds,fpcWeek(FPC.anchor)[6].ds]:[fpcIso(FPC.y,FPC.m,1),fpcIso(FPC.y,FPC.m,new Date(FPC.y,FPC.m,0).getDate())]}
function fpcInRange(){const r=fpcRange();return fpcPosts().filter(c=>fpcDate(c)>=r[0]&&fpcDate(c)<=r[1])}
/* Bài đã đăng: hiện giờ đăng thật (kèm giờ hẹn nếu khác); chưa đăng: giờ hẹn */
function fpcVn(iso){try{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(iso)).reduce((o,x)=>(o[x.type]=x.value,o),{});return p.day+"/"+p.month+" "+p.hour+":"+p.minute}catch(e){return ""}}
function fpcWhen(c){
  const plan=fpcDM(fpcDate(c))+(c.gio?" "+c.gio:"");
  if(fpcStOf(c)==="xong"){const real=c.dangLuc?fpcVn(c.dangLuc):"";return real?`<b>${real}</b><br><small class="hint">đăng thật · hẹn ${esc(plan)}</small>`:`${esc(plan)}<br><small class="hint">giờ hẹn, chưa ghi giờ đăng thật</small>`}
  return c.gio?esc(plan):`${esc(plan)} <span class="hint">chưa có giờ</span>`}
function fpcList(){
  const all=fpcInRange(),cnt=k=>k==="all"?all.length:all.filter(c=>fpcStOf(c)===k).length;
  if(!FPC.lsUser)FPC.ls=cnt("cho")>0?"cho":"all";
  const    rows=all.filter(c=>FPC.ls==="all"||fpcStOf(c)===FPC.ls).sort((a,b)=>(fpcDate(a)+(a.gio||"")).localeCompare(fpcDate(b)+(b.gio||""))),
   boss=fpcBoss(),canPick=r=>boss&&fpcStOf(r)==="cho",pk=rows.filter(canPick),n=pk.filter(r=>FPC.pick.has(r.id)).length,
   who=FPC.sel.size===1?(fpcPage([...FPC.sel][0])||{name:""}).name:FPC.sel.size?FPC.sel.size+" page":"tất cả page";
  return `<section class="fpc fpc-list"><div class="fpc-bar"><b>Danh sách bài</b><span class="hint">${esc(who)} · ${FPC.view==="week"?"tuần này":"tháng "+FPC.m+"/"+FPC.y} · ${all.length} bài</span><span class="sp"></span>
   ${boss&&FPC.ls==="cho"&&pk.length?`<label class="fpc-all"><input type="checkbox" data-fpclall="1" style="width:auto" ${n&&n===pk.length?"checked":""}> Chọn tất cả</label><button type="button" class="btn pri" data-fpclok="1" ${n?"":"disabled"}>Duyệt ${n} bài đã chọn</button>`:""}</div>
   <div class="fpc-lt">${FPC_TABS.map(([k,t])=>`<button type="button" class="${FPC.ls===k?"on":""}" data-fpclt="${k}">${t} <span>${cnt(k)}</span></button>`).join("")}</div>
   ${rows.length?`<div class="tbl"><table class="fptab fpc-tb"><thead><tr><th></th><th>Page</th><th>Ngày giờ</th><th>Nội dung</th><th>Bình luận đầu</th><th>Link bài đăng</th><th>Tình trạng</th></tr></thead><tbody>${rows.map(c=>{const p=fpcPage(c.pageId),s=FPC_ST[fpcStOf(c)];
    return `<tr data-fpclr="${esc(c.id)}"><td>${canPick(c)?`<input type="checkbox" data-fpclp="${esc(c.id)}" style="width:auto" ${FPC.pick.has(c.id)?"checked":""}>`:""}</td>
     <td>${p?fpcAv(p,22)+" "+esc(p.name):`<span class="hint">chưa chọn page</span>`}</td><td>${fpcWhen(c)}</td>
     <td class="fpc-tc">${esc((c.noiDung||c.hookText||"").replace(/\s+/g," ").slice(0,90))||'<span class="hint">(trống)</span>'}${c.fbLoi?`<br><small style="color:#b42318">${esc(c.fbLoi.slice(0,80))}</small>`:""}</td>
     <td>${(c.cmDaDang||[]).length?"Đã đăng "+c.cmDaDang.length:c.firstComment?"Có"+(c.firstCommentImg?", kèm ảnh":""):"—"}</td><td>${c.linkDang?`<a href="${esc(c.linkDang)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Xem bài</a>`:"—"}</td><td><span class="pill" style="background:${s[2]};color:${s[1]}">${s[0]}</span></td></tr>`}).join("")}</tbody></table></div>`
   :`<p class="empty pad">${FPC.ls==="cho"?"Không có bài nào chờ duyệt trong khung này.":"Không có bài nào."}${all.length?` Có ${all.length} bài ở thẻ khác, bấm "Tất cả" để xem.`:""}</p>`}</section>`}
function fpcBriefHtml(){
  const B=Object.assign({mucTieu:"",giong:"",spDay:"",luuY:""},D().fpBrief||{});
  return `<div class="fpc-brief"><label>Mục tiêu tháng<textarea rows="2" data-fpcb="mucTieu" placeholder="VD: tăng tương tác, kéo khách về mua trên TikTok Shop">${esc(B.mucTieu)}</textarea></label>
   <label>Giọng văn<textarea rows="2" data-fpcb="giong" placeholder="VD: gần gũi như người nhà, hài nhẹ">${esc(B.giong)}</textarea></label>
   <label>Sản phẩm cần đẩy<textarea rows="2" data-fpcb="spDay" placeholder="VD: Tinh dầu giặt sấy, Bột tẩy vạn năng">${esc(B.spDay)}</textarea></label>
   <label>Lưu ý (điều cấm, ngày sale, nội dung bắt buộc)<textarea rows="2" data-fpcb="luuY" placeholder="VD: không nhắc đối thủ">${esc(B.luuY)}</textarea></label></div>`}
/* ---------- Cửa sổ chat với agent Lead Content (dùng chính cuộc trò chuyện ở Điều hành agent) ----------
   Chị nhờ trong chat, agent làm xong thì bài hiện ở lịch + Danh sách bài (Chờ duyệt) để chị duyệt. */
const FCH={open:false,agent:"",name:"Lead Content",color:"#4b54d1",msgs:[],last:0,busy:false,ready:false,err:"",text:"",timer:0,sending:false};
const FCH_MARK="[Ngữ cảnh lịch Fanpage ABOS";
const FCH_QUICK=["Lên lịch tuần này cho page đang chọn","Lên lịch tuần sau, mỗi ngày 2 bài","Viết lại các bài đang chờ duyệt cho hay hơn","Đề xuất tuyến nội dung cho tháng sau"];
function fchCtx(){
  const r=fpcRange(),pg=FPC.sel.size?fpcPages().filter(p=>FPC.sel.has(p.page_id)).map(p=>p.name+" ("+p.page_id+")").join("; "):"chưa chọn (nếu chị không nói rõ page thì hỏi lại, đừng đoán)";
  return FCH_MARK+" - chỉ để em hiểu, đừng nhắc lại cho chị] Khung đang xem: "+r[0]+" đến "+r[1]+". Page đang chọn: "+pg+". "+fchBrief()+"Quy tắc: tạo/sửa bài lên lịch bằng POST /api/fp/draft (bài vào Chờ duyệt, KHÔNG tự duyệt, KHÔNG đăng); viết bài bằng skill viết bài và kiến thức sản phẩm AILLA của em, không viết chung chung; giờ đăng theo bước 15 phút; xong thì trả lời ngắn ở đây: đã tạo bao nhiêu bài, cho page nào, ngày nào, và nhắc chị vào mục Chờ duyệt trên lịch để duyệt.]"}
function fchBrief(){const B=D().fpBrief||{},t=[["Mục tiêu tháng",B.mucTieu],["Giọng văn",B.giong],["Sản phẩm cần đẩy",B.spDay],["Lưu ý",B.luuY]].filter(x=>x[1]&&String(x[1]).trim()).map(x=>x[0]+": "+String(x[1]).trim()).join("; ");return t?"Yêu cầu chung của tháng: "+t+". ":""}
const fchShow=b=>{const i=String(b||"").indexOf("\n\n"+FCH_MARK);return i>=0?b.slice(0,i):String(b||"")};
function fchPending(){try{return D().cards.filter(c=>c.kenh===BV.k&&fpcStOf(c)==="cho").length}catch(e){return 0}}
function fchBadge(){const n=fchPending();return n?` <span class="fch-n">${n}</span>`:""}
async function fchInit(){
  if(FCH.ready)return;FCH.ready=true;
  try{const r=await svApi("/api/agent-chat/agents"),a=(r.agents||[]).find(x=>/lead content/i.test(x.name||"")||/lead-content/.test(x.id||""));
    if(!a)FCH.err="Chưa thấy agent Lead Content, hoặc chị chưa được cấp quyền nhắn agent (Điều hành agent › Hội thoại).";else{FCH.agent=a.id;FCH.name=a.name||FCH.name;FCH.color=a.color||FCH.color}}
  catch(e){FCH.err=e.message||String(e)}
}
function fchEl(){
  let el=document.getElementById("fch");
  if(!el){el=document.createElement("aside");el.id="fch";el.hidden=true;document.body.appendChild(el);
    const st=document.createElement("style");st.textContent=`#fch{position:fixed;top:0;right:0;bottom:0;width:min(440px,100vw);z-index:9999;background:#fff;border-left:1px solid var(--line);box-shadow:-12px 0 32px rgba(30,35,80,.16);display:flex;flex-direction:column}#fch[hidden]{display:none}
.fch-h{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line)}.fch-h b{flex:1}.fch-x{border:0;background:#f1f2f9;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px}
.fch-go{margin:8px 14px 0;border:1px solid #c9ccf5;background:#eef0ff;color:#3b43b5;border-radius:10px;padding:7px 12px;cursor:pointer;font-weight:600;text-align:left}
.fch-ms{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:#fafbff}.fch-m{max-width:88%;padding:8px 12px;border-radius:14px;font-size:14px;line-height:1.5;word-break:break-word;white-space:pre-wrap}
.fch-m.u{align-self:flex-end;background:#4b54d1;color:#fff;border-bottom-right-radius:4px}.fch-m.a{align-self:flex-start;background:#fff;border:1px solid var(--line);border-bottom-left-radius:4px}.fch-m small{display:block;opacity:.7;font-size:11px;margin-top:2px}
.fch-q{display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px 0}.fch-q button{border:1px solid var(--line);background:#fff;border-radius:99px;padding:4px 10px;cursor:pointer;font-size:12px}
.fch-f{display:flex;gap:8px;padding:10px 14px 14px}.fch-f textarea{flex:1;resize:none}.fch-n{display:inline-block;background:#e7357b;color:#fff;border-radius:99px;padding:0 7px;font-size:12px;margin-left:4px}.fch-e{padding:14px;color:#b42318}`;
    document.head.appendChild(st)}
  return el}
function fchDraw(keep){
  const el=fchEl(),ta=el.querySelector("#fch-t"),had=ta&&document.activeElement===ta,val=ta?ta.value:FCH.text;
  const L=[...FCH.msgs].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))||a.id-b.id).filter(m=>m.role!=="SYSTEM");
  const n=fchPending();
  el.innerHTML=`<div class="fch-h"><span class="fpc-av" style="width:34px;height:34px;background:${esc(FCH.color)}">${esc((FCH.name||"A").charAt(0))}</span><b>${esc(FCH.name)}<br><small style="font-weight:400;color:#5b6176">Nhờ lên lịch, viết bài, chọn video. Bài hiện ở lịch để chị duyệt.</small></b><button type="button" class="fch-x" data-fchx="1" aria-label="Đóng">✕</button></div>
   <button type="button" class="fch-go" data-fchgo="1">Xem bài chờ duyệt${n?" ("+n+")":""} trên lịch →</button>
   <details class="fpc-bd" style="margin:6px 14px 0"><summary>Yêu cầu chung của tháng (agent đọc cùng mỗi lần nhờ)</summary>${fpcBriefHtml()}</details>
   ${FCH.err?`<div class="fch-e">${esc(FCH.err)}</div>`:`<div class="fch-ms" id="fch-ms">${L.length?L.map(m=>{const u=m.role==="USER",b=u?fchShow(String(m.body||"").replace(/^\[KHÁCH\] /,"")):String(m.body||""),st=u?(m.status==="queued"?"đang chờ agent":m.status==="taken"?"agent đang làm…":m.status==="error"?"lỗi":""):"";
      return `<div class="fch-m ${u?"u":"a"}">${u?esc(b):(typeof acFmt==="function"?acFmt(b):esc(b))}${st?`<small>${st}</small>`:""}</div>`}).join(""):`<div class="hint">Chưa có tin nào. Chị nhắn như nhờ người: "Lên lịch tuần này cho page Tẩy Lồng, mỗi ngày 2 bài".</div>`}</div>
   <div class="fch-q">${FCH_QUICK.map(q=>`<button type="button" data-fchq="${esc(q)}">${esc(q)}</button>`).join("")}</div>
   <div class="fch-f"><textarea id="fch-t" rows="2" placeholder="Nhắn agent… (Enter để gửi, Shift+Enter xuống dòng)">${esc(val)}</textarea><button type="button" class="btn pri" data-fchsend="1" ${FCH.sending?"disabled":""}>Gửi</button></div>`}`;
  const ms=el.querySelector("#fch-ms");if(ms&&(keep||true))ms.scrollTop=ms.scrollHeight;
  const t=el.querySelector("#fch-t");if(t){t.oninput=()=>{FCH.text=t.value};t.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();fchSend()}};if(had)t.focus()}
  el.querySelectorAll("[data-fpcb]").forEach(i=>i.onchange=()=>{const f=i.dataset.fpcb,v=i.value;DB.mutate(ME.name,"Fanpage: sửa yêu cầu chung của tháng",dt=>{dt.fpBrief=Object.assign({mucTieu:"",giong:"",spDay:"",luuY:""},dt.fpBrief||{});dt.fpBrief[f]=v});toast("Đã lưu yêu cầu chung")});
  el.querySelector("[data-fchx]").onclick=()=>fchToggle(false);
  el.querySelector("[data-fchgo]").onclick=()=>{FPC.ls="cho";FPC.lsUser=true;FPC.pick.clear();const c=D().cards.filter(x=>x.kenh===BV.k&&fpcStOf(x)==="cho"&&fpcDate(x)).sort((a,b)=>fpcDate(a).localeCompare(fpcDate(b)))[0];
    if(c&&(fpcDate(c)<fpcRange()[0]||fpcDate(c)>fpcRange()[1])){FPC.view="month";FPC.y=+fpcDate(c).slice(0,4);FPC.m=+fpcDate(c).slice(5,7)}
    fchToggle(false);renderMain();setTimeout(()=>{const l=document.querySelector(".fpc-list");if(l)l.scrollIntoView({behavior:"smooth",block:"start"})},150)};
  el.querySelectorAll("[data-fchq]").forEach(b=>b.onclick=()=>{const t2=document.getElementById("fch-t");FCH.text=b.dataset.fchq;if(t2){t2.value=FCH.text;t2.focus();t2.setSelectionRange(t2.value.length,t2.value.length)}});
  el.querySelector("[data-fchsend]").onclick=()=>fchSend()}
async function fchPoll(first){
  if(!FCH.agent||FCH.busy)return;FCH.busy=true;
  try{const r=await svApi("/api/agent-chat?agent="+encodeURIComponent(FCH.agent)+(first?"":"&after="+FCH.last));
    const newAgent=!first&&r.some(x=>x.role==="AGENT");
    if(first)FCH.msgs=r;else FCH.msgs=FCH.msgs.concat(r);
    if(r.length)FCH.last=Math.max(FCH.last,r[r.length-1].id);
    const st=await svApi("/api/agent-chat/status?agent="+encodeURIComponent(FCH.agent)),mp=new Map(st.map(x=>[x.id,x.status]));
    FCH.msgs.forEach(x=>{if(x.role==="USER"&&mp.has(x.id))x.status=mp.get(x.id)});
    const sig=FCH.msgs.map(m=>m.id+":"+m.status).join(",");
    if(first||r.length||sig!==FCH.sig){FCH.sig=sig;fchDraw()}
    if(newAgent&&typeof svPoll==="function"){await svPoll();try{renderMain()}catch(e){}}
  }catch(e){}finally{FCH.busy=false}
}
async function fchSend(){
  const t=(FCH.text||"").trim();if(!t||!FCH.agent||FCH.sending)return;
  FCH.sending=true;const tb=document.getElementById("fch-t");if(tb)tb.value="";fchDraw();
  try{await svApi("/api/agent-chat",{method:"POST",body:JSON.stringify({agent:FCH.agent,body:t+"\n\n"+fchCtx(),tg:false,files:[],docs:[]})});FCH.text="";FCH.sending=false;await fchPoll(false);fchDraw()}
  catch(e){FCH.sending=false;toast("Chưa gửi được: "+(e&&e.message||e));fchDraw()}
}
async function fchToggle(on){
  FCH.open=on;const el=fchEl();el.hidden=!on;
  if(on){await fchInit();fchDraw();await fchPoll(true);clearInterval(FCH.timer);FCH.timer=setInterval(()=>{if(FCH.open&&!document.hidden)fchPoll(false)},4000)}
  else clearInterval(FCH.timer)}
function fchSync(){const el=document.getElementById("fch");if(el&&PAGE!=="lich_fb"){el.hidden=true;FCH.open=false;clearInterval(FCH.timer)}}
function fpcRender(m){
  if(!FPC.st&&!FPC.loading&&!FPC.err)fpcLoad();
  fpcInit();fchSync();
  const box=document.createElement("div");
  box.innerHTML=`${fpcStyle}<section class="fpc">${fpcBar()}<div class="fpc-body"><div class="fpc-cal">${FPC.view==="week"?fpcWeekView():fpcMonth()}</div></div></section>${fpcList()}`;
  m.insertBefore(box,m.firstChild);
  fpcBind(m)
}
const fpcOrig=pFanpageLich;
pFanpageLich=function(m,chs){fpcOrig(m,chs);fpcRender(m)};

/* Trang riêng trên menu Marketing › Content: Lịch đăng Fanpage (lịch + yêu cầu tháng + bảng chi tiết) */
PAGES.lich_fb=function(m){
  const fp=CHANNELS.filter(c=>!c.needId);BV.k=(fp[0]||{}).k||BV.k;
  m.innerHTML=H("Lịch đăng Fanpage","Soạn bài, duyệt, đặt ngày giờ; agent Fanpage đăng bài đã duyệt khi tới giờ");
  const box=document.createElement("div");m.appendChild(box);fpcRender(box)
};

document.addEventListener("click",()=>{if(FPC.dd){FPC.dd=false;try{renderMain()}catch(e){}}});
