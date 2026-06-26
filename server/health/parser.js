const fs = require('fs');
const path = require('path');
const sax = require('sax');
const AdmZip = require('adm-zip');
const { initStore, ingestRecord, finalizeStore, saveStore } = require('./store');

const RELEVANT_TYPES = new Set([
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
]);

function extractXmlFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.zip') {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    const xmlEntry = entries.find(e =>
      !e.isDirectory && e.entryName.endsWith('.xml') &&
      (e.entryName.toLowerCase().includes('export') || e.entryName.includes('导出'))
    ) || entries.find(e => !e.isDirectory && e.entryName.endsWith('.xml'));
    if (!xmlEntry) throw new Error('ZIP 文件中未找到 export.xml');
    const tmpDir = path.join(path.dirname(filePath), '.tmp-extract');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const outPath = path.join(tmpDir, 'export.xml');
    fs.writeFileSync(outPath, xmlEntry.getData());
    return outPath;
  }
  if (ext === '.xml') return filePath;
  throw new Error('请上传 export.xml 或 apple_health_export.zip');
}

function parseExportXml(xmlPath, onProgress) {
  return new Promise((resolve, reject) => {
    const store = initStore({
      importedAt: new Date().toISOString(),
      sourceFile: path.basename(xmlPath),
    });

    let totalRecords = 0;
    let parsedRecords = 0;
    let meName = null;
    let currentTag = null;
    let currentAttrs = null;

    const parser = sax.createStream(true, { trim: true, normalize: true });

    parser.on('opentag', (node) => {
      currentTag = node.name;
      currentAttrs = node.attributes;
      if (node.name === 'Me') {
        meName = node.attributes.charCreationDate ? 'Apple Health 用户' : '我';
      }
      if (node.name === 'Record' && RELEVANT_TYPES.has(node.attributes.type)) {
        ingestRecord(store, {
          type: node.attributes.type,
          value: node.attributes.value,
          unit: node.attributes.unit,
          startDate: node.attributes.startDate,
          endDate: node.attributes.endDate,
          sourceName: node.attributes.sourceName,
          sourceVersion: node.attributes.sourceVersion,
          device: node.attributes.device,
        });
        parsedRecords += 1;
        if (parsedRecords % 5000 === 0 && onProgress) {
          onProgress({ phase: 'parsing', parsedRecords, totalRecords });
        }
      }
    });

    parser.on('closetag', (name) => {
      if (name === 'Me' && currentAttrs?.HKCharacteristicTypeIdentifierBiologicalSex) {
        const sex = currentAttrs.HKCharacteristicTypeIdentifierBiologicalSex;
        meName = sex.includes('Female') ? '女' : sex.includes('Male') ? '男' : '用户';
      }
      currentTag = null;
      currentAttrs = null;
    });

    parser.on('error', (err) => reject(err));

    parser.on('end', () => {
      finalizeStore(store, {
        totalRecords: parsedRecords,
        parsedRecords,
        userLabel: meName || 'Apple Health 用户',
      });
      resolve(store);
    });

    const stream = fs.createReadStream(xmlPath, { encoding: 'utf8' });
    stream.on('error', reject);
    stream.pipe(parser);
  });
}

async function importHealthFile(filePath, onProgress) {
  const xmlPath = extractXmlFromFile(filePath);
  const store = await parseExportXml(xmlPath, onProgress);
  saveStore(store);
  return store.meta;
}

module.exports = { importHealthFile, parseExportXml, extractXmlFromFile };
