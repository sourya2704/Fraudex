from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user, require_role
from app.database.connection import SessionLocal
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.core.security import verify_password, create_access_token


router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/login", response_model=TokenResponse)
def login(
    user_data: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == user_data.email
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(
        user_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role
    }


# ---- Temporary RBAC test endpoints (STEP 1) ----
# These exist only to verify role-based access control works.
# You can delete them once RBAC is confirmed.

@router.get("/rbac-test/admin")
def rbac_test_admin(
    current_user: User = Depends(require_role("ADMIN"))
):
    return {
        "message": "Access granted: ADMIN only",
        "your_role": current_user.role,
    }


@router.get("/rbac-test/manager")
def rbac_test_manager(
    current_user: User = Depends(require_role("ADMIN", "FINANCE_MANAGER"))
):
    return {
        "message": "Access granted: ADMIN or FINANCE_MANAGER",
        "your_role": current_user.role,
    }
