"""Shared error types for the OMR job queue."""


class OmrQueueError(Exception):
    """Raised when any step of the OMR queue pipeline fails."""
