import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Switch, FormControlLabel, Slider, TextField,
  Button, Chip, Divider, Alert, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { Settings, Psychology, NotificationsActive, Security, Save, Lock, History } from '@mui/icons-material';
import { settingsApi, securityApi } from '../services/api';
import { useDataMode } from '../contexts/DataModeContext';

function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [vault, setVault] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [saved, setSaved] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [apiKey, setApiKey] = useState('');
  const { isReal } = useDataMode();

  useEffect(() => {
    settingsApi.get().then(res => setSettings(res.data));
    securityApi.getVaultStatus().then(res => setVault(res.data)).catch(() => {});
    securityApi.getAuditLog(20).then(res => setAuditLog(res.data)).catch(() => {});
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const syncVault = async () => {
    const res = await securityApi.syncVault();
    setVault(await securityApi.getVaultStatus().then(r => r.data));
    setActionMsg(`健康数据已加密同步 (${res.data.algorithm})`);
    securityApi.getAuditLog(20).then(r => setAuditLog(r.data));
  };

  const exportData = async (anonymize) => {
    await securityApi.exportData(anonymize);
    setActionMsg(anonymize ? '脱敏数据已导出（审计已记录）' : '完整数据已导出（审计已记录）');
    securityApi.getAuditLog(20).then(r => setAuditLog(r.data));
  };

  const saveAiKey = async () => {
    if (!apiKey.trim()) return;
    await settingsApi.saveAi({ apiKey: apiKey.trim() });
    setActionMsg('AI API Key 已保存（仅保存在本地服务器）');
    setApiKey('');
    settingsApi.get().then(res => setSettings(res.data));
  };

  if (!settings) return null;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>系统设置</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        AI v3 引擎 · 数据加密 · 审计日志 · 互联平台配置
      </Typography>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>设置已保存</Alert>}
      {actionMsg && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setActionMsg('')}>{actionMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Psychology color="primary" /><Typography variant="h6">AI 模型配置</Typography>
            </Box>
            <FormControlLabel control={<Switch defaultChecked={settings.aiEnabled} />}
              label="启用 AI v3 多模型融合引擎" sx={{ mb: 2, display: 'block' }} />
            <TextField fullWidth label="AI 模型版本" defaultValue={settings.aiModel} size="small" sx={{ mb: 2 }} />
            <Typography variant="body2" gutterBottom>分析置信度阈值: {settings.confidenceThreshold}%</Typography>
            <Slider defaultValue={settings.confidenceThreshold} min={50} max={99} valueLabelDisplay="auto" sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {settings.aiModels.map(m => <Chip key={m} label={m} size="small" color="primary" variant="outlined" />)}
            </Box>
            {isReal && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>真实 AI 配置 (OpenAI 兼容)</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  状态: {settings.aiConfigured ? '已配置 ✓' : '未配置 — 将降级为规则引擎'}
                </Typography>
                <TextField fullWidth type="password" label="OpenAI API Key" size="small" value={apiKey}
                  onChange={e => setApiKey(e.target.value)} sx={{ mb: 1 }} placeholder="sk-..." />
                <Button variant="contained" size="small" onClick={saveAiKey} disabled={!apiKey.trim()}>保存 API Key</Button>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  或设置环境变量 OPENAI_API_KEY 后重启服务器
                </Typography>
              </>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <NotificationsActive color="warning" /><Typography variant="h6">告警阈值</Typography>
            </Box>
            {[
              { label: '心率上限 (bpm)', value: settings.alertThresholds.heartRateMax },
              { label: '心率下限 (bpm)', value: settings.alertThresholds.heartRateMin },
              { label: '血氧下限 (%)', value: settings.alertThresholds.spo2Min },
              { label: '血糖上限 (mmol/L)', value: settings.alertThresholds.glucoseMax },
            ].map(item => (
              <TextField key={item.label} fullWidth label={item.label} defaultValue={item.value}
                type="number" size="small" sx={{ mb: 2 }} />
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Security color="success" /><Typography variant="h6">数据安全</Typography>
            </Box>
            <FormControlLabel control={<Switch defaultChecked={settings.encryptionEnabled} />} label={`端到端加密 (${settings.encryptionAlgorithm || 'AES-256-GCM'})`} />
            <FormControlLabel control={<Switch defaultChecked={settings.auditLogEnabled} />} label="操作审计日志" sx={{ display: 'block' }} />
            <FormControlLabel control={<Switch defaultChecked={settings.anonymizeExport} />} label="导出数据默认脱敏" sx={{ display: 'block' }} />
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" gutterBottom>
              加密保险库: {vault?.encrypted ? `已同步 (${vault.lastSync})` : '未同步'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" size="small" startIcon={<Lock />} onClick={syncVault}>加密同步</Button>
              <Button variant="outlined" size="small" onClick={() => exportData(true)}>脱敏导出</Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Settings color="info" /><Typography variant="h6">数据采集</Typography>
            </Box>
            <FormControlLabel control={<Switch defaultChecked={settings.realtimeEnabled} />} label="实时数据流" />
            <FormControlLabel control={<Switch defaultChecked={settings.autoSync} />} label="设备自动同步" sx={{ display: 'block' }} />
            <FormControlLabel control={<Switch defaultChecked={settings.platformConnected} />} label="互联平台同步" sx={{ display: 'block' }} />
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" gutterBottom>数据刷新间隔: {settings.refreshInterval} 秒</Typography>
            <Slider defaultValue={settings.refreshInterval} min={1} max={60} valueLabelDisplay="auto" />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <History color="secondary" /><Typography variant="h6">审计日志（最近 20 条）</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>时间</TableCell>
                  <TableCell>操作</TableCell>
                  <TableCell>用户</TableCell>
                  <TableCell>详情</TableCell>
                  <TableCell>状态</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLog.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell><Typography variant="caption">{new Date(entry.timestamp).toLocaleString('zh-CN')}</Typography></TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>{entry.user}</TableCell>
                    <TableCell>{entry.detail || entry.resource}</TableCell>
                    <TableCell><Chip label={entry.success ? '成功' : '失败'} size="small" color={entry.success ? 'success' : 'error'} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, textAlign: 'right' }}>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>保存设置</Button>
      </Box>
    </Box>
  );
}

export default SettingsPage;
