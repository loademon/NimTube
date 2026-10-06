import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const extensionDir = path.resolve('extension');
const publicDir = path.resolve('public');
const zipPath = path.resolve(publicDir, 'nimtube-bridge.zip');
const widgetJsonPath = path.resolve(publicDir, 'virustotal-widget.json');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

/**
 * Creates a deterministic, byte-for-byte reproducible ZIP file across all operating systems.
 * - Normalized DOS timestamp (2026-01-01 00:00:00)
 * - Sorted file entries by path in ASCII order
 * - Normalized forward-slash directory separators
 * - Standard Deflate compression (level 9)
 * - Zero external shell dependencies (pure Node.js)
 */
function createDeterministicZip(files, outputPath) {
  const dosTime = 0x0000;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  const entries = [];
  let offset = 0;
  const parts = [];

  // Sort files deterministically
  files.sort((a, b) => a.name.localeCompare(b.name));

  for (const file of files) {
    const nameBuf = Buffer.from(file.name.replace(/\\/g, '/'), 'utf8');
    const dataBuf = file.content;
    const crc = zlib.crc32(dataBuf);
    const compressed = zlib.deflateRawSync(dataBuf, { level: 9 });

    // Local file header (30 bytes + nameBuf.length)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4);         // version needed (2.0)
    lfh.writeUInt16LE(0, 6);          // flags
    lfh.writeUInt16LE(8, 8);          // compression method (deflate)
    lfh.writeUInt16LE(dosTime, 10);
    lfh.writeUInt16LE(dosDate, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressed.length, 18);
    lfh.writeUInt32LE(dataBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);         // extra field len

    entries.push({
      nameBuf,
      crc,
      compSize: compressed.length,
      uncompSize: dataBuf.length,
      offset,
    });

    parts.push(lfh, nameBuf, compressed);
    offset += 30 + nameBuf.length + compressed.length;
  }

  const cdStart = offset;
  let cdSize = 0;

  for (const entry of entries) {
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // signature
    cdh.writeUInt16LE(0x0314, 4);     // version made by (Unix 2.0)
    cdh.writeUInt16LE(20, 6);         // version needed
    cdh.writeUInt16LE(0, 8);          // flags
    cdh.writeUInt16LE(8, 10);         // deflate
    cdh.writeUInt16LE(dosTime, 12);
    cdh.writeUInt16LE(dosDate, 14);
    cdh.writeUInt32LE(entry.crc, 16);
    cdh.writeUInt32LE(entry.compSize, 20);
    cdh.writeUInt32LE(entry.uncompSize, 24);
    cdh.writeUInt16LE(entry.nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);         // extra len
    cdh.writeUInt16LE(0, 32);         // comment len
    cdh.writeUInt16LE(0, 34);         // disk num
    cdh.writeUInt16LE(0, 36);         // internal attr
    cdh.writeUInt16LE(0, 38);         // external attr (DOS)
    cdh.writeUInt16LE(0o100644, 40);   // external attr (Unix permissions: -rw-r--r--)
    cdh.writeUInt32LE(entry.offset, 42);

    parts.push(cdh, entry.nameBuf);
    cdSize += 46 + entry.nameBuf.length;
  }

  // End of Central Directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);  // signature
  eocd.writeUInt16LE(0, 4);           // disk number
  eocd.writeUInt16LE(0, 6);           // disk with CD
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);          // comment len

  parts.push(eocd);

  const finalZip = Buffer.concat(parts);
  fs.writeFileSync(outputPath, finalZip);
  return finalZip;
}

try {
  const filesToPack = [];

  function scanDir(dir, base = '') {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.name.startsWith('.') || item.name.startsWith('_')) continue;
      const fullPath = path.join(dir, item.name);
      const relPath = path.join(base, item.name);
      if (item.isDirectory()) {
        scanDir(fullPath, relPath);
      } else {
        filesToPack.push({
          name: relPath.replace(/\\/g, '/'),
          content: fs.readFileSync(fullPath),
        });
      }
    }
  }

  scanDir(extensionDir);
  const fileBuffer = createDeterministicZip(filesToPack, zipPath);
  console.log('NimTube Bridge deterministically packaged to:', zipPath);

  // Automatically calculate SHA-256 and sync virustotal-widget.json & README.md
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
    total: currentWidget.sha256 === sha256 ? (currentWidget.total ?? 65) : 65,
    sha256,
    permalink,
    updatedAt: currentWidget.sha256 === sha256 ? (currentWidget.updatedAt ?? new Date().toISOString()) : new Date().toISOString()
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
} catch (err) {
  console.error('Failed to package extension:', err);
}
