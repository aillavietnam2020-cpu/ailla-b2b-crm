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

// Nhiều phần cùng hỏi một địa chỉ (GET) trong lúc câu trước chưa về thì dùng chung một lượt gọi; mỗi phần tự đọc JSON
// riêng nên không đụng dữ liệu của nhau. Có thao tác ghi (POST/PUT/...) thì bỏ hết lượt đang chờ để lần đọc sau lấy số mới.
const SV_INFL=new Map();
async function svApi(path,opt={}){
  const get=!opt.method||opt.method==="GET",share=get&&Object.keys(opt).every(k=>k==="method");
  if(!get)SV_INFL.clear();
  let p=share?SV_INFL.get(path):null;
  if(!p){
    // Dữ liệu lúc mở trang đã được hỏi sẵn ngay đầu trang (xem hub/build.mjs, SVPRE), dùng lại một lần.
    const pre=share&&window.SVPRE&&SVPRE[path];if(pre)delete SVPRE[path];
    p=(pre||fetch(path,{credentials:"same-origin",...opt,headers:{"Content-Type":"application/json",...(opt.headers||{})}})).then(async r=>({status:r.status,ok:r.ok,text:await r.text()}));
    if(share){SV_INFL.set(path,p);p.then(()=>{},()=>{}).then(()=>{if(SV_INFL.get(path)===p)SV_INFL.delete(path)})}
  }
  const r=await p;
  if(r.status===401){location.href="/?next="+encodeURIComponent(location.pathname);throw new Error("Chưa đăng nhập")}
  let j={};try{j=JSON.parse(r.text)}catch(e){}
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
      try{const r=await svApi("/api/hub/state",{method:"PUT",body:JSON.stringify({version:SV.version,data:DB.data,hr:!!SV.hrOk})});SV.version=r.version;SV.pending.splice(0,n);svSyncDot("ok");break}
      catch(e){
        if(e.status!==409||tries>=4)throw e;
        // Có người vừa sửa trước: lấy bản mới, áp lại các thao tác của mình rồi ghi lại.
        const st=await svApi("/api/hub/state");SV.hrOk=!!(st&&st.hr_ok);const d=ensureShape(st.data);
        for(const f of SV.pending){try{f(d)}catch(err){console.warn("[hub] áp lại thao tác lỗi",err)}}
        DB.data=d;SV.version=st.version;svRefreshMe();
      }
    }
  }catch(e){svSyncDot("err");toast("Chưa lưu được lên máy chủ ("+e.message+"). Đang thử lại…");setTimeout(svFlush,5000)}
  finally{SV.busy=false;if(SV.pending.length)svSchedule()}
}
function svRefreshMe(){if(!ME)return;const u=D().users.find(x=>x.id===ME.id);if(u)ME=u}
/* Đang nhập dở (chị Hoa 07/11: Thảo đang lập phiếu, có người khác lưu là web vẽ lại, mất phiếu).
   Ngoài ô đang trỏ chuột, còn tính: ô đã gõ/chọn mà chưa lưu (ô còn trên trang), và khung nhập đang mở (ngăn bên phải, hộp nổi).
   Ô tìm kiếm/lọc không tính. Lưu xong trang tự vẽ lại → ô cũ biến mất → hết "dở", số mới hiện ngay sau đó. */
const SVD={els:new Set()};
const svIsFind=t=>t.id==="qs"||t.type==="search"||/(^|[-_])(q|search|tim|loc)$/i.test(t.id||"")||/tìm|lọc|search/i.test(t.placeholder||"");
if(typeof document!=="undefined"){const mark=e=>{const t=e.target;if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&t.type!=="file"&&!svIsFind(t))SVD.els.add(t)};
  document.addEventListener("input",mark,true);document.addEventListener("change",mark,true);
  /* Chọn hàng bằng nút/ô gợi ý không phát sự kiện nhập (07/11 Thảo vẫn mất phiếu): đang thao tác trong 2 phút gần nhất ở trang có ô nhập thì cũng coi là dở. */
  const act=e=>{const t=e.target;if(t&&t.closest&&t.closest("#main,#drawer,[id$='-modal-root'],dialog"))SVD.act=Date.now()};
  document.addEventListener("pointerdown",act,true);document.addEventListener("keydown",act,true)}
function svDirty(){for(const el of SVD.els)if(!el.isConnected)SVD.els.delete(el);if(SVD.els.size)return true;
  const dr=document.getElementById("drawer");if(dr&&!dr.hidden&&!(typeof OPENED!=="undefined"&&OPENED)&&dr.querySelector("input:not([type=search]),textarea,select"))return true;
  if([...document.querySelectorAll('[id$="-modal-root"],dialog[open]')].some(r=>r.querySelector("input,textarea,select")))return true;
  return Date.now()-(SVD.act||0)<120000&&!!document.querySelector("#main input:not([type=search]):not([type=checkbox]):not([type=radio]),#main textarea,#main select,#drawer:not([hidden]) input")}
const svTyping=()=>{const a=document.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.id!=="qs")||svDirty()};
// Đang thao tác thì 5 giây hỏi một lần; để máy không đụng tới quá 2 phút thì 30 giây (đỡ tốn lượt gọi máy chủ).
let svActive=Date.now(),svLastPoll=0;["mousemove","keydown","touchstart","scroll"].forEach(e=>addEventListener(e,()=>{svActive=Date.now()},{passive:true}));
async function svPoll(){
  try{
    // Lúc nãy hoãn vẽ lại vì đang nhập dở; giờ đã lưu/đóng phiếu thì vẽ lại để thấy số mới.
    if(SV.deferRemote&&!svTyping()&&DB.data&&typeof onRemoteChange==="function"){SV.deferRemote=false;onRemoteChange()}
    // Đang ở tab khác / thu nhỏ: một phút hỏi một lần để vẫn báo kịp (thông báo của Windows, thongbao.js).
    if(SV.busy||SV.pending.length||(document.hidden&&Date.now()-svLastPoll<60000))return;
    if(Date.now()-svActive>120000&&Date.now()-svLastPoll<30000)return;svLastPoll=Date.now();
    const v=await svApi("/api/hub/state/version");
    if(v.version>SV.version){
      if(svTyping()){SV.deferRemote=true;return}
      const st=await svApi("/api/hub/state");SV.hrOk=!!(st&&st.hr_ok);
      if(SV.pending.length)return;
      const before=svWatch();DB.data=ensureShape(st.data);if(DB.data.sx)delete DB.data.sx;SV.version=st.version;SV.deferRemote=false;onRemoteChange();svNotify(before,svWatch());
    }
    // Sản xuất có phiên bản riêng: có người vừa sửa phiếu sản xuất / lô thì tải bản mới.
    if(v.sx_version>SXS.version&&!SXS.busy&&!SXS.pending.length){
      if(svTyping()){SV.deferRemote=true;return}
      const sx=await svApi("/api/hub/sx");
      if(!SXS.pending.length&&sx.data){const before=svWatch();SXS.data=sx.data;SXS.version=sx.version;SV.deferRemote=false;onRemoteChange();svNotify(before,svWatch())}
    }
  }catch(e){}
}

/* Báo ngay việc mới đến tay mình (xưởng báo xong → kế toán; nhu cầu mới → xưởng; lô đã kiểm → người in tem). */
function svWatch(){const s=(typeof SX==="function"&&SX())||{batches:[],requests:[]};return {kiem:s.batches.filter(b=>b.st==="CHO_KIEM").map(b=>b.id),req:s.requests.filter(r=>r.st==="CAN_LAM").map(r=>r.id),tem:s.batches.filter(b=>b.st==="DA_KIEM"||b.st==="TEM_SAN").map(b=>b.id),task:(D().tasks||[]).filter(t=>t.nguoi===(ME&&ME.id)&&t.st!=="done").map(t=>t.id),duyet:(D().tasks||[]).filter(t=>t.duyet===(ME&&ME.id)&&t.st==="review").map(t=>t.id+":"+(t.trinh||[]).join(",")).concat(ME&&ME.role==="admin"?(D().tasks||[]).filter(t=>(t.oanhOk||[]).length).map(t=>t.id+":ceo:"+t.oanhOk.join(",")):[])}}
function svNotify(a,b){if(!ME||!a.task)return;const neu=k=>(b[k]||[]).filter(x=>!(a[k]||[]).includes(x)),s=SX(),msg=[];
  // [loại, khóa, nội dung, mở]: thongbao.js hiện ở góc dưới phải, không báo trùng; thiếu file đó thì báo bằng toast như cũ.
  const ot=id=>()=>{if(typeof openTask==="function")openTask(id)};
  if(can(ME,"sx.kiemke"))neu("kiem").forEach(id=>{const x=s.batches.find(y=>y.id===id);if(x)msg.push(["giao","sxk:"+id,`Xưởng vừa báo xong ${sxP(x.sp).ten}: ${nf(x.baoSL)} · chờ kiểm kê`])});
  if(can(ME,"sx.xuong"))neu("req").forEach(id=>{const x=s.requests.find(y=>y.id===id);if(x)msg.push(["giao","sxr:"+id,`Nhu cầu sản xuất mới: ${sxP(x.sp).ten}${x.sl?" · "+nf(x.sl):""}${x.uu==="Gấp"?" · GẤP":""}`])});
  neu("task").forEach(id=>{const t=D().tasks.find(y=>y.id===id);if(t)msg.push(["giao","task:"+id,"Việc mới giao cho bạn: "+t.ten,ot(id)])});
  neu("duyet").forEach(k=>{const t=D().tasks.find(y=>y.id===k.split(":")[0]);if(t)msg.push(["duyet","tdu:"+k,"Có video trình bạn duyệt: "+t.ten,ot(t.id)])});
  if(!msg.length)return;
  if(typeof ntPush==="function"){msg.forEach(([type,key,text,go])=>ntPush({key,type,text,go}));return}
  toast(msg.map(x=>x[2]).join(" · "))}
DB.load=async function(){
  // Bản chung và Sản xuất không phụ thuộc tài khoản: hỏi luôn cùng lúc, không đợi /api/me và số nạp sẵn xong mới hỏi.
  const stP=svApi("/api/hub/state"),sxP=svApi("/api/hub/sx");stP.catch(()=>{});sxP.catch(()=>{});
  const me=await svApi("/api/me");SV.me=me.user;SV.perms=me.permissions||[];SV.agentChat=me.agent_chat||[];
  const blob=k=>svApi("/api/hub/blob/"+k).catch(()=>null);
  const acct=isCeo()||SV.perms.includes("debt.read.all");
  SV.acct=acct;
  // CEO + kế toán nhận đủ số kinh doanh; người khác chỉ nhận số Ads (team Digital) và chỉ số bán hàng (Sale).
  const [t9,t9b,kdFull,kdAds,kdSale,sc,ns]=await Promise.all([blob("t9file"),blob("t9"),acct?blob("kd"):null,acct?null:blob("kd_ads"),acct?null:blob("kd_sale"),acct?blob("skucost"):null,isCeo()?blob("nhansu0"):null]);
  const kd=kdFull||(kdAds||kdSale?{...KDX,...(kdAds||{}),...(kdSale||{}),day:{tts:{},spe:{},fb:(kdSale&&kdSale.day&&kdSale.day.fb)||{},ads:(kdAds&&kdAds.day&&kdAds.day.ads)||{}}}:null);
  if(SV.perms.includes("dashboard.ceo"))svApi("/api/dashboards/ceo").then(c=>{CRM_BASE.noChinhThuc=c.official_debt||0;CRM_BASE.noDuKien=c.projected_debt||0;if(ME&&PAGE==="exec")renderMain()}).catch(()=>{});
  if(t9)window.T9FILE=t9;if(t9b){T9_BASE=t9b.base||{};T9RAW=t9b.raw||T9RAW}if(kd){KD=kd;KDX=kd;DAYD=kd.day||DAYD;TT=kd.tts||null;SP=kd.spe||null}if(sc)SKUCOST=sc;if(ns)NHANSU0=ns;
  const st=await stP;SV.hrOk=!!(st&&st.hr_ok);
  if(!st.data){
    if(!isCeo()){this.data=null;return}
    const d=ensureShape(seedData());d.users.forEach(u=>{delete u.pw});
    const ad=d.users.find(u=>u.role==="admin");if(ad)ad.crm=SV.me.id;
    const r=await svApi("/api/hub/state",{method:"PUT",body:JSON.stringify({version:0,data:d})});
    this.data=d;SV.version=r.version;
  }else{this.data=ensureShape(st.data);SV.version=st.version}
  // Sản xuất có ngăn riêng: tải riêng; bản chung không còn mang d.sx.
  try{const sx=await sxP;SXS.data=sx.data;SXS.version=sx.version}catch(e){SXS.data=null;SXS.version=0}
  if(this.data&&this.data.sx)delete this.data.sx;
  // Gắn tài khoản CRM với người dùng trong khu Marketing.
  let u=this.data.users.find(x=>x.crm===SV.me.id&&x.active);
  if(!u&&isCeo())u=this.data.users.find(x=>x.role==="admin"&&!x.crm);
  if(!u){const f=foldName(SV.me.display_name);u=this.data.users.find(x=>x.active&&!x.crm&&x.name&&(foldName(x.name)===f||f.endsWith(" "+foldName(x.name))))}
  if(u&&u.crm!==SV.me.id){const id=u.id;this.mutate("Hệ thống","gắn tài khoản đăng nhập "+SV.me.display_name+" → "+u.name,d=>{d.users.find(x=>x.id===id).crm=SV.me.id})}
  ME=u?this.data.users.find(x=>x.id===u.id):null;
  // Mỗi lần mở Hub đều bắt đầu ở trang chủ (Tổng quan điều hành), không mở lại trang lần trước.
  // CEO vào Tổng quan điều hành; nhân viên vào Tổng quan công việc (việc của mình, việc được giao).
  MOD=ME&&ME.role!=="admin"?"cv":"";PAGE=ME&&ME.role!=="admin"?"cv_v":"";if(/^#lo=/.test(location.hash)){MOD="sx";PAGE="sx_lo"}try{localStorage.removeItem(SKEY+"_m");localStorage.removeItem(SKEY+"_p")}catch(e){}if(typeof restoreView==="function")restoreView();{const gm=/^#go=([A-Za-z0-9_]+)/.exec(location.hash);if(gm){MOD="";PAGE=gm[1];try{history.replaceState(null,"",location.pathname+location.search)}catch(e){}}}{const cm=/^#crm=(.+)$/.exec(location.hash);if(cm){let pth="";try{pth=decodeURIComponent(cm[1])}catch(e){}const pre=[["/admin/orders/","cr_dn"],["/admin/customers/","cr_kh"]].find(x=>pth.startsWith(x[0]));if(pre&&!/[<>"'\s]/.test(pth)){CRM_SRC[pre[1]]=pth;MOD="";PAGE=pre[1]}try{history.replaceState(null,"",location.pathname+location.search)}catch(e){}}} // F5: tab đang mở giữ nguyên trang đang làm
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
function pillarTuyen(d,p){return (d.tuyen||[]).filter(t=>t.kenh===p.kenh&&t.sku===p.sku)}
function syncPillars(d){(d.pillars||[]).forEach(p=>{const T=pillarTuyen(d,p);if(T.length)p.kh=T.reduce((a,t)=>a+(+t.kh||0),0)})}
DB.mutate=function(who,msg,fn){
  const act=d=>{fn(d);syncPillars(d);d.activity.unshift({t:nowHM(),d:today(),who,msg});d.activity=d.activity.slice(0,400);d.updatedAt=Date.now()};
  act(this.data);SV.pending.push(act);svSchedule();
};
DB.reset=async function(){toast("Bản trên máy chủ không xoá về dữ liệu mẫu được.")};

/* ---------- Khung giao diện ---------- */
function renderLogin(){
  const msg=!DB.data?"Khu Marketing chưa được khởi tạo. Nhờ CEO mở trang này một lần để tạo dữ liệu ban đầu."
    :`Tài khoản <b>${esc(SV.me?SV.me.display_name:"")}</b> chưa được gắn với nhân sự nào trong khu Marketing. Nhờ CEO vào <b>Cài đặt › Tài khoản & phân quyền</b> để gắn.`;
  $("#app").innerHTML=`<div class="loginwrap"><div class="login"><img src="data:image/png;base64,${LOGO}" alt="Ailla" class="llogo"><h1>Trang quản trị Ailla</h1><p>${msg}</p><div class="acts">${SV.perms.includes("price.read")?`<a class="btn" href="/admin">Mở CRM Kênh phân phối</a>`:""}<button class="btn" id="svout">Đăng xuất</button></div></div></div>`;
  $("#svout").onclick=svLogout;
}
async function svLogout(){try{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"})}catch(e){}location.href="/"}

// CRM Kênh phân phối thật là phân hệ riêng (/admin, /sales), thay cho bản CRM giả lập trong khung.
// Lương, phiếu lương và file HR MASTER KHÔNG đưa lên đây: dữ liệu Hub là một bản chung,
// ai có tài khoản Hub cũng tải được, nên số lương phải ở chỗ phân quyền riêng (làm sau).
{const i=MODULES.findIndex(m=>m.k==="b2b");if(i>=0)MODULES.splice(i,1)}
{const hr=MODULES.find(m=>m.k==="hr");if(hr){const g0=hr.groups;hr.groups=()=>SV.hrOk?g0():g0().filter(([g])=>g!=="Lương"&&g!=="Dữ liệu")}}
{const i=MENU_USER.findIndex(g=>g[0]==="Nhân sự của tôi");if(i>=0)MENU_USER[i]=[MENU_USER[i][0],MENU_USER[i][1].filter(it=>it[0]!=="hr_plme")]}
/* CRM Kênh phân phối nằm ngay trong khung này (không mở tab mới): mỗi mục menu là một trang CRM hiện trong khung, CRM tự ẩn menu và nút đăng xuất của nó. */
const crmRole=()=>(SV.me&&SV.me.role)||"";
const CRM_EMB=[
 ["cr_rp","Dashboard kinh doanh","/admin/reports",()=>crmRole()!=="EMPLOYEE"],
 ["cr_kh","Khách hàng","/admin/customers",()=>crmRole()!=="EMPLOYEE"],
 ["cr_dn","Đơn hàng & duyệt","/admin/orders",()=>crmRole()!=="EMPLOYEE"],
 ["cr_cn","Công nợ","/admin/debts",()=>crmRole()!=="EMPLOYEE"],
 ["cr_bill","Kho bill giao dịch","/admin/bills",()=>crmRole()!=="EMPLOYEE"],
 ["cr_ret","Hàng trả lại","/admin/returns",()=>crmRole()!=="EMPLOYEE"],
 ["cr_thuong","Thưởng & xếp hạng NPP","/admin/bonus",()=>crmRole()!=="EMPLOYEE"],
 ["cr_vc","Phiếu chi vận chuyển","/admin/shipping-vouchers",()=>crmRole()!=="EMPLOYEE"],
 ["cr_gia","Sản phẩm & bảng giá","/admin/prices",()=>crmRole()!=="EMPLOYEE"],
 ["cr_dc","Giá điều chỉnh / khuyến mại","/admin/price-adjustments",()=>crmRole()!=="EMPLOYEE"],
 ["cr_im","Import dữ liệu","/admin/imports",()=>crmRole()!=="EMPLOYEE"&&SV.perms.includes("import.read")],
 ["cr_s_hn","Việc hôm nay","/sales",()=>crmRole()==="EMPLOYEE"],
 ["cr_s_kh","Khách hàng của tôi","/sales/customers",()=>crmRole()==="EMPLOYEE"],
 ["cr_s_dn","Đơn hàng","/sales/orders",()=>crmRole()==="EMPLOYEE"],
 ["cr_s_gia","Bảng giá 8 cấp","/sales/prices",()=>crmRole()==="EMPLOYEE"],
 ["cr_s_cn","Công nợ khách của tôi","/sales/debts",()=>crmRole()==="EMPLOYEE"],
 ["cr_s_bill","Kho bill giao dịch","/sales/bills",()=>crmRole()==="EMPLOYEE"&&(SV.perms.includes("order.accounting.confirm")||SV.perms.includes("order.payment.record"))],
 ["cr_s_ret","Hàng trả lại","/sales/returns",()=>crmRole()==="EMPLOYEE"],
 ["cr_s_vc","Phiếu chi vận chuyển","/sales/shipping-vouchers",()=>crmRole()==="EMPLOYEE"&&SV.perms.includes("order.accounting.confirm")],
 ["cr_s_kq","Kết quả cá nhân","/sales/performance",()=>crmRole()==="EMPLOYEE"]];
/* Kế toán (loại tài khoản "nhân viên" + gói quyền kế toán, xem được toàn công ty): menu gọi đúng tên, không "của tôi". */
const ACC_NAMES=()=>crmRole()==="EMPLOYEE"&&SV.perms.includes("debt.read.all")?{cr_s_kh:"Khách hàng",cr_s_cn:"Công nợ",cr_s_dn:"Đơn hàng"}:{};
const CRM_GROUPS=()=>{const L=CRM_EMB.filter(x=>x[3]()&&(x[0]!=="cr_gia"||(HOST_MODE==="ops"&&ADMIN_URL))&&x[0]!=="cr_dc").map(([k,t])=>MI(k,ACC_NAMES()[k]||t,()=>SV.perms.includes("price.read")));return crmRole()==="EMPLOYEE"?[["",L]]:[["Điều hành",L.filter(i=>i[0]!=="cr_im")],["Thiết lập",L.filter(i=>i[0]==="cr_im")]].filter(g=>g[1].length)};
MODULES.splice(MODULES.findIndex(m=>m.k==="mkt"),0,{k:"b2blink",zone:"Bán hàng",ic:"box",n:"Kênh phân phối",sub:"Đại lý · NPP",groups:CRM_GROUPS});
const CRM_SRC={};
CRM_EMB.forEach(([k,t,p])=>{PAGES[k]=m=>{m.innerHTML=H(t,"Khách sỉ, đại lý, đơn hàng, công nợ")+'<div class="crmembed"><iframe id="crmfr" src="'+esc(CRM_SRC[k]||p)+'" title="'+esc(t)+'"></iframe></div>'}});
/* Bảng giá riêng từng khách gia công: nằm ở Cài đặt › Danh mục, nhúng trang CRM tương ứng. */
PAGES.cr_giagc=m=>{m.innerHTML=H("Bảng giá riêng từng khách","Mỗi khách cần giá riêng (gia công, NPP) một bảng giá · nhập từng mã hoặc tải file Excel")+'<div class="crmembed"><iframe id="crmfr" src="/admin/customer-prices" title="Bảng giá riêng từng khách"></iframe></div>'};
{const s=MODULES.find(m=>m.k==="setup");if(s){const g0=s.groups;s.groups=()=>{const G=g0();const dm=G.find(g=>g[0]==="Danh mục");if(dm)dm[1].push(MI("cr_giagc","Bảng giá riêng từng khách",u=>can(u,"sanpham.quanly")&&crmRole()!=="EMPLOYEE"));if(dm)dm[1].push(MI("kho_boc","Định mức & giá thành sản phẩm",u=>crmRole()!=="EMPLOYEE"));if(dm)dm[1].push(MI("kho_vo","Vỏ can, chai & thùng",u=>crmRole()!=="EMPLOYEE"));return G}}}
/* Trang quản trị chỉ có Tài chính + Cài đặt, nên các việc CRM / kho của chị Hoa đặt thêm ở Cài đặt cho khỏi đi vòng:
   nhập Sheet CRM, hàng trả lại, số bán TikTok - Shopee trừ kho. */
/* Kho bill giao dịch: việc đối chiếu của kế toán, chuyển khỏi menu vận hành (sale gửi bill ngay trong đơn / nút Thu tiền). */
PAGES.cr_bill=m=>{m.innerHTML=H("Kho bill giao dịch","Ảnh bill tiền về, lịch sử giao dịch, báo cáo tháng để kế toán đối chiếu")+'<div class="crmembed"><iframe id="crmfr" src="/admin/bills" title="Kho bill giao dịch"></iframe></div>'};
PAGES.cr_rcv=m=>{m.innerHTML=H("Tài khoản nhận tiền","Tài khoản ngân hàng hợp lệ của công ty để sale chọn khi ghi tiền chuyển khoản")+'<div class="crmembed"><iframe id="crmfr" src="/admin/receiving-accounts" title="Tài khoản nhận tiền"></iframe></div>'};
PAGES.cr_import=m=>{m.innerHTML=H("Nhập dữ liệu CRM Kênh phân phối","Tải file Sheet CRM lên: kiểm tra trước, rồi mới ghi vào hệ thống")+'<div class="crmembed"><iframe id="crmfr" src="/admin/imports" title="Nhập dữ liệu CRM Kênh phân phối"></iframe></div>'};
{const s=MODULES.find(m=>m.k==="setup");if(s){const g0=s.groups;s.groups=()=>{const G=g0();G.push(["Dữ liệu CRM",[MI("cr_import","Nhập dữ liệu CRM Kênh phân phối",u=>(u.role==="admin"||can(u,"caidat.quanly"))&&crmRole()!=="EMPLOYEE"),MI("cr_bill","Kho bill giao dịch",u=>(u.role==="admin"||can(u,"caidat.quanly")||SV.perms.includes("order.accounting.confirm"))&&crmRole()!=="EMPLOYEE"),MI("cr_rcv","Tài khoản nhận tiền",u=>(u.role==="admin"||can(u,"caidat.quanly")||SV.perms.includes("order.approve.normal")||SV.perms.includes("order.accounting.confirm"))&&crmRole()!=="EMPLOYEE")]]);return G}}}
/* Agent AI: tài khoản + khóa riêng cho agent (chỉ CEO). Agent chỉ đọc và ghi ĐỀ XUẤT qua /api/agent, không tự đổi dữ liệu. */
let SV_AGENTS=null,SV_AGENT_TOKEN=null;
/* Phạm vi đọc của agent theo vai (khớp AGENT_SCOPES ở máy chủ). Chị tích/bỏ tích rồi bấm Lưu. */
/* Trang Quyền agent (chị Hoa duyệt demo 08/11): mỗi agent một khung gọn, mở ra chọn Vị trí → 3 mục Xem được gì / Làm được gì / Ai ra lệnh → một nút Lưu.
   Quyền ghi chỉ dùng khi người ở mục "Ai ra lệnh" vừa ra lệnh, không vượt quyền của chính người đó. Không agent nào được xóa dữ liệu. */
const AG_READ=[
  ["Bán hàng (Kênh phân phối, OEM)",[["cskh_b2b","Đơn, khách sỉ, công nợ, bảng giá, thưởng","Chỉ Kênh phân phối và Kênh OEM"],["orders","Tất cả đơn hàng","Kèm tiền, trạng thái kế toán"],["debts","Khách và công nợ toàn công ty",""]]],
  ["Kho và sản xuất",[["orders_kho","Đơn đang chờ kho","Không thấy tiền"],["kho","Tồn kho, hóa chất, pha chế",""]]],
  ["Marketing",[["mkt_content","Việc team Content",""],["mkt_digital","Việc team Digital, số quảng cáo",""],["xuong","Công xưởng sản xuất video",""]]],
  ["TikTok",[["baocao_san","Nạp báo cáo sàn TikTok",""],["doc_tiktok","Xem số TikTok đã nạp","Chỉ xem"]]]];
const AG_WRITE=[
  ["Việc thường ngày",[["agent.w.order","Lập đơn nháp","Tính giá, tạo đơn ở trạng thái nháp"],["agent.w.submit","Gửi đơn đi duyệt",""],["agent.propose","Ghi đề xuất","Người có quyền bấm duyệt mới thành việc"]]],
  ["⚠ Cẩn thận (đụng tiền, sửa/hủy đơn, kho)",[["agent.w.order_edit","Sửa đơn, chuyển bước, hủy đơn",""],["agent.w.payment","Ghi tiền khách trả",""],["agent.w.kho","Mua hàng, phiếu kho, vật tư",""],["agent.phieuchi","Lập phiếu chi",""]],1]];
const AG_CAREFUL=["agent.w.order_edit","agent.w.payment","agent.w.kho","agent.phieuchi"];
const AG_SHORT={cskh_b2b:"đơn, khách, giá, thưởng (B2B)",orders:"đơn hàng",debts:"công nợ",orders_kho:"đơn chờ kho",kho:"kho",mkt_content:"Content",mkt_digital:"Digital",xuong:"công xưởng",baocao_san:"nạp TikTok",doc_tiktok:"số TikTok",
  "agent.w.order":"lập đơn nháp","agent.w.submit":"gửi duyệt","agent.propose":"đề xuất","agent.w.order_edit":"sửa/hủy đơn","agent.w.payment":"ghi tiền","agent.w.kho":"phiếu kho","agent.phieuchi":"phiếu chi"};
const AG_TPL={"CSKH B2B":{r:["cskh_b2b"],w:["agent.w.order","agent.w.submit","agent.propose"]},"Sale B2B / Lead Sale":{r:["orders","debts"],w:["agent.w.order","agent.w.submit","agent.propose"]},"Kế toán":{r:["orders","debts"],w:["agent.w.order","agent.w.submit","agent.propose","agent.w.payment","agent.w.kho","agent.phieuchi"]},"Kế toán kho":{r:["orders_kho","kho"],w:["agent.propose","agent.w.kho"]},"Kỹ thuật sản xuất":{r:["kho"],w:["agent.propose"]},"Content / Media":{r:["mkt_content","xuong"],w:["agent.propose"]},"Digital / Ads":{r:["mkt_digital"],w:["agent.propose"]},"TikTok shop":{r:["baocao_san","doc_tiktok"],w:[]},"Chỉ xem, không làm gì":{r:[],w:[]}};
const agSame=(x,y)=>x.length===y.length&&x.every(v=>y.includes(v));
/* Vị trí của agent: trùng đúng bộ quyền của mẫu nào thì là mẫu đó, không thì "Tự chọn". */
const agRoleOf=(r,w)=>Object.keys(AG_TPL).find(k=>agSame(AG_TPL[k].r,r)&&agSame(AG_TPL[k].w,w))||"";
let SV_AGDEL=[];
function svLoadAgents(){return Promise.all([svApi("/api/admin/agents"),svApi("/api/admin/agents/delegator-candidates").catch(()=>[])]).then(([r,d])=>{SV_AGENTS=r||[];SV_AGDEL=d||[];if(PAGE==="agents")renderMain()}).catch(()=>{SV_AGENTS=SV_AGENTS||[]})}
let AGV={open:null,tab:"r",d:null,s:null,q:"",pq:"",tgEdit:null,just:false};
const agRoleName=r=>({CEO:"CEO",MANAGER:"Quản lý",EMPLOYEE:"Nhân viên",ACCOUNTANT:"Kế toán",ADMIN:"Quản trị"})[r]||r||"";
const agPerson=id=>SV_AGDEL.find(u=>u.id===id)||{id,display_name:id,role:""};
const agTg=(a,id)=>(a.delegator_tg||{})[id]||agPerson(id).telegram_id||"";
const agLegacy=a=>+a.can_act&&!(a.writes||[]).some(x=>x.startsWith("agent.w."));
function agSummary(a){const r=a.scopes||[],w=a.writes||[];const nw=w.filter(k=>k!=="agent.propose");return `Xem: ${r.length?r.map(k=>AG_SHORT[k]||k).join(", "):"chưa xem được gì"} · Làm: ${agLegacy(a)?"theo cách cũ (mọi mục cho phép)":w.length?(nw.length?nw.map(k=>AG_SHORT[k]||k).join(", "):"chỉ đề xuất"):"không làm gì"}`}
function agPills(a){const o=[],role=agRoleOf(a.scopes||[],a.writes||[]);if(role)o.push(pill(role,"blu"));if(a.status!=="ACTIVE")o.push(pill("Đã khóa","red"));const care=(a.writes||[]).filter(k=>AG_CAREFUL.includes(k)).length;if(care)o.push(pill("⚠ "+care+" quyền cẩn thận","red"));const by=a.delegator_ids||[];if(by.length){const n=by.filter(id=>agTg(a,id)).length;o.push(pill("Ra lệnh: "+by.map(id=>agPerson(id).display_name).join(", "),"gry"),pill("Telegram "+n+"/"+by.length,n===by.length?"grn":"amb"))}else o.push(pill("Chưa ai ra lệnh","gry"));return o.join(" ")}
const agDirty=()=>{const d=AGV.d,s=AGV.s;return !!(d&&s&&(!agSame(d.r,s.r)||!agSame(d.w,s.w)||!agSame(d.by,s.by)||Object.keys(d.tg).length))};
function agDiff(d){const t=AG_TPL[d.role];if(!t)return `<span class="hint">Tự chọn từng quyền.</span>`;const add=[...d.r.filter(k=>!t.r.includes(k)),...d.w.filter(k=>!t.w.includes(k))],rem=[...t.r.filter(k=>!d.r.includes(k)),...t.w.filter(k=>!d.w.includes(k))];if(!add.length&&!rem.length)return `<span class="hint">Đúng như mẫu vị trí.</span>`;return pill("Khác mẫu: "+[add.length?"thêm "+add.map(k=>AG_SHORT[k]||k).join(", "):"",rem.length?"bỏ "+rem.map(k=>AG_SHORT[k]||k).join(", "):""].filter(Boolean).join("; "),"amb")}
function agChecks(groups,key,a){const d=AGV.d;return (key==="w"&&agLegacy(a)?`<div class="note warn">Agent này đang theo cách cũ: khi được ra lệnh thì ghi được mọi mục cho phép (kho, đơn, tiền). Tick đúng quyền cần rồi bấm Lưu để giới hạn.</div>`:"")+groups.map(([title,items,careful])=>`<div class="${careful?"note warn":""}" style="${careful?"":"margin-bottom:10px"}"><div class="hint" style="font-weight:700;margin-bottom:4px${careful?";color:inherit":""}">${title}</div>${items.map(([k,t,h])=>`<label style="display:block;padding:5px 0;cursor:pointer;font-weight:500"><input type="checkbox" data-agk="${key}" value="${k}"${d[key].includes(k)?" checked":""} style="width:auto;margin:0 8px 0 0;vertical-align:middle">${t}${h?` <span class="hint" style="font-weight:400">· ${h}</span>`:""}</label>`).join("")}</div>`).join("")+(key==="w"?`<p class="hint" style="margin-top:8px">Agent chỉ làm khi người ở mục "Ai ra lệnh" vừa ra lệnh, và không vượt quyền của chính người đó. Không agent nào được xóa dữ liệu.</p>`:"")}
function agPeople(a){const d=AGV.d;if(!a.chat_agent)return `<div class="note warn">Agent này chưa gắn với agent nào trên trang Điều hành agent nên chưa chọn được người ra lệnh. Đặt tên agent trùng tên trên trang Điều hành agent.</div>`;const pq=AGV.pq;const ids=[...new Set([...SV_AGDEL.map(u=>u.id),...d.by])];const ppl=ids.map(agPerson).filter(p=>!pq||(String(p.display_name)+" "+agRoleName(p.role)).toLowerCase().includes(pq)).sort((x,y)=>(d.by.includes(y.id)-d.by.includes(x.id))||String(x.display_name).localeCompare(String(y.display_name),"vi"));
  return `<input id="agpq" placeholder="Tìm người…" value="${esc(AGV.pq)}" style="max-width:260px;margin-bottom:8px">`+tbl(["Chọn","Người","Vai trò","Telegram"],ppl.map(p=>{const on=d.by.includes(p.id);const tg=d.tg[p.id]!==undefined?d.tg[p.id]:agTg(a,p.id);return `<tr><td><input type="checkbox" style="width:auto" data-agby="${esc(p.id)}"${on?" checked":""} aria-label="Chọn ${esc(p.display_name)}"></td><td><b>${esc(p.display_name)}</b></td><td class="hint">${esc(agRoleName(p.role))}</td><td>${AGV.tgEdit===p.id?`<div style="display:flex;gap:6px;flex-wrap:wrap"><input id="agtgi" inputmode="numeric" placeholder="Dãy số Telegram" value="${esc(tg)}" style="width:150px"><button class="btn sm pri" data-agtgok="${esc(p.id)}">Xong</button></div><div class="hint">Người đó nhắn @userinfobot trên Telegram, chép dãy số vào đây.</div>`:`${tg?pill("Đã nối","grn"):pill("Chưa nối","gry")} ${on?`<button class="btn sm" data-agtg="${esc(p.id)}">${tg?"Đổi":"Nối"}</button>`:""}`}</td></tr>`}))+`<p class="hint">Chưa nối Telegram vẫn ra lệnh được ở trang Điều hành agent.</p>`}
function agCard(a){const open=AGV.open===a.id;const head=`<div data-agopen="${a.id}" role="button" tabindex="0" aria-expanded="${open}" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;cursor:pointer"><div style="flex:1;min-width:220px"><b style="font-size:15.5px">${esc(a.name)}</b><div class="hint">${esc(agSummary(a))}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap">${agPills(a)}</div><span class="hint">${open?"▲":"▼"}</span></div>`;
  if(!open)return `<section class="card" style="padding:12px 18px;margin-bottom:8px">${head}</section>`;
  const d=AGV.d,dirty=agDirty();
  return `<section class="card" style="margin-bottom:8px;border-color:var(--pink)">${head}
  <div class="note" style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>Vị trí</b><select id="agrole" style="max-width:240px">${Object.keys(AG_TPL).map(k=>`<option${d.role===k?" selected":""}>${k}</option>`).join("")}<option value=""${!d.role?" selected":""}>Tự chọn</option></select>${agDiff(d)}</div>
  <div class="tabs">${[["r","Xem được gì",d.r.length],["w","Làm được gì",d.w.length],["by","Ai ra lệnh",d.by.length]].map(([k,t,n])=>`<button type="button" class="${AGV.tab===k?"on":""}" data-agtab="${k}">${t}<span>${n}</span></button>`).join("")}</div>
  <div>${AGV.tab==="r"?agChecks(AG_READ,"r",a):AGV.tab==="w"?agChecks(AG_WRITE,"w",a):agPeople(a)}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line);margin-top:12px;padding-top:12px"><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${dirty?pill("● Chưa lưu","amb"):AGV.just?pill("✓ Đã lưu","grn"):""}<span class="hint">${esc(a.purpose||"")} · Khóa <code>${esc(a.token_hint)}</code> · ${a.last_used_at?"dùng lần cuối "+esc(new Date(a.last_used_at).toLocaleString("vi-VN")):"chưa dùng"}</span></span><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-agrot="${a.id}">Đổi khóa</button><button class="btn sm" data-agst="${a.id}" data-on="${a.status==="ACTIVE"?0:1}">${a.status==="ACTIVE"?"Khóa agent":"Mở lại"}</button><button class="btn" data-agclose>Đóng</button><button class="btn pri" data-agsave="${a.id}"${dirty?"":" disabled"}>Lưu</button></span></div></section>`}
function agOpen(id){if(AGV.open===id){if(agDirty()&&!confirm("Có thay đổi chưa lưu. Đóng và bỏ thay đổi?"))return;AGV.open=null;renderMain();return}
  if(AGV.open&&agDirty()&&!confirm("Agent đang mở có thay đổi chưa lưu. Bỏ thay đổi đó?"))return;
  const a=(SV_AGENTS||[]).find(x=>x.id===id);if(!a)return;const r=[...(a.scopes||[])],w=[...(a.writes||[])];
  AGV={...AGV,open:id,tab:"r",pq:"",tgEdit:null,just:false,d:{r,w,by:[...(a.delegator_ids||[])],role:agRoleOf(r,w),tg:{}}};AGV.s=JSON.parse(JSON.stringify(AGV.d));renderMain()}
PAGES.agents=m=>{
  if(SV_AGENTS===null){m.innerHTML=H("Quyền agent","Đang tải…");svLoadAgents();return}
  const tok=SV_AGENT_TOKEN?`<section class="card"><div class="card-h"><h2>Khóa của agent "${esc(SV_AGENT_TOKEN.name)}"</h2></div><p class="hint"><b>Chỉ hiện một lần.</b> Sao chép và đưa cho người cài agent; web chỉ giữ bản băm nên không xem lại được. Mất khóa thì bấm "Đổi khóa".</p><input readonly id="agtok" style="width:100%;font-family:monospace" value="${esc(SV_AGENT_TOKEN.token)}"><div class="acts"><button class="btn pri" id="agtokcp">Sao chép</button><button class="btn" id="agtokx">Tôi đã lưu, ẩn khóa</button></div></section>`:"";
  const list=(SV_AGENTS||[]).filter(a=>!AGV.q||(a.name+" "+(a.purpose||"")).toLowerCase().includes(AGV.q));
  m.innerHTML=H("Quyền agent","Agent xem được gì, làm được gì, ai được ra lệnh")+`<div class="note">Mỗi agent một khung gọn. Bấm vào khung để mở: chọn <b>Vị trí</b> để bật sẵn quyền, chỉnh ở 3 mục <b>Xem được gì</b> · <b>Làm được gì</b> · <b>Ai ra lệnh</b>, rồi bấm <b>Lưu</b>. Mọi lần đổi quyền và mọi việc agent làm đều ghi nhật ký.</div>`+tok+
  `<div class="card-h" style="margin-bottom:10px"><input id="agq" placeholder="Tìm agent…" value="${esc(AGV.q)}" style="max-width:260px"><span class="hint">${list.length} agent</span></div>`+
  (list.length?list.map(agCard).join(""):`<p class="hint">Chưa có agent nào.</p>`)+
  `<section class="card" style="margin-top:16px"><div class="card-h"><h2>Tạo agent mới</h2></div><form class="frm" id="agf"><div class="row4"><label class="field">Tên agent<input id="ag-n" placeholder="CSKH B2B" required></label><label class="field grow">Việc phụ trách<input id="ag-p" placeholder="Nhận đơn khách sỉ, trả lời khách"></label><label class="field">Vị trí<select id="ag-t"><option value="">Chỉ xem, chọn sau</option>${Object.keys(AG_TPL).map(k=>`<option>${k}</option>`).join("")}</select></label></div><p class="hint">Đặt tên trùng tên agent trên trang Điều hành agent để chọn được người ra lệnh. Tạo xong vẫn chỉnh quyền ở khung của agent.</p><div class="acts"><button class="btn pri">Tạo agent và lấy khóa</button></div></form></section>`;
  const busy=async(el,f)=>{if(el)el.disabled=true;try{await f()}catch(e){toast("Chưa được: "+e.message)}finally{if(el)el.disabled=false}};
  const keepFocus=id=>{const i=$("#"+id);if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}};
  if($("#agq"))$("#agq").oninput=e=>{AGV.q=e.target.value.trim().toLowerCase();renderMain();keepFocus("agq")};
  if($("#agpq"))$("#agpq").oninput=e=>{AGV.pq=e.target.value.trim().toLowerCase();renderMain();keepFocus("agpq")};
  m.querySelectorAll("[data-agopen]").forEach(h=>{h.onclick=()=>agOpen(h.dataset.agopen);h.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();agOpen(h.dataset.agopen)}}});
  m.querySelectorAll("[data-agtab]").forEach(b=>b.onclick=()=>{AGV.tab=b.dataset.agtab;AGV.tgEdit=null;renderMain()});
  m.querySelectorAll("[data-agk]").forEach(x=>x.onchange=()=>{const arr=AGV.d[x.dataset.agk];if(x.checked){if(!arr.includes(x.value))arr.push(x.value)}else arr.splice(arr.indexOf(x.value),1);AGV.just=false;renderMain()});
  m.querySelectorAll("[data-agby]").forEach(x=>x.onchange=()=>{const arr=AGV.d.by;if(x.checked){if(!arr.includes(x.dataset.agby))arr.push(x.dataset.agby)}else arr.splice(arr.indexOf(x.dataset.agby),1);AGV.just=false;renderMain()});
  if($("#agrole"))$("#agrole").onchange=e=>{AGV.d.role=e.target.value;const t=AG_TPL[e.target.value];if(t){AGV.d.r=[...t.r];AGV.d.w=[...t.w];toast("Đã bật sẵn quyền theo vị trí "+e.target.value+". Xem lại rồi bấm Lưu.")}AGV.just=false;renderMain()};
  m.querySelectorAll("[data-agtg]").forEach(b=>b.onclick=()=>{AGV.tgEdit=b.dataset.agtg;renderMain();keepFocus("agtgi")});
  m.querySelectorAll("[data-agtgok]").forEach(b=>b.onclick=()=>{const v=($("#agtgi")||{}).value?.trim()||"";if(v&&!/^\d{5,15}$/.test(v)){toast("Số Telegram là dãy 5–15 chữ số");return}AGV.d.tg[b.dataset.agtgok]=v;AGV.tgEdit=null;renderMain()});
  m.querySelectorAll("[data-agclose]").forEach(b=>b.onclick=()=>agOpen(AGV.open));
  m.querySelectorAll("[data-agsave]").forEach(b=>b.onclick=()=>busy(b,async()=>{const id=b.dataset.agsave,a=(SV_AGENTS||[]).find(x=>x.id===id),d=AGV.d,s=AGV.s;
    const addCare=d.w.filter(k=>AG_CAREFUL.includes(k)&&!s.w.includes(k));
    if(addCare.length&&!confirm("Agent sẽ có thêm quyền cẩn thận: "+addCare.map(k=>AG_SHORT[k]).join(", ")+". Lưu?"))return;
    if(!agSame(d.r,s.r))await svApi(`/api/admin/agents/${id}/scopes`,{method:"PUT",body:JSON.stringify({scopes:d.r})});
    if(!agSame(d.w,s.w))await svApi(`/api/admin/agents/${id}/writes`,{method:"PUT",body:JSON.stringify({writes:d.w})});
    if(!agSame(d.by,s.by)||Object.keys(d.tg).length){const telegram={};for(const u of d.by){telegram[u]=d.tg[u]!==undefined?d.tg[u]:agTg(a,u)}await svApi(`/api/admin/agents/${id}/delegators`,{method:"PUT",body:JSON.stringify({user_ids:d.by,telegram})})}
    await svLoadAgents();const a2=(SV_AGENTS||[]).find(x=>x.id===id)||a;const r=[...(a2.scopes||[])],w=[...(a2.writes||[])];
    AGV.d={r,w,by:[...(a2.delegator_ids||[])],role:agRoleOf(r,w),tg:{}};AGV.s=JSON.parse(JSON.stringify(AGV.d));AGV.just=true;renderMain();toast("Đã lưu quyền của agent "+a2.name)}));
  if($("#agf"))$("#agf").onsubmit=e=>{e.preventDefault();busy(e.submitter||$("#agf button"),async()=>{const t=AG_TPL[$("#ag-t").value];const r=await svApi("/api/admin/agents",{method:"POST",body:JSON.stringify(Object.assign({name:$("#ag-n").value.trim(),purpose:$("#ag-p").value.trim()},t?{scopes:t.r,writes:t.w,can_propose:t.w.includes("agent.propose")}:{can_propose:false,writes:[]}))});SV_AGENT_TOKEN={name:r.name,token:r.token};await svLoadAgents();agOpen(r.id);toast("Đã tạo agent. Sao chép khóa ngay, khóa chỉ hiện một lần.")})};
  m.querySelectorAll("[data-agrot]").forEach(b=>b.onclick=()=>{if(!confirm("Đổi khóa: khóa cũ hết hiệu lực ngay, agent phải được cài khóa mới. Tiếp tục?"))return;busy(b,async()=>{const r=await svApi(`/api/admin/agents/${b.dataset.agrot}/rotate`,{method:"POST",body:"{}"});const a=(SV_AGENTS||[]).find(x=>x.id===b.dataset.agrot);SV_AGENT_TOKEN={name:a?a.name:"agent",token:r.token};await svLoadAgents()})});
  m.querySelectorAll("[data-agst]").forEach(b=>b.onclick=()=>{if(b.dataset.on!=="1"&&!confirm("Khóa agent: agent ngừng vào web ngay. Tiếp tục?"))return;busy(b,async()=>{await svApi(`/api/admin/agents/${b.dataset.agst}/status`,{method:"POST",body:JSON.stringify({enabled:b.dataset.on==="1"})});await svLoadAgents();toast(b.dataset.on==="1"?"Đã mở lại agent":"Đã khóa agent")})});
  if($("#agtokcp"))$("#agtokcp").onclick=()=>{const i=$("#agtok");i.select();try{navigator.clipboard.writeText(i.value);toast("Đã sao chép")}catch(e){document.execCommand("copy");toast("Đã sao chép")}};
  if($("#agtokx"))$("#agtokx").onclick=()=>{SV_AGENT_TOKEN=null;renderMain()};
};
{const s=MODULES.find(m=>m.k==="setup");if(s){const g0=s.groups;s.groups=()=>{const G=g0();const hs=G.find(g=>g[0]==="Hệ thống");if(hs)hs[1].push(MI("agents","Agent AI",u=>u.role==="admin"));return G}}}
window.addEventListener("message",e=>{if(e.origin!==location.origin||!e.data||e.data.type!=="crm-title"||!$("#crmfr"))return;const h=$("#main .ph h1");if(h&&e.data.title&&e.data.title!=="AILLA B2B CRM")h.textContent=e.data.title});
/* ---------- Mỗi phòng ban chỉ thấy phân hệ của mình ----------
   Phân hệ lấy từ Cài đặt › Phòng ban (cột "Dùng phân hệ"); ai cũng có Công việc & dự án
   (giao việc, nhiệm vụ). CEO (vai trò Quản trị) thấy tất cả. */
const DEPT_MODS={SX:["sx"],KV:["sx"],HCNS:["hr"]};
function svAllowedMods(){
  if(!ME||ME.role==="admin")return null;
  // Kế toán kho (có quyền kho nhưng không phải kế toán tiền): chỉ vào Sản xuất & kho, không thấy Kênh phân phối/B2C, Tài chính.
  if(SV.perms.includes("order.kho.process")&&!SV.acct)return new Set(["cv","me","sx"]);
  const p=(D().departments||[]).find(x=>x.k===ME.phongBan),m=(p&&p.phanHe&&p.phanHe.length?p.phanHe:DEPT_MODS[ME.phongBan])||[];
  const s=new Set(["cv","me",...m]);if(s.has("mkt"))s.add("aiq");
  {const T=userTeam(ME);if(["content","koc","ads","live"].includes(T)){s.add("mkt");s.add("aiq")}}
  // Ai được cấp một quyền Sản xuất (Thảo điều phối, kế toán kho, kỹ thuật...) thì thấy phân hệ Sản xuất.
  if(["sx.dieuphoi","sx.xuong","sx.kiemke","sx.kythuat","sx.congthuc"].some(k=>can(ME,k))||ME.phongBan==="KT")s.add("sx");if(s.has("b2b")||s.has("b2c"))s.add("b2blink");
  // Ai được cấp quyền nhắn agent (Tài khoản › Quyền agent) thì thấy mục AI Agent (chị Hoa 02/11: Uyên có quyền mà không thấy menu).
  if(SV.agentChat&&SV.agentChat.length)s.add("agt");return s;
}
// Phòng được dùng phân hệ nào thì người trong phòng xem được các trang của phân hệ đó (B2C, Sản xuất,
// Tài chính, Nhân sự, Tổng quan); Marketing và Quản trị hệ thống vẫn theo quyền chi tiết từng người.
const DEPT_OPEN=["exec","b2c","sx","fin","hr"];
// Số tài chính (doanh thu tổng, giá vốn, P&L, chi phí): chỉ CEO và kế toán. Người khác ở phòng Sale chỉ thấy
// trang chỉ số bán hàng; Tổng quan điều hành và Tài chính ẩn hẳn.
const SECRET_MODS=["exec","fin"],SALE_PAGES=["fb_sale","fb_cskh"];
MODULES.forEach(mo=>{const g=mo.groups;mo.groups=()=>{const a=svAllowedMods();if(a&&!a.has(mo.k))return [];if(!SV.acct&&SECRET_MODS.includes(mo.k))return [];let G=g();if(a&&DEPT_OPEN.includes(mo.k))G=G.map(([n,its])=>[n,its.map(i=>[i[0],i[1],()=>true,i[3]])]);if(!SV.acct&&mo.k==="b2c")G=G.map(([n,its])=>[n,its.filter(i=>SALE_PAGES.includes(i[0]))]).filter(x=>x[1].length);return G}});
{const st=MODULES.find(m=>m.k==="setup");if(st){const g=st.groups;st.groups=()=>g().map(([n,its])=>[n,its.filter(i=>SV.acct||!["sku","kenhban","chiphidm"].includes(i[0]))]).filter(x=>x[1].length)}}
/* Sản phẩm & bảng giá 8 cấp của CRM Kênh phân phối là chỗ thiết lập, ít đụng tới: đặt ở Cài đặt › Danh mục, cạnh mục Sản phẩm. */
{const st=MODULES.find(m=>m.k==="setup");if(st){const g=st.groups;st.groups=()=>{const G=g();const ok=crmRole()!=="EMPLOYEE"&&SV.perms.includes("price.read");if(!ok)return G;const it=MI("cr_gia","Bảng giá Kênh phân phối (CRM)",()=>true),it2=MI("cr_dc","Giá điều chỉnh / khuyến mại",()=>true);const i=G.findIndex(x=>x[0]==="Danh mục");if(i>=0){const L=G[i][1].slice(),j=L.findIndex(x=>x[0]==="sanpham");L.splice(j>=0?j+1:L.length,0,it,it2);return G.map((x,k)=>k===i?[x[0],L]:x)}return [["Danh mục",[it]]].concat(G)}}}
/* Dòng ghi chú trên các trang số tài chính: đây là số quản trị nội bộ, sổ sách chính thức ở MISA. */
const INTERNAL_PAGES=["bc_tong","bc_tiktok","bc_shopee","bc_fb","pl","chiphi","doisoat","sku","adshieuqua","fb_ads","adssp"];
INTERNAL_PAGES.forEach(k=>{const f=PAGES[k];if(f)PAGES[k]=m=>{f(m);m.insertAdjacentHTML("afterbegin",`<div class="note internal">🔒 Số liệu <b>quản trị nội bộ</b> để điều hành (ước tính, phân bổ, so mục tiêu), không phải báo cáo tài chính. Sổ sách chính thức do Kế toán quản lý trên MISA.</div>`)}});
PAGES.crmgo=m=>{const k=SV.me&&SV.me.role==="EMPLOYEE"?"cr_s_hn":"cr_rp";PAGES[k](m)};
PAGES.matkhau=m=>{const p=SV.me&&SV.me.role!=="EMPLOYEE"?"/admin/account":"/sales/account";m.innerHTML=H("Đổi mật khẩu","Dùng chung mật khẩu với CRM")+`<section class="card narrow"><p>Mật khẩu đăng nhập dùng chung cho CRM và khu Marketing.</p><div class="acts"><a class="btn pri" href="${p}">Đổi mật khẩu</a></div></section>`};

const _pCaiDat=pCaiDat;
pCaiDat=function(m){_pCaiDat(m);["#rs","#rsm"].forEach(s=>{const e=$(s);if(e)e.remove()});const im=$("#im-j");if(im&&!isCeo())im.closest("label").remove();
  const p=[...m.querySelectorAll("p")].find(x=>/Bản thật/.test(x.textContent));if(p)p.textContent="Dữ liệu lưu chung trên máy chủ, mọi người thấy cùng một bản. Tải bản sao lưu (.json) về máy khi cần lưu trữ riêng."};
PAGES.caidat=pCaiDat;

/* Tài khoản & phân quyền: một chỗ cho CEO tự thêm/khoá nhân sự.
   Thêm nhân sự = tạo tài khoản đăng nhập + gắn phòng ban, vai trò, quyền + mở cửa vanhanh.ailla.vn cho email đó.
   Khoá = khoá tài khoản đăng nhập, đá khỏi phiên đang mở, rút email khỏi cửa vanhanh.ailla.vn. */
let SV_CRMUSERS=null,SV_ACCESS=null,SV_SHOW_OFF=false,SV_NSF={q:"",pb:"",tt:""};
/* Chị Hoa 02/11: gộp Chức vụ và Vai trò làm một. Chọn chức vụ là web tự áp vai trò (bộ quyền) bên phải. Muốn thêm chức vụ thì thêm dòng ở đây. */
const SV_CV=[["Trưởng phòng","truongphong"],["Trưởng nhóm","lead"],["Kế toán trưởng","truongphong"],["Kế toán","nhanvien"],["Kế toán kho","nhanvien"],["Nhân viên Content","content"],["Nhân viên Media","content"],["Nhân viên Ads / Digital","digital"],["Nhân viên Kinh doanh","nhanvien"],["Nhân viên CSKH","nhanvien"],["Nhân viên Kho","nhanvien"],["Kỹ thuật sản xuất","nhanvien"],["Nhân viên","nhanvien"],["Nhân viên thử việc","nhanvien"],["Thực tập sinh","nhanvien"]];
const svCvOpts=u=>{const t=(u&&u.title)||"",L=SV_CV.map(([n])=>[n,n]);if(t&&!SV_CV.some(([n])=>n===t))L.unshift([t,t+" (chức vụ cũ, chọn lại)"]);if(!t)L.unshift(["","— Chọn chức vụ —"]);return L};
function svLoadUsers(){return svApi("/api/admin/users").then(r=>{SV_CRMUSERS=r||[];if(PAGE==="nhansu")renderMain()}).catch(()=>{SV_CRMUSERS=SV_CRMUSERS||[]})}
function svAccessMsg(a){if(!a)return "";if(a.ok)return ` · đã cập nhật cửa vanhanh.ailla.vn (${a.count} email)`;return a.error==="chưa cấu hình"?" · cửa vanhanh.ailla.vn chưa nối tự động":" · cửa vanhanh.ailla.vn: "+a.error}
const SV_TEAMS=[["","Tự theo vai trò"],["content","Content"],["koc","Booking KOC"],["live","Livestream"],["ads","Digital Marketing"],["all","Xem tất cả"]];
function pNhanSuSV(m){
  const U=D().users,ed=can(ME,"nhansu.quanly"),crm=SV.perms.includes("user.manage");
  if(SV_CRMUSERS===null&&crm){SV_CRMUSERS=[];svLoadUsers()}
  if(SV_ACCESS===null&&crm){SV_ACCESS={};svApi("/api/admin/users/access-sync").then(r=>{SV_ACCESS=r||{};if(PAGE==="nhansu")renderMain()}).catch(()=>{})}
  const A=SV_CRMUSERS||[],acc=id=>A.find(a=>a.id===id);
  const used=id=>U.find(u=>u.crm===id);
  const accOpts=u=>[["","— chưa gắn"]].concat(A.filter(a=>a.id===u.crm||!used(a.id)).map(a=>[a.id,a.display_name+" · "+a.email]));
  /* Chưa có tài khoản: nút thêm email + mật khẩu (chị Hoa 02/11); có rồi thì vẫn đổi gắn được bằng ô chọn. */
  const accCell=u=>{const a=acc(u.crm);if(ed&&crm&&u.id!==ME.id&&!a&&u.active)return `<button class="btn sm" data-mkacc="${u.id}">+ Thêm email đăng nhập</button>`;if(ed&&crm&&u.id!==ME.id)return `<select data-uc="${u.id}">${opt(accOpts(u),u.crm||"")}</select>`;return a?esc(a.email):(u.crm?"(đã gắn)":"—")};
  const hubBtn=a=>crm&&!a.is_marketing&&a.role==="EMPLOYEE"&&(a.is_accountant||a.is_warehouse)?` <button class="btn sm" data-hubg="${a.id}" title="Tài khoản này chưa vào được Trang quản trị nên không thấy Kho, Bán qua sàn, Hàng hoàn">Cấp quyền vào Trang quản trị</button>`:"";
  const b2bCell=u=>{const a=acc(u.crm);if(!a)return "—";if(a.role!=="EMPLOYEE"||u.id===ME.id||a.is_accountant)return "Có"+hubBtn(a);return crm?`<label class="sw-t"><input type="checkbox" data-b2b="${a.id}" ${a.is_hub_only?"":"checked"}> ${a.is_hub_only?"Không":"Có"}</label>`:(a.is_hub_only?"Không":"Có")};
  const ktCell=u=>{const a=acc(u.crm);if(!a)return "—";if(a.role==="CEO")return "Có";return crm?`<label class="sw-t"><input type="checkbox" data-kt="${a.id}" ${a.is_accountant?"checked":""}> ${a.is_accountant?"Có":"Không"}</label>`:(a.is_accountant?"Có":"Không")};
  const khoCell=u=>{const a=acc(u.crm);if(!a)return "—";if(a.role==="CEO")return "Có";return crm?`<label class="sw-t"><input type="checkbox" data-kho="${a.id}" ${a.is_warehouse?"checked":""}> ${a.is_warehouse?"Có":"Không"}</label>`:(a.is_warehouse?"Có":"Không")};
  const gate=SV_ACCESS&&SV_ACCESS.configured;
  /* Chị Hoa 02/11: trang gọn — nút Thêm trên đầu, lọc phòng ban + trạng thái, tìm tên; quyền Kế toán / Kho / CRM để trong nút Phân quyền. */
  const F=SV_NSF,TT=[["lam","Đang làm"],["phep","Nghỉ phép"],["thaisan","Nghỉ thai sản"],["nghi","Đã nghỉ việc"]],ttOf=u=>!u.active?"nghi":(u.tt||"lam");
  const pbN=k=>(D().departments.find(p=>p.k===k)||{n:"—"}).n;
  const L=U.filter(u=>(!F.pb||u.phongBan===F.pb)&&(!F.tt||ttOf(u)===F.tt)&&(!F.q||foldName(u.name+" "+(u.title||"")).includes(foldName(F.q)))).sort((a,b)=>(ttOf(a)==="nghi")-(ttOf(b)==="nghi"));
  const cnt=k=>U.filter(u=>(!F.pb||u.phongBan===F.pb)&&(!k||ttOf(u)===k)).length;
  const ttPill=k=>({lam:pill("Đang làm","grn"),phep:pill("Nghỉ phép","amb"),thaisan:pill("Nghỉ thai sản","blu"),nghi:pill("Đã nghỉ việc","gry")})[k];
  m.innerHTML=H("Tài khoản & phân quyền","Nhân sự, tài khoản đăng nhập và quyền")+`
  <div class="filters nsf">${ed?`<button class="btn pri" id="ns-add">+ Thêm nhân sự</button>`:""}
   <input id="ns-q" placeholder="Tìm theo tên…" value="${esc(F.q)}" autocomplete="off" style="min-width:200px">
   <select id="ns-pb">${opt([["","Tất cả phòng ban"]].concat(D().departments.map(p=>[p.k,p.n])),F.pb)}</select>
   <span class="nschips">${[["","Tất cả"]].concat(TT).map(([k,n])=>`<button class="nschip${F.tt===k?" on":""}" data-nstt="${k}">${n} <small>${cnt(k)}</small></button>`).join("")}</span>
   ${crm&&gate?`<span class="sp"></span><button class="btn sm" id="acsync" title="Cập nhật danh sách email được vào vanhanh.ailla.vn">Đồng bộ cửa vào vanhanh</button>`:""}</div>
  <section class="card flush">${L.length?tbl(["Họ tên","Chức vụ","Phòng ban","Tài khoản đăng nhập","Trạng thái",""],L.map(u=>`<tr class="${ttOf(u)==="nghi"?"mut":""}"><td><b>${esc(u.name)}</b></td><td>${u.id===ME.id||!ed||u.role==="admin"?esc(u.title||ROLES[u.role]):`<select data-ucv="${u.id}">${opt(svCvOpts(u),u.title||"")}</select><br><small class="hint">quyền: ${esc(ROLES[u.role]||"")}</small>`}</td><td>${ed&&u.id!==ME.id?`<select data-upb="${u.id}">${opt([["","—"]].concat(D().departments.map(p=>[p.k,p.n])),u.phongBan||"")}</select>`:esc(pbN(u.phongBan))}</td><td>${accCell(u)}</td><td>${u.id===ME.id||!ed?ttPill(ttOf(u)):`<select data-utt="${u.id}">${opt(TT,ttOf(u))}</select>`}</td><td class="nowrap">${ed?`<button class="btn sm" data-pp="${u.id}">Phân quyền</button>`:""}${crm&&acc(u.crm)&&u.id!==ME.id?` <button class="btn sm" data-aem="${u.crm}">Đổi email</button> <button class="btn sm" data-pw="${u.crm}">Cấp lại mật khẩu</button>`:""}${ed&&!u.active&&u.id!==ME.id&&u.role!=="admin"?` <button class="btn sm danger" data-udel="${u.id}">Xóa</button>`:""}</td></tr>`)):`<p class="hint pad">Không có nhân sự nào khớp bộ lọc.</p>`}</section>
  ${crm?`<details class="card nsacc"><summary>Danh sách tài khoản đăng nhập (xóa tài khoản nhập nhầm) (${A.length} tài khoản)</summary>
   ${A.length?tbl(["Email","Tên hiển thị","Vai trò","Gắn với nhân sự",""],A.map(a=>{const p=U.find(u=>u.crm===a.id);const rl={CEO:"CEO",MANAGER:"Quản lý",EMPLOYEE:"Nhân viên"}[a.role]||a.role;return `<tr><td class="mono">${esc(a.email)}</td><td>${esc(a.display_name)}${a.status==="DISABLED"?" "+pill("Đã khóa","gry"):""}</td><td>${rl}</td><td>${p?esc(p.name):"<span class=\"hint\">chưa gắn</span>"}</td><td class="nowrap"><button class="btn sm" data-aem="${a.id}">Sửa email</button> ${a.role==="CEO"||a.id===SV.me.id?"":`<button class="btn sm" data-adel="${a.id}">Xóa</button>`}</td></tr>`})):`<p class="hint pad">Đang tải…</p>`}</details>`:""}`;
  const busy=async(el,f)=>{if(el)el.disabled=true;try{await f()}catch(e){toast("Chưa được: "+e.message);if(PAGE==="nhansu")renderMain()}finally{if(el)el.disabled=false}};
  let nsT=0;$("#ns-q").oninput=e=>{F.q=e.target.value;clearTimeout(nsT);nsT=setTimeout(()=>{renderMain();const q=$("#ns-q");if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}},250)};
  $("#ns-pb").onchange=e=>{F.pb=e.target.value;renderMain()};
  m.querySelectorAll("[data-nstt]").forEach(b=>b.onclick=()=>{F.tt=b.dataset.nstt;renderMain()});
  if($("#ns-add"))$("#ns-add").onclick=()=>{openDrawerHTML(`<h2>Thêm nhân sự</h2><p class="hint">Điền một lần: web tạo luôn tài khoản đăng nhập (email + mật khẩu), gắn phòng ban và quyền theo vai trò${gate?", mở cửa vào vanhanh.ailla.vn":""}. Lần đầu đăng nhập, nhân sự phải đổi sang mật khẩu của riêng họ.</p>
   <form class="frm" id="uf"><div class="row4"><label class="field">Họ tên<input id="u-n" required></label><label class="field">Chức vụ<select id="u-t">${opt(svCvOpts(null),"")}</select></label><label class="field">Phòng ban<select id="u-pb">${opt(D().departments.map(p=>[p.k,p.n]),F.pb||"")}</select></label></div>
   ${crm?`<div class="row4"><label class="field">Email đăng nhập<input id="u-e" type="email" placeholder="ten@gmail.com" autocomplete="off"></label><label class="field">Mật khẩu ban đầu<input id="u-p" type="text" autocomplete="off" placeholder="ít nhất 8 ký tự, có chữ và số"></label></div>
   <details><summary class="hint">Người này đã có tài khoản đăng nhập từ trước?</summary><p class="hint">Bỏ trống email, mật khẩu và chọn tài khoản ở đây: <select id="u-c">${opt([["","—"]].concat(A.filter(a=>!used(a.id)).map(a=>[a.id,a.display_name+" · "+a.email])),"")}</select></p></details>`:""}
   <p class="hint">Quyền Kế toán, Kho, vào CRM Kênh phân phối: thêm xong bấm <b>Phân quyền</b> ở dòng của người đó.</p>
   <div class="acts"><button class="btn pri" id="u-go">Thêm nhân sự</button></div></form>`);bindAdd()};
  /* Xóa hẳn một người đã khóa: chỉ khi họ chưa gắn với việc, thẻ video, lô nào (xóa sẽ làm tên trống ở các chỗ đó). Còn dính thì chỉ ẩn. */
  m.querySelectorAll("[data-udel]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.udel,u=userBy(id);if(!u)return;
    if(u.active){toast("Khóa người này (bỏ tích Đang làm) rồi mới xóa được");return}
    const rest=Object.assign({},D());delete rest.users;delete rest.activity;
    let used=false;try{used=JSON.stringify(rest).includes('"'+id+'"')||(typeof SX==="function"&&SX()&&JSON.stringify(SX()).includes('"'+id+'"'))}catch(e){used=true}
    if(used){toast(u.name+" còn xuất hiện trong thẻ video / việc / lô cũ nên chỉ ẩn được, không xóa được. Danh sách đã tự ẩn người nghỉ.");return}
    if(!confirm("Xóa hẳn "+u.name+" khỏi danh sách? Không hoàn tác được."))return;
    DB.mutate(ME.name,"xóa nhân sự đã nghỉ "+u.name,d=>{d.users=d.users.filter(x=>x.id!==id)});toast("Đã xóa "+u.name);renderMain()});
  m.querySelectorAll("[data-ucv]").forEach(s=>s.onchange=()=>{const cv=SV_CV.find(x=>x[0]===s.value);if(!cv)return;const id=s.dataset.ucv,u=userBy(id),roleDoi=u.role!==cv[1];
    DB.mutate(ME.name,`đổi chức vụ ${esc(u.name)} → ${cv[0]}`,d=>{const x=d.users.find(y=>y.id===id);x.title=cv[0];if(roleDoi){x.role=cv[1];x.perms=ROLE_PRESET[cv[1]].slice()}nsdbFromUser(d,id,["title"],hrNow().iso)});
    toast(roleDoi?"Đã đổi chức vụ, quyền áp theo "+ROLES[cv[1]]:"Đã đổi chức vụ");renderMain()});
  m.querySelectorAll("[data-ur]").forEach(s=>s.onchange=()=>{DB.mutate(ME.name,`đổi vai trò ${esc(userName(s.dataset.ur))} → ${ROLES[s.value]}`,d=>{const u=d.users.find(x=>x.id===s.dataset.ur);u.role=s.value;u.perms=ROLE_PRESET[s.value].slice()});toast("Đã đổi vai trò và áp quyền mặc định");renderMain()});
  m.querySelectorAll("[data-utm]").forEach(s=>s.onchange=()=>{DB.mutate(ME.name,`đổi team Marketing ${esc(userName(s.dataset.utm))}`,d=>{d.users.find(x=>x.id===s.dataset.utm).team=s.value});toast("Đã đổi team, người đó tải lại trang là thấy khu mới");renderMain()});
  m.querySelectorAll("[data-utl]").forEach(i=>i.onchange=()=>{DB.mutate(ME.name,`đổi chức vụ ${esc(userName(i.dataset.utl))}`,d=>{d.users.find(x=>x.id===i.dataset.utl).title=i.value.trim();nsdbFromUser(d,i.dataset.utl,["title"],hrNow().iso)});toast("Đã lưu chức vụ")});
  m.querySelectorAll("[data-upb]").forEach(s=>s.onchange=()=>{DB.mutate(ME.name,`đổi phòng ban ${esc(userName(s.dataset.upb))}`,d=>{d.users.find(x=>x.id===s.dataset.upb).phongBan=s.value;nsdbFromUser(d,s.dataset.upb,["pb"],hrNow().iso)});toast("Đã đổi phòng ban");renderMain()});
  m.querySelectorAll("[data-mkacc]").forEach(b=>b.onclick=()=>{const u=userBy(b.dataset.mkacc);if(!u)return;
    const free=A.filter(a=>!used(a.id));
    openDrawerHTML(`<h2>Email đăng nhập cho ${esc(u.name)}</h2><p class="hint">Web tạo tài khoản đăng nhập bằng email và mật khẩu này${gate?", mở luôn cửa vào vanhanh.ailla.vn":""}. Lần đầu đăng nhập họ phải đổi sang mật khẩu riêng. Gửi email + mật khẩu ban đầu cho họ.</p>
     <form class="frm" id="mka"><div class="row4"><label class="field">Email đăng nhập<input id="mka-e" type="email" required placeholder="ten@gmail.com" autocomplete="off"></label><label class="field">Mật khẩu ban đầu<input id="mka-p" type="text" autocomplete="off" placeholder="ít nhất 8 ký tự, có chữ và số"></label></div>
     ${free.length?`<details><summary class="hint">Email này đã có tài khoản từ trước?</summary><p class="hint">Chọn ở đây thay vì nhập: <select id="mka-c">${opt([["","—"]].concat(free.map(a=>[a.id,a.display_name+" · "+a.email])),"")}</select></p></details>`:""}
     <div id="mka-x"></div><div class="acts"><button class="btn pri" id="mka-go">Lưu</button></div></form>`);
    if($("#mka-c"))$("#mka-c").onchange=e=>{$("#mka-e").required=!e.target.value};
    $("#mka").onsubmit=ev=>{ev.preventDefault();busy($("#mka-go"),async()=>{
      let c=$("#mka-c")?$("#mka-c").value:"",note="";const em=$("#mka-e").value.trim(),pw=$("#mka-p").value;
      if(!c){const ex=A.find(a=>String(a.email||"").toLowerCase()===em.toLowerCase());
        if(ex){const owner=U.find(x=>x.crm===ex.id);if(owner)throw new Error(em+" đã gắn với "+owner.name);c=ex.id}
        else{if(!pw)throw new Error("nhập mật khẩu ban đầu");const res=await svApi("/api/admin/users",{method:"POST",body:JSON.stringify({email:em,display_name:u.name,role:"EMPLOYEE",password:pw})});c=res.id;note=svAccessMsg(res.access);
          await svApi(`/api/admin/users/${c}/marketing`,{method:"POST",body:JSON.stringify({mode:"only"})})}}
      DB.mutate(ME.name,"gắn tài khoản đăng nhập cho "+u.name,d=>{d.users.forEach(x=>{if(x.crm===c)x.crm=""});d.users.find(x=>x.id===u.id).crm=c});
      closeDrawer();toast("Đã thêm email đăng nhập cho "+u.name+note);await svLoadUsers();renderMain()})}});
  m.querySelectorAll("[data-uc]").forEach(s=>s.onchange=()=>{const id=s.dataset.uc,v=s.value;DB.mutate(ME.name,`gắn tài khoản đăng nhập cho ${esc(userName(id))}`,d=>{d.users.forEach(x=>{if(v&&x.crm===v)x.crm=""});d.users.find(x=>x.id===id).crm=v});toast(v?"Đã gắn tài khoản":"Đã bỏ gắn");renderMain()});
  const bindAcc=R=>{
  R.querySelectorAll("[data-b2b]").forEach(s=>s.onchange=()=>busy(s,async()=>{await svApi(`/api/admin/users/${s.dataset.b2b}/marketing`,{method:"POST",body:JSON.stringify({mode:s.checked?"with_b2b":"only"})});toast(s.checked?"Đã cho vào CRM Kênh phân phối":"Đã bỏ quyền CRM Kênh phân phối");await svLoadUsers()}));
  R.querySelectorAll("[data-hubg]").forEach(b=>b.onclick=()=>busy(b,async()=>{await svApi(`/api/admin/users/${b.dataset.hubg}/marketing`,{method:"POST",body:JSON.stringify({mode:"with_b2b"})});toast("Đã cấp quyền vào Trang quản trị. Người đó đăng nhập lại là thấy Kho, Bán qua sàn, Hàng hoàn");await svLoadUsers();renderMain()}));
  R.querySelectorAll("[data-kt]").forEach(s=>s.onchange=()=>busy(s,async()=>{await svApi(`/api/admin/users/${s.dataset.kt}/accountant`,{method:"POST",body:JSON.stringify({enabled:s.checked})});const a=acc(s.dataset.kt);if(s.checked&&a&&a.is_hub_only)await svApi(`/api/admin/users/${a.id}/marketing`,{method:"POST",body:JSON.stringify({mode:"with_b2b"})});toast(s.checked?"Đã bật quyền Kế toán (người đó tải lại trang là thấy)":"Đã tắt quyền Kế toán");await svLoadUsers()}));
  R.querySelectorAll("[data-kho]").forEach(s=>s.onchange=()=>busy(s,async()=>{await svApi(`/api/admin/users/${s.dataset.kho}/warehouse`,{method:"POST",body:JSON.stringify({enabled:s.checked})});const a=acc(s.dataset.kho);if(s.checked&&a&&a.is_hub_only)await svApi(`/api/admin/users/${a.id}/marketing`,{method:"POST",body:JSON.stringify({mode:"with_b2b"})});toast(s.checked?"Đã bật quyền Kho (người đó tải lại trang là thấy mọi đơn cần kiểm kho)":"Đã tắt quyền Kho");await svLoadUsers()}));
  };bindAcc(m);
  /* Trạng thái: "Đã nghỉ việc" = khoá tài khoản đăng nhập (như bỏ tick Đang làm trước đây); nghỉ phép / thai sản vẫn giữ tài khoản. */
  m.querySelectorAll("[data-utt]").forEach(s=>s.onchange=()=>busy(s,async()=>{const u=userBy(s.dataset.utt),a=acc(u.crm),on=s.value!=="nghi";let note="";
    if(on!==!!u.active&&a&&crm&&a.role!=="CEO"){const r=await svApi(`/api/admin/users/${a.id}`,{method:"PATCH",body:JSON.stringify({status:on?"ACTIVE":"DISABLED"})});note=svAccessMsg(r&&r.access)}
    DB.mutate(ME.name,"đổi trạng thái "+u.name+" → "+(TT.find(x=>x[0]===s.value)||[0,""])[1],d=>{const x=d.users.find(x=>x.id===u.id);x.active=on;x.tt=on&&s.value!=="lam"?s.value:"";nsdbFromUser(d,u.id,["tt"],hrNow().iso)});
    toast(s.value==="nghi"?"Đã chuyển "+u.name+" sang Đã nghỉ việc, khoá tài khoản"+note:"Đã lưu trạng thái "+u.name+note);if(a)await svLoadUsers();renderMain()}));
  m.querySelectorAll("[data-pw]").forEach(b=>b.onclick=()=>{const a=acc(b.dataset.pw);const p=prompt(`Mật khẩu mới cho ${a.display_name} (ít nhất 8 ký tự, có chữ và số). Lần đăng nhập tới họ phải đổi lại.`);if(!p)return;busy(b,async()=>{await svApi(`/api/admin/users/${a.id}/set-password`,{method:"POST",body:JSON.stringify({password:p})});toast("Đã cấp lại mật khẩu cho "+a.display_name)})});
  m.querySelectorAll("[data-aem]").forEach(b=>b.onclick=()=>{const a=acc(b.dataset.aem);if(!a)return;
    const v=(prompt("Email mới cho "+a.display_name+" (hiện là "+a.email+"):",a.email)||"").trim().toLowerCase();if(!v||v===a.email.toLowerCase())return;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){toast("Email chưa đúng dạng ten@gmail.com");return}
    busy(b,async()=>{const r=await svApi("/api/admin/users/"+a.id,{method:"PATCH",body:JSON.stringify({email:v})});toast("Đã đổi email thành "+v+" (người đó đăng nhập lại bằng email mới)"+svAccessMsg(r&&r.access));await svLoadUsers();renderMain()})});
  m.querySelectorAll("[data-adel]").forEach(b=>b.onclick=()=>{const a=acc(b.dataset.adel);if(!a)return;
    if(!confirm("Xóa tài khoản "+a.email+" ("+a.display_name+")?\nChỉ xóa được khi tài khoản chưa phụ trách đơn hay khách nào. Không hoàn tác được."))return;
    busy(b,async()=>{const r=await svApi("/api/admin/users/"+a.id,{method:"DELETE"});
      DB.mutate(ME.name,"xóa tài khoản đăng nhập "+a.email,d=>d.users.forEach(x=>{if(x.crm===a.id)x.crm=""}));
      toast("Đã xóa tài khoản "+a.email+svAccessMsg(r&&r.access));await svLoadUsers();renderMain()})});
  if($("#acc-f"))$("#acc-f").onsubmit=e=>{e.preventDefault();busy($("#acc-go"),async()=>{
    const res=await svApi("/api/admin/users",{method:"POST",body:JSON.stringify({email:$("#acc-e").value.trim(),display_name:$("#acc-n").value.trim(),role:"EMPLOYEE",password:$("#acc-p").value})});
    await svApi("/api/admin/users/"+res.id+"/marketing",{method:"POST",body:JSON.stringify({mode:"only"})});
    toast("Đã thêm tài khoản "+$("#acc-e").value.trim()+". Chọn tài khoản này ở cột Tài khoản đăng nhập của nhân sự."+svAccessMsg(res.access));await svLoadUsers();renderMain()})};
  if($("#acsync"))$("#acsync").onclick=e=>busy(e.target,async()=>{const r=await svApi("/api/admin/users/access-sync",{method:"POST"});toast(r.ok?`Đã cập nhật cửa vanhanh.ailla.vn (${r.count} email)`:"Chưa được: "+r.error)});
  m.querySelectorAll("[data-pp]").forEach(b=>b.onclick=()=>{const u=userBy(b.dataset.pp);$("#drawerIn").innerHTML=`<div class="dh"><h2>Phân quyền: ${esc(u.name)}</h2><button class="btn sm" id="dx">Đóng</button></div><p class="hint">Vai trò: ${ROLES[u.role]}. Tick để cấp quyền riêng cho người này.</p>${crm&&acc(u.crm)?`<fieldset class="pg nsq"><legend>Quyền đặc biệt (lưu ngay khi bấm)</legend><div class="nsqr"><span>Vào CRM Kênh phân phối</span>${b2bCell(u)}</div><div class="nsqr"><span>Kế toán (xem số tài chính)</span>${ktCell(u)}</div><div class="nsqr"><span>Kho</span>${khoCell(u)}</div></fieldset>`:crm?`<p class="hint">Chưa gắn tài khoản đăng nhập nên chưa cấp được quyền Kế toán, Kho, CRM.</p>`:""}<form id="ppf">${PERMS.map(([g,ps])=>`<fieldset class="pg"><legend>${g}</legend>${ps.map(([k,l])=>`<label class="ck"><input type="checkbox" name="p" value="${k}" ${u.perms.includes(k)?"checked":""} ${u.role==="admin"?"disabled":""}> ${l}</label>`).join("")}</fieldset>`).join("")}<div class="acts">${u.role!=="admin"?`<button class="btn pri">Lưu quyền</button><button type="button" class="btn" id="ppd">Về mặc định theo vai trò</button>`:"<span class='hint'>Quản trị có mọi quyền.</span>"}</div></form>`;$("#drawer").hidden=false;$("#dx").onclick=closeDrawer;
    bindAcc($("#drawerIn"));
    $("#ppf").onsubmit=e=>{e.preventDefault();const ps=[...$$("#ppf input[name=p]:checked")].map(x=>x.value);DB.mutate(ME.name,"phân quyền "+u.name,d=>d.users.find(x=>x.id===u.id).perms=ps);closeDrawer();toast("Đã lưu quyền");renderMain()};
    if($("#ppd"))$("#ppd").onclick=()=>{DB.mutate(ME.name,"đặt quyền mặc định "+u.name,d=>d.users.find(x=>x.id===u.id).perms=ROLE_PRESET[u.role].slice());closeDrawer();renderMain()}});
  function bindAdd(){if($("#uf"))$("#uf").onsubmit=e=>{e.preventDefault();busy($("#u-go"),async()=>{
    const cv=SV_CV.find(x=>x[0]===$("#u-t").value);if(!cv)throw new Error("chọn chức vụ");const r=cv[1],n=$("#u-n").value.trim(),em=crm?$("#u-e").value.trim():"",pw=crm?$("#u-p").value:"";let c=crm?$("#u-c").value:"",note="";
    if(em){
      const ex=(typeof A!=="undefined"?A:[]).find(a=>String(a.email||"").toLowerCase()===em.toLowerCase());
      if(ex){
        const owner=U.find(u=>u.crm===ex.id);
        if(owner)throw new Error(em+" đã gắn với nhân sự "+owner.name+". Mỗi email chỉ gắn một người");
        c=ex.id;note=". Email này đã có tài khoản nên dùng luôn, không cần mật khẩu mới";
      }else{
      if(!pw)throw new Error("nhập mật khẩu ban đầu");
      const res=await svApi("/api/admin/users",{method:"POST",body:JSON.stringify({email:em,display_name:n,role:"EMPLOYEE",password:pw})});c=res.id;note=svAccessMsg(res.access);}
      if(!ex)await svApi(`/api/admin/users/${c}/marketing`,{method:"POST",body:JSON.stringify({mode:"only"})})}
    const un=foldName(n).replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"")||"nv";
    DB.mutate(ME.name,"thêm nhân sự "+n,d=>{const id=uid("u_");d.users.push({id,username:un,name:n,role:r,title:$("#u-t").value,phongBan:$("#u-pb").value,team:"",active:true,crm:c,perms:ROLE_PRESET[r].slice()});nsdbFromUser(d,id,null,hrNow().iso)});
    closeDrawer();toast("Đã thêm "+n+(em?". Gửi cho họ email + mật khẩu ban đầu để đăng nhập":"")+note);if(crm)await svLoadUsers();renderMain()})}}
}
PAGES.nhansu=pNhanSuSV;

/* ---------- Trợ lý AI: gọi qua máy chủ ---------- */
askClaude=async function(system,user){const r=await svApi("/api/hub/ai",{method:"POST",body:JSON.stringify({system,user,model:aiCombo()})});return {text:r.text,model:r.model+" (9router)",trunc:false}};
clConnectCard=function(){return `<section class="card"><div class="card-h"><h2>Kết nối AI</h2>${pill("Chạy trên máy chủ","grn")}</div><p class="hint">Máy chủ gọi 9router trên VPS (gói tháng có sẵn). Khoá nằm trên máy chủ, trình duyệt không giữ khoá.</p>${isCeo()?`<div class="row4"><label class="field grow">Combo AI trong 9router<input id="cl-combo" value="${esc(aiCombo())}" placeholder="Combo_Content"></label></div><div class="acts"><button class="btn pri" id="cl-save">Lưu</button></div>`:""}</section>`};
bindClConnect=function(){if($("#cl-save"))$("#cl-save").onclick=()=>{try{localStorage.setItem(CL_COMBO,$("#cl-combo").value.trim()||"Combo_Content")}catch(e){}toast("Đã lưu");renderMain()}};

/* Ô ngày (chị Hoa 08/11): gõ năm "2026" thì vừa gõ số "2" trình duyệt đã báo đổi thành năm 0002, web lưu luôn và hiện 1902.
   Năm chưa gõ đủ (trước 2000) thì chặn tin báo đổi, chờ gõ xong mới lưu. Chặn ở pha bắt sớm nên mọi ô ngày đều được. */
["input","change"].forEach(ev=>addEventListener(ev,e=>{const x=e.target;if(x&&x.type==="date"&&x.value&&+x.value.slice(0,4)<2000)e.stopImmediatePropagation()},true));
