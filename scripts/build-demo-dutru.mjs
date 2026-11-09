/**
 * Dựng bản DEMO một file HTML của trang "Dự trù giá bán" (chạy được không cần đăng nhập, số liệu mẫu) để chị Hoa bấm thử.
 *   node scripts/build-demo-dutru.mjs  →  docs/demo-du-tru-gia-ban.html
 * Dùng đúng mã trang thật (hub/src/dutrucalc.js, dutru.js, spccalc.js); chỉ giả phần khung và dữ liệu danh mục.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const S = (f) => readFileSync(new URL('../hub/src/' + f, import.meta.url), 'utf8');
const css = S('style.css') + '\n' + S('theme-navy.css') + '\n' + S('theme-sang.css');
const stub = `
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const nf=n=>Math.round(n||0).toLocaleString("vi-VN");
const $=s=>document.querySelector(s);
const H=(t,s)=>'<div class="ph"><h1>'+t+'</h1>'+(s?'<div class="ph-sub">'+s+'</div>':'')+'</div>';
const kpi=(l,v,h,col)=>'<div class="kpi t-navy"><div class="kb"><div class="l">'+l+'</div><div class="v"'+(col?' style="color:'+col+'"':'')+'>'+v+'</div>'+(h?'<div class="h">'+h+'</div>':'')+'</div></div>';
const opt=(arr,v)=>arr.map(o=>{const [a,b]=Array.isArray(o)?o:[o,o];return '<option value="'+esc(a)+'"'+(String(a)===String(v)?' selected':'')+'>'+esc(b)+'</option>'}).join("");
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,3500)}
function openDrawerHTML(h){const dr=$("#drawer");$("#drawerIn").innerHTML='<button class="x" id="dx">✕</button>'+h;dr.hidden=false;$("#dx").onclick=closeDrawer}
function closeDrawer(){$("#drawer").hidden=true}
const ME={name:"Chị Hoa"};
const _D={skus:[],dutru:null};const DB={data:_D,mutate(w,m,fn){fn(_D);try{localStorage.setItem("dutru_demo",JSON.stringify(_D.dutru))}catch(e){}}};
try{const s=JSON.parse(localStorage.getItem("dutru_demo")||"null");if(s)_D.dutru=s}catch(e){}
const D=()=>_D;
const PAGES={},MODULES=[],MI=(k,t,p)=>[k,t,p];
let PAGE="dutru";
const spcSeeCost=()=>true;
const spcKy=()=>"2026-11";
const kfold=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase();
const SPCB={rows:[],sales:[],prods:[],cost:[],err:""};
const R=(ch,sku,variant,code,qty,kind)=>({channel:ch,sku,variant,from_day:"",item_label:code+" - "+code,qty,kind,note:"",off_from:"",updated_at:"2026-11-01T00:00:00Z"});
SPCB.rows=[R("TIKTOK","SAP-1","","AILLA-SAP",1,"sp"),R("TIKTOK","BTVN-2","Bộ 2","AILLA-BTVN250",2,"sp"),R("TIKTOK","BTVN-2","Bộ 2","QUA-CHOI",1,"gift"),R("TIKTOK","BTVN-2","Bộ 2","HOP-GIAY",1,"pack"),
 R("FACEBOOK","TDGS-2","Combo 2 chai","AILLA-TDGS500",2,"sp"),R("FACEBOOK","TDGS-2","Combo 2 chai","QUA-KHAN",1,"gift"),R("TIKTOK","NX-1","","AILLA-NX1L",1,"sp")];
SPCB.prods=[["AILLA-SAP","Sáp thơm"],["AILLA-BTVN250","Bột tẩy vạn năng 250g"],["AILLA-TDGS500","Tinh dầu giặt sấy 500ml"],["AILLA-NX1L","Nước xả vải 1L"],["QUA-CHOI","Chổi cọ (quà)"],["QUA-KHAN","Khăn lau (quà)"],["HOP-GIAY","Hộp giấy"]].map(([code,name])=>({code,name,active:1}));
SPCB.cost=[{item:"AILLA-SAP",avg:14000},{item:"AILLA-BTVN250",avg:21000},{item:"AILLA-TDGS500",avg:38000},{item:"QUA-CHOI",avg:4500},{item:"QUA-KHAN",avg:3200}];
const spcLoad=()=>{};
const spcToday=()=>"2026-11-09";
function spcCtx(){const combos=spcGroup(SPCB.rows,SPCB.sales,spcToday());return {combos}}
function renderMain(){pDutru($("#main"))}
`;
const boot = `
if(!D().dutru){D().dutru={A:null,rows:[
 {id:"m1",ten:"Sáp thơm (ví dụ trong Google Sheet)",kenh:"tiktok",gia:55000,gvSp:14000,gvQua:0,aff:5,cpqc:20,parts:null,mSp:true,mQua:true},
 {id:"m2",ten:"Bột tẩy vạn năng bộ 2 + chổi",kenh:"tiktok",gia:159000,gvSp:null,gvQua:null,aff:5,cpqc:15,parts:[{code:"AILLA-BTVN250",qty:2,kind:"sp"},{code:"QUA-CHOI",qty:1,kind:"gift"},{code:"HOP-GIAY",qty:1,kind:"pack"}],mSp:false,mQua:false},
 {id:"m3",ten:"Tinh dầu giặt sấy combo 2 chai + khăn",kenh:"facebook",gia:249000,gvSp:null,gvQua:null,aff:0,cpqc:15,parts:[{code:"AILLA-TDGS500",qty:2,kind:"sp"},{code:"QUA-KHAN",qty:1,kind:"gift"}],mSp:false,mQua:false},
 {id:"m4",ten:"Nước xả vải 1L (chưa có giá vốn)",kenh:"tiktok",gia:79000,gvSp:null,gvQua:null,aff:5,cpqc:15,parts:[{code:"AILLA-NX1L",qty:1,kind:"sp"}],mSp:false,mQua:false}]}}
document.getElementById("dz-reset").onclick=()=>{try{localStorage.removeItem("dutru_demo")}catch(e){}location.reload()};
pDutru($("#main"));
`;
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo Dự trù giá bán</title>
<style>${css}
body{margin:0}#demo-bar{background:#fff7e6;color:#8a5300;padding:10px 20px;font-size:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}#main{padding:20px 24px;max-width:1700px;margin:0 auto}
.drawer{position:fixed;inset:0;background:rgba(15,27,61,.35);z-index:50;display:flex;justify-content:flex-end}.drawer[hidden]{display:none}.drawer .in{background:#fff;width:min(560px,100%);height:100%;overflow:auto;padding:22px;position:relative}.drawer .x{position:absolute;right:14px;top:12px;border:0;background:none;font-size:18px;cursor:pointer}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f1b3d;color:#fff;padding:10px 18px;border-radius:10px;z-index:60}.toast[hidden]{display:none}
</style></head><body>
<div id="demo-bar"><b>BẢN DEMO</b> Số liệu giá vốn ở đây là số MẪU để chị bấm thử, chưa phải giá vốn thật trên web. Mọi chỗ sửa chỉ lưu trong trình duyệt này. <button class="btn sm" id="dz-reset">Về dữ liệu mẫu ban đầu</button></div>
<div id="main"></div><div class="drawer" id="drawer" hidden><div class="in" id="drawerIn"></div></div><div class="toast" id="toast" hidden></div>
<script>
${stub}
${S('spccalc.js')}
${S('dutrucalc.js')}
${S('dutru.js')}
${boot}
</script></body></html>`;
writeFileSync(new URL('../docs/demo-du-tru-gia-ban.html', import.meta.url), html);
console.log('docs/demo-du-tru-gia-ban.html', Math.round(html.length / 1024) + ' KB');
