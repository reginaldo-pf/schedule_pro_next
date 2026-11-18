import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  getActiveProject,
  generatePortalToken,
} from "@/lib/auth";
import { sendEmailViaBrevo } from "@/lib/email";

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

  const teacher = await prisma.teachers_teacher.findFirst({
    where: { id: teacherId, project_id: project.id },
  });
  if (!teacher) {
    return NextResponse.json(
      { ok: false, message: "Professor não encontrado." },
      { status: 404 }
    );
  }

  const token = await generatePortalToken(Number(teacher.id), Number(project.id));
  const origin = new URL(request.url).origin;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, "");
  const portalUrl = `${siteUrl}/teachers/portal/${token}`;

  if (!teacher.email) {
    return NextResponse.json({
      ok: true,
      portalUrl,
      message: `Link do Portal gerado! (O professor ${teacher.name} não possui e-mail cadastrado, copie o link diretamente).`,
    });
  }

  const subject = `[Gerenciador de Horários] Solicitação de Disponibilidade - ${teacher.name}`;
  const text =
    `Olá, ${teacher.name}.\n\n` +
    `O coordenador do projeto ${project.name} na instituição ${project.institution_name} ` +
    `solicitou que você informe suas preferências e disponibilidades de horário para o período acadêmico ${project.academic_period}.\n\n` +
    `Por favor, acesse o seu portal exclusivo utilizando o link abaixo (não é necessário login ou senha):\n\n` +
    `${portalUrl}\n\n` +
    `Este link é de uso exclusivo e expira em 48 horas.\n\n` +
    `Atenciosamente,\nEquipe Schedule Pro`;

  const sent = await sendEmailViaBrevo({
    to: [teacher.email],
    subject,
    text,
  });

  await prisma.teachers_teacher.update({
    where: { id: teacher.id },
    data: { last_invited_at: new Date() },
  });

  return NextResponse.json({
    ok: true,
    portalUrl,
    sent,
    message: sent
      ? `Convite enviado com sucesso para ${teacher.name} (${teacher.email})!`
      : `Link gerado para ${teacher.name}! Copie o link do portal abaixo.`,
  });
}
