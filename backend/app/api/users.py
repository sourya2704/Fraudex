from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.security import hash_password, JWT_SECRET_KEY, JWT_ALGORITHM
from app.core.audit import log_action
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse

router = APIRouter(prefix="/users", tags=["Users"])

_PRIVILEGED_ROLES = {"ADMIN", "FINANCE_MANAGER"}

_oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)

def _get_optional_user(
    request: Request,
    bearer_token: Optional[str] = Depends(_oauth2),
    db: Session = Depends(get_db),
) -> Optional[User]:
    token = request.cookies.get("fraudex_access_token") or bearer_token
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        return db.query(User).filter(User.id == int(user_id)).first()
    except (JWTError, ValueError):
        return None

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(_get_optional_user),
):
    requested_role = user.role.upper()

    if requested_role in _PRIVILEGED_ROLES:
        if current_user is None or current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only an ADMIN can assign the '{requested_role}' role",
            )

    new_user = User(
        name=user.name,
        email=user.email,
        password_hash=hash_password(user.password),
        role=requested_role,
    )

    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{user.email}' already exists",
        )

    log_action(
        db,
        action="USER_REGISTERED",
        user_id=new_user.id,
        detail={"email": new_user.email, "role": new_user.role},
    )
    db.commit()

    return new_user
