# 教材词库数据结构

## 概述

本应用为纯前端本地应用，教材以 JSON 描述，也可通过 CSV 导入后转为同一结构。内置示例：`public/data/textbooks/demo-pep-sample.json`（功能演示用，非完整教材）。用户导入的教材保存在浏览器 `localStorage`（键：`le_imported_textbooks`）。

**主词库方向**：高中 **人教版（PEP）英语** 单元单词。词库说明与分册建议见 [`词库-人教版高中英语.md`](./词库-人教版高中英语.md)。

## JSON 结构

```json
{
  "id": "demo-pep-sample",
  "title": "示例教材 · 入门单词（演示）",
  "units": [
    {
      "id": "u1",
      "title": "Unit 1 · Greetings",
      "words": [
        { "en": "hello", "zh": "你好", "phonetic": "/həˈləʊ/" }
      ]
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 教材唯一标识，导入同 id 会覆盖 |
| `title` | string | 是 | 教材显示名称 |
| `units` | Unit[] | 是 | 单元列表，至少一个 |
| `units[].id` | string | 是 | 单元 id |
| `units[].title` | string | 是 | 单元标题 |
| `units[].words` | Word[] | 是 | 单词列表 |
| `words[].en` | string | 是 | 英文单词/短语 |
| `words[].zh` | string | 是 | 中文释义（听写时朗读） |
| `words[].phonetic` | string | 否 | 音标，仅展示 |

## CSV 导入格式

表头（英文或中文均可）：

```csv
unit,en,zh
Unit 1,hello,你好
Unit 1,book,书
Unit 2,apple,苹果
```

| 列名（任一） | 含义 |
|--------------|------|
| `unit` / `单元` | 单元名，相同名称合并为一个单元 |
| `en` / `english` / `英文` / `单词` | 英文 |
| `zh` / `chinese` / `中文` / `释义` | 中文 |

- 编码：**UTF-8**（Excel 另存为 CSV UTF-8；支持 BOM）
- 文件扩展名：`.csv` / `.txt` / `.json`
- 导入后 `id` 自动生成为 `import-{时间戳}`，`title` 默认用文件名

## 本机缓存（非 API，localStorage）

### 播放设置 `le_player_settings`

```json
{
  "rate": 1.0,
  "repeatEn": 2,
  "gapMs": 3000
}
```

| 字段 | 默认 | 范围 |
|------|------|------|
| `rate` 语速 | **1.0** | 0.5～1.5 |
| `repeatEn` 英文遍数 | 2 | 1～10 |
| `gapMs` 词间隔 ms | 3000 | 0～30000 |

### 选择缓存 `le_selection_v1`

```json
{
  "textbookId": "pep-primary-g3-s1",
  "selectedUnits": ["u1", "u2"],
  "openStages": { "primary": true, "junior": false, "senior": false },
  "mode": "browse"
}
```

## 前端「接口」说明

无 HTTP 后端。与 UI 交互的数据流：

1. **加载内置教材**：`GET /data/textbooks/index.json` + 各册 JSON → `Textbook[]`
2. **播放**：`WordPlayer.start(words, mode)`，mode 为 `browse` | `shadow`
3. **缓存**：见上；读写实现在 `src/lib/storage.ts`

### 播放时 UI 状态（示意）

```json
{
  "mode": "shadow",
  "status": "playing",
  "playIndex": 2,
  "queueLen": 16,
  "currentWord": { "en": "book", "zh": "书" }
}
```

| status | 含义 |
|--------|------|
| `idle` | 未播放 |
| `playing` | 播放中 |
| `paused` | 暂停 |
| `done` | 队列播完 |
