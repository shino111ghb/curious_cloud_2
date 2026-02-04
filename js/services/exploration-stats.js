/**
 * 探索統計サービス
 * ポイント・レベル・アチーブメント管理
 */

class ExplorationStatsService {
  constructor() {
    this.storageKey = 'exploration_stats';
  }

  // ========================================
  // レベル定義
  // ========================================

  static LEVELS = [
    { level: 1, name: '好奇心の芽生え', minPoints: 0, icon: '🌱' },
    { level: 2, name: '知識の探求者', minPoints: 1000, icon: '📖' },
    { level: 3, name: '学びの旅人', minPoints: 3000, icon: '🚶' },
    { level: 4, name: '知識の収集家', minPoints: 6000, icon: '📚' },
    { level: 5, name: '探究の達人', minPoints: 10000, icon: '🔍' },
    { level: 6, name: '博識の探検家', minPoints: 15000, icon: '🧭' },
    { level: 7, name: '知恵の求道者', minPoints: 22000, icon: '🎓' },
    { level: 8, name: '学問の冒険家', minPoints: 30000, icon: '🏔️' },
    { level: 9, name: '知識の賢者', minPoints: 40000, icon: '🦉' },
    { level: 10, name: '好奇心マスター', minPoints: 55000, icon: '⭐' },
    { level: 11, name: '知の探究者', minPoints: 75000, icon: '🌟' },
    { level: 12, name: '叡智の守護者', minPoints: 100000, icon: '👑' }
  ];

  // ========================================
  // ポイント定義
  // ========================================

  static POINT_ACTIONS = {
    ARTICLE_READ: { points: 10, description: '記事を読んだ' },
    LONG_READ: { points: 5, description: '2分以上じっくり読んだ' },
    EXPAND: { points: 15, description: '関連トピックを広げた' },
    BOOKMARK: { points: 20, description: 'ブックマークに保存' },
    NEW_CATEGORY: { points: 50, description: '新しいカテゴリに挑戦' },
    FIRST_ARTICLE: { points: 30, description: '初めての記事閲覧' },
    DAILY_LOGIN: { points: 5, description: 'デイリーログイン' },
    STREAK_BONUS: { points: 10, description: '連続ログインボーナス' }
  };

  // ========================================
  // アチーブメント定義
  // ========================================

  static ACHIEVEMENTS = {
    // 入門系
    first_step: {
      id: 'first_step',
      name: '最初の一歩',
      description: '初めての記事を読んだ',
      icon: '👣',
      condition: (stats) => stats.totalArticles >= 1
    },
    curious_mind: {
      id: 'curious_mind',
      name: '好奇心旺盛',
      description: '10個の記事を読んだ',
      icon: '🧠',
      condition: (stats) => stats.totalArticles >= 10
    },
    knowledge_seeker: {
      id: 'knowledge_seeker',
      name: '知識の探求者',
      description: '50個の記事を読んだ',
      icon: '📚',
      condition: (stats) => stats.totalArticles >= 50
    },
    wisdom_collector: {
      id: 'wisdom_collector',
      name: '知恵の収集家',
      description: '100個の記事を読んだ',
      icon: '🏛️',
      condition: (stats) => stats.totalArticles >= 100
    },

    // 広げる系
    explorer: {
      id: 'explorer',
      name: '探検家',
      description: '関連トピックを10回広げた',
      icon: '🌿',
      condition: (stats) => stats.totalExpands >= 10
    },
    pathfinder: {
      id: 'pathfinder',
      name: '道を切り開く者',
      description: '関連トピックを50回広げた',
      icon: '🗺️',
      condition: (stats) => stats.totalExpands >= 50
    },

    // ブックマーク系
    collector: {
      id: 'collector',
      name: 'コレクター',
      description: '10個ブックマークした',
      icon: '📌',
      condition: (stats) => stats.totalBookmarks >= 10
    },
    librarian: {
      id: 'librarian',
      name: '図書館長',
      description: '50個ブックマークした',
      icon: '📖',
      condition: (stats) => stats.totalBookmarks >= 50
    },

    // カテゴリ制覇系
    science_lover: {
      id: 'science_lover',
      name: '科学愛好家',
      description: '科学カテゴリを10記事読んだ',
      icon: '🔬',
      condition: (stats) => (stats.categoryArticles?.science || 0) >= 10
    },
    history_buff: {
      id: 'history_buff',
      name: '歴史通',
      description: '歴史カテゴリを10記事読んだ',
      icon: '📜',
      condition: (stats) => (stats.categoryArticles?.history || 0) >= 10
    },
    art_enthusiast: {
      id: 'art_enthusiast',
      name: '芸術愛好家',
      description: '芸術カテゴリを10記事読んだ',
      icon: '🎨',
      condition: (stats) => (stats.categoryArticles?.art || 0) >= 10
    },
    tech_geek: {
      id: 'tech_geek',
      name: 'テック通',
      description: 'テクノロジーを10記事読んだ',
      icon: '💻',
      condition: (stats) => (stats.categoryArticles?.technology || 0) >= 10
    },
    nature_lover: {
      id: 'nature_lover',
      name: '自然愛好家',
      description: '自然カテゴリを10記事読んだ',
      icon: '🌿',
      condition: (stats) => (stats.categoryArticles?.nature || 0) >= 10
    },
    space_explorer: {
      id: 'space_explorer',
      name: '宇宙探検家',
      description: '宇宙カテゴリを10記事読んだ',
      icon: '🚀',
      condition: (stats) => (stats.categoryArticles?.space || 0) >= 10
    },
    philosopher: {
      id: 'philosopher',
      name: '哲学者',
      description: '哲学カテゴリを10記事読んだ',
      icon: '🤔',
      condition: (stats) => (stats.categoryArticles?.philosophy || 0) >= 10
    },

    // 多様性
    versatile: {
      id: 'versatile',
      name: '博識',
      description: '5つ以上のカテゴリを探索した',
      icon: '🌈',
      condition: (stats) => {
        const categories = Object.keys(stats.categoryArticles || {});
        return categories.filter(c => stats.categoryArticles[c] >= 1).length >= 5;
      }
    },
    renaissance: {
      id: 'renaissance',
      name: 'ルネサンス人',
      description: '10カテゴリ以上を探索した',
      icon: '🎭',
      condition: (stats) => {
        const categories = Object.keys(stats.categoryArticles || {});
        return categories.filter(c => stats.categoryArticles[c] >= 1).length >= 10;
      }
    },
    polymath: {
      id: 'polymath',
      name: '万能の知識人',
      description: '全カテゴリを探索した',
      icon: '👑',
      condition: (stats) => {
        const categories = Object.keys(stats.categoryArticles || {});
        return categories.filter(c => stats.categoryArticles[c] >= 1).length >= 20;
      }
    },

    // 連続系
    dedicated: {
      id: 'dedicated',
      name: '継続は力なり',
      description: '3日連続でログイン',
      icon: '🔥',
      condition: (stats) => stats.currentStreak >= 3
    },
    committed: {
      id: 'committed',
      name: '学習の習慣',
      description: '7日連続でログイン',
      icon: '💪',
      condition: (stats) => stats.currentStreak >= 7
    },
    unstoppable: {
      id: 'unstoppable',
      name: '止まらない好奇心',
      description: '14日連続でログイン',
      icon: '🏆',
      condition: (stats) => stats.currentStreak >= 14
    },

    // じっくり読む系
    deep_thinker: {
      id: 'deep_thinker',
      name: '熟考者',
      description: '10記事を2分以上読んだ',
      icon: '💭',
      condition: (stats) => stats.longReads >= 10
    },
    contemplator: {
      id: 'contemplator',
      name: '瞑想家',
      description: '50記事を2分以上読んだ',
      icon: '🧘',
      condition: (stats) => stats.longReads >= 50
    },

    // ポイント・レベル系
    century: {
      id: 'century',
      name: 'センチュリー',
      description: '100ポイント達成',
      icon: '💯',
      condition: (stats) => stats.totalPoints >= 100
    },
    milestone_500: {
      id: 'milestone_500',
      name: '500の峰',
      description: '500ポイント達成',
      icon: '⛰️',
      condition: (stats) => stats.totalPoints >= 500
    },
    milestone_1000: {
      id: 'milestone_1000',
      name: '千の境地',
      description: '1000ポイント達成',
      icon: '🏔️',
      condition: (stats) => stats.totalPoints >= 1000
    },
    milestone_5000: {
      id: 'milestone_5000',
      name: '知の頂',
      description: '5000ポイント達成',
      icon: '🌟',
      condition: (stats) => stats.totalPoints >= 5000
    }
  };

  // ========================================
  // 基本操作
  // ========================================

  /**
   * 統計を取得
   */
  getStats() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('統計データ読み込みエラー:', error);
    }
    return this._getDefaultStats();
  }

  /**
   * 統計を保存
   */
  saveStats(stats) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(stats));
      return true;
    } catch (error) {
      console.error('統計データ保存エラー:', error);
      return false;
    }
  }

  /**
   * デフォルトの統計データ
   */
  _getDefaultStats() {
    return {
      totalPoints: 0,
      totalArticles: 0,
      totalExpands: 0,
      totalBookmarks: 0,
      longReads: 0,
      categoryArticles: {},
      exploredCategories: [],
      unlockedAchievements: [],
      currentStreak: 0,
      longestStreak: 0,
      lastVisitDate: null,
      createdAt: new Date().toISOString()
    };
  }

  // ========================================
  // ポイント操作
  // ========================================

  /**
   * ポイントを追加
   */
  addPoints(actionType, customPoints = null) {
    const stats = this.getStats();
    const action = ExplorationStatsService.POINT_ACTIONS[actionType];

    if (!action && customPoints === null) {
      console.warn('Unknown action type:', actionType);
      return { success: false };
    }

    const pointsToAdd = customPoints !== null ? customPoints : action.points;
    const oldPoints = stats.totalPoints;
    const oldLevel = this.getLevel(oldPoints);

    stats.totalPoints += pointsToAdd;

    const newLevel = this.getLevel(stats.totalPoints);
    const leveledUp = newLevel.level > oldLevel.level;

    this.saveStats(stats);

    return {
      success: true,
      pointsAdded: pointsToAdd,
      totalPoints: stats.totalPoints,
      leveledUp,
      oldLevel,
      newLevel,
      description: action?.description || ''
    };
  }

  /**
   * 現在のレベルを取得
   */
  getLevel(points = null) {
    if (points === null) {
      points = this.getStats().totalPoints;
    }

    const levels = ExplorationStatsService.LEVELS;
    let currentLevel = levels[0];

    for (const level of levels) {
      if (points >= level.minPoints) {
        currentLevel = level;
      } else {
        break;
      }
    }

    // 次のレベルまでの進捗を計算
    const currentIndex = levels.indexOf(currentLevel);
    const nextLevel = levels[currentIndex + 1];
    let progress = 100;
    let pointsToNext = 0;

    if (nextLevel) {
      const pointsInLevel = points - currentLevel.minPoints;
      const levelRange = nextLevel.minPoints - currentLevel.minPoints;
      progress = Math.floor((pointsInLevel / levelRange) * 100);
      pointsToNext = nextLevel.minPoints - points;
    }

    return {
      ...currentLevel,
      progress,
      pointsToNext,
      nextLevel: nextLevel || null
    };
  }

  // ========================================
  // 統計更新
  // ========================================

  /**
   * 記事閲覧を記録
   */
  recordArticleRead(category) {
    const stats = this.getStats();
    const wasFirstArticle = stats.totalArticles === 0;

    stats.totalArticles++;

    // カテゴリ別カウント
    if (!stats.categoryArticles) {
      stats.categoryArticles = {};
    }
    stats.categoryArticles[category] = (stats.categoryArticles[category] || 0) + 1;

    // 新しいカテゴリか確認
    const isNewCategory = !stats.exploredCategories?.includes(category);
    if (isNewCategory) {
      if (!stats.exploredCategories) {
        stats.exploredCategories = [];
      }
      stats.exploredCategories.push(category);
    }

    this.saveStats(stats);

    // ポイントを追加
    const results = [];

    if (wasFirstArticle) {
      results.push(this.addPoints('FIRST_ARTICLE'));
    }

    results.push(this.addPoints('ARTICLE_READ'));

    if (isNewCategory) {
      results.push(this.addPoints('NEW_CATEGORY'));
    }

    // アチーブメントをチェック
    const newAchievements = this.checkAchievements();

    return {
      results,
      newAchievements,
      isNewCategory,
      wasFirstArticle
    };
  }

  /**
   * 長時間閲覧を記録
   */
  recordLongRead() {
    const stats = this.getStats();
    stats.longReads = (stats.longReads || 0) + 1;
    this.saveStats(stats);

    const result = this.addPoints('LONG_READ');
    const newAchievements = this.checkAchievements();

    return { result, newAchievements };
  }

  /**
   * 広げるを記録
   */
  recordExpand() {
    const stats = this.getStats();
    stats.totalExpands = (stats.totalExpands || 0) + 1;
    this.saveStats(stats);

    const result = this.addPoints('EXPAND');
    const newAchievements = this.checkAchievements();

    return { result, newAchievements };
  }

  /**
   * ブックマークを記録
   */
  recordBookmark() {
    const stats = this.getStats();
    stats.totalBookmarks = (stats.totalBookmarks || 0) + 1;
    this.saveStats(stats);

    const result = this.addPoints('BOOKMARK');
    const newAchievements = this.checkAchievements();

    return { result, newAchievements };
  }

  /**
   * デイリーログインをチェック・記録
   */
  recordDailyVisit() {
    const stats = this.getStats();
    const today = new Date().toDateString();
    const lastVisit = stats.lastVisitDate ? new Date(stats.lastVisitDate).toDateString() : null;

    if (today === lastVisit) {
      // 今日は既にログイン済み
      return { alreadyVisited: true };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    // 連続ログインをチェック
    if (lastVisit === yesterdayStr) {
      // 連続ログイン
      stats.currentStreak = (stats.currentStreak || 0) + 1;
      if (stats.currentStreak > (stats.longestStreak || 0)) {
        stats.longestStreak = stats.currentStreak;
      }
    } else if (lastVisit !== today) {
      // 連続が途切れた
      stats.currentStreak = 1;
    }

    stats.lastVisitDate = new Date().toISOString();
    this.saveStats(stats);

    // ポイントを追加
    const results = [this.addPoints('DAILY_LOGIN')];

    // 連続ボーナス（3日ごと）
    if (stats.currentStreak > 1 && stats.currentStreak % 3 === 0) {
      results.push(this.addPoints('STREAK_BONUS'));
    }

    const newAchievements = this.checkAchievements();

    return {
      alreadyVisited: false,
      currentStreak: stats.currentStreak,
      results,
      newAchievements
    };
  }

  // ========================================
  // アチーブメント
  // ========================================

  /**
   * アチーブメントをチェックして新規解除を返す
   */
  checkAchievements() {
    const stats = this.getStats();
    const newAchievements = [];

    for (const [id, achievement] of Object.entries(ExplorationStatsService.ACHIEVEMENTS)) {
      // 既に解除済みならスキップ
      if (stats.unlockedAchievements?.includes(id)) {
        continue;
      }

      // 条件をチェック
      if (achievement.condition(stats)) {
        if (!stats.unlockedAchievements) {
          stats.unlockedAchievements = [];
        }
        stats.unlockedAchievements.push(id);
        newAchievements.push(achievement);
      }
    }

    if (newAchievements.length > 0) {
      this.saveStats(stats);
    }

    return newAchievements;
  }

  /**
   * 全アチーブメント（解除状況付き）を取得
   */
  getAllAchievements() {
    const stats = this.getStats();
    const unlockedIds = stats.unlockedAchievements || [];

    return Object.values(ExplorationStatsService.ACHIEVEMENTS).map(achievement => ({
      ...achievement,
      unlocked: unlockedIds.includes(achievement.id)
    }));
  }

  /**
   * 解除済みアチーブメント数を取得
   */
  getUnlockedCount() {
    const stats = this.getStats();
    return (stats.unlockedAchievements || []).length;
  }

  /**
   * 全アチーブメント数を取得
   */
  getTotalAchievementsCount() {
    return Object.keys(ExplorationStatsService.ACHIEVEMENTS).length;
  }

  // ========================================
  // サマリー
  // ========================================

  /**
   * 統計サマリーを取得
   */
  getSummary() {
    const stats = this.getStats();
    const level = this.getLevel();
    const unlockedCount = this.getUnlockedCount();
    const totalAchievements = this.getTotalAchievementsCount();

    return {
      totalPoints: stats.totalPoints,
      level,
      totalArticles: stats.totalArticles || 0,
      totalExpands: stats.totalExpands || 0,
      totalBookmarks: stats.totalBookmarks || 0,
      longReads: stats.longReads || 0,
      exploredCategories: (stats.exploredCategories || []).length,
      currentStreak: stats.currentStreak || 0,
      longestStreak: stats.longestStreak || 0,
      unlockedAchievements: unlockedCount,
      totalAchievements,
      achievementProgress: Math.floor((unlockedCount / totalAchievements) * 100)
    };
  }
}

// シングルトンインスタンス
const explorationStats = new ExplorationStatsService();
