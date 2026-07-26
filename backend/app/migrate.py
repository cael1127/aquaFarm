from __future__ import annotations

from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.db import engine


async def run_migrations(db_engine: AsyncEngine | None = None) -> None:
    """Apply idempotent SQL migrations against Timescale/Postgres."""
    eng = db_engine or engine
    sql_path = Path(__file__).resolve().parents[1] / "sql" / "migrate.sql"
    sql = sql_path.read_text(encoding="utf-8")

    # Split on semicolons carefully enough for our migration file:
    # execute statement-by-statement, skipping empty chunks.
    statements: list[str] = []
    buf: list[str] = []
    in_dollar = False
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--") and not in_dollar:
            continue
        if "$$" in line:
            # toggle on each $$ pair occurrence count
            in_dollar = (line.count("$$") % 2 == 1) ^ in_dollar
        buf.append(line)
        if not in_dollar and stripped.endswith(";"):
            statements.append("\n".join(buf).strip())
            buf = []
    if buf:
        tail = "\n".join(buf).strip()
        if tail:
            statements.append(tail)

    async with eng.begin() as conn:
        for stmt in statements:
            if not stmt or stmt == ";":
                continue
            await conn.execute(text(stmt))
