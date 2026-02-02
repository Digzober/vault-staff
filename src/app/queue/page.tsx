'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package,
  CheckCircle2,
  LogOut,
  RefreshCw,
  User,
  Phone,
  Hash,
  MapPin,
  ScanLine,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Keyboard,
  Ban,
  DollarSign,
  FileText,
  Clock
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Location, Certificate } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'

type TabType = 'active' | 'redeemed' | 'cancelled'

// Tab configuration with colors and labels
const TAB_CONFIG = {
  active: {
    label: 'Active',
    icon: Clock,
    color: 'gold',
    bgClass: 'bg-[#D4AF37]/10',
    textClass: 'text-[#D4AF37]',
    borderClass: 'border-[#D4AF37]/30',
    description: 'Ready for customer pickup'
  },
  redeemed: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'green',
    bgClass: 'bg-green-500/10',
    textClass: 'text-green-500',
    borderClass: 'border-green-500/30',
    description: 'Picked up today'
  },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    color: 'red',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-500',
    borderClass: 'border-red-500/30',
    description: 'Expired or voided claims'
  }
}

interface ScanResult {
  type: 'success' | 'error' | 'warning'
  title: string
  message: string
  certificate?: Certificate
}

export default function QueuePage() {
  const [location, setLocation] = useState<Location | null>(null)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scannerInput, setScannerInput] = useState('')
  const [isProcessingScan, setIsProcessingScan] = useState(false)
  const [dutchieTransactionId, setDutchieTransactionId] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const router = useRouter()
  const scannerInputRef = useRef<HTMLInputElement>(null)

  // Fetch certificates - show ALL active certs, not just this location's
  const fetchCertificates = useCallback(async () => {
    try {
      setIsRefreshing(true)

      // Get today's date at midnight for filtering completed orders
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      // Fetch all ACTIVE orders (immediately ready for pickup)
      const { data: activeOrders, error: activeError } = await supabase
        .from('certificates')
        .select(`
          *,
          auctions (
            id,
            current_price,
            packages (
              id,
              name,
              description,
              retail_value,
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
        .is('voided', false)
        .is('redeemed_at', null)
        .eq('order_status', 'active')
        .order('created_at', { ascending: true })

      if (activeError) throw activeError

      // Fetch cancelled/expired orders
      const { data: cancelledOrders, error: cancelledError } = await supabase
        .from('certificates')
        .select(`
          *,
          auctions (
            id,
            current_price,
            packages (
              id,
              name,
              description,
              retail_value,
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
        .or('order_status.eq.cancelled,order_status.eq.expired')
        .order('created_at', { ascending: false })
        .limit(50)

      if (cancelledError) throw cancelledError

      // Fetch today's completed orders
      const { data: completedOrders, error: completedError } = await supabase
        .from('certificates')
        .select(`
          *,
          auctions (
            id,
            current_price,
            packages (
              id,
              name,
              description,
              retail_value,
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
        .is('voided', false)
        .eq('order_status', 'redeemed')
        .gte('redeemed_at', todayISO)
        .order('redeemed_at', { ascending: false })

      if (completedError) throw completedError

      // Combine all orders
      const allOrders = [...(activeOrders || []), ...(cancelledOrders || []), ...(completedOrders || [])]
      setCertificates(allOrders)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching certificates:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // Check authentication
    const authenticated = sessionStorage.getItem('staffAuthenticated')
    const locationData = sessionStorage.getItem('staffLocation')

    if (!authenticated || !locationData) {
      router.push('/')
      return
    }

    const parsedLocation = JSON.parse(locationData)
    setLocation(parsedLocation)
    fetchCertificates()

    // Set up realtime subscription
    const channel = supabase
      .channel('certificates-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'certificates',
        },
        () => {
          fetchCertificates()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'certificates',
        },
        () => {
          fetchCertificates()
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, fetchCertificates])

  // Open scanner modal and focus input
  const startScanner = () => {
    setShowScanner(true)
    setScanResult(null)
    setScannerInput('')
    setTimeout(() => {
      scannerInputRef.current?.focus()
    }, 100)
  }

  const stopScanner = () => {
    setShowScanner(false)
    setScanResult(null)
    setScannerInput('')
  }

  // Handle scanner input
  const handleScannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scannerInput.trim() || isProcessingScan) return

    setIsProcessingScan(true)
    await processScannedData(scannerInput.trim())
    setIsProcessingScan(false)
  }

  const processScannedData = async (decodedText: string) => {
    try {
      let qrData: any
      try {
        qrData = JSON.parse(decodedText)
      } catch {
        const certMatch = decodedText.match(/(?:VLT-\d{8}-[A-Z0-9]{5}|VAULT-[A-Z0-9]+)/i)
        if (certMatch) {
          qrData = { cert: certMatch[0] }
        } else {
          throw new Error('Invalid QR code format')
        }
      }

      const certNumber = qrData.cert || qrData.certificate_number
      if (!certNumber) {
        setScanResult({
          type: 'error',
          title: 'Invalid QR Code',
          message: 'This QR code does not contain valid pass information.'
        })
        return
      }

      // Look up certificate
      const { data: cert, error } = await supabase
        .from('certificates')
        .select(`
          *,
          auctions (
            id,
            current_price,
            packages (
              id,
              name,
              description,
              retail_value,
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
        .eq('certificate_number', certNumber)
        .single()

      if (error || !cert) {
        setScanResult({
          type: 'error',
          title: 'Pass Not Found',
          message: `No pass found with number ${certNumber}`
        })
        return
      }

      // Check if already redeemed
      if (cert.redeemed_at || cert.order_status === 'redeemed') {
        setScanResult({
          type: 'error',
          title: 'Already Claimed',
          message: `This pass was already claimed on ${format(new Date(cert.redeemed_at), 'MMM d, yyyy')}`
        })
        return
      }

      // Check if voided
      if (cert.voided || cert.order_status === 'cancelled') {
        setScanResult({
          type: 'error',
          title: 'Pass Voided',
          message: cert.voided_reason || 'This pass has been voided.'
        })
        return
      }

      // Check if expired
      if (cert.order_status === 'expired' || new Date(cert.expires_at) < new Date()) {
        setScanResult({
          type: 'error',
          title: 'Pass Expired',
          message: `This pass expired on ${format(new Date(cert.expires_at), 'MMM d, yyyy')}`
        })
        return
      }

      // Success!
      const retailValue = cert.auctions?.packages?.retail_value || 0
      const paidPrice = cert.auctions?.current_price || 0
      const discount = retailValue - paidPrice

      setScanResult({
        type: 'success',
        title: 'Valid Pass',
        message: discount > 0
          ? `Apply $${discount.toFixed(2)} discount in Dutchie POS`
          : `Ready to process: ${cert.auctions?.packages?.name || 'Package'}`,
        certificate: cert
      })

    } catch (err) {
      console.error('QR scan error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setScanResult({
        type: 'error',
        title: 'Scan Error',
        message: `Unable to process QR code: ${errorMessage}`
      })
    }
  }

  const completePickup = async (certificateId: string, certificateNumber: string) => {
    if (!dutchieTransactionId.trim()) {
      alert('Please enter the Dutchie Transaction ID before completing pickup.')
      return
    }

    try {
      const locationName = location?.full_name || location?.name || 'The Vault'
      const { data: redeemResult, error: redeemError } = await supabase.rpc('redeem_certificate', {
        p_certificate_number: certificateNumber,
        p_location: locationName,
        p_location_id: location?.id || null,
        p_dutchie_transaction_id: dutchieTransactionId.trim(),
        p_redeemed_by_staff: null
      })

      if (redeemError) {
        console.error('Redeem error:', redeemError)
        alert(`Error redeeming pass: ${redeemError.message}`)
        return
      }

      if (redeemResult && !redeemResult.success) {
        alert(`Error: ${redeemResult.error}`)
        return
      }

      // Refresh and close
      await fetchCertificates()
      setSelectedCertificate(null)
      setScanResult(null)
      setDutchieTransactionId('')
    } catch (error) {
      console.error('Error completing pickup:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('staffAuthenticated')
    sessionStorage.removeItem('staffLocation')
    router.push('/')
  }

  const filteredCertificates = certificates.filter(cert => {
    if (activeTab === 'active') return cert.order_status === 'active'
    if (activeTab === 'redeemed') return cert.order_status === 'redeemed'
    if (activeTab === 'cancelled') return cert.order_status === 'cancelled' || cert.order_status === 'expired'
    return false
  })

  const getCounts = () => {
    return {
      active: certificates.filter(c => c.order_status === 'active').length,
      redeemed: certificates.filter(c => c.order_status === 'redeemed').length,
      cancelled: certificates.filter(c => c.order_status === 'cancelled' || c.order_status === 'expired').length,
    }
  }

  const counts = getCounts()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#a1a1a1]">Loading queue...</p>
        </div>
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
                <p className="text-xs text-[#a1a1a1]">
                  Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Scan Button */}
              <button
                onClick={startScanner}
                className="flex items-center gap-2 px-3 py-2 bg-[#D4AF37] text-black rounded-lg font-medium hover:bg-[#B8960C] transition-colors"
              >
                <ScanLine className="w-5 h-5" />
                <span className="hidden sm:inline">Scan</span>
              </button>
              <button
                onClick={() => fetchCertificates()}
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


      {/* Tab Description Banner */}
      <div className={`${TAB_CONFIG[activeTab].bgClass} border-b ${TAB_CONFIG[activeTab].borderClass} px-4 py-2`}>
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          {(() => {
            const TabIcon = TAB_CONFIG[activeTab].icon
            return <TabIcon className={`w-4 h-4 ${TAB_CONFIG[activeTab].textClass}`} />
          })()}
          <span className={`text-sm ${TAB_CONFIG[activeTab].textClass}`}>
            {TAB_CONFIG[activeTab].description} &bull; {filteredCertificates.length} order{filteredCertificates.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        {filteredCertificates.length === 0 ? (
          <div className="text-center py-16">
            {(() => {
              const TabIcon = TAB_CONFIG[activeTab].icon
              return <TabIcon className="w-16 h-16 text-[#333] mx-auto mb-4" />
            })()}
            <p className="text-[#a1a1a1]">No {TAB_CONFIG[activeTab].label.toLowerCase()} orders</p>
            <p className="text-[#666] text-sm mt-1">Orders will appear here in real-time</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCertificates.map((cert) => {
              const tabConfig = TAB_CONFIG[activeTab]
              const retailValue = cert.auctions?.packages?.retail_value || 0
              const paidPrice = cert.auctions?.current_price || 0
              const discount = retailValue - paidPrice
              return (
                <div
                  key={cert.id}
                  onClick={() => {
                    setSelectedCertificate(cert)
                    setDutchieTransactionId('')
                  }}
                  className={`bg-[#1a1a1a] border rounded-xl p-4 cursor-pointer hover:border-[#D4AF37] transition-all ${tabConfig.borderClass}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 text-[#666] mb-1">
                        <Hash className="w-4 h-4" />
                        <span className="font-mono text-sm text-[#666]">
                          &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                        </span>
                      </div>
                      <p className="text-xs text-[#666]">
                        {formatDistanceToNow(new Date(cert.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${tabConfig.bgClass} ${tabConfig.textClass}`}>
                      {tabConfig.label.toUpperCase()}
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
                        {cert.auctions.packages.items.slice(0, 3).map((item: any, i: number) => (
                          <p key={i} className="text-xs text-[#a1a1a1]">
                            &bull; {item.quantity}x {item.name}
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

                  {/* Discount Display */}
                  {discount > 0 && activeTab === 'active' && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 mb-3 text-center">
                      <p className="text-xs text-[#a1a1a1]">Dutchie Discount</p>
                      <p className="text-lg font-bold text-green-400">${discount.toFixed(2)} OFF</p>
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#a1a1a1]">Paid</span>
                    <span className="font-semibold text-[#D4AF37]">
                      ${paidPrice.toFixed(2)}
                    </span>
                  </div>

                  {/* Dutchie TX ID for completed */}
                  {cert.dutchie_transaction_id && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-400">
                      <FileText className="w-3 h-3" />
                      <span className="font-mono truncate">TX: {cert.dutchie_transaction_id}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          {/* Scanner Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#333]">
            <div>
              <h2 className="text-lg font-semibold text-white">Scan Pass</h2>
              <p className="text-xs text-[#a1a1a1]">Use handheld scanner or type pass number</p>
            </div>
            <button
              onClick={stopScanner}
              className="p-2 text-[#a1a1a1] hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scanner Input Area */}
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            {!scanResult ? (
              <div className="w-full max-w-md">
                <form onSubmit={handleScannerSubmit} className="space-y-4">
                  <div className="bg-[#1a1a1a] border-2 border-[#D4AF37] rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                        <ScanLine className="w-6 h-6 text-[#D4AF37]" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Ready to Scan</p>
                        <p className="text-[#a1a1a1] text-sm">Scanner input will appear below</p>
                      </div>
                    </div>

                    <input
                      ref={scannerInputRef}
                      type="text"
                      value={scannerInput}
                      onChange={(e) => setScannerInput(e.target.value)}
                      placeholder="Scan QR code or type pass number..."
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-[#666] font-mono text-lg focus:outline-none focus:border-[#D4AF37] transition-colors"
                      autoFocus
                      autoComplete="off"
                    />

                    <div className="flex items-center gap-2 mt-3 text-[#666] text-xs">
                      <Keyboard className="w-4 h-4" />
                      <span>Handheld scanners will auto-submit on Enter</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!scannerInput.trim() || isProcessingScan}
                    className="w-full py-3 px-4 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#B8960C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isProcessingScan ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Verify Pass
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-[#666] text-sm mt-6">
                  Scan a QR code or type the pass number (e.g., VLT-20241226-ABC12)
                </p>
              </div>
            ) : (
              <div className="w-full max-w-sm">
                {/* Scan Result Card */}
                <div className={`rounded-xl p-6 ${
                  scanResult.type === 'success' ? 'bg-green-500/10 border border-green-500/30' :
                  scanResult.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                  'bg-red-500/10 border border-red-500/30'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    {scanResult.type === 'success' ? (
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    ) : scanResult.type === 'warning' ? (
                      <AlertTriangle className="w-8 h-8 text-yellow-500" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-500" />
                    )}
                    <div>
                      <h3 className={`font-semibold ${
                        scanResult.type === 'success' ? 'text-green-500' :
                        scanResult.type === 'warning' ? 'text-yellow-500' :
                        'text-red-500'
                      }`}>
                        {scanResult.title}
                      </h3>
                      <p className="text-sm text-[#a1a1a1]">{scanResult.message}</p>
                    </div>
                  </div>

                  {scanResult.certificate && scanResult.type === 'success' && (
                    <div className="space-y-3 border-t border-[#333] pt-4 mt-4">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-[#D4AF37]" />
                        <span className="font-mono text-sm text-white">
                          {scanResult.certificate.certificate_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#666]" />
                        <span className="text-sm text-white">
                          {scanResult.certificate.profiles?.name || 'Customer'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#666]" />
                        <span className="text-sm text-white">
                          {scanResult.certificate.auctions?.packages?.name || 'Package'}
                        </span>
                      </div>
                      {/* Show discount prominently */}
                      {(() => {
                        const rv = scanResult.certificate.auctions?.packages?.retail_value || 0
                        const pp = scanResult.certificate.auctions?.current_price || 0
                        const disc = rv - pp
                        return disc > 0 ? (
                          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 text-center mt-2">
                            <p className="text-xs text-[#a1a1a1]">Apply in Dutchie POS</p>
                            <p className="text-2xl font-bold text-green-400">${disc.toFixed(2)} OFF</p>
                          </div>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-4 space-y-2">
                  {scanResult.type === 'success' && scanResult.certificate && (
                    <button
                      onClick={() => {
                        setSelectedCertificate(scanResult.certificate!)
                        setDutchieTransactionId('')
                        setShowScanner(false)
                      }}
                      className="w-full py-3 px-4 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#B8960C] transition-colors"
                    >
                      Process Order
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setScanResult(null)
                      setScannerInput('')
                      setTimeout(() => scannerInputRef.current?.focus(), 100)
                    }}
                    className="w-full py-3 px-4 bg-[#333] text-white font-medium rounded-lg hover:bg-[#444] transition-colors"
                  >
                    Scan Another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedCertificate && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#666]">
                  <Hash className="w-5 h-5" />
                  <span className="font-mono">
                    Certificate Hidden
                  </span>
                </div>
                <p className="text-xs text-[#666] mt-1">
                  Scan to verify &bull; Created {format(new Date(selectedCertificate.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <button
                onClick={() => setSelectedCertificate(null)}
                className="p-2 text-[#a1a1a1] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Status Badge */}
              {(() => {
                const status = (selectedCertificate.order_status || 'active') as TabType
                const config = TAB_CONFIG[status] || TAB_CONFIG.active
                const StatusIcon = config.icon
                return (
                  <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${config.bgClass} ${config.borderClass} border`}>
                    <StatusIcon className={`w-5 h-5 ${config.textClass}`} />
                    <span className={`font-medium ${config.textClass}`}>{config.label}</span>
                  </div>
                )
              })()}

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
                    <a
                      href={`tel:${selectedCertificate.profiles.phone}`}
                      className="text-sm text-[#D4AF37] flex items-center gap-2 hover:underline"
                    >
                      <Phone className="w-4 h-4" />
                      {selectedCertificate.profiles.phone}
                    </a>
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
                    {selectedCertificate.auctions.packages.items.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-[#a1a1a1]">{item.name}</span>
                        <span className="text-white font-medium">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discount Display - GIANT */}
              {(() => {
                const retailValue = selectedCertificate.auctions?.packages?.retail_value || 0
                const paidPrice = selectedCertificate.auctions?.current_price || 0
                const discount = retailValue - paidPrice
                return discount > 0 ? (
                  <div className="bg-green-500/10 border-2 border-green-500/40 rounded-xl p-6 text-center">
                    <p className="text-xs text-[#a1a1a1] uppercase tracking-wider mb-1">Apply This Discount in Dutchie</p>
                    <p className="text-5xl font-bold text-green-400">${discount.toFixed(2)}</p>
                    <p className="text-sm text-green-400/70 mt-1">OFF</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-green-500/20 text-sm">
                      <span className="text-[#a1a1a1]">Retail: ${retailValue.toFixed(2)}</span>
                      <span className="text-[#D4AF37] font-semibold">Customer Paid: ${paidPrice.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#0a0a0a] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#a1a1a1]">Total Paid</span>
                      <span className="text-xl font-bold text-[#D4AF37]">
                        ${paidPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Active pass instructions */}
              {selectedCertificate.order_status === 'active' && (
                <>
                  <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-lg p-3 flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[#D4AF37]">
                      Apply the discount in Dutchie POS, complete the transaction, then enter the Dutchie Transaction ID below.
                    </p>
                  </div>

                  {/* Dutchie Transaction ID Input */}
                  <div>
                    <label className="block text-sm text-[#a1a1a1] mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Dutchie Transaction ID <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={dutchieTransactionId}
                      onChange={(e) => setDutchieTransactionId(e.target.value)}
                      placeholder="Enter Dutchie POS transaction ID..."
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-[#666] font-mono focus:outline-none focus:border-[#D4AF37] transition-colors"
                    />
                  </div>
                </>
              )}

              {selectedCertificate.order_status === 'cancelled' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
                  <Ban className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-500 font-medium">
                    This claim expired and was cancelled.
                  </p>
                </div>
              )}

              {/* Dutchie TX ID for completed orders */}
              {selectedCertificate.order_status === 'redeemed' && selectedCertificate.dutchie_transaction_id && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-400">Dutchie Transaction</p>
                    <p className="text-sm text-white font-mono">{selectedCertificate.dutchie_transaction_id}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="sticky bottom-0 bg-[#1a1a1a] border-t border-[#333] p-4 space-y-2">
              {selectedCertificate.order_status === 'active' && (
                <button
                  onClick={() => completePickup(selectedCertificate.id, selectedCertificate.certificate_number)}
                  disabled={!dutchieTransactionId.trim()}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#F4D03F] to-[#B8960C] hover:from-[#D4AF37] hover:to-[#9a7b0a] text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Complete Pickup
                </button>
              )}
              {selectedCertificate.order_status === 'redeemed' && (
                <div className="text-center py-2">
                  <p className="text-sm text-green-500 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Order completed
                  </p>
                </div>
              )}
              {(selectedCertificate.order_status === 'cancelled' || selectedCertificate.order_status === 'expired') && (
                <div className="text-center py-2">
                  <p className="text-sm text-red-400">
                    This claim has expired
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
