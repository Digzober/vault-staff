'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package,
  LogOut,
  RefreshCw,
  User,
  Phone,
  Hash,
  X,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Bell,
  Copy,
  Check,
  DollarSign,
  Clock,
  CheckCircle,
  FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CancelledClaimsByLocation } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'

type TabType = 'active' | 'redeemed' | 'cancelled'

const TAB_CONFIG = {
  active: {
    label: 'Active',
    icon: Clock,
    color: 'gold',
    bgClass: 'bg-[#D4AF37]/10',
    textClass: 'text-[#D4AF37]',
    borderClass: 'border-[#D4AF37]/30',
    description: 'Active passes ready for pickup'
  },
  redeemed: {
    label: 'Completed',
    icon: CheckCircle,
    color: 'green',
    bgClass: 'bg-green-500/10',
    textClass: 'text-green-500',
    borderClass: 'border-green-500/30',
    description: 'Completed pickups'
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    color: 'red',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-500',
    borderClass: 'border-red-500/30',
    description: 'Expired and cancelled claims'
  }
}

interface WinningDrop {
  certificate_id: string
  certificate_number: string
  user_id: string
  customer_name: string
  customer_phone: string
  package_name: string
  package_items: any[]
  final_price: number
  original_price: number
  retail_value: number
  created_at: string
  expires_at: string
  order_status: string
  redeemed_at: string | null
  redeemed_location: string | null
  dutchie_transaction_id: string | null
  redeemed_by_staff: string | null
}

interface AuditLogEntry {
  id: string
  certificate_id: string
  action: string
  performed_by: string | null
  performed_at: string
  metadata: Record<string, any> | null
  dutchie_transaction_id: string | null
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [winningDrops, setWinningDrops] = useState<WinningDrop[]>([])
  const [cancelledByLocation, setCancelledByLocation] = useState<CancelledClaimsByLocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [selectedDrop, setSelectedDrop] = useState<WinningDrop | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [loadingAuditLog, setLoadingAuditLog] = useState(false)
  const router = useRouter()

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const fetchAuditLog = async (certificateId: string) => {
    setLoadingAuditLog(true)
    try {
      const { data, error } = await supabase
        .from('certificate_audit_log')
        .select('*')
        .eq('certificate_id', certificateId)
        .order('performed_at', { ascending: false })

      if (!error && data) {
        setAuditLog(data)
      }
    } catch (err) {
      console.error('Error fetching audit log:', err)
    } finally {
      setLoadingAuditLog(false)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true)

      const { data: drops, error: fetchError } = await supabase
        .from('certificates')
        .select(`
          id,
          certificate_number,
          user_id,
          final_price,
          original_price,
          created_at,
          expires_at,
          order_status,
          redeemed_at,
          redeemed_location,
          dutchie_transaction_id,
          redeemed_by_staff,
          auctions (
            id,
            current_price,
            packages (
              id,
              name,
              items,
              retail_value
            )
          ),
          profiles:user_id (
            id,
            name,
            username,
            phone
          )
        `)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching certificates:', fetchError)
      } else if (drops) {
        const formattedDrops: WinningDrop[] = drops.map((c: any) => ({
          certificate_id: c.id,
          certificate_number: c.certificate_number,
          user_id: c.user_id,
          customer_name: c.profiles?.name || c.profiles?.username || 'Unknown',
          customer_phone: c.profiles?.phone || '',
          package_name: c.auctions?.packages?.name || 'Package',
          package_items: c.auctions?.packages?.items || [],
          final_price: c.final_price ?? c.auctions?.current_price ?? 0,
          original_price: c.original_price ?? c.auctions?.current_price ?? 0,
          retail_value: c.auctions?.packages?.retail_value ?? 0,
          created_at: c.created_at,
          expires_at: c.expires_at,
          order_status: c.order_status || 'active',
          redeemed_at: c.redeemed_at,
          redeemed_location: c.redeemed_location,
          dutchie_transaction_id: c.dutchie_transaction_id,
          redeemed_by_staff: c.redeemed_by_staff
        }))
        setWinningDrops(formattedDrops)
      }

      // Fetch cancelled claims by location
      const { data: cancelled } = await supabase
        .rpc('get_pending_cancelled_claims_by_location')

      if (cancelled) {
        setCancelledByLocation(cancelled)
      }

      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // Check admin authentication
    const adminAuthenticated = sessionStorage.getItem('adminAuthenticated')
    if (!adminAuthenticated) {
      router.push('/')
      return
    }

    fetchData()

    // Set up realtime subscription
    const channel = supabase
      .channel('admin-certificates-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'certificates' },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, fetchData])

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuthenticated')
    sessionStorage.removeItem('adminMode')
    router.push('/')
  }

  const runAutoCancellation = async () => {
    try {
      const { data, error } = await supabase
        .rpc('auto_cancel_expired_certificates')

      if (error) throw error

      alert(`Auto-cancelled ${data} expired certificates`)
      fetchData()
    } catch (error) {
      console.error('Error running auto-cancellation:', error)
      alert('Error running auto-cancellation')
    }
  }

  // Filter drops based on tab
  const filteredDrops = winningDrops.filter(drop => {
    if (activeTab === 'active') {
      return drop.order_status === 'active'
    } else if (activeTab === 'redeemed') {
      return drop.order_status === 'redeemed' || !!drop.redeemed_at
    } else {
      return drop.order_status === 'cancelled' || drop.order_status === 'expired'
    }
  })

  const getCounts = () => {
    return {
      active: winningDrops.filter(d => d.order_status === 'active').length,
      redeemed: winningDrops.filter(d => d.order_status === 'redeemed' || !!d.redeemed_at).length,
      cancelled: winningDrops.filter(d => d.order_status === 'cancelled' || d.order_status === 'expired').length
    }
  }

  const counts = getCounts()

  const openDetail = (drop: WinningDrop) => {
    setSelectedDrop(drop)
    setShowModal(true)
    fetchAuditLog(drop.certificate_id)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#a1a1a1]">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="border-b border-purple-500/30 bg-[#0a0a0a]/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Admin Dashboard</h1>
                <p className="text-xs text-[#a1a1a1]">
                  Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={runAutoCancellation}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-medium hover:bg-red-500/30 transition-colors text-sm"
                title="Run auto-cancellation for expired claims"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Auto-Cancel</span>
              </button>
              <button
                onClick={fetchData}
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

        {/* Status Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-3 gap-2 pb-4">
            {(Object.keys(TAB_CONFIG) as TabType[]).map((tabId) => {
              const tab = TAB_CONFIG[tabId]
              const TabIcon = tab.icon
              const count = counts[tabId]
              const isActive = activeTab === tabId

              return (
                <button
                  key={tabId}
                  onClick={() => setActiveTab(tabId)}
                  className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    isActive
                      ? `${tab.bgClass} ${tab.borderClass} ${tab.textClass}`
                      : 'bg-[#1a1a1a] border-[#333] text-[#666] hover:border-[#444]'
                  }`}
                >
                  <TabIcon className={`w-5 h-5 ${isActive ? tab.textClass : 'text-[#666]'}`} />
                  <span className={`text-xs font-medium ${isActive ? tab.textClass : 'text-[#a1a1a1]'}`}>
                    {tab.label}
                  </span>
                  {count > 0 && (
                    <span className={`absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full ${
                      isActive
                        ? `${tab.bgClass} ${tab.textClass} border ${tab.borderClass}`
                        : 'bg-[#333] text-white'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Cancelled Claims Alert Banner */}
      {cancelledByLocation.length > 0 && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 animate-pulse">
              <Bell className="w-5 h-5 text-red-500" />
              <span className="text-sm text-red-400 font-medium">
                {cancelledByLocation.length} location{cancelledByLocation.length !== 1 ? 's' : ''} have cancelled claims pending inventory return!
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {cancelledByLocation.map((loc) => (
                <div
                  key={loc.location_id}
                  className="bg-red-500/20 border border-red-500/40 rounded-lg px-3 py-1.5 text-xs animate-pulse"
                >
                  <span className="text-red-400 font-medium">{loc.location_name}</span>
                  <span className="text-red-300 ml-2">{loc.cancelled_count} pending</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Description Banner */}
      <div className={`${TAB_CONFIG[activeTab].bgClass} border-b ${TAB_CONFIG[activeTab].borderClass} px-4 py-2`}>
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          {(() => {
            const TabIcon = TAB_CONFIG[activeTab].icon
            return <TabIcon className={`w-4 h-4 ${TAB_CONFIG[activeTab].textClass}`} />
          })()}
          <span className={`text-sm ${TAB_CONFIG[activeTab].textClass}`}>
            {TAB_CONFIG[activeTab].description} &bull; {filteredDrops.length} order{filteredDrops.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        {filteredDrops.length === 0 ? (
          <div className="text-center py-16">
            {(() => {
              const TabIcon = TAB_CONFIG[activeTab].icon
              return <TabIcon className="w-16 h-16 text-[#333] mx-auto mb-4" />
            })()}
            <p className="text-[#a1a1a1]">No {TAB_CONFIG[activeTab].label.toLowerCase()} orders</p>
            <p className="text-[#666] text-sm mt-1">
              {activeTab === 'active' ? 'Active passes will appear here' :
               activeTab === 'redeemed' ? 'Completed pickups will appear here' :
               'Cancelled claims will appear here'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDrops.map((drop) => {
              const tabConfig = TAB_CONFIG[activeTab]
              const isExpiringSoon = activeTab === 'active' &&
                new Date(drop.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000
              const discount = drop.retail_value - drop.final_price

              return (
                <div
                  key={drop.certificate_id}
                  className={`bg-[#1a1a1a] border rounded-xl p-4 cursor-pointer hover:border-purple-500 transition-all ${tabConfig.borderClass} ${
                    isExpiringSoon ? 'ring-2 ring-yellow-500/50' : ''
                  }`}
                  onClick={() => openDetail(drop)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 text-[#D4AF37] mb-1">
                        <Hash className="w-4 h-4" />
                        <span className="font-mono text-sm font-semibold">
                          {drop.certificate_number}
                        </span>
                      </div>
                      <p className="text-xs text-[#666]">
                        Won {formatDistanceToNow(new Date(drop.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      drop.order_status === 'cancelled' || drop.order_status === 'expired'
                        ? 'bg-red-500/10 text-red-400'
                        : drop.order_status === 'redeemed'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-[#D4AF37]/10 text-[#D4AF37]'
                    }`}>
                      {drop.order_status === 'redeemed' ? 'CLAIMED' : drop.order_status?.toUpperCase() || 'ACTIVE'}
                    </div>
                  </div>

                  {/* Customer */}
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-[#666]" />
                    <span className="text-sm text-white">{drop.customer_name}</span>
                  </div>
                  {drop.customer_phone && (
                    <div className="flex items-center gap-2 mb-3">
                      <Phone className="w-4 h-4 text-[#666]" />
                      <span className="text-sm text-[#a1a1a1]">{drop.customer_phone}</span>
                    </div>
                  )}

                  {/* Package */}
                  <div className="bg-[#0a0a0a] rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium text-white mb-1">
                      {drop.package_name}
                    </p>
                    {drop.package_items && drop.package_items.length > 0 && (
                      <div className="space-y-1">
                        {drop.package_items.slice(0, 3).map((item: any, i: number) => (
                          <p key={i} className="text-xs text-[#a1a1a1]">
                            &bull; {item.quantity}&times; {item.name}
                          </p>
                        ))}
                        {drop.package_items.length > 3 && (
                          <p className="text-xs text-[#666]">
                            +{drop.package_items.length - 3} more items
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Discount Display */}
                  {discount > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 mb-3 text-center">
                      <p className="text-xs text-emerald-400/70">Discount to Apply</p>
                      <p className="text-lg font-bold text-emerald-400">${discount.toFixed(2)} OFF</p>
                    </div>
                  )}

                  {/* Expiration Warning */}
                  {isExpiringSoon && (
                    <div className="flex items-center gap-2 text-yellow-500 text-xs mb-3 bg-yellow-500/10 rounded px-2 py-1">
                      <AlertTriangle className="w-3 h-3" />
                      Expires {formatDistanceToNow(new Date(drop.expires_at), { addSuffix: true })}
                    </div>
                  )}

                  {/* Redeemed Info */}
                  {drop.order_status === 'redeemed' && (
                    <div className="space-y-1 mb-3">
                      {drop.redeemed_location && (
                        <p className="text-xs text-green-400">Claimed at {drop.redeemed_location}</p>
                      )}
                      {drop.dutchie_transaction_id && (
                        <div className="flex items-center gap-1 text-xs text-blue-400">
                          <FileText className="w-3 h-3" />
                          <span className="font-mono">{drop.dutchie_transaction_id}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#a1a1a1]">Final Price</span>
                    <span className="font-semibold text-[#D4AF37] text-lg">
                      ${drop.final_price?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {showModal && selectedDrop && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-purple-500/30 rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] p-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-semibold text-white">Pass Details</h2>
                <p className="text-xs text-[#a1a1a1]">
                  {selectedDrop.order_status === 'redeemed' ? 'Completed pickup' :
                   selectedDrop.order_status === 'cancelled' || selectedDrop.order_status === 'expired' ? 'Cancelled/Expired' :
                   'Active pass'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false)
                  setSelectedDrop(null)
                  setAuditLog([])
                }}
                className="p-2 text-[#a1a1a1] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Certificate Number */}
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#D4AF37] mb-1">Certificate Number</p>
                    <p className="text-2xl font-mono font-bold text-[#D4AF37]">
                      {selectedDrop.certificate_number}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedDrop.certificate_number, 'cert')}
                    className="p-3 bg-[#D4AF37]/20 rounded-lg hover:bg-[#D4AF37]/30 transition-colors"
                  >
                    {copiedField === 'cert' ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-[#D4AF37]" />
                    )}
                  </button>
                </div>
              </div>

              {/* GIANT Discount Display */}
              {selectedDrop.retail_value - selectedDrop.final_price > 0 && (
                <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-xl p-6 text-center">
                  <p className="text-sm text-emerald-400/70 mb-1">Discount to Apply in Dutchie POS</p>
                  <p className="text-5xl font-bold text-emerald-400">
                    ${(selectedDrop.retail_value - selectedDrop.final_price).toFixed(2)}
                  </p>
                  <p className="text-emerald-400/60 text-sm mt-2">OFF</p>
                  <div className="flex items-center justify-center gap-4 mt-3 text-sm">
                    <span className="text-[#a1a1a1]">Retail: ${selectedDrop.retail_value.toFixed(2)}</span>
                    <span className="text-[#a1a1a1]">&rarr;</span>
                    <span className="text-emerald-400 font-semibold">Pay: ${selectedDrop.final_price.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Final Price */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-6 h-6 text-green-400" />
                    <div>
                      <p className="text-xs text-green-300 mb-1">Final Price</p>
                      <p className="text-3xl font-bold text-green-400">
                        ${selectedDrop.final_price?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`$${selectedDrop.final_price?.toFixed(2) || '0.00'}`, 'price')}
                    className="p-3 bg-green-500/20 rounded-lg hover:bg-green-500/30 transition-colors"
                  >
                    {copiedField === 'price' ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-green-400" />
                    )}
                  </button>
                </div>
                {selectedDrop.original_price && selectedDrop.original_price !== selectedDrop.final_price && (
                  <p className="text-sm text-[#666] mt-2 line-through">
                    Original: ${selectedDrop.original_price?.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Package Items */}
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#D4AF37]" />
                    Package Items
                  </h3>
                  <button
                    onClick={() => {
                      const itemsText = selectedDrop.package_items
                        ?.map((item: any) => `${item.quantity}x ${item.name}`)
                        .join('\n') || selectedDrop.package_name
                      copyToClipboard(itemsText, 'items')
                    }}
                    className="p-2 bg-[#333] rounded hover:bg-[#444] transition-colors"
                  >
                    {copiedField === 'items' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#a1a1a1]" />
                    )}
                  </button>
                </div>
                <p className="text-base font-medium text-white mb-3">{selectedDrop.package_name}</p>
                {selectedDrop.package_items && selectedDrop.package_items.length > 0 && (
                  <div className="space-y-2 border-t border-[#333] pt-3">
                    {selectedDrop.package_items.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-base">
                        <span className="text-white">{item.name}</span>
                        <span className="font-semibold text-[#D4AF37]">&times;{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Info */}
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#D4AF37]" />
                  Customer
                </h3>
                <p className="text-base text-white">{selectedDrop.customer_name}</p>
                {selectedDrop.customer_phone && (
                  <p className="text-sm text-[#a1a1a1] mt-1">{selectedDrop.customer_phone}</p>
                )}
              </div>

              {/* Expiration */}
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#D4AF37]" />
                  Claim Deadline
                </h3>
                <p className="text-base text-white">
                  {format(new Date(selectedDrop.expires_at), 'MMM d, yyyy h:mm a')}
                </p>
                <p className="text-xs text-[#666] mt-1">
                  {new Date(selectedDrop.expires_at) > new Date()
                    ? `Expires ${formatDistanceToNow(new Date(selectedDrop.expires_at), { addSuffix: true })}`
                    : 'Expired'}
                </p>
              </div>

              {/* Redeemed Info */}
              {selectedDrop.order_status === 'redeemed' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Claimed
                  </h3>
                  {selectedDrop.redeemed_location && (
                    <p className="text-sm text-white">Location: {selectedDrop.redeemed_location}</p>
                  )}
                  {selectedDrop.redeemed_at && (
                    <p className="text-sm text-[#a1a1a1]">
                      {format(new Date(selectedDrop.redeemed_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  )}
                  {selectedDrop.redeemed_by_staff && (
                    <p className="text-sm text-[#a1a1a1]">Staff: {selectedDrop.redeemed_by_staff}</p>
                  )}
                  {selectedDrop.dutchie_transaction_id && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <div>
                          <p className="text-xs text-blue-400">Dutchie Transaction</p>
                          <p className="text-sm font-mono text-blue-300">{selectedDrop.dutchie_transaction_id}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(selectedDrop.dutchie_transaction_id!, 'txid')}
                        className="p-2 bg-blue-500/20 rounded hover:bg-blue-500/30 transition-colors"
                      >
                        {copiedField === 'txid' ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-blue-400" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Audit Log */}
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#D4AF37]" />
                  Audit Log
                </h3>
                {loadingAuditLog ? (
                  <div className="flex items-center gap-2 text-[#666] text-sm py-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading...
                  </div>
                ) : auditLog.length === 0 ? (
                  <p className="text-sm text-[#666]">No audit log entries</p>
                ) : (
                  <div className="space-y-2">
                    {auditLog.map((entry) => (
                      <div key={entry.id} className="border-b border-[#333] pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            entry.action === 'created' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' :
                            entry.action === 'redeemed' ? 'bg-green-500/10 text-green-400' :
                            entry.action === 'expired' ? 'bg-orange-500/10 text-orange-400' :
                            entry.action === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                            'bg-[#333] text-[#a1a1a1]'
                          }`}>
                            {entry.action.toUpperCase()}
                          </span>
                          <span className="text-xs text-[#666]">
                            {format(new Date(entry.performed_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        {entry.performed_by && (
                          <p className="text-xs text-[#a1a1a1] mt-1">By: {entry.performed_by}</p>
                        )}
                        {entry.dutchie_transaction_id && (
                          <p className="text-xs text-blue-400 font-mono mt-1">TX: {entry.dutchie_transaction_id}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="sticky bottom-0 bg-[#1a1a1a] border-t border-[#333] p-4">
              <button
                onClick={() => {
                  setShowModal(false)
                  setSelectedDrop(null)
                  setAuditLog([])
                }}
                className="w-full py-3 px-4 bg-[#333] text-white font-medium rounded-lg hover:bg-[#444] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
