import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { app_id, github_repo_full_name } = body

    if (!app_id || !github_repo_full_name) {
      return NextResponse.json(
        { error: 'app_idとgithub_repo_full_nameが必要です' },
        { status: 400 }
      )
    }

    // Vercel APIでデプロイ
    const vercelToken = process.env.VERCEL_TOKEN
    if (!vercelToken) {
      return NextResponse.json(
        { error: 'Vercelトークンが設定されていません' },
        { status: 500 }
      )
    }

    // Vercelプロジェクトを作成または取得
    const projectResponse = await fetch('https://api.vercel.com/v9/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `app-${app_id}`,
        gitRepository: {
          type: 'github',
          repo: github_repo_full_name,
        },
      }),
    })

    if (!projectResponse.ok) {
      const errorData = await projectResponse.json()
      // プロジェクトが既に存在する場合は続行
      if (errorData.error?.code !== 'project_already_exists') {
        return NextResponse.json(
          { error: 'Vercelプロジェクトの作成に失敗しました' },
          { status: 500 }
        )
      }
    }

    // デプロイを実行
    const deployResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `app-${app_id}`,
        gitSource: {
          type: 'github',
          repo: github_repo_full_name,
          ref: 'main',
        },
      }),
    })

    if (!deployResponse.ok) {
      const errorData = await deployResponse.json()
      return NextResponse.json(
        { error: errorData.error?.message || 'デプロイに失敗しました' },
        { status: 500 }
      )
    }

    const deployData = await deployResponse.json()

    // アプリのデプロイ情報を更新
    await supabaseAdmin
      .from('apps')
      .update({
        deployed_url: `https://${deployData.url}`,
        vercel_deployment_id: deployData.id,
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', app_id)

    // 公開リクエストを更新
    await supabaseAdmin
      .from('publish_requests')
      .update({
        deploy_status: 'deployed',
        vercel_deployment_url: `https://${deployData.url}`,
      })
      .eq('app_id', app_id)
      .order('created_at', { ascending: false })
      .limit(1)

    return NextResponse.json({
      success: true,
      deployment_url: `https://${deployData.url}`,
      deployment_id: deployData.id,
    })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Deploy error:', error)
    }
    return NextResponse.json(
      { error: error.message || 'デプロイ処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
