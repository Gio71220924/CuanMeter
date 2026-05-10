/* ============================================================
   app.jsx — CuanMeter root.
   Wires up hash routing, theme persistence, and the Tweaks panel.
   Mounts <App/> into #root via ReactDOM.createRoot.
   ============================================================ */

const { useState: useStateA, useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "fintech",
  "accentHue": "emerald",
  "showMarquee": true,
  "showStocksGrid": true
}/*EDITMODE-END*/;

const THEMES = [
  { id: 'fintech', label: 'Fintech',        desc: 'Clean, fresh, trustworthy' },
  { id: 'dark',    label: 'Dark Dashboard', desc: 'TradingView vibes' },
  { id: 'glass',   label: 'Glassmorphism',  desc: 'Layered, elegan' },
  { id: 'aurora',  label: 'Aurora',         desc: 'Premium gradient' },
  { id: 'brutal',  label: 'Neo-Brutal',     desc: 'Bold, unapologetic' },
];

const ROUTES = ['home', 'average', 'araarb', 'profit', 'amunisi', 'dividen', 'analyzer', 'guides'];

function readRouteFromHash() {
  const h = window.location.hash.slice(1);
  return ROUTES.includes(h) ? h : 'home';
}

function App() {
  const [route, setRoute] = useStateA(readRouteFromHash);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Sync theme to <body data-theme="...">
  useEffectA(() => {
    document.body.dataset.theme = t.theme;
  }, [t.theme]);

  // Hash-based routing
  useEffectA(() => {
    const onHash = () => {
      setRoute(readRouteFromHash());
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r) => {
    window.location.hash = r;
    setRoute(r);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const screen = (() => {
    switch (route) {
      case 'average':  return <AveragePrice />;
      case 'araarb':   return <ARAARB />;
      case 'profit':   return <ProfitCalc />;
      case 'amunisi':  return <Amunisi />;
      case 'dividen':  return <Dividen />;
      case 'analyzer': return <Analyzer />;
      case 'guides':   return <GuidesPage />;
      default:         return <LandingPage onNavigate={navigate} />;
    }
  })();

  return (
    <div className="app-shell">
      <Header
        route={route}
        onNavigate={navigate}
        theme={t.theme}
        onThemeChange={(v) => setTweak('theme', v)}
      />
      <div key={route} className="fade-up" style={{ flex: 1 }}>
        {screen}
      </div>
      <Footer />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Style">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {THEMES.map((th) => (
              <button
                key={th.id}
                onClick={() => setTweak('theme', th.id)}
                style={themeButtonStyle(t.theme === th.id)}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: t.theme === th.id ? 'var(--primary)' : 'var(--fg)',
                  }}
                >
                  {th.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{th.desc}</span>
              </button>
            ))}
          </div>
        </TweakSection>

        <TweakSection title="Konten">
          <TweakToggle
            label="Stock ticker marquee"
            value={t.showMarquee}
            onChange={(v) => setTweak('showMarquee', v)}
          />
          <TweakToggle
            label="Stocks grid (landing)"
            value={t.showStocksGrid}
            onChange={(v) => setTweak('showStocksGrid', v)}
          />
        </TweakSection>

        <TweakSection title="Navigasi">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { id: 'home',     label: 'Landing' },
              { id: 'average',  label: 'Average' },
              { id: 'araarb',   label: 'ARA/ARB' },
              { id: 'profit',   label: 'Profit' },
              { id: 'amunisi',  label: 'Amunisi' },
              { id: 'dividen',  label: 'Dividen' },
              { id: 'analyzer', label: 'Analyzer' },
              { id: 'guides',   label: 'Panduan' },
            ].map((nav) => (
              <button
                key={nav.id}
                onClick={() => navigate(nav.id)}
                style={tweakNavBtn(route === nav.id)}
              >
                {nav.label}
              </button>
            ))}
          </div>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function themeButtonStyle(active) {
  return {
    padding: '10px 12px',
    borderRadius: 8,
    border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
    background: active ? 'var(--primary-soft)' : 'var(--surface)',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    color: 'var(--fg)',
    fontFamily: 'inherit',
  };
}

function tweakNavBtn(active) {
  return {
    padding: '8px 0',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: active ? 'var(--primary)' : 'var(--surface)',
    color: active ? 'var(--primary-fg)' : 'var(--fg)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
