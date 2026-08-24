import { Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Save } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PatientCreateHelper } from './PatientCreateHelper'
import { PatientForm } from './PatientForm'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { usePatientForm } from './usePatientForm'
import { getPatientFormDefaultValues } from './consts'
import { apiErrorMessage } from '#/services/patient-service'
import { Button } from '#/components/ui/button'

export function PatientCreate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const bypassUnsavedGuard = useRef(false)

  const form = usePatientForm(getPatientFormDefaultValues(), async (values) => {
    try {
      const id = await PatientCreateHelper.createPatient(values)
      toast.success(
        `${values.last_name.trim().toUpperCase()} ${values.first_name.trim()}`,
        { description: t('Patient enregistré') },
      )
      bypassUnsavedGuard.current = true
      navigate({ to: '/patients/add', search: { id } })
    } catch (error) {
      toast.error(t('Échec de l’enregistrement'), {
        description: t(apiErrorMessage(error)),
      })
    }
  })

  const blocker = useBlocker({
    shouldBlockFn: () => !bypassUnsavedGuard.current && form.state.isDirty,
    enableBeforeUnload: true,
    withResolver: true,
  })

  return (
    <div className="page-wrap space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display-title text-3xl font-bold text-primary">
            {t('Secrétariat')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Enregistrer un nouveau patient.')}
          </p>
        </div>
        <Link to="/patients">
          <Button type="button" variant="outline">
            <ArrowLeft />
            {t('Retour')}
          </Button>
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <PatientForm form={form} />

        <div className="mt-6 flex justify-end gap-2">
          <form.Subscribe selector={(state) => state.isDirty}>
            {(isDirty) => (
              <Button
                type="button"
                variant="outline"
                disabled={!isDirty}
                onClick={() => setConfirmDiscard(true)}
              >
                {t('Annuler')}
              </Button>
            )}
          </form.Subscribe>
          <form.Subscribe
            selector={(state) =>
              [state.canSubmit, state.isSubmitting, state.isDirty] as const
            }
          >
            {([canSubmit, isSubmitting, isDirty]) => (
              <Button
                type="submit"
                disabled={!canSubmit || !isDirty}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save />
                {isSubmitting ? t('Enregistrement…') : t('Enregistrer')}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>

      <UnsavedChangesDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        onConfirm={() => {
          form.reset()
          setConfirmDiscard(false)
        }}
        title={t('Réinitialiser le formulaire ?')}
        description={t(
          'Le formulaire sera vidé et les informations saisies seront perdues.',
        )}
        cancelLabel={t('Continuer la saisie')}
        confirmLabel={t('Réinitialiser')}
      />
      <UnsavedChangesDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
        onConfirm={() => blocker.proceed?.()}
        title={t('Quitter sans enregistrer ?')}
        description={t(
          "Ce patient n'a pas encore été enregistré. Les informations saisies seront perdues si vous quittez.",
        )}
        cancelLabel={t('Rester sur la page')}
        confirmLabel={t('Quitter sans enregistrer')}
      />
    </div>
  )
}
