/* =====================================================================
   ĐỒNG BỘ Tài khoản & phân quyền ↔ hồ sơ Nhân sự (chị Hoa 02/11/2026). Hàm thuần, không đụng giao diện.
   - Nối hai bên bằng users[].maNS = staff[].ma. Tài khoản chưa nối thì tìm hồ sơ trùng tên (chưa nối ai) để nối,
     không có thì tạo hồ sơ mới (người mới chị thêm ở Cấu hình › Tài khoản là bên Nhân sự có luôn).
   - Chỉ chép những ô vừa đổi (fields), để đổi vai trò không vô tình đổi trạng thái hồ sơ.
   - Trạng thái: tài khoản khóa = "Đã nghỉ"; nghỉ phép / thai sản giữ tài khoản. "Đã nghỉ" bên Nhân sự = khóa tài khoản
     (máy chủ khóa luôn tài khoản đăng nhập, đá khỏi phiên). Mở lại tài khoản chỉ CEO (canUnlock).
   ===================================================================== */
const NSDB_TT={phep:"Nghỉ phép",thaisan:"Nghỉ thai sản"};
const nsdbFold=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/gi,"d").toLowerCase().replace(/\s+/g," ").trim();
const nsdbLeft=t=>/^đã nghỉ|nghỉ việc/i.test(t||"");
const nsdbAway=t=>/nghỉ|thai sản/i.test(t||"");
/* Trạng thái hồ sơ theo tài khoản; quay lại làm thì "Chính thức" (đang thử việc / theo giờ thì giữ nguyên). */
function nsdbStaffTT(u,old){if(u.active===false)return "Đã nghỉ";if(NSDB_TT[u.tt])return NSDB_TT[u.tt];return nsdbAway(old)?"Chính thức":(old||"Thử việc")}
/* Trạng thái tài khoản theo hồ sơ. "Tạm nghỉ" coi như nghỉ phép. */
function nsdbUserTT(t){if(nsdbLeft(t))return {active:false,tt:""};if(/thai sản/i.test(t||""))return {active:true,tt:"thaisan"};if(nsdbAway(t))return {active:true,tt:"phep"};return {active:true,tt:""}}
function nsdbNextMa(dt){const n=Math.max(0,...(dt.staff||[]).map(x=>+String(x.ma).replace(/\D/g,"")||0))+1;return "NV"+String(n).padStart(3,"0")}
const nsdbKhoi=(dt,pb,old)=>((dt.departments||[]).find(p=>p.k===pb)||{}).khoi||old||"Văn phòng";

/* Tài khoản → hồ sơ. fields ⊆ ["pb","title","tt"], bỏ trống = cả ba. Trả {r, created} hoặc null. */
function nsdbFromUser(dt,uid,fields,today){
  const u=(dt.users||[]).find(x=>x.id===uid);if(!u)return null;dt.staff=dt.staff||[];
  const F=fields&&fields.length?fields:["pb","title","tt"];
  let r=u.maNS?dt.staff.find(x=>x.ma===u.maNS):null,created=false;
  if(!r){const used=new Set(dt.users.filter(x=>x.maNS).map(x=>x.maNS)),same=dt.staff.filter(x=>!used.has(x.ma)&&nsdbFold(x.ten)===nsdbFold(u.name));
    if(same.length===1)r=same[0];
    else{if(u.active===false||u.role==="admin")return null;
      r={ma:nsdbNextMa(dt),ten:u.name,khoi:nsdbKhoi(dt,u.phongBan),pb:u.phongBan||"",viTri:u.title||"",ql:"",ngayVao:today||"",tt:"Thử việc",hd:"",nghe:"",bac:""};dt.staff.push(r);created=true}
    u.maNS=r.ma}
  if(F.includes("pb")&&u.phongBan!==undefined&&u.phongBan!==r.pb){r.pb=u.phongBan||"";r.khoi=nsdbKhoi(dt,r.pb,r.khoi)}
  if(F.includes("title")&&(u.title||"").trim())r.viTri=u.title.trim();
  if(F.includes("tt"))r.tt=nsdbStaffTT(u,r.tt);
  return {r,created};
}

/* Hồ sơ → tài khoản. fields ⊆ ["pb","viTri","tt"]. Trả {u, lock, unlock, held} hoặc null (chưa nối tài khoản).
   held = hồ sơ quay lại làm nhưng người sửa không phải CEO nên tài khoản vẫn khóa. */
function nsdbFromStaff(dt,ma,fields,canUnlock){
  const r=(dt.staff||[]).find(x=>x.ma===ma),u=r&&(dt.users||[]).find(x=>x.maNS===ma);if(!u)return null;
  const F=fields&&fields.length?fields:["pb","viTri","tt"],was=u.active!==false;let held=false;
  /* Phòng HCNS kéo theo quyền xem lương: chỉ CEO đưa ai vào / ra (máy chủ cũng chặn). */
  if(F.includes("pb")&&u.role!=="admin"&&(canUnlock||(r.pb!=="HCNS"&&u.phongBan!=="HCNS")))u.phongBan=r.pb||"";
  if(F.includes("viTri")&&(r.viTri||"").trim())u.title=r.viTri.trim();
  if(F.includes("tt")){const s=nsdbUserTT(r.tt);
    if(u.role==="admin")s.active=true;
    if(s.active&&!was&&!canUnlock){held=true;s.active=false;s.tt=""}
    u.active=s.active;u.tt=s.tt}
  return {u,lock:was&&u.active===false,unlock:!was&&u.active!==false,held};
}
/* Trạng thái chọn được ở hồ sơ Nhân sự. */
const NS_TT=["Thử việc","Chính thức","Theo giờ","Nghỉ phép","Nghỉ thai sản","Tạm nghỉ","Đã nghỉ"];
/* Câu báo sau khi sửa hồ sơ, nói rõ tài khoản đăng nhập có đổi theo không. */
function nsdbToast(sy){if(!sy)return "Đã lưu";if(sy.lock)return "Đã lưu. Tài khoản đăng nhập của "+sy.u.name+" đã khóa (Đã nghỉ)";if(sy.held)return "Đã lưu hồ sơ. Tài khoản đăng nhập vẫn khóa, nhờ CEO mở lại ở Tài khoản & phân quyền";if(sy.unlock)return "Đã lưu, mở lại tài khoản đăng nhập của "+sy.u.name;return "Đã lưu, cập nhật cả Tài khoản & phân quyền"}
