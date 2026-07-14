const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');
const {
  findExportXmlEntry,
  extractXmlFromFile,
  importHealthFile,
} = require('../health/parser');

describe('Apple Health parser', () => {
  test('prefers export.xml over export_cda.xml', () => {
    const entries = [
      { entryName: 'apple_health_export/export_cda.xml', isDirectory: false },
      { entryName: 'apple_health_export/export.xml', isDirectory: false },
    ];
    const pick = findExportXmlEntry(entries);
    assert.ok(pick.entryName.includes('export.xml'));
    assert.ok(!pick.entryName.includes('cda'));
  });

  test('imports minimal export.xml zip', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'medwear-import-'));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
]>
<HealthData locale="en_US">
  <Me HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale" />
  <Record type="HKQuantityTypeIdentifierStepCount" value="8000" unit="count"
    startDate="2026-01-01 08:00:00 +0000" endDate="2026-01-01 09:00:00 +0000"
    sourceName="Apple Watch" device="Watch" />
  <Record type="HKQuantityTypeIdentifierHeartRate" value="72" unit="count/min"
    startDate="2026-01-01 08:00:00 +0000" endDate="2026-01-01 08:01:00 +0000"
    sourceName="Apple Watch" device="Watch" />
  <Record type="HKQuantityTypeIdentifierStepCount" value="6500" unit="count"
    startDate="2026-01-02 09:00:00 +0800" endDate="2026-01-02 10:00:00 +0800"
    sourceName="Apple Watch" device="Watch" />
</HealthData>`;
    const zipPath = path.join(tmp, 'apple_health_export.zip');
    const zip = new AdmZip();
    zip.addFile('apple_health_export/export.xml', Buffer.from(xml, 'utf8'));
    zip.writeZip(zipPath);

    const meta = await importHealthFile(zipPath);
    assert.ok(meta.parsedRecords >= 2);
    assert.ok(meta.dayCount >= 2, 'should bucket records by Apple Health date');
    assert.ok(meta.parsedRecords >= 3);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('dateKey parses Apple Health timestamps', () => {
    const { dateKey } = require('../health/store');
    assert.equal(dateKey('2024-01-15 08:00:00 +0800'), '2024-01-15');
    assert.equal(dateKey('2024-06-01 07:13:17 -0500'), '2024-06-01');
  });

  test('extractXmlFromFile rejects empty zip', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'medwear-empty-'));
    const zipPath = path.join(tmp, 'empty.zip');
    fs.writeFileSync(zipPath, Buffer.alloc(0));
    assert.throws(() => extractXmlFromFile(zipPath), /为空|不完整/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
