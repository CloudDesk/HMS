# M-PESA index readiness correction — 29 October 2026

Observed Render diagnostic: INDEX_INITIALIZATION / UNCLASSIFIED. The invoice
is payable and the deterministic attempt does not exist. This establishes the
failed boundary, not the exact underlying initialization exception.

Source inspection shows ensureIndexes only awaits Model.init(). Mongoose caches
its initialization promise, including rejection; it also skips automatic index
creation when autoIndex is disabled. Thus init success/failure alone does not
establish the current unique constraints. Existing local database indexes were
previously confirmed present, but Render's cluster/revision is not inferred from
that read.

Correction: use repository-only live index inspection; accept equivalent names
with the required unique compound keys and exact partial predicates. If missing,
use public additive createIndexes(), then revalidate. Never drop/sync indexes or
accept a nonunique/incorrect partial/sparse index. An incompatible existing index
must fail closed. No cached initialization reset, transaction bypass or duplicate
submission change. No clinical/FSD/UI/prototype changes.

Reuse current model index declarations, AppError, diagnostic stage, MongoDB
connection/transactions and existing isolated integration tests. Intended files:
attempt repository, integration regressions, phase plan and verification notes.
No live index modification or deployment is performed by this correction.

Execution: implemented live verification with additive missing-index creation and
post-build validation. Full M-PESA/config suite passes 248 tests, including nine
new real replica-set regressions. API/web typecheck/build, focused lint and
whitespace checks pass; full lint retains 48 unrelated baseline errors. See the
verification note for deployment steps. No next phase or live deployment started.
