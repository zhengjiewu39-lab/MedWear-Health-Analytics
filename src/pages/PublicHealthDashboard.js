import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, Button, Chip, Alert, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, MenuItem,
  Card, CardContent, Accordion, AccordionSummary, AccordionDetails, List,
  ListItem, ListItemText, Divider,
} from '@mui/material';
import {
  Coronavirus, Refresh, PlayArrow, ExpandMore, LocationOn, Groups,
  Timeline, Assessment, Balance, Science,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import PageHeader from '../components/PageHeader';
import { publicHealthApi } from '../services/api';

const DEFAULT_DATE = '2026-01-18';
const DEFAULT_DISTRICT = 'chaoyang';

const DISTRICT_OPTIONS = [
  { value: 'chaoyang', label: '朝阳区' },
  { value: 'pudong', label: '浦东新区' },
  { value: 'dongcheng', label: '东城区' },
  { value: 'haidian', label: '海淀区' },
  { value: 'tongzhou', label: '通州区' },
];

const SEVERITY_COLOR = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

/** @param {string|object} rec */
function recommendationText(rec) {
  if (rec == null) return '';
  if (typeof rec === 'string') return rec;
  return rec.recommendation_zh || rec.action_zh || rec.recommendation || '';
}

/** @param {string|object} rec @param {number} index */
function recommendationKey(rec, index) {
  if (typeof rec === 'string') return rec;
  return rec.action_id || `${rec.category || rec.priority || 'rec'}-${index}`;
}

const PRIORITY_COLOR = {
  immediate: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

function StatTile({ label, value, icon, color = 'primary' }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ textAlign: 'center', py: 2 }}>
        <Box sx={{ color: `${color}.main`, mb: 0.5 }}>{icon}</Box>
        <Typography variant="h5" fontWeight={700}>{value ?? '—'}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  );
}

function PublicHealthDashboard() {
  const [tab, setTab] = useState(0);
  const [district, setDistrict] = useState(DEFAULT_DISTRICT);
  const [date, setDate] = useState(DEFAULT_DATE);
  const [timeWindow, setTimeWindow] = useState(72);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState(null);
  const [clusters, setClusters] = useState(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [equityReport, setEquityReport] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [investigation, setInvestigation] = useState(null);
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [engineMeta, setEngineMeta] = useState(null);

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [metaRes, summaryRes, clustersRes, dailyRes, equityRes, evalRes] = await Promise.all([
        publicHealthApi.getMeta(),
        publicHealthApi.getSummary({ date, district }),
        publicHealthApi.getClusters({ district, timeWindow }),
        publicHealthApi.getDailyReport({ date, district }),
        publicHealthApi.getEquityAnalysis({ date, district }),
        publicHealthApi.getEvaluation(),
      ]);
      setEngineMeta(metaRes.data);
      setSummary(summaryRes.data);
      setClusters(clustersRes.data);
      setDailyReport(dailyRes.data.report);
      setEquityReport(equityRes.data.report);
      setEvaluation(evalRes.data.report);
      setInvestigation(null);
      setSelectedClusterId(null);
    } catch (e) {
      const status = e.response?.status;
      if (status === 401) {
        setError('请先登录后再访问公共卫生监测（将跳转登录页）');
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      } else if (!e.response) {
        setError('无法连接后端 API（http://localhost:3001），请在项目目录运行 npm run dev');
      } else {
        setError(e.response?.data?.message || '加载失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [date, district, timeWindow]);

  useEffect(() => { loadCore(); }, [loadCore]);

  const loadInvestigation = async (clusterId) => {
    setSelectedClusterId(clusterId);
    try {
      const res = await publicHealthApi.getInvestigation(clusterId);
      setInvestigation(res.data.report);
    } catch {
      setInvestigation(null);
    }
  };

  const runEvaluation = async () => {
    setEvaluating(true);
    try {
      const res = await publicHealthApi.runEvaluation(timeWindow);
      setEvaluation(res.data.report);
      setTab(4);
    } catch (e) {
      setError(e.response?.data?.message || '评测运行失败');
    } finally {
      setEvaluating(false);
    }
  };

  const syndromeChart = summary?.anomalies_by_syndrome
    ? Object.entries(summary.anomalies_by_syndrome).map(([name, count]) => ({ name, count }))
    : [];

  const categoryMetrics = evaluation?.summary_metrics?.by_category
    ? Object.entries(evaluation.summary_metrics.by_category).map(([cat, m]) => ({
      category: cat.replace(/_/g, ' '),
      sensitivity: +(m.sensitivity * 100).toFixed(0),
      ppv: +(m.ppv * 100).toFixed(0),
    }))
    : [];

  if (loading && !summary) return <LinearProgress />;

  return (
    <Box>
      <PageHeader
        title="公共卫生监测"
        subtitle="MedWear PHM · Level 1 个体异常 → Level 2 聚集检测 → Level 3 区域趋势 · 社区流行病学仪表盘"
        badge={<Chip icon={<Coronavirus />} label={engineMeta?.engine || 'MedWear-PHM'} size="small" color="primary" variant="outlined" />}
        actions={(
          <Button startIcon={<Refresh />} onClick={loadCore} disabled={loading}>
            刷新
          </Button>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
        演示数据来自 <strong>public-health-dataset.json</strong>（52 合成场景）。
        朝阳区请选 <strong>2026-01-18</strong>，浦东新区请选 <strong>2026-07-12</strong>。
      </Alert>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              select fullWidth size="small" label="监测区县"
              value={district} onChange={(e) => setDistrict(e.target.value)}
            >
              {DISTRICT_OPTIONS.map((d) => (
                <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth size="small" label="报告日期" type="date"
              value={date} onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              select fullWidth size="small" label="分析窗口"
              value={timeWindow} onChange={(e) => setTimeWindow(Number(e.target.value))}
            >
              {[24, 48, 72, 96, 168].map((h) => (
                <MenuItem key={h} value={h}>{h} 小时</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={2}>
            <StatTile label="在册监测" value={summary.monitoring_overview?.total_monitored_population} icon={<Groups />} />
          </Grid>
          <Grid item xs={6} md={2}>
            <StatTile label="当日异常" value={summary.monitoring_overview?.anomalies_today} icon={<Timeline />} color="warning" />
          </Grid>
          <Grid item xs={6} md={2}>
            <StatTile label="活跃聚集点" value={summary.monitoring_overview?.active_clusters} icon={<LocationOn />} color="error" />
          </Grid>
          <Grid item xs={6} md={2}>
            <StatTile label="活跃预警" value={summary.monitoring_overview?.active_alerts} icon={<Coronavirus />} color="error" />
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Typography variant="caption" color="text.secondary">概况摘要</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{summary.narrative_summary}</Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<Assessment />} iconPosition="start" label="监测概览" />
          <Tab icon={<LocationOn />} iconPosition="start" label="聚集点" />
          <Tab icon={<Timeline />} iconPosition="start" label="日报" />
          <Tab icon={<Balance />} iconPosition="start" label="公平性" />
          <Tab icon={<Science />} iconPosition="start" label="基准评测" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          <TabPanel value={tab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>当日异常按综合征分布</Typography>
                {syndromeChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={syndromeChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1565C0" name="异常数" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Alert severity="info">所选日期/区县暂无异常记录</Alert>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Top 聚集点</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>人数</TableCell>
                      <TableCell>综合征</TableCell>
                      <TableCell>可能性</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(summary?.top_clusters || []).map((c) => (
                      <TableRow key={c.cluster_id} hover sx={{ cursor: 'pointer' }}
                        onClick={() => { setTab(1); loadInvestigation(c.cluster_id); }}>
                        <TableCell>{c.cluster_id}</TableCell>
                        <TableCell>{c.member_count}</TableCell>
                        <TableCell>{c.syndrome}</TableCell>
                        <TableCell>{(c.likelihood * 100).toFixed(0)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Level 2 · {clusters?.cluster_count ?? 0} 个聚集点 · 窗口 {clusters?.time_window_hours}h
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>聚集点</TableCell>
                  <TableCell>人数</TableCell>
                  <TableCell>综合征</TableCell>
                  <TableCell>严重度</TableCell>
                  <TableCell>爆发可能性</TableCell>
                  <TableCell>告警级别</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(clusters?.clusters || []).map((c) => (
                  <TableRow key={c.cluster_id} selected={selectedClusterId === c.cluster_id}>
                    <TableCell>{c.cluster_id}</TableCell>
                    <TableCell>{c.member_count}</TableCell>
                    <TableCell>{c.syndrome}</TableCell>
                    <TableCell>
                      <Chip size="small" label={c.severity} color={SEVERITY_COLOR[c.severity] || 'default'} />
                    </TableCell>
                    <TableCell>{(c.outbreak_likelihood * 100).toFixed(0)}%</TableCell>
                    <TableCell>{c.alert_level}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => loadInvestigation(c.cluster_id)}>流调报告</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {investigation && (
              <Accordion expanded sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography fontWeight={600}>聚集点流调 — {investigation.cluster_basics?.cluster_id}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>基本信息</Typography>
                      <List dense>
                        <ListItem><ListItemText primary="成员数" secondary={investigation.cluster_basics?.member_count} /></ListItem>
                        <ListItem><ListItemText primary="综合征" secondary={investigation.cluster_basics?.dominant_syndrome} /></ListItem>
                        <ListItem><ListItemText primary="症状一致性" secondary={`${((investigation.symptom_profile?.symptom_concordance || 0) * 100).toFixed(0)}%`} /></ListItem>
                      </List>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>流行曲线</Typography>
                      {investigation.epidemic_curve?.cases_by_day?.length > 0 && (
                        <ResponsiveContainer width="100%" height={160}>
                          <LineChart data={investigation.epidemic_curve.cases_by_day}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="count" stroke="#d32f2f" name="病例" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </Grid>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle2" gutterBottom>建议干预</Typography>
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {(investigation.recommended_interventions || []).map((item, i) => (
                          <li key={recommendationKey(item, i)}>
                            <Typography variant="body2">{recommendationText(item)}</Typography>
                          </li>
                        ))}
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            )}
          </TabPanel>

          <TabPanel value={tab} index={2}>
            {dailyReport ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {dailyReport.narrative_summary}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2">监测覆盖</Typography>
                      <Typography variant="h4" fontWeight={700}>
                        {((dailyReport.monitoring_overview?.device_coverage || 0) * 100).toFixed(3)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        在册 {dailyReport.monitoring_overview?.total_monitored_population} /
                        人口 {dailyReport.monitoring_overview?.total_population_denominator?.toLocaleString()}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>公卫建议</Typography>
                      {(dailyReport.public_health_recommendations || []).map((rec, i) => {
                        const text = recommendationText(rec);
                        if (!text) return null;
                        const priority = typeof rec === 'object' ? rec.priority : undefined;
                        return (
                          <Chip
                            key={recommendationKey(rec, i)}
                            label={text}
                            size="small"
                            color={PRIORITY_COLOR[priority] || 'default'}
                            sx={{ mr: 0.5, mb: 0.5, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }}
                          />
                        );
                      })}
                    </Paper>
                  </Grid>
                </Grid>
              </>
            ) : (
              <Alert severity="info">暂无日报数据</Alert>
            )}
          </TabPanel>

          <TabPanel value={tab} index={3}>
            {equityReport ? (
              <>
                <Typography variant="body2" sx={{ mb: 2 }}>{equityReport.narrative_summary}</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>SES 设备覆盖率</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>社会经济层级</TableCell>
                          <TableCell>覆盖率</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(equityReport.ses_device_coverage?.by_ses || {}).map(([ses, rate]) => (
                          <TableRow key={ses}>
                            <TableCell>{ses}</TableCell>
                            <TableCell>{(rate * 100).toFixed(2)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>公平性建议</Typography>
                    <Box component="ul" sx={{ pl: 2 }}>
                      {(equityReport.equity_recommendations || []).map((r, i) => (
                        <li key={recommendationKey(r, i)}>
                          <Typography variant="body2">{recommendationText(r)}</Typography>
                        </li>
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </>
            ) : (
              <Alert severity="info">暂无公平性分析数据</Alert>
            )}
          </TabPanel>

          <TabPanel value={tab} index={4}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                52 场景论文评测 · MedWear-Public-Health-Surveillance-v1
              </Typography>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={runEvaluation}
                disabled={evaluating}
              >
                {evaluating ? '评测中…' : '运行基准评测'}
              </Button>
            </Box>

            {evaluation?.summary_metrics ? (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {[
                    { label: '灵敏度', value: `${(evaluation.summary_metrics.overall_sensitivity * 100).toFixed(1)}%` },
                    { label: '特异性', value: `${(evaluation.summary_metrics.overall_specificity * 100).toFixed(1)}%` },
                    { label: 'PPV', value: `${(evaluation.summary_metrics.overall_ppv * 100).toFixed(1)}%` },
                    { label: '平均提前预警', value: `${evaluation.summary_metrics.average_lead_time_hours ?? '—'} h` },
                    { label: '可预防病例(估)', value: evaluation.summary_metrics.cases_prevented_estimated },
                    { label: '场景数', value: evaluation.total_cases },
                  ].map((s) => (
                    <Grid item xs={6} md={2} key={s.label}>
                      <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={700}>{s.value}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {categoryMetrics.length > 0 && (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={categoryMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="sensitivity" fill="#1565C0" name="灵敏度" />
                      <Bar dataKey="ppv" fill="#2e7d32" name="PPV" />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>场景明细（前 10 条）</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>类别</TableCell>
                      <TableCell>检出</TableCell>
                      <TableCell>TP</TableCell>
                      <TableCell>提前预警(h)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(evaluation.results || []).slice(0, 10).map((r) => (
                      <TableRow key={r.case_id}>
                        <TableCell>{r.case_id}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell>{r.detected ? '是' : '否'}</TableCell>
                        <TableCell>{r.true_positive ? '✓' : '—'}</TableCell>
                        <TableCell>{r.lead_time_hours ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <Alert severity="info" action={<Button onClick={runEvaluation}>运行评测</Button>}>
                暂无评测结果，点击运行 52 场景基准测试
              </Alert>
            )}
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

export default PublicHealthDashboard;
