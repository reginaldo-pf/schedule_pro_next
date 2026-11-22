import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generatePortalToken,
  PUBLIC_PORTAL_TOKEN_TTL_SECONDS,
  verifyPublicAvailabilityRequestToken,
  resolveSiteUrl,
} from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const requestToken = typeof body?.requestToken === "string" ? body.requestToken : "";

  const verified = await verifyPublicAvailabilityRequestToken(requestToken);
  if (!verified) {
    return NextResponse.json(
      {
        ok: false,
        message: "Sessão de busca expirada. Faça a busca por e-mail novamente.",
      },
      { status: 401 }
    );
  }

  const teacher = await prisma.teachers_teacher.findFirst({
    where: {
      id: BigInt(verified.teacherId),
      project_id: BigInt(verified.projectId),
      active: true,
    },
    include: {
      schedules_project: true,
    },
  });

  if (!teacher || !teacher.schedules_project || !teacher.email) {
    return NextResponse.json(
      {
        ok: false,
        message: "Professor ativo com e-mail cadastrado não encontrado.",
      },
      { status: 404 }
    );
  }

  const project = teacher.schedules_project;
  const token = await generatePortalToken(
    Number(teacher.id),
    Number(project.id),
    undefined,
    PUBLIC_PORTAL_TOKEN_TTL_SECONDS
  );

  const siteUrl = resolveSiteUrl(request);
  const portalUrl = `${siteUrl}/teachers/portal/${token}`;

  const subject = `[Schedule Pro] Alteração de Disponibilidade de Horário - ${teacher.name}`;
  const text =
    `Olá, ${teacher.name}.\n\n` +
    `Você solicitou acesso para alterar suas disponibilidades de horário no projeto "${project.name}" (${project.institution_name}).\n\n` +
    `Acesse o seu portal utilizando o link abaixo (válido por 10 minutos):\n\n` +
    `${portalUrl}\n\n` +
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
                Schedule Pro • Consulta Pública
              </div>
              <h2 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">
                Alteração de Disponibilidade Docente
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1e293b;">
                Olá, <strong>${teacher.name}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#334155;">
                Foi solicitado um link de acesso para alteração de suas disponibilidades de horário no projeto <strong>${project.name}</strong> (${project.institution_name}).
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
                * Por segurança, este link é individual e expira em <strong>10 minutos</strong>.
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
  });

  if (!emailResult.sent) {
    return NextResponse.json(
      {
        ok: false,
        message:
          emailResult.error ||
          "Não foi possível enviar o e-mail no momento. Tente novamente ou contate a coordenação.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Link de alteração de disponibilidade enviado para ${teacher.email}! (Válido por 10 minutos)`,
  });
}
