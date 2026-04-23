/**
 * 點畫 - Dot Draw
 * Main Application Logic
 */

import { GameEngine } from './engine.js';

// --- 關卡數據 ---
const LEVELS = [
    { id: 1, title: '船長皮卡丘', image: 'assets/level1.png', points: 150 },
    { id: 2, title: '第二關', image: 'assets/level2.png', points: 150 },
    { id: 3, title: '第三關', image: 'assets/level3.png', points: 150 },
];

class App {
    constructor() {
        this.screens = {
            lobby: document.getElementById('lobby'),
            levelSelect: document.getElementById('level-select'),
            game: document.getElementById('game-main')
        };
        
        this.sidebar = document.getElementById('sidebar');
        this.levelSlider = document.getElementById('level-slider');
        this.currentScreen = 'lobby';
        this.engine = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderLevels();
    }

    bindEvents() {
        // 大廳事件
        document.getElementById('start-game').addEventListener('click', () => this.switchScreen('levelSelect'));
        document.getElementById('open-sidebar').addEventListener('click', () => this.toggleSidebar(true));
        document.getElementById('close-sidebar').addEventListener('click', () => this.toggleSidebar(false));
        
        // 關卡選擇事件
        document.getElementById('back-to-lobby').addEventListener('click', () => this.switchScreen('lobby'));
        
        // 遊戲事件
        document.getElementById('exit-game').addEventListener('click', () => {
            if(confirm('確定要離開遊戲嗎？')) {
                if (this.engine) this.engine.isRunning = false;
                this.switchScreen('levelSelect');
            }
        });

        // 側邊欄點擊背景關閉
        document.addEventListener('click', (e) => {
            if (this.sidebar.classList.contains('open') && 
                !this.sidebar.contains(e.target) && 
                !document.getElementById('open-sidebar').contains(e.target)) {
                this.toggleSidebar(false);
            }
        });
    }

    toggleSidebar(open) {
        this.sidebar.classList.toggle('open', open);
    }

    switchScreen(screenName) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.screens[screenName].classList.add('active');
        this.currentScreen = screenName;
    }

    renderLevels() {
        this.levelSlider.innerHTML = '';
        LEVELS.forEach(level => {
            const card = document.createElement('div');
            card.className = `level-card ${level.locked ? 'locked' : ''}`;
            card.innerHTML = `
                <span class="level-num">${level.id.toString().padStart(2, '0')}</span>
                ${level.image ? `<img src="${level.image}" class="level-thumb" alt="${level.title}">` : '<div class="locked-icon">🔒</div>'}
                <h4 class="level-title">${level.title}</h4>
            `;
            
            if (!level.locked) {
                card.addEventListener('click', () => this.startLevel(level));
            }
            this.levelSlider.appendChild(card);
        });
    }

    async startLevel(level) {
        console.log('Starting level:', level.title);
        this.switchScreen('game');
        
        if (!this.engine) {
            const canvas = document.getElementById('game-canvas');
            this.engine = new GameEngine(canvas, () => this.showWin(level));
        }
        
        await this.engine.loadLevel(level);
        this.startTimer();
    }

    showWin(level) {
        // 停止計時
        if (this.gameTimer) clearInterval(this.gameTimer);

        // 建立勝利覆蓋層
        const overlay = document.createElement('div');
        overlay.id = 'win-overlay';
        overlay.innerHTML = `
            <div class="win-box">
                <div class="win-sparkle">✨</div>
                <h2 class="win-title">完成！</h2>
                <p class="win-sub">${level.title}</p>
                <div class="win-time">用時 ${document.getElementById('game-timer').textContent}</div>
                <div class="win-buttons">
                    <button id="win-back" class="win-btn">返回關卡</button>
                </div>
            </div>
        `;
        document.getElementById('game-main').appendChild(overlay);

        // 短暫顯示後加入動畫 class
        requestAnimationFrame(() => overlay.classList.add('visible'));

        document.getElementById('win-back').addEventListener('click', () => {
            overlay.remove();
            if (this.engine) this.engine.isRunning = false;
            this.switchScreen('levelSelect');
        });
    }

    startTimer() {
        let seconds = 0;
        const timerEl = document.getElementById('game-timer');
        if (this.gameTimer) clearInterval(this.gameTimer);
        this.gameTimer = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
        }, 1000);
    }
}

// 啟動應用
window.addEventListener('DOMContentLoaded', () => {
    new App();
});
