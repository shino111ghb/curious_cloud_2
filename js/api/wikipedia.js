/**
 * Wikipedia API クライアント
 * file:// プロトコルでも動作するようJSONPフォールバック対応
 */

const WikipediaAPI = {
  BASE_URL: CONFIG.WIKIPEDIA_API_BASE,
  PAGEVIEW_API_BASE: 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article',

  /**
   * JSONPでリクエスト（file://プロトコル対応）
   */
  _jsonpRequest(url) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const script = document.createElement('script');

      // タイムアウト設定
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('JSONP request timeout'));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('JSONP request failed'));
      };

      // URLにcallbackパラメータを追加
      const separator = url.includes('?') ? '&' : '?';
      script.src = `${url}${separator}callback=${callbackName}`;
      document.head.appendChild(script);
    });
  },

  /**
   * fetch または JSONP でリクエスト
   */
  async _request(params) {
    const url = `${this.BASE_URL}?${params}`;

    // まずfetchを試みる
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.log('Fetch failed, trying JSONP...');
    }

    // fetchが失敗したらJSONPを使用
    params.delete('origin');
    const jsonpUrl = `${this.BASE_URL}?${params}&format=json`;
    return this._jsonpRequest(jsonpUrl);
  },

  /**
   * ランダムなトピックを取得
   */
  async getRandomTopics(count = CONFIG.TOPICS_PER_REFRESH) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'random',
      grnnamespace: 0,
      grnlimit: count,
      prop: 'extracts|categories|pageimages',
      exintro: true,
      exlimit: count,
      explaintext: true,
      exsentences: 2,
      cllimit: 5,
      piprop: 'thumbnail',
      pithumbsize: 200
    });

    try {
      const data = await this._request(params);
      if (!data.query || !data.query.pages) {
        throw new Error('Invalid API response');
      }

      return this._parseTopics(data.query.pages);
    } catch (error) {
      console.error('ランダムトピック取得エラー:', error);
      throw error;
    }
  },

  /**
   * 記事の詳細を取得
   */
  async getArticle(pageTitle) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      titles: pageTitle,
      prop: 'extracts|links|categories|pageimages|info',
      exlimit: 1,
      pllimit: 50,
      plnamespace: 0,
      cllimit: 10,
      inprop: 'url',
      piprop: 'original|thumbnail',
      pithumbsize: 800,
      redirects: 1
    });

    try {
      const data = await this._request(params);
      const pages = Object.values(data.query.pages);

      if (pages[0].missing) {
        throw new Error('Article not found');
      }

      return this._parseArticle(pages[0]);
    } catch (error) {
      console.error('記事取得エラー:', error);
      throw error;
    }
  },

  /**
   * 関連トピックを取得
   */
  async getRelatedTopics(pageTitle, limit = CONFIG.RELATED_TOPICS_LIMIT) {
    // まずリンクを取得
    const linksParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      titles: pageTitle,
      prop: 'links',
      pllimit: 100,
      plnamespace: 0
    });

    try {
      const linksData = await this._request(linksParams);
      const pages = Object.values(linksData.query.pages);

      if (!pages[0].links || pages[0].links.length === 0) {
        // リンクがない場合はランダムトピックを返す
        return this.getRandomTopics(limit);
      }

      // リンクをフィルタリング
      const linkedTitles = pages[0].links
        .map(link => link.title)
        .filter(title => this._isValidTopic(title));

      // シャッフルして必要な数だけ取得
      const selectedTitles = Helpers.shuffle(linkedTitles).slice(0, limit);

      // 選択したタイトルの詳細を取得
      return this._fetchTopicDetails(selectedTitles);
    } catch (error) {
      console.error('関連トピック取得エラー:', error);
      throw error;
    }
  },

  /**
   * カテゴリからトピックを取得
   */
  async getTopicsByCategory(categoryName, limit = 10) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      list: 'categorymembers',
      cmtitle: `Category:${categoryName}`,
      cmtype: 'page',
      cmlimit: limit * 2 // フィルタリングのため多めに取得
    });

    try {
      const data = await this._request(params);
      if (!data.query || !data.query.categorymembers) {
        return [];
      }

      const validMembers = data.query.categorymembers
        .filter(member => this._isValidTopic(member.title))
        .slice(0, limit);

      if (validMembers.length === 0) {
        return [];
      }

      const titles = validMembers.map(m => m.title);
      return this._fetchTopicDetails(titles);
    } catch (error) {
      console.error('カテゴリトピック取得エラー:', error);
      return [];
    }
  },

  /**
   * 複数タイトルの詳細を取得
   */
  async _fetchTopicDetails(titles) {
    if (titles.length === 0) return [];

    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      titles: titles.join('|'),
      prop: 'extracts|categories|pageimages',
      exintro: true,
      exlimit: titles.length,
      explaintext: true,
      exsentences: 2,
      cllimit: 5,
      piprop: 'thumbnail',
      pithumbsize: 200
    });

    try {
      const data = await this._request(params);
      if (!data.query || !data.query.pages) {
        return [];
      }

      return this._parseTopics(data.query.pages);
    } catch (error) {
      console.error('トピック詳細取得エラー:', error);
      return [];
    }
  },

  /**
   * トピックが有効かどうかチェック
   */
  _isValidTopic(title) {
    if (!title || title.length < 2) return false;

    for (const pattern of CONFIG.EXCLUDED_PATTERNS) {
      if (pattern.test(title)) return false;
    }

    return true;
  },

  /**
   * APIレスポンスをトピック配列にパース
   */
  _parseTopics(pages) {
    return Object.values(pages)
      .filter(page => !page.missing && this._isValidTopic(page.title))
      .map(page => ({
        id: page.pageid,
        title: page.title,
        extract: page.extract || '',
        thumbnail: page.thumbnail?.source || null,
        categories: (page.categories || []).map(c => c.title.replace('Category:', '')),
        category: this._detectCategory(page.title, page.extract || '', page.categories || [])
      }));
  },

  /**
   * APIレスポンスを記事オブジェクトにパース
   */
  _parseArticle(page) {
    return {
      id: page.pageid,
      title: page.title,
      extract: page.extract || '',
      thumbnail: page.thumbnail?.source || page.original?.source || null,
      categories: (page.categories || []).map(c => c.title.replace('Category:', '')),
      links: (page.links || [])
        .filter(link => this._isValidTopic(link.title))
        .map(link => ({ title: link.title })),
      url: page.fullurl || `https://ja.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      category: this._detectCategory(page.title, page.extract || '', page.categories || [])
    };
  },

  /**
   * ページビュー数を取得
   * @param {string} pageTitle - ページタイトル
   * @param {number} days - 取得日数（デフォルト30日）
   * @returns {Promise<number>} - 合計ページビュー数
   */
  async getPageviews(pageTitle, days = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (date) => {
      return date.toISOString().slice(0, 10).replace(/-/g, '');
    };

    // タイトルをAPIフォーマットに変換（スペース→アンダースコア）
    const encodedTitle = encodeURIComponent(pageTitle.replace(/ /g, '_'));
    const url = `${this.PAGEVIEW_API_BASE}/ja.wikipedia.org/all-access/all-agents/${encodedTitle}/daily/${formatDate(startDate)}/${formatDate(endDate)}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Api-User-Agent': 'CuriousCloud/1.0'
        }
      });

      if (!response.ok) {
        console.warn(`Pageview API error for ${pageTitle}:`, response.status);
        return 0;
      }

      const data = await response.json();
      const totalViews = data.items?.reduce((sum, item) => sum + (item.views || 0), 0) || 0;
      return totalViews;
    } catch (error) {
      console.warn(`Failed to fetch pageviews for ${pageTitle}:`, error);
      return 0;
    }
  },

  /**
   * 複数ページのページビュー数を一括取得
   * @param {string[]} titles - ページタイトルの配列
   * @param {number} days - 取得日数
   * @returns {Promise<Map<string, number>>} - タイトル -> ページビュー数のマップ
   */
  async getBatchPageviews(titles, days = 30) {
    const viewsMap = new Map();

    // 並列で取得（バッチサイズで制限）
    const batchSize = 5;
    for (let i = 0; i < titles.length; i += batchSize) {
      const batch = titles.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (title) => {
          const views = await this.getPageviews(title, days);
          return { title, views };
        })
      );

      results.forEach(({ title, views }) => {
        viewsMap.set(title, views);
      });

      // レート制限対策（バッチ間に少し待機）
      if (i + batchSize < titles.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return viewsMap;
  },

  /**
   * ページビュー数から人気度サイズを判定
   * @param {number} views - ページビュー数
   * @returns {'small' | 'medium' | 'large'} - サイズカテゴリ
   */
  getPopularitySize(views) {
    // 30日間のページビュー数に基づく閾値
    if (views >= 50000) return 'large';   // メジャートピック
    if (views >= 10000) return 'medium';  // 中程度の人気
    return 'small';                        // ニッチなトピック
  },

  /**
   * カテゴリを自動検出
   */
  _detectCategory(title, extract, wikiCategories) {
    const text = `${title} ${extract}`;
    const categoryNames = wikiCategories.map(c =>
      typeof c === 'string' ? c : c.title?.replace('Category:', '') || ''
    );

    let bestMatch = { category: 'general', score: 0 };

    for (const [category, keywords] of Object.entries(CONFIG.CATEGORY_KEYWORDS)) {
      let score = 0;

      // テキスト内のキーワードマッチ
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += 2;
        }
      }

      // Wikipediaカテゴリとのマッチ
      const wikiCats = CONFIG.WIKIPEDIA_CATEGORIES[category] || [];
      for (const wikiCat of wikiCats) {
        if (categoryNames.some(name => name.includes(wikiCat))) {
          score += 3;
        }
      }

      if (score > bestMatch.score) {
        bestMatch = { category, score };
      }
    }

    return bestMatch.category;
  }
};
