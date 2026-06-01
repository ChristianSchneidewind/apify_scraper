import re

from src.screenshots import make_post_slug, make_uuid7


def test_make_post_slug_normalizes_url():
    slug = make_post_slug("https://www.instagram.com/p/AbC-123/?utm_source=test")
    assert slug == "www-instagram-com-p-abc-123-utm-source-test"


def test_make_uuid7_format_and_version_variant_bits():
    uid = make_uuid7()
    assert re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", uid)
    assert uid[14] == "7"
    assert uid[19] in {"8", "9", "a", "b"}
