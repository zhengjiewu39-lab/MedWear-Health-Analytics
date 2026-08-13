import React, { useEffect, useState } from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { Memory, Storage, Psychology, VerifiedUser } from '@mui/icons-material';
import { systemApi } from '../services/api';
import { useLang } from '../contexts/LanguageContext';

/**
 * Compact banner showing rule-engine core, opt-in ONNX, SQLite / MAD / Zod stack.
 */
export default function SystemStackBanner({ compact = false }) {
  const { t, isEn } = useLang();
  const [stack, setStack] = useState(null);

  useEffect(() => {
    systemApi.getStack().then((res) => setStack(res.data)).catch(() => {});
  }, []);

  if (!stack) return null;

  const onnxEnabled = stack.inference?.onnxEnabled;
  const inferenceLabel = onnxEnabled
    ? `${stack.inference?.engine} · ${stack.inference?.modelId || 'ONNX'}`
    : t('规则引擎核心（ONNX 默认关闭）', 'Rule engine core (ONNX off by default)');

  if (compact) {
    return (
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            size="small"
            icon={<Psychology />}
            color={onnxEnabled ? 'secondary' : 'primary'}
            variant="outlined"
            label={inferenceLabel}
          />
          <Chip size="small" icon={<Storage />} variant="outlined" label="SQLite" />
          <Chip size="small" icon={<Memory />} variant="outlined" label={`MAD Z>${stack.analytics?.zThreshold ?? 2.5}`} />
          <Chip size="small" icon={<VerifiedUser />} variant="outlined" label="Zod" />
        </Stack>
      </Stack>
    );
  }

  const fusion = stack.fusionWeights;
  const fusionDisclaimer = isEn ? fusion?.disclaimer_en : fusion?.disclaimer_zh;

  return (
    <Alert severity="info" sx={{ mb: 2 }} icon={false}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {t('研究栈 v2', 'Research stack v2')} — {stack.stackLabel}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('推理', 'Inference')}</Typography>
          <Typography variant="body2">{inferenceLabel}</Typography>
          <Typography variant="caption" color="text.secondary">
            {onnxEnabled
              ? t('实验性 BHI 分层对比 · MEDWEAR_ENABLE_ONNX=true', 'Experimental BHI tier comparison · MEDWEAR_ENABLE_ONNX=true')
              : t('默认规则引擎 · 设置 MEDWEAR_ENABLE_ONNX=true 可开启 ONNX', 'Rule engine default · set MEDWEAR_ENABLE_ONNX=true for ONNX')}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('存储', 'Storage')}</Typography>
          <Typography variant="body2">{stack.storage?.engine} · {t('批量', 'Batch')} {stack.storage?.batchImportSize}</Typography>
          <Typography variant="caption" color="text.secondary">
            {isEn ? stack.storage?.description_en : stack.storage?.description_zh}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('筛查 API 字段', 'Screening API fields')}</Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            overallBhiTier · attentionScore · signalLevel · heuristicSupport
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('融合展示权重', 'Fusion presentation weights')}</Typography>
          <Typography variant="body2">
            wearable {fusion?.wearable} · clinical {fusion?.clinical} · behavioral {fusion?.behavioral}
          </Typography>
          {fusionDisclaimer && (
            <Typography variant="caption" color="text.secondary" display="block">{fusionDisclaimer}</Typography>
          )}
        </Box>
      </Box>
    </Alert>
  );
}
