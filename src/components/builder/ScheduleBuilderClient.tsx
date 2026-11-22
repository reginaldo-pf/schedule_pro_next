"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import {
  evaluateSlotCompatibility,
  computePedagogicalWarnings,
  type BuilderLessonUnit,
  type BuilderPeriod,
  type BuilderTeacher,
  type BuilderRoom,
  type BuilderClass,
  type TeacherAvailabilityEntry,
  type RoomAvailabilityEntry,
  type ClassAvailabilityEntry,
  type SlotStatus,
} from "@/lib/schedule/collision-engine";

interface SavedEntryRecord {
  lesson_id: number;
  lesson_index: number;
  school_class_id: number;
  school_class_name: string;
  period_id: number;
  day_of_week: string;
  is_locked: boolean;
  room_id: number | null;
  teacher_ids: number[];
}

export function ScheduleBuilderClient({
  project,
  days,
  periods,
  groups,
  classes,
  teachers,
  rooms,
  lessons,
  initialSavedEntries,
  baseTeacherAvailabilities,
  baseRoomAvailabilities,
  baseClassAvailabilities,
  initialGroupId,
  initialClassId,
  subscriptionValid,
}: {
  project: {
    id: number;
    name: string;
    institution_name: string;
  };
  days: { code: string; label: string }[];
  periods: BuilderPeriod[];
  groups: { id: number; name: string; academic_period?: string }[];
  classes: BuilderClass[];
  teachers: BuilderTeacher[];
  rooms: BuilderRoom[];
  lessons: {
    id: number;
    number_of_lessons: number;
    subject_id: number;
    subject_name: string;
    subject_color: string;
    room_id: number | null;
    class_ids: number[];
    class_names: string;
    class_groups: number[];
    class_levels: string[];
    teacher_ids: number[];
    teacher_names: string;
    max_lessons_per_day: number;
    max_days_of_lessons: number;
    allow_consecutive_days: boolean;
    grouping_type: string;
  }[];
  initialSavedEntries: SavedEntryRecord[];
  baseTeacherAvailabilities: TeacherAvailabilityEntry[];
  baseRoomAvailabilities: RoomAvailabilityEntry[];
  baseClassAvailabilities: ClassAvailabilityEntry[];
  initialGroupId: number | null;
  initialClassId: number | null;
  subscriptionValid: boolean;
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const defaultGroup = initialGroupId || 0;
  const defaultClass = initialClassId || 0;

  const [selectedGroupId, setSelectedGroupId] = useState<number>(defaultGroup);
  const [selectedClassId, setSelectedClassId] = useState<number>(defaultClass);

  // Master state of all saved/current entries across the project so switching classes reflects everything!
  const [savedEntries, setSavedEntries] =
    useState<SavedEntryRecord[]>(initialSavedEntries);

  // Build lesson units for the currently selected class
  const buildUnitsForClass = (
    classId: number,
    entriesList: SavedEntryRecord[]
  ): BuilderLessonUnit[] => {
    if (!classId) return [];
    const relevantLessons = lessons.filter((l) =>
      l.class_ids.includes(classId)
    );
    const units: BuilderLessonUnit[] = [];

    for (const lesson of relevantLessons) {
      for (let idx = 1; idx <= lesson.number_of_lessons; idx++) {
        const match = entriesList.find(
          (e) =>
            e.lesson_id === lesson.id &&
            e.lesson_index === idx &&
            e.school_class_id === classId
        );
        units.push({
          id: lesson.id,
          index: idx,
          total_index: lesson.number_of_lessons,
          subject_id: lesson.subject_id,
          subject_name: lesson.subject_name,
          subject_color: lesson.subject_color,
          subject_text_color: "#ffffff",
          room_id: lesson.room_id,
          class_ids: lesson.class_ids,
          class_names: lesson.class_names,
          class_groups: lesson.class_groups,
          class_levels: lesson.class_levels,
          teacher_ids: lesson.teacher_ids,
          teacher_names: lesson.teacher_names,
          assigned: !!match,
          day: match ? match.day_of_week : null,
          period_id: match ? match.period_id : null,
          is_locked: match ? match.is_locked : false,
          max_lessons_per_day: lesson.max_lessons_per_day,
          max_days_of_lessons: lesson.max_days_of_lessons,
          allow_consecutive_days: lesson.allow_consecutive_days,
          grouping_type: lesson.grouping_type,
        });
      }
    }
    return units;
  };

  const [classUnits, setClassUnits] = useState<BuilderLessonUnit[]>(() =>
    buildUnitsForClass(defaultClass, initialSavedEntries)
  );

  const [draggedUnit, setDraggedUnit] = useState<BuilderLessonUnit | null>(
    null
  );
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [generationErrors, setGenerationErrors] = useState<
    { code?: string; title?: string; message: string }[]
  >([]);

  // Batch generation modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchClassIds, setBatchClassIds] = useState<number[]>([]);

  const handleSelectGroup = (gId: number) => {
    setSelectedGroupId(gId);
    const firstCls = classes.find((c) => c.group_id === gId);
    const nextClassId = firstCls ? firstCls.id : 0;
    setSelectedClassId(nextClassId);
    setClassUnits(buildUnitsForClass(nextClassId, savedEntries));
  };

  const handleSelectClass = (cId: number) => {
    setSelectedClassId(cId);
    setClassUnits(buildUnitsForClass(cId, savedEntries));
  };

  // Compute effective availabilities including occupations from OTHER classes in savedEntries!
  const {
    effectiveTeacherAvs,
    effectiveRoomAvs,
    effectiveClassAvs,
  } = useMemo(() => {
    const tAvs: TeacherAvailabilityEntry[] = [...baseTeacherAvailabilities];
    const rAvs: RoomAvailabilityEntry[] = [...baseRoomAvailabilities];
    const cAvs: ClassAvailabilityEntry[] = [...baseClassAvailabilities];

    const otherClassEntries = savedEntries.filter(
      (e) => e.school_class_id !== selectedClassId
    );

    for (const entry of otherClassEntries) {
      for (const tId of entry.teacher_ids) {
        tAvs.push({
          teacher_id: tId,
          period_id: entry.period_id,
          day_of_week: entry.day_of_week,
          status: "UNAVAILABLE",
          reason: `Professor ocupado na turma ${entry.school_class_name}`,
          occupied_lesson_id: entry.lesson_id,
          occupied_class_name: entry.school_class_name,
        });
      }

      if (entry.room_id) {
        rAvs.push({
          room_id: entry.room_id,
          period_id: entry.period_id,
          day_of_week: entry.day_of_week,
          status: "OCCUPIED",
          reason: `Sala ocupada pela turma ${entry.school_class_name}`,
          occupied_lesson_id: entry.lesson_id,
          occupied_class_name: entry.school_class_name,
        });
      }

      cAvs.push({
        school_class_id: entry.school_class_id,
        period_id: entry.period_id,
        day_of_week: entry.day_of_week,
        status: "UNAVAILABLE",
        reason: `Turma ${entry.school_class_name} já possui aula`,
        occupied_lesson_id: entry.lesson_id,
      });
    }

    return {
      effectiveTeacherAvs: tAvs,
      effectiveRoomAvs: rAvs,
      effectiveClassAvs: cAvs,
    };
  }, [
    baseTeacherAvailabilities,
    baseRoomAvailabilities,
    baseClassAvailabilities,
    savedEntries,
    selectedClassId,
  ]);

  // Precompute slot compatibility map whenever a lesson unit is being dragged
  const draggedCompatibilityMap = useMemo(() => {
    const map: Record<string, SlotStatus> = {};
    if (!draggedUnit) return map;

    for (const d of days) {
      for (const p of periods) {
        const status = evaluateSlotCompatibility({
          day: d.code,
          periodId: p.id,
          lesson: draggedUnit,
          allUnitsInView: classUnits,
          periods,
          classes,
          rooms,
          teacherAvailabilities: effectiveTeacherAvs,
          roomAvailabilities: effectiveRoomAvs,
          classAvailabilities: effectiveClassAvs,
        });
        if (status) {
          map[`${d.code}_${p.id}`] = status;
        }
      }
    }
    return map;
  }, [
    draggedUnit,
    days,
    periods,
    classUnits,
    classes,
    rooms,
    effectiveTeacherAvs,
    effectiveRoomAvs,
    effectiveClassAvs,
  ]);

  // Live pedagogical warnings for the currently selected class
  const pedagogicalWarnings = useMemo(() => {
    if (!selectedClassId) return [];
    return computePedagogicalWarnings({
      allUnitsInView: classUnits,
      periods,
      teachers,
      teacherAvailabilities: effectiveTeacherAvs,
    });
  }, [selectedClassId, classUnits, periods, teachers, effectiveTeacherAvs]);

  const unscheduledUnits = classUnits.filter((u) => !u.assigned);
  const selectedClassObj = classes.find((c) => c.id === selectedClassId);

  const visiblePeriods = periods.filter((p) => {
    if (
      selectedClassObj &&
      selectedClassObj.shifts &&
      selectedClassObj.shifts.length > 0
    ) {
      return selectedClassObj.shifts.includes(p.shift);
    }
    return true;
  });

  const getUnitsForSlot = (dayCode: string, periodId: number) =>
    classUnits.filter(
      (u) => u.assigned && u.day === dayCode && u.period_id === periodId
    );

  const handleDropOnSlot = (dayCode: string | null, periodId: number | null) => {
    setDragTarget(null);
    if (!draggedUnit) return;

    if (dayCode === null || periodId === null) {
      // Unassign back to sidebar
      setClassUnits((prev) =>
        prev.map((u) =>
          u.id === draggedUnit.id && u.index === draggedUnit.index
            ? { ...u, assigned: false, day: null, period_id: null }
            : u
        )
      );
      setDraggedUnit(null);
      return;
    }

    const slotStatus = draggedCompatibilityMap[`${dayCode}_${periodId}`];
    if (slotStatus && slotStatus.type === "blocked") {
      showToast(`Horário bloqueado: ${slotStatus.reason}`, "warning");
      setDraggedUnit(null);
      return;
    }

    setClassUnits((prev) =>
      prev.map((u) => {
        if (u.id === draggedUnit.id && u.index === draggedUnit.index) {
          return {
            ...u,
            assigned: true,
            day: dayCode,
            period_id: periodId,
          };
        }
        // Swap out any existing unlocked unit in the target slot
        if (
          u.assigned &&
          u.day === dayCode &&
          u.period_id === periodId &&
          !u.is_locked
        ) {
          return {
            ...u,
            assigned: false,
            day: null,
            period_id: null,
          };
        }
        return u;
      })
    );
    setDraggedUnit(null);
  };

  const toggleLock = (unit: BuilderLessonUnit) => {
    setClassUnits((prev) =>
      prev.map((u) =>
        u.id === unit.id && u.index === unit.index
          ? { ...u, is_locked: !u.is_locked }
          : u
      )
    );
  };

  const unassignUnit = (unit: BuilderLessonUnit) => {
    setClassUnits((prev) =>
      prev.map((u) =>
        u.id === unit.id && u.index === unit.index
          ? { ...u, assigned: false, day: null, period_id: null }
          : u
      )
    );
  };

  const saveCurrentClassSchedule = async (unitsToSave = classUnits) => {
    if (!selectedClassId) return;
    startLoading();
    try {
      const assignedPayload = unitsToSave
        .filter((u) => u.assigned && u.day && u.period_id)
        .map((u) => ({
          lesson_id: u.id,
          lesson_index: u.index,
          class_ids: u.class_ids,
          teacher_ids: u.teacher_ids,
          room_id: u.room_id,
          day_of_week: u.day!,
          period_id: u.period_id!,
          is_locked: u.is_locked,
        }));

      const res = await fetch("/api/builder/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: selectedClassId,
          lessons: assignedPayload,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message || "Grade salva com sucesso!", "success");

        // Update local savedEntries cache so cross-class collisions stay in sync
        const classMap = new Map(classes.map((c) => [c.id, c.name]));
        const newRecords: SavedEntryRecord[] = [];
        for (const u of unitsToSave) {
          if (!u.assigned || !u.day || !u.period_id) continue;
          for (const cId of u.class_ids) {
            newRecords.push({
              lesson_id: u.id,
              lesson_index: u.index,
              school_class_id: cId,
              school_class_name: classMap.get(cId) || "",
              period_id: u.period_id,
              day_of_week: u.day,
              is_locked: u.is_locked,
              room_id: u.room_id,
              teacher_ids: u.teacher_ids,
            });
          }
        }

        const affectedLessonIds = new Set(unitsToSave.map((u) => u.id));
        setSavedEntries((prev) => [
          ...prev.filter(
            (e) =>
              e.school_class_id !== selectedClassId &&
              !affectedLessonIds.has(e.lesson_id)
          ),
          ...newRecords,
        ]);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao salvar grade.", "danger");
      }
    } catch {
      showToast("Erro de conexão ao salvar grade.", "danger");
    } finally {
      stopLoading();
    }
  };

  const handleClearSchedule = async () => {
    const confirmed = await confirmAction({
      title: "Confirmar Limpeza",
      message:
        "Tem certeza que deseja limpar todas as aulas destravadas desta turma e salvar?",
      confirmText: "Sim, Limpar",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    const cleared = classUnits.map((u) =>
      u.is_locked ? u : { ...u, assigned: false, day: null, period_id: null }
    );
    setClassUnits(cleared);
    await saveCurrentClassSchedule(cleared);
  };

  const runSolverGeneration = async (targetClassIds: number[]) => {
    startLoading();
    setGenerationErrors([]);
    try {
      const res = await fetch("/api/solver/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_ids: targetClassIds }),
      });
      const data = await res.json();

      const status = data.run?.status || "";
      const diagErrors = data.run?.diagnostics?.errors || [];
      if (diagErrors.length > 0) {
        setGenerationErrors(diagErrors);
      }

      if (res.ok && data.ok) {
        const classMap = new Map(classes.map((c) => [c.id, c.name]));
        const generatedRecords: SavedEntryRecord[] = (data.entries || []).map(
          (e: {
            lesson_id: number;
            lesson_index: number;
            school_class_id: number;
            period_id: number;
            day_of_week: string;
            is_locked: boolean;
            room_id: number | null;
            teacher_ids: number[];
          }) => ({
            lesson_id: e.lesson_id,
            lesson_index: e.lesson_index,
            school_class_id: e.school_class_id,
            school_class_name: classMap.get(e.school_class_id) || "",
            period_id: e.period_id,
            day_of_week: e.day_of_week,
            is_locked: e.is_locked || false,
            room_id: e.room_id,
            teacher_ids: e.teacher_ids || [],
          })
        );

        setSavedEntries(generatedRecords);
        setClassUnits(buildUnitsForClass(selectedClassId, generatedRecords));

        if (status === "PARTIAL") {
          showToast(
            "Geração concluída parcialmente! Algumas aulas não puderam ser alocadas devido a conflitos.",
            "warning"
          );
        } else {
          showToast("Horários gerados automaticamente com sucesso!", "success");
        }
        router.refresh();
      } else {
        showToast(
          status === "UNSATISFIABLE"
            ? "Sem solução: A grade possui conflitos de regras obrigatórias."
            : data.message || "Não foi possível gerar a grade horária.",
          "danger"
        );
      }
    } catch {
      showToast("Erro ao se conectar com o servidor de geração.", "danger");
    } finally {
      stopLoading();
    }
  };

  const handleGenerateIndividual = async () => {
    if (!selectedClassId) return;
    const confirmed = await confirmAction({
      title: "Gerar Horário da Turma",
      message:
        "Deseja gerar automaticamente os horários para esta turma? Os horários travados com cadeado serão mantidos.",
      confirmText: "Sim, Gerar",
      confirmVariant: "primary",
    });
    if (confirmed) {
      await runSolverGeneration([selectedClassId]);
    }
  };

  const handleGenerateBatch = async () => {
    if (batchClassIds.length === 0) return;
    setBatchModalOpen(false);
    await runSolverGeneration(batchClassIds);
  };

  const filteredClassesForDropdown = classes.filter(
    (c) => !selectedGroupId || c.group_id === selectedGroupId
  );

  return (
    <div>
      {/* Compact Header Card */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3">
          <div className="row align-items-center g-3">
            <div className="col-md-auto me-auto">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-primary-subtle p-2 rounded-3 text-primary">
                  <i className="bi bi-calendar-week fs-4" />
                </div>
                <div>
                  <h4 className="mb-0 fw-bold">Grade Horária</h4>
                  <p className="text-muted small m-0 d-none d-md-block">
                    Construção manual interativa, auditoria de colisões e geração
                    automática
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-auto">
              <div className="d-flex gap-4 px-md-4 border-start border-end d-none d-lg-flex">
                <div>
                  <small
                    className="text-muted d-block text-uppercase fw-bold"
                    style={{ fontSize: "0.65rem" }}
                  >
                    Projeto
                  </small>
                  <span className="fw-medium">
                    {project.institution_name || project.name}
                  </span>
                </div>
                <div>
                  <small
                    className="text-muted d-block text-uppercase fw-bold"
                    style={{ fontSize: "0.65rem" }}
                  >
                    Período
                  </small>
                  <span className="fw-medium text-primary">
                    {groups.find((g) => g.id === selectedGroupId)
                      ?.academic_period || "Por Curso"}
                  </span>
                </div>
              </div>
            </div>

            <div className="col-md-auto d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2 px-3 py-2"
                disabled={!selectedClassId}
                onClick={handleClearSchedule}
              >
                <i className="bi bi-trash" />
                <span>Limpar</span>
              </button>

              <button
                type="button"
                className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-bold"
                disabled={!selectedClassId}
                onClick={() => saveCurrentClassSchedule(classUnits)}
              >
                <i className="bi bi-save" />
                <span>Salvar</span>
              </button>

              <div className="btn-group shadow-sm">
                <button
                  type="button"
                  className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-bold"
                  disabled={!selectedClassId || !subscriptionValid}
                  onClick={handleGenerateIndividual}
                >
                  <i className="bi bi-magic" />
                  <span>Gerar Turma</span>
                </button>
                <button
                  type="button"
                  className="btn btn-dark btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-bold"
                  disabled={!subscriptionValid}
                  onClick={() => {
                    setBatchClassIds(classes.map((c) => c.id));
                    setBatchModalOpen(true);
                  }}
                >
                  <i className="bi bi-layers" />
                  <span>Geração em Lote</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Sidebar: Unscheduled Lessons + Pedagogical Warnings + Solver Conflicts */}
        <div className="col-lg-3 d-flex flex-column gap-3">
          {/* Pending Lessons Card */}
          <div className="card border-0 shadow-sm overflow-hidden d-flex flex-column">
            <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
              <h6 className="mb-0 fw-bold text-secondary d-flex align-items-center gap-2">
                <i className="bi bi-list-task" />
                <span>Aulas Pendentes</span>
              </h6>
              <span className="badge bg-secondary">
                {unscheduledUnits.length}
              </span>
            </div>

            <div
              className={`p-2 flex-grow-1 ${
                dragTarget === "sidebar" ? "bg-success-subtle" : ""
              }`}
              style={{
                maxHeight: "42vh",
                minHeight: "28vh",
                overflowY: "auto",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragTarget("sidebar");
              }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                handleDropOnSlot(null, null);
              }}
            >
              {!selectedClassId ? (
                <div className="text-center p-4 text-muted small">
                  Selecione uma turma para carregar as aulas.
                </div>
              ) : unscheduledUnits.length === 0 ? (
                <div className="text-center p-4 text-success small fw-medium">
                  <i className="bi bi-check2-circle fs-3 d-block mb-1" />
                  Todas as aulas foram alocadas!
                </div>
              ) : (
                <div className="row g-2">
                  {unscheduledUnits.map((unit) => (
                    <div
                      key={`${unit.id}_${unit.index}`}
                      className="col-6"
                    >
                      <div
                        className="card cursor-grab shadow-sm border-0"
                        style={{
                          height: 84,
                          backgroundColor: unit.subject_color,
                          color: "#ffffff",
                        }}
                        draggable
                        onDragStart={() => setDraggedUnit(unit)}
                        onDragEnd={() => {
                          setDraggedUnit(null);
                          setDragTarget(null);
                        }}
                      >
                        <div className="card-body p-2 position-relative h-100 d-flex flex-column justify-content-center overflow-hidden">
                          <div
                            className="fw-bold text-truncate"
                            style={{ fontSize: "0.75rem", lineHeight: 1.2 }}
                            title={unit.subject_name}
                          >
                            {unit.subject_name}
                          </div>
                          <div
                            className="text-truncate opacity-90"
                            style={{ fontSize: "0.65rem" }}
                            title={`Prof: ${unit.teacher_names}`}
                          >
                            Prof: {unit.teacher_names}
                          </div>
                          <div
                            className="text-truncate opacity-75"
                            style={{ fontSize: "0.62rem" }}
                          >
                            {unit.class_names}
                          </div>
                          <span
                            className="badge bg-white bg-opacity-25 position-absolute bottom-0 end-0 mb-1 me-1"
                            style={{ fontSize: "0.55rem" }}
                          >
                            {unit.index}/{unit.total_index}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pedagogical Warnings Card */}
          <div className="card border-0 shadow-sm overflow-hidden">
            <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
              <h6 className="mb-0 fw-bold text-secondary d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill text-warning" />
                <span>Alertas Pedagógicos</span>
              </h6>
              <span
                className={`badge ${
                  pedagogicalWarnings.length > 0
                    ? "bg-warning text-dark"
                    : "bg-success text-white"
                }`}
              >
                {pedagogicalWarnings.length}
              </span>
            </div>
            <div
              className="p-3 overflow-auto"
              style={{ maxHeight: "30vh", minHeight: "16vh" }}
            >
              {pedagogicalWarnings.length === 0 ? (
                <div className="text-center py-3 text-muted small">
                  <i className="bi bi-check-circle-fill text-success d-block fs-4 mb-1" />
                  Nenhuma violação pedagógica na turma atual!
                </div>
              ) : (
                <ul className="list-group list-group-flush small p-0 m-0">
                  {pedagogicalWarnings.map((w, idx) => (
                    <li
                      key={idx}
                      className="list-group-item px-0 py-2 border-0 border-bottom d-flex gap-2 text-muted"
                    >
                      <i className="bi bi-info-circle-fill text-warning flex-shrink-0 mt-1" />
                      <span style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
                        {w.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Generation Conflicts Card */}
          {generationErrors.length > 0 && (
            <div className="card border-danger shadow-sm overflow-hidden">
              <div className="p-3 bg-danger-subtle border-bottom d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-danger d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-octagon-fill" />
                  <span>Conflitos na Geração</span>
                </h6>
                <span className="badge bg-danger">
                  {generationErrors.length}
                </span>
              </div>
              <div className="p-3 overflow-auto" style={{ maxHeight: "32vh" }}>
                <ul className="list-group list-group-flush small p-0 m-0">
                  {generationErrors.map((err, idx) => (
                    <li
                      key={idx}
                      className="list-group-item px-0 py-2 border-0 border-bottom d-flex gap-2 text-danger"
                    >
                      <i className="bi bi-x-circle-fill flex-shrink-0 mt-1" />
                      <div>
                        <strong className="d-block">
                          {err.title || "Conflito Identificado"}
                        </strong>
                        <span style={{ fontSize: "0.8rem" }}>
                          {err.message}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Main Schedule Grid */}
        <div className="col-lg-9">
          <div className="card border-0 shadow-sm overflow-hidden">
            {/* Filters Bar */}
            <div className="p-3 bg-light border-bottom d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <div className="d-flex align-items-center gap-2">
                  <label className="small fw-bold text-secondary mb-0">
                    Curso:
                  </label>
                  <select
                    className="form-select form-select-sm"
                    style={{ minWidth: 210 }}
                    value={selectedGroupId || ""}
                    onChange={(e) => handleSelectGroup(Number(e.target.value))}
                  >
                    <option value="">Selecione o Curso...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <label className="small fw-bold text-secondary mb-0">
                    Turma:
                  </label>
                  <select
                    className="form-select form-select-sm"
                    style={{ minWidth: 210 }}
                    value={selectedClassId || ""}
                    disabled={!selectedGroupId}
                    onChange={(e) => handleSelectClass(Number(e.target.value))}
                  >
                    <option value="">
                      {selectedGroupId
                        ? "Selecione a Turma..."
                        : "Selecione um curso primeiro..."}
                    </option>
                    {filteredClassesForDropdown.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="badge bg-info-subtle text-info border border-info-subtle p-2">
                <i className="bi bi-arrows-move me-1" />
                Arraste as aulas para alocar ou trocar horários
              </div>
            </div>

            {/* Table Grid */}
            <div className="table-responsive" style={{ maxHeight: "75vh" }}>
              {!selectedClassId ? (
                <div className="text-center py-5">
                  <i className="bi bi-calendar-x display-1 text-muted mb-3 d-block" />
                  <h5 className="fw-bold text-secondary">
                    Nenhuma Turma Selecionada
                  </h5>
                  <p className="text-muted small">
                    Selecione um curso e uma turma nos filtros acima para montar
                    a grade.
                  </p>
                </div>
              ) : (
                <table
                  className="table table-bordered table-sm text-center mb-0"
                  style={{ tableLayout: "fixed", minWidth: 820 }}
                >
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 115 }}>Período</th>
                      {days.map((d) => (
                        <th key={d.code}>{d.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePeriods.map((period) => (
                      <tr key={period.id}>
                        <td className="align-middle fw-bold text-muted bg-light small">
                          <div>{period.start_time}</div>
                          <div
                            className="text-secondary fw-normal"
                            style={{ fontSize: "0.75rem" }}
                          >
                            às {period.end_time}
                          </div>
                        </td>
                        {days.map((d) => {
                          const slotKey = `${d.code}_${period.id}`;
                          const slotStatus = draggedUnit
                            ? draggedCompatibilityMap[slotKey]
                            : null;
                          const assignedInSlot = getUnitsForSlot(
                            d.code,
                            period.id
                          );

                          let cellBg = "";
                          if (draggedUnit) {
                            if (slotStatus?.type === "blocked") {
                              cellBg = "bg-danger-subtle";
                            } else if (slotStatus?.type === "undesired") {
                              cellBg = "bg-warning-subtle";
                            } else if (dragTarget === slotKey) {
                              cellBg = "bg-success-subtle";
                            }
                          }

                          return (
                            <td
                              key={d.code}
                              className={`p-1 align-middle position-relative ${cellBg}`}
                              style={{ height: 86, verticalAlign: "top" }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragTarget(slotKey);
                              }}
                              onDragLeave={() => setDragTarget(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleDropOnSlot(d.code, period.id);
                              }}
                            >
                              <div className="h-100 w-100 position-relative">
                                {/* Drag Status Overlay */}
                                {draggedUnit && slotStatus && (
                                  <div
                                    className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center rounded-2"
                                    style={{
                                      zIndex: 10,
                                      background: "rgba(255,255,255,0.88)",
                                      pointerEvents: "none",
                                    }}
                                  >
                                    <span
                                      className={`small fw-bold px-1 text-center ${
                                        slotStatus.type === "blocked"
                                          ? "text-danger"
                                          : "text-warning"
                                      }`}
                                      style={{
                                        fontSize: "0.7rem",
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      {slotStatus.reason}
                                    </span>
                                  </div>
                                )}

                                <div
                                  className={`h-100 w-100 ${
                                    draggedUnit ? "opacity-50" : ""
                                  }`}
                                >
                                  {assignedInSlot.map((assigned) => (
                                    <div
                                      key={`${assigned.id}_${assigned.index}`}
                                      className="card text-start cursor-grab shadow-sm border-0 w-100 h-100 position-relative"
                                      style={{
                                        fontSize: "0.8rem",
                                        backgroundColor: assigned.subject_color,
                                        color: "#ffffff",
                                        border: assigned.is_locked
                                          ? "2px dashed #ffc107"
                                          : "none",
                                      }}
                                      draggable
                                      onDragStart={() =>
                                        setDraggedUnit(assigned)
                                      }
                                      onDragEnd={() => {
                                        setDraggedUnit(null);
                                        setDragTarget(null);
                                      }}
                                    >
                                      <div className="card-body p-2 position-relative h-100 overflow-hidden d-flex flex-column justify-content-center">
                                        <div
                                          className="fw-bold text-truncate pe-4"
                                          title={assigned.subject_name}
                                        >
                                          {assigned.subject_name}
                                        </div>
                                        <div
                                          className="text-truncate pe-4 opacity-90"
                                          style={{ fontSize: "0.75rem" }}
                                          title={`Prof: ${assigned.teacher_names}`}
                                        >
                                          Prof: {assigned.teacher_names}
                                        </div>

                                        <div
                                          className="position-absolute top-0 end-0 mt-1 me-1 d-flex gap-1 align-items-center"
                                          style={{ zIndex: 12 }}
                                        >
                                          <button
                                            type="button"
                                            className="btn btn-link btn-sm p-0 text-white text-decoration-none opacity-75"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleLock(assigned);
                                            }}
                                            title={
                                              assigned.is_locked
                                                ? "Desbloquear horário"
                                                : "Travar horário com cadeado"
                                            }
                                          >
                                            <i
                                              className={`bi ${
                                                assigned.is_locked
                                                  ? "bi-lock-fill text-warning"
                                                  : "bi-unlock"
                                              }`}
                                            />
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-link btn-sm p-0 text-white text-decoration-none opacity-75 ms-1"
                                            style={{
                                              fontSize: "1.1rem",
                                              lineHeight: 1,
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              unassignUnit(assigned);
                                            }}
                                            title="Remover da grade"
                                          >
                                            &times;
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Batch Generate Modal */}
      {batchModalOpen && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1055 }}
            onClick={() => setBatchModalOpen(false)}
          />
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            style={{ zIndex: 1060 }}
          >
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header bg-dark text-white p-4 border-0">
                  <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                    <i className="bi bi-layers-fill text-warning fs-4" />
                    <span>Geração em Lote de Horários</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setBatchModalOpen(false)}
                  />
                </div>
                <div className="modal-body p-4">
                  <div className="alert alert-warning border-0 d-flex gap-3 align-items-center mb-4">
                    <i className="bi bi-exclamation-triangle-fill fs-3" />
                    <div className="small">
                      <strong>Atenção!</strong> A geração em lote alocará
                      automaticamente as aulas das turmas selecionadas,
                      respeitando todas as disponibilidades, limites de salas e
                      horários travados com cadeado.
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label fw-bold text-secondary mb-0">
                      Selecione as turmas:
                    </label>
                    <div className="btn-group btn-group-sm">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() =>
                          setBatchClassIds(classes.map((c) => c.id))
                        }
                      >
                        Marcar Todas
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setBatchClassIds([])}
                      >
                        Desmarcar Todas
                      </button>
                    </div>
                  </div>

                  <div
                    className="overflow-auto pe-1"
                    style={{ maxHeight: "38vh" }}
                  >
                    {groups.map((grp) => {
                      const grpClasses = classes.filter(
                        (c) => c.group_id === grp.id
                      );
                      if (grpClasses.length === 0) return null;
                      return (
                        <div key={grp.id} className="mb-3">
                          <div className="bg-light p-2 rounded-2 mb-2 fw-bold small text-uppercase text-muted border-start border-primary border-3">
                            {grp.name}
                          </div>
                          <div className="row g-2">
                            {grpClasses.map((cls) => (
                              <div key={cls.id} className="col-md-4">
                                <div className="form-check p-2 ps-4 border rounded-2">
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id={`batch_cls_${cls.id}`}
                                    checked={batchClassIds.includes(cls.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setBatchClassIds((prev) => [
                                          ...prev,
                                          cls.id,
                                        ]);
                                      } else {
                                        setBatchClassIds((prev) =>
                                          prev.filter((id) => id !== cls.id)
                                        );
                                      }
                                    }}
                                  />
                                  <label
                                    className="form-check-label small fw-medium"
                                    htmlFor={`batch_cls_${cls.id}`}
                                  >
                                    {cls.name}
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="modal-footer border-0 p-4 pt-0">
                  <button
                    type="button"
                    className="btn btn-light px-4"
                    onClick={() => setBatchModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary px-4 fw-bold"
                    disabled={batchClassIds.length === 0}
                    onClick={handleGenerateBatch}
                  >
                    <i className="bi bi-play-circle-fill me-2" />
                    Iniciar Geração ({batchClassIds.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
