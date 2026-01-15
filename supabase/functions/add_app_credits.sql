-- アプリのクレジットを追加
CREATE OR REPLACE FUNCTION add_app_credits(app_id UUID, credits_to_add INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE apps
  SET free_credits = COALESCE(free_credits, 0) + credits_to_add
  WHERE id = app_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
