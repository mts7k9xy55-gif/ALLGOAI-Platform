import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { app_id, user_id, amount } = body

    if (!app_id || !user_id || amount === undefined) {
      return NextResponse.json(
        { error: 'app_id, user_id, amountが必要です' },
        { status: 400 }
      )
    }

    // アプリを確認
    const { data: app, error: appError } = await supabaseAdmin
      .from('apps')
      .select('*')
      .eq('id', app_id)
      .eq('user_id', user_id)
      .single()

    if (appError || !app) {
      return NextResponse.json(
        { error: 'アプリが見つかりません' },
        { status: 404 }
      )
    }

    // テストモード判定（amountが0の場合はテストモード）
    const isTestMode = amount === 0

    // テストモードの場合はトークンを生成
    let testToken: string | null = null
    if (isTestMode) {
      // Node.jsのcryptoモジュールでUUID v4を生成
      const crypto = await import('crypto')
      testToken = crypto.randomUUID()
      
      // アプリにテストトークンを保存
      await supabaseAdmin
        .from('apps')
        .update({
          test_token: testToken,
          test_mode: true,
        })
        .eq('id', app.id)
    }

    // テストモードの場合はトークンを返す（決済不要）
    if (isTestMode && testToken) {
      // 公開リクエストを作成（テストモード）
      await supabaseAdmin
        .from('publish_requests')
        .insert({
          app_id: app.id,
          user_id: user_id,
          status: 'test',
        })

      return NextResponse.json({
        testMode: true,
        testToken,
        testUrl: `${process.env.NEXT_PUBLIC_APP_URL}/test/${app.id}?token=${testToken}`,
      })
    }

    // 通常モード: 公開リクエストを作成
    const { data: publishRequest, error: requestError } = await supabaseAdmin
      .from('publish_requests')
      .insert({
        app_id: app.id,
        user_id: user_id,
        status: 'pending',
      })
      .select()
      .single()

    if (requestError || !publishRequest) {
      return NextResponse.json(
        { error: '公開リクエストの作成に失敗しました' },
        { status: 500 }
      )
    }

    // Stripe Checkout Sessionを作成
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: `${app.name} の公開`,
              description: 'アプリを公開して利用可能にします',
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/creators/apps/${app.id}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/creators/apps/${app.id}/publish`,
      metadata: {
        app_id: app.id,
        user_id: user_id,
        publish_request_id: publishRequest.id,
      },
    })

    // 公開リクエストにStripe Session IDを保存
    await supabaseAdmin
      .from('publish_requests')
      .update({ stripe_session_id: session.id })
      .eq('id', publishRequest.id)

    return NextResponse.json({ sessionId: session.id })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Checkout error:', error)
    }
    return NextResponse.json(
      { error: error.message || '決済処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
