import {
  queryOptions,
  type DefaultError,
  type QueryKey,
  type UnusedSkipTokenOptions,
} from "@tanstack/react-query";

export function appQueryOptions<
  TArgs extends [deps: object, options?: object],
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(factory: (...args: TArgs) => UnusedSkipTokenOptions<TQueryFnData, TError, TData, TQueryKey>) {
  return (...args: TArgs) => queryOptions(factory(...args));
}
