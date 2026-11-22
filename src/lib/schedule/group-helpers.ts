export type GroupStatus = "PREVIEW" | "PUBLISHED" | "INACTIVE";

export const GROUP_STATUS_META: Record<
  GroupStatus,
  { label: string; badgeClass: string; icon: string }
> = {
  PREVIEW: {
    label: "Prévia",
    badgeClass: "bg-warning-subtle text-warning-emphasis border border-warning-subtle",
    icon: "bi-eye-slash",
  },
  PUBLISHED: {
    label: "Publicado",
    badgeClass: "bg-success-subtle text-success border border-success-subtle",
    icon: "bi-check-circle-fill",
  },
  INACTIVE: {
    label: "Inativo",
    badgeClass: "bg-secondary-subtle text-secondary border border-secondary-subtle",
    icon: "bi-archive",
  },
};

export function normalizeGroupStatus(status?: string | null): GroupStatus {
  if (status === "PREVIEW" || status === "INACTIVE" || status === "PUBLISHED") {
    return status;
  }
  return "PUBLISHED";
}

export function formatGroupSelectLabel(group: {
  name: string;
  academic_period?: string | null;
  status?: string | null;
}): string {
  const base = group.academic_period
    ? `${group.name} (${group.academic_period})`
    : group.name;
  const st = normalizeGroupStatus(group.status);
  if (st === "PREVIEW") return `${base} • Prévia`;
  if (st === "INACTIVE") return `${base} • Inativo`;
  return base;
}

export function parseCsvParam(val?: string | null): string[] {
  if (!val) return [];
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveGroupIdsParam<T extends { id: bigint }>(
  groups: T[],
  groupsCsv?: string | null,
  legacyGroupParam?: string | null
): bigint[] {
  const validIds = new Set(groups.map((g) => Number(g.id)));
  const parsed = parseCsvParam(groupsCsv)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0 && validIds.has(n));

  if (parsed.length > 0) {
    return parsed.map((n) => BigInt(n));
  }
  if (legacyGroupParam === "ALL") {
    return groups.map((g) => g.id);
  }
  if (legacyGroupParam && Number(legacyGroupParam) && validIds.has(Number(legacyGroupParam))) {
    return [BigInt(legacyGroupParam)];
  }
  return [];
}

export function buildGroupCheckboxOptions<
  T extends { id: bigint; name: string; academic_period: string; status?: string | null }
>(groups: T[]) {
  return groups.map((g) => {
    const st = normalizeGroupStatus(g.status);
    return {
      value: String(Number(g.id)),
      label: g.academic_period ? `${g.name} (${g.academic_period})` : g.name,
      badge: st === "PREVIEW" ? "Prévia" : "Publicado",
      badgeClass:
        st === "PREVIEW"
          ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle"
          : "bg-success-subtle text-success border border-success-subtle",
    };
  });
}

export interface DateRange {
  start_date: string | null;
  end_date: string | null;
}

export function toIsoDateStr(val?: Date | string | null): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (!s) return null;
  return s.slice(0, 10);
}

/**
 * Checks whether two date ranges [startA, endA] and [startB, endB] overlap.
 * Open-ended bounds (null) are treated as unbounded, so missing dates safely overlap.
 */
export function doDateRangesOverlap(a: DateRange, b: DateRange): boolean {
  const aStart = a.start_date || "0000-01-01";
  const aEnd = a.end_date || "9999-12-31";
  const bStart = b.start_date || "0000-01-01";
  const bEnd = b.end_date || "9999-12-31";
  return aStart <= bEnd && aEnd >= bStart;
}

/**
 * Checks whether any group in groupIdsA overlaps in duration with any group in groupIdsB.
 * If either list is empty or a group is missing from the map, returns true (safe fallback).
 */
export function doGroupListsOverlap(
  groupIdsA: number[],
  groupIdsB: number[],
  groupRanges: Map<number, DateRange>
): boolean {
  if (groupIdsA.length === 0 || groupIdsB.length === 0) return true;
  for (const idA of groupIdsA) {
    for (const idB of groupIdsB) {
      if (idA === idB) return true;
      const rangeA = groupRanges.get(idA);
      const rangeB = groupRanges.get(idB);
      if (!rangeA || !rangeB) return true;
      if (doDateRangesOverlap(rangeA, rangeB)) return true;
    }
  }
  return false;
}

/**
 * Computes the effective bounding date range for a list of group IDs.
 */
export function getCombinedDateRange(
  groupIds: number[],
  groupRanges: Map<number, DateRange>
): DateRange {
  if (groupIds.length === 0) return { start_date: null, end_date: null };
  let minStart: string | null = null;
  let maxEnd: string | null = null;
  let hasOpenStart = false;
  let hasOpenEnd = false;

  for (const gId of groupIds) {
    const r = groupRanges.get(gId);
    if (!r) return { start_date: null, end_date: null };
    if (!r.start_date) hasOpenStart = true;
    else if (minStart === null || r.start_date < minStart) minStart = r.start_date;

    if (!r.end_date) hasOpenEnd = true;
    else if (maxEnd === null || r.end_date > maxEnd) maxEnd = r.end_date;
  }

  return {
    start_date: hasOpenStart ? null : minStart,
    end_date: hasOpenEnd ? null : maxEnd,
  };
}

/**
 * Given a candidate unit's DateRange and a list of already-assigned DateRanges
 * on the same day, returns the maximum number of ranges (including the candidate)
 * that are simultaneously active on any date within the candidate's duration.
 */
export function maxSimultaneousInRange(
  candidate: DateRange,
  existing: DateRange[]
): number {
  const cStart = candidate.start_date || "0000-01-01";
  const cEnd = candidate.end_date || "9999-12-31";

  const overlapping = existing.filter((e) => doDateRangesOverlap(candidate, e));
  if (overlapping.length === 0) return 1;

  const checkPoints = new Set<string>([cStart]);
  for (const e of overlapping) {
    const eStart = e.start_date || "0000-01-01";
    const pt = eStart > cStart ? eStart : cStart;
    if (pt <= cEnd) checkPoints.add(pt);
  }

  let maxCount = 1;
  for (const pt of checkPoints) {
    let count = 1;
    for (const e of overlapping) {
      const eStart = e.start_date || "0000-01-01";
      const eEnd = e.end_date || "9999-12-31";
      if (eStart <= pt && eEnd >= pt) {
        count++;
      }
    }
    if (count > maxCount) maxCount = count;
  }
  return maxCount;
}
