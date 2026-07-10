import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import { useLang } from '../contexts/LanguageContext';
import { useDemoPatient } from '../contexts/DemoPatientContext';
import { demoApi } from '../services/api';

export default function DemoPatientSelector() {
  const { t, isEn } = useLang();
  const { patientId, setPatientId, current } = useDemoPatient();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      demoApi.listPatients({ q: input || undefined, limit: 30 })
        .then((res) => {
          if (cancelled) return;
          const list = res.data?.patients || [];
          const cur = current || list.find((p) => p.id === patientId);
          if (cur && !list.some((p) => p.id === cur.id)) list.unshift(cur);
          setOptions(list);
        })
        .catch(() => { if (!cancelled) setOptions(current ? [current] : []); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 280);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [input, patientId, current]);

  const value = current || options.find((p) => p.id === patientId) || null;

  return (
    <Autocomplete
      size="small"
      sx={{ minWidth: 300, maxWidth: 400, mr: 0.5 }}
      options={options}
      loading={loading}
      value={value}
      onChange={(_, p) => { if (p) setPatientId(p.id); }}
      onInputChange={(_, v, reason) => { if (reason === 'input') setInput(v); }}
      getOptionLabel={(p) => (p ? `${p.name} · ${p.id}` : '')}
      isOptionEqualToValue={(a, b) => a?.id === b?.id}
      filterOptions={(x) => x}
      noOptionsText={t('未找到匹配患者', 'No matching patients')}
      loadingText={t('搜索中…', 'Searching…')}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={t('搜索 5000 名演示者…', 'Search 5000 demo participants…')}
          sx={{ bgcolor: 'background.paper' }}
        />
      )}
      renderOption={(props, p) => (
        <li {...props} key={p.id}>
          <Box>
            <Typography variant="body2" fontWeight={700}>
              {p.name} · {p.id}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isEn ? (p.scenario_en || p.scenario) : p.scenario}
              {' · '}
              {t('健康分', 'Score')} {p.healthScore}
              {' · '}
              {p.arm === 'intervention' ? t('干预组', 'IV') : t('对照组', 'UC')}
              {p.primaryDevice && (
                <>
                  {' · '}
                  {isEn ? (p.primaryDevice_en || p.primaryDevice) : p.primaryDevice}
                  {p.deviceCount > 1 && ` (+${p.deviceCount - 1})`}
                </>
              )}
            </Typography>
          </Box>
        </li>
      )}
    />
  );
}
