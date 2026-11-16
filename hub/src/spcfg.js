/* =====================================================================
   VẬN HÀNH › CẤU HÌNH › SẢN PHẨM · COMBO · KHUYẾN MÃI (chị Hoa duyệt 16/11, theo cách Poscake,
   demo C:\Users\ADMIN\Downloads\demo-san-pham-combo-km-poscake.html; giao diện theo màu web).
   Khác Poscake: trên mỗi trang chọn KÊNH / BỘ PHẬN, mỗi người chỉ thấy kênh của mình, không hiện giá vốn.
     Ads Facebook (phòng ADS)   : sản phẩm + combo Ads (spdangchay.js, d.fbCat)
     CSKH (phòng CSKH / B2C)    : sản phẩm + combo riêng của CSKH (d.cskhCat), không chạy ads
     TikTok (phòng CM), Shopee  : combo trên sàn (bảng quy đổi của kế toán) + khai combo mới (d.ttCombo)
     Kênh phân phối (phòng KV)  : sản phẩm + bảng giá 8 cấp (chỉ xem)
   Combo, khuyến mãi mới chờ kế toán duyệt (combo qua phiếu như Ads; khuyến mãi d.kmCat). Pancake: chỉ đọc
   (sản phẩm, giá, ảnh, combo); ghi ngược lên Pancake chờ chị duyệt riêng. CEO, Ban điều hành (BDH), kế toán (KT) thấy hết.
   Bố cục kiểu Poscake (chị Hoa 16/11 chiều): một thanh công cụ gọn, cột ảnh, hộp thoại giữa màn hình chia mục trái / ô phải.
   ===================================================================== */
const SPCF={ch:"",q:"",open:{},kmT:"all",b2b:null,b2bBusy:false,pkOpen:false,pkcb:null,pkcbBusy:false,pkcbErr:"",san:{},tier:""};
const SPCF_CSS=`<style>
.spf-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--line)}
.spf-bar .spf-q{flex:1 1 200px;max-width:300px;height:34px;padding:0 10px}
.spf-bar .sp{flex:1}.spf-bar .btn{height:34px;padding:0 12px;font-size:13px}
.spf-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
.spf-seg button{border:0;border-right:1px solid var(--line);background:#fff;padding:0 12px;height:32px;font:inherit;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer}
.spf-seg button:last-child{border-right:0}.spf-seg button.on{background:var(--navy);color:#fff}
.spf-gt td{padding-top:5px!important;padding-bottom:5px!important}.spf-gt td.cd{width:1%;white-space:nowrap}.spf-gt .spf-tag{font-size:11px;padding:1px 6px}.spf-gt .spf-img{width:30px;height:30px}.spf-gt a.nm{color:inherit;font-weight:600;text-decoration:none}.spf-gt a.nm:hover{color:var(--pri);text-decoration:underline}
.spf-img{width:38px;height:38px;border-radius:8px;object-fit:cover;border:1px solid var(--line);background:var(--gray-soft);display:block}
.spf-sw{appearance:none;-webkit-appearance:none;width:34px!important;height:20px;border-radius:20px;background:#d0d5dd;position:relative;cursor:pointer;margin:0;flex:none;transition:.15s}
.spf-sw:before{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.15s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.spf-sw:checked{background:var(--green)}.spf-sw:checked:before{left:16px}.spf-sw:disabled{opacity:.6;cursor:default}
.spf-tag{font-family:var(--fm);font-size:12px;padding:1px 6px;border-radius:6px;background:var(--pink-soft);color:var(--pink);border:1px solid #f9c6dc;margin-right:6px;white-space:nowrap}
.cm-in.spfm{width:min(1060px,96vw);max-width:none;display:flex;flex-direction:column}
.cm-in.spfm .cm-b{background:var(--canvas);padding:0 18px;flex:1;overflow:auto}
.spf-sec{display:grid;grid-template-columns:190px minmax(0,1fr);gap:16px;padding:16px 0;border-bottom:1px solid var(--line)}
.spf-sec:last-of-type{border-bottom:0}.spf-sec h4{margin:4px 0 0;font-size:14px}.spf-sec .hint{font-size:12.5px;margin:4px 0 0}
.spf-box{background:#fff;border:1px solid var(--line);border-radius:12px;padding:2px 16px}
.spf-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f0f1f5}.spf-row:last-child{border-bottom:0}
.spf-row>label{flex:1;font-size:13.5px;color:var(--ink)}.spf-row>.v{flex:0 1 58%;display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap}
.spf-row>.v input:not([type=checkbox]):not([type=radio]),.spf-row>.v select{flex:1;min-width:0}
.spf-row>.v label{display:inline-flex;gap:6px;align-items:center;font-size:13.5px;white-space:nowrap}
.spf-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--line);background:#fff}
.spf-pick{position:relative;padding:10px 0}.spf-pick input{width:100%}
.spf-pr{position:absolute;left:0;right:0;top:46px;z-index:5;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);max-height:300px;overflow:auto}
.spf-pr:empty{display:none}.spf-pr button{display:flex;gap:10px;align-items:center;width:100%;border:0;border-bottom:1px solid #f0f1f5;background:#fff;padding:7px 10px;font:inherit;font-size:13px;text-align:left;cursor:pointer}
.spf-pr button:hover{background:var(--gray-soft)}.spf-pr .spf-img{width:30px;height:30px}
.spf-its .hd,.spf-it{display:grid;grid-template-columns:48px minmax(0,1fr) 120px 100px 34px;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f0f1f5}
.spf-its .hd{font-size:12.5px;font-weight:700;color:var(--muted);padding:6px 0}.spf-it input{width:100%;text-align:right}
.spf-it .del{border:0;background:none;color:var(--red);font-size:16px;cursor:pointer}
.spf-sum{display:flex;justify-content:flex-end;gap:18px;padding:10px 0;font-size:13.5px}.spf-empty{padding:18px 0;text-align:center;color:var(--muted);font-size:13px}
.spf-kmg{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;padding:16px 0}
.spf-kmc{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px;min-height:200px}
.spf-kmc .h{display:flex;gap:10px;align-items:center;font-weight:700;font-size:14px}.spf-kmc p{margin:0;color:var(--muted);font-size:13px}
.spf-kmc .btn{margin-top:auto;align-self:flex-start}
.spf-ico{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:#fff;font-size:15px;flex:none}
.spf-tiers{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 14px}
.spf-nb{overflow:auto;max-height:74vh;margin:0 14px 4px;border:1px solid #f4b6cf;border-radius:12px}
.spf-nb table{border-collapse:separate;border-spacing:0;width:100%;font-size:13.5px;font-variant-numeric:tabular-nums}
.spf-nb th{position:sticky;top:0;z-index:2;background:var(--pink);color:#fff;font-weight:700;font-size:13px;padding:10px 8px;text-align:center;border-right:1px solid rgba(255,255,255,.35);text-transform:none;letter-spacing:0;white-space:nowrap}
.spf-nb th.l{text-align:left}.spf-nb th:last-child,.spf-nb td:last-child{border-right:0}
.spf-nb td{padding:7px 8px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:#fff;vertical-align:middle}
.spf-nb td.c{text-align:center}.spf-nb td.n{text-align:right;white-space:nowrap;position:relative}
.spf-nb td.ny{color:var(--muted)}.spf-nb td.hl{background:var(--pink-soft);font-weight:700;color:#9d1b55}
.spf-nb td.miss{text-align:center;color:#b9bec8;font-size:12px}
.spf-nb td.cd{font-family:var(--fm);font-size:12px;color:var(--muted);white-space:nowrap}.spf-nb td.cd small{font-size:11px}
.spf-nb tr.grp td{background:#fdf2f7;color:#9d1b55;font-weight:700;font-size:12.5px;padding:6px 10px}.spf-nb tr.grp td span{font-weight:500;color:var(--muted)}
.spf-nb tbody tr:not(.grp):hover td{background:#fafbff}.spf-nb tbody tr:not(.grp):hover td.hl{background:#fde3ee}
.spf-nb td.chg,.spf-nb tbody tr:hover td.chg{background:#fff6c7}
.spf-adj{position:absolute;top:5px;right:3px;width:5px;height:5px;border-radius:50%;background:var(--pink)}
.spf-nb .spf-xin{width:100%;min-width:80px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;text-align:right;font:inherit;padding:4px 6px;outline:none}.spf-nb .spf-xin:focus{box-shadow:inset 0 0 0 2px var(--blue);background:#fff}
.spf-chips{display:flex;gap:6px;flex-wrap:wrap;padding:6px 0}.spf-chip{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:999px;padding:3px 6px 3px 10px;font-size:13px;background:#fff}
.spf-chip button{border:0;background:none;color:var(--red);cursor:pointer;font-size:13px}
@media(max-width:760px){.spf-sec{grid-template-columns:1fr;gap:8px}.spf-row{flex-wrap:wrap}.spf-row>.v{flex-basis:100%;justify-content:flex-start}.spf-its .hd,.spf-it{grid-template-columns:40px minmax(0,1fr) 70px 30px}.spf-its .hd span:nth-child(4),.spf-it .gc{display:none}}
</style>`;
const spcfAll=u=>!!u&&(u.role==="admin"||["BDH","KT"].includes(u.phongBan));
const SPCF_CH=[
  ["ads","Ads Facebook",u=>spcfAll(u)||u.phongBan==="ADS"||u.role==="digital"],
  ["cskh","CSKH",u=>spcfAll(u)||["CSKH","B2C"].includes(u.phongBan)],
  ["tt","TikTok",u=>spcfAll(u)||u.phongBan==="CM"],
  ["sp","Shopee",u=>spcfAll(u)],
  ["b2b","Kênh phân phối",u=>spcfAll(u)||u.phongBan==="KV"]];
const SPCF_BP=Object.fromEntries(SPCF_CH.map(c=>[c[0],c[1]]));
const spcfChs=u=>SPCF_CH.filter(c=>c[2](u));
const spcfMyBp=u=>spcfChs(u).map(c=>c[0]);
const spcfList=k=>{try{const a=D()[k];return Array.isArray(a)?a:[]}catch(e){return []}};
const spcfCanDuyet=()=>typeof spcCanDuyet==="function"&&spcCanDuyet();
const spcfVN=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"";
const spcfToday=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
const spcfNum=v=>+String(v||"").replace(/[^0-9]/g,"")||0;
const spcfFold=s=>(typeof kfold==="function"?kfold:spcLow)(s||"");
/* Kênh đang chọn; Ads / CSKH thì đặt SPC.bpView để spdangchay.js đọc đúng kho (d.fbCat / d.cskhCat). */
function spcfCh(){const L=spcfChs(ME).filter(c=>PAGE!=="sp_cb"||c[0]!=="b2b");if(!L.some(c=>c[0]===SPCF.ch))SPCF.ch=L.length?L[0][0]:"";
  if(typeof SPC!=="undefined")SPC.bpView=SPCF.ch==="ads"?"ADS":SPCF.ch==="cskh"?"CSKH":null;return SPCF.ch}
const spcfNoAccess=(m,t)=>{m.innerHTML=H(t,"")+`<div class="note">Trang này dành cho phòng Ads, Content (TikTok), CSKH, Kênh phân phối và kế toán.</div>`};
/* Khung trang: tiêu đề + một thẻ có thanh công cụ một hàng (chọn kênh · ô tìm · số dòng · nút), rồi nội dung.
   o: {q: placeholder ô tìm (bỏ trống thì không có ô tìm), count, tools, inner (trong thẻ), after (dưới thẻ)} */
function spcfFrame(m,t,sub,o){
  const chs=o.noCh?[]:spcfChs(ME).filter(c=>PAGE!=="sp_cb"||c[0]!=="b2b"),cb=PAGE==="sp_cb";
  m.innerHTML=SPCF_CSS+H(t,sub)+`<section class="card flush"><div class="spf-bar">${chs.length>1?`<div class="spf-seg">${chs.map(([k,n])=>`<button class="${SPCF.ch===k?"on":""}" data-spcfch="${k}">${n}</button>`).join("")}</div>`:""}
    ${o.q?`<input id="spcf-q" class="spf-q" placeholder="${esc(o.q)}" value="${esc(SPCF.q)}">`:""}${o.count?`<span class="hint">${o.count}</span>`:""}<span class="sp"></span>${o.tools||""}</div>${cb&&SPCF.ch?`<div class="settabs" style="margin:10px 14px 4px">${[["cb","Combo"],["sp","Mã bán trên kênh"]].map(([k,n])=>`<button class="${(SPCF.sub||"cb")===k?"on":""}" data-spcfsub="${k}">${n}</button>`).join("")}</div>`:""}${o.inner||""}</section>${o.after||""}`;
  m.querySelectorAll("[data-spcfsub]").forEach(b=>b.onclick=()=>{SPCF.sub=b.dataset.spcfsub;SPCF.q="";renderMain()});
  spcfDotsBind(m);
  m.querySelectorAll("[data-spcfch]").forEach(b=>b.onclick=()=>{SPCF.ch=b.dataset.spcfch;SPCF.open={};SPCF.pkOpen=false;SPCF.q="";renderMain()});
  if(typeof spbPkBind==="function")spbPkBind(m);spcfBind(m)}
const spcfCatEd=()=>typeof spcCanEdit==="function"&&spcCanEdit();
/* Ảnh, giá Pancake theo mẫu mã: khớp mã nội bộ Pancake (pkId), không có thì theo mã (bỏ mã số ngắn trùng nhau như "1"). */
const spcfPkRow=(pkId,ma)=>{const R=(SPCB.pk&&SPCB.pk.rows)||[];return (pkId&&R.find(r=>r.id===pkId))||(ma&&!/^\d{1,3}$/.test(ma)&&R.find(r=>spcLow(r.code)===spcLow(ma)))||null};
const spcfImg=src=>src?`<img class="spf-img" src="${esc(src)}" loading="lazy" alt="">`:`<span class="spf-img"></span>`;
const spcfVImg=v=>spcfImg((spcfPkRow(v.pkId,v.ma)||{}).img||"");
const spcfVars=()=>(typeof spcCat==="function"?spcCat():[]).flatMap(p=>(p.bt||[]).filter(v=>v.ma).map(v=>({ma:v.ma,pkId:v.pkId||"",ten:p.ten+((v.dt||v.pl)?" ("+[v.dt,v.pl].filter(Boolean).join(" · ")+")":""),gia:+v.gia||(typeof spbPkPrice==="function"?spbPkPrice(v):0)||0,loai:p.loai,on:v.on!==false,misa:spcMisa(v),img:(spcfPkRow(v.pkId,v.ma)||{}).img||""})));
const spcfPkNeed=()=>{if(!SPCB.pk&&!SPCB.pkBusy&&!SPCB.pkErr&&typeof spbPkLoad==="function")setTimeout(()=>{if(!SPCB.pk&&!SPCB.pkBusy)spbPkLoad()},0)};
/* Hộp thoại giữa màn hình kiểu Poscake: mục bên trái, ô nhập bên phải, nút dưới cùng. */
const spcfSec=(t,inner,hint)=>`<div class="spf-sec"><div><h4>${t}</h4>${hint?`<p class="hint">${hint}</p>`:""}</div><div>${inner}</div></div>`;
const spcfBox=rows=>`<div class="spf-box">${rows}</div>`;
const spcfRow=(l,ctrl)=>`<div class="spf-row"><label>${l}</label><div class="v">${ctrl}</div></div>`;
function spcfModal(title,body,foot){const y=($("#crmm .cm-in")||{}).scrollTop||0,open=$("#crmm")&&!$("#crmm").hidden&&$("#crmm .cm-in.spfm");
  crmModal(title,body,true);const R=$("#crmm"),inn=R.querySelector(".cm-in");inn.classList.add("spfm");
  inn.insertAdjacentHTML("beforeend",`<div class="spf-foot"><button class="btn" data-spfx="1">Hủy</button>${foot}</div>`);inn.querySelector("[data-spfx]").onclick=closeCM;
  if(open)inn.querySelector(".cm-b").scrollTop=y;return R}
/* Ô tìm và chọn sản phẩm (danh sách kết quả hiện ngay dưới ô, kèm ảnh, mã, giá) */
function spcfPicker(R,k,V,onPick,onNew){const inp=R.querySelector(`.spf-ps[data-k="${k}"]`),out=R.querySelector(`.spf-pr[data-k="${k}"]`);if(!inp||!out)return;
  const show=()=>{const q=spcfFold(inp.value).trim();out.innerHTML=((q?V.filter(v=>spcfFold(v.ma+" "+(v.tag||"")+" "+v.ten).includes(q)):V).slice(0,30).map(v=>`<button data-ma="${esc(v.ma)}">${spcfImg(v.img)}<span style="flex:1"><span class="spf-tag">${esc(v.tag||v.ma)}</span>${esc(v.ten)}${v.note?`<br><small class="hint">${esc(v.note)}</small>`:""}</span><span class="hint">${v.gia?nf(v.gia)+" đ":""}</span></button>`).join("")||`<div class="spf-empty">Không thấy sản phẩm</div>`)+(onNew?`<button data-spfnew="1"><span style="flex:1;color:var(--pri);font-weight:600">+ Thêm sản phẩm mới${inp.value.trim()?" “"+esc(inp.value.trim())+"”":""}</span></button>`:"");
    out.querySelectorAll("[data-ma]").forEach(b=>b.onmousedown=e=>{e.preventDefault();onPick(b.dataset.ma)});
    const nb=out.querySelector("[data-spfnew]");if(nb)nb.onmousedown=e=>{e.preventDefault();onNew(inp.value.trim())}};
  inp.oninput=show;inp.onfocus=show;inp.onblur=()=>setTimeout(()=>{out.innerHTML=""},150)}
const spcfPickBox=(k,ph)=>`<div class="spf-pick"><input class="spf-ps" data-k="${k}" placeholder="${esc(ph||"Tìm sản phẩm theo mã, tên…")}" autocomplete="off"><div class="spf-pr" data-k="${k}"></div></div>`;

/* ============================== SẢN PHẨM GỐC (chị Hoa 16/11) ==============================
   Mỗi sản phẩm một hồ sơ: ảnh, mã MISA, tên, giá vốn, giá lẻ niêm yết và giá bán từng kênh (bấm vào sản phẩm). Combo các kênh chọn món từ danh sách này.
   - Giá vốn: lấy đúng chỗ đang dùng (Giá vốn SKU kế toán nhập > giá nhập kho bình quân), chỉ CEO, kế toán thấy.
   - Giá lẻ niêm yết: cấp Bán lẻ của Bảng giá (mã KPP nối mã MISA, sửa qua phiếu); mã chưa có trên Bảng giá thì lấy giá bán ở Giá vốn SKU (D().skus[].giaBan).
   - Ảnh: ảnh tải lên (D().skus[].img, thu nhỏ) > ảnh Pancake của mã bán Facebook / CSKH nối mã này > ảnh Pancake cùng mã. */
async function spcfGocLoad(force){
  if(typeof spcLoad==="function"&&!SPCB.at&&!SPCB.busy)spcLoad().then(()=>{if(/^sp_/.test(PAGE))renderMain()});
  if(spcfB2bOk(ME)&&!SPCF.b2b&&!SPCF.b2bBusy)spcfB2bLoad();spcfPkNeed();
  if(SPCF.gocBusy)return;if(SPCF.goc&&!force)return;SPCF.gocBusy=true;try{SPCF.goc=await spcApi("/products")}catch(e){SPCF.goc={err:e.message}}SPCF.gocBusy=false;if(/^sp_/.test(PAGE))renderMain()}
const spcfSkus=()=>{try{return D().skus||[]}catch(e){return []}};
const spcfSku=code=>spcfSkus().find(s=>spcLow(s.ma)===spcLow(code));
const spcfSeeGv=()=>typeof spcSeeCost==="function"&&spcSeeCost();
const spcfGv=code=>spcfSeeGv()?spcGvMap(spcfSkus(),SPCB.cost||[],spcKy())[spcLow(code)]||null:null;
const spcfChanCat=k=>{try{const s=D()[k];return s&&Array.isArray(s.sp)?s.sp:(k==="fbCat"?SPC_DEF_CAT:[])}catch(e){return []}};
const spcfOnCh=(k,code)=>spcfChanCat(k).flatMap(p=>(p.bt||[]).filter(v=>spcLow(spcMisa(v))===spcLow(code)).map(v=>({p,v})));
const spcfKpp=code=>((SPCF.b2b&&SPCF.b2b.products)||[]).filter(p=>spcLow(p.misa_code)===spcLow(code));
function spcfLe(code){const K=spcfKpp(code),le=K.find(p=>!/thùng/i.test(p.unit||""))||K[0];if(le&&le.prices&&le.prices.BAN_LE!=null)return {v:+le.prices.BAN_LE,kpp:le.sku};const s=spcfSku(code);return s&&+s.giaBan>0?{v:+s.giaBan}:null}
function spcfGocImg(code){const s=spcfSku(code);if(s&&s.img)return s.img;for(const k of ["fbCat","cskhCat"])for(const x of spcfOnCh(k,code)){const r=spcfPkRow(x.v.pkId,x.v.ma);if(r&&r.img)return r.img}const r=spcfPkRow(null,code);return (r&&r.img)||""}
/* Mã sàn (TikTok / Shopee) đang quy đổi ra mã MISA này, theo bảng quy đổi kế toán */
const spcfSanOf=(CH,code)=>{const m=new Map();((typeof SPCB!=="undefined"&&SPCB.rows)||[]).forEach(r=>{if(r.channel===CH&&spcLow(r.code||spcCode(r.item_label))===spcLow(code)&&!r.off_from)m.set(r.sku+"|"+r.variant,{sku:r.sku,variant:r.variant||""})});return [...m.values()]};
const spcfChEd=bp=>{if(typeof SPC==="undefined")return false;const o=SPC.bpView;SPC.bpView=bp;const r=spcCanEdit();SPC.bpView=o;return r};
function spcfChMut(k,msg,fn){DB.mutate(ME.name,msg,d=>{const cs=k==="cskhCat";if(!d[k])d[k]={};const c=d[k];if(!Array.isArray(c.sp))c.sp=cs?[]:spcClone(SPC_DEF_CAT);if(!Array.isArray(c.combos))c.combos=cs?[]:spcClone(SPC_DEF_COMBOS);fn(c)});renderMain()}
function spcfSkuSet(code,name,msg,fn){DB.mutate(ME.name,msg,d=>{d.skus=d.skus||[];let s=d.skus.find(x=>spcLow(x.ma)===spcLow(code));if(!s){s={ma:code,ten:name,k:typeof guessSku==="function"?guessSku(name)||"KHAC":"KHAC",qc:"",giaVon:{},giaBan:0,active:true};d.skus.push(s)}fn(s)});renderMain()}
/* Thêm một mã bán vào danh sách kênh Facebook / CSKH từ sản phẩm gốc (mã Pancake mặc định = mã MISA) */
const spcfNewChanSp=(it,ma,gia)=>({id:"p"+Date.now()+Math.floor(Math.random()*1e3),ten:it.name,loai:"run",bt:[{id:"v"+Date.now(),ma,dt:"",pl:"",on:true,misa:it.code,...(gia>0?{gia}:{})}]});
function pSpcfGoc(m){
  if(!spcfChs(ME).length){spcfNoAccess(m,"Sản phẩm");return}
  const sub="Mỗi sản phẩm một hồ sơ: bấm vào tên để xem giá vốn, giá lẻ và giá bán từng kênh";
  if(!SPCF.goc){spcfGocLoad();spcfFrame(m,"Sản phẩm",sub,{noCh:1,inner:`<p class="hint pad">Đang tải…</p>`});return}
  if(SPCF.goc.err){spcfFrame(m,"Sản phẩm",sub,{noCh:1,inner:`<div class="note red" style="margin:14px">${esc(SPCF.goc.err)}</div>`});return}
  spcfGocLoad();
  const G=SPCF.goc,ed=!!G.can_edit,see=spcfSeeGv(),q=spcfFold(SPCF.q).trim(),maps=new Map();(G.kho_map||[]).forEach(x=>{const k=spcLow(x.misa_code);if(!maps.has(k))maps.set(k,[]);maps.get(k).push(x.crm_sku)});
  const chOn=new Map(),mark=(code,k)=>{const c=spcLow(code);if(!chOn.has(c))chOn.set(c,new Set());chOn.get(c).add(k)};
  [["fbCat","FB"],["cskhCat","CSKH"]].forEach(([k,n])=>spcfChanCat(k).forEach(p=>{if(p.loai==="off")return;(p.bt||[]).forEach(v=>{if(v.on!==false&&spcMisa(v))mark(spcMisa(v),n)})}));
  ((typeof SPCB!=="undefined"&&SPCB.rows)||[]).forEach(r=>{if(!r.off_from&&(r.channel==="TIKTOK"||r.channel==="SHOPEE"))mark(r.code||spcCode(r.item_label),r.channel==="TIKTOK"?"TikTok":"Shopee")});
  maps.forEach((v,k)=>mark(k,"KPP"));
  const L=(G.items||[]).filter(it=>(SPCF.gocOff||it.active!==0)&&(!q||spcfFold(it.code+" "+it.name+" "+(maps.get(spcLow(it.code))||[]).join(" ")).includes(q)));
  const nOff=(G.items||[]).filter(it=>it.active===0).length;
  const rows=L.map(it=>{const off=it.active===0,gv=see?spcfGv(it.code):null,le=spcfLe(it.code),on=[...(chOn.get(spcLow(it.code))||[])];
    return `<tr${off?' style="opacity:.55"':""}><td class="cd">${spcfImg(spcfGocImg(it.code))}</td><td class="cd"><span class="spf-tag">${esc(it.code)}</span></td><td><a href="#" class="nm" data-goccard="${esc(it.code)}">${esc(it.name)}</a></td><td class="cd">${esc(it.unit||"")}</td>
      ${see?`<td class="n">${gv?nf(Math.round(gv.u)):'<span class="hint">chưa có</span>'}</td>`:""}<td class="n">${le?`<b>${nf(le.v)}</b>`:'<span class="hint">chưa có</span>'}</td>
      <td>${on.length?on.map(x=>`<span class="spf-tag" style="color:var(--ink);background:var(--gray-soft);border-color:var(--line)">${x}</span>`).join(" "):'<span class="hint">chưa bán</span>'}</td><td class="cd">${off?pill("Ngừng dùng","gry"):pill("Đang dùng","grn")}</td>
      <td class="cd">${spcfActs([["Giá các kênh",`data-goccard="${esc(it.code)}"`]].concat(ed?[["Sửa tên, ĐVT",`data-gocsua="${esc(it.code)}"`],[off?"Dùng lại":"Ngừng dùng",`data-gocoff="${esc(it.code)}" data-v="${off?1:0}"`]]:[]))}</td></tr>`}).join("");
  spcfFrame(m,"Sản phẩm",sub,{noCh:1,q:"Tìm mã MISA, tên, mã bán…",count:nf(L.length)+" sản phẩm",
    tools:`${nOff?`<label class="inl" style="white-space:nowrap"><input type="checkbox" id="goc-off" ${SPCF.gocOff?"checked":""} style="width:auto"> Hiện cả ${nOff} mã ngừng dùng</label>`:""}${ed?`<button class="btn pri" data-gocsua="">+ Thêm sản phẩm</button>`:""}`,
    inner:tbl(["Ảnh","Mã MISA","Tên sản phẩm","ĐVT"].concat(see?["Giá vốn"]:[],["Giá lẻ","Đang bán ở","Trạng thái",""]),[rows]).replace("<table","<table class=\"spf-gt\"")+`<p class="hint pad" style="margin:0">Bấm vào tên sản phẩm để xem và đặt giá bán từng kênh (Facebook, CSKH, TikTok, Shopee, Kênh phân phối). Combo các kênh chọn món từ danh sách này.</p>`});
  const off=$("#goc-off");if(off)off.onchange=()=>{SPCF.gocOff=off.checked;renderMain()};
  m.querySelectorAll("[data-gocsua]").forEach(b=>b.onclick=()=>spcfGocForm(b.dataset.gocsua||null));
  m.querySelectorAll("[data-goccard]").forEach(b=>b.onclick=e=>{e.preventDefault();spcfGocCard(b.dataset.goccard)});
  m.querySelectorAll("[data-gocoff]").forEach(b=>b.onclick=async()=>{const on=b.dataset.v==="1",code=b.dataset.gocoff;if(!on&&!confirm("Ngừng dùng "+code+"? Mã vẫn giữ trong lịch sử, chỉ ẩn khỏi danh sách."))return;
    try{await spcApi("/products/"+encodeURIComponent(code),{method:"PATCH",body:JSON.stringify({active:on})});toast(on?"Đã dùng lại "+code:"Đã ngừng dùng "+code);spcfGocLoad(true)}catch(e){toast(e.message)}});
}
/* Hồ sơ một sản phẩm: ảnh, giá vốn, giá lẻ niêm yết, giá bán từng kênh. Đặt giá Facebook / CSKH ngay tại đây; sàn và Kênh phân phối chỉ xem (sửa trên sàn / qua phiếu Bảng giá). */
function spcfGocCard(code){
  const it=((SPCF.goc&&SPCF.goc.items)||[]).find(x=>x.code===code);if(!it)return;
  const ed=!!(SPCF.goc&&SPCF.goc.can_edit),see=spcfSeeGv(),gv=see?spcfGv(code):null,le=spcfLe(code),img=spcfGocImg(code),sku=spcfSku(code);
  const chRow=(k,bp,n)=>{const L=spcfOnCh(k,code),can=spcfChEd(bp);
    const body=L.length?L.map(({p,v})=>{const pk=typeof spbPkPrice==="function"?spbPkPrice(v):null,off=v.on===false||p.loai==="off";
      return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:3px 0"><span class="spf-tag">${esc(v.ma)}</span>${(v.dt||v.pl)?`<small class="hint">${esc([v.dt,v.pl].filter(Boolean).join(" · "))}</small>`:""}${off?pill("Ngừng bán","gry"):""}<span class="sp" style="flex:1"></span>
        ${can?`<input class="goc-cg" data-k="${k}" data-pid="${esc(p.id)}" data-vid="${esc(v.id||v.ma)}" inputmode="numeric" value="${+v.gia>0?nf(v.gia):""}" placeholder="${pk!=null?nf(pk)+" (Pancake)":"giá"}" style="width:130px;text-align:right">`:`<b>${+v.gia>0?nf(v.gia):pk!=null?nf(pk):"—"}</b>`}</div>`}).join("")
      :can?`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="hint" style="flex:1">Chưa bán trên ${n}</span><input class="goc-nma mono" data-k="${k}" value="${esc(code)}" placeholder="mã Pancake" style="width:150px"><input class="goc-ngia" data-k="${k}" inputmode="numeric" value="${le?nf(le.v):""}" placeholder="giá bán" style="width:110px;text-align:right"><button class="btn sm" data-gocadd="${k}">+ Bán trên ${n}</button></div>`
      :`<span class="hint">Chưa bán trên ${n}</span>`;
    return `<tr><td style="width:120px"><b>${n}</b></td><td>${body}</td></tr>`};
  const sanRow=(CH,n)=>{const L=spcfSanOf(CH,code),can=spcfSanEd(CH);
    const body=L.length?L.map(x=>{const r=spcfSanFind(CH,x.sku,x.variant);return `<div style="display:flex;gap:8px;align-items:center;margin:3px 0"><span class="spf-tag">${esc(x.sku)}</span><small class="hint">${esc(x.variant)}</small><span style="flex:1"></span>
      ${can?`<input class="goc-sg" data-ch="${CH}" data-sku="${esc(x.sku)}" data-var="${esc(x.variant)}" inputmode="numeric" value="${r&&r.gia?nf(r.gia):""}" placeholder="giá" style="width:120px;text-align:right">`:r&&r.gia?`<b>${nf(r.gia)}</b>`:'<span class="hint">chưa có giá</span>'}</div>`}).join("")
      :`<span class="hint">Chưa có mã ${n} nào quy đổi ra mã này${typeof SPCB!=="undefined"&&!SPCB.at?" (đang tải)":""}</span>`;
    return `<tr><td><b>${n}</b></td><td>${body}</td></tr>`};
  const K=spcfKpp(code),kppRow=`<tr><td><b>Kênh phân phối</b></td><td>${K.length?K.map(p=>`<div style="display:flex;gap:8px;align-items:center;margin:3px 0"><span class="spf-tag">${esc(p.sku)}</span><small class="hint">${esc(p.unit||"")}</small><span style="flex:1"></span><small class="hint">${Object.keys(p.prices||{}).length} cấp giá</small></div>`).join("")+`<small class="hint">Giá từng cấp xem và sửa ở mục <a href="#" data-gocgia="1">Bảng giá</a> (sửa giá cần phiếu chị duyệt).</small>`
    :spcfB2bOk(ME)?`<span class="hint">${SPCF.b2b?"Chưa có mã KPP":"Đang tải…"}</span>`:`<span class="hint">—</span>`}</td></tr>`;
  const R=spcfModal("Sản phẩm · "+esc(it.name),
    `<div data-gocc="1"></div>`+spcfSec("Thông tin",spcfBox(`<div style="display:flex;gap:14px;align-items:center;padding:12px 16px">${img?`<img src="${esc(img)}" alt="" style="width:84px;height:84px;border-radius:10px;object-fit:cover;border:1px solid var(--line)">`:`<span class="spf-img" style="width:84px;height:84px"></span>`}
      <div style="flex:1"><span class="spf-tag">${esc(it.code)}</span><div style="font-weight:700;margin:4px 0">${esc(it.name)}</div><small class="hint">${esc(it.unit||"")} · ${it.cls==="HH"?"Hàng hóa":"Thành phẩm"}</small></div>
      ${ed?`<div style="display:flex;flex-direction:column;gap:6px"><label class="btn sm" style="cursor:pointer">Tải ảnh lên<input type="file" accept="image/*" id="goc-img" hidden></label>${sku&&sku.img?`<button class="btn sm" id="goc-imgx">Bỏ ảnh tải lên</button>`:""}</div>`:""}</div>`))+
    spcfSec("Giá",spcfBox((see?spcfRow("Giá vốn",ed?`<input id="goc-gv" data-c="${esc(code)}" data-n="${esc(it.name)}" inputmode="numeric" value="${gv?nf(Math.round(gv.u)):""}" placeholder="chưa có" style="width:150px;text-align:right"><small class="hint">${gv?esc(gv.src):""}</small>`:`<b>${gv?nf(Math.round(gv.u)):"chưa có"}</b>`):"")+
      spcfRow("Giá lẻ niêm yết",le&&le.kpp?`<b>${nf(le.v)}</b><small class="hint">theo Bảng giá (mã ${esc(le.kpp)}), sửa qua phiếu</small>`:ed?`<input id="goc-le" inputmode="numeric" value="${le?nf(le.v):""}" placeholder="chưa có" style="width:150px;text-align:right">`:`<b>${le?nf(le.v):"chưa có"}</b>`)),see?"Giá vốn chỉ CEO, kế toán thấy.":"")+
    spcfSec("Giá bán từng kênh",`<div class="spf-box" style="padding:0">${tbl(["Kênh","Mã bán và giá"],[chRow("fbCat","ADS","Facebook")+chRow("cskhCat","CSKH","CSKH")+sanRow("TIKTOK","TikTok")+sanRow("SHOPEE","Shopee")+kppRow])}</div>`,"Đặt giá ngay tại đây. Facebook, CSKH để trống = theo giá Pancake. Giá TikTok, Shopee là giá đang để trên sàn (tải file ở Combo › TikTok / Shopee › Mã bán trên kênh)."),
    "");
  const reopen=()=>setTimeout(()=>spcfGocCard(code),50);
  const gvI=R.querySelector("#goc-gv");if(gvI&&typeof spcGvInput==="function")spcGvInput(gvI,reopen);
  const leI=R.querySelector("#goc-le");if(leI)leI.onchange=()=>{const v=spcfNum(leI.value);spcfSkuSet(code,it.name,"giá lẻ niêm yết "+code,s=>{s.giaBan=v});toast("Đã lưu giá lẻ "+code);reopen()};
  R.querySelectorAll(".goc-cg").forEach(x=>{x.onkeydown=e=>{if(e.key==="Enter")x.blur()};x.onchange=()=>{const v=spcfNum(x.value),k=x.dataset.k;
    spcfChMut(k,"giá "+(k==="cskhCat"?"CSKH":"Facebook")+" "+code,c=>{const p=c.sp.find(y=>y.id===x.dataset.pid);const b=p&&(p.bt||[]).find(y=>(y.id||y.ma)===x.dataset.vid);if(!b)return;if(v>0)b.gia=v;else delete b.gia});toast(v>0?"Đã lưu giá "+nf(v):"Đã bỏ giá riêng, theo giá Pancake");reopen()}});
  R.querySelectorAll("[data-gocadd]").forEach(b=>b.onclick=()=>{const k=b.dataset.gocadd,ma=(R.querySelector(`.goc-nma[data-k="${k}"]`).value||"").trim(),gia=spcfNum(R.querySelector(`.goc-ngia[data-k="${k}"]`).value);if(!ma){toast("Nhập mã Pancake");return}
    if(spcfChanCat(k).some(p=>(p.bt||[]).some(v=>spcLow(v.ma)===spcLow(ma)))){toast("Mã "+ma+" đã có trong danh sách kênh này, sửa mã kho ở mục Combo › Mã bán trên kênh");return}
    spcfChMut(k,"bán "+code+" trên "+(k==="cskhCat"?"CSKH":"Facebook"),c=>{c.sp.push(spcfNewChanSp(it,ma,gia))});toast("Đã thêm "+ma);reopen()});
  const fi=R.querySelector("#goc-img");if(fi)fi.onchange=async()=>{const f=fi.files&&fi.files[0];if(!f)return;try{const u=await spcfThumb(f);spcfSkuSet(code,it.name,"ảnh "+code,s=>{s.img=u});toast("Đã lưu ảnh");reopen()}catch(e){toast("Không đọc được ảnh")}};
  const ix=R.querySelector("#goc-imgx");if(ix)ix.onclick=()=>{spcfSkuSet(code,it.name,"bỏ ảnh "+code,s=>{delete s.img});reopen()};
  R.querySelectorAll(".goc-sg").forEach(x=>{x.onkeydown=e=>{if(e.key==="Enter")x.blur()};x.onchange=()=>{spcfSanSet(x.dataset.ch,x.dataset.sku,x.dataset.var,spcfNum(x.value));reopen()}});
  const gl=R.querySelector("[data-gocgia]");if(gl)gl.onclick=e=>{e.preventDefault();closeCM();ntPage("sp_gia")};
}
/* Ảnh tải lên thu nhỏ còn cạnh dài 240px (JPEG) để lưu chung, không nặng web */
function spcfThumb(f){return new Promise((ok,no)=>{const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{const s=Math.min(1,240/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);
  const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);ok(c.toDataURL("image/jpeg",.78))};im.onerror=no;im.src=u})}
function spcfGocForm(code,o){o=o||{};const it=code?((SPCF.goc&&SPCF.goc.items)||[]).find(x=>x.code===code):null;
  const R=spcfModal(it?"Sửa sản phẩm":"Thêm sản phẩm",spcfSec("Thông tin",spcfBox(
    spcfRow("Mã MISA (mã kho) *",it?`<b class="mono">${esc(it.code)}</b>`:`<input id="goc-code" placeholder="đúng mã trên MISA">`)+spcfRow("Tên sản phẩm *",`<input id="goc-name" value="${esc(it?it.name:o.ten||"")}">`)+spcfRow("Đơn vị tính",`<input id="goc-unit" value="${esc(it?it.unit||"":"Chai")}">`)+
    (it?"":spcfRow("Loại",`<select id="goc-cls">${opt([["TP","Thành phẩm"],["HH","Hàng hóa"]],"TP")}</select>`)+spcfRow("Giá lẻ niêm yết",`<input id="goc-le0" inputmode="numeric" placeholder="đ" style="text-align:right">`)+spcfRow("Tạo luôn mã bán Kênh phân phối cùng mã",`<input type="checkbox" class="spf-sw" id="goc-kpp">`))),it?"":"Lưu xong sản phẩm có trong danh sách để các kênh chọn bán, làm combo."),
    `<button class="btn pri" id="goc-ok">Lưu</button>`);
  R.querySelector("#goc-ok").onclick=async()=>{const g=s=>{const e=R.querySelector(s);return e?(e.type==="checkbox"?e.checked:e.value.trim()):""};const name=g("#goc-name");if(!name){toast("Nhập tên sản phẩm");return}
    try{let c=it&&it.code;if(it)await spcApi("/products/"+encodeURIComponent(it.code),{method:"PATCH",body:JSON.stringify({name,unit:g("#goc-unit")})});
      else{c=g("#goc-code");if(!c){toast("Nhập mã MISA");return}await spcApi("/products",{method:"POST",body:JSON.stringify({code:c,name,unit:g("#goc-unit"),cls:g("#goc-cls"),kpp:g("#goc-kpp")===true})});
        const le0=spcfNum(g("#goc-le0"));if(le0)spcfSkuSet(c,name,"giá lẻ niêm yết "+c,s=>{s.giaBan=le0})}
      closeCM();toast("Đã lưu");await spcfGocLoad(true);if(o.after)o.after(c)}catch(e){toast(e.message)}}}
/* Nút "⋯" của cột thao tác: các nút thật ẩn đi, bấm "⋯" ra menu, bấm mục nào là bấm nút đó */
const spcfActs=L=>L.length?`<span class="spf-acts" style="white-space:nowrap">${L.map(([t,a])=>`<button class="btn sm" ${a} style="display:none">${t}</button>`).join("")}<button type="button" class="btn sm rmb spf-dots" title="Thao tác" aria-label="Thao tác">⋯</button></span>`:"";
function spcfDotsBind(m){m.querySelectorAll(".spf-dots").forEach(b=>b.onclick=e=>{e.stopPropagation();const had=document.querySelector(".rmpop"),mine=had&&had._src===b;if(had)had.remove();if(mine)return;
  const sec=[...b.parentNode.querySelectorAll("button:not(.spf-dots)")],r=b.getBoundingClientRect(),pop=document.createElement("div");pop.className="rmpop";pop._src=b;
  pop.style.top=Math.min(r.bottom+4,innerHeight-(sec.length*38+16))+"px";pop.style.right=Math.max(8,innerWidth-r.right)+"px";
  sec.forEach(x=>{const it=document.createElement("button");it.type="button";const t=x.textContent.trim();it.textContent=t;if(/^(xóa|xoá)/i.test(t))it.className="dg";it.onclick=ev=>{ev.stopPropagation();pop.remove();x.click()};pop.appendChild(it)});
  document.body.appendChild(pop);setTimeout(()=>document.addEventListener("click",()=>pop.remove(),{once:true}),0)})}

/* ============================== MÃ BÁN TỪNG KÊNH (trang Combo, thẻ "Mã bán trên kênh") ============================== */
function spcfChanSp(m){
  const ch=spcfCh();if(!ch){spcfNoAccess(m,"Combo");return}
  const sub="Mã bán từng kênh · giá bán của kênh · không hiện giá vốn";
  if(ch==="tt"||ch==="sp"){spcfSanSp(m,ch==="tt"?"TIKTOK":"SHOPEE",sub);return}
  spcfPkNeed();
  const ed=spcfCatEd(),cat=spcCat(),q=spcfFold(SPCF.q).trim();
  const L=cat.filter(p=>!q||spcfFold(p.ten+" "+(p.bt||[]).map(v=>v.ma).join(" ")).includes(q));
  const LO={run:["Sản phẩm","grn"],gift:["Quà tặng","amb"],off:["Không bán","gry"]};
  const pkp=v=>{const x=spbPkPrice(v);return x!=null?nf(x):"—"};
  const rows=L.map(p=>{const bt=p.bt||[],on=bt.some(v=>v.on!==false)&&p.loai!=="off",v0=bt[0]||{},open=!!SPCF.open[p.id],lo=LO[p.loai]||LO.run;
    return `<tr${on?"":' style="opacity:.55"'}><td>${bt.length>1?`<button class="btn sm" data-spcfop="${esc(p.id)}" style="min-width:28px;padding:0 6px">${open?"−":"+"}</button>`:""}</td><td>${on?pill("Đang bán","grn"):pill("Ngừng bán","gry")}</td>
     <td>${spcfVImg(v0)}</td><td><span class="spf-tag">${esc(v0.ma||"")}</span></td><td><b>${esc(p.ten)}</b></td><td>${pill(lo[0],lo[1])}</td><td class="n">${bt.length}</td>
     <td class="n">${bt.length===1?spcGiaTxt(v0):`<small class="hint">${bt.length} mẫu</small>`}</td><td class="n">${bt.length===1?pkp(v0):"—"}</td>
     <td>${ed?spcfActs([["Sửa",`data-spcfpe="${esc(p.id)}"`],[on?"Ngừng bán":"Bán lại",`data-spcfonb="${esc(p.id)}" data-v="${on?0:1}"`],["Xóa",`data-spcfpdel="${esc(p.id)}"`]]):""}</td></tr>`+
     (open?bt.map(v=>`<tr style="background:var(--gray-soft)"><td></td><td>${v.on!==false?"✓":""}</td><td>${spcfVImg(v)}</td><td><span class="spf-tag">${esc(v.ma)}</span></td><td><small>${esc([v.dt,v.pl].filter(Boolean).join(" · ")||"mặc định")}</small></td><td></td><td></td><td class="n">${spcGiaTxt(v)}</td><td class="n">${pkp(v)}</td><td></td></tr>`).join(""):"")}).join("");
  spcfFrame(m,"Combo",sub,{q:"Tìm mã, tên sản phẩm…",count:nf(L.length)+" mã bán",
    tools:`<button class="btn" data-spcfpk="1" ${SPCB.pkBusy?"disabled":""} title="Đọc lại giá, ảnh trên Pancake${ed?" và mở danh sách để thêm sản phẩm":""}">${SPCB.pkBusy?"Đang đọc Pancake…":"⟳ Đồng bộ Pancake"}</button>${ed?`<button class="btn pri" data-spcfpe="">+ Thêm mã bán</button>`:""}`,
    inner:tbl(["","Trạng thái","Ảnh","Mã bán","Tên sản phẩm","Loại","Số mẫu mã","Giá bán kênh","Giá Pancake",""],[rows])+`<p class="hint pad" style="margin:0">Giá bán kênh: giá riêng của kênh nếu đã đặt, chưa đặt thì theo giá Pancake. Bấm ⋯ để sửa, ngừng bán hoặc xóa.</p>`,
    after:SPCF.pkOpen&&ed?(SPCB.pk?spbPkEditView(SPC.bpView):SPCB.pkErr?`<div class="note red">Chưa đọc được Pancake: ${esc(SPCB.pkErr)}</div>`:`<p class="hint pad">Đang đọc Pancake…</p>`):""});
}
/* TikTok / Shopee: bảng giá đang để trên sàn (chị Hoa 16/11). Tải file xuất từ sàn (danh sách sản phẩm / cập nhật hàng loạt, có cột giá)
   hoặc sửa giá từng dòng trên web. Lưu chung d.sanGia[CH] = {at, by, file, rows:[{pid, sku, variant, name, gia}]}.
   Nối với sản phẩm gốc qua bảng quy đổi kế toán (channel_map: mã sàn = mã sản phẩm hoặc mã người bán, + phân loại). */
const spcfSanEd=CH=>spcfAll(ME)||(CH==="TIKTOK"&&ME.phongBan==="CM");
const spcfSanG=CH=>{try{return (D().sanGia||{})[CH]||{rows:[]}}catch(e){return {rows:[]}}};
const spcfLo=v=>String(v==null?"":v).trim().toLowerCase();
function spcfSanFind(CH,sku,variant){const R=spcfSanG(CH).rows||[],k=spcfLo(sku),v=spcfLo(variant),hit=r=>spcfLo(r.pid)===k||spcfLo(r.sku)===k;return R.find(r=>hit(r)&&spcfLo(r.variant)===v)||(v?null:R.find(hit))||R.find(r=>hit(r)&&!r.variant)||null}
function spcfSanSet(CH,sku,variant,gia){DB.mutate(ME.name,"giá "+(CH==="TIKTOK"?"TikTok":"Shopee")+" "+sku,d=>{d.sanGia=d.sanGia||{};const G=d.sanGia[CH]=d.sanGia[CH]||{rows:[]},k=spcfLo(sku),v=spcfLo(variant);
  let r=G.rows.find(x=>(spcfLo(x.pid)===k||spcfLo(x.sku)===k)&&spcfLo(x.variant)===v);if(!r){r={pid:"",sku,variant:variant||"",name:""};G.rows.push(r)}r.gia=gia||0;r.sua={by:ME.name||"",at:new Date().toISOString()}});toast(gia?"Đã lưu giá "+nf(gia):"Đã xóa giá");renderMain()}
/* Đọc file giá sàn: tìm dòng tiêu đề có cột giá, rồi các cột mã sản phẩm, mã người bán, tên, phân loại */
function spcfSanParse(rows){const H=(rows||[]).slice(0,12);let best=-1,bi=-1,C=null;
  H.forEach((r,i)=>{const h=(r||[]).map(x=>spcfFold(String(x||"")).trim()),f=re=>h.findIndex(x=>re.test(x));
    const c={gia:h.findIndex(x=>/^(gia|price|retail price)/.test(x)&&!/(von|nhap|goc|si)\b/.test(x)),pid:f(/(^id san pham|^ma san pham|product[_ ]?id|^id$)/),sku:f(/(sku nguoi ban|seller[_ ]?sku|sku phan loai|^sku$|^ma sku|sku)/),variant:f(/(ten phan loai|phan loai hang|variation|variant|bien the)/),name:f(/(ten san pham|product[_ ]?name)/)};
    if(c.variant===c.sku)c.variant=-1;const n=Object.values(c).filter(x=>x>=0).length;if(c.gia>=0&&n>best){best=n;bi=i;C=c}});
  if(!C||(C.pid<0&&C.sku<0))return {err:"Không thấy cột giá và cột mã sản phẩm / mã SKU trong file"};
  const num=v=>{const t=String(v==null?"":v).trim().replace(/[.,]00$/,"");return +t.replace(/[^0-9]/g,"")||0},g=(r,i)=>i>=0?String(r[i]==null?"":r[i]).trim():"";
  const out=[];rows.slice(bi+1).forEach(r=>{if(!r)return;const gia=num(r[C.gia]),pid=g(r,C.pid),sku=g(r,C.sku);if(!gia||(!pid&&!sku)||!/\d/.test(pid+sku+gia))return;out.push({pid,sku,variant:g(r,C.variant),name:g(r,C.name),gia})});
  return out.length?{rows:out}:{err:"File không có dòng nào có giá"}}
function spcfSanSp(m,CH,sub){const G=spcfSanG(CH),can=spcfSanEd(CH),nm=CH==="TIKTOK"?"TikTok":"Shopee",q=spcfFold(SPCF.q).trim();
  const misa=r=>{const M=((typeof SPCB!=="undefined"&&SPCB.rows)||[]).filter(x=>x.channel===CH&&(spcfLo(x.sku)===spcfLo(r.pid)||spcfLo(x.sku)===spcfLo(r.sku))&&(!x.variant||spcfLo(x.variant)===spcfLo(r.variant))&&!x.off_from);return [...new Set(M.map(x=>x.code||spcCode(x.item_label)))]};
  const R=(G.rows||[]).map((r,i)=>({...r,i})).filter(r=>!q||spcfFold([r.pid,r.sku,r.name,r.variant].join(" ")).includes(q));
  spcfFrame(m,"Combo",sub,{q:"Tìm mã, tên, phân loại…",count:nf(R.length)+" mẫu"+(G.at?" · tải lúc "+spcfVN(G.at.slice(0,10))+(G.by?" ("+esc(G.by)+")":""):""),
    tools:can?`<label class="btn pri" style="cursor:pointer">⇪ Tải file giá ${nm}<input type="file" id="san-f" accept=".xlsx,.xls,.csv" hidden></label>`:"",
    inner:R.length?tbl(["Mã sản phẩm","Mã người bán","Sản phẩm trên sàn","Phân loại","Mã MISA","Giá trên sàn"],R.slice(0,600).map(r=>{const k=misa(r);return `<tr><td class="mono hint" style="white-space:nowrap">${esc(r.pid||"")}</td><td style="white-space:nowrap">${r.sku?`<span class="spf-tag">${esc(r.sku)}</span>`:""}</td><td><small>${esc(r.name||"")}</small></td><td>${esc(r.variant||"")}</td><td style="white-space:nowrap">${k.length?k.map(x=>`<span class="spf-tag">${esc(x)}</span>`).join(" "):'<span class="hint">chưa quy đổi</span>'}</td>
      <td class="n">${can?`<input class="san-g" data-i="${r.i}" inputmode="numeric" value="${r.gia?nf(r.gia):""}" style="width:110px;text-align:right">`:`<b>${r.gia?nf(r.gia):"—"}</b>`}</td></tr>`})).replace("<table","<table class=\"spf-gt\"")+`<p class="hint pad" style="margin:0">Giá đang để trên ${nm}. Đổi giá trên sàn xong thì sửa ô giá ở đây hoặc tải lại file cho khớp. Mã MISA theo bảng quy đổi của kế toán.</p>`
      :`<div class="note" style="margin:14px">Chưa có bảng giá ${nm}. ${can?`Vào ${nm} xuất file danh sách sản phẩm (có cột mã sản phẩm hoặc SKU người bán, phân loại, giá) rồi bấm <b>⇪ Tải file giá ${nm}</b>.`:"Nhờ kế toán tải file giá lên."}</div>`});
  const f=m.querySelector("#san-f");if(f)f.onchange=async()=>{const x=f.files&&f.files[0];if(!x)return;let rows;try{rows=await readXlsx(x)}catch(e){return}const P=spcfSanParse(rows);if(P.err){toast(P.err);return}
    if(!confirm("Đọc được "+P.rows.length+" mẫu có giá trong file "+x.name+". Thay bảng giá "+nm+" đang có bằng file này?"))return;
    DB.mutate(ME.name,"tải file giá "+nm+" ("+P.rows.length+" mẫu)",d=>{d.sanGia=d.sanGia||{};d.sanGia[CH]={at:new Date().toISOString(),by:ME.name||"",file:x.name,rows:P.rows}});toast("Đã tải "+P.rows.length+" mẫu giá "+nm);renderMain()};
  m.querySelectorAll(".san-g").forEach(x=>{x.onkeydown=e=>{if(e.key==="Enter")x.blur()};x.onchange=()=>{const v=spcfNum(x.value),i=+x.dataset.i;DB.mutate(ME.name,"sửa giá "+nm,d=>{const r=d.sanGia&&d.sanGia[CH]&&d.sanGia[CH].rows[i];if(r){r.gia=v;r.sua={by:ME.name||"",at:new Date().toISOString()}}});toast("Đã lưu giá "+nf(v));renderMain()}});
  if(typeof SPCB!=="undefined"&&!SPCB.at&&!SPCB.busy&&typeof spcLoad==="function")spcLoad().then(()=>{if(/^sp_/.test(PAGE))renderMain()});
}
/* Tạo / sửa sản phẩm (giống Poscake: thông tin, các mẫu mã kèm giá bán kênh) */
function spcfProdForm(id){
  const p=id?spcCat().find(x=>x.id===id):null,bt=p?(p.bt||[]).map(v=>({...v})):[{id:"v"+Date.now(),ma:"",dt:"",pl:"",on:true}],misa=typeof spcCanMisa==="function"&&spcCanMisa();
  const st={ten:p?p.ten:"",loai:p?p.loai||"run":"run"};if(!p)spcfGocLoad();
  const draw=()=>{const R=spcfModal(`${p?"Sửa":"Tạo"} sản phẩm · ${esc(SPCF_BP[SPCF.ch])}`,
    (p?"":spcfSec("Lấy từ sản phẩm",`<div class="spf-box">${spcfPickBox("goc","Tìm sản phẩm có sẵn theo mã MISA, tên…")}</div>`,"Chọn sản phẩm có sẵn thì tự điền tên, mã kho, giá lẻ."))+
    spcfSec("Thông tin cơ bản",spcfBox(spcfRow("Tên sản phẩm *",`<input id="spf-ten" value="${esc(st.ten)}">`)+spcfRow("Loại hình sản phẩm",`<select id="spf-loai">${opt([["run","Sản phẩm"],["gift","Quà tặng"],["off","Không bán"]],st.loai)}</select>`)))+
    spcfSec("Mẫu mã",`<div class="spf-box" style="padding:0">${tbl(["Bán","Ảnh","Mã mẫu (mã Pancake)","Dung tích","Phân loại / hương","Giá bán kênh (đ)"].concat(misa?["Mã kho (MISA)"]:[],[""]),bt.map((v,i)=>`<tr data-spfv="${i}"><td><input type="checkbox" class="spf-sw spf-on" ${v.on!==false?"checked":""}></td><td>${spcfVImg(v)}</td><td><input class="spf-ma mono" value="${esc(v.ma)}" style="width:120px"></td><td><input class="spf-dt" value="${esc(v.dt||"")}" style="width:90px"></td><td><input class="spf-pl" value="${esc(v.pl||"")}" style="width:120px"></td>
      <td><input class="spf-gia n" inputmode="numeric" value="${v.gia?Math.round(v.gia):""}" placeholder="${spbPkPrice(v)!=null?nf(spbPkPrice(v)):"giá"}" style="width:110px"></td>${misa?`<td><input class="spf-misa mono" value="${esc(v.misa||"")}" style="width:130px"></td>`:""}<td>${bt.length>1?`<button class="btn sm" data-spfdel="${i}">✕</button>`:""}</td></tr>`))}<div style="padding:10px 14px"><button class="btn sm" id="spf-add">+ Thêm mẫu mã</button></div></div>`,"Mỗi mẫu mã một mã Pancake. Giá bán kênh để trống thì theo giá Pancake."),
    `${p?`<button class="btn" id="spf-rm" style="margin-right:auto;order:-1">Xóa sản phẩm</button>`:""}<button class="btn pri" id="spf-save">Lưu</button>`);
    const read=()=>{st.ten=R.querySelector("#spf-ten").value.trim();st.loai=R.querySelector("#spf-loai").value;R.querySelectorAll("[data-spfv]").forEach(r=>{const v=bt[+r.dataset.spfv],g=s=>r.querySelector(s);v.on=g(".spf-on").checked;v.ma=g(".spf-ma").value.trim();v.dt=g(".spf-dt").value.trim();v.pl=g(".spf-pl").value.trim();const n=spcfNum(g(".spf-gia").value);if(n)v.gia=n;else delete v.gia;if(g(".spf-misa"))v.misa=g(".spf-misa").value.trim()})};
    if(!p)spcfPicker(R,"goc",((SPCF.goc&&SPCF.goc.items)||[]).filter(x=>x.active!==0).map(x=>{const le=spcfLe(x.code);return {ma:x.code,ten:x.name,gia:le?le.v:0,img:spcfGocImg(x.code)}}),code=>{read();const x=SPCF.goc.items.find(y=>y.code===code),le=spcfLe(code),v=bt[0];st.ten=x.name;v.misa=code;if(!v.ma)v.ma=code;if(!v.gia&&le)v.gia=le.v;draw()});
    R.querySelector("#spf-add").onclick=()=>{read();bt.push({id:"v"+Date.now(),ma:"",dt:"",pl:"",on:true});draw()};
    R.querySelectorAll("[data-spfdel]").forEach(b=>b.onclick=()=>{read();bt.splice(+b.dataset.spfdel,1);draw()});
    R.querySelector("#spf-save").onclick=()=>{read();const ten=st.ten,loai=st.loai,V=bt.filter(v=>v.ma);if(!ten){toast("Nhập tên sản phẩm");return}if(!V.length){toast("Cần ít nhất một mã mẫu");return}
      spcEdit(p?"sửa sản phẩm "+ten:"tạo sản phẩm "+ten,c=>{if(p){const x=c.sp.find(y=>y.id===p.id);if(x)Object.assign(x,{ten,loai,bt:V})}else c.sp.push({id:"p"+Date.now(),ten,loai,bt:V})});closeCM()};
    const rm=R.querySelector("#spf-rm");if(rm)rm.onclick=()=>{const used=spcCombosAll().some(c=>(c.gom||[]).concat(c.tang||[]).some(x=>(p.bt||[]).some(v=>v.ma===x.ma)));if(used){toast("Sản phẩm đang nằm trong combo, sửa hoặc dừng combo trước");return}
      if(!confirm("Xóa "+p.ten+" khỏi danh sách "+SPCF_BP[SPCF.ch]+"?"))return;spcEdit("xóa sản phẩm "+p.ten,c=>{c.sp=c.sp.filter(y=>y.id!==p.id)});closeCM()}};
  draw();
}

/* ============================== COMBO ============================== */
function pSpcfCb(m){
  const ch=spcfCh();if(!ch){spcfNoAccess(m,"Combo");return}
  if(SPCF.sub==="sp"){spcfChanSp(m);return}
  const sub="Combo từng kênh · lưu xong chờ kế toán duyệt (nối mã kho) rồi mới chạy";
  if(ch==="b2b"){spcfFrame(m,"Combo",sub,{inner:`<div class="note" style="margin:14px">Kênh phân phối bán theo bảng giá 8 cấp, không dùng combo. Khuyến mãi cho NPP đặt ở mục <b>Khuyến mãi</b>.</div>`});return}
  if(ch==="tt"||ch==="sp"){spcfSanView(m,ch==="tt"?"TIKTOK":"SHOPEE",sub);return}
  spcfPkNeed();
  const ed=spcfCatEd(),q=spcfFold(SPCF.q).trim();
  const L=spcCombos().filter(c=>!q||spcfFold([c.nhom,c.combo,c.qua].join(" ")).includes(q)).slice().sort((a,b)=>String(b.tu||"").localeCompare(String(a.tu||"")));
  const live=c=>spcTT(c)==="ok"&&spcSt(c)[0]!=="Đã hết";
  const rows=L.map(c=>`<tr${live(c)||spcTT(c)!=="ok"?"":' style="opacity:.6"'}><td class="mono hint">${esc(String(c.id).replace(/^\D+/,"").slice(-7))}</td><td><b>${esc(c.nhom||"")}</b><br><small class="hint">${esc(spcDesc(c))}</small></td><td>${pill("Sản phẩm","blu")}</td>
     <td style="text-align:center">${(+c.ship||0)===0?'<span style="color:var(--green)">✓</span>':`<small class="hint">ship ${nf(c.ship)}</small>`}</td><td class="n"><b>${nf(c.gia||0)} đ</b></td><td class="hint" style="white-space:nowrap">${spcfVN(c.tu)}${c.den?"<br>→ "+spcfVN(c.den):""}</td><td>${spcTag(c)}</td>
     <td>${ed?spcfActs([["Sửa",`data-spcfce="${esc(c.id)}"`]].concat(live(c)&&!c.dx?[["Dừng chạy",`data-spc-act="sopen" data-spid="${esc(c.id)}"`]]:[],spcTT(c)!=="ok"?[["Xóa",`data-spcfcdel="${esc(c.id)}"`]]:[])):""}</td></tr>`).join("");
  spcfFrame(m,"Combo",sub,{q:"Tìm combo…",count:nf(L.length)+" combo",
    tools:`<button class="btn" data-spcfpkcb="1" ${SPCF.pkcbBusy?"disabled":""}>${SPCF.pkcbBusy?"Đang đọc…":SPCF.pkcb?"Ẩn combo Pancake":"Combo trên Pancake"}</button>${ed?`<button class="btn pri" data-spcfce="">+ Tạo combo</button>`:""}`,
    inner:tbl(["ID","Tên combo","Loại combo","Miễn phí vận chuyển","Giá trị","Thời gian áp dụng","Trạng thái",""],[rows]),
    after:spcfPkCbView(ed)+(typeof spcFlow==="function"?spcFlow(ed):"")});
  if(typeof spcMdDraw==="function")spcMdDraw();
}
/* Tạo / sửa combo kiểu Poscake: thông tin cơ bản, giảm giá / giá trị combo + freeship, phạm vi (sản phẩm + số lượng, có ảnh), quà kèm */
function spcfComboForm(id,pre,st0){
  spcfPkNeed();spcfGocLoad();
  /* Danh sách chọn món = mã bán của kênh + sản phẩm gốc chưa bán trên kênh (lưu combo thì tự thêm vào mã bán của kênh, mã Pancake = mã MISA, giá = giá lẻ niêm yết) */
  const c=id?spcCombos().find(x=>x.id===id):null,Vch=spcfVars(),vOf=ma=>V.find(v=>v.ma===ma);let V=Vch;
  const vGoc=()=>((SPCF.goc&&SPCF.goc.items)||[]).filter(it=>it.active!==0&&!Vch.some(v=>spcLow(v.misa)===spcLow(it.code)||spcLow(v.ma)===spcLow(it.code))).map(it=>{const le=spcfLe(it.code);return {ma:"goc:"+it.code,tag:it.code,goc:it,ten:it.name,gia:le?le.v:0,on:true,img:spcfGocImg(it.code),note:"chưa bán trên kênh này, lưu combo sẽ tự thêm"}});
  const st=st0||{ten:c?c.nhom||"":(pre&&pre.ten)||"",tu:c?c.tu||spcfToday():spcfToday(),den:c?c.den||"":"",land:c?(spcLands(c)[0]||""):"",kieu:"gt",gia:c?+c.gia||0:(pre&&pre.gia)||0,giam:0,giamPct:false,fs:c?(+c.ship||0)===0:(pre?!!pre.fs:true),ship:c?+c.ship||0:0,
    gom:c?(c.gom||[]).map(x=>({...x})):(pre&&pre.gom)||[],tang:c?(c.tang||[]).map(x=>({...x})):[],ghi:c?c.ghi||"":""};
  const goc=()=>st.gom.reduce((a,x)=>{const v=vOf(x.ma);return a+(v?v.gia:0)*(+x.sl||1)},0);
  const val=()=>st.kieu==="gt"?st.gia:Math.max(0,st.giamPct?Math.round(goc()*(1-st.giam/100)):goc()-st.giam);
  const its=k=>`<div class="spf-box">${spcfPickBox(k,k==="tang"?"Tìm quà tặng kèm…":"Tìm sản phẩm…")}<div class="spf-its"><div class="hd"><span>Ảnh</span><span>Sản phẩm</span><span>Số lượng</span><span style="text-align:right">Giá kênh</span><span></span></div>
    ${st[k].map((x,i)=>{const v=vOf(x.ma);return `<div class="spf-it">${spcfImg(v&&v.img)}<div>${v?`<span class="spf-tag">${esc(v.tag||x.ma)}</span>${esc(v.ten)}${v.goc?' <small class="hint">(mới trên kênh)</small>':""}`:`<span class="t-red">${esc(x.ma||x.ten||"")} (chưa có trong danh sách)</span>`}</div><input class="spcb-q" data-k="${k}" data-i="${i}" type="number" min="1" value="${+x.sl||1}"><span class="n gc">${k==="tang"?"quà":v?nf(v.gia):"—"}</span><button class="del" data-spcbdel="${k}:${i}" title="Bỏ">🗑</button></div>`}).join("")||`<div class="spf-empty">Trống</div>`}</div>
    ${k==="gom"?`<div class="spf-sum"><span>Tổng tiền gốc: <b>${nf(goc())} đ</b></span><span>Giá combo: <b style="color:var(--pink)">${nf(val())} đ</b></span></div>`:""}</div>`;
  const draw=()=>{V=Vch.concat(vGoc());const R=spcfModal(`${c?"Sửa":"Tạo"} combo · ${esc(SPCF_BP[SPCF.ch])}`,
    spcfSec("Thông tin cơ bản",spcfBox(spcfRow("Tên combo sản phẩm *",`<input id="spcb-ten" value="${esc(st.ten)}" placeholder="Ví dụ: [250g] 2 bột tẩy vạn năng 185K">`)+spcfRow("Thời gian áp dụng *",`<input type="date" id="spcb-tu" value="${esc(st.tu)}"><span class="hint">→</span><input type="date" id="spcb-den" value="${esc(st.den)}">`)+(SPCF.ch==="ads"?spcfRow("Landing / page",`<input id="spcb-land" value="${esc(st.land)}">`):"")))+
    spcfSec("Khuyến mãi",spcfBox(spcfRow("Loại giảm giá",`<label><input type="radio" name="spcb-k" value="gt" ${st.kieu==="gt"?"checked":""}> Giá trị combo</label><label><input type="radio" name="spcb-k" value="gg" ${st.kieu==="gg"?"checked":""}> Giảm giá</label>`)+
      (st.kieu==="gt"?spcfRow("Giá trị combo (đ) *",`<input id="spcb-gia" inputmode="numeric" value="${st.gia?nf(st.gia):""}" style="text-align:right">`):spcfRow("Giảm giá combo",`<select id="spcb-pct" style="flex:0 0 110px">${opt([["d","Tiền mặt"],["p","Phần trăm"]],st.giamPct?"p":"d")}</select><input id="spcb-giam" inputmode="numeric" value="${st.giam||""}" style="text-align:right">`))+
      spcfRow("Miễn phí vận chuyển",`${st.fs?"":`<input id="spcb-ship" inputmode="numeric" value="${st.ship||""}" placeholder="phí ship đ" style="text-align:right">`}<input type="checkbox" class="spf-sw" id="spcb-fs" ${st.fs?"checked":""}>`)))+
    spcfSec("Phạm vi áp dụng",its("gom"),"Sản phẩm trong combo và số lượng mỗi món.")+
    spcfSec("Quà tặng kèm",its("tang"),"Quà giá 0 đ, vẫn trừ kho.")+
    spcfSec("Ghi chú",spcfBox(spcfRow("Ghi chú cho kế toán",`<input id="spcb-ghi" value="${esc(st.ghi)}">`))),
    `<button class="btn pri" id="spcb-save">Lưu và gửi kế toán duyệt</button>`);
    const g=s=>R.querySelector(s),read=()=>{st.ten=g("#spcb-ten").value.trim();st.tu=g("#spcb-tu").value;st.den=g("#spcb-den").value;if(g("#spcb-land"))st.land=g("#spcb-land").value.trim();
      st.kieu=(R.querySelector("input[name=spcb-k]:checked")||{}).value||"gt";if(g("#spcb-gia"))st.gia=spcfNum(g("#spcb-gia").value);if(g("#spcb-giam")){st.giam=spcfNum(g("#spcb-giam").value);st.giamPct=g("#spcb-pct").value==="p"}
      st.fs=g("#spcb-fs").checked;if(g("#spcb-ship"))st.ship=spcfNum(g("#spcb-ship").value);st.ghi=g("#spcb-ghi").value.trim();R.querySelectorAll(".spcb-q").forEach(i=>{st[i.dataset.k][+i.dataset.i].sl=Math.max(1,+i.value||1)})};
    R.querySelectorAll("input[name=spcb-k],#spcb-fs,.spcb-q,#spcb-gia,#spcb-giam,#spcb-pct").forEach(i=>i.onchange=()=>{read();draw()});
    const addMa=(k,ma)=>{const L=st[k],f=L.find(x=>x.ma===ma);if(f)f.sl=(+f.sl||1)+1;else L.push({ma,sl:1})};
    ["gom","tang"].forEach(k=>spcfPicker(R,k,V.filter(v=>v.on),ma=>{read();addMa(k,ma);draw()},(SPCF.goc&&SPCF.goc.can_edit)?q=>{read();const ch=SPCF.ch;spcfGocForm(null,{ten:q,after:code=>{SPCF.ch=ch;spcfCh();addMa(k,"goc:"+code);spcfComboForm(id,pre,st)}})}:null));
    R.querySelectorAll("[data-spcbdel]").forEach(b=>b.onclick=()=>{read();const [k,i]=b.dataset.spcbdel.split(":");st[k].splice(+i,1);draw()});
    g("#spcb-save").onclick=()=>{read();if(!st.ten){toast("Nhập tên combo");return}if(!st.gom.length){toast("Chọn ít nhất một sản phẩm trong combo");return}if(!st.tu){toast("Chọn ngày áp dụng");return}if(st.den&&st.den<st.tu){toast("Đến ngày phải sau ngày bắt đầu");return}
      const gia=val();if(!(gia>0)){toast("Nhập giá trị combo hoặc mức giảm");return}
      const who={by:ME.name||"",byId:ME.id||"",at:new Date().toISOString()},cid=c?c.id:"n"+Date.now(),pid="ph"+Date.now();
      /* Món lấy từ sản phẩm gốc: dùng mã bán đã có của kênh (cùng mã kho), chưa có thì thêm mã bán mới */
      const neu=[],nm={},fix=x=>{if(!String(x.ma).startsWith("goc:"))return x;const v=vOf(x.ma),code=x.ma.slice(4),cat=spcCat();
        const had=cat.flatMap(p=>(p.bt||[]).map(b=>({p,b}))).find(o=>spcLow(spcMisa(o.b))===spcLow(code)||spcLow(o.b.ma)===spcLow(code));if(had)return {...x,ma:had.b.ma};
        if(!neu.some(n=>n.bt[0].ma===code)&&v&&v.goc)neu.push(spcfNewChanSp(v.goc,code,v.gia));nm[code]=v?v.ten:code;return {...x,ma:code}};
      const d0={nhom:st.ten,gom:st.gom.filter(x=>x.ma).map(fix),tang:st.tang.filter(x=>x.ma).map(fix),gia,ship:st.fs?0:st.ship,tu:st.tu,den:st.den,ghi:st.ghi,landings:st.land?[st.land]:[],landing:st.land||"",page:c?c.page||"":"",nguoi:c?c.nguoi||ME.name||"":ME.name||""};
      const txt=l=>l.map(x=>(x.sl||1)+" × "+(nm[x.ma]||spcCompName(x,1))).join(" + ");d0.combo=txt(d0.gom);d0.qua=txt(d0.tang);
      spcEdit((c?"sửa":"tạo")+" combo "+st.ten,cc=>{neu.forEach(n=>{if(!cc.sp.some(p=>(p.bt||[]).some(b=>b.ma===n.bt[0].ma)))cc.sp.push(n)});if(!Array.isArray(cc.phieu))cc.phieu=[];let x;
        if(c){x=cc.combos.find(y=>y.id===c.id);if(!x)return;Object.assign(x,d0,{tt:"cho",sua:who,phieu:pid});delete x.traLai}else{x=Object.assign({id:cid},d0,{tt:"cho",tao:who,phieu:pid},SPC.bpView==="CSKH"?{bp:"CSKH"}:{});cc.combos.unshift(x)}
        cc.phieu.unshift(Object.assign({id:pid,ten:(c?"Sửa combo ":"Combo mới ")+st.ten,ghi:"",by:who.by,byId:who.byId,at:who.at,tt:"cho",items:[{loai:"moi",id:x.id,ten:spcDesc(x),gia,ngay:st.tu}]},SPC.bpView==="CSKH"?{bp:"CSKH"}:{}))});
      closeCM();toast("Đã lưu, chờ kế toán duyệt combo "+st.ten)}};
  draw();
}
/* Combo đang có trên Pancake (chỉ đọc) + đưa một combo về web */
function spcfPkMa(it,V){const R=((SPCB.pk&&SPCB.pk.rows)||[]).filter(r=>it.pid&&r.pid===it.pid),ids=new Set(R.map(r=>r.id)),cs=new Set(R.map(r=>spcLow(r.code)).filter(c=>c&&!/^\d{1,3}$/.test(c)));
  const v=V.find(y=>y.pkId&&ids.has(y.pkId))||V.find(y=>cs.has(spcLow(y.ma)))||V.find(y=>spcLow(y.ma)===spcLow(it.code))||V.find(y=>it.name&&spcLow(y.ten).startsWith(spcLow(it.name)));return v?v.ma:""}
async function spcfPkCbLoad(){if(SPCF.pkcb){SPCF.pkcb=null;renderMain();return}SPCF.pkcbBusy=true;renderMain();if(!SPCB.pk&&typeof spbPkLoad==="function")try{await spbPkLoad()}catch(e){}try{SPCF.pkcb=await spcApi("/pancake-combos?channel=FACEBOOK");SPCF.pkcbErr=""}catch(e){SPCF.pkcbErr=e.message}SPCF.pkcbBusy=false;renderMain()}
function spcfPkCbView(ed){
  if(SPCF.pkcbErr)return `<div class="note red">Chưa đọc được combo Pancake: ${esc(SPCF.pkcbErr)}</div>`;
  const P=SPCF.pkcb;if(!P)return "";const V=spcfVars(),has=new Set(spcCombos().map(c=>spcLow(c.nhom)));
  return `<section class="card flush"><div class="spf-bar"><b>Combo trên Pancake</b><span class="hint">${nf(P.count)} combo · chỉ đọc</span></div>
   ${tbl(["Bật","Tên combo trên Pancake","Gồm","Miễn phí vận chuyển","Giá trị","Trên web",""],P.rows.map((x,i)=>{const miss=x.items.filter(it=>!spcfPkMa(it,V));
     return `<tr${x.on?"":' style="opacity:.6"'}><td><input type="checkbox" class="spf-sw" ${x.on?"checked":""} disabled></td><td><b>${esc(x.name)}</b></td><td><div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">${x.items.map(it=>`<span title="${esc(it.name)}" style="display:inline-flex;gap:4px;align-items:center">${spcfImg(it.img)}<small>× ${it.qty}</small></span>`).join("")}</div><small class="hint">${esc(x.items.map(it=>it.qty+" × "+(it.name||it.code)).join(" + "))}</small></td><td style="text-align:center">${x.free_ship?'<span style="color:var(--green)">✓</span>':""}</td><td class="n">${x.value!=null?nf(x.value)+" đ":"giảm "+esc(String(x.discount))}</td>
       <td>${has.has(spcLow(x.name))?pill("đã có","grn"):miss.length?`<small class="hint">thiếu SP: ${esc(miss.map(it=>it.name||it.code).join(", "))}</small>`:"—"}</td><td>${ed&&!has.has(spcLow(x.name))&&!miss.length&&x.value?`<button class="btn sm" data-spcfpkimp="${i}">Đưa về web</button>`:""}</td></tr>`}))}</section>`;
}
/* TikTok / Shopee: combo trên sàn (bảng quy đổi) + khai combo mới để kế toán quy đổi */
function spcfSanView(m,CH,sub){
  spcLoad();
  const P=spcfList("ttCombo").filter(x=>x.tt!=="xong"&&(x.ch||"TIKTOK")===CH).slice().reverse(),ed=spcfChs(ME).some(c=>c[0]===SPCF.ch);
  const nm=p=>p.qty+" × "+((SPCB.items&&SPCB.items.get(spcLow(p.code))||{}).name||p.label);
  const q=spcfFold(SPCF.q).trim();
  const L=SPCB.rows?spcGroup(SPCB.rows.filter(r=>r.channel===CH),SPCB.sales,spcToday()).filter(c=>c.active&&(!q||spcfFold(c.sku+" "+c.variant+" "+c.parts.map(p=>p.label).join(" ")).includes(q))).sort((a,b)=>b.orders-a.orders):null;
  spcfFrame(m,"Combo",sub,{q:"Tìm mã sàn, sản phẩm…",count:L?nf(L.length)+" combo đang dùng":"Đang tải…",tools:ed?`<button class="btn pri" data-spcftt="1">+ Khai combo mới</button>`:"",
    inner:(P.length?`<div class="note" style="margin:12px 14px"><b>${P.length} combo mới đã khai, chờ kế toán quy đổi:</b> ${P.map(x=>`<span class="spf-tag">${esc(x.sku)}</span>${esc(x.gom)}`).join(" · ")}</div>`:"")+
    (L?tbl(["Mã trên sàn","Gồm","Quà","Đơn"],L.slice(0,300).map(c=>`<tr><td><span class="spf-tag">${esc(c.sku)}</span>${c.variant?`<br><small class="hint">${esc(c.variant)}</small>`:""}</td><td><small>${esc(c.parts.filter(p=>p.kind==="sp").map(nm).join(" + "))}</small></td><td><small>${esc(c.parts.filter(p=>p.kind==="gift").map(nm).join(" + "))}</small></td><td class="n">${c.orders||""}</td></tr>`)):"")+
    `<p class="hint pad" style="margin:0">Lên combo mới trên ${CH==="TIKTOK"?"TikTok":"Shopee"} thì bấm <b>Khai combo mới</b>: mã trên sàn, gồm sản phẩm nào, quà gì. Kế toán khai vào bảng quy đổi (để trừ kho, tính giá vốn) rồi combo hiện trong danh sách này. Giá bán nằm trên sàn.</p>`});
}
function spcfTtForm(){const CH=SPCF.ch==="sp"?"SHOPEE":"TIKTOK";
  const R=spcfModal(`Khai combo mới · ${CH==="TIKTOK"?"TikTok":"Shopee"}`,
    spcfSec("Mã trên sàn",spcfBox(spcfRow("Mã trên sàn (SKU) *",`<input id="tt-sku">`)+spcfRow("Phân loại",`<input id="tt-vr" placeholder="nếu có">`)))+
    spcfSec("Gồm",spcfBox(spcfRow("Gồm sản phẩm *",`<input id="tt-gom" placeholder="ví dụ: 2 Tẩy lồng Ailla 300g + 1 Tẩy mốc gioăng">`)+spcfRow("Quà tặng",`<input id="tt-qua">`)+spcfRow("Ghi chú",`<input id="tt-ghi" placeholder="áp dụng từ ngày, chương trình…">`)),"Kế toán đọc phần này để khai quy đổi trừ kho."),
    `<button class="btn pri" id="tt-go">Gửi kế toán</button>`);
  R.querySelector("#tt-go").onclick=()=>{const g=s=>R.querySelector(s).value.trim(),sku=g("#tt-sku"),gom=g("#tt-gom");if(!sku||!gom){toast("Cần mã trên sàn và gồm sản phẩm nào");return}
    const x={id:"tt"+Date.now(),ch:CH,sku,variant:g("#tt-vr"),gom,qua:g("#tt-qua"),ghi:g("#tt-ghi"),by:ME.name||"",byId:ME.id||"",at:new Date().toISOString(),tt:"cho"};
    DB.mutate(ME.name,"khai combo "+sku,d=>{d.ttCombo=Array.isArray(d.ttCombo)?d.ttCombo:[];d.ttCombo.push(x)});closeCM();toast("Đã gửi kế toán khai combo "+sku);renderMain()}}
/* Kế toán khai xong (lưu combo ở Sản phẩm & combo) thì đánh dấu đề xuất là xong. */
function spcfTtDone(id){DB.mutate(ME.name,"đã khai combo sàn",d=>{const x=(d.ttCombo||[]).find(y=>y.id===id);if(x){x.tt="xong";x.xong={by:ME.name||"",at:new Date().toISOString()}}})}
/* Mở ô khai combo của kế toán, điền sẵn theo đề xuất (từ trang Phê duyệt). */
async function spcfTtOpen(id){const x=spcfList("ttCombo").find(y=>y.id===id);if(!x)return;SPCB.at=0;await spcLoad(true);
  spcbEdit(null,{channel:x.ch||"TIKTOK",sku:x.sku,variant:x.variant||"",shops:[],orders:0,ttId:x.id,name:"Team khai: "+[x.gom,x.qua?"tặng "+x.qua:"",x.ghi].filter(Boolean).join(" · "),ttNote:[x.gom,x.qua?"tặng "+x.qua:"",x.ghi].filter(Boolean).join(" · ")})}

/* ---------- Kênh phân phối: bảng giá ngang kiểu tờ niêm yết Ailla (chị Hoa duyệt 16/11) ----------
   STT · Sản phẩm · Quy cách (số chai / can một thùng) · Giá niêm yết (= Bán lẻ) · giá từng cấp · Mã KPP · Mã MISA (mã để cuối).
   Mã lẻ (đuôi -C) và mã thùng của cùng sản phẩm gộp một dòng: giá theo mã lẻ, quy cách theo mã thùng.
   Chọn "Tất cả cấp" hoặc một cấp. Sửa giá (trang quản trị, người có quyền giá): gõ vào ô, ô đổi vàng, Lưu kèm lý do
   qua /api/prices (CEO có hiệu lực ngay, Trưởng phòng thành đề nghị chờ CEO). Lịch sử: /api/products/:id/price-history. */
const spcfB2bRole=()=>{const P=(typeof SV!=="undefined"&&SV.perms)||[];return P.includes("price.approve")?"ok":P.includes("price.propose")?"de":""};
/* Sửa giá ở cả web vận hành và trang quản trị (chị Hoa duyệt 16/11), theo quyền giá của người dùng */
const spcfB2bPerm=()=>spcfB2bRole();
async function spcfB2bLoad(force){if(SPCF.b2bBusy)return;SPCF.b2bBusy=true;try{SPCF.b2b=await svApi("/api/prices?limit=1000&scope=TIER"+(force?"&_="+Date.now():""))}catch(e){SPCF.b2b={err:e.message}}SPCF.b2bBusy=false;if(/^sp_/.test(PAGE))renderMain()}
/* Gộp mã lẻ + mã thùng: khóa = mã bỏ đuôi -C */
function spcfB2bRows(P){const by=new Map();P.forEach(p=>{const k=String(p.sku).replace(/-c$/i,"").toUpperCase();if(!by.has(k))by.set(k,[]);by.get(k).push(p)});
  return [...by.values()].map(L=>{const th=L.find(p=>/thùng/i.test(p.unit||"")),le=L.find(p=>p!==th)||th;const q=(th&&(th.per_box||+String(th.pack_size||"").replace(/\D/g,"")))||le.per_box||"";
    return {le,th:th!==le?th:null,q,g:le.group_name||(th&&th.group_name)||"Chưa xếp nhóm",misa:le.misa_code||(th&&th.misa_code)||""}})}
function spcfB2bView(m,t,sub){
  if(!SPCF.b2b){spcfB2bLoad();spcfFrame(m,t,sub,{noCh:1,inner:`<p class="hint pad">Đang tải…</p>`});return}
  if(SPCF.b2b.err){spcfFrame(m,t,sub,{noCh:1,inner:`<div class="note red" style="margin:14px">${esc(SPCF.b2b.err)}</div>`});return}
  const T0=SPCF.b2b.tiers||[],LE=T0.find(x=>x.code==="BAN_LE"),T=T0.filter(x=>x.code!=="BAN_LE");
  const q=spcfFold(SPCF.q).trim(),perm=spcfB2bPerm(),ed=!!(SPCF.b2bEd&&perm),chg=SPCF.chg||(SPCF.chg={});
  if(SPCF.tier&&!T.some(x=>x.code===SPCF.tier))SPCF.tier="";
  const one=T.find(x=>x.code===SPCF.tier),cols=one?[one]:T,show=(LE?[LE]:[]).concat(cols);
  const R=spcfB2bRows(SPCF.b2b.products||[]).filter(r=>(!q||spcfFold([r.le.sku,r.th&&r.th.sku,r.le.name,r.g,r.misa].join(" ")).includes(q))&&(!SPCF.miss||show.some(x=>r.le.prices[x.code]==null)));
  const G=[];R.forEach(r=>{let x=G.find(y=>y.g===r.g);if(!x)G.push(x={g:r.g,L:[]});x.L.push(r)});
  const cell=(r,x,cls)=>{const p=r.le,k=p.id+"|"+x.id,base=p.prices[x.code],eff=p.eff_prices?p.eff_prices[x.code]:base,adj=(p.adjusted||[]).find(a=>a.tier===x.code),c=chg[k];
    if(ed)return `<td class="n${c!==undefined?" chg":""}"><input class="spf-xin" data-k="${k}" inputmode="numeric" value="${c!==undefined?(c==null?"":nf(c)):base!=null?nf(base):""}" placeholder="chưa có"></td>`;
    if(base==null)return `<td class="miss">chưa có</td>`;
    return `<td class="n ${cls}"${adj?` title="Giá gốc ${nf(base)} · ${esc(adj.label)}"`:""}>${nf(eff!=null?eff:base)}${adj&&eff!==base?`<i class="spf-adj" aria-hidden="true"></i>`:""}</td>`};
  const nc=4+cols.length+3;let i=0;
  const head=`<tr><th style="width:46px">STT</th><th class="l">Sản phẩm</th><th style="width:76px">Quy cách</th><th style="width:104px">Giá niêm yết</th>${cols.map(x=>`<th style="width:${one?128:96}px">${esc(one?"Giá "+x.name:x.name)}</th>`).join("")}<th style="width:120px">Mã KPP</th><th style="width:120px">Mã MISA</th><th style="width:34px"></th></tr>`;
  const body=G.map(g=>`<tr class="grp"><td colspan="${nc}">${esc(g.g)} <span>· ${g.L.length}</span></td></tr>`+g.L.map(r=>`<tr><td class="c">${++i}</td><td>${esc(r.le.name)}</td><td class="c">${esc(String(r.q||""))}</td>${LE?cell(r,LE,"ny"):"<td></td>"}${cols.map(x=>cell(r,x,one?"hl":"")).join("")}
    <td class="cd">${esc(r.le.sku)}${r.th?`<br><small>thùng ${esc(r.th.sku)}</small>`:""}</td><td class="cd">${r.misa?esc(r.misa):`<small class="hint">chưa nối</small>`}</td><td class="c"><button class="lnk" data-spcfph="${esc(r.le.id)}" title="Lịch sử giá">🕘</button></td></tr>`).join("")).join("");
  const nMiss=R.filter(r=>T0.some(x=>x.code!=="NHAN_VIEN"&&r.le.prices[x.code]==null)).length,nChg=Object.keys(chg).length;
  /* Sửa giá / thêm mã thành phiếu chờ chị duyệt (spbg.js); báo giá gửi khách theo cấp */
  const nNew=(SPCF.newP||[]).length;
  const tools=ed?`<button class="btn" data-spbgnew="1">+ Mã mới</button><button class="btn" data-spcfxx="1">Hủy</button><button class="btn pri" data-spcfxs="1">Lưu ${nChg+nNew?"("+(nChg?nChg+" ô":"")+(nChg&&nNew?", ":"")+(nNew?nNew+" mã mới":"")+")":""}</button>`
    :`<button class="btn" data-spbgbq="1">🖼 Báo giá gửi khách</button>${perm?`<button class="btn pri" data-spcfxe="1">✎ Sửa giá, thêm mã</button>`:""}`;
  spcfFrame(m,t,sub,{noCh:1,q:"Tìm tên, mã KPP, mã MISA…",count:nf(R.length)+" sản phẩm",tools,
    inner:`<div class="spf-tiers"><div class="settabs" style="margin:0">${[["","Tất cả cấp"]].concat(T.map(x=>[x.code,x.name])).map(([k,n])=>`<button class="${SPCF.tier===k?"on":""}" data-spcftier="${esc(k)}">${esc(n)}</button>`).join("")}</div>
      <label class="inl" style="margin-left:auto;white-space:nowrap"><input type="checkbox" id="spcf-miss" ${SPCF.miss?"checked":""} style="width:auto"> Chỉ mã thiếu giá${nMiss?" ("+nMiss+")":""}</label></div>
      ${ed?`<div class="note" style="margin:0 14px 10px">Gõ giá vào ô (giá mỗi chai / can), ô đã đổi tô vàng. Xóa trắng ô = bỏ giá cấp đó. Thêm sản phẩm bấm <b>+ Mã mới</b>. Sửa xong bấm <b>Lưu</b>: web lập phiếu điều chỉnh giá, giá chỉ đổi khi chị duyệt phiếu. Bấm <b>Hủy</b> là bỏ hết chỗ vừa sửa.</div>${typeof spbgNewView==="function"?spbgNewView():""}`:""}
      <div class="spf-nb"><table><thead>${head}</thead><tbody>${body||`<tr><td colspan="${nc}" class="spf-empty">Không có sản phẩm</td></tr>`}</tbody></table></div>
      <p class="hint pad" style="margin:0">Giá niêm yết = giá bán lẻ. Giá theo mỗi chai / can; quy cách = số chai / can một thùng. Giá hiệu lực ngày ${esc(spcfVN(SPCF.b2b.date||spcfToday()))}; ô có chấm hồng là giá đang có chương trình điều chỉnh (rê chuột để xem giá gốc). Bấm 🕘 xem lịch sử giá.</p>`,after:typeof spbgListView==="function"?spbgListView():""});
  m.querySelectorAll(".spf-xin").forEach(inp=>{inp.onkeydown=e=>{if(e.key==="Enter"){const all=[...m.querySelectorAll(".spf-xin")],n=all[all.indexOf(inp)+show.length];if(n)n.focus()}};
    inp.onfocus=()=>inp.select();inp.onchange=()=>{const k=inp.dataset.k,[pid,tid]=k.split("|"),p=SPCF.b2b.products.find(x=>x.id===pid),x=T0.find(y=>y.id===tid),old=p.prices[x.code],v=inp.value.trim()===""?null:spcfNum(inp.value);
      if(v===old)delete chg[k];else chg[k]=v;inp.value=v==null?"":nf(v);inp.parentNode.classList.toggle("chg",k in chg);const b=m.querySelector("[data-spcfxs]"),n=Object.keys(chg).length;if(b){const nn=(SPCF.newP||[]).length;b.textContent="Lưu"+(n+nn?" ("+(n?n+" ô":"")+(n&&nn?", ":"")+(nn?nn+" mã mới":"")+")":"")}}});
}
async function spcfB2bHist(pid){const p=(SPCF.b2b.products||[]).find(x=>x.id===pid);if(!p)return;
  let R=[];try{R=await svApi("/api/products/"+encodeURIComponent(pid)+"/price-history")}catch(e){toast(e.message);return}
  const ST={ACTIVE:["đang dùng","grn"],DRAFT:["chờ duyệt","amb"],ARCHIVED:["đã thay","gry"],REJECTED:["bị từ chối","red"]};
  spcfModal(`Lịch sử giá · ${esc(p.name)}`,spcfSec("Các lần đặt giá",`<div class="spf-box" style="padding:0">${tbl(["Cấp","Giá","Từ ngày","Đến ngày","Trạng thái","Người đặt","Lúc"],(R||[]).map(r=>{const s=ST[r.status]||[r.status,"gry"];return `<tr><td>${esc(r.tier_name)}</td><td class="n"><b>${r.amount!=null?nf(r.amount):"bỏ giá"}</b></td><td>${esc(spcfVN(r.valid_from))}</td><td class="hint">${esc(spcfVN(r.valid_to||""))}</td><td>${pill(s[0],s[1])}</td><td>${esc(r.created_by_name||"")}</td><td class="hint">${esc(String(r.created_at||"").slice(0,16).replace("T"," "))}</td></tr>`}))}</div>`,"Theo từng cấp, mới nhất ở trên. Đơn cũ giữ giá lúc chốt."),"")}

/* ============================== KHUYẾN MÃI ============================== */
/* 6 loại như Poscake. cfg theo loại:
   sl {ma, tiers:[{tu,den,pct}]} · gt {tiers:[{tu,pct|amt}]} · dg {mas:[], gia} · ch {min, pct|amt} · vc {code, pct|amt, fs, lan} · dk {ma, kem:[], pct|amt} */
const SPCF_KMT=[["sl","Giảm giá theo số lượng sản phẩm","Sản phẩm A giá 100.000đ|Mua 1–2 sản phẩm giảm 10% (10.000đ)|Mua 3–4 sản phẩm giảm 20% (20.000đ)","🛒","#f59f00"],
  ["gt","Khuyến mãi theo giá trị đơn hàng","Đơn hàng từ 500.000đ giảm 10%|Đơn hàng từ 1.000.000đ giảm 20%","🧾","#2f9e44"],
  ["dg","Đồng giá","Các mã hàng A, B, C đồng giá 99.000đ","💲","#12b886"],
  ["ch","Khuyến mãi chung","Đơn hàng 500.000đ giảm 100.000đ|Hoặc đơn hàng từ 500.000đ giảm 10%","🎁","#e03131"],
  ["vc","Mã khuyến mãi (voucher)","Khách nhập mã KHACHCU để giảm 10% và miễn phí vận chuyển","🎟","#f76707"],
  ["dk","Sản phẩm đính kèm","Mua sản phẩm A kèm B hoặc C thì A được giảm giá","📎","#7048e8"]];
const SPCF_KT={cho:["Chờ kế toán duyệt","amb"],ok:["Đã duyệt","grn"],tralai:["Bị trả lại","red"]};
const spcfKmName=t=>(SPCF_KMT.find(x=>x[0]===t)||["","Khuyến mãi"])[1];
const spcfKmIco=t=>{const x=SPCF_KMT.find(y=>y[0]===t)||SPCF_KMT[3];return `<span class="spf-ico" style="background:${x[4]}">${x[3]}</span>`};
const spcfKmSt=k=>{const t=spcfToday();return k.tt==="ok"?(k.den&&k.den<t?["Đã hết","gry"]:k.tu&&k.tu>t?["Sắp chạy","blu"]:["Đang chạy","grn"]):SPCF_KT[k.tt]||["?","gry"]};
function pSpcfKm(m){
  const ch=spcfCh();if(!ch){spcfNoAccess(m,"Khuyến mãi");return}
  const dy=spcfCanDuyet(),all=spcfAll(ME),T=SPCF.kmT,q=spcfFold(SPCF.q).trim();
  const L0=spcfList("kmCat").filter(k=>k.bp===ch),L=L0.filter(k=>(T==="all"||(k.t||"ch")===T)&&(!q||spcfFold(k.ten+" "+(k.ap||"")).includes(q))).slice().sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
  const canAdd=spcfMyBp(ME).includes(ch);
  const tabs=`<div class="settabs" style="margin:10px 14px 4px">${[["all","Tất cả"]].concat(SPCF_KMT.map(x=>[x[0],x[1]])).map(([k,t])=>`<button class="${T===k?"on":""}" data-spcfkt="${k}">${t} · ${L0.filter(x=>k==="all"||(x.t||"ch")===k).length}</button>`).join("")}</div>`;
  const rows=L.map(k=>{const s=spcfKmSt(k);return `<tr><td>${spcfKmIco(k.t||"ch")}</td><td><b>${esc(k.ten)}</b>${k.ghi?`<br><small class="hint">${esc(k.ghi)}</small>`:""}</td><td><small>${esc(spcfKmName(k.t||"ch"))}</small></td><td><small>${esc(k.ap||"")}</small></td>
    <td class="hint" style="white-space:nowrap">${spcfVN(k.tu)}${k.den?"<br>→ "+spcfVN(k.den):""}</td><td>${pill(s[0],s[1])}${k.tt==="tralai"&&k.ly?`<br><small class="t-red">${esc(k.ly)}</small>`:""}</td><td class="hint">${esc(k.by||"")}</td>
    <td style="white-space:nowrap">${dy&&k.tt==="cho"?`<button class="btn sm pri" data-spcfkmok="${esc(k.id)}">Duyệt</button> <button class="btn sm" data-spcfkmno="${esc(k.id)}">Trả lại</button>`:""}${k.byId===ME.id&&k.tt!=="ok"?` <button class="btn sm" data-spcfkmdel="${esc(k.id)}">Xóa</button>`:""}</td></tr>`}).join("");
  spcfFrame(m,"Khuyến mãi","Khuyến mãi từng kênh · kế toán duyệt rồi mới áp dụng · khi tạo đơn web tự tính mức giảm",
    {q:"Tìm khuyến mãi…",count:nf(L.length)+" khuyến mãi",tools:canAdd?`<button class="btn pri" data-spcfkmnew="1">+ Tạo khuyến mãi</button>`:"",
     inner:tabs+tbl(["","Khuyến mãi","Loại","Áp dụng","Thời gian hiệu lực","Trạng thái","Người tạo",""],[rows])+(all||dy?"":`<p class="hint pad" style="margin:0">Bạn chỉ thấy khuyến mãi của kênh mình.</p>`)});
}
function spcfKmPick(){const R=spcfModal(`Khuyến mãi mới · ${esc(SPCF_BP[SPCF.ch])}`,`<div class="spf-kmg">${SPCF_KMT.map(x=>`<div class="spf-kmc"><div class="h">${spcfKmIco(x[0])}${x[1]}</div>${x[2].split("|").map(l=>`<p>${esc(l)}</p>`).join("")}<button class="btn pri sm" data-spcfkmt="${x[0]}">Tạo mới</button></div>`).join("")}</div>`,"");
  R.querySelectorAll("[data-spcfkmt]").forEach(b=>b.onclick=()=>spcfKmForm(b.dataset.spcfkmt))}
function spcfKmForm(t){
  const V=SPCF.ch==="ads"||SPCF.ch==="cskh"?spcfVars().filter(v=>v.on):[],vOf=ma=>V.find(v=>v.ma===ma);
  const st={ten:"",tu:spcfToday(),den:"",ghi:"",sel:{ma:[],mas:[],kem:[]},amt:"",u:"p",gia:"",min:"",code:"",fs:false,lan:0,
    tiers:t==="sl"?[{tu:1,den:2,pct:10},{tu:3,den:"",pct:20}]:t==="gt"?[{tu:500000,pct:10},{tu:1000000,pct:20}]:[]};
  const single={ma:true};
  /* chọn sản phẩm: có danh mục kênh thì tìm và chọn (chip), không có thì gõ mã */
  const pick=(k,ph)=>V.length?`<div class="spf-chips">${st.sel[k].map(ma=>{const v=vOf(ma);return `<span class="spf-chip">${v&&v.img?`<img src="${esc(v.img)}" style="width:18px;height:18px;border-radius:4px">`:""}<span class="spf-tag" style="margin:0">${esc(ma)}</span>${esc(v?v.ten:"")}<button data-kmrm="${k}:${esc(ma)}">✕</button></span>`}).join("")}</div>${spcfPickBox(k,ph)}`
    :spcfRow(ph,`<input class="km-txt" data-k="${k}" value="${esc(st.sel[k].join(", "))}" placeholder="mã sản phẩm${single[k]?"":", cách nhau dấu phẩy"}">`);
  const amt=()=>`<select id="km-u" style="flex:0 0 110px">${opt([["p","Phần trăm"],["d","Tiền mặt"]],st.u)}</select><input id="km-amt" inputmode="numeric" value="${esc(st.amt)}" style="text-align:right">`;
  const tiers=()=>`<div class="spf-box" style="padding:0">${tbl(t==="sl"?["Mua từ","Đến","Giảm (%)"]:["Đơn hàng từ (đ)","Giảm (%)"],st.tiers.map((x,i)=>t==="sl"?`<tr><td><input class="km-a" data-i="${i}" type="number" min="1" value="${x.tu}" style="width:80px"></td><td><input class="km-b" data-i="${i}" type="number" min="1" value="${x.den}" placeholder="trở lên" style="width:90px"></td><td><input class="km-p" data-i="${i}" type="number" min="0" max="100" value="${x.pct}" style="width:80px"></td></tr>`
      :`<tr><td><input class="km-a" data-i="${i}" inputmode="numeric" value="${x.tu}" style="width:140px"></td><td><input class="km-p" data-i="${i}" type="number" min="0" max="100" value="${x.pct}" style="width:80px"></td></tr>`))}<div style="padding:8px 14px"><button class="btn sm" id="km-tadd">+ Thêm mức</button></div></div>`;
  const draw=()=>{
    const cond=t==="sl"?spcfSec("Sản phẩm áp dụng",`<div class="spf-box">${pick("ma","Tìm sản phẩm…")}</div>`)+spcfSec("Mức giảm",tiers())
      :t==="gt"?spcfSec("Mức giảm",tiers(),"Đơn đạt mức nào thì giảm theo mức cao nhất đạt được.")
      :t==="dg"?spcfSec("Sản phẩm đồng giá",`<div class="spf-box">${pick("mas","Tìm và thêm sản phẩm…")}</div>`)+spcfSec("Giá",spcfBox(spcfRow("Giá đồng giá (đ) *",`<input id="km-gia" inputmode="numeric" value="${esc(st.gia)}" style="text-align:right">`)))
      :t==="vc"?spcfSec("Mã khuyến mãi",spcfBox(spcfRow("Mã voucher *",`<input id="km-code" value="${esc(st.code)}" style="text-transform:uppercase">`)+spcfRow("Giảm",amt())+spcfRow("Miễn phí vận chuyển",`<input type="checkbox" class="spf-sw" id="km-fs" ${st.fs?"checked":""}>`)+spcfRow("Số lần dùng tối đa (0 = không giới hạn)",`<input id="km-lan" type="number" min="0" value="${st.lan}" style="text-align:right">`)))
      :t==="dk"?spcfSec("Sản phẩm chính (A)",`<div class="spf-box">${pick("ma","Tìm sản phẩm chính…")}</div>`)+spcfSec("Đi kèm (B, C…)",`<div class="spf-box">${pick("kem","Tìm sản phẩm đi kèm…")}</div>`,"Đơn có A và một trong các sản phẩm này thì A được giảm.")+spcfSec("A được giảm",spcfBox(spcfRow("Giảm",amt())))
      :spcfSec("Điều kiện",spcfBox(spcfRow("Đơn hàng từ (đ)",`<input id="km-min" inputmode="numeric" value="${esc(st.min)}" style="text-align:right">`)+spcfRow("Giảm",amt())));
    const R=spcfModal(`${esc(spcfKmName(t))} · ${esc(SPCF_BP[SPCF.ch])}`,
      spcfSec("Thông tin cơ bản",spcfBox(spcfRow("Tên khuyến mãi *",`<input id="km-ten" value="${esc(st.ten)}" placeholder="Ví dụ: Sale 11/11">`)+spcfRow("Thời gian hiệu lực *",`<input type="date" id="km-tu" value="${esc(st.tu)}"><span class="hint">→</span><input type="date" id="km-den" value="${esc(st.den)}">`)))+
      cond+spcfSec("Ghi chú",spcfBox(spcfRow("Ghi chú cho kế toán",`<input id="km-ghi" value="${esc(st.ghi)}">`))),
      `<button class="btn" id="km-back" style="margin-right:auto;order:-1">← Chọn loại khác</button><button class="btn pri" id="km-save">Lưu và gửi kế toán duyệt</button>`);
    const g=s=>R.querySelector(s),gv=s=>(g(s)||{}).value;
    const rd=()=>{st.ten=gv("#km-ten").trim();st.tu=gv("#km-tu");st.den=gv("#km-den");st.ghi=gv("#km-ghi").trim();
      if(g("#km-amt")){st.amt=gv("#km-amt");st.u=gv("#km-u")}if(g("#km-gia"))st.gia=gv("#km-gia");if(g("#km-min"))st.min=gv("#km-min");if(g("#km-code"))st.code=gv("#km-code").trim().toUpperCase();if(g("#km-fs"))st.fs=g("#km-fs").checked;if(g("#km-lan"))st.lan=+gv("#km-lan")||0;
      R.querySelectorAll(".km-txt").forEach(i=>{st.sel[i.dataset.k]=i.value.split(",").map(x=>x.trim()).filter(Boolean)});
      R.querySelectorAll(".km-a").forEach(i=>{st.tiers[+i.dataset.i].tu=t==="gt"?spcfNum(i.value):+i.value||1});R.querySelectorAll(".km-b").forEach(i=>{st.tiers[+i.dataset.i].den=i.value===""?"":+i.value});R.querySelectorAll(".km-p").forEach(i=>{st.tiers[+i.dataset.i].pct=+i.value||0})};
    ["ma","mas","kem"].forEach(k=>spcfPicker(R,k,V,ma=>{rd();if(single[k])st.sel[k]=[ma];else if(!st.sel[k].includes(ma))st.sel[k].push(ma);draw()}));
    R.querySelectorAll("[data-kmrm]").forEach(b=>b.onclick=()=>{rd();const [k,ma]=b.dataset.kmrm.split(":");st.sel[k]=st.sel[k].filter(x=>x!==ma);draw()});
    if(g("#km-tadd"))g("#km-tadd").onclick=()=>{rd();st.tiers.push(t==="sl"?{tu:1,den:"",pct:0}:{tu:0,pct:0});draw()};
    g("#km-back").onclick=()=>spcfKmPick();
    g("#km-save").onclick=()=>{rd();const {ten,tu,den}=st;if(!ten){toast("Nhập tên khuyến mãi");return}if(!tu){toast("Chọn ngày bắt đầu");return}if(den&&den<tu){toast("Đến ngày phải sau ngày bắt đầu");return}
      const am=()=>{const n=spcfNum(st.amt);return st.u==="d"?{amt:n}:{pct:n}},off=c=>c.amt?nf(c.amt)+"đ":c.pct+"%";let cfg={},ap="";
      if(t==="sl"){cfg={ma:st.sel.ma[0]||"",tiers:st.tiers};if(!cfg.ma){toast("Chọn sản phẩm");return}ap=cfg.ma+": "+st.tiers.map(x=>`mua ${x.tu}${x.den?"–"+x.den:"+"} giảm ${x.pct}%`).join(", ")}
      else if(t==="gt"){cfg={tiers:st.tiers.filter(x=>x.tu>0)};if(!cfg.tiers.length){toast("Nhập mức đơn hàng");return}ap=cfg.tiers.map(x=>`đơn từ ${nf(x.tu)}đ giảm ${x.pct}%`).join(", ")}
      else if(t==="dg"){cfg={mas:st.sel.mas,gia:spcfNum(st.gia)};if(!cfg.mas.length||!cfg.gia){toast("Chọn sản phẩm và giá đồng giá");return}ap=cfg.mas.join(", ")+" đồng giá "+nf(cfg.gia)+"đ"}
      else if(t==="vc"){cfg=Object.assign({code:st.code,fs:st.fs,lan:st.lan},am());if(!cfg.code){toast("Nhập mã voucher");return}ap="mã "+cfg.code+" giảm "+off(cfg)+(cfg.fs?", miễn phí vận chuyển":"")}
      else if(t==="dk"){cfg=Object.assign({ma:st.sel.ma[0]||"",kem:st.sel.kem},am());if(!cfg.ma||!cfg.kem.length){toast("Chọn sản phẩm chính và sản phẩm đi kèm");return}ap=cfg.ma+" kèm "+cfg.kem.join("/")+" giảm "+off(cfg)}
      else{cfg=Object.assign({min:spcfNum(st.min)},am());ap="đơn từ "+nf(cfg.min)+"đ giảm "+off(cfg)}
      const k={id:"km"+Date.now(),bp:SPCF.ch,t,ten,tu,den,cfg,ap,gia:t==="dg"?cfg.gia:0,ghi:st.ghi,by:ME.name||"",byId:ME.id||"",at:new Date().toISOString(),tt:"cho"};
      DB.mutate(ME.name,"thêm khuyến mãi "+ten,d=>{d.kmCat=Array.isArray(d.kmCat)?d.kmCat:[];d.kmCat.push(k)});closeCM();toast("Đã gửi kế toán duyệt khuyến mãi");renderMain()}};
  draw();
}
function spcfKmDuyet(id,ok,ly){if(!spcfCanDuyet())return;DB.mutate(ME.name,(ok?"duyệt":"trả lại")+" khuyến mãi",d=>{const k=(d.kmCat||[]).find(x=>x.id===id);if(!k||k.tt!=="cho")return;k.tt=ok?"ok":"tralai";k.duyet={by:ME.name||"",at:new Date().toISOString()};if(ly)k.ly=ly;
  try{if(typeof notifyU==="function")notifyU(d,[k.byId],ok?`Kế toán đã duyệt khuyến mãi “${k.ten}”`:`Khuyến mãi “${k.ten}” bị trả lại: ${ly||""}`,"page:sp_km")}catch(e){}});toast(ok?"Đã duyệt khuyến mãi":"Đã trả lại");renderMain()}

function spcfBind(m){
  const q=$("#spcf-q");if(q)q.oninput=()=>{SPCF.q=q.value;const p=q.selectionStart;renderMain();const x=$("#spcf-q");if(x){x.focus();x.setSelectionRange(p,p)}};
  const on=(sel,f)=>m.querySelectorAll(sel).forEach(b=>b.onclick=()=>f(b));
  on("[data-spcfop]",b=>{SPCF.open[b.dataset.spcfop]=!SPCF.open[b.dataset.spcfop];renderMain()});
  m.querySelectorAll("[data-spcfon]").forEach(x=>x.onchange=()=>{const id=x.dataset.spcfon,v=x.checked;spcEdit((v?"bật":"tắt")+" bán sản phẩm",c=>{const p=c.sp.find(y=>y.id===id);if(p){(p.bt||[]).forEach(b=>b.on=v);if(v&&p.loai==="off")p.loai="run"}})});
  on("[data-spcfpe]",b=>spcfProdForm(b.dataset.spcfpe||null));
  on("[data-spcfonb]",b=>{const id=b.dataset.spcfonb,v=b.dataset.v==="1";spcEdit((v?"bán lại":"ngừng bán")+" sản phẩm",c=>{const p=c.sp.find(y=>y.id===id);if(p){(p.bt||[]).forEach(x=>x.on=v);if(v&&p.loai==="off")p.loai="run"}})});
  on("[data-spcfpdel]",b=>{const p=spcCat().find(x=>x.id===b.dataset.spcfpdel);if(!p)return;const used=spcCombosAll().some(c=>(c.gom||[]).concat(c.tang||[]).some(x=>(p.bt||[]).some(v=>v.ma===x.ma)));if(used){toast("Mã này đang nằm trong combo, sửa hoặc dừng combo trước");return}
    if(!confirm("Xóa "+p.ten+" khỏi danh sách "+SPCF_BP[SPCF.ch]+"?"))return;spcEdit("xóa sản phẩm "+p.ten,c=>{c.sp=c.sp.filter(y=>y.id!==p.id)})});
  on("[data-spcfcdel]",b=>{const c0=spcCombos().find(x=>x.id===b.dataset.spcfcdel);if(!c0||spcTT(c0)==="ok")return;if(!confirm("Xóa combo "+(c0.nhom||"")+"? Combo chưa duyệt nên chưa chạy."))return;
    spcEdit("xóa combo "+(c0.nhom||""),cc=>{cc.combos=(cc.combos||[]).filter(y=>y.id!==c0.id);(cc.phieu||[]).forEach(ph=>{if(ph.tt==="cho")ph.items=(ph.items||[]).filter(it=>it.id!==c0.id)});cc.phieu=(cc.phieu||[]).filter(ph=>ph.tt!=="cho"||(ph.items||[]).length)})});
  /* Một nút Đồng bộ Pancake: đọc lại giá, ảnh; người sửa được thì mở luôn danh sách Pancake để thêm / bỏ sản phẩm */
  on("[data-spcfpk]",()=>{if(spcfCatEd())SPCF.pkOpen=true;spbPkLoad()});
  on("[data-spbpk]",()=>spbPkLoad());
  on("[data-spcfce]",b=>spcfComboForm(b.dataset.spcfce||null));
  on("[data-spcfpkcb]",()=>spcfPkCbLoad());
  on("[data-spcfpkimp]",b=>{const x=SPCF.pkcb.rows[+b.dataset.spcfpkimp],V=spcfVars();spcfComboForm(null,{ten:x.name,gia:x.value,fs:x.free_ship,gom:x.items.map(it=>({ma:spcfPkMa(it,V)||it.code,sl:it.qty}))})});
  on("[data-spcftt]",()=>spcfTtForm());
  on("[data-spcftier]",b=>{SPCF.tier=b.dataset.spcftier;renderMain()});
  const ms=$("#spcf-miss");if(ms)ms.onchange=()=>{SPCF.miss=ms.checked;renderMain()};
  on("[data-spcfxe]",()=>{SPCF.b2bEd=true;SPCF.chg={};renderMain()});
  on("[data-spcfxx]",()=>{if((Object.keys(SPCF.chg||{}).length||(SPCF.newP||[]).length)&&!confirm("Bỏ các ô đã sửa và mã mới?"))return;SPCF.b2bEd=false;SPCF.chg={};SPCF.newP=[];renderMain()});
  on("[data-spcfxs]",()=>spbgCreate());
  if(typeof spbgBind==="function")spbgBind(m);
  on("[data-spcfph]",b=>spcfB2bHist(b.dataset.spcfph));
  on("[data-spcfkt]",b=>{SPCF.kmT=b.dataset.spcfkt;renderMain()});
  on("[data-spcfkmnew]",()=>spcfKmPick());
  on("[data-spcfkmok]",b=>{if(confirm("Duyệt khuyến mãi này?"))spcfKmDuyet(b.dataset.spcfkmok,true)});
  on("[data-spcfkmno]",b=>{const ly=prompt("Lý do trả lại:");if(ly)spcfKmDuyet(b.dataset.spcfkmno,false,ly)});
  on("[data-spcfkmdel]",b=>{if(!confirm("Xóa khuyến mãi này?"))return;DB.mutate(ME.name,"xóa khuyến mãi",d=>{d.kmCat=(d.kmCat||[]).filter(x=>!(x.id===b.dataset.spcfkmdel&&x.byId===ME.id&&x.tt!=="ok"))});renderMain()});
}
/* Phê duyệt (pdcalc.js): khuyến mãi chờ duyệt + combo sàn chờ kế toán khai */
function spcfPdSrc(d){return {kmCho:((d&&d.kmCat)||[]).filter(k=>k.tt==="cho"),ttCho:((d&&d.ttCombo)||[]).filter(x=>x.tt==="cho"),pgCho:((d&&d.giaPhieu)||[]).filter(x=>x.tt==="cho")}}

/* ---------- CSKH tạo đơn (cskh.js csDonForm) dùng danh mục CSKH ----------
   Ô tìm sản phẩm: combo CSKH đang chạy → sản phẩm CSKH (giá CSKH) → mọi sản phẩm Pancake còn lại.
   Chọn combo: thêm từng món theo giá CSKH (quà giá 0), phần chênh với giá combo cộng vào ô Giảm giá. */
const spcfCk=()=>{try{return D().cskhCat||{}}catch(e){return {}}};
function spcfDonList(list){
  const ck=spcfCk(),byId=new Map((list||[]).map(x=>[x.id,x])),t=spcfToday(),mine=[];
  (ck.sp||[]).forEach(p=>(p.bt||[]).forEach(v=>{if(v.on===false||p.loai==="off")return;const pv=v.pkId&&byId.get(v.pkId);mine.push({id:pv?pv.id:(v.pkId||""),name:pv?pv.name:p.ten,price:v.gia||(pv?pv.price:0),cskh:true,ma:v.ma})}));
  const ids=new Set(mine.map(x=>x.id));
  const combos=(ck.combos||[]).filter(c=>(c.tt||"ok")==="ok"&&!(c.den&&c.den<t)&&!(c.tu&&c.tu>t)).map(c=>({combo:c,name:"Combo CSKH: "+(c.nhom||"")+(c.combo?" · "+c.combo:""),price:+c.gia||0,id:"combo"}));
  return combos.concat(mine,(list||[]).filter(x=>!ids.has(x.id)));
}
function spcfDonCombo(c,list){
  const ck=spcfCk(),byId=new Map((list||[]).map(x=>[x.id,x])),items=[];let sum=0;
  const vOf=ma=>{for(const p of (ck.sp||[]))for(const v of (p.bt||[]))if(v.ma===ma)return {p,v};return null};
  const add=(x,gift)=>{const lk=x.ma?vOf(x.ma):null,pv=lk&&lk.v.pkId?byId.get(lk.v.pkId):null,price=gift?0:(lk&&lk.v.gia)||(pv?pv.price:0),q=+x.sl||1;
    items.push({n:pv?pv.name:(lk?lk.p.ten:(x.ten||x.ma||"")),vid:pv?pv.id:"",q,price});sum+=q*price};
  (c.gom||[]).forEach(x=>add(x,false));(c.tang||[]).forEach(x=>add(x,true));
  return {items,disc:Math.max(0,sum-(+c.gia||0))};
}
/* Khuyến mãi CSKH đang chạy áp vào đơn: tính mức giảm theo từng loại (đồng giá, theo số lượng, theo giá trị đơn, chung, voucher, đính kèm).
   items: [{vid, q, price}] của ô tạo đơn; trả [{k, giam}] khuyến mãi khớp đơn. */
function spcfDonKmCalc(items,code){
  const t=spcfToday(),ck=spcfCk(),maOf=vid=>{for(const p of (ck.sp||[]))for(const v of (p.bt||[]))if(v.pkId&&v.pkId===vid)return v.ma;return ""};
  const L=spcfList("kmCat").filter(k=>k.bp==="cskh"&&k.tt==="ok"&&!(k.tu&&k.tu>t)&&!(k.den&&k.den<t));
  const its=(items||[]).map(i=>({...i,ma:maOf(i.vid)})),sub=its.reduce((a,i)=>a+i.q*i.price,0),out=[];
  const off=(c,base)=>c.amt?Math.min(base,c.amt):Math.round(base*(+c.pct||0)/100);
  L.forEach(k=>{const c=k.cfg||{};let g=0;
    if(k.t==="dg")its.filter(i=>(c.mas||[]).includes(i.ma)&&i.price>c.gia).forEach(i=>{g+=i.q*(i.price-c.gia)});
    else if(k.t==="sl"){const ln=its.filter(i=>i.ma===c.ma),q=ln.reduce((a,i)=>a+i.q,0),tr=(c.tiers||[]).filter(x=>q>=x.tu&&(x.den===""||x.den==null||q<=x.den)).pop();if(tr)ln.forEach(i=>{g+=Math.round(i.q*i.price*tr.pct/100)})}
    else if(k.t==="gt"){const tr=(c.tiers||[]).filter(x=>sub>=x.tu).sort((a,b)=>b.tu-a.tu)[0];if(tr)g=Math.round(sub*tr.pct/100)}
    else if(k.t==="ch"){if(sub>=(c.min||0)&&sub>0)g=off(c,sub)}
    else if(k.t==="vc"){if(code&&String(code).trim().toUpperCase()===c.code)g=off(c,sub)}
    else if(k.t==="dk"){const a=its.filter(i=>i.ma===c.ma);if(a.length&&its.some(i=>(c.kem||[]).includes(i.ma)))a.forEach(i=>{g+=off(c,i.q*i.price)})}
    if(g>0)out.push({k,giam:g})});
  return out;
}
/* Ô nhắc trong ô tạo đơn CSKH: khuyến mãi đang chạy + nút áp mức giảm vào ô Giảm giá */
function spcfDonKm(st){const t=spcfToday(),L=spcfList("kmCat").filter(k=>k.bp==="cskh"&&k.tt==="ok"&&!(k.tu&&k.tu>t)&&!(k.den&&k.den<t));if(!L.length)return "";
  const hit=st?spcfDonKmCalc(st.items,st.voucher):[],done=(st&&st.kmDone)||{};
  return `<div class="note" style="margin-top:8px"><b>Khuyến mãi CSKH đang chạy:</b> ${L.map(k=>esc(k.ten)+" ("+esc(k.ap||"")+")").join("; ")}
   ${hit.length?`<div style="margin-top:6px">${hit.map(h=>done[h.k.id]?`<span class="pill p-grn">đã áp ${esc(h.k.ten)} −${nf(h.giam)} đ</span>`:`<button class="btn sm pri" data-kmap="${esc(h.k.id)}" data-kmg="${h.giam}">Áp ${esc(h.k.ten)} −${nf(h.giam)} đ</button>`).join(" ")}</div>`:""}
   ${L.some(k=>k.t==="vc")?`<div class="filters" style="margin-top:6px"><input id="cd-vc" placeholder="Mã voucher khách đưa" value="${esc((st&&st.voucher)||"")}" style="max-width:200px"></div>`:""}</div>`}

/* Sản phẩm, combo, khuyến mãi không theo kỳ: ẩn ô chọn tháng (chị Hoa 16/11) */
window.NO_PP=window.NO_PP||new Set();["sp_cfg","sp_cb","sp_gia","sp_km","dg_sp","kd_combo"].forEach(k=>NO_PP.add(k));
const spcfB2bOk=u=>spcfAll(u)||(!!u&&u.phongBan==="KV");
PAGES.sp_cfg=pSpcfGoc;PAGES.sp_cb=pSpcfCb;PAGES.sp_km=pSpcfKm;
PAGES.sp_gia=m=>{if(!spcfB2bOk(ME)){spcfNoAccess(m,"Bảng giá");return}spcfB2bView(m,"Bảng giá","Bảng giá Kênh phân phối 8 cấp · sửa giá qua phiếu chị duyệt · báo giá gửi khách")};
/* Trang cũ dồn về đây */
PAGES.dg_sp=m=>{SPCF.ch="ads";SPCF.sub="sp";pSpcfCb(m)};
PAGES.kd_combo=m=>{SPCF.ch="cskh";pSpcfCb(m)};
MODULES.push({k:"spcf",zone:"Vận hành",ic:"gear",n:"Sản phẩm",sub:"",groups:()=>[["",[MI("sp_cfg","Sản phẩm",u=>spcfChs(u).length>0),MI("sp_cb","Combo",u=>spcfChs(u).some(c=>c[0]!=="b2b")),MI("sp_gia","Bảng giá",u=>spcfB2bOk(u)),MI("sp_km","Khuyến mãi",u=>spcfChs(u).length>0,()=>spcfCanDuyet()?spcfList("kmCat").filter(k=>k.tt==="cho").length||"":"")]]]});
