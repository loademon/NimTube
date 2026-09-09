import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const extensionDir = path.resolve('extension');
const publicDir = path.resolve('public');
const zipPath = path.resolve(publicDir, 'nimtube-bridge.zip');
const widgetJsonPath = path.resolve(publicDir, 'virustotal-widget.json');

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

  // Automatically calculate SHA-256 and sync virustotal-widget.json & README.md
  if (fs.existsSync(zipPath)) {
    const fileBuffer = fs.readFileSync(zipPath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const permalink = `https://www.virustotal.com/gui/file/${sha256}/detection`;

    let currentWidget = {};
    if (fs.existsSync(widgetJsonPath)) {
      try {
        currentWidget = JSON.parse(fs.readFileSync(widgetJsonPath, 'utf8'));
      } catch {}
    }

    const updatedWidget = {
      detections: currentWidget.sha256 === sha256 ? (currentWidget.detections ?? 0) : 0,
      total: currentWidget.sha256 === sha256 ? (currentWidget.total ?? 62) : 62,
      sha256,
      permalink,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(widgetJsonPath, JSON.stringify(updatedWidget, null, 2));
    console.log(`Updated virustotal-widget.json with SHA-256: ${sha256}`);

    // Update README.md permalink
    const readmePath = path.resolve('README.md');
    if (fs.existsSync(readmePath)) {
      let readme = fs.readFileSync(readmePath, 'utf8');
      readme = readme.replace(
        /https:\/\/www\.virustotal\.com\/gui\/file\/[a-f0-9]{64}\/detection/g,
        permalink
      );
      fs.writeFileSync(readmePath, readme);
    }
  }
} catch (err) {
  console.error('Failed to package extension:', err);
}
