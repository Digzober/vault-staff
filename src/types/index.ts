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
  redeemed_at: string | null
  redeemed_location: string | null
  claim_location_id: string | null
  voided: boolean
  voided_reason: string | null
  original_price: number | null
  final_price: number | null
  available_for_pickup_at: string | null
  order_status: 'pending' | 'preparing' | 'ready' | 'picked_up' | 'cancelled' | null
  prepared_at: string | null
  picked_up_at: string | null
  cancelled_at: string | null
  admin_assigned_at: string | null
  admin_notes: string | null
  inventory_returned: boolean
  inventory_returned_at: string | null
  inventory_returned_by: string | null
  created_at: string
  auctions?: {
    id: string
    packages: {
      id: string
      name: string
      description: string
      items: { name: string; quantity: number }[]
    }
  }
  profiles?: {
    id: string
    name: string | null
    username: string | null
    phone: string | null
  }
  claim_location?: {
    id: string
    name: string
    full_name: string
  }
}

export interface CancelledClaimsByLocation {
  location_id: string
  location_name: string
  location_full_name: string
  cancelled_count: number
  oldest_cancelled: string
}
