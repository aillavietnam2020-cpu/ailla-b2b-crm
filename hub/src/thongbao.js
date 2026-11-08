/* =====================================================================
   THÔNG BÁO ĐẨY GÓC DƯỚI PHẢI (chị Hoa giao 30/10/2026)
   - Ba loại chính + một loại phụ, mỗi người tự tắt / bật ở Của tôi › Cài đặt thông báo:
       agent  Tin mới từ agent: agent trả lời / nhắn trong cuộc trò chuyện của mình (Điều hành agent, Hội thoại)
       duyet  Việc cần duyệt: đúng các dòng trang Phê duyệt (pdcalc.js pdBuild lọc quyền), combo mới chờ kế toán nhập
       giao   Việc được giao: việc / thẻ giao cho mình, lệnh sản xuất, việc CRM giao (chăm sóc khách, nhắc nợ…)
       tin    Tin nhắn nội bộ và thông báo khác trong chuông 🔔
   - Nguồn: dữ liệu chung của web (5 giây hỏi một lần, svPoll) + /api/notify/mine (45 giây một lần, 60 giây khi đang ở tab khác;
     chỉ lấy cái mới từ mốc since). Kế toán: mã combo chưa nhập hỏi 15 phút một lần.
   - Không báo trùng: nhớ khóa đã báo trong localStorage theo từng người (500 khóa gần nhất); lần đầu dùng trên máy nào thì lấy mốc
     bây giờ, không báo dồn việc cũ. Việc cũ hơn 24 giờ chỉ đánh dấu đã thấy.
   - Hiện: tối đa 3 thẻ ở góc dưới phải, nhiều hơn thì gom thành một dòng "+N thông báo khác"; tự ẩn sau 12 giây (rê chuột vào thì dừng); thẻ tóm tắt việc chờ duyệt lúc mở web thì đứng yên tới khi bấm.
     Đang ở tab khác / thu nhỏ Chrome: hiện thêm thông báo của Windows (Notification API) nếu người dùng đã bấm "Bật thông báo".
   - CEO: Phê duyệt báo mọi dòng chị duyệt được, trừ dòng kế toán làm trước (phiếu chi chưa qua Huệ, phiếu thu, tiền về, hàng trả lại,
     combo chờ nhập), xem ntForMe; chị vẫn thấy đủ ở trang Phê duyệt.
   ===================================================================== */
const NT_TYPES=[["agent","🤖","Tin mới từ agent","Agent trả lời hoặc nhắn bạn trong Điều hành agent, Hội thoại"],["duyet","✅","Việc cần duyệt","Phiếu chi, đơn hàng, đề xuất của agent, combo mới… đúng các dòng ở trang Phê duyệt"],["giao","📌","Việc được giao","Việc, thẻ video giao cho mình, lệnh sản xuất, việc chăm sóc khách"],["tin","💬","Tin nhắn và thông báo khác","Nhắn riêng, gọi tên trong nhóm, các thông báo khác trong chuông"]];
const NT={batch:[],timer:0,at:0,busy:false,cbAt:0,sig:"",scanned:false,fresh:null,recent:[],more:0,unseen:0,title:""};
const ntUid=()=>(typeof SV!=="undefined"&&SV.me&&SV.me.id)||(ME&&ME.id)||"";
function ntLS(k,v){const key="ailla_nt_"+k+"_"+ntUid();try{if(v===undefined)return JSON.parse(localStorage.getItem(key)||"null");localStorage.setItem(key,JSON.stringify(v))}catch(e){}return null}
const ntPrefs=()=>Object.assign({agent:true,duyet:true,giao:true,tin:true,os:true},ntLS("pref")||{});
const ntType=k=>NT_TYPES.find(t=>t[0]===k)||NT_TYPES[3];
/* Mốc lần đầu dùng trên máy này: trước mốc thì không báo. NT.fresh = máy này vừa dùng lần đầu (lượt quét đầu chỉ ghi nhớ, không báo). */
function ntBase(){let b=ntLS("base");if(!b){b=Date.now();ntLS("base",b);NT.fresh=true}else if(NT.fresh==null)NT.fresh=false;return b}
/* Đã báo khóa này chưa; chưa thì ghi nhớ luôn (nhiều tab cùng mở dùng chung một danh sách nên không báo hai lần). */
function ntSeen(key){const L=ntLS("seen")||[];if(L.includes(key))return true;L.push(key);ntLS("seen",L.slice(-500));return false}
const ntTs=v=>typeof v==="number"?v:typeof pdTs==="function"?pdTs(v):(Date.parse(v)||0);
const ntMine=by=>!!by&&!!ME&&(by===ME.name||(SV.me&&by===SV.me.display_name));

/* Đưa một thông báo vào hàng: it = {key, type, text, by, at, go}. */
function ntPush(it){
  if(!ME||!it||!it.key)return;const base=ntBase(),t=ntTs(it.at);
  if(t&&(t<base-60000||Date.now()-t>864e5)){ntSeen(it.key);return}
  if(ntSeen(it.key))return;
  if(!ntPrefs()[it.type||"tin"])return;
  NT.batch.push({...it,type:it.type||"tin",t:t||Date.now()});clearTimeout(NT.timer);NT.timer=setTimeout(ntFlush,250);
}
function ntFlush(){const B=NT.batch.splice(0);if(!B.length)return;
  NT.recent=B.slice().reverse().concat(NT.recent).slice(0,40);
  B.forEach(ntCard);ntOs(B);
  if(document.hidden){if(!NT.title)NT.title=document.title.replace(/^\(\d+\)\s*/,"");NT.unseen+=B.length;document.title="("+NT.unseen+") "+NT.title}
}
addEventListener("visibilitychange",()=>{if(!document.hidden&&NT.title){document.title=NT.title;NT.title="";NT.unseen=0}});

/* Thẻ trong web ở góc dưới phải (khung .ntpop sẵn có). */
function ntWrap(){let w=$("#ntpop");if(!w){w=document.createElement("div");w.id="ntpop";w.className="ntpop";document.body.appendChild(w)}return w}
function ntCard(it){const w=ntWrap(),[,ic,lb]=ntType(it.type);
  const cards=[...w.querySelectorAll(".ntpc:not(.ntmore)")];
  if(cards.length>=3){cards[0].remove();NT.more++}
  const e=document.createElement("div");e.className="ntpc nt-"+it.type;e.setAttribute("role","status");
  e.innerHTML=`<button class="ntpx" aria-label="Đóng">✕</button><b>${ic} ${esc(lb)}${it.by?" · "+esc(it.by):""}</b><span class="ntpt">${esc(it.text)}</span><small>${typeof agoTxt==="function"?agoTxt(new Date(it.t).toISOString()):""}${it.go?" · bấm để mở":""}</small>`;
  e.onclick=ev=>{e.remove();if(ev.target.closest(".ntpx"))return;if(it.go)try{it.go()}catch(er){console.warn("[thông báo]",er)}};
  let tm=0;const hide=ms=>{clearTimeout(tm);tm=setTimeout(()=>e.remove(),ms)};
  if(!it.stay){e.onmouseenter=()=>clearTimeout(tm);e.onmouseleave=()=>hide(5000);hide(12000)}
  const mo=w.querySelector(".ntmore");mo?w.insertBefore(e,mo):w.appendChild(e);ntMoreDraw();ntAsk();
}
/* Nhiều hơn 3 tin: một dòng gom "+N thông báo khác", bấm mở danh sách. */
function ntMoreDraw(){const w=$("#ntpop");if(!w)return;let m=w.querySelector(".ntmore");if(!NT.more){if(m)m.remove();return}
  if(!m){m=document.createElement("div");m.className="ntpc ntmore";m.onclick=ev=>{NT.more=0;m.remove();if(!ev.target.closest(".ntpx"))ntList()};w.appendChild(m)}
  m.innerHTML=`<button class="ntpx" aria-label="Đóng">✕</button><span>+${NT.more} thông báo khác · <u>xem tất cả</u></span>`;
  clearTimeout(NT.moreTm);NT.moreTm=setTimeout(()=>{NT.more=0;ntMoreDraw()},12000)}
function ntList(){const L=NT.recent;
  openPop(`<h3>Thông báo vừa nhận</h3><p class="hint">Trong lần mở web này. Các thông báo cũ hơn xem ở chuông 🔔, trang Phê duyệt, Việc của tôi.</p>
    <div class="ntl">${L.map((it,i)=>{const [,ic,lb]=ntType(it.type);return `<button class="nti" data-nti="${i}"><span><b>${ic} ${esc(lb)}${it.by?" · "+esc(it.by):""}</b><br>${esc(it.text)}</span><small>${typeof agoTxt==="function"?agoTxt(new Date(it.t).toISOString()):""}</small></button>`}).join("")||'<p class="hint">Chưa có thông báo.</p>'}</div>
    <p><button class="lnk" id="nt-cfg">Cài đặt thông báo</button></p>`);
  document.querySelectorAll("[data-nti]").forEach(b=>b.onclick=()=>{const it=L[+b.dataset.nti];closePop();if(it&&it.go)it.go()});
  const c=$("#nt-cfg");if(c)c.onclick=()=>{closePop();ntGo({ref:"page:thongbao"})}}
/* Lần đầu có thông báo mà máy chưa cho phép: nhắc một lần ngay dưới thẻ, bấm mới xin quyền (không tự bật hộp xin quyền). */
function ntAsk(){if(!("Notification" in window)||Notification.permission!=="default"||ntLS("asked")||!ntPrefs().os)return;const w=ntWrap();if(w.querySelector(".ntask"))return;
  const e=document.createElement("div");e.className="ntpc ntask";e.innerHTML=`<button class="ntpx" aria-label="Đóng">✕</button><span>Muốn nhận thông báo cả khi đang mở tab khác hoặc thu nhỏ Chrome?</span><button class="btn sm pri" type="button">Bật thông báo</button>`;
  e.onclick=ev=>{ntLS("asked",1);e.remove();if(ev.target.closest(".btn"))ntPerm()};w.appendChild(e)}
function ntPerm(){if(!("Notification" in window))return Promise.resolve("unsupported");ntLS("asked",1);return Notification.requestPermission().then(p=>{toast(p==="granted"?"Đã bật thông báo trên máy này":"Máy chưa cho phép thông báo");return p})}

/* Thông báo của Windows: chỉ khi đang ở tab khác / thu nhỏ Chrome (đang xem web thì thẻ trong web là đủ). */
function ntOs(B){const p=ntPrefs();if(!p.os||!("Notification" in window)||Notification.permission!=="granted")return;if(!document.hidden&&document.hasFocus())return;
  const one=(title,body,tag,go)=>{try{const n=new Notification(title,{body,tag,lang:"vi"});n.onclick=()=>{try{window.focus()}catch(e){}n.close();if(go)go()}}catch(e){}};
  if(B.length<=3)B.forEach(it=>{const [,ic,lb]=ntType(it.type);one(`${ic} ${lb}${it.by?" · "+it.by:""}`,it.text,it.key,it.go)});
  else one(`AILLA · ${B.length} thông báo mới`,B.slice(0,4).map(it=>"• "+it.text).join("\n"),"ailla-nhieu",ntList)}

/* ---------- Mở đúng chỗ ---------- */
function ntPage(p){if(typeof ntGo==="function")ntGo({ref:"page:"+p});else{PAGE=p;render()}}
function ntOpenPd(r){ntPage("pheduyet");if(typeof pdOpen==="function")setTimeout(()=>{try{pdOpen(r)}catch(e){}},60)}
function ntOpenAgent(a){if(typeof AC!=="undefined"){AC.cur=a;try{localStorage.setItem("ac_cur",a)}catch(e){}}ntPage("agentchat")}

/* Dòng Phê duyệt nào báo người này. CEO: bỏ các dòng người khác làm trước (phiếu chi Huệ chưa duyệt, phiếu thu, tiền về, hàng trả lại, combo
   chờ kế toán); còn lại (đơn, sửa phiếu xuất, đề xuất agent, phiếu thưởng, nhân sự, khoản chờ CEO) đều báo. Người khác: bỏ dòng chờ CEO. */
const ntForMe=r=>SV.me&&SV.me.role==="CEO"?(r.ceoCho||!["chi","thu","tien","hoan","combo","cbdx"].includes(r.k)):!r.ceoCho;
function ntFromPd(rows){
  (rows||[]).filter(ntForMe).filter(r=>!ntMine(r.by)&&r.k!=="combo"&&!(typeof pdOther==="function"&&pdOther(r))).forEach(r=>ntPush({key:"pd:"+r.id+(r.ceoCho?":ceo":""),type:"duyet",
    text:`${r.loai}: ${r.nd||""}${r.tien?" · "+nf(r.tien)+" đ":""}`,by:r.by||"",at:r.ceoCho?0:r.at,go:()=>ntOpenPd(r)}))}
/* Dữ liệu chung của web (phiếu chi, phiếu thu, đơn nhân sự đang chờ) — chạy lại khi dữ liệu đổi. */
function ntScanHub(){if(!ME||!DB.data||typeof pdBuild!=="function"||typeof pdWho!=="function")return;
  const sig=SV.version+":"+(typeof SXS!=="undefined"?SXS.version:0);if(sig===NT.sig)return;NT.sig=sig;
  const d=D(),h=d.hr||{};let rows=[];
  try{rows=pdBuild({th:typeof pdTh==="function"?pdTh():5e6,pcCho:d.pcCho||[],costsCho:d.costsCho||[],thuCho:d.thuCho||[],hrDon:h.don||[],hrTu:h.tu||[],...(typeof spcPdSrc==="function"?spcPdSrc(d):{}),staffName:ma=>{try{return staffBy(ma).ten}catch(e){return ma}}},pdWho())}catch(e){return}
  ntBase();if(!NT.scanned&&NT.fresh){rows.forEach(r=>ntSeen("pd:"+r.id+(r.ceoCho?":ceo":"")))}else ntFromPd(rows);NT.scanned=true}

/* Mở web: một thẻ tóm tắt việc đang chờ mình duyệt (cùng lọc như trên), tối đa 4 giờ một lần, để thấy ngay có việc gì, không chờ việc mới. */
async function ntSum(){if(NT.sum||!ME||typeof pdAny!=="function"||!pdAny()||typeof pdRows!=="function")return;NT.sum=1;
  if(Date.now()-(+ntLS("sumAt")||0)<4*3600e3||!ntPrefs().duyet)return;
  try{await pdLoad();if(!PD.sv)return;const R=pdRows().filter(ntForMe);if(!R.length)return;
    ntLS("sumAt",Date.now());const g={};R.forEach(r=>{const k=String(r.loai||"Khác").split(" · ")[0];g[k]=(g[k]||0)+1});
    NT.batch.push({key:"sum:"+Date.now(),type:"duyet",t:Date.now(),stay:1,text:`Đang chờ duyệt ${R.length} việc: ${Object.entries(g).map(([k,n])=>n+" "+k.toLowerCase()).join(", ")}`,go:()=>ntPage("pheduyet")});
    clearTimeout(NT.timer);NT.timer=setTimeout(ntFlush,250)}catch(e){}}
/* Hỏi máy chủ phần mới (một API nhẹ, có since). */
async function ntTick(){
  if(!ME||!SV.me||NT.busy||typeof svApi!=="function")return;
  ntScanHub();ntSum();
  if(Date.now()-NT.at<(document.hidden?60000:45000))return;NT.at=Date.now();NT.busy=true;
  try{
    const since=ntLS("since"),after=ntLS("after");
    const r=await svApi("/api/notify/mine?"+(since?"since="+encodeURIComponent(since):"")+(after!=null?"&after="+after:""));
    ntLS("since",new Date(Date.parse(r.now)-5000).toISOString());ntLS("after",Math.max(+after||0,+r.agent_last||0));
    if(after!=null)(r.agent||[]).forEach(m=>{if(PAGE==="agentchat"&&typeof AC!=="undefined"&&AC.cur===m.agent&&!document.hidden)return ntSeen("ag:"+m.id);
      ntPush({key:"ag:"+m.id,type:"agent",text:String(m.body||"").replace(/\s+/g," ").slice(0,160),by:m.agent_name,at:m.created_at,go:()=>ntOpenAgent(m.agent)})});
    if(typeof pdBuild==="function")ntFromPd(pdBuild({approvals:r.approvals,shipEdits:r.shipEdits,proposals:r.proposals,gifts:r.gifts,cash:r.cash,ceoSpend:r.ceoSpend,payConfirm:r.payConfirm,returns:r.returns,th:typeof pdTh==="function"?pdTh():5e6},pdWho()));
    (r.crmTasks||[]).forEach(t=>ntPush({key:"ct:"+t.id,type:"giao",text:(t.customer_id?"Việc chăm sóc khách: ":"Việc được giao: ")+t.title+(t.due_at?" · hạn "+String(t.due_at).slice(8,10)+"/"+String(t.due_at).slice(5,7):""),by:t.created_by_name||"",at:t.created_at,go:()=>ntPage("viectoi")}));
  }catch(e){}finally{NT.busy=false}
  ntCombo();
}
/* Combo mới trên đơn sàn chưa nhập: báo kế toán (không báo CEO), 15 phút hỏi một lần. */
async function ntCombo(){
  if(!SV.perms.includes("order.accounting.confirm")||SV.me.role==="CEO"||Date.now()-NT.cbAt<900000)return;NT.cbAt=Date.now();
  let L=[];try{L=await svApi("/api/hub/sanpham/unmapped")}catch(e){return}
  ntBase();const neu=(L||[]).filter(u=>!ntSeen("cb:"+u.channel+":"+u.sku+":"+u.variant));
  if(!neu.length||NT.fresh&&!NT.cbDone){NT.cbDone=1;return}NT.cbDone=1;
  ntPush({key:"cbb:"+Date.now(),type:"duyet",text:`${neu.length} mã combo mới chờ kế toán nhập: ${neu.slice(0,3).map(u=>u.name||u.sku).join(", ")}${neu.length>3?"…":""}`,go:()=>ntPage("spcombo")})}

/* Gắn vào vòng hỏi máy chủ đang có (svPoll, 5 giây): không đặt thêm đồng hồ riêng. */
const _svPollNt=svPoll;
svPoll=async function(){await _svPollNt();ntTick()};

/* Thông báo trong chuông 🔔 (chat.js) đi chung đường: có loại, không báo trùng, không tự hiện lại khi tải lại trang. */
const ntKind=t=>/giao bạn|giao cho bạn|chờ bạn|trả về sửa|đã được duyệt|nộp trễ/i.test(t)?"giao":/duyệt/i.test(t)?"duyet":"tin";
ntPop=function(n){if(!n)return;ntPush({key:"nt:"+(n.id||n.ref+":"+(n.at||"")),type:ntKind(n.text||""),text:String(n.text||"").replace(/^💬\s*/,""),by:n.by?userName(n.by):"",at:n.at||0,go:()=>ntGo(n)})};

/* ---------- Của tôi › Cài đặt thông báo ---------- */
PAGES.thongbao=m=>{const p=ntPrefs(),has="Notification" in window,perm=has?Notification.permission:"unsupported";
  m.innerHTML=H("Cài đặt thông báo","Thông báo hiện ở góc dưới bên phải màn hình, chỉ báo việc của mình")+`<section class="card narrow">
    <h3>Nhận những loại nào</h3>
    ${NT_TYPES.map(([k,ic,lb,ds])=>`<label class="nttog"><input type="checkbox" data-ntk="${k}"${p[k]?" checked":""}><span><b>${ic} ${lb}</b><small>${ds}</small></span></label>`).join("")}
    <h3 style="margin-top:18px">Thông báo của Windows</h3>
    <p class="hint">Khi đang mở tab khác hoặc thu nhỏ Chrome, máy vẫn hiện thông báo ở góc dưới bên phải màn hình (web vẫn phải đang mở ở một tab).</p>
    <label class="nttog"><input type="checkbox" data-ntk="os"${p.os?" checked":""}><span><b>🪟 Hiện cả thông báo của Windows</b><small>${perm==="granted"?"Máy này đã cho phép.":perm==="denied"?"Máy này đang chặn thông báo của web.":perm==="unsupported"?"Trình duyệt này không hỗ trợ.":"Máy này chưa cho phép, bấm nút bên dưới."}</small></span></label>
    ${perm==="default"?`<p><button class="btn pri" id="nt-on">Bật thông báo</button> <span class="hint">Chrome sẽ hỏi một lần, bấm <b>Cho phép</b>.</span></p>`:""}
    ${perm==="denied"?`<p class="hint">Muốn bật lại: bấm biểu tượng bên trái địa chỉ web (ổ khóa / hai gạch), chọn <b>Thông báo</b> → <b>Cho phép</b>, rồi tải lại trang.</p>`:""}
    <p style="margin-top:14px"><button class="btn" id="nt-test">Thử một thông báo</button> <button class="lnk" id="nt-rec">Xem thông báo vừa nhận</button></p></section>`;
  m.querySelectorAll("[data-ntk]").forEach(x=>x.onchange=()=>{const q=ntPrefs();q[x.dataset.ntk]=x.checked;ntLS("pref",q);toast(x.checked?"Đã bật":"Đã tắt")});
  const on=$("#nt-on");if(on)on.onclick=()=>ntPerm().then(()=>renderMain());
  $("#nt-test").onclick=()=>{const it={key:"test:"+Date.now(),type:"tin",text:"Thông báo thử: thông báo đang chạy tốt trên máy này.",by:"",t:Date.now()};ntCard(it);
    if(has&&Notification.permission==="granted")try{new Notification("💬 AILLA · thông báo thử",{body:"Thông báo của Windows đang chạy tốt trên máy này.",tag:"ailla-thu"})}catch(e){}};
  $("#nt-rec").onclick=ntList};

/* ---------- Thông báo đẩy về điện thoại / máy tính, báo cả khi đã tắt web (chị Hoa duyệt demo 08/11) ----------
   Máy chủ: src/server/routes/push.ts + services/pushDispatch.ts. Máy: public/sw.js nhận và hiện thông báo.
   Bấm thông báo → /hub/#nt=<mã chuông>~<ref> → mở đúng việc (pzOpen). */
const PZU={me:null,busy:false};
const pzIos=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const pzApp=()=>(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
const pzOk=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
const pzDev=()=>{const u=navigator.userAgent,os=/iPhone/.test(u)?"iPhone":/iPad/.test(u)||pzIos()?"iPad":/Android/.test(u)?"Điện thoại Android":/Macintosh/.test(u)?"Máy Mac":/Windows/.test(u)?"Máy tính Windows":"Máy";
  const br=/Edg\//.test(u)?"Edge":/CriOS|Chrome\//.test(u)?"Chrome":/Firefox|FxiOS/.test(u)?"Firefox":/Safari/.test(u)?"Safari":"";return os+(br?" · "+br:"")};
const pzU8=s=>{const t=s.replace(/-/g,"+").replace(/_/g,"/"),b=atob(t+"=".repeat((4-t.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))};
async function pzReg(){if(!("serviceWorker" in navigator))return null;try{await navigator.serviceWorker.register("/sw.js");return await navigator.serviceWorker.ready}catch(e){return null}}
async function pzSub(){const r=await pzReg();try{return r&&r.pushManager?await r.pushManager.getSubscription():null}catch(e){return null}}
const pzSend=s=>{const j=s.toJSON();return svApi("/api/push/subscribe",{method:"POST",body:JSON.stringify({endpoint:j.endpoint,keys:j.keys,device:pzDev()})})};
async function pzOn(){if(PZU.busy||!PZU.me)return;PZU.busy=true;
  try{const p=await Notification.requestPermission();if(p!=="granted"){toast("Máy chưa cho phép thông báo");return}
    const r=await pzReg();if(!r){toast("Trình duyệt này chưa bật được thông báo");return}
    let s=await r.pushManager.getSubscription();
    try{if(!s)s=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pzU8(PZU.me.key)})}
    catch(e){if(s)await s.unsubscribe().catch(()=>{});s=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pzU8(PZU.me.key)})}
    await pzSend(s);try{localStorage.setItem("ailla_np_at",String(Date.now()))}catch(e){}
    toast("Máy này đã bật thông báo");await svApi("/api/push/test",{method:"POST",body:"{}"}).catch(()=>{});
  }catch(e){toast("Chưa bật được: "+(e.message||e))}finally{PZU.busy=false;renderMain()}}
async function pzOff(ep){const s=await pzSub();if(s&&(!ep||s.endpoint===ep))await s.unsubscribe().catch(()=>{});
  await svApi("/api/push/unsubscribe",{method:"POST",body:JSON.stringify({endpoint:ep||(s&&s.endpoint)||""})}).catch(()=>{});toast("Đã tắt thông báo trên máy đó");renderMain()}
const PZ_TYPES=[["giao","📋","Được giao việc","Việc mới, đổi hạn, chuyển việc sang mình, xin gia hạn"],["nhac","🔔","Bị nhắc việc","Người giao bấm Nhắc, nhắc việc trễ hạn"],["sua","✏️","Việc bị trả về Cần sửa","Kèm lời ghi cần sửa gì"],["tin","💬","Tin nhắn mới","Nhắn riêng, nhóm có mình; nhóm chung chỉ khi được gọi @tên"],["duyet","✅","Việc chờ mình duyệt","Gộp lại, tối đa 1 thông báo mỗi giờ"]];
const pzHr=(id,v)=>`<select id="${id}">${Array.from({length:24},(_,h)=>`<option value="${h}"${h===v?" selected":""}>${String(h).padStart(2,"0")}:00</option>`).join("")}</select>`;
const pzDd=s=>{s=String(s||"");return s.length>=10?s.slice(8,10)+"/"+s.slice(5,7):""};
async function pzSection(box){
  let me;try{me=await svApi("/api/push/me")}catch(e){box.innerHTML=`<p class="hint">Chưa tải được phần thông báo về điện thoại.</p>`;return}
  PZU.me=me;const cur=await pzSub(),perm="Notification" in window?Notification.permission:"unsupported",P=me.prefs;
  const here=!!cur&&me.devices.some(d=>d.endpoint===cur.endpoint);
  const st=!me.ready?`<p class="hint">Máy chủ chưa bật gửi thông báo, nhờ quản trị kiểm tra.</p>`
    :pzIos()&&!pzApp()?`<div class="npios"><b>iPhone cần làm 1 lần:</b><ol><li>Mở <b>Safari</b>, vào trang web này (Chrome trên iPhone không làm được bước 2).</li><li>Bấm nút <b>Chia sẻ ⬆︎</b> ở dưới, chọn <b>"Thêm vào MH chính"</b>, bấm <b>Thêm</b>.</li><li>Mở web bằng <b>biểu tượng Ailla</b> mới trên màn hình chính.</li><li>Vào lại trang này, bấm <b>"Bật thông báo trên máy này"</b>, chọn <b>Cho phép</b>.</li></ol></div>`
    :!pzOk()?`<p class="hint">Trình duyệt này không hỗ trợ thông báo đẩy. Dùng Chrome (máy tính, Android) hoặc Safari (iPhone).</p>`
    :perm==="denied"?`<p class="hint">Máy này đang chặn thông báo của web. Mở cài đặt trang web của trình duyệt (biểu tượng bên trái địa chỉ web), chọn <b>Thông báo → Cho phép</b>, rồi tải lại trang.</p>`
    :here?`<div class="npok">✓ Máy này đã bật thông báo <button class="lnk" id="np-off">Tắt trên máy này</button></div>`
    :`<p><button class="btn pri" id="np-on">🔔 Bật thông báo trên máy này</button></p><p class="hint">Máy sẽ hỏi một lần, bấm <b>Cho phép</b>.</p>`;
  const devs=me.devices.map(d=>`<div class="npdev"><span>${/iPhone|iPad|Android/.test(d.device)?"📱":"💻"}</span><div><b>${esc(d.device)}${cur&&d.endpoint===cur.endpoint?" · máy này":""}</b><small>Bật từ ${esc(pzDd(d.created_at))}${d.last_ok_at?" · nhận lần cuối "+esc(String(d.last_ok_at).slice(11,16)+" "+pzDd(d.last_ok_at)):""}</small></div><button class="lnk" data-npx="${esc(d.endpoint)}">Gỡ</button></div>`).join("");
  box.innerHTML=`<h3>📱 Thông báo về điện thoại, máy tính</h3><p class="hint">Báo cả khi đã tắt web, khóa màn hình. Bấm vào thông báo là mở đúng việc. Mỗi máy bật một lần.</p>${st}
    <h4 class="nph">Máy đang nhận (${me.devices.length})</h4>${devs||`<p class="hint">Chưa có máy nào.</p>`}
    ${me.devices.length?`<p><button class="btn" id="np-test">Gửi thử một thông báo</button></p>`:""}
    <h4 class="nph">Loại gửi về máy</h4>${PZ_TYPES.map(([k,ic,lb,ds])=>`<label class="nttog"><input type="checkbox" data-npk="${k}"${P[k]?" checked":""}><span><b>${ic} ${lb}</b><small>${ds}</small></span></label>`).join("")}
    <h4 class="nph">Giờ yên lặng</h4><label class="nttog"><input type="checkbox" data-npk="quiet"${P.quiet?" checked":""}><span><b>🌙 Không báo ban đêm</b><small>Việc gấp vẫn báo ngay; thông báo khác gộp lại, báo khi hết giờ yên lặng</small></span></label>
    <div class="npq">Từ ${pzHr("np-qf",P.qFrom)} đến ${pzHr("np-qt",P.qTo)}</div>`;
  const save=()=>{const q={...PZU.me.prefs};box.querySelectorAll("[data-npk]").forEach(x=>q[x.dataset.npk]=x.checked);q.qFrom=+box.querySelector("#np-qf").value;q.qTo=+box.querySelector("#np-qt").value;
    svApi("/api/push/prefs",{method:"PUT",body:JSON.stringify(q)}).then(r=>{PZU.me.prefs=(r&&r.prefs)||q;toast("Đã lưu")}).catch(e=>toast(e.message||"Chưa lưu được"))};
  box.querySelectorAll("[data-npk]").forEach(x=>x.onchange=save);box.querySelectorAll("#np-qf,#np-qt").forEach(x=>x.onchange=save);
  const on=box.querySelector("#np-on");if(on)on.onclick=pzOn;
  const off=box.querySelector("#np-off");if(off)off.onclick=()=>pzOff(cur.endpoint);
  box.querySelectorAll("[data-npx]").forEach(b=>b.onclick=()=>{if(confirm("Gỡ máy này khỏi danh sách nhận thông báo?"))pzOff(b.dataset.npx)});
  const t=box.querySelector("#np-test");if(t)t.onclick=async()=>{try{const r=await svApi("/api/push/test",{method:"POST",body:"{}"});toast(r&&r.sent?"Đã gửi tới "+r.sent+" máy":"Chưa máy nào nhận được, thử bật lại")}catch(e){toast(e.message||"Chưa gửi được")}};
}
const _pzPageOld=PAGES.thongbao;
PAGES.thongbao=m=>{_pzPageOld(m);const old=m.querySelector("section.card");if(old){const h=document.createElement("h3");h.textContent="Khi đang mở web";old.prepend(h)}
  const box=document.createElement("section");box.className="card narrow npbox";box.innerHTML=`<p class="hint">Đang tải…</p>`;if(old)old.before(box);else m.appendChild(box);pzSection(box)};
if(typeof document!=="undefined"&&!document.getElementById("np-css")){const s=document.createElement("style");s.id="np-css";s.textContent=`.npbox{margin-bottom:14px}.npbox h3{margin:0 0 4px}.nph{margin:16px 0 6px;font-size:13.5px}.npok{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#eaf7f0;color:#14724a;border-radius:10px;padding:9px 12px;font-weight:600}.npdev{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)}.npdev div{flex:1;min-width:0}.npdev b{display:block;font-size:13px}.npdev small{color:var(--muted);font-size:12px}.npq{display:flex;gap:6px;align-items:center;margin:6px 0 0 26px;font-size:13px}.npq select{width:auto}.npios{background:#fff7e6;border:1px solid #f2d79c;border-radius:10px;padding:10px 12px;font-size:13px}.npios ol{margin:6px 0 0;padding-left:20px;line-height:1.6}`;document.head.appendChild(s)}

/* Mở đúng việc khi bấm thông báo: lúc mở web từ thông báo (#nt=…) hoặc web đang mở sẵn (sw.js gửi tin nhắn). */
function pzOpen(url){const m=String(url||"").match(/#nt=([^~]*)~(.*)$/);if(!m)return;const id=decodeURIComponent(m[1]),ref=decodeURIComponent(m[2]);
  const go=()=>{try{if(location.hash.startsWith("#nt="))history.replaceState(null,"",location.pathname+location.search);
    if(ref==="cvrv"){MOD="cv";PAGE="cv_v";CWS.my="rv";render();return}
    if(ref.startsWith("tn:")){ntGo({id:"",ref:"page:tinnhan"});setTimeout(()=>{try{tnOpen(ref.slice(3))}catch(e){}},400);return}
    ntGo({id,ref})}catch(e){console.error("mở thông báo",e)}};
  let n=0;const w=()=>{if(typeof D==="function"&&D()&&D().users&&typeof ME!=="undefined"&&ME&&document.getElementById("main"))setTimeout(go,500);else if(n++<120)setTimeout(w,250)};w()}
if(typeof location!=="undefined"&&location.hash.startsWith("#nt="))pzOpen(location.hash);
if(typeof navigator!=="undefined"&&"serviceWorker" in navigator){navigator.serviceWorker.addEventListener("message",e=>{if(e.data&&e.data.ntUrl)pzOpen(e.data.ntUrl)});
  /* máy đã bật: mỗi ngày báo lại máy chủ một lần (phòng khi trình duyệt đổi địa chỉ nhận) */
  setTimeout(async()=>{try{if(!("Notification" in window)||Notification.permission!=="granted")return;const last=+localStorage.getItem("ailla_np_at")||0;if(Date.now()-last<86400000)return;
    const s=await pzSub();if(s){await pzSend(s);localStorage.setItem("ailla_np_at",String(Date.now()))}}catch(e){}},8000)}
