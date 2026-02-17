import { useState } from 'react';
import { Hero } from '@/components/Hero';
import { FlightSearchForm } from '@/components/FlightSearchForm';
import { FlightResults } from '@/components/FlightResults';
import { DealsShowcase } from '@/components/DealsShowcase';
import { SearchParams, FlightResult } from '@/types/flight';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActiveDeals } from '@/hooks/useDeals';
import { applyDealsToFlights, FlightWithDeal } from '@/lib/applyDeals';
import { Plane } from 'lucide-react';

type FlightSearchMeta = {
  totalCount?: number;
  hasNextPage?: boolean;
  next?: { cursor?: string; offset?: number; page?: number };
};

const Index = () => {
  const [flights, setFlights] = useState<FlightWithDeal[]>([]);
  const [rawFlights, setRawFlights] = useState<FlightResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastParams, setLastParams] = useState<SearchParams | null>(null);
  const [meta, setMeta] = useState<FlightSearchMeta | null>(null);
  const { toast } = useToast();
  const { deals } = useActiveDeals();

  const handleSearch = async (params: SearchParams) => {
    setIsLoading(true);
    setHasSearched(true);
    setFlights([]);
    setRawFlights([]);
    setLastParams(params);
    setMeta(null);

    try {
      const { data, error } = await supabase.functions.invoke('search-flights', { body: params });
      if (error) throw error;
      if (data?.success) {
        const raw = data.data || [];
        setRawFlights(raw);
        setFlights(applyDealsToFlights(raw, deals));
        setMeta(data.meta || null);
        if (raw.length === 0) {
          toast({ title: 'No flights found', description: 'Try adjusting your search criteria' });
        }
      } else {
        throw new Error(data?.error || 'Failed to search flights');
      }
    } catch (error) {
      console.error('Error searching flights:', error);
      toast({ title: 'Search failed', description: error instanceof Error ? error.message : 'Please try again later', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!lastParams) return;
    const next = meta?.next;
    if (!meta?.hasNextPage || !next) return;

    setIsLoadingMore(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-flights', {
        body: { ...lastParams, cursor: next.cursor, offset: next.offset, page: next.page },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to load more flights');

      const more: FlightResult[] = data.data || [];
      setRawFlights(prev => {
        const seen = new Set(prev.map(f => f.id));
        const merged = [...prev];
        for (const f of more) { if (!seen.has(f.id)) merged.push(f); }
        const allRaw = merged;
        setFlights(applyDealsToFlights(allRaw, deals));
        return allRaw;
      });
      setMeta(data.meta || null);
    } catch (error) {
      console.error('Error loading more flights:', error);
      toast({ title: 'Could not load more', description: error instanceof Error ? error.message : 'Please try again', variant: 'destructive' });
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <Plane className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">SkySearch</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Flights</a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Deals</a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Support</a>
          </nav>
        </div>
      </header>

      <main>
        <Hero />
        <div className="container mx-auto px-4 -mt-8 relative z-10">
          <FlightSearchForm onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Deals Showcase */}
        {!hasSearched && <DealsShowcase />}

        {/* Results */}
        <div className="container mx-auto px-4 pb-16">
          <FlightResults
            flights={flights}
            isLoading={isLoading}
            totalCount={meta?.totalCount}
            hasNextPage={meta?.hasNextPage}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
          />
          {!isLoading && hasSearched && flights.length === 0 && (
            <div className="w-full max-w-5xl mx-auto mt-8">
              <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
                <Plane className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No flights found</h3>
                <p className="text-muted-foreground">Try different dates or destinations</p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 SkySearch. Find your perfect flight.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
