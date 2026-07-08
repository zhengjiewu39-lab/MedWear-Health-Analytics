/**
 * MedWear PHM — structured surveillance reports for public-health departments.
 * Returns JSON payloads (snake_case) with Chinese narratives for dashboard rendering.
 */

const {
  ALERT_LEVEL_META,
  SYMPTOM_TYPES,
  SYNDROME_TYPES,
  STAKEHOLDER_ROLES,
  PHM_ENGINE_VERSION,
  EPIDEMIOLOGY_DEFAULTS,
} = require('./constants');

/** @typedef {import('./types').User} User */
/** @typedef {import('./types').Anomaly} Anomaly */
/** @typedef {import('./types').PublicHealthAlert} PublicHealthAlert */
/** @typedef {import('./cluster-detection').DetectedCluster} DetectedCluster */

/**
 * @typedef {Object} DistrictMeta
 * @property {string} district_id
 * @property {string} district_name
 * @property {number} total_population - Census / registry denominator
 */

/**
 * @typedef {Object} ReportingDataSource
 * @property {User[] | Map<string, User>} [users]
 * @property {Anomaly[]} [anomalies]
 * @property {DetectedCluster[]} [clusters]
 * @property {PublicHealthAlert[]} [alerts]
 * @property {Record<string, DistrictMeta>} [districts]
 */

const SYMPTOM_LABELS_ZH = {
  [SYMPTOM_TYPES.FEVER]: '发热',
  [SYMPTOM_TYPES.COUGH]: '咳嗽',
  [SYMPTOM_TYPES.SHORTNESS_OF_BREATH]: '呼吸急促',
  [SYMPTOM_TYPES.FATIGUE]: '疲劳',
  [SYMPTOM_TYPES.ACTIVITY_DROP]: '活动量骤降',
  [SYMPTOM_TYPES.TACHYCARDIA]: '心动过速',
  [SYMPTOM_TYPES.BRADYCARDIA]: '心动过缓',
  [SYMPTOM_TYPES.HYPOXEMIA]: '血氧偏低',
  [SYMPTOM_TYPES.SLEEP_DISRUPTION]: '睡眠紊乱',
  [SYMPTOM_TYPES.GI_SYMPTOMS]: '胃肠道症状',
  [SYMPTOM_TYPES.HEADACHE]: '头痛',
  [SYMPTOM_TYPES.SORE_THROAT]: '咽痛',
};

const SYNDROME_LABELS_ZH = {
  [SYNDROME_TYPES.RESPIRATORY]: '呼吸系统',
  [SYNDROME_TYPES.FEBRILE]: '发热样',
  [SYNDROME_TYPES.GASTROINTESTINAL]: '胃肠道',
  [SYNDROME_TYPES.NEUROLOGICAL]: '神经系统',
  [SYNDROME_TYPES.UNSPECIFIED]: '未分类',
};

const SES_LABELS_ZH = { low: '低 SES', medium: '中 SES', high: '高 SES', unknown: '未知' };

/** @param {number} n @returns {number} */
function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

/** @param {number[]} arr @returns {number} */
function avg(arr) {
  if (!arr?.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/** @param {string} dateStr YYYY-MM-DD */
function dayStartMs(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`).getTime();
}

/** @param {string} dateStr YYYY-MM-DD */
function dayEndMs(dateStr) {
  return new Date(`${dateStr}T23:59:59.999Z`).getTime();
}

/** @param {User[] | Map<string, User>} users @returns {User[]} */
function toUserList(users) {
  if (!users) return [];
  return users instanceof Map ? [...users.values()] : users;
}

class PublicHealthReporting {
  /**
   * @param {ReportingDataSource} [data]
   */
  constructor(data = {}) {
    this.users = toUserList(data.users);
    this.anomalies = data.anomalies || [];
    this.clusters = data.clusters || [];
    this.alerts = data.alerts || [];
    this.districts = data.districts || {};
  }

  /**
   * Replace in-memory reporting dataset (batch / API refresh).
   * @param {ReportingDataSource} data
   */
  setData(data) {
    if (data.users !== undefined) this.users = toUserList(data.users);
    if (data.anomalies !== undefined) this.anomalies = data.anomalies;
    if (data.clusters !== undefined) this.clusters = data.clusters;
    if (data.alerts !== undefined) this.alerts = data.alerts;
    if (data.districts !== undefined) this.districts = data.districts;
  }

  /**
   * A) Daily district surveillance report.
   * @param {string} date - YYYY-MM-DD
   * @param {string} district - District id
   * @returns {object}
   */
  generateDailyReport(date, district) {
    const districtMeta = this._districtMeta(district);
    const dayUsers = this._usersInDistrict(district);
    const dayAnomalies = this._anomaliesOnDate(date, district);
    const dayClusters = this._clustersOnDate(date, district);
    const dayAlerts = this._alertsOnDate(date, district);

    const devicesActive = dayUsers.filter((u) => u.deviceId).length;
    const totalPop = districtMeta.total_population;
    const monitored = dayUsers.length;
    const coverage = totalPop > 0 ? +(monitored / totalPop).toFixed(6) : 0;
    const dataQuality = this._computeDataQuality(dayUsers, dayAnomalies);

    const anomaliesByType = this._countSymptoms(dayAnomalies);
    const anomaliesBySyndrome = this._countSyndromes(dayAnomalies);
    const stratification = this._populationStratification(dayUsers, dayAnomalies);

    const report = {
      report_id: `RPT-DAILY-${district}-${date}`,
      report_date: date,
      report_type: 'daily_surveillance',
      district_id: district,
      district_name: districtMeta.district_name,
      generated_at: new Date().toISOString(),
      engine_version: PHM_ENGINE_VERSION,
      narrative_summary: this._dailyNarrative({
        date, districtMeta, monitored, dayAnomalies, dayClusters, dayAlerts,
      }),
      monitoring_overview: {
        total_monitored_population: monitored,
        total_population_denominator: totalPop,
        device_coverage: coverage,
        device_coverage_pct: +(coverage * 100).toFixed(2),
        devices_active_today: devicesActive,
        data_quality_score: dataQuality.score,
        data_quality_grade: dataQuality.grade,
        reporting_rate_estimate: EPIDEMIOLOGY_DEFAULTS.reportingRate,
      },
      anomalies_summary: {
        total_anomalies: dayAnomalies.length,
        unique_users_affected: [...new Set(dayAnomalies.map((a) => a.userId))].length,
        by_type: anomaliesByType,
        by_type_zh: this._translateCounts(anomaliesByType, SYMPTOM_LABELS_ZH),
        by_syndrome: anomaliesBySyndrome,
        by_syndrome_zh: this._translateCounts(anomaliesBySyndrome, SYNDROME_LABELS_ZH),
        anomaly_rate_per_10k: monitored > 0
          ? +((dayAnomalies.length / monitored) * 10000).toFixed(2)
          : 0,
      },
      clusters_detected: dayClusters.map((c) => this._clusterSummary(c)),
      alerts_issued: dayAlerts.map((a) => this._alertSummary(a)),
      population_stratification: stratification,
      public_health_recommendations: this._dailyRecommendations(dayClusters, dayAlerts, stratification),
      data_quality_and_limitations: {
        ...dataQuality,
        limitations: [
          '本报告基于可穿戴设备被动监测数据，不能替代实验室确诊',
          '低覆盖率区域可能存在监测盲区，解读时需结合人口分母',
          '症状代理指标（如活动量骤降、血氧偏低）存在非特异性',
          '地理信息已网格化处理，不支持个体追踪',
        ],
        confidence_note: '数据质量评分综合设备在线率、位置完整度与异常置信度',
      },
    };

    return report;
  }

  /**
   * B) Cluster investigation report for field epidemiology.
   * @param {string} clusterId
   * @returns {object | null}
   */
  generateInvestigationReport(clusterId) {
    const cluster = this.clusters.find((c) => c.clusterId === clusterId);
    if (!cluster) return null;

    const memberAnomalies = this.anomalies.filter((a) => cluster.members.includes(a.anomalyId));
    const memberUsers = memberAnomalies
      .map((a) => this.users.find((u) => u.userId === a.userId))
      .filter(Boolean);

    const epidemicCurve = this._buildEpidemicCurve(memberAnomalies, cluster.detectedAt);
    const symptomProfile = cluster.epiProfile?.symptomCounts
      || this._countSymptoms(memberAnomalies);
    const exposureAnalysis = this._analyzeExposureSources(memberUsers, memberAnomalies, cluster);

    return {
      report_id: `RPT-INV-${clusterId}`,
      report_type: 'cluster_investigation',
      cluster_id: clusterId,
      generated_at: new Date().toISOString(),
      engine_version: PHM_ENGINE_VERSION,
      narrative_summary: `聚集点 ${clusterId} 共涉及 ${cluster.memberCount} 名监测对象，`
        + `主导综合征为「${SYNDROME_LABELS_ZH[cluster.syndrome] || cluster.syndrome}」，`
        + `暴发可能性评估 ${(cluster.likelihood * 100).toFixed(1)}%，建议开展现场流行病学调查。`,
      cluster_basics: {
        cluster_id: cluster.clusterId,
        member_count: cluster.memberCount,
        syndrome: cluster.syndrome,
        syndrome_zh: SYNDROME_LABELS_ZH[cluster.syndrome] || cluster.syndrome,
        severity: cluster.severity,
        outbreak_likelihood: cluster.likelihood,
        status: cluster.status,
        detected_at: cluster.detectedAt,
        time_window: cluster.timeWindow,
        centroid: cluster.centroid,
        radius_meters: cluster.radiusMeters,
        poi_id: cluster.poiId || null,
        community_id: cluster.communityId || null,
        alert_level: cluster.alertCriteria?.levelLabel || null,
      },
      epidemic_curve: epidemicCurve,
      symptom_profile: {
        symptom_counts: symptomProfile,
        symptom_counts_zh: this._translateCounts(symptomProfile, SYMPTOM_LABELS_ZH),
        symptom_concordance: cluster.epiProfile?.symptomConcordance ?? null,
        dominant_symptoms: cluster.epiProfile?.dominantSymptoms || [],
        mean_severity: cluster.epiProfile?.meanSeverity ?? null,
        mean_confidence: cluster.epiProfile?.meanConfidence ?? null,
      },
      exposure_source_analysis: exposureAnalysis,
      recommended_interventions: this._investigationInterventions(cluster, exposureAnalysis),
      prevention_measures: this._preventionMeasures(cluster),
      member_summary: {
        total_anomalies: memberAnomalies.length,
        age_band_distribution: cluster.epiProfile?.ageBandDistribution || {},
        workplace_types: cluster.epiProfile?.workplaceTypes || {},
        vulnerability_rate: cluster.epiProfile?.vulnerabilityRate ?? null,
      },
    };
  }

  /**
   * C) Health equity analysis report (SES-focused).
   * @param {string} date - YYYY-MM-DD
   * @param {string} district - District id
   * @returns {object}
   */
  generateEquityAnalysisReport(date, district) {
    const districtMeta = this._districtMeta(district);
    const dayUsers = this._usersInDistrict(district);
    const dayAnomalies = this._anomaliesOnDate(date, district);
    const dayAlerts = this._alertsOnDate(date, district);

    const sesGroups = ['low', 'medium', 'high', 'unknown'];
    const bySes = {};

    sesGroups.forEach((ses) => {
      const groupUsers = dayUsers.filter((u) => (u.ses || 'unknown') === ses);
      const groupAnomalyUserIds = new Set(
        dayAnomalies.filter((a) => {
          const u = this.users.find((x) => x.userId === a.userId);
          return (u?.ses || 'unknown') === ses;
        }).map((a) => a.userId),
      );
      const groupAlerts = dayAlerts.filter((alert) =>
        alert.regionId === district || alert.regionId === districtMeta.district_id,
      );

      const deviceCoverage = districtMeta.total_population > 0
        ? groupUsers.length / districtMeta.total_population
        : 0;
      const anomalyRate = groupUsers.length > 0
        ? groupAnomalyUserIds.size / groupUsers.length
        : 0;

      bySes[ses] = {
        ses_level: ses,
        ses_label_zh: SES_LABELS_ZH[ses],
        enrolled_users: groupUsers.length,
        device_coverage: +deviceCoverage.toFixed(4),
        device_coverage_pct: +(deviceCoverage * 100).toFixed(2),
        users_with_anomalies: groupAnomalyUserIds.size,
        anomaly_detection_rate: +anomalyRate.toFixed(4),
        anomaly_detection_rate_pct: +(anomalyRate * 100).toFixed(2),
        alerts_received: groupAlerts.length,
        mean_alert_delay_hours: this._meanAlertDelay(groupAlerts, dayAnomalies),
      };
    });

    const coverageGap = this._equityGap(bySes, 'device_coverage');
    const detectionGap = this._equityGap(bySes, 'anomaly_detection_rate');
    const alertDelayGap = this._equityGap(bySes, 'mean_alert_delay_hours');

    return {
      report_id: `RPT-EQUITY-${district}-${date}`,
      report_date: date,
      report_type: 'equity_analysis',
      district_id: district,
      district_name: districtMeta.district_name,
      generated_at: new Date().toISOString(),
      engine_version: PHM_ENGINE_VERSION,
      narrative_summary: this._equityNarrative(bySes, coverageGap, detectionGap),
      ses_device_coverage: {
        by_ses: bySes,
        coverage_gap_high_vs_low: coverageGap,
        narrative: coverageGap > 0.02
          ? `高 SES 组设备覆盖率较低 SES 组高 ${(coverageGap * 100).toFixed(1)} 个百分点，存在数字监测鸿沟。`
          : '各 SES 组设备覆盖率差异在可接受范围内。',
      },
      anomaly_detection_disparity: {
        by_ses: Object.fromEntries(
          sesGroups.map((s) => [s, bySes[s].anomaly_detection_rate]),
        ),
        detection_rate_gap_high_vs_low: detectionGap,
        narrative: detectionGap > 0.05
          ? '低 SES 组异常检出率显著偏高，需排查环境暴露或监测偏倚。'
          : '各 SES 组异常检出率差异有限。',
      },
      alert_timing_disparity: {
        by_ses: Object.fromEntries(
          sesGroups.map((s) => [s, bySes[s].mean_alert_delay_hours]),
        ),
        delay_gap_hours: alertDelayGap,
        narrative: alertDelayGap > 6
          ? '部分 SES 组预警响应时间明显滞后，建议优先补齐低覆盖社区监测资源。'
          : '各 SES 组预警响应时间大致相当。',
      },
      equity_recommendations: this._equityRecommendations(bySes, coverageGap, detectionGap),
      data_quality_and_limitations: {
        limitations: [
          'SES 分层基于登记代理变量，非完整社会经济普查',
          '小样本 SES 组统计不稳定，建议结合多日均值解读',
          '公平性分析仅反映监测体系可及性，不代表真实疾病负担差异',
        ],
      },
    };
  }

  // ── Private helpers ──

  /** @param {string} district */
  _districtMeta(district) {
    const meta = this.districts[district];
    return meta || {
      district_id: district,
      district_name: district,
      total_population: Math.max(this._usersInDistrict(district).length * 12, 1000),
    };
  }

  /** @param {string} district @returns {User[]} */
  _usersInDistrict(district) {
    return this.users.filter((u) =>
      u.lastKnownLocation?.districtId === district
      || u.homeLocation?.districtId === district
      || u.workplace?.location?.districtId === district
      || !district,
    );
  }

  /** @param {string} date @param {string} district @returns {Anomaly[]} */
  _anomaliesOnDate(date, district) {
    const start = dayStartMs(date);
    const end = dayEndMs(date);
    return this.anomalies.filter((a) => {
      const t = new Date(a.detectedAt).getTime();
      const inDay = t >= start && t <= end;
      const loc = a.location?.districtId;
      return inDay && (!district || !loc || loc === district);
    });
  }

  /** @param {string} date @param {string} district @returns {DetectedCluster[]} */
  _clustersOnDate(date, district) {
    const start = dayStartMs(date);
    const end = dayEndMs(date);
    return this.clusters.filter((c) => {
      const t = new Date(c.detectedAt || c.timeWindow?.end || 0).getTime();
      return t >= start && t <= end;
    });
  }

  /** @param {string} date @param {string} district @returns {PublicHealthAlert[]} */
  _alertsOnDate(date, district) {
    const start = dayStartMs(date);
    const end = dayEndMs(date);
    return this.alerts.filter((a) => {
      const t = new Date(a.issuedAt).getTime();
      return t >= start && t <= end && (!district || a.regionId === district);
    });
  }

  /** @param {User[]} users @param {Anomaly[]} anomalies */
  _computeDataQuality(users, anomalies) {
    const withDevice = users.filter((u) => u.deviceId).length;
    const withLocation = users.filter((u) =>
      u.lastKnownLocation?.lat || u.homeLocation?.lat,
    ).length;
    const deviceRate = users.length ? withDevice / users.length : 0;
    const locRate = users.length ? withLocation / users.length : 0;
    const conf = anomalies.length
      ? avg(anomalies.map((a) => a.confidence))
      : 0.5;
    const score = Math.round((deviceRate * 40 + locRate * 30 + conf * 30));
    const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
    return {
      score,
      grade,
      device_online_rate: +deviceRate.toFixed(3),
      location_completeness: +locRate.toFixed(3),
      mean_anomaly_confidence: +conf.toFixed(3),
    };
  }

  /** @param {Anomaly[]} anomalies */
  _countSymptoms(anomalies) {
    /** @type {Record<string, number>} */
    const counts = {};
    anomalies.forEach((a) => {
      (a.symptoms || []).forEach((s) => {
        counts[s.type] = (counts[s.type] || 0) + 1;
      });
      (a.alertTypes || []).forEach((t) => {
        const key = t.includes('血氧') ? SYMPTOM_TYPES.HYPOXEMIA
          : t.includes('心率偏高') ? SYMPTOM_TYPES.TACHYCARDIA
            : t.includes('活动') ? SYMPTOM_TYPES.ACTIVITY_DROP : null;
        if (key) counts[key] = (counts[key] || 0) + 1;
      });
    });
    return counts;
  }

  /** @param {Anomaly[]} anomalies */
  _countSyndromes(anomalies) {
    /** @type {Record<string, number>} */
    const counts = {};
    anomalies.forEach((a) => {
      counts[a.syndrome] = (counts[a.syndrome] || 0) + 1;
    });
    return counts;
  }

  /** @param {Record<string, number>} counts @param {Record<string, string>} labels */
  _translateCounts(counts, labels) {
    return Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [labels[k] || k, v]),
    );
  }

  /** @param {User[]} users @param {Anomaly[]} anomalies */
  _populationStratification(users, anomalies) {
    const ageBands = {};
    const genderCounts = {};
    const sesCounts = {};
    const anomalyByBand = {};

    users.forEach((u) => {
      const band = u.age == null ? 'unknown'
        : u.age < 18 ? '0-17' : u.age < 36 ? '18-35' : u.age < 61 ? '36-60' : '61+';
      ageBands[band] = (ageBands[band] || 0) + 1;
      genderCounts[u.gender || 'unknown'] = (genderCounts[u.gender || 'unknown'] || 0) + 1;
      sesCounts[u.ses || 'unknown'] = (sesCounts[u.ses || 'unknown'] || 0) + 1;
    });

    anomalies.forEach((a) => {
      const u = this.users.find((x) => x.userId === a.userId);
      const band = u?.age == null ? 'unknown'
        : u.age < 18 ? '0-17' : u.age < 36 ? '18-35' : u.age < 61 ? '36-60' : '61+';
      anomalyByBand[band] = (anomalyByBand[band] || 0) + 1;
    });

    return {
      age_band_enrolled: ageBands,
      gender_enrolled: genderCounts,
      ses_enrolled: sesCounts,
      anomalies_by_age_band: anomalyByBand,
      elderly_share: users.length
        ? +((users.filter((u) => u.age != null && u.age >= 60).length / users.length)).toFixed(3)
        : 0,
      vulnerability_note: '61+ 岁与高脆弱人群应优先纳入加强监测',
    };
  }

  /** @param {DetectedCluster} cluster */
  _clusterSummary(cluster) {
    return {
      cluster_id: cluster.clusterId,
      member_count: cluster.memberCount,
      syndrome: cluster.syndrome,
      syndrome_zh: SYNDROME_LABELS_ZH[cluster.syndrome] || cluster.syndrome,
      severity: cluster.severity,
      outbreak_likelihood: cluster.likelihood,
      centroid: cluster.centroid,
      radius_meters: cluster.radiusMeters,
      detected_at: cluster.detectedAt,
      alert_level: cluster.alertCriteria?.levelLabel || 'MONITOR',
      narrative: `${cluster.memberCount} 人在 ${cluster.radiusMeters || '—'}m 范围内出现 `
        + `「${SYNDROME_LABELS_ZH[cluster.syndrome] || cluster.syndrome}」相关信号`,
    };
  }

  /** @param {PublicHealthAlert} alert */
  _alertSummary(alert) {
    return {
      alert_id: alert.alertId,
      type: alert.type,
      level: alert.level,
      level_label: alert.levelLabel,
      level_label_zh: ALERT_LEVEL_META[alert.levelLabel]?.label || alert.levelLabel,
      severity: alert.severity,
      syndrome: alert.syndrome,
      title: alert.title,
      summary: alert.summary,
      issued_at: alert.issuedAt,
      status: alert.status,
      cluster_ids: alert.clusterIds || [],
    };
  }

  /** @param {object} ctx */
  _dailyNarrative(ctx) {
    const { date, districtMeta, monitored, dayAnomalies, dayClusters, dayAlerts } = ctx;
    return `${date} ${districtMeta.district_name} 监测日报：`
      + `在册监测 ${monitored} 人，`
      + `当日异常信号 ${dayAnomalies.length} 条，`
      + `检测到聚集点 ${dayClusters.length} 处，`
      + `发出预警 ${dayAlerts.length} 条。`
      + (dayClusters.length > 0 ? ' 建议对新增聚集点启动流行病学调查。' : ' 整体处于常规监测状态。');
  }

  /** @param {DetectedCluster[]} clusters @param {PublicHealthAlert[]} alerts @param {object} strat */
  _dailyRecommendations(clusters, alerts, strat) {
    const recs = [
      {
        priority: 'medium',
        category: 'surveillance',
        recommendation_zh: '维持现有可穿戴 syndromic 监测覆盖，关注数据质量低于 B 级的社区',
      },
    ];
    if (clusters.some((c) => c.severity === 'high' || c.severity === 'critical')) {
      recs.unshift({
        priority: 'immediate',
        category: 'investigation',
        recommendation_zh: '对高严重度聚集点 24 小时内开展现场调查与采样',
        stakeholder: STAKEHOLDER_ROLES.EPIDEMIOLOGIST,
      });
    }
    if (alerts.some((a) => a.levelLabel === 'ACTION')) {
      recs.unshift({
        priority: 'immediate',
        category: 'response',
        recommendation_zh: '启动 ACTION 级响应预案，协调医疗机构与社区防控',
        stakeholder: STAKEHOLDER_ROLES.DISTRICT_HEALTH,
      });
    }
    if (strat.elderly_share > 0.2) {
      recs.push({
        priority: 'high',
        category: 'vulnerable_populations',
        recommendation_zh: '老年人口占比较高，建议加强养老院与社区卫生随访',
      });
    }
    return recs;
  }

  /** @param {Anomaly[]} anomalies @param {string} [anchorIso] */
  _buildEpidemicCurve(anomalies, anchorIso) {
    /** @type {Record<string, number>} */
    const byDay = {};
    anomalies.forEach((a) => {
      const day = a.observationDay || a.detectedAt.slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });
    const sorted = Object.keys(byDay).sort();
    return {
      anchor_date: anchorIso?.slice(0, 10) || sorted[sorted.length - 1] || null,
      cases_by_day: sorted.map((day) => ({
        date: day,
        case_count: byDay[day],
      })),
      total_cases: anomalies.length,
      peak_day: sorted.reduce((best, d) => (byDay[d] > (byDay[best] || 0) ? d : best), sorted[0] || null),
      narrative: sorted.length
        ? `流行曲线覆盖 ${sorted.length} 天，峰值出现在 ${sorted.reduce((best, d) => (byDay[d] > (byDay[best] || 0) ? d : best), sorted[0])}`
        : '病例数不足以构建流行曲线',
    };
  }

  /** @param {User[]} users @param {Anomaly[]} anomalies @param {DetectedCluster} cluster */
  _analyzeExposureSources(users, anomalies, cluster) {
    const workplaceCounts = {};
    const poiCounts = {};
    users.forEach((u) => {
      const wt = u.workplace?.type || 'unknown';
      workplaceCounts[wt] = (workplaceCounts[wt] || 0) + 1;
      if (u.workplace?.poiId) {
        poiCounts[u.workplace.poiId] = (poiCounts[u.workplace.poiId] || 0) + 1;
      }
    });

    const topPoi = Object.entries(poiCounts).sort((a, b) => b[1] - a[1])[0];
    const topWorkplace = Object.entries(workplaceCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      shared_workplace_type: topWorkplace?.[0] || null,
      shared_workplace_count: topWorkplace?.[1] || 0,
      shared_poi_id: topPoi?.[0] || cluster.poiId || null,
      shared_poi_member_count: topPoi?.[1] || 0,
      geographic_centroid: cluster.centroid,
      radius_meters: cluster.radiusMeters,
      likely_exposure_setting: topWorkplace?.[0] === 'school' ? '学校/集体单位'
        : topWorkplace?.[0] === 'healthcare' ? '医疗机构'
          : topWorkplace?.[0] === 'factory' ? '工作场所'
            : '社区居住区域',
      narrative: topPoi
        ? `${topPoi[1]} 名病例共享 POI ${topPoi[0]}，提示共同暴露可能。`
        : '尚未识别明确共同暴露源，建议开展个案访谈。',
    };
  }

  /** @param {DetectedCluster} cluster @param {object} exposure */
  _investigationInterventions(cluster, exposure) {
    const items = [
      {
        action_id: 'INV-01',
        priority: cluster.severity === 'critical' ? 'immediate' : 'high',
        action_zh: '启动现场流行病学调查（个案列表、接触者追踪）',
        timeline: '24 小时内',
        agency: STAKEHOLDER_ROLES.EPIDEMIOLOGIST,
      },
      {
        action_id: 'INV-02',
        priority: 'high',
        action_zh: '对聚集区域开展增强监测（每日报告、症状主动筛查）',
        timeline: '48 小时内',
        agency: STAKEHOLDER_ROLES.DISTRICT_HEALTH,
      },
    ];
    if (exposure.shared_poi_id) {
      items.push({
        action_id: 'INV-03',
        priority: 'high',
        action_zh: `对共同暴露场所（${exposure.likely_exposure_setting}）开展环境卫生评估`,
        timeline: '72 小时内',
        agency: STAKEHOLDER_ROLES.EMPLOYER,
      });
    }
    if (cluster.likelihood >= 0.7) {
      items.unshift({
        action_id: 'INV-00',
        priority: 'immediate',
        action_zh: '采集呼吸道样本进行实验室病原学检测',
        timeline: '12 小时内',
        agency: STAKEHOLDER_ROLES.CLINICIAN,
      });
    }
    return items;
  }

  /** @param {DetectedCluster} cluster */
  _preventionMeasures(cluster) {
    const syndrome = cluster.syndrome;
    const base = [
      { measure_zh: '加强手卫生与呼吸道礼仪健康教育', category: 'community' },
      { measure_zh: '出现症状者建议居家休息，避免集体聚集', category: 'individual' },
    ];
    if (syndrome === SYNDROME_TYPES.RESPIRATORY) {
      base.push(
        { measure_zh: '重点场所通风消毒，必要时佩戴口罩', category: 'environmental' },
        { measure_zh: '考虑在聚集区域开展临时疫苗/流感疫苗接种宣传', category: 'immunization' },
      );
    }
    if (cluster.epiProfile?.vulnerabilityRate > 0.3) {
      base.push({
        measure_zh: '优先保护老年与基础疾病人群，加强社区随访',
        category: 'vulnerable_populations',
      });
    }
    return base;
  }

  /** @param {Record<string, object>} bySes @param {string} field */
  _equityGap(bySes, field) {
    const low = bySes.low?.[field] ?? 0;
    const high = bySes.high?.[field] ?? 0;
    return +(high - low).toFixed(4);
  }

  /** @param {PublicHealthAlert[]} alerts @param {Anomaly[]} anomalies */
  _meanAlertDelay(alerts, anomalies) {
    if (!alerts.length || !anomalies.length) return 0;
    const anomalyTimes = anomalies.map((a) => new Date(a.detectedAt).getTime());
    const earliest = Math.min(...anomalyTimes);
    const delays = alerts.map((a) => (new Date(a.issuedAt).getTime() - earliest) / 3600000);
    return +avg(delays).toFixed(2);
  }

  /** @param {Record<string, object>} bySes @param {number} coverageGap @param {number} detectionGap */
  _equityNarrative(bySes, coverageGap, detectionGap) {
    return `健康公平性分析：低 SES 在册 ${bySes.low?.enrolled_users ?? 0} 人，`
      + `高 SES ${bySes.high?.enrolled_users ?? 0} 人。`
      + `设备覆盖率差距 ${(coverageGap * 100).toFixed(1)} 个百分点，`
      + `异常检出率差距 ${(detectionGap * 100).toFixed(1)} 个百分点。`;
  }

  /** @param {Record<string, object>} bySes @param {number} coverageGap @param {number} detectionGap */
  _equityRecommendations(bySes, coverageGap, detectionGap) {
    const recs = [];
    if (coverageGap > 0.02) {
      recs.push({
        priority: 'high',
        recommendation_zh: '在低 SES 社区增加可穿戴设备补贴与监测站点，缩小数字鸿沟',
        target_ses: 'low',
      });
    }
    if (detectionGap > 0.05) {
      recs.push({
        priority: 'high',
        recommendation_zh: '调查低 SES 组异常高检出率是真实暴露还是监测偏倚，必要时调整阈值',
        target_ses: 'low',
      });
    }
    if ((bySes.unknown?.enrolled_users || 0) > (bySes.low?.enrolled_users || 0)) {
      recs.push({
        priority: 'medium',
        recommendation_zh: '完善 SES 登记字段，减少 unknown 分层比例',
      });
    }
    if (!recs.length) {
      recs.push({
        priority: 'low',
        recommendation_zh: '当前各 SES 组监测可及性大致均衡，维持现有覆盖策略',
      });
    }
    return recs;
  }
}

module.exports = { PublicHealthReporting, SYMPTOM_LABELS_ZH, SYNDROME_LABELS_ZH };
