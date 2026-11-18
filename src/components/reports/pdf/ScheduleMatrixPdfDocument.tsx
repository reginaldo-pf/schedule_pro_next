/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { ensurePdfFontsRegistered } from "./pdf-fonts";
import type {
  CourseReportPage,
  TeacherReportPage,
  ReportTimelineRow,
} from "@/lib/schedule/report-builder";

export interface CourseReportPdfPage extends CourseReportPage {
  qrCodeBase64?: string;
  serial: string;
}

export interface TeacherReportPdfPage extends TeacherReportPage {
  qrCodeBase64?: string;
  serial: string;
}

const PERIOD_TYPE_LABELS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  INTERVAL: { label: "INTERVALO", color: "#92400e", bg: "#fef3c7" },
  LUNCH: { label: "INTERVALO DE ALMOÇO", color: "#166534", bg: "#dcfce7" },
  DINNER: { label: "INTERVALO DE JANTAR", color: "#166534", bg: "#dcfce7" },
  SHIFT_CHANGE: { label: "TRANSIÇÃO DE TURNO", color: "#1e40af", bg: "#dbeafe" },
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 24,
    fontFamily: "Inter",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  topSection: {
    flexDirection: "column",
    flexGrow: 1,
  },
  headerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "column",
    flex: 1,
    paddingRight: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  docBadge: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    fontSize: 6.5,
    fontWeight: 700,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  docBadgeAccent: {
    backgroundColor: "#1e3a8a",
  },
  docBadgeTeacher: {
    backgroundColor: "#065f46",
  },
  serialTag: {
    fontSize: 6.5,
    color: "#64748b",
    marginLeft: 8,
    fontWeight: 600,
  },
  institutionName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  mainTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#1e3a8a",
    marginBottom: 4,
  },
  mainTitleTeacher: {
    color: "#065f46",
  },
  metaStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  metaItem: {
    fontSize: 7.2,
    color: "#334155",
    marginRight: 12,
  },
  metaLabel: {
    fontWeight: 700,
    color: "#0f172a",
  },
  qrContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    padding: 4,
    width: 148,
  },
  qrImage: {
    width: 44,
    height: 44,
  },
  qrTextCol: {
    flex: 1,
    paddingLeft: 6,
    flexDirection: "column",
    justifyContent: "center",
  },
  qrTitle: {
    fontSize: 6,
    fontWeight: 700,
    color: "#0f172a",
    textTransform: "uppercase",
    marginBottom: 1.5,
  },
  qrDesc: {
    fontSize: 5.5,
    color: "#475569",
    lineHeight: 1.25,
  },
  tableContainer: {
    width: "100%",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#cbd5e1",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    minHeight: 20,
    alignItems: "center",
  },
  thTime: {
    width: 66,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#334155",
    paddingVertical: 4,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  thDay: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#334155",
    paddingVertical: 4,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  thText: {
    color: "#ffffff",
    fontSize: 7.2,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    width: "100%",
  },
  tdTime: {
    width: 66,
    backgroundColor: "#f8fafc",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  tdDay: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#cbd5e1",
    padding: 2,
    justifyContent: "center",
  },
  tdIntervalFull: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 5,
    marginTop: 6,
  },
  footerText: {
    fontSize: 6.5,
    color: "#64748b",
  },
  footerBold: {
    fontWeight: 700,
    color: "#334155",
  },
});

function computeRowSizing(
  timelineRows: ReportTimelineRow[],
  orientation: "portrait" | "landscape"
) {
  // Total page height: A4 portrait = 841.89pt, A4 landscape = 595.28pt
  const pageHeight = orientation === "landscape" ? 595.28 : 841.89;
  // Overhead: padding (42) + headerCard (~68) + tableHeader (22) + footer (24) = ~156pt
  const availableTableHeight = pageHeight - 158;

  const visibleRows = timelineRows.filter(
    (r, idx) => !(r.type === "interval" && idx === timelineRows.length - 1)
  );
  const periodCount = visibleRows.filter((r) => r.type === "period").length;
  const intervalCount = visibleRows.filter((r) => r.type === "interval").length;

  const intervalHeight = periodCount > 11 ? 13 : 16;
  const remainingForPeriods =
    availableTableHeight - intervalCount * intervalHeight;
  const rawPeriodHeight = Math.floor(
    remainingForPeriods / Math.max(1, periodCount)
  );

  const maxPeriodHeight = orientation === "landscape" ? 48 : 56;
  const periodHeight = Math.max(20, Math.min(maxPeriodHeight, rawPeriodHeight));

  const isUltra = periodHeight < 28;
  const isCompact = periodHeight >= 28 && periodHeight < 38;

  return {
    visibleRows,
    periodHeight,
    intervalHeight,
    shortFontSize: isUltra ? 6.2 : isCompact ? 6.8 : 7.4,
    nameFontSize: isUltra ? 5.6 : isCompact ? 6.2 : 6.8,
    metaFontSize: isUltra ? 5.4 : isCompact ? 5.9 : 6.4,
    timeFontSize: isUltra ? 6.2 : isCompact ? 6.8 : 7.3,
    timeSubFontSize: isUltra ? 5.2 : isCompact ? 5.8 : 6.2,
    showFullSubjectName: periodHeight >= 25,
    maxNameLines: periodHeight >= 42 ? 2 : 1,
  };
}

export function ScheduleMatrixPdfDocument({
  mode,
  orientation,
  projectHeader,
  days,
  coursePages = [],
  teacherPages = [],
  generatedAt,
  assetsBaseUrl,
}: {
  mode: "course" | "teacher";
  orientation: "portrait" | "landscape";
  projectHeader: {
    name: string;
    institution_name: string;
    academic_period: string;
    report_header: string;
  };
  days: { code: string; label: string }[];
  coursePages?: CourseReportPdfPage[];
  teacherPages?: TeacherReportPdfPage[];
  generatedAt: string;
  assetsBaseUrl?: string;
}) {
  ensurePdfFontsRegistered(assetsBaseUrl);

  const list = mode === "course" ? coursePages : teacherPages;
  if (list.length === 0) {
    return (
      <Document title="Relatório de Horários" author="Schedule Pro">
        <Page size="A4" orientation={orientation} style={styles.page}>
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
              Nenhum horário encontrado para os filtros selecionados.
            </Text>
          </View>
        </Page>
      </Document>
    );
  }

  if (mode === "course") {
    return (
      <Document
        title={`Horários por Curso e Turma - ${projectHeader.institution_name}`}
        author="Schedule Pro"
      >
        {coursePages.map((page, pageIdx) => {
          const sizing = computeRowSizing(page.timeline_rows, orientation);

          return (
            <Page
              key={page.school_class.id}
              size="A4"
              orientation={orientation}
              style={styles.page}
              wrap={false}
            >
              <View style={styles.topSection}>
                {/* Corporate Header */}
                <View style={styles.headerCard}>
                  <View style={styles.headerLeft}>
                    <View style={styles.badgeRow}>
                      <Text style={[styles.docBadge, styles.docBadgeAccent]}>
                        GRADE HORÁRIA OFICIAL • TURMA
                      </Text>
                      <Text style={styles.serialTag}>
                        Nº Série: {page.serial}
                      </Text>
                    </View>
                    <Text style={styles.institutionName}>
                      {projectHeader.institution_name}
                    </Text>
                    <Text style={styles.mainTitle}>
                      {page.header_info.group_name} — Turma{" "}
                      {page.header_info.class_name}
                    </Text>
                    <View style={styles.metaStrip}>
                      <Text style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Projeto: </Text>
                        {projectHeader.name}
                      </Text>
                      <Text style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Vigência: </Text>
                        {projectHeader.academic_period || "Atual"}
                      </Text>
                      {page.header_info.room_name ? (
                        <Text style={styles.metaItem}>
                          <Text style={styles.metaLabel}>Local/Sala: </Text>
                          {page.header_info.room_name}
                        </Text>
                      ) : null}
                      <Text style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Carga Alocada: </Text>
                        {page.lesson_count} tempos/semana
                      </Text>
                    </View>
                  </View>

                  {page.qrCodeBase64 && (
                    <View style={styles.qrContainer}>
                      <Image src={page.qrCodeBase64} style={styles.qrImage} />
                      <View style={styles.qrTextCol}>
                        <Text style={styles.qrTitle}>Grade em Tempo Real</Text>
                        <Text style={styles.qrDesc}>
                          Escaneie o QR Code para consultar esta grade sempre
                          atualizada no celular.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Timetable Matrix */}
                <View style={styles.tableContainer}>
                  <View style={styles.tableHeaderRow}>
                    <View style={styles.thTime}>
                      <Text style={styles.thText}>HORÁRIO</Text>
                    </View>
                    {days.map((d) => (
                      <View key={d.code} style={styles.thDay}>
                        <Text style={styles.thText}>{d.label}</Text>
                      </View>
                    ))}
                  </View>

                  {sizing.visibleRows.map((row) => {
                    if (row.type === "interval") {
                      const cfg = PERIOD_TYPE_LABELS[row.period_type] || {
                        label: "INTERVALO",
                        color: "#92400e",
                        bg: "#fef3c7",
                      };
                      return (
                        <View
                          key={row.period.id}
                          style={[
                            styles.tableRow,
                            {
                              height: sizing.intervalHeight,
                              backgroundColor: "#f8fafc",
                            },
                          ]}
                        >
                          <View style={styles.tdTime}>
                            <Text
                              style={{
                                fontSize: sizing.timeSubFontSize,
                                fontWeight: 700,
                                color: "#475569",
                              }}
                            >
                              {row.period.start_time}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.tdIntervalFull,
                              { backgroundColor: cfg.bg },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: sizing.metaFontSize,
                                fontWeight: 700,
                                color: cfg.color,
                              }}
                            >
                              [ {cfg.label} ]{" "}
                            </Text>
                            <Text
                              style={{
                                fontSize: sizing.metaFontSize,
                                color: "#334155",
                                marginLeft: 4,
                              }}
                            >
                              {row.period.name} ({row.period.start_time} às{" "}
                              {row.period.end_time})
                            </Text>
                          </View>
                        </View>
                      );
                    }

                    return (
                      <View
                        key={row.period.id}
                        style={[
                          styles.tableRow,
                          { height: sizing.periodHeight },
                        ]}
                      >
                        <View style={styles.tdTime}>
                          <Text
                            style={{
                              fontSize: sizing.timeFontSize,
                              fontWeight: 700,
                              color: "#0f172a",
                            }}
                          >
                            {row.period.start_time}
                          </Text>
                          <Text
                            style={{
                              fontSize: sizing.timeSubFontSize,
                              color: "#64748b",
                              marginTop: 1,
                            }}
                          >
                            às {row.period.end_time}
                          </Text>
                        </View>

                        {days.map((d) => {
                          const cell = page.matrix[d.code]?.[row.period.id];
                          return (
                            <View key={d.code} style={styles.tdDay}>
                              {cell ? (
                                <View
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    backgroundColor: "#f8fafc",
                                    borderWidth: 0.75,
                                    borderColor: "#e2e8f0",
                                    borderLeftWidth: 3.5,
                                    borderLeftColor:
                                      cell.subject_color || "#1e3a8a",
                                    borderRadius: 2,
                                    paddingHorizontal: 4,
                                    paddingVertical: 1.5,
                                    justifyContent: "center",
                                    overflow: "hidden",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: sizing.shortFontSize,
                                      fontWeight: 700,
                                      color: cell.subject_color || "#0f172a",
                                      textTransform: "uppercase",
                                      maxLines: 1,
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {cell.subject_abbreviated ||
                                      cell.subject_name}
                                  </Text>

                                  {sizing.showFullSubjectName && (
                                    <Text
                                      style={{
                                        fontSize: sizing.nameFontSize,
                                        fontWeight: 600,
                                        color: "#1e293b",
                                        marginTop: 0.5,
                                        lineHeight: 1.15,
                                        maxLines: sizing.maxNameLines,
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {cell.subject_name}
                                    </Text>
                                  )}

                                  {cell.teacher_names ? (
                                    <Text
                                      style={{
                                        fontSize: sizing.metaFontSize,
                                        color: "#334155",
                                        marginTop: 1,
                                        maxLines: 1,
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      Prof: {cell.teacher_names}
                                    </Text>
                                  ) : null}

                                  {cell.room_name ? (
                                    <Text
                                      style={{
                                        fontSize: sizing.metaFontSize - 0.3,
                                        color: "#64748b",
                                        marginTop: 0.5,
                                        maxLines: 1,
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      Sala: {cell.room_name}
                                    </Text>
                                  ) : null}
                                </View>
                              ) : (
                                <View
                                  style={{
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 8,
                                      color: "#cbd5e1",
                                    }}
                                  >
                                    —
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Corporate Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  <Text style={styles.footerBold}>
                    {projectHeader.institution_name}
                  </Text>{" "}
                  • Sistema Corporativo Schedule Pro • Autenticação:{" "}
                  {page.serial}
                </Text>
                <Text style={styles.footerText}>
                  Emitido em: {generatedAt || new Date().toLocaleDateString("pt-BR")} •
                  Página {pageIdx + 1} de {coursePages.length}
                </Text>
              </View>
            </Page>
          );
        })}
      </Document>
    );
  }

  return (
    <Document
      title={`Horários por Professor - ${projectHeader.institution_name}`}
      author="Schedule Pro"
    >
      {teacherPages.map((page, pageIdx) => {
        const sizing = computeRowSizing(page.timeline_rows, orientation);

        return (
          <Page
            key={page.teacher.id}
            size="A4"
            orientation={orientation}
            style={styles.page}
            wrap={false}
          >
            <View style={styles.topSection}>
              {/* Corporate Header */}
              <View
                style={[styles.headerCard, { borderBottomColor: "#065f46" }]}
              >
                <View style={styles.headerLeft}>
                  <View style={styles.badgeRow}>
                    <Text style={[styles.docBadge, styles.docBadgeTeacher]}>
                      GRADE HORÁRIA OFICIAL • DOCENTE
                    </Text>
                    <Text style={styles.serialTag}>
                      Nº Série: {page.serial}
                    </Text>
                  </View>
                  <Text style={styles.institutionName}>
                    {projectHeader.institution_name}
                  </Text>
                  <Text style={[styles.mainTitle, styles.mainTitleTeacher]}>
                    Docente: {page.teacher.name}
                  </Text>
                  <View style={styles.metaStrip}>
                    <Text style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Projeto: </Text>
                      {projectHeader.name}
                    </Text>
                    {page.group_names ? (
                      <Text style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Curso(s): </Text>
                        {page.group_names}
                      </Text>
                    ) : null}
                    <Text style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Vigência: </Text>
                      {projectHeader.academic_period || "Atual"}
                    </Text>
                    {page.teacher.email ? (
                      <Text style={styles.metaItem}>
                        <Text style={styles.metaLabel}>E-mail: </Text>
                        {page.teacher.email}
                      </Text>
                    ) : null}
                    <Text style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Carga Alocada: </Text>
                      {page.lesson_count} tempos/semana
                    </Text>
                  </View>
                </View>

                {page.qrCodeBase64 && (
                  <View style={styles.qrContainer}>
                    <Image src={page.qrCodeBase64} style={styles.qrImage} />
                    <View style={styles.qrTextCol}>
                      <Text style={styles.qrTitle}>Grade em Tempo Real</Text>
                      <Text style={styles.qrDesc}>
                        Escaneie o QR Code para consultar seu horário sempre
                        atualizado no celular.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Timetable Matrix */}
              <View style={styles.tableContainer}>
                <View
                  style={[
                    styles.tableHeaderRow,
                    { backgroundColor: "#064e3b" },
                  ]}
                >
                  <View style={styles.thTime}>
                    <Text style={styles.thText}>HORÁRIO</Text>
                  </View>
                  {days.map((d) => (
                    <View key={d.code} style={styles.thDay}>
                      <Text style={styles.thText}>{d.label}</Text>
                    </View>
                  ))}
                </View>

                {sizing.visibleRows.map((row) => {
                  if (row.type === "interval") {
                    const cfg = PERIOD_TYPE_LABELS[row.period_type] || {
                      label: "INTERVALO",
                      color: "#92400e",
                      bg: "#fef3c7",
                    };
                    return (
                      <View
                        key={row.period.id}
                        style={[
                          styles.tableRow,
                          {
                            height: sizing.intervalHeight,
                            backgroundColor: "#f8fafc",
                          },
                        ]}
                      >
                        <View style={styles.tdTime}>
                          <Text
                            style={{
                              fontSize: sizing.timeSubFontSize,
                              fontWeight: 700,
                              color: "#475569",
                            }}
                          >
                            {row.period.start_time}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdIntervalFull,
                            { backgroundColor: cfg.bg },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: sizing.metaFontSize,
                              fontWeight: 700,
                              color: cfg.color,
                            }}
                          >
                            [ {cfg.label} ]{" "}
                          </Text>
                          <Text
                            style={{
                              fontSize: sizing.metaFontSize,
                              color: "#334155",
                              marginLeft: 4,
                            }}
                          >
                            {row.period.name} ({row.period.start_time} às{" "}
                            {row.period.end_time})
                          </Text>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={row.period.id}
                      style={[styles.tableRow, { height: sizing.periodHeight }]}
                    >
                      <View style={styles.tdTime}>
                        <Text
                          style={{
                            fontSize: sizing.timeFontSize,
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {row.period.start_time}
                        </Text>
                        <Text
                          style={{
                            fontSize: sizing.timeSubFontSize,
                            color: "#64748b",
                            marginTop: 1,
                          }}
                        >
                          às {row.period.end_time}
                        </Text>
                      </View>

                      {days.map((d) => {
                        const cell = page.matrix[d.code]?.[row.period.id];
                        return (
                          <View key={d.code} style={styles.tdDay}>
                            {cell ? (
                              <View
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  backgroundColor: "#f8fafc",
                                  borderWidth: 0.75,
                                  borderColor: "#e2e8f0",
                                  borderLeftWidth: 3.5,
                                  borderLeftColor:
                                    cell.subject_color || "#065f46",
                                  borderRadius: 2,
                                  paddingHorizontal: 4,
                                  paddingVertical: 1.5,
                                  justifyContent: "center",
                                  overflow: "hidden",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: sizing.shortFontSize,
                                    fontWeight: 700,
                                    color: cell.subject_color || "#0f172a",
                                    textTransform: "uppercase",
                                    maxLines: 1,
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {cell.subject_abbreviated ||
                                    cell.subject_name}
                                </Text>

                                <Text
                                  style={{
                                    fontSize: sizing.metaFontSize,
                                    fontWeight: 700,
                                    color: "#166534",
                                    marginTop: 0.5,
                                    maxLines: 1,
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  Turma: {cell.class_name}
                                </Text>

                                {sizing.showFullSubjectName && (
                                  <Text
                                    style={{
                                      fontSize: sizing.nameFontSize,
                                      fontWeight: 400,
                                      color: "#334155",
                                      marginTop: 0.5,
                                      lineHeight: 1.15,
                                      maxLines: 1,
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {cell.subject_name}
                                  </Text>
                                )}

                                {cell.room_name ? (
                                  <Text
                                    style={{
                                      fontSize: sizing.metaFontSize - 0.3,
                                      color: "#64748b",
                                      marginTop: 0.5,
                                      maxLines: 1,
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    Sala: {cell.room_name}
                                  </Text>
                                ) : null}
                              </View>
                            ) : (
                              <View
                                style={{
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 8,
                                    color: "#cbd5e1",
                                  }}
                                >
                                  —
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Corporate Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                <Text style={styles.footerBold}>
                  {projectHeader.institution_name}
                </Text>{" "}
                • Sistema Corporativo Schedule Pro • Autenticação: {page.serial}
              </Text>
              <Text style={styles.footerText}>
                Emitido em: {generatedAt || new Date().toLocaleDateString("pt-BR")} •
                Página {pageIdx + 1} de {teacherPages.length}
              </Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
