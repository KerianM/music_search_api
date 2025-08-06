# Music Search API Server

一个基于Node.js的音乐搜索API服务器，支持多种音乐源。

## 功能特性

- 🎵 支持关键词搜索音乐
- 🎶 基于音乐文件内置元数据搜索（title、artist、album）
- 🔍 多音乐源集成（网易云音乐、咪咕音乐、本地文件）
- 📁 本地音乐文件搜索和播放
- 📝 自动匹配歌词文件
- 🎵 支持多种音频格式的元数据读取
- 📱 RESTful API设计
- 🚀 高性能Express服务器
- 🔒 环境变量配置
- 📊 健康检查端点

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 到 `.env` 并配置相关参数：

```bash
cp .env.example .env
```

### 启动服务器

```bash
node server.js
```

## API文档

### 搜索音乐

**GET** `/search`

**参数：**
- `keyword` (必需): 搜索关键词（歌曲名或歌手名）

**示例请求：**
```
GET http://localhost:3000/search?keyword=周杰伦晴天
```

**示例响应：**
```json
{
  "id": "FB2urKkWUgSUsm0uYHVN7t",
  "title": "晴天",
  "artist": "周杰伦",
  "album": "叶惠美",
  "duration": 269.5,
  "songUrl": "http://example.com/music/sunny-day.mp3",
  "lyricUrl": "http://example.com/lyrics/sunny-day.lrc"
}
```

### 流播放音乐

**GET** `/stream`

**参数：**
- `id` (必需): 音乐文件的唯一ID

**示例请求：**
```
GET http://localhost:3000/stream?id=FB2urKkWUgSUsm0uYHVN7t
```

**功能：**
- 支持HTTP范围请求，适合音频流播放
- 自动设置正确的Content-Type
- 支持断点续传

### 获取音乐信息

**GET** `/info`

**参数：**
- `id` (必需): 音乐文件的唯一ID

**示例请求：**
```
GET http://localhost:3000/info?id=FB2urKkWUgSUsm0uYHVN7t
```

**示例响应：**
```json
{
  "id": "FB2urKkWUgSUsm0uYHVN7t",
  "title": "晴天",
  "artist": "周杰伦",
  "album": "叶惠美",
  "duration": 269.5,
  "streamUrl": "http://localhost:3000/stream?id=FB2urKkWUgSUsm0uYHVN7t",
  "lyricUrl": "http://localhost:3000/lyrics/周杰伦 - 晴天.lrc"
}
```

### 健康检查

**GET** `/health`

检查服务器状态。

## 音乐源配置

### 1. 网易云音乐

需要申请官方API或使用合法的第三方接口。

### 2. 咪咕音乐

需要申请官方API密钥。

### 3. 本地文件搜索

创建音乐和歌词目录，并配置环境变量：
```
MUSIC_DIRECTORY=./music
LYRICS_DIRECTORY=./lyrics
```

**元数据搜索：**
- 自动读取MP3、FLAC等音频文件的内置元数据
- 支持按标题(title)、艺术家(artist)、专辑(album)搜索
- 如果元数据不可用，自动回退到文件名搜索
- 返回完整的音乐信息包括专辑和时长

**支持的音频格式：**
- MP3, FLAC, WAV, AAC, M4A, OGG

**歌词文件格式：**
- LRC, TXT

**文件命名建议：**
- 音乐文件：`艺术家 - 歌曲名.mp3`
- 歌词文件：`艺术家 - 歌曲名.lrc`

**目录结构示例：**
```
music/
├── 周杰伦 - 晴天.mp3
├── 周杰伦 - 青花瓷.flac
└── 邓紫棋 - 泡沫.mp3

lyrics/
├── 周杰伦 - 晴天.lrc
├── 周杰伦 - 青花瓷.lrc
└── 邓紫棋 - 泡沫.lrc
```

## 重要说明

⚠️ **版权声明**：
- 本示例代码仅用于学习和演示目的
- 使用任何音乐API时请确保遵守相关的服务条款和版权法律
- 建议使用官方API或获得合法授权的第三方服务
- 不要用于商业用途而未获得适当的许可

## 技术栈

- Node.js
- Express.js
- Axios (HTTP客户端)
- music-metadata (音频元数据读取)
- CORS (跨域支持)
- dotenv (环境变量管理)

## 开发

### 目录结构

```
├── music/            # 音乐文件目录
├── lyrics/           # 歌词文件目录
├── server.js          # 主服务器文件
├── .env.example       # 环境变量示例
├── package.json       # 项目配置
└── README.md         # 项目文档
```

### 扩展功能

可以根据需要添加以下功能：
- 音乐文件元数据读取
- 专辑封面支持
- 音乐文件转码
- 用户认证
- 搜索结果缓存
- 分页支持
- 搜索历史
- 播放列表管理