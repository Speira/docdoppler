import { useNavigate } from '@tanstack/react-router'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PatientCreateHelper } from './PatientCreateHelper'
import { PatientEditorFrame } from './PatientEditorFrame'
import { PatientListHelper } from './PatientListHelper'
import { getPatientFormDefaultValues } from './consts'
import { usePatientForm } from './usePatientForm'
import { usePatientUnsavedGuard } from './usePatientUnsavedGuard'
import { apiErrorMessage } from '#/services/patient-service'

export function PatientCreate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Set just before the post-save navigation so the unsaved-changes guard
  // doesn't challenge a departure we asked for ourselves.
  const bypassUnsavedGuard = useRef(false)

  const form = usePatientForm(getPatientFormDefaultValues(), async (values) => {
    try {
      const id = await PatientCreateHelper.createPatient(values)
      toast.success(
        PatientListHelper.formatFullName({
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
        }),
        { description: t('Patient enregistré') },
      )
      bypassUnsavedGuard.current = true
      navigate({ to: '/patients/$patientId', params: { patientId: String(id) } })
    } catch (error) {
      toast.error(t('Échec de l’enregistrement'), {
        description: t(apiErrorMessage(error)),
      })
    }
  })

  const guard = usePatientUnsavedGuard(form, bypassUnsavedGuard)

  return (
    <PatientEditorFrame
      form={form}
      guard={guard}
      eyebrow={t('Nouveau dossier')}
      title={t('Nouveau patient')}
      subtitle={t("Renseignez l'identité et les antécédents, puis enregistrez.")}
      discard={{
        onConfirm: () => form.reset(),
        title: t('Réinitialiser le formulaire ?'),
        description: t(
          'Le formulaire sera vidé et les informations saisies seront perdues.',
        ),
        cancelLabel: t('Continuer la saisie'),
        confirmLabel: t('Réinitialiser'),
      }}
      leave={{
        title: t('Quitter sans enregistrer ?'),
        description: t(
          "Ce patient n'a pas encore été enregistré. Les informations saisies seront perdues si vous quittez.",
        ),
        cancelLabel: t('Rester sur la page'),
        confirmLabel: t('Quitter sans enregistrer'),
      }}
    />
  )
}
