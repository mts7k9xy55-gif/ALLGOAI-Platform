-- Supabase Storageバケット作成
-- Storage > Buckets で手動作成するか、このSQLを実行

-- アプリアップロード用バケット
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-uploads', 'app-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- バケットポリシー（アップロードは認証済みユーザーのみ）
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'app-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'app-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
