import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, LinearProgress, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, Alert,
} from '@mui/material';
import {
  Print, LocalHospital, QrCode2, CheckCircle, Warning, MonitorHeart,
} from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { screeningApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';

const riskLabel = { low: '低风险', moderate: '中风险', high: '高风险' };
const riskChip = { low: 'success', moderate: 'warning', high: 'error' };
const flagColor = { normal: 'success', watch: 'warning', abnormal: 'error' };

function DoctorReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    screeningApi.getDoctorReport().then(res => { setReport(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useModeRefresh(load);

  const handlePrint = () => window.print();

  if (loading) return <LinearProgress />;
  if (!report) return null;

  const p = report.patient;

  return (
    <Box className="doctor-report">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2, '@media print': { display: 'none' } }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>医生接诊报告</Typography>
          <Typography variant="body2" color="text.secondary">
            供临床医生快速阅读 · 融合可穿戴连续监测与 AI 筛查结论
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" startIcon={<Print />} onClick={handlePrint}>打印 / 导出 PDF</Button>
        </Box>
      </Box>

      {/* 报告头部 — 打印友好 */}
      <Paper sx={{ p: 3, mb: 3, border: '2px solid', borderColor: 'primary.main' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant="overline" color="primary">MedWear Clinical Report</Typography>
            <Typography variant="h5" fontWeight={800} gutterBottom>{report.reportType}</Typography>
            <Typography variant="body2" color="text.secondary">
              报告编号 {report.reportId} · 生成 {new Date(report.generatedAt).toLocaleString('zh-CN')}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: { md: 'right' } }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'grey.100', borderRadius: 2 }}>
              <QrCode2 sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="caption" display="block">扫码验证</Typography>
                <Typography variant="body2" fontWeight={600}>{report.qrCode}</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={2}>
          {[
            ['姓名', p.name], ['性别/年龄', `${p.gender} / ${p.age}岁`],
            ['患者 ID', p.id], ['身高/体重', `${p.height}cm / ${p.weight}kg`],
            ['BMI', p.bmi], ['联系电话', p.phone],
            ['监测设备', p.device], ['综合风险', riskLabel[report.overallRisk]],
          ].map(([k, v]) => (
            <Grid item xs={6} sm={4} md={3} key={k}>
              <Typography variant="caption" color="text.secondary">{k}</Typography>
              <Typography variant="body1" fontWeight={600}>{v}</Typography>
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Alert severity={report.overallRisk === 'low' ? 'success' : 'warning'} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600}>医师摘要</Typography>
        {report.physicianSummary}
      </Alert>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MonitorHeart color="error" />
              <Typography variant="h6" fontWeight={600}>生命体征快照</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>指标</TableCell>
                  <TableCell>实测</TableCell>
                  <TableCell>参考</TableCell>
                  <TableCell>判定</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.vitalsSnapshot.map(v => (
                  <TableRow key={v.label} sx={{ bgcolor: v.flag !== 'normal' ? 'warning.50' : 'inherit' }}>
                    <TableCell>{v.label}</TableCell>
                    <TableCell><strong>{v.value}</strong> {v.unit}</TableCell>
                    <TableCell>{v.ref}</TableCell>
                    <TableCell>
                      <Chip
                        label={v.flag === 'normal' ? '正常' : '关注'}
                        size="small"
                        color={flagColor[v.flag] || 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>近 7 日趋势（可穿戴）</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={report.weekTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="heartRate" name="心率" stroke="#C62828" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="hrv" name="HRV" stroke="#6A1B9A" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="steps" name="步数" stroke="#1565C0" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>AI 筛查结论（肿瘤 · 癌症 · 慢病 · 心脑血管 · 常见小病 · 呼吸）</Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {report.screeningSummary.map(s => (
            <Grid item xs={12} md={4} key={s.name}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography fontWeight={600}>{s.name}</Typography>
                  <Chip label={riskLabel[s.riskLevel]} size="small" color={riskChip[s.riskLevel]} />
                </Box>
                <Typography variant="h5" fontWeight={700}>{s.score}</Typography>
                <Typography variant="caption" color="text.secondary">风险指数</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>{s.topItems.join(' · ')}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        {report.screeningHighlights.length > 0 && (
          <>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>需关注项目</Typography>
            {report.screeningHighlights.map((h, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1.5, p: 1.5, bgcolor: 'warning.50', borderRadius: 1 }}>
                <Warning color="warning" fontSize="small" />
                <Box>
                  <Typography variant="body2" fontWeight={600}>{h.category} — {h.name}（{h.risk}%）</Typography>
                  <Typography variant="body2" color="text.secondary">{h.recommendation}</Typography>
                </Box>
              </Box>
            ))}
          </>
        )}
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>融合生物标志物</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>指标</TableCell>
                  <TableCell>值</TableCell>
                  <TableCell>参考</TableCell>
                  <TableCell>来源</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.biomarkers.map(b => (
                  <TableRow key={b.name}>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>{b.value} {b.unit}</TableCell>
                    <TableCell>{b.ref}</TableCell>
                    <TableCell><Typography variant="caption">{b.source}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>异常事件 & 预警</Typography>
            {report.anomalies.map(a => (
              <Box key={a.id} sx={{ mb: 1.5, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={600}>{a.type} · 置信度 {a.confidence}%</Typography>
                <Typography variant="caption" color="text.secondary">{a.detectedAt}</Typography>
                <Typography variant="body2">{a.pattern}</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1 }} />
            {report.alerts.map(a => (
              <Box key={a.id} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <CheckCircle color="info" fontSize="small" />
                <Typography variant="body2">{a.type}: {a.message}</Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>数据来源 & 建议加查项目</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            {report.dataSources.map(s => (
              <Box key={s.device} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={600}>{s.device}（权重 {(s.weight * 100).toFixed(0)}%）</Typography>
                <Typography variant="caption">{s.metrics.join('、')} · 质量 {s.quality}%</Typography>
              </Box>
            ))}
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {report.recommendedExams.map(e => (
                <Chip key={e} icon={<LocalHospital />} label={e} variant="outlined" />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
        {report.clinicalNotes.map((n, i) => (
          <Typography key={i} variant="caption" color="text.secondary" display="block">• {n}</Typography>
        ))}
      </Paper>
    </Box>
  );
}

export default DoctorReport;
