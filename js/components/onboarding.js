/**
 * オンボーディングコンポーネント
 */

class OnboardingView {
  constructor(options = {}) {
    this.container = document.getElementById('onboarding-view');
    this.grid = document.getElementById('interest-grid');
    this.submitBtn = document.getElementById('onboarding-submit');
    this.storage = options.storage;
    this.onComplete = options.onComplete || (() => {});
    this.selectedInterests = [];

    this._init();
  }

  /**
   * 初期化
   */
  _init() {
    this._renderInterestChips();
    this._attachEventListeners();
  }

  /**
   * 興味チップをレンダリング
   */
  _renderInterestChips() {
    const categories = Object.values(CONFIG.CATEGORIES);

    this.grid.innerHTML = categories.map(category => `
      <button class="interest-chip" data-id="${category.id}">
        <span class="interest-chip__icon">${category.icon}</span>
        <span class="interest-chip__label">${category.label}</span>
      </button>
    `).join('');
  }

  /**
   * イベントリスナーを設定
   */
  _attachEventListeners() {
    // 興味チップのクリック
    this.grid.querySelectorAll('.interest-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._toggleInterest(chip);
      });
    });

    // 送信ボタン
    this.submitBtn.addEventListener('click', () => {
      this._handleSubmit();
    });
  }

  /**
   * 興味の選択/解除
   */
  _toggleInterest(chip) {
    const id = chip.dataset.id;
    const index = this.selectedInterests.indexOf(id);

    if (index === -1) {
      this.selectedInterests.push(id);
      chip.classList.add('selected');
      chip.classList.add('select-bounce');
      setTimeout(() => chip.classList.remove('select-bounce'), 300);
    } else {
      this.selectedInterests.splice(index, 1);
      chip.classList.remove('selected');
    }

    this._updateSubmitButton();
  }

  /**
   * 送信ボタンの状態を更新
   */
  _updateSubmitButton() {
    const isValid = this.selectedInterests.length >= 3;
    this.submitBtn.disabled = !isValid;

    if (isValid) {
      this.submitBtn.textContent = '探索を始める';
    } else {
      const remaining = 3 - this.selectedInterests.length;
      this.submitBtn.textContent = `あと${remaining}つ選択してください`;
    }
  }

  /**
   * 送信処理
   */
  _handleSubmit() {
    if (this.selectedInterests.length < 3) return;

    // プロファイルを作成
    const profile = {
      id: Helpers.generateId(),
      createdAt: new Date().toISOString(),
      initialInterests: [...this.selectedInterests],
      categoryScores: this._initializeScores(),
      settings: {
        language: 'ja',
        topicsPerRefresh: CONFIG.TOPICS_PER_REFRESH,
        animationsEnabled: true
      }
    };

    // 保存
    this.storage.setProfile(profile);

    // 完了コールバック
    this.onComplete(profile, this.selectedInterests);
  }

  /**
   * 初期スコアを設定
   */
  _initializeScores() {
    const scores = {};

    for (const category of Object.keys(CONFIG.CATEGORIES)) {
      // 選択されたカテゴリは高いスコア、それ以外は低めのスコア
      scores[category] = this.selectedInterests.includes(category) ? 60 : 30;
    }

    return scores;
  }

  /**
   * 表示
   */
  show() {
    this.container.classList.add('active');
  }

  /**
   * 非表示
   */
  hide() {
    this.container.classList.remove('active');
  }

  /**
   * リセット
   */
  reset() {
    this.selectedInterests = [];
    this.grid.querySelectorAll('.interest-chip').forEach(chip => {
      chip.classList.remove('selected');
    });
    this._updateSubmitButton();
  }
}
