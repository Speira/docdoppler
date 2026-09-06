import { Link } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'
import { Fragment, Suspense, use, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  RISK_FACTOR_KEYS,
  RISK_FACTOR_LABELS,
  REPORT_SECTION_LABELS,
  REPORT_FIELD_LABELS,
  MI_ARTERY_KEYS,
  MI_ARTERY_LABELS,
  MI_SIDES,
  MI_SIDE_LABELS,
  SPECTRE_OPTIONS,
} from '@speira-docdoppler/shared-labels'
import type { MiSide } from '@speira-docdoppler/shared-labels'

import { ReportBuilderHelper } from './ReportBuilderHelper'
import { computeIpsPreview, isPressureOutOfRange } from './ips'
import { useReportBuilderForm } from './useReportBuilderForm'
import { arterySpectreKey, arteryVsmKey } from './types'
import type { ReportBuilderFormApi } from './useReportBuilderForm'
import type { ReportBuilderFormValues } from './types'
import { reportApiErrorMessage, reportService } from '#/services/report-service'
import type { PatientWithRiskFactors } from '#/services/patient-service'
import type { ClinicSettingsRecord } from '#/services/settings-service'
import { formatDateFR } from '#/lib/date'
import { formatSex } from '#/lib/sex'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'

// A field label is either a single French string or the parts of a composite
// one ("Artère poplitée — Gauche — Spectre"): in the membres inférieurs matrix
// the artery name and the side live in the table headers, so each control
// carries the full, unambiguous wording in a visually-hidden <Label>.
type FieldLabel = string | Array<string>

function useFieldLabel(label: FieldLabel): string {
  const { t } = useTranslation()
  return Array.isArray(label)
    ? label.map((part) => t(part)).join(' — ')
    : t(label)
}

function fieldErrorMessage(errors: unknown[]): string {
  return errors
    .map((error) =>
      typeof error === 'string'
        ? error
        : (error as { message: string }).message,
    )
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
  )
}

function NumberField({
  form,
  name,
  label,
  className,
  labelClassName,
}: {
  form: ReportBuilderFormApi
  name: keyof ReportBuilderFormValues
  label: FieldLabel
  className?: string
  labelClassName?: string
}) {
  const labelText = useFieldLabel(label)
  return (
    <form.Field name={name}>
      {(field) => (
        <div className={cn('grid content-start gap-2', className)}>
          <Label htmlFor={field.name} className={labelClassName}>
            {labelText}
          </Label>
          <Input
            id={field.name}
            name={field.name}
            type="number"
            step="any"
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
  )
}

// Radix Select throws on an empty SelectItem value, so "not examined" travels
// as a sentinel and is converted back to '' at the form-state boundary.
const SPECTRE_NONE = '__none__'

function SpectreField({
  form,
  name,
  label,
  className,
  labelClassName,
}: {
  form: ReportBuilderFormApi
  name: keyof ReportBuilderFormValues
  label: FieldLabel
  className?: string
  labelClassName?: string
}) {
  const { t } = useTranslation()
  const labelText = useFieldLabel(label)
  return (
    <form.Field name={name}>
      {(field) => (
        <div className={cn('grid content-start gap-2', className)}>
          <Label htmlFor={field.name} className={labelClassName}>
            {labelText}
          </Label>
          <Select
            value={field.state.value === '' ? SPECTRE_NONE : field.state.value}
            onValueChange={(value) =>
              field.handleChange(value === SPECTRE_NONE ? '' : value)
            }
          >
            <SelectTrigger id={field.name} className="w-full">
              <SelectValue placeholder={t('Non examinée')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SPECTRE_NONE}>{t('Non examinée')}</SelectItem>
              {SPECTRE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </form.Field>
  )
}

function PressureField({
  form,
  name,
  label,
  className,
  labelClassName,
}: {
  form: ReportBuilderFormApi
  name: keyof ReportBuilderFormValues
  label: FieldLabel
  className?: string
  labelClassName?: string
}) {
  const { t } = useTranslation()
  const labelText = useFieldLabel(label)
  return (
    <form.Field name={name}>
      {(field) => {
        const value = field.state.value
        const outOfRange =
          field.state.meta.isValid && isPressureOutOfRange(value)
        return (
          <div className={cn('grid content-start gap-2', className)}>
            <Label htmlFor={field.name} className={labelClassName}>
              {labelText}
            </Label>
            <Input
              id={field.name}
              name={field.name}
              type="number"
              step="any"
              value={value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={!field.state.meta.isValid}
              aria-describedby={
                !field.state.meta.isValid
                  ? `${field.name}-error`
                  : outOfRange
                    ? `${field.name}-warning`
                    : undefined
              }
            />
            {!field.state.meta.isValid && (
              <p
                id={`${field.name}-error`}
                className="text-sm text-destructive"
              >
                {fieldErrorMessage(field.state.meta.errors)}
              </p>
            )}
            {outOfRange && (
              <p
                id={`${field.name}-warning`}
                className="text-sm text-amber-600 dark:text-amber-500"
              >
                {t('Valeur inhabituelle — vérifier la saisie')}
              </p>
            )}
          </div>
        )
      }}
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
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder={t('Constatations…')}
          />
        </div>
      )}
    </form.Field>
  )
}

// The whole membres inférieurs card is one Droite | Gauche comparison table:
// pressures, the calculated IPS and the six artery spectres all sit on the same
// three columns (measure — droite — gauche), so the two values the doctor
// actually compares are always side by side on one line. Below `sm` the grid
// collapses to a single column and each control shows its full label instead.
const MI_MATRIX_GRID =
  'grid gap-x-4 sm:grid-cols-[minmax(8rem,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]'
const MI_HEAD_CELL =
  'hidden px-2 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:block'
const MI_ROW_LABEL =
  'hidden min-w-0 items-center border-t px-2 py-2.5 text-sm font-medium sm:flex'
const MI_CELL = 'min-w-0 border-t px-2 py-2.5'
// A continuous faint band down the Gauche column: laterality is the error this
// form has to make impossible, and a tint reads faster than a repeated word.
const MI_SIDE_TINT: Record<MiSide, string> = {
  droite: '',
  gauche: 'bg-muted/40',
}
const MI_IPS_FIELD_KEYS: Record<MiSide, 'mi_ips_droit' | 'mi_ips_gauche'> = {
  droite: 'mi_ips_droit',
  gauche: 'mi_ips_gauche',
}

function MiMatrixHead() {
  const { t } = useTranslation()
  return (
    <>
      <div className={MI_HEAD_CELL} />
      {MI_SIDES.map((side) => (
        <div key={side} className={cn(MI_HEAD_CELL, MI_SIDE_TINT[side])}>
          {t(MI_SIDE_LABELS[side])}
        </div>
      ))}
    </>
  )
}

function IpsPreview({ form }: { form: ReportBuilderFormApi }) {
  const { t } = useTranslation()
  return (
    <form.Subscribe
      selector={(state) =>
        [
          state.values.mi_pression_cheville_droite,
          state.values.mi_pression_cheville_gauche,
          state.values.mi_pression_bras_droit,
          state.values.mi_pression_bras_gauche,
        ] as const
      }
    >
      {([chevilleDroite, chevilleGauche, brasDroit, brasGauche]) => {
        const ips: Record<MiSide, number | null> = {
          droite: computeIpsPreview(chevilleDroite, brasDroit, brasGauche),
          gauche: computeIpsPreview(chevilleGauche, brasDroit, brasGauche),
        }
        return (
          <>
            <div className={cn(MI_ROW_LABEL, 'font-semibold')}>
              {t('IPS (calculé)')}
            </div>
            {MI_SIDES.map((side) => (
              <p
                key={side}
                className={cn(MI_CELL, MI_SIDE_TINT[side], 'text-sm')}
              >
                <span className="sm:sr-only">
                  {t(REPORT_FIELD_LABELS[MI_IPS_FIELD_KEYS[side]])} :{' '}
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {ips[side] ?? '—'}
                </span>
              </p>
            ))}
          </>
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
        <Link to="/patients">
          <Button type="button" variant="outline">
            <ArrowLeft />
            {t('Retour')}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-primary">
            {t('Identité et antécédents')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {t('Date de naissance')} : {formatDateFR(patient.dob)} (
            {formatSex(patient.sex, t)})
          </p>
          <p>
            {t('Antécédents')} :{' '}
            {activeRiskFactors.length === 0
              ? t('aucun')
              : activeRiskFactors
                  .map((key) => t(RISK_FACTOR_LABELS[key]))
                  .join(', ')}
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
              <TextField
                form={form}
                name="doctor_name"
                label="Médecin"
                required
              />
              <form.Field name="exam_date">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>
                      {t("Date de l'examen")}{' '}
                      <span className="text-destructive">*</span>
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
                        !field.state.meta.isValid
                          ? `${field.name}-error`
                          : undefined
                      }
                    />
                    {!field.state.meta.isValid && (
                      <p
                        id={`${field.name}-error`}
                        className="text-sm text-destructive"
                      >
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
            <CardTitle className="text-primary">
              {t(REPORT_SECTION_LABELS.tsa)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                form={form}
                name="tsa_imt_droit"
                label={REPORT_FIELD_LABELS.tsa_imt_droit}
              />
              <NumberField
                form={form}
                name="tsa_imt_gauche"
                label={REPORT_FIELD_LABELS.tsa_imt_gauche}
              />
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
              <NumberField
                form={form}
                name="aorte_diametre"
                label={REPORT_FIELD_LABELS.aorte_diametre}
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
          <CardContent className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                {t('Pressions systoliques')}
              </h3>
              <div className={MI_MATRIX_GRID}>
                <MiMatrixHead />
                <div className={MI_ROW_LABEL}>{t('Cheville (mmHg)')}</div>
                <PressureField
                  form={form}
                  name="mi_pression_cheville_droite"
                  label={REPORT_FIELD_LABELS.mi_pression_cheville_droite}
                  className={cn(MI_CELL, MI_SIDE_TINT.droite)}
                  labelClassName="sm:sr-only"
                />
                <PressureField
                  form={form}
                  name="mi_pression_cheville_gauche"
                  label={REPORT_FIELD_LABELS.mi_pression_cheville_gauche}
                  className={cn(MI_CELL, MI_SIDE_TINT.gauche)}
                  labelClassName="sm:sr-only"
                />
                <div className={MI_ROW_LABEL}>{t('Bras (mmHg)')}</div>
                <PressureField
                  form={form}
                  name="mi_pression_bras_droit"
                  label={REPORT_FIELD_LABELS.mi_pression_bras_droit}
                  className={cn(MI_CELL, MI_SIDE_TINT.droite)}
                  labelClassName="sm:sr-only"
                />
                <PressureField
                  form={form}
                  name="mi_pression_bras_gauche"
                  label={REPORT_FIELD_LABELS.mi_pression_bras_gauche}
                  className={cn(MI_CELL, MI_SIDE_TINT.gauche)}
                  labelClassName="sm:sr-only"
                />
                <IpsPreview form={form} />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                {t('Spectre par artère')}
              </h3>
              <div className={MI_MATRIX_GRID}>
                <MiMatrixHead />
                {MI_ARTERY_KEYS.map((artery) => (
                  <Fragment key={artery}>
                    <div className={MI_ROW_LABEL}>
                      {t(MI_ARTERY_LABELS[artery])}
                    </div>
                    {MI_SIDES.map((side) => (
                      <SpectreField
                        key={side}
                        form={form}
                        name={arterySpectreKey(side, artery)}
                        label={[
                          MI_ARTERY_LABELS[artery],
                          MI_SIDE_LABELS[side],
                          'Spectre',
                        ]}
                        className={cn(MI_CELL, MI_SIDE_TINT[side])}
                        labelClassName="sm:sr-only"
                      />
                    ))}
                    {artery === 'afc' && (
                      <>
                        <div
                          className={cn(
                            MI_ROW_LABEL,
                            'text-muted-foreground sm:border-t-0 sm:pt-0 sm:pl-6',
                          )}
                        >
                          {t('VSM (cm/s)')}
                        </div>
                        {MI_SIDES.map((side) => (
                          <NumberField
                            key={side}
                            form={form}
                            name={arteryVsmKey(side)}
                            label={['VSM à l’AFC (cm/s)', MI_SIDE_LABELS[side]]}
                            className={cn(
                              MI_CELL,
                              MI_SIDE_TINT[side],
                              'sm:border-t-0 sm:pt-0',
                            )}
                            labelClassName="sm:sr-only"
                          />
                        ))}
                      </>
                    )}
                  </Fragment>
                ))}
              </div>
            </section>

            <TextAreaField
              form={form}
              name="mi_findings_text"
              label={REPORT_FIELD_LABELS.mi_findings_text}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">
              {t(REPORT_FIELD_LABELS.conclusion)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form.Field name="conclusion">
              {(field) => (
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('Résumé de l’examen…')}
                />
              )}
            </form.Field>
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
                <FileText />
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
            <a
              href={reportService.reportPdfUrl(reportId)}
              target="_blank"
              rel="noreferrer"
            >
              <Button type="button" variant="outline">
                <ExternalLink />
                {t('Ouvrir le PDF')}
              </Button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
