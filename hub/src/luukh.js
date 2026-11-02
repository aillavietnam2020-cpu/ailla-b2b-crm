/* =====================================================================
   NÚT LƯU CHO CÁC TRANG KẾ HOẠCH / PHÂN BỔ (Marketing)
   Ô nhập trên web vẫn tự lưu khi rời ô; nút Lưu để người dùng chắc chắn: bấm là chốt ô đang gõ dở,
   đẩy hết thay đổi lên máy chủ rồi báo "Đã lưu lúc …". Đang gõ chưa lưu thì nút sáng màu nhắc bấm.
   ===================================================================== */
const LKH={dirty:false,at:"",err:false};
const lkhOn=()=>{if(typeof ME==="undefined"||!ME||typeof MOD==="undefined")return false;const m=document.getElementById("main");if(!m)return false;
  if(MOD!=="mkt"&&PAGE!=="kehoach")return false;
  return m.querySelectorAll("input:not([type=search]):not([type=file]):not([type=checkbox]):not([disabled]):not(.spsi),textarea:not([disabled]),select:not([disabled])").length>=2};
function lkhDraw(){
  let b=document.getElementById("lkhbar");const on=lkhOn();
  if(!on){if(b)b.remove();return}
  if(!b){b=document.createElement("div");b.id="lkhbar";document.body.appendChild(b)}
  const busy=typeof SV!=="undefined"&&SV.pending&&SV.pending.length>0;
  const st=LKH.err?`<span class="lkhs bad">Chưa lưu được, bấm Lưu lại</span>`:LKH.dirty?`<span class="lkhs warn">Có thay đổi chưa lưu</span>`:busy?`<span class="lkhs">Đang lưu…</span>`:LKH.at?`<span class="lkhs ok">✓ Đã lưu lúc ${LKH.at}</span>`:"";
  b.innerHTML=`${st}<button type="button" class="btn sm${LKH.dirty||LKH.err?" pri":""}" id="lkhbtn">💾 Lưu</button>`;
  b.querySelector("#lkhbtn").onmousedown=e=>e.preventDefault();
  b.querySelector("#lkhbtn").onclick=lkhSave}
async function lkhSave(){
  const a=document.activeElement;if(a&&a!==document.body&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){a.dispatchEvent(new Event("change",{bubbles:true}));a.blur()}
  LKH.dirty=false;LKH.err=false;lkhDraw();
  if(typeof SV!=="undefined"&&SV.pending){
    if(SV.pending.length&&typeof svFlush==="function"){clearTimeout(SV.timer);try{await svFlush()}catch(e){}}
    for(let i=0;i<40&&SV.pending.length;i++)await new Promise(r=>setTimeout(r,250));
    if(SV.pending.length){LKH.err=true;lkhDraw();toast("Chưa lưu được lên máy chủ, kiểm tra mạng rồi bấm Lưu lại");return}}
  LKH.at=new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"});lkhDraw();toast("Đã lưu")}
(function(){
  const st=document.createElement("style");
  st.textContent=`#lkhbar{position:fixed;right:20px;bottom:72px;z-index:900;display:flex;align-items:center;gap:8px;background:var(--bg-surface-raised,#fff);border:1px solid var(--border-strong,#cbd5e1);border-radius:999px;padding:5px 6px 5px 12px;box-shadow:0 6px 18px rgba(0,0,0,.12);font-size:12.5px}
#lkhbar .lkhs{color:var(--text-muted,#6b7280);white-space:nowrap}#lkhbar .lkhs.ok{color:var(--success,#16a34a)}#lkhbar .lkhs.warn{color:var(--warning,#d97706);font-weight:600}#lkhbar .lkhs.bad{color:var(--danger,#dc2626);font-weight:600}
#lkhbar .btn{border-radius:999px}@media print{#lkhbar{display:none}}`;
  document.head.appendChild(st);
  const inMain=t=>t&&t.closest&&t.closest("#main")&&/^(INPUT|TEXTAREA)$/.test(t.tagName)&&!/^(search|file|checkbox)$/.test(t.type)&&!t.classList.contains("spsi");
  document.addEventListener("input",e=>{if(inMain(e.target)&&!LKH.dirty){LKH.dirty=true;LKH.err=false;lkhDraw()}},true);
  document.addEventListener("change",e=>{if(e.target&&e.target.closest&&e.target.closest("#main")){LKH.dirty=false;setTimeout(()=>{LKH.at=new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"});lkhDraw()},900)}},true);
  const _rm=renderMain;renderMain=function(){const r=_rm.apply(this,arguments);LKH.dirty=false;setTimeout(lkhDraw,0);return r};
  const _r=render;render=function(){const r=_r.apply(this,arguments);setTimeout(lkhDraw,0);return r};
})();
