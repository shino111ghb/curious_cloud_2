/**
 * エラーハンドリング
 */

const ErrorHandler = {
  /**
   * エラーメッセージの定義
   */
  messages: {
    network: {
      ja: 'インターネット接続を確認してください',
      retry: true
    },
    api: {
      ja: 'データの取得に失敗しました',
      retry: true
    },
    storage: {
      ja: 'データの保存に失敗しました',
      retry: false
    },
    notFound: {
      ja: '記事が見つかりませんでした',
      retry: false
    },
    unknown: {
      ja: 'エラーが発生しました',
      retry: true
    }
  },

  /**
   * リトライ機能付きの実行
   */
  async withRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        console.warn(`試行 ${attempt}/${maxRetries} 失敗:`, error.message);

        if (attempt < maxRetries) {
          await Helpers.sleep(delay * attempt);
        }
      }
    }

    throw lastError;
  },

  /**
   * エラーの種類を判定
   */
  getErrorType(error) {
    if (!navigator.onLine) {
      return 'network';
    }

    if (error.message && error.message.includes('not found')) {
      return 'notFound';
    }

    if (error.name === 'QuotaExceededError') {
      return 'storage';
    }

    if (error.message && (error.message.includes('fetch') || error.message.includes('API'))) {
      return 'api';
    }

    return 'unknown';
  },

  /**
   * エラーをユーザーに表示
   */
  showError(errorType, options = {}) {
    const message = this.messages[errorType] || this.messages.unknown;

    Helpers.showToast(message.ja, 'error', 5000);

    if (options.onRetry && message.retry) {
      // リトライボタン付きのトースト表示は省略
      // 必要に応じてカスタムUIを実装
    }
  },

  /**
   * ストレージエラーの処理
   */
  handleStorageError(error) {
    if (error.name === 'QuotaExceededError') {
      console.warn('ストレージ容量超過 - 古いデータを削除します');

      try {
        const storage = new StorageService();
        storage.pruneHistory(100);
        storage.clearTopicCache();
        return true;
      } catch (e) {
        console.error('ストレージのクリーンアップに失敗:', e);
      }
    }
    return false;
  },

  /**
   * API エラーの処理
   */
  async handleApiError(error, retryFn) {
    const errorType = this.getErrorType(error);

    if (errorType === 'network') {
      this.showError('network');
      return null;
    }

    if (errorType === 'notFound') {
      this.showError('notFound');
      return null;
    }

    // 再試行可能なエラーの場合
    if (retryFn) {
      try {
        return await this.withRetry(retryFn, 2, 1000);
      } catch (retryError) {
        this.showError('api');
        return null;
      }
    }

    this.showError('api');
    return null;
  },

  /**
   * グローバルエラーハンドラーの設定
   */
  setupGlobalHandlers() {
    // 未処理のPromiseエラー
    window.addEventListener('unhandledrejection', (event) => {
      console.error('未処理のPromiseエラー:', event.reason);
      event.preventDefault();
    });

    // グローバルエラー
    window.addEventListener('error', (event) => {
      console.error('グローバルエラー:', event.error);
    });

    // オフライン検知
    window.addEventListener('offline', () => {
      this.showOfflineIndicator();
    });

    // オンライン復帰
    window.addEventListener('online', () => {
      this.hideOfflineIndicator();
      Helpers.showToast('オンラインに復帰しました', 'success');
    });
  },

  /**
   * オフラインインジケーターの表示
   */
  showOfflineIndicator() {
    if (document.querySelector('.offline-bar')) return;

    const bar = document.createElement('div');
    bar.className = 'offline-bar';
    bar.style.cssText = `
      position: fixed;
      top: var(--header-height);
      left: 0;
      right: 0;
      background: #FEF3C7;
      color: #92400E;
      padding: 8px 16px;
      text-align: center;
      font-size: 13px;
      z-index: 99;
    `;
    bar.textContent = 'オフラインです - キャッシュされたコンテンツのみ表示できます';
    document.body.appendChild(bar);
  },

  /**
   * オフラインインジケーターの非表示
   */
  hideOfflineIndicator() {
    const bar = document.querySelector('.offline-bar');
    if (bar) {
      bar.remove();
    }
  }
};
