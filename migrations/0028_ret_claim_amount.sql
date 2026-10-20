-- Hàng hoàn: tiền sàn đền cho gói khiếu nại (đơn Facebook không khiếu nại được: claim = TU_CHIU, tự chịu hao hụt).
ALTER TABLE ret_scans ADD COLUMN claim_amount REAL NOT NULL DEFAULT 0;
