import { useState } from 'react';
import type { CustomerDetail } from '@shared/types';
import { CUSTOMER_STAGES, STAGE_LABELS } from '@shared/enums';
import type { CustomerStage } from '@shared/enums';
import { STAGE_FLOW } from '@shared/stages';
import { useApi } from '../lib/hooks';
import { ApiError, api } from '../lib/api';
import { useAuth } from './AuthProvider';
import { ErrorBox, Modal } from './ui';

interface TierOption {
  id: string;
  name: string;
  rank: number;
  debt_limit: number;
}

/**
 * Sửa hồ sơ khách hàng: thông tin liên hệ, cấp giá, giai đoạn, chu kỳ tái mua.
 * Cấp giá chỉ Quản lý/CEO đổi được vì nó quyết định giá bán và hạn mức công nợ.
 */
export function CustomerEditModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can } = useAuth();
  const tiers = useApi<TierOption[]>('/api/tiers');
  const canChangeTier = can('customer.tier.change');

  const [form, setForm] = useState({
    name: customer.name,
    phone_text: customer.phone_text ?? '',
    province: customer.province ?? '',
    address: customer.address ?? '',
    tier_id: customer.tier_id ?? '',
    source: customer.source ?? '',
    stage: customer.stage as CustomerStage,
    potential: customer.potential ?? '',
    interested_products: customer.interested_products ?? '',
    reorder_cycle_days: customer.reorder_cycle_days ? String(customer.reorder_cycle_days) : '',
    next_follow_up_at: customer.next_follow_up_at ?? '',
    credit_limit: customer.credit_limit ? String(customer.credit_limit) : '',
    lost_reason: customer.lost_reason ?? '',
    birthday: customer.birthday ?? '',
    zalo: customer.zalo ?? '',
    email: customer.email ?? '',
    contact_person: customer.contact_person ?? '',
    tax_code: customer.tax_code ?? '',
    note: customer.note ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  // Chỉ cho chọn giai đoạn hợp lệ theo vòng đời (giữ nguyên giai đoạn hiện tại là luôn hợp lệ).
  const allowedStages = [customer.stage, ...STAGE_FLOW[customer.stage]];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.patch(`/api/customers/${customer.id}`, {
        name: form.name.trim(),
        phone_text: form.phone_text.trim() || null,
        province: form.province.trim() || null,
        address: form.address.trim() || null,
        tier_id: canChangeTier ? form.tier_id || null : undefined,
        source: form.source.trim() || null,
        stage: form.stage,
        potential: form.potential.trim() || null,
        interested_products: form.interested_products.trim() || null,
        reorder_cycle_days: form.reorder_cycle_days ? Number(form.reorder_cycle_days) : null,
        next_follow_up_at: form.next_follow_up_at || null,
        credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
        lost_reason: form.lost_reason.trim() || null,
        birthday: form.birthday || null,
        zalo: form.zalo.trim() || null,
        email: form.email.trim() || null,
        contact_person: form.contact_person.trim() || null,
        tax_code: form.tax_code.trim() || null,
        note: form.note.trim() || null,
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else setError('Không lưu được hồ sơ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Sửa hồ sơ · ${customer.name}`} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="modal-body">
          <ErrorBox message={error} />
          <div className="form-grid">
            <div className="field">
              <label>Tên khách hàng *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              {fields.name && <span className="error">{fields.name}</span>}
            </div>
            <div className="field">
              <label>Số điện thoại</label>
              <input
                value={form.phone_text}
                onChange={(e) => setForm({ ...form, phone_text: e.target.value })}
                inputMode="tel"
              />
              {fields.phone_text && <span className="error">{fields.phone_text}</span>}
            </div>
            <div className="field">
              <label>Ngày sinh</label>
              <input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              />
              <span className="muted" style={{ fontSize: 12 }}>
                Dùng để nhắc chúc mừng sinh nhật khách.
              </span>
            </div>
            <div className="field">
              <label>Zalo / Facebook</label>
              <input value={form.zalo} onChange={(e) => setForm({ ...form, zalo: e.target.value })} />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Người liên hệ</label>
              <input
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                placeholder="Tên người trực tiếp đặt hàng"
              />
            </div>
            <div className="field">
              <label>Mã số thuế</label>
              <input value={form.tax_code} onChange={(e) => setForm({ ...form, tax_code: e.target.value })} />
            </div>
            <div className="field">
              <label>Tỉnh/thành</label>
              <input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
            </div>
            <div className="field">
              <label>Địa chỉ</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>

            <div className="field">
              <label>Cấp giá (bậc đại lý)</label>
              <select
                value={form.tier_id}
                onChange={(e) => setForm({ ...form, tier_id: e.target.value })}
                disabled={!canChangeTier}
              >
                <option value="">— Chưa xác định —</option>
                {(tiers.data ?? []).map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
              <span className="muted" style={{ fontSize: 12 }}>
                {canChangeTier
                  ? 'Đổi cấp là đổi giá bán và hạn mức công nợ của khách. Thao tác này được ghi nhật ký.'
                  : 'Chỉ Quản lý hoặc CEO được đổi cấp giá.'}
              </span>
            </div>

            <div className="field">
              <label>Giai đoạn</label>
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value as CustomerStage })}
              >
                {CUSTOMER_STAGES.filter((s) => allowedStages.includes(s)).map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
              {fields.stage && <span className="error">{fields.stage}</span>}
            </div>

            <div className="field">
              <label>Nguồn khách</label>
              <input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="Facebook, giới thiệu, hội chợ…"
              />
            </div>
            <div className="field">
              <label>Chu kỳ tái nhập (ngày)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={form.reorder_cycle_days}
                onChange={(e) => setForm({ ...form, reorder_cycle_days: e.target.value })}
                placeholder="30"
              />
              <span className="muted" style={{ fontSize: 12 }}>
                Quá chu kỳ mà chưa mua lại, hệ thống tự nhắc.
              </span>
            </div>

            <div className="field">
              <label>Lịch chăm sóc tiếp</label>
              <input
                type="date"
                value={form.next_follow_up_at}
                onChange={(e) => setForm({ ...form, next_follow_up_at: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Hạn mức công nợ riêng (đồng)</label>
              <input
                type="number"
                min={0}
                step={1000000}
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                placeholder="Để trống = theo hạn mức của cấp"
              />
            </div>

            <div className="field full">
              <label>Tiềm năng / ghi chú</label>
              <input value={form.potential} onChange={(e) => setForm({ ...form, potential: e.target.value })} />
            </div>
            <div className="field full">
              <label>Ghi chú / đặc điểm khách</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Thói quen đặt hàng, người quyết định, lưu ý khi giao hàng…"
              />
            </div>
            <div className="field full">
              <label>Sản phẩm quan tâm</label>
              <input
                value={form.interested_products}
                onChange={(e) => setForm({ ...form, interested_products: e.target.value })}
                placeholder="Nước giặt, lau sàn, xịt côn trùng…"
              />
            </div>

            {form.stage === 'LOST' && (
              <div className="field full">
                <label>Lý do mất khách *</label>
                <input
                  value={form.lost_reason}
                  onChange={(e) => setForm({ ...form, lost_reason: e.target.value })}
                  required
                />
                {fields.lost_reason && <span className="error">{fields.lost_reason}</span>}
              </div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
