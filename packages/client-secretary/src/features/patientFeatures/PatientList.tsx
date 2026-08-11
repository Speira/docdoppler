import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Suspense, use, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PatientListHelper } from './PatientListHelper'
import type { PatientRecord } from '#/services/patient-service'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
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
}: {
  patientsPromise: Promise<PatientRecord[]>
}) {
  return (
    <Suspense fallback={<PatientListSkeleton />}>
      <PatientListView patientsPromise={patientsPromise} />
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

function formatSex(sex: PatientRecord['sex'], t: (key: string) => string): string {
  return sex === 'F' ? t('Féminin') : t('Masculin')
}

type SortDirection = 'asc' | 'desc'

function PatientListView({
  patientsPromise,
}: {
  patientsPromise: Promise<PatientRecord[]>
}) {
  const patients = use(patientsPromise)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [examDateSort, setExamDateSort] = useState<SortDirection | null>(null)

  const filtered = useMemo(
    () => PatientListHelper.filterPatients(patients, query),
    [patients, query],
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
            {patients.length} patient{patients.length === 1 ? '' : 's'} enregistré
            {patients.length === 1 ? '' : 's'}.
          </p>
        </div>
        <Link to="/secretariat">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            {t('Nouveau patient')}
          </Button>
        </Link>
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
                <TableHead>{t('Identifiant')}</TableHead>
                <TableHead>{t('Date de naissance')}</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium"
                    onClick={() =>
                      setExamDateSort((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                    }
                  >
                    {t("Date de l'examen")}
                    {examDateSort === 'asc' && <ArrowUp className="h-3.5 w-3.5" />}
                    {examDateSort === 'desc' && <ArrowDown className="h-3.5 w-3.5" />}
                    {!examDateSort && (
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
                <TableHead>{t('Sexe')}</TableHead>
                <TableHead className="text-right">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                  onClick={() => navigate({ to: '/secretariat', search: { id: p.id } })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate({ to: '/secretariat', search: { id: p.id } })
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    {p.last_name.toUpperCase()} {p.first_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.id}</TableCell>
                  <TableCell>
                    {PatientListHelper.formatDate(p.dob)}{' '}
                    <span className="text-muted-foreground">
                      ({t('{{age}} ans', { age: PatientListHelper.calculateAge(p.dob) })})
                    </span>
                  </TableCell>
                  <TableCell>{PatientListHelper.formatDate(p.exam_date)}</TableCell>
                  <TableCell>{formatSex(p.sex, t)}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      to="/secretariat"
                      search={{ id: p.id }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button size="sm" variant="outline">
                        {t('Modifier')}
                      </Button>
                    </Link>
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
