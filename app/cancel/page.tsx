'use client'

import Link from 'next/link'

export default function CancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">決済がキャンセルされました</h1>
        <p className="text-gray-600 mb-6">
          決済処理がキャンセルされました。再度お試しください。
        </p>
        <Link
          href="/"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  )
}
