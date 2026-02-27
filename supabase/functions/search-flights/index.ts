const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const HASDATA_BASE = 'https://api.hasdata.com/scrape/google/flights';

const CABIN_CLASS_MAP: Record<string, string> = {
  economy: 'economy',
  premium_economy: 'premiumEconomy',
  business: 'business',
  first: 'first',
};

const STOPS_MAP: Record<string, string> = {
  '0': 'nonStop',
  '1': 'oneStopOrFewer',
  '2': 'twoStopsOrFewer',
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
      stops,
      tripType,
      multiCityLegs,
      // Pagination via departureToken
      departureToken,
      bookingToken,
    } = body;

    // Use IATA codes preferably
    const origin = originSkyId || originEntityId;
    const destination = destinationSkyId || destinationEntityId;

    // Multi-city doesn't need origin/destination/date in the same way
    const isMultiCity = tripType === 'multi-city' && Array.isArray(multiCityLegs) && multiCityLegs.length >= 2;

    if (!isMultiCity && (!origin || !destination || !date)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters', data: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('HASDATA_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'HasData API key not configured', data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build URL
    const url = new URL(HASDATA_BASE);

    if (isMultiCity) {
      // Multi-city: use first/last leg for departureId/arrivalId, set type=multiCity
      url.searchParams.set('departureId', multiCityLegs[0].departureId);
      url.searchParams.set('arrivalId', multiCityLegs[multiCityLegs.length - 1].arrivalId);
      url.searchParams.set('outboundDate', multiCityLegs[0].date);
      url.searchParams.set('type', 'multiCity');
      
      // Build multiCityJson
      const multiCityJson = multiCityLegs.map((leg: any) => ({
        departureId: leg.departureId,
        arrivalId: leg.arrivalId,
        date: leg.date,
      }));
      url.searchParams.set('multiCityJson', JSON.stringify(multiCityJson));
    } else {
      url.searchParams.set('departureId', origin);
      url.searchParams.set('arrivalId', destination);
      url.searchParams.set('outboundDate', date);
      
      // Trip type - fall back to oneWay if round-trip but no return date
      const resolvedType = (tripType === 'one-way' || !returnDate) ? 'oneWay' : 'roundTrip';
      url.searchParams.set('type', resolvedType);
      
      if (returnDate && resolvedType === 'roundTrip') {
        url.searchParams.set('returnDate', returnDate);
      }
    }

    url.searchParams.set('travelClass', CABIN_CLASS_MAP[cabinClass] || 'Economy');
    url.searchParams.set('currency', 'GBP');
    url.searchParams.set('gl', 'gb');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('adults', String(adults));
    if (children > 0) url.searchParams.set('children', String(children));
    if (infants > 0) url.searchParams.set('infantsOnLap', String(infants));
    
    // Always show hidden fares and deep search
    url.searchParams.set('showHidden', 'true');
    url.searchParams.set('deepSearch', 'true');

    // Stops filter
    if (stops !== undefined && stops !== null && stops !== '' && stops !== 'any') {
      const mappedStops = STOPS_MAP[String(stops)] || String(stops);
      url.searchParams.set('stops', mappedStops);
    }

    // Departure token for pagination / return flights
    if (departureToken) {
      url.searchParams.set('departureToken', departureToken);
    }
    if (bookingToken) {
      url.searchParams.set('bookingToken', bookingToken);
    }

    const effectiveOrigin = isMultiCity ? multiCityLegs[0].departureId : origin;
    const effectiveDest = isMultiCity ? multiCityLegs[multiCityLegs.length - 1].arrivalId : destination;

    console.log(`HasData flight search: ${effectiveOrigin} → ${effectiveDest} on ${isMultiCity ? 'multi-city' : date}`);
    console.log('API URL:', url.toString().replace(apiKey, '***'));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('HasData API error:', response.status, errText.slice(0, 500));
      throw new Error(`API error: ${response.status}`);
    }

    const apiData = await response.json();
    console.log('HasData response keys:', Object.keys(apiData));

    let flights = transformHasDataResponse(apiData, effectiveOrigin, effectiveDest);

    // Client-side stops filter (API doesn't always respect the stops param)
    if (stops !== undefined && stops !== null && stops !== '' && stops !== 'any') {
      const maxStops = parseInt(String(stops), 10);
      if (!isNaN(maxStops)) {
        flights = flights.filter((f: any) =>
          f.legs.every((leg: any) => (leg.stopCount || 0) <= maxStops)
        );
      }
    }

    flights.sort((a: any, b: any) => a.price.raw - b.price.raw);
    console.log(`Returning ${flights.length} flights`);

    return new Response(
      JSON.stringify({
        success: true,
        data: flights,
        meta: {
          totalCount: flights.length,
          hasNextPage: false,
          next: null,
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

function transformHasDataResponse(apiData: any, originCode: string, destCode: string): any[] {
  const results: any[] = [];

  // HasData returns data in various structures - handle them all
  // Common: { bestFlights: [...], otherFlights: [...] }
  // Or nested under data
  const data = apiData?.data || apiData;
  
  const allFlightGroups: any[] = [];
  
  if (Array.isArray(data?.bestFlights)) allFlightGroups.push(...data.bestFlights);
  if (Array.isArray(data?.otherFlights)) allFlightGroups.push(...data.otherFlights);
  if (Array.isArray(data?.best_flights)) allFlightGroups.push(...data.best_flights);
  if (Array.isArray(data?.other_flights)) allFlightGroups.push(...data.other_flights);
  
  // If top-level arrays
  if (Array.isArray(apiData?.bestFlights)) allFlightGroups.push(...apiData.bestFlights);
  if (Array.isArray(apiData?.otherFlights)) allFlightGroups.push(...apiData.otherFlights);
  if (Array.isArray(apiData?.best_flights)) allFlightGroups.push(...apiData.best_flights);
  if (Array.isArray(apiData?.other_flights)) allFlightGroups.push(...apiData.other_flights);

  // Some APIs return flights directly as array
  if (Array.isArray(data)) allFlightGroups.push(...data);

  console.log(`Found ${allFlightGroups.length} flight groups to process`);

  for (let i = 0; i < allFlightGroups.length; i++) {
    const flight = allFlightGroups[i];
    const transformed = transformSingleFlight(flight, i, originCode, destCode);
    if (transformed) results.push(transformed);
  }

  return results;
}

function transformSingleFlight(flight: any, index: number, originCode: string, destCode: string): any | null {
  // Extract price - HasData Google Flights format
  let price = 0;
  if (typeof flight.price === 'number') {
    price = flight.price;
  } else if (typeof flight.price === 'string') {
    price = parseFloat(flight.price.replace(/[^0-9.]/g, ''));
  } else if (flight.price?.raw) {
    price = flight.price.raw;
  }
  if (!price || price <= 0) return null;

  // Build legs from flights array (Google Flights structure)
  const legs: any[] = [];
  const segments = flight.flights || flight.legs || [];
  
  if (Array.isArray(segments) && segments.length > 0) {
    // Collect airlines
    const airlines = segments.map((s: any) => ({
      name: s.airline || s.carrier || 'Unknown',
      logoUrl: s.airline_logo || s.airlineLogo || '',
    }));
    const uniqueAirlines: any[] = [];
    const seen = new Set<string>();
    for (const a of airlines) {
      if (!seen.has(a.name)) { seen.add(a.name); uniqueAirlines.push(a); }
    }

    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];

    // Departure/arrival info
    const depAirport = firstSeg.departure_airport || firstSeg.departureAirport || {};
    const arrAirport = lastSeg.arrival_airport || lastSeg.arrivalAirport || {};

    // Build segment details
    const segmentDetails = segments.map((s: any) => {
      const depAp = s.departure_airport || s.departureAirport || {};
      const arrAp = s.arrival_airport || s.arrivalAirport || {};
      return {
        airportCode: depAp.id || depAp.airport_code || depAp.code || '',
        airportName: depAp.name || depAp.airport_name || '',
        departure: depAp.time || s.departure_time || s.departureTime || '',
        arrival: arrAp.time || s.arrival_time || s.arrivalTime || '',
        durationMinutes: s.duration || s.duration_minutes || 0,
        airline: s.airline || s.carrier || 'Unknown',
        airlineLogo: s.airline_logo || s.airlineLogo || '',
      };
    });

    // Build layovers
    const layoverList: any[] = [];
    if (Array.isArray(flight.layovers)) {
      for (const lo of flight.layovers) {
        layoverList.push({
          airportCode: lo.id || lo.airport_code || lo.code || '',
          airportName: lo.name || lo.airport_name || '',
          durationMinutes: lo.duration || lo.duration_minutes || 0,
        });
      }
    } else {
      // Calculate from segments
      for (let j = 0; j < segments.length - 1; j++) {
        const arrAp2 = segments[j].arrival_airport || segments[j].arrivalAirport || {};
        const arrTime = arrAp2.time || segments[j].arrival_time || '';
        const depAp2 = segments[j + 1].departure_airport || segments[j + 1].departureAirport || {};
        const depTime = depAp2.time || segments[j + 1].departure_time || '';
        let layoverMin = 0;
        if (arrTime && depTime) {
          const a = new Date(arrTime).getTime();
          const d = new Date(depTime).getTime();
          if (!isNaN(a) && !isNaN(d)) layoverMin = Math.round((d - a) / 60000);
        }
        layoverList.push({
          airportCode: arrAp2.id || arrAp2.airport_code || arrAp2.code || '',
          airportName: arrAp2.name || arrAp2.airport_name || '',
          durationMinutes: layoverMin,
        });
      }
    }

    const totalDuration = flight.total_duration || flight.totalDuration || flight.duration?.raw || 
      segments.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
    const stopCount = typeof flight.stops === 'number' ? flight.stops : 
      (layoverList.length > 0 ? layoverList.length : Math.max(0, segments.length - 1));

    const depTime = depAirport.time || firstSeg.departure_time || '';
    const arrTime = arrAirport.time || lastSeg.arrival_time || '';

    legs.push({
      origin: {
        name: depAirport.name || depAirport.airport_name || originCode,
        displayCode: depAirport.id || depAirport.airport_code || depAirport.code || originCode,
        city: depAirport.name || originCode,
      },
      destination: {
        name: arrAirport.name || arrAirport.airport_name || destCode,
        displayCode: arrAirport.id || arrAirport.airport_code || arrAirport.code || destCode,
        city: arrAirport.name || destCode,
      },
      departure: depTime,
      arrival: arrTime,
      durationInMinutes: totalDuration,
      carriers: { marketing: uniqueAirlines },
      stopCount,
      segments: segmentDetails,
      layovers: layoverList,
    });
  } else {
    // Fallback for flat structure
    legs.push({
      origin: { name: originCode, displayCode: originCode, city: originCode },
      destination: { name: destCode, displayCode: destCode, city: destCode },
      departure: flight.departure_time || '',
      arrival: flight.arrival_time || '',
      durationInMinutes: flight.duration?.raw || flight.total_duration || 0,
      carriers: { marketing: [{ name: flight.airline || 'Unknown', logoUrl: flight.airline_logo || '' }] },
      stopCount: flight.stops || 0,
    });
  }

  return {
    id: `hd-${index}-${Date.now()}`,
    price: { raw: price, formatted: `£${Math.round(price)}` },
    legs,
    isSelfTransfer: false,
    tags: flight.type === 'Best' ? ['best'] : [],
    bookingToken: flight.booking_token || flight.departureToken || flight.departure_token || null,
  };
}
