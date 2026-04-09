/**
 * Supabase SQL Migration für chatbot-admin
 * 
 * Füge diese SQL-Befehle in der Supabase SQL Editor aus:
 * https://app.supabase.com/project/YOUR_PROJECT/sql/new
 * 
 * Oder nutze: supabase db push (wenn du das Supabase CLI verwendest)
 */

-- Erstelle die Tabelle 'clients'
CREATE TABLE IF NOT EXISTS public.clients (
  -- Primärer Schlüssel
  id TEXT PRIMARY KEY,

  -- Grundinformationen
  business_name TEXT NOT NULL,

  -- Kontaktinformationen
  phone TEXT,
  email TEXT,
  address TEXT,

  -- Geschäftszeiten und Preise
  opening_hours JSONB,
  prices JSONB,

  -- Abrechnungsinformationen
  monthly_price NUMERIC,
  payment_status TEXT DEFAULT 'offen',

  -- Zusätzliche Informationen
  tone TEXT,
  website TEXT,
  note TEXT,

  -- Status (für admin) und active-Flag (für Widget)
  status TEXT DEFAULT 'aktiv',
  active BOOLEAN DEFAULT true,

  -- Reservierungskonfiguration (optional – wenn nicht gesetzt, kein Kapazitätslimit)
  capacity_per_slot INTEGER,
  slot_interval INTEGER DEFAULT 15,
  default_duration_minutes INTEGER DEFAULT 120,

  -- Zeitstempel
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fehlende Spalten zu bestehender clients-Tabelle hinzufügen (falls Tabelle bereits existiert)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS capacity_per_slot INTEGER;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS slot_interval INTEGER DEFAULT 15;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS default_duration_minutes INTEGER DEFAULT 120;

-- Erstelle die Tabelle 'reservations'
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES public.clients(id),
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 120,
  guests INTEGER NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reservations_client_date ON public.reservations(client_id, date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);

-- RLS für reservations
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for reservations" ON public.reservations
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for reservations" ON public.reservations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for reservations" ON public.reservations
  FOR UPDATE USING (true);

-- Erstelle einen Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_payment_status ON public.clients(payment_status);

-- Setze up Row Level Security (RLS) für Sicherheit
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Erlaube allen angemeldet Benutzern zu lesen
CREATE POLICY "Enable read access for all users" ON public.clients
  FOR SELECT USING (true);

-- Erlaube allen angemeldet Benutzern zu aktualisieren
CREATE POLICY "Enable update access for all users" ON public.clients
  FOR UPDATE USING (true);

-- Erlaube allen angemeldet Benutzern zu INSERT
CREATE POLICY "Enable insert access for all users" ON public.clients
  FOR INSERT WITH CHECK (true);

-- Auto-Update für updated_at Spalte
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Beispiel-Daten (optional)
INSERT INTO public.clients (id, business_name, phone, email, address, monthly_price, payment_status, status, tone)
VALUES 
  ('kunde123', 'Alpen Pflege GmbH', '+41 44 111 22 33', 'kontakt@alpen-pflege.ch', 'Bahnhofstrasse 10, 8001 Zuerich', 149, 'bezahlt', 'aktiv', 'professionell'),
  ('kunde999', 'Nordstern Studio', '+41 31 999 88 77', 'hello@nordstern-studio.ch', 'Marktgasse 2, 3011 Bern', 229, 'offen', 'inaktiv', 'freundlich')
ON CONFLICT (id) DO NOTHING;
