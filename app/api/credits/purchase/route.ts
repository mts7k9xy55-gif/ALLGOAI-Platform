import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { app_id, credits, amount } = body

    if (!app_id || !credits || !amount) {
      return NextResponse.json(
        { error: 'app_id、credits、amountが必要です' },
        { status: 400 }
      )
    }

    // アプリを確認
    const { data: app, error: appError } = await supabaseAdmin
      .from('apps')
      .select('*')
      .eq('id', app_id)
      .single()

    if (appError || !app) {
      return NextResponse.json(
        { error: 'アプリが見つかりません' },
        { status: 404 }
      )
    }

    // ユーザー認証（セッションから取得）
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader) {
      const token = authHeader.split(' ')[1]
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    // Stripe Checkout Sessionを作成
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: `${app.name} の追加クレジット`,
              description: `${credits}回分のプレビュークレジット`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/apps/${app_id}?credits_added=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/apps/${app_id}`,
      metadata: {
        app_id: app.id,
        credits: credits.toString(),
        type: 'credit_purchase',
        user_id: userId || '',
      },
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Credit purchase error:', error)
    }
    return NextResponse.json(
      { error: error.message || '決済処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
