import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Button,
  LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
} from '@mui/material';
import { BugReport, Psychology, CheckCircle, NewReleases, Search } from '@mui/icons-material';
import { aiApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';

const statusConfig = {
  resolved: { label: '已恢复', color: 'success', icon: <CheckCircle /> },
  monitoring: { label: '持续监测', color: 'warning', icon: <Search /> },
  confirmed: { label: '已确认', color: 'error', icon: <CheckCircle /> },
  investigating: { label: '调查中', color: 'warning', icon: <Search /> },
  new: { label: '新发现', color: 'info', icon: <NewReleases /> },
};

const severityConfig = {
  low: { label: '低', color: 'info' },
  medium: { label: '中', color: 'warning' },
  high: { label: '高', color: 'error' },
};

function getStatusConfig(status) {
  return statusConfig[status] || { label: status || '未知', color: 'default', icon: <BugReport /> };
}

function AnomalyDetection() {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = () => {
    setLoading(true);
    aiApi.getAnomalies().then(res => { setAnomalies(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useModeRefresh(load);

  const handleAnalyze = async (anomaly) => {
    setSelected(anomaly);
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await aiApi.analyzeAnomaly({ anomalyId: anomaly.id });
      setAnalysis(res.data);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>AI 异常检测引擎</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        深度学习模型实时分析可穿戴数据流，自动识别异常生理模式
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: '检测模型', value: '4', sub: 'CardioNet · VitalGuard · GlucoPredict · SleepAI' },
          { label: '今日检测', value: anomalies.length, sub: '异常事件' },
          { label: '平均置信度', value: anomalies.length ? `${(anomalies.reduce((s, a) => s + a.confidence, 0) / anomalies.length).toFixed(1)}%` : '—', sub: 'AI 判定准确率' },
          { label: '响应时间', value: '<2s', sub: '端到端检测延迟' },
        ].map(item => (
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
          const severity = severityConfig[anomaly.severity] || { label: '—', color: 'default' };
          return (
          <Grid item xs={12} md={6} key={anomaly.id}>
            <Card variant="outlined" sx={{ borderLeft: 4, borderColor: `${status.color}.main` }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BugReport color="error" />
                    <Typography variant="h6">{anomaly.type}</Typography>
                  </Box>
                  <Chip icon={status.icon} label={status.label} size="small" color={status.color} />
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {anomaly.detectedAt} · 严重度 {severity.label}
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>{anomaly.pattern}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip icon={<Psychology />} label={anomaly.aiModel} size="small" color="primary" variant="outlined" />
                    <Chip label={`置信度 ${anomaly.confidence}%`} size="small" color="secondary" />
                  </Box>
                  <Button size="small" variant="contained" onClick={() => handleAnalyze(anomaly)}>AI 深度分析</Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        );})}
      </Grid>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>AI 深度分析报告 - {selected?.type}</DialogTitle>
        <DialogContent>
          {analyzing ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography>AI 模型正在深度分析异常波形...</Typography>
            </Box>
          ) : analysis ? (
            <Box>
              <Alert severity="error" sx={{ mb: 2 }}>{analysis.recommendation}</Alert>
              <Typography variant="body1" paragraph>{analysis.analysis}</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Chip label={`置信度 ${analysis.confidence}%`} color="primary" />
                <Chip label={`相似案例 ${analysis.similarCases} 例`} color="info" variant="outlined" />
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>关闭</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default AnomalyDetection;
