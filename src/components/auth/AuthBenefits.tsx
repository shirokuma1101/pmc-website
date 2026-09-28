export function AuthBenefits() {
  return (
    <aside className="auth-benefits" aria-labelledby="auth-benefits-title">
      <p className="eyebrow">MEMBER BENEFITS</p>
      <h2 id="auth-benefits-title">アカウントでできること</h2>
      <p>活動の投稿や記事へのいいねに加えて、ログイン後は次の機能を利用できます。</p>
      <div className="auth-benefits__item">
        <strong>過去ワールドをダウンロード</strong>
        <p>公開されているPostMineClanの過去ワールドをダウンロードできます。</p>
      </div>
      <div className="auth-benefits__item">
        <strong>サポーターとして応援</strong>
        <p>有料のサポータープランに申し込むと、バッジやプランごとの特典を利用できます。お申し込みは18歳以上の方が対象です。</p>
      </div>
    </aside>
  );
}
