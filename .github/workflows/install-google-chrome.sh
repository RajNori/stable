#!/usr/bin/env bash
# Google Chrome for Playwright's channel: "chrome". No browser profile is cached.
set -eu

wget -q -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get update
sudo apt-get install -y /tmp/google-chrome.deb
