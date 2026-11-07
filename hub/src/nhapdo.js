/* =====================================================================
   TỰ LƯU NHÁP PHIẾU ĐANG NHẬP DỞ (chị Hoa 07/11: Thảo lập phiếu bị mất do trang tải lại / vẽ lại)
   - Gõ hoặc chọn trong một khung nhập (trang chính, ngăn bên phải, hộp nổi): 0,6 giây sau lưu nháp vào trình duyệt.
   - Bấm nút Lưu / Ghi / Tạo / Gửi… rồi khung đó biến mất → coi là đã lưu → xóa nháp.
   - Khung biến mất mà KHÔNG bấm lưu (trang tải lại, web vẽ lại, lỡ tay đóng) → giữ nháp. Mở lại đúng trang/khung đó
     sẽ hiện dải "Có phiếu đang nhập dở … Điền lại / Bỏ". Điền lại các ô còn trên khung; dòng hàng thêm bằng nút thì
     thêm lại dòng rồi bấm Điền lại lần nữa.
   - Chỉ lưu trên máy đang dùng, theo từng tài khoản, giữ 24 giờ. Không lưu ô mật khẩu, ô tìm kiếm, ô chọn file.
   ===================================================================== */
const ND={t:0,wait:null,off:{},hit:0};
const ndUid=()=>(typeof SV!=="undefined"&&SV.me&&SV.me.id)||(typeof ME!=="undefined"&&ME&&ME.id)||"";
const ndKey=(pg,ctx)=>"ailla_nhapdo_"+ndUid()+"_"+pg+"_"+ctx;
const ndSkip=t=>!t||!/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||["password","file","search","hidden","button","submit"].includes(t.type)||(typeof svIsFind==="function"&&svIsFind(t));
function ndBox(t){const b=t.closest&&t.closest("#drawerIn,[id$='-modal-root'],dialog,#main");if(!b)return null;
  const ctx=b.id==="main"?"main":b.id==="drawerIn"?"dr:"+((b.querySelector("h2,h3,b")||{}).textContent||"").trim().slice(0,40):b.id||"dialog";return {b,ctx}}
const ndFields=b=>[...b.querySelectorAll("input,textarea,select")].filter(e=>!ndSkip(e));
function ndSnap(box){const F=ndFields(box.b);if(!F.length)return;
  const v=F.map((e,i)=>({i,id:e.id||"",nm:e.name||"",v:e.type==="checkbox"||e.type==="radio"?(e.checked?"1":""):e.value,ck:e.type==="checkbox"||e.type==="radio"?1:0}));
  /* Chỉ coi là phiếu khi người dùng đã tự gõ vào ô chữ/số (đổi ô lọc tháng, chọn danh sách thôi thì không lưu nháp). */
  if(!F.some(e=>(e.tagName==="TEXTAREA"||["text","number","tel","email",""].includes(e.type))&&e.value&&typeof SVD!=="undefined"&&SVD.els.has(e)))return;
  try{localStorage.setItem(ndKey(PAGE,box.ctx),JSON.stringify({at:Date.now(),pg:PAGE,ctx:box.ctx,n:F.length,v}))}catch(e){}}
function ndDel(pg,ctx){try{localStorage.removeItem(ndKey(pg,ctx))}catch(e){}}
function ndGet(pg,ctx){try{const d=JSON.parse(localStorage.getItem(ndKey(pg,ctx))||"null");if(d&&Date.now()-d.at<864e5)return d;if(d)ndDel(pg,ctx)}catch(e){}return null}
if(typeof document!=="undefined"){
  const on=e=>{const t=e.target;if(ndSkip(t)||typeof PAGE==="undefined")return;const box=ndBox(t);if(!box)return;
    clearTimeout(ND.t);ND.t=setTimeout(()=>{if(box.b.isConnected)ndSnap(box)},600)};
  document.addEventListener("input",on,true);document.addEventListener("change",on,true);
  /* Bấm nút lưu: nhớ khung + nháp; khung biến mất trong 8 giây → đã lưu xong → xóa nháp. */
  document.addEventListener("click",e=>{const btn=e.target.closest&&e.target.closest("button,input[type=submit],a.btn");if(!btn)return;
    const tx=(btn.textContent||btn.value||"").trim();if(!/lưu|ghi|tạo|gửi|xác nhận|hoàn tất|chốt|duyệt|thêm phiếu|lập phiếu|cập nhật/i.test(tx)||/nháp/i.test(tx))return;
    const box=ndBox(btn);if(!box)return;const pg=PAGE,first=ndFields(box.b)[0];
    ND.wait={pg,ctx:box.ctx,el:first,t0:Date.now()}},true);
  setInterval(()=>{try{
    const w=ND.wait;if(w){if(!w.el||!w.el.isConnected){ndDel(w.pg,w.ctx);ND.wait=null}else if(Date.now()-w.t0>8000)ND.wait=null}
    ndOffer()}catch(e){}},1200);
}
/* Dải gợi ý điền lại: đúng trang, khung đang mở, khung còn trống (chưa gõ lại). */
function ndOffer(){
  if(typeof PAGE==="undefined"||!ndUid()||document.getElementById("nd-bar"))return;
  const boxes=[];const dr=document.getElementById("drawer");
  if(dr&&!dr.hidden){const b=document.getElementById("drawerIn");if(b){const x=ndBox(b.querySelector("input,textarea,select")||b);if(x)boxes.push(x)}}
  document.querySelectorAll("[id$='-modal-root'],dialog[open]").forEach(r=>{const f=r.querySelector("input,textarea,select");if(f){const x=ndBox(f);if(x)boxes.push(x)}});
  const mf=document.querySelector("#main input,#main textarea,#main select");if(mf){const x=ndBox(mf);if(x)boxes.push(x)}
  for(const box of boxes){const d=ndGet(PAGE,box.ctx);if(!d||ND.off[d.at])continue;
    const F=ndFields(box.b);if(!F.length)continue;
    const dirty=F.some(e=>typeof SVD!=="undefined"&&SVD.els&&SVD.els.has(e));if(dirty)continue;
    ndBar(box,d);return}
}
function ndBar(box,d){const hm=new Date(d.at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}),n=d.v.filter(x=>x.v).length;
  const bar=document.createElement("div");bar.id="nd-bar";bar.setAttribute("role","status");
  bar.style.cssText="position:sticky;top:0;z-index:50;display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#fff7e0;border:1px solid #f0c75e;border-radius:10px;padding:8px 12px;margin:0 0 10px;font-size:14px";
  bar.innerHTML=`<span style="flex:1;min-width:180px">📝 Có phiếu đang nhập dở lúc <b>${hm}</b> (${n} ô đã điền). Điền lại?</span><button type="button" class="btn pri sm" id="nd-yes">Điền lại</button><button type="button" class="btn sm" id="nd-no">Bỏ</button>`;
  box.b.insertBefore(bar,box.b.firstChild);
  const close=()=>{ND.off[d.at]=1;bar.remove()};
  bar.querySelector("#nd-no").onclick=()=>{ndDel(d.pg,d.ctx);close()};
  bar.querySelector("#nd-yes").onclick=()=>{const k=ndFill(box.b,d);close();
    if(typeof toast==="function")toast(k>=d.v.filter(x=>x.v).length?"Đã điền lại phiếu đang nhập dở":`Đã điền lại ${k} ô. Dòng hàng thêm bằng nút: thêm lại dòng rồi điền tiếp.`)}}
function ndFill(b,d){const F=ndFields(b);let k=0;const set=(e,x)=>{if(!e||!x.v&&!x.ck)return;
    if(x.ck){e.checked=!!x.v}else{if(e.tagName==="SELECT"&&![...e.options].some(o=>o.value===x.v))return;e.value=x.v}
    e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));if(x.v)k++};
  const same=F.length===d.n;
  d.v.forEach(x=>{let e=x.id?b.querySelector("#"+CSS.escape(x.id)):null;if(!e&&x.nm)e=b.querySelector(`[name="${CSS.escape(x.nm)}"]`);if(!e&&same)e=F[x.i];set(e,x)});
  return k}
