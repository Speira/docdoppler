import { Save } from 'lucide-react'
import { Suspense, use } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SettingsHelper } from './SettingsHelper'
import { useSettingsForm } from './useSettingsForm'
import type { SettingsFormApi } from './useSettingsForm'
import type { SettingsFormValues } from './types'
import { settingsApiErrorMessage } from '#/services/settings-service'
import type { ClinicSettingsRecord } from '#/services/settings-service'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

function fieldErrorMessage(errors: unknown[]): string {
  return errors
    .map((error) => (typeof error === 'string' ? error : (error as { message: string }).message))
    .join(', ')
}

function TextField({
  form,
  name,
  label,
  type = 'text',
}: {
  form: SettingsFormApi
  name: keyof SettingsFormValues
  label: string
  type?: string
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
            type={type}
            value={field.state.value}
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

export function SettingsForm({
  settingsPromise,
}: {
  settingsPromise: Promise<ClinicSettingsRecord>
}) {
  return (
    <Suspense fallback={<SettingsFormSkeleton />}>
      <SettingsFormView settingsPromise={settingsPromise} />
    </Suspense>
  )
}

function SettingsFormSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="page-wrap py-8">
      <p className="text-muted-foreground">{t('Chargement des paramètres…')}</p>
    </div>
  )
}

function SettingsFormView({
  settingsPromise,
}: {
  settingsPromise: Promise<ClinicSettingsRecord>
}) {
  const settings = use(settingsPromise)
  const { t } = useTranslation()

  const form = useSettingsForm(SettingsHelper.defaultValuesFrom(settings), async (values) => {
    try {
      await SettingsHelper.saveSettings(values)
      form.reset(values)
      toast.success(t('Paramètres enregistrés'))
    } catch (error) {
      toast.error(t('Échec de l’enregistrement'), {
        description: t(settingsApiErrorMessage(error)),
      })
    }
  })

  return (
    <div className="page-wrap space-y-6 py-8">
      <div>
        <h1 className="display-title text-3xl font-bold text-primary">
          {t('Paramètres du cabinet')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'Ces informations, facultatives, servent de valeurs par défaut pour l’en-tête et le paragraphe Technique des comptes rendus — elles restent modifiables sur chaque rapport.',
          )}
        </p>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault()
          e.stopPropagation()
          await form.handleSubmit()
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">{t('Identité du médecin')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField form={form} name="doctor_name" label="Nom du médecin" />
              <TextField
                form={form}
                name="professional_membership"
                label="Appartenance professionnelle"
              />
              <TextField form={form} name="rpps_number" label="Numéro RPPS" />
              <TextField form={form} name="adeli_number" label="Numéro Adeli" />
            </div>
            <TextField form={form} name="address" label="Adresse du cabinet" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">{t('Appareil Mindray')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                form={form}
                name="mindray_service_date"
                label="Date de mise en service"
                type="date"
              />
              <TextField
                form={form}
                name="mindray_characteristics"
                label="Caractéristiques de l’appareil"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
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
    </div>
  )
}
