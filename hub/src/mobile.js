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
    root.querySelectorAll(".settabs,.sxtabs,.modtabs,.kstab,.dptab,.dgtab,.cwtabs").forEach(t=>{
      const on=t.querySelector(".on");
      if(on&&t.scrollWidth>t.clientWidth)t.scrollLeft=on.offsetLeft-(t.clientWidth-on.offsetWidth)/2;
    });
  };
  /* AI Agent: chữ gợi ý trong ô nhắn tin ngắn gọn để ô 1 dòng (kiểu Messenger) */
  const chatPh=()=>{const t=document.getElementById("ac-text");if(t&&!t.dataset.mph){t.dataset.mph="1";t.title=t.placeholder;t.placeholder="Nhắn tin…"}};
  const run=()=>{if(!narrow.matches)return;const m=document.getElementById("main");if(m){fixScan(m);centerTabs(m);chatPh()}};
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
  const IC={home:"M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",order:"M7 3h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6",plus:"M12 5v14M5 12h14",box:"M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",more:"M4 7h16M4 12h16M4 17h16",task:"M5 4h14v16H5zM9 9l2 2 4-4M9 15h6",user:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",chart:"M5 20V10M12 20V4M19 20v-7",money:"M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",flask:"M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.5-2.5L14 9V3M7 15h10",spark:"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"};
  /* Ghi nhanh (nút + giữa thanh dưới): đúng danh sách và quyền của "Ghi nhanh" có sẵn trên web (khonhanh.js KQ_LIST) */
  const quickList=()=>{const L=[];try{if(typeof KQ_LIST==="function")KQ_LIST().forEach(x=>L.push([x[0],()=>kqRun(x)]))}catch(e){}
    try{const P=pagesOf(),don=["cr_dn","cr_s_dn"].find(id=>P.some(x=>x.id===id));if(don&&!isCEO())L.unshift(["Tạo đơn hàng",()=>newOrder(don)])}catch(e){}
    return L};
  const openQuick=()=>{
    const L=quickList();if(!L.length)return;
    let bg=document.getElementById("moqs");if(bg)bg.remove();
    bg=document.createElement("div");bg.id="moqs";
    bg.innerHTML=`<div class="qs"><div class="grab"></div><b>Ghi nhanh</b>${L.map((x,i)=>`<button type="button" data-i="${i}">${svg(IC.plus)}<span>${x[0]}</span></button>`).join("")}</div>`;
    bg.onclick=e=>{if(e.target===bg)bg.remove()};
    bg.querySelectorAll("button[data-i]").forEach(b=>b.onclick=()=>{bg.remove();L[+b.dataset.i][1]()});
    document.body.appendChild(bg);
  };
  /* Lập phiếu chi: đúng quyền như nút "Lập phiếu chi" có sẵn trên web (khonhanh.js KQ_CHI) */
  const canChi=()=>{try{return typeof KQ_CHI==="function"&&KQ_CHI()&&typeof spForm==="function"}catch(e){return false}};
  const newChi=()=>{document.body.classList.remove("menu-open");try{spForm()}catch(e){if(typeof toast==="function")toast(e.message||"Chưa mở được phiếu chi")}};
  const isCEO=()=>typeof ME!=="undefined"&&ME&&ME.role==="admin";
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
    /* Chỉ người chỉ làm Kênh phân phối (không có trang tổng quan chung) mới đổi thanh dưới sang kiểu CRM.
       CEO, quản lý: Trang chủ luôn về tổng quan của mình (chị Hoa 05/11). */
    const ownHome=first(["exec","cv_tq","mkt_tq","sx_tq"]);
    const crmMode=CRMPAGES.includes(PAGE)&&!!crmHome&&!ownHome;
    /* nút + giữa: CEO là Lập phiếu chi (chị Hoa 05/11 không cần tạo đơn); người bán là Tạo đơn */
    const chi=canChi();
    const mid=(chi&&(isCEO()||!don))?{k:"chi",t:"",ic:"plus",big:1,go:newChi,pages:[]}:don?{k:"tao",t:"",ic:"plus",big:1,go:()=>newOrder(don),pages:[]}:null;
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
    /* Chị Hoa 05/11: Trang chủ · Việc · dấu + (Ghi nhanh) · AI Agent · Menu. Mỗi nút chỉ hiện khi người đó có quyền mở trang
       (lấy từ menu đã lọc quyền); thiếu nút nào thì thay bằng Đơn hàng / Kho / Khách theo quyền. */
    const kho=first(["kho_ton_tp","sx_kho","kho_ton","kho_hoan","sx_tq"]);
    const cv=first(["cv_v","cv_nv","cv_tq","cv","congviec"]);
    const agent=first(["agentchat"]);
    const KHOP=["sx_kho","kho_ton","kho_ton_tp","kho_kk","kho_xuat_tp","kho_hoan","kho_nhap","kho_nhap_tp","kho_xuat","kho_xuat_b2b","kho_online","kho_nxt","sx_tq"];
    const alt=[];
    if(don)alt.push({k:"don",t:"Đơn hàng",ic:"order",go:()=>goPage(don),pages:["cr_dn","cr_s_dn"]});
    if(kho&&kho!==home)alt.push({k:"kho",t:"Kho",ic:"box",go:()=>goPage(kho),pages:KHOP});
    if(khach)alt.push({k:"kh",t:"Khách",ic:"user",go:()=>goPage(khach),pages:["cr_kh","cr_s_kh"]});
    const cvIt={k:"cv",t:"Công việc",ic:"task",go:()=>goPage(cv),pages:["cv_v","cv_tq","cv_nv","cv","congviec","cv_kb"]};
    if(isCEO()){
      /* CEO (chị Hoa 05/11): Trang chủ · Công việc · + Ghi nhanh · AI Agent · Menu */
      if(cv&&cv!==home)items.push(cvIt);else if(alt.length)items.push(alt.shift());
      const gn=quickList();
      const plus=gn.length?{k:"gn",t:"",ic:"plus",big:1,go:openQuick,pages:[]}:mid;
      if(plus)items.push(plus);
      if(agent)items.push({k:"agent",t:"AI Agent",ic:"spark",go:()=>goPage(agent),pages:["agentchat","hoithoaiagent","huanluyenagent"]});
      else if(alt.length)items.push(alt.shift());
    }else{
      /* Nhân viên (chị Hoa 06/11, duyệt demo kỹ thuật): Trang chủ · việc chính của vai trò · Công việc · Cá nhân · Menu, không có dấu + */
      const kt=has("kho_pc")&&(()=>{try{return can(ME,"sx.kythuat")}catch(e){return false}})();
      if(kt)items.push({k:"pc",t:"Pha chế",ic:"flask",go:()=>goPage("kho_pc"),pages:["kho_pc"]});
      else if(alt.length)items.push(alt.shift());
      if(cv&&cv!==home)items.push(cvIt);else if(alt.length)items.push(alt.shift());
      items.push({k:"canhan",t:"Cá nhân",ic:"user",go:()=>goPage("canhan"),pages:["canhan","cc_toi","np_toi","tu_toi","pl_toi","hr_kpime","thongbao","matkhau","anhdaidien"]});
    }
    if(items.length<4){visibleMods().forEach(mo=>{if(items.length>=4)return;const g=modGroups(mo)[0];const it=g&&g[1][0];if(!it||items.some(i=>i.pages.includes(it[0])))return;items.push({k:"m"+mo.k,t:(mo.n||it[1]).split(" ")[0],ic:"chart",go:()=>goPage(it[0]),pages:[it[0]]})})}
    items.push({k:"more",t:"Menu",ic:"more",go:()=>document.body.classList.add("menu-open"),pages:[]});
    return items.slice(0,5);
  };
  /* Hàng nút tròn thao tác nhanh ở đầu trang chủ (kiểu Poscake) */
  /* Chị Hoa 05/11: bỏ hàng nút tròn ở mọi trang, đã có thanh menu dưới (Ghi nhanh ở nút +). Để trống là không hiện ở trang nào. */
  const QA_PAGES=[];
  const quick=()=>{
    const m=document.getElementById("main");
    if(!m||!narrow.matches){return}
    const old=document.getElementById("moqa");
    if(!QA_PAGES.includes(PAGE)){if(old)old.remove();return}
    if(old&&old.dataset.p===PAGE&&m.firstElementChild===old)return;
    if(old)old.remove();
    const P=pagesOf(),has=id=>P.some(x=>x.id===id),first=ids=>ids.find(has);
    const don=first(["cr_dn","cr_s_dn"]),ret=first(["kho_hoan"]),xuat=first(["kho_xuat_b2b","kho_xuat","sx_kho"]);
    /* Chỉ trang người đó có quyền mở; lấy 4 nút theo thứ tự ưu tiên việc hằng ngày, nút thứ 5 luôn là Tất cả */
    const A=[];
    if(has("cc_toi"))A.push(["Chấm công","user",()=>goPage("cc_toi")]); // chấm công trên điện thoại (chamcong.js)
    const cv=first(["cv_v","cv_nv","cv_tq"]);if(cv&&cv!==PAGE)A.push(["Công việc","task",()=>goPage(cv)]);
    const chi=canChi();
    if(chi&&isCEO())A.push(["Phiếu chi","money",newChi]);
    else if(don)A.push(["Tạo đơn","plus",()=>newOrder(don)]);
    if(chi&&!isCEO())A.push(["Phiếu chi","money",newChi]);
    const ton=first(["kho_ton_tp","kho_ton"]);if(ton)A.push(["Tồn kho","box",()=>goPage(ton)]);
    if(ret)A.push(["Hàng hoàn","box",()=>goPage(ret)]);
    if(don)A.push(["Đơn hàng","order",()=>goPage(don)]);
    if(xuat)A.push(["Xuất kho","box",()=>goPage(xuat)]);
    const cn=first(["cr_cn","cr_s_cn"]);if(cn)A.push(["Công nợ","chart",()=>goPage(cn)]);
    if(A.length<1)return;
    const B=A.slice(0,4);B.push(["Tất cả","more",()=>document.body.classList.add("menu-open")]);
    const d=document.createElement("div");d.id="moqa";d.dataset.p=PAGE;
    d.innerHTML=B.map(a=>`<button type="button"><i>${svg(IC[a[1]])}</i><span>${a[0]}</span></button>`).join("");
    d.querySelectorAll("button").forEach((b,i)=>b.onclick=B[i][2]);
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

/* ===== Điện thoại: bảng nhiều cột thành danh sách (mỗi dòng 1 hàng: tên + số chính bên phải), ô số cần chú ý lên đầu ===== */
(function(){
  if(typeof window==="undefined"||!window.matchMedia)return;
  const narrow=window.matchMedia("(max-width:760px)");
  const TITLE=/^(tên|tên hàng|tên sản phẩm|sản phẩm|mặt hàng|hàng hóa|khách hàng|khách|tên khách|nhà cung cấp|nội dung|diễn giải|việc|công việc|tên việc|nhân viên|họ tên|họ và tên|tiêu đề|combo|kênh)(?=\s|$|\()/i;
  const KEY=/^(tồn kho|tồn|tồn cuối|tồn cuối kỳ|còn lại|còn|số lượng|sl|thành tiền|tổng tiền|tổng cộng|tổng|doanh thu|doanh số|số tiền|công nợ|còn nợ|phải thu|giá trị|lãi)(?=\s|$|\()/i;
  const txt=el=>(el.textContent||"").replace(/\s+/g," ").trim();
  const list=root=>{
    root.querySelectorAll("table").forEach(t=>{
      if(t.dataset.ml||t.closest(".edit,.sheet,.nomlist,.mlist")||t.classList.contains("nomlist"))return;
      if(!t.offsetWidth)return; // đang ẩn: để lần sau
      t.dataset.ml="0";
      const box=t.parentElement;if(!box||(t.offsetWidth<=box.clientWidth+4&&t.scrollWidth<=t.clientWidth+4))return; // vừa màn hình: giữ bảng
      const hr=t.tHead&&t.tHead.rows[0];if(!hr||!t.tBodies[0])return;
      const H=[...hr.cells].map(txt);
      if(H.length<4||H.length>10||[...hr.cells].some(c=>c.colSpan>1))return;
      const r0=t.tBodies[0].rows[0];if(!r0)return;
      if([...r0.cells].filter(c=>c.querySelector("input:not([type=checkbox]),select,textarea")).length>1)return; // bảng nhập liệu nhiều ô: giữ nguyên
      /* bước 1: giữ dạng bảng, thu gọn chữ và bỏ cột trống; vừa màn hình thì dừng ở đây */
      const BR=[...t.tBodies[0].rows].filter(r=>r.cells.length===H.length);
      const emp=c=>{const v=txt(c);return (!v||v==="—"||v==="-")&&!c.querySelector("button,input,img,svg")};
      H.forEach((h,i)=>{if(BR.length&&BR.every(r=>emp(r.cells[i]))){hr.cells[i].classList.add("ml-x");BR.forEach(r=>r.cells[i].classList.add("ml-x"))}});
      H.forEach((h,i)=>{if(/^(xu hướng|biểu đồ)/i.test(h)){hr.cells[i].classList.add("ml-x");BR.forEach(r=>r.cells[i].classList.add("ml-x"))}}); // điện thoại: bỏ biểu đồ nhỏ (chị Hoa 05/11)
      if(/^kênh$/i.test(H[0]))t.classList.add("ml-kenh"); // bảng kênh: ẩn nhãn "Đang giảm"… để mỗi kênh 1 dòng; cột Kỳ trước đã báo tăng giảm
      t.classList.add("mfit");
      if(t.offsetWidth<=box.clientWidth+4&&t.scrollWidth<=t.clientWidth+4){t.dataset.ml="fit";return}
      let ti=H.findIndex(h=>TITLE.test(h));if(ti<0)ti=0;
      const ki=H.findIndex((h,i)=>i!==ti&&KEY.test(h));
      t.classList.add("mlist");if(ki<0)t.classList.add("ml-nok");t.dataset.ml="1";
      [...t.tBodies[0].rows].forEach(r=>{
        if(r.cells.length!==H.length){r.classList.add("ml-full");return}
        [...r.cells].forEach((c,i)=>{
          const v=txt(c),hasBtn=!!c.querySelector("button,a.btn");
          if(i===ti)c.classList.add("ml-t");
          else if(i===ki){c.classList.add("ml-k");c.dataset.l=H[i];if(/^[-−]\d/.test(v))c.classList.add("ml-neg")}
          else if(!H[i]&&hasBtn)c.classList.add("ml-a");
          else if(i===0&&ti>0)c.classList.add("ml-c");
          else{c.classList.add("ml-o");if(H[i])c.dataset.l=H[i];if(v.length>26&&!c.querySelector("svg,input"))c.classList.add("ml-w")}
          if(!v&&!c.querySelector("button,input,img,svg")||v==="—"||v==="-")c.classList.add("ml-e");
        });
        const O=[...r.cells].filter(c=>c.classList.contains("ml-o"));
        if(O.length&&O.every(c=>c.classList.contains("ml-e")))r.classList.add("ml-noo"); // dòng không có số phụ: không chừa hàng trống
      });
      /* cột trống ở mọi dòng: bỏ hẳn, không chừa chỗ */
      const R=[...t.tBodies[0].rows].filter(r=>!r.classList.contains("ml-full"));
      H.forEach((h,i)=>{if(R.length&&R.every(r=>r.cells[i].classList.contains("ml-e")))R.forEach(r=>r.cells[i].classList.add("ml-x"))});
    });
  };
  /* ô số: ô báo đỏ có số khác 0 lên đầu, rộng cả hàng; ô bằng 0 xuống cuối */
  const kpis=root=>{
    root.querySelectorAll(".kpis").forEach(g=>{
      if(g.dataset.mk)return;g.dataset.mk="1";
      const K=[...g.children].filter(x=>x.classList.contains("kpi"));if(K.length<3)return;
      const lab=x=>((x.querySelector(".l")||{}).textContent||"").toLowerCase();
      const hot=K.filter(x=>!x.classList.contains("mut")&&(x.classList.contains("t-red")||/âm|quá hạn|trễ|cảnh báo|nguy hiểm|lệch/.test(lab(x))));
      hot.reverse().forEach(x=>{x.classList.add("mkey");g.insertBefore(x,g.firstChild)});
      K.filter(x=>x.classList.contains("mut")).forEach(x=>g.appendChild(x));
    });
    /* ô số trang tổng quan: ô chưa có số (—, 0) xuống cuối để ô có việc cần xử lý lên trước */
    root.querySelectorAll(".xkstrip").forEach(g=>{
      if(g.dataset.mk)return;g.dataset.mk="1";
      const K=[...g.children].filter(x=>x.classList.contains("xk"));if(K.length<3)return;
      K.filter(x=>{const v=((x.querySelector(".xkv")||{}).textContent||"").trim();return !v||v==="—"||v==="-"||/^0([.,]0+)?(đ|tr)?$/.test(v)}).forEach(x=>{x.classList.add("mut");g.appendChild(x)});
    });
  };
  const run=()=>{if(!narrow.matches)return;const m=document.getElementById("main");if(m){try{list(m);kpis(m)}catch(e){}}};
  let t=0;
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(run,130)}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener("resize",()=>{clearTimeout(t);t=setTimeout(run,220)});
  run();
})();

/* ===== Điện thoại: thông báo mỗi tin 2 dòng rồi "…"; bấm lần 1 xem đủ, bấm lần 2 mới mở việc (chị Hoa 05/11) ===== */
(function(){
  if(typeof window==="undefined"||!window.matchMedia)return;
  const narrow=window.matchMedia("(max-width:760px)");
  document.addEventListener("click",e=>{
    if(!narrow.matches)return;
    const b=e.target.closest&&e.target.closest(".nti");if(!b)return;
    const sp=b.querySelector("span");if(!sp)return;
    const cut=sp.scrollHeight>sp.clientHeight+2;
    if(b.classList.contains("open")||!cut)return; // đã mở hoặc vốn ngắn: để web mở việc như cũ
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    b.classList.add("open");
  },true);
})();

/* ===== Điện thoại: mở lại trang từ nền (Safari giữ trang cũ) thì tự hỏi máy chủ có bản mới không, có thì tự tải lại.
   Không tải lại khi chị đang gõ dở (ô nhập có chữ) — lúc đó vẫn hiện nút "Tải lại ngay" như cũ. ===== */
(function(){
  if(typeof window==="undefined"||!window.matchMedia)return;
  let busy=false;
  const editing=()=>{if(typeof svTyping==="function"&&svTyping())return true;const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&(a.value||"").length>0)return true;
    return [...document.querySelectorAll("textarea")].some(t=>(t.value||"").trim().length>2)};
  const check=async()=>{
    if(busy||document.hidden||typeof BUILD_ID==="undefined")return;busy=true;
    try{const j=await fetch("/hub/build",{cache:"no-store",credentials:"same-origin"}).then(r=>r.json());
      if(j&&j.build&&j.build!==BUILD_ID&&!editing()){
        const k="mob_reload_"+j.build;try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1")}catch(e){}
        location.reload()}}catch(e){}finally{busy=false}};
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)setTimeout(check,400)});
  window.addEventListener("pageshow",e=>{if(e.persisted)setTimeout(check,400)});
})();

/* ===== Điện thoại: giữ thanh dưới sát đáy màn hình thật.
   Safari iPhone đôi khi "nhớ" chiều cao lúc còn bàn phím (khoảng 300px) dù bàn phím đã tắt, nên thanh dán-cố-định lơ lửng giữa màn hình.
   Cách xử lý: khi KHÔNG có ô nhập nào đang mở mà vùng nhìn thấy ngắn hơn khung trang thì (1) nhích cuộn 1px để Safari tính lại, (2) kéo thanh xuống đáy bằng chiều cao khung trang. ===== */
(function(){
  if(typeof window==="undefined"||!window.matchMedia)return;
  const narrow=window.matchMedia("(max-width:760px)");
  let dy=0,t=0,raf=0,lastNudge=0,note=null;
  const typing=()=>{const a=document.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&!/^(checkbox|radio|button|submit)$/.test(a.type||""))};
  const say=txt=>{ // chỉ cho chị Hoa (CEO) thấy 1 dòng nhỏ 6 giây khi thanh được chỉnh lại, để biết bản sửa có chạy
    try{if(typeof ME==="undefined"||!ME||ME.role!=="admin")return}catch(e){return}
    if(!note){note=document.createElement("div");note.style.cssText="position:fixed;left:8px;top:calc(env(safe-area-inset-top) + 2px);z-index:9999;font:10px/1.2 monospace;background:rgba(0,0,0,.65);color:#fff;padding:2px 6px;border-radius:6px;pointer-events:none";document.body.appendChild(note)}
    note.textContent=txt;note.hidden=false;clearTimeout(note._t);note._t=setTimeout(()=>{note.hidden=true},6000)};
  const reflow=()=>{const bar=document.getElementById("mobtab");if(!bar)return;bar.style.display="none";void bar.offsetHeight;bar.style.display=""};
  const fix=(nudge)=>{
    raf=0;
    const bar=document.getElementById("mobtab");
    if(!bar||!narrow.matches||document.hidden)return;
    if(!bar.offsetHeight||getComputedStyle(bar).display==="none"){if(dy){dy=0;bar.style.transform=""}return} // thanh đang ẩn (mở menu, xem phiếu): không đo
    const v=window.visualViewport;
    if(v&&v.scale>1.05)return; // đang phóng to bằng 2 ngón: để yên
    const ih=window.innerHeight,ch=document.documentElement.clientHeight,vh=v?v.height+v.offsetTop:ih;
    const r=bar.getBoundingClientRect();
    const natural=r.bottom-dy;                       // đáy thanh nếu không kéo
    const frame=Math.max(ih,ch);                     // chiều cao khung trang (không bị ảnh hưởng bởi "nhớ bàn phím")
    const stale=!typing()&&natural<frame-24;         // không gõ gì mà thanh vẫn cao hơn đáy khung → đang lơ lửng
    if(stale){
      const now=Date.now();
      if(nudge!==false&&now-lastNudge>2500){lastNudge=now;const y=window.scrollY;window.scrollTo(window.scrollX,y+1);window.scrollTo(window.scrollX,y);reflow()}
      const r2=bar.getBoundingClientRect(),nat2=r2.bottom-dy;
      const want=Math.max(frame,vh);
      const diff=Math.round(want-nat2);
      if(diff>2){if(diff!==dy)say("chỉnh thanh dưới +"+diff+" ih="+ih+" vv="+Math.round(vh));dy=diff;bar.style.transform="translate3d(0,"+dy+"px,0)"}
      else if(dy!==0){dy=0;bar.style.transform=""}
    }else if(dy!==0&&!typing()){dy=0;bar.style.transform=""}
  };
  const soon=ms=>{clearTimeout(t);t=setTimeout(()=>fix(),ms||120)};
  const sched=()=>{if(!raf)raf=requestAnimationFrame(()=>fix(false))};
  if(window.visualViewport){visualViewport.addEventListener("resize",()=>soon(80));visualViewport.addEventListener("scroll",sched)}
  window.addEventListener("scroll",sched,{passive:true});
  window.addEventListener("resize",()=>soon(150));
  window.addEventListener("orientationchange",()=>soon(400));
  document.addEventListener("focusout",()=>{soon(200);setTimeout(()=>fix(),700);setTimeout(()=>fix(),1500)},true); // sau khi đóng bàn phím
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)soon(200)});
  window.addEventListener("pageshow",()=>soon(200));
  document.addEventListener("touchend",()=>{setTimeout(()=>fix(false),250);setTimeout(()=>fix(false),900)},{passive:true});
  setInterval(()=>fix(),1500); // lưới an toàn
  setTimeout(()=>fix(),600);
})();

/* ===== Trang "Cá nhân" (điện thoại): gom mục "Của tôi" — chấm công, nghỉ phép, tạm ứng, phiếu lương, KPI… Mọi tài khoản đều có, chỉ xem của chính mình. ===== */
(function(){
  if(typeof PAGES==="undefined")return;
  if(typeof NAV_AN_MO!=="undefined")NAV_AN_MO.add("canhan"); // trang ẩn khỏi menu trái nhưng mở được (không bị đẩy về trang chủ)
  PAGES.canhan=function(m){
    let L=[];
    try{const me=MODULES.find(x=>x.k==="me");if(me)me.groups().forEach(g=>g[1].forEach(it=>{if(!it[2]||it[2](ME))L.push(it)}))}catch(e){}
    if(PAGES.cc_toi&&!L.some(i=>i[0]==="cc_toi"))L.unshift(["cc_toi","Chấm công"]);
    L=L.filter(i=>PAGES[i[0]]&&i[0]!=="canhan");
    const sub={cc_toi:"Chấm vào / ra, bảng công tháng",np_toi:"Xin nghỉ, về sớm, tăng ca · phép còn",tu_toi:"Xin tạm ứng dưới 3 triệu",pl_toi:"Phiếu lương của tôi",hr_kpime:"Chỉ tiêu tháng của tôi"};
    const nm=(typeof ME!=="undefined"&&ME&&(ME.name||ME.email))||"";
    m.innerHTML=(typeof H==="function"?H("Cá nhân"):"<div class=\"ph\"><h1>Cá nhân</h1></div>")+
      `<section class="card"><div style="display:flex;gap:10px;align-items:center"><span style="width:40px;height:40px;border-radius:50%;background:#e7357b;color:#fff;display:grid;place-items:center;font-weight:700">${esc((nm||"?").trim().charAt(0).toUpperCase())}</span><div style="min-width:0"><b style="display:block">${esc(nm)}</b><small class="hint">Chỉ xem được thông tin của chính mình</small></div></div></section>`+
      `<section class="card"><div class="cnl">${L.map(i=>`<button type="button" class="cni" data-cn="${esc(i[0])}"><span><b>${esc(i[1])}</b>${sub[i[0]]?`<small>${sub[i[0]]}</small>`:""}</span><i>›</i></button>`).join("")}</div></section>`;
    m.querySelectorAll("[data-cn]").forEach(b=>b.onclick=()=>{MOD="me";PAGE=b.dataset.cn;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)}); /* như menu ảnh đại diện: mục Của tôi */
  };
})();

/* ===== Điện thoại: xem / in / tải phiếu kho (phiếu pha chế, phiếu sản xuất, phiếu nhập xuất…) — chị Hoa 07/11.
   Máy tính giữ như cũ (mở trang A4 rồi in). Điện thoại: mở màn xem phiếu ngay trong web, chữ to, mỗi dòng hàng thành 1 thẻ;
   thanh trên có "Tải về máy" (lưu file phiếu để mở lại trên điện thoại) và "In / lưu PDF". ===== */
(function(){
  if(typeof window==="undefined"||!window.matchMedia||typeof khoShowPrint!=="function")return;
  const narrow=window.matchMedia("(max-width:760px)");
  /* Bản rút gọn trên màn điện thoại (chị Hoa 07/11): mỗi dòng hàng 2 dòng — tên đậm + số chính (kèm đơn vị) bên phải; dòng nhỏ mã · định mức;
     thực tế / chênh lệch chỉ hiện khi có số. Chỉ áp cho màn hình hẹp; in A4 / PDF vẫn đủ cột như cũ (không đổi chữ trong phiếu, chỉ thêm thuộc tính). */
  const MCSS="<style id=\"mpvcss\">@media screen and (max-width:760px){html{background:#fff!important}body{max-width:none!important;margin:0!important;padding:10px 10px 24px!important;box-shadow:none!important;font-size:14px!important}"+
    ".top{gap:8px!important;padding-bottom:6px!important;border-bottom-width:2px!important}.top img{height:28px!important}.co b{font-size:10px!important}.co span{display:none}.no b{font-size:12.5px!important}.no span{font-size:10px!important}"+
    "h1{font-size:16px!important;margin:8px 0 2px!important}.st{margin:0 0 8px!important}.st i{font-size:10.5px!important}"+
    ".meta{grid-template-columns:1fr!important;margin-bottom:10px!important}.meta div{padding:4px 10px!important;font-size:13px}.meta label{min-width:0!important;flex:1}.meta b{text-align:right}"+
    "table,thead,tbody,tfoot{display:block!important;width:auto!important}thead{display:none!important}"+
    "tbody tr,tfoot tr{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:1px 10px;border:0;border-bottom:1px solid #e4e8f5;padding:8px 2px;background:none!important}"+
    "tbody tr td,tfoot tr td{display:none!important;border:0!important;padding:0!important;background:none!important;height:auto!important;min-height:0!important;min-width:0!important}"+
    "td[data-k=nm]{display:block!important;grid-column:1;grid-row:1;font-weight:700;font-size:14px}"+
    "td[data-k=q]{display:block!important;grid-column:2;grid-row:1;font-weight:700;text-align:right!important;white-space:nowrap}"+
    "td[data-k=q]::after,td[data-k=tt]::after{content:\" \" attr(data-u);font-weight:400;color:#667085;font-size:12px}"+
    "td[data-k=ma]{display:block!important;grid-column:1/-1;grid-row:2;font-size:11.5px;color:#667085}td[data-k=ma]::after{content:attr(data-dm)}"+
    "td[data-k=tt].v,td[data-k=cl].v{display:block!important;grid-row:3;font-size:12.5px}td[data-k=tt].v{grid-column:1}td[data-k=cl].v{grid-column:2;text-align:right!important}"+
    "td[data-k=tt].v::before{content:\"Thực tế \";color:#667085}td[data-k=cl].v::before{content:\"Lệch \";color:#667085}"+
    "td[data-k=gc].v{display:block!important;grid-column:1/-1;font-size:12px;color:#667085}"+
    "tr.pr{background:#fff0f6!important;border-radius:8px;padding:8px!important}tr.lech td[data-k=cl]{color:#b54708;font-weight:700}"+
    "tfoot tr td.n{display:block!important;grid-column:2;font-weight:700}"+
    "tr.em{display:none!important}"+".note,.can{font-size:13px}.sig{display:none!important}.foot{margin-top:10px!important}}</style>";
  const label=doc=>{doc.querySelectorAll("table").forEach(t=>{const hr=t.tHead&&t.tHead.rows[0];if(!hr)return;const H=[...hr.cells].map(c=>c.textContent.trim());
    const K={"Tên hàng":"nm","Nguyên vật liệu":"nm","Sản phẩm":"nm","Tên":"nm","Mã hàng":"ma","Mã":"ma","Định lượng":"q","Số lượng":"q","Cần dùng":"q","Thực tế":"tt","Chênh lệch":"cl","Ghi chú":"gc","ĐVT":"u","Định mức":"dm"};
    const hasDl=H.includes("Định lượng");
    [...t.querySelectorAll("tbody tr,tfoot tr")].forEach(r=>{let i=0;const C={};[...r.cells].forEach(c=>{const h=H[i]||"";c.setAttribute("data-l",h);let k=K[h]||"";if(k==="q"&&h==="Số lượng"&&hasDl)k="";if(k){c.setAttribute("data-k",k);C[k]=c}i+=c.colSpan||1});
      const u=C.u?C.u.textContent.trim():"";const val=c=>{const v=(c&&c.textContent||"").trim();return v&&v!=="—"&&v!=="-"};
      if(C.q)C.q.setAttribute("data-u",u);if(C.tt)C.tt.setAttribute("data-u",u);
      if(C.ma&&C.dm&&val(C.dm))C.ma.setAttribute("data-dm"," · định mức "+C.dm.textContent.trim()+(hasDl?"/lít":""));
      ["tt","cl","gc"].forEach(k=>{if(C[k]&&val(C[k])&&!C[k].classList.contains("fill"))C[k].classList.add("v")});
      if(!C.nm||!(C.nm.textContent||"").trim())r.classList.add("em"); // dòng trống để ghi tay: ẩn trên màn điện thoại
      if(!C.q&&C.nm){const q=[...r.cells].find(c=>c.classList.contains("n")&&val(c));if(q){q.setAttribute("data-k","q");q.setAttribute("data-u",u)}}
    })})};
  const nameOf=html=>{const m=/<title>([^<]*)<\/title>/i.exec(html);return ((m&&m[1])||"phieu").replace(/[\\/:*?"<>|]+/g,"-").trim()||"phieu"};
  const close=()=>{const o=document.getElementById("mpv");if(o)o.remove();document.body.classList.remove("mpv-open")};
  function view(html){
    const h2=/<\/head>/i.test(html)?html.replace(/<\/head>/i,MCSS+"</head>"):MCSS+html;
    close();
    const o=document.createElement("div");o.id="mpv";
    o.innerHTML=`<div class="mpvbar"><button type="button" data-a="x" aria-label="Đóng">✕</button><b>${esc(nameOf(html))}</b><button type="button" data-a="dl">Tải về máy</button><button type="button" data-a="pr">In / PDF</button></div><iframe title="Phiếu"></iframe>`;
    document.body.appendChild(o);document.body.classList.add("mpv-open");
    const f=o.querySelector("iframe");
    f.onload=()=>{try{label(f.contentDocument)}catch(e){}};
    f.srcdoc=h2;
    o.querySelector("[data-a=x]").onclick=close;
    o.querySelector("[data-a=pr]").onclick=()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){toast("Chưa in được, thử bấm lại")}};
    o.querySelector("[data-a=dl]").onclick=()=>{
      let out=h2;try{label(f.contentDocument);out="<!doctype html>\n"+f.contentDocument.documentElement.outerHTML}catch(e){}
      try{const b=new Blob([out],{type:"text/html;charset=utf-8"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=nameOf(html)+".html";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},4000);toast("Đã tải phiếu về máy. Mở trong mục Tệp / Tải về để xem.")}catch(e){toast("Chưa tải được, thử lại")}
    };
  }
  const orig=khoShowPrint;
  khoShowPrint=function(html){if(!narrow.matches)return orig(html);view(html)};
})();
/* Phiếu pha chế trên điện thoại: hiện tên bán thành phẩm dưới ô mã (ô chỉ hiện mã, khó nhận ra) */
(function(){
  if(typeof window==="undefined"||!window.matchMedia)return;
  const narrow=window.matchMedia("(max-width:760px)");
  const fix=()=>{if(!narrow.matches)return;const b=document.getElementById("kf-btp");if(!b)return;
    let n=document.getElementById("kf-btpnm");const c=b.dataset.code||b.value;const it=(typeof KHO!=="undefined"&&KHO.items&&KHO.items.get(c))||null;
    const t=it?it.name:"";if(!n){n=document.createElement("small");n.id="kf-btpnm";n.className="hint";n.style.cssText="display:block;margin-top:3px;font-weight:600;color:var(--ink)";b.insertAdjacentElement("afterend",n)}
    if(n.textContent!==t)n.textContent=t};
  let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(fix,150)}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener("input",e=>{if(e.target&&e.target.id==="kf-btp")setTimeout(fix,200)},true);
})();
/* Ailla Chat (chị Hoa duyệt demo 08/11): địa chỉ /chat/ mở thẳng Tin nhắn toàn màn hình như Messenger, có biểu tượng riêng ngoài màn hình chính (không lên store).
   Trên web vanhanh ở điện thoại: bấm 💬 hay mở Tin nhắn thì sang /chat/ (Android đã cài thì mở trong ứng dụng). */
(function(){
  if(typeof window==="undefined"||!window.matchMedia)return;
  const narrow=window.matchMedia("(max-width:760px)");
  const standalone=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
  /* chữ gợi ý ngắn như Messenger: chữ dài làm ô nhập cao 5 dòng trên điện thoại */
  const ph=()=>{if(!narrow.matches)return;const i=document.getElementById("tnin");if(i&&i.placeholder!=="Nhắn tin"){i.placeholder="Nhắn tin";i.style.height="auto";i.style.height=Math.min(i.scrollHeight,140)+"px"}const q=document.getElementById("tnq");if(q)q.placeholder="Tìm kiếm"};
  {const _rm=renderMain;renderMain=function(){const r=_rm.apply(this,arguments);try{ph();if(window.CHAT_APP)chatDress()}catch(e){}return r}}
  if(!window.CHAT_APP){
    /* web thường trên điện thoại: chuyển Tin nhắn sang Ailla Chat */
    let first=true,prev="";
    const go=()=>{try{location.href="/chat/"}catch(e){}};
    document.addEventListener("click",e=>{const c=e.target&&e.target.closest&&e.target.closest("#chatbtn");if(c&&narrow.matches&&ME){e.preventDefault();e.stopImmediatePropagation();go()}},true);
    const _r=render;render=function(){
      if(narrow.matches&&ME&&PAGE==="tinnhan"&&!first&&prev!=="tinnhan"){prev=PAGE;go();return}
      first=false;prev=PAGE;const r=_r.apply(this,arguments);try{ph()}catch(e){}return r};
    return;
  }
  document.documentElement.classList.add("chatapp");document.body.classList.add("chatapp");
  /* không ghi "đang ở Tin nhắn" vào bộ nhớ của tab: bấm về web không bị mở lại Tin nhắn */
  try{if(typeof VIEW_KEY!=="undefined")sessionStorage.removeItem(VIEW_KEY)}catch(e){}
  if(typeof saveView==="function")saveView=function(){};
  let started=false;
  const _r=render;render=function(){
    if(ME&&PAGE!=="tinnhan"){
      /* đang ở Ailla Chat mà mở trang khác (thẻ việc, thông báo…): sang web vanhanh đúng trang đó */
      if(started&&PAGE){const p=PAGE;PAGE="tinnhan";location.href="/hub/#go="+encodeURIComponent(p);return}
      PAGE="tinnhan";MOD="";
    }
    started=!!ME;const r=_r.apply(this,arguments);try{ph();chatDress()}catch(e){}return r};
  /* nút quay lại của điện thoại: đang trong cuộc chat thì về danh sách, không thoát ứng dụng */
  const _open=tnOpen;tnOpen=function(room){const wasOpen=TN.mob&&document.querySelector(".tn.open");const r=_open.apply(this,arguments);if(!wasOpen)try{history.pushState({tnc:1},"")}catch(e){}return r};
  window.addEventListener("popstate",()=>{const t=document.querySelector(".tn.open");if(t){TN.mob=false;t.classList.remove("open")}});
  let BIP=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();BIP=e;try{chatDress()}catch(er){}});
  window.addEventListener("appinstalled",()=>{BIP=null;try{localStorage.setItem("chat_inst","1")}catch(e){}const b=document.getElementById("chinst");if(b)b.remove()});
  const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent),xiaomi=/Redmi|Xiaomi|MIUI|HyperOS|\bM2\d{3}/i.test(navigator.userAgent);
  function guide(){
    const o=document.createElement("div");o.id="chguide";
    const step=(n,t)=>`<li><i>${n}</i><span>${t}</span></li>`;
    o.innerHTML=`<div class="chgbox"><div class="chgh"><img src="/chat-icon-192.png" alt=""><div><b>Cài Ailla Chat</b><small>Thêm biểu tượng ra màn hình chính, bấm là vào thẳng tin nhắn</small></div><button type="button" data-x aria-label="Đóng">✕</button></div>
      ${ios?`<p class="chgt">iPhone (mở bằng Safari)</p><ol>${step(1,"Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) ở thanh dưới Safari")}${step(2,"Kéo xuống, chọn <b>Thêm vào MH chính</b>")}${step(3,"Bấm <b>Thêm</b>. Biểu tượng Ailla Chat hiện ngoài màn hình")}${step(4,"Mở Ailla Chat từ biểu tượng đó, đăng nhập một lần là xong")}</ol><p class="hint">Nếu đang mở bằng Chrome hay Zalo trên iPhone: chép địa chỉ <b>${esc(location.host)}/chat/</b> sang Safari rồi làm như trên.</p>`
      :`<p class="chgt">Android (Chrome)</p><ol>${step(1,"Bấm nút <b>⋮</b> góc trên bên phải Chrome")}${step(2,"Chọn <b>Thêm vào màn hình chính</b> (hoặc <b>Cài đặt ứng dụng</b>)")}${step(3,"Bấm <b>Cài đặt</b> / <b>Thêm</b>")}</ol>
        ${xiaomi?`<p class="chgt">Máy Redmi / Xiaomi: nếu không thấy biểu tượng</p><ol>${step(1,"Mở <b>Cài đặt</b> › <b>Ứng dụng</b> › <b>Chrome</b> › <b>Quyền khác</b>")}${step(2,"Bật <b>Lối tắt trên màn hình chính</b> rồi cài lại")}${step(3,"Để nhận báo tin nhắn: Chrome › <b>Tiết kiệm pin</b> › chọn <b>Không giới hạn</b>")}</ol>`:""}`}
    </div>`;
    o.onclick=e=>{if(e.target===o||e.target.closest("[data-x]"))o.remove()};document.body.appendChild(o)}
  function chatDress(){
    const sh=document.querySelector(".tn .tnsh");if(!sh)return;
    if(!sh.querySelector(".chweb")){sh.insertAdjacentHTML("afterbegin",`<a class="chweb" href="/hub/" title="Về web vận hành" aria-label="Về web vận hành"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>`);const b=sh.querySelector("b");if(b)b.textContent="Đoạn chat"}
    let hid=false;try{hid=localStorage.getItem("chat_inst")==="1"||localStorage.getItem("chat_inst_x")===String(new Date().toDateString())}catch(e){}
    const side=document.querySelector(".tn .tnside");
    if(!standalone()&&!hid&&side&&!document.getElementById("chinst")){
      side.querySelector(".tnq").insertAdjacentHTML("afterend",`<div id="chinst"><img src="/chat-icon-192.png" alt=""><span><b>Cài Ailla Chat</b><small>Biểu tượng riêng ngoài màn hình chính</small></span><button type="button" class="btn pri sm" data-i>Cài</button><button type="button" class="chx" data-x aria-label="Ẩn">✕</button></div>`);
      const c=document.getElementById("chinst");
      c.querySelector("[data-i]").onclick=async()=>{if(BIP){try{BIP.prompt();const r=await BIP.userChoice;if(r&&r.outcome==="accepted"){try{localStorage.setItem("chat_inst","1")}catch(e){}c.remove()}}catch(e){guide()}BIP=null}else guide()};
      c.querySelector("[data-x]").onclick=()=>{try{localStorage.setItem("chat_inst_x",new Date().toDateString())}catch(e){}c.remove()};
    }
    const tb=document.getElementById("tnback");if(tb&&!tb.dataset.ch){tb.dataset.ch="1";tb.addEventListener("click",()=>{try{if(history.state&&history.state.tnc)history.back()}catch(e){}})}
  }
  /* số chưa đọc trên biểu tượng + tiêu đề tab */
  let lastN=-1;setInterval(()=>{if(!ME||typeof tnTotal!=="function")return;const n=TN.rooms.reduce((a,r)=>a+(r.room===TN.room&&TN.mob&&!document.hidden?0:r.unread||0),0);if(n===lastN)return;lastN=n;
    document.title=(n?"("+(n>99?"99+":n)+") ":"")+"Ailla Chat";
    try{if(navigator.setAppBadge){n?navigator.setAppBadge(n):navigator.clearAppBadge()}}catch(e){}},3000);
})();
