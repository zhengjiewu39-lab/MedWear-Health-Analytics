import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, LinearProgress, Chip, Avatar,
} from '@mui/material';
import {
  Favorite, Air, LocalDining, Bedtime, DirectionsRun, Psychology,
  CheckCircle, Warning, Error as ErrorIcon,
} from '@mui/icons-material';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { aiApi } from '../services/api';

const organIcons = {
  '心脏': <Favorite />, '肺部': <Air />, '代谢': <LocalDining />,
  '睡眠': <Bedtime />, '活动': <DirectionsRun />, '压力': <Psychology />,
};

const statusIcon = {
  normal: <CheckCircle color="success" />,
  warning: <Warning color="warning" />,
  critical: <ErrorIcon color="error" />,
};

function DigitalTwin() {
  const [twin, setTwin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi.getDigitalTwin().then(res => { setTwin(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading || !twin) return <LinearProgress />;

  const radarData = twin.organs.map(o => ({ organ: o.name, score: o.score, fullMark: 100 }));

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>健康数字孪生</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        为每位患者构建实时更新的数字化健康镜像，多维度可视化身体系统状态
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, textAlign: 'center', background: 'linear-gradient(180deg, #e3f2fd 0%, #fff 100%)' }}>
            <Avatar sx={{ width: 120, height: 120, mx: 'auto', mb: 2, bgcolor: 'primary.main', fontSize: 48 }}>
              {twin.patient[0]}
            </Avatar>
            <Typography variant="h5" fontWeight={700}>{twin.patient}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{twin.age} 岁</Typography>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <Box sx={{
                width: 140, height: 140, borderRadius: '50%',
                background: `conic-gradient(#2E7D32 ${twin.overallScore * 3.6}deg, #e0e0e0 0deg)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Box sx={{
                  width: 110, height: 110, borderRadius: '50%', bgcolor: 'background.paper',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Typography variant="h3" fontWeight={700} color="primary.main">{twin.overallScore}</Typography>
                  <Typography variant="caption" color="text.secondary">综合健康分</Typography>
                </Box>
              </Box>
            </Box>
            <Chip label="实时同步中" color="success" size="small" sx={{ mt: 2 }} className="live-indicator" />
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>系统雷达图</Typography>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="organ" />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar name="健康指数" dataKey="score" stroke="#1565C0" fill="#1565C0" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Grid container spacing={2}>
            {twin.organs.map(organ => (
              <Grid item xs={12} sm={6} md={12} key={organ.name}>
                <Paper sx={{ p: 2, borderLeft: 3, borderColor: organ.status === 'normal' ? 'success.main' : 'warning.main' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {organIcons[organ.name]}
                      <Typography variant="subtitle1" fontWeight={600}>{organ.name}</Typography>
                    </Box>
                    {statusIcon[organ.status]}
                  </Box>
                  <LinearProgress variant="determinate" value={organ.score}
                    color={organ.score >= 80 ? 'success' : organ.score >= 60 ? 'warning' : 'error'}
                    sx={{ mb: 1, height: 6, borderRadius: 3 }} />
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {Object.entries(organ.metrics).map(([k, v]) => (
                      <Chip key={k} label={`${k}: ${v}`} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DigitalTwin;
