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

第三,对接 vue-page-store 更干净。axios 默认按 HTTP 状态分流 success/error 两条路径。约定"业务成功失败都走 200,只看 body 的 code",意味着 axios error 分支只处理真正的传输/契约异常(网络断、5xx、404 路由不存在),vue-page-store 的 error 中间件不再需要解构 response body 来判断是哪类错误。契约和前端状态机天然对齐。

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