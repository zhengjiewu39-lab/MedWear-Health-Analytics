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
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart,
} from 'recharts';
import { dashboardApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';
import { useDataMode } from '../contexts/DataModeContext';
import { ActivityRing, ScoreRing } from '../components/charts/VitalGauge';
import PageHeader from '../components/PageHeader';
import { STANDARDS } from '../constants/clinicalStandards';

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
    }).finally(() => setLoading(false));
  };

  useModeRefresh(fetchAll);

  if (loading) return <LinearProgress />;
  if (!stats) return null;
  if (isReal && stats.hasData === false) return null;

  const radarData = organScores.map(o => ({ subject: o.name, score: o.score, fullMark: 100 }));
  const subtitle = isDemo
    ? `${profile?.name} · ${profile?.age}岁${profile?.gender} · ${profile?.device} · 演示模拟数据`
    : `${profile?.name} · ${profile?.device} · Apple Health 真实数据 · ${profile?.dayCount || 0} 天`;

  return (
    <Box>
      <PageHeader
        title="健康总览"
        subtitle={subtitle}
        badge={
          <Chip
            icon={<Psychology />}
            label={isReal ? '真实数据分析' : '演示 AI 分析'}
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
            <Chip label={`等级 ${stats.healthGrade}`} color="success" size="small" sx={{ mt: 1 }} />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-around' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">恢复指数</Typography>
                <Typography variant="h6" fontWeight={700} color="primary.main">{stats.recoveryScore}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">压力</Typography>
                <Typography variant="h6" fontWeight={700} color="success.main">{stats.stressLevel}</Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>今日活动目标</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', py: 1 }}>
              <ActivityRing label="步数" value={stats.steps} target={stats.stepsTarget} color="#FF2D55" size={90} />
              <ActivityRing label="卡路里" value={stats.activeCalories} target={stats.activeCaloriesTarget} color="#FF9500" size={90} />
              <ActivityRing label="运动" value={stats.exerciseMinutes} target={30} color="#34C759" size={90} />
              <ActivityRing label="站立" value={stats.standHours} target={12} color="#007AFF" size={90} />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>核心生命体征</Typography>
            {[
              { label: '心率', value: stats.heartRate, unit: 'bpm', range: '60-100', icon: <Favorite color="error" />, ok: stats.heartRate >= 60 && stats.heartRate <= 100 },
              { label: '静息心率', value: stats.restingHR, unit: 'bpm', range: '60-80', ok: stats.restingHR >= 60 && stats.restingHR <= 80 },
              { label: '血氧', value: stats.spo2, unit: '%', range: '95-100', icon: <Air color="info" />, ok: stats.spo2 >= 95 },
              { label: 'HRV', value: stats.hrv, unit: 'ms', range: '20-70', icon: <MonitorHeart color="secondary" />, ok: stats.hrv >= 20 && stats.hrv <= 70 },
            ].map(v => (
              <Box key={v.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.8, borderBottom: '1px solid #f0f0f0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {v.icon}
                  <Typography variant="body2">{v.label}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" fontWeight={700}>{v.value} {v.unit}</Typography>
                  <Chip label={v.ok ? '正常' : '注意'} size="small" color={v.ok ? 'success' : 'warning'} sx={{ height: 20, fontSize: '0.65rem' }} />
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
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>24 小时生命体征趋势</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={vitalsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={3} />
                <YAxis yAxisId="hr" domain={[50, 120]} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="spo2" orientation="right" domain={[93, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Legend />
                <Area yAxisId="hr" type="monotone" dataKey="heartRate" name="心率(bpm)" stroke="#E53935" fill="rgba(229,57,53,0.1)" strokeWidth={2} />
                <Line yAxisId="spo2" type="monotone" dataKey="bloodOxygen" name="血氧(%)" stroke="#00838F" strokeWidth={2} dot={false} />
                <Line yAxisId="hr" type="monotone" dataKey="hrv" name="HRV(ms)" stroke="#6A1B9A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip label={`参考: 心率 ${STANDARDS.heartRate.min}-${STANDARDS.heartRate.max}`} size="small" variant="outlined" />
              <Chip label={`血氧 ≥ ${STANDARDS.spo2.min}%`} size="small" variant="outlined" />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>六维健康雷达</Typography>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e0e0e0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} />
                <Radar name="健康指数" dataKey="score" stroke="#1565C0" fill="#1565C0" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* 第三行：周趋势 + 心率区间 + AI洞察 */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>7 日健康趋势</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekTrend} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Legend />
                <Bar yAxisId="left" dataKey="steps" name="步数" fill="#1565C0" radius={[4, 4, 0, 0]} opacity={0.8} />
                <Line yAxisId="right" type="monotone" dataKey="score" name="健康分" stroke="#2E7D32" strokeWidth={2.5} dot={{ r: 4 }} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>心率区间分布</Typography>
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
              <Typography variant="subtitle1" fontWeight={600}>AI 健康洞察</Typography>
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
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>月度健康评分趋势</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={healthTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" />
                <YAxis domain={[60, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="score" name="综合评分" stroke="#1565C0" fill="rgba(21,101,192,0.15)" strokeWidth={2} />
                <Area type="monotone" dataKey="cardio" name="心血管" stroke="#E53935" fill="rgba(229,57,53,0.05)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="sleep" name="睡眠" stroke="#6A1B9A" fill="rgba(106,27,154,0.05)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
