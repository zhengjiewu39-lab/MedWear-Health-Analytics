import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, LinearProgress, Divider, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { CheckCircle, Print, AutoAwesome, TrendingUp } from '@mui/icons-material';
import { aiApi } from '../services/api';

const gradeColor = { 'A': 'success', 'A-': 'success', 'B+': 'info', 'B': 'warning', 'C': 'error' };

function AIHealthReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi.getReport().then(res => { setReport(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;
  if (!report) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>AI 健康报告</Typography>
          <Typography variant="body2" color="text.secondary">
            MedWear-AI 自动生成 · 基于正常成人参考标准 · {new Date(report.generatedAt).toLocaleString('zh-CN')}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Print />}>导出 PDF</Button>
      </Box>

      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #1565C0 0%, #00838F 100%)', color: '#fff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AutoAwesome sx={{ fontSize: 48 }} />
          <Box>
            <Typography variant="h6" fontWeight={600}>综合评估结论</Typography>
            <Typography variant="body1" sx={{ mt: 0.5, opacity: 0.95 }}>{report.summary}</Typography>
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {report.sections.map((section, i) => (
          <Grid item xs={12} md={6} key={i}>
            <Paper sx={{ p: 3, height: '100%', borderTop: 3, borderColor: `${gradeColor[section.grade] || 'info'}.main` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>{section.title}</Typography>
                <Chip label={section.grade} color={gradeColor[section.grade] || 'info'} size="small" />
              </Box>
              <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>{section.content}</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Object.entries(section.metrics).map(([k, v]) => (
                  <Chip key={k} label={`${k}: ${v}`} size="small" variant="outlined" />
                ))}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TrendingUp color="primary" />
          <Typography variant="h6" fontWeight={600}>AI 个性化建议</Typography>
        </Box>
        <List>
          {report.recommendations.map((rec, i) => (
            <ListItem key={i}>
              <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
              <ListItemText primary={rec} />
            </ListItem>
          ))}
        </List>
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            免责声明：本报告由 AI 基于可穿戴设备数据生成，仅供参考，不能替代专业医疗诊断。如有健康问题请咨询医生。
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default AIHealthReport;
