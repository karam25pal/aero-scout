const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_HOST = 'flights-sky.p.rapidapi.com';

interface TransformedFlight {
  id: string;
  price: { raw: number; formatted: string };
  legs: any[];
  isSelfTransfer: boolean;
  tags: string[];
}

function transformItinerary(itinerary: any): TransformedFlight | null {
  try {
    const price = itinerary?.price;
    const legs = itinerary?.legs || [];

    return {
      id: itinerary?.id || Math.random().toString(36),
      price: {
        raw: price?.raw || 0,
        formatted: price?.formatted || `£${price?.raw || 0}`,
      },
      legs: legs.map((leg: any) => {
        const carriers = leg?.carriers?.marketing || [];
        return {
          origin: {
            name: leg?.origin?.name || '',
            displayCode: leg?.origin?.displayCode || '',
            city: leg?.origin?.city || '',
          },
          destination: {
            name: leg?.destination?.name || '',
            displayCode: leg?.destination?.displayCode || '',
            city: leg?.destination?.city || '',
          },
          departure: leg?.departure || '',
          arrival: leg?.arrival || '',
          durationInMinutes: leg?.durationInMinutes || 0,
          carriers: {
            marketing: carriers.map((c: any) => ({
              name: c?.name || '',
              logoUrl: c?.logoUrl || '',
            })),
          },
          stopCount: leg?.stopCount || 0,
        };
      }),
      isSelfTransfer: itinerary?.isSelfTransfer || false,
      tags: itinerary?.tags || [],
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

    // Use skyId for the flights-sky API (e.g. "LHR", "NYCA"), not the base64 entityId
    const fromId = originSkyId || originEntityId;
    const toId = destinationSkyId || destinationEntityId;

    if (!fromId || !toId || !date) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters', data: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured', data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Choose endpoint based on trip type
    const isRoundTrip = !!returnDate;
    const endpoint = isRoundTrip ? 'flights/search-roundtrip' : 'flights/search-one-way';

    const url = new URL(`https://${API_HOST}/${endpoint}`);
    url.searchParams.set('fromEntityId', fromId);
    url.searchParams.set('toEntityId', toId);
    url.searchParams.set('departDate', date);
    if (isRoundTrip) url.searchParams.set('returnDate', returnDate);
    url.searchParams.set('adults', String(adults));
    if (children > 0) url.searchParams.set('children', String(children));
    if (infants > 0) url.searchParams.set('infants', String(infants));
    url.searchParams.set('cabinClass', cabinClass.toLowerCase());
    url.searchParams.set('currency', 'GBP');
    url.searchParams.set('market', 'UK');
    url.searchParams.set('locale', 'en-GB');

    console.log(`Searching flights: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-host': API_HOST,
        'x-rapidapi-key': apiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('flights-sky API error:', JSON.stringify(data));
      throw new Error(data?.message || 'API request failed');
    }

    const context = data?.data?.context;
    const status = context?.status;
    
    // The itineraries can be an array directly, or have a .results property, or be array-like with numeric keys
    const rawItineraries = data?.data?.itineraries;
    let itineraries: any[] = [];
    if (Array.isArray(rawItineraries)) {
      itineraries = rawItineraries;
    } else if (rawItineraries?.results && Array.isArray(rawItineraries.results)) {
      itineraries = rawItineraries.results;
    } else if (rawItineraries && typeof rawItineraries === 'object') {
      // Array-like object with numeric keys
      itineraries = Object.values(rawItineraries).filter((v: any) => v && typeof v === 'object' && v.id);
    }

    console.log(`Initial search returned ${itineraries.length} itineraries, status: ${status}`);

    // If incomplete, poll for full results (max 3 attempts)
    if (status === 'incomplete' && context?.sessionId) {
      const sessionId = context.sessionId;
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const incUrl = new URL(`https://${API_HOST}/flights/search-incomplete`);
        incUrl.searchParams.set('sessionId', sessionId);

        console.log(`Polling incomplete results, attempt ${i + 1}`);
        const incRes = await fetch(incUrl.toString(), {
          method: 'GET',
          headers: { 'x-rapidapi-host': API_HOST, 'x-rapidapi-key': apiKey },
        });
        const incData = await incRes.json();
        const newStatus = incData?.data?.context?.status;
        const rawInc = incData?.data?.itineraries;
        let newItineraries: any[] = [];
        if (Array.isArray(rawInc)) newItineraries = rawInc;
        else if (rawInc?.results && Array.isArray(rawInc.results)) newItineraries = rawInc.results;
        else if (rawInc && typeof rawInc === 'object') newItineraries = Object.values(rawInc).filter((v: any) => v && typeof v === 'object' && v.id);
        if (newItineraries.length > 0) itineraries = newItineraries;
        console.log(`Poll ${i + 1}: ${newItineraries.length} itineraries, status: ${newStatus}`);
        if (newStatus === 'complete') break;
      }
    }

    // Transform to our format
    const flights = itineraries
      .map((it: any) => transformItinerary(it))
      .filter((f: TransformedFlight | null): f is TransformedFlight => f !== null);

    // Sort by price
    flights.sort((a: TransformedFlight, b: TransformedFlight) => a.price.raw - b.price.raw);

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
