#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const basePath = path.join('C:', 'Users', 'Kane', 'Oueis Gas Inc. Dropbox', 'Kane Oueis', 'vault-staff', 'src');

// Updated home page with admin login option
const homePage = `'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Store, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Location } from '@/types'

export default function Home() {
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('active', true)
        .order('sort_order')

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectLocation = (location: Location, isAdmin: boolean = false) => {
    router.push(\`/pin?location=\${location.id}\${isAdmin ? '&mode=admin' : ''}\`)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#333] bg-[#0a0a0a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F4D03F] to-[#B8960C] flex items-center justify-center">
              <Store className="w-5 h-5 text-black" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white tracking-tight">THE VAULT</h1>
              <p className="text-sm text-[#D4AF37] font-medium">Staff Portal</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        {/* Admin Login Button */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/pin?mode=admin')}
            className="w-full group relative bg-gradient-to-r from-purple-900/30 to-purple-800/30 border border-purple-500/30 rounded-xl p-6 text-left transition-all hover:border-purple-500 hover:from-purple-900/40 hover:to-purple-800/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/30 transition-colors">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-purple-400 transition-colors">
                  Admin Dashboard
                </h3>
                <p className="text-sm text-[#a1a1a1]">Manage all drops, assign to locations, view cancelled claims</p>
              </div>
              <svg className="w-5 h-5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">Select Your Location</h2>
          <p className="text-[#a1a1a1]">Choose your store to view pending pickups</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {locations.map((location) => (
              <button
                key={location.id}
                onClick={() => handleSelectLocation(location)}
                className="group relative bg-[#1a1a1a] border border-[#333] rounded-xl p-6 text-left transition-all hover:border-[#D4AF37] hover:bg-[#1a1a1a]/80 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#D4AF37]/20 transition-colors">
                    <MapPin className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-[#D4AF37] transition-colors">
                      {location.name}
                    </h3>
                    <p className="text-sm text-[#a1a1a1] mb-2">{location.full_name}</p>
                    <p className="text-xs text-[#666]">
                      {location.address}, {location.city}, {location.state} {location.zip}
                    </p>
                  </div>
                </div>

                {/* Hover Arrow */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-5 h-5 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        {!isLoading && locations.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-[#333] mx-auto mb-4" />
            <p className="text-[#a1a1a1]">No active locations found</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#333] py-4">
        <p className="text-center text-xs text-[#666]">
          Oasis Cannabis Co. Staff Portal
        </p>
      </footer>
    </div>
  )
}
`;

// Updated PIN page with admin mode
const pinPage = `'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Lock, Store, X, Shield } from 'lucide-react'
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
  const isAdminMode = searchParams.get('mode') === 'admin'

  useEffect(() => {
    if (isAdminMode && !locationId) {
      // Admin mode without location - fetch any location to get admin pin
      fetchAnyLocation()
    } else if (locationId) {
      fetchLocation()
    } else {
      router.push('/')
    }
  }, [locationId, isAdminMode])

  const fetchAnyLocation = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('active', true)
        .limit(1)
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

      // Auto-submit when 4 digits entered
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
      if (isAdminMode) {
        // For admin mode, check admin_pin from any location (they should all be the same)
        const adminPin = location?.admin_pin || '0000'

        if (pinToVerify === adminPin) {
          sessionStorage.setItem('adminAuthenticated', 'true')
          sessionStorage.setItem('adminMode', 'true')
          router.push('/admin')
        } else {
          setError('Incorrect Admin PIN. Please try again.')
          setPin('')
        }
      } else {
        // Staff mode - check staff_pin
        const staffPin = location?.staff_pin || '1234'

        if (pinToVerify === staffPin) {
          sessionStorage.setItem('staffLocation', JSON.stringify(location))
          sessionStorage.setItem('staffAuthenticated', 'true')
          router.push('/queue')
        } else {
          setError('Incorrect PIN. Please try again.')
          setPin('')
        }
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

  const themeColor = isAdminMode ? 'purple' : '#D4AF37'
  const themeColorClass = isAdminMode ? 'text-purple-400' : 'text-[#D4AF37]'
  const themeBgClass = isAdminMode ? 'bg-purple-500/10' : 'bg-[#D4AF37]/10'
  const themeBorderClass = isAdminMode ? 'border-purple-500' : 'border-[#D4AF37]'

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
              <div className={\`w-8 h-8 rounded-full flex items-center justify-center \${isAdminMode ? 'bg-gradient-to-br from-purple-500 to-purple-700' : 'bg-gradient-to-br from-[#F4D03F] to-[#B8960C]'}\`}>
                {isAdminMode ? (
                  <Shield className="w-4 h-4 text-white" />
                ) : (
                  <Store className="w-4 h-4 text-black" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {isAdminMode ? 'Admin Dashboard' : location?.name}
                </p>
                <p className="text-xs text-[#a1a1a1]">
                  {isAdminMode ? 'All Locations' : location?.full_name}
                </p>
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
            <div className={\`w-16 h-16 rounded-full flex items-center justify-center \${themeBgClass}\`}>
              {isAdminMode ? (
                <Shield className={\`w-8 h-8 \${themeColorClass}\`} />
              ) : (
                <Lock className={\`w-8 h-8 \${themeColorClass}\`} />
              )}
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-white mb-2">
              {isAdminMode ? 'Enter Admin PIN' : 'Enter Staff PIN'}
            </h1>
            <p className="text-sm text-[#a1a1a1]">
              {isAdminMode
                ? 'Enter the 4-digit admin PIN'
                : \`Enter the 4-digit PIN for \${location?.name}\`
              }
            </p>
          </div>

          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={\`w-12 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all \${
                  pin.length > index
                    ? \`\${themeBorderClass} \${themeBgClass} \${themeColorClass}\`
                    : 'border-[#333] bg-[#1a1a1a] text-[#333]'
                }\`}
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
              <div className={\`flex items-center gap-2 \${themeColorClass}\`}>
                <div className={\`w-4 h-4 border-2 \${themeBorderClass} border-t-transparent rounded-full animate-spin\`} />
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
                className={\`h-16 rounded-xl bg-[#1a1a1a] border border-[#333] text-xl font-semibold text-white hover:bg-[#262626] hover:\${themeBorderClass} active:scale-95 transition-all disabled:opacity-50\`}
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
              className={\`h-16 rounded-xl bg-[#1a1a1a] border border-[#333] text-xl font-semibold text-white hover:bg-[#262626] hover:\${themeBorderClass} active:scale-95 transition-all disabled:opacity-50\`}
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
`;

// Write home page
fs.writeFileSync(path.join(basePath, 'app', 'page.tsx'), homePage, 'utf8');
console.log('Updated home page!');

// Write PIN page
fs.writeFileSync(path.join(basePath, 'app', 'pin', 'page.tsx'), pinPage, 'utf8');
console.log('Updated PIN page!');

// Create admin directory if it doesn't exist
const adminDir = path.join(basePath, 'app', 'admin');
if (!fs.existsSync(adminDir)) {
  fs.mkdirSync(adminDir, { recursive: true });
  console.log('Created admin directory!');
}

console.log('\\nDone! Home and PIN pages updated.');
