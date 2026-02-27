import { useMemo, useState } from 'react';
import { FlightCard } from './FlightCard';
import { Plane, Tag, Filter, Search, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FlightWithDeal } from '@/lib/applyDeals';

interface FlightResultsProps {
  flights: FlightWithDeal[];
  isLoading: boolean;
  totalCount?: number;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  isMultiCity?: boolean;
}

export const FlightResults = ({
  flights,
  isLoading,
  totalCount,
  hasNextPage,
  isLoadingMore,
  onLoadMore,
  isMultiCity,
}: FlightResultsProps) => {
  const [airlineFilter, setAirlineFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  // Extract unique airline names from all flights
  const allAirlines = useMemo(() => {
    const names = new Set<string>();
    flights.forEach(f => {
      f.legs.forEach(leg => {
        leg.carriers.marketing.forEach(c => {
          if (c.name) names.add(c.name);
        });
      });
    });
    return Array.from(names).sort();
  }, [flights]);

  // Filter flights by airline name
  const filteredFlights = useMemo(() => {
    if (!airlineFilter.trim()) return flights;
    const q = airlineFilter.toLowerCase();
    return flights.filter(f =>
      f.legs.some(leg =>
        leg.carriers.marketing.some(c => c.name.toLowerCase().includes(q))
      )
    );
  }, [flights, airlineFilter]);

  if (isLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto mt-8">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <Plane className="h-12 w-12 text-primary animate-float" />
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
          </div>
          <p className="mt-6 text-lg text-muted-foreground animate-pulse-soft">Searching for the best flights...</p>
          <div className="mt-4 flex gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (flights.length === 0) return null;

  const handleDownloadJSON = () => {
    const json = JSON.stringify(filteredFlights, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flight-results.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const headers = ['Airline', 'Origin', 'Destination', 'Departure', 'Arrival', 'Duration (min)', 'Stops', 'Price', 'Deal'];
    const rows = filteredFlights.map(f => {
      const leg = f.legs[0];
      const airline = leg?.carriers?.marketing?.map(c => c.name).join(', ') || '';
      const origin = `${leg?.origin?.city} (${leg?.origin?.displayCode})`;
      const dest = `${leg?.destination?.city} (${leg?.destination?.displayCode})`;
      const departure = leg?.departure || '';
      const arrival = leg?.arrival || '';
      const duration = leg?.durationInMinutes || '';
      const stops = leg?.stopCount ?? '';
      const price = f.deal?.dealPriceFormatted || f.price?.formatted || '';
      const deal = f.deal?.title || '';
      return [airline, origin, dest, departure, arrival, duration, stops, price, deal]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flight-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const dealFlights = filteredFlights.filter(f => f.deal);
  const regularFlights = filteredFlights.filter(f => !f.deal);

  return (
    <div className="w-full max-w-5xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {filteredFlights.length} flight{filteredFlights.length !== 1 ? 's' : ''} found
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {airlineFilter
              ? `Showing ${filteredFlights.length} of ${flights.length} results`
              : typeof totalCount === 'number' && totalCount > flights.length
                ? `Showing ${flights.length} of ${totalCount}`
                : `${flights.length} total results`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadJSON}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCSV}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant={showFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setShowFilter(!showFilter); if (showFilter) setAirlineFilter(''); }}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Airline Filter */}
      {showFilter && (
        <div className="mb-6 p-4 bg-card rounded-xl border border-border/50">
          <label className="block text-sm font-medium text-muted-foreground mb-2">Filter by Airline</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={airlineFilter}
              onChange={e => setAirlineFilter(e.target.value)}
              placeholder="Search airline name..."
              className="pl-9 pr-9 h-10 bg-background"
            />
            {airlineFilter && (
              <button onClick={() => setAirlineFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          {/* Quick airline chips */}
          {allAirlines.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {allAirlines
                .filter(a => !airlineFilter || a.toLowerCase().includes(airlineFilter.toLowerCase()))
                .slice(0, 10)
                .map(name => (
                  <button
                    key={name}
                    onClick={() => setAirlineFilter(name)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      airlineFilter === name
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {name}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Deal flights section */}
      {dealFlights.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-bold text-accent">Special Deals</h3>
            <span className="text-sm text-muted-foreground">({dealFlights.length} deal{dealFlights.length !== 1 ? 's' : ''} applied)</span>
          </div>
          <div className="space-y-4">
            {dealFlights.map((flight) => (
              <FlightCard key={flight.id} flight={flight} isMultiCity={isMultiCity} />
            ))}
          </div>
        </div>
      )}

      {/* Regular flights */}
      {regularFlights.length > 0 && (
        <div>
          {dealFlights.length > 0 && (
            <h3 className="text-lg font-semibold text-foreground mb-4">Other Flights</h3>
          )}
          <div className="space-y-4">
            {regularFlights.map((flight) => (
              <FlightCard key={flight.id} flight={flight} isMultiCity={isMultiCity} />
            ))}
          </div>
        </div>
      )}

      {hasNextPage && onLoadMore && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={!!isLoadingMore} className="min-w-40">
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
};
