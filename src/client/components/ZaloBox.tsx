/**
 * Zalo trong CRM, đợt 1 (chị Hoa duyệt demo 27/11/2026): khung "Tin Zalo" trong hồ sơ khách kênh phân phối.
 * Tin chỉ gửi khi người bấm Gửi; gõ "/" để chọn tin mẫu. Máy chủ lọc quyền (sale chỉ thấy nick của mình,
 * Lead / CEO thấy nội dung tin khách đã thu hồi). Hộp tin đầy đủ nằm ở Kinh doanh › Zalo › Hộp tin Zalo.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ApiError, api, apiFetch } from '../lib/api';

export interface ZaloMsg {
  id: string;
  from_me: number;
  sender_name: string;
  kind: string;
  text: string;
  url: string;
  at: string;
  recalled: boolean;
  seen_at: string | null;
  sent_by_name?: string | null;
  nick_name?: string;
  quote_text?: string;
  quote_name?: string;
}
export interface ZaloConv {
  id: string;
  nick_id: string;
  nick_name: string;
  nick_status: string;
  owner_id: string | null;
  unread: number;
  waiting_since: string | null;
  last_at: string | null;
}
export interface ZaloDay {
  day: string;
  nick: string;
  in: number;
  out: number;
  last_in: string;
  last_out: string;
  last_at: string;
}
export interface ZaloThread {
  convs: ZaloConv[];
  msgs: ZaloMsg[];
  days: ZaloDay[];
  nicks: Array<{ id: string; name: string; status: string }>;
  lead: boolean;
}
export interface ZaloStatusRow {
  key: string;
  wait_since: string | null;
  unread: number;
  last_at: string | null;
  last_from_me: number;
  nick_name: string;
}

export const zaloAgo = (t: string | null) => {
  if (!t) return '';
  const m = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 60000));
  return m < 60 ? `${m} phút` : m < 1440 ? `${Math.floor(m / 60)} giờ` : `${Math.floor(m / 1440)} ngày`;
};
const hm = (t: string | null) => {
  if (!t) return '';
  const d = new Date(t);
  const same = d.toDateString() === new Date().toDateString();
  return (same ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ') + d.toTimeString().slice(0, 5);
};
const TAG: Record<string, string> = { image: '[Ảnh]', file: '[Tệp]', sticker: '[Nhãn dán]', voice: '[Tin thoại]', video: '[Video]', link: '[Liên kết]', other: '[Tin]' };

/** Mở Hộp tin Zalo của web vận hành ở đúng hội thoại (trang này thường nằm trong khung nhúng). */
export function openZaloInbox(convId: string) {
  if (window.self !== window.top) window.parent.postMessage({ zlOpen: convId }, window.location.origin);
  else window.location.href = '/hub#go=zl_inbox';
}

/** Tình trạng Zalo theo khách (cột Zalo ở danh sách khách). Lỗi / không có quyền thì trả về rỗng. */
export function useZaloStatus(): Record<string, ZaloStatusRow> {
  const [map, setMap] = useState<Record<string, ZaloStatusRow>>({});
  useEffect(() => {
    let off = false;
    const load = () =>
      apiFetch<{ rows: ZaloStatusRow[] }>('/api/zalo/status/customers')
        .then((r) => {
          if (!off) setMap(Object.fromEntries(r.data.rows.map((x) => [x.key, x])));
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      off = true;
      clearInterval(t);
    };
  }, []);
  return map;
}

export function ZaloCell({ s }: { s?: ZaloStatusRow }) {
  if (!s) return <span className="muted">—</span>;
  if (s.wait_since)
    return (
      <span className="zl-pill red" title={`Nick ${s.nick_name}`}>
        <span className="zl-dot">Z</span>Chờ {zaloAgo(s.wait_since)}
      </span>
    );
  return (
    <span className="zl-cell" title={`Nick ${s.nick_name}`}>
      <span className="zl-dot">Z</span>
      <span className="muted">{s.last_from_me ? 'Đã trả lời' : 'Đã xem'} {hm(s.last_at)}</span>
    </span>
  );
}

function Body({ m }: { m: ZaloMsg }) {
  if (m.kind === 'sticker' && m.url) return <img className="zl-st" src={m.url} alt="Nhãn dán" loading="lazy" referrerPolicy="no-referrer" />;
  if (m.kind === 'voice' && m.url) return <audio controls preload="none" src={m.url} />;
  if (m.kind === 'image' && m.url)
    return (
      <>
        <a href={m.url} target="_blank" rel="noopener noreferrer">
          <img src={m.url} alt="Ảnh" loading="lazy" referrerPolicy="no-referrer" />
        </a>
        {m.text && <div>{m.text}</div>}
      </>
    );
  if (m.kind !== 'text' && m.url)
    return (
      <a href={m.url} target="_blank" rel="noopener noreferrer">
        {m.text || TAG[m.kind] || 'Tệp'}
      </a>
    );
  if (m.kind !== 'text')
    return (
      <>
        <i>{TAG[m.kind] ?? '[Tin]'}</i> {m.text}
      </>
    );
  return <>{m.text}</>;
}

function Bubble({ m, lead, many }: { m: ZaloMsg; lead: boolean; many: boolean }) {
  const meta = [hm(m.at), many && m.nick_name, m.from_me && m.sent_by_name, m.from_me && m.seen_at && 'đã xem'].filter(Boolean).join(' · ');
  if (m.recalled && !lead)
    return (
      <div className={`zl-m${m.from_me ? ' me' : ''}`}>
        <i className="muted">Tin đã thu hồi</i>
        <div className="t">{hm(m.at)}</div>
      </div>
    );
  return (
    <div className={`zl-m${m.from_me ? ' me' : ''}${m.recalled ? ' rc' : ''}`}>
      {m.quote_text && (
        <div className="zl-q">
          <b>{m.quote_name || (m.from_me ? 'Khách' : 'AILLA')}</b>
          {m.quote_text}
        </div>
      )}
      <div className="body">
        <Body m={m} />
      </div>
      <div className="t">
        {meta}
        {m.recalled && <span className="zl-pill red"> {m.from_me ? 'đã thu hồi' : 'khách đã thu hồi'}</span>}
      </div>
    </div>
  );
}

export interface ZaloBoxHandle {
  focus: () => void;
}

/** Khung Tin Zalo của một khách: tin gộp mọi nick người xem thấy, ô nhắn có tin mẫu "/". */
export const ZaloCustomerBox = forwardRef<ZaloBoxHandle, { customerId: string; phone: string | null; onData?: (t: ZaloThread) => void }>(
  function ZaloCustomerBox({ customerId, phone, onData }, ref) {
    const [data, setData] = useState<ZaloThread | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [via, setVia] = useState('');
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState<string[]>([]);
    const [tpl, setTpl] = useState<Array<{ code: string; text: string }> | null>(null);
    const [sel, setSel] = useState(0);
    const inp = useRef<HTMLTextAreaElement>(null);
    const box = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => ({ focus: () => inp.current?.focus() }));

    const load = useCallback(() => {
      apiFetch<ZaloThread>(`/api/zalo/thread?customer_id=${encodeURIComponent(customerId)}`)
        .then((r) => {
          setData(r.data);
          onData?.(r.data);
          setErr(null);
        })
        .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Không tải được tin Zalo'));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId]);
    useEffect(() => {
      load();
      const t = setInterval(() => !document.hidden && load(), 20_000);
      return () => clearInterval(t);
    }, [load]);
    useEffect(() => {
      if (box.current) box.current.scrollTop = box.current.scrollHeight;
    }, [data, pending]);

    if (err) return <p className="muted">{err}</p>;
    if (!data) return <p className="muted">Đang tải tin Zalo…</p>;

    const convs = data.convs;
    const myOn = data.nicks.filter((n) => n.status === 'ON');
    const many = convs.length > 1;
    const options = convs.length ? convs.map((c) => ({ v: 'c:' + c.id, t: c.nick_name })) : myOn.map((n) => ({ v: 'n:' + n.id, t: n.name }));
    const canSend = convs.length ? true : myOn.length > 0 && !!phone;
    const slash = text.startsWith('/') && !text.includes('\n');
    const key = slash ? text.slice(1).split(' ')[0]!.toLowerCase() : '';
    const list = slash && tpl ? tpl.filter((x) => x.code.startsWith(key)) : [];

    const onChange = (v: string) => {
      setText(v);
      setSel(0);
      if (v.startsWith('/') && !tpl)
        apiFetch<Array<{ code: string; text: string }>>('/api/zalo/templates')
          .then((r) => setTpl(r.data))
          .catch(() => setTpl([]));
    };
    const waitCmd = (id: string, txt: string) => {
      let n = 0;
      const go = async () => {
        n++;
        try {
          const r = await apiFetch<{ status: string; error: string | null }>(`/api/zalo/cmds/${id}`);
          if (r.data.status === 'DONE' || r.data.status === 'FAILED') {
            setPending((p) => p.filter((x) => x !== txt));
            if (r.data.status === 'FAILED') window.alert('Tin Zalo chưa gửi được: ' + (r.data.error ?? ''));
            load();
            return;
          }
        } catch {
          /* hỏi lại */
        }
        if (n < 30) setTimeout(go, 2000);
        else setPending((p) => p.filter((x) => x !== txt));
      };
      setTimeout(go, 1500);
    };
    const send = async () => {
      const v = text.trim();
      if (!v || busy) return;
      const target = via || options[0]?.v || '';
      setBusy(true);
      try {
        const r = target.startsWith('c:')
          ? await api.post<{ id: string }>(`/api/zalo/convs/${target.slice(2)}/send`, { text: v })
          : await api.post<{ id: string }>('/api/zalo/send-new', { nick_id: target.slice(2), phone, text: v, customer_id: customerId });
        setText('');
        setPending((p) => [...p, v]);
        waitCmd(r.data.id, v);
      } catch (e) {
        window.alert(e instanceof ApiError ? e.message : 'Chưa gửi được');
      } finally {
        setBusy(false);
      }
    };
    const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (list.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        setSel((s) => (s + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length);
        return;
      }
      if (list.length && (e.key === 'Enter' || e.key === 'Tab')) {
        e.preventDefault();
        setText(list[sel]!.text);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void send();
      }
    };
    const wait = convs.find((c) => c.waiting_since);

    return (
      <div className="zl-box">
        <div className="zl-hd">
          {convs.map((c) => (
            <span className="zl-pill vio" key={c.id}>
              {c.nick_name}
            </span>
          ))}
          {wait && <span className="zl-pill red">Chờ {zaloAgo(wait.waiting_since)}</span>}
          <span style={{ flex: 1 }} />
          {convs[0] && (
            <button className="btn sm" type="button" onClick={() => openZaloInbox(convs[0]!.id)}>
              Mở trong Hộp tin
            </button>
          )}
        </div>
        <div className="zl-msgs" ref={box}>
          {data.msgs.length ? (
            data.msgs.map((m) => <Bubble key={m.id} m={m} lead={data.lead} many={many} />)
          ) : (
            <div className="zl-empty">
              {myOn.length
                ? `Chưa nhắn Zalo với khách này. Gõ tin bên dưới, máy tìm Zalo theo số ${phone ?? ''} rồi gửi.`
                : 'Chưa nhắn Zalo với khách này. Bạn chưa có nick Zalo đang chạy (xem Kinh doanh › Zalo › Nick Zalo).'}
            </div>
          )}
          {pending.map((p, i) => (
            <div className="zl-m me pend" key={'p' + i}>
              {p}
              <div className="t">Đang gửi…</div>
            </div>
          ))}
        </div>
        {canSend && (
          <div className="zl-comp">
            {slash && (
              <div className="zl-tpl">
                {list.length ? (
                  list.map((x, i) => (
                    <button
                      type="button"
                      key={x.code}
                      className={i === sel ? 'on' : ''}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setText(x.text);
                        inp.current?.focus();
                      }}
                    >
                      <b>/{x.code}</b> — {x.text.slice(0, 90)}
                    </button>
                  ))
                ) : (
                  <div className="muted" style={{ padding: '6px 8px' }}>
                    {tpl === null ? 'Đang tải tin mẫu…' : tpl.length ? 'Không có tin mẫu này.' : 'Chưa có tin mẫu. Lead / CEO thêm ở Nick Zalo.'}
                  </div>
                )}
              </div>
            )}
            {options.length > 1 && (
              <select className="select" value={via || options[0]!.v} onChange={(e) => setVia(e.target.value)} title="Gửi qua nick">
                {options.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.t}
                  </option>
                ))}
              </select>
            )}
            <textarea
              ref={inp}
              rows={1}
              value={text}
              placeholder="Nhắn Zalo… gõ / để chọn tin mẫu"
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKey}
            />
            <button className="btn primary" type="button" disabled={busy || !text.trim()} onClick={() => void send()}>
              Gửi
            </button>
          </div>
        )}
      </div>
    );
  },
);
