/**
 * Cloudflare Worker: Thermal Photobooth Kiosk R2 Gateway
 * Handles photo uploads directly to Cloudflare R2 bucket and serves public download URLs for receipt QR codes.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    try {
      // 1. Health check & status
      if (pathname === '/' || pathname === '/api/status') {
        const hasBucket = Boolean(env.PHOTO_BUCKET);
        return jsonResponse({
          status: 'ONLINE',
          service: 'Thermal Photobooth R2 Cloud Gateway',
          version: '1.0.0',
          r2BucketBound: hasBucket,
          bucketBinding: 'PHOTO_BUCKET',
          instruction: hasBucket
            ? 'R2 bucket connected and ready to store photobooth strips.'
            : 'Belum ada R2 Bucket yang di-bind. Silakan buka Settings > Bindings di dashboard Cloudflare Workers.',
          endpoints: {
            upload: 'POST /upload (Base64 atau binary PNG)',
            viewPhoto: 'GET /photo/:filename',
            listPhotos: 'GET /list'
          }
        });
      }

      // 2. Upload Photo Strip to R2 (POST /upload)
      if (pathname === '/upload' && request.method === 'POST') {
        if (!env.PHOTO_BUCKET) {
          return jsonResponse({
            success: false,
            error: "R2 bucket binding 'PHOTO_BUCKET' belum aktif. Buka Settings > Variables & Bindings di dashboard Worker ini lalu hubungkan R2 bucket."
          }, 503);
        }

        const contentType = request.headers.get('content-type') || '';
        let filename = `PRINT-${Date.now()}.png`;
        let imageBytes = null;
        let metadata = {};

        if (contentType.includes('application/json')) {
          const body = await request.json();
          if (body.filename) filename = body.filename;
          else if (body.printId) filename = `${body.printId}.png`;

          if (!body.imageBase64 && !body.image) {
            return jsonResponse({ success: false, error: 'imageBase64 atau image payload diperlukan' }, 400);
          }

          const rawBase64 = (body.imageBase64 || body.image).replace(/^data:image\/\w+;base64,/, '');
          imageBytes = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
          metadata = {
            sessionId: String(body.sessionId || ''),
            printId: String(body.printId || ''),
            kioskId: String(body.kioskId || 'KIOSK-04'),
            createdAt: new Date().toISOString()
          };
        } else {
          // Direct binary upload
          const queryFilename = url.searchParams.get('filename');
          if (queryFilename) filename = queryFilename;
          imageBytes = await request.arrayBuffer();
        }

        // Save to Cloudflare R2
        await env.PHOTO_BUCKET.put(filename, imageBytes, {
          httpMetadata: {
            contentType: 'image/png',
            cacheControl: 'public, max-age=31536000'
          },
          customMetadata: metadata
        });

        const publicUrl = `${url.origin}/photo/${filename}`;

        return jsonResponse({
          success: true,
          key: filename,
          url: publicUrl,
          sizeBytes: imageBytes.byteLength || imageBytes.length,
          uploadedAt: new Date().toISOString()
        });
      }

      // 3. Serve Photo Strip from R2 (GET /photo/:key or GET /prints/:key)
      if (pathname.startsWith('/photo/') || pathname.startsWith('/prints/')) {
        if (!env.PHOTO_BUCKET) {
          return new Response("R2 bucket binding 'PHOTO_BUCKET' not configured", { status: 503 });
        }

        const key = pathname.replace(/^\/(photo|prints)\//, '');
        if (!key) {
          return new Response('File key tidak disertakan', { status: 400 });
        }

        const object = await env.PHOTO_BUCKET.get(key);
        if (!object) {
          return new Response(`Foto "${key}" tidak ditemukan di Cloudflare R2.`, {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Access-Control-Allow-Origin', '*');
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'image/png');
        }

        return new Response(object.body, { headers });
      }

      // 4. List Photos in R2 (GET /list)
      if (pathname === '/list' && request.method === 'GET') {
        if (!env.PHOTO_BUCKET) {
          return jsonResponse({ success: false, error: 'PHOTO_BUCKET binding not found' }, 503);
        }

        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const listed = await env.PHOTO_BUCKET.list({ limit });
        
        const files = listed.objects.map(obj => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
          url: `${url.origin}/photo/${obj.key}`,
          metadata: obj.customMetadata || {}
        }));

        return jsonResponse({
          success: true,
          count: files.length,
          truncated: listed.truncated,
          files
        });
      }

      // Not found fallback
      return jsonResponse({ error: 'Not Found', path: pathname }, 404);

    } catch (err) {
      return jsonResponse({
        success: false,
        error: err.message,
        stack: err.stack
      }, 500);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}
