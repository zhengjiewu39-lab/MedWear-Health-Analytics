import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Chip, Button, LinearProgress, Card, CardContent,
  Alert, Rating, Tabs, Tab,
} from '@mui/material';
import {
  Assignment, VerifiedUser, Gavel, Business, OpenInNew, Language, Refresh, MyLocation,
} from '@mui/icons-material';
import InterventionPathway from '../components/InterventionPathway';
import { screeningApi } from '../services/api';
import { useDataMode } from '../contexts/DataModeContext';
import { useLang } from '../contexts/LanguageContext';
import useModeRefresh from '../hooks/useModeRefresh';
import { collectClientGeo } from '../utils/clientGeo';

const TYPE_FILTERS = [
  { value: 'all', label: '全部', label_en: 'All' },
  { value: 'hospital', label: '医院', label_en: 'Hospital' },
  { value: 'checkup', label: '体检中心', label_en: 'Checkup' },
  { value: 'clinic', label: '门诊部', label_en: 'Clinic' },
  { value: 'lab', label: '检验机构', label_en: 'Laboratory' },
];

/** Official site if valid; otherwise web search for booking. */
function facilityUrl(f) {
  if (f.website) return f.website;
  const query = encodeURIComponent([f.name, f.address, f.country, '官网 预约 体检'].filter(Boolean).join(' '));
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

function formatLocationLine(location, t) {
  if (!location) return '';
  const place = [location.city, location.region, location.country].filter(Boolean).join(', ');
  const ip = location.ip && location.ip !== 'env' && location.ip !== 'unknown' ? location.ip : '';
  const parts = [];
  if (place) parts.push(`${t('当前定位', 'Located')}: ${place}`);
  if (ip) parts.push(`IP: ${ip}`);
  if (location.source) {
    const srcLabel = location.source === 'browser-gps'
      ? t('浏览器定位', 'Browser GPS')
      : location.source;
    parts.push(`${t('来源', 'Source')}: ${srcLabel}`);
  }
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

function ExamAppointment() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [location, setLocation] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const navigate = useNavigate();
  const { isReal } = useDataMode();
  const { t } = useLang();

  const load = () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    collectClientGeo()
      .then((geo) => {
        const params = {};
        if (geo.clientIp) params.clientIp = geo.clientIp;
        if (typeof geo.lat === 'number' && typeof geo.lng === 'number') {
          params.lat = geo.lat;
          params.lng = geo.lng;
          if (geo.accuracy) params.accuracy = geo.accuracy;
        }
        return screeningApi.getHospitals(params);
      })
      .then((h) => {
        const list = Array.isArray(h.data) ? h.data : (h.data.hospitals || []);
        setHospitals(list);
        setLocation(h.data.location || null);
        setDataSource(h.data.dataSource || null);
        setSearchRadiusKm(h.data.searchRadiusKm || null);
        setWarning(h.data.warning || null);
        setLoading(false);
      })
      .catch((err) => {
        setHospitals([]);
        setError(err.message || t('加载失败，请重试', 'Failed to load — please retry'));
        setLoading(false);
      });
  };

  useModeRefresh(load);

  const filteredHospitals = hospitals.filter((h) => (typeFilter === 'all' ? true : h.type === typeFilter));

  const typeCounts = TYPE_FILTERS.reduce((acc, f) => {
    acc[f.value] = f.value === 'all' ? hospitals.length : hospitals.filter((h) => h.type === f.value).length;
    return acc;
  }, {});

  const openSite = (f) => window.open(facilityUrl(f), '_blank', 'noopener,noreferrer');

  if (loading) {
    return (
      <Box>
        <InterventionPathway />
        <LinearProgress sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          {t('正在实时定位（浏览器/IP）并检索附近医疗体检机构…', 'Resolving realtime location (browser/IP) and searching nearby checkup facilities…')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <InterventionPathway />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('预约体检 · 附近医疗机构', 'Book a Checkup · Nearby Facilities')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              '演示/真实模式均按实时定位检索附近医院与体检机构；优先浏览器定位，并校验公网 IP',
              'Both demo and real modes search nearby hospitals/checkup centres by realtime location; browser GPS preferred, public IP verified',
            )}
            {formatLocationLine(location, t)}
            {searchRadiusKm ? ` · ${t('检索半径', 'Radius')} ${searchRadiusKm} km` : ''}
          </Typography>
          {dataSource && (
            <Typography variant="caption" color="text.secondary" display="block">
              {t('数据来源', 'Data source')}：{dataSource === 'openstreetmap' ? t('OpenStreetMap 实时检索', 'OpenStreetMap live search')
                : dataSource === 'merged' ? t('本地持证目录 + OpenStreetMap 实时检索', 'Licensed catalog + OpenStreetMap live search')
                  : dataSource === 'demo-catalog' ? t('演示目录（已按定位排序）', 'Demo catalog (sorted by location)')
                    : t('本地持证机构目录', 'Local licensed catalog')}
              {isReal ? '' : ` · ${t('演示模式', 'Demo mode')}`}
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
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Button variant="outlined" startIcon={<MyLocation />} onClick={load}>{t('重新定位', 'Relocate')}</Button>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load}>{t('重新加载', 'Reload')}</Button>
          <Button variant="outlined" startIcon={<Assignment />} onClick={() => navigate('/doctor-report')}>{t('查看医生报告', 'View doctor report')}</Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>{t('重试', 'Retry')}</Button>}>
          {error}
        </Alert>
      )}
      {warning && (
        <Alert severity="warning" sx={{ mb: 2 }}>{warning}</Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        {t(
          '仅展示医院、体检中心、具备体检能力的门诊与医学检验机构。官网链接已校验；若无可靠官网，将打开搜索页。请以机构官网信息为准。',
          'Only hospitals, checkup centres, checkup-capable clinics and medical labs are listed. Website links are validated; otherwise a search page opens. Always confirm on the official site.',
        )}
      </Alert>

      <Tabs value={typeFilter} onChange={(_, v) => setTypeFilter(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        {TYPE_FILTERS.map((f) => (
          <Tab key={f.value} value={f.value} label={`${t(f.label, f.label_en)} (${typeCounts[f.value] || 0})`} />
        ))}
      </Tabs>

      <Grid container spacing={2}>
        {filteredHospitals.length === 0 && (
          <Grid item xs={12}>
            <Alert severity="warning" action={<Button color="inherit" size="small" onClick={load}>{t('重新定位检索', 'Search again')}</Button>}>
              {t(
                '当前定位附近暂未检索到该类医疗体检机构。请允许浏览器定位后重试，或切换机构类型。',
                'No checkup facilities of this type near your location. Allow browser location and retry, or switch facility type.',
              )}
            </Alert>
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
                {h.website && (
                  <Typography variant="caption" color="primary.main" display="block" sx={{ mb: 0.5, wordBreak: 'break-all' }}>
                    🔗 {h.website}
                  </Typography>
                )}
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
