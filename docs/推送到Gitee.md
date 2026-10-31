# 推送到 Gitee（`lu-mingbo/smart-timetable`）

## 一、当前状态诊断

| 检查项 | 状态 |
|---|---|
| 本地是否 git 仓库 | ✅ 是，已有 1 个提交 `Initial Commit`（作者 `mingbo lu <610315189@qq.com>`） |
| 本地是否配置远程 | ❌ 没有 `origin` |
| 系统是否安装 git 程序 | ❌ **没有**（`git` 不在 PATH，注册表也没有 Git for Windows 记录） |
| Gitee 仓库是否存在 | ✅ `https://gitee.com/lu-mingbo/smart-timetable`，默认分支 `master` |
| 远程仓库内容 | ⚠️ **已有另一个版本**（根目录直接是 `app.js`/`pages/`/`utils/`，和本地 `miniprogram/` 的新结构不同） |

所以只差两步：**装 git → 配 remote → push**。

---

## 二、第 1 步：安装 Git

**方式 A：命令行安装（Windows 10/11 自带 winget）**

```powershell
winget install --id Git.Git -e --source winget
```

**方式 B：下载安装包**

- 官方：<https://git-scm.com/download/win>
- 国内镜像（更快）：<https://registry.npmmirror.com/binary.html?path=git-for-windows/>

下载 `Git-2.xx.x-64-bit.exe`，一路「下一步」安装即可（默认选项就行）。

装完**关掉并重新打开** PowerShell / 终端，验证：

```powershell
git --version
```

> 你的 `~/.gitconfig` 已经存在（用户名 `mingbo lu`、邮箱 `610315189@qq.com`、git-lfs 配置），
> 装完 git 会自动读取，不需要重新配置身份。

---

## 三、第 2 步：进入项目目录并配置远程

```powershell
cd C:\Users\Administrator\Documents\deepseek-harness\default-workspace\wechat-smart-schedule

# 先把当前所有改动纳入版本控制（.gitignore 已排除隐私文件）
git add -A
git status

# 配置远程仓库
git remote add origin https://gitee.com/lu-mingbo/smart-timetable.git
git remote -v
```

如果提示 `remote origin already exists`，说明之前配过，用这条改地址：

```powershell
git remote set-url origin https://gitee.com/lu-mingbo/smart-timetable.git
```

---

## 四、第 3 步：推送

远程仓库已有旧版本、且两地**没有共同历史**，所以不能直接 `git push` 到 master。
两种做法，按需选一种：

### 方案 A：推到新分支（推荐，先保留旧版）

```powershell
# 把本地的 master 推成远程的一个新分支 web-v2
git push -u origin master:web-v2
```

推送成功后，Gitee 上会多一个 `web-v2` 分支，旧版 `master` 原样保留。
确认没问题后，再去 Gitee「管理 → 仓库设置 → 默认分支」把默认分支改成 `web-v2`，
或者按方案 B 覆盖。

### 方案 B：直接覆盖远程 master

```powershell
# 会丢弃远程 master 上的旧历史（本地历史仍保留）
git push -f origin master
```

> ⚠️ 覆盖前建议先在 Gitee 上点一次「分支 → 新建分支」把旧版备份成 `legacy`，
> 或者直接采用方案 A。

### 第一次推送会要求输入账号密码

```
Username for 'https://gitee.com': lu-mingbo
Password for 'https://lu-mingbo@gitee.com': ← 这里填「私人令牌」，不是登录密码
```

**Gitee 已经不支持用登录密码推送**，必须用私人令牌，见下一节。

---

## 五、凭证：生成 Gitee 私人令牌

1. 登录 Gitee → 右上角头像 → **设置**
2. 左侧 **安全设置 → 私人令牌**
3. 点 **生成新令牌**
4. 描述填 `timetable-push`，权限至少勾选 **`projects`**（仓库读写）
5. 生成后**立即复制**（只显示一次），形如 `a1b2c3d4e5f6...`

推送时把令牌粘贴到 Password 位置即可。

想让 git 记住令牌（下次不用再输）：

```powershell
git config --global credential.helper manager
```

> **安全提醒**：令牌等同于账号密码，不要贴到聊天窗口、不要写进代码或 `.env` 以外的文件。
> 如果泄露，到同一页面「删除令牌」即可失效。

---

## 六、推送前的隐私检查（已完成）

项目里有一个真实教务系统导出的样本 `tools/samples/sample-jwxt-real.xlsx`，
里面含**真实班级名称与教师姓名**。已加入 `.gitignore`，不会被提交。

同时已排除：

- `server/.env`（准备放小程序 AppSecret 的文件，绝不能提交）
- `server/data/`（后端运行时数据）
- `web-shots/`、`qrcode-lan.png`（临时截图与二维码）
- `node_modules/`、日志文件

**提交前务必跑一次**：

```powershell
git status --short
```

确认没有出现上面这些文件。若已经误加，用 `git rm --cached <文件>` 撤销跟踪。

另外 `project.config.json` 里有你的小程序 AppID（`wx9b7faa6d123f9c78`）——
AppID 本身是公开信息（任何人打开小程序都能看到），一般无需处理；
如果不想公开，可以改成 `touristappid` 再推送。

---

## 七、推完之后

```powershell
# 查看远程分支
git ls-remote origin

# 以后日常更新
git add -A
git commit -m "更新说明"
git push
```

Gitee 仓库地址：<https://gitee.com/lu-mingbo/smart-timetable>

如需让网页版在线可访问，还可以开启 **Gitee Pages**（需要实名认证）：
仓库 → 服务 → Gitee Pages → 部署目录填 `web`，部署后会得到一个 `https://lu-mingbo.gitee.io/smart-timetable` 的访问地址，
那时二维码就可以指向公网地址，不再受"同一 WiFi"限制。

---

## 八、常见报错对照

| 报错 | 原因 | 解决 |
|---|---|---|
| `'git' 不是内部或外部命令` | git 没装 / 没重开终端 | 装完 Git 后重新打开 PowerShell |
| `Authentication failed` | 用了登录密码而不是私人令牌 | 改用私人令牌；或删除 Windows 凭据后重试 |
| `fatal: remote origin already exists` | 之前配过远程 | `git remote set-url origin <地址>` |
| `Updates were rejected because the remote contains work...` | 远程有本地没有的提交 | 用 `git push -f`（覆盖）或先 `git pull --allow-unrelated-histories` |
| `fatal: refusing to merge unrelated histories` | 两边历史无关（本仓库就是这种情况） | 推荐 `git push -u origin master:web-v2` 推新分支 |
| `Filename too long` | Windows 路径长度限制 | `git config --global core.longpaths true` |
| 推送大文件很慢 | 仓库 1.26 MB，其中 bundle/standalone 约占 420 KB | 正常，首次推送约几十秒 |
