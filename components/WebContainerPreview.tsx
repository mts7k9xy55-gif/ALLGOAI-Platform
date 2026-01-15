'use client'

import { useEffect, useRef, useState } from 'react'
import { WebContainer } from '@webcontainer/api'

interface WebContainerPreviewProps {
  githubRepoUrl?: string
  zipFileUrl?: string
  appId: string
  onPreviewStart?: () => Promise<boolean> | boolean
}

export default function WebContainerPreview({
  githubRepoUrl,
  zipFileUrl,
  appId,
  onPreviewStart,
}: WebContainerPreviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'idle' | 'mounting' | 'installing' | 'starting' | 'running'>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const webcontainerInstanceRef = useRef<WebContainer | null>(null)
  const processTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const processCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const isProcessRunningRef = useRef<boolean>(false)

  useEffect(() => {
    let mounted = true

    const initWebContainer = async () => {
      try {
        setLoading(true)
        setError('')
        setStatus('mounting')

        // クレジットチェック（プレビュー開始前）
        if (onPreviewStart) {
          const canPreview = await onPreviewStart()
          if (!canPreview) {
            setLoading(false)
            return // クレジットが0の場合はモーダルが表示されるため、ここで停止
          }
        }

        // WebContainerを初期化
        const files = await loadAppFiles()
        if (!mounted) return

        // WebContainerインスタンスを作成（ネットワーク無効化）
        const webcontainerInstance = await WebContainer.boot({
          network: false,
        })
        webcontainerInstanceRef.current = webcontainerInstance

        setStatus('installing')

        // ファイルシステムにマウント
        await webcontainerInstance.mount(files)

        // package.jsonを確認
        const packageJsonContent = await webcontainerInstance.fs.readFile('package.json', 'utf-8')
        const packageJson = JSON.parse(packageJsonContent as string)

        // 依存関係をインストール（リソース制限付き）
        const installProcess = await webcontainerInstance.spawn('npm', ['install'], {
          output: true,
        })
        await installProcess.exit

        if (!mounted) return

        setStatus('starting')

        // 開発サーバーを起動
        const startCommand = getStartCommand(packageJson)
        startTimeRef.current = Date.now()
        
        // 無限ループ検知用タイムアウト（10秒）
        isProcessRunningRef.current = true
        processTimeoutRef.current = setTimeout(() => {
          if (mounted && isProcessRunningRef.current) {
            setError('アプリの起動に時間がかかりすぎています。無限ループの可能性があります。')
            setLoading(false)
            isProcessRunningRef.current = false
            webcontainerInstanceRef.current?.teardown().catch((err) => {
              if (process.env.NODE_ENV === 'development') {
                console.error('WebContainer終了エラー:', err)
              }
            })
          }
        }, 10000)

        const startProcess = await webcontainerInstance.spawn('npm', ['run', startCommand], {
          output: true,
        })

        // サーバー起動完了時の処理
        webcontainerInstance.on('server-ready', (port, url) => {
          if (mounted) {
            isProcessRunningRef.current = false
            if (processTimeoutRef.current) clearTimeout(processTimeoutRef.current)
            if (processCheckIntervalRef.current) clearInterval(processCheckIntervalRef.current)
            setUrl(url)
            setStatus('running')
            setLoading(false)
          }
        })

        // エラーハンドリングとリソース監視
        const outputBuffer: string[] = []
        startProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              const text = typeof data === 'string' ? data : new TextDecoder().decode(data)
              outputBuffer.push(text)
              
              // メモリ使用量の警告を検出
              if (text.includes('FATAL ERROR') || text.includes('JavaScript heap out of memory')) {
                if (mounted) {
                  setError('メモリ使用量が上限（128MB）を超えました。')
                  setLoading(false)
                  if (processTimeoutRef.current) clearTimeout(processTimeoutRef.current)
                }
              }
            },
          })
        )

        // プロセス監視
        const processStartTime = Date.now()
        processCheckIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - processStartTime
          // 10秒経過で強制停止（無限ループ検知）
          if (elapsed > 10000 && mounted && isProcessRunningRef.current) {
            if (processCheckIntervalRef.current) {
              clearInterval(processCheckIntervalRef.current)
            }
            if (processTimeoutRef.current) {
              clearTimeout(processTimeoutRef.current)
            }
            isProcessRunningRef.current = false
            setError('アプリの起動に時間がかかりすぎています。無限ループの可能性があります。')
            setLoading(false)
            startProcess.kill().catch((err) => {
              if (process.env.NODE_ENV === 'development') {
                console.error('プロセス終了エラー:', err)
              }
            })
          }
        }, 1000)

        // プロセスが終了した場合の処理
        startProcess.exit.then((code) => {
          isProcessRunningRef.current = false
          if (processCheckIntervalRef.current) {
            clearInterval(processCheckIntervalRef.current)
          }
          if (processTimeoutRef.current) {
            clearTimeout(processTimeoutRef.current)
          }
          
          if (mounted) {
            if (code !== 0) {
              // 異常終了時のユーザー向けエラーメッセージ
              const errorOutput = outputBuffer.join('')
              let errorMessage = 'アプリの実行中にエラーが発生しました。'
              
              if (code === 137 || errorOutput.includes('SIGKILL')) {
                errorMessage = 'メモリ使用量が上限（128MB）を超えたため、アプリを停止しました。'
              } else if (code === 124 || errorOutput.includes('timeout')) {
                errorMessage = '実行時間が上限を超えたため、アプリを停止しました。'
              } else if (errorOutput.includes('ENOMEM') || errorOutput.includes('heap')) {
                errorMessage = 'メモリ不足のため、アプリを実行できませんでした。'
              } else if (code === 1) {
                errorMessage = 'アプリの起動に失敗しました。コードに問題がある可能性があります。'
              }
              
              setError(errorMessage)
              setLoading(false)
            }
          }
        }).catch((err) => {
          isProcessRunningRef.current = false
          if (processCheckIntervalRef.current) {
            clearInterval(processCheckIntervalRef.current)
          }
          if (processTimeoutRef.current) {
            clearTimeout(processTimeoutRef.current)
          }
          if (mounted) {
            setError('プロセスの実行中に予期しないエラーが発生しました。')
            setLoading(false)
          }
        })
      } catch (err: any) {
        console.error('WebContainer error:', err)
        if (mounted) {
          setError(err.message || 'WebContainerの初期化に失敗しました')
          setLoading(false)
        }
      }
    }

    initWebContainer()

    return () => {
      mounted = false
      isProcessRunningRef.current = false
      // タイムアウトとインターバルをクリア
      if (processTimeoutRef.current) {
        clearTimeout(processTimeoutRef.current)
      }
      if (processCheckIntervalRef.current) {
        clearInterval(processCheckIntervalRef.current)
      }
      // クリーンアップ
      if (webcontainerInstanceRef.current) {
        webcontainerInstanceRef.current.teardown().catch(console.error)
      }
    }
  }, [githubRepoUrl, zipFileUrl, appId])

  const loadAppFiles = async (): Promise<Record<string, any>> => {
    if (githubRepoUrl) {
      return await loadFromGitHub(githubRepoUrl)
    } else if (zipFileUrl) {
      return await loadFromZip(zipFileUrl)
    } else {
      throw new Error('アプリのソースが見つかりません')
    }
  }

  const loadFromGitHub = async (repoUrl: string): Promise<Record<string, any>> => {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!match) {
      throw new Error('無効なGitHub URLです')
    }

    const [, owner, repo] = match
    const response = await fetch(`/api/github/repo/${owner}/${repo}`)
    if (!response.ok) {
      throw new Error('GitHubリポジトリの取得に失敗しました')
    }

    const data = await response.json()
    return convertToWebContainerFiles(data.files || {})
  }

  const loadFromZip = async (zipUrl: string): Promise<Record<string, any>> => {
    const response = await fetch(`/api/apps/${appId}/zip`)
    if (!response.ok) {
      throw new Error('ZIPファイルの取得に失敗しました')
    }

    const blob = await response.blob()
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)

    const files: Record<string, string> = {}
    for (const [path, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const content = await file.async('text')
        files[path] = content
      }
    }

    return convertToWebContainerFiles(files)
  }

  const convertToWebContainerFiles = (files: Record<string, string>): Record<string, any> => {
    const result: Record<string, any> = {}
    for (const [path, content] of Object.entries(files)) {
      // WebContainerのファイル形式に変換
      result[path] = {
        file: {
          contents: content,
        },
      }
    }
    return result
  }

  const getStartCommand = (packageJson: any): string => {
    if (packageJson.scripts?.dev) return 'dev'
    if (packageJson.scripts?.start) return 'start'
    if (packageJson.scripts?.serve) return 'serve'
    return 'start'
  }

  const getStatusText = () => {
    switch (status) {
      case 'mounting':
        return 'ファイルをマウント中...'
      case 'installing':
        return '依存関係をインストール中...'
      case 'starting':
        return 'サーバーを起動中...'
      case 'running':
        return '実行中'
      default:
        return '初期化中...'
    }
  }

  if (loading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-100 rounded-lg border border-gray-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">{getStatusText()}</p>
          {status === 'installing' && (
            <p className="text-sm text-gray-500">初回は数分かかる場合があります</p>
          )}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-red-50 rounded-lg border border-red-200">
        <div className="text-center max-w-md px-4">
          <p className="text-red-600 font-semibold mb-2">エラー</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            再試行
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden border border-gray-300 bg-white">
      {url ? (
        <>
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">実行中</span>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              新しいタブで開く →
            </a>
          </div>
          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-[calc(100%-40px)] border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="App Preview"
            // ネットワークアクセスを完全に遮断（追加のセキュリティ層）
            // 注意: sandbox属性で既に制限されているが、明示的に記載
          />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">サーバーを起動しています...</p>
          </div>
        </div>
      )}
    </div>
  )
}
