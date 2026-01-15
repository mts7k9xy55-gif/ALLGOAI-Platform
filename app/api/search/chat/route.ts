import { NextRequest, NextResponse } from 'next/server'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, turn = 0, shouldEnd = false } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'メッセージが必要です' },
        { status: 400 }
      )
    }

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'Groq APIキーが設定されていません' },
        { status: 500 }
      )
    }

    const userMessages = messages.filter((m: ChatMessage) => m.role === 'user')
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || ''
    const isFirstTurn = turn === 1
    const isMaxTurns = turn >= 2 // 最大2往復に短縮

    // システムプロンプト（現場のおっちゃん向け、ストレスゼロ）
    const systemPrompt = `あなたは親しみやすい業務自動化の専門家です。現場で働く人と自然で気楽な会話をしながら、最適なアプリケーションを提案します。

【絶対に守るルール】
1. 1ターン目（turn=1）: ユーザーの回答に共感を示し、すぐに推測して提案準備に入る
   - 例: 「ラーメン屋の予約が大変」→「予約大変そうですね、標準的なラーメン屋向けアプリ3つ提案しますよ」
   - 例: 「AIチャット作りたい」→「AIチャットか、いいね！すぐに提案しますね」
   - 質問は最小限。必要なら1つだけ超簡潔に（「時間帯は？」「何人分？」など）

2. 2ターン目以降: 質問は1ターンに1個だけ、超簡潔（「時間帯は？」だけ）
   - ぼんやりした回答でも、AIが推測して提案に進む
   - 無理に詳しく聞かない

3. 最大2往復まで。情報が揃ったら即座に「わかりました！アプリを提案しますね」と伝える
4. ユーザーが「もういいよ」などと言ったら、即座に「了解です！アプリを提案しますね」と返す
5. ストレスゼロ、親しみやすく、現場のおっちゃんが話しやすい口調で
6. 応答は親しみやすく、日本語で簡潔に（20-40文字程度）

【会話の流れ】
- 1ターン目: 共感 + 推測して提案準備（質問は最小限、必要なら1つだけ超簡潔）
- 2ターン目: 必要なら超簡潔な質問1つ、または即提案準備完了

【重要】ぼんやりした回答でも、AIが推測して積極的に提案する。無理に詳しく聞かない。

現在のターン: ${turn}
最大ターン数: 2（短縮）
終了リクエスト: ${shouldEnd ? 'はい（即座に提案準備完了を伝える）' : 'いいえ'}`

    // 会話コンテキストを構築
    const conversationContext = messages.map((m: ChatMessage) => ({
      role: m.role,
      content: m.content,
    }))

    // Groq APIでチャット
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationContext,
        ],
        temperature: 0.9, // より自然で親しみやすい会話のため上げる
        max_tokens: 100, // 超簡潔に
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Groq API error: ${response.status} ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    let assistantMessage = data.choices?.[0]?.message?.content || 'すみません、応答を生成できませんでした。'

    // 1ターン目: 共感 + 推測して提案準備
    if (isFirstTurn) {
      // ユーザーの回答からキーワードを抽出
      const keywords = lastUserMessage
        .replace(/[、。、\s]/g, ' ')
        .split(' ')
        .filter(w => w.length > 0 && w.length < 15)
      
      // キーワードに基づいて推測メッセージを生成
      if (lastUserMessage.includes('予約') || lastUserMessage.includes('ラーメン')) {
        if (!assistantMessage.includes('予約') && !assistantMessage.includes('提案')) {
          assistantMessage = '予約大変そうですね、標準的なラーメン屋向けアプリ3つ提案しますよ。'
        }
      } else if (lastUserMessage.includes('AI') || lastUserMessage.includes('チャット')) {
        if (!assistantMessage.includes('AI') && !assistantMessage.includes('提案')) {
          assistantMessage = 'AIチャットか、いいね！すぐに提案しますね。'
        }
      } else {
        // 一般的な共感メッセージ
        const keyword = keywords[0] || lastUserMessage.substring(0, 10)
        if (!assistantMessage.includes('提案') && !assistantMessage.includes('？')) {
          assistantMessage = `${keyword}か、いいね！すぐにアプリを提案しますよ。`
        }
      }
    }
    
    // 終了リクエストの場合は提案準備完了を伝える
    if (shouldEnd && !assistantMessage.includes('提案')) {
      assistantMessage = '了解です！アプリを提案しますね。'
    }
    
    // 最大ターン数に達した場合は提案準備完了を伝える
    if (isMaxTurns && !assistantMessage.includes('提案')) {
      assistantMessage = 'わかりました！アプリを提案しますね。'
    }

    // アプリ提案が必要かどうかを判定
    // 1ターン目から積極的に提案（AIが推測する）
    // 応答に「提案」が含まれている場合も提案フラグを立てる
    const suggestApps = shouldEnd || 
                        isMaxTurns || 
                        turn >= 1 || // 1ターン目から提案可能
                        assistantMessage.includes('提案') ||
                        assistantMessage.includes('アプリ')

    // 検索クエリを抽出（全ユーザーメッセージを結合）
    const searchQuery = userMessages.map((m: ChatMessage) => m.content).join(' ')

    return NextResponse.json({
      message: assistantMessage,
      suggestApps,
      searchQuery,
    })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('チャットAPIエラー:', error)
    }
    return NextResponse.json(
      { error: error.message || 'チャット処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
