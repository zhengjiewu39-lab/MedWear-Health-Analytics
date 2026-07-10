import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, LinearProgress,
  Dialog, DialogTitle, DialogContent, Tabs, Tab, List, ListItem, ListItemText,
  TextField, MenuItem, Stack, Button, TablePagination, Alert,
} from '@mui/material';
import { Devices, LocalHospital, Refresh } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import ChartContainer from '../components/ChartContainer';
import { patientApi } from '../services/api';
import PageHeader from '../components/PageHeader';
import { useLang } from '../contexts/LanguageContext';
import { useDataMode } from '../contexts/DataModeContext';
import { useDemoPatient } from '../contexts/DemoPatientContext';
import useModeRefresh from '../hooks/useModeRefresh';

const riskColor = { low: 'success', medium: 'warning', high: 'error' };
const ARM_OPTIONS = [
  { value: '', label_zh: '全部组别', label_en: 'All arms' },
  { value: 'intervention', label_zh: '干预组', label_en: 'Intervention' },
  { value: 'usual_care', label_zh: '对照组', label_en: 'Control' },
];
const RISK_OPTIONS = [
  { value: '', label_zh: '全部风险', label_en: 'All risk' },
  { value: 'low', label_zh: '低风险', label_en: 'Low' },
  { value: 'moderate', label_zh: '中风险', label_en: 'Moderate' },
  { value: 'high', label_zh: '高风险', label_en: 'High' },
];

function vitalsTrendFromSignals(signals, t) {
  const base = signals?.restingHR || 72;
  const spo2 = signals?.spo2 || 97;
  return [
    { day: t('周一', 'Mon'), hr: base - 2, spo2: spo2 - 0.3 },
    { day: t('周二', 'Tue'), hr: base + 1, spo2: spo2 - 0.1 },
    { day: t('周三', 'Wed'), hr: base - 3, spo2: spo2 },
    { day: t('周四', 'Thu'), hr: base + 2, spo2: spo2 - 0.2 },
    { day: t('周五', 'Fri'), hr: base, spo2: spo2 - 0.1 },
    { day: t('周六', 'Sat'), hr: base - 4, spo2: spo2 + 0.2 },
    { day: t('周日', 'Sun'), hr: base - 1, spo2: spo2 },
  ];
}

function PatientManagement() {
  const { t, isEn } = useLang();
  const { isDemo } = useDataMode();
  const { patientId: activePatientId, setPatientId } = useDemoPatient();
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState(0);
  const [arm, setArm] = useState('');
  const [riskTier, setRiskTier] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 24;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await patientApi.getAll({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        arm: arm || undefined,
        riskTier: riskTier || undefined,
        q: query || undefined,
      });
      setPatients(res.data?.patients || []);
      setTotal(res.data?.total || 0);
      setActiveId(res.data?.activeId || null);
    } catch {
      setPatients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [arm, riskTier, query, page]);

  useModeRefresh(load);

  const handleSelectPatient = (patient) => {
    setSelected(patient);
    setTab(0);
    if (isDemo) setPatientId(patient.id);
  };

  const resolvedActiveId = isDemo ? (activePatientId || activeId) : null;
  const activeName = patients.find((p) => p.id === resolvedActiveId)?.name;

  const riskLabel = (level) => {
    if (level === 'high') return t('高风险', 'High Risk');
    if (level === 'medium') return t('中风险', 'Medium Risk');
    return t('低风险', 'Low Risk');
  };

  return (
    <Box>
      <PageHeader
        title={t('患者管理', 'Patient Management')}
        subtitle={t('n=5000 研究队列 · 任意成员均可作为演示者切换全系统分析',
          'n=5000 research cohort · any member can be selected as the active demo participant')}
        breadcrumbs={[{ label: t('结局对比', 'Outcomes'), path: '/outcomes' }, { label: t('患者队列', 'Patient Cohort') }]}
        actions={<Button startIcon={<Refresh />} onClick={load}>{t('刷新', 'Refresh')}</Button>}
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        {t(`研究队列共 ${total} 例（干预/对照各半）`,
          `Research cohort: ${total} participants (50/50 arms)`)}
        {isDemo && (
          <> · {t(`当前演示者：${activeName || '—'}（${resolvedActiveId || '—'}）`,
            ` · Active demo: ${activeName || '—'} (${resolvedActiveId || '—'})`)}</>
        )}
      </Alert>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select size="small" label={t('研究组别', 'Study arm')} value={arm}
            onChange={(e) => { setArm(e.target.value); setPage(0); }}
            sx={{ minWidth: 140 }}
          >
            {ARM_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{isEn ? o.label_en : o.label_zh}</MenuItem>
            ))}
          </TextField>
          <TextField
            select size="small" label={t('风险分层', 'Risk tier')} value={riskTier}
            onChange={(e) => { setRiskTier(e.target.value); setPage(0); }}
            sx={{ minWidth: 140 }}
          >
            {RISK_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{isEn ? o.label_en : o.label_zh}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small" label={t('搜索 ID / 姓名 / 设备', 'Search ID / name / device')} value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            sx={{ flex: 1 }}
          />
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {patients.map((patient) => {
          const isActive = resolvedActiveId === patient.id;
          return (
          <Grid item xs={12} sm={6} md={4} key={patient.id}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: '0.2s',
                border: isActive ? '2px solid' : '1px solid',
                borderColor: isActive ? 'primary.main' : 'divider',
                boxShadow: isActive ? 6 : 1,
                '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
              }}
              onClick={() => handleSelectPatient(patient)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography variant="h6">{patient.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{patient.id}</Typography>
                  </Box>
                  <Stack spacing={0.5} alignItems="flex-end">
                    <Chip label={riskLabel(patient.riskLevel)} size="small" color={riskColor[patient.riskLevel]} />
                    {isActive && (
                      <Chip label={t('当前患者', 'Active')} size="small" color="primary" variant="filled" />
                    )}
                  </Stack>
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap' }}>
                  <Chip
                    size="small" variant="outlined"
                    label={patient.arm === 'intervention' ? t('干预组', 'IV') : t('对照组', 'UC')}
                    color={patient.arm === 'intervention' ? 'primary' : 'warning'}
                  />
                  {patient.id === resolvedActiveId && (
                    <Chip size="small" color="primary" label={t('当前演示者', 'Active demo')} />
                  )}
                  {patient.scenario && (
                    <Chip size="small" variant="outlined" label={isEn ? (patient.scenario_en || patient.scenario) : patient.scenario} />
                  )}
                  {patient.stageAtDiagnosis && (
                    <Chip size="small" label={`${t('分期', 'Stage')} ${patient.stageAtDiagnosis}`} />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {patient.gender} · {patient.age}{t('岁', ' yrs')} · {patient.phone}
                </Typography>
                <LinearProgress variant="determinate" value={patient.healthScore}
                  color={patient.healthScore >= 80 ? 'success' : patient.healthScore >= 60 ? 'warning' : 'error'}
                  sx={{ my: 1.5, height: 8, borderRadius: 4 }} />
                <Typography variant="body2" fontWeight={600} textAlign="right">{patient.healthScore} {t('分', 'pts')}</Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {(isEn ? patient.conditions_en : patient.conditions)?.map((c) => (
                    <Chip key={c} label={c} size="small" variant="outlined" color="warning" />
                  ))}
                  {patient.conditions?.length === 0 && <Chip label={t('健康', 'Healthy')} size="small" color="success" variant="outlined" />}
                </Box>
                {patient.signals && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    HR {patient.signals.restingHR} · HRV {patient.signals.hrv} · SpO₂ {patient.signals.spo2}% · {patient.signals.steps} {t('步', 'steps')}
                  </Typography>
                )}
                {patient.deviceIntegration && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {isEn ? patient.deviceIntegration.primaryDevice_en : patient.deviceIntegration.primaryDevice}
                    {' · '}
                    {patient.devices} {t('台设备', 'devices')}
                    {' · '}
                    {isEn ? patient.deviceIntegration.fusionLabel_en : patient.deviceIntegration.fusionLabel}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          );
        })}
      </Grid>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[rowsPerPage]}
        labelDisplayedRows={({ from, to, count }) => t(`${from}-${to} / 共 ${count}`, `${from}-${to} of ${count}`)}
      />

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        {selected && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                {t(`${selected.name} 的健康档案`, `${selected.name}'s Health Profile`)}
                <Chip label={`${selected.healthScore} ${t('分', 'pts')}`} color={riskColor[selected.riskLevel]} size="small" />
                <Chip label={selected.id} size="small" variant="outlined" />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                <Tab label={t('基本信息', 'Basic Info')} />
                <Tab label={t('生命体征', 'Vital Signs')} />
                <Tab label={t('设备绑定', 'Devices')} />
                <Tab label={t('病史记录', 'Medical History')} />
              </Tabs>

              {tab === 0 && (
                <Grid container spacing={2}>
                  {[
                    { label: t('姓名', 'Name'), value: selected.name },
                    { label: 'ID', value: selected.id },
                    { label: t('研究组别', 'Study arm'), value: selected.arm === 'intervention' ? t('干预组', 'Intervention') : t('对照组', 'Control') },
                    { label: t('性别', 'Gender'), value: selected.gender },
                    { label: t('年龄', 'Age'), value: `${selected.age} ${t('岁', 'yrs')}` },
                    { label: t('联系电话', 'Phone'), value: selected.phone },
                    { label: t('风险等级', 'Risk Level'), value: riskLabel(selected.riskLevel) },
                    { label: t('风险评分', 'Risk score'), value: selected.riskScore },
                    { label: t('最近活跃', 'Last Active'), value: selected.lastActive },
                    { label: t('确诊分期', 'Stage at dx'), value: selected.stageAtDiagnosis || '—' },
                  ].map((item) => (
                    <Grid item xs={6} key={item.label}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                        <Typography variant="body1" fontWeight={600}>{item.value}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}

              {tab === 1 && selected.signals && (
                <>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    {[
                      { label: t('静息心率', 'Resting HR'), value: `${selected.signals.restingHR} bpm` },
                      { label: 'HRV', value: `${selected.signals.hrv} ms` },
                      { label: 'SpO₂', value: `${selected.signals.spo2}%` },
                      { label: t('步数', 'Steps'), value: selected.signals.steps },
                      { label: t('收缩压', 'Systolic BP'), value: `${selected.signals.systolicBP} mmHg` },
                      { label: t('空腹血糖', 'Fasting glucose'), value: `${selected.signals.fastingGlucose} mmol/L` },
                      { label: 'BMI', value: selected.signals.bmi },
                      { label: t('睡眠', 'Sleep'), value: `${selected.signals.sleepHours} h` },
                    ].map((item) => (
                      <Grid item xs={6} sm={3} key={item.label}>
                        <Paper sx={{ p: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                          <Typography variant="body2" fontWeight={700}>{item.value}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  <ChartContainer width="100%" height={250}>
                    <LineChart data={vitalsTrendFromSignals(selected.signals, t)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" /><YAxis /><Tooltip />
                      <Line type="monotone" dataKey="hr" name={t('心率', 'Heart Rate')} stroke="#C62828" strokeWidth={2} />
                      <Line type="monotone" dataKey="spo2" name={t('血氧', 'SpO₂')} stroke="#1565C0" strokeWidth={2} />
                    </LineChart>
                  </ChartContainer>
                </>
              )}

              {tab === 2 && selected.deviceIntegration && (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {t(
                      `多设备融合监测：${selected.deviceIntegration.fusionLabel}，融合数据质量 ${selected.deviceIntegration.fusedQuality}%（单设备 ${selected.deviceIntegration.singleQuality}%），准确率提升 +${Math.round(selected.deviceIntegration.accuracyGain * 100)}%`,
                      `Multi-device fusion: ${selected.deviceIntegration.fusionLabel_en}, fused quality ${selected.deviceIntegration.fusedQuality}% (single device ${selected.deviceIntegration.singleQuality}%), accuracy gain +${Math.round(selected.deviceIntegration.accuracyGain * 100)}%`,
                    )}
                  </Alert>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    {[
                      { label: t('融合模式', 'Fusion mode'), value: isEn ? selected.deviceIntegration.fusionLabel_en : selected.deviceIntegration.fusionLabel },
                      { label: t('主设备', 'Primary device'), value: isEn ? selected.deviceIntegration.primaryDevice_en : selected.deviceIntegration.primaryDevice },
                      { label: t('融合准确率', 'Fused accuracy'), value: `${Math.round(selected.deviceIntegration.fusionAccuracy * 100)}%` },
                      { label: t('单设备准确率', 'Single-device accuracy'), value: `${Math.round(selected.deviceIntegration.singleDeviceAccuracy * 100)}%` },
                    ].map((item) => (
                      <Grid item xs={6} sm={3} key={item.label}>
                        <Paper sx={{ p: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                          <Typography variant="body2" fontWeight={700}>{item.value}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  <List>
                    {(selected.deviceList || selected.deviceIntegration.devices || []).map((d) => (
                      <ListItem key={d.deviceId || d.id} divider>
                        <Devices sx={{ mr: 2, color: d.status === 'online' ? 'success.main' : 'text.disabled' }} />
                        <ListItemText
                          primary={isEn ? (d.name_en || d.name) : d.name}
                          secondary={t(
                            `${d.type} · ${d.vendor} · 电量 ${d.battery}% · ${d.lastSync} · 单设备准确率 ${d.singleDeviceAccuracy}%`,
                            `${d.type} · ${d.vendor} · Battery ${d.battery}% · ${d.lastSync} · Single-device accuracy ${d.singleDeviceAccuracy}%`,
                          )}
                        />
                        <Chip size="small" label={d.status === 'online' ? t('在线', 'Online') : t('离线', 'Offline')} color={d.status === 'online' ? 'success' : 'default'} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {tab === 3 && (
                <List>
                  {selected.conditions.length > 0
                    ? selected.conditions.map((c) => (
                      <ListItem key={c}><LocalHospital sx={{ mr: 2, color: 'warning.main' }} /><ListItemText primary={c} secondary={t('持续监测中', 'Under continuous monitoring')} /></ListItem>
                    ))
                    : <ListItem><ListItemText primary={t('无已知病史', 'No known medical history')} secondary={t('健康状况良好', 'In good health')} /></ListItem>}
                </List>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default PatientManagement;
