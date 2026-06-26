import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, Button, Chip, Alert, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, Card, CardContent,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  Science, PlayArrow, Gavel, ExpandMore, Refresh,
  Biotech, MenuBook, CheckCircle, Memory, Security, Timeline,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { researchApi } from '../services/api';

function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const RISK_ZH = { low: '低', moderate: '中', high: '高', unknown: '—' };
const RISK_COLOR = { low: 'success', moderate: 'warning', high: 'error' };

function ResearchCenter() {
  const [tab, setTab] = useState(0);
  const [results, setResults] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [methods, setMethods] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [apiError, setApiError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const [res, ds, m] = await Promise.all([
        researchApi.getResults(),
        researchApi.getDataset(),
        researchApi.getMethods(),
      ]);
      setResults(res.data?.metrics ? res.data : null);
      setDataset(ds.data);
      setMethods(m.data);
    } catch (e) {
      console.error(e);
      setApiError(e.response?.status === 404
        ? '分析评价 API 未就绪，请在项目目录执行 npm run server 重启后端（端口 3001）'
        : '无法连接 API，请确认后端已启动');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runEval = async () => {
    setEvaluating(true);
    try {
      const res = await researchApi.runEvaluation();
      setResults(res.data);
    } finally {
      setEvaluating(false);
    }
  };

  const metricChart = results?.metrics ? [
    { name: '告警 F1', value: +(results.metrics.alerts.f1 * 100).toFixed(1) },
    { name: '异常检测', value: +(results.metrics.anomalyAccuracy * 100).toFixed(1) },
    { name: '风险分层', value: +(results.metrics.riskAccuracy * 100).toFixed(1) },
    { name: '评分达标', value: +(results.metrics.healthScoreInRangeRate * 100).toFixed(1) },
  ] : [];

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            <Science sx={{ mr: 1, verticalAlign: 'middle' }} />
            分析评价中心
          </Typography>
          <Typography variant="body2" color="text.secondary">
            可穿戴数据分析引擎 · 公开基准评测 · 可解释方法 · 可复现实验
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={load}>刷新</Button>
          <Button variant="contained" startIcon={<PlayArrow />} onClick={runEval} disabled={evaluating}>
            {evaluating ? '评测中...' : '运行基准测试'}
          </Button>
        </Box>
      </Box>

      {apiError && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setApiError('')}>{apiError}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: '基准样本', value: dataset?.cases?.length || 8, icon: <Biotech /> },
          { label: '告警 F1', value: results?.metrics?.alerts?.f1?.toFixed(3) || '—', icon: <CheckCircle /> },
          { label: '异常检测准确率', value: results?.metrics?.anomalyAccuracy ? `${(results.metrics.anomalyAccuracy * 100).toFixed(0)}%` : '—', icon: <Timeline /> },
          { label: '分析引擎', value: results?.engine?.replace('MedWear-', '') || 'AnalyticsCore-v1', icon: <Memory /> },
        ].map(s => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Box sx={{ color: 'primary.main', mb: 0.5 }}>{s.icon}</Box>
              <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="平台能力" />
          <Tab label="评测结果" />
          <Tab label="分析方法" />
          <Tab label="基准数据集" />
          <Tab label="合规说明" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          <TabPanel value={tab} index={0}>
            <Typography variant="body1" paragraph color="text.secondary">
              MedWear 将 Apple Health 可穿戴数据转化为可解释的健康洞察，覆盖监测、筛查、报告与预约的完整链路。
            </Typography>
            <Grid container spacing={2}>
              {[
                { icon: <Memory />, title: '双模式数据引擎', desc: '演示模式与 Apple Health 真实导入完全隔离，保证演示与实测互不干扰' },
                { icon: <Timeline />, title: '透明分析算法', desc: '健康评分、阈值告警、个人基线 2σ 异常检测 — 公式公开、可审计' },
                { icon: <Biotech />, title: '临床筛查工作流', desc: '多维度风险筛查、文献引用、体检预约与结构化医生报告' },
                { icon: <Security />, title: '隐私优先架构', desc: '本地解析与存储、审计日志、加密健康保险库、匿名导出' },
                { icon: <Science />, title: '公开基准评测', desc: 'CC-BY-4.0 合成数据集，一键复现 Alert / 异常 / 风险分层指标' },
                { icon: <CheckCircle />, title: '工程化交付', desc: '单元测试、CI 流水线、Docker 部署，支持持续集成与版本追踪' },
              ].map(c => (
                <Grid item xs={12} md={6} key={c.title}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <Box sx={{ color: 'primary.main', mt: 0.3 }}>{c.icon}</Box>
                      <Box>
                        <Typography fontWeight={600}>{c.title}</Typography>
                        <Typography variant="body2" color="text.secondary">{c.desc}</Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </TabPanel>

          <TabPanel value={tab} index={1}>
            {!results?.metrics ? (
              <Alert severity="info" action={<Button onClick={runEval}>运行评测</Button>}>
                暂无评测结果，点击「运行基准测试」生成报告
              </Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {results.dataset} · n={results.n} · {new Date(results.evaluatedAt).toLocaleString()}
                </Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={metricChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={v => `${v}%`} />
                    <Bar dataKey="value" fill="#1565C0" name="得分" />
                  </BarChart>
                </ResponsiveContainer>
                <Table size="small" sx={{ mt: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>评测项</TableCell>
                      <TableCell>Precision</TableCell>
                      <TableCell>Recall</TableCell>
                      <TableCell>F1 / Accuracy</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>告警检测</TableCell>
                      <TableCell>{(results.metrics.alerts.precision * 100).toFixed(1)}%</TableCell>
                      <TableCell>{(results.metrics.alerts.recall * 100).toFixed(1)}%</TableCell>
                      <TableCell>{(results.metrics.alerts.f1 * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>异常检测</TableCell>
                      <TableCell colSpan={2}>—</TableCell>
                      <TableCell>{(results.metrics.anomalyAccuracy * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>风险分层</TableCell>
                      <TableCell colSpan={2}>—</TableCell>
                      <TableCell>{(results.metrics.riskAccuracy * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            )}
          </TabPanel>

          <TabPanel value={tab} index={2}>
            {methods && (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  以下方法均为<strong>可解释规则与统计模型</strong>，非黑盒深度学习，便于临床与工程团队审查。
                </Alert>
                <Typography variant="subtitle1" fontWeight={600}>健康评分</Typography>
                <Typography variant="body2" paragraph>{methods.healthScore?.formula}</Typography>
                <Typography variant="subtitle1" fontWeight={600}>告警规则</Typography>
                <Typography component="ul" variant="body2" sx={{ pl: 2, mb: 2 }}>
                  {(methods.alerts?.rules || []).map(r => <li key={r}>{r}</li>)}
                </Typography>
                <Typography variant="subtitle1" fontWeight={600}>异常检测</Typography>
                <Typography variant="body2" paragraph>{methods.anomalies?.method}</Typography>
                <Typography variant="subtitle1" fontWeight={600}>风险分层</Typography>
                <Typography variant="body2">
                  低风险: {methods.riskStratification?.tiers?.low} ·
                  中风险: {methods.riskStratification?.tiers?.moderate} ·
                  高风险: {methods.riskStratification?.tiers?.high}
                </Typography>
              </>
            )}
          </TabPanel>

          <TabPanel value={tab} index={3}>
            <Alert severity="info" sx={{ mb: 2 }}>
              {dataset?.description} · 许可 {dataset?.license}
            </Alert>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>场景</TableCell>
                  <TableCell>预期告警</TableCell>
                  <TableCell>异常</TableCell>
                  <TableCell>风险</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(dataset?.cases || []).map(c => (
                  <TableRow key={c.id} hover>
                    <TableCell>{c.id}</TableCell>
                    <TableCell>{c.label}</TableCell>
                    <TableCell>{c.expected.alerts.length ? c.expected.alerts.join(', ') : '无'}</TableCell>
                    <TableCell>{c.expected.anomaly ? '是' : '否'}</TableCell>
                    <TableCell><Chip label={RISK_ZH[c.expected.riskLevel]} size="small" color={RISK_COLOR[c.expected.riskLevel]} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabPanel>

          <TabPanel value={tab} index={4}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}><Gavel sx={{ mr: 1 }} /> 使用边界</AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
                  <li>本系统为健康数据分析与决策辅助平台，<strong>非医疗器械</strong></li>
                  <li>Apple Health 数据仅存本地，默认不上传云端</li>
                  <li>ECG 页面为 UI 演示波形，非真实 Apple Watch 心电分析</li>
                  <li>筛查与 AI 输出须结合专业医疗意见，不可替代临床诊断</li>
                </Typography>
              </AccordionDetails>
            </Accordion>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}><MenuBook sx={{ mr: 1 }} /> 开发者复现</AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  完整方法学与评测协议见项目 docs/ 目录。
                </Typography>
                <Typography variant="body2" component="pre" sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, fontSize: '0.8rem' }}>
{`npm install
npm run test:server
npm run evaluate
npm run dev`}
                </Typography>
              </AccordionDetails>
            </Accordion>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

export default ResearchCenter;
