import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend, Cell, LabelList } from 'recharts';
import { format, parseISO } from 'date-fns';
import { CHART_COLORS, STATUS_META, PRIORITY_META } from '@/lib/utils';

const axis = { tick: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }, axisLine: false, tickLine: false };
const grid = <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />;

function Tip({ active, payload, label, fmtLabel, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-lg">
      {label != null && <p className="mb-1 font-medium">{fmtLabel ? fmtLabel(label) : label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload.fill }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto tabular font-medium">{p.value}{unit}</span>
        </p>
      ))}
    </div>
  );
}

const weekLabel = (d) => `Week of ${format(parseISO(d), 'd MMM')}`;
const monthLabel = (d) => format(parseISO(`${d}-01`), 'MMM yyyy');

/** Created vs completed per week — two series, legend plus fixed colours. */
export function WeeklyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        {grid}
        <XAxis dataKey="period" {...axis} tickFormatter={(d) => format(parseISO(d), 'd MMM')} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} content={<Tip fmtLabel={weekLabel} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="completed" name="Completed" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="created" name="Created" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        {grid}
        <XAxis dataKey="period" {...axis} tickFormatter={(d) => format(parseISO(`${d}-01`), 'MMM')} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip cursor={{ stroke: 'hsl(var(--border))' }} content={<Tip fmtLabel={monthLabel} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="completed" name="Completed" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }} />
        <Line type="monotone" dataKey="created" name="Created" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** On-time completion rate — one series, so no legend. */
export function OnTimeChart({ data }) {
  const rows = data.filter((d) => d.onTimeRate != null);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={rows} margin={{ top: 22, right: 16, left: -18, bottom: 0 }}>
        {grid}
        <XAxis dataKey="period" {...axis} tickFormatter={(d) => format(parseISO(`${d}-01`), 'MMM')} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow={false} {...axis} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<Tip fmtLabel={monthLabel} unit="%" />} />
        <Line type="monotone" dataKey="onTimeRate" name="Completed on time" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}>
          <LabelList dataKey="onTimeRate" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal magnitude bars, one hue; labels sit on the axis (identity is never colour). */
export function HBarChart({ data, labelKey = 'label', valueKey = 'value', height, unit = '', color = CHART_COLORS[0], name = 'Tasks' }) {
  const h = height || Math.max(120, data.length * 30 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey={labelKey} width={128} {...axis} tick={{ ...axis.tick, fill: 'hsl(var(--foreground))' }} />
        <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} content={<Tip unit={unit} />} />
        <Bar dataKey={valueKey} name={name} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d, i) => <Cell key={i} fill={d.fill || color} />)}
          <LabelList dataKey={valueKey} position="right" formatter={(v) => `${v}${unit}`} style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const statusRows = (rows = []) => rows.map((r) => ({ label: STATUS_META[r.key]?.label || r.key, value: r.count }));

/** Priority is ordinal severity: one hue ramp, darkest = most severe. */
const SEVERITY = { critical: '#7A3E06', high: '#C47A12', medium: '#D9A04E', low: '#E2C08A' };
export const priorityRows = (rows = []) =>
  ['critical', 'high', 'medium', 'low'].map((k) => ({ label: PRIORITY_META[k].label, value: rows.find((r) => r.key === k)?.count || 0, fill: SEVERITY[k] }));

/** Workload: open estimated hours vs weekly capacity, per person. */
export function WorkloadChart({ rows }) {
  const data = rows.map((r) => ({ label: r.user.name.replace(/^(Dr\.|Prof\.)\s*/, ''), open: r.openHours, capacity: r.capacityHours, util: r.utilization }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 52, left: 0, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={128} {...axis} tick={{ ...axis.tick, fill: 'hsl(var(--foreground))' }} />
        <Tooltip
          cursor={{ fill: 'hsl(var(--accent))' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-lg">
                <p className="mb-1 font-medium">{label}</p>
                <p className="tabular">{payload[0].payload.open}h open of {payload[0].payload.capacity}h weekly capacity</p>
                <p className="tabular text-muted-foreground">{payload[0].payload.util ?? 0}% utilised</p>
              </div>
            ) : null
          }
        />
        <Bar dataKey="open" name="Open hours" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d, i) => <Cell key={i} fill={d.util > 100 ? '#B4421F' : d.util > 80 ? CHART_COLORS[1] : CHART_COLORS[0]} />)}
          <LabelList dataKey="util" position="right" formatter={(v) => `${v ?? 0}%`} style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
