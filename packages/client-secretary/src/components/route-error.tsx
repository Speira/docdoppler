import { useTranslation } from 'react-i18next'

import { ApiError } from '#/services/api-error'
import { apiErrorLabels } from '#/services/patient-service'
import { reportApiErrorLabels } from '#/services/report-service'

const routeErrorLabels: Record<string, string> = {
  ...apiErrorLabels,
  ...reportApiErrorLabels,
}

function routeErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.code in routeErrorLabels
    ? routeErrorLabels[error.code]
    : routeErrorLabels.UNKNOWN_ERROR
}

export function RouteError({ error }: { error: unknown }) {
  const { t } = useTranslation()
  return (
    <div className="page-wrap py-8">
      <p className="text-destructive">{t(routeErrorMessage(error))}</p>
    </div>
  )
}
