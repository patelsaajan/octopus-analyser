import { useEffect, useState } from 'react'
import { fetchAccountNumber } from '@/lib/octopus'

// Undefined while loading or if the request fails; the account number is only ever shown, never relied on.
export function useAccountNumber(): string | undefined {
  const [accountNumber, setAccountNumber] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    fetchAccountNumber(controller.signal)
      .then(setAccountNumber)
      .catch(() => {})
    return () => controller.abort()
  }, [])

  return accountNumber
}
