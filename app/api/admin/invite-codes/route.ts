import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json(
        { error: '招待コードの取得に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ codes: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: 'エラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, max_uses, expires_at } = body

    const { data, error } = await supabaseAdmin
      .from('invite_codes')
      .insert({
        code,
        max_uses,
        expires_at,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: '招待コードの生成に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ code: data })
  } catch (error) {
    return NextResponse.json(
      { error: 'エラーが発生しました' },
      { status: 500 }
    )
  }
}
