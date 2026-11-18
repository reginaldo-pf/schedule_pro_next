import { requireShellContext } from "@/lib/shell-context";
import { prisma, formatTime } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { PeriodsClient } from "@/components/crud/PeriodsClient";

export default async function PeriodsPage() {
  const {
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const periods = await prisma.periods_period.findMany({
    where: { project_id: activeProject!.id },
    orderBy: [{ start_time: "asc" }, { shift: "asc" }, { order: "asc" }],
  });

  const serialized = periods.map((p) => ({
    id: Number(p.id),
    name: p.name,
    start_time: formatTime(p.start_time),
    end_time: formatTime(p.end_time),
    shift: p.shift,
    period_type: p.period_type,
    order: p.order,
  }));

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: shellProject?.name || "Projeto", url: "/projects" },
        { label: "Períodos" },
      ]}
    >
      <PeriodsClient
        projectName={shellProject?.name || ""}
        periods={serialized}
      />
    </AppShell>
  );
}
