import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invite_code_id, user_id } = body

    if (!invite_code_id || !user_id) {
      return NextResponse.json(
        { error: '招待コードIDとユーザーIDが必要です' },
        { status: 400 }
      )
    }

    // 使用履歴を記録
    const { error: insertError } = await supabaseAdmin
      .from('invite_code_uses')
      .insert({
        invite_code_id,
        user_id,
      })

    if (insertError) {
      return NextResponse.json(
        { error: '使用履歴の記録に失敗しました' },
        { status: 500 }
      )
    }

    // 使用回数を更新
    const { error: rpcError } = await supabaseAdmin.rpc('increment_invite_code_use', {
      code_id: invite_code_id,
    })

    if (rpcError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('使用回数の更新に失敗:', rpcError)
      }
      return NextResponse.json(
        { error: '使用回数の更新に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'エラーが発生しました' },
      { status: 500 }
    )
  }
}
