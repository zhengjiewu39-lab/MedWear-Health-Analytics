const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
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

function normalizeEntryName(name) {
  return String(name || '').replace(/\\/g, '/');
}

/** Pick export.xml (not export_cda.xml) from Apple Health zip entries. */
function findExportXmlEntry(entries) {
  const xmlFiles = entries.filter((e) => !e.isDirectory && /\.xml$/i.test(normalizeEntryName(e.entryName)));
  if (!xmlFiles.length) return null;

  const score = (entryName) => {
    const n = normalizeEntryName(entryName).toLowerCase();
    if (/(^|\/)export\.xml$/i.test(n)) return 100;
    if (n.includes('导出.xml')) return 95;
    if (n.endsWith('/export.xml')) return 90;
    if (n.includes('export') && !n.includes('cda')) return 50;
    if (!n.includes('cda')) return 10;
    return 0;
  };

  return [...xmlFiles].sort((a, b) => score(b.entryName) - score(a.entryName))[0];
}

function findExportXmlPathInListing(lines) {
  const xmlFiles = lines.filter((l) => /\.xml$/i.test(l));
  const fakeEntry = findExportXmlEntry(xmlFiles.map((entryName) => ({ entryName, isDirectory: false })));
  return fakeEntry ? normalizeEntryName(fakeEntry.entryName) : null;
}

function extractWithSystemUnzip(zipPath, tmpDir) {
  let listing = '';
  try {
    listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (err) {
    throw new Error(`ZIP 无法解压（请确认是 iPhone「导出所有健康数据」生成的 zip，且未损坏）: ${err.message}`);
  }
  const lines = listing.split(/\r?\n/).filter(Boolean);
  const innerPath = findExportXmlPathInListing(lines);
  if (!innerPath) throw new Error('ZIP 文件中未找到 export.xml（请使用 iPhone 健康 App 导出的 apple_health_export.zip）');

  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, 'export.xml');
  try {
    const buf = execFileSync('unzip', ['-p', zipPath, innerPath], { maxBuffer: 512 * 1024 * 1024 });
    fs.writeFileSync(outPath, buf);
  } catch (err) {
    throw new Error(`解压 export.xml 失败: ${err.message}`);
  }
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    throw new Error('export.xml 解压后为空，请重新从 iPhone 导出健康数据');
  }
  return outPath;
}

function extractXmlFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.xml') {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      throw new Error('XML 文件为空或无法读取');
    }
    return filePath;
  }
  if (ext !== '.zip') {
    throw new Error('请上传 export.xml 或 apple_health_export.zip');
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    throw new Error('ZIP 文件为空或上传不完整，请重新导出并上传');
  }

  const tmpDir = path.join(path.dirname(filePath), '.tmp-extract');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, 'export.xml');

  let zip;
  try {
    zip = new AdmZip(filePath);
  } catch (err) {
    // Fallback: macOS/Linux unzip handles some zips AdmZip rejects
    try {
      return extractWithSystemUnzip(filePath, tmpDir);
    } catch {
      throw new Error(`无法打开 ZIP 文件（可能损坏或未完成 AirDrop 传输）: ${err.message}`);
    }
  }

  const xmlEntry = findExportXmlEntry(zip.getEntries());
  if (!xmlEntry) {
    try {
      return extractWithSystemUnzip(filePath, tmpDir);
    } catch (err) {
      throw new Error(`ZIP 文件中未找到 export.xml: ${err.message}`);
    }
  }

  try {
    fs.writeFileSync(outPath, xmlEntry.getData());
  } catch (err) {
    // Large exports may exceed AdmZip memory — use system unzip
    try {
      return extractWithSystemUnzip(filePath, tmpDir);
    } catch (err2) {
      throw new Error(`解压 export.xml 失败（文件可能过大）: ${err.message || err2.message}`);
    }
  }

  if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    throw new Error('export.xml 解压后为空');
  }
  return outPath;
}

function parseExportXml(xmlPath, onProgress) {
  return new Promise((resolve, reject) => {
    const store = initStore({
      importedAt: new Date().toISOString(),
      sourceFile: path.basename(xmlPath),
    });

    let parsedRecords = 0;
    let meName = null;
    let currentAttrs = null;

    const parser = sax.createStream(true, { trim: true, normalize: true });

    parser.on('opentag', (node) => {
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
          onProgress({ phase: 'parsing', parsedRecords });
        }
      }
    });

    parser.on('closetag', (name) => {
      if (name === 'Me' && currentAttrs?.HKCharacteristicTypeIdentifierBiologicalSex) {
        const sex = currentAttrs.HKCharacteristicTypeIdentifierBiologicalSex;
        meName = sex.includes('Female') ? '女' : sex.includes('Male') ? '男' : '用户';
      }
      currentAttrs = null;
    });

    parser.on('error', (err) => reject(new Error(`XML 解析失败: ${err.message}`)));

    parser.on('end', () => {
      if (parsedRecords === 0) {
        reject(new Error('未解析到可用的 Apple Watch 数据（心率/步数/血氧/睡眠等）。请确认导出包来自 iPhone 健康 App 且包含可穿戴记录'));
        return;
      }
      finalizeStore(store, {
        totalRecords: parsedRecords,
        parsedRecords,
        userLabel: meName || 'Apple Health 用户',
      });
      if (!store.meta.dayCount) {
        reject(new Error(
          `已读取 ${parsedRecords} 条记录，但无法解析日期字段。请重新导出 Apple Health 或联系支持（常见原因：export.xml 日期格式不兼容）`,
        ));
        return;
      }
      resolve(store);
    });

    const stream = fs.createReadStream(xmlPath, { encoding: 'utf8' });
    stream.on('error', (err) => reject(new Error(`无法读取 export.xml: ${err.message}`)));
    stream.pipe(parser);
  });
}

async function importHealthFile(filePath, onProgress) {
  const xmlPath = extractXmlFromFile(filePath);
  const store = await parseExportXml(xmlPath, onProgress);
  saveStore(store);
  return store.meta;
}

module.exports = {
  importHealthFile,
  parseExportXml,
  extractXmlFromFile,
  findExportXmlEntry,
};
