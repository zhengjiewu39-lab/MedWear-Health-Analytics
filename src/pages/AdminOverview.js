import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Paper, Typography, Button, Stack, Chip, LinearProgress, List,
  ListItem, ListItemText, ListItemIcon, Divider, Alert,
} from '@mui/material';
import {
  People, Warning, Devices, ArrowForward, NotificationsActive,
  CloudUpload, Settings, CompareArrows,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { ADMIN_QUICK_ACTIONS } from '../config/navigation';
import { adminApi, alertApi, securityApi } from '../services/api';
import { useDataMode } from '../contexts/DataModeContext';
import { useHealthData } from '../contexts/HealthDataContext';
import { useLang } from '../contexts/LanguageContext';
import { ADMIN_OVERVIEW_FALLBACK } from '../data/adminFallback';

const actionIcons = {
  '/admin/patients': People,
  '/outcomes': CompareArrows,
  '/alerts': NotificationsActive,
  '/import': CloudUpload,
  '/screening': CompareArrows,
  '/settings': Settings,
};

function AdminOverview() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { isReal } = useDataMode();
  const { hasData } = useHealthData();
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [o, a, log] = await Promise.all([
          adminApi.getOverview().catch(() => ({ data: null })),
          alertApi.getAll().catch(() => ({ data: [] })),
          securityApi.getAuditLog(5).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setOverview(o.data);
        setAlerts((a.data || []).slice(0, 4));
        setAudit(Array.isArray(log.data) ? log.data : []);
      } catch {
        if (!cancelled) {
          setOverview(null);
          setAlerts([]);
          setAudit([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (loading) return <LinearProgress />;

  const stats = overview || ADMIN_OVERVIEW_FALLBACK;
  const usingFallback = !overview;

  return (
    <Box>
      {usingFallback && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('管理 API 暂不可用（请重启 ', 'The admin API is unavailable (restart ')}<code>npm run dev</code>{t(' 以加载最新后端）。当前显示演示数据。', ' to load the latest backend). Showing demo data for now.')}
        </Alert>
      )}
      <PageHeader
        title={t('管理控制台', 'Admin Console')}
        subtitle={t('集中查看合成队列、预警与系统状态，快速进入早筛与结局分析功能',
          'Monitor the synthetic cohort, alerts and system status — quick access to screening and outcome analysis')}
        badge={<Chip label="Admin" size="small" color="primary" />}
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<CompareArrows />} onClick={() => navigate('/outcomes')}>
              {t('结局对比', 'Outcomes')}
            </Button>
            <Button variant="contained" startIcon={<Settings />} onClick={() => navigate('/settings')}>
              {t('系统设置', 'System Settings')}
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('队列总量', 'Cohort size')} value={stats.patientCount ?? '—'} icon={<People />} color="#4f46e5" onClick={() => navigate('/admin/patients')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('高风险患者', 'High-risk Patients')} value={stats.highRiskCount ?? '—'} icon={<Warning />} color="#dc2626" onClick={() => navigate('/admin/patients')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('在线设备', 'Online Devices')} value={stats.activeDevices ?? '—'} icon={<Devices />} color="#0d9488" onClick={() => navigate('/devices')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('待处理预警', 'Pending Alerts')} value={stats.pendingAlerts ?? alerts.length} icon={<NotificationsActive />} color="#d97706" onClick={() => navigate('/alerts')} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <Paper elevation={0} sx={{ p: 2.5, mb: { xs: 2.5, lg: 0 } }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>{t('快捷操作', 'Quick Actions')}</Typography>
            <Grid container spacing={2}>
              {ADMIN_QUICK_ACTIONS.map((action) => {
                const Icon = actionIcons[action.path] || CompareArrows;
                return (
                  <Grid item xs={12} sm={6} md={4} key={action.path}>
                    <Paper
                      elevation={0}
                      onClick={() => navigate(action.path)}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        borderLeft: `4px solid ${action.color}`,
                        transition: 'all 0.15s ease',
                        '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-1px)' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Box sx={{ color: action.color, mt: 0.25 }}><Icon /></Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700}>{t(action.title, action.title_en)}</Typography>
                          <Typography variant="caption" color="text.secondary">{t(action.desc, action.desc_en)}</Typography>
                        </Box>
                        <ArrowForward sx={{ fontSize: 18, color: 'text.disabled' }} />
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={2.5}>
            <Paper elevation={0} sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>{t('系统状态', 'System Status')}</Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">{t('数据模式', 'Data Mode')}</Typography>
                  <Chip label={isReal ? t('真实模式', 'Real Mode') : t('演示模式', 'Demo Mode')} size="small" color={isReal ? 'success' : 'default'} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">{t('健康数据', 'Health Data')}</Typography>
                  <Chip label={hasData ? t('已导入', 'Imported') : t('未导入', 'Not imported')} size="small" color={hasData ? 'success' : 'warning'} variant="outlined" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">{t('干预 / 对照', 'Intervention / Control')}</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {t(`${stats.interventionCount} / ${stats.controlCount}`, `${stats.interventionCount} / ${stats.controlCount}`)}
                  </Typography>
                </Box>
                {stats.cohortSeed && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">{t('队列种子', 'Cohort seed')}</Typography>
                    <Typography variant="body2" fontWeight={600}>{stats.cohortSeed}</Typography>
                  </Box>
                )}
              </Stack>
              {!hasData && isReal && (
                <Button fullWidth variant="contained" sx={{ mt: 2 }} startIcon={<CloudUpload />} onClick={() => navigate('/import')}>
                  {t('去导入数据', 'Import Data')}
                </Button>
              )}
            </Paper>

            <Paper elevation={0} sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>{t('最近预警', 'Recent Alerts')}</Typography>
                <Button size="small" onClick={() => navigate('/alerts')}>{t('查看全部', 'View All')}</Button>
              </Box>
              {alerts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{t('暂无活跃预警', 'No active alerts')}</Typography>
              ) : (
                <List dense disablePadding>
                  {alerts.map((a, i) => (
                    <React.Fragment key={a.id || i}>
                      {i > 0 && <Divider component="li" />}
                      <ListItem disableGutters sx={{ py: 0.75 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Warning fontSize="small" color="warning" />
                        </ListItemIcon>
                        <ListItemText
                          primary={a.type || a.title || t('健康异常', 'Health anomaly')}
                          secondary={a.time || a.message}
                          primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                          secondaryTypographyProps={{ fontSize: '0.75rem' }}
                        />
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>

            <Paper elevation={0} sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{t('审计日志', 'Audit Log')}</Typography>
              <List dense disablePadding>
                {(audit.slice(0, 4)).map((entry, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={entry.action || entry.event || t('系统操作', 'System action')}
                      secondary={entry.user || entry.detail || entry.timestamp}
                      primaryTypographyProps={{ fontSize: '0.8125rem' }}
                      secondaryTypographyProps={{ fontSize: '0.75rem' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default AdminOverview;
