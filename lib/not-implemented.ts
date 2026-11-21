/** Marks a skeleton function that an owner still has to build. Grep for `notImplemented(` to find open work. */
export class NotImplementedError extends Error {
  constructor(
    readonly what: string,
    readonly owner: string,
  ) {
    super(`${what} is not implemented yet (owner: ${owner})`);
    this.name = "NotImplementedError";
  }
}

export function notImplemented(what: string, owner: string): never {
  throw new NotImplementedError(what, owner);
}

/** Route-handler variant: 501 JSON so the UI can show a friendly placeholder. */
export function notImplementedResponse(what: string, owner: string) {
  return Response.json(
    { error: "not_implemented", what, owner },
    { status: 501 },
  );
}
