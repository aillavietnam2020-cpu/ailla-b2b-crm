/* =====================================================================
   QUẢN TRỊ PHÒNG BAN — đợt 1 (CEO duyệt demo 14/11/2026)
   Lead từng phòng tự quản nhân sự phòng mình, không phải chờ CEO:
   - Nhân sự › Quản trị phòng › Nhân sự & phân quyền (Lead): 3 tab
       Nhân sự: thêm người mới (gửi HCNS duyệt), khóa người nghỉ (khóa đăng nhập, chuyển việc dở), người HCNS vừa thêm cần set quyền.
       Phân quyền: mẫu quyền theo chức vụ hoặc quyền riêng từng người, CHỈ trong quyền Lead đang có, trừ nhóm khóa cứng
                   (tiền, giá vốn, lợi nhuận, lương, kho, cài đặt, phân quyền toàn công ty).
       Cài đặt menu: bật tắt trang nhân sự phòng mình thấy (chỉ ẩn khỏi menu).
   - Nhật ký phòng (Lead) / Nhật ký quản trị phòng (CEO, Quản lý có quyền qtpb.hoantac): xem và hoàn tác.
   - Người mới chờ duyệt (HCNS, CEO): duyệt đề nghị của Lead → web tạo tài khoản + hồ sơ nhân sự; HCNS tự thêm người → Lead set quyền.
   - Ranh giới quyền Lead (CEO): mở Quản trị phòng cho phòng nào (mặc định Content & Media chạy thử trước).
   Máy chủ kiểm lại mọi thứ (src/server/lib/qtpb.ts, routes/qtpb.ts). Chữ trên màn hình theo vai trò, không xưng chị/em.
   Tên toàn cục trong file bắt đầu bằng "qp".
   ===================================================================== */
const QP={tab:"ns",req:null,reqBusy:false,log:null,logBusy:false,logDept:"",pt:"",ctx:null};
const QP_LEADR=["lead","truongphong"];
const QP_NEWR=["nhanvien","content","digital"];
const QP_HARD=new Set(["gia.xem_von","chiphi.xem","chiphi.nhap","pl.xem","ketqua.xem_tat_ca","luong.quanly","nhansu.quanly","nhansu.duyet","caidat.quanly","thietlap.quanly","sanpham.quanly","quychuan.sua","kehoach.duyet","sx.kiemke","sx.congthuc","qtpb.hoantac"]);
const QP_HARD_RE=/(luong|chiphi|^gia\.|giavon|loinhuan|^pl\.|^kho\.hoan|^sx\.kiemke|debt|congno|caidat|khoaso)/i;
const qpHard=p=>QP_HARD.has(p)||QP_HARD_RE.test(p);
const qpCfg=()=>{const q=(D()&&D().qtpb)||{},c=q.cfg||{};return {depts:Array.isArray(c.depts)?c.depts:["CM"],leads:c.leads&&typeof c.leads==="object"?c.leads:{},cap:c.cap||{},duyet:c.duyet==="CEO"?"CEO":"HCNS"}};
/* Lead của phòng: CEO đã chọn ở Ranh giới quyền Lead thì theo CEO chọn; chưa chọn thì là người vai trò Trưởng nhóm / Trưởng phòng. */
const qpDeptLead=u=>{if(!u||u.active===false||!u.phongBan)return false;const L=qpCfg().leads;return Object.prototype.hasOwnProperty.call(L,u.phongBan)?L[u.phongBan]===u.id:QP_LEADR.includes(u.role)};
const qpIsLead=u=>qpDeptLead(u)&&qpCfg().depts.includes(u.phongBan);
const qpLeadIds=(d,dept)=>(d.users||[]).filter(u=>u.active!==false&&u.phongBan===dept&&qpDeptLead(u)).map(u=>u.id);
/* CEO xem / làm thay Lead ở mọi phòng (chọn phòng ở đầu trang); Lead chỉ phòng mình. */
const qpAct=()=>!!ME&&(ME.role==="admin"||qpIsLead(ME));
const qpD=()=>{if(!ME)return "";if(ME.role!=="admin")return ME.phongBan;const ds=(D().departments||[]).map(p=>p.k);if(!QP.dept||!ds.includes(QP.dept))QP.dept=qpCfg().depts.find(k=>ds.includes(k))||ds[0]||"";return QP.dept};
/* Lead được tự làm gì: CEO bật / tắt ở Ranh giới quyền Lead (mặc định bật). CEO luôn làm được. */
const qpCap=k=>!!ME&&(ME.role==="admin"||qpCfg().cap[k]!==false);
const qpDeptPick=()=>ME&&ME.role==="admin"?`<div class="filters"><label class="hint" for="qp-dp">Phòng</label><select id="qp-dp" data-qpdept>${opt((D().departments||[]).map(p=>[p.k,p.n+(qpCfg().depts.includes(p.k)?"":" (chưa mở cho Lead)")]),qpD())}</select><span class="hint">CEO xem và làm thay Lead của phòng đang chọn.</span></div>`:"";
document.addEventListener("change",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.qpdept!==undefined){QP.dept=t.value;QP.log=null;QP.logDept="";QP.pt="";renderMain()}});
const qpDeptCfg=k=>{const q=(D()&&D().qtpb)||{};return (q.dept||{})[k]||{}};
const qpGrant=p=>!!ME&&can(ME,p)&&!qpHard(p);
const qpManaged=u=>!!u&&!!ME&&u.phongBan===qpD()&&u.role!=="admin"&&u.id!==ME.id&&(ME.role==="admin"||(!QP_LEADR.includes(u.role)&&!qpDeptLead(u)));
const qpPb=k=>(D().departments.find(p=>p.k===k)||{n:k||"—"}).n;
const qpPermLabel=k=>{for(const [,ps] of PERMS)for(const [p,l] of ps)if(p===k)return l;return k};
const qpNeed=()=>ME&&qpAct()?D().users.filter(u=>qpManaged(u)&&u.active!==false&&u.needPerm).length:0;
const qpPend=()=>(QP.req||[]).filter(r=>r.status==="PENDING").length;
const QP_CAP=["Thực tập sinh","Nhân viên","Chuyên viên"];
const QP_KIND=["Thử việc","Chính thức","Thực tập"];
/* Trang luôn có trong menu, Lead không tắt được. */
const QP_ALWAYS=new Set(["cc_toi","np_toi","tu_toi","pl_toi","hr_me","hr_kpime","ketquatoi","thongbao","matkhau","anhdaidien","cv_v","vp_toi","qp_ns","qp_nk","qp_wf","qp_kpi"]);

/* Quyền hoàn tác cho Quản lý: CEO bật ở Tài khoản & phân quyền. */
{const g=PERMS.find(x=>x[0]==="Hệ thống");if(g&&!g[1].some(p=>p[0]==="qtpb.hoantac"))g[1].push(["qtpb.hoantac","Hoàn tác thay đổi của Lead ở Quản trị phòng (Quản lý)"]);}

function qpLoadReq(force){
  if(QP.reqBusy||(!force&&QP.req))return;
  if(!ME||!(ME.role==="admin"||hrOk()||qpIsLead(ME)))return;
  QP.reqBusy=true;svApi("/api/hub/qtpb/requests").then(r=>{QP.req=r.rows||[];QP.ctx=r.ctx||QP.ctx}).catch(()=>{QP.req=QP.req||[]}).finally(()=>{QP.reqBusy=false;if(/^qp_/.test(PAGE))renderMain();else if(typeof render==="function")try{render()}catch(e){}});
}
function qpLoadLog(force){
  if(QP.logBusy||(!force&&QP.log))return;
  QP.logBusy=true;svApi("/api/hub/qtpb/log"+(QP.logDept?"?dept="+encodeURIComponent(QP.logDept):"")).then(r=>{QP.log=r.rows||[];QP.ctx=r.ctx||QP.ctx}).catch(e=>{QP.log=[];toast("Chưa tải được nhật ký: "+e.message)}).finally(()=>{QP.logBusy=false;if(/^qp_/.test(PAGE))renderMain()});
}
const qpBusy=async(el,f)=>{if(el)el.disabled=true;try{await f()}catch(e){toast("Chưa được: "+e.message)}finally{if(el)el.disabled=false}};
const qpNo=(t)=>`<section class="card"><p class="hint">${t}</p></section>`;
const qpDate=s=>s?String(s).slice(8,10)+"/"+String(s).slice(5,7)+(String(s).length>10?" "+new Date(s).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}):""):"";
const qpOpenTasks=id=>(D().tasks||[]).filter(t=>t.nguoi===id&&t.st!=="done");

/* ---------- Lead: Nhân sự & phân quyền ---------- */
function pQpNs(m){
  if(!qpAct()){m.innerHTML=H("Nhân sự & phân quyền","")+qpNo("Mục này dành cho Lead của phòng đã mở Quản trị phòng. CEO mở ở Ranh giới quyền Lead.");return}
  qpLoadReq();
  const need=qpNeed();
  const tabs=[["ns","Nhân sự",need]].concat(qpCap("quyen")?[["quyen","Phân quyền",0]]:[],qpCap("menu")?[["menu","Cài đặt menu",0]]:[]);
  if(!tabs.some(t=>t[0]===QP.tab))QP.tab="ns";
  m.innerHTML=qpDeptPick()+H("Nhân sự & phân quyền","Phòng "+esc(qpPb(qpD()))+" · thêm người, khóa người nghỉ, phân quyền, cài đặt menu. Mọi thay đổi ghi vào nhật ký, CEO và Quản lý xem lại được.")+
   `<div class="cwtabs" role="tablist">${tabs.map(([k,n,c])=>`<button role="tab" aria-selected="${QP.tab===k}" class="${QP.tab===k?"on":""}" data-qptab="${k}">${n}${c?` <span class="n r">${c}</span>`:""}</button>`).join("")}</div><div id="qp-sub"></div>`;
  m.querySelectorAll("[data-qptab]").forEach(b=>b.onclick=()=>{QP.tab=b.dataset.qptab;renderMain()});
  const s=m.querySelector("#qp-sub");
  if(QP.tab==="quyen")qpTabQuyen(s);else if(QP.tab==="menu")qpTabMenu(s);else qpTabNs(s);
}
function qpTabNs(s){
  const dept=qpD(),U=D().users.filter(u=>u.phongBan===dept&&u.role!=="admin"&&u.id!==ME.id).sort((a,b)=>(a.active===false)-(b.active===false)||String(a.name).localeCompare(String(b.name),"vi"));
  const needs=U.filter(u=>qpManaged(u)&&u.active!==false&&u.needPerm);
  const mine=(QP.req||[]).filter(r=>r.dept===dept&&(r.status==="PENDING"||r.status==="REJECTED"));
  const st=u=>u.active===false?pill("Đã nghỉ · đã khóa","gry"):u.tt==="phep"?pill("Nghỉ phép","amb"):u.tt==="thaisan"?pill("Nghỉ thai sản","blu"):pill("Đang làm","grn");
  s.innerHTML=`${needs.length?`<section class="card" style="border-color:#f3c9c9"><h2 style="margin:0 0 6px">HCNS vừa thêm người mới, cần set quyền</h2>${needs.map(u=>`<div class="row4" style="align-items:center;gap:10px;margin:6px 0"><b>${esc(u.name)}</b><span class="hint">${esc(u.title||"")}${u.cap?" · "+esc(u.cap):""}</span><button class="btn sm pri" data-qpset="${u.id}">Set quyền</button></div>`).join("")}</section>`:""}
   ${qpCap("them")?`<div class="filters"><button class="btn pri" id="qp-add">+ Thêm người mới</button><span class="hint">${ME.role==="admin"?"CEO thêm: tạo tài khoản ngay.":"Tài khoản đăng nhập chỉ tạo sau khi "+qpCfg().duyet+" bấm duyệt."}</span></div>`:""}
   ${mine.length?`<section class="card"><h2 style="margin:0 0 6px">Đề nghị đã gửi</h2>${tbl(["Họ tên","Chức vụ","Ngày vào","Trạng thái"],mine.map(r=>`<tr><td><b>${esc(r.name)}</b><div class="hint">${esc(r.email)}</div></td><td>${esc(r.title||"")}${r.cap?" · "+esc(r.cap):""}</td><td>${esc(qpDate(r.start_date))}</td><td>${r.status==="PENDING"?pill("Chờ "+qpCfg().duyet+" duyệt","amb"):pill("Bị trả lại","red")+(r.reason?`<div class="hint">${esc(r.reason)}</div>`:"")}</td></tr>`))}</section>`:""}
   <section class="card flush">${U.length?tbl(["Nhân sự","Chức vụ","Trạng thái","Tài khoản","Việc đang dở",""],U.map(u=>`<tr class="${u.active===false?"mut":""}"><td><b>${esc(u.name)}</b>${u.needPerm&&u.active!==false?" "+pill("Chờ set quyền","red"):""}</td><td>${esc(u.title||ROLES[u.role]||"")}${u.cap?`<div class="hint">${esc(u.cap)}</div>`:""}</td><td>${st(u)}</td><td>${u.crm?"Có":"<span class=\"hint\">chưa có</span>"}</td><td>${qpOpenTasks(u.id).length}</td>
    <td class="nowrap">${!qpManaged(u)?`<span class="hint">${qpDeptLead(u)?"Lead":""}</span>`:u.active===false?`<span class="hint">CEO mở lại được</span>`:`${qpCap("quyen")?`<button class="btn sm" data-qpq="${u.id}">Quyền</button> `:""}${qpCap("khoa")?`<button class="btn sm" data-qplock="${u.id}">Khóa (nghỉ việc)</button>`:""}`}</td></tr>`)):`<p class="hint pad">Phòng chưa có ai.</p>`}</section>`;
  s.querySelectorAll("[data-qpset],[data-qpq]").forEach(b=>b.onclick=()=>{QP.pt="u:"+(b.dataset.qpset||b.dataset.qpq);QP.tab="quyen";renderMain()});
  s.querySelectorAll("[data-qplock]").forEach(b=>b.onclick=()=>qpLock(b.dataset.qplock));
  if($("#qp-add"))$("#qp-add").onclick=qpAddForm;
}
function qpTitleOpts(){return [["","— Chọn chức vụ —"]].concat(SV_CV.filter(([,r])=>!["lead","truongphong","admin"].includes(r)).map(([n])=>[n,n]))}
function qpAddForm(){
  openDrawerHTML(`<h2>Thêm người mới vào ${esc(qpPb(qpD()))}</h2><p class="hint">${ME.role==="admin"?"CEO thêm thì web tạo tài khoản ngay.":"Gửi "+qpCfg().duyet+" duyệt."} Duyệt xong web tự tạo tài khoản đăng nhập (mật khẩu tạm, lần đầu phải đổi) và hồ sơ nhân sự; người đó có ngay quyền trống, Lead set quyền ở tab Phân quyền.</p>
  <form class="frm" id="qpf"><div class="row4"><label class="field">Họ tên<input id="qp-n" required autocomplete="off"></label><label class="field">Email (dùng đăng nhập)<input id="qp-e" type="email" required autocomplete="off" placeholder="ten@gmail.com"></label></div>
  <div class="row4"><label class="field">Chức vụ<select id="qp-t" required>${opt(qpTitleOpts(),"")}</select></label><label class="field">Cấp<select id="qp-c">${opt(QP_CAP,"Thực tập sinh")}</select></label><label class="field">Ngày vào làm<input id="qp-d" type="date" value="${hrNow().iso}"></label><label class="field">Loại<select id="qp-k">${opt(QP_KIND,"Thử việc")}</select></label></div>
  <label class="field">Ghi chú cho HCNS<input id="qp-o" autocomplete="off"></label>
  <div class="acts"><button class="btn pri" id="qp-go">Gửi ${qpCfg().duyet} duyệt</button></div></form>`);
  if(ME.role==="admin"){$("#qp-go").textContent="Tạo tài khoản ngay";$("#qpf").onsubmit=e=>{e.preventDefault();qpBusy($("#qp-go"),async()=>{
    const x={name:$("#qp-n").value.trim(),email:$("#qp-e").value.trim(),dept:qpD(),title:$("#qp-t").value,cap:$("#qp-c").value,start_date:$("#qp-d").value,kind:$("#qp-k").value,note:$("#qp-o").value.trim()};
    const res=await svApi("/api/hub/qtpb/hr-add",{method:"POST",body:JSON.stringify(x)});closeDrawer();qpAddHub(x,res.crm_id);qpShowPw(res,x.name);QP.req=null;qpLoadReq(true)})};return}
  $("#qpf").onsubmit=e=>{e.preventDefault();qpBusy($("#qp-go"),async()=>{
    await svApi("/api/hub/qtpb/requests",{method:"POST",body:JSON.stringify({name:$("#qp-n").value.trim(),email:$("#qp-e").value.trim(),title:$("#qp-t").value,cap:$("#qp-c").value,start_date:$("#qp-d").value,kind:$("#qp-k").value,note:$("#qp-o").value.trim()})});
    const n=$("#qp-n").value.trim();DB.mutate(ME.name,"đề nghị thêm người mới "+n,d=>{const dy=qpCfg().duyet,hc=d.users.filter(u=>u.active!==false&&(dy==="CEO"?u.role==="admin":u.phongBan==="HCNS")).map(u=>u.id);if(typeof notifyU==="function")notifyU(d,hc,`${ME.name} đề nghị thêm người mới ${n} vào ${qpPb(qpD())} · chờ ${dy} duyệt`,"qp_moi")});
    closeDrawer();toast("Đã gửi "+qpCfg().duyet+" duyệt");qpLoadReq(true)})};
}
function qpLock(id){
  const u=userBy(id);if(!u||!qpManaged(u))return;const open=qpOpenTasks(id),others=D().users.filter(x=>x.active!==false&&x.phongBan===qpD()&&x.id!==id&&x.role!=="admin");
  openDrawerHTML(`<h2>Khóa ${esc(u.name)} (nghỉ việc)</h2>
   <p>Web làm ngay:</p><ul class="hint"><li>Khóa đăng nhập web (máy tính và điện thoại), đăng xuất khỏi mọi máy</li><li>Rút quyền sửa thư mục Drive của phòng (trong vòng 1 giờ)</li><li>${open.length?`Chuyển ${open.length} việc đang dở cho người bạn chọn`:"Không có việc đang dở"}</li><li>Báo HCNS xác nhận ngày nghỉ và chốt lương</li></ul>
   ${open.length?`<label class="field">Chuyển việc đang dở cho<select id="qp-to">${opt(others.map(x=>[x.id,x.name+(x.id===ME.id?" (tôi)":"")]),ME.id)}</select></label>`:""}
   <p class="hint">Chỉ CEO mở lại được tài khoản đã khóa. CEO và Quản lý hoàn tác được ở nhật ký.</p>
   <div class="acts"><button class="btn pri" id="qp-lk" style="background:#d93a3a;border-color:#d93a3a">Khóa và chuyển việc</button></div>`);
  $("#qp-lk").onclick=()=>{const to=$("#qp-to")?$("#qp-to").value:"",toN=to?(userBy(to)||{}).name:"";
    DB.mutate(ME.name,`khóa ${u.name} (nghỉ việc)${open.length?`, chuyển ${open.length} việc cho ${toN}`:""}`,d=>{const x=d.users.find(y=>y.id===id);if(!x)return;x.active=false;x.tt="";
      if(to)(d.tasks||[]).forEach(t=>{if(t.nguoi===id&&t.st!=="done")t.nguoi=to});
      if(typeof notifyU==="function"){const hc=d.users.filter(y=>y.active!==false&&y.phongBan==="HCNS").map(y=>y.id);notifyU(d,hc,`${ME.name} đã khóa ${x.name} (nghỉ việc) · HCNS xác nhận ngày nghỉ trong hồ sơ`,"hr_nv");if(to&&to!==ME.id)notifyU(d,[to],`${ME.name} chuyển cho bạn ${open.length} việc của ${x.name}`,"cv_v")}});
    closeDrawer();toast("Đã khóa "+u.name+(open.length?" và chuyển việc":""));renderMain()};
}
/* Phân quyền: mẫu theo chức vụ hoặc quyền riêng từng người. */
function qpTpl(title){const t=(qpDeptCfg(qpD()).tpl||{})[title];if(Array.isArray(t))return t;const cv=SV_CV.find(x=>x[0]===title);return ((cv&&ROLE_PRESET[cv[1]])||[]).filter(qpGrant)}
function qpTabQuyen(s){
  const M=D().users.filter(u=>qpManaged(u)&&u.active!==false);
  const titles=[...new Set(M.map(u=>u.title).filter(Boolean).concat(Object.keys(qpDeptCfg(qpD()).tpl||{})))];
  if(!QP.pt||(QP.pt.startsWith("u:")&&!M.some(u=>"u:"+u.id===QP.pt)))QP.pt=titles.length?"t:"+titles[0]:(M[0]?"u:"+M[0].id:"");
  const isU=QP.pt.startsWith("u:"),key=QP.pt.slice(2),u=isU?userBy(key):null;
  const cur=new Set(isU?(u&&u.perms)||[]:qpTpl(key));
  const same=isU?[]:M.filter(x=>x.title===key);
  s.innerHTML=`<div class="filters"><label class="hint" for="qp-pt">Áp cho</label><select id="qp-pt">${opt([...titles.map(t=>["t:"+t,"Mẫu chức vụ · "+t]),...M.map(x=>["u:"+x.id,"Riêng · "+x.name+(x.needPerm?" (chờ set quyền)":"")])],QP.pt)}</select>
   <span class="hint">${isU?"Quyền của riêng người này.":"Mẫu dùng khi set quyền cho người mới cùng chức vụ; bấm Áp mẫu để đổi cho cả "+same.length+" người."}</span></div>
   ${isU&&u&&u.needPerm?`<div class="note">Người mới: chọn quyền rồi bấm <b>Lưu quyền</b>, hoặc bấm <b>Áp mẫu chức vụ</b>.</div>`:""}
   ${!QP.pt?qpNo("Phòng chưa có nhân sự để phân quyền."):PERMS.map(([g,ps])=>`<section class="card"><h2 style="margin:0 0 6px">${esc(g)}</h2>${ps.map(([k,l])=>{const hard=qpHard(k),no=!hard&&!can(ME,k),dis=hard||no;
     return `<label class="row4" style="align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed var(--line,#e7e9f0);${dis?"opacity:.7":""}"><input type="checkbox" data-qpp="${esc(k)}" ${cur.has(k)?"checked":""} ${dis?"disabled":""}><span style="flex:1">${esc(l)}</span>${hard?pill("Chỉ CEO, Kế toán","gry"):no?pill("Lead không có quyền này","gry"):""}</label>`}).join("")}</section>`).join("")}
   ${QP.pt?`<div class="acts" style="position:sticky;bottom:10px"><button class="btn pri" id="qp-ps">${isU?"Lưu quyền":"Lưu mẫu"}</button>${isU&&u&&u.title?`<button class="btn" id="qp-pa1">Áp mẫu chức vụ ${esc(u.title)}</button>`:""}${!isU&&same.length?`<button class="btn" id="qp-pa">Áp mẫu cho ${same.length} người</button>`:""}</div>`:""}`;
  $("#qp-pt").onchange=e=>{QP.pt=e.target.value;renderMain()};
  if(!QP.pt)return;
  const picked=()=>[...s.querySelectorAll("[data-qpp]:checked:not(:disabled)")].map(x=>x.dataset.qpp);
  const merge=(old,pk)=>[...new Set((old||[]).filter(p=>!qpGrant(p)).concat(pk.filter(qpGrant)))];
  const setPerms=(ids,pk,msg)=>DB.mutate(ME.name,msg,d=>{ids.forEach(id=>{const x=d.users.find(y=>y.id===id);if(x&&qpManaged(x)){x.perms=merge(x.perms,pk);x.needPerm=false}})});
  $("#qp-ps").onclick=()=>{const pk=picked();
    if(isU){setPerms([key],pk,"phân quyền "+u.name+" (Quản trị phòng)");toast("Đã lưu quyền "+u.name)}
    else{DB.mutate(ME.name,"sửa mẫu quyền chức vụ "+key,d=>{d.qtpb=d.qtpb||{};d.qtpb.dept=d.qtpb.dept||{};const c=d.qtpb.dept[qpD()]=d.qtpb.dept[qpD()]||{};c.tpl=c.tpl||{};c.tpl[key]=pk.filter(qpGrant);c.hide=c.hide||[]});toast("Đã lưu mẫu "+key)}
    renderMain()};
  if($("#qp-pa1"))$("#qp-pa1").onclick=()=>{setPerms([key],qpTpl(u.title),"áp mẫu quyền "+u.title+" cho "+u.name);toast("Đã áp mẫu cho "+u.name);renderMain()};
  if($("#qp-pa"))$("#qp-pa").onclick=()=>{if(!confirm(`Đổi quyền của ${same.length} người chức vụ ${key} theo mẫu đang chọn?`))return;const pk=picked();
    DB.mutate(ME.name,"sửa mẫu quyền chức vụ "+key,d=>{d.qtpb=d.qtpb||{};d.qtpb.dept=d.qtpb.dept||{};const c=d.qtpb.dept[qpD()]=d.qtpb.dept[qpD()]||{};c.tpl=c.tpl||{};c.tpl[key]=pk.filter(qpGrant);c.hide=c.hide||[]});
    setPerms(same.map(x=>x.id),pk,`áp mẫu quyền ${key} cho ${same.length} người`);toast("Đã áp mẫu cho "+same.length+" người");renderMain()};
}
/* Cài đặt menu: trang Lead đang thấy (trừ trang luôn có), bật tắt cho nhân sự phòng. */
function qpMenuItems(){const out=[];QP.menuAll=true;try{MODULES.forEach(mo=>{if(mo.k==="me"||mo.k==="aiq"||mo.adm)return;let G=[];try{G=mo.groups()||[]}catch(e){}
  const its=[];G.forEach(([,L])=>(L||[]).forEach(i=>{if(!i||QP_ALWAYS.has(i[0])||/^qp_/.test(i[0])||its.some(x=>x[0]===i[0]))return;let ok=true;try{ok=!i[2]||i[2](ME)}catch(e){ok=false}if(ok)its.push(i)}));
  if(its.length)out.push([mo.n,its])})}finally{QP.menuAll=false}return out}
function qpTabMenu(s){
  const hide=new Set(qpDeptCfg(qpD()).hide||[]),G=qpMenuItems();
  s.innerHTML=`<p class="hint">Tắt một trang là ẩn trang đó khỏi menu của nhân sự phòng ${esc(qpPb(qpD()))} (Lead vẫn thấy đủ). Quyền xem dữ liệu vẫn theo tab Phân quyền. Luôn có, không tắt được: Của tôi, Chấm công, Việc của tôi, Tin nhắn.</p>
   <div class="grid2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">${G.map(([n,its])=>`<section class="card" style="margin:0"><h2 style="margin:0 0 6px">${esc(n)}</h2>${its.map(i=>`<label class="row4" style="align-items:center;gap:10px;padding:5px 0"><input type="checkbox" data-qpm="${esc(i[0])}" ${hide.has(i[0])?"":"checked"}><span>${esc(i[1])}</span></label>`).join("")}</section>`).join("")}</div>
   <div class="acts"><button class="btn pri" id="qp-ms">Lưu menu</button></div>`;
  $("#qp-ms").onclick=()=>{const off=[...s.querySelectorAll("[data-qpm]:not(:checked)")].map(x=>x.dataset.qpm);const keep=[...hide].filter(k=>!s.querySelector(`[data-qpm="${k}"]`));
    DB.mutate(ME.name,"cài đặt menu phòng "+qpPb(qpD()),d=>{d.qtpb=d.qtpb||{};d.qtpb.dept=d.qtpb.dept||{};const c=d.qtpb.dept[qpD()]=d.qtpb.dept[qpD()]||{};c.hide=[...new Set(off.concat(keep))];c.tpl=c.tpl||{}});
    toast("Đã lưu menu. Nhân sự phòng tải lại trang là thấy.");renderMain()};
}

/* ---------- Nhật ký ---------- */
function qpLogDesc(r){
  let b=null,a=null;try{b=JSON.parse(r.before_json)}catch(e){}try{a=JSON.parse(r.after_json)}catch(e){}
  if(r.action==="perms"&&Array.isArray(b)&&Array.isArray(a)){const on=a.filter(x=>!b.includes(x)),off=b.filter(x=>!a.includes(x));
    return `Quyền của <b>${esc(r.target_name)}</b>${on.length?`<div>Bật: ${on.map(x=>esc(qpPermLabel(x))).join(", ")}</div>`:""}${off.length?`<div>Tắt: ${off.map(x=>esc(qpPermLabel(x))).join(", ")}</div>`:""}`}
  if(r.action==="tpl"&&(Array.isArray(a)||Array.isArray(b))){const A=a||[],B=b||[],on=A.filter(x=>!B.includes(x)),off=B.filter(x=>!A.includes(x));
    return `Mẫu quyền chức vụ <b>${esc(r.target)}</b>${on.length?`<div>Bật: ${on.map(x=>esc(qpPermLabel(x))).join(", ")}</div>`:""}${off.length?`<div>Tắt: ${off.map(x=>esc(qpPermLabel(x))).join(", ")}</div>`:""}`}
  if(r.action==="menu"&&(Array.isArray(a)||Array.isArray(b))){const A=a||[],B=b||[],nm=k=>{for(const mo of MODULES){try{for(const [,L] of mo.groups()||[])for(const i of L||[])if(i&&i[0]===k)return i[1]}catch(e){}}return k},off=A.filter(x=>!B.includes(x)),on=B.filter(x=>!A.includes(x));
    return `Menu nhân sự phòng${off.length?`<div>Ẩn: ${off.map(x=>esc(nm(x))).join(", ")}</div>`:""}${on.length?`<div>Hiện lại: ${on.map(x=>esc(nm(x))).join(", ")}</div>`:""}`}
  if(r.action==="wf"&&a&&typeof a==="object"){const nm=k=>((typeof QK_WF!=="undefined"&&QK_WF.find(f=>f.id===k))||{ten:k}).ten;const ks=[...new Set(Object.keys(a).concat(Object.keys(b||{})))];
    return `Hạn duyệt của Lead (Work Flow)${ks.map(k=>`<div>${esc(nm(k))}: ${((b||{})[k]||{}).han||"—"} → ${(a[k]||{}).han||"—"} giờ</div>`).join("")}`}
  if(r.action==="rule"&&a)return `Ngưỡng cảnh báo hiệu suất: báo đỏ dưới ${(b||{}).ngay||80}% → ${a.ngay}% · gần đạt từ ${(b||{}).gan||80}% → ${a.gan}%`;
  return esc(r.summary||"");
}
function qpLogTable(rows,undo){
  const who=r=>esc(r.actor_name||"")+`<div class="hint">${({lead:"Lead",hr:"HCNS",ceo:"CEO"})[r.actor_role]||""}</div>`;
  return rows.length?tbl(["Lúc","Ai","Phòng","Thay đổi",""],rows.map(r=>`<tr class="${r.undone_at?"mut":""}"><td class="nowrap">${esc(qpDate(r.at))}</td><td>${who(r)}</td><td>${esc(qpPb(r.dept))}</td><td>${qpLogDesc(r)}</td>
   <td class="nowrap">${r.undone_at?pill("Đã hoàn tác","gry")+`<div class="hint">${esc(r.undone_name||"")} · ${esc(qpDate(r.undone_at))}</div>`:undo&&["perms","lock","menu","tpl","add","wf","rule","bang"].includes(r.action)?`<button class="btn sm" data-qpu="${r.id}">Hoàn tác</button>`:""}</td></tr>`)):`<p class="hint pad">Chưa có thay đổi nào.</p>`;
}
function pQpNk(m){
  if(!qpAct()){m.innerHTML=H("Nhật ký phòng","")+qpNo("Mục này dành cho Lead của phòng đã mở Quản trị phòng.");return}
  if(QP.logDept!==qpD()){QP.logDept=qpD();QP.log=null}
  qpLoadLog();
  m.innerHTML=qpDeptPick()+H("Nhật ký phòng","Mọi thay đổi trong Quản trị phòng của "+esc(qpPb(qpD()))+". CEO và Quản lý thấy cùng nhật ký này và hoàn tác được.")+`<section class="card flush">${QP.log?qpLogTable(QP.log,false):`<p class="hint pad">Đang tải…</p>`}</section>`;
}
function pQpLog(m){
  if(!(ME.role==="admin"||can(ME,"qtpb.hoantac"))){m.innerHTML=H("Nhật ký quản trị phòng","")+qpNo("Chỉ CEO và Quản lý xem được.");return}
  qpLoadLog();
  const pbs=D().departments;
  m.innerHTML=H("Nhật ký quản trị phòng","Lead đổi gì, lúc nào, ở phòng nào. CEO và Quản lý bấm Hoàn tác để trả về như trước.")+
   `<div class="filters"><select id="qp-ld">${opt([["","Tất cả phòng"]].concat(pbs.map(p=>[p.k,p.n])),QP.logDept)}</select><button class="btn sm" id="qp-lr">Tải lại</button></div>
   <section class="card flush">${QP.log?qpLogTable(QP.log,true):`<p class="hint pad">Đang tải…</p>`}</section>`;
  $("#qp-ld").onchange=e=>{QP.logDept=e.target.value;QP.log=null;renderMain()};
  $("#qp-lr").onclick=()=>{QP.log=null;qpLoadLog(true)};
  m.querySelectorAll("[data-qpu]").forEach(b=>b.onclick=()=>{const r=(QP.log||[]).find(x=>x.id===b.dataset.qpu);if(!r)return;
    if(!confirm("Hoàn tác thay đổi này?\n\n"+(r.summary||"")+(r.action==="lock"?"\n\nTài khoản đăng nhập sẽ được mở lại.":r.action==="add"?"\n\nTài khoản của người mới sẽ bị khóa.":"")))return;
    qpBusy(b,async()=>{await svApi(`/api/hub/qtpb/log/${r.id}/undo`,{method:"POST"});toast("Đã hoàn tác");QP.log=null;qpLoadLog(true);if(typeof svPoll==="function")svPoll()})});
}

/* ---------- HCNS / CEO: Người mới chờ duyệt ---------- */
function qpAddHub(x,crm){
  const cv=SV_CV.find(c=>c[0]===x.title);let role=cv?cv[1]:"nhanvien";if(!QP_NEWR.includes(role))role="nhanvien";
  const un=foldName(x.name).replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"")||"nv";
  DB.mutate(ME.name,"thêm nhân sự "+x.name+" (Quản trị phòng)",d=>{if(d.users.some(u=>u.crm===crm))return;const id=uid("u_");
    d.users.push({id,username:un,name:x.name,role,title:x.title||"",phongBan:x.dept,team:"",active:true,crm,perms:[],needPerm:true,cap:x.cap||""});
    if(typeof nsdbFromUser==="function")nsdbFromUser(d,id,null,x.start_date||hrNow().iso);
    const leads=qpLeadIds(d,x.dept);
    if(typeof notifyU==="function")notifyU(d,leads,`Người mới ${x.name} đã có tài khoản · vào Nhân sự › Nhân sự & phân quyền để set quyền`,"qp_ns")});
}
function qpShowPw(res,name){
  openDrawerHTML(`<h2>Đã tạo tài khoản cho ${esc(name)}</h2><p>Gửi cho người mới (qua Tin nhắn hoặc Zalo). Lần đầu đăng nhập phải đổi mật khẩu.</p>
   <section class="card"><div>Địa chỉ: <b>vanhanh.ailla.vn</b></div><div>Email: <b class="mono">${esc(res.email)}</b></div><div>Mật khẩu tạm: <b class="mono" id="qp-pw">${esc(res.password)}</b></div></section>
   <div class="acts"><button class="btn pri" id="qp-cp">Chép thông tin</button></div><p class="hint">Mật khẩu tạm chỉ hiện một lần này. Quên thì CEO đặt lại ở Tài khoản & phân quyền.</p>`);
  $("#qp-cp").onclick=()=>{const t=`Tài khoản web AILLA: vanhanh.ailla.vn\nEmail: ${res.email}\nMật khẩu tạm: ${res.password}\n(Lần đầu đăng nhập đổi mật khẩu)`;try{navigator.clipboard.writeText(t).then(()=>toast("Đã chép"),()=>toast("Chưa chép được, hãy bôi đen để chép"))}catch(e){toast("Chưa chép được, hãy bôi đen để chép")}};
}
function pQpMoi(m){
  if(!(ME.role==="admin"||hrOk())){m.innerHTML=H("Nhân sự các phòng","")+qpNo("Chỉ HCNS và CEO.");return}
  qpLoadReq();
  const c=qpCfg(),canOk=ME.role==="admin"||c.duyet==="HCNS";
  const R=QP.req,P=(R||[]).filter(r=>r.status==="PENDING"),done=(R||[]).filter(r=>r.status!=="PENDING").slice(0,30);
  const U=D().users.filter(u=>u.role!=="admin");
  const st=u=>u.active===false?pill("Đã nghỉ · đã khóa","gry"):u.needPerm?pill("Chờ Lead set quyền","red"):u.tt==="phep"?pill("Nghỉ phép","amb"):u.tt==="thaisan"?pill("Nghỉ thai sản","blu"):pill("Đang làm","grn");
  const depts=D().departments.filter(p=>U.some(u=>u.phongBan===p.k));
  const noDept=U.filter(u=>u.active!==false&&!D().departments.some(p=>p.k===u.phongBan));
  m.innerHTML=H("Nhân sự các phòng","Danh sách nhân sự đang làm theo từng phòng, ai là Lead, ai chờ set quyền; người mới Lead đề nghị chờ "+c.duyet+" duyệt ở trên cùng.")+
   `<div class="filters"><button class="btn pri" id="qp-hadd">+ Thêm người mới</button><span class="hint">Thêm thẳng, tạo tài khoản ngay. Lead phòng nhận thông báo để set quyền.</span></div>
   ${!R?`<p class="hint">Đang tải…</p>`:P.length?`<h2 style="margin:6px 0 8px">Lead đề nghị thêm người · chờ ${c.duyet} duyệt (${P.length})</h2>`+P.map(r=>`<section class="card"><div class="row4" style="align-items:center;gap:10px"><b style="font-size:16px">${esc(r.name)}</b>${pill("Chờ "+c.duyet+" duyệt","amb")}<span class="sp" style="flex:1"></span><span class="hint">${esc(r.by_name||"Lead")} gửi ${esc(qpDate(r.created_at))}</span></div>
     ${tbl(["Phòng","Chức vụ","Cấp","Loại","Ngày vào","Email"],[`<tr><td>${esc(qpPb(r.dept))}</td><td>${esc(r.title||"")}</td><td>${esc(r.cap||"")}</td><td>${esc(r.kind||"")}</td><td>${esc(qpDate(r.start_date))}</td><td class="mono">${esc(r.email)}</td></tr>`])}
     ${r.note?`<p class="hint">Ghi chú: ${esc(r.note)}</p>`:""}
     ${canOk?`<div class="acts"><button class="btn pri" data-qpok="${r.id}">Duyệt, tạo tài khoản</button><button class="btn" data-qpno="${r.id}">Trả lại</button></div>`:`<p class="hint">CEO đang đặt người mới do CEO duyệt.</p>`}</section>`).join(""):""}
   ${depts.map(p=>{const all=U.filter(u=>u.phongBan===p.k),on=all.filter(u=>u.active!==false),off=all.length-on.length,L=on.filter(qpDeptLead);
     return `<section class="card flush"><div class="row4 pad" style="align-items:center;gap:10px"><h2 style="margin:0">${esc(p.n)}</h2><span class="hint">${on.length} người${off?` · ${off} đã nghỉ`:""}</span><span class="sp" style="flex:1"></span><span>Lead: ${L.length?L.map(u=>"<b>"+esc(u.name)+"</b>").join(", "):`<span class="hint">chưa có</span>`}${c.depts.includes(p.k)?"":` <span class="hint">· chưa mở Quản trị phòng</span>`}</span></div>
      ${tbl(["Họ tên","Chức vụ","Cấp","Trạng thái","Tài khoản"],on.sort((a,b)=>qpDeptLead(b)-qpDeptLead(a)||String(a.name).localeCompare(String(b.name),"vi")).map(u=>`<tr><td><b>${esc(u.name)}</b>${qpDeptLead(u)?" "+pill("Lead","blu"):""}</td><td>${esc(u.title||ROLES[u.role]||"")}</td><td>${esc(u.cap||"")}</td><td>${st(u)}</td><td>${u.crm?"Có":`<span class="hint">chưa có</span>`}</td></tr>`))}</section>`}).join("")}
   ${noDept.length?`<section class="card"><h2 style="margin:0 0 6px">Chưa gắn phòng</h2><p>${noDept.map(u=>esc(u.name)).join(", ")}</p><p class="hint">Gắn phòng ở Tài khoản & phân quyền.</p></section>`:""}
   ${done.length?`<details class="card"><summary>Đề nghị đã xử lý gần đây (${done.length})</summary>${tbl(["Họ tên","Phòng","Kết quả","Ai xử lý","Lúc"],done.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(qpPb(r.dept))}</td><td>${r.status==="APPROVED"?pill("Đã tạo tài khoản","grn"):pill("Trả lại","red")+(r.reason?`<div class="hint">${esc(r.reason)}</div>`:"")}</td><td>${esc(r.decided_name||"")}</td><td>${esc(qpDate(r.decided_at))}</td></tr>`))}</details>`:""}`;
  m.querySelectorAll("[data-qpok]").forEach(b=>b.onclick=()=>{const r=P.find(x=>x.id===b.dataset.qpok);qpBusy(b,async()=>{
    const res=await svApi(`/api/hub/qtpb/requests/${r.id}/decide`,{method:"POST",body:JSON.stringify({approve:true})});
    qpAddHub(r,res.crm_id);qpShowPw(res,r.name);QP.req=null;qpLoadReq(true)})});
  m.querySelectorAll("[data-qpno]").forEach(b=>b.onclick=()=>{const r=P.find(x=>x.id===b.dataset.qpno);const why=prompt("Lý do trả lại (Lead sẽ thấy):","");if(why===null)return;
    qpBusy(b,async()=>{await svApi(`/api/hub/qtpb/requests/${r.id}/decide`,{method:"POST",body:JSON.stringify({approve:false,reason:why})});
      DB.mutate(ME.name,"trả lại đề nghị thêm "+r.name,d=>{const L=qpLeadIds(d,r.dept);if(typeof notifyU==="function")notifyU(d,L,`HCNS trả lại đề nghị thêm ${r.name}${why?": "+why:""}`,"qp_ns")});
      toast("Đã trả lại, Lead nhận thông báo");QP.req=null;qpLoadReq(true)})});
  $("#qp-hadd").onclick=()=>{
    const pbs=D().departments.filter(p=>ME.role==="admin"||p.k!=="HCNS");
    openDrawerHTML(`<h2>Thêm người mới</h2><p class="hint">Web tạo tài khoản ngay với quyền trống, tạo hồ sơ nhân sự; Lead phòng nhận thông báo để set quyền.</p>
     <form class="frm" id="qph"><div class="row4"><label class="field">Họ tên<input id="qh-n" required autocomplete="off"></label><label class="field">Email (dùng đăng nhập)<input id="qh-e" type="email" required autocomplete="off"></label></div>
     <div class="row4"><label class="field">Phòng<select id="qh-pb">${opt(pbs.map(p=>[p.k,p.n]),"CM")}</select></label><label class="field">Chức vụ<select id="qh-t" required>${opt(qpTitleOpts(),"")}</select></label><label class="field">Cấp<select id="qh-c">${opt(QP_CAP,"Thực tập sinh")}</select></label></div>
     <div class="row4"><label class="field">Ngày vào làm<input id="qh-d" type="date" value="${hrNow().iso}"></label><label class="field">Loại<select id="qh-k">${opt(QP_KIND,"Thử việc")}</select></label></div>
     <div class="acts"><button class="btn pri" id="qh-go">Thêm và báo Lead</button></div></form>`);
    $("#qph").onsubmit=e=>{e.preventDefault();qpBusy($("#qh-go"),async()=>{
      const x={name:$("#qh-n").value.trim(),email:$("#qh-e").value.trim(),dept:$("#qh-pb").value,title:$("#qh-t").value,cap:$("#qh-c").value,start_date:$("#qh-d").value,kind:$("#qh-k").value};
      const res=await svApi("/api/hub/qtpb/hr-add",{method:"POST",body:JSON.stringify(x)});
      qpAddHub(x,res.crm_id);qpShowPw(res,x.name);QP.req=null;qpLoadReq(true)})}};
}

/* ---------- CEO: Ranh giới quyền Lead ---------- */
const QP_CAPS=[["them","Thêm người mới (gửi duyệt)"],["khoa","Khóa người nghỉ, chuyển việc đang dở"],["quyen","Phân quyền trong phạm vi quyền của Lead"],["menu","Bật tắt menu của nhân sự phòng"],["wf","Work Flow: đặt hạn duyệt bước của Lead"],["kpi","KPI nhân sự: đặt ngưỡng, gửi định mức / chỉ tiêu cho CEO duyệt"],["bang","Tạo và sửa Bảng dữ liệu của phòng"]];
function pQpCfg(m){
  if(ME.role!=="admin"){m.innerHTML=H("Ranh giới quyền Lead","")+qpNo("Chỉ CEO.");return}
  const c=qpCfg(),on=new Set(c.depts),U=D().users.filter(u=>u.active!==false&&u.role!=="admin");
  const auto=k=>U.filter(u=>u.phongBan===k&&QP_LEADR.includes(u.role)).map(u=>u.name).join(", ");
  const cur=k=>Object.prototype.hasOwnProperty.call(c.leads,k)?c.leads[k]:"__auto";
  const undo=U.filter(u=>can(u,"qtpb.hoantac")).map(u=>u.name);
  const leadSel=p=>{const mem=U.filter(u=>u.phongBan===p.k);const a=auto(p.k);
    return `<select data-qpl="${esc(p.k)}" aria-label="Lead phòng ${esc(p.n)}">${opt([["__auto","Theo vai trò Trưởng nhóm"+(a?": "+a:" (chưa có ai)")],["","Chưa có Lead"]].concat(mem.map(u=>[u.id,u.name+(u.title?" · "+u.title:"")])),cur(p.k))}</select>`};
  m.innerHTML=H("Ranh giới quyền Lead","CEO chọn Lead từng phòng, mở Quản trị phòng cho phòng nào, Lead được tự làm gì, ai duyệt người mới. Phần khóa cứng không mở được cho Lead.")+
   `<section class="card flush"><div class="pad"><h2 style="margin:0 0 4px">Lead từng phòng</h2><p class="hint" style="margin:0">Chọn ai làm Lead. Danh sách lấy theo người đang ở phòng đó; muốn chọn người phòng khác thì đổi phòng của người đó ở Tài khoản & phân quyền trước.</p></div>
    ${tbl(["Phòng","Lead","Số người","Mở Quản trị phòng"],D().departments.map(p=>`<tr><td><b>${esc(p.n)}</b></td><td>${leadSel(p)}</td><td>${U.filter(u=>u.phongBan===p.k).length}</td><td>${p.k==="KT"?`<span class="hint">Không áp dụng</span>`:`<label class="row4" style="align-items:center;gap:8px"><input type="checkbox" data-qpd="${p.k}" ${on.has(p.k)?"checked":""}> Mở</label>`}</td></tr>`))}</section>
   <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
   <section class="card" style="margin:0"><h2 style="margin:0 0 6px">Lead được tự làm</h2><p class="hint">Áp cho Lead mọi phòng đã mở. Tắt mục nào thì Lead không thấy, máy chủ cũng chặn.</p>
    ${QP_CAPS.map(([k,t])=>`<label class="row4" style="align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed var(--line,#e7e9f0)"><input type="checkbox" data-qpcap="${k}" ${c.cap[k]===false?"":"checked"}><span>${esc(t)}</span></label>`).join("")}</section>
   <section class="card" style="margin:0"><h2 style="margin:0 0 6px">Người mới do ai duyệt</h2>${["HCNS","CEO"].map(o=>`<label class="row4" style="align-items:center;gap:10px;padding:6px 0"><input type="radio" name="qp-dy" value="${o}" ${c.duyet===o?"checked":""}><span>${o} duyệt</span></label>`).join("")}
    <p class="hint">Lead gửi đề nghị, người duyệt bấm Duyệt thì web tạo tài khoản. HCNS và CEO tự thêm người thì tạo ngay.</p>
    <h2 style="margin:14px 0 6px">Duyệt video final của CEO</h2><label class="row4" style="align-items:center;gap:10px"><input type="checkbox" id="qp-vc" ${((D().qtpb||{}).cfg||{}).videoCeo===false?"":"checked"}><span>Video final qua CEO duyệt sau khi Lead duyệt</span></label>
    <p class="hint">Tắt: Lead duyệt xong là video sang bước Đăng. Lead không tắt được.</p></section></div>
   <div class="acts" style="position:sticky;bottom:10px;margin:12px 0"><button class="btn pri" id="qp-cs">Lưu cài đặt</button></div>
   <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
   <section class="card" style="margin:0"><h2 style="margin:0 0 6px">Khóa cứng · chỉ CEO, Kế toán</h2><p class="hint">Lead không thấy, không cấp, không gỡ được.</p><ul><li>Tiền: chi, thu, công nợ</li><li>Giá vốn sản phẩm</li><li>Lợi nhuận, lãi lỗ</li><li>Lương, hồ sơ lương</li><li>Kho: nhập, xuất, kiểm kê</li><li>Cài đặt, sao lưu, xóa dữ liệu, khóa sổ</li><li>Phân quyền toàn công ty, đưa người sang phòng khác, mở lại tài khoản đã khóa</li><li>Duyệt định mức, chỉ tiêu Lead đặt</li></ul></section>
   <section class="card" style="margin:0"><h2 style="margin:0 0 6px">Ai được hoàn tác</h2><p>CEO${undo.length?" và "+esc(undo.join(", ")):""}.</p><p class="hint">Cấp cho Quản lý: Tài khoản & phân quyền › Phân quyền › tích "Hoàn tác thay đổi của Lead ở Quản trị phòng (Quản lý)".</p></section></div>`;
  $("#qp-cs").onclick=()=>{
    const ds=[...m.querySelectorAll("[data-qpd]:checked")].map(x=>x.dataset.qpd);
    const leads={};m.querySelectorAll("[data-qpl]").forEach(x=>{if(x.value!=="__auto")leads[x.dataset.qpl]=x.value});
    const cap={};m.querySelectorAll("[data-qpcap]").forEach(x=>{if(!x.checked)cap[x.dataset.qpcap]=false});
    const duyet=(m.querySelector('[name="qp-dy"]:checked')||{}).value==="CEO"?"CEO":"HCNS",videoCeo=$("#qp-vc").checked;
    const before=qpCfg().leads;
    DB.mutate(ME.name,"cài đặt Quản trị phòng (Lead từng phòng, phòng mở, Lead được tự làm, người duyệt)",d=>{d.qtpb=d.qtpb||{};d.qtpb.cfg=Object.assign({},d.qtpb.cfg||{},{depts:ds,leads,cap,duyet,videoCeo});
      if(typeof notifyU==="function")Object.entries(leads).forEach(([k,id])=>{if(id&&before[k]!==id)notifyU(d,[id],`CEO chọn bạn làm Lead phòng ${qpPb(k)} · vào Nhân sự › Quản trị phòng`,"qp_ns")})});
    toast("Đã lưu cài đặt");renderMain()};
}

Object.assign(PAGES,{qp_ns:pQpNs,qp_nk:pQpNk,qp_moi:pQpMoi,qp_log:pQpLog,qp_cfg:pQpCfg});

/* ---------- Menu ---------- */
{
  const lead=(u,k)=>u.role==="admin"||(qpIsLead(u)&&(!k||qpCfg().cap[k]!==false));
  const items=()=>[MI("qp_moi","Nhân sự các phòng",u=>u.role==="admin"||hrOk(),()=>{qpLoadReq();return qpPend()||""}),
    MI("qp_ns","Nhân sự & phân quyền",u=>lead(u),()=>qpNeed()||""),MI("qp_wf","Work Flow",u=>lead(u,"wf")),MI("qp_kpi","KPI nhân sự",u=>lead(u,"kpi")),MI("qp_bang","Bảng dữ liệu",u=>lead(u)),
    MI("qp_nk","Nhật ký phòng",u=>u.role!=="admin"&&qpIsLead(u)),
    MI("qp_ct","Chỉ tiêu chờ duyệt",u=>u.role==="admin",()=>(typeof qkAllPend==="function"&&qkAllPend().length)||""),MI("qp_hrkpi","Hiệu suất & lương thưởng",u=>u.role==="admin"||hrOk()),
    MI("qp_log","Nhật ký quản trị phòng",u=>u.role==="admin"||can(u,"qtpb.hoantac")),MI("qp_cfg","Ranh giới quyền Lead",u=>u.role==="admin")];
  /* Web vận hành: mục Nhân sự (Lead, HCNS, CEO, Quản lý). Web quản trị: Cấu hình (chỉ phần CEO / Quản lý / HCNS). */
  const add=(mo,keys)=>{if(!mo)return;const g0=mo.groups;mo.groups=function(){const G=g0.apply(this,arguments)||[];if(G.some(g=>g[0]==="Quản trị phòng"))return G;
    const its=items().filter(i=>(!keys||keys.includes(i[0]))&&(()=>{try{return !ME||i[2](ME)}catch(e){return false}})());return its.length?[["Quản trị phòng",its],...G]:G}};
  add(MODULES.find(x=>x.k==="hr"));
  add(MODULES.find(x=>x.k==="q_cfg"),["qp_moi","qp_ns","qp_wf","qp_kpi","qp_bang","qp_ct","qp_hrkpi","qp_log","qp_cfg"]);
  /* Trang Lead đã tắt: ẩn khỏi menu của nhân sự phòng đó (Lead, CEO vẫn thấy đủ). */
  MODULES.forEach(mo=>{if(mo.k==="me")return;const g=mo.groups;mo.groups=function(){const G=g.apply(this,arguments)||[];
    if(QP.menuAll||!ME||ME.role==="admin"||!ME.phongBan||qpIsLead(ME)||!qpCfg().depts.includes(ME.phongBan))return G;
    const h=qpDeptCfg(ME.phongBan).hide;if(!Array.isArray(h)||!h.length)return G;const S=new Set(h);
    return G.map(([n,its])=>[n,(its||[]).filter(i=>!i||QP_ALWAYS.has(i[0])||!S.has(i[0]))]).filter(x=>x[1].length)}});
}
