"""Remove only a disposable account created by scripts/verify-backend.cjs."""

import argparse

from sqlalchemy import delete, select

from app.database import SessionLocal
from app.models import Company, User


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    email = parser.parse_args().email
    if not email.startswith("tl-qa-") or not email.endswith("@example.com"):
        raise ValueError("Only designated browser-test email addresses are allowed.")
    with SessionLocal.begin() as database:
        user = database.scalar(select(User).where(User.email == email))
        if not user:
            print("Test account already absent.")
            return
        if user.full_name != "Backend Verification":
            raise ValueError("Account does not match the browser-test identity.")
        database.execute(delete(Company).where(Company.owner_id == user.id))
        database.delete(user)
    print("Disposable browser-test account and its company records removed.")


if __name__ == "__main__":
    main()
