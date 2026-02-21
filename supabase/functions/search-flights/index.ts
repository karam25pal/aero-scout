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

function transformItinerary(itinerary: any): TransformedFlight | null {
  try {
    const price = itinerary?.price?.raw;
    if (typeof price !== 'number' || price <= 0) return null;

    const legs = (itinerary?.legs || []).map((leg: any) => ({
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
        marketing: (leg?.carriers?.marketing || []).map((c: any) => ({
          name: c?.name || '',
          logoUrl: c?.logoUrl || '',
        })),
      },
      stopCount: leg?.stopCount ?? 0,
    }));

    if (legs.length === 0) return null;

    return {
      id: itinerary?.id || `sky-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      price: {
        raw: price,
        formatted: itinerary?.price?.formatted || `£${price}`,
      },
      legs,
      isSelfTransfer: itinerary?.isSelfTransfer ?? false,
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

    if (!originSkyId || !destinationSkyId || !originEntityId || !destinationEntityId || !date) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters', data: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI key not configured', data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build Sky Scrapper API URL
    const params = new URLSearchParams({
      originSkyId,
      destinationSkyId,
      originEntityId,
      destinationEntityId,
      date,
      adults: String(adults),
      cabinClass,
      currency: 'GBP',
      market: 'UK',
      countryCode: 'UK',
    });

    if (returnDate) params.set('returnDate', returnDate);
    if (children > 0) params.set('childrens', String(children));
    if (infants > 0) params.set('infants', String(infants));

    const url = `https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchFlights?${params.toString()}`;
    console.log(`Sky Scrapper search: ${originSkyId} → ${destinationSkyId} on ${date}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
        'x-rapidapi-key': apiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Sky Scrapper API error:', response.status, JSON.stringify(data).slice(0, 500));
      throw new Error(`Sky Scrapper API error: ${response.status}`);
    }

    if (!data?.status) {
      console.error('Sky Scrapper returned error:', JSON.stringify(data).slice(0, 500));
      throw new Error(data?.message || 'Sky Scrapper search failed');
    }

    // Extract itineraries from response
    const itineraries = data?.data?.itineraries || [];
    console.log(`Sky Scrapper returned ${itineraries.length} itineraries`);

    const flights = itineraries
      .map((it: any) => transformItinerary(it))
      .filter((f: TransformedFlight | null): f is TransformedFlight => f !== null);

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
