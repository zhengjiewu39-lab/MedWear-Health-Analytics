#!/usr/bin/env node
/**
 * Generate synthetic Apple Health-style wearable time series for large-scale experiments.
 * Usage:
 *   node scripts/generate_synthetic_healthdata.js --users 200 --days 14 --out experiments/data/medwear
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { users: 200, days: 14, out: 'experiments/data/medwear', seed: 42 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--users' || args[i] === '--n') opts.users = +args[++i];
    else if (args[i] === '--days') opts.days = +args[++i];
    else if (args[i] === '--out') opts.out = args[++i];
    else if (args[i] === '--seed') opts.seed = +args[++i];
  }
  return opts;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pickProfile(rng) {
  const p = rng();
  if (p < 0.6) return { hr: 68, hrSd: 5, spo2: 97, hrv: 48, steps: 7500, sleep: 7.5, tag: 'healthy' };
  if (p < 0.8) return { hr: 82, hrSd: 8, spo2: 94, hrv: 32, steps: 3500, sleep: 5.5, tag: 'at_risk' };
  return { hr: 105, hrSd: 12, spo2: 90, hrv: 25, steps: 2200, sleep: 4.5, tag: 'high_risk' };
}

function genDay(rng, profile, dayOffset, injectSpike) {
  const n = 8 + Math.floor(rng() * 6);
  const heartRate = Array.from({ length: n }, () => {
    let v = profile.hr + (rng() - 0.5) * profile.hrSd * 2;
    if (injectSpike && rng() > 0.7) v += 40 + rng() * 30;
    return Math.round(Math.max(40, v));
  });
  const spo2 = Array.from({ length: 4 }, () => +(profile.spo2 + (rng() - 0.5) * 2).toFixed(1));
  const hrv = Array.from({ length: 3 }, () => Math.round(profile.hrv + (rng() - 0.5) * 10));
  const sleepMin = Math.round(profile.sleep * 60);
  return {
    steps: Math.round(profile.steps * (0.7 + rng() * 0.6)),
    heartRate,
    spo2,
    hrv,
    restingHeartRate: Math.round(profile.hr + (rng() - 0.5) * 4),
    activeEnergy: Math.round(profile.steps * 0.05 + rng() * 100),
    sleepMinutes: {
      deep: Math.round(sleepMin * 0.2),
      rem: Math.round(sleepMin * 0.22),
      light: Math.round(sleepMin * 0.45),
      awake: Math.round(sleepMin * 0.08),
    },
  };
}

function buildUserCase(userId, rng, days) {
  const profile = pickProfile(rng);
  const start = new Date('2026-01-01');
  const daysMap = {};
  const targetDay = new Date(start);
  targetDay.setDate(start.getDate() + days - 1);
  const targetKey = targetDay.toISOString().slice(0, 10);

  for (let d = 0; d < days; d++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + d);
    const key = dt.toISOString().slice(0, 10);
    daysMap[key] = genDay(rng, profile, d, d === days - 1 && profile.tag === 'at_risk');
  }

  const riskLevel = profile.tag === 'healthy' ? 'low' : profile.tag === 'at_risk' ? 'moderate' : 'high';
  return {
    id: userId,
    label: profile.tag,
    targetDay: targetKey,
    days: daysMap,
    expected: {
      alerts: profile.tag === 'healthy' ? [] : profile.tag === 'at_risk' ? ['活动量不足'] : ['心率偏高', '血氧偏低'],
      anomaly: profile.tag !== 'healthy',
      riskLevel,
      healthScoreMin: profile.tag === 'healthy' ? 70 : profile.tag === 'at_risk' ? 45 : 30,
    },
  };
}

function minimalExportXml(userId, daysMap) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<HealthData locale="en_US">', `<Me HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexNotSet" />`];
  for (const [day, d] of Object.entries(daysMap)) {
    const ts = `${day} 12:00:00 +0800`;
    d.heartRate.forEach((v, i) => {
      lines.push(`<Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="${v}" startDate="${day} ${8 + i}:00:00 +0800" endDate="${day} ${8 + i}:00:00 +0800" sourceName="Apple Watch"/>`);
    });
    d.spo2.forEach((v, i) => {
      lines.push(`<Record type="HKQuantityTypeIdentifierOxygenSaturation" unit="%" value="${(v / 100).toFixed(3)}" startDate="${day} ${10 + i}:00:00 +0800" endDate="${day} ${10 + i}:00:00 +0800" sourceName="Apple Watch"/>`);
    });
    lines.push(`<Record type="HKQuantityTypeIdentifierStepCount" unit="count" value="${d.steps}" startDate="${ts}" endDate="${ts}" sourceName="Apple Watch"/>`);
  }
  lines.push('</HealthData>');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs();
  const rng = mulberry32(opts.seed);
  const outDir = path.resolve(opts.out);
  fs.mkdirSync(outDir, { recursive: true });

  const cases = [];
  for (let u = 1; u <= opts.users; u++) {
    const id = `SYN-U${String(u).padStart(3, '0')}`;
    const c = buildUserCase(id, rng, opts.days);
    cases.push(c);

    const jsonPath = path.join(outDir, `synth_user_${String(u).padStart(3, '0')}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(c, null, 2));

    if (u <= 5) {
      const xml = minimalExportXml(id, c.days);
      const zip = new AdmZip();
      zip.addFile('apple_health_export/export.xml', Buffer.from(xml, 'utf8'));
      zip.writeZip(path.join(outDir, `synth_user_${String(u).padStart(3, '0')}.zip`));
    }
  }

  const manifest = {
    dataset: 'MedWear-Wearable-Synth-v1',
    version: '1.0.0',
    license: 'CC-BY-4.0',
    users: opts.users,
    daysPerUser: opts.days,
    seed: opts.seed,
    cases,
  };
  fs.writeFileSync(path.join(outDir, `synth_n${opts.users}.json`), JSON.stringify(manifest, null, 2));
  console.log(`Generated ${opts.users} users × ${opts.days} days → ${outDir}`);
  console.log(`  manifest: synth_n${opts.users}.json`);
  console.log(`  sample zips: synth_user_001.zip … synth_user_005.zip`);
}

if (require.main === module) main();
