const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fullName, email, phone, flightDetails } = await req.json();
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ error: 'Email not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fd = flightDetails || {};
    const htmlBody = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#0891b2,#0284c7);padding:28px 24px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;">✈️ New Booking Lead</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="color:#0891b2;font-size:16px;margin:0 0 16px;">Customer Details</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 12px;background:#f0f9ff;font-weight:600;width:120px;border-radius:4px 0 0 4px;">Name</td><td style="padding:8px 12px;background:#f0f9ff;border-radius:0 4px 4px 0;">${fullName}</td></tr>
            <tr><td style="padding:8px 12px;font-weight:600;">Email</td><td style="padding:8px 12px;">${email}</td></tr>
            <tr><td style="padding:8px 12px;background:#f0f9ff;font-weight:600;border-radius:4px 0 0 4px;">Phone</td><td style="padding:8px 12px;background:#f0f9ff;border-radius:0 4px 4px 0;">${phone}</td></tr>
          </table>
          <h2 style="color:#0891b2;font-size:16px;margin:24px 0 16px;">Flight Details</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 12px;background:#f0f9ff;font-weight:600;width:120px;border-radius:4px 0 0 4px;">Route</td><td style="padding:8px 12px;background:#f0f9ff;border-radius:0 4px 4px 0;">${fd.origin || '—'} → ${fd.destination || '—'}</td></tr>
            <tr><td style="padding:8px 12px;font-weight:600;">Airline</td><td style="padding:8px 12px;">${fd.airline || '—'}</td></tr>
            <tr><td style="padding:8px 12px;background:#f0f9ff;font-weight:600;border-radius:4px 0 0 4px;">Price</td><td style="padding:8px 12px;background:#f0f9ff;border-radius:0 4px 4px 0;font-weight:700;color:#0891b2;">${fd.price || '—'}</td></tr>
            <tr><td style="padding:8px 12px;font-weight:600;">Stops</td><td style="padding:8px 12px;">${fd.stops != null ? fd.stops : '—'}</td></tr>
            ${fd.deal ? `<tr><td style="padding:8px 12px;background:#fef3c7;font-weight:600;border-radius:4px 0 0 4px;">Deal</td><td style="padding:8px 12px;background:#fef3c7;border-radius:0 4px 4px 0;">${fd.deal}</td></tr>` : ''}
          </table>
        </div>
        <div style="padding:16px 24px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;">
          AeroScout Booking System · ${new Date().toISOString().split('T')[0]}
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: 'AeroScout <onboarding@resend.dev>',
        to: ['karamgulati25@gmail.com'],
        subject: `✈️ New Booking: ${fullName} — ${fd.origin || ''} → ${fd.destination || ''}`,
        html: htmlBody,
      }),
    });

    const result = await res.json();
    console.log('Resend response:', JSON.stringify(result));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Email error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
