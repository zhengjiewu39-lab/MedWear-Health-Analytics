#!/usr/bin/env node
/**
 * Paper reproduction bridge — BHI + MAD + 17-dim features per wearable case (JSON stdin → stdout).
 * Used by notebooks/paper_reproduction.ipynb for engine-accurate pipeline steps.
 */
'use strict';

const { extractFeatures, FEATURE_NAMES } = require('../server/services/extractFeatures');
const { computeDayScoreDetail, buildStoreFromDays } = require('../server/services/analyticsCore');
const { detectRobustAnomalies } = require('../server/services/robustAnomaly');
const { classifyBHIWatchTier } = require('../server/config/bhiWatchTier');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input || '{}');
    const cases = payload.cases || (Array.isArray(payload) ? payload : [payload]);
    const out = cases.map((c) => {
      const targetDay = c.targetDay || Object.keys(c.days || {}).sort().pop();
      const dayKeys = Object.keys(c.days || {}).sort();
      const idx = dayKeys.indexOf(targetDay);
      const priorDays = idx > 0
        ? dayKeys.slice(Math.max(0, idx - 7), idx).map((k) => c.days[k])
        : [];
      const dayData = c.days[targetDay];
      const bhiDetail = computeDayScoreDetail(dayData, {
        priorDays,
        age: c.age || 45,
        sex: c.sex || 'F',
      });
      const store = buildStoreFromDays(c.days, targetDay);
      const mad = detectRobustAnomalies(store);
      const features = extractFeatures(c);
      const tier = classifyBHIWatchTier(bhiDetail.score);
      const featureVector = FEATURE_NAMES.map((k) => Number(features[k] ?? 0));

      return {
        id: c.id,
        targetDay,
        bhi: bhiDetail.score,
        bhiTier: tier,
        bhiComponents: bhiDetail.components || {},
        bhiWeights: bhiDetail.weights || {},
        trendDelta: bhiDetail.trendDelta ?? 0,
        madAnomalyCount: mad.anomalies.length,
        madAnomalies: mad.anomalies,
        madBaseline: mad.baseline,
        featureNames: FEATURE_NAMES,
        featureVector,
        expected: c.expected || null,
      };
    });
    process.stdout.write(JSON.stringify({ cases: out, engine: 'MedWear-AnalyticsCore-v1' }));
  } catch (err) {
    process.stderr.write(String(err.stack || err));
    process.exit(1);
  }
});
