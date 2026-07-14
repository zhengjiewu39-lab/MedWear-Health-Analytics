import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, LinearProgress, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, Alert, TextField,
  MenuItem, Stack, CircularProgress,
} from '@mui/material';
import {
  Print, LocalHospital, QrCode2, CheckCircle, Warning, MonitorHeart,
  Edit, Save, AutoAwesome, Download,
} from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { CHART } from '../config/chartTheme';
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

const SOURCE_LABEL = {
  composite: { zh: '综合', en: 'Composite' },
  demographics: { zh: '人口学', en: 'Demographics' },
  wearable: { zh: '可穿戴', en: 'Wearable' },
  screening: { zh: 'AI筛查', en: 'AI screening' },
  anomaly: { zh: '异常检测', en: 'Anomaly' },
  prediction: { zh: '预测分析', en: 'Prediction' },
  lifestyle: { zh: '行为', en: 'Behavior' },
  cohort: { zh: '队列', en: 'Cohort' },
};

const LEVEL_CHIP = { high: 'error', moderate: 'warning', low: 'success' };
const LEVEL_LABEL = { high: '高', moderate: '中', low: '低' };
const LEVEL_LABEL_EN = { high: 'High', moderate: 'Moderate', low: 'Low' };

const GENDER_OPTIONS = [
  { value: '男', value_en: 'Male' },
  { value: '女', value_en: 'Female' },
  { value: '其他', value_en: 'Other' },
];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DoctorReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', gender: '男', age: '', height: '', weight: '', phone: '' });
  const { t, isEn } = useLang();
  const rl = (k) => t(riskLabel[k], riskLabelEn[k]);
  const pick = (obj, field) => (isEn && obj?.[`${field}_en`]) || obj?.[field];

  const syncForm = (data) => {
    const p = data?.patient || {};
    setForm({
      name: p.name && p.name !== '—' ? p.name : '',
      gender: p.gender && p.gender !== '—' ? p.gender : '男',
      age: p.age ?? '',
      height: p.height ?? '',
      weight: p.weight ?? '',
      phone: p.phone && !String(p.phone).includes('****') ? p.phone : '',
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await screeningApi.getDoctorReport();
      if (res.data?.needsImport) {
        setReport(res.data);
        return;
      }
      setReport(res.data);
      syncForm(res.data);
    } catch {
      setError(t('无法加载医生报告', 'Failed to load doctor report'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useModeRefresh(load);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    try {
      await screeningApi.saveDoctorReportProfile({
        name: form.name,
        gender: form.gender,
        gender_en: GENDER_OPTIONS.find((g) => g.value === form.gender)?.value_en,
        age: form.age === '' ? null : Number(form.age),
        height: form.height === '' ? null : Number(form.height),
        weight: form.weight === '' ? null : Number(form.weight),
        phone: form.phone,
      });
      const res = await screeningApi.generateDoctorReport({ profile: form, useAi: false });
      setReport(res.data);
      syncForm(res.data);
      setEditing(false);
    } catch {
      setError(t('保存患者信息失败', 'Failed to save patient info'));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAi = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await screeningApi.generateDoctorReport({ profile: form, useAi: true });
      setReport(res.data);
      syncForm(res.data);
    } catch {
      setError(t('AI 报告生成失败', 'AI report generation failed'));
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const res = await screeningApi.exportDoctorReport(format);
      const id = report?.reportId || 'report';
      if (format === 'html') {
        downloadBlob(res.data, `medwear-${id}.html`);
      } else {
        const payload = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        downloadBlob(new Blob([payload], { type: 'application/json' }), `medwear-${id}.json`);
      }
    } catch {
      setError(t('导出失败', 'Export failed'));
    }
  };

  const handlePrint = () => window.print();

  const bmiPreview = form.height && form.weight
    ? (Number(form.weight) / ((Number(form.height) / 100) ** 2)).toFixed(1)
    : null;

  if (loading) return <LinearProgress />;
  if (!report) return null;

  if (report.needsImport) {
    return (
      <Box>
        <Alert severity="warning">{pick(report, 'message') || t('请先导入 Apple Health 数据', 'Import Apple Health data first')}</Alert>
      </Box>
    );
  }

  const p = report.patient;
  const isHealthScore = report.overallScoreType === 'health' || report.mode === 'real';

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
            {t('医师可录入人口学信息 · 融合 Apple Health 真实数据 · AI 整理完整报告并可导出',
              'Clinician-entered demographics · fused real Apple Health data · AI-composed full report with export')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="outlined" startIcon={<Edit />} onClick={() => setEditing((e) => !e)}>
            {editing ? t('收起编辑', 'Close editor') : t('编辑患者信息', 'Edit patient info')}
          </Button>
          <Button variant="outlined" startIcon={<Download />} onClick={() => handleExport('json')}>
            {t('导出 JSON', 'Export JSON')}
          </Button>
          <Button variant="outlined" startIcon={<Download />} onClick={() => handleExport('html')}>
            {t('导出 HTML', 'Export HTML')}
          </Button>
          <Button variant="contained" startIcon={<Print />} onClick={handlePrint}>
            {t('打印 / PDF', 'Print / PDF')}
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, '@media print': { display: 'none' } }}>{error}</Alert>}

      {editing && (
        <Paper sx={{ p: 3, mb: 3, '@media print': { display: 'none' } }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>{t('患者基本信息（医师录入）', 'Patient demographics (clinician-entered)')}</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            {pick(report, 'demographicsNote') || t('Apple Health 无法提供身高体重等，请接诊时询问并录入',
              'Apple Health does not provide height/weight — please ask and enter during consultation')}
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth label={t('姓名', 'Name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth select label={t('性别', 'Sex')} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                {GENDER_OPTIONS.map((g) => (
                  <MenuItem key={g.value} value={g.value}>{isEn ? g.value_en : g.value}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField fullWidth type="number" label={t('年龄', 'Age')} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField fullWidth type="number" label={t('身高 (cm)', 'Height (cm)')} value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField fullWidth type="number" label={t('体重 (kg)', 'Weight (kg)')} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={4} md={4}>
              <TextField fullWidth label={t('联系电话', 'Phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Grid>
            {bmiPreview && (
              <Grid item xs={12}>
                <Chip label={`BMI ${bmiPreview}`} color={Number(bmiPreview) >= 18.5 && Number(bmiPreview) < 24 ? 'success' : 'warning'} />
              </Grid>
            )}
          </Grid>
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />} onClick={handleSaveProfile} disabled={saving || generating}>
              {t('保存并更新报告', 'Save & update report')}
            </Button>
            <Button variant="outlined" startIcon={generating ? <CircularProgress size={18} /> : <AutoAwesome />} onClick={handleGenerateAi} disabled={saving || generating}>
              {t('AI 重新整理完整报告', 'AI regenerate full report')}
            </Button>
          </Box>
          {report.aiNote && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>{report.aiNote}</Typography>
          )}
        </Paper>
      )}

      <Paper sx={{ p: 3, mb: 3, border: '2px solid', borderColor: 'primary.main' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant="overline" color="primary">MedWear Clinical Report</Typography>
            <Typography variant="h5" fontWeight={800} gutterBottom>{pick(report, 'reportType')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('报告编号', 'Report No.')} {report.reportId} · {t('生成', 'Generated')} {new Date(report.generatedAt).toLocaleString()}
              {report.aiGenerated && <Chip size="small" label={`AI · ${report.aiModel || ''}`} color="primary" sx={{ ml: 1 }} />}
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
            [t('姓名', 'Name'), p.name || '—'],
            [t('性别/年龄', 'Sex / Age'), `${p.gender || '—'} / ${p.age != null ? `${p.age}${t('岁', ' yrs')}` : '—'}`],
            [t('患者 ID', 'Patient ID'), p.id],
            [t('身高/体重', 'Height / Weight'), p.height && p.weight ? `${p.height}cm / ${p.weight}kg` : t('待录入', 'Pending entry')],
            ['BMI', p.bmi ?? (t('待录入', 'Pending entry'))],
            [t('联系电话', 'Phone'), p.phone || '—'],
            [t('监测设备', 'Device'), p.device || '—'],
            [isHealthScore ? t('健康评分', 'Health score') : t('综合风险', 'Overall risk'),
              isHealthScore ? `${report.overallScore}/100 · ${rl(report.overallRisk)}` : rl(report.overallRisk)],
          ].map(([k, v]) => (
            <Grid item xs={6} sm={4} md={3} key={k}>
              <Typography variant="caption" color="text.secondary">{k}</Typography>
              <Typography variant="body1" fontWeight={600}>{v}</Typography>
            </Grid>
          ))}
        </Grid>
        {report.bmiAssessment?.value && (
          <Chip
            sx={{ mt: 1 }}
            size="small"
            label={`BMI ${report.bmiAssessment.value} · ${isEn ? report.bmiAssessment.category_en : report.bmiAssessment.category}`}
            color={report.bmiAssessment.flag === 'normal' ? 'success' : 'warning'}
          />
        )}
      </Paper>

      <Alert severity={report.overallRisk === 'low' ? 'success' : 'warning'} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600}>{t('医师摘要', 'Physician summary')}</Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{pick(report, 'physicianSummary')}</Typography>
      </Alert>

      {(report.riskFactors?.length > 0 || report.followUpPlan?.length > 0) && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {report.riskFactors?.length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>{t('综合风险因素', 'Combined risk factors')}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  {t('融合人口学、可穿戴、AI 筛查、异常检测与预测分析', 'Demographics, wearables, AI screening, anomalies & predictions')}
                </Typography>
                {report.riskFactors.map((r, i) => (
                  <Box
                    key={i}
                    sx={{
                      mb: 1.25,
                      p: 1.25,
                      borderRadius: 1,
                      bgcolor: r.level === 'high' ? 'error.50' : r.level === 'moderate' ? 'warning.50' : 'grey.50',
                      borderLeft: 3,
                      borderColor: r.level === 'high' ? 'error.main' : r.level === 'moderate' ? 'warning.main' : 'success.main',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}>
                      <Chip
                        size="small"
                        label={t(LEVEL_LABEL[r.level] || r.level, LEVEL_LABEL_EN[r.level] || r.level)}
                        color={LEVEL_CHIP[r.level] || 'default'}
                        sx={{ fontWeight: 700, height: 22 }}
                      />
                      <Chip
                        size="small"
                        label={t(SOURCE_LABEL[r.source]?.zh || r.source, SOURCE_LABEL[r.source]?.en || r.source)}
                        variant="outlined"
                        sx={{ height: 22 }}
                      />
                    </Box>
                    <Typography variant="body2">{pick(r, 'factor')}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
          )}
          {report.followUpPlan?.length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>{t('随访与加查计划', 'Follow-up & additional workup')}</Typography>
                {report.followUpPlan.map((f, i) => (
                  <Box key={i} sx={{ mb: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{pick(f, 'action')}</Typography>
                    <Typography variant="caption" color="text.secondary">{pick(f, 'horizon')} · {f.priority}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

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
                    <TableCell><strong>{v.value ?? '—'}</strong> {v.unit}</TableCell>
                    <TableCell>{v.ref}</TableCell>
                    <TableCell>
                      <Chip label={v.flag === 'normal' ? t('正常', 'Normal') : t('关注', 'Watch')} size="small" color={flagColor[v.flag] || 'default'} />
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
              <LineChart data={report.weekTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="heartRate" name={t('心率', 'Heart rate')} stroke={CHART.danger} strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="hrv" name="HRV" stroke={CHART.series[2]} strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="steps" name={t('步数', 'Steps')} stroke={CHART.intervention} strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          {t('AI 筛查结论', 'AI screening conclusions')}
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {report.screeningSummary.map(s => (
            <Grid item xs={12} md={4} key={s.name}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography fontWeight={600}>{pick(s, 'name')}</Typography>
                  <Chip label={rl(s.riskLevel)} size="small" color={riskChip[s.riskLevel]} />
                </Box>
                <Typography variant="h5" fontWeight={700}>
                  {s.healthScore ?? s.score}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {s.healthScore != null
                    ? t('类别健康分', 'Category health score')
                    : t('风险指数', 'Risk index')}
                </Typography>
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

      <Paper sx={{ p: 3, mb: 3, borderLeft: 4, borderColor: 'success.main' }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {t('医师裁定 · 已批准 AI 干预', 'Physician authority · approved AI interventions')}
        </Typography>
        {report.physicianAuthority && (
          <Alert severity="info" sx={{ mb: 2 }}>{pick(report.physicianAuthority, 'note')}</Alert>
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
              <Typography variant="caption" color="text.secondary">{iv.aiModel} · {iv.confidence}% · {iv.reviewedBy}</Typography>
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
                {(report.biomarkers || []).map(b => (
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
            {(report.anomalies || []).map(a => (
              <Box key={a.id} sx={{ mb: 1.5, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={600}>{pick(a, 'type')} · {t('置信度', 'confidence')} {a.confidence}%</Typography>
                <Typography variant="caption" color="text.secondary">{a.detectedAt}</Typography>
                <Typography variant="body2">{pick(a, 'pattern')}</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1 }} />
            {(report.alerts || []).map(a => (
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
            {(report.dataSources || []).map(s => (
              <Box key={s.device} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={600}>{s.device}（{t('权重', 'weight')} {(s.weight * 100).toFixed(0)}%）</Typography>
                <Typography variant="caption">{((isEn && s.metrics_en) || s.metrics).join(t('、', ', '))} · {t('质量', 'quality')} {s.quality}%</Typography>
              </Box>
            ))}
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {((isEn && report.recommendedExams_en) || report.recommendedExams || []).map(e => (
                <Chip key={e} icon={<LocalHospital />} label={e} variant="outlined" />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
        {((isEn && report.clinicalNotes_en) || report.clinicalNotes || []).map((n, i) => (
          <Typography key={i} variant="caption" color="text.secondary" display="block">• {n}</Typography>
        ))}
      </Paper>
    </Box>
  );
}

export default DoctorReport;
