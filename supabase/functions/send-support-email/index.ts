import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const TO_EMAIL = 'anarchy.lat@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0f; color: #f1f1f1; border-radius: 12px; overflow: hidden;">
  <div style="background: #e11d48; padding: 24px 32px;">
    <h2 style="margin: 0; color: white; font-size: 20px;">📬 New Support Request — Anarchy AI</h2>
  </div>
  <div style="padding: 32px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #9ca3af; width: 100px; vertical-align: top;">Name</td>
        <td style="padding: 8px 0; color: #f1f1f1; font-weight: 600;">${name}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #9ca3af; vertical-align: top;">Email</td>
        <td style="padding: 8px 0; color: #f1f1f1;"><a href="mailto:${email}" style="color: #e11d48;">${email}</a></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #9ca3af; vertical-align: top;">Subject</td>
        <td style="padding: 8px 0; color: #f1f1f1;">${subject}</td>
      </tr>
    </table>
    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 20px 0;" />
    <p style="color: #9ca3af; margin: 0 0 8px;">Message:</p>
    <div style="background: rgba(255,255,255,0.04); border-radius: 8px; padding: 16px; color: #f1f1f1; line-height: 1.6; white-space: pre-wrap;">${message}</div>
    <p style="margin-top: 24px; font-size: 12px; color: #4b5563;">Sent from Anarchy AI v0.07 — ${new Date().toUTCString()}</p>
  </div>
</div>
    `.trim();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Anarchy AI Support <support@anarchy.lat>',
        to: [TO_EMAIL],
        reply_to: email,
        subject: `[Support] ${subject}`,
        html: emailBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
