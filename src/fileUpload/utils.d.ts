// utils.d.ts
export declare function mapLimit<T, R>(
  data: T[],
  option: MapLimitOptions | null,
  callback: (item: T) => R | Promise<R>
): Promise<Array<{ status: 'fulfilled'; value: R } | { status: 'rejected'; reason: any }>>;

export interface MapLimitOptions {
  limit?: number;
  breakIfError?: (error: any, item: any) => boolean;
}