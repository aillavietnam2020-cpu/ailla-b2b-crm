/* Bản nhìn của web vận hành (vanhanh.ailla.vn): vẫn thấy kết quả kinh doanh, hiệu quả team, chi phí quảng cáo,
   nhưng KHÔNG thấy giá vốn, giá thành, định mức, phí sàn, lãi lỗ. Bản đầy đủ nằm ở trang quản trị (quantri.ailla.vn).
   Đây là lớp che trên màn hình; số liệu tài chính gốc vẫn được máy chủ khóa riêng (chỉ CEO và kế toán tải về được). */
function OPSV(){return typeof HOST_MODE!=="undefined"&&HOST_MODE==="ops"&&typeof ADMIN_URL!=="undefined"&&!!ADMIN_URL}
const OPS_HIDE=["kho_boc","kho_cl","kho_map","kho_qd"];
const OPSV_HARD=/giá vốn|giá thành|lãi|lợi nhuận|phí sàn|đã trừ|định mức|(^|\s)lỗ(\s|$)|(^|\s)biên(\s|$)/i;
const OPSV_SOFT=/chi phí/i;
const OPSV_ADS=/ads|quảng cáo|(^|[^a-zà-ỹ])qc([^a-zà-ỹ]|$)/i;
const opsvTxt=e=>(e.textContent||"").replace(/\s+/g," ").trim();
const opsvBad=s=>OPSV_HARD.test(s)||(OPSV_SOFT.test(s)&&!OPSV_ADS.test(s));
function opsvScrub(m,opt){
  opt=opt||{};
  /* Bảng: bỏ cột và dòng nói về giá vốn / lãi / chi phí (trừ quảng cáo). */
  m.querySelectorAll("table").forEach(t=>{
    const ths=[...t.querySelectorAll("thead th")];
    const del=ths.map((h,i)=>{const s=opsvTxt(h);return opsvBad(s)||(opt.dm&&/^định mức$/i.test(s))?i:-1}).filter(i=>i>=0);
    if(del.length)t.querySelectorAll("tr").forEach(tr=>{const c=[...tr.children];if(c.length!==ths.length)return;del.slice().reverse().forEach(i=>c[i].remove())});
    if(!opt.dm)t.querySelectorAll("tbody tr").forEach(tr=>{const c=[...tr.children];if(c[0]&&opsvBad(opsvTxt(c[0]))){tr.remove();return}c.slice(1).forEach(x=>{if(!x.children.length&&opsvBad(opsvTxt(x)))x.textContent="—"})});
  });
  /* Khối: bảng lãi lỗ (đầu cột "Chỉ tiêu") hoặc tiêu đề nói về lãi, giá vốn, phí sàn, chi phí. */
  m.querySelectorAll(".card").forEach(c=>{
    const h=c.querySelector(".card-h h2"),th=c.querySelector("thead th");
    if((h&&opsvBad(opsvTxt(h)))||(th&&opsvTxt(th)==="Chỉ tiêu"))c.remove();
  });
  /* Ô chỉ số: bỏ ô lãi / chi phí; ô còn lại bỏ dòng phụ có chữ lãi. */
  m.querySelectorAll(".kpi").forEach(k=>{const l=k.querySelector(".l"),h=k.querySelector(".h");if(l&&opsvBad(opsvTxt(l)))k.remove();else if(h&&opsvBad(opsvTxt(h)))h.remove()});
  m.querySelectorAll(".xk").forEach(k=>{const l=k.querySelector(".xkl");if(l&&opsvBad(opsvTxt(l))){k.remove();return}k.querySelectorAll(".xkm").forEach(x=>{if(opsvBad(opsvTxt(x)))x.remove()})});
  m.querySelectorAll(".note,p,li,.hint,.pill,.srcnote,button.btn,a.btn").forEach(x=>{if(!x.isConnected||x.closest("table")||x.closest(".tabs"))return;if(opsvBad(opsvTxt(x)))x.remove()});
  m.querySelectorAll("ol.lessons li").forEach(x=>{if(OPSV_HARD.test(opsvTxt(x))||OPSV_SOFT.test(opsvTxt(x)))x.remove()});
  m.querySelectorAll(".ph *").forEach(x=>{if(x.children.length||!opsvBad(opsvTxt(x)))return;x.textContent=opsvTxt(x).replace(/\s*(và|,|·)\s*lãi[^·,.]*/i,"")});
  /* Nút tab: "Lãi lỗ" đổi tên thành "Tổng quan", tab "Phí sàn" bỏ. */
  m.querySelectorAll(".tabs button").forEach(b=>{const s=opsvTxt(b);if(/^phí sàn$/i.test(s))b.remove();else if(/lãi lỗ/i.test(s))b.textContent=s.replace(/^Lãi lỗ & /i,"").replace(/^Lãi lỗ$/i,"Tổng quan")});
}
["exec","bc_tong","bc_tiktok","bc_shopee","bc_fb","bc_koc"].forEach(k=>{const f=PAGES[k];if(!f)return;PAGES[k]=function(m){f.apply(this,arguments);if(OPSV())opsvScrub(m)}});
{const f=PAGES.kho_dm;if(f)PAGES.kho_dm=function(m){
  if(OPSV()){const r=KHO_SUB.find(x=>x[0]==="kho_dm");if(r)r[1]="Danh mục mã"}
  if(OPSV()&&typeof KHO!=="undefined"&&KHO.dm){KHO.dm.sel="";if(KHO.dm.cls==="nobom")KHO.dm.cls=""}
  f.apply(this,arguments);
  if(!OPSV())return;
  opsvScrub(m,{dm:true});
  m.querySelectorAll('.dmchip[data-dmc="nobom"],#dm-cls option[value="nobom"],#dm-edit').forEach(x=>x.remove());
  const p=m.querySelector(".ph p,.sxhead p");if(p)p.textContent="Mã vật tư lấy từ MISA.";
  m.querySelectorAll("h1,h2,button").forEach(x=>{if(x.innerHTML.includes("Danh mục &amp; định mức"))x.innerHTML=x.innerHTML.replace("Danh mục &amp; định mức","Danh mục mã")});
}}

/* Tên mục trong menu kho: ở vận hành chỉ là danh mục mã. */
if(OPSV()){const r=KHO_SUB.find(x=>x[0]==="kho_dm");if(r)r[1]="Danh mục mã"}
