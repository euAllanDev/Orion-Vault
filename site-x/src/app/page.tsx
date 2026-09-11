import Link from "next/link";

const structuredData = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Fieldnote", applicationCategory: "BusinessApplication", offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" }, url: "https://fieldnote.app/" };

export default function Home() {
  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <a className="skip-link" href="#content">Pular para conteúdo</a>
    <header className="marketing-nav"><Link className="wordmark" href="/">Fieldnote</Link><nav aria-label="Navegação principal"><Link href="/pricing">Planos</Link><Link className="button secondary" href="/login">Entrar</Link></nav></header>
    <div id="content" className="marketing-wrap">
      <section className="hero"><div><p className="eyebrow">PESQUISA COM RASTREABILIDADE</p><h1>Pesquisa de campo que vira decisão confiável.</h1><p className="lede">Planeje sessões, conecte evidências e compartilhe sínteses que mantêm a fonte à vista.</p><div className="actions"><Link className="button" href="/login">Começar sem cartão</Link><a className="button secondary" href="#como-funciona">Ver como funciona</a></div></div><aside className="hero-card" aria-label="Exemplo de evidência"><p className="eyebrow">ENTREVISTA · 03:04</p><blockquote>“Achei que meus dados sumiriam quando troquei de celular.”</blockquote><span>Onboarding mobile · Confiança</span><div className="tag-row"><span>onboarding</span><span>trust</span></div></aside></section>
      <section className="benefits" aria-label="Benefícios"><article><strong>Fonte preservada</strong><p>Todo insight volta à sessão e à evidência que o sustenta.</p></article><article><strong>Trabalho visível</strong><p>Veja estudos, sessões e sínteses que pedem atenção.</p></article><article><strong>Leitura compartilhável</strong><p>Stakeholders entendem achados sem perder contexto.</p></article></section>
      <section id="como-funciona" className="steps"><p className="eyebrow">DA SESSÃO À DECISÃO</p><h2>Campo, evidência, síntese.</h2><ol><li><b>01</b><div><h3>Planeje estudo</h3><p>Organize objetivo, participantes e sessões.</p></div></li><li><b>02</b><div><h3>Capture evidências</h3><p>Registre citações e observações com contexto.</p></div></li><li><b>03</b><div><h3>Construa sínteses</h3><p>Agrupe fontes em temas que sustentam decisões.</p></div></li></ol></section>
      <section className="closing"><h2>Conhecimento verificável começa no campo.</h2><Link className="button" href="/login">Criar workspace</Link></section>
    </div>
    <footer>© Fieldnote · Pesquisa que mantém origem à vista</footer>
  </main>;
}
