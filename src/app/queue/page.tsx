'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
  AlertCircle,
  ScanLine,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Location, Certificate } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'

type TabType = 'pending' | 'preparing' | 'ready' | 'picked_up'

// Tab configuration with colors and labels
const TAB_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'yellow',
    bgClass: 'bg-yellow-500/10',
    textClass: 'text-yellow-500',
    borderClass: 'border-yellow-500/30',
    description: 'Awaiting preparation'
  },
  preparing: {
    label: 'Preparing',
    icon: ChefHat,
    color: 'blue',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-500',
    borderClass: 'border-blue-500/30',
    description: 'Being prepared'
  },
  ready: {
    label: 'Ready',
    icon: Package,
    color: 'green',
    bgClass: 'bg-green-500/10',
    textClass: 'text-green-500',
    borderClass: 'border-green-500/30',
    description: 'Ready for pickup'
  },
  picked_up: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'gray',
    bgClass: 'bg-[#333]',
    textClass: 'text-[#a1a1a1]',
    borderClass: 'border-[#333]',
    description: 'Picked up today'
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
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const router = useRouter()
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrCodeRef = useRef<any>(null)

  // Fetch certificates with proper error handling
  const fetchCertificates = useCallback(async (locationId: string) => {
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
          ),
          claim_location:claim_location_id (
            id,
            name,
            full_name
          )
        `)
        .or(`claim_location_id.is.null,claim_location_id.eq.${locationId}`)
        .is('voided', false)
        .is('redeemed_at', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      setCertificates(data || [])
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
    fetchCertificates(parsedLocation.id)

    // Set up realtime subscription with better event handling
    const channel = supabase
      .channel('certificates-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'certificates',
        },
        (payload) => {
          console.log('New certificate:', payload)
          fetchCertificates(parsedLocation.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'certificates',
        },
        (payload) => {
          console.log('Certificate updated:', payload)
          fetchCertificates(parsedLocation.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'certificates',
        },
        (payload) => {
          console.log('Certificate deleted:', payload)
          fetchCertificates(parsedLocation.id)
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, fetchCertificates])

  // Initialize QR Scanner
  const startScanner = async () => {
    setShowScanner(true)
    setScanResult(null)

    // Dynamically import to avoid SSR issues
    const { Html5Qrcode } = await import('html5-qrcode')

    setTimeout(async () => {
      if (scannerRef.current && !html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current = new Html5Qrcode('qr-reader')
          await html5QrCodeRef.current.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            handleQrScan,
            (errorMessage: string) => {
              // Ignore scan errors (no QR found)
            }
          )
        } catch (err) {
          console.error('Error starting scanner:', err)
          setScanResult({
            type: 'error',
            title: 'Camera Error',
            message: 'Unable to access camera. Please check permissions.'
          })
        }
      }
    }, 100)
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current = null
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
    }
    setShowScanner(false)
    setScanResult(null)
  }

  const handleQrScan = async (decodedText: string) => {
    // Stop scanner after successful scan
    if (html5QrCodeRef.current) {
      await html5QrCodeRef.current.stop()
      html5QrCodeRef.current = null
    }

    try {
      // Parse QR data
      let qrData: any
      try {
        qrData = JSON.parse(decodedText)
      } catch {
        // Try to extract certificate number from URL or plain text
        const certMatch = decodedText.match(/VLT-\d{8}-[A-Z0-9]{5}/i)
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
          ),
          claim_location:claim_location_id (
            id,
            name,
            full_name
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
      if (cert.redeemed_at) {
        setScanResult({
          type: 'error',
          title: 'Already Claimed',
          message: `This pass was already claimed on ${format(new Date(cert.redeemed_at), 'MMM d, yyyy')}`
        })
        return
      }

      // Check if voided
      if (cert.voided) {
        setScanResult({
          type: 'error',
          title: 'Pass Voided',
          message: cert.voided_reason || 'This pass has been voided.'
        })
        return
      }

      // Check if expired
      if (new Date(cert.expires_at) < new Date()) {
        setScanResult({
          type: 'error',
          title: 'Pass Expired',
          message: `This pass expired on ${format(new Date(cert.expires_at), 'MMM d, yyyy')}`
        })
        return
      }

      // Check location restriction
      const claimLocation = Array.isArray(cert.claim_location) ? cert.claim_location[0] : cert.claim_location

      if (cert.claim_location_id && cert.claim_location_id !== location?.id) {
        setScanResult({
          type: 'warning',
          title: 'Wrong Location',
          message: `This pass is assigned to ${claimLocation?.full_name || claimLocation?.name || 'another location'}. It cannot be claimed here.`,
          certificate: cert
        })
        return
      }

      // Success!
      setScanResult({
        type: 'success',
        title: 'Valid Pass',
        message: `Ready to process: ${cert.auctions?.packages?.name || 'Package'}`,
        certificate: cert
      })

    } catch (err) {
      console.error('QR scan error:', err)
      setScanResult({
        type: 'error',
        title: 'Scan Error',
        message: 'Unable to process QR code. Please try again.'
      })
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
        updates.redeemed_location = location?.full_name || location?.name
      }

      const { error } = await supabase
        .from('certificates')
        .update(updates)
        .eq('id', certificateId)

      if (error) throw error

      // Update will trigger realtime subscription, but also manually refresh
      if (location) {
        fetchCertificates(location.id)
      }
      setSelectedCertificate(null)
      setScanResult(null)
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

        {/* Status Tabs - More prominent */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-4 gap-2 pb-4">
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
            {TAB_CONFIG[activeTab].description} • {filteredCertificates.length} order{filteredCertificates.length !== 1 ? 's' : ''}
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
              return (
                <div
                  key={cert.id}
                  onClick={() => setSelectedCertificate(cert)}
                  className={`bg-[#1a1a1a] border rounded-xl p-4 cursor-pointer hover:border-[#D4AF37] transition-all ${tabConfig.borderClass}`}
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
              )
            })}
          </div>
        )}
      </main>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          {/* Scanner Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#333]">
            <div>
              <h2 className="text-lg font-semibold text-white">Scan Pass</h2>
              <p className="text-xs text-[#a1a1a1]">Point camera at QR code</p>
            </div>
            <button
              onClick={stopScanner}
              className="p-2 text-[#a1a1a1] hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scanner Area */}
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            {!scanResult ? (
              <div className="w-full max-w-sm">
                <div
                  id="qr-reader"
                  ref={scannerRef}
                  className="rounded-xl overflow-hidden"
                />
                <p className="text-center text-[#a1a1a1] text-sm mt-4">
                  Scanning for QR codes...
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
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-4 space-y-2">
                  {scanResult.type === 'success' && scanResult.certificate && (
                    <button
                      onClick={() => {
                        setSelectedCertificate(scanResult.certificate!)
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
                      startScanner()
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
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Status Badge */}
              {(() => {
                const status = (selectedCertificate.order_status || 'pending') as TabType
                const config = TAB_CONFIG[status]
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

              {/* Pricing */}
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#a1a1a1]">Total Paid</span>
                  <span className="text-xl font-bold text-[#D4AF37]">
                    ${selectedCertificate.final_price?.toFixed(2) || selectedCertificate.original_price?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>

              {/* Status-specific messages */}
              {(selectedCertificate.order_status || 'pending') === 'pending' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-500">
                    This order is waiting to be prepared. Start preparing when you're ready.
                  </p>
                </div>
              )}

              {selectedCertificate.order_status === 'ready' && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-500">
                    Order is ready! Complete pickup when customer arrives.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="sticky bottom-0 bg-[#1a1a1a] border-t border-[#333] p-4 space-y-2">
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
