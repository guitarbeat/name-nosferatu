-- Function: get_leaderboard_stats
-- FIX get_leaderboard_stats (now uses cat_names and user_cat_name_ratings)
CREATE OR REPLACE FUNCTION get_leaderboard_stats()
RETURNS TABLE (
  cat_id UUID,
  cat_name TEXT,
  rating FLOAT
) AS $$
BEGIN
  RETURN QUERY SELECT
    c.id AS cat_id,
    c.name AS cat_name,
    AVG(r.rating)::FLOAT AS rating
  FROM cat_names c
  JOIN user_cat_name_ratings r ON c.id = r.name_id
  GROUP BY c.id, c.name
  ORDER BY rating DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
