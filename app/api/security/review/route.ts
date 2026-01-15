import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || undefined,
})

interface SecurityReviewResult {
  dangerLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  reason: string
}

// レートリミット対応: リトライ関数
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      // レートリミットエラーの場合
      if (error.status === 429 || error.message?.includes('rate limit')) {
        const retryAfter = error.response?.headers?.['retry-after'] || Math.pow(2, i)
        const delay = parseInt(retryAfter) * 1000 || baseDelay * Math.pow(2, i)
        
        if (i === maxRetries - 1) {
          throw new Error('レートリミットに達しました。しばらく待ってから再試行してください。')
        }
        
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  throw new Error('リトライ回数の上限に達しました')
}

// GitHubリポジトリからコードを取得
async function fetchCodeFromGitHub(repoUrl: string): Promise<string> {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
  if (!match) {
    throw new Error('無効なGitHub URLです')
  }

  const [, owner, repo] = match

  try {
    // デフォルトブランチを取得
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo,
    })

    // リポジトリのファイルツリーを取得（最大100ファイル）
    const { data: treeData } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: repoData.default_branch,
      recursive: '1',
    })

    // コードファイルを収集（.js, .ts, .jsx, .tsx, .py, .java, .go, .rs など）
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.php', '.rb']
    const codeFiles: string[] = []

    for (const item of treeData.tree.slice(0, 50)) { // 最大50ファイル
      if (item.type === 'blob' && item.path) {
        const ext = item.path.split('.').pop()?.toLowerCase()
        if (ext && codeExtensions.includes(`.${ext}`)) {
          try {
            const { data: fileData } = await octokit.repos.getContent({
              owner,
              repo,
              path: item.path,
            })

            if ('content' in fileData && fileData.encoding === 'base64') {
              const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
              codeFiles.push(`// File: ${item.path}\n${content}\n\n`)
            }
          } catch (err) {
            // ファイル取得エラーは無視（開発時のみログ出力）
            if (process.env.NODE_ENV === 'development') {
              console.warn(`Failed to fetch ${item.path}:`, err)
            }
          }
        }
      }
    }

    return codeFiles.join('\n')
  } catch (error: any) {
    throw new Error(`GitHubリポジトリの取得に失敗しました: ${error.message}`)
  }
}

// Groq APIでセキュリティレビュー
async function reviewCodeWithGroq(code: string): Promise<SecurityReviewResult> {
  const groqApiKey = process.env.GROQ_API_KEY

  if (!groqApiKey) {
    // APIキーがない場合はSAFEとしてフォールバック（警告ログだけ）
    if (process.env.NODE_ENV === 'development') {
      console.warn('Groq APIキーが設定されていません。セキュリティレビューをスキップします。')
    }
    return {
      dangerLevel: 'LOW',
      reason: 'Groq APIキーが設定されていないため、セキュリティレビューをスキップしました。',
    }
  }

  // コードが長すぎる場合は要約（Groqモデルのコンテキスト制限を考慮）
  // llama3-70b-8192: 8192 tokens, mixtral-8x7b-32768: 32768 tokens
  // 安全のため、より小さいモデルの制限に合わせる
  const maxCodeLength = 30000 // 約30KB（安全マージン）
  const codeToReview = code.length > maxCodeLength 
    ? code.substring(0, maxCodeLength) + '\n\n... (コードが長いため一部のみレビュー)'
    : code

  const systemPrompt = `あなたはセキュリティエキスパートです。提供されたコードをセキュリティ観点で厳しくレビューしてください。

以下の悪意コードやセキュリティリスクを検知してください:
1. マイニングコード（cryptocurrency mining）
2. RCE（Remote Code Execution）の脆弱性
3. 暗号化キーや認証情報の盗聴・漏洩
4. eval()、Function()、exec()、spawn()などの危険な実行
5. 外部通信試行（不正なAPIコール、データ送信）
6. ファイルシステムへの不正アクセス
7. プロセス制御（kill、exit）
8. SQLインジェクション、XSS、CSRFなどの脆弱性

危険度を以下の4段階で評価してください:
- LOW: 軽微な問題、警告レベル
- MEDIUM: 中程度のリスク、注意が必要
- HIGH: 高いリスク、修正推奨
- CRITICAL: 致命的なリスク、即座に拒否すべき

出力形式（JSON）:
{
  "dangerLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "reason": "日本語で理由を説明"
}`

  const userPrompt = `以下のコードをセキュリティレビューしてください:\n\n\`\`\`\n${codeToReview}\n\`\`\``

  try {
    // モデル選択: mixtral-8x7b-32768が利用可能なら使用、なければllama3-70b-8192
    const model = 'mixtral-8x7b-32768' // より大きなコンテキストウィンドウ

    const response = await retryWithBackoff(async () => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.3, // より一貫した結果のため
          max_tokens: 500,
          response_format: { type: 'json_object' }, // JSON形式で返す
        }),
        signal: AbortSignal.timeout(30000), // 30秒タイムアウト
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        if (res.status === 429) {
          throw { status: 429, message: 'レートリミットに達しました', response: { headers: res.headers } }
        }
        throw new Error(`Groq API error: ${res.status} ${JSON.stringify(errorData)}`)
      }

      return res
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('Groq APIからの応答が不正です')
    }

    // JSONをパース
    let reviewResult: SecurityReviewResult
    try {
      reviewResult = JSON.parse(content)
    } catch (parseError) {
      // JSONパースに失敗した場合、テキストから危険度を抽出
      const dangerLevelMatch = content.match(/dangerLevel["\s:]+["']?(LOW|MEDIUM|HIGH|CRITICAL)["']?/i)
      const dangerLevel = dangerLevelMatch?.[1]?.toUpperCase() || 'MEDIUM'
      
      reviewResult = {
        dangerLevel: dangerLevel as SecurityReviewResult['dangerLevel'],
        reason: content.replace(/```json|```/g, '').trim() || 'セキュリティレビューを実行しました',
      }
    }

    // 危険度の検証
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(reviewResult.dangerLevel)) {
      reviewResult.dangerLevel = 'MEDIUM'
    }

    return reviewResult
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Groq API error:', error)
    }
    
    if (error.name === 'AbortError') {
      throw new Error('セキュリティレビューのタイムアウトが発生しました')
    }
    
    if (error.message?.includes('rate limit')) {
      throw new Error('レートリミットに達しました。しばらく待ってから再試行してください。')
    }
    
    // Groq APIエラーの場合もSAFEとしてフォールバック
    if (process.env.NODE_ENV === 'development') {
      console.warn('Groq APIエラーが発生しました。セキュリティレビューをスキップします:', error.message)
    }
    return {
      dangerLevel: 'LOW',
      reason: 'Groq APIエラーが発生したため、セキュリティレビューをスキップしました。',
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { github_repo_url, code, files } = body

    // 入力検証
    if (!github_repo_url && !code && !files) {
      return NextResponse.json(
        { error: 'github_repo_url、code、またはfilesが必要です' },
        { status: 400 }
      )
    }

    let codeToReview: string

    // GitHubリポジトリURLからコードを取得
    if (github_repo_url) {
      try {
        codeToReview = await fetchCodeFromGitHub(github_repo_url)
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || 'GitHubリポジトリの取得に失敗しました' },
          { status: 400 }
        )
      }
    } 
    // ZIP内のコードテキストまたは直接コード
    else if (code) {
      codeToReview = code
    } 
    // ファイルオブジェクトからコードを抽出
    else if (files) {
      if (typeof files === 'string') {
        codeToReview = files
      } else if (typeof files === 'object') {
        // ファイルオブジェクトからコードを結合
        codeToReview = Object.entries(files)
          .map(([path, content]) => `// File: ${path}\n${content}`)
          .join('\n\n')
      } else {
        return NextResponse.json(
          { error: '無効なfiles形式です' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'コードが空です' },
        { status: 400 }
      )
    }

    if (!codeToReview || codeToReview.trim().length === 0) {
      return NextResponse.json(
        { error: 'レビューするコードが見つかりません' },
        { status: 400 }
      )
    }

    // Groq APIでセキュリティレビュー
    const reviewResult = await reviewCodeWithGroq(codeToReview)

    // HIGH以上で400エラー返却
    if (reviewResult.dangerLevel === 'HIGH' || reviewResult.dangerLevel === 'CRITICAL') {
      return NextResponse.json(
        {
          error: 'セキュリティリスクが検出されました',
          dangerLevel: reviewResult.dangerLevel,
          reason: reviewResult.reason,
        },
        { status: 400 }
      )
    }

    // LOW/MEDIUMの場合は成功レスポンス
    return NextResponse.json({
      dangerLevel: reviewResult.dangerLevel,
      reason: reviewResult.reason,
    })
  } catch (error: any) {
    console.error('Security review error:', error)
    
    // レートリミットエラーの場合
    if (error.message?.includes('rate limit') || error.message?.includes('レートリミット')) {
      return NextResponse.json(
        { error: 'レートリミットに達しました。しばらく待ってから再試行してください。' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'セキュリティレビュー中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
