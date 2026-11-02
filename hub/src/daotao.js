/* =====================================================================
   ĐÀO TẠO & ONBOARDING (web vận hành › Đào tạo). Chị Hoa duyệt demo 02/11/2026 (Downloads\demo-dao-tao-onboarding.html).
   - Đào tạo của tôi: lộ trình Ngày 1 / Tuần 1 / Tháng 1, tài liệu bắt buộc chưa đọc, bấm "Tôi đã đọc và hiểu".
   - Thư viện: Chung (nội quy, quy chế) · Sổ tay web vận hành · Tài liệu team (chỉ team đó + quản lý + CEO/nhân sự).
   - Theo dõi nhân viên mới (quản lý thấy phòng mình, CEO/nhân sự thấy hết) · Soạn tài liệu · Ai xem được gì.
   Tài liệu soạn trên web HOẶC trong Google Docs (chị Hoa 02/11): dán link file, web đọc qua tài khoản máy (chỉ xem),
   chép nội dung về và tự lấy lại khi file trên Drive được sửa.
   Máy chủ: src/server/routes/daoTao.ts (quyền xem/soạn kiểm ở máy chủ, services/daoTao.ts). Trang chỉ vẽ.
   Nội dung tài liệu viết kiểu chữ thường có vài dấu: "# " tiêu đề, "## " tiêu đề nhỏ, "- " gạch đầu dòng, "1. " bước,
   "> " lưu ý, "**chữ đậm**", "[chữ](https://…)", "![mô tả](mã ảnh)",
   luồng việc: các dòng liền nhau "=> Ai làm | Việc gì | Ở trang nào" vẽ thành sơ đồ từng bước có mũi tên (chị Hoa 02/11: sổ tay phải có luồng + hình). dtMd() đổi sang HTML (đã thoát ký tự trước).
   ===================================================================== */
const DT={me:null,docs:null,acks:[],at:0,busy:false,err:"",cur:null,doc:{},road:"d1",f:"",q:"",edit:null,track:null,eds:null,ans:{}};
const DT_API="/api/hub/daotao";
const DT_NHOM={chung:"Chung — mọi nhân viên",web:"Sổ tay web vận hành",team:"Tài liệu team"};
const DT_BB={moi:"Bắt buộc với nhân viên mới",tat_ca:"Bắt buộc với mọi người",khong:"Không bắt buộc"};
const DT_LT={d1:"Ngày 1",w1:"Tuần 1",m1:"Tháng 1"};
const dtDep=k=>((DT.me&&DT.me.deps)||[]).find(d=>d.k===k)?.n||k;
const dtTeams=d=>(d.teams||[]).map(dtDep).join(", ");
const dtDay=s=>s?String(s).slice(0,10).split("-").reverse().join("/"):"";
const dtTime=s=>{if(!s)return "";const d=new Date(s);return isNaN(d)?dtDay(s):d.toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric"})};
/* Dòng "Cập nhật … bởi … · Duyệt … bởi …" (chị Hoa 02/11: phải thấy lần cập nhật và lần duyệt mới nhất). */
const dtStamp=d=>`Cập nhật ${dtTime(d.updated_at)}${d.updated_by_name?" bởi "+esc(d.updated_by_name):""} · `+(d.approved_at?`Duyệt ${dtTime(d.approved_at)}${d.approved_by_name?" bởi "+esc(d.approved_by_name):""}`:"<b>Chưa duyệt</b>");
const dtAck=id=>DT.acks.find(a=>a.doc_id===id);
/* Đã đọc bản hiện tại chưa; đã đọc bản cũ = phải đọc lại. */
const dtDone=d=>{const a=dtAck(d.id);return !!a&&a.version>=d.version};
const dtOld=d=>{const a=dtAck(d.id);return !!a&&a.version<d.version};
const dtNewbie=()=>!!(DT.me&&DT.me.newbie&&!DT.me.newbie.done_at);
const dtReq=d=>d.status==="dang"&&(d.bat_buoc==="tat_ca"||(d.bat_buoc==="moi"&&dtNewbie()));
const dtPub=()=>(DT.docs||[]).filter(d=>d.status==="dang");

async function dtLoad(force){
  if(DT.busy||!ME||typeof svApi!=="function")return;if(!force&&DT.at&&Date.now()-DT.at<60000)return;
  DT.busy=true;
  try{const [me,L]=await Promise.all([svApi(DT_API+"/me"),svApi(DT_API+"/docs")]);DT.me=me;DT.docs=L.docs||[];DT.acks=L.acks||[];DT.err=""}
  catch(e){DT.err=e.message||"Không tải được";if(!DT.docs)DT.docs=[]}
  DT.busy=false;DT.at=Date.now();if(String(PAGE).startsWith("dt_"))renderMain()}
/* Đọc tài liệu trong cửa sổ nổi trên trang đang xem, không chuyển trang (chị Hoa 02/11). */
async function dtOpen(id){if(DT.cur!==id)DT.pv=false;DT.cur=id;dtModal();
  try{DT.doc[id]=await svApi(DT_API+"/docs/"+id)}catch(e){DT.doc[id]={err:e.message||"Không mở được tài liệu"}}if(DT.cur===id)dtModal()}
function dtClose(){DT.cur=null;const w=document.getElementById("dt-modal");if(w)w.remove();document.body.style.overflow=""}
function dtModal(){let w=document.getElementById("dt-modal");if(!DT.cur){dtClose();return}
  if(!w){w=document.createElement("div");w.id="dt-modal";w.innerHTML=`<div class="dt-box" role="dialog" aria-modal="true"></div>`;
    w.style.cssText="position:fixed;inset:0;z-index:80;background:rgba(16,24,40,.45);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto";
    const b=w.firstChild;b.style.cssText="background:var(--canvas,#f6f7fb);border-radius:16px;box-shadow:0 20px 60px rgba(16,24,40,.3);width:min(1120px,100%);padding:16px 18px;margin-bottom:4vh";
    w.addEventListener("mousedown",e=>{if(e.target===w)dtClose()});document.body.appendChild(w);document.body.style.overflow="hidden"}
  pDtRead(w.firstChild)}
addEventListener("keydown",e=>{if(e.key==="Escape"&&DT.cur)dtClose()});
const dtSize=n=>n>=1e6?(n/1e6).toLocaleString("vi-VN",{maximumFractionDigits:1})+" MB":Math.max(1,Math.round(n/1e3))+" KB";
const dtFileIc=f=>/folder/.test(f.mime||"")?"📁":/spreadsheet|sheet|excel/.test(f.mime||"")?"📗":/presentation|powerpoint/.test(f.mime||"")?"📙":/document|word/.test(f.mime||"")?"📘":!f.mime&&f.url?"🔗":/pdf/.test(f.mime)?"📕":/word/.test(f.mime)?"📘":/sheet|excel/.test(f.mime)?"📗":/presentation|powerpoint/.test(f.mime)?"📙":/image/.test(f.mime)?"🖼":"📄";
const dtFileUrl=(f,tai)=>f.url||DT_API+"/file/"+f.id+(tai?"?tai=1":"");
/* Link Drive xem ngay trong tài liệu: Google Docs/Sheets/Slides và file Drive có trang /preview (người đọc phải có quyền xem trên Drive). */
const dtPreview=u=>{const m=String(u||"").match(/^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([\w-]+)/);if(m)return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  const f=String(u||"").match(/^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);return f?`https://drive.google.com/file/d/${f[1]}/preview`:""};
/* In / lưu PDF: mở bản in gọn của tài liệu đang đọc. */
function dtPrint(d){const w=window.open("","_blank");if(!w){toast("Trình duyệt chặn cửa sổ in, cho phép rồi bấm lại");return}
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>body{font-family:system-ui,"Segoe UI",sans-serif;max-width:820px;margin:24px auto;padding:0 16px;line-height:1.6;color:#1c1f33}img{max-width:100%}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}.dt-flow{display:flex;flex-wrap:wrap;gap:6px}.dt-fs{border:1px solid #ccc;border-radius:8px;padding:6px 8px;flex:1 1 140px;font-size:13px}.dt-fs small{display:block;color:#666}.dt-fn,.dt-fa{display:none}.dt-fr{font-size:11px;font-weight:700;display:block}.dt-tip{background:#eef4ff;padding:8px 12px;border-radius:8px}.dt-num{font-weight:700;margin-right:6px}.dt-step{display:flex}</style></head><body><h1>${esc(d.title)}</h1>${d.summary?`<p><i>${esc(d.summary)}</i></p>`:""}${dtMd(d.body)}<p style="color:#888;font-size:12px">AILLA · bản ${d.version} · in ngày ${new Date().toLocaleDateString("vi-VN")}</p></body></html>`);
  w.document.close();setTimeout(()=>w.print(),400)}
function dtGo(p){dtClose();PAGE=p;MOD="dt";render();scrollTo(0,0)}

/* ---------- chữ → HTML (thoát ký tự trước, chỉ cho vài dấu đơn giản) ---------- */
function dtInline(s){
  return esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(m,t,u)=>`<a href="${u}" target="_blank" rel="noopener">${t}</a>`)}
function dtImgSrc(s){s=String(s||"").trim();if(/^[0-9a-f-]{36}$/i.test(s))return DT_API+"/img/"+s;if(/^\/daotao\/[\w.-]+\.(png|jpe?g|webp)$/i.test(s))return s;if(/^https:\/\/[^\s"'<>]+$/.test(s))return s;return ""}
function dtMd(text){
  const out=[],L=String(text||"").replace(/\r/g,"").split("\n");let ul=false,para=[],h=0;
  const flush=()=>{if(para.length){out.push(`<p>${para.map(dtInline).join("<br>")}</p>`);para=[]}if(ul){out.push("</ul>");ul=false}};
  let fl=null;const flEnd=()=>{if(fl){out.push(`<div class="dt-flow">${fl.map((r,i)=>`${i?'<span class="dt-fa">➜</span>':""}<div class="dt-fs" style="--c:${dtRoleC(r[0])}"><span class="dt-fn">${i+1}</span><span class="dt-fr">${esc(r[0])}</span><b>${dtInline(r[1]||"")}</b>${r[2]?`<small>${dtInline(r[2])}</small>`:""}</div>`).join("")}</div>`);fl=null}};
  let tb=null;const tbEnd=()=>{if(tb){out.push(`<div class="tbl"><table>${tb.map((r,i)=>`<tr>${r.map(c=>i?`<td>${dtInline(c)}</td>`:`<th>${dtInline(c)}</th>`).join("")}</tr>`).join("")}</table></div>`);tb=null}};
  for(const raw of L){const t=raw.trim();let m;
    if(t.startsWith("=>")){flush();tbEnd();(fl=fl||[]).push(t.slice(2).split("|").map(c=>c.trim()));continue}
    flEnd();
    if(t.startsWith("|")&&t.endsWith("|")){flush();if(/^\|[\s:|-]+\|$/.test(t))continue;(tb=tb||[]).push(t.slice(1,-1).split("|").map(c=>c.trim()));continue}
    tbEnd();
    if(!t){flush();continue}
    if((m=t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))){flush();const src=dtImgSrc(m[2]);out.push(src?`<figure class="dt-fig"><img src="${esc(src)}" alt="${esc(m[1])}" loading="lazy">${m[1]?`<figcaption>${esc(m[1])}</figcaption>`:""}</figure>`:"");continue}
    if((m=t.match(/^(#{1,2})\s+(.+)$/))){flush();const tag=m[1].length===1?"h2":"h3";out.push(`<${tag} id="dth${h++}">${dtInline(m[2])}</${tag}>`);continue}
    if(t==="---"){flush();out.push("<hr>");continue}
    if((m=t.match(/^>\s?(.*)$/))){flush();out.push(`<div class="dt-tip">💡 ${dtInline(m[1])}</div>`);continue}
    if((m=t.match(/^(\d+)[.)]\s+(.+)$/))){flush();out.push(`<p class="dt-step"><span class="dt-num">${m[1]}</span><span>${dtInline(m[2])}</span></p>`);continue}
    if((m=t.match(/^[-*•]\s+(.+)$/))){if(para.length){out.push(`<p>${para.map(dtInline).join("<br>")}</p>`);para=[]}if(!ul){out.push("<ul>");ul=true}out.push(`<li>${dtInline(m[1])}</li>`);continue}
    if(ul){out.push("</ul>");ul=false}para.push(t)}
  flush();tbEnd();flEnd();return out.join("")}
/* Mỗi vai một màu cố định trong sơ đồ luồng. */
const DT_RC=["#4b54d1","#e7357b","#087a55","#b54708","#175cd3","#6941c6","#0e7490"];
const dtRoleC=r=>{let h=0;for(const ch of String(r||""))h=(h*31+ch.charCodeAt(0))>>>0;return DT_RC[h%DT_RC.length]};
/* Ô soạn hiện đúng định dạng (chị Hoa 02/11: không muốn thấy ký hiệu #, **, |). Lưu vẫn bằng kiểu chữ cũ để trang đọc,
   Google Docs, migration dùng chung. Sơ đồ luồng, bảng, ảnh là khối khóa (giữ nguyên chữ gốc trong data-md); sửa chúng ở "Sửa dạng chữ". */
function dtMdEdit(text){
  const L=String(text||"").replace(/\r/g,"").split("\n"),out=[];let i=0;
  const lock=(raw,html)=>`<div class="dt-lock" contenteditable="false" data-md="${esc(raw)}">${html}</div>`;
  while(i<L.length){const t=L[i].trim();let m;
    if(!t){i++;continue}
    if(t.startsWith("=>")||(t.startsWith("|")&&t.endsWith("|"))){const k=t.startsWith("=>")?(x=>x.startsWith("=>")):(x=>x.startsWith("|")&&x.endsWith("|"));const raw=[];while(i<L.length&&k(L[i].trim())){raw.push(L[i].trim());i++}out.push(lock(raw.join("\n"),dtMd(raw.join("\n"))));continue}
    if(/^!\[[^\]]*\]\([^)]+\)$/.test(t)){out.push(lock(t,dtMd(t)));i++;continue}
    if((m=t.match(/^(#{1,2})\s+(.+)$/))){out.push(`<${m[1].length===1?"h2":"h3"}>${dtInline(m[2])}</${m[1].length===1?"h2":"h3"}>`);i++;continue}
    if(t==="---"){out.push("<hr>");i++;continue}
    if(t.startsWith(">")){out.push(`<blockquote>${dtInline(t.replace(/^>\s?/,""))}</blockquote>`);i++;continue}
    if(/^\d+[.)]\s+/.test(t)){const li=[];while(i<L.length&&/^\d+[.)]\s+/.test(L[i].trim())){li.push(`<li>${dtInline(L[i].trim().replace(/^\d+[.)]\s+/,""))}</li>`);i++}out.push(`<ol>${li.join("")}</ol>`);continue}
    if(/^[-*•]\s+/.test(t)){const li=[];while(i<L.length&&/^[-*•]\s+/.test(L[i].trim())){li.push(`<li>${dtInline(L[i].trim().replace(/^[-*•]\s+/,""))}</li>`);i++}out.push(`<ul>${li.join("")}</ul>`);continue}
    const pl=[];while(i<L.length&&L[i].trim()&&!/^(#{1,2}\s|=>|\||!\[|>|---$|\d+[.)]\s|[-*•]\s)/.test(L[i].trim())){pl.push(dtInline(L[i].trim()));i++}
    if(pl.length)out.push(`<p>${pl.join("<br>")}</p>`);else i++}
  return out.join("")||"<p><br></p>"}
function dtHtmlToMd(root){
  const inl=n=>{let s="";n.childNodes.forEach(c=>{if(c.nodeType===3){s+=c.nodeValue.replace(/\s+/g," ");return}if(c.nodeType!==1)return;const tg=c.tagName;
      if(tg==="BR"){s+="\n";return}const x=inl(c);
      if(tg==="B"||tg==="STRONG"||/font-weight:\s*(bold|[6-9]00)/.test(c.getAttribute("style")||"")){s+=x.trim()?`**${x.trim()}**`:x;return}
      if(tg==="A"&&/^https?:/.test(c.getAttribute("href")||"")){s+=`[${x.trim()}](${c.getAttribute("href")})`;return}s+=x});return s};
  const out=[],line=t=>t.split("\n").map(x=>x.trim()).filter(Boolean).join("\n");
  const walk=parent=>parent.childNodes.forEach(n=>{
    if(n.nodeType===3){const t=n.nodeValue.trim();if(t)out.push(t);return}if(n.nodeType!==1)return;
    if(n.dataset&&n.dataset.md!=null){out.push(n.dataset.md);return}
    const tg=n.tagName;
    if(tg==="H1"||tg==="H2"){const t=inl(n).trim();if(t)out.push("# "+t.replace(/\n/g," "));return}
    if(/^H[3-6]$/.test(tg)){const t=inl(n).trim();if(t)out.push("## "+t.replace(/\n/g," "));return}
    if(tg==="UL"||tg==="OL"){const L=[...n.children].filter(x=>x.tagName==="LI").map((li,k)=>(tg==="OL"?(k+1)+". ":"- ")+inl(li).trim().replace(/\n/g," ")).filter(x=>!/^(\d+\. |- )$/.test(x));if(L.length)out.push(L.join("\n"));return}
    if(tg==="BLOCKQUOTE"){const t=inl(n).trim();if(t)out.push("> "+t.replace(/\n/g," "));return}
    if(tg==="HR"){out.push("---");return}
    if(tg==="TABLE"){const R=[...n.querySelectorAll("tr")].map(tr=>"| "+[...tr.children].map(td=>inl(td).trim().replace(/\|/g,"/").replace(/\n/g," ")).join(" | ")+" |");if(R.length){R.splice(1,0,"|"+R[0].split("|").slice(1,-1).map(()=>"---").join("|")+"|");out.push(R.join("\n"))}return}
    if(tg==="IMG"){const src=n.getAttribute("src")||"",id=(src.match(/\/img\/([0-9a-f-]{36})/)||[])[1];if(id)out.push(`![${n.alt||""}](${id})`);return}
    if(tg==="DIV"&&n.querySelector("p,h1,h2,h3,ul,ol,blockquote,table,div")){walk(n);return}
    const t=line(inl(n));if(t)out.push(t)});
  walk(root);return out.join("\n\n").replace(/\n{3,}/g,"\n\n").trim()}
const dtToc=text=>String(text||"").split("\n").map(x=>x.trim().match(/^(#{1,2})\s+(.+)$/)).filter(Boolean).map((m,i)=>`<a href="#dth${i}" class="${m[1].length===2?"sub":""}">${esc(m[2].replace(/\*\*/g,""))}</a>`).join("");

/* Câu kiểm tra soạn bằng chữ: "? câu hỏi" rồi các dòng "* đáp án đúng" / "- đáp án sai". */
function dtQuizParse(t){const Q=[];let cur=null;
  for(const raw of String(t||"").split("\n")){const s=raw.trim();if(!s)continue;
    if(s.startsWith("?")){cur={q:s.slice(1).trim(),o:[],a:-1};Q.push(cur);continue}
    if(!cur)return {err:"Mỗi câu bắt đầu bằng dấu ? ở đầu dòng"};
    if(s.startsWith("*")){cur.a=cur.o.length;cur.o.push(s.slice(1).trim())}else if(s.startsWith("-"))cur.o.push(s.slice(1).trim());else return {err:"Đáp án bắt đầu bằng * (đúng) hoặc - (sai): "+s}}
  for(const q of Q){if(q.o.length<2)return {err:"Câu \""+q.q+"\" cần ít nhất 2 đáp án"};if(q.a<0)return {err:"Câu \""+q.q+"\" chưa đánh dấu * đáp án đúng"}}
  return {quiz:Q}}
const dtQuizText=Q=>(Q||[]).map(q=>"? "+q.q+"\n"+q.o.map((o,i)=>(i===q.a?"* ":"- ")+o).join("\n")).join("\n\n");

/* ---------- khung chung ---------- */
const DT_CSS=`<style>
.dt-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}
.dt-bar{height:8px;background:var(--gray-soft,#f2f4f7);border-radius:99px;overflow:hidden;margin-top:6px}.dt-bar i{display:block;height:100%;background:#4b54d1;border-radius:99px}.dt-bar.red i{background:var(--red,#b42318)}
.dt-item{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer}.dt-item:last-child{border-bottom:0}.dt-item:hover b{color:#4b54d1}
.dt-item .t{flex:1;min-width:0}.dt-item .t small{display:block;color:var(--muted);font-size:13px}.dt-ck{width:22px;height:22px;border-radius:50%;border:2px solid #c5cad8;flex:none;margin-top:1px;display:grid;place-items:center;font-size:13px;color:#fff}.dt-ck.on{background:var(--green,#087a55);border-color:var(--green,#087a55)}
.dt-doc{max-width:860px;font-size:15px;line-height:1.65}.dt-doc h2{font-size:18px;margin:22px 0 6px}.dt-doc h3{font-size:16px;margin:16px 0 4px}.dt-doc ul{padding-left:22px;margin:6px 0}.dt-doc p{margin:8px 0}
.dt-doc code{background:var(--gray-soft,#f2f4f7);padding:1px 6px;border-radius:6px;font-size:13.5px}
.dt-step{display:flex;gap:10px;align-items:flex-start}.dt-num{display:inline-grid;place-items:center;min-width:24px;height:24px;border-radius:50%;background:var(--pink,#e7357b);color:#fff;font-size:12.5px;font-weight:700;margin-top:1px}
.dt-tip{background:var(--blue-soft,#eef4ff);color:#1b3d8a;border-radius:12px;padding:10px 14px;margin:10px 0}
.dt-flow{display:flex;flex-wrap:wrap;align-items:stretch;gap:6px;margin:12px 0 16px}.dt-fs{flex:1 1 150px;max-width:220px;border:1px solid var(--line);border-top:4px solid var(--c);border-radius:12px;background:#fff;padding:8px 10px 10px;position:relative;font-size:13.5px;line-height:1.4}
.dt-fs b{display:block;margin-top:2px}.dt-fs small{display:block;color:var(--muted);font-size:12px;margin-top:3px}.dt-fr{font-size:11.5px;font-weight:700;color:var(--c);text-transform:uppercase;letter-spacing:.03em}.dt-fn{position:absolute;top:6px;right:8px;width:20px;height:20px;border-radius:50%;background:var(--c);color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center}
.dt-fa{align-self:center;color:#98a2b3;font-size:18px}
@media(max-width:700px){.dt-flow{flex-direction:column}.dt-fs{max-width:none}.dt-fa{transform:rotate(90deg);align-self:center}}
.dt-fig{margin:12px 0}.dt-fig img{max-width:100%;border:1px solid var(--line);border-radius:10px}.dt-fig figcaption{font-size:13px;color:var(--muted)}
.dt-read{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start}.dt-toc{position:sticky;top:0}.dt-toc a{display:block;color:var(--ink);text-decoration:none;padding:4px 8px;border-radius:8px;font-size:13.5px}.dt-toc a.sub{padding-left:20px;color:var(--muted)}.dt-toc a:hover{background:var(--gray-soft,#f2f4f7)}
.dt-ok{background:var(--green-soft,#e8f8f0);border:1px solid #9ee0c2;border-radius:12px;padding:14px 16px;margin-top:18px}
.dt-quiz label{display:block;padding:6px 10px;border:1px solid var(--line);border-radius:10px;margin:5px 0;cursor:pointer;font-size:14px}.dt-quiz label input{width:auto;margin-right:8px}
.dt-chips{display:flex;gap:6px;flex-wrap:wrap}
.dt-vis{min-height:420px;max-height:70vh;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:14px 18px;background:#fff;outline:none}.dt-vis:focus{border-color:#4b54d1}
.dt-vis h2{font-size:18px;margin:16px 0 6px}.dt-vis h3{font-size:16px;margin:12px 0 4px}.dt-vis blockquote{background:var(--blue-soft,#eef4ff);color:#1b3d8a;border-radius:12px;padding:10px 14px;margin:10px 0}.dt-vis blockquote::before{content:"💡 "}
.dt-vis ol,.dt-vis ul{padding-left:24px}.dt-vis ol li::marker{color:var(--pink,#e7357b);font-weight:700}.dt-lock{position:relative;margin:8px 0;border:1px dashed #c5cad8;border-radius:12px;padding:2px 8px;cursor:default;user-select:none}.dt-lock::after{content:"khối cố định · sửa ở chế độ Sửa dạng chữ";position:absolute;right:8px;top:-9px;font-size:11px;background:#fff;color:var(--muted);padding:0 6px}
.dt-ed textarea{font-family:var(--fm,monospace);font-size:13.5px;line-height:1.5}.dt-tb{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}
.dt-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.dt-cols>.card{margin:0}
@media(max-width:900px){.dt-read,.dt-cols{grid-template-columns:1fr}.dt-toc{position:static}}
</style>`;
const dtCk=on=>`<span class="dt-ck${on?" on":""}">${on?"✓":""}</span>`;
function dtItem(d,sub){const done=dtDone(d),old=dtOld(d);
  const tag=d.status!=="dang"?pill(d.status==="cho_duyet"?"Chờ CEO duyệt":"Nháp","amb"):d.has_pending&&DT.me&&DT.me.ceo?pill("Có bản sửa chờ duyệt","amb"):done?pill("Đã hiểu","grn"):old?pill("Có bản mới, đọc lại","amb"):dtReq(d)?pill("Bắt buộc","red"):"";
  return `<div class="dt-item" data-dtopen="${esc(d.id)}">${dtCk(done)}<div class="t"><b>${esc(d.title)}</b><small>${esc(sub!=null?sub:(d.summary||DT_NHOM[d.nhom]||""))}</small></div>${tag}</div>`}
function dtWire(m){
  m.querySelectorAll("[data-dtnew]").forEach(b=>b.onclick=dtNewChoose);
  m.querySelectorAll("[data-dtopen]").forEach(b=>b.onclick=()=>dtOpen(b.dataset.dtopen));
  m.querySelectorAll("[data-dtgo]").forEach(b=>b.onclick=()=>dtGo(b.dataset.dtgo))}
function dtWait(m,t){m.innerHTML=H(t,"Đang tải…");dtLoad()}

/* ---------- Đào tạo của tôi ---------- */
function pDtHome(m){
  if(!DT.docs)return dtWait(m,"Đào tạo của tôi");dtLoad();
  const P=dtPub(),road=P.filter(d=>d.lo_trinh),req=P.filter(dtReq),todo=req.filter(d=>!dtDone(d)),old=P.filter(dtOld),me=DT.me||{},nb=me.newbie;
  const pct=road.length?Math.round(road.filter(dtDone).length/road.length*100):0;
  const pend=(DT.docs||[]).filter(d=>d.status==="cho_duyet"||d.has_pending);
  const lt=road.filter(d=>d.lo_trinh===DT.road);
  m.innerHTML=DT_CSS+(me.editor?`<div style="float:right;margin-top:-4px"><button class="btn pri" data-dtnew="1">＋ Tạo tài liệu</button></div>`:"")+H("Đào tạo của tôi",nb?`Vào làm ${dtDay(nb.start_date)}${nb.done_at?" · đã xong onboarding":" · đang trong lộ trình nhân viên mới"}`:"Tài liệu công ty, sổ tay dùng web và tài liệu của team bạn")+
  (DT.err?`<div class="note red">${esc(DT.err)}</div>`:"")+
  (me.ceo&&pend.length?`<div class="warn">Có <b>${pend.length}</b> tài liệu đang chờ chị duyệt: ${pend.map(d=>`<a href="#" data-dtopen="${esc(d.id)}">${esc(d.title)}</a>`).join(", ")}</div>`:"")+
  `<div class="dt-kpis">
    <div class="kpi"><div class="l">Lộ trình onboarding</div><div class="v">${pct}%</div><div class="dt-bar"><i style="width:${pct}%"></i></div></div>
    <div class="kpi"><div class="l">Bắt buộc chưa đọc</div><div class="v${todo.length?" t-red":""}">${todo.length}</div><div class="h">trên ${req.length} tài liệu bắt buộc</div></div>
    <div class="kpi"><div class="l">Đã xác nhận hiểu</div><div class="v">${P.filter(dtDone).length}</div><div class="h">tài liệu</div></div>
    <div class="kpi"><div class="l">Có bản mới cần đọc lại</div><div class="v${old.length?" t-amb":""}">${old.length}</div><div class="h">${old.length?esc(old.map(d=>d.title).join(", ")):"không có"}</div></div></div>
  <div class="grid cols2">
    <section class="card"><div class="card-h"><h2>Lộ trình nhân viên mới</h2></div>
      <div class="dt-chips" style="margin-bottom:6px">${Object.entries(DT_LT).map(([k,n])=>`<button class="btn sm${DT.road===k?" pri":""}" data-dtroad="${k}">${n} <b>${road.filter(d=>d.lo_trinh===k&&dtDone(d)).length}/${road.filter(d=>d.lo_trinh===k).length}</b></button>`).join("")}</div>
      ${lt.length?lt.map(d=>dtItem(d)).join(""):`<p class="empty">Chưa có tài liệu nào xếp vào ${DT_LT[DT.road]}.</p>`}</section>
    <div><section class="card"><div class="card-h"><h2>Cần đọc</h2><span class="hint">bắt buộc và chưa xác nhận, hạn gần nhất ở trên</span></div>
      ${todo.concat(old.filter(d=>!todo.includes(d))).map(d=>dtItem(d,(d.summary||DT_NHOM[d.nhom])+(dtNewbie()&&nb&&d.bat_buoc==="moi"?" · hạn "+dtDay(dtDue(nb.start_date,d.han_ngay)):""))).join("")||`<p class="empty">Bạn đã đọc hết tài liệu bắt buộc. 👏</p>`}</section>
      <section class="card"><h2>Có thắc mắc?</h2><p class="hint" style="margin:6px 0 0">Mở tài liệu, kéo xuống cuối bấm <b>Hỏi người soạn</b>. Câu trả lời hiện ngay dưới tài liệu đó.${nb&&nb.mentor_id?` Người kèm của bạn: <b>${esc(nb.mentor_id)}</b>.`:""}</p>
      <div class="acts" style="margin-top:10px"><button class="btn" data-dtgo="dt_lib">Mở thư viện tài liệu</button></div></section></div></div>`;
  m.querySelectorAll("[data-dtroad]").forEach(b=>b.onclick=()=>{DT.road=b.dataset.dtroad;renderMain()});
  dtWire(m);m.querySelectorAll("a[data-dtopen]").forEach(a=>a.addEventListener("click",e=>e.preventDefault()))}
const dtDue=(start,days)=>{const t=new Date(start+"T00:00:00");t.setDate(t.getDate()+(+days||7));return t.toISOString().slice(0,10)};

/* ---------- Thư viện ---------- */
function pDtLib(m){
  if(!DT.docs)return dtWait(m,"Thư viện tài liệu");dtLoad();
  const q=DT.q.toLowerCase(),f=DT.f;
  const L=dtPub().filter(d=>(!q||(d.title+" "+d.summary).toLowerCase().includes(q))&&(!f||(f==="req"?dtReq(d):d.nhom===f)));
  const box=(t,arr,empty)=>`<section class="card"><div class="card-h"><h2>${t}</h2><span class="hint">${arr.length}</span></div>${arr.map(d=>dtItem(d)).join("")||`<p class="empty">${empty}</p>`}</section>`;
  const team=L.filter(d=>d.nhom==="team"),byT={};team.forEach(d=>(d.teams.length?d.teams:["?"]).forEach(t=>(byT[t]=byT[t]||[]).push(d)));
  m.innerHTML=DT_CSS+H("Thư viện tài liệu","Chỉ tài liệu chuẩn đã duyệt: nội quy, quy trình, hướng dẫn. File làm việc hằng ngày của team xem ở Thư mục làm việc.")+
  `<div class="filters"><input id="dt-q" placeholder="Tìm tài liệu…" value="${esc(DT.q)}" style="max-width:300px">
   ${[["","Tất cả"],["chung","Chung"],["web","Sổ tay web"],["team","Team"],["req","Bắt buộc"]].map(([k,n])=>`<button class="btn sm${f===k?" pri":""}" data-dtf="${k}">${n}</button>`).join(" ")}
   <span class="sp"></span>${PAGES.thumuc?`<button class="btn sm" id="dt-tm">📁 Thư mục làm việc của team →</button>`:""}${DT.me&&DT.me.editor?` <button class="btn sm pri" data-dtnew="1">＋ Tạo tài liệu</button>`:""}</div>
  <div class="dt-cols">${box("🏢 Chung — mọi nhân viên",L.filter(d=>d.nhom==="chung"),"Chưa có tài liệu chung.")}
   ${box("🧭 Sổ tay web vận hành",L.filter(d=>d.nhom==="web"),"Chưa có trang sổ tay nào.")}
   <section class="card"><div class="card-h"><h2>👥 Tài liệu theo team</h2><span class="hint">${team.length}</span></div>
     ${Object.keys(byT).length?Object.entries(byT).map(([t,arr])=>`<h3 style="margin:10px 0 2px">${esc(dtDep(t))}</h3>`+arr.map(d=>dtItem(d)).join("")).join(""):`<p class="empty">Team của bạn chưa có tài liệu riêng.</p>`}</section></div>`;
  const qi=m.querySelector("#dt-q");qi.onkeydown=e=>{if(e.key==="Enter"){DT.q=qi.value.trim();renderMain()}};qi.onchange=()=>{DT.q=qi.value.trim();renderMain()};
  m.querySelectorAll("[data-dtf]").forEach(b=>b.onclick=()=>{DT.f=b.dataset.dtf;renderMain()});
  /* File làm việc hằng ngày không đưa vào thư viện (chị Hoa 02/11): dẫn sang trang Thư mục làm việc (thumuc.js). */
  const tm=m.querySelector("#dt-tm");if(tm)tm.onclick=()=>{dtClose();MOD="tm";PAGE="thumuc";render();scrollTo(0,0)};dtWire(m)}

/* ---------- Đọc một tài liệu (vẽ vào cửa sổ nổi dtModal) ---------- */
function pDtRead(m){
  const id=DT.cur,d=DT.doc[id];
  const back=`<button class="btn sm" id="dt-back">✕ Đóng</button>`;
  if(!d){m.innerHTML=DT_CSS+back+H("Đang mở tài liệu…","");m.querySelector("#dt-back").onclick=dtClose;return}
  if(d.err){m.innerHTML=DT_CSS+back+`<div class="note red" style="margin-top:12px">${esc(d.err)}</div>`;m.querySelector("#dt-back").onclick=dtClose;return}
  if(d.pending&&DT.pv){const P=d.pending;d={...d,title:P.title,summary:P.summary,body:P.body,files:P.files||[],quiz:P.quiz||[]}}
  const done=d.ack&&d.ack.version>=d.version,old=d.ack&&d.ack.version<d.version,ceo=DT.me&&DT.me.ceo;
  const A=DT.ans[id]||(DT.ans[id]=[]);
  const quiz=d.quiz&&d.quiz.length&&!done?`<div class="card dt-quiz" style="box-shadow:none;margin-top:18px"><b>Kiểm tra nhanh (${d.quiz.length} câu, đúng 80% là đạt)</b>
    ${d.quiz.map((q,i)=>`<div style="margin-top:10px"><b style="font-size:14px">${i+1}. ${esc(q.q)}</b>${q.o.map((o,j)=>`<label><input type="radio" name="dtq${i}" value="${j}" data-dtq="${i}"${A[i]===j?" checked":""}>${esc(o)}</label>`).join("")}</div>`).join("")}</div>`:"";
  const ackBox=d.status!=="dang"?`<div class="warn" style="margin-top:18px">${d.status==="cho_duyet"?"Tài liệu đang chờ CEO duyệt, chưa hiện cho mọi người.":"Bản nháp — chưa hiện cho ai ngoài người soạn."}${ceo&&d.status==="cho_duyet"?` <button class="btn pri sm" id="dt-appr">Duyệt, cho hiện</button> <button class="btn sm danger" id="dt-rej">Trả lại</button>`:""}${d.can_edit?` <button class="btn sm" data-dted2="1">✎ Sửa tài liệu</button>`:""}</div>`
    :done?`<div class="dt-ok"><b>✓ Bạn đã xác nhận đọc và hiểu</b> — ${new Date(d.ack.at).toLocaleString("vi-VN")}${d.ack.score!=null?` · đúng ${d.ack.score}/${d.quiz.length} câu`:""}</div>`
    :`<div class="dt-ok"><b>${old?"Tài liệu có bản mới — bạn đọc lại giúp nhé.":"Bạn đã đọc hết?"}</b><p class="hint" style="margin:4px 0 10px">Bấm xác nhận để web ghi lại ngày giờ. Khi tài liệu sửa sang bản mới, web sẽ nhờ bạn đọc lại.</p>
      <button class="btn pri" id="dt-ack">${d.nhom==="web"?"Tôi đã đọc và làm thử được":"Tôi đã đọc và hiểu"}</button> <span class="hint" id="dt-ackm"></span></div>`;
  const hoi=`<section class="card" style="box-shadow:none;margin-top:18px"><h3>Hỏi người soạn</h3>
    ${(d.hoi||[]).map(h=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div>❓ ${esc(h.text)} <span class="hint">· ${dtDay(h.created_at)}</span></div>
      ${h.answer?`<div style="margin-top:4px">💬 ${esc(h.answer)}</div>`:d.can_edit?`<div class="acts" style="margin-top:6px"><input placeholder="Trả lời…" data-dthoi-in="${esc(h.id)}"><button class="btn sm" data-dthoi="${esc(h.id)}">Gửi</button></div>`:`<div class="hint">Đang chờ trả lời</div>`}</div>`).join("")}
    <div class="acts" style="margin-top:8px"><input id="dt-ask" placeholder="Chỗ nào chưa rõ, gõ vào đây…"><button class="btn sm" id="dt-askb">Gửi câu hỏi</button></div></section>`;
  const toc=dtToc(d.body);
  m.innerHTML=DT_CSS+`<div class="acts" style="margin:-16px -18px 10px;padding:10px 18px;justify-content:space-between;display:flex;position:sticky;top:0;z-index:3;background:var(--canvas,#f6f7fb);border-radius:16px 16px 0 0">${back}<span><button class="btn sm" id="dt-print">🖨 In / lưu PDF</button>${d.can_edit?` <button class="btn sm" id="dt-edit">✎ Sửa tài liệu</button>`:""}</span></div>
  <div class="${toc?"dt-read":""}">${toc?`<nav class="card dt-toc"><b class="hint">MỤC LỤC</b>${toc}</nav>`:""}
  <article class="card"><div class="dt-chips" style="margin-bottom:8px">${pill(DT_NHOM[d.nhom]+(d.nhom==="team"?": "+dtTeams(d):""),"vio")}${d.bat_buoc!=="khong"?pill(DT_BB[d.bat_buoc],"red"):""}${d.lo_trinh?pill("Lộ trình "+DT_LT[d.lo_trinh],"blu"):""}${pill("Bản "+d.version,"gry")}${d.drive_id?pill("📄 Soạn trong Google Docs","blu"):""}</div>
   ${d.drive_id?`<p class="hint" style="margin:0 0 8px">Nội dung lấy từ Google Drive${d.drive_mod?", bản sửa lúc "+new Date(d.drive_mod).toLocaleString("vi-VN"):""}. Web tự cập nhật khi file trên Drive được sửa.${d.can_edit?` <a href="https://docs.google.com/document/d/${esc(d.drive_id)}/edit" target="_blank" rel="noopener">Sửa trong Google Docs ↗</a>`:""}</p>`:""}
   <p class="hint" style="margin:0 0 8px">${dtStamp(d)}</p>
   ${d.review_note&&d.can_edit?`<div class="warn">Chị Hoa trả lại: ${esc(d.review_note)}</div>`:""}
   ${d.pending?`<div class="warn">Có <b>bản sửa chờ duyệt</b> của ${esc(d.pending_by_name||"người soạn")} lúc ${dtTime(d.pending_at)} — mọi người vẫn đang đọc bản đã duyệt.
     <button class="btn sm" id="dt-pvw">${DT.pv?"Xem bản đang hiện":"Xem bản sửa"}</button>${ceo?` <button class="btn pri sm" id="dt-appr2">Duyệt bản sửa</button> <button class="btn sm danger" id="dt-rej">Trả lại</button>`:""}</div>`:""}
   <div class="dt-doc"><h1 style="font-size:24px;margin:0 0 6px">${esc(d.title)}</h1>${d.summary?`<p class="hint" style="font-size:14.5px">${esc(d.summary)}</p>`:""}${dtMd(d.body)}</div>
   ${(d.files||[]).length?`<section style="margin-top:16px"><h3>📎 Tệp đính kèm</h3>${d.files.map((f,i)=>`<div class="dt-item" style="cursor:default"><span style="font-size:22px">${dtFileIc(f)}</span><div class="t"><b>${esc(f.name)}</b><small>${f.url?"Trên Google Drive · cần quyền xem trên Drive":dtSize(f.size)}</small></div>${f.url?`${dtPreview(f.url)?`<button class="btn sm" data-dtpv="${i}">Xem ngay</button> `:""}<a class="btn sm" href="${esc(f.url)}" target="_blank" rel="noopener">Mở trên Drive</a>`:`<a class="btn sm" href="${dtFileUrl(f)}" target="_blank" rel="noopener">Mở</a> <a class="btn sm" href="${dtFileUrl(f,1)}">Tải về</a>`}</div><div data-dtpvbox="${i}"></div>`).join("")}
     ${(()=>{const pdf=d.files.find(f=>/pdf/.test(f.mime));return pdf&&!pdf.url?`<iframe src="${dtFileUrl(pdf)}" title="${esc(pdf.name)}" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:12px;margin-top:8px"></iframe>`:""})()}</section>`:""}
   ${quiz}${ackBox}${d.status==="dang"?hoi:""}</article></div>`;
  m.querySelector("#dt-back").onclick=dtClose;
  m.querySelector("#dt-print").onclick=()=>dtPrint(d);
  m.querySelectorAll("[data-dtpv]").forEach(b=>b.onclick=()=>{const i=+b.dataset.dtpv,box=m.querySelector(`[data-dtpvbox="${i}"]`);
    if(box.innerHTML){box.innerHTML="";b.textContent="Xem ngay";return}box.innerHTML=`<iframe src="${esc(dtPreview(d.files[i].url))}" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:12px;margin:6px 0" allow="autoplay"></iframe>`;b.textContent="Thu gọn"});
  m.querySelectorAll("#dt-edit,[data-dted2]").forEach(ed=>ed.onclick=()=>{dtClose();dtEditOpen(d)});
  m.querySelectorAll(".dt-toc a").forEach(a=>a.onclick=e=>{e.preventDefault();const t=m.querySelector(a.getAttribute("href"));if(t)t.scrollIntoView({behavior:"smooth",block:"start"})});
  m.querySelectorAll("[data-dtq]").forEach(r=>r.onchange=()=>{A[+r.dataset.dtq]=+r.value});
  const pvw=m.querySelector("#dt-pvw");if(pvw)pvw.onclick=()=>{DT.pv=!DT.pv;dtModal()};
  const rej=m.querySelector("#dt-rej");if(rej)rej.onclick=async()=>{const note=prompt("Nhắn người soạn cần sửa gì:","");if(note===null)return;
    try{await svApi(DT_API+"/docs/"+id+"/tra-lai",{method:"POST",body:JSON.stringify({note})});toast("Đã trả lại");delete DT.doc[id];DT.pv=false;await dtLoad(true);dtOpen(id)}catch(e){toast(e.message)}};
  const ap2=m.querySelector("#dt-appr2");if(ap2)ap2.onclick=async()=>{if(!confirm("Duyệt bản sửa và cho mọi người thấy?"))return;
    try{await svApi(DT_API+"/docs/"+id+"/approve",{method:"POST",body:"{}"});toast("Đã duyệt bản sửa");delete DT.doc[id];DT.pv=false;await dtLoad(true);dtOpen(id)}catch(e){toast(e.message)}};
  const ap=m.querySelector("#dt-appr");if(ap)ap.onclick=async()=>{if(!confirm("Duyệt và cho mọi người thấy tài liệu \""+d.title+"\"?"))return;try{await svApi(DT_API+"/docs/"+id+"/approve",{method:"POST",body:"{}"});toast("Đã duyệt");delete DT.doc[id];await dtLoad(true);dtOpen(id)}catch(e){toast(e.message)}};
  const ak=m.querySelector("#dt-ack");if(ak)ak.onclick=async()=>{
    if(d.quiz&&d.quiz.length&&d.quiz.some((q,i)=>A[i]==null)){m.querySelector("#dt-ackm").textContent="Trả lời hết câu kiểm tra ở trên trước nhé.";return}
    ak.disabled=true;try{const r=await svApi(DT_API+"/docs/"+id+"/ack",{method:"POST",body:JSON.stringify({answers:A})});
      if(!r.pass){m.querySelector("#dt-ackm").textContent=`Đúng ${r.right}/${r.total} câu, chưa đạt. Đọc lại phần trên rồi thử lại nhé.`;ak.disabled=false;return}
      toast("Đã xác nhận");delete DT.ans[id];await dtLoad(true);dtOpen(id)}catch(e){m.querySelector("#dt-ackm").textContent=e.message;ak.disabled=false}};
  const ab=m.querySelector("#dt-askb");if(ab)ab.onclick=async()=>{const t=m.querySelector("#dt-ask").value.trim();if(t.length<3){toast("Gõ câu hỏi giúp em");return}
    try{await svApi(DT_API+"/docs/"+id+"/hoi",{method:"POST",body:JSON.stringify({text:t})});toast("Đã gửi câu hỏi cho người soạn");dtOpen(id)}catch(e){toast(e.message)}};
  m.querySelectorAll("[data-dthoi]").forEach(b=>b.onclick=async()=>{const v=m.querySelector(`[data-dthoi-in="${b.dataset.dthoi}"]`).value.trim();if(!v)return;
    try{await svApi(DT_API+"/hoi/"+b.dataset.dthoi+"/tra-loi",{method:"POST",body:JSON.stringify({answer:v})});toast("Đã trả lời");dtOpen(id)}catch(e){toast(e.message)}})}

/* ---------- Soạn tài liệu ---------- */
function dtScopes(){const me=DT.me||{};if(me.ceo||me.hr)return {chung:1,web:1,teams:null};
  const t=(me.scopes||[]).filter(s=>s.startsWith("team:")).map(s=>s.slice(5));if(me.manager&&me.pb)t.push(me.pb);
  return {chung:(me.scopes||[]).includes("chung"),web:(me.scopes||[]).includes("web"),teams:[...new Set(t)]}}
/* Tạo tài liệu: hỏi trước tạo bằng cách nào (chị Hoa 02/11). */
function dtNewChoose(){openDrawerHTML(`<h2>Tạo tài liệu</h2><p class="hint">Chọn cách tạo:</p>
  ${[["web","✎","Tạo mới","Soạn ngay trên web như soạn Word: tiêu đề, gạch đầu dòng, ảnh, câu hỏi kiểm tra."],["file","📎","Tải file lên","Chọn file Word, PDF, Excel, PowerPoint, ảnh từ máy (tối đa 1,8 MB) — không cần gõ nội dung."],["link","🔗","Gắn link Google Drive","Dán link file, thư mục hoặc Google Docs trên Drive. Google Docs thì web chép nội dung để đọc ngay."]]
   .map(([k,ic,n,h])=>`<button class="card dt-item" data-dtnc="${k}" style="width:100%;text-align:left;margin-bottom:10px;border:1px solid var(--line)"><span style="font-size:26px">${ic}</span><div class="t"><b>${n}</b><small>${h}</small></div></button>`).join("")}`);
  document.querySelectorAll("[data-dtnc]").forEach(b=>b.onclick=()=>{DT.newSrc=b.dataset.dtnc;closeDrawer();dtEditOpen(null).then(()=>{DT.newSrc=null;if(b.dataset.dtnc==="file"){const f=document.querySelector("#dte-file");if(f)f.click()}else if(b.dataset.dtnc==="link"){const i=document.querySelector("#dte-link");if(i)i.focus()}})})}
async function dtEditOpen(d){
  if(d&&d.id&&d.body==null){try{d=await svApi(DT_API+"/docs/"+d.id)}catch(e){toast(e.message);return}}
  if(d&&d.pending){const P=d.pending;d={...d,title:P.title,summary:P.summary,body:P.body,nhom:P.nhom,teams:P.teams,bat_buoc:P.bat_buoc,lo_trinh:P.lo_trinh,han_ngay:P.han_ngay,quiz:P.quiz,sort:P.sort,files:P.files||[],drive_id:P.drive_id||""}}
  const S=dtScopes();
  DT.edit=d?{...d,quiz:(d.quiz||[]).map(q=>({q:q.q,o:q.o.slice(),a:q.a})),major:false,src:d.drive_id?"link":!String(d.body||"").trim()&&(d.files||[]).length?((d.files||[]).some(f=>f.id)?"file":"link"):"web",drive:d.drive_id||""}:{quiz:[],files:[],src:DT.newSrc||"web",drive:"",id:null,nhom:S.chung?"chung":S.web?"web":"team",teams:S.teams&&S.teams.length===1?[S.teams[0]]:[],title:"",summary:"",body:"",bat_buoc:"moi",lo_trinh:"w1",han_ngay:7,sort:100,quizText:"",major:false};
  dtClose();PAGE="dt_soan";MOD="dt";render();scrollTo(0,0)}
function pDtSoan(m){
  if(!DT.docs)return dtWait(m,"Soạn tài liệu");dtLoad();
  const me=DT.me||{};if(!me.editor){m.innerHTML=H("Soạn tài liệu","")+`<p class="empty">Bạn chưa được giao quyền soạn tài liệu.</p>`;return}
  if(DT.edit)return dtEditor(m);
  const mine=(DT.docs||[]).filter(d=>d.can_edit),st=d=>d.status==="dang"&&d.has_pending?pill("Có bản sửa chờ duyệt","amb"):d.status==="dang"?pill("Đang hiện","grn"):d.status==="cho_duyet"?pill("Chờ CEO duyệt","amb"):pill("Nháp","gry");
  m.innerHTML=DT_CSS+H("Soạn tài liệu",me.ceo?"Chị soạn và duyệt được mọi tài liệu":me.hr?"Bạn soạn được tài liệu Chung (cần CEO duyệt), Sổ tay web và tài liệu các team":"Bạn soạn được tài liệu của team mình")+
  `<div class="filters"><button class="btn pri" id="dt-new">＋ Tài liệu mới</button></div>
  <section class="card flush">${tbl(["Tài liệu","Nhóm","Bắt buộc","Lộ trình","Trạng thái","Cập nhật · Duyệt",""],mine.map(d=>`<tr><td><b>${esc(d.title)}</b>${d.drive_id?" "+pill("Google Docs","blu"):""}${d.quiz_n?`<small>${d.quiz_n} câu kiểm tra</small>`:""}</td><td>${esc(d.nhom==="team"?dtTeams(d):DT_NHOM[d.nhom])}</td><td>${esc(DT_BB[d.bat_buoc])}</td><td>${esc(DT_LT[d.lo_trinh]||"—")}</td><td>${st(d)}</td><td><small style="display:block;color:var(--muted);font-size:12.5px;white-space:normal">${dtStamp(d)}</small></td>
    <td class="nowrap"><button class="btn sm" data-dtopen="${esc(d.id)}">Xem</button> <button class="btn sm" data-dted="${esc(d.id)}">Sửa</button> <button class="btn sm danger" data-dtdel="${esc(d.id)}">Gỡ</button></td></tr>`))}</section>
  <p class="hint">Chỉ đăng tài liệu chuẩn (nội quy, quy trình, hướng dẫn). File làm việc hằng ngày để ở thư mục Drive của team. Mọi tài liệu do Lead / quản lý tạo hoặc sửa đều gửi chị Hoa duyệt; trong lúc chờ, mọi người vẫn đọc bản đã duyệt.</p>`;
  m.querySelector("#dt-new").onclick=dtNewChoose;
  m.querySelectorAll("[data-dted]").forEach(b=>b.onclick=()=>dtEditOpen(DT.docs.find(x=>x.id===b.dataset.dted)));
  m.querySelectorAll("[data-dtdel]").forEach(b=>b.onclick=async()=>{const d=DT.docs.find(x=>x.id===b.dataset.dtdel);if(!confirm("Gỡ tài liệu \""+d.title+"\"? Mọi người sẽ không thấy nữa."))return;
    try{await svApi(DT_API+"/docs/"+d.id,{method:"DELETE"});toast("Đã gỡ");dtLoad(true)}catch(e){toast(e.message)}});dtWire(m)}
function dtEditor(m){
  const e=DT.edit,S=dtScopes(),deps=(DT.me&&DT.me.deps)||[],teamOk=S.teams===null?deps:deps.filter(x=>S.teams.includes(x.k));
  const nh=[["chung","Chung — mọi nhân viên",S.chung],["web","Sổ tay web vận hành",S.web],["team","Tài liệu team",S.teams===null||S.teams.length]].filter(x=>x[2]);
  m.innerHTML=DT_CSS+H(e.id?"Sửa tài liệu":"Tài liệu mới",e.id?"Bản "+e.version:"")+
  `<div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;align-items:start">
   <section class="card dt-ed"><label class="field">Tên tài liệu<input id="dte-title" value="${esc(e.title)}" maxlength="160"></label>
    <label class="field">Một dòng giới thiệu (hiện ở thư viện)<input id="dte-sum" value="${esc(e.summary)}" maxlength="300"></label>
    <label class="field" style="margin-bottom:4px">Nội dung soạn ở đâu</label>
    <div class="dt-chips" style="margin-bottom:8px">${[["web","✎ Tạo mới (soạn trên web)"],["file","📎 Tải file lên"],["link","🔗 Gắn link Google Drive"]].map(([k,n])=>`<button type="button" class="btn sm${e.src===k?" pri":""}" data-dtsrc="${k}">${n}</button>`).join("")}</div>
    ${e.src==="file"?`<p class="note">Chọn file từ máy ở ô bên dưới (Word, PDF, Excel, PowerPoint, ảnh). Không cần gõ nội dung — ghi tên tài liệu rồi bấm Đăng.</p>`:""}
    <div id="dte-drv"${e.src==="link"?"":" hidden"}><div class="acts"><input id="dte-link" placeholder="Dán link file, thư mục hoặc Google Docs trên Drive (Chia sẻ › Sao chép đường liên kết)" style="flex:1"><button type="button" class="btn sm pri" id="dte-get">Gắn link</button></div>
     <p class="hint">Link <b>Google Docs</b>: web chép nội dung về để đọc ngay trên web và tự cập nhật khi file được sửa (lần đầu chia sẻ file cho tài khoản của web quyền Người xem). Link khác (PDF, bảng tính, trình chiếu, thư mục): người đọc bấm <b>Xem ngay</b> hoặc <b>Mở trên Drive</b> — họ cần được chia sẻ file trên Drive.</p>
     ${e.drive?`<div class="dt-item" style="cursor:default"><span>📘</span><div class="t"><b>Nội dung lấy từ Google Docs</b><small>${esc(e.drive)}</small></div><button type="button" class="btn sm danger" id="dte-drvx">Bỏ</button></div>
     <div id="dte-dprev" class="dt-doc card" style="box-shadow:none;max-height:50vh;overflow:auto">${e.body?dtMd(e.body):'<p class="hint">Đang lấy nội dung…</p>'}</div>`:'<div id="dte-dprev"></div>'}</div>
    <div id="dte-web"${e.src==="web"?"":" hidden"}>
    <div class="dt-tb">${[["h2","Tiêu đề mục"],["h3","Tiêu đề nhỏ"],["p","Chữ thường"],["ul","• Gạch đầu dòng"],["ol","1. Các bước"],["blockquote","💡 Lưu ý"],["b","B Đậm"]].map(([k,n])=>`<button type="button" class="btn sm" data-dtfmt="${k}">${n}</button>`).join("")}
     <label class="btn sm" style="cursor:pointer">🖼 Chèn ảnh<input type="file" accept="image/*" id="dte-img" hidden></label><span class="sp"></span><button type="button" class="btn sm" id="dte-raw">${e.raw?"Về ô soạn thường":"Sửa dạng chữ (nâng cao)"}</button></div>
    <div id="dte-vis" class="dt-vis dt-doc" contenteditable="true"${e.raw?" hidden":""}>${e.raw?"":dtMdEdit(e.body)}</div>
    <textarea id="dte-body" rows="22"${e.raw?"":" hidden"}>${esc(e.body)}</textarea>
    <p class="hint">${e.raw?'Dạng chữ: "# " tiêu đề mục, "- " gạch đầu dòng, "1. " bước, "> " lưu ý, "=> Ai | Việc | Trang" sơ đồ luồng, "| a | b |" bảng.':"Gõ và định dạng như soạn văn bản: bôi đen chữ rồi bấm nút trên thanh công cụ. Dán từ Word / Google Docs được. Sơ đồ luồng, bảng, ảnh có viền chấm là khối cố định — muốn sửa thì bấm Sửa dạng chữ."}</p></div>
    <div class="card" style="box-shadow:none;background:#fbfcfe;margin:6px 0 14px${e.src!=="web"?";border-color:#4b54d1":""}"><b>${e.src==="link"?"🔗 Các link đã gắn":"📎 Tệp và link đính kèm"}</b> <small class="hint">${e.src==="web"?"(không bắt buộc)":"— nội dung chính của tài liệu"}</small>
    <div id="dte-files" style="margin-top:6px">${(e.files||[]).map((f,i)=>`<div class="dt-item" style="cursor:default;padding:6px 0"><span>${dtFileIc(f)}</span><div class="t"><b>${esc(f.name)}</b><small>${f.url?esc(f.url):dtSize(f.size)}</small></div><button type="button" class="btn sm danger" data-dtfx="${i}">Bỏ</button></div>`).join("")||'<p class="hint" style="margin:4px 0">Chưa có tệp nào.</p>'}</div>
    <div class="acts" style="flex-wrap:wrap;margin-top:6px"><label class="btn sm${e.src==="file"?" pri":""}" style="cursor:pointer"${e.src==="link"?" hidden":""}>📎 Tải file từ máy<input type="file" id="dte-file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"></label>
     <input id="dte-dlink" placeholder="🔗 Hoặc dán link file / thư mục trên Google Drive" style="flex:1;min-width:220px"${e.src==="web"?"":" hidden"}><button type="button" class="btn sm" id="dte-dadd"${e.src==="web"?"":" hidden"}>Thêm link</button></div>
    <small class="hint">File từ máy: Word, PDF, Excel, PowerPoint, ảnh — tối đa 1,8 MB, người đọc mở hoặc tải về được, PDF xem ngay trong tài liệu. File lớn hơn hoặc đã có trên Drive: dán link — người đọc cần được chia sẻ file đó trên Drive.</small></div>
    <div class="field"><b>✅ Câu hỏi kiểm tra</b> <small class="hint">(không bắt buộc) — bấm chấm tròn cạnh đáp án đúng. Người đọc phải đúng 80% mới xác nhận được.</small></div>
    <div id="dte-qz">${(e.quiz||[]).map((q,i)=>`<div class="card dt-qe" data-qi="${i}" style="box-shadow:none;padding:10px 12px;margin-bottom:8px"><div class="acts"><b style="white-space:nowrap">Câu ${i+1}</b><input data-qq value="${esc(q.q)}" placeholder="Gõ câu hỏi" style="flex:1"><button type="button" class="btn sm danger" data-qdel="${i}">Xóa câu</button></div>
      ${q.o.map((o,j)=>`<div class="acts" style="margin:6px 0 0 20px"><input type="radio" name="qa${i}" value="${j}"${q.a===j?" checked":""} style="width:auto" title="Đáp án đúng"><input data-qo value="${esc(o)}" placeholder="Đáp án ${j+1}" style="flex:1"><button type="button" class="btn sm" data-qodel="${i}:${j}" title="Bỏ đáp án">×</button></div>`).join("")}
      <button type="button" class="btn sm" data-qoadd="${i}" style="margin:6px 0 0 20px">＋ Đáp án</button></div>`).join("")}</div>
    <button type="button" class="btn sm" id="dte-qadd">＋ Thêm câu hỏi</button>
   </section>
   <section class="card"><label class="field">Thuộc nhóm<select id="dte-nhom">${nh.map(([k,n])=>`<option value="${k}"${e.nhom===k?" selected":""}>${n}</option>`).join("")}</select></label>
    <div id="dte-teams"${e.nhom==="team"?"":" hidden"}><label class="field" style="margin-bottom:4px">Team được xem</label><div class="dt-chips">${teamOk.map(x=>`<label class="btn sm"><input type="checkbox" value="${esc(x.k)}"${(e.teams||[]).includes(x.k)?" checked":""} style="width:auto;margin-right:4px">${esc(x.n)}</label>`).join("")||'<span class="hint">Chưa có phòng ban nào</span>'}</div><small class="hint">Quản lý các team này và CEO luôn xem được.</small></div>
    <label class="field">Bắt buộc với<select id="dte-bb">${Object.entries(DT_BB).map(([k,n])=>`<option value="${k}"${e.bat_buoc===k?" selected":""}>${n}</option>`).join("")}</select></label>
    <label class="field">Đưa vào lộ trình<select id="dte-lt"><option value="">Không</option>${Object.entries(DT_LT).map(([k,n])=>`<option value="${k}"${e.lo_trinh===k?" selected":""}>${n}</option>`).join("")}</select></label>
    <label class="field">Phải đọc xong trong (ngày)<input type="number" id="dte-han" min="1" max="120" value="${+e.han_ngay||7}"><small class="hint">Nhân viên mới: tính từ ngày vào làm. Mọi người: từ ngày đăng.</small></label>
    <label class="field">Thứ tự hiện<input type="number" id="dte-sort" min="0" max="9999" value="${+e.sort||100}"><small class="hint">Số nhỏ hiện trước.</small></label>
    ${e.id&&e.status==="dang"?`<label class="field"><span><input type="checkbox" id="dte-major" style="width:auto;margin-right:6px">Sửa lớn — lên bản mới, mọi người phải đọc lại</span></label>`:""}
    <div class="acts" style="margin-top:14px;flex-wrap:wrap"><button class="btn pri" id="dte-pub">Đăng tài liệu</button><button class="btn" id="dte-draft">Lưu nháp</button><button class="btn" id="dte-x">Thôi</button></div>
    <p class="hint" id="dte-msg"></p></section></div>`;
  const $m=s=>m.querySelector(s),ta=$m("#dte-body"),vis=$m("#dte-vis");
  const readQuiz=()=>[...m.querySelectorAll(".dt-qe")].map(el=>{const i=el.dataset.qi,r=el.querySelector(`input[name=qa${i}]:checked`);
    return {q:el.querySelector("[data-qq]").value,o:[...el.querySelectorAll("[data-qo]")].map(x=>x.value),a:r?+r.value:-1}});
  const bodyNow=()=>e.raw?ta.value:dtHtmlToMd(vis);
  const keep=()=>{Object.assign(e,{title:$m("#dte-title").value,summary:$m("#dte-sum").value,body:bodyNow(),nhom:$m("#dte-nhom").value,bat_buoc:$m("#dte-bb").value,lo_trinh:$m("#dte-lt").value,
    han_ngay:+$m("#dte-han").value||7,sort:+$m("#dte-sort").value||100,quiz:readQuiz(),teams:[...m.querySelectorAll("#dte-teams input:checked")].map(x=>x.value),major:!!($m("#dte-major")&&$m("#dte-major").checked)})};
  /* Nút định dạng: dùng lệnh soạn thảo sẵn của trình duyệt trên ô soạn; ở dạng chữ thì chèn ký hiệu đầu dòng như cũ. */
  const insRaw=(pre,post="")=>{const a=ta.selectionStart,b=ta.selectionEnd,v=ta.value;let ls=v.lastIndexOf("\n",a-1)+1;
    if(post){ta.value=v.slice(0,a)+pre+v.slice(a,b)+post+v.slice(b)}else{ta.value=v.slice(0,ls)+pre+v.slice(ls)}ta.focus()};
  const RAWK={h2:"# ",h3:"## ",p:"",ul:"- ",ol:"1. ",blockquote:"> "};
  m.querySelectorAll("[data-dtfmt]").forEach(b=>{b.onmousedown=ev=>ev.preventDefault();b.onclick=()=>{const k=b.dataset.dtfmt;
    if(e.raw){k==="b"?insRaw("**","**"):RAWK[k]&&insRaw(RAWK[k]);return}
    vis.focus();if(k==="b")document.execCommand("bold");else if(k==="ul")document.execCommand("insertUnorderedList");else if(k==="ol")document.execCommand("insertOrderedList");else document.execCommand("formatBlock",false,k.toUpperCase())}});
  e.files=e.files||[];
  m.querySelectorAll("[data-dtfx]").forEach(b=>b.onclick=()=>{keep();e.files.splice(+b.dataset.dtfx,1);dtEditor(m)});
  $m("#dte-file").onchange=async ev=>{const L=[...ev.target.files];if(!L.length)return;keep();
    for(const f of L){if(f.size>1.8e6){toast(f.name+": quá 1,8 MB. File lớn để trên Google Drive rồi dán link Google Docs.");continue}
      const fd=new FormData();fd.append("file",f);toast("Đang tải "+f.name+"…");
      try{const r=await fetch(DT_API+"/file",{method:"POST",body:fd,credentials:"same-origin"}),j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||"Chưa tải được tệp");e.files.push(j.data)}catch(er){toast(f.name+": "+er.message)}}
    if(!e.title.trim()&&e.files.length)e.title=e.files[0].name.replace(/\.[^.]+$/,"");dtEditor(m);toast("Đã tải tệp lên — nhớ bấm Đăng tài liệu")};
  $m("#dte-qadd").onclick=()=>{keep();e.quiz.push({q:"",o:["",""],a:-1});dtEditor(m)};
  m.querySelectorAll("[data-qdel]").forEach(b=>b.onclick=()=>{keep();e.quiz.splice(+b.dataset.qdel,1);dtEditor(m)});
  m.querySelectorAll("[data-qoadd]").forEach(b=>b.onclick=()=>{keep();e.quiz[+b.dataset.qoadd].o.push("");dtEditor(m)});
  m.querySelectorAll("[data-qodel]").forEach(b=>b.onclick=()=>{keep();const [i,j]=b.dataset.qodel.split(":").map(Number),q=e.quiz[i];q.o.splice(j,1);if(q.a===j)q.a=-1;else if(q.a>j)q.a--;dtEditor(m)});
  $m("#dte-dadd").onclick=async()=>{const l=$m("#dte-dlink").value.trim();if(!l){toast("Dán link file trên Drive");return}keep();
    try{const r=await svApi(DT_API+"/drive/ten",{method:"POST",body:JSON.stringify({link:l})});e.files.push(r);if(!e.title.trim()&&r.name!=="File trên Google Drive")e.title=r.name;dtEditor(m);toast("Đã thêm link — nhớ bấm Đăng tài liệu")}catch(er){toast(er.message)}};
  $m("#dte-raw").onclick=()=>{keep();e.raw=!e.raw;dtEditor(m)};
  /* Dán từ Word / Docs: giữ chữ đậm, danh sách, bảng; bỏ màu, cỡ chữ, phông lạ. */
  vis.addEventListener("paste",ev=>{const h=ev.clipboardData&&ev.clipboardData.getData("text/html");if(!h)return;ev.preventDefault();
    const d=document.createElement("div");d.innerHTML=h;d.querySelectorAll("style,script,meta,link,title").forEach(x=>x.remove());
    document.execCommand("insertHTML",false,dtMdEdit(dtHtmlToMd(d)))});
  $m("#dte-nhom").onchange=()=>{$m("#dte-teams").hidden=$m("#dte-nhom").value!=="team"};
  m.querySelectorAll("[data-dtsrc]").forEach(b=>b.onclick=()=>{keep();e.src=b.dataset.dtsrc;dtEditor(m)});
  $m("#dte-get").onclick=async()=>{const l=$m("#dte-link").value.trim();if(!l){toast("Dán link trên Google Drive");return}$m("#dte-get").disabled=true;$m("#dte-msg").textContent="";keep();
    try{const r=await svApi(DT_API+"/drive/ten",{method:"POST",body:JSON.stringify({link:l})});
      if(r.mime==="application/vnd.google-apps.document"){e.drive=l;e.body="";const x=await svApi(DT_API+"/drive/xem",{method:"POST",body:JSON.stringify({link:l})});e.body=x.body;if(!e.title.trim())e.title=x.title;toast("Đã lấy nội dung từ Google Docs")}
      else{e.files.push(r);if(!e.title.trim()&&r.name!=="File trên Google Drive")e.title=r.name;toast("Đã gắn link")}dtEditor(m)}
    catch(er){$m("#dte-msg").textContent=er.message;$m("#dte-get").disabled=false}};
  {const x=$m("#dte-drvx");if(x)x.onclick=()=>{keep();e.drive="";e.body="";dtEditor(m)}}
  $m("#dte-img").onchange=async ev=>{const f=ev.target.files[0];if(!f)return;if(f.size>1.5e6){toast("Ảnh quá 1,5 MB, thu nhỏ hoặc chụp lại giúp em");return}
    const fd=new FormData();fd.append("file",f);toast("Đang tải ảnh…");
    try{const r=await fetch(DT_API+"/img",{method:"POST",body:fd,credentials:"same-origin"}),j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||"Chưa tải được ảnh");
      const alt=(prompt("Mô tả ngắn cho ảnh (hiện dưới ảnh):","Màn hình "+($m("#dte-title").value||""))||"").replace(/[\[\]]/g,""),md="![" + alt + "](" + j.data.id + ")";
      if(e.raw)insRaw("\n"+md+"\n");else{vis.focus();document.execCommand("insertHTML",false,dtMdEdit(md)+"<p><br></p>")}toast("Đã chèn ảnh")}catch(er){toast(er.message)}ev.target.value=""};
  $m("#dte-x").onclick=()=>{if(!confirm("Bỏ các thay đổi chưa lưu?"))return;DT.edit=null;renderMain()};
  const save=async action=>{keep();
    const Q=e.quiz.map(q=>({q:q.q.trim(),o:q.o.map(o=>o.trim()),a:q.a})).filter(q=>q.q||q.o.some(Boolean));let qerr="";
    const quiz=Q.map((q,i)=>{const keepIdx=q.o.map((o,j)=>o?j:-1).filter(j=>j>=0);if(!q.q)qerr=qerr||`Câu ${i+1}: gõ câu hỏi`;else if(keepIdx.length<2)qerr=qerr||`Câu ${i+1}: cần ít nhất 2 đáp án`;else if(!keepIdx.includes(q.a))qerr=qerr||`Câu ${i+1}: bấm chấm tròn cạnh đáp án đúng`;
      return {q:q.q,o:keepIdx.map(j=>q.o[j]),a:keepIdx.indexOf(q.a)}});
    if(qerr){$m("#dte-msg").textContent=qerr;return}
    if(e.src==="file"&&!(e.files||[]).length){$m("#dte-msg").textContent="Chọn file từ máy để tải lên";return}
    if(e.src==="link"&&!e.drive&&!(e.files||[]).length){$m("#dte-msg").textContent="Dán link rồi bấm Gắn link";return}
    if(e.title.trim().length<3){$m("#dte-msg").textContent="Ghi tên tài liệu";return}
    if(e.nhom==="team"&&!e.teams.length){$m("#dte-msg").textContent="Chọn ít nhất một team được xem";return}
    const body={nhom:e.nhom,teams:e.teams,title:e.title.trim(),summary:e.summary.trim(),body:e.src==="web"?e.body:"",bat_buoc:e.bat_buoc,lo_trinh:e.lo_trinh,han_ngay:e.han_ngay,sort:e.sort,quiz,action,major:e.major,drive:e.src==="link"?e.drive:"",files:e.files||[]};
    m.querySelectorAll("#dte-pub,#dte-draft").forEach(b=>b.disabled=true);
    try{const r=await svApi(DT_API+"/docs"+(e.id?"/"+e.id:""),{method:e.id?"PUT":"POST",body:JSON.stringify(body)});
      toast(r.pending?"Đã gửi bản sửa — chờ chị Hoa duyệt, mọi người vẫn đọc bản cũ":r.status==="cho_duyet"?"Đã gửi, chờ chị Hoa duyệt":r.status==="dang"?"Đã đăng":"Đã lưu nháp");if(r.id)delete DT.doc[r.id];DT.edit=null;await dtLoad(true)}
    catch(er){$m("#dte-msg").textContent=er.message;m.querySelectorAll("#dte-pub,#dte-draft").forEach(b=>b.disabled=false)}};
  $m("#dte-pub").onclick=()=>save("dang");$m("#dte-draft").onclick=()=>save("nhap")}

/* ---------- Theo dõi nhân viên mới ---------- */
async function dtTrackLoad(){try{DT.track=await svApi(DT_API+"/theo-doi")}catch(e){DT.track={err:e.message}}renderMain()}
function pDtTheo(m){
  if(!DT.docs)return dtWait(m,"Theo dõi nhân viên mới");
  if(!DT.track){m.innerHTML=H("Theo dõi nhân viên mới","Đang tải…");dtTrackLoad();return}
  const T=DT.track;if(T.err){m.innerHTML=H("Theo dõi nhân viên mới","")+`<div class="note red">${esc(T.err)}</div>`;return}
  const me=DT.me||{},P=T.people.slice().sort((a,b)=>(b.newbie&&!b.newbie.done_at)-(a.newbie&&!a.newbie.done_at)||b.late-a.late||a.name.localeCompare(b.name));
  const nbs=P.filter(p=>p.newbie&&!p.newbie.done_at),late=P.filter(p=>p.late);
  m.innerHTML=DT_CSS+H("Theo dõi nhân viên mới",me.ceo||me.hr?"Toàn công ty":"Người trong phòng "+esc(dtDep(me.pb)))+
  `<div class="dt-kpis"><div class="kpi"><div class="l">Đang onboarding</div><div class="v">${nbs.length}</div></div>
   <div class="kpi"><div class="l">Trễ hạn đọc</div><div class="v${late.length?" t-red":""}">${late.length}</div><div class="h">người quá hạn tài liệu bắt buộc</div></div>
   <div class="kpi"><div class="l">Câu hỏi chưa trả lời</div><div class="v">${T.hoi.length}</div></div>
   <div class="kpi"><div class="l">Người theo dõi</div><div class="v">${P.length}</div></div></div>
  <div class="filters"><button class="btn pri sm" id="dt-nb">＋ Ghi nhân viên mới</button><span class="sp"></span><button class="btn sm" id="dt-tre">Tải lại</button></div>
  <section class="card flush">${tbl(["Nhân viên","Phòng","Ngày vào · người kèm","Tiến độ bắt buộc","Còn thiếu",""],P.map(p=>{const pc=p.required?Math.round(p.done/p.required*100):100;
    return `<tr><td><b>${esc(p.name)}</b>${p.newbie&&!p.newbie.done_at?`<small>${pill("Nhân viên mới","vio")}</small>`:""}</td><td>${esc(dtDep(p.pb))}</td>
    <td>${p.newbie?`${dtDay(p.newbie.start_date)}${p.newbie.mentor_id?`<small>kèm: ${esc(p.newbie.mentor_id)}</small>`:""}${p.newbie.done_at?`<small>xong onboarding ${dtDay(p.newbie.done_at)}</small>`:""}`:'<span class="hint">—</span>'}</td>
    <td style="min-width:150px">${p.done}/${p.required}<div class="dt-bar${p.late?" red":""}"><i style="width:${pc}%"></i></div>${p.late?`<small class="t-red">trễ ${p.late}</small>`:""}</td>
    <td>${p.missing.length?p.missing.map(x=>`<span class="${x.late?"t-red":""}">${esc(x.title)}${x.old?" (bản mới)":""}</span>`).join(", "):'<span class="t-grn">Đủ</span>'}</td>
    <td class="nowrap"><button class="btn sm" data-dtnb="${esc(p.id)}">${p.newbie?"Sửa":"Đặt nhân viên mới"}</button></td></tr>`}))}</section>
  <section class="card"><div class="card-h"><h2>Ai đã xác nhận từng tài liệu</h2><span class="hint">trong những người bạn theo dõi</span></div>
   ${tbl(["Tài liệu","Đã xác nhận","Chưa xác nhận"],T.perDoc.map(d=>`<tr><td><b>${esc(d.title)}</b><small>bản ${d.version}</small></td><td class="n">${d.ok}/${d.total}</td><td>${d.notYet.length?esc(d.notYet.slice(0,12).join(", "))+(d.notYet.length>12?" … +"+(d.notYet.length-12):""):'<span class="t-grn">Đủ</span>'}</td></tr>`))}</section>
  ${T.hoi.length?`<section class="card"><h2>Câu hỏi chưa trả lời</h2>${T.hoi.map(h=>`<div class="dt-item" data-dtopen="${esc(h.doc_id)}"><div class="t"><b>${esc(h.text)}</b><small>${esc(h.name)} · ${esc(h.title)} · ${dtDay(h.created_at)}</small></div></div>`).join("")}</section>`:""}`;
  m.querySelector("#dt-tre").onclick=()=>{DT.track=null;renderMain()};
  m.querySelector("#dt-nb").onclick=()=>dtNbForm(null);
  m.querySelectorAll("[data-dtnb]").forEach(b=>b.onclick=()=>dtNbForm(b.dataset.dtnb));dtWire(m)}
function dtNbForm(uid){
  const T=DT.track,p=uid?T.people.find(x=>x.id===uid):null,nb=p&&p.newbie,opts=T.people.map(x=>`<option value="${esc(x.id)}"${x.id===uid?" selected":""}>${esc(x.name)} · ${esc(dtDep(x.pb))}</option>`).join("");
  openDrawerHTML(`<h2>Nhân viên mới</h2><p class="hint">Người được đặt là nhân viên mới sẽ thấy lộ trình và tài liệu "bắt buộc với nhân viên mới", hạn tính từ ngày vào làm.</p>
   <label class="field">Nhân viên<select id="nb-u"${uid?" disabled":""}>${opts}</select></label>
   <label class="field">Ngày vào làm<input type="date" id="nb-d" value="${esc(nb?nb.start_date:new Date(Date.now()+7*3600e3).toISOString().slice(0,10))}"></label>
   <label class="field">Người kèm<input id="nb-m" value="${esc(nb?nb.mentor_id:"")}" placeholder="Tên người kèm"></label>
   ${nb?`<label class="field"><span><input type="checkbox" id="nb-x" style="width:auto;margin-right:6px"${nb.done_at?" checked":""}>Đã xong onboarding (thôi tính là nhân viên mới)</span></label>`:""}
   <div class="acts" style="margin-top:12px"><button class="btn pri" id="nb-ok">Lưu</button>${nb?`<button class="btn danger" id="nb-del">Bỏ khỏi danh sách nhân viên mới</button>`:""}<span class="hint" id="nb-msg"></span></div>`);
  const put=async b=>{const u=uid||$("#nb-u").value;try{await svApi(DT_API+"/newbie/"+encodeURIComponent(u),{method:"PUT",body:JSON.stringify(b)});closeDrawer();toast("Đã lưu");DT.track=null;renderMain()}catch(e){$("#nb-msg").textContent=e.message}};
  $("#nb-ok").onclick=()=>put({start_date:$("#nb-d").value,mentor_id:$("#nb-m").value.trim(),done:!!($("#nb-x")&&$("#nb-x").checked)});
  const del=$("#nb-del");if(del)del.onclick=()=>{if(confirm("Bỏ người này khỏi danh sách nhân viên mới?"))put({remove:true})}}

/* ---------- Ai xem được gì ---------- */
async function dtEdsLoad(){try{DT.eds=await svApi(DT_API+"/editors")}catch(e){DT.eds={err:e.message}}renderMain()}
function pDtQuyen(m){
  if(!DT.docs)return dtWait(m,"Ai xem được gì");
  if(!DT.eds){m.innerHTML=H("Ai xem được gì","Đang tải…");dtEdsLoad();return}
  const E=DT.eds,me=DT.me||{};if(E.err){m.innerHTML=H("Ai xem được gì","")+`<div class="note red">${esc(E.err)}</div>`;return}
  const sc=s=>s==="chung"?"Chung":s==="web"?"Sổ tay web":"Team "+dtDep(s.slice(5));
  const auto=E.auto.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(dtDep(u.pb)||"—")}</td><td>${u.role==="admin"?pill("Tất cả + duyệt tài liệu Chung","vio"):u.hr?pill("Chung (chờ CEO duyệt)","vio")+" "+pill("Sổ tay web","vio")+" "+pill("Mọi team","vio"):pill("Tài liệu team "+dtDep(u.pb),"vio")}</td><td class="hint">tự có theo vai trò</td></tr>`);
  const gr=E.granted.map(g=>`<tr><td><b>${esc(g.name||g.user_id)}</b></td><td></td><td>${g.scopes.map(s=>pill(sc(s),"blu")).join(" ")}</td><td>${me.ceo?`<button class="btn sm" data-dtgr="${esc(g.user_id)}">Sửa</button>`:'<span class="hint">CEO giao</span>'}</td></tr>`);
  m.innerHTML=DT_CSS+H("Ai xem được gì","Dùng phòng ban và vai trò đang có ở Nhân sự / Tài khoản & phân quyền — không phải tạo tài khoản mới")+
  `<section class="card"><h2>Quy tắc xem</h2>${tbl(["Nhóm tài liệu","Nhân viên team đó","Nhân viên team khác","Quản lý team đó","CEO · nhân sự"],[
    `<tr><td><b>Chung</b> (nội quy, quy chế)</td><td class="t-grn">Xem</td><td class="t-grn">Xem</td><td class="t-grn">Xem</td><td class="t-grn">Xem</td></tr>`,
    `<tr><td><b>Sổ tay web vận hành</b></td><td class="t-grn">Xem</td><td class="t-grn">Xem</td><td class="t-grn">Xem</td><td class="t-grn">Xem</td></tr>`,
    `<tr><td><b>Tài liệu team</b></td><td class="t-grn">Xem</td><td class="hint">Không thấy</td><td class="t-grn">Xem, soạn, theo dõi ai đã đọc</td><td class="t-grn">Xem tất cả</td></tr>`])}
   <p class="hint">Quản lý = tài khoản vai trò Trưởng phòng / Trưởng nhóm có ghi phòng ban. Phòng ban của từng người sửa ở Tài khoản & phân quyền; web cập nhật khi chị Hoa hoặc người làm nhân sự lưu.</p></section>
  <section class="card"><div class="card-h"><h2>Người được soạn / sửa</h2>${me.ceo?`<span class="sp"></span><button class="btn pri sm" id="dt-grn">＋ Giao quyền soạn cho người khác</button>`:""}</div>
   ${tbl(["Người","Phòng","Được soạn",""],auto.concat(gr))}
   <p class="hint">Tài liệu Chung do người không phải CEO soạn hoặc sửa phải chị Hoa bấm duyệt mới hiện cho mọi người.</p></section>`;
  const nb=m.querySelector("#dt-grn");if(nb)nb.onclick=()=>dtGrantForm(null);
  m.querySelectorAll("[data-dtgr]").forEach(b=>b.onclick=()=>dtGrantForm(b.dataset.dtgr))}
function dtGrantForm(uid){
  const E=DT.eds,g=uid?E.granted.find(x=>x.user_id===uid):null,cur=new Set(g?g.scopes:[]),deps=(DT.me&&DT.me.deps)||[];
  const ck=(v,n)=>`<label class="btn sm"><input type="checkbox" value="${esc(v)}"${cur.has(v)?" checked":""} style="width:auto;margin-right:4px">${esc(n)}</label>`;
  openDrawerHTML(`<h2>Giao quyền soạn tài liệu</h2>
   <label class="field">Người<select id="gr-u"${uid?" disabled":""}>${E.users.map(u=>`<option value="${esc(u.id)}"${u.id===uid?" selected":""}>${esc(u.name)} · ${esc(dtDep(u.pb))}</option>`).join("")}</select></label>
   <label class="field" style="margin-bottom:4px">Được soạn</label><div class="dt-chips" id="gr-s">${ck("chung","Chung (chờ CEO duyệt)")}${ck("web","Sổ tay web")}${deps.map(d=>ck("team:"+d.k,"Team "+d.n)).join("")}</div>
   <p class="hint">Bỏ hết ô là thu lại quyền. Người được soạn tài liệu team nào thì cũng xem được tài liệu team đó.</p>
   <div class="acts" style="margin-top:12px"><button class="btn pri" id="gr-ok">Lưu</button><span class="hint" id="gr-msg"></span></div>`);
  $("#gr-ok").onclick=async()=>{const u=uid||$("#gr-u").value,scopes=[...document.querySelectorAll("#gr-s input:checked")].map(x=>x.value);
    try{await svApi(DT_API+"/editors/"+encodeURIComponent(u),{method:"PUT",body:JSON.stringify({scopes})});closeDrawer();toast("Đã lưu");DT.eds=null;renderMain()}catch(e){$("#gr-msg").textContent=e.message}}}

PAGES.dt_home=pDtHome;PAGES.dt_lib=pDtLib;PAGES.dt_soan=pDtSoan;PAGES.dt_theo=pDtTheo;PAGES.dt_quyen=pDtQuyen;
/* Mục "Đào tạo" ở web vận hành (menubang.js xếp sau Nhân sự). Mục quản lý chỉ hiện khi máy chủ báo có quyền. */
if(typeof ICONS!=="undefined"&&!ICONS.book)ICONS.book='<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h5"/>';
{const dtCnt=()=>{if(!DT.docs)return "";const n=dtPub().filter(d=>dtReq(d)&&!dtDone(d)).length;return n||""};
 const meOk=k=>()=>!!(DT.me&&DT.me[k]);
 MODULES.push({k:"dt",ic:"book",n:"Đào tạo",zone:"",sub:"",groups:()=>[["",[MI("dt_home","Đào tạo của tôi",null,dtCnt),MI("dt_lib","Thư viện tài liệu")]],
   ["Dành cho quản lý",[MI("dt_theo","Theo dõi nhân viên mới",meOk("tracker")),MI("dt_soan","Soạn tài liệu",meOk("editor")),MI("dt_quyen","Ai xem được gì",()=>!!(DT.me&&(DT.me.ceo||DT.me.hr)))]]]})}
{const _r=render;render=function(){const r=_r.apply(this,arguments);try{const pp=document.querySelector(".topbar .pp");if(pp)pp.style.display=String(PAGE).startsWith("dt_")?"none":"";}catch(e){}try{if(ME&&!(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin")&&!DT.at&&!DT.busy)dtLoad().then(()=>{if(DT.me&&(DT.me.tracker||DT.me.editor))render()})}catch(e){}return r}}
