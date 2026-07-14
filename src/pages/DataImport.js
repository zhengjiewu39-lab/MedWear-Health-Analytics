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
import { useLang } from '../contexts/LanguageContext';

const steps = [
  { zh: 'iPhone 导出健康数据', en: 'Export health data from iPhone' },
  { zh: '传输到 Mac', en: 'Transfer to Mac' },
  { zh: '导入 MedWear 分析', en: 'Import into MedWear for analysis' },
];

function DataImport() {
  const { t } = useLang();
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
          setSuccess(t('数据导入成功！所有页面现已使用您的真实健康数据。', 'Data imported successfully! All pages now use your real health data.'));
          window.dispatchEvent(new CustomEvent('medwear-health-import'));
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
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > 512) {
      setError(t(
        `文件约 ${sizeMb.toFixed(0)} MB，超过默认上限。请将 zip 放入项目 health-import 文件夹后点击「扫描导入」，或在 .env 增大 HEALTH_IMPORT_MAX_MB`,
        `File is ~${sizeMb.toFixed(0)} MB. Place the zip in health-import/ and use Scan, or raise HEALTH_IMPORT_MAX_MB in .env`,
      ));
      e.target.value = '';
      return;
    }
    setError('');
    setSuccess('');
    setUploading(true);
    setProgress({ status: 'processing', message: t(`上传中… (${sizeMb.toFixed(1)} MB)`, `Uploading… (${sizeMb.toFixed(1)} MB)`), percent: 5 });
    try {
      await dataApi.importFile(file);
      pollProgress();
    } catch (err) {
      setUploading(false);
      const msg = err.response?.data?.message || err.message;
      setError(msg || t('导入失败', 'Import failed'));
    }
    e.target.value = '';
  };

  const handleScan = async () => {
    setError('');
    setSuccess('');
    setUploading(true);
    try {
      const res = await dataApi.scanFolder();
      setSuccess(t(`已从 health-import 文件夹导入: ${res.data.file}`, `Imported from health-import folder: ${res.data.file}`));
      window.dispatchEvent(new CustomEvent('medwear-health-import'));
      refreshStatus();
    } catch (err) {
      setError(err.response?.data?.message || t('扫描导入失败', 'Folder scan import failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm(t('确定清除所有已导入的健康数据？', 'Clear all imported health data?'))) return;
    await dataApi.clearData();
    setStatus({ hasData: false });
    setSuccess('');
  };

  return (
    <Box>
      <Alert severity="success" sx={{ mb: 2 }} variant="outlined">
        {t('真实模式专用 · 导入的数据仅保存在本机，与演示模式完全隔离', 'Real mode only · Imported data is stored locally and fully isolated from demo mode')}
      </Alert>
      {!isReal && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('当前为演示模式。请切换顶栏为「真实模式」后再导入 Apple Health 数据。', 'You are in demo mode. Switch the top bar to “Real mode” before importing Apple Health data.')}
        </Alert>
      )}
      <Typography variant="h5" gutterBottom fontWeight={600}>{t('Apple 健康数据导入', 'Apple Health Data Import')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('从 Apple Watch / iPhone 导入真实健康数据，所有分析基于您的实际记录（数据仅保存在本机，不上传云端）', 'Import real health data from Apple Watch / iPhone. All analyses are based on your actual records (data stays on this device and is never uploaded to the cloud).')}
      </Typography>

      {status?.hasData && (
        <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircle />}
          action={<Button color="inherit" size="small" onClick={handleClear} startIcon={<Delete />}>{t('清除', 'Clear')}</Button>}>
          <strong>{t('已导入真实数据', 'Real data imported')}</strong> — {status.meta?.parsedRecords?.toLocaleString()} {t('条记录', 'records')}
          · {status.meta?.dateRange?.start} ~ {status.meta?.dateRange?.end}
          · {t('主数据源', 'Primary source')}: {status.primarySource}
        </Alert>
      )}

      {!status?.hasData && (
        <Alert severity="info" sx={{ mb: 3 }} icon={<Info />}>
          {t('平台当前无数据。Apple Watch 数据存储在 iPhone 健康 App 中，需先导出再导入本平台分析。', 'The platform has no data yet. Apple Watch data is stored in the iPhone Health app; export it first, then import it here for analysis.')}
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
          <Typography variant="h6" gutterBottom>{t('导入步骤', 'Import Steps')}</Typography>
          <Stepper activeStep={status?.hasData ? 3 : -1} orientation="vertical" sx={{ mb: 2 }}>
            {steps.map(step => (
              <Step key={step.zh} completed={status?.hasData}><StepLabel>{t(step.zh, step.en)}</StepLabel></Step>
            ))}
          </Stepper>
          <List dense>
            <ListItem><ListItemIcon><Watch /></ListItemIcon><ListItemText primary={t('1. Apple Watch 自动同步到 iPhone 健康 App', '1. Apple Watch syncs automatically to the iPhone Health app')} /></ListItem>
            <ListItem><ListItemIcon><PhoneIphone /></ListItemIcon><ListItemText primary={t('2. iPhone：健康 App → 右上角头像 → 导出所有健康数据', '2. iPhone: Health app → profile icon (top right) → Export All Health Data')} secondary={t('生成 apple_health_export.zip（约 30秒~几分钟）', 'Generates apple_health_export.zip (about 30 seconds to a few minutes)')} /></ListItem>
            <ListItem><ListItemIcon><Apple /></ListItemIcon><ListItemText primary={t('3. AirDrop 或隔空投送到 MacBook', '3. AirDrop it to your MacBook')} secondary={t('也可通过「文件」App 保存到 iCloud Drive', 'You can also save it to iCloud Drive via the Files app')} /></ListItem>
            <ListItem><ListItemIcon><CloudUpload /></ListItemIcon><ListItemText primary={t('4. 在下方上传 zip 文件，或放入 health-import 文件夹', '4. Upload the zip file below, or place it in the health-import folder')} /></ListItem>
          </List>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>{t('上传数据', 'Upload Data')}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Button variant="contained" component="label" size="large" startIcon={<CloudUpload />} disabled={uploading}>
              {t('选择 apple_health_export.zip', 'Select apple_health_export.zip')}
              <input type="file" hidden accept=".zip,.xml" onChange={handleUpload} />
            </Button>
            <Button variant="outlined" startIcon={<FolderOpen />} onClick={handleScan} disabled={uploading}>
              {t('扫描 health-import 文件夹', 'Scan health-import folder')}
            </Button>
            <Button variant="text" startIcon={<Refresh />} onClick={refreshStatus}>{t('刷新状态', 'Refresh status')}</Button>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            {t('支持的数据类型（来自 Apple Watch）：', 'Supported data types (from Apple Watch):')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {[
              ['心率', 'Heart Rate'], ['血氧', 'Blood Oxygen'], ['步数', 'Steps'], ['睡眠', 'Sleep'],
              ['HRV', 'HRV'], ['活动能量', 'Active Energy'], ['距离', 'Distance'], ['呼吸率', 'Respiratory Rate'],
            ].map(([zh, en]) => (
              <Chip key={zh} label={t(zh, en)} size="small" variant="outlined" />
            ))}
          </Box>
          <Alert severity="warning" sx={{ mt: 2 }} icon={<Info />}>
            {t('Apple 不允许第三方 App 直接读取 Apple Watch 实时数据。导出导入是目前 Mac 上最可靠的官方方式，建议每周更新一次导出。', 'Apple does not allow third-party apps to read Apple Watch data in real time. Export-then-import is currently the most reliable official method on Mac; updating the export weekly is recommended.')}
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
