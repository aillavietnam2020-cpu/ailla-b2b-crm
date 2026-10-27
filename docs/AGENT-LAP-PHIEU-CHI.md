# Agent Kế toán trưởng lập phiếu chi (chị Hoa đồng ý 27/10/2026)

Đoạn dưới đây để chị Hoa dán vào skill của agent Kế toán trưởng (bản đầy đủ đã có trong `vps-skill/abos-web/SKILL.md`, mục "Ghi dữ liệu").

---

**Lập phiếu chi khi chị Thảo bảo.** Chị Thảo (hoặc người làm kế toán được chị Hoa chỉ định) bảo lập phiếu chi thì em lập thẳng trên web, KHÔNG gửi đề xuất. Vẫn làm đúng 4 bước: gom đủ thông tin, vẽ ảnh nháp, chờ chị Thảo nói "đúng / ghi đi", rồi mới chạy lệnh.

Lệnh: `abos --as ke-toan-truong-ailla [--dlg dlg_...] act POST <đường dẫn> '<json>'`

| Loại | Đường dẫn | Trường gửi |
|---|---|---|
| Vận chuyển (cước xe, trả lái xe) | `/api/shipping-vouchers` | `voucher_date` (YYYY-MM-DD), `carrier` (tên lái xe hoặc biển số), `amount` (số đồng), `method` (`TIEN_MAT` / `CHUYEN_KHOAN`), `receiver` (người nhận khi tiền mặt), `destination`, `order_refs`, `note`; chuyển khoản thêm `from_account`, `to_bank`, `to_account_no`, `to_account_name` |
| Trả nhà cung cấp | `/api/hub/kho/mh/payments` | `supplier_id`, `pay_date`, `amount`, `kind` (`CHI` / `COC`), `po_id` hoặc `invoice_id` (hoặc `"general": true` nếu trả nợ chung), `method`, `note` |
| Chi phí khác | `/api/hub/so-chi/phieu-chi` | `pay_date`, `amount`, `content` (chi cho việc gì), `payee` (người nhận), `method` (`CHUYEN_KHOAN` / `TIEN_MAT`), `from_account` (bắt buộc khi chuyển khoản), `to_account`, `requester`, `department`, `note` |

Quy tắc:
- Một khoản = một phiếu. Nhiều chuyến cùng người, cùng ngày thì cộng thành một phiếu, ghi số chuyến ở ghi chú (ví dụ 3 chuyến × 250.000 = 750.000).
- Luôn ghi người nhận.
- Web tự ghi vào phiếu "Agent Kế toán trưởng lập theo lệnh <tên>, lúc <giờ ngày>".
- Khoản từ ngưỡng chi (đặt ở Cấu hình › Ngưỡng cảnh báo, hiện 5 triệu) tự vào Phê duyệt của chị Hoa. Phiếu Chi phí khác luôn chờ chị Huệ duyệt. Em không duyệt phiếu nào.

Lỗi web trả về khi bị chặn:

| Mã lỗi | Nghĩa | Em làm gì |
|---|---|---|
| `PHIEU_TRUNG` (409) | Đã có phiếu cùng người nhận, cùng số tiền, cùng ngày (số phiếu cũ nằm trong câu báo) | Không thử lại. Báo chị Thảo số phiếu cũ, hỏi có đúng là khoản khác không |
| `AGENT_PHIEU_CHI_OFF` (403) | Chị Hoa đang tắt quyền lập phiếu chi của em | Báo chị Thảo tự ghi phiếu |
| `FORBIDDEN` (403) "Không có lệnh…" | Không có giấy ủy quyền (người nhắn không phải người được chỉ định, hoặc giấy hết hạn) | Không ghi. Nhờ chị Thảo nhắn lại trên web Điều hành agent |
| `FORBIDDEN` (403) "Chỉ lập phiếu chi theo lệnh của kế toán…" | Người ra lệnh không có vai kế toán / điều phối | Không ghi |
| `NEED_PAYEE` (422) | Thiếu người nhận | Hỏi chị Thảo người nhận rồi gửi lại |
| `USE_PHIEU_CHI` (409) | Em gửi đề xuất "phiếu chi" | Đừng gửi đề xuất, lập phiếu bằng lệnh trên |
| `VALIDATION_FAILED` (422), `DATE_FUTURE`, `NEED_FROM`, `BAD_CONTENT` (400) | Thiếu hoặc sai trường | Đọc câu báo, hỏi lại đúng chỗ thiếu |

---

## Cho người làm web

- Rào chung: `src/server/services/agentSpend.ts` (công tắc `agent.phieuchi`, vai người ra lệnh, chặn trùng, dòng nguồn, agent không được tính là CEO). Gắn vào `routes/shippingVouchers.ts`, `routes/purchasing.ts` (POST /payments) và đường mới `routes/soChi.ts`.
- Công tắc: trang Agent AI (Cấu hình › Quyền agent), cột "Lập phiếu chi"; `POST /api/admin/agents/:id/phieuchi {enabled}`. Migration `0084_agent_phieu_chi.sql` bật sẵn cho agent có người ra lệnh trên `ke-toan-truong-*`.
- Người tự ghi phiếu: không đổi gì (không chặn trùng, form trên web như cũ).
