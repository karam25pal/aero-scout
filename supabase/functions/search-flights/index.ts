const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
      console.error('RAPIDAPI_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured', data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching flights:', { originSkyId, destinationSkyId, date, returnDate });

    // Build the URL with all parameters
    let url = `https://sky-scrapper.p.rapidapi.com/api/v2/flights/searchFlights?originSkyId=${originSkyId}&destinationSkyId=${destinationSkyId}&originEntityId=${originEntityId}&destinationEntityId=${destinationEntityId}&date=${date}&cabinClass=${cabinClass}&adults=${adults}&childrens=${children}&infants=${infants}&sortBy=best&currency=USD&market=en-US&countryCode=US`;

    if (returnDate) {
      url += `&returnDate=${returnDate}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
        'x-rapidapi-key': apiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Sky Scrapper API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.message || 'Failed to search flights', data: [] }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform the response
    const itineraries = data.data?.itineraries || [];
    const flights = itineraries.map((itinerary: any) => ({
      id: itinerary.id,
      price: {
        raw: itinerary.price?.raw || 0,
        formatted: itinerary.price?.formatted || '$0',
      },
      legs: (itinerary.legs || []).map((leg: any) => ({
        origin: {
          name: leg.origin?.name || '',
          displayCode: leg.origin?.displayCode || '',
          city: leg.origin?.city || '',
        },
        destination: {
          name: leg.destination?.name || '',
          displayCode: leg.destination?.displayCode || '',
          city: leg.destination?.city || '',
        },
        departure: leg.departure || '',
        arrival: leg.arrival || '',
        durationInMinutes: leg.durationInMinutes || 0,
        carriers: {
          marketing: (leg.carriers?.marketing || []).map((carrier: any) => ({
            name: carrier.name || '',
            logoUrl: carrier.logoUrl || '',
          })),
        },
        stopCount: leg.stopCount || 0,
      })),
      isSelfTransfer: itinerary.isSelfTransfer || false,
      tags: itinerary.tags || [],
    }));

    console.log(`Found ${flights.length} flights`);

    return new Response(
      JSON.stringify({ success: true, data: flights }),
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
