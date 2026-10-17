import re
from typing import Optional

from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.security import hash_password, JWT_SECRET_KEY, JWT_ALGORITHM
from app.core.audit import log_action
from app.models.user import User
from app.models.user_avatar import UserAvatar
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


# ── Profile photo ─────────────────────────────────────────────────────────────

# The frontend resizes photos to 256px JPEG (~20-40 KB); this caps abuse.
_MAX_AVATAR_CHARS = 400_000
_AVATAR_RE = re.compile(r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")


class AvatarBody(BaseModel):
    avatar: str


@router.get("/me/avatar")
def get_my_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.get(UserAvatar, current_user.id)
    return {"avatar": row.data_url if row else None}


@router.put("/me/avatar")
def set_my_avatar(
    body: AvatarBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(body.avatar) > _MAX_AVATAR_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Photo is too large. Please choose a smaller image.",
        )
    if not _AVATAR_RE.match(body.avatar):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo must be a JPEG, PNG or WebP image.",
        )

    row = db.get(UserAvatar, current_user.id)
    if row:
        row.data_url = body.avatar
    else:
        db.add(UserAvatar(user_id=current_user.id, data_url=body.avatar))
    log_action(db, action="AVATAR_UPDATED", user_id=current_user.id)
    db.commit()
    return {"avatar": body.avatar}


@router.delete("/me/avatar", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.get(UserAvatar, current_user.id)
    if row:
        db.delete(row)
        log_action(db, action="AVATAR_REMOVED", user_id=current_user.id)
        db.commit()
    return None
