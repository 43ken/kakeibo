import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Transaction, Category, PaymentMethod, PaymentAccount } from '../types';
import { getToday } from '../utils/calculations';

interface Props {
  editTx?: Transaction | null;
  onDone: () => void;
}

// ─── Receipt Item ──────────────────────────────────────────────────────────────
interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  categoryId: string; // category id | 'personal'
}

function parseItems(text: string, totalAmount: number, defaultCatId: string): ReceiptItem[] {
  const skipPattern = /合計|小計|税|消費|お釣|お預|ポイント|割引|値引|discou|coupon|total|subtotal|合　計|お買上|領収|レシート|ありがとう|またのご|TEL|FAX/i;
  const items: ReceiptItem[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  for (const line of lines) {
    const m1 = line.match(/^(.{1,25}?)\s+[¥￥]\s*([\d,，]+)\s*$/);
    const m2 = line.match(/^(.{2,25}?)\s{2,}(\d{2,5})\s*$/);
    const m3 = line.match(/^(.{2,25}?)[*※＊]\s*([\d,，]+)\s*$/);
    const match = m1 ?? m3 ?? m2;
    if (!match) continue;
    const name = match[1].trim();
    const price = parseInt(match[2].replace(/[,，]/g, ''));
    if (skipPattern.test(name)) continue;
    if (price <= 0 || price > totalAmount) continue;
    if (name.length < 2) continue;
    if (/^\d{4}[\/年\-]/.test(name) || /^\d{2,4}[-\d]{6,}$/.test(name)) continue;
    items.push({ id: Math.random().toString(36).slice(2, 9), name, price, categoryId: defaultCatId });
  }
  return items;
}

function detectPaymentMethod(text: string, methods: PaymentMethod[]): string {
  if (/paypay/i.test(text)) return methods.find(m => m.id === 'paypay')?.id ?? 'cash';
  if (/quicpay|quick\s*pay/i.test(text)) return methods.find(m => m.id === 'quicpay')?.id ?? 'cash';
  if (/クレジット|credit card|カード決済|電子マネー/i.test(text)) return methods.find(m => m.id === 'credit')?.id ?? 'cash';
  return 'cash';
}

// ─── Payment Selector ──────────────────────────────────────────────────────────
const PaymentSelector: React.FC<{
  paymentMethods: PaymentMethod[];
  paymentAccounts: PaymentAccount[];
  paymentMethodId: string;
  paymentAccountId: string;
  onMethodChange: (id: string) => void;
  onAccountChange: (id: string) => void;
}> = ({ paymentMethods, paymentAccounts, paymentMethodId, paymentAccountId, onMethodChange, onAccountChange }) => {
  const selectedMethod = paymentMethods.find(pm => pm.id === paymentMethodId);
  return (
    <>
      <div className="section-label">支払方法</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {paymentMethods.map((pm) => (
          <button
            key={pm.id}
            onClick={() => { onMethodChange(pm.id); if (pm.isCash) onAccountChange(''); }}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 13, border: '1.5px solid',
              borderColor: paymentMethodId === pm.id ? 'var(--blue)' : 'var(--sep)',
              background: paymentMethodId === pm.id ? 'rgba(0,122,255,0.1)' : 'var(--card2)',
              color: paymentMethodId === pm.id ? 'var(--blue)' : 'var(--text)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {pm.icon} {pm.name}
          </button>
        ))}
      </div>

      {!selectedMethod?.isCash && paymentAccounts.length > 0 && (
        <>
          <div className="section-label">引き落とし先</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => onAccountChange('')}
              style={{
                padding: '5px 12px', borderRadius: 16, fontSize: 12, border: '1.5px solid',
                borderColor: !paymentAccountId ? 'var(--text3)' : 'var(--sep)',
                background: !paymentAccountId ? 'rgba(142,142,147,0.15)' : 'transparent',
                color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >未選択</button>
            {paymentAccounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => onAccountChange(acc.id)}
                style={{
                  padding: '5px 12px', borderRadius: 16, fontSize: 12, border: '1.5px solid',
                  borderColor: paymentAccountId === acc.id ? acc.color : 'var(--sep)',
                  background: paymentAccountId === acc.id ? `${acc.color}20` : 'transparent',
                  color: paymentAccountId === acc.id ? acc.color : 'var(--text3)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{acc.name}</button>
            ))}
          </div>
        </>
      )}
    </>
  );
};

// ─── Receipt Scanner ───────────────────────────────────────────────────────────
const ReceiptScanner: React.FC<{
  categories: Category[];
  paymentMethods: PaymentMethod[];
  paymentAccounts: PaymentAccount[];
  defaultCategoryId: string;
  onExtracted: (data: Partial<Transaction>) => void;
  onMultiSubmit: (txs: Omit<Transaction, 'id' | 'createdAt'>[]) => void;
}> = ({ categories, paymentMethods, paymentAccounts, defaultCategoryId, onExtracted, onMultiSubmit }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState<{
    storeName: string; date: string; totalAmount: number; items: ReceiptItem[];
  } | null>(null);
  const [error, setError] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('cash');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setImageFile(file); setExtracted(null); setError('');
    setImageUrl(URL.createObjectURL(file));
  };

  const runOCR = async () => {
    if (!imageFile) return;
    setIsProcessing(true); setProgress(0); setError('');
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('jpn', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });
      const { data: { text } } = await worker.recognize(imageFile);
      await worker.terminate();

      const dateMatch = text.match(/(\d{4})[年\/\-.](\d{1,2})[月\/\-.](\d{1,2})/);
      const date = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}`
        : getToday();

      let totalAmount = 0;
      for (const pat of [
        /(?:合\s*計|お買上合計|合　計|TOTAL)[^\d¥￥\n]{0,8}[¥￥]?\s*([\d,，]+)/i,
        /[¥￥]\s*([\d,，]{3,})/,
        /([\d,，]{4,})\s*円/,
      ]) {
        const m = text.match(pat);
        if (m) { totalAmount = parseInt(m[1].replace(/[,，]/g, '')); if (totalAmount > 0) break; }
      }

      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const storeName = lines.find(l => l.length >= 2 && !/^[\d\s¥￥,．.]+$/.test(l) && !/^(TEL|FAX|\d{2,4}[-\d]+)/.test(l)) ?? '';

      const items = parseItems(text, totalAmount, defaultCategoryId);
      setExtracted({ storeName, date, totalAmount, items });

      // OCR から支払方法を自動検出
      setPaymentMethodId(detectPaymentMethod(text, paymentMethods));
    } catch (err) {
      console.error(err);
      setError('OCR処理に失敗しました。別の画像をお試しください。');
    } finally {
      setIsProcessing(false);
    }
  };

  const setItemCategory = (id: string, catId: string) => {
    setExtracted(prev => prev
      ? { ...prev, items: prev.items.map(i => i.id === id ? { ...i, categoryId: catId } : i) }
      : prev
    );
  };

  // カテゴリ別集計
  const grouped = extracted
    ? categories.map(cat => ({
        cat,
        total: extracted.items.filter(i => i.categoryId === cat.id).reduce((s, i) => s + i.price, 0),
        count: extracted.items.filter(i => i.categoryId === cat.id).length,
      })).filter(g => g.total > 0)
    : [];
  const personalTotal = extracted?.items.filter(i => i.categoryId === 'personal').reduce((s, i) => s + i.price, 0) ?? 0;
  const householdTotal = (extracted?.totalAmount ?? 0) - personalTotal;

  const handleItemsSubmit = () => {
    if (!extracted) return;
    const txs = grouped.map(g => ({
      type: 'expense' as const,
      date: extracted.date,
      categoryId: g.cat.id,
      amount: g.total,
      memo: extracted.storeName,
      isPersonal: false,
      paymentMethodId,
      paymentAccountId: paymentAccountId || undefined,
    }));
    if (txs.length > 0) onMultiSubmit(txs);
  };

  const handleNoItemsApply = () => {
    if (!extracted) return;
    onExtracted({
      date: extracted.date,
      amount: Math.max(householdTotal, 0),
      memo: extracted.storeName,
      isPersonal: false,
      paymentMethodId,
      paymentAccountId: paymentAccountId || undefined,
    });
  };

  return (
    <div>
      {/* 撮影/選択ゾーン */}
      <div
        className="receipt-zone"
        onClick={() => fileRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleFile(f); }}
        onDragOver={(e) => e.preventDefault()}
      >
        {imageUrl
          ? <img src={imageUrl} alt="レシート" className="receipt-preview" />
          : <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>レシートを撮影 / 選択</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>タップしてカメラまたはギャラリーを開く</div>
            </>
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {imageFile && !extracted && (
        <button className="btn btn-primary" onClick={runOCR} disabled={isProcessing} style={{ marginBottom: 12 }}>
          {isProcessing ? `読み取り中... ${progress}%` : '🔍 OCR読み取り開始'}
        </button>
      )}
      {isProcessing && (
        <div className="ocr-progress" style={{ marginBottom: 12 }}>
          <div className="ocr-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <div style={{ color: 'var(--red)', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

      {extracted && (
        <div className="fade-in">
          {/* 読み取り結果 */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">読み取り結果</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[{ label: '店名', value: extracted.storeName || '不明' }, { label: '日付', value: extracted.date }]
                .map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text3)', fontSize: 14 }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '0.5px solid var(--sep)' }}>
                <span style={{ color: 'var(--text3)', fontSize: 14 }}>レシート合計（税込）</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>
                  ¥{extracted.totalAmount.toLocaleString('ja-JP')}
                </span>
              </div>
            </div>
          </div>

          {/* 商品リスト（カテゴリ選択あり）*/}
          {extracted.items.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div className="section-label" style={{ marginTop: 0 }}>
                各商品のカテゴリを選択
              </div>
              <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 1px 3px var(--shadow)' }}>
                {extracted.items.map((item) => (
                  <div key={item.id} style={{
                    padding: '10px 16px', borderBottom: '0.5px solid var(--sep)',
                    background: item.categoryId === 'personal' ? 'rgba(255,149,0,0.05)' : 'var(--card)',
                  }}>
                    {/* 商品名と価格 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{
                        fontSize: 14,
                        color: item.categoryId === 'personal' ? 'var(--text3)' : 'var(--text)',
                        textDecoration: item.categoryId === 'personal' ? 'line-through' : 'none',
                        flex: 1, marginRight: 8,
                      }}>
                        {item.name}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, flexShrink: 0, color: item.categoryId === 'personal' ? 'var(--text3)' : 'var(--text)' }}>
                        ¥{item.price.toLocaleString('ja-JP')}
                      </span>
                    </div>
                    {/* カテゴリ選択ピル */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setItemCategory(item.id, cat.id)}
                          style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 11, border: '1.5px solid',
                            borderColor: item.categoryId === cat.id ? cat.color : 'var(--sep)',
                            background: item.categoryId === cat.id ? `${cat.color}20` : 'transparent',
                            color: item.categoryId === cat.id ? cat.color : 'var(--text3)',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {cat.icon} {cat.name}
                        </button>
                      ))}
                      <button
                        onClick={() => setItemCategory(item.id, 'personal')}
                        style={{
                          padding: '3px 10px', borderRadius: 12, fontSize: 11, border: '1.5px solid',
                          borderColor: item.categoryId === 'personal' ? 'var(--orange)' : 'var(--sep)',
                          background: item.categoryId === 'personal' ? 'rgba(255,149,0,0.15)' : 'transparent',
                          color: item.categoryId === 'personal' ? 'var(--orange)' : 'var(--text3)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        👤 個人
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* カテゴリ別集計 */}
              <div className="card" style={{ marginTop: 10 }}>
                {personalTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--orange)' }}>
                      👤 個人分（{extracted.items.filter(i => i.categoryId === 'personal').length}品）
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--orange)' }}>
                      −¥{personalTotal.toLocaleString('ja-JP')}
                    </span>
                  </div>
                )}
                {grouped.map(g => (
                  <div key={g.cat.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text3)' }}>
                      {g.cat.icon} {g.cat.name}（{g.count}品）
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: g.cat.color }}>
                      ¥{g.total.toLocaleString('ja-JP')}
                    </span>
                  </div>
                ))}
                <div style={{ height: '0.5px', background: 'var(--sep)', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>家計分合計</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>
                    ¥{Math.max(householdTotal, 0).toLocaleString('ja-JP')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', padding: '12px 16px', fontSize: 13, color: 'var(--text3)', textAlign: 'center', marginBottom: 12 }}>
              商品明細を自動検出できませんでした。<br />合計金額を手動フォームに反映します。
            </div>
          )}

          {/* 支払方法選択 */}
          <div className="card" style={{ marginBottom: 12 }}>
            <PaymentSelector
              paymentMethods={paymentMethods}
              paymentAccounts={paymentAccounts}
              paymentMethodId={paymentMethodId}
              paymentAccountId={paymentAccountId}
              onMethodChange={(id) => { setPaymentMethodId(id); }}
              onAccountChange={setPaymentAccountId}
            />
          </div>

          {/* 登録ボタン */}
          {extracted.items.length > 0 ? (
            <button
              className="btn btn-success"
              onClick={handleItemsSubmit}
              disabled={grouped.length === 0}
            >
              ✓ カテゴリ別に登録する
            </button>
          ) : (
            <button className="btn btn-success" onClick={handleNoItemsApply}>
              ✓ 手動フォームに反映
            </button>
          )}

          <button
            className="btn btn-ghost"
            style={{ marginTop: 10 }}
            onClick={() => { setExtracted(null); setImageUrl(null); setImageFile(null); }}
          >
            やり直す
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Transaction Form ──────────────────────────────────────────────────────────
const InputPage: React.FC<Props> = ({ editTx, onDone }) => {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<'manual' | 'receipt'>('manual');

  const [date, setDate] = useState(editTx?.date ?? getToday());
  const [categoryId, setCategoryId] = useState(editTx?.categoryId ?? '');
  const [amount, setAmount] = useState(editTx?.amount.toString() ?? '');
  const [memo, setMemo] = useState(editTx?.memo ?? '');
  const [isPersonal, setIsPersonal] = useState(editTx?.isPersonal ?? false);
  const [paymentMethodId, setPaymentMethodId] = useState(editTx?.paymentMethodId ?? 'cash');
  const [paymentAccountId, setPaymentAccountId] = useState(editTx?.paymentAccountId ?? '');

  const isEdit = !!editTx;
  const cats = state.categories;

  useEffect(() => {
    const valid = cats.find((c) => c.id === categoryId);
    if (!valid && cats.length > 0) setCategoryId(cats[0].id);
  }, [cats]);

  const handleReceiptExtracted = (data: Partial<Transaction>) => {
    if (data.date) setDate(data.date);
    if (data.amount) setAmount(data.amount.toString());
    if (data.memo) setMemo(data.memo);
    if (data.isPersonal !== undefined) setIsPersonal(data.isPersonal);
    if (data.paymentMethodId) setPaymentMethodId(data.paymentMethodId);
    if (data.paymentAccountId) setPaymentAccountId(data.paymentAccountId);
    setTab('manual');
  };

  const handleMultiSubmit = (txs: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    txs.forEach((tx) => dispatch({ type: 'ADD_TRANSACTION', payload: tx }));
    onDone();
  };

  const handleSubmit = () => {
    const amt = parseInt(amount.replace(/,/g, ''));
    if (!date || !categoryId || isNaN(amt) || amt <= 0) return;
    if (isEdit && editTx) {
      dispatch({
        type: 'UPDATE_TRANSACTION',
        payload: {
          ...editTx, type: 'expense', date, categoryId, amount: amt, memo, isPersonal,
          paymentMethodId, paymentAccountId: paymentAccountId || undefined,
        },
      });
    } else {
      dispatch({
        type: 'ADD_TRANSACTION',
        payload: {
          type: 'expense', date, categoryId, amount: amt, memo, isPersonal,
          paymentMethodId, paymentAccountId: paymentAccountId || undefined,
        },
      });
    }
    setDate(getToday()); setCategoryId(''); setAmount(''); setMemo('');
    setIsPersonal(false); setPaymentMethodId('cash'); setPaymentAccountId('');
    onDone();
  };

  const isValid = date && categoryId && parseInt(amount.replace(/,/g, '')) > 0;

  return (
    <main className="page fade-in">
      <div className="section-label" style={{ marginTop: 0 }}>{isEdit ? '取引を編集' : '支出を記録'}</div>

      {!isEdit && (
        <div className="segment">
          <button className={`seg-btn${tab === 'manual' ? ' active' : ''}`} onClick={() => setTab('manual')}>
            ✏️ 手動入力
          </button>
          <button className={`seg-btn${tab === 'receipt' ? ' active' : ''}`} onClick={() => setTab('receipt')}>
            📷 レシート読取
          </button>
        </div>
      )}

      {tab === 'receipt' && !isEdit ? (
        <ReceiptScanner
          categories={cats}
          paymentMethods={state.paymentMethods}
          paymentAccounts={state.paymentAccounts}
          defaultCategoryId={cats[0]?.id ?? ''}
          onExtracted={handleReceiptExtracted}
          onMultiSubmit={handleMultiSubmit}
        />
      ) : (
        <>
          <div className="form-section">
            <div className="form-row">
              <label className="form-label">日付</label>
              <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} max={getToday()} />
            </div>
            <div className="form-row">
              <label className="form-label">金額</label>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end', gap: 4 }}>
                <span style={{ color: 'var(--text3)', fontSize: 17 }}>¥</span>
                <input
                  type="number" className="form-input" placeholder="0" value={amount}
                  onChange={(e) => setAmount(e.target.value)} inputMode="numeric" min="1" style={{ maxWidth: 160 }}
                />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">メモ</label>
              <input type="text" className="form-input" placeholder="店名や用途など" value={memo}
                onChange={(e) => setMemo(e.target.value)} maxLength={50} />
            </div>
            <div className="form-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, color: 'var(--text)' }}>個人費用</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>家計集計から除外</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={isPersonal} onChange={(e) => setIsPersonal(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          <div className="section-label">カテゴリ</div>
          <div className="cat-grid">
            {cats.map((cat) => (
              <button key={cat.id} className={`cat-btn${categoryId === cat.id ? ' selected' : ''}`}
                onClick={() => setCategoryId(cat.id)} style={categoryId === cat.id ? { borderColor: cat.color } : {}}>
                <span className="cat-icon">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          <PaymentSelector
            paymentMethods={state.paymentMethods}
            paymentAccounts={state.paymentAccounts}
            paymentMethodId={paymentMethodId}
            paymentAccountId={paymentAccountId}
            onMethodChange={(id) => { setPaymentMethodId(id); if (state.paymentMethods.find(pm => pm.id === id)?.isCash) setPaymentAccountId(''); }}
            onAccountChange={setPaymentAccountId}
          />

          <button className="btn btn-primary" onClick={handleSubmit} disabled={!isValid} style={{ marginTop: 8 }}>
            {isEdit ? '✓ 更新する' : '+ 追加する'}
          </button>
          {isEdit && (
            <button className="btn btn-ghost" onClick={onDone} style={{ marginTop: 12 }}>キャンセル</button>
          )}
        </>
      )}
    </main>
  );
};

export default InputPage;
