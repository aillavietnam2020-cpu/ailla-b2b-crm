/* =====================================================================
   ẢNH ĐẠI DIỆN NHÂN SỰ (chị Hoa 05/11)
   - Mỗi người tự đổi ở Của tôi › Ảnh đại diện (thu nhỏ 160x160 ở trình duyệt trước khi gửi).
   - Ảnh lưu ở máy chủ, danh sách "ai có ảnh" tải một lần; chỗ nào hiện avatar chữ cái thì thay bằng ảnh nếu có.
   ===================================================================== */
const AVS={m:null,busy:false};
function avsLoad(force){if(AVS.busy||(AVS.m&&!force))return;AVS.busy=true;
  svApi("/api/hub/chat/avatars").then(m=>{const had=!!AVS.m;AVS.m=m||{};AVS.busy=false;if((!had&&Object.keys(AVS.m).length)||force){try{render()}catch(e){}}}).catch(()=>{AVS.m=AVS.m||{};AVS.busy=false})}
const avsUrl=id=>AVS.m&&id&&AVS.m[id]?"/api/hub/chat/avatar/"+encodeURIComponent(id)+"?v="+encodeURIComponent(AVS.m[id]):"";
function avsStyle(id,bg,fg){const u=avsUrl(id);return u?`background:url('${u}') center/cover no-repeat;color:transparent`:`background:${bg};color:${fg}`}
function avsResize(file){return new Promise((ok,no)=>{const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{const S=160,c=document.createElement("canvas");c.width=c.height=S;const x=c.getContext("2d"),m=Math.min(img.width,img.height),sx=(img.width-m)/2,sy=(img.height-m)/2;
    x.fillStyle="#fff";x.fillRect(0,0,S,S);x.drawImage(img,sx,sy,m,m,0,0,S,S);URL.revokeObjectURL(url);c.toBlob(b=>b?ok(b):no(new Error("Không đọc được ảnh")),"image/jpeg",.86)};
  img.onerror=()=>{URL.revokeObjectURL(url);no(new Error("Không đọc được ảnh này"))};img.src=url})}
PAGES.anhdaidien=m=>{avsLoad();const id=ME.id,u=avsUrl(id),ch=esc((ME.name||"?").trim().split(" ").pop()[0]||"");
  m.innerHTML=H("Ảnh đại diện","Ảnh hiện cạnh tên bạn ở Công việc và góc trên bên phải")+`<section class="card narrow" style="text-align:center">
   <div style="width:128px;height:128px;border-radius:50%;margin:8px auto 14px;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;${u?`background:url('${u}') center/cover no-repeat`:"background:#e7f0ff;color:#1c4fb8"}">${u?"":ch}</div>
   <input type="file" id="av-f" accept="image/jpeg,image/png,image/webp" hidden>
   <div class="row7" style="justify-content:center"><button class="btn pri" id="av-pick">${u?"Đổi ảnh":"Chọn ảnh"}</button>${u?`<button class="btn" id="av-del">Bỏ ảnh</button>`:""}</div>
   <p class="hint" id="av-msg" style="margin-top:10px">Chọn ảnh chụp mặt, web tự cắt vuông và thu nhỏ.</p></section>`;
  const msg=t=>{const e=m.querySelector("#av-msg");if(e)e.textContent=t};
  m.querySelector("#av-pick").onclick=()=>m.querySelector("#av-f").click();
  m.querySelector("#av-f").onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;
    try{msg("Đang tải ảnh lên…");const b=await avsResize(f),fd=new FormData();fd.set("file",b,"avatar.jpg");
      const r=await fetch("/api/hub/chat/avatar",{method:"POST",body:fd,credentials:"same-origin"});if(!r.ok){let t="Không lưu được ảnh";try{t=(await r.json()).error.message||t}catch(x){}throw new Error(t)}
      toast("Đã đổi ảnh đại diện");AVS.m=null;avsLoad(true)}catch(x){msg(x.message||"Không lưu được ảnh")}};
  const del=m.querySelector("#av-del");if(del)del.onclick=async()=>{try{const r=await fetch("/api/hub/chat/avatar",{method:"DELETE",credentials:"same-origin"});if(!r.ok)throw new Error("Không bỏ được ảnh");toast("Đã bỏ ảnh đại diện");AVS.m=null;avsLoad(true)}catch(x){msg(x.message)}}};
