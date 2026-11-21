# DSH 0.2.2-rc.5（Linux 版依赖），按发行目录的 package.json / package-lock.json 安装。
# 补丁和启动器不打进镜像，运行时以只读方式挂进来，改补丁不用重建。
ARG BASE=jx-egress/base:1
FROM ${BASE}
WORKDIR /opt/jx/distribution
COPY package.json package-lock.json .npmrc ./
# 插件包（品牌包、样板插件）的 tarball，package.json 里写的是 file:vendor/…
COPY vendor ./vendor
RUN npm ci --ignore-scripts --no-audit --no-fund \
 && node -e "require('node-pty'); require('koffi')" \
 && ./node_modules/.bin/dsh --version \
 && chown -R pwuser:pwuser /opt/jx
LABEL jx.owner="jiangxin-web-egress"
