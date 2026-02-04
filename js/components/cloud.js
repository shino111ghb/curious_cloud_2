/**
 * クラウドビューコンポーネント
 */

class CloudView {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.loadingEl = document.getElementById(options.loadingId || 'cloud-loading');
    this.topics = [];
    this.cards = [];
    this.positions = [];
    this.onDeepDive = options.onDeepDive || (() => {});
    this.onExpand = options.onExpand || (() => {});
    this.isAnimating = false;
    this.draggingCard = null;

    // 物理エンジン
    this.physics = null;
  }

  /**
   * 物理エンジンを初期化または更新
   */
  _initPhysics() {
    const rect = this.container.getBoundingClientRect();
    if (!this.physics) {
      this.physics = new PhysicsSimulation(rect.width, rect.height);
      this.physics.start();
    } else {
      this.physics.updateContainerSize(rect.width, rect.height);
    }
  }

  /**
   * トピックをレンダリング
   */
  async render(topics) {
    if (this.isAnimating) return;
    this.isAnimating = true;

    // 既存のカードをクリア
    this.clear();

    // 物理エンジンを初期化/更新
    this._initPhysics();

    this.topics = topics;

    // ランダムにサイズを割り当て（視覚的多様性のため）
    // small: 35%, medium: 45%, large: 20%
    topics.forEach(topic => {
      const rand = Math.random();
      if (rand < 0.20) {
        topic.popularitySize = 'large';
      } else if (rand < 0.65) {
        topic.popularitySize = 'medium';
      } else {
        topic.popularitySize = 'small';
      }
    });

    // コンテナのサイズを取得
    const rect = this.container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // カードサイズ（レスポンシブ対応）
    const cardSize = this._getCardSize();

    // 位置を計算
    this.positions = Helpers.calculateSpiralLayout(
      topics.length,
      containerWidth,
      containerHeight,
      cardSize,
      cardSize
    );

    // 重複を解消
    this.positions = Helpers.resolveOverlaps(this.positions, cardSize, cardSize);

    // カードを一括作成（DocumentFragmentでバッチ化）
    const fragment = document.createDocumentFragment();

    topics.forEach((topic, index) => {
      const card = new TopicCard(topic, {
        position: this.positions[index],
        onDeepDive: this.onDeepDive,
        onExpand: this.onExpand,
        onDragStart: (card) => this._handleCardDragStart(card),
        onDragEnd: (card, velocity) => this._handleCardDragEnd(card, velocity),
        onDragMove: (card) => this._handleCardDragMove(card)
      });

      this.cards.push(card);
      const cardEl = card.render();
      fragment.appendChild(cardEl);

      // 物理エンジンにボディを追加
      if (this.physics) {
        const actualCardSize = this._getCardSizeForPopularity(topic.popularitySize);
        const centerX = this.positions[index].x + actualCardSize / 2;
        const centerY = this.positions[index].y + actualCardSize / 2;
        this.physics.addBody(cardEl, centerX, centerY, actualCardSize / 2);
      }
    });

    // 一括でDOMに追加
    this.container.appendChild(fragment);
    this.isAnimating = false;
  }

  /**
   * カードのドラッグ開始ハンドラ
   */
  _handleCardDragStart(card) {
    this.draggingCard = card;
    // ドラッグ中のカードを最前面に
    card.element.style.zIndex = 100;
    // 物理エンジンにドラッグ状態を通知
    if (this.physics) {
      this.physics.setDragging(card.element, true);
    }
  }

  /**
   * カードのドラッグ中ハンドラ
   */
  _handleCardDragMove(card) {
    // 物理エンジンに位置を通知
    if (this.physics) {
      const cardSize = this._getCardSizeForPopularity(card.topic.popularitySize);
      const centerX = card.position.x + cardSize / 2;
      const centerY = card.position.y + cardSize / 2;
      this.physics.setPosition(card.element, centerX, centerY);
    }
  }

  /**
   * カードのドラッグ終了ハンドラ
   */
  _handleCardDragEnd(card, velocity = { x: 0, y: 0 }) {
    this.draggingCard = null;
    card.element.style.zIndex = '';

    // 位置を保持（positions配列を更新）
    const cardIndex = this.cards.indexOf(card);
    if (cardIndex !== -1) {
      this.positions[cardIndex] = {
        ...this.positions[cardIndex],
        x: card.position.x,
        y: card.position.y
      };
    }

    // 物理エンジンにドラッグ終了と速度を通知
    if (this.physics) {
      this.physics.setDragging(card.element, false);
      // フリック速度を適用（勢いを与える）
      if (Math.abs(velocity.x) > 50 || Math.abs(velocity.y) > 50) {
        this.physics.setVelocity(card.element, velocity.x * 2, velocity.y * 2);
      }
    }
  }

  /**
   * カードサイズを取得（基準サイズ = medium）
   */
  _getCardSize() {
    if (window.innerWidth < 768) return 90;
    if (window.innerWidth < 1024) return 110;
    return 130;
  }

  /**
   * 人気度サイズに応じたカードサイズを取得
   */
  _getCardSizeForPopularity(popularitySize) {
    const base = this._getCardSize();
    const multipliers = {
      small: 0.77,   // 小さめ
      medium: 1.0,   // 基準
      large: 1.27    // 大きめ
    };
    return base * (multipliers[popularitySize] || 1.0);
  }

  /**
   * 特定のトピックの周りに関連クラウドを追加
   */
  addRelatedClouds(sourceTopic, relatedTopics) {
    // ソースカードを探す
    const sourceCardIndex = this.cards.findIndex(
      card => card.topic.id === sourceTopic.id || card.topic.title === sourceTopic.title
    );

    if (sourceCardIndex === -1) {
      console.warn('Source card not found');
      return;
    }

    const sourceCard = this.cards[sourceCardIndex];
    const sourcePos = this.positions[sourceCardIndex];
    const cardSize = this._getCardSize();

    // 関連クラウドの配置位置を計算（ソースの周りに円形配置）
    const radius = cardSize * 1.3; // ソースからの距離
    const relatedPositions = this._calculateSurroundingPositions(
      sourcePos,
      relatedTopics.length,
      radius,
      cardSize
    );

    // 関連カードを追加
    relatedTopics.forEach((topic, index) => {
      // 既に同じトピックがあればスキップ
      if (this.topics.some(t => t.id === topic.id || t.title === topic.title)) {
        return;
      }

      setTimeout(() => {
        const position = relatedPositions[index];
        if (!position) return;

        const card = new TopicCard(topic, {
          position: position,
          onDeepDive: this.onDeepDive,
          onExpand: this.onExpand,
          onDragStart: (card) => this._handleCardDragStart(card),
          onDragEnd: (card) => this._handleCardDragEnd(card)
        });

        this.cards.push(card);
        this.topics.push(topic);
        this.positions.push(position);

        const cardEl = card.render();
        cardEl.classList.add('related-cloud');
        this.container.appendChild(cardEl);
      }, index * 100);
    });

    // ソースカードを強調
    if (sourceCard.element) {
      sourceCard.element.classList.add('source-cloud');
      setTimeout(() => {
        sourceCard.element.classList.remove('source-cloud');
      }, 2000);
    }
  }

  /**
   * ソースの周りの位置を計算
   */
  _calculateSurroundingPositions(sourcePos, count, radius, cardSize) {
    const positions = [];
    const rect = this.container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // 開始角度をランダムに
    const startAngle = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const angle = startAngle + (i * (Math.PI * 2) / count);
      let x = sourcePos.x + Math.cos(angle) * radius;
      let y = sourcePos.y + Math.sin(angle) * radius;

      // 画面内に収める
      const padding = 20;
      x = Math.max(padding, Math.min(containerWidth - cardSize - padding, x));
      y = Math.max(padding, Math.min(containerHeight - cardSize - padding, y));

      positions.push({
        x,
        y,
        floatDuration: 3 + Math.random() * 2
      });
    }

    return positions;
  }

  /**
   * ローディング表示
   */
  showLoading() {
    if (this.loadingEl) {
      this.loadingEl.classList.add('visible');
    }
  }

  /**
   * ローディング非表示
   */
  hideLoading() {
    if (this.loadingEl) {
      this.loadingEl.classList.remove('visible');
    }
  }

  /**
   * クラウドをクリア
   */
  clear() {
    this.cards.forEach(card => card.destroy());
    this.cards = [];
    this.topics = [];
    this.positions = [];
    // 物理エンジンもクリア
    if (this.physics) {
      this.physics.clear();
    }
  }

  /**
   * リサイズ時の再配置
   */
  handleResize() {
    const rect = this.container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // 物理エンジンのコンテナサイズを更新
    if (this.physics) {
      this.physics.updateContainerSize(containerWidth, containerHeight);
    }

    if (this.topics.length === 0) return;

    const cardSize = this._getCardSize();

    // 位置を再計算
    this.positions = Helpers.calculateSpiralLayout(
      this.topics.length,
      containerWidth,
      containerHeight,
      cardSize,
      cardSize
    );

    this.positions = Helpers.resolveOverlaps(this.positions, cardSize, cardSize);

    // カードの位置を更新
    this.cards.forEach((card, index) => {
      if (this.positions[index]) {
        card.updatePosition(this.positions[index].x, this.positions[index].y);
        // 物理エンジンの位置も更新
        const actualCardSize = this._getCardSizeForPopularity(card.topic.popularitySize);
        const centerX = this.positions[index].x + actualCardSize / 2;
        const centerY = this.positions[index].y + actualCardSize / 2;
        this.physics.setPosition(card.element, centerX, centerY);
      }
    });
  }

  /**
   * 破棄
   */
  destroy() {
    this.clear();
    if (this.physics) {
      this.physics.stop();
      this.physics = null;
    }
  }
}
