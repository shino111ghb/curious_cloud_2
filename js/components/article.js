/**
 * 記事ビューコンポーネント
 * 読みやすく要約された表示
 */

class ArticleView {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.currentTopic = null;
    this.enteredAt = null;
    this.historyEntryId = null;
    this.onBack = options.onBack || (() => {});
    this.onTopicClick = options.onTopicClick || (() => {});
    this.onBookmarkToggle = options.onBookmarkToggle || (() => {});
    this.storage = options.storage;
  }

  /**
   * 記事を表示
   */
  async render(topicTitle, topicId) {
    this.enteredAt = new Date();
    this.currentTopic = { title: topicTitle, id: topicId };

    // ローディング表示
    this._showLoading();

    try {
      const article = await ErrorHandler.withRetry(
        () => WikipediaAPI.getArticle(topicTitle),
        2,
        1000
      );

      this.currentTopic = article;
      this._renderArticle(article);
    } catch (error) {
      console.error('記事取得エラー:', error);
      this._renderError(error);
    }
  }

  /**
   * ローディング表示
   */
  _showLoading() {
    this.container.innerHTML = `
      <div class="article-loading">
        <div class="loading-spinner"></div>
        <p>記事を読み込んでいます...</p>
      </div>
    `;
  }

  /**
   * 記事をレンダリング
   */
  _renderArticle(article) {
    const isBookmarked = this.storage ? this.storage.isBookmarked(article.id) : false;
    const categoryInfo = CONFIG.CATEGORIES[article.category];

    // 記事内容を読みやすく処理
    const { summary, keyPoints } = this._processContent(article.extract, article.links);

    this.container.innerHTML = `
      <article class="article fade-in">
        <header class="article__header">
          <div class="article__header-left">
            <button class="btn btn--back" data-action="back">
              <svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>戻る</span>
            </button>
          </div>
          <div class="article__header-right">
            <button class="btn btn--bookmark ${isBookmarked ? 'bookmarked' : ''}" data-action="bookmark">
              <svg class="btn__icon" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              <span>${isBookmarked ? '保存済み' : '保存'}</span>
            </button>
          </div>
        </header>

        ${article.thumbnail ? `
          <div class="article__hero">
            <img class="article__image"
                 src="${article.thumbnail}"
                 alt="${Helpers.escapeHtml(article.title)}"
                 loading="lazy">
            <div class="article__hero-overlay"></div>
            <div class="article__hero-content">
              ${categoryInfo ? `
                <span class="article__category">${categoryInfo.icon} ${categoryInfo.label}</span>
              ` : ''}
              <h1 class="article__title">${Helpers.escapeHtml(article.title)}</h1>
            </div>
          </div>
        ` : `
          <div class="article__title-section">
            ${categoryInfo ? `
              <span class="article__category">${categoryInfo.icon} ${categoryInfo.label}</span>
            ` : ''}
            <h1 class="article__title">${Helpers.escapeHtml(article.title)}</h1>
          </div>
        `}

        <div class="article__content">
          <!-- ひとことで言うと -->
          <div class="article__summary-card">
            <div class="article__summary-icon">💡</div>
            <div class="article__summary-content">
              <h3 class="article__summary-title">ひとことで言うと</h3>
              <p class="article__summary-text">${summary}</p>
            </div>
          </div>

          ${keyPoints.length > 0 ? `
            <!-- もっと詳しく -->
            <div class="article__points">
              <h3 class="article__points-title">📚 もっと詳しく</h3>
              ${keyPoints.map((point, i) => `
                <div class="article__point" data-point-index="${i}">
                  <div class="article__point-header">
                    <span class="article__point-number">${i + 1}</span>
                    <p class="article__point-title">${point.title}</p>
                    <span class="article__point-toggle">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </span>
                  </div>
                  <div class="article__point-detail">
                    <p class="article__point-text">${point.detail}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        ${article.links && article.links.length > 0 ? `
          <section class="article__related">
            <h2>🔗 関連トピック</h2>
            <div class="related-topics">
              ${article.links.slice(0, 8).map(link => `
                <button class="related-topic" data-topic="${Helpers.escapeHtml(link.title)}">
                  ${Helpers.escapeHtml(link.title)}
                </button>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <footer class="article__footer">
          <a href="${article.url}" target="_blank" rel="noopener" class="article__source">
            <svg class="article__source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Wikipediaで全文を読む
          </a>
        </footer>
      </article>
    `;

    this._attachEventListeners();
  }

  /**
   * 記事内容を読みやすく処理
   */
  _processContent(content, links) {
    if (!content) {
      return {
        summary: 'この記事の内容を取得できませんでした。',
        keyPoints: []
      };
    }

    // リンク可能な単語のリストを作成（長い順にソート）
    const linkTitles = (links || [])
      .map(link => link.title)
      .filter(title => title && title.length >= 2)
      .sort((a, b) => b.length - a.length); // 長い単語を先にマッチ

    // HTMLタグを除去
    let cleanText = content
      .replace(/<[^>]+>/g, '')  // HTMLタグ除去
      .replace(/\[\d+\]/g, '')   // 参照番号除去
      .replace(/\s+/g, ' ')      // 連続空白を1つに
      .trim();

    // 文に分割
    const sentences = cleanText.split(/。|\.(?=\s)/).filter(s => s.trim().length > 10);

    // 要約を生成（噛み砕いた説明）
    let summary = this._generateSimpleSummary(sentences);

    // ポイントを抽出（重複しないように）
    const keyPoints = this._extractKeyPoints(sentences);

    // テキストにリンクを追加
    summary = this._addLinksToText(summary, linkTitles);
    keyPoints.forEach(point => {
      point.detail = this._addLinksToText(point.detail, linkTitles);
    });

    return { summary, keyPoints };
  }

  /**
   * テキスト内の単語にリンクを追加
   */
  _addLinksToText(text, linkTitles) {
    if (!text || !linkTitles || linkTitles.length === 0) {
      return text;
    }

    let result = text;
    const linkedWords = new Set(); // 重複リンクを防ぐ

    for (const title of linkTitles) {
      // 既にリンク済みの単語はスキップ
      if (linkedWords.has(title)) continue;

      // 安全な正規表現パターンを作成
      const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 最初の出現のみリンク化（同じ記事内で同じ単語は1回だけ）
      const regex = new RegExp(`(?<!<[^>]*)${escapedTitle}(?![^<]*>)`, 'u');

      if (regex.test(result)) {
        result = result.replace(regex,
          `<a href="#" class="article__inline-link" data-topic="${Helpers.escapeHtml(title)}">${Helpers.escapeHtml(title)}</a>`
        );
        linkedWords.add(title);

        // リンクは最大5つまで（読みやすさのため）
        if (linkedWords.size >= 5) break;
      }
    }

    return result;
  }

  /**
   * しっかりとした要約を生成（150〜300字）
   */
  _generateSimpleSummary(sentences) {
    if (sentences.length === 0) {
      return 'この記事の内容を取得できませんでした。';
    }

    // 括弧内を除去
    const cleanSentence = (s) => s
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 要約を構築（複数の文を組み合わせ）
    let summary = '';
    const usedIndexes = new Set();

    // まず最初の文を追加
    const firstSentence = cleanSentence(sentences[0]);

    // トートロジーチェック
    const isPattern = firstSentence.match(/^(.+?)は[、,]?\s*(.+?)(?:である|です|だ|となっている|を指す|のこと)/);

    if (isPattern && this._isTautology(isPattern[1], isPattern[2])) {
      // トートロジーの場合は2文目から開始
      for (let i = 1; i < Math.min(sentences.length, 3); i++) {
        const s = cleanSentence(sentences[i]);
        if (s.length > 20 && !this._isMetaText(s)) {
          summary = s;
          usedIndexes.add(i);
          break;
        }
      }
      if (!summary) {
        summary = firstSentence;
      }
      usedIndexes.add(0);
    } else {
      summary = firstSentence;
      usedIndexes.add(0);
    }

    // 句点を追加
    if (!summary.endsWith('。')) {
      summary += '。';
    }

    // 150字未満の場合は追加の文を結合
    for (let i = 1; i < sentences.length && summary.length < 150; i++) {
      if (usedIndexes.has(i)) continue;

      const nextSentence = cleanSentence(sentences[i]);

      // メタテキストや短すぎる文はスキップ
      if (nextSentence.length < 15 || this._isMetaText(nextSentence)) {
        continue;
      }

      // 追加しても300字を超えない場合のみ追加
      if (summary.length + nextSentence.length <= 300) {
        summary += nextSentence;
        if (!summary.endsWith('。')) {
          summary += '。';
        }
        usedIndexes.add(i);
      } else {
        break;
      }
    }

    // 300字を超える場合は切り詰め
    if (summary.length > 300) {
      // 句点で区切って300字以内に収める
      const parts = summary.split('。');
      summary = '';
      for (const part of parts) {
        if (part.trim() && summary.length + part.length + 1 <= 297) {
          summary += part + '。';
        } else {
          break;
        }
      }
      if (summary.length === 0) {
        summary = parts[0].substring(0, 297) + '...';
      }
    }

    return summary;
  }

  /**
   * トートロジー（同語反復）かどうかをチェック
   */
  _isTautology(subject, description) {
    // 主語と説明が似すぎている場合
    const subjectCore = subject.replace(/[はがのをにで]/g, '');
    const descCore = description.replace(/[はがのをにで]/g, '');

    // 主語が説明に含まれている、または説明が非常に短い
    return descCore.includes(subjectCore) ||
           subjectCore.includes(descCore) ||
           description.length < 10;
  }

  /**
   * メタテキスト（目次、見出しなど）かどうかをチェック
   */
  _isMetaText(text) {
    const metaPatterns = [
      /^(概要|歴史|特徴|分類|関連|参照|出典|脚注)/,
      /^(なお|ただし|また|および)/,
      /詳細は.+を参照/,
      /以下[にで]/
    ];
    return metaPatterns.some(p => p.test(text));
  }

  /**
   * ポイントを抽出（見出しと詳細のペア）
   */
  _extractKeyPoints(sentences) {
    const keyPoints = [];
    const usedContent = new Set();

    // 最初の文は要約で使用済み
    usedContent.add(this._normalizeText(sentences[0] || ''));

    // ポイントのカテゴリテンプレート
    const categoryTemplates = [
      { keywords: ['歴史', '起源', '由来', '誕生', '設立', '創設', '年'], title: '歴史・背景' },
      { keywords: ['特徴', '性質', '構造', '仕組み', '原理'], title: '特徴・仕組み' },
      { keywords: ['種類', '分類', '形態', 'タイプ'], title: '種類・分類' },
      { keywords: ['影響', '効果', '役割', '意義', '重要'], title: '影響・意義' },
      { keywords: ['利用', '用途', '応用', '活用', '使用', '使われ'], title: '利用・応用' },
      { keywords: ['問題', '課題', '批判', '議論', '限界'], title: '課題・議論' },
    ];

    for (let i = 1; i < sentences.length && keyPoints.length < 4; i++) {
      const sentence = sentences[i].trim();
      const normalized = this._normalizeText(sentence);

      // 短すぎる、メタテキスト、または既に使用済みはスキップ
      if (sentence.length < 25 || this._isMetaText(sentence) || usedContent.has(normalized)) {
        continue;
      }

      // 括弧内を除去
      const cleanedSentence = sentence
        .replace(/（[^）]*）/g, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // カテゴリを判定
      let title = this._generatePointTitle(keyPoints.length);
      for (const cat of categoryTemplates) {
        if (cat.keywords.some(kw => cleanedSentence.includes(kw))) {
          // 同じタイトルが既にあればスキップ
          if (!keyPoints.some(p => p.title === cat.title)) {
            title = cat.title;
          }
          break;
        }
      }

      // 詳細テキストを作成（次の文も追加）
      let detail = cleanedSentence;
      if (!detail.endsWith('。')) detail += '。';

      // 次の文も追加（関連性があれば）
      if (i + 1 < sentences.length) {
        const nextSentence = sentences[i + 1].trim()
          .replace(/（[^）]*）/g, '')
          .replace(/\([^)]*\)/g, '')
          .trim();

        if (nextSentence.length > 15 &&
            nextSentence.length < 150 &&
            !this._isMetaText(nextSentence)) {
          detail += nextSentence;
          if (!detail.endsWith('。')) detail += '。';
          usedContent.add(this._normalizeText(sentences[i + 1]));
        }
      }

      // 長すぎる場合は短縮
      if (detail.length > 300) {
        detail = detail.substring(0, 297) + '...';
      }

      keyPoints.push({ title, detail });
      usedContent.add(normalized);
    }

    return keyPoints;
  }

  /**
   * ポイントのデフォルトタイトルを生成
   */
  _generatePointTitle(index) {
    const defaultTitles = ['基本情報', '詳細', '補足情報', 'その他'];
    return defaultTitles[index] || '補足';
  }

  /**
   * テキストを正規化（重複チェック用）
   */
  _normalizeText(text) {
    return text
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/[\s、。,\.]/g, '')
      .substring(0, 30);
  }

  /**
   * エラー表示
   */
  _renderError(error) {
    this.container.innerHTML = `
      <div class="article-error">
        <span class="article-error__icon">😔</span>
        <p class="article-error__message">
          ${error.message === 'Article not found'
            ? '記事が見つかりませんでした'
            : '記事の読み込みに失敗しました'}
        </p>
        <button class="btn btn--primary article-error__retry" data-action="retry">
          再試行
        </button>
        <button class="btn btn--secondary" data-action="back" style="margin-top: 8px;">
          戻る
        </button>
      </div>
    `;

    this.container.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      if (this.currentTopic) {
        this.render(this.currentTopic.title, this.currentTopic.id);
      }
    });

    this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.onBack();
    });
  }

  /**
   * イベントリスナーを設定
   */
  _attachEventListeners() {
    // 戻るボタン
    this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.onBack();
    });

    // ブックマークボタン
    this.container.querySelector('[data-action="bookmark"]')?.addEventListener('click', (e) => {
      this._handleBookmark(e.currentTarget);
    });

    // ポイントの展開/折りたたみ
    this.container.querySelectorAll('.article__point').forEach(point => {
      const header = point.querySelector('.article__point-header');
      if (header) {
        header.addEventListener('click', () => {
          point.classList.toggle('expanded');
        });
      }
    });

    // 関連トピックボタン
    this.container.querySelectorAll('.related-topic').forEach(btn => {
      btn.addEventListener('click', () => {
        const topicTitle = btn.dataset.topic;
        this.onTopicClick(topicTitle);
      });
    });

    // インラインリンク（記事内のリンク）
    this.container.querySelectorAll('.article__inline-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const topicTitle = link.dataset.topic;
        if (topicTitle) {
          this.onTopicClick(topicTitle);
        }
      });
    });
  }

  /**
   * ブックマークの処理
   */
  _handleBookmark(button) {
    if (!this.currentTopic || !this.storage) return;

    const isCurrentlyBookmarked = this.storage.isBookmarked(this.currentTopic.id);

    if (isCurrentlyBookmarked) {
      this.storage.removeBookmark(this.currentTopic.id);
      button.classList.remove('bookmarked');
      button.querySelector('svg').setAttribute('fill', 'none');
      button.querySelector('span').textContent = '保存';
      Helpers.showToast('ブックマークを削除しました', 'info');
    } else {
      this.storage.addBookmark({
        topicId: this.currentTopic.id,
        topicTitle: this.currentTopic.title,
        category: this.currentTopic.category
      });
      button.classList.add('bookmarked');
      button.querySelector('svg').setAttribute('fill', 'currentColor');
      button.querySelector('span').textContent = '保存済み';
      button.classList.add('heartbeat');
      setTimeout(() => button.classList.remove('heartbeat'), 400);
      Helpers.showToast('ブックマークに保存しました', 'success');
    }

    this.onBookmarkToggle(this.currentTopic, !isCurrentlyBookmarked);
  }

  /**
   * 滞在時間を取得
   */
  getDuration() {
    if (!this.enteredAt) return 0;
    return Math.floor((new Date() - this.enteredAt) / 1000);
  }

  /**
   * 履歴エントリIDを設定
   */
  setHistoryEntryId(id) {
    this.historyEntryId = id;
  }

  /**
   * 現在のトピックを取得
   */
  getCurrentTopic() {
    return this.currentTopic;
  }

  /**
   * クリア
   */
  clear() {
    this.container.innerHTML = '';
    this.currentTopic = null;
    this.enteredAt = null;
    this.historyEntryId = null;
  }
}
