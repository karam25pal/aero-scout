import { useState } from 'react';
import { Clock, Plane, ArrowRight, Tag, ChevronDown, ChevronUp, Calendar, MapPin, Users } from 'lucide-react';
import { FlightResult } from '@/types/flight';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlightWithDeal } from '@/lib/applyDeals';
import { LayoverMap } from '@/components/LayoverMap';
import { BookingDialog } from '@/components/BookingDialog';
import { MultiCityReviewDialog } from '@/components/MultiCityReviewDialog';

interface FlightCardProps {
  flight: FlightWithDeal;
  isMultiCity?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (flight: FlightWithDeal) => void;
}

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

const formatTime = (dateString: string): string => {
  if (!dateString) return '--:--';
  if (/^\d{1,2}:\d{2}$/.test(dateString)) return dateString;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getAirlineLogo = (name: string, logoUrl: string): string => {
  // HasData returns Google's logo URLs which may be blocked/expired
  // Use a reliable logo CDN as fallback
  if (logoUrl && !logoUrl.includes('gstatic.com/flights')) return logoUrl;
  // Use airline IATA-style lookup via logo.clearbit.com or a known CDN
  const cleanName = name?.toLowerCase().replace(/\s+/g, '').replace(/airlines?/gi, '');
  return `https://logo.clearbit.com/${cleanName}.com`;
};

export const FlightCard = ({ flight, isMultiCity = false, selectionMode = false, isSelected = false, onSelect }: FlightCardProps) => {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const leg = flight.legs[0];
  const carrier = leg.carriers.marketing[0];
  const deal = flight.deal;
  const formatDate = (dateString: string) => {
    if (!dateString || /^\d{1,2}:\d{2}$/.test(dateString)) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const renderLeg = (legData: typeof leg, isReturn = false) => {
    const legCarrier = legData.carriers.marketing[0];
    const logoSrc = getAirlineLogo(legCarrier.name, legCarrier.logoUrl);

    return (
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        {/* Airline */}
        <div className="flex items-center gap-3 lg:w-44 shrink-0">
          <div className="relative w-11 h-11 rounded-xl bg-secondary/80 flex items-center justify-center overflow-hidden ring-1 ring-border/30">
            <img
              src={logoSrc}
              alt={legCarrier.name}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <Plane className="h-5 w-5 text-primary hidden" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{legCarrier.name}</p>
            {isReturn && (
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Return</span>
            )}
            {legData.stopCount === 0 ? (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-1.5 py-0 mt-0.5 font-medium">
                Nonstop
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-1.5 py-0 mt-0.5 font-medium">
                {legData.stopCount} stop{legData.stopCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="text-center min-w-[60px]">
              <p className="text-xl font-bold text-foreground tracking-tight">{formatTime(legData.departure)}</p>
              <p className="text-xs text-muted-foreground font-medium">{legData.origin.displayCode}</p>
            </div>
            <div className="flex-1 flex flex-col items-center px-2">
              <span className="text-[11px] text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(legData.durationInMinutes)}
              </span>
              <div className="relative w-full h-[2px]">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-primary to-primary/40 rounded-full" />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background" />
                {legData.stopCount > 0 && Array.from({ length: Math.min(legData.stopCount, 2) }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-background"
                    style={{ left: `${((i + 1) / (legData.stopCount + 1)) * 100}%` }}
                  />
                ))}
              </div>
              {legData.stopCount > 0 && legData.layovers && legData.layovers.length > 0 && (
                <span className="text-[10px] text-muted-foreground mt-1">
                  via {legData.layovers.map(l => l.airportCode).join(', ')}
                </span>
              )}
            </div>
            <div className="text-center min-w-[60px]">
              <p className="text-xl font-bold text-foreground tracking-tight">{formatTime(legData.arrival)}</p>
              <p className="text-xs text-muted-foreground font-medium">{legData.destination.displayCode}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`group relative bg-card rounded-2xl overflow-hidden transition-all duration-300 border hover:shadow-lg ${
      deal ? 'border-accent/30 shadow-accent/5 shadow-md' : 'border-border/40 shadow-sm hover:border-primary/20'
    }`}>
      {/* Deal banner */}
      {deal && (
        <div className="bg-gradient-to-r from-accent/10 to-accent/5 px-5 py-2 flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-semibold text-accent">
            {deal.title} — {deal.special_price != null ? `Special £${deal.special_price}` : deal.discount_type === 'fixed' ? `£${deal.discount_value} off` : `${deal.discount_value}% off`}
          </span>
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Main flight content */}
          <div className="flex-1 space-y-4">
            {renderLeg(leg)}

            {/* Additional legs (return or multi-city) */}
            {flight.legs.slice(1).map((extraLeg, i) => (
              <div key={i}>
                <div className="border-t border-dashed border-border/50 my-1" />
                {renderLeg(extraLeg, flight.legs.length === 2 && i === 0)}
              </div>
            ))}
          </div>

          {/* Price & Actions */}
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 lg:w-36 shrink-0 lg:border-l lg:border-border/30 lg:pl-5">
            <div className="text-right">
              {deal ? (
                <>
                  <p className="text-sm line-through text-muted-foreground/60">{flight.price.formatted}</p>
                  <p className="text-2xl font-extrabold text-accent tracking-tight">{deal.dealPriceFormatted}</p>
                </>
              ) : (
                <p className="text-2xl font-extrabold text-primary tracking-tight">{flight.price.formatted}</p>
              )}
              <p className="text-[11px] text-muted-foreground">per person</p>
            </div>
            <div className="flex flex-col gap-1.5 w-full max-w-[140px]">
              {flight.tags && flight.tags.includes('cheapest') && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] justify-center">Cheapest</Badge>
              )}
              {flight.tags && flight.tags.includes('fastest') && (
                <Badge variant="secondary" className="bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 text-[10px] justify-center">Fastest</Badge>
              )}
              {selectionMode ? (
                <Button
                  variant={isSelected ? "default" : "sky"}
                  size="sm"
                  className="w-full font-semibold text-sm h-9 rounded-xl shadow-md hover:shadow-lg transition-all"
                  onClick={(e) => { e.stopPropagation(); onSelect?.(flight); }}
                >
                  {isSelected ? '✓ Selected' : 'Select'}
                </Button>
              ) : (
                <Button
                  variant="sky"
                  size="sm"
                  className="w-full font-semibold text-sm h-9 rounded-xl shadow-md hover:shadow-lg transition-all"
                  onClick={() => isMultiCity ? setReviewOpen(true) : setBookingOpen(true)}
                >
                  {isMultiCity ? 'Review & Book' : 'Book Now'}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[11px] h-7 gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showDetails ? 'Less' : 'Details'}
              </Button>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Date</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{formatDate(leg.departure) || '—'}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Duration</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{formatDuration(leg.durationInMinutes)}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Route</span>
                </div>
                <p className="text-sm font-semibold text-foreground truncate">{leg.origin.name} → {leg.destination.name}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Carrier</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{carrier.name}</p>
              </div>
            </div>
            {leg.stopCount > 0 && leg.layovers && leg.layovers.length > 0 && (
              <div className="mt-3">
                <LayoverMap
                  originCode={leg.origin.displayCode}
                  destinationCode={leg.destination.displayCode}
                  layovers={leg.layovers}
                />
              </div>
            )}
            {flight.isSelfTransfer && (
              <div className="mt-3">
                <Badge variant="secondary" className="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  ⚠ Self-transfer — collect and re-check bags
                </Badge>
              </div>
            )}
          </div>
        )}
      </div>

      {!isMultiCity && <BookingDialog flight={flight} open={bookingOpen} onOpenChange={setBookingOpen} />}
      {isMultiCity && <MultiCityReviewDialog flight={flight} open={reviewOpen} onOpenChange={setReviewOpen} />}
    </div>
  );
};
