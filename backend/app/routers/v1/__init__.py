from fastapi import APIRouter

from app.routers.v1 import (
    admin,
    analytics,
    applications,
    assessments,
    aura,
    auth,
    candidates,
    career,
    companies,
    cv,
    jobs,
    match,
    passport,
    portfolio,
    privacy,
    skills,
    users,
)

api_router = APIRouter()
for module in (
    auth,
    users,
    candidates,
    skills,
    portfolio,
    cv,
    companies,
    jobs,
    applications,
    assessments,
    match,
    career,
    aura,
    privacy,
    passport,
    analytics,
    admin,
):
    api_router.include_router(module.router)
