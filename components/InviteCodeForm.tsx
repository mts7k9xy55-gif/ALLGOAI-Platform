'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface InviteCodeFormProps {
  onVerified: () => void
}

export default function InviteCodeForm({ onVerified }: InviteCodeFormProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 招待コードの検証
      const { data: inviteCode, error: inviteError } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single()

      if (inviteError || !inviteCode) {
        setError('無効な招待コードです')
        setLoading(false)
        return
      }

      // 有効期限チェック
      const now = new Date()
      const expiresAt = new Date(inviteCode.expires_at)
      if (expiresAt < now) {
        setError('この招待コードは期限切れです')
        setLoading(false)
        return
      }

      // 使用回数チェック
      if (inviteCode.used_count >= inviteCode.max_uses) {
        setError('この招待コードの使用回数上限に達しています')
        setLoading(false)
        return
      }

      // ユーザー認証チェック
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // 匿名ユーザーとして認証
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
        
        if (authError) {
          setError('認証に失敗しました')
          setLoading(false)
          return
        }

        // 招待コード使用を記録
        if (authData.user) {
          await recordInviteCodeUse(inviteCode.id, authData.user.id)
        }
      } else {
        // 既存ユーザーの場合、使用を記録
        await recordInviteCodeUse(inviteCode.id, session.user.id)
      }

      onVerified()
      router.refresh()
    } catch (err) {
      setError('エラーが発生しました')
      setLoading(false)
    }
  }

  const recordInviteCodeUse = async (inviteCodeId: string, userId: string) => {
    // API経由で使用を記録
    const response = await fetch('/api/invite-codes/use', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invite_code_id: inviteCodeId,
        user_id: userId,
      }),
    })

    const { error } = await response.json()
    if (error) {
      console.error('使用の記録に失敗:', error)
      throw new Error(error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">招待コードを入力</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              招待コード
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="例: ABC123"
              required
              disabled={loading}
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '確認中...' : '送信'}
          </button>
        </form>
      </div>
    </div>
  )
}
