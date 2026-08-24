export class ApiError<TCode extends string = string> extends Error {
  constructor(public readonly code: TCode) {
    super(code)
    this.name = "ApiError"
  }
}
