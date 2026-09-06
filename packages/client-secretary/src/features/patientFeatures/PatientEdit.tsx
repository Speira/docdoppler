import { Link, useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  Eye,
  FilePlus,
  FileText,
  LoaderCircle,
  Trash2,
} from 'lucide-react'
import { Suspense, use, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PatientEditHelper } from './PatientEditHelper'
import { PatientEditorFrame } from './PatientEditorFrame'
import { PatientListHelper } from './PatientListHelper'
import { usePatientForm } from './usePatientForm'
import { usePatientUnsavedGuard } from './usePatientUnsavedGuard'
import type { PatientFormValues } from './types'
import { apiErrorMessage } from '#/services/patient-service'
import {
  reportApiErrorMessage,
  reportService,
} from '#/services/report-service'
import type { ReportPage } from '#/services/report-service'
import { formatSex } from '#/lib/sex'
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

type Translate = ReturnType<typeof useTranslation>['t']

export function PatientEdit({
  id,
  patientPromise,
  reportsPromise,
}: {
  id: number
  patientPromise: Promise<PatientFormValues>
  reportsPromise: Promise<ReportPage>
}) {
  return (
    <Suspense fallback={<PatientEditSkeleton />}>
      <PatientEditForm
        id={id}
        patientPromise={patientPromise}
        reportsPromise={reportsPromise}
      />
    </Suspense>
  )
}

function PatientEditSkeleton() {
  return (
    <div className="page-wrap space-y-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="h-3 w-24 animate-pulse rounded-md bg-secondary" />
          <div className="mt-2 h-9 w-64 animate-pulse rounded-md bg-secondary" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded-md bg-secondary" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded-md bg-secondary" />
      </div>
      <div className="h-28 animate-pulse rounded-2xl bg-secondary" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-2xl bg-secondary" />
        <div className="h-96 animate-pulse rounded-2xl bg-secondary" />
      </div>
    </div>
  )
}

function PatientEditForm({
  id,
  patientPromise,
  reportsPromise,
}: {
  id: number
  patientPromise: Promise<PatientFormValues>
  reportsPromise: Promise<ReportPage>
}) {
  const loadedValues = use(patientPromise)
  const reportPage = use(reportsPromise)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [baseline, setBaseline] = useState(loadedValues)
  const [deleting, setDeleting] = useState(false)
  // Set just before a deliberate departure (after a delete) so the
  // unsaved-changes guard doesn't challenge it.
  const bypassUnsavedGuard = useRef(false)

  const form = usePatientForm(baseline, async (values) => {
    try {
      await PatientEditHelper.updatePatient(id, values)
      setBaseline(values)
      form.reset(values)
      toast.success(
        PatientListHelper.formatFullName({
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
        }),
        { description: t('Patient mis à jour') },
      )
    } catch (error) {
      toast.error(t('Échec de la mise à jour'), {
        description: t(apiErrorMessage(error)),
      })
    }
  })

  const guard = usePatientUnsavedGuard(form, bypassUnsavedGuard)

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
    <PatientEditorFrame
      form={form}
      guard={guard}
      eyebrow={t('Fiche patient')}
      // The saved name, not the live field value: the page title should not
      // rewrite itself letter by letter while the name is being corrected.
      title={PatientListHelper.formatFullName(baseline)}
      subtitle={
        <>
          {t('Dossier n° {{id}}', { id })}
          {' · '}
          {t('{{dob}} · {{age}} ans · {{sex}}', {
            dob: PatientListHelper.formatDate(baseline.dob),
            age: PatientListHelper.calculateAge(baseline.dob),
            sex: formatSex(baseline.sex, t),
          })}
        </>
      }
      afterForm={<ReportHistory patientId={id} initialPage={reportPage} t={t} />}
      dangerAction={
        <DeletePatientButton
          patientName={PatientListHelper.formatFullName(baseline)}
          reportCount={reportPage.total}
          deleting={deleting}
          onDelete={handleDelete}
          t={t}
        />
      }
      discard={{
        onConfirm: () => form.reset(baseline),
        title: t('Annuler les modifications ?'),
        description: t(
          'Les champs seront réinitialisés à leur dernière valeur enregistrée.',
        ),
        cancelLabel: t('Continuer la saisie'),
        confirmLabel: t('Réinitialiser'),
      }}
      leave={{
        title: t('Quitter sans enregistrer ?'),
        description: t(
          'Ces modifications seront perdues si vous quittez cette fiche sans enregistrer.',
        ),
        cancelLabel: t('Rester sur la page'),
        confirmLabel: t('Quitter sans enregistrer'),
      }}
    />
  )
}

/**
 * Deleting a patient cascades: `risk_factors`, then `reports`, then each
 * report's `report_arteries` (see api-gateway's schema.sql). The trigger names
 * the patient rather than saying a bare "Supprimer", and the confirmation
 * spells out the reports that go with it — the panel below this bar lists them,
 * so leaving them unmentioned would imply they survive.
 */
function DeletePatientButton({
  patientName,
  reportCount,
  deleting,
  onDelete,
  t,
}: {
  patientName: string
  reportCount: number
  deleting: boolean
  onDelete: () => void
  t: Translate
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="btn-danger-quiet"
          disabled={deleting}
        >
          <Trash2 />
          {t('Supprimer le patient')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('Supprimer définitivement le patient {{name}} ?', {
              name: patientName,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {reportCount === 0
              ? t(
                  'Cette action est irréversible : la fiche patient et ses antécédents seront définitivement supprimés.',
                )
              : t(
                  'Cette action est irréversible : la fiche patient, ses antécédents et ses {{total}} rapport{{plural}} seront définitivement supprimés.',
                  {
                    total: reportCount,
                    plural: PatientListHelper.pluralSuffix(reportCount),
                  },
                )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={deleting}
            onClick={onDelete}
          >
            <Trash2 />
            {t('Supprimer le patient')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ReportHistory({
  patientId,
  initialPage,
  t,
}: {
  patientId: number
  initialPage: ReportPage
  t: Translate
}) {
  const [reports, setReports] = useState(initialPage.items)
  const [total, setTotal] = useState(initialPage.total)
  const [loadingMore, setLoadingMore] = useState(false)
  // A second guard next to `disabled`: a double-click can fire twice before
  // React has re-rendered the button as disabled.
  const inFlight = useRef(false)
  // Fixed at mount, so the live region below stays mounted after the last
  // page loads and can still announce the final count.
  const [initialCount] = useState(initialPage.items.length)

  const hasMore = PatientEditHelper.hasMoreReports(reports.length, total)
  const showPager = total > initialCount

  const loadMore = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setLoadingMore(true)
    try {
      const page = await PatientEditHelper.loadMoreReports(patientId, reports.length)
      setReports((loaded) => PatientEditHelper.appendReports(loaded, page.items))
      setTotal(page.total)
    } catch (error) {
      toast.error(t('Échec du chargement des rapports'), {
        description: t(reportApiErrorMessage(error)),
      })
    } finally {
      inFlight.current = false
      setLoadingMore(false)
    }
  }

  return (
    <section
      aria-labelledby="patient-reports-title"
      className="island-shell overflow-hidden rounded-2xl"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b p-4"
        style={{ borderColor: 'var(--line)' }}
      >
        <div>
          <h2 id="patient-reports-title" className="island-kicker">
            {t('Historique des rapports')}
          </h2>
          <p className="row-meta mt-1 text-sm">
            {total === 0
              ? t('Aucun rapport pour ce patient.')
              : t('{{total}} rapport{{plural}} enregistré{{plural}}', {
                  total,
                  plural: PatientListHelper.pluralSuffix(total),
                })}
          </p>
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link
            to="/reports/$patientId"
            params={{ patientId: String(patientId) }}
          >
            <FilePlus />
            {t('Nouveau rapport')}
          </Link>
        </Button>
      </div>

      {reports.length === 0 ? (
        <p className="row-meta flex items-center gap-2 px-4 py-6 text-sm">
          <FileText aria-hidden="true" className="h-4 w-4" />
          {t('Le premier compte rendu apparaîtra ici une fois rédigé.')}
        </p>
      ) : (
        <ul>
          {reports.map((report) => (
            <li
              key={report.id}
              className="report-row flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold tabular-nums">
                  {t('Examen du {{date}}', {
                    date: PatientListHelper.formatDate(report.exam_date),
                  })}
                </p>
                <p className="row-meta text-xs tabular-nums">
                  {t('Rédigé le {{date}}', {
                    date: PatientEditHelper.formatReportDate(report.created_at),
                  })}
                </p>
              </div>
              <Button asChild size="sm" variant="secondary">
                <a
                  href={reportService.reportPdfUrl(report.id)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t('Voir le rapport (nouvel onglet)')}
                >
                  <Eye />
                  {t('Voir le rapport')}
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {showPager && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t p-3"
          style={{ borderColor: 'var(--line)' }}
        >
          <p className="row-meta text-xs" role="status" aria-live="polite">
            {t('{{shown}} rapport{{plural}} affiché{{plural}} sur {{total}}', {
              shown: reports.length,
              plural: PatientListHelper.pluralSuffix(reports.length),
              total,
            })}
          </p>
          {hasMore && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={loadMore}
              disabled={loadingMore}
              aria-busy={loadingMore}
            >
              {loadingMore ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  {t('Chargement des rapports…')}
                </>
              ) : (
                <>
                  <ChevronDown />
                  {t('Voir plus de rapports ({{remaining}} restants)', {
                    remaining: PatientEditHelper.remainingReportCount(
                      reports.length,
                      total,
                    ),
                  })}
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
