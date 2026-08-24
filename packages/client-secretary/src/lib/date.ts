const dateFormatterFR = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatDateFR(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return dateFormatterFR.format(new Date(year, month - 1, day))
}
