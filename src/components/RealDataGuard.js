import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertTitle, Button, Box, Paper, Typography, LinearProgress } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { useHealthData } from '../contexts/HealthDataContext';
import { useLang } from '../contexts/LanguageContext';
import { enLabel } from '../i18n/labels';

export function NoDataBanner({ message }) {
  const navigate = useNavigate();
  const { t } = useLang();
  return (
    <Alert severity="warning" sx={{ mb: 3 }}
      action={
        <Button color="inherit" size="small" startIcon={<CloudUpload />} onClick={() => navigate('/import')}>
          {t('去导入', 'Import data')}
        </Button>
      }>
      <AlertTitle>{t('尚未导入真实数据', 'No real data imported yet')}</AlertTitle>
      {message || t(
        '请从 iPhone 导出 Apple Health 数据（含 Apple Watch 记录）并导入平台。',
        'Export Apple Health data from iPhone (including Apple Watch records) and import it into the platform.',
      )}
    </Alert>
  );
}

export function RealDataChip({ source, day }) {
  const { t } = useLang();
  if (!source) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
      <Alert severity="success" sx={{ py: 0, flex: 1 }} icon={false}>
        {t('真实数据', 'Real data')} · {source}{day ? ` · ${day}` : ''}
      </Alert>
    </Box>
  );
}

/** 包裹需要健康数据的页面，无数据时显示引导而非报错 */
export function RequireHealthData({ children, title = '此功能' }) {
  const { hasData, loading } = useHealthData();
  const navigate = useNavigate();
  const { t } = useLang();
  const pageTitle = t(title, enLabel(title) || title);

  if (loading) return <LinearProgress sx={{ mb: 2 }} />;
  if (!hasData) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom fontWeight={600}>{pageTitle}</Typography>
        <NoDataBanner />
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {t('导入 Apple Watch 真实数据', 'Import Apple Watch data')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t(
              'iPhone 健康 App → 导出所有健康数据 → 上传到 MedWear',
              'iPhone Health app → Export All Health Data → Upload to MedWear',
            )}
          </Typography>
          <Button variant="contained" size="large" startIcon={<CloudUpload />} onClick={() => navigate('/import')}>
            {t('前往数据导入', 'Go to data import')}
          </Button>
        </Paper>
      </Box>
    );
  }
  return children;
}
