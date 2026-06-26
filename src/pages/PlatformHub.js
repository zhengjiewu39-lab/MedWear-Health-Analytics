import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, LinearProgress, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow, Alert, Tabs, Tab,
} from '@mui/material';
import {
  Hub, CloudSync, VpnKey, Link as LinkIcon, CheckCircle, Sync, Api,
} from '@mui/icons-material';
import { platformApi } from '../services/api';

const statusColor = { connected: 'success', standby: 'warning', offline: 'error' };
const statusLabel = { connected: '已连接', standby: '待命', offline: '离线' };

function PlatformHub() {
  const [status, setStatus] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [tab, setTab] = useState(0);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      platformApi.getStatus(),
      platformApi.getApiKeys(),
    ]).then(([s, k]) => {
      setStatus(s.data);
      setApiKeys(k.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const testApi = async () => {
    setTestResult({ loading: true });
    try {
      const res = await platformApi.testConnection();
      setTestResult({ success: true, data: res.data });
    } catch (e) {
      setTestResult({ success: false, message: e.response?.data?.message || '连接失败' });
    }
  };

  if (loading) return <LinearProgress />;
  if (!status) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>MedWear 互联平台</Typography>
          <Typography variant="body2" color="text.secondary">
            {status.version} · 与医院 HIS、Apple Health、保险及研究联盟互联
          </Typography>
        </Box>
        <Chip icon={<CheckCircle />} label="平台在线" color="success" />
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: '已连接系统', value: status.integrations.filter(i => i.status === 'connected').length, icon: <Hub /> },
          { label: 'Webhook', value: status.webhooks.length, icon: <LinkIcon /> },
          { label: 'API 密钥', value: apiKeys.length, icon: <VpnKey /> },
          { label: '运行时间', value: `${Math.floor(status.uptime / 60)}m`, icon: <CloudSync /> },
        ].map(item => (
          <Grid item xs={6} md={3} key={item.label}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Box sx={{ color: 'primary.main', mb: 1 }}>{item.icon}</Box>
              <Typography variant="h4" fontWeight={700}>{item.value}</Typography>
              <Typography variant="body2" color="text.secondary">{item.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="系统集成" />
          <Tab label="Open API" />
          <Tab label="Webhook" />
        </Tabs>

        {tab === 0 && (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={2}>
              {status.integrations.map(int => (
                <Grid item xs={12} md={6} key={int.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6" fontWeight={600}>{int.name}</Typography>
                        <Chip label={statusLabel[int.status]} size="small" color={statusColor[int.status]} />
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {int.protocol} · {int.type === 'inbound' ? '数据接入' : int.type === 'outbound' ? '数据推送' : '双向同步'}
                      </Typography>
                      {int.endpoint && <Typography variant="caption" display="block">{int.endpoint}</Typography>}
                      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {int.dataFlow.map(d => <Chip key={d} label={d} size="small" variant="outlined" />)}
                      </Box>
                      {int.lastSync && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          最近同步: {new Date(int.lastSync).toLocaleString('zh-CN')}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ p: 3 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              第三方系统通过 <strong>X-API-Key</strong> 访问 Open API。演示密钥: <code>mw_demo_hospital_001</code>
            </Alert>
            <Typography variant="subtitle2" gutterBottom>API 端点</Typography>
            <Table size="small" sx={{ mb: 3 }}>
              <TableHead>
                <TableRow>
                  <TableCell>方法</TableCell>
                  <TableCell>路径</TableCell>
                  <TableCell>说明</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  ['GET', '/api/platform/v1/vitals', '生命体征快照'],
                  ['GET', '/api/platform/v1/screening?anonymize=true', 'AI 筛查（可脱敏）'],
                  ['GET', '/api/platform/v1/report', '医生报告'],
                  ['GET', '/api/platform/v1/analysis', 'AI v3 完整分析'],
                ].map(([method, path, desc]) => (
                  <TableRow key={path}>
                    <TableCell><Chip label={method} size="small" color="primary" /></TableCell>
                    <TableCell><Typography variant="body2" fontFamily="monospace">{path}</Typography></TableCell>
                    <TableCell>{desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="subtitle2" gutterBottom>已签发 API Key</Typography>
            {apiKeys.map(k => (
              <Paper key={k.key} variant="outlined" sx={{ p: 2, mb: 1 }}>
                <Typography fontWeight={600}>{k.name}</Typography>
                <Typography variant="body2" fontFamily="monospace">{k.key}</Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
                  {k.scopes.map(s => <Chip key={s} label={s} size="small" />)}
                </Box>
              </Paper>
            ))}
            <Button variant="contained" startIcon={<Api />} onClick={testApi} sx={{ mt: 2 }}>
              测试 API 连接
            </Button>
            {testResult && !testResult.loading && (
              <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                {testResult.success
                  ? `连接成功 · 患者 ${testResult.data.profile?.name} · 筛查风险 ${testResult.data.overallScore}`
                  : testResult.message}
              </Alert>
            )}
          </Box>
        )}

        {tab === 2 && (
          <Box sx={{ p: 3 }}>
            {status.webhooks.map(wh => (
              <Paper key={wh.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography fontWeight={600} fontFamily="monospace">{wh.url}</Typography>
                  <Chip label={wh.active ? '活跃' : '暂停'} color={wh.active ? 'success' : 'default'} size="small" />
                </Box>
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
                  {wh.events.map(e => <Chip key={e} label={e} size="small" variant="outlined" color="secondary" />)}
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Sync color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>数据安全传输</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          所有互联 API 强制 HTTPS · AES-256-GCM 本地保险库 · 审计日志 · 导出默认脱敏 · JWT 身份认证
        </Typography>
      </Paper>
    </Box>
  );
}

export default PlatformHub;
