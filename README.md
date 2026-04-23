# 點畫 - Dot Draw

一個基於 WebGL 的物理益智遊戲，結合了布料物理與水晶光影美學。

## 🎮 遊戲特色
- **高級視覺**：施華洛世奇水晶質感的動態光點。
- **真實物理**：流暢的布料模擬手感。
- **簡約風格**：優雅的磨砂牆面與線條設計。
- **跨平台**：支援電腦滑鼠與手機觸控。

## 🚀 部署到 GitHub Pages
1. 將本專案所有檔案上傳至 GitHub Repository。
2. 進入 `Settings` > `Pages`。
3. 將 `Branch` 設為 `main` 並儲存。
4. 稍等片刻即可透過 GitHub 提供的網址遊玩。

## 💻 本地開發與測試
由於瀏覽器對 ES Modules 的安全性限制，直接雙擊 `index.html` 會無法運作。
請使用以下方式之一執行：
- **Python**: 執行 `python local_server.py` 後打開 `http://localhost:8000`。
- **VS Code**: 使用 `Live Server` 插件。
- **Node.js**: 執行 `npx serve .`。
