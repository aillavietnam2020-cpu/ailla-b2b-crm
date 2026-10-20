/* Nút "⋯" cho cột thao tác của mọi bảng: các nút phụ (Ngừng dùng, Xóa, Khóa, Hủy...) gom vào một menu nhỏ,
   nút chính (Sửa, Duyệt, Xem, In...) vẫn hiện sẵn. Không sửa từng trang: nút gốc chỉ bị ẩn đi, bấm trong menu là bấm nút gốc
   nên mọi hộp xác nhận và thao tác cũ giữ nguyên. */
const RM_SEC=/^(xóa|xoá|ngừng dùng|ngừng bán|dùng lại|bán lại|khóa|khoá|mở khóa|mở khoá|hủy|huỷ|gỡ|ẩn|hiện lại|lưu trữ|nhân bản|đặt lại mật khẩu|vô hiệu|bật lại|tắt)(\s|$)/i;
function rmClosePop(){const o=document.querySelector(".rmpop");if(o)o.remove()}
function rowMenus(root){
  if(!root)return;
  root.querySelectorAll("table tbody tr").forEach(tr=>{
    if(tr.dataset.rm)return;
    const td=tr.lastElementChild;if(!td||td.tagName!=="TD")return;
    if(td.querySelector("input,select,textarea,.rmb"))return;
    const ctl=[...td.querySelectorAll("button,a.lnk,a.btn")].filter(x=>!x.classList.contains("rmb"));
    if(ctl.length<2)return;
    const sec=ctl.filter(x=>RM_SEC.test((x.textContent||"").replace(/\s+/g," ").trim())&&!x.disabled);
    if(!sec.length)return;
    tr.dataset.rm="1";
    sec.forEach(x=>{x.style.display="none"});
    /* bỏ dấu "·" hoặc "|" thừa giữa các nút */
    [...td.childNodes].forEach(n=>{if(n.nodeType===3&&/^[\s·|•]*$/.test(n.textContent))n.textContent=" "});
    const b=document.createElement("button");b.type="button";b.className="btn sm rmb";b.textContent="⋯";b.title="Thêm thao tác";b.setAttribute("aria-label","Thêm thao tác");
    b.onclick=e=>{
      e.stopPropagation();const had=document.querySelector(".rmpop"),mine=had&&had._src===b;rmClosePop();if(mine)return;
      const r=b.getBoundingClientRect(),pop=document.createElement("div");pop.className="rmpop";pop._src=b;
      pop.style.top=Math.min(r.bottom+4,innerHeight-(sec.length*38+16))+"px";pop.style.right=Math.max(8,innerWidth-r.right)+"px";
      sec.forEach(x=>{const it=document.createElement("button");it.type="button";const t=(x.textContent||"").replace(/\s+/g," ").trim();it.textContent=t;if(/^(xóa|xoá)/i.test(t))it.className="dg";it.onclick=ev=>{ev.stopPropagation();rmClosePop();x.click()};pop.appendChild(it)});
      document.body.appendChild(pop)};
    td.appendChild(document.createTextNode(" "));td.appendChild(b);
  });
}
{
  let t=null;const run=()=>{t=null;try{rowMenus(document.getElementById("main"))}catch(e){}};
  const start=()=>{new MutationObserver(()=>{if(!t)t=setTimeout(run,80)}).observe(document.body,{childList:true,subtree:true});run()};
  if(document.body)start();else document.addEventListener("DOMContentLoaded",start);
  document.addEventListener("click",rmClosePop);window.addEventListener("scroll",rmClosePop,true);
}
