/**
 * Demographics helpers for age/sex-adjusted BHI scoring.
 * Real mode: parsed from Apple Health <Me> metadata (birth date, biological sex).
 */

function parseAppleBiologicalSex(raw) {
  if (!raw) return null;
  const s = String(raw);
  if (s.includes('Female')) return 'F';
  if (s.includes('Male')) return 'M';
  return null;
}

function ageFromBirthDate(birthDateStr, refDate = new Date()) {
  if (!birthDateStr) return null;
  const m = String(birthDateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const dob = new Date(+m[1], +m[2] - 1, +m[3]);
  if (Number.isNaN(dob.getTime())) return null;
  let age = refDate.getFullYear() - dob.getFullYear();
  const md = refDate.getMonth() - dob.getMonth();
  if (md < 0 || (md === 0 && refDate.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

/** Resolve BHI demographics from store meta, benchmark case, or explicit opts. */
function resolveBhiDemographics(source = {}) {
  const meta = source.meta || source;
  const age = source.age ?? meta.age ?? null;
  const sex = source.sex ?? meta.sex ?? null;
  const inferred = age == null || sex == null;
  return {
    age: age ?? 45,
    sex: sex ?? 'F',
    inferred,
    birthDate: meta.birthDate ?? null,
  };
}

function demographicsFromMeta(meta = {}) {
  return resolveBhiDemographics(meta);
}

module.exports = {
  parseAppleBiologicalSex,
  ageFromBirthDate,
  resolveBhiDemographics,
  demographicsFromMeta,
};
