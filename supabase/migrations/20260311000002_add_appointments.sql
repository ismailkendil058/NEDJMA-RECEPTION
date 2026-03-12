-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_phone TEXT NOT NULL,
    client_name TEXT NOT NULL,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
    appointment_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'coming', 'denied', 'no_answer')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allows authenticated users to manage appointments" 
ON public.appointments FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_appointments_phone ON public.appointments(client_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_at);
