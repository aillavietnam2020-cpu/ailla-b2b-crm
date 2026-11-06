/* =====================================================================
   GHI NHANH PHIẾU KHO (chị Hoa duyệt 04/11, phương án C menu kho). Xem ghi chú ở kqInject: một nút "＋ Ghi nhanh" cho cả hai web.
   - Nút "＋ Lập phiếu nhanh" ở góc trên mọi trang Kho – Sản xuất (web vận hành): chọn loại phiếu, phiếu mở ngay tại chỗ.
     Chỉ hiện loại phiếu người đó được làm (cùng quyền như nút lập phiếu ở từng trang). Web quản trị không có nút này.
   - Trong phiếu: dán nhiều dòng từ Excel (mã, số lượng) vào ô mã hàng thì web tự thêm từng dòng.
   Không đổi cách ghi sổ: vẫn gọi đúng form và API phiếu kho như cũ.
   ===================================================================== */
const KQ_ADM=()=>typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
const KQ_GO=p=>{if(!PAGES[p])return;PAGE=p;renderMain();scrollTo(0,0)};
const KQ_MH=()=>typeof mhManage==="function"&&mhManage();
const KQ_CHI=()=>KQ_MH()||(typeof can==="function"&&can(ME,"chiphi.nhap"));
/* Chị Hoa 04/11: Ghi nhanh chỉ 5 việc, nằm trong mục Kho – Sản xuất (web vận hành). Không còn "xuất khác", pha chế, đóng gói, hàng hoàn, kiểm tồn ở đây.
   Phiếu xuất kho / nhập kho mở form chung cho cả hai kho: chọn mã nào thì sổ tự xếp vào kho nguyên vật liệu hay kho thành phẩm. */
const KQ_LIST=()=>[
  ["Lập phiếu thu",()=>KQ_CHI()&&typeof cptQuick==="function",()=>cptQuick(),false],
  ["Lập phiếu chi",()=>KQ_CHI()&&typeof spForm==="function",()=>spForm(),false],
  ["Lập phiếu mua hàng",()=>KQ_MH()&&typeof mhForm==="function",async()=>{try{await mhLoad()}catch(e){}for(let i=0;i<40&&!(MH&&MH.sup);i++)await new Promise(r=>setTimeout(r,150));mhForm(null)},false],
  ["Lập phiếu nhập kho",()=>kCan("PN")||KQ_MH(),()=>khoForm("PN",null,["NVL","CCDC","TP","HH"]),true],
  ["Lập phiếu xuất kho",()=>kCan("XB"),()=>khoForm("XB",null,null),true]]
  .filter(x=>{try{return x[1]()}catch(e){return false}});
function khoQuickBtn(){return ""}
const kqRun=async it=>{document.body.classList.remove("menu-open");if(it[3]){if(!KHO.cat){try{await khoLoad()}catch(err){}}if(!KHO.cat){toast("Đang tải kho, bấm lại sau vài giây");return}}try{await it[2]()}catch(e){toast(e.message||"Chưa mở được")}};
function kqInject(){
  if(typeof ME==="undefined"||!ME)return;
  /* Quản trị: Ghi nhanh sẵn có (admnav2.js) thêm 2 phiếu kho ở cuối: Lập phiếu nhập kho, Lập phiếu xuất kho (chị Hoa 04/11). */
  if(KQ_ADM()){const gp=document.getElementById("gnp");if(!gp||gp.querySelector("[data-kqa]"))return;let K=[];try{K=KQ_LIST().filter(x=>x[3])}catch(e){}if(!K.length)return;
    gp.insertAdjacentHTML("beforeend",K.map((x,i)=>`<button type="button" data-kqa="${i}"><b>${esc(x[0])}</b><small>${i===0?"Hàng mua về, chọn đơn mua để tự điền":"Xuất ngoài bán hàng: hàng mẫu, hủy hỏng, gia công"}</small></button>`).join(""));
    gp.querySelectorAll("button[data-kqa]").forEach(b=>b.onclick=e=>{e.stopPropagation();gp.hidden=true;kqRun(K[+b.dataset.kqa])});return}
  if(document.getElementById("kqside"))return;
  const top=document.querySelector('.side .top[data-mod="sx"]'),sub=top&&top.nextElementSibling;if(!sub||!sub.classList.contains("subnav"))return;
  let L=[];try{L=KQ_LIST()}catch(e){}if(!L.length)return;
  const w=document.createElement("div");w.id="kqside";w.className="gnbox kqin";
  w.innerHTML=`<button type="button" class="gnbtn kqbtn kqs"><span>＋ Ghi nhanh</span><span>▾</span></button>`;sub.prepend(w)}
{const _r=render;render=function(){const r=_r.apply(this,arguments);try{kqInject()}catch(e){}return r}}
function kqClose(){const p=document.getElementById("kqpop");if(p)p.remove()}
function kqOpen(btn){
  kqClose();const L=KQ_LIST();if(!L.length)return;const r=btn.getBoundingClientRect();
  const p=document.createElement("div");p.id="kqpop";p.className="kqpop";
  p.innerHTML=L.map(([t],i)=>`<button type="button" data-kq="${i}">${esc(t)}</button>`).join("");p.classList.add("one");
  document.body.appendChild(p);
  const w=p.offsetWidth,side=btn.classList.contains("kqs");p.style.top=(r.bottom+6)+"px";p.style.left=Math.max(8,Math.min(side?r.left:r.right-w,innerWidth-w-8))+"px";
  p.querySelectorAll("[data-kq]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const it=L[+b.dataset.kq];kqClose();document.body.classList.remove("menu-open");
    kqRun(it)});
}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest(".kqbtn");if(b){e.preventDefault();e.stopPropagation();if(document.getElementById("kqpop"))kqClose();else kqOpen(b);return}
  if(!(e.target.closest&&e.target.closest("#kqpop")))kqClose()},true);
addEventListener("scroll",e=>{if(!(e.target&&e.target.closest&&e.target.closest("#kqpop")))kqClose()},{passive:true,capture:false});

/* Trang Sản xuất (sxFrame: Tổng quan, Phiếu sản xuất, Tiến độ, Kiểm kê đóng gói, Báo cáo, Mua hàng): thêm nút vào ô thao tác. */
if(typeof sxFrame==="function"){const _sf=sxFrame;sxFrame=function(m,key,title,sub,body,actions){return _sf.call(this,m,key,title,sub,body,(actions||"")+(/btn pri|id="/.test(actions||"")?"":khoQuickBtn()))}}

/* Số kiểu Việt: 1.240 = một nghìn hai trăm bốn mươi; 2,5 = hai phẩy năm; 1.5 = một phẩy năm. */
function kqNum(x){x=String(x).replace(/\s/g,"");if(!x)return null;
  if(/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(x))x=x.replace(/\./g,"").replace(",",".");else if(/^-?\d+,\d+$/.test(x))x=x.replace(",",".");
  const n=+x;return isFinite(n)?n:null}
/* Dán nhiều dòng từ Excel vào ô mã hàng của phiếu: mỗi dòng "mã [tab] số lượng" (hoặc tên đúng như danh mục). */
if(typeof khoForm==="function"){const _kf=khoForm;khoForm=function(type,pre,clsO){
  let add=null;_kf.call(this,type,a=>{add=a;if(pre)pre(a)},clsO);
  const body=document.getElementById("kf-b");if(!body||type==="PC"||!add)return;
  body.addEventListener("paste",e=>{const inp=e.target;if(!inp.classList||!inp.classList.contains("kf-i"))return;
    const txt=(e.clipboardData||window.clipboardData).getData("text")||"";if(!/[\t\n]/.test(txt.trim()))return;
    e.preventDefault();const byName=new Map([...KHO.items.values()].map(i=>[kfold(i.name).trim(),i.code])),byCode=new Map([...KHO.items.keys()].map(c=>[c.toLowerCase(),c]));
    const bad=[];let n=0;
    txt.split(/\r?\n/).map(l=>l.split(/\t|;/).map(x=>x.trim())).filter(c=>c[0]).forEach(c=>{
      const key=c[0],code=byCode.get(key.toLowerCase())||byName.get(kfold(key).trim()),qs=c.slice(1).reverse().find(x=>x!==""&&kqNum(x)!=null);
      if(!code){bad.push(key);return}
      const q=qs==null?"":kqNum(qs);
      body.querySelectorAll("tr").forEach(tr=>{const i=tr.querySelector(".kf-i");if(i&&!i.dataset.code&&!i.value)tr.remove()});
      const tr=add({item:code,qty:q===""?undefined:q});n++;if(tr){const qi=tr.querySelector(".kf-q");if(qi)qi.dispatchEvent(new Event("input"))}});
    toast(`Đã thêm ${n} dòng`+(bad.length?` · không tìm thấy mã: ${bad.slice(0,5).join(", ")}${bad.length>5?"…":""}`:""))});
  const tip=document.querySelector("#kf .row7 .field.grow input#kf-n");if(tip&&type!=="PC"){const h=document.createElement("p");h.className="hint";h.textContent="Mẹo: dán nhiều dòng từ Excel (cột mã, cột số lượng) vào ô mã hàng, web tự thêm từng dòng.";const t=document.querySelector("#kf .tbl.edit");if(t)t.after(h)}
}}

/* Ô chọn sản phẩm dạng danh sách thả xuống (phiếu sản xuất, báo hoàn thành, kiểm kê phát sinh): không dán tên để tìm được.
   Thêm một ô gõ / dán ngay trên: gõ hoặc dán tên, mã → danh sách chỉ còn mã khớp và tự chọn mã đầu tiên (chị Hoa 06/11). */
function kqSearchSelect(sel){
  if(sel.dataset.kqs)return;sel.dataset.kqs="1";
  const all=[...sel.options].map(o=>({v:o.value,t:o.textContent}));
  const inp=document.createElement("input");inp.type="search";inp.placeholder="Gõ hoặc dán tên / mã sản phẩm để tìm";inp.className="kqsrch";inp.autocomplete="off";
  sel.parentNode.insertBefore(inp,sel);
  const fold=s=>(typeof kfold==="function"?kfold(s):String(s).toLowerCase());
  inp.oninput=()=>{const q=fold(inp.value).trim(),ws=q.split(/\s+/).filter(Boolean),cur=sel.value;
    const L=all.filter((o,i)=>i===0||!ws.length||ws.every(w=>fold(o.t+" "+o.v).includes(w)));
    sel.innerHTML=L.map(o=>`<option value="${esc(o.v)}">${esc(o.t)}</option>`).join("");
    const keep=L.find(o=>o.v===cur&&o.v);sel.value=keep?cur:(ws.length&&L[1]?L[1].v:"");
    if(sel.options[0])sel.options[0].textContent=ws.length?(L.length>1?`— ${L.length-1} mã khớp, chọn trong danh sách`:"— không có mã nào khớp"):all[0].t;
    sel.dispatchEvent(new Event("change",{bubbles:true}))};
}
new MutationObserver(()=>{document.querySelectorAll("select").forEach(s=>{const o=s.options[0];if(o&&!s.dataset.kqs&&/^— chọn sản phẩm/.test(o.textContent)&&s.options.length>8)kqSearchSelect(s)})}).observe(document.documentElement,{childList:true,subtree:true});
