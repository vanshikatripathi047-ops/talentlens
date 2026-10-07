"""Validation and tenant-isolation checks for the company workspace."""

import unittest
import uuid
import os

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.database import get_db
from app.main import app
from app.models import Campaign, CampaignCreator, CampaignResult, Company, User, UserRole
from datetime import date
from app.routes.auth import current_user
from app.schemas.workspace import CampaignWrite, CompanyWrite
from test_workspace_schema import PostgreSQLFixture


class ValidationTests(unittest.TestCase):
    def test_campaign_rejects_invalid_values(self):
        base = {"name": "Launch", "objective": "Awareness", "category": "Fitness", "budget": "100.00"}
        creator = str(uuid.uuid4())
        for change in [{"budget": "0"}, {"budget": "1.001"},
                       {"start_date": "2026-10-31", "end_date": "2026-10-01"},
                       {"creator_ids": [creator, creator]}, {"company_id": str(uuid.uuid4())}]:
            with self.subTest(change=change), self.assertRaises(ValidationError):
                CampaignWrite(**(base | change))

    def test_company_name_cannot_be_blank(self):
        with self.assertRaises(ValidationError):
            CompanyWrite(name="   ", industry="Fitness")


@unittest.skipUnless(os.environ.get("TEST_DATABASE_URL"), "Set TEST_DATABASE_URL for PostgreSQL integration tests.")
class WorkspaceAPITests(PostgreSQLFixture, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.database.get(User, self.company.owner_id)
        other = User(email=f"{uuid.uuid4()}@example.com", hashed_password="test-only",
                     full_name="Other Brand", role=UserRole.BRAND)
        self.database.add(other)
        self.database.flush()
        company = Company(owner_id=other.id, name="Other company", industry="Fitness")
        self.database.add(company)
        self.database.flush()
        campaign = Campaign(company_id=company.id, name="Private campaign", objective="Awareness",
                            category="Fitness", budget=100)
        self.database.add(campaign)
        self.database.flush()
        self.other_campaign_id = campaign.id
        self.other_owner_id = other.id
        app.dependency_overrides[get_db] = lambda: self.database
        app.dependency_overrides[current_user] = lambda: self.owner
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        super().tearDown()

    def test_other_company_campaign_is_not_accessible(self):
        url = f"/workspace/campaigns/{self.other_campaign_id}"
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, json={"status": "active"}).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertEqual(self.client.get("/workspace/campaigns").json(), [])

    def test_shortlist_is_idempotent(self):
        url = f"/workspace/shortlist/{self.creator.id}"
        self.assertEqual(self.client.put(url).status_code, 204)
        self.assertEqual(self.client.put(url).status_code, 204)
        self.assertEqual(self.client.get("/workspace/shortlist").json(), [str(self.creator.id)])
        app.dependency_overrides[current_user] = lambda: self.database.get(User, self.other_owner_id)
        self.assertEqual(self.client.get("/workspace/shortlist").json(), [])
        app.dependency_overrides[current_user] = lambda: self.owner
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertEqual(self.client.get("/workspace/shortlist").json(), [])

    def test_campaign_creation_and_progress(self):
        response = self.client.post("/workspace/campaigns", json={
            "name": "Launch", "objective": "Awareness", "category": "Fitness",
            "budget": "123456.78", "creator_ids": [str(self.creator.id)],
        })
        self.assertEqual(response.status_code, 201, response.text)
        campaign = response.json()
        self.assertEqual(campaign["budget"], "123456.78")
        url = f"/workspace/campaigns/{campaign['id']}"
        response = self.client.patch(url, json={"status": "active", "completed_milestones": ["Brief approved"]})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["completed_milestones"], ["Brief approved"])
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_creator_accounts_cannot_use_company_routes(self):
        self.owner.role = UserRole.CREATOR
        self.assertEqual(self.client.get("/workspace/creators").status_code, 403)

    def test_anonymous_requests_need_login(self):
        del app.dependency_overrides[current_user]
        self.assertEqual(self.client.get("/workspace/creators").status_code, 401)

    def test_results_use_latest_snapshot_and_hide_other_company(self):
        campaign = Campaign(company_id=self.company.id, name="Owned", objective="Awareness",
                            category="Fitness", budget=100)
        self.database.add(campaign)
        self.database.flush()
        assignment = CampaignCreator(campaign_id=campaign.id, creator_id=self.creator.id)
        foreign = CampaignCreator(campaign_id=self.other_campaign_id, creator_id=self.creator.id)
        self.database.add_all([assignment, foreign])
        self.database.flush()
        self.database.add_all([
            CampaignResult(assignment_id=assignment.id, observed_on=date(2026, 10, 1), reach=100, engagements=10, clicks=1, spend=10),
            CampaignResult(assignment_id=assignment.id, observed_on=date(2026, 10, 2), reach=200, engagements=20, clicks=2, spend=20),
            CampaignResult(assignment_id=foreign.id, observed_on=date(2026, 10, 2), reach=999, engagements=30, clicks=3, spend=30),
        ])
        self.database.flush()
        response = self.client.get("/workspace/results")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["reach"], 200)

    def test_registration_login_and_logout(self):
        del app.dependency_overrides[current_user]
        credentials = {"email": f"{uuid.uuid4()}@example.com", "password": "Development-test-489!"}
        response = self.client.post("/auth/register", json={**credentials, "full_name": "Test account", "role": "brand"})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(self.client.post("/auth/login", json=credentials).status_code, 200)
        self.assertEqual(self.client.get("/auth/me").status_code, 200)
        self.assertEqual(self.client.put("/workspace/company", json={"name": "New brand", "industry": "Fitness"}).status_code, 200)
        self.assertEqual(self.client.post("/auth/logout").status_code, 204)
        self.assertEqual(self.client.get("/auth/me").status_code, 401)

    def test_public_demo_is_seeded_read_only_and_isolated(self):
        from app.seed import demo_company, seed
        company = demo_company(self.database)
        first = seed(self.database, company.id)
        self.assertEqual(seed(self.database, demo_company(self.database).id), {"creators_added": 0, "campaigns_added": 0})
        self.assertEqual(first, {"creators_added": 6, "campaigns_added": 3})
        del app.dependency_overrides[current_user]
        response = self.client.get("/demo/workspace")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()["creators"]), 6)
        self.assertEqual(len(response.json()["campaigns"]), 3)
        self.assertEqual(len(response.json()["results"]), 3)
        for creator in response.json()["creators"]:
            self.assertEqual(len(creator["content"]), 4)
            self.assertEqual(len(creator["ideas"]), 2)
            self.assertTrue(all(item["is_sample"] for item in creator["content"] + creator["ideas"]))
            self.assertTrue(creator["ideas"][0]["hashtags"])
        self.assertNotIn(str(self.other_campaign_id), [item["id"] for item in response.json()["campaigns"]])
        self.assertEqual(self.client.post("/demo/workspace", json={}).status_code, 405)

    def test_snapshot_and_sample_data_are_company_scoped(self):
        response = self.client.post("/workspace/sample-data")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["campaigns_added"], 3)
        self.assertEqual(self.client.post("/workspace/sample-data").json()["campaigns_added"], 0)
        self.client.put(f"/workspace/shortlist/{self.creator.id}")
        response = self.client.get("/workspace/snapshot")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["saved"], [str(self.creator.id)])
        self.assertEqual(len(response.json()["campaigns"]), 3)
        self.assertNotIn(str(self.other_campaign_id), [item["id"] for item in response.json()["campaigns"]])
