#!/usr/bin/env node
/**
 * Generate benchmarks/public-health-dataset.json (52 PHM scenarios).
 * Run: node scripts/generate-phm-dataset.js
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../benchmarks/public-health-dataset.json');

function baselineDay(steps = 8000, hr = 62, spo2 = 98) {
  return { steps, heart_rate: hr, spo2, hrv: 48, resting_hr: hr - 2, symptom: null, temp_proxy: 36.6 };
}

function illDay(opts = {}) {
  return {
    steps: opts.steps ?? 3500,
    heart_rate: opts.hr ?? 78,
    spo2: opts.spo2 ?? 96,
    hrv: opts.hrv ?? 32,
    resting_hr: opts.rhr ?? 76,
    symptom: opts.symptom ?? 'cough',
    temp_proxy: opts.temp ?? 37.4,
  };
}

function makeIndividual(id, lat, lng, days, baseline = {}) {
  const ts = {};
  Object.entries(days).forEach(([d, v]) => {
    ts[d] = {
      temp_proxy: v.temp_proxy ?? v.temp ?? 36.8,
      hr: v.heart_rate ?? v.hr ?? 62,
      steps: v.steps ?? 8000,
      spo2: v.spo2 ?? 98,
      hrv: v.hrv ?? 48,
      symptom: v.symptom ?? null,
    };
  });
  return {
    id,
    user_profile: { age: baseline.age ?? 32, gender: baseline.gender ?? 'unknown', ses: baseline.ses ?? 'medium' },
    location: { lat, lng, district_id: baseline.district ?? '110105', geohash_precision: 7 },
    workplace: baseline.workplace || null,
    baseline_metrics: { hr: 62, temp_proxy: 36.6, steps: 8500, spo2: 98 },
    daily_timeseries: ts,
  };
}

function skeletonCase(def) {
  return {
    schema_level: 'framework',
    id: def.id,
    title: def.title,
    title_zh: def.title_zh,
    category: def.category,
    setting: def.setting,
    epidemiological_context: def.epi,
    individual_record_count: def.count,
    individual_records: def.stubs || [],
    spatial: def.spatial || {},
    expected: def.expected,
    notes: def.notes || 'Synthetic framework entry — expand with full timeseries for evaluation runs.',
  };
}

// ── Complete scenarios (5) ──

const PH301 = {
  schema_level: 'complete',
  id: 'PH-301',
  title: 'Workplace Influenza Cluster',
  title_zh: '办公楼8楼销售部发现12人流感样症状',
  category: 'workplace_cluster',
  setting: 'office_building',
  epidemiological_context: {
    season: 'winter_2025_26',
    syndrome: 'respiratory',
    pathogen_hypothesis: 'influenza_a',
    population: { total: 450, affected: 12, age_range: '25-65', setting_occupancy: 45 },
    baseline_activity: 'low',
    district_id: '110105',
    poi_id: 'POI-OFFICE-8F-SALES',
  },
  spatial: { lat: 39.9087, lng: 116.4716, floor: 8, department: 'sales', cluster_radius_m: 120 },
  individual_records: [
    makeIndividual('E001', 39.90870, 116.47160, {
      '2026-01-14': baselineDay(), '2026-01-15': baselineDay(7800, 64),
      '2026-01-16': illDay({ symptom: 'cough', steps: 5200 }), '2026-01-17': illDay({ temp: 37.6, hr: 82, steps: 4100 }),
      '2026-01-18': illDay({ temp: 37.8, hr: 85, steps: 3200, spo2: 95 }),
    }, { age: 28, gender: 'female', workplace: { poi_id: 'POI-OFFICE-8F-SALES', type: 'office' } }),
    makeIndividual('E002', 39.90872, 116.47158, {
      '2026-01-14': baselineDay(), '2026-01-15': baselineDay(),
      '2026-01-16': illDay({ symptom: 'cough' }), '2026-01-17': illDay({ temp: 37.5, hr: 80 }),
      '2026-01-18': illDay({ temp: 37.7, hr: 84, spo2: 95 }),
    }, { age: 31, gender: 'male', workplace: { poi_id: 'POI-OFFICE-8F-SALES', type: 'office' } }),
    makeIndividual('E003', 39.90868, 116.47162, {
      '2026-01-14': baselineDay(), '2026-01-15': baselineDay(7600, 63),
      '2026-01-17': illDay({ symptom: 'sore_throat', temp: 37.4 }), '2026-01-18': illDay({ temp: 37.6, hr: 79 }),
    }, { age: 35, gender: 'female', workplace: { poi_id: 'POI-OFFICE-8F-SALES', type: 'office' } }),
    makeIndividual('E004', 39.90871, 116.47159, {
      '2026-01-15': baselineDay(), '2026-01-16': illDay({ symptom: 'fatigue', steps: 4800 }),
      '2026-01-17': illDay({ temp: 37.3 }), '2026-01-18': illDay({ temp: 37.5, hr: 81 }),
    }, { age: 29, gender: 'male', workplace: { poi_id: 'POI-OFFICE-8F-SALES', type: 'office' } }),
    makeIndividual('E005', 39.90869, 116.47161, {
      '2026-01-14': baselineDay(), '2026-01-16': illDay({ symptom: 'cough' }),
      '2026-01-17': illDay({ temp: 37.5 }), '2026-01-18': illDay({ temp: 37.9, hr: 86, spo2: 94 }),
    }, { age: 42, gender: 'female', ses: 'high', workplace: { poi_id: 'POI-OFFICE-8F-SALES', type: 'office' } }),
  ],
  expected: {
    cluster_detected: true,
    min_cluster_members: 3,
    detection_timing_hours: 36,
    earliest_clinical_confirmation_hours: 72,
    time_saved_hours: 36,
    alert_level: 'ALERT',
    public_health_value: 'high',
    syndrome: 'respiratory',
  },
};

const PH302 = {
  schema_level: 'complete',
  id: 'PH-302',
  title: 'Manufacturing Line Gastroenteritis Cluster',
  title_zh: '某制造工厂生产线5人同时腹泻',
  category: 'workplace_cluster',
  setting: 'factory',
  epidemiological_context: {
    season: 'summer_2026',
    syndrome: 'gastrointestinal',
    pathogen_hypothesis: 'norovirus',
    population: { total: 220, affected: 5, age_range: '22-55', shift: 'night' },
    baseline_activity: 'moderate',
    district_id: '110112',
    poi_id: 'POI-FACTORY-LINE-B',
  },
  spatial: { lat: 39.7862, lng: 116.5634, line: 'B', cluster_radius_m: 80 },
  individual_records: [
    makeIndividual('F001', 39.78620, 116.56340, {
      '2026-07-10': baselineDay(11000, 68), '2026-07-11': illDay({ symptom: 'gi_symptoms', steps: 4200, hr: 74, temp: 37.1 }),
      '2026-07-12': illDay({ symptom: 'gi_symptoms', steps: 2800, hr: 76, temp: 37.0 }),
    }, { age: 34, workplace: { poi_id: 'POI-FACTORY-LINE-B', type: 'factory' } }),
    makeIndividual('F002', 39.78622, 116.56338, {
      '2026-07-10': baselineDay(10500, 70), '2026-07-11': illDay({ symptom: 'gi_symptoms', steps: 3900 }),
      '2026-07-12': illDay({ symptom: 'gi_symptoms', steps: 2500, hr: 78 }),
    }, { age: 28, workplace: { poi_id: 'POI-FACTORY-LINE-B', type: 'factory' } }),
    makeIndividual('F003', 39.78618, 116.56342, {
      '2026-07-11': baselineDay(), '2026-07-12': illDay({ symptom: 'gi_symptoms', steps: 3100, temp: 37.2 }),
    }, { age: 41, workplace: { poi_id: 'POI-FACTORY-LINE-B', type: 'factory' } }),
    makeIndividual('F004', 39.78621, 116.56339, {
      '2026-07-10': baselineDay(), '2026-07-11': illDay({ symptom: 'gi_symptoms', steps: 3600 }),
      '2026-07-12': illDay({ symptom: 'gi_symptoms', steps: 2200 }),
    }, { age: 36, ses: 'low', workplace: { poi_id: 'POI-FACTORY-LINE-B', type: 'factory' } }),
    makeIndividual('F005', 39.78619, 116.56341, {
      '2026-07-11': baselineDay(9800, 69), '2026-07-12': illDay({ symptom: 'gi_symptoms', steps: 2700, hr: 75 }),
    }, { age: 45, workplace: { poi_id: 'POI-FACTORY-LINE-B', type: 'factory' } }),
  ],
  expected: {
    cluster_detected: true,
    min_cluster_members: 3,
    detection_timing_hours: 24,
    earliest_clinical_confirmation_hours: 48,
    time_saved_hours: 24,
    alert_level: 'ALERT',
    public_health_value: 'high',
    syndrome: 'gastrointestinal',
  },
};

const PH401 = {
  schema_level: 'complete',
  id: 'PH-401',
  title: 'Primary School Class Respiratory Outbreak',
  title_zh: '某小学三年级2班8名学生呼吸道症状聚集',
  category: 'school_outbreak',
  setting: 'school',
  epidemiological_context: {
    season: 'winter_2025_26',
    syndrome: 'respiratory',
    pathogen_hypothesis: 'rsv',
    population: { total: 32, affected: 8, age_range: '8-9', grade: 3, class: '2' },
    baseline_activity: 'high',
    district_id: '110108',
    poi_id: 'POI-SCHOOL-GRADE3-2',
  },
  spatial: { lat: 39.9834, lng: 116.3125, cluster_radius_m: 200 },
  individual_records: [
    makeIndividual('S001', 39.98340, 116.31250, {
      '2026-01-10': baselineDay(9500, 88), '2026-01-11': baselineDay(9200, 90),
      '2026-01-12': illDay({ symptom: 'cough', hr: 98, steps: 5000, spo2: 97 }),
      '2026-01-13': illDay({ symptom: 'cough', hr: 102, steps: 3200, spo2: 96 }),
    }, { age: 8, gender: 'male', workplace: { poi_id: 'POI-SCHOOL-GRADE3-2', type: 'school' } }),
    makeIndividual('S002', 39.98342, 116.31248, {
      '2026-01-11': baselineDay(9800, 86), '2026-01-12': illDay({ symptom: 'cough', hr: 100, steps: 4500 }),
      '2026-01-13': illDay({ symptom: 'shortness_of_breath', hr: 105, spo2: 95, steps: 2800 }),
    }, { age: 9, gender: 'female', workplace: { poi_id: 'POI-SCHOOL-GRADE3-2', type: 'school' } }),
    makeIndividual('S003', 39.98338, 116.31252, {
      '2026-01-12': baselineDay(9100, 89), '2026-01-13': illDay({ symptom: 'cough', hr: 99, steps: 3800 }),
    }, { age: 8, gender: 'male', workplace: { poi_id: 'POI-SCHOOL-GRADE3-2', type: 'school' } }),
    makeIndividual('S004', 39.98341, 116.31249, {
      '2026-01-11': baselineDay(), '2026-01-12': illDay({ symptom: 'sore_throat', steps: 5200 }),
      '2026-01-13': illDay({ symptom: 'cough', hr: 101, spo2: 96 }),
    }, { age: 9, gender: 'female', workplace: { poi_id: 'POI-SCHOOL-GRADE3-2', type: 'school' } }),
  ],
  expected: {
    cluster_detected: true,
    min_cluster_members: 3,
    detection_timing_hours: 48,
    earliest_clinical_confirmation_hours: 96,
    time_saved_hours: 48,
    alert_level: 'ACTION',
    public_health_value: 'high',
    syndrome: 'respiratory',
  },
};

const PH601 = {
  schema_level: 'complete',
  id: 'PH-601',
  title: 'Community Respiratory Early Warning Signal',
  title_zh: '某社区冬季呼吸道信号早期上升趋势',
  category: 'early_warning',
  setting: 'mixed_community',
  epidemiological_context: {
    season: 'winter_2025_26',
    syndrome: 'respiratory',
    pathogen_hypothesis: 'influenza_b',
    population: { total: 12000, affected_estimate: 45, age_range: 'mixed' },
    baseline_activity: 'moderate',
    district_id: '110106',
  },
  spatial: { lat: 39.8652, lng: 116.3784, cluster_radius_m: 800, scattered: true },
  individual_records: [
    makeIndividual('C001', 39.86520, 116.37840, {
      '2026-01-08': baselineDay(), '2026-01-10': illDay({ symptom: 'cough', steps: 5500 }),
      '2026-01-12': baselineDay(7200, 66),
    }, { age: 45, ses: 'medium' }),
    makeIndividual('C002', 39.86580, 116.37910, {
      '2026-01-09': baselineDay(), '2026-01-11': illDay({ symptom: 'cough', hr: 76 }),
    }, { age: 52, ses: 'low' }),
    makeIndividual('C003', 39.86490, 116.37780, {
      '2026-01-10': baselineDay(), '2026-01-12': illDay({ symptom: 'fatigue', steps: 4800, spo2: 96 }),
    }, { age: 38, ses: 'high' }),
  ],
  expected: {
    cluster_detected: false,
    regional_trend_alert: true,
    detection_timing_hours: 72,
    earliest_clinical_confirmation_hours: 120,
    time_saved_hours: 48,
    alert_level: 'MONITOR',
    public_health_value: 'medium',
    syndrome: 'respiratory',
  },
};

const PH804 = {
  schema_level: 'complete',
  id: 'PH-804',
  title: 'Marathon Training HR Spike False Cluster',
  title_zh: '跑步训练导致心率尖峰误报（边界场景）',
  category: 'borderline_false_positive',
  setting: 'recreational',
  epidemiological_context: {
    season: 'spring_2026',
    syndrome: 'unspecified',
    population: { total: 8, affected: 0, age_range: '25-40', cohort: 'running_club' },
    baseline_activity: 'high',
    district_id: '110108',
  },
  spatial: { lat: 39.9921, lng: 116.3974, cluster_radius_m: 300 },
  individual_records: [
    makeIndividual('R001', 39.99210, 116.39740, {
      '2026-04-05': baselineDay(12000, 58), '2026-04-06': { ...baselineDay(14500, 62), hr: 145, symptom: null, temp_proxy: 36.8 },
      '2026-04-07': baselineDay(11000, 60),
    }, { age: 32, gender: 'male' }),
    makeIndividual('R002', 39.99212, 116.39738, {
      '2026-04-05': baselineDay(11500, 59), '2026-04-06': { ...baselineDay(13800, 61), hr: 138, symptom: null },
      '2026-04-07': baselineDay(10500, 58),
    }, { age: 28, gender: 'female' }),
    makeIndividual('R003', 39.99208, 116.39742, {
      '2026-04-06': { ...baselineDay(14200, 63), hr: 142, symptom: null },
      '2026-04-07': baselineDay(10800, 59),
    }, { age: 35, gender: 'male' }),
  ],
  expected: {
    cluster_detected: false,
    false_positive_risk: 'high',
    detection_timing_hours: null,
    alert_level: 'NONE',
    public_health_value: 'none',
    notes: 'HR spikes during exercise should NOT trigger outbreak cluster',
  },
};

// ── Framework skeletons ──

const workplaceSkeletons = [
  ['PH-303', 'Warehouse Cold Chain GI Cluster', '冷链仓库6人胃肠道症状', 'warehouse', 6, 'gastrointestinal'],
  ['PH-304', 'Tech Campus COVID-like Cluster', '科技园区办公楼COVID样聚集', 'office_building', 9, 'respiratory'],
  ['PH-305', 'Restaurant Staff Febrile Cluster', '餐饮员工5人发热聚集', 'restaurant', 5, 'febrile'],
  ['PH-306', 'Construction Site Injury-Fever Mix', '工地3人发热样信号（非传染）', 'construction', 3, 'febrile'],
  ['PH-307', 'Call Center Respiratory Spread', '呼叫中心9人咳嗽传播', 'office_building', 9, 'respiratory'],
  ['PH-308', 'Hospital Admin Wing Cluster', '医院行政楼工作人员聚集', 'healthcare', 4, 'respiratory'],
  ['PH-309', 'Retail Mall Staff Cluster', '商场员工7人流感样', 'retail', 7, 'respiratory'],
  ['PH-310', 'Logistics Hub Febrile Cluster', '物流枢纽4人发热', 'logistics', 4, 'febrile'],
  ['PH-311', 'Pharmaceutical Lab GI Event', '药厂实验室5人腹泻', 'factory', 5, 'gastrointestinal'],
  ['PH-312', 'Co-working Space Respiratory', '联合办公空间6人呼吸道', 'office_building', 6, 'respiratory'],
  ['PH-313', 'Hotel Housekeeping Cluster', '酒店保洁员4人聚集', 'hospitality', 4, 'respiratory'],
  ['PH-314', 'Bank Branch Febrile Cluster', '银行网点3人发热', 'office_building', 3, 'febrile'],
  ['PH-315', 'Data Center Night Shift Cluster', '数据中心夜班5人疲劳样', 'office_building', 5, 'febrile'],
].map(([id, title, title_zh, setting, count, syndrome]) => skeletonCase({
  id, title, title_zh, category: 'workplace_cluster', setting,
  count,
  epi: { season: 'winter_2025_26', syndrome, population: { total: count * 20, affected: count }, baseline_activity: 'moderate' },
  expected: { cluster_detected: true, min_cluster_members: 3, detection_timing_hours: 36, public_health_value: 'high', syndrome },
}));

const schoolSkeletons = [
  ['PH-402', 'Middle School Grade 7 Outbreak', '初中一年级6人发热', 6],
  ['PH-403', 'High School Boarding GI Cluster', '寄宿制高中4人腹泻', 4],
  ['PH-404', 'Kindergarten RSV Cluster', '幼儿园5人RSV样', 5],
  ['PH-405', 'University Dorm Respiratory', '大学宿舍7人呼吸道', 7],
  ['PH-406', 'Vocational School Cluster', '职校3人聚集', 3],
  ['PH-407', 'After-school Center Cluster', '托管班4人咳嗽', 4],
  ['PH-408', 'Sports Academy Febrile Cluster', '体校5人发热', 5],
].map(([id, title, title_zh, count]) => skeletonCase({
  id, title, title_zh, category: 'school_outbreak', setting: 'school',
  count,
  epi: { season: 'winter_2025_26', syndrome: 'respiratory', population: { total: count * 4, affected: count, age_range: '6-18' }, baseline_activity: 'high' },
  expected: { cluster_detected: true, min_cluster_members: 3, detection_timing_hours: 48, alert_level: 'ALERT', public_health_value: 'high' },
}));

const residentialSkeletons = [
  ['PH-501', 'Elderly Care Home Respiratory', '养老院6人呼吸道', 'nursing_home', 6],
  ['PH-502', 'Apartment Tower GI Cluster', '高层住宅4人腹泻', 'apartment', 4],
  ['PH-503', 'Suburban Community Febrile', '郊区社区5人发热', 'suburban', 5],
  ['PH-504', 'Urban Village Cluster', '城中村7人聚集', 'urban_village', 7],
  ['PH-505', 'Gated Community Respiratory', '封闭小区4人咳嗽', 'gated_community', 4],
  ['PH-506', 'Public Housing SES Low Cluster', '公租屋低SES聚集', 'public_housing', 5],
  ['PH-507', 'Family Compound GI Event', '大院3人胃肠道', 'compound', 3],
  ['PH-508', 'High-rise Mixed Age Cluster', '混合年龄高层5人', 'apartment', 5],
  ['PH-509', 'Retirement Community Cluster', '退休社区4人', 'retirement_community', 4],
  ['PH-510', 'New Development Sparse Cluster', '新建社区稀疏3人', 'suburban', 3],
].map(([id, title, title_zh, setting, count]) => skeletonCase({
  id, title, title_zh, category: 'residential_cluster', setting,
  count,
  epi: { season: 'winter_2025_26', syndrome: id.includes('GI') ? 'gastrointestinal' : 'respiratory', population: { total: count * 15, affected: count }, baseline_activity: 'low' },
  expected: { cluster_detected: true, min_cluster_members: 3, detection_timing_hours: 48, public_health_value: 'medium' },
}));

const earlyWarningSkeletons = [
  ['PH-602', 'Regional SpO2 Dip Trend', '区域血氧下降趋势', 'regional'],
  ['PH-603', 'Activity Drop Widespread Signal', '广泛活动量下降信号', 'regional'],
  ['PH-604', 'Multi-district Febrile Uptick', '多区发热率上升', 'multi_district'],
  ['PH-605', 'Pre-holiday Travel Surge Signal', '节前出行相关信号', 'transport_hub'],
  ['PH-606', 'Pollution + Respiratory Proxy', '污染叠加呼吸道代理', 'urban'],
  ['PH-607', 'Heatwave Febrile Proxy Trend', '高温期发热代理上升', 'regional'],
  ['PH-608', 'Pediatric Seasonal Uptick', '儿科季节上升趋势', 'regional'],
  ['PH-609', 'Rural Clinic Sentinel Signal', '农村哨点早期信号', 'rural'],
  ['PH-610', 'Cross-border Travel Warning', '跨境流动预警信号', 'border_region'],
].map(([id, title, title_zh, setting]) => skeletonCase({
  id, title, title_zh, category: 'early_warning', setting,
  count: 12,
  epi: { season: 'winter_2025_26', syndrome: 'respiratory', population: { total: 50000, affected_estimate: 30 }, baseline_activity: 'moderate' },
  expected: { cluster_detected: false, regional_trend_alert: true, alert_level: 'MONITOR', detection_timing_hours: 72, public_health_value: 'medium' },
}));

const chronicSkeletons = [
  ['PH-701', 'COPD Exacerbation Cluster Proxy', 'COPD加重代理聚集', 'clinic_cohort', 'respiratory'],
  ['PH-702', 'Diabetes Poor Control Activity Pattern', '糖尿病控制不佳活动模式', 'chronic_care', 'metabolic'],
  ['PH-703', 'Heart Failure Decompensation Signals', '心衰失代偿信号', 'cardiac_cohort', 'cardiovascular'],
  ['PH-704', 'Hypertension Uncontrolled Cohort', '高血压未控制人群', 'chronic_care', 'cardiovascular'],
  ['PH-705', 'CKD Stage Monitoring Anomalies', 'CKD分期监测异常', 'nephrology_cohort', 'metabolic'],
].map(([id, title, title_zh, setting, syndrome]) => skeletonCase({
  id, title, title_zh, category: 'chronic_monitoring', setting,
  count: 8,
  epi: { season: 'year_round', syndrome, population: { total: 120, affected: 8, age_range: '55-85' }, baseline_activity: 'low' },
  expected: { cluster_detected: false, chronic_alert: true, alert_level: 'MONITOR', public_health_value: 'medium' },
}));

const borderlineSkeletons = [
  ['PH-801', 'Single-family Coincidental Symptoms', '同一家庭偶发症状（非暴发）', 'household', 2],
  ['PH-802', 'Heat Stress HR Elevation', '高温应激心率升高', 'outdoor', 4],
  ['PH-803', 'Device Artifact SpO2 Dip', '设备伪影血氧下降', 'mixed', 3],
].map(([id, title, title_zh, setting, count]) => skeletonCase({
  id, title, title_zh, category: 'borderline_false_positive', setting,
  count,
  epi: { season: 'summer_2026', syndrome: 'unspecified', population: { total: count, affected: 0 }, baseline_activity: 'high' },
  expected: { cluster_detected: false, false_positive_risk: 'medium', alert_level: 'NONE', public_health_value: 'none' },
}));

const cases = [
  PH301, PH302,
  ...workplaceSkeletons,
  PH401,
  ...schoolSkeletons,
  ...residentialSkeletons,
  PH601,
  ...earlyWarningSkeletons,
  ...chronicSkeletons,
  ...borderlineSkeletons,
  PH804,
];

const dataset = {
  dataset: 'MedWear-Public-Health-Surveillance-v1',
  version: '1.0.0',
  license: 'CC-BY-4.0',
  description: 'Synthetic public-health surveillance scenarios for Level-2/3 PHM evaluation: workplace, school, residential clusters, early warning, chronic monitoring, and borderline false positives. No real PHI.',
  created_at: '2026-07-08',
  categories: {
    workplace_cluster: { count: 15, id_range: 'PH-301..315' },
    school_outbreak: { count: 8, id_range: 'PH-401..408' },
    residential_cluster: { count: 10, id_range: 'PH-501..510' },
    early_warning: { count: 10, id_range: 'PH-601..610' },
    chronic_monitoring: { count: 5, id_range: 'PH-701..705' },
    borderline_false_positive: { count: 4, id_range: 'PH-801..804' },
  },
  phm_thresholds: {
    cluster_min_members: 3,
    time_window_hours: 72,
    proximity_meters: 500,
  },
  complete_examples: ['PH-301', 'PH-302', 'PH-401', 'PH-601', 'PH-804'],
  case_count: cases.length,
  cases,
};

fs.writeFileSync(OUT, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
console.log(`Generated ${cases.length} cases → ${OUT}`);
