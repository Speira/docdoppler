import { useBlocker } from '@tanstack/react-router'

import type { PatientFormApi } from './usePatientForm'

/**
 * Blocks navigation (and the browser's own unload) while the patient form
 * holds unsaved edits.
 *
 * `bypass` stays owned by the calling screen: after a deliberate save or
 * delete we navigate away on purpose, and the guard must not challenge that.
 * The ref is set synchronously just before `navigate()`, so `shouldBlockFn`
 * already sees it when the router asks.
 */
export function usePatientUnsavedGuard(
  form: PatientFormApi,
  bypass: { current: boolean },
) {
  return useBlocker({
    shouldBlockFn: () => !bypass.current && form.state.isDirty,
    enableBeforeUnload: true,
    withResolver: true,
  })
}

export type PatientUnsavedGuard = ReturnType<typeof usePatientUnsavedGuard>
