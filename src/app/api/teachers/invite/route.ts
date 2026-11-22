import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  getActiveProject,
  generatePortalToken,
} from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const project = await getActiveProject(user);
  if (!user || !project) {
    return NextResponse.json(
      { ok: false, message: "Selecione um projeto ativo." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const teacherId = BigInt(body.teacherId);
  const shouldSendEmail = body.sendEmail !== false;

  const teacher = await prisma.teachers_teacher.findFirst({
    where: { id: teacherId, project_id: project.id },
  });
  if (!teacher) {
    return NextResponse.json(
      { ok: false, message: "Professor não encontrado." },
      { status: 404 }
    );
  }

  const issuedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  const token = await generatePortalToken(
    Number(teacher.id),
    Number(project.id),
    issuedAt
  );
  const origin = new URL(request.url).origin;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(
    /\/$/,
    ""
  );
  const portalUrl = `${siteUrl}/teachers/portal/${token}`;

  await prisma.teachers_teacher.update({
    where: { id: teacher.id },
    data: { last_invited_at: issuedAt },
  });

  if (!shouldSendEmail) {
    return NextResponse.json({
      ok: true,
      token,
      portalUrl,
      message: `Link de disponibilidade gerado para ${teacher.name}!`,
    });
  }

  if (!teacher.email) {
    return NextResponse.json({
      ok: true,
      token,
      portalUrl,
      message: `Link do Portal gerado! (O professor ${teacher.name} não possui e-mail cadastrado, copie o link diretamente).`,
    });
  }

  const subject = `[Schedule Pro] Solicitação de Disponibilidade de Horário - ${teacher.name}`;
  const text =
    `Olá, ${teacher.name}.\n\n` +
    `A coordenação do projeto "${project.name}" na instituição ${project.institution_name} ` +
    `solicitou que você informe suas preferências e disponibilidades de horário para o período acadêmico ${project.academic_period}.\n\n` +
    `Acesse o seu portal exclusivo utilizando o link abaixo (não é necessário login ou senha):\n\n` +
    `${portalUrl}\n\n` +
    `Este link é de uso exclusivo e expira em 48 horas.\n\n` +
    `AVISO: Este é um e-mail automático enviado pelo sistema. Por favor, não responda a esta mensagem.\n\n` +
    `Atenciosamente,\nEquipe Schedule Pro`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Inter,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);padding:24px 32px;color:#ffffff;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#93c5fd;margin-bottom:4px;">
                Schedule Pro • Gestão Acadêmica
              </div>
              <h2 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">
                Solicitação de Disponibilidade Docente
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1e293b;">
                Olá, <strong>${teacher.name}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#334155;">
                A coordenação do projeto <strong>${project.name}</strong> na instituição <strong>${project.institution_name}</strong> solicitou o preenchimento de suas preferências e disponibilidades de horário para o período letivo <strong>${project.academic_period}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:14.5px;line-height:1.6;color:#334155;">
                Clique no botão abaixo para acessar seu <strong>Portal Exclusivo do Docente</strong> (não é necessário login ou senha):
              </p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#1e3a8a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14.5px;padding:13px 28px;border-radius:6px;">
                  Acessar Portal de Disponibilidade
                </a>
              </div>
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;margin-top:20px;">
                <div style="font-size:12px;color:#64748b;margin-bottom:4px;">
                  Ou copie e cole o link abaixo no seu navegador:
                </div>
                <div style="font-size:12px;color:#1e3a8a;word-break:break-all;">
                  ${portalUrl}
                </div>
              </div>
              <p style="margin:20px 0 0;font-size:12.5px;color:#64748b;">
                * Este link é individual e válido por 48 horas.
              </p>
              <div style="background-color:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;margin-top:16px;font-size:12.5px;color:#92400e;">
                <strong>Aviso:</strong> Este é um e-mail automático enviado pelo sistema. Por favor, <strong>não responda</strong> a esta mensagem.
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;font-size:12px;color:#64748b;text-align:center;">
              <strong>${project.institution_name}</strong> • Enviado via Schedule Pro
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const emailResult = await sendEmail({
    to: [teacher.email],
    subject,
    text,
    html,
    replyTo: user.email || undefined,
  });

  return NextResponse.json({
    ok: true,
    token,
    portalUrl,
    sent: emailResult.sent,
    provider: emailResult.provider,
    error: emailResult.error,
    message: emailResult.sent
      ? `Convite enviado com sucesso para ${teacher.name} (${teacher.email})!`
      : `Link do Portal gerado para ${teacher.name}! (${
          emailResult.error || "Copie o link diretamente"
        })`,
  });
}
