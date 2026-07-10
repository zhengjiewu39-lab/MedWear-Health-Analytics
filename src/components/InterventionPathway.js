import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Paper, Typography, Stepper, Step, StepLabel, Button, Chip, Stack, alpha,
} from '@mui/material';
import { ArrowForward, ArrowBack, CompareArrows } from '@mui/icons-material';
import { PATHWAY_STEPS, OUTCOMES_STEP, getPathwayStep, getNextStep, getPrevStep } from '../config/interventionPathway';
import { useLang } from '../contexts/LanguageContext';

function InterventionPathway({ compact = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isEn } = useLang();
  const current = getPathwayStep(location.pathname);
  const next = getNextStep(location.pathname);
  const prev = getPrevStep(location.pathname);
  const allSteps = [...PATHWAY_STEPS, OUTCOMES_STEP];
  const activeIdx = allSteps.findIndex((s) => s.path === location.pathname);

  if (!current && location.pathname !== '/methodology') return null;

  const label = (s) => (isEn ? s.text_en : s.text);

  if (compact) {
    return (
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          size="small"
          label={t(`步骤 ${current?.step || '—'}/8`, `Step ${current?.step || '—'}/8`)}
          color="primary"
          variant="outlined"
        />
        {next && (
          <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate(next.path)}>
            {t('下一步', 'Next')}: {label(next)}
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha('#1565C0', 0.03),
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} color="primary.main">
          {t('干预路径模拟', 'Intervention Pathway Simulation')}
        </Typography>
        <Chip
          icon={<CompareArrows sx={{ fontSize: 16 }} />}
          label={t('论文主线：可穿戴早筛 → 临床干预 → 结局评估', 'Thesis flow: wearable screening → clinical intervention → outcome evaluation')}
          size="small"
          variant="outlined"
          color="primary"
        />
      </Box>

      <Stepper
        activeStep={activeIdx >= 0 ? activeIdx : 0}
        alternativeLabel
        sx={{ display: { xs: 'none', md: 'flex' }, mb: 1.5 }}
      >
        {allSteps.map((s) => (
          <Step key={s.id} completed={activeIdx > allSteps.indexOf(s)}>
            <StepLabel
              sx={{ cursor: 'pointer', '& .MuiStepLabel-label': { fontSize: '0.75rem' } }}
              onClick={() => navigate(s.path)}
            >
              {label(s)}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
        {allSteps.map((s) => (
          <Chip
            key={s.id}
            label={label(s)}
            size="small"
            color={s.path === location.pathname ? 'primary' : 'default'}
            variant={s.path === location.pathname ? 'filled' : 'outlined'}
            onClick={() => navigate(s.path)}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>

      <Stack direction="row" spacing={1} justifyContent="space-between">
        {prev ? (
          <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate(prev.path)}>
            {label(prev)}
          </Button>
        ) : <Box />}
        {next && (
          <Button size="small" variant="contained" endIcon={<ArrowForward />} onClick={() => navigate(next.path)}>
            {t('下一步', 'Next')}: {label(next)}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

export default InterventionPathway;
