/**
 * Published clinical reference subsets — SEER, NLST, China NCCR (aggregated).
 * Not full registry dumps; curated headline statistics for external validation.
 *
 * Sources (indicative):
 * - SEER*Explorer / SEER stat fact sheets (NSCLC, CRC, breast)
 * - NLST (NEJM 2011; reduced lung-cancer mortality with LDCT)
 * - China National Cancer Center / NCCR annual reports (early detection trends)
 */

'use strict';

const CLINICAL_REFERENCE_SUBSETS = {
  SEER: {
    id: 'SEER',
    name: 'SEER (US population registry)',
    name_zh: 'SEER 美国人口癌症登记',
    version: '2016-2020 approximate',
    license: 'Public domain / SEER Research Data Use',
    url: 'https://seer.cancer.gov/statfacts/',
    cancers: {
      lung_nsclc: {
        label: 'Non-small cell lung cancer',
        label_zh: '非小细胞肺癌',
        survival5yByStage: { I: 0.63, II: 0.41, III: 0.26, IV: 0.08 },
        earlyStageShareAtDx: 0.28,
        notes: 'Stage-specific 5-year relative survival; ~28% localized at diagnosis (usual care mix)',
      },
      colorectal: {
        label: 'Colorectal cancer',
        label_zh: '结直肠癌',
        survival5yByStage: { I: 0.91, II: 0.72, III: 0.72, IV: 0.15 },
        earlyStageShareAtDx: 0.39,
      },
      breast: {
        label: 'Breast cancer (female)',
        label_zh: '乳腺癌（女性）',
        survival5yByStage: { I: 0.99, II: 0.86, III: 0.72, IV: 0.31 },
        earlyStageShareAtDx: 0.63,
      },
    },
    outcomes: {
      medianDaysToTreatmentUsualCare: 42,
      treatmentInitiation90dUsualCare: 0.72,
    },
  },

  NLST: {
    id: 'NLST',
    name: 'NLST (lung CT screening trial)',
    name_zh: 'NLST 国家肺癌筛查试验',
    version: 'LDCT vs chest radiography',
    license: 'Public trial publications',
    url: 'https://www.cancer.gov/types/lung/research/nlst',
    lungScreening: {
      sensitivity: 0.944,
      specificity: 0.734,
      ppv: 0.039,
      stageShift: {
        earlyStageRateScreened: 0.57,
        earlyStageRateControl: 0.43,
      },
      mortalityReduction: 0.20,
      notes: 'Trial-level operating characteristics for lung cancer detection with LDCT',
    },
  },

  CHINA_NCCR: {
    id: 'CHINA_NCCR',
    name: 'China National Cancer Registry (NCCR subset)',
    name_zh: '中国肿瘤登记年报（汇总子集）',
    version: '2018-2022 urban screening program aggregates',
    license: 'Published summary statistics',
    url: 'http://www.ncchina.org.cn/',
    programs: {
      lung_high_risk: {
        label: 'High-risk lung screening (urban pilots)',
        label_zh: '高危肺癌筛查（城市试点）',
        earlyStageRateWithScreening: 0.52,
        earlyStageRateWithout: 0.31,
        medianDaysToTreatmentScreened: 22,
        medianDaysToTreatmentUnscreened: 48,
      },
      colorectal_fecal: {
        label: 'Colorectal FIT screening',
        label_zh: '结直肠癌 FIT 筛查',
        earlyStageRateWithScreening: 0.58,
        earlyStageRateWithout: 0.36,
        sensitivity: 0.79,
        specificity: 0.91,
        ppv: 0.05,
      },
      breast_mammography: {
        label: 'Breast mammography screening',
        label_zh: '乳腺钼靶筛查',
        earlyStageRateWithScreening: 0.71,
        earlyStageRateWithout: 0.55,
        sensitivity: 0.87,
        specificity: 0.89,
        ppv: 0.04,
      },
    },
    survivalImprovementWithEarlyDx: {
      lung: 0.18,
      colorectal: 0.22,
      breast: 0.15,
      notes: 'Absolute 5-year survival gain proxy when diagnosed at early vs late stage (registry modeling)',
    },
  },
};

function listReferenceSubsets() {
  return Object.values(CLINICAL_REFERENCE_SUBSETS).map((r) => ({
    id: r.id,
    name: r.name,
    name_zh: r.name_zh,
    version: r.version,
    url: r.url,
  }));
}

function getReferenceSubset(id) {
  return CLINICAL_REFERENCE_SUBSETS[id] || null;
}

module.exports = {
  CLINICAL_REFERENCE_SUBSETS,
  listReferenceSubsets,
  getReferenceSubset,
};
