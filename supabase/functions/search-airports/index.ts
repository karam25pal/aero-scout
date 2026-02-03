const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query must be at least 2 characters', data: [] }),
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

    console.log('Searching airports for:', query);

    const response = await fetch(
      `https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchAirport?query=${encodeURIComponent(query)}&locale=en-US`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
          'x-rapidapi-key': apiKey,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Sky Scrapper API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.message || 'Failed to search airports', data: [] }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform the response to a cleaner format
    const airports = (data.data || []).map((item: any) => ({
      entityId: item.entityId || item.navigation?.entityId || '',
      skyId: item.skyId || item.navigation?.relevantFlightParams?.skyId || '',
      name: item.presentation?.suggestionTitle || item.name || '',
      city: item.navigation?.relevantFlightParams?.skyId || item.presentation?.subtitle?.split(',')[0] || '',
      country: item.presentation?.subtitle?.split(',').pop()?.trim() || '',
      iata: item.skyId || item.iataCode || '',
    })).filter((airport: any) => airport.entityId && airport.skyId);

    console.log(`Found ${airports.length} airports`);

    return new Response(
      JSON.stringify({ success: true, data: airports }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error searching airports:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search airports';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, data: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
