import { Link } from '@tanstack/react-router'
import { Suspense, use, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  RISK_FACTOR_KEYS,
  RISK_FACTOR_LABELS,
  REPORT_SECTION_LABELS,
  REPORT_FIELD_LABELS,
} from '@speira-docdoppler/shared-labels'

import { ReportBuilderHelper } from './ReportBuilderHelper'
import { computeIpsPreview } from './ips'
import { useReportBuilderForm } from './useReportBuilderForm'
import type { ReportBuilderFormApi } from './useReportBuilderForm'
import type { ReportBuilderFormValues } from './types'
import { reportApiErrorMessage, reportService } from '#/services/report-service'
import type { PatientWithRiskFactors } from '#/services/patient-service'
import type { ClinicSettingsRecord } from '#/services/settings-service'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'

function fieldErrorMessage(errors: unknown[]): string {
  return errors
    .map((error) => (typeof error === 'string' ? error : (error as { message: string }).message))
    .join(', ')
}

export function ReportBuilder({
  patientId,
  patientPromise,
  settingsPromise,
}: {
  patientId: number
  patientPromise: Promise<PatientWithRiskFactors>
  settingsPromise: Promise<ClinicSettingsRecord>
}) {
  return (
    <Suspense fallback={<ReportBuilderSkeleton />}>
      <ReportBuilderView
        patientId={patientId}
        patientPromise={patientPromise}
        settingsPromise={settingsPromise}
      />
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

function TextField({
  form,
  name,
  label,
  required,
}: {
  form: ReportBuilderFormApi
  name: keyof ReportBuilderFormValues
  label: string
  required?: boolean
}) {
  const { t } = useTranslation()
  return (
    <form.Field name={name}>
      {(field) => (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>
            {t(label)} {required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id={field.name}
            name={field.name}
            value={field.state.value as string}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            aria-invalid={!field.state.meta.isValid}
            aria-describedby={!field.state.meta.isValid ? `${field.name}-error` : undefined}
          />
          {!field.state.meta.isValid && (
            <p id={`${field.name}-error`} className="text-sm text-destructive">
              {fieldErrorMessage(field.state.meta.errors)}
            </p>
          )}
        </div>
      )}
    </form.Field>
  )
}

function NumberField({
  form,
  name,
  label,
}: {
  form: ReportBuilderFormApi
  name: keyof ReportBuilderFormValues
  label: string
}) {
  const { t } = useTranslation()
  return (
    <form.Field name={name}>
      {(field) => (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>{t(label)}</Label>
          <Input
            id={field.name}
            name={field.name}
            type="number"
            step="any"
            value={field.state.value as string}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            aria-invalid={!field.state.meta.isValid}
            aria-describedby={!field.state.meta.isValid ? `${field.name}-error` : undefined}
          />
          {!field.state.meta.isValid && (
            <p id={`${field.name}-error`} className="text-sm text-destructive">
              {fieldErrorMessage(field.state.meta.errors)}
            </p>
          )}
        </div>
      )}
    </form.Field>
  )
}

function TextAreaField({
  form,
  name,
  label,
}: {
  form: ReportBuilderFormApi
  name: keyof ReportBuilderFormValues
  label: string
}) {
  const { t } = useTranslation()
  return (
    <form.Field name={name}>
      {(field) => (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>{t(label)}</Label>
          <Textarea
            id={field.name}
            value={field.state.value as string}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder={t('Constatations…')}
          />
        </div>
      )}
    </form.Field>
  )
}

function IpsPreview({ form }: { form: ReportBuilderFormApi }) {
  const { t } = useTranslation()
  return (
    <form.Subscribe
      selector={(state) => [
        state.values.mi_pression_cheville_droite,
        state.values.mi_pression_cheville_gauche,
        state.values.mi_pression_bras_droit,
        state.values.mi_pression_bras_gauche,
      ] as const}
    >
      {([chevilleDroite, chevilleGauche, brasDroit, brasGauche]) => {
        const ipsDroit = computeIpsPreview(chevilleDroite, brasDroit, brasGauche)
        const ipsGauche = computeIpsPreview(chevilleGauche, brasDroit, brasGauche)
        return (
          <div className="grid gap-1 rounded-md bg-muted p-3 text-sm sm:grid-cols-2">
            <p>
              {t(REPORT_FIELD_LABELS.mi_ips_droit)} :{' '}
              <span className="font-semibold">{ipsDroit ?? '—'}</span>
            </p>
            <p>
              {t(REPORT_FIELD_LABELS.mi_ips_gauche)} :{' '}
              <span className="font-semibold">{ipsGauche ?? '—'}</span>
            </p>
          </div>
        )
      }}
    </form.Subscribe>
  )
}

function ReportBuilderView({
  patientId,
  patientPromise,
  settingsPromise,
}: {
  patientId: number
  patientPromise: Promise<PatientWithRiskFactors>
  settingsPromise: Promise<ClinicSettingsRecord>
}) {
  const patient = use(patientPromise)
  const settings = use(settingsPromise)
  const { t } = useTranslation()
  const [reportId, setReportId] = useState<number | null>(null)

  const form = useReportBuilderForm(
    ReportBuilderHelper.defaultValuesFor(patient, settings),
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
        onSubmit={async (e) => {
          e.preventDefault()
          e.stopPropagation()
          await form.handleSubmit()
          if (!form.state.isValid) {
            toast.error(t('Formulaire incomplet'), {
              description: t(
                'Certains champs sont invalides ou manquants — faites défiler vers le haut pour les corriger.',
              ),
            })
          }
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">{t('Rapport')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField form={form} name="doctor_name" label="Médecin" required />
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
                      aria-describedby={
                        !field.state.meta.isValid ? `${field.name}-error` : undefined
                      }
                    />
                    {!field.state.meta.isValid && (
                      <p id={`${field.name}-error`} className="text-sm text-destructive">
                        {fieldErrorMessage(field.state.meta.errors)}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
              <TextField
                form={form}
                name="correspondant_dossier"
                label={REPORT_FIELD_LABELS.correspondant_dossier}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">{t(REPORT_FIELD_LABELS.indication)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.state.values.indication}
              onChange={(e) => form.setFieldValue('indication', e.target.value)}
              placeholder={t('Motif de l’examen…')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">{t(REPORT_SECTION_LABELS.tsa)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField form={form} name="tsa_imt_droit" label={REPORT_FIELD_LABELS.tsa_imt_droit} />
              <NumberField form={form} name="tsa_imt_gauche" label={REPORT_FIELD_LABELS.tsa_imt_gauche} />
              <NumberField
                form={form}
                name="tsa_aci_acc_ratio_droit"
                label={REPORT_FIELD_LABELS.tsa_aci_acc_ratio_droit}
              />
              <NumberField
                form={form}
                name="tsa_aci_acc_ratio_gauche"
                label={REPORT_FIELD_LABELS.tsa_aci_acc_ratio_gauche}
              />
            </div>
            <TextAreaField
              form={form}
              name="tsa_findings_text"
              label={REPORT_FIELD_LABELS.tsa_findings_text}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">
              {t(REPORT_SECTION_LABELS.aorte_abdominale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                form={form}
                name="aorte_diametre"
                label={REPORT_FIELD_LABELS.aorte_diametre}
              />
              <form.Field name="aorte_anevrisme">
                {(field) => (
                  <label className="flex items-center gap-2 text-sm">
                    {t(REPORT_FIELD_LABELS.aorte_anevrisme)}
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={(v) => field.handleChange(v)}
                    />
                  </label>
                )}
              </form.Field>
              <NumberField
                form={form}
                name="aorte_anevrisme_diametre_mm"
                label={REPORT_FIELD_LABELS.aorte_anevrisme_diametre_mm}
              />
            </div>
            <TextAreaField
              form={form}
              name="aorte_findings_text"
              label={REPORT_FIELD_LABELS.aorte_findings_text}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">
              {t(REPORT_SECTION_LABELS.membres_inferieurs)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                form={form}
                name="mi_pression_cheville_droite"
                label={REPORT_FIELD_LABELS.mi_pression_cheville_droite}
              />
              <NumberField
                form={form}
                name="mi_pression_cheville_gauche"
                label={REPORT_FIELD_LABELS.mi_pression_cheville_gauche}
              />
              <NumberField
                form={form}
                name="mi_pression_bras_droit"
                label={REPORT_FIELD_LABELS.mi_pression_bras_droit}
              />
              <NumberField
                form={form}
                name="mi_pression_bras_gauche"
                label={REPORT_FIELD_LABELS.mi_pression_bras_gauche}
              />
            </div>
            <IpsPreview form={form} />
            <TextAreaField
              form={form}
              name="mi_findings_text"
              label={REPORT_FIELD_LABELS.mi_findings_text}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">{t(REPORT_FIELD_LABELS.conclusion)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.state.values.conclusion}
              onChange={(e) => form.setFieldValue('conclusion', e.target.value)}
              placeholder={t('Résumé de l’examen…')}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                disabled={isSubmitting}
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
