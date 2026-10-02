/* =====================================================================
   GỌI CLAUDE TRỰC TIẾP (tạm thời, trước khi nối bot phòng ban)
   SDK chính thức @anthropic-ai/sdk tải dạng ESM; khóa API chị tự dán, chỉ lưu trong trình duyệt máy này.
   Bản thật: khóa để trên máy chủ, trình duyệt không giữ khóa.
   ===================================================================== */
const CL_KEY="ailla_claude_key",CL_MODEL="ailla_claude_model",CL_SRC="ailla_ai_src",CL_COMBO="ailla_ai_combo",BRIDGE="http://127.0.0.1:20131";
const lsGet=(k,dft)=>{try{return localStorage.getItem(k)||dft}catch(e){return dft}};
const aiSrc=()=>lsGet(CL_SRC,"9router"),aiCombo=()=>lsGet(CL_COMBO,"Combo_Content");
/* Mặc định: 9router trên VPS (gói tháng có sẵn) qua "cầu nối AI" chạy trên máy (cau-noi-ai\CHAY-CAU-NOI-AI.cmd) */
async function ask9router(system,user){
  let res;try{res=await fetch(BRIDGE+"/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system,user,model:aiCombo()})})}
  catch(e){throw new Error("Chưa bật cầu nối AI trên máy. Mở thư mục AILLA-MKT-HUB › cau-noi-ai, bấm đúp CHAY-CAU-NOI-AI.cmd rồi thử lại.")}
  const j=await res.json().catch(()=>({error:"Cầu nối trả về dữ liệu lạ"}));if(!res.ok||j.error)throw new Error(j.error||("Lỗi "+res.status));return {text:j.text,model:j.model+" (9router)",trunc:false}}
const clKey=()=>{try{return localStorage.getItem(CL_KEY)||""}catch(e){return ""}};
const clModel=()=>{try{return localStorage.getItem(CL_MODEL)||"claude-opus-5-5"}catch(e){return "claude-opus-5-5"}};
let _anth=null;
async function clClient(){if(!_anth){const mod=await import("https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm");_anth=mod.default||mod.Anthropic}return new _anth({apiKey:clKey(),dangerouslyAllowBrowser:true})}
async function askClaude(system,user,effort="medium"){
  if(aiSrc()==="9router")return ask9router(system,user);
  if(!clKey())throw new Error("Chưa dán khóa API Claude (Trợ lý AI › Kết nối AI).");
  const client=await clClient(),A=_anth;
  try{
    const model=clModel(),req={model,max_tokens:16000,output_config:{effort},system,messages:[{role:"user",content:user}]};
    if(model==="claude-opus-5-5"||model==="claude-sonnet-5-5"){req.betas=["server-side-fallback-2026-07-01"];req.fallbacks="default"}
    const res=req.betas?await client.beta.messages.create(req):await client.messages.create(req);
    if(res.stop_reason==="refusal")throw new Error("Claude từ chối trả lời yêu cầu này"+(res.stop_details&&res.stop_details.explanation?": "+res.stop_details.explanation:""));
    return {text:res.content.filter(b=>b.type==="text").map(b=>b.text).join("\n").trim(),model:res.model,trunc:res.stop_reason==="max_tokens"};
  }catch(err){
    if(A&&err instanceof A.AuthenticationError)throw new Error("Khóa API không đúng hoặc đã bị thu hồi.");
    if(A&&err instanceof A.PermissionDeniedError)throw new Error("Khóa API không có quyền dùng model này.");
    if(A&&err instanceof A.RateLimitError)throw new Error("Đang quá giới hạn gọi, thử lại sau ít phút.");
    if(A&&err instanceof A.BadRequestError)throw new Error("Yêu cầu không hợp lệ: "+err.message);
    if(A&&err instanceof A.APIError)throw new Error(`Lỗi từ Claude (${err.status}): ${err.message}`);
    throw err;
  }
}
const mdLite=t=>{const out=[];let ul=false;const inl=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/(^|[\s(])\*([^*\n]+)\*/g,"$1<i>$2</i>");
  String(t).split(/\r?\n/).forEach(l=>{const s=l.trim();if(!s)return;if(/^[-*_]{3,}$/.test(s)){if(ul){out.push("</ul>");ul=false}out.push("<hr>");return}const li=s.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/),h=s.match(/^#{1,4}\s+(.*)$/);
    if(li){if(!ul){out.push("<ul>");ul=true}out.push("<li>"+inl(li[1])+"</li>");return}if(ul){out.push("</ul>");ul=false}
    out.push(h?"<h3>"+inl(h[1])+"</h3>":"<p>"+inl(s)+"</p>")});if(ul)out.push("</ul>");return out.join("")};
const CL_SYS="Bạn là trợ lý phân tích kinh doanh cho AILLA Việt Nam (hãng giặt tẩy, vệ sinh nhà cửa; bán chủ yếu qua video TikTok Shop). Người đọc là CEO và trưởng nhóm content, không rành thuật ngữ. Gọi người đọc là chị (không viết anh/chị). Viết tiếng Việt, ngắn, rõ, dùng số liệu được cung cấp, không bịa số. Cấu trúc: ## Nhận định chính (3–5 gạch đầu dòng) · ## Đề xuất điều chỉnh kế hoạch tuần tới (cụ thể: sản phẩm nào tăng/giảm bao nhiêu video, nhân bản video nào) · ## Rủi ro cần theo dõi. Không quá 350 chữ.";
function clConnectCard(){const k=clKey(),s=aiSrc();return `<section class="card"><div class="card-h"><h2>Kết nối AI</h2><span id="cl-st">${s==="9router"?pill("đang kiểm tra…","gry"):k?pill("Đã có khóa","grn"):pill("Chưa có khóa","amb")}</span></div>
  <label class="field">Dùng AI qua<select id="cl-src">${opt([["9router","9router trên VPS — gói tháng có sẵn (không tốn thêm tiền)"],["api","Khóa API Claude — trả tiền theo lượt"]],s)}</select></label>
  ${s==="9router"?`<p class="hint">Web gọi 9router (gom các tài khoản Claude/ChatGPT gói tháng) qua <b>cầu nối AI</b> trên máy này. Trước khi dùng: mở thư mục AILLA-MKT-HUB › cau-noi-ai, bấm đúp <b>CHAY-CAU-NOI-AI.cmd</b>, để cửa sổ đen đó mở.</p><div class="row4"><label class="field grow">Combo AI trong 9router<input id="cl-combo" value="${esc(aiCombo())}" placeholder="Combo_Content"></label></div>`
  :`<p class="hint">Dán khóa API (platform.claude.com › API Keys). Khóa chỉ lưu trong trình duyệt máy này. Mỗi lượt hỏi tính tiền vào tài khoản API.</p><div class="row4"><label class="field grow">Khóa API<input type="password" id="cl-k" autocomplete="off" placeholder="${k?"đã lưu · dán khóa mới để thay":"sk-ant-…"}"></label><label class="field">Model<select id="cl-m">${opt([["claude-opus-5-5","Claude Opus 5.5"],["claude-sonnet-5-5","Claude Sonnet 5.5 (rẻ hơn)"]],clModel())}</select></label></div>`}
  <div class="acts"><button class="btn pri" id="cl-save">Lưu</button>${s==="api"&&k?`<button class="btn danger" id="cl-del">Xóa khóa</button>`:""}</div></section>`}
function bindClConnect(){if(!$("#cl-save"))return;
  $("#cl-src").onchange=e=>{try{localStorage.setItem(CL_SRC,e.target.value)}catch(_){}renderMain()};
  $("#cl-save").onclick=()=>{try{if(aiSrc()==="9router")localStorage.setItem(CL_COMBO,$("#cl-combo").value.trim()||"Combo_Content");else{const v=$("#cl-k").value.trim();if(v)localStorage.setItem(CL_KEY,v);localStorage.setItem(CL_MODEL,$("#cl-m").value)}}catch(e){toast("Trình duyệt chặn lưu");return}toast("Đã lưu");renderMain()};
  if($("#cl-del"))$("#cl-del").onclick=()=>{try{localStorage.removeItem(CL_KEY)}catch(e){}toast("Đã xóa khóa");renderMain()};
  if(aiSrc()==="9router")fetch(BRIDGE+"/health").then(r=>r.json()).then(j=>{if($("#cl-st"))$("#cl-st").innerHTML=j.ok?pill("Cầu nối đang chạy","grn"):pill("Cầu nối thiếu khóa 9router","red")}).catch(()=>{if($("#cl-st"))$("#cl-st").innerHTML=pill("Chưa bật cầu nối","amb")});
}
