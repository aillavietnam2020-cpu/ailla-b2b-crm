/* =====================================================================
   Ô CHỌN SẢN PHẨM GÕ TÌM ĐƯỢC
   Mọi danh sách thả xuống mà phần lớn lựa chọn là sản phẩm (mã trong danh mục) được thay bằng ô gõ tên:
   gõ đến đâu lọc đến đó, gõ không dấu vẫn ra ("tinh dau" → Tinh dầu giặt sấy). Ô chọn gốc vẫn giữ (ẩn),
   chọn xong thì đặt giá trị cho ô gốc và bắn sự kiện change, nên code cũ đọc ô gốc như trước.
   ===================================================================== */
const spsFold=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().trim();
function spsKeys(){const d=typeof D==="function"?D():null;if(!d)return null;const K=new Set();(d.catalog||[]).forEach(c=>c&&c.k&&K.add(c.k));(d.products||[]).forEach(p=>p&&p.k&&K.add(p.k));return K}
function spsIsProd(sel,K){
  if(sel.multiple||sel.dataset.sps||sel.closest(".spsw"))return false;
  const v=[...sel.options].map(o=>o.value).filter(Boolean);if(v.length<5)return false;
  return v.filter(x=>K.has(x)).length>=v.length*0.7}
function spsClose(){const p=document.querySelector(".spspop");if(p){if(p._done)p._done();p.remove()}}
function spsEnhance(sel){
  sel.dataset.sps="1";
  const w=document.createElement("span");w.className="spsw";
  const inp=document.createElement("input");inp.type="text";inp.className="spsi";inp.autocomplete="off";inp.placeholder="Gõ tên sản phẩm…";
  const inField=!!sel.closest("label.field"),wd=sel.offsetWidth;w.style.width=inField?"100%":Math.max(wd,170)+"px";
  if(sel.title)inp.title=sel.title;if(sel.getAttribute("aria-label"))inp.setAttribute("aria-label",sel.getAttribute("aria-label"));
  sel.parentNode.insertBefore(w,sel);w.appendChild(inp);w.appendChild(sel);sel.classList.add("spsh");
  const txt=()=>{const o=sel.options[sel.selectedIndex];return o?o.text:""};
  const sync=()=>{inp.value=txt();inp.disabled=sel.disabled};sync();
  sel.addEventListener("change",sync);
  let act=0,list=[];
  const pick=o=>{spsClose();if(sel.value!==o.value){sel.value=o.value;sel.dispatchEvent(new Event("change",{bubbles:true}))}sync()};
  const draw=q=>{
    let p=document.querySelector(".spspop");if(!p||p._sel!==sel){spsClose();p=document.createElement("div");p.className="spspop";p._sel=sel;p._done=()=>{};document.body.appendChild(p)}
    const words=spsFold(q).split(/\s+/).filter(Boolean),opts=[...sel.options].filter(o=>!o.disabled);
    list=words.length?opts.filter(o=>{const t=spsFold(o.text+" "+o.value);return words.every(x=>t.includes(x))}):opts;
    act=Math.max(0,list.findIndex(o=>o.value===sel.value&&!words.length));
    p.innerHTML=list.length?list.map((o,i)=>`<div class="spso${i===act?" on":""}${o.value===sel.value?" cur":""}" data-i="${i}">${esc(o.text)}</div>`).join(""):`<div class="spsn">Không có sản phẩm nào khớp “${esc(q)}”</div>`;
    p.querySelectorAll("[data-i]").forEach(x=>x.onmousedown=e=>{e.preventDefault();pick(list[+x.dataset.i])});
    const r=inp.getBoundingClientRect(),h=Math.min(320,p.scrollHeight||320),below=innerHeight-r.bottom>h+8||r.top<h+8;
    p.style.left=Math.max(8,Math.min(r.left,innerWidth-Math.max(r.width,240)-8))+"px";p.style.minWidth=Math.max(r.width,240)+"px";
    p.style.top=(below?r.bottom+2:r.top-h-2)+"px";
    const on=p.querySelector(".spso.on");if(on)on.scrollIntoView({block:"nearest"})};
  const mark=()=>{const p=document.querySelector(".spspop");if(!p)return;p.querySelectorAll(".spso").forEach((x,i)=>x.classList.toggle("on",i===act));const on=p.querySelector(".spso.on");if(on)on.scrollIntoView({block:"nearest"})};
  inp.addEventListener("focus",()=>{inp.select();draw("")});
  inp.addEventListener("click",()=>{if(!document.querySelector(".spspop"))draw("")});
  inp.addEventListener("input",()=>draw(inp.value));
  inp.addEventListener("keydown",e=>{
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();if(!document.querySelector(".spspop")){draw("");return}act=Math.max(0,Math.min(list.length-1,act+(e.key==="ArrowDown"?1:-1)));mark()}
    else if(e.key==="Enter"){if(document.querySelector(".spspop")&&list[act]){e.preventDefault();pick(list[act])}}
    else if(e.key==="Escape"){spsClose();sync()}});
  inp.addEventListener("blur",()=>setTimeout(()=>{if(document.activeElement!==inp){spsClose();sync()}},120));
}
function spsRun(){const K=spsKeys();if(!K||!K.size)return;document.querySelectorAll("select:not([data-sps])").forEach(s=>{if(spsIsProd(s,K))spsEnhance(s);else s.dataset.sps="0"})}
(function(){
  const st=document.createElement("style");
  st.textContent=`.spsw{position:relative;display:inline-block;vertical-align:middle;max-width:100%}.spsw .spsh{display:none!important}.spsi{width:100%;box-sizing:border-box}
.spspop{position:fixed;z-index:9999;max-height:320px;overflow:auto;background:var(--bg-surface-raised,#fff);color:var(--text-primary,#1f2937);border:1px solid var(--border-strong,#cbd5e1);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:4px;font-size:13px}
.spso{padding:6px 10px;border-radius:6px;cursor:pointer;white-space:nowrap}.spso.on{background:var(--bg-surface-hover,#eef2f7)}.spso.cur{font-weight:600}.spsn{padding:8px 10px;color:var(--text-muted,#6b7280)}`;
  document.head.appendChild(st);
  let t;const go=()=>{clearTimeout(t);t=setTimeout(spsRun,80)};
  new MutationObserver(go).observe(document.body,{childList:true,subtree:true});
  addEventListener("scroll",e=>{const p=document.querySelector(".spspop");if(p&&!p.contains(e.target))spsClose()},true);
  addEventListener("resize",spsClose);
})();
