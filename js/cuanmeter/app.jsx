/* ============================================================
   app.jsx — CuanMeter root.
   Wires up hash routing and theme state, mounts <App/> via
   ReactDOM.createRoot.
   ============================================================ */

const { useState: useStateA, useEffect: useEffectA } = React;

const ROUTES = ['home', 'average', 'araarb', 'profit', 'amunisi', 'dividen', 'analyzer', 'guides'];

function readRouteFromHash() {
  const h = window.location.hash.slice(1);
  return ROUTES.includes(h) ? h : 'home';
}

function App() {
  const [route, setRoute] = useStateA(readRouteFromHash);
  const [theme, setTheme] = useStateA('fintech');

  // Sync theme to <body data-theme="...">
  useEffectA(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

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
        theme={theme}
        onThemeChange={setTheme}
      />
      <div key={route} className="fade-up" style={{ flex: 1 }}>
        {screen}
      </div>
      <Footer />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
