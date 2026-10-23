/* =====================================================================
   CÔNG VIỆC & DỰ ÁN — một chỗ cho mọi việc (thẻ video, order Digital, việc chung)
   Phạm vi xem: Của tôi · Cả team · Tất cả (theo vai trò). Ưu tiên Content & Digital.
   ===================================================================== */
const TEAMS={content:"Content",digital:"Digital – Ads",koc:"KOC",ketoan:"Kế toán",kho:"Kho",sx:"Sản xuất",hcns:"Hành chính nhân sự",sale:"Sale",chung:"Chung"};
const CV_ST=[["cg","Chưa giao","gry"],["todo","Cần làm","gry"],["nhan","Đã nhận việc","blu"],["doing","Đang làm","blu"],["review","Chờ duyệt","amb"],["done","Hoàn thành","grn"]];
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
function cardStatus(c){return c.step==="cg"||!c.nguoi?"cg":(c.step==="kb"||c.step==="dang")?"todo":["dkb","dvd","dceo"].includes(c.step)?"review":c.step==="xong"?"done":"doing"}
function cardProject(c){const d=D();for(const p of d.projects||[]){const L=p.loc||{};if(L.orders)continue;if(L.tuyen&&!L.tuyen.includes(c.tuyen))continue;if(L.kenh&&!L.kenh.includes(c.kenh))continue;if(L.tuyenNot&&L.tuyenNot.includes(c.tuyen))continue;if(L.toiNgay&&c.day>L.toiNgay)continue;if(L.tuNgay&&c.day<L.tuNgay)continue;return p.id}return c.order?"DA-06":""}
/* Gom các việc video giống hệt nhau (cùng người, tên, hạn, trạng thái) thành một dòng "× N video", khỏi mỗi video một task */
const CV_CAT=[["dang","đã đăng"],["duyet","đã duyệt"],["dung","đang dựng"],["sua","đang sửa"],["doi","đợi duyệt"],["quay","đang quay"],["viet","đang viết"],["chua","chưa làm"]];
const cvCat=c=>{const s=c.step;if(s==="xong")return "dang";if(s==="dang")return "duyet";if(["dkb","dvd","dceo"].includes(s))return "doi";if((c.gopy||[]).length&&["kb","edit","worker","quay"].includes(s))return "sua";if(["edit","worker"].includes(s))return "dung";if(s==="quay")return "quay";if(s==="kb"&&(c.nguoiKB||c.hookText||c.noiDung))return "viet";return "chua"};
function cvSegHtml(x){if(!x.cats||!(x.n>1))return "";const done=(x.cats.duyet||0)+(x.cats.dang||0),p=Math.round(done/x.n*100);return `<div class="cvseg"><span class="xpb"><i style="width:${p}%"></i></span><div class="cvsg">${CV_CAT.filter(k=>x.cats[k[0]]).map(k=>`<span class="sg-${k[0]}"><b>${x.cats[k[0]]}</b> ${k[1]}</span>`).join("")}</div></div>`}
function cvGroup(L){const out=[],map={};L.forEach(x=>{if(x.src!=="card"){out.push(Object.assign({},x,{n:1,ids:[x.id]}));return}const k=x.cat==="duyet"?["dang",x.kenh,x.han].join("|"):[x.nguoi,x.kenh,x.sku,x.mix,x.fpId,x.han].join("|"),g=map[k];if(g){g.n++;g.ids.push(x.id);g.cats[x.cat]=(g.cats[x.cat]||0)+1;g.sts.push(x.st);g.late=g.late||x.late;g.lateD=Math.max(g.lateD||0,x.lateD||0)}else{const o=Object.assign({},x,{n:1,ids:[x.id],cats:{[x.cat]:1},sts:[x.st]});map[k]=o;out.push(o)}});
  out.forEach(o=>{if(o.src==="card"){const s=o.sts,same=s.every(v=>v===s[0]);o.st=same?s[0]:"doing";const lb=typeof bvLbl==="function"?bvLbl(o.mix):o.mix;const un=Object.entries(o.cats).filter(([k])=>!["duyet","dang"].includes(k)).sort((x,y)=>y[1]-x[1]),top0=(un[0]||["chua"])[0],mv={ton:"Chọn video tồn",nhanban:"Nhân bản video win",reup:"Reup video",worker:"Làm video Worker",outsource:"Làm video thuê ngoài"},vb=(["viet","chua"].includes(top0)&&mv[o.mix])||((typeof cvVerb!=="undefined"&&cvVerb[top0])||"Làm"),dn=(o.cats.duyet||0)+(o.cats.dang||0);o.ten=o.fpId?`${vb} ${o.n} bài Fanpage · ${dn}/${o.n}`:o.mix==="nhanban"&&vb===mv.nhanban?`Nhân bản ${o.n} video win ${esc(sk(o.sku).n)} · ${dn}/${o.n}`:`${vb} ${o.n} video ${esc(sk(o.sku).n)} · ${dn}/${o.n}`;o.mo=chOf(o.kenh).short+" · "+(o.han?"hạn "+dd(o.han):"CHƯA CÓ HẠN")}
    if(o.src==="card"&&o.cat==="duyet"){o.st="todo";o.ten=(/Fanpage/i.test(o.kenh)?"Bài chờ đăng: ":"Video chờ đăng: ")+o.n;o.mo=chOf(o.kenh).short+" · "+(o.han?"hạn "+dd(o.han):"chưa chọn ngày");if(typeof cvOwner==="function"&&cvOwner(o.kenh))o.nguoi=cvOwner(o.kenh)}});return out}
function cvItems(){
  const d=D(),today=d.settings.today,out=[];
  d.cards.forEach(c=>{const st=cardStatus(c),late=st!=="done"&&isLate(c);out.push({id:c.id,src:"card",kenh:c.kenh,sku:c.sku,mix:mixOf(c),cat:cvCat(c),fpId:c.fpId||"",tuyen:c.tuyen||"",ten:c.hookText||c.yTuong||c.tuyen,mo:`${chOf(c.kenh).short} · ${esc(sk(c.sku).n)} · ${c.tuyen||c.nguon}`,team:"content",da:cardProject(c),nguoi:c.nguoi||"",phoi:[],han:(c.han&&WORK_STEPS.includes(c.step))?c.han:c.day,batDau:c.batDau||0,uu:c.uuTien||"Trung bình",st,late,lateD:late?Math.max(1,today-((c.han&&WORK_STEPS.includes(c.step))?c.han:c.day)):0,loai:"Video "+(stepName(c.step)||"")})});
  d.orders.forEach(o=>{const st=o.trangThai==="Xong"?"done":o.trangThai==="Mới"&&!o.giao?"cg":o.trangThai==="Mới"?"todo":"doing",late=st!=="done"&&o.han<today;out.push({id:o.ma,src:"order",ten:"Order: "+o.muc,mo:`${o.kenh} · ${esc(sk(o.sku).n)} · ${o.sl} video`,team:"digital",da:"DA-06",nguoi:o.giao||"",phoi:[o.nguoiOrder],han:o.han,uu:"Cao",st,late,lateD:late?today-o.han:0,loai:"Order Digital → Content"})});
  (d.tasks||[]).forEach(t=>{const late=t.st!=="done"&&t.han<today,nb=t.loai==="Nhân bản video win"&&typeof cvWinInfo==="function"?cvWinInfo(t):null;out.push({id:t.id,src:"task",ten:nb?nb.ten:t.ten,mo:nb?nb.mo:(t.moTa||""),sub:nb?nb.mo:"",team:t.team,da:t.da,nguoi:t.nguoi,phoi:t.phoi||[],han:t.han,uu:t.uu,st:t.st,late,lateD:late?today-t.han:0,loai:t.loai||"Việc",ck:t.checklist||[],tao:t.tao||"",cd:t.cd||null})});
  return out;
}
const CVG={};
let CVF={scope:"",team:"",nguoi:"",da:"",st:"",uu:"",q:"",tg:"all",view:"grid"};
function cvScopeOpts(){const t=teamOf(ME),o=[["mine","Việc của tôi"]];if(ME.role==="lead"||ME.role==="truongphong"||t==="digital")o.push(["team","Cả team "+(TEAMS[t]||"")]);if(["admin","truongphong"].includes(ME.role)||can(ME,"viec.giao"))o.push(["all","Tất cả"]);return o}
/* một ô chọn duy nhất: Tất cả · Việc của tôi · từng nhân sự. Chị thấy hết; mỗi team chỉ thấy việc của team mình và nhân sự team mình */
const cvTeamSee=(t,tx)=>t==="all"||tx===t||(t==="mkt"&&["content","digital","koc"].includes(tx));
/* Ô chọn gọn: Tất cả · Việc của tôi · từng team (lead, trưởng phòng, chị). Muốn xem một người: gõ tên vào ô tìm. */
/* Khối hành chính nhân sự (trưởng phòng Ban điều hành): chỉ xem hiệu quả từng team, không xem việc hằng ngày của từng người */
const cvSummaryOnly=()=>!!ME&&ME.role==="truongphong"&&ME.phongBan==="BDH";
const cvMgrView=()=>!!ME&&(ME.role==="admin"||ME.role==="lead"||ME.role==="truongphong"||can(ME,"viec.giao"));
const cvTeamName=k=>TEAMS[k]||(k==="mkt"?"Marketing":k);
function cvWhoOpts(){const d=D(),t=teamOf(ME),o=[["all","Tất cả"],["mine","Việc của tôi"]];
  if(cvMgrView()){const ks=[];d.users.forEach(u=>{const k=teamOf(u);if(u.active&&u.role!=="admin"&&k&&k!=="all"&&!ks.includes(k)&&(ME.role==="admin"||can(ME,"viec.giao")||cvTeamSee(t,k)))ks.push(k)});ks.forEach(k=>o.push(["t:"+k,"Team "+cvTeamName(k)]))}
  if(CVF.who&&CVF.who.indexOf("p:")===0&&CVF.nguoi)o.push([CVF.who,userName(CVF.nguoi)]);return o}
function cvWhoSet(v){CVF.who=v;CVF.scope=v==="mine"?"mine":(ME.role==="admin"?"all":"team");CVF.nguoi=v.indexOf("p:")===0?v.slice(2):"";CVF.wt=v.indexOf("t:")===0?v.slice(2):""}
function cvWho(){if(!CVF.who)cvWhoSet(ME.role==="admin"||ME.role==="lead"||ME.role==="truongphong"||can(ME,"viec.giao")?"all":"mine");return CVF.who}
const cvWhoSelect=()=>`<select id="cv-who" aria-label="Xem việc của">${opt(cvWhoOpts(),cvWho())}</select>`;
function cvFilter(L){
  const d=D(),me=ME.id,t=teamOf(ME),today=d.settings.today,W=WEEKS.find(w=>today>=w.tu&&today<=w.den)||WEEKS[0],LW=WEEKS.find(w=>w.w===W.w-1)||W;
  cvWho();
  return L.filter(x=>{
    if(CVF.scope==="mine"&&x.nguoi!==me&&!x.phoi.includes(me))return false;
    if(ME.role!=="admin"&&!cvSummaryOnly()&&t!=="all"&&x.nguoi!==me&&!x.phoi.includes(me)&&!cvTeamSee(t,x.team)&&!(t==="content"&&x.src==="order"))return false;
    if(CVF.wt){const ux=d.users.find(y=>y.id===x.nguoi);if(!ux||!cvTeamSee(CVF.wt,teamOf(ux)))return false}
    if(CVF.tao&&x.tao!==CVF.tao)return false;
    if(CVF.team&&x.team!==CVF.team)return false;if(CVF.nguoi&&x.nguoi!==CVF.nguoi&&!x.phoi.includes(CVF.nguoi))return false;if(CVF.da&&x.da!==CVF.da)return false;if(CVF.st&&(CVF.st==="late"?!x.late:CVF.st==="todo"?!["cg","todo","nhan"].includes(x.st):x.st!==CVF.st))return false;if(CVF.uu&&x.uu!==CVF.uu)return false;
    if(CVF.q&&!(x.ten+" "+x.mo+" "+x.id+" "+userName(x.nguoi)).toLowerCase().includes(CVF.q.toLowerCase()))return false;
    if(CVF.tg==="today"&&x.han!==today)return false;if(CVF.tg==="week"&&(x.han<W.tu||x.han>W.den))return false;if(CVF.tg==="lweek"&&(x.han<LW.tu||x.han>LW.den))return false;
    return true});
}
/* một hàng lọc gọn ở góc phải: tìm · người · thời gian · trạng thái · dự án · nút Giao việc */
function cvFilterBar(opts={}){const d=D();const names=cvMgrView()&&!cvSummaryOnly()?d.users.filter(u=>u.active&&u.role!=="admin").map(u=>`<option value="${esc(u.name)}">`).join(""):"";return `<div class="cvbar"><input id="cv-q" placeholder="${names?"Tìm việc hoặc gõ tên người…":"Tìm việc…"}" value="${esc(CVF.q)}"${names?` list="cv-names" autocomplete="off"`:""}>${names?`<datalist id="cv-names">${names}</datalist>`:""}${cvWhoSelect()}<select id="cv-tg" aria-label="Thời gian">${opt([["all","Cả tháng"],["today","Hôm nay"],["week","Tuần này"],["lweek","Tuần trước"]],CVF.tg)}</select>${opts.noSt?"":`<select id="cv-st" aria-label="Trạng thái">${opt([["","Mọi trạng thái"],["todo","Cần làm"],["doing","Đang làm"],["review","Chờ duyệt"],["done","Hoàn thành"],["late","Trễ hạn"]],CVF.st)}</select>`}<select id="cv-da" aria-label="Dự án">${opt([["","Mọi dự án"]].concat((d.projects||[]).map(p=>[p.id,p.ten])),CVF.da)}</select>${newTaskBtn()}</div>`}
function bindCvFilter(m){
  m.querySelectorAll("[data-tg]").forEach(b=>b.onclick=()=>{CVF.tg=b.dataset.tg;renderMain()});const wh=$("#cv-who");if(wh)wh.onchange=()=>{cvWhoSet(wh.value);renderMain()};
  [["cv-q","q"],["cv-tg","tg"],["cv-team","team"],["cv-da","da"],["cv-st","st"],["cv-uu","uu"]].forEach(([id,k])=>{const e=$("#"+id);if(e)e.onchange=()=>{CVF[k]=e.value;renderMain()}});
  bindNew();
}
const prjN=id=>((D().projects||[]).find(p=>p.id===id)||{ten:""}).ten;
const avatar=id=>{const n=userName(id);return n?`<i class="av">${esc(n.trim().split(" ").pop()[0])}</i>`:""};
function cvCard(x){const ed=x.src==="task"&&(can(ME,"viec.giao")||x.nguoi===ME.id||x.phoi.includes(ME.id));return `<div class="cvc ${x.late?"late":x.st==="done"?"done":""}" data-cv="${x.id}" data-src="${x.src}"${x.n>1?` data-grp="${x.ids.join(",")}"`:""}>
  <div class="cvh">${x.src==="task"&&ed?`<select data-cvst="${x.id}" class="sts st-${x.st}">${opt(CV_ST.filter(s=>s[0]!=="cg").map(s=>[s[0],s[1]]),x.st)}</select>`:pill(cvStN(x.st),(CV_ST.find(s=>s[0]===x.st)||[])[2])}${pill(x.uu.toUpperCase(),x.uu==="Cao"?"red":x.uu==="Thấp"?"gry":"amb")}<span class="sp"></span><span class="hint">${esc(x.loai)}</span></div>
  <b class="cvt${x.st==="done"?" strike":""}">${esc(x.ten)}</b><div class="cvm">${esc(x.mo)}</div>${cvSegHtml(x)}
  <div class="cvtags">${x.da?`<span>📁 ${esc(prjN(x.da))}</span>`:""}<span>👥 ${TEAMS[x.team]||x.team}</span>${x.ck&&x.ck.length?`<span>☑ ${x.ck.filter(c=>c.x).length}/${x.ck.length}</span>`:""}</div>
  <div class="cvf2"><span class="who">${avatar(x.nguoi)}${esc(userName(x.nguoi)||"Chưa giao")}${x.phoi.length?`<small> +${esc(x.phoi.map(userName).filter(Boolean).join(", "))}</small>`:""}</span><span class="${x.late?"t-red":x.st==="done"?"t-grn":"hint"}">${x.late?`⚠ Quá hạn ${x.lateD} ngày`:x.st==="done"?"✓ Xong":"Hạn "+dd(x.han)}</span></div></div>`}
/* Thẻ gọn cho bảng Kanban: cột đã là trạng thái nên không lặp nhãn trạng thái */
function kbCard(x){const uu=x.uu==="Cao"?"cao":x.uu==="Thấp"?"thap":"tb",who=userName(x.nguoi)||"Chưa giao",meta=[x.loai,x.mo].filter(Boolean).join(" · ");
  return `<div class="kbc${x.late?" late":x.st==="done"?" done":""}" data-cv="${x.id}" data-src="${x.src}"${x.n>1?` data-grp="${x.ids.join(",")}"`:""} draggable="${x.src==="task"}" title="${esc(x.ten)}">
   <div class="kbt${x.st==="done"?" strike":""}">${esc(x.ten)}</div>${meta?`<div class="kbm">${esc(meta)}</div>`:""}${cvSegHtml(x)}
   <div class="kbf"><span class="kbwho">${avatar(x.nguoi)}<span>${esc(who.split(" ").slice(-2).join(" "))}${x.phoi.length?` <small>+${x.phoi.length}</small>`:""}</span></span><i class="kbuu u-${uu}" title="Ưu tiên ${esc(x.uu)}">${esc(x.uu==="Trung bình"?"TB":x.uu)}</i><span class="kbd ${x.late?"t-red":x.st==="done"?"t-grn":""}">${x.late?`Trễ ${x.lateD}n`:x.st==="done"?"✓ Xong":x.han?dd(x.han):"—"}</span></div></div>`}
function bindCvCards(m){
  m.querySelectorAll("[data-cvst]").forEach(s=>{s.onclick=e=>e.stopPropagation();s.onchange=()=>{{const t0=D().tasks.find(x=>x.id===s.dataset.cvst);const er=s.value==="done"?tkDoneErr(t0):"";if(er){toast(er);s.value=t0.st;return}}tkSetSt(s.dataset.cvst,s.value);toast("Đã cập nhật");renderMain()}});
  m.querySelectorAll("[data-cv]").forEach(e=>e.onclick=ev=>{if(ev.target.closest("select,button,input"))return;const src=e.dataset.src,id=e.dataset.cv;if(e.dataset.grp){const ids=e.dataset.grp.split(","),c0=D().cards.find(c=>c.id===ids[0]);BV.only=new Set(ids);BV.k=c0?c0.kenh:BV.k;BV.sku=BV.t=BV.w=BV.st=BV.ng="";BV.sel=new Set();MOD="mkt";PAGE="kehoach";STEP=7;XV.tab="pc";render();scrollTo(0,0);return}if(src==="card")openCard(id);else if(src==="order"){PAGE="order";MOD="";render()}else openTask(id)});
}
/* Quản lý của một việc: người giao (nếu không phải chính người làm), quản lý có quyền giao việc, chị */
const tkMgrIds=t=>{const ids=new Set();if(t.tao&&t.tao!==t.nguoi)ids.add(t.tao);D().users.filter(u=>u.active&&u.id!==t.nguoi&&(u.role==="admin"||(u.role==="lead"&&(u.perms||[]).includes("viec.giao")&&(!t.team||teamOf(u)===t.team)))).forEach(u=>ids.add(u.id));return [...ids]};
const tkMgr=t=>!!ME&&ME.id!==t.nguoi&&(ME.role==="admin"||t.tao===ME.id||tkMgrIds(t).includes(ME.id));
/* Quy tắc đóng việc: việc do người khác giao thì người làm chỉ bấm "Chờ duyệt", người giao (hoặc quản lý) duyệt mới Hoàn thành. Việc tự tạo cho mình thì tự đóng. */
const tkGiver=()=>!!ME&&(ME.role==="admin"||can(ME,"viec.giao"));
/* đổi trạng thái một việc + báo chuông đúng người: gửi duyệt → người giao/quản lý · duyệt xong, trả lại → người làm */
/* nhật ký từng việc: ai làm gì lúc nào (giữ 60 dòng gần nhất) */
function tkLog(x,txt){x.log=x.log||[];x.log.push({at:new Date().toLocaleString("vi-VN"),by:(typeof ME!=="undefined"&&ME)?ME.name:"Hệ thống",txt});if(x.log.length>60)x.log=x.log.slice(-60)}
function tkSetSt(id,k,extra,note){const t0=D().tasks.find(x=>x.id===id);if(!t0)return;
  DB.mutate(ME.name,`"${t0.ten}" → ${cvStN(k)}`,dt=>{const x=dt.tasks.find(y=>y.id===id);if(!x)return;const old=x.st,ref="task:"+x.id,ng=[x.nguoi,...(x.phoi||[])];tkLog(x,"Trạng thái: "+cvStN(old)+" → "+cvStN(k)+(note?" · "+note:""));x.st=k;x.stAt=new Date().toLocaleString("vi-VN");x.stBy=ME.name;Object.assign(x,extra||{});
    if(old===k||typeof notifyU!=="function")return;
    if(k==="review")notifyU(dt,[x.tao,...tkMgrIds(x)],`${ME.name} gửi duyệt việc "${x.ten}"`,ref);
    else if(k==="done"&&ME.id!==x.nguoi)notifyU(dt,ng,`${ME.name} đã duyệt xong việc "${x.ten}"`,ref);
    else if(old==="review"&&ME.id!==x.nguoi)notifyU(dt,ng,`${ME.name} trả lại việc "${x.ten}"${note?": "+note:""}`,ref);
    else if(k==="done")notifyU(dt,[x.tao],`${ME.name} đã xong việc "${x.ten}"`,ref)})}
function tkDoneErr(t){if(!t||tkMgr(t))return "";if(t.tao&&t.tao!==t.nguoi)return `Việc này do ${userName(t.tao)||"người giao"} giao. Bấm "Chờ duyệt" để người giao xem rồi mới hoàn thành.`;return ""}
const tkMgrNames=t=>tkMgrIds(t).map(userName).filter(Boolean).join(", ")||"quản lý";
function openTask(id){
  const d=D(),t=id?d.tasks.find(x=>x.id===id):null,giver=tkGiver(),own=!!t&&t.tao===ME.id&&t.nguoi===ME.id,ed=giver||!t||t.nguoi===ME.id||(t.phoi||[]).includes(ME.id)||(!!t&&t.tao===ME.id),gv=giver||!t||own;
  const users=d.users.filter(u=>u.active&&u.role!=="admin"||u.id===ME.id);
  openDrawerHTML(`<h2>${t?"Chi tiết việc":"Giao việc"}</h2>${t&&t.tao?`<p class="hint">Người giao: ${esc(userName(t.tao)||"—")}</p>`:""}${!t&&!giver?`<p class="hint">Bạn tạo việc cho chính mình. Muốn giao cho người khác, nhờ quản lý giao.</p>`:""}<form class="frm" id="tkf2"><label class="field">Tên việc<input id="t-ten" required value="${esc(t?t.ten:"")}" ${gv?"":"disabled"}></label><label class="field">Mô tả<textarea id="t-mo" rows="2" ${gv?"":"disabled"}>${esc(t?t.moTa:"")}</textarea></label>
   <div class="row4"><label class="field">Team<select id="t-team" ${gv?"":"disabled"}>${opt(Object.entries(TEAMS),t?t.team:(TEAMS[teamOf(ME)]?teamOf(ME):"content"))}</select></label><label class="field">Dự án<select id="t-da" ${gv?"":"disabled"}>${opt([["","—"]].concat((d.projects||[]).map(p=>[p.id,p.ten])),t?t.da:CVF.da)}</select></label></div>
   <div class="row4"><label class="field">Người làm<select id="t-ng" ${gv&&giver?"":"disabled"}>${opt([["","— chưa giao"]].concat(users.map(u=>[u.id,u.name+" · "+(TEAMS[teamOf(u)]||"Quản lý")])),t?t.nguoi:(giver?"":ME.id))}</select></label><label class="field">Hạn<select id="t-han" ${gv?"":"disabled"}>${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]),t?t.han:Math.min(MONTH.ndays,d.settings.today+2))}</select></label><label class="field">Bắt đầu<select id="t-bd" ${gv?"":"disabled"}>${opt([[0,"như hạn"]].concat(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)])),t?(t.bd||0):0)}</select></label><label class="field">Ưu tiên<select id="t-uu" ${gv?"":"disabled"}>${opt(UU,t?t.uu:"Trung bình")}</select></label></div>
   <div class="field" id="t-cdw">Công đoạn <small class="hint">(một việc có nhiều người, mỗi người một phần)</small><div id="t-cd"></div>${gv&&giver?`<div class="acts"><button type="button" class="btn sm" id="t-cdadd">＋ Công đoạn</button><button type="button" class="btn sm" id="t-cddu">＋ Bước duyệt</button><label class="ck sm"><input type="checkbox" id="t-seq" ${t&&t.tuanTu===false?"":"checked"}> Làm lần lượt</label></div>`:""}</div>
   <div class="field" id="t-stw">Trạng thái <small class="hint">bấm để đổi${t&&ed?", tự lưu ngay":""}</small><div class="tkst">${CV_ST.filter(s=>s[0]!=="cg").map(([k,n,c])=>`<button type="button" class="tkb tk-${c}${(t?t.st:"todo")===k?" on":""}" data-tkst="${k}" ${ed?"":"disabled"}>${(t?t.st:"todo")===k?"✓ ":""}${n}</button>`).join("")}</div><input type="hidden" id="t-st" value="${t?t.st:"todo"}">${t&&t.stAt?`<small class="hint">Đổi lần cuối: ${esc(t.stAt)} bởi ${esc(t.stBy||"")}</small>`:""}</div>
   ${t&&t.st==="review"&&!(t.cd&&t.cd.length)?(tkMgr(t)?`<div class="tklate ok"><b>Việc đang chờ bạn duyệt</b><div class="tkmg"><input id="t-tl" placeholder="Nếu trả lại: cần sửa gì"><button type="button" class="btn sm" id="t-tlok">Trả lại</button><button type="button" class="btn sm pri" id="t-duyet">✓ Duyệt hoàn thành</button></div></div>`:`<p class="hint">Đã gửi duyệt, đang chờ ${esc(tkMgrNames(t))} xem.</p>`):""}
   ${t&&t.st!=="done"&&t.han&&(t.han<d.settings.today||(t.treReq||{}).st==="cho"||(ed&&!tkMgr(t)))?(()=>{const R=t.treReq||{},mg=tkMgr(t),cho=R.st==="cho",lt=t.han<d.settings.today;return `<div class="tklate${lt?"":" ok"}"><b>${lt?`⚠ Trễ hạn ${d.settings.today-t.han} ngày`:"Hạn "+dayLbl(t.han)}</b>${lt?` (hạn ${dayLbl(t.han)}${t.hanCu?`, hạn cũ ${dd(t.hanCu)}`:""})`:t.hanCu?` (hạn cũ ${dd(t.hanCu)})`:""}
     ${cho?`<p>📨 <b>${esc(R.by)}</b> đã gửi lý do lúc ${esc(R.at)}: <i>${esc(R.lyDo)}</i><br><span class="hint">Chờ quản lý (${esc(tkMgrNames(t))}) gia hạn hoặc duyệt hoàn thành.</span></p>
       ${mg?`<div class="tkmg"><label>Gia hạn đến<select id="t-gh">${opt(Array.from({length:MONTH.ndays-d.settings.today+1},(_,i)=>d.settings.today+i).map(x=>[x,dayLbl(x)]),R.hanMoi&&R.hanMoi>=d.settings.today?R.hanMoi:Math.min(MONTH.ndays,d.settings.today+2))}</select></label><button type="button" class="btn sm" id="t-ghok">Gia hạn</button><button type="button" class="btn sm pri" id="t-dok">✓ Duyệt hoàn thành</button></div>`:""}`
     :`${ed&&!mg?`<label class="field">${lt?"Lý do trễ":"Xin gia hạn"}<textarea id="t-tre" rows="2" placeholder="Vì sao chưa kịp, xong đến đâu, cần thêm bao lâu">${esc(R.lyDo||"")}</textarea></label><label class="field">Xin dời hạn đến<select id="t-hm">${opt(Array.from({length:Math.max(1,MONTH.ndays-Math.max(t.han,d.settings.today)+1)},(_,i)=>Math.max(t.han,d.settings.today)+i).map(x=>[x,dayLbl(x)]),Math.min(MONTH.ndays,Math.max(t.han,d.settings.today)+1))}</select></label><button type="button" class="btn sm pri" id="t-trego">Gửi quản lý</button>`:mg?`<p class="hint">Người làm chưa gửi lý do trễ.</p><div class="tkmg"><label>Gia hạn đến<select id="t-gh">${opt(Array.from({length:MONTH.ndays-d.settings.today+1},(_,i)=>d.settings.today+i).map(x=>[x,dayLbl(x)]),R.hanMoi&&R.hanMoi>=d.settings.today?R.hanMoi:Math.min(MONTH.ndays,d.settings.today+2))}</select></label><button type="button" class="btn sm" id="t-ghok">Gia hạn</button><button type="button" class="btn sm pri" id="t-dok">✓ Duyệt hoàn thành</button></div>`:""}`}</div>`})():""}
   <div class="field" id="t-phw">Người cùng làm / hỗ trợ <small class="hint">(một việc có thể nhiều người)</small><div class="phc">${users.map(u=>`<label class="ck sm"><input type="checkbox" name="t-phoi" value="${u.id}" ${t&&(t.phoi||[]).includes(u.id)?"checked":""} ${gv?"":"disabled"}> ${esc(u.name)}</label>`).join("")}</div></div>
   <div class="field">Việc nhỏ cần tích<div id="t-ck">${(t?t.checklist:[]).map((c,i)=>`<label class="ck"><input type="checkbox" data-ck="${i}" ${c.x?"checked":""} ${ed?"":"disabled"}> ${esc(c.t)}</label>`).join("")}</div>${gv?`<input id="t-ckn" placeholder="Thêm việc nhỏ, Enter để thêm">`:""}</div>
   ${t?`<details class="field tklog"><summary>Nhật ký <small class="hint">(${(t.log||[]).length} dòng)</small></summary>${(t.log||[]).length?(t.log||[]).slice().reverse().slice(0,40).map(l=>`<div class="tkl"><span>${esc(l.at)}</span> <b>${esc(l.by)}</b> ${esc(l.txt)}</div>`).join(""):`<p class="hint">Chưa có dòng nào. Từ nay mọi thay đổi của việc này được ghi lại.</p>`}</details>`:""}
   <label class="field">Link / tài liệu đính kèm <small class="hint">(không bắt buộc)</small><input id="t-dk" value="${esc(t?t.dk||"":"")}" placeholder="Link Drive, brief…" ${gv?"":"disabled"}></label>
   <label class="field">Link kết quả <small class="hint">(không bắt buộc · việc có sản phẩm thì dán link Drive, bài đăng…)</small><input id="t-kq" value="${esc(t?t.kq:"")}" ${ed?"":"disabled"}></label>
   ${ed?`<div class="acts"><button class="btn pri">${t?"Lưu":"Giao việc"}</button>${t&&gv?`<button type="button" class="btn danger" id="t-del">Xóa</button>`:""}</div>`:""}</form>`);
  const ck=t?JSON.parse(JSON.stringify(t.checklist||[])):[];
  if($("#t-ckn"))$("#t-ckn").onkeydown=e=>{if(e.key!=="Enter")return;e.preventDefault();const v=e.target.value.trim();if(!v)return;ck.push({t:v,x:false});$("#t-ck").insertAdjacentHTML("beforeend",`<label class="ck"><input type="checkbox" data-ck="${ck.length-1}"> ${esc(v)}</label>`);e.target.value=""};
  /* ---- công đoạn ---- */
  const cd=t&&t.cd?t.cd.map(s=>Object.assign({},s)):[];
  const hanOpts=h=>opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]),h);
  const userOpts2=n=>opt([["","— chọn người"]].concat(users.map(u=>[u.id,u.name])),n);
  const rcd=()=>{const w=$("#t-cd");if(!w)return;const seqOn=!$("#t-seq")||$("#t-seq").checked,act=tkActive({cd,tuanTu:seqOn?undefined:false}),edit=gv&&giver;
    $("#t-cdw").style.display=(cd.length||edit)?"":"none";$("#t-stw").style.display=cd.length?"none":"";{const ph=$("#t-phw");if(ph)ph.style.display=cd.length?"none":"";[["#t-ng",gv&&giver],["#t-han",gv],["#t-bd",gv]].forEach(([q,okk])=>{const e=$(q);if(e)e.disabled=cd.length>0||!okk})}
    w.innerHTML=cd.map((s,i)=>{const on=act.includes(s),can=!!t&&on&&(s.nguoi===ME.id||(s.loai==="duyet"?ME.role==="admin":(giver||tkMgr(t))));
      return `<div class="tcd2${on?" on":""}${s.st==="xong"?" fin":""}" data-i="${i}"><span class="tcdn">${i+1}</span>${edit&&s.st!=="xong"?`<input data-f="ten" value="${esc(s.ten)}" placeholder="Tên công đoạn">`:`<b>${esc(s.ten)}</b>`}${edit&&s.st!=="xong"?`<select data-f="nguoi">${userOpts2(s.nguoi)}</select><select data-f="han">${hanOpts(s.han)}</select>`:`<span>${esc(userName(s.nguoi)||"—")}</span><span>${s.han?dd(s.han):""}</span>`}<span class="tcds">${s.st==="xong"?"✓ Xong":on?(s.st==="lam"?"Đang làm":"Đến lượt"):"Chờ"}</span>${can?`<button type="button" class="btn sm pri" data-cdx="${s.id}">${s.loai==="duyet"?"Duyệt xong":"Xong"}</button>${s.loai==="duyet"?`<button type="button" class="btn sm" data-cdt="${s.id}">Trả lại</button>`:(s.st!=="lam"?`<button type="button" class="btn sm" data-cdl="${s.id}">Đang làm</button>`:"")}`:""}${edit&&s.st!=="xong"?`<button type="button" class="btn sm danger" data-cdr="${i}" title="Bỏ công đoạn">✕</button>`:""}</div>`}).join("");
    w.querySelectorAll("[data-f]").forEach(e=>e.onchange=e.oninput=()=>{const i=+e.closest("[data-i]").dataset.i,f=e.dataset.f;cd[i][f]=f==="han"?+e.value:e.value;if(f!=="ten")rcd()});
    w.querySelectorAll("[data-cdr]").forEach(b=>b.onclick=()=>{cd.splice(+b.dataset.cdr,1);rcd()});
    const go=(sel,act,ask)=>w.querySelectorAll(sel).forEach(b=>b.onclick=()=>{let note="";if(ask){note=(prompt("Cần sửa gì? (người làm sẽ nhận được)")||"").trim();if(!note){toast("Ghi cần sửa gì để người làm biết");return}}tkCdAct(t.id,b.dataset[sel.slice(6,-1)],act,note);toast(act==="xong"?"Đã xong công đoạn":act==="lam"?"Đã bấm Đang làm":"Đã trả lại");openTask(t.id);renderMain()});
    go("[data-cdx]","xong");go("[data-cdl]","lam");go("[data-cdt]","tra",true)};
  if($("#t-cdadd"))$("#t-cdadd").onclick=()=>{cd.push({id:uid("cd"),ten:"",nguoi:"",han:Math.min(MONTH.ndays,d.settings.today+2),loai:"lam",st:"cho"});rcd()};
  if($("#t-cddu"))$("#t-cddu").onclick=()=>{cd.push({id:uid("cd"),ten:"Duyệt",nguoi:(t&&t.tao)||ME.id,han:Math.min(MONTH.ndays,d.settings.today+3),loai:"duyet",st:"cho"});rcd()};
  if($("#t-seq"))$("#t-seq").onchange=rcd;
  rcd();
  const stSave=(k,extra)=>{tkSetSt(t.id,k,extra);toast("Đã chuyển: "+cvStN(k))};
  $("#tkf2").querySelectorAll("[data-tkst]").forEach(b=>b.onclick=()=>{const k=b.dataset.tkst;
    if(t&&k==="done"){const er=tkDoneErr(t);if(er){toast(er);return}}
    $("#t-st").value=k;$("#tkf2").querySelectorAll("[data-tkst]").forEach(x=>{const on=x.dataset.tkst===k;x.classList.toggle("on",on);x.textContent=(on?"✓ ":"")+cvStN(x.dataset.tkst)});
    if(t&&ed){stSave(k,k==="done"&&t.treReq&&t.treReq.st==="cho"?{treReq:Object.assign({},t.treReq,{st:"ok",xl:ME.name})}:null);openTask(t.id)}});
  const now=()=>new Date().toLocaleString("vi-VN");
  if($("#t-trego"))$("#t-trego").onclick=()=>{const v=$("#t-tre").value.trim();if(!v){toast("Ghi lý do trễ");return}
    DB.mutate(ME.name,`lý do trễ "${t.ten}"`,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;const hm=+($("#t-hm")||{}).value||0,lt=x.han<dt.settings.today;tkLog(x,(lt?"Báo trễ":"Xin gia hạn")+": "+v.slice(0,120)+(hm?" · xin đến "+dd(hm):""));x.treReq={lyDo:v,at:now(),by:ME.name,st:"cho",hanMoi:hm};x.tre={lyDo:v,at:now(),by:ME.name};if(typeof notifyU==="function")notifyU(dt,[x.tao,...tkMgrIds(x)],`${lt?"⚠ "+ME.name+" báo trễ":ME.name+" xin gia hạn"} việc "${x.ten}"${hm?" đến "+dd(hm):""}: ${v.slice(0,100)}`,"task:"+x.id)});toast("Đã gửi quản lý");openTask(t.id)};
  if($("#t-duyet"))$("#t-duyet").onclick=()=>{tkSetSt(t.id,"done");toast("Đã duyệt hoàn thành");closeDrawer();renderMain()};
  if($("#t-tlok"))$("#t-tlok").onclick=()=>{const n=$("#t-tl").value.trim();if(!n){toast("Ghi cần sửa gì để người làm biết");return}tkSetSt(t.id,"doing",{tlNote:n},n);toast("Đã trả lại cho "+(userName(t.nguoi)||"người làm"));closeDrawer();renderMain()};
  if($("#t-ghok"))$("#t-ghok").onclick=()=>{const h=+$("#t-gh").value;DB.mutate(ME.name,`gia hạn "${t.ten}" đến ${dd(h)}`,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;x.hanCu=x.hanCu||x.han;tkLog(x,"Gia hạn đến "+dd(h));x.han=h;x.treReq=Object.assign({},x.treReq||{},{st:"giahan",xl:ME.name,xlAt:now(),hanMoi:h});if(typeof notifyU==="function")notifyU(dt,[x.nguoi],`${ME.name} gia hạn việc "${x.ten}" đến ${dayLbl(h)}`,"task:"+x.id)});toast("Đã gia hạn đến "+dd(h));openTask(t.id);renderMain()};
  if($("#t-dok"))$("#t-dok").onclick=()=>{DB.mutate(ME.name,`duyệt hoàn thành "${t.ten}" (trễ hạn)`,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;tkLog(x,"Duyệt hoàn thành");x.st="done";x.stAt=now();x.stBy=ME.name;x.treReq=Object.assign({},x.treReq||{},{st:"ok",xl:ME.name,xlAt:now()});if(typeof notifyU==="function")notifyU(dt,[x.nguoi],`${ME.name} duyệt hoàn thành việc "${x.ten}"`,"task:"+x.id)});toast("Đã duyệt hoàn thành");closeDrawer();renderMain()};
  $("#tkf2").onsubmit=e=>{e.preventDefault();$("#tkf2").querySelectorAll("[data-ck]").forEach(x=>{if(ck[+x.dataset.ck])ck[+x.dataset.ck].x=x.checked});
    const v={ten:$("#t-ten").value,moTa:$("#t-mo").value,team:$("#t-team").value,da:$("#t-da").value,nguoi:$("#t-ng").value,han:+$("#t-han").value,uu:$("#t-uu").value,bd:+($("#t-bd")||{}).value||0,st:$("#t-st").value,phoi:[...document.querySelectorAll("[name=t-phoi]:checked")].map(x=>x.value),checklist:ck,kq:$("#t-kq").value,dk:$("#t-dk")?$("#t-dk").value.trim():""};const trv=$("#t-tre")&&$("#t-tre").value.trim();if(trv&&(!t.tre||t.tre.lyDo!==trv))v.tre={lyDo:trv,at:new Date().toLocaleString("vi-VN"),by:ME.name};
    v.cd=cd.map(s=>Object.assign({},s));v.tuanTu=!$("#t-seq")||$("#t-seq").checked;
    if(v.cd.some(s=>!s.nguoi||!String(s.ten).trim())){toast("Mỗi công đoạn cần có tên và người làm");return}
    if(!giver)v.nguoi=t?t.nguoi:ME.id;
    if(!t&&v.st==="done"&&v.nguoi!==ME.id)v.st="todo";
    const nid=uid("cv"),oldNg=t?t.nguoi:"",oldPhoi=t?(t.phoi||[]):[],oldHan=t?t.han:0;
    DB.mutate(ME.name,(t?"cập nhật việc: ":"giao việc: ")+v.ten+(v.nguoi?" → "+userName(v.nguoi):""),dt=>{let x;if(t){x=dt.tasks.find(y=>y.id===t.id);Object.assign(x,gv?v:{st:v.st,checklist:v.checklist,kq:v.kq,...(v.tre?{tre:v.tre}:{})})}else{x={id:nid,...v,loai:"Việc",tao:ME.id};dt.tasks.push(x)}
      if(x.cd&&x.cd.length){tkSync(x);v.nguoi=x.nguoi;v.han=x.han;v.phoi=x.phoi}
      tkLog(x,t?("Sửa việc"+(oldNg!==x.nguoi?" · người làm: "+(userName(oldNg)||"—")+" → "+(userName(x.nguoi)||"—"):"")+(oldHan&&oldHan!==x.han?" · hạn: "+dd(oldHan)+" → "+dd(x.han):"")):("Giao việc"+(x.nguoi?" cho "+userName(x.nguoi):"")+(x.han?" · hạn "+dd(x.han):"")));
      if(typeof notifyU==="function"&&gv){const ds=v.han?` · hạn ${dd(v.han)}`:"";const nw=[];if(v.nguoi&&v.nguoi!==oldNg)nw.push(v.nguoi);v.phoi.filter(p=>!oldPhoi.includes(p)).forEach(p=>nw.push(p));if(nw.length)notifyU(dt,nw,`${ME.name} giao bạn việc "${v.ten}"${ds}`,"task:"+x.id);else if(t&&t.han!==v.han&&v.nguoi)notifyU(dt,[v.nguoi],`${ME.name} đổi hạn việc "${v.ten}" thành ${dd(v.han)}`,"task:"+x.id)}});toast(t?"Đã lưu":"Đã giao");closeDrawer();renderMain()};
  if($("#t-del"))$("#t-del").onclick=()=>{if(!confirm("Xóa việc này?"))return;DB.mutate(ME.name,"xóa việc "+t.ten,dt=>dt.tasks=dt.tasks.filter(x=>x.id!==t.id));closeDrawer();renderMain()};
}
const newTaskBtn=()=>`<button class="btn pri" id="cv-new">＋ Giao việc</button>`;
const bindNew=()=>{if($("#cv-new"))$("#cv-new").onclick=()=>openTask(null)};

/* ---------- 1. Tổng quan công việc ---------- */
function pCvTong(m){
  const d=D(),today=d.settings.today,L=cvFilter(cvItems()),done=L.filter(x=>x.st==="done"),late=L.filter(x=>x.late),doing=L.filter(x=>x.st==="doing"),rv=L.filter(x=>x.st==="review"),cg=L.filter(x=>x.st==="cg"),due=L.filter(x=>x.han<=today),onT=due.filter(x=>x.st==="done"||!x.late);
  const pct=L.length?Math.round(done.length/L.length*100):0,hr=new Date().getHours();
  const prj=(d.projects||[]).map(p=>{const I=cvItems().filter(x=>x.da===p.id);return {p,n:I.length,ok:I.filter(x=>x.st==="done").length,late:I.filter(x=>x.late).length}});
  const ppl=[...new Set(L.map(x=>x.nguoi).filter(Boolean))].map(u=>{const I=L.filter(x=>x.nguoi===u);return {u,n:I.length,doing:I.filter(x=>["todo","nhan","doing","review"].includes(x.st)).length,done:I.filter(x=>x.st==="done").length,late:I.filter(x=>x.late).length}}).sort((a,b)=>b.late-a.late||b.doing-a.doing);
  const days=Array.from({length:7},(_,i)=>today-6+i).filter(x=>x>=1);
  const st=(cls,t,v,h)=>`<div class="sc ${cls}"><div class="l">${t}</div><div class="v">${v}</div><span>${h}</span></div>`;
  m.innerHTML=`<div class="cvhero"><div><div class="hint">${dayLbl(today)}/${MONTH.year}</div><h1>Chào ${hr<11?"buổi sáng":hr<14?"buổi trưa":hr<18?"buổi chiều":"buổi tối"}, ${esc(ME.name)} 👋</h1><p>${CVF.scope==="mine"?"Bạn":CVF.scope==="team"?"Team":"Cả công ty"} có <b class="t-red">${late.length} việc quá hạn</b> cần xử lý và <b>${doing.length+rv.length} việc</b> đang thực hiện.</p><div class="acts"><button class="btn" id="cv-late">⚠ Xem ${late.length} việc quá hạn</button></div></div>
   <div class="donut"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#eef1f7" stroke-width="5"/><circle cx="21" cy="21" r="15.9" fill="none" stroke="#2f9e44" stroke-width="5" stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="25"/></svg><b>${pct}%</b><ul><li><i style="background:#2f9e44"></i>${done.length}/${L.length} xong</li><li><i style="background:#3b5bdb"></i>${doing.length+rv.length} đang làm</li><li><i style="background:#e03131"></i>${late.length} quá hạn</li></ul></div></div>
  ${cvFilterBar({noSt:true})}
  <div class="scs">${st("s1","Tổng nhiệm vụ",L.length,pct+"% hoàn thành")}${st("s2","Đang thực hiện",doing.length,"đang chạy")}${st("s3","Hoàn thành",done.length,pct+"% tổng")}${st("s4","Quá hạn",late.length,"cần xử lý ngay")}${st("s5","Tỷ lệ đúng hạn",due.length?Math.round(onT.length/due.length*100)+"%":"—",onT.length+"/"+due.length+" việc tới hạn")}${st("s6","Chờ duyệt",rv.length,"kịch bản, video, việc")}${st("s7","Chưa giao",cg.length,"chưa có người làm")}${st("s8","Dự án trễ",prj.filter(x=>x.late).length,"có việc quá hạn")}</div>
  <div class="xgrid"><section class="card"><div class="card-h"><h2>Việc 7 ngày qua</h2><span class="hint">theo hạn: xong / chưa xong</span></div><div class="d7">${days.map(dy=>{const I=L.filter(x=>x.han===dy),ok=I.filter(x=>x.st==="done").length,mx=Math.max(1,...days.map(z=>L.filter(x=>x.han===z).length));return `<div><div class="bw"><i class="ok" style="height:${ok/mx*100}%"></i><i class="no" style="height:${(I.length-ok)/mx*100}%"></i></div><b>${I.length}</b><span>${dayLbl(dy).split(" ")[0]}</span></div>`}).join("")}</div></section>
   <section class="card"><div class="card-h"><h2>Khối lượng theo người</h2><span class="hint">ai đang ôm nhiều, ai trễ</span></div>${tbl(["Người","Team","Đang làm","Xong","Quá hạn","Đúng hạn"],ppl.map(r=>{const u=D().users.find(x=>x.id===r.u)||{};const du=L.filter(x=>x.nguoi===r.u&&x.han<=today),ok=du.filter(x=>x.st==="done"||!x.late).length;return `<tr class="clk" data-pf="${r.u}"><td>${avatar(r.u)}<b>${esc(u.name||"")}</b></td><td>${TEAMS[teamOf(u)]||""}</td><td class="n">${r.doing}</td><td class="n">${r.done}</td><td class="n">${r.late?pill(r.late,"red"):0}</td><td class="n">${du.length?Math.round(ok/du.length*100)+"%":"—"}</td></tr>`}))}</section></div>
  <section class="card"><div class="card-h"><h2>Dự án đang chạy</h2><button class="lnk" data-go="cv_da">Tất cả dự án →</button></div><div class="prjs">${prj.map(x=>`<div class="prj clk" data-pj="${x.p.id}"><b>${esc(x.p.ten)}</b><span class="hint">${TEAMS[x.p.team]} · ${esc(userName(x.p.owner))} · hạn ${dd(x.p.han)}</span><div class="progress"><i style="width:${x.n?x.ok/x.n*100:0}%"></i></div><span>${x.ok}/${x.n} việc xong${x.late?` · <b class="t-red">${x.late} quá hạn</b>`:""}</span></div>`).join("")}</div></section>`;
  bindCvFilter(m);bindNew();$("#cv-late").onclick=()=>{CVF.st="late";PAGE="cv_nv";render()};
  m.querySelectorAll("[data-pf]").forEach(r=>r.onclick=()=>{cvWhoSet("p:"+r.dataset.pf);PAGE="cv_kb";render()});
  m.querySelectorAll("[data-pj]").forEach(r=>r.onclick=()=>{CVF.da=r.dataset.pj;PAGE="cv_kb";render()});
}
/* ---------- 2. Nhiệm vụ ---------- */
function pCvNv(m){
  const L=cvGroup(cvFilter(cvItems())).sort((a,b)=>(b.late-a.late)||(a.st==="done")-(b.st==="done")||a.han-b.han);
  m.innerHTML=H("Task",`${L.length} việc`)+`<div class="filters"><span class="sp"></span><button class="btn sm${CVF.view==="grid"?" pri":""}" data-vw="grid">Thẻ</button><button class="btn sm${CVF.view==="list"?" pri":""}" data-vw="list">Danh sách</button><button class="btn" id="cv-xl">⬇ Excel</button>${newTaskBtn()}</div>${cvFilterBar()}
  ${CVF.view==="grid"?`<div class="cvgrid">${L.slice(0,120).map(cvCard).join("")||`<p class="empty">Không có việc.</p>`}</div>${L.length>120?`<p class="hint">Đang hiện 120/${L.length} việc, lọc thêm để xem hết.</p>`:""}`:`<section class="card">${tbl(["Việc","Loại","Dự án","Người làm","Hạn","Ưu tiên","Trạng thái"],L.map(x=>`<tr class="clk" data-cv="${x.id}" data-src="${x.src}"${x.n>1?` data-grp="${x.ids.join(",")}"`:""}><td><b>${esc(x.ten)}</b><small>${esc(x.mo)}</small>${cvSegHtml(x)}</td><td>${esc(x.loai)}</td><td>${esc(prjN(x.da))}</td><td>${esc(userName(x.nguoi)||"—")}</td><td>${x.late?`<span class="t-red">${dd(x.han)} · trễ ${x.lateD}n</span>`:dd(x.han)}</td><td>${x.uu}</td><td>${pill(cvStN(x.st),(CV_ST.find(s=>s[0]===x.st)||[])[2])}</td></tr>`))}</section>`}`;
  bindCvFilter(m);bindCvCards(m);bindNew();m.querySelectorAll("[data-vw]").forEach(b=>b.onclick=()=>{CVF.view=b.dataset.vw;renderMain()});
  $("#cv-xl").onclick=()=>{if(typeof XLSX==="undefined"){toast("Cần mạng để xuất Excel");return}const ws=XLSX.utils.aoa_to_sheet([["Mã","Việc","Mô tả","Loại","Team","Dự án","Người làm","Hạn","Ưu tiên","Trạng thái","Quá hạn (ngày)"]].concat(L.map(x=>[x.id,x.ten,x.mo,x.loai,TEAMS[x.team]||x.team,prjN(x.da),userName(x.nguoi),dd(x.han)+"/"+MONTH.year,x.uu,cvStN(x.st),x.lateD||""])));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Nhiem vu");XLSX.writeFile(wb,`Nhiem-vu-T${MONTH.mon}.xlsx`)};
}
/* ---------- 3. Tiến độ (bảng cột) ---------- */
function pCvKb(m){
  const L=cvGroup(cvFilter(cvItems()));
  m.innerHTML=cvFilterBar({noSt:true})+`
  <div class="kbx">${CV_ST.map(([k,t,c])=>{const I=L.filter(x=>x.st===k).sort((a,b)=>(b.late-a.late)||a.han-b.han);return `<div class="kcol" data-drop="${k}"><div class="kh"><i class="dot d-${c}"></i><b>${t}</b><span>${I.length}</span></div>${I.slice(0,40).map(kbCard).join("")}${I.length>40?`<p class="hint">+${I.length-40} việc nữa</p>`:""}</div>`}).join("")}</div>`;
  bindCvFilter(m);bindCvCards(m);bindNew();
  m.querySelectorAll('.cvc[draggable="true"],.kbc[draggable="true"]').forEach(c=>c.ondragstart=e=>e.dataTransfer.setData("text",c.dataset.cv));
  m.querySelectorAll("[data-drop]").forEach(col=>{col.ondragover=e=>{e.preventDefault();col.classList.add("ov")};col.ondragleave=()=>col.classList.remove("ov");col.ondrop=e=>{e.preventDefault();col.classList.remove("ov");const id=e.dataTransfer.getData("text"),to=col.dataset.drop;if(to==="cg"){toast("Việc đã giao không chuyển về Chưa giao");return}const t=D().tasks.find(x=>x.id===id);if(!t)return;if(!(can(ME,"viec.giao")||t.nguoi===ME.id||(t.phoi||[]).includes(ME.id))){toast("Bạn không phụ trách việc này");return}if(to==="done"){const er=tkDoneErr(t);if(er){toast(er);return}}tkSetSt(id,to);renderMain()}});
}
/* ---------- 4. Lịch tháng ---------- */
function pCvLich(m){
  const d=D(),L=cvFilter(cvItems()),today=d.settings.today,lead=(MONTH.first+7)%7,cells=[];for(let i=0;i<MONTH.first;i++)cells.push(0);for(let i=1;i<=MONTH.ndays;i++)cells.push(i);while(cells.length%7)cells.push(0);
  m.innerHTML=cvFilterBar({noSt:false})+`<div class="filters"><b>Tháng ${MONTH.mon}/${MONTH.year}</b><span class="sp"></span><span class="lg"><i class="dot d-blu"></i>Việc</span><span class="lg"><i class="dot d-vio"></i>Buổi quay</span><span class="lg"><i class="dot d-grn"></i>Hạn dự án</span><span class="lg"><i class="dot d-red"></i>Quá hạn</span></div>
  <section class="card flush"><div class="mcal"><div class="mh">${THU.map(t=>`<div>${t}</div>`).join("")}</div><div class="mg2">${cells.map(dy=>{if(!dy)return `<div class="mc off"></div>`;const I=L.filter(x=>x.han===dy&&x.src!=="card"),V=L.filter(x=>x.han===dy&&x.src==="card"),S=(d.shoots||[]).filter(s=>s.day===dy),P=(d.projects||[]).filter(p=>p.han===dy);const ev=[...P.map(p=>`<div class="me2 prjd">📁 ${esc(p.ten)}</div>`),...S.map(s=>`<div class="me2 shd">🎬 ${esc(s.gio||"")} ${esc(s.diaDiem)}</div>`),...I.map(x=>`<div class="me2 ${x.late?"lt":x.st==="done"?"dn":""}" data-cv="${x.id}" data-src="${x.src}">${esc(x.ten)}</div>`)];const lateV=V.filter(x=>x.late).length;
    return `<div class="mc${dy===today?" td":""}"><span class="dn2">${dy}</span>${ev.slice(0,3).join("")}${ev.length>3?`<span class="more">+${ev.length-3} mục</span>`:""}${V.length?`<div class="me2 vd clk" data-vday="${dy}">🎞 ${V.length} video${lateV?` · <b>${lateV} trễ</b>`:""}</div>`:""}</div>`}).join("")}</div></div></section>`;
  bindCvFilter(m);bindCvCards(m);bindNew();m.querySelectorAll("[data-vday]").forEach(b=>b.onclick=()=>{XV.tab="kho";XV.ks="cal";PAGE="kehoach";STEP=7;MOD="";render()});
}
/* ---------- 5. Dự án ---------- */
/* ---------- 5. Dự án: thẻ dự án, thêm nhanh, tiến độ tự tính từ các việc trong dự án ---------- */
const CVP={q:"",st:"",ow:"",uu:""};
function prjStats(p){
  const d=D(),td=d.settings.today,L=cvItems().filter(x=>x.da===p.id&&!CV_TEST.includes(x.nguoi)),done=L.filter(x=>x.st==="done").length,late=L.filter(x=>x.late).length,doing=L.filter(x=>x.st==="doing"||x.st==="nhan").length;
  const pc2=L.length?Math.round(done/L.length*100):0,bd=p.batDau||1,span=Math.max(1,p.han-bd),exp=Math.max(0,Math.min(100,Math.round((td-bd)/span*100)));
  let st="Đúng tiến độ",tone="grn";
  if(!L.length){st="Chưa có việc";tone="gry"}else if(done===L.length){st="Hoàn thành";tone="grn"}else if(late){st="Có việc trễ";tone="red"}else if(p.han<td){st="Quá hạn dự án";tone="red"}else if(pc2<exp-10){st="Chậm";tone="amb"}
  return {L,done,late,doing,pc2,exp,st,tone};
}
function pCvDa(m){
  const d=D(),td=d.settings.today,ed=tkGiver(),P=d.projects||[],S={};P.forEach(p=>S[p.id]=prjStats(p));
  const L=P.filter(p=>(!CVP.q||(p.ten+" "+p.id+" "+userName(p.owner)).toLowerCase().includes(CVP.q.toLowerCase()))&&(!CVP.st||S[p.id].st===CVP.st)&&(!CVP.ow||p.owner===CVP.ow)&&(!CVP.uu||(p.uu||"Trung bình")===CVP.uu));
  const owners=[...new Set(P.map(p=>p.owner).filter(Boolean))],sts=[...new Set(Object.values(S).map(s=>s.st))];
  const card=p=>{const s=S[p.id],mem=[...new Set([p.owner,...(p.tv||[]),...s.L.map(x=>x.nguoi)].filter(x=>x&&!CV_TEST.includes(x)))],uu=p.uu||"Trung bình";
    return `<section class="pj"><div class="pjh"><span class="pjic">▣</span><div class="pjt"><b>${esc(p.ten)}</b><small>${esc(p.id)} · ${esc(TEAMS[p.team]||p.team||"")}</small></div>${pill(s.st,s.tone)}</div>
    ${p.moTa?`<p class="pjd">${esc(cvShort(p.moTa,110))}</p>`:""}
    <div class="pjm"><div><small>Phụ trách</small><span>${avatar(p.owner)}${esc(userName(p.owner)||"—")}</span></div><div><small>Hạn</small><span>${dd(p.han)} <i class="${p.han<td&&s.pc2<100?"t-red":""}">${p.han>=td?"còn "+(p.han-td)+" ngày":"trễ "+(td-p.han)+" ngày"}</i></span></div><div><small>Ưu tiên</small>${pill(uu.toUpperCase(),uu==="Cao"?"red":uu==="Thấp"?"gry":"amb")}</div></div>
    <div class="progress big"><i style="width:${s.pc2}%"></i><em style="left:${s.exp}%"></em></div>
    <div class="pjn"><b>${s.pc2}%</b> · ${s.done}/${s.L.length} việc xong${s.doing?` · ${s.doing} đang làm`:""}${s.late?` · <b class="t-red">${s.late} trễ</b>`:""}</div>
    <div class="pjf"><span class="pjav">${mem.slice(0,4).map(avatar).join("")}${mem.length>4?`<small>+${mem.length-4}</small>`:""}</span><span class="sp"></span><button type="button" class="btn sm" data-pjv="${p.id}">Xem việc</button><button type="button" class="btn sm" data-pjg="${p.id}">Gantt</button>${ed?`<button type="button" class="btn sm" data-pje="${p.id}">Sửa</button>`:""}</div></section>`};
  m.innerHTML=`<div class="cvbar"><input id="pj-q" placeholder="Tìm dự án, người phụ trách…" value="${esc(CVP.q)}"><select id="pj-st">${opt([["","Mọi trạng thái"]].concat(sts),CVP.st)}</select><select id="pj-ow">${opt([["","Mọi người phụ trách"]].concat(owners.map(o=>[o,userName(o)])),CVP.ow)}</select><select id="pj-uu">${opt([["","Mọi mức ưu tiên"]].concat(UU),CVP.uu)}</select>${ed?`<button class="btn pri" type="button" id="pj-new">＋ Thêm dự án</button>`:""}</div>
  ${ed?`<form class="pjq" id="pj-quick"><b>Thêm nhanh</b><input id="pjq-t" placeholder="Tên dự án, chiến dịch" required><select id="pjq-o">${opt(d.users.filter(u=>u.active).map(u=>[u.id,u.name]),ME.id)}</select><select id="pjq-h">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,"Hạn "+dayLbl(i+1)]),MONTH.ndays)}</select><button class="btn sm pri">Thêm</button></form>`:""}
  ${P.length?`<div class="pjgrid">${L.map(card).join("")||'<p class="empty">Không có dự án nào khớp bộ lọc.</p>'}</div>`:`<section class="card"><p class="empty pad">Chưa có dự án nào. ${ed?"Gõ tên vào ô Thêm nhanh ở trên rồi bấm Thêm.":"Quản lý sẽ tạo dự án."}</p></section>`}`;
  [["pj-q","q"],["pj-st","st"],["pj-ow","ow"],["pj-uu","uu"]].forEach(([id,k])=>{const e=$("#"+id);if(e)e.onchange=()=>{CVP[k]=e.value;renderMain()}});
  if($("#pj-new"))$("#pj-new").onclick=()=>openProject(null);
  if($("#pj-quick"))$("#pj-quick").onsubmit=e=>{e.preventDefault();const ten=$("#pjq-t").value.trim();if(!ten)return;prjSave(null,{ten,owner:$("#pjq-o").value,han:+$("#pjq-h").value,team:teamOf(ME)&&TEAMS[teamOf(ME)]?teamOf(ME):"content"});toast("Đã thêm dự án");renderMain()};
  const goView=(id,view)=>{CVF.da=id;CVV.view=view;CVV.scope="team";cvWhoSet("all");CVF.st="";MOD="cv";PAGE="cv_v";render()};
  m.querySelectorAll("[data-pjv]").forEach(b=>b.onclick=()=>goView(b.dataset.pjv,"list"));
  m.querySelectorAll("[data-pjg]").forEach(b=>b.onclick=()=>goView(b.dataset.pjg,"gantt"));
  m.querySelectorAll("[data-pje]").forEach(b=>b.onclick=()=>openProject(b.dataset.pje));
}
function prjSave(id,v){
  DB.mutate(ME.name,(id?"sửa dự án ":"thêm dự án ")+v.ten,dt=>{dt.projects=dt.projects||[];
    if(id){const p=dt.projects.find(x=>x.id===id);if(!p)return;Object.assign(p,v)}
    else{const n=dt.projects.reduce((z,p)=>Math.max(z,+String(p.id).replace(/\D/g,"")||0),0)+1;
      dt.projects.push(Object.assign({id:"DA-"+String(n).padStart(2,"0"),moTa:"",uu:"Trung bình",tv:[],batDau:0,loc:{none:true,kenh:["__"]}},v));
      if(typeof notifyU==="function")notifyU(dt,[v.owner,...(v.tv||[])],`${ME.name} thêm bạn vào dự án "${v.ten}"`,"page:cv_da")}});
}
function openProject(id){
  const d=D(),p=id?(d.projects||[]).find(x=>x.id===id):null,users=d.users.filter(u=>u.active&&u.role!=="admin"||u.id===ME.id),days=Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]);
  openDrawerHTML(`<h2>${p?"Sửa dự án":"Thêm dự án"}</h2><form class="frm" id="pjf2"><label class="field">Tên dự án<input id="pf-t" required value="${esc(p?p.ten:"")}"></label><label class="field">Mô tả<textarea id="pf-m" rows="2">${esc(p?p.moTa||"":"")}</textarea></label>
   <div class="row4"><label class="field">Team<select id="pf-team">${opt(Object.entries(TEAMS),p?p.team:"content")}</select></label><label class="field">Phụ trách<select id="pf-o">${opt(users.map(u=>[u.id,u.name]),p?p.owner:ME.id)}</select></label></div>
   <div class="row4"><label class="field">Bắt đầu<select id="pf-b">${opt([[0,"—"]].concat(days),p?p.batDau||0:0)}</select></label><label class="field">Hạn<select id="pf-h">${opt(days,p?p.han:MONTH.ndays)}</select></label><label class="field">Ưu tiên<select id="pf-u">${opt(UU,p?p.uu||"Trung bình":"Trung bình")}</select></label></div>
   <div class="field">Thành viên<div class="phc">${users.map(u=>`<label class="ck sm"><input type="checkbox" name="pf-tv" value="${u.id}" ${p&&(p.tv||[]).includes(u.id)?"checked":""}> ${esc(u.name)}</label>`).join("")}</div></div>
   <div class="acts"><button class="btn pri">${p?"Lưu":"Thêm dự án"}</button>${p&&ME.role==="admin"?`<button type="button" class="btn danger" id="pf-del">Xóa</button>`:""}</div></form>`);
  $("#pjf2").onsubmit=e=>{e.preventDefault();prjSave(id,{ten:$("#pf-t").value.trim(),moTa:$("#pf-m").value,team:$("#pf-team").value,owner:$("#pf-o").value,batDau:+$("#pf-b").value||0,han:+$("#pf-h").value,uu:$("#pf-u").value,tv:[...document.querySelectorAll("[name=pf-tv]:checked")].map(x=>x.value)});toast(id?"Đã lưu":"Đã thêm dự án");closeDrawer();renderMain()};
  if($("#pf-del"))$("#pf-del").onclick=()=>{if(!confirm("Xóa dự án này? Các việc trong dự án vẫn còn, chỉ bỏ gắn dự án."))return;DB.mutate(ME.name,"xóa dự án "+p.ten,dt=>{dt.projects=(dt.projects||[]).filter(x=>x.id!==id);(dt.tasks||[]).forEach(t=>{if(t.da===id)t.da=""})});closeDrawer();renderMain()};
}
/* ---------- Gantt: dự án và việc theo trục thời gian của tháng; việc nhiều công đoạn hiện từng đoạn theo từng người ---------- */
function pCvGantt(m){
  const d=D(),td=d.settings.today,N=MONTH.ndays,cl=v=>Math.max(1,Math.min(N,v||1));
  const tasks=cvFilter(cvItems().filter(x=>x.src==="task")).map(x=>d.tasks.find(t=>t.id===x.id)).filter(t=>t&&t.han);
  const segs=t=>{const c=t.cd&&t.cd.length?t.cd:null;
    if(c)return c.map((s,i)=>{const b=cl(s.han||t.han),a=Math.min(b,cl(i?(c[i-1].han||s.han):(t.bd||(b-2))));return {a,b,cls:s.st==="xong"?"dn":(s.han&&s.han<td)?"lt":s.st==="lam"?"dg":"",tip:`${s.ten} · ${userName(s.nguoi)||"—"} · hạn ${dd(s.han)}`,lb:(userName(s.nguoi)||"").split(" ").slice(-1)[0]}});
    const b=cl(t.han),a=Math.min(b,cl(t.bd||(b-2)));return [{a,b,cls:t.st==="done"?"dn":t.han<td?"lt":(t.st==="doing"||t.st==="nhan")?"dg":t.st==="review"?"rv":"",tip:`${t.ten} · ${userName(t.nguoi)||"—"} · hạn ${dd(t.han)}`,lb:(userName(t.nguoi)||"").split(" ").slice(-1)[0]}]};
  const grid=`<div class="gth"><div class="gtl"></div><div class="gtt gtdays">${Array.from({length:N},(_,i)=>{const dy=i+1;return `<span class="${dy===td?"now":wd(dy)>=5?"we":""}"><b>${dy}</b>${THU[wd(dy)]}</span>`}).join("")}</div></div>`;
  const bars=t=>segs(t).map(s=>`<i class="gtb ${s.cls}" style="left:${(s.a-1)/N*100}%;width:${(s.b-s.a+1)/N*100}%" title="${esc(s.tip)}" data-gt="${esc(t.id)}">${esc(s.lb)}</i>`).join("");
  const today=`<b class="gtn" style="left:${(td-.5)/N*100}%"></b>`;
  const row=t=>`<div class="gtr"><div class="gtl" title="${esc(t.ten)}"><b>${esc(cvShort(t.ten,30))}</b><small>${esc(userName(t.nguoi)||"Chưa giao")}${t.cd&&t.cd.length?` · ${t.cd.filter(s=>s.st==="xong").length}/${t.cd.length} công đoạn`:""}</small></div><div class="gtt">${today}${bars(t)}</div></div>`;
  const P=(d.projects||[]).filter(p=>!CVF.da||p.id===CVF.da),inP=id=>tasks.filter(t=>t.da===id),none=tasks.filter(t=>!t.da||!(d.projects||[]).some(p=>p.id===t.da));
  const proj=p=>{const A=Math.min(cl(p.han),cl(p.batDau||1));return `<div class="gtr gtp"><div class="gtl" data-gp="${esc(p.id)}"><b>▣ ${esc(cvShort(p.ten,28))}</b><small>${esc(userName(p.owner)||"")}</small></div><div class="gtt">${today}<i class="gtb pj" style="left:${(A-1)/N*100}%;width:${(cl(p.han)-A+1)/N*100}%" title="${esc(p.ten)} · hạn ${dd(p.han)}"></i></div></div>${inP(p.id).slice(0,40).map(row).join("")}`};
  const body=P.map(proj).join("")+(CVF.da?"":(none.length?`<div class="gtr gtp"><div class="gtl"><b>Việc ngoài dự án</b></div><div class="gtt"></div></div>${none.slice(0,60).map(row).join("")}`:""));
  m.innerHTML=cvFilterBar({noSt:true})+`<section class="card flush gtw">${body?grid+body:`<p class="empty pad">Chưa có việc nào có hạn trong bộ lọc này. Bấm Giao việc, chọn hạn là việc hiện lên đây.</p>`}</section><p class="hint tcnote">Thanh xanh lá: xong · xanh dương: đang làm · đỏ: trễ · vàng: chờ duyệt · xám: chưa bắt đầu. Việc nhiều công đoạn hiện từng đoạn, mỗi đoạn một người. Bấm thanh để mở việc.</p>`;
  bindCvFilter(m);
  m.querySelectorAll("[data-gt]").forEach(b=>b.onclick=()=>openTask(b.dataset.gt));
  m.querySelectorAll("[data-gp]").forEach(b=>b.onclick=()=>openProject(b.dataset.gp));
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

/* =====================================================================
   TASK KIỂU MỚI: một dòng việc gọn thay cho từng video một thẻ
   - Việc TỰ SINH từ kế hoạch + phân bổ: "Edit 5 video tinh dầu 1/5", "Đăng Fanpage: 5 bài chờ đăng", "Lên lịch đăng ...: N video chờ đăng"
   - Việc của lead tự sinh: video/kịch bản cần duyệt, order cần phân công/bàn giao, video win cần check
   - Việc lead GIAO TAY: tên việc, hạn, ghi chú, đính link, nhiều người làm + người hỗ trợ (như cũ)
   - Cảnh báo đỏ: ngày mai kênh cần đăng N video mà mới có M đã lên lịch
   ===================================================================== */
const cvMaker=c=>["dang","xong"].includes(c.step)?(c.nguoiEdit||c.nguoiKB||c.nguoi||""):(c.nguoi||"");
const cvWorkHan=c=>(c.han&&WORK_STEPS.includes(c.step))?c.han:((c.hanCu&&c.hanCu.length)?(c.hanCu[c.hanCu.length-1].han||c.day):c.day);
const cvVerb={viet:"Viết kịch bản",chua:"Viết kịch bản",quay:"Quay",dung:"Edit",sua:"Sửa",doi:"Chờ duyệt"};
const cvActive=id=>{const u=(D().users||[]).find(x=>x.id===id);return !!u&&u.active!==false};
function cvOwner(k){const p=(D().kenhPT||{})[k]||{};return cvActive(p.chinh)?p.chinh:(cvActive(p.phu)?p.phu:"")}
const cvAutoSt=()=>D().autoSt||{};
function cvAutoSet(key,st){DB.mutate(ME.name,"cập nhật trạng thái việc tự sinh",dt=>{dt.autoSt=dt.autoSt||{};if(st)dt.autoSt[key]={st,by:ME.name,at:new Date().toLocaleString("vi-VN")};else delete dt.autoSt[key]})}
const cvShort=(s,n)=>{s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n)+"…":s};

/* việc làm video: gom theo người · kênh · sản phẩm · dạng · hạn; hiện tiến độ đã duyệt / tổng */
function cvFilterNoSt(P,noTg){const st0=CVF.st,tg0=CVF.tg;CVF.st="";if(noTg)CVF.tg="all";try{return cvFilter(P)}finally{CVF.st=st0;CVF.tg=tg0}}
function cvStMatch(g){const f=CVF.st;if(!f)return true;if(f==="late")return !!g.late;if(f==="done")return false;const un=Object.keys(g.cats||{}).filter(k=>!["duyet","dang"].includes(k)),rv=g.kind==="mk"&&un.length&&un.every(k=>k==="doi");if(f==="review")return !!rv;if(f==="doing")return g.st==="doing"&&!rv;if(f==="todo")return g.st!=="doing"&&!rv;return true}
function cvAutoMk(raw){
  const d=D(),byId={};d.cards.forEach(c=>byId[c.id]=c);
  const P=cvItems().filter(x=>x.src==="card"&&byId[x.id]&&byId[x.id].step!=="cg").map(x=>{const c=byId[x.id];return Object.assign({},x,{nguoi:cvMaker(c),han:cvWorkHan(c)||x.han})});
  const map={},out=[];
  const LP=raw?P:cvFilterNoSt(P,true);
  LP.forEach(x=>{const c=byId[x.id],k=["mk",x.nguoi,c.kenh,c.sku,c.fpId?"fp":x.mix,x.han].join("|");let g=map[k];
    if(!g){g=map[k]={key:k,kind:"mk",nguoi:x.nguoi,kenh:c.kenh,sku:c.sku,fp:!!c.fpId,han:x.han,ids:[],cats:{},late:false,lateD:0};out.push(g)}
    g.ids.push(c.id);g.cats[x.cat]=(g.cats[x.cat]||0)+1;if(x.late){g.late=true;g.lateD=Math.max(g.lateD,x.lateD||0)}});
  return out.filter(g=>{g.n=g.ids.length;g.done=(g.cats.duyet||0)+(g.cats.dang||0);return g.n-g.done>0}).map(g=>{
    const cs=Object.entries(g.cats).filter(([k])=>!["duyet","dang"].includes(k)).sort((a,b)=>b[1]-a[1]),top=cs.length?cs[0][0]:"chua";
    g.ten=`${cvVerb[top]||"Làm"} ${g.n} ${g.fp?"bài Fanpage":"video "+sk(g.sku).n}`;
    g.mo=`${chOf(g.kenh).short} · ${g.han?"hạn "+dd(g.han)+(g.han<d.settings.today?" (đã quá)":g.han===d.settings.today?" (hôm nay)":""):"CHƯA CÓ HẠN, lead đặt hạn"}`;
    const a=cvAutoSt()[g.key];g.st=a&&a.st==="doing"?"doing":"todo";return g})
}
/* việc đăng bài: gom theo kênh và ngày; ngày nào nhắc ngày đó; chưa có ngày thì nhắc "lên lịch" */
function cvAutoDg(raw){
  const d=D(),td=d.settings.today,P=[],byId={};
  d.cards.filter(c=>c.step==="dang").forEach(c=>{byId[c.id]=c;const day=+c.day||0;if(day&&day>td)return;P.push({id:c.id,src:"card",nguoi:cvOwner(c.kenh),phoi:[],team:"content",da:"",uu:"Trung bình",st:"todo",ten:"",mo:"",han:day||td,lateD:day&&day<td?td-day:0,late:!!(day&&day<td)})});
  const map={},out=[];
  (raw?P:cvFilterNoSt(P,false)).forEach(x=>{const c=byId[x.id],day=+c.day||0,k=["dg",c.kenh,day].join("|");let g=map[k];
    if(!g){g=map[k]={key:k,kind:"dg",nguoi:x.nguoi,kenh:c.kenh,day,fp:!!c.fpId,han:x.han,ids:[],late:x.late,lateD:x.lateD};out.push(g)}g.ids.push(c.id)});
  return out.map(g=>{g.n=g.ids.length;const sh=chOf(g.kenh).short,u=(g.fp||/Fanpage/i.test(g.kenh))?"bài":"video";
    g.ten=g.day?`Đăng ${sh}: ${g.n} ${u} chờ đăng`:`Lên lịch đăng ${sh}: ${g.n} ${u} chờ đăng`;
    g.mo=g.day?(g.late?`lẽ ra đăng ${dd(g.day)}, trễ ${g.lateD} ngày`:"đăng hôm nay"):"chưa chọn ngày đăng";
    const a=cvAutoSt()[g.key];g.st=a&&a.st==="doing"?"doing":"todo";return g})
}
/* việc của lead: tự sinh theo số đang chờ */
function cvLeadLines(){
  const d=D(),cs=d.cards,O=d.orders||[],L=[],add=(t,n,go)=>{if(n>0)L.push({ten:t,n,go})};
  if(!(can(ME,"viec.duyet")||ME.role==="admin"||ME.role==="lead"))return L;
  add("Video mới cần duyệt",cs.filter(c=>c.step==="dvd").length,"cv");
  add("Kịch bản cần duyệt",cs.filter(c=>c.step==="dkb").length,"cv");
  if(ME.role==="admin")add("Video chờ CEO duyệt",cs.filter(c=>c.step==="dceo").length,"cv");
  add("Order Digital cần phân công",O.filter(o=>o.trangThai==="Mới"&&!o.giao).length,"order_c");
  add("Order Digital cần bàn giao",O.filter(o=>o.trangThai!=="Xong"&&cs.some(c=>c.order===o.ma&&stepIdx(c.step)>=stepIdx("dang")&&!c.bg)).length,"order_c");
  try{add("Video win inhouse cần check",hyAnalyses().filter(t=>t.status==="review").length,"win:rank")}catch(e){}
  add("Video win KOC cần check",(d.kocVideos||[]).filter(v=>(+v.don||0)>=(d.settings.potential||30)&&!v.st).length,"win:koc");
  add("Video đã giao nhưng chưa có hạn",cs.filter(c=>c.nguoi&&["kb","quay","edit","worker"].includes(c.step)&&!c.han&&!c.day).length,"dieuphoi");
  add("Video chưa giao người làm",cs.filter(c=>c.step==="cg").length,"dieuphoi");
  return L
}
/* cảnh báo đỏ: ngày mai kênh cần đăng N video mà mới có M video đã lên lịch cho ngày mai */
function cvWarn(){
  const d=D(),td=d.settings.today,out=[];if(td+1>MONTH.ndays)return out;
  const lead=ME.role==="admin"||ME.role==="lead"||(can(ME,"viec.giao")&&cvTeamSee(teamOf(ME),"content"));
  CHANNELS.forEach(ch=>{const own=cvOwner(ch.k);if(!lead&&own!==ME.id)return;
    let need=0;try{need=calCap(ch.k,td+1)}catch(e){}
    const have=d.cards.filter(c=>c.kenh===ch.k&&c.step==="dang"&&(+c.day||0)===td+1).length;
    if(need>0&&have<need)out.push({short:ch.short,need,have,own})});
  return out
}
function cvOpenMk(g){
  const d=D(),cs=g.ids.map(id=>d.cards.find(c=>c.id===id)).filter(Boolean);
  openDrawerHTML(`<h2>${esc(g.ten)} · ${g.done}/${g.n}</h2><p class="hint">${esc(g.mo)} · ${esc(userName(g.nguoi)||"chưa giao")}</p>
   <div class="xlist">${cs.map(c=>`<div class="xmini"><span class="xmt"><b class="mono">${esc(c.id)}</b> ${esc(cvShort(c.hookText||c.yTuong||c.tuyen,70))}</span>${pill(stepName(c.step),["dang","xong"].includes(c.step)?"grn":"gry")}<button type="button" class="btn sm" data-opc="${esc(c.id)}">Mở</button></div>`).join("")}</div>`);
  document.querySelectorAll("[data-opc]").forEach(b=>b.onclick=()=>{closeDrawer();openCard(b.dataset.opc)})
}
function cvOpenDg(g){
  const d=D(),td=d.settings.today,cs=g.ids.map(id=>d.cards.find(c=>c.id===id)).filter(Boolean),days=[[0,"Chưa chọn ngày"]].concat(Array.from({length:Math.max(0,MONTH.ndays-td+1)},(_,i)=>[td+i,dayLbl(td+i)]));
  openDrawerHTML(`<h2>${esc(g.ten)}</h2><p class="hint">${esc(g.mo)} · ${esc(userName(g.nguoi)||"chưa có người phụ trách kênh")}</p>
   ${cs.map(c=>{const lk=c.linkFinal||c.linkVideo||c.linkAnh||"",cap=c.caption||c.noiDung||"";return `<section class="card pad" data-dgc="${esc(c.id)}"><b class="mono">${esc(c.id)}</b> ${esc(cvShort(c.hookText||c.yTuong||c.tuyen,90))}
    <div class="acts">${lk?`<a class="btn sm" href="${esc(/^https?:/i.test(lk)?lk:"https://"+lk)}" target="_blank" rel="noopener">Mở video / ảnh</a>`:`<span class="hint">chưa có link video</span>`}<button type="button" class="btn sm ghost" data-opc="${esc(c.id)}">Chi tiết thẻ</button></div>
    ${cap?`<label class="field">Caption<textarea rows="3" readonly>${esc(cap)}</textarea></label><button type="button" class="btn sm ghost" data-cpc="${esc(c.id)}">Sao chép caption</button>`:""}
    <label class="field">Ngày đăng<select data-dgday="${esc(c.id)}">${opt(days,+c.day||0)}</select></label>
    <label class="field">Link bài đã đăng<input data-dgl="${esc(c.id)}" placeholder="Dán link bài sau khi đăng" value="${esc(c.linkDang||"")}"></label>
    <button type="button" class="btn sm pri" data-dgok="${esc(c.id)}">Đã đăng</button></section>`}).join("")}`);
  document.querySelectorAll("[data-opc]").forEach(b=>b.onclick=()=>{closeDrawer();openCard(b.dataset.opc)});
  document.querySelectorAll("[data-cpc]").forEach(b=>b.onclick=()=>{const c=d.cards.find(x=>x.id===b.dataset.cpc),t=(c&&(c.caption||c.noiDung))||"";try{navigator.clipboard.writeText(t);toast("Đã sao chép caption")}catch(e){toast("Không sao chép được, bôi đen rồi sao chép tay")}});
  document.querySelectorAll("[data-dgday]").forEach(s=>s.onchange=()=>{const id=s.dataset.dgday,v=+s.value||0;DB.mutate(ME.name,"chọn ngày đăng "+id,dt=>{const x=dt.cards.find(y=>y.id===id);if(x)x.day=v});toast(v?"Đã đặt ngày đăng "+dd(v):"Đã bỏ ngày đăng");closeDrawer();renderMain()});
  document.querySelectorAll("[data-dgok]").forEach(b=>b.onclick=()=>{const id=b.dataset.dgok,inp=document.querySelector(`[data-dgl="${id}"]`),link=inp?inp.value.trim():"";if(!link){toast("Dán link bài đã đăng rồi bấm Đã đăng");return}
    const e=moveCard(ME,id,"xong",{linkDang:link});if(e){toast(e);return}toast("Đã chuyển sang Đã đăng");closeDrawer();renderMain()})
}
function pCvNv2(m){
  const d=D(),td=d.settings.today,sm=cvSummaryOnly(),mk=sm?[]:cvAutoMk(),dg=sm?[]:cvAutoDg(),lead=(CVF.st||sm)?[]:cvLeadLines(),warn=sm?[]:cvWarn();
  const auto=mk.concat(dg).filter(cvStMatch).sort((a,b)=>(b.late-a.late)||((a.han||0)-(b.han||0))),
    tasks=cvGroup(cvFilter(cvItems().filter(x=>x.src!=="card"))).sort((a,b)=>(b.late-a.late)||(a.st==="done")-(b.st==="done")||(b.st==="review")-(a.st==="review")||a.han-b.han);
  const rawT=D().tasks||[],openT=rawT.filter(t=>t.st!=="done"),mineN=openT.filter(t=>t.nguoi===ME.id||(t.phoi||[]).includes(ME.id)).length,waitN=rawT.filter(t=>t.st==="review"&&tkMgr(t)).length,lateN=tasks.filter(x=>x.late).length,dueT=tasks.filter(x=>x.han&&x.han<=td),okT=dueT.filter(x=>x.st==="done"||!x.late).length;
  const tile=(k,l,v,cls)=>`<${k?`button type="button" data-tile="${k}"`:"div"} class="cvtile${cls?" "+cls:""}"><span>${l}</span><b>${v}</b></${k?"button":"div"}>`;
  const tilesHtml=`<div class="cvtiles">${tile("mine","Việc của tôi",mineN)}${tile("wait","Chờ tôi duyệt",waitN,waitN?"amb":"")}${tile("late","Quá hạn",lateN,lateN?"red":"")}${tile("","Đúng hạn",dueT.length?Math.round(okT/dueT.length*100)+"%":"—")}</div>`;
  const hanL=x=>!x.han?"—":x.han===td?"Hôm nay":x.han===td+1?"Mai":dayLbl(x.han);
  const stP=x=>x.late&&x.st!=="done"?pill(x.st==="review"?"Chờ duyệt · trễ":"Trễ "+x.lateD+" ngày","red"):pill(cvStN(x.st),(CV_ST.find(s=>s[0]===x.st)||[])[2]);
  /* việc làm video, đăng bài: gom theo kênh, mỗi kênh một nhóm thu gọn được; nhóm có việc trễ tự mở */
  const gmap={};auto.forEach(g=>{const k=g.kenh?chOf(g.kenh).short:"Khác";(gmap[k]=gmap[k]||[]).push(g)});
  const gl=Object.entries(gmap).map(([k,a])=>({k,a,late:a.filter(x=>x.late).length,n:a.reduce((z,x)=>z+(x.kind==="mk"?x.n:0),0),done:a.reduce((z,x)=>z+(x.kind==="mk"?x.done:0),0)})).sort((x,y)=>y.late-x.late||y.a.length-x.a.length);
  const autoGroupsHtml=()=>gl.map(G=>`<details class="cvgrp" data-gk="${esc(G.k)}"${(G.k in CVG?CVG[G.k]:false)?" open":""}><summary><b>${esc(G.k)}</b><span class="cvgc">${G.a.length} việc</span>${G.late?`<span class="pill p-red">${G.late} trễ</span>`:""}${G.n?`<span class="cvgp">${G.done}/${G.n} video xong</span>`:""}</summary>${G.a.map(row).join("")}</details>`).join("");
  const taskTbl=`<section class="card flush cvscroll">${tasks.length?tbl(["Việc","Người làm","Người giao","Hạn","Trạng thái"],tasks.slice(0,200).map(x=>`<tr class="clk${x.late?" late":""}" data-cv="${x.id}" data-src="${x.src}"${x.n>1?` data-grp="${x.ids.join(",")}"`:""}><td><b${x.st==="done"?` class="strike"`:""}>${esc(x.ten)}</b>${x.da?`<small>${esc(prjN(x.da))}</small>`:x.mo?`<small>${esc(cvShort(x.mo,80))}</small>`:""}</td><td>${x.cd&&x.cd.length?`${avatar(x.nguoi)}${esc(userName(x.nguoi)||"—")}<small>${x.cd.filter(s=>s.st==="xong").length}/${x.cd.length} công đoạn</small>`:`${avatar(x.nguoi)}${esc(userName(x.nguoi)||"Chưa giao")}${x.phoi.length?` <small>+${x.phoi.length}</small>`:""}`}</td><td>${esc(userName(x.tao)||"—")}</td><td${x.late?` class="t-red"`:""}>${hanL(x)}</td><td>${stP(x)}</td></tr>`)):`<p class="empty">Chưa có việc nào. Bấm “Giao việc” để tạo.</p>`}</section>`;
  const row=g=>`<div class="cvr${g.late?" late":""}" data-au="${esc(g.key)}"><span class="cvri">${g.kind==="dg"?"📤":"🎬"}</span><div class="cvrt"><b>${esc(g.ten)}</b>${g.kind==="mk"?` <span class="cvrp">${g.done}/${g.n}</span>`:""}<small>${esc(g.mo)}</small></div><span class="who">${avatar(g.nguoi)}${esc(userName(g.nguoi)||"Chưa giao")}${g.nguoi&&!cvActive(g.nguoi)?` <small class="t-red">đã nghỉ</small>`:""}</span>${g.kind==="mk"&&g.nguoi===ME.id?`<button type="button" class="btn sm${g.st==="doing"?" pri":""}" data-aust="${esc(g.key)}">${g.st==="doing"?"✓ Đang làm":"Đang làm"}</button>`:(g.st==="doing"?pill("Đang làm","blu"):"")}</div>`;
  m.innerHTML=`<style>.cvr{display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid #e6e9f2;cursor:pointer;background:#fff}.cvr:hover{background:#f6f8fd}.cvr.late{border-left:4px solid #e03131}.cvri{font-size:18px}.cvrt{flex:1;min-width:0}.cvrt b{font-size:15px}.cvrt small{display:block;color:#6b7280;margin-top:2px}.cvrp{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;background:#eef2ff;color:#3b5bdb;font-weight:700;font-size:13px}.cvwarn{background:#fff1f1;border:1px solid #f3b4b4;color:#b42318;border-radius:12px;padding:12px 16px;margin:0 0 12px}.cvlead .cvr b{font-size:15px}.cvbar{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center;margin:0 0 12px}.cvbar input,.cvbar select{font:inherit;font-size:13.5px;padding:6px 10px;border:1px solid var(--line);border-radius:9px;background:#fff;min-width:0;max-width:190px}.cvbar input{width:170px}.cvtiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px}.cvtile{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;background:#fff;border:1px solid var(--line);border-radius:12px;padding:9px 14px;font:inherit}button.cvtile{cursor:pointer}button.cvtile:hover{background:#f6f8fd}.cvtile span{font-size:12.5px;color:#6b7280}.cvtile b{font-size:22px;font-weight:600}.cvtile.red b{color:#e03131}.cvtile.amb b{color:#b45309}tr.late td:first-child{box-shadow:inset 3px 0 #e03131}.tklate.ok{background:#f6f8fd;border-color:#dfe5f4}@media (max-width:700px){.cvtiles{grid-template-columns:repeat(2,minmax(0,1fr))}.cvbar{justify-content:stretch}.cvbar input,.cvbar select{flex:1 1 130px;max-width:none}}.cvn{display:inline-block;min-width:26px;text-align:center;padding:2px 9px;border-radius:99px;background:#fff4e0;color:#b45309;font-weight:800}</style>`
  +cvFilterBar()+tilesHtml+`
  ${warn.length?`<details class="cvwarn"><summary>⚠ Ngày mai ${warn.length} kênh chưa đủ video đăng · bấm để xem</summary>${warn.map(w=>`Mai (${dd(td+1)}) ${esc(w.short)} cần đăng <b>${w.need}</b> video, hiện mới có <b>${w.have}</b> video đã lên lịch${w.own?" · "+esc(userName(w.own)):""}`).join("<br>")}</details>`:""}
  ${taskTbl}
  ${lead.length?`<section class="card flush cvlead"><div class="card-h pad"><h2>Cần xử lý</h2></div>${lead.map(l=>`<div class="cvr" data-gol="${esc(l.go)}"><span class="cvri">✅</span><div class="cvrt"><b>${esc(l.ten)}</b></div><span class="cvn">${l.n}</span></div>`).join("")}</section>`:""}
  <section class="card flush"><div class="card-h pad"><h2>Việc làm video, đăng bài</h2><span class="hint">${auto.length}</span></div>${autoGroupsHtml()||`<p class="empty">Không có việc nào trong bộ lọc này.</p>`}</section>`;
  m.querySelectorAll("[data-tile]").forEach(b=>b.onclick=()=>{const k=b.dataset.tile;if(k==="mine"){cvWhoSet("mine");CVF.st=""}else CVF.st=k==="wait"?"review":"late";renderMain()});
  bindCvFilter(m);bindCvCards(m);bindNew();
  m.querySelectorAll("details.cvgrp").forEach(g=>g.addEventListener("toggle",()=>{CVG[g.dataset.gk]=g.open}));
  m.querySelectorAll("[data-aust]").forEach(b=>b.onclick=e=>{e.stopPropagation();const k=b.dataset.aust,on=(cvAutoSt()[k]||{}).st==="doing";cvAutoSet(k,on?"":"doing");renderMain()});
  m.querySelectorAll("[data-au]").forEach(r=>r.onclick=e=>{if(e.target.closest("button"))return;const g=auto.find(x=>x.key===r.dataset.au);if(g){if(g.kind==="dg")cvOpenDg(g);else cvOpenMk(g)}});
  m.querySelectorAll("[data-gol]").forEach(r=>r.onclick=()=>{const p=r.dataset.gol.split(":");if(p[0]==="win")SUB.win=p[1];PAGE=p[0];MOD="";render();scrollTo(0,0)})
}
/* nếu việc tự sinh gặp lỗi bất ngờ thì quay về màn hình Task cũ, không để trang trắng */
PAGES.cv_nv=m=>{try{pCvNv2(m)}catch(e){console.error("Task mới lỗi, dùng bản cũ",e);pCvNv(m)}};

/* =====================================================================
   NHẮC VIỆC BẰNG CHUÔNG (Task kiểu mới)
   - Còn ≤ 2 ngày tới hạn mà người làm chưa bấm "Đang làm": nhắc người làm, mỗi ngày một lần
   - Đến hạn hôm nay: nhắc người làm và lead
   - Trễ từ 1 ngày: cảnh báo người làm và lead, mỗi ngày một lần
   - Đăng bài: hôm nay cần đăng thì nhắc người phụ trách kênh và lead; đăng trễ thì cảnh báo
   - Việc lead giao tay: nhắc tương tự (người làm + người cùng làm / hỗ trợ)
   Web chạy ở trình duyệt nên nhắc được tạo khi có người mở web (ai mở trước thì tạo, trùng thì bỏ qua).
   ===================================================================== */
function cvPush(dt,ids,text,ref){dt.notifs=dt.notifs||[];[...new Set([].concat(ids).filter(Boolean))].forEach(to=>{dt.notifs.push({id:uid("nt"),to,text,at:nowISO(),ref:ref||"",by:"",read:false})});if(typeof NT_KEEP!=="undefined"&&dt.notifs.length>NT_KEEP)dt.notifs=dt.notifs.slice(-NT_KEEP)}
function cvRemindList(){
  const d=D(),td=d.settings.today,out=[],leads=(d.users||[]).filter(u=>u.active!==false&&(u.role==="admin"||u.role==="lead")).map(u=>u.id);
  const push=(type,key,to,text)=>{to=[...new Set((to||[]).filter(Boolean))];if(to.length)out.push({k:type+"|"+key,to,text})};
  cvAutoMk(true).forEach(g=>{const who=userName(g.nguoi)||"chưa giao",mine=g.nguoi&&cvActive(g.nguoi)?[g.nguoi]:[],t=`${g.ten} (${g.done}/${g.n})`;if(!g.han)return;
    if(g.han>=td&&g.han-td<=2&&g.st!=="doing")push("n",g.key,mine,`Bạn chưa bấm "Đang làm": ${t} · hạn ${dd(g.han)}`);
    if(g.han===td)push("d",g.key,mine.concat(leads),`Đến hạn hôm nay: ${t} · ${who}`);
    if(g.han<td)push("l",g.key,mine.concat(leads),`⚠ Trễ ${td-g.han} ngày: ${t} · ${who}`)});
  cvAutoDg(true).forEach(g=>{const who=userName(g.nguoi)||"chưa có người phụ trách",mine=g.nguoi&&cvActive(g.nguoi)?[g.nguoi]:[];
    if(!g.day)push("s",g.key,mine,`${g.ten}`);
    else if(g.day===td)push("d",g.key,mine.concat(leads),`Hôm nay cần đăng: ${g.ten} · ${who}`);
    else if(g.day<td)push("l",g.key,mine.concat(leads),`⚠ Đăng trễ ${td-g.day} ngày: ${g.ten} · ${who}`)});
  (d.tasks||[]).forEach(t=>{if(t.st==="done"||!t.han)return;const mine=[t.nguoi].concat(t.phoi||[]).filter(x=>x&&cvActive(x)),who=userName(t.nguoi)||"chưa giao";
    if(t.han>=td&&t.han-td<=2&&["todo","nhan"].includes(t.st))push("n","tk|"+t.id,mine,`Bạn chưa bấm "Đang làm": ${t.ten} · hạn ${dd(t.han)}`);
    if(t.han===td)push("d","tk|"+t.id,mine.concat(leads),`Đến hạn hôm nay: ${t.ten} · ${who}`);
    if(t.han<td)push("l","tk|"+t.id,mine.concat(leads),`⚠ Trễ ${td-t.han} ngày: ${t.ten} · ${who}`)});
  return out
}
function cvRemind(){
  if(typeof ME==="undefined"||!ME||!DB.data)return;
  const sfx="#"+MONTH.key+"-"+D().settings.today,done=D().autoRem||{},L=cvRemindList().filter(r=>!done[r.k+sfx]);
  if(!L.length)return;
  DB.mutate("Hệ thống","nhắc việc tự động",dt=>{dt.autoRem=dt.autoRem||{};const sf="#"+MONTH.key+"-"+dt.settings.today;Object.keys(dt.autoRem).forEach(k=>{if(!k.endsWith(sf))delete dt.autoRem[k]});
    L.forEach(r=>{const key=r.k+sf;if(dt.autoRem[key])return;dt.autoRem[key]=1;cvPush(dt,r.to,r.text,"page:cv_nv")})})
}
setTimeout(()=>{try{cvRemind()}catch(e){console.warn("nhắc việc lỗi",e)}},8000);
setInterval(()=>{try{if(!document.hidden)cvRemind()}catch(e){console.warn("nhắc việc lỗi",e)}},300000);

/* việc "Nhân bản video win": chỉ hiện "Nhân bản video win <sản phẩm>" và "Số lượng: x" (không kèm tên video dài) */
function cvWinInfo(t){
  let sp=t.sp||"",sl=+t.sl||0,dn=0;
  try{const a=typeof HYW!=="undefined"&&HYW.tasks?HYW.tasks.find(x=>x.id===t.hy):null,p=(a&&a.payload)||{};sp=sp||p.spTen||"";sl=sl||(+p.variants||0);dn=((a&&a.result||{}).approved||[]).length}catch(e){}
  if(!sp){const fd=typeof foldName==="function"?foldName:(x=>String(x||"").toLowerCase()),m=(D().products||[]).find(p=>p.n&&fd(t.ten).includes(fd(p.n)));sp=m?m.n:""}
  const tr=(t.trinh||[]).length;if(!sl)sl=Math.max(tr,dn);if(t.st==="done"&&sl)dn=sl;
  return {ten:"Nhân bản"+(sl?" "+sl:"")+" video win"+(sp?" "+sp:"")+(sl?" · "+dn+"/"+sl:""),mo:tr?tr+" video đang chờ duyệt":""}
}

/* =====================================================================
   TOÀN CẢNH — một màn hình cho người quản lý: số tổng · ai ôm bao nhiêu việc · cần xử lý ngay · phòng ban · tuần này
   ===================================================================== */
function pCvTc(m){
  if(cvSummaryOnly())return pCvTcTong(m);
  if(ME.role==="admin")return pCvTcCeo(m);
  return pCvTcOld(m);
}
function pCvTcOld(m){
  const d=D(),td=d.settings.today,W=WEEKS.find(w=>td>=w.tu&&td<=w.den)||WEEKS[0],L=cvGroup(cvFilter(cvItems().filter(x=>typeof CV_TEST==="undefined"||!CV_TEST.includes(x.nguoi)))).map(x=>typeof cvTestToChi==="function"?cvTestToChi(x):x);
  const open=L.filter(x=>x.st!=="done"),late=open.filter(x=>x.late).sort((a,b)=>b.lateD-a.lateD),wait=open.filter(x=>x.st==="review"),tod=open.filter(x=>x.han===td);
  const due=L.filter(x=>x.han&&x.han<=td),okN=due.filter(x=>x.st==="done"||!x.late).length;
  const tl=(k,l,v,c)=>`<${k?`button type="button" data-tl="${k}"`:"div"} class="tctile${c?" "+c:""}"><span>${l}</span><b>${v}</b></${k?"button":"div"}>`;
  const P={};L.forEach(x=>{if(x.st==="done")return;const p=P[x.nguoi||""]=P[x.nguoi||""]||{id:x.nguoi||"",late:0,tod:0,wk:0,rv:0,open:0};p.open++;if(x.late)p.late++;if(x.han===td)p.tod++;if(x.han>=W.tu&&x.han<=W.den)p.wk++;if(x.st==="review")p.rv++});
  const PR=Object.values(P).sort((a,b)=>b.late-a.late||b.open-a.open),mx=Math.max(1,...PR.map(r=>r.open)),shown=PR.slice(0,8);
  const num=(n,c)=>n?`<span class="tcn ${c||""}">${n}</span>`:`<span class="tcz">0</span>`;
  const barC=r=>r.late?"#E24B4A":r.open/mx>=.6?"#EF9F27":"#639922";
  const ppl=shown.map(r=>{const u=d.users.find(x=>x.id===r.id)||{};return `<tr class="clk" data-pp="${esc(r.id)}"><td>${r.id?avatar(r.id)+esc(u.name||""):"Chưa giao"}<small>${r.id?esc(TEAMS[teamOf(u)]||""):""}</small></td><td>${num(r.late,"r")}</td><td>${num(r.tod)}</td><td>${num(r.wk)}</td><td>${num(r.rv,"a")}</td><td><div class="tcbar"><i style="width:${Math.max(6,Math.round(r.open/mx*100))}%;background:${barC(r)}"></i></div></td></tr>`}).join("");
  const warn=cvWarn(),need=[];
  warn.slice(0,2).forEach(w=>need.push(`<div class="tcr" data-go="cv_nv"><span class="t-red">Mai thiếu video</span> · ${esc(w.short)} ${w.have}/${w.need}</div>`));
  const row=(x,tag,c)=>`<div class="tcr" data-cv="${x.id}" data-src="${x.src}"${x.n>1?` data-grp="${x.ids.join(",")}"`:""}><span class="${c}">${tag}</span> · ${esc(cvShort(x.ten,46))} · ${esc((userName(x.nguoi)||"Chưa giao").split(" ").slice(-1)[0])}</div>`;
  late.slice(0,3).forEach(x=>need.push(row(x,"Trễ "+x.lateD+" ngày","t-red")));
  wait.slice(0,6-need.length).forEach(x=>need.push(row(x,"Chờ duyệt","t-amb")));
  const TM={};L.forEach(x=>{const k=x.team||"chung",t=TM[k]=TM[k]||{k,n:0,ok:0,late:0};t.n++;if(x.st==="done")t.ok++;else if(x.late)t.late++});
  const tms=Object.values(TM).filter(t=>t.n).sort((a,b)=>b.n-a.n).slice(0,5);
  const days=[];for(let i=W.tu;i<=W.den;i++)days.push(i);
  const dc=days.map(dy=>open.filter(x=>x.han===dy).length),dmx=Math.max(1,...dc);
  m.innerHTML=cvFilterBar({noSt:true})+`<div class="tctiles">${tl("run","Đang chạy",open.length)}${tl("late","Quá hạn",late.length,late.length?"red":"")}${tl("wait","Chờ duyệt",wait.length,wait.length?"amb":"")}${tl("tod","Hạn hôm nay",tod.length)}${tl("","Đúng hạn",due.length?Math.round(okN/due.length*100)+"%":"—","grn")}</div>
  <div class="tcmain"><section class="card tcbox"><h3>Ai đang ôm bao nhiêu việc</h3><table class="tcp"><thead><tr><th>Người</th><th>Trễ</th><th>Hôm nay</th><th>Tuần này</th><th>Chờ duyệt</th><th>Tải việc</th></tr></thead><tbody>${ppl||`<tr><td colspan="6" class="empty">Chưa có việc đang chạy.</td></tr>`}</tbody></table>${PR.length>8?`<button class="lnk" data-go="cv_nv">+${PR.length-8} người nữa, xem danh sách →</button>`:""}</section>
  <section class="card tcbox"><h3>Cần xử lý ngay</h3>${need.join("")||`<p class="empty">Không có việc nào cần xử lý gấp.</p>`}</section></div>
  <div class="tcbot"><section class="card tcbox"><h3>Theo phòng ban</h3>${tms.map(t=>`<div class="tcd"><span>${esc(TEAMS[t.k]||t.k)}</span><div class="tcbar"><i style="width:${Math.round(t.ok/t.n*100)}%;background:#7F77DD"></i></div><b>${Math.round(t.ok/t.n*100)}%</b>${t.late?`<small class="t-red">${t.late} trễ</small>`:""}</div>`).join("")||`<p class="empty">Chưa có dữ liệu.</p>`}</section>
  <section class="card tcbox"><h3>Tuần này, số việc đến hạn mỗi ngày</h3><div class="tcwk">${days.map((dy,i)=>`<div class="${dy===td?"now":dy<td&&dc[i]?"past":""}"><i style="height:${Math.max(3,Math.round(dc[i]/dmx*46))}px"></i><b>${dc[i]}</b><span>${THU[wd(dy)]}</span></div>`).join("")}</div></section></div>`;
  bindCvFilter(m);bindCvCards(m);
  m.querySelectorAll("[data-tl]").forEach(b=>b.onclick=()=>{const k=b.dataset.tl;CVF.st=k==="late"?"late":k==="wait"?"review":"";CVF.tg=k==="tod"?"today":CVF.tg;PAGE="cv_nv";render()});
  m.querySelectorAll("[data-pp]").forEach(r=>r.onclick=()=>{if(r.dataset.pp)cvWhoSet("p:"+r.dataset.pp);CVF.st="";PAGE="cv_nv";render()});
  m.querySelectorAll("[data-go]").forEach(r=>r.onclick=()=>{PAGE=r.dataset.go;render()});
}
PAGES.cv_tc=m=>{try{pCvTc(m)}catch(e){console.error("Toàn cảnh lỗi, dùng danh sách",e);PAGES.cv_nv(m)}};

/* Toàn cảnh kiểu tổng hợp: hiệu quả từng team, bấm vào team để xem chi tiết team đó (không có việc hằng ngày từng người) */
function pCvTcTong(m){
  const d=D(),td=d.settings.today,W=WEEKS.find(w=>td>=w.tu&&td<=w.den)||WEEKS[0],L=cvGroup(cvFilter(cvItems())),one=CVF.wt;
  const teamK=x=>{const u=d.users.find(y=>y.id===x.nguoi);return u?teamOf(u):"_"};
  const TM={};L.forEach(x=>{const k=teamK(x),t=TM[k]=TM[k]||{k,n:0,ok:0,run:0,late:0,rv:0,due:0,dueOk:0};t.n++;if(x.st==="done")t.ok++;else{t.run++;if(x.late)t.late++;if(x.st==="review")t.rv++}if(x.han&&x.han<=td){t.due++;if(x.st==="done"||!x.late)t.dueOk++}});
  const T=Object.values(TM).sort((a,b)=>b.late-a.late||b.n-a.n),sum=f=>T.reduce((a,t)=>a+f(t),0),due=sum(t=>t.due),dueOk=sum(t=>t.dueOk);
  const tl=(l,v,c)=>`<div class="tctile${c?" "+c:""}"><span>${l}</span><b>${v}</b></div>`;
  const nm=k=>k==="_"?"Chưa giao người":k==="all"?"Chưa xếp team":cvTeamName(k),pc=t=>t.due?Math.round(t.dueOk/t.due*100)+"%":"—";
  const zero=`<span class="tcz">0</span>`;
  const days=[];for(let i=W.tu;i<=W.den;i++)days.push(i);const open=L.filter(x=>x.st!=="done"),dc=days.map(dy=>open.filter(x=>x.han===dy).length),dmx=Math.max(1,...dc);
  const rows=T.map(t=>`<tr class="${one?"":"clk"}" data-tm="${esc(t.k)}"><td><b>${esc(nm(t.k))}</b></td><td>${t.run}</td><td>${t.late?`<span class="tcn r">${t.late}</span>`:zero}</td><td>${t.rv?`<span class="tcn a">${t.rv}</span>`:zero}</td><td>${pc(t)}</td><td><div class="tcbar"><i style="width:${t.n?Math.round(t.ok/t.n*100):0}%;background:#7F77DD"></i></div></td></tr>`).join("")||`<tr><td colspan="6" class="empty">Chưa có dữ liệu.</td></tr>`;
  const head=one?`<button class="lnk" data-back="1">← Tất cả team</button> · ${esc(nm(one))}`:"Hiệu quả từng team";
  const wk=one?`<section class="card tcbox" style="margin-top:12px"><h3>Tuần này, số việc đến hạn mỗi ngày</h3><div class="tcwk">${days.map((dy,i)=>`<div class="${dy===td?"now":dy<td&&dc[i]?"past":""}"><i style="height:${Math.max(3,Math.round(dc[i]/dmx*46))}px"></i><b>${dc[i]}</b><span>${THU[wd(dy)]}</span></div>`).join("")}</div></section>`:"";
  m.innerHTML=cvFilterBar({noSt:true})+`<div class="tctiles" style="grid-template-columns:repeat(4,minmax(0,1fr))">${tl("Đang chạy",sum(t=>t.run))}${tl("Quá hạn",sum(t=>t.late),sum(t=>t.late)?"red":"")}${tl("Chờ duyệt",sum(t=>t.rv),sum(t=>t.rv)?"amb":"")}${tl("Đúng hạn",due?Math.round(dueOk/due*100)+"%":"—","grn")}</div>
  <section class="card tcbox"><h3>${head}</h3><table class="tcp tcteam"><thead><tr><th>Team</th><th>Đang chạy</th><th>Trễ</th><th>Chờ duyệt</th><th>Đúng hạn</th><th>Hoàn thành</th></tr></thead><tbody>${rows}</tbody></table></section>${wk}`;
  bindCvFilter(m);
  m.querySelectorAll("[data-tm]").forEach(r=>r.onclick=()=>{if(one||r.dataset.tm==="_"||r.dataset.tm==="all")return;cvWhoSet("t:"+r.dataset.tm);renderMain()});
  const bk=m.querySelector("[data-back]");if(bk)bk.onclick=()=>{cvWhoSet("all");renderMain()};
}

/* =====================================================================
   TOÀN CẢNH CHO CHỊ (CEO): A. việc chờ chị quyết · B. sức khỏe từng phòng ban (chỉ nhìn, bấm vào để xem chi tiết)
   Số kế toán, kho, bán hàng lấy thẳng từ máy chủ (/api/work/overview); Content, Digital lấy từ dữ liệu Task.
   ===================================================================== */
/* Tài khoản thử (Hoa 1 = lead Content thử, Test Chúc): không tính vào số Toàn cảnh */
const CV_TEST=["u_8ngyde8","u_x4ozsoe"];
/* Bài chờ đăng của kênh đang giao cho tài khoản thử: hiện là việc của chị (chị đang lead thay) */
const cvTestToChi=x=>CV_TEST.includes(x.nguoi)?Object.assign({},x,{nguoi:"u_chi"}):x;
const CVO={data:null,at:0,busy:false,err:"",ppl:false};
/* Người phụ trách từng phòng (chị chốt 20/10); sửa ở đây khi đổi người */
const CV_PHUTRACH={content:["u_chi"],digital:["u_chi"],ketoan:["u_noijyi4","u_t42e38h"],kho:["u_qc4yd2f"],sale:["u_2twwuby"],sx:["u_t42e38h","u_chi"],hcns:["u_t42e38h"]};
async function cvoLoad(force){
  if(CVO.busy||typeof ME==="undefined"||!ME)return;
  if(!force&&CVO.at&&Date.now()-CVO.at<60000)return;
  CVO.busy=true;
  try{CVO.data=await svApi("/api/work/overview");CVO.err="";CVO.at=Date.now()}catch(e){CVO.err=e.message||"Chưa tải được số liệu kế toán, kho, bán hàng"}
  CVO.busy=false;
  if((PAGE==="cv_tc"||(PAGE==="cv_v"&&CVV.view==="tq"))&&ME.role==="admin")renderMain();
}
function pCvTcCeo(m){
  if(CVO.ppl)return pCvTcPpl(m);
  if(!CVO.at||typeof _rLast==="undefined"||_rLast!==PAGE)cvoLoad(true);
  const d=D(),td=d.settings.today,O=CVO.data,its=(O&&O.items)||[];
  const I=cvItems().filter(x=>!CV_TEST.includes(x.nguoi)).map(cvTestToChi),open=I.filter(x=>x.st!=="done"),late=open.filter(x=>x.late);
  const doneN=I.length-open.length,doingN=open.filter(x=>x.st==="doing"||x.st==="nhan").length,rvN=open.filter(x=>x.st==="review").length,todoN=open.length-doingN-rvN-late.filter(x=>x.st!=="doing"&&x.st!=="nhan"&&x.st!=="review").length;
  const lateBy={};late.forEach(x=>{const k=x.nguoi||"";const o=lateBy[k]=lateBy[k]||{id:k,n:0,max:0};o.n++;o.max=Math.max(o.max,x.lateD||0)});
  const ppl=Object.values(lateBy).filter(p=>p.id).sort((x,y)=>y.n-x.n||y.max-x.max);
  const due=I.filter(x=>x.han&&x.han<=td),okN=due.filter(x=>x.st==="done"||!x.late).length;
  const pct=I.length?Math.round(doneN/I.length*100):0;
  const tile=(k,l,v,sub,tone)=>`<button type="button" class="tctile${tone&&v?" "+tone:""}" data-kp="${k}"><span>${l}</span><b>${v}</b>${sub?`<small>${sub}</small>`:""}</button>`;
  const T={};I.forEach(x=>{const k=x.team||"chung",t=T[k]=T[k]||{k,n:0,done:0,doing:0,rv:0,late:0,by:{}};t.n++;if(x.st==="done")t.done++;else{if(x.st==="doing"||x.st==="nhan")t.doing++;if(x.st==="review")t.rv++;if(x.late){t.late++;t.by[x.nguoi||""]=(t.by[x.nguoi||""]||0)+1}}});
  const OT=["ketoan","kho","sx","hcns","sale"],teams=Object.values(T).filter(t=>!OT.includes(t.k)).sort((x,y)=>y.late-x.late||y.n-x.n);
  const bar=t=>{const w=v=>t.n?(v/t.n*100).toFixed(1):0,todo=Math.max(0,t.n-t.done-t.doing-t.rv-t.late);return `<div class="tcstack" title="Xong ${t.done} · Đang làm ${t.doing} · Chờ duyệt ${t.rv} · Trễ ${t.late}"><i style="width:${w(t.done)}%;background:#639922"></i><i style="width:${w(t.doing)}%;background:#378ADD"></i><i style="width:${w(t.rv)}%;background:#EF9F27"></i><i style="width:${w(t.late)}%;background:#E24B4A"></i><i style="width:${w(todo)}%;background:#d9dde8"></i></div>`};
  const topBy=t=>{const e=Object.entries(t.by).sort((x,y)=>y[1]-x[1])[0];return e?(userName(e[0])||"Chưa giao")+" ("+e[1]+")":"—"};
  const deptRows=teams.map(t=>`<tr class="clk" data-dt="${esc(t.k)}"><td><b>${esc(cvTeamName(t.k))}</b><small>${esc(((CV_PHUTRACH[t.k]||[]).map(userName).filter(Boolean).join(", "))||"")}</small></td><td>${t.n}</td><td class="g">${t.done}</td><td class="b">${t.doing}</td><td class="a">${t.rv}</td><td>${t.late?`<span class="tcn r">${t.late}</span>`:'<span class="tcz">0</span>'}</td><td>${bar(t)}</td><td class="tcw">${esc(topBy(t))}</td></tr>`).join("");
  const maxAge=g=>its.filter(x=>x.group===g).reduce((z,x)=>Math.max(z,x.age_days),0),cnt=g=>its.filter(x=>x.group===g).reduce((z,x)=>z+x.count,0);
  const ck=k=>(its.find(x=>x.key===k)||{count:0}).count;
  const ageOf=s=>{s=String(s||"");let m=s.match(/(\d{4})-(\d{2})-(\d{2})/),dt=m?new Date(+m[1],+m[2]-1,+m[3]):null;if(!dt){m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)dt=new Date(+m[3],+m[2]-1,+m[1])}if(!dt)return 0;const n=new Date();return Math.max(0,Math.round((new Date(n.getFullYear(),n.getMonth(),n.getDate())-dt)/864e5))};
  const sxd=(typeof SX==="function"&&SX())?SX():null,sxCan=sxd?sxd.requests.filter(r=>r.st==="CAN_LAM"):[],sxDang=sxd?sxd.requests.filter(r=>r.st==="DANG_LAM"):[],sxKiem=sxd?sxd.batches.filter(b=>b.st==="CHO_KIEM"):[];
  const sxAge=Math.max(0,...sxCan.map(r=>ageOf(r.taoLuc)),...sxKiem.map(b=>ageOf(b.ngay)));
  const hrd=(d.hr&&d.hr.don)?d.hr.don.filter(x=>x.tt==="cho"):[],hrt=(d.hr&&d.hr.tu)?d.hr.tu.filter(x=>x.tt==="cho"):[],hrAge=Math.max(0,...hrd.map(x=>ageOf(x.gui)));
  const tkTxt=k=>{const t=T[k];return t&&t.n-t.done>0?`${t.n-t.done} việc giao tay${t.late?` (${t.late} trễ)`:""}`:""};
  const saleN=O?O.sale.count+O.cskh.count:0,saleAge=O?Math.max(O.sale.age_days,O.cskh.age_days):0;
  const pt=k=>(CV_PHUTRACH[k]||[]).map(userName).filter(Boolean).join(", ")||"—";
  const jn=a=>a.filter(Boolean).join(" · ")||"Không có việc tồn";
  const kt=its.filter(x=>x.group==="Kế toán");
  const others=[
    {ten:"Kế toán",pt:pt("ketoan"),chi:O?jn([ck("pay_confirm")?ck("pay_confirm")+" bill chờ xác nhận":"",ck("order_confirm")?ck("order_confirm")+" đơn chờ ghi nợ":"",ck("return_confirm")?ck("return_confirm")+" hàng trả chờ xác nhận":"",ck("pay_unallocated")?ck("pay_unallocated")+" khoản tiền chưa chia":"",tkTxt("ketoan")]):"Đang tải…",age:maxAge("Kế toán"),a:3,r:7,go:()=>{MOD="b2b";PAGE="b2b_cn";render()}},
    {ten:"Kho",pt:pt("kho"),chi:O?jn([ck("ship")?ck("ship")+" đơn chờ xuất kho":"",tkTxt("kho")]):"Đang tải…",age:maxAge("Kho"),a:1,r:3,go:()=>{MOD="sx";PAGE="kho_xuat_b2b";render()}},
    {ten:"Sản xuất",pt:pt("sx"),chi:sxd?jn([sxCan.length?sxCan.length+" lệnh cần làm":"",sxDang.length?sxDang.length+" đang làm":"",sxKiem.length?sxKiem.length+" lô chờ kiểm":"",tkTxt("sx")]):"Chưa nạp dữ liệu sản xuất",age:sxAge,a:2,r:5,go:()=>{MOD="sx";PAGE="sx_nc";render()}},
    {ten:"Hành chính nhân sự",pt:pt("hcns"),chi:d.hr?jn([hrd.length?hrd.length+" đơn nghỉ, OT chờ duyệt":"",hrt.length?hrt.length+" tạm ứng chờ duyệt":"",tkTxt("hcns")]):"Chưa nạp dữ liệu nhân sự",age:hrAge,a:2,r:5,go:()=>{MOD="hr";PAGE="hr_nghi";render()}},
    {ten:"Sale, chăm sóc khách",pt:pt("sale"),chi:O?jn([O.sale.count?O.sale.count+" đơn chưa gửi duyệt hoặc bị từ chối":"",O.cskh.count?O.cskh.count+" việc chăm sóc đến hạn":"",tkTxt("sale")]):"Đang tải…",age:saleAge,a:2,r:5,go:()=>{MOD="b2b";PAGE="b2b_don";render()}}
  ];
  const stOf=r=>{const none=r.chi==="Không có việc tồn"||/^(Đang tải|Chưa nạp)/.test(r.chi);if(none||r.age<r.a)return ["Ổn","success"];return r.age>=r.r?["Cần để ý","danger"]:["Chậm","warning"]};
  const otherRows=others.map((r,i)=>{const s=stOf(r);return `<tr class="clk" data-od="${i}"><td><b>${esc(r.ten)}</b></td><td>${esc(r.pt)}</td><td>${esc(r.chi)}</td><td>${r.age>0?`<span class="${r.age>=r.r?"t-red":""}">${r.age} ngày</span>`:"—"}</td><td><span class="tcst ${s[1]}">${s[0]}</span></td></tr>`}).join("");
  const worst=late.slice().sort((x,y)=>(y.lateD||0)-(x.lateD||0)).slice(0,6);
  const pplRows=ppl.slice(0,8).map(p=>`<div class="tcp2" data-pp="${esc(p.id)}"><span class="tcpn">${avatar(p.id)}<b>${esc(userName(p.id))}</b></span><span class="tcpb"><i style="width:${Math.max(8,Math.round(p.n/ppl[0].n*100))}%"></i></span><span class="tcpv">${p.n} trễ · lâu nhất ${p.max} ngày</span><button type="button" class="btn sm" data-nudge="${esc(p.id)}">Nhắc</button></div>`).join("");
  const worstRows=worst.map(x=>`<div class="tcr" data-w="${esc(x.id)}" data-ws="${x.src}"><span class="t-red">Trễ ${x.lateD} ngày</span> · ${esc(cvShort(x.ten,48))} · ${esc((userName(x.nguoi)||"Chưa giao").split(" ").slice(-1)[0])}</div>`).join("");
  const mineN=(typeof wkCount==="function"?wkCount():0);
  m.innerHTML=`<div class="cvbar"><button class="btn sm pri" type="button" disabled>Theo phòng ban</button><button class="btn sm" type="button" id="cvo-ppl">Theo người</button><button class="btn sm" type="button" id="cvo-re">Tải lại</button>${newTaskBtn()}</div>
  ${CVO.err?`<div class="note red">${esc(CVO.err)}</div>`:""}
  <div class="tctiles" style="grid-template-columns:repeat(6,minmax(0,1fr))">${tile("all","Tổng việc",I.length,"tháng ${MONTH.mon}".replace("${MONTH.mon}",MONTH.mon))}${tile("done","Hoàn thành",doneN,pct+"% tổng","grn")}${tile("doing","Đang làm",doingN,"")}${tile("review","Chờ duyệt",rvN,"","amb")}${tile("late","Quá hạn",late.length,ppl.length+" người đang trễ","red")}${tile("","Đúng hạn",due.length?Math.round(okN/due.length*100)+"%":"—",`${okN}/${due.length} việc tới hạn`,"grn")}</div>
  ${mineN?`<div class="tcmine"><b>${mineN} việc đang chờ chị</b> (đến lượt chị làm, cần chị duyệt, cần giao hoặc đốc) <button class="lnk" id="cvo-mine">Mở Việc của tôi →</button></div>`:""}
  <div class="tcmain"><section class="card tcbox"><h3>Theo phòng ban <small class="hint">xanh: xong · xanh dương: đang làm · vàng: chờ duyệt · đỏ: trễ · xám: chưa làm</small></h3><table class="tcp tcdept2"><thead><tr><th>Phòng</th><th>Tổng</th><th>Xong</th><th>Làm</th><th>Duyệt</th><th>Trễ</th><th>Tiến độ</th><th>Trễ nhiều nhất</th></tr></thead><tbody>${deptRows||'<tr><td colspan="8" class="empty">Chưa có dữ liệu.</td></tr>'}</tbody></table></section>
  <section class="card tcbox"><h3>Ai đang trễ <small class="hint">${ppl.length} người</small></h3>${pplRows||'<p class="empty">Không ai đang trễ.</p>'}</section></div>
  <div class="tcmain"><section class="card tcbox"><h3>Các phòng khác <small class="hint">bấm vào dòng để mở chi tiết</small></h3><table class="tcp tcdept"><thead><tr><th>Phòng</th><th>Phụ trách</th><th>Chỉ số chính</th><th>Tồn lâu nhất</th><th>Tình trạng</th></tr></thead><tbody>${otherRows}</tbody></table></section>
  <section class="card tcbox"><h3>Trễ lâu nhất <small class="hint">bấm để mở xử lý</small></h3>${worstRows||'<p class="empty">Không có việc trễ.</p>'}</section></div>`;
  bindNew();
  $("#cvo-ppl").onclick=()=>{CVO.ppl=true;renderMain()};
  $("#cvo-re").onclick=()=>{cvoLoad(true);toast("Đang tải lại…")};
  const mb=$("#cvo-mine");if(mb)mb.onclick=()=>{CVV.view="list";CVV.scope="mine";cvWhoSet("mine");renderMain()};
  const goList=(who,st)=>{CVV.view="list";CVV.scope="team";cvWhoSet(who);CVF.st=st||"";CVF.tg="all";renderMain()};
  m.querySelectorAll("[data-kp]").forEach(b=>b.onclick=()=>{const k=b.dataset.kp;goList("all",k==="all"?"":k)});
  m.querySelectorAll("[data-dt]").forEach(r=>r.onclick=()=>goList("t:"+r.dataset.dt,""));
  m.querySelectorAll("[data-pp]").forEach(r=>r.onclick=e=>{if(e.target.closest("button"))return;goList("p:"+r.dataset.pp,"late")});
  m.querySelectorAll("[data-nudge]").forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.nudge,p=lateBy[id];if(!p)return;DB.mutate(ME.name,"nhắc việc trễ "+userName(id),dt=>{if(typeof notifyU==="function")notifyU(dt,[id],`${ME.name} nhắc: bạn đang có ${p.n} việc trễ hạn, lâu nhất ${p.max} ngày`,"page:cv_v")});toast("Đã nhắc "+userName(id))});
  m.querySelectorAll("[data-w]").forEach(r=>r.onclick=()=>{const id=r.dataset.w,s=r.dataset.ws;if(s==="card")openCard(id);else if(s==="order"){PAGE="order";MOD="";render()}else openTask(id)});
  m.querySelectorAll("[data-od]").forEach(r=>r.onclick=()=>others[+r.dataset.od].go());
  m.querySelectorAll("[data-bl]").forEach(b=>b.onclick=()=>{const k=b.dataset.bl;if(k==="ketoan"){MOD="b2b";PAGE="b2b_cn"}else if(k==="kho"){MOD="sx";PAGE="kho_xuat_b2b"}else{MOD="b2b";PAGE="b2b_don"}render()});
}
/* "Theo người": bản Toàn cảnh cũ (ai đang ôm bao nhiêu việc) */
function pCvTcPpl(m){
  pCvTcOld(m);
  const bar=m.querySelector(".cvbar");if(bar){const b=document.createElement("button");b.className="btn sm";b.type="button";b.textContent="← Theo phòng ban";b.onclick=()=>{CVO.ppl=false;renderMain()};bar.insertBefore(b,bar.firstChild)}
}

/* Việc chính của chị (CEO) cho trang "Việc của tôi": duyệt video, duyệt việc giao, xin gia hạn, việc giao cho chị */
function cvCeoMine(){
  const d=D(),ok=x=>!CV_TEST.includes(x.nguoi),T=(d.tasks||[]).filter(ok),L=[];
  const add=(key,title,detail,count,go,extra)=>{if(count>0)L.push(Object.assign({key,group:"Marketing và Task",title,detail,count,oldest:null,age_days:0,page:"",go},extra||{}))};
  add("c_vid","Video, kịch bản chờ chị duyệt","Duyệt xong thì video đi tiếp",d.cards.filter(x=>ok(x)&&["dkb","dvd","dceo"].includes(x.step)).length,"cv");
  add("c_rv","Việc giao chờ chị duyệt","Người làm đã bấm Chờ duyệt",T.filter(t=>t.st==="review"&&tkMgr(t)).length,"cv_nv",{st:"review",who:"all"});
  add("c_gh","Người xin gia hạn","Cần chị gia hạn hoặc duyệt xong",T.filter(t=>(t.treReq||{}).st==="cho"&&t.st!=="done"&&tkMgr(t)).length,"cv_nv",{st:"",who:"all"});
  add("c_mine","Việc giao cho chị chưa xong","Việc chị là người làm",T.filter(t=>t.st!=="done"&&(t.nguoi===ME.id||(t.phoi||[]).includes(ME.id))).length,"cv_nv",{st:"",who:"mine"});
  return L;
}

/* =====================================================================
   CÔNG ĐOẠN: một việc có nhiều người, mỗi người một phần (làm lần lượt hoặc song song)
   Công đoạn: {id, ten, nguoi, han, loai:"lam"|"duyet", st:"cho"|"lam"|"xong", at, by}
   Việc có công đoạn thì tự suy ra: người làm hiện tại, hạn, trạng thái (tkSync), nên mọi màn hình cũ vẫn chạy.
   ===================================================================== */
function tkActive(x){const c=(x&&x.cd)||[],rest=c.filter(s=>s.st!=="xong");return x.tuanTu===false?rest:rest.slice(0,1)}
function tkSync(x){
  const c=x.cd||[];if(!c.length)return;
  const rest=c.filter(s=>s.st!=="xong"),act=tkActive(x),a=act[0]||c[c.length-1];
  x.st=!rest.length?"done":act.some(s=>s.loai==="duyet")?"review":(c.some(s=>s.st==="xong"||s.st==="lam")?"doing":"todo");
  x.nguoi=a.nguoi;x.han=a.han||x.han;
  x.phoi=[...new Set(c.map(s=>s.nguoi).filter(p=>p&&p!==x.nguoi))];
  x.stAt=new Date().toLocaleString("vi-VN");x.stBy=ME?ME.name:"";
}
function tkCdAct(id,sid,act,note){
  const t0=D().tasks.find(x=>x.id===id);if(!t0)return;
  DB.mutate(ME.name,`công đoạn "${t0.ten}": ${act}`,dt=>{
    const x=dt.tasks.find(y=>y.id===id);if(!x||!x.cd)return;const s=x.cd.find(z=>z.id===sid);if(!s)return;
    const before=tkActive(x).map(z=>z.id),nowS=new Date().toLocaleString("vi-VN"),ref="task:"+x.id,N=(ids,txt)=>{if(typeof notifyU==="function")notifyU(dt,ids,txt,ref)};
    tkLog(x,`${act==="xong"?"Xong":act==="lam"?"Bắt đầu":"Trả lại"} công đoạn "${s.ten}"${note?": "+note:""}`);
    if(act==="lam"){s.st="lam";s.at=nowS;s.by=ME.name}
    else if(act==="xong"){s.st="xong";s.at=nowS;s.by=ME.name}
    else if(act==="tra"){const i=x.cd.indexOf(s);let j=i-1;while(j>=0&&x.cd[j].loai==="duyet")j--;
      if(j>=0){x.cd.slice(j).forEach(z=>{z.st="cho"});x.cd[j].st="lam";x.tlNote=note;N([x.cd[j].nguoi],`${ME.name} trả lại công đoạn "${x.cd[j].ten}" của việc "${x.ten}": ${note}`)}else{s.st="cho"}}
    tkSync(x);
    const after=tkActive(x);
    after.filter(z=>!before.includes(z.id)&&z.id!==sid).forEach(z=>N([z.nguoi],z.loai==="duyet"?`Việc "${x.ten}" chờ bạn duyệt`:`Đến lượt bạn: "${x.ten}" · ${z.ten}${z.han?" · hạn "+dd(z.han):""}`));
    if(x.st==="done")N([x.tao,...x.cd.map(z=>z.nguoi)],`Việc "${x.ten}" đã xong hết các công đoạn`);
  });
}
/* Việc của tôi (mọi người): công đoạn đến lượt tôi làm, việc cần tôi duyệt, công đoạn đang chờ người trước */
function cvMyItems(){
  const d=D(),td=d.settings.today,ME_=ME.id,ok=x=>!CV_TEST.includes(x.nguoi),L=[];
  const G1="Đến lượt tôi làm",G2="Cần tôi duyệt",G3="Đang chờ người trước";
  const late=h=>h&&h<td?td-h:0;
  const add=(o)=>L.push(Object.assign({oldest:null,age_days:0,page:"",count:1},o));
  (d.tasks||[]).filter(t=>t.st!=="done").forEach(t=>{
    const who=userName(t.tao)||"—";
    if(t.cd&&t.cd.length){
      const act=tkActive(t);
      t.cd.filter(s=>s.nguoi===ME_&&s.st!=="xong").forEach(s=>{
        if(act.includes(s)){
          if(s.loai==="duyet")add({key:"d_"+s.id,group:G2,title:t.ten,chip:"Duyệt",detail:`Chờ bạn duyệt · giao bởi ${who}${s.han?" · hạn "+dd(s.han):""}`,age_days:late(s.han),taskId:t.id});
          else add({key:"w_"+s.id,group:G1,title:`${t.ten} · ${s.ten}`,detail:`Hạn ${s.han?dd(s.han):"—"} · giao bởi ${who}${s.st==="lam"?" · đang làm":""}`,age_days:late(s.han),han:s.han||0,chip:`${t.cd.filter(z=>z.st==="xong").length}/${t.cd.length} công đoạn`,taskId:t.id,cdId:s.id,act:"xong"});
        }else{const prev=act[0];add({key:"c_"+s.id,group:G3,title:`${t.ten} · ${s.ten}`,detail:prev?`Chờ ${userName(prev.nguoi)||"—"} xong "${prev.ten}"`:"Chờ công đoạn trước",taskId:t.id})}
      });
    }else{
      if(t.st==="review"&&tkMgr(t))add({key:"r_"+t.id,group:G2,title:t.ten,detail:`${userName(t.nguoi)||"—"} đã gửi duyệt`,age_days:late(t.han),taskId:t.id});
      else if((t.nguoi===ME_||(t.phoi||[]).includes(ME_))&&t.st!=="review")add({key:"t_"+t.id,group:G1,title:t.ten,detail:`Hạn ${t.han?dd(t.han):"—"} · giao bởi ${who}`,age_days:late(t.han),han:t.han||0,taskId:t.id});
    }
    if((t.treReq||{}).st==="cho"&&tkMgr(t))add({key:"g_"+t.id,group:G2,title:t.ten,detail:`${(t.treReq||{}).by||"Người làm"} xin gia hạn${(t.treReq||{}).hanMoi?" đến "+dd(t.treReq.hanMoi):""}`,taskId:t.id});
  });
  if(ME.role==="admin"||ME.role==="lead"){
    const CL=typeof cvList==="function"?cvList(ME).L:[],n=k=>{const g=CL.find(y=>y.key===k);return g?g.items.filter(i=>!CV_TEST.includes(i.nguoi)).length:0},G4="Tôi cần giao, đốc";
    if(n("cg"))add({key:"k_cg",group:G4,title:`${n("cg")} thẻ video 7 ngày tới chưa giao người`,detail:"Giao người viết kịch bản, quay, edit để kịp đăng",count:n("cg"),mod:"mkt",go:"dieuphoi"});
    const late=cvGroup(cvItems().filter(x=>!CV_TEST.includes(x.nguoi))).filter(x=>x.late&&x.st!=="done"&&x.nguoi!==ME_);
    if(late.length)add({key:"k_tre",group:G4,title:`${late.length} việc của team đang trễ hạn`,detail:"Nhắc hoặc dời hạn: "+[...new Set(late.map(x=>userName(x.nguoi)).filter(Boolean))].slice(0,4).join(", "),count:late.length,age_days:late.reduce((z,x)=>Math.max(z,x.lateD||0),0),go:"cv_nv",st:"late",who:"all"});
    if(n("id"))add({key:"k_id",group:G4,title:`${n("id")} bài đã đăng nhưng thiếu link / ID`,detail:"Nhờ người đăng bổ sung",count:n("id"),go:"cv"});
  }
  const vid=d.cards.filter(c=>ok(c)&&["dkb","dvd","dceo"].includes(c.step)&&(ME.role==="admin"||can(ME,"viec.duyet"))&&(c.step!=="dceo"||ME.role==="admin")).length;
  if(vid)add({key:"v_vid",group:G2,title:"Video, kịch bản chờ duyệt",detail:"Duyệt xong thì video đi tiếp",count:vid,go:"cv"});
  return L;
}

/* =====================================================================
   TRANG "VIỆC" DUY NHẤT (học cách Asana, Base Wework, ClickUp): một nơi, chọn phạm vi và kiểu xem
   Phạm vi: Của tôi · Tôi giao · Cả team.  Kiểu xem: Danh sách · Bảng · Lịch · Tổng quan.
   ===================================================================== */
const CVV={scope:"",view:""};
const cvNvRaw=m=>{try{pCvNv2(m)}catch(e){console.error("Task mới lỗi, dùng bản cũ",e);pCvNv(m)}};
function cvvDefault(){const top=ME.role==="admin"||cvSummaryOnly();CVV.view=top?"tq":"list";CVV.scope=top?"team":"mine"}
function pCvV(m){
  if(!CVV.view)cvvDefault();
  PAGE="cv_v";
  const td=D().settings.today,tasks=D().tasks||[];
  const nMine=WK&&WK.items?wkCount():"",nGiao=tasks.filter(t=>t.tao===ME.id&&t.nguoi!==ME.id&&t.st!=="done"&&!CV_TEST.includes(t.nguoi)).length;
  const nTeam=cvGroup(cvItems().filter(x=>!CV_TEST.includes(x.nguoi))).filter(x=>x.st!=="done").length;
  const chip=(k,l,n)=>`<button type="button" class="cvchip${CVV.scope===k?" on":""}" data-vs="${k}">${l}${n!==""?` <b>${n}</b>`:""}</button>`;
  const view=(k,l)=>`<button type="button" class="cvview${CVV.view===k?" on":""}" data-vv="${k}">${l}</button>`;
  const tq=CVV.view==="tq",listMine=CVV.view==="list"&&CVV.scope==="mine";
  const mgr=cvMgrView();
  m.innerHTML=`<div class="cvvbar">${tq?"":chip("mine","Của tôi",nMine)+chip("giao","Tôi giao",nGiao)+chip("team","Cả team",nTeam)}<span class="sp"></span>${view("list","Danh sách")}${view("board","Bảng")}${view("cal","Lịch")}${view("gantt","Gantt")}${mgr?view("tq","Tổng quan"):""}${CVV.view==="board"?`<button type="button" class="cvview" data-vgo="congviec">Theo bước video</button>`:""}${CVV.view==="cal"?`<button type="button" class="cvview" data-vgo="giaoviec">Lịch quay</button>`:""}${listMine?`<button class="btn sm" id="wk-re" type="button">Tải lại</button>${newTaskBtn()}`:""}</div><div id="cvv-body"></div>`;
  const body=m.querySelector("#cvv-body");
  CVF.tao=(CVV.scope==="giao"&&!tq)?ME.id:"";
  try{
    if(tq)pCvTc(body);
    else if(CVV.view==="board")pCvKb(body);
    else if(CVV.view==="cal")pCvLich(body);
    else if(CVV.view==="gantt")pCvGantt(body);
    else if(listMine)wkEmbed(body);
    else cvNvRaw(body);
  }catch(e){console.error("Trang Việc lỗi",e);body.innerHTML=`<div class="note red"><b>Trang chưa hiện được.</b> Chị chụp dòng này gửi em: ${esc(String(e&&e.message||e))}</div>`}
  m.querySelectorAll("[data-vs]").forEach(b=>b.onclick=()=>{CVV.scope=b.dataset.vs;cvWhoSet(CVV.scope==="mine"?"mine":"all");CVF.st="";renderMain()});
  m.querySelectorAll("[data-vv]").forEach(b=>b.onclick=()=>{CVV.view=b.dataset.vv;if(CVV.view==="tq")CVF.tao="";renderMain()});
  m.querySelectorAll("[data-vgo]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.vgo;render()});
  const re=m.querySelector("#wk-re");if(re)re.onclick=()=>{wkLoad(true);toast("Đang tải lại…")};
  if(listMine)bindNew();
}
PAGES.cv_v=m=>pCvV(m);
/* các đường dẫn cũ (cv_nv, cv_kb, cv_lich, cv_tc) đều đưa về trang Việc đúng kiểu xem */
const cvvLegacy=view=>m=>{CVV.view=view;CVV.scope=CVF.tao?"giao":(CVF.who==="mine"?"mine":"team");PAGE="cv_v";pCvV(m)};
PAGES.cv_nv=cvvLegacy("list");PAGES.cv_kb=cvvLegacy("board");PAGES.cv_lich=cvvLegacy("cal");PAGES.cv_tc=cvvLegacy("tq");
