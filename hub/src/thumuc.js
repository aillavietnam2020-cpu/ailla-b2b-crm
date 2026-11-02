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

const tmTy=k=>{const x=TM_KIND[k]||TM_KIND.other;return `<span class="tm-ty p-${x[2]}">${x[1]}</span>`};
function tmRows(files,showWhere){
  const L=files.filter(f=>!TM.kind||f.kind===TM.kind);
  return tbl(["Tên file","Loại","Người sửa cuối","Sửa lúc",""],L.map(f=>{const nm=TM.teams&&showWhere&&TM.q?((TM.teams.teams.find(t=>t.pb===f.pb)||{}).name||""):"";
    return `<tr><td><div class="tm-fn">${tmTy(f.kind)}<div><div class="tm-nm">${esc(f.name)}</div>${showWhere&&(nm||f.where)?`<div class="hint">${esc([nm,f.where].filter(Boolean).join(" · "))}</div>`:""}</div></div></td>
    <td class="hint nowrap">${esc((TM_KIND[f.kind]||TM_KIND.other)[0])}${f.size?" · "+tmSize(f.size):""}</td><td>${esc(f.by||"—")}</td><td class="nowrap">${tmTime(f.modified)}</td>
    <td class="nowrap"><a class="btn sm" href="${esc(f.link)}" target="_blank" rel="noopener">Mở ↗</a></td></tr>`}),"tm-t");
}

function pThuMuc(m){
  const css=`<style>.tm-t td{vertical-align:middle}.tm-fn{display:flex;gap:10px;align-items:center;min-width:0}.tm-nm{font-weight:500;word-break:break-word}
  .tm-ty{flex:none;width:34px;height:28px;border-radius:7px;display:grid;place-items:center;font-size:10px;font-weight:800}
  .tm-fd{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:14px}
  .tm-fd button{display:flex;gap:10px;align-items:center;text-align:left;padding:10px 12px;border:1px solid var(--line);background:var(--surface);border-radius:12px;cursor:pointer;min-width:0}
  .tm-fd button:hover{border-color:var(--blue)}.tm-fd svg{flex:none;width:22px;height:22px;color:var(--blue)}.tm-fd b{display:block;font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tm-cr{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:12px;font-size:14px}.tm-cr button{border:0;background:none;color:var(--blue);padding:2px 4px;cursor:pointer;font-weight:500}
  .tm-q{flex:1 1 260px;max-width:460px}</style>`;
  const ceo=!!TM.teams&&TM.teams.can_manage;
  const tabs=ceo&&!(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin")?`<div class="filters"><button class="btn sm${TM.view==="xem"?" pri":""}" data-tmv="xem">Thư mục</button><button class="btn sm${TM.view==="gan"?" pri":""}" data-tmv="gan">Gán thư mục cho phòng ban</button></div>`:"";
  const head=H("Thư mục làm việc","File làm hằng ngày của các phòng, lấy thẳng từ Google Drive · web chỉ xem, bấm Mở để làm việc trên Drive");
  if(!TM.teams){m.innerHTML=head+(TM.err?`<div class="note red">${esc(TM.err)}</div>`:`<p class="hint">Đang tải…</p>`);if(!TM.busy)tmTeams();return}
  if(PAGE==="thumuc_gan"||TM.view==="gan"){m.innerHTML=css+head+tabs+tmCfgHtml();tmCfgBind(m);tmBindTabs(m);return}
  const T=TM.teams.teams;
  if(!TM.teams.connected){m.innerHTML=css+head+tabs+`<div class="note amb">Web chưa được nối với Google Drive.${ceo?" Chị chạy file NOI-GOOGLE-DRIVE.bat một lần (hướng dẫn ở tab Gán thư mục).":" Cần CEO nối Drive trước."}</div>`;tmBindTabs(m);return}
  if(!T.length){m.innerHTML=css+head+tabs+`<div class="card pad"><p>Phòng của bạn chưa được gán thư mục Drive.</p><p class="hint">${ceo?"Gán thư mục cho từng phòng ở tab Gán thư mục.":"Nhờ CEO gán thư mục Drive cho phòng mình."}</p></div>`;tmBindTabs(m);return}
  const chips=`<div class="filters">${T.map(t=>`<button class="btn sm${t.pb===TM.pb&&!TM.q?" pri":""}" data-tmpb="${esc(t.pb)}">${esc(t.name)}</button>`).join("")}</div>`;
  const kinds=`<select id="tm-kind" aria-label="Loại file"><option value="">Mọi loại file</option>${Object.entries(TM_KIND).filter(([k])=>k!=="link"&&k!=="other").map(([k,x])=>`<option value="${k}"${TM.kind===k?" selected":""}>${x[0]}</option>`).join("")}</select>`;
  const bar=`<div class="filters"><input type="search" class="tm-q" id="tm-q" placeholder="Tìm tên file trong các thư mục bạn được xem…" value="${esc(TM.q)}" aria-label="Tìm file"> ${kinds}<span class="sp"></span><button class="btn sm" id="tm-re">Tải lại</button></div>`;
  let body="";
  if(TM.q){
    if(!TM.find||TM.findKey!==TM.q)tmFind();
    const F=TM.find||{loading:true};
    body=F.loading?`<p class="hint">Đang tìm…</p>`:F.err?`<div class="note red">${esc(F.err)}</div>`:
      `<section class="card flush"><div class="pad"><b>${F.files.length} file khớp “${esc(TM.q)}”</b> <span class="hint">· mới sửa lên trước</span></div>${tmRows(F.files,true)}</section>`;
  }else{
    tmLoadList();
    const L=TM.list||{loading:true};
    if(L.loading)body=`<p class="hint">Đang mở thư mục…</p>`;
    else if(L.err)body=`<div class="note red">${esc(L.err)}</div>`;
    else{
      const crumb=`<div class="tm-cr">${L.path.map((p,i)=>i===L.path.length-1?`<b>${esc(p.name)}</b>`:`<button data-tmf="${i?esc(p.id):""}">${esc(p.name)}</button><span class="hint">›</span>`).join("")}</div>`;
      const fds=L.folders.length?`<div class="tm-fd">${L.folders.map(f=>`<button data-tmf="${esc(f.id)}" title="${esc(f.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ICONS.folder}</svg><span style="min-width:0"><b>${esc(f.name)}</b><span class="hint">sửa ${tmTime(f.modified)}</span></span></button>`).join("")}</div>`:"";
      let recent="";
      if(!TM.folder){tmLoadRecent(TM.pb);const R=TM.recent[TM.pb]||{loading:true};
        recent=R.loading?"":R.err?"":R.files.length?`<section class="card flush" style="margin-bottom:14px"><div class="pad"><b>Sửa gần đây trong phòng</b> <span class="hint">· ${R.files.length} file mới nhất, ở mọi thư mục con</span></div>${tmRows(R.files,true)}</section>`:""}
      body=crumb+fds+recent+`<section class="card flush"><div class="pad"><b>File trong thư mục này</b> <span class="hint">· mới sửa lên trước</span></div>${L.files.length?tmRows(L.files,false):`<p class="empty pad">Thư mục này không có file (chỉ có thư mục con).</p>`}</section>`;
    }
  }
  m.innerHTML=css+head+tabs+chips+bar+body+`<p class="hint" style="margin-top:12px">Bấm Mở thì Google Drive vẫn kiểm quyền của chính bạn: chưa mở được thì nhờ trưởng phòng chia sẻ thư mục cho email của bạn. Tài liệu chuẩn (quy trình, biểu mẫu, hướng dẫn) xem ở Thư viện tài liệu trong khu Đào tạo.</p>`;
  tmBindTabs(m);
  m.querySelectorAll("[data-tmpb]").forEach(b=>b.onclick=()=>{TM.pb=b.dataset.tmpb;TM.folder="";TM.q="";renderMain()});
  m.querySelectorAll("[data-tmf]").forEach(b=>b.onclick=()=>{TM.folder=b.dataset.tmf;renderMain();scrollTo(0,0)});
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
    ${C.connected?"":`<div class="note amb" style="margin-top:8px">Web chưa có tài khoản Google để đọc Drive. Làm theo file HUONG-DAN-NOI-GOOGLE-DRIVE (em gửi chị) rồi chạy NOI-GOOGLE-DRIVE.bat một lần.</div>`}
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
    <p class="hint" style="margin:6px 0 8px">Nhân viên đang làm có email trong hồ sơ (Nhân sự › Nhân viên): được sửa thư mục phòng mình, chỉ xem thư mục dùng chung. Người đã nghỉ bị gỡ quyền. Web tự làm mỗi giờ; người chị tự chia sẻ tay web không đụng tới. Web cần là Người chỉnh sửa của thư mục.</p>
    <button class="btn sm" id="tm-sync">Kiểm tra &amp; đồng bộ ngay</button>${syHtml}</div>`;
  return guide+syncBox+`<section class="card flush">${tbl(["Phòng ban","Thư mục Drive gốc","Ai được xem thêm","Kết nối"],rows)}</section>
  <h3 style="margin:18px 0 6px">Thư mục dùng chung</h3><p class="hint" style="margin:0 0 8px">Thư mục không thuộc riêng phòng nào (thư mục chung công ty, kho hình ảnh thương hiệu…). Thư mục phòng nằm bên trong vẫn chỉ phòng đó xem.</p>
  <section class="card flush">${tbl(["Tên hiện trên web","Thư mục Drive","Ai được xem","Kết nối"],shRows)}<div class="pad" style="display:flex;gap:10px;align-items:center"><button class="btn pri" id="tm-save"${TM.saving?" disabled":""}>${TM.saving?"Đang lưu…":"Lưu"}</button><span class="hint">Để trống link = bỏ thư mục đó.</span></div></section>`;
}
async function tmSync(dry){TM.sync={loading:true};tmRedraw();try{TM.sync={...(await svApi("/api/drive/sync"+(dry?"?dry=1":""),{method:"POST"})),dry}}catch(e){TM.sync={err:e.message||"Không đồng bộ được"}}tmRedraw()}
function tmCfgBind(m){
  const sb=$("#tm-sync");if(sb)sb.onclick=()=>tmSync(true);const sg=$("#tm-sync-go");if(sg)sg.onclick=()=>tmSync(false);
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
  if(ADMH){const c=MODULES.find(x=>x.k==="q_cfg");if(c){const g0=c.groups;c.groups=()=>{const G=g0();const tk=G.find(g=>g[0]==="Tài khoản");const it=MI("thumuc_gan","Thư mục Drive các phòng",u=>u.role==="admin");if(tk)tk[1].push(it);else G.push(["Tài khoản",[it]]);return G}}}
  else{const i=MODULES.findIndex(x=>x.k==="cv");MODULES.splice(i>=0?i+1:0,0,{k:"tm",zone:"",ic:"folder",n:"Thư mục làm việc",sub:"",groups:()=>[["",[MI("thumuc","Thư mục làm việc")]]]})}
}
