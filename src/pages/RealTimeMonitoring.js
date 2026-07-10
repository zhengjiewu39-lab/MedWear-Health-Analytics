import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, LinearProgress,
} from '@mui/material';
import {
  Favorite, Air, DirectionsWalk, LocalFireDepartment,
  MonitorHeart, TrendingUp, TrendingDown, TrendingFlat,
} from '@mui/icons-material';
import { LineChart, Line, YAxis, ReferenceLine } from 'recharts';
import ChartContainer from '../components/ChartContainer';
import { monitoringApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';
import { useDataMode } from '../contexts/DataModeContext';
import { VitalGauge } from '../components/charts/VitalGauge';
import { STANDARDS } from '../constants/clinicalStandards';
import { useLang } from '../contexts/LanguageContext';

const trendIcon = { up: <TrendingUp color="error" />, down: <TrendingDown color="success" />, stable: <TrendingFlat color="info" /> };

function VitalCard({ title, value, unit, icon, color, trend, history, standard }) {
  const chartData = history?.map((v, i) => ({ i, v })) || [];
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ color: `${color}.main` }}>{icon}</Box>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
          </Box>
          {trend && trendIcon[trend]}
        </Box>
        <Typography variant="h3" fontWeight={700} color={`${color}.main`}>
          {value ?? '—'}<Typography component="span" variant="h6" color="text.secondary"> {unit}</Typography>
        </Typography>
        {standard && <Chip label={`正常 ${standard}`} size="small" color="success" variant="outlined" sx={{ mt: 0.5 }} />}
        {chartData.length > 0 && (
          <ChartContainer width="100%" height={50} style={{ marginTop: 8 }}>
            <LineChart data={chartData}>
              <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
              <Line type="monotone" dataKey="v" stroke="#1565C0" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function normalizeVitals(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const num = (v, fallback) => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
  return {
    heartRate: {
      value: num(raw.heartRate?.value, 72),
      trend: raw.heartRate?.trend || 'stable',
      history: Array.isArray(raw.heartRate?.history) ? raw.heartRate.history : [],
    },
    bloodOxygen: {
      value: num(raw.bloodOxygen?.value, 98),
      trend: raw.bloodOxygen?.trend || 'stable',
      history: Array.isArray(raw.bloodOxygen?.history) ? raw.bloodOxygen.history : [],
    },
    hrv: {
      value: num(raw.hrv?.value, 52),
      trend: raw.hrv?.trend || 'stable',
      history: Array.isArray(raw.hrv?.history) ? raw.hrv.history : [],
    },
    temperature: { value: num(raw.temperature?.value, 36.5), trend: raw.temperature?.trend || 'normal' },
    respiratory: { value: num(raw.respiratory?.value, 16), trend: raw.respiratory?.trend || 'normal' },
    bloodPressure: {
      systolic: num(raw.bloodPressure?.systolic, 118),
      diastolic: num(raw.bloodPressure?.diastolic, 76),
      unit: raw.bloodPressure?.unit || 'mmHg',
    },
    glucose: { value: num(raw.glucose?.value, 5.2), unit: raw.glucose?.unit || 'mmol/L', trend: raw.glucose?.trend || 'normal' },
    steps: { value: num(raw.steps?.value, 0), target: num(raw.steps?.target, STANDARDS.steps.target) },
    calories: { value: num(raw.calories?.value, 0), target: num(raw.calories?.target, 500) },
  };
}

function RealTimeMonitoring() {
  const { t } = useLang();
  const [vitals, setVitals] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const { isReal } = useDataMode();

  const fetchVitals = useCallback(() => {
    monitoringApi.getVitals()
      .then(res => { setVitals(normalizeVitals(res.data)); setLastUpdate(new Date()); })
      .catch(() => {});
  }, []);

  useModeRefresh(fetchVitals);

  useEffect(() => {
    const t = setInterval(fetchVitals, 5000);
    return () => clearInterval(t);
  }, [fetchVitals]);

  if (!vitals) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t('实时信号监测（消费级代理信号）', 'Real-time Signal Monitoring (Proxy Signals)')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`消费级可穿戴代理信号：HR / SpO₂ / HRV / 皮温 / 步数 → 个体异常检测 · ${isReal ? 'Apple Health 真实数据' : '演示数据'} · 每 5 秒刷新`,
              `Consumer-grade wearable proxy signals: HR / SpO₂ / HRV / temp / steps → anomaly detection · ${isReal ? 'Apple Health real data' : 'Demo data'} · refresh every 5s`)}
          </Typography>
        </Box>
        <Chip label={`${t('更新', 'Updated')} ${lastUpdate.toLocaleTimeString()}`} color="primary" variant="outlined" className="live-indicator" />
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={6} sm={4} md={2.4}><VitalGauge label={t('心率', 'Heart rate')} value={vitals.heartRate.value} unit="bpm" min={STANDARDS.heartRate.min} max={STANDARDS.heartRate.max} /></Grid>
        <Grid item xs={6} sm={4} md={2.4}><VitalGauge label={t('血氧', 'SpO₂')} value={vitals.bloodOxygen.value} unit="%" min={STANDARDS.spo2.min} max={STANDARDS.spo2.max} /></Grid>
        <Grid item xs={6} sm={4} md={2.4}><VitalGauge label="HRV" value={vitals.hrv.value} unit="ms" min={STANDARDS.hrv.min} max={STANDARDS.hrv.max} /></Grid>
        <Grid item xs={6} sm={4} md={2.4}><VitalGauge label={t('体温', 'Temp')} value={vitals.temperature.value} unit="°C" min={STANDARDS.temperature.min} max={STANDARDS.temperature.max} /></Grid>
        <Grid item xs={6} sm={4} md={2.4}><VitalGauge label={t('呼吸率', 'Resp rate')} value={vitals.respiratory.value} unit={t('次/分', '/min')} min={STANDARDS.respiratory.min} max={STANDARDS.respiratory.max} /></Grid>

        <Grid item xs={12} sm={6} md={3}>
          <VitalCard title={t('心率', 'Heart rate')} value={vitals.heartRate.value} unit="bpm" icon={<Favorite />} color="error" trend={vitals.heartRate.trend} history={vitals.heartRate.history} standard="60-100" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalCard title={t('血氧', 'SpO₂')} value={vitals.bloodOxygen.value} unit="%" icon={<Air />} color="info" trend={vitals.bloodOxygen.trend} history={vitals.bloodOxygen.history} standard="95-100" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>{t('血压', 'Blood pressure')}</Typography>
            <Typography variant="h3" fontWeight={700} color="primary.main">{vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic}</Typography>
            <Typography variant="body2" color="text.secondary">{vitals.bloodPressure.unit}</Typography>
            <Chip label={`${t('正常', 'Normal')} 90-120/60-80`} size="small" color="success" variant="outlined" sx={{ mt: 1 }} />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>{t('空腹血糖', 'Fasting glucose')}</Typography>
            <Typography variant="h3" fontWeight={700} color="success.main">{vitals.glucose.value}</Typography>
            <Typography variant="body2" color="text.secondary">{vitals.glucose.unit}</Typography>
            <Chip label={`${t('正常', 'Normal')} 3.9-6.1`} size="small" color="success" variant="outlined" sx={{ mt: 1 }} />
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3 }}>
            <DirectionsWalk color="primary" sx={{ mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>{vitals.steps.value.toLocaleString()} {t('步', 'steps')}</Typography>
            <LinearProgress variant="determinate" value={Math.min(100, vitals.steps.value / vitals.steps.target * 100)} sx={{ mt: 2, height: 10, borderRadius: 5 }} />
            <Typography variant="caption" color="text.secondary">{t('目标', 'Target')} {vitals.steps.target.toLocaleString()} {t('步 (WHO 推荐 8000)', 'steps (WHO 8000)')}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3 }}>
            <LocalFireDepartment color="error" sx={{ mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>{vitals.calories.value} kcal</Typography>
            <LinearProgress variant="determinate" value={Math.min(100, vitals.calories.value / vitals.calories.target * 100)} color="warning" sx={{ mt: 2, height: 10, borderRadius: 5 }} />
            <Typography variant="caption" color="text.secondary">{t('活动消耗目标', 'Active-energy target')} {vitals.calories.target} kcal</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3 }}>
            <MonitorHeart color="secondary" sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary">{t('HRV 实时波形', 'HRV live waveform')}</Typography>
            <ChartContainer width="100%" height={80}>
              <LineChart data={(vitals.hrv.history.length ? vitals.hrv.history : vitals.heartRate.history).map((v, i) => ({ i, v }))}>
                <ReferenceLine y={STANDARDS.hrv.good} stroke="#EF6C00" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="v" stroke="#6A1B9A" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default RealTimeMonitoring;
