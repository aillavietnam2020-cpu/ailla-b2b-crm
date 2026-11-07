/* =====================================================================
   CÔNG VIỆC & DỰ ÁN — một chỗ cho mọi việc (thẻ video, order Digital, việc chung)
   Phạm vi xem: Của tôi · Cả team · Tất cả (theo vai trò). Ưu tiên Content & Digital.
   ===================================================================== */
const TEAMS={content:"Content",digital:"Digital – Ads",koc:"KOC",ketoan:"Kế toán",kho:"Kho",sx:"Sản xuất",hcns:"Hành chính nhân sự",sale:"Sale",chung:"Chung"};
const CV_ST=[["cg","Chưa giao","gry"],["todo","Cần làm","gry"],["nhan","Đã nhận việc","blu"],["doing","Đang làm","blu"],["pause","Tạm dừng","gry"],["review","Chờ duyệt","amb"],["done","Hoàn thành","grn"]];
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
    {id:"DA-06",ten:"Ads Facebook T10 — đẩy 4 sản phẩm",team:"digital",owner:"u_chi",han:31,moTa:"Tinh dầu, Tẩy lồng AiBio, Bột tẩy vạn năng, Tẩy đa năng XClean. Digital chưa có lead — CEO trực tiếp quản",loc:{orders:true}},
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
function cardProject(c){const d=D();for(const p of d.projects||[]){const L=p.loc||{};if(L.orders||L.none)continue;if(L.sku&&!L.sku.includes(c.sku))continue;if(L.tuyen&&!L.tuyen.includes(c.tuyen))continue;if(L.kenh&&!L.kenh.includes(c.kenh))continue;if(L.tuyenNot&&L.tuyenNot.includes(c.tuyen))continue;if(L.toiNgay&&c.day>L.toiNgay)continue;if(L.tuNgay&&c.day<L.tuNgay)continue;return p.id}return c.order?"DA-06":""}
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
  (d.tasks||[]).forEach(t=>{const late=t.st!=="done"&&!!t.han&&t.han<today,nb=t.loai==="Nhân bản video win"&&typeof cvWinInfo==="function"?cvWinInfo(t):null;out.push({id:t.id,src:"task",gio:t.gio||"",ten:nb?nb.ten:t.ten,mo:nb?nb.mo:(t.moTa||""),sub:nb?nb.mo:"",team:t.team,da:t.da,nguoi:t.nguoi,phoi:t.phoi||[],han:t.han,uu:t.uu,st:t.st,late,lateD:late?today-t.han:0,loai:t.loai||"Việc",ck:t.checklist||[],tao:t.tao||"",cd:t.cd||null,tl:!!t.tlNote})});
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
/* mã phòng ban (CM, ADS, KT…) gộp về đúng team (content, digital, ketoan…) để không hiện "Team CM" cạnh "Team Content" (khonggian.js KPB_TEAM) */
const cvTeamNorm=k=>(typeof KPB_TEAM!=="undefined"&&KPB_TEAM[k])||k;
const cvTeamName=k=>TEAMS[cvTeamNorm(k)]||(k==="mkt"?"Marketing":k);
function cvWhoOpts(){const d=D(),t=teamOf(ME),o=[["all","Tất cả"],["mine","Việc của tôi"]];
  if(cvMgrView()){const ks=[];d.users.forEach(u=>{const k=cvTeamNorm(teamOf(u));if(u.active&&u.role!=="admin"&&k&&k!=="all"&&!ks.includes(k)&&(ME.role==="admin"||can(ME,"viec.giao")||cvTeamSee(t,k)))ks.push(k)});ks.forEach(k=>o.push(["t:"+k,"Team "+cvTeamName(k)]))}
  /* từng nhân sự (CEO thấy mọi người, Lead / trưởng phòng thấy người team mình) */
  if(cvMgrView())d.users.filter(u=>u.active&&u.name&&u.role!=="admin"&&u.id!==ME.id&&!CV_TEST.includes(u.id)&&(ME.role==="admin"||can(ME,"viec.giao")||cvTeamSee(t,teamOf(u)))).sort((a,b)=>String(cvTeamName(teamOf(a))).localeCompare(String(cvTeamName(teamOf(b))))||a.name.localeCompare(b.name)).forEach(u=>o.push(["p:"+u.id,"👤 "+u.name+" · "+(cvTeamName(teamOf(u))||"")]));
  if(CVF.who&&CVF.who.indexOf("p:")===0&&CVF.nguoi&&!o.some(x=>x[0]===CVF.who))o.push([CVF.who,userName(CVF.nguoi)]);return o}
function cvWhoSet(v){CVF.who=v;CVF.scope=v==="mine"?"mine":(ME.role==="admin"?"all":"team");CVF.nguoi=v.indexOf("p:")===0?v.slice(2):"";CVF.wt=v.indexOf("t:")===0?v.slice(2):""}
function cvWho(){if(!CVF.who)cvWhoSet(ME.role==="admin"||ME.role==="lead"||ME.role==="truongphong"||can(ME,"viec.giao")?"all":"mine");return CVF.who}
const cvWhoSelect=()=>`<select id="cv-who" aria-label="Xem việc của">${opt(cvWhoOpts(),cvWho())}</select>`;
function cvFilter(L){
  const d=D(),me=ME.id,t=teamOf(ME),today=d.settings.today,W=WEEKS.find(w=>today>=w.tu&&today<=w.den)||WEEKS[0],LW=WEEKS.find(w=>w.w===W.w-1)||W;
  cvWho();
  return L.filter(x=>{
    if(CVF.scope==="mine"&&x.nguoi!==me&&!x.phoi.includes(me)&&!(x.src==="task"&&x.st==="review"&&tkMyTurn(d.tasks.find(t=>t.id===x.id)||{})))return false;
    if(ME.role!=="admin"&&!cvSummaryOnly()&&t!=="all"&&x.nguoi!==me&&!x.phoi.includes(me)&&!cvTeamSee(t,x.team)&&!(t==="content"&&x.src==="order"))return false;
    if(CVF.wt){const ux=d.users.find(y=>y.id===x.nguoi);if(!ux||!(cvTeamSee(CVF.wt,teamOf(ux))||cvTeamNorm(teamOf(ux))===CVF.wt))return false}
    if(CVF.tao&&x.tao!==CVF.tao)return false;
    if(CVF.team&&x.team!==CVF.team)return false;if(CVF.nguoi&&x.nguoi!==CVF.nguoi&&!x.phoi.includes(CVF.nguoi))return false;if(CVF.da&&x.da!==CVF.da)return false;if(CVF.st&&(CVF.st==="late"?!x.late:CVF.st==="todo"?!["cg","todo","nhan","pause"].includes(x.st):x.st!==CVF.st))return false;if(CVF.uu&&x.uu!==CVF.uu)return false;
    if(CVF.q&&!(x.ten+" "+x.mo+" "+x.id+" "+userName(x.nguoi)).toLowerCase().includes(CVF.q.toLowerCase()))return false;
    if(CVF.tg==="all"&&typeof PERIOD!=="undefined"&&PERIOD&&PERIOD.from&&x.han&&typeof tkDay==="function"){const a=tkDay(PERIOD.from),b=tkDay(PERIOD.to);if((x.han<a||x.han>b)&&!(x.st!=="done"&&x.han<a&&x.han<today))return false}
    if(CVF.tg==="today"&&x.han!==today)return false;if(CVF.tg==="week"&&(x.han<W.tu||x.han>W.den))return false;if(CVF.tg==="lweek"&&(x.han<LW.tu||x.han>LW.den))return false;
    return true});
}
/* một hàng lọc gọn ở góc phải: tìm · người · thời gian · trạng thái · dự án · nút Giao việc */
function cvFilterBar(opts={}){const d=D();const names=cvMgrView()&&!cvSummaryOnly()?d.users.filter(u=>u.active&&u.role!=="admin").map(u=>`<option value="${esc(u.name)}">`).join(""):"";const more=CVF.da||(CVF.who&&!["all","mine"].includes(CVF.who));return `<div class="cvbar"><input id="cv-q" placeholder="${names?"Tìm việc hoặc gõ tên người…":"Tìm việc…"}" value="${esc(CVF.q)}"${names?` list="cv-names" autocomplete="off"`:""}>${names?`<datalist id="cv-names">${names}</datalist>`:""}${opts.noSt?"":`<select id="cv-st" aria-label="Trạng thái">${opt([["","Mọi trạng thái"],["todo","Cần làm"],["doing","Đang làm"],["review","Chờ duyệt"],["done","Hoàn thành"],["late","Trễ hạn"]],CVF.st)}</select>`}${cvWhoSelect()}<select id="cv-da" aria-label="Dự án">${opt([["","Mọi dự án"]].concat((d.projects||[]).map(p=>[p.id,p.ten])),CVF.da)}</select></div>`}/* chị Hoa 04/11: bỏ nút "Lọc thêm", các ô lọc nằm thẳng một hàng */
function bindCvFilter(m){
  m.querySelectorAll("[data-tg]").forEach(b=>b.onclick=()=>{CVF.tg=b.dataset.tg;renderMain()});const wh=$("#cv-who");if(wh)wh.onchange=()=>{cvWhoSet(wh.value);if(typeof CVV!=="undefined")CVV.scope=wh.value==="mine"?"mine":"team";renderMain()};
  [["cv-q","q"],["cv-tg","tg"],["cv-team","team"],["cv-da","da"],["cv-st","st"],["cv-uu","uu"]].forEach(([id,k])=>{const e=$("#"+id);if(e)e.onchange=()=>{CVF[k]=e.value;renderMain()}});
  bindNew();
}
const prjN=id=>((D().projects||[]).find(p=>p.id===id)||{ten:""}).ten;
const AV_C=[["#e7f0ff","#1c4fb8"],["#e3f5ea","#1f7a3d"],["#fff1dc","#9a5200"],["#f1e8ff","#6b2fb3"],["#dff5f5","#0b6e6e"],["#ffe9ee","#b4234a"],["#eef0f4","#3d4656"]];
const avC=id=>{let h=0;for(const ch of String(id||""))h=(h*31+ch.charCodeAt(0))>>>0;return AV_C[h%AV_C.length]};
const avatar=id=>{const n=userName(id);if(!n)return "";const [bg,fg]=avC(id);if(typeof avsLoad==="function")avsLoad();return `<i class="av" style="${typeof avsStyle==="function"?avsStyle(id,bg,fg):`background:${bg};color:${fg}`}">${esc(n.trim().split(" ").pop()[0])}</i>`};
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
const tkMgrIds=t=>{const ids=new Set();if(t.tao&&t.tao!==t.nguoi)ids.add(t.tao);if(t.duyet&&t.duyet!==t.nguoi)ids.add(t.duyet);D().users.filter(u=>u.active&&u.id!==t.nguoi&&(u.role==="admin"||(u.role==="lead"&&(u.perms||[]).includes("viec.giao")&&(!t.team||teamOf(u)===t.team))||(tkLead(u)&&tkSameTeam(u,D().users.find(z=>z.id===t.nguoi))))).forEach(u=>ids.add(u.id));return [...ids]};
/* Duyệt hai vòng (chị Hoa 02/11): nhân sự nộp → lead / trưởng phòng của người làm duyệt (vòng 1) → chị duyệt (vòng 2).
   Không có lead thì người giao / chị duyệt một vòng. Mỗi vòng góp ý, trả lại được; mọi trao đổi nằm trong việc (t.chat). */
const tkLeadOf=t=>{const U=D().users,doer=U.find(u=>u.id===t.nguoi);if(!doer)return null;const tao=U.find(u=>u.id===t.tao);if(tao&&tkLead(tao)&&tao.id!==doer.id)return tao;return U.find(u=>u.active&&u.id!==doer.id&&tkLead(u)&&tkSameTeam(u,doer))||null};
/* 03/11: việc nhỏ của team Content chỉ Lead duyệt; CEO duyệt video final và kế hoạch, không duyệt vòng 2 việc Content trừ khi người giao tích chọn */
const tkV2On=t=>t.team==="content"?t.v2ceo===true:t.v2!==false;
/* CEO tự giao thì CEO duyệt luôn, một vòng (chị Hoa 03/11) */
const tkCeoGiao=t=>!!t&&!!t.tao&&((D().users||[]).find(u=>u.id===t.tao)||{}).role==="admin"&&t.tao!==t.nguoi;
const tkV2=t=>!tkCeoGiao(t)&&tkV2On(t)&&!!tkLeadOf(t);
const tkAdmins=()=>D().users.filter(u=>u.active&&u.role==="admin").map(u=>u.id);
/* việc order hỗ trợ (orderlen.js): người order xác nhận kết quả */
const tkAppr=t=>{if(t.order&&t.tao)return [t.tao];if(t.tuThem&&t.duyet&&t.duyet!==t.nguoi)return [t.duyet];if(tkCeoGiao(t))return [t.tao];if(t.st==="review"&&t.vong===2)return tkAdmins();const L=tkLeadOf(t);return L?[L.id]:tkMgrIds(t)};
const tkMgr=t=>!!ME&&ME.id!==t.nguoi&&(ME.role==="admin"||(t.st==="review"&&t.vong===2?false:(t.tao===ME.id||tkMgrIds(t).includes(ME.id)||tkAppr(t).includes(ME.id))));
/* Quy tắc đóng việc: việc do người khác giao thì người làm chỉ bấm "Chờ duyệt", người giao (hoặc quản lý) duyệt mới Hoàn thành. Việc tự tạo cho mình thì tự đóng. */
/* CEO (và ai có quyền "viec.giao") giao cho mọi người; trưởng phòng / lead giao cho người trong team mình (chị Hoa chốt 02/11) */
const tkAll=()=>!!ME&&(ME.role==="admin"||can(ME,"viec.giao"));
const tkLead=u=>!!u&&["lead","truongphong"].includes(u.role);
const tkGiver=()=>tkAll()||tkLead(ME);
const tkSameTeam=(boss,u)=>!!boss&&!!u&&(boss.id===u.id||cvTeamSee(teamOf(boss),teamOf(u)));
const tkAssignable=users=>tkAll()?users:users.filter(u=>tkSameTeam(ME,u));
/* hạn lưu là số ngày tính từ đầu tháng đang chạy (vượt số ngày của tháng = tháng sau, âm = tháng trước); ô nhập là lịch */
const tkIso=n=>{const x=new Date(MONTH.year,MONTH.mon-1,n);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const tkDay=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||"");return m?Math.round((Date.UTC(+m[1],+m[2]-1,+m[3])-Date.UTC(MONTH.year,MONTH.mon-1,1))/864e5)+1:0};
const tkDate=(id,n,attrs)=>`<input type="date" id="${id}" value="${n?tkIso(n):""}" ${attrs||""}>`;
/* ---- ảnh / file đính kèm (máy chủ /api/hub/task-files, mỗi file ≤ 1,5 MB) ---- */
const TK_FMAX=1600000;
async function tkShrink(f){if(!f.type.startsWith("image/")||f.size<1400000||f.type==="image/gif")return f;try{const img=await createImageBitmap(f),k=Math.min(1,2000/Math.max(img.width,img.height)),cv=document.createElement("canvas");cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);const b=await new Promise(r=>cv.toBlob(r,"image/jpeg",.82));return b?new File([b],f.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}):f}catch(e){return f}}
async function tkUpload(list,taskId){const out=[];for(const f0 of [...(list||[])]){const f=await tkShrink(f0);if(f.size>TK_FMAX){toast(f0.name+" quá 1,5 MB, hãy dán link Drive");continue}
  try{const fd=new FormData();fd.set("task",taskId||"");fd.set("file",f,f.name);const r=await fetch("/api/hub/task-files",{method:"POST",body:fd,credentials:"same-origin"});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error((j.error&&j.error.message)||"Chưa tải lên được");
    out.push({id:j.data.id,name:f.name,size:f.size,type:f.type,by:ME.name,at:new Date().toLocaleString("vi-VN")})}catch(e){toast(f0.name+": "+(e.message||"chưa tải lên được"))}}return out}
const tkFileUrl=id=>"/api/hub/task-files/"+encodeURIComponent(id);
const tkFilesHtml=(L,k,del)=>(L||[]).length?`<div class="tkfl">${L.map(f=>`<span class="tkf">${/^image\//.test(f.type||"")?`<a href="${tkFileUrl(f.id)}" target="_blank" rel="noopener"><img src="${tkFileUrl(f.id)}" alt=""></a>`:""}<a href="${tkFileUrl(f.id)}" target="_blank" rel="noopener">${esc(f.name)}</a>${del?`<button type="button" class="lnk" data-tfx="${esc(f.id)}" data-tfk="${k}" aria-label="Xóa file">✕</button>`:""}</span>`).join("")}</div>`:"";
const tkLink=u=>/^https?:\/\//.test(u||"")?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.length>70?u.slice(0,70)+"…":u)}</a>`:esc(u||"");
/* kết quả đã nộp: ghi chú, link, file */
const tkSubHtml=t=>{const a=[];if(t.kqNote)a.push(`<div class="tksn">${esc(t.kqNote).replace(/\n/g,"<br>")}</div>`);if(t.kq)a.push(`<div>🔗 ${tkLink(t.kq)}</div>`);a.push(tkFilesHtml(t.kqFiles,"kqFiles",false));const s=a.filter(Boolean).join("");return s?`<div class="tksub">${s}${t.nopAt?`<small class="hint">Nộp lúc ${esc(t.nopAt)}${t.nopBy?" · "+esc(t.nopBy):""}</small>`:""}</div>`:""};
/* Khung đầu việc: người làm nộp kết quả ngay tại đây, người giao duyệt / trả lại ngay tại đây (chị Hoa 02/11) */
/* tiến độ một việc: theo công đoạn, rồi theo việc nhỏ, không có thì theo trạng thái */
function tkPct(x){if(x.st==="done")return 100;const c=x.cd||[],k=x.ck||[];if(c.length)return Math.round(c.reduce((a,s)=>a+tkCdFrac(s),0)/c.length*100);
  const base={cg:0,todo:0,nhan:10,doing:40,review:90}[x.st]||0;if(k.length)return Math.max(base==90?90:0,Math.min(95,Math.round(k.filter(z=>z.x).length/k.length*100)));return base}
const tkPctHtml=x=>{const p=tkPct(x),c=x.cd||[],k=x.ck||[],sub=c.length?`${c.filter(s=>s.st==="xong").length}/${c.length} công đoạn`:k.length?`${k.filter(z=>z.x).length}/${k.length} việc nhỏ`:"";
  return `<div class="tkpc"><div class="tkprog"><i style="width:${p}%;background:${x.late&&x.st!=="done"?"#e03131":p>=100?"#2f9e44":"#2f6fde"}"></i></div><small>${p}%${sub?" · "+sub:""}</small></div>`};
/* nút việc tôi cần làm ngay trên bảng */
function tkActBtn(x){if(x.src!=="task"||x.st==="done")return "";const t=(D().tasks||[]).find(y=>y.id===x.id);if(!t||(t.cd&&t.cd.length))return "";
  if(tkMyTurn(t))return `<button type="button" class="btn sm pri" data-tkopen="${t.id}">Duyệt</button>`;
  if(t.st!=="review"&&(t.nguoi===ME.id||(t.phoi||[]).includes(ME.id)))return `<button type="button" class="btn sm pri" data-tkopen="${t.id}">Nộp kết quả</button>`;return ""}
/* Mẫu việc và việc lặp lại (học Lark): mẫu lưu ở d.taskTpl; mẫu có lặp thì web tự giao lại mỗi ngày / tuần / tháng.
   Giao ở hai nơi, cùng mốc p.last nên không giao trùng: khi có người mở trang Việc (tkRecur) và máy chủ chạy mỗi giờ (src/server/services/taskRecurring.ts, cùng luật).
   "Hằng ngày" chỉ giao việc của hôm nay, không bù những ngày trước. */
/* tên việc có chữ "gấp" / "khẩn": tự gắn cờ Gấp (t.gap), xếp lên đầu */
const cwGapT=s=>/gấp|khẩn/i.test(String(s||"").normalize("NFC"));
const tkTpls=()=>(D().taskTpl||[]).filter(p=>!p.xoa);
const tkLapLbl=p=>p.lap==="ngay"?"hằng ngày":p.lap==="tuan"?"mỗi "+(+p.ngay===7?"Chủ nhật":"thứ "+(+p.ngay+1)):p.lap==="thang"?"ngày "+p.ngay+" hằng tháng":"";
const tkTodayIso=()=>{const x=new Date();return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
function tkTplSave(v,lap,ngay){const today=tkTodayIso();DB.mutate(ME.name,"lưu mẫu việc "+v.ten,dt=>{dt.taskTpl=dt.taskTpl||[];dt.taskTpl.push({id:uid("tp"),ten:v.ten,moTa:v.moTa,team:v.team,da:v.da,nguoi:v.nguoi,phoi:v.phoi||[],theoDoi:v.theoDoi||[],gio:v.gio||"",uu:v.uu,v2:v.v2,v2ceo:v.v2ceo,checklist:(v.checklist||[]).map(c=>({t:c.t})),hanSau:Math.max(0,(+v.han||0)-dt.settings.today),lap:lap||"",ngay:+ngay||0,tao:ME.id,last:today,dung:false})})}
function tkRecur(){const P=tkTpls().filter(p=>p.lap&&!p.dung),today=tkTodayIso();if(!P.length||!P.some(p=>(p.last||"")<today))return;
  const hit=(p,iso)=>{const x=new Date(iso+"T00:00:00");return p.lap==="ngay"?iso===today:p.lap==="tuan"?((x.getDay()+6)%7+1)===+p.ngay:x.getDate()===+p.ngay};
  DB.mutate("Hệ thống","tự giao việc lặp lại",dt=>{(dt.taskTpl||[]).forEach(p=>{if(p.xoa||!p.lap||p.dung||(p.last||"")>=today)return;const x=new Date((p.last||today)+"T00:00:00");if(p.lap==="ngay"&&p.last){const y=new Date(today+"T00:00:00");y.setDate(y.getDate()-1);if(x<y)x.setTime(y.getTime())}
    for(let i=0;i<62;i++){x.setDate(x.getDate()+1);const iso=x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");if(iso>today)break;
      if(hit(p,iso)){const d0=tkDay(iso),nt={id:uid("cv"),ten:p.ten,moTa:p.moTa||"",team:p.team,da:p.da||"",nguoi:p.nguoi||"",phoi:p.phoi||[],theoDoi:p.theoDoi||[],gio:p.gio||"",gap:cwGapT(p.ten),han:d0+(+p.hanSau||0),bd:d0,uu:p.uu||"Trung bình",st:"todo",v2:p.v2,v2ceo:p.v2ceo,checklist:(p.checklist||[]).map(c=>({t:c.t,x:false})),loai:"Việc",tao:p.tao,tpl:p.id,log:[{at:new Date().toLocaleString("vi-VN"),by:"Hệ thống",txt:"Tự giao theo mẫu lặp lại ("+tkLapLbl(p)+")"}]};
        dt.tasks.push(nt);if(typeof notifyU==="function"&&nt.nguoi){dt.notifs=dt.notifs||[];dt.notifs.push({id:uid("nt"),to:nt.nguoi,text:`Việc lặp lại: "${nt.ten}" · hạn ${dd(nt.han)}`,at:nowISO(),ref:"task:"+nt.id,by:"",read:false})}}}
    p.last=today})})}
/* ghim (lưu trên web, theo từng người) và gần đây (lưu trên máy này) */
const tkPinned=id=>(((D().taskPins||{})[ME.id])||[]).includes(id);
function tkPinToggle(id){DB.mutate(ME.name,"ghim việc",dt=>{dt.taskPins=dt.taskPins||{};const L=dt.taskPins[ME.id]=dt.taskPins[ME.id]||[];const i=L.indexOf(id);if(i>=0)L.splice(i,1);else L.unshift(id);dt.taskPins[ME.id]=L.slice(0,12)})}
const tkRecentKey=()=>"ailla_tk_recent_"+(ME&&ME.id);
function tkRecent(){try{return JSON.parse(localStorage.getItem(tkRecentKey())||"[]")}catch(e){return []}}
function tkRecentAdd(id){try{const L=tkRecent().filter(x=>x!==id);L.unshift(id);localStorage.setItem(tkRecentKey(),JSON.stringify(L.slice(0,6)))}catch(e){}}
function tkQuickHtml(){const T=D().tasks||[],f=id=>T.find(t=>t.id===id),pin=(((D().taskPins||{})[ME.id])||[]).map(f).filter(Boolean),rec=[]; /* chị Hoa 03/11: bỏ dòng "Gần đây" (việc đã hiện ngay trong danh sách), chỉ giữ việc đã ghim */
  if(!pin.length&&!rec.length)return "";const chip=t=>`<button type="button" class="tkqc${t.st==="done"?" done":""}" data-tkopen="${t.id}" title="${esc(t.ten)}">${esc(cvShort(t.ten,34))}</button>`;
  return `<div class="tkquick">${pin.length?`<span class="tkql">📌 Ghim</span>${pin.map(chip).join("")}`:""}${rec.length?`<span class="tkql">🕘 Gần đây</span>${rec.slice(0,5).map(chip).join("")}`:""}</div>`}
/* xem theo phòng (học Lark "Không gian làm việc"): một hàng chọn nhanh */
function tkTeamChips(){if(!cvMgrView()||CVF.scope==="mine"||CVF.tao)return "";const T=cvWhoOpts().filter(o=>String(o[0]).indexOf("t:")===0);if(T.length<2)return "";
  const on=k=>CVF.who===k;return `<div class="tkteams"><button type="button" class="cvchip${!String(CVF.who||"").startsWith("t:")?" on":""}" data-tmw="all">Tất cả phòng</button>${T.map(o=>`<button type="button" class="cvchip${on(o[0])?" on":""}" data-tmw="${esc(o[0])}">${esc(String(o[1]).replace(/^Team\s*/i,""))}</button>`).join("")}</div>`}
function pCvTpl(m){const L=tkTpls();
  m.innerHTML=`<section class="card flush cvtk"><div class="card-h pad"><h2>Mẫu việc & việc lặp lại</h2><span class="hint">Tạo mẫu: bấm ＋ Giao việc, chọn "Lặp lại" hoặc "Lưu làm mẫu việc"</span></div>${L.length?tbl(["Mẫu việc","Người làm","Lặp lại","Hạn","Lần giao gần nhất",""],L.map(p=>`<tr><td><b>${esc(p.ten)}</b></td><td>${avatar(p.nguoi)}${esc(userName(p.nguoi)||"—")}</td><td>${p.lap?esc(tkLapLbl(p))+(p.dung?` <span class="pill p-gry">tạm dừng</span>`:""):"Không lặp"}</td><td>sau ${+p.hanSau||0} ngày</td><td>${esc(p.last||"—")}</td><td>${p.lap?`<button type="button" class="btn sm" data-tpd="${p.id}">${p.dung?"Chạy lại":"Tạm dừng"}</button> `:""}<button type="button" class="btn sm" data-tpx="${p.id}">Xóa</button></td></tr>`)):`<p class="empty pad">Chưa có mẫu việc nào.</p>`}</section>`;
  m.querySelectorAll("[data-tpd]").forEach(b=>b.onclick=()=>{DB.mutate(ME.name,"đổi mẫu việc",dt=>{const p=(dt.taskTpl||[]).find(x=>x.id===b.dataset.tpd);if(p){p.dung=!p.dung;if(!p.dung)p.last=tkTodayIso()}});renderMain()});
  m.querySelectorAll("[data-tpx]").forEach(b=>b.onclick=()=>{if(!confirm("Xóa mẫu việc này? Việc đã giao vẫn giữ nguyên."))return;DB.mutate(ME.name,"xóa mẫu việc",dt=>{const p=(dt.taskTpl||[]).find(x=>x.id===b.dataset.tpx);if(p)p.xoa=true});renderMain()})}
const tkStC=k=>(CV_ST.find(s=>s[0]===k)||[])[2]||"gry";
const tkCk=t=>{const c=t.checklist||[];return c.length?c.filter(x=>x.x).length+"/"+c.length+" việc nhỏ":""};
const tkStChip=t=>[t.tlNote&&t.st!=="done"&&t.st!=="review"?"Bị trả lại":cvStN(t.st),tkCk(t)].filter(Boolean).join(" · ");
/* thanh tiến trình: Giao → Nhận → Đang làm → Nộp → Duyệt → Hoàn thành (việc tự giao cho mình thì bỏ bước Duyệt) */
function tkChatAdd(x,kind,text,vong){x.chat=x.chat||[];x.chat.push({at:new Date().toLocaleString("vi-VN"),by:ME.name,byId:ME.id,kind,text:String(text||"").slice(0,1000),vong:vong||0});if(x.chat.length>80)x.chat=x.chat.slice(-80)}
const TK_KIND={tra:"↩ Trả lại",ok1:"✓ Duyệt vòng 1",ok2:"✓ Duyệt hoàn thành",nop:"📤 Nộp kết quả"};
const tkNamesDesc=()=>D().users.filter(u=>u.active&&u.name).sort((a,b)=>b.name.length-a.name.length);
const tkMentions=txt=>{const low=String(txt||"").toLowerCase();return tkNamesDesc().filter(u=>low.includes("@"+u.name.toLowerCase())).map(u=>u.id)};
const tkMention=txt=>{let h=esc(txt);tkNamesDesc().forEach(u=>{const k="@"+esc(u.name);if(h.includes(k))h=h.split(k).join(`<b class="tkat">${k}</b>`)});return h.replace(/\n/g,"<br>")};
function tkChatHtml(t){const L=t.chat||[];
  return `<div class="tkchat"><div class="tkch"><b>Trao đổi</b><small class="hint">hỏi lại, góp ý, gọi người bằng @tên</small></div>${L.length?`<div class="tkcl">${L.map(c=>`<div class="tkc${c.byId===ME.id?" me":""}${c.kind==="tra"?" tra":c.kind?" ok":""}"><small><b>${esc(c.by)}</b> · ${esc(c.at)}${TK_KIND[c.kind]?" · "+TK_KIND[c.kind]:""}</small>${c.text?`<div>${tkMention(c.text)}</div>`:""}</div>`).join("")}</div>`:""}
   <div class="tkcin"><textarea id="t-cm" rows="1" placeholder="Viết trao đổi… gõ @ để gọi người"></textarea><button type="button" class="btn sm" id="t-cmok">Gửi</button></div><div id="t-cmat" class="tkatl" hidden></div></div>`}
function tkApprove(id){const t0=D().tasks.find(x=>x.id===id);if(!t0)return false;if(t0.cd&&t0.cd.length){openTask(id);return false}const r2=t0.vong!==2&&tkV2(t0)&&ME.role!=="admin";
  DB.mutate(ME.name,`duyệt "${t0.ten}"`,dt=>{const x=dt.tasks.find(y=>y.id===id);if(!x)return;const ref="task:"+x.id,N=(ids,txt)=>{if(typeof notifyU==="function")notifyU(dt,ids,txt,ref)};
    tkChatAdd(x,r2?"ok1":"ok2","",x.vong||1);
    if(r2){x.vong=2;tkLog(x,"Duyệt vòng 1, chuyển CEO duyệt");N(tkAdmins(),`${ME.name} đã duyệt vòng 1 việc "${x.ten}", chờ duyệt V2`);N([x.nguoi],`${ME.name} đã duyệt vòng 1 việc "${x.ten}", chờ duyệt V2`);cwTdNotify(dt,x,`${ME.name} đã duyệt vòng 1 việc "${x.ten}", chờ duyệt V2`)}
    else{tkLog(x,"Duyệt hoàn thành");x.stTruoc=x.st;x.st="done";x.stAt=new Date().toLocaleString("vi-VN");x.stBy=ME.name;x.vong=0;tkDoneDay(x,dt.settings.today);N([x.nguoi,...(x.phoi||[]),x.tao,...(tkLeadOf(x)?[tkLeadOf(x).id]:[])],`${ME.name} đã duyệt hoàn thành việc "${x.ten}"`);cwTdNotify(dt,x,`${ME.name} đã duyệt hoàn thành việc "${x.ten}"`)}});
  return r2}
function tkReturn(id,note){const t0=D().tasks.find(x=>x.id===id);if(!t0)return;
  DB.mutate(ME.name,`trả lại "${t0.ten}"`,dt=>{const x=dt.tasks.find(y=>y.id===id);if(!x)return;tkChatAdd(x,"tra",note,x.vong||1);tkLog(x,"Trả lại: "+note);x.st="doing";x.tlNote=note;x.vong=0;x.stAt=new Date().toLocaleString("vi-VN");x.stBy=ME.name;tkDoneDay(x,dt.settings.today);
    if(typeof notifyU==="function")notifyU(dt,[x.nguoi,...(x.phoi||[])],`${ME.name} trả lại việc "${x.ten}": ${note}`,"task:"+x.id);cwTdNotify(dt,x,`${ME.name} trả lại việc "${x.ten}" để sửa`)})}
function tkComment(id,text){const t0=D().tasks.find(x=>x.id===id);if(!t0)return;
  DB.mutate(ME.name,`trao đổi ở "${t0.ten}"`,dt=>{const x=dt.tasks.find(y=>y.id===id);if(!x)return;tkChatAdd(x,"",text,x.vong||0);
    if(typeof notifyU!=="function")return;const at=tkMentions(text),who=[x.nguoi,...(x.phoi||[]),x.tao,...tkAppr(x)].filter(z=>!at.includes(z));
    if(at.length)notifyU(dt,at,`${ME.name} nhắc bạn ở việc "${x.ten}": ${text.slice(0,90)}`,"task:"+x.id);notifyU(dt,who,`${ME.name} trao đổi ở việc "${x.ten}": ${text.slice(0,90)}`,"task:"+x.id)})}
/* gợi ý tên khi gõ @ trong ô trao đổi */
function tkBindChat(t){const ta=$("#t-cm"),box=$("#t-cmat");if(!ta)return;
  ta.oninput=()=>{ta.style.height="auto";ta.style.height=Math.min(140,ta.scrollHeight)+"px";const v=ta.value.slice(0,ta.selectionStart),m=/@([^@\n]{0,20})$/.exec(v);if(!m||!m[1].trim()){box.hidden=true;return}
    const fd=typeof foldName==="function"?foldName:(z=>String(z).toLowerCase()),q=fd(m[1]),/* đủ mọi người (chị Hoa 03/11: trước chỉ 6 người đầu): người của việc → cùng phòng → còn lại */
      rel=new Set([t.tao,t.nguoi,...(t.phoi||[]),...(t.chat||[]).map(c=>c.byId)].filter(Boolean)),tm=teamOf(ME),rk=u=>rel.has(u.id)?0:teamOf(u)===tm?1:2,
      L=D().users.filter(u=>u.active&&u.name&&u.id!==ME.id&&fd(u.name).includes(q)).sort((a,b)=>rk(a)-rk(b)||a.name.localeCompare(b.name)).slice(0,8);
    if(!L.length){box.hidden=true;return}box.hidden=false;box.innerHTML=L.map(u=>`<button type="button" class="btn sm" data-atn="${esc(u.name)}">${esc(u.name)}<small> · ${esc(cvTeamName(teamOf(u))||"")}</small></button>`).join("");
    box.querySelectorAll("[data-atn]").forEach(b=>b.onclick=()=>{const pos=ta.selectionStart,pre=ta.value.slice(0,pos).replace(/@([^@\n]{0,20})$/,"@"+b.dataset.atn+" ");ta.value=pre+ta.value.slice(pos);box.hidden=true;ta.focus()})};
  $("#t-cmok").onclick=()=>{const v=ta.value.trim();if(!v){toast("Viết nội dung trao đổi");return}tkComment(t.id,v);toast("Đã gửi");openTask(t.id);renderMain()}}
function tkStepper(t){
  const v2=tkV2(t),appr=v2||!!(t.tao&&t.tao!==t.nguoi)||!!t.duyet,S=[["giao","Đã giao"],["nhan","Đã nhận"],["doing","Đang làm"],["nop","Đã nộp"]].concat(v2?[["l","Lead duyệt"],["c","CEO duyệt"]]:appr?[["duyet","Duyệt"]]:[]).concat([["done","Hoàn thành"]]);
  const at={todo:0,cg:0,nhan:1,doing:2,review:v2?(t.vong===2?5:4):appr?4:3,done:S.length-1}[t.st];const cur=at==null?0:at,c=t.checklist||[],cn=c.filter(x=>x.x).length;
  return `<div class="tkstep">${S.map(([k,n],i)=>`<span class="${i<cur?"ok":i===cur?"on":""}${i===cur&&t.tlNote&&t.st!=="done"&&t.st!=="review"?" back":""}">${i<cur?"✓ ":""}${n}</span>`).join("")}</div>
   ${c.length?`<div class="tkprog"><i style="width:${Math.round(cn/c.length*100)}%"></i></div><small class="hint">Việc nhỏ đã xong ${cn}/${c.length}</small>`:""}`
}
function tkResultHtml(t){
  if(!t||(t.cd&&t.cd.length))return "";
  return (t.tuThem?"":tkStepper(t))+tkResultBox(t);
}
function tkResultBox(t){
  const doer=t.nguoi===ME.id||(t.phoi||[]).includes(ME.id),mg=tkMgr(t),sub=tkSubHtml(t);
  /* việc nhân sự tự thêm cho mình: tự bấm Xong, không qua duyệt */
  /* xin từ chối việc (chị Hoa 03/11): nhân sự ghi lý do, người giao / Lead duyệt */
  {const tc=t.tuChoi;if(tc&&tc.st==="cho"){const can=tkTcCan(t);return `<div class="tkres rv"><b>${esc(userName(tc.by)||"")} xin từ chối việc này</b><p>“${esc(tc.lyDo)}”</p><small class="hint">Gửi lúc ${esc(tc.at||"")}</small>${can?`<div class="acts"><button type="button" class="btn sm pri" id="t-tcmv">Chuyển người khác làm</button><button type="button" class="btn sm" id="t-tcok">Hủy việc</button><button type="button" class="btn sm" id="t-tcno">Vẫn giao người này</button></div><div class="tkmg" id="t-tcmvw" hidden><label>Người làm mới<select id="t-tcng">${opt([["","— chọn người"]].concat((D().users||[]).filter(u=>u.active!==false&&u.name&&u.id!==t.nguoi&&u.role!=="admin").sort((a,b)=>a.name.localeCompare(b.name)).map(u=>[u.id,u.name])),"")}</select></label><button type="button" class="btn sm pri" id="t-tcmvok">Chuyển</button></div>`:`<p class="hint">Đang chờ ${esc(userName(t.tao)||"quản lý")} duyệt.</p>`}</div>`}}
  const tcBtn=doer&&!t.tuThem&&t.tao&&t.tao!==ME.id&&["todo","nhan","doing"].includes(t.st)?`<button type="button" class="btn sm danger" id="t-tc" title="Không làm được việc này: ghi lý do gửi người giao duyệt">Từ chối việc</button>`:"";
  const tcNo=t.tuChoi&&t.tuChoi.st==="khong"&&t.st!=="done"?`<div class="note amb">Xin từ chối không được duyệt${t.tuChoi.note?": "+esc(t.tuChoi.note):""}. Việc vẫn cần làm.</div>`:"";
  if(t.tuThem&&t.tao===t.nguoi&&!t.duyet&&t.st!=="done")return doer?`<div class="tkres"><b>Việc tự thêm</b> <span class="hint">tự đánh dấu xong, không cần duyệt</span><div class="acts">${t.st==="todo"||t.st==="nhan"?`<button type="button" class="btn sm" data-tkq="doing">Bắt đầu làm</button>`:`<span class="hint">Đang làm</span>`}<button type="button" class="btn sm pri" id="t-selfok">✓ Xong</button></div></div>`:`<div class="tkres"><b>Việc ${esc(userName(t.nguoi)||"")} tự thêm</b> <span class="hint">${esc(cvStN(t.st))}</span></div>`;
  if(t.st==="done")return `<div class="tkres ok"><b>✓ Đã hoàn thành${t.xongNgay?" ngày "+dd(t.xongNgay):""}</b>${sub}${tkReopenOk(t)?`<div class="acts"><button type="button" class="btn sm" id="t-reopen">↺ Mở lại việc</button><span class="hint">bấm nhầm hoàn thành thì mở lại</span></div>`:""}</div>`;
  if(t.st==="review"&&mg&&!(t.nopAt||t.kq||t.kqNote||(t.kqFiles||[]).length))return `<div class="tkres rv"><b>Người làm chưa nộp kết quả</b> <span class="hint">việc đang ở Chờ duyệt nhưng chưa có gì để duyệt</span><div class="acts"><button type="button" class="btn sm pri" id="t-backtodo">Trả về Cần làm</button></div></div>`;
  if(t.st==="review")return mg?`<div class="tkres rv"><b>Kết quả chờ bạn duyệt${tkV2(t)?(t.vong===2?" · vòng 2":" · vòng 1"):""}</b> <small class="hint">${esc(userName(t.nguoi)||"")} nộp${t.vong===2&&tkLeadOf(t)?" · "+esc(tkLeadOf(t).name)+" đã duyệt vòng 1":""}</small>${sub||`<p class="hint">Người làm chưa ghi kết quả.</p>`}<div class="tkmg"><input id="t-tl" placeholder="Nếu trả lại: cần sửa gì"><button type="button" class="btn sm" id="t-tlok">Cần sửa</button><button type="button" class="btn sm pri" id="t-duyet">✓ Duyệt</button></div></div>`
    :`<div class="tkres rv"><b>Đã nộp, đang chờ ${esc(tkMgrNames(t))} duyệt${tkV2(t)?(t.vong===2?" vòng 2":" vòng 1"):""}</b>${sub}</div>`;
  if(doer){const need=!!tkDoneErr(t);
    return tcNo+`<div class="tkres"><b>Nộp kết quả</b>${tcBtn?`<span style="float:right">${tcBtn}</span>`:""}${t.st==="todo"||t.st==="nhan"?`<div class="acts"><span class="hint">Trạng thái: ${cvStN(t.st)}</span>${t.st==="todo"?`<button type="button" class="btn sm" data-tkq="nhan">Nhận việc</button>`:""}<button type="button" class="btn sm" data-tkq="doing">Bắt đầu làm</button></div>`:""}${t.tlNote?`<p class="tkback">↩ Bị trả lại: ${esc(t.tlNote)}</p>`:""}
      <textarea id="t-kqn" rows="2" placeholder="Đã làm gì, kết quả ra sao">${esc(t.kqNote||"")}</textarea>
      <input id="t-kql" placeholder="Link kết quả (Drive, bài đăng, video…) nếu có" value="${esc(t.kq||"")}">
      <div id="t-kqfl"></div><label class="btn sm tkup">📎 Thêm ảnh / file<input type="file" id="t-kqf" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" hidden></label>
      <div class="acts"><button type="button" class="btn pri" id="t-nop">${need?"Nộp kết quả để duyệt":"Nộp kết quả, xong việc"}</button></div>${need?`<small class="hint">Nộp xong, ${esc(tkMgrNames(t))} duyệt ngay trong việc này.</small>`:""}</div>`}
  return mg?`<div class="tkres"><b>Chưa nộp kết quả</b>${sub}</div>`:"";
}
/* đổi trạng thái một việc + báo chuông đúng người: gửi duyệt → người giao/quản lý · duyệt xong, trả lại → người làm */
/* nhật ký từng việc: ai làm gì lúc nào (giữ 60 dòng gần nhất) */
/* người theo dõi (t.theoDoi): được báo khi việc đổi trạng thái, nộp / duyệt / trả lại kết quả; không tính là việc của mình */
function cwTdNotify(dt,x,txt){const L=(x.theoDoi||[]).filter(id=>id&&id!==x.nguoi&&!(x.phoi||[]).includes(id));if(L.length&&typeof notifyU==="function")notifyU(dt,L,txt,"task:"+x.id)}
function tkLog(x,txt){x.log=x.log||[];x.log.push({at:new Date().toLocaleString("vi-VN"),by:(typeof ME!=="undefined"&&ME)?ME.name:"Hệ thống",txt});if(x.log.length>60)x.log=x.log.slice(-60)}
/* ghi ngày xong để tính đúng hạn / trễ hạn */
function tkDoneDay(x,today){if(x.st==="done"){if(!x.xongNgay)x.xongNgay=today}else delete x.xongNgay}
function tkSetSt(id,k,extra,note){const t0=D().tasks.find(x=>x.id===id);if(!t0)return;
  DB.mutate(ME.name,`"${t0.ten}" → ${cvStN(k)}`,dt=>{const x=dt.tasks.find(y=>y.id===id);if(!x)return;const old=x.st,ref="task:"+x.id,ng=[x.nguoi,...(x.phoi||[])];tkLog(x,"Trạng thái: "+cvStN(old)+" → "+cvStN(k)+(note?" · "+note:""));if(k==="done"&&old!=="done")x.stTruoc=old;x.st=k;x.stAt=new Date().toLocaleString("vi-VN");x.stBy=ME.name;Object.assign(x,extra||{});if(k==="review"&&old!=="review")x.vong=1;if(x.__chat){tkChatAdd(x,x.__chat[0],x.__chat[1],1);delete x.__chat}tkDoneDay(x,dt.settings.today);
    if(old===k||typeof notifyU!=="function")return;
    cwTdNotify(dt,x,k==="review"?`${ME.name} nộp kết quả việc "${x.ten}", đang chờ duyệt`:`${ME.name} chuyển việc "${x.ten}" sang ${cvStN(k)}`);
    if(k==="review")notifyU(dt,tkAppr(x),`${ME.name} nộp kết quả việc "${x.ten}", chờ bạn duyệt${x.vong===2?" vòng 2":""}`,ref);
    else if(k==="done"&&ME.id!==x.nguoi)notifyU(dt,ng,`${ME.name} đã duyệt xong việc "${x.ten}"`,ref);
    else if(old==="review"&&ME.id!==x.nguoi)notifyU(dt,ng,`${ME.name} trả lại việc "${x.ten}"${note?": "+note:""}`,ref);
    else if(k==="done")notifyU(dt,[x.tao],`${ME.name} đã xong việc "${x.ten}"`,ref)})}
function tkDoneErr(t){if(!t||tkMgr(t))return "";if(t.tuThem&&t.duyet&&t.duyet!==t.nguoi)return `Việc này đã đề xuất ${userName(t.duyet)||"người duyệt"} duyệt. Bấm "Chờ duyệt" để gửi duyệt rồi mới hoàn thành.`;if(t.tao&&t.tao!==t.nguoi)return `Việc này do ${userName(t.tao)||"người giao"} giao. Bấm "Chờ duyệt" để người giao xem rồi mới hoàn thành.`;return ""}
/* đến lượt tôi duyệt: đúng người của vòng hiện tại (vòng 1 lead, vòng 2 chị) */
const tkMyTurn=t=>!!ME&&(t.cd&&t.cd.length?tkCdWait(t).length>0:t.st==="review"&&ME.id!==t.nguoi&&tkAppr(t).includes(ME.id));
const tkMgrNames=t=>tkAppr(t).map(userName).filter(Boolean).join(", ")||"quản lý";
/* tinnhan.js: giao việc từ tin nhắn — giao xong gọi hàm này với mã việc mới để gửi thẻ việc vào cuộc trò chuyện */
let TK_AFTER_NEW=null;
function openTask(id){
  TK_AFTER_NEW=null;
  const d=D(),t=id?d.tasks.find(x=>x.id===id):null,giver=tkGiver(),own=!!t&&t.tao===ME.id&&t.nguoi===ME.id,ed=giver||!t||t.nguoi===ME.id||(t.phoi||[]).includes(ME.id)||(!!t&&t.tao===ME.id),gv=giver||!t||own;
  const users=d.users.filter(u=>u.active&&u.role!=="admin"||u.id===ME.id),ngUsers=tkAssignable(users).concat(t&&t.nguoi&&!tkAssignable(users).some(u=>u.id===t.nguoi)?users.filter(u=>u.id===t.nguoi):[]);
  if(t)tkRecentAdd(t.id);if(typeof cwCss==="function")cwCss();
  const tdUsers=d.users.filter(u=>u.active&&u.name&&!(typeof CV_TEST!=="undefined"&&CV_TEST.includes(u.id))).sort((a,b)=>(b.role==="admin")-(a.role==="admin")||a.name.localeCompare(b.name));
  openDrawerHTML(`<h2>${t?"Chi tiết việc":"Giao việc"}${t?` <button type="button" class="btn sm tkpin" id="t-pin">${tkPinned(t.id)?"★ Bỏ ghim":"☆ Ghim"}</button>`:""}</h2>${!t&&tkTpls().length?`<label class="field">Giao từ mẫu<select id="t-tpl">${opt([["","— chọn mẫu việc có sẵn"]].concat(tkTpls().map(p=>[p.id,p.ten+(p.lap?" · "+tkLapLbl(p):"")])),"")}</select></label>`:""}${t&&t.tao?`<p class="hint">Người giao: ${esc(userName(t.tao)||"—")}</p>`:""}${!t&&!giver?`<p class="hint">Bạn tạo việc cho chính mình. Muốn giao cho người khác, nhờ quản lý giao.</p>`:""}${t?tkResultHtml(t)+tkChatHtml(t):""}<form class="frm" id="tkf2"><label class="field">Tên việc<input id="t-ten" required value="${esc(t?t.ten:"")}" ${gv?"":"disabled"}><small class="hint t-red" id="t-gapn"${t&&t.gap?"":" hidden"}>${t&&t.gap?"Việc gắn cờ Gấp, xếp lên đầu":"Có chữ \"gấp\" nên web tự gắn cờ Gấp, xếp lên đầu"}</small></label><label class="field">Mô tả<textarea id="t-mo" rows="2" ${gv?"":"disabled"}>${esc(t?t.moTa:"")}</textarea></label>
   <div class="row4"><label class="field">Team<select id="t-team" ${gv?"":"disabled"}>${opt(Object.entries(TEAMS),t?t.team:(TEAMS[teamOf(ME)]?teamOf(ME):"content"))}</select></label><label class="field">Dự án<select id="t-da" ${gv?"":"disabled"}>${opt([["","—"]].concat((d.projects||[]).map(p=>[p.id,p.ten])),t?t.da:CVF.da)}</select></label></div>
   <div class="row4"><label class="field">Người làm<select id="t-ng" ${gv&&giver?"":"disabled"}>${opt([["","— chưa giao"]].concat(ngUsers.map(u=>[u.id,u.name+" · "+(TEAMS[teamOf(u)]||u.phongBan||"Quản lý")])),t?t.nguoi:(giver?"":ME.id))}</select></label><label class="field">Deadline<span class="tkhg">${tkDate("t-han",t?t.han:d.settings.today+2,gv?"":"disabled")}<input type="time" id="t-gio" value="${esc(t&&t.gio||"")}" ${gv?"":"disabled"} aria-label="Giờ làm"></span></label><label class="field">Bắt đầu <small class="hint">(trống = như hạn)</small>${tkDate("t-bd",t?(t.bd||0):0,gv?"":"disabled")}</label><label class="field">Ưu tiên<select id="t-uu" ${gv?"":"disabled"}>${opt(UU,t?t.uu:"Trung bình")}</select></label></div>
   ${gv&&ME.role!=="admin"&&!tkCeoGiao(t)?`<label class="ck sm"><input type="checkbox" id="t-v2" ${tkV2On(t||{team:TEAMS[teamOf(ME)]?teamOf(ME):"content"})?"checked":""}> Lead duyệt xong thì CEO duyệt vòng 2</label>`:""}
   ${!t&&giver?`<div class="row4 tklap"><label class="field">Lặp lại<select id="t-lap">${opt([["","Không lặp"],["ngay","Hằng ngày"],["tuan","Mỗi tuần"],["thang","Mỗi tháng"]],"")}</select></label><label class="field" id="t-lapdw" hidden>Vào<select id="t-lapd"></select></label><label class="ck sm"><input type="checkbox" id="t-tplsave"> Lưu làm mẫu việc</label></div>`:""}
   <div class="field" id="t-cdw">Công đoạn <small class="hint">(một việc có nhiều người, mỗi người một phần)</small><div id="t-cd"></div>${gv&&giver?`<div class="acts"><button type="button" class="btn sm" id="t-cdadd">＋ Công đoạn</button><button type="button" class="btn sm" id="t-cddu">＋ Bước duyệt</button><label class="ck sm"><input type="checkbox" id="t-seq" ${t&&t.tuanTu===false?"":"checked"}> Làm lần lượt</label></div>`:""}</div>
   <div class="field" id="t-stw">Trạng thái <small class="hint">bấm để đổi${t&&ed?", tự lưu ngay":""}</small><div class="tkst">${CV_ST.filter(s=>s[0]!=="cg").map(([k,n,c])=>`<button type="button" class="tkb tk-${c}${(t?t.st:"todo")===k?" on":""}" data-tkst="${k}" ${ed?"":"disabled"}>${(t?t.st:"todo")===k?"✓ ":""}${n}</button>`).join("")}</div><input type="hidden" id="t-st" value="${t?t.st:"todo"}">${t&&t.stAt?`<small class="hint">Đổi lần cuối: ${esc(t.stAt)} bởi ${esc(t.stBy||"")}</small>`:""}</div>
   ${t&&t.st!=="done"&&t.han&&(t.han<d.settings.today||(t.treReq||{}).st==="cho"||(ed&&!tkMgr(t)))?(()=>{const R=t.treReq||{},mg=tkMgr(t),cho=R.st==="cho",lt=t.han<d.settings.today;
     /* việc tự thêm (không đề xuất người duyệt): tự gia hạn, ghi lý do, không gửi ai duyệt */
     if(t.tuThem&&t.tao===t.nguoi&&!t.duyet&&ME.id===t.nguoi)return `<div class="tklate${lt?"":" ok"}"><b>${lt?`⚠ Trễ hạn ${d.settings.today-t.han} ngày`:"Deadline "+dayLbl(t.han)}</b>${t.hanCu?` (hạn cũ ${dd(t.hanCu)})`:""}<label class="field">Lý do gia hạn<textarea id="t-tre" rows="2" placeholder="Vì sao chưa kịp, xong đến đâu"></textarea></label><div class="tkmg"><label>Gia hạn đến${tkDate("t-gh",Math.max(t.han,d.settings.today)+1)}</label><button type="button" class="btn sm pri" id="t-selfgh">Gia hạn</button></div></div>`;
     return `<div class="tklate${lt?"":" ok"}"><b>${lt?`⚠ Trễ hạn ${d.settings.today-t.han} ngày`:"Hạn "+dayLbl(t.han)}</b>${lt?` (hạn ${dayLbl(t.han)}${t.hanCu?`, hạn cũ ${dd(t.hanCu)}`:""})`:t.hanCu?` (hạn cũ ${dd(t.hanCu)})`:""}
     ${cho?`<p>📨 <b>${esc(R.by)}</b> đã gửi lý do lúc ${esc(R.at)}: <i>${esc(R.lyDo)}</i><br><span class="hint">Chờ quản lý (${esc(tkMgrNames(t))}) gia hạn hoặc duyệt hoàn thành.</span></p>
       ${mg?`<div class="tkmg"><label>Gia hạn đến${tkDate("t-gh",R.hanMoi&&R.hanMoi>=d.settings.today?R.hanMoi:d.settings.today+2)}</label><button type="button" class="btn sm" id="t-ghok">Gia hạn</button>${t.st==="review"?`<button type="button" class="btn sm pri" id="t-dok">✓ Duyệt hoàn thành</button>`:""}</div>`:""}`
     :`${ed&&!mg?`<label class="field">${lt?"Lý do trễ":"Xin gia hạn"}<textarea id="t-tre" rows="2" placeholder="Vì sao chưa kịp, xong đến đâu, cần thêm bao lâu">${esc(R.lyDo||"")}</textarea></label><label class="field">Xin dời hạn đến${tkDate("t-hm",Math.max(t.han,d.settings.today)+1)}</label><button type="button" class="btn sm pri" id="t-trego">Gửi quản lý</button>`:mg?`<p class="hint">Người làm chưa gửi lý do trễ.</p><div class="tkmg"><label>Gia hạn đến${tkDate("t-gh",R.hanMoi&&R.hanMoi>=d.settings.today?R.hanMoi:d.settings.today+2)}</label><button type="button" class="btn sm" id="t-ghok">Gia hạn</button>${t.st==="review"?`<button type="button" class="btn sm pri" id="t-dok">✓ Duyệt hoàn thành</button>`:""}</div>`:""}`}</div>`})():""}
   ${t&&t.st!=="done"&&t.nguoi&&t.nguoi!==ME.id&&(tkMgr(t)||t.tao===ME.id)?(()=>{const N=t.nhac||[],last=N[N.length-1],lt=t.han&&t.han<d.settings.today;return `<div class="tknhac${lt?" lt":""}"><button type="button" class="btn sm${lt?" pri":""}" id="t-nhac">🔔 Nhắc ${esc(userName(t.nguoi)||"người làm")}${N.length?" lần "+(N.length+1):""}</button><span class="hint">${N.length?`Đã nhắc ${N.length} lần · lần cuối ${esc(last.at)} (${esc(last.by)})`:lt?"Việc đang trễ, chưa nhắc lần nào":"Chưa nhắc lần nào"}</span></div>`})():""}
   <div class="field" id="t-phw">Người cùng làm / hỗ trợ <small class="hint">(một việc có thể nhiều người)</small><div class="phc">${users.map(u=>`<label class="ck sm"><input type="checkbox" name="t-phoi" value="${u.id}" ${t&&(t.phoi||[]).includes(u.id)?"checked":""} ${gv?"":"disabled"}> ${esc(u.name)}</label>`).join("")}</div></div>
   <div class="field" id="t-tdw">Người theo dõi <small class="hint">· được báo khi việc đổi trạng thái, không tính là việc của mình</small><div class="phc">${tdUsers.map(u=>`<label class="ck sm"><input type="checkbox" name="t-td" value="${u.id}" ${t&&(t.theoDoi||[]).includes(u.id)?"checked":""} ${gv?"":"disabled"}> ${esc(u.name)}</label>`).join("")}</div></div>
   <div class="field">Các bước nhỏ <small class="hint">(tích khi làm xong từng bước)</small><div id="t-ck">${((t&&t.checklist)||[]).map((c,i)=>`<label class="ck"><input type="checkbox" data-ck="${i}" ${c.x?"checked":""} ${ed?"":"disabled"}> ${esc(c.t)}</label>`).join("")}</div>${gv?`<input id="t-ckn" placeholder="Thêm việc nhỏ, Enter để thêm">`:""}</div>
   ${t?`<details class="field tklog"><summary>Nhật ký <small class="hint">(${(t.log||[]).length} dòng)</small></summary>${(t.log||[]).length?(t.log||[]).slice().reverse().slice(0,40).map(l=>`<div class="tkl"><span>${esc(l.at)}</span> <b>${esc(l.by)}</b> ${esc(l.txt)}</div>`).join(""):`<p class="hint">Chưa có dòng nào. Từ nay mọi thay đổi của việc này được ghi lại.</p>`}</details>`:""}
   <label class="field">Link / tài liệu đính kèm <small class="hint">(không bắt buộc)</small><input id="t-dk" value="${esc(t?t.dk||"":"")}" placeholder="Link Drive, brief…" ${gv?"":"disabled"}></label>
   <div class="field">Ảnh / file gửi kèm việc <small class="hint">(brief, mẫu, ảnh chụp · mỗi file ≤ 1,5 MB)</small><div id="t-bfl"></div>${gv?`<label class="btn sm tkup">📎 Thêm ảnh / file<input type="file" id="t-bf" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" hidden></label>`:""}</div>
   ${ed?`<div class="acts"><button class="btn pri">${t?"Lưu":"Giao việc"}</button>${t&&gv?`<button type="button" class="btn danger" id="t-del">Xóa</button>`:""}</div>`:""}</form>`);
  const ck=t?JSON.parse(JSON.stringify(t.checklist||[])):[];
  if($("#t-ckn"))$("#t-ckn").onkeydown=e=>{if(e.key!=="Enter")return;e.preventDefault();const v=e.target.value.trim();if(!v)return;ck.push({t:v,x:false});$("#t-ck").insertAdjacentHTML("beforeend",`<label class="ck"><input type="checkbox" data-ck="${ck.length-1}"> ${esc(v)}</label>`);e.target.value=""};
  /* ---- công đoạn ---- */
  const cd=t&&t.cd?t.cd.map(s=>Object.assign({},s)):[];
  const userOpts2=n=>opt([["","— chọn người"]].concat(users.map(u=>[u.id,u.name])),n);
  /* số lượng + nhiều người trong một công đoạn; người đang đến lượt báo số / xong phần mình */
  const PS={duyet:["Chờ duyệt","amb"],ok:["Đã duyệt","grn"],sua:["Cần sửa","red"]};
  const cdx=(s,i,on,edit)=>{if(s.loai==="duyet")return "";const P=s.phan&&s.phan.length?s.phan:null,dv=esc(s.dv||""),x=t?Object.assign({},t,{cd}):null,ap=x?tkCdApprId(x,s):"";
    if(edit&&s.st!=="xong")return `<span class="tcdq"><input type="number" min="0" data-f="sl" value="${s.sl||""}" placeholder="Số lượng"><input data-f="dv" value="${dv}" placeholder="hook, video…"><button type="button" class="btn sm" data-cdp="${i}">＋ Người</button></span>`+
      (P?`<div class="tcdph">${P.map((p,j)=>`<span class="tcdp" data-j="${j}"><select data-pf="nguoi">${userOpts2(p.nguoi)}</select><input type="number" min="0" data-pf="sl" value="${p.sl||""}" placeholder="SL"><button type="button" class="lnk" data-pr="${j}" title="Bỏ người này">✕</button></span>`).join("")}</div>`:"")+cdParts(s,on,dv,ap,false);
    return cdParts(s,on,dv,ap,false)};
  const cdParts=(s,on,dv,ap,ro)=>{if(!t||s.st==="cho"&&!on)return "";const P=s.phan&&s.phan.length;if(!ap&&!s.sl&&!P)return "";
    const appr=ap&&(ap===ME.id||ME.role==="admin");
    return `<div class="tcdph">${tkParts(s).map(p=>{const fin=s.st==="xong",st=fin?["Hoàn thành","grn"]:PS[p.ps],me=!ro&&on&&!fin&&p.nguoi===ME.id&&!["duyet","ok"].includes(p.ps);
      return `<span class="tcdp${fin||p.ps==="ok"?" fin":""}">${avatar(p.nguoi)}<b>${esc(userName(p.nguoi)||"—")}</b>${s.sl?` ${me?`<input type="number" min="0" data-me="${s.id}" value="${+p.xong||0}">`:`<em>${+p.xong||0}</em>`}${+(p.sl||s.sl)?"/"+(P?p.sl:s.sl):""} ${dv}`:""}${st?` <span class="pill p-${st[1]}">${st[0]}</span>`:on?` <span class="pill p-blu">Đang làm</span>`:""}${p.ps==="sua"&&p.note?` <small class="t-red">“${esc(p.note)}”</small>`:""}
        ${me?`${s.sl?`<button type="button" class="btn sm" data-meu="${s.id}">Lưu số</button>`:""}${ap?`<button type="button" class="btn sm pri" data-mes="${s.id}">Gửi duyệt</button>`:""}`:""}
        ${!ro&&on&&appr&&p.ps==="duyet"?`<button type="button" class="btn sm pri" data-pok="${s.id}|${p.nguoi}">Duyệt</button><button type="button" class="btn sm" data-psua="${s.id}|${p.nguoi}">Cần sửa</button>`:""}</span>`}).join("")}${P&&s.sl?`<small class="hint">Cả công đoạn: ${tkCdDone(s)}/${s.sl} ${dv}</small>`:""}${ap&&!fin0(s)?`<small class="hint">Người duyệt: ${esc(userName(ap)||"—")}</small>`:""}</div>`};
  const fin0=s=>s.st==="xong";
  const rcd=()=>{const w=$("#t-cd");if(!w)return;const seqOn=!$("#t-seq")||$("#t-seq").checked,act=tkActive({cd,tuanTu:seqOn?undefined:false}),edit=gv&&giver;
    $("#t-cdw").style.display=(cd.length||(edit&&!(t&&t.tuThem&&t.tao===t.nguoi)))?"":"none";$("#t-stw").style.display=cd.length?"none":"";{const ph=$("#t-phw");if(ph)ph.style.display=cd.length?"none":"";[["#t-ng",gv&&giver],["#t-han",gv],["#t-bd",gv]].forEach(([q,okk])=>{const e=$(q);if(e)e.disabled=cd.length>0||!okk})}
    w.innerHTML=cd.map((s,i)=>{const on=act.includes(s),ap=t?tkCdApprId(Object.assign({},t,{cd}),s):"",can=!!t&&on&&!ap&&((s.phan&&s.phan.length?false:s.nguoi===ME.id)||(s.loai==="duyet"?ME.role==="admin":(giver||tkMgr(t)))),ps=tkParts(s).map(q=>q.ps);
      return `<div class="tcd2${on?" on":""}${s.st==="xong"?" fin":""}" data-i="${i}"><span class="tcdn">${i+1}</span>${edit&&s.st!=="xong"?`<input data-f="ten" value="${esc(s.ten)}" placeholder="Tên công đoạn">`:`<b>${esc(s.ten)}</b>`}${edit&&s.st!=="xong"?`${s.phan&&s.phan.length?`<span class="hint">${s.phan.length} người ↓</span>`:`<select data-f="nguoi">${userOpts2(s.nguoi)}</select>`}<input type="date" data-f="han" value="${s.han?tkIso(s.han):""}">`:`<span>${esc(tkPpl(s).map(userName).join(", ")||"—")}</span><span>${s.han?dd(s.han):""}</span>`}<span class="tcds">${s.st==="xong"?(s.loai==="duyet"?"✓ Đã duyệt":"✓ Hoàn thành"):on?(ps.includes("sua")?"Cần sửa":ps.includes("duyet")&&ps.every(z=>z==="duyet"||z==="ok")?"Chờ duyệt":s.st==="lam"?"Đang làm":"Đến lượt"):"Chờ"}</span>${can?`<button type="button" class="btn sm pri" data-cdx="${s.id}">${s.loai==="duyet"?"Duyệt xong":"Xong"}</button>${s.loai==="duyet"?`<button type="button" class="btn sm" data-cdt="${s.id}">Cần sửa</button>`:(s.st!=="lam"?`<button type="button" class="btn sm" data-cdl="${s.id}">Đang làm</button>`:"")}`:""}${edit&&s.st!=="xong"?`<button type="button" class="btn sm danger" data-cdr="${i}" title="Bỏ công đoạn">✕</button>`:""}${cdx(s,i,on,edit)}</div>`}).join("");
    w.querySelectorAll("[data-f]").forEach(e=>e.onchange=e.oninput=ev=>{const i=+e.closest("[data-i]").dataset.i,f=e.dataset.f;cd[i][f]=f==="han"?tkDay(e.value):f==="sl"?(+e.value||0):e.value;if(f==="sl")tkSplit(cd[i]);if(f==="ten"||f==="dv"||(f==="sl"&&ev.type==="input"))return;rcd()});
    w.querySelectorAll("[data-cdp]").forEach(b=>b.onclick=()=>{const s=cd[+b.dataset.cdp];if(!s.phan||!s.phan.length)s.phan=[{nguoi:s.nguoi,sl:0,xong:0}];s.phan.push({nguoi:"",sl:0,xong:0});tkSplit(s);rcd()});
    w.querySelectorAll("[data-pf]").forEach(e=>e.onchange=()=>{const s=cd[+e.closest("[data-i]").dataset.i],j=+e.closest("[data-j]").dataset.j,f=e.dataset.pf;s.phan[j][f]=f==="sl"?(+e.value||0):e.value;if(j===0&&f==="nguoi")s.nguoi=e.value});
    w.querySelectorAll("[data-pr]").forEach(b=>b.onclick=()=>{const s=cd[+b.closest("[data-i]").dataset.i];s.phan.splice(+b.dataset.pr,1);if(s.phan.length<2){s.nguoi=(s.phan[0]||{}).nguoi||s.nguoi;delete s.phan}else{s.nguoi=s.phan[0].nguoi;tkSplit(s)}rcd()});
    const re=()=>{openTask(t.id);renderMain()};
    w.querySelectorAll("[data-meu],[data-mes]").forEach(b=>b.onclick=()=>{const sid=b.dataset.meu||b.dataset.mes,inp=w.querySelector(`[data-me="${sid}"]`);tkCdSend(t.id,sid,ME.id,b.dataset.mes?"gui":"so",inp?+inp.value:null);toast(b.dataset.mes?"Đã gửi duyệt":"Đã lưu số");re()});
    w.querySelectorAll("[data-pok]").forEach(b=>b.onclick=()=>{const [sid,ng]=b.dataset.pok.split("|");tkCdSend(t.id,sid,ng,"ok");toast("Đã duyệt");re()});
    w.querySelectorAll("[data-psua]").forEach(b=>b.onclick=()=>{const [sid,ng]=b.dataset.psua.split("|"),note=(prompt("Cần sửa gì? (người làm sẽ nhận được)")||"").trim();if(!note){toast("Ghi cần sửa gì để người làm biết");return}tkCdSend(t.id,sid,ng,"sua",null,note);toast("Đã trả lại");re()});
    w.querySelectorAll("[data-cdr]").forEach(b=>b.onclick=()=>{cd.splice(+b.dataset.cdr,1);rcd()});
    const go=(sel,act,ask)=>w.querySelectorAll(sel).forEach(b=>b.onclick=()=>{let note="";if(ask){note=(prompt("Cần sửa gì? (người làm sẽ nhận được)")||"").trim();if(!note){toast("Ghi cần sửa gì để người làm biết");return}}tkCdAct(t.id,b.dataset[sel.slice(6,-1)],act,note);toast(act==="xong"?"Đã xong công đoạn":act==="lam"?"Đã bấm Đang làm":"Đã trả lại");openTask(t.id);renderMain()});
    go("[data-cdx]","xong");go("[data-cdl]","lam");go("[data-cdt]","tra",true)};
  if($("#t-cdadd"))$("#t-cdadd").onclick=()=>{cd.push({id:uid("cd"),ten:"",nguoi:"",han:d.settings.today+2,loai:"lam",st:"cho"});rcd()};
  if($("#t-cddu"))$("#t-cddu").onclick=()=>{cd.push({id:uid("cd"),ten:"Duyệt",nguoi:(t&&t.tao)||ME.id,han:d.settings.today+3,loai:"duyet",st:"cho"});rcd()};
  if($("#t-seq"))$("#t-seq").onchange=rcd;
  rcd();
  /* file brief (người giao) và file kết quả (người làm) */
  const bf=t?(t.files||[]).slice():[],kqF=t?(t.kqFiles||[]).slice():[];
  const fl=()=>{if($("#t-bfl"))$("#t-bfl").innerHTML=tkFilesHtml(bf,"files",gv);if($("#t-kqfl"))$("#t-kqfl").innerHTML=tkFilesHtml(kqF,"kqFiles",true);
    $("#drawer").querySelectorAll("[data-tfx]").forEach(b=>b.onclick=async()=>{if(!confirm("Xóa file này?"))return;const fid=b.dataset.tfx,k=b.dataset.tfk,arr=k==="files"?bf:kqF,i=arr.findIndex(f=>f.id===fid);
      try{await svApi(tkFileUrl(fid),{method:"DELETE"})}catch(e){}if(i>=0)arr.splice(i,1);
      if(t&&k==="files")DB.mutate(ME.name,`xóa file ở việc "${t.ten}"`,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(x)x.files=(x.files||[]).filter(f=>f.id!==fid)});fl()})};
  fl();
  if($("#t-bf"))$("#t-bf").onchange=async e=>{const add=await tkUpload(e.target.files,t?t.id:"");e.target.value="";if(!add.length)return;bf.push(...add);
    if(t)DB.mutate(ME.name,`gửi ${add.length} file vào việc "${t.ten}"`,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(x){x.files=(x.files||[]).concat(add);tkLog(x,"Gửi kèm "+add.map(f=>f.name).join(", "))}});toast("Đã gửi file");fl()};
  if($("#t-kqf"))$("#t-kqf").onchange=async e=>{const add=await tkUpload(e.target.files,t?t.id:"");e.target.value="";if(add.length){kqF.push(...add);fl()}};
  if($("#t-tc"))$("#t-tc").onclick=()=>{const r=(prompt("Lý do từ chối việc này (gửi người giao duyệt):")||"").trim();if(!r){toast("Ghi lý do để người giao biết");return}tkTuChoi(t.id,"gui",r);toast("Đã gửi xin từ chối");openTask(t.id);renderMain()};
  if($("#t-nhac"))$("#t-nhac").onclick=()=>{const m=prompt("Lời nhắc gửi "+(userName(t.nguoi)||"người làm")+" (có thể để trống):","");if(m===null)return;const msg=m.trim();
    DB.mutate(ME.name,"nhắc việc "+t.ten,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;x.nhac=(x.nhac||[]).concat({at:new Date().toLocaleString("vi-VN"),by:ME.name,msg}).slice(-20);const n=x.nhac.length,lt=x.han&&x.han<dt.settings.today;
      tkLog(x,"Nhắc lần "+n+(msg?": "+msg:""));if(typeof notifyU==="function")notifyU(dt,[x.nguoi],`🔔 ${ME.name} nhắc${n>1?" lần "+n:""}: việc "${x.ten}"${lt?" đã trễ hạn "+dd(x.han):x.han?" · hạn "+dd(x.han):""}${msg?" · "+msg:""}`,"task:"+x.id)});
    toast("Đã nhắc "+(userName(t.nguoi)||""));openTask(t.id);renderMain()};
  if($("#t-backtodo"))$("#t-backtodo").onclick=()=>tkBackTodo(t);
  if($("#t-reopen"))$("#t-reopen").onclick=()=>{const to=tkReopenTo(t);if(!confirm("Mở lại việc này về \""+cvStN(to)+"\"?"))return;
    DB.mutate(ME.name,"mở lại việc "+t.ten,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;x.st=to;x.vong=to==="review"?1:0;delete x.stTruoc;delete x.xongNgay;x.stAt=new Date().toLocaleString("vi-VN");x.stBy=ME.name;tkLog(x,"Mở lại việc (Hoàn thành → "+cvStN(to)+")");if(typeof notifyU==="function"&&x.nguoi!==ME.id)notifyU(dt,[x.nguoi],`${ME.name} mở lại việc "${x.ten}"`,"task:"+x.id)});toast("Đã mở lại việc");openTask(t.id);renderMain()};
  if($("#t-tcok"))$("#t-tcok").onclick=()=>{if(!confirm("Hủy việc này? Việc không cần làm nữa."))return;tkTuChoi(t.id,"ok");toast("Đã hủy việc");closeDrawer();renderMain()};
  if($("#t-tcmv"))$("#t-tcmv").onclick=()=>{const w=$("#t-tcmvw");if(w){w.hidden=!w.hidden;const s2=$("#t-tcng");if(s2&&!w.hidden)s2.focus()}};
  if($("#t-tcmvok"))$("#t-tcmvok").onclick=()=>{const v=$("#t-tcng").value;if(!v){toast("Chọn người làm mới");return}tkTuChoi(t.id,"chuyen",v);toast("Đã chuyển cho "+(userName(v)||""));openTask(t.id);renderMain()};
  if($("#t-tcno"))$("#t-tcno").onclick=()=>{const n=(prompt("Vì sao vẫn cần làm? (nhân sự sẽ nhận được)")||"").trim();tkTuChoi(t.id,"khong",n);toast("Đã báo nhân sự vẫn làm");openTask(t.id);renderMain()};
  $("#drawer").querySelectorAll("[data-tkq]").forEach(b=>b.onclick=()=>{tkSetSt(t.id,b.dataset.tkq);toast("Đã chuyển: "+cvStN(b.dataset.tkq));openTask(t.id);renderMain()});
  if($("#t-pin"))$("#t-pin").onclick=()=>{tkPinToggle(t.id);openTask(t.id);renderMain()};
  if(t)tkBindChat(t);
  if($("#t-lap")){const lw=()=>{const k=$("#t-lap").value;$("#t-lapdw").hidden=!k||k==="ngay";$("#t-lapd").innerHTML=k==="tuan"?opt(THU.map((x,i)=>[i+1,x==="CN"?"Chủ nhật":"Thứ "+(i+2)]),(new Date().getDay()+6)%7+1):opt(Array.from({length:28},(_,i)=>[i+1,"Ngày "+(i+1)]),Math.min(28,new Date().getDate()))};$("#t-lap").onchange=lw;lw()}
  $("#drawer").querySelectorAll("[data-cwhan]").forEach(b=>b.onclick=()=>{const n=cwHanDay(b.dataset.cwhan),h=$("#t-han");if(!h||h.disabled)return;h.value=n?tkIso(n):"";if(!n&&$("#t-gio"))$("#t-gio").value="";cwHanOn()});
  if($("#t-han"))$("#t-han").addEventListener("change",cwHanOn);cwHanOn();
  if(!t&&$("#t-ten"))$("#t-ten").addEventListener("input",()=>{const g=$("#t-gapn");if(g)g.hidden=!cwGapT($("#t-ten").value)});
  if(!t&&$("#t-team")&&$("#t-v2"))$("#t-team").addEventListener("change",()=>{$("#t-v2").checked=$("#t-team").value!=="content"});
  if($("#t-tpl"))$("#t-tpl").onchange=()=>{const p=tkTpls().find(x=>x.id===$("#t-tpl").value);if(!p)return;$("#t-ten").value=p.ten;$("#t-mo").value=p.moTa||"";if($("#t-team"))$("#t-team").value=p.team||$("#t-team").value;if($("#t-ng"))$("#t-ng").value=p.nguoi||"";if($("#t-uu"))$("#t-uu").value=p.uu||"Trung bình";$("#t-han").value=tkIso(D().settings.today+(+p.hanSau||2));
    (p.checklist||[]).forEach(c=>{ck.push({t:c.t,x:false});$("#t-ck").insertAdjacentHTML("beforeend",`<label class="ck"><input type="checkbox" data-ck="${ck.length-1}"> ${esc(c.t)}</label>`)});toast("Đã điền từ mẫu, xem lại rồi bấm Giao việc")};
  if($("#t-nop"))$("#t-nop").onclick=()=>{const note=$("#t-kqn").value.trim(),link=$("#t-kql").value.trim();if(!note&&!link&&!kqF.length){toast("Ghi kết quả, dán link hoặc thêm file");return}
    const k=tkDoneErr(t)?"review":"done";tkSetSt(t.id,k,{kqNote:note,kq:link,kqFiles:kqF.slice(),nopAt:new Date().toLocaleString("vi-VN"),nopBy:ME.name,tlNote:"",__chat:["nop",[note,link].filter(Boolean).join(" · ")]},"Nộp kết quả");
    toast(k==="review"?"Đã nộp, chờ "+tkMgrNames(t)+" duyệt":"Đã nộp, việc xong");openTask(t.id);renderMain()};
  const stSave=(k,extra)=>{tkSetSt(t.id,k,extra);toast("Đã chuyển: "+cvStN(k))};
  $("#tkf2").querySelectorAll("[data-tkst]").forEach(b=>b.onclick=()=>{const k=b.dataset.tkst;
    if(t&&k==="done"){const er=tkDoneErr(t);if(er){toast(er);return}}
    $("#t-st").value=k;$("#tkf2").querySelectorAll("[data-tkst]").forEach(x=>{const on=x.dataset.tkst===k;x.classList.toggle("on",on);x.textContent=(on?"✓ ":"")+cvStN(x.dataset.tkst)});
    if(t&&ed){stSave(k,k==="done"&&t.treReq&&t.treReq.st==="cho"?{treReq:Object.assign({},t.treReq,{st:"ok",xl:ME.name})}:null);openTask(t.id)}});
  const now=()=>new Date().toLocaleString("vi-VN");
  if($("#t-trego"))$("#t-trego").onclick=()=>{const v=$("#t-tre").value.trim();if(!v){toast("Ghi lý do trễ");return}
    DB.mutate(ME.name,`lý do trễ "${t.ten}"`,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;const hm=$("#t-hm")?tkDay($("#t-hm").value):0,lt=x.han<dt.settings.today;tkLog(x,(lt?"Báo trễ":"Xin gia hạn")+": "+v.slice(0,120)+(hm?" · xin đến "+dd(hm):""));x.treReq={lyDo:v,at:now(),by:ME.name,st:"cho",hanMoi:hm};x.tre={lyDo:v,at:now(),by:ME.name};if(typeof notifyU==="function")notifyU(dt,[x.tao,...tkMgrIds(x)],`${lt?"⚠ "+ME.name+" báo trễ":ME.name+" xin gia hạn"} việc "${x.ten}"${hm?" đến "+dd(hm):""}: ${v.slice(0,100)}`,"task:"+x.id)});toast("Đã gửi quản lý");openTask(t.id)};
  if($("#t-duyet"))$("#t-duyet").onclick=()=>{const n=($("#t-tl")||{}).value;if(n&&n.trim())tkComment(t.id,n.trim());const r2=tkApprove(t.id);toast(r2?"Đã duyệt vòng 1, chuyển CEO duyệt":"Đã duyệt hoàn thành");openTask(t.id);renderMain()};
  if($("#t-tlok"))$("#t-tlok").onclick=()=>{const n=$("#t-tl").value.trim();if(!n){toast("Ghi cần sửa gì để người làm biết");return}tkReturn(t.id,n);toast("Đã trả lại cho "+(userName(t.nguoi)||"người làm"));openTask(t.id);renderMain()};
  if($("#t-selfgh"))$("#t-selfgh").onclick=()=>{const v=($("#t-tre").value||"").trim(),h=tkDay($("#t-gh").value);if(!v){toast("Nhập lý do gia hạn");return}if(!h){toast("Chọn ngày gia hạn");return}
    DB.mutate(ME.name,`tự gia hạn "${t.ten}" đến ${dd(h)}`,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;x.hanCu=x.hanCu||x.han;tkLog(x,"Tự gia hạn đến "+dd(h)+": "+v.slice(0,160));x.han=h;x.treReq={st:"giahan",tu:true,lyDo:v,by:ME.name,at:now(),xl:ME.name,xlAt:now(),hanMoi:h}});toast("Đã gia hạn đến "+dd(h));openTask(t.id);renderMain()};
  if($("#t-ghok"))$("#t-ghok").onclick=()=>{const h=tkDay($("#t-gh").value);if(!h){toast("Chọn ngày gia hạn");return}DB.mutate(ME.name,`gia hạn "${t.ten}" đến ${dd(h)}`,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;x.hanCu=x.hanCu||x.han;tkLog(x,"Gia hạn đến "+dd(h));x.han=h;x.treReq=Object.assign({},x.treReq||{},{st:"giahan",xl:ME.name,xlAt:now(),hanMoi:h});if(typeof notifyU==="function")notifyU(dt,[x.nguoi],`${ME.name} gia hạn việc "${x.ten}" đến ${dayLbl(h)}`,"task:"+x.id)});toast("Đã gia hạn đến "+dd(h));openTask(t.id);renderMain()};
  if($("#t-dok"))$("#t-dok").onclick=()=>{DB.mutate(ME.name,`duyệt hoàn thành "${t.ten}" (trễ hạn)`,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;tkLog(x,"Duyệt hoàn thành");x.stTruoc=x.st;x.st="done";tkDoneDay(x,dt.settings.today);x.stAt=now();x.stBy=ME.name;x.treReq=Object.assign({},x.treReq||{},{st:"ok",xl:ME.name,xlAt:now()});if(typeof notifyU==="function")notifyU(dt,[x.nguoi],`${ME.name} duyệt hoàn thành việc "${x.ten}"`,"task:"+x.id);cwTdNotify(dt,x,`${ME.name} duyệt hoàn thành việc "${x.ten}"`)});toast("Đã duyệt hoàn thành");closeDrawer();renderMain()};
  $("#tkf2").onsubmit=e=>{e.preventDefault();$("#tkf2").querySelectorAll("[data-ck]").forEach(x=>{if(ck[+x.dataset.ck])ck[+x.dataset.ck].x=x.checked});
    const v={ten:$("#t-ten").value,moTa:$("#t-mo").value,team:$("#t-team").value,da:$("#t-da").value,nguoi:$("#t-ng").value,han:tkDay($("#t-han").value),gio:$("#t-gio")?$("#t-gio").value:"",uu:$("#t-uu").value,bd:$("#t-bd")?tkDay($("#t-bd").value):0,st:$("#t-st").value,phoi:[...document.querySelectorAll("[name=t-phoi]:checked")].map(x=>x.value),theoDoi:[...document.querySelectorAll("[name=t-td]:checked")].map(x=>x.value),checklist:ck,kq:t?(t.kq||""):"",dk:$("#t-dk")?$("#t-dk").value.trim():""};const trv=$("#t-tre")&&$("#t-tre").value.trim();if(trv&&(!t.tre||t.tre.lyDo!==trv))v.tre={lyDo:trv,at:new Date().toLocaleString("vi-VN"),by:ME.name};
    v.cd=cd.map(s=>Object.assign({},s));v.tuanTu=!$("#t-seq")||$("#t-seq").checked;if($("#t-v2")){if(v.team==="content")v.v2ceo=$("#t-v2").checked;else v.v2=$("#t-v2").checked}
    if(v.cd.some(s=>!s.nguoi||!String(s.ten).trim()||(s.phan||[]).some(p=>!p.nguoi))){toast("Mỗi công đoạn cần có tên và người làm");return}
    /* để trống ngày (hoặc bấm "Chưa có hạn") = việc chưa có hạn, nằm ở tab Chưa có hạn */
    if(!v.han)v.gio="";
    if(!t)v.gap=cwGapT(v.ten);else if(gv&&t.gap===undefined&&cwGapT(v.ten))v.gap=true;
    if(!giver)v.nguoi=t?t.nguoi:ME.id;
    if(!t&&v.st==="done"&&v.nguoi!==ME.id)v.st="todo";
    const nid=uid("cv"),oldNg=t?t.nguoi:"",oldPhoi=t?(t.phoi||[]):[],oldTd=t?(t.theoDoi||[]):[],oldHan=t?t.han:0;
    DB.mutate(ME.name,(t?"cập nhật việc: ":"giao việc: ")+v.ten+(v.nguoi?" → "+userName(v.nguoi):""),dt=>{let x;if(t){x=dt.tasks.find(y=>y.id===t.id);Object.assign(x,gv?v:{st:v.st,checklist:v.checklist,kq:v.kq,...(v.tre?{tre:v.tre}:{})})}else{x={id:nid,...v,files:bf,loai:"Việc",tao:ME.id};dt.tasks.push(x)}
      if(x.cd&&x.cd.length){tkSync(x);v.nguoi=x.nguoi;v.han=x.han;v.phoi=x.phoi}
      tkDoneDay(x,dt.settings.today);
      /* đổi người làm khi việc đang có đơn xin từ chối: coi như đã chuyển người, khung xin từ chối không hiện nữa */
      if(t&&x.tuChoi&&x.tuChoi.st==="cho"&&oldNg!==x.nguoi){x.tuChoi=Object.assign({},x.tuChoi,{st:"chuyen",sang:x.nguoi,duyet:ME.name,duyetAt:new Date().toLocaleString("vi-VN")})}
      tkLog(x,t?("Sửa việc"+(oldNg!==x.nguoi?" · người làm: "+(userName(oldNg)||"—")+" → "+(userName(x.nguoi)||"—"):"")+(oldHan&&oldHan!==x.han?" · hạn: "+dd(oldHan)+" → "+dd(x.han):"")):("Giao việc"+(x.nguoi?" cho "+userName(x.nguoi):"")+(x.han?" · hạn "+dd(x.han):"")));
      if(typeof notifyU==="function"&&gv){const ds=v.han?` · hạn ${dd(v.han)}`:"";const nw=[];if(v.nguoi&&v.nguoi!==oldNg)nw.push(v.nguoi);v.phoi.filter(p=>!oldPhoi.includes(p)).forEach(p=>nw.push(p));if(nw.length)notifyU(dt,nw,`${ME.name} giao bạn việc "${v.ten}"${ds}`,"task:"+x.id);else if(t&&t.han!==v.han&&v.nguoi)notifyU(dt,[v.nguoi],`${ME.name} đổi hạn việc "${v.ten}" thành ${dd(v.han)}`,"task:"+x.id);
        const nTd=(v.theoDoi||[]).filter(p=>!oldTd.includes(p)&&p!==v.nguoi&&!v.phoi.includes(p));if(nTd.length)notifyU(dt,nTd,`${ME.name} thêm bạn theo dõi việc "${v.ten}"${ds}`,"task:"+x.id)}});if(!t&&$("#t-lap")&&($("#t-lap").value||$("#t-tplsave").checked))tkTplSave(v,$("#t-lap").value,+$("#t-lapd").value||0);
    if(!t&&TK_AFTER_NEW){const f=TK_AFTER_NEW;TK_AFTER_NEW=null;try{f(nid)}catch(e){}}
    toast(t?"Đã lưu":"Đã giao"+(!t&&$("#t-lap")&&$("#t-lap").value?", web sẽ tự giao lại "+({ngay:"hằng ngày",tuan:"mỗi tuần",thang:"mỗi tháng"}[$("#t-lap").value]||""):""));closeDrawer();renderMain()};
  if($("#t-del"))$("#t-del").onclick=()=>{if(!confirm("Xóa việc này?"))return;DB.mutate(ME.name,"xóa việc "+t.ten,dt=>dt.tasks=dt.tasks.filter(x=>x.id!==t.id));closeDrawer();renderMain()};
  try{tkFormRow()}catch(e){console.error("bố cục form giao việc",e)}
  if(t)try{tkLayout(t,gv)}catch(e){console.error("bố cục chi tiết việc",e)}
}
/* Từ chối việc: người duyệt là người giao (CEO / Lead cũng duyệt được). Đồng ý thì việc chuyển sang lưu trữ (dt.tasksHuy), không tính vào số liệu. */
/* mở lại việc đã hoàn thành (bấm nhầm): người giao, người duyệt, CEO; việc tự thêm thì chính người làm */
/* đưa việc chưa nộp mà đang nằm ở Chờ duyệt về lại Cần làm, báo người làm */
function tkBackTodo(t){if(!confirm("Trả việc \""+t.ten+"\" về Cần làm?"))return;
  DB.mutate(ME.name,"trả về Cần làm: "+t.ten,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;x.st="todo";x.vong=0;x.stAt=new Date().toLocaleString("vi-VN");x.stBy=ME.name;tkLog(x,"Trả về Cần làm (chưa nộp kết quả)");if(typeof notifyU==="function"&&x.nguoi!==ME.id)notifyU(dt,[x.nguoi],`${ME.name}: việc "${x.ten}" vẫn cần làm`,"task:"+x.id)});
  toast("Đã trả về Cần làm");if(typeof closeDrawer==="function")closeDrawer();renderMain()}
const tkReopenTo=t=>t.stTruoc&&t.stTruoc!=="done"?t.stTruoc:((t.nopAt||t.kq||t.kqNote)?"review":"todo");
const tkReopenOk=t=>!!ME&&t.st==="done"&&(ME.role==="admin"||t.tao===ME.id||t.duyet===ME.id||tkMgr(t)||(t.nguoi===ME.id&&t.tao===ME.id));
const tkTcCan=t=>!!ME&&ME.id!==t.nguoi&&(t.tao===ME.id||ME.role==="admin"||(typeof tkLeadOf==="function"&&(tkLeadOf(t)||{}).id===ME.id));
function tkTuChoi(id,act,txt){const t0=D().tasks.find(x=>x.id===id);if(!t0)return;
  DB.mutate(ME.name,(act==="gui"?"xin từ chối việc: ":act==="ok"?"hủy việc (đồng ý từ chối): ":act==="chuyen"?"chuyển người làm (sau xin từ chối): ":"không đồng ý từ chối việc: ")+t0.ten,dt=>{const i=dt.tasks.findIndex(y=>y.id===id);if(i<0)return;const x=dt.tasks[i],now=new Date().toLocaleString("vi-VN"),ref="task:"+x.id,N=(ids,m)=>{if(typeof notifyU==="function")notifyU(dt,ids,m,ref)};
    if(act==="gui"){x.tuChoi={by:ME.id,lyDo:txt,at:now,st:"cho"};tkLog(x,ME.name+" xin từ chối: "+txt);const to=[x.tao,(tkLeadOf(x)||{}).id].filter(Boolean);N(to,`${ME.name} xin từ chối việc "${x.ten}": ${txt}`)}
    else if(act==="chuyen"){const cu=x.nguoi;x.tuChoi=Object.assign({},x.tuChoi,{st:"chuyen",duyet:ME.name,duyetAt:now,sang:txt});x.nguoi=txt;if(["nop","review","done"].includes(x.st)===false)x.st="todo";x.phoi=(x.phoi||[]).filter(p=>p!==txt);
      tkLog(x,ME.name+" chuyển việc từ "+(userName(cu)||"—")+" sang "+(userName(txt)||"—")+" (sau xin từ chối)");N([cu],`${ME.name} đồng ý, việc "${x.ten}" đã chuyển cho ${userName(txt)||"người khác"}`);N([txt],`${ME.name} giao bạn việc "${x.ten}"${x.han?" · hạn "+dd(x.han):""}`)}
    else if(act==="ok"){x.tuChoi=Object.assign({},x.tuChoi,{st:"ok",duyet:ME.name,duyetAt:now});tkLog(x,ME.name+" đồng ý từ chối, việc được bỏ");N([x.nguoi,...(x.phoi||[])],`${ME.name} đồng ý: việc "${x.ten}" không cần làm nữa`);
      dt.tasksHuy=(dt.tasksHuy||[]).concat(Object.assign({},x,{huyAt:now})).slice(-300);dt.tasks.splice(i,1)}
    else{x.tuChoi=Object.assign({},x.tuChoi,{st:"khong",note:txt||"",duyet:ME.name,duyetAt:now});tkLog(x,ME.name+" không đồng ý từ chối"+(txt?": "+txt:""));N([x.nguoi],`${ME.name} không đồng ý từ chối, việc "${x.ten}" vẫn cần làm${txt?": "+txt:""}`)}})}
/* Form giao việc gọn (chị Hoa 03/11): "Người cùng làm / hỗ trợ" thành ô bấm sổ ra, chọn nhiều người;
   ô đó và "Lặp lại" lên cùng hàng với Team, Dự án. Chỉ dời chỗ, giữ nguyên ô nhập đã gắn việc. */
function tkFormRow(){const team=$("#t-team"),row=team&&team.closest(".row4"),ph=$("#t-phw");if(!row)return;row.classList.add("tkrow4");
  /* link + ảnh / file gộp một dòng "Tư liệu đính kèm", ngay dưới Mô tả (chị Hoa 04/11) */
  {const dk=$("#t-dk"),dkF=dk&&dk.closest("label.field"),bfl=$("#t-bfl"),bfF=bfl&&bfl.closest(".field"),up=bfF&&bfF.querySelector("label.tkup"),mo=$("#t-mo"),moF=mo&&mo.closest("label.field");
    if(dk&&bfl&&moF&&!$(".tkatt")){const f=document.createElement("div");f.className="field tkatt";f.innerHTML=`Tư liệu đính kèm <small class="hint">(link Drive, ảnh hoặc file ≤ 1,5 MB · không bắt buộc)</small>`;
      const line=document.createElement("div");line.className="tkattl";dk.placeholder="Dán link Drive, brief…";line.appendChild(dk);if(up)line.appendChild(up);f.append(line,bfl);moF.after(f);if(dkF)dkF.remove();if(bfF)bfF.remove()}}
  const mkDd=(w,lbl)=>{const box=w.querySelector(".phc");if(!box)return;
    const dd=document.createElement("details");dd.className="tkdd";const sm=document.createElement("summary");dd.append(sm,box);
    const upd=()=>{const L=[...box.querySelectorAll("input:checked")].map(i=>i.closest("label").textContent.trim());sm.textContent=L.length?L.join(", "):"— chọn người";sm.title=sm.textContent};upd();box.addEventListener("change",upd);
    w.innerHTML=lbl;w.appendChild(dd);document.addEventListener("click",e=>{if(dd.open&&!dd.contains(e.target))dd.open=false})};
  if(ph&&!ph.querySelector(".tkdd")){mkDd(ph,'Người cùng làm / hỗ trợ');row.appendChild(ph)}
  {const td=$("#t-tdw");if(td&&!td.querySelector(".tkdd"))mkDd(td,'Người theo dõi <small class="hint">· được báo khi việc đổi trạng thái, không tính là việc của mình</small>')}
  /* "Lặp lại" ngang hàng "Công đoạn", ở góc phải (chị Hoa 03/11) */
  const lap=$("#t-lap"),lapRow=lap&&lap.closest(".tklap"),cdw=$("#t-cdw");if(lapRow){const cell=document.createElement("div");cell.className="field tklapc";cell.append(...lapRow.childNodes);
    if(cdw){const w=document.createElement("div");w.className="tkcdrow";cdw.before(w);w.append(cdw,cell)}else row.appendChild(cell);lapRow.remove()}}
/* Bố cục khung Chi tiết việc (chị Hoa 03/11): nội dung việc lên đầu (tên, người giao / làm, hạn, mô tả, link, file);
   góc phải đầu khung có nút 💬 Trao đổi và ⏰ Xin gia hạn (bấm mới mở); các ô sửa thông tin gom vào "Sửa thông tin việc".
   Chỉ dời chỗ các phần đã vẽ (giữ nguyên ô nhập và nút đã gắn việc) nên mọi thao tác cũ vẫn chạy. */
function tkLayout(t,gv){const di=$("#drawerIn");if(!di)return;const h2=di.querySelector("h2"),td=D().settings.today,late=t.st!=="done"&&t.han&&t.han<td;
  const link=u=>/^https?:\/\//.test(u)?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.length>70?u.slice(0,70)+"…":u)}</a>`:esc(u);
  const ppl=[t.nguoi].concat(t.phoi||[]).filter(Boolean).map(userName).filter(Boolean);
  const brief=document.createElement("div");brief.className="tkbrief";
  brief.innerHTML=`<div class="tkbt">${esc(t.ten)}</div>
   <div class="tkbm"><span><small>Người giao</small>${esc(userName(t.tao)||"—")}</span><span><small>Người làm</small>${esc(ppl.join(", ")||"chưa giao")}</span><span class="${late?"t-red":""}"><small>Hạn</small>${t.han?dd(t.han)+(t.gio?" · "+t.gio:"")+(late?` · trễ ${td-t.han} ngày`:""):"—"}</span><span><small>Ưu tiên</small>${t.gap?'<b class="t-red">GẤP</b> · ':""}${esc(t.uu||"Trung bình")}</span>${(t.theoDoi||[]).length?`<span><small>Người theo dõi</small>${esc((t.theoDoi||[]).map(userName).filter(Boolean).join(", "))}</span>`:""}${t.da?`<span><small>Dự án</small>${esc(prjN(t.da))}</span>`:""}</div>
   ${t.moTa?`<div class="tkbd">${esc(t.moTa).replace(/https?:\/\/[^\s<]+/g,u=>`<a href="${u}" target="_blank" rel="noopener">${u}</a>`).replace(/\n/g,"<br>")}</div>`:`<div class="tkbd hint">Chưa có mô tả / yêu cầu.</div>`}
   ${t.dk||(t.files||[]).length?`<div class="tkbl">📎 ${t.dk?link(t.dk):""}${typeof tkFilesHtml==="function"?tkFilesHtml(t.files||[]):""}</div>`:""}
   ${(t.checklist||[]).length?`<div class="tkbc hint">Việc nhỏ: ${(t.checklist||[]).filter(c=>c.x).length}/${(t.checklist||[]).length} đã xong</div>`:""}`;
  /* nút góc phải */
  const chat=di.querySelector(".tkchat"),lateBox=di.querySelector(".tklate"),nChat=(t.chat||[]).length;
  const tools=document.createElement("span");tools.className="tktools";
  if(chat)tools.insertAdjacentHTML("beforeend",`<button type="button" class="btn sm" id="tk-chatbtn" title="Trao đổi về việc này">💬 Trao đổi${nChat?` <b>${nChat}</b>`:""}</button>`);
  if(lateBox)tools.insertAdjacentHTML("beforeend",`<button type="button" class="btn sm${late?" danger":""}" id="tk-ghbtn" title="${late?"Báo lý do trễ / xin gia hạn":"Xin gia hạn"}">⏰ ${late?"Trễ hạn":"Xin gia hạn"}</button>`);
  if(h2){h2.classList.add("tkh2");h2.appendChild(tools);h2.after(brief)}
  di.querySelectorAll("p.hint").forEach(p=>{if(/^Người giao:/.test(p.textContent.trim()))p.remove()});
  {const ok=$("#t-selfok");if(ok)ok.onclick=()=>{DB.mutate(ME.name,"xong việc tự thêm: "+t.ten,dt=>{const x=dt.tasks.find(y=>y.id===t.id);if(!x)return;x.stTruoc=x.st;x.st="done";x.stAt=new Date().toLocaleString("vi-VN");x.stBy=ME.name;tkDoneDay(x,dt.settings.today);tkLog(x,"Xong (việc tự thêm)");cwTdNotify(dt,x,`${ME.name} đã xong việc "${x.ten}"`)});toast("Đã xong");closeDrawer();renderMain()}}
  /* trao đổi, gia hạn: ẩn tới khi bấm (có tin trả lại / đang chờ gia hạn thì mở sẵn) */
  const tra=(t.chat||[]).some(c=>c.kind==="tra")&&t.st!=="done",cho=((t.treReq||{}).st==="cho");
  if(chat){brief.after(chat);chat.hidden=!tra;$("#tk-chatbtn").onclick=()=>{chat.hidden=!chat.hidden;if(!chat.hidden){chat.scrollIntoView({block:"nearest"});const i=$("#t-cm");if(i)i.focus()}}}
  if(lateBox){brief.after(lateBox);lateBox.hidden=!(late||cho);$("#tk-ghbtn").onclick=()=>{lateBox.hidden=!lateBox.hidden;if(!lateBox.hidden)lateBox.scrollIntoView({block:"nearest"})}}
  /* các ô thông tin việc: gom vào mục thu gọn (người giao mở để sửa; người làm chỉ xem, đã có ở phần đầu) */
  const f=$("#tkf2");if(!f)return;const pick=sel=>{const e=f.querySelector(sel);return e&&(e.closest(".row4")||e.closest("label.field")||e.closest(".field")||e.closest("label.ck"))};
  const parts=["#t-ten","#t-mo","#t-team","#t-ng","#t-v2","#t-phw","#t-tdw","#t-dk","#t-bfl"].map(pick).filter((e,i,a)=>e&&a.indexOf(e)===i);
  if(!parts.length)return;const dt=document.createElement("details");dt.className="tkedit";dt.innerHTML=`<summary>${gv?"✎ Sửa thông tin việc":"Thông tin chi tiết"}</summary>`;
  parts.forEach(e=>dt.appendChild(e));f.prepend(dt)}
const CW_HAN=[["td","Hôm nay"],["mai","Mai"],["cn","Cuối tuần"],["ct","Cuối tháng"],["no","Chưa có hạn"]];
function cwHanDay(k){const td=D().settings.today,wd=((MONTH.first+td-1)%7+7)%7;return k==="td"?td:k==="mai"?td+1:k==="cn"?td+(6-wd):k==="ct"?Math.max(td,MONTH.ndays):0}
const cwHanChips=()=>`<span class="cwhc" role="group" aria-label="Chọn nhanh ngày">${CW_HAN.map(([k,l])=>`<button type="button" class="cwhcb" data-cwhan="${k}">${l}</button>`).join("")}</span>`;
function cwHanOn(){const h=$("#t-han");if(!h)return;const n=tkDay(h.value);document.querySelectorAll("#drawer [data-cwhan]").forEach(b=>b.classList.toggle("on",cwHanDay(b.dataset.cwhan)===n))}
const newTaskBtn=()=>`<button class="btn pri" id="cv-new">${tkGiver()?"＋ Giao việc":"＋ Thêm việc"}</button>`;
/* Nhân sự tự thêm việc cho mình (chị Hoa 03/11): một dòng ở đầu "Của tôi", gõ tên + hạn, Enter là thêm */
const tkSelfHtml=()=>`<form class="tkself" id="tk-self"><span>＋</span><input id="tks-ten" placeholder="Thêm việc của tôi… (Enter để thêm)" autocomplete="off"><label>Hạn${tkDate("tks-han",D().settings.today)}</label><select id="tks-uu" aria-label="Ưu tiên">${opt(UU,"Trung bình")}</select><button class="btn sm pri">Thêm</button></form>`;
function tkSelfBind(b){const f=b.querySelector("#tk-self");if(!f)return;f.onsubmit=e=>{e.preventDefault();const ten=$("#tks-ten").value.trim();if(!ten){$("#tks-ten").focus();return}
  const han=tkDay($("#tks-han").value)||D().settings.today,id=uid("cv"),team=TEAMS[teamOf(ME)]?teamOf(ME):((typeof KPB_TEAM!=="undefined"&&KPB_TEAM[ME.phongBan])||"chung");
  DB.mutate(ME.name,"tự thêm việc: "+ten,dt=>{const x={id,ten,moTa:"",team,da:"",nguoi:ME.id,phoi:[],han,bd:0,uu:$("#tks-uu").value,gap:cwGapT(ten),st:"todo",checklist:[],files:[],loai:"Việc",tao:ME.id,tuThem:true,v2:false,log:[]};tkLog(x,ME.name+" tự thêm việc cho mình · hạn "+dd(han));dt.tasks.push(x)});
  toast("Đã thêm việc");renderMain();setTimeout(()=>{const i=$("#tks-ten");if(i)i.focus()},50)}}
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
/* Tiến độ dự án video theo giai đoạn (chị Hoa 02/11): đọc thẳng thẻ video ở Điều phối (Lead Content chia việc ở đó), không chỗ phân việc thứ hai.
   Mỗi giai đoạn: đã qua bao nhiêu / tổng số video của dự án, đang nằm ở đây bao nhiêu, ai đang giữ. Bấm một giai đoạn để xem từng video. */
const PJ_GD=[["kb","Kịch bản / hook",["cg","kb","dkb"]],["quay","Quay",["quay"]],["edit","Edit",["edit","worker"]],["duyet","Duyệt video",["dvd","dceo"]],["dang","Đăng",["dang","xong"]]];
const pjGdOf=c=>PJ_GD.findIndex(g=>g[2].includes(c.step));
const pjHolder=c=>c.step==="kb"?(c.nguoiKB||c.nguoi):c.step==="edit"?(c.nguoiEdit||c.nguoi):c.step==="quay"?c.nguoi:c.step==="dang"?(((D().kenhPT||{})[c.kenh]||{}).chinh||""):"";
const pjHolderLbl=c=>c.step==="cg"?"Chưa giao":c.step==="dkb"||c.step==="dvd"?"Lead Content duyệt":c.step==="dceo"?"Duyệt V2":c.step==="worker"?"Máy đang dựng":userName(pjHolder(c))||"—";
const pjCards=p=>D().cards.filter(c=>c.step!=="huy"&&cardProject(c)===p.id);
function pjStageHtml(p){const C=pjCards(p),N=C.length;if(!N)return "";
  return `<div class="pjgd"><div class="pjgdh">Tiến độ video <small>· ${N} video</small></div>${PJ_GD.map(([k,t],i)=>{const here=C.filter(c=>pjGdOf(c)===i&&c.step!=="xong"&&c.step!=="cg"),past=C.filter(c=>pjGdOf(c)>i||c.step==="xong").length,
    who=[...new Set(here.map(pjHolder).filter(Boolean))],late=here.filter(c=>typeof isLate==="function"&&isLate(c)).length,pc=Math.round(past/N*100);
    return `<button type="button" class="pjs${late?" late":""}" data-pjs="${esc(p.id)}|${k}" title="Bấm để xem từng video"><b class="pjs1">${t}</b><i class="pjsb"><i style="width:${pc}%"></i></i><span class="pjs2"><b>${past}</b>/${N}</span><span class="pjs3">${here.length?`${here.length} đang làm${late?` · <em>${late} trễ</em>`:""} ${who.slice(0,3).map(avatar).join("")}`:""}</span></button>`}).join("")}</div>`}
function pjStageOpen(pid,k){const p=(D().projects||[]).find(x=>x.id===pid);if(!p)return;const i=PJ_GD.findIndex(g=>g[0]===k),C=pjCards(p).filter(c=>pjGdOf(c)===i).sort((a,b)=>(a.han||99)-(b.han||99));
  openDrawerHTML(`<h2>${esc(p.ten)} · ${PJ_GD[i][1]}</h2><p class="hint">${C.length} video đang ở giai đoạn này. Chia lại việc, đổi hạn ở Điều phối (bấm từng video để mở thẻ).</p>
   ${C.length?tbl(["Video","Bước","Đang giữ","Hạn"],C.map(c=>`<tr class="clk" data-pjc="${esc(c.id)}"><td><b>${esc(cvShort(c.hookText||c.yTuong||c.tuyen||c.id,60))}</b><small>${esc(c.id)} · ${esc(chOf(c.kenh).short||"")} · ${esc(sk(c.sku).n)}</small></td><td>${esc((STEPS.find(s=>s.id===c.step)||{}).t||c.step)}</td><td>${esc(pjHolderLbl(c))}</td><td class="${c.step!=="xong"&&isLate(c)?"t-red":""}">${c.han?dd(c.han):"—"}</td></tr>`)):`<p class="empty">Không có video nào ở giai đoạn này.</p>`}`);
  $("#drawerIn").querySelectorAll("[data-pjc]").forEach(r=>r.onclick=()=>openCard(r.dataset.pjc))}
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
    ${pjStageHtml(p)}
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
  m.querySelectorAll("[data-pjs]").forEach(b=>b.onclick=()=>{const [id,k]=b.dataset.pjs.split("|");pjStageOpen(id,k)});
}
function prjSave(id,v){
  DB.mutate(ME.name,(id?"sửa dự án ":"thêm dự án ")+v.ten,dt=>{dt.projects=dt.projects||[];
    if(id){const p=dt.projects.find(x=>x.id===id);if(!p)return;Object.assign(p,v)}
    else{const n=dt.projects.reduce((z,p)=>Math.max(z,+String(p.id).replace(/\D/g,"")||0),0)+1;
      dt.projects.push(Object.assign({id:"DA-"+String(n).padStart(2,"0"),moTa:"",uu:"Trung bình",tv:[],batDau:0,loc:{none:true,kenh:["__"]}},v));
      if(typeof notifyU==="function")notifyU(dt,[v.owner,...(v.tv||[])],`${ME.name} thêm bạn vào dự án "${v.ten}"`,"page:cv_da")}});
}
/* sản phẩm / kênh chọn trong form dự án → p.loc; dự án cũ đã có bộ lọc riêng (tuyến, ngày…) mà không chọn gì thì giữ nguyên */
function pjLocForm(p){const sku=[...document.querySelectorAll("[name=pf-sku]:checked")].map(x=>x.value),kenh=[...document.querySelectorAll("[name=pf-kenh]:checked")].map(x=>x.value);
  if(sku.length)return {loc:Object.assign({sku},kenh.length?{kenh}:{})};
  if(p&&p.loc&&!p.loc.none&&!p.loc.sku)return kenh.length?{loc:Object.assign({},p.loc,{kenh})}:{};
  return {loc:kenh.length?{kenh}:{none:true,kenh:["__"]}}}
function openProject(id){
  const d=D(),p=id?(d.projects||[]).find(x=>x.id===id):null,users=d.users.filter(u=>u.active&&u.role!=="admin"||u.id===ME.id),days=Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]);
  openDrawerHTML(`<h2>${p?"Sửa dự án":"Thêm dự án"}</h2><form class="frm" id="pjf2"><label class="field">Tên dự án<input id="pf-t" required value="${esc(p?p.ten:"")}"></label><label class="field">Mô tả<textarea id="pf-m" rows="2">${esc(p?p.moTa||"":"")}</textarea></label>
   <div class="row4"><label class="field">Team<select id="pf-team">${opt(Object.entries(TEAMS),p?p.team:"content")}</select></label><label class="field">Phụ trách<select id="pf-o">${opt(users.map(u=>[u.id,u.name]),p?p.owner:ME.id)}</select></label></div>
   <div class="row4"><label class="field">Bắt đầu<select id="pf-b">${opt([[0,"—"]].concat(days),p?p.batDau||0:0)}</select></label><label class="field">Hạn<select id="pf-h">${opt(days,p?p.han:MONTH.ndays)}</select></label><label class="field">Ưu tiên<select id="pf-u">${opt(UU,p?p.uu||"Trung bình":"Trung bình")}</select></label></div>
   <div class="field">Video của dự án <small class="hint">(lấy theo sản phẩm, kênh)</small>
    <div class="phc">${prods().map(s=>`<label class="ck sm"><input type="checkbox" name="pf-sku" value="${esc(s.k)}" ${p&&p.loc&&(p.loc.sku||[]).includes(s.k)?"checked":""}> ${esc(s.n)}</label>`).join("")}</div>
    <div class="phc">${CHANNELS.map(ch=>`<label class="ck sm"><input type="checkbox" name="pf-kenh" value="${esc(ch.k)}" ${p&&p.loc&&!p.loc.none&&(p.loc.kenh||[]).includes(ch.k)?"checked":""}> ${esc(ch.short||ch.k)}</label>`).join("")}</div></div>
   <div class="field">Phòng tham gia <small class="hint">(dự án liên phòng: các phòng này cùng thấy dự án, nhóm chat dự án và thư mục dự án)</small><div class="phc">${Object.entries(TEAMS).filter(([k])=>k!=="chung").map(([k,n])=>`<label class="ck sm"><input type="checkbox" name="pf-teams" value="${k}" ${p&&(p.teams||[]).includes(k)?"checked":""}> ${esc(n)}</label>`).join("")}</div></div>
   <label class="field">Thư mục Drive của dự án <small class="hint">(dán link thư mục, không bắt buộc)</small><input id="pf-drive" placeholder="https://drive.google.com/drive/folders/…" value="${esc(p&&p.drive||"")}"></label>
   <div class="field">Thành viên<div class="phc">${users.map(u=>`<label class="ck sm"><input type="checkbox" name="pf-tv" value="${u.id}" ${p&&(p.tv||[]).includes(u.id)?"checked":""}> ${esc(u.name)}</label>`).join("")}</div></div>
   <div class="acts"><button class="btn pri">${p?"Lưu":"Thêm dự án"}</button>${p&&ME.role==="admin"?`<button type="button" class="btn danger" id="pf-del">Xóa</button>`:""}</div></form>`);
  $("#pjf2").onsubmit=e=>{e.preventDefault();prjSave(id,{ten:$("#pf-t").value.trim(),moTa:$("#pf-m").value,team:$("#pf-team").value,owner:$("#pf-o").value,batDau:+$("#pf-b").value||0,han:+$("#pf-h").value,uu:$("#pf-u").value,tv:[...document.querySelectorAll("[name=pf-tv]:checked")].map(x=>x.value),teams:[...document.querySelectorAll("[name=pf-teams]:checked")].map(x=>x.value).filter(k=>k!==$("#pf-team").value),drive:$("#pf-drive").value.trim(),...pjLocForm(p)});toast(id?"Đã lưu":"Đã thêm dự án");closeDrawer();renderMain()};
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
  d.cards.filter(c=>c.step==="dang"||(c.step==="xong"&&c.dgKey&&+c.ngayDang===td)).forEach(c=>{byId[c.id]=c;const day=+c.day||0;if(c.step==="dang"&&day&&day>td)return;P.push({id:c.id,src:"card",nguoi:cvOwner(c.kenh),phoi:[],team:"content",da:"",uu:"Trung bình",st:"todo",ten:"",mo:"",han:day||td,lateD:day&&day<td?td-day:0,late:!!(day&&day<td)})});
  const map={},out=[];
  (raw?P:cvFilterNoSt(P,false)).forEach(x=>{const c=byId[x.id],xg=c.step==="xong",k=xg?c.dgKey:["dg",c.kenh,+c.day||0].join("|"),day=+String(k).split("|").pop()||0;let g=map[k];
    if(!g){g=map[k]={key:k,kind:"dg",nguoi:x.nguoi,kenh:c.kenh,day,fp:!!c.fpId,han:day||td,ids:[],late:false,lateD:0};out.push(g)}g.ids.push(c.id);if(!xg&&x.late){g.late=true;g.lateD=Math.max(g.lateD,x.lateD||0)}});
  return out.map(g=>{g.n=g.ids.length;g.done=g.ids.filter(id=>byId[id].step==="xong").length;const sh=chOf(g.kenh).short,u=(g.fp||/Fanpage/i.test(g.kenh))?"bài":"video";
    g.ten=(g.day?`Đăng ${sh}: `:`Lên lịch đăng ${sh}: `)+`đã đăng ${g.done}/${g.n} ${u}`;
    g.mo=(g.day?(g.late?`lẽ ra đăng ${dd(g.day)}, trễ ${g.lateD} ngày`:"đăng hôm nay"):"chưa chọn ngày đăng");
    const a=cvAutoSt()[g.key];g.st=a&&a.st==="doing"?"doing":"todo";return g}).filter(g=>g.n-g.done>0)
}
/* việc của lead: tự sinh theo số đang chờ */
function cvLeadLines(){
  /* CEO (chị Hoa 04/11: "cái này của Uyên mà"): giao người, đặt hạn, Lead duyệt, phân công order là việc của Lead; CEO chỉ còn việc CEO duyệt và check video win */
  const d=D(),cs=d.cards,O=d.orders||[],L=[],ceo=ME.role==="admin",add=(t,n,go,lead)=>{if(n>0&&!(ceo&&lead))L.push({ten:t,n,go})};
  if(!(can(ME,"viec.duyet")||ME.role==="admin"||ME.role==="lead"))return L;
  add("Video mới cần duyệt",cs.filter(c=>c.step==="dvd").length,"cv",1);
  add("Kịch bản cần duyệt",cs.filter(c=>c.step==="dkb").length,"cv",1);
  if(ME.role==="admin")add("Video chờ duyệt V2",cs.filter(c=>c.step==="dceo").length,"cv");
  add("Order Digital cần phân công",O.filter(o=>o.trangThai==="Mới"&&!o.giao).length,"order_c",1);
  add("Order Digital cần bàn giao",O.filter(o=>o.trangThai!=="Xong"&&cs.some(c=>c.order===o.ma&&stepIdx(c.step)>=stepIdx("dang")&&!c.bg)).length,"order_c",1);
  try{add("Video win inhouse cần check",hyAnalyses().filter(t=>t.status==="review").length,"win:rank")}catch(e){}
  add("Video win KOC cần check",(d.kocVideos||[]).filter(v=>(+v.don||0)>=(d.settings.potential||30)&&!v.st).length,"win:koc");
  add("Video đã giao nhưng chưa có hạn",cs.filter(c=>c.nguoi&&["kb","quay","edit","worker"].includes(c.step)&&!c.han&&!c.day).length,"dieuphoi",1);
  add("Video chưa giao người làm",cs.filter(c=>c.step==="cg").length,"dieuphoi",1);
  return L
}
/* cảnh báo đỏ: ngày mai kênh cần đăng N video mà mới có M video đã lên lịch cho ngày mai */
function cvWarn(){
  const d=D(),td=d.settings.today,out=[];if(td+1>MONTH.ndays)return out;
  const lead=ME.role==="admin"||ME.role==="lead"||(can(ME,"viec.giao")&&cvTeamSee(teamOf(ME),"content"));
  /* CEO: không phải việc CEO tự làm, chỉ nhắc khi đang xem việc của team / người giữ kênh đó (04/11) */
  const w=ME.role==="admin"?cvWho():"";if(ME.role==="admin"&&!/^[tp]:/.test(w))return out;
  CHANNELS.forEach(ch=>{const own=cvOwner(ch.k);if(!lead&&own!==ME.id)return;
    if(w.startsWith("p:")&&own!==w.slice(2))return;
    if(w.startsWith("t:")){const ou=own&&D().users.find(u=>u.id===own),k=ou?cvTeamNorm(teamOf(ou)):"content";if(k!==w.slice(2))return}
    /* kênh chưa có kế hoạch tháng này (chưa sản phẩm nào có số video, Fanpage chưa có tuyến bài) thì không nhắc thiếu video */
    if(!ptPairs().some(x=>x.kenh===ch.k&&+x.sl>0)&&!(!ch.needId&&(d.fpPlan||[]).some(r=>+r.sl>0)))return;
    let need=0;try{need=calCap(ch.k,td+1)}catch(e){}
    const have=d.cards.filter(c=>c.kenh===ch.k&&c.step==="dang"&&(+c.day||0)===td+1).length;
    if(need>0&&have<need)out.push({short:ch.short,need,have,own})});
  return out
}
function cvOpenMk(g){
  const d=D(),cs=g.ids.map(id=>d.cards.find(c=>c.id===id)).filter(Boolean);
  const href=l=>/^https?:\/\//.test(l)?l:"https://"+l,fb=c=>`<input data-vfb="${c.id}" placeholder="Góp ý / cần sửa gì"><button type="button" class="btn sm" data-vtra="${c.id}">Cần sửa</button>`;
  const act=c=>{const st=c.step,lk=c.linkFinal||c.linkVideo||"";
    if(["edit","worker"].includes(st)&&canMove(ME,c,"dvd"))return `<input data-vl="${c.id}" placeholder="Dán link video đã edit (Drive)" value="${esc(lk)}">${!c.fpId&&chOf(c.kenh).needId?`<input data-vcap="${c.id}" placeholder="Caption đăng" value="${esc(c.caption||"")}">`:""}<button type="button" class="btn sm pri" data-vsend="${c.id}">Nộp, gửi lead duyệt</button>`;
    if(st==="dkb"&&canMove(ME,c,"quay"))return `<button type="button" class="btn sm pri" data-vok="${c.id}" data-to="quay">✓ Duyệt kịch bản</button>${fb(c)}`;
    if(st==="dvd"&&canMove(ME,c,"dceo"))return `<button type="button" class="btn sm pri" data-vok="${c.id}" data-to="dceo">✓ Duyệt</button>${fb(c)}`;
    if(st==="dceo"&&canMove(ME,c,"dang"))return `<button type="button" class="btn sm pri" data-vok="${c.id}" data-to="dang">✓ Duyệt</button>${fb(c)}`;
    return ""};
  const row=c=>{const lk=c.linkFinal||c.linkVideo||"",gy=(c.gopy||[]).slice(-3),a=act(c);
    return `<div class="vrow"><div class="vrt"><b class="mono">${esc(c.id)}</b><span class="xmt">${esc(cvShort(c.hookText||c.yTuong||c.tuyen,60))}</span>${pill(stepName(c.step),["dang","xong"].includes(c.step)?"grn":["dvd","dceo","dkb"].includes(c.step)?"amb":"gry")}${lk?`<a href="${esc(href(lk))}" target="_blank" rel="noopener">▶ Xem video</a>`:""}<button type="button" class="lnk" data-opc="${esc(c.id)}">Mở thẻ</button></div>${gy.length?`<div class="vgy">${gy.map(x=>`↩ <b>${esc(x.who)}</b> (${esc(x.t)}): ${esc(x.note)}`).join("<br>")}</div>`:""}${a?`<div class="vact">${a}</div>`:""}</div>`};
  openDrawerHTML(`<h2>${esc(g.ten)} · ${g.done}/${g.n}</h2><p class="hint">${esc(g.mo)} · ${esc(userName(g.nguoi)||"chưa giao")} · Nộp link, lead duyệt, CEO duyệt vòng 2 ngay tại đây; link và góp ý tự ghi vào thẻ ở Content › Điều phối.</p>
   <div class="vlist">${cs.map(row).join("")}</div>`);
  const re=()=>{cvOpenMk(g);renderMain()};
  document.querySelectorAll("[data-opc]").forEach(b=>b.onclick=()=>{closeDrawer();openCard(b.dataset.opc)});
  document.querySelectorAll("[data-vsend]").forEach(b=>b.onclick=()=>{const id=b.dataset.vsend,v=(document.querySelector(`[data-vl="${id}"]`)||{}).value||"";if(!v.trim()){toast("Dán link video trước");return}const cap=document.querySelector(`[data-vcap="${id}"]`),inp={linkVideo:v.trim()};if(cap)inp.caption=cap.value.trim();const e=moveCard(ME,id,"dvd",inp);if(e){toast(e);return}toast("Đã nộp "+id+", chờ lead duyệt");re()});
  document.querySelectorAll("[data-vok]").forEach(b=>b.onclick=()=>{const id=b.dataset.vok,n=(document.querySelector(`[data-vfb="${id}"]`)||{}).value||"";const e=moveCard(ME,id,b.dataset.to,{});if(e){toast(e);return}if(n.trim())DB.mutate(ME.name,"góp ý "+id,d=>{const x=d.cards.find(y=>y.id===id);if(x)x.gopy=(x.gopy||[]).concat({t:new Date().toLocaleString("vi-VN"),who:ME.name,note:n.trim()})});toast("Đã duyệt "+id);re()});
  document.querySelectorAll("[data-vtra]").forEach(b=>b.onclick=()=>{const id=b.dataset.vtra,n=((document.querySelector(`[data-vfb="${id}"]`)||{}).value||"").trim();if(!n){toast("Ghi cần sửa gì để người làm biết");return}sendBack(ME,id,n);toast("Đã trả lại "+id);re()})
}
function cvOpenDg(g){
  const d=D(),td=d.settings.today,cs=g.ids.map(id=>d.cards.find(c=>c.id===id)).filter(Boolean),days=[[0,"Chưa chọn ngày"]].concat(Array.from({length:Math.max(0,MONTH.ndays-td+1)},(_,i)=>[td+i,dayLbl(td+i)]));
  const nd=cs.filter(c=>c.step==="xong").length,tk=chOf(g.kenh).needId;
  openDrawerHTML(`<h2>${esc(g.ten)}</h2><p class="hint">${esc(g.mo)} · ${esc(userName(g.nguoi)||"chưa có người phụ trách kênh")} · dán link bài${tk?" TikTok":""} rồi bấm Đã đăng; video chưa có link là chưa đăng</p>
   ${cs.map(c=>{if(c.step==="xong")return `<section class="card pad"><b class="mono">${esc(c.id)}</b> ${esc(cvShort(c.hookText||c.yTuong||c.tuyen,90))} ${pill("✓ Đã đăng","grn")}<div class="hint">${c.linkDang?`<a href="${esc(/^https?:/i.test(c.linkDang)?c.linkDang:"https://"+c.linkDang)}" target="_blank" rel="noopener">${esc(cvShort(c.linkDang,70))}</a>`:""}</div></section>`;const lk=c.linkFinal||c.linkVideo||c.linkAnh||"",cap=c.caption||c.noiDung||"";return `<section class="card pad" data-dgc="${esc(c.id)}"><b class="mono">${esc(c.id)}</b> ${esc(cvShort(c.hookText||c.yTuong||c.tuyen,90))}
    <div class="acts">${lk?`<a class="btn sm" href="${esc(/^https?:/i.test(lk)?lk:"https://"+lk)}" target="_blank" rel="noopener">Mở video / ảnh</a>`:`<span class="hint">chưa có link video</span>`}<button type="button" class="btn sm ghost" data-opc="${esc(c.id)}">Chi tiết thẻ</button></div>
    ${cap?`<label class="field">Caption<textarea rows="3" readonly>${esc(cap)}</textarea></label><button type="button" class="btn sm ghost" data-cpc="${esc(c.id)}">Sao chép caption</button>`:""}
    <label class="field">Ngày đăng<select data-dgday="${esc(c.id)}">${opt(days,+c.day||0)}</select></label>
    <label class="field">Link bài đã đăng<input data-dgl="${esc(c.id)}" placeholder="${tk?"Dán link TikTok, ví dụ https://www.tiktok.com/@ailla/video/7…":"Dán link bài sau khi đăng"}" value="${esc(c.linkDang||"")}"></label>
    <button type="button" class="btn sm pri" data-dgok="${esc(c.id)}">Đã đăng</button></section>`}).join("")}`);
  document.querySelectorAll("[data-opc]").forEach(b=>b.onclick=()=>{closeDrawer();openCard(b.dataset.opc)});
  document.querySelectorAll("[data-cpc]").forEach(b=>b.onclick=()=>{const c=d.cards.find(x=>x.id===b.dataset.cpc),t=(c&&(c.caption||c.noiDung))||"";try{navigator.clipboard.writeText(t);toast("Đã sao chép caption")}catch(e){toast("Không sao chép được, bôi đen rồi sao chép tay")}});
  document.querySelectorAll("[data-dgday]").forEach(s=>s.onchange=()=>{const id=s.dataset.dgday,v=+s.value||0;DB.mutate(ME.name,"chọn ngày đăng "+id,dt=>{const x=dt.cards.find(y=>y.id===id);if(x)x.day=v});toast(v?"Đã đặt ngày đăng "+dd(v):"Đã bỏ ngày đăng");closeDrawer();renderMain()});
  document.querySelectorAll("[data-dgok]").forEach(b=>b.onclick=()=>{const id=b.dataset.dgok,inp=document.querySelector(`[data-dgl="${id}"]`),link=inp?inp.value.trim():"",c0=d.cards.find(x=>x.id===id);if(!link){toast("Dán link bài đã đăng rồi bấm Đã đăng");return}
    const m2=link.match(/[0-9]{19}/);if(c0&&chOf(c0.kenh).needId&&!m2){alert("Link này chưa có mã video TikTok (dãy 19 số sau /video/).\n\nNếu là link rút gọn (vt.tiktok.com/…): mở link đó trên trình duyệt, chờ hiện video rồi sao chép lại link trên thanh địa chỉ và dán vào đây.");return}
    if(typeof dupAlert==="function"&&dupAlert(link,[id]))return;
    const e=moveCard(ME,id,"xong",m2?{linkDang:link,tiktokId:m2[0]}:{linkDang:link});if(e){toast(e);return}
    DB.mutate(ME.name,"đã đăng "+id,dt=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;x.dgKey=g.key;x.ngayDang=td;if(!x.day)x.day=td;
      const k=x.khoMa&&(dt.kho||[]).find(y=>y.ma===x.khoMa);if(k){k.linkBai=link;k.ngayThucTe=td;k.maDang=k.maDang||x.id;k.trangThai="Đã lên lịch"}});
    toast("Đã lưu link, "+id+" chuyển sang Đã đăng");renderMain();const g2=cvAutoDg(true).find(z=>z.key===g.key);if(g2)cvOpenDg(g2);else{closeDrawer();toast("Xong việc đăng: đã đăng đủ "+cs.length+"/"+cs.length)}})
}
function pCvNv2(m){
  const d=D(),td=d.settings.today,sm=cvSummaryOnly(),mk=sm?[]:cvAutoMk(),dg=sm?[]:cvAutoDg(),lead=(CVF.st||sm)?[]:cvLeadLines(),warn=sm?[]:cvWarn();
  const auto=mk.concat(dg).filter(cvStMatch).sort((a,b)=>(b.late-a.late)||((a.han||0)-(b.han||0))),
    tasks=cvGroup(cvFilter(cvItems().filter(x=>x.src!=="card"))).sort((a,b)=>(b.late-a.late)||(a.st==="done")-(b.st==="done")||(b.st==="review")-(a.st==="review")||a.han-b.han);
  const rawT=D().tasks||[],openT=rawT.filter(t=>t.st!=="done"),mineN=openT.filter(t=>t.nguoi===ME.id||(t.phoi||[]).includes(ME.id)).length,waitN=rawT.filter(t=>tkMyTurn(t)).length,lateN=tasks.filter(x=>x.late).length,dueT=tasks.filter(x=>x.han&&x.han<=td),okT=dueT.filter(x=>x.st==="done"||!x.late).length;
  const tile=(k,l,v,cls)=>`<${k?`button type="button" data-tile="${k}"`:"div"} class="cvtile${cls?" "+cls:""}"><span>${l}</span><b>${v}</b></${k?"button":"div"}>`;
  const tilesHtml=`<div class="cvtiles">${tile("mine","Việc của tôi",mineN)}${tile("wait","Chờ tôi duyệt",waitN,waitN?"amb":"")}${tile("late","Quá hạn",lateN,lateN?"red":"")}${tile("","Đúng hạn",dueT.length?Math.round(okT/dueT.length*100)+"%":"—")}</div>`;
  const hanL=x=>!x.han?"—":(x.han===td?"Hôm nay":x.han===td+1?"Mai":dayLbl(x.han))+(x.gio?" · "+x.gio:"");
  const stP=x=>x.late&&x.st!=="done"?pill(x.st==="review"?"Chờ duyệt · trễ":"Trễ "+x.lateD+" ngày","red"):pill(cvStN(x.st),(CV_ST.find(s=>s[0]===x.st)||[])[2]);
  /* việc làm video, đăng bài: gom theo kênh, mỗi kênh một nhóm thu gọn được; nhóm có việc trễ tự mở */
  const gmap={};auto.forEach(g=>{const k=g.kenh?chOf(g.kenh).short:"Khác";(gmap[k]=gmap[k]||[]).push(g)});
  const gl=Object.entries(gmap).map(([k,a])=>({k,a,late:a.filter(x=>x.late).length,n:a.reduce((z,x)=>z+(x.kind==="mk"?x.n:0),0),done:a.reduce((z,x)=>z+(x.kind==="mk"?x.done:0),0)})).sort((x,y)=>y.late-x.late||y.a.length-x.a.length);
  const autoGroupsHtml=()=>gl.map(G=>`<details class="cvgrp" data-gk="${esc(G.k)}"${(G.k in CVG?CVG[G.k]:false)?" open":""}><summary><b>${esc(G.k)}</b><span class="cvgc">${G.a.length} việc</span>${G.late?`<span class="pill p-red">${G.late} trễ</span>`:""}${G.n?`<span class="cvgp">${G.done}/${G.n} video xong</span>`:""}</summary>${G.a.map(row).join("")}</details>`).join("");
  const taskTbl=`<section class="card flush cvscroll cvtk">${tasks.length?tbl(["Việc","Người làm","Người giao","Hạn","Trạng thái","Tiến độ",""],tasks.slice(0,200).map(x=>`<tr class="clk${x.late?" late":""}" title="${esc(x.mo?cvShort(x.mo,160):x.ten)}" data-cv="${x.id}" data-src="${x.src}"${x.n>1?` data-grp="${x.ids.join(",")}"`:""}><td><b${x.st==="done"?` class="strike"`:""}>${esc(x.ten)}</b>${x.da?`<small>${esc(prjN(x.da))}</small>`:x.mo?`<small>${esc(cvShort(x.mo,80))}</small>`:""}</td><td>${x.cd&&x.cd.length?`${avatar(x.nguoi)}${esc(userName(x.nguoi)||"—")}<small>${x.cd.filter(s=>s.st==="xong").length}/${x.cd.length} công đoạn</small>`:`${avatar(x.nguoi)}${esc(userName(x.nguoi)||"Chưa giao")}${x.phoi.length?` <small>+${x.phoi.length}</small>`:""}`}</td><td>${esc(userName(x.tao)||"—")}</td><td${x.late?` class="t-red"`:""}>${hanL(x)}</td><td>${stP(x)}${x.src==="task"&&x.tl&&!["done","review"].includes(x.st)?` <span class="pill p-red">cần sửa</span>`:""}</td><td>${tkPctHtml(x)}</td><td>${tkActBtn(x)}</td></tr>`)):`<p class="empty">Chưa có việc nào. Bấm “Giao việc” để tạo.</p>`}</section>`;
  const row=g=>`<div class="cvr${g.late?" late":""}" data-au="${esc(g.key)}"><span class="cvri">${g.kind==="dg"?"📤":"🎬"}</span><div class="cvrt"><b>${esc(g.ten)}</b>${g.kind==="mk"?` <span class="cvrp">${g.done}/${g.n}</span>`:""}<small>${esc(g.mo)}</small></div><span class="who">${avatar(g.nguoi)}${esc(userName(g.nguoi)||"Chưa giao")}${g.nguoi&&!cvActive(g.nguoi)?` <small class="t-red">đã nghỉ</small>`:""}</span>${g.kind==="mk"&&g.nguoi===ME.id?`<button type="button" class="btn sm${g.st==="doing"?" pri":""}" data-aust="${esc(g.key)}">${g.st==="doing"?"✓ Đang làm":"Đang làm"}</button>`:(g.st==="doing"?pill("Đang làm","blu"):"")}</div>`;
  m.innerHTML=`<style>.cvr{display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid #e6e9f2;cursor:pointer;background:#fff}.cvr:hover{background:#f6f8fd}.cvr.late{border-left:4px solid #e03131}.cvri{font-size:18px}.cvrt{flex:1;min-width:0}.cvrt b{font-size:15px}.cvrt small{display:block;color:#6b7280;margin-top:2px}.cvrp{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;background:#eef2ff;color:#3b5bdb;font-weight:700;font-size:13px}.cvwarn{background:#fff1f1;border:1px solid #f3b4b4;color:#b42318;border-radius:12px;padding:12px 16px;margin:0 0 12px}.cvlead .cvr b{font-size:15px}.cvbar{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center;margin:0 0 12px}.cvbar input,.cvbar select{font:inherit;font-size:13.5px;padding:6px 10px;border:1px solid var(--line);border-radius:9px;background:#fff;min-width:0;max-width:190px}.cvbar input{width:170px}.cvtiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px}.cvtile{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;background:#fff;border:1px solid var(--line);border-radius:12px;padding:9px 14px;font:inherit}button.cvtile{cursor:pointer}button.cvtile:hover{background:#f6f8fd}.cvtile span{font-size:12.5px;color:#6b7280}.cvtile b{font-size:22px;font-weight:600}.cvtile.red b{color:#e03131}.cvtile.amb b{color:#b45309}tr.late td:first-child{box-shadow:inset 3px 0 #e03131}.tklate.ok{background:#f6f8fd;border-color:#dfe5f4}@media (max-width:700px){.cvtiles{grid-template-columns:repeat(2,minmax(0,1fr))}.cvbar{justify-content:stretch}.cvbar input,.cvbar select{flex:1 1 130px;max-width:none}}.cvn{display:inline-block;min-width:26px;text-align:center;padding:2px 9px;border-radius:99px;background:#fff4e0;color:#b45309;font-weight:800}</style>`
  +cvFilterBar()+tilesHtml+`
  ${taskTbl}
  ${(auto.length||lead.length||warn.length)?`<details class="card flush cvvid"${CVF.st?" open":""}><summary class="card-h pad"><h2>Việc video, đăng bài</h2><span class="hint">${auto.length} nhóm việc${warn.length?` · <span class="t-red">mai ${warn.length} kênh thiếu video</span>`:""} · bấm để mở</span></summary>
  ${warn.length?`<details class="cvwarn"><summary>⚠ Ngày mai ${warn.length} kênh chưa đủ video đăng · bấm để xem</summary>${warn.map(w=>`Mai (${dd(td+1)}) ${esc(w.short)} cần đăng <b>${w.need}</b> video, hiện mới có <b>${w.have}</b> video đã lên lịch${w.own?" · "+esc(userName(w.own)):""}`).join("<br>")}</details>`:""}
  ${lead.length?`<section class="card flush cvlead"><div class="card-h pad"><h2>Cần xử lý</h2></div>${lead.map(l=>`<div class="cvr" data-gol="${esc(l.go)}"><span class="cvri">✅</span><div class="cvrt"><b>${esc(l.ten)}</b></div><span class="cvn">${l.n}</span></div>`).join("")}</section>`:""}
  <section class="card flush"><div class="card-h pad"><h2>Việc làm video, đăng bài</h2><span class="hint">${auto.length}</span></div>${autoGroupsHtml()||`<p class="empty">Không có việc nào trong bộ lọc này.</p>`}</section></details>`:""}`;
  m.querySelectorAll("[data-tile]").forEach(b=>b.onclick=()=>{const k=b.dataset.tile;if(k==="mine"){cvWhoSet("mine");CVF.st=""}else CVF.st=k==="wait"?"review":"late";renderMain()});
  bindCvFilter(m);bindCvCards(m);bindNew();
  m.querySelectorAll("[data-tkopen]").forEach(b=>b.onclick=e=>{e.stopPropagation();openTask(b.dataset.tkopen)});
  m.querySelectorAll("[data-tmw]").forEach(b=>b.onclick=()=>{cvWhoSet(b.dataset.tmw);CVF.st="";renderMain()});
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
   - Đến hạn hôm nay / trễ: nhắc người làm, người giao và Lead team đó; team chưa có Lead mới nhắc CEO
   - Trễ từ 1 ngày: cảnh báo người làm và lead, mỗi ngày một lần
   - Đăng bài: hôm nay cần đăng thì nhắc người phụ trách kênh và lead; đăng trễ thì cảnh báo
   - Việc lead giao tay: nhắc tương tự (người làm + người cùng làm / hỗ trợ)
   Web chạy ở trình duyệt nên nhắc được tạo khi có người mở web (ai mở trước thì tạo, trùng thì bỏ qua).
   ===================================================================== */
function cvPush(dt,ids,text,ref){dt.notifs=dt.notifs||[];[...new Set([].concat(ids).filter(Boolean))].forEach(to=>{dt.notifs.push({id:uid("nt"),to,text,at:nowISO(),ref:ref||"",by:"",read:false})});if(typeof NT_KEEP!=="undefined"&&dt.notifs.length>NT_KEEP)dt.notifs=dt.notifs.slice(-NT_KEEP)}
function cvRemindList(){
  const d=D(),td=d.settings.today,out=[],act=(d.users||[]).filter(u=>u.active!==false),ceo=act.filter(u=>u.role==="admin").map(u=>u.id);
  /* Đến hạn / trễ hạn: báo Lead của team người làm; team chưa có Lead thì báo CEO; người làm chính là Lead thì không báo thêm ai (chị Hoa 04/11) */
  const leadOf=id=>{const u=act.find(x=>x.id===id),k=u?cvTeamNorm(teamOf(u)):"";if(!k||k==="all"||u.role==="admin")return ceo;if(u.role==="lead"||u.role==="truongphong")return [];
    const L=act.filter(x=>x.id!==id&&(x.role==="lead"||x.role==="truongphong")&&cvTeamSee(cvTeamNorm(teamOf(x)),k)).map(x=>x.id);return L.length?L:ceo},
    leads=g=>leadOf(g.nguoi);
  /* ref: bấm thông báo mở đúng việc (chị Hoa 03/11: nhận thông báo mà bấm vào không ra việc) */
  const push=(type,key,to,text,ref)=>{to=[...new Set((to||[]).filter(Boolean))];if(to.length)out.push({k:type+"|"+key,to,text,ref})};
  cvAutoMk(true).forEach(g=>{const who=userName(g.nguoi)||"chưa giao",mine=g.nguoi&&cvActive(g.nguoi)?[g.nguoi]:[],t=`${g.ten} (${g.done}/${g.n})`;if(!g.han)return;
    if(g.han>=td&&g.han-td<=2&&g.st!=="doing")push("n",g.key,mine,`Bạn chưa bấm "Đang làm": ${t} · hạn ${dd(g.han)}`,(g.ids||[])[0]);
    if(g.han===td)push("d",g.key,mine.concat(leads(g)),`Đến hạn hôm nay: ${t} · ${who}`,(g.ids||[])[0]);
    if(g.han<td)push("l",g.key,mine.concat(leads(g)),`⚠ Trễ ${td-g.han} ngày: ${t} · ${who}`,(g.ids||[])[0])});
  cvAutoDg(true).forEach(g=>{const who=userName(g.nguoi)||"chưa có người phụ trách",mine=g.nguoi&&cvActive(g.nguoi)?[g.nguoi]:[];
    if(!g.day)push("s",g.key,mine,`${g.ten}`,(g.ids||[])[0]);
    else if(g.day===td)push("d",g.key,mine.concat(leads(g)),`Hôm nay cần đăng: ${g.ten} · ${who}`,(g.ids||[])[0]);
    else if(g.day<td)push("l",g.key,mine.concat(leads(g)),`⚠ Đăng trễ ${td-g.day} ngày: ${g.ten} · ${who}`,(g.ids||[])[0])});
  (d.tasks||[]).forEach(t=>{if(t.st==="done"||!t.han)return;const mine=[t.nguoi].concat(t.phoi||[]).filter(x=>x&&cvActive(x)),who=userName(t.nguoi)||"chưa giao";
    if(t.han>=td&&t.han-td<=2&&["todo","nhan"].includes(t.st))push("n","tk|"+t.id,mine,`Bạn chưa bấm "Đang làm": ${t.ten} · hạn ${dd(t.han)}`,"task:"+t.id);
    if(t.han===td)push("d","tk|"+t.id,mine.concat(t.tao&&cvActive(t.tao)?[t.tao]:[],leads(t)),`Đến hạn hôm nay: ${t.ten} · ${who}`,"task:"+t.id);
    if(t.han<td)push("l","tk|"+t.id,mine.concat(t.tao&&cvActive(t.tao)?[t.tao]:[],leads(t)),`⚠ Trễ ${td-t.han} ngày: ${t.ten} · ${who}`,"task:"+t.id)});
  return out
}
function cvRemind(){
  if(typeof ME==="undefined"||!ME||!DB.data)return;
  const sfx="#"+MONTH.key+"-"+D().settings.today,done=D().autoRem||{},L=cvRemindList().filter(r=>!done[r.k+sfx]);
  if(!L.length)return;
  DB.mutate("Hệ thống","nhắc việc tự động",dt=>{dt.autoRem=dt.autoRem||{};const sf="#"+MONTH.key+"-"+dt.settings.today;Object.keys(dt.autoRem).forEach(k=>{if(!k.endsWith(sf))delete dt.autoRem[k]});
    L.forEach(r=>{const key=r.k+sf;if(dt.autoRem[key])return;dt.autoRem[key]=1;cvPush(dt,r.to,r.text,r.ref||"page:cv_v")})})
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
  const d=D(),td=d.settings.today,O=CVO.data&&CVO.data.sale&&CVO.data.cskh?CVO.data:null,its=(O&&O.items)||[];
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
    {ten:"Sale, chăm sóc khách",pt:pt("sale"),chi:O&&O.sale&&O.cskh?jn([O.sale.count?O.sale.count+" đơn chưa gửi duyệt hoặc bị từ chối":"",O.cskh.count?O.cskh.count+" việc chăm sóc đến hạn":"",tkTxt("sale")]):"Đang tải…",age:saleAge,a:2,r:5,go:()=>{MOD="b2b";PAGE="b2b_don";render()}}
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
  ${mineN?`<div class="tcmine"><b>${mineN} việc đang chờ bạn</b> (đến lượt bạn làm, cần bạn duyệt, cần giao hoặc đốc) <button class="lnk" id="cvo-mine">Mở Việc của tôi →</button></div>`:""}
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
  add("c_vid","Video, kịch bản cần duyệt","Duyệt xong thì video đi tiếp",d.cards.filter(x=>ok(x)&&["dkb","dvd","dceo"].includes(x.step)).length,"cv");
  add("c_rv","Việc giao cần duyệt","Người làm đã bấm Chờ duyệt",T.filter(t=>t.st==="review"&&tkMgr(t)).length,"cv_nv",{st:"review",who:"all"});
  add("c_gh","Người xin gia hạn","Cần gia hạn hoặc duyệt xong",T.filter(t=>(t.treReq||{}).st==="cho"&&t.st!=="done"&&tkMgr(t)).length,"cv_nv",{st:"",who:"all"});
  add("c_mine","Việc giao cho bạn chưa xong","Việc bạn là người làm",T.filter(t=>t.st!=="done"&&(t.nguoi===ME.id||(t.phoi||[]).includes(ME.id))).length,"cv_nv",{st:"",who:"mine"});
  return L;
}

/* =====================================================================
   CÔNG ĐOẠN: một việc có nhiều người, mỗi người một phần (làm lần lượt hoặc song song)
   Công đoạn: {id, ten, nguoi, han, loai:"lam"|"duyet", st:"cho"|"lam"|"xong", at, by}
   Việc có công đoạn thì tự suy ra: người làm hiện tại, hạn, trạng thái (tkSync), nên mọi màn hình cũ vẫn chạy.
   ===================================================================== */
function tkActive(x){const c=(x&&x.cd)||[],rest=c.filter(s=>s.st!=="xong");return x.tuanTu===false?rest:rest.slice(0,1)}
/* Công đoạn nhiều người + số lượng (chị Hoa 02/11: Quỳnh viết 30 hook → Lead Content duyệt → Quỳnh, May cùng quay → chia nhau edit).
   s.sl / s.dv: số lượng, đơn vị; s.phan=[{nguoi,sl,xong,fin}] khi nhiều người cùng làm (s.nguoi = người đầu). Công đoạn xong khi mọi người xong phần mình. */
const tkPpl=s=>s.phan&&s.phan.length?s.phan.map(p=>p.nguoi).filter(Boolean):[s.nguoi].filter(Boolean);
const tkCdDone=s=>s.phan&&s.phan.length?s.phan.reduce((a,p)=>a+(+p.xong||0),0):(+s.xong||0);
const tkCdFrac=s=>s.st==="xong"?1:s.sl?Math.min(.95,tkCdDone(s)/s.sl):0;
function tkSplit(s){if(!s.phan||!s.phan.length||!s.sl)return;const n=s.phan.length,b=Math.floor(s.sl/n);s.phan.forEach((p,i)=>p.sl=b+(i<s.sl%n?1:0))}
/* Gửi duyệt như việc thường (chị Hoa 02/11): nhân sự làm xong bấm Gửi duyệt → phần của mình "Chờ duyệt";
   người duyệt (bước duyệt ngay sau, không có thì người giao) Duyệt → phần đó Hoàn thành, Trả lại → "Cần sửa" kèm góp ý.
   Mọi phần đã duyệt thì công đoạn tự hoàn thành (bước duyệt ngay sau cũng xong), sang công đoạn kế. Trạng thái phần: p.ps = "" | duyet | ok | sua */
const tkParts=s=>s.phan&&s.phan.length?s.phan:[s];
const tkPartOf=(s,ng)=>s.phan&&s.phan.length?s.phan.find(q=>q.nguoi===ng):(s.nguoi===ng?s:null);
const tkCdNext=(x,s)=>{const n=x.cd[x.cd.indexOf(s)+1];return s.loai!=="duyet"&&n&&n.loai==="duyet"?n:null};
const tkCdApprId=(x,s)=>{if(s.loai==="duyet")return "";const n=tkCdNext(x,s);return n?n.nguoi:(x.tao&&!tkPpl(s).includes(x.tao)?x.tao:"")};
const tkCdWait=x=>!ME||!x.cd?[]:tkActive(x).filter(s=>tkCdApprId(x,s)===ME.id).flatMap(s=>tkParts(s).filter(q=>q.ps==="duyet").map(q=>({s,q})));
function tkCdSend(id,sid,ng,act,n,note){let fin=false,nid="";
  DB.mutate(ME.name,"công đoạn: "+act,dt=>{const x=dt.tasks.find(y=>y.id===id);if(!x||!x.cd)return;const s=x.cd.find(z=>z.id===sid);if(!s||s.st==="xong")return;
    const P=tkPartOf(s,ng);if(!P)return;const N=(ids,txt)=>{if(typeof notifyU==="function")notifyU(dt,ids,txt,"task:"+x.id)},who=userName(ng)||"",lb=`"${x.ten}" · ${s.ten}`;
    if(n!=null&&!isNaN(n)&&(act==="so"||act==="gui"))P.xong=Math.max(0,+n);
    if(s.st==="cho")s.st="lam";
    if(act==="so")tkLog(x,`${who} báo số "${s.ten}": ${P.xong}${P.sl?"/"+P.sl:""} ${s.dv||""}`);
    else if(act==="gui"){P.ps="duyet";P.note="";tkLog(x,`${who} gửi duyệt "${s.ten}"`);const a=tkCdApprId(x,s);if(a)N([a],`${who} gửi duyệt ${lb}`)}
    else if(act==="ok"){P.ps="ok";tkLog(x,`${ME.name} duyệt phần của ${who} · ${s.ten}`);N([ng],`${ME.name} đã duyệt ${lb}`)}
    else if(act==="sua"){P.ps="sua";P.note=note||"";tkLog(x,`${ME.name} trả lại ${who} · ${s.ten}: ${note||""}`);N([ng],`${ME.name} trả lại ${lb}: ${note||"cần sửa"}`)}
    fin=act==="ok"&&tkParts(s).every(q=>q.ps==="ok");const nx=tkCdNext(x,s);nid=nx?nx.id:"";
    tkSync(x)});
  if(fin)tkCdAct(id,sid,"xong","",nid)}
function tkSync(x){
  const c=x.cd||[];if(!c.length)return;
  const rest=c.filter(s=>s.st!=="xong"),act=tkActive(x),a=act[0]||c[c.length-1];
  const sent=s=>s.loai!=="duyet"&&tkParts(s).every(q=>q.ps==="duyet"||q.ps==="ok")&&tkParts(s).some(q=>q.ps==="duyet");
  x.st=!rest.length?"done":act.some(s=>s.loai==="duyet"||sent(s))?"review":(c.some(s=>s.st==="xong"||s.st==="lam")?"doing":"todo");
  x.nguoi=a.nguoi;x.han=a.han||x.han;
  x.phoi=[...new Set(c.flatMap(tkPpl).filter(p=>p&&p!==x.nguoi))];
  x.stAt=new Date().toLocaleString("vi-VN");x.stBy=ME?ME.name:"";
}
function tkCdAct(id,sid,act,note,also){
  const t0=D().tasks.find(x=>x.id===id);if(!t0)return;
  DB.mutate(ME.name,`công đoạn "${t0.ten}": ${act}`,dt=>{
    const x=dt.tasks.find(y=>y.id===id);if(!x||!x.cd)return;const s=x.cd.find(z=>z.id===sid);if(!s)return;
    const before=tkActive(x).map(z=>z.id),nowS=new Date().toLocaleString("vi-VN"),ref="task:"+x.id,N=(ids,txt)=>{if(typeof notifyU==="function")notifyU(dt,ids,txt,ref)};
    tkLog(x,`${act==="xong"?"Xong":act==="lam"?"Bắt đầu":"Trả lại"} công đoạn "${s.ten}"${note?": "+note:""}`);
    if(act==="lam"){s.st="lam";s.at=nowS;s.by=ME.name}
    else if(act==="xong"){s.st="xong";s.at=nowS;s.by=ME.name;s.xongNgay=dt.settings.today;const z=also&&x.cd.find(q=>q.id===also);if(z){z.st="xong";z.at=nowS;z.by=ME.name;z.xongNgay=dt.settings.today}}
    else if(act==="tra"){const i=x.cd.indexOf(s);let j=i-1;while(j>=0&&x.cd[j].loai==="duyet")j--;
      if(j>=0){x.cd.slice(j).forEach(z=>{z.st="cho";tkParts(z).forEach(q=>{q.ps=""})});tkParts(x.cd[j]).forEach(q=>{q.ps="sua";q.note=note});x.cd[j].st="lam";x.tlNote=note;N(tkPpl(x.cd[j]),`${ME.name} trả lại công đoạn "${x.cd[j].ten}" của việc "${x.ten}": ${note}`)}else{s.st="cho"}}
    tkSync(x);tkDoneDay(x,dt.settings.today);
    const after=tkActive(x);
    after.filter(z=>!before.includes(z.id)&&z.id!==sid).forEach(z=>N(tkPpl(z),z.loai==="duyet"?`Việc "${x.ten}" chờ bạn duyệt`:`Đến lượt bạn: "${x.ten}" · ${z.ten}${z.han?" · hạn "+dd(z.han):""}`));
    if(x.st==="done")N([x.tao,...x.cd.flatMap(tkPpl)],`Việc "${x.ten}" đã xong hết các công đoạn`);
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
    if(t.tuChoi&&t.tuChoi.st==="cho"&&tkTcCan(t)){add({key:"tc_"+t.id,group:G2,title:t.ten,chip:"Xin từ chối",chipC:"red",detail:`${userName(t.tuChoi.by)||""}: ${t.tuChoi.lyDo}`,taskId:t.id,btn:"Xem & duyệt"});return}
    if(t.cd&&t.cd.length){
      const act=tkActive(t);
      tkCdWait(t).forEach(({s,q})=>add({key:"dp_"+s.id+q.nguoi,group:G2,title:`${t.ten} · ${s.ten}`,chip:"Duyệt",detail:`${userName(q.nguoi)||"—"} gửi duyệt${q.sl?` · ${+q.xong||0}/${q.sl} ${s.dv||""}`:""}`,age_days:late(s.han),taskId:t.id}));
      t.cd.filter(s=>tkPpl(s).includes(ME_)&&s.st!=="xong"&&!["duyet","ok"].includes((tkPartOf(s,ME_)||{}).ps)).forEach(s=>{
        if(act.includes(s)){
          if(s.loai==="duyet")add({key:"d_"+s.id,group:G2,title:t.ten,chip:"Duyệt",detail:`Chờ bạn duyệt · giao bởi ${who}${s.han?" · hạn "+dd(s.han):""}`,age_days:late(s.han),taskId:t.id});
          else add({key:"w_"+s.id,group:G1,title:`${t.ten} · ${s.ten}`,detail:`Hạn ${s.han?dd(s.han):"—"} · giao bởi ${who}${s.st==="lam"?" · đang làm":""}`,age_days:late(s.han),han:s.han||0,chip:`${t.cd.filter(z=>z.st==="xong").length}/${t.cd.length} công đoạn`,taskId:t.id,cdId:s.id,...(s.phan&&s.phan.length||tkCdApprId(t,s)?{}:{act:"xong"})});
        }else{const prev=act[0];add({key:"c_"+s.id,group:G3,title:`${t.ten} · ${s.ten}`,detail:prev?`Chờ ${userName(prev.nguoi)||"—"} xong "${prev.ten}"`:"Chờ công đoạn trước",taskId:t.id})}
      });
    }else{
      if(tkMyTurn(t))add({key:"r_"+t.id,group:G2,title:t.ten,detail:`${userName(t.nguoi)||"—"} đã nộp kết quả${t.vong===2?" · lead đã duyệt, chờ CEO":""}`,age_days:late(t.han),taskId:t.id,btn:"Xem & duyệt"});
      else if((t.nguoi===ME_||(t.phoi||[]).includes(ME_))&&t.st==="review")add({key:"s_"+t.id,group:"Đã nộp, chờ duyệt",title:t.ten,detail:`Chờ ${tkMgrNames(t)} duyệt${t.nopAt?" · nộp lúc "+t.nopAt:""}`,taskId:t.id,btn:"Xem",chip:"Chờ duyệt",chipC:"amb"});
      else if((t.nguoi===ME_||(t.phoi||[]).includes(ME_))&&t.st!=="review")add({key:"t_"+t.id,group:G1,title:t.ten,detail:`Hạn ${t.han?dd(t.han):"—"} · giao bởi ${who}${t.tlNote?" · bị trả lại: "+t.tlNote:""}`,age_days:late(t.han),han:t.han||0,taskId:t.id,btn:"Nộp kết quả",chip:tkStChip(t),chipC:t.tlNote?"red":tkStC(t.st)});
    }
    if((t.treReq||{}).st==="cho"&&tkMgr(t))add({key:"g_"+t.id,group:G2,title:t.ten,detail:`${(t.treReq||{}).by||"Người làm"} xin gia hạn${(t.treReq||{}).hanMoi?" đến "+dd(t.treReq.hanMoi):""}`,taskId:t.id});
  });
  if(ME.role==="admin"||ME.role==="lead"){
    const CL=typeof cvList==="function"?cvList(ME).L:[],n=k=>{const g=CL.find(y=>y.key===k);return g?g.items.filter(i=>!CV_TEST.includes(i.nguoi)).length:0},G4="Cần phân công / theo dõi";
    if(n("cg")&&ME.role!=="admin")add({key:"k_cg",group:G4,title:`${n("cg")} thẻ video 7 ngày tới chưa giao người`,detail:"Giao người viết kịch bản, quay, edit để kịp đăng",count:n("cg"),mod:"mkt",go:"dieuphoi"});
    const late=cvGroup(cvItems().filter(x=>!CV_TEST.includes(x.nguoi))).filter(x=>x.late&&x.st!=="done"&&x.nguoi!==ME_&&(ME.role!=="admin"||x.src==="task"&&x.tao===ME_));/* CEO chỉ nhắc việc chính mình giao (chị Hoa 04/11) */
    if(late.length)add({key:"k_tre",group:G4,title:ME.role==="admin"?`${late.length} việc bạn giao đang trễ hạn`:`${late.length} việc của team đang trễ hạn`,detail:"Nhắc người làm hoặc gia hạn: "+[...new Set(late.map(x=>userName(x.nguoi)).filter(Boolean))].slice(0,4).join(", "),count:late.length,age_days:late.reduce((z,x)=>Math.max(z,x.lateD||0),0),go:"cv_nv",st:"late",who:"all"});
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
function cvvDefault(){const top=ME.role==="admin"||cvSummaryOnly()||(typeof dvMgr==="function"&&dvMgr());CVV.view="list";CVV.scope=top?"team":"mine"}
function pCvV(m){
  /* bố cục mới (cvmoi.js, chị Hoa duyệt demo 04/11): Việc của tôi có tab Hôm nay, Sắp tới, Tôi giao… Bản cũ bên dưới chỉ chạy khi file mới không nạp được. */
  if(typeof cwMy==="function"){cwMy(m);return}
  if(!CVV.view)cvvDefault();
  PAGE="cv_v";
  const td=D().settings.today,tasks=D().tasks||[];
  const nMine=WK&&WK.items?wkCount():"",nGiao=tasks.filter(t=>t.tao===ME.id&&t.nguoi!==ME.id&&t.st!=="done"&&!CV_TEST.includes(t.nguoi)).length;
  /* chỉ đếm việc đã giao người làm, khớp danh sách; thẻ video chưa giao xem ở Điều phối, Phòng ban (chị Hoa 02/11: "Cả team 10" mà danh sách trống) */
  const nTeam=cvGroup(cvItems().filter(x=>!CV_TEST.includes(x.nguoi)&&x.nguoi&&x.st!=="cg")).filter(x=>x.st!=="done").length;
  const chip=(k,l,n)=>`<button type="button" class="cvchip${CVV.scope===k?" on":""}" data-vs="${k}">${l}${n!==""?` <b>${n}</b>`:""}</button>`;
  const view=(k,l)=>`<button type="button" class="cvview${CVV.view===k?" on":""}" data-vv="${k}">${l}</button>`;
  const tq=CVV.view==="tq",listMine=CVV.view==="list"&&CVV.scope==="mine";
  const mgr=cvMgrView();
  m.innerHTML=`<div class="cvvbar">${tq||CVV.view==="dh"?"":chip("mine","Của tôi",nMine)+chip("giao","Tôi giao",nGiao)+chip("team","Cả team",nTeam)}<span class="sp"></span>${view("list","Danh sách")}${view("board","Bảng")}${view("cal","Lịch")}<select class="cvmore${["gantt","tq","dh","tpl"].includes(CVV.view)?" on":""}" id="cvv-more" aria-label="Kiểu xem khác">${opt([["","Xem khác…"],["gantt","Gantt (theo thời gian)"]].concat(tkGiver()?[["tpl","Mẫu việc & việc lặp lại"]]:[]),["gantt","tq","dh","tpl"].includes(CVV.view)?CVV.view:"")}</select>${newTaskBtn()}</div>${CVV.view==="board"||CVV.view==="cal"?`<div class="cvsub">${CVV.view==="board"?`<button type="button" class="lnk" data-vgo="congviec">Xem theo bước video →</button>`:`<button type="button" class="lnk" data-vgo="giaoviec">Xem lịch quay →</button>`}</div>`:""}${CVV.view==="list"?tkQuickHtml():""}<div id="cvv-body"></div>`;
  const body=m.querySelector("#cvv-body");
  CVF.tao=(CVV.scope==="giao"&&!tq)?ME.id:"";
  try{
    if(tq)pCvTc(body);
    else if(CVV.view==="dh")pCvDh(body);
    else if(CVV.view==="tpl")pCvTpl(body);
    else if(CVV.view==="board")pCvKb(body);
    else if(CVV.view==="cal")pCvLich(body);
    else if(CVV.view==="gantt")pCvGantt(body);
    else if(listMine){const nOther=WK.items?wkMine().filter(x=>!x.taskId).reduce((z,x)=>z+wkN(x),0):"";body.innerHTML=`${tkSelfHtml()}<div id="cvv-mt"></div><details class="card flush cvvid" id="cvv-other"><summary class="card-h pad"><h2>Việc khác đang chờ bạn${nOther?` <span class="pill p-amb">${nOther}</span>`:""}</h2><span class="hint">đơn hàng, kho, kế toán, duyệt video… · bấm để mở</span></summary><div id="cvv-wk"></div></details>`;cvWhoSet("mine");cvNvRaw(body.querySelector("#cvv-mt"));WK.noTask=true;try{wkEmbed(body.querySelector("#cvv-wk"))}finally{WK.noTask=false}
      tkSelfBind(body);
      /* bảng việc giao trống thì mở sẵn "Việc khác đang chờ bạn" (chị Hoa 03/11: tưởng mất việc của tôi) */
      {const mt=body.querySelector("#cvv-mt"),dt=body.querySelector("#cvv-other");if(dt&&nOther&&(!mt.querySelector("tbody tr")||/Chưa có việc/.test(mt.textContent)))dt.open=true}}
    else cvNvRaw(body);
  }catch(e){console.error("Trang Việc lỗi",e);body.innerHTML=`<div class="note red"><b>Trang chưa hiện được.</b> Chụp dòng này gửi người quản trị web: ${esc(String(e&&e.message||e))}</div>`}
  m.querySelectorAll("[data-vs]").forEach(b=>b.onclick=()=>{CVV.scope=b.dataset.vs;cvWhoSet(CVV.scope==="mine"?"mine":"all");CVF.st="";renderMain()});
  m.querySelectorAll("[data-vv]").forEach(b=>b.onclick=()=>{CVV.view=b.dataset.vv;if(CVV.view==="tq")CVF.tao="";renderMain()});
  m.querySelectorAll("[data-vgo]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.vgo;render()});
  try{tkRecur()}catch(e){console.error("việc lặp lại",e)}
  m.querySelectorAll(".tkquick [data-tkopen]").forEach(b=>b.onclick=()=>openTask(b.dataset.tkopen));
  {const mo=m.querySelector("#cvv-more");if(mo)mo.onchange=()=>{if(!mo.value)return;CVV.view=mo.value;if(CVV.view==="tq")CVF.tao="";renderMain()}}
  bindNew();
  cvDvAttach(m);
  const re=m.querySelector("#wk-re");if(re)re.onclick=()=>{wkLoad(true);toast("Đang tải lại…")};
}
PAGES.cv_v=m=>pCvV(m);
/* Tổng quan gộp vào trang Việc (chị Hoa 02/11: hai thẻ lặp nhau): ô số ở trên, danh sách việc ở giữa, việc trễ / chờ duyệt / tải việc / hạn 7 ngày ở dưới.
   Cùng phạm vi Của tôi · Tôi giao · Cả team với danh sách (tqviec.js pDvViec). */
function cvDvAttach(m){if(typeof pDvViec!=="function"||!["list","board","cal"].includes(CVV.view))return;
  try{DV.scope=CVV.scope;const w=document.createElement("div");pDvViec(w,true);const dv=w.querySelector(".dv"),k=dv&&dv.querySelector(".dvk");if(!k)return;
    const top=document.createElement("div");top.className="dv dvtopk";top.append(k);m.prepend(top);m.prepend(w.querySelector("style"));m.querySelectorAll(".cvtiles").forEach(e=>e.remove());dv.classList.add("dvfoot");m.append(dv);try{const d=D(),td=d.settings.today,U=hsU(d,hsEffIds());dv.insertAdjacentHTML("afterbegin",hsEffHtml(d,td,U));hsEffBind(dv,d,td,U)}catch(e){console.error("biểu đồ hiệu quả",e)}}catch(e){console.error("Tổng quan việc lỗi",e)}}

/* =====================================================================
   HIỆU SUẤT LÀM VIỆC CỦA TEAM (Lead Content cần, chị Hoa 02/11): tổng quan, tiến độ, từng người, việc đang tắc.
   Tính từ việc giao (Task giao việc) + thẻ video (Điều phối) trong kỳ chọn ở ô thời gian trên cùng.
   Lead / trưởng phòng: team mình. CEO: chọn team.
   ===================================================================== */
const HSW={team:""};
/* Tiến độ từng kênh trong tháng: mục tiêu (Kế hoạch tháng) so với đã đăng / đã duyệt / chờ duyệt / đang làm; vạch đứt = đến hôm nay lẽ ra phải đăng được bao nhiêu */
function hsChanHtml(d,td){
  const nd=MONTH.ndays,rows=(typeof CHANNELS!=="undefined"?CHANNELS:[]).map(ch=>{let T=0;try{T=typeof kn==="function"?kn(d,ch.k).T||0:0}catch(e){}
    const C=(d.cards||[]).filter(c=>c.kenh===ch.k&&c.step!=="cg"),n=k=>C.filter(c=>k.includes(c.step)).length;
    const o={ch,T,dang:n(["xong"]),cho:n(["dang"]),rv:n(["dkb","dvd","dceo"]),lam:n(["kb","quay","edit","worker"])};o.all=o.dang+o.cho+o.rv+o.lam;return o}).filter(o=>o.T||o.all);
  if(!rows.length)return "";
  const seg=(v,base,col,t)=>v?`<i style="width:${v/base*100}%;background:${col}" title="${t}: ${v}"></i>`:"";
  return `<section class="card hsw-ch"><div class="hsw-chh"><h3>Tiến độ từng kênh · tháng ${MONTH.mon}</h3><span class="hsw-lg"><i style="background:#2f9e44"></i>Đã đăng<i style="background:#20c997"></i>Duyệt, chờ đăng<i style="background:#f59f00"></i>Chờ duyệt<i style="background:#4c6ef5"></i>Đang làm<i class="mk"></i>Lẽ ra đến hôm nay</span></div>
   ${rows.map(o=>{const base=Math.max(o.T,o.all,1),exp=o.T?Math.round(o.T*Math.min(td,nd)/nd):0,done=o.dang+o.cho,p=o.T?Math.round(o.dang/o.T*100):null,lag=o.T?exp-done:0;
     return `<div class="hsw-cr"><div class="hsw-cn"><b>${esc(o.ch.short||o.ch.k)}</b><small>${o.T?`mục tiêu ${o.T} video`:"chưa đặt mục tiêu"}</small></div>
      <div class="hsw-sb">${seg(o.dang,base,"#2f9e44","Đã đăng")}${seg(o.cho,base,"#20c997","Duyệt, chờ đăng")}${seg(o.rv,base,"#f59f00","Chờ duyệt")}${seg(o.lam,base,"#4c6ef5","Đang làm")}${exp?`<em style="left:${exp/base*100}%" title="Đến hôm nay lẽ ra: ${exp}"></em>`:""}</div>
      <div class="hsw-cv"><b>${o.dang}</b><small>/${o.T||"—"} đã đăng${p!=null?` · ${p}%`:""}</small>${o.T?(lag>0?`<span class="pill p-red">chậm ${lag}</span>`:`<span class="pill p-grn">đúng tiến độ</span>`):""}</div></div>`}).join("")}</section>`}
function hsTeams(){const ks=[];D().users.forEach(u=>{const k=teamOf(u);if(u.active&&u.role!=="admin"&&k&&k!=="all"&&!ks.includes(k))ks.push(k)});return ks}
/* việc giao của những người ids: tính từng người làm (việc có công đoạn thì từng công đoạn) */
function hsU(d,ids){
  const U=[];(d.tasks||[]).forEach(t=>{const one=(ng,han,st,xn,ten,tl)=>{if(ids.includes(ng))U.push({ng,han:+han||0,st,xn:+xn||0,ten,tl,id:t.id,src:"task"})};
    if(t.cd&&t.cd.length)t.cd.forEach(s=>{if(s.loai!=="duyet")tkPpl(s).forEach(ng=>one(ng,s.han,s.st==="xong"?"done":s.st==="lam"?"doing":"todo",s.xongNgay,t.ten+" · "+s.ten,0))});
    else one(t.nguoi,t.han,t.st,t.xongNgay,t.ten,(t.chat||[]).filter(c=>c.kind==="tra").length)});
  return U}
/* người đang xem ở ô "Xem việc của" (Của tôi · Team · từng người · Tất cả) */
function hsEffIds(){const d=D(),w=typeof cvWho==="function"?cvWho():"mine",t=teamOf(ME),U=d.users.filter(u=>u.active&&!CV_TEST.includes(u.id));
  if(w==="mine")return [ME.id];if(w.indexOf("p:")===0)return [w.slice(2)];if(w.indexOf("t:")===0){const k=w.slice(2);return U.filter(u=>cvTeamNorm(teamOf(u))===k).map(u=>u.id)}
  return U.filter(u=>u.id===ME.id||u.role!=="admin"&&(ME.role==="admin"||can(ME,"viec.giao")||cvTeamSee(t,teamOf(u)))).map(u=>u.id)}
/* Hiệu quả việc được giao và việc tự tạo (chị Hoa 04/11): mỗi ngày trong tháng = % xong đúng hạn, cộng dồn từ đầu tháng tới ngày đó,
   tính trên việc đã tới hạn (xong đúng hạn / xong trễ / tới hạn chưa xong). Hai đường: việc được giao và việc tự tạo
   (nhân sự tự thêm cho mình, hoặc người tạo cũng là người làm). Theo ô "Xem việc của".
   P (không bắt buộc, Công việc › Tổng quan › Của tôi): {a,b,lb} = khoảng ngày của kỳ Tuần / Tháng / Quý (đánh số ngày như han), x.tu có sẵn thì dùng luôn. */
function hsEffData(d,td,U,P){const T=d.tasks||[],a=P?P.a:1,N=P?Math.max(a,Math.min(td,P.b)):Math.max(1,Math.min(td,MONTH.ndays)),D0=Array.from({length:N-a+1},(_,i)=>a+i);
  const kind=x=>{if(x.tu!==undefined)return x.tu?"tu":"giao";const t=T.find(y=>y.id===x.id)||{};return t.tuThem||t.tao===x.ng?"tu":"giao"};
  const line=k=>{const L=U.filter(x=>x.han&&x.han>=a&&x.han<=N&&kind(x)===k);return D0.map(day=>{let dung=0,tre=0,late=0;
    L.forEach(x=>{if(x.han>day)return;const xn=x.st==="done"?(x.xn||x.han):0;if(xn&&xn<=day){if(xn>x.han)tre++;else dung++}else if(x.han<day||day<td)late++});
    const n=dung+tre+late;return n?{p:Math.round(dung/n*100),n,dung,tre,late}:null})};
  return {D0,giao:line("giao"),tu:line("tu")}}
function hsEffHtml(d,td,U,P){const {D0,giao,tu}=hsEffData(d,td,U,P);
  const last=A=>A.filter(Boolean).slice(-1)[0],sum=A=>{const o=last(A);return o?`${o.p}% đúng hạn · ${o.n} việc tới hạn`:"chưa có việc tới hạn"};
  const w=1000,h=170,L=44,R=14,Tp=12,B=26,n=D0.length,X=i=>n<2?L+(w-L-R)/2:L+i*(w-L-R)/(n-1),Y=p=>Tp+(100-p)*(h-Tp-B)/100,step=n<2?w-L-R:(w-L-R)/(n-1);
  const path=A=>{let s="",on=false;A.forEach((o,i)=>{if(!o){on=false;return}s+=(on?"L":"M")+X(i).toFixed(1)+" "+Y(o.p).toFixed(1);on=true});return s};
  const SER=[["Việc được giao","var(--hsef-1)",giao],["Việc tự giao","var(--hsef-2)",tu]];
  const tick=i=>i===0||i===n-1||(n>40?(i+1)%14===0:n>10?(i+1)%5===0:true);
  return `<section class="card hsef"><div class="hsw-chh"><h3>Hiệu quả làm việc · ${P?esc(P.lb):"tháng "+MONTH.mon}</h3><span class="hint">% việc xong đúng hạn, cộng dồn từ đầu ${P?"kỳ":"tháng"} · rê chuột để xem từng ngày</span></div>
   <div class="hsefl">${SER.map(([nm,c,A])=>`<span><i style="background:${c}"></i><b>${nm}</b> <small>${sum(A)}</small></span>`).join("")}</div>
   <div class="hsefw"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Hiệu quả việc được giao và việc tự giao">
    ${[0,50,100].map(p=>`<line x1="${L}" x2="${w-R}" y1="${Y(p)}" y2="${Y(p)}" class="hsefg"/><text x="${L-8}" y="${Y(p)+4}" text-anchor="end" class="hseft">${p}%</text>`).join("")}
    ${D0.map((day,i)=>tick(i)?`<text x="${X(i)}" y="${h-6}" text-anchor="middle" class="hseft">${dd(day)}</text>`:"").join("")}
    <line class="hsefx" x1="0" x2="0" y1="${Tp}" y2="${h-B}" visibility="hidden"/>
    ${SER.map(([nm,c,A])=>`<path d="${path(A)}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${A.map((o,i)=>o&&(i===n-1||!A[i-1]||!A[i+1]||n<=12)?`<circle cx="${X(i)}" cy="${Y(o.p)}" r="4" fill="${c}" stroke="var(--hsef-bg)" stroke-width="2"/>`:"").join("")}`).join("")}
    ${D0.map((day,i)=>`<rect class="hsefh" data-hsew="${i}" x="${X(i)-step/2}" y="0" width="${step}" height="${h-B}"/>`).join("")}
   </svg><div class="hseftip" hidden></div></div>
   <table class="sr-only"><tr><th>Ngày</th><th>Việc được giao</th><th>Việc tự giao</th></tr>${D0.map((day,i)=>`<tr><td>${dd(day)}</td><td>${giao[i]?giao[i].p+"%":"—"}</td><td>${tu[i]?tu[i].p+"%":"—"}</td></tr>`).join("")}</table></section>`}
function hsEffBind(m,d,td,U,P){const box=m.querySelector(".hsefw");if(!box)return;const {D0,giao,tu}=hsEffData(d,td,U,P),tip=box.querySelector(".hseftip"),cx=box.querySelector(".hsefx");
  const row=(nm,o)=>`<div><b>${nm}</b> ${o?`${o.p}% <small>(${o.dung} đúng hạn · ${o.tre} xong trễ · ${o.late} còn trễ)</small>`:`<small>chưa có việc tới hạn</small>`}</div>`;
  box.querySelectorAll("[data-hsew]").forEach(r=>{r.onmouseenter=()=>{const i=+r.dataset.hsew;tip.innerHTML=`<b>Đến ${dd(D0[i])}</b>${row("Được giao",giao[i])}${row("Tự giao",tu[i])}`;tip.hidden=false;
    const x=+r.getAttribute("x")+ +r.getAttribute("width")/2;cx.setAttribute("x1",x);cx.setAttribute("x2",x);cx.setAttribute("visibility","visible");
    const bb=box.getBoundingClientRect(),rb=r.getBoundingClientRect();tip.style.left=Math.max(0,Math.min(bb.width-tip.offsetWidth,rb.left-bb.left+rb.width/2+12))+"px"};
    r.onmouseleave=()=>{tip.hidden=true;cx.setAttribute("visibility","hidden")}})}
/* số từng người của Công việc › Tổng quan (dùng chung với Phê duyệt › Đang chờ ở các phòng để hai nơi không lệch) */
function hsCalc(d,td,team,boss){
  const ppl=d.users.filter(u=>u.active&&u.role!=="admin"&&!CV_TEST.includes(u.id)&&(boss?cvTeamSee(team,teamOf(u))||teamOf(u)===team:tkSameTeam(ME,u)));
  const ids=ppl.map(u=>u.id);
  const a=typeof PERIOD!=="undefined"&&PERIOD&&PERIOD.from?tkDay(PERIOD.from):1,b=typeof PERIOD!=="undefined"&&PERIOD&&PERIOD.to?tkDay(PERIOD.to):MONTH.ndays;
  const inK=h=>h>=a&&h<=b;
  /* việc giao: tính từng người làm (việc có công đoạn thì từng công đoạn) */
  const U=hsU(d,ids);
  /* thẻ video: người đang giữ thẻ hoặc người edit / viết kịch bản */
  const C=(d.cards||[]).filter(c=>c.step!=="cg"&&[c.nguoi,c.nguoiEdit,c.nguoiKB].some(x=>ids.includes(x)));
  const cOwn=c=>ids.includes(c.nguoiEdit)?c.nguoiEdit:ids.includes(c.nguoi)?c.nguoi:c.nguoiKB;
  const per={};ppl.forEach(u=>per[u.id]={u,mo:0,doing:0,rv:0,late:0,dung:0,tre:0,vGiao:0,vNop:0,vDuyet:0,tra:0,load:Array(7).fill(0)});
  U.forEach(x=>{const p=per[x.ng];if(!p)return;const open=x.st!=="done";
    if(open){p.mo++;if(x.st==="doing"||x.st==="nhan")p.doing++;if(x.st==="review")p.rv++;if(x.han&&x.han<td)p.late++;const k=x.han-td;if(k>=0&&k<7)p.load[k]++}
    else if(x.xn&&inK(x.xn)){if(x.xn<=x.han)p.dung++;else p.tre++}p.tra+=x.tl||0});
  C.forEach(c=>{const p=per[cOwn(c)];if(!p)return;const day=c.day||0;if(day&&!inK(day)&&!["edit","kb","quay","worker","dkb","dvd","dceo"].includes(c.step))return;
    p.vGiao++;if(["dvd","dceo","dang","xong"].includes(c.step))p.vNop++;if(["dang","xong"].includes(c.step))p.vDuyet++;p.tra+=(c.gopy||[]).length;
    if(!["dang","xong"].includes(c.step)){if(typeof isLate==="function"&&isLate(c))p.late++;if(["dvd","dceo","dkb"].includes(c.step))p.rv++;else p.doing++;const k=(c.han||c.day||0)-td;if(k>=0&&k<7)p.load[k]++}});
  return {ppl,ids,U,C,cOwn,per,inK}}
function pHsWork(m){
  const d=D(),td=d.settings.today,boss=ME.role==="admin",tms=hsTeams();
  let team=boss?(HSW.team||(tms.includes("content")?"content":tms[0]||"")):teamOf(ME);
  const {ppl,ids,U,C,cOwn,per,inK}=hsCalc(d,td,team,boss);
  const P=Object.values(per),S=k=>P.reduce((z,p)=>z+p[k],0),pct=(x,y)=>y?Math.round(x/y*100):null;
  const tot={mo:S("mo")+C.filter(c=>!["dang","xong"].includes(c.step)).length,rv:S("rv"),late:S("late"),dung:S("dung"),tre:S("tre"),vGiao:S("vGiao"),vNop:S("vNop"),vDuyet:S("vDuyet"),tra:S("tra")};
  const okP=pct(tot.dung,tot.dung+tot.tre+tot.late);
  const IC={mo:'<path d="M4 6h16M4 12h16M4 18h10"/>',rv:'<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="8"/>',late:'<path d="M12 8v5M12 16.5v.5"/><path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/>',nop:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/>',ok:'<path d="m5 12 4 4 10-10"/>'};
  const icon=(k,c)=>`<i class="hsw-ic" style="background:${c[0]};color:${c[1]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg></i>`;
  const tile=(l,v,h,cls,ic,extra)=>`<div class="hsw-t${cls?" "+cls:""}">${ic||""}<div class="hsw-tb"><span>${l}</span><b>${v}</b>${extra||""}${h?`<small>${h}</small>`:""}</div></div>`;
  const ring=p=>`<i class="hsw-ring" style="background:conic-gradient(${p>=90?"#2f9e44":p>=70?"#f08c00":"#e03131"} ${p*3.6}deg,#eef0f4 0)"><b>${p}%</b></i>`;
  const bar=(x,y,col)=>{const p=y?Math.min(100,Math.round(x/y*100)):0;return `<div class="hsw-bar"><i style="width:${p}%;background:${col||"#2f6fde"}"></i></div>`};
  /* tiến độ theo kênh: video trong kỳ đã nộp / đã duyệt, đăng */
  const byK={};C.forEach(c=>{const k=c.kenh||"Khác",o=byK[k]=byK[k]||{n:0,nop:0,dang:0};o.n++;if(["dvd","dceo","dang","xong"].includes(c.step))o.nop++;if(["dang","xong"].includes(c.step))o.dang++});
  /* việc đang tắc */
  const stuck=U.filter(x=>x.st!=="done"&&x.han&&x.han<td).map(x=>({ten:x.ten,ng:x.ng,lt:td-x.han,go:`data-tkopen="${x.id}"`}))
    .concat(C.filter(c=>!["dang","xong"].includes(c.step)&&typeof isLate==="function"&&isLate(c)).map(c=>({ten:(c.hookText||c.yTuong||c.id)+" · "+stepName(c.step),ng:cOwn(c),lt:Math.max(1,td-((c.han&&WORK_STEPS.includes(c.step))?c.han:c.day)),go:`data-opcard="${c.id}"`})))
    .sort((x,y)=>y.lt-x.lt).slice(0,8);
  const dayL=i=>i===0?"Hôm nay":i===1?"Mai":(THU[(((MONTH.first+td+i-1)%7)+7)%7]);
  m.innerHTML=`<div class="hsw">
   <div class="hsw-h"><h2>Hiệu suất làm việc ${boss?"":"team "}${esc(boss?"":cvTeamName(team))}</h2>${boss&&tms.length>1?`<div class="tkteams">${tms.map(k=>`<button type="button" class="cvchip${k===team?" on":""}" data-hst="${esc(k)}">${esc(cvTeamName(k))}</button>`).join("")}</div>`:""}<span class="hint">Kỳ: ô thời gian trên cùng · ${ppl.length} người</span></div>
   <div class="hsw-tiles">${tile("Việc đang mở",tot.mo,"","",icon("mo",["#e7f0ff","#1c4fb8"]))}${tile("Chờ duyệt",tot.rv,"",tot.rv?"amb":"",icon("rv",["#fff1dc","#9a5200"]))}${tile("Trễ hạn",tot.late,"",tot.late?"red":"",icon("late",["#ffe9ee","#c92a2a"]))}${okP==null?tile("Đúng hạn","—","chưa có việc tới hạn","",icon("ok",["#e3f5ea","#1f7a3d"])):tile("Đúng hạn","",`${tot.dung} đúng · ${tot.tre} trễ · ${tot.late} đang trễ`,"",ring(okP))}${tile("Video đã nộp",`${tot.vNop}<small class="hsw-of">/${tot.vGiao}</small>`,"","",icon("nop",["#f1e8ff","#6b2fb3"]),bar(tot.vNop,tot.vGiao,"#7048e8"))}${tile("Video đã duyệt",tot.vDuyet,tot.tra?`${tot.tra} lần bị trả lại`:"","",icon("ok",["#e3f5ea","#1f7a3d"]))}</div>
   ${hsEffHtml(d,td,U)}
   ${hsChanHtml(d,td)}
   <div class="hsw-grid">
    <section class="card flush cvtk"><div class="card-h pad"><h3>Từng người</h3><span class="hint">bấm tên để xem việc của người đó</span></div>${tbl(["Người","Đang làm","Chờ duyệt","Trễ","Xong (đúng / trễ)","Đúng hạn","Video nộp","Trả lại","Việc 7 ngày tới"],P.sort((x,y)=>y.late-x.late||y.mo-x.mo).map(p=>{const o=pct(p.dung,p.dung+p.tre+p.late),mx=Math.max(3,...p.load);return `<tr><td><button type="button" class="lnk" data-hsp="${p.u.id}">${avatar(p.u.id)}${esc(p.u.name)}</button></td><td class="n">${p.doing||""}</td><td class="n">${p.rv?`<span class="pill p-amb">${p.rv}</span>`:""}</td><td class="n">${p.late?`<span class="pill p-red">${p.late}</span>`:""}</td><td class="n">${p.dung} / ${p.tre}</td><td class="n">${o==null?"—":`<b class="${o>=90?"t-grn":o>=70?"t-amb":"t-red"}">${o}%</b>`}</td><td>${p.vGiao?`${bar(p.vNop,p.vGiao)}<small>${p.vNop}/${p.vGiao}</small>`:""}</td><td class="n">${p.tra||""}</td><td><div class="hsw-load" title="Số việc tới hạn 7 ngày tới">${p.load.map((n,i)=>`<i style="height:${Math.round(n/mx*100)}%;background:${n>=3?"#e03131":"#4c6ef5"}" title="${dayL(i)}: ${n} việc"></i>`).join("")}</div></td></tr>`}))}</section>
    <div class="hsw-side">
     <section class="card"><h3>Việc quá hạn cần xử lý</h3>${stuck.length?stuck.map(x=>`<div class="hsw-s"><span>${avatar(x.ng)}<b>${esc(cvShort(x.ten,46))}</b></span><span class="pill p-red">trễ ${x.lt} ngày</span><button type="button" class="btn sm" ${x.go}>Mở</button></div>`).join(""):`<p class="hint">Không có việc quá hạn.</p>`}</section>
    </div></div></div>`;
  m.querySelectorAll("[data-hst]").forEach(b=>b.onclick=()=>{HSW.team=b.dataset.hst;renderMain()});
  hsEffBind(m,d,td,U);
  m.querySelectorAll("[data-tkopen]").forEach(b=>b.onclick=()=>openTask(b.dataset.tkopen));
  m.querySelectorAll("[data-opcard]").forEach(b=>b.onclick=()=>openCard(b.dataset.opcard));
  m.querySelectorAll("[data-hsp]").forEach(b=>b.onclick=()=>{PAGE="cv_v";MOD="cv";CVV.view="list";CVV.scope="team";cvWhoSet("p:"+b.dataset.hsp);CVF.st="";render()});
}

/* =====================================================================
   ĐÚNG HẠN — mỗi người: việc trong tháng, xong đúng hạn, xong trễ, đang trễ (chị Hoa 02/11: có số liệu để đánh giá, chưa chấm điểm KPI).
   Việc có công đoạn thì tính từng công đoạn cho người làm công đoạn đó (bỏ bước duyệt). Ngày xong ghi từ 02/11/2026.
   ===================================================================== */
const CVD={m:""};
function cvDhUnits(L){const out=[];(L||[]).forEach(t=>{if(t.cd&&t.cd.length)t.cd.forEach(s=>{if(s.loai!=="duyet")tkPpl(s).forEach(ng=>out.push({nguoi:ng,han:+s.han||0,done:s.st==="xong",xn:+s.xongNgay||0,ten:t.ten+" · "+s.ten}))});
  else out.push({nguoi:t.nguoi,han:+t.han||0,done:t.st==="done",xn:+t.xongNgay||0,ten:t.ten})});return out.filter(u=>u.nguoi&&u.han&&!CV_TEST.includes(u.nguoi))}
function cvDhRows(units,today,nd,cur){const by={};units.forEach(u=>{if(cur&&u.han>nd)return;const r=by[u.nguoi]=by[u.nguoi]||{id:u.nguoi,n:0,dung:0,tre:0,dangTre:0,chua:0,khongRo:0,late:[]};r.n++;
    if(u.done){if(!u.xn)r.khongRo++;else if(u.xn<=u.han)r.dung++;else r.tre++}else if(cur&&u.han<today){r.dangTre++;r.late.push(u)}else r.chua++});
  return Object.values(by).map(r=>Object.assign(r,{pct:(r.dung+r.tre+r.dangTre)?Math.round(r.dung/(r.dung+r.tre+r.dangTre)*100):null})).sort((a,b)=>(a.pct==null?101:a.pct)-(b.pct==null?101:b.pct)||b.n-a.n)}
function pCvDh(m){
  const d=D(),cur=!CVD.m||CVD.m===MONTH.key,arch=((d.luuTru||{}).tasks)||[];
  const months=[...new Set(arch.map(t=>t.thang).filter(Boolean))].filter(k=>k<MONTH.key).sort().reverse();
  const L=cur?(d.tasks||[]):arch.filter(t=>t.thang===CVD.m);
  const seeAll=tkAll(),rows=cvDhRows(cvDhUnits(L),d.settings.today,MONTH.ndays,cur).filter(r=>{const u=d.users.find(x=>x.id===r.id);return seeAll||tkSameTeam(ME,u)});
  const tot=k=>rows.reduce((z,r)=>z+r[k],0),pc=r=>r.pct==null?"—":`<b class="${r.pct>=90?"t-grn":r.pct>=70?"t-amb":"t-red"}">${r.pct}%</b>`;
  m.innerHTML=`<section class="card"><div class="card-h"><h2>Đúng hạn từng người</h2><select id="cvd-m" aria-label="Tháng">${opt([[MONTH.key,"Tháng "+MONTH.mon+" (đang chạy)"]].concat(months.map(k=>[k,"Tháng "+(+k.slice(5))+"/"+k.slice(0,4)])),cur?MONTH.key:CVD.m)}</select></div>
   <p class="hint">Tính trên việc giao qua Task giao việc. Tỷ lệ đúng hạn = xong đúng hạn ÷ (xong đúng hạn + xong trễ + đang trễ). Chưa trừ điểm KPI, dùng để đánh giá.${cur?"":" Tháng cũ chỉ còn việc đã xong; việc chưa xong đã chuyển sang tháng sau."}</p>
   ${rows.length?`<div class="tbl"><table><thead><tr><th>Người làm</th><th class="n">Việc trong tháng</th><th class="n">Xong đúng hạn</th><th class="n">Xong trễ</th><th class="n">Đang trễ</th><th class="n">Chưa tới hạn</th><th class="n">Tỷ lệ đúng hạn</th><th></th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td><b>${esc(userName(r.id)||r.id)}</b>${r.late.length?`<br><small class="t-red">${r.late.slice(0,2).map(u=>esc(cvShort(u.ten,40))+" (trễ "+(d.settings.today-u.han)+" ngày)").join(" · ")}${r.late.length>2?" …":""}</small>`:""}</td><td class="n">${r.n}</td><td class="n">${r.dung}</td><td class="n">${r.tre||""}</td><td class="n">${r.dangTre?`<b class="t-red">${r.dangTre}</b>`:""}</td><td class="n">${r.chua||""}</td><td class="n">${pc(r)}${r.khongRo?`<br><small class="hint">${r.khongRo} việc xong trước 02/11 chưa có ngày xong</small>`:""}</td><td>${cur?`<button class="btn sm" data-cvdp="${esc(r.id)}">Xem việc</button>`:""}</td></tr>`).join("")}
    <tr class="knt"><td><b>Cộng</b></td><td class="n">${tot("n")}</td><td class="n">${tot("dung")}</td><td class="n">${tot("tre")}</td><td class="n">${tot("dangTre")}</td><td class="n">${tot("chua")}</td><td class="n"></td><td></td></tr></tbody></table></div>`:`<p class="empty pad">Chưa có việc nào có hạn trong tháng này.</p>`}</section>`;
  const sel=m.querySelector("#cvd-m");if(sel)sel.onchange=()=>{CVD.m=sel.value;renderMain()};
  m.querySelectorAll("[data-cvdp]").forEach(b=>b.onclick=()=>{CVV.view="list";CVV.scope="team";cvWhoSet("p:"+b.dataset.cvdp);CVF.st="";renderMain()});
}
/* các đường dẫn cũ (cv_nv, cv_kb, cv_lich, cv_tc) đều đưa về trang Việc đúng kiểu xem */
const cvvLegacy=view=>m=>{CVV.view=view;CVV.scope=CVF.tao?"giao":(CVF.who==="mine"?"mine":"team");PAGE="cv_v";pCvV(m)};
PAGES.cv_nv=cvvLegacy("list");PAGES.cv_kb=cvvLegacy("board");PAGES.cv_lich=cvvLegacy("cal");PAGES.cv_tc=cvvLegacy("tq");
