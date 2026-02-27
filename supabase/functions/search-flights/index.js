const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const HASDATA_BASE = 'https://api.hasdata.com/scrape/google/flights';
const KIWI_LOGO = (id) => `https://images.kiwi.com/airlines/64/${id}.png`;

// Airline name → Kiwi CDN ID mapping (comprehensive — 200+ major airlines)
const AIRLINE_ID = {
  'aegean airlines': 'A3', 'aegean': 'A3', 'aer lingus': 'EI', 'aeroflot': 'SU',
  'aerolineas argentinas': 'AR', 'aeromexico': 'AM', 'air algerie': 'AH',
  'air arabia': 'G9', 'air astana': 'KC', 'air austral': 'UU', 'air baltic': 'BT',
  'airbaltic': 'BT', 'air canada': 'AC', 'air china': 'CA', 'air corsica': 'XK',
  'air dolomiti': 'EN', 'air europa': 'UX', 'air france': 'AF', 'air india': 'AI',
  'air india express': 'IX', 'air macau': 'NX', 'air malta': 'KM', 'air mauritius': 'MK',
  'air new zealand': 'NZ', 'air peace': 'P4', 'air seychelles': 'HM', 'air serbia': 'JU',
  'air tahiti nui': 'TN', 'air transat': 'TS', 'airasia': 'AK', 'air asia': 'AK',
  'airasia x': 'D7', 'alaska airlines': 'AS', 'alitalia': 'AZ', 'allegiant air': 'G4',
  'allegiant': 'G4', 'all nippon airways': 'NH', 'ana': 'NH', 'american airlines': 'AA',
  'asiana airlines': 'OZ', 'austrian airlines': 'OS', 'austrian': 'OS', 'avianca': 'AV',
  'azul': 'AD', 'azul airlines': 'AD', 'bamboo airways': 'QH', 'bangkok airways': 'PG',
  'batik air': 'ID', 'binter canarias': 'NT', 'british airways': 'BA',
  'brussels airlines': 'SN', 'cathay pacific': 'CX', 'cebu pacific': '5J',
  'china airlines': 'CI', 'china eastern': 'MU', 'china eastern airlines': 'MU',
  'china southern': 'CZ', 'china southern airlines': 'CZ', 'condor': 'DE',
  'copa airlines': 'CM', 'croatia airlines': 'OU', 'czech airlines': 'OK',
  'delta air lines': 'DL', 'delta': 'DL', 'easyjet': 'U2', 'egyptair': 'MS',
  'el al': 'LY', 'emirates': 'EK', 'ethiopian airlines': 'ET', 'etihad': 'EY',
  'etihad airways': 'EY', 'eurowings': 'EW', 'eva air': 'BR', 'fiji airways': 'FJ',
  'finnair': 'AY', 'flybe': 'BE', 'flydubai': 'FZ', 'flynas': 'XY',
  'frontier airlines': 'F9', 'garuda indonesia': 'GA', 'go first': 'G8',
  'gol': 'G3', 'gulf air': 'GF', 'hainan airlines': 'HU', 'hawaiian airlines': 'HA',
  'iberia': 'IB', 'icelandair': 'FI', 'indigo': '6E', 'ita airways': 'AZ',
  'japan airlines': 'JL', 'jal': 'JL', 'jazeera airways': 'J9', 'jet2': 'LS',
  'jet2.com': 'LS', 'jetblue': 'B6', 'jetblue airways': 'B6', 'jetstar': 'JQ',
  'kenya airways': 'KQ', 'klm': 'KL', 'klm royal dutch airlines': 'KL',
  'korean air': 'KE', 'latam airlines': 'LA', 'latam': 'LA', 'lion air': 'JT',
  'lot polish airlines': 'LO', 'lot': 'LO', 'lufthansa': 'LH', 'luxair': 'LG',
  'malaysia airlines': 'MH', 'middle east airlines': 'ME', 'nepal airlines': 'RA',
  'norwegian air shuttle': 'DY', 'norwegian': 'DY', 'oman air': 'WY',
  'pakistan international airlines': 'PK', 'pia': 'PK', 'pegasus airlines': 'PC',
  'pegasus': 'PC', 'philippine airlines': 'PR', 'play': 'OG', 'porter airlines': 'PD',
  'qantas': 'QF', 'qatar airways': 'QR', 'royal air maroc': 'AT',
  'royal jordanian': 'RJ', 'rwandair': 'WB', 'ryanair': 'FR', 's7 airlines': 'S7',
  'saudia': 'SV', 'saudi arabian airlines': 'SV', 'scandinavian airlines': 'SK',
  'sas': 'SK', 'scoot': 'TR', 'singapore airlines': 'SQ', 'south african airways': 'SA',
  'southwest airlines': 'WN', 'southwest': 'WN', 'spicejet': 'SG',
  'spirit airlines': 'NK', 'spirit': 'NK', 'srilankan airlines': 'UL',
  'sun country airlines': 'SY', 'sunexpress': 'XQ', 'sun express': 'XQ',
  'swiss': 'LX', 'swiss airlines': 'LX', 'tap portugal': 'TP', 'tap air portugal': 'TP',
  'tarom': 'RO', 'thai airways': 'TG', 'transavia': 'HV', 'tui fly': 'X3', 'tui': 'X3',
  'tunisair': 'TU', 'turkish airlines': 'TK', 'united airlines': 'UA', 'united': 'UA',
  'vietjet air': 'VJ', 'vietjet': 'VJ', 'vietnam airlines': 'VN',
  'virgin atlantic': 'VS', 'virgin australia': 'VA', 'viva aerobus': 'VB',
  'volaris': 'Y4', 'vueling': 'VY', 'westjet': 'WS', 'westjet encore': 'WR',
  'wideroe': 'WF', 'wizz air': 'W6', 'xiamen airlines': 'MF',
  'air cairo': 'SM', 'cyprus airways': 'CY', 'air kenya': 'P2',
  'intercaribbean airways': 'JY', 'sundair': 'SR',
};

const CABIN_CLASS_MAP = {
  economy: 'economy',
  premium_economy: 'premiumEconomy',
  business: 'business',
  first: 'first',
};

const STOPS_MAP = {
  '0': 'nonStop',
  '1': 'oneStopOrFewer',
  '2': 'twoStopsOrFewer',
};

function resolveAirlineLogo(name, fallbackLogo) {
  const lower = (name || '').toLowerCase().trim();
  const id = AIRLINE_ID[lower];
  if (id) return KIWI_LOGO(id);
  if (fallbackLogo && !fallbackLogo.includes('gstatic.com/flights')) return fallbackLogo;
  return '';
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
      stops,
      tripType,
      multiCityLegs,
      departureToken,
      bookingToken,
    } = body;

    const origin = originSkyId || originEntityId;
    const destination = destinationSkyId || destinationEntityId;

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

    const url = new URL(HASDATA_BASE);

    if (isMultiCity) {
      url.searchParams.set('departureId', multiCityLegs[0].departureId);
      url.searchParams.set('arrivalId', multiCityLegs[multiCityLegs.length - 1].arrivalId);
      url.searchParams.set('outboundDate', multiCityLegs[0].date);
      url.searchParams.set('type', 'multiCity');
      
      const multiCityJson = multiCityLegs.map((leg) => ({
        departureId: leg.departureId,
        arrivalId: leg.arrivalId,
        date: leg.date,
      }));
      url.searchParams.set('multiCityJson', JSON.stringify(multiCityJson));
    } else {
      url.searchParams.set('departureId', origin);
      url.searchParams.set('arrivalId', destination);
      url.searchParams.set('outboundDate', date);
      
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
    
    url.searchParams.set('showHidden', 'true');
    url.searchParams.set('deepSearch', 'true');

    if (stops !== undefined && stops !== null && stops !== '' && stops !== 'any') {
      const mappedStops = STOPS_MAP[String(stops)] || String(stops);
      url.searchParams.set('stops', mappedStops);
    }

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

    let response = null;
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      });

      if (response.status === 429 && attempt < maxRetries - 1) {
        const waitMs = (attempt + 1) * 2000;
        console.log(`Rate limited (429), retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      const errText = response ? await response.text() : 'No response';
      const status = response?.status || 0;
      console.error('HasData API error:', status, errText.slice(0, 500));
      if (status === 429) {
        throw new Error('Rate limit reached — please wait a minute and try again');
      }
      throw new Error(`API error: ${status}`);
    }

    const apiData = await response.json();
    console.log('HasData response keys:', Object.keys(apiData));

    let flights = transformHasDataResponse(apiData, effectiveOrigin, effectiveDest);

    if (stops !== undefined && stops !== null && stops !== '' && stops !== 'any') {
      const maxStops = parseInt(String(stops), 10);
      if (!isNaN(maxStops)) {
        flights = flights.filter((f) =>
          f.legs.every((leg) => (leg.stopCount || 0) <= maxStops)
        );
      }
    }

    flights.sort((a, b) => a.price.raw - b.price.raw);
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

function transformHasDataResponse(apiData, originCode, destCode) {
  const results = [];

  const data = apiData?.data || apiData;
  
  const allFlightGroups = [];
  
  if (Array.isArray(data?.bestFlights)) allFlightGroups.push(...data.bestFlights);
  if (Array.isArray(data?.otherFlights)) allFlightGroups.push(...data.otherFlights);
  if (Array.isArray(data?.best_flights)) allFlightGroups.push(...data.best_flights);
  if (Array.isArray(data?.other_flights)) allFlightGroups.push(...data.other_flights);
  
  if (Array.isArray(apiData?.bestFlights)) allFlightGroups.push(...apiData.bestFlights);
  if (Array.isArray(apiData?.otherFlights)) allFlightGroups.push(...apiData.otherFlights);
  if (Array.isArray(apiData?.best_flights)) allFlightGroups.push(...apiData.best_flights);
  if (Array.isArray(apiData?.other_flights)) allFlightGroups.push(...apiData.other_flights);

  if (Array.isArray(data)) allFlightGroups.push(...data);

  console.log(`Found ${allFlightGroups.length} flight groups to process`);

  for (let i = 0; i < allFlightGroups.length; i++) {
    const flight = allFlightGroups[i];
    const transformed = transformSingleFlight(flight, i, originCode, destCode);
    if (transformed) results.push(transformed);
  }

  return results;
}

function transformSingleFlight(flight, index, originCode, destCode) {
  let price = 0;
  if (typeof flight.price === 'number') {
    price = flight.price;
  } else if (typeof flight.price === 'string') {
    price = parseFloat(flight.price.replace(/[^0-9.]/g, ''));
  } else if (flight.price?.raw) {
    price = flight.price.raw;
  }
  if (!price || price <= 0) return null;

  const legs = [];
  const segments = flight.flights || flight.legs || [];
  
  if (Array.isArray(segments) && segments.length > 0) {
    const airlines = segments.map((s) => {
      const name = s.airline || s.carrier || 'Unknown';
      const rawLogo = s.airline_logo || s.airlineLogo || '';
      return { name, logoUrl: resolveAirlineLogo(name, rawLogo) || rawLogo };
    });
    const uniqueAirlines = [];
    const seen = new Set();
    for (const a of airlines) {
      if (!seen.has(a.name)) { seen.add(a.name); uniqueAirlines.push(a); }
    }

    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];

    const depAirport = firstSeg.departure_airport || firstSeg.departureAirport || {};
    const arrAirport = lastSeg.arrival_airport || lastSeg.arrivalAirport || {};

    const segmentDetails = segments.map((s) => {
      const depAp = s.departure_airport || s.departureAirport || {};
      const arrAp = s.arrival_airport || s.arrivalAirport || {};
      return {
        airportCode: depAp.id || depAp.airport_code || depAp.code || '',
        airportName: depAp.name || depAp.airport_name || '',
        departure: depAp.time || s.departure_time || s.departureTime || '',
        arrival: arrAp.time || s.arrival_time || s.arrivalTime || '',
        durationMinutes: s.duration || s.duration_minutes || 0,
        airline: s.airline || s.carrier || 'Unknown',
        airlineLogo: resolveAirlineLogo(s.airline || s.carrier, s.airline_logo || s.airlineLogo) || s.airline_logo || s.airlineLogo || '',
      };
    });

    const layoverList = [];
    if (Array.isArray(flight.layovers)) {
      for (const lo of flight.layovers) {
        layoverList.push({
          airportCode: lo.id || lo.airport_code || lo.code || '',
          airportName: lo.name || lo.airport_name || '',
          durationMinutes: lo.duration || lo.duration_minutes || 0,
        });
      }
    } else {
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
      segments.reduce((sum, s) => sum + (s.duration || 0), 0);
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
    legs.push({
      origin: { name: originCode, displayCode: originCode, city: originCode },
      destination: { name: destCode, displayCode: destCode, city: destCode },
      departure: flight.departure_time || '',
      arrival: flight.arrival_time || '',
      durationInMinutes: flight.duration?.raw || flight.total_duration || 0,
      carriers: { marketing: [{ name: flight.airline || 'Unknown', logoUrl: resolveAirlineLogo(flight.airline, flight.airline_logo) || flight.airline_logo || '' }] },
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
