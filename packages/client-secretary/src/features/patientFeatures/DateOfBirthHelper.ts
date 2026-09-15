export class DateOfBirthHelper {
  /**
   * The native date input only ever emits a complete ISO date or '', but the
   * schema also guards values hydrated from the API, so it checks the date
   * exists rather than trusting the shape.
   */
  static isRealIsoDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return false
    const [year, month, day] = match.slice(1).map(Number)
    // Date.UTC rolls an impossible day over (31 Feb → 3 Mar), so a date is
    // real only if it survives the round trip unchanged.
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    )
  }
}
