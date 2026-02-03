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
    
    // Log raw response for debugging
    console.log('Airport search response:', JSON.stringify(data).substring(0, 500));

    if (!response.ok) {
      console.error('Sky Scrapper API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.message || 'Failed to search airports', data: [] }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform the response - extract the correct fields from the API response
    const airports = (data.data || [])
      .filter((item: any) => item.navigation?.entityType === 'AIRPORT')
      .map((item: any) => {
        const presentation = item.presentation || {};
        const navigation = item.navigation || {};
        const flightParams = navigation.relevantFlightParams || {};
        
        return {
          entityId: navigation.entityId || item.entityId || '',
          skyId: flightParams.skyId || item.skyId || '',
          name: presentation.suggestionTitle || item.name || '',
          city: presentation.subtitle?.split(',')[0]?.trim() || flightParams.skyId || '',
          country: presentation.subtitle?.split(',').pop()?.trim() || '',
          iata: flightParams.skyId || item.skyId || '',
        };
      })
      .filter((airport: any) => airport.entityId && airport.skyId);

    console.log(`Found ${airports.length} airports:`, airports.map((a: any) => `${a.iata} (${a.entityId})`).join(', '));

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
