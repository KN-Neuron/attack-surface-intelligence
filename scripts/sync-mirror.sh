#!/usr/bin/env bash
# Pulls main from the org repo and pushes it to the personal mirror that Railway
# deploys from. Runs in its own clone, so it never touches your working checkout.
#   main    -> mirrored 1:1 from KN-Neuron/attack-surface-intelligence
#   railway -> main merged into the deployment branch (Dockerfiles, railway.toml, docs/)
set -euo pipefail

UPSTREAM="${UPSTREAM:-https://github.com/KN-Neuron/attack-surface-intelligence.git}"
MIRROR="${MIRROR:-https://github.com/jmorawiec/attack-surface-intelligence.git}"
DIR="${SYNC_DIR:-$HOME/.cache/asi-mirror}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-railway}"

export GIT_TERMINAL_PROMPT=0
# Use the gh CLI's credentials (works under launchd as long as `gh auth login` was done).
GH="$(command -v gh || echo /opt/homebrew/bin/gh)"
cred=(-c "credential.helper=" -c "credential.helper=!$GH auth git-credential")

if [ ! -d "$DIR/.git" ]; then
  git clone "${cred[@]}" "$MIRROR" "$DIR"
  git -C "$DIR" remote add upstream "$UPSTREAM"
fi
cd "$DIR"
git config user.name "jmorawiec"
git config user.email "jakubmorawiec2@gmail.com"

git "${cred[@]}" fetch -q upstream main
git "${cred[@]}" fetch -q origin

# Mirror main exactly.
git "${cred[@]}" push -q origin upstream/main:refs/heads/main

# Fold main into the deployment branch.
git checkout -q -B "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"
if git merge --no-edit -q upstream/main; then
  git "${cred[@]}" push -q origin "$DEPLOY_BRANCH"
  echo "$(date '+%F %T') synced: $(git rev-parse --short HEAD)"
else
  git merge --abort || true
  echo "$(date '+%F %T') MERGE CONFLICT merging upstream/main into $DEPLOY_BRANCH; resolve manually in $DIR" >&2
  exit 1
fi
