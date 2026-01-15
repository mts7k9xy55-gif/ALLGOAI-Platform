import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, user_id } = body

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'カートが空です' },
        { status: 400 }
      )
    }

    // 商品情報を取得
    const productIds = items.map((item: any) => item.product_id)
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('*')
      .in('id', productIds)

    if (!products || products.length !== items.length) {
      return NextResponse.json(
        { error: '無効な商品が含まれています' },
        { status: 400 }
      )
    }

    // 注文を作成
    const totalAmount = items.reduce((sum: number, item: any) => {
      const product = products.find((p) => p.id === item.product_id)
      return sum + (product?.price || 0) * item.quantity
    }, 0)

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id,
        status: 'pending',
        total_amount: totalAmount,
      })
      .select()
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: '注文の作成に失敗しました' },
        { status: 500 }
      )
    }

    // 注文明細を作成
    const orderItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.product_id)
      return {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: product?.price || 0,
      }
    })

    await supabaseAdmin.from('order_items').insert(orderItems)

    // Stripe Checkout Sessionを作成
    const lineItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.product_id)
      if (!product?.stripe_price_id) {
        throw new Error(`商品 ${product?.name} にStripe価格IDが設定されていません`)
      }
      return {
        price: product.stripe_price_id,
        quantity: item.quantity,
      }
    })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,
      metadata: {
        order_id: order.id,
        user_id: user_id,
      },
    })

    // 注文にStripe Session IDを保存
    await supabaseAdmin
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id)

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
