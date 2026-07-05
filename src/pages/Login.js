import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Alert, Stack, Grid, Paper, Divider, alpha,
} from '@mui/material';
import { MonitorHeart, Shield, Analytics, Speed } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const features = [
  { icon: <Analytics />, title: '透明分析', desc: '可解释的健康评分与预警' },
  { icon: <Shield />, title: '本地优先', desc: 'Apple Health 数据不上云' },
  { icon: <Speed />, title: '管理高效', desc: '患者、设备、报告一站管理' },
];

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (u, p) => {
    try {
      setError('');
      setLoading(true);
      const user = await login(u, p);
      navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (err.response?.status === 429) {
        setError('登录尝试过于频繁，请稍后再试');
      } else if (msg?.includes('Network Error') || !err.response) {
        setError('无法连接 API，请确认已运行 npm run dev（端口 3001）');
      } else {
        setError(msg || '登录失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin(username, password);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: '#f1f5f9' }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          px: 6,
          background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 45%, #312e81 100%)',
          color: '#fff',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <MonitorHeart sx={{ fontSize: 40, color: '#818cf8' }} />
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.03em' }}>
            MedWear
          </Typography>
        </Stack>
        <Typography variant="h3" fontWeight={800} sx={{ maxWidth: 480, letterSpacing: '-0.03em', lineHeight: 1.15, mb: 2 }}>
          医用可穿戴设备数据分析平台
        </Typography>
        <Typography variant="body1" sx={{ color: '#94a3b8', maxWidth: 440, mb: 4 }}>
          面向管理员的临床运营控制台 — 患者监测、预警处置、报告导出与系统配置集中管理。
        </Typography>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          {features.map((f) => (
            <Stack key={f.title} direction="row" spacing={2} alignItems="flex-start">
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha('#818cf8', 0.15), color: '#a5b4fc' }}>
                {f.icon}
              </Box>
              <Box>
                <Typography fontWeight={700}>{f.title}</Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8' }}>{f.desc}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Paper elevation={0} sx={{ width: '100%', maxWidth: 420, p: 4, borderRadius: 3 }}>
          <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>登录</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            管理员登录后进入管理控制台
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3, py: 1.4 }} disabled={loading}>
              {loading ? '登录中…' : '进入系统'}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">演示快捷登录</Typography>
          </Divider>

          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                disabled={loading}
                onClick={() => handleLogin('admin', 'admin123')}
                sx={{ py: 1.2 }}
              >
                管理员
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                disabled={loading}
                onClick={() => handleLogin('demo', 'demo123')}
                sx={{ py: 1.2 }}
              >
                演示用户
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Box>
  );
}

export default Login;
