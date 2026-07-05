import React from 'react';
import {
  Box, Typography, Paper, Grid, Chip, LinearProgress, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { Gavel, CheckCircle, Warning, Security, Lock, VerifiedUser } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';

const complianceItems = [
  { name: 'HIPAA 合规', status: 'compliant', score: 98, desc: '美国健康保险流通与责任法案' },
  { name: 'GDPR 数据保护', status: 'compliant', score: 95, desc: '欧盟通用数据保护条例' },
  { name: '等保 2.0 三级', status: 'compliant', score: 92, desc: '网络安全等级保护' },
  { name: '医疗器械数据标准', status: 'compliant', score: 96, desc: 'IEC 62304 / ISO 13485' },
  { name: '数据加密 (AES-256)', status: 'compliant', score: 100, desc: '传输与存储全程加密' },
  { name: '访问审计日志', status: 'warning', score: 88, desc: '操作日志保留与审计' },
];

const auditLogs = [
  { action: '数据访问', user: '李医生', target: '患者张明 ECG 数据', time: '2024-06-26 10:15', status: 'normal' },
  { action: '报告导出', user: '管理员', target: '月度健康评估报告', time: '2024-06-26 09:30', status: 'normal' },
  { action: '权限变更', user: '管理员', target: '新增医生账号', time: '2024-06-25 14:20', status: 'normal' },
  { action: '异常访问', user: '未知IP', target: '尝试访问患者数据库', time: '2024-06-25 03:12', status: 'blocked' },
];

function Compliance() {
  return (
    <Box>
      <PageHeader
        title="合规管理"
        subtitle="医疗数据安全与隐私合规监控，确保平台符合监管要求"
        breadcrumbs={[{ label: '管理控制台', path: '/admin' }, { label: '合规管理' }]}
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Security sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700} color="success.main">A+</Typography>
            <Typography variant="body2" color="text.secondary">综合合规评级</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Lock sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>256-bit</Typography>
            <Typography variant="body2" color="text.secondary">端到端加密</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <VerifiedUser sx={{ fontSize: 48, color: 'info.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>99.9%</Typography>
            <Typography variant="body2" color="text.secondary">数据完整性</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>合规检查项</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {complianceItems.map(item => (
          <Grid item xs={12} sm={6} md={4} key={item.name}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>{item.name}</Typography>
                {item.status === 'compliant'
                  ? <Chip icon={<CheckCircle />} label="合规" size="small" color="success" />
                  : <Chip icon={<Warning />} label="待改进" size="small" color="warning" />}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{item.desc}</Typography>
              <LinearProgress variant="determinate" value={item.score}
                color={item.score >= 95 ? 'success' : 'warning'} sx={{ height: 6, borderRadius: 3 }} />
              <Typography variant="caption" color="text.secondary">{item.score}%</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>审计日志</Typography>
        <List>
          {auditLogs.map((log, i) => (
            <ListItem key={i} sx={{ bgcolor: log.status === 'blocked' ? 'error.50' : 'inherit', borderRadius: 2, mb: 0.5 }}>
              <ListItemIcon>
                <Gavel color={log.status === 'blocked' ? 'error' : 'action'} />
              </ListItemIcon>
              <ListItemText
                primary={`${log.action} - ${log.target}`}
                secondary={`${log.user} · ${log.time}`}
              />
              <Chip label={log.status === 'blocked' ? '已拦截' : '正常'} size="small"
                color={log.status === 'blocked' ? 'error' : 'success'} variant="outlined" />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}

export default Compliance;
