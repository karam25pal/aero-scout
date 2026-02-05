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
      // Optional pagination params (Booking.com/RapidAPI may support one of these)
      cursor,
      offset,
      page,
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

    // Prefer entity IDs when available (these match the upstream API identifiers)
    const fromId = originEntityId || `${originSkyId}.AIRPORT`;
    const toId = destinationEntityId || `${destinationSkyId}.AIRPORT`;
    url.searchParams.set('fromId', fromId);
    url.searchParams.set('toId', toId);
    url.searchParams.set('departDate', date);
    url.searchParams.set('adults', String(adults));
    url.searchParams.set('children', String(children));
    url.searchParams.set('infants', String(infants));
    url.searchParams.set('cabinClass', mappedCabinClass);
    url.searchParams.set('currency_code', 'GBP');
    url.searchParams.set('sort', 'BEST');
    url.searchParams.set('limit', '100');

    // Pagination (different variants exist; upstream will ignore unknown params)
    if (cursor) url.searchParams.set('cursor', String(cursor));
    if (typeof offset === 'number') url.searchParams.set('offset', String(offset));
    if (typeof page === 'number') url.searchParams.set('page', String(page));

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
    // NOTE: The upstream response can contain multiple offer arrays (sometimes only a subset is in `flightOffers`).
    // We pick the largest array that looks like flight offers (has `segments`) to avoid accidentally showing only ~15 items.
    const dataRoot = data.data || {};
    let flightOffers: any[] = Array.isArray(dataRoot.flightOffers) ? dataRoot.flightOffers : [];

    // Some responses also include a `flightDeals` array which can contain additional options.
    try {
      const flightDeals = (dataRoot as any).flightDeals;
      if (Array.isArray(flightDeals)) {
        console.log(`flightDeals length: ${flightDeals.length}`);
        if (flightDeals.length > 0) {
          console.log('flightDeals[0] keys:', Object.keys(flightDeals[0] || {}));
        }
      }
    } catch (_e) {
      // ignore
    }

    // Combine all flight-like arrays into a single merged list (no duplicate ids).
    const looksLikeOffer = (obj: any): boolean =>
      !!obj && typeof obj === 'object' && (Array.isArray(obj.segments) || Array.isArray(obj.offer?.segments));

    const seenIds = new Set<string>();
    const mergedOffers: any[] = [];

    const addOffer = (item: any) => {
      const offerData = item?.offer ?? item;
      const id: string = String(offerData?.token || offerData?.id || item?.id || '');
      if (id && seenIds.has(id)) return;
      if (id) seenIds.add(id);
      mergedOffers.push(item);
    };

    // First, add all items from flightOffers (typically the main list).
    for (const item of flightOffers) {
      addOffer(item);
    }

    // Then scan for additional arrays that contain offer-like objects.
    for (const [key, value] of Object.entries(dataRoot)) {
      if (key === 'flightOffers') continue; // already processed
      if (!Array.isArray(value) || value.length === 0) continue;
      const first = value[0] as any;
      if (looksLikeOffer(first)) {
        console.log(`Adding offers from \"${key}\" (${value.length} items)`);
        for (const item of value as any[]) {
          addOffer(item);
        }
      }
    }

    // Replace flightOffers with the merged list.
    flightOffers = mergedOffers;
    console.log(`Merged offers count: ${flightOffers.length}`);

    // Log useful structure hints for debugging pagination/partial-result issues
    try {
      const keys = Object.keys(dataRoot);
      console.log('Data root keys:', keys);
      const hintKeys = keys.filter((k) => /session|search|cursor|page|offset|token|next/i.test(k));
      const hints: Record<string, unknown> = {};
      for (const k of hintKeys) {
        const v = (dataRoot as any)[k];
        // Avoid logging huge objects
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) hints[k] = v;
        else if (Array.isArray(v)) hints[k] = { type: 'array', length: v.length };
        else if (typeof v === 'object') hints[k] = { type: 'object', keys: Object.keys(v as any).slice(0, 20) };
      }
      if (Object.keys(hints).length > 0) console.log('Pagination hints:', JSON.stringify(hints));
      if ((dataRoot as any).context && typeof (dataRoot as any).context === 'object') {
        console.log('Context keys:', Object.keys((dataRoot as any).context));
      }
    } catch (_e) {
      // ignore logging failures
    }

    const flights = flightOffers.map((offer: any) => {
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
              : `$${offerData?.priceBreakdown?.total?.units || offerData?.price?.units || 0}`,
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

    console.log(`Found ${flights.length} flights`);

    const totalCount = data.data?.aggregation?.filteredTotalCount ?? data.data?.aggregation?.totalCount;
    const pagination = data.data?.pagination;
    const hasNextPage =
      pagination?.hasNextPage ??
      data.data?.hasNextPage ??
      (typeof totalCount === 'number' ? flights.length < totalCount : undefined);

    const next = {
      cursor:
        pagination?.nextCursor ??
        pagination?.cursor ??
        data.data?.nextCursor ??
        data.data?.cursor ??
        undefined,
      offset:
        pagination?.nextOffset ??
        data.data?.nextOffset ??
        (typeof pagination?.offset === 'number' ? pagination.offset : undefined),
      page:
        pagination?.nextPage ??
        data.data?.nextPage ??
        (typeof pagination?.page === 'number' ? pagination.page : undefined),
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: flights,
        meta: {
          totalCount,
          hasNextPage,
          next,
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
