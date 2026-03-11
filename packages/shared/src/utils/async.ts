export type GoResult<T, E = Error> = [T, null] | [null, E];

export async function tryCatch<T>(
  promiseFn: (() => Promise<T>) | Promise<T>,
): Promise<GoResult<T>> {
  try {
    const data = await (typeof promiseFn === "function" ? promiseFn() : promiseFn);
    return [data, null];
  } catch (error) {
    if (error instanceof Error) {
      return [null, error];
    }

    return [null, new Error(String(error))];
  }
}

export function tryCatchSync<T>(fn: () => T): GoResult<T> {
  try {
    const data = fn();
    return [data, null];
  } catch (error) {
    if (error instanceof Error) {
      return [null, error];
    }

    return [null, new Error(String(error))];
  }
}
