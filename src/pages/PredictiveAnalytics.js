import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, LinearProgress,
  List, ListItem, ListItemIcon, ListItemText, Tabs, Tab, Alert,
} from '@mui/material';
import { Warning, CheckCircle, Psychology, TrendingUp, Science } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { aiApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';
import { useDataMode } from '../contexts/DataModeContext';

const HORIZON_LABEL = { short: '短期', medium: '中期', long: '长期' };
const LEVEL_LABEL = { low: '低风险', medium: '中风险', high: '高风险' };
const LEVEL_COLOR = { low: 'success', medium: 'warning', high: 'error' };

const CATEGORY_COLORS = {
  training: '#1565C0', sleep: '#6A1B9A', cardio: '#C62828', metabolic: '#EF6C00',
  infection: '#00838F', respiratory: '#0277BD', mental: '#7B1FA2', seasonal: '#2E7D32',
};

function PredictiveAnalytics() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryTab, setCategoryTab] = useState('all');
  const { isReal } = useDataMode();

  const load = () => {
    setLoading(true);
    aiApi.getPredictions()
      .then(res => { setPredictions(res.data || []); setLoading(false); })
      .catch(() => { setPredictions([]); setLoading(false); });
  };

  useModeRefresh(load);

  const categories = useMemo(() => {
    const map = {};
    predictions.forEach(p => {
      const key = p.category || 'other';
      if (!map[key]) map[key] = { key, label: p.categoryLabel || key, items: [] };
      map[key].items.push(p);
    });
    return Object.values(map);
  }, [predictions]);

  const filtered = categoryTab === 'all'
    ? predictions
    : predictions.filter(p => p.category === categoryTab);

  const stats = useMemo(() => ({
    total: predictions.length,
    high: predictions.filter(p => p.level === 'high' || p.probability >= 60).length,
    medium: predictions.filter(p => p.level === 'medium' || (p.probability >= 40 && p.probability < 60)).length,
    avgProb: predictions.length
      ? Math.round(predictions.reduce((s, p) => s + p.probability, 0) / predictions.length)
      : 0,
  }), [predictions]);

  if (loading) return <LinearProgress />;

  const chartData = filtered.map(p => ({
    name: p.risk.length > 12 ? `${p.risk.slice(0, 12)}…` : p.risk,
    fullName: p.risk,
    probability: p.probability,
    fill: p.probability >= 60 ? '#C62828' : p.probability >= 40 ? '#EF6C00' : '#2E7D32',
  }));

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={700}>预测性健康分析</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isReal
          ? '基于已导入 Apple Health 时序数据的深度学习预测（无数据时为空）'
          : '演示模式 — 10 项预测（运动/睡眠/心血管/代谢/感染/呼吸/心理/季节等）'}
      </Typography>

      {predictions.length === 0 ? (
        <Alert severity="info">
          {isReal ? '真实模式需先导入 Apple Health 数据后才会生成个性化预测。' : '暂无预测数据'}
        </Alert>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: '预测项目', value: stats.total, icon: <Science />, color: 'primary.main' },
              { label: '需关注', value: stats.high + stats.medium, icon: <Warning />, color: 'warning.main' },
              { label: '平均风险', value: `${stats.avgProb}%`, icon: <TrendingUp />, color: 'info.main' },
              { label: '预测类别', value: categories.length, icon: <Psychology />, color: 'secondary.main' },
            ].map(s => (
              <Grid item xs={6} md={3} key={s.label}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Box sx={{ color: s.color, mb: 0.5 }}>{s.icon}</Box>
                  <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Tabs
            value={categoryTab}
            onChange={(_, v) => setCategoryTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2 }}
          >
            <Tab value="all" label={`全部 (${predictions.length})`} />
            {categories.map(c => (
              <Tab key={c.key} value={c.key} label={`${c.label} (${c.items.length})`} />
            ))}
          </Tabs>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>风险概率分布</Typography>
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, _n, props) => [`${v}%`, props.payload.fullName || props.payload.name]} />
                <Bar dataKey="probability" name="风险概率" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          <Grid container spacing={3}>
            {filtered.map((pred, i) => (
              <Grid item xs={12} sm={6} md={4} key={pred.id || i}>
                <Card sx={{
                  height: '100%',
                  borderTop: 4,
                  borderColor: pred.probability >= 60 ? 'error.main' : pred.probability >= 40 ? 'warning.main' : 'success.main',
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="h6" sx={{ fontSize: '1rem' }}>{pred.risk}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {pred.categoryLabel && (
                          <Chip
                            label={pred.categoryLabel}
                            size="small"
                            sx={{ bgcolor: `${CATEGORY_COLORS[pred.category] || '#757575'}22`, color: CATEGORY_COLORS[pred.category] || '#757575' }}
                          />
                        )}
                        <Chip icon={<Psychology />} label="AI 预测" size="small" color="primary" variant="outlined" />
                      </Box>
                    </Box>
                    <Typography variant="body1" fontWeight={600} color={`${LEVEL_COLOR[pred.level] || 'success'}.main`} gutterBottom>
                      {LEVEL_LABEL[pred.level] || '评估中'} · {pred.probability}%
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress
                        variant="determinate"
                        value={pred.probability}
                        color={pred.probability >= 60 ? 'error' : pred.probability >= 40 ? 'warning' : 'success'}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                      <Chip label={`窗口: ${pred.timeframe}`} size="small" variant="outlined" />
                      {pred.horizon && <Chip label={HORIZON_LABEL[pred.horizon] || pred.horizon} size="small" variant="outlined" />}
                      {pred.model && <Chip label={pred.model} size="small" color="secondary" variant="outlined" />}
                    </Box>
                    <Typography variant="subtitle2" gutterBottom>风险因素</Typography>
                    <List dense disablePadding>
                      {(pred.factors || []).map(f => (
                        <ListItem key={f} disablePadding sx={{ mb: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}><Warning fontSize="small" color="warning" /></ListItemIcon>
                          <ListItemText primary={f} primaryTypographyProps={{ variant: 'body2' }} />
                        </ListItem>
                      ))}
                    </List>
                    <Paper sx={{ p: 1.5, mt: 2, bgcolor: 'info.50' }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <CheckCircle color="info" fontSize="small" />
                        <Typography variant="body2">{pred.recommendation}</Typography>
                      </Box>
                    </Paper>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}

export default PredictiveAnalytics;
