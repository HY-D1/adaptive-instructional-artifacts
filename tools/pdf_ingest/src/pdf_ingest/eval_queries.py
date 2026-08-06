from __future__ import annotations

from dataclasses import dataclass

EMBEDDING_QUERYSET_VERSION = "v1"


@dataclass(frozen=True)
class EvalQuery:
    id: str
    surface: str
    text: str
    expected_unit_ids: tuple[str, ...]
    expected_terms: tuple[str, ...]


def _u(page: int) -> str:
    return f"dbms-ramakrishnan-3rd-edition/page-{page}"


def default_eval_queries() -> list[EvalQuery]:
    return [
        # Hint retrieval queries (misconception-oriented / short)
        EvalQuery(
            id="hint-foreign-key-meaning",
            surface="hints",
            text="foreign key meaning in a relational schema",
            expected_unit_ids=(_u(47), _u(46)),
            expected_terms=("foreign", "key", "integrity", "schema"),
        ),
        EvalQuery(
            id="hint-join-vs-relationship",
            surface="hints",
            text="difference between table relationship and join",
            expected_unit_ids=(_u(45), _u(46)),
            expected_terms=("relation", "relationship", "join", "table"),
        ),
        EvalQuery(
            id="hint-schema-vs-instance",
            surface="hints",
            text="schema vs instance quick explanation",
            expected_unit_ids=(_u(45), _u(48)),
            expected_terms=("schema", "instance", "relation"),
        ),
        EvalQuery(
            id="hint-why-normalize",
            surface="hints",
            text="why normalize a database design",
            expected_unit_ids=(_u(46), _u(47)),
            expected_terms=("design", "redundancy", "integrity", "constraints"),
        ),
        EvalQuery(
            id="hint-weak-entity",
            surface="hints",
            text="weak entity explanation in ER modeling",
            expected_unit_ids=(_u(45), _u(48)),
            expected_terms=("entity", "ER", "model", "relationship"),
        ),
        EvalQuery(
            id="hint-data-independence",
            surface="hints",
            text="data independence quick hint",
            expected_unit_ids=(_u(44), _u(50)),
            expected_terms=("data", "independence", "application"),
        ),
        EvalQuery(
            id="hint-concurrency-control",
            surface="hints",
            text="why concurrency control matters",
            expected_unit_ids=(_u(42), _u(41)),
            expected_terms=("concurrency", "transaction", "DBMS"),
        ),
        EvalQuery(
            id="hint-integrity-constraints",
            surface="hints",
            text="integrity constraints simple hint",
            expected_unit_ids=(_u(47), _u(46)),
            expected_terms=("integrity", "constraint", "sid", "relation"),
        ),
        EvalQuery(
            id="hint-logical-vs-physical",
            surface="hints",
            text="logical vs physical schema hint",
            expected_unit_ids=(_u(49), _u(50)),
            expected_terms=("logical", "physical", "schema"),
        ),
        EvalQuery(
            id="hint-file-system-vs-dbms",
            surface="hints",
            text="file system versus dbms short explanation",
            expected_unit_ids=(_u(43), _u(44)),
            expected_terms=("file", "system", "DBMS", "advantages"),
        ),

        # Explanation retrieval queries (why/how, richer)
        EvalQuery(
            id="explain-dbms-vs-files",
            surface="explanations",
            text="why use a DBMS instead of storing data in separate application files",
            expected_unit_ids=(_u(43), _u(44), _u(45)),
            expected_terms=("file systems", "DBMS", "advantages", "data"),
        ),
        EvalQuery(
            id="explain-logical-physical-independence",
            surface="explanations",
            text="explain logical and physical data independence with practical impact",
            expected_unit_ids=(_u(49), _u(50), _u(44)),
            expected_terms=("logical", "physical", "schema", "independence"),
        ),
        EvalQuery(
            id="explain-concurrency",
            surface="explanations",
            text="why database concurrency control is necessary for correct results",
            expected_unit_ids=(_u(42), _u(41)),
            expected_terms=("concurrency", "transactions", "correctness"),
        ),
        EvalQuery(
            id="explain-er-before-relational",
            surface="explanations",
            text="why build ER or conceptual schema before relational implementation",
            expected_unit_ids=(_u(45), _u(48)),
            expected_terms=("conceptual schema", "ER", "relational"),
        ),
        EvalQuery(
            id="explain-poor-schema-design",
            surface="explanations",
            text="explain consequences of poor schema design with an example",
            expected_unit_ids=(_u(46), _u(47)),
            expected_terms=("poor design", "schema", "integrity"),
        ),
        EvalQuery(
            id="explain-levels-of-abstraction",
            surface="explanations",
            text="explain external conceptual and physical schema levels",
            expected_unit_ids=(_u(48), _u(49), _u(50)),
            expected_terms=("external", "conceptual", "physical", "schema"),
        ),
        EvalQuery(
            id="explain-dbms-market-and-use",
            surface="explanations",
            text="how DBMS became widely used in real systems and applications",
            expected_unit_ids=(_u(41), _u(42), _u(43)),
            expected_terms=("DBMS", "applications", "history"),
        ),
        EvalQuery(
            id="explain-integrity-constraints-detail",
            surface="explanations",
            text="how integrity constraints protect data quality in relational databases",
            expected_unit_ids=(_u(47), _u(46)),
            expected_terms=("integrity", "constraints", "data quality"),
        ),
        EvalQuery(
            id="explain-relations-and-keys",
            surface="explanations",
            text="explain relation schema keys and why unique identifiers matter",
            expected_unit_ids=(_u(46), _u(47)),
            expected_terms=("relation", "schema", "key", "unique"),
        ),
        EvalQuery(
            id="explain-data-admin-benefits",
            surface="explanations",
            text="why centralized database administration helps teams and applications",
            expected_unit_ids=(_u(44), _u(45)),
            expected_terms=("administration", "application", "DBMS"),
        ),

        # Learning-page concept retrieval queries (concept-centric)
        EvalQuery(
            id="concept-relational-model",
            surface="learning_page",
            text="relational model",
            expected_unit_ids=(_u(45), _u(46), _u(47)),
            expected_terms=("relational model", "relation", "schema"),
        ),
        EvalQuery(
            id="concept-integrity-constraints",
            surface="learning_page",
            text="integrity constraints",
            expected_unit_ids=(_u(47), _u(46)),
            expected_terms=("integrity", "constraints"),
        ),
        EvalQuery(
            id="concept-transactions",
            surface="learning_page",
            text="transactions and concurrency",
            expected_unit_ids=(_u(42), _u(41)),
            expected_terms=("transaction", "concurrency"),
        ),
        EvalQuery(
            id="concept-conceptual-schema",
            surface="learning_page",
            text="conceptual schema",
            expected_unit_ids=(_u(48), _u(49)),
            expected_terms=("conceptual schema", "abstraction"),
        ),
        EvalQuery(
            id="concept-er-model",
            surface="learning_page",
            text="ER model",
            expected_unit_ids=(_u(45), _u(48)),
            expected_terms=("ER model", "entity", "relationship"),
        ),
        EvalQuery(
            id="concept-data-independence",
            surface="learning_page",
            text="data independence",
            expected_unit_ids=(_u(44), _u(50)),
            expected_terms=("data independence", "logical", "physical"),
        ),
        EvalQuery(
            id="concept-file-systems-vs-dbms",
            surface="learning_page",
            text="file systems versus DBMS",
            expected_unit_ids=(_u(43), _u(44)),
            expected_terms=("file systems", "DBMS"),
        ),
        EvalQuery(
            id="concept-physical-schema",
            surface="learning_page",
            text="physical schema",
            expected_unit_ids=(_u(49),),
            expected_terms=("physical schema", "storage"),
        ),
        EvalQuery(
            id="concept-external-schema",
            surface="learning_page",
            text="external schema",
            expected_unit_ids=(_u(48), _u(49)),
            expected_terms=("external schema", "views"),
        ),
        EvalQuery(
            id="concept-dbms-advantages",
            surface="learning_page",
            text="advantages of a DBMS",
            expected_unit_ids=(_u(44), _u(43)),
            expected_terms=("advantages", "DBMS", "applications"),
        ),
    ]


def validate_eval_queries(queries: list[EvalQuery]) -> None:
    if len(queries) < 30:
        raise ValueError(f"expected at least 30 queries, got {len(queries)}")

    seen_ids: set[str] = set()
    counts = {"hints": 0, "explanations": 0, "learning_page": 0}

    for query in queries:
        if query.id in seen_ids:
            raise ValueError(f"duplicate query id: {query.id}")
        seen_ids.add(query.id)

        if query.surface not in counts:
            raise ValueError(f"invalid query surface: {query.surface}")
        counts[query.surface] += 1

        if not query.text.strip():
            raise ValueError(f"empty query text: {query.id}")
        if not query.expected_unit_ids:
            raise ValueError(f"query {query.id} missing expected_unit_ids")

    for surface, count in counts.items():
        if count < 10:
            raise ValueError(f"expected at least 10 queries for {surface}, got {count}")
