import React, { useState } from 'react';
import {
  Grid, Paper, Typography, Box, Chip, List, ListItem,
  ListItemIcon, ListItemText, LinearProgress,
} from '@mui/material';
import {
  Favorite, Air, Psychology, CheckCircle,
  Warning, Info, MonitorHeart,
} from '@mui/icons-material';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ComposedChart,
} from 'recharts';
import ChartContainer from '../components/ChartContainer';
import { dashboardApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';
import { useDataMode } from '../contexts/DataModeContext';
import { useLang } from '../contexts/LanguageContext';
import { ActivityRing, ScoreRing } from '../components/charts/VitalGauge';
import PageHeader from '../components/PageHeader';
import { STANDARDS } from '../constants/clinicalStandards';
import { CHART, GRID } from '../config/chartTheme';

const insightIcon = { positive: <CheckCircle color="success" />, warning: <Warning color="warning" />, info: <Info color="info" /> };

function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [vitalsTrend, setVitalsTrend] = useState([]);
  const [weekTrend, setWeekTrend] = useState([]);
  const [organScores, setOrganScores] = useState([]);
  const [healthTrend, setHealthTrend] = useState([]);
  const [hrZones, setHrZones] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isDemo, isReal } = useDataMode();
  const { t } = useLang();

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      dashboardApi.getProfile(),
      dashboardApi.getStats(),
      dashboardApi.getVitalsTrend(),
      dashboardApi.getWeekTrend(),
      dashboardApi.getOrganScores(),
      dashboardApi.getHealthScoreTrend(),
      dashboardApi.getHeartRateZones(),
      dashboardApi.getAiInsights(),
    ]).then(([p, s, v, w, o, h, z, i]) => {
      setProfile(p.data);
      setStats(s.data);
      setVitalsTrend(v.data);
      setWeekTrend(w.data);
      setOrganScores(o.data);
      setHealthTrend(h.data);
      setHrZones(z.data);
      setInsights(i.data);
    }).catch(() => {
      setStats(null);
    }).finally(() => setLoading(false));
  };

  useModeRefresh(fetchAll);

  if (loading) return <LinearProgress />;
  if (!stats) return null;
  if (isReal && stats.hasData === false) return null;

  const radarData = organScores.map(o => ({ subject: o.name, score: o.score, fullMark: 100 }));
  const subtitle = isDemo
    ? t(
      `${profile?.name} · ${profile?.age}岁${profile?.gender} · ${profile?.device} · 演示模拟数据`,
      `${profile?.name} · ${profile?.age} yrs · ${profile?.gender} · ${profile?.device} · Demo simulated data`,
    )
    : t(
      `${profile?.name} · ${profile?.device} · Apple Health 真实数据 · ${profile?.dayCount || 0} 天`,
      `${profile?.name} · ${profile?.device} · Apple Health real data · ${profile?.dayCount || 0} days`,
    );

  return (
    <Box>
      <PageHeader
        title={t('健康总览', 'Health Overview')}
        subtitle={subtitle}
        badge={
          <Chip
            icon={<Psychology />}
            label={isReal ? t('真实数据分析', 'Real Data Analysis') : t('演示 AI 分析', 'Demo AI Analysis')}
            color={isReal ? 'success' : 'primary'}
            variant="outlined"
            size="small"
          />
        }
      />

      {/* 第一行：评分 + 三环 + 核心指标 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
            <ScoreRing score={stats.healthScore} />
            <Chip label={t(`等级 ${stats.healthGrade}`, `Grade ${stats.healthGrade}`)} color="success" size="small" sx={{ mt: 1 }} />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-around' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">{t('恢复指数', 'Recovery Index')}</Typography>
                <Typography variant="h6" fontWeight={700} color="primary.main">{stats.recoveryScore}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">{t('压力', 'Stress')}</Typography>
                <Typography variant="h6" fontWeight={700} color="success.main">{stats.stressLevel}</Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{t('今日活动目标', "Today's Activity Goals")}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', py: 1 }}>
              <ActivityRing label={t('步数', 'Steps')} value={stats.steps} target={stats.stepsTarget} color="#FF2D55" size={90} />
              <ActivityRing label={t('卡路里', 'Calories')} value={stats.activeCalories} target={stats.activeCaloriesTarget} color="#FF9500" size={90} />
              <ActivityRing label={t('运动', 'Exercise')} value={stats.exerciseMinutes} target={30} color="#34C759" size={90} />
              <ActivityRing label={t('站立', 'Stand')} value={stats.standHours} target={12} color="#007AFF" size={90} />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{t('核心生命体征', 'Core Vital Signs')}</Typography>
            {[
              { label: t('心率', 'Heart Rate'), value: stats.heartRate, unit: 'bpm', range: '60-100', icon: <Favorite color="error" />, ok: stats.heartRate >= 60 && stats.heartRate <= 100 },
              { label: t('静息心率', 'Resting HR'), value: stats.restingHR, unit: 'bpm', range: '60-80', ok: stats.restingHR >= 60 && stats.restingHR <= 80 },
              { label: t('血氧', 'SpO₂'), value: stats.spo2, unit: '%', range: '95-100', icon: <Air color="info" />, ok: stats.spo2 >= 95 },
              { label: 'HRV', value: stats.hrv, unit: 'ms', range: '20-70', icon: <MonitorHeart color="secondary" />, ok: stats.hrv >= 20 && stats.hrv <= 70 },
            ].map(v => (
              <Box key={v.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.8, borderBottom: '1px solid #f0f0f0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {v.icon}
                  <Typography variant="body2">{v.label}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" fontWeight={700}>{v.value} {v.unit}</Typography>
                  <Chip label={v.ok ? t('正常', 'Normal') : t('注意', 'Attention')} size="small" color={v.ok ? 'success' : 'warning'} sx={{ height: 20, fontSize: '0.65rem' }} />
                </Box>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>

      {/* 第二行：24h 趋势 + 雷达图 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{t('24 小时生命体征趋势', '24-Hour Vital Signs Trend')}</Typography>
            <ChartContainer width="100%" height={300}>
              <ComposedChart data={vitalsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={3} />
                <YAxis yAxisId="hr" domain={[50, 120]} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="spo2" orientation="right" domain={[93, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Legend />
                <Area yAxisId="hr" type="monotone" dataKey="heartRate" name={t('心率(bpm)', 'Heart Rate (bpm)')} stroke={CHART.danger} fill={`${CHART.danger}18`} strokeWidth={2} />
                <Line yAxisId="spo2" type="monotone" dataKey="bloodOxygen" name={t('血氧(%)', 'SpO₂ (%)')} stroke={CHART.accent} strokeWidth={2} dot={false} />
                <Line yAxisId="hr" type="monotone" dataKey="hrv" name={t('HRV(ms)', 'HRV (ms)')} stroke={CHART.series[2]} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </ComposedChart>
            </ChartContainer>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip label={t(`参考: 心率 ${STANDARDS.heartRate.min}-${STANDARDS.heartRate.max}`, `Ref: HR ${STANDARDS.heartRate.min}-${STANDARDS.heartRate.max}`)} size="small" variant="outlined" />
              <Chip label={t(`血氧 ≥ ${STANDARDS.spo2.min}%`, `SpO₂ ≥ ${STANDARDS.spo2.min}%`)} size="small" variant="outlined" />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{t('六维健康雷达', 'Six-Dimension Health Radar')}</Typography>
            <ChartContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e0e0e0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} />
                <Radar name={t('健康指数', 'Health Index')} dataKey="score" stroke={CHART.intervention} fill={CHART.intervention} fillOpacity={0.22} strokeWidth={2} />
              </RadarChart>
            </ChartContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* 第三行：周趋势 + 心率区间 + AI洞察 */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{t('7 日健康趋势', '7-Day Health Trend')}</Typography>
            <ChartContainer width="100%" height={240}>
              <BarChart data={weekTrend} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Legend />
                <Bar yAxisId="left" dataKey="steps" name={t('步数', 'Steps')} fill={CHART.intervention} radius={[6, 6, 0, 0]} opacity={0.85} />
                <Line yAxisId="right" type="monotone" dataKey="score" name={t('健康分', 'Health Score')} stroke={CHART.positive} strokeWidth={2.5} dot={{ r: 4, fill: CHART.positive }} />
              </BarChart>
            </ChartContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{t('心率区间分布', 'Heart Rate Zone Distribution')}</Typography>
            {hrZones.map(z => (
              <Box key={z.zone} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                  <Typography variant="body2">{z.zone} <Typography component="span" variant="caption" color="text.secondary">({z.range})</Typography></Typography>
                  <Typography variant="body2" fontWeight={600}>{z.percent}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={z.percent} sx={{ height: 8, borderRadius: 4, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: z.color } }} />
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%', background: 'linear-gradient(135deg, #e3f2fd 0%, #fff 100%)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Psychology color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>{t('AI 健康洞察', 'AI Health Insights')}</Typography>
            </Box>
            <List dense disablePadding>
              {insights.map((ins, i) => (
                <ListItem key={i} alignItems="flex-start" sx={{ px: 0, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 28, mt: 0.3 }}>{insightIcon[ins.type]}</ListItemIcon>
                  <ListItemText primary={ins.text} primaryTypographyProps={{ variant: 'body2', lineHeight: 1.5 }} />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* 月度评分趋势 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{t('月度健康评分趋势', 'Monthly Health Score Trend')}</Typography>
            <ChartContainer width="100%" height={200}>
              <AreaChart data={healthTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" />
                <YAxis domain={[60, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="score" name={t('综合评分', 'Overall Score')} stroke={CHART.intervention} fill={`${CHART.intervention}22`} strokeWidth={2} />
                <Area type="monotone" dataKey="cardio" name={t('心血管', 'Cardiovascular')} stroke={CHART.danger} fill={`${CHART.danger}0d`} strokeWidth={1.5} />
                <Area type="monotone" dataKey="sleep" name={t('睡眠', 'Sleep')} stroke={CHART.series[2]} fill={`${CHART.series[2]}0d`} strokeWidth={1.5} />
              </AreaChart>
            </ChartContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
