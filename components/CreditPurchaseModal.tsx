'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CreditPurchaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  appName: string
}

export default function CreditPurchaseModal({
  open,
  onOpenChange,
  appId,
  appName,
}: CreditPurchaseModalProps) {
  const [loading, setLoading] = useState(false)

  const handlePurchase = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          credits: 10,
          amount: 100,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (data.error || !data.sessionId) {
        throw new Error(data.error || '決済セッションの作成に失敗しました')
      }

      const stripe = await loadStripe(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
      )
      if (!stripe) {
        throw new Error('Stripeの初期化に失敗しました')
      }

      await stripe.redirectToCheckout({ sessionId: data.sessionId })
    } catch (err: any) {
      console.error('クレジット購入エラー:', err)
      alert(err.message || 'エラーが発生しました。もう一度お試しください。')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            もっと試させてくれ！！！
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            <p className="text-base text-gray-700 mb-4">
              「{appName}」の無料クレジットが使い切りました。
            </p>
            <p className="text-sm text-gray-600">
              追加クレジットを購入して、もっとアプリを試せます！
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 text-center border-2 border-blue-200">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              ¥100
            </div>
            <div className="text-lg text-gray-700 mb-1">
              で <span className="font-bold text-blue-600">10回</span> プレビュー可能
            </div>
            <div className="text-sm text-gray-500">
              1回あたり ¥10
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            後で
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={loading}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold"
          >
            {loading ? '処理中...' : '今すぐ追加課金（¥100で10回）'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
