#!/bin/bash
# 推送到 GitHub 指南

# 方式一：使用 GitHub CLI（推荐）
# 1. 安装 GitHub CLI: https://cli.github.com/
# 2. 登录: gh auth login
# 3. 创建仓库并推送:
gh repo create baby-shopping-miniprogram --public --source=. --push --description "👶 宝宝购物记账小程序"

# 方式二：手动推送
# 1. 在 GitHub 网站创建仓库: https://github.com/new
#    - 仓库名: baby-shopping-miniprogram
#    - 设为 Public
#    - 不要勾选 README、.gitignore、license
# 2. 推送代码:
git remote add origin https://github.com/zhangjiayi03/baby-shopping-miniprogram.git
git branch -M main
git push -u origin main

# 方式三：使用 SSH（需先配置 SSH Key）
git remote set-url origin git@github.com:zhangjiayi03/baby-shopping-miniprogram.git
git push -u origin master
