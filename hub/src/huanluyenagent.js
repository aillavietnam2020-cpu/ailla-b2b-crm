/* ---------- Huấn luyện agent ----------
   Chị tạo bot bán hàng, soạn kịch bản (câu mẫu, luồng dạng sơ đồ như Botcake, giá, ảnh, bám đuổi, quy tắc), chạy mô phỏng,
   xuất bản phiên bản, gắn bot vào Page. Agent trên VPS chỉ đọc phiên bản ĐANG DÙNG; nháp tự lưu nhưng agent chưa thấy.
   Luồng gửi một mạch rồi dừng, không chờ khách. Khách bấm nút thì chạy luồng của nút; khách nhắn chữ thì agent chọn
   luồng kế trong danh sách được phép; ngoài danh sách thì dừng và báo chị. Không có chế độ gửi cho khách thật.
   Chỉ CEO thấy. API: /api/agent-train (src/server/routes/agentTrain.ts); bộ chạy luồng dùng chung: src/shared/agentFlow.ts. */
(function(){
"use strict";
var HT_CSS=`<style id="ht-css">
#ht{--acc:var(--pink);--acc-soft:var(--pink-soft);--acc-ink:#fff;--ok:var(--green);--ok-soft:var(--green-soft);--warn:var(--orange);--warn-soft:var(--orange-soft);--bad:var(--red);--bad-soft:var(--red-soft);--chip:var(--gray-soft);--panel:var(--surface);--bg:var(--canvas)}
#ht .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#ht .between{justify-content:space-between}
#ht .sp{flex:1}
#ht .hint{color:var(--muted);font-size:13px}
#ht .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
#ht .num{text-align:right;font-variant-numeric:tabular-nums}
#ht label.f{display:block;margin-bottom:12px}
#ht label.f>span{display:block;font-weight:600;font-size:13px;margin-bottom:4px}
#ht .hinl{width:auto}
#ht input[type=checkbox]{width:auto;min-width:0;margin:0 6px 0 0;vertical-align:middle}
#ht .btn.ghost{border-color:transparent;background:none;color:var(--muted)}
#ht .btn:disabled{opacity:.5;cursor:default}
#ht .hph{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 16px}
#ht .hph h1{margin:0;font-size:22px;letter-spacing:-.01em}
#ht .main .hph h1{font-size:18px}
#ht .main .hph>div{min-width:0}
#ht .alert{padding:10px 14px;border-radius:12px;margin-bottom:12px;font-weight:600;font-size:14px}
#ht .alert.bad{background:var(--bad-soft);color:var(--bad)}
#ht .alert.warn{background:var(--warn-soft);color:var(--warn)}
#ht .kill{border:2px solid var(--bad);background:var(--bad-soft)}
#ht .tbl td,#ht .tbl th{vertical-align:top}
#ht .tbl td.num,#ht .tbl th.num{text-align:right}
#ht .tbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
#ht .tbar input{max-width:280px}
#ht .shell{display:grid;grid-template-columns:214px minmax(0,1fr);gap:16px;align-items:start}
#ht .hside{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);padding:8px;position:sticky;top:12px}
#ht .hside .sec{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:12px 10px 4px}
#ht .hside .sec:first-child{padding-top:6px}
#ht .hside button{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:none;padding:8px 10px;border-radius:10px;cursor:pointer;color:var(--ink);font-weight:500;font-size:14.5px}
#ht .hside button:hover{background:var(--gray-soft)}
#ht .hside button.on{background:var(--violet-soft);color:var(--violet);font-weight:700}
#ht .hside button.soon{color:var(--muted);cursor:default}
#ht .hside button.soon:hover{background:none}
#ht .hside .c{background:var(--gray-soft);border-radius:99px;font-size:11.5px;padding:0 8px;color:var(--muted);font-weight:600}
#ht .hside .c.soonc{background:var(--violet-soft);color:var(--violet)}
#ht .main{min-width:0}
#ht .two{display:grid;grid-template-columns:230px minmax(0,1fr);gap:14px;align-items:start}
#ht .list button.it{display:block;width:100%;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:9px 12px;margin-bottom:8px;cursor:pointer}
#ht .list button.it.on{border-color:var(--pink);background:var(--pink-soft)}
#ht .list button.it small{display:block;color:var(--muted)}
#ht .split{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:14px;align-items:start}
#ht .step{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px;background:var(--surface)}
#ht .step .n{width:26px;height:26px;border-radius:50%;background:var(--pink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12.5px}
#ht code{background:var(--gray-soft);border-radius:6px;padding:1px 6px;font-size:12.5px}
#ht .log{font-family:var(--fm);font-size:12.5px;background:var(--gray-soft);border-radius:10px;padding:10px 12px;overflow-x:auto;white-space:pre-wrap}
#ht .chat{display:flex;flex-direction:column;gap:8px;min-height:240px;max-height:420px;overflow-y:auto;padding:4px}
#ht .m{max-width:88%;padding:8px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word}
#ht .m.k{align-self:flex-start;background:var(--gray-soft)}
#ht .m.a{align-self:flex-end;background:var(--navy);color:#fff}
#ht .m.s{align-self:center;background:var(--red-soft);color:var(--red);font-weight:600;text-align:center}
#ht .m.i{align-self:flex-end;background:var(--blue-soft);color:var(--blue)}
#ht .imgs{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
#ht .imgs img{width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--line)}
#ht .phone{background:var(--canvas);border:6px solid var(--ink);border-radius:26px;padding:12px 10px;max-width:330px;margin:0 auto}
#ht .phone .chat{min-height:200px;max-height:360px}
#ht .bchip{display:inline-block;margin:6px 6px 0 0;padding:3px 10px;border:1px solid #fff;color:#fff;border-radius:99px;font-size:12.5px;font-weight:600;background:rgba(255,255,255,.14);cursor:pointer}
#ht .phone .bchip,#ht .m.a .bchip{border-color:#fff}
#ht .achip{border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:3px 12px;font-size:13px;cursor:pointer}
#ht .achip.on{background:var(--pink-soft);border-color:var(--pink);color:var(--pink);font-weight:700}
#ht .hchips{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
#ht .media{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px}
#ht .im{aspect-ratio:1;border-radius:10px;border:1px solid var(--line);background:var(--gray-soft);position:relative;overflow:hidden}
#ht .im img{width:100%;height:100%;object-fit:cover}
#ht .im button{position:absolute;right:4px;top:4px}
#ht .cvbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
#ht .cvw{overflow:auto;height:460px;border:1px solid var(--line);border-radius:12px;background-color:var(--canvas);background-image:radial-gradient(var(--line) 1px,transparent 1px);background-size:18px 18px;position:relative}
#ht .cv{position:relative;min-width:100%;min-height:100%}
#ht .edges{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}
#ht .edges path{fill:none;stroke:var(--pink);stroke-width:2}
#ht .nd{position:absolute;width:230px;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 2px 8px rgba(16,24,40,.08)}
#ht .nd.sel{border-color:var(--pink);box-shadow:0 0 0 2px var(--pink-soft)}
#ht .nd .nh{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--line);font-weight:700;font-size:12.5px;cursor:grab;touch-action:none;user-select:none}
#ht .nd.cond .nh{color:var(--orange)}#ht .nd.handoff .nh{color:var(--red)}#ht .nd.jump .nh{color:var(--blue)}#ht .nd.img .nh{color:var(--muted)}
#ht .nd .nb{padding:8px 10px;font-size:12.5px;word-break:break-word}
#ht .nd .dots{padding:4px 10px 8px;text-align:right;font-size:12px;color:var(--muted);display:flex;justify-content:flex-end;gap:12px}
#ht .dot{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--pink);margin-left:5px;cursor:crosshair;vertical-align:middle;border:2px solid var(--surface);box-shadow:0 0 0 1px var(--pink)}
#ht .media-note{margin:8px 0 0}
#ht .veil{position:fixed;inset:0;background:rgba(10,14,22,.45);z-index:950;display:flex;justify-content:flex-end}
#ht .hdrawer{width:min(460px,100%);height:100%;background:var(--surface);box-shadow:var(--shadow);display:flex;flex-direction:column}
#ht .hdrawer .dh{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line)}
#ht .hdrawer .db{padding:16px 18px;overflow-y:auto;flex:1}
#ht .hdrawer .df{padding:12px 18px 84px;border-top:1px solid var(--line);display:flex;gap:8px;justify-content:flex-end}
@container ht (max-width:900px){#ht .shell{grid-template-columns:1fr}#ht .hside{position:static;display:flex;flex-wrap:wrap;gap:2px}#ht .hside .sec{width:100%}#ht .hside button{width:auto}#ht .two,#ht .split{grid-template-columns:1fr}}

#ht .inbox{display:grid;grid-template-columns:270px minmax(0,1fr) 340px;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:var(--surface);height:calc(100vh - 150px);min-height:480px;box-shadow:var(--shadow)}
#ht .inbox>div{min-width:0}
#ht .cl{border-right:1px solid var(--line);overflow-y:auto;max-height:680px}
#ht .cft{padding:10px;border-bottom:1px solid var(--line);display:grid;gap:6px;position:sticky;top:0;background:var(--surface);z-index:1}
#ht .ci{padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer}
#ht .ci:hover{background:var(--gray-soft)}#ht .ci.on{background:var(--violet-soft)}
#ht .ci b{font-size:14px}
#ht .cl2{display:flex;justify-content:space-between;gap:8px;align-items:center}
#ht .cl2 .hint{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
#ht .un{background:var(--pink);color:#fff;border-radius:99px;font-size:11px;font-weight:700;padding:0 7px;flex:none}
#ht .tg{display:inline-block;font-size:11px;font-weight:700;padding:0 7px;border-radius:5px;margin:3px 4px 0 0;color:#fff}
#ht .cm2{display:flex;flex-direction:column;min-width:0;background:var(--canvas)}
#ht .chd{padding:10px 14px;border-bottom:1px solid var(--line);background:var(--surface);display:flex;justify-content:space-between;gap:8px;align-items:center}
#ht .thr{flex:1;overflow-y:auto;max-height:520px;padding:14px;display:flex;flex-direction:column;gap:8px}
#ht .tm{max-width:78%;padding:8px 12px;border-radius:12px;border:2px solid transparent;white-space:pre-wrap;word-break:break-word}
#ht .tm .src{display:block;font-size:11px;font-weight:700;margin-bottom:2px;opacity:.8}
#ht .tm.k{align-self:flex-start;background:var(--surface);border-color:var(--line)}
#ht .tm.a{align-self:flex-end;background:var(--navy);color:#fff;cursor:pointer}
#ht .tm.s2{align-self:flex-end;background:var(--blue-soft);color:var(--blue)}
#ht .tm.sys{align-self:center;background:var(--red-soft);color:var(--red);font-weight:600;cursor:pointer;text-align:center}
#ht .tm.pk{border-color:var(--pink)}
#ht .tm.wr{box-shadow:0 0 0 2px var(--red)}
#ht .tagbar{display:flex;flex-wrap:wrap;border-top:1px solid var(--line)}
#ht .tagbar button{flex:1;min-width:84px;border:0;color:#fff;font-size:11px;font-weight:700;padding:7px 4px;cursor:pointer;opacity:.5;letter-spacing:.02em}
#ht .tagbar button.on{opacity:1;box-shadow:inset 0 -3px 0 rgba(255,255,255,.7)}
#ht .comp{padding:12px 14px;background:var(--surface);border-top:1px solid var(--line);color:var(--muted);font-size:13px}
#ht .emp{margin:auto;color:var(--muted)}
#ht .rp{border-left:1px solid var(--line);overflow-y:auto;max-height:680px;padding:12px}
#ht .rp h4{margin:14px 0 6px;font-size:13px}
#ht .rpt h4:first-child{margin-top:0}
#ht .pvx{background:var(--gray-soft);border-radius:10px;padding:8px 10px;font-size:13px}
/* Màn Hội thoại co theo bề rộng khung trang (không theo màn hình), vì menu bên trái của web đã chiếm chỗ */

#ht .hwrap{container:ht/inline-size}
#ht .chd{flex-wrap:wrap}
#ht .chd>div{min-width:0}
#ht .rp,#ht .rpt{overflow-wrap:anywhere}
#ht .achip{white-space:normal;text-align:left}
#ht .thr{min-height:180px}

/* Màn Hội thoại giống bố cục Pancake: cao cả màn hình, cuộn riêng từng cột, thanh thẻ và ô nhập ghim ở đáy */
#ht .cl{display:flex;flex-direction:column;max-height:none;overflow:hidden}
#ht .cft{display:flex;flex-direction:column;gap:6px;padding:8px;position:static}
#ht .clist{flex:1;overflow-y:auto;min-height:0}
#ht .tgf{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
#ht .sq{width:18px;height:12px;border-radius:3px;cursor:pointer;opacity:.55}
#ht .sq.on,#ht .sq:hover{opacity:1;box-shadow:0 0 0 2px var(--ink)}
#ht .ci{display:flex;gap:10px;align-items:flex-start;padding:8px 10px}
#ht .av{width:38px;height:38px;border-radius:50%;background:var(--violet-soft);color:var(--violet);display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}
#ht .cib{min-width:0;flex:1}
#ht .cm2{height:100%;min-height:0}
#ht .chd{padding:6px 12px;gap:10px;justify-content:flex-start}
#ht .chd .av{width:32px;height:32px}
#ht .thr{flex:1;max-height:none;min-height:0}
#ht .rp{max-height:none;padding:0;display:flex;flex-direction:column;overflow:hidden}
#ht .rtabs{display:flex;border-bottom:1px solid var(--line)}
#ht .rtabs button{flex:1;border:0;background:none;padding:10px;cursor:pointer;font-weight:600;color:var(--muted);border-bottom:3px solid transparent}
#ht .rtabs button.on{color:var(--pink);border-bottom-color:var(--pink)}
#ht .rpb{padding:12px;overflow-y:auto;flex:1;min-height:0}
#ht .sect{font-weight:700;font-size:13px;margin:14px 0 6px;padding-top:10px;border-top:1px solid var(--line)}
@container ht (max-width:980px){#ht .inbox{grid-template-columns:240px minmax(0,1fr);height:auto}#ht .inbox .rp{grid-column:1 / -1;border-left:0;border-top:1px solid var(--line);max-height:420px}#ht .inbox .cl,#ht .inbox .cm2{height:calc(100vh - 200px);min-height:420px}}
@container ht (max-width:720px){#ht .inbox{grid-template-columns:1fr}#ht .inbox .cl{height:300px;min-height:0;border-right:0;border-bottom:1px solid var(--line)}}
#ht .tagbar{flex-wrap:nowrap}
#ht .tagbar button{min-width:0;font-size:10px;padding:6px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

#ht .demobar{background:var(--orange-soft);color:var(--orange);border-radius:10px;padding:8px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13.5px}
#ht .demobar.slim{background:none;padding:0;justify-content:flex-end}
#ht .dimg{margin-top:6px;border:1px dashed var(--line);border-radius:8px;padding:18px 10px;text-align:center;background:var(--gray-soft);color:var(--muted);font-size:12.5px}
#ht .tm.a .dimg{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.4);color:#fff}
#ht .ocard{margin-top:6px;background:var(--surface);color:var(--ink);border-radius:10px;padding:8px 10px;font-size:12.5px;border:1px solid var(--line)}
#ht .ord{border:1px solid var(--line);border-radius:10px;padding:8px 10px;display:grid;gap:4px;font-size:13px}
#ht .ordh{display:flex;justify-content:space-between;font-weight:700}
#ht .steps2{display:flex;gap:6px;flex-wrap:wrap;font-size:11.5px;color:var(--muted)}
#ht .steps2 .on{color:var(--orange);font-weight:700}
</style>`;
var api=function(p,o){return svApi("/api/agent-train"+p,o)};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function rid(p){return p+Math.random().toString(36).slice(2,8)}
function mk(a,id){for(var i=0;i<a.length;i++)if(a[i].id===id)return a[i];return null}
function fm(s){try{return new Date(s).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}catch(e){return s||""}}
function nowHM(){var d=new Date();return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)}

var ST={view:"home",hsub:"bp",bots:[],pages:[],ctl:{kill:false,testers:"",silent_minutes:30,hours_from:"",hours_to:""},hlog:[],runs:[],
  botId:"",name:"",doc:null,issues:[],versions:[],dirty:false,save:"saved",tab:"tt",sel:"",node:"",conn:null,drawer:null,toast:"",sec:"kb",demo:false,demoAll:null,rpTab:"info",tags:[],convs:null,cv:null,cvId:0,cvMsg:0,cvTag:0,cvQ:"",cvPage:"",
  xh:"",phone:false,chat:[],cur:null,simlog:[],root:null,pvTok:0,q:"",busy:false};

/* ---------- Tự lưu nháp ---------- */
var saveT=null;
function saveLabel(){
  if(ST.save==="pending"||ST.save==="saving")return "Đang lưu nháp…";
  if(ST.save==="error")return "Lưu nháp lỗi";
  return ST.dirty?"Đã lưu nháp · chưa xuất bản":"Đã xuất bản";
}
function updTop(){
  var l=document.getElementById("ht-save");if(l)l.textContent=saveLabel();
  var p=document.getElementById("ht-pub");if(p)p.disabled=!ST.dirty||ST.busy;
}
function touch(){ST.dirty=true;ST.save="pending";clearTimeout(saveT);saveT=setTimeout(flush,700);updTop()}
async function flush(){
  clearTimeout(saveT);
  if(ST.save!=="pending"||!ST.botId)return true;
  ST.save="saving";updTop();
  try{
    var r=await api("/bots/"+ST.botId,{method:"PUT",body:JSON.stringify({name:ST.name,draft:ST.doc})});
    ST.issues=r.issues;
    if(ST.save==="saving")ST.save="saved";
    updTop();updIssues();return true;
  }catch(e){ST.save="error";updTop();toast("Chưa lưu được nháp: "+e.message);return false}
}
function updIssues(){var b=document.getElementById("ht-issues");if(b)b.innerHTML=issuesBar()}
/* ---------- Tải dữ liệu ---------- */
async function loadHome(){
  try{
    var r=await Promise.all([api("/bots"),api("/pages"),api("/control")]);
    ST.bots=r[0];ST.pages=r[1];ST.ctl=r[2];
  }catch(e){toast("Chưa tải được: "+e.message)}
  draw();
}
async function loadBot(id,keepTab){
  var r=await api("/bots/"+id);
  ST.botId=id;try{ST.tags=await api("/tags");ST.pages=await api("/pages")}catch(e){}ST.name=r.name;ST.doc=r.draft;ST.issues=r.issues;ST.versions=r.versions;ST.dirty=r.dirty;ST.save="saved";
  if(!keepTab){ST.tab="tc";ST.sec="kb";ST.chat=[];ST.cur=null;ST.simlog=[]}
  if(!mk(ST.doc.flows,ST.sel))ST.sel=(ST.doc.flows[0]||{}).id||"";
  var f=mk(ST.doc.flows,ST.sel);if(!f||!mk(f.nodes,ST.node))ST.node=f&&f.nodes[0]?f.nodes[0].id:"";
  ST.conn=null;
}
async function openBot(id){
  try{await loadBot(id);ST.view="bot";draw()}catch(e){toast("Chưa mở được bot: "+e.message)}
}
async function goHome(){
  await flush();ST.view="home";ST.botId="";ST.doc=null;await loadHome();
}
function D(){return ST.doc}
function pageOfBot(){return ST.pages.filter(function(p){return p.bot_id===ST.botId})[0]||null}
function pc(c){return {ok:"p-grn",warn:"p-amb",bad:"p-red",blue:"p-blu",gray:"p-gry",acc:"p-pnk"}[c]||c}
function modePill(m){return m==="tester"?'<span class="pill p-amb">Chỉ thử tài khoản chị</span>':'<span class="pill p-gry">Tắt</span>'}

/* ---------- Vẽ ---------- */
function draw(){
  var root=ST.root;if(!root||!root.isConnected)return;
  var cvOld=document.getElementById("cvw"),sl=cvOld?cvOld.scrollLeft:0,stp=cvOld?cvOld.scrollTop:0;
  var focusId=document.activeElement&&document.activeElement.id==="simin"?"simin":(document.activeElement&&(document.activeElement.id==="q"||document.activeElement.id==="cvq")?document.activeElement.id:"");
  var keepV=focusId?document.activeElement.value:null,keepPos=focusId&&document.activeElement.selectionStart;
  root.innerHTML='<div class="hwrap">'+topbar()+'<div id="ht-issues">'+(ST.view==="bot"?issuesBar():"")+"</div>"+
    (ST.ctl.kill?'<div class="alert bad">ĐANG TẮT KHẨN: mọi agent ngừng trả lời ở tất cả Page. Bấm "Gỡ tắt khẩn" để bật lại.</div>':"")+
    (ST.view==="inbox"?hl():ST.view==="home"?home():botView())+"</div>"+(ST.drawer?drawerHtml():"");
  if(keepV!==null){var el=document.getElementById(focusId);if(el){el.value=keepV;el.focus();try{el.setSelectionRange(keepPos,keepPos)}catch(e){}}}
  var ch=document.getElementById("chat");if(ch)ch.scrollTop=ch.scrollHeight;
  var thr=document.getElementById("thr");if(thr)thr.scrollTop=thr.scrollHeight;
  var cvNew=document.getElementById("cvw");if(cvNew){cvNew.scrollLeft=sl;cvNew.scrollTop=stp}
  drawEdges();
  if(ST.view==="bot"&&ST.tab==="tc"&&!ST.drawer)loadPreview();
}
function topbar(){
  if(ST.view==="inbox")return '<div class="hph"><h1>Hội thoại</h1><span class="hint">Tin khách và agent trả lời, như hộp thư Pancake · chỉ chị xem</span><span class="sp"></span><button class="btn '+(ST.ctl.kill?"pri":"danger")+'" data-act="kill">'+(ST.ctl.kill?"Gỡ tắt khẩn":"TẮT KHẨN")+"</button></div>";
  var kill='<button class="btn '+(ST.ctl.kill?"pri":"danger")+'" data-act="kill">'+(ST.ctl.kill?"Gỡ tắt khẩn":"TẮT KHẨN")+"</button>";
  if(ST.view!=="bot")return '<div class="hph"><h1>Huấn luyện agent</h1><span class="hint">Dạy agent bán hàng trực Page · agent chỉ dùng bản đã xuất bản</span><span class="sp"></span>'+kill+"</div>";
  var pg=pageOfBot();
  return '<div class="hph"><button class="btn sm" data-act="home">← Tất cả bot</button><h1>'+esc(ST.name)+"</h1>"+(pg?modePill(pg.mode):'<span class="pill p-gry">Chưa gắn Page</span>')+'<span class="sp"></span><span class="hint" id="ht-save">'+saveLabel()+'</span><button class="btn pri" id="ht-pub" data-act="publish"'+(ST.dirty&&!ST.busy?"":" disabled")+">Xuất bản</button>"+kill+"</div>";
}
function issuesBar(){
  var er=ST.issues.filter(function(i){return i.level==="error"}),wr=ST.issues.filter(function(i){return i.level==="warn"});
  if(!er.length&&!wr.length)return "";
  return '<div class="alert '+(er.length?"bad":"warn")+'" style="font-weight:500">'+(er.length?'<b>'+er.length+" lỗi cần sửa trước khi xuất bản:</b> "+esc(er[0].msg)+(er.length>1?" (và "+(er.length-1)+" lỗi nữa, xem tab Tổng quan)":""):"<b>"+wr.length+" cảnh báo:</b> "+esc(wr[0].msg)+(wr.length>1?" (xem tab Tổng quan)":""))+"</div>";
}
function homeTabs(){
  var subs=[["bp","Bot"],["pg","Page"],["ctl","Điều khiển chung"],["log","Nhật ký"]];
  return '<div class="tabs">'+subs.map(function(s){return '<button data-act="hsub" data-id="'+s[0]+'" class="'+(ST.hsub===s[0]?"on":"")+'">'+s[1]+"</button>"}).join("")+"</div>";
}
function home(){
  var bar=homeTabs();
  if(ST.hsub==="ctl")return bar+homeCtl();
  if(ST.hsub==="log")return bar+homeLog();
  if(ST.hsub==="pg")return bar+homePages();
  return bar+homeBots();
}
function homeBots(){
  var q=(ST.q||"").toLowerCase();
  var rows=ST.bots.filter(function(b){return !q||b.name.toLowerCase().indexOf(q)>=0}).map(function(b){
    var pg=b.pages.length?b.pages.map(function(p){return esc(p.name)+" "+modePill(p.mode)}).join("<br>"):'<span class="hint">chưa gắn Page</span>';
    var st=(b.current_version?'<span class="pill p-grn">Đã xuất bản · bản '+b.current_version+"</span>":'<span class="pill p-gry">Chưa xuất bản</span>')+(b.dirty&&b.current_version?' <span class="pill p-amb">Có thay đổi chưa xuất bản</span>':"");
    return "<tr><td><b>"+esc(b.name)+'</b><br><span class="hint">'+b.counts.flows+" luồng · "+b.counts.lib+" câu mẫu · "+b.counts.offers+" mức giá</span></td><td>"+pg+"</td><td>"+st+'</td><td class="num">'+b.runs.sent+'</td><td class="num">'+b.runs.handoff+'</td><td class="num">'+(b.runs.blocked+b.runs.out_of_script)+"</td><td>"+fm(b.updated_at)+'</td><td><div class="row"><button class="btn pri sm" data-act="openbot" data-id="'+b.id+'">Mở</button><button class="btn sm" data-act="clonebot" data-id="'+b.id+'">Nhân bản</button><button class="btn sm" data-act="delbot" data-id="'+b.id+'">Xóa</button></div></td></tr>'}).join("");
  return '<div class="tbar"><input type="text" id="q" placeholder="Tìm bot…" value="'+esc(ST.q||"")+'"><span class="sp"></span><button class="btn pri" data-act="newbot">+ Tạo bot</button></div>'+
   (ST.bots.length?'<div class="tbl"><table><thead><tr><th>Bot</th><th>Page đang dùng</th><th>Trạng thái</th><th class="num">Đã gửi (7 ngày)</th><th class="num">Chuyển chị</th><th class="num">Dừng / chặn</th><th>Cập nhật</th><th></th></tr></thead><tbody>'+rows+"</tbody></table></div>":'<div class="card hint">Chưa có bot nào. Bấm "+ Tạo bot" để bắt đầu.</div>')+
   '<p class="hint" style="margin-top:10px">Mỗi Page gắn với một bot. Nhiều Page dùng chung một bot, hoặc nhân bản bot để chỉnh riêng cho Page khác. Số liệu 7 ngày lấy từ nhật ký agent.</p>';
}
function homePages(){
  var pages=ST.pages.map(function(p){
    var opts='<option value="">(chưa gắn bot)</option>'+ST.bots.map(function(b){return '<option value="'+b.id+'"'+(p.bot_id===b.id?" selected":"")+">"+esc(b.name)+"</option>"}).join("");
    return "<tr><td><b>"+esc(p.name)+'</b><br><span class="hint">'+esc(p.fb_page_id)+'</span></td><td><select data-act="pagebot" data-id="'+p.id+'">'+opts+"</select></td><td>"+modePill(p.mode)+'</td><td><select class="hinl" data-act="pagemode" data-id="'+p.id+'"><option value="off"'+(p.mode==="off"?" selected":"")+'>Tắt</option><option value="tester"'+(p.mode==="tester"?" selected":"")+'>Chỉ thử tài khoản chị</option></select></td><td><button class="btn sm ghost" data-act="delpage" data-id="'+p.id+'" aria-label="Xóa Page">✕</button></td></tr>'}).join("");
  return '<div class="tbar"><span class="hint">Page Facebook và bot đang chạy cho từng Page.</span><span class="sp"></span><button class="btn pri" data-act="newpage">+ Thêm Page</button></div>'+
   (ST.pages.length?'<div class="tbl"><table><thead><tr><th>Page</th><th>Bot đang dùng</th><th>Trạng thái</th><th>Chế độ</th><th></th></tr></thead><tbody>'+pages+"</tbody></table></div>":'<div class="card hint">Chưa có Page. Thêm Page (tên và id Page Facebook) rồi gắn bot.</div>')+
   '<p class="hint" style="margin-top:10px">Chỉ bật thử được khi bot đã xuất bản. Chế độ gửi cho khách thật chưa có ở đây: chị duyệt riêng rồi mới mở.</p>';
}
function homeCtl(){
  var c=ST.ctl;
  return '<div class="hph"><div><h1>Điều khiển chung</h1><div class="hint">Áp dụng cho mọi Page.</div></div></div>'+
   '<div class="card kill"><div class="row between"><div><h3 style="margin:0">Nút tắt khẩn</h3><span class="hint">Bật là agent ngừng ngay ở mọi Page: gói kịch bản trả về trống nên không còn câu nào để gửi.</span></div><button class="btn '+(c.kill?"pri":"danger")+'" data-act="kill">'+(c.kill?"Gỡ tắt khẩn":"TẮT KHẨN")+"</button></div></div>"+
   '<div class="card"><h3>Thiết lập</h3><label class="f"><span>Tài khoản thử được phép (tên hoặc mã Facebook, cách nhau dấu phẩy)</span><input type="text" id="c_testers" value="'+esc(c.testers||"")+'"></label>'+
   '<label class="f"><span>Nhân viên nhắn tay thì agent im trong (phút)</span><input type="number" id="c_silent" min="1" max="1440" value="'+(c.silent_minutes||30)+'"></label>'+
   '<label class="f"><span>Khung giờ agent được trả lời (để trống = cả ngày)</span><span class="row"><input type="time" id="c_hf" style="max-width:150px" value="'+esc(c.hours_from||"")+'"><input type="time" id="c_ht" style="max-width:150px" value="'+esc(c.hours_to||"")+'"></span></label>'+
   '<div class="hint" style="margin-bottom:10px">Câu khách hỏi ngoài kịch bản đã xuất bản: agent dừng và báo chị, không dùng kiến thức chung để đoán.</div><button class="btn pri" data-act="savectl">Lưu thiết lập</button></div>';
}
var ACT={"bot.create":"Tạo bot","bot.delete":"Xóa bot","bot.publish":"Xuất bản","page.add":"Thêm Page","page.update":"Sửa Page","page.delete":"Xóa Page","control.kill":"BẬT tắt khẩn","control.unkill":"Gỡ tắt khẩn","control.save":"Lưu thiết lập"};
var RES={sent:["Đã gửi","ok"],handoff:["Chuyển chị","bad"],blocked:["Bị chặn","warn"],out_of_script:["Ngoài kịch bản","bad"],skipped:["Bỏ qua","gray"]};
function homeLog(){
  var h=ST.hlog.length?'<div class="tbl"><table><thead><tr><th>Lúc</th><th>Ai</th><th>Việc</th><th>Chi tiết</th></tr></thead><tbody>'+ST.hlog.map(function(l){return "<tr><td>"+fm(l.at)+"</td><td>"+esc(l.by_name||"")+"</td><td>"+esc(ACT[l.action]||l.action)+"</td><td>"+esc(l.detail)+"</td></tr>"}).join("")+"</tbody></table></div>":'<span class="hint">Chưa có thay đổi nào.</span>';
  var r=ST.runs.length?'<div class="tbl"><table><thead><tr><th>Lúc</th><th>Page</th><th>Bản</th><th>Luồng</th><th>Kết quả</th><th>Khách nói (đã che thông tin)</th></tr></thead><tbody>'+ST.runs.map(function(x){var q=RES[x.result]||[x.result,"gray"];return "<tr><td>"+fm(x.at)+"</td><td>"+esc(x.fb_page_id)+"</td><td>"+(x.version||"")+"</td><td>"+esc(x.flow)+'</td><td><span class="pill '+pc(q[1])+'">'+q[0]+"</span>"+(x.note?'<br><span class="hint">'+esc(x.note)+"</span>":"")+"</td><td>"+esc(x.customer)+"</td></tr>"}).join("")+"</tbody></table></div>":'<span class="hint">Chưa có lượt nào. Khi công cụ trên VPS nối vào, mỗi lượt agent trả lời hay dừng sẽ ghi ở đây, kèm phiên bản và luồng đã chọn.</span>';
  return '<div class="hph"><div><h1>Nhật ký</h1></div></div><div class="card"><h3>Agent đã làm gì</h3>'+r+'</div><div class="card"><h3>Lịch sử chỉnh sửa</h3>'+h+"</div>";
}
/* Cách đặt tab học từ Pancake (thanh tab trên: Hội thoại, Thống kê, Cài đặt; trong Cài đặt có menu trái), Botcake (Cơ bản / Nâng cao), Preny (Thiết lập nhanh / Cài đặt nâng cao). Mục "Sắp có" chưa làm. */
var NAV=[
  {k:"hl",n:"Đề xuất",soon:1,items:[["dx","Đề xuất"]]},
  {k:"kb",n:"Kịch bản",items:[["tc","Luồng kịch bản"],["cm","Câu mẫu"],["sp","Sản phẩm &amp; giá"],["md","Ảnh / video"],["bd","Bám đuổi"]]},
  {k:"tk",n:"Thống kê",soon:1,items:[["tk","Thống kê luồng"]]},
  {k:"kt",n:"Thử &amp; xuất bản",items:[["ms","Mô phỏng"],["pb","Phiên bản"]]},
  {k:"cd",n:"Cài đặt",items:[["tt","Cài đặt chung"],["qt","Quy tắc &amp; chuyển người"],["th","Thẻ hội thoại"]]}
];
function secOf(t){for(var i=0;i<NAV.length;i++)for(var j=0;j<NAV[i].items.length;j++)if(NAV[i].items[j][0]===t)return NAV[i].k;return "kb"}
function badge(t){var b=D();return t==="tc"?b.flows.length:t==="cm"?b.lib.length:t==="sp"?b.offers.length:t==="md"?b.media.reduce(function(a,x){return a+x.urls.length},0):t==="bd"?b.follow.length:""}
function soonPage(title,sub,bullets,ask){
  return '<div class="hph"><div><h1>'+title+'</h1><div class="hint">'+sub+'</div></div><span class="pill p-gry">Sắp có</span></div><div class="card"><b>Sẽ có gì</b><ul style="margin:8px 0 0;padding-left:20px">'+bullets.map(function(x){return "<li>"+x+"</li>"}).join("")+"</ul>"+(ask?'<p class="hint" style="margin:10px 0 0">'+ask+"</p>":"")+"</div>";
}
var TCOL={gray:"#667085",blue:"var(--blue)",grn:"var(--green)",amb:"var(--orange)",red:"var(--red)",pnk:"var(--pink)",vio:"var(--violet)"};
var TCOLN={gray:"Xám",blue:"Xanh dương",grn:"Xanh lá",amb:"Cam",red:"Đỏ",pnk:"Hồng",vio:"Tím"};
function tagById(id){for(var i=0;i<ST.tags.length;i++)if(ST.tags[i].id===id)return ST.tags[i];return null}
function tagChip(id){var t=tagById(id);return t?'<span class="tg" style="background:'+TCOL[t.color]+'">'+esc(t.name)+"</span>":""}
function fmT(s){try{var d=new Date(s);return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)}catch(e){return ""}}
var WHO={customer:"Khách",agent:"Agent",sale:"Nhân viên",system:"Agent dừng"};
async function loadConvs(keepDetail){
  if(ST.demo){
    var all=demoData();
    ST.convs=all.filter(function(c){return (!ST.cvTag||c.tag_ids.indexOf(ST.cvTag)>=0)&&(!ST.cvQ||(c.name+c.last_text).toLowerCase().indexOf(ST.cvQ.toLowerCase())>=0)});
    ST.demoAll=ST.demoAll||all;
    if(!ST.cvId&&ST.convs.length)loadConv(ST.convs[0].id,true);
    draw();return;
  }
  try{
    var qs=[];if(ST.cvTag)qs.push("tag="+ST.cvTag);if(ST.cvQ)qs.push("q="+encodeURIComponent(ST.cvQ));
    ST.convs=await api("/convs"+(qs.length?"?"+qs.join("&"):""));
    if(ST.cvId&&keepDetail!==false)await loadConv(ST.cvId,true);
    else if(!ST.cvId&&ST.convs.length)await loadConv(ST.convs[0].id,true);
  }catch(e){toast("Chưa tải được hội thoại: "+e.message)}
  draw();
}
async function loadConv(id,quiet){
  if(ST.demo){
    ST.demoAll=ST.demoAll||demoData();
    var d=ST.demoAll.filter(function(c){return c.id===id})[0];
    if(d){ST.cv=d;ST.cvId=id;d.unread=0;var r0=ST.convs.filter(function(x){return x.id===id})[0];if(r0)r0.unread=0}
    if(!quiet)draw();return;
  }
  try{
    ST.cv=await api("/convs/"+id);ST.cvId=id;
    var r=ST.convs.filter(function(x){return x.id===id})[0];
    if(r&&r.unread){r.unread=0;api("/convs/"+id+"/read",{method:"POST",body:"{}"}).catch(function(){})}
    if(ST.cvMsg&&!ST.cv.messages.some(function(m){return m.id===ST.cvMsg}))ST.cvMsg=0;
  }catch(e){ST.cv=null;ST.cvId=0;if(!quiet)toast(e.message)}
  if(!quiet)draw();
}
function demoData(){
  var now=Date.now(),iso=function(m){return new Date(now-m*60000).toISOString()};
  var T=function(n){var t=ST.tags.filter(function(x){return x.name===n})[0];return t?t.id:0};
  var ids=function(a){return a.map(T).filter(Boolean)};
  var A=function(m,t,fl,why,got,extra){return Object.assign({id:0,at:iso(m),who:"agent",text:t,flow:fl,version:3,why:why,got:got,wrong:0,wrong_note:""},extra||{})};
  var K=function(m,t,extra){return Object.assign({id:0,at:iso(m),who:"customer",text:t,flow:"",version:null,why:"",got:"",wrong:0,wrong_note:""},extra||{})};
  var convs=[
   {name:"Chị Lan (ví dụ)",tags:["ĐÃ MUA HÀNG","Tẩy lồng"],unread:0,note:"Khách chốt nhanh, nhà có 2 máy.",
    order:{code:"73595",status:1,items:"Tẩy lồng máy giặt x 2",money:"269.000đ",name:"Chị Lan",phone:"09******22",addr:"Thôn Hoàng Yên, Chư Prông, Gia Lai",ship:"SPX · mã vận đơn SPXVN06*****A",cod:"Thanh toán khi giao hàng (COD)",waiting:false},
    msgs:[K(190,"shop ơi cho mình hỏi giá tẩy lồng"),
     A(189,"Dạ em gửi chị xem hình thực tế để mình dễ hình dung sản phẩm trước ạ.","TL-02 Báo giá","Khách hỏi giá, khớp từ khóa của TL-02.","Câu mẫu GIA_01 · ảnh nhóm TEST",{img:"Ảnh test thực tế (6 ảnh)"}),
     A(189,"Hiện công ty đang có chương trình sale nhiều ưu đãi và quà tặng ạ. Máy nhà chị là lồng đứng hay lồng ngang, gioăng cao su có mốc không để em gửi combo phù hợp nhất nhé?","TL-02 Báo giá","Khách hỏi giá thì dẫn bằng hình rồi hỏi 2 dữ kiện để chọn nhóm combo.","Câu mẫu GIA_02"),
     K(180,"lồng ngang, gioăng không mốc"),
     A(179,"Dạ với máy lồng ngang không mốc, em gửi chị bảng giá Tẩy lồng ạ 👉","TL-03 Báo giá Tẩy lồng","Khách trả lời lồng ngang, không mốc: nhánh Tẩy lồng.","Bảng giá Tẩy lồng (4 gói) · ảnh nhóm LONG",{img:"Bảng giá Tẩy lồng (4 ảnh)"}),
     K(170,"lấy 2 lọ nhé, ship về Gia Lai"),
     A(169,"Dạ chị cho em xin tên người nhận, số điện thoại và địa chỉ nhận hàng để em ghi nhận đơn cho chị ạ.","TL-05 Chốt","Khách đã chọn gói: xin thông tin nhận hàng ngay, không hỏi xác nhận.","Câu mẫu XIN_TT_01"),
     K(165,"Chị Lan, 09******22, Thôn Hoàng Yên, Chư Prông, Gia Lai"),
     A(164,"Dạ em đã ghi nhận đơn của chị, bên em báo kho đi đơn cho chị rồi ạ.","TL-05 Chốt","Đủ tên, số điện thoại, địa chỉ: lập đơn chờ xác nhận.","Đơn 73595 (chờ xác nhận) · câu mẫu DA_NHAN_DON",{order:true})]},
   {name:"Anh Hùng (ví dụ)",tags:["HỎI GIÁ SỈ"],unread:1,note:"",order:null,
    msgs:[K(75,"bên em có giá sỉ không, mình lấy 50 hộp"),
     A(74,"Dạ để em hỏi lại bộ phận kinh doanh về giá sỉ rồi báo anh ngay nhé ạ.","SI-01 Giá sỉ","Khách hỏi giá sỉ: không báo giá, chuyển người thật.","Luồng chuyển chị Hoa, không gửi giá",{who:"system"})]},
   {name:"Chị Mai (ví dụ)",tags:["ĐÃ BÁO GIÁ","Tẩy lồng"],unread:2,note:"",order:null,
    msgs:[K(30,"xin chào"),
     A(29,"Dạ em chào chị ạ 🌸 Nhà mình dùng máy lồng đứng hay lồng ngang vậy ạ?","TL-01 Mở đầu","Khách chào: chạy luồng mở đầu.","Câu mẫu CHAO_01"),
     K(12,"đắt quá, bên khác bán rẻ hơn"),
     A(11,"Ngoài kịch bản đã có. Agent dừng và báo chị Hoa, không đoán.","-","Chưa có câu chê đắt được duyệt trong bản này.","Không gửi gì cho khách",{who:"system"}),
     K(5,"sao không ai trả lời vậy")]},
   {name:"Anh Nam (ví dụ)",tags:["CÂU HỎI"],unread:0,note:"",order:null,
    msgs:[K(1500,"tẩy lồng có làm hỏng máy giặt không shop"),
     A(1499,"Ngoài kịch bản đã có. Agent dừng và báo chị Hoa, không đoán.","-","Không có luồng nào khớp câu về độ an toàn của máy.","Đây là chỗ nên thêm luồng mới",{who:"system"}),
     {id:0,at:iso(1480),who:"sale",text:"Dạ sản phẩm an toàn cho máy anh nhé, anh dùng đúng hướng dẫn ạ.",flow:"",version:null,why:"",got:"",wrong:0,wrong_note:""}]}
  ];
  var n=1000;
  return convs.map(function(c,i){
    var last=c.msgs[c.msgs.length-1];
    c.msgs.forEach(function(m){m.id=n++});
    return {id:-(i+1),fb_page_id:"demo",name:c.name,page_name:"Ailla Việt Nam Store",bot_name:"Bot mẫu",note:c.note,unread:c.unread,last_at:last.at,last_text:last.text.slice(0,120),last_who:last.who,tag_ids:ids(c.tags),messages:c.msgs,order:c.order};
  });
}
function msgBody(m){
  var s=esc(m.text);
  if(m.img)s+='<div class="dimg">🖼 '+esc(m.img)+"</div>";
  if(m.order&&ST.cv&&ST.cv.order){var o=ST.cv.order;s+='<div class="ocard"><b>Xác nhận đơn đặt hàng</b><div>'+esc(o.items)+"</div><div>Đơn "+esc(o.code)+" · "+esc(o.money)+"</div><div>"+esc(o.name)+" · "+esc(o.phone)+"</div><div>"+esc(o.addr)+"</div></div>"}
  return s;
}
function orderPanel(cv){
  var o=cv.order;
  if(!o)return '<div class="sect">Đơn hàng (0)</div><div class="hint">Chưa có đơn. Khi nối Pancake POS, agent lập đơn ở đây ở trạng thái chờ xác nhận.</div>';
  var steps=["Mới","Chờ chuyển hàng","Đã gửi hàng","Hủy"];
  return '<div class="sect">Đơn hàng (1)</div><div class="ord"><div class="ordh">'+esc(o.code)+' <span class="pill p-amb">Chờ xác nhận</span></div><div class="steps2">'+steps.map(function(s,i){return '<span class="'+(i===o.status?"on":"")+'">'+s+"</span>"}).join("")+"</div><div>"+esc(o.name)+"</div><div class=\"hint\">"+esc(o.addr)+"</div><div>"+esc(o.phone)+"</div><div><b>"+esc(o.items)+"</b></div><div><b>"+esc(o.money)+"</b> · "+esc(o.cod)+"</div><div class=\"hint\">Vận chuyển: "+esc(o.ship)+"</div></div>";
}
function hl(){
  var pages=ST.pages.filter(function(p){return p.bot_id===ST.botId});
  var showPages=ST.cvPage==="all"||!pages.length?null:pages.map(function(p){return p.fb_page_id});
  var list=(ST.convs||[]).filter(function(c){return !showPages||showPages.indexOf(c.fb_page_id)>=0});
  var stage=ST.tags.filter(function(t){return t.kind==="stage"}),prod=ST.tags.filter(function(t){return t.kind==="product"});
  var filt='<div class="tgf">'+ST.tags.map(function(t){return '<span class="sq'+(ST.cvTag===t.id?" on":"")+'" style="background:'+TCOL[t.color]+'" data-act="cvfilt" data-id="'+t.id+'" title="Lọc: '+esc(t.name)+'"></span>'}).join("")+(ST.cvTag?'<span class="hint" style="cursor:pointer" data-act="cvfilt" data-id="0">bỏ lọc</span>':"")+"</div>";
  var lhtml=list.map(function(c){
    var sel=ST.cvId===c.id,ini=(c.name||"K").trim().charAt(0).toUpperCase();
    return '<div class="ci'+(sel?" on":"")+'" data-act="cv" data-id="'+c.id+'"><span class="av">'+esc(ini)+'</span><div class="cib"><div class="row between" style="flex-wrap:nowrap"><b>'+esc(c.name||"Khách "+c.id)+'</b><span class="hint" style="flex:none">'+fm(c.last_at)+'</span></div><div class="cl2"><span class="hint">'+(c.last_who==="agent"?"Agent: ":c.last_who==="sale"?"NV: ":c.last_who==="system"?"Agent dừng: ":"")+esc(c.last_text)+"</span>"+(c.unread?'<span class="un">'+c.unread+"</span>":"")+"</div><div>"+c.tag_ids.map(tagChip).join("")+"</div></div></div>"}).join("")||'<div class="ci hint">Chưa có hội thoại nào'+(ST.cvTag||ST.cvQ?" khớp bộ lọc":". Khi công cụ trên VPS đẩy tin lên, hội thoại sẽ hiện ở đây")+".</div>";
  var cv=ST.cv,mid="",right="";
  if(cv){
    var sel=ST.cvMsg?cv.messages.filter(function(m){return m.id===ST.cvMsg})[0]:null;
    mid='<div class="chd"><span class="av">'+esc((cv.name||"K").trim().charAt(0).toUpperCase())+'</span><div style="min-width:0"><b>'+esc(cv.name||"Khách "+cv.id)+'</b><div class="hint">'+esc(cv.page_name||cv.fb_page_id)+(cv.bot_name?" · bot "+esc(cv.bot_name):"")+'</div></div><span class="sp"></span><button class="btn sm danger" data-act="cvdel" data-id="'+cv.id+'">Xóa khỏi web</button></div>'+
     '<div class="thr" id="thr">'+cv.messages.map(function(m){
       var cls=m.who==="customer"?"k":m.who==="agent"?"a":m.who==="sale"?"s2":"sys";
       var src=m.who==="agent"?"Agent"+(m.flow?" · "+esc(m.flow):"")+(m.version?" · bản "+m.version:""):(WHO[m.who]||m.who)+(m.who==="system"&&m.flow?" · "+esc(m.flow):"");
       var click=m.who==="agent"||m.who==="system";
       return '<div class="tm '+cls+(ST.cvMsg===m.id?" pk":"")+(m.wrong?" wr":"")+'"'+(click?' data-act="msgsel" data-id="'+m.id+'"':"")+'><span class="src">'+src+" · "+fmT(m.at)+(m.wrong?" · đã đánh dấu sai":"")+"</span>"+msgBody(m)+"</div>"}).join("")+"</div>"+
     '<div class="tagbar">'+stage.map(function(t){var on=cv.tag_ids.indexOf(t.id)>=0;return '<button class="'+(on?"on":"")+'" style="background:'+TCOL[t.color]+'" data-act="cvtag" data-id="'+t.id+'" title="'+(on?"Bỏ thẻ":"Gắn thẻ")+'">'+esc(t.name)+"</button>"}).join("")+"</div>"+
     '<div class="comp">Chỉ xem. Trả lời khách ở Pancake. Tin ở đây đã che số điện thoại, email, link.</div>';
    var tabs='<div class="rtabs"><button data-act="rptab" data-id="info" class="'+(ST.rpTab==="info"?"on":"")+'">Thông tin</button><button data-act="rptab" data-id="order" class="'+(ST.rpTab==="order"?"on":"")+'">Tạo đơn</button></div>';
    if(ST.rpTab==="order"){
      right=tabs+'<div class="rpb"><span class="pill p-gry">Sắp có</span><p class="hint" style="margin:8px 0 0">Khi nối Pancake POS, agent lập đơn ở trạng thái "chờ xác nhận" từ thông tin khách đã gửi (tên, số điện thoại, địa chỉ, combo). Chị hoặc nhân viên duyệt ở Pancake.</p></div>';
    }else{
      right=tabs+'<div class="rpb"><div class="hint">Khách: <b style="color:var(--ink)">'+esc(cv.name||"(chưa có tên)")+'</b></div><div class="hint">Tin gần nhất: '+fm(cv.last_at)+"</div>"+
       '<textarea data-act="cvnote" placeholder="Nhập ghi chú…" style="min-height:64px;margin:8px 0">'+esc(cv.note||"")+"</textarea>"+
       orderPanel(cv)+
       '<div class="sect">Thẻ giai đoạn</div><div>'+(stage.map(function(t){return '<span class="achip'+(cv.tag_ids.indexOf(t.id)>=0?" on":"")+'" data-act="cvtag" data-id="'+t.id+'">'+esc(t.name)+"</span> "}).join("")||'<span class="hint">Chưa có thẻ giai đoạn.</span>')+'</div><div class="sect">Thẻ sản phẩm</div><div>'+(prod.map(function(t){return '<span class="achip'+(cv.tag_ids.indexOf(t.id)>=0?" on":"")+'" data-act="cvtag" data-id="'+t.id+'">'+esc(t.name)+"</span> "}).join("")||'<span class="hint">Chưa có. Thêm ở Cài đặt, Thẻ hội thoại.</span>')+"</div>"+
       (sel?'<div class="sect">Vì sao agent làm vậy</div><div class="pvx">'+esc(sel.why||"Chưa có lý do (công cụ VPS chưa gửi kèm).")+'</div><div class="sect">Agent đã lấy gì</div><div class="log">'+esc(sel.got||"Chưa có dữ liệu.")+'</div><div class="row" style="margin-top:8px"><button class="btn sm'+(sel.wrong?" danger":"")+'" data-act="wrongmsg" data-id="'+sel.id+'">'+(sel.wrong?"Bỏ đánh dấu sai":"Agent trả lời sai")+'</button>'+(sel.who==="agent"?'<button class="btn sm pri" data-act="mkphrase" data-id="'+sel.id+'">Tạo câu mẫu từ tin này</button>':"")+"</div>":'<div class="sect">Chi tiết tin</div><p class="hint">Bấm vào một tin của agent (bong bóng xanh đậm hoặc đỏ) để xem vì sao agent chọn luồng đó và đã lấy gì.</p>')+"</div>";
    }
  }else{mid='<div class="emp">Chọn một hội thoại ở bên trái</div>';right='<div class="rpb hint">Chưa chọn hội thoại.</div>'}
  var pgsel=pages.length>1?'<select data-act="cvpage"><option value="">Page của bot này</option><option value="all"'+(ST.cvPage==="all"?" selected":"")+">Tất cả Page</option></select>":"";
  var empty=!ST.demo&&!(ST.convs||[]).length;
  var bar=ST.demo?'<div class="demobar"><b>BẢN MẪU</b> khách, hội thoại và đơn dưới đây chỉ là ví dụ để chị xem giao diện, không phải dữ liệu thật và không lưu gì. <button class="btn sm" data-act="demooff">Thoát bản mẫu</button></div>':(empty?'<div class="demobar">Chưa có hội thoại thật (chờ nối công cụ VPS). <button class="btn sm pri" data-act="demoon">Xem bản mẫu</button></div>':'<div class="demobar slim"><button class="btn sm" data-act="demoon">Xem bản mẫu</button></div>');
  return bar+'<div class="inbox"><div class="cl"><div class="cft"><input type="text" id="cvq" placeholder="Tìm kiếm" value="'+esc(ST.cvQ||"")+'">'+pgsel+filt+'</div><div class="clist">'+lhtml+'</div></div><div class="cm2">'+mid+'</div><div class="rp">'+right+"</div></div>";
}
function dx(){return soonPage("Đề xuất","Hệ thống đọc hội thoại rồi đề xuất cải tiến, chị duyệt mới thành bản nháp.",["Khách hỏi lặp lại mà chưa có luồng: đề xuất luồng mới.","Câu nhân viên hay gửi mà khách hay chốt: đề xuất thành câu mẫu.","Nút ít người bấm, luồng ít người đi tiếp: đề xuất sửa.","Agent bị chặn nhiều vì thiếu giá: nhắc chị nhập giá."],"Chỉ đề xuất. Vẫn phải xuất bản mới tới agent.")}
function tk(){return soonPage("Thống kê luồng","Giống thống kê của Botcake: mỗi luồng gửi bao nhiêu lần, hiệu quả ra sao.",["Đã gửi, khách nhắn tiếp, bấm nút, chuyển chị, bị chặn theo từng luồng.","Cảnh báo luồng ít người đi tiếp để chị sửa.","Số liệu lấy từ nhật ký agent (đã có bảng ghi, chờ công cụ VPS nối vào)."])}
function th(){
  var rows=ST.tags.map(function(t){return "<tr><td>"+tagChip(t.id)+"</td><td>"+(t.kind==="product"?"Sản phẩm":"Giai đoạn")+"</td><td>"+TCOLN[t.color]+'</td><td><div class="row"><button class="btn sm" data-act="edittag" data-id="'+t.id+'">Sửa</button><button class="btn sm" data-act="deltag" data-id="'+t.id+'">Xóa</button></div></td></tr>'}).join("");
  return '<div class="hph"><div><h1>Thẻ hội thoại</h1><div class="hint">Thẻ giai đoạn hiện thanh màu dưới khung chat (bấm một lần để gắn). Thẻ sản phẩm cho biết khách đang hỏi gì. Luồng có thể tự gắn thẻ khi gửi (xem ô "Thẻ tự gắn" ở Luồng kịch bản). Thẻ ở đây chỉ nằm trong web, chưa đồng bộ sang Pancake.</div></div></div>'+
   '<div class="tbar"><span class="sp"></span><button class="btn pri" data-act="addtag">Thêm thẻ</button></div>'+
   '<div class="tbl"><table><thead><tr><th>Thẻ</th><th>Loại</th><th>Màu</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="4" class="hint">Chưa có thẻ nào.</td></tr>')+"</tbody></table></div>";
}
function botView(){
  var cur=mkSec(ST.sec);
  var top='<div class="tabs">'+NAV.map(function(s){return '<button data-act="sec" data-id="'+s.k+'" class="'+(ST.sec===s.k?"on":"")+'">'+s.n+(s.soon?'<span>Sắp có</span>':"")+"</button>"}).join("")+"</div>";
  var side=cur.items.length>1?'<div class="hside">'+cur.items.map(function(t){
    if(t[2])return '<button class="soon" data-act="tab" data-id="'+t[0]+'"><span>'+t[1]+'</span><span class="c soonc">Sắp có</span></button>';
    var c=badge(t[0]);return '<button data-act="tab" data-id="'+t[0]+'" class="'+(ST.tab===t[0]?"on":"")+'"><span>'+t[1]+"</span>"+(c!==""?'<span class="c">'+c+"</span>":"")+"</button>"}).join("")+"</div>":"";
  var body={tt:tt,tc:tc,cm:cm,sp:sp,md:md,bd:bd,qt:qt,ms:ms,pb:pb,hl:hl,dx:dx,tk:tk,th:th}[ST.tab]();
  if(ST.tab==="hl")return top+body;
  return top+(side?'<div class="shell">'+side+'<div class="main">'+body+"</div></div>":'<div class="main">'+body+"</div>");
}
function mkSec(k){for(var i=0;i<NAV.length;i++)if(NAV[i].k===k)return NAV[i];return NAV[1]}
function tt(){
  var pg=ST.pages.filter(function(p){return p.bot_id===ST.botId}),cur=ST.versions.filter(function(v){return v.is_current})[0];
  var er=ST.issues.filter(function(i){return i.level==="error"}),wr=ST.issues.filter(function(i){return i.level==="warn"});
  return '<div class="hph"><div><h1>Tổng quan</h1><div class="hint">Bot này làm gì và còn thiếu gì.</div></div><label class="f" style="min-width:260px;margin:0"><span>Tên bot</span><input type="text" data-act="botname" value="'+esc(ST.name)+'"></label></div>'+
   '<div class="grid"><div class="card"><h3>Phiên bản đang dùng</h3>'+(cur?'<span class="pill p-grn">Bản '+cur.version+"</span> <span class=\"hint\">"+fm(cur.published_at)+"</span>":'<span class="pill p-gry">Chưa xuất bản</span><p class="hint" style="margin:6px 0 0">Agent chưa thấy gì cho tới khi chị xuất bản.</p>')+"</div>"+
   '<div class="card"><h3>Page đang dùng bot này</h3>'+(pg.length?pg.map(function(p){return "<div>"+esc(p.name)+" "+modePill(p.mode)+"</div>"}).join(""):'<span class="hint">Chưa gắn. Vào "Tất cả bot" để gắn.</span>')+"</div></div>"+
   '<div class="card"><h3>Kiểm tra kịch bản</h3>'+(!er.length&&!wr.length?'<span class="pill p-grn">Không có lỗi hay cảnh báo</span>':er.map(function(i){return '<div style="padding:3px 0"><span class="pill p-red">Lỗi</span> '+esc(i.msg)+"</div>"}).join("")+wr.map(function(i){return '<div style="padding:3px 0"><span class="pill p-amb">Cảnh báo</span> '+esc(i.msg)+"</div>"}).join("")+'<p class="hint" style="margin:8px 0 0">Còn lỗi thì chưa xuất bản được. Cảnh báo thì vẫn xuất bản được.</p>')+"</div>";
}

/* ---- Luồng kịch bản (sơ đồ giống Botcake: gửi một mạch, không chờ khách) ---- */
var NT={msg:"Câu mẫu",img:"Ảnh",cond:"Điều kiện",jump:"Chuyển luồng",handoff:"Chuyển chị Hoa"};
var CONDS={xh:"Đã biết giới tính khách",phone:"Khách đã để số điện thoại"};
function flowName(id){var f=mk(D().flows,id);return f?f.code+" "+f.name:"(đã xóa)"}
function nodeSummary(n){
  var b=D();
  if(n.t==="msg"){var m=mk(b.lib,n.ref);return m?"<b>"+esc(m.code)+"</b><br>"+esc(m.text.length>85?m.text.slice(0,85)+"…":m.text):"(chưa chọn câu mẫu)"}
  if(n.t==="img")return n.ref?"Nhóm ảnh <b>"+esc(n.ref)+"</b>":"(chưa chọn nhóm ảnh)";
  if(n.t==="cond")return esc(CONDS[n.c]||"")+"?";
  if(n.t==="jump")return "→ "+esc(n.to?flowName(n.to):"(chưa chọn luồng)");
  return esc(n.ref||"Cần người thật");
}
function nodeHtml(n,idx){
  var dots=n.t==="cond"?'<div class="dots"><span>Có<i class="dot" data-dot="'+n.id+':yes"></i></span><span>Không<i class="dot" data-dot="'+n.id+':no"></i></span></div>':(n.t==="jump"||n.t==="handoff")?"":'<div class="dots"><span>Tiếp theo<i class="dot" data-dot="'+n.id+':next"></i></span></div>';
  var bt=(n.btns||[]).filter(function(x){return x.label}).map(function(x){return '<span class="pill p-blu" style="margin:4px 4px 0 0;display:inline-block">'+esc(x.label)+(x.to?" → "+esc((mk(D().flows,x.to)||{}).code||"?"):"")+"</span>"}).join("");
  return '<div class="nd '+n.t+(ST.node===n.id?" sel":"")+'" data-node="'+n.id+'" style="left:'+n.x+"px;top:"+n.y+'px"><div class="nh" data-drag="'+n.id+'"><span>'+NT[n.t]+"</span>"+(idx===0?'<span class="pill p-pnk">Bắt đầu</span>':"")+'</div><div class="nb">'+nodeSummary(n)+(bt?"<div>"+bt+"</div>":"")+"</div>"+dots+"</div>";
}
function drawEdges(){
  var cv=document.getElementById("cv"),svg=document.getElementById("edges");if(!cv||!svg||!ST.doc)return;
  var f=mk(D().flows,ST.sel);if(!f)return;
  var cr=cv.getBoundingClientRect(),p="";
  function link(key,to){
    var d=cv.querySelector('[data-dot="'+key+'"]'),t=cv.querySelector('[data-node="'+to+'"]');if(!d||!t)return;
    var a=d.getBoundingClientRect(),c=t.getBoundingClientRect();
    var x1=a.left+a.width/2-cr.left,y1=a.top+a.height/2-cr.top,x2=c.left-cr.left,y2=c.top+20-cr.top,dx=Math.max(40,Math.abs(x2-x1)/2);
    p+='<path d="M'+x1+","+y1+" C"+(x1+dx)+","+y1+" "+(x2-dx)+","+y2+" "+x2+","+y2+'"/><circle cx="'+x2+'" cy="'+y2+'" r="3.5" fill="var(--acc)"/>';
  }
  f.nodes.forEach(function(n){if(n.next)link(n.id+":next",n.next);if(n.yes)link(n.id+":yes",n.yes);if(n.no)link(n.id+":no",n.no)});
  svg.innerHTML=p;
}
function flowOpts(sel,skip){return '<option value="">(chưa chọn luồng)</option>'+D().flows.filter(function(x){return x.id!==skip}).map(function(x){return '<option value="'+x.id+'"'+(sel===x.id?" selected":"")+">"+esc(x.code+" "+x.name)+"</option>"}).join("")}
function nodeEditor(f,n){
  var b=D();
  if(!n)return '<div class="card hint">Bấm vào tiêu đề một ô trên sơ đồ để sửa nội dung ô đó.</div>';
  var body="";
  if(n.t==="msg"){
    body='<label class="f"><span>Câu mẫu gửi</span><select data-nb="ref"><option value="">(chưa chọn)</option>'+b.lib.map(function(m){return '<option value="'+m.id+'"'+(n.ref===m.id?" selected":"")+">"+esc(m.code+" - "+m.text.slice(0,50))+"</option>"}).join("")+"</select></label>"+
     '<div class="hint" style="margin-bottom:6px">Nút bấm dưới tin (khách bấm thì chạy luồng đó)</div>'+
     (n.btns||[]).map(function(x,i){return '<div class="row" style="margin-bottom:6px"><input type="text" style="flex:1;min-width:110px" placeholder="Chữ trên nút" data-nb="btn:'+i+':label" value="'+esc(x.label)+'"><select class="hinl" style="max-width:210px" data-nb="btn:'+i+':to">'+flowOpts(x.to,f.id)+'</select><button class="btn sm ghost" data-act="delbtn" data-id="'+i+'" aria-label="Xóa nút">✕</button></div>'}).join("")+
     ((n.btns||[]).length<3?'<button class="btn sm" data-act="addbtn">+ Thêm nút</button>':'<span class="hint">Tối đa 3 nút</span>');
  }else if(n.t==="img"){
    body='<label class="f"><span>Nhóm ảnh gửi</span><select data-nb="ref"><option value="">(chưa chọn)</option>'+b.media.map(function(g){return '<option value="'+esc(g.g)+'"'+(n.ref===g.g?" selected":"")+">"+esc(g.g)+" · "+esc(g.d)+"</option>"}).join("")+"</select></label>";
  }else if(n.t==="cond"){
    body='<label class="f"><span>Điều kiện (dựa trên dữ liệu khách, không chờ khách trả lời)</span><select data-nb="c">'+Object.keys(CONDS).map(function(k){return '<option value="'+k+'"'+(n.c===k?" selected":"")+">"+CONDS[k]+"</option>"}).join("")+'</select></label><div class="hint">Nối đường "Có" và "Không" ở hai chấm bên phải ô.</div>';
  }else if(n.t==="jump"){
    body='<label class="f"><span>Chạy tiếp luồng</span><select data-nb="to">'+flowOpts(n.to,f.id)+"</select></label>";
  }else{
    body='<label class="f"><span>Lý do chuyển chị Hoa</span><input type="text" data-nb="ref" value="'+esc(n.ref||"")+'"></label>';
  }
  return '<div class="card"><div class="row between"><h3 style="margin:0">Sửa ô: '+NT[n.t]+'</h3><div class="row"><button class="btn sm" data-act="setstart">Đặt làm ô bắt đầu</button><button class="btn sm" data-act="unlink">Gỡ đường nối</button><button class="btn sm" data-act="delnodesel">Xóa ô</button></div></div><div style="margin-top:10px">'+body+"</div></div>";
}
function chatHtml(arr,live){
  return arr.map(function(m){
    var imgs=m.urls&&m.urls.length?'<div class="imgs">'+m.urls.slice(0,4).map(function(u){return '<img src="'+esc(u)+'" alt="">'}).join("")+"</div>":"";
    var btns=m.btns&&m.btns.length?"<div>"+m.btns.map(function(x){return live?'<span class="bchip" data-act="simbtn" data-id="'+x.to+'" data-label="'+esc(x.label)+'">'+esc(x.label)+"</span>":'<span class="bchip">'+esc(x.label)+"</span>"}).join("")+"</div>":"";
    return '<div class="m '+m.c+'">'+esc(m.t)+imgs+btns+"</div>"}).join("");
}
function toChat(m){return {c:m.kind==="agent"?"a":m.kind==="image"?"i":"s",t:m.text,btns:m.buttons,urls:m.urls}}
async function sim(body,state){
  var pg=pageOfBot();
  return api("/bots/"+ST.botId+"/simulate",{method:"POST",body:JSON.stringify(Object.assign({draft:ST.doc,state:state||{cur:ST.cur,xh:ST.xh,phone:ST.phone},page:pg?pg.name:""},body))});
}
async function loadPreview(){
  var f=mk(D().flows,ST.sel);if(!f)return;
  var tok=++ST.pvTok;
  try{
    var r=await sim({preview_flow:f.id},{cur:null,xh:ST.xh,phone:ST.phone});
    var el=document.getElementById("pvchat");
    if(tok===ST.pvTok&&el)el.innerHTML=chatHtml(r.messages.map(toChat),false);
  }catch(e){var el2=document.getElementById("pvchat");if(el2)el2.innerHTML='<div class="hint">Chưa xem thử được: '+esc(e.message)+"</div>"}
}
function tc(){
  var b=D(),f=mk(b.flows,ST.sel)||b.flows[0];if(f)ST.sel=f.id;
  var list=b.flows.map(function(x){return '<button class="it'+(x.id===ST.sel?" on":"")+'" data-act="selflow" data-id="'+x.id+'"><b>'+esc(x.code)+" · "+esc(x.name)+"</b><small>"+x.nodes.length+" ô"+(x.entry?" · mở được từ đầu":"")+"</small></button>"}).join("");
  var ed="";
  if(f){
    var n=mk(f.nodes,ST.node);
    var W=720,Hh=320;f.nodes.forEach(function(x){W=Math.max(W,x.x+280);Hh=Math.max(Hh,x.y+190)});
    ed='<div class="card"><div class="row between"><h3 style="margin:0">Luồng</h3><button class="btn sm" data-act="delflow" data-id="'+f.id+'">Xóa luồng</button></div>'+
     '<div class="grid" style="margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))"><label class="f"><span>Mã luồng</span><input type="text" data-flow="code" value="'+esc(f.code)+'"></label><label class="f"><span>Tên luồng</span><input type="text" data-flow="name" value="'+esc(f.name)+'"></label>'+
     '<label class="f"><span>Gửi tin</span><select data-flow="win"><option value="in"'+(f.win==="in"?" selected":"")+'>Trong khoảng 24 giờ</option><option value="out"'+(f.win==="out"?" selected":"")+">Ngoài khoảng 24 giờ</option></select></label></div>"+
     '<label class="f"><span>Gợi ý để agent chọn luồng này (từ khóa khách hay nói, cách nhau dấu phẩy)</span><input type="text" data-flow="keys" value="'+esc(f.keys)+'"></label>'+
     '<div class="row" style="margin-bottom:8px"><button class="achip'+(f.entry?" on":"")+'" data-act="entry">Agent được chọn luồng này từ đầu hội thoại</button></div>'+'<div class="hint" style="margin-bottom:6px">Thẻ tự gắn cho khách khi gửi luồng này:</div><div class="row" style="margin-bottom:8px">'+(ST.tags.map(function(t){return '<button class="achip'+((f.tags||[]).indexOf(t.name)>=0?" on":"")+'" data-act="ftag" data-id="'+esc(t.name)+'">'+esc(t.name)+"</button>"}).join("")||'<span class="hint">(chưa có thẻ, thêm ở Cài đặt, Thẻ hội thoại)</span>')+"</div>"+
     '<div class="hint" style="margin-bottom:6px">Sau khi gửi luồng này, nếu khách nhắn tiếp thì agent chỉ được chọn một trong các luồng:</div><div class="row">'+(b.flows.filter(function(x){return x.id!==f.id}).map(function(x){return '<button class="achip'+(f.allow.indexOf(x.id)>=0?" on":"")+'" data-act="allow" data-id="'+x.id+'">'+esc(x.code)+"</button>"}).join("")||'<span class="hint">(chưa có luồng khác)</span>')+"</div></div>"+
     '<div class="card"><div class="cvbar"><b style="margin-right:6px">Sơ đồ</b><button class="btn sm pri" data-act="addnode">+ Thêm ô</button><span class="hint">Kéo tiêu đề ô để di chuyển. Bấm chấm tròn rồi bấm ô đích để nối.</span>'+(ST.conn?'<span class="pill p-amb">Đang nối: bấm vào ô muốn nối tới</span><button class="btn sm" data-act="cancelconn">Hủy</button>':"")+"</div>"+
     '<div class="cvw" id="cvw"><div class="cv" id="cv" style="width:'+W+"px;height:"+Hh+'px"><svg id="edges" class="edges"></svg>'+f.nodes.map(function(x,i){return nodeHtml(x,i)}).join("")+"</div></div>"+
     '<p class="hint" style="margin:8px 0 0">Luồng gửi một mạch từ ô bắt đầu rồi dừng, không chờ khách trả lời. Khách nói tiếp thì khách bấm nút, hoặc agent chọn luồng kế trong danh sách được phép ở trên.</p></div>'+
     '<div class="split">'+nodeEditor(f,n)+'<div class="card"><h3>Xem thử luồng</h3><div class="row" style="margin-bottom:8px"><label class="hint"><input type="checkbox" data-act="setphone"'+(ST.phone?" checked":"")+"> khách đã để SĐT</label>"+xhSelect()+'</div><div class="phone"><div class="chat" id="pvchat"><span class="hint">Đang tải…</span></div></div></div></div>';
  }else ed='<div class="card hint">Chưa có luồng nào. Bấm "+ Thêm luồng".</div>';
  return '<div class="hph"><div><h1>Luồng kịch bản</h1><div class="hint">Mỗi luồng là một sơ đồ các ô gửi liên tiếp, giống Botcake. Chị thêm luồng, thêm ô, nối đường, đặt nút bấm sang luồng khác.</div></div><button class="btn pri" data-act="addflow">+ Thêm luồng</button></div>'+
   '<div class="two"><div class="list">'+list+"</div><div>"+ed+"</div></div>";
}
function xhSelect(){return '<select class="hinl" data-act="setxh"><option value="">chưa rõ giới tính</option><option value="anh"'+(ST.xh==="anh"?" selected":"")+'>anh</option><option value="chị"'+(ST.xh==="chị"?" selected":"")+">chị</option></select>"}

/* ---- Câu mẫu ---- */
var TOPC=["blue","ok","warn","bad","acc","gray"];
function topicPill(g){if(!g)return "";var h=0;for(var i=0;i<g.length;i++)h=(h*31+g.charCodeAt(i))%997;return '<span class="pill '+pc(TOPC[h%TOPC.length])+'">'+esc(g)+"</span>"}
function cm(){
  var b=D(),q=(ST.q||"").toLowerCase(),n=0;
  var rows=b.lib.filter(function(m){return !q||(m.code+m.text+m.grp).toLowerCase().indexOf(q)>=0}).map(function(m){
    var used=b.flows.filter(function(f){return f.nodes.some(function(x){return x.t==="msg"&&x.ref===m.id})}).length;n++;
    return "<tr><td>"+n+"</td><td><code>"+esc(m.code)+"</code></td><td>"+topicPill(m.grp)+'</td><td style="min-width:280px">'+esc(m.text)+(m.claim?'<br><span class="pill p-blu">Cam kết: '+esc(m.claim)+"</span>":"")+(m.img?' <span class="pill p-gry">Kèm ảnh '+esc(m.img)+"</span>":"")+'</td><td class="num">'+used+' luồng</td><td><div class="row"><button class="btn sm" data-act="editmsg" data-id="'+m.id+'">Sửa</button><button class="btn sm" data-act="delmsg" data-id="'+m.id+'">Xóa</button></div></td></tr>'}).join("");
  return '<div class="hph"><div><h1>Câu mẫu</h1><div class="hint">Giống "Trả lời nhanh" của Pancake: mã (ký tự tắt), chủ đề có màu, nội dung. Agent chỉ chọn mã câu, không tự viết lại. Biến như {xh}, {gia_...} được điền từ dữ liệu; thiếu dữ liệu thì câu bị chặn.</div></div></div>'+
   '<div class="tbar"><input type="text" id="q" placeholder="Tìm câu mẫu…" value="'+esc(ST.q||"")+'"><span class="sp"></span><button class="btn pri" data-act="addmsg">Thêm mẫu</button></div>'+
   '<div class="tbl"><table><thead><tr><th>STT</th><th>Mã</th><th>Chủ đề</th><th>Tin nhắn</th><th class="num">Đang dùng</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="hint">Chưa có câu mẫu nào.</td></tr>')+"</tbody></table></div>";
}
/* ---- Sản phẩm và giá ---- */
function sp(){
  var b=D();
  var cards=b.products.map(function(p){
    var of=b.offers.filter(function(o){return o.prod===p.id});
    return '<div class="card"><div class="row between"><div><h3 style="margin:0">'+esc(p.name)+'</h3><span class="hint">biến trong câu mẫu: <code>{gia_'+esc(p.id)+"}</code></span></div><div class=\"row\">"+(of.length?'<span class="pill p-grn">Có giá</span>':'<span class="pill p-amb">Chưa có giá</span>')+'<button class="btn sm" data-act="delprod" data-id="'+p.id+'">Xóa sản phẩm</button></div></div>'+
     (of.length?'<div class="tbl"><table><thead><tr><th>Chương trình</th><th>Mức</th><th class="num">Giá</th><th>Hiệu lực từ</th><th></th></tr></thead><tbody>'+of.map(function(o){return "<tr><td>"+esc(o.name)+"</td><td>"+esc(o.lv)+'</td><td class="num"><b>'+esc(o.price)+"</b></td><td>"+esc(o.from)+'</td><td><button class="btn sm" data-act="deloffer" data-id="'+o.id+'">Xóa</button></td></tr>'}).join("")+"</tbody></table></div>":'<p class="hint" style="margin:8px 0">Chưa có bảng giá nên agent không báo giá cho sản phẩm này, sẽ dừng và báo chị.</p>')+
     '<div style="margin-top:8px"><button class="btn sm pri" data-act="addoffer" data-id="'+p.id+'">+ Thêm mức giá</button></div></div>'}).join("");
  return '<div class="hph"><div><h1>Sản phẩm &amp; giá</h1><div class="hint">Giá chỉ lấy từ đây. Câu nào có giá khác bảng này đều bị chặn. Quà và combo chi tiết chị nhập khi có.</div></div><button class="btn pri" data-act="addprod">+ Thêm sản phẩm</button></div>'+(cards||'<div class="card hint">Chưa có sản phẩm nào. Bấm "+ Thêm sản phẩm".</div>');
}
/* ---- Ảnh / video ---- */
function md(){
  var b=D();
  return '<div class="hph"><div><h1>Ảnh / video</h1><div class="hint">Nhóm ảnh gắn vào câu mẫu hoặc ô ảnh trong luồng. Dán đường dẫn ảnh (https://...), mỗi dòng một ảnh. Tải ảnh lên trực tiếp sẽ làm ở bước sau.</div></div><button class="btn pri" data-act="addgroup">+ Thêm nhóm ảnh</button></div>'+
   (b.media.map(function(g){return '<div class="card"><div class="row between"><h3 style="margin:0">'+esc(g.g)+" · "+esc(g.d)+" ("+g.urls.length+')</h3><div class="row"><button class="btn sm" data-act="addurls" data-id="'+esc(g.g)+'">+ Thêm ảnh</button><button class="btn sm" data-act="delgroup" data-id="'+esc(g.g)+'">Xóa nhóm</button></div></div>'+
     (g.urls.length?'<div class="media" style="margin-top:8px">'+g.urls.map(function(u,i){return '<div class="im"><img src="'+esc(u)+'" alt=""><button class="btn sm" data-act="delurl" data-id="'+esc(g.g)+":"+i+'" aria-label="Xóa ảnh">✕</button></div>'}).join("")+"</div>":'<p class="hint" style="margin:8px 0 0">Nhóm chưa có ảnh.</p>')+"</div>"}).join("")||'<div class="card hint">Chưa có nhóm ảnh nào.</div>')+
   '<div class="card"><div class="row between"><h3 style="margin:0">Câu cấm (agent không được nói)</h3><button class="btn sm pri" data-act="addbanned">+ Thêm</button></div><p class="hint" style="margin:4px 0 8px">Câu mẫu nào chứa các cụm này sẽ bị chặn. Ví dụ câu về oxygen hoạt tính chị đã yêu cầu bỏ.</p>'+
   (b.banned.map(function(x,i){return '<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>'+esc(x)+'</span><button class="btn sm ghost" data-act="delbanned" data-id="'+i+'" aria-label="Xóa">✕</button></div>'}).join("")||'<span class="hint">Chưa có.</span>')+"</div>";
}
function bd(){
  var b=D();
  return '<div class="hph"><div><h1>Bám đuổi</h1><div class="hint">Tối đa 5 lần. Khách trả lời là hủy lịch cũ và đi tiếp theo ngữ cảnh mới. Công cụ trên VPS sẽ chạy lịch này ở bước sau.</div></div><button class="btn pri" data-act="addfollow"'+(b.follow.length>=5?" disabled":"")+'>+ Thêm lần bám đuổi</button></div>'+
   '<div class="card">'+(b.follow.map(function(f,i){
     var opts='<option value="">(chưa chọn câu mẫu)</option>'+b.lib.map(function(m){return '<option value="'+m.id+'"'+(f.ref===m.id?" selected":"")+">"+esc(m.code)+"</option>"}).join("");
     return '<div class="step"><span class="n">'+(i+1)+'</span><div class="t"><input type="text" data-follow="when:'+f.id+'" value="'+esc(f.when)+'"><div style="margin-top:6px"><select data-follow="ref:'+f.id+'">'+opts+'</select></div></div><button class="btn sm ghost" data-act="delfollow" data-id="'+f.id+'" aria-label="Xóa">✕</button></div>'}).join("")||'<span class="hint">Chưa có lần bám đuổi nào.</span>')+
   '<p class="hint" style="margin:6px 0 0">Lần chưa chọn câu mẫu sẽ không gửi. Cần đối chiếu luật 24 giờ của Facebook trước khi mở khách thật.</p></div>';
}
function qt(){
  var b=D();
  function list(key,arr,title,hint){return '<div class="card"><div class="row between"><h3 style="margin:0">'+title+'</h3><button class="btn sm pri" data-act="addlist" data-id="'+key+'">+ Thêm</button></div><p class="hint" style="margin:4px 0 8px">'+hint+"</p>"+arr.map(function(r){return '<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>'+esc(r.text)+'</span><span class="row"><button class="btn sm" data-act="togglelist" data-id="'+key+":"+r.id+'">'+(r.on?"Đang bật":"Đã tắt")+'</button><button class="btn sm ghost" data-act="dellist" data-id="'+key+":"+r.id+'" aria-label="Xóa">✕</button></span></div>'}).join("")+"</div>"}
  return '<div class="hph"><div><h1>Quy tắc &amp; chuyển người</h1></div></div>'+list("rules",b.rules,"Quy tắc ứng xử chung","Agent luôn theo các quy tắc này.")+list("handoff",b.handoff,"Khi nào chuyển chị Hoa","Gặp các trường hợp này agent dừng và báo chị, không tự trả lời.");
}
/* ---- Mô phỏng ---- */
function ms(){
  var chat=chatHtml(ST.chat,true)||'<div class="hint">Gõ một câu khách rồi Gửi, hoặc bấm nút trong tin của agent. Mô phỏng chạy trên bản nháp đang sửa, không gửi cho ai, không cần bật Page.</div>';
  var lg=ST.simlog[0];
  return '<div class="hph"><div><h1>Mô phỏng</h1><div class="hint">Thử với bản đang sửa (kể cả chưa xuất bản). Agent thật chọn luồng bằng AI; ở đây chọn bằng từ khóa để chị kiểm tra kịch bản.</div></div><div class="row"><label class="hint">Khách xưng</label>'+xhSelect()+'<label class="hint"><input type="checkbox" data-act="setphone"'+(ST.phone?" checked":"")+'> đã để SĐT</label><button class="btn sm" data-act="clearchat">Làm mới</button></div></div>'+
   '<div class="split"><div class="card"><div class="chat" id="chat">'+chat+'</div><div class="row" style="margin-top:10px"><input type="text" id="simin" placeholder="Gõ câu của khách…" style="flex:1;min-width:160px"><button class="btn pri" data-act="send">Gửi</button></div></div>'+
   '<div class="card"><h3>Agent đã lấy gì để trả lời</h3><div class="log">'+(lg?esc(lg.text):"Chưa có lần thử nào.")+"</div></div></div>"+
   '<div class="card"><h3>Nhật ký lần thử</h3>'+(ST.simlog.length?'<div class="tbl"><table><thead><tr><th>Giờ</th><th>Khách nói</th><th>Luồng</th><th>Kết quả</th></tr></thead><tbody>'+ST.simlog.map(function(l){return "<tr><td>"+l.time+"</td><td>"+esc(l.said)+"</td><td>"+esc(l.flow)+'</td><td><span class="pill '+pc(l.cls)+'">'+esc(l.res)+"</span></td></tr>"}).join("")+"</tbody></table></div>":'<span class="hint">Chưa có.</span>')+"</div>";
}
function pb(){
  return '<div class="hph"><div><h1>Phiên bản</h1><div class="hint">Mỗi lần xuất bản tạo một phiên bản. Agent chỉ dùng bản "Đang dùng". Quay lại bản cũ cũng tạo một bản mới, lịch sử không mất.</div></div></div><div class="card">'+
   (ST.dirty?'<div class="row between" style="padding-bottom:10px;border-bottom:1px solid var(--line)"><span><b>Bản nháp</b> <span class="pill p-amb">chưa xuất bản</span></span><button class="btn pri sm" data-act="publish">Xuất bản</button></div>':"")+
   (ST.versions.map(function(v){return '<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)"><span><b>Bản '+v.version+"</b> "+(v.is_current?'<span class="pill p-grn">Đang dùng</span>':'<span class="pill p-gry">Đã xuất bản</span>')+' <span class="hint">'+fm(v.published_at)+" · "+esc(v.by_name||"")+(v.note?" · "+esc(v.note):"")+"</span></span>"+(v.is_current?"":'<button class="btn sm" data-act="rollback" data-id="'+v.version+'">Quay lại bản này</button>')+"</div>"}).join("")||'<span class="hint">Chưa xuất bản lần nào.</span>')+"</div>";
}
/* ---------- Ngăn kéo (form thêm / sửa) ---------- */
function varChips(){return [["xh","Xưng hô (anh/chị/mình)"],["ten_page","Tên Page"]].concat(D().products.map(function(p){return ["gia_"+p.id,"Giá "+p.name]}))}
function drawerHtml(){
  var d=ST.drawer,b=ST.doc,body="",title="",ok="Lưu";
  if(d.type==="msg"){
    var m=d.id?mk(b.lib,d.id):{code:"",grp:"",text:d.prefill||"",claim:"",img:""};
    title=d.id?"Sửa câu mẫu":"Thêm câu mẫu";
    var imgs='<option value="">(không kèm ảnh)</option>'+b.media.map(function(g){return '<option value="'+esc(g.g)+'"'+(m.img===g.g?" selected":"")+">"+esc(g.g)+"</option>"}).join("");
    body='<label class="f"><span>Mã câu</span><input type="text" id="d_code" value="'+esc(m.code)+'" placeholder="VD: GIA_LONG_02"></label><label class="f"><span>Nhóm</span><input type="text" id="d_grp" value="'+esc(m.grp)+'" placeholder="VD: Báo giá, Mở đầu, Bám đuổi"></label>'+
     '<label class="f"><span>Nội dung (khoảng 200 chữ trở xuống)</span><textarea id="d_text">'+esc(m.text)+"</textarea></label>"+
     '<div class="hint">Chèn biến:</div><div class="hchips">'+varChips().map(function(v){return '<button class="btn sm" data-act="insvar" data-id="'+v[0]+'" title="'+esc(v[1])+'">{'+v[0]+"}</button>"}).join("")+"</div>"+
     '<label class="f"><span>Cam kết đi kèm (nếu có, phải nằm trong kịch bản đã duyệt)</span><input type="text" id="d_claim" value="'+esc(m.claim)+'"></label><label class="f"><span>Ảnh đi kèm</span><select id="d_img">'+imgs+"</select></label>";
  }else if(d.type==="flow"){
    title="Thêm luồng";ok="Tạo luồng";
    body='<label class="f"><span>Mã luồng</span><input type="text" id="d_code" placeholder="VD: BT-07"></label><label class="f"><span>Tên luồng</span><input type="text" id="d_name" placeholder="VD: Hỏi về bột tẩy vạn năng"></label><label class="f"><span>Gợi ý để agent chọn luồng (từ khóa)</span><input type="text" id="d_keys" placeholder="VD: bột tẩy, tẩy vạn năng"></label><p class="hint">Luồng mới có sẵn một ô câu mẫu. Chị thêm ô và nối đường trên sơ đồ.</p>';
  }else if(d.type==="node"){
    title="Thêm ô vào sơ đồ";ok="Thêm ô";
    body='<label class="f"><span>Loại ô</span><select id="d_k"><option value="msg">Câu mẫu</option><option value="img">Ảnh</option><option value="cond">Điều kiện</option><option value="jump">Chuyển luồng</option><option value="handoff">Chuyển chị Hoa</option></select></label><p class="hint">Chị chọn nội dung ô ở bảng "Sửa ô" bên dưới sơ đồ.</p>';
  }else if(d.type==="product"){
    title="Thêm sản phẩm";
    body='<label class="f"><span>Tên sản phẩm</span><input type="text" id="d_name" placeholder="VD: Tẩy lồng máy giặt AILLA"></label><label class="f"><span>Mã ngắn (chữ thường không dấu, dùng trong biến giá)</span><input type="text" id="d_id" placeholder="VD: long  →  biến {gia_long}"></label>';
  }else if(d.type==="offer"){
    title="Thêm mức giá";
    body='<label class="f"><span>Tên chương trình</span><input type="text" id="d_name" placeholder="VD: Mua riêng"></label><label class="f"><span>Mức</span><input type="text" id="d_lv" placeholder="VD: Mức 1"></label><label class="f"><span>Giá</span><input type="text" id="d_price" placeholder="VD: 145K"></label><label class="f"><span>Hiệu lực từ</span><input type="text" id="d_from" placeholder="VD: 22/10/2026"></label>';
  }else if(d.type==="group"){
    title="Thêm nhóm ảnh";
    body='<label class="f"><span>Mã nhóm (không dấu cách, ví dụ LONG, TEST)</span><input type="text" id="d_g" placeholder="VD: TEST"></label><label class="f"><span>Mô tả</span><input type="text" id="d_d" placeholder="VD: Ảnh test thực tế"></label>';
  }else if(d.type==="urls"){
    title="Thêm ảnh vào nhóm "+esc(d.id);ok="Thêm ảnh";
    body='<label class="f"><span>Đường dẫn ảnh, mỗi dòng một ảnh (bắt đầu bằng https://)</span><textarea id="d_urls" style="min-height:140px"></textarea></label>';
  }else if(d.type==="list"||d.type==="banned"){
    title="Thêm dòng";body='<label class="f"><span>Nội dung</span><textarea id="d_text"></textarea></label>';
  }else if(d.type==="bot"){
    title=d.from?"Nhân bản bot":"Tạo bot mới";ok=d.from?"Nhân bản":"Tạo bot";
    body='<label class="f"><span>Tên bot</span><input type="text" id="d_name" placeholder="VD: Bot tẩy lồng và tẩy mốc gioăng"></label>'+
     '<label class="f"><span>Bắt đầu từ</span><select id="d_from"><option value="">Bot trống</option>'+ST.bots.map(function(k){return '<option value="'+k.id+'"'+(d.from===k.id?" selected":"")+">Nhân bản: "+esc(k.name)+"</option>"}).join("")+"</select></label>";
  }else if(d.type==="tag"){
    var tg=d.id?tagById(d.id):{name:"",color:"gray",kind:"stage"};
    title=d.id?"Sửa thẻ":"Thêm thẻ";
    body='<label class="f"><span>Tên thẻ</span><input type="text" id="d_tname" value="'+esc(tg.name)+'" placeholder="VD: ĐÃ BÁO GIÁ"></label><label class="f"><span>Loại</span><select id="d_tkind"><option value="stage"'+(tg.kind==="stage"?" selected":"")+'>Giai đoạn (hiện trên thanh dưới khung chat)</option><option value="product"'+(tg.kind==="product"?" selected":"")+'>Sản phẩm</option></select></label><label class="f"><span>Màu</span><select id="d_tcolor">'+Object.keys(TCOL).map(function(k){return '<option value="'+k+'"'+(tg.color===k?" selected":"")+">"+TCOLN[k]+"</option>"}).join("")+"</select></label>";
  }else if(d.type==="page"){
    title="Thêm Page";
    body='<label class="f"><span>Tên Page</span><input type="text" id="d_name" placeholder="VD: Ailla Việt Nam Store"></label><label class="f"><span>Link Page hoặc dãy số (id) của Page</span><input type="text" id="d_fb" placeholder="Dán link, hoặc gõ dãy số VD: 105017945992971"></label><p class="hint">Dán link có chứa dãy số, ví dụ: botcake.io/105017945992971/home, hoặc facebook.com/profile.php?id=105017945992971. Link chỉ có tên (facebook.com/Aillavietnamstore) thì chưa đủ. Dãy số xem ở địa chỉ trang Botcake của Page, hoặc ở Facebook: Giới thiệu, Minh bạch của Trang.</p>';
  }
  return '<div class="veil" data-act="closedrawer"><div class="hdrawer" role="dialog" aria-label="'+esc(title)+'"><div class="dh"><b>'+title+'</b><button class="btn sm ghost" data-act="closedrawer" aria-label="Đóng">✕</button></div><div class="db"><div id="d_err" class="alert bad" hidden></div>'+body+'</div><div class="df"><button class="btn" data-act="closedrawer">Hủy</button><button class="btn pri" data-act="savedrawer">'+ok+"</button></div></div></div>";
}
function val(id){var e=document.getElementById(id);return e?e.value.trim():""}

/* ---------- Sự kiện ---------- */
function alive(){return ST.root&&ST.root.isConnected}
function curFlow(){return ST.doc&&mk(ST.doc.flows,ST.sel)}
function curNode(){var f=curFlow();return f&&mk(f.nodes,ST.node)}
async function guard(fn){try{await fn()}catch(e){toast(e.message||"Có lỗi")}}
document.addEventListener("click",function(e){
  if(!alive())return;
  var dt=e.target.closest("[data-dot]");
  if(dt){var pr=dt.getAttribute("data-dot").split(":");ST.conn={from:pr[0],key:pr[1]};draw();return}
  var t=e.target.closest("[data-act]");if(!t||!ST.root.contains(t))return;
  var a=t.getAttribute("data-act"),id=t.getAttribute("data-id"),b=ST.doc;
  if(a==="closedrawer"){if(t.classList.contains("veil")&&e.target!==t)return;ST.drawer=null;draw();return}
  if(t.tagName==="SELECT"||t.tagName==="INPUT")return;
  if(a==="kill"){guard(async function(){if(!ST.ctl.kill&&!confirm("Tắt khẩn: mọi agent ngừng trả lời ngay. Chắc chắn?"))return;ST.ctl=await api("/control",{method:"PUT",body:JSON.stringify({kill:!ST.ctl.kill})});toast(ST.ctl.kill?"Đã tắt khẩn":"Đã gỡ tắt khẩn")});return}
  if(a==="savectl"){guard(async function(){ST.ctl=await api("/control",{method:"PUT",body:JSON.stringify({testers:val("c_testers"),silent_minutes:+val("c_silent"),hours_from:val("c_hf"),hours_to:val("c_ht")})});toast("Đã lưu thiết lập")});return}
  if(a==="hsub"){ST.hsub=id;if(id==="log")guard(async function(){var r=await Promise.all([api("/log"),api("/runs")]);ST.hlog=r[0];ST.runs=r[1];draw()});else draw();return}
  if(a==="home"){goHome();return}
  if(a==="openbot"){openBot(id);return}
  if(a==="newbot"){ST.drawer={type:"bot"};draw();return}
  if(a==="clonebot"){ST.drawer={type:"bot",from:id};draw();return}
  if(a==="delbot"){guard(async function(){if(!confirm("Xóa bot này cùng mọi phiên bản của nó?"))return;await api("/bots/"+id,{method:"DELETE"});await loadHome();toast("Đã xóa bot")});return}
  if(a==="newpage"){ST.drawer={type:"page"};draw();return}
  if(a==="delpage"){guard(async function(){if(!confirm("Bỏ Page này khỏi danh sách?"))return;await api("/pages/"+id,{method:"DELETE"});await loadHome()});return}
  if(a==="publish"){guard(async function(){
    if(ST.busy)return;ST.busy=true;updTop();
    try{if(!(await flush()))return;
      var r=await api("/bots/"+ST.botId+"/publish",{method:"POST",body:JSON.stringify({})});
      await loadBot(ST.botId,true);toast("Đã xuất bản bản "+r.version+(r.warnings.length?" (còn "+r.warnings.length+" cảnh báo)":""))}
    catch(err){try{var r2=await api("/bots/"+ST.botId);ST.issues=r2.issues}catch(x){}toast(err.message);draw()}
    finally{ST.busy=false;updTop()}});return}
  if(a==="rollback"){guard(async function(){if(!confirm("Quay lại bản "+id+"? Nội dung bản đó sẽ thành bản mới nhất và được xuất bản ngay."))return;await flush();var r=await api("/bots/"+ST.botId+"/rollback",{method:"POST",body:JSON.stringify({version:+id})});await loadBot(ST.botId,true);toast("Đã quay lại, thành bản "+r.version)});return}
  if(a==="tab"){guard(async function(){await flush();ST.tab=id;ST.sec=secOf(id);draw();if(id==="hl")loadConvs()});return}
  if(a==="sec"){guard(async function(){await flush();var s=mkSec(id);ST.sec=id;ST.tab=s.items[0][0];draw();if(ST.tab==="hl")loadConvs()});return}
  if(a==="savedrawer"){saveDrawer();return}
  if(!b)return;
  if(a==="selflow"){ST.sel=id;var f0=mk(b.flows,id);ST.node=f0&&f0.nodes[0]?f0.nodes[0].id:"";ST.conn=null;draw();return}
  if(a==="ftag"){var ff0=curFlow();ff0.tags=ff0.tags||[];var ix0=ff0.tags.indexOf(id);if(ix0>=0)ff0.tags.splice(ix0,1);else ff0.tags.push(id);touch();draw();return}
  if(a==="demoon"){ST.demo=true;ST.demoAll=null;ST.cvId=0;ST.cv=null;ST.cvTag=0;ST.cvQ="";loadConvs();return}
  if(a==="demooff"){ST.demo=false;ST.demoAll=null;ST.cvId=0;ST.cv=null;loadConvs();return}
  if(ST.demo&&(a==="cvdel"||a==="wrongmsg"||a==="mkphrase")){toast("Đây là bản mẫu, không lưu gì.");return}
  if(ST.demo&&a==="cvtag"){var ix1=ST.cv.tag_ids.indexOf(+id);if(ix1>=0)ST.cv.tag_ids.splice(ix1,1);else ST.cv.tag_ids.push(+id);var rw=ST.convs.filter(function(x){return x.id===ST.cvId})[0];if(rw)rw.tag_ids=ST.cv.tag_ids.slice();draw();return}
  if(a==="cv"){loadConv(+id);return}
  if(a==="cvfilt"){ST.cvTag=ST.cvTag===+id?0:+id;ST.cvId=0;ST.cv=null;loadConvs();return}
  if(a==="rptab"){ST.rpTab=id;draw();return}
  if(a==="msgsel"){ST.cvMsg=ST.cvMsg===+id?0:+id;draw();return}
  if(a==="cvtag"){guard(async function(){var ids=ST.cv.tag_ids.slice(),i1=ids.indexOf(+id);if(i1>=0)ids.splice(i1,1);else ids.push(+id);var r=await api("/convs/"+ST.cvId+"/tags",{method:"PUT",body:JSON.stringify({tag_ids:ids})});ST.cv.tag_ids=r.tag_ids;var row=ST.convs.filter(function(x){return x.id===ST.cvId})[0];if(row)row.tag_ids=r.tag_ids;draw()});return}
  if(a==="wrongmsg"){guard(async function(){var m=ST.cv.messages.filter(function(x){return x.id===+id})[0];var wrong=!m.wrong,note="";if(wrong){note=prompt("Sai ở đâu? (không bắt buộc)")||""}await api("/msgs/"+id+"/wrong",{method:"POST",body:JSON.stringify({wrong:wrong,note:note})});m.wrong=wrong?1:0;m.wrong_note=note;toast(wrong?"Đã đánh dấu sai":"Đã bỏ đánh dấu");draw()});return}
  if(a==="mkphrase"){var mm=ST.cv.messages.filter(function(x){return x.id===+id})[0];if(!mm)return;ST.tab="cm";ST.sec="kb";ST.drawer={type:"msg",prefill:mm.text};draw();return}
  if(a==="cvdel"){guard(async function(){if(!confirm("Xóa hội thoại này khỏi web? (Không ảnh hưởng tin trên Facebook hay Pancake)"))return;await api("/convs/"+id,{method:"DELETE"});ST.cvId=0;ST.cv=null;await loadConvs(false)});return}
  if(a==="addtag"){ST.drawer={type:"tag"};draw();return}
  if(a==="edittag"){ST.drawer={type:"tag",id:+id};draw();return}
  if(a==="deltag"){guard(async function(){if(!confirm("Xóa thẻ này? Thẻ sẽ bị gỡ khỏi mọi hội thoại."))return;await api("/tags/"+id,{method:"DELETE"});ST.tags=await api("/tags");draw()});return}
  if(a==="addflow"){ST.drawer={type:"flow"};draw();return}
  if(a==="delflow"){if(!confirm("Xóa luồng này?"))return;b.flows=b.flows.filter(function(x){return x.id!==id});b.flows.forEach(function(x){x.allow=x.allow.filter(function(y){return y!==id});x.nodes.forEach(function(n){(n.btns||[]).forEach(function(bt){if(bt.to===id)bt.to=""});if(n.to===id)n.to=""})});ST.sel=(b.flows[0]||{}).id||"";ST.node="";ST.cur=null;touch();draw();return}
  if(a==="addnode"){ST.drawer={type:"node"};draw();return}
  if(a==="entry"){var f1=curFlow();f1.entry=!f1.entry;touch();draw();return}
  if(a==="allow"){var f2=curFlow(),ix=f2.allow.indexOf(id);if(ix>=0)f2.allow.splice(ix,1);else f2.allow.push(id);touch();draw();return}
  if(a==="cancelconn"){ST.conn=null;draw();return}
  if(a==="addbtn"||a==="delbtn"||a==="setstart"||a==="unlink"||a==="delnodesel"){
    var f3=curFlow(),n3=curNode();if(!n3)return;
    if(a==="addbtn"){n3.btns=n3.btns||[];if(n3.btns.length<3)n3.btns.push({label:"",to:""})}
    else if(a==="delbtn")n3.btns.splice(+id,1);
    else if(a==="setstart"){f3.nodes=[n3].concat(f3.nodes.filter(function(x){return x!==n3}))}
    else if(a==="unlink"){n3.next="";n3.yes="";n3.no=""}
    else{f3.nodes=f3.nodes.filter(function(x){return x!==n3});f3.nodes.forEach(function(x){if(x.next===n3.id)x.next="";if(x.yes===n3.id)x.yes="";if(x.no===n3.id)x.no=""});ST.node=""}
    touch();draw();return}
  if(a==="simbtn"){guard(async function(){var label=t.getAttribute("data-label");ST.chat.push({c:"k",t:"[Khách bấm nút] "+label});await runSim({flow_id:id},"[bấm nút] "+label)});return}
  if(a==="send"){var inp=document.getElementById("simin"),tx=inp?inp.value.trim():"";if(tx){inp.value="";ST.chat.push({c:"k",t:tx});guard(function(){return runSim({text:tx},tx)})}return}
  if(a==="clearchat"){ST.chat=[];ST.cur=null;draw();return}
  if(a==="addmsg"){ST.drawer={type:"msg"};draw();return}
  if(a==="editmsg"){ST.drawer={type:"msg",id:id};draw();return}
  if(a==="delmsg"){b.lib=b.lib.filter(function(x){return x.id!==id});touch();draw();return}
  if(a==="insvar"){var ta=document.getElementById("d_text");if(ta){var s=ta.selectionStart==null?ta.value.length:ta.selectionStart;ta.value=ta.value.slice(0,s)+"{"+id+"}"+ta.value.slice(ta.selectionEnd==null?s:ta.selectionEnd);ta.focus()}return}
  if(a==="addprod"){ST.drawer={type:"product"};draw();return}
  if(a==="delprod"){if(!confirm("Xóa sản phẩm và các mức giá của nó?"))return;b.products=b.products.filter(function(x){return x.id!==id});b.offers=b.offers.filter(function(x){return x.prod!==id});touch();draw();return}
  if(a==="addoffer"){ST.drawer={type:"offer",id:id};draw();return}
  if(a==="deloffer"){b.offers=b.offers.filter(function(x){return x.id!==id});touch();draw();return}
  if(a==="addgroup"){ST.drawer={type:"group"};draw();return}
  if(a==="delgroup"){if(!confirm("Xóa nhóm ảnh "+id+"?"))return;b.media=b.media.filter(function(x){return x.g!==id});touch();draw();return}
  if(a==="addurls"){ST.drawer={type:"urls",id:id};draw();return}
  if(a==="delurl"){var q=id.split(":"),g=b.media.filter(function(x){return x.g===q[0]})[0];if(g){g.urls.splice(+q[1],1);touch();draw()}return}
  if(a==="addbanned"){ST.drawer={type:"banned"};draw();return}
  if(a==="delbanned"){b.banned.splice(+id,1);touch();draw();return}
  if(a==="addfollow"){if(b.follow.length<5){b.follow.push({id:rid("f"),when:"Tiếp theo",ref:""});touch();draw()}return}
  if(a==="delfollow"){b.follow=b.follow.filter(function(x){return x.id!==id});touch();draw();return}
  if(a==="addlist"){ST.drawer={type:"list",id:id};draw();return}
  if(a==="togglelist"||a==="dellist"){var p=id.split(":"),arr=b[p[0]],it=mk(arr,p[1]);if(a==="togglelist")it.on=!it.on;else b[p[0]]=arr.filter(function(x){return x.id!==p[1]});touch();draw();return}
});
async function runSim(body,said){
  var r=await sim(body);
  r.messages.forEach(function(m){ST.chat.push(toChat(m))});
  ST.cur=r.state.cur;
  var q={sent:["Đã gửi (thử)","ok"],handoff:["Chuyển chị: "+r.result.note,"bad"],blocked:["Chặn: "+r.result.note,"warn"],out_of_script:["Ngoài kịch bản: báo chị","bad"],nothing:["-","gray"]}[r.result.kind]||["-","gray"];
  ST.simlog.unshift({time:nowHM(),said:said,flow:r.result.flow||"-",res:q[0],cls:q[1],text:r.log.join("\n")});
  draw();
}
/* Lỗi hiện ngay trong ngăn kéo (thông báo chung của web nằm dưới lớp phủ nên chị không thấy). */
function derr(m){var e=document.getElementById("d_err");if(ST.drawer&&e){e.textContent=m;e.hidden=false}else toast(m)}
async function saveDrawer(){
  var d=ST.drawer,b=ST.doc;
  try{
    if(d.type==="bot"){var nm0=val("d_name");if(!nm0){derr("Cần có tên bot");return}await api("/bots",{method:"POST",body:JSON.stringify({name:nm0,from:val("d_from")||undefined})});ST.drawer=null;await loadHome();derr("Đã tạo bot");return}
    if(d.type==="tag"){var tn=val("d_tname");if(!tn){toast("Cần có tên thẻ");return}var body0=JSON.stringify({name:tn,kind:val("d_tkind"),color:val("d_tcolor")});if(d.id)await api("/tags/"+d.id,{method:"PATCH",body:body0});else await api("/tags",{method:"POST",body:body0});ST.tags=await api("/tags");ST.drawer=null;draw();toast("Đã lưu thẻ");return}
    if(d.type==="page"){await api("/pages",{method:"POST",body:JSON.stringify({name:val("d_name"),fb_page_id:val("d_fb")})});ST.drawer=null;await loadHome();derr("Đã thêm Page");return}
    if(d.type==="msg"){
      var code=val("d_code"),text=val("d_text");if(!code||!text){derr("Cần có mã câu và nội dung");return}
      var o={code:code,grp:val("d_grp"),text:text,claim:val("d_claim"),img:val("d_img")};
      if(d.id){var m=mk(b.lib,d.id);for(var k in o)m[k]=o[k]}else{o.id=rid("m");b.lib.push(o)}
    }else if(d.type==="flow"){
      var nm=val("d_name");if(!nm){derr("Cần có tên luồng");return}
      var fl={id:rid("f"),code:val("d_code")||"LUONG-"+(b.flows.length+1),name:nm,keys:val("d_keys"),entry:false,win:"in",allow:[],nodes:[{id:rid("n"),t:"msg",x:30,y:40,ref:(b.lib[0]||{}).id||"",btns:[],next:""}]};
      b.flows.push(fl);ST.sel=fl.id;ST.node=fl.nodes[0].id;
    }else if(d.type==="node"){
      var ff=curFlow(),kk=val("d_k"),cnt=ff.nodes.length;
      var nn={id:rid("n"),t:kk,x:30+(cnt%3)*270,y:40+Math.floor(cnt/3)*170};
      if(kk==="msg"){nn.ref="";nn.btns=[];nn.next=""}else if(kk==="img"){nn.ref="";nn.next=""}else if(kk==="cond"){nn.c="xh";nn.yes="";nn.no=""}else if(kk==="jump"){nn.to=""}else{nn.ref=""}
      ff.nodes.push(nn);ST.node=nn.id;
    }else if(d.type==="product"){
      var pn=val("d_name"),pid=val("d_id").toLowerCase().replace(/[^a-z0-9_]/g,"");
      if(!pn||!pid){derr("Cần có tên và mã ngắn (chữ thường, số)");return}
      if(mk(b.products,pid)){derr("Mã ngắn này đã có");return}
      b.products.push({id:pid,name:pn});
    }else if(d.type==="offer"){
      var pr=val("d_price");if(!pr){derr("Cần có giá");return}
      b.offers.push({id:rid("o"),prod:d.id,name:val("d_name")||"Mua riêng",lv:val("d_lv"),price:pr,from:val("d_from")||""});
    }else if(d.type==="group"){
      var gg=val("d_g").toUpperCase().replace(/\s+/g,"");if(!gg){derr("Cần có mã nhóm");return}
      if(b.media.some(function(x){return x.g===gg})){derr("Nhóm này đã có");return}
      b.media.push({g:gg,d:val("d_d"),urls:[]});
    }else if(d.type==="urls"){
      var g=b.media.filter(function(x){return x.g===d.id})[0],ls=val("d_urls").split(/\n+/).map(function(x){return x.trim()}).filter(Boolean);
      if(!ls.length){derr("Chưa có đường dẫn nào");return}
      if(ls.some(function(x){return !/^https:\/\//i.test(x)})){derr("Mỗi đường dẫn phải bắt đầu bằng https://");return}
      g.urls=g.urls.concat(ls);
    }else if(d.type==="banned"){
      var bt=val("d_text");if(!bt){derr("Cần có nội dung");return}b.banned.push(bt);
    }else if(d.type==="list"){
      var tx=val("d_text");if(!tx){derr("Cần có nội dung");return}b[d.id].push({id:rid("r"),text:tx,on:true});
    }
    ST.drawer=null;touch();draw();
  }catch(e){derr(e.message)}
}
document.addEventListener("change",function(e){
  if(!alive())return;
  var t=e.target;if(!ST.root.contains(t))return;
  var a=t.getAttribute("data-act"),b=ST.doc;
  var nbv=t.getAttribute("data-nb");
  if(nbv&&b){var nn=curNode();if(nn){var q=nbv.split(":");
    if(q[0]==="btn"){var bt=nn.btns[+q[1]];if(bt)bt[q[2]]=t.value}else nn[q[0]]=t.value;
    touch();if(t.tagName==="SELECT")draw()}return}
  var fl=t.getAttribute("data-flow");
  if(fl&&b){var f=curFlow();if(f){f[fl]=t.value;touch();if(t.tagName==="SELECT"||fl==="code"||fl==="name")draw()}return}
  var fo=t.getAttribute("data-follow");
  if(fo&&b){var pp=fo.split(":"),it=mk(b.follow,pp[1]);if(it){it[pp[0]]=t.value;touch()}return}
  if(a==="cvnote"&&ST.demo){return}
  if(a==="cvnote"){guard(async function(){await api("/convs/"+ST.cvId,{method:"PUT",body:JSON.stringify({note:t.value})});if(ST.cv)ST.cv.note=t.value;toast("Đã lưu ghi chú")});return}
  if(a==="cvfilter"){ST.cvTag=+t.value||0;ST.cvId=0;ST.cv=null;loadConvs();return}
  if(a==="cvpage"){ST.cvPage=t.value;ST.cvId=0;ST.cv=null;loadConvs();return}
  if(a==="botname"){ST.name=t.value.trim()||ST.name;touch();return}
  if(a==="pickbot"){if(t.value)openBot(t.value);else goHome();return}
  if(a==="pagebot"){guard(async function(){try{await api("/pages/"+t.getAttribute("data-id"),{method:"PATCH",body:JSON.stringify({bot_id:t.value||null})})}finally{await loadHome()}});return}
  if(a==="pagemode"){guard(async function(){try{await api("/pages/"+t.getAttribute("data-id"),{method:"PATCH",body:JSON.stringify({mode:t.value})})}finally{await loadHome()}});return}
  if(a==="setxh"){ST.xh=t.value;draw();return}
  if(a==="setphone"){ST.phone=t.checked;draw();return}
});
document.addEventListener("input",function(e){
  if(!alive())return;
  if(e.target.id==="q"){ST.q=e.target.value;draw()}
  if(e.target.id==="cvq"){ST.cvQ=e.target.value;clearTimeout(ST.cvT);ST.cvT=setTimeout(function(){ST.cvId=0;ST.cv=null;loadConvs()},350)}
});
setInterval(function(){
  if(!alive()||(ST.view==="inbox"?false:(ST.view!=="bot"||ST.tab!=="hl"))||ST.drawer||ST.demo)return;
  var ae=document.activeElement;if(ae&&ST.root.contains(ae)&&(ae.tagName==="INPUT"||ae.tagName==="TEXTAREA"))return;
  loadConvs();
},15000);
document.addEventListener("keydown",function(e){
  if(!alive())return;
  if(e.key==="Enter"&&e.target.id==="simin"){e.preventDefault();var bt=document.querySelector('#ht [data-act="send"]');if(bt)bt.click()}
  if(e.key==="Escape"){if(ST.conn){ST.conn=null;draw()}else if(ST.drawer){ST.drawer=null;draw()}}
});
var drag=null;
document.addEventListener("pointerdown",function(e){
  if(!alive())return;
  var h=e.target.closest("[data-drag]");if(!h)return;
  var f=curFlow(),n=f&&mk(f.nodes,h.getAttribute("data-drag"));if(!n)return;
  drag={n:n,el:h.parentNode,sx:e.clientX,sy:e.clientY,ox:n.x,oy:n.y,moved:false};e.preventDefault();
});
document.addEventListener("pointermove",function(e){
  if(!drag)return;var dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
  if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
  if(drag.moved){drag.n.x=Math.max(0,drag.ox+dx);drag.n.y=Math.max(0,drag.oy+dy);drag.el.style.left=drag.n.x+"px";drag.el.style.top=drag.n.y+"px";drawEdges()}
});
document.addEventListener("pointerup",function(){
  if(!drag)return;var d=drag;drag=null;
  if(d.moved){touch();return}
  if(ST.conn){var f=curFlow(),from=f&&mk(f.nodes,ST.conn.from);if(from&&from!==d.n){from[ST.conn.key]=d.n.id;touch()}ST.conn=null;draw();return}
  ST.node=d.n.id;draw();
});

/* ---------- Mở trang ---------- */
/* Hội thoại: một mục riêng trong menu, xem tất cả Page, không cần chọn bot */
PAGES.hoithoaiagent=function(m){
  m.innerHTML='<div id="ht"></div>'+HT_CSS;
  ST.root=m.querySelector("#ht");
  ST.view="inbox";ST.drawer=null;ST.toast="";ST.cvId=0;ST.cv=null;ST.cvTag=0;ST.cvQ="";ST.cvPage="all";ST.demo=false;ST.demoAll=null;ST.botId="";ST.tab="hl";
  ST.doc={products:[],lib:[],flows:[],offers:[],media:[],follow:[],rules:[],handoff:[],banned:[]};
  draw();
  Promise.all([api("/tags"),api("/pages"),api("/control")]).then(function(r){ST.tags=r[0];ST.pages=r[1];ST.ctl=r[2];return loadConvs()}).catch(function(e){toast("Chưa tải được: "+e.message)});
};
PAGES.huanluyenagent=function(m){
  m.innerHTML='<div id="ht"></div>'+HT_CSS;
  ST.root=m.querySelector("#ht");
  ST.view="home";ST.hsub="bp";ST.botId="";ST.doc=null;ST.drawer=null;ST.toast="";
  draw();
  loadHome();
};
})();
{const s=MODULES.find(m=>m.k==="setup");if(s){const g0=s.groups;s.groups=()=>{const G=g0();const hs=G.find(g=>g[0]==="Hệ thống");if(hs)hs[1].push(MI("huanluyenagent","Huấn luyện agent",u=>u.role==="admin"));return G}}}
{const i=MODULES.findIndex(m=>m.k==="agt");const mod=MODULES[i];
 if(mod){const g0=mod.groups;mod.groups=()=>{const G=g0();G[0][1].push(MI("hoithoaiagent","Hội thoại",u=>u.role==="admin"));G[0][1].push(MI("huanluyenagent","Huấn luyện agent",u=>u.role==="admin"));return G}}}
