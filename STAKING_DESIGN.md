# Solana Native Staking Design Document

## 概要
ILY♡Validatorウェブサイトに、Solanaウォレット接続機能とネイティブステーキング機能を実装する設計書です。

## 機能要件

### 1. ウォレット接続機能
- **サポートウォレット**: Phantom, Solflare, Backpack, Glow, Sollet
- **接続状態管理**: 接続/切断状態の表示
- **自動再接続**: ページリロード時の状態復元

### 2. ステーキング機能
- **バリデーター情報表示**: ILY♡Validator詳細情報
- **ステーク操作**: SOLトークンのステーキング
- **ステーク解除**: アンステーキング機能
- **リワード確認**: ステーキング報酬の表示

### 3. ユーザーインターフェース
- **大型ステークボタン**: メインページの目立つ位置に配置
- **ステーキングモーダル**: ポップアップ形式でのステーキング操作
- **ウォレット情報表示**: 残高、ステーク状況の表示

## 技術仕様

### フロントエンド技術スタック
```
- HTML5/CSS3/JavaScript (ES6+)
- @solana/web3.js (Solana JavaScript SDK)
- @solana/wallet-adapter-base
- @solana/wallet-adapter-wallets
```

### 必要なライブラリ
```html
<!-- Solana Web3.js -->
<script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"></script>

<!-- Wallet Adapters -->
<script src="https://unpkg.com/@solana/wallet-adapter-phantom@latest/lib/index.iife.min.js"></script>
<script src="https://unpkg.com/@solana/wallet-adapter-solflare@latest/lib/index.iife.min.js"></script>
```

## ファイル構成

### 新規作成ファイル
```
├── js/
│   ├── wallet-connect.js      # ウォレット接続管理
│   ├── staking.js            # ステーキング機能
│   └── ui-components.js      # UI コンポーネント
├── css/
│   └── staking.css          # ステーキング専用スタイル
└── STAKING_DESIGN.md        # 本設計書
```

### 既存ファイル修正
```
├── index.html               # ステークボタンとスクリプト追加
├── index.css               # ステークボタンスタイル追加
└── CLAUDE.md               # 開発ガイド更新
```

## 実装フェーズ

### Phase 1: 基本UI実装
1. **ステークボタン追加**
   - LinksセクションにCTAボタン配置
   - レスポンシブデザイン対応

2. **モーダル実装**
   - ステーキング操作用ポップアップ
   - ウォレット選択UI

### Phase 2: ウォレット接続機能
1. **マルチウォレット対応**
   ```javascript
   const supportedWallets = [
     'phantom',
     'solflare', 
     'backpack',
     'glow',
     'sollet'
   ];
   ```

2. **接続状態管理**
   ```javascript
   class WalletManager {
     constructor() {
       this.wallet = null;
       this.connected = false;
     }
     
     async connect(walletName) { /* ... */ }
     async disconnect() { /* ... */ }
     getBalance() { /* ... */ }
   }
   ```

### Phase 3: ステーキング機能実装
1. **バリデーター情報**
   ```javascript
   const VALIDATOR_INFO = {
     address: 'ByszyWdqC3rV​​MWy8f6jwK5cmwkpwYdwsr7UL58xS5vnm',
     name: 'ILY♡Validator',
     commission: '5%',
     description: 'Milady & Remilia community validator'
   };
   ```

2. **ステーキング操作**
   ```javascript
   class StakingManager {
     async createStakeAccount(amount) { /* ... */ }
     async delegateStake(stakeAccount, validatorPubkey) { /* ... */ }
     async deactivateStake(stakeAccount) { /* ... */ }
     async withdrawStake(stakeAccount) { /* ... */ }
   }
   ```

## UI/UXデザイン

### ステークボタンデザイン
```css
.stake-button {
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
  color: white;
  font-size: 1.5rem;
  padding: 20px 40px;
  border-radius: 30px;
  box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3);
  transition: all 0.3s ease;
}

.stake-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 35px rgba(255, 107, 107, 0.4);
}
```

### ステーキングモーダル
- **ヘッダー**: ILY♡Validator情報
- **メイン**: ステーク金額入力フィールド
- **フッター**: アクションボタン（Stake/Cancel）

## セキュリティ考慮事項

### 1. ウォレット接続
- **権限最小化**: 必要最小限の権限のみ要求
- **トランザクション確認**: 全てのトランザクションでユーザー確認

### 2. ステーキング操作
- **金額検証**: 入力値の妥当性チェック
- **エラーハンドリング**: 適切なエラーメッセージ表示

### 3. データ管理
- **秘密鍵管理**: 秘密鍵は一切保存しない
- **状態管理**: ローカルストレージのみ使用

## エラーハンドリング

### 一般的なエラーケース
```javascript
const ERROR_MESSAGES = {
  WALLET_NOT_FOUND: 'ウォレットが見つかりません',
  INSUFFICIENT_BALANCE: '残高が不足しています', 
  TRANSACTION_FAILED: 'トランザクションが失敗しました',
  NETWORK_ERROR: 'ネットワークエラーが発生しました'
};
```

### ユーザーフィードバック
- **ローディング状態**: スピナー表示
- **成功通知**: トーストメッセージ
- **エラー表示**: 詳細なエラーメッセージ

## テスト戦略

### 1. 単体テスト
- ウォレット接続機能
- ステーキング計算ロジック
- UI コンポーネント

### 2. 統合テスト
- ウォレット ↔ ステーキング機能連携
- エラーハンドリング

### 3. ユーザビリティテスト
- モバイルデバイス対応
- 各種ウォレットでの動作確認

## デプロイメント

### 1. 静的ファイル配布
- 既存のNicepage構成を維持
- CDN経由でのライブラリ読み込み

### 2. パフォーマンス最適化
- JavaScript遅延読み込み
- CSS minification

## ロードマップ

### v1.0 (基本機能)
- [x] UI設計
- [ ] ウォレット接続
- [ ] 基本ステーキング

### v1.1 (機能拡張)
- [ ] リワード表示
- [ ] ステーキング履歴
- [ ] モバイル最適化

### v1.2 (高度な機能)
- [ ] 複数バリデーター対応
- [ ] 自動複利計算
- [ ] 通知機能

## 開発優先順位

1. **High Priority**
   - ステークボタンUI実装
   - Phantomウォレット接続
   - 基本ステーキング機能

2. **Medium Priority**
   - 複数ウォレット対応
   - エラーハンドリング強化
   - モバイル対応

3. **Low Priority**
   - アニメーション効果
   - 高度なUI改善
   - 分析機能

---

*このドキュメントは実装の進行に伴い随時更新されます。*