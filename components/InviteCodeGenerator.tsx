'use client'

import { useState, useEffect } from 'react'

export default function InviteCodeGenerator() {
  const [maxUses, setMaxUses] = useState(5)
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [generatedCode, setGeneratedCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codes, setCodes] = useState<any[]>([])
  const [loadingCodes, setLoadingCodes] = useState(true)

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const fetchCodes = async () => {
    try {
      const response = await fetch('/api/admin/invite-codes')
      const { codes, error } = await response.json()
      if (error) {
        console.error('招待コードの取得に失敗:', error)
      } else {
        setCodes(codes || [])
      }
    } catch (err) {
      console.error('エラー:', err)
    } finally {
      setLoadingCodes(false)
    }
  }

  useEffect(() => {
    fetchCodes()
  }, [])

  const handleGenerate = async () => {
    setError('')
    setLoading(true)

    try {
      const code = generateCode()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresInDays)

      const response = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          max_uses: maxUses,
          expires_at: expiresAt.toISOString(),
        }),
      })

      const { code: newCode, error: insertError } = await response.json()

      if (insertError) {
        setError('招待コードの生成に失敗しました')
      } else {
        setGeneratedCode(code)
        await fetchCodes()
      }
    } catch (err) {
      setError('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP')
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          最大使用回数
        </label>
        <input
          type="number"
          value={maxUses}
          onChange={(e) => setMaxUses(parseInt(e.target.value) || 5)}
          min="1"
          max="100"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          有効期限（日数）
        </label>
        <input
          type="number"
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 7)}
          min="1"
          max="365"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '生成中...' : '招待コードを生成'}
      </button>

      {generatedCode && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-sm text-green-800 mb-2">生成されたコード:</p>
          <p className="text-2xl font-bold text-green-900">{generatedCode}</p>
        </div>
      )}

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <div className="mt-6">
        <h3 className="font-semibold mb-2">最近の招待コード</h3>
        {loadingCodes ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {codes.map((code) => (
              <div
                key={code.id}
                className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm"
              >
                <div>
                  <span className="font-mono font-bold">{code.code}</span>
                  <span className="text-gray-500 ml-2">
                    ({code.used_count}/{code.max_uses})
                  </span>
                </div>
                <div className="text-gray-500">
                  {isExpired(code.expires_at) ? (
                    <span className="text-red-600">期限切れ</span>
                  ) : (
                    formatDate(code.expires_at)
                  )}
                </div>
              </div>
            ))}
            {codes.length === 0 && (
              <p className="text-sm text-gray-500">招待コードがありません</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
