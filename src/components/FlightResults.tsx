import { FlightCard } from './FlightCard';
import { Plane, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FlightWithDeal } from '@/lib/applyDeals';

interface FlightResultsProps {
  flights: FlightWithDeal[];
  isLoading: boolean;
  totalCount?: number;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export const FlightResults = ({
  flights,
  isLoading,
  totalCount,
  hasNextPage,
  isLoadingMore,
  onLoadMore,
}: FlightResultsProps) => {
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

  const dealFlights = flights.filter(f => f.deal);
  const regularFlights = flights.filter(f => !f.deal);

  return (
    <div className="w-full max-w-5xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {flights.length} flight{flights.length !== 1 ? 's' : ''} found
          </h2>
          {typeof totalCount === 'number' && totalCount > flights.length && (
            <p className="text-sm text-muted-foreground mt-1">Showing {flights.length} of {totalCount}</p>
          )}
        </div>
      </div>

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
              <FlightCard key={flight.id} flight={flight} />
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
              <FlightCard key={flight.id} flight={flight} />
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
