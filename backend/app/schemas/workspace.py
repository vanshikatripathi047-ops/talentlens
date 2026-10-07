import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class CompanyWrite(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    industry: str = Field(min_length=1, max_length=80)
    contact_email: EmailStr | None = None


class CompanyResponse(CompanyWrite):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    currency: str


CampaignStatus = Literal["draft", "planning", "active", "completed"]


class CampaignWrite(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    objective: str = Field(min_length=1, max_length=80)
    category: str = Field(min_length=1, max_length=80)
    budget: Decimal = Field(gt=0, le=Decimal("999999999999.99"), max_digits=14, decimal_places=2)
    start_date: date | None = None
    end_date: date | None = None
    brief: str = Field(default="", max_length=10000)
    deliverables: str = Field(default="", max_length=2000)
    creator_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)

    @field_validator("creator_ids")
    @classmethod
    def unique_creators(cls, values):
        if len(values) != len(set(values)):
            raise ValueError("Select each creator only once.")
        return values

    @model_validator(mode="after")
    def ordered_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must be on or after the start date.")
        return self


class CampaignProgress(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: CampaignStatus | None = None
    completed_milestones: list[Literal["Brief approved", "Creators confirmed", "Content approved", "Published", "Results reviewed"]] | None = Field(default=None, max_length=5)
