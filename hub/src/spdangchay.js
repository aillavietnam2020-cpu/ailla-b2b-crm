/* =====================================================================
   SẢN PHẨM ĐANG CHẠY + COMBO VÀ GIÁ (Facebook › Sản phẩm)
   - Chỉ một số sản phẩm đang chạy quảng cáo; quà tặng (nồi điện, body mist, chổi...) không tính vào hiệu quả.
   - Mỗi combo có landing, page, người test, giá, ship, quà, ngày áp dụng; combo nào chạy khi nào thì nhập lên đây.
   - Số liệu mặc định lấy từ Sheet "BẢNG GIÁ SP FACEBOOK" (24/10/2026); sửa trên web thì lưu vào d.fbCat.
   ===================================================================== */
const SPC={who:"",st:"",openR:{},openO:false,modal:null};
const SPC_RUN="run",SPC_GIFT="gift",SPC_OFF="off";
const SPC_LBL={run:"Đang chạy",gift:"Quà tặng",off:"Không chạy"};
const SPC_L="https://www.giadungailla.online/";
const SPC_DEF_COMBOS=[
 ["Tẩy lồng Ailla + Tẩy mốc gioăng",SPC_L+"tay-long-giat-ailla","1 Lồng + 1 Mốc gioăng","1 Chổi quét",0,145000],
 ["Tẩy lồng Ailla + Tẩy mốc gioăng",SPC_L+"tay-long-giat-ailla","2 Lồng + 1 Mốc gioăng","1 Chổi quét + 1 Tinh dầu tím",0,205000],
 ["Tẩy lồng Ailla + Tẩy mốc gioăng",SPC_L+"tay-long-giat-ailla","2 Lồng + 2 Mốc gioăng","2 Chổi quét + 1 Nồi điện mini",0,269000],
 ["Tẩy lồng Ailla + Tẩy mốc gioăng",SPC_L+"tay-long-giat-ailla","2 Lồng + 2 Mốc gioăng","2 Chổi quét + 1 Tinh dầu tím",0,269000],
 ["Xịt muỗi Aibio",SPC_L+"xitmuoithongminhabio","Chai 300ML: 1 chai Xịt muỗi nhỏ","Chai 300ML: 1 chai Xịt muỗi nhỏ",0,169000],
 ["Xịt muỗi Aibio",SPC_L+"xitmuoithongminhabio","Chai 300ML: 1 chai Xịt muỗi nhỏ","1 Chai Nước lau sàn chuyên dụng Sả chanh 1L",0,169000],
 ["Xịt muỗi Aibio",SPC_L+"xitmuoithongminhabio","Chai 300ML: 2 chai Xịt muỗi nhỏ","Chai 300ML: 2 chai Xịt muỗi nhỏ",0,260000],
 ["Xịt muỗi Aibio",SPC_L+"xitmuoithongminhabio","Chai 300ML: 3 chai Xịt muỗi nhỏ","Chai 300ML: 3 chai Xịt muỗi nhỏ",0,359000],
 ["Xịt muỗi Aibio",SPC_L+"xitmuoithongminhabio","Chai 530ML: 2 chai Xịt muỗi to","",0,240000],
 ["Xịt ruồi Aibio",SPC_L+"binh-xit-aibio","Chai 300ML: 1 chai Xịt ruồi nhỏ","Chai 300ML: 1 chai Xịt ruồi nhỏ",0,169000],
 ["Xịt ruồi Aibio",SPC_L+"binh-xit-aibio","Chai 300ML: 1 chai Xịt muỗi nhỏ","1 Chai Nước lau sàn chuyên dụng Sả chanh 1L",0,169000],
 ["Xịt ruồi Aibio",SPC_L+"binh-xit-aibio","Chai 300ML: 2 chai Xịt ruồi nhỏ","Chai 300ML: 2 chai Xịt ruồi nhỏ",0,260000],
 ["Xịt ruồi Aibio",SPC_L+"binh-xit-aibio","Chai 300ML: 3 chai Xịt ruồi nhỏ","Chai 300ML: 3 chai Xịt ruồi nhỏ",0,359000],
 ["Xịt ruồi Aibio",SPC_L+"binh-xit-aibio","Chai 530ML: 2 chai Xịt ruồi to","",0,240000],
 ["Tẩy lồng Aibio",SPC_L+"aibiovesinhlonggiat","3 gói Bột tẩy lồng Aibio","",0,99000],
 ["Tẩy lồng Aibio",SPC_L+"aibiovesinhlonggiat","5 gói Bột tẩy lồng Aibio","2 gói Bột tẩy lồng Aibio",0,149000],
 ["Tẩy lồng Aibio",SPC_L+"aibiovesinhlonggiat","10 gói Bột tẩy lồng Aibio","4 gói Bột tẩy lồng Aibio",0,229000],
 ["Tinh dầu",SPC_L+"tinhdaugiatsay","1 chai Tinh dầu hồng","",20000,89000],
 ["Tinh dầu",SPC_L+"tinhdaugiatsay","2 chai Tinh dầu hồng + tím","1 chai Dung môi",0,165000,"2026-10-31","Combo ngày sale: tặng thêm 1 chai Body Mist 100ML (chạy đến hết 31/10)"],
 ["Tinh dầu",SPC_L+"tinhdaugiatsay","3 chai Tinh dầu hồng + tím + xanh dương","1 chai Dung môi + 1 gói Tẩy lồng Aibio",0,200000,"2026-10-31","Combo ngày sale: tặng thêm 1 chai Body Mist 100ML (chạy đến hết 31/10)"],
 ["Bột tẩy vạn năng",SPC_L+"bottayvannang_ailla","Lọ 250G: 1 lọ Bột tẩy vạn năng","Lọ 250G: 1 lọ Bột tẩy vạn năng",0,149000],
 ["Bột tẩy vạn năng",SPC_L+"bottayvannang_ailla","Lọ 250G: 3 lọ Bột tẩy vạn năng","Lọ 250G: 3 lọ Bột tẩy vạn năng + 2 Chổi cọ khóe",0,369000],
 ["Bột tẩy vạn năng",SPC_L+"bottayvannang_ailla","Lọ 250G: 5 lọ Bột tẩy vạn năng","Lọ 250G: 5 lọ Bột tẩy vạn năng + 1 Chổi cọ khóe + 1 Tẩy toilet 500ML",0,599000],
 ["Tẩy mốc gioăng Ailla",SPC_L+"taygioangcaosu","1 lọ Tẩy mốc gioăng cao su","1 Chổi quét + 2 gói Tẩy lồng Aibio",0,119000],
 ["Tẩy mốc gioăng Ailla",SPC_L+"taygioangcaosu","2 lọ Tẩy mốc gioăng cao su","2 Chổi quét + 6 gói Tẩy lồng Aibio",0,175000],
 ["Tẩy mốc gioăng Ailla",SPC_L+"taygioangcaosu","2 lọ Tẩy mốc gioăng cao su + 10 gói Tẩy lồng Aibio","2 Chổi quét + 1 lọ Bột tẩy vạn năng Ailla",0,239000],
 ["Nước lau sàn chuyên dụng",SPC_L+"taygioangcaosu","1 can 5KG","",0,205000,"","Link landing trong Sheet trùng với Tẩy mốc gioăng, cần kiểm tra lại"],
 ["Nước lau sàn chuyên dụng",SPC_L+"taygioangcaosu","1 can 5KG + 1 can 2KG","",0,259000,"","Link landing trong Sheet trùng với Tẩy mốc gioăng, cần kiểm tra lại"],
 ["Nước lau sàn chuyên dụng",SPC_L+"taygioangcaosu","2 can 5KG","",0,359000,"","Link landing trong Sheet trùng với Tẩy mốc gioăng, cần kiểm tra lại"]
].map((a,i)=>({id:"d"+(i+1),nhom:a[0],landing:a[1],page:"",nguoi:"Thảo",combo:a[2],qua:a[3],ship:a[4],gia:a[5],tu:"",den:a[6]||"",ghi:a[7]||""}));

/* ---- Danh mục sản phẩm: mỗi sản phẩm có nhiều biến thể (dung tích, phân loại/hương) như TikTok Shop ---- */
const SPC_DEF_CAT=[
 ["Tẩy lồng giặt Aibio","run",[["TLG125","125g","Túi",1]]],
 ["Tẩy lồng giặt Ailla","run",[["TLG","300g","",1]]],
 ["Tẩy mốc gioăng cao su","run",[["TM","100g","",1]]],
 ["Xịt muỗi Aibio","run",[["M300","300ml","Chai nhỏ",1],["XM530ML","530ml","Chai to",1]]],
 ["Xịt ruồi Aibio","run",[["R300","300ml","Chai nhỏ",1],["XR","530ml","Chai to",1]]],
 ["Tinh dầu giặt sấy","run",[["TDSH","80ml","Hồng (Hygiene)",1],["TDST","80ml","Tím (Luxury)",1],["TDSX","80ml","Xanh dương (Nắng mai)",1],["TDSXL","80ml","Xanh lá (France)",0],["TDSD","80ml","Ban Mê",0],["TD","80ml","Mặc định",0],["TDGSH500","500ml","Hồng",0],["TDGST500","500ml","Tím",0],["TDGS1L","1 lít","Hồng",0]]],
 ["Bột tẩy vạn năng","run",[["BTVN250","250g","",1],["BTVN","","Natural",0]]],
 ["Nước lau sàn chuyên dụng","run",[["LSCD5KG","5kg","",1],["LSCD2KG","2kg","",1],["LS5CDSC","5kg","Sả chanh",0],["LS5CDHH","5kg","Hoa hồng",0],["LSCDSC2KG","2kg","Sả chanh",0],["LSCDHH2KG","2kg","Hoa hồng",0],["LS1LCDHH","1 lít","Hoa hồng",0],["LS1SC","1 lít","Sả chanh",0]]],
 ["Tẩy mốc quần áo","off",[["MT","","Trắng",0],["MM","","Màu",0]]],
 ["Nồi điện mini","gift",[["ND","18cm","",1]]],
 ["Bodymist","gift",[["BD100","100ml","",1]]],
 ["Chổi quét","gift",[["C","","Chổi quét sơn",1]]],
 ["Tẩy toilet","gift",[["TOILET500","500ml","",1]]]
].map((p,i)=>({id:"p"+(i+1),ten:p[0],loai:p[1],bt:p[2].map((v,j)=>({id:"v"+(i+1)+"_"+(j+1),ma:v[0],dt:v[1],pl:v[2],on:!!v[3]}))}));
const spcStore=()=>{try{return D().fbCat||null}catch(e){return null}};
const spcCat=()=>{const s=spcStore();return s&&Array.isArray(s.sp)?s.sp:SPC_DEF_CAT};
const spcCombos=()=>{const s=spcStore();return s&&Array.isArray(s.combos)?s.combos:SPC_DEF_COMBOS};
function spcCls(code){const cat=spcCat();for(const p of cat){const v=(p.bt||[]).find(x=>x.ma===code);if(v)return v.on===false?SPC_OFF:p.loai}const s=spcStore();return (s&&s.cls&&s.cls[code])||SPC_OFF}
function spcLookup(code){const cat=spcCat();for(const p of cat){const v=(p.bt||[]).find(x=>x.ma===code);if(v)return {p,v}}return null}
const spcCanEdit=()=>{try{return ME.role==="admin"||(typeof dgOk==="function"&&dgOk(ME))}catch(e){return false}};
const spcClone=o=>JSON.parse(JSON.stringify(o));
function spcEdit(msg,fn){DB.mutate(ME.name,msg,d=>{if(!d.fbCat)d.fbCat={};const c=d.fbCat;if(!Array.isArray(c.sp))c.sp=spcClone(SPC_DEF_CAT);if(!Array.isArray(c.combos))c.combos=spcClone(SPC_DEF_COMBOS);fn(c)});toast("Đã lưu");renderMain()}
const spcSt=c=>{const t=iso(new Date());if(c.tu&&c.tu>t)return ["Sắp chạy","amb"];if(c.den&&c.den<t)return ["Đã hết","gry"];return ["Đang áp dụng","grn"]};
const spcShort=u=>String(u||"").replace(/^https?:\/\/(www\.)?/,"");
const spcVN=d=>d?d.slice(8)+"/"+d.slice(5,7):"";
const spcVar=v=>[v.dt,v.pl].filter(Boolean).join(" · ")||v.ma||"mặc định";

/* ---- Khung chỉnh (hiện khi bấm Sửa / Thêm) ---- */
function spcCapture(){const M=SPC.modal;if(!M)return;const root=document.getElementById("spc-md");if(!root)return;
  if(M.t==="c"){root.querySelectorAll("[data-spm]").forEach(i=>{const f=i.dataset.spm;let v=i.value;if(f==="ship"||f==="gia")v=Math.round(+String(v).replace(/[^\d]/g,""))||0;M.d[f]=v})}
  else{root.querySelectorAll("[data-spm]").forEach(i=>{M.d[i.dataset.spm]=i.value});M.d.bt=[...root.querySelectorAll("[data-spvrow]")].map(r=>{const o={id:r.dataset.spvrow};r.querySelectorAll("[data-spv]").forEach(i=>{o[i.dataset.spv]=i.type==="checkbox"?i.checked:i.value});return o})}}
function spcModal(){const M=SPC.modal;if(!M)return "";const d=M.d,fld=(l,f,w,ph,ty)=>`<label class="spc-l"><span>${l}</span><input class="spc-in" ${ty?`type="${ty}" `:""}style="${w?`width:${w}px`:""}" data-spm="${f}" value="${esc(d[f]==null?"":d[f])}"${ph?` placeholder="${ph}"`:""}></label>`;
  if(M.t==="c"){const isNew=!M.id;return `<div class="spc-ov"><div class="spc-md" id="spc-md"><h3>${isNew?"Thêm combo":"Sửa combo"}</h3>
    <div class="spc-g">${fld("Nhóm sản phẩm","nhom",0,"ví dụ: Xịt muỗi Aibio")}${fld("Link landing","landing",0,"https://...")}${fld("Page áp dụng","page",0,"để trống = mọi page")}${fld("Người test","nguoi",0,"")}${fld("Combo (sản phẩm)","combo",0,"")}${fld("Quà tặng","qua",0,"")}${fld("Phí ship","ship",110,"0")}${fld("Giá bán","gia",110,"0")}${fld("Từ ngày","tu",0,"","date")}${fld("Đến ngày","den",0,"","date")}</div>${fld("Ghi chú (ngày sale, test giá...)","ghi",0,"")}
    <div class="spc-bt"><button class="btn pri" data-spc-act="msave">Lưu</button>${isNew?"":`<button class="btn" data-spc-act="mnew" title="Giữ combo cũ đến hết hôm qua, tạo combo mới với giá và thông tin đang sửa từ hôm nay">Áp giá mới từ hôm nay</button><button class="btn" data-spc-act="mdel">Xóa</button>`}<button class="btn" data-spc-act="mclose">Hủy</button></div>
    <p class="hint">Từ ngày và đến ngày để trống nghĩa là áp dụng liên tục. <b>Áp giá mới từ hôm nay</b> dùng khi đổi giá: combo cũ tự kết thúc hôm qua, combo mới bắt đầu hôm nay, vẫn giữ lịch sử giá.</p></div></div>`}
  const vr=(d.bt||[]).map(v=>`<tr data-spvrow="${esc(v.id)}"><td><input class="spc-in" data-spv="ma" value="${esc(v.ma||"")}" placeholder="mã Pancake"></td><td><input class="spc-in" data-spv="dt" value="${esc(v.dt||"")}" placeholder="5kg, 300ml..."></td><td><input class="spc-in" data-spv="pl" value="${esc(v.pl||"")}" placeholder="hương, màu..."></td><td style="text-align:center"><input type="checkbox" data-spv="on"${v.on!==false?" checked":""} title="đang chạy"></td><td><button class="btn" data-spc-act="vdel" data-spvid="${esc(v.id)}">×</button></td></tr>`).join("");
  return `<div class="spc-ov"><div class="spc-md" id="spc-md"><h3>${M.id?"Sửa sản phẩm":"Thêm sản phẩm"}</h3>
    <div class="spc-g">${fld("Tên sản phẩm","ten",0,"ví dụ: Nước lau sàn chuyên dụng")}<label class="spc-l"><span>Loại</span><select class="spc-in" data-spm="loai">${[SPC_RUN,SPC_GIFT,SPC_OFF].map(v=>`<option value="${v}"${d.loai===v?" selected":""}>${SPC_LBL[v]}</option>`).join("")}</select></label></div>
    <p class="hint" style="margin:6px 0 2px"><b>Biến thể</b> (dung tích, phân loại/hương). Tích ô cuối dòng cho biến thể <b>đang chạy</b>; mã Pancake dùng để gộp doanh thu.</p>
    <table class="spc-vt"><thead><tr><th>Mã Pancake</th><th>Dung tích</th><th>Phân loại</th><th>Chạy</th><th></th></tr></thead><tbody>${vr||`<tr><td colspan="5" class="empty">Chưa có biến thể.</td></tr>`}</tbody></table>
    <div class="spc-bt"><button class="btn" data-spc-act="vadd">+ Thêm biến thể</button></div>
    <div class="spc-bt"><button class="btn pri" data-spc-act="msave">Lưu</button>${M.id?`<button class="btn" data-spc-act="mdel">Xóa sản phẩm</button>`:""}<button class="btn" data-spc-act="mclose">Hủy</button></div></div></div>`}

/* ---- Khung xem: sản phẩm đang chạy (gọn) và combo theo landing (gọn) ---- */
function spcEditor(F,days,opt){
  const ed=spcCanEdit(),cat=spcCat();opt=opt||{};
  const runN=cat.filter(p=>p.loai===SPC_RUN).length,giftN=cat.filter(p=>p.loai===SPC_GIFT).length;
  const pr=cat.map(p=>{const on=(p.bt||[]).filter(v=>v.on!==false),off=(p.bt||[]).length-on.length;return `<tr><td><b>${esc(p.ten)}</b></td><td>${pill(SPC_LBL[p.loai],p.loai===SPC_RUN?"grn":p.loai===SPC_GIFT?"amb":"gry")}</td><td>${on.map(v=>`<span class="spc-chip">${esc(spcVar(v))}</span>`).join("")||'<span class="hint">chưa có biến thể nào đang chạy</span>'}${off?`<span class="hint"> · ${off} biến thể không chạy</span>`:""}</td>${ed?`<td class="n"><button class="btn" data-spc-act="pedit" data-spid="${esc(p.id)}">Sửa</button></td>`:""}</tr>`}).join("");
  const all=spcCombos(),who=[...new Set(all.map(c=>c.nguoi).filter(Boolean))];
  const list=all.filter(c=>(!SPC.who||c.nguoi===SPC.who)&&(!SPC.st||spcSt(c)[0]===SPC.st));
  const groups=[];list.forEach(c=>{const k=(c.nhom||"")+"|"+(c.landing||"");let g=groups.find(x=>x.k===k);if(!g){g={k,nhom:c.nhom,landing:c.landing,rows:[]};groups.push(g)}g.rows.push(c)});
  const gh=groups.map(g=>`<tr class="spc-gh"><td colspan="5"><b>${esc(g.nhom||"(chưa đặt tên nhóm)")}</b>${g.landing?` · <a href="${esc(g.landing)}" target="_blank" rel="noopener" class="mono">${esc(spcShort(g.landing))}</a>`:""}</td></tr>`+g.rows.map(c=>{const st=spcSt(c),when=(c.tu||c.den)?`${c.tu?"từ "+spcVN(c.tu):""}${c.tu&&c.den?" ":""}${c.den?"đến "+spcVN(c.den):""}`:"";return `<tr><td>${esc(c.combo||"")}${c.ghi?`<small>${esc(c.ghi)}</small>`:""}</td><td>${esc(c.qua||"—")}</td><td class="n">${c.ship?nf(c.ship):"—"}</td><td class="n"><b>${nf(c.gia||0)}</b></td><td>${pill(st[0],st[1])}${when?` <span class="hint">${when}</span>`:""}${c.page?`<small>Page: ${esc(c.page)}</small>`:""}${c.nguoi?`<small>Người test: ${esc(c.nguoi)}</small>`:""}${ed?` <button class="btn" data-spc-act="cedit" data-spid="${esc(c.id)}">Sửa</button>`:""}</td></tr>`}).join("")).join("")||`<tr><td colspan="5" class="empty">Không có combo nào theo bộ lọc này.</td></tr>`;
  const selOpt=(arr,v,al)=>`<option value="">${al}</option>`+arr.map(x=>`<option value="${esc(x)}"${v===x?" selected":""}>${esc(x)}</option>`).join("");
  return `<style>.spc-in{padding:5px 8px;font-size:13px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);width:100%}.spc-chip{display:inline-block;margin:2px 4px 2px 0;padding:2px 9px;border-radius:999px;background:var(--green-soft);color:var(--green);font-size:12px}.spc-f{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 8px}.spc-gh td{background:var(--canvas);padding:7px 10px}.spc-ov{position:fixed;inset:0;background:rgba(15,20,40,.45);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:36px 12px;overflow:auto}.spc-md{background:var(--surface);color:var(--ink);border-radius:12px;padding:18px 20px;max-width:760px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.3)}.spc-md h3{margin:0 0 10px}.spc-g{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}.spc-l{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}.spc-bt{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.spc-vt{width:100%;border-collapse:collapse;font-size:13px}.spc-vt th,.spc-vt td{padding:3px 4px;text-align:left}@media(max-width:640px){.spc-g{grid-template-columns:1fr}}</style>
  <section class="fbd-card fbd-wide"><h3>Sản phẩm đang chạy quảng cáo <span class="hint" style="font-weight:400">${runN} sản phẩm đang chạy · ${giftN} quà tặng</span></h3>
  <p class="fbd-note">${opt.van?"Digital tự điền: sản phẩm nào <b>đang chạy</b>, món nào là <b>quà tặng</b>, và các biến thể (dung tích, hương). Giá vốn không hiện ở trang này. ":""}Chỉ sản phẩm <b>đang chạy</b> được tính vào bảng hiệu quả ở trang quản trị; quà tặng tách riêng.${ed?"":" Cần quyền Digital để sửa."}</p>
  <div class="tbl"><table><thead><tr><th>Sản phẩm</th><th>Loại</th><th>Biến thể đang chạy</th>${ed?"<th></th>":""}</tr></thead><tbody>${pr}</tbody></table></div>${ed?`<div class="spc-bt"><button class="btn pri" data-spc-act="padd">+ Thêm sản phẩm</button></div>`:""}</section>
  <section class="fbd-card fbd-wide"><h3>Combo và giá bán <span class="hint" style="font-weight:400">${list.length}/${all.length} combo</span></h3>
  <div class="spc-f"><select class="spc-in" style="width:auto" data-spc-fl="who">${selOpt(who,SPC.who,"Tất cả người test")}</select><select class="spc-in" style="width:auto" data-spc-fl="st">${selOpt(["Đang áp dụng","Sắp chạy","Đã hết"],SPC.st,"Mọi trạng thái")}</select>${ed?`<button class="btn pri" data-spc-act="cadd">+ Thêm combo</button>`:""}</div>
  <div class="tbl"><table><thead><tr><th>Combo</th><th>Quà tặng</th><th class="n">Ship</th><th class="n">Giá bán</th><th>Áp dụng</th></tr></thead><tbody>${gh}</tbody></table></div>
  <p class="fbd-note">Đổi giá hoặc test giá: bấm <b>Sửa</b> rồi chọn <b>Áp giá mới từ hôm nay</b>; combo cũ tự hết hạn, giá cũ vẫn được giữ lại. Có thể đặt page riêng và người test riêng cho từng combo.</p></section>${spcModal()}`;
}

/* ---- Bảng hiệu quả (trang quản trị): gộp theo sản phẩm, bấm để mở từng biến thể ---- */
function spcProdTable(F,days){
  const m={};let n=0;
  days.forEach(k=>{const r=F.p[k];if(!r)return;n++;r.forEach(([i,q,dt,gv])=>{const t=m[i]||(m[i]={i,q:0,dt:0,gv:0});t.q+=q;t.dt+=dt*1000;t.gv+=gv*1000})});
  if(!n)return "";
  const P={};
  Object.values(m).forEach(x=>{const s=F.sk[x.i]||["?","?",""],lk=spcLookup(s[0]),key=lk?lk.p.id:"x_"+s[0],g=P[key]||(P[key]={key,ten:lk?lk.p.ten:s[1],k:lk?(lk.v.on===false?SPC_OFF:lk.p.loai):SPC_OFF,c:lk?"":s[0],q:0,dt:0,gv:0,v:[]});g.q+=x.q;g.dt+=x.dt;g.gv+=x.gv;g.v.push({n:lk?spcVar(lk.v):s[1],c:s[0],q:x.q,dt:x.dt,gv:x.gv,off:lk&&lk.v.on===false});if(lk&&lk.v.on!==false&&lk.p.loai===SPC_RUN)g.k=SPC_RUN});
  const L=Object.values(P).sort((a,b)=>b.dt-a.dt);
  const R=L.filter(x=>x.k===SPC_RUN),G=L.filter(x=>x.k===SPC_GIFT),O=L.filter(x=>x.k===SPC_OFF);
  const S=a=>a.reduce((o,x)=>({q:o.q+x.q,dt:o.dt+x.dt,gv:o.gv+x.gv}),{q:0,dt:0,gv:0}),T=S(R),so=S(O),sg=S(G);
  const cells=(x,pct)=>{const b=x.dt?(x.dt-x.gv)/x.dt*100:0;return `<td class="n">${nf(x.q)}</td><td class="n">${tr(x.dt)}</td><td class="n">${tr(x.gv)}</td><td class="n">${tr(x.dt-x.gv)}</td><td class="n">${x.dt?pill(Math.round(b)+"%",b>=70?"grn":b>=40?"amb":"red"):"—"}</td><td class="n">${pct&&T.dt?(x.dt/T.dt*100).toFixed(1).replace(".",",")+"%":"—"}</td>`};
  const prow=(x,pct)=>{const open=SPC.openR[x.key]&&x.v.length>1,tg=x.v.length>1;return `<tr${tg?` class="clk" data-spc-act="rtg" data-spid="${esc(x.key)}"`:""}><td><b>${tg?(open?"▾ ":"▸ "):""}${esc(x.ten)}</b>${x.c?`<small>${esc(x.c)}</small>`:tg?`<small>${x.v.length} biến thể</small>`:""}</td>${cells(x,pct)}</tr>`+(open?x.v.sort((a,b)=>b.dt-a.dt).map(v=>`<tr class="spc-sub"><td style="padding-left:28px"><span class="hint">${esc(v.n)}${v.off?" (không chạy)":""}</span><small>${esc(v.c)}</small></td>${cells(v,false)}</tr>`).join(""):"")};
  const head=["Sản phẩm","Số lượng","Doanh thu","Giá vốn","Lãi gộp","Biên gộp","% doanh thu"];
  const tot=(t,s)=>`<tr class="tot"><td><b>${t}</b></td>${cells(s,false)}</tr>`;
  const tb=(rows)=>`<div class="tbl"><table><thead><tr>${head.map((h,i)=>`<th${i?' class="n"':""}>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  const main=R.length?tb(R.map(x=>prow(x,true)).join("")+tot("Tổng sản phẩm đang chạy",T)):`<p class="empty">Chưa có sản phẩm nào đang chạy. Chị chọn ở bảng phía trên.</p>`;
  const extra=(G.length?`<h4 style="margin:12px 0 4px;font-size:13px">Quà tặng (không tính vào hiệu quả)</h4>${tb(G.map(x=>prow(x,false)).join("")+tot("Tổng quà tặng",sg))}`:"")+(O.length?`<details style="margin-top:10px"${SPC.openO?" open":""} data-spc-o><summary style="cursor:pointer;font-size:13px">Sản phẩm không chạy quảng cáo (${O.length} sản phẩm · ${tr(so.dt)}), bấm để xem</summary>${tb(O.map(x=>prow(x,false)).join(""))}</details>`:"");
  return `<section class="fbd-card fbd-wide"><h3>Hiệu quả theo sản phẩm đang chạy · ${n} ngày có số</h3>${main}${extra}<p class="fbd-note">Đơn đã giao thành công, giá vốn theo bảng quy đổi sản phẩm trong Sheet Pancake. Bấm một sản phẩm có nhiều biến thể để xem từng dung tích, hương. Lãi gộp ở đây chưa trừ vận chuyển và quảng cáo.</p></section>`;
}

/* Thay phần "Hiệu quả theo sản phẩm" của trang Facebook › Sản phẩm */
if(typeof fbdProdCard==="function"&&!window.__spcWrap){window.__spcWrap=1;const _spc0=fbdProdCard;
  fbdProdCard=function(days,topN,title){const F=typeof FBC!=="undefined"&&FBC.raw;if(!F||!F.p||!F.sk)return _spc0(days,topN,title);
    try{return spcEditor(F,days)+spcProdTable(F,days)}catch(e){console.warn("danh mục sản phẩm đang chạy",e);return _spc0(days,topN,title)}}}

/* ---- Sự kiện (gắn một lần) ---- */
if(!window.__spcBound){window.__spcBound=1;
  document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset)return;if(t.dataset.spcFl){SPC[t.dataset.spcFl]=t.value;renderMain()}});
  document.addEventListener("toggle",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.spcO!==undefined)SPC.openO=t.open},true);
  document.addEventListener("click",e=>{const b=e.target&&e.target.closest?e.target.closest("[data-spc-act]"):null;if(!b)return;const act=b.dataset.spcAct,id=b.dataset.spid;
    if(act==="rtg"){SPC.openR[id]=!SPC.openR[id];renderMain();return}
    if(!spcCanEdit())return;
    const today=iso(new Date()),yest=iso(new Date(Date.now()-864e5));
    if(act==="padd"){SPC.modal={t:"p",id:"",d:{ten:"",loai:SPC_RUN,bt:[{id:"v"+Date.now(),ma:"",dt:"",pl:"",on:true}]}};renderMain()}
    else if(act==="pedit"){const p=spcCat().find(x=>x.id===id);if(p){SPC.modal={t:"p",id,d:spcClone(p)};renderMain()}}
    else if(act==="cadd"){SPC.modal={t:"c",id:"",d:{nhom:"",landing:"",page:"",nguoi:ME.name||"",combo:"",qua:"",ship:0,gia:0,tu:today,den:"",ghi:""}};renderMain()}
    else if(act==="cedit"){const c=spcCombos().find(x=>x.id===id);if(c){SPC.modal={t:"c",id,d:spcClone(c)};renderMain()}}
    else if(act==="mclose"){SPC.modal=null;renderMain()}
    else if(act==="vadd"){spcCapture();SPC.modal.d.bt.push({id:"v"+Date.now(),ma:"",dt:"",pl:"",on:true});renderMain()}
    else if(act==="vdel"){spcCapture();const vid=b.dataset.spvid;SPC.modal.d.bt=SPC.modal.d.bt.filter(v=>v.id!==vid);renderMain()}
    else if(act==="msave"){spcCapture();const M=SPC.modal;if(!M)return;
      if(M.t==="c"){if(!String(M.d.combo||"").trim()){toast("Chị nhập tên combo trước");return}spcEdit(M.id?"sửa combo":"thêm combo",c=>{if(M.id){const i=c.combos.findIndex(x=>x.id===M.id);if(i>=0)c.combos[i]=Object.assign({},c.combos[i],M.d)}else c.combos.unshift(Object.assign({id:"n"+Date.now()},M.d))})}
      else{if(!String(M.d.ten||"").trim()){toast("Chị nhập tên sản phẩm trước");return}M.d.bt=(M.d.bt||[]).filter(v=>String(v.ma||"").trim()||String(v.dt||"").trim()||String(v.pl||"").trim());spcEdit(M.id?"sửa sản phẩm "+M.d.ten:"thêm sản phẩm "+M.d.ten,c=>{if(M.id){const i=c.sp.findIndex(x=>x.id===M.id);if(i>=0)c.sp[i]=Object.assign({},c.sp[i],M.d)}else c.sp.push(Object.assign({id:"p"+Date.now()},M.d))})}
      SPC.modal=null}
    else if(act==="mnew"){spcCapture();const M=SPC.modal;if(!M||M.t!=="c"||!M.id)return;spcEdit("áp giá mới từ hôm nay",c=>{const i=c.combos.findIndex(x=>x.id===M.id);if(i>=0){if(!c.combos[i].den||c.combos[i].den>yest)c.combos[i].den=yest;c.combos.splice(i+1,0,Object.assign({},M.d,{id:"n"+Date.now(),tu:today,den:M.d.den&&M.d.den>=today?M.d.den:""}))}});SPC.modal=null}
    else if(act==="mdel"){const M=SPC.modal;if(!M||!M.id)return;if(!confirm(M.t==="c"?"Xóa combo này?":"Xóa sản phẩm này?"))return;spcEdit(M.t==="c"?"xóa combo":"xóa sản phẩm",c=>{if(M.t==="c")c.combos=c.combos.filter(x=>x.id!==M.id);else c.sp=c.sp.filter(x=>x.id!==M.id)});SPC.modal=null}})}

/* Trang riêng ở bản vận hành (Marketing › Digital Marketing › Sản phẩm và combo): Digital tự điền, không có giá vốn */
PAGES.dg_sp=function(m){m.innerHTML=H("Sản phẩm và combo","Sản phẩm nào đang chạy, biến thể, combo, giá, landing, page và ngày áp dụng · không có giá vốn")+spcEditor(null,[],{van:true})};
(function(){try{
  const st=PAGE_SETS.find(x=>x.n==="Digital Marketing");
  if(st&&!st.ids.includes("dg_sp")){const i=st.ids.indexOf("dg_lib");const at=i>=0?i:st.ids.length;st.ids.splice(at,0,"dg_sp");st.labels.splice(at,0,"Sản phẩm và combo")}
  const mk=MODULES.find(x=>x.k==="mkt");
  if(mk&&!mk._sp){mk._sp=1;const g0=mk.groups;mk.groups=function(){const r=g0.apply(this,arguments);r.forEach(gr=>{const arr=gr[1],j=arr.findIndex(it=>it&&it[0]==="dg_lib");if(j>=0&&!arr.some(it=>it&&it[0]==="dg_sp"))arr.splice(j,0,MI("dg_sp","Sản phẩm và combo",tm("ads",dgOk)))});return r}}
}catch(e){console.warn("menu sản phẩm và combo",e)}})();
