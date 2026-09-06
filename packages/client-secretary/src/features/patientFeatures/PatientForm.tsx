import { useTranslation } from 'react-i18next'

import { patientHistoryFieldGroups } from './consts'
import { PatientListHelper } from './PatientListHelper'
import type { PatientFormApi } from './usePatientForm'
import type { Sex } from '#/services/patient-service'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'

type Translate = ReturnType<typeof useTranslation>['t']

const riskFactorKeys = patientHistoryFieldGroups.flatMap((group) =>
  group.fields.map((field) => field.key),
)

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'F', label: 'Féminin' },
  { value: 'M', label: 'Masculin' },
  { value: 'O', label: 'Autre' },
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Validation messages are French strings, so they double as their own key. */
function fieldErrorText(errors: ReadonlyArray<unknown>, t: Translate): string {
  return errors
    .map((error) => (error as { message?: string } | undefined)?.message)
    .filter((message): message is string => Boolean(message))
    .map((message) => t(message))
    .join(', ')
}

export function PatientForm({ form }: { form: PatientFormApi }) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="patient-identity-title"
        className="island-shell @container rounded-2xl p-5 lg:p-6"
      >
        <h2 id="patient-identity-title" className="island-kicker">
          {t('Identité')}
        </h2>

        <div className="mt-4 grid gap-4 @md:grid-cols-2">
          <form.Field name="first_name">
            {(field) => {
              const showError =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>
                    {t('Prénom')} <RequiredMark t={t} />
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    autoComplete="off"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={!field.state.meta.isValid}
                    aria-describedby={showError ? `${field.name}-error` : undefined}
                  />
                  {showError && (
                    <p id={`${field.name}-error`} className="text-sm text-destructive">
                      {fieldErrorText(field.state.meta.errors, t)}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          <form.Field name="last_name">
            {(field) => {
              const showError =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>
                    {t('Nom')} <RequiredMark t={t} />
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    autoComplete="off"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={!field.state.meta.isValid}
                    aria-describedby={showError ? `${field.name}-error` : undefined}
                  />
                  {showError && (
                    <p id={`${field.name}-error`} className="text-sm text-destructive">
                      {fieldErrorText(field.state.meta.errors, t)}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          <form.Field name="dob">
            {(field) => {
              const showError =
                field.state.meta.isTouched && !field.state.meta.isValid
              const age = field.state.value
                ? PatientListHelper.calculateAge(field.state.value)
                : null
              const showMinorWarning =
                field.state.meta.isValid && age !== null && age < 18
              return (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>
                    {t('Date de naissance')} <RequiredMark t={t} />
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="date"
                    max={today()}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={!field.state.meta.isValid}
                    aria-describedby={showError ? `${field.name}-error` : undefined}
                  />
                  {showError && (
                    <p id={`${field.name}-error`} className="text-sm text-destructive">
                      {fieldErrorText(field.state.meta.errors, t)}
                    </p>
                  )}
                  {!showError && age !== null && field.state.meta.isValid && (
                    <p
                      className={
                        showMinorWarning
                          ? 'text-sm text-amber-700'
                          : 'row-meta text-sm'
                      }
                    >
                      {showMinorWarning
                        ? t('Patient mineur ({{age}} ans)', { age })
                        : t('{{age}} ans', { age })}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          <form.Field name="exam_date">
            {(field) => {
              const showError =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>
                    {t("Date de l'examen")} <RequiredMark t={t} />
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="date"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={!field.state.meta.isValid}
                    aria-describedby={showError ? `${field.name}-error` : undefined}
                  />
                  {showError && (
                    <p id={`${field.name}-error`} className="text-sm text-destructive">
                      {fieldErrorText(field.state.meta.errors, t)}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          <form.Field name="sex">
            {(field) => (
              <div className="grid gap-2 @md:col-span-2">
                {/* A <span> rather than a <label>: the group is labelled through
                    aria-labelledby, since a label with no single control to
                    point at is meaningless to a screen reader. */}
                <span
                  id="patient-sex-label"
                  className="text-sm leading-none font-medium"
                >
                  {t('Sexe')}
                </span>
                <RadioGroup
                  aria-labelledby="patient-sex-label"
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as Sex)}
                  className="flex flex-wrap gap-x-6 gap-y-2"
                >
                  {SEX_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-center gap-2">
                      <RadioGroupItem
                        id={`sex-${option.value.toLowerCase()}`}
                        value={option.value}
                      />
                      <Label
                        htmlFor={`sex-${option.value.toLowerCase()}`}
                        className="font-normal"
                      >
                        {t(option.label)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </form.Field>
        </div>

        <p className="row-meta mt-5 text-xs">
          <span className="text-destructive">*</span> {t('champ requis')}
        </p>
      </section>

      <section
        aria-labelledby="patient-history-title"
        className="island-shell @container rounded-2xl p-5 lg:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="patient-history-title" className="island-kicker">
            {t('Antécédents médicaux')}
          </h2>
          <form.Subscribe
            selector={(state) =>
              riskFactorKeys.filter((key) => state.values[key]).length
            }
          >
            {(selected) => (
              <span
                className={
                  selected > 0
                    ? 'status-chip status-chip--ready'
                    : 'status-chip status-chip--pending'
                }
              >
                {selected > 0
                  ? t('{{selected}} antécédent{{plural}} coché{{plural}}', {
                      selected,
                      plural: PatientListHelper.pluralSuffix(selected),
                    })
                  : t('Aucun antécédent coché')}
              </span>
            )}
          </form.Subscribe>
        </div>

        <div className="mt-4 space-y-5">
          {patientHistoryFieldGroups.map((group) => (
            <fieldset key={group.title}>
              <legend className="row-meta mb-2 text-xs font-semibold">
                {t(group.title)}
              </legend>
              <div className="grid gap-2 @md:grid-cols-2">
                {group.fields.map(({ key, label }) => (
                  <form.Field key={key} name={key}>
                    {(field) => (
                      <label className="risk-toggle">
                        <Checkbox
                          checked={field.state.value as boolean}
                          onCheckedChange={(v) => field.handleChange(v === true)}
                        />
                        <span className="text-sm font-medium">{t(label)}</span>
                      </label>
                    )}
                  </form.Field>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </section>
    </div>
  )
}

function RequiredMark({ t }: { t: Translate }) {
  return (
    <span className="text-destructive" title={t('champ requis')}>
      *
    </span>
  )
}
