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
      cabinClass = 'ECONOMY',
      adults = 1,
      children = 0,
      infants = 0,
    } = body;

    if (!originSkyId || !destinationSkyId || !date) {
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

    // Map cabin class to Booking.com format
    const cabinClassMap: Record<string, string> = {
      'economy': 'ECONOMY',
      'premium_economy': 'PREMIUM_ECONOMY',
      'business': 'BUSINESS',
      'first': 'FIRST',
    };
    const mappedCabinClass = cabinClassMap[cabinClass.toLowerCase()] || 'ECONOMY';

    console.log('Searching flights with params:', { 
      originSkyId, 
      destinationSkyId, 
      originEntityId, 
      destinationEntityId, 
      date, 
      returnDate,
      cabinClass: mappedCabinClass,
      adults
    });

    // Build the URL with all parameters for Booking.com API
    const url = new URL('https://booking-com15.p.rapidapi.com/api/v1/flights/searchFlights');
    url.searchParams.set('fromId', `${originSkyId}.AIRPORT`);
    url.searchParams.set('toId', `${destinationSkyId}.AIRPORT`);
    url.searchParams.set('departDate', date);
    url.searchParams.set('adults', String(adults));
    url.searchParams.set('children', String(children));
    url.searchParams.set('infants', String(infants));
    url.searchParams.set('cabinClass', mappedCabinClass);
    url.searchParams.set('currency_code', 'USD');
    url.searchParams.set('sort', 'BEST');

    if (returnDate) {
      url.searchParams.set('returnDate', returnDate);
    }

    console.log('API URL:', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'booking-com15.p.rapidapi.com',
        'x-rapidapi-key': apiKey,
      },
    });

    const data = await response.json();
    
    console.log('API Response status:', response.status);
    console.log('API Response data:', JSON.stringify(data).substring(0, 1000));

    if (!response.ok) {
      console.error('Booking.com API error:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ success: false, error: data.message || 'Failed to search flights', data: [] }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.status) {
      console.error('Booking.com API returned error:', data.message);
      return new Response(
        JSON.stringify({ success: false, error: data.message || 'API error', data: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform the response from Booking.com API
    const flightOffers = data.data?.flightOffers || [];
    const flights = flightOffers.map((offer: any) => {
      const segments = offer.segments || [];
      
      return {
        id: offer.token || offer.id || Math.random().toString(36),
        price: {
          raw: offer.priceBreakdown?.total?.units || 0,
          formatted: offer.priceBreakdown?.total?.currencyCode 
            ? `${offer.priceBreakdown.total.currencyCode} ${offer.priceBreakdown.total.units}`
            : `$${offer.priceBreakdown?.total?.units || 0}`,
        },
        legs: segments.map((segment: any) => {
          const legs = segment.legs || [];
          const firstLeg = legs[0] || {};
          const lastLeg = legs[legs.length - 1] || firstLeg;
          
          return {
            origin: {
              name: firstLeg.departureAirport?.name || '',
              displayCode: firstLeg.departureAirport?.code || '',
              city: firstLeg.departureAirport?.cityName || '',
            },
            destination: {
              name: lastLeg.arrivalAirport?.name || '',
              displayCode: lastLeg.arrivalAirport?.code || '',
              city: lastLeg.arrivalAirport?.cityName || '',
            },
            departure: firstLeg.departureTime || '',
            arrival: lastLeg.arrivalTime || '',
            durationInMinutes: segment.totalTime ? Math.round(segment.totalTime / 60) : 0,
            carriers: {
              marketing: legs.map((leg: any) => ({
                name: leg.carriersData?.[0]?.name || leg.airlineName || '',
                logoUrl: leg.carriersData?.[0]?.logo || '',
              })).filter((c: any) => c.name),
            },
            stopCount: legs.length - 1,
          };
        }),
        isSelfTransfer: offer.isSelfTransfer || false,
        tags: offer.tags || [],
      };
    });

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
