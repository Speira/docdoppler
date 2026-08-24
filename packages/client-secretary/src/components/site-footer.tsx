import { useTranslation } from 'react-i18next'

export function SiteFooter() {
  const { t } = useTranslation()

  return (
    <footer className="site-footer">
      <div className="page-wrap flex flex-col items-center gap-1 py-6 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span className="font-medium text-foreground">{t('Echo Link')}</span>
        <span>
          {t('Application locale — aucune donnée transmise hors du cabinet.')}
        </span>
      </div>
    </footer>
  )
}
