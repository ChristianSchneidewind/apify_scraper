import asyncio

import src.comments as comments


class FakeProp:
    def __init__(self, element=None):
        self._element = element
        self.disposed = False

    def as_element(self):
        return self._element

    async def dispose(self):
        self.disposed = True


class FakeHandleArray:
    def __init__(self, props):
        self._props = props
        self.disposed = False

    async def get_properties(self):
        return self._props

    async def dispose(self):
        self.disposed = True


class FakeTimeHandle:
    def __init__(self, eval_result, element_handle):
        self.eval_result = eval_result
        self.element_handle = element_handle

    async def evaluate(self, _script):
        return self.eval_result

    async def evaluate_handle(self, _script):
        return self.element_handle


class FakeItemHandle:
    def __init__(self, eval_result):
        self.eval_result = eval_result

    async def evaluate(self, _script):
        return self.eval_result


class FakePage:
    def __init__(self):
        self.map = {}
        self.handle_array = None

    async def query_selector_all(self, selector):
        return self.map.get(selector, [])

    async def evaluate_handle(self, _script):
        return self.handle_array


def test_extract_comment_from_time_none_when_js_returns_null():
    th = FakeTimeHandle(None, object())
    data, el = asyncio.run(comments.extract_comment_from_time(th))
    assert data is None
    assert el is None


def test_extract_comment_from_time_returns_data_and_element_handle():
    data_in = {"username": "alice", "text": "hi"}
    el = object()
    th = FakeTimeHandle(data_in, el)
    data, out_el = asyncio.run(comments.extract_comment_from_time(th))
    assert data == data_in
    assert out_el is el


def test_extract_comment_from_item_none_and_success():
    ih_none = FakeItemHandle(None)
    data, el = asyncio.run(comments.extract_comment_from_item(ih_none))
    assert data is None and el is None

    ih_ok = FakeItemHandle({"username": "bob", "text": "hello"})
    data2, el2 = asyncio.run(comments.extract_comment_from_item(ih_ok))
    assert data2["username"] == "bob"
    assert el2 is ih_ok


def test_get_comment_rows_prefers_dialog_then_fallback():
    page = FakePage()
    page.map[comments.DIALOG_COMMENT_ROWS_SELECTOR] = ["d1"]
    page.map[comments.POST_COMMENT_ROWS_FALLBACK_SELECTOR] = ["f1"]

    out = asyncio.run(comments.get_comment_rows(page))
    assert out == ["d1"]

    page2 = FakePage()
    page2.map[comments.DIALOG_COMMENT_ROWS_SELECTOR] = []
    page2.map[comments.POST_COMMENT_ROWS_FALLBACK_SELECTOR] = ["f1"]
    out2 = asyncio.run(comments.get_comment_rows(page2))
    assert out2 == ["f1"]


def test_get_post_comment_rows_li_first_then_eval_rows_then_last_resort():
    page = FakePage()
    page.map[comments.POST_COMMENT_LI_ROWS_SELECTOR] = ["li1"]
    out = asyncio.run(comments.get_post_comment_rows(page))
    assert out == ["li1"]

    page2 = FakePage()
    page2.map[comments.POST_COMMENT_LI_ROWS_SELECTOR] = []
    elem1 = object()
    prop1 = FakeProp(elem1)
    prop2 = FakeProp(None)
    page2.handle_array = FakeHandleArray({"0": prop1, "1": prop2})
    out2 = asyncio.run(comments.get_post_comment_rows(page2))
    assert out2 == [elem1]
    assert prop2.disposed is True
    assert page2.handle_array.disposed is True

    page3 = FakePage()
    page3.map[comments.POST_COMMENT_LI_ROWS_SELECTOR] = []
    page3.handle_array = FakeHandleArray({})
    page3.map[comments.POST_COMMENT_LAST_RESORT_SELECTOR] = ["r1", "r2"]
    out3 = asyncio.run(comments.get_post_comment_rows(page3))
    assert out3 == ["r1", "r2"]


def test_get_dialog_comment_rows_is_alias_for_get_comment_rows():
    page = FakePage()
    page.map[comments.DIALOG_COMMENT_ROWS_SELECTOR] = ["x"]
    out = asyncio.run(comments.get_dialog_comment_rows(page))
    assert out == ["x"]
