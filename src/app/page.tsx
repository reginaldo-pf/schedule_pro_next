import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PublicHomeClient } from "@/components/public/PublicHomeClient";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  const projects = await prisma.schedules_project.findMany({
    orderBy: [{ institution_name: "asc" }, { name: "asc" }],
  });

  const serializedProjects = projects.map((p) => ({
    id: Number(p.id),
    name: p.name,
    institution_name: p.institution_name,
    academic_period: p.academic_period,
  }));

  return <PublicHomeClient projects={serializedProjects} />;
}
