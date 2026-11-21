# 驱动界面的无头浏览器：镜像自带 1.64.0 的 Chromium，这里只装同版本的 playwright-core。
ARG BASE=jx-egress/base:1
FROM ${BASE}
WORKDIR /opt/jx/browser
RUN npm init -y >/dev/null && npm i playwright-core@1.64.0 --no-audit --no-fund && chown -R pwuser:pwuser /opt/jx
LABEL jx.owner="jiangxin-web-egress"
