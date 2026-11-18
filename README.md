# Schedule Pro (Next.js)

Versão modernizada em **Next.js 15 (App Router) + TypeScript + Prisma ORM** do sistema **Schedule Pro**, conectada ao banco de dados PostgreSQL no **Neon**.

## Principais Módulos e Recursos

- **Autenticação e Compatibilidade Total:**
  - Suporte nativo ao hash de senhas `pbkdf2_sha256` do Django (`src/lib/auth.ts`), permitindo login direto com os usuários migrados sem redefinição de senha.
  - Controle de Planos e Assinaturas (`PlanService`) e permissões por Projeto (`AccessControlService`).
- **Padronização de CRUDs e Templates ("Compact Header" + Modais Avançados):**
  - `<ModuleHeader />`: Cabeçalho compacto padronizado com estatísticas contextuais e botão de ação.
  - `<CrudModal />`: Navegação entre registros (`Anterior` / `Próximo`) sem fechar o modal e ações múltiplas (`Salvar`, `Salvar e Continuar`, `Salvar e Adicionar Outro`, `Excluir`).
  - `<AvailabilityMatrixModal />`: Matriz interativa de disponibilidade para **Professores**, **Salas** e **Turmas**, além do **Portal Exclusivo do Professor** (`/teachers/portal/[token]`) com expiração de 48h e envio via Brevo API.
- **Construtor de Grade Horária, Motor de Colisão e Solver (`src/lib/schedule/`):**
  - `collision-engine.ts`: Motor isomórfico que valida em tempo real colisões entre turmas (incluindo execuções `SATISFIABLE`, `PARTIAL` e `MANUAL`), co-docência (múltiplos professores por aula), capacidade simultânea de salas (`simultaneous_lessons`), herança de sala da disciplina, horários travados (`is_locked`) e alertas pedagógicos.
  - `solver.ts`: Geração automática individual (por turma) e em lote com suporte a alocação parcial (`PARTIAL`), auditoria prévia e diagnóstico detalhado de conflitos.
- **Relatórios e Consulta Pública:**
  - Consulta pública na página inicial (`/`) por Instituição/Curso/Turma e por E-mail do Professor.
  - Relatórios de impressão (`/reports/course`, `/reports/teacher`, `/lessons/report`).

## Configuração e Execução

```bash
npm install
npx prisma generate
npm run dev
```
