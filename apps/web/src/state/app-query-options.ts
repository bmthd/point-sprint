export function appQueryOptions<TArgs extends [deps: object, options?: object], TResult>(
  factory: (...args: TArgs) => TResult,
) {
  return factory;
}
