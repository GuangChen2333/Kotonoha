# Kotonoha

面向电子书(EPUB)的日语学习软件。企划放在 `docs/private-design-docs/`(已加入 `.gitignore`,不进版本库),文件名格式为 `{utctime}-{title}.md`。

## 原则

- 优先使用已有的组件库和成熟的第三方库,而不是自己写。仅在现有方案无法满足需求时才自研,并在决策记录或提交说明中写明原因。

## 开发运行

- 默认用 `pnpm tauri dev` 运行,不要只开 `pnpm dev` 的网页:数据(设置、书架、对话、AI 缓存)由 Rust 端的 SQLite 持久化,网页版只有浏览器自己的存储,容易丢。
- Tauri 启动时会同时起 Vite(5173),需要在浏览器里看界面时可以直接打开它,但那是网页版,数据与桌面应用不互通。
- Android:需要 `ANDROID_HOME=~/Library/Android/sdk`、`NDK_HOME=~/Library/Android/sdk/ndk/<版本>`;调试版包名带 `.debug`。

