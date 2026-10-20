/* =====================================================================
   CHỌN KHOẢNG THỜI GIAN dùng chung cho cả web (kiểu Pancake):
   bên trái các mốc nhanh (Hôm nay, Hôm qua, 7 ngày qua...), bên phải lịch hai tháng, bấm ngày đầu rồi ngày cuối,
   dưới cùng nút Đóng / Áp dụng.
   drpOpen(nút, {from,to,preset}, [[khóa,nhãn,()=>({from,to})]...], r=>{...})  r = {preset,from,to}
   ===================================================================== */
const DRP_WD=["T2","T3","T4","T5","T6","T7","CN"];
const drpIso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const drpParse=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const drpVn=s=>s?s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4):"";
function drpClose(){const o=document.getElementById("drp");if(o)o.remove();document.removeEventListener("mousedown",drpOutside,true);document.removeEventListener("keydown",drpKey,true)}
function drpOutside(e){const o=document.getElementById("drp");if(o&&!o.contains(e.target)&&!(DRP_ANCHOR&&DRP_ANCHOR.contains(e.target)))drpClose()}
function drpKey(e){if(e.key==="Escape")drpClose()}
let DRP_ANCHOR=null;
function drpOpen(anchor,cur,presets,onApply){
  if(document.getElementById("drp")){drpClose();return}
  DRP_ANCHOR=anchor;
  const today=drpIso(new Date());
  const st={from:cur&&cur.from||"",to:cur&&cur.to||"",preset:cur&&cur.preset||"",pick:0,hover:"",m:null};
  const base=st.from?drpParse(st.from):new Date();st.m=new Date(base.getFullYear(),base.getMonth(),1);
  const el=document.createElement("div");el.id="drp";el.className="drp";document.body.appendChild(el);
  const month=(first)=>{
    const y=first.getFullYear(),m=first.getMonth(),start=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();
    let cells="";
    for(let i=0;i<start;i++)cells+=`<span class="dd mu"></span>`;
    for(let d=1;d<=days;d++){
      const s=y+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
      let a=st.from,b=st.pick===1?(st.hover||st.from):st.to;if(a&&b&&a>b)[a,b]=[b,a];
      const inr=a&&b&&s>=a&&s<=b,edge=(s===a||s===b);
      cells+=`<button type="button" class="dd${inr?" in":""}${edge?" ed":""}${s===today?" td":""}" data-d="${s}">${d}</button>`}
    return `<div class="dm"><div class="dmh">Th ${m+1} ${y}</div><div class="dw">${DRP_WD.map(w=>`<span>${w}</span>`).join("")}</div><div class="dg">${cells}</div></div>`};
  const draw=()=>{
    const m2=new Date(st.m.getFullYear(),st.m.getMonth()+1,1);
    el.innerHTML=`<div class="drpl">${presets.map(([k,t])=>`<button type="button" data-p="${k}" class="${st.preset===k?"on":""}">${t}</button>`).join("")}</div>
    <div class="drpr"><div class="drpi"><span class="${st.pick===0&&!st.from?"f":""}">${st.from?drpVn(st.from):"Ngày bắt đầu"}</span><i>→</i><span>${st.to?drpVn(st.to):"Ngày kết thúc"}</span></div>
    <div class="drpn"><button type="button" data-n="-12">«</button><button type="button" data-n="-1">‹</button><span></span><button type="button" data-n="1">›</button><button type="button" data-n="12">»</button></div>
    <div class="drpm">${month(st.m)}${month(m2)}</div>
    <div class="drpf"><button type="button" class="btn sm" id="drp-x">Đóng</button><button type="button" class="btn sm pri" id="drp-ok">Áp dụng</button></div></div>`;
    el.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{const f=presets.find(x=>x[0]===b.dataset.p);if(!f)return;const r=f[2]();drpClose();onApply({preset:f[0],from:r.from,to:r.to})});
    el.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{st.m=new Date(st.m.getFullYear(),st.m.getMonth()+(+b.dataset.n),1);draw()});
    el.querySelectorAll("[data-d]").forEach(b=>{
      b.onclick=()=>{const s=b.dataset.d;st.preset="";if(st.pick===0||(st.from&&st.to&&st.pick===2)){st.from=s;st.to="";st.pick=1;st.hover=s}else{if(s<st.from){st.to=st.from;st.from=s}else st.to=s;st.pick=2}draw()};
      b.onmouseenter=()=>{if(st.pick===1){st.hover=b.dataset.d;paintHover()}}});
    el.querySelector("#drp-x").onclick=drpClose;
    el.querySelector("#drp-ok").onclick=()=>{if(!st.from){toast("Chọn ngày bắt đầu");return}const f=st.from,t=st.to||st.from;drpClose();onApply({preset:st.preset,from:f<=t?f:t,to:f<=t?t:f})};
    place()};
  const paintHover=()=>{let a=st.from,b=st.hover||st.from;if(a>b)[a,b]=[b,a];el.querySelectorAll("[data-d]").forEach(x=>{const s=x.dataset.d;x.classList.toggle("in",s>=a&&s<=b);x.classList.toggle("ed",s===a||s===b)})};
  const place=()=>{const r=anchor.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight;let left=Math.min(r.right-w,window.innerWidth-w-8);left=Math.max(8,left);let top=r.bottom+6;if(top+h>window.innerHeight-8)top=Math.max(8,window.innerHeight-h-8);el.style.left=left+"px";el.style.top=top+"px"};
  draw();
  setTimeout(()=>{document.addEventListener("mousedown",drpOutside,true);document.addEventListener("keydown",drpKey,true)},0);
}
