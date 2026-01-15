'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import InviteCodeGenerator from '@/components/InviteCodeGenerator'
import ProductManager from '@/components/ProductManager'

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      // 管理者チェック（簡易版：実際のプロダクションでは適切な権限管理が必要）
      setUser(session.user)
    } else {
      // 管理者ログインページにリダイレクト
      window.location.href = '/admin/login'
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">管理画面</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">招待コード管理</h2>
            <InviteCodeGenerator />
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">商品管理</h2>
            <ProductManager />
          </div>
        </div>
      </div>
    </div>
  )
}
