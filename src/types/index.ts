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
  claim_location_id: string | null
  voided: boolean
  original_price: number | null
  final_price: number | null
  available_for_pickup_at: string | null
  order_status: 'pending' | 'preparing' | 'ready' | 'picked_up'
  prepared_at: string | null
  picked_up_at: string | null
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
}
