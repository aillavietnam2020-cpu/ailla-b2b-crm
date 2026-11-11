/* =====================================================================
   CHẤM CÔNG TRÊN ĐIỆN THOẠI (chị Hoa duyệt 04/11/2026)
   - Nhân viên mở vanhanh trên điện thoại, bấm Chấm vào / Chấm ra. Trình duyệt lấy vị trí, máy chủ ghi giờ máy chủ
     và khoảng cách tới điểm chấm của lịch mình (văn phòng, xưởng riêng). Ngoài phạm vi: chỉ lịch được phép (Sale) chấm khi ghi lý do.
   - Mỗi người theo một lịch làm (Văn phòng, Xưởng, Live theo ca, Sale giờ linh hoạt), gán theo phòng ban hoặc từng người.
     Người làm ca: HCNS / trưởng nhóm xếp ca theo tuần (trang Xếp ca), đi muộn tính theo giờ ca.
   - Mọi giờ giấc, ca, quy tắc (mốc hỏi lý do đi muộn, chuyên cần, tiền chuyên cần, ăn trưa) là ô điền ở Nhân sự › Cài đặt chấm công
     (CEO 04/11: không cố định trong code). Mặc định theo thông báo 01102026/TB-AILLA.
   - Trưởng nhóm xem và xếp ca phòng mình; CEO, HCNS, kế toán xem cả công ty. Cài đặt: CEO, HCNS.
   - Chưa tự đổ vào bảng lương; HCNS vẫn chốt công ở Nhân sự › Chấm công. Máy chấm công cũ dùng song song tới khi CEO bảo tắt.
   - Máy chủ: /api/hub/chamcong (src/server/routes/chamCong.ts). Chữ trên màn hình theo vai trò, không xưng chị/em.
   ===================================================================== */
const CC={me:null,meKey:"",day:null,dayKey:"",mon:null,monKey:"",cfg:null,xep:null,xepKey:"",xepEdit:{},tuan:"",thang:"",ngay:"",pb:"",open:{},busy:false,reason:null,err:""};
ICONS.clock='<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
/* Kiểu riêng trang chấm công (để ở đây cho khỏi đụng style.css dùng chung). */
if(typeof document!=="undefined"&&!document.getElementById("cc-css")){const st=document.createElement("style");st.id="cc-css";st.textContent=`
.cc-main{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;max-width:520px;margin-inline:auto;width:100%}
.cc-date{color:var(--muted);font-size:14px}
.cc-clock{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:44px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.1}
.cc-st{display:flex;flex-direction:column;gap:4px;font-size:15px}
.cc-btn{width:100%;max-width:360px;min-height:56px;font-size:18px}
.cc-err{color:var(--red);font-size:14px;max-width:420px}
.cc-ca{font-size:15px}
.cc-reason{width:100%;max-width:420px;display:flex;flex-direction:column;gap:6px;text-align:left;font-size:14px;background:var(--orange-soft);border-radius:10px;padding:10px 12px}
.cc-reason.cc-warn{background:var(--red-soft)}
.cc-reason textarea{width:100%;font:inherit;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}
.cc-reason .btn{align-self:flex-end}
tr.cc-today td{font-weight:600}
tr.cc-row{cursor:pointer}
tr.cc-det>td{background:var(--gray-soft);padding:8px}
.cc-may{background:var(--brand-soft,#efedff);border-radius:12px;padding:10px 12px;font-size:13.5px;margin:6px 0 10px;text-align:left}
.cc-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px 16px}
.cc-form label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted)}
.cc-lich{border:1px solid var(--line,#e5e7eb);border-radius:12px;padding:14px 16px;margin-bottom:12px}.cc-lich h3{margin:0 0 10px;font-size:15px}
.cc-lg{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 18px}.cc-lg>.f{display:flex;flex-direction:column;gap:5px;font-size:13px;color:var(--muted);min-width:0}.cc-lg>.f.w2{grid-column:span 2}
.cc-lg .pair{display:flex;align-items:center;gap:6px}.cc-lg .pair input{flex:1;min-width:0}.cc-lg input:not([type=checkbox]),.cc-lg select{width:100%;box-sizing:border-box}.cc-lg .pair input{width:auto}.cc-lg .ck{display:flex;flex-wrap:wrap;gap:4px 14px;color:var(--text,inherit)}
.cc-lcu{margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--gray-soft)}.cc-lcu .hint{margin:0 0 8px}
@media(max-width:560px){.cc-lg>.f.w2{grid-column:auto}}
.cc-chk{display:inline-flex;align-items:center;gap:4px;margin-right:10px;white-space:nowrap;font-size:13px}
.cc-grid select{min-width:110px}
.cc-savebar{position:sticky;bottom:0;z-index:5;display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 14px;box-shadow:0 -4px 16px rgba(30,35,80,.08);margin-top:8px}
.has-mobtab .cc-savebar{bottom:calc(84px + env(safe-area-inset-bottom,0px))}
.cc-savebar .btn{min-height:44px;padding-inline:22px}
.cc-out{display:grid;gap:10px;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;margin:4px 0}
.cc-outw{margin:0;background:#fff1dc;color:#8a4b00;border-radius:12px;padding:10px 12px;font-size:14px}
.cc-outl{font-weight:600;font-size:13.5px}
.cc-chips{display:flex;flex-wrap:wrap;gap:8px}
.cc-chip{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:8px 14px;font:inherit;font-size:14px;cursor:pointer}
.cc-chip.on{background:linear-gradient(120deg,#4b54d1,#7253e0);color:#fff;border-color:transparent}
.cc-shoot{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--line);border-radius:12px;padding:10px;cursor:pointer;font-size:14px}
.cc-shoot.on{border-color:#4b54d1;background:#f6f5ff}
.cc-out textarea{width:100%;box-sizing:border-box}
.cc-outimg{width:100%;border-radius:12px;display:block}
.cc-cam{text-align:center;cursor:pointer}
.cc-xnimg{width:84px;height:63px;object-fit:cover;border-radius:10px;display:block}
.cc-xnc{display:none}
@media (max-width:760px){
.cc-xnt{display:none}.cc-xnc{display:grid;gap:12px}
.cc-xnk{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px;display:grid;gap:8px}
.cc-xnh{display:flex;gap:10px;align-items:flex-start}.cc-xnh .cc-xnimg{width:96px;height:72px;flex:none}
.cc-xnh b{font-size:15px}.cc-xnr{font-size:13.5px;line-height:1.45}.cc-xnr span{color:var(--muted)}
.cc-xnk .acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cc-xnk .acts .btn{min-height:44px;font-size:14.5px;justify-content:center}
.cc-xnf{flex-wrap:wrap;gap:8px}.cc-xnf .cc-chips{width:100%}.cc-xnf .cc-chip{flex:1;text-align:center;padding:9px 8px}.cc-xnf #cc-xnrl{display:none}
.cc-out{padding:12px;border-radius:14px}.cc-out .cc-chip{flex:1;text-align:center;min-height:44px;white-space:nowrap;padding:8px 6px}
.cc-cam{min-height:50px;display:flex!important;align-items:center;justify-content:center;font-size:16px}
.cc-out textarea{font-size:16px}.cc-shoot{padding:12px}
}
tr.cc-cu>td{background:var(--gray-soft);padding:8px 12px}.cc-curow{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:13px}.cc-curow label{display:inline-flex;align-items:center;gap:6px}
.cc-mon tr.cc-row>td:first-child{min-width:210px;white-space:normal}.cc-mon th,.cc-mon tr.cc-row>td{white-space:nowrap}
.cc-grid th.we,.cc-grid td.we{background:var(--gray-soft)}
`;document.head.appendChild(st)}
const CC_PAGES=["cc_toi","cc_ngay","cc_thang","cc_xepca","cc_caidat","cc_may","cc_xn"];
const ccOn=()=>typeof PAGE!=="undefined"&&CC_PAGES.includes(PAGE);
const ccRedraw=()=>{if(ccOn())renderMain()};
const ccLead=u=>!!u&&["lead","truongphong"].includes(u.role);
const ccHr=u=>!!u&&(u.role==="admin"||u.phongBan==="HCNS"||hrOk());
const ccHm=iso=>{if(!iso)return "—";const d=new Date(Date.parse(iso)+7*3600e3);return String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0")};
const ccDow=n=>["CN","T2","T3","T4","T5","T6","T7"][new Date(n+"T00:00:00Z").getUTCDay()];
const ccDm=n=>n.slice(8)+"/"+n.slice(5,7);
const ccVnNow=()=>new Date(Date.now()+7*3600e3);
const ccAddDays=(d,n)=>new Date(Date.parse(d+"T00:00:00Z")+n*864e5).toISOString().slice(0,10);
const ccMonths=()=>{const d=ccVnNow(),o=[];for(let i=0;i<6;i++){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-i,1));o.push(x.toISOString().slice(0,7))}return o};
const ccMonthSel=id=>`<select id="${id}">${ccMonths().map(k=>`<option value="${k}"${k===(CC.thang||ccMonths()[0])?" selected":""}>Tháng ${k.slice(5)}/${k.slice(0,4)}</option>`).join("")}</select>`;
const ccPbName=k=>{const d=(CC.day&&CC.day.deps||CC.mon&&CC.mon.deps||CC.xep&&CC.xep.deps||[]).find(x=>x.k===k);return d?d.n:(k||"—")};
const ccTien=n=>Number(n||0).toLocaleString("vi-VN")+"đ";
const CC_T7={ca:"thứ Bảy làm cả ngày",nua:"thứ Bảy làm buổi sáng",nghi:"nghỉ thứ Bảy",nghi13:"nghỉ thứ Bảy tuần 1 và 3",nghi24:"nghỉ thứ Bảy tuần 2 và 4"};
const CC_KIEU={codinh:"Giờ cố định",ca:"Theo ca",tudo:"Giờ linh hoạt"};
const ccLate=l=>{const t=+l.gioVao.slice(0,2)*60+ +l.gioVao.slice(3)+l.anHan;return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0")};
const ccTrua=l=>l.truaTu&&l.truaDen?`, nghỉ trưa ${l.truaTu}–${l.truaDen}`:"";
const ccLichTxt=l=>l.kieu==="codinh"?`${l.gioVao}–${l.gioRa}${ccTrua(l)}, quá ${ccLate(l)} là muộn · ${CC_T7[l.thuBay]||""}`:l.kieu==="ca"?`làm theo ca được xếp, vào ca trễ quá ${l.anHan} phút là muộn`:"giờ linh hoạt, chỉ ghi giờ vào ra";
const ccCaTxt=c=>c?`${esc(c.ten)} ${c.tu}–${c.den}`:"Không có ca";
const ccGio=m=>m?Math.floor(m/60)+"g"+String(m%60).padStart(2,"0"):"—";
const ccPhut=m=>m>=60?Math.floor(m/60)+" giờ "+(m%60?m%60+" phút":""):m+" phút";
/* Ghi chú một ngày công: đi muộn, về sớm, quên chấm ra, ngoài phạm vi, muộn chưa ghi lý do. */
const ccNote=x=>{const a=[];if(x.le)a.push(pill("Nghỉ lễ","gry"));if(x.don)a.push(pill(x.don,x.don==="Nghỉ không lương"?"amb":"grn"));if(x.muon)a.push(pill("Muộn "+ccPhut(x.muon),"amb"));if(x.som)a.push(pill("Về sớm "+ccPhut(x.som),"amb"));if(x.quenRa)a.push(pill("Quên chấm ra","red"));if(x.ngoai)a.push(pill("Ngoài phạm vi","red"));if(x.canhBao)a.push(pill("Muộn chưa ghi lý do","red"));if(x.choXn)a.push(pill("Chấm ngoài chờ xác nhận","amb"));if(x.chamNgoai)a.push(pill("Chấm ngoài · đã xác nhận","grn"));if(x.bu){const b=x.bu,d=ccDm(b.ngay);a.push(b.kq==="duyet"?pill("Xin bù "+d+" · chờ duyệt","amb"):b.kq==="cho"?pill("Chờ làm bù "+d,"amb"):b.kq==="du"?pill("Đã bù bằng "+d,"grn"):b.kq==="thieu"?pill("Bù chưa đủ ("+d+")","amb"):pill("Không đến làm bù "+d,"red"))}if(x.lamBu)a.push(pill("Làm bù cho "+ccDm(x.lamBu.cho),"blu"));return a.join(" ")};
let CC_SKEW=0; // chênh giữa đồng hồ máy chủ và điện thoại, để biết đang muộn bao nhiêu phút
const ccNowMin=()=>{const d=new Date(Date.now()+CC_SKEW+7*3600e3);return d.getUTCHours()*60+d.getUTCMinutes()};
const ccMuonNay=()=>{const R=CC.me;if(!R||!R.rule||!R.rule.tinh)return 0;const m=ccNowMin()-R.rule.vao;return m>R.lich.anHan?m:0};

async function ccLoadMe(force){
  const key=CC.thang||"";if(!force&&CC.meKey===key&&CC.me)return;CC.meKey=key;
  try{CC.me=await svApi("/api/hub/chamcong/me"+(CC.thang?"?thang="+CC.thang:""));CC_SKEW=Date.parse(CC.me.now)-Date.now();CC.err=""}catch(e){CC.err=e.message||"Không tải được"}
  ccRedraw();
}
async function ccLoadDay(force){
  const key=CC.ngay||"";if(!force&&CC.dayKey===key&&CC.day)return;CC.dayKey=key;CC.day={loading:true};
  try{CC.day=await svApi("/api/hub/chamcong/ngay"+(CC.ngay?"?ngay="+CC.ngay:""))}catch(e){CC.day={err:e.message||"Không tải được"}}
  ccRedraw();
}
async function ccLoadMon(force){
  const key=CC.thang||"";if(!force&&CC.monKey===key&&CC.mon)return;CC.monKey=key;CC.mon={loading:true};
  try{CC.mon=await svApi("/api/hub/chamcong/thang"+(CC.thang?"?thang="+CC.thang:""))}catch(e){CC.mon={err:e.message||"Không tải được"}}
  ccRedraw();
}
async function ccLoadXep(force){
  const key=CC.tuan||"";if(!force&&CC.xepKey===key&&CC.xep)return;CC.xepKey=key;CC.xep={loading:true};
  try{CC.xep=await svApi("/api/hub/chamcong/xepca"+(CC.tuan?"?tu="+CC.tuan:""));CC.xepEdit={}}catch(e){CC.xep={err:e.message||"Không tải được"}}
  ccRedraw();
}

/* Lấy vị trí điện thoại. Lỗi thì trả lời bằng câu dễ hiểu. */
function ccPos(){
  return new Promise((ok,bad)=>{
    if(!navigator.geolocation)return bad(new Error("Trình duyệt này không lấy được vị trí. Hãy mở bằng Chrome hoặc Safari trên điện thoại."));
    const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent),chrome=/CriOS/i.test(navigator.userAgent);
    navigator.geolocation.getCurrentPosition(p=>ok(p.coords),e=>bad(new Error(e.code===1
      ?(ios?`iPhone chưa cho trang web xem vị trí. (1) Mở Cài đặt › Quyền riêng tư & Bảo mật › Dịch vụ định vị: bật, rồi chọn ${chrome?"Chrome":"Trang web Safari"} › Khi dùng ứng dụng, bật Vị trí chính xác. (2) ${chrome?"Trong Chrome":"Trong Safari, bấm biểu tượng cạnh ô địa chỉ"} › Cài đặt trang web › Vị trí › Cho phép. Tải lại trang rồi bấm lại.`
        :"Trang web chưa được phép xem vị trí. Bấm biểu tượng ổ khóa cạnh địa chỉ web › Quyền › Vị trí › Cho phép, rồi bấm lại.")
      :"Chưa lấy được vị trí. Bật định vị (GPS) trên điện thoại, ra chỗ thoáng rồi bấm lại.")),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
  });
}
/* Chấm công chính chủ (CEO 10/11): mỗi người một máy chấm công, mỗi lần chấm xác nhận vân tay / Face ID (WebAuthn).
   Lần đầu trên một máy: đăng ký máy đó. Máy khác: không xác nhận được, báo HCNS. Mã máy (did) để phát hiện một máy chấm cho nhiều người. */
const ccB64={e:b=>{const u=new Uint8Array(b);let s="";for(const x of u)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")},
  d:s=>{const t=s.replace(/-/g,"+").replace(/_/g,"/");const b=atob(t+"=".repeat((4-t.length%4)%4));const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}};
function ccDid(){try{let d=localStorage.getItem("cc_did");if(!d){d=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2));localStorage.setItem("cc_did",d)}return d}catch(e){return ""}}
class CcLoi extends Error{constructor(m,code){super(m);this.code=code}}
/* Lấy sẵn thử thách khi mở trang (và làm mới sau 4 phút) để bấm chấm là hỏi vân tay / Face ID ngay: iPhone chặn nếu phải chờ mạng trước. */
let CC_TH=null,CC_THB=false;
function ccPrep(force){if(CC_THB||(!force&&CC_TH&&Date.now()-CC_TH.at<240000))return;CC_THB=true;
  svApi("/api/hub/chamcong/may/thu-thach",{method:"POST",body:"{}"}).then(t=>{const doi=!CC_TH||CC_TH.coMay!==t.coMay;CC_TH={...t,at:Date.now()};CC_THB=false;if(doi&&typeof PAGE!=="undefined"&&PAGE==="cc_toi")ccRedraw()}).catch(()=>{CC_THB=false})}
async function ccXacMinh(){
  if(!window.PublicKeyCredential||!navigator.credentials)throw new CcLoi("Trình duyệt này chưa hỗ trợ vân tay / Face ID. Mở web bằng Chrome (Android) hoặc Safari (iPhone) rồi chấm lại.","KHONG_HO_TRO");
  const t=CC_TH&&Date.now()-CC_TH.at<270000?CC_TH:await svApi("/api/hub/chamcong/may/thu-thach",{method:"POST",body:"{}"});CC_TH=null;
  if(!t.coMay){
    let cr;try{cr=await navigator.credentials.create({publicKey:{challenge:ccB64.d(t.chal),rp:{id:t.rpId,name:"Ailla chấm công"},user:{id:ccB64.d(t.uid),name:t.ten||"nhanvien",displayName:t.ten||"Nhân viên"},
      pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",residentKey:"discouraged"},timeout:60000,attestation:"none"}})}
    catch(e){throw new CcLoi(e&&e.name==="NotAllowedError"?"Chưa xác nhận vân tay / Face ID. Bấm chấm lại và làm theo hướng dẫn của điện thoại.":"Máy này chưa dùng được vân tay / Face ID cho web ("+(e&&e.name||"lỗi")+"). Mở bằng Chrome hoặc Safari bản mới.","DK_LOI")}
    const r=cr.response;if(typeof r.getPublicKey!=="function"||!r.getPublicKey())throw new CcLoi("Trình duyệt này cũ, chưa đăng ký được máy chấm công. Cập nhật Chrome / Safari rồi chấm lại.","CU");
    return {loai:"dk",credId:cr.id,pub:ccB64.e(r.getPublicKey()),alg:r.getPublicKeyAlgorithm(),cd:ccB64.e(r.clientDataJSON),ad:typeof r.getAuthenticatorData==="function"?ccB64.e(r.getAuthenticatorData()):""}}
  let as;try{as=await navigator.credentials.get({publicKey:{challenge:ccB64.d(t.chal),rpId:t.rpId,allowCredentials:[{type:"public-key",id:ccB64.d(t.credId)}],userVerification:"required",timeout:60000}})}
  catch(e){
    if(e&&e.name==="NotAllowedError"){svApi("/api/hub/chamcong/may/la",{method:"POST",body:JSON.stringify({did:ccDid()})}).catch(()=>0);
      throw new CcLoi(`Không xác nhận được. Nếu đây không phải máy chấm công của bạn${t.tenMay?" ("+t.tenMay+")":""} thì không chấm được trên máy này. Đổi máy, mất máy thì nhờ HCNS bấm Cho đổi máy. Nếu đúng máy của bạn thì bấm chấm lại và quét vân tay / Face ID.`,"MAY_LA")}
    throw new CcLoi("Chưa xác nhận được vân tay / Face ID ("+(e&&e.name||"lỗi")+"). Bấm chấm lại.","XN_LOI")}
  const r=as.response;return {loai:"xn",credId:as.id,ad:ccB64.e(r.authenticatorData),cd:ccB64.e(r.clientDataJSON),sig:ccB64.e(r.signature)};
}
async function ccCham(loai){
  if(CC.busy)return;if(!ccPhone()){toast("Chỉ chấm công bằng điện thoại");return}
  const O=CC.out&&CC.out.loai===loai?CC.out:null;
  if(O){const t=$("#cc-outnote");if(t)O.note=t.value;
    if(O.ly==="quay"&&!O.shoot&&!(O.note||"").trim()){toast("Ghi quay ở đâu, hoặc chọn buổi quay");return}
    if(O.ly!=="quay"&&!(O.note||"").trim()){toast(O.ly==="khach"?"Ghi gặp khách nào, ở đâu":"Ghi rõ việc gì");return}
    if(!O.anh){toast("Chụp ảnh check-in trước khi chấm");return}}
  const sh=O&&O.ly==="quay"?ccShoots().find(s=>s.id===O.shoot):null;
  const lyDo=O?(CC_LY[O.ly]+((O.note||"").trim()?": "+O.note.trim():"")).slice(0,300):"";
  const lyDoMuon=loai==="vao"?(($("#cc-lymuon")||{}).value||"").trim():"";
  CC.busy=true;CC.err="";ccRedraw();
  try{
    const xm=await ccXacMinh();
    let c=null,posErr=null;try{c=await ccPos()}catch(e){posErr=e}
    let r;try{r=await svApi("/api/hub/chamcong/cham",{method:"POST",body:JSON.stringify({xm,did:ccDid(),loai,lat:c?c.latitude:null,lng:c?c.longitude:null,acc:c?c.accuracy:null,lyDo,lyDoMuon,anh:O?O.anh:undefined,quay:sh?{id:sh.id,gio:sh.gio||"",diaDiem:sh.diaDiem||"",ghiChu:sh.ghiChu||""}:undefined})})}catch(e){if(posErr&&e.code==="NO_LOCATION")throw posErr;throw e}
    CC.reason=null;CC.out=null;toast((loai==="vao"?"Đã chấm vào lúc ":"Đã chấm ra lúc ")+ccHm(r.at)+(r.xn==="cho"?", chờ xác nhận":""));
    await ccLoadMe(true);
  }catch(e){
    if(e.code==="NEED_OUT"&&!ccPhone())CC.err="Bạn đang ở ngoài văn phòng. Tính năng chấm công ngoài văn phòng không khả dụng trên máy tính.";
    else if(e.code==="NEED_OUT"){const s=ccShoots()[0];CC.out={...(CC.out&&CC.out.loai===loai?CC.out:{ly:s?"quay":"khach",shoot:s?s.id:"",note:"",anh:""}),loai,msg:e.message}}
    else if(e.code==="NEED_REASON")CC.reason={loai,msg:e.message};else if(e.code!=="HUY")CC.err=e.message||"Chưa chấm được";
  }
  CC.busy=false;ccPrep(true);ccRedraw();
}

let CC_TICK=0;
function ccClock(){clearInterval(CC_TICK);CC_TICK=setInterval(()=>{const el=document.getElementById("cc-clock");if(!el||PAGE!=="cc_toi"){clearInterval(CC_TICK);return}const d=ccVnNow();el.textContent=[d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()].map(n=>String(n).padStart(2,"0")).join(":")},1000)}

/* ---------- Của tôi: nút chấm + ca + công trong tháng ---------- */
function pCcToi(m){
  try{if(ccPhone())ccPrep(false)}catch(e){}
  if(!CC.me){m.innerHTML=H("Chấm công")+(CC.err?`<section class="card"><p class="empty">${esc(CC.err)}</p></section>`:`<section class="card"><p class="empty">Đang tải…</p></section>`);ccLoadMe();return}
  const R=CC.me,L7=R.lich,T=R.tong,Q=R.quyTac,hn=R.homNay||[],vao=hn.find(x=>x.loai==="vao"),ra=hn.filter(x=>x.loai==="ra").pop(),today=R.today;
  const loai=vao?"ra":"vao",tdy=(R.ngay||[]).find(x=>x.ngay===today)||{},isCa=L7.kieu==="ca",ccCo=L7.chuyenCan&&L7.kieu!=="tudo";
  const D7=ccVnNow(),dstr=`${ccDow(today)}, ${ccDm(today)}/${today.slice(0,4)}`;
  const xnP=x=>x.xn==="cho"?" "+pill("Chờ xác nhận","amb"):x.xn==="ok"?" "+pill("Đã xác nhận","grn"):x.xn==="khong"?" "+pill("Không xác nhận","red"):"";
  const where=x=>x.trong===0?`ngoài VP${x.ly_do?" · "+esc(x.ly_do):""}`:x.diem?`${esc(x.diem)}${x.kc!=null?" · cách "+x.kc+" m":""}`:"Chưa cài điểm chấm";
  const st=!vao&&!ra?`<p class="cc-st">Hôm nay chưa chấm công.</p>`
    :`<div class="cc-st">${vao?`<div><b>Vào ${ccHm(vao.at)}</b> <span class="hint">${where(vao)}</span> ${tdy.muon?pill("Muộn "+ccPhut(tdy.muon),"amb"):""}${xnP(vao)}</div>`:`<div>${pill("Chưa chấm vào","amb")}</div>`}
      ${ra?`<div><b>Ra ${ccHm(ra.at)}</b> <span class="hint">${where(ra)}</span>${xnP(ra)}</div>`:""}</div>`;
  const caLine=isCa?`<div class="cc-ca">Ca hôm nay: <b>${ccCaTxt(R.caHomNay)}</b></div>`:"";
  const rs=CC.reason&&CC.reason.loai===loai?`<div class="cc-reason"><p>${esc(CC.reason.msg)}</p><textarea id="cc-lydo" rows="2" placeholder="Ví dụ: gặp khách ở Hải Phòng"></textarea></div>`:"";
  const days=(R.ngay||[]).slice().reverse(),mn=loai==="vao"?ccMuonNay():0;
  const askMuon=loai==="vao"&&mn>Q.mocLyDo&&!(CC.out&&CC.out.loai===loai)?`<div class="cc-reason"><p>Bạn đang muộn ${ccPhut(mn)}. Ghi lý do đi muộn (không bắt buộc, bỏ trống thì HCNS thấy cảnh báo).</p><textarea id="cc-lymuon" rows="2" placeholder="Ví dụ: tắc đường"></textarea></div>`:"";
  const warn=vao&&tdy.canhBao?`<div class="cc-reason cc-warn"><p><b>Bạn đi muộn ${ccPhut(tdy.muon)} nhưng chưa ghi lý do.</b> HCNS và Lead sẽ thấy cảnh báo này.</p><textarea id="cc-lymuon2" rows="2" placeholder="Ghi lý do đi muộn"></textarea><button class="btn sm" id="cc-lymuon-ok">Lưu lý do</button></div>`:(vao&&tdy.lyDoMuon?`<p class="hint">Lý do đi muộn: ${esc(tdy.lyDoMuon)}</p>`:"");
  const tuan=isCa&&R.caTuan.length?`<section class="card"><div class="card-h"><h2>Ca 7 ngày tới</h2></div>${tbl(["Ngày","Ca"],R.caTuan.map(x=>`<tr${x.ngay===today?' class="cc-today"':""}><td>${ccDow(x.ngay)} ${ccDm(x.ngay)}</td><td>${x.ca?ccCaTxt(x.ca):'<span class="hint">Nghỉ</span>'}</td></tr>`))}</section>`:"";
  m.innerHTML=H("Chấm công",`Lịch ${esc(L7.ten)}: ${ccLichTxt(L7)}`)+`
  <section class="card cc-main">
    <div class="cc-date">${dstr} · Lịch ${esc(L7.ten)}</div>
    <div class="cc-clock" id="cc-clock">${[D7.getUTCHours(),D7.getUTCMinutes(),D7.getUTCSeconds()].map(n=>String(n).padStart(2,"0")).join(":")}</div>
    ${caLine}${st}${warn}${rs}${askMuon}${ccOutHtml(loai)}
    ${CC_TH&&!CC_TH.coMay?`<p class="cc-may">Lần chấm này sẽ <b>đăng ký thiết bị này làm máy chấm công</b> của bạn. Từ nay chỉ máy này chấm được, mỗi lần xác nhận bằng vân tay / Face ID (hoặc mã mở khóa máy). Đổi máy thì nhờ HCNS bấm Cho đổi máy.</p>`:CC_TH&&CC_TH.coMay?`<p class="hint">Máy chấm công: ${esc(CC_TH.tenMay||"đã đăng ký")} · xác nhận vân tay / Face ID khi chấm</p>`:""}
    ${!ccPhone()?`<p class="cc-may"><b>Chỉ chấm công bằng điện thoại.</b> Máy tính không chấm công được nữa: mở web trên điện thoại của bạn (Chrome hoặc Safari) để chấm.</p>`:""}
    <button class="btn pri big cc-btn${loai==="ra"?" ra":""}" id="cc-go"${!ccPhone()?" hidden":""}${CC.busy?" disabled":""}>${CC.busy?"Đang lấy vị trí…":(loai==="vao"?"Chấm vào":(ra?"Chấm ra lại":"Chấm ra"))+(CC.out&&CC.out.loai===loai?" · gửi xác nhận":"")}</button>
    ${CC.err?`<p class="cc-err">${esc(CC.err)}</p>`:""}
    <p class="hint">${ccLichTxt(L7)}.</p>
    <p class="hint">Bấm nút, điện thoại sẽ hỏi cho phép xem vị trí: chọn Cho phép. Giờ chấm lấy theo đồng hồ máy chủ.${R.diem.length?" Chấm ở: "+R.diem.map(d=>esc(d.ten)).join(", ")+".":" CEO / HCNS chưa cài điểm chấm nên chưa kiểm được vị trí."}</p>
  </section>${tuan}
  <div class="filters">${ccMonthSel("cc-m")}</div>
  <div class="grid kpis">${kpi("Ngày có chấm công",T.cong+"/"+T.lamChuan)}${T.congHL!=null?kpi("Công hưởng lương",String(T.congHL).replace(".",","),T.klNgay?`đã trừ ${String(T.klNgay).replace(".",",")} ngày không lương`:""):""}${ccCo?kpi("Đi muộn + về sớm",T.muonLan+T.somLan,`tối đa ${Q.ccLan} lần để giữ chuyên cần`)+kpi("Chuyên cần tạm tính",T.chuyenCan?"Đạt":"Chưa đạt",T.nghi?`${T.nghi} ngày nghỉ`:(T.nghiPhep?`${T.nghiPhep} ngày phép không tính`:"")):kpi("Tổng giờ làm",ccGio(T.phut))}${kpi("Quên chấm ra",T.quenRa)}</div>
  <section class="card flush">${tbl(["Ngày","Vào – ra","Ghi chú"],days.filter(x=>x.lam||x.vao||x.ra||x.don||x.le).map(x=>`<tr${x.ngay===today?' class="cc-today"':""}><td>${ccDow(x.ngay)} ${ccDm(x.ngay)}${x.ca?`<div class="hint">${esc(x.ca)}</div>`:""}</td><td class="mono">${ccHm(x.vao)} – ${ccHm(x.ra)}${x.phut?`<div class="hint">${ccGio(x.phut)}</div>`:""}</td><td>${ccNote(x)||(!x.vao&&!x.ra&&x.ngay!==today?pill("Không chấm","gry"):"")}</td></tr>`))}</section>`;
  $("#cc-go").onclick=()=>ccCham(loai);ccOutBind();
  if($("#cc-lymuon-ok"))$("#cc-lymuon-ok").onclick=async()=>{const v=($("#cc-lymuon2").value||"").trim();if(!v){toast("Ghi lý do trước khi lưu");return}
    try{await svApi("/api/hub/chamcong/ly-do-muon",{method:"POST",body:JSON.stringify({lyDo:v})});toast("Đã lưu lý do đi muộn");await ccLoadMe(true)}catch(e){toast(e.message)}};
  $("#cc-m").onchange=e=>{CC.thang=e.target.value;CC.me=null;ccLoadMe(true)};
  ccClock();
}


/* ---------- Chấm ngoài văn phòng (CEO 06/11): đi quay, gặp khách → lý do + ảnh check-in + gắn buổi quay, Lead xác nhận ---------- */
/* Chấm ngoài chỉ làm trên điện thoại (CEO 06/11): máy tính chỉ xem. */
const ccPhone=()=>{const u=navigator.userAgent||"";return /Android|iPhone|iPad|iPod|Mobile/i.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)};
const CC_LY={quay:"Đi quay",khach:"Gặp khách",khac:"Việc khác"};
/* Buổi quay hôm nay có tên mình (Lịch quay ở Marketing). */
function ccShoots(){try{const d=D(),t=+String((CC.me||{}).today||"").slice(8);return (d.shoots||[]).filter(s=>s.day===t&&(s.nguoi||[]).includes(ME.id)&&s.trangThai!=="Đã hủy").sort((a,b)=>String(a.gio||"").localeCompare(String(b.gio||"")))}catch(e){return []}}
function ccOutHtml(loai){
  const O=CC.out;if(!O||O.loai!==loai)return "";
  const sh=ccShoots(),cur=sh.find(s=>s.id===O.shoot);
  return `<div class="cc-out"><p class="cc-outw">${esc(O.msg)}</p>
    <div class="cc-outl">Lý do</div><div class="cc-chips">${Object.entries(CC_LY).map(([k,t])=>`<button type="button" class="cc-chip${O.ly===k?" on":""}" data-ccly="${k}">${t}</button>`).join("")}</div>
    ${O.ly==="quay"?(sh.length?`<div class="cc-outl">Buổi quay hôm nay</div>${sh.map(s=>`<label class="cc-shoot${O.shoot===s.id?" on":""}"><input type="radio" name="cc-sq" value="${esc(s.id)}"${O.shoot===s.id?" checked":""}> <span><b>${esc(s.gio||"")}${s.buoi?" · "+esc(s.buoi):""} · ${esc(s.diaDiem||"chưa ghi địa điểm")}</b>${s.ghiChu?`<br><small>${esc(s.ghiChu)}</small>`:""}</span></label>`).join("")}`:`<p class="hint">Hôm nay chưa có buổi quay nào có tên bạn trong Lịch quay. Ghi rõ quay ở đâu vào ô dưới.</p>`):""}
    <textarea id="cc-outnote" rows="2" placeholder="${O.ly==="khach"?"Gặp khách nào, ở đâu":O.ly==="quay"?"Quay gì, ở đâu":"Ghi rõ việc gì"}">${esc(O.note||"")}</textarea>
    <div class="cc-outl">Ảnh check-in <span class="hint">(bắt buộc, chụp trực tiếp)</span></div>
    ${O.anh?`<img class="cc-outimg" src="${O.anh}" alt="Ảnh check-in">`:""}
    <label class="btn${O.anh?"":" pri"} cc-cam">${O.anh?"Chụp lại":"Mở camera chụp ảnh"}<input type="file" id="cc-cam" accept="image/*" capture="environment" hidden></label>
    ${cur?`<p class="hint">Gắn buổi quay ${esc(cur.gio||"")} · ${esc(cur.diaDiem||"")}. Đi muộn tính theo giờ quay.</p>`:""}
  </div>`;
}
/* Thu nhỏ ảnh và đóng dấu giờ (đồng hồ máy chủ), ngày, tên, nơi chấm. */
function ccStamp(file){return new Promise((ok,bad)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{try{
  const W=Math.min(900,im.width),H0=Math.round(im.height*W/im.width),c=document.createElement("canvas");c.width=W;c.height=H0;const g=c.getContext("2d");g.drawImage(im,0,0,W,H0);
  const d=ccVnNow(),p=n=>String(n).padStart(2,"0"),O=CC.out||{},sh=ccShoots().find(s=>s.id===O.shoot);
  const l1=`${p(d.getUTCHours())}:${p(d.getUTCMinutes())} · ${p(d.getUTCDate())}/${p(d.getUTCMonth()+1)}/${d.getUTCFullYear()}`;
  const l2=[(typeof ME!=="undefined"&&ME?ME.name:""),CC_LY[O.ly]||"",sh?sh.diaDiem||"":""].filter(Boolean).join(" · ");
  const fs=Math.max(16,Math.round(W/26)),bh=Math.round(fs*3.1);g.fillStyle="rgba(0,0,0,.55)";g.fillRect(0,H0-bh,W,bh);
  g.fillStyle="#fff";g.font=`700 ${Math.round(fs*1.15)}px sans-serif`;g.fillText(l1,fs*.7,H0-bh+fs*1.35);g.font=`500 ${fs}px sans-serif`;g.fillText(l2.slice(0,60),fs*.7,H0-fs*.6);
  URL.revokeObjectURL(u);ok(c.toDataURL("image/jpeg",.62))}catch(e){bad(e)}};im.onerror=()=>bad(new Error("Không đọc được ảnh, chụp lại giúp em"));im.src=u})}
function ccOutBind(){
  const O=CC.out;if(!O)return;const keep=()=>{const t=$("#cc-outnote");if(t)O.note=t.value};
  document.querySelectorAll("[data-ccly]").forEach(b=>b.onclick=()=>{keep();O.ly=b.dataset.ccly;if(O.ly==="quay"&&!O.shoot){const s=ccShoots()[0];if(s)O.shoot=s.id}renderMain()});
  document.querySelectorAll('input[name="cc-sq"]').forEach(r=>r.onchange=()=>{keep();O.shoot=r.value;renderMain()});
  const cam=$("#cc-cam");if(cam)cam.onchange=async()=>{const f=cam.files&&cam.files[0];if(!f)return;keep();try{O.anh=await ccStamp(f)}catch(e){toast(e.message)}renderMain()};
}

/* ---------- Xác nhận chấm ngoài văn phòng (Lead: phòng mình; Lead tự chấm ngoài thì CEO, HCNS) ---------- */
async function ccXnLoad(force){if(CC.xn&&!force&&!CC.xn.err)return;try{const r=await svApi("/api/hub/chamcong/xac-nhan");CC.xn=r;CC.xnCho=r.cho||0}catch(e){CC.xn={err:e.message,list:[]}}if(PAGE==="cc_xn"||(typeof PD!=="undefined"&&PD.view&&PD.view.page==="cc_xn"))renderMain()}
async function ccXnCount(){try{if(typeof ME==="undefined"||!ME||!(ccLead(ME)||ccHr(ME)))return;const r=await svApi("/api/hub/chamcong/xac-nhan");const ch=(r.cho||0)!==(CC.xnCho||0);CC.xn=r;CC.xnCho=r.cho||0;if(ch&&typeof render==="function")render()}catch(e){}}
if(typeof window!=="undefined"&&typeof SERVER!=="undefined"&&SERVER){setTimeout(ccXnCount,2500);setInterval(ccXnCount,180000)}
function pCcXn(m){
  const R=CC.xn;if(!R){m.innerHTML=H("Xác nhận chấm ngoài văn phòng")+`<section class="card"><p class="empty">Đang tải…</p></section>`;ccXnLoad();return}
  if(R.err){m.innerHTML=H("Xác nhận chấm ngoài văn phòng")+`<section class="card"><p class="empty">${esc(R.err)}</p></section>`;return}
  const tab=CC.xnTab||"cho",L=(R.list||[]).filter(x=>tab==="cho"?x.xn==="cho":x.xn!=="cho");
  const km=x=>x.kc==null?"":x.kc>=1000?(x.kc/1000).toFixed(1).replace(".",",")+" km":x.kc+" m";
  const row=x=>{let q=null;try{q=x.quay?JSON.parse(x.quay):null}catch(e){}
    const muon=q&&x.gio_quay&&x.loai==="vao"?Math.round((Date.parse(x.at)+7*36e5)%864e5/6e4)-(+x.gio_quay.slice(0,2)*60+ +x.gio_quay.slice(3,5)):null;
    const anh=x.anh_id?`<a href="/api/hub/chamcong/anh/${esc(x.anh_id)}" target="_blank" rel="noopener"><img class="cc-xnimg" src="/api/hub/chamcong/anh/${esc(x.anh_id)}" alt="Ảnh check-in" loading="lazy"></a>`:'<span class="hint">không ảnh</span>';
    const act=x.xn==="cho"?`<div class="acts"><button class="btn sm pri" data-xn="${esc(x.id)}" data-ok="1">Xác nhận</button><button class="btn sm danger" data-xn="${esc(x.id)}" data-ok="0">Không xác nhận</button></div>`
      :`${x.xn==="ok"?pill("Đã xác nhận","grn"):pill("Không xác nhận","red")}<div class="hint">${esc(x.xnTen||"")}</div>`;
    return `<tr><td>${anh}</td><td><b>${esc(x.ten)}</b><div class="hint">${esc(ccPbName(x.pb))}</div></td><td>${x.loai==="vao"?"Vào":"Ra"} <b>${ccHm(x.at)}</b><div class="hint">${ccDow(x.ngay)} ${ccDm(x.ngay)}</div></td><td>${esc(x.ly_do||"")}</td>
      <td>${q?`${q.gio?esc(q.gio)+" · ":""}${esc(q.diaDiem||"")}${muon!=null?`<div>${muon>5?pill("Muộn "+ccPhut(muon)+" so với giờ quay","amb"):pill("Khớp giờ quay","grn")}</div>`:""}`:'<span class="hint">không có</span>'}</td>
      <td>${x.kc!=null?"cách "+esc(x.diem||"VP")+" "+km(x)+"<br>":""}${x.lat!=null?`<a class="lnk" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${x.lat},${x.lng}">Xem bản đồ</a>`:""}</td><td>${act}</td></tr>`};
  const card=x=>{let q=null;try{q=x.quay?JSON.parse(x.quay):null}catch(e){}
    const muon=q&&x.gio_quay&&x.loai==="vao"?Math.round((Date.parse(x.at)+7*36e5)%864e5/6e4)-(+x.gio_quay.slice(0,2)*60+ +x.gio_quay.slice(3,5)):null;
    const anh=x.anh_id?`<a href="/api/hub/chamcong/anh/${esc(x.anh_id)}" target="_blank" rel="noopener"><img class="cc-xnimg" src="/api/hub/chamcong/anh/${esc(x.anh_id)}" alt="Ảnh check-in" loading="lazy"></a>`:"";
    const act=x.xn==="cho"?`<div class="acts"><button class="btn danger" data-xn="${esc(x.id)}" data-ok="0">Không xác nhận</button><button class="btn pri" data-xn="${esc(x.id)}" data-ok="1">Xác nhận</button></div>`
      :`<div>${x.xn==="ok"?pill("Đã xác nhận","grn"):pill("Không xác nhận","red")} <span class="hint">${esc(x.xnTen||"")}</span></div>`;
    return `<div class="cc-xnk"><div class="cc-xnh">${anh}<div><b>${esc(x.ten)}</b><div class="hint">${esc(ccPbName(x.pb))}</div><div>${x.loai==="vao"?"Vào":"Ra"} <b>${ccHm(x.at)}</b> · ${ccDow(x.ngay)} ${ccDm(x.ngay)}</div></div></div>
      ${x.ly_do?`<div class="cc-xnr"><span>Lý do:</span> ${esc(x.ly_do)}</div>`:""}
      ${q?`<div class="cc-xnr"><span>Buổi quay:</span> ${q.gio?esc(q.gio)+" · ":""}${esc(q.diaDiem||"")} ${muon!=null?(muon>5?pill("Muộn "+ccPhut(muon),"amb"):pill("Khớp giờ quay","grn")):""}</div>`:""}
      <div class="cc-xnr">${x.kc!=null?`<span>Cách ${esc(x.diem||"VP")}</span> ${km(x)} · `:""}${x.lat!=null?`<a class="lnk" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${x.lat},${x.lng}">Xem bản đồ</a>`:""}</div>
      ${act}</div>`};
  m.innerHTML=H("Xác nhận chấm ngoài văn phòng","Đi quay, gặp khách: xem ảnh check-in và vị trí rồi xác nhận. Chưa xác nhận thì ngày đó chưa tính công; không xác nhận thì coi như không chấm.")+`
  <div class="filters cc-xnf"><div class="cc-chips"><button class="cc-chip${tab==="cho"?" on":""}" data-xntab="cho">Chờ xác nhận (${(R.list||[]).filter(x=>x.xn==="cho").length})</button><button class="cc-chip${tab==="xong"?" on":""}" data-xntab="xong">Đã xử lý 7 ngày</button></div><span class="sp"></span><button class="btn" id="cc-xnrl">Tải lại</button></div>
  ${L.length?`<section class="card flush cc-xnt nomlist">${tbl(["Ảnh","Người","Lượt","Lý do","Lịch quay","Vị trí",""],L.map(row))}</section><div class="cc-xnc">${L.map(card).join("")}</div>`:`<section class="card"><p class="empty">${tab==="cho"?"Không có lượt nào chờ xác nhận.":"Chưa có lượt nào trong 7 ngày."}</p></section>`}`;
  m.querySelectorAll("[data-xntab]").forEach(b=>b.onclick=()=>{CC.xnTab=b.dataset.xntab;renderMain()});
  $("#cc-xnrl").onclick=()=>{CC.xn=null;renderMain()};
  m.querySelectorAll("[data-xn]").forEach(b=>b.onclick=async()=>{const okk=b.dataset.ok==="1";b.disabled=true;
    try{await svApi("/api/hub/chamcong/xac-nhan",{method:"POST",body:JSON.stringify({id:b.dataset.xn,ok:okk})});toast(okk?"Đã xác nhận, ngày đó được tính công":"Đã ghi không xác nhận");await ccXnLoad(true);if(typeof PD!=="undefined")PD.at=0}catch(e){toast(e.message);b.disabled=false}});
}

/* ---------- Hôm nay (trưởng nhóm: phòng mình; CEO, HCNS: cả công ty) ---------- */
function pCcNgay(m){
  const R=CC.day;if(!R||R.loading){m.innerHTML=H("Chấm công hôm nay")+`<section class="card"><p class="empty">Đang tải…</p></section>`;ccLoadDay();return}
  if(R.err){m.innerHTML=H("Chấm công hôm nay")+`<section class="card"><p class="empty">${esc(R.err)}</p></section>`;return}
  const L=R.list.filter(x=>!CC.pb||x.pb===CC.pb),lam=L.some(x=>x.lam);
  const co=L.filter(x=>x.vao),muon=L.filter(x=>x.muon),chua=L.filter(x=>!x.vao&&x.lam&&!x.choXn),ngoai=L.filter(x=>x.ngoai),cn=L.filter(x=>x.chamNgoai||x.choXn),cnCho=L.filter(x=>x.choXn);
  const pbs=[...new Set(R.list.map(x=>x.pb).filter(Boolean))];
  const rank=x=>x.canhBao?0:x.ngoai?1:x.muon?2:!x.vao&&x.lam?3:4;
  const rows=L.slice().sort((a,b)=>rank(a)-rank(b)||(a.vao||"z").localeCompare(b.vao||"z")).map(x=>{
    const ly=[...x.luot.filter(l=>l.ly_do).map(l=>`${l.loai==="vao"?"Vào":"Ra"}: ${esc(l.ly_do)}`),...(x.lyDoMuon?["Đi muộn: "+esc(x.lyDoMuon)]:[])].join("<br>");
    const kc=x.luot.filter(l=>l.trong===0).map(l=>`${l.loai==="vao"?"Vào":"Ra"} ${ccHm(l.at)} cách ${esc(l.diem||"")} ${l.kc>=1000?(l.kc/1000).toFixed(1).replace(".",",")+" km":l.kc+" m"}${l.xn==="cho"?" · chờ xác nhận":l.xn==="khong"?" · không xác nhận":""}`).join("<br>");
    const extra=[kc,ly].filter(Boolean).join("<br>");
    return `<tr><td><b>${esc(x.name)}</b><div class="hint">${esc(ccPbName(x.pb))} · ${esc(x.lich)}${x.ca?" · "+esc(x.ca):""}</div></td><td class="mono">${ccHm(x.vao)} – ${ccHm(x.ra)}</td><td>${ccNote(x)||(x.vao?pill(x.kieu!=="tudo"?"Đúng giờ":"Đã chấm","grn"):x.lam?pill("Chưa chấm","gry"):pill(x.kieu==="ca"?"Không có ca":"Ngày nghỉ","gry"))}${extra?`<div class="hint">${extra}</div>`:""}</td></tr>`});
  m.innerHTML=H("Chấm công hôm nay",R.vai.all?"Cả công ty":"Phòng "+esc(ccPbName(R.vai.pb)))+`
  <div class="filters"><input type="date" id="cc-d" value="${R.ngay}" max="${R.today}">${R.vai.all&&pbs.length>1?`<select id="cc-pb"><option value="">Tất cả phòng</option>${pbs.map(p=>`<option value="${esc(p)}"${p===CC.pb?" selected":""}>${esc(ccPbName(p))}</option>`).join("")}</select>`:""}<span class="sp"></span><button class="btn" id="cc-rl">Tải lại</button></div>
  ${!lam?`<section class="card"><p class="hint">Ngày ${ccDm(R.ngay)} là ngày nghỉ theo lịch làm của mọi người.</p></section>`:""}
  <div class="grid kpis">${kpi("Có mặt",co.length+"/"+L.filter(x=>x.lam||x.vao).length)}${kpi("Đi muộn",muon.length)}${kpi("Chưa chấm vào",chua.length)}${kpi("Chấm ngoài văn phòng",cn.length,cnCho.length?`${cnCho.length} chờ xác nhận`:"")}${ngoai.length?kpi("Ngoài phạm vi",ngoai.length):""}</div>${cnCho.length&&(ccLead(ME)||ccHr(ME))?`<p class="hint"><a class="lnk" href="#" id="cc-goxn">Xem ảnh và xác nhận ${cnCho.length} lượt chấm ngoài →</a></p>`:""}
  <section class="card flush">${tbl(["Người","Vào – ra","Tình trạng"],rows)}</section>`;
  $("#cc-d").onchange=e=>{CC.ngay=e.target.value;ccLoadDay(true)};
  if($("#cc-pb"))$("#cc-pb").onchange=e=>{CC.pb=e.target.value;renderMain()};
  $("#cc-rl").onclick=()=>ccLoadDay(true);
  if($("#cc-goxn"))$("#cc-goxn").onclick=e=>{e.preventDefault();CC.xn=null;ntPage("cc_xn")};
}

/* ---------- Bảng chấm công tháng ---------- */
function pCcThang(m){
  const R=CC.mon;if(!R||R.loading){m.innerHTML=H("Bảng chấm công tháng")+`<section class="card"><p class="empty">Đang tải…</p></section>`;ccLoadMon();return}
  if(R.err){m.innerHTML=H("Bảng chấm công tháng")+`<section class="card"><p class="empty">${esc(R.err)}</p></section>`;return}
  const Q=R.quyTac,L=R.list.filter(x=>!CC.pb||x.pb===CC.pb).sort((a,b)=>a.pb.localeCompare(b.pb)||a.name.localeCompare(b.name));
  const pbs=[...new Set(R.list.map(x=>x.pb).filter(Boolean))];
  const rows=L.map(x=>{const o=CC.open[x.id];
    const cd=x.kieu!=="tudo",dash=v=>v||"—";
    const det=o?`<tr class="cc-det"><td colspan="11">${tbl(["Ngày","Vào","Ra","Giờ làm","Ghi chú"],x.ngay.slice().reverse().filter(d=>d.lam||d.vao||d.ra).map(d=>`<tr><td>${ccDow(d.n)} ${ccDm(d.n)}${d.ca?`<div class="hint">${esc(d.ca)}</div>`:""}</td><td class="mono">${ccHm(d.vao)}</td><td class="mono">${ccHm(d.ra)}</td><td class="mono">${ccGio(d.phut)}</td><td>${ccNote(d)||(!d.vao&&!d.ra&&d.n!==R.today?pill("Không chấm","gry"):"")}${d.lyDoMuon?`<div class="hint">Lý do muộn: ${esc(d.lyDoMuon)}</div>`:""}${d.nguon?`<div class="hint">${d.nguon==="ca hai"?"Máy và điện thoại":d.nguon==="may"?"Chỉ có ở máy chấm công":"Chỉ có ở điện thoại"}</div>`:""}</td></tr>`))}</td></tr>`:"";
    return `<tr class="cc-row" data-id="${esc(x.id)}"><td><b>${esc(x.name)}</b> <span class="hint">${o?"▾":"▸"}</span><div class="hint">${esc(ccPbName(x.pb))} · ${esc(x.lich)}</div></td><td class="n">${x.cong}/${x.lamChuan}</td><td class="n"><b>${String(x.congHL??x.cong).replace(".",",")}</b>${x.klNgay?` <span class="hint">(trừ ${String(x.klNgay).replace(".",",")} không lương)</span>`:""}</td><td class="n">${cd?dash(x.muonLan):"·"}${x.muonNang?` <span class="hint">(${x.muonNang} lần quá ${Q.mocNang} phút)</span>`:""}${x.canhBao?" "+pill(x.canhBao+" lần chưa ghi lý do","red"):""}</td><td class="n">${cd?dash(x.somLan):"·"}</td><td class="n">${cd?dash(x.nghi):"·"}${x.nghiPhep?` <span class="hint">(+${x.nghiPhep} ngày phép)</span>`:""}${x.daBu?` <span class="hint">(đã bù ${x.daBu})</span>`:""}</td><td class="n">${dash(x.quenRa)}</td><td class="n">${dash(x.chamNgoai)}${x.choXn?" "+pill(x.choXn+" chờ","amb"):""}${x.ngoai?" "+pill(x.ngoai+" ngoài phạm vi","red"):""}</td><td class="n">${x.mayNgay||0} / ${x.dtNgay||0}${x.lech?" "+pill(x.lech+" ngày lệch","amb"):""}</td><td class="n mono">${ccGio(x.phut)}</td><td>${x.chuyenCan===null?`<span class="hint" title="Chuyên cần chỉ áp dụng khối văn phòng">Không áp dụng</span>`:x.chuyenCan?pill("Đạt","grn"):pill("Không đạt","red")}</td><td class="n">${x.cong}</td></tr>${det}`});
  m.innerHTML=H("Bảng chấm công tháng",(R.vai.all?"Cả công ty":"Phòng "+esc(ccPbName(R.vai.pb)))+" · lấy từ máy chấm công và chấm điện thoại")+`
  <div class="filters">${ccMonthSel("cc-m")}${R.vai.all&&pbs.length>1?`<select id="cc-pb"><option value="">Tất cả phòng</option>${pbs.map(p=>`<option value="${esc(p)}"${p===CC.pb?" selected":""}>${esc(ccPbName(p))}</option>`).join("")}</select>`:""}<span class="sp"></span>${typeof XLSX!=="undefined"?`<button class="btn" id="cc-xl">Xuất Excel</button>`:""}</div>
  <section class="card flush"><div class="tbl cc-mon"><table><thead><tr><th>Người</th><th class="n">Ngày có chấm / ngày làm</th><th class="n" title="Ngày đi làm (trừ phần nghỉ không lương nửa ngày / theo giờ) + ngày nghỉ phép, ốm + ngày đã bù đủ">Công hưởng lương</th><th class="n">Đi muộn (lần)</th><th class="n">Về sớm (lần)</th><th class="n">Ngày nghỉ</th><th class="n">Quên chấm ra</th><th class="n">Chấm ngoài</th><th class="n">Máy / điện thoại</th><th class="n">Tổng giờ</th><th>Chuyên cần</th><th class="n">Bữa trưa</th></tr></thead><tbody>${rows.join("")||`<tr><td colspan="12" class="empty">Chưa có dữ liệu.</td></tr>`}</tbody></table></div></section>
  <p class="hint">Bấm vào tên để xem từng ngày. Chuyên cần (${ccTien(Q.tienCC)}): đi muộn + về sớm không quá ${Q.ccLan} lần và không nghỉ quá ${Q.ccNghi} ngày, chỉ tính cho lịch được bật "Tính chuyên cần". Ngày nghỉ = ngày phải làm mà không chấm, không tính ngày lễ (điền ở Cài đặt) và ngày có đơn nghỉ phép năm, nghỉ ốm đã duyệt; nghỉ không lương vẫn tính. Đây là số tạm tính: chưa trừ lần về sớm có phép; HCNS xem lại rồi chốt công ở Nhân sự › Chấm công như trước. Bữa trưa (${ccTien(Q.tienTrua)}/bữa) = số ngày có chấm. Dấu · là lịch giờ linh hoạt, không tính. Các mốc này sửa ở Nhân sự › Cài đặt chấm công.</p>`;
  m.querySelectorAll(".cc-row").forEach(r=>r.onclick=()=>{CC.open[r.dataset.id]=!CC.open[r.dataset.id];renderMain()});
  $("#cc-m").onchange=e=>{CC.thang=e.target.value;CC.mon=null;CC.me=null;ccLoadMon(true)};
  if($("#cc-pb"))$("#cc-pb").onchange=e=>{CC.pb=e.target.value;renderMain()};
  if($("#cc-xl"))$("#cc-xl").onclick=()=>{
    const rowsX=[];L.forEach(x=>x.ngay.forEach(d=>{if(!d.lam&&!d.vao&&!d.ra)return;rowsX.push({"Người":x.name,"Phòng":ccPbName(x.pb),"Ngày":d.n,"Ca":d.ca||"","Vào":d.vao?ccHm(d.vao):"","Ra":d.ra?ccHm(d.ra):"","Lịch":x.lich,"Giờ làm (phút)":d.phut||"","Muộn (phút)":d.muon||"","Về sớm (phút)":d.som||"","Quên chấm ra":d.quenRa?"x":"","Ngoài phạm vi":d.ngoai?"x":"","Lý do đi muộn":d.lyDoMuon||(d.canhBao?"(chưa ghi)":""),"Nguồn":d.nguon==="ca hai"?"Máy + điện thoại":d.nguon==="may"?"Máy":d.nguon==="dt"?"Điện thoại":"","Nghỉ":d.le?"Lễ":(d.don||"")})}));
    const sum=L.map(x=>({"Người":x.name,"Phòng":ccPbName(x.pb),"Lịch":x.lich,"Ngày có chấm":x.cong,"Ngày làm":x.lamChuan,"Công hưởng lương":x.congHL??x.cong,"Phép hưởng lương (ngày)":x.phepHL||0,"Nghỉ không lương (ngày)":x.klNgay||0,"Đi muộn (lần)":x.muonLan,[`Muộn quá ${Q.mocNang} phút (lần)`]:x.muonNang,"Đi muộn (phút)":x.muonPhut,"Về sớm (lần)":x.somLan,"Ngày nghỉ (tính chuyên cần)":x.nghi,"Ngày nghỉ phép, ốm":x.nghiPhep,"Quên chấm ra":x.quenRa,"Ngoài phạm vi":x.ngoai,"Muộn chưa ghi lý do":x.canhBao,"Tổng giờ làm (phút)":x.phut,"Chuyên cần":x.chuyenCan===null?"":x.chuyenCan?"Đạt":"Không đạt","Bữa trưa":x.cong,"Ngày có ở máy":x.mayNgay||0,"Ngày có ở điện thoại":x.dtNgay||0,"Ngày lệch":x.lech||0}));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sum),"Tong hop");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rowsX),"Tung ngay");XLSX.writeFile(wb,`cham-cong-${R.thang}.xlsx`)};
}

/* ---------- Xếp ca theo tuần (HCNS: mọi người làm ca; trưởng nhóm: phòng mình) ---------- */
function pCcXepCa(m){
  const R=CC.xep;if(!R||R.loading){m.innerHTML=H("Xếp ca")+`<section class="card"><p class="empty">Đang tải…</p></section>`;ccLoadXep();return}
  if(R.err){m.innerHTML=H("Xếp ca")+`<section class="card"><p class="empty">${esc(R.err)}</p></section>`;return}
  const val=(u,d)=>{const k=u+"|"+d;return k in CC.xepEdit?CC.xepEdit[k]:((R.xep[u]||{})[d]||"")};
  const sel=(u,d)=>`<select data-u="${esc(u)}" data-d="${d}"><option value="">Nghỉ</option>${R.ca.map(c=>`<option value="${esc(c.id)}"${val(u,d)===c.id?" selected":""}>${esc(c.ten)} ${c.tu}–${c.den}</option>`).join("")}</select>`;
  const changed=Object.keys(CC.xepEdit).length;
  const body=!R.ca.length?`<section class="card"><p class="empty">Chưa có ca nào. HCNS thêm ca (tên ca, giờ bắt đầu, giờ kết thúc) ở Nhân sự › Cài đặt chấm công, mục Danh sách ca.</p></section>`
    :!R.people.length?`<section class="card"><p class="empty">Chưa có ai theo lịch làm ca. Ở Nhân sự › Cài đặt chấm công, gán người làm ca (ví dụ team live) vào lịch "Theo ca".</p></section>`
    :`<section class="card flush"><div class="tbl cc-grid"><table><thead><tr><th>Người</th>${R.days.map(d=>{const w=new Date(d+"T00:00:00Z").getUTCDay();return `<th class="${w===0||w===6?"we":""}">${ccDow(d)} ${ccDm(d)}${d===R.today?" ·":""}</th>`}).join("")}</tr></thead><tbody>
      ${R.people.map(p=>`<tr><td><b>${esc(p.name)}</b><div class="hint">${esc(ccPbName(p.pb))}</div></td>${R.days.map(d=>{const w=new Date(d+"T00:00:00Z").getUTCDay();return `<td class="${w===0||w===6?"we":""}">${sel(p.id,d)}</td>`}).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  m.innerHTML=H("Xếp ca",`Tuần ${ccDm(R.days[0])} – ${ccDm(R.days[6])}/${R.days[6].slice(0,4)} · ${R.vai.all?"cả công ty":"phòng "+esc(ccPbName(R.vai.pb))}`)+`
  <div class="filters"><b>Tuần ${ccDm(R.days[0])} – ${ccDm(R.days[6])}</b><button class="btn" id="cc-wp">‹ Tuần trước</button><button class="btn" id="cc-w0">Tuần này</button><button class="btn" id="cc-wn">Tuần sau ›</button>${R.ca.length&&R.people.length?`<button class="btn" id="cc-wcp">Chép ca tuần trước</button>`:""}<span class="sp"></span>${R.ca.length&&R.people.length?`<button class="btn pri" id="cc-wsave"${changed?"":" disabled"}>Lưu xếp ca${changed?" ("+changed+")":""}</button>`:""}</div>
  ${body}
  <p class="hint">Mỗi người mỗi ngày một ca; để "Nghỉ" là ngày đó không phải đi làm. Đi muộn, về sớm tính theo giờ ca. Ca qua nửa đêm chưa hỗ trợ.</p>`;
  m.querySelectorAll("select[data-u]").forEach(s=>s.onchange=()=>{CC.xepEdit[s.dataset.u+"|"+s.dataset.d]=s.value;const b=$("#cc-wsave");if(b){const n=Object.keys(CC.xepEdit).length;b.disabled=!n;b.textContent="Lưu xếp ca"+(n?" ("+n+")":"")}});
  const go=t=>{if(Object.keys(CC.xepEdit).length&&!window.__ccWarned){window.__ccWarned=1;toast("Có ô chưa lưu. Bấm Lưu xếp ca trước, hoặc bấm lại để bỏ thay đổi.");return}window.__ccWarned=0;CC.tuan=t;CC.xep=null;ccLoadXep(true)};
  $("#cc-wp").onclick=()=>go(ccAddDays(R.tu,-7));$("#cc-wn").onclick=()=>go(ccAddDays(R.tu,7));$("#cc-w0").onclick=()=>go("");
  if($("#cc-wcp"))$("#cc-wcp").onclick=async()=>{try{const P=await svApi("/api/hub/chamcong/xepca?tu="+ccAddDays(R.tu,-7));let n=0;R.people.forEach(p=>R.days.forEach((d,i)=>{const v=(P.xep[p.id]||{})[P.days[i]]||"";if(v!==val(p.id,d)){CC.xepEdit[p.id+"|"+d]=v;n++}}));toast(n?`Đã chép ${n} ô từ tuần trước, bấm Lưu xếp ca để lưu`:"Tuần trước giống tuần này");renderMain()}catch(e){toast(e.message)}};
  if($("#cc-wsave"))$("#cc-wsave").onclick=async()=>{const items=Object.entries(CC.xepEdit).map(([k,v])=>{const i=k.lastIndexOf("|");return {user_id:k.slice(0,i),ngay:k.slice(i+1),ca_id:v}});
    try{await svApi("/api/hub/chamcong/xepca",{method:"PUT",body:JSON.stringify({items})});toast("Đã lưu xếp ca");CC.me=null;CC.day=null;CC.mon=null;await ccLoadXep(true)}catch(e){toast(e.message)}};
}

/* ---------- Cài đặt (Nhân sự): điểm chấm, lịch làm, ca, quy tắc tính công, gán lịch ---------- */
const ccPbName2=(deps,k)=>{const d=deps.find(x=>x.k===k);return d?d.n:k};
/* HCNS, CEO: máy chấm công đã đăng ký, cảnh báo máy lạ / một máy chấm hai người (14 ngày), nút Cho đổi máy (CEO 10/11). */
let CC_MAY=null;
function ccMayLoad(){CC_MAY={loading:true};svApi("/api/hub/chamcong/may/ds").then(r=>{CC_MAY=r;ccRedraw()}).catch(e=>{CC_MAY={err:e.message};ccRedraw()})}
function ccMayHtml(){
  if(!CC_MAY){setTimeout(ccMayLoad,0);return `<p class="empty">Đang tải…</p>`}
  if(CC_MAY.loading)return `<p class="empty">Đang tải…</p>`;if(CC_MAY.err)return `<p class="empty">${esc(CC_MAY.err)}</p>`;
  const cb=CC_MAY.canhBao||[],by={};cb.forEach(x=>{(by[x.user_id]=by[x.user_id]||[]).push(x)});
  const ppl=new Map();(CC_MAY.may||[]).forEach(x=>ppl.set(x.user_id,{id:x.user_id,ten:x.ten_nv,may:x}));cb.forEach(x=>{if(!ppl.has(x.user_id))ppl.set(x.user_id,{id:x.user_id,ten:x.ten_nv,may:null})});
  const L=[...ppl.values()].sort((a,b)=>(by[b.id]?1:0)-(by[a.id]?1:0)||String(a.ten).localeCompare(String(b.ten)));
  const dm=d=>d?d.slice(8,10)+"/"+d.slice(5,7):"";
  const cbTxt=x=>x.kieu==="chung"?pill(`${dm(x.ngay)}: máy này cũng chấm cho ${x.ten_khac||"người khác"}`,"red"):pill(`${dm(x.ngay)}: thử chấm từ máy lạ${x.ten_may?" ("+x.ten_may+")":""}`,"amb");
  return `<p class="hint">Lần chấm đầu tiên của mỗi người tự đăng ký máy đang dùng. Máy khác không chấm được. Đổi máy, mất máy: bấm Cho đổi máy, lần chấm tới trên máy mới sẽ đăng ký lại.</p>`+
    (L.length?tbl(["Nhân viên","Máy đã đăng ký","Đăng ký / lần chấm gần nhất","Cảnh báo 14 ngày",""],L.map(p=>`<tr><td><b>${esc(p.ten)}</b></td><td>${p.may?esc(p.may.ten||"Đã đăng ký"):'<span class="hint">Chưa đăng ký</span>'}</td><td>${p.may?dm(vndateIso(p.may.created_at))+(p.may.last_at?" · "+dm(vndateIso(p.may.last_at)):""):"—"}</td><td>${(by[p.id]||[]).slice(0,3).map(cbTxt).join(" ")||'<span class="hint">—</span>'}</td><td>${p.may?`<button class="btn sm" data-doimay="${esc(p.id)}">Cho đổi máy</button>`:""}</td></tr>`)):`<p class="empty">Chưa ai đăng ký máy. Mỗi người chấm lần đầu là tự đăng ký.</p>`);
}
function pCcCaiDat(m){
  if(!CC.cfg){m.innerHTML=H("Cài đặt chấm công")+`<section class="card"><p class="empty">Đang tải…</p></section>`;
    svApi("/api/hub/chamcong/caidat").then(s=>{CC.cfg=JSON.parse(JSON.stringify(s));ccRedraw()}).catch(e=>{m.innerHTML=H("Cài đặt chấm công")+`<section class="card"><p class="empty">${esc(e.message)}</p></section>`});return}
  const s=CC.cfg,Q=s.quyTac,deps=s.deps||[],people=(s.people||[]).slice().sort((a,b)=>a.pb.localeCompare(b.pb)||a.name.localeCompare(b.name));
  const lichSel=(id,val,blank)=>`<select id="${id}">${blank?`<option value="">${blank}</option>`:""}${s.lich.map(l=>`<option value="${esc(l.id)}"${l.id===val?" selected":""}>${esc(l.ten)}</option>`).join("")}</select>`;
  const rowD=(d,i)=>`<tr><td><input id="cc-dt-${i}" value="${esc(d.ten)}"></td><td><input id="cc-dl-${i}" value="${d.lat===""?"":d.lat+", "+d.lng}" placeholder="21.02851, 105.85416"></td><td><input id="cc-db-${i}" class="num s" type="number" min="30" max="2000" value="${d.bk}"> m</td><td><input id="cc-di-${i}" value="${esc((d.ip||[]).join(", "))}" placeholder="chưa có" style="min-width:150px"> <button class="btn sm" data-ipadd="${i}">Lấy mạng đang dùng</button></td><td>${d.lat!==""?`<a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${d.lat},${d.lng}">Xem bản đồ</a> `:""}<button class="btn sm danger" data-del="${i}">Xóa</button></td></tr>`;
  const t7=(i,v)=>`<select id="cc-l7-${i}">${Object.entries(CC_T7).map(([k,t])=>`<option value="${k}"${k===v?" selected":""}>${t[0].toUpperCase()+t.slice(1)}</option>`).join("")}</select>`;
  const lf=(lb,html,w)=>`<div class="f${w?" w2":""}">${lb}${html}</div>`;
  const rowL=(l,i)=>`<div class="cc-lich"><h3>${esc(l.ten)||"Lịch mới"}</h3><div class="cc-lg">
      ${lf("Tên lịch",`<input id="cc-ln-${i}" value="${esc(l.ten)}">`)}
      ${lf("Kiểu",`<select id="cc-lk-${i}">${Object.entries(CC_KIEU).map(([k,t])=>`<option value="${k}"${k===l.kieu?" selected":""}>${t}</option>`).join("")}</select>`)}
      ${lf("Giờ vào – ra",`<div class="pair"><input type="time" id="cc-lv-${i}" value="${l.gioVao}"> – <input type="time" id="cc-lr-${i}" value="${l.gioRa}"></div>`)}
      ${lf("Nghỉ trưa",`<div class="pair"><input type="time" id="cc-lt1-${i}" value="${l.truaTu}"> – <input type="time" id="cc-lt2-${i}" value="${l.truaDen}"></div>`)}
      ${lf("Được trễ (phút)",`<input type="number" id="cc-la-${i}" min="0" max="120" value="${l.anHan}">`)}
      ${lf("Thứ Bảy",t7(i,l.thuBay))}
      ${lf("Giờ ra thứ Bảy (làm buổi sáng)",`<input type="time" id="cc-l8-${i}" value="${l.gioRaT7}">`)}
      ${lf("Ngoài phạm vi",`<select id="cc-lo-${i}"><option value="0"${l.ngoaiOk?"":" selected"}>Không cho chấm</option><option value="1"${l.ngoaiOk?" selected":""}>Cho chấm, phải ghi lý do</option></select>`)}
      ${lf("Chấm ở điểm",`<div class="ck">${s.diem.length?s.diem.map(d=>`<label class="cc-chk"><input type="checkbox" data-ld="${i}" value="${esc(d.id)}"${(l.diem||[]).includes(d.id)?" checked":""}> ${esc(d.ten)}</label>`).join(""):'<span class="hint">chưa có điểm</span>'}</div>`)}
      ${lf("Tính chuyên cần",`<div class="ck"><label class="cc-chk"><input type="checkbox" id="cc-lc-${i}"${l.chuyenCan?" checked":""}> Có</label></div>`)}
    </div>${l.kieu==="codinh"?ccCuRow(l,i):""}</div>`;
  /* Quy định đổi theo thời gian (CEO 04/11): giờ ở trên áp dụng từ ngày này; trước ngày đó tính theo giờ cũ ở đây. */
  const ccCuRow=(l,i)=>{const c=l.cu||{gioVao:l.gioVao,gioRa:l.gioRa,anHan:l.anHan,thuBay:l.thuBay,gioRaT7:l.gioRaT7};
    return `<div class="cc-lcu"><p class="hint">Giờ ở trên áp dụng từ ngày bên dưới; trước ngày đó tính theo giờ cũ. Để trống ngày nếu không có quy định cũ.</p><div class="cc-lg">
      ${lf("Áp dụng giờ trên từ ngày",`<input type="date" id="cc-ltn-${i}" value="${l.tuNgay||""}">`)}
      ${lf("Giờ cũ: vào – ra",`<div class="pair"><input type="time" id="cc-cv-${i}" value="${c.gioVao}"> – <input type="time" id="cc-cr-${i}" value="${c.gioRa}"></div>`)}
      ${lf("Giờ cũ: được trễ (phút)",`<input type="number" id="cc-ca-${i}" min="0" max="120" value="${c.anHan}">`)}
      ${lf("Giờ cũ: thứ Bảy",`<select id="cc-c7-${i}">${Object.entries(CC_T7).map(([k,t])=>`<option value="${k}"${k===c.thuBay?" selected":""}>${t[0].toUpperCase()+t.slice(1)}</option>`).join("")}</select>`)}
      ${lf("Giờ cũ: ra thứ Bảy",`<input type="time" id="cc-c8-${i}" value="${c.gioRaT7}">`)}
    </div></div>`};
  const rowCa=(c,i)=>`<tr><td><input id="cc-cn-${i}" value="${esc(c.ten)}" placeholder="Ví dụ: Ca tối"></td><td><input type="time" id="cc-ct-${i}" value="${c.tu}"> – <input type="time" id="cc-cd-${i}" value="${c.den}"></td><td><button class="btn sm danger" data-cadel="${i}">Xóa</button></td></tr>`;
  const rowLe=(x,i)=>`<tr><td><input type="date" id="cc-len-${i}" value="${x.ngay}"></td><td><input id="cc-let-${i}" value="${esc(x.ten)}" placeholder="Ví dụ: Quốc khánh"></td><td><button class="btn sm danger" data-ledel="${i}">Xóa</button></td></tr>`;
  const qIn=(k,lb,max,step)=>`<label>${lb}<input type="number" id="cc-q-${k}" min="0" max="${max}" step="${step||1}" value="${Q[k]}"></label>`;
  const ov=Object.entries(s.nguoiLich);
  setTimeout(()=>m.querySelectorAll("[data-doimay]").forEach(b=>b.onclick=async()=>{if(!confirm("Cho người này đổi máy chấm công? Máy cũ sẽ không chấm được nữa, lần chấm tới trên máy mới sẽ đăng ký lại."))return;
    try{await svApi("/api/hub/chamcong/may/doi/"+encodeURIComponent(b.dataset.doimay),{method:"POST",body:"{}"});toast("Đã cho đổi máy");ccMayLoad()}catch(e){toast(e.message)}}),0);
  m.innerHTML=H("Cài đặt chấm công","Điểm chấm, lịch làm, ca, quy tắc tính công, ai theo lịch nào. Sửa xong bấm Lưu cài đặt ở cuối trang.")+`
  <section class="card"><div class="card-h"><h2>Điểm chấm công</h2><span class="hint">văn phòng, xưởng, kho</span></div>
    <p class="hint">Cách dễ nhất: đứng tại văn phòng hoặc xưởng, bấm "Thêm điểm tại chỗ tôi đang đứng". Hoặc mở Google Maps, bấm giữ vào vị trí, chép hai số tọa độ dán vào ô. Bán kính nên để 100–200 m vì định vị trong nhà hay lệch.</p>
    <p class="hint"><b>Mạng wifi:</b> máy tính không có GPS nên vị trí hay lệch cả cây số. Đứng ở văn phòng, nối wifi văn phòng, bấm "Lấy mạng đang dùng" rồi Lưu: ai chấm từ wifi này đều được tính là ở văn phòng. Nên bấm ở cả máy tính và điện thoại.</p>
    ${tbl(["Tên điểm","Tọa độ","Bán kính","Mạng wifi",""],s.diem.map(rowD))}
    <div class="filters"><button class="btn" id="cc-here">Thêm điểm tại chỗ tôi đang đứng</button><button class="btn" id="cc-add">Thêm điểm (nhập tọa độ)</button></div>${CC.hereErr?`<p class="cc-err" style="max-width:none">${esc(CC.hereErr)}</p>`:""}
  </section>
  <section class="card"><div class="card-h"><h2>Lịch làm</h2></div>
    ${s.lich.map(rowL).join("")}
    <p class="hint">Giờ cố định: tính đi muộn, về sớm theo giờ vào – ra. Theo ca: giờ lấy theo ca được xếp ở trang Xếp ca. Giờ linh hoạt: chỉ ghi giờ vào ra. Nghỉ trưa không cần chấm và không tính vào giờ làm; để trống là không nghỉ trưa. Chấm ở điểm: không tích điểm nào thì chấm ở điểm nào cũng được.</p>
  </section>
  <section class="card" id="cc-mayds"><div class="card-h"><h2>Máy chấm công</h2><span class="hint">mỗi người một máy, xác nhận vân tay / Face ID</span></div>${ccMayHtml()}</section>
  <section class="card"><div class="card-h"><h2>Danh sách ca</h2><span class="hint">cho người theo lịch "Theo ca"</span></div>
    ${tbl(["Tên ca","Giờ bắt đầu – kết thúc",""],s.ca.map(rowCa))}
    <div class="filters"><button class="btn" id="cc-caadd">Thêm ca</button></div>
  </section>
  <section class="card"><div class="card-h"><h2>Quy tắc tính công</h2></div>
    <div class="cc-form">${qIn("mocLyDo","Muộn quá bao nhiêu phút thì hỏi lý do",240)}${qIn("mocNang","Mốc muộn nặng, đếm riêng (phút)",240)}${qIn("ccLan","Chuyên cần: tối đa số lần muộn + về sớm / tháng",31)}${qIn("ccNghi","Chuyên cần: tối đa số ngày nghỉ / tháng",31)}${qIn("tienCC","Tiền chuyên cần (đồng / tháng)",100000000,1000)}${qIn("tienTrua","Hỗ trợ ăn trưa (đồng / bữa)",10000000,1000)}${qIn("mocVong2","Nghỉ từ bao nhiêu ngày thì HCNS duyệt vòng 2",60)}${qIn("tuMax","Tạm ứng mỗi lần phải dưới (đồng)",1000000000,100000)}${qIn("hanBu","Làm bù trong vòng bao nhiêu ngày",120)}</div>
    <p class="hint">Mặc định theo thông báo 01102026: được trễ 5 phút (ô Được trễ của lịch), muộn quá 10 phút hỏi lý do và đếm riêng, chuyên cần 200.000đ khi muộn + về sớm không quá 2 lần và nghỉ không quá 2 ngày, ăn trưa 25.000đ/bữa. Chưa tự trừ vào lương.</p>
  </section>
  <section class="card"><div class="card-h"><h2>Ngày lễ, tết công ty cho nghỉ</h2></div>
    ${tbl(["Ngày","Tên",""],(s.ngayLe||[]).map(rowLe))}
    <div class="filters"><button class="btn" id="cc-leadd">Thêm ngày lễ</button><button class="btn" id="cc-lefix">Thêm ngày lễ cố định (1/1, 30/4, 1/5, 2/9)</button></div>
    <p class="hint">Ngày 25 hằng tháng web nhắc HCNS điền ngày lễ tháng sau. Ngày lễ không tính là ngày phải đi làm nên không bị tính nghỉ khi xét chuyên cần (thông báo 01102026). Người làm ca được xếp ca ngày lễ thì vẫn tính đi làm.</p>
  </section>
  <section class="card"><div class="card-h"><h2>Phòng ban theo lịch nào</h2></div>
    <div class="cc-form">${deps.map((d,i)=>`<label>${esc(d.n)}${lichSel("cc-pb-"+i,s.pbLich[d.k]||"","Mặc định ("+esc((s.lich.find(l=>l.id===s.macDinh)||{}).ten||"")+")")}</label>`).join("")}<label>Mặc định cho phòng chưa chọn${lichSel("cc-md",s.macDinh)}</label></div>
  </section>
  <section class="card"><div class="card-h"><h2>Người theo lịch riêng</h2><span class="hint">ví dụ người team live nằm trong phòng Content</span></div>
    ${tbl(["Người","Lịch",""],ov.map(([id,l],i)=>`<tr><td>${esc((people.find(p=>p.id===id)||{name:id}).name)}</td><td>${lichSel("cc-ov-"+i,l)}</td><td><button class="btn sm danger" data-ovdel="${esc(id)}">Bỏ</button></td></tr>`))}
    <div class="filters"><select id="cc-ovp"><option value="">Chọn người…</option>${people.filter(p=>!s.nguoiLich[p.id]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.pb?" · "+esc(ccPbName2(deps,p.pb)):""}</option>`).join("")}</select>${lichSel("cc-ovl",(s.lich.find(l=>l.kieu==="ca")||s.lich[0]).id)}<button class="btn" id="cc-ova">Thêm</button></div>
  </section>
  <div class="cc-savebar"><span class="hint">Sửa xong bấm Lưu. Thêm điểm tại chỗ đứng thì web tự lưu.</span><button class="btn pri" id="cc-save">Lưu cài đặt</button></div>`;
  const v=id=>($("#"+id)||{}).value;
  const pull=()=>{
    s.diem=s.diem.map((d,i)=>{const ll=(v("cc-dl-"+i)||"").split(/[,\s]+/).filter(Boolean).map(Number);return {...d,ip:(v("cc-di-"+i)||"").split(/[,\s]+/).filter(Boolean),ten:v("cc-dt-"+i)||d.ten,lat:ll.length===2?ll[0]:"",lng:ll.length===2?ll[1]:"",bk:Number(v("cc-db-"+i))||d.bk}});
    s.lich=s.lich.map((l,i)=>({...l,ten:v("cc-ln-"+i)||l.ten,kieu:v("cc-lk-"+i)||l.kieu,gioVao:v("cc-lv-"+i)||l.gioVao,gioRa:v("cc-lr-"+i)||l.gioRa,truaTu:v("cc-lt1-"+i)??l.truaTu,truaDen:v("cc-lt2-"+i)??l.truaDen,anHan:Number(v("cc-la-"+i))||0,thuBay:v("cc-l7-"+i)||l.thuBay,gioRaT7:v("cc-l8-"+i)||l.gioRaT7,ngoaiOk:v("cc-lo-"+i)==="1",chuyenCan:!!($("#cc-lc-"+i)||{}).checked,diem:[...m.querySelectorAll(`[data-ld="${i}"]:checked`)].map(x=>x.value)}));
    s.lich=s.lich.map((l,i)=>{const tn=$("#cc-ltn-"+i);if(!tn)return l;const t=tn.value||"";const b=l.cu||l;
      return {...l,tuNgay:t,cu:t?{gioVao:v("cc-cv-"+i)||b.gioVao,gioRa:v("cc-cr-"+i)||b.gioRa,truaTu:b.truaTu??l.truaTu,truaDen:b.truaDen??l.truaDen,anHan:Number(v("cc-ca-"+i))||0,thuBay:v("cc-c7-"+i)||b.thuBay,gioRaT7:v("cc-c8-"+i)||b.gioRaT7}:null}});
    s.ca=s.ca.map((c,i)=>({...c,ten:v("cc-cn-"+i)||c.ten,tu:v("cc-ct-"+i)??c.tu,den:v("cc-cd-"+i)??c.den}));
    s.ngayLe=(s.ngayLe||[]).map((x,i)=>({ngay:v("cc-len-"+i)||x.ngay,ten:v("cc-let-"+i)??x.ten}));
    s.quyTac=Object.fromEntries(Object.keys(Q).map(k=>[k,Number(v("cc-q-"+k))||0]));
    const pl={};deps.forEach((d,i)=>{const x=v("cc-pb-"+i);if(x)pl[d.k]=x});s.pbLich=pl;s.macDinh=v("cc-md")||s.macDinh;
    ov.forEach(([id],i)=>{const x=v("cc-ov-"+i);if(x)s.nguoiLich[id]=x});
  };
  m.querySelectorAll("[data-ipadd]").forEach(b=>b.onclick=async()=>{pull();try{const r=await svApi("/api/hub/chamcong/ip");const d=s.diem[Number(b.dataset.ipadd)];if(!r.key){toast("Chưa đọc được mạng đang dùng");return}if(!(d.ip||[]).includes(r.key))d.ip=[...(d.ip||[]),r.key];renderMain();const sv=$("#cc-save");if(sv)sv.click()}catch(e){toast(e.message)}});
  m.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{pull();s.diem.splice(Number(b.dataset.del),1);renderMain()});
  m.querySelectorAll("[data-ledel]").forEach(b=>b.onclick=()=>{pull();s.ngayLe.splice(Number(b.dataset.ledel),1);renderMain()});
  $("#cc-leadd").onclick=()=>{pull();(s.ngayLe=s.ngayLe||[]).push({ngay:"",ten:""});renderMain()};
  $("#cc-lefix").onclick=()=>{pull();const y=new Date().getFullYear(),now=new Date(Date.now()+7*3600e3).toISOString().slice(0,10),F=[["01-01","Tết Dương lịch"],["04-30","Giải phóng miền Nam"],["05-01","Quốc tế Lao động"],["09-02","Quốc khánh"]];let n=0;
    s.ngayLe=s.ngayLe||[];[y,y+1].forEach(yy=>F.forEach(([md,t])=>{const d=yy+"-"+md;if(d>=now&&!s.ngayLe.some(x=>x.ngay===d)){s.ngayLe.push({ngay:d,ten:t});n++}}));s.ngayLe.sort((a,b)=>a.ngay.localeCompare(b.ngay));
    toast(n?`Đã thêm ${n} ngày, bấm Lưu cài đặt. Tết Nguyên đán, Giỗ Tổ, nghỉ bù điền theo thông báo nhà nước.`:"Các ngày lễ cố định đã có đủ");renderMain()};
  m.querySelectorAll("[data-cadel]").forEach(b=>b.onclick=()=>{pull();s.ca.splice(Number(b.dataset.cadel),1);renderMain()});
  m.querySelectorAll("[data-ovdel]").forEach(b=>b.onclick=()=>{pull();delete s.nguoiLich[b.dataset.ovdel];renderMain()});
  $("#cc-ova").onclick=()=>{const p=v("cc-ovp");if(!p){toast("Chọn người trước");return}pull();s.nguoiLich[p]=v("cc-ovl");renderMain()};
  $("#cc-caadd").onclick=()=>{pull();s.ca.push({id:"ca"+Date.now(),ten:"",tu:"",den:""});renderMain()};
  $("#cc-add").onclick=()=>{pull();s.diem.push({id:"d"+Date.now(),ten:"Điểm "+(s.diem.length+1),lat:"",lng:"",bk:150});renderMain()};
  $("#cc-here").onclick=async()=>{pull();try{const c=await ccPos();s.diem.push({id:"d"+Date.now(),ten:s.diem.length?"Điểm "+(s.diem.length+1):"Văn phòng",lat:+c.latitude.toFixed(6),lng:+c.longitude.toFixed(6),bk:Math.max(100,Math.min(300,Math.round((c.accuracy||0)*2)))});CC.hereErr="";renderMain();const b=$("#cc-save");if(b)b.click()}catch(e){CC.hereErr=e.message;renderMain()}}; // lấy được vị trí là lưu luôn, khỏi quên bấm Lưu
  $("#cc-save").onclick=async()=>{pull();
    const bad=s.diem.filter(d=>d.lat===""||!isFinite(d.lat)||!isFinite(d.lng));if(bad.length){toast("Có điểm chưa đúng tọa độ: "+bad.map(d=>d.ten).join(", "));return}
    const badLe=(s.ngayLe||[]).filter(x=>!x.ngay);if(badLe.length){toast("Có ngày lễ chưa chọn ngày");return}
    const badCa=s.ca.filter(c=>!c.ten||!c.tu||!c.den||c.den<=c.tu);if(badCa.length){toast("Ca chưa đủ tên hoặc giờ kết thúc phải sau giờ bắt đầu: "+badCa.map(c=>c.ten||"(chưa đặt tên)").join(", "));return}
    try{const r=await svApi("/api/hub/chamcong/caidat",{method:"PUT",body:JSON.stringify(s)});CC.cfg={...r,people:s.people,deps:s.deps};CC.me=null;CC.day=null;CC.mon=null;CC.xep=null;toast("Đã lưu cài đặt chấm công. Đổi tên điểm thì sửa ô tên rồi bấm Lưu cài đặt.");renderMain()}catch(e){toast(e.message)}};
}

/* ---------- Nạp file máy chấm công (CEO, HCNS): đọc file "Chi tiết chấm công" xuất từ máy, ghép mã, lưu ---------- */
const CCM={may:"vp",info:null,file:null,map:{},busy:false};
const CCM_MAY={vp:"Máy văn phòng",xg:"Máy xưởng"};
const ccmFold=s=>(typeof foldName==="function"?foldName(s):String(s||"").toLowerCase()).replace(/\s+/g," ").trim();
/* Giờ trong ô Excel: chuỗi "08:23", số (phần của ngày) hoặc kiểu ngày giờ → "HH:MM". */
const ccmHm=v=>{if(v==null||v==="")return "";if(v instanceof Date)return String(v.getHours()).padStart(2,"0")+":"+String(v.getMinutes()).padStart(2,"0");
  if(typeof v==="number"){const m=Math.round((v%1)*1440);return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
  const x=String(v).trim().match(/^(\d{1,2}):(\d{2})/);return x?x[1].padStart(2,"0")+":"+x[2]:""};
const ccmDay=v=>{if(v instanceof Date){const d=new Date(v.getTime()-v.getTimezoneOffset()*60000);return d.toISOString().slice(0,10)}
  if(typeof v==="number"){const d=new Date(Math.round((v-25569)*864e5));return d.toISOString().slice(0,10)}
  const x=String(v||"").trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);return x?`${x[3]}-${x[2].padStart(2,"0")}-${x[1].padStart(2,"0")}`:(/^\d{4}-\d{2}-\d{2}/.test(String(v))?String(v).slice(0,10):"")};
function ccmParse(buf){
  const wb=XLSX.read(buf,{type:"array"}),ws=wb.Sheets[wb.SheetNames[0]],A=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:""});
  const hi=A.findIndex(r=>r.some(c=>/^m[aã]\s*n\.?\s*vi[eê]n/i.test(ccmFold(c))));if(hi<0)throw new Error("Không thấy dòng tiêu đề \"Mã N.Viên\". File cần là bảng Chi tiết chấm công xuất từ máy.");
  const H=A[hi].map(c=>ccmFold(c)),col=n=>H.findIndex(h=>h===ccmFold(n));
  const cMa=col("Mã N.Viên"),cTen=col("Tên nhân viên"),cNgay=col("Ngày"),cKh=col("Kí hiệu"),cG=["Vào 1","Ra 1","Vào 2","Ra 2","Vào 3","Ra 3"].map(col).filter(i=>i>=0);
  if(cMa<0||cNgay<0||!cG.length)throw new Error("File thiếu cột Mã N.Viên, Ngày hoặc Vào / Ra.");
  const rows=[];A.slice(hi+1).forEach(r=>{const ma=String(r[cMa]??"").trim(),ngay=ccmDay(r[cNgay]);if(!ma||!ngay)return;
    const gio=cG.map(i=>ccmHm(r[i])).filter(Boolean);rows.push({ma,ten:String(r[cTen]??"").trim(),ngay,gio,kh:cKh>=0?String(r[cKh]??""):""})});
  if(!rows.length)throw new Error("Không đọc được dòng chấm công nào.");
  const ds=rows.map(r=>r.ngay).sort();return {rows,tu:ds[0],den:ds[ds.length-1],ma:[...new Map(rows.map(r=>[r.ma,r.ten])).entries()]};
}
async function ccmLoad(){CCM.info={loading:true};try{CCM.info=await svApi("/api/hub/chamcong/may/map?may="+CCM.may)}catch(e){CCM.info={err:e.message}}ccRedraw()}
function ccmSuggest(ten,people){const f=ccmFold(ten).replace(/\d+/g,"").trim();if(!f)return "";
  const ex=people.filter(p=>ccmFold(p.name)===f);if(ex.length===1)return ex[0].id;
  const w=f.split(" ").filter(x=>x.length>1);if(w.length<2)return "";
  const hit=people.filter(p=>{const pf=ccmFold(p.name);return w.every(x=>pf.includes(x))});return hit.length===1?hit[0].id:""}
function pCcMay(m){
  const I=CCM.info;if(!I||I.loading){m.innerHTML=H("Nạp file máy chấm công")+`<section class="card"><p class="empty">Đang tải…</p></section>`;if(!I)ccmLoad();return}
  if(I.err){m.innerHTML=H("Nạp file máy chấm công")+`<section class="card"><p class="empty">${esc(I.err)}</p></section>`;return}
  const F=CCM.file,old=Object.fromEntries((I.map||[]).map(x=>[x.ma,x.user_id])),ppl=(I.people||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));
  const pick=ma=>ma in CCM.map?CCM.map[ma]:(ma in old?old[ma]:"");
  CCM.sg=CCM.sg||{};
  const mapRows=F?F.ma.map(([ma,ten])=>{if(!(ma in CCM.map)&&!(ma in old)){const sg=ccmSuggest(ten,ppl);CCM.map[ma]=sg;if(sg)CCM.sg[ma]=sg}const val=pick(ma);
    const st=!(ma in CCM.map)&&ma in old?pill("Đã ghép lần trước","gry"):val&&CCM.sg[ma]===val?pill("Web gợi ý theo tên","grn"):val?pill("Đã chọn","blu"):pill("Bỏ qua","amb");
    return `<tr><td class="mono">${esc(ma)}</td><td>${esc(ten)}</td><td><select data-ccm="${esc(ma)}"><option value="">Bỏ qua mã này</option>${ppl.map(p=>`<option value="${esc(p.id)}"${p.id===val?" selected":""}>${esc(p.name)}${p.pb?" · "+esc(ccPbName2(I.deps||[],p.pb)):""}</option>`).join("")}</select></td><td>${st}</td></tr>`}).join(""):"";
  m.innerHTML=H("Nạp file máy chấm công")+`
  <section class="card"><div class="card-h"><h2>1. Chọn máy và file</h2></div>
    <div class="filters"><label class="inl">Máy chấm công <select id="ccm-may">${Object.entries(CCM_MAY).map(([k,t])=>`<option value="${k}"${k===CCM.may?" selected":""}>${t}</option>`).join("")}</select></label>
    <input type="file" id="ccm-f" accept=".xlsx,.xls,.csv"><span class="hint">${I.nap&&I.nap.n?`Đã nạp ${I.nap.n} dòng, từ ${vndate(I.nap.tu)} đến ${vndate(I.nap.den)}`:"Chưa nạp file nào cho máy này"}</span></div>
    <p class="hint">File là bảng "Chi tiết chấm công" xuất từ máy (mỗi người mỗi ngày một dòng, có Vào 1, Ra 1…). Mỗi máy đánh mã riêng nên chọn đúng máy trước khi nạp. Nạp lại cùng kỳ thì web thay bằng file mới.</p>
    ${F?`<p>${pill("Đã đọc","grn")} <b>${F.rows.length}</b> dòng · <b>${F.ma.length}</b> mã · từ ${vndate(F.tu)} đến ${vndate(F.den)}</p>`:""}</section>
  ${F?`<section class="card"><div class="card-h"><h2>2. Ghép mã trên máy với nhân viên trên web</h2><span class="hint">làm một lần cho mỗi máy, lần sau web tự nhớ</span></div>
    ${tbl(["Mã trên máy","Tên trên máy","Nhân viên trên web",""],[mapRows])}
    <div class="filters"><span class="sp"></span><button class="btn pri" id="ccm-save"${CCM.busy?" disabled":""}>${CCM.busy?"Đang lưu…":"Lưu vào chấm công"}</button></div></section>`:""}
  <p class="hint">Sau khi lưu, xem kết quả ở Bảng chấm công tháng: web tính đi muộn, về sớm, quên chấm ra theo giờ trong Cài đặt chấm công (không theo giờ cài trong máy), và so với chấm bằng điện thoại.</p>`;
  $("#ccm-may").onchange=e=>{CCM.may=e.target.value;CCM.file=null;CCM.map={};CCM.info=null;renderMain()};
  $("#ccm-f").onchange=async e=>{const f=e.target.files[0];if(!f)return;if(typeof XLSX==="undefined"){toast("Chưa tải xong bộ đọc Excel, thử lại sau vài giây");return}
    try{CCM.file=ccmParse(await f.arrayBuffer());CCM.map={};CCM.sg={};renderMain()}catch(err){toast(err.message)}};
  m.querySelectorAll("[data-ccm]").forEach(s=>s.onchange=()=>{CCM.map[s.dataset.ccm]=s.value;renderMain()});
  if($("#ccm-save"))$("#ccm-save").onclick=async()=>{if(CCM.busy)return;CCM.busy=true;renderMain();
    const map={};F.ma.forEach(([ma])=>{map[ma]=pick(ma)});
    try{const r=await svApi("/api/hub/chamcong/may",{method:"POST",body:JSON.stringify({may:CCM.may,tu:F.tu,den:F.den,rows:F.rows,map})});
      toast(`Đã lưu ${r.n} dòng của ${CCM_MAY[CCM.may]}`);CCM.busy=false;CCM.file=null;CCM.map={};CCM.info=null;CC.mon=null;CC.thang=F.tu.slice(0,7);PAGE="cc_thang";renderMain()}
    catch(err){CCM.busy=false;toast(err.message);renderMain()}};
}

/* Bảng lương (hr.js calcRow): số bữa ăn trưa, chuyên cần, giờ tăng ca đã duyệt từ chấm công điện thoại, theo mã nhân sự. */
const CCL={};
async function ccLuongLoad(thang){
  if(CCL[thang]&&(CCL[thang].loading||Date.now()-CCL[thang].at<60000))return false;CCL[thang]={loading:true,at:Date.now()};
  try{const r=await svApi("/api/hub/chamcong/thang?thang="+thang);const by={},mOf={};(D().users||[]).forEach(u=>{if(u.crm&&u.maNS)mOf[u.crm]=u.maNS});
    r.list.forEach(x=>{const ma=mOf[x.id];if(!ma)return;let ot=0,otCN=0;(x.ngay||[]).forEach(d=>{if(!d.ot)return;const w=new Date(d.n+"T00:00:00Z").getUTCDay();if(w===0||d.le)otCN+=d.ot;else ot+=d.ot});
      by[ma]={bua:x.cong>0?x.cong:null,cc:x.cong>0?x.chuyenCan:null,ot,otCN,congHL:x.congHL,phepHL:x.phepHL||0,klNgay:x.klNgay||0,viPham:x.viPham||0,coDl:(x.cong||0)+(x.nghi||0)+(x.nghiPhep||0)>0}});
    CCL[thang]={at:Date.now(),q:r.quyTac,by};return true}catch(e){CCL[thang]={at:Date.now(),err:1,by:{}};return false}
}
function ccLuong(ma,thang){const L=CCL[thang]||{},q=L.q||{tienTrua:25000,tienCC:200000},e=(L.by||{})[ma]||{};return {bua:e.bua??null,giaBua:q.tienTrua,cc:e.cc??null,tienCC:q.tienCC,ot:e.ot||0,otCN:e.otCN||0}}
{const o=PAGES.hr_bl;if(o)PAGES.hr_bl=m=>{o(m);if(typeof HRM!=="undefined"&&HRM)ccLuongLoad(HRM).then(ch=>{if(ch&&PAGE==="hr_bl")renderMain()});const h=m.querySelector(".card.flush");if(h)h.insertAdjacentHTML("afterend",`<p class="hint">Ăn trưa = số bữa (ngày có chấm công điện thoại, chưa dùng điện thoại thì theo ngày công) × đơn giá; chuyên cần, giờ tăng ca đã duyệt lấy từ chấm công điện thoại. Đơn giá, tiền chuyên cần sửa ở Nhân sự › Cài đặt chấm công.</p>`)}}

PAGES.cc_xn=pCcXn;PAGES.cc_may=pCcMay;PAGES.cc_toi=pCcToi;PAGES.cc_ngay=pCcNgay;PAGES.cc_thang=pCcThang;PAGES.cc_xepca=pCcXepCa;PAGES.cc_caidat=pCcCaiDat;

/* Menu (chạy sau menubang.js). CEO 04/11: mọi thứ nằm trong mục Nhân sự; nhân viên dùng Của tôi.
   - Nhân sự (CEO, HCNS): Chấm công (Hôm nay, Bảng chấm công tháng, Xếp ca, Chốt công tháng, Cài đặt chấm công),
     Nghỉ phép & tạm ứng (nghiphep.js), rồi các nhóm cũ (Hồ sơ, Hiệu suất, Lương…).
   - Nhân sự (Lead): chỉ nhóm "Nhóm của tôi" (Hôm nay, Duyệt nghỉ phép & tăng ca, Xếp ca, Bảng chấm công tháng của phòng mình).
   - Của tôi: Chấm công (nghiphep.js thêm Nghỉ phép & tăng ca, Tạm ứng lương, Phiếu lương). */
{
  const MOVED=["hr_nghi","hr_cc","cc_caidat","cc_xepca","cc_thang","cc_ngay","cc_may"];
  const hr=MODULES.find(x=>x.k==="hr");
  if(hr){const g0=hr.groups;hr.groups=()=>{const G0=g0(),hrcc=G0.flatMap(([,its])=>its).find(i=>i[0]==="hr_cc");
    const rest=G0.map(([g,its])=>[g==="Chấm công & hiệu suất"?"Hiệu suất":g,its.filter(i=>!MOVED.includes(i[0]))]);
    const lead=u=>ccLead(u)&&!ccHr(u),cho=k=>()=>(typeof NP!=="undefined"&&NP.cho[k])||"";
    const ketoan=u=>ccHr(u)||(typeof npKetoan==="function"&&npKetoan());
    const hs=rest.filter(([g])=>g==="Hồ sơ"),other=rest.filter(([g])=>g!=="Hồ sơ"); // CEO 04/11: Hồ sơ lên đầu mục Nhân sự
    return [...hs,["Nhóm của tôi",[MI("cc_ngay","Hôm nay",lead),MI("np_duyet","Duyệt nghỉ phép & tăng ca",lead,cho("lead")),MI("cc_xepca","Xếp ca",lead),MI("cc_thang","Bảng chấm công tháng",lead),MI("cc_xn","Xác nhận chấm ngoài",lead,()=>CC.xnCho||"")]],
      ["Chấm công",[MI("cc_ngay","Hôm nay",ccHr),MI("cc_thang","Bảng chấm công tháng",ccHr),MI("cc_xn","Xác nhận chấm ngoài",ccHr,()=>CC.xnCho||""),MI("cc_may","Nạp file máy chấm công",ccHr),MI("cc_xepca","Xếp ca",ccHr),...(hrcc?[[hrcc[0],"Chốt công tháng",hrcc[2],hrcc[3]]]:[]),MI("cc_caidat","Cài đặt chấm công",ccHr)]],
      ["Nghỉ phép & tạm ứng",[MI("np_toi","Gửi đơn nghỉ, tăng ca"),MI("np_ql","Duyệt nghỉ phép & tăng ca",ccHr,cho("hcns")),MI("tu_ql","Tạm ứng lương",ketoan,cho("tu"))]],
      ...other]}}
  const me=MODULES.find(x=>x.k==="me");if(me){const g0=me.groups;me.groups=()=>{const G=g0();if(G[0]&&!G[0][1].some(i=>i[0]==="cc_toi"))G[0][1].unshift(MI("cc_toi","Chấm công"));return G}}
}
