/* =====================================================================
   SẢN PHẨM ĐANG CHẠY + COMBO VÀ GIÁ (Facebook › Sản phẩm)
   - Chỉ một số sản phẩm đang chạy quảng cáo; quà tặng (nồi điện, body mist, chổi...) không tính vào hiệu quả.
   - Mỗi combo có landing, page, người test, giá, ship, quà, ngày áp dụng; combo nào chạy khi nào thì nhập lên đây.
   - Số liệu mặc định lấy từ Sheet "BẢNG GIÁ SP FACEBOOK" (24/10/2026); sửa trên web thì lưu vào d.fbCat.
   ===================================================================== */
const SPC={who:"",st:"",openR:{},openP:{},openO:false,modal:null};
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
 ["Tẩy toilet","gift",[["TOILET500","500ml","",1]]],
 ["Dung môi pha tinh dầu","gift",[["DM","250ml","",1]]],
 ["Chổi cọ khóe","gift",[["CCK","","Cán inox",1]]]
].map((p,i)=>({id:"p"+(i+1),ten:p[0],loai:p[1],bt:p[2].map((v,j)=>({id:"v"+(i+1)+"_"+(j+1),ma:v[0],dt:v[1],pl:v[2],on:!!v[3]}))}));
/* Mã kho (MISA) của từng mã Pancake, lấy đúng bảng quy đổi Facebook mà kế toán đang dùng; sản phẩm mới thì Digital điền ở khung sửa sản phẩm */
const SPC_MISA={TLG125:"AILLATLGTUI",TLG:"AILLATLGSX",TM:"AILLAMOCGIOANGCHAITRON",M300:"AILLAXM300ML",XM530ML:"AillaXM",R300:"AILLAXR300ML",XR:"AillaXR",TDSH:"AILLATDGS80HYDEN",TDST:"AILLATDGS80LUXURY",TDSX:"AILLATDGS80CFT",TDSXL:"AILLATDGS80FRANCRE",TDSD:"AILLATDGS80BANME",TD:"AILLATDGS80HYDEN",TDGSH500:"AILLATDGSLUXURY500ML",TDGST500:"AILLATDGSLUXURY500ML",BTVN250:"AILLATVN250",BTVN:"AillaTVN",LSCD5KG:"AILLALSBV5LSACHANH",LSCD2KG:"AILLALSBV2SC",LS5CDSC:"AILLALSBV5LSACHANH",LS5CDHH:"AILLALSBV5LHOAHONG",LSCDSC2KG:"AILLALSBV2SC",LSCDHH2KG:"AILLALSBV2HH",LS1LCDHH:"AILLALSBV1LHOAHONG",LS1SC:"AILLALS1SC",ND:"NOIDIEN",BD100:"AILLABODY100",C:"CHOIGIOANG",TOILET500:"AillaToilet500SX",MT:"AillaMOCTRANG",MM:"AillaMOCMAU",DM:"DUNGMOI250",CCK:"CHOICOKHE"};
const spcCanMisa=()=>{try{return ME.role==="admin"||/huệ/i.test(ME.name||"")}catch(e){return false}};
const spcMisa=v=>(v&&(v.misa||SPC_MISA[v.ma]))||"";
const spcStore=()=>{try{return D().fbCat||null}catch(e){return null}};
const spcCat=()=>{const s=spcStore();return s&&Array.isArray(s.sp)?s.sp:SPC_DEF_CAT};
const spcCombos=()=>{const s=spcStore();return s&&Array.isArray(s.combos)?s.combos:SPC_DEF_COMBOS};
function spcCls(code){const cat=spcCat();for(const p of cat){const v=(p.bt||[]).find(x=>x.ma===code);if(v)return v.on===false?SPC_OFF:p.loai}const s=spcStore();return (s&&s.cls&&s.cls[code])||SPC_OFF}
function spcLookup(code){const cat=spcCat();for(const p of cat){const v=(p.bt||[]).find(x=>x.ma===code);if(v)return {p,v}}return null}
const spcCanEdit=()=>{try{return ME.role==="admin"||(typeof dgOk==="function"&&dgOk(ME))}catch(e){return false}};
const spcClone=o=>JSON.parse(JSON.stringify(o));
/* Mã kho + tên Pancake đã điền thì tự thêm vào bảng quy đổi Facebook của kế toán, chỉ thêm khi chưa có dòng, không ghi đè */
async function spcSyncKho(prod){try{const vs=(prod.bt||[]).filter(v=>String(v.misa||"").trim()&&String(v.pk||"").trim());if(!vs.length)return;
  const g=await svApi("/api/hub/kho/online/map?channel=FACEBOOK"),have=new Set((g.data||g||[]).map(r=>String(r.sku||"").trim().toLowerCase()));let n=0;
  for(const v of vs){const k=v.pk.trim();if(have.has(k.toLowerCase()))continue;await svApi("/api/hub/kho/online/map/add",{method:"POST",body:JSON.stringify({channel:"FACEBOOK",sku:k,variant:"",item_label:v.misa.trim()+" - "+prod.ten+((v.dt||v.pl)?" "+spcVar(v):""),qty:1,from_day:""})});n++}
  if(n)toast("Đã thêm "+n+" mã vào bảng quy đổi của kế toán")}catch(e){toast("Chưa thêm được vào bảng quy đổi của kế toán ("+(e.message||"")+"); nhờ kế toán xác nhận")}}
function spcEdit(msg,fn){DB.mutate(ME.name,msg,d=>{if(!d.fbCat)d.fbCat={};const c=d.fbCat;if(!Array.isArray(c.sp))c.sp=spcClone(SPC_DEF_CAT);if(!Array.isArray(c.combos))c.combos=spcClone(SPC_DEF_COMBOS);fn(c)});toast("Đã lưu");renderMain()}
const spcSt=c=>{const t=iso(new Date());if(c.tu&&c.tu>t)return ["Sắp chạy","amb"];if(c.den&&c.den<t)return ["Đã hết","gry"];return ["Đang áp dụng","grn"]};
const spcShort=u=>String(u||"").replace(/^https?:\/\/(www\.)?/,"");
const spcVN=d=>d?d.slice(8)+"/"+d.slice(5,7):"";
const spcVar=v=>[v.dt,v.pl].filter(Boolean).join(" · ")||v.ma||"mặc định";

/* ---- Thành phần combo: "2 × Tẩy lồng Ailla + 1 × Tẩy mốc", quà tặng cũng khai như vậy (kế toán dùng làm bảng quy đổi) ---- */
function spcParseC(t){return String(t||"").split(",").map(x=>x.trim()).filter(Boolean).map(x=>{const m=x.match(/^(~?)(.+?)\*(\d+)$/);if(!m)return null;return m[1]?{ma:"",ten:m[2],sl:+m[3]}:{ma:m[2],sl:+m[3]}}).filter(Boolean)}
function spcCompName(x,short){if(x.ma){const lk=spcLookup(x.ma);if(!lk)return x.ma;const many=(lk.p.bt||[]).filter(v=>v.on!==false).length>1;return lk.p.ten+((lk.v.dt||lk.v.pl)&&(!short||many)?" ("+spcVar(lk.v)+")":"")}return x.ten||""}
const spcCompCode=x=>{if(!x.ma)return "";const lk=spcLookup(x.ma);return lk?(spcMisa(lk.v)||""):""};
const spcCompText=(l,short)=>(l||[]).map(x=>(x.sl||1)+" × "+spcCompName(x,short)).join(" + ");
const SPC_GOM=["TLG*1,TM*1|C*1","TLG*2,TM*1|C*1,TDST*1","TLG*2,TM*2|C*2,ND*1","TLG*2,TM*2|C*2,TDST*1","M300*1|M300*1","M300*1|LS1SC*1","M300*2|M300*2","M300*3|M300*3","XM530ML*2|","R300*1|R300*1","M300*1|LS1SC*1","R300*2|R300*2","R300*3|R300*3","XR*2|","TLG125*3|","TLG125*5|TLG125*2","TLG125*10|TLG125*4","TDSH*1|","TDSH*1,TDST*1|DM*1,BD100*1","TDSH*1,TDST*1,TDSX*1|DM*1,TLG125*1,BD100*1","BTVN250*1|BTVN250*1","BTVN250*3|BTVN250*3,CCK*2","BTVN250*5|BTVN250*5,CCK*1,TOILET500*1","TM*1|C*1,TLG125*2","TM*2|C*2,TLG125*6","TM*2,TLG125*10|C*2,BTVN250*1","LSCD5KG*1|","LSCD5KG*1,LSCD2KG*1|","LSCD5KG*2|"];
SPC_DEF_COMBOS.forEach((c,i)=>{const g=(SPC_GOM[i]||"|").split("|");c.gom=spcParseC(g[0]);c.tang=spcParseC(g[1]);c.maSan="";if(i===10)c.ghi="Sheet ghi chai xịt muỗi nhỏ ở landing xịt ruồi, cần kiểm tra lại"});
function spcProdCombos(p,all){const mas=new Set((p.bt||[]).map(v=>v.ma).filter(Boolean)),key=String(p.ten||"").toLowerCase().slice(0,9);
  return all.filter(c=>{const list=p.loai===SPC_GIFT?(c.tang||[]):(c.gom||[]);if(list.some(x=>x.ma&&mas.has(x.ma)))return true;return p.loai!==SPC_GIFT&&!(c.gom&&c.gom.length)&&c.nhom&&key&&String(c.nhom).toLowerCase().includes(key)})}

/* ---- Khung chỉnh: nằm trên cùng cả trang (không bị vẽ lại theo trang), chọn sản phẩm kiểu Pancake: gõ tìm, bấm chọn, chỉnh số lượng ---- */
function spcCapture(){const M=SPC.modal;if(!M||M.t!=="p")return;const root=document.getElementById("spc-md");if(!root)return;
  root.querySelectorAll("[data-spm]").forEach(i=>{M.d[i.dataset.spm]=i.value});M.d.bt=[...root.querySelectorAll("[data-spvrow]")].map(r=>{const o={id:r.dataset.spvrow};r.querySelectorAll("[data-spv]").forEach(i=>{o[i.dataset.spv]=i.type==="checkbox"?i.checked:i.value});return o})}
const SPC_CSS=`.spc-in{padding:6px 9px;font-size:13px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);width:100%;box-sizing:border-box}.spc-chip{display:inline-block;margin:2px 4px 2px 0;padding:2px 9px;border-radius:999px;background:var(--green-soft);color:var(--green);font-size:12px}.spc-sub>td{background:var(--canvas);padding:6px 10px 12px!important}.spc-ct{width:100%;border-collapse:collapse;font-size:13px;background:var(--surface);border:1px solid var(--line);border-radius:8px}.spc-ct th{font-size:11px;color:var(--muted);font-weight:600;text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}.spc-ct td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}.spc-ct tr:last-child td{border-bottom:0}.spc-ct .n{text-align:right;white-space:nowrap}.spc-ov{position:fixed;inset:0;background:rgba(15,20,40,.45);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:28px 12px;overflow:auto}.spc-md{background:var(--surface);color:var(--ink);border-radius:12px;padding:18px 20px;max-width:760px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.3)}.spc-md h3{margin:0 0 10px;display:flex;justify-content:space-between;align-items:center}.spc-x{border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:var(--muted)}.spc-g{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}.spc-l{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}.spc-bt{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.spc-vt{width:100%;border-collapse:collapse;font-size:13px}.spc-vt th,.spc-vt td{padding:3px 4px;text-align:left}.spc-sec{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:10px}.spc-sec>b{display:block;margin-bottom:6px}.spc-res{border:1px solid var(--line);border-radius:8px;background:var(--surface);max-height:190px;overflow:auto;margin-top:4px}.spc-res button{display:block;width:100%;text-align:left;padding:7px 10px;border:0;border-bottom:1px solid var(--line);background:none;color:var(--ink);cursor:pointer;font-size:13px}.spc-res button:hover{background:var(--canvas)}.spc-it{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}.spc-it .nm{flex:1;font-size:13px}.spc-it .nm small{display:block;color:var(--muted)}.spc-q{display:flex;align-items:center;gap:4px}.spc-q button{width:28px;height:28px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);cursor:pointer}.spc-q input{width:56px;text-align:center}@media(max-width:640px){.spc-g{grid-template-columns:1fr}}`;
function spcMdDraw(){let el=document.getElementById("spc-ov");if(!SPC.modal){if(el)el.remove();return}
  if(!document.getElementById("spc-css")){const s=document.createElement("style");s.id="spc-css";s.textContent=SPC_CSS;document.head.appendChild(s)}
  if(!el){el=document.createElement("div");el.id="spc-ov";el.className="spc-ov";document.body.appendChild(el)}el.innerHTML=spcModal()}
const spcLands=c=>(c.landings&&c.landings.length?c.landings:(c.landing?[c.landing]:[])).map(x=>String(x||"").trim()).filter(Boolean);
function spcAllVars(){return spcCat().flatMap(p=>(p.bt||[]).filter(v=>v.ma).map(v=>({ma:v.ma,ten:p.ten+((v.dt||v.pl)?" ("+spcVar(v)+")":"")+(spcMisa(v)?" · kho "+spcMisa(v):"")})))}
function spcResHtml(k,q){q=String(q||"").trim().toLowerCase();const all=spcAllVars(),m=q?all.filter(x=>(x.ma+" "+x.ten).toLowerCase().includes(q)):all;
  return m.slice(0,30).map(x=>`<button type="button" data-spc-act="cpick" data-spck="${k}" data-spcma="${esc(x.ma)}"><b>${esc(x.ma)}</b> · ${esc(x.ten)}</button>`).join("")+(q?`<button type="button" data-spc-act="cpick" data-spck="${k}" data-spcfree="${esc(q)}">+ Thêm “${esc(q)}” (chưa có mã trong danh sách)</button>`:"")||'<div class="hint" style="padding:8px">Không có sản phẩm nào.</div>'}
const spcQdOn=()=>typeof PAGES.kho_qd==="function"&&typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
const spcQdBtn=()=>spcQdOn()?`<button class="btn" data-spc-act="qd" style="margin-left:auto">Mở bảng quy đổi của kế toán</button>`:`<span class="hint" style="margin-left:auto">Bảng quy đổi của kế toán: trang quản trị › Kho hàng › Quy đổi mã các sàn</span>`;
const spcComboCode=c=>c.maSan||(c.gom||[]).map(x=>(spcCompCode(x)||x.ma||x.ten||"?")+"*"+(x.sl||1)).join("+");
function spcModal(){const M=SPC.modal;if(!M)return "";const d=M.d,fld=(l,f,ph,ty)=>`<label class="spc-l"><span>${l}</span><input class="spc-in" ${ty?`type="${ty}" `:""}data-spm="${f}" value="${esc(d[f]==null?"":d[f])}"${ph?` placeholder="${ph}"`:""}></label>`;
  const head=t=>`<h3><span>${t}</span><button class="spc-x" data-spc-act="mclose" title="Đóng">×</button></h3>`;
  if(M.t==="d"){const c=spcCombos().find(x=>x.id===M.id);if(!c)return "";const st=spcSt(c),ls=spcLands(c),ed=spcCanEdit();
    const row=(k,x)=>{const lk=x.ma?spcLookup(x.ma):null;return `<tr><td>${k}</td><td class="mono">${esc(x.ma||"—")}</td><td class="mono">${spcCompCode(x)?`<b>${esc(spcCompCode(x))}</b>`:'<span style="color:var(--red)">chưa có mã kho</span>'}</td><td>${esc(spcCompName(x))}</td><td class="n"><b>${x.sl||1}</b></td></tr>`};
    const lines=(c.gom||[]).map(x=>row("Mua",x)).concat((c.tang||[]).map(x=>row("Tặng",x)));
    return `<div class="spc-md" id="spc-md">${head("Chi tiết combo")}
    <table class="spc-ct"><thead><tr><th>Loại</th><th>Mã Pancake</th><th>Mã kho (MISA)</th><th>Sản phẩm</th><th class="n">Số lượng</th></tr></thead><tbody>${lines.join("")||`<tr><td colspan="5" class="hint">${esc(c.combo||"Chưa khai sản phẩm")}</td></tr>`}</tbody></table>
    <table class="spc-ct" style="margin-top:12px"><tbody>
    <tr><th>Mã combo</th><td class="mono"><b>${esc(spcComboCode(c))}</b>${c.maSan?"":' <span class="hint">(tự ghép từ sản phẩm; điền mã combo Pancake ở “Sửa” nếu có)</span>'}</td></tr>
    <tr><th>Giá bán</th><td><b>${nf(c.gia||0)}</b> · ${c.ship?"ship "+nf(c.ship):"miễn ship"}</td></tr>
    <tr><th>Page áp dụng</th><td>${c.page?esc(c.page):"Mọi page"}</td></tr>
    <tr><th>Người test</th><td>${esc(c.nguoi||"")}</td></tr>
    <tr><th>Thời gian</th><td>${pill(st[0],st[1])} ${c.tu?"từ "+spcVN(c.tu):""} ${c.den?"đến "+spcVN(c.den):""}</td></tr>
    <tr><th>Landing</th><td>${ls.map(u=>`<div><a href="${esc(u)}" target="_blank" rel="noopener">${esc(spcShort(u))}</a></div>`).join("")||"—"}</td></tr>
    ${c.ghi?`<tr><th>Ghi chú</th><td>${esc(c.ghi)}</td></tr>`:""}</tbody></table>
    <div class="spc-bt">${ed?`<button class="btn pri" data-spc-act="cedit" data-spid="${esc(c.id)}">Sửa combo</button>`:""}<button class="btn" data-spc-act="mclose">Đóng</button>${spcQdBtn()}</div></div>`}
  if(M.t==="c"){const isNew=!M.id;
    const sec=(k,title,hint)=>`<div class="spc-sec"><b>${title}</b>${(d[k]||[]).map((x,i)=>`<div class="spc-it"><div class="nm">${esc(spcCompName(x)||"(chưa chọn)")}<small>${x.ma?esc(x.ma):"chưa có mã"}</small></div><div class="spc-q"><button data-spc-act="cq" data-spck="${k}" data-spci="${i}" data-spcd="-1">−</button><input class="spc-in" type="number" min="1" data-spcq="${k}" data-spci="${i}" value="${x.sl||1}"><button data-spc-act="cq" data-spck="${k}" data-spci="${i}" data-spcd="1">+</button></div><button class="btn" data-spc-act="cdel" data-spck="${k}" data-spci="${i}">Bỏ</button></div>`).join("")||`<div class="hint">${hint}</div>`}<div style="margin-top:8px"><input class="spc-in" data-spcs="${k}" placeholder="Gõ tên hoặc mã để tìm sản phẩm rồi bấm chọn..." autocomplete="off"><div class="spc-res" id="spc-res-${k}" style="display:none"></div></div></div>`;
    const ls=d.landings&&d.landings.length?d.landings:[""];
    return `<div class="spc-md" id="spc-md">${head(isNew?"Thêm combo":"Sửa combo")}
    ${sec("gom","Combo gồm (sản phẩm × số lượng, kế toán dùng để quy đổi)","Chưa có sản phẩm. Gõ vào ô bên dưới để chọn.")}
    ${sec("tang","Tặng kèm","Không tặng gì.")}
    <div class="spc-sec"><b>Giá bán và áp dụng</b><div class="spc-g">${fld("Giá bán","gia","0")}${fld("Phí ship","ship","0")}${fld("Page áp dụng","page","để trống = mọi page")}${fld("Người test","nguoi","")}${fld("Từ ngày","tu","","date")}${fld("Đến ngày","den","","date")}</div>${fld("Ghi chú (ngày sale, test giá...)","ghi","")}</div>
    <div class="spc-sec"><b>Link landing áp dụng giá này (có thể nhiều link)</b>${ls.map((u,i)=>`<div class="spc-it"><input class="spc-in" data-spcl="${i}" value="${esc(u)}" placeholder="https://..."><button class="btn" data-spc-act="ldel" data-spci="${i}">Bỏ</button></div>`).join("")}<div class="spc-bt" style="margin-top:6px"><button class="btn" data-spc-act="ladd">+ Thêm link landing</button></div>${fld("Mã combo trên Pancake (nếu có)","maSan","")}</div>
    <div class="spc-bt"><button class="btn pri" data-spc-act="msave">Lưu</button>${isNew?"":`<button class="btn" data-spc-act="mnew" title="Giữ combo cũ đến hết hôm qua, tạo combo mới với giá và thông tin đang sửa từ hôm nay">Áp giá mới từ hôm nay</button><button class="btn" data-spc-act="mdel">Xóa</button>`}<button class="btn" data-spc-act="mclose">Hủy</button>${spcQdBtn()}</div>
    <p class="hint">Từ ngày và đến ngày để trống nghĩa là áp dụng liên tục. <b>Áp giá mới từ hôm nay</b> dùng khi đổi giá: combo cũ tự kết thúc hôm qua, combo mới bắt đầu hôm nay, vẫn giữ lịch sử giá.</p></div>`}
  const vr=(d.bt||[]).map(v=>`<tr data-spvrow="${esc(v.id)}"><td><input class="spc-in" data-spv="ma" value="${esc(v.ma||"")}" placeholder="mã Pancake"></td><td><input class="spc-in" data-spv="dt" value="${esc(v.dt||"")}" placeholder="5kg, 300ml..."></td><td><input class="spc-in" data-spv="pl" value="${esc(v.pl||"")}" placeholder="hương, màu..."></td><td><input class="spc-in" data-spv="misa" value="${esc(v.misa||SPC_MISA[v.ma]||"")}" placeholder="${spcCanMisa()?"mã MISA":"chờ kế toán"}"${spcCanMisa()?"":" disabled"}></td><td><input class="spc-in" data-spv="pk" value="${esc(v.pk||"")}" placeholder="${spcCanMisa()?"tên sản phẩm trên Pancake":"chờ kế toán"}"${spcCanMisa()?"":" disabled"}></td><td style="text-align:center"><input type="checkbox" data-spv="on"${v.on!==false?" checked":""} title="đang chạy"></td><td><button class="btn" data-spc-act="vdel" data-spvid="${esc(v.id)}">×</button></td></tr>`).join("");
  return `<div class="spc-md" id="spc-md">${head(M.id?"Sửa sản phẩm":"Thêm sản phẩm")}
    <div class="spc-g">${fld("Tên sản phẩm","ten","ví dụ: Nước lau sàn chuyên dụng")}<label class="spc-l"><span>Loại</span><select class="spc-in" data-spm="loai">${[SPC_RUN,SPC_GIFT,SPC_OFF].map(v=>`<option value="${v}"${d.loai===v?" selected":""}>${SPC_LBL[v]}</option>`).join("")}</select></label></div>
    <p class="hint" style="margin:6px 0 2px"><b>Biến thể</b> (dung tích, phân loại/hương). Tích ô cuối dòng cho biến thể <b>đang chạy</b>; mã Pancake dùng để gộp doanh thu. Digital chỉ cần tạo sản phẩm và mã Pancake. <b>Mã kho (MISA)</b> do kế toán (chị Huệ) thêm sau; kế toán điền cùng <b>Tên trên Pancake</b> thì hệ thống tự thêm vào bảng quy đổi Facebook (mã đã có thì không đụng tới).</p>
    <table class="spc-vt"><thead><tr><th>Mã Pancake</th><th>Dung tích</th><th>Phân loại</th><th>Mã kho (MISA)</th><th>Tên trên Pancake</th><th>Chạy</th><th></th></tr></thead><tbody>${vr||`<tr><td colspan="7" class="empty">Chưa có biến thể.</td></tr>`}</tbody></table>
    <div class="spc-bt"><button class="btn" data-spc-act="vadd">+ Thêm biến thể</button></div>
    <div class="spc-bt"><button class="btn pri" data-spc-act="msave">Lưu</button>${M.id?`<button class="btn" data-spc-act="mdel">Xóa sản phẩm</button>`:""}<button class="btn" data-spc-act="mclose">Hủy</button></div></div>`}

/* ---- Khung xem: mỗi sản phẩm một dòng, bấm để xổ các combo (giá bán, page áp dụng) ---- */
function spcEditor(F,days,opt){
  const ed=spcCanEdit(),cat=spcCat(),all=spcCombos();opt=opt||{};
  const runN=cat.filter(p=>p.loai===SPC_RUN).length,giftN=cat.filter(p=>p.loai===SPC_GIFT).length,used=new Set();
  const cRow=c=>{const st=spcSt(c),when=(c.tu||c.den)?`${c.tu?"từ "+spcVN(c.tu):""}${c.tu&&c.den?" ":""}${c.den?"đến "+spcVN(c.den):""}`:"",ls=spcLands(c),qd=l=>(l||[]).map(x=>`<div><span class="mono">${spcCompCode(x)?`<b>${esc(spcCompCode(x))}</b>`:`<b style="color:var(--red)" title="Digital điền mã kho ở khung sửa sản phẩm">chưa có mã kho</b>`} × ${x.sl||1}</span> <small class="hint">${esc(spcCompName(x,1))}</small></div>`).join(""),gom=qd(c.gom)||esc(c.combo||"(chưa khai sản phẩm)"),tang=qd(c.tang)||esc(c.qua||"");
    return `<tr class="clk" data-spc-act="cview" data-spid="${esc(c.id)}"><td>${gom}${c.maSan?`<div class="hint">Mã Pancake: ${esc(c.maSan)}</div>`:""}${c.ghi?`<small class="hint" style="display:block">${esc(c.ghi)}</small>`:""}</td><td>${tang||'<span class="hint">—</span>'}</td><td class="n"><b>${nf(c.gia||0)}</b></td><td class="n">${c.ship?nf(c.ship):"miễn ship"}</td><td>${c.page?esc(c.page):'<span class="hint">mọi page</span>'}</td><td>${esc(c.nguoi||"")}</td><td>${pill(st[0],st[1])}${when?`<small class="hint" style="display:block">${when}</small>`:""}</td><td>${ls.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener" title="${esc(u)}">link ${i+1}</a>`).join(" · ")||'<span class="hint">—</span>'}</td>${ed?`<td><button class="btn" data-spc-act="cedit" data-spid="${esc(c.id)}">Sửa</button></td>`:""}</tr>`};
  const cTbl=(cs,pid)=>`<table class="spc-ct"><thead><tr><th>Combo gồm (mã kho × số lượng)</th><th>Tặng kèm (mã kho × SL)</th><th class="n">Giá bán</th><th class="n">Ship</th><th>Page</th><th>Người test</th><th>Áp dụng</th><th>Landing</th>${ed?"<th></th>":""}</tr></thead><tbody>${cs.map(cRow).join("")||`<tr><td colspan="${ed?9:8}" class="hint">Chưa có combo nào cho sản phẩm này.</td></tr>`}</tbody></table>${ed&&pid?`<div style="margin-top:8px"><button class="btn pri" data-spc-act="cadd" data-spid="${esc(pid)}">+ Thêm combo cho sản phẩm này</button></div>`:""}`;
  const wait=cat.filter(p=>p.loai!==SPC_OFF).flatMap(p=>(p.bt||[]).filter(v=>v.on!==false&&!spcMisa(v)).map(v=>p.ten+((v.dt||v.pl)?" ("+spcVar(v)+")":"")));
  const pr=cat.map(p=>{const cs=spcProdCombos(p,all);cs.forEach(c=>used.add(c.id));const open=!!SPC.openP[p.id],on=(p.bt||[]).filter(v=>v.on!==false),off=(p.bt||[]).length-on.length;
    return `<tr class="clk" data-spc-act="ptg" data-spid="${esc(p.id)}"><td><b>${open?"▾ ":"▸ "}${esc(p.ten)}</b></td><td>${pill(SPC_LBL[p.loai],p.loai===SPC_RUN?"grn":p.loai===SPC_GIFT?"amb":"gry")}</td><td>${on.map(v=>`<span class="spc-chip">${esc(spcVar(v))}</span>`).join("")||'<span class="hint">chưa có biến thể đang chạy</span>'}${off?`<span class="hint"> · ${off} không chạy</span>`:""}</td><td class="n">${cs.length?cs.length+" combo":"—"}</td>${ed?`<td class="n"><button class="btn" data-spc-act="pedit" data-spid="${esc(p.id)}">Sửa</button></td>`:""}</tr>`+(open?`<tr class="spc-sub"><td colspan="${ed?5:4}"><div style="overflow-x:auto">${cTbl(cs,p.id)}</div></td></tr>`:"")}).join("");
  const orph=all.filter(c=>!used.has(c.id));
  spcMdDraw();return `<style>${SPC_CSS}</style>
  <section class="fbd-card fbd-wide"><h3>Sản phẩm đang chạy quảng cáo <span class="hint" style="font-weight:400">${runN} đang chạy · ${giftN} quà tặng · ${all.length} combo</span></h3>
  <p class="fbd-note">${opt.van?"Digital tự điền, không có giá vốn. ":""}<b>Bấm vào một sản phẩm</b> để xem combo, giá bán, page áp dụng. Chỉ sản phẩm <b>đang chạy</b> được tính vào bảng hiệu quả ở trang quản trị; quà tặng tách riêng.${ed?"":" Cần quyền Digital để sửa."}</p>
  ${wait.length?`<p class="fbd-note" style="background:var(--amber-soft,#fff6e0);padding:8px 12px;border-radius:8px"><b>Chờ kế toán thêm mã kho (${wait.length}):</b> ${wait.slice(0,12).map(x=>esc(x)).join(", ")}${wait.length>12?"…":""}. Kế toán vào “Sửa” sản phẩm để điền mã MISA.</p>`:""}${ed?`<div class="spc-bt" style="margin:0 0 10px"><button class="btn pri" data-spc-act="padd">+ Thêm sản phẩm</button></div>`:""}<div class="tbl"><table><thead><tr><th>Sản phẩm</th><th>Loại</th><th>Biến thể đang chạy</th><th class="n">Combo</th>${ed?"<th></th>":""}</tr></thead><tbody>${pr}</tbody></table></div></section>
  ${orph.length?`<section class="fbd-card fbd-wide"><h3>Combo chưa gắn vào sản phẩm nào <span class="hint" style="font-weight:400">${orph.length} combo</span></h3><div style="overflow-x:auto">${cTbl(orph,"")}</div></section>`:""}`;
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
  document.addEventListener("input",e=>{const t=e.target;if(!t||!t.dataset||!SPC.modal||SPC.modal.t!=="c")return;const d=SPC.modal.d;
    if(t.dataset.spm!==undefined){d[t.dataset.spm]=t.value}
    else if(t.dataset.spcl!==undefined){d.landings=d.landings&&d.landings.length?d.landings:[""];d.landings[+t.dataset.spcl]=t.value}
    else if(t.dataset.spcq!==undefined){const x=(d[t.dataset.spcq]||[])[+t.dataset.spci];if(x)x.sl=Math.max(1,Math.round(+t.value)||1)}
    else if(t.dataset.spcs!==undefined){const r=document.getElementById("spc-res-"+t.dataset.spcs);if(r){r.style.display="block";r.innerHTML=spcResHtml(t.dataset.spcs,t.value)}}});
  document.addEventListener("focusin",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.spcs!==undefined){const r=document.getElementById("spc-res-"+t.dataset.spcs);if(r){r.style.display="block";r.innerHTML=spcResHtml(t.dataset.spcs,t.value)}}});
  document.addEventListener("mousedown",e=>{if(e.target&&e.target.id==="spc-ov"){SPC.modal=null;spcMdDraw()}});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&SPC.modal){SPC.modal=null;spcMdDraw()}});
  document.addEventListener("toggle",e=>{const t=e.target;if(t&&t.dataset&&t.dataset.spcO!==undefined)SPC.openO=t.open},true);
  document.addEventListener("click",e=>{const b=e.target&&e.target.closest?e.target.closest("[data-spc-act]"):null;if(!b)return;const act=b.dataset.spcAct,id=b.dataset.spid;
    if(act==="rtg"){SPC.openR[id]=!SPC.openR[id];renderMain();return}
    if(act==="ptg"){SPC.openP[id]=!SPC.openP[id];renderMain();return}
    if(act==="cview"){SPC.modal={t:"d",id};spcMdDraw();return}
    if(act==="qd"){SPC.modal=null;spcMdDraw();if(spcQdOn()){PAGE="kho_qd";try{if(APP_MODE==="admin"&&!modGroups(curMod()).some(g=>g[1].some(i=>i[0]===PAGE)))MOD=""}catch(e){}render();scrollTo(0,0)}return}
    if(!spcCanEdit())return;
    const today=iso(new Date()),yest=iso(new Date(Date.now()-864e5));
    if(act==="padd"){SPC.modal={t:"p",id:"",d:{ten:"",loai:SPC_RUN,bt:[{id:"v"+Date.now(),ma:"",dt:"",pl:"",on:true}]}};spcMdDraw()}
    else if(act==="pedit"){const p=spcCat().find(x=>x.id===id);if(p){SPC.modal={t:"p",id,d:spcClone(p)};spcMdDraw()}}
    else if(act==="cadd"){const p=id?spcCat().find(x=>x.id===id):null,v=p&&(p.bt||[]).find(x=>x.ma&&x.on!==false);const lastL=spcCombos().find(c=>spcProdCombos(p||{bt:[],ten:""},[c]).length);SPC.modal={t:"c",id:"",d:{nhom:p?p.ten:"",landing:"",landings:lastL?spcLands(lastL):[""],page:"",nguoi:ME.name||"",combo:"",qua:"",gom:v?[{ma:v.ma,sl:1}]:[],tang:[],maSan:"",ship:0,gia:0,tu:today,den:"",ghi:""}};spcMdDraw()}
    else if(act==="cdel"){const k=b.dataset.spck,i=+b.dataset.spci;SPC.modal.d[k]=(SPC.modal.d[k]||[]).filter((x,j)=>j!==i);spcMdDraw()}
    else if(act==="cq"){const k=b.dataset.spck,x=(SPC.modal.d[k]||[])[+b.dataset.spci];if(x){x.sl=Math.max(1,(+x.sl||1)+(+b.dataset.spcd))}spcMdDraw()}
    else if(act==="cpick"){const k=b.dataset.spck,L=SPC.modal.d[k]=SPC.modal.d[k]||[];if(b.dataset.spcfree)L.push({ma:"",ten:b.dataset.spcfree,sl:1});else{const f=L.find(x=>x.ma===b.dataset.spcma);if(f)f.sl=(+f.sl||1)+1;else L.push({ma:b.dataset.spcma,sl:1})}spcMdDraw()}
    else if(act==="ladd"){const d=SPC.modal.d;d.landings=(d.landings&&d.landings.length?d.landings:[""]).concat([""]);spcMdDraw()}
    else if(act==="ldel"){const d=SPC.modal.d;d.landings=(d.landings||[]).filter((x,j)=>j!==+b.dataset.spci);spcMdDraw()}
    else if(act==="cedit"){const c=spcCombos().find(x=>x.id===id);if(c){SPC.modal={t:"c",id,d:spcClone(c)};spcMdDraw()}}
    else if(act==="mclose"){SPC.modal=null;spcMdDraw();spcMdDraw()}
    else if(act==="vadd"){spcCapture();SPC.modal.d.bt.push({id:"v"+Date.now(),ma:"",dt:"",pl:"",on:true});spcMdDraw()}
    else if(act==="vdel"){spcCapture();const vid=b.dataset.spvid;SPC.modal.d.bt=SPC.modal.d.bt.filter(v=>v.id!==vid);spcMdDraw()}
    else if(act==="msave"){spcCapture();const M=SPC.modal;if(!M)return;
      if(M.t==="c"){M.d.ship=Math.round(+String(M.d.ship).replace(/[^\d]/g,""))||0;M.d.gia=Math.round(+String(M.d.gia).replace(/[^\d]/g,""))||0;M.d.landings=spcLands(M.d);M.d.landing=M.d.landings[0]||"";M.d.combo=spcCompText(M.d.gom,1);M.d.qua=spcCompText(M.d.tang,1);if(!(M.d.gom||[]).length){toast("Chị chọn ít nhất một sản phẩm trong combo");return}if(!String(M.d.nhom||"").trim())M.d.nhom=spcCompName(M.d.gom[0]).replace(/\s*\(.*$/,"");spcEdit(M.id?"sửa combo":"thêm combo",c=>{if(M.id){const i=c.combos.findIndex(x=>x.id===M.id);if(i>=0)c.combos[i]=Object.assign({},c.combos[i],M.d)}else c.combos.unshift(Object.assign({id:"n"+Date.now()},M.d))})}
      else{if(!String(M.d.ten||"").trim()){toast("Chị nhập tên sản phẩm trước");return}M.d.bt=(M.d.bt||[]).filter(v=>String(v.ma||"").trim()||String(v.dt||"").trim()||String(v.pl||"").trim());spcSyncKho(M.d);spcEdit(M.id?"sửa sản phẩm "+M.d.ten:"thêm sản phẩm "+M.d.ten,c=>{if(M.id){const i=c.sp.findIndex(x=>x.id===M.id);if(i>=0)c.sp[i]=Object.assign({},c.sp[i],M.d)}else c.sp.push(Object.assign({id:"p"+Date.now()},M.d))})}
      SPC.modal=null;spcMdDraw()}
    else if(act==="mnew"){spcCapture();const M=SPC.modal;if(!M||M.t!=="c"||!M.id)return;spcEdit("áp giá mới từ hôm nay",c=>{const i=c.combos.findIndex(x=>x.id===M.id);if(i>=0){if(!c.combos[i].den||c.combos[i].den>yest)c.combos[i].den=yest;c.combos.splice(i+1,0,Object.assign({},M.d,{id:"n"+Date.now(),tu:today,den:M.d.den&&M.d.den>=today?M.d.den:""}))}});SPC.modal=null;spcMdDraw()}
    else if(act==="mdel"){const M=SPC.modal;if(!M||!M.id)return;if(!confirm(M.t==="c"?"Xóa combo này?":"Xóa sản phẩm này?"))return;spcEdit(M.t==="c"?"xóa combo":"xóa sản phẩm",c=>{if(M.t==="c")c.combos=c.combos.filter(x=>x.id!==M.id);else c.sp=c.sp.filter(x=>x.id!==M.id)});SPC.modal=null;spcMdDraw()}})}

/* Trang riêng ở bản vận hành (Marketing › Digital Marketing › Sản phẩm và combo): Digital tự điền, không có giá vốn */
PAGES.dg_sp=function(m){m.innerHTML=H("Sản phẩm và combo","Sản phẩm nào đang chạy, biến thể, combo, giá, landing, page và ngày áp dụng · không có giá vốn")+spcEditor(null,[],{van:true})};
(function(){try{
  const st=PAGE_SETS.find(x=>x.n==="Digital Marketing");
  if(st&&!st.ids.includes("dg_sp")){const i=st.ids.indexOf("dg_lib");const at=i>=0?i:st.ids.length;st.ids.splice(at,0,"dg_sp");st.labels.splice(at,0,"Sản phẩm và combo")}
  const mk=MODULES.find(x=>x.k==="mkt");
  if(mk&&!mk._sp){mk._sp=1;const g0=mk.groups;mk.groups=function(){const r=g0.apply(this,arguments);r.forEach(gr=>{const arr=gr[1],j=arr.findIndex(it=>it&&it[0]==="dg_lib");if(j>=0&&!arr.some(it=>it&&it[0]==="dg_sp"))arr.splice(j,0,MI("dg_sp","Sản phẩm và combo",tm("ads",dgOk)))});return r}}
}catch(e){console.warn("menu sản phẩm và combo",e)}})();
