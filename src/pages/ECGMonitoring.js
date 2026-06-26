import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, ToggleButton, ToggleButtonGroup,
  Alert, Card, CardContent,
} from '@mui/material';
import { Favorite, Psychology, Warning } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';

function generateECGPoint(index, type) {
  const t = index / 10;
  if (type === 'normal') {
    const p = Math.exp(-Math.pow((t % 1 - 0.15) * 20, 2)) * 0.15;
    const qrs = Math.exp(-Math.pow((t % 1 - 0.35) * 40, 2)) * 1.2;
    const tWave = Math.exp(-Math.pow((t % 1 - 0.55) * 15, 2)) * 0.25;
    return { index, value: p + qrs + tWave + (Math.random() - 0.5) * 0.02 };
  }
  // 房颤模拟 - 不规则波形
  const irregular = Math.sin(t * 8 + Math.random() * 2) * 0.3 + Math.random() * 0.4;
  const qrs = Math.random() > 0.6 ? Math.exp(-Math.pow((t % 0.7 - 0.3) * 30, 2)) * 0.8 : 0;
  return { index, value: irregular + qrs };
}

function ECGMonitoring() {
  const [ecgData, setEcgData] = useState([]);
  const [mode, setMode] = useState('normal');
  const [heartRate, setHeartRate] = useState(78);
  const [analysis, setAnalysis] = useState(null);

  const refreshECG = useCallback(() => {
    const base = Date.now();
    const points = Array.from({ length: 120 }, (_, i) => generateECGPoint(base + i, mode));
    setEcgData(points);
    setHeartRate(mode === 'normal' ? 72 + Math.floor(Math.random() * 12) : 95 + Math.floor(Math.random() * 40));
  }, [mode]);

  useEffect(() => {
    refreshECG();
    const interval = setInterval(refreshECG, 2000);
    return () => clearInterval(interval);
  }, [refreshECG]);

  useEffect(() => {
    if (mode === 'afib') {
      setAnalysis({
        rhythm: '疑似房颤',
        severity: 'critical',
        detail: 'AI 检测到 RR 间期绝对不规则，存在典型 f 波特征，建议立即临床评估。',
        confidence: 94.2,
      });
    } else {
      setAnalysis({
        rhythm: '窦性心律',
        severity: 'normal',
        detail: 'P-QRS-T 波形正常，心律规整，未见明显 ST-T 改变。',
        confidence: 97.8,
      });
    }
  }, [mode]);

  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 2 }}>
        <strong>演示说明：</strong>本页 ECG 波形为程序生成的 UI 演示，<strong>非</strong> Apple Health 真实心电数据，不可用于临床诊断。
      </Alert>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>ECG 心电监测</Typography>
          <Typography variant="body2" color="text.secondary">患者: 王强 · 心电贴片 ECG-200 · 采样率 250Hz</Typography>
        </Box>
        <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)} size="small">
          <ToggleButton value="normal">正常心律</ToggleButton>
          <ToggleButton value="afib">房颤模拟</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">实时 ECG 波形</Typography>
              <Chip label="LIVE" color="error" size="small" className="live-indicator" />
            </Box>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={ecgData}>
                <XAxis dataKey="index" hide />
                <YAxis domain={[-0.2, 1.5]} hide />
                <ReferenceLine y={0} stroke="#ccc" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="value" stroke="#C62828" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Favorite color="error" />
                <Typography variant="h5" fontWeight={700}>{heartRate}</Typography>
                <Typography variant="body2" color="text.secondary">bpm</Typography>
              </Box>
              <Chip label={`增益 10mm/mV · 走速 25mm/s`} size="small" variant="outlined" />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 2, borderLeft: 4, borderColor: analysis?.severity === 'critical' ? 'error.main' : 'success.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Psychology color="primary" />
                <Typography variant="h6">AI 心律分析</Typography>
              </Box>
              {analysis && (
                <>
                  <Typography variant="h5" fontWeight={700} color={analysis.severity === 'critical' ? 'error.main' : 'success.main'} gutterBottom>
                    {analysis.rhythm}
                  </Typography>
                  <Typography variant="body2" paragraph>{analysis.detail}</Typography>
                  <Chip label={`CardioNet-v3 · 置信度 ${analysis.confidence}%`} size="small" color="primary" variant="outlined" />
                </>
              )}
            </CardContent>
          </Card>

          {analysis?.severity === 'critical' && (
            <Alert severity="error" icon={<Warning />} sx={{ mb: 2 }}>
              检测到危急心律异常，已自动推送至预警中心并通知值班医生。
            </Alert>
          )}

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>ECG 参数</Typography>
            {[
              { label: 'PR 间期', value: '160 ms', normal: true },
              { label: 'QRS 时限', value: '88 ms', normal: true },
              { label: 'QT/QTc', value: '380/420 ms', normal: true },
              { label: '电轴', value: '+45°', normal: true },
            ].map(p => (
              <Box key={p.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" color="text.secondary">{p.label}</Typography>
                <Typography variant="body2" fontWeight={600}>{p.value}</Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default ECGMonitoring;
