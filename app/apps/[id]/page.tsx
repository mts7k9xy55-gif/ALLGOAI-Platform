'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppPreview from '@/components/AppPreview'
import InstallPWAButton from '@/components/InstallPWAButton'
import CreditPurchaseModal from '@/components/CreditPurchaseModal'

interface App {
  id: string
  name: string
  description: string | null
  github_repo_url: string | null
  zip_file_url: string | null
  deployed_url: string | null
  status: string
  thumbnail_url: string | null
  user_id: string
  free_credits: number | null
  free_credits_used: number | null
}

export default function AppDetailPage() {
  const params = useParams()
  const appId = params.id as string
  const [app, setApp] = useState<App | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null)

  useEffect(() => {
    fetchApp()
    
    // クレジット追加成功後のリフレッシュ
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('credits_added') === 'true') {
        setTimeout(() => fetchApp(), 1000)
      }
    }
  }, [appId])

  const fetchApp = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('apps')
        .select('*')
        .eq('id', appId)
        .single()

      if (fetchError) {
        setError('アプリが見つかりません')
        return
      }

      setApp(data)
      
      // 残りクレジットを計算
      const total = data?.free_credits || 0
      const used = data?.free_credits_used || 0
      setRemainingCredits(Math.max(0, total - used))
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handlePreviewStart = async (): Promise<boolean> => {
    if (!app || remainingCredits === null) return true

    // クレジットが0の場合はモーダルを表示
    if (remainingCredits === 0) {
      setShowCreditModal(true)
      return false
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        return true // 認証なしでもプレビュー可能
      }

      // クレジット使用を記録
      await Promise.all([
        supabase.from('credit_usage').insert({
          app_id: app.id,
          user_id: session.user.id,
          credits_used: 1,
          usage_type: 'preview',
        }),
        supabase.rpc('increment_app_credits_used', { app_id: app.id }),
      ])

      // ローカル状態を更新
      const newRemaining = remainingCredits - 1
      setRemainingCredits(newRemaining)
      
      if (newRemaining === 0) {
        setShowCreditModal(true)
      }

      return true
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('クレジット消費エラー:', err)
      }
      return true // エラー時もプレビューを許可
    }
  }

  useEffect(() => {
    // アプリ閲覧を記録
    if (app) {
      supabase.from('app_views').insert({ app_id: app.id }).catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('閲覧記録エラー:', err)
        }
      })
    }
  }, [app])

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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">{app.name}</h1>
          {app.description && (
            <p className="text-gray-600 mb-4">{app.description}</p>
          )}
          <div className="flex gap-4 items-center flex-wrap">
            <InstallPWAButton />
            {app.deployed_url && (
              <a
                href={app.deployed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                公開サイトを開く
              </a>
            )}
            {app.github_repo_url && (
              <a
                href={app.github_repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-800"
              >
                GitHub →
              </a>
            )}
          </div>
        </div>

        {/* プレビュー */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">プレビュー</h2>
            {remainingCredits !== null && (
              <div className="text-sm">
                {remainingCredits > 0 ? (
                  <span className="text-green-600 font-semibold">
                    無料クレジット残り {remainingCredits}回
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold">
                    クレジット使用済み
                  </span>
                )}
              </div>
            )}
          </div>
          <AppPreview
            githubRepoUrl={app.github_repo_url || undefined}
            zipFileUrl={app.zip_file_url || undefined}
            appId={app.id}
            onPreviewStart={handlePreviewStart}
          />
        </div>
      </div>

      {/* クレジット購入モーダル */}
      <CreditPurchaseModal
        open={showCreditModal}
        onOpenChange={setShowCreditModal}
        appId={app.id}
        appName={app.name}
      />
    </div>
  )
}
