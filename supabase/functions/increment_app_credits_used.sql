-- アプリのクレジット使用回数をインクリメント
CREATE OR REPLACE FUNCTION increment_app_credits_used(app_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE apps
  SET free_credits_used = COALESCE(free_credits_used, 0) + 1
  WHERE id = app_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
