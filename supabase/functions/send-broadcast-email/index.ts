import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ADMIN_EMAIL = 'anarchy.lat@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify JWT & Get User
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Security Safeguard: Only the administrator can trigger this function
    if (user.email !== ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse Request Parameters
    const { subject, customHtml, previewOnly = true } = await req.json().catch(() => ({}));

    const emailSubject = subject || 'تحديثات Anarchy AI الجديدة - استمتعوا بمحركات الفيديو والتصميم الجديدة! 🚀';

    // 4. Default Arabic Update Newsletter Template (Anarchy AI style: dark mode with red/rose branding)
    const defaultHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #08080a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #f1f1f1; direction: rtl; text-align: right;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #08080a; padding: 20px 0;">
    <tr>
      <td align="center">
        <!-- Card Container -->
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d0d0f; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); padding: 40px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 1px;">Anarchy AI</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.85); font-size: 16px;">عصر جديد لتوليد الفيديو والتصاميم المعمارية بالذكاء الاصطناعي</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="color: #ffffff; font-size: 22px; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid rgba(225, 29, 72, 0.1); padding-bottom: 12px;">مرحباً بكم يا مجتمع Anarchy AI الرائع! 👋</h2>
              <p style="color: #9ca3af; font-size: 15px; line-height: 1.8; margin-bottom: 24px;">
                يسعدنا جداً مشاركة أحدث التحديثات الضخمة والمميزات الجديدة لنسخة <b>v0.3.59</b>. لقد عملنا بجد لنمنحكم أفضل وأقوى محركات توليد الذكاء الاصطناعي في السوق لجعل مشاريعكم تنبض بالحياة. إليكم أهم ما تم إضافته:
              </p>

              <!-- Feature 1 -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; background: rgba(255,255,255,0.02); border-radius: 8px; border-right: 4px solid #e11d48; padding: 12px 16px;">
                <tr>
                  <td>
                    <h3 style="color: #ffffff; margin: 0 0 6px; font-size: 16px;">🎬 7 محركات فيديو احترافية جديدة</h3>
                    <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.6;">
                      أضفنا محركات رائدة عالمياً: <b>Veo 3.1</b>، <b>Kling v3</b>، <b>Sora 2 Pro</b>، <b>Seedance 2.0</b>، <b>Grok Video</b>، <b>Pruna P-Video</b>، و <b>PixVerse v6</b>. تحكم كامل بالدقة والنسب والمقاطع الصوتية المصاحبة للفيديو.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Feature 2 -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; background: rgba(255,255,255,0.02); border-radius: 8px; border-right: 4px solid #e11d48; padding: 12px 16px;">
                <tr>
                  <td>
                    <h3 style="color: #ffffff; margin: 0 0 6px; font-size: 16px;">⚡ محركات الصور فائقة السرعة Nano Banana 2 Lite & Seedream 5</h3>
                    <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.6;">
                      توليد صور فوري وفائق السرعة مع محرك <b>Google Nano Banana 2 Lite</b>، وجودة فنية مذهلة مع أنماط فنية معدة مسبقاً في محرك <b>Seedream 5</b> المميز.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Feature 3 -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; background: rgba(255,255,255,0.02); border-radius: 8px; border-right: 4px solid #e11d48; padding: 12px 16px;">
                <tr>
                  <td>
                    <h3 style="color: #ffffff; margin: 0 0 6px; font-size: 16px;">🏛️ 19 تأثيراً معمارياً سينمائياً للفيديو (مترجمة للعربية بالكامل!)</h3>
                    <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.6;">
                      مكتبة موجهات حصرية مخصصة للمعماريين: تحويل المخططات إلى حقيقة (Blueprint to Reality)، مراحل البناء خطوة بخطوة، الأشعة السينية للهياكل، والمشاهد عبر الفصول السنوية، بلمسة سينمائية احترافية.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Feature 4 -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background: rgba(255,255,255,0.02); border-radius: 8px; border-right: 4px solid #e11d48; padding: 12px 16px;">
                <tr>
                  <td>
                    <h3 style="color: #ffffff; margin: 0 0 6px; font-size: 16px;">💳 تجديد شامل لصفحة الحساب والـ Credits</h3>
                    <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.6;">
                      أعدنا تصميم صفحة حسابك بالكامل بواجهة داكنة متميزة تتيح لك متابعة رصيد نقاطك لحظة بلحظة، الشحن المباشر عبر Stripe، تتبع إحصائيات استخدامك، وإدارة إعدادات الأمان والخصوصية بكل سهولة.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="color: #9ca3af; font-size: 15px; line-height: 1.8; margin-bottom: 28px;">
                والمزيد من التحسينات التي تشمل أبعاد الفيديو التكيفية الذكية لتناسب الصورة المرجعية مباشرة، وتحسين سرعة تشغيل مقاطع الفيديو داخل الـ Lightbox بنقرة واحدة.
              </p>

              <!-- Call to Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="https://anarchy.lat" style="background-color: #e11d48; color: #ffffff; padding: 14px 36px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3);">ابدأ بالتجربة الآن 🚀</a>
                  </td>
                </tr>
              </table>

              <p style="color: #e11d48; font-weight: 600; text-align: center; margin: 0;">استمتعوا بالتحديثات الجديدة وشاركونا إبداعاتكم!</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center; background-color: #0b0b0d; border-top: 1px solid rgba(255, 255, 255, 0.03);">
              <p style="margin: 0; color: #4b5563; font-size: 12px;">© ${new Date().getFullYear()} Anarchy AI. جميع الحقوق محفوظة.</p>
              <p style="margin: 6px 0 0; color: #4b5563; font-size: 12px;">تصلك هذه الرسالة لأنك مستخدم مسجل في Anarchy AI.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const htmlContent = customHtml || defaultHtml;

    // 5. Execute flow based on previewOnly flag
    if (previewOnly) {
      // Send single test email to admin
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Anarchy AI <updates@anarchy.lat>',
          to: [ADMIN_EMAIL],
          reply_to: 'support@anarchy.lat',
          subject: `[PREVIEW] ${emailSubject}`,
          html: htmlContent,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('[preview] Resend error:', err);
        return new Response(
          JSON.stringify({ error: 'Failed to send preview email', details: err }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, preview: true, recipient: ADMIN_EMAIL }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // LIVE BLAST: Fetch all registered users
      const allUsers: string[] = [];
      let page = 1;
      const perPage = 1000;

      while (true) {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });

        if (listError) {
          console.error('List users error:', listError);
          return new Response(
            JSON.stringify({ error: 'Failed to retrieve subscribers list', details: listError }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!users || users.length === 0) break;

        for (const u of users) {
          if (u.email) {
            allUsers.push(u.email);
          }
        }

        if (users.length < perPage) break;
        page++;
      }

      if (allUsers.length === 0) {
        return new Response(
          JSON.stringify({ success: true, preview: false, recipientCount: 0, message: 'No registered users found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Chunk users into batches of 100 (Resend batch API limit)
      const batches: string[][] = [];
      for (let i = 0; i < allUsers.length; i += 100) {
        batches.push(allUsers.slice(i, i + 100));
      }

      let successfulSends = 0;
      for (const batch of batches) {
        // Construct batch request body
        const batchBody = batch.map((email) => ({
          from: 'Anarchy AI <updates@anarchy.lat>',
          to: [email],
          reply_to: 'support@anarchy.lat',
          subject: emailSubject,
          html: htmlContent,
        }));

        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batchBody),
        });

        if (!res.ok) {
          const err = await res.text();
          console.error(`Batch send failure for ${batch.length} recipients:`, err);
          // We continue sending to other batches instead of failing the whole request halfway through
        } else {
          successfulSends += batch.length;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          preview: false,
          totalSubscribers: allUsers.length,
          successfulSends,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
