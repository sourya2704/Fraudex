from pydantic import BaseModel, EmailStr, field_validator


_VALID_ROLES = {"ADMIN", "FINANCE_MANAGER", "EMPLOYEE"}


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "EMPLOYEE"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        upper = v.upper()
        if upper not in _VALID_ROLES:
            raise ValueError(
                f"Invalid role '{v}'. Must be one of: {', '.join(sorted(_VALID_ROLES))}"
            )
        return upper

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name must not be blank")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True
