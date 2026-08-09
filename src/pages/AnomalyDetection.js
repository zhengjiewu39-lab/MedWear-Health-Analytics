import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Button,
  LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
} from '@mui/material';
import { BugReport, Psychology, CheckCircle, NewReleases, Search } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import InterventionPathway from '../components/InterventionPathway';
import AiGovernanceBanner from '../components/AiGovernanceBanner';
import EvaluationIntegrityBanner from '../components/EvaluationIntegrityBanner';
import { researchApi } from '../services/api';
import { aiApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';
import { PROXY_SIGNALS } from '../config/paperDemo';
import { useLang } from '../contexts/LanguageContext';
import { localizeAnomalies, localizeAnomaly } from '../utils/anomalyLocale';

const statusConfig = {
  resolved: { label: '已恢复', label_en: 'Resolved', color: 'success', icon: <CheckCircle /> },
  monitoring: { label: '持续监测', label_en: 'Monitoring', color: 'warning', icon: <Search /> },
  confirmed: { label: '已确认', label_en: 'Confirmed', color: 'error', icon: <CheckCircle /> },
  investigating: { label: '调查中', label_en: 'Investigating', color: 'warning', icon: <Search /> },
  new: { label: '新发现', label_en: 'New', color: 'info', icon: <NewReleases /> },
};

const severityConfig = {
  low: { label: '低', label_en: 'Low', color: 'info' },
  medium: { label: '中', label_en: 'Medium', color: 'warning' },
  high: { label: '高', label_en: 'High', color: 'error' },
};

function getStatusConfig(status) {
  return statusConfig[status] || { label: status || '未知', label_en: status || 'Unknown', color: 'default', icon: <BugReport /> };
}

function AnomalyDetection() {
  const { t, isEn } = useLang();
  const navigate = useNavigate();
  const [rawAnomalies, setRawAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [evalFramework, setEvalFramework] = useState(null);
  const [wearableEval, setWearableEval] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      researchApi.getEvaluationFramework(),
      researchApi.getWearableResults(),
    ]).then(([fw, wRes]) => {
      if (fw.status === 'fulfilled') setEvalFramework(fw.value.data);
      if (wRes.status === 'fulfilled') setWearableEval(wRes.value.data);
    });
  }, []);

  const anomalies = useMemo(
    () => localizeAnomalies(rawAnomalies, isEn),
    [rawAnomalies, isEn],
  );

  const selectedDisplay = useMemo(
    () => (selected ? localizeAnomaly(selected, isEn) : null),
    [selected, isEn],
  );

  const load = () => {
    setLoading(true);
    aiApi.getAnomalies()
      .then(res => { setRawAnomalies(res.data || []); setLoading(false); })
      .catch(() => { setRawAnomalies([]); setLoading(false); });
  };

  useModeRefresh(load);

  const handleAnalyze = async (anomaly) => {
    setSelected(anomaly);
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await aiApi.analyzeAnomaly({ anomalyId: anomaly.id });
      setAnalysis(res.data);
    } catch (err) {
      const data = err.response?.data;
      setAnalysis({
        analysis: data?.message || t('AI 未配置或调用失败，请前往系统设置配置 API Key', 'AI not configured or request failed — configure API key in Settings'),
        recommendation: data?.needsConfig ? t('前往系统设置', 'Go to Settings') : t('请重试', 'Retry'),
        confidence: anomaly.confidence,
        needsConfig: data?.needsConfig,
        error: true,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <LinearProgress />;

  const avgConfidence = anomalies.length
    ? `${(anomalies.reduce((s, a) => s + a.confidence, 0) / anomalies.length).toFixed(1)}%`
    : '—';

  const stats = [
    { label: t('代理信号维度', 'Proxy signals'), value: PROXY_SIGNALS.length, sub: 'HR · HRV · SpO₂ · temp · steps' },
    { label: t('异常事件', 'Anomaly events'), value: anomalies.length, sub: t('个体×日 异常信号', 'Person-day anomaly signals') },
    { label: t('平均信号强度', 'Mean signal strength'), value: avgConfidence, sub: t('阈值偏离 / z-score 归一', 'Threshold deviation / z-score') },
    { label: t('判定方式', 'Method'), value: t('稳健 MAD', 'Robust MAD'), sub: t('中位数+MAD 基线 · 活动量过滤 · 启发式', 'Median+MAD baseline · activity filter · heuristic') },
  ];

  return (
    <Box>
      <InterventionPathway />
      <AiGovernanceBanner compact />
      <EvaluationIntegrityBanner framework={evalFramework} wearableResults={wearableEval} compact />
      <Typography variant="h5" gutterBottom fontWeight={600}>
        {t('个体异常检测（代理信号）', 'Individual Anomaly Detection (Proxy Signals)')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('消费级可穿戴代理信号 → 透明规则引擎（analyticsCore）：阈值 + 个人基线滚动 2σ，输出可解释的异常信号',
          'Consumer-grade wearable proxy signals → transparent rule engine (analyticsCore): thresholds + personal-baseline rolling 2σ, producing explainable anomaly signals')}
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 3 }}>
        {PROXY_SIGNALS.map((s) => (
          <Chip
            key={s.key}
            size="small"
            variant="outlined"
            color="primary"
            label={isEn
              ? `${s.label_en || s.label} · ${s.proxy_en || s.proxy}`
              : `${s.label} · ${s.proxy}`}
          />
        ))}
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map(item => (
          <Grid item xs={6} md={3} key={item.label}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={700} color="primary.main">{item.value}</Typography>
              <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
              <Typography variant="caption" color="text.secondary">{item.sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {anomalies.map(anomaly => {
          const status = getStatusConfig(anomaly.status);
          const severity = severityConfig[anomaly.severity] || { label: '—', label_en: '—', color: 'default' };
          const severityLabel = isEn ? (severity.label_en || severity.label) : severity.label;
          const statusLabel = isEn ? (status.label_en || status.label) : status.label;
          return (
          <Grid item xs={12} md={6} key={anomaly.id}>
            <Card variant="outlined" sx={{ borderLeft: 4, borderColor: `${status.color}.main` }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BugReport color="error" />
                    <Typography variant="h6">{anomaly.type}</Typography>
                  </Box>
                  <Chip icon={status.icon} label={statusLabel} size="small" color={status.color} />
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {anomaly.detectedAt} · {t('严重度', 'Severity')} {severityLabel}
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>{anomaly.pattern}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip icon={<Psychology />} label={`${t('规则', 'Rule')}: ${anomaly.aiModel}`} size="small" color="primary" variant="outlined" />
                    <Chip label={`${t('信号强度', 'Signal')} ${anomaly.confidence}%`} size="small" color="secondary" />
                  </Box>
                  <Button size="small" variant="contained" onClick={() => handleAnalyze(anomaly)}>{t('信号研判', 'Signal review')}</Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        );})}
      </Grid>

      <Button variant="outlined" startIcon={<Psychology />} sx={{ mt: 2 }} onClick={() => navigate('/ai/intervention')}>
        {t('将异常信号送入 AI 干预中心', 'Send signals to AI Intervention Hub')}
      </Button>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {t('异常信号研判', 'Anomaly Signal Review')} — {selectedDisplay?.type || selected?.type}
        </DialogTitle>
        <DialogContent>
          {analyzing ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography>{t('正在按透明规则复核代理信号偏离…', 'Re-checking proxy-signal deviations against transparent rules…')}</Typography>
            </Box>
          ) : analysis ? (
            <Box>
              <Alert severity={analysis.error ? 'warning' : 'info'} sx={{ mb: 2 }}>{analysis.recommendation}</Alert>
              <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>{analysis.analysis}</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                <Chip label={`${t('信号强度', 'Signal strength')} ${analysis.confidence}%`} color="primary" />
                {analysis.model && (
                  <Chip label={analysis.model} color={analysis.isRealAi ? 'success' : 'default'} variant="outlined" />
                )}
                {analysis.similarCases != null && (
                  <Chip label={`${t('相似案例', 'Similar cases')} ${analysis.similarCases}`} color="info" variant="outlined" />
                )}
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>{t('关闭', 'Close')}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default AnomalyDetection;
