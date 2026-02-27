import { useState, useCallback } from 'react';
import { FlightCard } from './FlightCard';
import { BookingDialog } from './BookingDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plane, Check, ArrowRight, ArrowLeft, Clock, ChevronRight, RotateCcw } from 'lucide-react';
import { FlightResult, MultiCityLeg } from '@/types/flight';
import { FlightWithDeal, applyDealsToFlights } from '@/lib/applyDeals';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Deal } from '@/types/deal';

interface MultiCityStepFlowProps {
  legs: MultiCityLeg[];
  cabinClass: string;
  adults: number;
  children: number;
  infants: number;
  stops?: string;
  deals: Deal[];
  onReset: () => void;
}

const formatTime = (dateString: string): string => {
  if (!dateString) return '--:--';
  if (/^\d{1,2}:\d{2}$/.test(dateString)) return dateString;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

export const MultiCityStepFlow = ({
  legs,
  cabinClass,
  adults,
  children: childCount,
  infants,
  stops,
  deals,
  onReset,
}: MultiCityStepFlowProps) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [legFlights, setLegFlights] = useState<Record<number, FlightWithDeal[]>>({});
  const [selectedFlights, setSelectedFlights] = useState<Record<number, FlightWithDeal>>({});
  const [loadingLeg, setLoadingLeg] = useState<number | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  const totalLegs = legs.length;
  const allSelected = Object.keys(selectedFlights).length === totalLegs;

  const searchLeg = useCallback(async (legIndex: number) => {
    const leg = legs[legIndex];
    if (!leg) return;

    setLoadingLeg(legIndex);
    try {
      const { data, error } = await supabase.functions.invoke('search-flights', {
        body: {
          originSkyId: leg.departureId,
          destinationSkyId: leg.arrivalId,
          originEntityId: leg.departureId,
          destinationEntityId: leg.arrivalId,
          date: leg.date,
          cabinClass,
          adults,
          children: childCount,
          infants,
          stops: stops || undefined,
          tripType: 'one-way',
        },
      });
      if (error) throw error;
      if (data?.success) {
        const raw: FlightResult[] = data.data || [];
        const withDeals = applyDealsToFlights(raw, deals);
        setLegFlights(prev => ({ ...prev, [legIndex]: withDeals }));
        if (raw.length === 0) {
          toast({ title: 'No flights found', description: `No flights for leg ${legIndex + 1}. Try different dates.` });
        }
      } else {
        throw new Error(data?.error || 'Search failed');
      }
    } catch (err) {
      console.error(`Error searching leg ${legIndex}:`, err);
      toast({
        title: 'Search failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoadingLeg(null);
    }
  }, [legs, cabinClass, adults, childCount, infants, stops, deals, toast]);

  // Auto-search current leg if not yet searched
  const handleStepEnter = useCallback((step: number) => {
    setCurrentStep(step);
    if (!legFlights[step] && loadingLeg === null) {
      searchLeg(step);
    }
  }, [legFlights, loadingLeg, searchLeg]);

  // Initialize: search leg 0 on mount
  useState(() => {
    if (!legFlights[0]) searchLeg(0);
  });

  const handleSelectFlight = (flight: FlightWithDeal) => {
    setSelectedFlights(prev => ({ ...prev, [currentStep]: flight }));
    // Auto-advance to next leg or review
    if (currentStep < totalLegs - 1) {
      setTimeout(() => handleStepEnter(currentStep + 1), 300);
    } else {
      // All legs selected, move to review
      setCurrentStep(totalLegs); // review step
    }
  };

  const handleChangeLeg = (legIndex: number) => {
    // Remove selection for this leg and all subsequent
    setSelectedFlights(prev => {
      const next = { ...prev };
      for (let i = legIndex; i < totalLegs; i++) delete next[i];
      return next;
    });
    handleStepEnter(legIndex);
  };

  // Build a combined flight for booking dialog
  const buildCombinedFlight = (): FlightWithDeal | null => {
    if (!allSelected) return null;
    const allLegs = Object.values(selectedFlights).flatMap(f => f.legs);
    const totalPrice = Object.values(selectedFlights).reduce((sum, f) => sum + (f.deal?.dealPrice ?? f.price.raw), 0);
    return {
      id: 'multi-city-combined',
      price: { raw: totalPrice, formatted: `£${Math.round(totalPrice)}` },
      legs: allLegs,
      isSelfTransfer: true,
      effectivePrice: totalPrice,
    };
  };

  const isReviewStep = currentStep === totalLegs;
  const currentLeg = legs[currentStep];
  const currentResults = legFlights[currentStep] || [];
  const isLoading = loadingLeg === currentStep;

  return (
    <div className="w-full max-w-5xl mx-auto mt-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2 justify-center mb-6">
        {legs.map((leg, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedFlights[i] || i <= currentStep) {
                  if (i < currentStep && selectedFlights[i]) {
                    setCurrentStep(i);
                  } else if (i === currentStep) {
                    // already here
                  } else if (!selectedFlights[i]) {
                    handleStepEnter(i);
                  }
                }
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                selectedFlights[i]
                  ? 'bg-primary text-primary-foreground cursor-pointer'
                  : currentStep === i
                    ? 'bg-primary/20 text-primary ring-2 ring-primary'
                    : 'bg-muted text-muted-foreground cursor-default'
              }`}
            >
              {selectedFlights[i] ? <Check className="h-4 w-4" /> : i + 1}
            </button>
            {i < totalLegs - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
        {/* Review step */}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
          isReviewStep
            ? 'bg-primary/20 text-primary ring-2 ring-primary'
            : allSelected
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
        }`}>
          ✓
        </div>
      </div>

      {/* Current leg header */}
      {!isReviewStep && currentLeg && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                Leg {currentStep + 1}: {currentLeg.originLabel || currentLeg.departureId} → {currentLeg.destinationLabel || currentLeg.arrivalId}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {currentLeg.date} · Select a flight for this leg
              </p>
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(currentStep - 1)} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onReset} className="gap-1">
                <RotateCcw className="h-4 w-4" /> New Search
              </Button>
            </div>
          </div>

          {/* Selected indicator for this leg */}
          {selectedFlights[currentStep] && (
            <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Flight selected: {selectedFlights[currentStep].legs[0]?.carriers?.marketing?.[0]?.name} · {selectedFlights[currentStep].deal?.dealPriceFormatted || selectedFlights[currentStep].price.formatted}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleChangeLeg(currentStep)} className="text-xs">
                Change
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && !isReviewStep && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <Plane className="h-12 w-12 text-primary animate-float" />
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
          </div>
          <p className="mt-6 text-lg text-muted-foreground animate-pulse-soft">
            Searching flights for leg {currentStep + 1}...
          </p>
          <div className="mt-4 flex gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Flight results for current leg */}
      {!isLoading && !isReviewStep && currentResults.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{currentResults.length} flight{currentResults.length !== 1 ? 's' : ''} found — tap a flight to select it</p>
          {currentResults.map(flight => (
            <div
              key={flight.id}
              className={`cursor-pointer transition-all rounded-2xl ${
                selectedFlights[currentStep]?.id === flight.id
                  ? 'ring-2 ring-primary shadow-lg'
                  : 'hover:ring-1 hover:ring-primary/30'
              }`}
              onClick={() => handleSelectFlight(flight)}
            >
              <FlightCard flight={flight} />
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {!isLoading && !isReviewStep && currentResults.length === 0 && legFlights[currentStep] !== undefined && (
        <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
          <Plane className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No flights found for this leg</h3>
          <p className="text-muted-foreground mb-4">Try a different date or route</p>
          <Button variant="outline" onClick={onReset}>New Search</Button>
        </div>
      )}

      {/* REVIEW STEP */}
      {isReviewStep && allSelected && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              Review Your Journey
            </h2>
            <Button variant="outline" size="sm" onClick={onReset} className="gap-1">
              <RotateCcw className="h-4 w-4" /> Start Over
            </Button>
          </div>

          {/* Selected flights summary */}
          <div className="space-y-3">
            {legs.map((leg, i) => {
              const selected = selectedFlights[i];
              if (!selected) return null;
              const fLeg = selected.legs[0];
              const carrier = fLeg?.carriers?.marketing?.[0];
              return (
                <div key={i} className="border border-border/50 rounded-xl p-4 bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary" className="text-xs font-semibold">
                      Leg {i + 1}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => handleChangeLeg(i)}>
                      Change
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{fLeg.origin.displayCode}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(fLeg.departure)}</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(fLeg.durationInMinutes)}
                      </div>
                      <div className="w-full h-[2px] bg-gradient-to-r from-primary/40 via-primary to-primary/40 rounded-full my-1" />
                      <p className="text-[10px] text-muted-foreground">{carrier?.name}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{fLeg.destination.displayCode}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(fLeg.arrival)}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-primary">
                        {selected.deal?.dealPriceFormatted || selected.price.formatted}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total price */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total for all {totalLegs} legs</p>
              <p className="text-2xl font-extrabold text-primary">
                £{Math.round(Object.values(selectedFlights).reduce((sum, f) => sum + (f.deal?.dealPrice ?? f.price.raw), 0))}
              </p>
              <p className="text-xs text-muted-foreground">per person</p>
            </div>
            <Button
              variant="sky"
              size="lg"
              className="gap-2 font-semibold text-base px-8"
              onClick={() => setShowBooking(true)}
            >
              Book Now <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Booking dialog */}
      {showBooking && buildCombinedFlight() && (
        <BookingDialog
          flight={buildCombinedFlight()!}
          open={showBooking}
          onOpenChange={setShowBooking}
        />
      )}
    </div>
  );
};
