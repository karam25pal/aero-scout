
-- Add booking management columns
ALTER TABLE public.booking_leads 
  ADD COLUMN booking_number text UNIQUE DEFAULT 'BK-' || substr(gen_random_uuid()::text, 1, 8),
  ADD COLUMN status text NOT NULL DEFAULT 'new',
  ADD COLUMN admin_notes jsonb DEFAULT '[]'::jsonb;

-- Allow admins to update and delete booking leads
CREATE POLICY "Admins can update booking leads"
  ON public.booking_leads
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete booking leads"
  ON public.booking_leads
  FOR DELETE
  USING (public.is_admin(auth.uid()));
