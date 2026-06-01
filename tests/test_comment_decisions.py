from src.comment_decisions import (
    calc_forced_parts,
    should_force_row_multipart,
    should_use_3plus_route,
    total_parts,
)


def test_should_force_row_multipart():
    assert should_force_row_multipart(text_len=300, mode="single", threshold=250)
    assert not should_force_row_multipart(text_len=200, mode="single", threshold=250)
    assert not should_force_row_multipart(text_len=300, mode="multi", threshold=250)


def test_calc_forced_parts_respects_limits():
    assert calc_forced_parts(text_len=500, base=250) == 2
    assert calc_forced_parts(text_len=1800, base=250) == 6
    assert calc_forced_parts(text_len=10, base=250) == 2


def test_total_parts_and_route_choice():
    assert total_parts([]) == 1
    assert total_parts([1, 2]) == 2
    assert should_use_3plus_route(2) is False
    assert should_use_3plus_route(3) is True
