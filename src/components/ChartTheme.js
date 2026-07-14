import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import ChartContainer from './ChartContainer';
import { CHART, AXIS, GRID, chartMargin, pctTick } from '../config/chartTheme';

/** Coerce rate (0–1) or percent to a finite chart value; never NaN. */
export function toChartPct(value, fallback = 0) {
  if (value == null || Number.isNaN(Number(value))) return fallback;
  const n = Number(value);
  return +(Math.min(100, Math.max(0, n <= 1 ? n * 100 : n))).toFixed(1);
}

export function ChartGradients({ idPrefix = 'chart' }) {
  return (
    <defs>
      <linearGradient id={`${idPrefix}-iv`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART.interventionMid} stopOpacity={1} />
        <stop offset="100%" stopColor={CHART.intervention} stopOpacity={1} />
      </linearGradient>
      <linearGradient id={`${idPrefix}-uc`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART.controlMid} stopOpacity={1} />
        <stop offset="100%" stopColor={CHART.control} stopOpacity={1} />
      </linearGradient>
      <linearGradient id={`${idPrefix}-area`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART.intervention} stopOpacity={0.35} />
        <stop offset="100%" stopColor={CHART.intervention} stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

export function MedWearTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <Paper
      elevation={0}
      sx={{
        px: 1.5,
        py: 1,
        bgcolor: CHART.tooltipBg,
        border: `1px solid ${CHART.tooltipBorder}`,
        borderRadius: 2,
        minWidth: 120,
      }}
    >
      {label != null && (
        <Typography variant="caption" sx={{ color: CHART.axisMuted, display: 'block', mb: 0.5, fontWeight: 600 }}>
          {labelFormatter ? labelFormatter(label) : label}
        </Typography>
      )}
      {payload.map((entry) => (
        <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color || entry.fill }} />
          <Typography variant="body2" sx={{ color: CHART.tooltipText, fontWeight: 600 }}>
            {entry.name}: {formatter ? formatter(entry.value, entry.name, entry)[0] : entry.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

export function CompareBarChart({
  data = [],
  ivKey,
  ucKey,
  height = 240,
  idPrefix = 'cmp',
  emptyLabel = '暂无图表数据',
}) {
  const rows = (data || [])
    .map((row) => ({
      ...row,
      [ivKey]: toChartPct(row[ivKey]),
      [ucKey]: toChartPct(row[ucKey]),
    }))
    .filter((row) => row.name != null);

  if (!rows.length) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          borderRadius: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">{emptyLabel}</Typography>
      </Box>
    );
  }

  return (
    <ChartContainer width="100%" height={height}>
      <BarChart data={rows} margin={chartMargin()}>
        <ChartGradients idPrefix={idPrefix} />
        <CartesianGrid {...GRID} />
        <XAxis dataKey="name" tick={AXIS.tickSmall} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS.tick} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={pctTick} />
        <Tooltip content={<MedWearTooltip formatter={(v) => [`${v}%`, '']} />} />
        <Bar
          dataKey={ivKey}
          fill={`url(#${idPrefix}-iv)`}
          stroke={CHART.intervention}
          strokeWidth={1.5}
          name={ivKey}
          radius={[8, 8, 0, 0]}
          maxBarSize={56}
          minPointSize={3}
        />
        <Bar
          dataKey={ucKey}
          fill={`url(#${idPrefix}-uc)`}
          stroke={CHART.control}
          strokeWidth={1.5}
          name={ucKey}
          radius={[8, 8, 0, 0]}
          maxBarSize={56}
          minPointSize={3}
        />
      </BarChart>
    </ChartContainer>
  );
}

export function CompareLegend({ ivLabel, ucLabel }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 1 }}>
      {[
        [CHART.intervention, ivLabel],
        [CHART.control, ucLabel],
      ].map(([color, label]) => (
        <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: color, boxShadow: `0 0 0 1px ${color}40` }} />
          <Typography variant="caption" color="text.primary" fontWeight={700}>{label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

export { CHART, AXIS, GRID };
