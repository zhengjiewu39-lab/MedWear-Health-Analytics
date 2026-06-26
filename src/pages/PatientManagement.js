import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, LinearProgress,
  Dialog, DialogTitle, DialogContent, Tabs, Tab, List, ListItem, ListItemText,
} from '@mui/material';
import { MonitorHeart, Devices, LocalHospital } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { patientApi } from '../services/api';

const riskColor = { low: 'success', medium: 'warning', high: 'error' };

function PatientManagement() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    patientApi.getAll().then(res => { setPatients(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>患者管理</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        管理佩戴可穿戴设备的患者档案，点击卡片查看详细健康数据
      </Typography>

      <Grid container spacing={3}>
        {patients.map(patient => (
          <Grid item xs={12} sm={6} md={4} key={patient.id}>
            <Card
              sx={{ height: '100%', cursor: 'pointer', transition: '0.2s', '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' } }}
              onClick={() => { setSelected(patient); setTab(0); }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">{patient.name}</Typography>
                  <Chip label={patient.riskLevel === 'high' ? '高风险' : patient.riskLevel === 'medium' ? '中风险' : '低风险'}
                    size="small" color={riskColor[patient.riskLevel]} />
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {patient.gender} · {patient.age}岁 · {patient.phone}
                </Typography>
                <LinearProgress variant="determinate" value={patient.healthScore}
                  color={patient.healthScore >= 80 ? 'success' : patient.healthScore >= 60 ? 'warning' : 'error'}
                  sx={{ my: 1.5, height: 8, borderRadius: 4 }} />
                <Typography variant="body2" fontWeight={600} textAlign="right">{patient.healthScore} 分</Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {patient.conditions.map(c => <Chip key={c} label={c} size="small" variant="outlined" color="warning" />)}
                  {patient.conditions.length === 0 && <Chip label="健康" size="small" color="success" variant="outlined" />}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        {selected && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {selected.name} 的健康档案
                <Chip label={`${selected.healthScore} 分`} color={riskColor[selected.riskLevel]} size="small" />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                <Tab label="基本信息" /><Tab label="生命体征" /><Tab label="设备绑定" /><Tab label="病史记录" />
              </Tabs>

              {tab === 0 && (
                <Grid container spacing={2}>
                  {[
                    { label: '姓名', value: selected.name },
                    { label: '性别', value: selected.gender },
                    { label: '年龄', value: `${selected.age} 岁` },
                    { label: '联系电话', value: selected.phone },
                    { label: '风险等级', value: selected.riskLevel === 'high' ? '高风险' : selected.riskLevel === 'medium' ? '中风险' : '低风险' },
                    { label: '最近活跃', value: selected.lastActive },
                  ].map(item => (
                    <Grid item xs={6} key={item.label}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                        <Typography variant="body1" fontWeight={600}>{item.value}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}

              {tab === 1 && (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={[
                    { day: '周一', hr: 75, spo2: 97 }, { day: '周二', hr: 78, spo2: 96 },
                    { day: '周三', hr: 72, spo2: 98 }, { day: '周四', hr: 80, spo2: 97 },
                    { day: '周五', hr: 76, spo2: 97 }, { day: '周六', hr: 70, spo2: 98 },
                    { day: '周日', hr: 74, spo2: 97 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" /><YAxis /><Tooltip />
                    <Line type="monotone" dataKey="hr" name="心率" stroke="#C62828" strokeWidth={2} />
                    <Line type="monotone" dataKey="spo2" name="血氧" stroke="#1565C0" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {tab === 2 && (
                <List>
                  <ListItem><Devices sx={{ mr: 2 }} /><ListItemText primary="绑定设备数" secondary={`${selected.devices} 台设备在线监测中`} /></ListItem>
                  <ListItem><MonitorHeart sx={{ mr: 2 }} /><ListItemText primary="监测指标" secondary="心率、血氧、步数、睡眠、ECG" /></ListItem>
                </List>
              )}

              {tab === 3 && (
                <List>
                  {selected.conditions.length > 0
                    ? selected.conditions.map(c => (
                      <ListItem key={c}><LocalHospital sx={{ mr: 2, color: 'warning.main' }} /><ListItemText primary={c} secondary="持续监测中" /></ListItem>
                    ))
                    : <ListItem><ListItemText primary="无已知病史" secondary="健康状况良好" /></ListItem>}
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
