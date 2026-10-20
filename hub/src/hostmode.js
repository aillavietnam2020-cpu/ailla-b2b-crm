/* =====================================================================
   NÚT CHUYỂN GIỮA TRANG VẬN HÀNH VÀ TRANG QUẢN TRỊ
   Chỉ hiện khi máy chủ đã cấu hình hai địa chỉ (HOST_MODE, OPS_URL, ADMIN_URL do máy chủ điền vào trang).
   ===================================================================== */
function hmEnsure(){
  if(typeof ME==="undefined"||!ME||!document.body)return;
  let b=document.getElementById("hm-link");
  const isCeo=ME.role==="admin",isAcc=typeof SV!=="undefined"&&(SV.perms||[]).includes("debt.read.all");
  const want=HOST_MODE==="admin"
    ?(OPS_URL?{t:"← Về trang vận hành",u:OPS_URL}:null)
    :(ADMIN_URL&&(isCeo||isAcc)?{t:"Trang quản trị ↗",u:ADMIN_URL}:null);
  if(!want){if(b)b.remove();return}
  /* Đặt ở chân thanh bên trái (cạnh Đăng xuất) để không che số trang hay nút bấm ở góc phải màn hình. */
  const me=document.querySelector("aside .me");
  if(!me){if(b)b.remove();return}
  if(!b||b.parentElement!==me){
    if(b)b.remove();
    b=document.createElement("a");b.id="hm-link";b.className="lnk";
    b.style.cssText="display:block;margin-top:6px;font-size:13px;text-decoration:none";
    me.appendChild(b)
  }
  if(b.textContent!==want.t)b.textContent=want.t;
  if(b.getAttribute("href")!==want.u)b.setAttribute("href",want.u)
}
setInterval(()=>{try{hmEnsure()}catch(e){}},1500);
