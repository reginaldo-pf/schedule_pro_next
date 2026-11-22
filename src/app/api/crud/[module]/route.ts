import { NextResponse } from "next/server";
import { prisma, parseTimeToDate } from "@/lib/prisma";
import {
  getCurrentUser,
  getActiveProject,
  hashDjangoPassword,
  generateUserConfirmationToken,
} from "@/lib/auth";
import { PlanService } from "@/lib/services/access-control";
import { sendUserConfirmationEmail } from "@/lib/email";

export async function POST(
  request: Request,
  context: { params: Promise<{ module: string }> }
) {
  try {
    const { module } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const now = new Date();

    if (module === "plans") {
      if (!user.is_superuser) {
        return NextResponse.json({ ok: false, message: "Sem permissão." }, { status: 403 });
      }
      const plan = await prisma.plans_plan.create({
        data: {
          name: (body.name || "").trim(),
          slug: (body.slug || "").trim().toLowerCase(),
          max_classes: Number(body.max_classes ?? 1),
          max_projects: Number(body.max_projects ?? 1),
          duration_days: Number(body.duration_days ?? 30),
          is_trial: Boolean(body.is_trial),
          price: Number(body.price ?? 0),
          active: body.active !== false,
        },
      });
      return NextResponse.json({
        ok: true,
        id: Number(plan.id),
        message: `Plano ${plan.name} criado com sucesso.`,
      });
    }

    if (module === "users") {
      if (!user.is_superuser) {
        return NextResponse.json({ ok: false, message: "Sem permissão." }, { status: 403 });
      }

      const username = (body.username || "").trim();
      const email = (body.email || "").trim().toLowerCase();
      const firstName = (body.first_name || "").trim();
      const lastName = (body.last_name || "").trim();
      const rawPassword = (body.password || "").trim();
      const sendConfirmation = body.send_confirmation_email !== false;

      if (!username || !email) {
        return NextResponse.json(
          { ok: false, message: "Nome de usuário e e-mail são obrigatórios." },
          { status: 400 }
        );
      }

      if (rawPassword && rawPassword.length < 6) {
        return NextResponse.json(
          { ok: false, message: "A senha deve ter pelo menos 6 caracteres." },
          { status: 400 }
        );
      }

      const existing = await prisma.accounts_user.findFirst({
        where: {
          OR: [
            { username: { equals: username, mode: "insensitive" } },
            { email: { equals: email, mode: "insensitive" } },
          ],
        },
      });

      if (existing) {
        return NextResponse.json(
          { ok: false, message: "Nome de usuário ou e-mail já está cadastrado." },
          { status: 400 }
        );
      }

      const passwordHash = rawPassword
        ? hashDjangoPassword(rawPassword)
        : "!pending_confirmation";

      const createdUser = await prisma.accounts_user.create({
        data: {
          username,
          email,
          first_name: firstName,
          last_name: lastName,
          password: passwordHash,
          profile: body.profile || "coordinator",
          is_active: Boolean(body.is_active),
          is_staff: Boolean(body.is_staff),
          is_superuser: Boolean(body.is_superuser),
          date_joined: now,
          created_at: now,
          updated_at: now,
        },
      });

      if (body.plan_id) {
        const planId = BigInt(body.plan_id);
        const planObj = await prisma.plans_plan.findUnique({ where: { id: planId } });
        const expiresAt =
          planObj && planObj.duration_days > 0
            ? new Date(now.getTime() + planObj.duration_days * 24 * 60 * 60 * 1000)
            : null;
        await prisma.plans_subscription.create({
          data: {
            user_id: createdUser.id,
            plan_id: planId,
            active: body.subscription_active !== false,
            starts_at: now,
            expires_at: expiresAt,
            created_at: now,
            updated_at: now,
          },
        });
      } else {
        await PlanService.createTrialSubscription(createdUser.id);
      }

      let confirmUrl: string | undefined;
      let emailSent = false;
      let emailNotice = "";

      if (sendConfirmation) {
        const token = await generateUserConfirmationToken(
          Number(createdUser.id),
          createdUser.email
        );
        const origin = new URL(request.url).origin;
        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, "");
        confirmUrl = `${siteUrl}/accounts/confirm/${token}`;

        const emailRes = await sendUserConfirmationEmail({
          toEmail: createdUser.email,
          username: createdUser.username,
          firstName: createdUser.first_name || undefined,
          confirmUrl,
          tempPassword: rawPassword || undefined,
          replyTo: user.email || undefined,
        });
        emailSent = emailRes.sent;
        emailNotice = emailRes.sent
          ? ` E-mail de confirmação enviado para ${createdUser.email}.`
          : ` Link de confirmação gerado (${emailRes.error || "copie o link na lista de usuários"}).`;
      }

      return NextResponse.json({
        ok: true,
        id: Number(createdUser.id),
        confirmUrl,
        emailSent,
        message: `Usuário ${createdUser.username} criado com sucesso!${emailNotice}`,
      });
    }

    const project = await getActiveProject(user);
    if (!project) {
      return NextResponse.json(
        { ok: false, message: "Selecione um projeto ativo." },
        { status: 400 }
      );
    }

    switch (module) {
      case "groups": {
        const name = (body.name || "").trim();
        const academicPeriod = (body.academic_period || "").trim();
        const startDateStr = (body.start_date || "").trim();
        const endDateStr = (body.end_date || "").trim();
        const startDate = startDateStr ? new Date(`${startDateStr}T00:00:00.000Z`) : null;
        const endDate = endDateStr ? new Date(`${endDateStr}T00:00:00.000Z`) : null;

        if (!name || !academicPeriod) {
          return NextResponse.json(
            { ok: false, message: "O nome do curso/grupo e o período/semestre são obrigatórios." },
            { status: 400 }
          );
        }
        if (startDate && endDate && endDate < startDate) {
          return NextResponse.json(
            { ok: false, message: "A data de término não pode ser anterior à data de início." },
            { status: 400 }
          );
        }

        const created = await prisma.groups_group.create({
          data: {
            project_id: project.id,
            owner_id: user.id,
            name,
            academic_period: academicPeriod,
            start_date: startDate,
            end_date: endDate,
            created_at: now,
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(created.id),
          message: `Curso/Grupo ${created.name} cadastrado com sucesso.`,
        });
      }

      case "periods": {
        const name = (body.name || "").trim();
        const startTime = parseTimeToDate(body.start_time);
        const endTime = parseTimeToDate(body.end_time);
        const shift = body.shift || "MORNING";
        const periodType = body.period_type || "CLASS";
        const order = Number(body.order ?? 1);

        if (!name || !startTime || !endTime) {
          return NextResponse.json(
            { ok: false, message: "Nome, horário inicial e final são obrigatórios." },
            { status: 400 }
          );
        }

        const created = await prisma.periods_period.create({
          data: {
            project_id: project.id,
            name,
            start_time: startTime,
            end_time: endTime,
            shift,
            period_type: periodType,
            order,
            created_at: now,
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(created.id),
          message: `Período ${created.name} cadastrado com sucesso.`,
        });
      }

      case "rooms": {
        const name = (body.name || "").trim();
        if (!name) {
          return NextResponse.json(
            { ok: false, message: "O nome da sala é obrigatório." },
            { status: 400 }
          );
        }
        const created = await prisma.rooms_room.create({
          data: {
            project_id: project.id,
            owner_id: user.id,
            name,
            description: (body.description || "").trim(),
            capacity: Math.max(1, Number(body.capacity ?? 30)),
            simultaneous_lessons: Math.max(1, Number(body.simultaneous_lessons ?? 1)),
            active: body.active !== false,
            created_at: now,
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(created.id),
          message: `Sala ${created.name} cadastrada com sucesso.`,
        });
      }

      case "teachers": {
        const name = (body.name || "").trim();
        const shortName = (body.short_name || name.slice(0, 20)).trim();
        if (!name || !shortName) {
          return NextResponse.json(
            { ok: false, message: "Nome e abreviação do professor são obrigatórios." },
            { status: 400 }
          );
        }
        const created = await prisma.teachers_teacher.create({
          data: {
            project_id: project.id,
            owner_id: user.id,
            name,
            short_name: shortName,
            email: body.email ? body.email.trim() : null,
            admission_date: body.admission_date ? new Date(body.admission_date) : null,
            color: body.color || "#2c3e50",
            min_lessons_day: Math.max(1, Number(body.min_lessons_day ?? 1)),
            max_lessons_day: Math.max(1, Number(body.max_lessons_day ?? 5)),
            max_lessons_level: Math.max(1, Number(body.max_lessons_level ?? 2)),
            max_lessons_group: Math.max(1, Number(body.max_lessons_group ?? 2)),
            displacement: body.displacement || "NORMAL",
            activity_hours: parseTimeToDate(body.activity_hours),
            external_code: body.external_code ? body.external_code.trim() : null,
            reduce_days: Boolean(body.reduce_days),
            reduce_windows: Boolean(body.reduce_windows),
            active: body.active !== false,
            created_at: now,
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(created.id),
          message: `Professor ${created.name} cadastrado com sucesso.`,
        });
      }

      case "subjects": {
        const name = (body.name || "").trim();
        const abbreviatedName = (body.abbreviated_name || "").trim();
        const groupId = Number(body.group_id);
        if (!name || !abbreviatedName || !groupId) {
          return NextResponse.json(
            {
              ok: false,
              message: "Nome, sigla e curso/grupo da disciplina são obrigatórios.",
            },
            { status: 400 }
          );
        }
        const created = await prisma.subjects_subject.create({
          data: {
            project_id: project.id,
            owner_id: user.id,
            group_id: BigInt(groupId),
            name,
            abbreviated_name: abbreviatedName,
            color: body.color || "#0d6efd",
            room_id: body.room_id ? BigInt(body.room_id) : null,
            active: body.active !== false,
            created_at: now,
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(created.id),
          message: `Disciplina ${created.name} cadastrada com sucesso.`,
        });
      }

      case "classes": {
        if (!(await PlanService.canAddClass(user))) {
          return NextResponse.json(
            {
              ok: false,
              message: "Seu plano atingiu o limite máximo de turmas ativas.",
            },
            { status: 403 }
          );
        }
        const name = (body.name || "").trim();
        const groupId = Number(body.group_id);
        const level = (body.level || "1").trim();
        if (!name || !groupId) {
          return NextResponse.json(
            { ok: false, message: "Nome e curso/grupo da turma são obrigatórios." },
            { status: 400 }
          );
        }
        const shifts: string[] = Array.isArray(body.shifts) ? body.shifts : [];
        const created = await prisma.classes_schoolclass.create({
          data: {
            project_id: project.id,
            responsible_id: user.id,
            group_id: BigInt(groupId),
            name,
            level,
            color: body.color || "#198754",
            room_id: body.room_id ? BigInt(body.room_id) : null,
            shifts,
            active: body.active !== false,
            created_at: now,
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(created.id),
          message: `Turma ${created.name} cadastrada com sucesso.`,
        });
      }

      case "lessons": {
        const subjectId = Number(body.subject_id);
        const classIds: number[] = Array.isArray(body.class_ids)
          ? body.class_ids.map(Number).filter(Boolean)
          : [];
        const teacherIds: number[] = Array.isArray(body.teacher_ids)
          ? body.teacher_ids.map(Number).filter(Boolean)
          : [];

        if (!subjectId || classIds.length === 0 || teacherIds.length === 0) {
          return NextResponse.json(
            {
              ok: false,
              message: "Selecione a disciplina, ao menos uma turma e ao menos um professor.",
            },
            { status: 400 }
          );
        }

        let roomId = body.room_id ? BigInt(body.room_id) : null;
        if (!roomId) {
          const subj = await prisma.subjects_subject.findUnique({
            where: { id: BigInt(subjectId) },
          });
          if (subj?.room_id) roomId = subj.room_id;
        }

        const created = await prisma.lessons_lesson.create({
          data: {
            project_id: project.id,
            subject_id: BigInt(subjectId),
            room_id: roomId,
            number_of_lessons: Math.max(1, Number(body.number_of_lessons ?? 2)),
            max_lessons_per_day: Math.max(1, Number(body.max_lessons_per_day ?? 2)),
            max_days_of_lessons: Math.max(1, Number(body.max_days_of_lessons ?? 5)),
            grouping_type: body.grouping_type || "INDIFERENTE",
            allow_consecutive_days: body.allow_consecutive_days !== false,
            active: body.active !== false,
            created_at: now,
            updated_at: now,
            lessons_lesson_classes: {
              create: classIds.map((cId) => ({
                schoolclass_id: BigInt(cId),
              })),
            },
            lessons_lesson_teachers: {
              create: teacherIds.map((tId) => ({
                teacher_id: BigInt(tId),
              })),
            },
          },
        });

        return NextResponse.json({
          ok: true,
          id: Number(created.id),
          message: "Aula cadastrada com sucesso.",
        });
      }

      default:
        return NextResponse.json(
          { ok: false, message: `Módulo desconhecido: ${module}` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    console.error("[CRUD POST ERROR]", err);
    const msg =
      err instanceof Error && err.message.includes("Unique constraint")
        ? "Já existe um registro com esses dados únicos neste projeto."
        : "Erro ao salvar registro.";
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ module: string }> }
) {
  try {
    const { module } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const id = BigInt(body.id);
    const now = new Date();

    if (module === "plans") {
      if (!user.is_superuser) {
        return NextResponse.json({ ok: false, message: "Sem permissão." }, { status: 403 });
      }
      const plan = await prisma.plans_plan.update({
        where: { id },
        data: {
          name: (body.name || "").trim(),
          slug: (body.slug || "").trim().toLowerCase(),
          max_classes: Number(body.max_classes ?? 1),
          max_projects: Number(body.max_projects ?? 1),
          duration_days: Number(body.duration_days ?? 30),
          is_trial: Boolean(body.is_trial),
          price: Number(body.price ?? 0),
          active: Boolean(body.active),
        },
      });
      return NextResponse.json({
        ok: true,
        id: Number(plan.id),
        message: `Plano ${plan.name} atualizado com sucesso.`,
      });
    }

    if (module === "users") {
      if (!user.is_superuser) {
        return NextResponse.json({ ok: false, message: "Sem permissão." }, { status: 403 });
      }

      const username = (body.username || "").trim();
      const email = (body.email || "").trim().toLowerCase();
      const rawPassword = (body.password || "").trim();

      if (!username || !email) {
        return NextResponse.json(
          { ok: false, message: "Nome de usuário e e-mail são obrigatórios." },
          { status: 400 }
        );
      }

      if (rawPassword && rawPassword.length < 6) {
        return NextResponse.json(
          { ok: false, message: "A nova senha deve ter pelo menos 6 caracteres." },
          { status: 400 }
        );
      }

      const duplicate = await prisma.accounts_user.findFirst({
        where: {
          id: { not: id },
          OR: [
            { username: { equals: username, mode: "insensitive" } },
            { email: { equals: email, mode: "insensitive" } },
          ],
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { ok: false, message: "Nome de usuário ou e-mail já pertence a outra conta." },
          { status: 400 }
        );
      }

      const updatedUser = await prisma.accounts_user.update({
        where: { id },
        data: {
          username,
          email,
          first_name: (body.first_name || "").trim(),
          last_name: (body.last_name || "").trim(),
          profile: body.profile || "coordinator",
          is_active: Boolean(body.is_active),
          is_staff: Boolean(body.is_staff),
          is_superuser: Boolean(body.is_superuser),
          ...(rawPassword ? { password: hashDjangoPassword(rawPassword) } : {}),
          updated_at: now,
        },
      });

      if (body.plan_id) {
        const planId = BigInt(body.plan_id);
        const subActive = Boolean(body.subscription_active);
        const existingSub = await prisma.plans_subscription.findUnique({
          where: { user_id: id },
        });
        if (existingSub) {
          await prisma.plans_subscription.update({
            where: { id: existingSub.id },
            data: {
              plan_id: planId,
              active: subActive,
              updated_at: now,
            },
          });
        } else {
          await prisma.plans_subscription.create({
            data: {
              user_id: id,
              plan_id: planId,
              active: subActive,
              starts_at: now,
              created_at: now,
              updated_at: now,
            },
          });
        }
      }

      let confirmUrl: string | undefined;
      let emailNotice = "";
      if (body.send_confirmation_email) {
        const token = await generateUserConfirmationToken(
          Number(updatedUser.id),
          updatedUser.email
        );
        const origin = new URL(request.url).origin;
        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, "");
        confirmUrl = `${siteUrl}/accounts/confirm/${token}`;

        const emailRes = await sendUserConfirmationEmail({
          toEmail: updatedUser.email,
          username: updatedUser.username,
          firstName: updatedUser.first_name || undefined,
          confirmUrl,
          tempPassword: rawPassword || undefined,
          replyTo: user.email || undefined,
        });
        emailNotice = emailRes.sent
          ? ` E-mail de confirmação enviado para ${updatedUser.email}.`
          : ` Link de confirmação gerado.`;
      }

      return NextResponse.json({
        ok: true,
        id: Number(id),
        confirmUrl,
        message: `Usuário atualizado com sucesso.${emailNotice}`,
      });
    }

    const project = await getActiveProject(user);
    if (!project) {
      return NextResponse.json(
        { ok: false, message: "Selecione um projeto ativo." },
        { status: 400 }
      );
    }

    switch (module) {
      case "groups": {
        const name = (body.name || "").trim();
        const academicPeriod = (body.academic_period || "").trim();
        const startDateStr = (body.start_date || "").trim();
        const endDateStr = (body.end_date || "").trim();
        const startDate = startDateStr ? new Date(`${startDateStr}T00:00:00.000Z`) : null;
        const endDate = endDateStr ? new Date(`${endDateStr}T00:00:00.000Z`) : null;

        if (!name || !academicPeriod) {
          return NextResponse.json(
            { ok: false, message: "O nome do curso/grupo e o período/semestre são obrigatórios." },
            { status: 400 }
          );
        }
        if (startDate && endDate && endDate < startDate) {
          return NextResponse.json(
            { ok: false, message: "A data de término não pode ser anterior à data de início." },
            { status: 400 }
          );
        }

        const updated = await prisma.groups_group.update({
          where: { id },
          data: {
            name,
            academic_period: academicPeriod,
            start_date: startDate,
            end_date: endDate,
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(updated.id),
          message: `Curso/Grupo ${updated.name} atualizado com sucesso.`,
        });
      }

      case "periods": {
        const startTime = parseTimeToDate(body.start_time);
        const endTime = parseTimeToDate(body.end_time);
        const updated = await prisma.periods_period.update({
          where: { id },
          data: {
            name: (body.name || "").trim(),
            ...(startTime ? { start_time: startTime } : {}),
            ...(endTime ? { end_time: endTime } : {}),
            shift: body.shift || "MORNING",
            period_type: body.period_type || "CLASS",
            order: Number(body.order ?? 1),
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(updated.id),
          message: `Período ${updated.name} atualizado com sucesso.`,
        });
      }

      case "rooms": {
        const updated = await prisma.rooms_room.update({
          where: { id },
          data: {
            name: (body.name || "").trim(),
            description: (body.description || "").trim(),
            capacity: Math.max(1, Number(body.capacity ?? 30)),
            simultaneous_lessons: Math.max(1, Number(body.simultaneous_lessons ?? 1)),
            active: Boolean(body.active),
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(updated.id),
          message: `Sala ${updated.name} atualizada com sucesso.`,
        });
      }

      case "teachers": {
        const updated = await prisma.teachers_teacher.update({
          where: { id },
          data: {
            name: (body.name || "").trim(),
            short_name: (body.short_name || "").trim(),
            email: body.email ? body.email.trim() : null,
            admission_date: body.admission_date ? new Date(body.admission_date) : null,
            color: body.color || "#2c3e50",
            min_lessons_day: Math.max(1, Number(body.min_lessons_day ?? 1)),
            max_lessons_day: Math.max(1, Number(body.max_lessons_day ?? 5)),
            max_lessons_level: Math.max(1, Number(body.max_lessons_level ?? 2)),
            max_lessons_group: Math.max(1, Number(body.max_lessons_group ?? 2)),
            displacement: body.displacement || "NORMAL",
            activity_hours: parseTimeToDate(body.activity_hours),
            external_code: body.external_code ? body.external_code.trim() : null,
            reduce_days: Boolean(body.reduce_days),
            reduce_windows: Boolean(body.reduce_windows),
            active: Boolean(body.active),
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(updated.id),
          message: `Professor ${updated.name} atualizado com sucesso.`,
        });
      }

      case "subjects": {
        const updated = await prisma.subjects_subject.update({
          where: { id },
          data: {
            name: (body.name || "").trim(),
            abbreviated_name: (body.abbreviated_name || "").trim(),
            group_id: BigInt(body.group_id),
            color: body.color || "#0d6efd",
            room_id: body.room_id ? BigInt(body.room_id) : null,
            active: Boolean(body.active),
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(updated.id),
          message: `Disciplina ${updated.name} atualizada com sucesso.`,
        });
      }

      case "classes": {
        const shifts: string[] = Array.isArray(body.shifts) ? body.shifts : [];
        const updated = await prisma.classes_schoolclass.update({
          where: { id },
          data: {
            name: (body.name || "").trim(),
            group_id: BigInt(body.group_id),
            level: (body.level || "1").trim(),
            color: body.color || "#198754",
            room_id: body.room_id ? BigInt(body.room_id) : null,
            shifts,
            active: Boolean(body.active),
            updated_at: now,
          },
        });
        return NextResponse.json({
          ok: true,
          id: Number(updated.id),
          message: `Turma ${updated.name} atualizada com sucesso.`,
        });
      }

      case "lessons": {
        const subjectId = Number(body.subject_id);
        const classIds: number[] = Array.isArray(body.class_ids)
          ? body.class_ids.map(Number).filter(Boolean)
          : [];
        const teacherIds: number[] = Array.isArray(body.teacher_ids)
          ? body.teacher_ids.map(Number).filter(Boolean)
          : [];

        await prisma.$transaction([
          prisma.lessons_lesson_classes.deleteMany({ where: { lesson_id: id } }),
          prisma.lessons_lesson_teachers.deleteMany({ where: { lesson_id: id } }),
          prisma.lessons_lesson.update({
            where: { id },
            data: {
              subject_id: BigInt(subjectId),
              room_id: body.room_id ? BigInt(body.room_id) : null,
              number_of_lessons: Math.max(1, Number(body.number_of_lessons ?? 2)),
              max_lessons_per_day: Math.max(1, Number(body.max_lessons_per_day ?? 2)),
              max_days_of_lessons: Math.max(1, Number(body.max_days_of_lessons ?? 5)),
              grouping_type: body.grouping_type || "INDIFERENTE",
              allow_consecutive_days: Boolean(body.allow_consecutive_days),
              active: Boolean(body.active),
              updated_at: now,
              lessons_lesson_classes: {
                create: classIds.map((cId) => ({
                  schoolclass_id: BigInt(cId),
                })),
              },
              lessons_lesson_teachers: {
                create: teacherIds.map((tId) => ({
                  teacher_id: BigInt(tId),
                })),
              },
            },
          }),
        ]);

        return NextResponse.json({
          ok: true,
          id: Number(id),
          message: "Aula atualizada com sucesso.",
        });
      }

      default:
        return NextResponse.json(
          { ok: false, message: `Módulo desconhecido: ${module}` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    console.error("[CRUD PUT ERROR]", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao atualizar registro." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ module: string }> }
) {
  try {
    const { module } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");
    if (!idParam) {
      return NextResponse.json({ ok: false, message: "ID obrigatório." }, { status: 400 });
    }
    const id = BigInt(idParam);

    switch (module) {
      case "users": {
        if (!user.is_superuser) {
          return NextResponse.json(
            { ok: false, message: "Sem permissão." },
            { status: 403 }
          );
        }
        if (id === user.id) {
          return NextResponse.json(
            {
              ok: false,
              message: "Você não pode excluir sua própria conta de administrador.",
            },
            { status: 400 }
          );
        }

        const ownedProjects = await prisma.schedules_project.count({
          where: { owner_id: id },
        });
        if (ownedProjects > 0) {
          return NextResponse.json(
            {
              ok: false,
              message: `Este usuário é proprietário de ${ownedProjects} projeto(s). Exclua ou transfira os projetos antes de remover o usuário.`,
            },
            { status: 400 }
          );
        }

        await prisma.$transaction([
          prisma.plans_subscription.deleteMany({ where: { user_id: id } }),
          prisma.acl_membership.deleteMany({ where: { user_id: id } }),
          prisma.schedules_projectparticipant.deleteMany({ where: { user_id: id } }),
          prisma.accounts_user_groups.deleteMany({ where: { user_id: id } }),
          prisma.accounts_user_user_permissions.deleteMany({ where: { user_id: id } }),
          prisma.django_admin_log.deleteMany({ where: { user_id: id } }),
          prisma.groups_group.updateMany({
            where: { owner_id: id },
            data: { owner_id: null },
          }),
          prisma.rooms_room.updateMany({
            where: { owner_id: id },
            data: { owner_id: null },
          }),
          prisma.subjects_subject.updateMany({
            where: { owner_id: id },
            data: { owner_id: null },
          }),
          prisma.teachers_teacher.updateMany({
            where: { owner_id: id },
            data: { owner_id: null },
          }),
          prisma.classes_schoolclass.updateMany({
            where: { responsible_id: id },
            data: { responsible_id: null },
          }),
          prisma.solver_schedulegenerationrun.updateMany({
            where: { created_by_id: id },
            data: { created_by_id: null },
          }),
          prisma.accounts_user.delete({ where: { id } }),
        ]);

        return NextResponse.json({
          ok: true,
          message: "Usuário removido com sucesso.",
        });
      }

      case "groups": {
        await prisma.$transaction([
          prisma.solver_generatedscheduleentry.deleteMany({
            where: { classes_schoolclass: { group_id: id } },
          }),
          prisma.availability_schoolclassavailability.deleteMany({
            where: { classes_schoolclass: { group_id: id } },
          }),
          prisma.lessons_lesson_classes.deleteMany({
            where: { classes_schoolclass: { group_id: id } },
          }),
          prisma.lessons_lesson_teachers.deleteMany({
            where: { lessons_lesson: { subjects_subject: { group_id: id } } },
          }),
          prisma.lessons_lesson.deleteMany({
            where: { subjects_subject: { group_id: id } },
          }),
          prisma.classes_schoolclass.deleteMany({ where: { group_id: id } }),
          prisma.subjects_subject.deleteMany({ where: { group_id: id } }),
          prisma.groups_group.delete({ where: { id } }),
        ]);
        return NextResponse.json({
          ok: true,
          message: "Curso/Grupo removido com sucesso.",
        });
      }

      case "periods": {
        await prisma.$transaction([
          prisma.solver_generatedscheduleentry.deleteMany({ where: { period_id: id } }),
          prisma.availability_teacheravailability.deleteMany({ where: { period_id: id } }),
          prisma.availability_roomavailability.deleteMany({ where: { period_id: id } }),
          prisma.availability_schoolclassavailability.deleteMany({
            where: { period_id: id },
          }),
          prisma.periods_period.delete({ where: { id } }),
        ]);
        return NextResponse.json({
          ok: true,
          message: "Período removido com sucesso.",
        });
      }

      case "rooms": {
        await prisma.$transaction([
          prisma.availability_roomavailability.deleteMany({ where: { room_id: id } }),
          prisma.solver_generatedscheduleentry.updateMany({
            where: { room_id: id },
            data: { room_id: null },
          }),
          prisma.lessons_lesson.updateMany({
            where: { room_id: id },
            data: { room_id: null },
          }),
          prisma.subjects_subject.updateMany({
            where: { room_id: id },
            data: { room_id: null },
          }),
          prisma.classes_schoolclass.updateMany({
            where: { room_id: id },
            data: { room_id: null },
          }),
          prisma.rooms_room.delete({ where: { id } }),
        ]);
        return NextResponse.json({
          ok: true,
          message: "Sala removida com sucesso.",
        });
      }

      case "teachers": {
        await prisma.$transaction([
          prisma.availability_teacheravailability.deleteMany({
            where: { teacher_id: id },
          }),
          prisma.lessons_lesson_teachers.deleteMany({ where: { teacher_id: id } }),
          prisma.solver_generatedscheduleentry.updateMany({
            where: { teacher_id: id },
            data: { teacher_id: null },
          }),
          prisma.teachers_teacher.delete({ where: { id } }),
        ]);
        return NextResponse.json({
          ok: true,
          message: "Professor removido com sucesso.",
        });
      }

      case "subjects": {
        await prisma.$transaction([
          prisma.solver_generatedscheduleentry.deleteMany({
            where: { lessons_lesson: { subject_id: id } },
          }),
          prisma.lessons_lesson_classes.deleteMany({
            where: { lessons_lesson: { subject_id: id } },
          }),
          prisma.lessons_lesson_teachers.deleteMany({
            where: { lessons_lesson: { subject_id: id } },
          }),
          prisma.lessons_lesson.deleteMany({ where: { subject_id: id } }),
          prisma.subjects_subject.delete({ where: { id } }),
        ]);
        return NextResponse.json({
          ok: true,
          message: "Disciplina removida com sucesso.",
        });
      }

      case "classes": {
        await prisma.$transaction([
          prisma.availability_schoolclassavailability.deleteMany({
            where: { school_class_id: id },
          }),
          prisma.solver_generatedscheduleentry.deleteMany({
            where: { school_class_id: id },
          }),
          prisma.lessons_lesson_classes.deleteMany({
            where: { schoolclass_id: id },
          }),
          prisma.classes_schoolclass.delete({ where: { id } }),
        ]);
        return NextResponse.json({
          ok: true,
          message: "Turma removida com sucesso.",
        });
      }

      case "lessons": {
        await prisma.$transaction([
          prisma.solver_generatedscheduleentry.deleteMany({
            where: { lesson_id: id },
          }),
          prisma.lessons_lesson_classes.deleteMany({ where: { lesson_id: id } }),
          prisma.lessons_lesson_teachers.deleteMany({ where: { lesson_id: id } }),
          prisma.lessons_lesson.delete({ where: { id } }),
        ]);
        return NextResponse.json({
          ok: true,
          message: "Aula removida com sucesso.",
        });
      }

      default:
        return NextResponse.json(
          { ok: false, message: `Módulo desconhecido: ${module}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[CRUD DELETE ERROR]", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao remover registro." },
      { status: 400 }
    );
  }
}
