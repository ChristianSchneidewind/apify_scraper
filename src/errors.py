class ScraperError(Exception):
    """Base class for scraper-specific errors."""


class InputValidationError(ScraperError):
    """Raised when actor input is invalid."""


class LoginError(ScraperError):
    """Raised when login flow fails."""


class UiDriftError(ScraperError):
    """Raised when expected UI elements are missing due to DOM drift."""
