CREATE POLICY "Public insert satisfied_stats" ON satisfied_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update satisfied_stats" ON satisfied_stats FOR UPDATE USING (true) WITH CHECK (true);
