import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || undefined,
})

export async function GET(
  request: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  try {
    const { owner, repo } = params

    // リポジトリ情報を取得
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo,
    })

    // デフォルトブランチのファイル一覧を取得
    const { data: treeData } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: repoData.default_branch,
      recursive: '1',
    })

    // ファイル内容を取得（最初の10ファイル程度）
    const files: Record<string, string> = {}
    const fileEntries = treeData.tree
      .filter((item: any) => item.type === 'blob')
      .slice(0, 20) // パフォーマンスのため制限

    for (const entry of fileEntries) {
      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path: entry.path!,
        })

        if ('content' in fileData && fileData.encoding === 'base64') {
          const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
          files[entry.path!] = content
        }
      } catch (err) {
        // ファイル取得エラーは無視
        console.error(`Failed to fetch ${entry.path}:`, err)
      }
    }

    return NextResponse.json({
      files,
      repo: {
        name: repoData.name,
        description: repoData.description,
        default_branch: repoData.default_branch,
      },
    })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('GitHub API error:', error)
    }
    return NextResponse.json(
      { error: error.message || 'GitHubリポジトリの取得に失敗しました' },
      { status: 500 }
    )
  }
}
