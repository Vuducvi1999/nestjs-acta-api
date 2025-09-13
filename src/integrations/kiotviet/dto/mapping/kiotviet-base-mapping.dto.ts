export class SyncStats {
  adds: number;
  updates: number;
  skips: number;
  conflicts: number;
  deletes: number;
}

export class KiotVietBaseMapping<T> {
  data: T[];
  groupedStats: Record<
    string,
    {
      components: Array<{
        name: string;
        stats: SyncStats;
        displayName: string;
      }>;
      totalStats: SyncStats;
    }
  >;
}
