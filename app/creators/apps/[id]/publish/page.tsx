'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadStripe } from '@stripe/stripe-js'

interface App {
  id: string
  name: string
  github_repo_full_name: string | null
  status: string
}

export default function PublishPage() {
  const params = useParams()
  const router = useRouter()
  const appId = params.id as string
  const [app, setApp] = useState<App | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [testMode, setTestMode] = useState(false)

  useEffect(() => {
    fetchApp()
  }, [appId])

  const fetchApp = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('apps')
        .select('*')
        .eq('id', appId)
        .single()

      if (fetchError || !data) {
        setError('アプリが見つかりません')
        return
      }

      setApp(data)
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!app) return

    setPublishing(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setError('ログインが必要です')
        setPublishing(false)
        return
      }

      // 公開リクエストを作成
      const publishPrice = testMode ? 0 : 1000 // テストモードは無料

      // Stripe Checkout Sessionを作成
      const response = await fetch('/api/publish/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: app.id,
          user_id: session.user.id,
          amount: publishPrice,
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        setPublishing(false)
        return
      }

      // テストモードの場合は招待リンクを表示
      if (data.testMode && data.testUrl) {
        alert(`テストモードで公開しました！\n\n招待リンク:\n${data.testUrl}\n\nこのリンクは5回まで使用できます。`)
        router.push(`/creators/apps/${app.id}`)
        return
      }

      // 通常モードの場合はStripe Checkoutにリダイレクト
      if (data.sessionId) {
        const stripe = await loadStripe(
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
        )
        if (stripe) {
          await stripe.redirectToCheckout({ sessionId: data.sessionId })
        }
      } else {
        setError('決済セッションの作成に失敗しました')
        setPublishing(false)
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    )
  }

  if (error || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error || 'アプリが見つかりません'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">アプリを公開</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{app.name}</h2>
          {app.github_repo_full_name && (
            <p className="text-gray-600 mb-4">
              GitHub: {app.github_repo_full_name}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">公開モード</h3>
          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="publishMode"
                checked={!testMode}
                onChange={() => setTestMode(false)}
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-semibold">通常公開（¥1,000）</div>
                <div className="text-sm text-gray-600">
                  アプリを公開サイトで利用可能にします。自動デプロイ、カスタムURL、招待コード5件限定。
                </div>
              </div>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="publishMode"
                checked={testMode}
                onChange={() => setTestMode(true)}
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-semibold">テストモード（無料）</div>
                <div className="text-sm text-gray-600">
                  招待リンクを生成します。5回までアクセス可能。ログイン必須で重複防止。
                </div>
              </div>
            </label>
          </div>
        </div>

        {!testMode && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">公開料</span>
              <span className="text-2xl font-bold text-blue-600">¥1,000</span>
            </div>
            <p className="text-sm text-gray-500">
              初回公開のみ。更新は無料です。
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handlePublish}
          disabled={publishing || app.status === 'published'}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
        >
          {publishing
            ? '処理中...'
            : app.status === 'published'
            ? '既に公開済み'
            : testMode
            ? 'テストモードで公開（無料）'
            : '公開して決済に進む'}
        </button>
      </div>
    </div>
  )
}
