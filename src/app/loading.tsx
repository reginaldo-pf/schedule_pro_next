export default function GlobalLoading() {
  return (
    <div
      className="no-print"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2035,
        backgroundColor: "rgba(15, 23, 42, 0.25)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "wait",
      }}
    >
      <div
        className="bg-white rounded-4 shadow-lg px-4 py-3 d-flex align-items-center gap-3 border"
        style={{ minWidth: 230 }}
      >
        <div
          className="spinner-border text-primary flex-shrink-0"
          role="status"
          style={{ width: "1.75rem", height: "1.75rem", borderWidth: "0.2em" }}
        >
          <span className="visually-hidden">Carregando...</span>
        </div>
        <div>
          <div className="fw-bold text-dark" style={{ fontSize: "0.92rem" }}>
            Carregando página...
          </div>
          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
            Aguarde um instante
          </div>
        </div>
      </div>
    </div>
  );
}
