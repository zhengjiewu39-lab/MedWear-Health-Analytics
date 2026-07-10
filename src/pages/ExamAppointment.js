import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Chip, Button, LinearProgress, Card, CardContent,
  Alert, Rating, Tabs, Tab,
} from '@mui/material';
import {
  Assignment, VerifiedUser, Gavel, Business, OpenInNew, Language,
} from '@mui/icons-material';
import InterventionPathway from '../components/InterventionPathway';
import { screeningApi } from '../services/api';
import { useDataMode } from '../contexts/DataModeContext';
import { useLang } from '../contexts/LanguageContext';
import useModeRefresh from '../hooks/useModeRefresh';

const TYPE_FILTERS = [
  { value: 'all', label: '全部', label_en: 'All' },
  { value: 'hospital', label: '医院', label_en: 'Hospital' },
  { value: 'checkup', label: '体检中心', label_en: 'Checkup' },
  { value: 'clinic', label: '门诊部', label_en: 'Clinic' },
  { value: 'lab', label: '检验机构', label_en: 'Laboratory' },
];

/** Resolve the external link for a facility: its official site, or a web search. */
function facilityUrl(f) {
  if (f.website) return f.website;
  const query = encodeURIComponent([f.name, f.address, f.country, '官网 预约'].filter(Boolean).join(' '));
  return `https://www.google.com/search?q=${query}`;
}

function QualificationBlock({ facility }) {
  const { t } = useLang();
  const q = facility.qualification;
  if (!q) return null;
  return (
    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Gavel fontSize="small" color="action" />
        <Typography variant="caption" fontWeight={600}>{t('机构资质', 'Facility qualification')}</Typography>
        <Chip label={`${t('来源', 'Source')} ${q.registry}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', ml: 'auto' }} />
      </Box>
      <Typography variant="caption" display="block" color="text.secondary">
        {t('类别', 'Category')}：{q.category}{facility.country ? ` · ${facility.country}` : ''}
      </Typography>
      <Typography variant="caption" display="block" color="text.secondary">
        {t('主管机构', 'Authority')}：{q.authority}
      </Typography>
      <Typography variant="caption" display="block" color="warning.main" sx={{ mt: 0.5 }}>
        {q.note}
      </Typography>
    </Box>
  );
}

function LicenseBlock({ facility }) {
  const { t } = useLang();
  if (!facility.licenseNo) return <QualificationBlock facility={facility} />;
  const valid = facility.licenseValidUntil && new Date(facility.licenseValidUntil) > new Date();
  return (
    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Gavel fontSize="small" color="action" />
        <Typography variant="caption" fontWeight={600}>{t('执业资质', 'License')}</Typography>
        {facility.verified && (
          <Chip icon={<VerifiedUser />} label={t('资质已核验', 'Verified')} size="small" color="success" sx={{ height: 20, fontSize: '0.65rem', ml: 'auto' }} />
        )}
      </Box>
      <Typography variant="caption" display="block" color="text.secondary">
        {facility.licenseType || t('医疗机构执业许可证', 'Medical institution license')} · {facility.licenseNo}
      </Typography>
      <Typography variant="caption" display="block" color="text.secondary">
        {t('发证机关', 'Issued by')}：{facility.licenseAuthority}
      </Typography>
      <Typography variant="caption" display="block" color={valid ? 'success.main' : 'error.main'}>
        {t('有效期至', 'Valid until')}：{facility.licenseValidUntil} {valid ? t('（有效）', '(valid)') : t('（已过期）', '(expired)')}
      </Typography>
      {facility.practiceScope && (
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('诊疗科目', 'Scope')}：{facility.practiceScope}
        </Typography>
      )}
      {facility.clia && (
        <Chip label={facility.clia} size="small" variant="outlined" sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }} />
      )}
    </Box>
  );
}

function ExamAppointment() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const navigate = useNavigate();
  const { isReal } = useDataMode();
  const { t } = useLang();

  const load = () => {
    setLoading(true);
    screeningApi.getHospitals()
      .then((h) => {
        setHospitals(h.data.hospitals || h.data);
        setLocation(h.data.location || null);
        setDataSource(h.data.dataSource || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useModeRefresh(load);

  const filteredHospitals = hospitals.filter((h) => (typeFilter === 'all' ? true : h.type === typeFilter));

  const typeCounts = TYPE_FILTERS.reduce((acc, f) => {
    acc[f.value] = f.value === 'all' ? hospitals.length : hospitals.filter((h) => h.type === f.value).length;
    return acc;
  }, {});

  const openSite = (f) => window.open(facilityUrl(f), '_blank', 'noopener,noreferrer');

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <InterventionPathway />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('预约体检 · 附近医疗机构', 'Book a Checkup · Nearby Facilities')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {isReal
              ? t('根据 IP 定位实时检索附近医院与体检机构（含国内外），点击机构直接进入其官网预约', 'Live search of nearby hospitals and checkup facilities (domestic & international) by IP location; click a facility to open its official website')
              : t('演示模式 — 含医院、体检中心、门诊与检验机构，点击进入官网', 'Demo mode — hospitals, checkup centers, clinics and labs; click to open official site')}
            {location?.city && ` · ${t('当前定位', 'Located')}: ${location.city}${location.region ? `, ${location.region}` : ''}${location.country ? `, ${location.country}` : ''}`}
          </Typography>
          {isReal && dataSource && (
            <Typography variant="caption" color="text.secondary">
              {t('数据来源', 'Data source')}：{dataSource === 'openstreetmap' ? t('OpenStreetMap 实时检索', 'OpenStreetMap live search')
                : dataSource === 'merged' ? t('本地持证目录 + OpenStreetMap 实时检索', 'Licensed catalog + OpenStreetMap live search')
                  : t('本地持证机构目录', 'Local licensed catalog')}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <Chip icon={<Business />} label={`${t('共', 'Total')} ${typeCounts.all} ${t('家机构', 'facilities')}`} size="small" color="primary" variant="outlined" />
            <Chip label={`${t('医院', 'Hospital')} ${typeCounts.hospital}`} size="small" variant="outlined" />
            <Chip label={`${t('体检中心', 'Checkup')} ${typeCounts.checkup}`} size="small" variant="outlined" />
            <Chip label={`${t('门诊', 'Clinic')} ${typeCounts.clinic}`} size="small" variant="outlined" />
            <Chip label={`${t('检验', 'Lab')} ${typeCounts.lab}`} size="small" variant="outlined" />
          </Box>
        </Box>
        <Button variant="outlined" startIcon={<Assignment />} onClick={() => navigate('/doctor-report')}>{t('查看医生报告', 'View doctor report')}</Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        {t('点击机构卡片或「进入官网预约」按钮，将在新标签页打开该机构官方网站完成预约；如未收录官网，将跳转到网络搜索。请以机构官网信息为准核对资质与套餐。',
          'Click a facility card or the "Book on official site" button to open the facility\'s official website in a new tab; if no site is on record, a web search opens instead. Always confirm qualifications and packages on the official site.')}
      </Alert>

      <Tabs value={typeFilter} onChange={(_, v) => setTypeFilter(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        {TYPE_FILTERS.map((f) => (
          <Tab key={f.value} value={f.value} label={`${t(f.label, f.label_en)} (${typeCounts[f.value] || 0})`} />
        ))}
      </Tabs>

      <Grid container spacing={2}>
        {filteredHospitals.length === 0 && (
          <Grid item xs={12}>
            <Typography color="text.secondary">
              {isReal && hospitals.length === 0
                ? t('当前定位附近暂未检索到该类机构，请稍后重试或切换机构类型。', 'No facilities of this type found near your location — please retry later or switch the facility type.')
                : t('该类型暂无可用机构', 'No facilities available for this type')}
            </Typography>
          </Grid>
        )}
        {filteredHospitals.map((h) => (
          <Grid item xs={12} md={6} lg={4} key={h.id}>
            <Card
              variant="outlined"
              sx={{ cursor: 'pointer', height: '100%', transition: 'box-shadow .2s', '&:hover': { boxShadow: 4 } }}
              onClick={() => openSite(h)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                  <Typography variant="h6" fontWeight={600}>{h.name}</Typography>
                  {h.typeLabel && <Chip label={h.typeLabel} size="small" color="secondary" variant="outlined" />}
                </Box>
                <Box sx={{ my: 1 }}>
                  {h.level && <Chip label={h.level} size="small" color="primary" sx={{ mr: 1 }} />}
                  <Chip label={h.distance} size="small" variant="outlined" />
                </Box>
                {h.rating ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Rating value={h.rating} readOnly size="small" precision={0.1} />
                    <Typography variant="caption">{h.rating}</Typography>
                  </Box>
                ) : null}
                {h.address && <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>📍 {h.address}</Typography>}
                {h.phone && <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>☎ {h.phone}</Typography>}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                  {(h.departments || []).map((d) => <Chip key={d} label={d} size="small" variant="outlined" />)}
                </Box>
                <LicenseBlock facility={h} />
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={h.website ? <Language /> : <OpenInNew />}
                  sx={{ mt: 1.5 }}
                  onClick={(e) => { e.stopPropagation(); openSite(h); }}
                >
                  {h.website ? t('进入官网预约', 'Book on official site') : t('搜索官网预约', 'Search official site')}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default ExamAppointment;
