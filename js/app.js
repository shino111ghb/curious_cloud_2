/**
 * Curious Cloud - メインアプリケーション
 */

class App {
  constructor() {
    this.currentView = null;
    this.views = {};
    this.panels = {};
    this.navigationStack = [];

    // サービス
    this.storage = new StorageService();
    this.interest = new InterestService(this.storage);
    this.topicGenerator = new TopicGenerator(this.storage, this.interest);
    this.explorationStats = explorationStats; // シングルトン

    // コンポーネント
    this.cloudView = null;
    this.expandView = null;
    this.articleView = null;
    this.onboarding = null;
    this.historyPanel = null;
    this.bookmarksPanel = null;
    this.achievementsPanel = null;

    // 状態
    this.currentHistoryEntryId = null;
  }

  /**
   * アプリケーションを初期化
   */
  async init() {
    // グローバルエラーハンドラーを設定
    ErrorHandler.setupGlobalHandlers();

    // コンポーネントを初期化
    this._initComponents();

    // イベントリスナーを設定
    this._setupEventListeners();

    // レベルバッジを更新
    this._updateLevelBadge();

    // デイリーログインをチェック
    this._checkDailyVisit();

    // 初回起動チェック
    if (!this.storage.hasProfile()) {
      this._showOnboarding();
    } else {
      await this._showCloudView();
    }

    console.log('Curious Cloud initialized');
  }

  /**
   * コンポーネントを初期化
   */
  _initComponents() {
    // クラウドビュー
    this.cloudView = new CloudView('cloud-container', {
      loadingId: 'cloud-loading',
      onDeepDive: (topic) => this._handleDeepDive(topic),
      onExpand: (topic) => this._handleExpand(topic)
    });

    // 広げるビュー
    this.expandView = new CloudView('expand-container', {
      loadingId: 'expand-loading',
      onDeepDive: (topic) => this._handleDeepDive(topic),
      onExpand: (topic) => this._handleExpand(topic)
    });

    // 記事ビュー
    this.articleView = new ArticleView('article-container', {
      storage: this.storage,
      onBack: () => this._handleArticleBack(),
      onTopicClick: (title) => this._handleDeepDive({ title }),
      onBookmarkToggle: (topic, isBookmarked) => {
        if (isBookmarked) {
          this.interest.updateFromAction('bookmark', topic);
          // ポイントを獲得（ブックマーク）
          const bookmarkResult = this.explorationStats.recordBookmark();
          this._handleStatsResult(bookmarkResult);
        }
      }
    });

    // オンボーディング
    this.onboarding = new OnboardingView({
      storage: this.storage,
      onComplete: (profile, interests) => this._handleOnboardingComplete(profile, interests)
    });

    // 履歴パネル
    this.historyPanel = new HistoryPanel('history-panel', 'history-content', {
      storage: this.storage,
      onTopicSelect: (title, id) => this._handleDeepDive({ title, id })
    });

    // ブックマークパネル
    this.bookmarksPanel = new BookmarksPanel('bookmarks-panel', 'bookmarks-content', {
      storage: this.storage,
      onTopicSelect: (title, id) => this._handleDeepDive({ title, id }),
      onRemove: () => {} // 特に処理なし
    });

    // アチーブメントパネル
    this._initAchievementsPanel();
  }

  /**
   * アチーブメントパネルを初期化
   */
  _initAchievementsPanel() {
    const panel = document.getElementById('achievements-panel');
    const closeBtn = panel?.querySelector('[data-action="close-panel"]');

    closeBtn?.addEventListener('click', () => {
      this._closeAchievementsPanel();
    });
  }

  /**
   * イベントリスナーを設定
   */
  _setupEventListeners() {
    // ヘッダーナビゲーション
    document.querySelector('[data-action="history"]')?.addEventListener('click', () => {
      this._togglePanel('history');
    });

    document.querySelector('[data-action="bookmarks"]')?.addEventListener('click', () => {
      this._togglePanel('bookmarks');
    });

    document.querySelector('[data-action="achievements"]')?.addEventListener('click', () => {
      this._togglePanel('achievements');
    });

    // レベルバッジクリックでアチーブメントパネルを開く
    document.getElementById('level-badge')?.addEventListener('click', () => {
      this._togglePanel('achievements');
    });

    // パネルを閉じるボタン
    document.querySelectorAll('[data-action="close-panel"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._closeAllPanels();
      });
    });

    // オーバーレイクリック
    document.getElementById('overlay')?.addEventListener('click', () => {
      this._closeAllPanels();
    });

    // リフレッシュボタン
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      this._refreshTopics();
    });

    // 広げるビューの戻るボタン
    document.getElementById('expand-back-btn')?.addEventListener('click', () => {
      this._handleExpandBack();
    });

    // リサイズ対応
    window.addEventListener('resize', Helpers.debounce(() => {
      if (this.currentView === 'cloud') {
        this.cloudView.handleResize();
      } else if (this.currentView === 'expand') {
        this.expandView.handleResize();
      }
    }, 250));

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      // Escapeでパネルを閉じる
      if (e.key === 'Escape') {
        this._closeAllPanels();
      }
    });
  }

  /**
   * オンボーディングを表示
   */
  _showOnboarding() {
    this._hideAllViews();
    this.onboarding.show();
    this.currentView = 'onboarding';
  }

  /**
   * オンボーディング完了
   */
  async _handleOnboardingComplete(profile, interests) {
    this.onboarding.hide();
    await this._showCloudView(interests);
  }

  /**
   * クラウドビューを表示
   */
  async _showCloudView(initialInterests = null) {
    this._hideAllViews();
    document.getElementById('cloud-view').classList.add('active');
    this.currentView = 'cloud';

    // 挨拶を更新
    document.getElementById('greeting-text').textContent = Helpers.getRandomGreeting();

    // トピックを取得して表示
    this.cloudView.showLoading();

    try {
      let topics;

      if (initialInterests) {
        // 初回は選択した興味に基づいてトピックを生成
        topics = await this.topicGenerator.generateInitialTopics(initialInterests);
      } else if (!navigator.onLine) {
        // オフラインの場合はキャッシュから
        topics = this.topicGenerator.getOfflineTopics();
        if (topics.length === 0) {
          throw new Error('オフラインで表示できるトピックがありません');
        }
      } else {
        // 通常はパーソナライズされたトピックを生成
        topics = await this.topicGenerator.generatePersonalizedTopics();
      }

      this.cloudView.hideLoading();
      this.cloudView.render(topics);
    } catch (error) {
      console.error('トピック取得エラー:', error);
      this.cloudView.hideLoading();
      ErrorHandler.showError(ErrorHandler.getErrorType(error));
    }
  }

  /**
   * 記事ビューを表示（深ぼる）
   */
  async _handleDeepDive(topic) {
    // 履歴に追加
    const historyEntry = {
      topicTitle: topic.title,
      topicId: topic.id,
      action: 'deep_dive',
      category: topic.category
    };
    this.storage.addToHistory(historyEntry);

    // 最新の履歴エントリIDを取得
    const history = this.storage.getHistory(1);
    this.currentHistoryEntryId = history[0]?.id;

    // スコア更新
    this.interest.updateFromAction('deep_dive', topic);

    // ビューを切り替え
    this._hideAllViews();
    document.getElementById('article-view').classList.add('active');
    this.currentView = 'article';

    // ナビゲーションスタックに追加
    this.navigationStack.push({
      view: this._getPreviousView(),
      topic: topic
    });

    // 記事を表示
    await this.articleView.render(topic.title, topic.id);
    this.articleView.setHistoryEntryId(this.currentHistoryEntryId);

    // ポイントを獲得（記事閲覧）
    const category = topic.category || 'general';
    const result = this.explorationStats.recordArticleRead(category);
    this._handleStatsResult(result);

    // スクロールをトップに
    Helpers.scrollToTop();
  }

  /**
   * 関連クラウドを同じ画面に追加（Spread）
   */
  async _handleExpand(topic) {
    // 履歴に追加
    const historyEntry = {
      topicTitle: topic.title,
      topicId: topic.id,
      action: 'expand',
      category: topic.category
    };
    this.storage.addToHistory(historyEntry);

    // スコア更新
    this.interest.updateFromAction('expand', topic);

    // ポイントを獲得（広げる）
    const expandResult = this.explorationStats.recordExpand();
    this._handleStatsResult(expandResult);

    // 関連トピックを取得して同じ画面に追加
    try {
      const relatedTopics = await WikipediaAPI.getRelatedTopics(topic.title, CONFIG.RELATED_TOPICS_LIMIT);

      // 現在のビューに関連クラウドを追加
      if (this.currentView === 'cloud') {
        this.cloudView.addRelatedClouds(topic, relatedTopics);
      }
    } catch (error) {
      console.error('関連トピック取得エラー:', error);
      ErrorHandler.showError('api');
    }
  }

  /**
   * 記事から戻る
   */
  _handleArticleBack() {
    // 滞在時間を記録
    if (this.currentHistoryEntryId) {
      const duration = this.articleView.getDuration();
      this.storage.updateHistoryEntry(this.currentHistoryEntryId, {
        durationSeconds: duration
      });

      // 長時間閲覧のボーナス
      if (duration > 120) {
        const topic = this.articleView.getCurrentTopic();
        if (topic) {
          this.interest.updateFromAction('long_read', topic, duration);
          // ポイントを獲得（長時間閲覧）
          const longReadResult = this.explorationStats.recordLongRead();
          this._handleStatsResult(longReadResult);
        }
      }
    }

    this.articleView.clear();
    this._navigateBack();
  }

  /**
   * 広げるビューから戻る
   */
  _handleExpandBack() {
    this.expandView.clear();
    this._navigateBack();
  }

  /**
   * 戻るナビゲーション
   */
  _navigateBack() {
    if (this.navigationStack.length > 0) {
      this.navigationStack.pop();
    }

    if (this.navigationStack.length > 0) {
      const prev = this.navigationStack[this.navigationStack.length - 1];

      if (prev.view === 'expand') {
        this._hideAllViews();
        document.getElementById('expand-view').classList.add('active');
        this.currentView = 'expand';
      } else if (prev.view === 'article') {
        this._hideAllViews();
        document.getElementById('article-view').classList.add('active');
        this.currentView = 'article';
      } else {
        this._showCloudView();
      }
    } else {
      this._showCloudView();
    }
  }

  /**
   * トピックをリフレッシュ
   */
  async _refreshTopics() {
    const btn = document.getElementById('refresh-btn');
    btn.disabled = true;

    this.cloudView.clear();
    this.cloudView.showLoading();

    try {
      const topics = await this.topicGenerator.generatePersonalizedTopics();
      this.cloudView.hideLoading();
      this.cloudView.render(topics);

      // 挨拶を更新
      document.getElementById('greeting-text').textContent = Helpers.getRandomGreeting();
    } catch (error) {
      console.error('トピックリフレッシュエラー:', error);
      this.cloudView.hideLoading();
      ErrorHandler.showError('api');
    } finally {
      btn.disabled = false;
    }
  }

  /**
   * パネルをトグル
   */
  _togglePanel(panelName) {
    const overlay = document.getElementById('overlay');
    const achievementsPanel = document.getElementById('achievements-panel');

    if (panelName === 'history') {
      achievementsPanel?.classList.remove('open');
      if (this.historyPanel.isOpen) {
        this.historyPanel.close();
        overlay.classList.remove('visible');
      } else {
        this.bookmarksPanel.close();
        this.historyPanel.open();
        overlay.classList.add('visible');
      }
    } else if (panelName === 'bookmarks') {
      achievementsPanel?.classList.remove('open');
      if (this.bookmarksPanel.isOpen) {
        this.bookmarksPanel.close();
        overlay.classList.remove('visible');
      } else {
        this.historyPanel.close();
        this.bookmarksPanel.open();
        overlay.classList.add('visible');
      }
    } else if (panelName === 'achievements') {
      this.historyPanel.close();
      this.bookmarksPanel.close();
      if (achievementsPanel?.classList.contains('open')) {
        achievementsPanel.classList.remove('open');
        overlay.classList.remove('visible');
      } else {
        this._updateAchievementsPanel();
        achievementsPanel?.classList.add('open');
        overlay.classList.add('visible');
      }
    }
  }

  /**
   * すべてのパネルを閉じる
   */
  _closeAllPanels() {
    this.historyPanel.close();
    this.bookmarksPanel.close();
    document.getElementById('achievements-panel')?.classList.remove('open');
    document.getElementById('overlay').classList.remove('visible');
  }

  /**
   * すべてのビューを非表示
   */
  _hideAllViews() {
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });
  }

  /**
   * 前のビューを取得
   */
  _getPreviousView() {
    return this.currentView;
  }

  // ========================================
  // ポイント・レベル・アチーブメント関連
  // ========================================

  /**
   * デイリーログインをチェック
   */
  _checkDailyVisit() {
    const result = this.explorationStats.recordDailyVisit();

    if (!result.alreadyVisited && result.currentStreak > 1) {
      // 連続ログインを通知
      setTimeout(() => {
        this._showPointsNotification(`${result.currentStreak}日連続ログイン！`, 5);
      }, 1000);
    }

    // 新規アチーブメントがあれば表示
    if (result.newAchievements?.length > 0) {
      setTimeout(() => {
        this._showAchievementNotifications(result.newAchievements);
      }, 1500);
    }
  }

  /**
   * 統計結果を処理
   */
  _handleStatsResult(result) {
    // レベルバッジを更新
    this._updateLevelBadge();

    // ポイント獲得通知
    if (result.results) {
      const totalPoints = result.results.reduce((sum, r) => sum + (r.pointsAdded || 0), 0);
      if (totalPoints > 0) {
        this._showPointsNotification(`+${totalPoints}pt`, totalPoints);
      }

      // レベルアップチェック
      for (const r of result.results) {
        if (r.leveledUp) {
          setTimeout(() => {
            this._showLevelUpNotification(r.newLevel);
          }, 500);
          break;
        }
      }
    } else if (result.result?.pointsAdded) {
      this._showPointsNotification(`+${result.result.pointsAdded}pt`, result.result.pointsAdded);

      if (result.result.leveledUp) {
        setTimeout(() => {
          this._showLevelUpNotification(result.result.newLevel);
        }, 500);
      }
    }

    // 新規アチーブメント通知
    if (result.newAchievements?.length > 0) {
      setTimeout(() => {
        this._showAchievementNotifications(result.newAchievements);
      }, 800);
    }
  }

  /**
   * レベルバッジを更新
   */
  _updateLevelBadge() {
    const level = this.explorationStats.getLevel();
    const stats = this.explorationStats.getStats();

    // ヘッダーバッジ
    document.getElementById('level-icon').textContent = level.icon;
    document.getElementById('level-title').textContent = level.name;
    document.getElementById('level-number').textContent = level.level;
    document.getElementById('level-progress').style.width = `${level.progress}%`;
    document.getElementById('level-points').textContent = `${stats.totalPoints}pt`;
  }

  /**
   * アチーブメントパネルを更新
   */
  _updateAchievementsPanel() {
    const summary = this.explorationStats.getSummary();
    const achievements = this.explorationStats.getAllAchievements();

    // 統計サマリーを更新
    document.getElementById('stats-level-icon').textContent = summary.level.icon;
    document.getElementById('stats-level-name').textContent = summary.level.name;
    document.getElementById('stats-level-number').textContent = summary.level.level;
    document.getElementById('stats-points').textContent = `${summary.totalPoints}pt`;
    document.getElementById('stats-progress').style.width = `${summary.level.progress}%`;

    const progressText = summary.level.nextLevel
      ? `次のレベルまで ${summary.level.pointsToNext}pt`
      : 'MAX LEVEL!';
    document.getElementById('stats-progress-text').textContent = progressText;

    document.getElementById('stats-articles').textContent = summary.totalArticles;
    document.getElementById('stats-expands').textContent = summary.totalExpands;
    document.getElementById('stats-bookmarks').textContent = summary.totalBookmarks;
    document.getElementById('stats-streak').textContent = summary.currentStreak;

    // アチーブメント一覧を更新
    const listEl = document.getElementById('achievements-list');
    listEl.innerHTML = achievements.map(achievement => `
      <div class="achievement-item ${achievement.unlocked ? 'achievement-item--unlocked' : 'achievement-item--locked'}">
        <span class="achievement-item__icon">${achievement.icon}</span>
        <span class="achievement-item__name">${achievement.name}</span>
        <span class="achievement-item__description">${achievement.description}</span>
      </div>
    `).join('');
  }

  /**
   * ポイント獲得通知を表示
   */
  _showPointsNotification(text, points) {
    const notification = document.createElement('div');
    notification.className = 'points-notification';
    notification.innerHTML = `
      <span class="points-notification__icon">✨</span>
      <span class="points-notification__text">
        <span class="points-notification__points">${text}</span>
      </span>
    `;

    document.body.appendChild(notification);

    // 3秒後に削除
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * レベルアップ通知を表示
   */
  _showLevelUpNotification(newLevel) {
    const notification = document.createElement('div');
    notification.className = 'levelup-notification';
    notification.innerHTML = `
      <span class="levelup-notification__icon">${newLevel.icon}</span>
      <span class="levelup-notification__title">LEVEL UP!</span>
      <span class="levelup-notification__level">Lv.${newLevel.level}</span>
      <span class="levelup-notification__name">${newLevel.name}</span>
    `;

    // オーバーレイを表示
    const overlay = document.getElementById('overlay');
    overlay.classList.add('visible');

    document.body.appendChild(notification);

    // クリックで閉じる
    const closeNotification = () => {
      notification.remove();
      overlay.classList.remove('visible');
    };

    notification.addEventListener('click', closeNotification);
    overlay.addEventListener('click', closeNotification, { once: true });

    // 5秒後に自動で閉じる
    setTimeout(closeNotification, 5000);
  }

  /**
   * アチーブメント解除通知を表示
   */
  _showAchievementNotifications(achievements) {
    // 一つずつ順番に表示
    let delay = 0;
    for (const achievement of achievements) {
      setTimeout(() => {
        this._showSingleAchievementNotification(achievement);
      }, delay);
      delay += 3500; // 3.5秒間隔
    }
  }

  /**
   * 単一のアチーブメント通知を表示
   */
  _showSingleAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <span class="achievement-notification__badge">${achievement.icon}</span>
      <span class="achievement-notification__title">Achievement Unlocked!</span>
      <span class="achievement-notification__name">${achievement.name}</span>
      <span class="achievement-notification__description">${achievement.description}</span>
    `;

    // オーバーレイを表示
    const overlay = document.getElementById('overlay');
    overlay.classList.add('visible');

    document.body.appendChild(notification);

    // クリックで閉じる
    const closeNotification = () => {
      notification.remove();
      overlay.classList.remove('visible');
    };

    notification.addEventListener('click', closeNotification);

    // 3秒後に自動で閉じる
    setTimeout(closeNotification, 3000);
  }
}

// アプリケーションを起動
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
