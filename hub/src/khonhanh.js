/* =====================================================================
   LẬP PHIẾU NHANH (chị Hoa duyệt 04/11, phương án C menu kho).
   - Nút "＋ Lập phiếu nhanh" ở góc trên mọi trang Kho – Sản xuất (web vận hành): chọn loại phiếu, phiếu mở ngay tại chỗ.
     Chỉ hiện loại phiếu người đó được làm (cùng quyền như nút lập phiếu ở từng trang). Web quản trị không có nút này.
   - Trong phiếu: dán nhiều dòng từ Excel (mã, số lượng) vào ô mã hàng thì web tự thêm từng dòng.
   Không đổi cách ghi sổ: vẫn gọi đúng form và API phiếu kho như cũ.
   ===================================================================== */
const KQ_ADM=()=>typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
const KQ_GO=p=>{if(!PAGES[p])return;PAGE=p;renderMain();scrollTo(0,0)};
const KQ_LIST=()=>[
  ["Kho nguyên vật liệu",[["Nhập nguyên vật liệu",()=>kCan("PN"),()=>khoForm("PN",null,["NVL","CCDC"])],
    ["Xuất nguyên vật liệu khác",()=>kCan("XB"),()=>khoForm("XB",null,["NVL","BTP","CCDC"])]]],
  ["Sản xuất",[["Phiếu pha chế",()=>kCan("PC"),()=>khoForm("PC")],
    ["Đóng gói & kiểm kê",()=>kCan("KS")&&!!PAGES.sx_lo,()=>KQ_GO("sx_lo")]]],
  ["Kho thành phẩm",[["Nhập hàng mua ngoài",()=>kCan("PN"),()=>khoForm("PN",null,["TP","HH"])],
    ["Xuất thành phẩm khác",()=>kCan("XB"),()=>khoForm("XB",null,["TP","HH"])],
    ["Hàng hoàn",()=>kCan("TL")&&!!PAGES.kho_hoan,()=>KQ_GO("kho_hoan")]]],
  ["Kiểm kê",[["Kiểm tồn bổ sung",()=>kCan("TB")&&typeof KTON!=="undefined"&&KTON.moc&&!!KTON.moc.moc,()=>khoForm("TB")]]]]
  .map(([g,a])=>[g,a.filter(x=>{try{return x[1]()}catch(e){return false}})]).filter(g=>g[1].length);
/* Chị Hoa 04/11: nút đưa lên đầu thanh menu bên trái (giống "＋ Ghi nhanh" bên quản trị), không để trong từng trang nữa. */
function khoQuickBtn(){return ""}
function kqInject(){
  if(KQ_ADM()||typeof ME==="undefined"||!ME)return;const nav=document.querySelector(".side nav");if(!nav||document.getElementById("kqside"))return;
  let ok=false;try{ok=KQ_LIST().length>0}catch(e){}if(!ok)return;
  const w=document.createElement("div");w.id="kqside";w.className="gnbox";
  w.innerHTML=`<button type="button" class="gnbtn kqbtn kqs"><span>＋ Tạo phiếu nhập kho</span><span>▾</span></button>`;nav.before(w)}
{const _r=render;render=function(){const r=_r.apply(this,arguments);try{kqInject()}catch(e){}return r}}
function kqClose(){const p=document.getElementById("kqpop");if(p)p.remove()}
function kqOpen(btn){
  kqClose();const L=KQ_LIST();if(!L.length)return;const r=btn.getBoundingClientRect();
  const p=document.createElement("div");p.id="kqpop";p.className="kqpop";
  p.innerHTML=L.map(([g,a],gi)=>`<div class="kqg"><h4>${esc(g)}</h4>${a.map(([t],i)=>`<button type="button" data-kq="${gi}.${i}">${esc(t)}</button>`).join("")}</div>`).join("")+`<p class="hint">Chỉ hiện loại phiếu bạn được làm.</p>`;
  document.body.appendChild(p);
  const w=p.offsetWidth,side=btn.classList.contains("kqs");p.style.top=(r.bottom+6)+"px";p.style.left=Math.max(8,Math.min(side?r.left:r.right-w,innerWidth-w-8))+"px";
  p.querySelectorAll("[data-kq]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const [gi,i]=b.dataset.kq.split(".").map(Number),it=L[gi][1][i];kqClose();document.body.classList.remove("menu-open");
    if(!KHO.cat){try{await khoLoad()}catch(err){}}if(!KHO.cat){toast("Đang tải kho, bấm lại sau vài giây");return}it[2]()});
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
