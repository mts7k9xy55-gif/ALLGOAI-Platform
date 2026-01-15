'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import InviteCodeForm from '@/components/InviteCodeForm'
import InstallPWAButton from '@/components/InstallPWAButton'

interface App {
  id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  deployed_url: string | null
  status: string
  published_at: string | null
  free_credits: number | null
  free_credits_used: number | null
  category: string | null
}

export default function HomePage() {
  const [apps, setApps] = useState<App[]>([])
  const [filteredApps, setFilteredApps] = useState<App[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [isVerified, setIsVerified] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      const { data: inviteUses } = await supabase
        .from('invite_code_uses')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)

      const verified = (inviteUses?.length || 0) > 0
      setIsVerified(verified)
      
      if (verified) {
        await fetchApps()
      } else {
        setLoading(false)
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('認証確認エラー:', err)
      }
      setLoading(false)
    }
  }

  const fetchApps = async () => {
    try {
      const { data: appsData, error } = await supabase
        .from('apps')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // 閲覧数を取得してソート（簡易実装）
      const appsWithViews = (appsData || []).map((app) => ({
        ...app,
        viewCount: 0, // 閲覧数は後で実装
      }))

      setApps(appsWithViews)
      setFilteredApps(appsWithViews)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('アプリ取得エラー:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredApps(apps)
    } else {
      setFilteredApps(apps.filter((app) => app.category === selectedCategory))
    }
  }, [selectedCategory, apps])

  const handleInviteVerified = () => {
    setIsVerified(true)
    fetchApps()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    )
  }

  if (!isVerified) {
    return <InviteCodeForm onVerified={handleInviteVerified} />
  }

  const getRemainingCredits = (app: App) => {
    const total = app.free_credits || 0
    const used = app.free_credits_used || 0
    return Math.max(0, total - used)
  }

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case 'ai-tool':
        return 'AIツール'
      case 'trending':
        return 'トレンド'
      case 'latest':
        return '最新'
      default:
        return 'その他'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">公開アプリ一覧</h1>
          <div className="flex gap-4 items-center">
            <InstallPWAButton />
            <Link
              href="/creators/upload"
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
            >
              アプリをアップロード
            </Link>
          </div>
        </div>

        {/* カテゴリフィルター */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-md ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            すべて
          </button>
          <button
            onClick={() => setSelectedCategory('trending')}
            className={`px-4 py-2 rounded-md ${
              selectedCategory === 'trending'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            トレンド
          </button>
          <button
            onClick={() => setSelectedCategory('ai-tool')}
            className={`px-4 py-2 rounded-md ${
              selectedCategory === 'ai-tool'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            AIツール
          </button>
          <button
            onClick={() => setSelectedCategory('latest')}
            className={`px-4 py-2 rounded-md ${
              selectedCategory === 'latest'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            最新
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApps.map((app) => {
            const remainingCredits = getRemainingCredits(app)
            return (
              <Link
                key={app.id}
                href={`/apps/${app.id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {app.thumbnail_url && (
                  <img
                    src={app.thumbnail_url}
                    alt={app.name}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-semibold">{app.name}</h3>
                    {app.category && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {getCategoryLabel(app.category)}
                      </span>
                    )}
                  </div>
                  {app.description && (
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {app.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center">
                    {remainingCredits > 0 ? (
                      <span className="text-sm font-semibold text-green-600">
                        無料クレジット残り {remainingCredits}回
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">
                        クレジット使用済み
                      </span>
                    )}
                    {app.deployed_url && (
                      <span className="text-sm text-blue-600">公開中 →</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {filteredApps.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">まだ公開されているアプリがありません</p>
            <Link
              href="/creators/upload"
              className="text-blue-600 hover:text-blue-700"
            >
              最初のアプリをアップロードする →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
