# Merge Patients/Reports List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the `/reports` patient list into `/patients` — one table with a report-status column, report actions, and a report-status filter — so secretaries stop losing track of which page they're on.

**Architecture:** `PatientListHelper` (in `patientFeatures`) absorbs the report-decoration logic currently in `reportFeatures/ReportListHelper` (`listPatientsWithReportStatus`, replacing `listPatientsWithLatestReport`). `PatientList.tsx` renders the merged table, with a `reportFilter` search param (`all` | `with` | `without`) owned by the `/patients/` route so it's bookmarkable/linkable. `/reports/` becomes a redirect to `/patients`; `/reports/$patientId` (the report builder) is untouched. Nav and the homepage's "Rapports" card are repointed at `/patients` so there's only one place to land. The patient detail screen (`PatientEdit.tsx`, at `/patients/add?id=`) gains a read-only "Historique des rapports" list — every report for that patient with a link to its PDF — so history beyond the latest report isn't lost by only surfacing the latest in the list.

**Tech Stack:** React 19 + TanStack Router (file-based routes, `#/*` subpath imports), TypeScript, Vitest (`environment: 'node'` — no jsdom/RTL in this project), Tailwind, shadcn-style UI primitives under `#/components/ui`.

**Spec:** No separate spec doc — derived from conversation with the user on 2026-09-01. Requirements captured here:
1. Single table on `/patients` with dedicated report columns/actions and a report-status filter (user's request).
2. Only the **latest** report is reachable from the merged table row; older reports for a patient are shown on the patient detail screen (`/patients/add?id=`) instead, per the user's explicit direction — this plan builds that history list too (Task 6), not just the merge.
3. Merging must actually remove the two-page ambiguity, so nav + homepage entry points get repointed too, not just the list itself.

## Global Constraints

- Local-only app, French UI labels throughout, no new dependencies (see root `CLAUDE.md`).
- `vitest.config.ts` for `client-secretary` runs `environment: 'node'` — there is **no** jsdom/`@testing-library/react` in this project. Do not add one for this plan. Component/route-wiring tasks are verified by typecheck + lint + existing test suite, not new component-render tests; only pure-logic helpers get unit tests.
- Per project convention (`feature-slice design` memory), route files stay thin (`createFileRoute` + loader wiring only); list/filter logic lives in `src/features/patientFeatures/`.
- Follow the existing `#/` subpath-import convention (`#/services/...`, `#/components/...`), not relative `../../`.
- `docs/report-module.md` and root `CLAUDE.md` must be updated to reflect the merged screen (per root `CLAUDE.md`'s own "update the doc when relevant" instruction).
- Do not touch `routes/reports.$patientId.tsx` (the report builder) — it stays as the create/view-report screen, only its entry point changes.
- Assume `reportService.listReports(patientId)` returns reports newest-first — this is already relied on elsewhere (`ReportListHelper`/`PatientListHelper` both take `result[0]` as "the latest report"), so Task 6's history list does not re-sort client-side.

---

## File Structure

- **Modify** `packages/client-secretary/src/features/patientFeatures/PatientListHelper.ts` — add `listPatientsWithReportStatus`, `filterByReportStatus`, `parseReportFilter`; genericize `filterPatients`; drop the now-unused `listPatients()`.
- **Create** `packages/client-secretary/src/features/patientFeatures/PatientListHelper.test.ts` — unit tests for the above.
- **Modify** `packages/client-secretary/src/features/patientFeatures/PatientList.tsx` — report-status column, report actions, filter `Select`.
- **Modify** `packages/client-secretary/src/routes/patients.index.tsx` — `validateSearch` for `reportFilter`, loader switched to `listPatientsWithReportStatus`.
- **Modify** `packages/client-secretary/src/routes/reports.index.tsx` — becomes a redirect-only route (`/reports` → `/patients`).
- **Delete** `packages/client-secretary/src/features/reportFeatures/ReportList.tsx`
- **Delete** `packages/client-secretary/src/features/reportFeatures/ReportListHelper.ts`
- **Modify** `packages/client-secretary/src/components/site-header.tsx` — remove the "Rapports" nav entry.
- **Modify** `packages/client-secretary/src/features/homeFeatures/Home.tsx` — repoint the "Rapports" `HomeCard` at `/patients`.
- **Modify** `packages/client-secretary/src/features/patientFeatures/PatientEditHelper.ts` — add `listReports(id)`.
- **Modify** `packages/client-secretary/src/features/patientFeatures/PatientEdit.tsx` — render the report history list.
- **Modify** `packages/client-secretary/src/routes/patients.add.tsx` — load reports alongside the patient for edit mode.
- **Modify** `CLAUDE.md` — "Screens" section.
- **Modify** `docs/report-module.md` — short addendum noting the consolidated entry point and the new history list.

---

### Task 1: Extend `PatientListHelper` with report-status logic

**Files:**
- Modify: `packages/client-secretary/src/features/patientFeatures/PatientListHelper.ts`
- Test: `packages/client-secretary/src/features/patientFeatures/PatientListHelper.test.ts`

**Interfaces:**
- Consumes: `patientService.listPatients(): Promise<PatientRecord[]>` (`#/services/patient-service`), `reportService.listReports(patientId: number): Promise<ReportRecord[]>` (`#/services/report-service`).
- Produces (used by Tasks 2–3): `PatientWithReportStatus = PatientRecord & { latestReportId: number | null }`, `ReportStatusFilter = 'all' | 'with' | 'without'`, `PatientListHelper.listPatientsWithReportStatus(): Promise<PatientWithReportStatus[]>`, `PatientListHelper.filterByReportStatus(patients: PatientWithReportStatus[], filter: ReportStatusFilter): PatientWithReportStatus[]`, `PatientListHelper.parseReportFilter(value: unknown): ReportStatusFilter`, `PatientListHelper.filterPatients<T extends PatientRecord>(patients: T[], query: string): T[]` (now generic — was `PatientRecord[]` in/out).

- [ ] **Step 1: Write the failing tests**

Create `packages/client-secretary/src/features/patientFeatures/PatientListHelper.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('#/services/patient-service', () => ({
  patientService: { listPatients: vi.fn() },
}))
vi.mock('#/services/report-service', () => ({
  reportService: { listReports: vi.fn() },
}))

import { patientService } from '#/services/patient-service'
import { reportService } from '#/services/report-service'
import { PatientListHelper } from './PatientListHelper'
import type { PatientRecord } from '#/services/patient-service'

function patient(id: number, overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id,
    first_name: 'Jean',
    last_name: 'Dupont',
    dob: '1985-03-12',
    exam_date: '2026-08-25',
    sex: 'M',
    created_at: '2026-08-25T00:00:00.000Z',
    updated_at: '2026-08-25T00:00:00.000Z',
    ...overrides,
  }
}

describe('PatientListHelper.listPatientsWithReportStatus', () => {
  it('attaches the latest report id when reports exist', async () => {
    vi.mocked(patientService.listPatients).mockResolvedValue([patient(1)])
    vi.mocked(reportService.listReports).mockResolvedValue([
      { id: 42 } as never,
      { id: 41 } as never,
    ])

    const result = await PatientListHelper.listPatientsWithReportStatus()

    expect(result).toEqual([{ ...patient(1), latestReportId: 42 }])
  })

  it('sets latestReportId to null when a patient has no reports', async () => {
    vi.mocked(patientService.listPatients).mockResolvedValue([patient(2)])
    vi.mocked(reportService.listReports).mockResolvedValue([])

    const result = await PatientListHelper.listPatientsWithReportStatus()

    expect(result[0].latestReportId).toBeNull()
  })

  it('sets latestReportId to null when the report lookup fails for a patient', async () => {
    vi.mocked(patientService.listPatients).mockResolvedValue([patient(3)])
    vi.mocked(reportService.listReports).mockRejectedValue(new Error('network'))

    const result = await PatientListHelper.listPatientsWithReportStatus()

    expect(result[0].latestReportId).toBeNull()
  })
})

describe('PatientListHelper.filterByReportStatus', () => {
  const withReport = { ...patient(1), latestReportId: 42 }
  const withoutReport = { ...patient(2), latestReportId: null }

  it('returns everyone for "all"', () => {
    expect(
      PatientListHelper.filterByReportStatus([withReport, withoutReport], 'all'),
    ).toEqual([withReport, withoutReport])
  })

  it('returns only patients with a report for "with"', () => {
    expect(
      PatientListHelper.filterByReportStatus([withReport, withoutReport], 'with'),
    ).toEqual([withReport])
  })

  it('returns only patients without a report for "without"', () => {
    expect(
      PatientListHelper.filterByReportStatus([withReport, withoutReport], 'without'),
    ).toEqual([withoutReport])
  })
})

describe('PatientListHelper.parseReportFilter', () => {
  it('accepts "with" and "without"', () => {
    expect(PatientListHelper.parseReportFilter('with')).toBe('with')
    expect(PatientListHelper.parseReportFilter('without')).toBe('without')
  })

  it('defaults anything else to "all"', () => {
    expect(PatientListHelper.parseReportFilter(undefined)).toBe('all')
    expect(PatientListHelper.parseReportFilter('bogus')).toBe('all')
    expect(PatientListHelper.parseReportFilter(null)).toBe('all')
  })
})

describe('PatientListHelper.filterPatients (generic)', () => {
  it('keeps extra fields (e.g. latestReportId) on the filtered results', () => {
    const withReport = { ...patient(1, { first_name: 'Marie' }), latestReportId: 42 }
    expect(PatientListHelper.filterPatients([withReport], 'marie')).toEqual([withReport])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @speira-docdoppler/client-secretary test -- PatientListHelper`
Expected: FAIL — `listPatientsWithReportStatus`, `filterByReportStatus`, `parseReportFilter` don't exist yet.

(Check the exact package name in `packages/client-secretary/package.json`'s `"name"` field if `@speira-docdoppler/client-secretary` doesn't match — use that instead.)

- [ ] **Step 3: Implement in `PatientListHelper.ts`**

Replace the file's contents with:

```ts
import { patientService } from '#/services/patient-service'
import { reportService } from '#/services/report-service'
import type { PatientRecord } from '#/services/patient-service'
import { formatDateFR } from '#/lib/date'

const COMBINING_DIACRITICS = /[̀-ͯ]/g

function foldAccents(value: string): string {
  return value.normalize('NFD').replace(COMBINING_DIACRITICS, '').toLowerCase()
}

export type PatientWithReportStatus = PatientRecord & { latestReportId: number | null }

export type ReportStatusFilter = 'all' | 'with' | 'without'

export class PatientListHelper {
  static async listPatientsWithReportStatus(): Promise<PatientWithReportStatus[]> {
    const patients = await patientService.listPatients()
    const results = await Promise.allSettled(
      patients.map((patient) => reportService.listReports(patient.id)),
    )
    return patients.map((patient, index) => {
      const result = results[index]
      return {
        ...patient,
        latestReportId: result.status === 'fulfilled' ? result.value[0]?.id ?? null : null,
      }
    })
  }

  static filterPatients<T extends PatientRecord>(patients: T[], query: string): T[] {
    const q = foldAccents(query.trim())
    if (!q) return patients
    return patients.filter(
      (p) =>
        foldAccents(p.first_name).includes(q) ||
        foldAccents(p.last_name).includes(q) ||
        String(p.id).includes(q),
    )
  }

  static filterByReportStatus(
    patients: PatientWithReportStatus[],
    filter: ReportStatusFilter,
  ): PatientWithReportStatus[] {
    if (filter === 'all') return patients
    return patients.filter((p) =>
      filter === 'with' ? p.latestReportId !== null : p.latestReportId === null,
    )
  }

  static parseReportFilter(value: unknown): ReportStatusFilter {
    return value === 'with' || value === 'without' ? value : 'all'
  }

  static formatDate(isoDate: string): string {
    return formatDateFR(isoDate)
  }

  static calculateAge(dob: string): number {
    const [year, month, day] = dob.split('-').map(Number)
    const birth = new Date(year, month - 1, day)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const hasHadBirthdayThisYear =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
    if (!hasHadBirthdayThisYear) age -= 1
    return age
  }
}
```

Note: `listPatients()` is deliberately removed — after Task 3 rewires the route loader, nothing else calls it (verified: it was only called from `routes/patients.index.tsx`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @speira-docdoppler/client-secretary test -- PatientListHelper`
Expected: PASS, all cases above green.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @speira-docdoppler/client-secretary exec tsc --noEmit`
Expected: fails at this point only on `PatientList.tsx` (still expects `PatientRecord[]` / calls `listPatients()`) and `patients.index.tsx` — that's expected, fixed in Tasks 2–3. Confirm there is no error inside `PatientListHelper.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add packages/client-secretary/src/features/patientFeatures/PatientListHelper.ts packages/client-secretary/src/features/patientFeatures/PatientListHelper.test.ts
git commit -m "feat: add report-status decoration and filtering to PatientListHelper"
```

---

### Task 2: Update `PatientList.tsx` — report column, actions, filter

**Files:**
- Modify: `packages/client-secretary/src/features/patientFeatures/PatientList.tsx`

**Interfaces:**
- Consumes: `PatientWithReportStatus`, `ReportStatusFilter`, `PatientListHelper.filterPatients`, `PatientListHelper.filterByReportStatus`, `PatientListHelper.formatDate`, `PatientListHelper.calculateAge` (all from Task 1); `reportService.reportPdfUrl(reportId: number): string` (`#/services/report-service`); shadcn `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` from `#/components/ui/select`.
- Produces (used by Task 3): `PatientList` now takes two new required props — `reportFilter: ReportStatusFilter` and `onReportFilterChange: (filter: ReportStatusFilter) => void` — alongside the existing `patientsPromise: Promise<PatientWithReportStatus[]>`.

- [ ] **Step 1: Update the component**

Replace `packages/client-secretary/src/features/patientFeatures/PatientList.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck (expect remaining errors only in the route file, fixed next)**

Run: `pnpm --filter @speira-docdoppler/client-secretary exec tsc --noEmit`
Expected: errors only in `routes/patients.index.tsx` (prop mismatch — `PatientList` now requires `reportFilter`/`onReportFilterChange`, and the loader still calls the removed `listPatients()`). No errors inside `PatientList.tsx` itself.

- [ ] **Step 3: Lint**

Run: `pnpm --filter @speira-docdoppler/client-secretary lint`
Expected: PASS for `PatientList.tsx` (unused-import/exhaustive-deps rules clean).

- [ ] **Step 4: Commit**

```bash
git add packages/client-secretary/src/features/patientFeatures/PatientList.tsx
git commit -m "feat: merge report status, actions and filter into PatientList"
```

---

### Task 3: Wire `reportFilter` search param into `/patients/`

**Files:**
- Modify: `packages/client-secretary/src/routes/patients.index.tsx`

**Interfaces:**
- Consumes: `PatientListHelper.listPatientsWithReportStatus`, `PatientListHelper.parseReportFilter`, `ReportStatusFilter` (Task 1); `PatientList` props (Task 2).
- Produces: `/patients/` now accepts `?reportFilter=all|with|without` (default `all`), used by Task 5's homepage link.

- [ ] **Step 1: Update the route**

Replace `packages/client-secretary/src/routes/patients.index.tsx`:

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { PatientList } from '#/features/patientFeatures/PatientList'
import { PatientListHelper } from '#/features/patientFeatures/PatientListHelper'
import type { ReportStatusFilter } from '#/features/patientFeatures/PatientListHelper'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

export const Route = createFileRoute('/patients/')({
  validateSearch: (search: Record<string, unknown>): { reportFilter: ReportStatusFilter } => ({
    reportFilter: PatientListHelper.parseReportFilter(search.reportFilter),
  }),
  loader: () => ({ patients: PatientListHelper.listPatientsWithReportStatus() }),
  head: () => ({
    meta: [
      { title: i18next.t('Patients — DocDoppler') },
      {
        name: 'description',
        content: i18next.t('Liste des patients du cabinet.'),
      },
    ],
  }),
  errorComponent: ({ error }) => <RouteError error={error} />,
  component: RouteComponent,
})

function RouteComponent() {
  const { patients } = Route.useLoaderData()
  const { reportFilter } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <PatientList
      patientsPromise={patients}
      reportFilter={reportFilter}
      onReportFilterChange={(filter) =>
        navigate({ to: '/patients', search: { reportFilter: filter }, replace: true })
      }
    />
  )
}
```

(Matches the generic `useNavigate` import `PatientList.tsx` already uses elsewhere in this codebase, rather than the route-scoped `Route.useNavigate()`.)

(Per the project's TanStack Router search-parsing memory, `validateSearch` is the one place the raw `?reportFilter=` string is trusted from — `PatientListHelper.parseReportFilter` already defaults anything unexpected to `'all'`, so no invalid state can reach `PatientList`.)

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @speira-docdoppler/client-secretary exec tsc --noEmit`
Expected: PASS with no errors in `patients.index.tsx` or `PatientList.tsx`. (`reports.index.tsx` will still error until Task 4 — expected.)

- [ ] **Step 3: Full test suite**

Run: `pnpm --filter @speira-docdoppler/client-secretary test`
Expected: PASS (Task 1's tests plus existing `ips.test.ts`/`consts.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add packages/client-secretary/src/routes/patients.index.tsx
git commit -m "feat: add reportFilter search param to /patients"
```

---

### Task 4: Retire the `/reports` list route and its feature files

**Files:**
- Modify: `packages/client-secretary/src/routes/reports.index.tsx`
- Delete: `packages/client-secretary/src/features/reportFeatures/ReportList.tsx`
- Delete: `packages/client-secretary/src/features/reportFeatures/ReportListHelper.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `GET /reports` (client-side route) redirects to `/patients`; `/reports/$patientId` (report builder) is unaffected — it isn't rendered through `/reports/`'s old index component and imports neither deleted file.

- [ ] **Step 1: Replace the index route with a redirect**

Replace `packages/client-secretary/src/routes/reports.index.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/reports/')({
  beforeLoad: () => {
    throw redirect({ to: '/patients' })
  },
})
```

- [ ] **Step 2: Delete the now-unused report list feature files**

```bash
git rm packages/client-secretary/src/features/reportFeatures/ReportList.tsx
git rm packages/client-secretary/src/features/reportFeatures/ReportListHelper.ts
```

- [ ] **Step 3: Regenerate the route tree**

Run: `pnpm --filter @speira-docdoppler/client-secretary generate-routes`
Expected: `routeTree.gen.ts` updates to match the new `reports.index.tsx`; no manual edits needed.

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter @speira-docdoppler/client-secretary exec tsc --noEmit && pnpm --filter @speira-docdoppler/client-secretary lint`
Expected: PASS — confirms nothing else imported `ReportList`/`ReportListHelper` (already verified via grep before writing this plan: only `reports.index.tsx` referenced them).

- [ ] **Step 5: Commit**

```bash
git add packages/client-secretary/src/routes/reports.index.tsx packages/client-secretary/src/routeTree.gen.ts
git commit -m "feat: redirect /reports to /patients, remove standalone report list"
```

---

### Task 5: Repoint navigation and the homepage card

**Files:**
- Modify: `packages/client-secretary/src/components/site-header.tsx`
- Modify: `packages/client-secretary/src/features/homeFeatures/Home.tsx`

**Interfaces:**
- Consumes: `/patients` route's `reportFilter` search param (Task 3).
- Produces: no new exports — this only removes a nav entry and repoints a link.

- [ ] **Step 1: Remove the "Rapports" nav item**

In `packages/client-secretary/src/components/site-header.tsx`, change:

```ts
const NAV_ITEMS = [
  { to: '/', label: 'Accueil' },
  { to: '/patients', label: 'Patients' },
  { to: '/reports', label: 'Rapports' },
  { to: '/settings', label: 'Paramètres' },
] as const
```

to:

```ts
const NAV_ITEMS = [
  { to: '/', label: 'Accueil' },
  { to: '/patients', label: 'Patients' },
  { to: '/settings', label: 'Paramètres' },
] as const
```

- [ ] **Step 2: Repoint the "Rapports" homepage card**

In `packages/client-secretary/src/features/homeFeatures/Home.tsx`, change the `HomeCard` `to` type union:

```ts
to: '/patients' | '/reports' | '/settings'
```

to:

```ts
to: '/patients' | '/settings'
```

And change the "Rapports" `HomeCard` usage from:

```tsx
<HomeCard
  to="/reports"
  icon={<FileText className="h-6 w-6" />}
  title={t('Rapports')}
  description={t('Comptes rendus écho-Doppler par patient.')}
  stat={t('{{count}} patient{{plural}} avec compte rendu', {
    count: stats.patientsWithReportCount,
    plural: stats.patientsWithReportCount === 1 ? '' : 's',
  })}
/>
```

to:

```tsx
<HomeCard
  to="/patients"
  search={{ reportFilter: 'with' }}
  icon={<FileText className="h-6 w-6" />}
  title={t('Rapports')}
  description={t('Comptes rendus écho-Doppler par patient.')}
  stat={t('{{count}} patient{{plural}} avec compte rendu', {
    count: stats.patientsWithReportCount,
    plural: stats.patientsWithReportCount === 1 ? '' : 's',
  })}
/>
```

This requires `HomeCard` to forward an optional `search` prop to its inner `Link`. Update the `HomeCard` component:

```tsx
function HomeCard({
  to,
  search,
  icon,
  title,
  description,
  stat,
}: {
  to: '/patients' | '/settings'
  search?: Record<string, unknown>
  icon: React.ReactNode
  title: string
  description: string
  stat: string
}) {
  return (
    <Link
      to={to}
      search={search}
      className="feature-card rise-in flex flex-col gap-3 rounded-2xl p-6 text-left"
    >
      <div className="flex items-center gap-3 text-primary">
        {icon}
        <h2 className="display-title text-xl font-bold">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="island-kicker mt-auto">{stat}</p>
    </Link>
  )
}
```

`HomeHelper.ts` is unchanged — `patientsWithReportCount` still means the same thing, it just now lands on the merged table pre-filtered instead of a separate page.

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @speira-docdoppler/client-secretary exec tsc --noEmit && pnpm --filter @speira-docdoppler/client-secretary lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/client-secretary/src/components/site-header.tsx packages/client-secretary/src/features/homeFeatures/Home.tsx
git commit -m "feat: repoint nav and homepage Rapports card at merged /patients list"
```

---

### Task 6: Report history on the patient detail screen

**Files:**
- Modify: `packages/client-secretary/src/features/patientFeatures/PatientEditHelper.ts`
- Modify: `packages/client-secretary/src/features/patientFeatures/PatientEdit.tsx`
- Modify: `packages/client-secretary/src/routes/patients.add.tsx`

**Interfaces:**
- Consumes: `reportService.listReports(patientId: number): Promise<ReportRecord[]>` and `reportService.reportPdfUrl(reportId: number): string` (`#/services/report-service`); `PatientListHelper.formatDate` (Task 1).
- Produces: `PatientEditHelper.listReports(id: number): Promise<ReportRecord[]>`; `PatientEdit` now takes an additional required prop `reportsPromise: Promise<ReportRecord[]>`.

- [ ] **Step 1: Add `listReports` to `PatientEditHelper`**

In `packages/client-secretary/src/features/patientFeatures/PatientEditHelper.ts`, add the import and method (mirrors the existing `loadPatient`/`deletePatient` passthrough style — this file has no dedicated unit test today for the same reason, its methods are thin service delegations covered by typecheck + the route/component that calls them):

```ts
import { patientService } from '#/services/patient-service'
import { reportService } from '#/services/report-service'
import type { ReportRecord } from '#/services/report-service'
import type { PatientFormValues } from './types'

export class PatientEditHelper {
  // ...existing loadPatient/deletePatient/updatePatient unchanged...

  static listReports(id: number): Promise<ReportRecord[]> {
    return reportService.listReports(id)
  }
}
```

(Insert the `listReports` method into the existing class body — don't drop `loadPatient`, `deletePatient`, or `updatePatient`.)

- [ ] **Step 2: Load reports in the route**

In `packages/client-secretary/src/routes/patients.add.tsx`, extend the loader:

```tsx
import { createFileRoute } from '@tanstack/react-router'

import { PatientCreate } from '#/features/patientFeatures/PatientCreate'
import { PatientEdit } from '#/features/patientFeatures/PatientEdit'
import { PatientEditHelper } from '#/features/patientFeatures/PatientEditHelper'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

type Search = { id?: number }

export const Route = createFileRoute('/patients/add')({
  // The default search parser JSON-parses each raw query value before this
  // runs, so a numeric ?id=1 already arrives as the number 1, not "1".
  validateSearch: (s: Record<string, unknown>): Search => {
    if (typeof s.id === 'number' && Number.isInteger(s.id)) return { id: s.id }
    if (
      typeof s.id === 'string' &&
      s.id.trim() !== '' &&
      !Number.isNaN(Number(s.id))
    ) {
      return { id: Number(s.id) }
    }
    return { id: undefined }
  },
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: ({ deps }) => ({
    patient:
      deps.id === undefined
        ? undefined
        : PatientEditHelper.loadPatient(deps.id),
    reports:
      deps.id === undefined
        ? undefined
        : PatientEditHelper.listReports(deps.id),
  }),
  errorComponent: ({ error }) => <RouteError error={error} />,
  head: () => ({
    meta: [
      { title: i18next.t('Ajout de patient — DocDoppler') },
      {
        name: 'description',
        content: i18next.t(
          "Fiche d'accueil patient : identité et antécédents médicaux.",
        ),
      },
    ],
  }),
  component: Secretariat,
})

function Secretariat() {
  const { id } = Route.useSearch()
  const { patient, reports } = Route.useLoaderData()
  if (id === undefined || !patient || !reports) return <PatientCreate />
  return (
    <PatientEdit key={id} id={id} patientPromise={patient} reportsPromise={reports} />
  )
}
```

- [ ] **Step 3: Render the history list in `PatientEdit.tsx`**

In `packages/client-secretary/src/features/patientFeatures/PatientEdit.tsx`:

Change the existing `lucide-react` import line from:

```tsx
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
```

to:

```tsx
import { ArrowLeft, Eye, Save, Trash2 } from 'lucide-react'
```

And add these new imports alongside the file's other imports:

```tsx
import type { ReportRecord } from '#/services/report-service'
import { reportService } from '#/services/report-service'
import { PatientListHelper } from './PatientListHelper'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
```

Update the outer `PatientEdit` and `PatientEditForm` signatures to accept and thread through `reportsPromise`:

```tsx
export function PatientEdit({
  id,
  patientPromise,
  reportsPromise,
}: {
  id: number
  patientPromise: Promise<PatientFormValues>
  reportsPromise: Promise<ReportRecord[]>
}) {
  return (
    <Suspense fallback={<PatientEditSkeleton />}>
      <PatientEditForm id={id} patientPromise={patientPromise} reportsPromise={reportsPromise} />
    </Suspense>
  )
}
```

```tsx
function PatientEditForm({
  id,
  patientPromise,
  reportsPromise,
}: {
  id: number
  patientPromise: Promise<PatientFormValues>
  reportsPromise: Promise<ReportRecord[]>
}) {
  const loadedValues = use(patientPromise)
  const reports = use(reportsPromise)
  // ...rest of the existing function body is unchanged...
```

Add a `ReportHistoryCard` component (below `PatientEditForm` in the same file):

```tsx
function ReportHistoryCard({ reports }: { reports: ReportRecord[] }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-primary">{t('Historique des rapports')}</CardTitle>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('Aucun rapport pour ce patient.')}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {reports.map((report) => (
              <li key={report.id} className="flex items-center justify-between py-2">
                <span className="text-sm">{PatientListHelper.formatDate(report.exam_date)}</span>
                <a href={reportService.reportPdfUrl(report.id)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">
                    <Eye />
                    {t('Voir le rapport')}
                  </Button>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
```

Render it in `PatientEditForm`'s JSX, right after the header block and before the `<form>`:

```tsx
      <Link to="/patients">
          <Button type="button" variant="outline">
            <ArrowLeft />
            {t('Retour')}
          </Button>
        </Link>
      </div>

      <ReportHistoryCard reports={reports} />

      <form
```

(That's the existing header `</div>` immediately followed by the existing `<form onSubmit={...}>` — insert the `<ReportHistoryCard />` line between them, don't duplicate the surrounding markup.)

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter @speira-docdoppler/client-secretary exec tsc --noEmit && pnpm --filter @speira-docdoppler/client-secretary lint`
Expected: PASS.

- [ ] **Step 5: Run the test suite**

Run: `pnpm --filter @speira-docdoppler/client-secretary test`
Expected: PASS — no test changes needed here (no jsdom for a render test; `listReports` is a one-line passthrough consistent with this file's existing untested passthroughs).

- [ ] **Step 6: Commit**

```bash
git add packages/client-secretary/src/features/patientFeatures/PatientEditHelper.ts packages/client-secretary/src/features/patientFeatures/PatientEdit.tsx packages/client-secretary/src/routes/patients.add.tsx
git commit -m "feat: show report history on the patient detail screen"
```

---

### Task 7: Update docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/report-module.md`

- [ ] **Step 1: Update `CLAUDE.md`'s "Screens" section**

Change:

```markdown
1. Secretary intake: patient identity + medical history form (`/patients/add`, create or edit via `?id=`) — patient list is `/patients`
2. Doctor report builder: read patient + history, enter findings per exam region, generate PDF
```

to:

```markdown
1. Secretary intake: patient identity + medical history form (`/patients/add`, create or edit via `?id=`) — patient list is `/patients`, merged 2026-09-01 with report status/actions (see below) and a `?reportFilter=all|with|without` filter; `/reports` redirects here. The detail screen also shows a "Historique des rapports" list of every report for that patient, each linking to its PDF.
2. Doctor report builder: read patient + history, enter findings per exam region, generate PDF — reached from `/patients` row actions at `/reports/$patientId`; the list surfaces only the latest report per patient, older reports are on the patient detail screen's history list
```

- [ ] **Step 2: Add an addendum note to `docs/report-module.md`**

Near the existing "Clinic identity settings (new — not previously scoped)" section (around line 145), add:

```markdown
## Patients/Reports list consolidation (2026-09-01)

The standalone `/reports` patient list was merged into `/patients` — secretaries
were mixing up the two nearly-identical list pages. `/patients` now carries a
"Statut rapport" column, "Voir rapport"/"Nouveau rapport" row actions, and a
report-status filter; `/reports` redirects to `/patients`, `/reports/$patientId`
(the report builder) is unchanged. Only the latest report per patient is
surfaced in the list — browsing older reports for a patient with multiple
visits happens on the patient detail screen (`/patients/add?id=`), which now
shows a read-only "Historique des rapports" list of every report for that
patient, each linking to its PDF.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/report-module.md
git commit -m "doc: record patients/reports list merge and report history"
```

---

### Task 8: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm --filter @speira-docdoppler/client-secretary test`
Expected: PASS, including all of Task 1's new cases.

- [ ] **Step 2: Typecheck the whole package**

Run: `pnpm --filter @speira-docdoppler/client-secretary exec tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 3: Lint the whole package**

Run: `pnpm --filter @speira-docdoppler/client-secretary lint`
Expected: PASS, zero errors.

- [ ] **Step 4: Build**

Run: `pnpm --filter @speira-docdoppler/client-secretary build`
Expected: PASS — catches any route-tree generation drift Task 4 might have missed.

- [ ] **Step 5: Hand off for manual verification**

Per this project's working style, do not start the dev server yourself. Tell the user the change is ready for them to run locally and spot-check:
- `/patients` shows the report column, actions, and filter; filter persists across reload via the URL.
- Visiting `/reports` directly redirects to `/patients`.
- The homepage "Rapports" card lands on `/patients` pre-filtered to "Avec rapport".
- Opening a patient with multiple reports (`/patients/add?id=`) shows all of them in "Historique des rapports", each PDF link opening the right report; a patient with none shows "Aucun rapport pour ce patient."
- Top nav only shows Accueil / Patients / Paramètres.
