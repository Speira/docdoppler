import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  FilePlus,
  Search,
  SearchX,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { Suspense, use, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PatientListHelper } from './PatientListHelper'
import type {
  ExamDateSort,
  PatientListEmptyState,
  PatientWithReportStatus,
  ReportStatusFilter,
} from './PatientListHelper'
import { reportService } from '#/services/report-service'
import { formatSex } from '#/lib/sex'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

type Translate = ReturnType<typeof useTranslation>['t']

const COLUMN_COUNT = 4

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
  return (
    <div className="page-wrap space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-9 w-40 animate-pulse rounded-md bg-secondary" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded-md bg-secondary" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded-md bg-secondary" />
      </div>
      <div className="island-shell overflow-hidden rounded-2xl">
        <div
          className="flex flex-col gap-3 border-b p-4 sm:flex-row"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="h-9 flex-1 animate-pulse rounded-md bg-secondary" />
          <div className="h-9 animate-pulse rounded-md bg-secondary sm:w-52" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-12 w-full animate-pulse rounded-md bg-secondary"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

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
  const [query, setQuery] = useState('')
  const [examDateSort, setExamDateSort] = useState<ExamDateSort>(null)

  const rows = useMemo(() => {
    const byStatus = PatientListHelper.filterByReportStatus(patients, reportFilter)
    const matching = PatientListHelper.filterPatients(byStatus, query)
    return PatientListHelper.sortByExamDate(matching, examDateSort)
  }, [patients, reportFilter, query, examDateSort])

  const filtersActive = PatientListHelper.hasActiveFilters(query, reportFilter)

  function clearFilters() {
    setQuery('')
    onReportFilterChange('all')
  }

  return (
    <div className="page-wrap space-y-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display-title text-3xl font-bold text-primary">
            {t('Patients')}
          </h1>
          <p className="row-meta mt-1 text-sm" aria-live="polite">
            {filtersActive
              ? t('{{shown}} patient{{plural}} sur {{total}}', {
                  shown: rows.length,
                  plural: PatientListHelper.pluralSuffix(rows.length),
                  total: patients.length,
                })
              : t('{{total}} patient{{plural}} enregistré{{plural}}', {
                  total: patients.length,
                  plural: PatientListHelper.pluralSuffix(patients.length),
                })}
          </p>
        </div>
        <Button asChild>
          <Link to="/patients/add">
            <UserPlus />
            {t('Nouveau patient')}
          </Link>
        </Button>
      </div>

      <div className="island-shell overflow-hidden rounded-2xl">
        <div
          className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="relative sm:flex-1">
            <Label htmlFor="patient-search" className="sr-only">
              {t('Rechercher un patient')}
            </Label>
            <Search
              aria-hidden="true"
              className="row-meta pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Input
              id="patient-search"
              type="search"
              className="pr-9 pl-9"
              placeholder={t('Nom, prénom ou numéro de dossier')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query !== '' && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('Effacer la recherche')}
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setQuery('')}
              >
                <X />
              </Button>
            )}
          </div>
          <Select
            value={reportFilter}
            onValueChange={(value) =>
              onReportFilterChange(PatientListHelper.parseReportFilter(value))
            }
          >
            <SelectTrigger className="sm:w-52" aria-label={t('Filtrer par rapport')}>
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
          <TableCaption className="sr-only">
            {t('Patients du cabinet, avec la date de leur examen et leur rapport.')}
          </TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="island-kicker py-3 pl-4 whitespace-normal">
                {t('Patient')}
              </TableHead>
              <TableHead
                scope="col"
                aria-sort={PatientListHelper.examDateAriaSort(examDateSort)}
                className="py-3 whitespace-normal"
              >
                <button
                  type="button"
                  className="sort-button island-kicker inline-flex items-start gap-1.5 text-left"
                  onClick={() =>
                    setExamDateSort((prev) => PatientListHelper.nextExamDateSort(prev))
                  }
                >
                  {t("Date de l'examen")}
                  <SortIcon sort={examDateSort} />
                </button>
              </TableHead>
              <TableHead
                scope="col"
                className="island-kicker hidden py-3 whitespace-normal lg:table-cell"
              >
                {t('Rapport')}
              </TableHead>
              <TableHead scope="col" className="island-kicker py-3 pr-4 text-right whitespace-normal">
                {t('Actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="p-0">
                  <EmptyState
                    state={PatientListHelper.emptyState(
                      patients.length,
                      query,
                      reportFilter,
                    )}
                    onClearFilters={clearFilters}
                    t={t}
                  />
                </TableCell>
              </TableRow>
            )}
            {rows.map((patient) => (
              <PatientRow key={patient.id} patient={patient} t={t} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SortIcon({ sort }: { sort: ExamDateSort }) {
  if (sort === 'asc') return <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
  if (sort === 'desc') return <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
  return <ChevronsUpDown aria-hidden="true" className="h-3.5 w-3.5 opacity-50" />
}

function PatientRow({ patient, t }: { patient: PatientWithReportStatus; t: Translate }) {
  const hasReport = patient.latestReportId !== null

  return (
    <TableRow className="patient-row" data-report={hasReport ? 'ready' : 'pending'}>
      <TableCell className="py-2.5 pl-4 whitespace-normal">
        <Link
          to="/patients/$patientId"
          params={{ patientId: String(patient.id) }}
          className="row-link py-0.5"
        >
          <span className="row-link__name block text-[0.9375rem] leading-snug font-semibold">
            {PatientListHelper.formatFullName(patient)}
          </span>
          <span className="row-meta mt-0.5 block text-xs">
            {t('{{dob}} · {{age}} ans · {{sex}}', {
              dob: PatientListHelper.formatDate(patient.dob),
              age: PatientListHelper.calculateAge(patient.dob),
              sex: formatSex(patient.sex, t),
            })}
            <span className="ml-2 tabular-nums opacity-70">
              {t('Dossier n° {{id}}', { id: patient.id })}
            </span>
          </span>
        </Link>
        <div className="mt-1.5 flex items-center gap-2 lg:hidden">
          <ReportStatusChip hasReport={hasReport} t={t} />
        </div>
      </TableCell>
      <TableCell className="py-2.5 text-sm tabular-nums">
        {PatientListHelper.formatDate(patient.exam_date)}
      </TableCell>
      <TableCell className="hidden py-2.5 lg:table-cell">
        <ReportStatusChip hasReport={hasReport} t={t} />
      </TableCell>
      <TableCell className="py-2.5 pr-4 text-right">
        <div className="flex justify-end gap-1">
          {patient.latestReportId !== null ? (
            <>
              <Button asChild size="sm" variant="secondary">
                <a
                  href={reportService.reportPdfUrl(patient.latestReportId)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t('Voir rapport (nouvel onglet)')}
                >
                  <Eye />
                  <span className="hidden sm:inline">{t('Voir rapport')}</span>
                </a>
              </Button>
              <Button asChild size="icon-sm" variant="ghost">
                <Link
                  to="/reports/$patientId"
                  params={{ patientId: String(patient.id) }}
                  aria-label={t('Nouveau rapport')}
                  title={t('Nouveau rapport')}
                >
                  <FilePlus />
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link
                to="/reports/$patientId"
                params={{ patientId: String(patient.id) }}
                aria-label={t('Nouveau rapport')}
              >
                <FilePlus />
                <span className="hidden sm:inline">{t('Nouveau rapport')}</span>
              </Link>
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function ReportStatusChip({ hasReport, t }: { hasReport: boolean; t: Translate }) {
  return (
    <span
      className={hasReport ? 'status-chip status-chip--ready' : 'status-chip status-chip--pending'}
    >
      {hasReport ? t('Rapport disponible') : t('Aucun rapport')}
    </span>
  )
}

function EmptyState({
  state,
  onClearFilters,
  t,
}: {
  state: PatientListEmptyState
  onClearFilters: () => void
  t: Translate
}) {
  const isEmptyPractice = state === 'no-patients'

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="row-meta" aria-hidden="true">
        {isEmptyPractice ? (
          <UsersRound className="h-7 w-7" />
        ) : (
          <SearchX className="h-7 w-7" />
        )}
      </span>
      <p className="text-base font-semibold">
        {isEmptyPractice ? t('Aucun patient enregistré') : t('Aucun patient trouvé')}
      </p>
      <p className="row-meta max-w-sm text-sm">
        {isEmptyPractice
          ? t('Créez la première fiche patient pour commencer le suivi du cabinet.')
          : t('Aucun patient ne correspond à la recherche ou au filtre en cours.')}
      </p>
      {isEmptyPractice ? (
        <Button asChild size="sm" className="mt-1">
          <Link to="/patients/add">
            <UserPlus />
            {t('Nouveau patient')}
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-1"
          onClick={onClearFilters}
        >
          <X />
          {t('Effacer les filtres')}
        </Button>
      )}
    </div>
  )
}
