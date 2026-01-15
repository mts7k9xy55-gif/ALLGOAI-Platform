'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function UsagePage() {
  const usageSteps = [
    {
      number: 1,
      title: 'アップロードしてプレビュー（無料、無制限）',
      description: 'GitHubリポジトリ、ZIPファイル、またはFigmaデザインからアプリをアップロードして、すぐにプレビューできます。',
    },
    {
      number: 2,
      title: '公開したい → ¥8,000払う（即公開）',
      description: 'アプリを公開したい場合は、¥8,000の公開料を支払うだけで即座に公開されます。',
    },
    {
      number: 3,
      title: '取り分％と無料クレジットを自分で設定',
      description: 'クリエイターは自分のアプリの取り分率と無料クレジット数を自由に設定できます。',
    },
    {
      number: 4,
      title: 'ユーザー試用は従量課金（設定単価）',
      description: 'ユーザーがアプリを試用する際は、設定した単価に応じて従量課金されます。',
    },
    {
      number: 5,
      title: '困ったらLLMに聞け（対話で学べ）',
      description: '使い方で困ったら、AI検索機能で対話しながら学べます。現場のおっちゃんでも簡単に使えます。',
    },
    {
      number: 6,
      title: 'システムクラッシャーは自動ブロック',
      description: '悪意のあるコードやシステムを破壊する可能性のあるアプリは自動的にブロックされます。',
    },
    {
      number: 7,
      title: 'データは絶対売らない',
      description: 'ユーザーのデータや個人情報は一切売却しません。プライバシーを最優先に保護します。',
    },
    {
      number: 8,
      title: '楽しめ！',
      description: '上品なアプリだけが集まる聖域で、自由にアプリを作り、公開し、楽しんでください。',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            ALLGO AI 使い方
          </h1>
          <p className="text-lg text-gray-600">
            上品なアプリだけが集まる聖域で、自由にアプリを作り、公開し、楽しもう
          </p>
        </div>

        {/* 使い方ステップ */}
        <div className="space-y-6 mb-12">
          {usageSteps.map((step, index) => (
            <div
              key={step.number}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border-l-4 border-blue-600 animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {step.number}
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {step.title}
                  </h2>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* アクションボタン */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-8 py-3 text-lg shadow-lg"
          >
            <Link href="/creators/upload">アプリをアップロード</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="px-8 py-3 text-lg"
          >
            <Link href="/search">AI検索で探す</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="px-8 py-3 text-lg"
          >
            <Link href="/">ホームに戻る</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
