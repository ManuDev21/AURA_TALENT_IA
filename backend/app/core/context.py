from dataclasses import dataclass

from fastapi import Request


@dataclass(frozen=True, slots=True)
class ClientInfo:
    ip: str | None
    user_agent: str | None
    request_id: str | None

    @classmethod
    def from_request(cls, request: Request) -> "ClientInfo":
        user_agent = request.headers.get("user-agent")
        return cls(
            ip=request.client.host if request.client else None,
            user_agent=user_agent[:500] if user_agent else None,
            request_id=getattr(request.state, "request_id", None),
        )
