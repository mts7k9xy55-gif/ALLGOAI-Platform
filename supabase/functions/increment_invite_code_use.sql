CREATE OR REPLACE FUNCTION increment_invite_code_use(code_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE invite_codes
  SET used_count = used_count + 1
  WHERE id = code_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
