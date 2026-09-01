import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  FileText,
  Pencil,
  UserPlus,
} from 'lucide-react'
import { Suspense, use, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PatientListHelper } from './PatientListHelper'
import type { PatientWithReportStatus, ReportStatusFilter } from './PatientListHelper'
import { reportService } from '#/services/report-service'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export function PatientList({
  patientsPromise,
  reportFilter,
  onReportFilterChange,
}: {
  patientsPromise: Promise<PatientWithReportStatus[]>
  reportFilter: ReportStatusFilter
  onReportFilterChange: (filter: ReportStatusFilter) => void
}) {
  return (
    <Suspense fallback={<PatientListSkeleton />}>
      <PatientListView
        patientsPromise={patientsPromise}
        reportFilter={reportFilter}
        onReportFilterChange={onReportFilterChange}
      />
    </Suspense>
  )
}

function PatientListSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="page-wrap space-y-6 py-8">
      <div>
        <div className="h-9 w-40 animate-pulse rounded-md bg-secondary" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded-md bg-secondary" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-primary">{t('Recherche')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-9 w-full animate-pulse rounded-md bg-secondary" />
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="h-10 w-full animate-pulse rounded-md bg-secondary"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function formatSex(
  sex: PatientWithReportStatus['sex'],
  t: (key: string) => string,
): string {
  return sex === 'F' ? t('Féminin') : t('Masculin')
}

function ReportStatusBadge({
  hasReport,
  t,
}: {
  hasReport: boolean
  t: (key: string) => string
}) {
  return (
    <span
      className={
        hasReport
          ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800'
          : 'inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground'
      }
    >
      {hasReport ? t('Rapport disponible') : t('Aucun rapport')}
    </span>
  )
}

type SortDirection = 'asc' | 'desc'

function PatientListView({
  patientsPromise,
  reportFilter,
  onReportFilterChange,
}: {
  patientsPromise: Promise<PatientWithReportStatus[]>
  reportFilter: ReportStatusFilter
  onReportFilterChange: (filter: ReportStatusFilter) => void
}) {
  const patients = use(patientsPromise)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [examDateSort, setExamDateSort] = useState<SortDirection | null>(null)

  const byStatus = useMemo(
    () => PatientListHelper.filterByReportStatus(patients, reportFilter),
    [patients, reportFilter],
  )

  const filtered = useMemo(
    () => PatientListHelper.filterPatients(byStatus, query),
    [byStatus, query],
  )

  const sorted = useMemo(() => {
    if (!examDateSort) return filtered
    const factor = examDateSort === 'asc' ? 1 : -1
    return [...filtered].sort(
      (a, b) => factor * a.exam_date.localeCompare(b.exam_date),
    )
  }, [filtered, examDateSort])

  return (
    <div className="page-wrap space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display-title text-3xl font-bold text-primary">
            {t('Patients')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {patients.length} patient{patients.length === 1 ? '' : 's'}{' '}
            enregistré
            {patients.length === 1 ? '' : 's'}.
          </p>
        </div>
        <Link to="/patients/add">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <UserPlus />
            {t('Nouveau patient')}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-primary">{t('Recherche')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Input
              className="sm:flex-1"
              placeholder={t('Rechercher un patient…')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              value={reportFilter}
              onValueChange={(value) =>
                onReportFilterChange(PatientListHelper.parseReportFilter(value))
              }
            >
              <SelectTrigger className="sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('Tous les patients')}</SelectItem>
                <SelectItem value="with">{t('Avec rapport')}</SelectItem>
                <SelectItem value="without">{t('Sans rapport')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Nom')}</TableHead>
                <TableHead>{t('Identifiant')}</TableHead>
                <TableHead>{t('Date de naissance')}</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium"
                    onClick={() =>
                      setExamDateSort((prev) =>
                        prev === 'asc' ? 'desc' : 'asc',
                      )
                    }
                  >
                    {t("Date de l'examen")}
                    {examDateSort === 'asc' && (
                      <ArrowUp className="h-3.5 w-3.5" />
                    )}
                    {examDateSort === 'desc' && (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )}
                    {!examDateSort && (
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
                <TableHead>{t('Sexe')}</TableHead>
                <TableHead>{t('Statut rapport')}</TableHead>
                <TableHead className="text-right">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    {t('Aucun patient trouvé.')}
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((p) => (
                <TableRow
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer hover:bg-secondary/50"
                  onClick={() =>
                    navigate({ to: '/patients/add', search: { id: p.id } })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate({ to: '/patients/add', search: { id: p.id } })
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    {p.last_name.toUpperCase()} {p.first_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.id}
                  </TableCell>
                  <TableCell>
                    {PatientListHelper.formatDate(p.dob)}{' '}
                    <span className="text-muted-foreground">
                      (
                      {t('{{age}} ans', {
                        age: PatientListHelper.calculateAge(p.dob),
                      })}
                      )
                    </span>
                  </TableCell>
                  <TableCell>
                    {PatientListHelper.formatDate(p.exam_date)}
                  </TableCell>
                  <TableCell>{formatSex(p.sex, t)}</TableCell>
                  <TableCell>
                    <ReportStatusBadge hasReport={p.latestReportId !== null} t={t} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {p.latestReportId !== null && (
                        <a
                          href={reportService.reportPdfUrl(p.latestReportId)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="sm" variant="outline">
                            <Eye />
                            {t('Voir rapport')}
                          </Button>
                        </a>
                      )}
                      <Link
                        to="/reports/$patientId"
                        params={{ patientId: String(p.id) }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button size="sm" variant="outline">
                          <FileText />
                          {t('Nouveau rapport')}
                        </Button>
                      </Link>
                      <Link
                        to="/patients/add"
                        search={{ id: p.id }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button size="sm" variant="outline">
                          <Pencil />
                          {t('Modifier')}
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
