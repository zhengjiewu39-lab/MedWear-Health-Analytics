import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, LinearProgress,
} from '@mui/material';
import { Devices, Watch, PhoneIphone, Scale } from '@mui/icons-material';
import { deviceApi } from '../services/api';
import { useLang } from '../contexts/LanguageContext';

const typeIcon = { '智能手表': <Watch />, '手机': <PhoneIphone />, '智能体脂秤': <Scale /> };

function DeviceManagement() {
  const { t } = useLang();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deviceApi.getAll().then(res => { setDevices(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('我的设备', 'My Devices')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t(`已连接 ${devices.length} 台设备 · 全部在线`, `${devices.length} devices connected · All online`)}</Typography>

      <Grid container spacing={3}>
        {devices.map(d => (
          <Grid item xs={12} md={4} key={d.id}>
            <Card sx={{ borderTop: 3, borderColor: 'success.main' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.main' }}>
                    {typeIcon[d.type] || <Devices />}
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>{d.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{d.type}</Typography>
                  </Box>
                  <Chip label={t('在线', 'Online')} size="small" color="success" sx={{ ml: 'auto' }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">{t('电量', 'Battery')}</Typography>
                  <Typography variant="body2" fontWeight={600}>{d.battery != null ? `${d.battery}%` : 'N/A'}</Typography>
                </Box>
                {d.battery != null && <LinearProgress variant="determinate" value={d.battery} color={d.battery < 20 ? 'error' : 'success'} sx={{ mb: 1.5, height: 6, borderRadius: 3 }} />}
                <Typography variant="caption" color="text.secondary">{t('同步', 'Synced')}: {d.lastSync}</Typography>
                <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {d.metrics.map(m => <Chip key={m} label={m} size="small" variant="outlined" />)}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default DeviceManagement;
