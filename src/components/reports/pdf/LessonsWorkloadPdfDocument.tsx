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

export interface TeacherWorkloadGroup {
  teacherId: number;
  teacherName: string;
  teacherEmail?: string | null;
  totalLessons: number;
  rows: {
    subject: string;
    classes: string;
    room: string;
    number_of_lessons: number;
  }[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 38,
    paddingHorizontal: 28,
    fontFamily: "Inter",
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  headerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 10,
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  docBadge: {
    backgroundColor: "#0284c7",
    color: "#ffffff",
    fontSize: 6.5,
    fontWeight: 700,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  serialTag: {
    fontSize: 6.5,
    color: "#64748b",
    marginLeft: 8,
    fontWeight: 600,
  },
  institutionName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  reportTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#0369a1",
    marginBottom: 5,
  },
  metaStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  metaItem: {
    fontSize: 7.2,
    color: "#334155",
    marginRight: 14,
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
    padding: 5,
    width: 152,
  },
  qrImage: {
    width: 46,
    height: 46,
  },
  qrTextCol: {
    flex: 1,
    paddingLeft: 6,
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
  teacherSection: {
    marginBottom: 12,
  },
  teacherBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderLeftWidth: 4,
    borderLeftColor: "#0284c7",
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  teacherName: {
    fontSize: 8.5,
    fontWeight: 700,
    color: "#0f172a",
  },
  teacherBadge: {
    backgroundColor: "#0284c7",
    color: "#ffffff",
    fontSize: 7,
    fontWeight: 700,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
  },
  table: {
    width: "100%",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#cbd5e1",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
  },
  th: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#334155",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  thText: {
    fontSize: 7,
    fontWeight: 700,
    color: "#ffffff",
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
  },
  td: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  tdText: {
    fontSize: 7.5,
    color: "#1e293b",
    lineHeight: 1.25,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 5,
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

export function LessonsWorkloadPdfDocument({
  projectHeader,
  teacherGroups,
  activeFilterLabels,
  generatedAt,
  serial,
  qrCodeBase64,
}: {
  projectHeader: {
    name: string;
    institution_name: string;
    academic_period: string;
  };
  teacherGroups: TeacherWorkloadGroup[];
  activeFilterLabels: string[];
  generatedAt: string;
  serial: string;
  qrCodeBase64?: string;
}) {
  ensurePdfFontsRegistered();

  const grandTotalLessons = teacherGroups.reduce(
    (acc, g) => acc + g.totalLessons,
    0
  );

  return (
    <Document
      title={`Matriz e Carga Horária Docente - ${projectHeader.institution_name}`}
      author="Schedule Pro"
    >
      <Page size="A4" orientation="portrait" style={styles.page}>
        {/* Corporate Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <View style={styles.badgeRow}>
              <Text style={styles.docBadge}>
                RELATÓRIO CORPORATIVO • MATRIZ DOCENTE
              </Text>
              <Text style={styles.serialTag}>Nº Série: {serial}</Text>
            </View>
            <Text style={styles.institutionName}>
              {projectHeader.institution_name}
            </Text>
            <Text style={styles.reportTitle}>
              Distribuição Consolidada de Aulas e Carga Horária Semanal
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
              <Text style={styles.metaItem}>
                <Text style={styles.metaLabel}>Docentes: </Text>
                {teacherGroups.length}
              </Text>
              <Text style={styles.metaItem}>
                <Text style={styles.metaLabel}>Total Geral: </Text>
                {grandTotalLessons} tempos/semana
              </Text>
              {activeFilterLabels.length > 0 && (
                <Text style={[styles.metaItem, { marginTop: 2 }]}>
                  <Text style={styles.metaLabel}>Filtros Aplicados: </Text>
                  {activeFilterLabels.join(" | ")}
                </Text>
              )}
            </View>
          </View>

          {qrCodeBase64 && (
            <View style={styles.qrContainer}>
              <Image src={qrCodeBase64} style={styles.qrImage} />
              <View style={styles.qrTextCol}>
                <Text style={styles.qrTitle}>Validação em Tempo Real</Text>
                <Text style={styles.qrDesc}>
                  Escaneie o QR Code para verificar a matriz docente atualizada
                  on-line.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Teacher Blocks */}
        {teacherGroups.map((group) => (
          <View
            key={group.teacherName}
            style={styles.teacherSection}
            wrap={group.rows.length > 14}
          >
            <View style={styles.teacherBanner}>
              <Text style={styles.teacherName}>{group.teacherName}</Text>
              <Text style={styles.teacherBadge}>
                Carga Total: {group.totalLessons} tempos/semana
              </Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <View style={[styles.th, { width: "40%" }]}>
                  <Text style={styles.thText}>DISCIPLINA</Text>
                </View>
                <View style={[styles.th, { width: "26%" }]}>
                  <Text style={styles.thText}>TURMA(S)</Text>
                </View>
                <View style={[styles.th, { width: "22%" }]}>
                  <Text style={styles.thText}>SALA / LOCAL</Text>
                </View>
                <View
                  style={[
                    styles.th,
                    { width: "12%", alignItems: "center" },
                  ]}
                >
                  <Text style={styles.thText}>TEMPOS</Text>
                </View>
              </View>

              {group.rows.map((row, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tr,
                    {
                      backgroundColor: idx % 2 === 1 ? "#f8fafc" : "#ffffff",
                    },
                  ]}
                  wrap={false}
                >
                  <View style={[styles.td, { width: "40%" }]}>
                    <Text style={[styles.tdText, { fontWeight: 600 }]}>
                      {row.subject}
                    </Text>
                  </View>
                  <View style={[styles.td, { width: "26%" }]}>
                    <Text style={styles.tdText}>{row.classes}</Text>
                  </View>
                  <View style={[styles.td, { width: "22%" }]}>
                    <Text style={styles.tdText}>{row.room}</Text>
                  </View>
                  <View
                    style={[
                      styles.td,
                      { width: "12%", alignItems: "center" },
                    ]}
                  >
                    <Text style={[styles.tdText, { fontWeight: 700 }]}>
                      {row.number_of_lessons}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Fixed Corporate Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            <Text style={styles.footerBold}>
              {projectHeader.institution_name}
            </Text>{" "}
            • Schedule Pro • Autenticação: {serial} • Emitido em {generatedAt}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
