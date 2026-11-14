import { useEffect, useState } from 'react'
import { fetchAccountDetails, type AccountDetails } from '@/lib/octopus'

// Undefined while loading or if the request fails; the details are only ever shown, never relied on.
export function useAccountDetails(): AccountDetails | undefined {
  const [details, setDetails] = useState<AccountDetails>()

  useEffect(() => {
    const controller = new AbortController()
    fetchAccountDetails(controller.signal)
      .then(setDetails)
      .catch(() => {})
    return () => controller.abort()
  }, [])

  return details
}
