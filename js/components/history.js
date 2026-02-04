/**
 * 履歴パネルコンポーネント
 */

class HistoryPanel {
  constructor(panelId, contentId, options = {}) {
    this.panel = document.getElementById(panelId);
    this.content = document.getElementById(contentId);
    this.storage = options.storage;
    this.onTopicSelect = options.onTopicSelect || (() => {});
    this.isOpen = false;
  }

  /**
   * パネルを開く
   */
  open() {
    this.render();
    this.panel.classList.add('open');
    this.isOpen = true;
  }

  /**
   * パネルを閉じる
   */
  close() {
    this.panel.classList.remove('open');
    this.isOpen = false;
  }

  /**
   * トグル
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * 履歴をレンダリング
   */
  render() {
    const history = this.storage.getHistory(100);

    if (history.length === 0) {
      this.content.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon">📚</span>
          <p class="empty-state__text">まだ閲覧履歴がありません</p>
        </div>
      `;
      return;
    }

    // 日付でグループ化
    const grouped = this._groupByDate(history);

    this.content.innerHTML = Object.entries(grouped).map(([date, items]) => `
      <section class="history-group">
        <h3 class="history-group__date">${date}</h3>
        <ul class="history-list">
          ${items.map(item => `
            <li class="history-item" data-topic-title="${Helpers.escapeHtml(item.topicTitle)}" data-topic-id="${item.topicId}">
              <span class="history-item__action">
                ${item.action === 'deep_dive' ? '🔍' : '🌐'}
              </span>
              <span class="history-item__title">${Helpers.escapeHtml(item.topicTitle)}</span>
              <span class="history-item__time">${Helpers.formatTime(item.timestamp)}</span>
              ${item.durationSeconds ? `
                <span class="history-item__duration">${Helpers.formatDuration(item.durationSeconds)}</span>
              ` : ''}
            </li>
          `).join('')}
        </ul>
      </section>
    `).join('');

    this._attachEventListeners();
  }

  /**
   * 日付でグループ化
   */
  _groupByDate(history) {
    const groups = {};

    history.forEach(item => {
      const dateLabel = Helpers.formatDate(item.timestamp);

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(item);
    });

    return groups;
  }

  /**
   * イベントリスナーを設定
   */
  _attachEventListeners() {
    this.content.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const topicTitle = item.dataset.topicTitle;
        const topicId = item.dataset.topicId;
        this.close();
        this.onTopicSelect(topicTitle, topicId);
      });
    });
  }
}
