"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";
import { TablePagination, usePagination } from "@/components/crud/TablePagination";

interface LessonItem {
  id: number;
  subject_id: number;
  subject_name: string;
  subject_color: string;
  group_id: number;
  group_name: string;
  room_id: number | null;
  room_name: string;
  class_ids: number[];
  class_names: string;
  teacher_ids: number[];
  teacher_names: string;
  number_of_lessons: number;
  max_lessons_per_day: number;
  max_days_of_lessons: number;
  grouping_type: string;
  allow_consecutive_days: boolean;
  active: boolean;
}

const GROUPING_LABELS: Record<string, string> = {
  INDIFERENTE: "Indiferente",
  DUPLAS: "Aulas Duplas",
  SEPARADAS: "Aulas Separadas",
  SEQUENCIA: "Aulas em Sequência",
};

const emptyLessonForm = {
  id: 0,
  group_id: "",
  subject_id: "",
  room_id: "",
  class_ids: [] as number[],
  teacher_ids: [] as number[],
  number_of_lessons: 2,
  max_lessons_per_day: 2,
  max_days_of_lessons: 5,
  grouping_type: "DUPLAS",
  allow_consecutive_days: false,
  active: true,
};

export function LessonsClient({
  projectName,
  lessons,
  groups,
  classes,
  subjects,
  teachers,
  rooms,
}: {
  projectName: string;
  lessons: LessonItem[];
  groups: { id: number; name: string }[];
  classes: { id: number; group_id: number; name: string }[];
  subjects: { id: number; group_id: number; room_id: number | null; name: string }[];
  teachers: { id: number; name: string }[];
  rooms: { id: number; name: string }[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const [filterGroup, setFilterGroup] = useState(
    groups[0] ? String(groups[0].id) : ""
  );
  const [filterClass, setFilterClass] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterRoom, setFilterRoom] = useState("");
  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptyLessonForm);

  const availableClassesForFilter = classes.filter(
    (c) => !filterGroup || String(c.group_id) === filterGroup
  );

  const filtered = lessons.filter((l) => {
    if (filterGroup && String(l.group_id) !== filterGroup) return false;
    if (filterClass && !l.class_ids.includes(Number(filterClass))) return false;
    if (filterTeacher && !l.teacher_ids.includes(Number(filterTeacher)))
      return false;
    if (filterRoom && String(l.room_id || "") !== filterRoom) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        l.subject_name.toLowerCase().includes(q) ||
        l.teacher_names.toLowerCase().includes(q) ||
        l.class_names.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const {
    page,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    paginatedItems,
    setPage,
    setPageSize,
  } = usePagination(filtered, 10);

  const openCreate = () => {
    setCurrentIndex(null);
    const defaultGroup = filterGroup || (groups[0] ? String(groups[0].id) : "");
    const defaultClassIds = filterClass ? [Number(filterClass)] : [];
    setForm({
      ...emptyLessonForm,
      group_id: defaultGroup,
      class_ids: defaultClassIds,
    });
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const l = filtered[index];
    if (!l) return;
    setCurrentIndex(index);
    setForm({
      id: l.id,
      group_id: String(l.group_id),
      subject_id: String(l.subject_id),
      room_id: l.room_id ? String(l.room_id) : "",
      class_ids: [...l.class_ids],
      teacher_ids: [...l.teacher_ids],
      number_of_lessons: l.number_of_lessons,
      max_lessons_per_day: l.max_lessons_per_day,
      max_days_of_lessons: l.max_days_of_lessons,
      grouping_type: l.grouping_type,
      allow_consecutive_days: l.allow_consecutive_days,
      active: l.active,
    });
    setModalOpen(true);
  };

  const modalSubjects = subjects.filter(
    (s) => !form.group_id || String(s.group_id) === form.group_id
  );
  const modalClasses = classes.filter(
    (c) => !form.group_id || String(c.group_id) === form.group_id
  );

  const toggleClassId = (cId: number) => {
    setForm((prev) => ({
      ...prev,
      class_ids: prev.class_ids.includes(cId)
        ? prev.class_ids.filter((id) => id !== cId)
        : [...prev.class_ids, cId],
    }));
  };

  const toggleTeacherId = (tId: number) => {
    setForm((prev) => ({
      ...prev,
      teacher_ids: prev.teacher_ids.includes(tId)
        ? prev.teacher_ids.filter((id) => id !== tId)
        : [...prev.teacher_ids, tId],
    }));
  };

  const handleSave = async (action: SaveActionType) => {
    startLoading();
    try {
      const isEditing = currentIndex !== null;
      const res = await fetch("/api/crud/lessons", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          subject_id: Number(form.subject_id),
          room_id: form.room_id ? Number(form.room_id) : null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
        if (action === "save") {
          setModalOpen(false);
        } else if (action === "save_and_add_another") {
          setCurrentIndex(null);
          setForm((prev) => ({
            ...emptyLessonForm,
            group_id: prev.group_id,
            class_ids: prev.class_ids,
          }));
        }
      } else {
        showToast(data.message || "Erro ao salvar aula.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "Excluir Aula",
      message: "Tem certeza que deseja excluir esta aula da matriz?",
      confirmText: "Sim, Excluir",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/crud/lessons?id=${form.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setModalOpen(false);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao excluir aula.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const reportParams = new URLSearchParams();
  if (filterGroup) reportParams.set("group", filterGroup);
  if (filterClass) reportParams.set("class", filterClass);
  if (filterTeacher) reportParams.set("teacher", filterTeacher);
  if (filterRoom) reportParams.set("room", filterRoom);
  if (query) reportParams.set("q", query);

  return (
    <div>
      <ModuleHeader
        icon="bi-journal-text"
        title="Matriz de Aulas"
        description="Vincule disciplinas, turmas, professores, salas e regras pedagógicas de alocação"
        projectName={projectName}
        statLabel="Aulas Filtradas"
        statValue={filtered.length}
        actionLabel="Nova Aula"
        onAction={openCreate}
        extraActions={
          <Link
            href={`/lessons/report?${reportParams.toString()}`}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold"
          >
            <i className="bi bi-printer" />
            <span>Imprimir Matriz</span>
          </Link>
        }
      />

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom py-3">
          <div className="row g-2">
            <div className="col-md-3">
              <select
                className="form-select form-select-sm"
                value={filterGroup}
                onChange={(e) => {
                  setFilterGroup(e.target.value);
                  setFilterClass("");
                }}
              >
                <option value="">Todos os Cursos / Grupos</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select form-select-sm"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="">Todas as Turmas</option>
                {availableClassesForFilter.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select form-select-sm"
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
              >
                <option value="">Todos os Professores</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select form-select-sm"
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
              >
                <option value="">Todas as Salas</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Buscar..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Disciplina</th>
                <th>Turma(s)</th>
                <th>Professor(es)</th>
                <th>Sala</th>
                <th className="text-center">Tempos</th>
                <th>Agrupamento</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    Nenhuma aula encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((l, idx) => (
                  <tr key={l.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="rounded-2 d-inline-block flex-shrink-0"
                          style={{
                            width: 12,
                            height: 12,
                            backgroundColor: l.subject_color,
                          }}
                        />
                        <div>
                          <div className="fw-bold">{l.subject_name}</div>
                          <small className="text-muted">{l.group_name}</small>
                        </div>
                      </div>
                    </td>
                    <td>{l.class_names}</td>
                    <td>{l.teacher_names}</td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {l.room_name}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-primary-subtle text-primary">
                        {l.number_of_lessons} tempos
                      </span>
                    </td>
                    <td>
                      <span className="small text-muted">
                        {GROUPING_LABELS[l.grouping_type] || l.grouping_type}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => openEdit(startIndex + idx)}
                      >
                        <i className="bi bi-pencil-square me-1" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          totalItems={totalItems}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <CrudModal
        open={modalOpen}
        title={currentIndex !== null ? "Editar Aula" : "Nova Aula"}
        icon="bi-journal-text"
        size="lg"
        isEditing={currentIndex !== null}
        hasPrev={currentIndex !== null && currentIndex > 0}
        hasNext={currentIndex !== null && currentIndex < filtered.length - 1}
        onPrev={() => currentIndex !== null && openEdit(currentIndex - 1)}
        onNext={() => currentIndex !== null && openEdit(currentIndex + 1)}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
        onDelete={currentIndex !== null ? handleDelete : undefined}
      >
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label small fw-semibold">
              1. Curso / Grupo *
            </label>
            <select
              className="form-select"
              required
              value={form.group_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  group_id: e.target.value,
                  subject_id: "",
                  class_ids: [],
                })
              }
            >
              <option value="">Selecione o curso...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-5">
            <label className="form-label small fw-semibold">
              2. Disciplina *
            </label>
            <select
              className="form-select"
              required
              value={form.subject_id}
              onChange={(e) => {
                const sId = e.target.value;
                const subj = subjects.find((s) => String(s.id) === sId);
                setForm({
                  ...form,
                  subject_id: sId,
                  room_id:
                    !form.room_id && subj?.room_id
                      ? String(subj.room_id)
                      : form.room_id,
                });
              }}
            >
              <option value="">Selecione a disciplina...</option>
              {modalSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Sala / Laboratório
            </label>
            <select
              className="form-select"
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })}
            >
              <option value="">Padrão da Disciplina</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label small fw-semibold">
              3. Turma(s) * ({form.class_ids.length} selecionada(s))
            </label>
            <div
              className="border rounded-3 p-2 bg-light overflow-auto"
              style={{ maxHeight: 150 }}
            >
              {modalClasses.map((c) => (
                <div key={c.id} className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`cls_${c.id}`}
                    checked={form.class_ids.includes(c.id)}
                    onChange={() => toggleClassId(c.id)}
                  />
                  <label className="form-check-label small" htmlFor={`cls_${c.id}`}>
                    {c.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="col-md-6">
            <label className="form-label small fw-semibold">
              4. Professor(es) * ({form.teacher_ids.length} selecionado(s))
            </label>
            <div
              className="border rounded-3 p-2 bg-light overflow-auto"
              style={{ maxHeight: 150 }}
            >
              {teachers.map((t) => (
                <div key={t.id} className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`t_${t.id}`}
                    checked={form.teacher_ids.includes(t.id)}
                    onChange={() => toggleTeacherId(t.id)}
                  />
                  <label className="form-check-label small" htmlFor={`t_${t.id}`}>
                    {t.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Qtd. Aulas / Semana
            </label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.number_of_lessons}
              onChange={(e) =>
                setForm({
                  ...form,
                  number_of_lessons: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Máx. Aulas / Dia
            </label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.max_lessons_per_day}
              onChange={(e) =>
                setForm({
                  ...form,
                  max_lessons_per_day: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Máx. Dias / Semana
            </label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.max_days_of_lessons}
              onChange={(e) =>
                setForm({
                  ...form,
                  max_days_of_lessons: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Agrupamento</label>
            <select
              className="form-select"
              value={form.grouping_type}
              onChange={(e) =>
                setForm({ ...form, grouping_type: e.target.value })
              }
            >
              <option value="INDIFERENTE">Indiferente</option>
              <option value="DUPLAS">Aulas Duplas</option>
              <option value="SEPARADAS">Aulas Separadas</option>
              <option value="SEQUENCIA">Aulas em Sequência</option>
            </select>
          </div>

          <div className="col-12 d-flex gap-4 pt-2">
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_consec_days"
                checked={form.allow_consecutive_days}
                onChange={(e) =>
                  setForm({
                    ...form,
                    allow_consecutive_days: e.target.checked,
                  })
                }
              />
              <label className="form-check-label" htmlFor="chk_consec_days">
                Permitir aulas em dias consecutivos
              </label>
            </div>
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_lesson_active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="chk_lesson_active">
                Aula Ativa
              </label>
            </div>
          </div>
        </div>
      </CrudModal>
    </div>
  );
}
