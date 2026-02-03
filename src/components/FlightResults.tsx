import { FlightResult } from '@/types/flight';
import { FlightCard } from './FlightCard';
import { Plane } from 'lucide-react';

interface FlightResultsProps {
  flights: FlightResult[];
  isLoading: boolean;
}

export const FlightResults = ({ flights, isLoading }: FlightResultsProps) => {
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

  if (flights.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          {flights.length} flight{flights.length !== 1 ? 's' : ''} found
        </h2>
      </div>
      <div className="space-y-4">
        {flights.map((flight) => (
          <FlightCard key={flight.id} flight={flight} />
        ))}
      </div>
    </div>
  );
};
