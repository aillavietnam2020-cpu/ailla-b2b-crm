/* =====================================================================
   CÔNG VIỆC & DỰ ÁN — một chỗ cho mọi việc (thẻ video, order Digital, việc chung)
   Phạm vi xem: Của tôi · Cả team · Tất cả (theo vai trò). Ưu tiên Content & Digital.
   ===================================================================== */
const TEAMS={content:"Content & Media",digital:"Digital – Ads",koc:"KOC",chung:"Chung"};
const CV_ST=[["cg","Chưa giao","gry"],["todo","Cần làm","gry"],["doing","Đang làm","blu"],["review","Chờ duyệt","amb"],["done","Hoàn thành","grn"]];
const cvStN=k=>(CV_ST.find(s=>s[0]===k)||[k,k])[1];
const UU=["Cao","Trung bình","Thấp"];
// Team của một người: Content/Digital theo vai trò; các phòng khác (Sale, Sản xuất, Kế toán...) theo phòng ban.
const MKT_PB=["CM","ADS","KOC","BDH",""];
const teamOf=u=>!u?"":u.role==="digital"?"digital":["content","lead"].includes(u.role)?"content":u.role==="truongphong"?(MKT_PB.includes(u.phongBan||"")?"mkt":u.phongBan):u.role==="nhanvien"&&u.phongBan?u.phongBan:"all";
function cvSeed(d){
  if(d.projects)return;const t=d.settings.today;
  d.projects=[
    {id:"DA-01",ten:"TikTok chính T10 — 160 video",team:"content",owner:"u_oanh",han:31,moTa:"Bột tẩy 50 mới · Tinh dầu 50 · Xịt muỗi 20 · Xịt ruồi 20 · Sáp thơm 10 · Lau sàn chuyên dụng 10",loc:{kenh:["TikTok chính"],tuyenNot:["Sale 10/10 & 20/10"]}},
    {id:"DA-02",ten:"Via TikTok — 2 video/ngày + Via phụ 1 video/ngày",team:"content",owner:"u_oanh",han:31,moTa:"Via: 30 video edit footage có sẵn (tẩy lồng AiBio, nước giặt AiBio, Arila) + 30 video ruồi, muỗi đăng lại từ kho. Via phụ: reup 1 video/ngày. Worker edit là chính",loc:{kenh:["TikTok Via 1","TikTok Via 2"]}},
    {id:"DA-03",ten:"Fanpage chính T10 — 28 bài",team:"content",owner:"u_oanh",han:31,moTa:"Mỗi tuần 3 video + 4 bài ảnh. Lên lịch cả tháng, agent tạo ảnh và đăng tự động hằng ngày",loc:{kenh:["Fanpage chính"],tuyenNot:["Sale 10/10 & 20/10"]}},
    {id:"DA-04",ten:"Sale đôi 10/10",team:"content",owner:"u_oanh",han:10,moTa:"Truyền thông trên TikTok chính + Fanpage chính; Digital chạy Ads nhắc giờ vàng",loc:{tuyen:["Sale 10/10 & 20/10"],toiNgay:10}},
    {id:"DA-05",ten:"Sale 20/10",team:"content",owner:"u_oanh",han:20,moTa:"Truyền thông trên TikTok chính + Fanpage chính; tinh dầu làm quà 20/10",loc:{tuyen:["Sale 10/10 & 20/10"],tuNgay:11}},
    {id:"DA-06",ten:"Ads Facebook T10 — đẩy 4 sản phẩm",team:"digital",owner:"u_chi",han:31,moTa:"Tinh dầu, Tẩy lồng AiBio, Bột tẩy vạn năng, Tẩy đa năng XClean. Digital chưa có lead — chị trực tiếp quản",loc:{orders:true}},
  ];
  const T=(ten,team,da,nguoi,han,uu,st,loai,moTa,phoi=[],ck=[])=>({id:uid("cv"),ten,team,da,nguoi,phoi,han,uu,st,loai,moTa,checklist:ck.map(x=>({t:x,x:false})),tao:"u_chi",kq:""});
  const add=[
    T("Lên chiến dịch Tinh dầu T10 (CĐ + Mess)","digital","DA-06","u_va",3,"Cao","done","Chạy Ads","Ngân sách theo trần CPO 60k, ROAS ≥ 2,8"),
    T("Test 3 creative Bột tẩy vạn năng","digital","DA-06","u_thao",t+2,"Cao","doing","Test creative","Dùng 3 video trước/sau của Content (order ORD-0005)",["u_hoa"]),
    T("Mở chiến dịch Tẩy đa năng XClean","digital","DA-06","u_duan",t-2,"Trung bình","todo","Chạy Ads","Chưa có video XClean — cần order Content",["u_oanh"]),
    T("Tối ưu Ads Tẩy lồng AiBio (chi/đơn đang cao)","digital","DA-06","u_dat",t,"Cao","doing","Tối ưu","Tắt nhóm quảng cáo CPO > 85k"),
    T("GMV Max TikTok cho sale 10/10","digital","DA-04","u_huyen",9,"Cao","done","Chạy Ads","Ngân sách ngày sale ×2"),
    T("GMV Max TikTok cho sale 20/10","digital","DA-05","u_huyen",19,"Cao","todo","Chạy Ads","Ngân sách ngày sale ×2; dùng video tinh dầu làm quà"),
    T("Báo cáo Ads tuần 2 + nhập vào web","digital","DA-06","u_va",t-1,"Trung bình","review","Báo cáo","Kéo file Ads Manager tuần 5–11/10"),
    T("Lên lịch Fanpage tháng 10 cho agent","content","DA-03","u_oanh",2,"Cao","done","Lịch đăng","28 bài: 12 video + 16 bài ảnh, gồm 4 bài sale"),
    T("Duyệt ảnh agent tạo tuần 3","content","DA-03","u_oanh",t+1,"Trung bình","todo","Duyệt","Kiểm logo, giá, claim"),
    T("Chuẩn bị mẫu Bột tẩy + đồ ố cho buổi quay","content","DA-01","u_hoa",t-1,"Cao","doing","Chuẩn bị đạo cụ","Áo trắng ố, khăn bếp, giày trắng",[],["Mua 5 áo trắng cũ","Ngâm mốc trước 3 ngày","Chuẩn bị chậu, thìa đo"]),
    T("Chọn 30 video ruồi, muỗi trong kho để đăng lại ở Via","content","DA-02","u_may",5,"Cao","done","Kho video","Kho gồm cả video đã đăng trước đây"),
    T("Gửi footage AiBio, Arila cho Worker edit đợt 2","content","DA-02","u_may",t-3,"Cao","doing","Worker","10 footage tẩy lồng + 10 nước giặt AiBio + 10 Arila"),
    T("Kịch bản video nhắc giờ vàng 20/10","content","DA-05","u_quynh",17,"Cao","todo","Kịch bản","4 video BT + 4 video TD",["u_huyen"]),
    T("Banner + bài Fanpage sale 10/10","content","DA-04","u_oanh",8,"Cao","done","Thiết kế","3 bài trước 3 ngày + 1 bài ngày sale"),
  ];
  d.tasks=(d.tasks||[]).map(x=>({id:x.id,ten:x.ten,team:"content",da:/Fanpage/.test(x.ten)?"DA-03":"DA-01",nguoi:x.nguoi,phoi:[],han:x.han,uu:"Trung bình",st:x.xong?"done":"todo",loai:x.loai,moTa:x.ghiChu||"",checklist:[],tao:"u_oanh",kq:""})).concat(add);
}
/* ---------- gộp mọi việc thành một danh sách ---------- */
function cardStatus(c){return c.step==="cg"||!c.nguoi?"cg":c.step==="kb"?"todo":["dkb","dvd","dceo"].includes(c.step)?"review":c.step==="xong"?"done":"doing"}
function cardProject(c){const d=D();for(const p of d.projects||[]){const L=p.loc||{};if(L.orders)continue;if(L.tuyen&&!L.tuyen.includes(c.tuyen))continue;if(L.kenh&&!L.kenh.includes(c.kenh))continue;if(L.tuyenNot&&L.tuyenNot.includes(c.tuyen))continue;if(L.toiNgay&&c.day>L.toiNgay)continue;if(L.tuNgay&&c.day<L.tuNgay)continue;return p.id}return c.order?"DA-06":""}
function cvItems(){
  const d=D(),today=d.settings.today,out=[];
  d.cards.forEach(c=>{const st=cardStatus(c),late=st!=="done"&&isLate(c);out.push({id:c.id,src:"card",ten:c.hookText||c.yTuong||c.tuyen,mo:`${chOf(c.kenh).short} · ${sk(c.sku).n} · ${c.tuyen||c.nguon}`,team:"content",da:cardProject(c),nguoi:c.nguoi||"",phoi:[],han:(c.han&&WORK_STEPS.includes(c.step))?c.han:c.day,batDau:c.batDau||0,uu:c.uuTien||"Trung bình",st,late,lateD:late?Math.max(1,today-((c.han&&WORK_STEPS.includes(c.step))?c.han:c.day)):0,loai:"Video "+(stepName(c.step)||"")})});
  d.orders.forEach(o=>{const st=o.trangThai==="Xong"?"done":o.trangThai==="Mới"&&!o.giao?"cg":o.trangThai==="Mới"?"todo":"doing",late=st!=="done"&&o.han<today;out.push({id:o.ma,src:"order",ten:"Order: "+o.muc,mo:`${o.kenh} · ${sk(o.sku).n} · ${o.sl} video`,team:"digital",da:"DA-06",nguoi:o.giao||"",phoi:[o.nguoiOrder],han:o.han,uu:"Cao",st,late,lateD:late?today-o.han:0,loai:"Order Digital → Content"})});
  (d.tasks||[]).forEach(t=>{const late=t.st!=="done"&&t.han<today;out.push({id:t.id,src:"task",ten:t.ten,mo:t.moTa||"",team:t.team,da:t.da,nguoi:t.nguoi,phoi:t.phoi||[],han:t.han,uu:t.uu,st:t.st,late,lateD:late?today-t.han:0,loai:t.loai||"Việc",ck:t.checklist||[]})});
  return out;
}
let CVF={scope:"",team:"",nguoi:"",da:"",st:"",uu:"",q:"",tg:"all",view:"grid"};
function cvScopeOpts(){const t=teamOf(ME),o=[["mine","Việc của tôi"]];if(ME.role==="lead"||ME.role==="truongphong"||t==="digital")o.push(["team","Cả team "+(TEAMS[t]||"")]);if(["admin","truongphong"].includes(ME.role)||can(ME,"viec.giao"))o.push(["all","Tất cả"]);return o}
function cvFilter(L){
  const d=D(),me=ME.id,t=teamOf(ME),today=d.settings.today,W=WEEKS.find(w=>today>=w.tu&&today<=w.den)||WEEKS[0],LW=WEEKS.find(w=>w.w===W.w-1)||W;
  if(!CVF.scope)CVF.scope=ME.role==="admin"?"all":ME.role==="lead"?"team":"mine";
  return L.filter(x=>{
    if(CVF.scope==="mine"&&x.nguoi!==me&&!x.phoi.includes(me))return false;
    if(CVF.scope==="team"&&t!=="all"&&x.team!==t&&!(t==="content"&&x.src==="order")&&!(t==="mkt"&&["content","digital","koc"].includes(x.team)))return false;
    if(CVF.team&&x.team!==CVF.team)return false;if(CVF.nguoi&&x.nguoi!==CVF.nguoi&&!x.phoi.includes(CVF.nguoi))return false;if(CVF.da&&x.da!==CVF.da)return false;if(CVF.st&&(CVF.st==="late"?!x.late:x.st!==CVF.st))return false;if(CVF.uu&&x.uu!==CVF.uu)return false;
    if(CVF.q&&!(x.ten+" "+x.mo+" "+x.id+" "+userName(x.nguoi)).toLowerCase().includes(CVF.q.toLowerCase()))return false;
    if(CVF.tg==="today"&&x.han!==today)return false;if(CVF.tg==="week"&&(x.han<W.tu||x.han>W.den))return false;if(CVF.tg==="lweek"&&(x.han<LW.tu||x.han>LW.den))return false;
    return true});
}
function cvFilterBar(opts={}){const d=D();return `<div class="cvf"><div class="cvrow"><div class="chips"><b>Thời gian</b>${[["all","Cả tháng"],["today","Hôm nay"],["week","Tuần này"],["lweek","Tuần trước"]].map(([k,t])=>`<button class="chip${CVF.tg===k?" on":""}" data-tg="${k}">${t}</button>`).join("")}</div>
  <div class="chips"><b>Xem</b>${cvScopeOpts().map(([k,t])=>`<button class="chip${CVF.scope===k?" on":""}" data-sc="${k}">${t}</button>`).join("")}</div></div>
  <div class="frow"><input id="cv-q" placeholder="Tìm việc, mã thẻ, người…" value="${esc(CVF.q)}"><select id="cv-team">${opt([["","Mọi team"]].concat(Object.entries(TEAMS)),CVF.team)}</select><select id="cv-ng">${opt([["","Mọi người"]].concat(d.users.filter(u=>u.active&&u.role!=="admin").map(u=>[u.id,u.name])),CVF.nguoi)}</select><select id="cv-da">${opt([["","Mọi dự án"]].concat((d.projects||[]).map(p=>[p.id,p.ten])),CVF.da)}</select>${opts.noSt?"":`<select id="cv-st">${opt([["","Mọi trạng thái"],["late","Quá hạn"]].concat(CV_ST.map(s=>[s[0],s[1]])),CVF.st)}</select>`}<select id="cv-uu">${opt([["","Mọi mức ưu tiên"]].concat(UU),CVF.uu)}</select></div></div>`}
function bindCvFilter(m){
  m.querySelectorAll("[data-tg]").forEach(b=>b.onclick=()=>{CVF.tg=b.dataset.tg;renderMain()});m.querySelectorAll("[data-sc]").forEach(b=>b.onclick=()=>{CVF.scope=b.dataset.sc;renderMain()});
  [["cv-q","q"],["cv-team","team"],["cv-ng","nguoi"],["cv-da","da"],["cv-st","st"],["cv-uu","uu"]].forEach(([id,k])=>{const e=$("#"+id);if(e)e.onchange=()=>{CVF[k]=e.value;renderMain()}});
}
const prjN=id=>((D().projects||[]).find(p=>p.id===id)||{ten:""}).ten;
const avatar=id=>{const n=userName(id);return n?`<i class="av">${esc(n.trim().split(" ").pop()[0])}</i>`:""};
function cvCard(x){const ed=x.src==="task"&&(can(ME,"viec.giao")||x.nguoi===ME.id||x.phoi.includes(ME.id));return `<div class="cvc ${x.late?"late":x.st==="done"?"done":""}" data-cv="${x.id}" data-src="${x.src}">
  <div class="cvh">${x.src==="task"&&ed?`<select data-cvst="${x.id}" class="sts st-${x.st}">${opt(CV_ST.filter(s=>s[0]!=="cg").map(s=>[s[0],s[1]]),x.st)}</select>`:pill(cvStN(x.st),(CV_ST.find(s=>s[0]===x.st)||[])[2])}${pill(x.uu.toUpperCase(),x.uu==="Cao"?"red":x.uu==="Thấp"?"gry":"amb")}<span class="sp"></span><span class="hint">${esc(x.loai)}</span></div>
  <b class="cvt${x.st==="done"?" strike":""}">${esc(x.ten)}</b><div class="cvm">${esc(x.mo)}</div>
  <div class="cvtags">${x.da?`<span>📁 ${esc(prjN(x.da))}</span>`:""}<span>👥 ${TEAMS[x.team]||x.team}</span>${x.ck&&x.ck.length?`<span>☑ ${x.ck.filter(c=>c.x).length}/${x.ck.length}</span>`:""}</div>
  <div class="cvf2"><span class="who">${avatar(x.nguoi)}${esc(userName(x.nguoi)||"Chưa giao")}${x.phoi.length?`<small> +${x.phoi.map(userName).filter(Boolean).join(", ")}</small>`:""}</span><span class="${x.late?"t-red":x.st==="done"?"t-grn":"hint"}">${x.late?`⚠ Quá hạn ${x.lateD} ngày`:x.st==="done"?"✓ Xong":"Hạn "+dd(x.han)}</span></div></div>`}
function bindCvCards(m){
  m.querySelectorAll("[data-cvst]").forEach(s=>{s.onclick=e=>e.stopPropagation();s.onchange=()=>{DB.mutate(ME.name,"đổi trạng thái việc",dt=>{const t=dt.tasks.find(x=>x.id===s.dataset.cvst);t.st=s.value});toast("Đã cập nhật");renderMain()}});
  m.querySelectorAll("[data-cv]").forEach(e=>e.onclick=ev=>{if(ev.target.closest("select,button,input"))return;const src=e.dataset.src,id=e.dataset.cv;if(src==="card")openCard(id);else if(src==="order"){PAGE="order";MOD="";render()}else openTask(id)});
}
function openTask(id){
  const d=D(),t=id?d.tasks.find(x=>x.id===id):null,ed=can(ME,"viec.giao")||!t||t.nguoi===ME.id||(t.phoi||[]).includes(ME.id),gv=can(ME,"viec.giao")||!t;
  const users=d.users.filter(u=>u.active&&u.role!=="admin"||u.id===ME.id);
  openDrawerHTML(`<h2>${t?"Nhiệm vụ":"Tạo nhiệm vụ"}</h2><form class="frm" id="tkf2"><label class="field">Tên việc<input id="t-ten" required value="${esc(t?t.ten:"")}" ${gv?"":"disabled"}></label><label class="field">Mô tả<textarea id="t-mo" rows="2" ${gv?"":"disabled"}>${esc(t?t.moTa:"")}</textarea></label>
   <div class="row4"><label class="field">Team<select id="t-team" ${gv?"":"disabled"}>${opt(Object.entries(TEAMS),t?t.team:(TEAMS[teamOf(ME)]?teamOf(ME):"content"))}</select></label><label class="field">Dự án<select id="t-da" ${gv?"":"disabled"}>${opt([["","—"]].concat((d.projects||[]).map(p=>[p.id,p.ten])),t?t.da:CVF.da)}</select></label></div>
   <div class="row4"><label class="field">Người làm<select id="t-ng" ${gv?"":"disabled"}>${opt([["","— chưa giao"]].concat(users.map(u=>[u.id,u.name+" · "+(TEAMS[teamOf(u)]||"Quản lý")])),t?t.nguoi:(gv?"":ME.id))}</select></label><label class="field">Hạn<select id="t-han" ${gv?"":"disabled"}>${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]),t?t.han:Math.min(MONTH.ndays,d.settings.today+2))}</select></label><label class="field">Ưu tiên<select id="t-uu" ${gv?"":"disabled"}>${opt(UU,t?t.uu:"Trung bình")}</select></label><label class="field">Trạng thái<select id="t-st" ${ed?"":"disabled"}>${opt(CV_ST.filter(s=>s[0]!=="cg").map(s=>[s[0],s[1]]),t?t.st:"todo")}</select></label></div>
   <div class="field">Người phối hợp<div class="phc">${users.map(u=>`<label class="ck sm"><input type="checkbox" name="t-phoi" value="${u.id}" ${t&&(t.phoi||[]).includes(u.id)?"checked":""} ${gv?"":"disabled"}> ${esc(u.name)}</label>`).join("")}</div></div>
   <div class="field">Việc nhỏ cần tích<div id="t-ck">${(t?t.checklist:[]).map((c,i)=>`<label class="ck"><input type="checkbox" data-ck="${i}" ${c.x?"checked":""} ${ed?"":"disabled"}> ${esc(c.t)}</label>`).join("")}</div>${gv?`<input id="t-ckn" placeholder="Thêm việc nhỏ, Enter để thêm">`:""}</div>
   <label class="field">Link kết quả (Drive, bài đăng…)<input id="t-kq" value="${esc(t?t.kq:"")}" ${ed?"":"disabled"}></label>
   ${ed?`<div class="acts"><button class="btn pri">${t?"Lưu":"Giao việc"}</button>${t&&gv?`<button type="button" class="btn danger" id="t-del">Xóa</button>`:""}</div>`:""}</form>`);
  const ck=t?JSON.parse(JSON.stringify(t.checklist||[])):[];
  if($("#t-ckn"))$("#t-ckn").onkeydown=e=>{if(e.key!=="Enter")return;e.preventDefault();const v=e.target.value.trim();if(!v)return;ck.push({t:v,x:false});$("#t-ck").insertAdjacentHTML("beforeend",`<label class="ck"><input type="checkbox" data-ck="${ck.length-1}"> ${esc(v)}</label>`);e.target.value=""};
  $("#tkf2").onsubmit=e=>{e.preventDefault();$("#tkf2").querySelectorAll("[data-ck]").forEach(x=>{if(ck[+x.dataset.ck])ck[+x.dataset.ck].x=x.checked});
    const v={ten:$("#t-ten").value,moTa:$("#t-mo").value,team:$("#t-team").value,da:$("#t-da").value,nguoi:$("#t-ng").value,han:+$("#t-han").value,uu:$("#t-uu").value,st:$("#t-st").value,phoi:[...document.querySelectorAll("[name=t-phoi]:checked")].map(x=>x.value),checklist:ck,kq:$("#t-kq").value};
    DB.mutate(ME.name,(t?"cập nhật việc: ":"giao việc: ")+v.ten+(v.nguoi?" → "+userName(v.nguoi):""),dt=>{if(t)Object.assign(dt.tasks.find(x=>x.id===t.id),gv?v:{st:v.st,checklist:v.checklist,kq:v.kq});else dt.tasks.push({id:uid("cv"),...v,loai:"Việc",tao:ME.id})});toast(t?"Đã lưu":"Đã giao");closeDrawer();renderMain()};
  if($("#t-del"))$("#t-del").onclick=()=>{if(!confirm("Xóa việc này?"))return;DB.mutate(ME.name,"xóa việc "+t.ten,dt=>dt.tasks=dt.tasks.filter(x=>x.id!==t.id));closeDrawer();renderMain()};
}
const newTaskBtn=()=>`<button class="btn pri" id="cv-new">＋ Tạo nhiệm vụ</button>`;
const bindNew=()=>{if($("#cv-new"))$("#cv-new").onclick=()=>openTask(null)};

/* ---------- 1. Tổng quan công việc ---------- */
function pCvTong(m){
  const d=D(),today=d.settings.today,L=cvFilter(cvItems()),done=L.filter(x=>x.st==="done"),late=L.filter(x=>x.late),doing=L.filter(x=>x.st==="doing"),rv=L.filter(x=>x.st==="review"),cg=L.filter(x=>x.st==="cg"),due=L.filter(x=>x.han<=today),onT=due.filter(x=>x.st==="done"||!x.late);
  const pct=L.length?Math.round(done.length/L.length*100):0,hr=new Date().getHours();
  const prj=(d.projects||[]).map(p=>{const I=cvItems().filter(x=>x.da===p.id);return {p,n:I.length,ok:I.filter(x=>x.st==="done").length,late:I.filter(x=>x.late).length}});
  const ppl=[...new Set(L.map(x=>x.nguoi).filter(Boolean))].map(u=>{const I=L.filter(x=>x.nguoi===u);return {u,n:I.length,doing:I.filter(x=>["todo","doing","review"].includes(x.st)).length,done:I.filter(x=>x.st==="done").length,late:I.filter(x=>x.late).length}}).sort((a,b)=>b.late-a.late||b.doing-a.doing);
  const days=Array.from({length:7},(_,i)=>today-6+i).filter(x=>x>=1);
  const st=(cls,t,v,h)=>`<div class="sc ${cls}"><div class="l">${t}</div><div class="v">${v}</div><span>${h}</span></div>`;
  m.innerHTML=`<div class="cvhero"><div><div class="hint">${dayLbl(today)}/${MONTH.year}</div><h1>Chào ${hr<11?"buổi sáng":hr<14?"buổi trưa":hr<18?"buổi chiều":"buổi tối"}, ${esc(ME.name)} 👋</h1><p>${CVF.scope==="mine"?"Bạn":CVF.scope==="team"?"Team":"Cả công ty"} có <b class="t-red">${late.length} việc quá hạn</b> cần xử lý và <b>${doing.length+rv.length} việc</b> đang thực hiện.</p><div class="acts">${newTaskBtn()}<button class="btn" id="cv-late">⚠ Xem ${late.length} việc quá hạn</button></div></div>
   <div class="donut"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#eef1f7" stroke-width="5"/><circle cx="21" cy="21" r="15.9" fill="none" stroke="#2f9e44" stroke-width="5" stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="25"/></svg><b>${pct}%</b><ul><li><i style="background:#2f9e44"></i>${done.length}/${L.length} xong</li><li><i style="background:#3b5bdb"></i>${doing.length+rv.length} đang làm</li><li><i style="background:#e03131"></i>${late.length} quá hạn</li></ul></div></div>
  ${cvFilterBar({noSt:true})}
  <div class="scs">${st("s1","Tổng nhiệm vụ",L.length,pct+"% hoàn thành")}${st("s2","Đang thực hiện",doing.length,"đang chạy")}${st("s3","Hoàn thành",done.length,pct+"% tổng")}${st("s4","Quá hạn",late.length,"cần xử lý ngay")}${st("s5","Tỷ lệ đúng hạn",due.length?Math.round(onT.length/due.length*100)+"%":"—",onT.length+"/"+due.length+" việc tới hạn")}${st("s6","Chờ duyệt",rv.length,"kịch bản, video, việc")}${st("s7","Chưa giao",cg.length,"chưa có người làm")}${st("s8","Dự án trễ",prj.filter(x=>x.late).length,"có việc quá hạn")}</div>
  <div class="xgrid"><section class="card"><div class="card-h"><h2>Việc 7 ngày qua</h2><span class="hint">theo hạn: xong / chưa xong</span></div><div class="d7">${days.map(dy=>{const I=L.filter(x=>x.han===dy),ok=I.filter(x=>x.st==="done").length,mx=Math.max(1,...days.map(z=>L.filter(x=>x.han===z).length));return `<div><div class="bw"><i class="ok" style="height:${ok/mx*100}%"></i><i class="no" style="height:${(I.length-ok)/mx*100}%"></i></div><b>${I.length}</b><span>${dayLbl(dy).split(" ")[0]}</span></div>`}).join("")}</div></section>
   <section class="card"><div class="card-h"><h2>Khối lượng theo người</h2><span class="hint">ai đang ôm nhiều, ai trễ</span></div>${tbl(["Người","Team","Đang làm","Xong","Quá hạn","Đúng hạn"],ppl.map(r=>{const u=D().users.find(x=>x.id===r.u)||{};const du=L.filter(x=>x.nguoi===r.u&&x.han<=today),ok=du.filter(x=>x.st==="done"||!x.late).length;return `<tr class="clk" data-pf="${r.u}"><td>${avatar(r.u)}<b>${esc(u.name||"")}</b></td><td>${TEAMS[teamOf(u)]||""}</td><td class="n">${r.doing}</td><td class="n">${r.done}</td><td class="n">${r.late?pill(r.late,"red"):0}</td><td class="n">${du.length?Math.round(ok/du.length*100)+"%":"—"}</td></tr>`}))}</section></div>
  <section class="card"><div class="card-h"><h2>Dự án đang chạy</h2><button class="lnk" data-go="cv_da">Tất cả dự án →</button></div><div class="prjs">${prj.map(x=>`<div class="prj clk" data-pj="${x.p.id}"><b>${esc(x.p.ten)}</b><span class="hint">${TEAMS[x.p.team]} · ${esc(userName(x.p.owner))} · hạn ${dd(x.p.han)}</span><div class="progress"><i style="width:${x.n?x.ok/x.n*100:0}%"></i></div><span>${x.ok}/${x.n} việc xong${x.late?` · <b class="t-red">${x.late} quá hạn</b>`:""}</span></div>`).join("")}</div></section>`;
  bindCvFilter(m);bindNew();$("#cv-late").onclick=()=>{CVF.st="late";PAGE="cv_nv";render()};
  m.querySelectorAll("[data-pf]").forEach(r=>r.onclick=()=>{CVF.nguoi=r.dataset.pf;CVF.scope="all";PAGE="cv_kb";render()});
  m.querySelectorAll("[data-pj]").forEach(r=>r.onclick=()=>{CVF.da=r.dataset.pj;PAGE="cv_kb";render()});
}
/* ---------- 2. Nhiệm vụ ---------- */
function pCvNv(m){
  const L=cvFilter(cvItems()).sort((a,b)=>(b.late-a.late)||(a.st==="done")-(b.st==="done")||a.han-b.han);
  m.innerHTML=H("Task",`${L.length} việc`)+`<div class="filters"><span class="sp"></span><button class="btn sm${CVF.view==="grid"?" pri":""}" data-vw="grid">Thẻ</button><button class="btn sm${CVF.view==="list"?" pri":""}" data-vw="list">Danh sách</button><button class="btn" id="cv-xl">⬇ Excel</button>${newTaskBtn()}</div>${cvFilterBar()}
  ${CVF.view==="grid"?`<div class="cvgrid">${L.slice(0,120).map(cvCard).join("")||`<p class="empty">Không có việc.</p>`}</div>${L.length>120?`<p class="hint">Đang hiện 120/${L.length} việc, lọc thêm để xem hết.</p>`:""}`:`<section class="card">${tbl(["Việc","Loại","Dự án","Người làm","Hạn","Ưu tiên","Trạng thái"],L.map(x=>`<tr class="clk" data-cv="${x.id}" data-src="${x.src}"><td><b>${esc(x.ten)}</b><small>${esc(x.mo)}</small></td><td>${esc(x.loai)}</td><td>${esc(prjN(x.da))}</td><td>${esc(userName(x.nguoi)||"—")}</td><td>${x.late?`<span class="t-red">${dd(x.han)} · trễ ${x.lateD}n</span>`:dd(x.han)}</td><td>${x.uu}</td><td>${pill(cvStN(x.st),(CV_ST.find(s=>s[0]===x.st)||[])[2])}</td></tr>`))}</section>`}`;
  bindCvFilter(m);bindCvCards(m);bindNew();m.querySelectorAll("[data-vw]").forEach(b=>b.onclick=()=>{CVF.view=b.dataset.vw;renderMain()});
  $("#cv-xl").onclick=()=>{if(typeof XLSX==="undefined"){toast("Cần mạng để xuất Excel");return}const ws=XLSX.utils.aoa_to_sheet([["Mã","Việc","Mô tả","Loại","Team","Dự án","Người làm","Hạn","Ưu tiên","Trạng thái","Quá hạn (ngày)"]].concat(L.map(x=>[x.id,x.ten,x.mo,x.loai,TEAMS[x.team]||x.team,prjN(x.da),userName(x.nguoi),dd(x.han)+"/"+MONTH.year,x.uu,cvStN(x.st),x.lateD||""])));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Nhiem vu");XLSX.writeFile(wb,`Nhiem-vu-T${MONTH.mon}.xlsx`)};
}
/* ---------- 3. Tiến độ (bảng cột) ---------- */
function pCvKb(m){
  const L=cvFilter(cvItems());
  m.innerHTML=H("Bảng tiến độ","Kéo thẻ việc sang cột khác để đổi trạng thái · thẻ video đi theo các bước riêng (bấm để mở)")+`<div class="filters"><span class="sp"></span>${newTaskBtn()}</div>${cvFilterBar({noSt:true})}
  <div class="kbx">${CV_ST.map(([k,t,c])=>{const I=L.filter(x=>x.st===k).sort((a,b)=>(b.late-a.late)||a.han-b.han);return `<div class="kcol" data-drop="${k}"><div class="kh"><i class="dot d-${c}"></i><b>${t}</b><span>${I.length}</span></div>${I.slice(0,40).map(x=>cvCard(x).replace('class="cvc','draggable="'+(x.src==="task")+'" class="cvc')).join("")}${I.length>40?`<p class="hint">+${I.length-40} việc nữa</p>`:""}</div>`}).join("")}</div>`;
  bindCvFilter(m);bindCvCards(m);bindNew();
  m.querySelectorAll('.cvc[draggable="true"]').forEach(c=>c.ondragstart=e=>e.dataTransfer.setData("text",c.dataset.cv));
  m.querySelectorAll("[data-drop]").forEach(col=>{col.ondragover=e=>{e.preventDefault();col.classList.add("ov")};col.ondragleave=()=>col.classList.remove("ov");col.ondrop=e=>{e.preventDefault();col.classList.remove("ov");const id=e.dataTransfer.getData("text"),to=col.dataset.drop;if(to==="cg"){toast("Việc đã giao không chuyển về Chưa giao");return}const t=D().tasks.find(x=>x.id===id);if(!t)return;if(!(can(ME,"viec.giao")||t.nguoi===ME.id||(t.phoi||[]).includes(ME.id))){toast("Bạn không phụ trách việc này");return}DB.mutate(ME.name,`chuyển "${t.ten}" → ${cvStN(to)}`,dt=>dt.tasks.find(x=>x.id===id).st=to);renderMain()}});
}
/* ---------- 4. Lịch tháng ---------- */
function pCvLich(m){
  const d=D(),L=cvFilter(cvItems()),today=d.settings.today,lead=(MONTH.first+7)%7,cells=[];for(let i=0;i<MONTH.first;i++)cells.push(0);for(let i=1;i<=MONTH.ndays;i++)cells.push(i);while(cells.length%7)cells.push(0);
  m.innerHTML=H(`Lịch tháng ${MONTH.mon}/${MONTH.year}`,"Hạn việc · buổi quay · hạn dự án")+`<div class="filters"><span class="lg"><i class="dot d-blu"></i>Việc</span><span class="lg"><i class="dot d-vio"></i>Buổi quay</span><span class="lg"><i class="dot d-grn"></i>Hạn dự án</span><span class="lg"><i class="dot d-red"></i>Quá hạn</span><span class="sp"></span>${newTaskBtn()}</div>${cvFilterBar({noSt:false})}
  <section class="card flush"><div class="mcal"><div class="mh">${THU.map(t=>`<div>${t}</div>`).join("")}</div><div class="mg2">${cells.map(dy=>{if(!dy)return `<div class="mc off"></div>`;const I=L.filter(x=>x.han===dy&&x.src!=="card"),V=L.filter(x=>x.han===dy&&x.src==="card"),S=(d.shoots||[]).filter(s=>s.day===dy),P=(d.projects||[]).filter(p=>p.han===dy);const ev=[...P.map(p=>`<div class="me2 prjd">📁 ${esc(p.ten)}</div>`),...S.map(s=>`<div class="me2 shd">🎬 ${esc(s.gio||"")} ${esc(s.diaDiem)}</div>`),...I.map(x=>`<div class="me2 ${x.late?"lt":x.st==="done"?"dn":""}" data-cv="${x.id}" data-src="${x.src}">${esc(x.ten)}</div>`)];const lateV=V.filter(x=>x.late).length;
    return `<div class="mc${dy===today?" td":""}"><span class="dn2">${dy}</span>${ev.slice(0,3).join("")}${ev.length>3?`<span class="more">+${ev.length-3} mục</span>`:""}${V.length?`<div class="me2 vd clk" data-vday="${dy}">🎞 ${V.length} video${lateV?` · <b>${lateV} trễ</b>`:""}</div>`:""}</div>`}).join("")}</div></div></section>`;
  bindCvFilter(m);bindCvCards(m);bindNew();m.querySelectorAll("[data-vday]").forEach(b=>b.onclick=()=>{PAGE="lich";MOD="";render()});
}
/* ---------- 5. Dự án ---------- */
function pCvDa(m){
  const d=D(),I=cvItems(),ed=can(ME,"viec.giao");
  m.innerHTML=H("Dự án",`${(d.projects||[]).length} dự án tháng ${MONTH.mon}`)+`<div class="prjgrid">${(d.projects||[]).map(p=>{const L=I.filter(x=>x.da===p.id),ok=L.filter(x=>x.st==="done").length,late=L.filter(x=>x.late).length,pc2=L.length?Math.round(ok/L.length*100):0,exp=Math.min(100,Math.round(d.settings.today/p.han*100));return `<section class="card prjc"><div class="card-h"><h2>${esc(p.ten)}</h2>${pill(late?"Có việc trễ":pc2>=exp-10?"Đúng tiến độ":"Chậm",late?"red":pc2>=exp-10?"grn":"amb")}</div><p class="hint">${esc(p.moTa)}</p><div class="kv2"><span>Team <b>${TEAMS[p.team]}</b></span><span>Phụ trách <b>${esc(userName(p.owner))}</b></span><span>Hạn <b>${dd(p.han)}</b></span></div><div class="progress big"><i style="width:${pc2}%"></i><em style="left:${exp}%"></em></div><div class="kv2"><span><b>${pc2}%</b> xong (${ok}/${L.length})</span><span>đáng lẽ ~${exp}%</span>${late?`<span class="t-red"><b>${late}</b> quá hạn</span>`:""}</div><div class="acts"><button class="btn sm" data-pjk="${p.id}">Xem tiến độ</button><button class="btn sm" data-pjn="${p.id}">Danh sách việc</button></div></section>`}).join("")}</div>
  ${ed?`<section class="card"><div class="card-h"><h2>Thêm dự án / chiến dịch</h2></div><form class="frm row7" id="pjf"><label class="field grow">Tên dự án<input id="pj-t" required placeholder="VD: Sale 11/11"></label><label class="field">Team<select id="pj-team">${opt(Object.entries(TEAMS),"content")}</select></label><label class="field">Phụ trách<select id="pj-o">${opt(d.users.filter(u=>u.active).map(u=>[u.id,u.name]),ME.id)}</select></label><label class="field">Hạn<select id="pj-h">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]),MONTH.ndays)}</select></label><button class="btn pri">Thêm</button></form></section>`:""}`;
  m.querySelectorAll("[data-pjk]").forEach(b=>b.onclick=()=>{CVF.da=b.dataset.pjk;CVF.scope=["admin","lead"].includes(ME.role)?"all":CVF.scope;PAGE="cv_kb";render()});
  m.querySelectorAll("[data-pjn]").forEach(b=>b.onclick=()=>{CVF.da=b.dataset.pjn;CVF.scope=["admin","lead"].includes(ME.role)?"all":CVF.scope;PAGE="cv_nv";render()});
  if($("#pjf"))$("#pjf").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"thêm dự án "+$("#pj-t").value,dt=>dt.projects.push({id:"DA-"+String(dt.projects.length+1).padStart(2,"0"),ten:$("#pj-t").value,team:$("#pj-team").value,owner:$("#pj-o").value,han:+$("#pj-h").value,moTa:"",loc:{none:true,kenh:["__"]}}));renderMain()};
}
/* ---------- MỤC TIÊU: giao mục tiêu theo tháng cho từng người / team ----------
   Team Ads: mục tiêu doanh số từng bạn chạy Ads, kết quả tự lấy từ báo cáo Digital.
   Mục tiêu khác: người giao tự ghi chỉ tiêu, con số, hạn; người làm cập nhật kết quả. */
function pCvMt(m){
  const d=D(),ed=can(ME,"viec.giao")||can(ME,"kehoach.duyet"),mon=MONTH.key,G=(d.goals||{})[mon]||[];
  const P=(typeof KDX!=="undefined"&&KDX.adsPeople)||[],A=typeof adsSum==="function"?adsSum():{};
  const adsRows=P.map(p=>{const tg=typeof adsTarget==="function"?adsTarget(p.n):p.kpi,dt=(A[p.n]&&A[p.n].n?A[p.n].dt:p.dt)||0;return {n:p.n,tg,dt}});
  const mine=g=>g.nguoi===ME.id;
  m.innerHTML=H("Mục tiêu",`Tháng ${MONTH.mon}/${MONTH.year} · giao mục tiêu cho từng người, theo dõi % đạt`)+
  (P.length?`<section class="card"><div class="card-h"><h2>Team Digital – Ads Facebook · mục tiêu doanh số tháng ${typeof ADS_TG_M!=="undefined"?+ADS_TG_M.slice(5):MONTH.mon}</h2><span class="hint">tháng có số Ads gần nhất · kết quả tự lấy từ báo cáo Digital</span></div>${tbl(["Nhân sự","Mục tiêu doanh số","Doanh số mang về","% đạt"],adsRows.map(r=>`<tr><td><b>${esc(r.n)}</b></td><td class="n">${ed?`<input class="num" data-atg="${esc(r.n)}" value="${Math.round(r.tg/1e6)}" style="width:80px"> tr`:tr(r.tg)}</td><td class="n">${tr(r.dt)}</td><td class="n">${pill(pc(r.dt,r.tg),r.dt>=r.tg?"grn":"amb")}</td></tr>`))}</section>`:"")+
  `<section class="card"><div class="card-h"><h2>Mục tiêu khác</h2><span class="hint">${G.length} mục tiêu</span></div>${tbl(["Người / team","Mục tiêu","Con số","Kết quả","% đạt","Hạn",""],G.map((g,i)=>{const pct=g.so?(g.kq||0)/g.so:0;return `<tr><td><b>${esc(userName(g.nguoi)||TEAMS[g.team]||g.team||"—")}</b></td><td>${esc(g.ten)}</td><td class="n">${nf(g.so||0)} ${esc(g.dv||"")}</td><td class="n">${ed||mine(g)?`<input class="num" data-gkq="${i}" value="${g.kq||0}" style="width:90px">`:nf(g.kq||0)}</td><td class="n">${g.so?pill(Math.round(pct*100)+"%",pct>=1?"grn":"amb"):"—"}</td><td>${g.han?dayLbl(g.han):"—"}</td><td>${ed?`<button class="btn sm danger" data-gx="${i}">Xóa</button>`:""}</td></tr>`}))}</section>
  ${ed?`<section class="card"><div class="card-h"><h2>Giao mục tiêu</h2></div><form class="frm row7" id="gf"><label class="field">Người nhận<select id="g-n">${opt([["","— cả team"]].concat(d.users.filter(u=>u.active).map(u=>[u.id,u.name])),"")}</select></label><label class="field">Team<select id="g-t">${opt(Object.entries(TEAMS),"")}</select></label><label class="field grow">Mục tiêu<input id="g-ten" required placeholder="VD: Số video đăng TikTok chính"></label><label class="field">Con số<input id="g-so" type="number" required></label><label class="field">Đơn vị<input id="g-dv" placeholder="video, đơn, triệu…"></label><label class="field">Hạn (ngày)<input id="g-han" type="number" min="1" max="31"></label><button class="btn pri">Giao</button></form></section>`:""}`;
  m.querySelectorAll("[data-atg]").forEach(i=>i.onchange=()=>{const n=i.dataset.atg,v=Math.round((+String(i.value).replace(",",".")||0)*1e6);DB.mutate(ME.name,`giao mục tiêu Ads tháng ${MONTH.mon} cho ${n}: ${tr(v)}`,dt=>{dt.adsTargets=dt.adsTargets||{};(dt.adsTargets[typeof ADS_TG_M!=="undefined"?ADS_TG_M:mon]=dt.adsTargets[typeof ADS_TG_M!=="undefined"?ADS_TG_M:mon]||{})[n]=v});toast("Đã giao mục tiêu");renderMain()});
  m.querySelectorAll("[data-gkq]").forEach(i=>i.onchange=()=>{const k=+i.dataset.gkq;DB.mutate(ME.name,"cập nhật kết quả mục tiêu",dt=>{dt.goals[mon][k].kq=+i.value||0});renderMain()});
  m.querySelectorAll("[data-gx]").forEach(b=>b.onclick=()=>{const k=+b.dataset.gx;DB.mutate(ME.name,"xóa mục tiêu",dt=>{dt.goals[mon].splice(k,1)});renderMain()});
  if($("#gf"))$("#gf").onsubmit=e=>{e.preventDefault();const g={id:uid("mt"),nguoi:$("#g-n").value,team:$("#g-t").value,ten:$("#g-ten").value.trim(),so:+$("#g-so").value||0,dv:$("#g-dv").value.trim(),han:+$("#g-han").value||0,kq:0,giao:ME.id};DB.mutate(ME.name,"giao mục tiêu: "+g.ten+(g.nguoi?" → "+userName(g.nguoi):""),dt=>{dt.goals=dt.goals||{};(dt.goals[mon]=dt.goals[mon]||[]).push(g)});toast("Đã giao mục tiêu");renderMain()};
}
Object.assign(PAGES,{cv_mt:pCvMt,cv_tq:pCvTong,cv_nv:pCvNv,cv_kb:pCvKb,cv_lich:pCvLich,cv_da:pCvDa});
