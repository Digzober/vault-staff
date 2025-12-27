'use client'

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
    router.push(`/pin?location=${location.id}${isAdmin ? '&mode=admin' : ''}`)
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
