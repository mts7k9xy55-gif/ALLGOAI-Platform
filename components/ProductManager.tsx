'use client'

import { useState, useEffect } from 'react'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stripe_price_id: string | null
  image_url: string | null
  is_active: boolean
}

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stripe_price_id: '',
    image_url: '',
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/admin/products')
      const { products: fetchedProducts, error } = await response.json()
      if (error) {
        console.error('商品の取得に失敗:', error)
      } else {
        setProducts(fetchedProducts || [])
      }
    } catch (err) {
      console.error('エラー:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const price = Math.round(parseFloat(formData.price) * 100) // 円を最小単位に変換

    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          price,
          stripe_price_id: formData.stripe_price_id || null,
          image_url: formData.image_url || null,
        }),
      })

      const { error } = await response.json()

      if (error) {
        alert('商品の追加に失敗しました')
      } else {
        setFormData({
          name: '',
          description: '',
          price: '',
          stripe_price_id: '',
          image_url: '',
        })
        setShowForm(false)
        await fetchProducts()
      }
    } catch (err) {
      alert('エラーが発生しました')
    }
  }

  const toggleProductStatus = async (productId: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: productId,
          is_active: !currentStatus,
        }),
      })

      await response.json()
      await fetchProducts()
    } catch (err) {
      console.error('エラー:', err)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">読み込み中...</p>
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
      >
        {showForm ? 'フォームを閉じる' : '新規商品を追加'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 p-4 bg-gray-50 rounded-md">
          <input
            type="text"
            placeholder="商品名"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <textarea
            placeholder="説明"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <input
            type="number"
            step="0.01"
            placeholder="価格（円）"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <input
            type="text"
            placeholder="Stripe Price ID（オプション）"
            value={formData.stripe_price_id}
            onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <input
            type="url"
            placeholder="画像URL（オプション）"
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            追加
          </button>
        </form>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm"
          >
            <div>
              <span className="font-semibold">{product.name}</span>
              <span className="text-gray-500 ml-2">
                ¥{(product.price / 100).toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => toggleProductStatus(product.id, product.is_active)}
              className={`px-2 py-1 rounded text-xs ${
                product.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {product.is_active ? '有効' : '無効'}
            </button>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-gray-500">商品がありません</p>
        )}
      </div>
    </div>
  )
}
