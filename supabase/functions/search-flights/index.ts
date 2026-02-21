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

function parseDuration(durationStr: string): number {
  // "6 hr 51 min" -> minutes
  const hrMatch = durationStr?.match(/(\d+)\s*hr/);
  const minMatch = durationStr?.match(/(\d+)\s*min/);
  return (hrMatch ? parseInt(hrMatch[1]) * 60 : 0) + (minMatch ? parseInt(minMatch[1]) : 0);
}

function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^0-9.,]/g, '').replace(',', '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function transformBrightDataFlight(flight: any, index: number): TransformedFlight | null {
  try {
    const price = parsePrice(flight?.price);
    if (price === null) return null;

    const airline = flight?.airline || '';
    const departureTime = flight?.departure_time || '';
    const arrivalTime = flight?.arrival_time || '';
    const duration = parseDuration(flight?.duration || '');
    const stops = flight?.stops || 'Nonstop';
    const stopCount = stops === 'Nonstop' ? 0 : parseInt(stops) || (stops.includes('stop') ? 1 : 0);

    // Extract airport codes from additional fields if available
    const depAirport = flight?.departure_airport || '';
    const arrAirport = flight?.arrival_airport || '';

    const journeyLeg = {
      origin: {
        name: depAirport || 'Departure',
        displayCode: depAirport || '',
        city: depAirport || '',
      },
      destination: {
        name: arrAirport || 'Arrival',
        displayCode: arrAirport || '',
        city: arrAirport || '',
      },
      departure: departureTime,
      arrival: arrivalTime,
      durationInMinutes: duration,
      carriers: {
        marketing: [{
          name: airline,
          logoUrl: flight?.airline_logo || '',
        }],
      },
      stopCount,
    };

    return {
      id: `bd-${index}-${Date.now()}`,
      price: {
        raw: price,
        formatted: `£${price}`,
      },
      legs: [journeyLeg],
      isSelfTransfer: false,
      tags: [],
    };
  } catch {
    return null;
  }
}

function buildGoogleFlightsUrl(
  departureId: string,
  arrivalId: string,
  date: string,
  returnDate?: string,
): string {
  // Use the simple Google Flights URL format with query
  const tripType = returnDate ? 'round trip' : 'one way';
  let q = `flights from ${departureId} to ${arrivalId} on ${date}`;
  if (returnDate) {
    q += ` return ${returnDate}`;
  }
  const url = new URL('https://www.google.com/travel/flights');
  url.searchParams.set('q', q);
  url.searchParams.set('curr', 'GBP');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('gl', 'uk');
  return url.toString();
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

    const apiToken = Deno.env.get('BRIGHTDATA_API_TOKEN');
    const zone = Deno.env.get('BRIGHTDATA_ZONE');
    if (!apiToken || !zone) {
      return new Response(
        JSON.stringify({ success: false, error: 'BrightData credentials not configured', data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const flightsUrl = buildGoogleFlightsUrl(departureId, arrivalId, date, returnDate);
    console.log(`Searching flights via BrightData: ${departureId} → ${arrivalId} on ${date}`);
    console.log(`Google Flights URL: ${flightsUrl}`);

    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        zone,
        url: flightsUrl,
        format: 'raw',
      }),
    });

    const responseText = await response.text();
    console.log(`BrightData response status: ${response.status}, length: ${responseText.length}`);

    if (!response.ok) {
      console.error('BrightData error:', responseText.substring(0, 1000));
      throw new Error(`BrightData request failed (${response.status}): ${responseText.substring(0, 200)}`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.log('BrightData returned non-JSON (first 2000 chars):', responseText.substring(0, 2000));
      throw new Error('BrightData returned non-JSON response. Try setting format to json in zone settings.');
    }

    console.log('BrightData response keys:', Object.keys(data));

    // BrightData parsed Google Flights data may come in various formats
    // Try to extract flight data from the response
    let rawFlights: any[] = [];

    if (Array.isArray(data?.flights)) {
      rawFlights = data.flights;
    } else if (Array.isArray(data?.best_flights)) {
      rawFlights = [...(data.best_flights || []), ...(data.other_flights || [])];
    } else if (Array.isArray(data?.results)) {
      rawFlights = data.results;
    } else if (Array.isArray(data)) {
      rawFlights = data;
    } else {
      // Log the full response structure to debug
      console.log('BrightData full response (first 2000 chars):', JSON.stringify(data).substring(0, 2000));
      // Try to find any array in the response that looks like flights
      for (const key of Object.keys(data || {})) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          const sample = data[key][0];
          if (sample?.price || sample?.airline || sample?.departure_time) {
            rawFlights = data[key];
            console.log(`Found flights under key: ${key}`);
            break;
          }
        }
      }
    }

    console.log(`Found ${rawFlights.length} raw flight entries`);

    // If rawFlights items have nested flights array (like SerpApi format), flatten
    const flatFlights: any[] = [];
    for (const item of rawFlights) {
      if (Array.isArray(item?.flights)) {
        // SerpApi-like format with nested flights and group price
        const price = item.price;
        const totalDuration = item.total_duration;
        const flights = item.flights;
        flatFlights.push({
          airline: flights[0]?.airline || '',
          airline_logo: flights[0]?.airline_logo || '',
          departure_time: flights[0]?.departure_airport?.time || flights[0]?.departure_time || '',
          arrival_time: flights[flights.length - 1]?.arrival_airport?.time || flights[flights.length - 1]?.arrival_time || '',
          departure_airport: flights[0]?.departure_airport?.id || departureId,
          arrival_airport: flights[flights.length - 1]?.arrival_airport?.id || arrivalId,
          duration: totalDuration ? `${Math.floor(totalDuration / 60)} hr ${totalDuration % 60} min` : '',
          stops: flights.length > 1 ? `${flights.length - 1} stop` : 'Nonstop',
          price: typeof price === 'number' ? `£${price}` : (price || ''),
        });
      } else {
        // Already flat flight data
        flatFlights.push({
          ...item,
          departure_airport: item.departure_airport || departureId,
          arrival_airport: item.arrival_airport || arrivalId,
        });
      }
    }

    const flights = flatFlights
      .map((f: any, i: number) => transformBrightDataFlight(f, i))
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
