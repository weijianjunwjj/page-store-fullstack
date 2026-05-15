# API Contract

> 本文件是 page-store-fullstack 后端对外的统一契约,所有接口必须遵守。

## 统一响应结构

所有接口(成功 / 业务失败 / 系统错误)都返回同一个外壳:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | number | 是 | 业务码。`0` 表示成功,非 0 表示业务失败 |
| `data` | any | 是 | 成功时承载数据;失败时通常为 `null` |
| `message` | string | 是 | 给人看的描述。成功时为 `"ok"`,失败时为可读错误信息 |
| `traceId` | string | 否 | 请求追踪 ID,由服务端生成,用于日志关联 |

### 示例

**成功**

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "username": "user01"
  },
  "message": "ok",
  "traceId": "0193d6b2-7c5a-7000-a9f1-1f3c8b0c1234"
}
```

**业务失败**(HTTP 200,业务规则未通过)

```json
{
  "code": 10001,
  "data": null,
  "message": "用户名或密码错误",
  "traceId": "0193d6b2-7c5a-7000-a9f1-1f3c8b0c5678"
}
```

**系统错误**(HTTP 5xx,服务端异常)

```json
{
  "code": 50001,
  "data": null,
  "message": "服务器开小差了,请稍后重试",
  "traceId": "0193d6b2-7c5a-7000-a9f1-1f3c8b0c9abc"
}
```

### 为什么不用 HTTP 状态码代替业务码

HTTP 状态码描述的是**传输层和请求层语义**——请求格式对不对、路由存不存在、服务端是否正确接收并处理了请求。业务码描述的是**业务语义**——用户名密码是否匹配、配置是否冲突、状态流转是否合法。两者各管一摊,合并会出问题。

第一,粒度不匹配。HTTP 状态码总共几十个,业务场景上千。硬把"用户名密码错误""账号被禁用""token 过期""token 无效"全塞进 401,前端就只能靠 `message` 字符串匹配做分支——这是把结构化错误退化成字符串编程,无法本地化,无法重命名。

第二,职责混淆。一个 200 + `code: 10001` 的"业务失败"响应,从传输层看是成功的——服务端听懂了请求,执行了逻辑,只是业务规则没通过。把这种情况标成 4xx 会让前端拦截器误以为是网络/契约错误走错误分支,而它其实需要走业务分支(比如表单上显示红字、保留用户输入)。

第三,前端 axios 拦截器更简洁。
axios 默认按 HTTP 状态码分流 success/error 两条路径。如果业务失败也走 4xx,前端 catch 分支里就会混进两种错误:一种是网络/服务器异常(超时、断网、5xx),一种是业务规则未通过(密码错、配置冲突)。这两种的处理方式完全不同——前者全局 toast + 重试,后者表单红字 + 保留输入——混在一个分支里要靠 `err.response?.data?.code` 二次分流。
约定业务成功失败都走 200,axios catch 分支就只剩传输层异常,业务分流变成 `if (res.code === 0)`。前端用 vue-page-store、Pinia 还是手写 hook 都一样受益,不是哪个库特有的好处。

只有**当前请求在传输/请求层就出了问题**时,才用 4xx/5xx。具体分工见下一节。

## 错误码分层

### HTTP 状态码 vs 业务码 的分工

**一句话原则**:HTTP 状态码标传输/请求层语义,业务码标业务语义,两者各管一摊,不互相代偿。

| HTTP | 含义 | 触发场景 | body 里的 code |
|---|---|---|---|
| 200 | 服务端已正确处理请求 | 业务成功 **或** 业务失败 | `0` 成功,非 0 业务失败 |
| 400 | 请求格式错 | JSON 解析失败 / 缺 Content-Type / query 结构非法 | `COMMON_PARAM_001` |
| 401 | 未认证 | 无 token / token 过期 / token 无效 | `AUTH_TOKEN_001/002/003` |
| 403 | 已认证但无权 | 登录了,但访问了不属于自己的资源 | `AUTH_PERM_001` |
| 404 | 路由不存在 | controller 完全没匹配上 | `COMMON_NOT_FOUND_001` |
| 422 | 语义级校验失败 | DTO 字段类型/格式错(class-validator) | `COMMON_PARAM_001` |
| 500 | 服务端炸了 | 数据库挂、未捕获异常 | `COMMON_SYSTEM_001/002` |

**两个容易争论的点提前钉死**:

- **400 vs 422**:本项目约定,JSON 解析层错用 400,字段语义错用 422。Nest 的 `ValidationPipe` 默认抛 400,W3 写异常过滤器时手动改成 422。这是 RESTful 语义派的标准答案,面试问到守得住。
- **业务失败为什么是 200**:见上一节"为什么不用 HTTP 状态码代替业务码"。

### 业务码命名规则

**三段式**:`[模块]_[场景]_[序号]`

- 模块:大写,具体到子域。`AUTH` / `PAGE_CONFIG` / `EVENT` / `COMMON`
- 场景:大写动词或名词。`LOGIN` / `TOKEN` / `CREATE` / `QUERY` / `UPDATE` / `PARAM` / `SYSTEM`
- 序号:三位数,001 起,同场景内顺序累加,**不复用、不跳号**

**成功**:固定 `code: 0`,不进命名空间。

**反例**:

- ❌ `ERROR_001` —— 没模块,3 个月后没人知道是哪儿的
- ❌ `AUTH_001` —— 没场景,扩展时会撞
- ❌ `AuthLoginFailed` —— 驼峰可读但 grep 不友好,大写蛇形最佳

### 业务码清单(初版,留白)

> 只列 W4–W6 一定会用到的,不硬凑。写接口时再补。

**AUTH(W5)**

- `AUTH_LOGIN_001` 用户名或密码错误
- `AUTH_LOGIN_002` 账号被禁用
- `AUTH_TOKEN_001` token 缺失
- `AUTH_TOKEN_002` token 过期
- `AUTH_TOKEN_003` token 无效
- `AUTH_PERM_001` 无权访问该资源

**PAGE_CONFIG(W4)**

- `PAGE_CONFIG_CREATE_001` code 已存在
- `PAGE_CONFIG_QUERY_001` 配置不存在
- `PAGE_CONFIG_UPDATE_001` 非法状态流转

**EVENT(W6)**

- `EVENT_QUERY_001` 时间范围非法
- `EVENT_QUERY_002` type 不在枚举内

**COMMON**

- `COMMON_PARAM_001` 参数校验失败
- `COMMON_PARAM_002` 分页参数越界
- `COMMON_NOT_FOUND_001` 路由不存在
- `COMMON_SYSTEM_001` 数据库异常
- `COMMON_SYSTEM_002` 未知服务端错误


## 分页契约

所有列表类接口遵循同一套请求/响应规范,方便前端 vue-page-store 在 `search-table-page` 模板里统一处理。

### 请求参数(query)

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `page` | number | 否 | `1` | 页码,**从 1 开始**(不是 0) |
| `pageSize` | number | 否 | `10` | 每页条数,**上限 100**,超过返回 `COMMON_PARAM_002` |
| `keyword` | string | 否 | - | 模糊搜索关键字,具体匹配字段由各接口文档说明 |
| `sortBy` | string | 否 | `createdAt` | 排序字段,白名单由各接口文档约束 |
| `sortOrder` | `asc` \| `desc` | 否 | `desc` | 排序方向 |

**为什么 page 从 1 开始**:对人友好,前端 UI 上"第 1 页"就是 `page=1`,不用做 `+1/-1` 心智转换。0-based 是数据库视角,1-based 是产品视角,接口契约站产品这边。

### 响应结构

```json
{
  "code": 0,
  "data": {
    "list": [],
    "total": 42,
    "page": 1,
    "pageSize": 10,
    "hasMore": true
  },
  "message": "ok",
  "traceId": "..."
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `list` | array | 当前页数据,**永远是数组**,空也返回 `[]` 不返回 `null` |
| `total` | number | 满足查询条件的总数(不分页) |
| `page` | number | 当前页码(回显) |
| `pageSize` | number | 当前每页条数(回显) |
| `hasMore` | boolean | 是否还有下一页,等价于 `page * pageSize < total` |

**为什么要回显 page/pageSize**:前端可能在请求飞行途中改了筛选条件,响应回来时用回显值判断"这个响应还属于当前 UI 状态吗",避免老响应覆盖新状态。

**为什么要 hasMore**:前端不想每次都算 `total/pageSize` 和当前页比大小。服务端算好直接给,省一次心智负担。无限滚动场景尤其有用。

### 示例

**请求**

```bash
curl 'http://localhost:3000/api/page-configs?page=1&pageSize=10&keyword=dash&sortBy=createdAt&sortOrder=desc'
```

**响应**

```json
{
  "code": 0,
  "data": {
    "list": [
      { "id": 12, "code": "dashboard_main", "status": "active" },
      { "id": 8,  "code": "dashboard_ops",  "status": "archived" }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 10,
    "hasMore": false
  },
  "message": "ok",
  "traceId": "0193d6b2-7c5a-7000-a9f1-1f3c8b0c1234"
}
```

### 与 vue-page-store 的对接

这是本契约设计的关键判断点,也是面试讲稿里能讲故事的地方。

vue-page-store 在 `search-table-page` 模板里通过 `$startLoading('list')` / `$endLoading('list')` / `$setError('list', err)` 管理列表的三态(loading / success / error)。本契约和它的耦合点有三处:

1. **响应外壳的 `code` 直接驱动 `$endLoading` vs `$setError` 的分流**。`code === 0` 走 success 分支,`list` 注入 store;`code !== 0` 走 error 分支,`message` 进 toast。前端不需要 try/catch HTTP 状态,只需要 `if (res.code === 0)`,状态机收敛到一处。

2. **分页响应的 `list` 永远是数组**。vue-page-store 的列表 state 初始值是 `[]`,如果后端偶尔返回 `null`,前端就要在每次注入前判断,或者在 store 里加一层 sanitize——这是契约层应该解决的,不该泄漏到前端。

3. **`page/pageSize` 回显** 给 vue-page-store 提供了"响应自描述"能力。store 里只存"当前应展示的 page",响应回来时对一下回显的 `page` 和 store 当前 `page`,不一致就丢弃这次响应——这是处理"快速翻页时老响应后到"竞态问题的最干净方案,不需要 axios 层做请求取消。

简言之,**契约的几个看似多余的字段(`hasMore`、回显的 page/pageSize、强制数组的 list)都不是给后端用的,是给 page-store 的状态机用的**。这是"前端架构作品的服务端闭环"这句话的具体兑现。



# 后端边界

> 本文件定义 page-store-fullstack 后端的职责边界。**做什么、不做什么、与前端的契约耦合点在哪**。
> 所有功能增加前,先回到这份文档对照——超出边界的需求一律进 parking-lot。

---

## 做什么

page-store-fullstack 的后端是一个**单一服务端**,职责是为 vue-page-store 的三个前端页面(search-table-page / linked-analysis-page / ai-constrained-page)提供完整的服务端闭环。具体三件事:

**1. 数据供给**
为前端页面提供 CRUD 接口和聚合分析接口。包括 page-config 的列表/详情/创建/更新/归档,以及 event 的列表查询、按天 trend、按 type 分布、最近 7 天 top user 三类聚合。所有列表接口遵循 W1 定下的分页契约,所有响应遵循统一响应结构。

**2. 鉴权**
基于 JWT 的登录态管理,登录、登出、`/me`、AuthGuard 拦截。bcrypt 做密码哈希。不做角色、不做菜单、不做权限矩阵。鉴权的目标是「证明这个请求来自某个真实用户」,不是「这个用户能不能访问这个资源」。

**3. 配置驱动**
page-config 的 `configJson` 字段存前端页面的运行时配置(列定义、筛选项、布局),由前端在初始化时拉取并交给 vue-page-store 注入。后端只做存取和校验,**不解释 configJson 的内部结构**——这是前端架构的语义,后端保持透明传递。

---

## 不做什么

以下范畴**永久排除**,看到类似需求一律进 parking-lot 或直接拒绝:

| 不做 | 理由 |
|---|---|
| 数据分析引擎 / OLAP / BI | 三个聚合接口是为了演示「服务端能给前端喂分析数据」,不是做分析平台 |
| 权限中心 / RBAC / 菜单系统 | 鉴权只证明身份,不做授权矩阵。这是中后台模板的另一个项目的事 |
| 高并发优化 / 缓存层 / 读写分离 | 个人作品,SQLite 起步,演示用 |
| 消息队列 / 分布式事务 / 微服务拆分 | 单体服务,无横向扩展需求 |
| Docker / K8s / CI/CD / 自动化测试覆盖率 | 演示项目,部署用最简方式,测试只做关键路径手测 |
| 文件上传 / 富媒体 / WebSocket | 三个前端页面不需要 |
| 多租户 / SaaS 化 | 不在故事里 |

**判断准则**:一个需求出现时,问自己「这是为了让三个前端页面跑通,还是为了让后端看起来更完整?」后者一律不做。

---

## 与 vue-page-store 的契约耦合点

后端的存在意义是让 vue-page-store 在真实接口环境下站得住。四个具体耦合点,任何一个变动都要同步检查另一侧:

**1. loading 契约**
统一响应结构的 `code` 字段是 store 的 loading 状态终结裁判。`code === 0` 走 success,其他走 error。后端的责任是保证**任何情况下响应壳形状不变**,即便 list 为空、即便业务失败——前端 store 不写任何防御性 if。

**2. error 契约**
业务码(`AUTH_LOGIN_001` 这类三段式)落在响应壳的 `code` 字段。前端 store 拿到非 0 code 后,可以根据业务码做精细分支:跳登录、弹 toast、还是静默忽略,都由 code 决定,**不读 HTTP 状态码**。后端的责任是让业务码语义稳定,不随版本漂移。

**3. 分页契约**
`page` 从 1 开始,`hasMore` 由服务端算好,前端 store 不持有分页计算逻辑。「翻页」和「加载更多」共享同一段 store 代码,只在 list 合并策略上分叉。后端在 Prisma 层吞掉 `skip = (page - 1) * pageSize` 的换算成本。

**4. 配置加载**
page-config 的 `configJson` 是前端架构的语义载体,后端只做存取。前端在页面初始化时通过 `code` 字段(unique)拉到对应配置,注入 vue-page-store。**configJson 的 schema 演进只发生在前端**,后端不参与解释。

---

## 项目对外措辞

本项目**不自称 BFF**。

BFF(Backend for Frontend)在 Sam Newman 的原始定义里是「一个后端对应一个用户体验,紧密耦合于特定 UI,通常由同一个团队同时维护前后端」。按这个定义,本项目其实形态上贴近 BFF。

不自称 BFF 是出于两个考量:

1. BFF 这个词在工程语境里通常默认对应微服务架构下的聚合编排层,贴上去会触发不符的预期
2. 本项目的存在动机不是「解决多前端共享后端的臃肿问题」,而是验证 vue-page-store 在真实服务端环境下的契约是否站得住——它是**前端架构作品的服务端闭环**,这个表述更贴近实际意图