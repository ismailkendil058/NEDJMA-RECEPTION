create or replace function increment_satisfied_count()
returns void as $$
begin
  insert into satisfied_stats (date, count)
  values (current_date, 1)
  on conflict (date) 
  do update set count = satisfied_stats.count + 1;
end;
$$ language plpgsql security definer;
