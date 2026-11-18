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
import type { TeacherWorkloadGroup } from "./LessonsWorkloadPdfDocument";

export interface TeacherCertificateItem extends TeacherWorkloadGroup {
  serial: string;
  qrCodeBase64?: string;
  coordinatorName?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Inter",
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  outerFrame: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#0f172a",
    padding: 4,
  },
  innerFrame: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: "#94a3b8",
    paddingHorizontal: 52,
    paddingVertical: 30,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1e3a8a",
    paddingBottom: 10,
  },
  institutionBlock: {
    flexDirection: "column",
  },
  badgeText: {
    fontSize: 7,
    fontWeight: 700,
    color: "#1e3a8a",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  institutionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    textTransform: "uppercase",
  },
  projectMeta: {
    fontSize: 8.5,
    color: "#475569",
    marginTop: 2,
  },
  serialTopBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: "flex-end",
  },
  serialLabel: {
    fontSize: 6.5,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  serialValue: {
    fontSize: 8,
    fontWeight: 700,
    color: "#0f172a",
    marginTop: 1,
  },
  centerContent: {
    flexDirection: "column",
    justifyContent: "center",
    marginVertical: 14,
  },
  certTitle: {
    fontFamily: "Playfair",
    fontSize: 28,
    fontWeight: 700,
    textAlign: "center",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  certSubtitle: {
    fontSize: 9.5,
    fontWeight: 700,
    textAlign: "center",
    color: "#1e3a8a",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  divider: {
    height: 1.5,
    backgroundColor: "#cbd5e1",
    width: "45%",
    alignSelf: "center",
    marginVertical: 14,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 1.65,
    color: "#1e293b",
    textAlign: "justify",
  },
  bold: {
    fontWeight: 700,
    color: "#0f172a",
  },
  issueDateLine: {
    fontSize: 10.5,
    color: "#334155",
    textAlign: "right",
    marginTop: 16,
    fontWeight: 600,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 16,
  },
  signaturesGroup: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingRight: 20,
  },
  signCol: {
    width: "44%",
    alignItems: "center",
  },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
    width: "100%",
    marginBottom: 5,
  },
  signName: {
    fontSize: 9.5,
    fontWeight: 700,
    color: "#0f172a",
    textAlign: "center",
  },
  signRole: {
    fontSize: 8,
    color: "#64748b",
    textAlign: "center",
    marginTop: 1,
  },
  qrBoxFront: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    padding: 6,
    width: 175,
  },
  qrImgFront: {
    width: 54,
    height: 54,
  },
  qrTextCol: {
    flex: 1,
    paddingLeft: 7,
  },
  qrTitle: {
    fontSize: 6.5,
    fontWeight: 700,
    color: "#0f172a",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  qrDesc: {
    fontSize: 6,
    color: "#475569",
    lineHeight: 1.3,
  },
  // Verso styles
  versoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 12,
  },
  versoTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#0f172a",
    textTransform: "uppercase",
  },
  versoSubtitle: {
    fontSize: 8.5,
    color: "#475569",
    marginTop: 2,
  },
  syllabusBox: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  thText: {
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tdText: {
    fontSize: 8,
    color: "#1e293b",
  },
  versoFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 8,
    marginTop: 12,
  },
  footNote: {
    fontSize: 7.5,
    color: "#64748b",
  },
});

export function TeacherWorkloadCertificatePdfDocument({
  projectHeader,
  items,
  generatedAt,
}: {
  projectHeader: {
    name: string;
    institution_name: string;
    academic_period: string;
  };
  items: TeacherCertificateItem[];
  generatedAt: string;
}) {
  ensurePdfFontsRegistered();

  return (
    <Document
      title={`Certificado de Carga Horária Docente - ${projectHeader.institution_name}`}
      author="Schedule Pro"
    >
      {items.map((item) => (
        <React.Fragment key={item.teacherId}>
          {/* PÁGINA 1: FRENTE (ANVERSO) */}
          <Page size="A4" orientation="landscape" style={styles.page}>
            <View style={styles.outerFrame}>
              <View style={styles.innerFrame}>
                {/* Topo Corporativo */}
                <View style={styles.topBar}>
                  <View style={styles.institutionBlock}>
                    <Text style={styles.badgeText}>
                      DOCUMENTO OFICIAL • GESTÃO ACADÊMICA
                    </Text>
                    <Text style={styles.institutionTitle}>
                      {projectHeader.institution_name}
                    </Text>
                    <Text style={styles.projectMeta}>
                      Projeto: {projectHeader.name} • Período Letivo:{" "}
                      {projectHeader.academic_period || "Atual"}
                    </Text>
                  </View>

                  <View style={styles.serialTopBox}>
                    <Text style={styles.serialLabel}>Código de Autenticidade</Text>
                    <Text style={styles.serialValue}>{item.serial}</Text>
                  </View>
                </View>

                {/* Corpo Central do Certificado */}
                <View style={styles.centerContent}>
                  <Text style={styles.certTitle}>
                    CERTIFICADO DE ATRIBUIÇÃO DOCENTE
                  </Text>
                  <Text style={styles.certSubtitle}>
                    DECLARAÇÃO OFICIAL DE CARGA HORÁRIA E MATRIZ CURRICULAR
                  </Text>
                  <View style={styles.divider} />

                  <Text style={styles.paragraph}>
                    A Coordenação Acadêmica de{" "}
                    <Text style={styles.bold}>
                      {projectHeader.institution_name}
                    </Text>{" "}
                    certifica e declara, para os devidos fins institucionais, que
                    o(a) docente{" "}
                    <Text style={styles.bold}>{item.teacherName}</Text> possui
                    atribuição ativa de aulas no projeto acadêmico{" "}
                    <Text style={styles.bold}>
                      &quot;{projectHeader.name}&quot;
                    </Text>
                    , referente à vigência{" "}
                    <Text style={styles.bold}>
                      {projectHeader.academic_period || "Atual"}
                    </Text>
                    , perfazendo carga horária semanal alocada de{" "}
                    <Text style={styles.bold}>
                      {item.totalLessons} tempos semanais
                    </Text>{" "}
                    distribuídos em{" "}
                    <Text style={styles.bold}>
                      {item.rows.length} componente(s) curricular(es)
                    </Text>
                    , conforme matriz detalhada no verso deste documento.
                  </Text>

                  <Text style={styles.issueDateLine}>
                    Emitido em {generatedAt}.
                  </Text>
                </View>

                {/* Rodapé: Assinaturas e QR Code */}
                <View style={styles.bottomRow}>
                  <View style={styles.signaturesGroup}>
                    <View style={styles.signCol}>
                      <View style={styles.signLine} />
                      <Text style={styles.signName}>
                        {item.coordinatorName || "Coordenação Acadêmica"}
                      </Text>
                      <Text style={styles.signRole}>
                        {projectHeader.institution_name}
                      </Text>
                    </View>

                    <View style={styles.signCol}>
                      <View style={styles.signLine} />
                      <Text style={styles.signName}>{item.teacherName}</Text>
                      <Text style={styles.signRole}>Docente Responsável</Text>
                    </View>
                  </View>

                  {item.qrCodeBase64 && (
                    <View style={styles.qrBoxFront}>
                      <Image
                        src={item.qrCodeBase64}
                        style={styles.qrImgFront}
                      />
                      <View style={styles.qrTextCol}>
                        <Text style={styles.qrTitle}>Validação On-line</Text>
                        <Text style={styles.qrDesc}>
                          Aponte a câmera para o QR Code para validar este
                          documento e consultar a grade em tempo real.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Page>

          {/* PÁGINA 2: VERSO (MATRIZ CURRICULAR DETALHADA) */}
          <Page size="A4" orientation="landscape" style={styles.page}>
            <View style={styles.outerFrame}>
              <View style={styles.innerFrame}>
                <View>
                  <View style={styles.versoHeader}>
                    <View>
                      <Text style={styles.versoTitle}>
                        Quadro Detalhado de Atribuição Docente e Componentes
                        Curriculares
                      </Text>
                      <Text style={styles.versoSubtitle}>
                        Docente: {item.teacherName} • Projeto:{" "}
                        {projectHeader.name} ({projectHeader.academic_period})
                      </Text>
                    </View>

                    {item.qrCodeBase64 && (
                      <Image
                        src={item.qrCodeBase64}
                        style={{ width: 48, height: 48 }}
                      />
                    )}
                  </View>

                  <View style={styles.syllabusBox}>
                    <View style={styles.tableHeader}>
                      <View style={{ width: "42%" }}>
                        <Text style={styles.thText}>COMPONENTE CURRICULAR / DISCIPLINA</Text>
                      </View>
                      <View style={{ width: "26%" }}>
                        <Text style={styles.thText}>TURMA(S) ATENDIDA(S)</Text>
                      </View>
                      <View style={{ width: "20%" }}>
                        <Text style={styles.thText}>SALA / AMBIENTE</Text>
                      </View>
                      <View style={{ width: "12%", alignItems: "center" }}>
                        <Text style={styles.thText}>TEMPOS / SEM</Text>
                      </View>
                    </View>

                    {item.rows.slice(0, 14).map((row, rIdx) => (
                      <View
                        key={rIdx}
                        style={[
                          styles.tr,
                          {
                            backgroundColor:
                              rIdx % 2 === 1 ? "#f8fafc" : "#ffffff",
                          },
                        ]}
                      >
                        <View style={{ width: "42%" }}>
                          <Text style={[styles.tdText, { fontWeight: 600 }]}>
                            {row.subject}
                          </Text>
                        </View>
                        <View style={{ width: "26%" }}>
                          <Text style={styles.tdText}>{row.classes}</Text>
                        </View>
                        <View style={{ width: "20%" }}>
                          <Text style={styles.tdText}>{row.room}</Text>
                        </View>
                        <View style={{ width: "12%", alignItems: "center" }}>
                          <Text style={[styles.tdText, { fontWeight: 700 }]}>
                            {row.number_of_lessons}
                          </Text>
                        </View>
                      </View>
                    ))}

                    <View
                      style={[
                        styles.tr,
                        {
                          backgroundColor: "#f1f5f9",
                          borderTopWidth: 1.5,
                          borderTopColor: "#94a3b8",
                        },
                      ]}
                    >
                      <View style={{ width: "88%" }}>
                        <Text style={[styles.tdText, { fontWeight: 700 }]}>
                          CARGA HORÁRIA SEMANAL TOTAL ATRIBUÍDA
                        </Text>
                      </View>
                      <View style={{ width: "12%", alignItems: "center" }}>
                        <Text
                          style={[
                            styles.tdText,
                            { fontWeight: 700, color: "#1e3a8a" },
                          ]}
                        >
                          {item.totalLessons} tempos
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.versoFooter}>
                  <Text style={styles.footNote}>
                    Valide a autenticidade deste certificado e consulte eventuais
                    atualizações de horário em tempo real via QR Code.
                  </Text>
                  <Text style={[styles.footNote, { fontWeight: 700, color: "#0f172a" }]}>
                    Nº de série: {item.serial}
                  </Text>
                </View>
              </View>
            </View>
          </Page>
        </React.Fragment>
      ))}
    </Document>
  );
}
