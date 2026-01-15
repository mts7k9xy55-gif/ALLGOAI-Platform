'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import AppPreview from '@/components/AppPreview'
import Link from 'next/link'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface SuggestedApp {
  id: string
  name: string
  description: string
  github_repo_url?: string
  zip_file_url?: string
  match_score: number
}

export default function SearchPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'どんな業務を自動化したい？（ぼんやりでいいよ）\n例: ラーメン屋の予約が大変、遊びでAIチャット作りたい、好奇心で何か試したい',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestedApps, setSuggestedApps] = useState<SuggestedApp[]>([])
  const [showPreview, setShowPreview] = useState<string | null>(null)
  const [conversationTurn, setConversationTurn] = useState(0) // 会話のターン数（ユーザーメッセージ数）
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const freeSuggestionsCount = 3
  const maxTurns = 2 // 最大2往復（現場のおっちゃん向けに短縮）

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // 決済成功後の処理
    if (typeof window === 'undefined') return
    
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment_success') === 'true') {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
      if (lastUserMessage) {
        handleMoreSearch()
      }
      window.history.replaceState({}, '', '/search')
    }
  }, [messages])

  const handleSend = async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || loading) return

    // 「もういいよ」などの終了キーワードをチェック
    const endKeywords = ['もういいよ', 'もういい', 'いいよ', '終わり', 'おわり', '十分', 'じゅうぶん', 'これで', 'OK', 'ok']
    const shouldEndConversation = endKeywords.some(keyword => 
      trimmedInput.toLowerCase().includes(keyword.toLowerCase())
    )

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    const newTurn = conversationTurn + 1
    setConversationTurn(newTurn)

    try {
      const response = await fetch('/api/search/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          turn: newTurn,
          shouldEnd: shouldEndConversation,
        }),
      })

      if (!response.ok) {
        throw new Error('チャット処理に失敗しました')
      }

      const data = await response.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // アプリ提案が必要な場合（最大2往復 or 終了キーワード or 情報が揃った）
      // 1ターン目でも積極的に提案（AIが推測する）
      const shouldSuggestApps = shouldEndConversation || 
                                 newTurn >= maxTurns || 
                                 newTurn >= 1 || // 1ターン目から提案可能
                                 data.suggestApps

      if (shouldSuggestApps && suggestedApps.length < freeSuggestionsCount) {
        const remainingFree = freeSuggestionsCount - suggestedApps.length
        
        // 検索クエリを構築（全ユーザーメッセージを結合）
        const allUserMessages = [...messages, userMessage]
          .filter((m) => m.role === 'user')
          .map((m) => m.content)
          .join(' ')
        
        const appsResponse = await fetch('/api/search/apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: data.searchQuery || allUserMessages,
            limit: remainingFree,
          }),
        })

        if (appsResponse.ok) {
          const appsData = await appsResponse.json()
          setSuggestedApps((prev) => [...prev, ...appsData.apps])
          
          // アプリ提案メッセージを追加
          if (appsData.apps && appsData.apps.length > 0) {
            const suggestionMessage: Message = {
              id: (Date.now() + 2).toString(),
              role: 'assistant',
              content: `見つかったアプリを${appsData.apps.length}つ提案しました！下に表示されています。`,
              timestamp: new Date(),
            }
            setMessages((prev) => [...prev, suggestionMessage])
          }
        }
      }
    } catch (err) {
      console.error('チャットエラー:', err)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'エラーが発生しました。もう一度お試しください。',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleMoreSearch = async () => {
    if (loading) return

    setLoading(true)
    try {
      // 全ユーザーメッセージを結合して検索クエリを構築
      const allUserMessages = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join(' ')
      
      if (!allUserMessages) return

      const response = await fetch('/api/search/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: allUserMessages,
          limit: 1,
          requirePayment: true,
        }),
      })

      if (!response.ok) {
        if (response.status === 402) {
          // 決済が必要
          const { sessionId } = await response.json()
          const stripe = await import('@stripe/stripe-js').then((m) =>
            m.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
          )
          if (stripe) {
            await stripe.redirectToCheckout({ sessionId })
          }
          return
        }
        throw new Error('アプリ検索に失敗しました')
      }

      const data = await response.json()
      setSuggestedApps((prev) => [...prev, ...data.apps])
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('追加検索エラー:', err)
      }
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '追加検索中にエラーが発生しました。もう一度お試しください。',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col p-4">
        {/* ヘッダー */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-2">AI検索</h1>
          <p className="text-gray-600 text-sm">
            業務の悩みを話すだけで、最適なアプリを提案します
          </p>
        </div>

        {/* チャット履歴 */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md'
                    : 'bg-white text-gray-900 shadow-sm border border-gray-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 提案アプリ */}
        {suggestedApps.length > 0 && (
          <div className="mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold">提案アプリ</h2>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {suggestedApps.length}件
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {suggestedApps.map((app, index) => (
                <div
                  key={app.id}
                  className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-5 border border-gray-100 animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="mb-3">
                    <h3 className="font-bold text-lg mb-2">{app.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{app.description}</p>
                    {app.match_score && (
                      <div className="mt-2 flex items-center gap-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${app.match_score * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {Math.round(app.match_score * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreview(app.id)}
                      className="flex-1"
                    >
                      プレビュー
                    </Button>
                    {app.github_repo_url && (
                      <Link
                        href={`/apps/${app.id}`}
                        className="px-3 py-1.5 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                      >
                        詳細
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 追加検索ボタン */}
            {suggestedApps.length >= freeSuggestionsCount && (
              <div className="mt-6 text-center bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
                <p className="text-sm text-gray-700 mb-3">
                  無料で3つまで提案済み。さらに検索しますか？
                </p>
                <Button
                  onClick={handleMoreSearch}
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg px-8 py-3 text-base font-semibold"
                >
                  {loading ? '検索中...' : '¥100で追加検索'}
                </Button>
                <p className="text-xs text-gray-500 mt-3">
                  追加で1つのアプリを提案します
                </p>
              </div>
            )}
          </div>
        )}

        {/* 入力エリア */}
        <div className="border-t border-gray-200 pt-4 bg-white rounded-t-2xl shadow-lg">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="例: ラーメン屋の予約が大変..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              disabled={loading || conversationTurn >= maxTurns}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim() || conversationTurn >= maxTurns}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 rounded-xl shadow-md transition-all"
            >
              {loading ? '...' : '送信'}
            </Button>
          </div>
          {conversationTurn >= maxTurns && suggestedApps.length === 0 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              最大2往復までです。アプリを提案しますか？
            </p>
          )}
        </div>
      </div>

      {/* プレビューモーダル */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">プレビュー</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(null)}
              >
                閉じる
              </Button>
            </div>
            {suggestedApps.find((app) => app.id === showPreview) && (
              <AppPreview
                githubRepoUrl={
                  suggestedApps.find((app) => app.id === showPreview)?.github_repo_url
                }
                zipFileUrl={
                  suggestedApps.find((app) => app.id === showPreview)?.zip_file_url
                }
                appId={showPreview}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
