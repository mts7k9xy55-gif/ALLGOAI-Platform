import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: '商品の取得に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ products: data || [] })
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
    const { name, description, price, stripe_price_id, image_url } = body

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        name,
        description: description || null,
        price,
        stripe_price_id: stripe_price_id || null,
        image_url: image_url || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: '商品の追加に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ product: data })
  } catch (error) {
    return NextResponse.json(
      { error: 'エラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, is_active } = body

    const { error } = await supabaseAdmin
      .from('products')
      .update({ is_active })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: '商品の更新に失敗しました' },
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
