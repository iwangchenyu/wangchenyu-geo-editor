# 王尘宇GEO编辑器

西安蓝蜻蜓网络科技有限公司 · AI搜索平台GEO优化工具，支持多平台内容策略搭建、批量创作、智能优化与图片资产管理。

## 功能

### 策略搭建（6 步流水线）
1. **公司画像** — 企业信息录入 + AI 诊断补全
2. **AI 蒸馏** — 问题域分析 + 选题锚点生成
3. **选题确认** — 选题卡审核/编辑/确认
4. **指令预览** — 三层写作指令（正文层/标题层/平台层）
5. **任务确认** — 创作策略与任务列表
6. **批量创作** — 多平台文章批量生成

### 日常创作
- 一键从选题库生成文章
- 多平台风格适配（知乎/公众号/小红书/官网/AI搜索）
- 自动引用信号统计与合规检查

### AI 文章优化
- 四维诊断：结构 / 数据密度 / 可读性 / 合规
- 段落级改写建议，一键应用
- 标题优化（含长尾关键词）

### 图片资产管理
- 拖拽上传，自动压缩
- Logo / 产品图 / 品牌素材分类
- 一键复制 Markdown 图片语法

### 其他
- 文章管理（搜索/筛选/合集/富文本预览）
- 文章导出（Markdown / JSON / 纯文本）
- 数据看板（平台分布/内容形态/引用信号/合规率）
- 多 AI 接口自动切换（DeepSeek / 硅基流动 / 智谱 等）
- <img width="871" height="562" alt="ScreenShot_2026-06-09_234744_762" src="https://github.com/user-attachments/assets/e9fc5040-0e09-4460-b8fe-c8d5387ddb2c" />
<img width="1017" height="992" alt="ScreenShot_2026-06-09_234823_164" src="https://github.com/user-attachments/assets/933c3daa-00e3-4be1-b167-8264b65bc50c" />
<img width="1018" height="994" alt="ScreenShot_2026-06-09_234832_793" src="https://github.com/user-attachments/assets/622943ed-a99a-4963-824b-ab740319290e" />
<img width="1002" height="792" alt="ScreenShot_2026-06-09_234904_242" src="https://github.com/user-attachments/assets/fd03a54c-0675-4111-8b6c-f86debdbe23a" />
<img width="1012" height="1502" alt="ScreenShot_2026-06-09_234921_821" src="https://github.com/user-attachments/assets/c6103748-3812-47b7-8b68-d3576f707762" />


## 技术栈

- **前端**: React 19 + TypeScript + Vite + Tailwind CSS
- **路由**: React Router v7
- **数据库**: sql.js（浏览器端 SQLite）
- **AI**: 多 Provider 自动切换，兼容 OpenAI 接口格式
- **图标**: Lucide React

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 演示站访问

演示站：[geo.wangshifu.cn](https://geo.wangshifu.cn)

- 主站可直接浏览，无需密码
- 点击右上角「API」配置接口时需要密码
- 默认密码：`qrocn`（登录后可自行修改）

## 配置 AI 接口

点击右上角「API」→ 输入密码 `qrocn` → 配置至少一个 AI 接口的 Key：

| 接口 | 获取地址 |
|------|---------|
| DeepSeek | https://platform.deepseek.com |
| 硅基流动 | https://siliconflow.cn |
| 智谱AI | https://open.bigmodel.cn |

## 作者

**王尘宇** · 西安蓝蜻蜓网络科技有限公司

- 网站：[wangchenyu.com](https://wangchenyu.com) | [qro.cn](https://qro.cn) | [mqs.net](https://mqs.net)
- 邮箱：[314111741@qq.com](mailto:314111741@qq.com)
- 微信：wangshifucn


## 部署

演示站：[geo.wangshifu.cn](https://geo.wangshifu.cn)

### 服务器部署（Nginx）

```bash
npm run build
# 将 dist/ 目录上传到服务器 /var/www/geo-editor/
# 配置 nginx.conf（项目根目录已提供）
```

### 一键部署

```bash
# 构建 + rsync 到服务器（替换 your-server 为实际地址）
npm run build && rsync -avz --delete dist/ your-server:/var/www/geo-editor/
```

## License

MIT
