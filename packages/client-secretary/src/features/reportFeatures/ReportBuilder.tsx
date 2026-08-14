import { Link } from '@tanstack/react-router'
import { Suspense, use, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { RISK_FACTOR_KEYS, RISK_FACTOR_LABELS } from '@speira-docdoppler/shared-labels'

import { ReportBuilderHelper } from './ReportBuilderHelper'
import { reportVesselFields } from './consts'
import { useReportBuilderForm } from './useReportBuilderForm'
import { reportApiErrorMessage, reportService } from '#/services/report-service'
import type { PatientWithRiskFactors } from '#/services/patient-service'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'

export function ReportBuilder({
  patientId,
  patientPromise,
}: {
  patientId: number
  patientPromise: Promise<PatientWithRiskFactors>
}) {
  return (
    <Suspense fallback={<ReportBuilderSkeleton />}>
      <ReportBuilderView patientId={patientId} patientPromise={patientPromise} />
    </Suspense>
  )
}

function ReportBuilderSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="page-wrap py-8">
      <p className="text-muted-foreground">{t('Chargement du dossier…')}</p>
    </div>
  )
}

function ReportBuilderView({
  patientId,
  patientPromise,
}: {
  patientId: number
  patientPromise: Promise<PatientWithRiskFactors>
}) {
  const patient = use(patientPromise)
  const { t } = useTranslation()
  const [reportId, setReportId] = useState<number | null>(null)

  const form = useReportBuilderForm(
    ReportBuilderHelper.defaultValuesFor(patient),
    async (values) => {
      try {
        const id = await ReportBuilderHelper.createReport(patientId, values)
        setReportId(id)
        toast.success(t('Rapport généré'))
      } catch (error) {
        toast.error(t('Échec de la génération du rapport'), {
          description: t(reportApiErrorMessage(error)),
        })
      }
    },
  )

  const activeRiskFactors = RISK_FACTOR_KEYS.filter(
    (key) => patient.riskFactors?.[key] === 1,
  )

  return (
    <div className="page-wrap space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display-title text-3xl font-bold text-primary">
            {t('Rapport')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {patient.last_name.toUpperCase()} {patient.first_name}
          </p>
        </div>
        <Link to="/reports">
          <Button type="button" variant="outline">
            {t('Retour')}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-primary">{t('Identité et antécédents')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {t('Date de naissance')} : {patient.dob} (
            {patient.sex === 'F' ? t('Féminin') : t('Masculin')})
          </p>
          <p>
            {t('Antécédents')} :{' '}
            {activeRiskFactors.length === 0
              ? t('aucun')
              : activeRiskFactors.map((key) => t(RISK_FACTOR_LABELS[key])).join(', ')}
          </p>
        </CardContent>
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">{t('Rapport')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="doctor_name">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>
                      {t('Médecin')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={!field.state.meta.isValid}
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="exam_date">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>
                      {t("Date de l'examen")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="date"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={!field.state.meta.isValid}
                    />
                  </div>
                )}
              </form.Field>
            </div>

            {reportVesselFields.map(({ key, label, textField, abnormalField }) => (
              <div key={key} className="grid gap-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label>{t(label)}</Label>
                  <form.Field name={abnormalField}>
                    {(field) => (
                      <label className="flex items-center gap-2 text-sm">
                        {t('Anormal')}
                        <Switch
                          checked={field.state.value as boolean}
                          onCheckedChange={(v) => field.handleChange(v)}
                        />
                      </label>
                    )}
                  </form.Field>
                </div>
                <form.Field name={textField}>
                  {(field) => (
                    <Textarea
                      value={field.state.value as string}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('Constatations…')}
                    />
                  )}
                </form.Field>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end gap-2">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? t('Génération…') : t('Générer le rapport')}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>

      {reportId !== null && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm">{t('Rapport généré avec succès.')}</p>
            <a href={reportService.reportPdfUrl(reportId)} target="_blank" rel="noreferrer">
              <Button type="button" variant="outline">
                {t('Ouvrir le PDF')}
              </Button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
