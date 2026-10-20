/* ---------- Công xưởng SX video (Marketing) ----------
   Nhân sự tự đặt order cho máy Worker ở văn phòng (thay cho nhắn Telegram), xem và duyệt video của mình.
   Danh sách lấy thẳng từ /api/hub/worker-tasks?kind=xuong (việc xuong_build, tách khỏi luồng thẻ video), lọc theo payload.by = tên người đặt.
   CEO / admin thấy order của mọi người, lọc theo người. Không lưu gì thêm vào dữ liệu chung. */
const XW_PROD=[["tay-van-nang","Bột tẩy vạn năng"],["xit-ruoi","Xịt ruồi"],["xit-muoi","Xịt muỗi"],["tinh-dau-giat-say","Tinh dầu giặt sấy"],["sap-thom","Sáp thơm"],
 ["nuoc-giat-xa","Nước giặt xả kháng khuẩn"],["tay-long-may-giat","Tẩy lồng máy giặt"],["lau-san-benh-vien","Nước lau sàn bệnh viện"],["lau-san","Nước lau sàn"],["tay-toilet","Tẩy toilet"],
 ["coc-tha-bon-cau","Cốc thả bồn cầu"],["tay-da-nang-xclean","Tẩy đa năng XClean"],["xit-kinh","Xịt kính"],["tay-dau-mo","Siêu tẩy dầu mỡ Bio Clean"],["thong-tac-cong","Bột thông tắc cống"],
 ["tay-moc-gioang","Tẩy mốc gioăng cao su"],["nuoc-rua-chen","Nước rửa chén"],["serum-khu-mui","Serum khử mùi Secret"],["body-mist","Body Mist"]];
const XW_SIZE={"tay-van-nang":[["hu-450g","Hũ 450g"],["chai-250g","Chai 250g"]]};
const XW_MODE=[["broll","Dựng video one shot","Gửi video quay thô, Worker cắt chỗ vấp, tăng tốc, chỉnh màu, chèn cảnh trám, hook và chữ"],
 ["text","Chỉ chèn chữ","Giữ nguyên hình và tiếng, Worker chỉ đổi hook, chèn chữ"],
 ["rebrand","Đổi thương hiệu","Video có tên hãng khác: Worker cắt / che chỗ lộ tên cũ"],
 ["voice","Giọng đọc","Giọng AI đọc kịch bản, ghép cảnh trong kho hoặc thư mục cảnh chị gửi"],
 ["win","Nhân bản video win","Gửi link video win, Worker viết vài kịch bản mới cùng kiểu rồi dựng"]];
const XW_VOICE=[["adam","Adam"],["anh-thu","Anh Thư"],["an-nhien","An Nhiên"],["cam-hong","Cẩm Hồng"],["tham","Thắm"],["ngan","Ngân"],["my","My"]];
const XW={tab:"order",who:"",list:[],at:0,busy:false,err:""};
const xwAdmin=()=>ME&&ME.role==="admin";
const xwFolder=l=>/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(l);
const xwPrev=j=>"/api/hub/worker-tasks/preview/"+encodeURIComponent(j);
function xwMine(){const L=XW.list.filter(t=>t.kind==="xuong_build"&&t.payload);if(xwAdmin())return XW.who?L.filter(t=>t.payload.by===XW.who):L;return L.filter(t=>t.payload.by===ME.name)}
async function xwLoad(force){if(XW.busy||(!force&&Date.now()-XW.at<10000))return;XW.busy=true;
  try{XW.list=(await svApi("/api/hub/worker-tasks?kind=xuong"))||[];XW.err="";XW.at=Date.now()}catch(e){XW.err=e.message}finally{XW.busy=false}}
async function xwAct(kind,t,extra){try{await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind,ref:t.id,payload:Object.assign({worker_job:t.worker_job||"",by:ME.name},extra||{})})});return ""}catch(e){return e.message}}

const XV_CSS=`<style id="xv-css">
.xv-wrap{display:grid;grid-template-columns:190px minmax(0,1fr);gap:18px;align-items:start}
.xv-nav{display:flex;flex-direction:column;gap:6px;position:sticky;top:12px}
.xv-nav button{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:9px 12px;text-align:left;cursor:pointer;font-weight:600;color:var(--ink)}
.xv-nav button.on{background:var(--navy);color:#fff;border-color:transparent}
.xv-nav button.xv-new{background:var(--pink);color:#fff;border-color:transparent}
.xv-nav button.xv-new.on{box-shadow:0 0 0 3px var(--pink-soft)}
.xv-panel{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.xv-panel h2{margin:0 0 10px;font-size:18px}
.xv-job{display:grid;grid-template-columns:minmax(150px,1fr) minmax(0,2.2fr) 170px;gap:14px;padding:12px 4px;border-top:1px solid var(--line);align-items:start}
.xv-panel h2+.xv-job,.xv-filter+.xv-job{border-top:0}
.xv-job strong{display:block;font-size:14.5px;word-break:break-word}.xv-job small{display:block;color:var(--muted);font-size:13px}
.xv-job small.xv-who{font-weight:600;color:var(--ink);opacity:.85}
.xv-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.xv-btn{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:4px 10px;font-size:13px;cursor:pointer;color:var(--ink);text-decoration:none;display:inline-block}
.xv-btn:hover{background:var(--gray-soft)}.xv-btn.ok{color:var(--green);border-color:var(--green-soft);background:var(--green-soft)}
.xv-btn:disabled{opacity:.5;cursor:default}
.xv-fix{margin-top:8px;display:flex;flex-direction:column;gap:6px}.xv-fix textarea{min-height:74px;width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;padding:6px 8px}
.xv-pill{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:700;background:var(--gray-soft);color:var(--muted)}
.xv-pill.run{background:var(--blue-soft);color:var(--blue)}.xv-pill.warn{background:var(--orange-soft);color:var(--orange)}
.xv-pill.success{background:var(--green-soft);color:var(--green)}.xv-pill.bad{background:var(--red-soft);color:var(--red)}
.xv-progress{position:relative;height:18px;border-radius:9px;background:var(--gray-soft);margin-top:8px;overflow:hidden}
.xv-progress>i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,var(--blue),var(--green))}
.xv-progress .pct{position:absolute;inset:0;display:grid;place-items:center;font-size:11.5px;font-weight:700;color:var(--ink)}
.xv-empty{color:var(--muted);padding:14px 4px}
.xv-filter{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}.xv-filter .xv-btn.on{background:var(--navy);color:#fff;border-color:transparent}
.xv-scroll{overflow-x:auto}.xv-table{width:100%;border-collapse:collapse;font-size:14px}
.xv-table th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:6px 10px;white-space:nowrap}
.xv-table td{padding:8px 10px;border-top:1px solid var(--line);vertical-align:top}.xv-table td small{display:block;color:var(--muted)}
.xv-table td.nw{white-space:nowrap;font-variant-numeric:tabular-nums}
.xv-link a{display:inline-block;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;margin-right:8px}
.xv-modal{position:fixed;inset:0;background:rgba(10,16,30,.72);display:grid;place-items:center;z-index:9999;padding:16px}
.xv-modal-in{background:var(--surface);border-radius:14px;padding:12px;max-width:min(440px,100%);width:100%;box-sizing:border-box}
.xv-modal-in video{width:100%;max-height:75vh;border-radius:10px;background:#000;display:block}
.xv-modal-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px}
@media(max-width:760px){.xv-wrap{grid-template-columns:1fr}.xv-nav{position:static;flex-direction:row;flex-wrap:wrap}.xv-job{grid-template-columns:1fr}}
</style>`;
const XV_MN={broll:"Dựng video one shot",text:"Chỉ chèn chữ",rebrand:"Đổi thương hiệu",voice:"Giọng đọc",win:"Nhân bản video win"};
const xvDay=t=>{const d=new Date(t);if(isNaN(d))return "";const p=n=>String(n).padStart(2,"0");return `${p(d.getDate())}/${p(d.getMonth()+1)} ${p(d.getHours())}:${p(d.getMinutes())}`};
function xvState(t){const r=t.result||{};if(t.status==="done")return ["success",r.drive_url?"Đã lưu Drive":"Xong"];if(t.status==="error")return ["bad","Lỗi"];
  if(t.status==="review")return ["warn",r.stage==="script"?"Chờ duyệt kịch bản":"Chờ duyệt"];if(t.status==="queued")return ["","Chờ dựng"];return ["run","Đang dựng"]}
function pXuongVideo(m){
  if(!document.getElementById("xv-css"))document.head.insertAdjacentHTML("beforeend",XV_CSS);
  const nav=[["order","+ Tạo order","xv-new"],["mine","Hàng đợi",""],["done","Thành phẩm",""]];
  m.innerHTML=H("Công xưởng SX video","Đặt video cho máy Worker ở văn phòng, xem bản nháp, duyệt hoặc góp ý sửa ngay tại đây")+
   `<div class="xv-wrap"><nav class="xv-nav">${nav.map(([k,n,c])=>`<button data-xwt="${k}" class="${c}${XW.tab===k?" on":""}">${n}</button>`).join("")}</nav><div id="xw-body"></div></div>`;
  m.querySelectorAll("[data-xwt]").forEach(b=>b.onclick=()=>{XW.tab=b.dataset.xwt;renderMain()});
  const body=m.querySelector("#xw-body");
  if(XW.tab==="order")xwForm(body);else{xwList(body);xwLoad(true).then(()=>{if(PAGE==="xuongvideo"&&document.body.contains(body))xwList(body)})}
}
function xvWatch(j,title){const w=document.createElement("div");w.className="xv-modal";
  w.innerHTML=`<div class="xv-modal-in"><div class="xv-modal-h"><b>${esc(title||j)}</b><button class="xv-btn" data-x>Đóng</button></div><video controls autoplay playsinline src="${xwPrev(j)}"></video></div>`;
  const close=()=>{const v=w.querySelector("video");if(v)v.pause();w.remove()};w.onclick=e=>{if(e.target===w||e.target.closest("[data-x]"))close()};document.body.appendChild(w)}

function xwForm(b){
  b.innerHTML=`<section class="xv-panel"><h2>Tạo order mới</h2><p class="hint">Máy văn phòng nhận việc trong khoảng 15 giây, dựng xong sẽ hiện ở "Hàng đợi"</p>
  <div class="frm kfrm">
   <label class="field full">Loại video<select id="xw-m">${opt(XW_MODE.map(x=>[x[0],x[1]]),"broll")}</select><small id="xw-md" class="hint"></small></label>
   <label class="field full">Link video <small id="xw-lh"></small><input id="xw-l" placeholder="Dán link Google Drive (1 video hoặc cả thư mục), hoặc link TikTok / Facebook"></label>
   <div class="field full" id="xw-gw" hidden>Thư mục có nhiều video, chị muốn:
     <span><label><input type="radio" name="xw-g" value="rieng" checked style="width:auto"> Dựng từng video riêng</label>
     <label><input type="radio" name="xw-g" value="ghep" style="width:auto"> Ghép thành 1 video</label></span></div>
   <label class="field" id="xw-pw">Sản phẩm<select id="xw-p">${opt([["","— Chọn sản phẩm —"]].concat(XW_PROD),"")}</select></label>
   <label class="field" id="xw-sw" hidden>Size / bao bì<select id="xw-s"></select></label>
   <label class="field full">Yêu cầu<textarea id="xw-n" rows="4" placeholder="Ví dụ: cắt 1 giây đầu, hook: Mẹo tẩy vết ố cổ áo trong 5 phút, dùng cảnh mới, che số điện thoại"></textarea></label>
   <label class="field full" id="xw-hw">Hook (3 giây đầu, không bắt buộc)<input id="xw-h" placeholder="Để trống thì Worker tự chọn"></label>
   <label class="field" id="xw-spw">Tốc độ video<select id="xw-sp">${opt([["0.9","Chậm hơn (0,9×)"],["1","Giữ nguyên (1×)"],["1.1","Nhanh vừa (1,1×) — nên dùng"],["1.2","Nhanh (1,2×)"],["1.3","Rất nhanh (1,3×)"]],"1.1")}</select></label>
   <label class="field" id="xw-vw" hidden>Giọng đọc<select id="xw-v">${opt(XW_VOICE,"adam")}</select></label>
   <label class="field full" id="xw-scw" hidden>Kịch bản có sẵn (không bắt buộc, để trống thì Worker tự viết theo sản phẩm và phần Yêu cầu nếu có)<textarea id="xw-sc" rows="4"></textarea></label>
   <label class="field" id="xw-cw" hidden>Số bản muốn nhân<select id="xw-c">${opt([["2","2 bản"],["3","3 bản"],["4","4 bản"],["5","5 bản"]],"3")}</select></label>
   <label class="field full" id="xw-bw" hidden>Tên hãng cũ cần bỏ (cách nhau dấu phẩy)<input id="xw-bn" placeholder="ví dụ: Oxy, Sbio"><span><label><input type="checkbox" id="xw-own" style="width:auto"> Video này của Ailla / được phép dùng lại</label></span></label>
  </div><div class="acts"><button class="btn pri" id="xw-go">Gửi Worker</button></div></section>`;
  const $$=s=>b.querySelector(s);
  const sync=()=>{const md=$$("#xw-m").value,l=$$("#xw-l").value.trim(),p=$$("#xw-p").value;
    $$("#xw-md").textContent=(XW_MODE.find(x=>x[0]===md)||[])[2]||"";
    $$("#xw-lh").textContent=md==="voice"?"(thư mục cảnh trên Drive, để trống thì Worker lấy cảnh trong kho)":md==="win"?"(link 1 video win)":"";
    $$("#xw-gw").hidden=!(md==="broll"&&xwFolder(l));$$("#xw-spw").hidden=md!=="broll";
    $$("#xw-pw").querySelector("select").options[0].text=md==="text"?"— Không cần chọn —":"— Chọn sản phẩm —";
    $$("#xw-vw").hidden=!["voice","win"].includes(md);$$("#xw-scw").hidden=md!=="voice";$$("#xw-cw").hidden=md!=="win";$$("#xw-bw").hidden=md!=="rebrand";
    const S=XW_SIZE[p];$$("#xw-sw").hidden=!S;if(S&&!$$("#xw-s").options.length)$$("#xw-s").innerHTML=opt(S,S[0][0]);if(!S)$$("#xw-s").innerHTML=""};
  ["#xw-m","#xw-p"].forEach(s=>$$(s).onchange=sync);$$("#xw-l").oninput=sync;$$("#xw-p").addEventListener("change",()=>{$$("#xw-s").innerHTML="";sync()});sync();
  $$("#xw-go").onclick=async()=>{
    const md=$$("#xw-m").value,link=$$("#xw-l").value.trim(),sku=$$("#xw-p").value,size=$$("#xw-s").value||"",hook=$$("#xw-h").value.trim();let note=$$("#xw-n").value.trim();
    if(md!=="voice"&&!/^https?:\/\//i.test(link)){toast("Dán link video trước");$$("#xw-l").focus();return}
    if(md==="voice"&&link&&!xwFolder(link)){toast("Giọng đọc: link phải là THƯ MỤC cảnh trên Drive, hoặc để trống");return}
    if(md==="win"&&xwFolder(link)){toast("Nhân bản video win: dán link 1 video, không phải thư mục");return}
    if(md!=="text"&&!sku){toast("Chọn sản phẩm");$$("#xw-p").focus();return}
    if(md==="rebrand"&&$$("#xw-bn").value.trim()&&!$$("#xw-own").checked){toast("Tích xác nhận video của Ailla thì mới đổi thương hiệu được");return}
    const order={mode:md,link,sku:md==="text"&&!sku?"":sku,packaging:size,hook,note};
    if(md==="broll"&&xwFolder(link))order.folder_plan=b.querySelector('input[name="xw-g"]:checked').value==="ghep"?"merge":"each";
    if(md==="broll")order.speed=Number($$("#xw-sp").value);
    if(md==="voice"){order.voice=$$("#xw-v").value;order.brief=note;order.script=$$("#xw-sc").value.trim()}
    if(md==="win"){order.voice=$$("#xw-v").value;order.variants=Number($$("#xw-c").value);order.brief=note}
    if(md==="rebrand"){order.ban_names=$$("#xw-bn").value.trim();order.owned=$$("#xw-own").checked}
    const pn=(XW_PROD.find(x=>x[0]===sku)||[])[1]||"",mn=(XW_MODE.find(x=>x[0]===md)||[])[1];
    const ref="XV-"+Date.now().toString(36).toUpperCase();
    const btn=$$("#xw-go");btn.disabled=true;btn.textContent="Đang gửi…";
    try{await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"xuong_build",ref,payload:{order,by:ME.name,tg:xwAdmin()?"chi":ME.name,owner:ME.name,label:`${mn}${pn?" · "+pn:""} · ${ME.name}`,src:"xuong"}})});
      toast("Đã gửi Worker");XW.tab="mine";XW.at=0;renderMain()}
    catch(e){toast("Chưa gửi được: "+e.message);btn.disabled=false;btn.textContent="Gửi Worker"}};
}

function xwList(b){
  const all=xwMine(),done=XW.tab==="done";
  const base=XW.list.filter(t=>t.kind==="xuong_build"&&t.payload&&(!done||t.status==="done")&&(done||t.status!=="done"));
  const people=xwAdmin()?[...new Set(base.filter(t=>t.payload.by).map(t=>t.payload.by))]:[];
  const chips=xwAdmin()&&people.length?`<div class="xv-filter">${[""].concat(people).map(k=>`<button class="xv-btn${XW.who===k?" on":""}" data-xww="${esc(k)}">${k?"👤 "+esc(k)+" ("+base.filter(t=>t.payload.by===k).length+")":"Tất cả ("+base.length+")"}</button>`).join("")}</div>`:"";
  const prodN=o=>(XW_PROD.find(x=>x[0]===o.sku)||[])[1]||(o.sku||"Không chọn sản phẩm");
  const err=XW.err?`<div class="warn">Chưa tải được danh sách: ${esc(XW.err)}</div>`:"";
  if(done){
    const L=all.filter(t=>t.status==="done");
    const rows=L.map(t=>{const p=t.payload||{},o=p.order||{},r=t.result||{};return `<tr><td><b>${esc(t.worker_job||t.ref||t.id)}</b>${xwAdmin()?`<small>👤 ${esc(p.by||"")}</small>`:""}</td><td>${esc(prodN(o))}<small>${esc(XV_MN[o.mode]||o.mode||"")}</small></td><td class="nw">${esc(xvDay(t.created_at))}</td><td class="nw">${esc(xvDay(t.updated_at))}</td>
      <td class="xv-link">${r.drive_url?`<a href="${esc(r.drive_url)}" target="_blank" rel="noopener">${esc(r.drive_url)}</a><button class="xv-btn" data-xwcp="${esc(r.drive_url)}">Chép link</button>`:`<span class="hint">chưa có link Drive</span>`}</td></tr>`}).join("");
    b.innerHTML=`<section class="xv-panel"><h2>Thành phẩm</h2>${chips}${err}${L.length?`<div class="xv-scroll"><table class="xv-table"><thead><tr><th>Mã</th><th>Sản phẩm · loại việc</th><th>Ngày order</th><th>Ngày duyệt</th><th>Link Drive</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="xv-empty">${XW.at?"Chưa có video nào lưu Drive.":"Đang tải…"}</div>`}</section>`;
  }else{
    const rank=t=>["running","taken"].includes(t.status)?0:t.status==="queued"?1:t.status==="review"?2:3;
    const L=all.filter(t=>t.status!=="done").sort((a,c)=>rank(a)-rank(c)||(rank(a)===1?String(a.created_at).localeCompare(String(c.created_at)):String(c.created_at).localeCompare(String(a.created_at))));
    const row=t=>{const p=t.payload||{},o=p.order||{},r=t.result||{},j=t.worker_job,[sc,lab]=xvState(t),rv=t.status==="review";
      let acts="",extra="";
      if(rv&&r.stage==="script"){extra=`<div class="xv-fix"><small>Kịch bản Worker viết (sửa trực tiếp được):</small><textarea data-xwscr="${t.id}">${esc(r.script||"")}</textarea></div>`;
        acts=`<button class="xv-btn ok" data-xwso="${t.id}">✅ Duyệt kịch bản</button><button class="xv-btn" data-xwse="${t.id}">💾 Lưu kịch bản đã sửa</button><button class="xv-btn" data-xwsf="${t.id}">✏️ Nhờ viết lại</button>`}
      else{if(j&&rv){acts=`<button class="xv-btn" data-xwv="${t.id}">▶ Xem video</button><button class="xv-btn ok" data-xwok="${t.id}">✅ Duyệt</button><button class="xv-btn" data-xwfx="${t.id}">✏️ Cần sửa</button>`;
          extra=`<div class="xv-fix" data-xwfb="${t.id}" hidden><textarea placeholder="Cần sửa gì? Ví dụ: đổi hook mạnh hơn, bỏ cảnh thứ 2, chữ to hơn"></textarea><div><button class="xv-btn ok" data-xwfs="${t.id}">Gửi góp ý</button></div></div>`}
        if(t.status==="error"&&j)acts+=`<button class="xv-btn" data-xwre="${t.id}">🔄 Làm lại</button>`}
      const pr=["running","taken"].includes(t.status)?Math.max(0,Math.min(100,t.progress||0)):t.status==="review"?100:0;
      return `<div class="xv-job"><div><strong>${esc(j||t.ref||t.id)}</strong><small>${esc(XV_MN[o.mode]||o.mode||"")}</small><small class="xv-who">👤 ${esc(p.by||"Không rõ")} · ${esc(xvDay(t.created_at))}</small></div>
        <div><strong>${esc(prodN(o))}</strong><small class="${t.status==="error"?"t-red":""}">${esc(t.detail||(t.status==="queued"?"Chờ máy văn phòng nhận việc":""))}</small>${o.note?`<small>Yêu cầu: ${esc(o.note)}</small>`:""}${acts?`<div class="xv-actions">${acts}</div>`:""}${extra}</div>
        <div><span class="xv-pill ${sc}">${lab}</span>${t.status==="error"?"":`<div class="xv-progress"><i style="width:${pr}%"></i><span class="pct">${pr}%</span></div>`}</div></div>`};
    b.innerHTML=`<section class="xv-panel"><h2>Hàng đợi</h2>${chips}${err}${L.length?L.map(row).join(""):`<div class="xv-empty">${XW.at?"Hàng đợi đang trống. Bấm \"+ Tạo order\" để gửi video cho Worker.":"Đang tải…"}</div>`}</section>`;
  }
  const T=id=>XW.list.find(x=>x.id===id);
  const after=(er,ok)=>{toast(er?"Chưa gửi được: "+er:ok);XW.at=0;xwLoad(true).then(()=>xwList(b))};
  b.querySelectorAll("[data-xww]").forEach(x=>x.onclick=()=>{XW.who=x.dataset.xww;xwList(b)});
  b.querySelectorAll("[data-xwcp]").forEach(x=>x.onclick=()=>{try{navigator.clipboard.writeText(x.dataset.xwcp).then(()=>toast("Đã chép link"),()=>toast("Không chép được, bấm vào link rồi chép"))}catch(e){toast("Không chép được")}});
  b.querySelectorAll("[data-xwv]").forEach(x=>x.onclick=()=>{const t=T(x.dataset.xwv);if(t&&t.worker_job)xvWatch(t.worker_job,(t.payload||{}).label)});
  b.querySelectorAll("[data-xwok]").forEach(x=>x.onclick=async()=>{x.disabled=true;after(await xwAct("xuong_ok",T(x.dataset.xwok)),"Đã duyệt, Worker đang lưu lên Drive")});
  b.querySelectorAll("[data-xwfx]").forEach(x=>x.onclick=()=>{const f=b.querySelector(`[data-xwfb="${x.dataset.xwfx}"]`);f.hidden=!f.hidden;if(!f.hidden)f.querySelector("textarea").focus()});
  b.querySelectorAll("[data-xwfs]").forEach(x=>x.onclick=async()=>{const n=x.closest(".xv-fix").querySelector("textarea").value.trim();if(!n){toast("Ghi cần sửa gì trước");return}x.disabled=true;after(await xwAct("xuong_fix",T(x.dataset.xwfs),{note:n}),"Đã gửi góp ý, Worker dựng lại")});
  b.querySelectorAll("[data-xwso]").forEach(x=>x.onclick=async()=>{x.disabled=true;after(await xwAct("xuong_script_ok",T(x.dataset.xwso)),"Đã duyệt kịch bản, Worker tạo giọng và ghép cảnh")});
  b.querySelectorAll("[data-xwse]").forEach(x=>x.onclick=async()=>{const s=b.querySelector(`[data-xwscr="${x.dataset.xwse}"]`).value.trim();if(!s){toast("Kịch bản đang trống");return}x.disabled=true;after(await xwAct("xuong_script_edit",T(x.dataset.xwse),{script:s}),"Đã lưu kịch bản, Worker dùng bản này")});
  b.querySelectorAll("[data-xwsf]").forEach(x=>x.onclick=async()=>{const n=prompt("Cần sửa kịch bản thế nào?");if(!n||!n.trim())return;x.disabled=true;after(await xwAct("xuong_script_fix",T(x.dataset.xwsf),{note:n.trim()}),"Đã gửi góp ý, Worker viết lại kịch bản")});
  b.querySelectorAll("[data-xwre]").forEach(x=>x.onclick=async()=>{x.disabled=true;after(await xwAct("xuong_redo",T(x.dataset.xwre)),"Đã nhờ Worker làm lại")});
}
/* 11/10 chị chốt: mục "Công xưởng SX video" là nơi MỞ THẲNG trang Worker thật (video-worker.ailla.vn), nhân sự đăng nhập
   tài khoản riêng ở đó. Bản trang riêng pXuongVideo ở trên giữ lại, không dùng nữa. */
const XV_URL="https://congxuong.ailla.vn/";
let XV_OPENED=0;
function pXuongMo(m){
  if(Date.now()-XV_OPENED>3000){XV_OPENED=Date.now();try{window.open(XV_URL,"_blank","noopener")}catch(e){}}
  m.innerHTML=H("Công xưởng SX video","Đặt video, xem bản nháp, duyệt hoặc góp ý sửa trên trang Worker của công ty")+
   `<section class="card" style="max-width:640px"><div class="card-h"><h2>Mở Công xưởng SX video</h2></div>
   <p>Trang Công xưởng mở ở thẻ mới. Đăng nhập bằng <b>tài khoản Worker riêng</b> của bạn (hỏi chị Hoa nếu chưa có).
   Máy Worker ở văn phòng phải đang bật thì video mới được dựng; order gửi lúc máy tắt sẽ chờ.</p>
   <p><a class="btn" href="${XV_URL}" target="_blank" rel="noopener">🎬 Mở Công xưởng SX video</a></p></section>`;
}
PAGES.xuongvideo=pXuongMo;
/* Tự cập nhật 15 giây/lần khi đang mở danh sách (không đụng tới form đặt order, không làm mất chữ đang gõ) */
setInterval(()=>{if(typeof ME==="undefined"||!ME||typeof PAGE==="undefined"||PAGE!=="xuongvideo"||XW.tab==="order")return;
  const b=document.getElementById("xw-body");if(!b)return;
  xwLoad(false).then(()=>{const a=document.activeElement;if(a&&b.contains(a)&&/TEXTAREA|INPUT/.test(a.tagName))return;if(PAGE==="xuongvideo"&&XW.tab!=="order"&&document.body.contains(b))xwList(b)})},15000);
