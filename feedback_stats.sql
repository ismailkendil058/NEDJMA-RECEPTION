-- Run in Supabase SQL Editor

-- 1. Feedbacks table
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  client_id TEXT,
  session_id TEXT
);

-- 2. Satisfied counts (daily auto-increment)
CREATE TABLE IF NOT EXISTS satisfied_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  UNIQUE(date)
);

-- Enable RLS
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read feedbacks" ON feedbacks FOR SELECT USING (true);
ALTER TABLE satisfied_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read stats" ON satisfied_stats FOR SELECT USING (true);

-- View for totals
CREATE OR REPLACE VIEW feedback_stats AS
SELECT 
  (SELECT COALESCE(SUM(count), 0) FROM satisfied_stats) as satisfied_count,
  (SELECT COUNT(*) FROM feedbacks) as feedback_count;

