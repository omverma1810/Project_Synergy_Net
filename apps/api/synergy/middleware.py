from django.middleware.common import CommonMiddleware
from django.http import HttpResponseTemporaryRedirect


class PreserveMethodCommonMiddleware(CommonMiddleware):
    """307 Temporary Redirect for APPEND_SLASH instead of Django's default 301.

    When a request arrives without a trailing slash (e.g. POST /api/advisor),
    Django's CommonMiddleware normally issues a 301 Permanent Redirect to add
    the slash. Browsers follow 301s by replaying the request as GET, silently
    converting POST/PUT/PATCH into GET and losing the request body.

    307 Temporary Redirect is defined by RFC 7231 to preserve the original
    HTTP method, so POST /api/advisor → 307 → POST /api/advisor/ works correctly.
    """
    response_redirect_class = HttpResponseTemporaryRedirect
