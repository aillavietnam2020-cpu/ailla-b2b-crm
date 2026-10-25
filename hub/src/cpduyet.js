/* =====================================================================
   CHI PHÍ: chị Thảo ghi nhanh, web đề xuất khoản chi + kênh, chị Huệ duyệt và phân bổ.
   - Khoản chờ duyệt nằm ở D().costsCho, chưa đụng vào lãi lỗ. Duyệt xong chuyển sang D().costs (nguồn mọi báo cáo).
   - Khoản chỉ để đối chiếu (nạp quảng cáo, phí sàn đã có trong báo cáo sàn, chuyển nhầm) chuyển sang D().costsDoiChieu,
     không cộng vào chi phí để khỏi tính hai lần.
   - Mua nguyên vật liệu, vỏ, bao bì không ghi ở đây: lập Phiếu mua hàng rồi Phiếu chi nhà cung cấp (đi vào giá vốn).
   - Web nhớ cách chị Huệ đã duyệt (D().cpRules): lần sau thấy diễn giải tương tự thì đề xuất giống.
   Ba loại chi phí: A trực tiếp kênh · B của phòng ban · C chi chung công ty (chia cho kênh theo quy tắc chị Huệ chọn).
   ===================================================================== */
const CP_CATS_NEW=[
 ["ADS-SPE","Quảng cáo Shopee","Marketing","Biến đổi","Kênh","ADS"],
 ["HH-VH","Hoa hồng vận hành TikTok","Nhân sự","Biến đổi","Kênh","B2C"],
 ["TONGDAI","Tổng đài, điện thoại sale","Bán hàng","Cố định","Kênh","B2C"],
 ["CUOC-NPP","Cước xe giao NPP / đại lý","Logistics","Biến đổi","Kênh","KV"],
 ["DG-B2C","Đóng hàng đơn B2C lẻ (băng dính, chống sốc)","Logistics","Biến đổi","Kênh","KV"],
 ["VAT","VAT trả nhà cung cấp","Tài chính","Biến đổi","Toàn công ty","KT"],
 ["CCDC","Phân bổ CCDC (gồm thuê văn phòng, xưởng)","Vận hành","Cố định","Toàn công ty","KT"],
 ["TBI","Mua sắm máy móc, thiết bị","Vận hành","Biến đổi","Toàn công ty","BDH"],
 ["DV","Dịch vụ thuê ngoài (kế toán thuế, tuyển dụng)","Vận hành","Cố định","Toàn công ty","KT"],
 ["LE","Lễ, văn hóa, phúc lợi","Nhân sự","Biến đổi","Toàn công ty","HCNS"],
 ["DEN-BU","Đền bù, hoàn tiền cho khách","Bán hàng","Biến đổi","Kênh","B2C"],
 ["VATTU","Vật tư nhỏ xưởng, văn phòng","Vận hành","Biến đổi","Toàn công ty","BDH"],
 ["CHUA-ROAT","Chưa rõ, chờ chị Huệ xem","Khác","Biến đổi","Toàn công ty","KT"],
 ["NAP-ADS","Nạp tiền quảng cáo (chỉ đối chiếu)","Marketing","Biến đổi","Kênh","ADS"],
 ["TRUNG","Đã có trong báo cáo sàn (không tính lại)","Khác","Biến đổi","Kênh","KT"],
 ["NHAM","Chuyển nhầm, không phải chi phí","Khác","Biến đổi","Toàn công ty","KT"]
].map(r=>({k:r[0],n:r[1],nhom:r[2],loai:r[3],phanBo:r[4],pb:r[5],note:""}));
const CP_BO={"NAP-ADS":"Tiền nạp: chi tiêu thật lấy từ báo cáo quảng cáo","TRUNG":"Đã nằm trong báo cáo sàn","NHAM":"Không phải chi phí"};
const CP_KENH=()=>[...(D().saleChannels||[]).filter(c=>c.active!==false).map(c=>c.n),"Gia công"];
const cpEnsureCats=dt=>{if(!dt.costCats)dt.costCats=[];CP_CATS_NEW.forEach(c=>{if(!dt.costCats.some(x=>x.k===c.k))dt.costCats.push({...c})})};
const cpKey=t=>kfold(t).replace(/[0-9.\/,]+/g," ").replace(/\s+/g," ").trim().slice(0,60);
const cpCan=()=>!!ME&&(ME.role==="admin"||mhPerm("order.accounting.confirm"));
const cpCat=k=>(D().costCats||[]).find(c=>c.k===k)||CP_CATS_NEW.find(c=>c.k===k)||{k,n:k,nhom:"Khác",phanBo:"Toàn công ty"};
const cpLoai=(cat,kenh)=>kenh||cpCat(cat).phanBo==="Kênh"?"A":cpCat(cat).phanBo==="Phòng ban"?"B":"C";
const CP_LOAI_TXT={A:"A · trực tiếp kênh",B:"B · của phòng ban",C:"C · chi chung công ty"};
/* Đề xuất khoản chi từ diễn giải. Trả về {cat,kenh,pb,ly,chac}. */
function cpDeXuat(text){
  const d=D(),rule=(d.cpRules||{})[cpKey(text)];
  if(rule&&rule.cat)return {cat:rule.cat,kenh:rule.kenh||"",pb:rule.pb||"",ly:"giống lần chị Huệ đã duyệt",chac:true};
  const t=" "+kfold(text)+" ",has=re=>re.test(t),FB="Facebook / Pancake",TT="TikTok Shop",SP="Shopee",NPP="B2B / Đại lý (CRM)";
  const kenhSan=has(/tiktok|tikotk/)?TT:has(/shopee|shopemall/)?SP:"";
  const R=[
   [/quang cao|nap tien qc|nap qc/,()=>({cat:"NAP-ADS",kenh:kenhSan||FB,ly:"nạp tiền quảng cáo"})],
   [/phi tiktok|cp shopee|phi shopee|phi san/,()=>({cat:"TRUNG",kenh:kenhSan,ly:"phí sàn đã có trong báo cáo sàn"})],
   [/spx|best|cpvc|gui hang|rut tien|j&t|cuoc lay hang|cuoc gui hang/,()=>({cat:"VC",kenh:FB,ly:"cước giao đơn"})],
   [/cuoc xe/,()=>({cat:"CUOC-NPP",kenh:NPP,ly:"cước xe giao NPP"})],
   [/capcut|veo 3|chatgpt|canva|midjourney/,()=>({cat:"TOOL",pb:"CM",ly:"công cụ team marketing"})],
   [/dien thoai sale|tong dai|\bity\b/,()=>({cat:"TONGDAI",kenh:FB,ly:"hỗ trợ sale, chạy ads Facebook"})],
   [/hoa hong.*(tiktok|van hanh)|van hanh tiktok/,()=>({cat:"HH-VH",kenh:TT,ly:"hoa hồng vận hành TikTok"})],
   [/thuong/,()=>({cat:"THUONG",pb:"HCNS",ly:"thưởng"})],
   [/luong/,()=>({cat:"LUONG",pb:"HCNS",ly:"lương (chọn kênh nếu lương riêng kênh)"})],
   [/bao hiem/,()=>({cat:"BH",pb:"HCNS",ly:"bảo hiểm"})],
   [/ccdc|phan bo chi phi/,()=>({cat:"CCDC",pb:"KT",ly:"phân bổ CCDC (gồm thuê)"})],
   [Object.assign(/[^a-zà-ỹ]vat[^a-zà-ỹ]/,{raw:1}),()=>({cat:"VAT",pb:"KT",ly:"VAT trả nhà cung cấp"})],
   [/ke toan thue|tuyen dung|thue ngoai/,()=>({cat:"DV",pb:"KT",ly:"dịch vụ thuê ngoài"})],
   [/mang|tien dien|vps|the dien thoai|dien thoai|tien nuoc/,()=>({cat:"DIEN",pb:"BDH",ly:"điện, mạng, điện thoại"})],
   [/\bnoi\b|\bquat\b|may tit|may dan|thiet bi|\bmay\b/,()=>({cat:"TBI",pb:"BDH",ly:"mua sắm thiết bị"})],
   [/bang dinh|chong soc|dong hang|bang keo dong/,()=>({cat:"DG-B2C",ly:"đóng hàng đơn B2C lẻ, chọn kênh"})],
   [/do le|trung thu|thap huong|do lo/,()=>({cat:"LE",pb:"HCNS",ly:"lễ, văn hóa"})],
   [/hoan tien|bu don|tui giat|thu nham|den bu|bu cho khach/,()=>({cat:"DEN-BU",kenh:"",ly:"đền bù, hoàn tiền khách, chọn kênh"})],
   [/ck nham|chuyen nham/,()=>({cat:"NHAM",ly:"chuyển nhầm"})],
   [/mua do|choi|nuoc uong|bang keo|do duoi xuong|do cho xuong|mau sap|mau thu|\btest\b/,()=>({cat:"VATTU",pb:"BDH",ly:"vật tư nhỏ"})]
  ];
  const raw=" "+String(text).toLowerCase()+" ";
  for(const [re,f] of R)if(re.test(re.raw?raw:t)){return {kenh:"",pb:"",...f(),chac:true}}
  return {cat:"CHUA-ROAT",kenh:"",pb:"",ly:"web chưa đoán được, chị Huệ chọn",chac:false};
}
const cpNote=x=>x.note||"";
/* ---------- Chị Thảo ghi nhanh ---------- */
function cpQuick(){
  const today=mhToday();
  openDrawerHTML(`<h2>Ghi chi phí</h2><p class="hint">Chỉ cần ngày, số tiền, diễn giải, ảnh bill. Web đề xuất khoản chi và kênh, chị Huệ duyệt.</p>
  <div class="note amb">Mua nguyên vật liệu, vỏ, bao bì: đừng ghi ở đây. Lập <b>Phiếu mua hàng</b> khi đặt, khi trả tiền ghi <b>Phiếu chi nhà cung cấp</b> gắn phiếu mua đó (đi vào giá vốn).</div>
  <form class="frm" id="cqf">
   <label class="field">Diễn giải (ghi như trên sổ: "Nạp quảng cáo FB", "Cước xe", "Mua quạt dưới xưởng"…)<input id="cqf-n" required></label>
   <div class="row4"><label class="field">Số tiền (đ)<input id="cqf-t" type="number" min="1" required></label><label class="field">Ngày chi<input id="cqf-d" type="date" value="${today}" required></label></div>
   ${mhPayMethodHtml("cqf")}
   <div id="cqf-e"></div><div id="cqf-g" class="hint"></div><button class="btn pri">Gửi chị Huệ</button></form>`);
  mhPayMethodBind("cqf","");
  $("#cqf-n").oninput=e=>{const x=cpDeXuat(e.target.value);$("#cqf-g").innerHTML=e.target.value.length>2?`Web đề xuất: <b>${esc(cpCat(x.cat).n)}</b>${x.kenh?" · "+esc(x.kenh):""} <span class="hint">(${esc(x.ly)})</span>`:""};
  $("#cqf").onsubmit=async e=>{e.preventDefault();const pm=mhPayMethodRead("cqf"),err=t=>{$("#cqf-e").innerHTML=`<div class="note red">${esc(t)}</div>`};
    if(pm.method==="CHUYEN_KHOAN"&&(!pm.from_account||!pm.to_account_no))return err("Chuyển khoản: chọn tài khoản công ty chi tiền và ghi số tài khoản nhận.");
    const tien=+$("#cqf-t").value;if(!(tien>0))return err("Nhập số tiền.");
    const btn=e.submitter||document.querySelector("#cqf button.pri");if(btn)btn.disabled=true;
    const id=uid("cp"),ngay=$("#cqf-d").value,note=$("#cqf-n").value.trim(),de=cpDeXuat(note);
    DB.mutate(ME.name,"ghi chi phí chờ duyệt",dt=>{cpEnsureCats(dt);if(!dt.costsCho)dt.costsCho=[];dt.costsCho.push({id,ngay,thang:ngay.slice(0,7),tien,note,by:ME.name,at:Date.now(),de,...pm})});
    let up=0;for(const f of [...$("#cqf-f").files]){try{const x=await mhPrepFile(f);await kApi("/mh/costs/"+id+"/files",{method:"POST",body:JSON.stringify(x)});up++}catch(er){toast(er.message)}}
    closeDrawer();toast("Đã gửi chị Huệ phân bổ"+(up?", đính kèm "+up+" ảnh":""));SOCP.files=null;if(["cp_duyet","so_cp"].includes(PAGE))renderMain()}}
spForm=cpQuick;
/* ---------- Dán nhiều dòng từ sổ MISA ---------- */
function cpParseMisa(txt){
  const out=[],num=s=>{const v=String(s||"").replace(/\./g,"").replace(/,/g,".").trim();return /^-?\d+(\.\d+)?$/.test(v)?+v:null};
  String(txt||"").split(/\r?\n/).forEach(line=>{
    const c=line.split("\t").map(x=>x.trim());if(c.length<2)return;
    const dm=c.map(x=>x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)).find(Boolean);if(!dm)return;
    const ngay=dm[3]+"-"+dm[2].padStart(2,"0")+"-"+dm[1].padStart(2,"0");
    let ix=-1;c.forEach((x,i)=>{if(!/^[\d.,\-]*$/.test(x)&&!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(x)&&!/^(BN|NVK|PBCC)\d+/.test(x)&&(ix<0||x.length>c[ix].length))ix=i});if(ix<0)return;
    const note=c[ix];if(!note||/^(\d|BN|NVK|PBCC)/.test(note))return;
    const after=c.slice(ix+1).filter(x=>x!=="");const tien=after.length>=2?num(after[1]):num(after[0]);
    if(!tien||tien<=0||/kết chuyển/i.test(note))return;
    out.push({ngay,note,tien})});
  return out;
}
function cpPaste(){
  openDrawerHTML(`<h2>Dán từ sổ MISA</h2><p class="hint">Mở file sổ (ví dụ Sổ chi phí 642), bôi chọn các dòng chi (cột Ngày … Diễn giải … Nợ), sao chép rồi dán vào ô dưới. Dòng trùng ngày + số tiền + diễn giải đã có sẽ được bỏ qua. Ảnh bill bổ sung sau.</p>
  <textarea id="cpp-t" rows="9" class="mhq" style="width:100%" placeholder="02/09/2026 BN3594 02/09/2026 Mua VPS 1 tháng 1121 183150 0"></textarea>
  <div id="cpp-r" class="hint"></div><button class="btn" id="cpp-c">Xem trước</button> <button class="btn pri" id="cpp-ok" hidden>Đưa vào Chờ phân bổ</button>`);
  let rows=[];
  $("#cpp-c").onclick=()=>{rows=cpParseMisa($("#cpp-t").value);const d=D(),have=new Set([...(d.costs||[]),...(d.costsCho||[]),...(d.costsDoiChieu||[])].map(x=>[x.ngay||x.thang,x.tien,x.note||""].join("|")));
    rows=rows.filter(r=>!have.has([r.ngay,r.tien,r.note].join("|")));
    $("#cpp-r").innerHTML=rows.length?`<b>${rows.length} dòng</b> sẽ gửi, tổng ${nf(Math.round(rows.reduce((t,r)=>t+r.tien,0)))} đ. Web đoán chắc: ${rows.filter(r=>cpDeXuat(r.note).chac).length} dòng.`:"Không tìm thấy dòng nào mới (cần có ngày dd/mm/yyyy, diễn giải, số tiền).";$("#cpp-ok").hidden=!rows.length};
  $("#cpp-ok").onclick=()=>{if(!rows.length)return;DB.mutate(ME.name,"dán chi phí từ sổ MISA",dt=>{cpEnsureCats(dt);if(!dt.costsCho)dt.costsCho=[];rows.forEach(r=>dt.costsCho.push({id:uid("cp"),ngay:r.ngay,thang:r.ngay.slice(0,7),tien:r.tien,note:r.note,by:ME.name,at:Date.now(),method:"CHUYEN_KHOAN",de:cpDeXuat(r.note)}))});
    closeDrawer();toast("Đã đưa "+rows.length+" khoản vào Chờ phân bổ");renderMain()}}
/* ---------- Chị Huệ duyệt và phân bổ ---------- */
const CP_ST={sel:{}};
function cpApprove(ids){
  const d=D(),pick=id=>{const r=CP_ST.sel[id]||{},p=(d.costsCho||[]).find(x=>x.id===id),de=(p&&p.de)||{};return {cat:r.cat||de.cat,kenh:r.kenh!=null?r.kenh:(de.kenh||""),pb:r.pb!=null?r.pb:(de.pb||"")}};
  const bad=ids.filter(id=>{const v=pick(id);return v.cat==="CHUA-ROAT"||(cpCat(v.cat).phanBo==="Kênh"&&!CP_BO[v.cat]&&!v.kenh&&v.cat!=="VC")});
  const ok=ids.filter(id=>!bad.includes(id));
  if(!ok.length){toast("Còn thiếu: chọn khoản chi thật và kênh cho dòng loại A.");return}
  const V={};ok.forEach(id=>{V[id]=pick(id)});
  DB.mutate(ME.name,"duyệt chi phí",dt=>{cpEnsureCats(dt);if(!dt.costs)dt.costs=[];if(!dt.costsDoiChieu)dt.costsDoiChieu=[];if(!dt.cpRules)dt.cpRules={};
    ok.forEach(id=>{const i=(dt.costsCho||[]).findIndex(x=>x.id===id);if(i<0)return;const p=dt.costsCho.splice(i,1)[0],v=V[id],{de,...rest}=p;
      const row={...rest,cat:v.cat,kenh:v.kenh,pb:v.pb,sku:"",duyet:ME.name,duyetAt:Date.now()};
      (CP_BO[v.cat]?dt.costsDoiChieu:dt.costs).push(row);
      dt.cpRules[cpKey(p.note)]={cat:v.cat,kenh:v.kenh,pb:v.pb}})});
  ok.forEach(id=>delete CP_ST.sel[id]);
  toast("Đã duyệt "+ok.length+" khoản"+(bad.length?`, còn ${bad.length} dòng thiếu thông tin`:""));renderMain()}
function pCpDuyet(m){
  const d=D(),can2=cpCan(),L=(d.costsCho||[]).slice().sort((a,b)=>String(a.ngay).localeCompare(String(b.ngay))),cats=(d.costCats||[]).slice(),have=new Set(cats.map(c=>c.k));
  CP_CATS_NEW.forEach(c=>{if(!have.has(c.k))cats.push(c)});
  const catOpt=cats.map(c=>[c.k,c.n]),kenhOpt=[["","— chưa chọn —"]].concat(CP_KENH().map(k=>[k,k])),pbOpt=[["","—"]].concat((d.departments||[]).map(p=>[p.k,p.n]));
  const val=x=>{const r=CP_ST.sel[x.id]||{},de=x.de||{};return {cat:r.cat||de.cat,kenh:r.kenh!=null?r.kenh:(de.kenh||""),pb:r.pb!=null?r.pb:(de.pb||"")}};
  const chac=L.filter(x=>(x.de||{}).chac&&val(x).cat!=="CHUA-ROAT"&&(val(x).kenh||cpCat(val(x).cat).phanBo!=="Kênh"||CP_BO[val(x).cat]||val(x).cat==="VC"));
  const tong=L.reduce((t,x)=>t+x.tien,0),files=SOCP.files||{};spLoadFiles();
  const doi=(d.costsDoiChieu||[]);
  m.innerHTML=H("Chờ phân bổ","Chị Thảo ghi, web đề xuất, chị Huệ duyệt · "+L.length+" khoản · "+nf(Math.round(tong))+" đ")+
  `<div class="filters"><button class="btn pri" id="cp-new">＋ Ghi chi phí</button>${can2?`<button class="btn" id="cp-paste">Dán từ sổ MISA</button>`:""}<span class="sp"></span>${can2&&chac.length?`<button class="btn pri" id="cp-all">Duyệt ${chac.length} dòng web đoán chắc</button>`:""}</div>
  ${can2?"":`<div class="note amb">Chị Huệ (kế toán) hoặc chị Hoa duyệt. Em chỉ xem được trạng thái.</div>`}
  <section class="card flush">${L.length?tbl(["Ngày","Diễn giải","Số tiền","Khoản chi","Kênh","Phòng ban","Loại","Ảnh",""],L.map(x=>{const v=val(x),lo=cpLoai(v.cat,v.kenh),bo=CP_BO[v.cat],de=x.de||{};
    return `<tr data-id="${x.id}"><td>${esc(kDd(x.ngay))}</td><td><b>${esc(x.note)}</b><div class="hint">${esc(x.by||"")} · ${de.chac?esc(de.ly):`<span class="t-red">${esc(de.ly||"chưa rõ")}</span>`}</div></td><td class="n"><b>${nf(Math.round(x.tien))}</b></td>
    <td>${can2?`<select data-f="cat">${opt(catOpt,v.cat)}</select>`:esc(cpCat(v.cat).n)}</td>
    <td>${can2?`<select data-f="kenh">${opt(kenhOpt,v.kenh)}</select>`:esc(v.kenh||"—")}</td>
    <td>${can2?`<select data-f="pb">${opt(pbOpt,v.pb)}</select>`:esc((d.departments.find(p=>p.k===v.pb)||{}).n||"—")}</td>
    <td>${bo?`<span class="hint">${esc(bo)}</span>`:pill(CP_LOAI_TXT[lo],lo==="A"?"blu":lo==="B"?"amb":"gry")}</td>
    <td>${files[x.id]?pill(files[x.id]+" ảnh","blu"):`<span class="hint">chưa có</span>`} <button class="btn sm" data-fi="${x.id}">Ảnh</button></td>
    <td class="nowrap">${can2?`<button class="btn sm pri" data-ok="${x.id}">Duyệt</button> <button class="btn sm danger" data-del="${x.id}">Xóa</button>`:""}</td></tr>`})):`<p class="empty pad">Không có khoản nào chờ. Chị Thảo ghi bằng nút "＋ Ghi chi phí" hoặc dán từ sổ MISA.</p>`}</section>
  <p class="hint">Loại <b>A</b> đi thẳng vào kênh · <b>B</b> của phòng ban (chọn kênh nếu là lương riêng một kênh) · <b>C</b> chi chung công ty, chia cho kênh theo quy tắc ở Sổ chi phí. Nạp quảng cáo, phí sàn đã có trong báo cáo sàn và chuyển nhầm chỉ để đối chiếu, không cộng vào chi phí. ${doi.length?`Đã đối chiếu: ${doi.length} khoản, ${nf(Math.round(doi.reduce((t,x)=>t+x.tien,0)))} đ.`:""}</p>`;
  $("#cp-new").onclick=()=>cpQuick();if($("#cp-paste"))$("#cp-paste").onclick=()=>cpPaste();
  if($("#cp-all"))$("#cp-all").onclick=()=>{if(confirm("Duyệt "+chac.length+" dòng theo đề xuất của web?"))cpApprove(chac.map(x=>x.id))};
  m.querySelectorAll("tr[data-id]").forEach(tr=>{const id=tr.dataset.id;tr.querySelectorAll("select[data-f]").forEach(s=>s.onchange=()=>{const r=CP_ST.sel[id]||(CP_ST.sel[id]={});r[s.dataset.f]=s.value;
    if(s.dataset.f==="cat"){const p=(D().costCats||[]).find(c=>c.k===s.value)||CP_CATS_NEW.find(c=>c.k===s.value);if(p&&!r.pb&&p.pb)r.pb=p.pb}renderMain()})});
  m.querySelectorAll("[data-ok]").forEach(b=>b.onclick=()=>cpApprove([b.dataset.ok]));
  m.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const x=L.find(y=>y.id===b.dataset.del);if(!confirm("Xóa khoản \""+x.note+"\" ("+nf(Math.round(x.tien))+" đ)?"))return;DB.mutate(ME.name,"xóa chi phí chờ duyệt",dt=>{dt.costsCho=(dt.costsCho||[]).filter(c=>c.id!==x.id)});renderMain()});
  m.querySelectorAll("[data-fi]").forEach(b=>b.onclick=()=>{const x=L.find(y=>y.id===b.dataset.fi);spFiles(x.id,x.note)});
}
PAGES.cp_duyet=pCpDuyet;
/* ---------- Sổ chi phí: báo chờ phân bổ + bảng ba loại và kênh gánh bao nhiêu ---------- */
function cpNapTieu(N){
  const d=D(),inP=c=>c.ngay?spInP(c.ngay):spMonthIn(c.thang),C=N.C||{},nap={};
  (d.costsDoiChieu||[]).filter(c=>c.cat==="NAP-ADS"&&inP(c)).forEach(c=>{nap[c.kenh||"Chưa rõ kênh"]=(nap[c.kenh||"Chưa rõ kênh"]||0)+(+c.tien||0)});
  const rows=[["Facebook / Pancake",C.adsFB||0],["TikTok Shop",C.adsTT||0],["Shopee",C.adsSPE||0]].filter(r=>r[1]||nap[r[0]]);
  if(!rows.length)return "";
  return `<div class="card-h pad"><h2>Tiền nạp quảng cáo so với tiền tiêu thật</h2><span class="hint">lãi lỗ dùng tiền tiêu thật; tiền nạp lấy từ sổ MISA đã duyệt ở Chờ phân bổ</span></div>${tbl(["Kênh","Đã nạp (sổ)","Đã tiêu (báo cáo ads)","Nạp trừ tiêu"],rows.map(([k,t])=>{const n=nap[k]||0;return `<tr><td><b>${esc(k)}</b></td><td class="n">${n?nf(Math.round(n)):"—"}</td><td class="n">${t?nf(Math.round(t)):"—"}</td><td class="n ${n&&t&&n-t<0?"t-red":""}">${n&&t?nf(Math.round(n-t)):"—"}</td></tr>`}))}<p class="hint pad">Nạp trừ tiêu dương nghĩa là còn tiền trong tài khoản ads. Số tiêu của TikTok và Facebook lấy từ báo cáo đã tải lên; chưa tải thì để trống.</p>`}
function cpBaLoai(){
  const d=D(),inP=c=>c.ngay?spInP(c.ngay):spMonthIn(c.thang),L=(d.costs||[]).filter(inP);
  const N=execNums(PERIOD.from,PERIOD.to),rev={"TikTok Shop":N.tt||0,"Shopee":N.spDT||0,"Facebook / Pancake":N.fbGiao||0},ym=PERIOD.from.slice(0,7),oneM=PERIOD.to.slice(0,7)===ym,tay=((d.cpDoanhThu||{})[ym])||{};
  if(oneM)["B2B / Đại lý (CRM)","Gia công"].forEach(k=>{if(+tay[k]>0)rev[k]=+tay[k]});
  const mode=d.cpChia||"dt",kenhs=CP_KENH(),T={};kenhs.forEach(k=>T[k]={A:0});let chung=0,boC=0,tot={A:0,B:0,C:0};
  L.forEach(c=>{const lo=cpLoai(c.cat,c.kenh),t=+c.tien||0;tot[lo]+=t;if(c.kenh&&T[c.kenh])T[c.kenh].A+=t;else if(lo==="C")chung+=t;else boC+=t});
  const rs=Object.values(rev).reduce((a,b)=>a+b,0),act=kenhs.filter(k=>(rev[k]||0)>0||T[k].A);
  const share=k=>mode==="khong"||!chung?0:mode==="deu"?chung/Math.max(1,act.length):rs?chung*(rev[k]||0)/rs:0;
  const sumK=k=>T[k].A+share(k);
  if(!L.length)return `<section class="card pad"><b>Ba loại chi phí</b><p class="hint">Chưa có khoản chi đã duyệt trong kỳ này. Khoản nằm ở "Chờ phân bổ" cho tới khi chị Huệ duyệt.</p></section>`;
  return `<section class="card flush"><div class="card-h pad"><h2>Kênh nào gánh bao nhiêu chi phí</h2><span class="hint">Chi chung chia theo <select id="cp-mode">${opt([["dt","doanh thu thực của kênh"],["deu","chia đều các kênh"],["khong","không chia, để một dòng riêng"]],mode)}</select> · chỉ gồm khoản chi đã duyệt (không gồm quảng cáo, phí sàn, giá vốn đã có trong báo cáo kênh)</span></div>
  ${tbl(["Kênh","Trực tiếp kênh (A, gồm lương riêng kênh)","Chi chung được chia (C)","Tổng gánh","Doanh thu thực","% doanh thu"],act.map(k=>`<tr><td><b>${esc(k)}</b></td><td class="n">${nf(Math.round(T[k].A))}</td><td class="n">${nf(Math.round(share(k)))}</td><td class="n"><b>${nf(Math.round(sumK(k)))}</b></td><td class="n">${rev[k]?nf(Math.round(rev[k])):"chưa có"}</td><td class="n">${rev[k]?(sumK(k)/rev[k]*100).toFixed(1).replace(".",",")+"%":"—"}</td></tr>`).concat([`<tr class="tot"><td>Chưa gắn kênh (lương, chi phí phòng ban)</td><td class="n">${nf(Math.round(boC))}</td><td class="n">chi chung chưa chia: ${nf(Math.round(mode==="khong"||(mode==="dt"&&!rs)?chung:0))}</td><td class="n"></td><td></td><td></td></tr>`]))}
  <p class="hint pad">Loại A ${nf(Math.round(tot.A))} · B ${nf(Math.round(tot.B))} · C ${nf(Math.round(tot.C))} đ. TikTok, Shopee, Facebook lấy doanh thu thực từ báo cáo. NPP và Gia công web chưa có số tự động: ${oneM?`nhập doanh thu thực tháng ${ym.slice(5)}/${ym.slice(0,4)} ở hai ô dưới để chia chi chung cho đủ, tới khi web nối được số thật.`:"chọn một tháng để nhập."}</p>
  ${oneM&&cpCan()?`<div class="filters pad"><label class="field">Doanh thu thực NPP / đại lý (đ)<input id="cp-dt-npp" type="number" min="0" value="${tay["B2B / Đại lý (CRM)"]||""}"></label><label class="field">Doanh thu thực Gia công (đ)<input id="cp-dt-gc" type="number" min="0" value="${tay["Gia công"]||""}"></label><button class="btn" id="cp-dt-save">Lưu doanh thu</button></div>`:""}
  ${cpNapTieu(N)}
</section>`}
{const _s=PAGES.so_cp;if(_s)PAGES.so_cp=function(m){_s.apply(this,arguments);
  try{const n=(D().costsCho||[]).length,k=m.querySelector(".kpis");if(!k)return;
    const bar=`<div class="note ${n?"amb":""}" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span>${n?`<b>${n} khoản chờ chị Huệ phân bổ</b> (chưa tính vào các số bên dưới)`:"Không có khoản nào chờ phân bổ"}</span><button class="btn sm" id="cp-go">Mở Chờ phân bổ</button></div>`;
    k.insertAdjacentHTML("beforebegin",bar);
    m.insertAdjacentHTML("beforeend",cpBaLoai());
    $("#cp-go").onclick=()=>{PAGE="cp_duyet";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)};
    const sv=$("#cp-dt-save");if(sv)sv.onclick=()=>{const ym=PERIOD.from.slice(0,7),a=+$("#cp-dt-npp").value||0,b=+$("#cp-dt-gc").value||0;DB.mutate(ME.name,"nhập doanh thu NPP và Gia công",dt=>{if(!dt.cpDoanhThu)dt.cpDoanhThu={};dt.cpDoanhThu[ym]={"B2B / Đại lý (CRM)":a,"Gia công":b}});toast("Đã lưu doanh thu tháng "+ym.slice(5));renderMain()};
    const sel=$("#cp-mode");if(sel)sel.onchange=()=>{DB.mutate(ME.name,"đổi quy tắc chia chi chung",dt=>{dt.cpChia=sel.value});renderMain()}
  }catch(e){}}}
