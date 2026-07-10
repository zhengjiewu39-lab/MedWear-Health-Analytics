import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, LinearProgress, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, Alert,
} from '@mui/material';
import {
  Print, LocalHospital, QrCode2, CheckCircle, Warning, MonitorHeart,
} from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import ChartContainer from '../components/ChartContainer';
import InterventionPathway from '../components/InterventionPathway';
import AiGovernanceBanner from '../components/AiGovernanceBanner';
import { screeningApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';
import { useLang } from '../contexts/LanguageContext';

const riskLabel = { low: '低风险', moderate: '中风险', high: '高风险' };
const riskLabelEn = { low: 'Low Risk', moderate: 'Moderate Risk', high: 'High Risk' };
const riskChip = { low: 'success', moderate: 'warning', high: 'error' };
const flagColor = { normal: 'success', watch: 'warning', abnormal: 'error' };

function DoctorReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t, isEn } = useLang();
  const rl = (k) => t(riskLabel[k], riskLabelEn[k]);
  const pick = (obj, field) => (isEn && obj?.[`${field}_en`]) || obj?.[field];

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
      <Box sx={{ '@media print': { display: 'none' } }}>
        <InterventionPathway />
        <AiGovernanceBanner />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2, '@media print': { display: 'none' } }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('医生接诊报告', 'Physician Consultation Report')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('供临床医生快速阅读 · 融合可穿戴连续监测与 AI 筛查结论', 'For rapid physician review · Integrating continuous wearable monitoring with AI screening conclusions')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" startIcon={<Print />} onClick={handlePrint}>{t('打印 / 导出 PDF', 'Print / Export PDF')}</Button>
        </Box>
      </Box>

      {/* 报告头部 — 打印友好 */}
      <Paper sx={{ p: 3, mb: 3, border: '2px solid', borderColor: 'primary.main' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant="overline" color="primary">MedWear Clinical Report</Typography>
            <Typography variant="h5" fontWeight={800} gutterBottom>{pick(report, 'reportType')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('报告编号', 'Report No.')} {report.reportId} · {t('生成', 'Generated')} {new Date(report.generatedAt).toLocaleString()}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: { md: 'right' } }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'grey.100', borderRadius: 2 }}>
              <QrCode2 sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="caption" display="block">{t('扫码验证', 'Scan to verify')}</Typography>
                <Typography variant="body2" fontWeight={600}>{report.qrCode}</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={2}>
          {[
            [t('姓名', 'Name'), p.name], [t('性别/年龄', 'Sex / Age'), `${p.gender} / ${p.age}${t('岁', ' yrs')}`],
            [t('患者 ID', 'Patient ID'), p.id], [t('身高/体重', 'Height / Weight'), `${p.height}cm / ${p.weight}kg`],
            ['BMI', p.bmi], [t('联系电话', 'Phone'), p.phone],
            [t('监测设备', 'Device'), p.device], [t('综合风险', 'Overall risk'), rl(report.overallRisk)],
          ].map(([k, v]) => (
            <Grid item xs={6} sm={4} md={3} key={k}>
              <Typography variant="caption" color="text.secondary">{k}</Typography>
              <Typography variant="body1" fontWeight={600}>{v}</Typography>
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Alert severity={report.overallRisk === 'low' ? 'success' : 'warning'} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600}>{t('医师摘要', 'Physician summary')}</Typography>
        {pick(report, 'physicianSummary')}
      </Alert>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MonitorHeart color="error" />
              <Typography variant="h6" fontWeight={600}>{t('生命体征快照', 'Vital signs snapshot')}</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('指标', 'Metric')}</TableCell>
                  <TableCell>{t('实测', 'Measured')}</TableCell>
                  <TableCell>{t('参考', 'Reference')}</TableCell>
                  <TableCell>{t('判定', 'Flag')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.vitalsSnapshot.map(v => (
                  <TableRow key={v.label} sx={{ bgcolor: v.flag !== 'normal' ? 'warning.50' : 'inherit' }}>
                    <TableCell>{pick(v, 'label')}</TableCell>
                    <TableCell><strong>{v.value}</strong> {v.unit}</TableCell>
                    <TableCell>{v.ref}</TableCell>
                    <TableCell>
                      <Chip
                        label={v.flag === 'normal' ? t('正常', 'Normal') : t('关注', 'Watch')}
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
            <Typography variant="h6" fontWeight={600} gutterBottom>{t('近 7 日趋势（可穿戴）', '7-Day Trend (Wearable)')}</Typography>
            <ChartContainer width="100%" height={220}>
              <LineChart data={report.weekTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="heartRate" name={t('心率', 'Heart rate')} stroke="#C62828" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="hrv" name="HRV" stroke="#6A1B9A" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="steps" name={t('步数', 'Steps')} stroke="#1565C0" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>{t('AI 筛查结论（肿瘤 · 癌症 · 慢病 · 心脑血管 · 常见小病 · 呼吸）', 'AI Screening Conclusions (Tumor · Cancer · Chronic · Cardio-Cerebrovascular · Common · Respiratory)')}</Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {report.screeningSummary.map(s => (
            <Grid item xs={12} md={4} key={s.name}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography fontWeight={600}>{pick(s, 'name')}</Typography>
                  <Chip label={rl(s.riskLevel)} size="small" color={riskChip[s.riskLevel]} />
                </Box>
                <Typography variant="h5" fontWeight={700}>{s.score}</Typography>
                <Typography variant="caption" color="text.secondary">{t('风险指数', 'Risk index')}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>{s.topItems.join(' · ')}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        {report.screeningHighlights.length > 0 && (
          <>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>{t('需关注项目', 'Items needing attention')}</Typography>
            {report.screeningHighlights.map((h, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1.5, p: 1.5, bgcolor: 'warning.50', borderRadius: 1 }}>
                <Warning color="warning" fontSize="small" />
                <Box>
                  <Typography variant="body2" fontWeight={600}>{pick(h, 'category')} — {pick(h, 'name')}（{h.risk}%）</Typography>
                  <Typography variant="body2" color="text.secondary">{pick(h, 'recommendation')}</Typography>
                </Box>
              </Box>
            ))}
          </>
        )}
      </Paper>

      {/* Physician-reviewed AI interventions */}
      <Paper sx={{ p: 3, mb: 3, borderLeft: 4, borderColor: 'success.main' }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {t('医师裁定 · 已批准 AI 干预', 'Physician authority · approved AI interventions')}
        </Typography>
        {report.physicianAuthority && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {pick(report.physicianAuthority, 'note')}
          </Alert>
        )}
        {(report.aiInterventions || []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('尚无已批准干预 — 请先在 AI 干预中心审批', 'No approved interventions — review in AI Intervention Hub first')}
          </Typography>
        ) : (
          report.aiInterventions.map((iv) => (
            <Box key={iv.id} sx={{ mb: 1.5, p: 1.5, bgcolor: 'success.50', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
                <Typography variant="body2" fontWeight={700}>{isEn ? iv.title_en : iv.title}</Typography>
                <Chip size="small" color="success" label={t('已批准', 'Approved')} />
              </Box>
              <Typography variant="body2">{isEn ? iv.action_en : iv.action}</Typography>
              <Typography variant="caption" color="text.secondary">
                {iv.aiModel} · {iv.confidence}% · {iv.reviewedBy}
              </Typography>
            </Box>
          ))
        )}
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>{t('融合生物标志物', 'Fused biomarkers')}</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('指标', 'Metric')}</TableCell>
                  <TableCell>{t('值', 'Value')}</TableCell>
                  <TableCell>{t('参考', 'Reference')}</TableCell>
                  <TableCell>{t('来源', 'Source')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.biomarkers.map(b => (
                  <TableRow key={b.name}>
                    <TableCell>{pick(b, 'name')}</TableCell>
                    <TableCell>{b.value} {b.unit}</TableCell>
                    <TableCell>{b.ref}</TableCell>
                    <TableCell><Typography variant="caption">{pick(b, 'source')}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>{t('异常事件 & 预警', 'Anomaly events & alerts')}</Typography>
            {report.anomalies.map(a => (
              <Box key={a.id} sx={{ mb: 1.5, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={600}>{pick(a, 'type')} · {t('置信度', 'confidence')} {a.confidence}%</Typography>
                <Typography variant="caption" color="text.secondary">{a.detectedAt}</Typography>
                <Typography variant="body2">{pick(a, 'pattern')}</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1 }} />
            {report.alerts.map(a => (
              <Box key={a.id} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <CheckCircle color="info" fontSize="small" />
                <Typography variant="body2">{pick(a, 'type')}: {pick(a, 'message')}</Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>{t('数据来源 & 建议加查项目', 'Data sources & recommended additional exams')}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            {report.dataSources.map(s => (
              <Box key={s.device} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={600}>{s.device}（{t('权重', 'weight')} {(s.weight * 100).toFixed(0)}%）</Typography>
                <Typography variant="caption">{((isEn && s.metrics_en) || s.metrics).join(t('、', ', '))} · {t('质量', 'quality')} {s.quality}%</Typography>
              </Box>
            ))}
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {((isEn && report.recommendedExams_en) || report.recommendedExams).map(e => (
                <Chip key={e} icon={<LocalHospital />} label={e} variant="outlined" />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
        {((isEn && report.clinicalNotes_en) || report.clinicalNotes).map((n, i) => (
          <Typography key={i} variant="caption" color="text.secondary" display="block">• {n}</Typography>
        ))}
      </Paper>
    </Box>
  );
}

export default DoctorReport;
