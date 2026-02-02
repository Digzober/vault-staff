export interface Location {
  id: string
  name: string
  full_name: string
  slug: string
  address: string
  city: string
  state: string
  zip: string
  phone: string | null
  active: boolean
  staff_pin: string | null
  admin_pin: string | null
  created_at: string
}

export interface Certificate {
  id: string
  auction_id: string
  user_id: string
  certificate_number: string
  qr_code_data: string
  expires_at: string
  pickup_by: string | null
  redeemed_at: string | null
  redeemed_location: string | null
  voided: boolean
  voided_reason: string | null
  original_price: number | null
  final_price: number | null
  order_status: 'active' | 'redeemed' | 'expired' | 'cancelled' | null
  dutchie_transaction_id: string | null
  redeemed_by_staff: string | null
  created_at: string
  auctions?: {
    id: string
    current_price: number
    packages: {
      id: string
      name: string
      description: string
      retail_value: number
      items: { name: string; quantity: number }[]
    }
  }
  profiles?: {
    id: string
    name: string | null
    username: string | null
    phone: string | null
  }
}

export interface CancelledClaimsByLocation {
  location_id: string
  location_name: string
  location_full_name: string
  cancelled_count: number
  oldest_cancelled: string
}
