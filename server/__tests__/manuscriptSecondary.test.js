const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../../scripts/analyze-manuscript-secondary');

test('frozen manuscript v1.2 secondary analyses reproduce reported values', () => {
  const result = run();
  const bhi = result.continuousBhi;
  const mad = result.madRulePathAudit;

  assert.equal(result.n, 5000);
  assert.deepEqual(
    Object.values(bhi.toleranceSensitivity).map((row) => row.count),
    [2716, 3503, 3872, 4181],
  );
  assert.equal(bhi.meanDifferenceMedWearMinusReference, -4.8202);
  assert.equal(bhi.meanAbsoluteDifference, 6.4174);
  assert.equal(bhi.medianAbsoluteDifference, 5);
  assert.deepEqual(bhi.absoluteDifferenceIqr, [2, 10]);
  assert.equal(mad.referencePositiveMedWearNegative, 1494);
  assert.equal(mad.stoppedByMinimumHrBaselineGate, 1166);
  assert.equal(mad.passedMinimumHrBaselineGate, 328);
  assert.deepEqual(mad.referenceMechanismsAmongGatePassersNonExclusive, {
    sleep_deprivation: 263,
    spo2_events: 109,
    hr_variability: 62,
    sedentary_target: 70,
  });
});
