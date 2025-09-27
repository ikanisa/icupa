#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN; // Supabase user JWT (must be staff for tenant)
const LOCATION_ID = process.env.SMOKE_LOCATION_ID;
const MENU_ID = process.env.SMOKE_MENU_ID;
const IMAGE_PATH = process.env.SMOKE_IMAGE_PATH;

if (!SUPABASE_URL || !ACCESS_TOKEN || !LOCATION_ID || !MENU_ID || !IMAGE_PATH) {
  console.error('Missing env. Required: SUPABASE_URL, SUPABASE_ACCESS_TOKEN, SMOKE_LOCATION_ID, SMOKE_MENU_ID, SMOKE_IMAGE_PATH');
  process.exit(1);
}

function detectContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
}

async function callFunction(name, body) {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    // Edge function uses bearer user token
      'authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Function ${name} failed ${res.status}: ${text}`);
  }
  return json;
}

async function main() {
  const file = await fs.readFile(IMAGE_PATH);
  const filename = path.basename(IMAGE_PATH);
  const contentType = detectContentType(filename);

  console.log('▶ Starting ingestion');
  const start = await callFunction('ingest_menu_start', {
    location_id: LOCATION_ID,
    original_filename: filename,
    file_mime: contentType,
    request_signed_upload: true,
  });
  const ingestionId = start.ingestion_id;
  if (!ingestionId) throw new Error('No ingestion_id returned');
  console.log('  ingestion_id:', ingestionId);

  if (start.upload_url) {
    console.log('▶ Uploading asset to signed URL');
    const put = await fetch(start.upload_url, {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body: file,
    });
    if (!put.ok) throw new Error(`Signed upload failed ${put.status}`);
  } else {
    console.log('  No signed upload URL returned (object may already exist).');
  }

  console.log('▶ Processing ingestion');
  const proc = await callFunction('ingest_menu_process', { ingestion_id: ingestionId });
  console.log('  items_count:', proc.items_count, 'pages_processed:', proc.pages_processed);

  console.log('▶ Publishing to menu');
  const pub = await callFunction('ingest_menu_publish', { ingestion_id: ingestionId, menu_id: MENU_ID });
  console.log('✅ Published:', pub);

  console.log('\nSummary');
  console.log(JSON.stringify({ ingestion_id: ingestionId, process: proc, publish: pub }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

