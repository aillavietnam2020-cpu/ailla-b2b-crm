/* =====================================================================
   VIẾT HOOK HÀNG LOẠT (chị Hoa 04/11/2026)
   Lead giao viết hook ở Điều phối › Cập nhật nhanh (chọn người, số hook mỗi người). Nhân sự nhận việc bao nhiêu hook
   thì mở một khung điền một loạt: gõ từng ô hoặc dán nhiều hook một lần (mỗi dòng một hook), Lưu hoặc Gửi duyệt cả loạt.
   Gửi duyệt: thẻ sang bước "Người duyệt kịch bản" (dkb) như bấm từng thẻ, nhưng Lead chỉ nhận MỘT thông báo gộp.
   Nút mở: Công việc › Tổng quan (đầu trang) và Marketing › Content › Điều phối, chỉ hiện khi có hook đang chờ mình viết.
   ===================================================================== */
const HLL={k:""};
const hlMine=()=>!ME?[]:(D().cards||[]).filter(c=>c.nguoiKB===ME.id&&c.step==="kb");
const hlGroups=L=>{const g={};L.forEach(c=>{const k=c.sku+"|"+(c.tuyen||"");(g[k]=g[k]||[]).push(c)});return Object.entries(g).map(([k,cs])=>({k,cs:cs.sort((a,b)=>(+a.han||99)-(+b.han||99)||String(a.id).localeCompare(String(b.id)))}))};
function hlOpen(){const L=hlMine();if(!L.length){toast("Bạn không có hook nào đang chờ viết");return}const G=hlGroups(L);
  openDrawerHTML(`<h2>✍️ Viết hook hàng loạt <small class="hint">${L.length} video</small></h2>
   <div class="hkpaste"><b>Dán nhiều hook một lần</b> <small class="hint">mỗi dòng một hook · điền lần lượt vào các ô còn trống bên dưới</small>
    <textarea id="hk-paste" rows="4" placeholder="Hook 1&#10;Hook 2&#10;Hook 3…"></textarea><div class="acts"><button type="button" class="btn sm" id="hk-fill">Điền vào ô trống</button><span class="hint" id="hk-left"></span></div></div>
   ${G.map(({k,cs})=>{const c0=cs[0],hn=cs.map(c=>+c.han||0).filter(Boolean).sort((a,b)=>a-b)[0];return `<section class="hkg"><div class="hkgh"><b>${esc(sk(c0.sku).n)}</b>${c0.tuyen?` · ${esc(c0.tuyen)}`:""}<span class="hint"> · ${cs.length} video · ${esc(chOf(c0.kenh).short||"")}${hn?" · hạn "+dd(hn):""}</span></div>
     ${cs.map((c,i)=>`<div class="hkr"><span class="hkn">${i+1}</span><div class="hkb">${c.yTuong&&!/^Viết /.test(c.yTuong)?`<small class="hint">${esc(c.yTuong)}</small>`:""}${(c.gopy||[]).length?`<small class="t-red">Cần sửa: ${esc((c.gopy[c.gopy.length-1]||{}).note||"")}</small>`:""}<textarea rows="2" data-hk="${esc(c.id)}" placeholder="Hook cho video ${esc(c.id)}">${esc(c.hookText||"")}</textarea></div></div>`).join("")}</section>`}).join("")}
   <div class="acts hkacts"><span class="hint" id="hk-n"></span><span class="sp"></span><button type="button" class="btn" id="hk-save">Lưu nháp</button><button type="button" class="btn pri" id="hk-send">Gửi duyệt các hook đã viết</button></div>`);
  const T=()=>[...document.querySelectorAll("[data-hk]")],cnt=()=>{const n=T().filter(t=>t.value.trim()).length;$("#hk-n").textContent=`Đã viết ${n}/${T().length} hook`};T().forEach(t=>t.oninput=cnt);cnt();
  $("#hk-fill").onclick=()=>{const lines=$("#hk-paste").value.split(/\r?\n/).map(x=>x.replace(/^\s*(\d+[.)]|[-•*])\s*/,"").trim()).filter(Boolean);let i=0;T().forEach(t=>{if(!t.value.trim()&&i<lines.length)t.value=lines[i++]});
    $("#hk-left").textContent=i<lines.length?`Còn ${lines.length-i} hook chưa có ô để điền`:`Đã điền ${i} hook`;$("#hk-paste").value=lines.slice(i).join("\n");cnt()};
  const save=send=>{const V={};T().forEach(t=>{V[t.dataset.hk]=t.value.trim()});const sendIds=send?Object.keys(V).filter(id=>V[id]):[];
    if(send&&!sendIds.length){toast("Chưa có hook nào để gửi duyệt");return}
    DB.mutate(ME.name,send?`gửi duyệt ${sendIds.length} hook`:"lưu nháp hook",dt=>{const now=new Date().toLocaleString("vi-VN");
      Object.entries(V).forEach(([id,h])=>{const x=dt.cards.find(y=>y.id===id);if(!x||x.step!=="kb")return;x.hookText=h;
        if(send&&h){x.step="dkb";x.nguoiKB=x.nguoiKB||ME.id;x.duyet="Chưa duyệt";x.ceo="CẦN KIỂM TRA";x.history=(x.history||[]).concat({t:now,who:ME.name,to:"dkb"})}});
      if(send&&typeof notifyU==="function"&&typeof approvers==="function"){const c0=dt.cards.find(y=>y.id===sendIds[0]);notifyU(dt,approvers(),`✍️ ${ME.name} gửi ${sendIds.length} hook chờ duyệt${c0?" · "+sk(c0.sku).n:""}`,"page:bang_video")}});
    toast(send?`Đã gửi duyệt ${sendIds.length} hook`:"Đã lưu nháp");closeDrawer();renderMain()};
  $("#hk-save").onclick=()=>save(false);$("#hk-send").onclick=()=>save(true)}
/* nút mở: đầu Công việc › Tổng quan và Điều phối */
function hlBtn(){const n=hlMine().length;return n?`<button type="button" class="btn pri hkbtn" data-hkopen="1">✍️ Viết hook hàng loạt <b>${n}</b></button>`:""}
const _pCvVHl=pCvV;
pCvV=function(m){_pCvVHl(m);try{const b=hlBtn(),bar=m.querySelector(".cvvbar");if(b&&bar){bar.insertAdjacentHTML("afterbegin",b);bar.querySelector("[data-hkopen]").onclick=hlOpen}}catch(e){console.error("viết hook hàng loạt",e)}};
PAGES.cv_v=m=>pCvV(m);
if(PAGES.bang_video){const _bv=PAGES.bang_video;PAGES.bang_video=m=>{_bv(m);try{const b=hlBtn();if(b){m.insertAdjacentHTML("afterbegin",`<div class="hkbar">${b}<span class="hint">Bạn có hook đang chờ viết. Bấm để điền một loạt, không cần gõ từng dòng trong bảng.</span></div>`);m.querySelector("[data-hkopen]").onclick=hlOpen}}catch(e){console.error("viết hook hàng loạt",e)}}}
