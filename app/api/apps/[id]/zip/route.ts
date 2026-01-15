import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // アプリ情報を取得
    const { data: app, error: appError } = await supabaseAdmin
      .from('apps')
      .select('zip_file_url')
      .eq('id', id)
      .single()

    if (appError || !app?.zip_file_url) {
      return NextResponse.json(
        { error: 'アプリが見つかりません' },
        { status: 404 }
      )
    }

    // Supabase StorageからZIPファイルをダウンロード
    const { data, error: downloadError } = await supabaseAdmin.storage
      .from('app-uploads')
      .download(app.zip_file_url.split('/').pop() || '')

    if (downloadError || !data) {
      return NextResponse.json(
        { error: 'ファイルの取得に失敗しました' },
        { status: 500 }
      )
    }

    // ZIPファイルを返す
    const arrayBuffer = await data.arrayBuffer()
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="app-${id}.zip"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'エラーが発生しました' },
      { status: 500 }
    )
  }
}
