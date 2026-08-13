import React from 'react';
import { Alert, Box, Chip } from '@mui/material';
import { Psychology, Gavel } from '@mui/icons-material';
import { useLang } from '../contexts/LanguageContext';

/**
 * Shared governance banner — AI proposes, humans decide.
 */
function AiGovernanceBanner({ compact = false }) {
  const { t } = useLang();

  if (compact) {
    return (
      <Chip
        icon={<Gavel sx={{ fontSize: 16 }} />}
        label={t('AI 建议 · 医师/管理者裁定', 'AI suggests · clinician/admin decides')}
        size="small"
        color="warning"
        variant="outlined"
        sx={{ mb: 2, fontWeight: 600 }}
      />
    );
  }

  return (
    <Alert
      severity="warning"
      icon={<Psychology />}
      sx={{ mb: 2, border: '1px solid', borderColor: 'warning.light' }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <strong>{t('AI 辅助干预模式', 'AI-assisted intervention mode')}</strong>
        <Chip size="small" icon={<Gavel sx={{ fontSize: 14 }} />} label={t('医师最终裁定', 'Physician final authority')} />
        <Chip size="small" label={t('管理者审核', 'Administrator review')} variant="outlined" />
      </Box>
      <Box component="span" sx={{ display: 'block', mt: 0.5, fontSize: '0.85rem' }}>
        {t('AI 融合异常检测、预测性提示与筛查导向决策支持信号，自动生成干预建议；所有建议须经医师或管理者批准后方可进入医生报告与体检预约流程。非诊断性输出，需专业人员审核。',
          'AI fuses anomaly detection, predictive signals and screening-oriented decision support to auto-generate intervention suggestions; all suggestions require physician or administrator approval before entering the doctor report and exam booking workflow. Non-diagnostic — requires professional review.')}
      </Box>
    </Alert>
  );
}

export default AiGovernanceBanner;
