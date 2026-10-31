// Small SVG charts, drawn on the server. Single series, so no legend: the card title names it.
// Bars are ≤24px with 4px rounded tops. As in the client's prototype, past months use a light tint
// and the running month the full colour, with "(so far)" in its tooltip so it never reads as a
// complete month. Every mark has a hover tooltip and every chart a table twin.

const W = 600;
const PAD = { t: 18, r: 8, b: 26, l: 40 };
const INK_SOFT = '#7b6a5a', RULE = '#e6d8c3', MARK = '#d9661a', SURFACE = '#fbf6ee';

function niceTicks(min: number, max: number, count = 3) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

export interface Column { label: string; value: number | null; partial?: boolean; tip?: string }

export function ColumnChart({ data, format, height = 200, title, color = MARK, tint, labelAll = false }: {
  data: Column[]; format: (v: number) => string; height?: number; title: string;
  color?: string; tint?: string; labelAll?: boolean;
}) {
  const vals = data.map((d) => d.value ?? 0);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(1, ...vals));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const H = height, ih = H - PAD.t - PAD.b, iw = W - PAD.l - PAD.r;
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;
  const band = iw / data.length;
  const bw = Math.min(24, band - 2);
  const maxI = vals.indexOf(Math.max(...vals));

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={RULE} strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={INK_SOFT} className="tnum">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d.value;
          const cx = PAD.l + band * i + band / 2;
          const top = v === null ? y(0) : Math.min(y(v), y(0));
          const h = v === null ? 0 : Math.max(1, Math.abs(y(v) - y(0)));
          const r = Math.min(4, h / 2, bw / 2);
          // 4px rounded data-end, square at the baseline (flipped for negative bars)
          const neg = (v ?? 0) < 0;
          const path = neg
            ? `M${cx - bw / 2},${top} h${bw} v${h - r} q0,${r} ${-r},${r} h${-(bw - 2 * r)} q${-r},0 ${-r},${-r} z`
            : `M${cx - bw / 2},${top + h} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z`;
          const showValue = v !== null && (labelAll || d.partial || i === maxI || i === data.length - 1);
          return (
            <g key={d.label}>
              <title>{d.tip ?? `${d.label}: ${v === null ? 'no data' : format(v)}${d.partial ? ' (so far)' : ''}`}</title>
              <rect x={cx - band / 2} y={PAD.t} width={band} height={ih} fill="transparent" />
              {v !== null && <path d={path} fill={tint && !d.partial ? tint : color} />}
              {showValue && (
                <text x={cx} y={neg ? top + h + 13 : top - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#2b2119" className="tnum">
                  {format(v!)}
                </text>
              )}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill={INK_SOFT}>{d.label}</text>
            </g>
          );
        })}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke={INK_SOFT} strokeWidth="1" />
      </svg>
      {data.some((d) => d.partial) && (
        <figcaption className="text-xs text-ink-soft mt-1">The current month is so far, not complete.</figcaption>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>{data.map((d) => <tr key={d.label}><th>{d.label}{d.partial ? ' (so far)' : ''}</th><td>{d.value === null ? '–' : format(d.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export function LineChart({ points, format, height = 220, title }: {
  points: { day: string; value: number }[]; format: (v: number) => string; height?: number; title: string;
}) {
  if (points.length < 2) {
    return <p className="text-sm text-ink-soft py-8 text-center">Not enough daily counts yet: the chart starts after two scrapes.</p>;
  }
  const H = height, ih = H - PAD.t - PAD.b, iw = W - PAD.l - PAD.r - 30;
  const vals = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const t0 = Date.parse(points[0].day), t1 = Date.parse(points[points.length - 1].day);
  const x = (d: string) => PAD.l + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * iw;
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={PAD.l + iw} y1={y(t)} y2={y(t)} stroke={RULE} strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={INK_SOFT} className="tnum">{format(t)}</text>
          </g>
        ))}
        <path d={`${line} L${x(last.day)},${y(lo)} L${PAD.l},${y(lo)} z`} fill={MARK} opacity="0.1" />
        <path d={line} fill="none" stroke={MARK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p) => (
          <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r="7" fill="transparent">
            <title>{`${dayLabel(p.day)}: ${format(p.value)}`}</title>
          </circle>
        ))}
        <circle cx={x(last.day)} cy={y(last.value)} r="4.5" fill={MARK} stroke={SURFACE} strokeWidth="2" />
        <text x={x(last.day) + 8} y={y(last.value) + 4} fontSize="11" fontWeight="700" fill="#2b2119" className="tnum">{format(last.value)}</text>
        <text x={PAD.l} y={H - 8} fontSize="11" fill={INK_SOFT}>{dayLabel(points[0].day)}</text>
        <text x={PAD.l + iw} y={H - 8} textAnchor="end" fontSize="11" fill={INK_SOFT}>{dayLabel(last.day)}</text>
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>{points.map((p) => <tr key={p.day}><th>{p.day}</th><td>{format(p.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
