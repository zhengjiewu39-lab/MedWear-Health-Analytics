import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Chip, Button, LinearProgress, Card, CardContent,
  Stepper, Step, StepLabel, TextField, Alert, List, ListItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, Rating, Tabs, Tab, Divider, Tooltip,
} from '@mui/material';
import {
  CheckCircle, CalendarMonth, AccessTime, Assignment, Biotech,
  VerifiedUser, Gavel, Business,
} from '@mui/icons-material';
import { screeningApi } from '../services/api';
import { useDataMode } from '../contexts/DataModeContext';
import useModeRefresh from '../hooks/useModeRefresh';

const steps = ['选择机构', '选择套餐', '预约时间', '确认提交'];
const statusLabel = { confirmed: '已确认', pending: '待确认', completed: '已完成', cancelled: '已取消' };
const statusColor = { confirmed: 'success', pending: 'warning', completed: 'info', cancelled: 'default' };

const TYPE_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'hospital', label: '医院' },
  { value: 'checkup', label: '体检中心' },
  { value: 'clinic', label: '门诊部' },
  { value: 'lab', label: '检验机构' },
];

function LicenseBlock({ facility }) {
  if (!facility.licenseNo) return null;
  const valid = facility.licenseValidUntil && new Date(facility.licenseValidUntil) > new Date();
  return (
    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Gavel fontSize="small" color="action" />
        <Typography variant="caption" fontWeight={600}>执业资质</Typography>
        {facility.verified && (
          <Chip icon={<VerifiedUser />} label="资质已核验" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem', ml: 'auto' }} />
        )}
      </Box>
      <Typography variant="caption" display="block" color="text.secondary">
        {facility.licenseType || '医疗机构执业许可证'} · {facility.licenseNo}
      </Typography>
      <Typography variant="caption" display="block" color="text.secondary">
        发证机关：{facility.licenseAuthority}
      </Typography>
      <Typography variant="caption" display="block" color={valid ? 'success.main' : 'error.main'}>
        有效期至：{facility.licenseValidUntil} {valid ? '（有效）' : '（已过期，不可预约）'}
      </Typography>
      {facility.practiceScope && (
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
          诊疗科目：{facility.practiceScope}
        </Typography>
      )}
      {facility.clia && (
        <Chip label={facility.clia} size="small" variant="outlined" sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }} />
      )}
    </Box>
  );
}

function ExamAppointment() {
  const [hospitals, setHospitals] = useState([]);
  const [packages, setPackages] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [lastBooking, setLastBooking] = useState(null);
  const [location, setLocation] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const navigate = useNavigate();
  const { isReal } = useDataMode();

  const load = () => {
    setLoading(true);
    Promise.all([
      screeningApi.getHospitals(),
      screeningApi.getExamPackages(),
      screeningApi.getAppointments(),
    ]).then(([h, p, a]) => {
      setHospitals(h.data.hospitals || h.data);
      setLocation(h.data.location || null);
      setPackages(p.data);
      setAppointments(a.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useModeRefresh(load);

  useEffect(() => {
    if (date) {
      screeningApi.getSlots(date).then(res => setSlots(res.data)).catch(() => setSlots([]));
    }
  }, [date]);

  const isLicenseValid = (h) => {
    if (!h.licenseValidUntil) return true;
    return new Date(h.licenseValidUntil) > new Date();
  };

  const filteredHospitals = hospitals.filter(h => {
    if (typeFilter === 'all') return true;
    return h.type === typeFilter;
  });

  const typeCounts = TYPE_FILTERS.reduce((acc, f) => {
    acc[f.value] = f.value === 'all'
      ? hospitals.filter(isLicenseValid).length
      : hospitals.filter(h => h.type === f.value && isLicenseValid(h)).length;
    return acc;
  }, {});

  const handleBook = async () => {
    if (!isLicenseValid(selectedHospital)) return;
    setSubmitting(true);
    try {
      const res = await screeningApi.bookAppointment({
        hospitalId: selectedHospital.id,
        packageId: selectedPackage.id,
        date,
        time,
      });
      setLastBooking(res.data.appointment);
      setSuccessDialog(true);
      load();
      setStep(0);
      setSelectedHospital(null);
      setSelectedPackage(null);
      setDate('');
      setTime('');
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = [
    Boolean(selectedHospital && isLicenseValid(selectedHospital)),
    Boolean(selectedPackage),
    Boolean(date && time),
    true,
  ][step];

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>预约体检 · 医疗机构</Typography>
          <Typography variant="body2" color="text.secondary">
            {isReal ? '根据 IP 定位推荐附近持证医疗机构' : '演示模式 — 含医院、体检中心、门诊与检验机构'}
            {location?.city && ` · 当前定位: ${location.city}${location.region ? `, ${location.region}` : ''}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <Chip icon={<Business />} label={`可预约 ${typeCounts.all} 家机构`} size="small" color="primary" variant="outlined" />
            <Chip label={`医院 ${typeCounts.hospital}`} size="small" variant="outlined" />
            <Chip label={`体检中心 ${typeCounts.checkup}`} size="small" variant="outlined" />
            <Chip label={`门诊 ${typeCounts.clinic}`} size="small" variant="outlined" />
            <Chip label={`检验 ${typeCounts.lab}`} size="small" variant="outlined" />
          </Box>
        </Box>
        <Button variant="outlined" startIcon={<Assignment />} onClick={() => navigate('/doctor-report')}>查看医生报告</Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        仅展示持有有效《医疗机构执业许可证》或等效资质的机构；预约前请核对许可证号与有效期。
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
              {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {step === 0 && (
              <>
                <Tabs value={typeFilter} onChange={(_, v) => setTypeFilter(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
                  {TYPE_FILTERS.map(f => (
                    <Tab key={f.value} value={f.value} label={`${f.label} (${typeCounts[f.value] || 0})`} />
                  ))}
                </Tabs>
                <Grid container spacing={2}>
                  {filteredHospitals.length === 0 && (
                    <Grid item xs={12}>
                      <Typography color="text.secondary">该类型暂无可用机构</Typography>
                    </Grid>
                  )}
                  {filteredHospitals.map(h => {
                    const valid = isLicenseValid(h);
                    return (
                      <Grid item xs={12} md={6} key={h.id}>
                        <Card
                          variant={selectedHospital?.id === h.id ? 'elevation' : 'outlined'}
                          sx={{
                            cursor: valid ? 'pointer' : 'not-allowed',
                            opacity: valid ? 1 : 0.6,
                            border: selectedHospital?.id === h.id ? 2 : 0,
                            borderColor: 'primary.main',
                          }}
                          onClick={() => valid && setSelectedHospital(h)}
                        >
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                              <Typography variant="h6" fontWeight={600}>{h.name}</Typography>
                              {h.typeLabel && <Chip label={h.typeLabel} size="small" color="secondary" variant="outlined" />}
                            </Box>
                            <Chip label={h.level} size="small" color="primary" sx={{ mr: 1, my: 1 }} />
                            <Chip label={h.distance} size="small" variant="outlined" />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, my: 1 }}>
                              <Rating value={h.rating / 5 * 5} readOnly size="small" precision={0.1} />
                              <Typography variant="caption">{h.rating}</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>📍 {h.address}</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(h.departments || []).map(d => <Chip key={d} label={d} size="small" variant="outlined" />)}
                            </Box>
                            <LicenseBlock facility={h} />
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </>
            )}

            {step === 1 && (
              <Grid container spacing={2}>
                {packages.map(pkg => (
                  <Grid item xs={12} key={pkg.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: selectedPackage?.id === pkg.id ? 2 : 1,
                        borderColor: selectedPackage?.id === pkg.id ? 'primary.main' : 'divider',
                        bgcolor: pkg.highlight ? 'primary.50' : 'inherit',
                      }}
                      onClick={() => setSelectedPackage(pkg)}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                          <Box>
                            <Typography variant="h6" fontWeight={600}>{pkg.name}</Typography>
                            <Typography variant="body2" color="text.secondary">{pkg.suitable}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="h5" color="primary.main" fontWeight={700}>¥{pkg.price}</Typography>
                            <Typography variant="caption">{pkg.duration}</Typography>
                          </Box>
                        </Box>
                        <List dense>
                          {pkg.items.map(item => (
                            <ListItem key={item} disablePadding>
                              <ListItemIcon sx={{ minWidth: 28 }}><CheckCircle color="success" fontSize="small" /></ListItemIcon>
                              <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
                            </ListItem>
                          ))}
                        </List>
                        {pkg.includesWearableReport && (
                          <Chip icon={<Biotech />} label="含 MedWear 数据报告同步" size="small" color="secondary" />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {step === 2 && (
              <Box>
                <TextField
                  label="预约日期" type="date" fullWidth sx={{ mb: 3 }}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: new Date().toISOString().slice(0, 10) }}
                  value={date} onChange={e => { setDate(e.target.value); setTime(''); }}
                />
                <Typography variant="subtitle2" gutterBottom>可选时段</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {slots.map(s => (
                    <Chip
                      key={s} label={s} icon={<AccessTime />}
                      color={time === s ? 'primary' : 'default'}
                      variant={time === s ? 'filled' : 'outlined'}
                      onClick={() => setTime(s)}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {step === 3 && selectedHospital && selectedPackage && (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>预约信息确认 — 提交后机构将发送短信确认</Alert>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">医疗机构</Typography>
                  <Typography variant="h6" gutterBottom>{selectedHospital.name}</Typography>
                  {selectedHospital.typeLabel && <Chip label={selectedHospital.typeLabel} size="small" sx={{ mb: 1 }} />}
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" color="text.secondary">套餐</Typography>
                  <Typography gutterBottom>{selectedPackage.name} · ¥{selectedPackage.price}</Typography>
                  <Typography variant="subtitle2" color="text.secondary">时间</Typography>
                  <Typography gutterBottom>{date} {time}</Typography>
                  <LicenseBlock facility={selectedHospital} />
                </Paper>
                <Paper sx={{ p: 2, bgcolor: 'info.50' }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>将同步给医生的数据</Typography>
                  <List dense>
                    {['90 天心率/血氧/HRV 时序', '临床筛查结论（6 大类）', '异常事件与预警记录', '生物标志物对照表'].map(t => (
                      <ListItem key={t} disablePadding>
                        <ListItemIcon sx={{ minWidth: 28 }}><CheckCircle color="info" fontSize="small" /></ListItemIcon>
                        <ListItemText primary={t} />
                      </ListItem>
                    ))}
                  </List>
                  <Button size="small" onClick={() => navigate('/doctor-report')}>预览医生报告</Button>
                </Paper>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button disabled={step === 0} onClick={() => setStep(s => s - 1)}>上一步</Button>
              {step < 3 ? (
                <Tooltip title={step === 0 && selectedHospital && !isLicenseValid(selectedHospital) ? '该机构执业许可证已过期' : ''}>
                  <span>
                    <Button variant="contained" disabled={!canNext} onClick={() => setStep(s => s + 1)}>下一步</Button>
                  </span>
                </Tooltip>
              ) : (
                <Button variant="contained" disabled={submitting} onClick={handleBook}>
                  {submitting ? '提交中...' : '确认预约'}
                </Button>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CalendarMonth color="primary" />
              <Typography variant="h6" fontWeight={600}>我的预约</Typography>
            </Box>
            {appointments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">暂无预约记录</Typography>
            ) : appointments.map(a => (
              <Card key={a.id} variant="outlined" sx={{ mb: 2 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography fontWeight={600}>{a.packageName}</Typography>
                    <Chip label={statusLabel[a.status] || a.status} size="small" color={statusColor[a.status] || 'default'} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">{a.hospitalName}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{a.date} {a.time}</Typography>
                  {a.includesWearableReport !== false && (
                    <Chip label="含数据报告" size="small" color="secondary" variant="outlined" sx={{ mt: 1 }} />
                  )}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>{a.doctorNote}</Typography>
                </CardContent>
              </Card>
            ))}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={successDialog} onClose={() => setSuccessDialog(false)}>
        <DialogTitle>预约成功</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            {lastBooking?.hospitalName} · {lastBooking?.date} {lastBooking?.time}
          </Alert>
          <Typography variant="body2" paragraph>{lastBooking?.doctorNote}</Typography>
          <Typography variant="body2">请提前生成并保存医生报告，到院扫码或打印出示。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuccessDialog(false)}>关闭</Button>
          <Button variant="contained" onClick={() => { setSuccessDialog(false); navigate('/doctor-report'); }}>查看医生报告</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ExamAppointment;
