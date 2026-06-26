import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, LinearProgress,
  List, ListItem, ListItemIcon, ListItemText, Button,
} from '@mui/material';
import { EmojiEvents, DirectionsRun, Bedtime, Favorite, CheckCircle, Star } from '@mui/icons-material';
import { aiApi } from '../services/api';

const iconMap = { steps: <DirectionsRun />, sleep: <Bedtime />, heartRate: <Favorite /> };

function HealthGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi.getHealthGoals().then(res => { setGoals(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;

  const completedCount = goals.filter(g => g.progress >= 100).length;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>健康目标引擎</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        AI 根据患者健康数据自动生成个性化目标，游戏化激励健康行为
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <EmojiEvents sx={{ fontSize: 40, color: 'warning.main' }} />
            <Typography variant="h4" fontWeight={700}>{completedCount}/{goals.length}</Typography>
            <Typography variant="body2" color="text.secondary">今日目标完成</Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Star sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant="h4" fontWeight={700}>1,280</Typography>
            <Typography variant="body2" color="text.secondary">累计健康积分</Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />
            <Typography variant="h4" fontWeight={700}>15</Typography>
            <Typography variant="body2" color="text.secondary">连续达标天数</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {goals.map(goal => (
          <Grid item xs={12} md={4} key={goal.id}>
            <Card sx={{ borderTop: 3, borderColor: goal.progress >= 100 ? 'success.main' : 'primary.main' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  {iconMap[goal.type]}
                  <Typography variant="h6">{goal.title}</Typography>
                  {goal.progress >= 100 && <Chip label="已完成" size="small" color="success" />}
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>{goal.description}</Typography>
                <Box sx={{ my: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{goal.current} / {goal.target} {goal.unit}</Typography>
                    <Typography variant="body2" fontWeight={700}>{goal.progress}%</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={Math.min(goal.progress, 100)}
                    color={goal.progress >= 100 ? 'success' : 'primary'} sx={{ height: 10, borderRadius: 5 }} />
                </Box>
                <Chip label={`+${goal.points} 积分`} size="small" color="warning" variant="outlined" />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, mt: 3, background: 'linear-gradient(135deg, #e8f5e9 0%, #e3f2fd 100%)' }}>
        <Typography variant="h6" gutterBottom>AI 目标建议</Typography>
        <List dense>
          {[
            '根据近7天活动数据，建议将每日步数目标从 8000 提升至 8500',
            '王强患者房颤风险较高，建议新增「静息心率 <80bpm」监测目标',
            '赵敏患者血糖控制良好，可适当放宽餐后步行目标',
          ].map((tip, i) => (
            <ListItem key={i}>
              <ListItemIcon><Star color="primary" fontSize="small" /></ListItemIcon>
              <ListItemText primary={tip} />
            </ListItem>
          ))}
        </List>
        <Button variant="contained" size="small" sx={{ mt: 1 }}>应用 AI 建议</Button>
      </Paper>
    </Box>
  );
}

export default HealthGoals;
