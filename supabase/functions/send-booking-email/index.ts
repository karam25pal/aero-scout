import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'karamgulati25@gmail.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fullName, email, phone, flightDetails } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!RESEND_API_KEY) {
      console.log('RESEND_API_KEY not configured — logging booking instead');
      console.log('=== NEW BOOKING ===');
      console.log(`Name: ${fullName}`);
      console.log(`Email: ${email}`);
      console.log(`Phone: ${phone}`);
      console.log(`Flight: ${JSON.stringify(flightDetails)}`);
      console.log('===================');
      return new Response(JSON.stringify({ success: true, method: 'logged' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SkySearch Bookings <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject: `New Booking: ${fullName} — ${flightDetails.origin} → ${flightDetails.destination}`,
        html: `
          <h2>New Flight Booking Request</h2>
          <table style="border-collapse:collapse;width:100%;max-width:500px">
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Name</td><td style="padding:8px;border:1px solid #ddd">${fullName}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Email</td><td style="padding:8px;border:1px solid #ddd">${email}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Phone</td><td style="padding:8px;border:1px solid #ddd">${phone}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Route</td><td style="padding:8px;border:1px solid #ddd">${flightDetails.origin} → ${flightDetails.destination}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Airline</td><td style="padding:8px;border:1px solid #ddd">${flightDetails.airline}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Price</td><td style="padding:8px;border:1px solid #ddd">${flightDetails.price}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Stops</td><td style="padding:8px;border:1px solid #ddd">${flightDetails.stops === 0 ? 'Nonstop' : flightDetails.stops + ' stop(s)'}</td></tr>
            ${flightDetails.deal ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Deal</td><td style="padding:8px;border:1px solid #ddd">${flightDetails.deal} (was ${flightDetails.originalPrice})</td></tr>` : ''}
          </table>
        `,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Email error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
