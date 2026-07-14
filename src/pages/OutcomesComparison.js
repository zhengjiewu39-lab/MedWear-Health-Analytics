import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Alert, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, Button, Divider,
} from '@mui/material';
import {
  Insights, Refresh, TrendingUp, MonitorHeart, Biotech, LocalHospital,
  Timeline, CompareArrows, Gavel,
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  FunnelChart, Funnel, LabelList, Cell,
} from 'recharts';
import ChartContainer from '../components/ChartContainer';
import { CHART, AXIS, GRID, chartMargin } from '../config/chartTheme';
import { ChartGradients, MedWearTooltip, CompareLegend, CompareBarChart, toChartPct } from '../components/ChartTheme';
import InterventionPathway from '../components/InterventionPathway';
import { outcomesApi, researchApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';
import { useLang } from '../contexts/LanguageContext';
import { useDataMode } from '../contexts/DataModeContext';
import { PAPER_TITLE, PAPER_TITLE_EN } from '../config/paperDemo';

const IV = CHART.intervention;
const UC = CHART.control;
const STAGE_COLORS = CHART.stage;

function fmtPathwayCell(step, arm) {
  if (step.type === 'pct' || step.type === 'rate') {
    const v = arm === 'intervention' ? step.interventionRate ?? step.intervention : step.usualCareRate ?? step.usualCare;
    return v == null ? '—' : pct(typeof v === 'boolean' ? (v ? 1 : 0) : v);
  }
  const v = arm === 'intervention' ? step.intervention : step.usualCare;
  if (typeof v === 'boolean') return v ? '✓' : '—';
  return v == null ? '—' : pct(v);
}

function pct(x) {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`;
}

function relPct(x) {
  return x == null ? '—' : `+${(x * 100).toFixed(1)}%`;
}

function HeroThesisCard({ title, iv, uc, absDelta, relImprove, color }) {
  return (
    <Card sx={{ height: '100%', borderTop: 4, borderColor: color, bgcolor: `${color}08` }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>{title}</Typography>
        <Grid container spacing={1} sx={{ mt: 0.5 }}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">筛查组</Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: IV }}>{pct(iv)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">对照组</Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: UC }}>{pct(uc)}</Typography>
          </Grid>
        </Grid>
        <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip size="small" color="success" label={`Δ ${pct(absDelta)}`} sx={{ fontWeight: 700 }} />
          <Chip size="small" variant="outlined" label={`相对提升 ${relPct(relImprove)}`} sx={{ fontWeight: 700 }} />
        </Box>
      </CardContent>
    </Card>
  );
}

function HeroThesisCardEn({ title, iv, uc, absDelta, relImprove, color }) {
  return (
    <Card sx={{ height: '100%', borderTop: 4, borderColor: color, bgcolor: `${color}08` }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>{title}</Typography>
        <Grid container spacing={1} sx={{ mt: 0.5 }}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Screened</Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: IV }}>{pct(iv)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Control</Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: UC }}>{pct(uc)}</Typography>
          </Grid>
        </Grid>
        <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip size="small" color="success" label={`Δ ${pct(absDelta)}`} sx={{ fontWeight: 700 }} />
          <Chip size="small" variant="outlined" label={`Relative +${relImprove != null ? (relImprove * 100).toFixed(1) : '—'}%`} sx={{ fontWeight: 700 }} />
        </Box>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, iv, uc, delta, unit, higherIsBetter = true, isEn }) {
  const fmt = unit === 'pct' ? pct : (v) => (v == null ? '—' : `${v}${unit === 'day' ? (isEn ? ' d' : ' 天') : ''}`);
  const good = higherIsBetter ? (delta != null && delta > 0) : (delta != null && delta < 0);
  const deltaStr = delta == null ? '—' : `${delta > 0 ? '+' : ''}${unit === 'pct' ? pct(delta) : delta}`;
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ py: 1.75 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="h5" fontWeight={800} sx={{ color: IV }}>{fmt(iv)}</Typography>
          <Typography variant="body2" sx={{ color: UC }}>vs {fmt(uc)}</Typography>
        </Box>
        <Chip
          size="small"
          label={deltaStr}
          color={good ? 'success' : 'default'}
          sx={{ mt: 0.75, fontWeight: 700 }}
        />
      </CardContent>
    </Card>
  );
}

function OutcomesComparison() {
  const navigate = useNavigate();
  const { t, isEn } = useLang();
  const { isReal } = useDataMode();
  const [summary, setSummary] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [cohort, setCohort] = useState([]);
  const [validation, setValidation] = useState(null);
  const [patientComparison, setPatientComparison] = useState(null);
  const [patientError, setPatientError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setPatientError(null);
    try {
      const [s, f, c, v, pc] = await Promise.allSettled([
        outcomesApi.getSummary(),
        outcomesApi.getFunnel(),
        outcomesApi.getCohort({ limit: 40 }),
        researchApi.getValidation(),
        outcomesApi.getPatientComparison(),
      ]);
      if (s.status === 'fulfilled') setSummary(s.value.data);
      else setSummary(null);
      if (f.status === 'fulfilled') setFunnel(f.value.data);
      else setFunnel(null);
      if (c.status === 'fulfilled') setCohort(c.value.data?.patients || []);
      else setCohort([]);
      if (v.status === 'fulfilled' && v.value.data?.headline) setValidation(v.value.data);
      else setValidation(null);
      if (pc.status === 'fulfilled') {
        setPatientComparison(pc.value.data?.patient ? pc.value.data : null);
      } else {
        setPatientComparison(null);
        const err = pc.reason?.response?.data;
        if (err?.needsImport) {
          setPatientError(err);
        } else if (pc.reason?.response?.status === 404) {
          setPatientError({ message: t('当前演示患者暂无个体结局投影', 'No individual outcome projection for the selected demo patient') });
        }
      }
      if (s.status !== 'fulfilled') {
        setError(t('无法连接结局分析 API，请确认后端已重启（npm run dev）',
          'Cannot reach the outcomes API — please restart the backend (npm run dev)'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useModeRefresh(load, [load]);

  if (loading) return <LinearProgress />;

  const c = summary?.comparison;
  const meta = summary?.meta;
  const hl = summary?.headline;
  const ivKey = isEn ? 'Intervention' : '干预组';
  const ucKey = isEn ? 'Control' : '对照组';

  const thesisChart = hl ? [
    { name: isEn ? 'Early dx' : '早诊率', [ivKey]: toChartPct(hl.earlyDiagnosisRate?.intervention), [ucKey]: toChartPct(hl.earlyDiagnosisRate?.control) },
    { name: isEn ? 'Treatment' : '治疗率', [ivKey]: toChartPct(hl.treatmentRate?.intervention), [ucKey]: toChartPct(hl.treatmentRate?.control) },
    { name: isEn ? '5y survival' : '存活率', [ivKey]: toChartPct(hl.survival5y?.intervention), [ucKey]: toChartPct(hl.survival5y?.control) },
  ] : [];

  const stageDistIv = summary?.stageDistribution?.intervention || {};
  const stageDistUc = summary?.stageDistribution?.usual_care || {};
  const stageData = summary ? ['I', 'II', 'III', 'IV'].map((st) => ({
    stage: `${isEn ? 'Stage ' : ''}${st}`,
    key: st,
    [ivKey]: stageDistIv[st] ?? 0,
    [ucKey]: stageDistUc[st] ?? 0,
  })) : [];

  const funnelData = funnel?.steps?.length
    ? funnel.steps.map((s) => ({
      name: isEn ? s.label_en : s.label,
      value: s.count ?? 0,
      rate: s.rate,
    }))
    : [];

  const survivalByCat = (summary?.byCategory || [])
    .filter((cat) => cat.malignant)
    .map((cat) => ({
      name: isEn ? cat.label_en : cat.label,
      [ivKey]: toChartPct(cat.intervention?.meanSurvival5y),
      [ucKey]: toChartPct(cat.control?.meanSurvival5y),
    }));

  const pc = patientComparison;
  const pcIv = pc?.withIntervention;
  const pcUc = pc?.withoutIntervention;
  const pcPatientChart = pcIv && pcUc ? [
    {
      name: isEn ? '5y outcome' : '5年结局率',
      [ivKey]: toChartPct(pcIv.outcome5yRate ?? pcIv.survival5yProb ?? pcIv.wellnessRetention5y),
      [ucKey]: toChartPct(pcUc.outcome5yRate ?? pcUc.survival5yProb ?? pcUc.wellnessRetention5y),
    },
    {
      name: isEn ? 'Treatment' : '治疗启动率',
      [ivKey]: toChartPct(pcIv.treatmentRate),
      [ucKey]: toChartPct(pcUc.treatmentRate),
    },
    {
      name: isEn ? 'Exam uptake' : '体检完成率',
      [ivKey]: toChartPct(pcIv.examUptakeRate),
      [ucKey]: toChartPct(pcUc.examUptakeRate),
    },
    {
      name: isEn ? 'Diagnosis' : '确诊率',
      [ivKey]: toChartPct(pcIv.diagnosedProb),
      [ucKey]: toChartPct(pcUc.diagnosedProb),
    },
  ] : [];

  const pcStageChart = (pc?.stageProjection || []).map((s) => ({
    stage: s.stage,
    [ivKey]: toChartPct(s.intervention),
    [ucKey]: toChartPct(s.usualCare),
  }));

  return (
    <Box>
      <InterventionPathway />

      {patientError?.needsImport && isReal && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/import')}>
              {t('去导入数据', 'Import data')}
            </Button>
          }
        >
          {isEn ? patientError.message_en : patientError.message}
        </Alert>
      )}

      {patientError && !patientError.needsImport && (
        <Alert severity="info" sx={{ mb: 2 }}>{patientError.message}</Alert>
      )}

      {pc?.patient && (
        <Paper
          sx={{
            p: 3, mb: 3, borderRadius: 3,
            border: '1px solid',
            borderColor: CHART.interventionLight,
            background: `linear-gradient(135deg, ${CHART.intervention}0d 0%, ${CHART.accent}0a 100%)`,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                <MonitorHeart sx={{ mr: 1, verticalAlign: 'middle', color: IV }} />
                {t('当前患者 · 干预 vs 不干预（反事实投影）', 'Current Patient · Intervention vs No Intervention (counterfactual)')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {pc.patient.name} · {pc.patient.id}
                {pc.patient.age != null && ` · ${pc.patient.age}${t('岁', 'y')}`}
                {` · ${t('健康评分', 'Health score')} ${pc.patient.healthScore ?? '—'}`}
                {` · ${isEn ? pc.patient.categoryLabel_en : pc.patient.categoryLabel}`}
              </Typography>
            </Box>
            <Chip
              label={pc.patient.riskTier === 'high' ? t('高风险', 'High risk') : pc.patient.riskTier === 'moderate' ? t('中风险', 'Moderate') : t('低风险', 'Low risk')}
              color={pc.patient.riskTier === 'high' ? 'error' : pc.patient.riskTier === 'moderate' ? 'warning' : 'success'}
            />
          </Box>

          {pc.narrative && (
            <Alert severity="info" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
              {isEn ? pc.narrative.en : pc.narrative.zh}
            </Alert>
          )}

          {pc.patient.signals && (
            <Grid container spacing={1} sx={{ mb: 2 }}>
              {[
                [t('静息 HR', 'Resting HR'), `${pc.patient.signals.restingHR} bpm`],
                ['HRV', `${pc.patient.signals.hrv} ms`],
                ['SpO₂', `${pc.patient.signals.spo2}%`],
                [t('步数', 'Steps'), pc.patient.signals.steps],
              ].map(([k, v]) => (
                <Grid item xs={6} sm={3} key={k}>
                  <Chip label={`${k}: ${v}`} variant="outlined" size="small" sx={{ width: '100%', justifyContent: 'flex-start' }} />
                </Grid>
              ))}
            </Grid>
          )}

          <Grid container spacing={2} sx={{ mb: 2 }}>
            {(pc.headlineMetrics || []).slice(0, 4).map((m) => (
              <Grid item xs={6} md={3} key={m.key}>
                <MetricCard
                  label={isEn ? m.label_en : m.label}
                  iv={m.intervention}
                  uc={m.usualCare}
                  delta={m.delta}
                  unit={m.unit}
                  higherIsBetter={m.higherBetter !== false}
                  isEn={isEn}
                />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={3} sx={{ mb: 2 }}>
            <Grid item xs={12} md={pcStageChart.length ? 6 : 12}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {t('个体结局指标对比', 'Individual outcome metrics')}
              </Typography>
              {pcPatientChart.length > 0 && (
                <>
                  <CompareBarChart data={pcPatientChart} ivKey={ivKey} ucKey={ucKey} height={260} idPrefix="patient" />
                  <CompareLegend ivLabel={isEn ? 'With intervention' : '接受干预'} ucLabel={isEn ? 'Without intervention' : '不干预'} />
                </>
              )}
            </Grid>
            {pcStageChart.length > 0 && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  {t('确诊分期分布投影', 'Projected stage at diagnosis')}
                </Typography>
                <CompareBarChart data={pcStageChart.map((d) => ({ ...d, name: `${t('分期', 'Stage')} ${d.stage}` }))} ivKey={ivKey} ucKey={ucKey} height={220} idPrefix="stage" />
              </Grid>
            )}
          </Grid>

          {(pc.pathwayComparison || []).length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {t('干预路径逐步对比', 'Step-by-step pathway comparison')}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('路径节点', 'Pathway step')}</TableCell>
                    <TableCell align="center" sx={{ color: IV, fontWeight: 700 }}>{t('接受干预', 'Intervention')}</TableCell>
                    <TableCell align="center" sx={{ color: UC, fontWeight: 700 }}>{t('不干预', 'No intervention')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pc.pathwayComparison.map((step) => (
                    <TableRow key={step.key}>
                      <TableCell>{isEn ? step.label_en : step.label}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, color: IV }}>{fmtPathwayCell(step, 'intervention')}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, color: UC }}>{fmtPathwayCell(step, 'usualCare')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            {t('辅助参考训练模型', 'Reference / training models')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {(pc.referenceModels || []).slice(0, 8).map((m) => (
              <Chip
                key={m.id}
                size="small"
                variant="outlined"
                icon={<Biotech />}
                label={isEn ? `${m.name}: ${m.role}` : `${m.name_zh || m.name}: ${m.role_zh || m.role}`}
              />
            ))}
          </Box>
        </Paper>
      )}

      {validation?.headline ? (
        <Alert
          severity="success"
          icon={<Gavel />}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/research#validation')}>
              {t('查看临床验证', 'View clinical validation')}
            </Button>
          }
        >
          {t(
            `临床队列验证（SEER/NLST/中国肿瘤登记）：敏感性 ${pct(validation.headline.sensitivity)} · 特异性 ${pct(validation.headline.specificity)} · PPV ${pct(validation.headline.ppv)} · AUC ${validation.headline.auc ?? '—'}`,
            `Clinical validation (SEER/NLST/China NCCR): sensitivity ${pct(validation.headline.sensitivity)} · specificity ${pct(validation.headline.specificity)} · PPV ${pct(validation.headline.ppv)} · AUC ${validation.headline.auc ?? '—'}`,
          )}
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }} action={
          <Button size="small" onClick={() => navigate('/research#validation')}>{t('去运行验证', 'Run validation')}</Button>
        }>
          {t('临床队列验证模块已就绪 — 对照 SEER/NLST/中国肿瘤登记', 'Clinical cohort validation ready — vs SEER/NLST/China NCCR')}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            <CompareArrows sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('队列级结局对比 · 筛查组 vs 对照组', 'Cohort-Level Outcomes · Screened vs Control')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('以下为 n=5000 合成队列的群体统计（辅助参考）；上方卡片突出当前个体患者的干预/不干预反事实对比。',
              'Population statistics from the n=5000 synthetic cohort (reference); the card above highlights the current patient’s intervention vs no-intervention counterfactual.')}
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={load}>{t('刷新', 'Refresh')}</Button>
      </Box>

      <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1, maxWidth: 820 }}>{PAPER_TITLE}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, maxWidth: 820, fontStyle: 'italic' }}>{PAPER_TITLE_EN}</Typography>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      {!summary && !loading && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('队列结局数据尚未加载，请点击刷新或确认后端服务已启动。', 'Cohort outcome data is not loaded yet — click Refresh or ensure the backend is running.')}
        </Alert>
      )}

      {meta && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>{meta.name}</strong> · {t('样本量', 'n')} = {meta.n}
          {' '}({t('干预组', 'intervention')} {meta.nIntervention} · {t('对照组', 'control')} {meta.nControl})
          {' · '}{t('随机种子', 'seed')} {meta.seed} · CC-BY-4.0
        </Alert>
      )}

      {hl && (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>
            <strong>{t('论文核心结论', 'Thesis headline findings')}</strong>
            {' — '}
            {t('可穿戴早筛干预组在早诊率、治疗启动率与模拟存活率上均显著优于无早筛对照组（合成队列模拟，效应量见相对提升）。',
              'The wearable early-screening arm outperforms the unscreened control on early diagnosis, treatment initiation and simulated survival (synthetic cohort; see relative improvement for effect sizes).')}
          </Alert>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              {isEn ? (
                <HeroThesisCardEn title={hl.earlyDiagnosisRate.label_en} iv={hl.earlyDiagnosisRate.intervention} uc={hl.earlyDiagnosisRate.control} absDelta={hl.earlyDiagnosisRate.absoluteDelta} relImprove={hl.earlyDiagnosisRate.relativeImprovement} color={CHART.positive} />
              ) : (
                <HeroThesisCard title={hl.earlyDiagnosisRate.label} iv={hl.earlyDiagnosisRate.intervention} uc={hl.earlyDiagnosisRate.control} absDelta={hl.earlyDiagnosisRate.absoluteDelta} relImprove={hl.earlyDiagnosisRate.relativeImprovement} color={CHART.positive} />
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              {isEn ? (
                <HeroThesisCardEn title={hl.treatmentRate.label_en} iv={hl.treatmentRate.intervention} uc={hl.treatmentRate.control} absDelta={hl.treatmentRate.absoluteDelta} relImprove={hl.treatmentRate.relativeImprovement} color={IV} />
              ) : (
                <HeroThesisCard title={hl.treatmentRate.label} iv={hl.treatmentRate.intervention} uc={hl.treatmentRate.control} absDelta={hl.treatmentRate.absoluteDelta} relImprove={hl.treatmentRate.relativeImprovement} color={IV} />
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              {isEn ? (
                <HeroThesisCardEn title={hl.survival5y.label_en} iv={hl.survival5y.intervention} uc={hl.survival5y.control} absDelta={hl.survival5y.absoluteDelta} relImprove={hl.survival5y.relativeImprovement} color={CHART.accent} />
              ) : (
                <HeroThesisCard title={hl.survival5y.label} iv={hl.survival5y.intervention} uc={hl.survival5y.control} absDelta={hl.survival5y.absoluteDelta} relImprove={hl.survival5y.relativeImprovement} color={CHART.accent} />
              )}
            </Grid>
          </Grid>
          <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              {t('三大核心指标对比（筛查组 vs 对照组）', 'Three headline metrics (screened vs control)')}
            </Typography>
            <CompareBarChart data={thesisChart} ivKey={ivKey} ucKey={ucKey} height={260} idPrefix="thesis" />
            <CompareLegend ivLabel={ivKey} ucLabel={ucKey} />
          </Paper>
        </>
      )}

      {/* Secondary metrics */}
      {c && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={2.4}>
            <MetricCard label={t('早期检出率 (I/II 期)', 'Early-stage (I/II) rate')} iv={c.earlyStageRate.intervention} uc={c.earlyStageRate.control} delta={c.earlyStageRate.delta} unit="pct" isEn={isEn} />
          </Grid>
          <Grid item xs={6} md={2.4}>
            <MetricCard label={t('治疗启动率 (90天)', 'Treatment initiation (90d)')} iv={c.treatmentInitiationRate.intervention} uc={c.treatmentInitiationRate.control} delta={c.treatmentInitiationRate.delta} unit="pct" isEn={isEn} />
          </Grid>
          <Grid item xs={6} md={2.4}>
            <MetricCard label={t('确诊→治疗中位时间', 'Median dx→treatment')} iv={c.medianDaysToTreatment.intervention} uc={c.medianDaysToTreatment.control} delta={c.medianDaysToTreatment.delta} unit="day" higherIsBetter={false} isEn={isEn} />
          </Grid>
          <Grid item xs={6} md={2.4}>
            <MetricCard label={t('模拟 5 年存活率', 'Simulated 5y survival')} iv={c.meanSurvival5y.intervention} uc={c.meanSurvival5y.control} delta={c.meanSurvival5y.delta} unit="pct" isEn={isEn} />
          </Grid>
          <Grid item xs={6} md={2.4}>
            <MetricCard label={t('慢病控制率', 'Chronic control rate')} iv={c.chronicControlRate.intervention} uc={c.chronicControlRate.control} delta={c.chronicControlRate.delta} unit="pct" isEn={isEn} />
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* Stage distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              <Biotech sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
              {t('确诊分期分布（stage shift）', 'Stage-at-diagnosis distribution (stage shift)')}
            </Typography>
            <ChartContainer width="100%" height={280}>
              {stageData.length > 0 ? (
                <BarChart data={stageData} margin={chartMargin()}>
                  <ChartGradients idPrefix="cohort-stage" />
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="stage" tick={AXIS.tick} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS.tick} axisLine={false} tickLine={false} />
                  <Tooltip content={<MedWearTooltip />} />
                  <Bar dataKey={ivKey} fill="url(#cohort-stage-iv)" stroke={IV} strokeWidth={1.5} radius={[6, 6, 0, 0]} maxBarSize={44} minPointSize={3} />
                  <Bar dataKey={ucKey} fill="url(#cohort-stage-uc)" stroke={UC} strokeWidth={1.5} radius={[6, 6, 0, 0]} maxBarSize={44} minPointSize={3} />
                </BarChart>
              ) : (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.secondary">{t('暂无分期分布数据', 'No stage distribution data')}</Typography>
                </Box>
              )}
            </ChartContainer>
            <Typography variant="caption" color="text.secondary">
              {t('干预组向早期（I/II）分期迁移，对照组更多晚期（III/IV）。',
                'The intervention arm shifts toward early stages (I/II); the control arm has more late-stage (III/IV) diagnoses.')}
            </Typography>
          </Paper>
        </Grid>

        {/* Survival by cancer type */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              <TrendingUp sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
              {t('分癌种模拟 5 年存活率 (%)', 'Simulated 5-year survival by cancer type (%)')}
            </Typography>
            <CompareBarChart
              data={survivalByCat}
              ivKey={ivKey}
              ucKey={ucKey}
              height={280}
              idPrefix="survival"
              emptyLabel={t('暂无分癌种存活率数据', 'No survival-by-category data')}
            />
            <CompareLegend ivLabel={ivKey} ucLabel={ucKey} />
          </Paper>
        </Grid>

        {/* Intervention funnel */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              <Timeline sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
              {t('干预路径转化漏斗（干预组）', 'Intervention conversion funnel (intervention arm)')}
            </Typography>
            <ChartContainer width="100%" height={300}>
              {funnelData.length > 0 ? (
                <FunnelChart>
                  <Tooltip formatter={(v, n, p) => [`${v} (${pct(p.payload.rate)})`, p.payload.name]} />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    <LabelList position="right" fill="#334155" stroke="none" dataKey="name" style={{ fontSize: 12 }} />
                    {funnelData.map((entry, i) => (
                      <Cell key={entry.name} fill={CHART.funnel[i % CHART.funnel.length]} />
                    ))}
                  </Funnel>
                </FunnelChart>
              ) : (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.secondary">{t('暂无漏斗数据', 'No funnel data')}</Typography>
                </Box>
              )}
            </ChartContainer>
            <Typography variant="caption" color="text.secondary">
              {t('从连续监测 → 异常标记 → 风险分层 → 体检 → 确诊 → 治疗的转化率。',
                'Conversion from continuous monitoring → anomaly flag → risk stratification → exam → diagnosis → treatment.')}
            </Typography>
          </Paper>
        </Grid>

        {/* Per-category table */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              <LocalHospital sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
              {t('分疾病结局明细', 'Outcomes by disease category')}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('疾病', 'Disease')}</TableCell>
                  <TableCell align="center">{t('组别', 'Arm')}</TableCell>
                  <TableCell align="right">{t('早期%', 'Early%')}</TableCell>
                  <TableCell align="right">{t('治疗%', 'Tx%')}</TableCell>
                  <TableCell align="right">{t('存活/控制%', 'Surv/Ctrl%')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(summary?.byCategory || []).map((cat) => (
                  <React.Fragment key={cat.category}>
                    <TableRow>
                      <TableCell rowSpan={2}>{isEn ? cat.label_en : cat.label}</TableCell>
                      <TableCell align="center"><Chip size="small" label={t('干预', 'IV')} sx={{ bgcolor: IV, color: '#fff' }} /></TableCell>
                      <TableCell align="right">{cat.malignant ? pct(cat.intervention.earlyStageRate) : '—'}</TableCell>
                      <TableCell align="right">{pct(cat.intervention.treatmentRate)}</TableCell>
                      <TableCell align="right">{pct(cat.malignant ? cat.intervention.meanSurvival5y : cat.intervention.controlRate)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="center"><Chip size="small" label={t('对照', 'UC')} sx={{ bgcolor: UC, color: '#fff' }} /></TableCell>
                      <TableCell align="right">{cat.malignant ? pct(cat.control.earlyStageRate) : '—'}</TableCell>
                      <TableCell align="right">{pct(cat.control.treatmentRate)}</TableCell>
                      <TableCell align="right">{pct(cat.malignant ? cat.control.meanSurvival5y : cat.control.controlRate)}</TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        {/* Cohort sample */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              <MonitorHeart sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
              {t('队列样本（前 40 例，真实生理范围）', 'Cohort sample (first 40, realistic physiology)')}
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>{t('组别', 'Arm')}</TableCell>
                    <TableCell align="right">{t('年龄', 'Age')}</TableCell>
                    <TableCell>{t('性别', 'Sex')}</TableCell>
                    <TableCell>{t('疾病', 'Disease')}</TableCell>
                    <TableCell align="right">HR</TableCell>
                    <TableCell align="right">HRV</TableCell>
                    <TableCell align="right">SpO₂</TableCell>
                    <TableCell align="right">{t('步数', 'Steps')}</TableCell>
                    <TableCell align="right">{t('风险', 'Risk')}</TableCell>
                    <TableCell align="center">{t('分期', 'Stage')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cohort.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          {t('队列表格暂无数据', 'No cohort rows loaded')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : cohort.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.id}</TableCell>
                      <TableCell>
                        <Chip size="small" label={p.arm === 'intervention' ? t('干预', 'IV') : t('对照', 'UC')}
                          sx={{ bgcolor: p.arm === 'intervention' ? IV : UC, color: '#fff' }} />
                      </TableCell>
                      <TableCell align="right">{p.age}</TableCell>
                      <TableCell>{p.sex === 'F' ? t('女', 'F') : t('男', 'M')}</TableCell>
                      <TableCell>{isEn ? p.categoryLabel_en : p.categoryLabel}</TableCell>
                      <TableCell align="right">{p.signals?.restingHR ?? '—'}</TableCell>
                      <TableCell align="right">{p.signals?.hrv ?? '—'}</TableCell>
                      <TableCell align="right">{p.signals?.spo2 ?? '—'}</TableCell>
                      <TableCell align="right">{p.signals?.steps ?? '—'}</TableCell>
                      <TableCell align="right">
                        <Chip size="small" variant="outlined"
                          color={p.riskTier === 'high' ? 'error' : p.riskTier === 'moderate' ? 'warning' : 'success'}
                          label={p.riskScore} />
                      </TableCell>
                      <TableCell align="center">
                        {p.stageAtDiagnosis
                          ? <Chip size="small" label={p.stageAtDiagnosis} sx={{ bgcolor: STAGE_COLORS[p.stageAtDiagnosis], color: '#fff' }} />
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Alert severity="warning" icon={<Insights fontSize="small" />}>
        {t('本页为合成模拟数据，存活率基于分期特异性登记统计（SEER 等）与筛查降期效应估算，非真实前瞻性队列结果；用于论文方法学与系统演示。',
          'This page uses synthetic simulated data; survival is estimated from stage-specific registry statistics (e.g., SEER) and screening down-staging effects, not a real prospective cohort — intended for methodology and demonstration only.')}
      </Alert>
    </Box>
  );
}

export default OutcomesComparison;
