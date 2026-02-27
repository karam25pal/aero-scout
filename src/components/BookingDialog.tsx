import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, CreditCard, Lock, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FlightWithDeal } from '@/lib/applyDeals';

interface BookingDialogProps {
  flight: FlightWithDeal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'details' | 'payment' | 'confirmation';

export const BookingDialog = ({ flight, open, onOpenChange }: BookingDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('details');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '' });

  const leg = flight.legs[0];
  const carrier = leg.carriers.marketing[0];
  const price = flight.deal ? flight.deal.dealPriceFormatted : flight.price.formatted;

  const formatCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('payment');
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
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

    try {
      const cardLastFour = card.number.replace(/\s/g, '').slice(-4);
      // Save booking lead with masked card details
      const { data: insertedData, error } = await supabase.from('booking_leads').insert({
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        flight_details: flightDetails,
        card_last_four: cardLastFour,
        card_expiry: card.expiry,
      } as any).select('booking_number').single();

      if (error) throw error;

      const bookingNumber = (insertedData as any)?.booking_number || '';

      // Send email notification via Resend
      try {
        await supabase.functions.invoke('send-booking-email', {
          body: {
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            flightDetails,
            cardLastFour,
            cardExpiry: card.expiry,
            bookingNumber,
          },
        });
      } catch (emailErr) {
        console.warn('Email notification failed (non-blocking):', emailErr);
      }

      setStep('confirmation');
    } catch (err) {
      console.error('Booking error:', err);
      toast({ title: 'Error', description: 'Failed to submit booking. Please try again.', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setStep('details');
      setForm({ fullName: '', email: '', phone: '' });
      setCard({ number: '', expiry: '', cvc: '' });
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'details' && 'Your Details'}
            {step === 'payment' && 'Reserve Your Price'}
            {step === 'confirmation' && 'Booking Confirmed!'}
          </DialogTitle>
          <DialogDescription>
            {carrier.name} · {leg.origin.displayCode} → {leg.destination.displayCode} · {price}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 justify-center mb-2">
          {(['details', 'payment', 'confirmation'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step === s ? 'bg-primary text-primary-foreground' :
                (['details', 'payment', 'confirmation'].indexOf(step) > i) ? 'bg-primary/20 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              {i < 2 && <div className="w-8 h-0.5 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Personal Details */}
        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
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
            <Button type="submit" variant="sky" className="w-full gap-2">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}

        {/* Step 2: Card Details */}
        {step === 'payment' && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-3 text-sm text-center">
              <Lock className="h-4 w-4 inline-block mr-1 text-primary" />
              Enter card details to <span className="font-semibold text-foreground">reserve your price at {price}</span>. You will not be charged now.
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5"><CreditCard className="h-3.5 w-3.5" /> Card Number</Label>
              <Input
                value={card.number}
                onChange={e => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                required
                placeholder="1234 5678 9012 3456"
                maxLength={19}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Expiry</Label>
                <Input
                  value={card.expiry}
                  onChange={e => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                  required
                  placeholder="MM/YY"
                  maxLength={5}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">CVC</Label>
                <Input
                  value={card.cvc}
                  onChange={e => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  required
                  placeholder="123"
                  maxLength={4}
                  type="password"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="gap-1" onClick={() => setStep('details')}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button type="submit" variant="sky" className="flex-1 gap-2" disabled={submitting}>
                {submitting ? 'Reserving...' : 'Reserve Price'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" /> Secure — no charge until booking is confirmed
            </p>
          </form>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirmation' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Thank you, {form.fullName.split(' ')[0]}!</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Your price of <span className="font-semibold text-foreground">{price}</span> has been reserved.
            </p>
            <div className="bg-secondary/50 rounded-lg p-4 text-sm text-left space-y-2 mb-4">
              <p className="font-medium text-foreground">What happens next?</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ Our team will review your booking</li>
                <li>✓ We'll contact you at <span className="text-foreground">{form.phone}</span></li>
                <li>✓ Confirmation sent to <span className="text-foreground">{form.email}</span></li>
              </ul>
            </div>
            <Button variant="sky" className="w-full" onClick={() => handleClose(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
