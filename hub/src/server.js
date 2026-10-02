/* =====================================================================
   BẢN CHẠY TRÊN MÁY CHỦ (trang /hub/ của Worker CRM)
   - Đăng nhập: dùng chung tài khoản CRM (cookie phiên), không còn mật khẩu riêng.
   - Dữ liệu: một bản chung trên D1 (/api/hub/state). Mỗi thao tác là một hàm sửa dữ liệu;
     ghi kèm số phiên bản, bị 409 thì tải bản mới, áp lại các thao tác đang chờ rồi ghi lại.
   - Số liệu báo cáo nạp sẵn (TikTok tuần, kinh doanh, giá vốn) tải sau khi đăng nhập.
   - Trợ lý AI: gọi /api/hub/ai, máy chủ gọi 9router; trình duyệt không giữ khoá.
   File này nạp SAU mọi file khác nên ghi đè được các hàm cần thiết trước khi khởi động.
   ===================================================================== */
const SV={version:0,pending:[],busy:false,timer:0,me:null,perms:[],deferRemote:false};

async function svApi(path,opt={}){
  const r=await fetch(path,{credentials:"same-origin",...opt,headers:{"Content-Type":"application/json",...(opt.headers||{})}});
  if(r.status===401){location.href="/?next="+encodeURIComponent(location.pathname);throw new Error("Chưa đăng nhập")}
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error((j.error&&j.error.message)||("Lỗi máy chủ "+r.status));e.status=r.status;e.code=j.error&&j.error.code;throw e}
  return j.data;
}
const isCeo=()=>SV.me&&SV.me.role==="CEO";
const foldName=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/gi,"d").toLowerCase().replace(/\(.*?\)/g,"").trim();

/* ---------- Các hàm trước đây nằm trong crm.js (CRM giả lập) ---------- */
function crmSeed(){}
// Số công nợ B2B lấy thẳng từ CRM thật (Bàn điều hành CEO), không còn số chép tay.
var CRM_BASE={noChinhThuc:0,noDuKien:0};
function crmModal(title,html,wide){let ov=$("#crmm");if(!ov){ov=document.createElement("div");ov.id="crmm";ov.className="cmodal";document.body.appendChild(ov)}ov.innerHTML=`<div class="cm-in${wide?" wide":""}" role="dialog" aria-modal="true"><div class="cm-h"><h3>${title}</h3><button class="x" id="cm-x" aria-label="Đóng">✕</button></div><div class="cm-b">${html}</div></div>`;ov.hidden=false;$("#cm-x").onclick=closeCM}
function closeCM(){const ov=$("#crmm");if(ov)ov.hidden=true}
function openDrawerHTML(h){const dr=$("#drawer");$("#drawerIn").innerHTML=`<button class="x" id="dx" aria-label="Đóng">✕</button>`+h;dr.hidden=false;$("#dx").onclick=closeDrawer}

/* ---------- Kho dữ liệu trên máy chủ ---------- */
function svSyncDot(st){const el=$("#svsync");if(el){el.className="svsync "+st;el.title=st==="ok"?"Đã lưu lên máy chủ":st==="busy"?"Đang lưu…":"Chưa lưu được, đang thử lại"}}
function svSchedule(){clearTimeout(SV.timer);svSyncDot("busy");SV.timer=setTimeout(svFlush,250)}
async function svFlush(){
  if(SV.busy||!SV.pending.length)return;
  SV.busy=true;const n=SV.pending.length;
  try{
    for(let tries=0;;tries++){
      try{const r=await svApi("/api/hub/state",{method:"PUT",body:JSON.stringify({version:SV.version,data:DB.data})});SV.version=r.version;SV.pending.splice(0,n);svSyncDot("ok");break}
      catch(e){
        if(e.status!==409||tries>=4)throw e;
        // Có người vừa sửa trước: lấy bản mới, áp lại các thao tác của mình rồi ghi lại.
        const st=await svApi("/api/hub/state");const d=ensureShape(st.data);
        for(const f of SV.pending){try{f(d)}catch(err){console.warn("[hub] áp lại thao tác lỗi",err)}}
        DB.data=d;SV.version=st.version;svRefreshMe();
      }
    }
  }catch(e){svSyncDot("err");toast("Chưa lưu được lên máy chủ ("+e.message+"). Đang thử lại…");setTimeout(svFlush,5000)}
  finally{SV.busy=false;if(SV.pending.length)svSchedule()}
}
function svRefreshMe(){if(!ME)return;const u=D().users.find(x=>x.id===ME.id);if(u)ME=u}
const svTyping=()=>{const a=document.activeElement;return a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.id!=="qs"};
async function svPoll(){
  try{
    if(SV.busy||SV.pending.length||document.hidden)return;
    const v=await svApi("/api/hub/state/version");
    if(v.version>SV.version){
      if(svTyping()){SV.deferRemote=true;return}
      const st=await svApi("/api/hub/state");
      if(SV.pending.length)return;
      DB.data=ensureShape(st.data);SV.version=st.version;SV.deferRemote=false;onRemoteChange();
    }
  }catch(e){}
}

DB.load=async function(){
  const me=await svApi("/api/me");SV.me=me.user;SV.perms=me.permissions||[];
  const blob=k=>svApi("/api/hub/blob/"+k).catch(()=>null);
  const [t9,t9b,kd,sc,ns]=await Promise.all([blob("t9file"),blob("t9"),isCeo()?blob("kd"):null,isCeo()?blob("skucost"):null,isCeo()?blob("nhansu0"):null]);
  if(SV.perms.includes("dashboard.ceo"))svApi("/api/dashboards/ceo").then(c=>{CRM_BASE.noChinhThuc=c.official_debt||0;CRM_BASE.noDuKien=c.projected_debt||0;if(ME&&PAGE==="exec")renderMain()}).catch(()=>{});
  if(t9)window.T9FILE=t9;if(t9b){T9_BASE=t9b.base||{};T9RAW=t9b.raw||T9RAW}if(kd){KD=kd;KDX=kd;DAYD=kd.day||DAYD;TT=kd.tts||null;SP=kd.spe||null}if(sc)SKUCOST=sc;if(ns)NHANSU0=ns;
  const st=await svApi("/api/hub/state");
  if(!st.data){
    if(!isCeo()){this.data=null;return}
    const d=ensureShape(seedData());d.users.forEach(u=>{delete u.pw});
    const ad=d.users.find(u=>u.role==="admin");if(ad)ad.crm=SV.me.id;
    const r=await svApi("/api/hub/state",{method:"PUT",body:JSON.stringify({version:0,data:d})});
    this.data=d;SV.version=r.version;
  }else{this.data=ensureShape(st.data);SV.version=st.version}
  // Gắn tài khoản CRM với người dùng trong khu Marketing.
  let u=this.data.users.find(x=>x.crm===SV.me.id&&x.active);
  if(!u&&isCeo())u=this.data.users.find(x=>x.role==="admin"&&!x.crm);
  if(!u){const f=foldName(SV.me.display_name);u=this.data.users.find(x=>x.active&&!x.crm&&x.name&&(foldName(x.name)===f||f.endsWith(" "+foldName(x.name))))}
  if(u&&u.crm!==SV.me.id){const id=u.id;this.mutate("Hệ thống","gắn tài khoản đăng nhập "+SV.me.display_name+" → "+u.name,d=>{d.users.find(x=>x.id===id).crm=SV.me.id})}
  ME=u?this.data.users.find(x=>x.id===u.id):null;
  // Mỗi lần mở Hub đều bắt đầu ở trang chủ (Tổng quan điều hành), không mở lại trang lần trước.
  MOD="";PAGE="";try{localStorage.removeItem(SKEY+"_m");localStorage.removeItem(SKEY+"_p")}catch(e){}
  APP_MODE=ME&&["admin","lead"].includes(ME.role)?"admin":"user";
  setInterval(svPoll,15000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)svPoll()});
  document.addEventListener("focusout",()=>{if(SV.deferRemote)setTimeout(svPoll,300)});
  addEventListener("beforeunload",e=>{if(SV.pending.length){e.preventDefault();e.returnValue=""}});
};
DB.save=function(){SV.pending.push(()=>{});svSchedule()};
DB.mutate=function(who,msg,fn){
  const act=d=>{fn(d);d.activity.unshift({t:nowHM(),d:today(),who,msg});d.activity=d.activity.slice(0,400);d.updatedAt=Date.now()};
  act(this.data);SV.pending.push(act);svSchedule();
};
DB.reset=async function(){toast("Bản trên máy chủ không xoá về dữ liệu mẫu được.")};

/* ---------- Khung giao diện ---------- */
function renderLogin(){
  const msg=!DB.data?"Khu Marketing chưa được khởi tạo. Nhờ chị Hoa (CEO) mở trang này một lần để tạo dữ liệu ban đầu."
    :`Tài khoản <b>${esc(SV.me?SV.me.display_name:"")}</b> chưa được gắn với nhân sự nào trong khu Marketing. Nhờ chị Hoa vào <b>Quản trị hệ thống › Tài khoản & phân quyền</b> để gắn.`;
  $("#app").innerHTML=`<div class="loginwrap"><div class="login"><img src="data:image/png;base64,${LOGO}" alt="Ailla" class="llogo"><h1>Ailla Hub</h1><p>${msg}</p><div class="acts">${SV.perms.includes("price.read")?`<a class="btn" href="/admin">Mở CRM B2B</a>`:""}<button class="btn" id="svout">Đăng xuất</button></div></div></div>`;
  $("#svout").onclick=svLogout;
}
async function svLogout(){try{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"})}catch(e){}location.href="/"}

// CRM B2B thật là phân hệ riêng (/admin, /sales), thay cho bản CRM giả lập trong khung.
// Lương, phiếu lương và file HR MASTER KHÔNG đưa lên đây: dữ liệu Hub là một bản chung,
// ai có tài khoản Hub cũng tải được, nên số lương phải ở chỗ phân quyền riêng (làm sau).
{const i=MODULES.findIndex(m=>m.k==="b2b");if(i>=0)MODULES.splice(i,1)}
{const hr=MODULES.find(m=>m.k==="hr");if(hr){const g0=hr.groups;hr.groups=()=>g0().filter(([g])=>g!=="Lương"&&g!=="Dữ liệu")}}
{const i=MENU_USER.findIndex(g=>g[0]==="Nhân sự của tôi");if(i>=0)MENU_USER[i]=[MENU_USER[i][0],MENU_USER[i][1].filter(it=>it[0]!=="hr_plme")]}
MODULES.splice(MODULES.findIndex(m=>m.zone==="Kinh doanh"),0,{k:"b2blink",zone:"Kinh doanh",ic:"box",n:"Kinh doanh B2B (CRM)",sub:"",groups:()=>[["",[MI("crmgo","Mở CRM B2B",()=>SV.perms.includes("price.read"))]]]});
PAGES.crmgo=m=>{m.innerHTML=H("Đang mở CRM B2B…");location.href=SV.me&&SV.me.role!=="EMPLOYEE"?(SV.me.role==="CEO"?"/admin/ceo":"/admin"):"/sales"};
PAGES.matkhau=m=>{const p=SV.me&&SV.me.role!=="EMPLOYEE"?"/admin/account":"/sales/account";m.innerHTML=H("Đổi mật khẩu","Dùng chung mật khẩu với CRM")+`<section class="card narrow"><p>Mật khẩu đăng nhập dùng chung cho CRM và khu Marketing.</p><div class="acts"><a class="btn pri" href="${p}">Đổi mật khẩu</a></div></section>`};

const _pCaiDat=pCaiDat;
pCaiDat=function(m){_pCaiDat(m);["#rs","#rsm"].forEach(s=>{const e=$(s);if(e)e.remove()});const im=$("#im-j");if(im&&!isCeo())im.closest("label").remove();
  const p=[...m.querySelectorAll("p")].find(x=>/Bản thật/.test(x.textContent));if(p)p.textContent="Dữ liệu lưu chung trên máy chủ, mọi người thấy cùng một bản. Tải bản sao lưu (.json) về máy khi cần lưu trữ riêng."};
PAGES.caidat=pCaiDat;

/* Tài khoản & phân quyền: gắn mỗi nhân sự với một tài khoản đăng nhập CRM. */
let SV_CRMUSERS=null;
function pNhanSuSV(m){
  const U=D().users,ed=can(ME,"nhansu.quanly");
  if(SV_CRMUSERS===null&&ed){SV_CRMUSERS=[];svApi("/api/users").then(r=>{SV_CRMUSERS=r||[];if(PAGE==="nhansu")renderMain()}).catch(()=>{})}
  const used=id=>U.find(u=>u.crm===id);
  const accOpts=u=>[["","— chưa gắn"]].concat((SV_CRMUSERS||[]).filter(a=>a.id===u.crm||!used(a.id)).map(a=>[a.id,a.display_name]));
  const accName=id=>((SV_CRMUSERS||[]).find(a=>a.id===id)||{}).display_name||(id?"(đã gắn)":"—");
  m.innerHTML=H("Tài khoản & phân quyền","Đăng nhập dùng chung tài khoản CRM")+`<div class="note">Tạo tài khoản đăng nhập ở <a href="/admin/users">CRM › Người dùng & phân quyền</a> (cột <b>Khu Marketing</b>: chọn <b>Chỉ Marketing</b> cho nhân sự Content/Digital). Sau đó gắn tài khoản đó với nhân sự ở bảng dưới.</div>
  <section class="card">${tbl(["Họ tên","Chức danh","Vai trò","Tài khoản đăng nhập","Đang làm","Số quyền",""],U.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.title)}</td><td>${u.id===ME.id||!ed?ROLES[u.role]:`<select data-ur="${u.id}">${opt(Object.entries(ROLES),u.role)}</select>`}</td><td>${ed&&u.id!==ME.id?`<select data-uc="${u.id}">${opt(accOpts(u),u.crm||"")}</select>`:esc(accName(u.crm))}</td><td>${u.id===ME.id||!ed?(u.active?"Có":"Đã khóa"):`<label class="sw-t"><input type="checkbox" data-ua="${u.id}" ${u.active?"checked":""}> ${u.active?"Có":"Đã khóa"}</label>`}</td><td class="n">${u.perms.length}/${ALL_PERMS.length}</td><td>${ed?`<button class="btn sm" data-pp="${u.id}">Phân quyền</button>`:""}</td></tr>`))}</section>
  ${ed?`<section class="card"><div class="card-h"><h2>Thêm nhân sự</h2></div><form class="frm row7" id="uf"><label class="field">Họ tên<input id="u-n" required></label><label class="field">Chức danh<input id="u-t"></label><label class="field">Vai trò<select id="u-r">${opt(Object.entries(ROLES).filter(([k])=>k!=="admin"),"content")}</select></label><label class="field">Tài khoản đăng nhập<select id="u-c">${opt([["","— gắn sau"]].concat((SV_CRMUSERS||[]).filter(a=>!used(a.id)).map(a=>[a.id,a.display_name])),"")}</select></label><button class="btn pri">Thêm</button></form></section>`:""}`;
  m.querySelectorAll("[data-ur]").forEach(s=>s.onchange=()=>{DB.mutate(ME.name,`đổi vai trò ${userName(s.dataset.ur)} → ${ROLES[s.value]}`,d=>{const u=d.users.find(x=>x.id===s.dataset.ur);u.role=s.value;u.perms=ROLE_PRESET[s.value].slice()});toast("Đã đổi vai trò và áp quyền mặc định");renderMain()});
  m.querySelectorAll("[data-uc]").forEach(s=>s.onchange=()=>{const id=s.dataset.uc,v=s.value;DB.mutate(ME.name,`gắn tài khoản đăng nhập cho ${userName(id)}`,d=>{d.users.forEach(x=>{if(v&&x.crm===v)x.crm=""});d.users.find(x=>x.id===id).crm=v});toast(v?"Đã gắn tài khoản":"Đã bỏ gắn");renderMain()});
  m.querySelectorAll("[data-ua]").forEach(s=>s.onchange=()=>{DB.mutate(ME.name,(s.checked?"mở":"khóa")+" tài khoản "+userName(s.dataset.ua),d=>d.users.find(x=>x.id===s.dataset.ua).active=s.checked);renderMain()});
  m.querySelectorAll("[data-pp]").forEach(b=>b.onclick=()=>{const u=userBy(b.dataset.pp);$("#drawerIn").innerHTML=`<div class="dh"><h2>Phân quyền: ${esc(u.name)}</h2><button class="btn sm" id="dx">Đóng</button></div><p class="hint">Vai trò: ${ROLES[u.role]}. Tick để cấp quyền riêng cho người này.</p><form id="ppf">${PERMS.map(([g,ps])=>`<fieldset class="pg"><legend>${g}</legend>${ps.map(([k,l])=>`<label class="ck"><input type="checkbox" name="p" value="${k}" ${u.perms.includes(k)?"checked":""} ${u.role==="admin"?"disabled":""}> ${l}</label>`).join("")}</fieldset>`).join("")}<div class="acts">${u.role!=="admin"?`<button class="btn pri">Lưu quyền</button><button type="button" class="btn" id="ppd">Về mặc định theo vai trò</button>`:"<span class='hint'>Quản trị có mọi quyền.</span>"}</div></form>`;$("#drawer").hidden=false;$("#dx").onclick=closeDrawer;
    $("#ppf").onsubmit=e=>{e.preventDefault();const ps=[...$$("#ppf input[name=p]:checked")].map(x=>x.value);DB.mutate(ME.name,"phân quyền "+u.name,d=>d.users.find(x=>x.id===u.id).perms=ps);closeDrawer();toast("Đã lưu quyền");renderMain()};
    if($("#ppd"))$("#ppd").onclick=()=>{DB.mutate(ME.name,"đặt quyền mặc định "+u.name,d=>d.users.find(x=>x.id===u.id).perms=ROLE_PRESET[u.role].slice());closeDrawer();renderMain()}});
  if($("#uf"))$("#uf").onsubmit=e=>{e.preventDefault();const r=$("#u-r").value,c=$("#u-c").value,n=$("#u-n").value.trim();const un=foldName(n).replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"")||"nv";DB.mutate(ME.name,"thêm nhân sự "+n,d=>d.users.push({id:uid("u_"),username:un,name:n,role:r,title:$("#u-t").value,active:true,crm:c,perms:ROLE_PRESET[r].slice()}));toast("Đã thêm nhân sự");renderMain()};
}
PAGES.nhansu=pNhanSuSV;

/* ---------- Trợ lý AI: gọi qua máy chủ ---------- */
askClaude=async function(system,user){const r=await svApi("/api/hub/ai",{method:"POST",body:JSON.stringify({system,user,model:aiCombo()})});return {text:r.text,model:r.model+" (9router)",trunc:false}};
clConnectCard=function(){return `<section class="card"><div class="card-h"><h2>Kết nối AI</h2>${pill("Chạy trên máy chủ","grn")}</div><p class="hint">Máy chủ gọi 9router trên VPS (gói tháng có sẵn). Khoá nằm trên máy chủ, trình duyệt không giữ khoá.</p>${isCeo()?`<div class="row4"><label class="field grow">Combo AI trong 9router<input id="cl-combo" value="${esc(aiCombo())}" placeholder="Combo_Content"></label></div><div class="acts"><button class="btn pri" id="cl-save">Lưu</button></div>`:""}</section>`};
bindClConnect=function(){if($("#cl-save"))$("#cl-save").onclick=()=>{try{localStorage.setItem(CL_COMBO,$("#cl-combo").value.trim()||"Combo_Content")}catch(e){}toast("Đã lưu");renderMain()}};
