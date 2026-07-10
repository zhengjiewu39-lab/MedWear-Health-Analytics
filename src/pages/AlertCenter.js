import React, { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Tabs, Tab, Button, LinearProgress,
} from '@mui/material';
import { CheckCircle, Pending, DoneAll } from '@mui/icons-material';
import { alertApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';
import { useLang } from '../contexts/LanguageContext';

const severityConfig = {
  critical: { label: '紧急', label_en: 'Critical', color: 'error' },
  high: { label: '高', label_en: 'High', color: 'warning' },
  medium: { label: '中', label_en: 'Medium', color: 'info' },
  low: { label: '低', label_en: 'Low', color: 'default' },
  info: { label: '提示', label_en: 'Info', color: 'success' },
};

function getSeverityConfig(severity) {
  return severityConfig[severity] || { label: severity || '—', color: 'default' };
}

function getStatusConfig(status) {
  return statusConfig[status] || { label: status || '—', color: 'default', icon: <Pending fontSize="small" /> };
}

const statusConfig = {
  pending: { label: '待处理', label_en: 'Pending', color: 'error', icon: <Pending fontSize="small" /> },
  acknowledged: { label: '已确认', label_en: 'Acknowledged', color: 'warning', icon: <CheckCircle fontSize="small" /> },
  resolved: { label: '已解决', label_en: 'Resolved', color: 'success', icon: <DoneAll fontSize="small" /> },
};

function AlertCenter() {
  const [alerts, setAlerts] = useState([]);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const { t } = useLang();

  const load = () => {
    setLoading(true);
    alertApi.getAll().then(res => { setAlerts(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useModeRefresh(load);

  const filterMap = ['all', 'pending', 'acknowledged', 'resolved'];
  const filtered = tab === 0 ? alerts : alerts.filter(a => a.status === filterMap[tab]);

  const handleResolve = (id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>{t('预警中心', 'Alert Center')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('AI 驱动的智能预警系统，实时检测生命体征异常并推送告警', 'AI-driven intelligent alerting system that detects vital-sign anomalies in real time and pushes alerts')}
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {[
          { label: t('全部', 'All'), count: alerts.length, color: 'primary' },
          { label: t('待处理', 'Pending'), count: alerts.filter(a => a.status === 'pending').length, color: 'error' },
          { label: t('已确认', 'Acknowledged'), count: alerts.filter(a => a.status === 'acknowledged').length, color: 'warning' },
          { label: t('已解决', 'Resolved'), count: alerts.filter(a => a.status === 'resolved').length, color: 'success' },
        ].map(item => (
          <Paper key={item.label} sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} color={`${item.color}.main`}>{item.count}</Typography>
            <Typography variant="body2" color="text.secondary">{item.label}</Typography>
          </Paper>
        ))}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('全部', 'All')} /><Tab label={t('待处理', 'Pending')} /><Tab label={t('已确认', 'Acknowledged')} /><Tab label={t('已解决', 'Resolved')} />
      </Tabs>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('严重程度', 'Severity')}</TableCell>
              <TableCell>{t('患者', 'Patient')}</TableCell>
              <TableCell>{t('预警类型', 'Alert Type')}</TableCell>
              <TableCell>{t('详情', 'Details')}</TableCell>
              <TableCell>{t('设备', 'Device')}</TableCell>
              <TableCell>{t('时间', 'Time')}</TableCell>
              <TableCell>{t('状态', 'Status')}</TableCell>
              <TableCell>{t('操作', 'Action')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(alert => {
              const severity = getSeverityConfig(alert.severity);
              const status = getStatusConfig(alert.status);
              return (
              <TableRow key={alert.id} sx={{ bgcolor: alert.severity === 'critical' ? 'error.50' : 'inherit' }}>
                <TableCell>
                  <Chip label={t(severity.label, severity.label_en)} size="small" color={severity.color} />
                </TableCell>
                <TableCell><Typography fontWeight={600}>{alert.patient || '—'}</Typography></TableCell>
                <TableCell>{alert.type}</TableCell>
                <TableCell><Typography variant="body2">{alert.message}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{alert.device}</Typography></TableCell>
                <TableCell><Typography variant="body2">{alert.time}</Typography></TableCell>
                <TableCell>
                  <Chip icon={status.icon} label={t(status.label, status.label_en)}
                    size="small" color={status.color} variant="outlined" />
                </TableCell>
                <TableCell>
                  {alert.status !== 'resolved' && (
                    <Button size="small" variant="outlined" onClick={() => handleResolve(alert.id)}>{t('标记解决', 'Mark Resolved')}</Button>
                  )}
                </TableCell>
              </TableRow>
            );})}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default AlertCenter;
