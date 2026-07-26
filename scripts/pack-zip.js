#!/usr/bin/env node
/**
 * 打包可分发 zip（不含 node_modules，含 build 与源码）
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const name = 'MedWear-Health-Analytics';
const outZip = path.join(distDir, `${name}.zip`);

if (!fs.existsSync(path.join(root, 'build', 'index.html'))) {
  console.log('[pack] 正在构建前端...');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

fs.mkdirSync(distDir, { recursive: true });

const excludes = [
  'node_modules',
  'dist',
  '.git',
  'build/static/js/*.map',
  '.env',
  'data/health-store.json',
].map((e) => `--exclude=${e}`).join(' ');

try {
  if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
  execSync(
    `cd "${path.dirname(root)}" && zip -r "${outZip}" "${path.basename(root)}" ${excludes}`,
    { stdio: 'inherit' },
  );
  console.log(`\n[pack] 已生成: ${outZip}`);
  console.log('[pack] 使用者解压后执行: npm install && npm run app\n');
} catch {
  console.error('[pack] zip 失败。macOS/Linux 需安装 zip；或手动压缩项目文件夹（排除 node_modules）。');
  process.exit(1);
}
