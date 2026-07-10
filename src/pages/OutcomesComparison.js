import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Alert, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, Button, Divider,
} from '@mui/material';
import {
  Insights, Refresh, TrendingUp, MonitorHeart, Biotech, LocalHospital,
  Timeline, CompareArrows,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  FunnelChart, Funnel, LabelList, Cell,
} from 'recharts';
import ChartContainer from '../components/ChartContainer';
import InterventionPathway from '../components/InterventionPathway';
import { outcomesApi } from '../services/api';
import { useLang } from '../contexts/LanguageContext';
import { PAPER_TITLE, PAPER_TITLE_EN } from '../config/paperDemo';

const IV_COLOR = '#1565C0';
const UC_COLOR = '#b45309';
const STAGE_COLORS = { I: '#2e7d32', II: '#66bb6a', III: '#f59e0b', IV: '#dc2626' };

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
            <Typography variant="h4" fontWeight={800} sx={{ color: IV_COLOR }}>{pct(iv)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">对照组</Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: UC_COLOR }}>{pct(uc)}</Typography>
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
            <Typography variant="h4" fontWeight={800} sx={{ color: IV_COLOR }}>{pct(iv)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Control</Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: UC_COLOR }}>{pct(uc)}</Typography>
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
          <Typography variant="h5" fontWeight={800} sx={{ color: IV_COLOR }}>{fmt(iv)}</Typography>
          <Typography variant="body2" sx={{ color: UC_COLOR }}>vs {fmt(uc)}</Typography>
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
  const { t, isEn } = useLang();
  const [summary, setSummary] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [cohort, setCohort] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, f, c] = await Promise.allSettled([
        outcomesApi.getSummary(),
        outcomesApi.getFunnel(),
        outcomesApi.getCohort({ limit: 40 }),
      ]);
      if (s.status === 'fulfilled') setSummary(s.value.data);
      if (f.status === 'fulfilled') setFunnel(f.value.data);
      if (c.status === 'fulfilled') setCohort(c.value.data?.patients || []);
      if (s.status !== 'fulfilled') {
        setError(t('无法连接结局分析 API，请确认后端已重启（npm run dev）',
          'Cannot reach the outcomes API — please restart the backend (npm run dev)'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LinearProgress />;

  const c = summary?.comparison;
  const meta = summary?.meta;
  const hl = summary?.headline;
  const ivKey = isEn ? 'Intervention' : '干预组';
  const ucKey = isEn ? 'Control' : '对照组';

  const thesisChart = hl ? [
    { name: isEn ? 'Early dx' : '早诊率', [ivKey]: +(hl.earlyDiagnosisRate.intervention * 100).toFixed(1), [ucKey]: +(hl.earlyDiagnosisRate.control * 100).toFixed(1) },
    { name: isEn ? 'Treatment' : '治疗率', [ivKey]: +(hl.treatmentRate.intervention * 100).toFixed(1), [ucKey]: +(hl.treatmentRate.control * 100).toFixed(1) },
    { name: isEn ? '5y survival' : '存活率', [ivKey]: +(hl.survival5y.intervention * 100).toFixed(1), [ucKey]: +(hl.survival5y.control * 100).toFixed(1) },
  ] : [];

  const stageData = summary ? ['I', 'II', 'III', 'IV'].map((st) => ({
    stage: `${isEn ? 'Stage ' : ''}${st}`,
    key: st,
    [isEn ? 'Intervention' : '干预组']: summary.stageDistribution.intervention[st],
    [isEn ? 'Control' : '对照组']: summary.stageDistribution.usual_care[st],
  })) : [];

  const funnelData = funnel ? funnel.steps.map((s) => ({
    name: isEn ? s.label_en : s.label,
    value: s.count,
    rate: s.rate,
  })) : [];

  const survivalByCat = summary ? summary.byCategory
    .filter((cat) => cat.malignant)
    .map((cat) => ({
      name: isEn ? cat.label_en : cat.label,
      [isEn ? 'Intervention' : '干预组']: cat.intervention.meanSurvival5y != null ? +(cat.intervention.meanSurvival5y * 100).toFixed(1) : 0,
      [isEn ? 'Control' : '对照组']: cat.control.meanSurvival5y != null ? +(cat.control.meanSurvival5y * 100).toFixed(1) : 0,
    })) : [];

  return (
    <Box>
      <InterventionPathway />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            <CompareArrows sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('结局对比 · 筛查组 vs 对照组', 'Outcome Comparison · Screened vs Control')}
          </Typography>
          <Typography variant="subtitle2" color="primary.main" sx={{ mt: 0.5, maxWidth: 820 }}>{PAPER_TITLE}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 820, fontStyle: 'italic' }}>{PAPER_TITLE_EN}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('可穿戴早筛干预组 与 无早筛对照组 的分期、治疗与模拟存活率对比（合成队列，仅供方法学演示）',
              'Stage, treatment and simulated survival comparison between the wearable early-screening arm and the unscreened control arm (synthetic cohort, methodology demo only)')}
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={load}>{t('刷新', 'Refresh')}</Button>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

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
                <HeroThesisCardEn title={hl.earlyDiagnosisRate.label_en} iv={hl.earlyDiagnosisRate.intervention} uc={hl.earlyDiagnosisRate.control} absDelta={hl.earlyDiagnosisRate.absoluteDelta} relImprove={hl.earlyDiagnosisRate.relativeImprovement} color="#2e7d32" />
              ) : (
                <HeroThesisCard title={hl.earlyDiagnosisRate.label} iv={hl.earlyDiagnosisRate.intervention} uc={hl.earlyDiagnosisRate.control} absDelta={hl.earlyDiagnosisRate.absoluteDelta} relImprove={hl.earlyDiagnosisRate.relativeImprovement} color="#2e7d32" />
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              {isEn ? (
                <HeroThesisCardEn title={hl.treatmentRate.label_en} iv={hl.treatmentRate.intervention} uc={hl.treatmentRate.control} absDelta={hl.treatmentRate.absoluteDelta} relImprove={hl.treatmentRate.relativeImprovement} color="#1565C0" />
              ) : (
                <HeroThesisCard title={hl.treatmentRate.label} iv={hl.treatmentRate.intervention} uc={hl.treatmentRate.control} absDelta={hl.treatmentRate.absoluteDelta} relImprove={hl.treatmentRate.relativeImprovement} color="#1565C0" />
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              {isEn ? (
                <HeroThesisCardEn title={hl.survival5y.label_en} iv={hl.survival5y.intervention} uc={hl.survival5y.control} absDelta={hl.survival5y.absoluteDelta} relImprove={hl.survival5y.relativeImprovement} color="#6A1B9A" />
              ) : (
                <HeroThesisCard title={hl.survival5y.label} iv={hl.survival5y.intervention} uc={hl.survival5y.control} absDelta={hl.survival5y.absoluteDelta} relImprove={hl.survival5y.relativeImprovement} color="#6A1B9A" />
              )}
            </Grid>
          </Grid>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              {t('三大核心指标对比（筛查组 vs 对照组）', 'Three headline metrics (screened vs control)')}
            </Typography>
            <ChartContainer width="100%" height={220}>
              <BarChart data={thesisChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Bar dataKey={ivKey} fill={IV_COLOR} name={ivKey} />
                <Bar dataKey={ucKey} fill={UC_COLOR} name={ucKey} />
              </BarChart>
            </ChartContainer>
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
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey={ivKey} fill={IV_COLOR} />
                <Bar dataKey={ucKey} fill={UC_COLOR} />
              </BarChart>
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
            <ChartContainer width="100%" height={280}>
              <BarChart data={survivalByCat}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Bar dataKey={ivKey} fill={IV_COLOR} />
                <Bar dataKey={ucKey} fill={UC_COLOR} />
              </BarChart>
            </ChartContainer>
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
              <FunnelChart>
                <Tooltip formatter={(v, n, p) => [`${v} (${pct(p.payload.rate)})`, p.payload.name]} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#334155" stroke="none" dataKey="name" style={{ fontSize: 12 }} />
                  {funnelData.map((entry, i) => (
                    <Cell key={i} fill={`hsl(211, 60%, ${65 - i * 6}%)`} />
                  ))}
                </Funnel>
              </FunnelChart>
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
                      <TableCell align="center"><Chip size="small" label={t('干预', 'IV')} sx={{ bgcolor: IV_COLOR, color: '#fff' }} /></TableCell>
                      <TableCell align="right">{cat.malignant ? pct(cat.intervention.earlyStageRate) : '—'}</TableCell>
                      <TableCell align="right">{pct(cat.intervention.treatmentRate)}</TableCell>
                      <TableCell align="right">{pct(cat.malignant ? cat.intervention.meanSurvival5y : cat.intervention.controlRate)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="center"><Chip size="small" label={t('对照', 'UC')} sx={{ bgcolor: UC_COLOR, color: '#fff' }} /></TableCell>
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
                  {cohort.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.id}</TableCell>
                      <TableCell>
                        <Chip size="small" label={p.arm === 'intervention' ? t('干预', 'IV') : t('对照', 'UC')}
                          sx={{ bgcolor: p.arm === 'intervention' ? IV_COLOR : UC_COLOR, color: '#fff' }} />
                      </TableCell>
                      <TableCell align="right">{p.age}</TableCell>
                      <TableCell>{p.sex === 'F' ? t('女', 'F') : t('男', 'M')}</TableCell>
                      <TableCell>{isEn ? p.categoryLabel_en : p.categoryLabel}</TableCell>
                      <TableCell align="right">{p.signals.restingHR}</TableCell>
                      <TableCell align="right">{p.signals.hrv}</TableCell>
                      <TableCell align="right">{p.signals.spo2}</TableCell>
                      <TableCell align="right">{p.signals.steps}</TableCell>
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
