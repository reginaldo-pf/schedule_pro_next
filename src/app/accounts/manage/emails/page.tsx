import { requireShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/layout/AppShell";
import { AdminEmailsClient } from "@/components/accounts/AdminEmailsClient";
import { getEmailSettings, getRecentEmailLogs } from "@/lib/email-settings";

export default async function AdminEmailsPage() {
  const {
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireSuperuser: true });

  const [settings, logs] = await Promise.all([
    getEmailSettings(),
    getRecentEmailLogs(50),
  ]);

  const envStatus = {
    smtp: Boolean(
      (process.env.EMAIL_HOST || process.env.SMTP_HOST) &&
        (process.env.EMAIL_HOST_USER ||
          process.env.EMAIL_USER ||
          process.env.SMTP_USER) &&
        (process.env.SMTP_PASSWORD ||
          process.env.EMAIL_HOST_PASSWORD ||
          process.env.EMAIL_PASS)
    ),
    postmark: Boolean(
      process.env.POSTMARK_API_KEY || process.env.POSTMARK_SERVER_TOKEN
    ),
    resend: Boolean(process.env.RESEND_API_KEY?.startsWith("re_")),
  };

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: "Administração" },
        { label: "Gestão de E-mails" },
      ]}
    >
      <AdminEmailsClient
        initialSettings={{
          ...settings,
          smtp_pass: settings.smtp_pass ? "__KEEP__" : "",
          postmark_token: settings.postmark_token ? "__KEEP__" : "",
          resend_api_key: settings.resend_api_key ? "__KEEP__" : "",
          has_smtp_pass: Boolean(settings.smtp_pass),
          has_postmark_token: Boolean(settings.postmark_token),
          has_resend_api_key: Boolean(settings.resend_api_key),
        }}
        envStatus={envStatus}
        initialLogs={logs}
      />
    </AppShell>
  );
}
