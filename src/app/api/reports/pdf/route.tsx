import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getActiveProject } from "@/lib/auth";
import {
  buildCourseReportPages,
  buildTeacherReportPages,
  getActiveProjectDaysList,
} from "@/lib/schedule/report-builder";
import {
  makeDocumentSerial,
  makeReportVerifyToken,
} from "@/lib/reports/verify-token";
import {
  ScheduleMatrixPdfDocument,
  type CourseReportPdfPage,
  type TeacherReportPdfPage,
} from "@/components/reports/pdf/ScheduleMatrixPdfDocument";
import {
  LessonsWorkloadPdfDocument,
  type TeacherWorkloadGroup,
} from "@/components/reports/pdf/LessonsWorkloadPdfDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    errorCorrectionLevel: "M",
    width: 240,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") || "course";
    const orientationParam = sp.get("orientation");
    const orientation: "portrait" | "landscape" =
      orientationParam === "landscape" ? "landscape" : "portrait";

    const groupId = sp.get("group") ? Number(sp.get("group")) : null;
    const classId = sp.get("class") ? Number(sp.get("class")) : null;
    const teacherId = sp.get("teacher") ? Number(sp.get("teacher")) : null;
    const roomId = sp.get("room") ? Number(sp.get("room")) : null;
    const explicitProjectId = sp.get("projectId")
      ? Number(sp.get("projectId"))
      : null;

    const user = await getCurrentUser();
    let project = user ? await getActiveProject(user) : null;

    if (!project && explicitProjectId) {
      project = await prisma.schedules_project.findUnique({
        where: { id: BigInt(explicitProjectId) },
      });
    } else if (!project && classId) {
      const sc = await prisma.classes_schoolclass.findUnique({
        where: { id: BigInt(classId) },
        include: { schedules_project: true },
      });
      project = sc?.schedules_project || null;
    } else if (!project && teacherId) {
      const t = await prisma.teachers_teacher.findUnique({
        where: { id: BigInt(teacherId) },
        include: { schedules_project: true },
      });
      project = t?.schedules_project || null;
    }

    if (!project) {
      return new NextResponse("Projeto não encontrado ou não autorizado.", {
        status: 401,
      });
    }

    const origin =
      req.headers.get("x-forwarded-host") && req.headers.get("x-forwarded-proto")
        ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get(
            "x-forwarded-host"
          )}`
        : req.nextUrl.origin;

    const days = getActiveProjectDaysList(project);
    const projectNumId = Number(project.id);

    // 1. HORÁRIOS POR CURSO E TURMA
    if (type === "course") {
      const { pages, generatedAt } = await buildCourseReportPages({
        projectId: project.id,
        groupId,
        classId,
      });

      const pdfPages: CourseReportPdfPage[] = await Promise.all(
        pages.map(async (p) => {
          const token = makeReportVerifyToken({
            type: "class",
            projectId: projectNumId,
            targetId: p.school_class.id,
          });
          const verifyUrl = `${origin}/reports/verify/${token}`;
          const qrCodeBase64 = await generateQrDataUrl(verifyUrl);
          const serial = makeDocumentSerial(
            "TURMA",
            projectNumId,
            p.school_class.id
          );
          return {
            ...p,
            qrCodeBase64,
            serial,
          };
        })
      );

      const stream = await renderToStream(
        <ScheduleMatrixPdfDocument
          mode="course"
          orientation={orientation}
          projectHeader={{
            name: project.name,
            institution_name: project.institution_name,
            academic_period: project.academic_period,
            report_header: project.report_header,
          }}
          days={days}
          coursePages={pdfPages}
          generatedAt={generatedAt}
          assetsBaseUrl={origin}
        />
      );
      const pdfBuffer = await streamToBuffer(stream);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="horarios-curso-${projectNumId}.pdf"`,
        },
      });
    }

    // 2. HORÁRIOS POR PROFESSOR
    if (type === "teacher") {
      const { pages, generatedAt } = await buildTeacherReportPages({
        projectId: project.id,
        teacherId,
        groupId,
      });

      const pdfPages: TeacherReportPdfPage[] = await Promise.all(
        pages.map(async (p) => {
          const token = makeReportVerifyToken({
            type: "teacher",
            projectId: projectNumId,
            targetId: p.teacher.id,
          });
          const verifyUrl = `${origin}/reports/verify/${token}`;
          const qrCodeBase64 = await generateQrDataUrl(verifyUrl);
          const serial = makeDocumentSerial(
            "DOC",
            projectNumId,
            p.teacher.id
          );
          return {
            ...p,
            qrCodeBase64,
            serial,
          };
        })
      );

      const stream = await renderToStream(
        <ScheduleMatrixPdfDocument
          mode="teacher"
          orientation={orientation}
          projectHeader={{
            name: project.name,
            institution_name: project.institution_name,
            academic_period: project.academic_period,
            report_header: project.report_header,
          }}
          days={days}
          teacherPages={pdfPages}
          generatedAt={generatedAt}
          assetsBaseUrl={origin}
        />
      );
      const pdfBuffer = await streamToBuffer(stream);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="horarios-docente-${projectNumId}.pdf"`,
        },
      });
    }

    // 3. MATRIZ DE AULAS E CARGA HORÁRIA DOCENTE
    if (type === "lessons") {
      const [groups, classes, teachersList, rooms, lessons] = await Promise.all(
        [
          prisma.groups_group.findMany({ where: { project_id: project.id } }),
          prisma.classes_schoolclass.findMany({
            where: { project_id: project.id },
          }),
          prisma.teachers_teacher.findMany({
            where: { project_id: project.id, active: true },
            orderBy: { name: "asc" },
          }),
          prisma.rooms_room.findMany({ where: { project_id: project.id } }),
          prisma.lessons_lesson.findMany({
            where: {
              project_id: project.id,
              active: true,
              ...(groupId
                ? { subjects_subject: { group_id: BigInt(groupId) } }
                : {}),
              ...(classId
                ? {
                    lessons_lesson_classes: {
                      some: { schoolclass_id: BigInt(classId) },
                    },
                  }
                : {}),
              ...(teacherId
                ? {
                    lessons_lesson_teachers: {
                      some: { teacher_id: BigInt(teacherId) },
                    },
                  }
                : {}),
              ...(roomId ? { room_id: BigInt(roomId) } : {}),
            },
            include: {
              subjects_subject: { include: { rooms_room: true } },
              rooms_room: true,
              lessons_lesson_classes: {
                include: { classes_schoolclass: true },
              },
              lessons_lesson_teachers: {
                include: { teachers_teacher: true },
              },
            },
            orderBy: { subjects_subject: { name: "asc" } },
          }),
        ]
      );

      const groupMap = new Map<number, TeacherWorkloadGroup>();

      for (const lesson of lessons) {
        let lTeachers = lesson.lessons_lesson_teachers.map(
          (lt) => lt.teachers_teacher
        );
        if (teacherId) {
          lTeachers = lTeachers.filter((t) => Number(t.id) === teacherId);
        }
        const classNames = lesson.lessons_lesson_classes
          .map((lc) => lc.classes_schoolclass.name)
          .join(", ");
        const roomName =
          lesson.rooms_room?.name ||
          lesson.subjects_subject.rooms_room?.name ||
          "-";

        for (const t of lTeachers) {
          const tId = Number(t.id);
          const existing = groupMap.get(tId) || {
            teacherId: tId,
            teacherName: t.name,
            teacherEmail: t.email,
            totalLessons: 0,
            rows: [],
          };
          existing.rows.push({
            subject: lesson.subjects_subject.name,
            classes: classNames || "-",
            room: roomName,
            number_of_lessons: lesson.number_of_lessons,
          });
          existing.totalLessons += lesson.number_of_lessons;
          groupMap.set(tId, existing);
        }
      }

      const teacherGroups = Array.from(groupMap.values()).sort((a, b) =>
        a.teacherName.localeCompare(b.teacherName)
      );

      const generatedAt = new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const activeFilterLabels: string[] = [];
      if (groupId) {
        const g = groups.find((x) => Number(x.id) === groupId);
        if (g) activeFilterLabels.push(`Curso: ${g.name}`);
      }
      if (classId) {
        const c = classes.find((x) => Number(x.id) === classId);
        if (c) activeFilterLabels.push(`Turma: ${c.name}`);
      }
      if (teacherId) {
        const t = teachersList.find((x) => Number(x.id) === teacherId);
        if (t) activeFilterLabels.push(`Professor: ${t.name}`);
      }
      if (roomId) {
        const r = rooms.find((x) => Number(x.id) === roomId);
        if (r) activeFilterLabels.push(`Sala: ${r.name}`);
      }

      const token = makeReportVerifyToken({
        type: "workload",
        projectId: projectNumId,
        targetId: teacherId || 0,
      });
      const verifyUrl = `${origin}/reports/verify/${token}`;
      const qrCodeBase64 = await generateQrDataUrl(verifyUrl);
      const serial = makeDocumentSerial("MATRIZ", projectNumId, teacherId || 0);

      const stream = await renderToStream(
        <LessonsWorkloadPdfDocument
          projectHeader={{
            name: project.name,
            institution_name: project.institution_name,
            academic_period: project.academic_period,
          }}
          teacherGroups={teacherGroups}
          activeFilterLabels={activeFilterLabels}
          generatedAt={generatedAt}
          serial={serial}
          qrCodeBase64={qrCodeBase64}
          assetsBaseUrl={origin}
        />
      );
      const pdfBuffer = await streamToBuffer(stream);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="relatorio-matriz-docente-${projectNumId}.pdf"`,
        },
      });
    }

    return new NextResponse("Tipo de relatório inválido.", { status: 400 });
  } catch (error) {
    console.error("[GET /api/reports/pdf] Error rendering PDF:", error);
    return new NextResponse("Erro ao renderizar PDF.", { status: 500 });
  }
}
