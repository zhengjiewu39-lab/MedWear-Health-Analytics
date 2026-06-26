import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Chip, Button, LinearProgress, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow, Alert, Divider,
} from '@mui/material';
import {
  Biotech, LocalHospital, Assignment, CheckCircle, Warning, Info, Print, MenuBook,
} from '@mui/icons-material';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { screeningApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';
import { EvidenceBadge, ReferenceDialog } from '../components/ResearchCitation';

const riskColor = { low: '#2E7D32', moderate: '#EF6C00', high: '#C62828', unknown: '#757575' };
const riskLabel = { low: '低风险', moderate: '中风险', high: '高风险', unknown: '待导入' };
const riskChip = { low: 'success', moderate: 'warning', high: 'error', unknown: 'default' };
const insightIcon = { positive: <CheckCircle color="success" />, warning: <Warning color="warning" />, info: <Info color="info" /> };

const TREND_LINES = [
  { key: 'tumor', name: '肿瘤', color: '#1565C0' },
  { key: 'cancer', name: '癌症', color: '#6A1B9A' },
  { key: 'chronic', name: '慢病', color: '#EF6C00' },
  { key: 'cardio', name: '心脑血管', color: '#C62828' },
  { key: 'common', name: '常见小病', color: '#00838F' },
  { key: 'respiratory', name: '呼吸系统', color: '#0277BD' },
];

function DiseaseScreening() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [refItem, setRefItem] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    screeningApi.getScreening().then(res => { setData(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useModeRefresh(load);

  if (loading) return <LinearProgress />;
  if (!data) return null;

  const activeCategory = data.categories[tab] || data.categories[0];
  const totalItems = data.categories.reduce((n, c) => n + (c.items?.length || 0), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>临床筛查中心</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            6 大类 · {totalItems} 项筛查（肿瘤/癌症/慢病/心脑血管/常见小病/呼吸）
            · {data.dataCoverage?.days || 0} 天数据 · {data.aiVersion || 'MedWear-AI v3'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<Assignment />} onClick={() => navigate('/doctor-report')}>医生报告</Button>
          <Button variant="contained" startIcon={<LocalHospital />} onClick={() => navigate('/appointments')}>预约体检</Button>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #00838F 100%)', color: '#fff' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Biotech sx={{ fontSize: 48 }} />
              <Box>
                <Typography variant="h6" fontWeight={600}>综合筛查结论 · {riskLabel[data.overallRisk] || '评估中'}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.95 }}>{data.summary}</Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: { md: 'right' } }}>
              <Typography variant="h2" fontWeight={800}>{data.overallScore}</Typography>
              <Typography variant="body2">综合风险指数（0-100，越低越好）</Typography>
              <Chip label={`数据质量 ${data.dataCoverage?.quality || 0}%`} size="small" sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
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
                  <Typography variant="subtitle2" fontWeight={600}>{cat.name}</Typography>
                  <Chip label={riskLabel[cat.riskLevel]} size="small" color={riskChip[cat.riskLevel]} sx={{ height: 20, fontSize: '0.65rem' }} />
                </Box>
                <Typography variant="h5" fontWeight={700} color={riskColor[cat.riskLevel]}>{cat.score}</Typography>
                <Typography variant="caption" color="text.secondary">{cat.items?.length || 0} 项</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {activeCategory && (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>{activeCategory.name} · 分项评估</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>{activeCategory.description}</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activeCategory.items} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 50]} unit="%" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, '风险概率']} />
                <Bar dataKey="risk" name="风险" radius={[0, 4, 4, 0]}>
                  {activeCategory.items.map((item, idx) => (
                    <Cell key={idx} fill={riskColor[item.level] || riskColor.low} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <Divider sx={{ my: 2 }} />
            {activeCategory.items.map(item => (
              <Box key={item.name} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2, borderLeft: 4, borderColor: riskColor[item.level] }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                  <Typography fontWeight={600}>{item.name}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={`${item.calibratedRisk ?? item.risk}% · ${riskLabel[item.level]}`} size="small" color={riskChip[item.level]} />
                    {item.evidenceLevel && <EvidenceBadge level={item.evidenceLevel} label={item.evidenceLabel} />}
                  </Box>
                </Box>
                {item.aiModel && (
                  <Typography variant="caption" color="primary" display="block" gutterBottom>
                    模型 {item.aiModel} · 置信度 {item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : '—'}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  依据：{(item.indicators || []).join(' · ')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>{item.recommendation}</Typography>
                {item.references?.length > 0 && (
                  <Button size="small" startIcon={<MenuBook />} onClick={() => setRefItem(item)}>
                    查看 {item.references.length} 篇研究参考
                  </Button>
                )}
              </Box>
            ))}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>6 个月风险趋势</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trendData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 45]} />
                <Tooltip />
                <Legend />
                {TREND_LINES.map(l => (
                  <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>AI 筛查洞察</Typography>
            {(data.aiInsights || []).map((ins, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                {insightIcon[ins.type]}
                <Typography variant="body2">{ins.text}</Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
      )}

      {data.biomarkers?.length > 0 && (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight={600}>融合生物标志物 · 可穿戴 + 临床</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>指标</TableCell>
              <TableCell>当前值</TableCell>
              <TableCell>参考范围</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>数据来源</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.biomarkers.map(b => (
              <TableRow key={b.name}>
                <TableCell>{b.name}</TableCell>
                <TableCell><strong>{b.value}</strong> {b.unit}</TableCell>
                <TableCell>{b.ref}</TableCell>
                <TableCell><Chip label={b.status === 'normal' ? '正常' : '关注'} size="small" color={b.status === 'normal' ? 'success' : 'warning'} /></TableCell>
                <TableCell><Typography variant="caption">{b.source}</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        建议线下确认项目：{(data.recommendedExams || []).join('、')}
      </Alert>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="contained" startIcon={<LocalHospital />} onClick={() => navigate('/appointments')}>一键预约对应体检</Button>
        <Button variant="outlined" startIcon={<Print />} onClick={() => navigate('/doctor-report')}>生成医生可读报告</Button>
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
        免责声明：AI 筛查为风险分层辅助工具，常见小病预警不能替代临床诊断，异常请就医。
      </Typography>
      <ReferenceDialog item={refItem} open={Boolean(refItem)} onClose={() => setRefItem(null)} />
    </Box>
  );
}

export default DiseaseScreening;
