# GitHub Pages 部署指南

## 前置条件
- ✅ 已有 GitHub 账号
- ✅ 项目已初始化 Git（已完成）

## 部署步骤

### 步骤 1: 提交所有需要的文件到 Git

需要提交的文件：
- `futures_ranking.html` (主页面)
- `styles.css` (样式文件)
- `script.js` (JavaScript 文件)
- `ranking_data.csv` (数据文件)
- 所有 CSV 数据文件（`SHFE_*.csv`）

**执行命令：**
```bash
# 添加所有需要的文件
git add futures_ranking.html styles.css script.js ranking_data.csv
git add SHFE_*.csv

# 提交更改
git commit -m "准备部署到 GitHub Pages"

# 推送到远程仓库
git push origin master
```

### 步骤 2: 在 GitHub 上启用 Pages

1. 打开你的 GitHub 仓库页面
2. 点击 **Settings**（设置）
3. 在左侧菜单中找到 **Pages**（页面）
4. 在 **Source**（源）部分：
   - 选择 **Deploy from a branch**（从分支部署）
   - Branch（分支）选择 `master` 或 `main`
   - Folder（文件夹）选择 `/ (root)`（根目录）
5. 点击 **Save**（保存）

### 步骤 3: 访问你的网站

GitHub 会给你一个默认域名，格式为：
```
https://你的用户名.github.io/仓库名/
```

例如：`https://username.github.io/caiwenqiang-member-rank/`

**注意：** 如果仓库名是 `username.github.io`，则直接访问 `https://username.github.io`

### 步骤 4: 设置默认页面（可选）

如果希望直接访问域名就能看到页面，可以：
- 将 `futures_ranking.html` 重命名为 `index.html`，或者
- 在仓库根目录创建一个 `index.html` 重定向到 `futures_ranking.html`

### 步骤 5: 绑定自定义域名（可选）

如果你有自己的域名，可以：

1. **在 GitHub Pages 设置中：**
   - 在 **Custom domain**（自定义域名）输入框填入你的域名（如 `test.example.com`）
   - 勾选 **Enforce HTTPS**（强制 HTTPS）

2. **在你的域名 DNS 管理界面：**
   - 添加一条 **CNAME 记录**：
     - 名称：`test`（或 `@` 表示根域名）
     - 值：`你的用户名.github.io`
   - 或者添加 **A 记录**（如果使用根域名）：
     - 指向 GitHub Pages 的 IP 地址（可在 GitHub Pages 设置中查看）

3. **等待 DNS 生效：**
   - 通常需要几分钟到几小时
   - 生效后访问 `https://你的域名` 即可

## 注意事项

1. **文件路径：** 确保所有相对路径的文件（CSS、JS、CSV）都在仓库根目录
2. **HTTPS：** GitHub Pages 自动提供 HTTPS 证书
3. **更新内容：** 每次修改后，提交并推送即可自动更新网站
4. **文件大小：** 注意 CSV 文件较大，确保在 GitHub 的文件大小限制内（单文件 < 100MB）

## 常见问题

**Q: 页面显示 404？**
- 检查文件是否已提交并推送到 GitHub
- 确认 GitHub Pages 已启用
- 等待几分钟让 GitHub 完成部署

**Q: CSS/JS 文件加载失败？**
- 检查文件路径是否正确（相对路径）
- 确认文件已提交到仓库

**Q: CSV 数据加载失败？**
- 检查 CSV 文件是否已提交
- 检查浏览器控制台的错误信息
- 确认文件名与 script.js 中的文件名一致

