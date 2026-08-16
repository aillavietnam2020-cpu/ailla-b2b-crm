import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CustomerListItem, PriceTier, UserSummary } from '@shared/types';
import { CUSTOMER_STAGES, STAGE_LABELS } from '@shared/enums';
import { formatVnDate, vnDate } from '@shared/datetime';
import { formatVnd } from '@shared/money';
import { formatPhone } from '@shared/phone';
import { ApiError, api, newIdempotencyKey } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { Card, Field, Modal, StageBadge, StateBlock, useToast } from '../components/ui';
import { useAuth } from '../components/AuthProvider';

export function CustomersPage({ mode }: { mode: 'sales' | 'admin' }) {
  const { me, can } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [owner, setOwner] = useState('');
  const [quality, setQuality] = useState('');
  const [sort, setSort] = useState('follow_up');
  const [showCreate, setShowCreate] = useState(params.get('new') === '1');
  const [reassignTarget, setReassignTarget] = useState<CustomerListItem | null>(null);
  const debouncedQ = useDebounced(q);

  const query = new URLSearchParams({ page: '1', page_size: '100' });
  if (debouncedQ) query.set('q', debouncedQ);
  if (stage) query.set('stage', stage);
  if (owner) query.set('owner_id', owner);
  if (quality) query.set('data_quality', quality);
  if (sort) query.set('sort', sort);

  const customers = useApi<CustomerListItem[]>(`/api/customers?${query.toString()}`);
  const users = useApi<UserSummary[]>('/api/users');
  const tiers = useApi<PriceTier[]>('/api/tiers');

  const closeCreate = () => {
    setShowCreate(false);
    if (params.get('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{mode === 'admin' ? 'Khách hàng B2B' : 'Khách hàng của tôi'}</h2>
          <p>
            {mode === 'admin'
              ? 'Toàn đội Sale. Chuyển owner bắt buộc ghi lý do và được lưu vào nhật ký.'
              : 'Chỉ hiển thị khách được phân công cho bạn (giới hạn ở backend).'}
          </p>
        </div>
        {can('customer.create') && (
          <button className="btn primary" onClick={() => setShowCreate(true)}>
            Thêm khách hàng
          </button>
        )}
      </div>

      <Card bodyClass="">
        <div className="toolbar">
          <div className="search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tên, số điện thoại, tỉnh thành, mã cũ…"
            />
          </div>
          <select className="select" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Tất cả giai đoạn</option>
            {CUSTOMER_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          {mode === 'admin' && (
            <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Tất cả nhân viên</option>
              <option value="UNASSIGNED">Chưa phân công</option>
              {(users.data ?? [])
                .filter((u) => u.role === 'EMPLOYEE')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name}
                  </option>
                ))}
            </select>
          )}
          <select className="select" value={quality} onChange={(e) => setQuality(e.target.value)}>
            <option value="">Mọi chất lượng dữ liệu</option>
            <option value="NEEDS_REVIEW">Cần kiểm tra dữ liệu</option>
            <option value="OK">Dữ liệu đủ</option>
          </select>
          <select
            className="select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            title="Sắp xếp danh sách"
          >
            <option value="follow_up">Sắp theo: lịch chăm sóc</option>
            <option value="name">Tên A → Z</option>
            <option value="name_desc">Tên Z → A</option>
            <option value="newest">Mới thêm trước</option>
            <option value="last_order">Đơn gần nhất</option>
            <option value="debt">Công nợ cao nhất</option>
            <option value="revenue">Doanh số cao nhất</option>
            <option value="province">Tỉnh/thành</option>
            <option value="tier">Cấp giá</option>
            <option value="stage">Giai đoạn</option>
            {mode === 'admin' && <option value="owner">Nhân viên phụ trách</option>}
          </select>
          <button
            className="btn"
            onClick={() => {
              setQ('');
              setStage('');
              setOwner('');
              setQuality('');
            }}
          >
            Đặt lại
          </button>
        </div>

        <StateBlock
          loading={customers.loading}
          error={customers.error}
          empty={(customers.data ?? []).length === 0}
          emptyText="Không tìm thấy khách hàng phù hợp."
        >
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Khu vực</th>
                  <th>Cấp giá</th>
                  <th>Giai đoạn</th>
                  {mode === 'admin' && <th>Sale phụ trách</th>}
                  <th className="right">Công nợ chính thức</th>
                  <th className="right">Dự kiến</th>
                  <th>Chăm sóc tiếp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(customers.data ?? []).map((customer) => {
                  const overdue =
                    customer.next_follow_up_at !== null && customer.next_follow_up_at < vnDate();
                  return (
                    <tr key={customer.id}>
                      <td>
                        <Link
                          to={`/${mode}/customers/${customer.id}`}
                          style={{ fontWeight: 700, color: 'var(--pink)' }}
                        >
                          {customer.name}
                        </Link>
                        <div className="muted">{formatPhone(customer.phone_text)}</div>
                        {customer.data_quality === 'NEEDS_REVIEW' && (
                          <span className="badge orange">Cần kiểm tra dữ liệu</span>
                        )}
                      </td>
                      <td>{customer.province ?? '—'}</td>
                      <td>
                        {customer.tier_name ?? (
                          <span className="badge red">{customer.legacy_tier_label ?? 'Chưa map cấp'}</span>
                        )}
                      </td>
                      <td>
                        <StageBadge stage={customer.stage} />
                      </td>
                      {mode === 'admin' && <td>{customer.owner_name ?? 'Chưa phân công'}</td>}
                      <td className="right nowrap">{formatVnd(customer.official_debt)}</td>
                      <td className="right nowrap">{formatVnd(customer.projected_debt)}</td>
                      <td className={overdue ? 'nowrap' : 'nowrap'} style={overdue ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                        {formatVnDate(customer.next_follow_up_at)}
                      </td>
                      <td>
                        <div className="actions">
                          <Link className="btn sm" to={`/${mode}/customers/${customer.id}`}>
                            Chi tiết
                          </Link>
                          {can('customer.reassign') && (
                            <button className="btn sm" onClick={() => setReassignTarget(customer)}>
                              Chuyển sale
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </Card>

      {showCreate && (
        <CreateCustomerModal
          tiers={tiers.data ?? []}
          users={(users.data ?? []).filter((u) => u.role === 'EMPLOYEE')}
          canChooseOwner={me?.user.role !== 'EMPLOYEE'}
          onClose={closeCreate}
          onSaved={() => {
            customers.reload();
            toast.success('Đã thêm khách hàng và tạo việc liên hệ đầu tiên');
          }}
        />
      )}

      {reassignTarget && (
        <ReassignModal
          customer={reassignTarget}
          users={(users.data ?? []).filter((u) => u.role === 'EMPLOYEE')}
          onClose={() => setReassignTarget(null)}
          onSaved={() => {
            customers.reload();
            toast.success('Đã chuyển khách và ghi nhật ký lý do');
          }}
        />
      )}
    </>
  );
}

function CreateCustomerModal({
  tiers,
  users,
  canChooseOwner,
  onClose,
  onSaved,
}: {
  tiers: PriceTier[];
  users: UserSummary[];
  canChooseOwner: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [idempotencyKey] = useState(newIdempotencyKey());
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone_text: '',
    province: '',
    address: '',
    tier_id: '',
    source: 'Facebook Ads',
    owner_id: '',
    next_follow_up_at: vnDate(),
    interested_products: '',
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFields({});
    setFormError(null);
    try {
      await api.post(
        '/api/customers',
        {
          ...form,
          tier_id: form.tier_id || null,
          owner_id: canChooseOwner ? form.owner_id || null : null,
          phone_text: form.phone_text || null,
        },
        idempotencyKey,
      );
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields ?? {});
        setFormError(err.message);
      } else setFormError('Không lưu được, vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Thêm khách hàng B2B"
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn primary" form="create-customer" type="submit" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu khách hàng'}
          </button>
        </>
      }
    >
      <form id="create-customer" onSubmit={submit}>
        <div className="modal-body">
          {formError && <div className="alert-box" style={{ marginBottom: 14 }}>{formError}</div>}
          <div className="form-grid">
            <Field label="Tên khách hàng / chủ cửa hàng *" error={fields.name}>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={Boolean(fields.name)}
              />
            </Field>
            <Field label="Số điện thoại" error={fields.phone_text} hint="Lưu dạng chữ, giữ số 0 đầu">
              <input
                value={form.phone_text}
                onChange={(e) => setForm({ ...form, phone_text: e.target.value })}
                inputMode="tel"
                aria-invalid={Boolean(fields.phone_text)}
              />
            </Field>
            <Field label="Tỉnh/thành" error={fields.province}>
              <input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
            </Field>
            <Field label="Địa chỉ" error={fields.address}>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Cấp giá" error={fields.tier_id} hint="Chưa chọn cấp thì chưa tạo được đơn">
              <select value={form.tier_id} onChange={(e) => setForm({ ...form, tier_id: e.target.value })}>
                <option value="">Chưa xác định</option>
                {tiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nguồn khách" error={fields.source}>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {['Facebook Ads', 'TikTok', 'Website', 'Giới thiệu', 'Hội chợ/Sự kiện', 'Khác'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            {canChooseOwner && (
              <Field label="Sale phụ trách" error={fields.owner_id}>
                <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
                  <option value="">Giao cho tôi</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.display_name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Ngày liên hệ đầu tiên" error={fields.next_follow_up_at}>
              <input
                type="date"
                value={form.next_follow_up_at}
                onChange={(e) => setForm({ ...form, next_follow_up_at: e.target.value })}
              />
            </Field>
            <Field label="Nhu cầu / sản phẩm quan tâm" error={fields.interested_products} full>
              <textarea
                value={form.interested_products}
                onChange={(e) => setForm({ ...form, interested_products: e.target.value })}
                placeholder="VD: có cửa hàng tại Hà Đông, quan tâm nước giặt và lau sàn"
              />
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ReassignModal({
  customer,
  users,
  onClose,
  onSaved,
}: {
  customer: CustomerListItem;
  users: UserSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ownerId, setOwnerId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFields({});
    setFormError(null);
    try {
      await api.post(`/api/customers/${customer.id}/reassign`, { owner_id: ownerId, reason });
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields ?? {});
        setFormError(err.message);
      } else setFormError('Không chuyển được khách.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Chuyển sale phụ trách · ${customer.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn primary" form="reassign-form" type="submit" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Xác nhận chuyển'}
          </button>
        </>
      }
    >
      <form id="reassign-form" onSubmit={submit}>
        <div className="modal-body">
          {formError && <div className="alert-box" style={{ marginBottom: 14 }}>{formError}</div>}
          <div className="form-grid">
            <Field label="Người nhận *" error={fields.owner_id}>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">Chọn nhân viên</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lý do chuyển *" error={fields.reason} full hint="Lý do được ghi vào nhật ký hệ thống">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  );
}
