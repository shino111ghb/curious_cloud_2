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
  }

  /**
   * トピックをレンダリング
   */
  async render(topics) {
    if (this.isAnimating) return;
    this.isAnimating = true;

    // 既存のカードをクリア
    this.clear();

    this.topics = topics;

    // ページビュー数を取得して人気度サイズを設定
    try {
      const titles = topics.map(t => t.title);
      const pageviewsMap = await WikipediaAPI.getBatchPageviews(titles);

      topics.forEach(topic => {
        const views = pageviewsMap.get(topic.title) || 0;
        topic.pageviews = views;
        topic.popularitySize = WikipediaAPI.getPopularitySize(views);
      });
    } catch (error) {
      console.warn('Failed to fetch pageviews, using default size:', error);
      // フォールバック: ランダムにサイズを割り当て（視覚的多様性のため）
      topics.forEach(topic => {
        const rand = Math.random();
        topic.popularitySize = rand < 0.2 ? 'large' : (rand < 0.5 ? 'medium' : 'small');
      });
    }

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

    // カードを順次作成
    topics.forEach((topic, index) => {
      setTimeout(() => {
        const card = new TopicCard(topic, {
          position: this.positions[index],
          onDeepDive: this.onDeepDive,
          onExpand: this.onExpand,
          onDragStart: (card) => this._handleCardDragStart(card),
          onDragEnd: (card) => this._handleCardDragEnd(card)
        });

        this.cards.push(card);
        this.container.appendChild(card.render());

        // 最後のカードが追加されたらアニメーション完了
        if (index === topics.length - 1) {
          this.isAnimating = false;
        }
      }, index * 50); // 50ms間隔で順次表示
    });
  }

  /**
   * カードのドラッグ開始ハンドラ
   */
  _handleCardDragStart(card) {
    this.draggingCard = card;
    // ドラッグ中のカードを最前面に
    card.element.style.zIndex = 100;
  }

  /**
   * カードのドラッグ終了ハンドラ
   */
  _handleCardDragEnd(card) {
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
  }

  /**
   * リサイズ時の再配置
   */
  handleResize() {
    if (this.topics.length === 0) return;

    const rect = this.container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
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
      }
    });
  }

  /**
   * 破棄
   */
  destroy() {
    this.clear();
  }
}
