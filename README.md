# 买不买

一个适合微信熟人圈使用的轻量购买意见投票网页。发起人填写物品、价格、图片和纠结点，分享链接后，朋友无需注册即可选择“买 / 再想想 / 不买”并留下评语。

## 已实现

- 创建带随机链接的购买询问
- 上传 JPG、PNG、WebP 商品图片
- 好友匿名访问、投票、修改投票和填写评语
- 实时汇总三种意见
- 发起人通过私有管理链接删除不合适的评论
- 移动端和微信内浏览器适配
- 腾讯云 CloudBase 静态网站、云函数、文档数据库和云存储适配

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

腾讯云版的本地开发与部署说明见 [cloudbase/README.md](cloudbase/README.md)。在 CloudBase 环境配置完成后：

```bash
cp cloudbase/.env.example cloudbase/.env.local
npm run cloudbase:dev
```

## 部署说明

项目保留原 OpenAI Sites 版本，同时新增腾讯云 CloudBase 版本。面向中国大陆访客时，建议部署 CloudBase 版本。完整进度、职责分工和后续计划见 [腾讯云迁移计划.md](腾讯云迁移计划.md)。

请勿把腾讯云 SecretId、SecretKey、密码、短信验证码或真实 `.env` 文件提交到 Git。
