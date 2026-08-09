import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, Button, Chip, Alert, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, Card, CardContent,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  PlayArrow, Gavel, ExpandMore, Refresh,
  Biotech, MenuBook, CheckCircle, Security, Timeline,
  OpenInNew, CompareArrows, Groups, MonitorHeart,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import ChartContainer from '../components/ChartContainer';
import EvaluationIntegrityBanner from '../components/EvaluationIntegrityBanner';
import InterventionPathway from '../components/InterventionPathway';
import PageHeader from '../components/PageHeader';
import { researchApi } from '../services/api';
import { PAPER_TITLE, PAPER_TITLE_EN } from '../config/paperDemo';
import { useLang } from '../contexts/LanguageContext';
import { CHART, AXIS, GRID, chartMargin } from '../config/chartTheme';
import { ChartGradients, MedWearTooltip } from '../components/ChartTheme';

function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const IV = CHART.intervention;
const UC = CHART.control;

function pct(x) {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`;
}

function ciRange(metric) {
  if (!metric || metric.lower == null) return '—';
  return `${(metric.lower * 100).toFixed(2)}–${(metric.upper * 100).toFixed(2)}%`;
}

function ResearchCenter() {
  const navigate = useNavigate();
  const { t, isEn } = useLang();
  const [tab, setTab] = useState(0);
  const [results, setResults] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [methods, setMethods] = useState(null);
  const [validation, setValidation] = useState(null);
  const [evalFramework, setEvalFramework] = useState(null);
  const [wearableDataset, setWearableDataset] = useState(null);
  const [wearableResults, setWearableResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [wearableEvaluating, setWearableEvaluating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [apiError, setApiError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const [res, ds, m, val, wDs, wRes, fw] = await Promise.allSettled([
        researchApi.getResults(),
        researchApi.getDataset(),
        researchApi.getMethods(),
        researchApi.getValidation(),
        researchApi.getWearableDataset(),
        researchApi.getWearableResults(),
        researchApi.getEvaluationFramework(),
      ]);
      if (res.status === 'fulfilled') setResults(res.value.data);
      if (ds.status === 'fulfilled') setDataset(ds.value.data);
      if (m.status === 'fulfilled') setMethods(m.value.data);
      if (val.status === 'fulfilled' && val.value.data?.headline) setValidation(val.value.data);
      if (wDs.status === 'fulfilled') setWearableDataset(wDs.value.data);
      if (wRes.status === 'fulfilled') setWearableResults(wRes.value.data);
      if (fw.status === 'fulfilled') setEvalFramework(fw.value.data);
      if (ds.status !== 'fulfilled') {
        setApiError(t('无法连接 API，请确认 npm run dev 已启动', 'Cannot reach API — ensure npm run dev is running'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (window.location.hash === '#validation') setTab(5);
  }, []);

  useEffect(() => {
    if (validation?.headline && tab !== 5 && window.location.hash === '#validation') setTab(5);
  }, [validation, tab]);

  const runEval = async () => {
    setEvaluating(true);
    try {
      const res = await researchApi.runEvaluation();
      setResults(res.data);
    } finally {
      setEvaluating(false);
    }
  };

  const runValidation = async () => {
    setValidating(true);
    try {
      const res = await researchApi.runValidation();
      setValidation(res.data);
    } finally {
      setValidating(false);
    }
  };

  const runWearableEval = async () => {
    setWearableEvaluating(true);
    try {
      const res = await researchApi.runWearableEvaluation();
      setWearableResults(res.data);
      if (res.data?.metrics) {
        setEvalFramework((prev) => prev ? {
          ...prev,
          wearable: { ...prev.wearable, latestEvaluation: res.data },
        } : prev);
      }
    } finally {
      setWearableEvaluating(false);
    }
  };

  const headline = dataset?.headline || results?.headline;
  const comparison = dataset?.comparison || results?.comparison;
  const n = dataset?.meta?.n || dataset?.totalPatients || results?.n || 5000;
  const wn = wearableDataset?.n || wearableResults?.n || 5000;
  const wm = wearableResults?.metrics;
  const wci = wm?.confidence95;

  const chartData = comparison ? [
    {
      name: t('早诊率', 'Early dx'),
      intervention: (comparison.earlyStageRate?.intervention ?? headline?.earlyDiagnosisRate?.intervention ?? 0) * 100,
      control: (comparison.earlyStageRate?.control ?? headline?.earlyDiagnosisRate?.control ?? 0) * 100,
    },
    {
      name: t('治疗率', 'Treatment'),
      intervention: (comparison.treatmentInitiationRate?.intervention ?? headline?.treatmentRate?.intervention ?? 0) * 100,
      control: (comparison.treatmentInitiationRate?.control ?? headline?.treatmentRate?.control ?? 0) * 100,
    },
    {
      name: t('5年存活', '5y survival'),
      intervention: (comparison.meanSurvival5y?.intervention ?? headline?.survival5y?.intervention ?? 0) * 100,
      control: (comparison.meanSurvival5y?.control ?? headline?.survival5y?.control ?? 0) * 100,
    },
  ] : [];

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <InterventionPathway />

      <PageHeader
        title={t('研究评价中心', 'Research & Evaluation Center')}
        subtitle={isEn ? PAPER_TITLE_EN : PAPER_TITLE}
        actions={<Button startIcon={<Refresh />} onClick={load}>{t('刷新', 'Refresh')}</Button>}
        badge={<Chip size="small" color="primary" label={`${t('筛查', 'Screening')} n=${n} · ${t('可穿戴', 'Wearable')} n=${wn}`} />}
      />

      <EvaluationIntegrityBanner
        framework={evalFramework}
        wearableResults={wearableResults || wearableDataset?.latestEvaluation}
      />

      <Alert severity="info" icon={<MonitorHeart />} sx={{ mb: 2 }}>
        <strong>MedWear-Wearable-Analytics-Clinical-v2</strong>
        {' — '}
        {t(
          `${wn} 例随机合成（28% 均匀随机 + 表型随机 · 临床金标准 adjudication-v1，独立于产品引擎）· CC-BY-4.0`,
          `${wn} random synthesis (28% uniform + phenotype random · clinical gold standard adjudication-v1, independent of product engine) · CC-BY-4.0`,
        )}
        {wearableDataset?.superseded && (
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            {t('已取代', 'Supersedes')}: {wearableDataset.superseded}
          </Typography>
        )}
      </Alert>

      {wearableResults?.circularLabelWarning && wearableResults?.integrity === 'invalid-circular' && (
        <Alert severity="warning" sx={{ mb: 2 }}>{wearableResults.circularLabelWarning}</Alert>
      )}

      {wearableResults?.mismatchCount != null && wearableResults?.integrity !== 'invalid-circular' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t(
            `引擎 vs 临床金标准：${wearableResults.mismatchCount} / ${wn} 例存在分歧（独立评测，非自评）`,
            `Engine vs clinical gold: ${wearableResults.mismatchCount} / ${wn} cases disagree (independent evaluation)`,
          )}
        </Alert>
      )}

      <Alert severity="success" icon={<Biotech />} sx={{ mb: 2 }}>
        <strong>MedWear-Screening-Outcome-Cohort-v1</strong>
        {' — '}
        {t(
          `${n} 例合成队列（干预组 ${dataset?.meta?.nIntervention || n / 2} · 对照组 ${dataset?.meta?.nControl || n / 2}）· CC-BY-4.0 · 与结局对比页数据一致`,
          `${n} synthetic patients (intervention ${dataset?.meta?.nIntervention || n / 2} · control ${dataset?.meta?.nControl || n / 2}) · CC-BY-4.0 · same data as Outcomes page`,
        )}
      </Alert>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: t('告警 F1', 'Alert F1'), value: wm?.alerts?.f1 ?? '—', icon: <CheckCircle />, color: IV },
          { label: t('告警精确率', 'Alert precision'), value: wm ? pct(wm.alerts?.precision) : '—', icon: <Security />, color: IV },
          { label: t('告警召回率', 'Alert recall'), value: wm ? pct(wm.alerts?.recall) : '—', icon: <MonitorHeart />, color: IV },
          { label: t('异常准确率', 'Anomaly acc'), value: wm ? pct(wm.anomalyAccuracy) : '—', icon: <Timeline />, color: IV, ci: wci?.anomalyAccuracy },
          { label: t('风险准确率', 'Risk acc'), value: wm ? pct(wm.riskAccuracy) : '—', icon: <Groups />, color: IV, ci: wci?.riskAccuracy },
          { label: t('BHI 一致', 'BHI agree'), value: wm ? pct(wm.healthScoreAgreementRate ?? wm.healthScoreInRangeRate) : '—', icon: <Biotech />, color: IV, ci: wci?.healthScoreAgreement || wci?.healthScoreInRange },
        ].map((item) => (
          <Grid item xs={6} md={4} lg={2} key={item.label}>
            <Card sx={{ height: '100%', borderTop: 3, borderColor: item.color }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Box sx={{ color: item.color, mb: 0.5 }}>{item.icon}</Box>
                <Typography variant="h4" fontWeight={800}>{item.value}</Typography>
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                {item.ci && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    95% CI {ciRange(item.ci)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: t('基准样本', 'Cohort size'), value: n, icon: <Groups />, color: 'primary.main' },
          { label: t('早诊率 Δ', 'Early dx Δ'), value: headline ? pct(headline.earlyDiagnosisRate?.delta) : '—', icon: <CheckCircle />, color: IV },
          { label: t('治疗率 Δ', 'Treatment Δ'), value: headline ? pct(headline.treatmentRate?.delta) : '—', icon: <MonitorHeart />, color: IV },
          { label: t('5年存活 Δ', '5y survival Δ'), value: headline ? pct(headline.survival5y?.delta) : '—', icon: <Timeline />, color: IV },
        ].map((item) => (
          <Grid item xs={6} md={3} key={item.label}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Box sx={{ color: item.color, mb: 0.5 }}>{item.icon}</Box>
                <Typography variant="h4" fontWeight={800}>{item.value}</Typography>
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Button variant="contained" color="secondary" startIcon={<PlayArrow />} onClick={runWearableEval} disabled={wearableEvaluating}>
          {wearableEvaluating ? t('评测中…', 'Evaluating…') : t('运行可穿戴基准评测', 'Run wearable benchmark')}
        </Button>
        <Button variant="contained" startIcon={<PlayArrow />} onClick={runEval} disabled={evaluating}>
          {evaluating ? t('评测中…', 'Evaluating…') : t('运行队列评测', 'Run cohort evaluation')}
        </Button>
        <Button variant="contained" color="success" startIcon={<CompareArrows />} onClick={() => navigate('/outcomes')}>
          {t('查看结局对比', 'View outcome comparison')}
        </Button>
        <Button variant="outlined" color="secondary" startIcon={<Gavel />} onClick={runValidation} disabled={validating}>
          {validating ? t('验证中…', 'Validating…') : t('临床队列验证', 'Clinical validation')}
        </Button>
        <Button variant="outlined" startIcon={<MenuBook />} onClick={() => navigate('/methodology')}>
          {t('方法学文档', 'Methodology')}
        </Button>
      </Box>

      {validation?.headline && (
        <Paper sx={{ p: 2, mb: 2, borderLeft: 4, borderColor: 'success.main', bgcolor: 'success.50' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('临床队列验证', 'Clinical cohort validation')} · SEER / NLST / 中国肿瘤登记
            </Typography>
            <Button size="small" onClick={() => setTab(5)}>{t('查看详情', 'View details')}</Button>
          </Box>
          <Grid container spacing={1.5}>
            {[
              { label: t('敏感性', 'Sensitivity'), value: pct(validation.headline.sensitivity) },
              { label: t('特异性', 'Specificity'), value: pct(validation.headline.specificity) },
              { label: 'PPV', value: pct(validation.headline.ppv) },
              { label: 'AUC', value: validation.headline.auc ?? '—' },
              { label: t('早诊率', 'Early dx'), value: pct(validation.headline.earlyDiagnosisRate_iv) },
              { label: t('5y存活改善', '5y gain'), value: pct(validation.headline.survival5yGain) },
            ].map((m) => (
              <Grid item xs={6} sm={4} md={2} key={m.label}>
                <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                <Typography variant="h6" fontWeight={800}>{m.value}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      <Paper sx={{ overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
          <Tab label={t('可穿戴基准', 'Wearable benchmark')} />
          <Tab label={t('筛查核心指标', 'Screening metrics')} />
          <Tab label={t('评测结果', 'Results')} />
          <Tab label={t('分析方法', 'Methods')} />
          <Tab label={t('队列样本', 'Cohort sample')} />
          <Tab label={t('临床验证', 'Clinical validation')} />
          <Tab label={t('合规说明', 'Compliance')} />
        </Tabs>
        <Box sx={{ p: 2.5 }}>
          <TabPanel value={tab} index={0}>
            {wearableDataset?.available !== false ? (
              <>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {wearableDataset?.dataset || 'MedWear-Wearable-Analytics-Clinical-v2'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {t('版本', 'Version')} {wearableDataset?.version || evalFramework?.wearable?.version || '2.5.0'}
                      {' · '}{wearableDataset?.labelSource || 'clinical-gold-standard-v1'}
                      {' · '}seed={wearableDataset?.seed ?? 42}
                      {' · '}{wearableDataset?.rng || 'mulberry32'}
                      {' · '}{wearableDataset?.expansionMethod || 'clinical-random-physiology-adjudication'}
                    </Typography>
                    {wearableDataset?.physiologyMix && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {t('生理混合', 'Physiology mix')}: {t('临床随机', 'clinical-random')} {(wearableDataset.physiologyMix.clinicalRandom * 100).toFixed(0)}%
                        {' · '}{t('表型随机', 'phenotype-random')} {(wearableDataset.physiologyMix.phenotypeRandom * 100).toFixed(0)}%
                        {wearableDataset.clinicalCharacteristics?.withinReferencePct != null && (
                          <> · {t('参考区间内', 'Within ref band')} {(wearableDataset.clinicalCharacteristics.withinReferencePct * 100).toFixed(1)}%</>
                        )}
                      </Typography>
                    )}
                    {wm && (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>{t('指标', 'Metric')}</TableCell>
                            <TableCell>{t('值', 'Value')}</TableCell>
                            <TableCell>95% CI</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {[
                            [t('告警 F1', 'Alert F1'), wm.alerts?.f1, null],
                            [t('告警精确率', 'Alert precision'), pct(wm.alerts?.precision), null],
                            [t('告警召回率', 'Alert recall'), pct(wm.alerts?.recall), null],
                            [t('异常准确率', 'Anomaly acc'), pct(wm.anomalyAccuracy), ciRange(wci?.anomalyAccuracy)],
                            [t('风险准确率', 'Risk acc'), pct(wm.riskAccuracy), ciRange(wci?.riskAccuracy)],
                            [t('BHI 一致率', 'BHI agreement'), pct(wm.healthScoreAgreementRate ?? wm.healthScoreInRangeRate), ciRange(wci?.healthScoreAgreement || wci?.healthScoreInRange)],
                          ].map(([label, val, ci]) => (
                            <TableRow key={label}>
                              <TableCell>{label}</TableCell>
                              <TableCell><strong>{val}</strong></TableCell>
                              <TableCell>{ci || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight={700}>{t('表型分布', 'Phenotype distribution')}</Typography>
                    <Typography component="ul" variant="body2" sx={{ pl: 2, mb: 2 }}>
                      {(wearableDataset?.phenotypeDistribution || wearableDataset?.archetypeDistribution || []).map((a) => (
                        <li key={a.phenotype || a.archetype}>
                          {a.phenotype || a.archetype}: {a.n} ({(a.pct * 100).toFixed(1)}%)
                        </li>
                      ))}
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700}>{t('复现命令', 'Reproduction')}</Typography>
                    <Typography component="pre" variant="body2" sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2, fontSize: '0.8rem' }}>
                      npm run generate:benchmark{'\n'}npm run evaluate
                    </Typography>
                  </Grid>
                </Grid>
                {wearableDataset?.clinicalCharacteristics?.targetDayVitals && (
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      {t('临床数据特征（目标日汇总）', 'Clinical vitals profile (target day)')}
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('指标', 'Metric')}</TableCell>
                          <TableCell>{t('均值', 'Mean')}</TableCell>
                          <TableCell>{t('中位数', 'Median')}</TableCell>
                          <TableCell>P5–P95</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(wearableDataset.clinicalCharacteristics.targetDayVitals).map(([key, stats]) => (
                          <TableRow key={key}>
                            <TableCell>{key}</TableCell>
                            <TableCell>{stats.mean}</TableCell>
                            <TableCell>{stats.median}</TableCell>
                            <TableCell>{stats.p5}–{stats.p95}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {wearableDataset.clinicalCharacteristics.correlations && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        {t('相关', 'Corr')}: steps↔energy {wearableDataset.clinicalCharacteristics.correlations.stepsEnergy}
                        {' · '}RHR↔HRV {wearableDataset.clinicalCharacteristics.correlations.rhrHrv}
                      </Typography>
                    )}
                  </Paper>
                )}
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>{t('标签', 'Label')}</TableCell>
                      <TableCell>{t('告警', 'Alerts')}</TableCell>
                      <TableCell>{t('异常', 'Anomaly')}</TableCell>
                      <TableCell>{t('风险', 'Risk')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(wearableDataset?.sampleCases || []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.id}</TableCell>
                        <TableCell>{c.label}</TableCell>
                        <TableCell>{(c.expected?.alerts || []).join(', ') || '—'}</TableCell>
                        <TableCell>{c.expected?.anomaly ? t('是', 'Yes') : t('否', 'No')}</TableCell>
                        <TableCell>{c.expected?.riskLevel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <Alert severity="info" action={<Button onClick={runWearableEval}>{t('运行评测', 'Run eval')}</Button>}>
                {t('可穿戴基准未加载 — 请运行 npm run generate:benchmark', 'Wearable benchmark not loaded — run npm run generate:benchmark')}
              </Alert>
            )}
          </TabPanel>

          <TabPanel value={tab} index={1}>
            {chartData.length > 0 ? (
              <ChartContainer width="100%" height={280}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                  <Legend />
                  <Bar dataKey="intervention" name={t('筛查组', 'Screened')} fill={IV} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="control" name={t('对照组', 'Control')} fill={UC} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <Alert severity="info">{t('运行队列评测以生成指标', 'Run cohort evaluation to generate metrics')}</Alert>
            )}
          </TabPanel>

          <TabPanel value={tab} index={2}>
            {results?.comparison || results?.headline ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('指标', 'Metric')}</TableCell>
                    <TableCell>{t('筛查组', 'Screened')}</TableCell>
                    <TableCell>{t('对照组', 'Control')}</TableCell>
                    <TableCell>Δ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    ['earlyStageRate', t('早诊率 (I/II期)', 'Early stage (I/II)')],
                    ['treatmentInitiationRate', t('90天治疗启动', '90-day treatment')],
                    ['meanSurvival5y', t('模拟5年存活', 'Simulated 5y survival')],
                  ].map(([key, label]) => {
                    const c = results.comparison?.[key];
                    if (!c) return null;
                    return (
                      <TableRow key={key}>
                        <TableCell>{label}</TableCell>
                        <TableCell>{pct(c.intervention)}</TableCell>
                        <TableCell>{pct(c.control)}</TableCell>
                        <TableCell><Chip size="small" color="success" label={`+${pct(c.delta)}`} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <Alert severity="info" action={<Button onClick={runEval}>{t('运行评测', 'Run eval')}</Button>}>
                {t('暂无评测结果 — 点击运行队列评测', 'No results yet — run cohort evaluation')}
              </Alert>
            )}
          </TabPanel>

          <TabPanel value={tab} index={3}>
            {methods && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight={700}>{t('可穿戴基准', 'Wearable benchmark')}</Typography>
                  <Typography variant="body2" paragraph>
                    {methods.wearableBenchmark?.name || 'MedWear-Wearable-Analytics-Clinical-v2'}
                    {' · '}n={methods.wearableBenchmark?.n || wn}
                    {' · '}{t('取代', 'supersedes')} {methods.wearableBenchmark?.superseded || 'Mini-v1'}
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>{t('筛查队列', 'Screening cohort')}</Typography>
                  <Typography variant="body2" paragraph>
                    {methods.cohort?.name} · n={methods.cohort?.n}
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>{t('核心指标', 'Headline metrics')}</Typography>
                  <Typography component="ul" variant="body2" sx={{ pl: 2 }}>
                    {(methods.headlineMetrics || []).map((m) => <li key={m}>{m}</li>)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight={700}>{t('复现命令', 'Reproduction')}</Typography>
                  <Typography component="pre" variant="body2" sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2, fontSize: '0.8rem', mb: 2 }}>
                    {`npm run generate:benchmark\nnpm run evaluate\nnpm run generate:cohort\nnpm run evaluate:outcomes\nnpm run validate:cohort\nnpm run test:server`}
                  </Typography>
                </Grid>
              </Grid>
            )}
          </TabPanel>

          <TabPanel value={tab} index={4}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>{t('组别', 'Arm')}</TableCell>
                  <TableCell>{t('病种', 'Category')}</TableCell>
                  <TableCell>{t('风险', 'Risk')}</TableCell>
                  <TableCell>{t('分期', 'Stage')}</TableCell>
                  <TableCell>{t('治疗', 'Treated')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(dataset?.samplePatients || []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.id}</TableCell>
                    <TableCell>
                      <Chip size="small" label={p.arm === 'intervention' ? t('筛查组', 'Screened') : t('对照', 'Control')}
                        color={p.arm === 'intervention' ? 'primary' : 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell>{isEn ? p.categoryLabel_en : p.categoryLabel}</TableCell>
                    <TableCell>{p.riskTier}</TableCell>
                    <TableCell>{p.stageAtDiagnosis || '—'}</TableCell>
                    <TableCell>{p.treatmentStarted ? t('是', 'Yes') : t('否', 'No')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabPanel>

          <TabPanel value={tab} index={5}>
            {validation?.headline ? (
              <>
                <Alert severity={validation.verdict?.status === 'aligned' ? 'success' : 'info'} sx={{ mb: 2 }}>
                  {t(
                    `验证结论：${validation.verdict?.status_zh || '—'}（${validation.verdict?.passed}/${validation.verdict?.total}）· 对照 SEER / NLST / 中国肿瘤登记`,
                    `Verdict: ${validation.verdict?.status || '—'} (${validation.verdict?.passed}/${validation.verdict?.total}) · vs SEER / NLST / China NCCR`,
                  )}
                </Alert>
                <Table size="small" sx={{ mb: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('指标', 'Metric')}</TableCell>
                      <TableCell>{t('模拟值', 'Simulated')}</TableCell>
                      <TableCell>{t('说明', 'Notes')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      [t('敏感性', 'Sensitivity'), pct(validation.headline.sensitivity), 'NLST / NCCR'],
                      [t('特异性', 'Specificity'), pct(validation.headline.specificity), 'NLST / NCCR'],
                      [t('阳性预测值 PPV', 'PPV'), pct(validation.headline.ppv), 'NLST lung'],
                      ['AUC', validation.headline.auc ?? '—', t('ROC 曲线下面积', 'Area under ROC')],
                      [t('早诊率 (I/II)', 'Early dx I/II'), pct(validation.headline.earlyDiagnosisRate_iv), 'NLST / NCCR'],
                      [t('中位治疗延迟', 'Median tx delay'), `${validation.headline.treatmentMedianDays_iv ?? '—'} ${t('天', 'days')}`, 'SEER / NCCR'],
                      [t('5年存活改善', '5y survival gain'), pct(validation.headline.survival5yGain), 'NCCR'],
                    ].map(([label, val, note]) => (
                      <TableRow key={label}>
                        <TableCell>{label}</TableCell>
                        <TableCell><strong>{val}</strong></TableCell>
                        <TableCell><Typography variant="caption" color="text.secondary">{note}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Typography variant="caption" color="text.secondary">
                  {isEn ? validation.diagnosticValidation?.interpretation?.en : validation.diagnosticValidation?.interpretation?.zh}
                </Typography>
              </>
            ) : (
              <Alert severity="info" action={<Button onClick={runValidation}>{t('运行验证', 'Run validation')}</Button>}>
                {t('对照 SEER/NLST/中国肿瘤登记参考子集，验证早诊率、治疗延迟、存活改善及敏感性/特异性/PPV/AUC',
                  'Validate against SEER/NLST/China NCCR subsets: early dx, treatment delay, survival gain, sensitivity/specificity/PPV/AUC')}
              </Alert>
            )}
          </TabPanel>

          <TabPanel value={tab} index={6}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}><Gavel sx={{ mr: 1 }} /> {t('使用边界', 'Usage boundaries')}</AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
                  <li>{t('可穿戴基准与筛查队列为合成数据，非真实患者', 'Wearable benchmark and screening cohort are synthetic — not real patients')}</li>
                  <li>{t('可穿戴基准：随机生理信号 + 独立临床金标准（clinicalGoldStandard-v1），评测为引擎与金标准的一致率', 'Wearable benchmark: random physiology + independent clinical gold standard (clinicalGoldStandard-v1); metrics = engine vs gold agreement')}</li>
                  <li>{t('与结局对比页共享筛查队列数据源 outcomeModel', 'Shares screening cohort data source (outcomeModel) with Outcomes page')}</li>
                </Typography>
              </AccordionDetails>
            </Accordion>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}><Security sx={{ mr: 1 }} /> {t('开放许可', 'Open license')}</AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2">
                  CC-BY-4.0
                  {wearableDataset?.seed != null ? ` · wearable seed=${wearableDataset.seed}` : ''}
                  {dataset?.meta?.seed ? ` · cohort seed=${dataset.meta.seed}` : ''}
                </Typography>
              </AccordionDetails>
            </Accordion>
          </TabPanel>
        </Box>
      </Paper>

      {apiError && <Alert severity="warning" sx={{ mt: 2 }}>{apiError}</Alert>}

      <Alert severity="info" icon={<OpenInNew fontSize="small" />} sx={{ mt: 2 }}>
        {t('探索性情景', 'Exploratory scenarios')}:{' '}
        <Button size="small" onClick={() => navigate('/outcomes')}>{t('结局对比', 'Outcomes')}</Button>
        {' · '}
        <Button size="small" onClick={() => navigate('/ai/intervention')}>{t('AI 干预', 'AI Intervention')}</Button>
      </Alert>
    </Box>
  );
}

export default ResearchCenter;
