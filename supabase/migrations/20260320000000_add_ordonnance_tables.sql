-- Add medications and prescriptions tables for Ordonnance feature

-- Medications table
CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Prescriptions table
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
  patient_name TEXT NOT NULL,
  age INTEGER,
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  medications JSONB NOT NULL, -- Array of {name: string, dosage: string, duree: string, frequency_count: number, frequency_unit: 'day'|'week', timing: 'avant'|'apres'}
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prescriptions_doctor ON public.prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_date ON public.prescriptions(prescription_date);

-- RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Simplified RLS: Authenticated users can access (doctor role checked in app)
CREATE POLICY "Public read medications" ON public.medications FOR ALL USING (true);

CREATE POLICY "Authenticated insert prescriptions" ON public.prescriptions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read prescriptions" ON public.prescriptions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update prescriptions" ON public.prescriptions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated delete prescriptions" ON public.prescriptions FOR DELETE USING (auth.role() = 'authenticated');

-- Seed some common medications (optional)
INSERT INTO public.medications (name) VALUES 
  ('Paracétamol'),
  ('Ibuprofène'), 
  ('Amoxicilline')
ON CONFLICT (name) DO NOTHING;

