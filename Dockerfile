# 使用官方 Node.js 镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package.json ./

# 安装依赖
RUN npm install

# 复制项目所有文件
COPY . .

# 暴露端口（如 package.json 中的 PORT 环境变量，默认 3000）
EXPOSE 3020

# 启动服务
CMD ["npm", "start"]