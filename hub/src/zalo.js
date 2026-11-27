/* =====================================================================
   ZALO TRONG CRM — đợt 1 (chị Hoa duyệt demo 27/11/2026)
   - Menu Kinh doanh › Zalo: Hộp tin Zalo (gộp mọi nick mình được xem), Nick Zalo (thêm nick bằng QR, trạng thái, tin mẫu).
   - Nút "Zalo" có số chưa đọc trên thanh trên cùng.
   - CSKH › Việc hôm nay: thêm cột Zalo + tab "Zalo chờ trả lời"; hộp thông tin khách và hồ sơ khách có khung Zalo.
   - Gõ "/" trong ô nhắn để chọn tin mẫu. Tin chỉ gửi khi người bấm Gửi (đợt này không có gửi tự động).
   - Sale chỉ thấy nick của mình; Lead / CEO thấy hết và thấy nội dung tin khách đã thu hồi (máy chủ lọc, src/server/routes/zaloNick.ts).
   - Kết nối Zalo thật do chương trình trên VPS giữ (vps-zalo/zalo-nick.mjs), phiên đăng nhập lưu mã hóa trên VPS.
   - Đợt 2 (chị Hoa chọn 27/11): menu từng tin (trả lời trích dẫn, chuyển tiếp, thả cảm xúc, thu hồi, ẩn phía mình), gửi ảnh / tệp,
     nhãn dán, ghim, kết bạn (người bấm), đang gõ; AI soạn nháp (người bấm gửi), AI sửa câu, AI tóm tắt; "Khách hôm nay";
     Nick Zalo: kéo danh bạ + tin cũ, lời mời kết bạn; trang "Đo sale qua Zalo" (Lead / CEO). Máy chủ: routes/zaloInsight.ts.
   ===================================================================== */
const ZL={me:null,busy:false,f:"all",nick:"",q:"",convs:null,cAt:0,cur:"",det:null,tpl:null,cs:null,csAt:0,csWait:null,nicks:null,tm:0};
const zlApi=(p,o)=>svApi("/api/zalo"+p,o);
const zlPost=(p,b,method)=>zlApi(p,{method:method||"POST",body:JSON.stringify(b||{})});
const zlSee=()=>!!ZL.me&&(ZL.me.lead||ZL.me.nicks.length>0);
const zlLead=()=>!!ZL.me&&ZL.me.lead;
const zlHM=t=>{if(!t)return "";const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toTimeString().slice(0,5):d.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})+" "+d.toTimeString().slice(0,5)};
const zlAgo=t=>{if(!t)return "";const m=Math.max(0,Math.round((Date.now()-Date.parse(t))/60000));return m<60?m+" phút":m<1440?Math.floor(m/60)+" giờ":Math.floor(m/1440)+" ngày"};
const zlDot='<span class="zl-dot">Z</span>';
const ZL_ST={ON:["Đang chạy","grn"],QR:["Đang chờ quét QR","amb"],SCANNED:["Đã quét, chờ đồng ý","amb"],OFF:["Rớt, đang nối lại","red"],NEED_QR:["Cần quét lại QR","red"],NEW:["Chưa quét QR","gry"],STOPPED:["Đã ngừng","gry"]};
const ZL_STAGE={NEW:"Mới tiếp cận",CONSULTING:"Đang tư vấn",QUOTED:"Đã gửi báo giá",NEGOTIATING:"Đang đàm phán",FIRST_ORDER:"Đã chốt đơn đầu",REGULAR:"Đang mua đều",DORMANT:"Ngủ đông",LOST:"Mất khách"};
const zlStP=s=>pill((ZL_ST[s]||[s])[0],(ZL_ST[s]||[0,"gry"])[1]);

function zlCss(){if(document.getElementById("zlcss"))return;const s=document.createElement("style");s.id="zlcss";s.textContent=`
.zl-dot{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:5px;background:#0068ff;color:#fff;font-size:10px;font-weight:700;flex:none}
.zlbtn{position:relative;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#e6e8f0);background:#fff;border-radius:12px;height:42px;padding:0 12px;cursor:pointer;font:inherit;font-weight:600;color:inherit;margin-right:6px}
.zlbtn .zlz{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;background:#0068ff;color:#fff;font-size:11px;font-weight:700}
.zlbtn b{position:absolute;top:-7px;right:-7px;background:#d23b47;color:#fff;border-radius:99px;font-size:11px;padding:0 6px;line-height:18px}
@media(max-width:760px){.zlbtn .zlt{display:none}.zlbtn{padding:0 10px}}
.zl-ib{display:grid;grid-template-columns:290px minmax(0,1fr) 270px;min-height:calc(100vh - 170px);padding:0!important;overflow:hidden}
.zl-cl{border-right:1px solid var(--line,#e6e8f0);display:flex;flex-direction:column;min-width:0}
.zl-fl{display:flex;flex-wrap:wrap;gap:6px;padding:10px;border-bottom:1px solid var(--line,#e6e8f0)}
.zl-fl input,.zl-fl select{font:inherit;font-size:13px;border:1px solid var(--line,#e6e8f0);border-radius:8px;padding:5px 8px;background:#fff}
.zl-fl input{flex:1 1 100%}
.zl-tab{border:1px solid var(--line,#e6e8f0);background:#fff;border-radius:9px;padding:4px 10px;cursor:pointer;font:inherit;font-size:12.5px}
.zl-tab.on{border-color:#4b54d1;color:#4b54d1;font-weight:600}
.zl-tab em{font-style:normal;font-size:11px;background:#f1f2f7;border-radius:6px;padding:0 5px;margin-left:4px}
.zl-list{overflow:auto;flex:1}
.zl-cv{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;padding:9px 10px;border:0;border-bottom:1px solid var(--line,#eef0f5);background:none;text-align:left;cursor:pointer;width:100%;font:inherit;color:inherit}
.zl-cv.on{background:#eceaff}.zl-cv:hover{background:#f6f6fd}
.zl-av{width:34px;height:34px;border-radius:50%;background:#e6eeff;color:#2c63c9;display:grid;place-items:center;font-weight:700;font-size:12px;overflow:hidden}
.zl-av img{width:100%;height:100%;object-fit:cover}
.zl-cn{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zl-cp{font-size:12px;color:var(--muted,#6b7090);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zl-sub{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.zl-sub .pill,.zl-hd .pill,.zl-box .pill{display:inline-flex;width:auto;font-size:11px;padding:1px 7px;margin:0;line-height:16px}
.zl-un{background:#d23b47;color:#fff;border-radius:99px;font-size:11px;padding:0 6px;align-self:start;line-height:18px}
.zl-ch{display:flex;flex-direction:column;min-width:0;min-height:0}
.zl-hd{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--line,#e6e8f0);font-weight:600;flex-wrap:wrap}
.zl-hd .sp{flex:1}
.zl-msgs{background:#eef1f8;padding:12px;display:flex;flex-direction:column;gap:7px;overflow:auto;flex:1;min-height:200px}
.zl-msgs.sm{max-height:300px;border-radius:10px}
.zl-day{align-self:center;font-size:11.5px;color:var(--muted,#6b7090);background:#fff;border-radius:99px;padding:1px 10px}
.zl-m{max-width:80%;padding:7px 10px;border-radius:13px;background:#fff;font-size:13.5px;white-space:pre-wrap;word-break:break-word}
.zl-m.me{align-self:flex-end;background:#e3eaff}
.zl-m .t{font-size:10.5px;color:var(--muted,#6b7090);margin-top:2px;white-space:normal}
.zl-m .who{font-size:11px;font-weight:600;color:#4b54d1;margin-bottom:2px}
.zl-m img{max-width:220px;max-height:260px;border-radius:8px;display:block}
.zl-m.rc{border:1px dashed #d23b47}.zl-m.rc .body{text-decoration:line-through;color:var(--muted,#6b7090)}
.zl-m.pend{opacity:.65}.zl-m.fail{border:1px solid #d23b47}
.zl-comp{display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--line,#e6e8f0);position:relative;align-items:flex-end;background:#fff}
.zl-comp textarea{flex:1;min-width:0;border:1px solid var(--line,#e6e8f0);border-radius:9px;padding:7px 9px;font:inherit;font-size:13.5px;resize:none;max-height:140px}
.zl-comp select{font:inherit;font-size:12.5px;border:1px solid var(--line,#e6e8f0);border-radius:8px;padding:6px;max-width:130px}
.zl-tpl{position:absolute;bottom:52px;left:12px;right:12px;background:#fff;border:1px solid var(--line,#e6e8f0);border-radius:10px;padding:5px;box-shadow:0 12px 32px rgba(16,24,40,.14);z-index:5;max-height:240px;overflow:auto}
.zl-tpl button{display:block;width:100%;text-align:left;border:0;background:none;padding:6px 8px;border-radius:7px;cursor:pointer;font:inherit;font-size:13px}
.zl-tpl button:hover,.zl-tpl button.on{background:#eceaff}
.zl-rp{border-left:1px solid var(--line,#e6e8f0);min-width:0;overflow:auto}
.zl-rp h4{margin:0;padding:12px 14px;border-bottom:1px solid var(--line,#e6e8f0);font-size:14px}
.zl-kv{display:grid;grid-template-columns:auto 1fr}.zl-kv span{padding:7px 14px;border-bottom:1px solid var(--line,#eef0f5);font-size:13px}.zl-kv span:nth-child(odd){color:var(--muted,#6b7090)}.zl-kv span:nth-child(even){text-align:right;font-weight:600}
.zl-pad{padding:10px 14px}.zl-acts{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px}
.zl-fr{display:flex;flex-direction:column;gap:4px;margin-top:6px}.zl-fr button{text-align:left}
.zl-empty{margin:auto;color:var(--muted,#6b7090);padding:30px;text-align:center}
.zl-back{display:none}
.zl-box{border:1px solid var(--line,#e6e8f0);border-radius:12px;overflow:hidden;background:#fff}
.zl-box .zl-hd{font-size:13.5px}
.zl-days{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.zl-dl{display:grid;grid-template-columns:70px 1fr;gap:8px;font-size:12.8px}.zl-dl .w{color:var(--muted,#6b7090)}
.zl-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0}
.zl-tiles .card{padding:12px 14px}.zl-tiles b{font-size:22px;display:block}
.zl-qr{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
.zl-qr .img{width:220px;height:220px;border:1px solid var(--line,#e6e8f0);border-radius:10px;display:grid;place-items:center;background:#fff;color:var(--muted,#6b7090);text-align:center;font-size:13px}
.zl-qr .img img{width:210px;height:210px}
.zl-qr ol{margin:0;padding-left:18px;flex:1;min-width:200px;line-height:1.7}
.zl-tplrow{display:grid;grid-template-columns:120px 1fr auto;gap:6px;margin-bottom:6px}
.zl-tplrow input,.zl-tplrow textarea{font:inherit;font-size:13px;border:1px solid var(--line,#e6e8f0);border-radius:8px;padding:6px 8px}
#zlinfo{display:none}
@media(max-width:1100px){#zlinfo{display:inline-flex}.zl-ib{grid-template-columns:260px minmax(0,1fr)}.zl-rp{display:none}.zl-ib.rp .zl-rp{display:block;grid-column:1/-1;border-left:0;border-top:1px solid var(--line,#e6e8f0)}}
@media(max-width:760px){.zl-ib{grid-template-columns:1fr;min-height:0}.zl-ib.has .zl-cl{display:none}.zl-ib:not(.has) .zl-ch{display:none}.zl-cl{border-right:0;max-height:none}.zl-msgs{min-height:50vh;max-height:60vh}.zl-back{display:inline-flex}.zl-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.zl-m{max-width:88%}.zl-tplrow{grid-template-columns:1fr}}
`;document.head.appendChild(s)}

/* ---------- người xem, số chưa đọc ---------- */
async function zlLoadMe(){if(ZL.busy||!ME||typeof svApi!=="function")return;ZL.busy=true;
  try{const was=zlSee(),un=ZL.me&&ZL.me.unread;ZL.me=await zlApi("/me");
    if(was!==zlSee()){if(!(typeof svTyping==="function"&&svTyping()))render()}else{zlTopBtn();if(un!==ZL.me.unread){const b=document.querySelector('.mi[data-p="zl_inbox"] b,[data-p="zl_inbox"] b');if(b)b.textContent=ZL.me.unread||""}}}
  catch(e){}finally{ZL.busy=false}}
function zlTopBtn(){const cb=document.querySelector(".topbar #chatbtn");if(!cb)return;let b=document.querySelector(".topbar .zlbtn");
  if(!zlSee()){if(b)b.remove();return}zlCss();
  if(!b){b=document.createElement("button");b.type="button";b.className="zlbtn";b.title="Hộp tin Zalo";b.onclick=()=>zlGo("zl_inbox");cb.before(b)}
  const n=ZL.me.unread||0;b.innerHTML=`<span class="zlz">Z</span><span class="zlt">Zalo</span>${n?`<b>${n>99?"99+":n}</b>`:""}`}
function zlGo(page,conv){if(conv){ZL.cur=conv;ZL.det=null}PAGE=page;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}window.RM_TOP=true;render()}
if(typeof NAV_AN_MO!=="undefined"){NAV_AN_MO.add("zl_inbox");NAV_AN_MO.add("zl_nick");NAV_AN_MO.add("zl_dosale")}
window.NO_PP=window.NO_PP||new Set();["zl_inbox","zl_nick","zl_dosale"].forEach(k=>NO_PP.add(k));
{const _r=render;render=function(){const r=_r.apply(this,arguments);try{if(ME&&!ZL.me&&!ZL.busy)zlLoadMe();zlTopBtn()}catch(e){}return r}}
setInterval(()=>{if(ME&&!document.hidden)zlLoadMe()},30000);
/* Trang CRM (khung nhúng) nhờ mở Hộp tin ở đúng hội thoại. */
window.addEventListener("message",e=>{if(e.origin!==location.origin||!e.data||typeof e.data!=="object")return;if(e.data.zlOpen!==undefined)zlGo("zl_inbox",String(e.data.zlOpen||""))});

/* Menu: Kinh doanh › Zalo, đặt sau Kênh phân phối. */
{const kd=MODULES.find(x=>x.k==="kd")||MODULES.find(x=>x.k==="b2c");
 if(kd){const g0=kd.groups;kd.groups=()=>{let G=[];try{G=g0()}catch(e){}if(!zlSee())return G;
   const Z=["Zalo",[MI("zl_inbox","Hộp tin Zalo",null,()=>(ZL.me&&ZL.me.unread)||""),MI("zl_nick","Nick Zalo"),MI("zl_dosale","Đo sale qua Zalo",()=>zlLead())].filter(x=>!x[2]||x[2](ME))];
   const at=G.findIndex(x=>x[0]==="Kênh phân phối");if(at>=0)G.splice(at+1,0,Z);else G.push(Z);return G}}}

/* ---------- tin mẫu "/" ---------- */
async function zlTpl(){if(ZL.tpl)return ZL.tpl;try{ZL.tpl=await zlApi("/templates")}catch(e){ZL.tpl=[]}return ZL.tpl}

/* ---------- bong bóng tin ---------- */
const ZL_ICON={"/-heart":"❤️","/-strong":"👍",":>":"😆",":o":"😮",":-((":"😭",":-h":"😡"};
function zlBub(m,lead,showNick,menu){const t=`<div class="t">${zlHM(m.at)}${showNick&&m.nick_name?" · "+esc(m.nick_name):""}${m.from_me&&m.sent_by_name?" · "+esc(m.sent_by_name):""}${m.from_me&&m.seen_at?" · đã xem":""}${m.hidden_at?" · "+pill("đã ẩn phía mình","gry"):""}</div>`;
  const who=!m.from_me&&m.sender_name&&m.group?`<div class="who">${esc(m.sender_name)}</div>`:"";
  const qt=m.quote_text?`<div class="zl-q"><b>${esc(m.quote_name||(m.from_me?"Khách":"AILLA"))}</b>${esc(m.quote_text)}</div>`:"";
  const R=m.reacts||[],rx=R.length?`<div class="zl-rx" title="${esc(R.map(r=>(r.from_me?"Mình":r.who_name)+" "+(ZL_ICON[r.icon]||r.icon)).join(", "))}">${[...new Set(R.map(r=>ZL_ICON[r.icon]||r.icon))].join("")}${R.length>1?" "+R.length:""}</div>`:"";
  const mm=menu&&m.id?`<button type="button" class="zl-mm" data-zlmm="${esc(m.id)}" title="Trả lời, chuyển tiếp, thả cảm xúc, thu hồi…" aria-label="Thao tác với tin">⋯</button>`:"";
  if(m.recalled){if(!lead)return `<div class="zl-m${m.from_me?" me":""}"><i style="color:var(--muted,#6b7090)">Tin đã thu hồi</i>${t}</div>`;
    return `<div class="zl-m rc${m.from_me?" me":""}">${who}<div class="body">${zlBody(m)}</div><div class="t">${zlHM(m.at)} · ${pill(m.from_me?"đã thu hồi":"khách đã thu hồi","red")}</div></div>`}
  return `<div class="zl-m${m.from_me?" me":""}${m.hidden_at?" hid":""}" data-zlm="${esc(m.id||"")}">${mm}${who}${qt}${zlBody(m)}${t}${rx}</div>`}
function zlBody(m){const tx=esc(m.text||"");
  if(m.kind==="sticker"&&m.url)return `<img class="zl-st" src="${esc(m.url)}" alt="Nhãn dán" loading="lazy" referrerpolicy="no-referrer">`;
  if(m.kind==="voice"&&m.url)return `<audio controls preload="none" src="${esc(m.url)}"></audio>`;
  if(m.kind==="image"&&m.url)return `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(m.url)}" alt="Ảnh" loading="lazy" referrerpolicy="no-referrer"></a>${tx?`<div>${tx}</div>`:""}`;
  if((m.kind==="file"||m.kind==="link"||m.kind==="video"||m.kind==="voice")&&m.url)return `${{file:"📎",link:"🔗",video:"🎬",voice:"🎤"}[m.kind]} <a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${tx||{file:"Tệp",link:"Liên kết",video:"Video",voice:"Tin thoại"}[m.kind]}</a>`;
  if(m.kind!=="text")return `<i>${esc({image:"[Ảnh]",file:"[Tệp]",sticker:"[Nhãn dán]",voice:"[Tin thoại]",video:"[Video]",link:"[Liên kết]",other:"[Tin]"}[m.kind]||"[Tin]")}</i>${tx?" "+tx:""}`;
  return tx}
function zlMsgsHtml(L,lead,showNick,pend,menu){let last="",h="";(L||[]).forEach(m=>{const d=new Date(m.at).toLocaleDateString("vi-VN",{weekday:"short",day:"2-digit",month:"2-digit"});if(d!==last){h+=`<div class="zl-day">${d}</div>`;last=d}h+=zlBub(m,lead,showNick,menu)});
  (pend||[]).forEach(p=>{let pl={};try{pl=p.payload?JSON.parse(p.payload):{}}catch(e){}const what=p.text||(pl.file?"📎 "+pl.file.name:pl.sticker?"[Nhãn dán]":pl.url?"↪ "+(pl.url.name||"Tệp"):"");
    h+=`<div class="zl-m me ${p.status==="FAILED"?"fail":"pend"}">${pl.quote?`<div class="zl-q">${esc(pl.quote.text||"")}</div>`:""}${esc(what)}<div class="t">${p.status==="FAILED"?"Chưa gửi được: "+esc(p.error||""):"Đang gửi…"}</div></div>`});
  return h||`<div class="zl-empty">Chưa có tin nhắn.</div>`}

/* ---------- ô nhắn: Enter gửi, Shift+Enter xuống dòng, "/" mở tin mẫu ---------- */
/* Mã ô kết thúc "-q": phần tự lưu nháp phiếu (nhapdo.js) và cờ "đang gõ" coi như ô tìm, không bắt ô nhắn Zalo. */
let ZL_CN=0;
function zlComposer(extra,tools){return `<div class="zl-comp"><div class="zl-tpl" hidden></div>${extra||""}${tools?`<button type="button" class="zl-ib2" data-zlatt title="Gửi ảnh, tệp (tối đa 1,9 MB)" aria-label="Gửi ảnh, tệp">📎</button><input type="file" data-zlfile hidden><button type="button" class="zl-ib2" data-zlstk title="Nhãn dán" aria-label="Nhãn dán">🙂</button>`:""}<textarea id="zlc${++ZL_CN}-q" rows="1" placeholder="Nhắn Zalo… gõ / để chọn tin mẫu" autocomplete="off"></textarea><button type="button" class="btn pri" data-zlsend="1">Gửi</button>${tools?`<button type="button" class="zl-ib2" data-zlpol title="AI sửa câu đang gõ cho gọn, lễ phép" aria-label="AI sửa câu">✦</button>`:""}</div>`}
function zlBindComposer(root,onSend){const box=root.querySelector(".zl-comp");if(!box)return;const ta=box.querySelector("textarea"),tp=box.querySelector(".zl-tpl"),btn=box.querySelector("[data-zlsend]");let sel=0,list=[];
  const fit=()=>{ta.style.height="auto";ta.style.height=Math.min(140,ta.scrollHeight)+"px"};
  const show=async()=>{const v=ta.value;if(!v.startsWith("/")||v.includes("\n")){tp.hidden=true;return}const T=await zlTpl(),k=v.slice(1).split(" ")[0].toLowerCase();
    list=T.filter(x=>x.code.startsWith(k));sel=0;if(!list.length){tp.innerHTML=`<div class="hint" style="padding:6px 8px">${T.length?"Không có tin mẫu này.":"Chưa có tin mẫu. Lead / CEO thêm ở Nick Zalo › Tin mẫu."}</div>`;tp.hidden=false;return}
    tp.innerHTML=list.map((x,i)=>`<button type="button" data-i="${i}" class="${i===sel?"on":""}"><b>/${esc(x.code)}</b> — ${esc(x.text.slice(0,90))}</button>`).join("");tp.hidden=false;
    tp.querySelectorAll("[data-i]").forEach(b=>b.onmousedown=e=>{e.preventDefault();pick(+b.dataset.i)})};
  const pick=i=>{const x=list[i];if(!x)return;ta.value=x.text;tp.hidden=true;fit();ta.focus()};
  const send=async()=>{const v=ta.value.trim();if(!v||btn.disabled)return;btn.disabled=true;try{await onSend(v);ta.value="";fit()}catch(e){toast(e.message)}finally{btn.disabled=false}};
  ta.oninput=()=>{fit();show()};
  ta.onkeydown=e=>{if(!tp.hidden&&list.length&&(e.key==="ArrowDown"||e.key==="ArrowUp")){e.preventDefault();sel=(sel+(e.key==="ArrowDown"?1:list.length-1))%list.length;tp.querySelectorAll("[data-i]").forEach((b,i)=>b.classList.toggle("on",i===sel));return}
    if(!tp.hidden&&list.length&&(e.key==="Enter"||e.key==="Tab")){e.preventDefault();pick(sel);return}
    if(e.key==="Escape"){tp.hidden=true;return}
    if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();send()}};
  ta.onblur=()=>setTimeout(()=>{tp.hidden=true},150);
  btn.onclick=send}

/* ---------- Hộp tin Zalo ---------- */
function pZlInbox(m){zlCss();
  if(!ZL.me){m.innerHTML=H("Hộp tin Zalo","")+`<section class="card"><p class="hint">Đang tải…</p></section>`;zlLoadMe().then(()=>{if(PAGE==="zl_inbox")renderMain()});return}
  const nicks=ZL.me.nicks||[];
  m.innerHTML=H("Hộp tin Zalo",zlLead()?"Mọi nick Zalo công việc · Lead / CEO thấy cả tin khách đã thu hồi":"Tin Zalo trên nick của bạn")+`
  <section class="card zl-ib${ZL.cur?" has":""}" id="zlib">
   <div class="zl-cl"><div class="zl-fl">
     <input id="zl-q" placeholder="Tìm tên, số điện thoại" value="${esc(ZL.q)}" autocomplete="off">
     ${[["all","Tất cả"],["wait","Chờ trả lời"],["unread","Chưa đọc"],["grp","Nhóm"]].map(([k,t])=>`<button type="button" class="zl-tab${ZL.f===k?" on":""}" data-zlf="${k}">${t}</button>`).join("")}
     ${nicks.length>1?`<select id="zlnk">${opt([["","Mọi nick"]].concat(nicks.map(n=>[n.id,n.name])),ZL.nick)}</select>`:""}
     <button type="button" class="zl-tab" id="zlbrief" title="Khách chờ lâu, hẹn hôm nay, khách lâu không chăm, khách im 30 ngày">☀ Khách hôm nay</button>
   </div><div class="zl-list" id="zllist"><p class="hint zl-pad">Đang tải…</p></div></div>
   <div class="zl-ch" id="zlch"></div>
   <div class="zl-rp" id="zlrp"></div>
  </section>
  ${!nicks.length?`<p class="hint">Chưa có nick Zalo nào. ${zlLead()?"Vào Nick Zalo để thêm nick và quét QR.":"Nhờ Lead thêm nick công việc của bạn ở Nick Zalo."}</p>`:""}`;
  m.querySelectorAll("[data-zlf]").forEach(b=>b.onclick=()=>{ZL.f=b.dataset.zlf;ZL.convs=null;m.querySelectorAll("[data-zlf]").forEach(x=>x.classList.toggle("on",x===b));zlLoadConvs(true)});
  const nk=m.querySelector("#zlnk");if(nk)nk.onchange=()=>{ZL.nick=nk.value;zlLoadConvs(true)};
  m.querySelector("#zlbrief").onclick=zlBrief;
  let t=0;const q=m.querySelector("#zl-q");q.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{ZL.q=q.value.trim();zlLoadConvs(true)},300)};
  zlDrawList();zlLoadConvs(true);zlDrawChat();if(ZL.cur)zlLoadConv(true);zlTick()}
function zlTick(){clearTimeout(ZL.tm);ZL.tm=setTimeout(async()=>{if(PAGE!=="zl_inbox"||!document.getElementById("zlib"))return;
  if(!document.hidden){await zlLoadConvs(false);if(ZL.cur)await zlLoadConv(false)}zlTick()},ZL.det&&ZL.det.pending&&ZL.det.pending.some(p=>p.status!=="FAILED")?2500:6000)}
async function zlLoadConvs(force){const qs=new URLSearchParams({f:ZL.f});if(ZL.nick)qs.set("nick",ZL.nick);if(ZL.q)qs.set("q",ZL.q);
  try{const r=await zlApi("/convs?"+qs);const sig=JSON.stringify(r);if(!force&&sig===ZL.cSig)return;ZL.cSig=sig;ZL.convs=r;zlDrawList()}catch(e){const l=$("#zllist");if(l&&force)l.innerHTML=`<p class="hint zl-pad">${esc(e.message)}</p>`}}
function zlInit(n){const w=String(n||"?").replace(/\(.*?\)/g,"").replace(/[^\p{L}\d\s]/gu,"").trim().split(/\s+/).filter(Boolean);if(!w.length)return "?";return esc((w.length>1?w[w.length-2][0]+w[w.length-1][0]:w[0].slice(0,2)).toUpperCase())}
function zlDrawList(){const el=$("#zllist");if(!el)return;const L=ZL.convs;if(!L){el.innerHTML=`<p class="hint zl-pad">Đang tải…</p>`;return}
  el.innerHTML=L.length?L.map(c=>{const nm=c.customer_name||c.cskh_name||c.name||c.peer_phone||"(chưa rõ tên)";
    return `<button type="button" class="zl-cv${c.id===ZL.cur?" on":""}" data-zlcv="${c.id}"><span class="zl-av">${c.avatar?`<img src="${esc(c.avatar)}" alt="" referrerpolicy="no-referrer" loading="lazy">`:c.is_group?"#":zlInit(nm)}</span>
     <span style="min-width:0"><span class="zl-cn" style="display:block">${c.pinned_at?"📌 ":""}${esc(nm)}</span><span class="zl-cp" style="display:block">${zlTyping(c.typing_at)?`<i style="color:#18864f">đang gõ…</i>`:(c.last_from_me?"Bạn: ":"")+esc(c.last_text||"")}</span>
     <span class="zl-sub">${pill(c.nick_name,"vio")}${c.is_group?pill("Nhóm","gry"):""}${c.customer_id?pill("Kênh phân phối","blu"):c.cskh_phone?pill("Khách lẻ","blu"):c.is_group?"":pill("Chưa gắn khách","amb")}${c.waiting_since&&!c.is_group?pill("Chờ "+zlAgo(c.waiting_since),"red"):""}</span></span>
     <span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><small class="hint">${zlHM(c.last_at)}</small>${c.unread?`<span class="zl-un">${c.unread}</span>`:""}</span></button>`}).join(""):`<p class="hint zl-pad">${ZL.f==="wait"?"Không có khách nào đang chờ trả lời.":"Chưa có hội thoại."}</p>`;
  el.querySelectorAll("[data-zlcv]").forEach(b=>b.onclick=()=>{ZL.cur=b.dataset.zlcv;ZL.det=null;const ib=$("#zlib");if(ib)ib.classList.add("has");el.querySelectorAll(".zl-cv").forEach(x=>x.classList.toggle("on",x===b));zlDrawChat();zlLoadConv(true)})}
async function zlLoadConv(force){const id=ZL.cur;if(!id)return;
  try{const r=await zlApi("/convs/"+id);if(ZL.cur!==id)return;const sig=JSON.stringify([r.msgs.length,r.msgs.slice(-1),r.pending,r.conv.customer_id,r.conv.cskh_phone,r.conv.pinned_at,r.conv.is_friend,zlTyping(r.conv.typing_at),r.msgs.filter(x=>x.recalled||x.seen_at||x.hidden_at).length,r.msgs.reduce((a,x)=>a+(x.reacts||[]).length,0)]);
    const first=!ZL.det;if(!force&&sig===ZL.dSig)return;ZL.dSig=sig;ZL.det=r;
    if(first||force)zlDrawChat();else{zlDrawMsgs();zlDrawHead()}zlDrawPanel();zlAiLoad(false);
    if(r.conv.unread){await zlPost("/convs/"+id+"/read");const c=(ZL.convs||[]).find(x=>x.id===id);if(c){c.unread=0;zlDrawList()}zlLoadMe()}}
  catch(e){if(force){const ch=$("#zlch");if(ch)ch.innerHTML=`<div class="zl-empty">${esc(e.message)}</div>`}}}
function zlDrawChat(){const ch=$("#zlch");if(!ch)return;const D0=ZL.det;
  if(!ZL.cur){ch.innerHTML=`<div class="zl-empty">Chọn một hội thoại bên trái.</div>`;const rp=$("#zlrp");if(rp)rp.innerHTML="";return}
  if(!D0){ch.innerHTML=`<div class="zl-empty">Đang tải…</div>`;return}
  const c=D0.conv,nm=(D0.customer&&D0.customer.name)||(D0.cskh&&D0.cskh.name)||c.name||c.peer_phone||"";
  ch.innerHTML=`<div class="zl-hd" id="zlhd"></div>
   <div class="zl-msgs" id="zlmsgs"></div><div id="zlai"></div><div id="zlqbar"></div>${D0.can_send?zlComposer("",true):`<p class="hint zl-pad">Nick này của người khác: chỉ xem.</p>`}`;
  zlDrawHead();zlDrawMsgs();ZL.quote=null;zlQBar();
  zlBindComposer(ch,async v=>{const q=ZL.quote;await zlPost("/convs/"+c.id+"/send",{text:v,quote_id:q?q.id:undefined});ZL.quote=null;zlQBar();await zlLoadConv(false);zlTick()});
  zlBindTools(ch,c.id);zlAiLoad(false);
  const ta=ch.querySelector("textarea");if(ta&&window.innerWidth>760)ta.focus()}
function zlDrawMsgs(){const el=$("#zlmsgs");if(!el||!ZL.det)return;const near=el.scrollHeight-el.scrollTop-el.clientHeight<80||!el.childElementCount;
  const g=ZL.det.conv.is_group;el.innerHTML=zlMsgsHtml(ZL.det.msgs.map(x=>({...x,group:g})),ZL.det.lead,false,ZL.det.pending,ZL.det.can_send);if(near)el.scrollTop=el.scrollHeight;
  el.querySelectorAll("[data-zlmm]").forEach(b=>b.onclick=e=>{e.stopPropagation();const r=b.getBoundingClientRect();zlMsgMenu(b.dataset.zlmm,r.left,r.bottom)})}
function zlDrawPanel(){const rp=$("#zlrp");if(!rp||!ZL.det)return;const D0=ZL.det,c=D0.conv,k=D0.customer,s=D0.cskh,can=D0.can_send;
  const kv=a=>`<div class="zl-kv">${a.map(([x,y])=>`<span>${x}</span><span>${y}</span>`).join("")}</div>`;
  let h="";
  if(c.is_group)h=`<h4>Nhóm Zalo</h4><div class="zl-pad hint">${esc(c.name||"")}<br>Nhóm không gắn với một khách. Đợt này chưa có trợ lý trả lời trong nhóm.</div>`;
  else if(k)h=`<h4>Khách hàng kênh phân phối</h4>${kv([["Tên",esc(k.name)],["Cấp giá",esc(k.tier_name||"—")],["Giai đoạn",esc(ZL_STAGE[k.stage]||k.stage||"—")],["Sale",esc(k.owner_name||"—")],["Khu vực",esc(k.province||"—")],["Nhập gần nhất",k.last_order_date?esc(String(k.last_order_date).slice(8,10)+"/"+String(k.last_order_date).slice(5,7)+"/"+String(k.last_order_date).slice(0,4)):"Chưa mua"]])}
    <div class="zl-acts"><button type="button" class="btn" data-zlhs="${esc(k.id)}">Mở hồ sơ</button>${can?`<button type="button" class="btn" data-zlunlink="1">Bỏ gắn</button>`:""}</div>`;
  else if(s)h=`<h4>Khách lẻ · CSKH</h4>${kv([["Tên",esc(s.name||"—")],["Số đơn",nf(s.order_count)],["Tổng mua",nf(s.total_spent)+"đ"],["Mua cuối",s.last_order_day?esc(s.last_order_day.slice(8,10)+"/"+s.last_order_day.slice(5,7)):"—"],["CSKH",esc(s.owner_name||"Chưa chia")]])}
    <div class="zl-acts"><button type="button" class="btn" data-zlcs="${esc(s.phone)}">Mở hồ sơ CSKH</button>${can?`<button type="button" class="btn" data-zlunlink="1">Bỏ gắn</button>`:""}</div>`;
  else h=`<h4>Chưa gắn khách</h4><div class="zl-pad"><div class="hint">${c.peer_phone?"Số Zalo "+esc(c.peer_phone)+" chưa có trong danh sách khách.":"Zalo này không để lộ số điện thoại, máy không tự khớp được."} Tìm khách để gắn:</div>
    ${can?`<input id="zl-find-q" placeholder="Tên hoặc số điện thoại" style="width:100%;margin-top:8px" autocomplete="off"><div class="zl-fr" id="zlfr"></div>`:""}</div>`;
  rp.innerHTML=h;
  rp.querySelectorAll("[data-zlhs]").forEach(b=>b.onclick=()=>zlOpenKpp(b.dataset.zlhs));
  rp.querySelectorAll("[data-zlcs]").forEach(b=>b.onclick=()=>{zlGo("cs_today");if(typeof csOpen==="function")csOpen(b.dataset.zlcs)});
  rp.querySelectorAll("[data-zlunlink]").forEach(b=>b.onclick=async()=>{if(!confirm("Bỏ gắn hội thoại này khỏi khách?"))return;try{await zlPost("/convs/"+c.id+"/link",{customer_id:"",cskh_phone:""});await zlLoadConv(true);zlLoadConvs(true)}catch(e){toast(e.message)}});
  const fi=rp.querySelector("#zl-find-q");if(fi){let t=0;fi.oninput=()=>{clearTimeout(t);t=setTimeout(async()=>{const fr=$("#zlfr");if(fi.value.trim().length<2){fr.innerHTML="";return}
    try{const r=await zlApi("/find-customer?q="+encodeURIComponent(fi.value.trim()));
      fr.innerHTML=r.customers.map(x=>`<button type="button" class="btn sm" data-zllk="c:${esc(x.id)}">${esc(x.name)} <span class="hint">· ${esc(x.phone_text||"")} · Kênh phân phối</span></button>`).join("")+r.cskh.map(x=>`<button type="button" class="btn sm" data-zllk="s:${esc(x.phone)}">${esc(x.name||x.phone)} <span class="hint">· ${esc(x.phone)} · Khách lẻ</span></button>`).join("")||`<span class="hint">Không thấy khách.</span>`;
      fr.querySelectorAll("[data-zllk]").forEach(b=>b.onclick=async()=>{const [t2,v]=[b.dataset.zllk.slice(0,1),b.dataset.zllk.slice(2)];try{await zlPost("/convs/"+c.id+"/link",t2==="c"?{customer_id:v}:{cskh_phone:v});toast("Đã gắn khách");await zlLoadConv(true);zlLoadConvs(true)}catch(e){toast(e.message)}})}catch(e){fr.innerHTML=`<span class="hint">${esc(e.message)}</span>`}},300)}}}
/* Mở hồ sơ khách kênh phân phối (trang CRM nhúng). */
function zlOpenKpp(id){const emp=typeof crmRole==="function"&&crmRole()==="EMPLOYEE",k=emp?"cr_s_kh":"cr_kh";if(typeof CRM_SRC!=="undefined")CRM_SRC[k]=(emp?"/sales":"/admin")+"/customers/"+encodeURIComponent(id);zlGo(k)}

/* ---------- Nick Zalo ---------- */
async function zlLoadNicks(){try{ZL.nicks=await zlApi("/nicks")}catch(e){ZL.nicks={error:e.message}}if(PAGE==="zl_nick")renderMain()}
function pZlNick(m){zlCss();const N=ZL.nicks;
  if(!N){m.innerHTML=H("Nick Zalo","")+`<section class="card"><p class="hint">Đang tải…</p></section>`;zlLoadNicks();return}
  if(N.error){m.innerHTML=H("Nick Zalo","")+`<section class="card"><p>${esc(N.error)}</p></section>`;return}
  const L=N.nicks,on=L.filter(x=>x.status==="ON"&&!x.disabled).length,act=L.filter(x=>!x.disabled).length,bad=L.filter(x=>!x.disabled&&["OFF","NEED_QR"].includes(x.status)).length;
  const relayOk=N.relay_seen&&Date.now()-Date.parse(N.relay_seen)<120000,me=ZL.me&&ZL.me.id;
  m.innerHTML=H("Nick Zalo","Mỗi sale một nick Zalo công việc do công ty cấp. Quét QR là nối vào ABOS.")+`
   <div class="acts" style="justify-content:space-between;align-items:center;margin:0"><span class="hint">${relayOk?"🟢 Máy giữ kết nối Zalo đang chạy":"🔴 Máy giữ kết nối Zalo chưa chạy"+(N.relay_seen?" (lần cuối "+esc(zlHM(N.relay_seen))+")":"")+": quét QR sẽ chưa hiện mã."}</span>${N.lead?`<button type="button" class="btn pri" id="zladd">＋ Thêm nick bằng QR</button>`:""}</div>
   <div class="zl-tiles"><div class="card"><b>${on}/${act}</b><span class="hint">nick đang chạy</span></div><div class="card"><b>${nf(L.reduce((a,x)=>a+x.in_today,0))}</b><span class="hint">tin nhận hôm nay</span></div><div class="card"><b>${nf(L.reduce((a,x)=>a+x.out_today,0))}</b><span class="hint">tin gửi hôm nay</span></div><div class="card"><b style="color:${bad?"#d23b47":"inherit"}">${bad}</b><span class="hint">nick rớt, cần quét lại</span></div></div>
   <section class="card flush">${tbl(["Nick","Người phụ trách","Trạng thái","Tin nhận / gửi hôm nay","Lần cuối báo",""],L.map(x=>`<tr${x.disabled?' style="opacity:.6"':""}><td><b>${esc(x.name)}</b>${x.zalo_name?`<div class="hint">Zalo: ${esc(x.zalo_name)}</div>`:""}</td><td>${esc(x.owner_name||"—")}</td><td>${zlStP(x.status)}${x.status_note&&x.status!=="ON"?`<div class="hint">${esc(x.status_note)}</div>`:""}</td><td class="n">${nf(x.in_today)} / ${nf(x.out_today)}</td><td>${x.seen_at?esc(zlHM(x.seen_at)):"—"}</td>
     <td style="text-align:right;white-space:nowrap">${x.status!=="ON"&&(N.lead||x.owner_id===me)?`<button type="button" class="btn sm pri" data-zlqr="${x.id}">${x.status==="NEW"?"Quét QR":"Quét lại"}</button> `:""}${N.lead?`<button type="button" class="btn sm" data-zled="${x.id}">Sửa</button> `:""}${x.status==="ON"&&(N.lead||x.owner_id===me)?`<button type="button" class="btn sm" data-zlstop="${x.id}" style="color:#c0352b">Ngừng</button>`:""}</td></tr>`))}
   <p class="hint pad">An toàn nick: chỉ gửi khi người bấm Gửi, mỗi nick tối đa 5 tin trong 30 giây. Phiên đăng nhập lưu mã hóa trên máy chủ. Nick rớt thì máy tự nối lại; không nối được sẽ hiện "Cần quét lại QR". Không mở Zalo Web của nick này ở máy khác (Zalo sẽ đá phiên trên ABOS ra).</p></section>
   <section class="card" style="margin-top:12px"><h3 style="margin-top:0">Tin mẫu (gõ / trong ô nhắn)</h3><div id="zltpl"><p class="hint">Đang tải…</p></div></section>`;
  const add=m.querySelector("#zladd");if(add)add.onclick=()=>zlNickForm(null);
  m.querySelectorAll("[data-zled]").forEach(b=>b.onclick=()=>zlNickForm(L.find(x=>x.id===b.dataset.zled)));
  m.querySelectorAll("[data-zlqr]").forEach(b=>b.onclick=()=>zlQr(L.find(x=>x.id===b.dataset.zlqr)));
  m.querySelectorAll("[data-zlstop]").forEach(b=>b.onclick=async()=>{const x=L.find(y=>y.id===b.dataset.zlstop);if(!confirm(`Ngừng nick "${x.name}"? Máy sẽ đăng xuất Zalo trên ABOS và xóa phiên đã lưu. Muốn dùng lại thì quét QR.`))return;try{await zlPost("/nicks/"+x.id+"/stop");toast("Đã ngừng nick");zlLoadNicks();zlLoadMe()}catch(e){toast(e.message)}});
  zlTplEditor(m.querySelector("#zltpl"),N.lead)}
function zlNickForm(x){const N=ZL.nicks;crmModal(x?"Sửa nick Zalo":"Thêm nick Zalo",`<label class="cs-fl" style="display:block"><span>Tên nick trên web</span><input id="zlnn" value="${esc(x?x.name:"")}" placeholder="Ví dụ: Zalo Sale 1" style="width:100%"></label>
   <label class="cs-fl" style="display:block;margin-top:10px"><span>Người phụ trách (sale thấy hội thoại của nick mình)</span><select id="zlno" style="width:100%">${opt([["","Chưa giao"]].concat((N.users||[]).map(u=>[u.id,u.display_name])),x?x.owner_id||"":"")}</select></label>
   <p class="hint">Dùng nick Zalo công việc do công ty cấp, không dùng Zalo cá nhân.</p>
   <div class="acts" style="justify-content:flex-end"><button type="button" class="btn" onclick="closeCM()">Hủy</button><button type="button" class="btn pri" id="zlns">${x?"Lưu":"Lưu và quét QR"}</button></div>`);
  $("#zlns").onclick=async e=>{e.target.disabled=true;const b={name:$("#zlnn").value.trim(),owner_id:$("#zlno").value};
    try{if(x){await zlPost("/nicks/"+x.id,b,"PATCH");closeCM();zlLoadNicks()}else{const r=await zlPost("/nicks",b);closeCM();await zlLoadNicks();zlQr({id:r.id,name:b.name})}}catch(er){e.target.disabled=false;toast(er.message)}}}
/* Hộp quét QR: web xin mã, máy VPS tạo mã, hiện ở đây; quét xong tự đóng. */
async function zlQr(x){try{await zlPost("/nicks/"+x.id+"/qr")}catch(e){toast(e.message);return}
  crmModal("Quét mã QR · "+esc(x.name),`<div class="zl-qr"><div class="img" id="zlqri">Đang tạo mã QR…<br>(vài giây)</div><ol>
   <li>Mở Zalo trên điện thoại của <b>nick công việc</b> này.</li><li>Bấm biểu tượng quét mã (góc trên, cạnh ô tìm kiếm).</li><li>Quét mã bên cạnh.</li><li>Bấm <b>Đồng ý đăng nhập</b> trên điện thoại.</li></ol></div>
   <p class="hint" id="zlqrs" style="margin-top:12px">Mã tự đổi khi hết hạn. Đừng tắt hộp này cho tới khi báo xong.</p>`);
  const t0=Date.now();let lastQr="";
  const tick=async()=>{const ov=$("#crmm");if(!ov||ov.hidden||!document.getElementById("zlqri"))return;
    try{const r=await zlApi("/nicks/"+x.id),im=$("#zlqri"),st=$("#zlqrs");if(!im)return;
      if(r.status==="ON"){closeCM();toast("Đã nối nick "+x.name+(r.zalo_name?" ("+r.zalo_name+")":""));zlLoadNicks();zlLoadMe();return}
      if(r.qr_image&&r.qr_image!==lastQr){lastQr=r.qr_image;im.innerHTML=`<img src="data:image/png;base64,${r.qr_image}" alt="Mã QR đăng nhập Zalo">`}
      if(r.status==="SCANNED")st.innerHTML="📱 Đã quét. Bấm <b>Đồng ý đăng nhập</b> trên điện thoại.";
      else if(r.status==="NEED_QR"||r.status==="OFF")st.textContent=r.status_note||"Chưa đăng nhập được, bấm Quét lại.";
      if(Date.now()-t0>4*60000){st.textContent="Quá 4 phút chưa xong. Đóng hộp và bấm Quét lại.";return}}catch(e){}
    setTimeout(tick,2000)};
  setTimeout(tick,1500)}
async function zlTplEditor(el,lead){if(!el)return;ZL.tpl=null;const T=await zlTpl();
  if(!lead){el.innerHTML=T.length?T.map(x=>`<div class="zl-dl"><b>/${esc(x.code)}</b><span>${esc(x.text)}</span></div>`).join(""):`<p class="hint">Chưa có tin mẫu. Lead / CEO soạn ở đây.</p>`;return}
  let rows=T.map(x=>({...x}));if(!rows.length)rows=[{code:"chao",text:"Dạ AILLA xin chào anh/chị, em có thể hỗ trợ gì ạ?"}];
  const draw=()=>{el.innerHTML=rows.map((x,i)=>`<div class="zl-tplrow"><input data-tc="${i}" value="${esc(x.code)}" placeholder="mã, vd chao"><textarea data-tt="${i}" rows="2" placeholder="Nội dung tin">${esc(x.text)}</textarea><button type="button" class="btn sm" data-tx="${i}" title="Bỏ">✕</button></div>`).join("")+`<div class="acts" style="justify-content:space-between"><button type="button" class="btn sm" id="zltadd">＋ Thêm tin mẫu</button><button type="button" class="btn pri sm" id="zltsave">Lưu tin mẫu</button></div><p class="hint">Gõ "/" và mã (ví dụ /chao) trong ô nhắn để chèn. Giá, khuyến mãi ghi đúng bảng giá đang áp dụng.</p>`;
    el.querySelectorAll("[data-tc]").forEach(i=>i.oninput=()=>rows[+i.dataset.tc].code=i.value);el.querySelectorAll("[data-tt]").forEach(i=>i.oninput=()=>rows[+i.dataset.tt].text=i.value);
    el.querySelectorAll("[data-tx]").forEach(b=>b.onclick=()=>{rows.splice(+b.dataset.tx,1);draw()});
    el.querySelector("#zltadd").onclick=()=>{rows.push({code:"",text:""});draw()};
    el.querySelector("#zltsave").onclick=async e=>{e.target.disabled=true;try{const r=await zlPost("/templates",{items:rows},"PUT");ZL.tpl=null;toast("Đã lưu "+r.n+" tin mẫu")}catch(er){toast(er.message)}e.target.disabled=false}};
  draw()}

/* ---------- khung Zalo của một khách (CSKH: hộp thông tin khách, hồ sơ khách) ---------- */
async function zlThreadBox(el,q,opts){if(!el||!ZL.me||!zlSee())return;zlCss();opts=opts||{};
  const qs=q.customer_id?"customer_id="+encodeURIComponent(q.customer_id):"cskh_phone="+encodeURIComponent(q.cskh_phone);let D0;
  try{D0=await zlApi("/thread?"+qs)}catch(e){el.innerHTML="";return}if(!el.isConnected)return;
  const convs=D0.convs,myOn=D0.nicks.filter(n=>n.status==="ON");
  const pick=convs.length>1?`<select data-zlvia title="Gửi qua nick">${convs.map(c=>`<option value="c:${c.id}">${esc(c.nick_name)}</option>`).join("")}</select>`:!convs.length&&myOn.length>1?`<select data-zlvia title="Gửi qua nick">${myOn.map(n=>`<option value="n:${n.id}">${esc(n.name)}</option>`).join("")}</select>`:"";
  const canSend=convs.length?convs.some(c=>D0.lead||c.owner_id===ZL.me.id):myOn.length>0&&!!q.phone;
  const wait=convs.find(c=>c.waiting_since);
  el.innerHTML=`<div class="zl-box"><div class="zl-hd">${zlDot}<span>${opts.title||"Tin Zalo"}</span>${convs.map(c=>pill(c.nick_name,"vio")).join("")}${wait?pill("Chờ "+zlAgo(wait.waiting_since),"red"):""}<span class="sp"></span>${convs.length?`<button type="button" class="btn sm" data-zlopen="${convs[0].id}">Mở trong Hộp tin</button>`:""}</div>
   <div class="zl-msgs sm" data-zlmsgs>${convs.length?zlMsgsHtml(D0.msgs,D0.lead,convs.length>1):`<div class="zl-empty">${myOn.length?"Chưa nhắn Zalo với khách này. Gõ tin bên dưới, máy tìm Zalo theo số "+esc(q.phone||"")+" rồi gửi.":"Chưa nhắn Zalo với khách này. Bạn chưa có nick Zalo đang chạy."}</div>`}</div>
   ${canSend?zlComposer(pick):""}</div>
   ${opts.days!==false&&D0.days.length?`<div class="zl-days"><div class="hint"><b>Nhắn Zalo</b> (tự ghi từ tin Zalo)</div>${D0.days.slice(0,10).map(d=>`<div class="zl-dl"><span class="w">${esc(d.day.slice(8,10)+"/"+d.day.slice(5,7))}</span><span><b>Zalo</b> · ${d.in} tin khách, ${d.out} tin gửi · ${esc(d.nick)}${d.last_in?` <span class="hint">· khách: "${esc(d.last_in.slice(0,80))}"</span>`:""}</span></div>`).join("")}</div>`:""}`;
  const ms=el.querySelector("[data-zlmsgs]");ms.scrollTop=ms.scrollHeight;
  el.querySelectorAll("[data-zlopen]").forEach(b=>b.onclick=()=>{closeCM();zlGo("zl_inbox",b.dataset.zlopen)});
  zlBindComposer(el,async v=>{const via=el.querySelector("[data-zlvia]"),sel=via?via.value:convs.length?"c:"+convs[0].id:"n:"+(myOn[0]&&myOn[0].id);
    const r=sel.startsWith("c:")?await zlPost("/convs/"+sel.slice(2)+"/send",{text:v}):await zlPost("/send-new",{nick_id:sel.slice(2),phone:q.phone,text:v,customer_id:q.customer_id,cskh_phone:q.cskh_phone});
    ms.insertAdjacentHTML("beforeend",`<div class="zl-m me pend">${esc(v)}<div class="t">Đang gửi…</div></div>`);ms.scrollTop=ms.scrollHeight;
    zlWaitCmd(r.id,ok=>{if(el.isConnected)zlThreadBox(el,q,opts);if(!ok)toast("Tin Zalo chưa gửi được")})})}
/* Chờ máy VPS gửi xong (tối đa ~1 phút). */
function zlWaitCmd(id,done){let n=0;const go=async()=>{n++;try{const r=await zlApi("/cmds/"+id);if(r.status==="DONE")return done(true);if(r.status==="FAILED"){toast(r.error||"Chưa gửi được");return done(false)}}catch(e){}if(n<30)setTimeout(go,2000);else done(false)};setTimeout(go,1500)}

/* ---------- CSKH › Việc hôm nay: cột Zalo + tab "Zalo chờ trả lời" ---------- */
async function zlCsStat(force){if(!zlSee())return null;if(!force&&ZL.cs&&Date.now()-ZL.csAt<30000)return ZL.cs;
  try{const r=await zlApi("/status/cskh");ZL.cs={};r.rows.forEach(x=>ZL.cs[x.key]=x);ZL.csAt=Date.now()}catch(e){ZL.cs=ZL.cs||{}}return ZL.cs}
function zlCell(s){if(!s)return `<span class="hint">—</span>`;if(s.wait_since)return pill("Chờ "+zlAgo(s.wait_since),"red");return `<span style="display:inline-flex;gap:4px;align-items:center">${zlDot}<span class="hint">${s.last_from_me?"Đã trả lời":"Đã xem"} ${esc(zlHM(s.last_at))}</span></span>`}
if(typeof PAGES!=="undefined"&&PAGES.cs_today){const _t=PAGES.cs_today;PAGES.cs_today=function(m){if(CSK.tf==="zalo"&&!zlSee())CSK.tf="all";const r=_t.apply(this,arguments);try{zlCsDecor(m)}catch(e){}return r}}
async function zlCsDecor(m){if(!zlSee()||!m.querySelector(".cs-st"))return;zlCss();const S=await zlCsStat(false);if(!S||!m.isConnected||PAGE!=="cs_today")return;
  const st=m.querySelector(".cs-st");if(st&&!st.querySelector("[data-zltab]")){const n=Object.values(S).filter(x=>x.wait_since).length,b=document.createElement("button");b.dataset.zltab="1";b.className=CSK.tf==="zalo"?"on":"";b.innerHTML=`${zlDot} Zalo chờ trả lời <em>${n}</em>`;b.style.cssText="display:inline-flex;align-items:center;gap:5px;border-style:dashed";
    const da=st.querySelector('[data-cstf="da"]');if(da)da.before(b);else st.appendChild(b);b.onclick=()=>{CSK.tf="zalo";CSK.tpage=1;renderMain()};
    if(CSK.tf==="zalo")st.querySelectorAll("[data-cstf]").forEach(x=>x.classList.remove("on"))}
  if(CSK.tf==="zalo"){const sec=m.querySelector(".cs-cmp");if(sec)zlCsWaitTable(sec);return}
  const t=m.querySelector(".cs-cmp table");if(!t||t.dataset.zl)return;t.dataset.zl="1";const hr=t.querySelector("thead tr");if(!hr)return;
  const th=document.createElement("th");th.textContent="Zalo";th.style.background="rgba(114,83,224,.08)";hr.insertBefore(th,hr.lastElementChild);
  t.querySelectorAll("tbody tr[data-csquick]").forEach(tr=>{const td=document.createElement("td");td.style.background="rgba(114,83,224,.05)";td.innerHTML=zlCell(S[tr.dataset.csquick]);tr.insertBefore(td,tr.lastElementChild)})}
async function zlCsWaitTable(sec){sec.innerHTML=`<p class="hint pad">Đang tải…</p>`;let L=[];
  try{L=(await zlApi("/convs?f=wait")).filter(c=>c.cskh_phone)}catch(e){sec.innerHTML=`<p class="hint pad">${esc(e.message)}</p>`;return}
  sec.innerHTML=L.length?tbl(["Khách","SĐT","Chờ","Tin cuối của khách","Nick",""],L.map(c=>`<tr><td><b>${esc(c.cskh_name||c.name||"")}</b></td><td>${esc(typeof csPh==="function"?csPh(c.cskh_phone):c.cskh_phone)}</td><td>${pill(zlAgo(c.waiting_since),"red")}</td><td class="hint" style="max-width:320px;overflow:hidden;text-overflow:ellipsis">${esc(c.last_text||"")}</td><td>${pill(c.nick_name,"vio")}</td><td style="text-align:right;white-space:nowrap"><button type="button" class="btn sm pri" data-zlrep="${c.id}">Trả lời</button> <button type="button" class="btn sm" data-csopen="${esc(c.cskh_phone)}">Hồ sơ</button></td></tr>`),"cs-cmpt"):`<p class="hint pad">Không có khách lẻ nào đang chờ trả lời trên Zalo.</p>`;
  sec.querySelectorAll("[data-zlrep]").forEach(b=>b.onclick=()=>{const c=L.find(x=>x.id===b.dataset.zlrep);crmModal(esc(c.cskh_name||c.name||"Khách")+" · Zalo",`<div id="zlqbox"></div>`,true);zlThreadBox($("#zlqbox"),{cskh_phone:c.cskh_phone,phone:c.cskh_phone},{days:false})});
  if(typeof csBind2==="function")csBind2(sec)}

/* Hộp thông tin khách (bấm dòng ở Việc hôm nay): thêm khung Zalo gần nhất. */
if(typeof csQuick==="function"){const _q=csQuick;csQuick=function(phone){const r=_q.apply(this,arguments);if(zlSee()){let n=0;const w=()=>{const b=document.querySelector("#crmm #cqopen");if(!b){if(++n<40)setTimeout(w,100);return}
  const acts=b.closest(".acts");if(!acts||document.getElementById("zlqk"))return;const d=document.createElement("div");d.id="zlqk";d.style.marginTop="12px";acts.before(d);zlThreadBox(d,{cskh_phone:phone,phone},{title:"Zalo gần nhất",days:false})};w()}return r}}
/* Hồ sơ khách CSKH: khung Tin Zalo trên "Các lần gọi"; tóm tắt nhắn Zalo theo ngày nằm trong khung. */
if(typeof csProfBind==="function"){const _p=csProfBind;csProfBind=function(m){const r=_p.apply(this,arguments);try{const P=CSK.prof;if(P&&zlSee()&&!m.querySelector("#zlprof")){const pr=m.querySelector(".cs-pr");if(pr){const s=document.createElement("section");s.className="card";s.id="zlprof";const c=P.customer;pr.insertBefore(s,pr.children[1]||null);zlThreadBox(s,{cskh_phone:c.phone,phone:c.phone})}}}catch(e){}return r}}

/* =====================================================================
   ĐỢT 2 (27/11): thao tác từng tin, ảnh / tệp / nhãn dán, ghim, kết bạn, AI, Khách hôm nay, Đo sale
   ===================================================================== */
const zlTyping=t=>!!t&&Date.now()-Date.parse(t)<12000;
function zlCss2(){if(document.getElementById("zlcss2"))return;const s=document.createElement("style");s.id="zlcss2";s.textContent=`
.zl-m{position:relative}.zl-m.hid{opacity:.55}
.zl-mm{position:absolute;top:2px;right:-26px;border:0;background:none;cursor:pointer;color:var(--muted,#6b7090);font-size:16px;padding:0 4px;opacity:0}
.zl-m.me .zl-mm{right:auto;left:-26px}.zl-m:hover .zl-mm,.zl-mm:focus-visible{opacity:1}
@media(hover:none){.zl-mm{opacity:.7}}
.zl-q{border-left:3px solid #7253e0;background:rgba(114,83,224,.07);border-radius:6px;padding:3px 8px;margin-bottom:4px;font-size:12.5px;color:var(--muted,#6b7090);white-space:pre-wrap}
.zl-q b{display:block;color:#4b54d1;font-size:11.5px}
.zl-rx{position:absolute;bottom:-10px;right:8px;background:#fff;border:1px solid var(--line,#e6e8f0);border-radius:99px;font-size:12px;padding:0 6px;line-height:18px}
.zl-m:has(.zl-rx){margin-bottom:8px}
.zl-st{width:110px;height:110px;object-fit:contain;display:block}
.zl-m audio{max-width:240px;height:36px}
.zl-ib2{border:1px solid var(--line,#e6e8f0);background:#fff;border-radius:9px;width:36px;height:36px;cursor:pointer;font-size:16px;flex:none}
.zl-ai{margin:6px 12px;border:1px solid #4b54d1;border-radius:12px;padding:8px 10px;background:#fff;display:flex;flex-direction:column;gap:6px}
.zl-ai.note{border-color:#e0a800;background:#fff8e6;color:#8a5a00;font-size:13px}
.zl-ai .tx{white-space:pre-wrap;font-size:13.5px}
.zl-qbar{display:flex;gap:8px;align-items:center;margin:6px 12px 0;border-left:3px solid #7253e0;background:rgba(114,83,224,.07);border-radius:6px;padding:4px 8px;font-size:12.5px}
.zl-qbar span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.zl-pop{position:fixed;z-index:60;background:#fff;border:1px solid var(--line,#e6e8f0);border-radius:12px;box-shadow:0 12px 32px rgba(16,24,40,.18);padding:6px;min-width:190px}
.zl-pop .emo{display:flex;gap:2px;padding:2px 2px 6px;border-bottom:1px solid var(--line,#eef0f5);margin-bottom:4px}
.zl-pop .emo button{border:0;background:none;font-size:20px;cursor:pointer;border-radius:8px;padding:2px 4px}.zl-pop .emo button:hover{background:#f1f2f7}
.zl-pop .it{display:block;width:100%;text-align:left;border:0;background:none;padding:7px 9px;border-radius:8px;cursor:pointer;font:inherit;font-size:13.5px}.zl-pop .it:hover{background:#f1f2f7}.zl-pop .it.red{color:#c0352b}
.zl-stk{display:grid;grid-template-columns:repeat(5,64px);gap:4px;max-height:280px;overflow:auto}.zl-stk button{border:0;background:none;cursor:pointer;border-radius:8px}.zl-stk button:hover{background:#f1f2f7}.zl-stk img{width:60px;height:60px;object-fit:contain}
.zl-br h4{margin:12px 0 4px;font-size:13.5px}.zl-br .row{display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:8px;cursor:pointer;border:0;background:none;width:100%;text-align:left;font:inherit}.zl-br .row:hover{background:#f6f6fd}.zl-br .row>span:not(.pill){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.zl-br .row>.pill{flex:none}
.zl-fw{max-height:50vh;overflow:auto;display:flex;flex-direction:column;gap:2px;margin-top:8px}.zl-fw label{display:flex;gap:8px;align-items:center;padding:5px 6px;border-radius:8px;cursor:pointer}.zl-fw label:hover{background:#f6f6fd}
`;document.head.appendChild(s)}
{const _c=zlCss;zlCss=function(){_c();zlCss2()}}

/* Đầu khung chat: tên, nick, đang gõ, ghim, kết bạn, AI tóm tắt, thông tin khách. */
function zlDrawHead(){const hd=$("#zlhd");if(!hd||!ZL.det)return;const D0=ZL.det,c=D0.conv,nm=(D0.customer&&D0.customer.name)||(D0.cskh&&D0.cskh.name)||c.name||c.peer_phone||"",can=D0.can_send;
  hd.innerHTML=`<button type="button" class="btn sm zl-back" id="zlback">← Danh sách</button>${zlDot}<span>${esc(nm)}</span>${pill(c.nick_name,"vio")}${c.peer_phone?`<span class="hint">${esc(c.peer_phone)}</span>`:""}${zlTyping(c.typing_at)?`<i class="hint" style="color:#18864f">đang gõ…</i>`:""}<span class="sp"></span>
   <button type="button" class="btn sm" id="zlpin" title="${c.pinned_at?"Bỏ ghim":"Ghim lên đầu danh sách"}">${c.pinned_at?"📌 Bỏ ghim":"📌 Ghim"}</button>
   ${can&&!c.is_group&&c.is_friend!==1?`<button type="button" class="btn sm" id="zlfr" title="Gửi lời mời kết bạn từ nick này">＋ Kết bạn</button>`:""}
   <button type="button" class="btn sm" id="zlsum" title="AI tóm tắt cuộc chat, khách vui hay lăn tăn, nên làm gì tiếp">✦ Tóm tắt</button>
   <button type="button" class="btn sm" id="zlinfo">Thông tin khách</button>`;
  $("#zlback").onclick=()=>{ZL.cur="";ZL.det=null;const ib=$("#zlib");if(ib)ib.classList.remove("has","rp");zlDrawChat();zlDrawList()};
  $("#zlinfo").onclick=()=>{const ib=$("#zlib");if(ib){ib.classList.toggle("rp");const rp=$("#zlrp");if(rp&&ib.classList.contains("rp"))rp.scrollIntoView({behavior:"smooth",block:"start"})}};
  $("#zlpin").onclick=async()=>{try{await zlPost("/convs/"+c.id+"/pin",{on:!c.pinned_at});await zlLoadConv(true);zlLoadConvs(true)}catch(e){toast(e.message)}};
  const fr=$("#zlfr");if(fr)fr.onclick=()=>{crmModal("Gửi lời mời kết bạn",`<p class="hint" style="margin-top:0">Mỗi nick tối đa 30 lời mời trong 24 giờ để tránh bị Zalo khóa.</p><textarea id="zlfrt" rows="2" style="width:100%">Chào anh/chị, em bên AILLA ạ. Anh/chị kết bạn để em tiện gửi bảng giá, chương trình mới nhé.</textarea><div class="acts" style="justify-content:flex-end"><button type="button" class="btn" onclick="closeCM()">Hủy</button><button type="button" class="btn pri" id="zlfrs">Gửi lời mời</button></div>`);
    $("#zlfrs").onclick=async e=>{e.target.disabled=true;try{await zlPost("/convs/"+c.id+"/friend",{text:$("#zlfrt").value});closeCM();toast("Đã gửi lời mời kết bạn")}catch(er){e.target.disabled=false;toast(er.message)}}};
  $("#zlsum").onclick=async e=>{e.target.disabled=true;try{const r=await zlPost("/convs/"+c.id+"/ai-summary");crmModal("AI tóm tắt · "+esc(nm),`<div style="white-space:pre-wrap;line-height:1.6">${esc(r.text)}</div><p class="hint">AI đọc 30 tin gần nhất (đã che số điện thoại). Dùng để tham khảo.</p>`)}catch(er){toast(er.message)}e.target.disabled=false}}

/* Ô trích dẫn đang trả lời. */
function zlQBar(){const el=$("#zlqbar");if(!el)return;const q=ZL.quote;el.innerHTML=q?`<div class="zl-qbar">↩ <span>Trả lời: ${esc(q.text||(q.kind!=="text"?"["+q.kind+"]":""))}</span><button type="button" class="btn sm" id="zlqx" aria-label="Bỏ trả lời">✕</button></div>`:"";
  const x=$("#zlqx");if(x)x.onclick=()=>{ZL.quote=null;zlQBar()}}

/* Nút ảnh / tệp, nhãn dán, AI sửa câu cạnh ô nhắn. */
function zlBindTools(root,convId){const ta=root.querySelector(".zl-comp textarea"),fi=root.querySelector("[data-zlfile]");if(!ta)return;
  const att=root.querySelector("[data-zlatt]");if(att)att.onclick=()=>fi.click();
  if(fi)fi.onchange=async()=>{const f=fi.files&&fi.files[0];fi.value="";if(!f||!ZL.det)return;
    try{toast("Đang tải "+f.name+"…");const up=await zlFileUp(f,ZL.det.conv.nick_id);const cap=ta.value.trim();
      await zlPost("/convs/"+convId+"/send",{text:/^image\//.test(f.type)?cap:"",file_id:up.id,quote_id:ZL.quote?ZL.quote.id:undefined});if(/^image\//.test(f.type))ta.value="";ZL.quote=null;zlQBar();await zlLoadConv(false);zlTick()}catch(e){toast(e.message)}};
  const stk=root.querySelector("[data-zlstk]");if(stk)stk.onclick=async()=>{const r=stk.getBoundingClientRect();let L=[];try{L=await zlApi("/stickers")}catch(e){}
    zlPop(r.left,r.top-300,L.length?`<div class="zl-stk">${L.map((x,i)=>`<button type="button" data-si="${i}" title="Gửi nhãn dán">${x.url?`<img src="${esc(x.url)}" alt="Nhãn dán" referrerpolicy="no-referrer" loading="lazy">`:"#"+x.id}</button>`).join("")}</div>`:`<p class="hint" style="max-width:240px;margin:6px">Chưa có nhãn dán. Khi khách hoặc sale gửi nhãn dán trên Zalo, web nhớ lại để chọn gửi ở đây.</p>`,
      p=>p.querySelectorAll("[data-si]").forEach(b=>b.onclick=async()=>{zlPopClose();try{await zlPost("/convs/"+convId+"/send",{sticker:L[+b.dataset.si]});await zlLoadConv(false);zlTick()}catch(e){toast(e.message)}}))};
  const pol=root.querySelector("[data-zlpol]");if(pol)pol.onclick=async()=>{const t=ta.value.trim();if(!t){toast("Gõ câu trước, rồi bấm ✦ để AI sửa");return}pol.disabled=true;
    try{const r=await zlPost("/convs/"+convId+"/ai-polish",{text:t});if(r.text){ZL.polUndo=t;ta.value=r.text;ta.dispatchEvent(new Event("input"));toast("AI đã sửa câu. Đọc lại rồi bấm Gửi (Ctrl+Z để lấy lại câu cũ).")}}catch(e){toast(e.message)}pol.disabled=false};
  ta.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="z"&&ZL.polUndo){e.preventDefault();ta.value=ZL.polUndo;ZL.polUndo="";ta.dispatchEvent(new Event("input"))}})}
/* Tải tệp lên: ảnh thu nhỏ tối đa 1600px, JPEG; tệp khác tối đa 1,9 MB. */
async function zlFileUp(f,nickId){let b64="",mime=f.type||"application/octet-stream",name=f.name||"tep";
  if(/^image\/(jpeg|png|webp)$/.test(mime)){const url=URL.createObjectURL(f);try{const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url});
      const k=Math.min(1,1600/Math.max(im.width,im.height)),cv=document.createElement("canvas");cv.width=Math.round(im.width*k);cv.height=Math.round(im.height*k);cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);
      b64=cv.toDataURL("image/jpeg",.85).split(",")[1];mime="image/jpeg";name=name.replace(/\.\w+$/,"")+".jpg"}finally{URL.revokeObjectURL(url)}}
  else{if(f.size>1900000)throw new Error("Tệp lớn quá 1,9 MB. Tệp lớn gửi bằng Zalo trên điện thoại.");b64=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]||"");r.onerror=no;r.readAsDataURL(f)})}
  return zlPost("/files",{nick_id:nickId,name,mime,b64})}

/* Hộp nổi nhỏ (menu tin, nhãn dán). */
function zlPopClose(){const p=$("#zlpop");if(p)p.remove()}
function zlPop(x,y,html,bind){zlPopClose();const p=document.createElement("div");p.id="zlpop";p.className="zl-pop";p.innerHTML=html;document.body.appendChild(p);
  const w=p.offsetWidth,h=p.offsetHeight;p.style.left=Math.max(8,Math.min(x,innerWidth-w-8))+"px";p.style.top=Math.max(8,Math.min(y,innerHeight-h-8))+"px";if(bind)bind(p);
  setTimeout(()=>document.addEventListener("click",function f(e){if(!p.contains(e.target)){zlPopClose();document.removeEventListener("click",f,true)}},true),0)}
/* Menu một tin: thả cảm xúc, trả lời, chép, chuyển tiếp, thu hồi (tin mình), ẩn phía mình. */
function zlMsgMenu(id,x,y){const m=ZL.det&&ZL.det.msgs.find(z=>z.id===id);if(!m)return;const mine=!!m.from_me;
  zlPop(x,y,`<div class="emo">${Object.entries(ZL_ICON).map(([k,v])=>`<button type="button" data-ic="${esc(k)}" title="Thả ${v}">${v}</button>`).join("")}</div>
   <button type="button" class="it" data-a="rep">↩ Trả lời (trích dẫn)</button><button type="button" class="it" data-a="copy">⧉ Chép chữ</button><button type="button" class="it" data-a="fw">↪ Chuyển tiếp…</button>
   ${mine&&!m.recalled?`<button type="button" class="it red" data-a="undo">⟲ Thu hồi (khách không thấy nữa)</button>`:""}<button type="button" class="it" data-a="hide">🙈 Ẩn phía mình</button>`,
   p=>{p.querySelectorAll("[data-ic]").forEach(b=>b.onclick=async()=>{zlPopClose();try{await zlPost("/msgs/"+id+"/react",{icon:b.dataset.ic});toast("Đã thả "+ZL_ICON[b.dataset.ic]);setTimeout(()=>zlLoadConv(false),3000)}catch(e){toast(e.message)}});
    p.querySelectorAll("[data-a]").forEach(b=>b.onclick=async()=>{zlPopClose();const a=b.dataset.a;
      if(a==="rep"){ZL.quote=m;zlQBar();const ta=$("#zlch textarea");if(ta)ta.focus()}
      else if(a==="copy"){try{await navigator.clipboard.writeText(m.text||m.url||"");toast("Đã chép")}catch(e){toast(m.text||"")}}
      else if(a==="fw")zlForward(m);
      else if(a==="undo"){if(!confirm("Thu hồi tin này trên Zalo? Khách sẽ không thấy nữa."))return;try{await zlPost("/msgs/"+id+"/undo");toast("Đang thu hồi…");setTimeout(()=>zlLoadConv(true),3500)}catch(e){toast(e.message)}}
      else if(a==="hide"){if(!confirm("Ẩn tin này trên web? Khách vẫn thấy trên Zalo; Lead / CEO vẫn xem được."))return;try{await zlPost("/msgs/"+id+"/hide");await zlLoadConv(true)}catch(e){toast(e.message)}}})})}
/* Chuyển tiếp: chọn tối đa 5 hội thoại. */
function zlForward(m){const L=(ZL.convs||[]).filter(c=>c.id!==ZL.cur);
  crmModal("Chuyển tiếp tin",`<div class="hint" style="margin-top:0">${esc((m.text||"["+m.kind+"]").slice(0,120))}</div><input id="zlfwq" placeholder="Tìm hội thoại" style="width:100%;margin-top:8px" autocomplete="off"><div class="zl-fw" id="zlfwl">${L.map(c=>`<label data-n="${esc((c.customer_name||c.cskh_name||c.name||"").toLowerCase())}"><input type="checkbox" value="${c.id}"> ${esc(c.customer_name||c.cskh_name||c.name||c.peer_phone||"")} <span class="hint">· ${esc(c.nick_name)}</span></label>`).join("")||`<p class="hint">Chưa có hội thoại khác.</p>`}</div>
   <div class="acts" style="justify-content:flex-end;margin-top:10px"><span class="hint" style="flex:1">Tối đa 5 nơi một lần.</span><button type="button" class="btn" onclick="closeCM()">Hủy</button><button type="button" class="btn pri" id="zlfws">Chuyển tiếp</button></div>`);
  $("#zlfwq").oninput=e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll("#zlfwl label").forEach(l=>l.hidden=!!q&&!l.dataset.n.includes(q))};
  $("#zlfws").onclick=async e=>{const ids=[...document.querySelectorAll("#zlfwl input:checked")].map(x=>x.value);if(!ids.length){toast("Chọn hội thoại nhận");return}if(ids.length>5){toast("Tối đa 5 nơi");return}
    e.target.disabled=true;try{await zlPost("/msgs/"+m.id+"/forward",{conv_ids:ids});closeCM();toast("Đã chuyển tiếp tới "+ids.length+" hội thoại")}catch(er){e.target.disabled=false;toast(er.message)}}}

/* AI soạn nháp: khách đang chờ trả lời thì hiện câu nháp trên ô nhắn; người đọc lại rồi bấm Gửi. */
ZL.aiOff={};
async function zlAiLoad(redo){const box=$("#zlai"),D0=ZL.det;if(!box||!D0)return;const c=D0.conv,L=D0.msgs,last=L[L.length-1];
  const key=c.id+":"+(last?last.id:"");
  if(!D0.can_send||c.is_group||!c.waiting_since||!last||last.from_me||ZL.aiOff[key]){box.innerHTML="";return}
  if(!redo&&ZL.ai&&ZL.ai.key===key){zlAiDraw();return}
  if(ZL.aiBusy===key)return;ZL.aiBusy=key;ZL.ai={key,busy:true};zlAiDraw();
  try{const r=await zlApi("/convs/"+c.id+"/ai"+(redo?"?redo=1":""));if(ZL.ai&&ZL.ai.key===key)ZL.ai={key,text:r.text,note:r.note}}catch(e){ZL.ai={key,text:"",note:e.message}}
  ZL.aiBusy="";zlAiDraw()}
function zlAiDraw(){const box=$("#zlai"),A=ZL.ai;if(!box||!A)return;
  if(A.busy){box.innerHTML=`<div class="zl-ai"><b style="color:#4b54d1">✦ AI đang soạn nháp…</b></div>`;return}
  if(!A.text&&!A.note){box.innerHTML="";return}
  if(!A.text){box.innerHTML=`<div class="zl-ai note">✦ ${esc(A.note)}</div>`;return}
  box.innerHTML=`<div class="zl-ai"><div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap"><b style="color:#4b54d1">✦ AI soạn sẵn</b><span class="hint">giá lấy từ bảng giá đúng cấp khách · người đọc lại rồi bấm Gửi</span></div><div class="tx">${esc(A.text)}</div>
   <div class="acts" style="margin:0;gap:6px"><button type="button" class="btn sm pri" id="zlaiu">Dùng câu này</button><button type="button" class="btn sm" id="zlair">Viết lại</button><button type="button" class="btn sm" id="zlaix">Bỏ</button></div></div>`;
  $("#zlaiu").onclick=()=>{const ta=$("#zlch textarea");if(ta){ta.value=A.text;ta.dispatchEvent(new Event("input"));ta.focus()}toast("Đã chèn vào ô nhắn. Đọc lại rồi bấm Gửi.")};
  $("#zlair").onclick=()=>zlAiLoad(true);$("#zlaix").onclick=()=>{ZL.aiOff[A.key]=true;box.innerHTML=""}}

/* Khách hôm nay: chờ lâu nhất, hẹn hôm nay / quá hạn, lâu không chăm, im 30 ngày. */
async function zlBrief(){crmModal("☀ Khách hôm nay",`<div class="zl-br" id="zlbr"><p class="hint">Đang tải…</p></div>`,true);let B;try{B=await zlApi("/brief")}catch(e){$("#zlbr").innerHTML=`<p>${esc(e.message)}</p>`;return}
  const nm=x=>x.customer_name||x.cskh_name||x.name||"(chưa rõ tên)",fd=d=>d?String(d).slice(8,10)+"/"+String(d).slice(5,7):"";
  const sec=(t,L,row,empty)=>`<h4>${t} <span class="hint">(${L.length})</span></h4>${L.length?L.map(row).join(""):`<p class="hint" style="margin:0 8px">${empty}</p>`}`;
  $("#zlbr").innerHTML=sec("Khách đang chờ trả lời lâu nhất",B.waiting,x=>`<button type="button" class="row" data-cv="${x.id}">${pill("Chờ "+zlAgo(x.waiting_since),"red")}<span><b>${esc(nm(x))}</b> · ${esc(x.last_text||"")}</span>${pill(x.nick_name,"vio")}</button>`,"Không có khách nào chờ.")
   +sec("Hẹn chăm sóc hôm nay / quá hạn (kênh phân phối)",B.due,x=>`<button type="button" class="row" data-kh="${x.id}">${pill(fd(x.day),"amb")}<span><b>${esc(x.name)}</b>${x.owner_name?" · "+esc(x.owner_name):""}</span></button>`,"Không có hẹn.")
   +sec("Hẹn gọi lại hôm nay / quá hạn (khách lẻ)",B.due_cskh,x=>`<button type="button" class="row" data-cs="${esc(x.phone)}">${pill(fd(x.day),"amb")}<span><b>${esc(x.name||x.phone)}</b>${x.owner_name?" · "+esc(x.owner_name):""}</span></button>`,"Không có hẹn.")
   +sec("Khách lâu không chăm (theo giai đoạn)",B.stuck,x=>`<button type="button" class="row" data-kh="${x.id}">${pill(x.days+" ngày","red")}<span><b>${esc(x.name)}</b> · ${esc(ZL_STAGE[x.stage]||x.stage)}${x.owner_name?" · "+esc(x.owner_name):""}</span></button>`,"Không có khách nào bị bỏ quên.")
   +sec("Khách im trên Zalo hơn 30 ngày",B.silent,x=>`<button type="button" class="row" data-cv="${x.id}">${pill(fd(x.last_at),"gry")}<span><b>${esc(nm(x))}</b></span>${pill(x.nick_name,"vio")}</button>`,"Không có.")
   +`<p class="hint">Mới tiếp cận quá 7 ngày, đang tư vấn / đã báo giá quá 14 ngày, đang đàm phán quá 21 ngày, đã chốt đơn đầu quá 30 ngày không liên lạc thì tính là lâu không chăm.</p>`;
  document.querySelectorAll("#zlbr [data-cv]").forEach(b=>b.onclick=()=>{closeCM();zlGo("zl_inbox",b.dataset.cv)});
  document.querySelectorAll("#zlbr [data-kh]").forEach(b=>b.onclick=()=>{closeCM();zlOpenKpp(b.dataset.kh)});
  document.querySelectorAll("#zlbr [data-cs]").forEach(b=>b.onclick=()=>{closeCM();zlGo("cs_today");if(typeof csOpen==="function")csOpen(b.dataset.cs)})}

/* Nick Zalo: nút Kéo danh bạ + tin cũ, và lời mời kết bạn chờ trả lời. */
{const _n=pZlNick;pZlNick=function(m){_n(m);const N=ZL.nicks;if(!N||N.error||!N.nicks)return;const me=ZL.me&&ZL.me.id;
  m.querySelectorAll("tbody tr").forEach((tr,i)=>{const x=N.nicks[i];if(!x||x.status!=="ON"||!(N.lead||x.owner_id===me))return;const td=tr.lastElementChild;if(!td)return;
    const b=document.createElement("button");b.type="button";b.className="btn sm";b.textContent="Kéo danh bạ, tin cũ";b.title="Kéo bạn bè, nhóm Zalo và tin nhắn cũ của nick về web";b.style.marginRight="4px";
    b.onclick=async()=>{b.disabled=true;try{await zlPost("/nicks/"+x.id+"/sync");toast("Đang kéo danh bạ và tin cũ của "+x.name+". Vài phút sau xem ở Hộp tin.")}catch(e){toast(e.message)}b.disabled=false};td.prepend(b)});
  const tp=m.querySelector("#zltpl");if(!tp)return;const sec=document.createElement("section");sec.className="card";sec.style.marginTop="12px";sec.innerHTML=`<h3 style="margin-top:0">Lời mời kết bạn tới các nick</h3><div id="zlfrq"><p class="hint">Đang tải…</p></div>`;
  tp.closest("section").before(sec);zlFrDraw()}}
async function zlFrDraw(){const el=$("#zlfrq");if(!el)return;let L=[];try{L=await zlApi("/friend-reqs")}catch(e){el.innerHTML=`<p class="hint">${esc(e.message)}</p>`;return}
  el.innerHTML=L.length?tbl(["Người mời","Lời nhắn","Nick","Lúc",""],L.map(x=>`<tr><td><b>${esc(x.name||x.uid)}</b></td><td class="hint">${esc(x.msg||"")}</td><td>${pill(x.nick_name,"vio")}</td><td>${esc(zlHM(x.at))}</td><td style="text-align:right;white-space:nowrap"><button type="button" class="btn sm pri" data-fy="${esc(x.nick_id)}|${esc(x.uid)}">Đồng ý</button> <button type="button" class="btn sm" data-fn="${esc(x.nick_id)}|${esc(x.uid)}">Từ chối</button></td></tr>`)):`<p class="hint">Chưa có lời mời nào đang chờ.</p>`;
  el.querySelectorAll("[data-fy],[data-fn]").forEach(b=>b.onclick=async()=>{const [n,u]=(b.dataset.fy||b.dataset.fn).split("|");b.disabled=true;try{await zlPost("/friend-reqs/"+encodeURIComponent(n)+"/"+encodeURIComponent(u),{accept:!!b.dataset.fy});toast(b.dataset.fy?"Đang đồng ý kết bạn…":"Đã từ chối");setTimeout(zlFrDraw,4000)}catch(e){b.disabled=false;toast(e.message)}})}

/* Đo sale qua Zalo (Lead / CEO). */
const ZLDS={from:"",to:"",data:null,busy:false};
function pZlDoSale(m){zlCss();if(!zlLead()){m.innerHTML=H("Đo sale qua Zalo","")+`<section class="card"><p>Chỉ Lead / CEO xem trang này.</p></section>`;return}
  const d0=new Date(Date.now()+7*36e5).toISOString().slice(0,10),d7=new Date(Date.now()+7*36e5-6*864e5).toISOString().slice(0,10);if(!ZLDS.from){ZLDS.from=d7;ZLDS.to=d0}
  const D0=ZLDS.data;const f=v=>v===null||v===undefined?"—":nf(v);
  m.innerHTML=H("Đo sale qua Zalo","Sale trả lời khách nhanh hay chậm, khách nào đang bị để chờ")+`
   <div class="acts" style="align-items:center;margin:0 0 10px"><label>Từ <input type="date" id="zlds-f" value="${ZLDS.from}"></label><label>đến <input type="date" id="zlds-t" value="${ZLDS.to}"></label><button type="button" class="btn pri" id="zlds-go">Xem</button><span class="hint">Tối đa 31 ngày.</span></div>
   <section class="card flush">${!D0?`<p class="hint pad">${ZLDS.busy?"Đang tính…":"Bấm Xem."}</p>`:D0.error?`<p class="pad">${esc(D0.error)}</p>`:tbl(["Sale","Hội thoại","Tin nhận","Tin gửi","Lần trả lời","Trả lời TB","Trả lời giữa","Trong 15 phút","Chờ quá 60 phút","Đang chờ","Đang chờ quá 30 phút"],
     D0.people.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td class="n">${f(p.convs)}</td><td class="n">${f(p.inMsgs)}</td><td class="n">${f(p.outMsgs)}</td><td class="n">${f(p.replies)}</td><td class="n">${p.avgMin===null?"—":p.avgMin+" phút"}</td><td class="n"><b>${p.medianMin===null?"—":p.medianMin+" phút"}</b></td><td class="n">${p.within15===null?"—":p.within15+"%"}</td><td class="n" style="${p.over60?"color:#c0352b;font-weight:700":""}">${f(p.over60)}</td><td class="n">${f(p.wait_now)}</td><td class="n" style="${p.wait_late?"color:#c0352b;font-weight:700":""}">${f(p.wait_late)}</td></tr>`))}
   <p class="hint pad">Cách tính: mỗi lần khách nhắn mà chưa ai trả lời, tính từ tin khách đầu tiên tới tin bên mình gửi kế tiếp (gửi trên web hay trên điện thoại đều tính). Chỉ tính chat 1-1, không tính nhóm. "Trả lời giữa" là mức ở giữa: một nửa số lần trả lời nhanh hơn mức này. Xếp từ người trả lời nhanh nhất.</p></section>
   <div class="acts" style="margin-top:10px"><button type="button" class="btn" id="zlds-br">☀ Khách hôm nay</button></div>`;
  const go=async()=>{ZLDS.from=$("#zlds-f").value;ZLDS.to=$("#zlds-t").value;ZLDS.busy=true;ZLDS.data=null;renderMain();try{ZLDS.data=await zlApi(`/report?from=${ZLDS.from}&to=${ZLDS.to}`)}catch(e){ZLDS.data={error:e.message}}ZLDS.busy=false;if(PAGE==="zl_dosale")renderMain()};
  $("#zlds-go").onclick=go;$("#zlds-br").onclick=zlBrief;if(!D0&&!ZLDS.busy)go()}

Object.assign(PAGES,{zl_inbox:pZlInbox,zl_nick:pZlNick,zl_dosale:pZlDoSale});
