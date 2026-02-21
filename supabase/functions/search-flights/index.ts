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

function transformSerpApiFlight(flightGroup: any, index: number): TransformedFlight | null {
  try {
    const flights = flightGroup?.flights || [];
    const price = flightGroup?.price;

    if (!flights.length || price === undefined) return null;

    const legs = flights.map((flight: any) => ({
      origin: {
        name: flight?.departure_airport?.name || '',
        displayCode: flight?.departure_airport?.id || '',
        city: flight?.departure_airport?.name?.split(' ')[0] || '',
      },
      destination: {
        name: flight?.arrival_airport?.name || '',
        displayCode: flight?.arrival_airport?.id || '',
        city: flight?.arrival_airport?.name?.split(' ')[0] || '',
      },
      departure: flight?.departure_airport?.time || '',
      arrival: flight?.arrival_airport?.time || '',
      durationInMinutes: flight?.duration || 0,
      carriers: {
        marketing: [{
          name: flight?.airline || '',
          logoUrl: flight?.airline_logo || '',
        }],
      },
      stopCount: flight?.stops || 0,
    }));

    // Use the total_duration from the group if available, otherwise sum legs
    const totalDuration = flightGroup?.total_duration || legs.reduce((sum: number, l: any) => sum + l.durationInMinutes, 0);

    // Build a single "journey leg" if there are multiple flight segments (connections)
    // Our frontend expects legs = journey legs (outbound, return), not individual flight segments
    const journeyLeg = {
      origin: legs[0].origin,
      destination: legs[legs.length - 1].destination,
      departure: legs[0].departure,
      arrival: legs[legs.length - 1].arrival,
      durationInMinutes: totalDuration,
      carriers: {
        marketing: flights.map((f: any) => ({
          name: f?.airline || '',
          logoUrl: f?.airline_logo || '',
        })).filter((c: any, i: number, arr: any[]) =>
          arr.findIndex((x: any) => x.name === c.name) === i
        ),
      },
      stopCount: flights.length - 1,
    };

    return {
      id: `serpapi-${index}-${Date.now()}`,
      price: {
        raw: price,
        formatted: `£${price}`,
      },
      legs: [journeyLeg],
      isSelfTransfer: false,
      tags: flightGroup?.type ? [flightGroup.type] : [],
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
      children = 0,
      infants = 0,
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

    // Map cabin class to SerpApi format
    const cabinMap: Record<string, string> = {
      economy: '1',
      premium_economy: '2',
      business: '3',
      first: '4',
    };

    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google_flights');
    url.searchParams.set('departure_id', departureId);
    url.searchParams.set('arrival_id', arrivalId);
    url.searchParams.set('outbound_date', date);
    if (returnDate) {
      url.searchParams.set('return_date', returnDate);
      url.searchParams.set('type', '1'); // round trip
    } else {
      url.searchParams.set('type', '2'); // one way
    }
    url.searchParams.set('travel_class', cabinMap[cabinClass] || '1');
    url.searchParams.set('adults', String(adults));
    if (children > 0) url.searchParams.set('children', String(children));
    if (infants > 0) url.searchParams.set('infants_in_seat', String(infants));
    url.searchParams.set('currency', 'GBP');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('gl', 'uk');
    url.searchParams.set('api_key', apiKey);

    console.log(`Searching flights via SerpApi: ${departureId} → ${arrivalId} on ${date}`);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error('SerpApi error:', JSON.stringify(data));
      throw new Error(data?.error || 'SerpApi request failed');
    }

    if (data?.error) {
      console.error('SerpApi returned error:', data.error);
      throw new Error(data.error);
    }

    // Combine best_flights and other_flights
    const bestFlights = data?.best_flights || [];
    const otherFlights = data?.other_flights || [];
    const allFlightGroups = [...bestFlights, ...otherFlights];

    console.log(`SerpApi returned ${bestFlights.length} best + ${otherFlights.length} other flights`);

    // Transform to our format
    const flights = allFlightGroups
      .map((fg: any, i: number) => transformSerpApiFlight(fg, i))
      .filter((f: TransformedFlight | null): f is TransformedFlight => f !== null);

    // Sort by price
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
