from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

# Almacenamiento en memoria: suficiente para un solo proceso en desarrollo.
limiter = Limiter(key_func=get_remote_address, enabled=get_settings().rate_limit_enabled)
