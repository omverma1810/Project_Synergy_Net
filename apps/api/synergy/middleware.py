from django.middleware.common import CommonMiddleware
from django.http import HttpResponseRedirect


class _HttpResponse307(HttpResponseRedirect):
    """307 Temporary Redirect — preserves the original HTTP method per RFC 7231."""
    status_code = 307


class PreserveMethodCommonMiddleware(CommonMiddleware):
    """Use 307 instead of 301 for APPEND_SLASH redirects.

    Django's default 301 causes browsers to replay the request as GET,
    silently converting POST/PUT/PATCH into GET and losing the body.
    307 preserves the original method.
    """
    response_redirect_class = _HttpResponse307
