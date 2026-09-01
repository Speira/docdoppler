# Membres inférieurs — structured per-artery entry

Date: 2026-09-01
Status: approved, not yet implemented

## Why

`docs/report-module.md`'s 2026-08-31 revision deferred structured per-artery
fields: *"no new structured per-artery fields (BULBE plaque, ACI VSM value,
artères vertébrales flux, fémorale commune/poplitée/tibiale/fibulaire spectre)
— the doctor confirmed the existing free-text findings boxes are enough …
Revisit only if he asks for structured entry per artery segment."*

He has now asked, for the membres inférieurs section. This spec covers **MI
only**. TSA (ACC/bulbe/ACI/vertébrales) stays free-text and is explicitly out
of scope here — but the chosen storage absorbs it later without a migration.

## Scope

**In:** six arteries per side, each with a Spectre; VSM on the AFC only; a Flux
clause derived from Spectre; the report builder inputs; the PDF rendering; the
API and DB to carry it.

**Out:** TSA per-artery entry. Any change to the IPS formula. Any change to the
aorta section. Auto-interpretation beyond the Flux clause defined below.

## The model

Two sides, `droite` then `gauche` (print order). Six arteries per side, in this
fixed print order:

| key | label | inputs |
|---|---|---|
| `afc` | Artère fémorale commune (AFC) | VSM + Spectre |
| `afs` | Artère fémorale superficielle (AFS) | Spectre |
| `poplitee` | Artère poplitée | Spectre |
| `tibiale_anterieure` | Artère tibiale antérieure | Spectre |
| `tibiale_posterieure` | Artère tibiale postérieure | Spectre |
| `fibulaire` | Artère fibulaire | Spectre |

`spectre ∈ { monophasique, diphasique, triphasique }` (or empty = not
examined). VSM is a number in **cm/s**, and only the AFC has one.

### Flux is derived, never entered

There is no Flux input and no Flux column. It is computed from Spectre by
`fluxForSpectre()`, and this table is the whole rule:

| Spectre | Flux clause printed |
|---|---|
| `triphasique` | `Flux : laminaire` |
| `monophasique` | `Flux : amortie` |
| `diphasique` | *(none)* |

This is a deliberate, narrowly-scoped derivation — the same kind already
accepted for the aorta band on 2026-09-01. It applies uniformly to all six
arteries, including the four the doctor wrote as "Spectre : (idem)".

## 1. Data layer

New table; because it is a new table, `schema.sql` (re-executed on every
connection via `createConnection`) creates it with no `ALTER TABLE` migration
code at all. This is why a child table was chosen over 14 flat columns.

```sql
CREATE TABLE IF NOT EXISTS report_arteries (
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  side      TEXT NOT NULL CHECK (side IN ('droite','gauche')),
  artery    TEXT NOT NULL CHECK (artery IN ('afc','afs','poplitee',
                                 'tibiale_anterieure','tibiale_posterieure','fibulaire')),
  vsm       REAL,
  spectre   TEXT NOT NULL DEFAULT ''
            CHECK (spectre IN ('','monophasique','diphasique','triphasique')),
  PRIMARY KEY (report_id, side, artery)
);
```

- **Rows are sparse.** An artery with neither a spectre nor a VSM gets no row.
  A report with no MI arterial exam writes zero rows.
- `ON DELETE CASCADE` mirrors the existing `patients → reports` relation.
- `db/reports.ts`: `createReport` becomes a `better-sqlite3` transaction —
  the `reports` insert plus N artery inserts, all-or-nothing.
- Reads return `ReportWithArteries = ReportRow & { arteres: ArteriesBySide }`,
  so `buildReportPdf` keeps its existing four-argument signature.
- Reports stay append-only; there is no artery update/delete endpoint.

## 2. API

`POST /patients/:id/reports` — `membres_inferieurs` gains an optional
`arteres`; the response returns the same shape.

```json
"membres_inferieurs": {
  "pression_cheville_droite": 120,
  "pression_bras_droit": 140,
  "findings_text": "…",
  "arteres": {
    "droite": {
      "afc": { "vsm": 90, "spectre": "triphasique" },
      "afs": { "spectre": "monophasique" }
    },
    "gauche": {}
  }
}
```

- Omitted side, omitted artery, or `spectre: ""` all mean *not examined*.
- Invalid enum value, unknown artery key, unknown side key, or a non-numeric
  VSM → **`REPORT_FIELD_INVALID`** (the existing code; no new error code).
- The four pressures and the two computed IPS values are unchanged.

## 3. shared-labels

New `packages/shared-labels/src/arteries.ts`, re-exported from the index:

- `MI_ARTERY_KEYS` — the fixed print order above.
- `MI_ARTERY_LABELS` — the French labels above.
- `MI_ARTERY_SIDES` — `['droite','gauche']`, and `MI_SIDE_LABELS`.
- `SPECTRE_OPTIONS` — the three values.
- `fluxForSpectre(spectre)` — the derivation table. **Single source of truth**,
  called by both the PDF and the form.
- `MI_ARTERIES_WITH_VSM` — `['afc']`.

## 4. Report builder form

The MI card gains a Droite sub-block and a Gauche sub-block, six rows each:
artery label + a `Select` for Spectre (`components/ui/select.tsx` already
exists), plus a VSM `NumberField` on the AFC row only.

- Form state stays **flat** — `mi_droite_afc_spectre`, `mi_droite_afc_vsm`, … —
  matching the existing `ReportBuilderFormValues` and its `keyof`-based field
  helpers. A nested shape would require reworking those helpers.
- The 14 keys, their defaults, and their zod rules are **generated** from
  `MI_ARTERY_KEYS` (template-literal types + a loop), not written out 42 times.
- `ReportBuilderHelper.createReport` maps flat form keys → the nested `arteres`
  payload, as it already does for the other sections.
- **The four pressure inputs stay.** They are what IPS is computed from; they
  simply stop being printed.

## 5. PDF

```
Artères des membres inférieurs
    - Droite : IPS : 0.86
        - Artère fémorale commune (AFC) VSM : 90 cm/s. Spectre : triphasique. Flux : laminaire
        - Artère fémorale superficielle (AFS) Spectre : monophasique. Flux : amortie
        - Artère poplitée Spectre : diphasique
    - Gauche : IPS : 0.93
        - …
    Constatations…
    Repères : artère fémorale commune (VSM et spectre) - triphasique normal, …
```

- **All four pressures stop printing** — the two brachial lines *and* the
  `Pression cheville` currently shown on each side row. The side row now leads
  with IPS alone (`- Droite : IPS : 0.86`). All four remain form inputs,
  because they are what the IPS calculation consumes.
- **`Constatations` (`mi_findings_text`) stays**, shared across both sides.
- **The `Repères` note stays exactly as it is** (confirmed 2026-09-01), even
  though it now partly restates the structured fields.
- Arteries render at a new `INDENT_3`, nested under the side row at `INDENT_2`.
- **New primitive `drawInlineBold(prefix, rest, indent)`**: the artery name is
  bold and the remainder regular *on one line*, which a single `drawText` can't
  express. It draws the bold prefix, measures it with `boldFont`, then draws
  the remainder in the regular font at that offset, wrapping the remainder at
  the right margin.
- VSM prints with its unit: `VSM : 90 cm/s`.

### Omission rules

Consistent with the rest of the document:

- An artery with no spectre and no VSM prints no row.
- A side with no IPS and no artery rows prints nothing — not even `- Droite :`.
- The MI section as a whole still follows the existing `miHasContent` rule,
  extended to count artery rows.

## 6. Testing

TDD throughout — each test written and watched fail first.

- **shared-labels**: `fluxForSpectre` for all three values; label/key parity.
- **db**: artery round-trip; sparsity (no rows when nothing entered);
  `ON DELETE CASCADE`; transaction rollback leaves no orphan arteries.
- **validation**: bad enum, unknown artery key, unknown side, non-numeric VSM
  each → `REPORT_FIELD_INVALID`; omitted `arteres` is valid.
- **PDF**: exact line text per artery; the three Flux outcomes; VSM only on
  AFC; artery/side omission rules; the `Repères` note still present.
- **form**: generated zod schema accepts valid spectres and rejects others.

Text extraction cannot assert boldness — the inline-bold rendering is verified
by rendering a page to PNG and looking at it.

## 7. Staging

Three commits, each green before the next:

1. **Data + API** — schema, `db/reports.ts` transaction and reads, validation,
   shared-labels constants and `fluxForSpectre`.
2. **Form** — generated keys/defaults/schema, the Droite/Gauche sub-blocks,
   the payload mapping.
3. **PDF** — `drawInlineBold`, `INDENT_3`, the new MI section, removal of the
   printed brachial pressure lines.

## Decisions log

| Question | Decision |
|---|---|
| Flux entered or derived? | **Derived** from Spectre; no input, no column. |
| Does "(idem)" include Flux? | **Yes** — all six arteries behave identically. |
| Keep pressures / IPS? | All four pressures stay as **form inputs only** (brachial *and* ankle stop printing); IPS still prints per side. |
| Keep `mi_findings_text`? | **Yes**, shared across both sides. |
| Storage shape? | **Child table** `report_arteries`, not 14 flat columns. |
| Keep the Repères note? | **Yes**, unchanged. |
| VSM unit | Prints as `cm/s`. |
| TSA per-artery | **Out of scope**; the child table can absorb it later. |
