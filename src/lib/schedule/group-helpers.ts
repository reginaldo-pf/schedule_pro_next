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
