'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Lock, Store, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Location } from '@/types'

function PinEntryContent() {
  const [location, setLocation] = useState<Location | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const locationId = searchParams.get('location')

  useEffect(() => {
    if (locationId) {
      fetchLocation()
    } else {
      router.push('/')
    }
  }, [locationId])

  const fetchLocation = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .single()

      if (error) throw error
      setLocation(data)
    } catch (error) {
      console.error('Error fetching location:', error)
      router.push('/')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit
      setPin(newPin)
      setError('')

      // Auto-submit when 4 digits entered (can adjust to 6)
      if (newPin.length === 4) {
        verifyPin(newPin)
      }
    }
  }

  const handleBackspace = () => {
    setPin(pin.slice(0, -1))
    setError('')
  }

  const handleClear = () => {
    setPin('')
    setError('')
  }

  const verifyPin = async (pinToVerify: string) => {
    setIsVerifying(true)
    setError('')

    try {
      // Use the staff_pin from the location, fallback to default if not set
      const storedPin = location?.staff_pin || '1234'

      if (pinToVerify === storedPin) {
        // Store location in sessionStorage for the queue page
        sessionStorage.setItem('staffLocation', JSON.stringify(location))
        sessionStorage.setItem('staffAuthenticated', 'true')
        router.push('/queue')
      } else {
        setError('Incorrect PIN. Please try again.')
        setPin('')
      }
    } catch (error) {
      setError('Error verifying PIN. Please try again.')
      setPin('')
    } finally {
      setIsVerifying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#333] bg-[#0a0a0a]/95 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 -ml-2 text-[#a1a1a1] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F4D03F] to-[#B8960C] flex items-center justify-center">
                <Store className="w-4 h-4 text-black" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{location?.name}</p>
                <p className="text-xs text-[#a1a1a1]">{location?.full_name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">
          {/* Lock Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-[#D4AF37]" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-white mb-2">Enter Staff PIN</h1>
            <p className="text-sm text-[#a1a1a1]">Enter the 4-digit PIN for {location?.name}</p>
          </div>

          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`w-12 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  pin.length > index
                    ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border-[#333] bg-[#1a1a1a] text-[#333]'
                }`}
              >
                {pin.length > index ? '•' : ''}
              </div>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}

          {/* Verifying State */}
          {isVerifying && (
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2 text-[#D4AF37]">
                <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Verifying...</span>
              </div>
            </div>
          )}

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                onClick={() => handlePinInput(digit.toString())}
                disabled={isVerifying}
                className="h-16 rounded-xl bg-[#1a1a1a] border border-[#333] text-xl font-semibold text-white hover:bg-[#262626] hover:border-[#D4AF37] active:scale-95 transition-all disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={isVerifying || pin.length === 0}
              className="h-16 rounded-xl bg-[#1a1a1a] border border-[#333] text-[#a1a1a1] hover:bg-[#262626] hover:text-white active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={() => handlePinInput('0')}
              disabled={isVerifying}
              className="h-16 rounded-xl bg-[#1a1a1a] border border-[#333] text-xl font-semibold text-white hover:bg-[#262626] hover:border-[#D4AF37] active:scale-95 transition-all disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              disabled={isVerifying || pin.length === 0}
              className="h-16 rounded-xl bg-[#1a1a1a] border border-[#333] text-[#a1a1a1] hover:bg-[#262626] hover:text-white active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2h-8.172a2 2 0 01-1.414-.586L3 12z" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function PinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PinEntryContent />
    </Suspense>
  )
}
