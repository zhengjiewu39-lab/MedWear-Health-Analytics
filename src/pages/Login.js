import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Alert, Stack, Paper, Divider, alpha,
} from '@mui/material';
import { MonitorHeart, Shield, Analytics, Speed, Translate } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';
import { getHomePath } from '../config/paperDemo';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, toggle: toggleLang } = useLang();

  const features = [
    { icon: <Analytics />, title: t('透明分析', 'Transparent analytics'), desc: t('可解释的健康评分与预警', 'Explainable health scores & alerts') },
    { icon: <Shield />, title: t('本地优先', 'Local-first'), desc: t('Apple Health 数据不上云', 'Apple Health data stays on device') },
    { icon: <Speed />, title: t('管理高效', 'Efficient ops'), desc: t('患者、设备、报告一站管理', 'Patients, devices & reports in one place') },
  ];

  const handleLogin = async (u, p) => {
    try {
      setError('');
      setLoading(true);
      await login(u, p);
      navigate(getHomePath());
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (err.response?.status === 429) {
        setError(t('登录尝试过于频繁，请稍后再试', 'Too many login attempts, please try again later'));
      } else if (msg?.includes('Network Error') || !err.response) {
        setError(t('无法连接 API，请确认已运行 npm run dev（端口 3001）', 'Cannot reach API — please run npm run dev (port 3001)'));
      } else {
        setError(msg || t('登录失败', 'Login failed'));
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
          {t('医用可穿戴设备数据分析平台', 'Medical Wearable Data Analytics Platform')}
        </Typography>
        <Typography variant="body1" sx={{ color: '#94a3b8', maxWidth: 440, mb: 4 }}>
          {t('面向管理员的临床运营控制台 — 患者监测、预警处置、报告导出与系统配置集中管理。',
            'Clinical operations console for administrators — patient monitoring, alert triage, report export and system configuration in one place.')}
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="h5" fontWeight={800}>{t('登录', 'Sign in')}</Typography>
            <Button size="small" startIcon={<Translate />} onClick={toggleLang} sx={{ minWidth: 0 }}>
              {lang === 'en' ? '中文' : 'EN'}
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('使用管理员账号登录，默认进入临床早筛中心',
              'Sign in with the administrator account — you will land on the clinical screening hub')}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              label={t('用户名', 'Username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label={t('密码', 'Password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3, py: 1.4 }} disabled={loading}>
              {loading ? t('登录中…', 'Signing in…') : t('进入系统', 'Enter')}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">{t('快捷登录', 'Quick sign-in')}</Typography>
          </Divider>

          <Button
            fullWidth
            variant="outlined"
            disabled={loading}
            onClick={() => handleLogin('admin', 'admin123')}
            sx={{ py: 1.2 }}
          >
            {t('管理员 (admin / admin123)', 'Administrator (admin / admin123)')}
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}

export default Login;
