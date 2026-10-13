"""
SQLite → PostgreSQL migration script.
Run once: python scripts/migrate_sqlite_to_postgres.py
"""
import json
import os
import sqlite3
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import psycopg2
from psycopg2.extras import execute_values

SQLITE_PATH = os.path.join(os.path.dirname(__file__), "..", "fraudex.db")
PG_URL = os.getenv("DATABASE_URL")


def get_sqlite_conn():
    if not os.path.exists(SQLITE_PATH):
        print(f"SQLite DB not found at {SQLITE_PATH}")
        sys.exit(1)
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_pg_conn():
    import re
    m = re.match(
        r"postgresql://([^:]+):([^@]+)@([^:/]+):?(\d*)/(.+)", PG_URL
    )
    if not m:
        print(f"Cannot parse DATABASE_URL: {PG_URL}")
        sys.exit(1)
    user, password, host, port, dbname = m.groups()
    return psycopg2.connect(
        host=host, port=port or 5432,
        dbname=dbname, user=user, password=password,
    )


def migrate_table(sqlite_cur, pg_cur, table: str, columns: list[str], pk_reset: bool = True):
    sqlite_cur.execute(f"SELECT COUNT(*) FROM {table}")
    count = sqlite_cur.fetchone()[0]
    if count == 0:
        print(f"  {table}: empty, skipping")
        return

    sqlite_cur.execute(f"SELECT {', '.join(columns)} FROM {table}")
    rows = [tuple(row) for row in sqlite_cur.fetchall()]

    pg_cur.execute(f"TRUNCATE TABLE {table} CASCADE")

    col_str = ", ".join(columns)
    execute_values(
        pg_cur,
        f"INSERT INTO {table} ({col_str}) VALUES %s",
        rows,
    )

    if pk_reset:
        pg_cur.execute(f"""
            SELECT setval(
                pg_get_serial_sequence('{table}', 'id'),
                COALESCE(MAX(id), 1)
            ) FROM {table}
        """)

    print(f"  {table}: migrated {len(rows)} rows")


def main():
    print("=== FrauDex SQLite → PostgreSQL Migration ===\n")

    sqlite_conn = get_sqlite_conn()
    sqlite_cur = sqlite_conn.cursor()

    pg_conn = get_pg_conn()
    pg_cur = pg_conn.cursor()

    tables = [
        ("users",    ["id", "name", "email", "password_hash", "role", "created_at"]),
        ("vendors",  ["id", "name", "tax_id", "email", "phone", "address", "created_at"]),
        ("invoices", ["id", "invoice_number", "vendor_id", "uploaded_by",
                      "invoice_date", "due_date", "subtotal", "tax",
                      "total_amount", "currency", "status", "document_path",
                      "raw_text", "created_at", "updated_at"]),
        ("invoice_items", ["id", "invoice_id", "description", "quantity",
                           "unit_price", "tax", "line_total"]),
        ("fraud_detection_results", ["id", "invoice_id", "risk_score", "risk_level",
                                     "fraud_flags", "detection_timestamp",
                                     "critical_count", "high_count",
                                     "medium_count", "low_count"]),
        ("invoice_reviews", ["id", "invoice_id", "reviewer_id", "decision",
                             "reason", "reviewed_at"]),
        ("audit_logs", ["id", "user_id", "invoice_id", "action",
                        "detail", "timestamp"]),
    ]

    try:
        for table, cols in tables:
            try:
                migrate_table(sqlite_cur, pg_cur, table, cols)
            except Exception as e:
                print(f"  {table}: ERROR — {e}")
                pg_conn.rollback()

        pg_conn.commit()
        print("\n✓ Migration complete.")

    except Exception as e:
        pg_conn.rollback()
        print(f"\n✗ Migration failed: {e}")
        sys.exit(1)
    finally:
        sqlite_conn.close()
        pg_cur.close()
        pg_conn.close()


if __name__ == "__main__":
    main()
