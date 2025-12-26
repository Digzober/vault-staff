-- Add staff_pin to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS staff_pin VARCHAR(6) DEFAULT '1234';

-- Add order tracking columns to certificates table
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS order_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
