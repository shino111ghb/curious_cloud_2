/**
 * LocalStorage 管理サービス
 */

class StorageService {
  constructor() {
    this.PREFIX = 'curiosity_';
  }

  /**
   * データを取得
   */
  get(key) {
    try {
      const data = localStorage.getItem(this.PREFIX + key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('ストレージ読み込みエラー:', error);
      return null;
    }
  }

  /**
   * データを保存
   */
  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        ErrorHandler.handleStorageError(error);
        // 再試行
        try {
          localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
          return true;
        } catch (retryError) {
          console.error('ストレージ保存エラー（再試行後）:', retryError);
          return false;
        }
      }
      console.error('ストレージ保存エラー:', error);
      return false;
    }
  }

  /**
   * データを削除
   */
  remove(key) {
    try {
      localStorage.removeItem(this.PREFIX + key);
      return true;
    } catch (error) {
      console.error('ストレージ削除エラー:', error);
      return false;
    }
  }

  // ========================================
  // ユーザープロファイル
  // ========================================

  /**
   * プロファイルが存在するか
   */
  hasProfile() {
    return this.get('user_profile') !== null;
  }

  /**
   * プロファイルを取得
   */
  getProfile() {
    return this.get('user_profile');
  }

  /**
   * プロファイルを保存
   */
  setProfile(profile) {
    return this.set('user_profile', profile);
  }

  /**
   * カテゴリスコアを更新
   */
  updateCategoryScore(category, delta) {
    const profile = this.getProfile();
    if (!profile) return false;

    const currentScore = profile.categoryScores[category] || 50;
    const newScore = Math.max(0, Math.min(100, currentScore + delta));
    profile.categoryScores[category] = newScore;

    return this.setProfile(profile);
  }

  // ========================================
  // 閲覧履歴
  // ========================================

  /**
   * 履歴を取得
   */
  getHistory(limit = 100) {
    const history = this.get('browsing_history') || [];
    return history.slice(0, limit);
  }

  /**
   * 履歴に追加
   */
  addToHistory(entry) {
    const history = this.get('browsing_history') || [];

    const newEntry = {
      id: Helpers.generateId(),
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    };

    history.unshift(newEntry);

    // 最大数を超えたら古いものを削除
    if (history.length > CONFIG.MAX_HISTORY_ITEMS) {
      history.splice(CONFIG.MAX_HISTORY_ITEMS);
    }

    return this.set('browsing_history', history);
  }

  /**
   * 履歴エントリを更新（滞在時間など）
   */
  updateHistoryEntry(entryId, updates) {
    const history = this.get('browsing_history') || [];
    const index = history.findIndex(entry => entry.id === entryId);

    if (index !== -1) {
      history[index] = { ...history[index], ...updates };
      return this.set('browsing_history', history);
    }

    return false;
  }

  /**
   * 履歴を削除（古いものを整理）
   */
  pruneHistory(keepCount = 100) {
    const history = this.get('browsing_history') || [];
    const pruned = history.slice(0, keepCount);
    return this.set('browsing_history', pruned);
  }

  /**
   * 履歴をクリア
   */
  clearHistory() {
    return this.set('browsing_history', []);
  }

  // ========================================
  // ブックマーク
  // ========================================

  /**
   * ブックマークを取得
   */
  getBookmarks() {
    return this.get('bookmarks') || [];
  }

  /**
   * ブックマークを追加
   */
  addBookmark(bookmark) {
    const bookmarks = this.getBookmarks();

    // 重複チェック
    if (bookmarks.some(b => b.topicId === bookmark.topicId)) {
      return false;
    }

    const newBookmark = {
      id: Helpers.generateId(),
      ...bookmark,
      createdAt: new Date().toISOString()
    };

    bookmarks.unshift(newBookmark);
    return this.set('bookmarks', bookmarks);
  }

  /**
   * ブックマークを削除
   */
  removeBookmark(topicId) {
    const bookmarks = this.getBookmarks();
    const filtered = bookmarks.filter(b => b.topicId !== topicId);

    if (filtered.length !== bookmarks.length) {
      return this.set('bookmarks', filtered);
    }

    return false;
  }

  /**
   * ブックマークされているか確認
   */
  isBookmarked(topicId) {
    const bookmarks = this.getBookmarks();
    return bookmarks.some(b => b.topicId === topicId);
  }

  /**
   * カテゴリ別にブックマークを取得
   */
  getBookmarksByCategory() {
    const bookmarks = this.getBookmarks();
    const grouped = {};

    for (const bookmark of bookmarks) {
      const category = bookmark.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(bookmark);
    }

    return grouped;
  }

  // ========================================
  // セッション
  // ========================================

  /**
   * セッションを取得
   */
  getSession() {
    return this.get('session') || {
      currentView: 'cloud',
      currentTopicId: null,
      cloudTopics: [],
      articleEnteredAt: null,
      lastRefreshAt: null
    };
  }

  /**
   * セッションを更新
   */
  updateSession(updates) {
    const session = this.getSession();
    return this.set('session', { ...session, ...updates });
  }

  // ========================================
  // トピックキャッシュ
  // ========================================

  /**
   * キャッシュを取得
   */
  getCachedTopic(topicId) {
    const cache = this.get('topic_cache') || {};
    const cached = cache[topicId];

    if (cached) {
      // TTLチェック
      const fetchedAt = new Date(cached.fetchedAt);
      const now = new Date();
      const hoursDiff = (now - fetchedAt) / (1000 * 60 * 60);

      if (hoursDiff < CONFIG.CACHE_TTL_HOURS) {
        return cached;
      }
    }

    return null;
  }

  /**
   * キャッシュに保存
   */
  cacheTopic(topic) {
    const cache = this.get('topic_cache') || {};

    cache[topic.id] = {
      ...topic,
      fetchedAt: new Date().toISOString()
    };

    return this.set('topic_cache', cache);
  }

  /**
   * キャッシュをクリア
   */
  clearTopicCache() {
    return this.set('topic_cache', {});
  }

  /**
   * クラウドトピックをキャッシュ
   */
  cacheCloudTopics(topics) {
    this.updateSession({ cloudTopics: topics });
  }

  /**
   * キャッシュされたクラウドトピックを取得
   */
  getCachedCloudTopics() {
    const session = this.getSession();
    return session.cloudTopics || [];
  }
}

// シングルトンインスタンス
const storage = new StorageService();
