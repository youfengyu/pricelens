"""监控目标配置与采集入口。

说明：这里的 URL 仅作演示结构，真实使用请替换为平台公开商品页，
并先确认目标站点的 robots.txt 与用户协议允许采集。
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Target:
    id: str
    kind: str  # product / movie / flight
    platform: str
    name: str
    url: str
    render: bool = False  # 是否需要浏览器渲染


PRODUCT_TARGETS: list[Target] = [
    Target("huawei-band-11", "product", "jd", "华为手环 11", "https://item.jd.com/100000000001.html"),
    Target("huawei-band-11", "product", "tmall", "华为手环 11", "https://detail.tmall.com/item.htm?id=0000000001"),
    Target("huawei-band-11", "product", "pdd", "华为手环 11", "https://mobile.yangkeduo.com/goods.html?goods_id=1"),
    Target("yili-jindian-milk", "product", "jd", "伊利金典牛奶", "https://item.jd.com/100000000002.html"),
    Target("yili-jindian-milk", "product", "tmall", "伊利金典牛奶", "https://detail.tmall.com/item.htm?id=0000000002"),
    Target("yili-jindian-milk", "product", "pdd", "伊利金典牛奶", "https://mobile.yangkeduo.com/goods.html?goods_id=2"),
    Target("lenovo-xiaoxin-pro14", "product", "jd", "联想小新 Pro 14", "https://item.jd.com/100000000003.html"),
    Target("lenovo-xiaoxin-pro14", "product", "tmall", "联想小新 Pro 14", "https://detail.tmall.com/item.htm?id=0000000003"),
    Target("lenovo-xiaoxin-pro14", "product", "suning", "联想小新 Pro 14", "https://product.suning.com/0000000003.html"),
    Target("apple-iphone-17", "product", "jd", "iPhone 17", "https://item.jd.com/100000000004.html"),
    Target("apple-iphone-17", "product", "tmall", "iPhone 17", "https://detail.tmall.com/item.htm?id=0000000004"),
    Target("apple-iphone-17", "product", "pdd", "iPhone 17", "https://mobile.yangkeduo.com/goods.html?goods_id=4"),
]

MOVIE_TARGETS: list[Target] = [
    Target("deep-sea-echo", "movie", "maoyan", "深海回声", "https://www.maoyan.com/films/0000001"),
    Target("deep-sea-echo", "movie", "taopiaopiao", "深海回声", "https://www.taopiaopiao.com/film/0000001"),
    Target("long-night", "movie", "maoyan", "长夜将明", "https://www.maoyan.com/films/0000002"),
    Target("mountain-city", "movie", "taopiaopiao", "山城旧事", "https://www.taopiaopiao.com/film/0000004"),
]

FLIGHT_TARGETS: list[Target] = [
    Target("pek-sha", "flight", "ctrip", "北京-上海", "https://flights.ctrip.com/online/list/oneway-pek-sha"),
    Target("sha-ctu", "flight", "ctrip", "上海-成都", "https://flights.ctrip.com/online/list/oneway-sha-ctu"),
    Target("pek-can", "flight", "fliggy", "北京-广州", "https://www.fliggy.com/airlines/"),
]

ALL_TARGETS: dict[str, list[Target]] = {
    "product": PRODUCT_TARGETS,
    "movie": MOVIE_TARGETS,
    "flight": FLIGHT_TARGETS,
}


def select_targets(kind: str, only: str | None = None) -> list[Target]:
    targets = ALL_TARGETS.get(kind, [])
    if only:
        targets = [t for t in targets if t.id == only or t.platform == only]
    return targets
