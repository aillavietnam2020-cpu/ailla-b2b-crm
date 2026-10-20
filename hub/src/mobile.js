/* Giao diện điện thoại: chỉ chạy khi màn hình hẹp, không đổi gì ở máy tính. */
(function(){
  if(typeof window==="undefined"||!window.matchMedia)return;
  const narrow=window.matchMedia("(max-width:760px)");
  const fixScan=root=>{
    root.querySelectorAll('input[type=text],input:not([type]),input[type=search]').forEach(i=>{
      if(i.dataset.mfix)return;
      const k=((i.placeholder||"")+" "+(i.id||"")).toLowerCase();
      if(/quét|quet|scan|vận đơn|van don|mã vđ|barcode/.test(k)){
        i.dataset.mfix="1";
        i.setAttribute("autocapitalize","off");i.setAttribute("autocorrect","off");
        i.setAttribute("autocomplete","off");i.setAttribute("spellcheck","false");
        i.setAttribute("enterkeyhint","done");
        i.style.fontSize="18px";i.style.minHeight="52px";
      }
    });
  };
  const centerTabs=root=>{
    root.querySelectorAll(".settabs,.sxtabs,.modtabs,.kstab,.dptab,.dgtab").forEach(t=>{
      const on=t.querySelector(".on");
      if(on&&t.scrollWidth>t.clientWidth)t.scrollLeft=on.offsetLeft-(t.clientWidth-on.offsetWidth)/2;
    });
  };
  const run=()=>{if(!narrow.matches)return;const m=document.getElementById("main");if(m){fixScan(m);centerTabs(m)}};
  let t=0;
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(run,120)}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener("resize",()=>{clearTimeout(t);t=setTimeout(run,200)});
  run();
  if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("/sw.js").catch(()=>{});
})();

/* ===== Thanh 5 nút dưới đáy kiểu ứng dụng (chỉ điện thoại; tự đổi theo quyền từng người) ===== */
(function(){
  if(typeof window==="undefined"||!window.matchMedia)return;
  const narrow=window.matchMedia("(max-width:760px)");
  const IC={home:"M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",order:"M7 3h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6",plus:"M12 5v14M5 12h14",box:"M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",more:"M4 7h16M4 12h16M4 17h16",task:"M5 4h14v16H5zM9 9l2 2 4-4M9 15h6",user:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",chart:"M5 20V10M12 20V4M19 20v-7"};
  const svg=d=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const pagesOf=()=>{const out=[];try{visibleMods().forEach(mo=>modGroups(mo).forEach(g=>g[1].forEach(it=>out.push({id:it[0],t:it[1],mod:mo.k}))))}catch(e){}return out};
  const goPage=id=>{PAGE=id;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}MOD="";render();scrollTo(0,0);document.body.classList.remove("menu-open")};
  const CRMPAGES=["cr_rp","cr_kh","cr_dn","cr_cn","cr_ret","cr_gia","cr_im","cr_s_hn","cr_s_kh","cr_s_dn","cr_s_gia","cr_s_cn","cr_s_ret","cr_s_kq","cr_giagc","cr_bill","cr_rcv"];
  const newOrder=don=>{goPage(don);setTimeout(()=>{const f=document.getElementById("crmfr");if(f)f.src="/sales/orders/new"},60)};
  const build=()=>{
    const P=pagesOf(),has=id=>P.some(x=>x.id===id),first=ids=>ids.find(has);
    const items=[];
    const don=first(["cr_dn","cr_s_dn"]);
    const khach=first(["cr_kh","cr_s_kh"]);
    const crmHome=first(["cr_rp","cr_s_hn"]);
    const crmMode=CRMPAGES.includes(PAGE)&&!!crmHome;
    const mid=don?{k:"tao",t:"",ic:"plus",big:1,go:()=>newOrder(don),pages:[]}:null;
    if(crmMode){
      items.push({k:"home",t:"Trang chủ",ic:"home",go:()=>goPage(crmHome),pages:["cr_rp","cr_s_hn"]});
      if(don)items.push({k:"don",t:"Đơn hàng",ic:"order",go:()=>goPage(don),pages:["cr_dn","cr_s_dn"]});
      if(mid)items.push(mid);
      if(khach)items.push({k:"kh",t:"Khách hàng",ic:"user",go:()=>goPage(khach),pages:["cr_kh","cr_s_kh"]});
      items.push({k:"more",t:"Menu",ic:"more",go:()=>document.body.classList.add("menu-open"),pages:[]});
      return items;
    }
    const home=first(["exec","cv_tq","cr_s_hn","mkt_tq","sx_tq"])||(P[0]&&P[0].id);
    if(home)items.push({k:"home",t:"Trang chủ",ic:"home",go:()=>goPage(home),pages:[home]});
    if(don)items.push({k:"don",t:"Đơn hàng",ic:"order",go:()=>goPage(don),pages:["cr_dn","cr_s_dn"]});
    else if(khach)items.push({k:"kh",t:"Khách",ic:"user",go:()=>goPage(khach),pages:["cr_kh","cr_s_kh"]});
    if(mid)items.push(mid);
    const kho=first(["sx_kho","kho_ton","kho_hoan","sx_tq"]);
    const cv=first(["cv_nv","cv_tq","cv","congviec"]);
    if(kho&&kho!==home)items.push({k:"kho",t:"Kho",ic:"box",go:()=>goPage(kho),pages:["sx_kho","kho_ton","kho_hoan","kho_nhap","kho_nhap_tp","kho_xuat","kho_xuat_b2b","kho_online","kho_nxt","sx_tq"]});
    else if(cv&&cv!==home)items.push({k:"cv",t:"Việc",ic:"task",go:()=>goPage(cv),pages:["cv_tq","cv_nv","cv","congviec","cv_kb"]});
    if(items.length<4){visibleMods().forEach(mo=>{if(items.length>=4)return;const g=modGroups(mo)[0];const it=g&&g[1][0];if(!it||items.some(i=>i.pages.includes(it[0])))return;items.push({k:"m"+mo.k,t:(mo.n||it[1]).split(" ")[0],ic:"chart",go:()=>goPage(it[0]),pages:[it[0]]})})}
    items.push({k:"more",t:"Menu",ic:"more",go:()=>document.body.classList.add("menu-open"),pages:[]});
    return items.slice(0,5);
  };
  /* Hàng nút tròn thao tác nhanh ở đầu trang chủ (kiểu Poscake) */
  const QA_PAGES=["exec","cr_rp","cr_s_hn","cv_tq","mkt_tq","sx_tq"];
  const quick=()=>{
    const m=document.getElementById("main");
    if(!m||!narrow.matches){return}
    const old=document.getElementById("moqa");
    if(!QA_PAGES.includes(PAGE)){if(old)old.remove();return}
    if(old&&old.dataset.p===PAGE&&m.firstElementChild===old)return;
    if(old)old.remove();
    const P=pagesOf(),has=id=>P.some(x=>x.id===id),first=ids=>ids.find(has);
    const don=first(["cr_dn","cr_s_dn"]),ret=first(["kho_hoan"]),xuat=first(["kho_xuat_b2b","kho_xuat","sx_kho"]);
    const A=[];
    if(don)A.push(["Tạo đơn","plus",()=>newOrder(don)]);
    if(don)A.push(["Đơn hàng","order",()=>goPage(don)]);
    if(ret)A.push(["Hàng hoàn","box",()=>goPage(ret)]);
    if(xuat)A.push(["Xuất kho","box",()=>goPage(xuat)]);
    const cn=first(["cr_cn","cr_s_cn"]);if(cn)A.push(["Công nợ","chart",()=>goPage(cn)]);
    const cv=first(["cv_tq","cv_nv"]);if(cv&&A.length<4)A.push(["Việc","task",()=>goPage(cv)]);
    A.push(["Tất cả","more",()=>document.body.classList.add("menu-open")]);
    if(A.length<2)return;
    const d=document.createElement("div");d.id="moqa";d.dataset.p=PAGE;
    d.innerHTML=A.slice(0,5).map(a=>`<button type="button"><i>${svg(IC[a[1]])}</i><span>${a[0]}</span></button>`).join("");
    d.querySelectorAll("button").forEach((b,i)=>b.onclick=A[i][2]);
    m.insertBefore(d,m.firstChild);
  };
  let sig="";
  const paint=()=>{
    let bar=document.getElementById("mobtab");
    if(!narrow.matches||typeof ME==="undefined"||!ME||typeof visibleMods!=="function"||!document.getElementById("main")){if(bar)bar.remove();document.body.classList.remove("has-mobtab");return}
    let items;try{items=build()}catch(e){return}
    const act=items.find(i=>i.pages.includes(PAGE))||null;
    const s=items.map(i=>i.k).join()+"|"+(act?act.k:"")+"|"+PAGE;
    if(bar&&s===sig)return;
    sig=s;
    if(!bar){bar=document.createElement("nav");bar.id="mobtab";bar.setAttribute("aria-label","Điều hướng chính");document.body.appendChild(bar)}
    bar.innerHTML=items.map(i=>`<button type="button" data-k="${i.k}" class="${i.big?"big ":""}${act&&act.k===i.k?"on":""}">${svg(IC[i.ic])}<span>${i.t}</span></button>`).join("");
    bar.querySelectorAll("button").forEach((b,idx)=>b.onclick=()=>items[idx].go());
    document.body.classList.add("has-mobtab");
  };
  const paintAll=()=>{paint();try{quick()}catch(e){}};
  let t=0;
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(paintAll,100)}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener("resize",()=>{clearTimeout(t);t=setTimeout(paintAll,200)});
  paintAll();
})();
