import React, { useEffect, useState } from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { Memory, Storage, Psychology, VerifiedUser } from '@mui/icons-material';
import { systemApi } from '../services/api';
import { useLang } from '../contexts/LanguageContext';

/**
 * Compact banner showing ONNX / SQLite / MAD / Zod research stack (from GET /api/system/stack).
 */
export default function SystemStackBanner({ compact = false }) {
  const { t } = useLang();
  const [stack, setStack] = useState(null);

  useEffect(() => {
    systemApi.getStack().then((res) => setStack(res.data)).catch(() => {});
  }, []);

  if (!stack) return null;

  const modelLabel = stack.inference?.modelId
    ? `${stack.inference.modelId}${stack.inference.modelType ? ` (${stack.inference.modelType})` : ''}`
    : t('未加载 ONNX 模型', 'ONNX model not loaded');

  if (compact) {
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip size="small" icon={<Psychology />} color="primary" variant="outlined" label={`ONNX · ${modelLabel}`} />
        <Chip size="small" icon={<Storage />} variant="outlined" label="SQLite" />
        <Chip size="small" icon={<Memory />} variant="outlined" label={`MAD Z>${stack.analytics?.zThreshold ?? 2.5}`} />
        <Chip size="small" icon={<VerifiedUser />} variant="outlined" label="Zod" />
      </Stack>
    );
  }

  return (
    <Alert severity="info" sx={{ mb: 2 }} icon={false}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {t('研究栈 v2', 'Research stack v2')} — {stack.stackLabel}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('推理', 'Inference')}</Typography>
          <Typography variant="body2">{stack.inference?.engine} · {modelLabel}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('17 维特征', '17-dim features')} · {t('训练', 'Train')}: npm run experiment:train
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('存储', 'Storage')}</Typography>
          <Typography variant="body2">{stack.storage?.engine} · {t('批量', 'Batch')} {stack.storage?.batchImportSize}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{stack.storage?.database}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('异常检测', 'Anomaly detection')}</Typography>
          <Typography variant="body2">
            {t('稳健 MAD Z-score', 'Robust MAD Z-score')} · |Z| &gt; {stack.analytics?.zThreshold}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('数据校验', 'Validation')}</Typography>
          <Typography variant="body2">
            Zod · SpO₂ &lt; {stack.validation?.limits?.spo2MinPercent}% / HR &gt; {stack.validation?.limits?.hrMaxBpm} {t('清洗', 'cleaning')}
          </Typography>
        </Box>
      </Box>
    </Alert>
  );
}
