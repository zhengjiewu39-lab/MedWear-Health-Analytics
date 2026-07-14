const { getStore, hasData } = require('./store');
const { CATEGORY_META } = require('../data/predictionsCatalog');
const {
  buildRealScreeningCategories,
  buildRealTrendData,
  getRecommendedExams,
  getRecommendedExamsEn,
} = require('../data/screeningCatalog');

function avg(arr) {
  if (!arr?.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
  if (!arr?.length) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function sortedDays(store) {
  return Object.keys(store.daily).sort();
}

function lastNDays(store, n) {
  return sortedDays(store).slice(-n);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function computeDayScore(dayData) {
  let score = 0;
  let weight = 0;
  if (dayData.steps > 0) { score += Math.min(dayData.steps / 10000, 1) * 30; weight += 30; }
  const sleepH = (dayData.sleepMinutes.deep + dayData.sleepMinutes.rem + dayData.sleepMinutes.light) / 60;
  if (sleepH > 0) { score += Math.min(sleepH / 8, 1) * 25; weight += 25; }
  const rhr = dayData.restingHeartRate || avg(dayData.heartRate);
  if (rhr) { score += (rhr >= 50 && rhr <= 75 ? 1 : rhr < 50 ? 0.7 : 0.5) * 20; weight += 20; }
  const spo2 = avg(dayData.spo2);
  if (spo2) { score += (spo2 >= 95 ? 1 : spo2 >= 90 ? 0.6 : 0.3) * 15; weight += 15; }
  const hrv = avg(dayData.hrv);
  if (hrv) { score += Math.min(hrv / 60, 1) * 10; weight += 10; }
  return weight > 0 ? Math.round((score / weight) * 100) : null;
}

function getLatestDay(store) {
  const days = sortedDays(store);
  return days[days.length - 1] || null;
}

function getTodayOrLatest(store) {
  const today = todayKey();
  if (store.daily[today]) return today;
  return getLatestDay(store);
}

function detectAlerts(store, thresholds) {
  const alerts = [];
  const day = getTodayOrLatest(store);
  if (!day) return alerts;
  const d = store.daily[day];
  const patient = store.meta?.userLabel || '我';

  const hrMax = thresholds?.heartRateMax || 100;
  const hrMin = thresholds?.heartRateMin || 50;
  const spo2Min = thresholds?.spo2Min || 93;

  const hrAvg = avg(d.heartRate);
  if (hrAvg && hrAvg > hrMax) {
    alerts.push({
      id: alerts.length + 1, patient, type: '心率偏高', type_en: 'High heart rate', severity: 'high',
      message: `今日平均心率 ${Math.round(hrAvg)} bpm，超过阈值 ${hrMax} bpm`,
      message_en: `Today's average heart rate ${Math.round(hrAvg)} bpm exceeds threshold ${hrMax} bpm`,
      time: day, status: 'pending', device: getPrimarySource(store),
    });
  }
  if (hrAvg && hrAvg < hrMin) {
    alerts.push({
      id: alerts.length + 1, patient, type: '心率偏低', type_en: 'Low heart rate', severity: 'medium',
      message: `今日平均心率 ${Math.round(hrAvg)} bpm，低于阈值 ${hrMin} bpm`,
      message_en: `Today's average heart rate ${Math.round(hrAvg)} bpm is below threshold ${hrMin} bpm`,
      time: day, status: 'pending', device: getPrimarySource(store),
    });
  }
  const spo2 = avg(d.spo2);
  if (spo2 && spo2 < spo2Min) {
    alerts.push({
      id: alerts.length + 1, patient, type: '血氧偏低', type_en: 'Low blood oxygen', severity: 'high',
      message: `今日平均血氧 ${spo2.toFixed(1)}%，低于 ${spo2Min}%`,
      message_en: `Today's average SpO₂ ${spo2.toFixed(1)}% is below ${spo2Min}%`,
      time: day, status: 'pending', device: getPrimarySource(store),
    });
  }
  if (d.steps > 0 && d.steps < 3000) {
    alerts.push({
      id: alerts.length + 1, patient, type: '活动量不足', type_en: 'Insufficient activity', severity: 'low',
      message: `今日步数 ${Math.round(d.steps)} 步，活动量偏低`,
      message_en: `Today's steps ${Math.round(d.steps)}, activity is low`,
      time: day, status: 'pending', device: getPrimarySource(store),
    });
  }
  return alerts;
}

function getPrimarySource(store) {
  const list = store.meta?.sourceList || [];
  const watch = list.find(s => /watch|手表|Apple Watch/i.test(s.name));
  return watch?.name || list[0]?.name || 'Apple Health';
}

function detectAnomalies(store) {
  const anomalies = [];
  const days = lastNDays(store, 14);
  const allHR = days.flatMap(d => store.daily[d].heartRate);
  if (allHR.length < 10) return anomalies;

  const mean = avg(allHR);
  const sd = stdDev(allHR);
  const patient = store.meta?.userLabel || '我';
  const source = getPrimarySource(store);

  days.forEach(day => {
    const hrs = store.daily[day].heartRate;
    const spikes = hrs.filter(h => h > mean + 2 * sd);
    if (spikes.length >= 3) {
      anomalies.push({
        id: anomalies.length + 1, patient, type: '心率异常波动', type_en: 'Abnormal heart rate fluctuation',
        confidence: Math.min(95, Math.round(70 + spikes.length * 2)),
        detectedAt: day, pattern: `${spikes.length} 次心率超过个人基线+2σ (${Math.round(mean + 2 * sd)} bpm)`,
        pattern_en: `${spikes.length} instances of heart rate exceeding personal baseline +2σ (${Math.round(mean + 2 * sd)} bpm)`,
        aiModel: '统计异常检测', status: 'new',
      });
    }
  });

  days.forEach(day => {
    const spo2s = store.daily[day].spo2;
    const low = spo2s.filter(s => s < 93);
    if (low.length >= 2) {
      anomalies.push({
        id: anomalies.length + 1, patient, type: '血氧偏低事件', type_en: 'Low blood oxygen events',
        confidence: Math.round(75 + low.length * 3),
        detectedAt: day, pattern: `${low.length} 次血氧低于 93%`,
        pattern_en: `${low.length} instances of SpO₂ below 93%`,
        aiModel: '统计异常检测', status: 'investigating',
      });
    }
  });

  return anomalies.slice(-10);
}

function buildPredictions(store) {
  const predictions = [];
  const days = lastNDays(store, 30);
  const stats = buildUiDashboardStats(store);
  const patient = store.meta?.userLabel || '我';
  let id = 1;
  const add = (p) => predictions.push({ id: id++, dataSource: 'real', model: 'MedWear-Predict-v2', ...p });

  if (days.length < 1) return predictions;

  const addBaselineFromStats = () => {
    const score = stats.healthScore || 0;
    if (score > 0 && score < 80) {
      add({
        category: 'training', categoryLabel: CATEGORY_META.training?.label || '综合健康',
        patient, risk: '综合健康评分偏低', probability: Math.min(65, Math.round(100 - score)),
        timeframe: '7天内', horizon: 'short', level: score < 60 ? 'medium' : 'low',
        factors: [`健康评分 ${score} 分`, `${store.meta?.dayCount || days.length} 天真实数据`],
        recommendation: '建议改善睡眠与活动量，必要时咨询全科医生',
      });
    }
    if (stats.restingHR && stats.restingHR > 80) {
      add({
        category: 'cardio', categoryLabel: CATEGORY_META.cardio?.label || '心血管',
        patient, risk: '静息心率偏高', probability: Math.min(55, Math.round((stats.restingHR - 70) * 3)),
        timeframe: '14天内', horizon: 'medium', level: stats.restingHR > 90 ? 'medium' : 'low',
        factors: [`静息心率 ${stats.restingHR} bpm`],
        recommendation: '建议关注压力与睡眠，必要时测量血压',
      });
    }
    if (stats.steps != null && stats.steps < 5000) {
      add({
        category: 'metabolic', categoryLabel: CATEGORY_META.metabolic?.label || '代谢',
        patient, risk: '活动量不足', probability: Math.min(50, Math.round((5000 - stats.steps) / 100)),
        timeframe: '30天内', horizon: 'long', level: stats.steps < 3000 ? 'medium' : 'low',
        factors: [`日均步数 ${stats.steps}`],
        recommendation: '建议逐步增加每日步行至 6000 步以上',
      });
    }
    if (stats.sleepHours && stats.sleepHours < 7) {
      add({
        category: 'sleep', categoryLabel: CATEGORY_META.sleep?.label || '睡眠健康',
        patient, risk: '睡眠时长不足', probability: Math.min(50, Math.round((7 - stats.sleepHours) * 10)),
        timeframe: '7天内', horizon: 'short', level: stats.sleepHours < 6 ? 'medium' : 'low',
        factors: [`睡眠 ${stats.sleepHours} 小时`],
        recommendation: '建议固定作息时间，减少睡前屏幕使用',
      });
    }
  };

  if (days.length < 3) {
    addBaselineFromStats();
    return predictions;
  }

  const rhrTrend = days.map(d => store.daily[d].restingHeartRate || avg(store.daily[d].heartRate)).filter(Boolean);
  if (rhrTrend.length >= 5) {
    const recent = avg(rhrTrend.slice(-7));
    const earlier = avg(rhrTrend.slice(0, 7));
    if (recent && earlier && recent > earlier + 5) {
      add({
        category: 'cardio', categoryLabel: CATEGORY_META.cardio?.label || '心血管',
        patient, risk: '静息心率上升趋势', probability: Math.min(75, Math.round((recent - earlier) * 5)),
        timeframe: '14天内', horizon: 'medium', level: 'medium',
        factors: [`静息心率从 ${Math.round(earlier)} 升至 ${Math.round(recent)} bpm`],
        recommendation: '建议关注压力、睡眠与运动恢复，必要时咨询医生',
      });
    }
  }

  const hrvAll = days.flatMap(d => store.daily[d].hrv);
  if (hrvAll.length >= 10) {
    const recentHrv = avg(hrvAll.slice(-Math.floor(hrvAll.length / 2)));
    const earlierHrv = avg(hrvAll.slice(0, Math.floor(hrvAll.length / 2)));
    if (recentHrv && earlierHrv && recentHrv < earlierHrv * 0.85) {
      add({
        category: 'mental', categoryLabel: CATEGORY_META.mental?.label || '心理/压力',
        patient, risk: 'HRV 下降趋势（压力/疲劳）', probability: Math.min(70, Math.round((1 - recentHrv / earlierHrv) * 100)),
        timeframe: '7天内', horizon: 'short', level: 'medium',
        factors: [`HRV 从 ${Math.round(earlierHrv)}ms 降至 ${Math.round(recentHrv)}ms`],
        recommendation: '建议增加休息，减少高强度训练，关注睡眠质量',
      });
    }
  }

  const stepDays = days.map(d => store.daily[d].steps);
  const lowActivity = stepDays.filter(s => s < 4000).length;
  if (lowActivity >= 3) {
    add({
      category: 'metabolic', categoryLabel: CATEGORY_META.metabolic?.label || '代谢',
      patient, risk: '长期活动不足', probability: Math.min(60, lowActivity * 10),
      timeframe: '30天内', horizon: 'long', level: lowActivity >= 5 ? 'medium' : 'low',
      factors: [`${lowActivity} 天步数低于 4000`],
      recommendation: '建议每日步行至少 6000 步，逐步提升活动量',
    });
  }

  const latest = store.daily[days[days.length - 1]];
  const prev = store.daily[days[days.length - 2]];
  if (latest && prev && latest.steps < prev.steps * 0.5 && latest.steps < 3000) {
    add({
      category: 'infection', categoryLabel: CATEGORY_META.infection?.label || '感染/急性病',
      patient, risk: '感冒/流感样活动骤降', probability: 38, timeframe: '3天内', horizon: 'short', level: 'medium',
      factors: [`步数从 ${Math.round(prev.steps)} 降至 ${Math.round(latest.steps)}`],
      recommendation: '注意休息补水，发热或气促请发热门诊就医',
    });
  }

  const spo2All = days.flatMap(d => store.daily[d].spo2);
  const lowSpo2 = spo2All.filter(s => s < 94).length;
  if (lowSpo2 >= 2) {
    add({
      category: 'respiratory', categoryLabel: CATEGORY_META.respiratory?.label || '呼吸系统',
      patient, risk: '血氧偏低事件增加', probability: Math.min(65, lowSpo2 * 15),
      timeframe: '7天内', horizon: 'short', level: 'medium',
      factors: [`${lowSpo2} 次血氧低于 94%`],
      recommendation: '避免剧烈运动，持续低氧请呼吸科评估',
    });
  }

  const sleepDays = days.map(d => {
    const s = store.daily[d].sleepMinutes;
    return (s.deep + s.rem + s.light) / 60;
  }).filter(h => h > 0);
  if (sleepDays.length >= 5) {
    const recentSleep = avg(sleepDays.slice(-3));
    if (recentSleep && recentSleep < 6) {
      add({
        category: 'sleep', categoryLabel: CATEGORY_META.sleep?.label || '睡眠健康',
        patient, risk: '睡眠不足趋势', probability: Math.min(55, Math.round((7 - recentSleep) * 12)),
        timeframe: '7天内', horizon: 'short', level: 'medium',
        factors: [`近3天平均睡眠 ${recentSleep.toFixed(1)} 小时`],
        recommendation: '提前入睡，减少睡前屏幕时间',
      });
    }
  }

  if (!predictions.length) addBaselineFromStats();

  return predictions;
}

function buildSleepData(store) {
  const days = lastNDays(store, 1);
  const day = days[days.length - 1];
  if (!day) return null;

  const sleep = store.daily[day].sleepMinutes;
  const totalMin = sleep.deep + sleep.rem + sleep.light;
  const totalSleep = totalMin / 60;
  const deepSleep = sleep.deep / 60;
  const remSleep = sleep.rem / 60;
  const lightSleep = sleep.light / 60;
  const inBed = sleep.inBed || totalMin + sleep.awake;
  const efficiency = inBed > 0 ? Math.round((totalMin / inBed) * 100) : 0;
  const sleepScore = totalSleep > 0 ? Math.min(100, Math.round(totalSleep / 8 * 70 + (sleep.deep / totalMin) * 30)) : 0;

  const sessions = store.sleepSessions.filter(s => s.day === day);
  const stageByHour = {};
  sessions.forEach(s => {
    const h = new Date(s.startDate.replace(' ', 'T')).getHours();
    const key = `${String(h).padStart(2, '0')}:00`;
    if (!stageByHour[key]) stageByHour[key] = { time: key, deep: 0, light: 0, rem: 0, awake: 0 };
    stageByHour[key][s.stage === 'inBed' ? 'light' : s.stage] += s.durationMin;
  });
  const stages = Object.values(stageByHour).sort((a, b) => a.time.localeCompare(b.time));

  const insights = [];
  if (totalSleep >= 7) insights.push(`总睡眠 ${totalSleep.toFixed(1)} 小时，达到推荐时长`);
  else if (totalSleep > 0) insights.push(`总睡眠 ${totalSleep.toFixed(1)} 小时，建议增加至 7-8 小时`);
  if (totalMin > 0 && sleep.deep / totalMin >= 0.2) insights.push(`深睡占比 ${Math.round(sleep.deep / totalMin * 100)}%，表现良好`);
  if (sleep.awake > 30) insights.push(`检测到 ${Math.round(sleep.awake)} 分钟清醒时间，可能影响睡眠连续性`);
  if (insights.length === 0) insights.push('暂无睡眠数据，请确保 Apple Watch 开启睡眠跟踪');

  return {
    overview: { totalSleep: +totalSleep.toFixed(1), deepSleep: +deepSleep.toFixed(1), remSleep: +remSleep.toFixed(1), lightSleep: +lightSleep.toFixed(1), sleepScore, efficiency },
    stages: stages.length ? stages : [{ time: '—', deep: 0, light: 0, rem: 0, awake: 0 }],
    aiInsights: insights,
    dataSource: 'real',
  };
}

function buildDigitalTwin(store) {
  const day = getTodayOrLatest(store);
  const d = day ? store.daily[day] : null;
  const patient = store.meta?.userLabel || '我';
  const hr = d ? Math.round(avg(d.heartRate) || d.restingHeartRate || 0) : 0;
  const hrv = d ? Math.round(avg(d.hrv) || 0) : 0;
  const spo2 = d ? +(avg(d.spo2) || 0).toFixed(1) : 0;
  const sleepH = d ? +((d.sleepMinutes.deep + d.sleepMinutes.rem + d.sleepMinutes.light) / 60).toFixed(1) : 0;
  const steps = d ? Math.round(d.steps) : 0;
  const energy = d ? Math.round(d.activeEnergy) : 0;

  const organs = [
    { name: '心脏', status: hr > 90 || hr < 50 ? 'warning' : 'normal', score: hr ? Math.max(40, 100 - Math.abs(hr - 70)) : 0, metrics: { hr, hrv, 心律: '来自 Apple Watch' } },
    { name: '肺部', status: spo2 && spo2 < 95 ? 'warning' : 'normal', score: spo2 ? Math.min(100, Math.round(spo2)) : 0, metrics: { spo2, 呼吸: d ? Math.round(avg(d.respiratoryRate) || 0) : 0 } },
    { name: '活动', status: steps >= 6000 ? 'normal' : 'warning', score: Math.min(100, Math.round(steps / 100)), metrics: { steps, calories: energy } },
    { name: '睡眠', status: sleepH >= 7 ? 'normal' : sleepH > 0 ? 'warning' : 'normal', score: sleepH ? Math.min(100, Math.round(sleepH / 8 * 100)) : 0, metrics: { duration: sleepH } },
    { name: '压力', status: hrv && hrv < 30 ? 'warning' : 'normal', score: hrv ? Math.min(100, Math.round(hrv)) : 50, metrics: { hrv } },
  ].filter(o => o.score > 0 || day);

  const overallScore = day ? computeDayScore(d) || 0 : 0;
  return { patient, age: null, organs, overallScore, dataSource: 'real' };
}

function buildHealthGoals(store) {
  const day = getTodayOrLatest(store);
  const d = day ? store.daily[day] : null;
  if (!d) return [];

  const sleepH = (d.sleepMinutes.deep + d.sleepMinutes.rem + d.sleepMinutes.light) / 60;
  const deepH = d.sleepMinutes.deep / 60;
  const rhr = d.restingHeartRate || avg(d.heartRate);
  const spo2 = avg(d.spo2);

  return [
    { id: 1, title: '每日步数', type: 'steps', description: 'WHO 建议每日 8000 步', current: Math.round(d.steps), target: 8000, unit: '步', progress: Math.min(100, Math.round(d.steps / 8000 * 100)), points: 50 },
    { id: 2, title: '睡眠时长', type: 'sleep', description: '成人推荐 7-8 小时', current: +sleepH.toFixed(1), target: 8, unit: '小时', progress: sleepH ? Math.min(100, Math.round(sleepH / 8 * 100)) : 0, points: 30 },
    { id: 3, title: '静息心率', type: 'heartRate', description: '健康范围 50-80 bpm', current: rhr ? Math.round(rhr) : 0, target: 70, unit: 'bpm', progress: rhr ? Math.max(0, 100 - Math.abs(rhr - 70) * 3) : 0, points: 40 },
    { id: 4, title: '血氧达标', type: 'spo2', description: '维持 SpO2 ≥ 95%', current: spo2 ? +spo2.toFixed(1) : 0, target: 95, unit: '%', progress: spo2 ? Math.min(100, Math.round(spo2)) : 0, points: 20 },
    { id: 5, title: '深度睡眠', type: 'sleep', description: '深睡 ≥ 1.5 小时', current: +deepH.toFixed(1), target: 1.5, unit: '小时', progress: deepH ? Math.min(100, Math.round(deepH / 1.5 * 100)) : 0, points: 35 },
  ];
}

function buildFusionSources(store) {
  const list = store.meta?.sourceList || [];
  const total = list.reduce((s, x) => s + x.count, 0) || 1;
  const colors = ['#1565C0', '#00838F', '#6A1B9A', '#E65100', '#2E7D32'];
  return list.slice(0, 5).map((s, i) => ({
    device: s.name,
    metrics: inferMetrics(s.name),
    metrics_en: inferMetricsEn(s.name),
    weight: +(s.count / total).toFixed(2),
    quality: Math.min(99, 85 + Math.floor(s.count / total * 14)),
    color: colors[i % colors.length],
  }));
}

function inferMetrics(sourceName) {
  const m = [];
  if (/watch|手表/i.test(sourceName)) m.push('心率', '血氧', '步数', '睡眠', 'HRV');
  else if (/iphone|手机/i.test(sourceName)) m.push('步数', '距离');
  else m.push('健康数据');
  return m;
}

function inferMetricsEn(sourceName) {
  const m = [];
  if (/watch|手表/i.test(sourceName)) m.push('Heart rate', 'SpO₂', 'Steps', 'Sleep', 'HRV');
  else if (/iphone|手机/i.test(sourceName)) m.push('Steps', 'Distance');
  else m.push('Health data');
  return m;
}

function buildDevices(store) {
  const list = store.meta?.sourceList || [];
  const day = getTodayOrLatest(store);
  return list.filter(s => /watch|ring|手环|patch|血糖|sleep/i.test(s.name)).slice(0, 6).map((s, i) => ({
    id: i + 1,
    name: s.name,
    type: /watch|手表/i.test(s.name) ? '智能手表' : /ring|戒指/i.test(s.name) ? '智能戒指' : '健康设备',
    serial: `AH-${i + 1}`,
    patient: store.meta?.userLabel || '我',
    status: 'online',
    battery: null,
    lastSync: store.meta?.importedAt?.slice(0, 16).replace('T', ' ') || day,
    firmware: s.productType || 'Apple Health',
    metrics: inferMetrics(s.name),
    recordCount: s.count,
  })).concat(list.length === 0 ? [] : list.slice(0, 1).map((s, i) => ({
    id: 1, name: s.name, type: 'Apple Health 数据源', serial: 'LOCAL',
    patient: store.meta?.userLabel || '我', status: 'online', battery: null,
    lastSync: store.meta?.importedAt?.slice(0, 16).replace('T', ' '),
    firmware: 'Health Export', metrics: inferMetrics(s.name), recordCount: s.count,
  })));
}

function buildPatients(store) {
  const day = getTodayOrLatest(store);
  const d = day ? store.daily[day] : null;
  const score = d ? computeDayScore(d) : null;
  const alerts = detectAlerts(store);
  return [{
    id: 1,
    name: store.meta?.userLabel || '我',
    gender: '—',
    age: null,
    phone: '—',
    healthScore: score || 0,
    devices: (store.meta?.sourceList || []).length,
    conditions: alerts.filter(a => a.severity === 'high' || a.severity === 'critical').map(a => a.type).slice(0, 3),
    lastActive: day || '—',
    riskLevel: score >= 80 ? 'low' : score >= 60 ? 'medium' : 'high',
    dataSource: 'real',
  }];
}

function buildDashboardStats(store) {
  const days = sortedDays(store);
  const totalRecords = store.meta?.parsedRecords || 0;
  const day = getTodayOrLatest(store);
  const d = day ? store.daily[day] : null;
  const scores = days.map(dayKey => computeDayScore(store.daily[dayKey])).filter(Boolean);
  return {
    totalDevices: (store.meta?.sourceList || []).length,
    activeDevices: (store.meta?.sourceList || []).length,
    totalPatients: 1,
    activeAlerts: detectAlerts(store).filter(a => a.status === 'pending').length,
    dataPointsToday: d ? d.heartRate.length + d.spo2.length + d.steps : totalRecords,
    avgHealthScore: scores.length ? +(avg(scores).toFixed(1)) : 0,
    anomalyRate: detectAnomalies(store).length > 0 ? +((detectAnomalies(store).length / Math.max(days.length, 1)) * 100).toFixed(1) : 0,
    deviceUptime: 100,
    dataSource: 'real',
    lastImport: store.meta?.importedAt,
    dateRange: store.meta?.dateRange,
  };
}

function buildVitalsTrend(store) {
  const day = getTodayOrLatest(store);
  if (!day) return [];
  const d = store.daily[day];
  const buckets = {};
  for (let h = 0; h < 24; h += 4) {
    buckets[h] = { time: `${String(h).padStart(2, '0')}:00`, heartRate: null, bloodOxygen: null, steps: 0 };
  }
  store.recent.heartRate.filter(r => r.day === day).forEach(r => {
    const h = Math.floor(r.hour / 4) * 4;
    if (!buckets[h].heartRate) buckets[h].heartRate = [];
    buckets[h].heartRate.push(r.value);
  });
  store.recent.spo2.filter(r => r.day === day).forEach(r => {
    const h = Math.floor((r.hour || 0) / 4) * 4;
    if (!buckets[h].bloodOxygen) buckets[h].bloodOxygen = [];
    buckets[h].bloodOxygen.push(r.value);
  });
  return Object.values(buckets).map(b => ({
    time: b.time,
    heartRate: b.heartRate ? Math.round(avg(b.heartRate)) : null,
    bloodOxygen: b.bloodOxygen ? Math.round(avg(b.bloodOxygen)) : null,
    steps: Math.round(d.steps / 6),
  })).filter(b => b.heartRate || b.bloodOxygen);
}

function buildHealthScoreTrend(store) {
  const days = lastNDays(store, 180);
  const byMonth = {};
  days.forEach(day => {
    const m = day.slice(0, 7);
    const score = computeDayScore(store.daily[day]);
    if (score) {
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(score);
    }
  });
  return Object.entries(byMonth).slice(-6).map(([m, scores]) => ({
    month: `${parseInt(m.slice(5))}月`,
    score: Math.round(avg(scores)),
  }));
}

function buildDeviceDistribution(store) {
  const list = store.meta?.sourceList || [];
  const total = list.reduce((s, x) => s + x.count, 0) || 1;
  const colors = ['#1565C0', '#00838F', '#6A1B9A', '#E65100', '#2E7D32'];
  return list.slice(0, 5).map((s, i) => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
    value: Math.round(s.count / total * 100),
    color: colors[i % colors.length],
  }));
}

function buildRealtimeVitals(store) {
  const day = getTodayOrLatest(store);
  const d = day ? store.daily[day] : null;
  const recentHR = store.recent.heartRate.slice(-8).map(r => r.value);
  const recentSpo2 = store.recent.spo2.slice(-8).map(r => r.value);
  const hr = recentHR.length ? recentHR[recentHR.length - 1] : (d ? Math.round(avg(d.heartRate)) : null);
  const spo2 = recentSpo2.length ? recentSpo2[recentSpo2.length - 1] : (d ? avg(d.spo2) : null);

  return {
    heartRate: { value: hr, unit: 'bpm', trend: 'stable', history: recentHR },
    bloodOxygen: { value: spo2 ? Math.round(spo2) : null, unit: '%', trend: 'stable', history: recentSpo2 },
    bloodPressure: { systolic: null, diastolic: null, unit: 'mmHg', trend: 'unknown', note: 'Apple Health 导出通常不含血压，需手动记录' },
    temperature: { value: null, unit: '°C', trend: 'unknown' },
    glucose: { value: null, unit: 'mmol/L', trend: 'unknown', note: '未检测到血糖数据' },
    hrv: { value: d ? Math.round(avg(d.hrv) || 0) : null, unit: 'ms', trend: d && avg(d.hrv) > 40 ? 'good' : 'stable' },
    steps: { value: d ? Math.round(d.steps) : 0, target: 8000, unit: '步' },
    calories: { value: d ? Math.round(d.activeEnergy) : 0, target: 500, unit: 'kcal' },
    dataSource: 'real',
    dataDay: day,
  };
}

function buildAiSummary(store) {
  const day = getTodayOrLatest(store);
  const d = day ? store.daily[day] : null;
  if (!d) return '尚未导入健康数据。请从 iPhone 导出 Apple Health 数据并导入平台。';
  const score = computeDayScore(d);
  const hr = avg(d.heartRate);
  const spo2 = avg(d.spo2);
  const sleepH = (d.sleepMinutes.deep + d.sleepMinutes.rem + d.sleepMinutes.light) / 60;
  return `【真实数据分析 - ${day}】\n健康评分：${score || '—'} 分\n` +
    `步数：${Math.round(d.steps)} 步 | 活动消耗：${Math.round(d.activeEnergy)} kcal\n` +
    `平均心率：${hr ? Math.round(hr) : '—'} bpm | 血氧：${spo2 ? spo2.toFixed(1) : '—'}%\n` +
    `睡眠：${sleepH ? sleepH.toFixed(1) : '—'} 小时 | HRV：${avg(d.hrv) ? Math.round(avg(d.hrv)) : '—'} ms\n` +
    `数据来源：${getPrimarySource(store)}（Apple Health 本地解析，数据不上传云端）`;
}

function getDataStatus() {
  const store = getStore();
  return {
    hasData: hasData(),
    meta: store.meta,
    primarySource: hasData() ? getPrimarySource(store) : null,
  };
}

function getEmptyAnalytics() {
  const emptyVitals = {
    hasData: false,
    heartRate: { value: null, unit: 'bpm', trend: 'stable', history: [] },
    bloodOxygen: { value: null, unit: '%', trend: 'stable', history: [] },
    bloodPressure: { systolic: null, diastolic: null, unit: 'mmHg', trend: 'unknown' },
    temperature: { value: null, unit: '°C', trend: 'unknown' },
    glucose: { value: null, unit: 'mmol/L', trend: 'unknown' },
    hrv: { value: null, unit: 'ms', trend: 'stable' },
    steps: { value: 0, target: 8000, unit: '步' },
    calories: { value: 0, target: 500, unit: 'kcal' },
    dataSource: 'none',
    dataDay: null,
  };
  const emptyUiStats = {
    hasData: false,
    healthScore: 0,
    healthGrade: '—',
    heartRate: null,
    restingHR: null,
    spo2: null,
    hrv: null,
    steps: 0,
    stepsTarget: 8000,
    sleepHours: null,
    activeCalories: 0,
    activeCaloriesTarget: 500,
    standHours: 0,
    exerciseMinutes: 0,
    stressLevel: '—',
    recoveryScore: 0,
    dataQuality: 0,
    dataSource: 'none',
  };
  return {
    hasData: false,
    meta: null,
    dashboard: {
      stats: emptyUiStats,
      vitalsTrend: [],
      weekTrend: [],
      organScores: [],
      deviceDistribution: [],
      healthScoreTrend: [],
      recentAlerts: [],
    },
    devices: [],
    patients: [],
    alerts: [],
    vitals: emptyVitals,
    anomalies: [],
    predictions: [],
    sleep: {
      hasData: false,
      overview: { totalSleep: 0, deepSleep: 0, remSleep: 0, lightSleep: 0, sleepScore: 0, efficiency: 0 },
      stages: [],
      aiInsights: ['请先导入 Apple Health 数据'],
      dataSource: 'none',
    },
    digitalTwin: { hasData: false, patient: '—', age: null, organs: [], overallScore: 0, dataSource: 'none' },
    fusionSources: [],
    healthGoals: [],
    recovery: { hasData: false, score: 0, stress: { level: '—', score: 0 }, readiness: { score: 0, recommendation: '请先导入 Apple Health 数据' }, dataSource: 'none' },
    aiReport: { hasData: false, summary: '请先导入 Apple Health 数据', sections: [], dataSource: 'none' },
    screening: { hasData: false, needsImport: true, dataSource: 'none' },
    doctorReport: { hasData: false, needsImport: true, dataSource: 'none' },
    aiSummary: '尚未导入健康数据。',
  };
}

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function gradeFromScore(score) {
  if (!score) return '—';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function buildUiDashboardStats(store) {
  const day = getTodayOrLatest(store);
  const d = day ? store.daily[day] : null;
  if (!d) return getEmptyAnalytics().dashboard.stats;
  const score = computeDayScore(d) || 0;
  const hr = avg(d.heartRate);
  const rhr = d.restingHeartRate || hr;
  const spo2 = avg(d.spo2);
  const hrv = avg(d.hrv);
  const sleepH = (d.sleepMinutes.deep + d.sleepMinutes.rem + d.sleepMinutes.light) / 60;
  const recoveryScore = Math.min(100, Math.round((hrv ? hrv / 60 * 50 : 25) + (sleepH ? Math.min(sleepH / 8, 1) * 50 : 0)));
  const stressLevel = hrv && hrv < 30 ? '高' : hrv && hrv < 45 ? '中' : '低';
  return {
    hasData: true,
    healthScore: score,
    healthGrade: gradeFromScore(score),
    heartRate: hr ? Math.round(hr) : null,
    restingHR: rhr ? Math.round(rhr) : null,
    spo2: spo2 ? Math.round(spo2) : null,
    hrv: hrv ? Math.round(hrv) : null,
    steps: Math.round(d.steps),
    stepsTarget: 8000,
    sleepHours: sleepH ? +sleepH.toFixed(1) : null,
    activeCalories: Math.round(d.activeEnergy),
    activeCaloriesTarget: 500,
    standHours: Math.min(12, Math.round(d.steps / 800)),
    exerciseMinutes: Math.round(d.exerciseMinutes || d.activeEnergy / 8),
    stressLevel,
    recoveryScore,
    dataQuality: Math.min(99, 70 + (store.meta?.dayCount || 0)),
    dataSource: 'real',
    dataDay: day,
  };
}

function buildWeekTrend(store) {
  const days = lastNDays(store, 7);
  return days.map(dayKey => {
    const d = store.daily[dayKey];
    const date = new Date(dayKey);
    return {
      day: DAY_NAMES[date.getDay()],
      date: dayKey,
      healthScore: computeDayScore(d) || 0,
      steps: Math.round(d.steps),
      sleep: +((d.sleepMinutes.deep + d.sleepMinutes.rem + d.sleepMinutes.light) / 60).toFixed(1),
      heartRate: d.restingHeartRate ? Math.round(d.restingHeartRate) : Math.round(avg(d.heartRate) || 0),
    };
  });
}

function buildOrganScores(store) {
  const twin = buildDigitalTwin(store);
  const nameMap = { 心脏: '心血管', 肺部: '呼吸系统', 活动: '运动代谢', 睡眠: '睡眠恢复', 压力: '压力调节' };
  return twin.organs.map(o => ({
    name: nameMap[o.name] || o.name,
    score: Math.round(o.score),
    status: o.status === 'normal' ? 'good' : 'watch',
  }));
}

function buildRecoveryData(store) {
  const day = getTodayOrLatest(store);
  const d = day ? store.daily[day] : null;
  if (!d) return getEmptyAnalytics().recovery;
  const hrv = avg(d.hrv);
  const sleepH = (d.sleepMinutes.deep + d.sleepMinutes.rem + d.sleepMinutes.light) / 60;
  const score = Math.min(100, Math.round((hrv ? hrv / 60 * 45 : 20) + (sleepH ? Math.min(sleepH / 8, 1) * 55 : 10)));
  const stressScore = hrv ? Math.max(0, Math.round(100 - hrv)) : 50;
  const stressLevel = stressScore > 70 ? '高' : stressScore > 45 ? '中' : '低';
  const readiness = score >= 75 ? '适合正常训练' : score >= 55 ? '建议中等强度活动' : '建议休息恢复';
  return {
    hasData: true,
    score,
    stress: { level: stressLevel, score: stressScore },
    readiness: { score, recommendation: readiness },
    hrvTrend: lastNDays(store, 7).map(dayKey => ({
      day: dayKey.slice(5),
      value: Math.round(avg(store.daily[dayKey].hrv) || 0),
    })),
    dataSource: 'real',
  };
}

function buildRealAiReport(store) {
  const summary = buildAiSummary(store);
  const day = getTodayOrLatest(store);
  const d = day ? store.daily[day] : null;
  if (!d) return getEmptyAnalytics().aiReport;
  const score = computeDayScore(d) || 0;
  return {
    hasData: true,
    generatedAt: new Date().toISOString(),
    summary,
    overallScore: score,
    sections: [
      { title: '活动与代谢', content: `今日步数 ${Math.round(d.steps)} 步，活动消耗 ${Math.round(d.activeEnergy)} kcal。`, score: Math.min(100, Math.round(d.steps / 80)) },
      { title: '心血管', content: `平均心率 ${Math.round(avg(d.heartRate) || 0)} bpm，HRV ${Math.round(avg(d.hrv) || 0)} ms。`, score: Math.min(100, Math.round(avg(d.hrv) || 50)) },
      { title: '睡眠恢复', content: `睡眠 ${((d.sleepMinutes.deep + d.sleepMinutes.rem + d.sleepMinutes.light) / 60).toFixed(1)} 小时。`, score: Math.min(100, Math.round(((d.sleepMinutes.deep + d.sleepMinutes.rem + d.sleepMinutes.light) / 60 / 8) * 100)) },
    ],
    dataSource: 'real',
  };
}

function buildRealScreening(store) {
  if (!store || !hasData()) {
    return {
      hasData: false,
      needsImport: true,
      mode: 'real',
      aiVersion: 'MedWear-AI v3.0 · 真实模式',
      dataCoverage: { days: 0, samples: 0, devices: 0, quality: 0 },
      summary: '真实模式：请先导入 Apple Health 数据。导入后将基于您的真实心率、血氧、睡眠等计算筛查风险，不会使用任何模拟数据。',
      summary_en: 'Real mode: please import Apple Health data first. Once imported, screening risk will be computed from your real heart rate, SpO₂, sleep, and more, with no simulated data used.',
      overallRisk: 'unknown',
      overallScore: 0,
      categories: [],
      biomarkers: [],
      recommendedExams: [],
      recommendedExams_en: [],
    };
  }
  const stats = buildUiDashboardStats(store);
  const anomalies = detectAnomalies(store);
  const predictions = buildPredictions(store);
  const dayCount = store.meta?.dayCount || Object.keys(store.daily || {}).length;
  const overallScore = stats.healthScore ?? 0;
  const overallRisk = !dayCount || stats.healthScore == null
    ? 'unknown'
    : overallScore >= 80 ? 'low' : overallScore >= 60 ? 'moderate' : 'high';
  const biomarkers = [
    { name: '静息心率', name_en: 'Resting heart rate', value: stats.restingHR, unit: 'bpm', source: 'Apple Health 真实', source_en: 'Apple Health (real)', ref: '60-80', status: stats.restingHR > 85 ? 'watch' : 'normal' },
    { name: '血氧饱和度', name_en: 'Blood oxygen saturation', value: stats.spo2, unit: '%', source: 'Apple Health 真实', source_en: 'Apple Health (real)', ref: '≥95', status: stats.spo2 && stats.spo2 < 95 ? 'watch' : 'normal' },
    { name: 'HRV', name_en: 'HRV', value: stats.hrv, unit: 'ms', source: 'Apple Health 真实', source_en: 'Apple Health (real)', ref: '20-70', status: 'normal' },
    { name: '日均步数', name_en: 'Daily steps', value: stats.steps, unit: '步', source: 'Apple Health 真实', source_en: 'Apple Health (real)', ref: '≥6000', status: stats.steps < 4000 ? 'watch' : 'normal' },
    { name: '睡眠时长', name_en: 'Sleep duration', value: stats.sleepHours, unit: 'h', source: 'Apple Health 真实', source_en: 'Apple Health (real)', ref: '7-9', status: stats.sleepHours && stats.sleepHours < 6 ? 'watch' : 'normal' },
  ].filter(b => b.value != null);
  return {
    hasData: true,
    needsImport: false,
    mode: 'real',
    aiVersion: 'MedWear-AI v3.0 · 真实数据',
    dataCoverage: {
      days: store.meta?.dayCount || 0,
      samples: store.meta?.parsedRecords || 0,
      devices: Object.keys(store.sources || {}).length,
      quality: stats.dataQuality,
    },
    summary: `基于您 ${store.meta?.dayCount || 0} 天 Apple Health 真实数据的全品类 AI 筛查（肿瘤/癌症/慢病/心脑血管/常见小病/呼吸），非模拟数据。`,
    summary_en: `Full-category AI screening based on your ${store.meta?.dayCount || 0} days of real Apple Health data (tumor / cancer / chronic disease / cardio-cerebrovascular / common ailments / respiratory), not simulated data.`,
    overallRisk,
    overallScore,
    overallScoreType: 'health',
    biomarkers,
    categories: buildRealScreeningCategories(store, stats, anomalies),
    trendData: buildRealTrendData(store),
    aiInsights: [
      { type: 'info', text: `已覆盖 6 大类 ${buildRealScreeningCategories(store, stats, anomalies).reduce((n, c) => n + c.items.length, 0)} 项筛查（含感冒/流感等常见小病预警）`, text_en: `Covers 6 categories and ${buildRealScreeningCategories(store, stats, anomalies).reduce((n, c) => n + c.items.length, 0)} screening items (including common ailment alerts such as cold/flu)` },
      { type: anomalies.length ? 'warning' : 'positive', text: anomalies.length ? `检测到 ${anomalies.length} 项统计异常，建议关注` : '当前无重大异常信号', text_en: anomalies.length ? `Detected ${anomalies.length} statistical anomalies; attention advised` : 'No significant abnormal signals at present' },
    ],
    anomalies: anomalies.slice(0, 5),
    predictions: predictions.slice(0, 6),
    recommendedExams: getRecommendedExams(),
    recommendedExams_en: getRecommendedExamsEn(),
  };
}

function buildRealDoctorReport(store) {
  if (!hasData()) {
    return {
      hasData: false,
      needsImport: true,
      mode: 'real',
      message: '请先导入 Apple Health 数据后生成医生报告',
    };
  }
  const stats = buildUiDashboardStats(store);
  const screening = buildRealScreening(store);
  return {
    hasData: true,
    mode: 'real',
    reportId: `MR-REAL-${Date.now().toString(36).toUpperCase()}`,
    generatedAt: new Date().toISOString(),
    reportType: 'Apple Health 真实数据 · 可穿戴临床报告',
    reportType_en: 'Apple Health Real Data · Wearable Clinical Report',
    patient: {
      name: store.meta?.userLabel || 'Apple Health 用户',
      id: 'REAL-001',
      age: null,
      gender: '—',
      device: getPrimarySource(store),
    },
    physicianSummary: `【真实 Apple Health 数据】${buildAiSummary(store)}`,
    physicianSummary_en: `[Real Apple Health data] ${screening.summary_en}`,
    overallRisk: screening.overallRisk,
    overallScore: screening.overallScore,
    vitalsSnapshot: [
      { label: '静息心率', label_en: 'Resting HR', value: stats.restingHR, unit: 'bpm', ref: '60-80', flag: stats.restingHR > 85 || stats.restingHR < 50 ? 'watch' : 'normal' },
      { label: '当前心率', label_en: 'Current HR', value: stats.heartRate, unit: 'bpm', ref: '60-100', flag: 'normal' },
      { label: '血氧', label_en: 'SpO₂', value: stats.spo2, unit: '%', ref: '≥95', flag: stats.spo2 && stats.spo2 < 95 ? 'watch' : 'normal' },
      { label: 'HRV', label_en: 'HRV', value: stats.hrv, unit: 'ms', ref: '20-70', flag: stats.hrv && stats.hrv < 20 ? 'watch' : 'normal' },
      { label: '睡眠（最近）', label_en: 'Sleep (recent)', value: stats.sleepHours, unit: 'h', ref: '7-9', flag: stats.sleepHours && stats.sleepHours < 6 ? 'watch' : 'normal' },
      { label: '步数（今日）', label_en: 'Steps (today)', value: stats.steps, unit: '步', ref: '≥6000', flag: stats.steps < 4000 ? 'watch' : 'normal' },
    ],
    weekTrend: buildWeekTrend(store),
    screeningHighlights: screening.categories.flatMap(c =>
      c.items.filter(i => i.level !== 'low').map(i => ({
        category: c.name, category_en: c.name_en, name: i.name, name_en: i.name_en, risk: i.risk, level: i.level, recommendation: i.recommendation, recommendation_en: i.recommendation_en,
      }))
    ),
    screeningSummary: screening.categories.map(c => ({
      name: c.name, name_en: c.name_en, riskLevel: c.riskLevel,
      score: c.score, healthScore: c.healthScore ?? Math.max(55, 100 - (c.score || 0)),
      topItems: c.items.map(i => `${i.name} ${i.risk}%`),
    })),
    overallScoreType: screening.overallScoreType || 'health',
    dataCoverage: screening.dataCoverage,
    biomarkers: screening.biomarkers,
    anomalies: detectAnomalies(store),
    predictions: buildPredictions(store).slice(0, 8),
    alerts: detectAlerts(store).slice(0, 3),
    dataSources: buildFusionSources(store),
    recommendedExams: screening.recommendedExams,
    recommendedExams_en: screening.recommendedExams_en,
    clinicalNotes: [
      '本报告基于本地导入的 Apple Health 真实数据生成，不含任何模拟/demo 数据',
      '风险评估不能替代病理学或影像学诊断',
      '数据日期范围：' + (store.meta?.dateRange?.start || '?') + ' ~ ' + (store.meta?.dateRange?.end || '?'),
    ],
    clinicalNotes_en: [
      'This report is generated from locally imported real Apple Health data and contains no simulated/demo data',
      'Risk assessment cannot replace pathological or imaging diagnosis',
      'Data date range: ' + (store.meta?.dateRange?.start || '?') + ' ~ ' + (store.meta?.dateRange?.end || '?'),
    ],
    qrCode: 'MEDWEAR-REAL-REPORT',
  };
}

function getAllAnalytics(thresholds) {
  const store = getStore();
  if (!hasData()) return getEmptyAnalytics();
  return {
    hasData: true,
    meta: store.meta,
    dashboard: {
      stats: buildUiDashboardStats(store),
      vitalsTrend: buildVitalsTrend(store),
      weekTrend: buildWeekTrend(store),
      organScores: buildOrganScores(store),
      deviceDistribution: buildDeviceDistribution(store),
      healthScoreTrend: buildHealthScoreTrend(store),
      recentAlerts: detectAlerts(store, thresholds),
    },
    devices: buildDevices(store),
    patients: buildPatients(store),
    alerts: detectAlerts(store, thresholds),
    vitals: buildRealtimeVitals(store),
    anomalies: detectAnomalies(store),
    predictions: buildPredictions(store),
    sleep: buildSleepData(store),
    digitalTwin: buildDigitalTwin(store),
    fusionSources: buildFusionSources(store),
    healthGoals: buildHealthGoals(store),
    recovery: buildRecoveryData(store),
    aiReport: buildRealAiReport(store),
    screening: buildRealScreening(store),
    aiSummary: buildAiSummary(store),
  };
}

module.exports = {
  getDataStatus,
  getAllAnalytics,
  getEmptyAnalytics,
  buildAiSummary,
  buildRealtimeVitals,
  buildUiDashboardStats,
  buildWeekTrend,
  buildOrganScores,
  buildRecoveryData,
  buildRealAiReport,
  buildRealScreening,
  buildRealDoctorReport,
  detectAlerts,
  getPrimarySource,
  computeDayScore,
};
