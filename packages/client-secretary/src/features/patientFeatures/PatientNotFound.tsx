import { Link } from '@tanstack/react-router'
import { ArrowLeft, UserRoundX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '#/components/ui/button'

/**
 * Shown when the URL names a patient that cannot exist (`/patients/abc`) —
 * the file is a dead end, so the only sensible next step is the list.
 */
export function PatientNotFound() {
  const { t } = useTranslation()

  return (
    <div className="page-wrap py-16">
      <div className="island-shell mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
        <span className="row-meta" aria-hidden="true">
          <UserRoundX className="h-7 w-7" />
        </span>
        <h1 className="display-title text-xl font-bold">
          {t('Patient introuvable')}
        </h1>
        <p className="row-meta max-w-sm text-sm">
          {t("Cette adresse ne correspond à aucune fiche patient du cabinet.")}
        </p>
        <Button asChild size="sm" variant="secondary" className="mt-1">
          <Link to="/patients">
            <ArrowLeft />
            {t('Retour à la liste des patients')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
