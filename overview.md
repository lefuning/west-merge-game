# 《西游·字战》项目概览

## What it is
纯前端 Canvas 小游戏（文字合成 + 放置割草）。零依赖：`index.html` + `game.js`，无构建步骤，静态文件直接可玩。

## How to play（在线）
- **正式链接（GitHub Pages）**：https://lefuning.github.io/west-merge-game/
- 仓库：https://github.com/lefuning/west-merge-game （Public，main 分支）
- 临时云端沙箱（可能失效）：https://c9ed7b22ccb24e0a861fffdd96934e3b.gz2.agentos-app.net
- 本地调试：`python -m http.server 8666`

## 核心设计（v0.5.0）
- **玩法循环**：刷字 → 三连合成 → 合成 L5 终极形态英雄出战 → 击杀敌人赚古币 → 解锁新角色链 → 闯关推进
- **闯关模式**：每 3 波 = 1 关，一关约 2-3 分钟；每关结束结算，失败可重试本关，金币与解锁进度保留
- **毕业链降权**（v0.4.2）：未毕业链权重 3 / 毕业链权重 1，毕业链仍会刷字但概率大幅下降
- **毕业折算**（v0.4.1）：毕业链合成到 L4/L5 时不再出英雄，改为折算古币（L4=60 / L5=120）
- **经济流向**：古币来源 = 击杀 + 波次奖励 + 首通奖励 + 毕业折算；去向 = 解锁新角色链 + 刷新/跳跃
- **进度保存**：localStorage 保存最高通关关数、金币、已解锁链；主菜单可「继续闯关」

## 版本历史
- v0.5.0：闯关模式 + 本地存档 + 首通奖励 + 失败重试本关
- v0.4.2：毕业链降权（3:1 加权池）
- v0.4.1：毕业链折算（停刷 → 折算，修复死锁）
- v0.3.1：毕业链停刷（已废弃，被折算替代）

## 部署与更新
- 部署方式：GitHub REST API 直传（沙盒中 git 协议通道不稳，api.github.com 稳定）
- 更新流程：改完代码 → 用 `C:\Users\35514\.workbuddy\tmp\gh_api_deploy.py` 重跑（逐文件上传 + Pages 自动重建）
- 或本地 `git push origin main`（origin 已配置，需有效凭据）
- Pages 构建约 30-60 秒，构建状态查仓库 Settings → Pages

## Follow-up
- 平衡观察：降权后格子压力回升，若难度偏高可回调权重比例或降敌人密度
- 数据留存：游戏进度存 localStorage，清缓存即重置
