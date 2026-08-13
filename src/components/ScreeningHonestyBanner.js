import React from 'react';
import { Alert, Box, Chip, Typography } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';
import { useLang } from '../contexts/LanguageContext';
import { bhiTierLabel } from '../utils/bhiWatchTier';

/** Explains honest screening field names — attention signals, not disease risk. */
export default function ScreeningHonestyBanner({ data, compact = false }) {
  const { t, isEn } = useLang();
  if (!data) return null;

  const tier = data.overallBhiTier ?? data.overallRisk;
  const tierLabel = bhiTierLabel(tier, isEn);

  if (compact) {
    return (
      <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 2 }}>
        {t(
          `BHI 分层：${tierLabel || '—'} · 分项为「需进一步评估的信号」（attentionScore），非疾病风险预测`,
          `BHI tier: ${tierLabel || '—'} · Items are attention signals (attentionScore) for further evaluation — not disease risk predictions`,
        )}
      </Alert>
    );
  }

  return (
    <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {t('诚实字段说明', 'Honest field naming')}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
        <Chip size="small" label={`overallBhiTier: ${tierLabel || tier || '—'}`} />
        <Chip size="small" variant="outlined" label="attentionScore" />
        <Chip size="small" variant="outlined" label="evidenceAdjustedAttentionScore" />
        <Chip size="small" variant="outlined" label="signalLevel" />
        <Chip size="small" variant="outlined" label="heuristicSupport" />
      </Box>
      <Typography variant="body2">
        {t(
          '分项分数为规则引擎生成的关注信号强度，经证据分级微调；heuristicSupport 为展示支持度，非统计置信度。旧字段 overallRisk/overallRiskTier 为分层字符串，overallRiskScore 为数值别名（请用 overallScore）。',
          'Item scores are rule-engine attention signal strengths with evidence-tier adjustment; heuristicSupport is a display weight — not statistical confidence. Legacy overallRisk/overallRiskTier are tier strings; overallRiskScore is a numeric alias (prefer overallScore).',
        )}
      </Typography>
    </Alert>
  );
}
