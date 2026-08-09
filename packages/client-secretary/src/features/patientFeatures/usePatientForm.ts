import { useForm } from '@tanstack/react-form'

import { patientFormSchema } from './consts'
import type { PatientFormValues } from './types'

export function usePatientForm(
  defaultValues: PatientFormValues,
  onSubmit: (values: PatientFormValues) => void | Promise<void>,
) {
  return useForm({
    defaultValues,
    validators: { onChange: patientFormSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
}

export type PatientFormApi = ReturnType<typeof usePatientForm>
