import src.dom_selectors as ds
import src.instagram_dom as ig
import src.tuning as tuning


def test_dom_selectors_reexport():
    assert ds.COMMENT_TIME_SELECTOR == ig.COMMENT_TIME_SELECTOR
    assert ds.COMMENT_PERMALINK_SELECTOR == ig.COMMENT_PERMALINK_SELECTOR


def test_tuning_constants_positive():
    assert tuning.PREPARE_SCROLL_WAIT_MS > 0
    assert tuning.REHIGHLIGHT_WAIT_MS > 0
