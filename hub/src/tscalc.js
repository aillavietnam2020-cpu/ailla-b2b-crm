/* =====================================================================
   TÀI SẢN CỐ ĐỊNH & CÔNG CỤ DỤNG CỤ: luật tính thuần (test: tests/unit/tscalc.test.ts). Trang ở taisan.js.
   Chị Hoa duyệt 28/10: khấu hao / phân bổ đường thẳng TÍNH THEO NGÀY.
     Mức 1 tháng = giá trị ÷ số tháng; tháng đầu và tháng ghi giảm nhân (số ngày dùng ÷ số ngày trong tháng);
     tháng cuối nhận phần lẻ, nên cộng mọi tháng = đúng giá trị. Làm tròn tới đồng từng tháng.
     CCDC 1 tháng (phân bổ 1 lần): vào hết tháng bắt đầu.
     Khai báo đầu kỳ (tài sản đang có từ MISA): từ tháng web làm chuẩn, chia đều phần còn lại cho số tháng còn lại, tròn tháng.
   Một tài sản: {id,kind:"TS"|"CC",ma,ten,loai,d ngày ghi tăng,s ngày bắt đầu tính,gk giá trị tính khấu hao/phân bổ,ng nguyên giá,
     n số tháng,kkh không tính khấu hao,dk:{tu:"yyyy-mm",lk hao mòn đến hết tháng trước,con số tháng còn lại},
     bp:[{o,p}] ai chịu chi phí (o là mã ở TS_DT, p là %), dc:[{tu:"yyyy-mm",bp}] điều chuyển, gg:{d,ly,thu} ghi giảm}
   ===================================================================== */
/* Đối tượng chịu chi phí: mã → [tên, cột kênh ở Sổ chi phí (fin.nkc .k), TK Nợ]. "Chung" đi qua Quy tắc phân bổ của chị Huệ. */
/* TK 154 chi tiết (chị Hoa 28/10): 154.1 giá thành thành phẩm, 154.2 giá thành bán thành phẩm. Mã "sx" giữ cho 154.1 để dữ liệu cũ vẫn đọc được. */
const TS_DT={sx:["Sản xuất thành phẩm","Sản xuất","154.1"],sx2:["Sản xuất bán thành phẩm","Sản xuất","154.2"],ql:["Văn phòng, quản lý","Chung","6422"],bh:["Bán hàng chung (chia kênh theo Quy tắc phân bổ)","Chung","6421"],
  tts:["Kênh TikTok","TikTok","6421"],spm:["Kênh Shopee Mall","Shopee Mall","6421"],spt:["Kênh Shopee thường","Shopee thường","6421"],fb:["Kênh Facebook","Facebook","6421"],
  npp:["Kênh phân phối","NPP","6421"],gc:["Kênh OEM","Gia công","6421"]};
const TS_LOAI={TS:["Máy móc, thiết bị","Nhà cửa, vật kiến trúc","Phương tiện vận tải","Thiết bị, dụng cụ quản lý","Tài sản khác"],CC:["Phân bổ nhiều kỳ","Phân bổ 1 lần","Chi phí trả trước (thuê, phần mềm)"]};
/* Nhóm ở Sổ chi phí cho dòng tự ghi. Phần sản xuất theo TK: 154.1 → G25, 154.2 → G26 (nhóm của Sổ chi phí).
   Phần còn lại: TSCĐ G27 (mới), CCDC G14 (có sẵn); phiếu chi mua tài sản G28 (mới). Lúc đầu dùng G25/G26, trùng mã Sổ chi phí nên đổi (tsDoiMa ở taisan.js). */
const TS_NHOM={TS:"G27",CC:"G14",MUA:"G28"},TS_NHOM_TK={"154.1":"G25","154.2":"G26"};
const TS_DM_MOI=[{g:"G27",n:"Khấu hao tài sản cố định",tk:"CHIA",lo:"B - Phòng ban",cd:1,gc:"Web tự ghi hằng tháng từ Tài sản cố định (Có TK 2141), phần bán hàng, quản lý. Phần xưởng vào G25 / G26"},
  {g:"G28",n:"Mua tài sản cố định / công cụ dụng cụ",tk:"211",lo:"Không tính",cd:0,gc:"Tiền mua tài sản, công cụ: không vào chi phí tháng, chỉ phần khấu hao / phân bổ từng tháng mới vào"}];

const tsDim=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
const tsYmAdd=(ym,k)=>{const[y,m]=ym.split("-").map(Number),t=y*12+m-1+k;return Math.floor(t/12)+"-"+String(t%12+1).padStart(2,"0")};
/* Cộng k tháng giữ nguyên ngày (31/01 + 1 tháng = 28 hoặc 29/02 cuối tháng). */
function tsAddM(d,k){const[y,m,dd]=d.split("-").map(Number),ym=tsYmAdd(y+"-"+String(m).padStart(2,"0"),k),[y2,m2]=ym.split("-").map(Number);return ym+"-"+String(Math.min(dd,tsDim(y2,m2))).padStart(2,"0")}
const tsAddD=(d,k)=>{const t=new Date(d+"T00:00:00Z");t.setUTCDate(t.getUTCDate()+k);return t.toISOString().slice(0,10)};
const tsNgay=(a,b)=>Math.round((new Date(b+"T00:00:00Z")-new Date(a+"T00:00:00Z"))/864e5)+1;

/* Đoạn tính: khai báo đầu kỳ thì bắt đầu từ ngày 01 tháng web làm chuẩn với phần còn lại; không thì từ ngày bắt đầu với cả giá trị. */
function tsDoan(a){const gk=+(a.gk??a.ng)||0;
  /* dk.lich: đầu kỳ nhưng vẫn theo lịch gốc (web tự tính lũy kế từ ngày bắt đầu), không chia lại phần còn lại. */
  if(a.dk&&a.dk.tu&&!a.dk.lich)return {s:a.dk.tu+"-01",v:Math.max(0,gk-(+a.dk.lk||0)),m:Math.max(0,Math.round(+a.dk.con||0)),lk0:+a.dk.lk||0,tron:true};
  return {s:a.s||a.d,v:gk,m:Math.max(0,Math.round(+a.n||0)),lk0:0,tron:false}}

/* Lịch từng tháng {ym: số tiền} từ tháng bắt đầu tới hết (hoặc tới ngày ghi giảm). */
function tsLich(a){const o={};if(a.kkh)return o;const S=tsDoan(a);if(!S.s||!S.v||!S.m)return o;
  /* stop: ngày ghi giảm (không tính ngày đó); end: ngày tròn số tháng; cuoi: ngày dùng cuối cùng. */
  const stop=a.gg&&a.gg.d?a.gg.d:null,end=tsAddM(S.s,S.m),last=stop&&stop<end?stop:end,cuoi=tsAddD(last,-1),muc=S.v/S.m;
  let ym=S.s.slice(0,7),cong=0;
  if(S.m===1&&!S.tron){if(!stop||stop>S.s)o[ym]=S.v;return o}
  for(let i=0;i<S.m+2&&cong<S.v;i++,ym=tsYmAdd(ym,1)){
    const[y,m]=ym.split("-").map(Number),D0=tsDim(y,m),f=ym+"-01",l=ym+"-"+String(D0).padStart(2,"0");
    const sd=S.s>f?S.s:f,thangCuoi=cuoi<=l,ed=thangCuoi?cuoi:l;if(ed<sd)break;
    const du=sd===f&&ed===l;/* dùng trọn tháng */
    let v=du||(S.tron&&!(thangCuoi&&last<end))?Math.round(muc):Math.round(muc*tsNgay(sd,ed)/D0);
    if(thangCuoi&&last===end)v=S.v-cong;/* tháng cuối nhận phần lẻ */
    v=Math.max(0,Math.min(v,S.v-cong));if(v)o[ym]=v;cong+=v;if(thangCuoi)break}
  return o}
const tsThang=(a,ym)=>tsLich(a)[ym]||0;
/* Hao mòn / đã phân bổ lũy kế đến hết tháng ym. */
function tsLuyKe(a,ym){const L=tsLich(a),S=tsDoan(a);return S.lk0+Object.keys(L).filter(k=>k<=ym).reduce((t,k)=>t+L[k],0)}
const tsConLai=(a,ym)=>Math.max(0,(+(a.gk??a.ng)||0)-tsLuyKe(a,ym));
/* Đang dùng / đã hết / ghi giảm / chưa dùng tại cuối tháng ym. */
function tsTrangThai(a,ym){const s=a.s||a.d||(a.dk&&a.dk.tu+"-01")||"";if(a.gg&&a.gg.d&&a.gg.d.slice(0,7)<=ym)return "GIAM";if(s&&s.slice(0,7)>ym)return "CHUA";if(a.kkh)return "KKH";return tsConLai(a,ym)<1?"HET":"DUNG"}
/* Ai chịu chi phí tháng ym: bản điều chuyển gần nhất có hiệu lực từ tháng đó trở về trước. */
function tsBpTai(a,ym){const v=(a.dc||[]).filter(x=>x.tu<=ym).sort((x,y)=>x.tu<y.tu?-1:1).pop();return (v?v.bp:a.bp)||[]}
const tsBpOk=bp=>{const s=(bp||[]).reduce((t,x)=>t+(+x.p||0),0);return Math.abs(s-100)<1e-6&&(bp||[]).every(x=>TS_DT[x.o])};
/* Chia một số tiền theo %; phần lẻ làm tròn dồn vào dòng lớn nhất, tổng không đổi. */
function tsChiaPct(t,bp){const L=(bp||[]).filter(x=>+x.p>0);if(!L.length)return [];let used=0;
  const o=L.map(x=>{const v=Math.round(t*x.p/100);used+=v;return {o:x.o,p:+x.p,v}});
  const big=o.slice().sort((a,b)=>b.p-a.p)[0];big.v+=t-used;return o}
/* Các dòng ghi Sổ chi phí của tháng ym. Tài sản chưa chia đủ 100% thì báo lỗi, không ghi. */
function tsDongThang(list,ym){const dong=[],loi=[];
  (list||[]).forEach(a=>{const v=tsThang(a,ym);if(!v)return;const bp=tsBpTai(a,ym);
    if(!tsBpOk(bp)){loi.push(a.ma+": chưa chia đủ 100% cho bộ phận chịu chi phí");return}
    tsChiaPct(v,bp).forEach(x=>{const[n,k,tkn]=TS_DT[x.o];dong.push({id:a.id,ma:a.ma,ten:a.ten,kind:a.kind,o:x.o,on:n,p:x.p,k,tkn,tkc:a.kind==="TS"?"2141":"242",g:TS_NHOM_TK[tkn]||TS_NHOM[a.kind],t:x.v})})});
  return {dong,loi,tong:dong.reduce((t,x)=>t+x.t,0)}}
/* Tháng ym khóa khi đã qua ngày 10 tháng sau (ngày chốt sổ). */
const tsKhoa=(ym,today)=>today>tsYmAdd(ym,1)+"-10";
/* Thanh lý: giá trị còn lại tại ngày ghi giảm, lãi (+) / lỗ (−) so với tiền thu. */
function tsThanhLy(a,d,thu){const b={...a,gg:{d}},con=tsConLai(b,d.slice(0,7));return {lk:(+(a.gk??a.ng)||0)-con,con,lai:(+thu||0)-con}}

/* ---------- Nạp file Excel xuất từ MISA (Sổ tài sản cố định / Sổ theo dõi CCDC) ---------- */
const tsBoDau=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().replace(/\s+/g," ").trim();
function tsSo(v){if(typeof v==="number")return v;let s=String(v??"").trim().replace(/\s|đ|VND/gi,"");if(!s)return null;const am=/^\(.*\)$/.test(s);s=s.replace(/[()]/g,"");
  if(/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))s=s.replace(/\./g,"").replace(",",".");else if(/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))s=s.replace(/,/g,"");else s=s.replace(",",".");
  const n=+s;return isFinite(n)?(am?-n:n):null}
/* Ngày: số ngày Excel, dd/mm/yyyy hoặc yyyy-mm-dd → yyyy-mm-dd. */
function tsNgayDoc(v){if(v==null||v==="")return "";if(typeof v==="number"&&v>20000&&v<80000)return new Date(Date.UTC(1899,11,30)+v*864e5).toISOString().slice(0,10);
  if(v instanceof Date&&!isNaN(v))return new Date(Date.UTC(v.getFullYear(),v.getMonth(),v.getDate())).toISOString().slice(0,10);
  const s=String(v).trim();let m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);if(m)return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[0]:""}
/* Cột MISA → trường. Thứ tự quan trọng: cột cụ thể đứng trước cột chung. */
const TS_COT=[["con",/(thoi gian|so ky|so thang)( su dung| phan bo| pb)? con lai/],["conGt",/gia tri con lai/],["lk",/hao mon luy ke|luy ke|gia tri da phan bo|da phan bo/],
  ["gk",/gia tri tinh (khau hao|phan bo|kh)/],["s",/ngay bat dau (tinh|su dung|phan bo|khau hao)/],["d",/ngay (ghi tang|tang)|ngay chung tu/],
  ["n",/thoi gian (su dung|phan bo|khau hao)|so ky phan bo|so ky pb|so thang|^so ky$/],["ng",/nguyen gia|gia tri (ccdc|cong cu|ghi tang)|^gia tri$|^thanh tien$|^so tien$/],
  ["ma",/^ma (tai san|ts|ccdc|cong cu)|^ma$/],["ten",/^ten/],["loai",/^loai/],["bp",/don vi su dung|bo phan|doi tuong phan bo|tai khoan chi phi|tk chi phi/]];
function tsTimCot(row){const o={};(row||[]).forEach((c,i)=>{const t=tsBoDau(c);if(!t)return;const f=TS_COT.find(([k,re])=>o[k]==null&&re.test(t));if(f)o[f[0]]=i});return o}
/* Bộ phận ghi trong MISA → mã đối tượng ở TS_DT. */
function tsBpDoan(s,mac){const t=tsBoDau(s);if(/1542|154\.2|ban thanh pham/.test(t))return "sx2";if(/san xuat|xuong|bpsx|154/.test(t))return mac==="sx2"?"sx2":"sx";if(/ban hang|kinh doanh|bpbh|6421|641/.test(t))return "bh";if(/van phong|quan ly|ke toan|bpql|6422|642/.test(t))return "ql";return mac}
/* Bảng (mảng các dòng) → danh sách tài sản đọc được + dòng không đọc được. */
function tsDocBang(rows,kind,tu){const R=rows||[];let h=-1,c={};
  for(let i=0;i<Math.min(R.length,30);i++){const x=tsTimCot(R[i]);if(x.ten!=null&&(x.ng!=null||x.gk!=null)){h=i;c=x;break}}
  if(h<0)return {err:"Không thấy dòng tiêu đề có cột Tên và Nguyên giá / Giá trị. Chị xuất lại file từ MISA (Sổ tài sản cố định hoặc Sổ theo dõi CCDC).",items:[],bo:[]};
  const items=[],bo=[],g=(r,k)=>c[k]==null?null:r[c[k]];
  R.slice(h+1).forEach((r,j)=>{const ten=String(g(r,"ten")??"").trim(),ma=String(g(r,"ma")??"").trim(),ng=tsSo(g(r,"ng")),gk=tsSo(g(r,"gk"));
    if(!ten||/^(tong|cong)( cong)?\b/.test(tsBoDau(ten))||/^(tong|cong)\b/.test(tsBoDau(ma))){return}
    if(!(ng>0||gk>0)){bo.push({dong:h+j+2,ten,why:"không có nguyên giá / giá trị"});return}
    const d=tsNgayDoc(g(r,"d")),s=tsNgayDoc(g(r,"s"))||d,n=tsSo(g(r,"n")),lk=tsSo(g(r,"lk")),con=tsSo(g(r,"con")),conGt=tsSo(g(r,"conGt"));
    const a={kind,ma:ma||ten.slice(0,20),ten,loai:String(g(r,"loai")??"").trim()||TS_LOAI[kind][0],d,s,ng:ng||gk,gk:gk||ng,n:n||0,bp:[{o:tsBpDoan(g(r,"bp"),kind==="TS"?"sx2":"ql"),p:100}]};
    /* Số MISA đã trích chỉ để đối chiếu (MISA có thể chưa chạy khấu hao / phân bổ các tháng gần đây).
       Có số tháng và ngày bắt đầu thì web tự tính lũy kế tới hết tháng trước tháng làm chuẩn; thiếu thì mới dùng số MISA. */
    const lkx=lk!=null?lk:conGt!=null?a.gk-conGt:null;a.misa={lk:lkx,con};
    a.dk=a.n&&a.s?{tu,lk:null,con:null,lich:true}:{tu,lk:lkx,con};items.push(a)});
  return {items,bo,cot:c}}
/* Điền chỗ thiếu khi khai báo đầu kỳ: hao mòn chưa có thì web tự tính theo ngày tới hết tháng trước; số tháng còn lại chưa có thì lấy số tháng − số tháng đã dùng
   (tháng bắt đầu giữa tháng tính là một tháng đã dùng, nên tháng còn lại chia đều phần còn lại, tháng cuối nhận phần lẻ). */
function tsDienDauKy(a){const tu=a.dk&&a.dk.tu;if(!tu)return a;const truoc=tsYmAdd(tu,-1),moc={...a,dk:null},o={...a,dk:{...a.dk}};
  if(o.dk.lk==null||o.dk.lk==="")o.dk.lk=a.n&&a.s?tsLuyKe(moc,truoc):0,o.dk.lkTu=true;
  if(o.dk.con==null||o.dk.con===""){const s=a.s||a.d;if(a.n&&s){const da=(+truoc.slice(0,4)-+s.slice(0,4))*12+(+truoc.slice(5)-+s.slice(5,7))+1;o.dk.con=Math.max(0,a.n-Math.max(0,da))}else o.dk.con=0;o.dk.conTu=true}
  return o}
