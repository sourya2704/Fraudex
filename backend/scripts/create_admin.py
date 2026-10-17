"""
Create (or reset the password of) an ADMIN user.

    python scripts/create_admin.py admin@fraudex.io 'StrongPassword1' "Admin"

Signup only creates EMPLOYEE accounts and only an ADMIN can create other
admins, so the first admin has to be created this way.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app.main  # noqa: E402,F401  (creates tables, registers models)
from app.core.security import hash_password  # noqa: E402
from app.database.connection import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    email, password = sys.argv[1], sys.argv[2]
    name = sys.argv[3] if len(sys.argv) > 3 else "Admin"
    if len(password) < 6:
        sys.exit("Password must be at least 6 characters.")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.password_hash = hash_password(password)
            user.role = "ADMIN"
            action = "updated"
        else:
            db.add(User(name=name, email=email, password_hash=hash_password(password), role="ADMIN"))
            action = "created"
        db.commit()
        print(f"Admin {email} {action}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
