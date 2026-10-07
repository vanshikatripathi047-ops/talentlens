"""Offline schema drift checks and optional isolated PostgreSQL constraint tests."""

import importlib.util
import os
from pathlib import Path
import unittest
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, MetaData, Table, UniqueConstraint, create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Campaign, Company, CreatorProfile, ShortlistEntry, User, UserRole
from app.seed import seed


class Recorder:
    def __init__(self):
        self.metadata = MetaData()
        self.indexes = {}

    def create_table(self, name, *items):
        Table(name, self.metadata, *items)

    def create_index(self, name, table, columns):
        self.indexes[name] = (table, tuple(columns))


class SchemaTests(unittest.TestCase):
    def test_migration_matches_models(self):
        recorder = Recorder()
        for filename in ["d8f412c0a901_company_workspace.py", "e20b4f6a9012_content_ideas.py"]:
            path = Path(__file__).resolve().parents[1] / "migrations/versions" / filename
            spec = importlib.util.spec_from_file_location("workspace_migration", path)
            migration = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(migration)
            migration.op = recorder
            migration.upgrade()
        for name, table in recorder.metadata.tables.items():
            expected = Base.metadata.tables[name]
            with self.subTest(table=name):
                self.assertEqual(set(table.columns.keys()), set(expected.columns.keys()))
                for column in table.columns:
                    model = expected.columns[column.name]
                    self.assertEqual(column.nullable, model.nullable, column.name)
                    self.assertEqual(str(column.type), str(model.type), column.name)
                    self.assertEqual({(fk.target_fullname, fk.ondelete) for fk in column.foreign_keys},
                                     {(fk.target_fullname, fk.ondelete) for fk in model.foreign_keys})
                signature = lambda item: str(item.sqltext) if isinstance(item, CheckConstraint) else tuple(c.name for c in item.columns)
                for kind in [CheckConstraint, UniqueConstraint]:
                    self.assertEqual({signature(c) for c in table.constraints if isinstance(c, kind)},
                                     {signature(c) for c in expected.constraints if isinstance(c, kind)})
                self.assertEqual({index.name: (name, tuple(c.name for c in index.columns)) for index in expected.indexes},
                                 {key: value for key, value in recorder.indexes.items() if value[0] == name})


class PostgreSQLFixture:
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(os.environ["TEST_DATABASE_URL"], connect_args={"connect_timeout": 5})
        if cls.engine.dialect.name != "postgresql":
            raise ValueError("Integration tests require PostgreSQL.")

    def setUp(self):
        self.connection = self.engine.connect()
        self.transaction = self.connection.begin()
        self.schema = f"tl_test_{uuid.uuid4().hex}"
        self.connection.execute(text(f'CREATE SCHEMA "{self.schema}"'))
        self.connection.execute(text(f'SET LOCAL search_path TO "{self.schema}"'))
        # Apply the actual migration chain in a transactional, isolated schema.
        from alembic import command
        from alembic.config import Config
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "migrations"))
        config.attributes["connection"] = self.connection
        command.upgrade(config, "head")
        self.database = Session(bind=self.connection, join_transaction_mode="create_savepoint")
        owner = User(email=f"{uuid.uuid4()}@example.com", hashed_password="test-only", full_name="Test Brand", role=UserRole.BRAND)
        self.database.add(owner)
        self.database.flush()
        self.company = Company(owner_id=owner.id, name="Test company", industry="Fitness")
        self.creator = CreatorProfile(display_name="Test creator", category="Fitness")
        self.database.add_all([self.company, self.creator])
        self.database.flush()

    def tearDown(self):
        self.database.close()
        self.transaction.rollback()
        self.connection.close()


@unittest.skipUnless(os.environ.get("TEST_DATABASE_URL"), "Set TEST_DATABASE_URL for PostgreSQL integration tests.")
class PostgreSQLTests(PostgreSQLFixture, unittest.TestCase):
    def test_budget_and_dates_are_enforced(self):
        for budget, start, end in [(Decimal("-1"), None, None), (Decimal("100"), date(2026, 10, 31), date(2026, 10, 1))]:
            with self.database.begin_nested():
                with self.assertRaises(IntegrityError):
                    with self.database.begin_nested():
                        self.database.add(Campaign(company_id=self.company.id, name="Test", objective="Engagement", category="Fitness", budget=budget, start_date=start, end_date=end))
                        self.database.flush()

    def test_shortlist_is_unique_per_company(self):
        self.database.add(ShortlistEntry(company_id=self.company.id, creator_id=self.creator.id))
        self.database.flush()
        with self.assertRaises(IntegrityError):
            with self.database.begin_nested():
                self.database.add(ShortlistEntry(company_id=self.company.id, creator_id=self.creator.id))
                self.database.flush()

    def test_seed_is_idempotent_and_currency_is_exact(self):
        first = seed(self.database, self.company.id)
        second = seed(self.database, self.company.id)
        self.assertEqual(first, {"creators_added": 6, "campaigns_added": 3})
        self.assertEqual(second, {"creators_added": 0, "campaigns_added": 0})
        from sqlalchemy import select
        campaign = self.database.scalar(select(Campaign).where(Campaign.company_id == self.company.id))
        campaign.budget = Decimal("123456.78")
        self.database.flush()
        self.database.refresh(campaign)
        self.assertEqual(campaign.budget, Decimal("123456.78"))


if __name__ == "__main__":
    unittest.main()
