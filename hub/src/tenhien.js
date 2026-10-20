/* =====================================================================
   TÊN HIỂN THỊ (chỉ đổi chữ hiện ra trên màn hình, không đổi dữ liệu đang lưu)
   - TikTok Via 1  → Gia dụng AiBio
   - TikTok Via 2  → Ailla VN Store 2
   - Oanh          → Leader (trong khu Marketing; khu Nhân sự giữ nguyên tên thật)
   Dữ liệu và mã kênh bên trong vẫn là "TikTok Via 1", "TikTok Via 2" để không làm hỏng số liệu cũ.
   ===================================================================== */
const RL_MAP=[[/TikTok Via 1/g,"Gia dụng AiBio"],[/TikTok Via 2/g,"Ailla VN Store 2"],[/\bVia 1\b/g,"Gia dụng AiBio"],[/\bVia 2\b/g,"Ailla VN Store 2"]];
const RL_OANH=/\bOanh\b/g;
const rlHr=()=>{try{return (typeof MOD!=="undefined"&&MOD==="hr")||(typeof PAGE!=="undefined"&&/^(nhansu|hoso|hr|nv|luong|phongban)/.test(PAGE))}catch(e){return false}};
function relabelDom(root){
  const skipOanh=rlHr(),w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){
    const p=n.parentNode;if(!p||/^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(p.nodeName))continue;
    let t=n.nodeValue;if(!t||t.length<3)continue;let s=t;
    for(const [re,to] of RL_MAP)s=s.replace(re,to);
    if(!skipOanh)s=s.replace(RL_OANH,"Leader");
    if(s!==t)n.nodeValue=s
  }
}
let rlTimer=0;

/* Lớp chặn phụ: gỡ các thuộc tính chạy mã (onerror, onload, onmouseover…) và liên kết javascript: nếu lỡ lọt vào trang */
const RL_BAD="[onerror],[onload],[onmouseover],[onmouseenter],[onmouseout],[onfocus],[onblur],[ontoggle],[onanimationstart],[onpointerover],[onpointerenter],[onloadstart],[onbegin]";
function guardDom(root){
  try{
    if(root.nodeType===1&&root.matches&&root.matches(RL_BAD)){for(const a of [...root.attributes]){if(/^on(?!click$)/i.test(a.name))root.removeAttribute(a.name)}}
    root.querySelectorAll(RL_BAD).forEach(el=>{for(const a of [...el.attributes]){if(/^on(?!click$)/i.test(a.name))el.removeAttribute(a.name)}});
    root.querySelectorAll("a[href],area[href],form[action],iframe[src]").forEach(el=>{const k=el.hasAttribute("href")?"href":el.hasAttribute("action")?"action":"src",v=(el.getAttribute(k)||"").replace(/[\u0000-\u0020]/g,"").toLowerCase();if(v.startsWith("javascript:")||v.startsWith("data:text/html")||v.startsWith("vbscript:"))el.removeAttribute(k)});
  }catch(e){}
}
/* Gỡ ngay trong lúc nút vừa được chèn vào trang (trước khi trình duyệt kịp chạy onerror) */
const rlObs=new MutationObserver(recs=>{
  for(const r of recs)r.addedNodes.forEach(n=>{if(n.nodeType===1)guardDom(n)});
  if(!rlTimer)rlTimer=setTimeout(rlRun,60)});
function rlRun(){rlTimer=0;rlObs.disconnect();try{guardDom(document.body);relabelDom(document.body)}catch(e){console.warn("đổi tên hiển thị lỗi",e)}finally{rlObs.observe(document.body,{childList:true,subtree:true,characterData:true})}}
rlObs.observe(document.body,{childList:true,subtree:true,characterData:true});
rlRun();
