/* =====================================================================
   THÊM KÊNH (chị Hoa 02/11/2026)
   4 kênh gốc nằm cố định trong CHANNELS (core.js). Kênh Lead / CEO thêm sau lưu ở D().kenhThem
   và được nối vào CHANNELS mỗi lần vẽ trang, nên mọi chỗ đang dùng CHANNELS (Kế hoạch, Điều phối,
   Calendar, Tổng quan…) tự có kênh mới. Mã kênh = tên kênh, không đổi sau khi tạo để không lệch số liệu.
   ===================================================================== */
function kenhSync(){
  const d=typeof D==="function"?D():null;if(!d||!Array.isArray(d.kenhThem))return;
  d.kenhThem.forEach(x=>{if(x&&x.k&&!CHANNELS.some(c=>c.k===x.k))CHANNELS.push({k:x.k,short:x.short||x.k,needId:x.needId!==false,acc:x.acc||"",tab:"",them:true})})}
function kenhAddOpen(){
  const team=(D().users||[]).filter(u=>u.active!==false&&["lead","content","nhanvien","truongphong","admin"].includes(u.role)).map(u=>[u.id,u.name]);
  openDrawerHTML(`<h2 class="dtitle">Thêm kênh</h2><p class="hint">Kênh mới hiện ngay ở Kế hoạch, Điều phối, Calendar và Tổng quan. Tên kênh không đổi được sau khi tạo.</p>
   <div class="frm kfrm">
    <label class="field full">Tên kênh<input id="kna-n" placeholder="Ví dụ: Ailla Home"></label>
    <label class="field">Loại kênh<select id="kna-t">${opt([["tt","TikTok (đăng video, cần ID video)"],["fb","Fanpage / kênh khác (đăng bài)"]],"tt")}</select></label>
    <label class="field">Tài khoản<input id="kna-a" placeholder="@tên tài khoản hoặc tên Fanpage"></label>
    <label class="field">Người giữ kênh<select id="kna-u">${opt([["","— chưa đặt"]].concat(team),"")}</select></label>
   </div><div class="acts"><button class="btn pri" id="kna-ok">Thêm kênh</button><button class="btn ghost" id="kna-x">Hủy</button></div>`);
  const q=i=>document.querySelector("#drawerIn "+i);q("#kna-x").onclick=closeDrawer;
  q("#kna-ok").onclick=()=>{
    const n=q("#kna-n").value.trim().replace(/\s+/g," "),f=s=>String(s||"").toLowerCase();
    if(n.length<2){toast("Nhập tên kênh");return}
    if(CHANNELS.some(c=>f(c.k)===f(n)||f(c.short)===f(n))){toast("Đã có kênh tên này");return}
    const needId=q("#kna-t").value==="tt",acc=q("#kna-a").value.trim().replace(/^@/,""),u=q("#kna-u").value;
    DB.mutate(ME.name,"thêm kênh "+n,dt=>{dt.kenhThem=dt.kenhThem||[];dt.kenhThem.push({k:n,short:n,needId,acc,by:ME.name,at:new Date().toLocaleString("vi-VN")});
      if(u){dt.kenhPT=dt.kenhPT||{};dt.kenhPT[n]={chinh:u,phu:""}}});
    kenhSync();if(typeof WP_K!=="undefined")WP_K=n;closeDrawer();toast("Đã thêm kênh "+n);renderMain()}}
(function(){
  const _rm=renderMain;renderMain=function(){kenhSync();return _rm.apply(this,arguments)};
  const _r=render;render=function(){kenhSync();return _r.apply(this,arguments)};
  document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-kadd]");if(b){e.preventDefault();kenhAddOpen()}});
})();
