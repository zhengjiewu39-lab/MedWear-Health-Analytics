import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, LinearProgress, Card, CardContent,
} from '@mui/material';
import { SelfImprovement, BatteryChargingFull, TrendingUp } from '@mui/icons-material';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { aiApi } from '../services/api';
import { STANDARDS } from '../constants/clinicalStandards';

function RecoveryStress() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi.getRecovery().then(res => { setData(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;
  if (!data) return null;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>恢复与压力分析</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        基于 HRV、睡眠、静息心率评估训练准备度与身体恢复状态
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #e8f5e9, #fff)', borderLeft: 4, borderColor: 'success.main' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <BatteryChargingFull sx={{ fontSize: 40, color: 'success.main' }} />
              <Typography variant="h3" fontWeight={800} color="success.main">{data.score}</Typography>
              <Typography variant="body2" color="text.secondary">恢复指数 / 100</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: 4, borderColor: 'info.main' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <SelfImprovement sx={{ fontSize: 40, color: 'info.main' }} />
              <Typography variant="h3" fontWeight={800} color="info.main">{data.stress.value}</Typography>
              <Typography variant="body2" color="text.secondary">压力指数 · {data.stress.level}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: 4, borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>训练准备度</Typography>
              <Typography variant="h4" fontWeight={700} color="primary.main">{data.readiness.score} 分</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{data.readiness.recommendation}</Typography>
              {data.readiness.factors.map(f => <Chip key={f} label={f} size="small" sx={{ mr: 0.5, mb: 0.5 }} color="success" variant="outlined" />)}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>7 日 HRV 趋势</Typography>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.hrvTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis domain={[30, 70]} />
                <Tooltip />
                <ReferenceLine y={data.hrvTrend[0]?.baseline} stroke="#EF6C00" strokeDasharray="5 5" label="个人基线" />
                <ReferenceLine y={STANDARDS.hrv.min} stroke="#ccc" strokeDasharray="3 3" />
                <ReferenceLine y={STANDARDS.hrv.max} stroke="#ccc" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="hrv" name="HRV(ms)" stroke="#6A1B9A" strokeWidth={2.5} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
            <Chip label={`正常范围 ${STANDARDS.hrv.min}-${STANDARDS.hrv.max} ms`} size="small" variant="outlined" />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>身体能量曲线</Typography>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.bodyBattery}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Area type="monotone" dataKey="level" name="能量(%)" stroke="#34C759" fill="rgba(52,199,89,0.2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TrendingUp color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>7 日压力趋势</Typography>
            </Box>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.stress.history.map((v, i) => ({ day: ['一', '二', '三', '四', '五', '六', '日'][i], stress: v }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis domain={[0, 50]} />
                <Tooltip />
                <ReferenceLine y={30} stroke="#EF6C00" strokeDasharray="5 5" label="警戒线" />
                <Area type="monotone" dataKey="stress" name="压力指数" stroke="#FF9500" fill="rgba(255,149,0,0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default RecoveryStress;
