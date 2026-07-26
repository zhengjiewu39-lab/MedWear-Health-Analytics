/**
 * electron-builder afterPack：对未购买 Apple 开发者证书的 .app 做本地 ad-hoc 签名，
 * 避免 macOS 提示「文件已损坏」。
 */
const { execSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (process.platform !== 'darwin') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  try {
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: 'inherit' });
    console.log('[MedWear] ad-hoc 签名完成:', appPath);
  } catch (err) {
    console.warn('[MedWear] ad-hoc 签名失败，用户需手动 xattr -cr:', err.message);
  }
};
