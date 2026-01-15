'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type UploadMethod = 'github' | 'zip' | 'figma'

export default function UploadPage() {
  const [method, setMethod] = useState<UploadMethod>('github')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const [githubData, setGithubData] = useState({
    repoUrl: '',
  })

  const [figmaData, setFigmaData] = useState({
    figmaUrl: '',
  })
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const [appData, setAppData] = useState({
    name: '',
    description: '',
    freeCredits: 100,
    category: 'other',
  })

  const [zipFile, setZipFile] = useState<File | null>(null)

  const handleGithubSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const githubUrl = githubData.repoUrl.trim()
      const githubRegex = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/.*)?$/
      const match = githubUrl.match(githubRegex)

      if (!match) {
        setError('有効なGitHubリポジトリURLを入力してください')
        setLoading(false)
        return
      }

      const [, owner, repo] = match
      const repoFullName = `${owner}/${repo}`

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setError('ログインが必要です')
        setLoading(false)
        return
      }

      // セキュリティレビュー（GitHubリポジトリの場合）
      try {
        const securityResponse = await fetch('/api/security/review', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            github_repo_url: githubUrl,
          }),
        })

        const securityResult = await securityResponse.json()
        
        // HIGH/CRITICALの場合はエラー（400）
        if (!securityResponse.ok) {
          const errorMessage = securityResult.reason || securityResult.error || 'セキュリティリスクが検出されました'
          setError(`セキュリティレビュー: ${errorMessage} (危険度: ${securityResult.dangerLevel})`)
          setLoading(false)
          return
        }
        
        // MEDIUMの場合は警告のみ（続行可能）
        if (securityResult.dangerLevel === 'MEDIUM') {
          // 警告ログ（開発時のみ）
          if (process.env.NODE_ENV === 'development') {
            console.warn('セキュリティ警告:', securityResult.reason)
          }
        }
      } catch (securityErr: any) {
        // ネットワークエラーなどの場合は続行を許可
        if (securityErr.message?.includes('rate limit') || securityErr.message?.includes('レートリミット')) {
          setError('セキュリティレビューのレートリミットに達しました。しばらく待ってから再試行してください。')
          setLoading(false)
          return
        }
        // エラー時は続行（開発時のみログ出力）
        if (process.env.NODE_ENV === 'development') {
          console.warn('セキュリティレビューに失敗しましたが続行します:', securityErr)
        }
      }

      const { data: app, error: appError } = await supabase
        .from('apps')
        .insert({
          user_id: session.user.id,
          name: appData.name || repo,
          description: appData.description,
          github_repo_url: githubUrl,
          github_repo_full_name: repoFullName,
          status: 'draft',
          free_credits: appData.freeCredits,
          category: appData.category,
        })
        .select()
        .single()

      if (appError || !app) {
        setError('アプリの作成に失敗しました')
        setLoading(false)
        return
      }

      router.push(`/creators/apps/${app.id}/publish`)
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
      setLoading(false)
    }
  }

  const handleZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!zipFile) {
        setError('ZIPファイルを選択してください')
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setError('ログインが必要です')
        setLoading(false)
        return
      }

      const fileExt = zipFile.name.split('.').pop()
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('app-uploads')
        .upload(fileName, zipFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        setError('ファイルのアップロードに失敗しました')
        setLoading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('app-uploads')
        .getPublicUrl(fileName)

      const { data: app, error: appError } = await supabase
        .from('apps')
        .insert({
          user_id: session.user.id,
          name: appData.name || zipFile.name.replace('.zip', ''),
          description: appData.description,
          zip_file_url: publicUrl,
          status: 'draft',
          free_credits: appData.freeCredits,
          category: appData.category,
        })
        .select()
        .single()

      if (appError || !app) {
        setError('アプリの作成に失敗しました')
        setLoading(false)
        return
      }

      router.push(`/creators/apps/${app.id}/publish`)
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!figmaData.figmaUrl) return

    setPreviewLoading(true)
    setPreviewError('')
    setPreviewCode(null)

    try {
      const response = await fetch('/api/figma/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          figma_url: figmaData.figmaUrl,
          app_name: appData.name || 'FigmaApp',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'コード生成に失敗しました')
      }

      if (result.error && !result.code) {
        throw new Error(result.error)
      }

      if (result.code) {
        setPreviewCode(result.code)
        if (result.error) {
          // 警告メッセージ（コードは生成されたが、完全ではない場合）
          setPreviewError(result.error)
        }
      } else {
        throw new Error('コードが生成されませんでした')
      }
    } catch (err: any) {
      setPreviewError(err.message || 'プレビューの生成に失敗しました')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleFigmaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const figmaUrl = figmaData.figmaUrl.trim()
      const figmaRegex = /^https?:\/\/www\.figma\.com\/(file|proto)\/([a-zA-Z0-9]+)/
      const match = figmaUrl.match(figmaRegex)

      if (!match) {
        setError('有効なFigma URLを入力してください')
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setError('ログインが必要です')
        setLoading(false)
        return
      }

      // Figmaからコード生成（Builder.io API経由）
      const response = await fetch('/api/figma/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          figma_url: figmaUrl,
          app_name: appData.name,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMessage = result.error || 'Figmaからのコード生成に失敗しました'
        setError(`${errorMessage}。GitHubリポジトリまたはZIPファイルをご利用ください。`)
        setLoading(false)
        return
      }

      const { code, error: convertError } = result

      if (convertError && !code) {
        setError(`Figmaからのコード生成に失敗しました: ${convertError}`)
        setLoading(false)
        return
      }

      if (!code) {
        setError('コードが生成されませんでした。GitHubリポジトリまたはZIPファイルをご利用ください。')
        setLoading(false)
        return
      }

      // 生成されたコードをReactアプリとしてZIP化
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      // package.jsonを作成
      const packageJson = {
        name: appData.name.toLowerCase().replace(/\s+/g, '-') || 'figma-app',
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          react: '^18.3.1',
          'react-dom': '^18.3.1',
          next: '14.2.5',
        },
      }

      // 基本的なNext.js構造を作成
      zip.file('package.json', JSON.stringify(packageJson, null, 2))
      zip.file('next.config.js', 'module.exports = { reactStrictMode: true }')
      
      // コンポーネントファイルを作成
      const componentName = appData.name || 'FigmaApp'
      zip.file(`app/page.tsx`, code)
      
      // 基本的なレイアウトファイル
      zip.file('app/layout.tsx', `import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}`)
      
      zip.file('app/globals.css', `* { margin: 0; padding: 0; box-sizing: border-box; }`)

      // ZIPファイルを生成
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const fileExt = 'zip'
      const fileName = `${session.user.id}/figma-${Date.now()}.${fileExt}`
      
      // Supabase Storageにアップロード
      const { error: uploadError } = await supabase.storage
        .from('app-uploads')
        .upload(fileName, zipBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/zip',
        })

      if (uploadError) {
        setError(`ファイルのアップロードに失敗しました: ${uploadError.message}`)
        setLoading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('app-uploads')
        .getPublicUrl(fileName)

      const { data: app, error: appError } = await supabase
        .from('apps')
        .insert({
          user_id: session.user.id,
          name: appData.name || 'Figma App',
          description: appData.description || 'Figmaデザインから生成されたアプリ',
          zip_file_url: publicUrl,
          status: 'draft',
          free_credits: appData.freeCredits,
          category: appData.category,
        })
        .select()
        .single()

      if (appError || !app) {
        setError('アプリの作成に失敗しました')
        setLoading(false)
        return
      }

      router.push(`/creators/apps/${app.id}/publish`)
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">アプリをアップロード</h1>

        {/* アップロード方法選択 */}
        <div className="mb-8">
          <div className="flex gap-4 flex-wrap">
            <button
              onClick={() => setMethod('github')}
              className={`px-6 py-3 rounded-lg font-medium ${
                method === 'github'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              GitHubリポジトリ
            </button>
            <button
              onClick={() => setMethod('zip')}
              className={`px-6 py-3 rounded-lg font-medium ${
                method === 'zip'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              ZIPファイル
            </button>
            <button
              onClick={() => setMethod('figma')}
              className={`px-6 py-3 rounded-lg font-medium ${
                method === 'figma'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Figmaデザイン
            </button>
          </div>
        </div>

        {/* 基本情報フォーム */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">基本情報</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                アプリ名 *
              </label>
              <input
                type="text"
                value={appData.name}
                onChange={(e) => setAppData({ ...appData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                placeholder="例: マイアプリ"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                説明
              </label>
              <textarea
                value={appData.description}
                onChange={(e) => setAppData({ ...appData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                rows={4}
                placeholder="アプリの説明を入力..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  無料クレジット数
                </label>
                <input
                  type="number"
                  value={appData.freeCredits}
                  onChange={(e) => setAppData({ ...appData, freeCredits: parseInt(e.target.value) || 100 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  min="0"
                  max="1000"
                />
                <p className="text-xs text-gray-500 mt-1">ユーザーが無料で使える回数（デフォルト: 100）</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  カテゴリ
                </label>
                <select
                  value={appData.category}
                  onChange={(e) => setAppData({ ...appData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                >
                  <option value="other">その他</option>
                  <option value="ai-tool">AIツール</option>
                  <option value="trending">トレンド</option>
                  <option value="latest">最新</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* GitHubアップロード */}
        {method === 'github' && (
          <form onSubmit={handleGithubSubmit} className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">GitHubリポジトリ</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GitHubリポジトリURL *
                </label>
                <input
                  type="url"
                  value={githubData.repoUrl}
                  onChange={(e) => setGithubData({ ...githubData, repoUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  placeholder="https://github.com/username/repo"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  公開したいGitHubリポジトリのURLを入力してください
                </p>
              </div>
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '処理中...' : '次へ進む'}
              </button>
            </div>
          </form>
        )}

        {/* ZIPアップロード */}
        {method === 'zip' && (
          <form onSubmit={handleZipSubmit} className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">ZIPファイル</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ZIPファイル *
                </label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  アプリのソースコードをZIP形式でアップロードしてください
                </p>
              </div>
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading || !zipFile}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'アップロード中...' : '次へ進む'}
              </button>
            </div>
          </form>
        )}

        {/* Figmaアップロード */}
        {method === 'figma' && (
          <form onSubmit={handleFigmaSubmit} className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Figmaデザイン</h2>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Figma連携はベータ版です。Builder.io APIを使用してデザインをコードに変換します。
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Figma URL *
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={figmaData.figmaUrl}
                    onChange={(e) => setFigmaData({ ...figmaData, figmaUrl: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md"
                    placeholder="https://www.figma.com/file/..."
                    required
                  />
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={!figmaData.figmaUrl || previewLoading}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {previewLoading ? '生成中...' : 'プレビュー'}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  FigmaデザインファイルのURLを入力し、「プレビュー」ボタンでコード生成を確認できます
                </p>
              </div>
              {previewError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{previewError}</p>
                </div>
              )}
              {previewCode && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <p className="text-sm text-green-800 font-semibold mb-2">
                    ✅ コード生成に成功しました
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-green-700 hover:text-green-800">
                      生成されたコードを確認
                    </summary>
                    <pre className="mt-2 p-3 bg-white rounded border border-green-200 overflow-auto max-h-64 text-xs">
                      <code>{previewCode}</code>
                    </pre>
                  </details>
                </div>
              )}
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'コード生成中...' : '次へ進む'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
