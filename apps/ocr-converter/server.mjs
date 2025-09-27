import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT ?? 8789);
const TOKEN = process.env.OCR_CONVERTER_TOKEN ?? '';

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  });
  res.end(payload);
}

async function bufferToBase64(buf) {
  // Node 20 has global Buffer
  return Buffer.from(buf).toString('base64');
}

async function handleConvert(req, res) {
  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', async () => {
    try {
      if (TOKEN) {
        const auth = req.headers['authorization'] || req.headers['Authorization'];
        if (!auth || !String(auth).toLowerCase().startsWith('bearer ')) {
          return json(res, 401, { error: { code: 'unauthorized', message: 'Bearer token required' } });
        }
        const provided = String(auth).slice(7).trim();
        if (provided !== TOKEN) {
          return json(res, 401, { error: { code: 'unauthorized', message: 'Invalid bearer token' } });
        }
      }

      let payload;
      try {
        payload = JSON.parse(raw || '{}');
      } catch (_) {
        return json(res, 400, { error: { code: 'invalid_json', message: 'Request body must be valid JSON' } });
      }

      const sourceUrl = (payload?.source_url ?? '').trim();
      if (!sourceUrl) {
        return json(res, 400, { error: { code: 'missing_source', message: 'source_url is required' } });
      }

      let response;
      try {
        response = await fetch(sourceUrl);
      } catch (err) {
        return json(res, 502, { error: { code: 'fetch_failed', message: 'Unable to fetch source_url' } });
      }

      if (!response.ok) {
        const text = await response.text();
        return json(res, 502, { error: { code: 'fetch_failed', message: `Fetch error ${response.status}: ${text}` } });
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/pdf') || /\.pdf(\?.*)?$/i.test(sourceUrl)) {
        // Placeholder: PDF→image conversion is not implemented in this lightweight shim.
        return json(res, 501, {
          error: {
            code: 'pdf_not_supported',
            message:
              'This converter shim does not process PDFs. Deploy a full converter or provide pre-rendered images.'
          }
        });
      }

      if (!contentType.startsWith('image/')) {
        return json(res, 415, {
          error: { code: 'unsupported_media_type', message: `Unsupported content-type: ${contentType}` }
        });
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = await bufferToBase64(arrayBuffer);

      return json(res, 200, {
        images: [
          {
            page: 1,
            base64,
            content_type: contentType
          }
        ]
      });
    } catch (error) {
      return json(res, 500, { error: { code: 'internal_error', message: String(error?.message ?? error) } });
    }
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'POST' && url.pathname === '/convert') {
    return handleConvert(req, res);
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { status: 'ok', uptime_seconds: process.uptime() });
  }
  return json(res, 404, { error: { code: 'not_found', message: 'Not found' } });
});

server.listen(PORT, () => {
  console.log(`OCR converter shim listening on http://localhost:${PORT}`);
});

