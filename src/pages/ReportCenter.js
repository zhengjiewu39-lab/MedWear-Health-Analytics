import React from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, Chip, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Assessment, Download, PictureAsPdf, TableChart, TrendingUp,
  Person, CalendarToday, AutoAwesome,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader';

const reportTemplates = [
  { title: '日健康报告', desc: '24小时生命体征汇总与异常事件', icon: <CalendarToday />, type: 'daily' },
  { title: '周趋势分析', desc: '7天健康指标变化趋势与AI解读', icon: <TrendingUp />, type: 'weekly' },
  { title: '月度健康评估', desc: '综合健康评分、风险变化与建议', icon: <Assessment />, type: 'monthly' },
  { title: 'AI 智能报告', desc: '大模型自动生成个性化健康报告', icon: <AutoAwesome />, type: 'ai', highlight: true },
  { title: '患者档案导出', desc: '完整患者健康数据与设备记录', icon: <Person />, type: 'patient' },
  { title: '临床数据报表', desc: '符合 HL7/FHIR 标准的临床格式', icon: <TableChart />, type: 'clinical' },
];

function ReportCenter() {
  return (
    <Box>
      <PageHeader
        title="报告中心"
        subtitle="一键生成健康分析报告，支持 PDF 导出与临床系统对接"
        breadcrumbs={[{ label: '管理控制台', path: '/admin' }, { label: '报告中心' }]}
      />

      <Grid container spacing={3}>
        {reportTemplates.map(report => (
          <Grid item xs={12} sm={6} md={4} key={report.type}>
            <Card sx={{
              height: '100%',
              border: report.highlight ? 2 : 0,
              borderColor: 'primary.main',
              background: report.highlight ? 'linear-gradient(135deg, #e3f2fd 0%, #fff 100%)' : 'inherit',
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Box sx={{ color: report.highlight ? 'primary.main' : 'text.secondary' }}>{report.icon}</Box>
                  <Typography variant="h6">{report.title}</Typography>
                  {report.highlight && <Chip label="AI" size="small" color="primary" />}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, minHeight: 40 }}>
                  {report.desc}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" size="small" startIcon={<Assessment />}>生成</Button>
                  <Button variant="outlined" size="small" startIcon={<PictureAsPdf />}>PDF</Button>
                  <Button variant="outlined" size="small" startIcon={<Download />}>导出</Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>最近生成的报告</Typography>
        <List>
          {[
            { name: '张明 - 6月26日健康日报', time: '2024-06-26 08:00', type: 'daily' },
            { name: '王强 - AI 心血管风险评估报告', time: '2024-06-25 16:30', type: 'ai' },
            { name: '全体患者 - 6月第三周趋势分析', time: '2024-06-24 09:00', type: 'weekly' },
          ].map((r, i) => (
            <ListItem key={i} secondaryAction={
              <Button size="small" startIcon={<Download />}>下载</Button>
            }>
              <ListItemIcon><PictureAsPdf color="error" /></ListItemIcon>
              <ListItemText primary={r.name} secondary={r.time} />
              <Chip label={r.type === 'ai' ? 'AI 报告' : '标准报告'} size="small" color={r.type === 'ai' ? 'primary' : 'default'} sx={{ mr: 2 }} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}

export default ReportCenter;
