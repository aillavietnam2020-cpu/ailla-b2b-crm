/* ---------- Điều hành agent ----------
   Mỗi agent là một "nhân sự": thẻ có ảnh chân dung, tên, chức danh, trạng thái. Bấm vào để nhắn thẳng cho agent OpenClaw.
   Tin vào hàng đợi (/api/agent-chat); cầu nối trên VPS lấy tin, nhờ đúng agent trả lời rồi gửi lên lại; tin Telegram của chị cũng được chép lên (từ lúc bật).
   Chỉ CEO thấy. Web chỉ chuyển lời: việc agent làm với dữ liệu thật vẫn qua cổng /api/agent (đọc + đề xuất chờ duyệt). */
const AC={agents:null,relay:false,isCeo:false,access:null,cur:"",msgs:[],files:[],last:0,busy:false,tg:null,pend:[],docs:[],drafts:{},filter:"all",tab:"chat"};
const AC_CSS=`<style id="ac-css">
.ac-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
.ac-stat{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:flex;gap:12px;align-items:center}
.ac-stat i{font-style:normal;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:22px;flex:none}
.ac-stat b{display:block;font-size:24px;line-height:1.1}.ac-stat span{color:var(--muted);font-size:12.5px}
.ac-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 12px}
.ac-chipb{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:5px 14px;font:inherit;font-size:13px;cursor:pointer;color:var(--ink)}
.ac-chipb.on{background:var(--pink-soft,#fde7ef);border-color:var(--pink,#e11d74);color:var(--pink,#e11d74);font-weight:700}
.ac-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.ac-pc{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px 14px 12px;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:6px;font:inherit;color:var(--ink);transition:transform .12s,box-shadow .12s}
.ac-pc:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(20,30,60,.14)}
.ac-pc .ph{display:flex;gap:12px;align-items:center}
.ac-photo{width:72px;height:72px;border-radius:50%;object-fit:cover;flex:none;border:3px solid var(--ac,#e2e8f0);background:#f1f5f9}
.ac-av{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;font-size:34px;flex:none;background:color-mix(in srgb,var(--ac) 16%,#fff);border:3px solid var(--ac)}
.ac-pc b{font-size:15px;line-height:1.2;display:block}
.ac-pc small{color:var(--muted);font-size:12px;line-height:1.3;display:block}
.ac-st{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 9px;background:#dcfce7;color:#15803d;width:max-content;margin-bottom:2px}
.ac-st:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.ac-st.busy{background:#ffedd5;color:#c2410c}.ac-st.off{background:#f1f5f9;color:#64748b}
.ac-mini{display:flex;gap:8px;margin-top:6px}
.ac-mini div{flex:1;background:var(--gray-soft);border-radius:10px;padding:6px 4px;text-align:center}
.ac-mini b{font-size:15px}.ac-mini span{font-size:10.5px;color:var(--muted)}
.ac-q{margin-top:4px;font-size:11.5px;color:var(--muted);border-top:1px dashed var(--line);padding-top:6px}
.ac-chat{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:14px;align-items:start}
.ac-stripwrap{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.ac-strip{display:flex;gap:10px;overflow-x:auto;scroll-behavior:smooth;padding:4px 2px 8px;flex:1;scrollbar-width:thin}
.ac-sc{flex:none;width:122px;border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:8px 6px 7px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;position:relative;font:inherit;color:var(--ink);text-align:center}
.ac-sc:hover{box-shadow:0 4px 12px rgba(20,30,60,.12)}
.ac-sc.on{border-color:var(--pink,#e11d74);background:var(--pink-soft,#fde7ef)}
.ac-sc .ac-photo,.ac-sc .ac-av{width:46px;height:46px;font-size:22px;border-width:2px}
.ac-sc b{font-size:12.5px;line-height:1.15;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ac-sc .ss{font-size:10.5px;font-weight:600;color:#15803d;display:flex;align-items:center;gap:4px}
.ac-sc .ss:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.ac-sc .ss.busy{color:#c2410c}.ac-sc .ss.off{color:#64748b}
.ac-sc .ac-n{position:absolute;top:5px;right:6px;background:var(--orange);color:#fff;border-radius:999px;font-size:10.5px;padding:0 6px}
/* Hàng chọn agent gọn một dòng (trong khung chat) để dành chỗ cho hội thoại */
.ac-stripwrap{margin-bottom:8px}.ac-strip{padding:2px 2px 4px;gap:8px}.ac-strip .ac-sc{flex-direction:row;width:auto;padding:4px 12px 4px 4px;gap:8px;border-radius:999px}.ac-strip .ac-sc .ac-photo,.ac-strip .ac-sc .ac-av{width:30px;height:30px;font-size:15px;border-width:2px}.ac-strip .ac-sc b{font-size:13px;max-width:120px}.ac-strip .ac-sc .ss{font-size:0;gap:0}.ac-strip .ac-sc .ss:before{width:8px;height:8px}.ac-strip .ac-sc .ac-n{top:-5px;right:-3px}.ac-strip .ac-sc.back{padding:4px 12px}
.ac-sc.back{width:74px;justify-content:center;font-weight:700;font-size:12.5px;color:var(--muted)}
.ac-arrow{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--surface);cursor:pointer;font-size:16px}
.ac-side{display:flex;flex-direction:column;gap:6px;max-height:78vh;overflow:auto}
.ac-sa{display:flex;gap:10px;align-items:center;border:1px solid transparent;background:transparent;border-radius:12px;padding:6px 8px;cursor:pointer;font:inherit;color:var(--ink);text-align:left;position:relative}
.ac-sa:hover{background:var(--gray-soft)}.ac-sa.on{background:var(--pink-soft,#fde7ef);border-color:var(--pink,#e11d74)}
.ac-sa .ac-photo,.ac-sa .ac-av{width:36px;height:36px;font-size:18px;border-width:2px}
.ac-sa b{font-size:13px;display:block;line-height:1.2}.ac-sa small{font-size:11px;color:var(--muted);display:block;line-height:1.2}
.ac-sa .ac-n{margin-left:auto;background:var(--orange);color:#fff;border-radius:999px;font-size:11px;padding:1px 7px}
.ac-box{background:var(--surface);border:1px solid var(--line);border-radius:16px;display:flex;flex-direction:column;min-height:420px}
.ac-head{padding:10px 16px;border-bottom:1px solid var(--line)}
.ac-prof{display:flex;gap:12px;align-items:center;margin-bottom:6px}
.ac-prof .ac-photo,.ac-prof .ac-av{width:46px;height:46px;font-size:22px;border-width:2px}
.ac-prof h2{margin:0;font-size:17px;display:inline-block;margin-right:8px}.ac-prof p{margin:2px 0 0;color:var(--muted);font-size:13px}
.ac-tabs{display:flex;gap:6px}
.ac-tabs button{border:0;background:transparent;font:inherit;font-weight:600;color:var(--muted);padding:8px 14px;cursor:pointer;border-bottom:3px solid transparent}
.ac-tabs button.on{color:var(--pink,#e11d74);border-bottom-color:var(--pink,#e11d74)}
.ac-msgs{padding:14px 16px;overflow-y:auto;flex:1 1 auto;min-height:160px;display:flex;flex-direction:column;gap:14px}.ac-right{max-height:var(--ach,none);overflow-y:auto}.ac-send,.ac-head{flex:none}
.ac-row2{display:flex;gap:10px;align-items:flex-end}
.ac-row2.u{flex-direction:row-reverse}
.ac-row2 .ac-photo,.ac-row2 .ac-av{width:34px;height:34px;font-size:16px;border-width:2px}
.ac-me{width:34px;height:34px;border-radius:50%;background:var(--pink,#e11d74);color:#fff;display:grid;place-items:center;font-weight:700;flex:none}
.ac-m{max-width:78%;padding:9px 13px;border-radius:14px;white-space:pre-wrap;word-break:break-word;line-height:1.5;font-size:14px}
.ac-tb{border-collapse:collapse;margin:6px 0;white-space:normal;font-size:13px;display:table}.ac-tb th,.ac-tb td{border:1px solid var(--line);padding:4px 10px;text-align:left}.ac-tb th{background:rgba(0,0,0,.06)}.ac-tb td.n,.ac-tb th.n{text-align:right}
.ac-m .nm{display:block;font-size:12px;font-weight:700;margin-bottom:2px}
.ac-m small{display:block;color:var(--muted);font-size:11.5px;margin-top:4px}
.ac-imgs{display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-top:8px;max-width:440px}.ac-imgs a{display:block;min-width:0}.ac-imgs .ac-img{margin:0;width:100%;max-height:none;height:170px;object-fit:cover}.ac-imgs.n1{grid-template-columns:1fr;max-width:360px}.ac-imgs.n1 .ac-img{height:auto;max-height:360px;object-fit:contain}.ac-imgs.n3 a:first-child{grid-column:1/-1}.ac-imgs.n3 a:first-child .ac-img{height:220px}
.ac-img{display:block;max-width:100%;max-height:360px;margin-top:8px;border-radius:12px;border:1px solid var(--line)}
.ac-m.u{background:var(--pink-soft,#fde7ef)}
.ac-m.a{background:var(--gray-soft)}
.ac-m{position:relative;user-select:text}
.ac-act{display:flex;gap:10px;margin-top:4px;opacity:0;transition:opacity .15s}
.ac-m:hover .ac-act,.ac-m:focus-within .ac-act{opacity:1}
@media(hover:none){.ac-act{opacity:1}}
.ac-act button{border:0;background:transparent;color:var(--muted);font:inherit;font-size:12px;cursor:pointer;padding:0}
.ac-act button:hover{color:var(--pink,#e11d74);text-decoration:underline}
.ac-qt{border-left:3px solid var(--pink,#e11d74);background:rgba(0,0,0,.05);padding:4px 8px;margin-bottom:6px;border-radius:6px;font-size:12.5px;color:var(--muted);white-space:pre-wrap;max-height:84px;overflow:hidden}
.ac-quote{display:flex;gap:8px;align-items:flex-start;border-left:3px solid var(--pink,#e11d74);background:var(--pink-soft,#fde7ef);padding:6px 10px;border-radius:8px;font-size:12.5px}
.ac-quote span{flex:1;white-space:pre-wrap;max-height:60px;overflow:hidden}
.ac-quote button{border:0;background:transparent;cursor:pointer;font-size:16px;line-height:1}
.ac-m.s{background:var(--red-soft);color:var(--red);font-size:13px;align-self:center}
.ac-send{border-top:1px solid var(--line);padding:8px 12px;display:flex;flex-direction:column;gap:6px}.ac-bar{display:flex;align-items:flex-end;gap:8px}.ac-bar .btn{height:38px;padding:0 16px}.ac-bar .ac-clip{height:38px;width:38px;padding:0;flex:none}.ac-opt{position:relative;flex:none}.ac-optp{position:absolute;right:0;bottom:46px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px;box-shadow:0 8px 24px rgba(20,30,60,.16);display:flex;flex-direction:column;gap:8px;white-space:nowrap;font-size:13px;z-index:5}.ac-optp[hidden]{display:none}
.ac-pend{display:flex;gap:8px;flex-wrap:wrap}
.ac-pend .pi{position:relative}.ac-doc{display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--line);border-radius:10px;background:var(--surface);font-size:12px;max-width:260px}.ac-doc b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px}.ac-doc .px{position:static;width:18px;height:18px;line-height:18px}.ac-doc.err{border-color:#dc2626;color:#dc2626}.ac-dl{display:inline-block;margin-top:8px;padding:6px 10px;border:1px solid var(--line);border-radius:10px;font-size:12px;text-decoration:none;color:inherit;background:var(--surface)}
.ac-pend img{width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--line)}
.ac-pend .px{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:0;background:#111827;color:#fff;cursor:pointer;font-size:12px;line-height:20px;padding:0}
.ac-clip{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:6px 10px;cursor:pointer;font-size:16px}
.ac-send textarea{flex:1;min-width:0;box-sizing:border-box;min-height:38px;max-height:130px;resize:none;font-size:14px;line-height:20px;border:1px solid var(--line);border-radius:12px;padding:8px 10px;font:inherit}
.ac-row input[type=checkbox]{width:auto;min-width:0;margin:0 6px 0 0;vertical-align:middle}.ac-row label{display:inline-flex;align-items:center;cursor:pointer}
.ac-row{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
.ac-right .card{margin-bottom:12px}
.ac-thumbs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ac-thumbs img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;border:1px solid var(--line)}
.ac-links a{display:block;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 0}
.ac-perm{font-size:12.5px;line-height:1.5}
.ac-pf{display:flex;gap:10px;align-items:center;margin-bottom:8px}
.ac-pf .ac-photo,.ac-pf .ac-av{width:52px;height:52px;font-size:24px;border-width:2px}
.ac-pf b{display:block;font-size:14px}.ac-pf small{color:var(--muted);font-size:12px}
.ac-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:12.5px}
.ac-kv span{color:var(--muted)}.ac-kv b{font-weight:600;text-align:right}
@media(max-width:1100px){.ac-chat{grid-template-columns:minmax(0,1fr)}.ac-side{flex-direction:row;max-height:none}.ac-right{display:none}.ac-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ac-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.ac-grid{grid-template-columns:1fr}}
</style>`;
/* Agent trả lời kiểu markdown (**đậm**, gạch đầu dòng): đổi sang chữ đậm và dấu chấm, không hiện ký tự thô. */
const acLink=h=>h.replace(/(https?:\/\/[^\s<)]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
/* Bảng markdown (| a | b |) đổi thành bảng thật */
const acTb=h=>{const L=h.split("\n"),o=[],isR=r=>/^\s*\|.*\|\s*$/.test(r);
  for(let i=0;i<L.length;){
    if(isR(L[i])){let j=i;while(j<L.length&&isR(L[j]))j++;
      const all=L.slice(i,j),rows=all.filter(r=>!/^\s*\|[\s:|-]+\|\s*$/.test(r)),head=all.length>rows.length;
      const cells=r=>r.trim().replace(/^\||\|$/g,"").split("|").map(c=>c.trim());
      o.push('<table class="ac-tb">'+rows.map((r,k)=>{const tg=head&&k===0?"th":"td";return "<tr>"+cells(r).map(c=>"<"+tg+(/^[\d.,%\s]+$|^<b>[\d.,%\s]+<\/b>$/.test(c)?' class="n"':"")+">"+c+"</"+tg+">").join("")+"</tr>"}).join("")+"</table>");i=j;
    }else{o.push(L[i]);i++}
  }return o.join("\n")};
const acFmt=t=>acTb(acLink(esc(t)).replace(/\*\*([^*\n]+)\*\*/g,"<b>$1</b>")).replace(/`([^`\n]+)`/g,"<code>$1</code>").replace(/^(\s*)[-*] /gm,"$1• ").replace(/^#{1,6} +/gm,"");
const acHour=s=>{try{return new Date(s).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}catch(e){return ""}};
const acAgo=s=>{if(!s)return "chưa có";const d=(Date.now()-Date.parse(s))/1000;return d<90?"vừa xong":d<3600?Math.round(d/60)+" phút trước":d<86400?Math.round(d/3600)+" giờ trước":Math.round(d/86400)+" ngày trước"};
const acA=id=>(AC.agents||[]).find(x=>x.id===id);
/* Ảnh chân dung: dùng ảnh trong AC_AV nếu có, chưa có thì hiện biểu tượng */
const acAv=a=>{const col=esc((a&&a.color)||"#64748b");return typeof AC_AV!=="undefined"&&AC_AV[a.id]?`<img class="ac-photo" style="--ac:${col}" src="${AC_AV[a.id]}" alt="${esc(a.name)}">`:`<span class="ac-av" style="--ac:${col}">${(a&&a.emoji)||"🤖"}</span>`};
async function acLoadAgents(){
  try{const r=await svApi("/api/agent-chat/agents");AC.agents=r.agents;AC.relay=r.relay_online;AC.isCeo=!!r.is_ceo;AC.err=""}catch(e){AC.err=e.message;AC.agents=AC.agents||[]}
}
function acStatus(a){return !AC.relay?["off","Chưa nối"]:a.pending?["busy","Đang xử lý"]:["","Online"]}
function acRoot(){return $("#ac-root")}
/* ----- Màn tổng: thẻ nhân sự ----- */
function acGrid(){
  const R=acRoot();if(!R)return;const L=AC.agents||[];
  const tot=L.length,on=AC.relay?tot:0,today=L.reduce((s,a)=>s+(a.today||0),0),pend=L.reduce((s,a)=>s+(a.pending||0),0);
  const show=L.filter(a=>AC.filter==="all"||(AC.filter==="busy"&&a.pending>0));
  R.innerHTML=`<div class="ac-stats">
   <div class="ac-stat"><i style="background:#dcfce7">👥</i><div><b>${tot}</b><span>Tổng số agent</span></div></div>
   <div class="ac-stat"><i style="background:#dbeafe">🟢</i><div><b>${on}</b><span>${AC.relay?"Đang online (cầu nối VPS chạy)":"Cầu nối VPS chưa chạy"}</span></div></div>
   <div class="ac-stat"><i style="background:#fde7ef">💬</i><div><b>${today}</b><span>Tin nhắn hôm nay</span></div></div>
   <div class="ac-stat"><i style="background:#ffedd5">⏳</i><div><b>${pend}</b><span>Đang xử lý</span></div></div></div>
   <div class="ac-bar"><b style="margin-right:6px">Danh sách ${tot} agent</b><button class="ac-chipb${AC.filter==="all"?" on":""}" data-f="all">Tất cả (${tot})</button><button class="ac-chipb${AC.filter==="busy"?" on":""}" data-f="busy">Đang xử lý (${L.filter(a=>a.pending>0).length})</button></div>
   <div class="ac-grid">${(show.length?show:[]).map(a=>{const[s,t]=acStatus(a);return `<button class="ac-pc" data-ac="${esc(a.id)}" style="--ac:${esc(a.color||"#64748b")}"><div class="ph">${acAv(a)}<div><span class="ac-st ${s}">${t}</span><b>${esc(a.name)}</b><small>${esc(a.title||"")}</small></div></div>
     <div class="ac-mini"><div><b>${a.today||0}</b><span>Tin hôm nay</span></div><div><b>${a.pending||0}</b><span>Đang chờ</span></div><div><b style="font-size:12px;line-height:20px">${acAgo(a.last_at)}</b><span>Hoạt động</span></div></div>
     <div class="ac-q">Được đọc: ${esc(a.quyen||"")}</div></button>`}).join("")||'<div class="hint">Bạn chưa được cấp quyền nhắn agent nào. Nhờ chị Hoa cấp quyền nhé.</div>'}</div><div id="ac-access"></div>`;
  if(AC.isCeo)acAccess();
  R.querySelectorAll("[data-ac]").forEach(b=>b.onclick=()=>acPick(b.dataset.ac));
  R.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{AC.filter=b.dataset.f;acGrid()});
}
/* ----- Màn nhắn tin ----- */
function acChat(){
  const R=acRoot(),a=acA(AC.cur);if(!R||!a)return;
  R.innerHTML=`<div class="ac-stripwrap"><div class="ac-strip" id="ac-strip"><button class="ac-sc back" id="ac-back">← Tất cả</button>${(AC.agents||[]).map(x=>{const[sc,st]=acStatus(x);return `<button class="ac-sc${x.id===a.id?" on":""}" data-ac="${esc(x.id)}" style="--ac:${esc(x.color||"#64748b")}">${acAv(x)}<b>${esc(x.name)}</b><span class="ss ${sc}">${st==="Online"?"Đang hoạt động":st}</span>${x.pending?`<span class="ac-n">${x.pending}</span>`:""}</button>`}).join("")}</div><button class="ac-arrow" id="ac-next" title="Xem thêm">›</button></div>
   <div class="ac-chat">
   <div class="ac-box" style="--ac:${esc(a.color||"#64748b")}"><div class="ac-head"><div class="ac-prof">${acAv(a)}<div><h2>${esc(a.name)}</h2><span class="ac-st ${acStatus(a)[0]}">${acStatus(a)[1]}</span><p>${esc(a.title||"")}</p></div></div>
    </div>
    <div class="ac-msgs" id="ac-msgs"></div>
    <div class="ac-send" id="ac-send"><div id="ac-quote"></div><div class="ac-pend" id="ac-pend"></div>
    <div class="ac-bar"><button class="ac-clip" id="ac-clip" title="Đính kèm ảnh, Excel, PDF, Word, video (tối đa 25 MB mỗi file)">📎</button><textarea id="ac-text" rows="1" placeholder="Nhắn cho ${esc(a.name)}…  (/stop dừng việc đang làm · /new phiên mới)"></textarea><span class="ac-opt"><button class="ac-clip" id="ac-more" title="Tùy chọn gửi">⋯</button><div class="ac-optp" id="ac-optp" hidden>${AC.cur==="lead-sale-ailla"?'<label title="Tin chị gõ được xử lý như khách nhắn vào page: agent chỉ chọn câu mẫu kịch bản Pancake V5, không tự viết"><input type="checkbox" id="ac-kh"> Thử như khách (kịch bản V5)</label>':""}${AC.isCeo?'<label><input type="checkbox" id="ac-tg"> Gửi cả bản trả lời sang Telegram</label>':""}</div></span><button class="btn pri" id="ac-go">Gửi</button></div><input type="file" id="ac-file" accept="image/*,.xlsx,.xls,.csv,.pdf,.docx,.doc,.pptx,.txt,.md,.json,.mp4,.mov,.webm,.mp3,.wav,.m4a" multiple hidden></div></div>
   <div class="ac-right" id="ac-right"></div></div>`;
  R.querySelectorAll("[data-ac]").forEach(b=>b.onclick=()=>acPick(b.dataset.ac));
  {const sc=$("#ac-strip"),on=sc&&sc.querySelector(".ac-sc.on");if(on&&sc)sc.scrollLeft=Math.max(0,on.offsetLeft-sc.offsetLeft-120);const nx=$("#ac-next");if(nx&&sc)nx.onclick=()=>{sc.scrollLeft+=330}}
  $("#ac-back").onclick=()=>{const ta=$("#ac-text");if(ta&&AC.cur)AC.drafts[AC.cur]=ta.value;AC.cur="";try{localStorage.removeItem("ac_cur")}catch(e){}acGrid()};
  R.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{AC.tab=b.dataset.tab;acChat();acDrawMsgs(true);acDrawRight()});
  if($("#ac-kh")){let v="0";try{v=localStorage.getItem("ac_kh")||"0"}catch(e){}$("#ac-kh").checked=v==="1"}
  if($("#ac-tg")){if(AC.tg===null)AC.tg=true;$("#ac-tg").checked=AC.tg;$("#ac-tg").onchange=()=>{AC.tg=$("#ac-tg").checked}} /* mặc định tích: trả lời luôn hiện ở cả web lẫn Telegram, chị bỏ tích thì nhớ lựa chọn đó */$("#ac-go").onclick=acSend;
  $("#ac-text").value=AC.drafts[AC.cur]||"";setTimeout(()=>{const t=$("#ac-text");if(t&&t._grow)t._grow()},0);
  acDrawPend();acDrawQuote();
  $("#ac-text").onpaste=e=>{const fs=[...(e.clipboardData&&e.clipboardData.files||[])];if(fs.length){e.preventDefault();acAddFiles(fs)}};
  $("#ac-text").ondragover=e=>e.preventDefault();
  $("#ac-text").ondrop=e=>{const fs=[...(e.dataTransfer&&e.dataTransfer.files||[])];if(fs.length){e.preventDefault();acAddFiles(fs)}};
  $("#ac-clip").onclick=()=>$("#ac-file").click();
  $("#ac-more").onclick=e=>{e.stopPropagation();$("#ac-optp").hidden=!$("#ac-optp").hidden};
  document.addEventListener("click",e=>{const o=$("#ac-optp");if(o&&!o.hidden&&!e.target.closest(".ac-opt"))o.hidden=true});
  {const ta=$("#ac-text"),grow=()=>{ta.style.height="auto";ta.style.height=Math.min(130,ta.scrollHeight)+"px"};ta.addEventListener("input",grow);ta._grow=grow}
  $("#ac-file").onchange=e=>{acAddFiles(e.target.files);e.target.value=""};
  $("#ac-text").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();acSend()}};
  acFit();acDrawMsgs(true);acDrawRight();
}
/* Khung chat vừa đúng một màn hình: tên bot ở trên, tin cuộn ở giữa, ô gõ và nút Gửi luôn nằm dưới, không phải cuộn cả trang */
function acFit(){
  const b=$(".ac-box"),c=$(".ac-chat");if(!b||!c)return;
  const h=Math.max(420,Math.round(window.innerHeight-b.getBoundingClientRect().top-16));
  b.style.height=h+"px";c.style.setProperty("--ach",h+"px");
}
window.addEventListener("resize",()=>{if(PAGE==="agentchat")acFit()});
function acDrawRight(){
  const r=$("#ac-right"),a=acA(AC.cur);if(!r||!a)return;
  const links=[...new Set(AC.msgs.flatMap(m=>(m.body.match(/https?:\/\/[^\s<)]+/g)||[])))].slice(-12).reverse();
  r.innerHTML=`<section class="card" style="--ac:${esc(a.color||"#64748b")}"><div class="ac-pf">${acAv(a)}<div><b>${esc(a.name)}</b><small>${esc(a.title||"")}</small></div></div>
   <div class="ac-kv"><span>Được đọc</span><b>${esc(a.quyen||"")}</b><span>Tin hôm nay</span><b>${a.today||0}</b><span>Đang chờ</span><b>${a.pending||0}</b><span>Hoạt động</span><b>${acAgo(a.last_at)}</b></div></section>
   <section class="card"><div class="card-h"><h2>Ảnh (${AC.files.length})</h2></div>${AC.files.length?`<div class="ac-thumbs">${AC.files.slice(0,9).map(f=>`<a href="/api/agent-chat/file/${f.id}" target="_blank" rel="noopener"><img src="/api/agent-chat/file/${f.id}" alt="${esc(f.name)}" loading="lazy"></a>`).join("")}</div>`:'<div class="hint">Chưa có ảnh.</div>'}</section>
   <section class="card"><div class="card-h"><h2>Link (${links.length})</h2></div><div class="ac-links">${links.map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join("")||'<div class="hint">Chưa có link.</div>'}</div></section>`;
}
function acDrawMsgs(stick){
  const box=$("#ac-msgs"),a=acA(AC.cur);if(!box||!a)return;
  // Không vẽ lại khi chưa có gì mới hoặc chị đang bôi đen chữ, nếu không vùng chọn bị mất.
  const sel=window.getSelection&&window.getSelection(),selOn=sel&&!sel.isCollapsed&&box.contains(sel.anchorNode);
  const sig=AC.cur+"|"+AC.tab+"|"+AC.msgs.map(m=>m.id+":"+m.status+":"+(m.body||"").length+":"+(m.files||[]).length).join(",");
  if(!stick&&(selOn||sig===AC.sig))return;
  AC.sig=sig;
  const near=box.scrollHeight-box.scrollTop-box.clientHeight<60;
  let L=[...AC.msgs].sort((x,y)=>String(x.created_at).localeCompare(String(y.created_at))||x.id-y.id); // tin chép từ Telegram về sau vẫn xếp đúng giờ
  if(AC.tab==="files")L=L.filter(m=>(m.files||[]).length||/https?:\/\//.test(m.body));
  AC.shown=L;
  box.innerHTML=L.length?L.map((m,i)=>{
    const u=m.role==="USER",k=u?"u":m.role==="AGENT"?"a":"s";
    const kh0=u&&(m.body||"").startsWith("[KHÁCH] "),b0=kh0?m.body.slice(8):m.body;
    const qm=u&&/^↩ «([\s\S]*?)»\n/.exec(b0||""),qhtml=qm?`<div class="ac-qt">${esc(qm[1])}</div>`:"",mbody=qm?b0.slice(qm[0].length):b0;
    const act=m.role==="SYSTEM"?"":`<span class="ac-act"><button data-cp="${i}" title="Bôi đen một đoạn rồi bấm để chỉ copy đoạn đó">Copy</button><button data-rp="${i}" title="Bôi đen một đoạn rồi bấm để chỉ trả lời đoạn đó">Trả lời</button></span>`;
    const st=u?(m.status==="queued"?" · đang chờ":m.status==="taken"?" · agent đang làm…":m.status==="error"?" · lỗi":""):"";
    const who=u?`<span class="ac-me">${esc(((ME&&ME.name)||"H").trim().split(/\s+/).pop().slice(0,1).toUpperCase())}</span>`:m.role==="AGENT"?acAv(a):"";
    return `<div class="ac-row2 ${u?"u":""}" style="--ac:${esc(a.color||"#64748b")}">${who}<div class="ac-m ${k}"><span class="nm">${u?esc((ME&&ME.name)||"Chị Hoa"):m.role==="AGENT"?esc(a.name):"Hệ thống"}</span>${qhtml}${m.role==="AGENT"?acFmt(m.body):esc(mbody)}${(m.files||[]).length?`<div class="ac-imgs n${Math.min((m.files||[]).length,4)}">${(m.files||[]).map(f=>`<a href="/api/agent-chat/file/${f.id}" target="_blank" rel="noopener"><img class="ac-img" src="/api/agent-chat/file/${f.id}" alt="${esc(f.name)}" loading="lazy"></a>`).join("")}</div>`:""}${(m.docs||[]).map(d=>`<a class="ac-dl" href="/api/agent-chat/doc/${d.id}" download>📄 ${esc(d.name)} · ${d.size>1048576?(d.size/1048576).toFixed(1)+" MB":Math.max(1,Math.round(d.size/1024))+" KB"}</a>`).join("")}<small>${acHour(m.created_at)}${st}${u&&m.tg?" · gửi cả Telegram":""}${m.source==="TELEGRAM"?" · từ Telegram":""}</small>${act}</div></div>`}).join(""):`<div class="hint">${AC.tab==="files"?"Chưa có ảnh hay link nào.":"Chưa có tin nào. Gõ bên dưới để nhắn agent."}</div>`;
  box.querySelectorAll("[data-cp],[data-rp]").forEach(b=>b.onmousedown=e=>e.preventDefault()); // bấm nút không làm mất vùng bôi đen
  box.querySelectorAll("[data-cp]").forEach(b=>b.onclick=()=>acCopy(AC.shown[+b.dataset.cp],b));
  box.querySelectorAll("[data-rp]").forEach(b=>b.onclick=()=>acReply(AC.shown[+b.dataset.rp],b));
  if(stick||near)box.scrollTop=box.scrollHeight;
}
/* Copy một tin; Trả lời = trích tin đó gửi kèm để agent biết chị đang nói về tin nào */
/* Nếu chị đang bôi đen chữ trong đúng tin này thì lấy phần bôi đen, không thì lấy cả tin */
function acSel(btn){
  const s=window.getSelection&&window.getSelection();if(!s||s.isCollapsed||!btn)return "";
  const bub=btn.closest(".ac-m");return bub&&bub.contains(s.anchorNode)&&bub.contains(s.focusNode)?s.toString().trim():"";
}
function acPlain(m){let b=m.body||"";if(b.startsWith("[KHÁCH] "))b=b.slice(8);const q=/^↩ «[\s\S]*?»\n/.exec(b);return q?b.slice(q[0].length):b}
async function acCopy(m,btn){
  const t=acSel(btn)||acPlain(m);let ok=false;
  try{await navigator.clipboard.writeText(t);ok=true}catch(e){try{const x=document.createElement("textarea");x.value=t;x.style.position="fixed";x.style.opacity="0";document.body.appendChild(x);x.select();ok=document.execCommand("copy");x.remove()}catch(e2){}}
  if(btn){const o=btn.textContent;btn.textContent=ok?"Đã copy ✓":"Không copy được";setTimeout(()=>{btn.textContent=o},1400)}
}
function acReply(m,btn){
  const t=(acSel(btn)||acPlain(m)).replace(/\s+/g," ").trim();
  AC.quote={who:m.role==="AGENT"?(acA(AC.cur)||{}).name||"Agent":"Chị",text:t.length>240?t.slice(0,240)+"…":t};
  acDrawQuote();const ta=$("#ac-text");if(ta)ta.focus();
}
function acDrawQuote(){
  const b=$("#ac-quote");if(!b)return;
  b.innerHTML=AC.quote?`<div class="ac-quote"><span><b>Trả lời ${esc(AC.quote.who)}:</b> ${esc(AC.quote.text)}</span><button id="ac-qx" title="Bỏ trích dẫn">×</button></div>`:"";
  if($("#ac-qx"))$("#ac-qx").onclick=()=>{AC.quote=null;acDrawQuote()};
}
async function acPick(id){
  const ta=$("#ac-text");if(ta&&AC.cur)AC.drafts[AC.cur]=ta.value;
  AC.cur=id;try{localStorage.setItem("ac_cur",id)}catch(e){}AC.msgs=[];AC.files=[];AC.last=0;AC.tab="chat";acChat();
  await acPoll(true);acLoadFiles();
}
async function acLoadFiles(){const cur=AC.cur;if(!cur)return;try{const f=await svApi("/api/agent-chat/files?agent="+encodeURIComponent(cur));if(cur===AC.cur){AC.files=f;acDrawRight()}}catch(e){}}
async function acPoll(first){
  if(!AC.cur||AC.busy)return;AC.busy=true;const cur=AC.cur;
  try{
    const r=await svApi("/api/agent-chat?agent="+encodeURIComponent(cur)+(first?"":"&after="+AC.last));
    if(cur!==AC.cur)return;
    if(first)AC.msgs=r;else AC.msgs=AC.msgs.concat(r);
    if(r.length)AC.last=Math.max(AC.last,r[r.length-1].id);
    // trạng thái các tin chị đã gửi (chờ → đang làm → xong) đổi theo thời gian
    const s=await svApi("/api/agent-chat/status?agent="+encodeURIComponent(cur));
    const m=new Map(s.map(x=>[x.id,x.status]));AC.msgs.forEach(x=>{if(x.role==="USER"&&m.has(x.id))x.status=m.get(x.id)});
    acDrawMsgs(first);
    if(r.some(x=>(x.files||[]).length))acLoadFiles();else if(r.length)acDrawRight();
  }catch(e){}finally{AC.busy=false}
}
/* Ảnh chị dán / kéo thả / đính kèm: nén về tối đa 1600px, JPEG, không quá khoảng 1,4 MB rồi gửi kèm tin */
async function acCompress(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("Không đọc được ảnh"));i.src=url});
    const k=Math.min(1,1600/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*k)),h=Math.max(1,Math.round(img.height*k));
    const cv=document.createElement("canvas");cv.width=w;cv.height=h;const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,w,h);cx.drawImage(img,0,0,w,h);
    let q=.88,d=cv.toDataURL("image/jpeg",q);
    while(d.length>1900000&&q>.4){q-=.12;d=cv.toDataURL("image/jpeg",q)}
    if(d.length>1950000)throw new Error("Ảnh quá nặng, chị chọn ảnh nhỏ hơn");
    return {name:(file.name||"anh").replace(/\.[^.]+$/,"")+".jpg",mime:"image/jpeg",b64:d.split(",")[1],url:d};
  }finally{URL.revokeObjectURL(url)}
}
async function acAddFiles(list){
  for(const f of [...list]){
    if(/^image\//.test(f.type)){
      if(AC.pend.length>=6){toast("Mỗi lần gửi tối đa 6 ảnh");continue}
      try{AC.pend.push(await acCompress(f))}catch(e){toast(e.message)}
    }else{
      if(AC.docs.length>=3){toast("Mỗi lần gửi tối đa 3 file");break}
      if(f.size>25*1048576){toast("«"+f.name+"» nặng quá 25 MB");continue}
      acUpload(f);
    }
  }
  acDrawPend();
}
function acB64(u8){let s="";for(let i=0;i<u8.length;i+=32768)s+=String.fromCharCode.apply(null,u8.subarray(i,i+32768));return btoa(s)}
async function acUpload(file){
  const d={name:file.name,size:file.size,id:0,done:0,total:1,ok:false,err:""};AC.docs.push(d);acDrawPend();
  try{
    const r=await svApi("/api/agent-chat/doc",{method:"POST",body:JSON.stringify({name:file.name,size:file.size})});
    d.id=r.id;d.total=r.nparts;
    for(let i=0;i<r.nparts;i++){
      const u8=new Uint8Array(await file.slice(i*r.part_bytes,(i+1)*r.part_bytes).arrayBuffer());
      for(let t=0;;t++){try{await svApi("/api/agent-chat/doc/"+r.id+"/"+i,{method:"PUT",body:JSON.stringify({b64:acB64(u8)})});break}catch(e){if(t>=2)throw e}}
      d.done=i+1;acDrawPend();
    }
    d.ok=true;
  }catch(e){d.err=e.message}
  acDrawPend();
}
function acDrawPend(){
  const b=$("#ac-pend");if(!b)return;
  b.innerHTML=AC.pend.map((f,i)=>`<span class="pi"><img src="${f.url}" alt=""><button class="px" data-px="${i}" title="Bỏ ảnh">×</button></span>`).join("")+AC.docs.map((d,i)=>`<span class="ac-doc${d.err?" err":""}">📄 <b title="${esc(d.name)}">${esc(d.name)}</b><span>${d.err?esc(d.err):d.ok?"sẵn sàng":"đang tải "+Math.round(100*d.done/d.total)+"%"}</span><button class="px" data-pd="${i}" title="Bỏ file">×</button></span>`).join("");
  b.querySelectorAll("[data-px]").forEach(x=>x.onclick=()=>{AC.pend.splice(+x.dataset.px,1);acDrawPend()});
  b.querySelectorAll("[data-pd]").forEach(x=>x.onclick=()=>{AC.docs.splice(+x.dataset.pd,1);acDrawPend()});
}
async function acSend(){
  const ta=$("#ac-text"),t0=ta.value.trim();if((!t0&&!AC.pend.length&&!AC.docs.length)||!AC.cur)return;
  if(AC.docs.some(d=>!d.ok&&!d.err)){toast("File đang tải lên, chị đợi một chút rồi gửi");return}
  if(AC.docs.some(d=>d.err)){toast("Có file chưa tải được, chị bỏ file đó (dấu ×) rồi gửi lại");return}
  const t1=AC.quote?"↩ «"+AC.quote.text.replace(/[«»]/g,"")+"»\n"+(t0||"(trả lời tin trên)"):t0;
  const kh=$("#ac-kh")&&$("#ac-kh").checked;try{localStorage.setItem("ac_kh",kh?"1":"0")}catch(e){}
  const t=kh?"[KHÁCH] "+t1:t1;
  const btn=$("#ac-go");btn.disabled=true;
  try{await svApi("/api/agent-chat",{method:"POST",body:JSON.stringify({agent:AC.cur,body:t,tg:$("#ac-tg")?$("#ac-tg").checked:false,files:AC.pend.map(f=>({name:f.name,mime:f.mime,b64:f.b64})),docs:AC.docs.map(d=>d.id)})});AC.pend=[];AC.docs=[];acDrawPend();
    ta.value="";ta.style.height="auto";AC.quote=null;acDrawQuote();AC.drafts[AC.cur]="";AC.tg=$("#ac-tg")?$("#ac-tg").checked:false;await acPoll(false);acDrawMsgs(true)}
  catch(e){toast("Chưa gửi được: "+e.message)}finally{btn.disabled=false;ta.focus()}
}
/* Chị Hoa chọn ai được nhắn agent nào. Mỗi người chỉ thấy cuộc trò chuyện của chính mình. */
async function acAccess(){
  const box=$("#ac-access");if(!box)return;
  try{AC.access=await svApi("/api/agent-chat/access")}catch(e){return}
  const L=AC.agents||[];
  box.innerHTML=`<section class="card" style="margin-top:16px"><div class="card-h"><h2>Ai được nhắn agent nào</h2></div>
   <p class="hint">Mỗi nhân sự chỉ thấy cuộc trò chuyện của chính mình, và chỉ các agent chị tích ở đây. Chị Hoa luôn thấy tất cả.</p>
   ${(AC.access||[]).map(u=>`<div style="border-top:1px solid var(--line);padding:10px 0"><b>${esc(u.display_name)}</b> <span class="hint">(${u.role==="MANAGER"?"quản lý":"nhân viên"})</span>
    <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin:6px 0">${L.map(a=>`<label style="white-space:nowrap"><input type="checkbox" data-acu="${esc(u.id)}" value="${esc(a.id)}"${u.agents.includes(a.id)?" checked":""} style="width:auto;margin-right:5px">${esc(a.name)}</label>`).join("")}</div>
    <button class="btn sm" data-acs="${esc(u.id)}">Lưu quyền của ${esc(u.display_name)}</button></div>`).join("")||'<div class="hint">Chưa có nhân sự nào.</div>'}</section>`;
  box.querySelectorAll("[data-acs]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{const id=b.dataset.acs;const agents=[...box.querySelectorAll(`[data-acu="${id}"]`)].filter(x=>x.checked).map(x=>x.value);await svApi("/api/agent-chat/access/"+id,{method:"PUT",body:JSON.stringify({agents})});toast("Đã lưu quyền")}catch(e){toast("Chưa lưu được: "+e.message)}finally{b.disabled=false}});
}
PAGES.agentchat=m=>{
  if(!AC.restored){AC.restored=1;try{if(!AC.cur)AC.cur=localStorage.getItem("ac_cur")||""}catch(e){}} /* tải lại trang vẫn ở đúng cuộc trò chuyện đang mở */
  m.innerHTML=H("Điều hành agent","Mỗi agent là một nhân sự AI · nhắn thẳng trên web, vẫn nhắn được bằng Telegram như cũ")+AC_CSS+'<div id="ac-root"><div class="hint">Đang tải…</div></div>';
  if(AC.agents)(AC.cur&&acA(AC.cur)?acChat:acGrid)();
  acLoadAgents().then(()=>{if(PAGE!=="agentchat")return;if(AC.err)toast("Chưa tải được: "+AC.err);if(AC.cur&&!acA(AC.cur)){AC.cur="";try{localStorage.removeItem("ac_cur")}catch(e){}}if(AC.cur){acChat();acPoll(true);acLoadFiles()}else acGrid()});
};
/* Tự cập nhật: 4 giây/lần khi đang mở khung nhắn; màn tổng làm mới 15 giây/lần (không vẽ lại ô gõ nên không mất chữ đang gõ) */
setInterval(()=>{if(typeof ME==="undefined"||!ME||typeof PAGE==="undefined"||PAGE!=="agentchat")return;
  if(AC.cur&&document.getElementById("ac-msgs")){acPoll(false);if(Date.now()-(AC.at||0)>12000){AC.at=Date.now();acLoadAgents().then(()=>{const a=acA(AC.cur);const s=document.querySelector(".ac-prof .ac-st");if(s&&a){const[c,t]=acStatus(a);s.className="ac-st "+c;s.textContent=t}})}}
  else if(!AC.cur&&document.getElementById("ac-root")&&Date.now()-(AC.at||0)>15000){AC.at=Date.now();acLoadAgents().then(()=>{if(!AC.cur&&PAGE==="agentchat")acGrid()})}},4000);
{const s=MODULES.find(m=>m.k==="setup");if(s){const g0=s.groups;s.groups=()=>{const G=g0();const hs=G.find(g=>g[0]==="Hệ thống");if(hs)hs[1].push(MI("agentchat","Điều hành agent",u=>u.role==="admin"));return G}}}
/* Trang vận hành (vanhanh.ailla.vn): mục riêng ngay trên menu để dễ vào. Hiện chỉ chủ doanh nghiệp (vai trò Quản trị) thấy;
   mở cho nhân sự sau khi chốt ai được nhắn agent nào. */
{const i=MODULES.findIndex(m=>m.k==="cv");const mod={k:"agt",zone:"",ic:"spark",n:"Điều hành agent",sub:"",groups:()=>[["",[MI("agentchat","Điều hành agent",u=>u.role==="admin"||(typeof SV!=="undefined"&&SV.agentChat&&SV.agentChat.length>0))]]]};
 if(i>=0)MODULES.splice(i+1,0,mod);else MODULES.push(mod)}
