import { requireShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileClient } from "@/components/accounts/ProfileClient";

export default async function ProfilePage() {
  const {
    user,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext();

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[{ label: "Meu Perfil" }]}
    >
      <ProfileClient
        user={{
          id: Number(user.id),
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          profile: user.profile,
        }}
        subscription={shellSubscription}
      />
    </AppShell>
  );
}
