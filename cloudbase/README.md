# 腾讯云 CloudBase 版本

这个目录包含「买不买」的腾讯云适配版本。它复用现有界面，但将运行方式改为：

- Vite 静态网页；
- CloudBase 普通云函数；
- CloudBase 文档型数据库；
- CloudBase 云存储；
- CloudBase 匿名认证（用户无感，不出现登录页面）。

当前 OpenAI Sites 版本仍保留，可继续运行和回退。

## 目录说明

```text
cloudbase/
├── .env.example                 # 前端腾讯云配置模板
├── index.html                   # 静态网页入口
├── src/                         # 静态网页启动代码
├── functions/buy-or-not-api/    # 投票后端云函数
├── security/                    # 数据库、存储和函数权限规则
└── dist/                        # 执行构建后生成，不提交 Git
```

项目根目录的 `cloudbaserc.json` 是 CloudBase CLI 部署配置。

## 本地构建

在项目根目录执行：

```bash
cp cloudbase/.env.example cloudbase/.env.local
npm run cloudbase:build
```

首次构建前，需把 `cloudbase/.env.local` 中的占位值替换为真实的 CloudBase 环境 ID 和 Publishable Key。该 Key 是面向网页公开使用的发布密钥，不应填写腾讯云 SecretId、SecretKey、密码或短信验证码。

本地预览命令：

```bash
npm run cloudbase:dev
```

## 需要创建的云资源

### 文档型数据库

创建两个集合，并将客户端权限设置为“仅管理员可读写”：

1. `polls`
2. `votes`

建议索引：

- `polls.slug`：升序、唯一；
- `votes.pollId + votes.updatedAt`：`pollId` 升序、`updatedAt` 降序。

数据库只由云函数访问，浏览器不能绕过后端直接读取或修改投票数据。参考规则位于 `security/database.rules.json`。

### 身份认证

在“登录授权 → 登录方式”中开启匿名登录。匿名登录只用于让 CloudBase 识别不同浏览器和执行安全规则，用户不会看到注册或登录页面。

然后创建 Web Publishable Key，填写到 `cloudbase/.env.local` 的 `VITE_TCB_ACCESS_KEY`。

### 云存储

开启云存储，并应用 `security/storage.rules.json`：

- `polls/` 下的商品图片允许公开读取；
- 只有经过匿名认证的上传者可以写入自己创建的文件；
- 单个文件最多 5 MB；
- 浏览器端只接受 JPG、PNG 和 WebP。

### 云函数

部署函数：

```bash
tcb fn deploy buy-or-not-api
```

应用 `security/functions.rules.json`，允许已建立匿名会话的访客调用 `buy-or-not-api`，拒绝直接调用其他函数。

### 静态网站

填写 `cloudbase/.env.local` 后重新构建，再上传构建目录：

```bash
npm run cloudbase:build
tcb hosting deploy cloudbase/dist
```

把最终访问域名加入 CloudBase 的 Web 安全域名列表。测试阶段可使用 CloudBase 默认域名；正式运营建议使用已经备案的自定义域名。

## 数据结构

### `polls`

```text
slug              随机询问地址
ownerKeyHash       发起人管理密钥的 SHA-256 哈希
title              物品标题
price              价格
description        购买纠结说明
question           发给朋友的问题
imageFileId         CloudBase 云存储文件 ID
deadline           截止时间（毫秒时间戳）
createdAt          创建时间（毫秒时间戳）
```

### `votes`

```text
pollId             对应询问的文档 ID
guestTokenHash     浏览器访客标识的 SHA-256 哈希
nickname           昵称
choice             yes / maybe / no
comment            可选评语
createdAt          首次投票时间
updatedAt          最近修改时间
```

每台浏览器针对同一个询问使用确定性的投票文档 ID，因此再次投票会更新原记录，而不是无限新增。

## 安全设计

- 数据库禁止浏览器直接读写；
- 发起人管理密钥只在创建时返回，数据库只保存哈希；
- 访客令牌只保存在浏览器，数据库只保存哈希；
- 文本长度、图片类型和图片大小在前后端均有限制；
- 删除评论必须同时提供询问地址和发起人管理密钥；
- 腾讯云密码、SecretId、SecretKey 和短信验证码不得写入项目。

这是面向熟人的轻量防护，不是强实名或高对抗投票系统。如未来公开传播，应增加服务端限频、验证码、举报和内容审核。

### 依赖审计说明

项目使用腾讯云当前官方 `@cloudbase/node-sdk` 3.18.3。其部分历史传递依赖仍会触发 npm 安全告警；本函数不会把访客提交的对象、URL 或请求配置直接传给这些依赖，只会传递经过白名单和长度检查的标量字段。正式部署前仍应再次核对腾讯云 SDK 更新。不要直接运行 `npm audit fix --force`，因为它可能把官方 SDK 降级到不兼容版本。

## 切换前验收

- 创建一个新询问并上传图片；
- 将不含 `key` 参数的链接发到另一台手机；
- 在微信内打开并投票；
- 同一手机修改投票，确认总票数不重复增加；
- 使用带 `key` 的主人链接删除一条评论；
- 检查数据库记录和云存储图片；
- 在移动网络和 Wi-Fi 下各测试一次。
