# 外联检查的公共底座：Playwright 官方镜像（Ubuntu 24.04 + Node 24.21 + Chromium），
# 加上抓包用的 tcpdump，和让 DSH「默认工作区」在 Linux 上能找到「文稿」目录的 xdg-user-dirs。
FROM mcr.microsoft.com/playwright:v1.64.0-noble
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tcpdump xdg-user-dirs \
 && rm -rf /var/lib/apt/lists/* \
 && su pwuser -c 'xdg-user-dirs-update' \
 && su pwuser -c 'test -d /home/pwuser/Documents'
LABEL jx.owner="jiangxin-web-egress"
