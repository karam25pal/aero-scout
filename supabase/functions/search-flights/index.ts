const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TransformedFlight {
  id: string;
  price: { raw: number; formatted: string };
  legs: any[];
  isSelfTransfer: boolean;
  tags: string[];
}

function transformSerpApiFlight(flight: any, index: number, departureId: string, arrivalId: string): TransformedFlight | null {
  try {
    const price = flight?.price;
    if (typeof price !== 'number' || price <= 0) return null;

    const segments = flight?.flights || [];
    if (segments.length === 0) return null;

    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];
    const totalDuration = flight?.total_duration || 0;

    const journeyLeg = {
      origin: {
        name: firstSeg?.departure_airport?.name || departureId,
        displayCode: firstSeg?.departure_airport?.id || departureId,
        city: firstSeg?.departure_airport?.name || departureId,
      },
      destination: {
        name: lastSeg?.arrival_airport?.name || arrivalId,
        displayCode: lastSeg?.arrival_airport?.id || arrivalId,
        city: lastSeg?.arrival_airport?.name || arrivalId,
      },
      departure: firstSeg?.departure_airport?.time || '',
      arrival: lastSeg?.arrival_airport?.time || '',
      durationInMinutes: totalDuration,
      carriers: {
        marketing: segments.map((s: any) => ({
          name: s?.airline || '',
          logoUrl: s?.airline_logo || '',
        })).filter((c: any, i: number, arr: any[]) =>
          arr.findIndex((x: any) => x.name === c.name) === i
        ),
      },
      stopCount: segments.length - 1,
    };

    return {
      id: `serp-${index}-${Date.now()}`,
      price: { raw: price, formatted: `£${price}` },
      legs: [journeyLeg],
      isSelfTransfer: false,
      tags: flight?.type ? [flight.type] : [],
    };
  } catch {
    return null;
  }
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
    } = body;

    const departureId = originSkyId || originEntityId;
    const arrivalId = destinationSkyId || destinationEntityId;

    if (!departureId || !arrivalId || !date) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters', data: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('SERPAPI_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'SerpApi key not configured', data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build SerpApi Google Flights URL
    const params = new URLSearchParams({
      engine: 'google_flights',
      api_key: apiKey,
      departure_id: departureId,
      arrival_id: arrivalId,
      outbound_date: date,
      currency: 'GBP',
      hl: 'en',
      gl: 'uk',
      adults: String(adults),
      type: returnDate ? '1' : '2', // 1=round trip, 2=one way
    });

    if (returnDate) {
      params.set('return_date', returnDate);
    }

    // Map cabin class
    const cabinMap: Record<string, string> = { economy: '1', premium_economy: '2', business: '3', first: '4' };
    params.set('travel_class', cabinMap[cabinClass] || '1');

    const serpUrl = `https://serpapi.com/search.json?${params.toString()}`;
    console.log(`SerpApi flight search: ${departureId} → ${arrivalId} on ${date}`);

    const response = await fetch(serpUrl);
    const data = await response.json();

    if (data?.error) {
      console.error('SerpApi error:', data.error);
      throw new Error(`SerpApi error: ${data.error}`);
    }

    // Combine best_flights and other_flights
    const bestFlights = data?.best_flights || [];
    const otherFlights = data?.other_flights || [];
    const allFlights = [...bestFlights, ...otherFlights];

    console.log(`SerpApi returned ${bestFlights.length} best + ${otherFlights.length} other = ${allFlights.length} flights`);

    const flights = allFlights
      .map((f: any, i: number) => transformSerpApiFlight(f, i, departureId, arrivalId))
      .filter((f: TransformedFlight | null): f is TransformedFlight => f !== null);

    flights.sort((a, b) => a.price.raw - b.price.raw);

    console.log(`Returning ${flights.length} flights`);

    return new Response(
      JSON.stringify({
        success: true,
        data: flights,
        meta: { totalCount: flights.length, hasNextPage: false, next: null },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error searching flights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search flights';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, data: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
