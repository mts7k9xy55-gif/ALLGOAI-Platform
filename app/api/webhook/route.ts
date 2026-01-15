import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Webhook署名検証失敗:', err.message)
    }
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  // 決済成功時の処理
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // 公開リクエストを確認
    const { data: publishRequest } = await supabaseAdmin
      .from('publish_requests')
      .select('*, apps(*)')
      .eq('stripe_session_id', session.id)
      .single()

    if (publishRequest) {
      // 公開リクエストを更新
      await supabaseAdmin
        .from('publish_requests')
        .update({
          status: 'paid',
          stripe_payment_intent_id: session.payment_intent as string,
          deploy_status: 'deploying',
        })
        .eq('id', publishRequest.id)

      // GitHubリポジトリがある場合は自動デプロイ
      const app = publishRequest.apps
      if (app?.github_repo_full_name) {
        try {
          const deployResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/deploy/vercel`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                app_id: app.id,
                github_repo_full_name: app.github_repo_full_name,
              }),
            }
          )

          if (!deployResponse.ok) {
            throw new Error('デプロイに失敗しました')
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'デプロイエラー'
          await supabaseAdmin
            .from('publish_requests')
            .update({
              deploy_status: 'failed',
              error_message: errorMessage,
            })
            .eq('id', publishRequest.id)
          
          if (process.env.NODE_ENV === 'development') {
            console.error('デプロイエラー:', error)
          }
        }
      }
    }

    // クレジット購入を確認
    if (session.metadata?.type === 'credit_purchase' && session.metadata?.user_id) {
      const userId = session.metadata.user_id
      const credits = parseInt(session.metadata.credits || '10')

      // ユーザーのクレジットを追加
      await supabaseAdmin.rpc('add_app_credits', {
        user_id_param: userId,
        credits_to_add: credits,
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`クレジット追加: ユーザー ${userId} に ${credits}回追加`)
      }
    }
  }

  // 決済失敗時の処理
  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session

    await supabaseAdmin
      .from('publish_requests')
      .update({ status: 'failed' })
      .eq('stripe_session_id', session.id)
  }

  return NextResponse.json({ received: true })
}
