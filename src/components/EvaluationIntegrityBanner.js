import React from 'react';
import { Alert, Box, Chip, Typography } from '@mui/material';
import { VerifiedUser, Warning } from '@mui/icons-material';
import { useLang } from '../contexts/LanguageContext';

function pct(x) {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`;
}

/**
 * Explains independent gold-standard evaluation (anti circular self-test).
 */
export default function EvaluationIntegrityBanner({
  framework,
  wearableResults,
  compact = false,
}) {
  const { t, isEn } = useLang();
  const w = framework?.wearable;
  const m = wearableResults?.metrics;
  const invalid = wearableResults?.integrity === 'invalid-circular'
    || Boolean(wearableResults?.circularLabelWarning);

  const desc = isEn ? w?.description_en : w?.description_zh;
  const invalidMsg = isEn ? w?.invalidIf_en : w?.invalidIf_zh;

  if (!w && !wearableResults) return null;

  return (
    <Alert
      severity={invalid ? 'warning' : 'info'}
      icon={invalid ? <Warning /> : <VerifiedUser />}
      sx={{ mb: 2 }}
    >
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {t('独立临床评测架构（非自评）', 'Independent clinical evaluation (not self-test)')}
      </Typography>
      {!compact && desc && (
        <Typography variant="body2" sx={{ mb: 1 }}>{desc}</Typography>
      )}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: m ? 1 : 0 }}>
        <Chip size="small" label={`${t('产品引擎', 'Product')}: ${w?.productEngine || 'AnalyticsCore-v1'}`} />
        <Chip size="small" color="secondary" label={`${t('金标准', 'Gold')}: ${w?.goldStandard || 'clinicalGoldStandard-v1'}`} />
        {w?.rng && <Chip size="small" variant="outlined" label={`RNG ${w.rng} seed=${w.seed}`} />}
        {w?.clinicalPhysiologyModule && (
          <Chip size="small" color="success" variant="outlined" label={w.clinicalPhysiologyModule} />
        )}
      </Box>
      {m && (
        <Typography variant="body2" component="div">
          {t('引擎 vs 金标准', 'Engine vs gold')}: F1 {pct(m.alerts?.f1)}
          {' · '}{t('精确率', 'Precision')} {pct(m.alerts?.precision)}
          {' · '}{t('召回率', 'Recall')} {pct(m.alerts?.recall)}
          {' · '}{t('异常', 'Anomaly')} {pct(m.anomalyAccuracy)}
          {' · '}{t('风险', 'Risk')} {pct(m.riskAccuracy)}
          {' · '}{t('评分', 'Score')} {pct(m.healthScoreAgreementRate ?? m.healthScoreInRangeRate)}
          {wearableResults?.mismatchCount != null && (
            <> · {t('分歧', 'Disagree')} {wearableResults.mismatchCount}/{wearableResults.n || w?.n}</>
          )}
        </Typography>
      )}
      {invalid && invalidMsg && (
        <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.5 }}>
          {wearableResults?.circularLabelWarning || invalidMsg}
        </Typography>
      )}
      {framework?.screening && compact && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {isEn ? framework.screening.description_en : framework.screening.description_zh}
        </Typography>
      )}
    </Alert>
  );
}
