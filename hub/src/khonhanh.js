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
const KQ_PN=()=>kCan("PN")||KQ_MH(); // chị Hoa 04/11: người phụ trách mua hàng (Thảo) tạo được phiếu nhập kho từ Ghi nhanh
const KQ_LIST=()=>[
  ["Mua hàng & nhập kho",[["Lập đơn mua hàng",()=>!KQ_ADM()&&KQ_MH()&&typeof mhForm==="function",async()=>{try{await mhLoad()}catch(e){}for(let i=0;i<40&&!(MH&&MH.sup);i++)await new Promise(r=>setTimeout(r,150));mhForm(null)}],
    ["Tạo phiếu nhập kho · nguyên vật liệu",KQ_PN,()=>khoForm("PN",null,["NVL","CCDC"])],
    ["Tạo phiếu nhập kho · hàng mua ngoài",KQ_PN,()=>khoForm("PN",null,["TP","HH"])]]],
  ["Xuất kho",[["Xuất nguyên vật liệu khác",()=>kCan("XB"),()=>khoForm("XB",null,["NVL","BTP","CCDC"])],
    ["Xuất thành phẩm khác",()=>kCan("XB"),()=>khoForm("XB",null,["TP","HH"])]]],
  ["Sản xuất",[["Phiếu pha chế",()=>kCan("PC"),()=>khoForm("PC")],
    ["Đóng gói & kiểm kê",()=>kCan("KS")&&!!PAGES.sx_lo&&!KQ_ADM(),()=>KQ_GO("sx_lo")]]],
  ["Kho",[["Hàng hoàn",()=>kCan("TL")&&!!PAGES.kho_hoan&&!KQ_ADM(),()=>KQ_GO("kho_hoan")],
    ["Kiểm tồn bổ sung",()=>kCan("TB")&&typeof KTON!=="undefined"&&KTON.moc&&!!KTON.moc.moc,()=>khoForm("TB")]]]]
  .map(([g,a])=>[g,a.filter(x=>{try{return x[1]()}catch(e){return false}})]).filter(g=>g[1].length);
/* Chị Hoa 04/11: một nút "＋ Ghi nhanh" ở đầu thanh menu cho cả hai web.
   - Vận hành: nút mới, gồm đơn mua hàng + các phiếu kho.
   - Quản trị: đã có "＋ Ghi nhanh" (admnav2.js: phiếu chi, đơn mua, chứng từ) — thêm các phiếu kho vào cuối bảng chọn đó. */
function khoQuickBtn(){return ""}
const kqRun=async it=>{document.body.classList.remove("menu-open");if(!KHO.cat){try{await khoLoad()}catch(err){}}if(!KHO.cat){toast("Đang tải kho, bấm lại sau vài giây");return}try{await it[2]()}catch(e){toast(e.message||"Chưa mở được")}};
function kqInject(){
  if(typeof ME==="undefined"||!ME)return;let L=[];try{L=KQ_LIST()}catch(e){}if(!L.length)return;
  if(KQ_ADM()){const gp=document.getElementById("gnp");if(!gp||gp.querySelector("[data-kqa]"))return;
    const its=L.flatMap(([g,a])=>a.map(x=>[g,x]));
    gp.insertAdjacentHTML("beforeend",`<div class="gnsep" data-kqa="1">Kho</div>`+its.map(([g,x],i)=>`<button type="button" data-kqa="${i}"><b>${esc(x[0])}</b><small>${esc(g)}</small></button>`).join(""));
    gp.querySelectorAll("button[data-kqa]").forEach(b=>b.onclick=e=>{e.stopPropagation();gp.hidden=true;kqRun(its[+b.dataset.kqa][1])});return}
  const nav=document.querySelector(".side nav");if(!nav||document.getElementById("kqside"))return;
  const w=document.createElement("div");w.id="kqside";w.className="gnbox";
  w.innerHTML=`<button type="button" class="gnbtn kqbtn kqs"><span>＋ Ghi nhanh</span><span>▾</span></button>`;nav.before(w)}
{const _r=render;render=function(){const r=_r.apply(this,arguments);try{kqInject()}catch(e){}return r}}
function kqClose(){const p=document.getElementById("kqpop");if(p)p.remove()}
function kqOpen(btn){
  kqClose();const L=KQ_LIST();if(!L.length)return;const r=btn.getBoundingClientRect();
  const p=document.createElement("div");p.id="kqpop";p.className="kqpop";
  p.innerHTML=L.map(([g,a],gi)=>`<div class="kqg"><h4>${esc(g)}</h4>${a.map(([t],i)=>`<button type="button" data-kq="${gi}.${i}">${esc(t)}</button>`).join("")}</div>`).join("")+`<p class="hint">Chỉ hiện loại phiếu bạn được làm.</p>`;
  document.body.appendChild(p);
  const w=p.offsetWidth,side=btn.classList.contains("kqs");p.style.top=(r.bottom+6)+"px";p.style.left=Math.max(8,Math.min(side?r.left:r.right-w,innerWidth-w-8))+"px";
  p.querySelectorAll("[data-kq]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const [gi,i]=b.dataset.kq.split(".").map(Number),it=L[gi][1][i];kqClose();document.body.classList.remove("menu-open");
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
