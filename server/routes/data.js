const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { importHealthFile } = require('../health/parser');
const { clearStore, hasData, DATA_DIR } = require('../health/store');
const { getDataStatus } = require('../health/analytics');
const { audit } = require('../security/audit');

const IMPORT_DIR = path.join(__dirname, '../../health-import');
if (!fs.existsSync(IMPORT_DIR)) fs.mkdirSync(IMPORT_DIR, { recursive: true });

const upload = multer({
  dest: IMPORT_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /\.(zip|xml)$/i.test(file.originalname);
    cb(ok ? null : new Error('仅支持 .zip 或 .xml 文件'), ok);
  },
});

let importProgress = { status: 'idle', message: '', percent: 0 };

function registerDataRoutes(app, resolveUser) {
  app.get('/api/data/status', (_, res) => {
    res.json(getDataStatus());
  });

  app.get('/api/data/import/progress', (_, res) => {
    res.json(importProgress);
  });

  app.post('/api/data/import', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: '请选择文件' });
    importProgress = { status: 'processing', message: '解析 Apple Health 数据…', percent: 10 };
    try {
      const ext = path.extname(req.file.originalname);
      const target = path.join(IMPORT_DIR, `import${ext}`);
      fs.renameSync(req.file.path, target);
      importProgress.percent = 30;
      await importHealthFile(target, (p) => {
        importProgress = { status: 'processing', message: `已解析 ${p.parsedRecords} 条记录`, percent: Math.min(90, 30 + p.parsedRecords / 500) };
      });
      importProgress = { status: 'done', message: '导入完成', percent: 100 };
      audit('HEALTH_IMPORT', { user: resolveUser(req)?.username, success: true });
      res.json({ success: true, meta: getDataStatus().meta });
    } catch (err) {
      importProgress = { status: 'error', message: err.message, percent: 0 };
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/data/import/scan', async (_, res) => {
    const files = fs.readdirSync(IMPORT_DIR).filter(f => /\.(zip|xml)$/i.test(f));
    if (!files.length) return res.status(404).json({ success: false, message: 'health-import 文件夹中无 export 文件' });
    const file = files.sort((a, b) => fs.statSync(path.join(IMPORT_DIR, b)).mtime - fs.statSync(path.join(IMPORT_DIR, a)).mtime)[0];
    importProgress = { status: 'processing', message: '扫描导入…', percent: 20 };
    try {
      await importHealthFile(path.join(IMPORT_DIR, file));
      importProgress = { status: 'done', message: '完成', percent: 100 };
      res.json({ success: true, file, meta: getDataStatus().meta });
    } catch (err) {
      importProgress = { status: 'error', message: err.message, percent: 0 };
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/data/clear', (_, res) => {
    clearStore();
    importProgress = { status: 'idle', message: '', percent: 0 };
    res.json({ success: true });
  });

  app.get('/api/mode', (req, res) => {
    const { isAiConfigured } = require('../ai/config');
    res.json({
      mode: req.dataMode,
      hasRealData: hasData(),
      aiConfigured: isAiConfigured(),
      realDataOnly: req.dataMode === 'real',
    });
  });
}

module.exports = { registerDataRoutes, upload, IMPORT_DIR };
