import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const apiKey = Deno.env.get('REVE_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'REVE_API_KEY is not set on the server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = {
    prompt: 'A modern bright architectural room design with a large window and a single black chair',
    aspect_ratio: '1:1'
  };

  console.log('Fetching from Reve API with payload:', payload);

  try {
    const res = await fetch('https://api.reve.com/v2/image/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const status = res.status;
    const contentType = res.headers.get('Content-Type') || 'application/json';
    const bodyText = await res.text();

    console.log(`Reve API response status: ${status}`);

    return new Response(bodyText, {
      status,
      headers: { 'Content-Type': contentType }
    });

  } catch (err) {
    console.error('Fetch error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
