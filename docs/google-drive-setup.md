# Google Drive 同步设置指南

## 第 1 步：创建 Google Cloud 项目

1. 打开 https://console.cloud.google.com/
2. 点击顶部项目下拉菜单，选择 **新建项目**
3. 项目名称：`Video Notes Extension`
4. 点击 **创建**

## 第 2 步：启用 Google Drive API

1. 左侧菜单 > **API 和服务** > **库**
2. 搜索 `Google Drive API`
3. 点击 **Google Drive API**，然后点击 **启用**

## 第 3 步：配置 OAuth 同意屏幕

1. 左侧菜单 > **API 和服务** > **OAuth 同意屏幕**
2. 选择 **外部** 用户类型，点击 **创建**
3. 填写信息：
   - 应用名称：`Video Notes`
   - 用户支持电子邮件：你的邮箱
   - 开发者联系电子邮件：你的邮箱
4. 点击 **保存并继续**
5. 进入 **Data Access** 页面，点击 **Add or Remove Scopes**
6. 搜索 `drive.appdata`，勾选后点击 **Update**
7. 勾选该范围，点击 **更新**
8. 点击 **保存并继续**
9. 进入 **Test users** 页面（Data Access 保存后的下一页），点击 **Add Users**，输入你的邮箱
10. 点击 **保存并继续**

## 第 4 步：获取扩展 ID

1. 在项目目录运行 `pnpm build`
2. 打开 Chrome，地址栏输入 `chrome://extensions`
3. 开启右上角 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择 `build/chrome-mv3-prod` 文件夹
5. 复制扩展 ID（扩展名称下方 32 位字符串）

## 第 5 步：创建 OAuth 客户端 ID

1. 左侧菜单 > **API 和服务** > **凭据**
2. 点击 **创建凭据** > **OAuth 客户端 ID**
3. 应用类型选择 **Chrome 扩展程序**
4. 填写：
   - 名称：`Video Notes`
   - 商品 ID：粘贴第 4 步获取的扩展 ID
5. 点击 **创建**
6. 复制生成的 **客户端 ID**（格式：`123456789-xxxxx.apps.googleusercontent.com`）

## 第 6 步：更新 package.json

将 `package.json` 中的占位符替换为真实的客户端 ID：

```json
"oauth2": {
  "client_id": "你的客户端ID.apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/drive.appdata"]
}
```

## 第 7 步：重新构建并加载

1. 运行 `pnpm build`
2. 打开 `chrome://extensions`，点击扩展的刷新按钮

## 第 8 步：发布（生产环境）

1. 回到 Google Cloud Console > **OAuth 同意屏幕**
2. 点击 **发布应用**，所有用户即可使用
3. 如果保留测试模式，只有第 3 步添加的测试用户可以登录

## 工作原理

- 扩展使用 `chrome.identity.getAuthToken()` 自动处理 OAuth 授权流程
- 数据存储在用户 Google Drive 的 `appDataFolder` 中（隐藏、私有）
- 每个用户的数据隔离存储在各自的 Google 账号中
- `drive.appdata` 范围：扩展无法访问用户 Drive 中的任何其他文件
- Chrome 自动管理 token 刷新，无需手动处理

## 常见问题

| 问题 | 解决方法 |
|------|----------|
| 点击同步提示"Auth failed" | 客户端 ID 或扩展 ID 不匹配 |
| 下载时提示"No backup found" | 需要先在另一台设备上传数据 |
| OAuth 弹窗不出现 | 检查 `chrome://extensions` 是否有错误 |
| 同意屏幕显示警告 | 应用处于测试模式，发布应用或添加测试用户 |
