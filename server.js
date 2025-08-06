const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const mm = require('music-metadata');
require('dotenv').config();

const app = express();

const searchEnabledNet1 = process.env.SEARCH_ENABELD_NET1 !== 'false';
const searchEnabledNet2 = process.env.SEARCH_ENABELD_NET2 !== 'false';
const searchEnabledLocal = process.env.SEARCH_ENABELD_LOCAL !== 'false';
const SERVER_URL = process.env.SERVER_URL;
const PORT = process.env.PORT || 3000;


// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// 生成唯一ID的函数
function generateMusicId(filePath) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(filePath).digest('hex').substring(0, 22);
}

// 根据ID查找音乐文件
async function findMusicById(id) {
  try {
    const musicDir = process.env.MUSIC_DIRECTORY || './music';
    const lyricsDir = process.env.LYRICS_DIRECTORY || './lyrics';

    if (!fs.existsSync(musicDir)) {
      return null;
    }

    // 支持的音频文件格式
    const audioExtensions = ['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg'];
    const audioPattern = `**/*.{${audioExtensions.join(',')}}`;

    // 搜索所有音频文件
    const musicFiles = await glob(audioPattern, { cwd: musicDir });

    // 查找匹配ID的文件
    for (const file of musicFiles) {
      const fileId = generateMusicId(file);
      if (fileId === id) {
        const fullMusicPath = path.join(musicDir, file);
        const fileName = path.basename(file, path.extname(file));

        // 尝试找到对应的歌词文件
        let lyricPath = null;
        if (fs.existsSync(lyricsDir)) {
          const lyricExtensions = ['lrc', 'txt'];
          for (const ext of lyricExtensions) {
            const testLyricPath = path.join(lyricsDir, `${fileName}.${ext}`);
            if (fs.existsSync(testLyricPath)) {
              lyricPath = testLyricPath;
              break;
            }
          }
        }

        // 读取音乐文件元数据
        let title, artist, album;

        try {
          const metadata = await mm.parseFile(fullMusicPath);
          title = metadata.common.title || fileName;
          artist = metadata.common.artist || 'Unknown Artist';
          album = metadata.common.album || null;
        } catch (error) {
          // 如果无法读取元数据，回退到文件名解析
          title = fileName;
          artist = 'Unknown Artist';

          if (fileName.includes(' - ')) {
            const parts = fileName.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
          }
        }

        return {
          id: fileId,
          title: title,
          artist: artist,
          filePath: fullMusicPath,
          lyricPath: lyricPath,
          originalFile: file,
          album: album,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Find music by ID error:', error.message);
    return null;
  }
}

// 网络音乐搜索 - 接口1 (用的妖狐里面的QQ音乐API（https://api.yaohud.cn/user/）)
async function searchNet1Music(keyword) {
return new Promise((resolve, reject) => {
  const lyricsDir = process.env.LYRICS_DIRECTORY || './lyrics';
  let result = null;
  try {
    console.log(`Searching Net1 Music for: ${keyword}`);
    const https = require('https');
    const params = new URLSearchParams({
      key: 'TWsPjOKrqm1jN2MoENV', // 密钥
      msg: keyword,
      n: 1,
      size: '', // 留空默认m4a, 可选mp3
      cookie: '', // 留空默认m4a试听
      type: '', // 仅返回json格式
    });
    const options = {
      hostname: 'api.yaohud.cn',
      path: '/api/music/qq?' + params.toString(),
      method: 'GET'
    };
    https.get(options, res => {
      console.log(`statusCode: ${res.statusCode}`);
      let rawData = '';
      res.on('data', d => {
        rawData += d;
      });
      res.on('end', () => {
        try {
          const raw = JSON.parse(rawData);
          if(!raw.data)
          {
            console.log('没有找到歌曲数据');
            reject(new Error('接口 1 返回非 200'));
          }
          const songname = raw.data.name;
          const singer = raw.data.songname;
          const musicurl = raw.data.musicurl;
          const lrctxt = raw.data.lrctxt;

          // 如果没有歌曲但是有歌词，保存歌词文件至本地
          // 检查歌词目录是否存在，不存在则创建
          if(lrctxt && lrctxt != '' ) {
              // 歌词文本，格式[歌手 - 歌曲名.lrc]
              const filePath = lyricsDir + '/' + singer + ' - ' + songname + '.lrc';
              if (!fs.existsSync(filePath))
              {
                fs.writeFileSync(filePath, lrctxt, 'utf8');
                console.log(`歌词已保存为 ${filePath}`);
              }else {
                console.log(`${filePath} 已存在，跳过保存`);
              }
            }else {
              console.log(`${songname} 歌词文件不存在`);
              reject(new Error('接口 1 返回非 200'));
            }
          // 如果没有歌曲URL，返回null
          if (musicurl.length < 30) { // 当没有m4a音乐时，仅会返回"http://aqqmusic.tc.qq.com/"
            console.log('没有找到歌曲URL');
            reject(new Error('接口 1 返回非 200'));
          }else{
            console.log(`已找到歌曲URL: ${musicurl}`);
          }
          result = {
            title: songname,
            artist: singer,
            songUrl: musicurl,
            lyricUrl: SERVER_URL + '/lyrics/' + singer + ' - ' + songname + '.lrc'
          };
          // 返回数据
          resolve(result);
        } catch (e) {
          console.error('响应不是合法 JSON', e);
          reject(new Error('接口 1 返回非 200'));
        }
      });
    }).on('error', error => {
      console.error(error);
      reject(new Error('接口 1 返回非 200'));
    });
  } catch (error) {
    console.error('NetEase Music API error:', error.message);
    reject(new Error('接口 1 返回非 200'));
  }
});
}

// 网络音乐搜索 - 接口2 (https://api.yuafeng.cn/API/ly/mgmusic.php?msg=%E5%A4%9C%E6%9B%B2&n=1)
async function searchMiguMusic(keyword) {
return new Promise((resolve, reject) => {
  const lyricsDir = process.env.LYRICS_DIRECTORY || './lyrics';
  let result = null;
  try {
    console.log(`Searching Net2 Music for: ${keyword}`);
    const https = require('https');
    const params = new URLSearchParams({
      msg: keyword,
      n: 1,
    });
    const options = {
      hostname: 'api.yuafeng.cn',
      path: '/API/ly/mgmusic.php?' + params.toString(),
      method: 'GET'
    };
    https.get(options, res => {
      console.log(`statusCode: ${res.statusCode}`);
      let rawData = '';
      res.on('data', d => {
        rawData += d;
      });
      res.on('end', () => {
        try {
          const raw = JSON.parse(rawData);
          if(!raw.data)
          {
            console.log('没有找到歌曲数据');
            reject(new Error('接口 2 返回非 200'));
          }
          const songname = raw.data.song;
          const singer = raw.data.singer;
          const musicurl = raw.data.music;
          const lrctxt = raw.data.lyric;

          // 如果没有歌曲但是有歌词，保存歌词文件至本地
          // 检查歌词目录是否存在，不存在则创建
          if(lrctxt && lrctxt != '' ) {
              // 歌词文本，格式[歌手 - 歌曲名.lrc]
              const filePath = lyricsDir + '/' + singer + ' - ' + songname + '.lrc';
              if (!fs.existsSync(filePath))
              {
                fs.writeFileSync(filePath, lrctxt, 'utf8');
                console.log(`歌词已保存为 ${filePath}`);
              }else {
                console.log(`${filePath} 已存在，跳过保存`);
              }
            }else {
              console.log(`${songname} 歌词文件不存在`);
              reject(new Error('接口 2 返回非 200'));
            }
          // 如果没有歌曲URL，返回null
          if (musicurl.length < 30) { // 当没有m4a音乐时，仅会返回"http://aqqmusic.tc.qq.com/"
            console.log('没有找到歌曲URL');
            reject(new Error('接口 2 返回非 200'));
          }else{
            console.log(`已找到歌曲URL: ${musicurl}`);
          }
          result = {
            title: songname,
            artist: singer,
            songUrl: musicurl,
            lyricUrl: SERVER_URL + '/lyrics/' + singer + ' - ' + songname + '.lrc'
          };
          // 返回数据
          resolve(result);
        } catch (e) {
          console.error('响应不是合法 JSON', e);
          reject(new Error('接口 2 返回非 200'));
        }
      });
    }).on('error', error => {
      console.error(error);
      reject(new Error('接口 2 返回非 200'));
    });
  } catch (error) {
    console.error('NetEase Music API error:', error.message);
    reject(new Error('接口 2 返回非 200'));
  }
});
}

// 本地文件搜索函数
async function searchLocalFiles(keyword) {
  try {
    const musicDir = process.env.MUSIC_DIRECTORY || './music';
    const lyricsDir = process.env.LYRICS_DIRECTORY || './lyrics';

    console.log(`Searching local files for: ${keyword}`);

    // 检查目录是否存在
    if (!fs.existsSync(musicDir)) {
      console.log(`Music directory not found: ${musicDir}`);
      return null;
    }

    // 支持的音频文件格式
    const audioExtensions = ['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg'];
    const audioPattern = `**/*.{${audioExtensions.join(',')}}`;

    // 搜索音频文件
    const musicFiles = await glob(audioPattern, { cwd: musicDir });

    // 读取每个文件的元数据并进行匹配
    const matchedFiles = [];
    const keywordLower = keyword.toLowerCase();

    for (const file of musicFiles) {
      try {
        const fullPath = path.join(musicDir, file);
        const metadata = await mm.parseFile(fullPath);

        const title = metadata.common.title || '';
        const artist = metadata.common.artist || '';
        const album = metadata.common.album || '';

        // 检查关键词是否匹配标题、艺术家或专辑
        if (title.toLowerCase().includes(keywordLower) ||
            artist.toLowerCase().includes(keywordLower) ||
            album.toLowerCase().includes(keywordLower)) {
          matchedFiles.push({
            file: file,
            metadata: metadata.common
          });
        }
      } catch (error) {
        // 如果无法读取元数据，回退到文件名搜索
        const fileName = path.basename(file, path.extname(file));
        if (fileName.toLowerCase().includes(keywordLower)) {
          matchedFiles.push({
            file: file,
            metadata: null
          });
        }
      }
    }

    if (matchedFiles.length === 0) {
      return null;
    }

    // 取第一个匹配的文件
    const matchResult = matchedFiles[0];
    const matchedFile = matchResult.file;
    const metadata = matchResult.metadata;
    const fullMusicPath = path.join(musicDir, matchedFile);
    const fileName = path.basename(matchedFile, path.extname(matchedFile));

    // 尝试找到对应的歌词文件
    let lyricUrl = null;
    if (fs.existsSync(lyricsDir)) {
      const lyricExtensions = ['lrc', 'txt'];
      for (const ext of lyricExtensions) {
        // 优先使用元数据中的标题和艺术家查找歌词
        if (metadata && metadata.title && metadata.artist) {
          const lyricFileName = `${metadata.artist} - ${metadata.title}.${ext}`;
          const lyricPath = path.join(lyricsDir, lyricFileName);
          if (fs.existsSync(lyricPath)) {
            lyricUrl = `${SERVER_URL}/lyrics/${encodeURIComponent(lyricFileName)}`;
            break;
          }
        }

        // 回退到使用文件名查找歌词
        const lyricPathFallback = path.join(lyricsDir, `${fileName}.${ext}`);
        if (fs.existsSync(lyricPathFallback)) {
          lyricUrl = `${SERVER_URL}/lyrics/${fileName}.${ext}`;
          break;
        }
      }
    }

    // 使用元数据或解析文件名获取标题和艺术家
    let title, artist;

    if (metadata && metadata.title) {
      title = metadata.title;
      artist = metadata.artist || 'Unknown Artist';
    } else {
      // 回退到文件名解析
      title = fileName;
      artist = 'Unknown Artist';

      if (fileName.includes(' - ')) {
        const parts = fileName.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }
    }

    return {
      title: title,
      artist: artist,
      songUrl: `${SERVER_URL}/music/${encodeURIComponent(matchedFile)}`,
      lyricUrl: lyricUrl,
    };

  } catch (error) {
    console.error('Local file search error:', error.message);
    return null;
  }
}

// 主搜索路由
app.get('/search', async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res.status(400).json({
        error: 'Missing keyword parameter',
        message: 'Please provide a keyword to search for music'
      });
    }

    console.log(`Searching for: ${keyword}`);

    let result = null;
    // 优先级搜索：网络接口1 -> 网络接口2 -> 本地文件
    if (!searchEnabledNet1 && !searchEnabledNet2 && !searchEnabledLocal) {
      return res.status(503).json({
        error: 'All search methods are disabled',
        message: 'Please enable at least one search method in the server configuration'
      });
    }
    if (searchEnabledNet1)
    {
      try {
      console.log('正在网络接口1搜索...');
      result = await searchNet1Music(keyword);
      } catch (error) {
        console.log('Net1 search failed, trying Migu...');
      }
    }
    if (searchEnabledNet2)
    {
      if (!result) {
        try {
          console.log('正在网络接口2搜索...');
          result = await searchMiguMusic(keyword);
        } catch (error) {
          console.log('Net2 search failed, trying Navidrome...');
        }
      }
    }
    if (searchEnabledLocal)
    {
      if (!result) {
        try {
          console.log('正在本地搜索...');
          result = await searchLocalFiles(keyword);
        } catch (error) {
          console.log('Local file search failed, using mock data...');
        }
      }
    }
    console.log('搜索完成');

    if (result) {
      res.json(result);
    } else {
      res.status(404).json({
        error: 'Music not found',
        message: `No music found for keyword: ${keyword}`
      });
    }

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while searching for music'
    });
  }
});

// 音乐流播放路由 - 通过ID播放
app.get('/stream', async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        error: 'Missing id parameter',
        message: 'Please provide an id to stream music'
      });
    }

    console.log(`Streaming music with ID: ${id}`);

    // 查找音乐文件
    const musicInfo = await findMusicById(id);

    if (!musicInfo) {
      return res.status(404).json({
        error: 'Music not found',
        message: `No music found with ID: ${id}`
      });
    }

    const filePath = musicInfo.filePath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Music file not found' });
    }

    // 设置适当的Content-Type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.flac': 'audio/flac',
      '.wav': 'audio/wav',
      '.aac': 'audio/aac',
      '.m4a': 'audio/mp4',
      '.ogg': 'audio/ogg'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // 支持范围请求（用于音频流）
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunksize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      fs.createReadStream(filePath).pipe(res);
    }

  } catch (error) {
    console.error('Error streaming music:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取音乐信息路由 - 通过ID获取音乐详情
app.get('/info', async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        error: 'Missing id parameter',
        message: 'Please provide an id to get music info'
      });
    }

    const musicInfo = await findMusicById(id);

    if (!musicInfo) {
      return res.status(404).json({
        error: 'Music not found',
        message: `No music found with ID: ${id}`
      });
    }

    const response = {
      id: musicInfo.id,
      title: musicInfo.title,
      artist: musicInfo.artist,
      album: musicInfo.album,
      streamUrl: `${SERVER_URL}/stream?id=${musicInfo.id}`,
      lyricUrl: musicInfo.lyricPath ? `${SERVER_URL}/lyrics/${path.basename(musicInfo.lyricPath)}` : null
    };

    res.json(response);

  } catch (error) {
    console.error('Error getting music info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 健康检查路由
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 静态文件服务 - 提供音乐文件访问
app.get('/music/:filename', (req, res) => {
  try {
    const musicDir = process.env.MUSIC_DIRECTORY || './music';
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(musicDir, filename);

    // 安全检查：确保文件在指定目录内
    const resolvedPath = path.resolve(filePath);
    const resolvedMusicDir = path.resolve(musicDir);

    if (!resolvedPath.startsWith(resolvedMusicDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // 设置适当的Content-Type
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.flac': 'audio/flac',
      '.wav': 'audio/wav',
      '.aac': 'audio/aac',
      '.m4a': 'audio/mp4',
      '.ogg': 'audio/ogg'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // 支持范围请求（用于音频流）
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunksize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      fs.createReadStream(filePath).pipe(res);
    }

  } catch (error) {
    console.error('Error serving music file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 静态文件服务 - 提供歌词文件访问
app.get('/lyrics/:filename', (req, res) => {
  try {
    const lyricsDir = process.env.LYRICS_DIRECTORY || './lyrics';
    const filename = req.params.filename;
    const filePath = path.join(lyricsDir, filename);

    // 安全检查：确保文件在指定目录内
    const resolvedPath = path.resolve(filePath);
    const resolvedLyricsDir = path.resolve(lyricsDir);

    if (!resolvedPath.startsWith(resolvedLyricsDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Lyrics file not found' });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.lrc' ? 'text/plain' : 'text/plain';

    res.setHeader('Content-Type', contentType + '; charset=utf-8');
    fs.createReadStream(filePath, 'utf8').pipe(res);

  } catch (error) {
    console.error('Error serving lyrics file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 根路由
app.get('/', (req, res) => {
  res.json({
    message: 'Music Search API Server',
    version: '1.0.0',
    endpoints: {
      search: '/search?keyword=<search_term>',
      stream: '/stream?id=<music_id>',
      info: '/info?id=<music_id>',
      music: '/music/<filename>',
      lyrics: '/lyrics/<filename>',
      health: '/health'
    },
    examples: {
      search: `${req.protocol}://${req.get('host')}/search?keyword=周杰伦晴天`,
      stream: `${req.protocol}://${req.get('host')}/stream?id=FB2urKkWUgSUsm0uYHVN7t`,
      info: `${req.protocol}://${req.get('host')}/info?id=FB2urKkWUgSUsm0uYHVN7t`
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🎵 Music Search API Server is running on port ${PORT}`);
  console.log(`🔍 Search endpoint: ${SERVER_URL}/search?keyword=周杰伦晴天`);
  console.log(`🎵 Music directory: ${process.env.MUSIC_DIRECTORY || './music'}`);
  console.log(`📝 Lyrics directory: ${process.env.LYRICS_DIRECTORY || './lyrics'}`);
  console.log(`📊 Health check: ${SERVER_URL}/health`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});
