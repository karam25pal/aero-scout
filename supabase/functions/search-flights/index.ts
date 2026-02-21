const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_HOST = 'google-flights2.p.rapidapi.com';

const CABIN_CLASS_MAP: Record<string, string> = {
  economy: 'ECONOMY',
  premium_economy: 'PREMIUM_ECONOMY',
  business: 'BUSINESS',
  first: 'FIRST',
};

function transformFlight(flight: any, index: number, originCode: string, destCode: string): any {
  const price = typeof flight.price === 'number'
    ? flight.price
    : parseFloat(String(flight.price || '0').replace(/[^0-9.]/g, ''));
  if (!price || price <= 0) return null;

  const depTime = flight.departure_time || '';
  const arrTime = flight.arrival_time || '';
  const durationMin = flight.duration?.raw || 0;
  const stops = typeof flight.stops === 'number' ? flight.stops : 0;
  const airlineLogo = flight.airline_logo || '';

  // Build legs from the `flights` array (each segment of the journey)
  const legs: any[] = [];
  const segments = flight.flights;
  if (Array.isArray(segments) && segments.length > 0) {
    // Collect unique airlines across all segments
    const airlines = segments.map((s: any) => ({
      name: s.airline || 'Unknown',
      logoUrl: s.airline_logo || airlineLogo,
    }));
    // Dedupe airlines by name
    const uniqueAirlines: any[] = [];
    const seen = new Set<string>();
    for (const a of airlines) {
      if (!seen.has(a.name)) { seen.add(a.name); uniqueAirlines.push(a); }
    }

    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];

    legs.push({
      origin: {
        name: firstSeg.departure_airport?.airport_name || originCode,
        displayCode: firstSeg.departure_airport?.airport_code || originCode,
        city: firstSeg.departure_airport?.airport_name || originCode,
      },
      destination: {
        name: lastSeg.arrival_airport?.airport_name || destCode,
        displayCode: lastSeg.arrival_airport?.airport_code || destCode,
        city: lastSeg.arrival_airport?.airport_name || destCode,
      },
      departure: depTime,
      arrival: arrTime,
      durationInMinutes: durationMin,
      carriers: { marketing: uniqueAirlines },
      stopCount: stops,
    });
  } else {
    // Fallback
    legs.push({
      origin: { name: originCode, displayCode: originCode, city: originCode },
      destination: { name: destCode, displayCode: destCode, city: destCode },
      departure: depTime,
      arrival: arrTime,
      durationInMinutes: durationMin,
      carriers: { marketing: [{ name: 'Unknown', logoUrl: airlineLogo }] },
      stopCount: stops,
    });
  }

  return {
    id: `gf-${index}-${Date.now()}`,
    price: { raw: price, formatted: `£${Math.round(price)}` },
    legs,
    isSelfTransfer: !!flight.self_transfer,
    tags: [],
    bookingToken: flight.booking_token || null,
  };
}

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
      children = 0,
      infants = 0,
      // Pagination
      cursor,
    } = body;

    const origin = originSkyId || originEntityId;
    const destination = destinationSkyId || destinationEntityId;

    if (!origin || !destination || !date) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters', data: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI key not configured', data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // If we have a cursor (next_token), use getNextFlights
    if (cursor) {
      console.log(`Loading more flights with next_token`);
      const nextUrl = new URL(`https://${API_HOST}/api/v1/getNextFlights`);
      nextUrl.searchParams.set('next_token', cursor);
      nextUrl.searchParams.set('currency', 'GBP');
      nextUrl.searchParams.set('language_code', 'en-US');
      nextUrl.searchParams.set('country_code', 'GB');

      const nextResp = await fetch(nextUrl.toString(), {
        method: 'GET',
        headers: {
          'x-rapidapi-host': API_HOST,
          'x-rapidapi-key': rapidApiKey,
        },
      });

      if (!nextResp.ok) {
        const errText = await nextResp.text();
        console.error('getNextFlights error:', nextResp.status, errText.slice(0, 500));
        throw new Error(`API error: ${nextResp.status}`);
      }

      const nextData = await nextResp.json();
      console.log('getNextFlights response keys:', Object.keys(nextData));

      const nextFlightsRaw = extractFlightsFromResponse(nextData);
      const nextFlights = nextFlightsRaw
        .map((f: any, i: number) => transformFlight(f, i + 1000, origin, destination))
        .filter((f: any) => f !== null);

      const nextToken = nextData?.data?.next_token || nextData?.next_token || null;

      return new Response(
        JSON.stringify({
          success: true,
          data: nextFlights,
          meta: {
            totalCount: nextFlights.length,
            hasNextPage: !!nextToken,
            next: nextToken ? { cursor: nextToken } : null,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Initial search
    console.log(`Flight search: ${origin} → ${destination} on ${date}`);

    const searchUrl = new URL(`https://${API_HOST}/api/v1/searchFlights`);
    searchUrl.searchParams.set('departure_id', origin);
    searchUrl.searchParams.set('arrival_id', destination);
    searchUrl.searchParams.set('outbound_date', date);
    if (returnDate) searchUrl.searchParams.set('return_date', returnDate);
    searchUrl.searchParams.set('adults', String(adults));
    if (children > 0) searchUrl.searchParams.set('children', String(children));
    if (infants > 0) searchUrl.searchParams.set('infant_on_lap', String(infants));
    searchUrl.searchParams.set('travel_class', CABIN_CLASS_MAP[cabinClass] || 'ECONOMY');
    searchUrl.searchParams.set('currency', 'GBP');
    searchUrl.searchParams.set('language_code', 'en-US');
    searchUrl.searchParams.set('country_code', 'GB');
    searchUrl.searchParams.set('show_hidden', '1');

    console.log('API URL:', searchUrl.toString());

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-host': API_HOST,
        'x-rapidapi-key': rapidApiKey,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('searchFlights error:', response.status, errText.slice(0, 500));
      throw new Error(`API error: ${response.status}`);
    }

    const apiData = await response.json();
    console.log('API response status:', apiData.status, 'message:', apiData.message);
    console.log('API response data keys:', apiData.data ? Object.keys(apiData.data) : 'no data');

    // Log full response structure for debugging
    if (apiData.data?.itineraries) {
      const itin = apiData.data.itineraries;
      if (itin.topFlights) console.log('topFlights count:', itin.topFlights.length);
      if (itin.otherFlights) console.log('otherFlights count:', itin.otherFlights.length);
      if (Array.isArray(itin)) console.log('itineraries array count:', itin.length);
    }

    const rawFlights = extractFlightsFromResponse(apiData);
    console.log(`Extracted ${rawFlights.length} raw flights`);

    const flights = rawFlights
      .map((f: any, i: number) => transformFlight(f, i, origin, destination))
      .filter((f: any) => f !== null);

    flights.sort((a: any, b: any) => a.price.raw - b.price.raw);
    console.log(`Returning ${flights.length} flights`);

    const nextToken = apiData.data?.next_token || null;

    return new Response(
      JSON.stringify({
        success: true,
        data: flights,
        meta: {
          totalCount: flights.length,
          hasNextPage: !!nextToken,
          next: nextToken ? { cursor: nextToken } : null,
        },
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

function extractFlightsFromResponse(apiData: any): any[] {
  const flights: any[] = [];

  if (!apiData?.data) return flights;
  const data = apiData.data;

  // Handle itineraries object with topFlights / otherFlights arrays
  if (data.itineraries) {
    const itin = data.itineraries;
    if (Array.isArray(itin.topFlights)) {
      flights.push(...itin.topFlights);
    }
    if (Array.isArray(itin.otherFlights)) {
      flights.push(...itin.otherFlights);
    }
    // If itineraries is itself an array
    if (Array.isArray(itin)) {
      flights.push(...itin);
    }
  }

  // If data is directly an array of flights
  if (Array.isArray(data)) {
    flights.push(...data);
  }

  // If data.flights exists
  if (Array.isArray(data.flights)) {
    flights.push(...data.flights);
  }

  return flights;
}
