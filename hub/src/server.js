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
// Đang thao tác thì 5 giây hỏi một lần; để máy không đụng tới quá 2 phút thì 30 giây (đỡ tốn lượt gọi máy chủ).
let svActive=Date.now(),svLastPoll=0;["mousemove","keydown","touchstart","scroll"].forEach(e=>addEventListener(e,()=>{svActive=Date.now()},{passive:true}));
async function svPoll(){
  try{
    if(SV.busy||SV.pending.length||document.hidden)return;
    if(Date.now()-svActive>120000&&Date.now()-svLastPoll<30000)return;svLastPoll=Date.now();
    const v=await svApi("/api/hub/state/version");
    if(v.version>SV.version){
      if(svTyping()){SV.deferRemote=true;return}
      const st=await svApi("/api/hub/state");
      if(SV.pending.length)return;
      const before=svWatch();DB.data=ensureShape(st.data);SV.version=st.version;SV.deferRemote=false;onRemoteChange();svNotify(before,svWatch());
    }
  }catch(e){}
}

/* Báo ngay việc mới đến tay mình (xưởng báo xong → kế toán; nhu cầu mới → xưởng; lô đã kiểm → người in tem). */
function svWatch(){const s=D()&&D().sx;if(!s)return {};return {kiem:s.batches.filter(b=>b.st==="CHO_KIEM").map(b=>b.id),req:s.requests.filter(r=>r.st==="CAN_LAM").map(r=>r.id),tem:s.batches.filter(b=>b.st==="DA_KIEM"||b.st==="TEM_SAN").map(b=>b.id),task:(D().tasks||[]).filter(t=>t.nguoi===(ME&&ME.id)&&t.st!=="done").map(t=>t.id),duyet:(D().tasks||[]).filter(t=>t.duyet===(ME&&ME.id)&&t.st==="review").map(t=>t.id+":"+(t.trinh||[]).join(",")).concat(ME&&ME.role==="admin"?(D().tasks||[]).filter(t=>(t.oanhOk||[]).length).map(t=>t.id+":ceo:"+t.oanhOk.join(",")):[])}}
function svNotify(a,b){if(!ME||!a.kiem)return;const neu=k=>(b[k]||[]).filter(x=>!(a[k]||[]).includes(x)),s=D().sx,msg=[];
  if(can(ME,"sx.kiemke"))neu("kiem").forEach(id=>{const x=s.batches.find(y=>y.id===id);if(x)msg.push(`Xưởng vừa báo xong ${sxP(x.sp).ten}: ${nf(x.baoSL)} · chờ kiểm kê`)});
  if(can(ME,"sx.xuong"))neu("req").forEach(id=>{const x=s.requests.find(y=>y.id===id);if(x)msg.push(`Nhu cầu mới: ${sxP(x.sp).ten}${x.sl?" · "+nf(x.sl):""}${x.uu==="Gấp"?" · GẤP":""}`)});
  neu("task").forEach(id=>{const t=D().tasks.find(y=>y.id===id);if(t)msg.push("Việc mới giao cho bạn: "+t.ten)});
  neu("duyet").forEach(k=>{const t=D().tasks.find(y=>y.id===k.split(":")[0]);if(t)msg.push("Có video trình bạn duyệt: "+t.ten)});
  if(!msg.length)return;toast(msg.join(" · "));try{if(document.hidden&&"Notification" in window&&Notification.permission==="granted")new Notification("Trang quản trị Ailla",{body:msg.join(" · ")})}catch(e){}
  document.title="("+msg.length+") Trang quản trị Ailla";setTimeout(()=>{document.title="Trang quản trị Ailla"},15000)}
DB.load=async function(){
  const me=await svApi("/api/me");SV.me=me.user;SV.perms=me.permissions||[];
  const blob=k=>svApi("/api/hub/blob/"+k).catch(()=>null);
  const acct=isCeo()||SV.perms.includes("debt.read.all");
  SV.acct=acct;
  // CEO + kế toán nhận đủ số kinh doanh; người khác chỉ nhận số Ads (team Digital) và chỉ số bán hàng (Sale).
  const [t9,t9b,kdFull,kdAds,kdSale,sc,ns]=await Promise.all([blob("t9file"),blob("t9"),acct?blob("kd"):null,acct?null:blob("kd_ads"),acct?null:blob("kd_sale"),acct?blob("skucost"):null,isCeo()?blob("nhansu0"):null]);
  const kd=kdFull||(kdAds||kdSale?{...KDX,...(kdAds||{}),...(kdSale||{}),day:{tts:{},spe:{},fb:(kdSale&&kdSale.day&&kdSale.day.fb)||{},ads:(kdAds&&kdAds.day&&kdAds.day.ads)||{}}}:null);
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
  // CEO vào Tổng quan điều hành; nhân viên vào Tổng quan công việc (việc của mình, việc được giao).
  MOD=ME&&ME.role!=="admin"?"cv":"";PAGE=ME&&ME.role!=="admin"?"cv_tq":"";if(/^#lo=/.test(location.hash)){MOD="sx";PAGE="sx_lo"}try{localStorage.removeItem(SKEY+"_m");localStorage.removeItem(SKEY+"_p")}catch(e){}
  // Mọi người dùng chung khung phân hệ; mỗi người chỉ thấy phân hệ của phòng mình (xem svAllowedMods).
  APP_MODE="admin";
  for(const p of this.data.departments||[])if(!MKT_PB.includes(p.k)&&!TEAMS[p.k])TEAMS[p.k]=p.n;
  // Vận hành thời gian thực: 5 giây hỏi máy chủ một lần (chỉ khi đang mở trang), có thay đổi mới tải về.
  setInterval(svPoll,5000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)svPoll()});
  document.addEventListener("focusout",()=>{if(SV.deferRemote)setTimeout(svPoll,300)});
  addEventListener("beforeunload",e=>{if(SV.pending.length){e.preventDefault();e.returnValue=""}});
};
DB.save=function(){SV.pending.push(()=>{});svSchedule()};
/* Sản lượng KH của pillar = tổng số lượng các tuyến cùng sản phẩm, cùng kênh (kênh ngoài TikTok chính: cộng mọi tuyến
   của kênh). Sửa tuyến hay điều chỉnh kế hoạch là pillar tự đổi theo, không lệch nhau. */
function pillarTuyen(d,p){return (d.tuyen||[]).filter(t=>t.kenh===p.kenh&&(p.kenh!=="TikTok chính"||t.sku===p.sku))}
function syncPillars(d){(d.pillars||[]).forEach(p=>{const T=pillarTuyen(d,p);if(T.length)p.kh=T.reduce((a,t)=>a+(+t.kh||0),0)})}
DB.mutate=function(who,msg,fn){
  const act=d=>{fn(d);syncPillars(d);d.activity.unshift({t:nowHM(),d:today(),who,msg});d.activity=d.activity.slice(0,400);d.updatedAt=Date.now()};
  act(this.data);SV.pending.push(act);svSchedule();
};
DB.reset=async function(){toast("Bản trên máy chủ không xoá về dữ liệu mẫu được.")};

/* ---------- Khung giao diện ---------- */
function renderLogin(){
  const msg=!DB.data?"Khu Marketing chưa được khởi tạo. Nhờ chị Hoa (CEO) mở trang này một lần để tạo dữ liệu ban đầu."
    :`Tài khoản <b>${esc(SV.me?SV.me.display_name:"")}</b> chưa được gắn với nhân sự nào trong khu Marketing. Nhờ chị Hoa vào <b>Cài đặt › Tài khoản & phân quyền</b> để gắn.`;
  $("#app").innerHTML=`<div class="loginwrap"><div class="login"><img src="data:image/png;base64,${LOGO}" alt="Ailla" class="llogo"><h1>Trang quản trị Ailla</h1><p>${msg}</p><div class="acts">${SV.perms.includes("price.read")?`<a class="btn" href="/admin">Mở CRM B2B</a>`:""}<button class="btn" id="svout">Đăng xuất</button></div></div></div>`;
  $("#svout").onclick=svLogout;
}
async function svLogout(){try{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"})}catch(e){}location.href="/"}

// CRM B2B thật là phân hệ riêng (/admin, /sales), thay cho bản CRM giả lập trong khung.
// Lương, phiếu lương và file HR MASTER KHÔNG đưa lên đây: dữ liệu Hub là một bản chung,
// ai có tài khoản Hub cũng tải được, nên số lương phải ở chỗ phân quyền riêng (làm sau).
{const i=MODULES.findIndex(m=>m.k==="b2b");if(i>=0)MODULES.splice(i,1)}
{const hr=MODULES.find(m=>m.k==="hr");if(hr){const g0=hr.groups;hr.groups=()=>g0().filter(([g])=>g!=="Lương"&&g!=="Dữ liệu")}}
{const i=MENU_USER.findIndex(g=>g[0]==="Nhân sự của tôi");if(i>=0)MENU_USER[i]=[MENU_USER[i][0],MENU_USER[i][1].filter(it=>it[0]!=="hr_plme")]}
MODULES.splice(MODULES.findIndex(m=>m.k==="mkt"),0,{k:"b2blink",zone:"Bán hàng",ic:"box",n:"Bán hàng B2B (CRM)",sub:"",groups:()=>[["",[MI("crmgo","Mở CRM B2B",()=>SV.perms.includes("price.read"))]]]});
/* ---------- Mỗi phòng ban chỉ thấy phân hệ của mình ----------
   Phân hệ lấy từ Cài đặt › Phòng ban (cột "Dùng phân hệ"); ai cũng có Công việc & dự án
   (giao việc, nhiệm vụ). CEO (vai trò Quản trị) thấy tất cả. */
const DEPT_MODS={SX:["sx"],KV:["sx"],HCNS:["hr"]};
function svAllowedMods(){
  if(!ME||ME.role==="admin")return null;
  const p=(D().departments||[]).find(x=>x.k===ME.phongBan),m=(p&&p.phanHe&&p.phanHe.length?p.phanHe:DEPT_MODS[ME.phongBan])||[];
  const s=new Set(["cv","me",...m]);if(s.has("mkt"))s.add("aiq");
  // Ai được cấp một quyền Sản xuất (Thảo điều phối, kế toán kho, kỹ thuật...) thì thấy phân hệ Sản xuất.
  if(["sx.dieuphoi","sx.xuong","sx.kiemke","sx.kythuat"].some(k=>can(ME,k))||ME.phongBan==="KT")s.add("sx");if(s.has("b2b")||s.has("b2c"))s.add("b2blink");return s;
}
// Phòng được dùng phân hệ nào thì người trong phòng xem được các trang của phân hệ đó (B2C, Sản xuất,
// Tài chính, Nhân sự, Tổng quan); Marketing và Quản trị hệ thống vẫn theo quyền chi tiết từng người.
const DEPT_OPEN=["exec","b2c","sx","fin","hr"];
// Số tài chính (doanh thu tổng, giá vốn, P&L, chi phí): chỉ CEO và kế toán. Người khác ở phòng Sale chỉ thấy
// trang chỉ số bán hàng; Tổng quan điều hành và Tài chính ẩn hẳn.
const SECRET_MODS=["exec","fin"],SALE_PAGES=["fb_sale","fb_cskh"];
MODULES.forEach(mo=>{const g=mo.groups;mo.groups=()=>{const a=svAllowedMods();if(a&&!a.has(mo.k))return [];if(!SV.acct&&SECRET_MODS.includes(mo.k))return [];let G=g();if(a&&DEPT_OPEN.includes(mo.k))G=G.map(([n,its])=>[n,its.map(i=>[i[0],i[1],()=>true,i[3]])]);if(!SV.acct&&mo.k==="b2c")G=G.map(([n,its])=>[n,its.filter(i=>SALE_PAGES.includes(i[0]))]).filter(x=>x[1].length);return G}});
{const st=MODULES.find(m=>m.k==="setup");if(st){const g=st.groups;st.groups=()=>g().map(([n,its])=>[n,its.filter(i=>SV.acct||!["sku","kenhban","chiphidm"].includes(i[0]))]).filter(x=>x[1].length)}}
/* Dòng ghi chú trên các trang số tài chính: đây là số quản trị nội bộ, sổ sách chính thức ở MISA. */
const INTERNAL_PAGES=["bc_tong","bc_tiktok","bc_shopee","bc_fb","pl","chiphi","doisoat","sku","adshieuqua","fb_ads","adssp"];
INTERNAL_PAGES.forEach(k=>{const f=PAGES[k];if(f)PAGES[k]=m=>{f(m);m.insertAdjacentHTML("afterbegin",`<div class="note internal">🔒 Số liệu <b>quản trị nội bộ</b> để điều hành (ước tính, phân bổ, so mục tiêu), không phải báo cáo tài chính. Sổ sách chính thức do Kế toán quản lý trên MISA.</div>`)}});
PAGES.crmgo=m=>{m.innerHTML=H("Đang mở CRM B2B…");location.href=SV.me&&SV.me.role!=="EMPLOYEE"?(SV.me.role==="CEO"?"/admin/ceo":"/admin"):"/sales"};
PAGES.matkhau=m=>{const p=SV.me&&SV.me.role!=="EMPLOYEE"?"/admin/account":"/sales/account";m.innerHTML=H("Đổi mật khẩu","Dùng chung mật khẩu với CRM")+`<section class="card narrow"><p>Mật khẩu đăng nhập dùng chung cho CRM và khu Marketing.</p><div class="acts"><a class="btn pri" href="${p}">Đổi mật khẩu</a></div></section>`};

const _pCaiDat=pCaiDat;
pCaiDat=function(m){_pCaiDat(m);["#rs","#rsm"].forEach(s=>{const e=$(s);if(e)e.remove()});const im=$("#im-j");if(im&&!isCeo())im.closest("label").remove();
  const p=[...m.querySelectorAll("p")].find(x=>/Bản thật/.test(x.textContent));if(p)p.textContent="Dữ liệu lưu chung trên máy chủ, mọi người thấy cùng một bản. Tải bản sao lưu (.json) về máy khi cần lưu trữ riêng."};
PAGES.caidat=pCaiDat;

/* Tài khoản & phân quyền: một chỗ cho CEO tự thêm/khoá nhân sự.
   Thêm nhân sự = tạo tài khoản đăng nhập + gắn phòng ban, vai trò, quyền + mở cửa qt.ailla.vn cho email đó.
   Khoá = khoá tài khoản đăng nhập, đá khỏi phiên đang mở, rút email khỏi cửa qt.ailla.vn. */
let SV_CRMUSERS=null,SV_ACCESS=null;
function svLoadUsers(){return svApi("/api/admin/users").then(r=>{SV_CRMUSERS=r||[];if(PAGE==="nhansu")renderMain()}).catch(()=>{SV_CRMUSERS=SV_CRMUSERS||[]})}
function svAccessMsg(a){if(!a)return "";if(a.ok)return ` · đã cập nhật cửa qt.ailla.vn (${a.count} email)`;return a.error==="chưa cấu hình"?" · cửa qt.ailla.vn chưa nối tự động":" · cửa qt.ailla.vn: "+a.error}
function pNhanSuSV(m){
  const U=D().users,ed=can(ME,"nhansu.quanly"),crm=SV.perms.includes("user.manage");
  if(SV_CRMUSERS===null&&crm){SV_CRMUSERS=[];svLoadUsers()}
  if(SV_ACCESS===null&&crm){SV_ACCESS={};svApi("/api/admin/users/access-sync").then(r=>{SV_ACCESS=r||{};if(PAGE==="nhansu")renderMain()}).catch(()=>{})}
  const A=SV_CRMUSERS||[],acc=id=>A.find(a=>a.id===id);
  const used=id=>U.find(u=>u.crm===id);
  const accOpts=u=>[["","— chưa gắn"]].concat(A.filter(a=>a.id===u.crm||!used(a.id)).map(a=>[a.id,a.display_name+" · "+a.email]));
  const accCell=u=>{const a=acc(u.crm);if(ed&&crm&&u.id!==ME.id)return `<select data-uc="${u.id}">${opt(accOpts(u),u.crm||"")}</select>`;return a?esc(a.email):(u.crm?"(đã gắn)":"—")};
  const b2bCell=u=>{const a=acc(u.crm);if(!a)return "—";if(a.role!=="EMPLOYEE"||u.id===ME.id||a.is_accountant)return "Có";return crm?`<label class="sw-t"><input type="checkbox" data-b2b="${a.id}" ${a.is_hub_only?"":"checked"}> ${a.is_hub_only?"Không":"Có"}</label>`:(a.is_hub_only?"Không":"Có")};
  const ktCell=u=>{const a=acc(u.crm);if(!a)return "—";if(a.role==="CEO")return "Có";return crm?`<label class="sw-t"><input type="checkbox" data-kt="${a.id}" ${a.is_accountant?"checked":""}> ${a.is_accountant?"Có":"Không"}</label>`:(a.is_accountant?"Có":"Không")};
  const gate=SV_ACCESS&&SV_ACCESS.configured;
  m.innerHTML=H("Tài khoản & phân quyền","Thêm, khoá nhân sự và cấp quyền ở một chỗ")+`<div class="note">Mỗi người chỉ thấy phân hệ của <b>phòng ban</b> mình (đặt ở Cài đặt › Phòng ban) và mục Task giao việc. <b>Trưởng phòng</b> giao được việc cho người trong phòng. <b>Kế toán</b> mới xem được giá vốn, P&L, chi phí và doanh thu tổng. Bỏ tick <b>Đang làm</b> là khoá luôn tài khoản đăng nhập.</div>
  ${crm?`<section class="card"><div class="card-h"><h2>Cửa vào qt.ailla.vn</h2>${gate?pill("Tự cập nhật","grn"):pill("Chưa nối tự động","amb")}</div><p class="hint">${gate?"Thêm nhân sự là email được mở cửa ngay; khoá tài khoản là email bị rút ra.":"Hiện chỉ email của chị vào được qt.ailla.vn. Khi nối xong, thêm nhân sự ở đây là tự mở cửa cho họ."}</p>${gate?`<div class="acts"><button class="btn sm" id="acsync">Đồng bộ lại ngay</button></div>`:""}</section>`:""}
  <section class="card">${tbl(["Họ tên","Phòng ban","Vai trò","Tài khoản đăng nhập","Vào CRM B2B","Kế toán","Đang làm",""],U.map(u=>`<tr><td><b>${esc(u.name)}</b><small>${esc(u.title||"")}</small></td><td>${ed&&u.id!==ME.id?`<select data-upb="${u.id}">${opt([["","—"]].concat(D().departments.map(p=>[p.k,p.n])),u.phongBan||"")}</select>`:esc((D().departments.find(p=>p.k===u.phongBan)||{n:"—"}).n)}</td><td>${u.id===ME.id||!ed?ROLES[u.role]:`<select data-ur="${u.id}">${opt(Object.entries(ROLES),u.role)}</select>`}</td><td>${accCell(u)}</td><td>${b2bCell(u)}</td><td>${ktCell(u)}</td><td>${u.id===ME.id||!ed?(u.active?"Có":"Đã khóa"):`<label class="sw-t"><input type="checkbox" data-ua="${u.id}" ${u.active?"checked":""}> ${u.active?"Có":"Đã khóa"}</label>`}</td><td class="nowrap">${ed?`<button class="btn sm" data-pp="${u.id}">Phân quyền</button>`:""}${crm&&acc(u.crm)&&u.id!==ME.id?` <button class="btn sm" data-pw="${u.crm}">Cấp lại mật khẩu</button>`:""}</td></tr>`))}</section>
  ${ed?`<section class="card"><div class="card-h"><h2>Thêm nhân sự</h2></div><p class="hint">Điền một lần: web tự tạo tài khoản đăng nhập, gắn phòng ban, quyền theo vai trò${gate?" và mở cửa qt.ailla.vn":""}. Lần đầu đăng nhập, nhân sự phải đổi sang mật khẩu của riêng họ.</p><form class="frm" id="uf"><div class="row4"><label class="field">Họ tên<input id="u-n" required></label><label class="field">Chức danh<input id="u-t"></label><label class="field">Phòng ban<select id="u-pb">${opt(D().departments.map(p=>[p.k,p.n]),"")}</select></label><label class="field">Vai trò<select id="u-r">${opt(Object.entries(ROLES).filter(([k])=>k!=="admin"),"nhanvien")}</select></label></div>
  ${crm?`<div class="row4"><label class="field">Email đăng nhập<input id="u-e" type="email" placeholder="ten@gmail.com"></label><label class="field">Mật khẩu ban đầu<input id="u-p" type="text" autocomplete="off" placeholder="ít nhất 8 ký tự, có chữ và số"></label><label class="ck"><input type="checkbox" id="u-b2b"> Vào CRM B2B (Sale B2B)</label><label class="ck"><input type="checkbox" id="u-kt"> Kế toán (xem số tài chính, tự vào CRM B2B)</label></div><p class="hint">Người đã có tài khoản đăng nhập rồi thì bỏ trống email và chọn ở đây: <select id="u-c">${opt([["","—"]].concat(A.filter(a=>!used(a.id)).map(a=>[a.id,a.display_name+" · "+a.email])),"")}</select></p>`:""}
  <div class="acts"><button class="btn pri" id="u-go">Thêm nhân sự</button></div></form></section>`:""}`;
  const busy=async(el,f)=>{if(el)el.disabled=true;try{await f()}catch(e){toast("Chưa được: "+e.message);if(PAGE==="nhansu")renderMain()}finally{if(el)el.disabled=false}};
  m.querySelectorAll("[data-ur]").forEach(s=>s.onchange=()=>{DB.mutate(ME.name,`đổi vai trò ${userName(s.dataset.ur)} → ${ROLES[s.value]}`,d=>{const u=d.users.find(x=>x.id===s.dataset.ur);u.role=s.value;u.perms=ROLE_PRESET[s.value].slice()});toast("Đã đổi vai trò và áp quyền mặc định");renderMain()});
  m.querySelectorAll("[data-upb]").forEach(s=>s.onchange=()=>{DB.mutate(ME.name,`đổi phòng ban ${userName(s.dataset.upb)}`,d=>{d.users.find(x=>x.id===s.dataset.upb).phongBan=s.value});toast("Đã đổi phòng ban");renderMain()});
  m.querySelectorAll("[data-uc]").forEach(s=>s.onchange=()=>{const id=s.dataset.uc,v=s.value;DB.mutate(ME.name,`gắn tài khoản đăng nhập cho ${userName(id)}`,d=>{d.users.forEach(x=>{if(v&&x.crm===v)x.crm=""});d.users.find(x=>x.id===id).crm=v});toast(v?"Đã gắn tài khoản":"Đã bỏ gắn");renderMain()});
  m.querySelectorAll("[data-b2b]").forEach(s=>s.onchange=()=>busy(s,async()=>{await svApi(`/api/admin/users/${s.dataset.b2b}/marketing`,{method:"POST",body:JSON.stringify({mode:s.checked?"with_b2b":"only"})});toast(s.checked?"Đã cho vào CRM B2B":"Đã bỏ quyền CRM B2B");await svLoadUsers()}));
  m.querySelectorAll("[data-kt]").forEach(s=>s.onchange=()=>busy(s,async()=>{await svApi(`/api/admin/users/${s.dataset.kt}/accountant`,{method:"POST",body:JSON.stringify({enabled:s.checked})});const a=acc(s.dataset.kt);if(s.checked&&a&&a.is_hub_only)await svApi(`/api/admin/users/${a.id}/marketing`,{method:"POST",body:JSON.stringify({mode:"with_b2b"})});toast(s.checked?"Đã bật quyền Kế toán (người đó tải lại trang là thấy)":"Đã tắt quyền Kế toán");await svLoadUsers()}));
  m.querySelectorAll("[data-ua]").forEach(s=>s.onchange=()=>busy(s,async()=>{const u=userBy(s.dataset.ua),a=acc(u.crm);let note="";
    if(a&&crm&&a.role!=="CEO"){const r=await svApi(`/api/admin/users/${a.id}`,{method:"PATCH",body:JSON.stringify({status:s.checked?"ACTIVE":"DISABLED"})});note=svAccessMsg(r&&r.access)}
    DB.mutate(ME.name,(s.checked?"mở":"khóa")+" tài khoản "+u.name,d=>d.users.find(x=>x.id===u.id).active=s.checked);toast((s.checked?"Đã mở lại ":"Đã khoá ")+u.name+note);if(a)await svLoadUsers();renderMain()}));
  m.querySelectorAll("[data-pw]").forEach(b=>b.onclick=()=>{const a=acc(b.dataset.pw);const p=prompt(`Mật khẩu mới cho ${a.display_name} (ít nhất 8 ký tự, có chữ và số). Lần đăng nhập tới họ phải đổi lại.`);if(!p)return;busy(b,async()=>{await svApi(`/api/admin/users/${a.id}/set-password`,{method:"POST",body:JSON.stringify({password:p})});toast("Đã cấp lại mật khẩu cho "+a.display_name)})});
  if($("#acsync"))$("#acsync").onclick=e=>busy(e.target,async()=>{const r=await svApi("/api/admin/users/access-sync",{method:"POST"});toast(r.ok?`Đã cập nhật cửa qt.ailla.vn (${r.count} email)`:"Chưa được: "+r.error)});
  m.querySelectorAll("[data-pp]").forEach(b=>b.onclick=()=>{const u=userBy(b.dataset.pp);$("#drawerIn").innerHTML=`<div class="dh"><h2>Phân quyền: ${esc(u.name)}</h2><button class="btn sm" id="dx">Đóng</button></div><p class="hint">Vai trò: ${ROLES[u.role]}. Tick để cấp quyền riêng cho người này.</p><form id="ppf">${PERMS.map(([g,ps])=>`<fieldset class="pg"><legend>${g}</legend>${ps.map(([k,l])=>`<label class="ck"><input type="checkbox" name="p" value="${k}" ${u.perms.includes(k)?"checked":""} ${u.role==="admin"?"disabled":""}> ${l}</label>`).join("")}</fieldset>`).join("")}<div class="acts">${u.role!=="admin"?`<button class="btn pri">Lưu quyền</button><button type="button" class="btn" id="ppd">Về mặc định theo vai trò</button>`:"<span class='hint'>Quản trị có mọi quyền.</span>"}</div></form>`;$("#drawer").hidden=false;$("#dx").onclick=closeDrawer;
    $("#ppf").onsubmit=e=>{e.preventDefault();const ps=[...$$("#ppf input[name=p]:checked")].map(x=>x.value);DB.mutate(ME.name,"phân quyền "+u.name,d=>d.users.find(x=>x.id===u.id).perms=ps);closeDrawer();toast("Đã lưu quyền");renderMain()};
    if($("#ppd"))$("#ppd").onclick=()=>{DB.mutate(ME.name,"đặt quyền mặc định "+u.name,d=>d.users.find(x=>x.id===u.id).perms=ROLE_PRESET[u.role].slice());closeDrawer();renderMain()}});
  if($("#uf"))$("#uf").onsubmit=e=>{e.preventDefault();busy($("#u-go"),async()=>{
    const r=$("#u-r").value,n=$("#u-n").value.trim(),em=crm?$("#u-e").value.trim():"",pw=crm?$("#u-p").value:"";let c=crm?$("#u-c").value:"",note="";
    if(em){if(!pw)throw new Error("nhập mật khẩu ban đầu");
      const res=await svApi("/api/admin/users",{method:"POST",body:JSON.stringify({email:em,display_name:n,role:"EMPLOYEE",password:pw})});c=res.id;note=svAccessMsg(res.access);
      await svApi(`/api/admin/users/${c}/marketing`,{method:"POST",body:JSON.stringify({mode:$("#u-b2b").checked||$("#u-kt").checked?"with_b2b":"only"})});
      if($("#u-kt").checked)await svApi(`/api/admin/users/${c}/accountant`,{method:"POST",body:JSON.stringify({enabled:true})})}
    const un=foldName(n).replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"")||"nv";
    DB.mutate(ME.name,"thêm nhân sự "+n,d=>d.users.push({id:uid("u_"),username:un,name:n,role:r,title:$("#u-t").value,phongBan:$("#u-pb").value,active:true,crm:c,perms:ROLE_PRESET[r].slice()}));
    toast("Đã thêm "+n+(em?". Gửi cho họ email + mật khẩu ban đầu để đăng nhập":"")+note);if(crm)await svLoadUsers();renderMain()})};
}
PAGES.nhansu=pNhanSuSV;

/* ---------- Trợ lý AI: gọi qua máy chủ ---------- */
askClaude=async function(system,user){const r=await svApi("/api/hub/ai",{method:"POST",body:JSON.stringify({system,user,model:aiCombo()})});return {text:r.text,model:r.model+" (9router)",trunc:false}};
clConnectCard=function(){return `<section class="card"><div class="card-h"><h2>Kết nối AI</h2>${pill("Chạy trên máy chủ","grn")}</div><p class="hint">Máy chủ gọi 9router trên VPS (gói tháng có sẵn). Khoá nằm trên máy chủ, trình duyệt không giữ khoá.</p>${isCeo()?`<div class="row4"><label class="field grow">Combo AI trong 9router<input id="cl-combo" value="${esc(aiCombo())}" placeholder="Combo_Content"></label></div><div class="acts"><button class="btn pri" id="cl-save">Lưu</button></div>`:""}</section>`};
bindClConnect=function(){if($("#cl-save"))$("#cl-save").onclick=()=>{try{localStorage.setItem(CL_COMBO,$("#cl-combo").value.trim()||"Combo_Content")}catch(e){}toast("Đã lưu");renderMain()}};
