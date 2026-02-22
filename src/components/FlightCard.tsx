import { useState } from 'react';
import { Clock, Plane, ArrowRight, Tag, Phone } from 'lucide-react';
import { FlightResult } from '@/types/flight';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlightWithDeal } from '@/lib/applyDeals';
import { LayoverMap } from '@/components/LayoverMap';
import { BookingDialog } from '@/components/BookingDialog';

interface FlightCardProps {
  flight: FlightWithDeal;
}

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

const formatTime = (dateString: string): string => {
  if (!dateString) return '--:--';
  // If it's already a short time like "22:05", return as-is
  if (/^\d{1,2}:\d{2}$/.test(dateString)) return dateString;
  // Otherwise try parsing as a full date
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const FlightCard = ({ flight }: FlightCardProps) => {
  const [bookingOpen, setBookingOpen] = useState(false);
  const leg = flight.legs[0];
  const carrier = leg.carriers.marketing[0];
  const deal = flight.deal;

  return (
    <div className={`bg-card rounded-xl p-6 card-shadow hover:card-shadow-hover transition-all duration-300 border group ${deal ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border/50'}`}>
      {deal && (
        <div className="flex items-center gap-2 mb-4 -mt-1">
          <Badge className="bg-accent text-accent-foreground gap-1">
            <Tag className="h-3 w-3" />
            {deal.title} — {deal.special_price != null ? `Special £${deal.special_price}` : deal.discount_type === 'fixed' ? `£${deal.discount_value} off` : `${deal.discount_value}% off`}
          </Badge>
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Airline Info */}
        <div className="flex items-center gap-4 lg:w-48">
          {carrier.logoUrl ? (
            <img src={carrier.logoUrl} alt={carrier.name} className="w-10 h-10 object-contain rounded" />
          ) : (
            <div className="w-10 h-10 bg-secondary rounded flex items-center justify-center">
              <Plane className="h-5 w-5 text-primary" />
            </div>
          )}
           <div>
            <p className="font-semibold text-foreground">{carrier.name}</p>
            {leg.stopCount === 0 ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 mt-1">
                ✈ Nonstop
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 mt-1">
                {leg.stopCount} stop{leg.stopCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Flight Details */}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{formatTime(leg.departure)}</p>
              <p className="text-sm text-muted-foreground">{leg.origin.displayCode}</p>
            </div>
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
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{formatTime(leg.arrival)}</p>
              <p className="text-sm text-muted-foreground">{leg.destination.displayCode}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 text-sm">
            <span className="text-muted-foreground">{leg.origin.city}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />
            <span className="text-muted-foreground">{leg.destination.city}</span>
          </div>
          {leg.stopCount > 0 && leg.layovers && leg.layovers.length > 0 && (
            <LayoverMap
              originCode={leg.origin.displayCode}
              destinationCode={leg.destination.displayCode}
              layovers={leg.layovers}
            />
          )}
        </div>

        {/* Price & Book */}
        <div className="flex flex-col items-end gap-3 lg:w-40">
          <div className="text-right">
            {deal ? (
              <>
                <p className="text-lg line-through text-muted-foreground">{flight.price.formatted}</p>
                <p className="text-3xl font-bold text-accent">{deal.dealPriceFormatted}</p>
              </>
            ) : (
              <p className="text-3xl font-bold text-primary">{flight.price.formatted}</p>
            )}
            <p className="text-sm text-muted-foreground">per person</p>
          </div>
          {flight.tags && flight.tags.includes('cheapest') && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Cheapest</Badge>
          )}
          {flight.tags && flight.tags.includes('fastest') && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Fastest</Badge>
          )}
          <Button variant="sky" className="w-full group-hover:scale-105 transition-transform gap-2" onClick={() => setBookingOpen(true)}>
            <Phone className="h-4 w-4" /> Call to Book
          </Button>
        </div>
      </div>

      {/* Return Leg */}
      {flight.legs.length > 1 && (
        <>
          <div className="my-6 border-t border-dashed border-border" />
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-center gap-4 lg:w-48">
              {flight.legs[1].carriers.marketing[0].logoUrl ? (
                <img src={flight.legs[1].carriers.marketing[0].logoUrl} alt={flight.legs[1].carriers.marketing[0].name} className="w-10 h-10 object-contain rounded" />
              ) : (
                <div className="w-10 h-10 bg-secondary rounded flex items-center justify-center">
                  <Plane className="h-5 w-5 text-primary" />
                </div>
              )}
              <div>
                <p className="font-semibold text-foreground">{flight.legs[1].carriers.marketing[0].name}</p>
                {flight.legs[1].stopCount === 0 ? (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 mt-1">
                    ✈ Nonstop
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 mt-1">
                    {flight.legs[1].stopCount} stop{flight.legs[1].stopCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
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
              {flight.legs[1].stopCount > 0 && flight.legs[1].layovers && flight.legs[1].layovers.length > 0 && (
                <LayoverMap
                  originCode={flight.legs[1].origin.displayCode}
                  destinationCode={flight.legs[1].destination.displayCode}
                  layovers={flight.legs[1].layovers}
                />
              )}
            </div>
            <div className="lg:w-40" />
          </div>
        </>
      )}
      <BookingDialog flight={flight} open={bookingOpen} onOpenChange={setBookingOpen} />
    </div>
  );
};
