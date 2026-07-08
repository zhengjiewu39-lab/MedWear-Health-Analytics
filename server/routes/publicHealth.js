/**
 * Public-health monitoring REST API.
 *
 * @example GET /api/public-health/summary?date=2026-01-18&district=chaoyang
 * @example GET /api/public-health/clusters?timeWindow=72&district=pudong
 * @example GET /api/public-health/daily-report?date=2026-01-18&district=chaoyang
 * @example GET /api/public-health/investigation/CL-mabc-1
 * @example GET /api/public-health/equity-analysis?date=2026-01-18&district=chaoyang
 * @example POST /api/public-health/register-user
 *   Body: { "userId": "U100", "age": 34, "ses": "medium", "coordinates": { "lat": 39.9, "lng": 116.4 } }
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { run: runPhEvaluation } = require('../../scripts/evaluate-public-health');
const { getPhmService, resolveDistrict, isValidDate, DISTRICT_ALIASES } = require('../public-health/phmService');

const PH_EVAL_RESULTS_DIR = path.join(__dirname, '../../benchmarks/results');

const router = express.Router();

/**
 * Map service errors to HTTP responses.
 * @param {Error & { message: string }} err
 * @param {import('express').Response} res
 */
function handlePhmError(err, res) {
  const map = {
    INVALID_DISTRICT: { status: 400, message: 'district 参数无效，支持: pudong, chaoyang, dongcheng, haidian, tongzhou 或 6 位 district_id' },
    INVALID_DATE: { status: 400, message: 'date 格式须为 YYYY-MM-DD' },
    INVALID_TIME_WINDOW: { status: 400, message: 'timeWindow 须为 1–720 之间的数字（小时）' },
    INVALID_CLUSTER_ID: { status: 400, message: 'clusterId 不能为空' },
    MISSING_USER_ID: { status: 400, message: 'userId 为必填项' },
    INVALID_COORDINATES: { status: 400, message: 'coordinates 须包含数值 lat 与 lng' },
    INVALID_SES: { status: 400, message: 'ses 须为 low | medium | high | unknown' },
    INVALID_AGE: { status: 400, message: 'age 须为 0–120 之间的数字' },
  };
  const mapped = map[err.message];
  if (mapped) return res.status(mapped.status).json({ success: false, error: err.message, message: mapped.message });
  console.error('[PHM API]', err);
  return res.status(500).json({ success: false, message: '公共卫生监测服务内部错误' });
}

/**
 * GET /api/public-health/summary
 * 社区监测概况。
 *
 * @query {string} date - YYYY-MM-DD，例: 2026-01-18
 * @query {string} district - 区县别名或 id，例: pudong, chaoyang
 * @returns {object} monitoring_overview, top_clusters, narrative_summary
 */
router.get('/summary', (req, res) => {
  try {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const district = String(req.query.district || 'chaoyang');
    if (!req.query.district) {
      return res.status(400).json({
        success: false,
        message: 'district 为必填参数',
        example: '/api/public-health/summary?date=2026-01-18&district=chaoyang',
      });
    }
    const data = getPhmService().getSummary(district, date);
    return res.json({ success: true, ...data });
  } catch (err) {
    return handlePhmError(err, res);
  }
});

/**
 * GET /api/public-health/clusters
 * 当前检测到的聚集点列表。
 *
 * @query {number} [timeWindow=72] - 分析窗口（小时）
 * @query {string} district - 区县，例: pudong
 * @returns {object} { cluster_count, clusters: [...] }
 */
router.get('/clusters', (req, res) => {
  try {
    const district = String(req.query.district || '');
    if (!district) {
      return res.status(400).json({
        success: false,
        message: 'district 为必填参数',
        example: '/api/public-health/clusters?timeWindow=72&district=pudong',
      });
    }
    const timeWindow = Number(req.query.timeWindow ?? req.query.time_window ?? 72);
    const data = getPhmService().getClusters(district, timeWindow);
    return res.json({ success: true, ...data });
  } catch (err) {
    return handlePhmError(err, res);
  }
});

/**
 * GET /api/public-health/daily-report
 * 日度流行病学报告（结构化 JSON，供前端可视化）。
 *
 * @query {string} date - YYYY-MM-DD
 * @query {string} district - 区县
 * @returns {object} report_type: daily_surveillance
 */
router.get('/daily-report', (req, res) => {
  try {
    const date = String(req.query.date || '');
    const district = String(req.query.district || '');
    if (!date || !district) {
      return res.status(400).json({
        success: false,
        message: 'date 与 district 均为必填',
        example: '/api/public-health/daily-report?date=2026-01-18&district=chaoyang',
      });
    }
    const report = getPhmService().getDailyReport(district, date);
    return res.json({ success: true, report });
  } catch (err) {
    return handlePhmError(err, res);
  }
});

/**
 * GET /api/public-health/investigation/:clusterId
 * 特定聚集点调查报告。
 *
 * @param {string} clusterId - 聚集点 id，来自 /clusters 响应
 * @returns {object} report_type: cluster_investigation
 */
router.get('/investigation/:clusterId', (req, res) => {
  try {
    const report = getPhmService().getInvestigationReport(req.params.clusterId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: `未找到聚集点 ${req.params.clusterId}`,
        example: '先调用 GET /api/public-health/clusters 获取 cluster_id',
      });
    }
    return res.json({ success: true, report });
  } catch (err) {
    return handlePhmError(err, res);
  }
});

/**
 * GET /api/public-health/equity-analysis
 * 健康不平等（SES）分析报告。
 *
 * @query {string} date - YYYY-MM-DD
 * @query {string} district - 区县
 * @returns {object} report_type: equity_analysis
 */
router.get('/equity-analysis', (req, res) => {
  try {
    const date = String(req.query.date || '');
    const district = String(req.query.district || '');
    if (!date || !district) {
      return res.status(400).json({
        success: false,
        message: 'date 与 district 均为必填',
        example: '/api/public-health/equity-analysis?date=2026-01-18&district=chaoyang',
      });
    }
    const report = getPhmService().getEquityReport(district, date);
    return res.json({ success: true, report });
  } catch (err) {
    return handlePhmError(err, res);
  }
});

/**
 * POST /api/public-health/register-user
 * 注册被监测用户。
 *
 * @body {string} userId - 伪匿名用户 id（必填）
 * @body {number} [age] - 年龄
 * @body {object} [workplace] - { poiId, type, location }
 * @body {string} [ses] - low | medium | high | unknown
 * @body {object} coordinates - { lat, lng }（必填）
 * @body {string} [district_id] - 行政区划 id
 * @returns {object} { success, user }
 */
router.post('/register-user', (req, res) => {
  try {
    const user = getPhmService().registerUser(req.body || {});
    if (!user) {
      return res.status(422).json({ success: false, message: '用户注册失败，请检查输入' });
    }
    return res.status(201).json({
      success: true,
      message: '监测用户已注册',
      user: {
        user_id: user.userId,
        age: user.age,
        ses: user.ses,
        location: user.lastKnownLocation,
        workplace: user.workplace,
      },
    });
  } catch (err) {
    return handlePhmError(err, res);
  }
});

/**
 * GET /api/public-health/evaluation
 * 最近一次公卫基准评测结果（JSON）。
 */
router.get('/evaluation', (_, res) => {
  try {
    const files = fs.readdirSync(PH_EVAL_RESULTS_DIR)
      .filter((f) => f.startsWith('ph-evaluation-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (!files.length) {
      return res.json({
        success: true,
        message: '暂无评测结果，请 POST /api/public-health/evaluation/run',
        report: null,
      });
    }
    const report = JSON.parse(fs.readFileSync(path.join(PH_EVAL_RESULTS_DIR, files[0]), 'utf8'));
    return res.json({ success: true, report, source_file: files[0] });
  } catch (err) {
    return handlePhmError(err, res);
  }
});

/**
 * POST /api/public-health/evaluation/run
 * 运行 52 场景公卫基准评测（论文可复现）。
 *
 * @body {number} [timeWindow=72]
 */
router.post('/evaluation/run', (req, res) => {
  try {
    const timeWindow = Number(req.body?.timeWindow ?? 72);
    const report = runPhEvaluation({ dataset: 'public-health', timeWindow });
    fs.mkdirSync(PH_EVAL_RESULTS_DIR, { recursive: true });
    const outPath = path.join(PH_EVAL_RESULTS_DIR, `ph-evaluation-${report.evaluation_date}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return res.json({ success: true, report, source_file: path.basename(outPath) });
  } catch (err) {
    return handlePhmError(err, res);
  }
});

/**
 * GET /api/public-health/meta
 * 支持的区县别名与 API 说明。
 */
router.get('/meta', (_, res) => {
  res.json({
    success: true,
    engine: 'MedWear-PHM',
    supported_districts: DISTRICT_ALIASES,
    endpoints: [
      { method: 'GET', path: '/api/public-health/summary', params: ['date', 'district'] },
      { method: 'GET', path: '/api/public-health/clusters', params: ['timeWindow', 'district'] },
      { method: 'GET', path: '/api/public-health/daily-report', params: ['date', 'district'] },
      { method: 'GET', path: '/api/public-health/investigation/:clusterId', params: ['clusterId'] },
      { method: 'GET', path: '/api/public-health/equity-analysis', params: ['date', 'district'] },
      { method: 'POST', path: '/api/public-health/register-user', body: ['userId', 'coordinates'] },
      { method: 'GET', path: '/api/public-health/evaluation', params: [] },
      { method: 'POST', path: '/api/public-health/evaluation/run', body: ['timeWindow'] },
    ],
    validators: { date: 'YYYY-MM-DD', timeWindow: '1-720 hours', ses: ['low', 'medium', 'high', 'unknown'] },
  });
});

module.exports = router;
