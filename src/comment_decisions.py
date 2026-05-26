def should_force_row_multipart(*, text_len: int, mode: str, threshold: int) -> bool:
    return text_len >= threshold and mode == "single"


def calc_forced_parts(*, text_len: int, base: int, min_parts: int = 2, max_parts: int = 6) -> int:
    return min(max_parts, max(min_parts, (text_len + (base - 1)) // base))


def total_parts(scroll_parts) -> int:
    return max(1, len(scroll_parts or []))


def should_use_3plus_route(parts: int) -> bool:
    return parts >= 3
