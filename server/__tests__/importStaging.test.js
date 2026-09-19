const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');

describe('Apple Health import staging', () => {
  test('failed import preserves prior store snapshot', async () => {
    const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'medwear-data-'));
    process.env.MEDWEAR_DATA_DIR = tmpData;

    const { saveStoreSnapshot, assembleStore, hasData } = require('../health/dao');
    const { rollbackImportDatabase, closeDb } = require('../health/db');
    const { importHealthFile } = require('../health/parser');

    saveStoreSnapshot({
      meta: { userLabel: 'Keep Me', dayCount: 1, importedAt: '2020-01-01T00:00:00.000Z' },
      daily: {
        '2026-01-01': {
          steps: 5000,
          activeEnergy: 0,
          restingHeartRate: 60,
          heartRate: [60],
          spo2: [98],
          hrv: [40],
          respiratoryRate: [],
          sleepMinutes: { deep: 30, rem: 30, light: 60, awake: 0, inBed: 0 },
        },
      },
      sources: {},
      recent: { heartRate: [], spo2: [], hrv: [], steps: [] },
      sleepSessions: [],
      workouts: [],
    });
    assert.ok(hasData());
    assert.equal(assembleStore().meta.userLabel, 'Keep Me');

    const badZip = path.join(tmpData, 'bad.zip');
    const zip = new AdmZip();
    zip.addFile('export.xml', Buffer.from('<?xml version="1.0"?><HealthData></HealthData>', 'utf8'));
    zip.writeZip(badZip);

    await assert.rejects(() => importHealthFile(badZip));
    rollbackImportDatabase();
    closeDb();

    delete require.cache[require.resolve('../health/db')];
    delete require.cache[require.resolve('../health/dao')];
    const { assembleStore: assembleAgain, hasData: hasAgain } = require('../health/dao');
    assert.ok(hasAgain());
    assert.equal(assembleAgain().meta.userLabel, 'Keep Me');

    delete process.env.MEDWEAR_DATA_DIR;
    fs.rmSync(tmpData, { recursive: true, force: true });
  });
});
