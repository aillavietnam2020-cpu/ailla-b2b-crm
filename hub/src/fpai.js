/* =====================================================================
   FANPAGE: YÊU CẦU THÁNG → TẠO KHUNG BÀI → AI VIẾT NỘI DUNG + BRIEF ẢNH → DUYỆT CẢ THÁNG
   Gắn trên đầu trang ② Lịch đăng chi tiết của kênh Fanpage.
   - Chị nhập yêu cầu tháng (mục tiêu, giọng văn, sản phẩm đẩy, lưu ý) → lưu ở d.fpBrief.
   - "Tạo khung bài": đủ số bài theo từng tuyến ở ① Kế hoạch, tự xếp ngày (bỏ Chủ nhật).
   - "AI viết nội dung": gọi 9router qua cầu nối AI, điền hook, nội dung, CTA, brief ảnh, chữ trên ảnh; bài chuyển sang Chờ duyệt.
   - "Duyệt cả tháng": chuyển mọi bài Chờ duyệt thành Đã duyệt một lần. Thêm / bớt bài dùng nút có sẵn.
   ===================================================================== */
const FPAI={busy:false,msg:"",open:true};
function fpBriefOf(d){return d.fpBrief||{mucTieu:"",giong:"",spDay:"",luuY:""}}
function fpaiCatalog(d){
  return (d.catalog||[]).filter(p=>p&&p.n).map(p=>`- ${p.n}${p.gia?" ("+p.gia+")":""}: ${p.mo||""}${p.pain?" | Nỗi đau khách: "+p.pain:""}${p.claim?" | Claim được dùng: "+p.claim:""}`).join("\n")
}
function fpaiParse(txt){
  const s=String(txt||""),a=s.indexOf("["),z=s.lastIndexOf("]");
  if(a<0||z<=a)throw new Error("AI trả về không đúng dạng, thử lại");
  const arr=JSON.parse(s.slice(a,z+1));if(!Array.isArray(arr))throw new Error("AI trả về không đúng dạng, thử lại");return arr
}
/* Tạo thêm bài cho đủ số lượng từng tuyến, xếp ngày vào những ngày ít bài nhất */
function fpaiMakeFrame(kenh){
  const d0=D(),plan=d0.fpPlan||[];if(!plan.length){toast("Chưa có tuyến nào. Thêm ở ① Kế hoạch › Fanpage trước");return}
  let add=0;const td=d0.settings.today;
  DB.mutate(ME.name,"Fanpage: tạo khung bài theo kế hoạch tháng",dt=>{
    const cnt={};dt.cards.filter(c=>c.kenh===kenh&&+c.day).forEach(c=>{cnt[c.day]=(cnt[c.day]||0)+1});
    const days=[];for(let x=Math.max(1,td);x<=MONTH.ndays;x++){if(new Date(MONTH.year,MONTH.mon-1,x).getDay()!==0)days.push(x)}
    if(!days.length)return;
    (dt.fpPlan||[]).forEach(r=>{
      const have=dt.cards.filter(c=>c.kenh===kenh&&c.fpId===r.id).length,need=Math.max(0,(+r.sl||0)-have);
      for(let i=0;i<need;i++){
        const c=fpNewPost(dt,kenh,r.id);let best=days[0];days.forEach(x=>{if((cnt[x]||0)<(cnt[best]||0))best=x});
        c.day=best;cnt[best]=(cnt[best]||0)+1;dt.cards.push(c);add++
      }
    })
  });
  toast(add?`Đã tạo ${add} bài theo kế hoạch và xếp ngày. Chị chỉnh lại nếu cần`:"Các tuyến đã đủ số bài theo kế hoạch");renderMain()
}
async function fpaiWrite(kenh,all){
  const d=D(),B=fpBriefOf(d);
  const todo=d.cards.filter(c=>c.kenh===kenh&&(all||(!String(c.noiDung||"").trim()&&!String(c.hookText||"").trim()))&&!["dang","xong"].includes(c.step)).sort((a,b)=>(+a.day||99)-(+b.day||99));
  if(!todo.length){toast("Không còn bài nào cần viết");return}
  FPAI.busy=true;renderMain();
  const sys=`Bạn là content marketer cho Fanpage thương hiệu AILLA Việt Nam (đồ gia dụng, tinh dầu giặt sấy, bột tẩy vạn năng...). Viết tiếng Việt đời thường, ấm áp, như người trong nhà chia sẻ, không văn quảng cáo cứng, không hứa hẹn quá mức, không nói về y tế hay chữa bệnh. Chỉ dùng thông tin và claim có trong danh sách sản phẩm dưới đây, không bịa số liệu hay chứng nhận.\nDanh sách sản phẩm:\n${fpaiCatalog(d)}\n\nYêu cầu của tháng:\n- Mục tiêu: ${B.mucTieu||"(chưa ghi)"}\n- Giọng văn: ${B.giong||"gần gũi, đời thường"}\n- Sản phẩm cần đẩy: ${B.spDay||"(không chỉ định)"}\n- Lưu ý: ${B.luuY||"(không có)"}\n\nTrả về DUY NHẤT một mảng JSON, mỗi phần tử ứng một bài: {"id":"...","chuDe":"sản phẩm / chủ đề ngắn","hook":"tiêu đề gây chú ý dưới 90 ký tự","noiDung":"nội dung bài đăng hoàn chỉnh, có xuống dòng, 80-160 từ","cta":"một câu kêu gọi hành động","briefHinh":"mô tả ảnh cần làm (bối cảnh, sản phẩm, bố cục, màu)","textAnh":"chữ chính trên ảnh, dưới 12 từ"}. Không thêm lời giải thích ngoài JSON.`;
  let done=0,err="";
  try{
    for(let i=0;i<todo.length;i+=4){
      const part=todo.slice(i,i+4);
      FPAI.msg=`Đang viết ${Math.min(i+4,todo.length)}/${todo.length} bài…`;const el=document.getElementById("fpai-msg");if(el)el.textContent=FPAI.msg;
      const user="Các bài cần viết:\n"+part.map(c=>JSON.stringify({id:c.id,ngay:(+c.day?dd(+c.day):"chưa xếp"),tuyen:c.tuyen||"",mucTieuTuyen:c.mucTieu||"",format:c.dangVideo||"Ảnh",chuDeGoiY:c.chuDe||"",hookGoiY:c.hookText||""})).join("\n");
      const r=await askClaude(sys,user),arr=fpaiParse(r.text);
      DB.mutate(ME.name,"Fanpage: AI viết "+arr.length+" bài",dt=>{arr.forEach(a=>{const c=dt.cards.find(x=>x.id===a.id&&x.kenh===kenh);if(!c)return;
        if(a.chuDe)c.chuDe=String(a.chuDe);if(a.hook)c.hookText=String(a.hook);if(a.noiDung)c.noiDung=String(a.noiDung);if(a.cta)c.cta=String(a.cta);
        if(a.briefHinh)c.briefHinh=String(a.briefHinh);if(a.textAnh)c.textAnh=String(a.textAnh);
        c.aiViet=Date.now();if(c.step==="cg"||c.step==="kb")c.step="dvd";done++})});
    }
  }catch(e){err=e&&e.message||String(e)}
  FPAI.busy=false;FPAI.msg="";
  toast(err?`Viết được ${done} bài rồi dừng: ${err}`:`AI đã viết ${done} bài, đang ở trạng thái Chờ duyệt`);renderMain()
}
/* ---------- Giao cho agent OpenClaw trên VPS: web tạo việc fp_write, agent lấy về viết, trả kết quả ---------- */
const FPAI_APPLIED_MAX=300;
async function fpaiSend(kenh,all){
  const d=D(),B=fpBriefOf(d);
  const todo=d.cards.filter(c=>c.kenh===kenh&&(all||(!String(c.noiDung||"").trim()&&!String(c.hookText||"").trim()))&&!["dang","xong"].includes(c.step)&&!c.fpTask).sort((a,b)=>(+a.day||99)-(+b.day||99));
  if(!todo.length){toast("Không còn bài nào cần viết (bài đang chờ agent thì bỏ qua)");return}
  FPAI.busy=true;renderMain();
  let n=0,ids=[];
  try{
    for(let i=0;i<todo.length;i+=4){
      const part=todo.slice(i,i+4);
      const payload={thang:MONTH.key,brief:B,sanPham:(d.catalog||[]).filter(p=>p&&p.n).map(p=>({ten:p.n,gia:p.gia||"",mo:p.mo||"",pain:p.pain||"",claim:p.claim||""})),
        posts:part.map(c=>({id:c.id,ngay:+c.day||0,tuyen:c.tuyen||"",mucTieuTuyen:c.mucTieu||"",format:c.dangVideo||"Ảnh",chuDeGoiY:c.chuDe||"",hookGoiY:c.hookText||""})),
        taoAnh:true};
      const r=await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"fp_write",ref:kenh,payload})});
      part.forEach(c=>ids.push([c.id,r.id]));n+=part.length
    }
    DB.mutate(ME.name,"Fanpage: giao agent viết "+n+" bài",dt=>{ids.forEach(([cid,tid])=>{const c=dt.cards.find(x=>x.id===cid);if(c)c.fpTask=tid})});
    toast("Đã giao "+n+" bài cho agent trên VPS. Kết quả sẽ tự điền vào bài (khoảng vài phút)")
  }catch(e){toast("Không giao được việc: "+(e&&e.message||e))}
  FPAI.busy=false;renderMain()
}
let _fpaiPoll=0;
async function fpaiCollect(){
  if(_fpaiPoll||typeof ME==="undefined"||!ME||typeof D!=="function"||!D())return;
  const d=D(),wait=d.cards.filter(c=>c.fpTask);if(!wait.length)return;
  _fpaiPoll=1;
  try{
    const L=await svApi("/api/hub/worker-tasks?kind=fp"),by={};(L||[]).forEach(t=>by[t.id]=t);
    const fin=[];
    wait.forEach(c=>{const t=by[c.fpTask];if(t&&(t.status==="done"||t.status==="error"))fin.push([c.id,t])});
    if(fin.length){
      DB.mutate("Agent Fanpage","nhận nội dung agent viết "+fin.length+" bài",dt=>{
        fin.forEach(([cid,t])=>{const c=dt.cards.find(x=>x.id===cid);if(!c)return;
          const arr=t.status==="done"&&t.result&&Array.isArray(t.result.posts)?t.result.posts:[],a=arr.find(x=>x.id===cid);
          if(a){if(a.chuDe)c.chuDe=String(a.chuDe);if(a.hook)c.hookText=String(a.hook);if(a.noiDung)c.noiDung=String(a.noiDung);if(a.cta)c.cta=String(a.cta);
            if(a.briefHinh)c.briefHinh=String(a.briefHinh);if(a.textAnh)c.textAnh=String(a.textAnh);if(a.linkAnh)c.linkVideo=String(a.linkAnh);
            c.aiViet=Date.now();if(c.step==="cg"||c.step==="kb")c.step="dvd"}
          else c.fpLoi=(t.detail||"agent chưa trả được bài này").slice(0,200);
          delete c.fpTask})});
      toast("Agent đã trả "+fin.length+" bài");renderMain()
    }
  }catch(e){}finally{_fpaiPoll=0}
}
setInterval(()=>{try{if(typeof PAGE!=="undefined"&&document&&!document.hidden)fpaiCollect()}catch(e){}},8000);
const fpaiOrig=pFanpageLich;
pFanpageLich=function(m,chs){
  fpaiOrig(m,chs);
  if(!xvGive())return;
  const d=D(),B=fpBriefOf(d),kenh=BV.k,all=d.cards.filter(c=>c.kenh===kenh);
  const nEmpty=all.filter(c=>!String(c.noiDung||"").trim()&&!["dang","xong"].includes(c.step)).length,nWait=all.filter(c=>fpStOf(c)==="dvd").length;
  const html=`<section class="card pad fpai"><style>.fpai .fpg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(max-width:800px){.fpai .fpg{grid-template-columns:1fr}}.fpai label{display:block;font-size:12px;color:#6b7280}.fpai textarea,.fpai input{width:100%;margin-top:3px}.fpwh{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;padding:6px 4px}.fpai .acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}</style>
   <div class="card-h"><h2>Yêu cầu tháng ${MONTH.mon} cho Fanpage</h2><span class="hint">Chị ghi yêu cầu → tạo khung bài → AI viết nội dung và brief ảnh → chị duyệt cả tháng</span></div>
   <div class="fpg"><label>Mục tiêu tháng<textarea rows="2" data-fpb="mucTieu" placeholder="VD: tăng tương tác, kéo khách về mua trên TikTok Shop, đẩy sale đôi 20/10">${esc(B.mucTieu)}</textarea></label>
    <label>Giọng văn<textarea rows="2" data-fpb="giong" placeholder="VD: gần gũi như người nhà, hài nhẹ, không văn quảng cáo">${esc(B.giong)}</textarea></label>
    <label>Sản phẩm cần đẩy<textarea rows="2" data-fpb="spDay" placeholder="VD: Tinh dầu giặt sấy, Bột tẩy vạn năng">${esc(B.spDay)}</textarea></label>
    <label>Lưu ý (điều cấm, ngày sale, nội dung bắt buộc)<textarea rows="2" data-fpb="luuY" placeholder="VD: không nhắc đối thủ; bài ngày 20/10 phải có ưu đãi sale đôi">${esc(B.luuY)}</textarea></label></div>
   <div class="acts"><button type="button" class="btn sm" data-fpai="frame" ${FPAI.busy?"disabled":""}>1 · Tạo khung bài theo kế hoạch</button>
    <button type="button" class="btn pri sm" data-fpai="write" ${FPAI.busy?"disabled":""}>2 · Giao agent viết bài + brief ảnh (${nEmpty} bài chưa có)</button>
    <button type="button" class="btn sm" data-fpai="rewrite" ${FPAI.busy?"disabled":""} title="Viết lại cả những bài đã có nội dung (trừ bài đã duyệt / đã đăng)">Viết lại tất cả</button>
    <button type="button" class="btn sm" data-fpai="ok" ${FPAI.busy||!nWait?"disabled":""}>3 · Duyệt cả tháng (${nWait} bài chờ duyệt)</button>
    <span class="hint" id="fpai-msg">${esc(FPAI.msg||"")}</span></div>
   <p class="hint">Việc được giao cho agent OpenClaw trên VPS, viết xong tự điền vào bài ở trạng thái Chờ duyệt${all.some(c=>c.fpTask)?` · <b>${all.filter(c=>c.fpTask).length} bài đang chờ agent</b>`:""}. Muốn thêm / bớt bài dùng "+ Thêm bài" và "Xóa bài này" trong khung chi tiết từng bài.</p></section>`;
  const top=m.querySelector(".bvtop");
  if(top)top.insertAdjacentHTML("beforebegin",html);else m.insertAdjacentHTML("afterbegin",html);
  m.querySelectorAll("[data-fpb]").forEach(i=>i.onchange=()=>{const f=i.dataset.fpb,v=i.value;DB.mutate(ME.name,"Fanpage: sửa yêu cầu tháng",dt=>{dt.fpBrief=Object.assign({mucTieu:"",giong:"",spDay:"",luuY:""},dt.fpBrief||{});dt.fpBrief[f]=v})});
  m.querySelectorAll("[data-fpai]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.fpai;
    if(k==="frame")fpaiMakeFrame(kenh);
    else if(k==="write")fpaiSend(kenh,false);
    else if(k==="rewrite"){if(confirm("Viết lại nội dung của tất cả bài chưa duyệt? Nội dung chị đã sửa tay sẽ bị thay."))fpaiSend(kenh,true)}
    else if(k==="ok"){
      const L=D().cards.filter(c=>c.kenh===kenh&&fpStOf(c)==="dvd");if(!L.length)return;
      if(!confirm("Duyệt "+L.length+" bài đang chờ duyệt của Fanpage?"))return;
      const ids=new Set(L.map(c=>c.id));
      DB.mutate(ME.name,"Fanpage: duyệt cả tháng "+L.length+" bài",dt=>{dt.cards.forEach(c=>{if(!ids.has(c.id))return;c.step="dang";c.history=(c.history||[]).concat({t:new Date().toLocaleString("vi-VN"),who:ME.name,to:"dang"})})});
      toast("Đã duyệt "+L.length+" bài");renderMain()
    }
  })
};
