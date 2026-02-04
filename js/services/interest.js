/**
 * 関心学習サービス
 */

class InterestService {
  constructor(storageService) {
    this.storage = storageService;
  }

  /**
   * アクションに基づいてカテゴリスコアを更新
   */
  updateFromAction(action, topic, durationSeconds = 0) {
    const profile = this.storage.getProfile();
    if (!profile) return null;

    const category = topic.category || 'general';
    if (category === 'general') return null;

    let delta = CONFIG.SCORE_WEIGHTS[action] || 0;

    // 長時間の閲覧にはボーナス
    if (action === 'deep_dive' && durationSeconds > 120) {
      delta += CONFIG.SCORE_WEIGHTS.long_read;
    }

    // 他のカテゴリは少し減衰させる（相対的な重み付け）
    const categories = Object.keys(profile.categoryScores);
    for (const cat of categories) {
      if (cat === category) {
        profile.categoryScores[cat] = Math.min(100, profile.categoryScores[cat] + delta);
      } else {
        // 緩やかな減衰
        profile.categoryScores[cat] = Math.max(10, profile.categoryScores[cat] - 0.5);
      }
    }

    this.storage.setProfile(profile);
    return profile.categoryScores[category];
  }

  /**
   * パーソナライズされたトピック配分を取得
   */
  getTopicDistribution(totalTopics = CONFIG.TOPICS_PER_REFRESH) {
    const profile = this.storage.getProfile();
    if (!profile) {
      // プロファイルがない場合は均等配分
      return { _random: totalTopics };
    }

    const scores = profile.categoryScores;
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

    if (totalScore === 0) {
      return { _random: totalTopics };
    }

    const distribution = {};
    let allocated = 0;

    // ランダム枠（発見のため）を20%確保
    const randomSlots = Math.ceil(totalTopics * 0.2);
    const personalizedSlots = totalTopics - randomSlots;

    // スコアに基づいて配分
    const sortedCategories = Object.entries(scores)
      .sort((a, b) => b[1] - a[1]);

    for (const [category, score] of sortedCategories) {
      if (score < 20) continue; // 低スコアのカテゴリはスキップ

      const proportion = score / totalScore;
      const slots = Math.round(proportion * personalizedSlots);

      if (slots > 0) {
        distribution[category] = slots;
        allocated += slots;
      }
    }

    // 残りはランダム枠に追加
    distribution._random = randomSlots + (personalizedSlots - allocated);

    return distribution;
  }

  /**
   * 関心トレンドを分析
   */
  analyzeInterestTrends() {
    const history = this.storage.getHistory(200);

    if (history.length < 10) {
      return { trending: [], declining: [] };
    }

    const recentHistory = history.slice(0, 50);
    const olderHistory = history.slice(50, 200);

    const recentCounts = this._countCategories(recentHistory);
    const olderCounts = this._countCategories(olderHistory);

    const trends = [];

    for (const category of Object.keys(CONFIG.CATEGORIES)) {
      const recentFreq = (recentCounts[category] || 0) / recentHistory.length;
      const olderFreq = (olderCounts[category] || 0) / (olderHistory.length || 1);
      const change = recentFreq - olderFreq;

      if (Math.abs(change) > 0.05) {
        trends.push({ category, change });
      }
    }

    const trending = trends.filter(t => t.change > 0).sort((a, b) => b.change - a.change);
    const declining = trends.filter(t => t.change < 0).sort((a, b) => a.change - b.change);

    return { trending, declining };
  }

  /**
   * カテゴリの出現回数をカウント
   */
  _countCategories(historyItems) {
    const counts = {};

    for (const item of historyItems) {
      const category = item.category || 'general';
      counts[category] = (counts[category] || 0) + 1;
    }

    return counts;
  }

  /**
   * プロファイルのサマリーを取得
   */
  getProfileSummary() {
    const profile = this.storage.getProfile();
    if (!profile) return null;

    const scores = profile.categoryScores;
    const sortedCategories = Object.entries(scores)
      .sort((a, b) => b[1] - a[1]);

    const topInterests = sortedCategories
      .slice(0, 3)
      .filter(([, score]) => score > 30)
      .map(([category, score]) => ({
        ...CONFIG.CATEGORIES[category],
        score
      }));

    const trends = this.analyzeInterestTrends();

    return {
      topInterests,
      trends,
      totalExplored: this.storage.getHistory().length,
      totalBookmarked: this.storage.getBookmarks().length
    };
  }

  /**
   * おすすめのWikipediaカテゴリを取得
   */
  getRecommendedWikiCategories(count = 5) {
    const distribution = this.getTopicDistribution(count);
    const categories = [];

    for (const [category, slots] of Object.entries(distribution)) {
      if (category === '_random' || !CONFIG.WIKIPEDIA_CATEGORIES[category]) continue;

      const wikiCats = CONFIG.WIKIPEDIA_CATEGORIES[category];
      const shuffled = Helpers.shuffle(wikiCats);

      for (let i = 0; i < Math.min(slots, shuffled.length); i++) {
        categories.push({
          wikiCategory: shuffled[i],
          userCategory: category
        });
      }
    }

    return Helpers.shuffle(categories);
  }
}
