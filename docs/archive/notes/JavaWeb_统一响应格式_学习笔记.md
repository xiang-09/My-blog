# Java Web 实验学习笔记：统一响应格式、泛型、Servlet、Jackson 与 Tomcat

> 适合初学者复盘  
> 环境建议：JDK 17 + Maven + Tomcat 10.1.x + Jakarta Servlet + Jackson

---

## 1. 本次实验要完成什么

本次实验的核心目标，是实现一个“统一响应格式”的 Java Web API，并在过程中理解这些知识点：

- Java 枚举 `enum`
- Java 泛型 `Result<T>`
- 泛型静态方法
- Servlet
- Maven
- Tomcat
- JSON 序列化 / 反序列化
- Jackson
- `Class<T>`
- `TypeReference<T>`
- Java 泛型擦除
- PECS 原则
- 单个用户查询
- 多个用户查询
- 常见 Maven / Servlet / Tomcat 报错排查

最终接口可以实现：

```text
查询单个：
http://localhost:8080/test1/user?ids=1

查询多个：
http://localhost:8080/test1/user?ids=1,2,3
```

---

## 2. 最终项目结构

```text
test1
├─ pom.xml
├─ src
│  ├─ main
│  │  ├─ java
│  │  │  └─ com
│  │  │     └─ example
│  │  │        ├─ ErrorCode.java
│  │  │        ├─ Result.java
│  │  │        ├─ User.java
│  │  │        ├─ JsonUtils.java
│  │  │        ├─ MainTest.java
│  │  │        └─ UserServlet.java
│  │  └─ webapp
│  │     └─ index.jsp
│  └─ test
│     └─ java
│        └─ com
│           └─ example
│              └─ AppTest.java
└─ target
```

因为 Java 文件全部放在：

```text
src/main/java/com/example/
```

所以每个 Java 文件第一行统一写：

```java
package com.example;
```

---

## 3. 环境对应关系

本次使用：

```text
Tomcat 10.1.59
```

Tomcat 10.1 使用 Jakarta Servlet，所以代码必须使用：

```java
jakarta.servlet.*
```

不能使用：

```java
javax.servlet.*
```

### Tomcat 与 Servlet 包对应关系

| Tomcat | Servlet 包 |
|---|---|
| Tomcat 9 | `javax.servlet.*` |
| Tomcat 10 / 10.1 | `jakarta.servlet.*` |

本项目统一：

```text
Tomcat 10.1.x
JDK 17
Jakarta Servlet 6
```

---

## 4. pom.xml 最终版本

```xml
<?xml version="1.0" encoding="UTF-8"?>

<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">

    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>test1</artifactId>
    <version>1.0-SNAPSHOT</version>

    <packaging>war</packaging>

    <name>test1</name>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
    </properties>

    <dependencies>

        <dependency>
            <groupId>jakarta.servlet</groupId>
            <artifactId>jakarta.servlet-api</artifactId>
            <version>6.0.0</version>
            <scope>provided</scope>
        </dependency>

        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.17.2</version>
        </dependency>

        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>

    </dependencies>

    <build>

        <finalName>test1</finalName>

        <plugins>

            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>

                <configuration>
                    <source>17</source>
                    <target>17</target>
                    <encoding>UTF-8</encoding>
                </configuration>
            </plugin>

            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-war-plugin</artifactId>
                <version>3.4.0</version>

                <configuration>
                    <failOnMissingWebXml>false</failOnMissingWebXml>
                </configuration>
            </plugin>

        </plugins>

    </build>

</project>
```

---

## 5. 为什么一开始会报 Java 7 错误

原始 Maven 项目里有：

```xml
<maven.compiler.source>1.7</maven.compiler.source>
<maven.compiler.target>1.7</maven.compiler.target>
```

运行：

```bash
mvn clean compile
```

报错：

```text
不再支持源选项 7。请使用 8 或更高版本。
不再支持目标选项 7。请使用 8 或更高版本。
```

解决：

```xml
<maven.compiler.source>17</maven.compiler.source>
<maven.compiler.target>17</maven.compiler.target>
```

并升级 Maven Compiler Plugin：

```xml
<version>3.11.0</version>
```

---

## 6. ErrorCode 枚举

文件：

```text
ErrorCode.java
```

代码：

```java
package com.example;

public enum ErrorCode {

    SUCCESS(200, "操作成功"),
    USER_NOT_FOUND(404, "用户不存在"),
    PARAM_ERROR(400, "参数错误"),
    SYSTEM_ERROR(500, "系统异常");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }
}
```

### 作用

统一保存：

```text
状态码 + 提示信息
```

例如：

```text
200 操作成功
404 用户不存在
400 参数错误
500 系统异常
```

### 常见错误：构造器报红

如果写了：

```java
SUCCESS(200, "操作成功")
```

却没有：

```java
ErrorCode(int code, String message)
```

就会报构造器参数不匹配。

### 大小写必须一致

这三个要完全一致：

```text
文件名：ErrorCode.java
枚举名：public enum ErrorCode
构造器：ErrorCode(int code, String message)
```

Java 区分大小写。

---

## 7. Result<T>：统一响应格式

```java
package com.example;

public class Result<T> {

    private int code;
    private String message;
    private T data;
    private long timestamp;

    public Result() {
    }

    public Result(int code, String message, T data, long timestamp) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.timestamp = timestamp;
    }

    public static <T> Result<T> success(T data) {
        return new Result<>(
                ErrorCode.SUCCESS.getCode(),
                ErrorCode.SUCCESS.getMessage(),
                data,
                System.currentTimeMillis()
        );
    }

    public static <T> Result<T> fail(ErrorCode errorCode) {
        return new Result<>(
                errorCode.getCode(),
                errorCode.getMessage(),
                null,
                System.currentTimeMillis()
        );
    }

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}
```

### 怎么理解泛型

```java
Result<User>
```

表示：

```text
data 是 User
```

```java
Result<String>
```

表示：

```text
data 是 String
```

```java
Result<List<User>>
```

表示：

```text
data 是 List<User>
```

核心作用：

```text
同一套 Result 响应结构，可以包装不同类型的数据。
```

---

## 8. 泛型静态方法

```java
public static <T> Result<T> success(T data)
```

`<T>` 表示这是一个泛型静态方法。

例如：

```java
User user = new User(1, "张三", 18);

Result<User> result = Result.success(user);
```

Java 会自动推断：

```text
T = User
```

失败响应：

```java
Result<User> result =
        Result.fail(ErrorCode.USER_NOT_FOUND);
```

---

## 9. User 实体类

```java
package com.example;

public class User {

    private Integer id;
    private String name;
    private Integer age;

    public User() {
    }

    public User(Integer id, String name, Integer age) {
        this.id = id;
        this.name = name;
        this.age = age;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getAge() {
        return age;
    }

    public void setAge(Integer age) {
        this.age = age;
    }

    @Override
    public String toString() {
        return "User{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", age=" + age +
                '}';
    }
}
```

---

## 10. Jackson 与 JsonUtils

Jackson 负责：

```text
Java 对象 ↔ JSON
```

### JsonUtils.java

```java
package com.example;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;

public class JsonUtils {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static String toJson(Object object) {
        try {
            return objectMapper.writeValueAsString(object);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("JSON序列化失败", e);
        }
    }

    public static <T> Result<T> parseResponse(
            String json,
            Class<T> clazz) {

        try {

            JavaType javaType =
                    objectMapper
                            .getTypeFactory()
                            .constructParametricType(
                                    Result.class,
                                    clazz
                            );

            return objectMapper.readValue(json, javaType);

        } catch (JsonProcessingException e) {
            throw new RuntimeException(
                    "JSON反序列化失败",
                    e
            );
        }
    }

    public static <T> T parseResponse(
            String json,
            TypeReference<T> typeReference) {

        try {

            return objectMapper.readValue(
                    json,
                    typeReference
            );

        } catch (JsonProcessingException e) {
            throw new RuntimeException(
                    "JSON反序列化失败",
                    e
            );
        }
    }
}
```

---

## 11. 序列化

Java 对象转 JSON：

```java
String json = JsonUtils.toJson(result);
```

例如：

```java
Result<User> result = Result.success(user);
```

会转成类似：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "name": "张三",
    "age": 18
  },
  "timestamp": 123456789
}
```

---

## 12. 反序列化与 Class<T>

JSON 转 Java：

```java
Result<User> result =
        JsonUtils.parseResponse(
                json,
                User.class
        );
```

`User.class` 告诉 Jackson：

```text
Result 中的 data 是 User
```

### 为什么需要 Class<T>

因为 Java 泛型存在类型擦除，运行时不能简单通过 `T` 知道具体类型。

所以：

```java
parseResponse(String json, Class<T> clazz)
```

通过 `Class<T>` 显式传入实际类型。

---

## 13. 为什么不能 new T()

错误写法：

```java
public T create() {
    return new T();
}
```

Java 不允许：

```java
new T()
```

原因：

```text
泛型存在类型擦除。
```

如果确实需要动态创建对象，可以传：

```java
Class<T> clazz
```

再通过反射创建。

---

## 14. Result<List<User>> 与 TypeReference

普通：

```java
Result<User>
```

可以使用：

```java
User.class
```

但：

```java
Result<List<User>>
```

不能写：

```java
List<User>.class
```

因此复杂泛型要使用：

```java
TypeReference<T>
```

示例：

```java
Result<List<User>> result =
        JsonUtils.parseResponse(
                json,
                new TypeReference<Result<List<User>>>() {}
        );
```

### 对比

| 场景 | 推荐 |
|---|---|
| `Result<User>` | `Class<T>` |
| `Result<String>` | `Class<T>` |
| `Result<Integer>` | `Class<T>` |
| `Result<List<User>>` | `TypeReference<T>` |
| 多层嵌套泛型 | `TypeReference<T>` |

记忆：

```text
简单泛型 → Class<T>
复杂嵌套泛型 → TypeReference<T>
```

---

## 15. Servlet 是什么

Servlet 可以理解为：

```text
专门处理浏览器 HTTP 请求的 Java 类。
```

例如浏览器访问：

```text
http://localhost:8080/test1/user?ids=1
```

Tomcat 会根据：

```java
@WebServlet("/user")
```

找到对应的 Servlet。

---

## 16. UserServlet：同时支持单个和多个查询

```java
package com.example;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@WebServlet("/user")
public class UserServlet extends HttpServlet {

    private final List<User> userList = new ArrayList<>();

    @Override
    public void init() throws ServletException {

        userList.add(new User(1, "张三", 18));
        userList.add(new User(2, "李四", 20));
        userList.add(new User(3, "王五", 22));
        userList.add(new User(4, "赵六", 19));
        userList.add(new User(5, "孙七", 21));
    }

    @Override
    protected void doGet(
            HttpServletRequest request,
            HttpServletResponse response)
            throws ServletException, IOException {

        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json;charset=UTF-8");

        String idsStr = request.getParameter("ids");

        if (idsStr == null || idsStr.trim().isEmpty()) {

            Result<List<User>> result =
                    Result.fail(ErrorCode.PARAM_ERROR);

            response.getWriter().write(
                    JsonUtils.toJson(result)
            );

            return;
        }

        List<User> resultUsers = new ArrayList<>();

        try {

            String[] idArray = idsStr.split(",");

            for (String idText : idArray) {

                int id = Integer.parseInt(idText.trim());

                for (User user : userList) {

                    if (user.getId().equals(id)) {

                        resultUsers.add(user);
                        break;
                    }
                }
            }

        } catch (NumberFormatException e) {

            Result<List<User>> result =
                    Result.fail(ErrorCode.PARAM_ERROR);

            response.getWriter().write(
                    JsonUtils.toJson(result)
            );

            return;
        }

        if (resultUsers.isEmpty()) {

            Result<List<User>> result =
                    Result.fail(ErrorCode.USER_NOT_FOUND);

            response.getWriter().write(
                    JsonUtils.toJson(result)
            );

            return;
        }

        Result<List<User>> result =
                Result.success(resultUsers);

        response.getWriter().write(
                JsonUtils.toJson(result)
        );
    }

    public void processList(
            List<? extends User> users) {

        for (User user : users) {
            System.out.println("用户信息：" + user);
        }
    }
}
```

---

## 17. 单个查询

访问：

```text
http://localhost:8080/test1/user?ids=1
```

返回类似：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "name": "张三",
      "age": 18
    }
  ],
  "timestamp": 123456789
}
```

注意：

虽然查的是单个用户，但因为接口统一返回：

```java
Result<List<User>>
```

所以 `data` 仍然是数组。

---

## 18. 多个查询

访问：

```text
http://localhost:8080/test1/user?ids=1,2,3
```

返回类似：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "name": "张三",
      "age": 18
    },
    {
      "id": 2,
      "name": "李四",
      "age": 20
    },
    {
      "id": 3,
      "name": "王五",
      "age": 22
    }
  ],
  "timestamp": 123456789
}
```

---

## 19. 不存在与参数错误

不存在：

```text
http://localhost:8080/test1/user?ids=100
```

返回：

```json
{
  "code": 404,
  "message": "用户不存在",
  "data": null,
  "timestamp": 123456789
}
```

不传参数：

```text
http://localhost:8080/test1/user
```

或者：

```text
http://localhost:8080/test1/user?ids=abc
```

返回：

```json
{
  "code": 400,
  "message": "参数错误",
  "data": null,
  "timestamp": 123456789
}
```

---

## 20. 如果要把单个和多个接口分开

更规范的设计可以是：

```text
/user?id=1
```

返回：

```java
Result<User>
```

多个：

```text
/users?ids=1,2,3
```

返回：

```java
Result<List<User>>
```

但本实验为了简单，可以一个接口同时支持：

```text
/user?ids=1
/user?ids=1,2,3
```

---

## 21. PECS 原则

PECS：

```text
Producer Extends
Consumer Super
```

中文可以理解为：

```text
生产者使用 extends
消费者使用 super
```

本实验：

```java
public void processList(
        List<? extends User> users)
```

这里：

```java
? extends User
```

表示：

```text
User 或 User 的子类
```

主要用于安全读取：

```java
for (User user : users) {
    System.out.println(user);
}
```

### 为什么不能随便 add()

不能安全写：

```java
users.add(new User());
```

因为编译器不知道真实类型到底是：

```java
List<User>
```

还是：

```java
List<Student>
```

所以：

```text
extends 更适合读取
```

记忆：

```text
我要从集合里拿数据 → extends
我要往集合里放数据 → super
```

---

## 22. MainTest：测试反序列化

```java
package com.example;

import com.fasterxml.jackson.core.type.TypeReference;

import java.util.List;

public class MainTest {

    public static void main(String[] args) {

        String json =
                """
                {
                    "code":200,
                    "message":"操作成功",
                    "data":{
                        "id":1,
                        "name":"张三",
                        "age":18
                    },
                    "timestamp":123456789
                }
                """;

        Result<User> result =
                JsonUtils.parseResponse(
                        json,
                        User.class
                );

        System.out.println(result.getCode());
        System.out.println(result.getMessage());
        System.out.println(result.getData());

        String listJson =
                """
                {
                  "code":200,
                  "message":"操作成功",
                  "data":[
                    {
                      "id":1,
                      "name":"张三",
                      "age":18
                    },
                    {
                      "id":2,
                      "name":"李四",
                      "age":20
                    }
                  ],
                  "timestamp":123456789
                }
                """;

        Result<List<User>> listResult =
                JsonUtils.parseResponse(
                        listJson,
                        new TypeReference<Result<List<User>>>() {}
                );

        for (User user : listResult.getData()) {
            System.out.println(user);
        }
    }
}
```

---

## 23. index.jsp

```jsp
<%@ page contentType="text/html;charset=UTF-8" %>

<html>

<head>
    <title>Java Web API 测试</title>
</head>

<body>

<h2>统一响应格式 Web API</h2>

<p><a href="user?ids=1">查询用户1</a></p>

<p><a href="user?ids=1,2">查询用户1和2</a></p>

<p><a href="user?ids=1,2,3">查询用户1、2、3</a></p>

<p><a href="user?ids=100">查询不存在用户</a></p>

</body>

</html>
```

---

## 24. Maven 常用命令

清理：

```bash
mvn clean
```

只编译：

```bash
mvn compile
```

清理并编译：

```bash
mvn clean compile
```

打包 WAR：

```bash
mvn clean package
```

成功时应看到：

```text
BUILD SUCCESS
```

生成：

```text
target/test1.war
```

---

## 25. Tomcat 部署流程

1. 停止 Tomcat：

```text
bin/shutdown.bat
```

2. 删除旧部署：

```text
webapps/test1
webapps/test1.war
```

3. 把：

```text
target/test1.war
```

复制到：

```text
Tomcat/webapps/
```

4. 启动：

```text
bin/startup.bat
```

---

## 26. 浏览器测试地址

首页：

```text
http://localhost:8080/test1/
```

单个：

```text
http://localhost:8080/test1/user?ids=1
```

多个：

```text
http://localhost:8080/test1/user?ids=1,2,3
```

不存在：

```text
http://localhost:8080/test1/user?ids=100
```

参数错误：

```text
http://localhost:8080/test1/user
```

---

## 27. 常见错误与排查

### 27.1 Java 7 编译错误

报错：

```text
不再支持源选项 7
不再支持目标选项 7
```

解决：

```xml
<maven.compiler.source>17</maven.compiler.source>
<maven.compiler.target>17</maven.compiler.target>
```

---

### 27.2 javax / jakarta 混用

Tomcat 10.1 必须：

```java
import jakarta.servlet...
```

不能：

```java
import javax.servlet...
```

---

### 27.3 404 `/test1/user`

曾出现：

```text
HTTP状态 404 - 未找到
请求的资源 [/test1/user] 不可用
Apache Tomcat/10.1.59
```

常见原因：

- Servlet 没正确加载
- Tomcat 10.1 却用了 `javax.servlet`
- WAR 还是旧版本
- `@WebServlet("/user")` 没生效

解决思路：

```text
检查 jakarta
→
重新 mvn clean package
→
删除旧 test1 文件夹和 war
→
重新部署
→
重启 Tomcat
```

---

### 27.4 package 不一致

例如文件在：

```text
src/main/java/com/example/JsonUtils.java
```

却写：

```java
package com.example.util;
```

可能报：

```text
找不到符号 Result
类重复 JsonUtils
文件不包含类 com.example.JsonUtils
```

如果文件都直接位于：

```text
com/example
```

则统一：

```java
package com.example;
```

---

### 27.5 ErrorCode 找不到

检查：

```text
文件名：ErrorCode.java
枚举名：ErrorCode
构造器：ErrorCode(...)
package：com.example
```

Windows 下单纯改大小写有时不明显，可以先：

```text
Errorcode.java → Temp.java → ErrorCode.java
```

---

## 28. 推荐排错顺序

不要一报错就部署 Tomcat。

按这个顺序：

```text
1. mvn clean compile
        ↓
2. BUILD SUCCESS
        ↓
3. mvn clean package
        ↓
4. 得到 target/test1.war
        ↓
5. 部署到 Tomcat
        ↓
6. 启动 Tomcat
        ↓
7. 浏览器测试
```

---

## 29. 统一响应格式的价值

如果每个接口格式都不同，前端很难统一处理。

统一为：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {},
  "timestamp": 123456789
}
```

前端只需要统一识别：

```text
code
message
data
timestamp
```

---

## 30. 整体流程图

```text
浏览器
   ↓
HTTP 请求
   ↓
Tomcat
   ↓
UserServlet
   ↓
读取 ids 参数
   ↓
模拟 List<User> 查询
   ↓
Result<List<User>>
   ↓
JsonUtils
   ↓
Jackson
   ↓
JSON
   ↓
浏览器
```

泛型关系：

```text
Result<T>
   │
   ├─ Result<User>
   │      ↓
   │   Class<User>
   │
   └─ Result<List<User>>
          ↓
      TypeReference
```

PECS：

```text
List<? extends User>
        ↓
主要读取
        ↓
Producer Extends
```

---

## 31. 实验答辩常见问题

### 为什么使用 Result<T>？

为了统一 API 响应结构，同时通过泛型让 `data` 支持不同类型。

### 为什么不能 new T()？

因为 Java 泛型存在类型擦除，运行时不知道 `T` 的具体类型。

### Class<T> 有什么用？

显式传递真实类型，例如：

```java
User.class
```

让 Jackson 正确反序列化。

### TypeReference 有什么用？

用于保留复杂泛型类型信息，例如：

```java
Result<List<User>>
```

### PECS 是什么？

```text
Producer Extends
Consumer Super
```

当前：

```java
List<? extends User>
```

主要作为生产者用于读取。

### 为什么 Tomcat 10 使用 jakarta？

因为 Jakarta EE 将原来的：

```text
javax.servlet
```

迁移到了：

```text
jakarta.servlet
```

Tomcat 10 开始使用 Jakarta 命名空间。

---

## 32. 最终复盘清单

- [ ] JDK 使用 17
- [ ] Maven 编译版本使用 17
- [ ] Tomcat 是 10.1.x
- [ ] Servlet 使用 `jakarta.servlet`
- [ ] pom 有 `jakarta.servlet-api`
- [ ] pom 有 Jackson
- [ ] packaging 是 `war`
- [ ] ErrorCode 文件名大小写正确
- [ ] 所有 Java 文件 package 与目录匹配
- [ ] `Result<T>` 能统一返回成功 / 失败
- [ ] `JsonUtils` 能转 JSON
- [ ] `Class<T>` 能解析 `Result<User>`
- [ ] `TypeReference<T>` 能解析 `Result<List<User>>`
- [ ] `processList(List<? extends User>)` 能体现 PECS
- [ ] `/user?ids=1` 能查询单个
- [ ] `/user?ids=1,2,3` 能查询多个
- [ ] `/user?ids=100` 返回用户不存在
- [ ] 不传 ids 返回参数错误
- [ ] `mvn clean package` 能 `BUILD SUCCESS`
- [ ] `target/test1.war` 能部署到 Tomcat

---

## 33. 最值得记住的 10 句话

1. Maven Web 项目要使用：

```xml
<packaging>war</packaging>
```

2. Tomcat 10.1 使用：

```java
jakarta.servlet
```

3. `Result<T>` 用于统一响应结构并支持不同数据类型。

4. 泛型静态方法：

```java
public static <T> Result<T> success(T data)
```

5. Java 泛型存在类型擦除，因此不能：

```java
new T()
```

6. 简单泛型反序列化使用：

```java
Class<T>
```

7. 复杂嵌套泛型使用：

```java
TypeReference<T>
```

8. PECS：

```text
Producer Extends
Consumer Super
```

9. 文件路径必须和 package 对应。

10. 排错顺序：

```text
mvn clean compile
→
mvn clean package
→
部署 WAR
→
启动 Tomcat
→
浏览器测试
```

---

## 34. 最终测试

```text
首页：
http://localhost:8080/test1/

单个：
http://localhost:8080/test1/user?ids=1

多个：
http://localhost:8080/test1/user?ids=1,2,3

不存在：
http://localhost:8080/test1/user?ids=100

参数错误：
http://localhost:8080/test1/user
```

完成以上测试后，本次实验核心知识点就基本掌握了。
