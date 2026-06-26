import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, LinearProgress,
} from '@mui/material';
import { Devices, CheckCircle, Sync } from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { aiApi } from '../services/api';

const COLORS = ['#1565C0', '#00838F', '#6A1B9A'];

function DataFusion() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi.getFusionSources().then(res => { setSources(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;

  const pieData = sources.map(s => ({ name: s.device, value: s.weight * 100 }));

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>多源数据融合</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        智能融合来自手表、贴片、戒指、CGM 等多设备异构数据，构建统一健康视图
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>融合权重分配</Typography>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name.split(' ')[0]} ${value.toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Grid container spacing={2}>
            {sources.map((source, i) => (
              <Grid item xs={12} key={source.device}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Devices color="primary" />
                        <Typography variant="h6">{source.device}</Typography>
                      </Box>
                      <Chip icon={<CheckCircle />} label={`质量 ${source.quality}%`} size="small" color="success" />
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">融合权重</Typography>
                        <Typography variant="body2" fontWeight={700}>{(source.weight * 100).toFixed(0)}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={source.weight * 100}
                        sx={{ height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { bgcolor: COLORS[i] } }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {source.metrics.map(m => (
                        <Chip key={m} label={m} size="small" sx={{ bgcolor: COLORS[i] + '15', color: COLORS[i] }} />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3, background: 'linear-gradient(135deg, #e3f2fd 0%, #e0f7fa 100%)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Sync color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h6">FusionEngine v1.2 融合引擎</Typography>
                <Typography variant="body2" color="text.secondary">
                  采用卡尔曼滤波 + 注意力机制，自动处理设备间采样率差异、数据缺失与冲突，
                  输出统一时间轴上的融合健康指标。当前融合延迟 &lt;500ms，数据一致性 99.7%。
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DataFusion;
