import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '#/services/patient-service'

export function RouteError({ error }: { error: unknown }) {
  const { t } = useTranslation()
  return (
    <div className="page-wrap py-8">
      <p className="text-destructive">{t(apiErrorMessage(error))}</p>
    </div>
  )
}
