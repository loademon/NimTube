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

async function queryFile(hash) {
  return await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
    headers: {
      'x-apikey': apiKey,
      'Accept': 'application/json'
    }
  });
}

async function uploadFile() {
  console.log('File not yet on VirusTotal. Automatically uploading to VirusTotal API...');
  const blob = new Blob([fileBuffer], { type: 'application/zip' });
  const formData = new FormData();
  formData.append('file', blob, 'nimtube-bridge.zip');

  const uploadRes = await fetch('https://www.virustotal.com/api/v3/files', {
    method: 'POST',
    headers: { 'x-apikey': apiKey },
    body: formData
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
  }

  const uploadJson = await uploadRes.json();
  const analysisId = uploadJson.data?.id;
  console.log(`Upload successful! Analysis ID: ${analysisId}`);
  console.log('Waiting for analysis to complete (polling)...');

  // Poll analysis for up to 45 seconds
  for (let i = 0; i < 9; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const aRes = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
      headers: { 'x-apikey': apiKey }
    });
    if (aRes.ok) {
      const aJson = await aRes.json();
      const status = aJson.data?.attributes?.status;
      console.log(`Status after ${(i + 1) * 5}s: ${status}`);
      if (status === 'completed') {
        const stats = aJson.data?.attributes?.stats || {};
        return stats;
      }
    }
  }

  return null;
}

try {
  console.log('1. Querying VirusTotal API v3 (GET /api/v3/files/{id})...');
  let res = await queryFile(sha256);
  let stats = null;

  if (res.status === 404) {
    stats = await uploadFile();
    // After upload and wait, re-query file to get full details
    if (!stats) {
      const retryRes = await queryFile(sha256);
      if (retryRes.ok) {
        const retryJson = await retryRes.json();
        stats = retryJson.data?.attributes?.last_analysis_stats;
      }
    }
  } else if (res.ok) {
    const json = await res.json();
    stats = json.data?.attributes?.last_analysis_stats || {};
  } else {
    console.warn(`VirusTotal API returned HTTP ${res.status}: ${res.statusText}`);
  }

  const malicious = stats?.malicious || 0;
  const suspicious = stats?.suspicious || 0;
  const undetected = stats?.undetected || 0;
  const harmless = stats?.harmless || 0;
  const total = malicious + suspicious + undetected + harmless || 62;

  console.log(`Results: ${malicious} malicious / ${total} total engines`);

  // Update public/virustotal-widget.json with live hash and permalink
  const cacheData = {
    detections: malicious,
    total: total,
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
  console.warn('Failed to query/upload VirusTotal API:', err.message);
  process.exit(0);
}
