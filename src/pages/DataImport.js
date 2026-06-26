import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Alert, LinearProgress, Stepper, Step, StepLabel,
  Chip, List, ListItem, ListItemIcon, ListItemText, Divider,
} from '@mui/material';
import {
  CloudUpload, FolderOpen, Watch, PhoneIphone, CheckCircle, Delete,
  Info, Apple, Refresh,
} from '@mui/icons-material';
import { dataApi } from '../services/api';
import { useHealthData } from '../contexts/HealthDataContext';
import { useDataMode } from '../contexts/DataModeContext';

const steps = ['iPhone 导出健康数据', '传输到 Mac', '导入 MedWear 分析'];

function DataImport() {
  const { refresh } = useHealthData();
  const { isReal } = useDataMode();
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refreshStatus = useCallback(() => {
    dataApi.getStatus().then(res => setStatus(res.data)).catch(() => {});
    refresh();
  }, [refresh]);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const pollProgress = () => {
    const timer = setInterval(async () => {
      const res = await dataApi.getImportProgress();
      setProgress(res.data);
      if (res.data.status === 'done' || res.data.status === 'error') {
        clearInterval(timer);
        setUploading(false);
        if (res.data.status === 'done') {
          setSuccess('数据导入成功！所有页面现已使用您的真实健康数据。');
          refreshStatus();
        } else {
          setError(res.data.message);
        }
      }
    }, 500);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess('');
    setUploading(true);
    setProgress({ status: 'processing', message: '上传中…', percent: 5 });
    try {
      await dataApi.importFile(file);
      pollProgress();
    } catch (err) {
      setUploading(false);
      setError(err.response?.data?.message || '导入失败');
    }
    e.target.value = '';
  };

  const handleScan = async () => {
    setError('');
    setSuccess('');
    setUploading(true);
    try {
      const res = await dataApi.scanFolder();
      setSuccess(`已从 health-import 文件夹导入: ${res.data.file}`);
      refreshStatus();
    } catch (err) {
      setError(err.response?.data?.message || '扫描导入失败');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('确定清除所有已导入的健康数据？')) return;
    await dataApi.clearData();
    setStatus({ hasData: false });
    setSuccess('');
  };

  return (
    <Box>
      <Alert severity="success" sx={{ mb: 2 }} variant="outlined">
        真实模式专用 · 导入的数据仅保存在本机，与演示模式完全隔离
      </Alert>
      {!isReal && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          当前为演示模式。请切换顶栏为「真实模式」后再导入 Apple Health 数据。
        </Alert>
      )}
      <Typography variant="h5" gutterBottom fontWeight={600}>Apple 健康数据导入</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        从 Apple Watch / iPhone 导入真实健康数据，所有分析基于您的实际记录（数据仅保存在本机，不上传云端）
      </Typography>

      {status?.hasData && (
        <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircle />}
          action={<Button color="inherit" size="small" onClick={handleClear} startIcon={<Delete />}>清除</Button>}>
          <strong>已导入真实数据</strong> — {status.meta?.parsedRecords?.toLocaleString()} 条记录
          · {status.meta?.dateRange?.start} ~ {status.meta?.dateRange?.end}
          · 主数据源: {status.primarySource}
        </Alert>
      )}

      {!status?.hasData && (
        <Alert severity="info" sx={{ mb: 3 }} icon={<Info />}>
          平台当前无数据。Apple Watch 数据存储在 iPhone 健康 App 中，需先导出再导入本平台分析。
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {uploading && progress && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="body2" gutterBottom>{progress.message}</Typography>
          <LinearProgress variant={progress.percent ? 'determinate' : 'indeterminate'} value={progress.percent} />
        </Paper>
      )}

      <Grid2Layout>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>导入步骤</Typography>
          <Stepper activeStep={status?.hasData ? 3 : -1} orientation="vertical" sx={{ mb: 2 }}>
            {steps.map(label => (
              <Step key={label} completed={status?.hasData}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>
          <List dense>
            <ListItem><ListItemIcon><Watch /></ListItemIcon><ListItemText primary="1. Apple Watch 自动同步到 iPhone 健康 App" /></ListItem>
            <ListItem><ListItemIcon><PhoneIphone /></ListItemIcon><ListItemText primary="2. iPhone：健康 App → 右上角头像 → 导出所有健康数据" secondary="生成 apple_health_export.zip（约 30秒~几分钟）" /></ListItem>
            <ListItem><ListItemIcon><Apple /></ListItemIcon><ListItemText primary="3. AirDrop 或隔空投送到 MacBook" secondary="也可通过「文件」App 保存到 iCloud Drive" /></ListItem>
            <ListItem><ListItemIcon><CloudUpload /></ListItemIcon><ListItemText primary="4. 在下方上传 zip 文件，或放入 health-import 文件夹" /></ListItem>
          </List>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>上传数据</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Button variant="contained" component="label" size="large" startIcon={<CloudUpload />} disabled={uploading}>
              选择 apple_health_export.zip
              <input type="file" hidden accept=".zip,.xml" onChange={handleUpload} />
            </Button>
            <Button variant="outlined" startIcon={<FolderOpen />} onClick={handleScan} disabled={uploading}>
              扫描 health-import 文件夹
            </Button>
            <Button variant="text" startIcon={<Refresh />} onClick={refreshStatus}>刷新状态</Button>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            支持的数据类型（来自 Apple Watch）：
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {['心率', '血氧', '步数', '睡眠', 'HRV', '活动能量', '距离', '呼吸率'].map(t => (
              <Chip key={t} label={t} size="small" variant="outlined" />
            ))}
          </Box>
          <Alert severity="warning" sx={{ mt: 2 }} icon={<Info />}>
            Apple 不允许第三方 App 直接读取 Apple Watch 实时数据。导出导入是目前 Mac 上最可靠的官方方式，建议每周更新一次导出。
          </Alert>
        </Paper>
      </Grid2Layout>
    </Box>
  );
}

function Grid2Layout({ children }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
      {children}
    </Box>
  );
}

export default DataImport;
