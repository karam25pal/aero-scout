const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface FlightOffer {
  id: string;
  token?: string;
  segments?: any[];
  offer?: any;
  priceBreakdown?: any;
  price?: any;
  isSelfTransfer?: boolean;
  tags?: string[];
}

async function fetchFlightsWithSort(
  params: {
    fromId: string;
    toId: string;
    date: string;
    returnDate?: string;
    adults: number;
    children: number;
    infants: number;
    cabinClass: string;
  },
  sort: string,
  apiKey: string
): Promise<FlightOffer[]> {
  const url = new URL('https://booking-com15.p.rapidapi.com/api/v1/flights/searchFlights');
  
  url.searchParams.set('fromId', params.fromId);
  url.searchParams.set('toId', params.toId);
  url.searchParams.set('departDate', params.date);
  url.searchParams.set('adults', String(params.adults));
  url.searchParams.set('children', String(params.children));
  url.searchParams.set('infants', String(params.infants));
  url.searchParams.set('cabinClass', params.cabinClass);
  url.searchParams.set('currency_code', 'GBP');
  url.searchParams.set('sort', sort);
  url.searchParams.set('limit', '100');

  if (params.returnDate) {
    url.searchParams.set('returnDate', params.returnDate);
  }

  console.log(`Fetching flights with sort=${sort}:`, url.toString());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-rapidapi-host': 'booking-com15.p.rapidapi.com',
      'x-rapidapi-key': apiKey,
    },
  });

  const data = await response.json();
  
  if (!response.ok || !data.status) {
    console.error(`Error fetching with sort=${sort}:`, data.message || 'API error');
    return [];
  }

  const dataRoot = data.data || {};
  const flightOffers = Array.isArray(dataRoot.flightOffers) ? dataRoot.flightOffers : [];
  
  console.log(`Sort=${sort} returned ${flightOffers.length} offers`);
  
  return flightOffers;
}

function transformFlights(flightOffers: FlightOffer[]) {
  return flightOffers.map((offer: any) => {
    const offerData = offer?.offer ?? offer;
    const segments = offerData?.segments || [];
    
    return {
      id: offerData?.token || offerData?.id || offer?.id || Math.random().toString(36),
      price: {
        raw: offerData?.priceBreakdown?.total?.units || offerData?.price?.units || 0,
        formatted: offerData?.priceBreakdown?.total?.currencyCode 
          ? `${offerData.priceBreakdown.total.currencyCode} ${offerData.priceBreakdown.total.units}`
          : offerData?.price?.currencyCode
            ? `${offerData.price.currencyCode} ${offerData.price.units}`
            : `£${offerData?.priceBreakdown?.total?.units || offerData?.price?.units || 0}`,
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
      isSelfTransfer: offerData?.isSelfTransfer || false,
      tags: offerData?.tags || offer?.tags || [],
    };
  });
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

    // Prefer entity IDs when available (these match the upstream API identifiers)
    const fromId = originEntityId || `${originSkyId}.AIRPORT`;
    const toId = destinationEntityId || `${destinationSkyId}.AIRPORT`;

    console.log('Searching flights with multiple sort strategies:', { 
      originSkyId, 
      destinationSkyId, 
      fromId,
      toId,
      date, 
      returnDate,
      cabinClass: mappedCabinClass,
      adults
    });

    const fetchParams = {
      fromId,
      toId,
      date,
      returnDate,
      adults,
      children,
      infants,
      cabinClass: mappedCabinClass,
    };

    // Fetch with multiple sort options in parallel to get more unique results
    const sortOptions = ['BEST', 'CHEAPEST', 'FASTEST'];
    
    const results = await Promise.all(
      sortOptions.map(sort => fetchFlightsWithSort(fetchParams, sort, apiKey))
    );

    // Merge all results and deduplicate by token/id
    const seenIds = new Set<string>();
    const mergedOffers: FlightOffer[] = [];

    for (const offers of results) {
      for (const offer of offers) {
        const offerData = offer?.offer ?? offer;
        const id = String(offerData?.token || offerData?.id || offer?.id || '');
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          mergedOffers.push(offer);
        }
      }
    }

    console.log(`Merged ${mergedOffers.length} unique flights from ${sortOptions.length} sort queries`);

    // Transform to our format
    const flights = transformFlights(mergedOffers);

    // Sort merged results by price (cheapest first)
    flights.sort((a, b) => a.price.raw - b.price.raw);

    console.log(`Returning ${flights.length} flights`);

    return new Response(
      JSON.stringify({
        success: true,
        data: flights,
        meta: {
          totalCount: flights.length,
          hasNextPage: false, // All results fetched via multi-sort strategy
          next: null,
        },
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
