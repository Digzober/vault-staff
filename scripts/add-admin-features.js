#!/usr/bin/env node

const { Client } = require('pg');

const connectionString = 'postgresql://postgres:R3edalert24!@db.dxbilfoedqhuohevlalu.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to database!');

  // 1. Add admin_pin column to locations
  console.log('\n1. Adding admin_pin column to locations...');
  await client.query(`
    ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS admin_pin VARCHAR(6) DEFAULT '0000';
  `);
  console.log('Added admin_pin column!');

  // 2. Add cancelled status and inventory_returned to certificates
  console.log('\n2. Adding cancelled status fields to certificates...');
  await client.query(`
    -- Add inventory_returned field
    ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS inventory_returned BOOLEAN DEFAULT false;

    -- Add inventory_returned_at timestamp
    ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS inventory_returned_at TIMESTAMPTZ;

    -- Add inventory_returned_by (staff location name)
    ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS inventory_returned_by TEXT;

    -- Add cancelled_at timestamp (for when auto-cancelled)
    ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

    -- Add admin_assigned_at (when admin marks it for staff to prepare)
    ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS admin_assigned_at TIMESTAMPTZ;

    -- Add admin_notes for any admin comments
    ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS admin_notes TEXT;
  `);
  console.log('Added cancelled status fields!');

  // 3. Create function to auto-cancel expired certificates
  console.log('\n3. Creating auto-cancel function...');
  await client.query(`
    CREATE OR REPLACE FUNCTION auto_cancel_expired_certificates()
    RETURNS INTEGER AS $$
    DECLARE
      cancelled_count INTEGER;
    BEGIN
      -- Update expired, unclaimed certificates to cancelled status
      UPDATE certificates
      SET
        order_status = 'cancelled',
        cancelled_at = NOW()
      WHERE
        expires_at < NOW()
        AND redeemed_at IS NULL
        AND voided = false
        AND (order_status IS NULL OR order_status NOT IN ('cancelled', 'picked_up'));

      GET DIAGNOSTICS cancelled_count = ROW_COUNT;
      RETURN cancelled_count;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
  console.log('Created auto_cancel_expired_certificates function!');

  // 4. Create function to get pending cancelled claims by location
  console.log('\n4. Creating get_pending_cancelled_claims function...');
  await client.query(`
    CREATE OR REPLACE FUNCTION get_pending_cancelled_claims_by_location()
    RETURNS TABLE (
      location_id UUID,
      location_name TEXT,
      location_full_name TEXT,
      cancelled_count BIGINT,
      oldest_cancelled TIMESTAMPTZ
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        l.id as location_id,
        l.name as location_name,
        l.full_name as location_full_name,
        COUNT(c.id) as cancelled_count,
        MIN(c.cancelled_at) as oldest_cancelled
      FROM locations l
      LEFT JOIN certificates c ON (
        c.claim_location_id = l.id
        AND c.order_status = 'cancelled'
        AND c.inventory_returned = false
      )
      WHERE l.active = true
      GROUP BY l.id, l.name, l.full_name
      HAVING COUNT(c.id) > 0
      ORDER BY COUNT(c.id) DESC;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
  console.log('Created get_pending_cancelled_claims_by_location function!');

  // 5. Create function to get all new winning drops (for admin)
  console.log('\n5. Creating get_new_winning_drops function...');
  await client.query(`
    CREATE OR REPLACE FUNCTION get_new_winning_drops()
    RETURNS TABLE (
      certificate_id UUID,
      certificate_number TEXT,
      user_id UUID,
      customer_name TEXT,
      customer_phone TEXT,
      package_name TEXT,
      package_items JSONB,
      final_price NUMERIC,
      created_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      claim_location_id UUID,
      claim_location_name TEXT,
      order_status TEXT,
      admin_assigned_at TIMESTAMPTZ
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        c.id as certificate_id,
        c.certificate_number,
        c.user_id,
        COALESCE(p.name, p.username) as customer_name,
        p.phone as customer_phone,
        pkg.name as package_name,
        pkg.items as package_items,
        c.final_price,
        c.created_at,
        c.expires_at,
        c.claim_location_id,
        COALESCE(l.full_name, l.name) as claim_location_name,
        COALESCE(c.order_status, 'new') as order_status,
        c.admin_assigned_at
      FROM certificates c
      LEFT JOIN profiles p ON c.user_id = p.id
      LEFT JOIN auctions a ON c.auction_id = a.id
      LEFT JOIN packages pkg ON a.package_id = pkg.id
      LEFT JOIN locations l ON c.claim_location_id = l.id
      WHERE c.voided = false
        AND c.redeemed_at IS NULL
        AND c.expires_at > NOW()
      ORDER BY c.created_at DESC;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
  console.log('Created get_new_winning_drops function!');

  // 6. Verify the changes
  console.log('\n6. Verifying new columns in locations...');
  const locCols = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'locations'
    AND column_name = 'admin_pin'
  `);
  console.table(locCols.rows);

  console.log('\n7. Verifying new columns in certificates...');
  const certCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'certificates'
    AND column_name IN ('inventory_returned', 'inventory_returned_at', 'inventory_returned_by', 'cancelled_at', 'admin_assigned_at', 'admin_notes')
    ORDER BY column_name
  `);
  console.table(certCols.rows);

  // 8. Run the auto-cancel function once to cancel any already expired
  console.log('\n8. Running initial auto-cancel for expired certificates...');
  const result = await client.query('SELECT auto_cancel_expired_certificates()');
  console.log(`Auto-cancelled ${result.rows[0].auto_cancel_expired_certificates} expired certificates`);

  await client.end();
  console.log('\nDone! Admin features database setup complete.');
}

run().catch(console.error);
