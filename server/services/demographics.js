/**
 * Demographics helpers for age/sex-adjusted BHI scoring.
 * Real mode: parsed from Apple Health <Me> metadata (birth date, biological sex).
 * No compatibility fallback values — missing metadata propagate as null.
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

function isValidBiologicalSex(sex) {
  return sex === 'M' || sex === 'F';
}

/** Resolve BHI demographics from store meta, benchmark case, or explicit opts — no imputation. */
function resolveBhiDemographics(source = {}) {
  const meta = source.meta || source;
  const ageRaw = source.age ?? meta.age ?? null;
  const sexRaw = source.sex ?? meta.sex ?? null;
  const ageMissing = ageRaw == null;
  const sexMissing = sexRaw == null || !isValidBiologicalSex(sexRaw);

  let demographicsSource = 'provided';
  if (ageMissing && sexMissing) demographicsSource = 'missing';
  else if (ageMissing) demographicsSource = 'age-missing';
  else if (sexMissing) demographicsSource = 'sex-missing';

  return {
    age: ageMissing ? null : ageRaw,
    sex: sexMissing ? null : sexRaw,
    ageMissing,
    sexMissing,
    demographicsSource,
    birthDate: meta.birthDate ?? null,
    /** @deprecated always false — demographic fallback removed */
    inferred: false,
    /** @deprecated always false — demographic fallback removed */
    fallbackUsed: false,
  };
}

function demographicsFromMeta(meta = {}) {
  return resolveBhiDemographics(meta);
}

module.exports = {
  parseAppleBiologicalSex,
  ageFromBirthDate,
  isValidBiologicalSex,
  resolveBhiDemographics,
  demographicsFromMeta,
};
