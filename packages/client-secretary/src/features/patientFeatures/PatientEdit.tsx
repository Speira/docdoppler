import { Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { Suspense, use, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PatientEditHelper } from './PatientEditHelper'
import { PatientForm } from './PatientForm'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { usePatientForm } from './usePatientForm'
import type { PatientFormValues } from './types'
import { apiErrorMessage } from '#/services/patient-service'
import { Button } from '#/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'

export function PatientEdit({
  id,
  patientPromise,
}: {
  id: number
  patientPromise: Promise<PatientFormValues>
}) {
  return (
    <Suspense fallback={<PatientEditSkeleton />}>
      <PatientEditForm id={id} patientPromise={patientPromise} />
    </Suspense>
  )
}

function PatientEditSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="page-wrap py-8">
      <p className="text-muted-foreground">{t('Chargement du dossier…')}</p>
    </div>
  )
}

function PatientEditForm({
  id,
  patientPromise,
}: {
  id: number
  patientPromise: Promise<PatientFormValues>
}) {
  const loadedValues = use(patientPromise)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [baseline, setBaseline] = useState(loadedValues)
  const [deleting, setDeleting] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const form = usePatientForm(baseline, async (values) => {
    try {
      await PatientEditHelper.updatePatient(id, values)
      setBaseline(values)
      form.reset(values)
      toast.success(
        `${values.last_name.trim().toUpperCase()} ${values.first_name.trim()}`,
        { description: t('Patient mis à jour') },
      )
    } catch (error) {
      toast.error(t('Échec de la mise à jour'), {
        description: t(apiErrorMessage(error)),
      })
    }
  })

  const bypassUnsavedGuard = useRef(false)

  const blocker = useBlocker({
    shouldBlockFn: () => !bypassUnsavedGuard.current && form.state.isDirty,
    enableBeforeUnload: true,
    withResolver: true,
  })

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await PatientEditHelper.deletePatient(id)
      toast.success(t('Patient supprimé'))
      bypassUnsavedGuard.current = true
      navigate({ to: '/patients' })
    } catch (error) {
      toast.error(t('Échec de la suppression'), {
        description: t(apiErrorMessage(error)),
      })
      setDeleting(false)
    }
  }

  return (
    <div className="page-wrap space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display-title text-3xl font-bold text-primary">
            {t('Secrétariat')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Dossier n° {{id}} — modifier la fiche patient.', { id })}
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

        <div className="mt-6 flex justify-between gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={deleting}>
                <Trash2 />
                {t('Supprimer')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('Supprimer ce patient ?')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    'Cette action est irréversible et supprimera définitivement la fiche patient et ses antécédents.',
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  <Trash2 />
                  {t('Supprimer')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
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
        </div>
      </form>

      <UnsavedChangesDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        onConfirm={() => {
          form.reset(baseline)
          setConfirmDiscard(false)
        }}
        title={t('Annuler les modifications ?')}
        description={t(
          'Les champs seront réinitialisés à leur dernière valeur enregistrée.',
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
          'Ces modifications seront perdues si vous quittez cette fiche sans enregistrer.',
        )}
        cancelLabel={t('Rester sur la page')}
        confirmLabel={t('Quitter sans enregistrer')}
      />
    </div>
  )
}
