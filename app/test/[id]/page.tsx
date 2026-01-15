'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppPreview from '@/components/AppPreview'

interface App {
  id: string
  name: string
  description: string | null
  github_repo_url: string | null
  zip_file_url: string | null
  test_token: string | null
  test_mode: boolean
}

export default function TestAppPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const appId = params.id as string
  const token = searchParams.get('token')
  
  const [app, setApp] = useState<App | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessCount, setAccessCount] = useState(0)

  useEffect(() => {
    if (!token) {
      setError('トークンが指定されていません')
      setLoading(false)
      return
    }

    checkAccess()
  }, [appId, token])

  const checkAccess = async () => {
    try {
      // ログイン確認
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.user) {
        setError('このページにアクセスするにはログインが必要です')
        setLoading(false)
        return
      }

      // アプリとトークンを確認
      const { data: appData, error: appError } = await supabase
        .from('apps')
        .select('*')
        .eq('id', appId)
        .eq('test_token', token)
        .eq('test_mode', true)
        .single()

      if (appError || !appData) {
        setError('無効なトークンです。招待リンクが正しいか確認してください。')
        setLoading(false)
        return
      }

      setApp(appData)

      // トークン全体の使用回数を確認
      const { count: totalCount, error: countError } = await supabase
        .from('invite_access_logs')
        .select('*', { count: 'exact', head: true })
        .eq('app_id', appId)
        .eq('test_token', token)

      if (countError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('使用回数取得エラー:', countError)
        }
        setError('使用回数の確認に失敗しました')
        setLoading(false)
        return
      }

      const currentAccessCount = totalCount || 0

      // 使用上限チェック（5回まで）
      if (currentAccessCount >= 5) {
        setError('この招待リンクの使用上限（5回）に達しました。')
        setLoading(false)
        return
      }

      // 重複チェック（同じユーザーが同じトークンで既にアクセスしているか）
      const { data: existingLogs, error: logError } = await supabase
        .from('invite_access_logs')
        .select('id')
        .eq('app_id', appId)
        .eq('test_token', token)
        .eq('user_id', session.user.id)

      if (logError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('アクセスログ取得エラー:', logError)
        }
        setError('アクセスログの確認に失敗しました')
        setLoading(false)
        return
      }

      // 重複チェック（同じユーザーが既にアクセスしている場合はエラー）
      if (existingLogs && existingLogs.length > 0) {
        setError('あなたは既にこの招待リンクを使用しています。重複アクセスはできません。')
        setLoading(false)
        return
      }

      // アクセスログを記録
      const { error: insertError } = await supabase
        .from('invite_access_logs')
        .insert({
          app_id: appId,
          test_token: token,
          user_id: session.user.id,
          ip_address: null, // クライアント側では取得不可
          user_agent: navigator.userAgent,
        })

      if (insertError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('アクセスログ記録エラー:', insertError)
        }
        setError('アクセスログの記録に失敗しました')
        setLoading(false)
        return
      }

      setAccessCount(currentAccessCount + 1)
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('アクセス確認エラー:', err)
      }
      setError(err.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">読み込み中...</div>
      </div>
    )
  }

  if (error || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold mb-4 text-red-600">アクセスできません</h1>
            <p className="text-gray-600 mb-6">{error || 'アプリが見つかりません'}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{app.name}</h1>
              {app.description && (
                <p className="text-gray-600">{app.description}</p>
              )}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
              <p className="text-sm text-yellow-800 font-semibold">テストモード</p>
              <p className="text-xs text-yellow-600 mt-1">
                使用回数: {accessCount}/5
              </p>
            </div>
          </div>
        </div>

        {/* プレビュー */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">プレビュー</h2>
          <AppPreview
            githubRepoUrl={app.github_repo_url || undefined}
            zipFileUrl={app.zip_file_url || undefined}
            appId={app.id}
          />
        </div>
      </div>
    </div>
  )
}
