import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, User, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FlightWithDeal } from '@/lib/applyDeals';

interface BookingDialogProps {
  flight: FlightWithDeal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BookingDialog = ({ flight, open, onOpenChange }: BookingDialogProps) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
  const [submitted, setSubmitted] = useState(false);

  const leg = flight.legs[0];
  const carrier = leg.carriers.marketing[0];
  const price = flight.deal ? flight.deal.dealPriceFormatted : flight.price.formatted;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const flightDetails = {
      airline: carrier.name,
      origin: `${leg.origin.city} (${leg.origin.displayCode})`,
      destination: `${leg.destination.city} (${leg.destination.displayCode})`,
      departure: leg.departure,
      arrival: leg.arrival,
      price,
      originalPrice: flight.price.formatted,
      deal: flight.deal?.title || null,
      stops: leg.stopCount,
      returnLeg: flight.legs.length > 1 ? {
        origin: `${flight.legs[1].origin.city} (${flight.legs[1].origin.displayCode})`,
        destination: `${flight.legs[1].destination.city} (${flight.legs[1].destination.displayCode})`,
        departure: flight.legs[1].departure,
        arrival: flight.legs[1].arrival,
      } : null,
    };

    const { error } = await supabase.from('booking_leads').insert({
      full_name: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      flight_details: flightDetails,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to submit. Please try again.', variant: 'destructive' });
    } else {
      setSubmitted(true);
      toast({ title: 'Booking request sent!', description: 'We will contact you shortly.' });
    }
    setSubmitting(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setSubmitted(false);
      setForm({ fullName: '', email: '', phone: '' });
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book This Flight</DialogTitle>
          <DialogDescription>
            {carrier.name} · {leg.origin.displayCode} → {leg.destination.displayCode} · {price}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">We'll call you soon!</h3>
            <p className="text-muted-foreground text-sm">Our team will reach out to complete your booking.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5"><User className="h-3.5 w-3.5" /> Full Name</Label>
              <Input
                value={form.fullName}
                onChange={e => setForm({ ...form, fullName: e.target.value })}
                required
                maxLength={100}
                placeholder="Your full name"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                maxLength={255}
                placeholder="you@email.com"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                required
                maxLength={20}
                placeholder="+44 7XXX XXXXXX"
              />
            </div>
            <Button type="submit" variant="sky" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Request Callback'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Our team will call you to finalize your booking.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
