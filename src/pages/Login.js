import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Typography, TextField, Button, Paper, Alert, Chip, Stack } from '@mui/material';
import { MonitorHeart, Psychology } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (err.response?.status === 429) {
        setError('登录尝试过于频繁，请 1 分钟后再试');
      } else if (msg?.includes('Network Error') || !err.response) {
        setError('无法连接 API 服务器，请确认已运行 npm run dev（端口 3001）');
      } else {
        setError(msg || '登录失败，请检查用户名和密码');
      }
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (u, p) => {
    setUsername(u);
    setPassword(p);
    try {
      setError('');
      setLoading(true);
      await login(u, p);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg?.includes('Network') || !err.response
        ? '无法连接 API，请先运行: npm run dev'
        : (msg || '登录失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d47a1 0%, #00838F 50%, #1565C0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Container maxWidth="xs">
        <Paper elevation={8} sx={{ p: 4, borderRadius: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <MonitorHeart sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" fontWeight={700}>MedWear AI</Typography>
          <Typography variant="body2" color="text.secondary">智能健康分析平台 · 演示模式</Typography>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
              <Chip icon={<Psychology />} label="AI 驱动" size="small" color="primary" variant="outlined" />
              <Chip label="实时监测" size="small" color="secondary" variant="outlined" />
            </Stack>
          </Box>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField margin="normal" required fullWidth label="用户名" value={username}
              onChange={(e) => setUsername(e.target.value)} autoFocus />
            <TextField margin="normal" required fullWidth label="密码" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3, py: 1.5 }} disabled={loading}>
              {loading ? '登录中...' : '进入平台'}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
            演示账号: demo / demo123 或 admin / admin123
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5 }}>
            <Button size="small" variant="outlined" disabled={loading} onClick={() => quickLogin('demo', 'demo123')}>
              一键 demo 登录
            </Button>
            <Button size="small" variant="outlined" disabled={loading} onClick={() => quickLogin('admin', 'admin123')}>
              一键 admin 登录
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}

export default Login;
