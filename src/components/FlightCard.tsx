import { Clock, Plane, ArrowRight } from 'lucide-react';
import { FlightResult } from '@/types/flight';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FlightCardProps {
  flight: FlightResult;
}

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const FlightCard = ({ flight }: FlightCardProps) => {
  const leg = flight.legs[0];
  const carrier = leg.carriers.marketing[0];

  return (
    <div className="bg-card rounded-xl p-6 card-shadow hover:card-shadow-hover transition-all duration-300 border border-border/50 group">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Airline Info */}
        <div className="flex items-center gap-4 lg:w-48">
          {carrier.logoUrl ? (
            <img 
              src={carrier.logoUrl} 
              alt={carrier.name} 
              className="w-10 h-10 object-contain rounded"
            />
          ) : (
            <div className="w-10 h-10 bg-secondary rounded flex items-center justify-center">
              <Plane className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground">{carrier.name}</p>
            <p className="text-sm text-muted-foreground">
              {leg.stopCount === 0 ? 'Direct' : `${leg.stopCount} stop${leg.stopCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Flight Details */}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4">
            {/* Departure */}
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{formatTime(leg.departure)}</p>
              <p className="text-sm text-muted-foreground">{leg.origin.displayCode}</p>
            </div>

            {/* Duration & Route */}
            <div className="flex-1 flex flex-col items-center px-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(leg.durationInMinutes)}</span>
              </div>
              <div className="relative w-full">
                <div className="h-0.5 bg-border w-full" />
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
                {leg.stopCount > 0 && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full border-2 border-card" />
                )}
                <Plane className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-primary transform -rotate-90" />
              </div>
            </div>

            {/* Arrival */}
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{formatTime(leg.arrival)}</p>
              <p className="text-sm text-muted-foreground">{leg.destination.displayCode}</p>
            </div>
          </div>

          {/* Cities */}
          <div className="flex items-center justify-between mt-2 text-sm">
            <span className="text-muted-foreground">{leg.origin.city}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />
            <span className="text-muted-foreground">{leg.destination.city}</span>
          </div>
        </div>

        {/* Price & Book */}
        <div className="flex flex-col items-end gap-3 lg:w-40">
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">{flight.price.formatted}</p>
            <p className="text-sm text-muted-foreground">per person</p>
          </div>
          {flight.tags && flight.tags.includes('cheapest') && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              Cheapest
            </Badge>
          )}
          {flight.tags && flight.tags.includes('fastest') && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              Fastest
            </Badge>
          )}
          <Button variant="sky" className="w-full group-hover:scale-105 transition-transform">
            Select
          </Button>
        </div>
      </div>

      {/* Return Leg */}
      {flight.legs.length > 1 && (
        <>
          <div className="my-6 border-t border-dashed border-border" />
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Airline Info */}
            <div className="flex items-center gap-4 lg:w-48">
              {flight.legs[1].carriers.marketing[0].logoUrl ? (
                <img 
                  src={flight.legs[1].carriers.marketing[0].logoUrl} 
                  alt={flight.legs[1].carriers.marketing[0].name} 
                  className="w-10 h-10 object-contain rounded"
                />
              ) : (
                <div className="w-10 h-10 bg-secondary rounded flex items-center justify-center">
                  <Plane className="h-5 w-5 text-primary" />
                </div>
              )}
              <div>
                <p className="font-semibold text-foreground">{flight.legs[1].carriers.marketing[0].name}</p>
                <p className="text-sm text-muted-foreground">
                  {flight.legs[1].stopCount === 0 ? 'Direct' : `${flight.legs[1].stopCount} stop${flight.legs[1].stopCount > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* Flight Details */}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{formatTime(flight.legs[1].departure)}</p>
                  <p className="text-sm text-muted-foreground">{flight.legs[1].origin.displayCode}</p>
                </div>

                <div className="flex-1 flex flex-col items-center px-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(flight.legs[1].durationInMinutes)}</span>
                  </div>
                  <div className="relative w-full">
                    <div className="h-0.5 bg-border w-full" />
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
                    <div className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
                    {flight.legs[1].stopCount > 0 && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full border-2 border-card" />
                    )}
                    <Plane className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-primary transform -rotate-90" />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{formatTime(flight.legs[1].arrival)}</p>
                  <p className="text-sm text-muted-foreground">{flight.legs[1].destination.displayCode}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-muted-foreground">{flight.legs[1].origin.city}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />
                <span className="text-muted-foreground">{flight.legs[1].destination.city}</span>
              </div>
            </div>

            <div className="lg:w-40" />
          </div>
        </>
      )}
    </div>
  );
};
