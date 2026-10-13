from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.core.security import verify_password, create_access_token
from app.core.audit import log_action

router = APIRouter(prefix="/auth", tags=["Authentication"])

_COOKIE_NAME = "fraudex_access_token"

_COOKIE_SETTINGS = dict(
    key=_COOKIE_NAME,
    httponly=True,
    samesite="lax",
    secure=False,
    path="/",
)

def _authenticate_user(email: str, password: str, db: Session) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user

@router.post("/login", response_model=TokenResponse)
def login(
    response: Response,
    user_data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = _authenticate_user(user_data.email, user_data.password, db)
    token = create_access_token({"sub": str(user.id), "role": user.role})

    response.set_cookie(value=token, **_COOKIE_SETTINGS)

    log_action(db, action="USER_LOGIN", user_id=user.id,
               detail={"email": user.email, "method": "json"})
    db.commit()

    return {"access_token": token, "token_type": "bearer"}

@router.post("/token", response_model=TokenResponse, include_in_schema=False)
def login_swagger(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = _authenticate_user(form_data.username, form_data.password, db)
    token = create_access_token({"sub": str(user.id), "role": user.role})

    response.set_cookie(value=token, **_COOKIE_SETTINGS)

    log_action(db, action="USER_LOGIN", user_id=user.id,
               detail={"email": user.email, "method": "swagger_form"})
    db.commit()

    return {"access_token": token, "token_type": "bearer"}

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response, db: Session = Depends(get_db)):
    response.delete_cookie(key=_COOKIE_NAME, path="/", samesite="lax")
    log_action(db, action="USER_LOGOUT")
    db.commit()
    return {"message": "Logged out successfully"}

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
    }


from pydantic import BaseModel as _BaseModel

class _ChangePwdRequest(_BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    body: _ChangePwdRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.core.security import verify_password, hash_password
    from app.models.password_history import PasswordHistory

    # 1. verify current password
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters.")

    # 2. check last 2 passwords
    last_2 = (
        db.query(PasswordHistory)
        .filter(PasswordHistory.user_id == current_user.id)
        .order_by(PasswordHistory.created_at.desc())
        .limit(2)
        .all()
    )
    # also check current password itself
    all_old = [current_user.password_hash] + [h.password_hash for h in last_2]
    for old_hash in all_old:
        if verify_password(body.new_password, old_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot reuse your last 2 passwords. Please choose a different password.",
            )

    # 3. save current to history
    db.add(PasswordHistory(user_id=current_user.id, password_hash=current_user.password_hash))

    # 4. update
    current_user.password_hash = hash_password(body.new_password)
    log_action(db, action="PASSWORD_CHANGED", user_id=current_user.id, detail={})
    db.commit()

    return {"message": "Password changed successfully."}
