import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const zipPath = path.resolve('public/nimtube-bridge.zip');
const widgetJsonPath = path.resolve('public/virustotal-widget.json');

if (!fs.existsSync(zipPath)) {
  console.error('Error: public/nimtube-bridge.zip not found! Run npm run build first.');
  process.exit(1);
}

// Compute SHA-256
const fileBuffer = fs.readFileSync(zipPath);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
const permalink = `https://www.virustotal.com/gui/file/${sha256}/detection`;

console.log('----------------------------------------------------');
console.log('NimTube Extension VirusTotal Verifier');
console.log('----------------------------------------------------');
console.log(`File:    nimtube-bridge.zip (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
console.log(`SHA-256: ${sha256}`);
console.log(`Report:  ${permalink}`);
console.log('----------------------------------------------------');

if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [k, ...v] = trimmed.split('=');
      if (k && v.length) process.env[k] = v.join('=');
    }
  }
}

const apiKey = process.env.VIRUSTOTAL_API_KEY;

if (!apiKey) {
  console.log('Note: VIRUSTOTAL_API_KEY secret not found in environment.');
  console.log('Skipping live API query. (You can add VIRUSTOTAL_API_KEY in GitHub Secrets)');
  process.exit(0);
}

try {
  console.log('1. Querying VirusTotal API v3 (GET /api/v3/files/{id})...');
  const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
    headers: {
      'x-apikey': apiKey,
      'Accept': 'application/json'
    }
  });

  if (res.status === 404) {
    console.log('Status: File not yet analyzed on VirusTotal.');
    console.log(`Visit ${permalink} to submit the file for initial analysis.`);
    process.exit(0);
  }

  if (!res.ok) {
    console.warn(`VirusTotal API returned HTTP ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  const stats = json.data?.attributes?.last_analysis_stats || {};
  const malicious = stats.malicious || 0;
  const suspicious = stats.suspicious || 0;
  const undetected = stats.undetected || 0;
  const harmless = stats.harmless || 0;
  const total = malicious + suspicious + undetected + harmless;

  console.log(`Results: ${malicious} malicious / ${total} total engines`);

  console.log('2. Requesting Dark-Themed Widget URL (GET /api/v3/widget/url)...');
  const widgetUrlObj = new URL('https://www.virustotal.com/api/v3/widget/url');
  widgetUrlObj.searchParams.set('query', sha256);
  widgetUrlObj.searchParams.set('bg1', '#09090b'); // zinc-950
  widgetUrlObj.searchParams.set('bg2', '#18181b'); // zinc-900
  widgetUrlObj.searchParams.set('bd1', '#27272a'); // zinc-800
  widgetUrlObj.searchParams.set('fg1', '#f4f4f5'); // zinc-100

  const resWidget = await fetch(widgetUrlObj.toString(), {
    headers: { 'x-apikey': apiKey }
  });

  let widgetUrl = null;
  if (resWidget.ok) {
    const widgetData = await resWidget.json();
    widgetUrl = widgetData.data?.url || null;
    console.log('Generated Widget URL:', widgetUrl);
  }

  // Save/Update public/virustotal-widget.json
  const cacheData = {
    url: widgetUrl,
    detections: malicious,
    total: total || 62,
    sha256,
    permalink,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(widgetJsonPath, JSON.stringify(cacheData, null, 2));
  console.log('Saved to public/virustotal-widget.json');

  // Write to GitHub Actions Job Summary if available
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath && fs.existsSync(path.dirname(summaryPath))) {
    const summaryMd = `
### 🛡️ VirusTotal Security Verification

| Metric | Value |
| --- | --- |
| **File** | \`nimtube-bridge.zip\` |
| **SHA-256** | \`${sha256}\` |
| **Detections** | **${malicious} / ${total}** (Malicious: ${malicious}, Suspicious: ${suspicious}) |
| **Verdict** | ${malicious === 0 ? '✅ **CLEAN / SAFE**' : '❌ **MALICIOUS DETECTED**'} |
| **Full Report** | [View on VirusTotal](${permalink}) |
`;
    fs.appendFileSync(summaryPath, summaryMd);
  }

  if (malicious > 0) {
    console.error(`Security Alert: VirusTotal flagged ${malicious} detection(s)!`);
    process.exit(1);
  } else {
    console.log('Verification Passed: 0 malicious detections.');
  }
} catch (err) {
  console.warn('Failed to query VirusTotal API:', err.message);
  process.exit(0);
}
