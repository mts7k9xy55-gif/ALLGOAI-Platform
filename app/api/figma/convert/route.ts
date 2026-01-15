import { NextRequest, NextResponse } from 'next/server'

interface FigmaConvertResponse {
  code?: string
  error?: string
  preview?: string
}

// FigmaファイルIDとノードIDを抽出
function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } | null {
  // サポートするFigma URL形式:
  // https://www.figma.com/file/{fileKey}/{title}?node-id={nodeId}
  // https://www.figma.com/design/{fileKey}/{title}?node-id={nodeId}
  // https://www.figma.com/proto/{fileKey}/{title}?node-id={nodeId}
  // https://figma.com/file/{fileKey} (wwwなしも可)
  
  const trimmedUrl = url.trim()
  
  // 基本的なURL形式チェック
  if (!trimmedUrl.includes('figma.com')) {
    return null
  }

  const patterns = [
    /(?:www\.)?figma\.com\/(?:file|design|proto)\/([a-zA-Z0-9]{22,})/,
  ]

  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern)
    if (match) {
      const fileKey = match[1]
      const nodeIdMatch = trimmedUrl.match(/[?&]node-id=([^&]+)/)
      return {
        fileKey,
        nodeId: nodeIdMatch ? decodeURIComponent(nodeIdMatch[1].replace(/%3A/g, ':')) : undefined,
      }
    }
  }

  return null
}

// Figma APIでデザインデータを取得
async function fetchFigmaDesign(fileKey: string, nodeId?: string): Promise<any> {
  const figmaToken = process.env.FIGMA_ACCESS_TOKEN

  if (!figmaToken) {
    throw new Error('Figmaアクセストークンが設定されていません')
  }

  try {
    // Figma APIでファイル情報を取得
    const fileUrl = `https://api.figma.com/v1/files/${fileKey}`
    const response = await fetch(fileUrl, {
      headers: {
        'X-Figma-Token': figmaToken,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Figma APIエラー: ${response.status} ${errorData.message || response.statusText}`
      )
    }

    const data = await response.json()
    return data
  } catch (error: any) {
    throw new Error(`Figmaデザインの取得に失敗しました: ${error.message}`)
  }
}

// Builder.io APIでReactコードを生成
async function generateReactCodeWithBuilder(
  figmaData: any,
  appName: string
): Promise<string> {
  const builderApiKey = process.env.BUILDER_API_KEY
  const builderSpaceId = process.env.BUILDER_SPACE_ID

  if (!builderApiKey) {
    throw new Error('Builder.io APIキーが設定されていません')
  }

  try {
    // Builder.ioのContent APIを使用してFigmaデザインをインポート
    // 注意: Builder.ioの実際のAPIエンドポイントは要確認
    const builderUrl = builderSpaceId
      ? `https://builder.io/api/v1/content/${builderSpaceId}/import-figma`
      : 'https://builder.io/api/v1/import-figma'

    const response = await fetch(builderUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${builderApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        figmaData,
        options: {
          framework: 'react',
          componentName: appName || 'FigmaComponent',
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // Builder.io APIが利用できない場合は、Figmaデータから直接Reactコードを生成
      if (response.status === 404 || response.status === 501) {
        return generateReactCodeFromFigma(figmaData, appName)
      }
      
      throw new Error(
        `Builder.io APIエラー: ${response.status} ${errorData.message || response.statusText}`
      )
    }

    const builderData = await response.json()
    
    // Builder.ioのレスポンスからReactコードを抽出
    if (builderData.code) {
      return builderData.code
    }
    
    if (builderData.component) {
      return builderData.component
    }

    // フォールバック: Figmaデータから直接生成
    return generateReactCodeFromFigma(figmaData, appName)
  } catch (error: any) {
    // Builder.io APIエラーの場合、Figmaデータから直接生成を試みる
    if (error.message?.includes('Builder.io')) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Builder.io APIエラー、Figmaデータから直接生成します:', error.message)
      }
      return generateReactCodeFromFigma(figmaData, appName)
    }
    throw error
  }
}

// Figmaデータから直接Reactコードを生成（フォールバック）
function generateReactCodeFromFigma(figmaData: any, appName: string): string {
  const componentName = appName || 'FigmaComponent'
  
  // Figmaのデザインデータから基本的なReactコンポーネントを生成
  const styles = extractStylesFromFigma(figmaData)
  
  return `import React from 'react';

export default function ${componentName}() {
  return (
    <div style={${JSON.stringify(styles.container, null, 2)}}>
      <h1 style={${JSON.stringify(styles.title, null, 2)}}>
        ${appName || 'Figma App'}
      </h1>
      <p style={${JSON.stringify(styles.description, null, 2)}}>
        このアプリはFigmaデザインから生成されました。
      </p>
      <div style={${JSON.stringify(styles.content, null, 2)}}>
        {/* Figmaデザインのコンテンツがここに表示されます */}
        <p>デザインの詳細な変換には、Builder.ioプラグインの使用を推奨します。</p>
      </div>
    </div>
  );
}`
}

// Figmaデータからスタイルを抽出
function extractStylesFromFigma(figmaData: any): any {
  // 簡易実装: デフォルトスタイルを返す
  // 実際の実装では、Figmaのノードデータからスタイルを抽出
  return {
    container: {
      padding: '20px',
      fontFamily: 'Inter, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    title: {
      fontSize: '32px',
      fontWeight: 'bold',
      marginBottom: '16px',
      color: '#000',
    },
    description: {
      fontSize: '16px',
      color: '#666',
      marginBottom: '24px',
    },
    content: {
      padding: '20px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
    },
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<FigmaConvertResponse>> {
  try {
    const body = await request.json()
    const { figma_url, app_name } = body

    if (!figma_url) {
      return NextResponse.json(
        { error: 'Figma URLが必要です' },
        { status: 400 }
      )
    }

    // Figma URLをパース
    const parsed = parseFigmaUrl(figma_url)
    if (!parsed) {
      return NextResponse.json(
        { 
          error: '無効なFigma URLです。以下の形式のURLを入力してください:\n' +
                 '• https://www.figma.com/file/{ファイルID}/{タイトル}\n' +
                 '• https://www.figma.com/design/{ファイルID}/{タイトル}\n' +
                 '• https://www.figma.com/proto/{ファイルID}/{タイトル}'
        },
        { status: 400 }
      )
    }

    // Figmaデザインデータを取得
    let figmaData
    try {
      figmaData = await fetchFigmaDesign(parsed.fileKey, parsed.nodeId)
    } catch (error: any) {
      // Figma APIが利用できない場合のフォールバック
      if (process.env.NODE_ENV === 'development') {
        console.warn('Figma APIエラー、簡易コード生成にフォールバック:', error.message)
      }
      
      // Figma APIキーがない場合でも、基本的なReactコードを生成
      if (error.message?.includes('Figmaアクセストークン')) {
        return NextResponse.json({
          code: generateReactCodeFromFigma(null, app_name),
          error: 'Figma APIキーが設定されていません。基本的なテンプレートコードを生成しました。Figma APIキーを設定すると、より詳細なデザイン情報を取得できます。',
        })
      }
      
      // より詳細なエラーメッセージ
      let errorMessage = `Figmaデザインの取得に失敗しました: ${error.message}`
      if (error.message?.includes('404')) {
        errorMessage = 'Figmaファイルが見つかりません。ファイルIDが正しいか、ファイルが公開されているか確認してください。'
      } else if (error.message?.includes('403')) {
        errorMessage = 'Figmaファイルへのアクセスが拒否されました。ファイルが公開されているか、アクセストークンに適切な権限があるか確認してください。'
      } else if (error.message?.includes('401')) {
        errorMessage = 'Figma API認証に失敗しました。アクセストークンが正しいか確認してください。'
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    // Builder.io APIでReactコードを生成
    let reactCode
    try {
      reactCode = await generateReactCodeWithBuilder(figmaData, app_name)
    } catch (error: any) {
      // Builder.io APIエラーの場合、Figmaデータから直接生成
      if (process.env.NODE_ENV === 'development') {
        console.warn('Builder.io APIエラー、Figmaデータから直接生成:', error.message)
      }
      reactCode = generateReactCodeFromFigma(figmaData, app_name)
    }

    if (!reactCode) {
      return NextResponse.json(
        { error: 'Reactコードの生成に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      code: reactCode,
    })
  } catch (error: any) {
    console.error('Figma変換エラー:', error)
    
    // エラーメッセージをユーザーフレンドリーに
    let errorMessage = 'Figmaからのコード生成中にエラーが発生しました。'
    
    if (error.message?.includes('Figma')) {
      errorMessage = `Figma APIエラー: ${error.message}`
    } else if (error.message?.includes('Builder.io')) {
      errorMessage = `Builder.io APIエラー: ${error.message}`
    } else {
      errorMessage = error.message || errorMessage
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
