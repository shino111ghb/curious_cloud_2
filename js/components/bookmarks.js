/**
 * ブックマークパネルコンポーネント
 */

class BookmarksPanel {
  constructor(panelId, contentId, options = {}) {
    this.panel = document.getElementById(panelId);
    this.content = document.getElementById(contentId);
    this.storage = options.storage;
    this.onTopicSelect = options.onTopicSelect || (() => {});
    this.onRemove = options.onRemove || (() => {});
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
   * ブックマークをレンダリング
   */
  render() {
    const bookmarksByCategory = this.storage.getBookmarksByCategory();
    const categories = Object.keys(bookmarksByCategory);

    if (categories.length === 0) {
      this.content.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon">⭐</span>
          <p class="empty-state__text">まだブックマークがありません</p>
          <p class="empty-state__text" style="font-size: 13px; margin-top: 8px;">
            気になるトピックを保存してみましょう
          </p>
        </div>
      `;
      return;
    }

    // カテゴリ順でソート
    const sortedCategories = categories.sort((a, b) => {
      const aInfo = CONFIG.CATEGORIES[a];
      const bInfo = CONFIG.CATEGORIES[b];
      if (!aInfo) return 1;
      if (!bInfo) return -1;
      return aInfo.label.localeCompare(bInfo.label);
    });

    this.content.innerHTML = sortedCategories.map(category => {
      const bookmarks = bookmarksByCategory[category];
      const categoryInfo = CONFIG.CATEGORIES[category];

      return `
        <section class="bookmark-category">
          <h3 class="bookmark-category__title">
            <span class="bookmark-category__icon">${categoryInfo?.icon || '📌'}</span>
            ${categoryInfo?.label || 'その他'}
            <span style="font-weight: normal; color: var(--text-muted);">(${bookmarks.length})</span>
          </h3>
          <ul class="bookmark-list">
            ${bookmarks.map(bookmark => `
              <li class="bookmark-item" data-topic-title="${Helpers.escapeHtml(bookmark.topicTitle)}" data-topic-id="${bookmark.topicId}">
                <span class="bookmark-item__title">${Helpers.escapeHtml(bookmark.topicTitle)}</span>
                <button class="bookmark-item__remove" data-action="remove" data-topic-id="${bookmark.topicId}" title="削除">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </li>
            `).join('')}
          </ul>
        </section>
      `;
    }).join('');

    this._attachEventListeners();
  }

  /**
   * イベントリスナーを設定
   */
  _attachEventListeners() {
    // トピック選択
    this.content.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // 削除ボタンのクリックは除外
        if (e.target.closest('[data-action="remove"]')) return;

        const topicTitle = item.dataset.topicTitle;
        const topicId = item.dataset.topicId;
        this.close();
        this.onTopicSelect(topicTitle, topicId);
      });
    });

    // 削除ボタン
    this.content.querySelectorAll('[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const topicId = parseInt(btn.dataset.topicId);
        this._handleRemove(topicId, btn.closest('.bookmark-item'));
      });
    });
  }

  /**
   * ブックマーク削除の処理
   */
  _handleRemove(topicId, itemElement) {
    // アニメーション
    itemElement.style.opacity = '0';
    itemElement.style.transform = 'translateX(20px)';
    itemElement.style.transition = 'all 0.3s ease';

    setTimeout(() => {
      this.storage.removeBookmark(topicId);
      this.onRemove(topicId);
      this.render(); // 再レンダリング
      Helpers.showToast('ブックマークを削除しました', 'info');
    }, 300);
  }

  /**
   * ブックマーク数を取得
   */
  getCount() {
    return this.storage.getBookmarks().length;
  }
}
