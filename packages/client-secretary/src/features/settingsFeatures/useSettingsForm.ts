import { useForm } from '@tanstack/react-form'

import { settingsFormSchema } from './consts'
import type { SettingsFormValues } from './types'

export function useSettingsForm(
  defaultValues: SettingsFormValues,
  onSubmit: (values: SettingsFormValues) => void | Promise<void>,
) {
  return useForm({
    defaultValues,
    validators: { onChange: settingsFormSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
}

export type SettingsFormApi = ReturnType<typeof useSettingsForm>
