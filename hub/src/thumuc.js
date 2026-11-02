/* =====================================================================
   THƯ MỤC LÀM VIỆC (chị Hoa giao 02/11/2026): xem thư mục Google Drive của phòng ban ngay trên web.
   - Web CHỈ XEM: duyệt thư mục con, danh sách file (tên, loại, người sửa, lúc sửa), tìm theo tên, bấm "Mở" thì sang Drive.
     Không tải lên, không sửa, không xóa gì trên Drive.
   - Máy chủ /api/drive/* đọc Drive bằng tài khoản máy của web (chỉ thấy thư mục chị chia sẻ cho nó) và kiểm quyền:
     người trong phòng xem thư mục phòng mình; xem thêm theo cấu hình (cả phòng khác / trưởng nhóm, trưởng phòng); CEO thấy hết.
   - CEO gán thư mục cho từng phòng ở tab "Gán thư mục" (bên vận hành) hoặc Cấu hình › Thư mục Drive các phòng (bên quản trị).
   - Tài liệu chuẩn (quy trình, biểu mẫu) để ở Thư viện tài liệu của khu Đào tạo; trang này chỉ cho file làm hằng ngày.
   - Nhãn trên màn hình theo vai trò, không ghi tên người (chị Hoa 02/11).
   ===================================================================== */
const TM={teams:null,err:"",pb:"",folder:"",list:null,listKey:"",busy:false,q:"",kind:"",find:null,findKey:"",recent:{},view:"xem",cfg:null,cfgErr:"",saving:false,sync:null};
ICONS.folder='<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>';
const TM_KIND={sheet:["Bảng tính","XLS","grn"],doc:["Tài liệu","DOC","blu"],slide:["Trình chiếu","PPT","amb"],pdf:["PDF","PDF","gry"],vid:["Video","MP4","pnk"],img:["Ảnh","IMG","amb"],link:["Lối tắt","↗","gry"],other:["Khác","FILE","gry"]};
const tmOn=()=>typeof PAGE!=="undefined"&&(PAGE==="thumuc"||PAGE==="thumuc_gan");
const tmRedraw=()=>{if(tmOn())renderMain()};
const tmTime=s=>{if(!s)return "—";const d=new Date(Date.parse(s)+7*3600e3),p=n=>String(n).padStart(2,"0"),now=new Date(Date.now()+7*3600e3);
  return p(d.getUTCDate())+"/"+p(d.getUTCMonth()+1)+(d.getUTCFullYear()!==now.getUTCFullYear()?"/"+d.getUTCFullYear():"")+" "+p(d.getUTCHours())+":"+p(d.getUTCMinutes())};
const tmSize=n=>n==null?"":n>=1e9?(n/1e9).toFixed(1)+" GB":n>=1e6?(n/1e6).toFixed(1)+" MB":Math.max(1,Math.round(n/1e3))+" KB";

async function tmTeams(force){
  if(TM.busy&&!force)return;TM.busy=true;
  try{TM.teams=await svApi("/api/drive/teams");TM.err="";
    const T=TM.teams.teams;if(!T.some(t=>t.pb===TM.pb)){TM.pb=(T.find(t=>t.pb===TM.teams.my_pb)||T[0]||{}).pb||"";TM.folder="";TM.list=null}}
  catch(e){TM.err=e.message||"Không tải được"}
  TM.busy=false;tmRedraw();
}
async function tmLoadList(){
  const key=TM.pb+"|"+TM.folder;if(TM.listKey===key&&TM.list)return;TM.listKey=key;TM.list={loading:true};
  try{const r=await svApi("/api/drive/list?pb="+encodeURIComponent(TM.pb)+(TM.folder?"&folder="+encodeURIComponent(TM.folder):""));
    /* Mở thư mục của phòng khác nằm trong thư mục chung: máy chủ trả về đúng phòng của thư mục đó. */
    if(TM.listKey===key){if(r.pb&&r.pb!==TM.pb){TM.pb=r.pb;TM.listKey=r.pb+"|"+TM.folder}TM.list=r}}
  catch(e){if(TM.listKey===key)TM.list={err:e.message||"Không tải được thư mục"}}
  tmRedraw();
}
async function tmLoadRecent(pb){
  if(TM.recent[pb])return;TM.recent[pb]={loading:true};
  try{TM.recent[pb]=await svApi("/api/drive/find?pb="+encodeURIComponent(pb))}catch(e){TM.recent[pb]={err:e.message||"Không tải được"}}
  tmRedraw();
}
async function tmFind(){
  const key=TM.q;if(TM.findKey===key&&TM.find)return;TM.findKey=key;TM.find={loading:true};
  try{const r=await svApi("/api/drive/find?q="+encodeURIComponent(TM.q));if(TM.findKey===key)TM.find=r}
  catch(e){if(TM.findKey===key)TM.find={err:e.message||"Không tìm được"}}
  tmRedraw();
}

/* ---------- Giao diện kiểu Google Drive (chị Hoa 02/11): cột thư mục bên trái, ô tìm kiếm, xem dạng lưới (có ảnh thu nhỏ) hoặc danh sách ---------- */
const TM_COLOR={sheet:"#188038",doc:"#1a73e8",slide:"#f29900",pdf:"#d93025",vid:"#d93025",img:"#d93025",link:"#5f6368",other:"#5f6368"};
const TM_GLYPH={sheet:"▦",doc:"≡",slide:"▭",pdf:"P",vid:"▶",img:"◩",link:"↗",other:"•"};
const tmIc=(k,big)=>`<span class="gd-ic${big?" big":""}" style="background:${TM_COLOR[k]||TM_COLOR.other}" aria-hidden="true">${TM_GLYPH[k]||"•"}</span>`;
const tmFolderSvg=`<svg class="gd-fsvg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
TM.mode=(()=>{try{return localStorage.getItem("ailla_tm_mode")||"grid"}catch(e){return "grid"}})();
const tmWhere=f=>{const nm=TM.teams&&TM.q?((TM.teams.teams.find(t=>t.pb===f.pb)||{}).name||""):"";return [nm,f.where].filter(Boolean).join(" › ")};
/* Nút tải bản gốc (giữ nguyên độ phân giải); file Google Tài liệu / Trang tính không có nút này. */
const tmDl=f=>f.dl?`<a class="gd-dl" href="${esc(f.dl)}" download title="Tải về bản gốc${f.size?" ("+tmSize(f.size)+")":""}" aria-label="Tải ${esc(f.name)} về máy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg></a>`:"";
function tmFiles(files,showWhere){
  const L=files.filter(f=>!TM.kind||f.kind===TM.kind);
  if(!L.length)return `<p class="gd-empty">${files.length?"Không có file thuộc loại này.":"Thư mục này chưa có file."}</p>`;
  if(TM.mode==="list")return `<div class="gd-list" role="table"><div class="gd-lh" role="row"><span>Tên</span><span>Người sửa cuối</span><span>Ngày sửa đổi</span><span>Kích cỡ</span></div>${L.map(f=>
    `<div class="gd-lr" role="row"><a class="gd-open" href="${esc(f.link)}" target="_blank" rel="noopener" title="Mở trên Google Drive" aria-label="Mở ${esc(f.name)}"></a><span class="gd-ln">${tmIc(f.kind)}<span class="gd-nm"><b>${esc(f.name)}</b>${showWhere&&tmWhere(f)?`<small>${esc(tmWhere(f))}</small>`:""}</span></span><span class="gd-mu">${esc(f.by||"—")}</span><span class="gd-mu">${tmTime(f.modified)}</span><span class="gd-mu">${f.size?tmSize(f.size):"—"}${tmDl(f)}</span></div>`).join("")}</div>`;
  return `<div class="gd-grid">${L.map(f=>`<div class="gd-file" title="${esc(f.name)}${showWhere&&tmWhere(f)?" · "+esc(tmWhere(f)):""}"><a class="gd-open" href="${esc(f.link)}" target="_blank" rel="noopener" aria-label="Mở ${esc(f.name)} trên Google Drive"></a>${tmDl(f)}
    <div class="gd-fh">${tmIc(f.kind)}<b>${esc(f.name)}</b></div>
    <div class="gd-th">${tmIc(f.kind,true)}${f.thumb?`<img loading="lazy" alt="" src="${esc(f.thumb)}" onerror="this.remove()">`:""}</div>
    <div class="gd-ft">${esc(f.by||"")}${f.by?" · ":""}${tmTime(f.modified)}${f.size?" · "+tmSize(f.size):""}</div></div>`).join("")}</div>`;
}

function pThuMuc(m){
  const css=`<style>
  .gd{display:grid;grid-template-columns:230px minmax(0,1fr);gap:20px;align-items:start}
  .gd-side{display:flex;flex-direction:column;gap:2px;position:sticky;top:10px}
  .gd-side .gd-sh{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:4px 14px 6px}
  .gd-side button{display:flex;gap:12px;align-items:center;border:0;background:none;text-align:left;padding:8px 14px;border-radius:999px;cursor:pointer;font-size:14px;color:inherit;min-width:0}
  .gd-side button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .gd-side button:hover{background:var(--gray-soft)}.gd-side button.on{background:var(--blue-soft);color:var(--blue);font-weight:600}
  .gd-side .gd-fsvg{width:20px;height:20px;flex:none;color:var(--muted)}.gd-side button.on .gd-fsvg{color:var(--blue)}
  .gd-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
  .gd-search{flex:1 1 320px;display:flex;align-items:center;gap:10px;background:var(--gray-soft);border-radius:999px;padding:0 16px;max-width:720px}
  .gd-search input{border:0;background:transparent;padding:11px 0;outline:none;width:100%}.gd-search:focus-within{background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.25)}
  .gd-search svg{width:20px;height:20px;flex:none;color:var(--muted)}
  .gd-top select{width:auto;border-radius:8px}
  .gd-vt{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}.gd-vt button{border:0;background:none;padding:6px 14px;cursor:pointer;font-size:13px;color:inherit}.gd-vt button.on{background:var(--blue-soft);color:var(--blue);font-weight:600}
  .gd-cr{display:flex;align-items:center;gap:2px;flex-wrap:wrap;font-size:20px;margin:2px 0 14px}.gd-cr button{border:0;background:none;padding:4px 10px;border-radius:999px;cursor:pointer;font-size:20px;color:var(--muted)}.gd-cr button:hover{background:var(--gray-soft)}.gd-cr b{padding:4px 10px;font-weight:500}.gd-cr .s{color:var(--muted)}
  .gd-sec{font-size:14px;font-weight:600;margin:16px 0 10px}
  .gd-grid,.gd-fold{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
  .gd-fold button{display:flex;gap:12px;align-items:center;background:var(--gray-soft);border:0;border-radius:12px;padding:12px 14px;cursor:pointer;text-align:left;min-width:0;color:inherit}
  .gd-fold button:hover{filter:brightness(.96)}.gd-fold .gd-fsvg{width:22px;height:22px;flex:none;color:var(--muted)}.gd-fold b{font-weight:500;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .gd-file{position:relative;display:flex;flex-direction:column;background:var(--gray-soft);border-radius:12px;padding:6px 8px 8px;text-decoration:none;color:inherit;min-width:0}
  .gd-open{position:absolute;inset:0;z-index:1;border-radius:inherit}
  .gd-dl{position:absolute;z-index:2;top:8px;right:8px;width:32px;height:32px;border-radius:999px;background:var(--surface);color:var(--ink);display:grid;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.25);opacity:0;transition:opacity .15s}
  .gd-dl svg{width:18px;height:18px}.gd-file:hover .gd-dl,.gd-dl:focus-visible{opacity:1}
  @media(hover:none){.gd-dl{opacity:1}}
  .gd-lr{position:relative}.gd-lr .gd-dl{position:relative;top:auto;right:auto;display:inline-grid;width:28px;height:28px;margin-left:8px;vertical-align:middle;opacity:1;box-shadow:none;background:transparent}.gd-lr .gd-dl:hover{background:var(--gray-soft)}
  .gd-file:hover{filter:brightness(.96)}
  .gd-fh{display:flex;gap:10px;align-items:center;padding:6px 4px 8px;min-width:0}.gd-fh b{font-weight:500;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .gd-th{position:relative;aspect-ratio:4/3;max-width:100%;background:var(--surface);border-radius:8px;overflow:hidden;display:grid;place-items:center}
  .gd-th img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .gd-ft{font-size:12px;color:var(--muted);padding:8px 4px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .gd-ic{flex:none;width:20px;height:20px;border-radius:4px;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:700;line-height:1}
  .gd-ic.big{width:56px;height:56px;border-radius:10px;font-size:28px;opacity:.9}
  .gd-list{border-top:1px solid var(--line)}.gd-lh,.gd-lr{display:grid;grid-template-columns:minmax(0,1fr) 170px 130px 90px;gap:12px;align-items:center;padding:9px 12px;border-bottom:1px solid var(--line)}
  .gd-lh{font-size:13px;font-weight:600;color:var(--muted)}.gd-lr{text-decoration:none;color:inherit;font-size:14px}.gd-lr:hover{background:var(--gray-soft)}
  .gd-ln{display:flex;gap:12px;align-items:center;min-width:0}.gd-nm{display:flex;flex-direction:column;min-width:0}.gd-nm b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gd-nm small{color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .gd-mu{color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .gd-empty{color:var(--muted);padding:18px 4px}
  @media(max-width:860px){.gd{grid-template-columns:1fr}.gd-side{position:static;flex-direction:row;overflow-x:auto;gap:6px}.gd-side .gd-sh{display:none}.gd-side button{flex:none;background:var(--gray-soft)}
    .gd-lh,.gd-lr{grid-template-columns:minmax(0,1fr) 110px}.gd-lh span:nth-child(2),.gd-lh span:nth-child(4),.gd-lr>span:nth-child(2),.gd-lr>span:nth-child(4){display:none}.gd-grid,.gd-fold{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}}
  </style>`;
  const ceo=!!TM.teams&&TM.teams.can_manage;
  const tabs=ceo&&!(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin")?`<div class="filters"><button class="btn sm${TM.view==="xem"?" pri":""}" data-tmv="xem">Thư mục</button><button class="btn sm${TM.view==="gan"?" pri":""}" data-tmv="gan">Gán thư mục cho phòng ban</button></div>`:"";
  const head=H("Thư mục làm việc","File làm hằng ngày của các phòng, lấy thẳng từ Google Drive · bấm vào file để mở trên Drive");
  if(!TM.teams){m.innerHTML=head+(TM.err?`<div class="note red">${esc(TM.err)}</div>`:`<p class="hint">Đang tải…</p>`);if(!TM.busy)tmTeams();return}
  if(PAGE==="thumuc_gan"||TM.view==="gan"){m.innerHTML=css+head+tabs+tmCfgHtml();tmCfgBind(m);tmBindTabs(m);return}
  const T0=TM.teams.teams,T=TM.scope?T0.filter(t=>t.pb===TM.scope||/^chung/.test(t.pb)):T0;
  if(TM.scope&&T.length&&!T.some(t=>t.pb===TM.pb)){TM.pb=T[0].pb;TM.folder="";TM.list=null;TM.listKey=""}
  if(!TM.teams.connected){m.innerHTML=css+head+tabs+`<div class="note amb">Web chưa được nối với Google Drive.${ceo?" Chạy file NOI-GOOGLE-DRIVE.bat một lần (hướng dẫn ở tab Gán thư mục).":" Cần CEO nối Drive trước."}</div>`;tmBindTabs(m);return}
  if(!T.length){m.innerHTML=css+head+tabs+`<div class="card pad"><p>Phòng của bạn chưa được gán thư mục Drive.</p><p class="hint">${ceo?"Gán thư mục cho từng phòng ở tab Gán thư mục.":"Nhờ CEO gán thư mục Drive cho phòng mình."}</p></div>`;tmBindTabs(m);return}
  const sb=t=>`<button class="${t.pb===TM.pb&&!TM.q?"on":""}" data-tmpb="${esc(t.pb)}" title="${esc(t.name)}">${tmFolderSvg}<span>${esc(t.name)}</span></button>`;
  /* mở từ Công việc › Phòng ban (chị Hoa 02/11): thư mục phòng · tư liệu chung · thư mục dự án phòng tham gia */
  const PJ=TM.scope&&typeof kpbPrj==="function"?kpbPrj(kpbTeam(TM.scope)).filter(p=>p.drive):[];
  const side=TM.scope?`<nav class="gd-side" aria-label="Thư mục"><button class="gd-back" id="tm-back">‹ Về ${esc(typeof kpbName==="function"?kpbName(TM.scope):TM.scope)}</button><div class="gd-sh">Thư mục phòng</div>${T.filter(t=>t.pb===TM.scope).map(sb).join("")||`<small class="hint">Phòng chưa được gán thư mục</small>`}<div class="gd-sh">Tư liệu chung</div>${T.filter(t=>/^chung/.test(t.pb)).map(sb).join("")}<div class="gd-sh">Thư mục dự án</div>${PJ.map(p=>`<a class="gd-pj" href="${esc(p.drive)}" target="_blank" rel="noopener" title="Mở trên Google Drive">${tmFolderSvg}<span>${esc(p.ten)}</span></a>`).join("")||`<small class="hint">Chưa có dự án nào gắn thư mục</small>`}</nav>`
    :`<nav class="gd-side" aria-label="Thư mục"><div class="gd-sh">Thư mục của bạn</div>${T.map(sb).join("")}</nav>`;
  const kinds=`<select id="tm-kind" aria-label="Loại file"><option value="">Loại: tất cả</option>${Object.entries(TM_KIND).filter(([k])=>k!=="link"&&k!=="other").map(([k,x])=>`<option value="${k}"${TM.kind===k?" selected":""}>${x[0]}</option>`).join("")}</select>`;
  const top=`<div class="gd-top"><label class="gd-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICONS.search}</svg><input type="search" id="tm-q" placeholder="Tìm trong các thư mục bạn được xem" value="${esc(TM.q)}" aria-label="Tìm file"></label>${kinds}
    <span class="gd-vt" role="group" aria-label="Kiểu xem"><button data-tmmode="grid" class="${TM.mode==="grid"?"on":""}">▦ Lưới</button><button data-tmmode="list" class="${TM.mode==="list"?"on":""}">☰ Danh sách</button></span><button class="btn sm" id="tm-re">Tải lại</button></div>`;
  let body="";
  if(TM.q){
    if(!TM.find||TM.findKey!==TM.q)tmFind();
    const F=TM.find||{loading:true};
    body=`<div class="gd-cr"><b>Kết quả tìm “${esc(TM.q)}”</b></div>`+(F.loading?`<p class="gd-empty">Đang tìm…</p>`:F.err?`<div class="note red">${esc(F.err)}</div>`:tmFiles(F.files,true));
  }else{
    tmLoadList();
    const L=TM.list||{loading:true};
    if(L.loading)body=`<p class="gd-empty">Đang mở thư mục…</p>`;
    else if(L.err)body=`<div class="note red">${esc(L.err)}</div>`;
    else{
      const crumb=`<div class="gd-cr">${L.path.map((p,i)=>i===L.path.length-1?`<b>${esc(p.name)}</b>`:`<button data-tmf="${i?esc(p.id):""}">${esc(p.name)}</button><span class="s">›</span>`).join("")}</div>`;
      let recent="";
      if(!TM.folder){tmLoadRecent(TM.pb);const R=TM.recent[TM.pb]||{loading:true};
        if(R.files&&R.files.length){const keep=TM.mode;TM.mode="grid";recent=`<div class="gd-sec">Tệp được sửa gần đây</div>`+tmFiles(R.files.slice(0,4),true);TM.mode=keep}}
      body=crumb+recent+(L.folders.length?`<div class="gd-sec">Thư mục</div><div class="gd-fold">${L.folders.map(f=>`<button data-tmf="${esc(f.id)}" title="${esc(f.name)}">${tmFolderSvg}<b>${esc(f.name)}</b></button>`).join("")}</div>`:"")+
        `<div class="gd-sec">Tệp</div>`+tmFiles(L.files,false);
    }
  }
  m.innerHTML=css+head+tabs+`<div class="gd">${side}<div style="min-width:0">${top}${body}</div></div>`+`<p class="hint" style="margin-top:16px">Bấm vào file để mở trên Google Drive. Chưa mở được thì nhờ trưởng phòng kiểm tra email của bạn trong hồ sơ nhân viên. Tài liệu chuẩn (quy trình, biểu mẫu, hướng dẫn) xem ở Thư viện tài liệu trong khu Đào tạo.</p>`;
  tmBindTabs(m);{const bk=m.querySelector("#tm-back");if(bk)bk.onclick=()=>{TM.scope="";MOD="cv";PAGE="cv_pb";render()}}
  m.querySelectorAll("[data-tmpb]").forEach(b=>b.onclick=()=>{TM.pb=b.dataset.tmpb;TM.folder="";TM.q="";renderMain()});
  m.querySelectorAll("[data-tmf]").forEach(b=>b.onclick=()=>{TM.folder=b.dataset.tmf;renderMain();scrollTo(0,0)});
  m.querySelectorAll("[data-tmmode]").forEach(b=>b.onclick=()=>{TM.mode=b.dataset.tmmode;try{localStorage.setItem("ailla_tm_mode",TM.mode)}catch(e){}renderMain()});
  const q=$("#tm-q");if(q){let t=0;q.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{TM.q=q.value.trim();renderMain();const n=$("#tm-q");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},450)}}
  const k=$("#tm-kind");if(k)k.onchange=()=>{TM.kind=k.value;renderMain()};
  const re=$("#tm-re");if(re)re.onclick=()=>{TM.list=null;TM.listKey="";TM.find=null;TM.findKey="";TM.recent={};tmTeams(true)};
}
function tmBindTabs(m){m.querySelectorAll("[data-tmv]").forEach(b=>b.onclick=()=>{TM.view=b.dataset.tmv;renderMain()})}

/* ---------- Gán thư mục cho phòng ban (CEO) ---------- */
async function tmCfgLoad(){TM.cfg={loading:true};try{TM.cfg=await svApi("/api/drive/config");TM.cfgErr=""}catch(e){TM.cfg=null;TM.cfgErr=e.message||"Không tải được"}tmRedraw()}
function tmCfgHtml(){
  if(!TM.cfg){if(TM.cfgErr)return `<div class="note red">${esc(TM.cfgErr)}</div>`;tmCfgLoad();return `<p class="hint">Đang tải…</p>`}
  if(TM.cfg.loading)return `<p class="hint">Đang tải…</p>`;
  const C=TM.cfg,by=Object.fromEntries(C.teams.map(t=>[t.pb,t])),D_=C.depts;
  const guide=`<div class="card pad" style="margin-bottom:14px"><b>Cách nối thư mục của một phòng</b>
    ${C.connected?"":`<div class="note amb" style="margin-top:8px">Web chưa có tài khoản Google để đọc Drive. Làm theo file HUONG-DAN-NOI-GOOGLE-DRIVE rồi chạy NOI-GOOGLE-DRIVE.bat một lần.</div>`}
    <ol style="margin:8px 0 0 18px;padding:0;line-height:1.7"><li>Mở thư mục của phòng trên Google Drive → Chia sẻ → thêm ${C.sa_email?`<b style="word-break:break-all">${esc(C.sa_email)}</b> <button class="btn sm" id="tm-cp">Chép</button>`:"email tài khoản của web"} với quyền <b>Người xem</b>.</li>
    <li>Dán link thư mục vào dòng của phòng bên dưới, chọn ai được xem thêm, bấm Lưu. Cột Kết nối báo web đã thấy thư mục chưa.</li></ol>
    <p class="hint" style="margin:8px 0 0">Người trong phòng luôn xem được thư mục phòng mình; CEO xem được tất cả. Web chỉ xem, không sửa hay xóa file trên Drive.</p></div>`;
  const extra=(pb,t,all)=>{const v=new Set((t&&t.viewers)||[]);const opts=(all?[["all","Mọi người có tài khoản web"]]:[]).concat([["lead:*","Trưởng nhóm, trưởng phòng mọi phòng"]]).concat(D_.filter(d=>d.k!==pb).flatMap(d=>[["lead:"+d.k,"Trưởng nhóm / trưởng phòng "+d.n],["pb:"+d.k,"Cả phòng "+d.n]]));
    return `<details><summary class="hint" style="cursor:pointer">${v.size?esc(opts.filter(o=>v.has(o[0])).map(o=>o[1]).join(", ")):all?"Chưa chọn ai (chỉ CEO)":"Chỉ người trong phòng"}</summary><div style="display:grid;gap:4px;margin-top:6px">${opts.map(([k,n])=>`<label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" style="width:auto" data-tmvw="${esc(pb)}" value="${esc(k)}"${v.has(k)?" checked":""}> ${esc(n)}</label>`).join("")}</div></details>`};
  const rows=D_.map(d=>{const t=by[d.k];const st=!t?pill("Chưa gán","gry"):!C.connected?pill("Chờ nối Drive","amb"):t.ok?pill("Đã thấy: "+(t.folder_name||"thư mục"),"grn"):pill("Chưa chia sẻ cho web","amb");
    return `<tr><td><b>${esc(d.n)}</b></td><td style="min-width:240px"><input id="tm-f-${esc(d.k)}" data-tmfo="${esc(d.k)}" placeholder="Dán link thư mục Google Drive" value="${t?esc("https://drive.google.com/drive/folders/"+t.folderId):""}"></td><td style="min-width:220px">${extra(d.k,t)}</td><td>${st}</td></tr>`});
  /* Thư mục dùng chung (không thuộc riêng phòng nào): mã "chung1", "chung2"…; luôn có thêm một dòng trống để thêm mới. */
  const isDept=pb=>D_.some(d=>d.k===pb);
  const sh=C.teams.filter(t=>!isDept(t.pb));let n=1;const used=new Set(C.teams.map(t=>t.pb));const nextPb=()=>{while(used.has("chung"+n))n++;used.add("chung"+n);return "chung"+n};
  const shRows=sh.concat([{pb:nextPb(),folderId:"",viewers:["all"],name:"",blank:true}]).map(t=>{const st=t.blank?"":!C.connected?pill("Chờ nối Drive","amb"):t.ok?pill("Đã thấy: "+(t.folder_name||"thư mục"),"grn"):pill("Chưa chia sẻ cho web","amb");
    return `<tr><td style="min-width:180px"><input data-tmnm="${esc(t.pb)}" placeholder="${t.blank?"Thêm thư mục chung: tên":"Tên thư mục"}" value="${esc(t.name||"")}"></td><td style="min-width:240px"><input data-tmfo="${esc(t.pb)}" placeholder="Dán link thư mục Google Drive" value="${t.folderId?esc("https://drive.google.com/drive/folders/"+t.folderId):""}"></td><td style="min-width:220px">${extra(t.pb,t,true)}</td><td>${st}</td></tr>`});
  const sy=TM.sync,syHtml=!sy?"":sy.loading?`<p class="hint">Đang kiểm tra quyền trên Drive…</p>`:sy.err?`<div class="note red">${esc(sy.err)}</div>`:
    `<div class="card pad" style="margin-top:10px">${sy.dry?"<b>Xem trước:</b> ":"<b>Đã đồng bộ.</b> "}${sy.folders.map(f=>{const nm=(D_.find(d=>d.k===f.pb)||C.teams.find(t=>t.pb===f.pb)||{}).n||(C.teams.find(t=>t.pb===f.pb)||{}).name||f.pb;
      return `<div style="margin-top:6px"><b>${esc(nm)}</b>: ${f.error?`<span class="t-red">${esc(f.error)}</span>`:[f.added.length?"thêm "+esc(f.added.join(", ")):"",f.changed.length?"đổi "+esc(f.changed.join(", ")):"",f.removed.length?"gỡ "+esc(f.removed.join(", ")):""].filter(Boolean).join(" · ")||"không cần đổi"}</div>`}).join("")}
      ${sy.no_email.length?`<div class="note amb" style="margin-top:10px">${sy.no_email.length} nhân viên chưa có email trong hồ sơ nên chưa được cấp quyền: ${esc(sy.no_email.map(x=>x.ten).join(", "))}. Thêm email ở Nhân sự › Nhân viên.</div>`:""}
      ${sy.dry?`<button class="btn pri sm" id="tm-sync-go" style="margin-top:10px">Áp dụng</button>`:""}</div>`;
  const syncBox=`<div class="card pad" style="margin-bottom:14px"><b>Quyền trên Google Drive theo danh sách nhân viên</b>
    <p class="hint" style="margin:6px 0 8px">Nhân viên đang làm có email trong hồ sơ (Nhân sự › Nhân viên): được sửa thư mục phòng mình, chỉ xem thư mục dùng chung. Người đã nghỉ bị gỡ quyền. Web tự làm mỗi giờ; người được chia sẻ tay thì web không đụng tới. Web cần là Người chỉnh sửa của thư mục.</p>
    ${C.sync_paused?`<div class="note amb" style="margin-bottom:8px">Đang TẠM DỪNG tự cấp quyền mỗi giờ. Bấm "Bật lại" khi thư mục trên Drive đã sắp xong.</div>`:""}
    <button class="btn sm" id="tm-sync">Kiểm tra &amp; đồng bộ ngay</button> <button class="btn sm" id="tm-pause">${C.sync_paused?"Bật lại tự cấp quyền":"Tạm dừng tự cấp quyền"}</button>${syHtml}</div>`;
  return guide+syncBox+`<section class="card flush">${tbl(["Phòng ban","Thư mục Drive gốc","Ai được xem thêm","Kết nối"],rows)}</section>
  <h3 style="margin:18px 0 6px">Thư mục dùng chung</h3><p class="hint" style="margin:0 0 8px">Thư mục không thuộc riêng phòng nào (thư mục chung công ty, kho hình ảnh thương hiệu…). Thư mục phòng nằm bên trong vẫn chỉ phòng đó xem.</p>
  <section class="card flush">${tbl(["Tên hiện trên web","Thư mục Drive","Ai được xem","Kết nối"],shRows)}<div class="pad" style="display:flex;gap:10px;align-items:center"><button class="btn pri" id="tm-save"${TM.saving?" disabled":""}>${TM.saving?"Đang lưu…":"Lưu"}</button><span class="hint">Để trống link = bỏ thư mục đó.</span></div></section>`;
}
async function tmSync(dry){TM.sync={loading:true};tmRedraw();try{TM.sync={...(await svApi("/api/drive/sync"+(dry?"?dry=1":""),{method:"POST"})),dry}}catch(e){TM.sync={err:e.message||"Không đồng bộ được"}}tmRedraw()}
function tmCfgBind(m){
  const sb=$("#tm-sync");if(sb)sb.onclick=()=>tmSync(true);
  const pz=$("#tm-pause");if(pz)pz.onclick=async()=>{try{await svApi("/api/drive/sync-pause",{method:"PUT",body:JSON.stringify({paused:!TM.cfg.sync_paused})});toast(TM.cfg.sync_paused?"Đã bật lại tự cấp quyền":"Đã tạm dừng tự cấp quyền");tmCfgLoad()}catch(e){toast(e.message||"Không đổi được")}};const sg=$("#tm-sync-go");if(sg)sg.onclick=()=>tmSync(false);
  const cp=$("#tm-cp");if(cp)cp.onclick=()=>{try{navigator.clipboard.writeText(TM.cfg.sa_email).then(()=>toast("Đã chép email"),()=>toast(TM.cfg.sa_email))}catch(e){toast(TM.cfg.sa_email)}};
  const sv=$("#tm-save");if(sv)sv.onclick=async()=>{
    const teams=[...m.querySelectorAll("[data-tmfo]")].map(i=>{const pb=i.dataset.tmfo,nm=m.querySelector(`[data-tmnm="${CSS.escape(pb)}"]`);
      return {pb,folder:i.value.trim(),name:nm?nm.value.trim():"",viewers:[...m.querySelectorAll(`[data-tmvw="${CSS.escape(pb)}"]:checked`)].map(c=>c.value)}}).filter(t=>t.folder);
    const noName=teams.find(t=>m.querySelector(`[data-tmnm="${CSS.escape(t.pb)}"]`)&&!t.name);if(noName){toast("Đặt tên cho thư mục dùng chung trước khi lưu");return}
    TM.saving=true;renderMain();
    try{await svApi("/api/drive/config",{method:"PUT",body:JSON.stringify({teams})});toast("Đã lưu thư mục các phòng");TM.teams=null;TM.recent={};TM.list=null;TM.listKey="";await tmCfgLoad();tmTeams(true)}
    catch(e){toast(e.message||"Không lưu được")}
    TM.saving=false;tmRedraw();
  };
}
PAGES.thumuc=pThuMuc;
PAGES.thumuc_gan=pThuMuc;

/* Menu (chạy sau menubang.js): bên vận hành một mục riêng ngay dưới "Công việc"; bên quản trị thêm vào Cấu hình › Tài khoản. */
{
  const ADMH=typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
  if(ADMH){const c=MODULES.find(x=>x.k==="q_cfg");if(c){const g0=c.groups;c.groups=()=>{const G=g0();const tk=G.find(g=>g[0]==="Tài khoản");const it=MI("thumuc_gan","Thư mục Drive các phòng",u=>u.role==="admin"),iv=MI("thumuc","Thư mục làm việc");if(tk)tk[1].push(iv,it);else G.push(["Tài khoản",[iv,it]]);return G}}}
  else{const i=MODULES.findIndex(x=>x.k==="cv");MODULES.splice(i>=0?i+1:0,0,{k:"tm",zone:"",ic:"folder",n:"Thư mục làm việc",sub:"",hide:true,groups:()=>[["",[MI("thumuc","Thư mục làm việc")]]]})}
}
