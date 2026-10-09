/* =====================================================================
   HỌC TỪ KỊCH BẢN (Marketing › Content & Media › Học từ kịch bản)
   Worker ghi lại mỗi lần kịch bản được duyệt nguyên bản, được sửa chữ hoặc bị góp ý, rút thành bài học (nên / tránh)
   và đưa vào lần viết kịch bản sau. Trang này hỏi Worker qua hàng đợi việc (card_learn_*), nên máy văn phòng phải bật.
   Web gửi kèm số bán (đơn, GMV, view) của các video đã đăng để máy ưu tiên học từ kịch bản bán tốt.
   ===================================================================== */
const HK2={d:null,les:null,off:false,busy:false,msg:"",err:"",firstTry:false};
const HK_SKU={BT:"tay-van-nang",TD:"tinh-dau-giat-say",XM:"xit-muoi",XR:"xit-ruoi",SAP:"sap-thom"};
const hkSkuName=k=>{const hub=Object.keys(HK_SKU).find(x=>HK_SKU[x]===k);return hub?sk(hub).n:k};
const hkCan=()=>ME.role==="admin"||ME.role==="lead"||can(ME,"viec.duyet");
/* gửi việc cho Worker rồi chờ kết quả (hỏi lại mỗi 3 giây, tối đa 90 giây) */
async function hkTask(kind,payload){
  const r=await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind,ref:"learn",payload:payload||{}})});
  const id=r&&r.id;if(!id)throw new Error("Không gửi được việc cho Worker");
  for(let i=0;i<30;i++){await new Promise(x=>setTimeout(x,3000));let L;try{L=await svApi("/api/hub/worker-tasks?kind=card")}catch(e){continue}
    const t=(L||[]).find(x=>x.id===id);if(!t)continue;
    if(t.status==="error")throw new Error(t.detail||"Worker báo lỗi");
    if(t.status==="done")return t.result||{}}
  throw new Error("Máy Worker chưa trả lời. Kiểm tra máy văn phòng có bật không, việc vẫn nằm chờ và sẽ chạy khi máy bật.")
}
/* số bán của video đã đăng, gắn theo mã order Worker */
const hkPerf=()=>(D().cards||[]).filter(c=>c.wJob&&c.step==="xong"&&((+c.don)||(+c.view))).map(c=>({job:c.wJob,don:+c.don||0,gmv:+c.gmv||0,view:+c.view||0}));
async function hkLoad(kind,payload,msg){
  HK2.busy=true;HK2.err="";HK2.msg=msg||"Đang hỏi máy Worker…";renderMain();
  try{const r=await hkTask(kind,Object.assign({perf:hkPerf()},payload||{}));HK2.d=r;HK2.les=JSON.parse(JSON.stringify(r.lessons||{}));HK2.off=!!r.off}
  catch(e){HK2.err=e.message||String(e)}
  HK2.busy=false;renderMain()
}
const hkList=(k,sec,who)=>{const L=(HK2.les&&(sec==="chung"?HK2.les.chung:(HK2.les.theo_sp||{})[sec]))||{},A=L[k]||[],can=hkCan();
  return `<div class="hkcol"><b>${k==="nen"?"Nên":"Tránh"}</b>${A.map((x,i)=>`<div class="hkrow"><input class="bvhook" data-hkv="${esc(sec)}|${k}|${i}" value="${esc(x)}" ${can?"":"disabled"}>${can?`<button type="button" class="ktx" data-hkx="${esc(sec)}|${k}|${i}" title="Xóa quy tắc này">✕</button>`:""}</div>`).join("")||'<p class="hint">Chưa có.</p>'}${can?`<button type="button" class="btn sm" data-hka="${esc(sec)}|${k}">+ Thêm</button>`:""}</div>`};
function pHocKb(m){
  const d=HK2.d,can=hkCan();
  if(!d&&!HK2.busy&&!HK2.err&&!HK2.firstTry){HK2.firstTry=true;setTimeout(()=>hkLoad("card_learn_pull",{},"Đang hỏi máy Worker…"),0)}
  let body="";
  if(HK2.busy)body=`<section class="card"><p><b>${esc(HK2.msg)}</b></p><p class="hint">Máy văn phòng phải đang bật, mất khoảng 15 giây. Trang tự cập nhật khi có kết quả.</p></section>`;
  else if(HK2.err)body=`<section class="card"><p class="t-red"><b>Chưa lấy được dữ liệu</b></p><p class="hint">${esc(HK2.err)}</p><div class="acts"><button class="btn pri" id="hk-retry">Thử lại</button></div></section>`;
  else if(d){
    const st=d.stats||{},skus=Object.keys((HK2.les&&HK2.les.theo_sp)||{}),top=d.top||[];
    body=`<div class="grid kpis">${kpi("Lần học",st.tong||0,(d.built_at?"rút bài học "+String(d.built_at).slice(0,10):"chưa rút bài học"))}${kpi("Duyệt nguyên bản",(st.duyet_nguyen||0)+" ("+(st.ti_le_duyet_ngay||0)+"%)","","var(--green)")}${kpi("Chị / nhân sự sửa chữ",st.chi_sua||0)}${kpi("Góp ý viết lại",st.goi_y||0)}${kpi("Kịch bản đã có số bán",d.perf_n||0)}</div>
     <section class="card"><div class="card-h"><h2>Máy đang dùng bài học khi viết kịch bản</h2><label class="sw-t"><input type="checkbox" id="hk-on" ${HK2.off?"":"checked"} ${can?"":"disabled"}> ${HK2.off?"Đang tắt":"Đang bật"}</label></div>
      <p class="hint">Mỗi lần AI viết kịch bản mới, máy đưa các bài học bên dưới và 2 kịch bản bán tốt nhất (hoặc chị đã duyệt, đã sửa) của cùng sản phẩm vào lệnh viết. Máy rút lại bài học khi có thêm từ 3 lần duyệt, sửa hoặc góp ý mới.</p>
      ${can?`<div class="acts"><button class="btn sm" id="hk-redo" title="Máy đọc lại toàn bộ nhật ký và rút lại bài học ngay (ghi đè bài học đang có)">Rút lại bài học ngay</button><button class="btn sm" id="hk-refresh" title="Gửi số bán mới nhất từ báo cáo TikTok sang Worker">Cập nhật số bán</button></div>`:""}</section>
     <section class="card"><div class="card-h"><h2>Bài học chung mọi sản phẩm</h2></div><div class="hkgrid">${hkList("nen","chung")}${hkList("tranh","chung")}</div></section>
     ${skus.map(s=>`<section class="card"><div class="card-h"><h2>Riêng sản phẩm: ${esc(hkSkuName(s))}</h2></div><div class="hkgrid">${hkList("nen",s)}${hkList("tranh",s)}</div></section>`).join("")}
     ${can?`<div class="acts" style="padding:0 4px"><button class="btn pri" id="hk-save">Lưu bài học đã sửa</button><span class="hint">Máy dùng đúng nội dung chị lưu ở đây cho các lần viết sau.</span></div>`:""}
     <section class="card flush"><div class="card-h pad"><h2>Kịch bản bán tốt nhất</h2><span class="hint">sắp theo số đơn của video đã đăng · máy ưu tiên học từ các kịch bản này</span></div>
      <div class="tbl"><table class="kstab"><thead><tr><th>Order</th><th>Sản phẩm</th><th class="n">Đơn</th><th class="n">GMV</th><th class="n">View</th><th>Kịch bản</th></tr></thead><tbody>${top.map(x=>`<tr><td class="mono">${esc(x.job||"")}</td><td>${esc(hkSkuName(x.sku||""))}</td><td class="n"><b>${nf(x.don)}</b></td><td class="n">${x.gmv?money(x.gmv):"—"}</td><td class="n">${x.view?nf(x.view):"—"}</td><td style="white-space:normal;max-width:520px"><div class="hkscr">${esc(x.text||"")}</div></td></tr>`).join("")||'<tr><td colspan="6" class="empty">Chưa có kịch bản nào gắn được với số bán. Số bán có sau khi video đăng và nhập báo cáo TikTok (cần video đã dựng qua Worker).</td></tr>'}</tbody></table></div></section>`}
  m.innerHTML=H("Học từ kịch bản","Máy học từ kịch bản được duyệt, được sửa và từ số bán thật của video, rồi viết kịch bản sau đúng ý hơn")+body;
  const rt=m.querySelector("#hk-retry");if(rt)rt.onclick=()=>hkLoad("card_learn_pull");
  const rd=m.querySelector("#hk-redo");if(rd)rd.onclick=()=>{if(confirm("Máy đọc lại toàn bộ nhật ký và rút lại bài học, ghi đè bài học đang có (kể cả phần chị đã sửa tay). Tiếp tục?"))hkLoad("card_learn_distill",{},"Máy đang rút lại bài học, có thể mất 1 đến 2 phút…")};
  const rf=m.querySelector("#hk-refresh");if(rf)rf.onclick=()=>hkLoad("card_learn_pull");
  const sv=m.querySelector("#hk-save");if(sv)sv.onclick=async()=>{HK2.busy=true;HK2.msg="Đang lưu bài học…";renderMain();try{await hkTask("card_learn_save",{lessons:HK2.les,off:HK2.off});toast("Đã lưu bài học, máy dùng từ lần viết kịch bản sau");HK2.busy=false;await hkLoad("card_learn_pull")}catch(e){HK2.busy=false;HK2.err=e.message;renderMain()}};
  const on=m.querySelector("#hk-on");if(on)on.onchange=async()=>{HK2.off=!on.checked;HK2.busy=true;HK2.msg="Đang đổi chế độ…";renderMain();try{await hkTask("card_learn_save",{lessons:HK2.les,off:HK2.off});HK2.busy=false;await hkLoad("card_learn_pull")}catch(e){HK2.busy=false;HK2.err=e.message;renderMain()}};
  m.querySelectorAll("[data-hkv]").forEach(i=>i.onchange=()=>{const [s,k,n]=i.dataset.hkv.split("|"),L=s==="chung"?HK2.les.chung:HK2.les.theo_sp[s];if(L&&L[k])L[k][+n]=i.value.trim()});
  m.querySelectorAll("[data-hkx]").forEach(b=>b.onclick=()=>{const [s,k,n]=b.dataset.hkx.split("|"),L=s==="chung"?HK2.les.chung:HK2.les.theo_sp[s];if(L&&L[k]){L[k].splice(+n,1);renderMain()}});
  m.querySelectorAll("[data-hka]").forEach(b=>b.onclick=()=>{const [s,k]=b.dataset.hka.split("|");HK2.les=HK2.les||{};if(s==="chung"){HK2.les.chung=HK2.les.chung||{nen:[],tranh:[]};(HK2.les.chung[k]=HK2.les.chung[k]||[]).push("")}else{HK2.les.theo_sp=HK2.les.theo_sp||{};HK2.les.theo_sp[s]=HK2.les.theo_sp[s]||{nen:[],tranh:[]};(HK2.les.theo_sp[s][k]=HK2.les.theo_sp[s][k]||[]).push("")}renderMain()});
  bindCommon(m)
}
PAGES.hoc_kb=pHocKb;
