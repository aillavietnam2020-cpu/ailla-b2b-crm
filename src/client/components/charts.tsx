import React from 'react';

/**
 * Biểu đồ vẽ bằng SVG ngay trong ứng dụng - không tải thư viện ngoài, đúng chính sách bảo mật
 * (CSP chặn script từ bên ngoài) và không làm nặng trang.
 */

export const CHART_COLORS = [
  '#e7357b',
  '#2e90fa',
  '#12b76a',
  '#f79009',
  '#6941c6',
  '#0ba5ec',
  '#ee46bc',
  '#4e5ba6',
  '#dd2590',
  '#66c61c',
];

/** Thẻ số liệu lớn, có dải màu bên trái để mắt bắt nhanh. */
export function StatCard({
  label,
  value,
  hint,
  color = CHART_COLORS[0],
  trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  color?: string;
  trend?: { text: string; good?: boolean };
}) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {hint && <div className="stat-card-hint">{hint}</div>}
      {trend && (
        <div className={`stat-card-trend ${trend.good === false ? 'bad' : 'good'}`}>{trend.text}</div>
      )}
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  sublabel?: string;
  color?: string;
}

/** Biểu đồ cột ngang: dễ đọc nhất khi tên hạng mục dài (tên người, tên nhóm sản phẩm). */
export function BarChart({
  data,
  format,
  max,
}: {
  data: BarDatum[];
  format: (value: number) => string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bar-chart">
      {data.map((item, index) => (
        <div className="bar-row" key={item.label}>
          <div className="bar-label">
            <span>{item.label}</span>
            {item.sublabel && <small>{item.sublabel}</small>}
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${Math.max(1.5, (item.value / top) * 100)}%`,
                background: item.color ?? CHART_COLORS[index % CHART_COLORS.length],
              }}
            />
          </div>
          <div className="bar-value">{format(item.value)}</div>
        </div>
      ))}
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
}

/** Biểu đồ tròn thể hiện tỷ trọng: dùng cho cơ cấu doanh thu theo nhóm sản phẩm. */
export function DonutChart({
  slices,
  format,
  centerLabel,
}: {
  slices: DonutSlice[];
  format: (value: number) => string;
  centerLabel?: string;
}) {
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 180 180" className="donut" role="img" aria-label="Cơ cấu doanh thu">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#eef1f4" strokeWidth="26" />
        {total > 0 &&
          slices.map((slice, index) => {
            const portion = slice.value / total;
            const dash = portion * circumference;
            const element = (
              <circle
                key={slice.label}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth="26"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 90 90)"
              />
            );
            offset += dash;
            return element;
          })}
        <text x="90" y="86" textAnchor="middle" className="donut-total">
          {format(total)}
        </text>
        {centerLabel && (
          <text x="90" y="104" textAnchor="middle" className="donut-caption">
            {centerLabel}
          </text>
        )}
      </svg>

      <div className="donut-legend">
        {slices.map((slice, index) => (
          <div className="legend-row" key={slice.label}>
            <span className="legend-dot" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
            <span className="legend-label">{slice.label}</span>
            <span className="legend-value">
              {total ? Math.round((slice.value / total) * 1000) / 10 : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Phễu khách hàng: các bậc thu hẹp dần theo số lượng khách. */
export function FunnelChart({ steps }: { steps: Array<{ label: string; value: number; hint?: string }> }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="funnel">
      {steps.map((step, index) => (
        <div className="funnel-step" key={step.label}>
          <div className="funnel-label">{step.label}</div>
          <div className="funnel-bar-wrap">
            <div
              className="funnel-bar"
              style={{
                width: `${Math.max(6, (step.value / max) * 100)}%`,
                background: CHART_COLORS[index % CHART_COLORS.length],
              }}
            >
              {step.value}
            </div>
          </div>
          {step.hint && <div className="funnel-hint">{step.hint}</div>}
        </div>
      ))}
    </div>
  );
}
