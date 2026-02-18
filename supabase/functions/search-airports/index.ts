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

    const url = `https://flights-sky.p.rapidapi.com/flights/auto-complete?query=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'flights-sky.p.rapidapi.com',
        'x-rapidapi-key': apiKey,
      },
    });

    const data = await response.json();
    
    console.log('Airport search response:', JSON.stringify(data).substring(0, 500));

    if (!response.ok) {
      console.error('flights-sky API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.message || 'Failed to search airports', data: [] }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform the response from flights-sky API
    // The auto-complete endpoint returns data with presentation.id/skyId
    const rawResults = data?.data || [];
    const airports = rawResults
      .filter((item: any) => {
        const nav = item?.navigation;
        return nav?.entityType === 'AIRPORT' || nav?.entityType === 'CITY';
      })
      .map((item: any) => {
        const presentation = item?.presentation || {};
        const nav = item?.navigation || {};
        const entityInfo = nav?.relevantFlightParams || {};
        return {
          entityId: presentation?.id || presentation?.skyId || nav?.entityId || '',
          skyId: presentation?.skyId || presentation?.id || '',
          name: presentation?.subtitle || presentation?.suggestionTitle || '',
          city: nav?.localizedName || presentation?.title || '',
          country: nav?.relevantHotelParams?.countryName || '',
          iata: presentation?.skyId || entityInfo?.skyId || '',
          entityType: nav?.entityType || '',
        };
      })
      .filter((a: any) => a.entityId && a.skyId);

    console.log(`Found ${airports.length} locations:`, airports.map((a: any) => `${a.iata} - ${a.city}`).join(', '));

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
