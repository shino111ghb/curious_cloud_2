/**
 * ユーティリティ関数
 */

const Helpers = {
  /**
   * UUID生成
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * 配列をシャッフル
   */
  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  /**
   * デバウンス
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * スロットル
   */
  throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * 日付フォーマット
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (targetDate.getTime() === today.getTime()) {
      return '今日';
    } else if (targetDate.getTime() === yesterday.getTime()) {
      return '昨日';
    } else {
      return date.toLocaleDateString('ja-JP', {
        month: 'long',
        day: 'numeric'
      });
    }
  },

  /**
   * 時刻フォーマット
   */
  formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  /**
   * 滞在時間フォーマット
   */
  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}分`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}時間${remainingMinutes}分`;
  },

  /**
   * テキストを安全にHTMLに変換
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * ランダムな挨拶を取得
   */
  getRandomGreeting() {
    return CONFIG.GREETINGS[Math.floor(Math.random() * CONFIG.GREETINGS.length)];
  },

  /**
   * 要素が画面内に収まるよう位置を調整
   */
  clampPosition(x, y, elementWidth, elementHeight, containerWidth, containerHeight, padding = 20) {
    return {
      x: Math.max(padding, Math.min(x, containerWidth - elementWidth - padding)),
      y: Math.max(padding, Math.min(y, containerHeight - elementHeight - padding))
    };
  },

  /**
   * ゴールデンスパイラル配置の計算
   */
  calculateSpiralLayout(count, containerWidth, containerHeight, cardWidth = 180, cardHeight = 150) {
    const positions = [];
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 約137.5度
    const spacing = Math.min(containerWidth, containerHeight) / Math.sqrt(count) * 0.8;

    for (let i = 0; i < count; i++) {
      const angle = i * goldenAngle;
      const radius = spacing * Math.sqrt(i);

      let x = centerX + radius * Math.cos(angle) - cardWidth / 2;
      let y = centerY + radius * Math.sin(angle) - cardHeight / 2;

      // 画面内に収める
      const clamped = this.clampPosition(x, y, cardWidth, cardHeight, containerWidth, containerHeight);

      positions.push({
        x: clamped.x,
        y: clamped.y,
        floatOffset: Math.random() * Math.PI * 2,
        floatAmplitude: 3 + Math.random() * 5,
        floatDuration: 3 + Math.random() * 2
      });
    }

    return positions;
  },

  /**
   * 位置の重複を解消
   */
  resolveOverlaps(positions, cardWidth = 180, cardHeight = 150, iterations = 10) {
    const minDistance = Math.sqrt(cardWidth * cardWidth + cardHeight * cardHeight) * 0.6;

    for (let iter = 0; iter < iterations; iter++) {
      let hasOverlap = false;

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = positions[j].x - positions[i].x;
          const dy = positions[j].y - positions[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < minDistance && distance > 0) {
            hasOverlap = true;
            const overlap = (minDistance - distance) / 2;
            const angle = Math.atan2(dy, dx);

            positions[i].x -= Math.cos(angle) * overlap;
            positions[i].y -= Math.sin(angle) * overlap;
            positions[j].x += Math.cos(angle) * overlap;
            positions[j].y += Math.sin(angle) * overlap;
          }
        }
      }

      if (!hasOverlap) break;
    }

    return positions;
  },

  /**
   * 待機
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * 要素をスムーズにスクロール
   */
  scrollToTop(element = window) {
    element.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  },

  /**
   * トーストを表示
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__message">${this.escapeHtml(message)}</span>
      <button class="toast__close" aria-label="閉じる">×</button>
    `;

    container.appendChild(toast);

    // 閉じるボタン
    toast.querySelector('.toast__close').addEventListener('click', () => {
      toast.remove();
    });

    // 自動削除
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }
};
