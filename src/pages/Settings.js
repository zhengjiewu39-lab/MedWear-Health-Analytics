import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Switch, FormControlLabel, TextField,
  Button, Chip, Divider, Alert, Table, TableBody, TableCell, TableHead, TableRow,
  MenuItem, Stack,
} from '@mui/material';
import {
  NotificationsActive, Security, Save, Lock, History,
  Translate, VerifiedUser, SmartToy,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import { settingsApi, securityApi } from '../services/api';
import { useLang } from '../contexts/LanguageContext';

const PROVIDER_COLORS = {
  openai: '#10a37f',
  deepseek: '#4d6bfe',
  gemini: '#4285f4',
  grok: '#1d9bf0',
  claude: '#d97757',
};

const KEY_PLACEHOLDERS = {
  openai: 'sk-...',
  deepseek: 'sk-...',
  gemini: 'AIza...',
  grok: 'xai-...',
  claude: 'sk-ant-...',
};

function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [vault, setVault] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [saved, setSaved] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const { t, isEn, lang, setLang } = useLang();

  const refresh = () => {
    settingsApi.get().then((res) => {
      setSettings(res.data);
      const next = {};
      (res.data.aiProviders || []).forEach((p) => {
        next[p.id] = { model: p.selectedModel || p.defaultModel, apiKey: '' };
      });
      setDrafts(next);
    });
    securityApi.getVaultStatus().then((res) => setVault(res.data)).catch(() => {});
    securityApi.getAuditLog(20).then((res) => setAuditLog(res.data)).catch(() => {});
  };

  useEffect(() => { refresh(); }, []);

  const updateDraft = (id, field, value) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveProvider = async (p) => {
    const draft = drafts[p.id] || {};
    if (!draft.apiKey?.trim()) {
      setActionMsg(t('请填写 API Key', 'Please enter an API Key'));
      return;
    }
    setSavingId(p.id);
    try {
      await settingsApi.saveAi({
        provider: p.id,
        apiKey: draft.apiKey.trim(),
        model: draft.model || p.defaultModel,
        setActive: true,
      });
      setActionMsg(t(
        `${isEn ? p.label_en : p.label} 已保存并设为当前模型`,
        `${p.label_en || p.label} saved and set as active`,
      ));
      setDrafts((prev) => ({ ...prev, [p.id]: { ...prev[p.id], apiKey: '' } }));
      refresh();
    } finally {
      setSavingId(null);
    }
  };

  const activateProvider = async (p) => {
    if (!p.apiKeySet) {
      setActionMsg(t('请先为该模型配置 API Key', 'Configure an API Key for this provider first'));
      return;
    }
    setSavingId(p.id);
    try {
      await settingsApi.saveAi({
        provider: p.id,
        model: drafts[p.id]?.model || p.selectedModel || p.defaultModel,
        setActive: true,
      });
      setActionMsg(t(
        `已切换至 ${isEn ? p.label_en : p.label}`,
        `Switched to ${p.label_en || p.label}`,
      ));
      refresh();
    } finally {
      setSavingId(null);
    }
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const syncVault = async () => {
    const res = await securityApi.syncVault();
    setVault(await securityApi.getVaultStatus().then((r) => r.data));
    setActionMsg(t(`健康数据已加密同步 (${res.data.algorithm})`, `Health data encrypted sync (${res.data.algorithm})`));
    securityApi.getAuditLog(20).then((r) => setAuditLog(r.data));
  };

  const exportData = async (anonymize) => {
    await securityApi.exportData(anonymize);
    setActionMsg(t(
      anonymize ? '脱敏数据已导出（审计已记录）' : '完整数据已导出（审计已记录）',
      anonymize ? 'Anonymized export completed (audited)' : 'Full export completed (audited)',
    ));
    securityApi.getAuditLog(20).then((r) => setAuditLog(r.data));
  };

  if (!settings) return null;

  return (
    <Box>
      <PageHeader
        title={t('系统设置', 'Settings')}
        subtitle={t(
          '多模型 AI 接入 · AES-256-GCM 加密 · 登录锁定 · 操作审计',
          'Multi-model AI · AES-256-GCM encryption · login lockout · audit trail',
        )}
        badge={<Chip size="small" color="success" icon={<VerifiedUser />} label={settings.securityLevel || 'enhanced'} />}
      />

      {saved && <Alert severity="success" sx={{ mb: 2 }}>{t('设置已保存', 'Settings saved')}</Alert>}
      {actionMsg && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setActionMsg('')}>{actionMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Translate color="primary" />
              <Typography variant="h6">{t('语言 / Language', 'Language')}</Typography>
            </Stack>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant={lang === 'zh' ? 'contained' : 'outlined'} onClick={() => setLang('zh')}>中文简体</Button>
              <Button variant={lang === 'en' ? 'contained' : 'outlined'} onClick={() => setLang('en')}>English</Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <SmartToy color="primary" />
              <Typography variant="h6">{t('AI 模型提供商', 'AI Provider')}</Typography>
              <Chip
                size="small"
                label={settings.aiConfigured ? t('已接入真实 LLM', 'Live LLM connected') : t('未配置', 'Not configured')}
                color={settings.aiConfigured ? 'success' : 'warning'}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(
                '每个模型后可直接填写 API Key 并保存。已配置的 Key 加密存储，界面不回显。',
                'Enter an API Key after each model and save. Stored keys are encrypted and never shown again.',
              )}
            </Typography>
            <Stack spacing={1.5}>
              {(settings.aiProviders || []).map((p) => {
                const draft = drafts[p.id] || { model: p.selectedModel, apiKey: '' };
                const color = PROVIDER_COLORS[p.id] || 'primary.main';
                return (
                  <Paper
                    key={p.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderColor: p.isActive ? color : 'divider',
                      borderWidth: p.isActive ? 2 : 1,
                      bgcolor: p.isActive ? `${color}06` : 'background.paper',
                    }}
                  >
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid item xs={12} sm={3} md={2}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="subtitle2" fontWeight={800} sx={{ color }}>
                            {isEn ? p.label_en : p.label}
                          </Typography>
                          {p.isActive && (
                            <Chip size="small" color="primary" label={t('当前', 'Active')} />
                          )}
                          {p.apiKeySet && (
                            <Chip size="small" color="success" variant="outlined" label={t('已配置', 'Set')} />
                          )}
                        </Stack>
                      </Grid>
                      <Grid item xs={12} sm={3} md={3}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label={t('模型', 'Model')}
                          value={draft.model || p.selectedModel}
                          onChange={(e) => updateDraft(p.id, 'model', e.target.value)}
                        >
                          {(p.models || []).map((m) => (
                            <MenuItem key={m} value={m}>{m}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={4} md={4}>
                        <TextField
                          fullWidth
                          type="password"
                          size="small"
                          label="API Key"
                          value={draft.apiKey || ''}
                          onChange={(e) => updateDraft(p.id, 'apiKey', e.target.value)}
                          placeholder={KEY_PLACEHOLDERS[p.id] || 'sk-...'}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2} md={3}>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Button
                            variant="contained"
                            size="small"
                            disabled={savingId === p.id || !draft.apiKey?.trim()}
                            onClick={() => saveProvider(p)}
                          >
                            {t('保存', 'Save')}
                          </Button>
                          {p.apiKeySet && !p.isActive && (
                            <Button
                              variant="outlined"
                              size="small"
                              disabled={savingId === p.id}
                              onClick={() => activateProvider(p)}
                            >
                              {t('启用', 'Use')}
                            </Button>
                          )}
                        </Stack>
                      </Grid>
                    </Grid>
                  </Paper>
                );
              })}
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
              {t('环境变量（可选）：OPENAI_API_KEY / DEEPSEEK_API_KEY / GEMINI_API_KEY / GROK_API_KEY / ANTHROPIC_API_KEY',
                'Optional env vars: OPENAI_API_KEY / DEEPSEEK_API_KEY / GEMINI_API_KEY / GROK_API_KEY / ANTHROPIC_API_KEY')}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <NotificationsActive color="warning" />
              <Typography variant="h6">{t('告警阈值', 'Alert thresholds')}</Typography>
            </Stack>
            {[
              { label: t('心率上限 (bpm)', 'HR max (bpm)'), value: settings.alertThresholds.heartRateMax },
              { label: t('心率下限 (bpm)', 'HR min (bpm)'), value: settings.alertThresholds.heartRateMin },
              { label: t('血氧下限 (%)', 'SpO₂ min (%)'), value: settings.alertThresholds.spo2Min },
              { label: t('血糖上限 (mmol/L)', 'Glucose max'), value: settings.alertThresholds.glucoseMax },
            ].map((item) => (
              <TextField key={item.label} fullWidth label={item.label} defaultValue={item.value}
                type="number" size="small" sx={{ mb: 2 }} />
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Security color="success" />
              <Typography variant="h6">{t('数据安全', 'Data security')}</Typography>
            </Stack>
            <FormControlLabel control={<Switch defaultChecked={settings.encryptionEnabled} />}
              label={`${t('端到端加密', 'E2E encryption')} (${settings.encryptionAlgorithm || 'AES-256-GCM'})`} />
            <FormControlLabel control={<Switch defaultChecked={settings.auditLogEnabled} />}
              label={t('操作审计日志', 'Audit log')} sx={{ display: 'block' }} />
            <FormControlLabel control={<Switch defaultChecked={settings.anonymizeExport} />}
              label={t('导出默认脱敏', 'Anonymize exports')} sx={{ display: 'block' }} />
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2">
              {t('加密保险库', 'Encrypted vault')}: {vault?.encrypted ? `${t('已同步', 'Synced')} (${vault.lastSync})` : t('未同步', 'Not synced')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              <Button variant="contained" size="small" startIcon={<Lock />} onClick={syncVault}>
                {t('加密同步', 'Encrypt sync')}
              </Button>
              <Button variant="outlined" size="small" onClick={() => exportData(true)}>
                {t('脱敏导出', 'Anonymized export')}
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <History color="secondary" />
              <Typography variant="h6">{t('审计日志（最近 20 条）', 'Audit log (last 20)')}</Typography>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('时间', 'Time')}</TableCell>
                  <TableCell>{t('操作', 'Action')}</TableCell>
                  <TableCell>{t('用户', 'User')}</TableCell>
                  <TableCell>{t('详情', 'Detail')}</TableCell>
                  <TableCell>{t('状态', 'Status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell><Typography variant="caption">{new Date(entry.timestamp).toLocaleString()}</Typography></TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>{entry.user}</TableCell>
                    <TableCell>{entry.detail || entry.resource}</TableCell>
                    <TableCell>
                      <Chip label={entry.success ? t('成功', 'OK') : t('失败', 'Fail')} size="small"
                        color={entry.success ? 'success' : 'error'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, textAlign: 'right' }}>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>{t('保存设置', 'Save settings')}</Button>
      </Box>
    </Box>
  );
}

export default SettingsPage;
