import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const extensionDir = path.resolve('extension');
const publicDir = path.resolve('public');
const zipPath = path.resolve(publicDir, 'nimtube-bridge.zip');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

try {
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${extensionDir}\\*' -DestinationPath '${zipPath}' -Force"`);
  } else {
    execSync(`cd "${extensionDir}" && zip -r "${zipPath}" .`);
  }
  console.log('NimTube Bridge packaged to:', zipPath);
} catch (err) {
  console.error('Failed to package extension:', err);
}
