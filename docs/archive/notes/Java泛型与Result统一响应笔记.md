# Java 泛型与 Web API 统一响应设计笔记

> 整理日期：2026-09-21 10:30
> 主题：泛型的本质、泛型边界与类型擦除、Result 统一响应类、Web API 统一契约、AI 代码评审实战

---

## 一、泛型的本质

### 1. 类型参数化

**核心思想**：把容器里写死的元素类型，抽象成"使用时才注入"的类型参数（如 `T`、`E`、`K`、`V`）。一份类代码适配无数种类型，且每一种组合都要通过**编译期检查**。

```java
// 没有泛型之前：要么写死类型，要么退回 Object + 强转
public class IntList {
    private int[] arr;              // 写死 int，换类型就得重写一个类
}

public class ObjectList {
    private Object[] arr;           // 用 Object 凑合，取出必须强转，运行时才可能报错
    public Object get(int i) { return arr[i]; }  // 调用方强转 (String) list.get(0)
}

// 引入泛型之后：一份代码，无限类型
public class MyList<E> {            // E 是类型参数，使用时注入
    private Object[] elements;
    public void add(E e) { ... }
    public E get(int index) { return (E) elements[index]; }
}

List<String> names = new ArrayList<>();   // 注入 String
List<Integer> nums = new ArrayList<>();   // 注入 Integer
```

**为什么必须配合编译期检查**：

- 类型错误在**编译期**暴露，而不是运行期抛 `ClassCastException`；
- 编译期检查是"类型安全"的根基：写错类型直接编译失败，根本进不了运行期；
- 每一种泛型组合（`List<String>`、`List<Integer>`…）都会被编译器单独校验。

**常见误区（裸类型 raw type）**：

```java
List<Object> lst = new ArrayList();   // 右侧是裸类型，等于放弃了类型检查
```

> 裸类型（raw type）：不使用类型参数直接使用泛型类，如 `new ArrayList()`。编译器会给出 unchecked 警告，运行时完全丧失类型约束，应避免在生产代码中使用。

### 2. 泛型带来的三大好处

| 好处 | 说明 |
| --- | --- |
| 类型安全 | 错误在编译期被发现，杜绝运行期 `ClassCastException` |
| 消除强转 | 取出元素直接是目标类型，代码更干净 |
| 代码复用 | 一套类/方法适配任意类型，避免重复代码 |

### 3. 泛型的使用位置

- **泛型类**：`class Box<T> { }`
- **泛型接口**：`interface List<E> { }`
- **泛型方法**：`public <T> T parse(String s, Class<T> clazz) { }` —— 注意 `<T>` 写在返回值前面
- **泛型通配符**：`? extends` / `? super` / 无界 `?`（见第二章）

**注意**：泛型类型参数不能是基本类型，必须用包装类（`int` → `Integer`）。

---

## 二、泛型边界与类型擦除

### 1. 类型擦除（Type Erasure）

**Java 泛型是"编译期概念"**：编译完成后，泛型信息会被擦除，运行时 JVM 根本不知道 `List<String>` 和 `List<Integer>` 的区别。

```java
List<String> a = new ArrayList<>();
List<Integer> b = new ArrayList<>();
System.out.println(a.getClass() == b.getClass());   // true，运行时都是 ArrayList
```

**擦除规则**：

- 无界类型参数 `T` → 擦除为 `Object`；
- 有界类型参数 `<T extends Number>` → 擦除为边界 `Number`；
- 泛型类型 `List<String>` → 擦除为 `List`。

```java
// 编译期
public E get(int index) { return (E) elements[index]; }
// 擦除后（E 无界 → Object）
public Object get(int index) { return (Object) elements[index]; }
```

**擦除带来的后果（运行时"抓不住"）**：

```java
if (obj instanceof T) { }          // ❌ 编译错误：无法对类型参数做 instanceof
T t = new T();                      // ❌ 编译错误：无法直接 new 泛型类型
T[] arr = new T[10];                // ❌ 编译错误：无法创建泛型数组
List<String>[] arr = new List<String>[10];  // ❌ 编译错误：禁止泛型数组
```

### 2. 泛型边界（Bounds）

用边界给类型参数加上范围约束：

```java
// 上界：T 必须是 Number 及其子类
public class NumBox<T extends Number> { }

// 通配符上界：只读，元素可能是 Number 的任意子类
public static double sum(List<? extends Number> list) { ... }

// 通配符下界：只写，元素可能是 Integer 及其父类
public static void fill(List<? super Integer> list) { list.add(1); }
```

| 写法 | 含义 | 典型场景 |
| --- | --- | --- |
| `<T extends X>` | T 是 X 或 X 的子类（上界） | 约束类型参数，调用 X 的方法 |
| `<? extends X>` | 集合元素是 X 的子类（上界通配符） | 读数据（生产者） |
| `<? super X>` | 集合元素是 X 的父类（下界通配符） | 写数据（消费者） |
| `<?>` | 无界通配符，任意类型 | 只读不关心具体类型 |

### 3. PECS 原则（Producer Extends, Consumer Super）

> **Producer Extends, Consumer Super**：如果你要从集合中**读取**数据（它是生产者），用 `extends`；如果你要向集合中**写入**数据（它是消费者），用 `super`。

```java
// 生产者场景：从集合中取数 → extends（可以安全读）
public static double sum(List<? extends Number> nums) {
    double total = 0;
    for (Number n : nums) total += n.doubleValue();   // ✅ 读：一定能当作 Number 处理
    // nums.add(1);   // ❌ 编译错误：不知道具体是哪个子类，不能写
    return total;
}

// 消费者场景：向集合中放数 → super（可以安全写）
public static void addIntegers(List<? super Integer> list) {
    list.add(42);                 // ✅ 写：Integer 一定能放入任意父类型集合
    // Integer x = list.get(0);   // ❌ 编译错误：读出来可能是 Object
}
```

**一句话记忆**：`extends` 读安全（生产者给我数据），`super` 写安全（消费者接收数据）。

### 4. 擦除反制策略（运行时抓不住泛型怎么办）

因为运行时拿不到泛型信息，遇到需要"运行时类型"的场景，要用以下策略**主动把类型信息带进去**：

| 策略 | 做法 | 典型场景 |
| --- | --- | --- |
| **类型令牌（Type Token）** | 额外传入 `Class<T>` 参数 | `parse(String json, Class<User> clazz)` |
| **构造器/工厂注入** | 通过构造器传入 `Class<T>` 并保存 | 泛型 DAO / Repository 拿到实体类型 |
| **Super Type Token** | 用匿名子类捕获泛型参数，如 Jackson 的 `TypeReference<T>` | 反序列化 `Result<List<User>>` |
| **注解 + 反射** | 从字段的泛型签名 `getGenericType()` 解析 | 泛型基类的实体映射（MyBatis-Plus 等框架内部做法） |

```java
// 策略一：类型令牌
public <T> T fromJson(String json, Class<T> clazz) {
    return mapper.readValue(json, clazz);
}

// 策略三：Super Type Token —— 解决"泛型套泛型"无法用 Class 表达的问题
List<User> users = mapper.readValue(json, new TypeReference<List<User>>() {});
// 注意：new TypeReference<...>(){} 末尾的 {} 是关键，匿名子类才能捕获泛型类型

// 策略四：反射读泛型签名
Type genericType = clazz.getGenericSuperclass();          // 拿到父类
ParameterizedType pt = (ParameterizedType) genericType;   // 解析泛型参数
Class<?> entityClass = (Class<?>) pt.getActualTypeArguments()[0];
```

**为什么 TypeReference 有效**：`new TypeReference<List<User>>() {}` 生成一个匿名内部类，它的父类签名 `List<User>` 保留在字节码里，反射可以拿到——这是少数能在运行时"抓住"泛型的方式。

---

## 三、Result 统一响应类的设计与实现

### 1. 为什么需要统一响应类

没有统一结构时，每个接口返回格式都不一样（有的返回裸数据、有的带字段），前端无法统一处理错误、无法统一拦截。统一响应类让**所有接口返回同一套结构**。

### 2. 基础设计

```java
public class Result<T> {
    private Integer code;     // 业务状态码（与 HTTP 状态码解耦）
    private String message;   // 提示信息
    private T data;           // 业务数据，泛型承载
    private long timestamp;   // 时间戳（可选，便于排查问题）

    public Result() { }

    public Result(Integer code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.timestamp = System.currentTimeMillis();
    }

    // 静态工厂方法：使用方无需 new，语义清晰
    public static <T> Result<T> success() {
        return new Result<>(200, "操作成功", null);
    }

    public static <T> Result<T> success(T data) {
        return new Result<>(200, "操作成功", data);
    }

    public static <T> Result<T> error(Integer code, String message) {
        return new Result<>(code, message, null);
    }

    public static <T> Result<T> error(ErrorCode errorCode) {
        return new Result<>(errorCode.getCode(), errorCode.getMessage(), null);
    }

    // getter / setter 省略
}
```

### 3. 错误码枚举（推荐）

硬编码数字魔法值容易重复、难维护，用枚举统一管理：

```java
public enum ErrorCode {
    SUCCESS(200, "成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未登录或登录已过期"),
    FORBIDDEN(403, "无权限访问"),
    NOT_FOUND(404, "资源不存在"),
    SYSTEM_ERROR(500, "系统繁忙，请稍后重试"),
    BUSINESS_ERROR(10001, "业务校验失败");

    private final Integer code;
    private final String message;

    ErrorCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
    // getter 省略
}
```

### 4. 泛型与 JSON 序列化的坑

`Result<T>` 的 `data` 字段在运行时是 `Object`，**反序列化时类型信息会丢失**：

```java
// ❌ 问题：反序列化时 T 被擦除，data 拿到的是 LinkedHashMap 而不是 User
Result<User> r = mapper.readValue(json, Result.class);

// ✅ 正确：用 TypeReference 保留泛型信息
Result<User> r = mapper.readValue(json, new TypeReference<Result<User>>() {});
```

> 这也是第二章"擦除反制策略"的实战落地：凡是 `Result<List<X>>`、`Result<PageResult<X>>` 这类泛型嵌套，反序列化都必须用 `TypeReference`。

---

## 四、Web API 的统一契约

### 1. 统一契约包含什么

| 契约项 | 约定 |
| --- | --- |
| 统一响应体 | 所有接口都返回 `Result<T>`，禁止裸返回数据 |
| 状态码体系 | 业务码（如 200/400/500）与 HTTP 状态码分离，HTTP 一律 200，业务码表达业务结果（也可选择语义化 HTTP 码，团队内统一即可） |
| 全局异常处理 | 异常不散落在 Controller，统一由 `@RestControllerAdvice` 兜底 |
| 参数校验 | JSR-303（`@Valid` + `@NotNull` 等）+ 全局处理校验异常 |
| 分页结构 | 统一 `PageResult<T>`，返回 total + records |
| 日志与链路 | 通过 `traceId` 串联请求，便于排查 |

### 2. 全局异常处理（@RestControllerAdvice）

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 业务异常：统一转成错误码
    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusiness(BusinessException e) {
        return Result.error(e.getCode(), e.getMessage());
    }

    // 参数校验异常：把每个字段的错误拼出来
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValid(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return Result.error(ErrorCode.BAD_REQUEST.getCode(), msg);
    }

    // 兜底异常：对外不给堆栈，记录日志
    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception e) {
        log.error("系统异常", e);
        return Result.error(ErrorCode.SYSTEM_ERROR);
    }
}
```

### 3. 分页统一结构

```java
public class PageResult<T> {
    private Long total;        // 总条数
    private List<T> records;   // 当前页数据
    // 构造器、getter/setter 省略
}
```

### 4. 使用示例

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/{id}")
    public Result<User> get(@PathVariable Long id) {
        return Result.success(userService.getById(id));
    }

    @GetMapping
    public Result<PageResult<User>> page(@Valid PageQuery query) {
        return Result.success(userService.page(query));
    }

    @PostMapping
    public Result<Void> create(@Valid @RequestBody UserCreateRequest req) {
        userService.create(req);
        return Result.success();
    }
}
```

---

## 五、AI 代码评审实战

> 用一个"前后对比"的评审思路，按五个维度逐条检查代码。

### 评审维度一：类型安全

| 检查点 | 反例（要揪出来） | 正例（要推荐） |
| --- | --- | --- |
| 裸类型 | `List list = new ArrayList();` | `List<String> list = new ArrayList<>();` |
| unchecked 警告 | `(List<User>) obj` 强转 | 用 `TypeReference` / 类型令牌 |
| 泛型滥用 | `Map<String, Object>` 万能容器传参 | 定义明确的 DTO / 类型参数 |
| 边界缺失 | `<T> T find(Class clazz)` | `<T> T find(Class<T> clazz)` |

```java
// 反例：类型安全全无
public Object get(String key) { return map.get(key); }   // 调用方到处强转

// 正例：泛型 + 类型令牌
public <T> T get(String key, Class<T> clazz) {
    Object v = map.get(key);
    return clazz.cast(v);   // 编译期和运行期双重保障
}
```

### 评审维度二：空值安全

| 检查点 | 建议 |
| --- | --- |
| 返回值 | 集合为空返回空集合（`Collections.emptyList()`），不返回 null |
| 参数 | 入口处校验 `@NotNull` / 断言 |
| 可选值 | 合理使用 `Optional`，不要作为字段类型 |
| Result.data | 成功但无数据时返回 `success(null)` 要谨慎，明确语义 |

```java
// 反例
public List<User> list() {
    return query == null ? null : query();   // 调用方 if(list != null) 到处防

// 正例
public List<User> list() {
    return query() == null ? Collections.emptyList() : query();
}
```

### 评审维度三：可读性

- 命名：`Result.success(data)` 优于 `new Result<>(200, data)`；错误码用枚举不用魔法数字；
- 结构：Controller 只做参数接收与转发，业务在 Service，不写大而全的上帝方法；
- 注释：业务规则、边界条件写注释，啰嗦的流水账注释删掉；
- 方法单一职责：一个方法只做一件事，超过 30 行的核心逻辑考虑拆分。

### 评审维度四：可扩展性

- **开闭原则**：新增错误码只加枚举项，不改业务代码；
- **策略化**：多分支 if-else 用策略模式/枚举行为代替；
- **泛型抽象**：通用能力（分页、导出、统一返回）抽象成泛型组件，业务侧只关心自己的类型；
- **契约先行**：接口签名稳定，变更走版本，不悄悄改字段含义。

### 评审维度五：安全性

| 风险点 | 评审要点 |
| --- | --- |
| 注入 | SQL 注入（用参数化查询）、命令注入、模板注入 |
| 越权 | 查询/修改前校验资源归属（水平越权）与角色权限（垂直越权） |
| 信息泄露 | 异常堆栈不外抛；`Result.message` 不返回内部细节 |
| 数据校验 | 入参校验长度、格式、范围，防止脏数据与超限请求 |
| 敏感字段 | 密码、手机号等脱敏，日志不打印敏感信息 |
| 依赖安全 | 依赖版本漏洞扫描，升级高危组件 |

```java
// 反例：直接把异常堆栈抛给前端
catch (Exception e) {
    return Result.error(500, e.getMessage());   // ❌ 泄露内部细节
}

// 正例：外部只见统一文案，内部记录完整堆栈
catch (Exception e) {
    log.error("xxx 操作失败，参数：{}", req, e);
    return Result.error(ErrorCode.SYSTEM_ERROR);
}
```

### AI 评审小工具：评审清单（Checklist）

```markdown
□ 有没有裸类型 / unchecked 强转？
□ 泛型参数是否缺少边界或类型令牌？
□ 反序列化泛型嵌套是否用了 TypeReference？
□ 返回值可能为 null 的地方是否明确语义 / 返回空集合？
□ 错误码是枚举还是魔法数字？
□ 异常是否统一由全局处理器兜底，且不外泄堆栈？
□ 接口是否都返回统一契约 Result？
□ 参数是否都做了校验？
□ 有没有越权 / 注入 / 敏感信息泄露隐患？
□ 新增需求是否要改动现有代码（违反开闭原则）？
```

---

## 总结：一条主线串起来

1. **泛型的本质** = 类型参数化，编译期检查保证类型安全；
2. **擦除** = 泛型信息运行时消失，所以需要"反制策略"（类型令牌 / TypeReference / 反射）把类型带进运行时；
3. **Result\<T\>** = 泛型在业务层的典型应用：一份类适配所有接口；
4. **统一契约** = 在 Result 之上约定全局异常、错误码、分页、校验，让整个 Web 层行为一致；
5. **AI 评审** = 用类型安全、空值安全、可读性、可扩展性、安全性五个维度，把前四章的知识落地成可执行的检查标准。
