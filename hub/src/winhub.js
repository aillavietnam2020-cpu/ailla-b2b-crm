/* =====================================================================
   VIDEO WIN · HYPIT
   1) Video win nhân sự nhập tay (research đối thủ): ai nhập, ngày nhập hiện rõ.
   2) Video win từ báo cáo shop TikTok: nút "Phân tích Hypit".
   Bấm phân tích → Worker (máy văn phòng) chạy Hypit: vì sao video win + 5 biến thể →
   nhân sự sửa, chọn → "Tạo video" → Worker dựng → link video thành phẩm hiện lại ở đây.
   Worker tự hỏi web mỗi 15 giây (/api/worker/pull), web không gọi thẳng vào máy văn phòng.
   ===================================================================== */
const WORKER_SKU={TD:"tinh-dau-giat-say",BT:"tay-van-nang",XM:"xit-muoi",XR:"xit-ruoi",SAP:"sap-thom"};
const WORKER_SIZES={BT:[["hu-450g","Hũ 450g"],["chai-250g","Chai 250g"]]};
const HY_VOICES=[["adam","Adam"],["anh-thu","Anh Thư"],["an-nhien","An Nhiên"],["cam-hong","Cẩm Hồng"],["tham","Thắm"],["ngan","Ngân"],["my","My"]];
const HY_ST={queued:["Chờ Worker nhận","gry"],taken:["Worker đã nhận","blu"],running:["Hypit đang phân tích","blu"],review:["Chờ duyệt biến thể","amb"],building:["Worker đang dựng","vio"],done:["Xong","grn"],error:["Lỗi","red"]};
const HYW={tasks:[],at:0,busy:false,draft:{}};
async function hyRefresh(force){
  if(typeof svApi!=="function"||HYW.busy||(!force&&Date.now()-HYW.at<8000))return;HYW.busy=true;
  try{const L=await svApi("/api/hub/worker-tasks");const ch=JSON.stringify(L)!==JSON.stringify(HYW.tasks);HYW.tasks=L||[];HYW.at=Date.now();if(ch&&PAGE==="win"&&!svTyping())renderMain()}catch(e){}finally{HYW.busy=false}
}
setInterval(()=>{if(ME&&PAGE==="win"&&!document.hidden)hyRefresh()},10000);
const hyCan=()=>can(ME,"win.sua")||ME.role==="admin";
/* Người duyệt video nhân bản: Oanh (trưởng nhóm Content). CEO luôn duyệt được. */
const hyApprover=()=>D().users.find(u=>u.active&&u.role==="lead"&&/oanh/i.test(foldName(u.name)))||D().users.find(u=>u.active&&u.role==="lead");
const hyIsApprover=()=>ME.role==="admin";
const hyIsOanh=()=>ME.role!=="admin"&&(hyApprover()||{}).id===ME.id;
const hyTaskOf=id=>(D().tasks||[]).find(x=>x.hy===id);
const hyCanT=t=>hyCan()||((t.payload||{}).owner===ME.id);
const hyAnalyses=()=>HYW.tasks.filter(t=>t.kind==="win_analyze");
const hyFor=ref=>hyAnalyses().find(t=>t.ref===ref);
function hyBtn(ref){const t=hyFor(ref);if(t&&t.status==="error"&&hyCan())return `<button class="btn sm" data-hyopen="${t.id}">Lỗi · xem</button> <button class="btn sm pri" data-hy="${esc(ref)}">Phân tích lại</button>`;if(t)return `<button class="btn sm" data-hyopen="${t.id}">${esc((HY_ST[t.status]||[t.status])[0])}</button>`;return hyCan()?`<button class="btn sm pri" data-hy="${esc(ref)}">Nhân bản (Hypit)</button>`:""}

/* Nguồn video win: nhập tay (research) + từ báo cáo shop. */
function winSources(){
  const d=D(),out=[];
  (d.winResearch||[]).forEach(r=>out.push({ref:r.id,ten:r.ten||r.link,link:r.link,sku:r.sp,nguon:"Research: "+(r.nguon||"đối thủ"),by:r.byName,at:r.at,soLieu:r.soLieu,lyDo:r.lyDo}));
  winners().forEach(w=>{const c=w.cardId?d.cards.find(x=>x.id===w.cardId):null,id=(c&&c.tiktokId)||(/^\d{15,}$/.test(w.key)?w.key:"");out.push({ref:"TT-"+w.key,ten:w.ten,link:(c&&c.linkDang)||(id?`https://www.tiktok.com/@aillavietnamstore/video/${id}`:""),sku:w.sku,nguon:"Shop TikTok · "+w.loai,don:w.don,gmv:w.gmv,view:w.view,loai:w.loai})});
  return out;
}

const _pWinOld=pWin;
pWin=function(m){
  hyRefresh();if(SUB.win==="plan")SUB.win="rank";const tab=SUB.win||"rank";
  if(tab==="rank"||tab==="plan"){_pWinOld(m);hyTabs(m,tab);if(tab==="rank")hyDecorateRank(m);hyBind(m);return}
  _pWinOld(m);hyTabs(m,tab);const b=$("#wb");
  if(tab==="research")b.innerHTML=hyResearchHtml();else if(tab==="koc")b.innerHTML=hyKocHtml();else b.innerHTML=hyHypitHtml();
  hyBind(m);
};
PAGES.win=pWin;
function hyTabs(m,tab){const t=m.querySelector(".tabs");if(!t)return;const n=hyAnalyses().filter(x=>x.status==="review").length;t.outerHTML=`<div class="tabs">${[["rank","Video win inhouse"],["koc",`Video win KOC${(D().winResearch||[]).some(r=>r.kocId)?` <b class="cnt">${(D().winResearch||[]).filter(r=>r.kocId).length}</b>`:""}`],["research","Video win đối thủ"],["hypit",`Hypit phân tích & dựng${n?` <b class="cnt">${n}</b>`:""}`]] .map(([k,x])=>`<button data-sub="${k}" class="${k===tab?"on":""}">${x}</button>`).join("")}</div>`;m.querySelectorAll(".tabs [data-sub]").forEach(b=>b.onclick=()=>{SUB.win=b.dataset.sub;renderMain()})}
/* Bảng xếp hạng có sẵn: thêm nút Phân tích Hypit cạnh nút Lên kế hoạch. */
function hyDecorateRank(m){const tb=m.querySelector("#wb table");if(tb)tb.classList.add("wrank");if(tb){const H=[...tb.querySelectorAll("thead th")].map(x=>x.textContent.trim()),ci=n=>H.indexOf(n),rows=[...tb.querySelectorAll("tbody tr")];
  const iN=ci("Nguồn");if(iN>=0)rows.forEach(r=>{const c=r.cells[iN];if(!c)return;const t=c.textContent,mm=t.match(/(\d{4})\/(\d{2})\/(\d{2})/);if(mm){c.title=t;c.textContent=(/cũ/i.test(t)?"Cũ · ":"")+mm[3]+"/"+mm[2]+"/"+mm[1].slice(2)}});
  const iP=ci("Người làm");if(iP>=0&&rows.every(r=>!(r.cells[iP]&&r.cells[iP].textContent.trim())))[tb.querySelector("thead tr")].concat(rows).forEach(r=>{const c=r.cells[iP];if(c)c.remove()});}if(tb)tb.querySelectorAll("td.wide").forEach(td=>{const t=td.firstChild&&td.firstChild.nodeType===3?td.firstChild.textContent:"",sm=td.querySelector("small");td.innerHTML=`<div class="wclip"><span title="${esc(t)}">${esc(t)}</span>${sm?`<small title="${esc(sm.textContent)}">${esc(sm.textContent)}</small>`:""}</div>`});m.querySelectorAll("[data-mkplan]").forEach(x=>{x.insertAdjacentHTML("afterend",hyBtn("TT-"+x.dataset.mkplan));x.remove()})}

/* ---------- Video win KOC (Oanh / chị duyệt từ TOP KOC ở trang KOC / Affiliate) ---------- */
function hyKocHtml(){
  const L=(D().winResearch||[]).filter(r=>r.kocId).slice().reverse(),pot=D().settings.potential||30,cho=(D().kocVideos||[]).filter(v=>v.don>=pot&&!v.st).length;
  return `<section class="card"><div class="card-h"><h2>Video win KOC</h2><span class="hint">${L.length} video đã duyệt vào kho win${cho?` · <b class="t-amb">${cho} video KOC ra số chờ check</b>`:""}</span><span class="sp"></span><button class="btn sm" data-go="bc_koc">Chọn thêm từ TOP KOC →</button></div>
   ${L.length?tbl(["Ngày duyệt","Video","KOC","Sản phẩm","Số liệu","Người duyệt",""],L.map(r=>`<tr><td>${esc(r.at)}</td><td class="wide wvid"><a href="${esc(r.link)}" target="_blank" rel="noopener" title="${esc(r.ten||r.link)}">▶ ${esc(r.ten||r.link)}</a></td><td>${esc((r.nguon||"").replace(/^KOC\s*/,""))}</td><td>${r.sp?swatch(r.sp)+esc(sk(r.sp).n):"—"}</td><td>${esc(r.soLieu||"")}</td><td>${esc(r.byName||"")}</td><td>${hyBtn(r.id)}</td></tr>`)):`<p class="empty">Chưa có video KOC nào trong kho win. Vào trang KOC / Affiliate, ở bảng TOP KOC bấm "✓ Vào kho win" cho video ra số tốt.</p>`}</section>`;
}

/* ---------- Video win đối thủ (nhân sự nhập) ---------- */
function hyResearchHtml(){
  const L=(D().winResearch||[]).filter(r=>!r.kocId).slice().reverse();
  return `<section class="card"><div class="card-h"><h2>Thêm video win đối thủ</h2><span class="hint">video đối thủ / ngoài ngành đang bán tốt · ghi lại để Hypit học cách làm, không sao chép</span></div>
  <form class="frm" id="wrf"><div class="row4"><label class="field grow">Link video<input id="wr-l" required placeholder="https://www.tiktok.com/@…/video/…"></label><label class="field grow">Tên / nội dung chính<input id="wr-t" placeholder="VD: Mẹ bỉm thử tẩy lồng máy giặt"></label></div>
  <div class="row4"><label class="field">Nguồn<input id="wr-n" placeholder="Shop đối thủ, KOC…"></label><label class="field">Sản phẩm của mình để làm theo<select id="wr-s">${opt([["","— chọn"]].concat(prods().map(p=>[p.k,p.n])),"")}</select></label><label class="field">Số liệu thấy được<input id="wr-v" placeholder="VD: 2,1tr view · 5k đã bán"></label></div>
  <label class="field">Vì sao thấy video này win<textarea id="wr-y" rows="2" placeholder="Hook 3 giây đầu, cách demo trước/sau…"></textarea></label><button class="btn pri">Lưu video win</button></form></section>
  <section class="card"><div class="card-h"><h2>Danh sách video win đối thủ</h2><span class="hint">${L.length} video</span></div>${tbl(["Ngày","Người nhập","Video","Nguồn","Sản phẩm","Số liệu","Vì sao win",""],L.map(r=>`<tr><td>${esc(r.at)}</td><td><b>${esc(r.byName)}</b></td><td class="wide wvid"><a href="${esc(r.link)}" target="_blank" rel="noopener" title="${esc(r.ten||r.link)}">▶ ${esc(r.ten||r.link)}</a></td><td>${esc(r.nguon||"")}</td><td>${r.sp?esc(sk(r.sp).n):"—"}</td><td>${esc(r.soLieu||"")}</td><td>${esc(r.lyDo||"")}</td><td>${hyBtn(r.id)}${r.by===ME.id||ME.role==="admin"?` <button class="btn sm danger" data-wrx="${r.id}">Xóa</button>`:""}</td></tr>`))}</section>`;
}

/* ---------- Hypit phân tích & dựng ---------- */
const hyClean=x=>{let s=String(x||"").replace(/PROGRESS\s+\d+\s+[^\r\n]*[\r\n]+/g,"").replace(/^Hypit chưa phân tích xong:\s*/,"").trim();if(/chỉ cho tải phần tiếng/.test(s))s="TikTok không cho máy tải hình của video này (chỉ lấy được tiếng). Cách làm: tải video về máy hoặc điện thoại, lưu lên Google Drive, rồi bấm \"Gửi lại với link file trên Drive\" và dán link FILE Drive.";return s};

/* ---------- Hypit phân tích & dựng ---------- */
function hyHypitHtml(){
  const L=hyAnalyses();if(!L.length)return `<section class="card"><p class="empty">Chưa có video nào gửi Hypit. Vào tab "Video win shop TikTok" hoặc "Video win nghiên cứu", bấm <b>Phân tích Hypit</b>.</p></section>`;
  const fixes=HYW.tasks.filter(t=>t.kind!=="win_analyze");
  return L.map(t=>{const p=t.payload||{},r=t.result||{},b=r.blueprint||{},V=r.variants||[],appr=(r.approved||[]).map(String),ch=r.children||[],dr=HYW.draft[t.id]||(HYW.draft[t.id]={}),pend=fixes.filter(f=>f.ref===t.id&&!["done","error"].includes(f.status));const fails=fixes.filter(f=>f.ref===t.id&&f.status==="error"&&!fixes.some(g=>g.ref===t.id&&g.status!=="error"&&g.created_at>f.created_at)).sort((x,y)=>y.created_at.localeCompare(x.created_at));
    return `<section class="card hycard" id="hy-${t.id}"><div class="card-h"><h2>${esc(p.ten||p.link)}</h2>${pill((HY_ST[t.status]||[t.status])[0],(HY_ST[t.status]||[0,"gry"])[1])}</div>
    <p class="hint">${esc(p.nguonTen||"")} · sản phẩm: <b>${esc(p.spTen||p.sku)}</b>${p.packaging?" · "+esc(p.packaging):""} · ${p.variants||5} biến thể · giọng ${esc(p.voice||"adam")} · gửi bởi ${esc(p.by||"")} lúc ${esc(new Date(t.created_at).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"}))}${t.worker_job?` · order Worker <b class="mono">${esc(t.worker_job)}</b>`:""} · <a href="${esc(p.sourceLink||p.link)}" target="_blank" rel="noopener">xem video gốc</a></p>
    ${(()=>{const tk=hyTaskOf(t.id),ap=hyApprover();return `<p class="hint">👤 Phụ trách: <b>${esc(p.ownerName||(tk&&userName(tk.nguoi))||"chưa giao")}</b> · người duyệt: <b>${esc(ap?ap.name:"Trưởng nhóm")}</b>${tk?` · việc <b>${esc(cvStN(tk.st))}</b>`:""}</p>`})()}${t.detail?`<p class="hint${t.status==="error"?" bad":""}">${t.status==="error"?"⚠ ":""}${esc(hyClean(t.detail))}${t.progress&&t.status!=="error"?` · ${t.progress}%`:""}</p>`:""}${t.status==="error"&&hyCanT(t)?`<p><button class="btn sm pri" data-hy="${esc(t.ref||"")}">Gửi lại với link file trên Drive</button></p>`:""}${fails.length?`<p class="hint bad">⚠ Lần gửi lúc ${esc(new Date(fails[0].updated_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}))} chưa được: ${esc(fails[0].detail||"lỗi không rõ")}. Chị chọn lại biến thể rồi bấm tạo lại.</p>`:""}${pend.length?`<p class="hint">⏳ ${pend.map(f=>({win_fix:"Hypit đang làm lại theo góp ý",win_child_ok:"Đang duyệt "+((f.payload||{}).child||""),win_child_fix:"Đang gửi góp ý cho "+((f.payload||{}).child||"")}[f.kind]||"Đang gửi sang dựng")).join(" · ")}</p>`:""}
    ${b.core_idea||(b.why_it_can_win||[]).length?`<div class="hyblue"><h3>Vì sao video này win</h3><dl class="kv"><dt>Ý lõi</dt><dd>${esc(b.core_idea||"")}</dd><dt>Cơ chế hook</dt><dd>${esc(b.hook_mechanism||"")}</dd><dt>Lời hứa</dt><dd>${esc(b.promise||"")}</dd><dt>Bằng chứng</dt><dd>${esc(b.proof||"")}</dd><dt>Người xem</dt><dd>${esc(b.target_viewer||"")}</dd></dl>${(b.why_it_can_win||[]).length?`<ul>${b.why_it_can_win.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${(b.must_not_copy||[]).length?`<p class="hint"><b>Không được sao chép:</b> ${b.must_not_copy.map(esc).join(" · ")}</p>`:""}</div>`:""}
    ${V.length?`<h3>${V.length} biến thể đề xuất</h3><div class="hyvars">${V.map(v=>{const done=appr.includes(String(v.id)),risk=(v.reup_risk||{}).level||"",dv=dr[v.id]||{};return `<div class="hyvar${done?" done":""}"><div class="hyvh">${done?pill("Đã gửi dựng","grn"):`<label class="ck"><input type="checkbox" data-hyp="${t.id}" value="${esc(v.id)}" ${dv.pick?"checked":""} ${risk==="high"?"disabled":""}> Chọn</label>`}<b>${esc(v.id)} · ${esc(v.title||v.angle||"")}</b>${risk?pill("Rủi ro reup: "+({low:"thấp",medium:"vừa",high:"cao"}[risk]||risk),risk==="high"?"red":risk==="medium"?"amb":"grn"):""}${v.duration_seconds?`<span class="hint">${v.duration_seconds}s</span>`:""}</div>
      <p class="hint">Góc: ${esc(v.angle||"")}${(v.creative_changes||[]).length?" · Thay đổi: "+v.creative_changes.map(esc).join(", "):""}</p>
      <label class="field">Hook (chữ trên màn hình 3 giây đầu)<input data-hyh="${t.id}|${esc(v.id)}" value="${esc(dv.hook!=null?dv.hook:((v.beats||[])[0]||{}).on_screen_text||v.hook||"")}" ${done?"disabled":""}></label>
      <label class="field">Kịch bản lời đọc<textarea rows="5" data-hys="${t.id}|${esc(v.id)}" ${done?"disabled":""}>${esc(dv.script!=null?dv.script:v.script||"")}</textarea></label>
      ${risk==="high"?`<p class="hint bad">${esc((v.reup_risk||{}).reason||"Rủi ro reup cao: sửa kịch bản hoặc yêu cầu Hypit làm lại")}</p>`:""}</div>`}).join("")}</div>`:""}
    ${ch.length?`<h3>Video đang dựng / đã dựng</h3>${tbl(["Order","Biến thể","Trạng thái","Video"],ch.map(c=>`<tr><td class="mono">${esc(c.id)}</td><td>${esc(c.variant||"")}</td><td>${c.review?(()=>{const tk=hyTaskOf(t.id)||{};return ((tk.oanhOk||[]).includes(c.id)?pill("Chờ chị duyệt","red"):(tk.trinh||[]).includes(c.id)?pill("Chờ Oanh duyệt","amb"):pill("Chờ phụ trách xem","gry"))+" "})():""}${esc(c.detail||c.status||"")}</td><td class="nowrap">${c.drive_url?`<a class="btn sm pri" href="${esc(c.drive_url)}" target="_blank" rel="noopener">Xem video</a>`:c.review?`<button class="btn sm pri" data-hyprev="${esc(c.id)}" data-hyt="${t.id}">Xem bản nháp</button>${hyIsApprover()?` <button class="btn sm pri" data-hycok="${esc(c.id)}" data-hyt="${t.id}" data-ch="${esc(c.channel||"")}">Chị duyệt</button>`:""}${hyIsOanh()&&!((hyTaskOf(t.id)||{}).oanhOk||[]).includes(c.id)?` <button class="btn sm pri" data-hyoanh="${esc(c.id)}" data-hyt="${t.id}">Oanh duyệt</button>`:""}${hyCanT(t)&&!((hyTaskOf(t.id)||{}).trinh||[]).includes(c.id)&&!hyIsApprover()&&!hyIsOanh()?` <button class="btn sm" data-hytrinh="${esc(c.id)}" data-hyt="${t.id}">Trình duyệt</button>`:""}${hyCanT(t)||hyIsApprover()||hyIsOanh()?` <button class="btn sm" data-hycfix="${esc(c.id)}" data-hyt="${t.id}">Góp ý sửa</button>`:""}`:"—"}</td></tr>`))}`:""}
    <div class="acts">${hyCanT(t)&&t.status==="review"?`<label class="field">Giọng đọc<select data-hyv="${t.id}">${opt(HY_VOICES,dr._voice||p.voice||"adam")}</select></label><button class="btn pri" data-hygo="${t.id}">Tạo video từ biến thể đã chọn</button>`:""}${hyCanT(t)&&["review","error"].includes(t.status)?`<button class="btn" data-hyfix="${t.id}">Yêu cầu Hypit làm lại</button>`:""}</div></section>`}).join("");
}

function hyAnalyzeForm(ref){
  const s=winSources().find(x=>x.ref===ref);if(!s)return;const hubK=s.sku&&WORKER_SKU[s.sku]?s.sku:"";
  openDrawerHTML(`<h2>Nhân bản video win bằng Hypit</h2><p><b>${esc(s.ten)}</b><br><span class="hint">${esc(s.nguon)}${s.don?` · ${nf(s.don)} đơn`:""}</span></p>
  <form class="frm" id="hyf"><label class="field">Link file video trên Google Drive (nên dùng)<input id="hy-d" placeholder="https://drive.google.com/file/d/…" value="${esc(/drive\.google/.test(s.link||"")?s.link:"")}"></label><label class="field">Link TikTok / link gốc<input id="hy-l" value="${esc(/drive\.google/.test(s.link||"")?"":(s.link||""))}"></label><p class="hint">TikTok hiện chỉ cho tải <b>phần tiếng</b> của video khi không đăng nhập, Hypit cần cả hình. Video của shop: lấy file gốc trên Drive của team. Video đối thủ: tải về điện thoại, đưa lên Drive rồi dán link file.</p>
  <div class="row4"><label class="field">Sản phẩm Ailla để làm video mới<select id="hy-s" required>${opt([["","— chọn"]].concat(Object.keys(WORKER_SKU).map(k=>[k,sk(k).n])),hubK)}</select></label><label class="field" id="hy-zw">Size / bao bì<select id="hy-z"></select></label></div>
  <div class="row4"><label class="field">Số biến thể<input id="hy-n" type="number" min="1" max="12" value="5"></label><label class="field">Giọng đọc<select id="hy-v">${opt(HY_VOICES,"adam")}</select></label></div>
  <div class="row4"><label class="field">Người phụ trách<select id="hy-o" required>${opt([["","— chọn người"]].concat(D().users.filter(u=>u.active&&["lead","content","digital","truongphong","nhanvien"].includes(u.role)).map(u=>[u.id,u.name])),"")}</select></label><label class="field">Hạn xong (ngày trong tháng)<input id="hy-h" type="number" min="1" max="31" value="${Math.min(MONTH.ndays,D().settings.today+5)}"></label></div><p class="hint">Người phụ trách chọn, sửa biến thể, xem bản nháp rồi <b>trình ${esc((hyApprover()||{name:"trưởng nhóm"}).name)} duyệt</b>. Việc tự hiện bên Task giao việc.</p>
  <label class="field">Ghi chú cho Hypit<textarea id="hy-b" rows="2" placeholder="VD: nhấn mạnh hương thơm lâu, quay ở nhà tắm…">${esc(s.lyDo||"")}</textarea></label>
  <p class="hint">Worker chỉ có kho cảnh cho: ${Object.keys(WORKER_SKU).map(k=>sk(k).n).join(", ")}. Hypit học cách video giữ chân người xem, không sao chép hình, tiếng của video gốc.</p><button class="btn pri big" id="hy-go">Gửi Hypit phân tích</button></form>`);
  const z=()=>{const k=$("#hy-s").value,S=WORKER_SIZES[k]||[];$("#hy-zw").hidden=!S.length;$("#hy-z").innerHTML=opt(S,S.length?S[0][0]:"")};$("#hy-s").onchange=z;z();
  $("#hyf").onsubmit=async e=>{e.preventDefault();const btn=$("#hy-go");if(btn.disabled)return;const k=$("#hy-s").value;if(!k){toast("Chọn sản phẩm");return}if(!$("#hy-o").value){toast("Chọn người phụ trách");return}btn.disabled=true;
    const link=$("#hy-d").value.trim()||$("#hy-l").value.trim();if(!/^https?:\/\//.test(link)){toast("Dán link file Drive hoặc link video");btn.disabled=false;return}
    const payload={link,sourceLink:$("#hy-l").value.trim(),sku:WORKER_SKU[k],hubSku:k,spTen:sk(k).n,packaging:(WORKER_SIZES[k]||[]).length?$("#hy-z").value:"",variants:Math.max(1,Math.min(12,+$("#hy-n").value||5)),voice:$("#hy-v").value,brief:$("#hy-b").value.trim(),note:$("#hy-b").value.trim(),ten:s.ten,nguonTen:s.nguon,by:ME.name,owner:$("#hy-o").value,ownerName:userName($("#hy-o").value)};const han=Math.max(1,Math.min(MONTH.ndays,+$("#hy-h").value||D().settings.today+5));
    try{const r=await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"win_analyze",ref,payload})});const ap=hyApprover();
      DB.mutate(ME.name,"giao nhân bản video win cho "+payload.ownerName,d=>{d.tasks=d.tasks||[];d.tasks.push({id:uid("cv"),hy:r.id,ten:"Nhân bản video win: "+String(s.ten||"").slice(0,70),loai:"Nhân bản video win",team:"content",da:"",nguoi:payload.owner,phoi:ap?[ap.id]:[],duyet:ap?ap.id:"",han,uu:"Cao",st:"doing",moTa:"Hypit phân tích → chọn, sửa biến thể → Tạo video → xem bản nháp → trình duyệt. Mở: Marketing › Video win › Hypit.",trinh:[],tao:ME.id})});closeDrawer();toast("Đã gửi. Worker ở văn phòng sẽ nhận trong khoảng 15 giây");SUB.win="hypit";await hyRefresh(true);renderMain()}catch(err){toast(err.message);btn.disabled=false}};
}

/* Duyệt xong một video: bỏ khỏi danh sách đã trình; hết video chờ thì việc sang Hoàn thành. */
function hyDone(t,id){const ch=((t.result||{}).children||[]).filter(c=>c.review&&c.id!==id);DB.mutate(ME.name,"duyệt video "+id,d=>{const tk=(d.tasks||[]).find(x=>x.hy===t.id);if(!tk)return;tk.trinh=(tk.trinh||[]).filter(x=>x!==id);tk.oanhOk=(tk.oanhOk||[]).filter(x=>x!==id);tk.st=ch.length||(t.result||{}).variants&&((t.result||{}).variants.length>((t.result||{}).approved||[]).length)?(tk.trinh.length?"review":"doing"):"done"})}
function hyBind(m){
  m.querySelectorAll("[data-hy]").forEach(b=>b.onclick=()=>hyAnalyzeForm(b.dataset.hy));
  m.querySelectorAll("[data-hyopen]").forEach(b=>b.onclick=()=>{SUB.win="hypit";renderMain();setTimeout(()=>{const e=$("#hy-"+b.dataset.hyopen);if(e)e.scrollIntoView({behavior:"smooth"})},100)});
  if($("#wrf"))$("#wrf").onsubmit=e=>{e.preventDefault();const t=new Date(),at=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")} ${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`;
    const r={id:"VW-"+Date.now().toString(36).toUpperCase(),link:$("#wr-l").value.trim(),ten:$("#wr-t").value.trim(),nguon:$("#wr-n").value.trim(),sp:$("#wr-s").value,soLieu:$("#wr-v").value.trim(),lyDo:$("#wr-y").value.trim(),by:ME.id,byName:ME.name,at};
    DB.mutate(ME.name,"thêm video win nghiên cứu: "+(r.ten||r.link).slice(0,40),d=>{d.winResearch=d.winResearch||[];d.winResearch.push(r)});toast("Đã lưu video win");renderMain()};
  m.querySelectorAll("[data-wrx]").forEach(b=>b.onclick=()=>{if(!confirm("Xóa video win này?"))return;DB.mutate(ME.name,"xóa video win nghiên cứu",d=>{d.winResearch=(d.winResearch||[]).filter(x=>x.id!==b.dataset.wrx)});renderMain()});
  const key=s=>s.split("|"),dr=(t,v)=>((HYW.draft[t]=HYW.draft[t]||{})[v]=HYW.draft[t][v]||{});
  m.querySelectorAll("[data-hyp]").forEach(x=>x.onchange=()=>{dr(x.dataset.hyp,x.value).pick=x.checked});
  m.querySelectorAll("[data-hyh]").forEach(x=>x.oninput=()=>{const [t,v]=key(x.dataset.hyh);dr(t,v).hook=x.value});
  m.querySelectorAll("[data-hys]").forEach(x=>x.oninput=()=>{const [t,v]=key(x.dataset.hys);dr(t,v).script=x.value});
  m.querySelectorAll("[data-hyv]").forEach(x=>x.onchange=()=>{(HYW.draft[x.dataset.hyv]=HYW.draft[x.dataset.hyv]||{})._voice=x.value});
  m.querySelectorAll("[data-hygo]").forEach(b=>b.onclick=async()=>{const id=b.dataset.hygo,t=HYW.tasks.find(x=>x.id===id),D_=HYW.draft[id]||{},V=((t.result||{}).variants||[]);
    const appr=((t.result||{}).approved||[]).map(String),pick=V.filter(v=>(D_[v.id]||{}).pick&&!appr.includes(String(v.id)));if(!pick.length){toast("Tích chọn ít nhất một biến thể");return}if(!confirm(`Gửi ${pick.length} biến thể sang Worker dựng video?`))return;b.disabled=true;
    const variants=pick.map(v=>({id:v.id,script:(D_[v.id]||{}).script!=null?D_[v.id].script:v.script,hook_text:(D_[v.id]||{}).hook!=null?D_[v.id].hook:(((v.beats||[])[0]||{}).on_screen_text||v.hook||""),voice:D_._voice||(t.payload||{}).voice||"adam"}));
    try{await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"win_approve",ref:id,payload:{worker_job:t.worker_job,variants,by:ME.name}})});pick.forEach(v=>{delete D_[v.id]});toast("Đã gửi sang Worker dựng");await hyRefresh(true);renderMain()}catch(e){toast(e.message);b.disabled=false}});
  const HY_CH=[["tiktok_main","TikTok kênh chính"],["tiktok_via_1","TikTok VIA 1"],["tiktok_via_2","TikTok VIA 2"],["tiktok_affiliate","TikTok kênh phụ / affiliate"],["facebook_page","Facebook Page"],["other","Kênh khác"]];
  const hySend=async(kind,ref,payload,msg)=>{try{await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind,ref,payload:Object.assign({by:ME.name},payload)})});toast(msg);await hyRefresh(true);renderMain()}catch(e){toast(e.message)}};
  m.querySelectorAll("[data-hyprev]").forEach(b=>b.onclick=()=>{const id=b.dataset.hyprev,t=HYW.tasks.find(x=>x.id===b.dataset.hyt);
    openDrawerHTML(`<h2>Bản nháp ${esc(id)}</h2><p class="hint">Phát thẳng từ máy dựng ở văn phòng, không lưu đi đâu. Máy văn phòng phải đang bật.</p><video controls autoplay playsinline style="width:100%;max-height:70vh;background:#000;border-radius:10px" src="/api/hub/worker-tasks/preview/${encodeURIComponent(id)}"></video><p class="hint bad" id="hyverr" hidden>Chưa phát được: máy văn phòng có thể đang tắt hoặc Worker chưa bật lại. Thử lại sau ít phút.</p>${hyIsApprover()||hyIsOanh()||hyCanT(t)?`<div class="acts">${hyIsApprover()?`<button class="btn pri" id="hyd-ok">Chị duyệt video này</button>`:""}<button class="btn" id="hyd-fix">Góp ý sửa</button></div>`:""}`);
    const v=$("#drawer video");if(v)v.onerror=()=>{$("#hyverr").hidden=false};
    if($("#hyd-ok"))$("#hyd-ok").onclick=()=>{closeDrawer();const x=m.querySelector(`[data-hycok="${id}"]`);if(x)x.click()};
    if($("#hyd-fix"))$("#hyd-fix").onclick=()=>{closeDrawer();const x=m.querySelector(`[data-hycfix="${id}"]`);if(x)x.click()}});
  m.querySelectorAll("[data-hycok]").forEach(b=>b.onclick=()=>{const id=b.dataset.hycok,t=HYW.tasks.find(x=>x.id===b.dataset.hyt);
    if(b.dataset.ch){if(confirm(`Duyệt ${id}? Worker sẽ lưu bản final lên Drive.`))hySend("win_child_ok",t.id,{child:id,worker_job:t.worker_job},"Đã gửi duyệt "+id);hyDone(t,id);return}
    openDrawerHTML(`<h2>Duyệt ${esc(id)}</h2><p>Chọn kênh sẽ đăng để Worker đặt tên và lưu đúng thư mục Drive.</p><label class="field">Kênh đăng<select id="hyc-ch">${opt(HY_CH,"tiktok_main")}</select></label><div class="acts"><button class="btn pri" id="hyc-go">Duyệt</button></div>`);
    $("#hyc-go").onclick=()=>{const ch=$("#hyc-ch").value;closeDrawer();hySend("win_child_ok",t.id,{child:id,channel:ch,worker_job:t.worker_job},"Đã gửi duyệt "+id);hyDone(t,id)}});
  m.querySelectorAll("[data-hytrinh]").forEach(b=>b.onclick=()=>{const id=b.dataset.hytrinh,t=HYW.tasks.find(x=>x.id===b.dataset.hyt),ap=hyApprover();if(!confirm(`Trình ${ap?ap.name:"trưởng nhóm"} duyệt ${id}?`))return;
    DB.mutate(ME.name,"trình duyệt video "+id,d=>{let tk=(d.tasks||[]).find(x=>x.hy===t.id);if(!tk){d.tasks=d.tasks||[];tk={id:uid("cv"),hy:t.id,ten:"Nhân bản video win: "+String((t.payload||{}).ten||"").slice(0,70),loai:"Nhân bản video win",team:"content",da:"",nguoi:ME.id,phoi:ap?[ap.id]:[],duyet:ap?ap.id:"",han:d.settings.today+2,uu:"Cao",st:"doing",moTa:"",trinh:[],tao:ME.id};d.tasks.push(tk)}tk.trinh=[...new Set((tk.trinh||[]).concat(id))];tk.st="review"});toast("Đã trình duyệt "+id);renderMain()});
  m.querySelectorAll("[data-hyoanh]").forEach(b=>b.onclick=()=>{const id=b.dataset.hyoanh,t=HYW.tasks.find(x=>x.id===b.dataset.hyt);if(!confirm(`Oanh duyệt ${id}, chuyển chị duyệt?`))return;
    DB.mutate(ME.name,"Oanh duyệt video "+id,d=>{const tk=(d.tasks||[]).find(x=>x.hy===t.id);if(tk){tk.oanhOk=[...new Set((tk.oanhOk||[]).concat(id))];tk.st="review"}});toast("Đã chuyển chị duyệt "+id);renderMain()});
  m.querySelectorAll("[data-hycfix]").forEach(b=>b.onclick=()=>{const id=b.dataset.hycfix,t=HYW.tasks.find(x=>x.id===b.dataset.hyt);const note=prompt(`Cần sửa gì ở ${id}? (VD: cảnh quay tua nhanh hơn, đổi hook thành …)`);if(!note)return;DB.mutate(ME.name,"góp ý làm lại video "+id,d=>{const tk=(d.tasks||[]).find(x=>x.hy===t.id);if(tk){tk.trinh=(tk.trinh||[]).filter(x=>x!==id);tk.oanhOk=(tk.oanhOk||[]).filter(x=>x!==id);tk.st="doing"}});hySend("win_child_fix",t.id,{child:id,note,worker_job:t.worker_job},"Đã gửi góp ý, Worker dựng lại "+id)});
  m.querySelectorAll("[data-hyfix]").forEach(b=>b.onclick=async()=>{const id=b.dataset.hyfix,t=HYW.tasks.find(x=>x.id===id);const note=prompt("Hypit cần làm lại phần nào? (VD: hook mạnh hơn, bớt giống video gốc, nhấn mạnh hương thơm)");if(!note)return;
    try{await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"win_fix",ref:id,payload:{worker_job:t.worker_job,note,by:ME.name}})});toast("Đã gửi góp ý cho Hypit");await hyRefresh(true);renderMain()}catch(e){toast(e.message)}});
}
