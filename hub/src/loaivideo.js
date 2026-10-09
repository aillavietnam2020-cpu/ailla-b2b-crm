/* =====================================================================
   TRANG CHI TIẾT MỘT DẠNG VIDEO (kiểu Notion): bấm một dạng ở dòng "Dạng nội dung" của sản phẩm là mở bên phải.
   Một chỗ duy nhất để: xem kế hoạch, giao việc (người, số video, hạn), viết nội dung / kịch bản, việc con.
   Mỗi dòng giao việc = một người chịu trách nhiệm (kiểu Asana); nhiều người thì nhiều dòng.
   ===================================================================== */
const lvDays=()=>Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]);
/* nhãn hạn có màu: trễ đỏ, hôm nay cam, còn 1–2 ngày vàng, còn lại xám */
function lvDue(han,done){
  const td=D().settings.today;if(!+han)return `<span class="pill p-gry">chưa có hạn</span>`;
  if(done)return `<span class="pill p-grn">${dd(+han)}</span>`;
  if(+han<td)return `<span class="pill p-red">${dd(+han)} · trễ ${td-+han} ngày</span>`;
  if(+han===td)return `<span class="pill p-amb">${dd(+han)} · hôm nay</span>`;
  if(+han-td<=2)return `<span class="pill p-amb">${dd(+han)} · còn ${+han-td} ngày</span>`;
  return `<span class="pill p-gry">${dd(+han)}</span>`
}
/* tải thật của một người: việc đang cầm và số video có hạn trong tuần này */
function lvTai(d,uid){
  const td=d.settings.today,we=(WEEKS.find(x=>td>=x.tu&&td<=x.den)||WEEKS[WEEKS.length-1]).den;
  const mine=d.cards.filter(c=>(c.giao===uid||c.nguoiKB===uid||c.nguoi===uid)&&!["cg","dang","xong"].includes(c.step));
  return {cam:pvLoad(d,uid),tuan:mine.filter(c=>+c.han&&+c.han<=we).length}
}
/* kế hoạch theo tuần của một dạng, lấy từ kế hoạch tuần hoặc chia tự động từ số cả tháng */
function lvPlan(d,sku,kenh,t){
  const key=wpKey(sku,kenh),x=ptPairs().find(y=>y.sku===sku&&y.kenh===kenh)||{sl:0},a=[0,0,0,0,0];
  for(let i=1;i<=5;i++){const e0=wpOf(d,i)[key]||{},e=wpTot(e0)?e0:wpAutoEntry(d,sku,kenh,x.sl,i);a[i-1]=+((wpMix(e))[t])||0}
  return a
}
function lvLines(d,sku,kenh,t){
  const cards=d.cards.filter(c=>c.sku===sku&&c.kenh===kenh&&mixOf(c)===t),map={};
  cards.forEach(c=>{const u=c.giao||c.nguoiKB||c.nguoi||"",k=u+"|"+(+c.han||0),o=map[k]=map[k]||{u,han:+c.han||0,ids:[],n:0,co:0,tk:""};o.ids.push(c.id);o.n++;if(VID_STEPS.includes(c.step)||c.step==="dang"||c.step==="xong")o.co++});
  const lines=Object.values(map);
  if(t==="nhanban")(d.tasks||[]).filter(z=>z.mix==="nhanban"&&z.sku===sku&&z.kenh===kenh).forEach(z=>lines.push({u:z.nguoi,han:+z.han||0,ids:[],n:z.sl||1,co:z.st==="done"?(z.sl||1):0,tk:z.id}));
  return lines.sort((a,b)=>(a.han||99)-(b.han||99))
}
/* đặt số video cả tháng của một dạng, web tự chia lại cho các tuần */
function lvSetPlan(sku,kenh,t,v){
  const key=wpKey(sku,kenh),lb=(MIX.find(z=>z[0]===t)||[])[1]||t;v=Math.max(0,Math.floor(+v||0));
  DB.mutate(ME.name,"kế hoạch "+lb+" "+sk(sku).n+" = "+v,dt=>{dt.weekPlan=dt.weekPlan||{};const M=dt.weekPlan.M=dt.weekPlan.M||{},e=M[key]=M[key]||{};e.mix=Object.assign({},e.mix||{});e.mix[t]=v;e.sl=Object.values(e.mix).reduce((a,b)=>a+(+b||0),0);
    const W5=PB_W(),wt=W5.map((w,i)=>knPlan(dt,kenh)[i][sku]||0),sp=wpSplit(v,wt.some(n=>n>0)?wt:W5.map(w=>w.den-w.tu+1));
    for(let i=1;i<=5;i++){const e0=(dt.weekPlan[i]||{})[key];if(e0&&wpTot(e0)){e0.mix=Object.assign({},e0.mix||{});e0.mix[t]=sp[i-1];e0.sl=Object.values(e0.mix).reduce((a,b)=>a+(+b||0),0)}}})
}
function lvPeek(sku,kenh,t){
  const d=D(),give=xvGive(),team=xvTeam(),td=d.settings.today,cw=weekOf(td)||1,key=wpKey(sku,kenh),lb=(MIX.find(z=>z[0]===t)||[])[1]||t;
  if(typeof DV_ID!=="undefined")DV_ID=null;
  const plan=lvPlan(d,sku,kenh,t),tot=plan.reduce((a,b)=>a+b,0),L=lvLines(d,sku,kenh,t),given=L.reduce((s,l)=>s+l.n,0),left=Math.max(0,tot-given),dis=give?"":"disabled";
  const doc=((d.lvNoiDung||{})[key+"|"+t])||"",vc=((d.lvVc||{})[key+"|"+t])||[];
  const days=lvDays(),han0=wpHorHan(d,t,t==="oneshot"?5:Math.min(5,cw+1));
  const pOpts=[["","— chọn người —"]].concat(team.map(u=>{const a=lvTai(d,u.id),n=typeof gvOf==="function"?gvOf(d,u).nghi:0;return [u.id,u.name+" · cầm "+a.cam+" · "+a.tuan+" hạn tuần này"+(n>0?" · nghỉ từ "+dd(n):"")]}));
  $("#drawerIn").innerHTML=`<div class="dh"><button class="btn sm" id="dx">Đóng</button></div>
  <div class="lvk"><span>${swatch(sku)}${esc(sk(sku).n)} · ${esc(chOf(kenh).short)}</span></div><h2 class="dvtitle2">${esc(lb)}</h2>
  <div class="lvsum"><div><span>Kế hoạch tháng</span>${give?`<input type="number" min="0" class="num" data-lvplan="1" value="${tot}">`:`<b>${tot}</b>`}</div><div><span>Đã giao</span><b>${given}</b></div><div class="${left?"lvleft":""}"><span>Còn chưa giao</span><b>${left}</b></div><div><span>Đã có video</span><b>${L.reduce((s,l)=>s+l.co,0)}</b></div></div>
  <h3 class="dvh3">Giao việc</h3>
  <table class="lvtab"><thead><tr><th>Người làm</th><th class="n">Số video</th><th>Hạn</th><th>Tiến độ</th><th></th></tr></thead><tbody>
  ${L.map((l,i)=>{const done=l.n>0&&l.co>=l.n;return `<tr data-lvl="${i}" data-ids="${esc(l.ids.join(","))}" data-tk="${esc(l.tk)}" data-u="${esc(l.u)}">
    <td>${give?`<select data-lvu>${opt([["","— chưa có người —"]].concat(team.map(u=>[u.id,u.name])).concat(team.some(u=>u.id===l.u)||!l.u?[]:[[l.u,userName(l.u)||l.u]]),l.u)}</select>`:esc(userName(l.u)||"chưa có người")}</td>
    <td class="n"><b>${l.n}</b></td>
    <td>${give?`<select data-lvh>${opt([[0,"—"]].concat(days),l.han)}</select>`:""} ${lvDue(l.han,done)}</td>
    <td>${l.co}/${l.n} có video<i class="mbar"><i style="width:${l.n?Math.round(l.co/l.n*100):0}%"></i></i></td>
    <td>${give?`<button type="button" class="lnk danger" data-lvdel="1" title="Bỏ dòng này (chỉ bỏ video chưa ai bắt đầu)">Xóa</button>`:""}</td></tr>`}).join("")||`<tr><td colspan="5" class="empty">Chưa giao cho ai.</td></tr>`}
  </tbody></table>
  ${give?`<div class="lvadd"><select data-lvnu>${opt(pOpts,"")}</select><input type="number" min="1" class="num" data-lvnn value="${left||1}"><select data-lvnh>${opt(days,han0)}</select><button type="button" class="btn pri" data-lvgo="1">Giao</button></div>
  <input class="lvquick" data-lvq="1" placeholder="Hoặc gõ nhanh rồi Enter, ví dụ: Quỳnh 10 12/10  (người, số video, ngày hạn)">`:""}
  <h3 class="dvh3">Nội dung · kịch bản</h3><textarea class="dvdoc" data-lvdoc="1" placeholder="Viết kịch bản, danh sách hook, hướng dẫn, link… cho dạng video này" ${dis}>${esc(doc)}</textarea>
  <h3 class="dvh3">Việc con${vc.length?` <small>${vc.filter(x=>x.x).length}/${vc.length}</small>`:""}</h3>
  <div class="dvck">${vc.map((x,i)=>`<label class="${x.x?"x":""}"><input type="checkbox" data-lvct="${i}" ${x.x?"checked":""} ${dis}><span>${esc(x.t)}</span>${give?`<button type="button" class="lnk" data-lvcd="${i}">✕</button>`:""}</label>`).join("")}${give?`<input class="dvck-in" data-lvca="1" placeholder="+ Thêm việc con rồi Enter">`:""}</div>`;
  $("#drawer").hidden=false;
  const drw=$("#drawerIn"),redo=()=>{renderMain();lvPeek(sku,kenh,t)};
  const fit=x=>{x.style.height="auto";x.style.height=Math.max(220,x.scrollHeight+2)+"px"};drw.querySelectorAll("textarea").forEach(x=>{fit(x);x.addEventListener("input",()=>fit(x))});
  $("#dx").onclick=()=>closeDrawer();
  /* sửa kế hoạch tháng của dạng này, tự chia lại cho các tuần */
  const pl=drw.querySelector("[data-lvplan]");if(pl)pl.onchange=()=>{const v=Math.max(0,Math.floor(+pl.value||0));
    DB.mutate(ME.name,"kế hoạch "+lb+" "+sk(sku).n+" = "+v,dt=>{dt.weekPlan=dt.weekPlan||{};const M=dt.weekPlan.M=dt.weekPlan.M||{},e=M[key]=M[key]||{};e.mix=Object.assign({},e.mix||{});e.mix[t]=v;e.sl=Object.values(e.mix).reduce((a,b)=>a+(+b||0),0);
      const px=ptPairs().find(y=>y.sku===sku&&y.kenh===kenh)||{sl:0},K=kn(dt,kenh),W5=PB_W(),wt=W5.map((w,i)=>knPlan(dt,kenh)[i][sku]||0),sp=wpSplit(v,wt.some(n=>n>0)?wt:W5.map(w=>w.den-w.tu+1));
      for(let i=1;i<=5;i++){const e0=(dt.weekPlan[i]||{})[key];if(e0&&wpTot(e0)){e0.mix=Object.assign({},e0.mix||{});e0.mix[t]=sp[i-1];e0.sl=Object.values(e0.mix).reduce((a,b)=>a+(+b||0),0)}}});redo()};
  /* đổi hạn / đổi người / xóa một dòng */
  drw.querySelectorAll("tr[data-lvl]").forEach(tr=>{const ids=(tr.dataset.ids||"").split(",").filter(Boolean),tk=tr.dataset.tk,old=tr.dataset.u;
    const sh=tr.querySelector("[data-lvh]");if(sh)sh.onchange=()=>{const v=+sh.value;DB.mutate(ME.name,"đổi hạn "+lb+" "+sk(sku).n,dt=>{dt.cards.forEach(c=>{if(ids.includes(c.id))c.han=v});(dt.tasks||[]).forEach(z=>{if(z.id===tk)z.han=v})});redo()};
    const su=tr.querySelector("[data-lvu]");if(su)su.onchange=()=>{const u=su.value;if(!u)return;DB.mutate(ME.name,"đổi người làm "+lb+" "+sk(sku).n+" → "+userName(u),dt=>{dt.cards.forEach(c=>{if(ids.includes(c.id)){["giao","nguoi","nguoiKB","nguoiEdit"].forEach(k=>{if(c[k]===old||k==="giao")c[k]=u})}});(dt.tasks||[]).forEach(z=>{if(z.id===tk)z.nguoi=u})});redo()};
    const dl=tr.querySelector("[data-lvdel]");if(dl)dl.onclick=()=>{const cs=D().cards.filter(c=>ids.includes(c.id)),del=cs.filter(c=>["cg","kb"].includes(c.step)&&!c.hookText&&!c.noiDung&&!c.linkVideo&&!c.linkFinal&&!c.buoiQuay&&!c.khoMa&&!c.wt),keep=cs.length-del.length,tkd=tk&&(D().tasks||[]).some(z=>z.id===tk&&z.st==="todo");
      if(!del.length&&!tkd){toast("Dòng này đã có việc đang làm, không xóa được. Đổi người hoặc đổi hạn thay thế.");return}
      if(!confirm("Bỏ "+(del.length+(tkd?1:0))+" việc chưa ai bắt đầu"+(keep?" (giữ lại "+keep+" việc đã có nội dung)":"")+"?"))return;
      const dset=new Set(del.map(c=>c.id));DB.mutate(ME.name,"bỏ dòng giao việc "+lb+" "+sk(sku).n,dt=>{dt.cards=dt.cards.filter(c=>!dset.has(c.id));if(tkd)dt.tasks=(dt.tasks||[]).filter(z=>z.id!==tk)});redo()}});
  /* giao thêm một dòng */
  const give1=(u,n,hn)=>{const D0=D(),rem=Math.max(0,lvPlan(D0,sku,kenh,t).reduce((a,b)=>a+b,0)-lvLines(D0,sku,kenh,t).reduce((s,l)=>s+l.n,0));
    if(!u){toast("Chọn người làm");return false}if(n<1){toast("Số video phải lớn hơn 0");return false}if(n>rem){toast("Chỉ còn "+rem+" video chưa giao. Muốn giao thêm thì tăng Kế hoạch tháng ở trên.");return false}if(hn<D0.settings.today){toast("Hạn phải từ hôm nay trở đi");return false}
    wpAssign(sku,kenh,t,u,n,cw,D0.settings.today,hn,"");toast("Đã giao "+userName(u)+" "+n+" video "+lb);return true};
  const go=drw.querySelector("[data-lvgo]");if(go)go.onclick=()=>{if(give1(drw.querySelector("[data-lvnu]").value,Math.floor(+drw.querySelector("[data-lvnn]").value||0),+drw.querySelector("[data-lvnh]").value))redo()};
  /* gõ nhanh: "Quỳnh 10 12/10" */
  const q=drw.querySelector("[data-lvq]");if(q)q.onkeydown=e=>{if(e.key!=="Enter")return;e.preventDefault();const s=q.value.trim();if(!s)return;
    const fold=foldName(s),u=team.find(x=>foldName(x.name).split(" ").some(w=>w.length>1&&new RegExp("(^|\\s)"+w+"(\\s|$)").test(fold))),dm=s.match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/),rest=s.replace(dm?dm[0]:"",""),nm=rest.match(/\d+/);
    if(!u){toast("Không nhận ra tên người trong \""+s+"\"");return}
    if(give1(u.id,nm?+nm[0]:0,dm?+dm[1]:han0))redo()};
  /* nội dung và việc con lưu theo dạng */
  const dc=drw.querySelector("[data-lvdoc]");if(dc)dc.onchange=()=>{DB.mutate(ME.name,"nội dung "+lb+" "+sk(sku).n,dt=>{dt.lvNoiDung=dt.lvNoiDung||{};dt.lvNoiDung[key+"|"+t]=dc.value})};
  const mv=fn=>{DB.mutate(ME.name,"việc con "+lb+" "+sk(sku).n,dt=>{dt.lvVc=dt.lvVc||{};const k=key+"|"+t;dt.lvVc[k]=(dt.lvVc[k]||[]).slice();fn(dt.lvVc[k])});redo()};
  drw.querySelectorAll("[data-lvct]").forEach(i=>i.onchange=()=>mv(a=>{const x=a[+i.dataset.lvct];if(x)a[+i.dataset.lvct]=Object.assign({},x,{x:i.checked})}));
  drw.querySelectorAll("[data-lvcd]").forEach(b=>b.onclick=()=>mv(a=>a.splice(+b.dataset.lvcd,1)));
  const ca=drw.querySelector("[data-lvca]");if(ca)ca.onkeydown=e=>{if(e.key!=="Enter")return;e.preventDefault();const tx=ca.value.trim();if(tx)mv(a=>a.push({t:tx,x:false}))}
}
