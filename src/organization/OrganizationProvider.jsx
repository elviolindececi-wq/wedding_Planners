import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../auth/AuthProvider.jsx'

const OrganizationContext = createContext(null)

export function OrganizationProvider({ children }) {
  const { user } = useAuth()
  const [organization, setOrganization] = useState(null)
  const [membership, setMembership] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!user || !supabase) {
      setOrganization(null)
      setMembership(null)
      setSubscription(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    if (!member) {
      setOrganization(null)
      setMembership(null)
      setSubscription(null)
      setLoading(false)
      return
    }

    const [{ data: org, error: orgError }, { data: plan, error: planError }] = await Promise.all([
      supabase.from('organizations').select('id, name, slug').eq('id', member.organization_id).single(),
      supabase.from('subscriptions').select('plan_code, status, current_period_start, current_period_end').eq('organization_id', member.organization_id).maybeSingle(),
    ])

    if (orgError || planError) {
      setError(orgError?.message || planError?.message)
      setLoading(false)
      return
    }

    setMembership(member)
    setOrganization(org)
    setSubscription(plan ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  const value = useMemo(() => ({ organization, membership, subscription, loading, error, refresh }), [organization, membership, subscription, loading, error, refresh])

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

export function useOrganization() {
  const value = useContext(OrganizationContext)
  if (!value) throw new Error('useOrganization debe usarse dentro de OrganizationProvider.')
  return value
}
