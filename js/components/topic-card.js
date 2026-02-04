/**
 * トピックカードコンポーネント
 * サムネイル付き円形バブルデザイン
 */

class TopicCard {
  constructor(topic, options = {}) {
    this.topic = topic;
    this.position = options.position || { x: 0, y: 0 };
    this.onDeepDive = options.onDeepDive || (() => {});
    this.onExpand = options.onExpand || (() => {});
    this.onDragStart = options.onDragStart || (() => {});
    this.onDragEnd = options.onDragEnd || (() => {});
    this.onDragMove = options.onDragMove || (() => {});
    this.element = null;

    // ドラッグ関連
    this.isDragging = false;
    this.hasMoved = false;
    this.dragOffset = { x: 0, y: 0 };
    this.startPos = { x: 0, y: 0 };

    // 速度計算用
    this.lastPos = { x: 0, y: 0 };
    this.lastTime = 0;
    this.velocity = { x: 0, y: 0 };

    // イベントハンドラをバインド（後で削除できるように）
    this._boundHandleDragMove = this._handleDragMove.bind(this);
    this._boundHandleDragEnd = this._handleDragEnd.bind(this);
  }

  /**
   * カードをレンダリング
   */
  render() {
    const card = document.createElement('div');
    const hasThumbnail = this.topic.thumbnail;
    const sizeClass = `topic-card--${this.topic.popularitySize || 'medium'}`;
    card.className = `topic-card appearing ${sizeClass}${hasThumbnail ? '' : ' topic-card--no-thumbnail'}`;
    card.dataset.topicId = this.topic.id;

    // フローティングアニメーションの設定
    const pos = this.position;
    card.style.setProperty('--float-duration', `${pos.floatDuration || 4}s`);
    card.style.setProperty('--float-delay', `${Math.random() * 2}s`);
    card.style.left = `${pos.x}px`;
    card.style.top = `${pos.y}px`;

    // カテゴリ情報
    const categoryInfo = CONFIG.CATEGORIES[this.topic.category];
    const categoryLabel = categoryInfo ? categoryInfo.label : '';
    const categoryIcon = categoryInfo ? categoryInfo.icon : '📚';

    card.innerHTML = `
      <div class="topic-card__inner">
        ${hasThumbnail ? `
          <img class="topic-card__thumbnail" src="${this.topic.thumbnail}" alt="" loading="lazy">
          <div class="topic-card__overlay"></div>
        ` : `
          <div class="topic-card__placeholder">${categoryIcon}</div>
        `}
        <div class="topic-card__content">
          ${categoryLabel ? `<span class="topic-card__category">${categoryLabel}</span>` : ''}
          <h3 class="topic-card__title">${Helpers.escapeHtml(this.topic.title)}</h3>
        </div>
      </div>
      <div class="topic-card__actions">
        <button class="topic-card__btn topic-card__btn--deep" data-action="deep-dive">
          <span class="topic-card__btn-icon">📖</span>
          Dig
        </button>
        <button class="topic-card__btn topic-card__btn--expand" data-action="expand">
          <span class="topic-card__btn-icon">🌿</span>
          Spread
        </button>
      </div>
    `;

    // ドラッグイベントの設定
    this._setupDragEvents(card);

    // イベントリスナー
    // カード全体のクリック（タップ）で「深ぼる」
    card.addEventListener('click', (e) => {
      // ボタンクリックは除外
      if (e.target.closest('.topic-card__btn')) return;
      // ドラッグ後はクリック扱いにしない
      if (this.hasMoved) return;
      this.onDeepDive(this.topic);
    });

    card.querySelector('[data-action="deep-dive"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this._animateClick(e.currentTarget);
      this.onDeepDive(this.topic);
    });

    card.querySelector('[data-action="expand"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this._animateClick(e.currentTarget);
      this.onExpand(this.topic);
    });

    // 登場アニメーション後にクラスを削除
    setTimeout(() => {
      card.classList.remove('appearing');
    }, 500);

    this.element = card;
    return card;
  }

  /**
   * クリックアニメーション
   */
  _animateClick(button) {
    button.style.transform = 'scale(0.95)';
    setTimeout(() => {
      button.style.transform = '';
    }, 150);
  }

  /**
   * 位置を更新
   */
  updatePosition(x, y) {
    if (this.element) {
      this.element.style.left = `${x}px`;
      this.element.style.top = `${y}px`;
    }
  }

  /**
   * 要素を削除
   */
  destroy() {
    // ドラッグイベントをクリーンアップ
    document.removeEventListener('mousemove', this._boundHandleDragMove);
    document.removeEventListener('mouseup', this._boundHandleDragEnd);
    document.removeEventListener('touchmove', this._boundHandleDragMove);
    document.removeEventListener('touchend', this._boundHandleDragEnd);

    if (this.element && this.element.parentNode) {
      this.element.classList.add('fade-out');
      setTimeout(() => {
        if (this.element.parentNode) {
          this.element.remove();
        }
      }, 300);
    }
  }

  /**
   * ドラッグイベントの設定
   */
  _setupDragEvents(card) {
    // マウスイベント
    card.addEventListener('mousedown', (e) => this._handleDragStart(e));

    // タッチイベント
    card.addEventListener('touchstart', (e) => this._handleDragStart(e), { passive: false });
  }

  /**
   * ドラッグ開始
   */
  _handleDragStart(e) {
    // ボタンやアクションエリアのクリックは除外
    if (e.target.closest('.topic-card__btn') || e.target.closest('.topic-card__actions')) {
      return;
    }

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = this.element.getBoundingClientRect();

    this.isDragging = true;
    this.hasMoved = false;
    this.startPos = { x: clientX, y: clientY };
    this.dragOffset = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };

    // グローバルイベントを登録
    document.addEventListener('mousemove', this._boundHandleDragMove);
    document.addEventListener('mouseup', this._boundHandleDragEnd);
    document.addEventListener('touchmove', this._boundHandleDragMove, { passive: false });
    document.addEventListener('touchend', this._boundHandleDragEnd);
  }

  /**
   * ドラッグ中
   */
  _handleDragMove(e) {
    if (!this.isDragging) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // 5px以上移動したらドラッグ開始と判定
    const dx = clientX - this.startPos.x;
    const dy = clientY - this.startPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) {
      if (!this.hasMoved) {
        this.hasMoved = true;
        this.element.classList.add('dragging');
        this.onDragStart(this);
        // 速度計算の初期化
        this.lastPos = { x: clientX, y: clientY };
        this.lastTime = performance.now();
      }

      e.preventDefault();

      // コンテナの位置を考慮
      const container = this.element.parentElement;
      const containerRect = container.getBoundingClientRect();

      let newX = clientX - containerRect.left - this.dragOffset.x;
      let newY = clientY - containerRect.top - this.dragOffset.y;

      // 境界チェック
      const cardSize = this.element.offsetWidth;
      const padding = 10;
      newX = Math.max(padding, Math.min(newX, containerRect.width - cardSize - padding));
      newY = Math.max(padding, Math.min(newY, containerRect.height - cardSize - padding));

      this.element.style.left = `${newX}px`;
      this.element.style.top = `${newY}px`;

      // 位置を更新
      this.position.x = newX;
      this.position.y = newY;

      // 速度を計算（フリック用）
      const now = performance.now();
      const dt = (now - this.lastTime) / 1000;
      if (dt > 0) {
        this.velocity.x = (clientX - this.lastPos.x) / dt;
        this.velocity.y = (clientY - this.lastPos.y) / dt;
      }
      this.lastPos = { x: clientX, y: clientY };
      this.lastTime = now;

      // ドラッグ中を通知
      this.onDragMove(this);
    }
  }

  /**
   * ドラッグ終了
   */
  _handleDragEnd(e) {
    if (!this.isDragging) return;

    // グローバルイベントを削除
    document.removeEventListener('mousemove', this._boundHandleDragMove);
    document.removeEventListener('mouseup', this._boundHandleDragEnd);
    document.removeEventListener('touchmove', this._boundHandleDragMove);
    document.removeEventListener('touchend', this._boundHandleDragEnd);

    this.isDragging = false;

    if (this.hasMoved) {
      this.element.classList.remove('dragging');

      // 速度を渡してドラッグ終了を通知
      this.onDragEnd(this, { x: this.velocity.x, y: this.velocity.y });

      // 速度をリセット
      this.velocity = { x: 0, y: 0 };

      // クリックイベントの発火を防ぐために少し遅延
      setTimeout(() => {
        this.hasMoved = false;
      }, 100);
    }
  }
}
