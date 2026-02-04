/**
 * トピック生成サービス
 */

class TopicGenerator {
  constructor(storageService, interestService) {
    this.storage = storageService;
    this.interest = interestService;
  }

  /**
   * シードトピックからランダムに選択してWikipediaから詳細を取得
   */
  async _getTopicsFromSeeds(category, amount) {
    const seeds = CONFIG.SEED_TOPICS[category];
    if (!seeds || seeds.length === 0) return [];

    // シードからランダムに選択
    const shuffled = Helpers.shuffle([...seeds]);
    const selectedTitles = shuffled.slice(0, amount * 2); // 多めに取得

    try {
      const topics = await WikipediaAPI._fetchTopicDetails(selectedTitles);
      return topics.slice(0, amount).map(t => ({
        ...t,
        category: category
      }));
    } catch (error) {
      console.warn(`シードトピック取得エラー (${category}):`, error);
      return [];
    }
  }

  /**
   * パーソナライズされたトピックを生成
   */
  async generatePersonalizedTopics(count = CONFIG.TOPICS_PER_REFRESH) {
    const distribution = this.interest.getTopicDistribution(count);
    const topics = [];

    // カテゴリごとのAPI呼び出しを並列化
    const categoryPromises = Object.entries(distribution)
      .filter(([category, amount]) => category !== '_random' && amount > 0)
      .map(async ([category, amount]) => {
        try {
          return await this._getTopicsFromSeeds(category, amount);
        } catch (error) {
          console.warn(`カテゴリ ${category} のトピック取得に失敗:`, error);
          return [];
        }
      });

    const results = await Promise.all(categoryPromises);
    results.forEach(categoryTopics => topics.push(...categoryTopics));

    // 足りない分はランダムトピックを追加
    const randomSlots = distribution._random || 0;
    if (randomSlots > 0 || topics.length < count) {
      try {
        const needed = Math.max(randomSlots, count - topics.length);
        const randomTopics = await WikipediaAPI.getRandomTopics(needed);
        topics.push(...randomTopics);
      } catch (error) {
        console.warn('ランダムトピック取得に失敗:', error);
      }
    }

    // 重複を除去してシャッフル
    const uniqueTopics = this._removeDuplicates(topics);
    const shuffled = Helpers.shuffle(uniqueTopics).slice(0, count);

    // キャッシュに保存
    this.storage.cacheCloudTopics(shuffled);

    return shuffled;
  }

  /**
   * 初回用のトピックを生成（オンボーディング後）
   */
  async generateInitialTopics(interests, count = CONFIG.TOPICS_PER_REFRESH) {
    const topics = [];
    const perInterest = Math.ceil(count / interests.length);

    // 興味カテゴリのAPI呼び出しを並列化
    const interestPromises = interests.map(async (interest) => {
      try {
        return await this._getTopicsFromSeeds(interest, perInterest);
      } catch (error) {
        console.warn(`初期トピック取得エラー (${interest}):`, error);
        return [];
      }
    });

    const results = await Promise.all(interestPromises);
    results.forEach(categoryTopics => topics.push(...categoryTopics));

    // 足りない分はランダムで補完
    if (topics.length < count) {
      try {
        const randomTopics = await WikipediaAPI.getRandomTopics(count - topics.length);
        topics.push(...randomTopics);
      } catch (error) {
        console.warn('ランダムトピック補完エラー:', error);
      }
    }

    const uniqueTopics = this._removeDuplicates(topics);
    const shuffled = Helpers.shuffle(uniqueTopics).slice(0, count);

    this.storage.cacheCloudTopics(shuffled);

    return shuffled;
  }

  /**
   * オフライン時のフォールバックトピック
   */
  getOfflineTopics() {
    // キャッシュからトピックを取得
    const cachedTopics = this.storage.getCachedCloudTopics();
    if (cachedTopics.length > 0) {
      return Helpers.shuffle(cachedTopics);
    }

    // ブックマークからトピックを生成
    const bookmarks = this.storage.getBookmarks();
    if (bookmarks.length > 0) {
      return bookmarks.map(b => ({
        id: b.topicId,
        title: b.topicTitle,
        extract: '',
        category: b.category,
        thumbnail: null
      }));
    }

    return [];
  }

  /**
   * 重複を除去
   */
  _removeDuplicates(topics) {
    const seen = new Set();
    return topics.filter(topic => {
      if (seen.has(topic.id)) {
        return false;
      }
      seen.add(topic.id);
      return true;
    });
  }
}
