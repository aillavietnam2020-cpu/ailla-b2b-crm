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
const NT_TYPES=[["agent","🤖","Tin mới từ agent","Agent trả lời hoặc nhắn chị/anh trong Điều hành agent, Hội thoại"],["duyet","✅","Việc cần duyệt","Phiếu chi, đơn hàng, đề xuất của agent, combo mới… đúng các dòng ở trang Phê duyệt"],["giao","📌","Việc được giao","Việc, thẻ video giao cho mình, lệnh sản xuất, việc chăm sóc khách"],["tin","💬","Tin nhắn và thông báo khác","Nhắn riêng, gọi tên trong nhóm, các thông báo khác trong chuông"]];
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
const ntForMe=r=>SV.me&&SV.me.role==="CEO"?(r.ceoCho||!["chi","thu","tien","hoan","combo"].includes(r.k)):!r.ceoCho;
function ntFromPd(rows){
  (rows||[]).filter(ntForMe).filter(r=>!ntMine(r.by)&&r.k!=="combo").forEach(r=>ntPush({key:"pd:"+r.id+(r.ceoCho?":ceo":""),type:"duyet",
    text:`${r.loai}: ${r.nd||""}${r.tien?" · "+nf(r.tien)+" đ":""}`,by:r.by||"",at:r.ceoCho?0:r.at,go:()=>ntOpenPd(r)}))}
/* Dữ liệu chung của web (phiếu chi, phiếu thu, đơn nhân sự đang chờ) — chạy lại khi dữ liệu đổi. */
function ntScanHub(){if(!ME||!DB.data||typeof pdBuild!=="function"||typeof pdWho!=="function")return;
  const sig=SV.version+":"+(typeof SXS!=="undefined"?SXS.version:0);if(sig===NT.sig)return;NT.sig=sig;
  const d=D(),h=d.hr||{};let rows=[];
  try{rows=pdBuild({th:typeof pdTh==="function"?pdTh():5e6,pcCho:d.pcCho||[],costsCho:d.costsCho||[],thuCho:d.thuCho||[],hrDon:h.don||[],hrTu:h.tu||[],staffName:ma=>{try{return staffBy(ma).ten}catch(e){return ma}}},pdWho())}catch(e){return}
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
    (r.crmTasks||[]).forEach(t=>ntPush({key:"ct:"+t.id,type:"giao",text:"Việc chăm sóc khách: "+t.title+(t.due_at?" · hạn "+String(t.due_at).slice(8,10)+"/"+String(t.due_at).slice(5,7):""),by:t.created_by_name||"",at:t.created_at,go:()=>ntPage("viectoi")}));
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
    ${perm==="default"?`<p><button class="btn pri" id="nt-on">Bật thông báo</button> <span class="hint">Chrome sẽ hỏi một lần, chị/anh bấm <b>Cho phép</b>.</span></p>`:""}
    ${perm==="denied"?`<p class="hint">Muốn bật lại: bấm biểu tượng bên trái địa chỉ web (ổ khóa / hai gạch), chọn <b>Thông báo</b> → <b>Cho phép</b>, rồi tải lại trang.</p>`:""}
    <p style="margin-top:14px"><button class="btn" id="nt-test">Thử một thông báo</button> <button class="lnk" id="nt-rec">Xem thông báo vừa nhận</button></p></section>`;
  m.querySelectorAll("[data-ntk]").forEach(x=>x.onchange=()=>{const q=ntPrefs();q[x.dataset.ntk]=x.checked;ntLS("pref",q);toast(x.checked?"Đã bật":"Đã tắt")});
  const on=$("#nt-on");if(on)on.onclick=()=>ntPerm().then(()=>renderMain());
  $("#nt-test").onclick=()=>{const it={key:"test:"+Date.now(),type:"tin",text:"Thông báo thử: thông báo đang chạy tốt trên máy này.",by:"",t:Date.now()};ntCard(it);
    if(has&&Notification.permission==="granted")try{new Notification("💬 AILLA · thông báo thử",{body:"Thông báo của Windows đang chạy tốt trên máy này.",tag:"ailla-thu"})}catch(e){}};
  $("#nt-rec").onclick=ntList};
