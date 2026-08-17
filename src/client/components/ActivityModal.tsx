import React, { useState } from 'react';
import { ACTIVITY_CHANNELS, ACTIVITY_RESULTS, CLOSING_RESULTS, STAGE_LABELS } from '@shared/enums';
import type { CustomerStage } from '@shared/enums';
import { vnDateOffset } from '@shared/datetime';
import { STAGE_FLOW } from '@shared/stages';
import { ApiError, api, newIdempotencyKey } from '../lib/api';
import { Field, Modal, useToast } from './ui';

interface Props {
  customerId: string;
  customerName: string;
  currentStage: CustomerStage;
  /** Cấp bậc đại lý và công nợ hiện tại, để sale nhìn thấy ngay khi gọi khách. */
  tierName?: string | null;
  phone?: string | null;
  officialDebt?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Ghi nhận chăm sóc. Giữ nguyên dữ liệu đã nhập khi API báo lỗi (mục 6.1). */
export function ActivityModal({
  customerId,
  customerName,
  currentStage,
  tierName,
  phone,
  officialDebt,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const [idempotencyKey] = useState(newIdempotencyKey());
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    channel: ACTIVITY_CHANNELS[0] as string,
    result: ACTIVITY_RESULTS[0] as string,
    content: '',
    next_action: '',
    next_date: vnDateOffset(2),
    reason_code: '',
    stage: currentStage as string,
  });

  const closing = (CLOSING_RESULTS as readonly string[]).includes(form.result);
  // Cho chọn mọi giai đoạn: khách nhập từ file cũ đang là "Mới tiếp cận" dù đã mua nhiều năm,
  // sale phải sửa được về đúng thực tế.
  const stageOptions = [...new Set([currentStage, ...STAGE_FLOW[currentStage]])];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFields({});
    setFormError(null);
    try {
      await api.post(
        `/api/customers/${customerId}/activities`,
        {
          channel: form.channel,
          result: form.result,
          content: form.content,
          next_action: closing ? null : form.next_action,
          next_date: closing ? null : form.next_date,
          reason_code: closing ? form.reason_code : null,
          stage: form.stage as CustomerStage,
        },
        idempotencyKey,
      );
      toast.success('Đã ghi nhận kết quả chăm sóc');
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields ?? {});
        setFormError(err.message);
      } else {
        setFormError('Không lưu được, vui lòng thử lại.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Ghi nhận chăm sóc · ${customerName}${tierName ? ` · ${tierName}` : ''}${
        phone ? ` · ${phone}` : ''
      }${officialDebt ? ` · nợ ${officialDebt.toLocaleString('vi-VN')}đ` : ''}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" form="activity-form" className="btn primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu kết quả'}
          </button>
        </>
      }
    >
      <form id="activity-form" onSubmit={submit}>
        <div className="modal-body">
          {formError && (
            <div className="alert-box" style={{ marginBottom: 14 }}>
              {formError}
            </div>
          )}
          <div className="form-grid">
            <Field label="Hình thức liên hệ" error={fields.channel}>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              >
                {ACTIVITY_CHANNELS.map((channel) => (
                  <option key={channel}>{channel}</option>
                ))}
              </select>
            </Field>
            <Field label="Kết quả" error={fields.result}>
              <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
                {ACTIVITY_RESULTS.map((result) => (
                  <option key={result}>{result}</option>
                ))}
              </select>
            </Field>
            <Field label="Cập nhật giai đoạn" error={fields.stage}>
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </Field>

            {closing ? (
              <Field label="Mã lý do *" error={fields.reason_code} hint="Bắt buộc khi từ chối/mất khách">
                <input
                  value={form.reason_code}
                  onChange={(e) => setForm({ ...form, reason_code: e.target.value })}
                  aria-invalid={Boolean(fields.reason_code)}
                  placeholder="VD: GIA_CAO, DA_CO_NPP_KHAC"
                />
              </Field>
            ) : (
              <Field label="Lịch chăm sóc tiếp *" error={fields.next_date}>
                <input
                  type="date"
                  value={form.next_date}
                  onChange={(e) => setForm({ ...form, next_date: e.target.value })}
                  aria-invalid={Boolean(fields.next_date)}
                />
              </Field>
            )}

            {!closing && (
              <Field label="Bước tiếp theo *" error={fields.next_action} full>
                <input
                  value={form.next_action}
                  onChange={(e) => setForm({ ...form, next_action: e.target.value })}
                  aria-invalid={Boolean(fields.next_action)}
                  placeholder="VD: Gửi bảng giá đại lý cấp 1 và hẹn chốt đơn thử"
                />
              </Field>
            )}

            <Field label="Nội dung trao đổi *" error={fields.content} full>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                aria-invalid={Boolean(fields.content)}
                placeholder="Nhu cầu, phản hồi, trở ngại và cam kết tiếp theo…"
              />
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  );
}
