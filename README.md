# PriceLens · 全网价格监控与比价

覆盖 **4 类电商商品、电影票、机票** 的价格监控与比价看板，界面参考 PriceAI 的信息密度、
PriceGhost 的多策略价格提取、Crawlab 的任务监控思路，机票部分参考 JiPiao 的多平台采集。

## 功能

- **总览**：全网价格指数、监控 SKU、采集成功率、24 小时采集量与价格变动榜
- **搜索比价**：跨商品 / 影片 / 影院 / 航线检索，2–3 个商品按归一化指数对比 30 天走势
- **商品比价**：华为手环 11 / 伊利金典牛奶 / 联想电脑 / 苹果手机，多平台到手价对比 + 30 天走势
- **电影票**：5 城 × 4 部影片，影院均价排行、场次价格热力图、场次明细
- **机票**：3 条航线未来 14 天低价日历、航司比价、最低价趋势与航班列表
- **监控大屏**：任务队列、成功率仪表、异常告警、价格异动，支持导出快照 JSON

深链：`#/search?q=关键词`、`#/products?p=商品id`、`#/movies?m=影片id&city=上海`、
`#/flights?r=航线id&d=2026-11-25`。

## 启动

```bash
npm install
npm run dev      # http://127.0.0.1:5173
```

`npm run dev` 前会自动执行 `scripts/gen-data.mjs`，生成 `public/data/*.json` 演示数据。
构建：`npm run build`，预览：`npm run preview`。

## 接入真实数据

前端只读 `public/data/*.json`，所以真实数据接入只需把来源归一化成同一份结构。
`scripts/ingest.mjs` 提供三种入口，均支持 `--dry-run` 预检：

```bash
# 1) CSV：先生成模板，把价格换成真实观测值
npm run ingest -- --template
npm run ingest -- --source csv --kind products --file data/real/products.csv

# 2) 授权 API（返回 { "quotes": [...] } 或完整 products.json）
#    令牌从环境变量读取，不写进代码
set PRICE_API_TOKEN=xxx
npm run ingest -- --source http --kind products --url https://api.example.com/prices --token-env PRICE_API_TOKEN

# 3) 采集端导出：把 crawler/data/latest.json 转成标准报价再接入
python -m crawler.export
npm run ingest -- --source json --kind products --file data/real/products.json

# 校验当前数据文件
npm run ingest -- --check
```

- 报价行字段：`product_id / name / category / spec / unit / image / platform / shop / price / original_price / coupon / sales / rating / in_stock / tags`
- 同一 `product_id + platform` 重复时会后者覆盖前者；`price`、`coupon` 非法或缺失的行会被跳过并打印原因
- 默认按商品合并：本次未出现的商品保留；`--replace` 只保留本次导入
- 每次导入把当日到手价追加到 `data/real/history.json`，逐步累积真实历史；首次接入可用 `--seed-mode scale` 把演示曲线按今日价等比缩放，避免断崖跳变（`none` 则不继承，仅记录本次观测）
- 导入成功后写入 `data/real/last-import.json`，之后 `npm run dev/build` 不再用演示数据覆盖；`npm run gen:demo` 可恢复演示数据
- 电影 / 机票使用 `--kind movies|flights` 导入完整 JSON（字段与 `public/data/*.json` 一致）

当前 `public/data/products.json` 为 2026-11-20 的公开渠道价格快照（京东 / 天猫 / 拼多多商品页与
什么值得买、慢慢买、ZOL、逛丢等比价信息），不是平台接口实时返回；促销价与库存随活动变化，
需要持续更新时按上面的 CSV 或 API 方式重新导入。

合规边界：京东、天猫、拼多多、猫眼、携程没有公开的价格查询接口，只能使用官方联盟 / 开放平台、
已授权的第三方数据服务，或你自己有权采集和整理的数据。本项目不包含绕过登录态、验证码或风控的逻辑。

## 定时更新（GitHub Actions）

[update-data.yml](.github/workflows/update-data.yml) 每天 09:00（北京时间）执行一次，也可以在
Actions 页面手动触发。

- 数据源优先级：`PRICE_API_URL` + `PRICE_API_TOKEN` > `PRICE_CSV_URL` > 仓库内 `data/real/products.csv`
- `PRICE_CSV_URL` 可以是任意可公开访问的 CSV（对象存储、Gitee raw、表格导出），列与模板一致
- 同一天重复运行不会产生提交；跨天会新增一个观测点，价格没变时走势为一条水平线
- 三个变量在仓库 `Settings → Secrets and variables → Actions` 中添加；不配置也能运行，只是每天重复导入同一组价格
- 首次使用需在 `Settings → Actions → General → Workflow permissions` 选择 **Read and write permissions**，否则无法回写数据
- `schedule` 只在默认分支生效，改完工作流记得合并到 `main`

## 采集端

```bash
python -m pip install -r crawler/requirements.txt
python -m crawler.collect --kind product --only jd --dry-run
python -m crawler.scheduler
```

- `crawler/strategies.py`：JSON-LD / 站点适配 / CSS 启发式 / AI 兜底四路提取
- `crawler/vote.py`：离群过滤 + 1% 容差聚类 + 置信度加权的价格投票，低票数自动标记复核
- `crawler/fetcher.py`：UA 轮换、限速抖动、指数退避重试，动态页面可切 Playwright
- `crawler/scheduler.py`：商品 2h、电影 1h、机票 4h 的分频率调度
- `crawler/export.py`：把 `data/latest.json` 导出为 `data/real/products.json`，供 `npm run ingest` 接入
- 结果写入 `data/snapshots.jsonl` 与 `data/latest.json`，可按需接入前端或数据库

`sites.py` 中的 URL 为结构示例，接入真实目标前请确认站点 robots.txt 与用户协议。

## 目录

```
price-radar/
├── public/data/          # 前端读取的快照数据（演示生成或真实导入）
├── scripts/gen-data.mjs  # 30 天价格 / 电影 / 机票演示数据生成
├── scripts/ingest.mjs    # 真实数据接入：CSV / 授权 API / 采集端导出
├── data/real/            # 导入模板、历史与来源标记
├── src/
│   ├── components/       # 图表封装、侧边栏、骨架屏
│   ├── pages/            # 总览 / 搜索 / 商品 / 电影 / 机票 / 监控
│   └── styles.css        # 设计系统
└── crawler/              # Python 采集端、调度器与导出
```

## 合规

演示数据均为本地生成，不含任何真实平台数据。采集端仅应访问公开页面，
遵守 robots 协议与平台条款，不携带登录态、不绕过验证码，并按平台限制自动降速。
