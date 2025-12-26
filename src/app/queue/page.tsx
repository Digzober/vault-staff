'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package,
  Clock,
  CheckCircle2,
  ChefHat,
  LogOut,
  RefreshCw,
  User,
  Phone,
  Hash,
  MapPin,
  AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Location, Certificate } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'

type TabType = 'pending' | 'preparing' | 'ready' | 'picked_up'

export default function QueuePage() {
  const [location, setLocation] = useState<Location | null>(null)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check authentication
    const authenticated = sessionStorage.getItem('staffAuthenticated')
    const locationData = sessionStorage.getItem('staffLocation')

    if (!authenticated || !locationData) {
      router.push('/')
      return
    }

    setLocation(JSON.parse(locationData))
    fetchCertificates(JSON.parse(locationData).id)

    // Set up realtime subscription
    const channel = supabase
      .channel('certificates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'certificates',
        },
        () => {
          fetchCertificates(JSON.parse(locationData).id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchCertificates = async (locationId: string) => {
    try {
      setIsRefreshing(true)
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          auctions (
            id,
            packages (
              id,
              name,
              description,
              items
            )
          ),
          profiles:user_id (
            id,
            name,
            username,
            phone
          )
        `)
        .eq('claim_location_id', locationId)
        .is('voided', false)
        .is('redeemed_at', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      setCertificates(data || [])
    } catch (error) {
      console.error('Error fetching certificates:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const updateOrderStatus = async (certificateId: string, status: TabType) => {
    try {
      const updates: Record<string, unknown> = { order_status: status }

      if (status === 'preparing') {
        updates.prepared_at = null
      } else if (status === 'ready') {
        updates.prepared_at = new Date().toISOString()
      } else if (status === 'picked_up') {
        updates.picked_up_at = new Date().toISOString()
        updates.redeemed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('certificates')
        .update(updates)
        .eq('id', certificateId)

      if (error) throw error

      // Refresh certificates
      if (location) {
        fetchCertificates(location.id)
      }
      setSelectedCertificate(null)
    } catch (error) {
      console.error('Error updating order status:', error)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('staffAuthenticated')
    sessionStorage.removeItem('staffLocation')
    router.push('/')
  }

  const filteredCertificates = certificates.filter(cert => {
    const status = cert.order_status || 'pending'
    return status === activeTab
  })

  const getCounts = () => {
    return {
      pending: certificates.filter(c => (c.order_status || 'pending') === 'pending').length,
      preparing: certificates.filter(c => c.order_status === 'preparing').length,
      ready: certificates.filter(c => c.order_status === 'ready').length,
      picked_up: certificates.filter(c => c.order_status === 'picked_up').length,
    }
  }

  const counts = getCounts()

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
      <header className="border-b border-[#333] bg-[#0a0a0a]/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F4D03F] to-[#B8960C] flex items-center justify-center">
                <MapPin className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">{location?.name}</h1>
                <p className="text-xs text-[#a1a1a1]">Pickup Queue</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => location && fetchCertificates(location.id)}
                disabled={isRefreshing}
                className="p-2 text-[#a1a1a1] hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#a1a1a1] hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {[
              { id: 'pending', label: 'Pending', icon: Clock, count: counts.pending },
              { id: 'preparing', label: 'Preparing', icon: ChefHat, count: counts.preparing },
              { id: 'ready', label: 'Ready', icon: Package, count: counts.ready },
              { id: 'picked_up', label: 'Picked Up', icon: CheckCircle2, count: counts.picked_up },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#D4AF37] text-[#D4AF37]'
                    : 'border-transparent text-[#a1a1a1] hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id
                      ? 'bg-[#D4AF37] text-black'
                      : 'bg-[#333] text-white'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        {filteredCertificates.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-[#333] mx-auto mb-4" />
            <p className="text-[#a1a1a1]">No {activeTab.replace('_', ' ')} orders</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCertificates.map((cert) => (
              <div
                key={cert.id}
                onClick={() => setSelectedCertificate(cert)}
                className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4 cursor-pointer hover:border-[#D4AF37] transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 text-[#D4AF37] mb-1">
                      <Hash className="w-4 h-4" />
                      <span className="font-mono text-sm font-semibold">
                        {cert.certificate_number}
                      </span>
                    </div>
                    <p className="text-xs text-[#666]">
                      {formatDistanceToNow(new Date(cert.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    activeTab === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                    activeTab === 'preparing' ? 'bg-blue-500/10 text-blue-500' :
                    activeTab === 'ready' ? 'bg-green-500/10 text-green-500' :
                    'bg-[#333] text-[#a1a1a1]'
                  }`}>
                    {activeTab.replace('_', ' ').toUpperCase()}
                  </div>
                </div>

                {/* Customer */}
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-[#666]" />
                  <span className="text-sm text-white">
                    {cert.profiles?.name || cert.profiles?.username || 'Unknown Customer'}
                  </span>
                </div>

                {/* Package */}
                <div className="bg-[#0a0a0a] rounded-lg p-3 mb-3">
                  <p className="text-sm font-medium text-white mb-1">
                    {cert.auctions?.packages?.name || 'Package'}
                  </p>
                  {cert.auctions?.packages?.items && (
                    <div className="space-y-1">
                      {cert.auctions.packages.items.slice(0, 3).map((item, i) => (
                        <p key={i} className="text-xs text-[#a1a1a1]">
                          • {item.quantity}x {item.name}
                        </p>
                      ))}
                      {cert.auctions.packages.items.length > 3 && (
                        <p className="text-xs text-[#666]">
                          +{cert.auctions.packages.items.length - 3} more items
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#a1a1a1]">Total</span>
                  <span className="font-semibold text-[#D4AF37]">
                    ${cert.final_price?.toFixed(2) || cert.original_price?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Order Detail Modal */}
      {selectedCertificate && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#D4AF37]">
                  <Hash className="w-5 h-5" />
                  <span className="font-mono font-semibold">
                    {selectedCertificate.certificate_number}
                  </span>
                </div>
                <p className="text-xs text-[#666] mt-1">
                  Created {format(new Date(selectedCertificate.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <button
                onClick={() => setSelectedCertificate(null)}
                className="p-2 text-[#a1a1a1] hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Customer Info */}
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#D4AF37]" />
                  Customer
                </h3>
                <div className="space-y-2">
                  <p className="text-sm text-white">
                    {selectedCertificate.profiles?.name || selectedCertificate.profiles?.username || 'Unknown'}
                  </p>
                  {selectedCertificate.profiles?.phone && (
                    <p className="text-sm text-[#a1a1a1] flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {selectedCertificate.profiles.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Package Items */}
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#D4AF37]" />
                  Order Items
                </h3>
                <p className="text-sm font-medium text-white mb-2">
                  {selectedCertificate.auctions?.packages?.name}
                </p>
                {selectedCertificate.auctions?.packages?.items && (
                  <div className="space-y-2 border-t border-[#333] pt-2 mt-2">
                    {selectedCertificate.auctions.packages.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-[#a1a1a1]">{item.name}</span>
                        <span className="text-white font-medium">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#a1a1a1]">Total Paid</span>
                  <span className="text-xl font-bold text-[#D4AF37]">
                    ${selectedCertificate.final_price?.toFixed(2) || selectedCertificate.original_price?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>

              {/* Warning for pending */}
              {(selectedCertificate.order_status || 'pending') === 'pending' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-500">
                    This order is waiting to be prepared. Start preparing when you're ready.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="sticky bottom-0 bg-[#1a1a1a] border-t border-[#333] p-4">
              {(selectedCertificate.order_status || 'pending') === 'pending' && (
                <button
                  onClick={() => updateOrderStatus(selectedCertificate.id, 'preparing')}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ChefHat className="w-5 h-5" />
                  Start Preparing
                </button>
              )}
              {selectedCertificate.order_status === 'preparing' && (
                <button
                  onClick={() => updateOrderStatus(selectedCertificate.id, 'ready')}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Package className="w-5 h-5" />
                  Mark as Ready
                </button>
              )}
              {selectedCertificate.order_status === 'ready' && (
                <button
                  onClick={() => updateOrderStatus(selectedCertificate.id, 'picked_up')}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#F4D03F] to-[#B8960C] hover:from-[#D4AF37] hover:to-[#9a7b0a] text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Complete Pickup
                </button>
              )}
              {selectedCertificate.order_status === 'picked_up' && (
                <div className="text-center py-2">
                  <p className="text-sm text-green-500 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Order completed
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
