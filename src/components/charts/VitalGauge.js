import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { getStatus, getStatusColor, getStatusLabel } from '../../constants/clinicalStandards';

export function VitalGauge({ label, value, unit, min, max, optimal, size = 'medium' }) {
  const status = getStatus(value, min, max);
  const color = getStatusColor(status);
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 50;

  return (
    <Box sx={{ textAlign: 'center', p: 1 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant={size === 'large' ? 'h3' : 'h5'} fontWeight={700} color={`${color}.main`} sx={{ my: 0.5 }}>
        {value ?? '—'}<Typography component="span" variant="body2" color="text.secondary"> {unit}</Typography>
      </Typography>
      <LinearProgress variant="determinate" value={pct} color={color} sx={{ height: 6, borderRadius: 3, mb: 0.5 }} />
      <Typography variant="caption" color={`${color}.main`}>{getStatusLabel(status)} · 参考 {min}-{max}</Typography>
    </Box>
  );
}

export function ActivityRing({ label, value, target, color, size = 80 }) {
  const pct = Math.min(100, (value / target) * 100);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ position: 'relative', width: size, height: size, mx: 'auto' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e0e0e0" strokeWidth={6} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" fontWeight={700}>{Math.round(pct)}%</Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{label}</Typography>
      <Typography variant="caption" fontWeight={600}>{value?.toLocaleString()} / {target?.toLocaleString()}</Typography>
    </Box>
  );
}

export function ScoreRing({ score, size = 120, label = '健康评分' }) {
  const color = score >= 80 ? '#2E7D32' : score >= 60 ? '#EF6C00' : '#C62828';
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ position: 'relative', width: size, height: size, mx: 'auto' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8edf2" strokeWidth={8} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h4" fontWeight={800} color={color}>{score}</Typography>
          <Typography variant="caption" color="text.secondary">分</Typography>
        </Box>
      </Box>
      <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>{label}</Typography>
    </Box>
  );
}
