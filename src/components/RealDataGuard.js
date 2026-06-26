import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertTitle, Button, Box, Paper, Typography, LinearProgress } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { useHealthData } from '../contexts/HealthDataContext';

export function NoDataBanner({ message }) {
  const navigate = useNavigate();
  return (
    <Alert severity="warning" sx={{ mb: 3 }}
      action={<Button color="inherit" size="small" startIcon={<CloudUpload />} onClick={() => navigate('/import')}>去导入</Button>}>
      <AlertTitle>尚未导入真实数据</AlertTitle>
      {message || '请从 iPhone 导出 Apple Health 数据（含 Apple Watch 记录）并导入平台。'}
    </Alert>
  );
}

export function RealDataChip({ source, day }) {
  if (!source) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
      <Alert severity="success" sx={{ py: 0, flex: 1 }} icon={false}>
        真实数据 · {source}{day ? ` · ${day}` : ''}
      </Alert>
    </Box>
  );
}

/** 包裹需要健康数据的页面，无数据时显示引导而非报错 */
export function RequireHealthData({ children, title = '此功能' }) {
  const { hasData, loading } = useHealthData();
  const navigate = useNavigate();

  if (loading) return <LinearProgress sx={{ mb: 2 }} />;
  if (!hasData) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom fontWeight={600}>{title}</Typography>
        <NoDataBanner />
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>导入 Apple Watch 真实数据</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            iPhone 健康 App → 导出所有健康数据 → 上传到 MedWear
          </Typography>
          <Button variant="contained" size="large" startIcon={<CloudUpload />} onClick={() => navigate('/import')}>
            前往数据导入
          </Button>
        </Paper>
      </Box>
    );
  }
  return children;
}
