import { Link } from '@tanstack/react-router'
import { Suspense, use, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ReportListHelper } from './ReportListHelper'
import type { PatientWithLatestReport } from './ReportListHelper'
import { reportService } from '#/services/report-service'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export function ReportList({
  patientsPromise,
}: {
  patientsPromise: Promise<PatientWithLatestReport[]>
}) {
  return (
    <Suspense fallback={<ReportListSkeleton />}>
      <ReportListView patientsPromise={patientsPromise} />
    </Suspense>
  )
}

function ReportListSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="page-wrap py-8">
      <p className="text-muted-foreground">{t('Chargement…')}</p>
    </div>
  )
}

function ReportListView({
  patientsPromise,
}: {
  patientsPromise: Promise<PatientWithLatestReport[]>
}) {
  const patients = use(patientsPromise)
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => ReportListHelper.filterPatients(patients, query),
    [patients, query],
  )

  return (
    <div className="page-wrap space-y-6 py-8">
      <div>
        <h1 className="display-title text-3xl font-bold text-primary">
          {t('Rapports')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('Sélectionner un patient pour créer ou consulter un rapport.')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-primary">{t('Recherche')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder={t('Rechercher un patient…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Nom')}</TableHead>
                <TableHead>{t("Date de l'examen")}</TableHead>
                <TableHead className="text-right">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {t('Aucun patient trouvé.')}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.last_name.toUpperCase()} {p.first_name}
                  </TableCell>
                  <TableCell>{ReportListHelper.formatDate(p.exam_date)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {p.latestReportId !== null && (
                        <a
                          href={reportService.reportPdfUrl(p.latestReportId)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button size="sm" variant="outline">
                            {t('Voir rapport')}
                          </Button>
                        </a>
                      )}
                      <Link to="/reports/$patientId" params={{ patientId: String(p.id) }}>
                        <Button size="sm" variant="outline">
                          {t('Nouveau rapport')}
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
