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
      `https://booking-com15.p.rapidapi.com/api/v1/flights/searchDestination?query=${encodeURIComponent(query)}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'booking-com15.p.rapidapi.com',
          'x-rapidapi-key': apiKey,
        },
      }
    );

    const data = await response.json();
    
    console.log('Airport search response:', JSON.stringify(data).substring(0, 500));

    if (!response.ok) {
      console.error('Booking.com API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.message || 'Failed to search airports', data: [] }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform the response from Booking.com API
    const airports = (data.data || [])
      .filter((item: any) => item.type === 'AIRPORT')
      .map((item: any) => ({
        entityId: item.id || '',
        skyId: item.code || item.id || '',
        name: item.name || '',
        city: item.cityName || item.city || '',
        country: item.countryName || item.country || '',
        iata: item.code || '',
      }))
      .filter((airport: any) => airport.entityId && airport.iata);

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
