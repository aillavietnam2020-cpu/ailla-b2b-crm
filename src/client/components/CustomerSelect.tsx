import { useEffect, useMemo, useRef, useState } from 'react';

export interface CustomerOption {
  id: string;
  name: string;
  hint?: string;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

/**
 * Ô chọn khách có gõ tên để lọc (không dấu cũng được). Thay cho ô chọn thả xuống dài khi có hàng trăm khách.
 * `emptyLabel` có giá trị thì thêm lựa chọn "bỏ chọn" (ví dụ "Tất cả khách").
 */
export function CustomerSelect({
  value,
  options,
  onChange,
  placeholder = 'Gõ tên khách để tìm…',
  emptyLabel,
  disabled,
  title,
}: {
  value: string;
  options: CustomerOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  title?: string;
}) {
  const current = options.find((o) => o.id === value);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(current ? current.name : '');
  }, [current?.id, current?.name]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false);
        setText(current ? current.name : '');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [current]);

  const shown = useMemo(() => {
    const q = fold(text.trim());
    const words = q && !(current && text === current.name) ? q.split(/\s+/) : [];
    return options.filter((o) => words.every((w) => fold(o.name).includes(w))).slice(0, 60);
  }, [text, options, current]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={box} style={{ position: 'relative' }} title={title}>
      <input
        value={text}
        disabled={disabled}
        placeholder={emptyLabel && !value ? emptyLabel : placeholder}
        onFocus={(e) => {
          setOpen(true);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && open && shown.length) {
            e.preventDefault();
            pick(shown[0].id);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            zIndex: 30,
            left: 0,
            right: 0,
            top: '100%',
            maxHeight: 280,
            overflowY: 'auto',
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #d0d5dd)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          }}
        >
          {emptyLabel && (
            <button type="button" style={rowStyle} onMouseDown={() => pick('')}>
              {emptyLabel}
            </button>
          )}
          {shown.map((o) => (
            <button
              key={o.id}
              type="button"
              style={{ ...rowStyle, fontWeight: o.id === value ? 600 : 400 }}
              onMouseDown={() => pick(o.id)}
            >
              {o.name}
              {o.hint ? <small className="muted"> · {o.hint}</small> : null}
            </button>
          ))}
          {!shown.length && (
            <div style={{ padding: '8px 12px' }} className="muted">
              Không có khách nào khớp.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 12px',
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  color: 'inherit',
};
