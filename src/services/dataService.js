import { supabase } from '../lib/supabaseClient'

// Default user ID for non-authenticated system
const DEFAULT_USER_ID = 'default-user-id';

// Packages service
export async function getPackages(userId = DEFAULT_USER_ID) {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  return { data, error }
}

export async function addPackage(packageData) {
  // Ensure user_id is set to default if not provided
  const packageWithDefaultUser = {
    ...packageData,
    user_id: packageData.user_id || DEFAULT_USER_ID
  };
  
  const { data, error } = await supabase
    .from('packages')
    .insert([packageWithDefaultUser])
    .select()
  
  return { data, error }
}

export async function verifyPackage(packageId, userId = DEFAULT_USER_ID) {
  const { data, error } = await supabase
    .from('packages')
    .update({ 
      verified: true, 
      verification_date: new Date().toISOString() 
    })
    .eq('id', packageId)
    .eq('user_id', userId)
    .select()
  
  return { data, error }
}

export async function deletePackage(packageId, userId = DEFAULT_USER_ID) {
  const { data, error } = await supabase
    .from('packages')
    .delete()
    .eq('id', packageId)
    .eq('user_id', userId)
  
  return { data, error }
}

// Goods list service
export async function getGoodsList(userId = DEFAULT_USER_ID) {
  const { data, error } = await supabase
    .from('goods_list')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  
  return { data, error }
}

export async function addGood(goodData) {
  // Ensure user_id is set to default if not provided
  const goodWithDefaultUser = {
    ...goodData,
    user_id: goodData.user_id || DEFAULT_USER_ID
  };
  
  const { data, error } = await supabase
    .from('goods_list')
    .insert([goodWithDefaultUser])
    .select()
  
  return { data, error }
}

export async function updateGood(goodId, updates, userId = DEFAULT_USER_ID) {
  const { data, error } = await supabase
    .from('goods_list')
    .update(updates)
    .eq('id', goodId)
    .eq('user_id', userId)
    .select()
  
  return { data, error }
}

// Sales history service
export async function getSalesHistory(userId = DEFAULT_USER_ID, startDate, endDate) {
  let query = supabase
    .from('sales_history')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
  
  if (startDate && endDate) {
    query = query
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
  }
  
  const { data, error } = await query
  
  return { data, error }
}

export async function addSale(saleData) {
  // Ensure user_id is set to default if not provided
  const saleWithDefaultUser = {
    ...saleData,
    user_id: saleData.user_id || DEFAULT_USER_ID
  };
  
  const { data, error } = await supabase
    .from('sales_history')
    .insert([saleWithDefaultUser])
    .select()
  
  return { data, error }
}

export async function refundOrder(orderId, userId = DEFAULT_USER_ID) {
  const { data, error } = await supabase
    .from('sales_history')
    .update({ status: 'refunded' })
    .eq('id', orderId)
    .eq('user_id', userId)
    .select()
  
  return { data, error }
}

// Sell prices service
export async function getSellPrices(userId = DEFAULT_USER_ID) {
  const { data, error } = await supabase
    .from('sell_prices')
    .select('*')
    .eq('user_id', userId)
  
  return { data, error }
}

export async function setSellPrice(priceData) {
  // Ensure user_id is set to default if not provided
  const priceWithDefaultUser = {
    ...priceData,
    user_id: priceData.user_id || DEFAULT_USER_ID
  };
  
  // Upsert - insert or update
  const { data, error } = await supabase
    .from('sell_prices')
    .upsert([priceWithDefaultUser], { onConflict: 'user_id,goods_name' })
    .select()
  
  return { data, error }
}