import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, LinearProgress, Card, CardContent, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { Bedtime, Psychology, Lightbulb, CheckCircle } from '@mui/icons-material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { aiApi } from '../services/api';

function SleepAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi.getSleepData().then(res => { setData(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading || !data) return <LinearProgress />;

  const { overview, stages, aiInsights, weekSleep } = data;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>睡眠 AI 分析</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        融合多设备睡眠数据，AI 解析睡眠阶段、呼吸事件与质量评分
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: '总睡眠', value: `${overview.totalSleep}h`, color: 'primary' },
          { label: '深睡', value: `${overview.deepSleep}h`, color: 'secondary' },
          { label: 'REM', value: `${overview.remSleep}h`, color: 'info' },
          { label: '睡眠评分', value: overview.sleepScore, color: 'success' },
          { label: '睡眠效率', value: `${overview.efficiency}%`, color: 'warning' },
        ].map(item => (
          <Grid item xs={6} sm={4} md={2.4} key={item.label}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={700} color={`${item.color}.main`}>{item.value}</Typography>
              <Typography variant="body2" color="text.secondary">{item.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>睡眠阶段分布</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stages}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="deep" stackId="1" name="深睡" fill="#1565C0" />
                <Area type="monotone" dataKey="light" stackId="1" name="浅睡" fill="#90CAF9" />
                <Area type="monotone" dataKey="rem" stackId="1" name="REM" fill="#6A1B9A" />
                <Area type="monotone" dataKey="awake" stackId="1" name="清醒" fill="#EF6C00" />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Psychology color="primary" />
                <Typography variant="h6">AI 睡眠洞察</Typography>
              </Box>
              <List>
                {aiInsights.map((insight, i) => (
                  <ListItem key={i} alignItems="flex-start" sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                      {i === 0 ? <CheckCircle color="success" fontSize="small" /> : <Lightbulb color="warning" fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText primary={insight} primaryTypographyProps={{ variant: 'body2' }} />
                  </ListItem>
                ))}
              </List>
              <Chip icon={<Bedtime />} label="SleepAI-v2 模型分析" size="small" color="primary" variant="outlined" sx={{ mt: 2 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {weekSleep && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>近 7 日睡眠时长</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>成人推荐 7–9 小时/晚</Typography>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weekSleep}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis domain={[5, 10]} unit="h" />
              <Tooltip formatter={(v) => [`${v} 小时`, '睡眠时长']} />
              <Area type="monotone" dataKey="hours" name="睡眠" stroke="#1565C0" fill="#90CAF9" />
            </AreaChart>
          </ResponsiveContainer>
        </Paper>
      )}
    </Box>
  );
}

export default SleepAnalysis;
