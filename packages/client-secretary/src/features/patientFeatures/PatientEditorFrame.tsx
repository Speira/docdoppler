import { Link } from '@tanstack/react-router'
import { ArrowLeft, Save } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PatientForm } from './PatientForm'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import type { PatientEditorDialogCopy } from './types'
import type { PatientFormApi } from './usePatientForm'
import type { PatientUnsavedGuard } from './usePatientUnsavedGuard'
import { Button } from '#/components/ui/button'

/**
 * Everything the create and edit screens share: the page header, the form
 * itself, the action bar and both confirmation dialogs. The two screens differ
 * only in their copy, in what they do on submit, and in the extras they slot
 * in (`afterForm` carries the report history, `dangerAction` the delete
 * button) — so those are the only props, and the chrome cannot drift apart
 * between them again.
 *
 * Order is header → form → action bar → `afterForm`. Delete lives *in* the
 * action bar rather than in a strip of its own further down: a destructive
 * button placed after the report history reads as though it might delete the
 * reports, when it actually destroys the whole record (patients → risk_factors
 * and → reports → report_arteries are all ON DELETE CASCADE). Sitting inside
 * the form's own bar, between the fields above and the read-only history
 * below, it can only be understood as acting on the record being edited.
 *
 * Within the bar the destructive action is pinned far left, away from
 * Enregistrer, but rendered last in the DOM so keyboard focus reaches it only
 * after both safe actions — tabbing out of the last field must not land on it.
 */
export function PatientEditorFrame({
  form,
  eyebrow,
  title,
  subtitle,
  guard,
  discard,
  leave,
  afterForm,
  dangerAction,
}: {
  form: PatientFormApi
  eyebrow: string
  title: string
  subtitle: React.ReactNode
  guard: PatientUnsavedGuard
  discard: PatientEditorDialogCopy & { onConfirm: () => void }
  leave: PatientEditorDialogCopy
  afterForm?: React.ReactNode
  dangerAction?: React.ReactNode
}) {
  const { t } = useTranslation()
  // The "reset the form" confirmation is pure chrome, so the frame owns it;
  // the screens only supply the copy and what resetting means for them.
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const actionsLabel = t('Actions sur la fiche patient')

  return (
    <div className="page-wrap space-y-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="island-kicker">{eyebrow}</p>
          <h1 className="display-title mt-1.5 text-3xl font-bold text-primary">
            {title}
          </h1>
          <p className="row-meta mt-1 text-sm">{subtitle}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/patients">
            <ArrowLeft />
            {t('Retour à la liste')}
          </Link>
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <PatientForm form={form} />

        <div
          role="group"
          aria-label={actionsLabel}
          className="form-actionbar island-shell mt-6 flex flex-wrap items-center justify-end gap-3 rounded-2xl p-3"
        >
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isDirty] as const}
          >
            {([canSubmit, isDirty]) =>
              !canSubmit && isDirty ? (
                <p className="text-sm text-destructive" role="status">
                  {t('Complétez les champs requis pour enregistrer.')}
                </p>
              ) : null
            }
          </form.Subscribe>
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
                <Button type="submit" disabled={!canSubmit || !isDirty}>
                  <Save />
                  {isSubmitting ? t('Enregistrement…') : t('Enregistrer')}
                </Button>
              )}
            </form.Subscribe>
          </div>
          {/* Last in the DOM, first on screen: `order-first` keeps it visually
              separated from Enregistrer while `mr-auto` holds the gap open. */}
          {dangerAction && (
            <div className="order-first mr-auto">{dangerAction}</div>
          )}
        </div>
      </form>

      {afterForm}

      <UnsavedChangesDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        onConfirm={() => {
          discard.onConfirm()
          setConfirmDiscard(false)
        }}
        title={discard.title}
        description={discard.description}
        cancelLabel={discard.cancelLabel}
        confirmLabel={discard.confirmLabel}
      />
      <UnsavedChangesDialog
        open={guard.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) guard.reset?.()
        }}
        onConfirm={() => guard.proceed?.()}
        title={leave.title}
        description={leave.description}
        cancelLabel={leave.cancelLabel}
        confirmLabel={leave.confirmLabel}
      />
    </div>
  )
}
