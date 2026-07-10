import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Chip, Button, LinearProgress, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow, Alert, Divider,
} from '@mui/material';
import {
  Biotech, Assignment, CheckCircle, Warning, Info, Print, MenuBook,
} from '@mui/icons-material';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, Cell,
} from 'recharts';
import ChartContainer from '../components/ChartContainer';
import AiGovernanceBanner from '../components/AiGovernanceBanner';
import InterventionPathway from '../components/InterventionPathway';
import { screeningApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';
import { EvidenceBadge, ReferenceDialog } from '../components/ResearchCitation';
import { useLang } from '../contexts/LanguageContext';

const riskColor = { low: '#2E7D32', moderate: '#EF6C00', high: '#C62828', unknown: '#757575' };
const riskLabel = { low: '低风险', moderate: '中风险', high: '高风险', unknown: '待导入' };
const riskLabelEn = { low: 'Low Risk', moderate: 'Moderate Risk', high: 'High Risk', unknown: 'Pending Import' };
const riskChip = { low: 'success', moderate: 'warning', high: 'error', unknown: 'default' };
const insightIcon = { positive: <CheckCircle color="success" />, warning: <Warning color="warning" />, info: <Info color="info" /> };

const TREND_LINES = [
  { key: 'tumor', name: '肿瘤', name_en: 'Tumor', color: '#1565C0' },
  { key: 'cancer', name: '癌症', name_en: 'Cancer', color: '#6A1B9A' },
  { key: 'chronic', name: '慢病', name_en: 'Chronic Disease', color: '#EF6C00' },
  { key: 'cardio', name: '心脑血管', name_en: 'Cardio-Cerebrovascular', color: '#C62828' },
  { key: 'common', name: '常见小病', name_en: 'Common Ailments', color: '#00838F' },
  { key: 'respiratory', name: '呼吸系统', name_en: 'Respiratory', color: '#0277BD' },
];

function DiseaseScreening() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [refItem, setRefItem] = useState(null);
  const navigate = useNavigate();
  const { t, isEn } = useLang();
  const pick = (obj, field) => (isEn && obj?.[`${field}_en`]) || obj?.[field];
  const MONTH_EN = {
    '1月': 'Jan', '2月': 'Feb', '3月': 'Mar', '4月': 'Apr', '5月': 'May', '6月': 'Jun',
    '7月': 'Jul', '8月': 'Aug', '9月': 'Sep', '10月': 'Oct', '11月': 'Nov', '12月': 'Dec',
  };

  const load = () => {
    setLoading(true);
    screeningApi.getScreening().then(res => { setData(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useModeRefresh(load);

  if (loading) return <LinearProgress />;
  if (!data) return null;

  const activeCategory = data.categories[tab] || data.categories[0];
  const totalItems = data.categories.reduce((n, c) => n + (c.items?.length || 0), 0);
  const activeItems = (activeCategory?.items || []).map((it) => ({
    ...it,
    name: pick(it, 'name'),
    indicators: (isEn && it.indicators_en) || it.indicators,
    recommendation: pick(it, 'recommendation'),
  }));
  const trendData = (data.trendData || []).map((d) => ({ ...d, month: isEn ? (MONTH_EN[d.month] || d.month) : d.month }));
  const recommendedExams = (isEn && data.recommendedExams_en) || data.recommendedExams || [];

  return (
    <Box>
      <InterventionPathway />
      <AiGovernanceBanner compact />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('临床筛查中心', 'Clinical Screening Center')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t(
              `6 大类 · ${totalItems} 项筛查（肿瘤/癌症/慢病/心脑血管/常见小病/呼吸）`,
              `6 categories · ${totalItems} screening items (Tumor / Cancer / Chronic / Cardio-Cerebrovascular / Common Ailments / Respiratory)`,
            )}
            {' · '}{t(`${data.dataCoverage?.days || 0} 天数据`, `${data.dataCoverage?.days || 0} days of data`)} · {data.aiVersion || 'MedWear-AI v3'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<Assignment />} onClick={() => navigate('/ai/anomaly')}>{t('异常检测', 'Anomaly Detection')}</Button>
          <Button variant="contained" startIcon={<Assignment />} onClick={() => navigate('/ai/predictive')}>{t('预测分析', 'Predictive Analytics')}</Button>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #00838F 100%)', color: '#fff' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Biotech sx={{ fontSize: 48 }} />
              <Box>
                <Typography variant="h6" fontWeight={600}>{t('综合筛查结论', 'Overall Screening Conclusion')} · {t(riskLabel[data.overallRisk], riskLabelEn[data.overallRisk]) || t('评估中', 'Evaluating')}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.95 }}>{pick(data, 'summary')}</Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: { md: 'right' } }}>
              <Typography variant="h2" fontWeight={800}>{data.overallScore}</Typography>
              <Typography variant="body2">{t('综合风险指数（0-100，越低越好）', 'Overall Risk Index (0-100, lower is better)')}</Typography>
              <Chip label={t(`数据质量 ${data.dataCoverage?.quality || 0}%`, `Data Quality ${data.dataCoverage?.quality || 0}%`)} size="small" sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {data.categories.map((cat, i) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={cat.id || cat.name}>
            <Card
              sx={{ cursor: 'pointer', height: '100%', borderTop: 4, borderColor: riskColor[cat.riskLevel] || riskColor.low, outline: tab === i ? 2 : 0, outlineColor: 'primary.main' }}
              onClick={() => setTab(i)}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="subtitle2" fontWeight={600}>{pick(cat, 'name')}</Typography>
                  <Chip label={t(riskLabel[cat.riskLevel], riskLabelEn[cat.riskLevel])} size="small" color={riskChip[cat.riskLevel]} sx={{ height: 20, fontSize: '0.65rem' }} />
                </Box>
                <Typography variant="h5" fontWeight={700} color={riskColor[cat.riskLevel]}>{cat.score}</Typography>
                <Typography variant="caption" color="text.secondary">{t(`${cat.items?.length || 0} 项`, `${cat.items?.length || 0} items`)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {activeCategory && (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>{pick(activeCategory, 'name')} · {t('分项评估', 'Item-Level Assessment')}</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>{pick(activeCategory, 'description')}</Typography>
            <ChartContainer width="100%" height={220}>
              <BarChart data={activeItems} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 50]} unit="%" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, t('风险概率', 'Risk Probability')]} />
                <Bar dataKey="risk" name={t('风险', 'Risk')} radius={[0, 4, 4, 0]}>
                  {activeItems.map((item, idx) => (
                    <Cell key={idx} fill={riskColor[item.level] || riskColor.low} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <Divider sx={{ my: 2 }} />
            {activeItems.map(item => (
              <Box key={item.name} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2, borderLeft: 4, borderColor: riskColor[item.level] }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                  <Typography fontWeight={600}>{item.name}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={`${item.calibratedRisk ?? item.risk}% · ${t(riskLabel[item.level], riskLabelEn[item.level])}`} size="small" color={riskChip[item.level]} />
                    {item.evidenceLevel && <EvidenceBadge level={item.evidenceLevel} label={item.evidenceLabel} />}
                  </Box>
                </Box>
                {item.aiModel && (
                  <Typography variant="caption" color="primary" display="block" gutterBottom>
                    {t(`模型 ${item.aiModel}`, `Model ${item.aiModel}`)} · {t('置信度', 'Confidence')} {item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : '—'}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {t('依据：', 'Basis: ')}{(item.indicators || []).join(' · ')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>{item.recommendation}</Typography>
                {item.references?.length > 0 && (
                  <Button size="small" startIcon={<MenuBook />} onClick={() => setRefItem(item)}>
                    {t(`查看 ${item.references.length} 篇研究参考`, `View ${item.references.length} research references`)}
                  </Button>
                )}
              </Box>
            ))}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>{t('6 个月风险趋势', '6-Month Risk Trend')}</Typography>
            <ChartContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 45]} />
                <Tooltip />
                <Legend />
                {TREND_LINES.map(l => (
                  <Line key={l.key} type="monotone" dataKey={l.key} name={t(l.name, l.name_en)} stroke={l.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ChartContainer>
          </Paper>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>{t('AI 筛查洞察', 'AI Screening Insights')}</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              {t('基于当前患者可穿戴融合数据与 6 大类筛查模型的个体化解读', 'Personalized interpretation from fused wearable data and six screening model categories for the active patient')}
            </Typography>
            {(data.aiInsights || []).map((ins, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: ins.type === 'warning' ? 'warning.50' : ins.type === 'positive' ? 'success.50' : 'background.paper' }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  {insightIcon[ins.type]}
                  <Typography variant="body2" sx={{ lineHeight: 1.65 }}>{pick(ins, 'text')}</Typography>
                </Box>
              </Paper>
            ))}
          </Paper>
        </Grid>
      </Grid>
      )}

      {data.biomarkers?.length > 0 && (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight={600}>{t('融合生物标志物 · 可穿戴 + 临床', 'Integrated Biomarkers · Wearable + Clinical')}</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('指标', 'Indicator')}</TableCell>
              <TableCell>{t('当前值', 'Current Value')}</TableCell>
              <TableCell>{t('参考范围', 'Reference Range')}</TableCell>
              <TableCell>{t('状态', 'Status')}</TableCell>
              <TableCell>{t('数据来源', 'Data Source')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.biomarkers.map(b => (
              <TableRow key={b.name}>
                <TableCell>{pick(b, 'name')}</TableCell>
                <TableCell><strong>{b.value}</strong> {b.unit}</TableCell>
                <TableCell>{b.ref}</TableCell>
                <TableCell><Chip label={b.status === 'normal' ? t('正常', 'Normal') : t('关注', 'Watch')} size="small" color={b.status === 'normal' ? 'success' : 'warning'} /></TableCell>
                <TableCell><Typography variant="caption">{pick(b, 'source')}</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        {t('建议线下确认项目：', 'Recommended in-person confirmation exams: ')}{recommendedExams.join(t('、', ', '))}
      </Alert>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<Assignment />} onClick={() => navigate('/ai/anomaly')}>{t('进入异常检测', 'Go to Anomaly Detection')}</Button>
        <Button variant="outlined" startIcon={<Print />} onClick={() => navigate('/doctor-report')}>{t('生成医生报告', 'Generate Doctor Report')}</Button>
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
        {t('免责声明：AI 筛查为风险分层辅助工具，常见小病预警不能替代临床诊断，异常请就医。', 'Disclaimer: AI screening is a risk-stratification aid. Alerts for common ailments cannot replace clinical diagnosis; please seek medical care if abnormalities occur.')}
      </Typography>
      <ReferenceDialog item={refItem} open={Boolean(refItem)} onClose={() => setRefItem(null)} />
    </Box>
  );
}

export default DiseaseScreening;
