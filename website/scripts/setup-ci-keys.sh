#!/usr/bin/env bash
# 给 CI 配读三个框架仓库用的只读 deploy key。一次性；换钥匙时也用它。
#
#   bash website/scripts/setup-ci-keys.sh
#
# 每个框架仓库一把：公钥登记成那个仓库的只读 deploy key，私钥存成本仓库的 Actions 密钥。
# 私钥只在一个临时目录里停留片刻，脚本结束即删除，不进任何仓库。
# 幂等：密钥和 deploy key 都已经在的仓库跳过。
# 要换钥匙：先删掉那个仓库的 deploy key 和这里对应的密钥，再重跑。
set -euo pipefail

ORG="CavaiLAB"
HOME_REPO="$ORG/jiangxin"
TITLE="jiangxin docs-site CI (read-only)"

tmp="$(mktemp -d)"
chmod 700 "$tmp"
trap 'rm -rf "$tmp"' EXIT

secrets="$(gh secret list -R "$HOME_REPO" --json name --jq '.[].name')"

setup() {
  local repo="$1" secret="$2" has_secret=0 has_key=0
  if grep -qxF "$secret" <<<"$secrets"; then has_secret=1; fi
  if gh repo deploy-key list -R "$ORG/$repo" --json title --jq '.[].title' | grep -qF "$TITLE"; then has_key=1; fi

  if [[ $has_secret == 1 && $has_key == 1 ]]; then
    echo "$repo：已配置，跳过"
    return
  fi
  if [[ $has_secret == 1 || $has_key == 1 ]]; then
    echo "$repo：密钥与 deploy key 只有一个在（密钥 $has_secret，deploy key $has_key）。把在的那个删掉再重跑" >&2
    return 1
  fi

  ssh-keygen -q -t ed25519 -N '' -C "$TITLE" -f "$tmp/$repo"
  gh repo deploy-key add "$tmp/$repo.pub" -R "$ORG/$repo" --title "$TITLE, $(date +%F)"
  gh secret set "$secret" -R "$HOME_REPO" < "$tmp/$repo"
  rm -f "$tmp/$repo" "$tmp/$repo.pub"
  echo "$repo：已登记只读 deploy key，私钥已存成密钥 $secret"
}

setup kun SOURCES_KEY_KUN
setup qian SOURCES_KEY_QIAN
setup sanyuan-agent SOURCES_KEY_SANYUAN_AGENT
