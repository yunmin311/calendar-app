# public/fonts —— 导出 PDF 用的嵌入字

导出印刷 PDF 时,前端会 `fetch('/fonts/…')` 取这里的字体,用 @pdf-lib/fontkit **子集嵌入**(只嵌用到的字形)。
屏幕预览不吃这里的字(用系统字,不分发、不违规)。

## 现状

| 文件 | 角色 | 状态 |
|---|---|---|
| `EBGaramond_400Regular.ttf` / `_700Bold` / `_Italic` | 拉丁(年份/刻度/月号/页脚) | ✅ 已放置, OFL, 已在导出中子集嵌入 |
| `LXGWWenKai-Regular.ttf` | 中文(月份名/里程碑标签/备注) | ⛔ **缺** —— 放进来即自动启用 |
| `LICENSES/EBGaramond-OFL.txt` | EBG 许可正文 | ✅ 随产物走 |
| `LICENSES/LXGWWenKai-OFL.txt` | 霞鹜文楷许可正文 | ✅ 随产物走 |

## 放置霞鹜文楷(一步启用中文)

1. 下 `LXGWWenKai-Regular.ttf`(≈25MB)自 https://github.com/lxgw/LxgwWenKai/releases —— 本机外网限速常拉不动, 换网络/镜像/手动下都行。
2. 丢进本文件夹, 文件名保持 `LXGWWenKai-Regular.ttf`。
3. 重新导出 → 中文自动出现(月份名、里程碑楷体标签、每日备注)。node 侧可 `npm run test:pdf` 验证。

## ⚠️ 霞鹜文楷的 OFL 红线(读 OFL.txt 正文得出, 非臆断)

- 声明了**保留字体名(RFN)**: `'LXGW'` 等。做 subset = Modified Version → RFN 激活。
- 附加许可**只覆盖「web 字体投递」**, 明确排除「做成可安装桌面字体」。**嵌进要卖的 PDF 属灰区**。
- 因此落地要求:
  1. 子集字体**内部命名不得含 `LXGW`/保留名**(改成自有名, 如 `Calendar Kai Subset`);导出后**核对**嵌入子集的 name 表。
  2. `LICENSES/LXGWWenKai-OFL.txt` **必须随 PDF/产物一起分发**。
  3. **商用规模化前**按作者原话去问 @lxgw 确认「PDF 嵌入分发」在许可范围内, 别自行扩大解释。
- EB Garamond 无 RFN, 无此限制。
