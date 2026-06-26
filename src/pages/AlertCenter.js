import React, { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Tabs, Tab, Button, LinearProgress,
} from '@mui/material';
import { CheckCircle, Pending, DoneAll } from '@mui/icons-material';
import { alertApi } from '../services/api';
import useModeRefresh from '../hooks/useModeRefresh';

const severityConfig = {
  critical: { label: '紧急', color: 'error' },
  high: { label: '高', color: 'warning' },
  medium: { label: '中', color: 'info' },
  low: { label: '低', color: 'default' },
  info: { label: '提示', color: 'success' },
};

function getSeverityConfig(severity) {
  return severityConfig[severity] || { label: severity || '—', color: 'default' };
}

function getStatusConfig(status) {
  return statusConfig[status] || { label: status || '—', color: 'default', icon: <Pending fontSize="small" /> };
}

const statusConfig = {
  pending: { label: '待处理', color: 'error', icon: <Pending fontSize="small" /> },
  acknowledged: { label: '已确认', color: 'warning', icon: <CheckCircle fontSize="small" /> },
  resolved: { label: '已解决', color: 'success', icon: <DoneAll fontSize="small" /> },
};

function AlertCenter() {
  const [alerts, setAlerts] = useState([]);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);

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
      <Typography variant="h5" gutterBottom fontWeight={600}>预警中心</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        AI 驱动的智能预警系统，实时检测生命体征异常并推送告警
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {[
          { label: '全部', count: alerts.length, color: 'primary' },
          { label: '待处理', count: alerts.filter(a => a.status === 'pending').length, color: 'error' },
          { label: '已确认', count: alerts.filter(a => a.status === 'acknowledged').length, color: 'warning' },
          { label: '已解决', count: alerts.filter(a => a.status === 'resolved').length, color: 'success' },
        ].map(item => (
          <Paper key={item.label} sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} color={`${item.color}.main`}>{item.count}</Typography>
            <Typography variant="body2" color="text.secondary">{item.label}</Typography>
          </Paper>
        ))}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="全部" /><Tab label="待处理" /><Tab label="已确认" /><Tab label="已解决" />
      </Tabs>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>严重程度</TableCell>
              <TableCell>患者</TableCell>
              <TableCell>预警类型</TableCell>
              <TableCell>详情</TableCell>
              <TableCell>设备</TableCell>
              <TableCell>时间</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(alert => {
              const severity = getSeverityConfig(alert.severity);
              const status = getStatusConfig(alert.status);
              return (
              <TableRow key={alert.id} sx={{ bgcolor: alert.severity === 'critical' ? 'error.50' : 'inherit' }}>
                <TableCell>
                  <Chip label={severity.label} size="small" color={severity.color} />
                </TableCell>
                <TableCell><Typography fontWeight={600}>{alert.patient || '—'}</Typography></TableCell>
                <TableCell>{alert.type}</TableCell>
                <TableCell><Typography variant="body2">{alert.message}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{alert.device}</Typography></TableCell>
                <TableCell><Typography variant="body2">{alert.time}</Typography></TableCell>
                <TableCell>
                  <Chip icon={status.icon} label={status.label}
                    size="small" color={status.color} variant="outlined" />
                </TableCell>
                <TableCell>
                  {alert.status !== 'resolved' && (
                    <Button size="small" variant="outlined" onClick={() => handleResolve(alert.id)}>标记解决</Button>
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
