import { useForm } from '@tanstack/react-form'

import { reportBuilderFormSchema } from './consts'
import type { ReportBuilderFormValues } from './types'

export function useReportBuilderForm(
  defaultValues: ReportBuilderFormValues,
  onSubmit: (values: ReportBuilderFormValues) => void | Promise<void>,
) {
  return useForm({
    defaultValues,
    validators: { onChange: reportBuilderFormSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
}

export type ReportBuilderFormApi = ReturnType<typeof useReportBuilderForm>
