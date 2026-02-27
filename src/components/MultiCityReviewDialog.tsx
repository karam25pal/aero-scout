import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Check, Plane, Clock, ChevronRight } from 'lucide-react';
import { FlightWithDeal } from '@/lib/applyDeals';
import { BookingDialog } from '@/components/BookingDialog';

interface MultiCityReviewDialogProps {
  flight: FlightWithDeal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatTime = (dateString: string): string => {
  if (!dateString) return '--:--';
  if (/^\d{1,2}:\d{2}$/.test(dateString)) return dateString;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatDate = (dateString: string): string => {
  if (!dateString || /^\d{1,2}:\d{2}$/.test(dateString)) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

export const MultiCityReviewDialog = ({ flight, open, onOpenChange }: MultiCityReviewDialogProps) => {
  const [currentLeg, setCurrentLeg] = useState(0);
  const [confirmedLegs, setConfirmedLegs] = useState<Set<number>>(new Set());
  const [showBooking, setShowBooking] = useState(false);

  const totalLegs = flight.legs.length;
  const allConfirmed = confirmedLegs.size === totalLegs;
  const leg = flight.legs[currentLeg];
  const carrier = leg?.carriers?.marketing?.[0];

  const handleConfirmLeg = () => {
    setConfirmedLegs(prev => new Set([...prev, currentLeg]));
    if (currentLeg < totalLegs - 1) {
      setCurrentLeg(currentLeg + 1);
    }
  };

  const handleProceedToBooking = () => {
    setShowBooking(true);
    onOpenChange(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setCurrentLeg(0);
      setConfirmedLegs(new Set());
    }
    onOpenChange(val);
  };

  if (!leg) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Review Multi-City Legs
            </DialogTitle>
            <DialogDescription>
              Confirm each leg of your journey before booking
            </DialogDescription>
          </DialogHeader>

          {/* Leg indicator */}
          <div className="flex items-center gap-1.5 justify-center">
            {flight.legs.map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentLeg(i)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    confirmedLegs.has(i)
                      ? 'bg-primary text-primary-foreground'
                      : currentLeg === i
                        ? 'bg-primary/20 text-primary ring-2 ring-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {confirmedLegs.has(i) ? <Check className="h-4 w-4" /> : i + 1}
                </button>
                {i < totalLegs - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>

          {/* Current leg details */}
          <div className="border border-border/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs font-semibold">
                Leg {currentLeg + 1} of {totalLegs}
              </Badge>
              {confirmedLegs.has(currentLeg) && (
                <Badge className="bg-primary/10 text-primary text-xs gap-1">
                  <Check className="h-3 w-3" /> Confirmed
                </Badge>
              )}
            </div>

            {/* Route */}
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{leg.origin.displayCode}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[100px]">{leg.origin.city}</p>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(leg.durationInMinutes)}
                </div>
                <div className="relative w-full h-[2px] bg-gradient-to-r from-primary/40 via-primary to-primary/40 rounded-full">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background" />
                </div>
                {leg.stopCount > 0 ? (
                  <span className="text-[10px] text-amber-500 mt-1">{leg.stopCount} stop{leg.stopCount > 1 ? 's' : ''}</span>
                ) : (
                  <span className="text-[10px] text-emerald-500 mt-1">Nonstop</span>
                )}
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{leg.destination.displayCode}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[100px]">{leg.destination.city}</p>
              </div>
            </div>

            {/* Times & carrier */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Depart</p>
                <p className="font-bold text-foreground">{formatTime(leg.departure)}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(leg.departure)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Arrive</p>
                <p className="font-bold text-foreground">{formatTime(leg.arrival)}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(leg.arrival)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Airline</p>
                <p className="font-bold text-foreground text-xs truncate">{carrier?.name}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {currentLeg > 0 && (
              <Button variant="outline" onClick={() => setCurrentLeg(currentLeg - 1)} className="gap-1">
                ← Back
              </Button>
            )}
            <div className="flex-1" />
            {!confirmedLegs.has(currentLeg) ? (
              <Button variant="sky" onClick={handleConfirmLeg} className="gap-2">
                Confirm Leg {currentLeg + 1} <Check className="h-4 w-4" />
              </Button>
            ) : allConfirmed ? (
              <Button variant="sky" onClick={handleProceedToBooking} className="gap-2">
                Proceed to Booking <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="outline" onClick={() => {
                // Go to next unconfirmed leg
                for (let i = 0; i < totalLegs; i++) {
                  if (!confirmedLegs.has(i)) { setCurrentLeg(i); break; }
                }
              }} className="gap-2">
                Next Leg <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BookingDialog flight={flight} open={showBooking} onOpenChange={setShowBooking} />
    </>
  );
};
