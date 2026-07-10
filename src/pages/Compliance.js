import React from 'react';
import {
  Box, Typography, Paper, Grid, Chip, LinearProgress, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { Gavel, CheckCircle, Warning, Security, Lock, VerifiedUser } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import { useLang } from '../contexts/LanguageContext';

const complianceItems = [
  { name: 'HIPAA 合规', name_en: 'HIPAA Compliance', status: 'compliant', score: 98, desc: '美国健康保险流通与责任法案', desc_en: 'U.S. Health Insurance Portability and Accountability Act' },
  { name: 'GDPR 数据保护', name_en: 'GDPR Data Protection', status: 'compliant', score: 95, desc: '欧盟通用数据保护条例', desc_en: 'EU General Data Protection Regulation' },
  { name: '等保 2.0 三级', name_en: 'MLPS 2.0 Level 3', status: 'compliant', score: 92, desc: '网络安全等级保护', desc_en: 'Cybersecurity Multi-Level Protection Scheme' },
  { name: '医疗器械数据标准', name_en: 'Medical Device Data Standards', status: 'compliant', score: 96, desc: 'IEC 62304 / ISO 13485', desc_en: 'IEC 62304 / ISO 13485' },
  { name: '数据加密 (AES-256)', name_en: 'Data Encryption (AES-256)', status: 'compliant', score: 100, desc: '传输与存储全程加密', desc_en: 'End-to-end encryption in transit and at rest' },
  { name: '访问审计日志', name_en: 'Access Audit Logs', status: 'warning', score: 88, desc: '操作日志保留与审计', desc_en: 'Operation log retention and auditing' },
];

const auditLogs = [
  { action: '数据访问', action_en: 'Data Access', user: '李医生', user_en: 'Dr. Li', target: '患者张明 ECG 数据', target_en: "Patient Zhang Ming's ECG data", time: '2024-06-26 10:15', status: 'normal' },
  { action: '报告导出', action_en: 'Report Export', user: '管理员', user_en: 'Administrator', target: '月度健康评估报告', target_en: 'Monthly Health Assessment Report', time: '2024-06-26 09:30', status: 'normal' },
  { action: '权限变更', action_en: 'Permission Change', user: '管理员', user_en: 'Administrator', target: '新增医生账号', target_en: 'Added new physician account', time: '2024-06-25 14:20', status: 'normal' },
  { action: '异常访问', action_en: 'Abnormal Access', user: '未知IP', user_en: 'Unknown IP', target: '尝试访问患者数据库', target_en: 'Attempted access to patient database', time: '2024-06-25 03:12', status: 'blocked' },
];

function Compliance() {
  const { t } = useLang();
  return (
    <Box>
      <PageHeader
        title={t('合规管理', 'Compliance Management')}
        subtitle={t('医疗数据安全与隐私合规监控，确保平台符合监管要求', 'Monitor medical data security and privacy compliance to keep the platform aligned with regulatory requirements')}
        breadcrumbs={[{ label: t('管理控制台', 'Admin Console'), path: '/admin' }, { label: t('合规管理', 'Compliance Management') }]}
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Security sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700} color="success.main">A+</Typography>
            <Typography variant="body2" color="text.secondary">{t('综合合规评级', 'Overall Compliance Rating')}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Lock sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>256-bit</Typography>
            <Typography variant="body2" color="text.secondary">{t('端到端加密', 'End-to-End Encryption')}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <VerifiedUser sx={{ fontSize: 48, color: 'info.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>99.9%</Typography>
            <Typography variant="body2" color="text.secondary">{t('数据完整性', 'Data Integrity')}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>{t('合规检查项', 'Compliance Checklist')}</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {complianceItems.map(item => (
          <Grid item xs={12} sm={6} md={4} key={item.name}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>{t(item.name, item.name_en)}</Typography>
                {item.status === 'compliant'
                  ? <Chip icon={<CheckCircle />} label={t('合规', 'Compliant')} size="small" color="success" />
                  : <Chip icon={<Warning />} label={t('待改进', 'Needs Improvement')} size="small" color="warning" />}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t(item.desc, item.desc_en)}</Typography>
              <LinearProgress variant="determinate" value={item.score}
                color={item.score >= 95 ? 'success' : 'warning'} sx={{ height: 6, borderRadius: 3 }} />
              <Typography variant="caption" color="text.secondary">{item.score}%</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>{t('审计日志', 'Audit Logs')}</Typography>
        <List>
          {auditLogs.map((log, i) => (
            <ListItem key={i} sx={{ bgcolor: log.status === 'blocked' ? 'error.50' : 'inherit', borderRadius: 2, mb: 0.5 }}>
              <ListItemIcon>
                <Gavel color={log.status === 'blocked' ? 'error' : 'action'} />
              </ListItemIcon>
              <ListItemText
                primary={`${t(log.action, log.action_en)} - ${t(log.target, log.target_en)}`}
                secondary={`${t(log.user, log.user_en)} · ${log.time}`}
              />
              <Chip label={log.status === 'blocked' ? t('已拦截', 'Blocked') : t('正常', 'Normal')} size="small"
                color={log.status === 'blocked' ? 'error' : 'success'} variant="outlined" />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}

export default Compliance;
