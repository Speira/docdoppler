import { useTranslation } from 'react-i18next'

import { patientHistoryFieldGroups } from './consts'
import { PatientListHelper } from './PatientListHelper'
import type { PatientFormApi } from './usePatientForm'
import type { Sex } from '#/services/patient-service'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'

const riskFactorKeys = patientHistoryFieldGroups.flatMap((group) =>
  group.fields.map((field) => field.key),
)

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PatientForm({ form }: { form: PatientFormApi }) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-primary">{t('Identité')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="first_name">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>
                  {t('Prénom')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={!field.state.meta.isValid}
                />
                {field.state.meta.isTouched && !field.state.meta.isValid && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors
                      .map((error) =>
                        error?.message ? t(error.message) : error?.message,
                      )
                      .join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="last_name">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>
                  {t('Nom')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={!field.state.meta.isValid}
                />
                {field.state.meta.isTouched && !field.state.meta.isValid && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors
                      .map((error) =>
                        error?.message ? t(error.message) : error?.message,
                      )
                      .join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="dob">
            {(field) => {
              const age = field.state.value
                ? PatientListHelper.calculateAge(field.state.value)
                : null
              const showMinorWarning =
                field.state.meta.isValid && age !== null && age < 18
              return (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>
                    {t('Date de naissance')}{' '}
                    <span className="text-destructive">*</span>
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
                  />
                  {field.state.meta.isTouched && !field.state.meta.isValid && (
                    <p className="text-sm text-destructive">
                      {field.state.meta.errors
                        .map((error) =>
                          error?.message ? t(error.message) : error?.message,
                        )
                        .join(', ')}
                    </p>
                  )}
                  {showMinorWarning && (
                    <p className="text-sm text-amber-600 dark:text-amber-500">
                      {t('Patient mineur ({{age}} ans)', { age })}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

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
                />
                {field.state.meta.isTouched && !field.state.meta.isValid && (
                  <p className="text-sm text-destructive">
                    {field.state.meta.errors
                      .map((error) =>
                        error?.message ? t(error.message) : error?.message,
                      )
                      .join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="sex">
            {(field) => (
              <div className="grid gap-2">
                <Label>{t('Sexe')}</Label>
                <RadioGroup
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as Sex)}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="sex-f" value="F" />
                    <Label htmlFor="sex-f" className="font-normal">
                      {t('Féminin')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="sex-m" value="M" />
                    <Label htmlFor="sex-m" className="font-normal">
                      {t('Masculin')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </form.Field>
          <br />
          <p className="text-xs text-muted-foreground">
            <span className="text-destructive">*</span> {t('champ requis')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-primary">
            <span>{t('Antécédents médicaux')}</span>
            <form.Subscribe
              selector={(state) =>
                riskFactorKeys.filter((key) => state.values[key]).length
              }
            >
              {(count) => (
                <span className="text-sm font-normal text-muted-foreground">
                  {t('{{count}} sélectionné(s)', { count })}
                </span>
              )}
            </form.Subscribe>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {patientHistoryFieldGroups.map((group) => (
            <div key={group.title} className="grid gap-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                {t(group.title)}
              </h3>
              {group.fields.map(({ key, label }) => (
                <form.Field key={key} name={key}>
                  {(field) => (
                    <label className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-secondary/50">
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
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
