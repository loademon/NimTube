import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const browserPaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

const browserExe = browserPaths.find(p => fs.existsSync(p));
if (!browserExe) {
  console.error('No compatible Chromium browser found for rendering screenshots.');
  process.exit(1);
}

function renderHtmlToPng(htmlContent, outputPath, width, height) {
  const tempHtmlPath = path.resolve(`.temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.html`);
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

  try {
    const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;
    const cmd = `powershell -NoProfile -Command "Start-Process -FilePath '${browserExe}' -ArgumentList '--headless=new', '--disable-gpu', '--hide-scrollbars', '--screenshot=\\\"${outputPath}\\\"', '--window-size=${width},${height}', '\\\"${fileUrl}\\\"' -Wait"`;
    execSync(cmd);
    console.log(`Rendered: ${outputPath} (${width}x${height})`);
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
  }
}

// 1. Site Open Graph Banner (1200 x 630) — High-End Editorial Minimal
const siteOgHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px;
      height: 630px;
      background-color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      color: #f4f4f5;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 72px 80px;
      letter-spacing: -0.02em;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-mark {
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-name {
      font-size: 24px;
      font-weight: 600;
      color: #fafafa;
      letter-spacing: -0.03em;
    }
    .domain-badge {
      font-size: 15px;
      color: #71717a;
      font-weight: 500;
      letter-spacing: -0.01em;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 960px;
    }
    .eyebrow {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #a1a1aa;
    }
    .title {
      font-size: 58px;
      font-weight: 600;
      line-height: 1.12;
      color: #ffffff;
      letter-spacing: -0.04em;
    }
    .description {
      font-size: 21px;
      line-height: 1.5;
      color: #71717a;
      font-weight: 400;
      letter-spacing: -0.015em;
      max-width: 860px;
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #18181b;
      padding-top: 24px;
    }
    .specs {
      display: flex;
      align-items: center;
      gap: 20px;
      font-size: 13px;
      color: #52525b;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 500;
    }
    .specs span {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .meta {
      font-size: 13px;
      color: #52525b;
      letter-spacing: 0.04em;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-mark">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none">
          <path d="M5 19V5L19 19V5" stroke="#f4f4f5" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="brand-name">NimTube</span>
    </div>
    <span class="domain-badge">nimtube.tr</span>
  </div>

  <div class="content">
    <div class="eyebrow">Client-Side Architecture</div>
    <h1 class="title">Pure in-browser YouTube studio &amp; media downloader.</h1>
    <p class="description">
      Download 4K, 1080p, and MP3 audio directly via your own internet connection. In-memory lossless remuxing with 64-bit Mediabunny. Zero server bottlenecks, zero tracking.
    </p>
  </div>

  <div class="footer">
    <div class="specs">
      <span>4K 60FPS</span>
      <span>•</span>
      <span>320kbps MP3</span>
      <span>•</span>
      <span>Mediabunny 64-Bit</span>
      <span>•</span>
      <span>Direct-to-Disk</span>
    </div>
    <span class="meta">v1.1.0 • Verified Clean</span>
  </div>
</body>
</html>`;

// 2. GitHub Social Preview (1280 x 640) — High-End Editorial Minimal
const githubSocialHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1280px;
      height: 640px;
      background-color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      color: #f4f4f5;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 76px 88px;
      letter-spacing: -0.02em;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-mark {
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-name {
      font-size: 24px;
      font-weight: 600;
      color: #fafafa;
      letter-spacing: -0.03em;
    }
    .license {
      font-size: 13px;
      color: #71717a;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 500;
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 1000px;
    }
    .eyebrow {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #a1a1aa;
    }
    .title {
      font-size: 58px;
      font-weight: 600;
      line-height: 1.12;
      color: #ffffff;
      letter-spacing: -0.04em;
    }
    .description {
      font-size: 21px;
      line-height: 1.5;
      color: #71717a;
      font-weight: 400;
      letter-spacing: -0.015em;
      max-width: 900px;
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #18181b;
      padding-top: 24px;
    }
    .repo {
      font-size: 15px;
      color: #a1a1aa;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .live-app {
      font-size: 14px;
      color: #71717a;
      letter-spacing: 0.02em;
    }
    .live-app strong {
      color: #e4e4e7;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-mark">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none">
          <path d="M5 19V5L19 19V5" stroke="#f4f4f5" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="brand-name">NimTube</span>
    </div>
    <span class="license">Open Source • MIT License</span>
  </div>

  <div class="content">
    <div class="eyebrow">Client-Side Media Engine</div>
    <h1 class="title">Pure in-browser YouTube studio &amp; media engine.</h1>
    <p class="description">
      An open-source browser application for high-resolution video and audio downloading with 64-bit Mediabunny, WebCodecs GPU acceleration, and zero proxy bottlenecks.
    </p>
  </div>

  <div class="footer">
    <span class="repo">github.com/loademon/NimTube</span>
    <span class="live-app">Web App: <strong>https://nimtube.tr</strong></span>
  </div>
</body>
</html>`;

const publicDir = path.resolve('public');
const assetsDir = path.resolve('.github/assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const siteOgPath = path.resolve(publicDir, 'og-image.png');
const githubSocialPath = path.resolve(assetsDir, 'social-preview.png');

renderHtmlToPng(siteOgHtml, siteOgPath, 1200, 630);
renderHtmlToPng(githubSocialHtml, githubSocialPath, 1280, 640);

console.log('Successfully generated clean editorial banners without box frames!');
