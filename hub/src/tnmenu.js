/* =====================================================================
   MENU TIN NHẮN KIỂU TELEGRAM (chị Hoa 04/11/2026)
   Chuột phải (điện thoại: giữ lâu) hoặc nút ⋯ trên một tin: hàng thả cảm xúc + Trả lời, Trích dẫn (bôi đen một đoạn
   trong tin rồi bấm), Sao chép / Sao chép đoạn đã chọn, Giao việc, Nhắc tôi, Ghim, Chuyển tiếp, Chọn nhiều tin,
   Thu hồi (người gửi hoặc CEO, xóa với mọi người) và Xóa (chỉ ẩn ở máy mình).
   Máy chủ: tin trả lời ref 'q:<mã>[:<đoạn trích>]', chuyển tiếp ref 'fw:<tên>', ghim là tin loại 'pin' (ref 'p:<mã>',
   nội dung rỗng = bỏ ghim), thu hồi POST /msgs/:id/recall (tin gốc thành 'recall', thêm dấu 'unsend' ref 'x:<mã>').
   ===================================================================== */
const TNM={sel:null,selRoom:"",reply:{}};
const tnHidK=()=>"tn_hide_"+tnMe();
const tnHid=()=>{try{return new Set(JSON.parse(localStorage.getItem(tnHidK())||"[]"))}catch(e){return new Set()}};
const tnHide=ids=>{const s=tnHid();ids.forEach(i=>s.add(+i));try{localStorage.setItem(tnHidK(),JSON.stringify([...s].slice(-3000)))}catch(e){}};
const tnTxt=m=>!m?"":m.kind==="recall"?"Tin nhắn đã thu hồi":m.kind==="file"?"📎 "+((tnFMeta(m.room||TN.room,String(m.ref||"").replace(/^f:/,""))||{}).name||m.body||"Tệp"):m.kind==="task"?"📋 "+m.body:String(m.body||"");
const tnFind=(room,id)=>(TN.msgs[room]||[]).find(x=>x.id===+id);
const tnPinOf=room=>{const L=TN.msgs[room]||[];for(let i=L.length-1;i>=0;i--)if(L[i].kind==="pin")return L[i].body?{id:+String(L[i].ref).slice(2),by:L[i].user_id,body:L[i].body}:null;return null};
const tnCanRecall=m=>!!m&&!m.old&&m.id&&!String(TN.room).startsWith("ag:")&&["","file","task"].includes(m.kind)&&(m.user_id===tnMe()||ME.role==="admin");
/* áp dấu thu hồi vào tin gốc (máy đang mở phòng nhận dấu qua lần tải tin mới) */
function tnApplyUnsend(room){(TN.msgs[room]||[]).forEach(m=>{if(m.kind!=="unsend")return;const o=tnFind(room,String(m.ref).slice(2));if(o&&o.kind!=="recall"){o.kind="recall";o.body="";o.ref=""}})}

/* ---------- vẽ: bỏ dấu, ẩn tin đã xóa, khối trả lời / chuyển tiếp, tin ghim, thu hồi ---------- */
const _tnMsgsHtmlM=tnMsgsHtml;
tnMsgsHtml=function(room){const L0=TN.msgs[room];if(!L0)return _tnMsgsHtmlM(room);tnApplyUnsend(room);const hid=tnHid();
  TN.msgs[room]=L0.filter(m=>m.kind!=="unsend"&&!hid.has(m.id));try{return _tnMsgsHtmlM(room)}finally{TN.msgs[room]=L0}};
const tnQuoteHtml=m=>{const r=String(m.ref||"");let x=/^q:(\d+)(?::([\s\S]*))?$/.exec(r);
  if(x){const o=tnFind(TN.room,x[1]),t=o&&o.kind==="recall"?"Tin nhắn đã thu hồi":x[2]||tnTxt(o)||"Tin cũ";return `<div class="tnqt" data-tnq="${x[1]}"><b>${esc(o?tnUN(o.user_id)||"":"Trả lời")}</b><span>${esc(t.slice(0,160))}</span></div>`}
  x=/^fw:(.+)$/.exec(r);return x?`<div class="tnfw">↪ Chuyển tiếp từ <b>${esc(x[1])}</b></div>`:""};
const _tnMsgHtmlM=tnMsgHtml;
tnMsgHtml=function(m,prev){
  if(m.kind==="pin"){const o=tnFind(TN.room,String(m.ref).slice(2));return `<div class="tnsys">📌 ${esc(m.user_id===tnMe()?"Bạn":tnUN(m.user_id)||"")} ${m.body?`đã ghim: <button type="button" class="lnk" data-tnq="${String(m.ref).slice(2)}">${esc(String(m.body).slice(0,60))}</button>`:"đã bỏ ghim tin"}${o||!m.body?"":""}</div>`}
  if(m.kind==="recall"){const me=m.user_id===tnMe();return `<div class="tnm${me?" me":""}" data-mid="${m.id}">${me?`<i class="tnav sp"></i>`:tnAv(m.user_id,tnUN(m.user_id))}<div class="tnmb"><div class="tnmh">${me?"":`<b>${esc(tnUN(m.user_id)||"")}</b>`}<small>${new Date(m.created_at).toTimeString().slice(0,5)}</small></div><div class="tnbub tnrec">🚫 Tin nhắn đã thu hồi</div></div></div>`}
  let h=_tnMsgHtmlM(m,prev);if(m.old)return h;
  if(!m.kind&&m.ref){const q=tnQuoteHtml(m);if(q)h=h.replace('<div class="tnbub">','<div class="tnbub">'+q)}
  /* chị Hoa 04/11: rê chuột vào tin chỉ hiện nút ⋯, mọi việc (thả cảm xúc, trả lời, giao việc, nhắc…) nằm trong menu */
  h=h.replace(/<span class="tnma">[\s\S]*?<\/span>/,'<span class="tnma"><button title="Thả cảm xúc, trả lời, sao chép, giao việc, nhắc, ghim, chuyển tiếp, thu hồi…" data-tnmore="1">⋯</button></span>');
  if(TNM.sel&&TNM.selRoom===TN.room)h=h.replace('<div class="tnm','<div class="tnm tnpick'+(TNM.sel.has(m.id)?" on":""));
  return h};
const _tnDrawMsgsM=tnDrawMsgs;
tnDrawMsgs=function(keepPos){_tnDrawMsgsM(keepPos);const el=$("#tnmsgs");if(!el)return;const room=TN.room;
  if(TNM.sel&&TNM.selRoom!==room)TNM.sel=null;
  const pin=tnPinOf(room);
  if(TNM.sel)el.insertAdjacentHTML("afterbegin",`<div class="tnselbar"><b>Đã chọn ${TNM.sel.size} tin</b><span class="sp"></span><button type="button" class="btn sm" data-tns="copy">Sao chép</button><button type="button" class="btn sm" data-tns="fw">Chuyển tiếp</button><button type="button" class="btn sm danger" data-tns="del">Xóa</button><button type="button" class="btn sm ghost" data-tns="x">Hủy</button></div>`);
  else if(pin)el.insertAdjacentHTML("afterbegin",`<div class="tnpinb" data-tnq="${pin.id}"><i>📌</i><span><b>Tin ghim</b><small>${esc(pin.body.slice(0,90))}</small></span><button type="button" class="tnpx" data-tnunpin="${pin.id}" title="Bỏ ghim">✕</button></div>`);
  el.querySelectorAll("[data-tnq]").forEach(b=>b.onclick=e=>{if(e.target.closest("[data-tnunpin]"))return;e.stopPropagation();tnJump(b.dataset.tnq)});
  el.querySelectorAll("[data-tnunpin]").forEach(b=>b.onclick=e=>{e.stopPropagation();tnPin(room,+b.dataset.tnunpin,false)});
  el.querySelectorAll("[data-tnmore]").forEach(b=>b.onclick=e=>{e.stopPropagation();const r=b.getBoundingClientRect();tnMenu(+b.closest("[data-mid]").dataset.mid,r.left,r.bottom)});
  el.querySelectorAll("[data-tnmr]").forEach(b=>b.onclick=e=>{e.stopPropagation();tnReplyTo(tnFind(room,b.closest("[data-mid]").dataset.mid),"")});
  el.querySelectorAll(".tnm[data-mid]").forEach(x=>{const id=+x.dataset.mid;if(!id)return;
    x.oncontextmenu=e=>{if(TNM.sel)return;e.preventDefault();tnMenu(id,e.clientX,e.clientY)};
    if(TNM.sel)x.onclick=e=>{e.preventDefault();e.stopPropagation();TNM.sel.has(id)?TNM.sel.delete(id):TNM.sel.add(id);tnDrawMsgs(true)}});
  el.querySelectorAll("[data-tns]").forEach(b=>b.onclick=e=>{e.stopPropagation();const L=(TN.msgs[room]||[]).filter(m=>TNM.sel.has(m.id)).sort((a,c)=>a.id-c.id),k=b.dataset.tns;
    if(k==="x"){TNM.sel=null;tnDrawMsgs(true);return}if(!L.length){toast("Chưa chọn tin nào");return}
    if(k==="copy"){tnCopy(L.map(m=>(L.length>1?(tnUN(m.user_id)||"")+": ":"")+tnTxt(m)).join("\n"));TNM.sel=null;tnDrawMsgs(true)}
    else if(k==="fw")tnForward(L);
    else if(k==="del"&&confirm(`Xóa ${L.length} tin ở máy của bạn? Người khác vẫn thấy. Muốn xóa với mọi người thì dùng Thu hồi.`)){tnHide(L.map(m=>m.id));TNM.sel=null;tnDrawMsgs(true)}});
  tnRepDraw(room)};
function tnJump(id){const x=document.querySelector(`#tnmsgs [data-mid="${id}"]`);if(!x){toast("Tin này ở xa phía trên, bấm Xem tin cũ hơn để tìm");return}x.scrollIntoView({behavior:"smooth",block:"center"});x.classList.add("tnflash");setTimeout(()=>x.classList.remove("tnflash"),1600)}
function tnCopy(t){const ok=()=>toast("Đã sao chép");if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,()=>tnCopyOld(t));else tnCopyOld(t)}
function tnCopyOld(t){const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");toast("Đã sao chép")}catch(e){toast("Không sao chép được")}a.remove()}

/* ---------- trả lời / trích dẫn: thanh nằm trên ô gõ, gửi tin là kèm ---------- */
function tnReplyTo(m,snip){if(!m)return;TNM.reply[TN.room]={id:m.id,who:tnUN(m.user_id)||"",snip:String(snip||"").trim().slice(0,200)};tnRepDraw(TN.room);const i=$("#tnin");if(i)i.focus()}
function tnRepDraw(room){const f=$("#tnf");if(!f)return;let b=$("#tnrep");const r=TNM.reply[room];
  if(!r){if(b)b.remove();return}const m=tnFind(room,r.id),t=r.snip||tnTxt(m);
  if(!b){b=document.createElement("div");b.id="tnrep";b.className="tnrep";f.parentNode.insertBefore(b,f)}
  b.innerHTML=`<i>${r.snip?"❝":"↩"}</i><span><b>${r.snip?"Trích dẫn":"Trả lời"} ${esc(r.who)}</b><small>${esc(t.slice(0,120))}</small></span><button type="button" class="tnpx" title="Bỏ">✕</button>`;
  b.querySelector("button").onclick=()=>{delete TNM.reply[room];tnRepDraw(room)}}
const _tnSendM=tnSend;
tnSend=async function(room,body,kind,ref){const r=!kind&&!ref&&!String(room).startsWith("ag:")?TNM.reply[room]:null;
  if(r){ref="q:"+r.id+":"+(r.snip||tnTxt(tnFind(room,r.id)).slice(0,120))}
  const m=await _tnSendM(room,body,kind,ref);if(r){delete TNM.reply[room];tnRepDraw(room)}return m};

/* ---------- ghim, thu hồi, chuyển tiếp ---------- */
async function tnPin(room,id,on){const m=tnFind(room,id);try{await tnSend(room,on?(tnTxt(m).slice(0,140)||"Tin nhắn"):"","pin","p:"+id);tnDrawMsgs(true);tnDrawList()}catch(e){toast(e.message||"Chưa ghim được")}}
async function tnRecall(room,m){if(!confirm("Thu hồi tin này? Mọi người trong cuộc trò chuyện sẽ chỉ thấy dòng \"Tin nhắn đã thu hồi\"."))return;
  try{await svApi(`/api/hub/chat/msgs/${m.id}/recall`,{method:"POST",body:"{}"});m.kind="recall";m.body="";m.ref="";await tnLoad(room);tnDrawMsgs(true);tnDrawList();toast("Đã thu hồi")}catch(e){toast(e.message||"Chưa thu hồi được")}}
function tnForward(L){const ov=document.createElement("div");ov.className="wpmodal";let q="";
  const rooms=()=>{const q0=TN.q;TN.q=q;try{return tnListRows().filter(r=>!r.room.startsWith("ag:"))}finally{TN.q=q0}};
  const paint=()=>{const R=rooms();ov.querySelector(".tnfwl").innerHTML=R.map(r=>`<button type="button" class="tnrow" data-fw="${esc(r.room)}">${tnAv(/^(g|p|n):/.test(r.room)?r.room:tnOther(r.room),tnName(r.room),/^(g|p|n):/.test(r.room))}<span class="tnrb"><b>${esc(tnName(r.room))}</b></span></button>`).join("")||`<p class="hint">Không thấy nhóm hoặc người nào</p>`;
    ov.querySelectorAll("[data-fw]").forEach(b=>b.onclick=async()=>{const to=b.dataset.fw;ov.remove();let n=0;
      for(const m of L){const t=tnTxt(m);if(!t||m.kind==="recall")continue;try{await tnSend(to,t,"","fw:"+((tnUN(m.user_id)||"?").slice(0,60)));n++}catch(e){toast(e.message||"Chưa chuyển được");break}}
      TNM.sel=null;toast(`Đã chuyển tiếp ${n} tin tới ${tnName(to)}`);if(to===TN.room)tnDrawMsgs();else tnDrawMsgs(true);tnDrawList()})};
  ov.innerHTML=`<div class="wpmbox tnfwbox"><div class="wpmh"><b>Chuyển tiếp ${L.length} tin tới…</b><button type="button" class="lnk" data-x="1">✕ Đóng</button></div><input class="tnq" placeholder="Tìm nhóm hoặc người…"><div class="tnfwl"></div>${L.some(m=>m.kind==="file")?`<p class="hint">Ảnh, tệp chuyển đi dạng tên tệp; người nhận cần ảnh gốc thì gửi lại tệp.</p>`:""}</div>`;
  ov.querySelector("[data-x]").onclick=()=>ov.remove();ov.onclick=e=>{if(e.target===ov)ov.remove()};const i=ov.querySelector("input");i.oninput=()=>{q=i.value;paint()};
  document.body.appendChild(ov);paint();setTimeout(()=>i.focus(),0)}

/* ---------- menu ---------- */
function tnMenu(id,x,y){document.querySelectorAll(".tnmenu").forEach(z=>z.remove());const room=TN.room,m=tnFind(room,id);if(!m)return;
  const s=window.getSelection(),box=document.querySelector(`#tnmsgs [data-mid="${id}"]`),selT=s&&!s.isCollapsed&&box&&box.contains(s.anchorNode)?String(s).trim():"";
  const ag=String(room).startsWith("ag:"),pin=tnPinOf(room),pinned=pin&&pin.id===id,txt=m.kind==="" ||m.kind==="agent",live=!ag&&m.kind!=="recall";
  const I=[[live,"reply","↩","Trả lời"],[live&&!!selT,"quote","❝","Trích dẫn đoạn đã chọn"],[!!selT,"copysel","⧉","Sao chép đoạn đã chọn"],[m.kind!=="recall","copy","⧉","Sao chép"],
    [live&&txt,"task","📋","Giao việc từ tin này"],[live&&txt,"rem","⏰","Nhắc tôi việc này"],[live,"pin","📌",pinned?"Bỏ ghim":"Ghim"],[m.kind!=="recall","fw","↪","Chuyển tiếp"],[!ag,"sel","☑","Chọn"],
    [tnCanRecall(m),"recall","↶","Thu hồi"],[!ag,"del","🗑","Xóa ở máy tôi"]].filter(z=>z[0]);
  const p=document.createElement("div");p.className="tnmenu";
  p.innerHTML=(live?`<div class="tnmrx">${["❤️","👍","👎","🔥","🥰","👏","😁","😂","😮","😢"].map(e=>`<button type="button" data-e="${e}">${e}</button>`).join("")}</div>`:"")+`<div class="tnmls">${I.map(([,k,ic,l])=>`<button type="button" data-k="${k}"${["recall","del"].includes(k)?' class="red"':""}><i>${ic}</i>${esc(l)}</button>`).join("")}</div>`;
  document.body.appendChild(p);const W=p.offsetWidth,H=p.offsetHeight;p.style.left=Math.max(8,Math.min(x,innerWidth-W-8))+"px";p.style.top=Math.max(8,Math.min(y,innerHeight-H-8))+"px";
  const close=()=>{p.remove();document.removeEventListener("mousedown",out,true);document.removeEventListener("keydown",esc1)},out=e=>{if(!p.contains(e.target))close()},esc1=e=>{if(e.key==="Escape")close()};
  setTimeout(()=>{document.addEventListener("mousedown",out,true);document.addEventListener("keydown",esc1)},0);
  p.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{close();tnReact(m,b.dataset.e)});
  p.querySelectorAll("[data-k]").forEach(b=>b.onmousedown=e=>e.preventDefault());
  p.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{close();const k=b.dataset.k;
    if(k==="reply")tnReplyTo(m,"");else if(k==="quote")tnReplyTo(m,selT);else if(k==="copysel")tnCopy(selT);else if(k==="copy")tnCopy(tnTxt(m));
    else if(k==="task")tnGiao(m.body);else if(k==="rem")tnRemind(m.body,tnMe());else if(k==="pin")tnPin(room,id,!pinned);else if(k==="fw")tnForward([m]);
    else if(k==="sel"){TNM.sel=new Set([id]);TNM.selRoom=room;tnDrawMsgs(true)}else if(k==="recall")tnRecall(room,m);
    else if(k==="del"&&confirm("Xóa tin này ở máy của bạn? Người khác vẫn thấy. Muốn xóa với mọi người thì dùng Thu hồi.")){tnHide([id]);tnDrawMsgs(true)}})}
