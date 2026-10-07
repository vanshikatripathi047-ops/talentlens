"""Start/stop the project-local Windows PostgreSQL development instance."""

import argparse
from pathlib import Path
import subprocess
import tempfile

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url

from app.config import settings


ROOT = Path(__file__).resolve().parents[2] / ".local" / "postgres"
BIN = ROOT / "runtime" / "pgsql" / "bin"
DATA = ROOT / "data"


def run(*arguments):
    subprocess.run([str(arguments[0]), *map(str, arguments[1:])], check=True,
                   creationflags=subprocess.CREATE_NO_WINDOW)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["start", "stop", "status"], default="start", nargs="?")
    action = parser.parse_args().action
    url = make_url(settings.database_url)
    if url.host not in {"localhost", "127.0.0.1"} or not url.username or not url.password or not url.database:
        raise ValueError("This helper requires a password-protected localhost DATABASE_URL.")
    if not (BIN / "pg_ctl.exe").exists():
        raise FileNotFoundError("Extract the official Windows PostgreSQL binaries into .local/postgres/runtime first.")
    pg_ctl = BIN / "pg_ctl.exe"
    if action != "start":
        run(pg_ctl, "-D", DATA, action, *(["-m", "fast", "-w"] if action == "stop" else []))
        return
    if not (DATA / "PG_VERSION").exists():
        ROOT.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=ROOT, delete=False) as password_file:
            password_file.write(url.password + "\n")
            password_path = Path(password_file.name)
        try:
            run(BIN / "initdb.exe", "-D", DATA, "-U", "postgres", "--auth=scram-sha-256",
                "--encoding=UTF8", "--locale=C", f"--pwfile={password_path}")
        finally:
            password_path.unlink(missing_ok=True)
    status = subprocess.run([str(pg_ctl), "-D", str(DATA), "status"], capture_output=True,
                            creationflags=subprocess.CREATE_NO_WINDOW)
    if status.returncode != 0:
        run(pg_ctl, "-D", DATA, "-l", ROOT / "server.log", "-o",
            f"-h 127.0.0.1 -p {url.port or 5432}", "-w", "start")
    # The application owns only its database and is not a PostgreSQL superuser.
    with psycopg.connect(host="127.0.0.1", port=url.port or 5432, user="postgres",
                         password=url.password, dbname="postgres", autocommit=True, connect_timeout=5) as connection:
        if not connection.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (url.username,)).fetchone():
            connection.execute(sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(
                sql.Identifier(url.username), sql.Literal(url.password)))
        if not connection.execute("SELECT 1 FROM pg_database WHERE datname = %s", (url.database,)).fetchone():
            connection.execute(sql.SQL("CREATE DATABASE {} OWNER {}").format(
                sql.Identifier(url.database), sql.Identifier(url.username)))
    print(f"Project PostgreSQL ready at 127.0.0.1:{url.port or 5432}/{url.database}")


if __name__ == "__main__":
    main()
