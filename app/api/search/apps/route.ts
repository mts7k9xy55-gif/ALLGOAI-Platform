import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, limit = 3, requirePayment = false } = body

    if (!query) {
      return NextResponse.json(
        { error: '検索クエリが必要です' },
        { status: 400 }
      )
    }

    // 支払いが必要な場合
    if (requirePayment) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'jpy',
              product_data: {
                name: '追加アプリ検索',
                description: 'AI検索で追加のアプリ提案',
              },
              unit_amount: 100,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/search?payment_success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/search`,
        metadata: {
          type: 'search_payment',
          query: query.substring(0, 100),
        },
      })

      return NextResponse.json(
        { error: '決済が必要です', sessionId: session.id },
        { status: 402 }
      )
    }

    // Groq APIでアプリ検索クエリを生成
    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      // APIキーがない場合は簡易検索
      const { data: apps } = await supabaseAdmin
        .from('apps')
        .select('*')
        .eq('status', 'published')
        .limit(limit)

      return NextResponse.json({
        apps: (apps || []).map((app) => ({
          ...app,
          match_score: 0.5,
        })),
      })
    }

    // LLMで検索クエリを最適化
    const searchPrompt = `以下の業務要件に基づいて、データベースからアプリを検索するためのキーワードを3-5個生成してください。

業務要件: ${query}

キーワードは配列形式で返してください。例: ["データ入力", "自動化", "Excel"]`

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'user',
            content: searchPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })

    let keywords: string[] = []
    if (groqResponse.ok) {
      const groqData = await groqResponse.json()
      const content = groqData.choices?.[0]?.message?.content
      try {
        const parsed = JSON.parse(content)
        keywords = parsed.keywords || parsed.words || []
      } catch {
        // JSONパース失敗時はクエリをそのまま使用
        keywords = [query]
      }
    } else {
      keywords = [query]
    }

    // データベースからアプリを検索
    const searchTerms = keywords.length > 0 ? keywords : [query]
    
    // Supabaseの検索条件を構築
    const searchConditions = searchTerms
      .map((term) => `name.ilike.%${term}%,description.ilike.%${term}%`)
      .join(',')

    const { data: apps, error } = await supabaseAdmin
      .from('apps')
      .select('*')
      .eq('status', 'published')
      .or(searchConditions)
      .limit(limit)

    if (error) {
      throw error
    }

    // マッチスコアを計算（簡易版）
    const appsWithScore = (apps || []).map((app) => {
      const nameMatch = searchTerms.some((term) =>
        app.name?.toLowerCase().includes(term.toLowerCase())
      )
      const descMatch = searchTerms.some((term) =>
        app.description?.toLowerCase().includes(term.toLowerCase())
      )
      const matchScore = nameMatch ? 0.8 : descMatch ? 0.6 : 0.4

      return {
        ...app,
        match_score: matchScore,
      }
    })

    // スコア順にソート
    appsWithScore.sort((a, b) => b.match_score - a.match_score)

    return NextResponse.json({
      apps: appsWithScore,
    })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('アプリ検索APIエラー:', error)
    }
    return NextResponse.json(
      { error: error.message || 'アプリ検索中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
