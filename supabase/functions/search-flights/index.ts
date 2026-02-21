const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Minimal Protobuf Encoder ──────────────────────────────────
function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v & 0x7f);
  return bytes;
}

function encodeTag(fieldNumber: number, wireType: number): number[] {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeVarintField(fieldNumber: number, value: number): number[] {
  return [...encodeTag(fieldNumber, 0), ...encodeVarint(value)];
}

function encodeLengthDelimited(fieldNumber: number, data: number[]): number[] {
  return [...encodeTag(fieldNumber, 2), ...encodeVarint(data.length), ...data];
}

function encodeString(fieldNumber: number, str: string): number[] {
  const encoder = new TextEncoder();
  const bytes = Array.from(encoder.encode(str));
  return encodeLengthDelimited(fieldNumber, bytes);
}

function encodeAirport(fieldNumber: number, iata: string): number[] {
  const airportMsg = [
    ...encodeVarintField(1, 1),
    ...encodeString(2, iata),
  ];
  return encodeLengthDelimited(fieldNumber, airportMsg);
}

function encodeFlightLeg(date: string, fromIata: string, toIata: string): number[] {
  return [
    ...encodeString(2, date),
    ...encodeAirport(13, fromIata),
    ...encodeAirport(14, toIata),
  ];
}

const SEAT_CLASS_MAP: Record<string, number> = {
  economy: 1,
  premium_economy: 2,
  business: 3,
  first: 4,
};

function buildTfsParam(
  fromIata: string,
  toIata: string,
  departDate: string,
  returnDate?: string,
  adults = 1,
  seatClass = 'economy',
): string {
  const tripType = returnDate ? 1 : 2;
  const seatValue = SEAT_CLASS_MAP[seatClass] || 1;

  const parts: number[] = [];
  parts.push(...encodeVarintField(1, 28));
  parts.push(...encodeVarintField(2, tripType));

  const outboundLeg = encodeFlightLeg(departDate, fromIata, toIata);
  parts.push(...encodeLengthDelimited(3, outboundLeg));

  if (returnDate) {
    const returnLeg = encodeFlightLeg(returnDate, toIata, fromIata);
    parts.push(...encodeLengthDelimited(3, returnLeg));
  }

  parts.push(...encodeVarintField(8, adults));
  parts.push(...encodeVarintField(9, 1));
  parts.push(...encodeVarintField(14, 1));

  const passengersMsg = [
    ...encodeTag(1, 0),
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01,
  ];
  parts.push(...encodeLengthDelimited(16, passengersMsg));
  parts.push(...encodeVarintField(19, seatValue));

  const bytes = new Uint8Array(parts);
  let b64 = btoa(String.fromCharCode(...bytes));
  b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64;
}

// ── HTML Flight Parser ──────────────────────────────────────
function extractFlightDataFromScripts(html: string): string {
  const dataChunks: string[] = [];
  const regex = /AF_initDataCallback\(\s*\{[^}]*data:\s*([\s\S]*?)\}\s*\)\s*;/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const chunk = match[1].trim();
    if (chunk.length > 100) {
      dataChunks.push(chunk);
    }
  }

  if (dataChunks.length > 0) {
    console.log(`Found ${dataChunks.length} AF_initDataCallback chunks`);
    dataChunks.sort((a, b) => b.length - a.length);
    let combined = dataChunks.join('\n---CHUNK---\n');
    if (combined.length > 200000) combined = combined.slice(0, 200000);
    return combined;
  }

  let body = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];
  body = body.replace(/<style[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<link[^>]*>/gi, '');
  body = body.replace(/<meta[^>]*>/gi, '');
  body = body.replace(/<[^>]+>/g, ' ');
  body = body.replace(/\s{2,}/g, ' ');
  if (body.length > 200000) body = body.slice(0, 200000);
  return body;
}

async function parseFlightsWithAI(
  html: string,
  aiKey: string,
  origin: string,
  destination: string,
): Promise<any[]> {
  const content_to_parse = extractFlightDataFromScripts(html);
  console.log(`Sending ${content_to_parse.length} chars to AI for parsing`);

  const prompt = `Extract ALL flight results from this Google Flights page data. The data is from AF_initDataCallback JavaScript arrays. Look for arrays containing flight information: airline names, departure/arrival times, prices, durations, number of stops. Extract EVERY single flight - do not skip any. Return ONLY a valid JSON array of flight objects. Each object must have:
{"airline":"string","airlineLogo":"string or empty","departureTime":"HH:MM","arrivalTime":"HH:MM","duration":"e.g. 7 hr 30 min","durationMinutes":450,"stops":0,"stopsText":"Nonstop or 1 stop","price":299,"origin":"${origin}","destination":"${destination}"}
If no flights found, return []. Return ONLY JSON, no markdown. Extract ALL flights, not just the first few.

Data:
${content_to_parse}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('AI error:', response.status, errText.slice(0, 500));
    throw new Error('Failed to parse flights with AI');
  }

  const data = await response.json();
  let aiContent = data?.choices?.[0]?.message?.content || '[]';
  aiContent = aiContent.trim();
  if (aiContent.startsWith('```')) {
    aiContent = aiContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    const flights = JSON.parse(aiContent);
    return Array.isArray(flights) ? flights : [];
  } catch {
    console.error('AI JSON parse failed:', aiContent.slice(0, 500));
    return [];
  }
}

function transformToAppFormat(flight: any, index: number): any {
  const price = typeof flight.price === 'number'
    ? flight.price
    : parseFloat(String(flight.price).replace(/[^0-9.]/g, ''));
  if (!price || price <= 0) return null;

  return {
    id: `bd-${index}-${Date.now()}`,
    price: { raw: price, formatted: `£${Math.round(price)}` },
    legs: [{
      origin: {
        name: flight.origin || '',
        displayCode: flight.origin || '',
        city: flight.origin || '',
      },
      destination: {
        name: flight.destination || '',
        displayCode: flight.destination || '',
        city: flight.destination || '',
      },
      departure: flight.departureTime || '',
      arrival: flight.arrivalTime || '',
      durationInMinutes: flight.durationMinutes || 0,
      carriers: {
        marketing: [{
          name: flight.airline || 'Unknown',
          logoUrl: flight.airlineLogo || '',
        }],
      },
      stopCount: typeof flight.stops === 'number' ? flight.stops : 0,
    }],
    isSelfTransfer: false,
    tags: [],
  };
}

// ── Main Handler ──────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      originSkyId,
      destinationSkyId,
      originEntityId,
      destinationEntityId,
      date,
      returnDate,
      cabinClass = 'economy',
      adults = 1,
    } = body;

    const origin = originSkyId || originEntityId;
    const destination = destinationSkyId || destinationEntityId;

    if (!origin || !destination || !date) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters', data: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiToken = Deno.env.get('BRIGHTDATA_API_TOKEN');
    const serpZone = Deno.env.get('BRIGHTDATA_SERP_ZONE');
    const fallbackZone = Deno.env.get('BRIGHTDATA_ZONE');
    const aiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!apiToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'BrightData credentials not configured', data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!aiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI key not configured', data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Flight search: ${origin} → ${destination} on ${date}`);

    // Build the tfs parameter and Google Flights URL
    const tfs = buildTfsParam(origin, destination, date, returnDate, adults, cabinClass);
    const flightsUrl = `https://www.google.com/travel/flights/search?tfs=${tfs}&gl=uk&hl=en&curr=GBP`;
    console.log('Google Flights URL:', flightsUrl);

    // Try SERP API first (returns rendered page with all flights), fall back to Web Unlocker
    const zone = serpZone || fallbackZone;
    if (!zone) {
      return new Response(
        JSON.stringify({ success: false, error: 'BrightData zone not configured', data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const useSerpApi = !!serpZone;
    console.log(`Using ${useSerpApi ? 'SERP API' : 'Web Unlocker'} zone: ${zone}`);

    const bdResponse = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        zone,
        url: flightsUrl,
        format: 'raw',
      }),
    });

    if (!bdResponse.ok) {
      const errText = await bdResponse.text();
      console.error('BrightData error:', bdResponse.status, errText.slice(0, 500));
      throw new Error(`BrightData API error: ${bdResponse.status}`);
    }

    const html = await bdResponse.text();
    console.log(`BrightData returned ${html.length} chars`);
    console.log('Response preview:', html.slice(0, 500));

    if (html.length < 1000) {
      console.error('Response too small, likely no flight data. Full response:', html);
      return new Response(
        JSON.stringify({
          success: true,
          data: [],
          meta: { totalCount: 0, hasNextPage: false, next: null },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse flights from HTML using AI
    const rawFlights = await parseFlightsWithAI(html, aiKey, origin, destination);
    console.log(`AI extracted ${rawFlights.length} flights`);

    // Transform to app format
    const flights = rawFlights
      .map((f: any, i: number) => transformToAppFormat(f, i))
      .filter((f: any) => f !== null);

    flights.sort((a: any, b: any) => a.price.raw - b.price.raw);
    console.log(`Returning ${flights.length} flights`);

    return new Response(
      JSON.stringify({
        success: true,
        data: flights,
        meta: { totalCount: flights.length, hasNextPage: false, next: null },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error searching flights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search flights';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, data: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
