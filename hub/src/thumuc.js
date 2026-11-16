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
const TM={teams:null,err:"",pb:"",folder:"",busy:false,q:"",find:null,findKey:"",tab:"thumuc",sub:"",inq:"",file:null,fl:{},ov:null,ovErr:"",tt:"",cfg:null,cfgErr:"",saving:false,sync:null};
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
    const T=TM.teams.teams;if(TM.pb&&!T.some(t=>t.pb===TM.pb)){TM.pb="";TM.folder=""}}
  catch(e){TM.err=e.message||"Không tải được"}
  TM.busy=false;tmRedraw();
}
/* ---------- Giao diện (chị Hoa duyệt demo 16/11, học bố cục app hồ sơ Optimate): tab ngang · thẻ thư mục có số file ·
   dải phòng · lọc theo thư mục con · bảng file mỗi file một dòng có cột "Nằm ở đâu" · trang chi tiết file ·
   Bảng điều khiển · Tìm file (không dấu) · Việc cần xử lý · Báo cáo (CEO). Số file lấy từ mục lục máy chủ quét Drive. ---------- */
const TM_COLOR={sheet:"#188038",doc:"#1a73e8",slide:"#f29900",pdf:"#d93025",vid:"#d93025",img:"#d93025",link:"#5f6368",other:"#5f6368"};
const TM_GLYPH={sheet:"▦",doc:"≡",slide:"▭",pdf:"P",vid:"▶",img:"◩",link:"↗",other:"•"};
const TM_SUBC=["var(--violet)","var(--pink)","var(--green)","var(--orange)","var(--blue)","#0fa3a3","#9b51e0","var(--muted)"];
const tmIc=(k,big)=>`<span class="gd-ic${big?" big":""}" style="background:${TM_COLOR[k]||TM_COLOR.other}" aria-hidden="true">${TM_GLYPH[k]||"•"}</span>`;
const tmFolderSvg=`<svg class="gd-fsvg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
/* Nút tải bản gốc (giữ nguyên độ phân giải); file Google Tài liệu / Trang tính không có nút này. */
const tmDl=f=>f.dl?`<a class="gd-dl" href="${esc(f.dl)}" download title="Tải về bản gốc${f.size?" ("+tmSize(f.size)+")":""}" aria-label="Tải ${esc(f.name)} về máy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg></a>`:"";
const tmFold=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
const tmHl=(s,q)=>{if(!q)return esc(s);const a=tmFold(s),w=tmFold(q).trim().split(/\s+/)[0]||"",i=w?a.indexOf(w):-1;return i<0?esc(s):esc(s.slice(0,i))+"<mark>"+esc(s.slice(i,i+w.length))+"</mark>"+esc(s.slice(i+w.length))};
const tmTeam=pb=>((TM.ov&&TM.ov.teams)||[]).find(t=>t.pb===pb);
const tmName=pb=>{const t=tmTeam(pb)||(TM.teams?TM.teams.teams.find(x=>x.pb===pb):null);return t?t.name:pb};
const tmSubCol=(pb,n)=>{const t=tmTeam(pb);const i=t?t.subs.findIndex(s=>s.n===n):-1;return i<0?"var(--muted)":TM_SUBC[i%TM_SUBC.length]};
const tmLoc=f=>f.sub?`<span class="tm-loc">${esc(tmName(f.pb))} › ${esc(f.where)}</span>`:f.kind==="link"?`<span class="tm-loc">${esc(tmName(f.pb))}</span>`:`<span class="tm-loc warn">⚠ Chưa xếp thư mục</span>`;

async function tmOv(force){
  if(TM.ovBusy&&!force)return;TM.ovBusy=true;
  try{TM.ov=await svApi("/api/drive/overview");TM.ovErr=""}catch(e){TM.ovErr=e.message||"Không tải được"}
  TM.ovBusy=false;tmRedraw();
  /* Thư mục chưa đếm xong (máy chủ đang quét ngầm): hỏi lại sau ít giây. */
  if(TM.ov&&TM.ov.teams.some(t=>t.total==null)&&!TM.ovRetry){TM.ovRetry=setTimeout(()=>{TM.ovRetry=0;if(tmOn())tmOv(true)},8000)}
}
async function tmLoadFiles(pb,fresh){
  const k=pb;if(!fresh&&TM.fl[k]&&!TM.fl[k].err)return;TM.fl[k]={loading:true};
  try{TM.fl[k]=await svApi("/api/drive/files?pb="+encodeURIComponent(pb)+(fresh?"&fresh=1":""));if(fresh)tmOv(true)}catch(e){TM.fl[k]={err:e.message||"Không tải được thư mục"}}
  tmRedraw();
}
async function tmFind(){
  const key=TM.q;if(TM.findKey===key&&TM.find)return;TM.findKey=key;TM.find={loading:true};
  try{const r=await svApi("/api/drive/find?q="+encodeURIComponent(TM.q));if(TM.findKey===key)TM.find=r}
  catch(e){if(TM.findKey===key)TM.find={err:e.message||"Không tìm được"}}
  tmRedraw();
}
const tmCss=`<style>
  .tm-wrap{min-width:0}
  .tm-tabs .sp{flex:1}
  .tm-sec{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:18px 0 8px}
  .tm-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
  .tm-fc{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:9px;min-width:0;text-align:left;color:inherit;font:inherit}
  .tm-fc:hover{border-color:var(--violet);box-shadow:0 0 0 3px var(--violet-soft)}
  .tm-fc .hd{display:flex;justify-content:space-between;align-items:flex-start}
  .tm-fic{width:34px;height:34px;border-radius:9px;background:var(--violet-soft);color:var(--violet);display:grid;place-items:center}.tm-fic .gd-fsvg{width:17px;height:17px}
  .tm-num{text-align:right;line-height:1.05}.tm-num b{font-size:22px;display:block;font-variant-numeric:tabular-nums}.tm-num small{color:var(--muted);font-size:11px}
  .tm-fc .t{font-weight:700;font-size:14.5px}
  .tm-seg{display:flex;gap:2px;height:5px;background:var(--gray-soft);border-radius:3px}.tm-seg span{border-radius:3px}
  .tm-types{display:flex;flex-direction:column;gap:3px;font-size:12.5px}.tm-types div{display:flex;align-items:center;gap:7px}
  .tm-sq{width:8px;height:8px;border-radius:2px;flex:none}.tm-types .n{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm-types .c{color:var(--muted);font-variant-numeric:tabular-nums}
  .tm-more{font-size:11.5px;color:var(--muted)}
  .tm-tag{font-size:11px;border-radius:999px;padding:2px 9px;align-self:flex-start;font-weight:600;background:var(--gray-soft);color:var(--muted)}.tm-tag.w{background:var(--green-soft);color:var(--green)}
  .tm-dept{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px}
  .tm-dp{flex:none;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:5px 12px;font-size:13px;cursor:pointer;white-space:nowrap;color:inherit}
  .tm-dp.on{background:var(--blue-soft);border-color:transparent;color:var(--blue);font-weight:600}.tm-dp small{color:var(--muted);margin-left:3px}
  .tm-dsep{flex:none;width:1px;background:var(--line);margin:4px 2px}
  .tm-crumbs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
  .tm-cr{display:inline-flex;align-items:center;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:3px 10px;font-size:12px;color:var(--muted);cursor:pointer}
  .tm-cr.cur{background:var(--blue-soft);border-color:transparent;color:var(--blue);cursor:default}
  .tm-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
  .tm-hd h2{font-size:19px;margin:0}.tm-hd p{margin:2px 0 0;color:var(--muted);font-size:12.5px}.tm-hd .act{display:flex;gap:8px;flex-wrap:wrap}
  .tm-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
  .tm-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:6px 10px;cursor:pointer;font-size:13px;color:inherit}
  .tm-chip .vb{width:3px;height:13px;border-radius:2px}.tm-chip .cn{font-size:11px;background:var(--gray-soft);border-radius:999px;padding:0 7px;color:var(--muted);font-variant-numeric:tabular-nums}
  .tm-chip.on{border-color:var(--violet);box-shadow:0 0 0 1px var(--violet) inset;color:var(--violet);font-weight:600}.tm-chip.on .cn{background:var(--violet);color:#fff}
  .tm-box{background:var(--surface);border:1px solid var(--line);border-radius:14px;min-width:0}
  .tm-tbar{display:flex;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap;align-items:center}
  .tm-srch{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:0 10px;flex:1;min-width:200px;max-width:380px;color:var(--muted)}
  .tm-srch input{border:0;outline:0;background:none;flex:1;min-width:0;padding:7px 0}.tm-srch svg{width:15px;height:15px;flex:none}
  .tm-tw{overflow-x:auto}
  .tm-t{border-collapse:collapse;width:100%;table-layout:fixed;min-width:760px}
  .tm-t th{font-size:11.5px;color:var(--muted);font-weight:500;text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);white-space:nowrap}
  .tm-t td{padding:0 12px;height:46px;border-bottom:1px solid var(--line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13.5px}
  .tm-t tbody tr{cursor:pointer}.tm-t tbody tr:hover{background:var(--gray-soft)}.tm-t tbody tr:last-child td{border-bottom:0}
  .tm-fn{display:flex;align-items:center;gap:10px;min-width:0}.tm-fn .tx{min-width:0}
  .tm-fn b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tm-fn small{display:block;color:var(--muted);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tm-loc{display:inline-block;background:var(--blue-soft);color:var(--blue);border-radius:7px;padding:2px 8px;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle}
  .tm-loc.warn{background:var(--orange-soft);color:var(--orange)}
  .tm-t .gd-dl{position:static;display:inline-grid;width:28px;height:28px;opacity:1;box-shadow:none;background:transparent;vertical-align:middle}.tm-t .gd-dl:hover{background:var(--gray-soft)}
  .gd-dl{border-radius:999px;color:var(--ink);place-items:center}.gd-dl svg{width:17px;height:17px}
  .gd-ic{flex:none;width:26px;height:26px;border-radius:7px;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:700;line-height:1}
  .gd-ic.big{width:56px;height:56px;border-radius:12px;font-size:28px}
  mark{background:#fff0a6;color:#1c1f33;border-radius:3px;padding:0 1px}
  .tm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:12px}
  .tm-kpi{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;justify-content:space-between;gap:10px;cursor:pointer;text-align:left;color:inherit;font:inherit}
  .tm-kpi:hover{border-color:var(--violet)}.tm-kpi small{color:var(--muted);font-size:12.5px;display:block}.tm-kpi b{font-size:24px;display:block;font-variant-numeric:tabular-nums;margin:2px 0}
  .tm-kpi em{font-style:normal;font-size:11.5px;color:var(--muted)}.tm-kpi em.r{color:var(--red);background:var(--red-soft);padding:1px 7px;border-radius:999px;font-weight:600}
  .tm-kpi i{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;flex:none;font-style:normal;font-weight:700}
  .tm-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
  .tm-bh{display:flex;justify-content:space-between;align-items:baseline;padding:12px 14px 6px;gap:8px}.tm-bh h3{font-size:14.5px;margin:0}.tm-bh small{color:var(--muted)}
  .tm-lk{color:var(--violet);font-weight:600;cursor:pointer;border:0;background:none;padding:0;font-size:13px}
  .tm-mini{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:6px 14px 14px}
  .tm-mf{border:1px solid var(--line);border-radius:10px;padding:8px 10px;cursor:pointer;display:flex;flex-direction:column;gap:6px;background:var(--gray-soft);text-align:left;color:inherit;font:inherit}
  .tm-mf:hover{border-color:var(--violet)}.tm-mf .t{font-size:12.5px;font-weight:600;display:flex;gap:6px}
  .tm-mf .t span:first-child{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tm-mf .dots{display:flex;flex-wrap:wrap;gap:3px}.tm-mf .dots i{width:14px;height:18px;border-radius:3px}
  .tm-it{display:flex;gap:10px;align-items:center;padding:10px 14px;border-top:1px solid var(--line);cursor:pointer;width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;color:inherit;font:inherit}
  .tm-it:hover{background:var(--gray-soft)}.tm-it i{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;flex:none;font-style:normal;font-weight:700}
  .tm-it .tx{flex:1;min-width:0}.tm-it b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tm-it small{display:block;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tm-dg{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:12px}
  .tm-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:6px 14px 14px}
  .tm-kv div{background:var(--gray-soft);border-radius:9px;padding:8px 10px;min-width:0}.tm-kv small{display:block;color:var(--muted);font-size:11px}.tm-kv b{font-weight:500;display:block;overflow-wrap:anywhere}
  .tm-path{display:flex;flex-direction:column;gap:6px;padding:4px 14px 12px}
  .tm-path div{display:flex;gap:9px;align-items:center;background:var(--gray-soft);border-radius:9px;padding:8px 10px}.tm-path div.cur{background:var(--blue-soft);color:var(--blue);font-weight:600}
  .tm-path small{color:var(--muted);font-size:11px;display:block;font-weight:400}.tm-path .gd-fsvg{width:15px;height:15px;flex:none}
  .tm-prev{margin:0 14px 14px;border-radius:10px;min-height:120px;background:var(--gray-soft);display:grid;place-items:center;overflow:hidden}
  .tm-prev img{max-width:100%;max-height:420px;display:block}
  .tm-fr{display:flex;align-items:center;gap:8px;padding:9px 14px;border-top:1px solid var(--line);cursor:pointer}
  .tm-fr:hover{background:var(--gray-soft)}.tm-fr .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm-fr .gd-ic{width:22px;height:22px;font-size:11px}
  .tm-big{display:flex;align-items:center;gap:10px;border:1px solid var(--violet);box-shadow:0 0 0 3px var(--violet-soft);border-radius:12px;padding:0 14px;background:var(--surface)}
  .tm-big input{border:0;outline:0;background:none;flex:1;min-width:0;font-size:14.5px;padding:11px 0}.tm-big svg{width:18px;height:18px;flex:none;color:var(--muted)}
  .tm-res{padding:10px 14px;border-top:1px solid var(--line);cursor:pointer;display:flex;align-items:center;gap:12px}.tm-res:hover{background:var(--gray-soft)}.tm-res .tm-fn{flex:1}
  .tm-empty{padding:26px;text-align:center;color:var(--muted)}
  .tm-subtabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
  .tm-st{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:4px 12px;cursor:pointer;font-size:12.5px;color:inherit}.tm-st.on{background:var(--blue-soft);border-color:transparent;color:var(--blue);font-weight:600}
  .tm-rt td{height:42px}
  .gd-pj{display:flex;gap:10px;align-items:center;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:12px 14px;color:inherit;text-decoration:none;min-width:0}
  .gd-pj span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gd-pj .gd-fsvg{width:18px;height:18px;flex:none;color:var(--muted)}
  @media(max-width:860px){.tm-two,.tm-dg{grid-template-columns:1fr}.tm-kv{grid-template-columns:1fr 1fr}}
</style>`;

function tmCard(t){
  const S=[...t.subs].map((s,i)=>({...s,col:TM_SUBC[i%TM_SUBC.length]}));const top=[...S].sort((a,b)=>b.c-a.c);
  return `<button class="tm-fc" data-tmpb="${esc(t.pb)}">
   <div class="hd"><span class="tm-fic">${tmFolderSvg}</span><span class="tm-num"><b>${t.total==null?"…":t.total.toLocaleString("vi-VN")}</b><small>${t.total==null?"đang đếm":"file"}</small></span></div>
   <div class="t">${esc(t.name)}</div>
   <div class="tm-seg">${S.filter(s=>s.c).map(s=>`<span style="flex:${s.c};background:${s.col}"></span>`).join("")}</div>
   <div class="tm-types">${top.slice(0,4).map(s=>`<div><span class="tm-sq" style="background:${s.col}"></span><span class="n">${esc(s.n)}</span><span class="c">${s.c}</span></div>`).join("")||`<div class="tm-more">Chưa có thư mục con</div>`}</div>
   ${top.length>4?`<div class="tm-more">và ${top.length-4} thư mục khác</div>`:""}
   <span class="tm-tag ${t.edit?"w":""}">${t.edit?"Được sửa":"Chỉ xem"}</span></button>`;
}
function tmVisible(){const T=(TM.ov&&TM.ov.teams)||[];return TM.scope?T.filter(t=>t.pb===TM.scope||t.shared):T}
function tmCardsView(){
  const T=tmVisible(),own=T.filter(t=>!t.shared),sh=T.filter(t=>t.shared),tot=T.reduce((a,t)=>a+(t.total||0),0);
  const PJ=TM.scope&&typeof kpbPrj==="function"?kpbPrj(kpbTeam(TM.scope)).filter(p=>p.drive):[];
  return `<div class="tm-hd"><div><h2>${TM.scope?"Thư mục của "+esc(typeof kpbName==="function"?kpbName(TM.scope):TM.scope):"Thư mục làm việc"}</h2><p>Xem file theo phòng và thư mục con, không cần biết file nằm ở đâu trên Drive · ${T.length} thư mục · ${tot.toLocaleString("vi-VN")} file</p></div>
   <div class="act">${TM.scope?`<button class="btn sm" id="tm-back">‹ Về phòng</button>`:""}</div></div>
   ${own.length?`<div class="tm-sec">Thư mục phòng</div><div class="tm-cards">${own.map(tmCard).join("")}</div>`:`<div class="note">Phòng ${TM.scope?"này":"của bạn"} chưa được gán thư mục Drive.${TM.ov&&TM.ov.can_manage?" Gán ở tab Gán thư mục cho phòng ban.":" Nhờ CEO gán thư mục cho phòng."}</div>`}
   ${sh.length?`<div class="tm-sec">Tư liệu chung</div><div class="tm-cards">${sh.map(tmCard).join("")}</div>`:""}
   ${TM.scope?`<div class="tm-sec">Thư mục dự án</div>${PJ.length?`<div class="tm-cards">${PJ.map(p=>`<a class="gd-pj" href="${esc(p.drive)}" target="_blank" rel="noopener" title="Mở trên Google Drive">${tmFolderSvg}<span>${esc(p.ten)}</span></a>`).join("")}</div>`:`<p class="hint">Chưa có dự án nào gắn thư mục</p>`}`:""}`;
}
function tmDeptStrip(){
  const T=tmVisible(),a=T.filter(t=>!t.shared),b=T.filter(t=>t.shared);
  const one=t=>`<button class="tm-dp${t.pb===TM.pb?" on":""}" data-tmpb="${esc(t.pb)}">${esc(t.name)}<small>${t.total==null?"…":t.total}</small></button>`;
  return `<div class="tm-dept">${a.map(one).join("")}${a.length&&b.length?`<span class="tm-dsep"></span>`:""}${b.map(one).join("")}</div>`;
}
function tmRows(L,q){
  if(!L.length)return `<div class="tm-empty">Không có file nào${q?" khớp":""}.</div>`;
  return `<div class="tm-tw"><table class="tm-t"><colgroup><col style="width:40%"><col style="width:25%"><col style="width:12%"><col style="width:16%"><col style="width:52px"></colgroup>
  <thead><tr><th>Tên file</th><th>Nằm ở đâu</th><th>Sửa lúc</th><th>Người sửa</th><th></th></tr></thead><tbody>
  ${L.map(f=>`<tr data-tmfile="${esc(f.id)}" title="${esc(f.name)}"><td><div class="tm-fn">${tmIc(f.kind)}<div class="tx"><b>${tmHl(f.name,q)}</b><small>${esc((TM_KIND[f.kind]||TM_KIND.other)[0])}${f.size?" · "+tmSize(f.size):""}</small></div></div></td><td>${tmLoc(f)}</td><td>${tmTime(f.modified)}</td><td>${esc(f.by||"—")}</td><td>${tmDl(f)}</td></tr>`).join("")}</tbody></table></div>`;
}
function tmFolderView(){
  const t=tmTeam(TM.pb)||{pb:TM.pb,name:tmName(TM.pb),subs:[],total:null};
  tmLoadFiles(TM.pb);const R=TM.fl[TM.pb]||{loading:true};
  const subs=R.subs||t.subs||[],root=TM.teams&&TM.teams.teams.find(x=>x.pb===TM.pb);
  const cur=TM.sub&&subs.some(s=>s.n===TM.sub)?TM.sub:"";
  let L=(R.files||[]).filter(f=>!cur||f.sub===cur);if(TM.inq){const w=tmFold(TM.inq).split(/\s+/).filter(Boolean);L=L.filter(f=>{const h=tmFold(f.name+" "+f.where+" "+f.by);return w.every(x=>h.includes(x))})}
  const n=cur?(subs.find(s=>s.n===cur)||{}).c:R.total;
  return tmDeptStrip()+`<div class="tm-crumbs"><span class="tm-cr" data-tmhome="1">‹ Tất cả thư mục</span><span class="tm-cr${cur?"":" cur"}" data-tmsub="">${esc(t.name)}</span>${cur?`<span class="tm-cr cur">${esc(cur)}</span>`:""}</div>
  <div class="tm-hd"><div><h2>${esc(cur||t.name)}</h2><p>${n==null?"Đang đếm file":n.toLocaleString("vi-VN")+" file"}${cur?" · trong "+esc(t.name):" · "+subs.length+" thư mục con"}${R.at?" · cập nhật "+tmTime(R.at):""}${R.edit===false?" · chỉ xem":""}</p></div>
   <div class="act">${root?`<a class="btn sm" href="https://drive.google.com/drive/folders/${esc(root.folder_id)}" target="_blank" rel="noopener">Mở trên Drive ↗</a>`:""}<button class="btn sm" id="tm-re">Tải lại</button></div></div>
  <div class="tm-chips"><button class="tm-chip${cur?"":" on"}" data-tmsub="">Tất cả <span class="cn">${R.total??"…"}</span></button>${subs.map((s,i)=>`<button class="tm-chip${cur===s.n?" on":""}" data-tmsub="${esc(s.n)}"><span class="vb" style="background:${TM_SUBC[i%TM_SUBC.length]}"></span>${esc(s.n)} <span class="cn">${s.c}</span></button>`).join("")}</div>
  <div class="tm-box"><div class="tm-tbar"><label class="tm-srch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICONS.search}</svg><input id="tm-inq" placeholder="Tìm tên file, người sửa trong thư mục này (không cần dấu)" value="${esc(TM.inq||"")}" aria-label="Tìm trong thư mục"></label></div>
  ${R.loading?`<div class="tm-empty">Đang mở thư mục… (lần đầu web đếm file có thể mất vài chục giây)</div>`:R.err?`<div class="note red" style="margin:12px">${esc(R.err)}</div>`:tmRows(L.slice(0,300),TM.inq)}
  ${L.length>300||R.more?`<p class="hint" style="padding:8px 14px">Hiện 300 file mới sửa nhất. Chọn thư mục con hoặc gõ tìm để thu hẹp.</p>`:""}${R.cut?`<p class="hint" style="padding:0 14px 10px">Thư mục quá lớn, web mới đếm tới 4.000 file / 250 thư mục.</p>`:""}</div>`;
}
function tmFindFile(id){for(const k in TM.fl){const f=(TM.fl[k].files||[]).find(x=>x.id===id);if(f)return f}const F=TM.find&&TM.find.files||[];return F.find(x=>x.id===id)||null}
function tmFileView(){
  const f=TM.file;if(!f)return tmFolderView();
  const sib=((TM.fl[f.pb]||{}).files||[]).filter(x=>x!==f&&x.id!==f.id&&x.where===f.where).slice(0,6);
  const k=(TM_KIND[f.kind]||TM_KIND.other)[0],edit=(tmTeam(f.pb)||{}).edit;
  return `<div class="tm-crumbs"><span class="tm-cr" data-tmhome="1">‹ Tất cả thư mục</span><span class="tm-cr" data-tmpb="${esc(f.pb)}">${esc(tmName(f.pb))}</span>${f.sub?`<span class="tm-cr" data-tmpb="${esc(f.pb)}" data-tmsubgo="${esc(f.sub)}">${esc(f.sub)}</span>`:""}<span class="tm-cr cur">${esc(k)}</span></div>
  <div class="tm-hd"><div><h2 style="overflow-wrap:anywhere">${esc(f.name)}</h2><p>${esc(k)} · ${esc(f.by||"—")} sửa lúc ${tmTime(f.modified)}</p></div>
   <div class="act"><a class="btn sm pri" href="${esc(f.link)}" target="_blank" rel="noopener">Mở trên Drive ↗</a>${f.dl?`<a class="btn sm" href="${esc(f.dl)}" download>Tải bản gốc</a>`:""}<button class="btn sm" id="tm-cplink">Sao chép link</button></div></div>
  <div class="tm-dg"><div class="tm-box"><div class="tm-bh"><h3>Thông tin file</h3><small>Lấy từ Google Drive</small></div>
   <div class="tm-kv"><div><small>Loại</small><b>${esc(k)}</b></div><div><small>Dung lượng</small><b>${f.size?tmSize(f.size):"—"}</b></div><div><small>Quyền của bạn trên Drive</small><b>${edit?"Được sửa":"Chỉ xem"}</b></div>
   <div><small>Người sửa gần nhất</small><b>${esc(f.by||"—")}</b></div><div><small>Sửa lúc</small><b>${tmTime(f.modified)}</b></div><div><small>Tạo lúc</small><b>${tmTime(f.created)}</b></div></div>
   <div class="tm-bh"><h3>Xem trước</h3></div><div class="tm-prev">${f.thumb?`<img loading="lazy" alt="Ảnh xem trước ${esc(f.name)}" src="${esc(f.thumb)}?s=800" onerror="this.replaceWith(document.createTextNode('Không có ảnh xem trước'))">`:tmIc(f.kind,true)}</div></div>
  <div class="tm-box"><div class="tm-bh"><h3>Nằm ở đâu</h3><small>Đường dẫn trên Drive</small></div>
   <div class="tm-path"><div>${tmFolderSvg}<div><small>${tmTeam(f.pb)&&tmTeam(f.pb).shared?"Tư liệu chung":"Thư mục phòng"}</small>${esc(tmName(f.pb))}</div></div>${f.where?f.where.split(" › ").map((p,i,a)=>`<div class="${i===a.length-1?"cur":""}">${i===0?`<span class="tm-sq" style="background:${tmSubCol(f.pb,p)};width:10px;height:10px"></span>`:tmFolderSvg}<div><small>${i===0?"Thư mục con":"Bên trong"}</small>${esc(p)}</div></div>`).join(""):f.kind==="link"?"":`<div class="cur" style="background:var(--orange-soft);color:var(--orange)">⚠ Chưa xếp vào thư mục con</div>`}</div>
   <div class="tm-bh"><h3>Cùng thư mục</h3><small>${sib.length} file</small></div>${sib.map(x=>`<div class="tm-fr" data-tmfile="${esc(x.id)}">${tmIc(x.kind)}<span class="nm">${esc(x.name)}</span><span class="hint">${tmTime(x.modified)}</span></div>`).join("")||`<div class="tm-fr hint" style="cursor:default">Không có file khác.</div>`}</div></div>`;
}
const tmTi=x=>{const c=x.lv==="r"?["var(--red-soft)","var(--red)","!"]:x.lv==="a"?["var(--orange-soft)","var(--orange)","✎"]:["var(--blue-soft)","var(--blue)","◷"];
  return `<button class="tm-it" data-tmtodo="${esc(x.pb)}" data-tmq="${esc(x.i?x.tx:"")}" data-tmsubgo="${esc(x.i?"":(x.sub.split(" › ")[1]||""))}"><i style="background:${c[0]};color:${c[1]}">${c[2]}</i><span class="tx"><b>${esc(x.k)}: ${esc(x.tx)}</b><small>${esc(x.sub)}</small></span><span class="hint">›</span></button>`};
function tmDashView(){
  const T=tmVisible(),td=TM.ov.todo.filter(x=>T.some(t=>t.pb===x.pb)),tot=T.reduce((a,t)=>a+(t.total||0),0),add=T.reduce((a,t)=>a+t.added,0);
  const big=[...T].sort((a,b)=>b.added-a.added)[0];
  return `<div class="tm-kpis">
   <button class="tm-kpi" data-tmt="thumuc"><span><small>File đang lưu</small><b>${tot.toLocaleString("vi-VN")}</b><em>${T.length} thư mục</em></span><i style="background:var(--violet-soft);color:var(--violet)">▤</i></button>
   <button class="tm-kpi" data-tmt="find"><span><small>Thêm mới 7 ngày</small><b>+${add}</b><em>${big&&big.added?"nhiều nhất: "+esc(big.name):"chưa có file mới"}</em></span><i style="background:var(--green-soft);color:var(--green)">↑</i></button>
   <button class="tm-kpi" data-tmt="todo"><span><small>Việc cần xử lý</small><b>${td.length}</b><em class="${td.some(x=>x.lv==="r")?"r":""}">${td.filter(x=>x.lv==="r").length} cần làm ngay</em></span><i style="background:var(--red-soft);color:var(--red)">!</i></button></div>
  <div class="tm-two"><div class="tm-box"><div class="tm-bh"><span><h3>Các thư mục</h3><small>Bấm để xem bên trong</small></span><button class="tm-lk" data-tmt="thumuc">Xem tất cả</button></div>
   <div class="tm-mini">${T.map(t=>`<button class="tm-mf" data-tmpb="${esc(t.pb)}"><span class="t"><span>${esc(t.name)}</span><span class="hint">${t.total??"…"}</span></span><span class="dots">${t.subs.map((s,i)=>`<i style="background:${TM_SUBC[i%TM_SUBC.length]}" title="${esc(s.n)} · ${s.c} file"></i>`).join("")}</span></button>`).join("")}</div></div>
  <div class="tm-box"><div class="tm-bh"><span><h3>Việc cần xử lý</h3><small>${td.length} việc</small></span><button class="tm-lk" data-tmt="todo">Xem tất cả</button></div>${td.slice(0,8).map(tmTi).join("")||`<div class="tm-empty">Thư mục đang gọn, không có việc nào.</div>`}</div></div>`;
}
function tmTodoView(){
  const T=tmVisible(),L=TM.ov.todo.filter(x=>T.some(t=>t.pb===x.pb)),ks=["",...new Set(L.map(x=>x.k))],sel=TM.tt?L.filter(x=>x.k===TM.tt):L;
  return `<div class="tm-hd"><div><h2>Việc cần xử lý</h2><p>${L.length} việc · web tự quét thư mục, chỉ nhắc, không tự xóa hay chuyển file · bấm một việc để mở đúng chỗ</p></div></div>
  <div class="tm-subtabs">${ks.map(k=>`<button class="tm-st${(TM.tt||"")===k?" on":""}" data-tmtt="${esc(k)}">${k?esc(k)+" "+L.filter(x=>x.k===k).length:"Tất cả "+L.length}</button>`).join("")}</div>
  <div class="tm-box">${sel.slice(0,150).map(tmTi).join("")||`<div class="tm-empty">Không có việc nào.</div>`}</div>`;
}
function tmRepView(){
  const T=tmVisible(),s=k=>T.reduce((a,t)=>a+(t[k]||0),0);
  return `<div class="tm-hd"><div><h2>Báo cáo thư mục</h2><p>Số file đang lưu, thêm và sửa trong 7 ngày qua, việc cần xử lý của từng thư mục.</p></div></div>
  <div class="tm-box"><div class="tm-tw"><table class="tm-t tm-rt" style="min-width:560px"><thead><tr><th style="width:36%">Thư mục</th><th style="text-align:right">Đang lưu</th><th style="text-align:right">Thêm 7 ngày</th><th style="text-align:right">Sửa 7 ngày</th><th style="text-align:right">Cần xử lý</th></tr></thead><tbody>
  ${T.map(t=>`<tr data-tmpb="${esc(t.pb)}"><td>${esc(t.name)}${t.shared?` <span class="hint">· tư liệu chung</span>`:""}</td><td style="text-align:right">${t.total??"…"}</td><td style="text-align:right">${t.added||'<span class="hint">0</span>'}</td><td style="text-align:right">${t.edited||'<span class="hint">0</span>'}</td><td style="text-align:right">${t.todo?`<b class="t-red">${t.todo}</b>`:'<span class="hint">0</span>'}</td></tr>`).join("")}
  <tr style="cursor:default;font-weight:700"><td>Tổng</td><td style="text-align:right">${s("total").toLocaleString("vi-VN")}</td><td style="text-align:right">${s("added")}</td><td style="text-align:right">${s("edited")}</td><td style="text-align:right">${s("todo")}</td></tr></tbody></table></div></div>`;
}
function tmFindView(){
  if(TM.q&&(!TM.find||TM.findKey!==TM.q))tmFind();
  const F=TM.find||{},tot=tmVisible().reduce((a,t)=>a+(t.total||0),0);
  return `<div class="tm-hd"><div><h2>Tìm file</h2><p>Gõ tên file, sản phẩm, người sửa, thư mục… không cần dấu. Kết quả hiện luôn chỗ để.</p></div></div>
  <label class="tm-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICONS.search}</svg><input id="tm-q" value="${esc(TM.q)}" placeholder="vd: bot tay van nang, bao cao ads, kich ban" aria-label="Tìm file"></label>
  <div class="tm-box" style="margin-top:12px">${!TM.q?`<div class="tm-empty">Gõ vào ô trên để tìm trong ${tot.toLocaleString("vi-VN")} file bạn được xem</div>`:F.loading?`<div class="tm-empty">Đang tìm…</div>`:F.err?`<div class="note red" style="margin:12px">${esc(F.err)}</div>`:
   `<div class="tm-bh"><h3>${F.files.length} kết quả</h3><small>mới sửa trước${F.files.length>=60?" · hiện 60 file đầu":""}</small></div>${F.files.map(f=>`<div class="tm-res" data-tmfile="${esc(f.id)}"><div class="tm-fn">${tmIc(f.kind)}<div class="tx"><b>${tmHl(f.name,TM.q)}</b><small>${esc((TM_KIND[f.kind]||TM_KIND.other)[0])} · ${esc(f.by||"—")} · ${tmTime(f.modified)}</small></div></div>${f.sub!=null?tmLoc(f):`<span class="tm-loc">${esc(tmName(f.pb))}${f.where?" › "+esc(f.where):""}</span>`}</div>`).join("")||`<div class="tm-empty">Không thấy file nào. Thử gõ ít chữ hơn.</div>`}`}</div>`;
}

function pThuMuc(m){
  const head=H("Thư mục làm việc","File làm hằng ngày của các phòng, lấy thẳng từ Google Drive");
  if(!TM.teams){m.innerHTML=head+(TM.err?`<div class="note red">${esc(TM.err)}</div>`:`<p class="hint">Đang tải…</p>`);if(!TM.busy)tmTeams();return}
  const ceo=!!TM.teams.can_manage,adm=typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
  if(PAGE==="thumuc_gan"||TM.tab==="gan"){
    const back=adm?"":`<div class="filters"><button class="btn sm" data-tmt="thumuc">‹ Thư mục</button><button class="btn sm pri">Gán thư mục cho phòng ban</button></div>`;
    m.innerHTML=tmCss+head+back+tmCfgHtml();tmCfgBind(m);tmBind(m);return}
  if(!TM.teams.connected){m.innerHTML=head+`<div class="note amb">Web chưa được nối với Google Drive.${ceo?" Chạy file NOI-GOOGLE-DRIVE.bat một lần (hướng dẫn ở tab Gán thư mục).":" Cần CEO nối Drive trước."}</div>`;return}
  if(!TM.ov){m.innerHTML=head+(TM.ovErr?`<div class="note red">${esc(TM.ovErr)}</div>`:`<p class="hint">Đang tải…</p>`);if(!TM.ovBusy)tmOv();return}
  /* Mở từ Công việc › Phòng ban (TM.folder là mã thư mục con) thì đổi sang tên thư mục con để lọc. */
  if(TM.folder){const R=TM.fl[TM.pb];const s=R&&R.subs?R.subs.find(x=>x.id===TM.folder):null;if(s||R&&R.subs){TM.sub=s?s.n:"";TM.folder=""}}
  const tab=TM.tab||"thumuc",bt=(k,l,x="")=>`<button class="btn sm${tab===k?" pri":""}" data-tmt="${k}">${l}${x}</button>`;
  const td=TM.ov.todo.filter(x=>tmVisible().some(t=>t.pb===x.pb)).length;
  const tabs=`<div class="filters tm-tabs">${bt("thumuc","Thư mục")}${bt("dash","Bảng điều khiển")}${bt("find","Tìm file")}${bt("todo","Việc cần xử lý",td?` <span class="pill p-red" style="margin-left:4px">${td}</span>`:"")}${ceo?bt("rep","Báo cáo"):""}<span class="sp"></span>${ceo&&!adm?`<button class="btn sm" data-tmt="gan">Gán thư mục cho phòng ban</button>`:""}</div>`;
  let body;
  if(tab==="dash")body=tmDashView();
  else if(tab==="find")body=tmFindView();
  else if(tab==="todo")body=tmTodoView();
  else if(tab==="rep"&&ceo)body=tmRepView();
  else if(TM.file)body=tmFileView();
  else if(TM.pb&&tmVisible().some(t=>t.pb===TM.pb))body=tmFolderView();
  else body=tmCardsView();
  m.innerHTML=tmCss+head+tabs+`<div class="tm-wrap">${body}</div>`;
  tmBind(m);
}
function tmBind(m){
  const go=()=>{renderMain();scrollTo(0,0)};
  m.querySelectorAll("[data-tmt]").forEach(b=>b.onclick=()=>{TM.tab=b.dataset.tmt;TM.file=null;if(TM.tab==="thumuc"){TM.pb="";TM.sub=""}go()});
  m.querySelectorAll("[data-tmpb]").forEach(b=>b.onclick=()=>{TM.tab="thumuc";TM.pb=b.dataset.tmpb;TM.sub=b.dataset.tmsubgo||"";TM.inq="";TM.file=null;go()});
  m.querySelectorAll("[data-tmhome]").forEach(b=>b.onclick=()=>{TM.pb="";TM.sub="";TM.file=null;TM.inq="";go()});
  m.querySelectorAll("[data-tmsub]").forEach(b=>b.onclick=()=>{TM.sub=b.dataset.tmsub;TM.file=null;renderMain()});
  m.querySelectorAll("[data-tmfile]").forEach(b=>b.onclick=e=>{if(e.target.closest(".gd-dl"))return;const f=tmFindFile(b.dataset.tmfile);if(f){TM.tab="thumuc";TM.file=f;go()}});
  m.querySelectorAll("[data-tmtodo]").forEach(b=>b.onclick=()=>{TM.tab="thumuc";TM.pb=b.dataset.tmtodo;TM.sub=b.dataset.tmsubgo||"";TM.inq=b.dataset.tmq||"";TM.file=null;go()});
  m.querySelectorAll("[data-tmtt]").forEach(b=>b.onclick=()=>{TM.tt=b.dataset.tmtt;renderMain()});
  const bk=m.querySelector("#tm-back");if(bk)bk.onclick=()=>{TM.scope="";MOD="cv";PAGE="cv_pb";render()};
  const re=m.querySelector("#tm-re");if(re)re.onclick=()=>{tmLoadFiles(TM.pb,true);renderMain()};
  const cp=m.querySelector("#tm-cplink");if(cp)cp.onclick=()=>{const l=TM.file&&TM.file.link;try{navigator.clipboard.writeText(l).then(()=>toast("Đã chép link file"),()=>toast(l))}catch(e){toast(l)}};
  const keep=(id,set,delay)=>{const i=m.querySelector(id);if(!i)return;let t=0;i.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{set(i.value.trim());renderMain();const n=document.querySelector(id);if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},delay)}};
  keep("#tm-inq",v=>TM.inq=v,250);keep("#tm-q",v=>TM.q=v,400);
}

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
    try{await svApi("/api/drive/config",{method:"PUT",body:JSON.stringify({teams})});toast("Đã lưu thư mục các phòng");TM.teams=null;TM.ov=null;TM.fl={};await tmCfgLoad();tmTeams(true)}
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
