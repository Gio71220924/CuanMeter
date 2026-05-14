const fs = require('fs');
const https = require('https');
const path = require('path');

const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_BUCKET',
  'SUPABASE_MODEL_PATH',
];

const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'best_models.pkl');
const tempPath = outputPath + '.tmp';
const forceDownload = process.env.FORCE_MODEL_DOWNLOAD === '1';

function normalizeSupabaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function encodeObjectPath(objectPath) {
  return String(objectPath || '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function assertEnv() {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing env: ${missing.join(', ')}`);
  }
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const request = https.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => { body += chunk; });
          response.on('end', () => {
            file.close(() => fs.rm(destination, { force: true }, () => {}));
            reject(new Error(`Supabase download failed (${response.statusCode}): ${body.slice(0, 300)}`));
          });
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }
    );

    request.on('error', (error) => {
      file.close(() => fs.rm(destination, { force: true }, () => {}));
      reject(error);
    });

    request.setTimeout(30000, () => {
      request.destroy(new Error('Supabase model download timed out'));
    });
  });
}

async function main() {
  if (!forceDownload && fs.existsSync(outputPath)) {
    const stat = fs.statSync(outputPath);
    if (stat.size > 0) {
      console.log(`[Model] best_models.pkl already exists (${stat.size} bytes), skip download.`);
      return;
    }
  }

  assertEnv();

  const baseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const bucket = encodeURIComponent(process.env.SUPABASE_BUCKET);
  const objectPath = encodeObjectPath(process.env.SUPABASE_MODEL_PATH);
  const url = `${baseUrl}/storage/v1/object/${bucket}/${objectPath}`;

  console.log(`[Model] Downloading ${process.env.SUPABASE_BUCKET}/${process.env.SUPABASE_MODEL_PATH} from Supabase...`);
  await downloadFile(url, tempPath);
  fs.renameSync(tempPath, outputPath);

  const stat = fs.statSync(outputPath);
  if (stat.size === 0) {
    throw new Error('Downloaded model is empty');
  }

  console.log(`[Model] Saved best_models.pkl (${stat.size} bytes).`);
}

main().catch((error) => {
  console.error('[Model] Download failed:', error.message);
  process.exit(1);
});
