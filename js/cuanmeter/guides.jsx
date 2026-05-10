/* ============================================================
   guides.jsx — Education / panduan page with reader modal.
   8 articles across 5 categories, all citing official sources.
   Exposes globals: GuidesPage, GUIDES.
   ============================================================ */

const { useState: useStateG, useMemo: useMemoG } = React;

const GUIDE_CATEGORIES = [
  { id: 'all',      label: 'Semua',    icon: 'book' },
  { id: 'basic',    label: 'Basic',    icon: 'book' },
  { id: 'strategy', label: 'Strategi', icon: 'target' },
  { id: 'risk',     label: 'Risiko',   icon: 'shield' },
  { id: 'income',   label: 'Income',   icon: 'coin' },
  { id: 'tax',      label: 'Pajak',    icon: 'wallet' },
];

const GUIDES = [
  {
    id: 'ara-arb',
    cat: 'basic',
    icon: 'arrows',
    title: 'Apa itu ARA & ARB?',
    excerpt: 'Aturan auto-rejection di IDX yang wajib lo ngerti sebelum nge-haka saham gocap.',
    read: '5 min',
    body: [
      { type: 'p', text: 'ARA (Auto Rejection Atas) dan ARB (Auto Rejection Bawah) adalah batas maksimal kenaikan/penurunan harga saham harian. Kalau harga nyentuh batas ini, transaksi otomatis ditolak Bursa.' },
      { type: 'h', text: 'Aturan ARA Asimetris (sejak 4 Sep 2023)' },
      { type: 'p', text: 'IDX menerapkan tarif ARA berbeda berdasarkan range harga (asimetris). Sementara ARB tetap simetris di 7%.' },
      { type: 'list', items: [
        'Tier 1 — harga Rp 50 sampai Rp 200: ARA = 35%, ARB = 7%',
        'Tier 2 — harga Rp 201 sampai Rp 5.000: ARA = 25%, ARB = 7%',
        'Tier 3 — harga di atas Rp 5.000: ARA = 20%, ARB = 7%',
      ]},
      { type: 'h', text: 'Contoh praktis' },
      { type: 'p', text: 'Saham X harga acuan Rp 1.000 (Tier 2). ARA = Rp 1.250, ARB = Rp 930. Kalau hari ini volume gede dan harga lompat ke Rp 1.250, semua order beli di atas itu auto-rejected sampai sesi berikutnya.' },
      { type: 'tip', text: 'ARA berturut-turut bisa jadi sinyal saham digoreng atau ada sentimen kuat (corporate action, rights issue, dsb). Cek selalu fundamental dulu.' },
    ],
    sources: [
      { name: 'IDX — Pengumuman SE Bursa Auto Rejection', url: 'https://www.idx.co.id/id/berita/pengumuman-bursa' },
      { name: 'IDX — Peraturan No. II-A tentang Perdagangan Efek', url: 'https://www.idx.co.id/id/peraturan/peraturan-bursa' },
    ],
  },
  {
    id: 'average-down',
    cat: 'strategy',
    icon: 'calc',
    title: 'Average Down: Pahlawan atau Jebakan?',
    excerpt: 'Kapan boleh average down dan kapan harusnya cut-loss. Spoiler: gak semua bottom itu real bottom.',
    read: '7 min',
    body: [
      { type: 'p', text: 'Average down = beli ulang saham yang harganya turun dari harga beli pertama, biar harga rata-rata jadi lebih rendah. Kedengaran genius, tapi banyak retail yang malah nyangkut makin dalem karena nge-average tanpa logika.' },
      { type: 'h', text: 'Boleh average down KALAU' },
      { type: 'list', items: [
        'Fundamental perusahaan masih sehat (earnings tumbuh, debt manageable)',
        'Penurunan harga karena sentimen makro/sektoral, bukan masalah perusahaan',
        'Lo masih punya cash >= 50% dari posisi saat ini (jangan all-in)',
        'Harga sudah di area support / valuasi murah (PER atau PBV menarik)',
      ]},
      { type: 'h', text: 'JANGAN average down kalau' },
      { type: 'list', items: [
        'Earnings perusahaan turun atau rugi 2 kuartal beruntun',
        'Ada masalah governance (manajemen ribut, fraud, suspend)',
        'Harga turun karena breakdown teknikal di support kuat',
        'Lo udah all-in dari awal — yang dibutuhin cash, bukan beli lagi',
      ]},
      { type: 'tip', text: 'Aturan praktis: jangan average down lebih dari 2x. Kalau setelah 2x average masih turun >10%, ada masalah besar — cut loss > selamat.' },
    ],
    sources: [
      { name: 'Investopedia — Averaging Down', url: 'https://www.investopedia.com/terms/a/averagedown.asp' },
      { name: 'Bareksa — Edukasi Saham', url: 'https://www.bareksa.com/' },
    ],
  },
  {
    id: 'position-sizing',
    cat: 'risk',
    icon: 'shield',
    title: 'Position Sizing 101',
    excerpt: 'Kenapa "all-in" itu cara tercepat buat porto sultan jadi porto receh. Pakai 2% rule.',
    read: '6 min',
    body: [
      { type: 'p', text: 'Position sizing adalah seni nentuin BERAPA BANYAK uang yang lo masukin ke satu trade — bukan saham mana yang lo beli. Trader pro 80% fokus ke risk management, 20% ke pemilihan saham.' },
      { type: 'h', text: '2% Rule' },
      { type: 'p', text: 'Maksimum loss per trade = 2% dari total modal. Artinya kalau modal Rp 50 juta, maksimum loss yang lo terima per trade = Rp 1 juta.' },
      { type: 'h', text: 'Cara hitung' },
      { type: 'list', items: [
        'Tentukan entry price dan stop loss SEBELUM beli',
        'Risk per share = entry − stop loss',
        'Max shares = (modal × 2%) / risk per share',
        'Bulatkan ke bawah ke kelipatan 100 (1 lot)',
      ]},
      { type: 'h', text: 'Contoh' },
      { type: 'p', text: 'Modal Rp 50jt, mau beli BBRI di Rp 4.500 dengan stop loss Rp 4.300. Risk per share = Rp 200. Max risk = Rp 1jt. Max shares = 5.000 lembar = 50 lot. Modal terpakai = Rp 22,5jt (45% modal).' },
      { type: 'tip', text: 'Trader pemula: pakai 1% rule. Boleh salah 50x sebelum modal habis — cukup buat belajar.' },
    ],
    sources: [
      { name: 'Van Tharp — Trade Your Way to Financial Freedom', url: 'https://www.vantharp.com/' },
      { name: 'Investopedia — Position Sizing', url: 'https://www.investopedia.com/terms/p/positionsizing.asp' },
    ],
  },
  {
    id: 'dividen-vs-cg',
    cat: 'income',
    icon: 'coin',
    title: 'Bedanya Dividen vs Capital Gain',
    excerpt: 'Dua cara cuan dari saham. Yang satu cair tahunan, yang satu cair pas lo jual.',
    read: '4 min',
    body: [
      { type: 'p', text: 'Cuan dari saham ada dua sumber: capital gain (selisih harga jual − harga beli) dan dividen (bagi hasil dari laba perusahaan).' },
      { type: 'h', text: 'Capital Gain' },
      { type: 'list', items: [
        'Cair pas lo JUAL saham di harga lebih tinggi',
        'Pajak: PPh Final 0.1% dari nilai jual (otomatis dipotong broker)',
        'Cocok buat trader, swing, growth investor',
      ]},
      { type: 'h', text: 'Dividen' },
      { type: 'list', items: [
        'Dibayar tahunan (kadang interim) dari laba bersih perusahaan',
        'Pajak: PPh Final 10% (bisa 0% kalau diinvestasikan ulang sesuai PMK 18/2021)',
        'Cocok buat dividend investor, pensiunan, passive income',
      ]},
      { type: 'tip', text: 'Strategi favorit dividen-investor IDX: BBRI, TLKM, ITMG, UNVR, PTBA. Yield 4-9% net per tahun, lumayan buat ngalahin deposito.' },
    ],
    sources: [
      { name: 'OJK — Edukasi Pasar Modal', url: 'https://sikapiuangmu.ojk.go.id/' },
      { name: 'PMK 18/2021 — Pengecualian PPh Dividen', url: 'https://jdih.kemenkeu.go.id/' },
    ],
  },
  {
    id: 'bandarmology',
    cat: 'strategy',
    icon: 'chart',
    title: 'Bandarmology: Ngintilin Smart Money',
    excerpt: 'Cara baca broker summary buat tau siapa yang lagi akumulasi & distribusi.',
    read: '8 min',
    body: [
      { type: 'p', text: 'Bandarmology = analisa pergerakan broker besar (smart money/bandar) buat ngintip arah harga. Premis-nya: bandar punya info & modal lebih, jadi ngikutin mereka biasanya cuan.' },
      { type: 'h', text: 'Komponen utama' },
      { type: 'list', items: [
        'Net Foreign — selisih buy & sell broker asing. Positif = asing akumulasi.',
        'Net Local — institusi lokal (sekuritas BUMN, asuransi, dapen).',
        'Net Retail — kebalikan: positif berarti retail net-buy, sering jadi sinyal "smart money sell to retail".',
      ]},
      { type: 'h', text: 'Pola "Akumulasi Diam-diam"' },
      { type: 'p', text: 'Harga bergerak sideways volume tipis, tapi top buyer 5 broker konsisten beli pelan-pelan di harga rendah. Indikasi bandar lagi ngumpulin barang sebelum mark-up.' },
      { type: 'h', text: 'Pola "Distribusi"' },
      { type: 'p', text: 'Harga naik tipis tapi volume meledak, top seller sama broker yang akumulasi minggu lalu — bandar lagi cuan-out ke retail.' },
      { type: 'tip', text: 'Bandarmology bukan kristal bola. Selalu kombinasikan dengan analisa teknikal dan fundamental. Top broker hari ini bisa beda sama besok.' },
    ],
    sources: [
      { name: 'KSEI — Statistik Pasar Modal', url: 'https://www.ksei.co.id/' },
      { name: 'IDX — Broker Summary', url: 'https://www.idx.co.id/' },
    ],
  },
  {
    id: 'pajak-saham',
    cat: 'tax',
    icon: 'wallet',
    title: 'Pajak Saham di Indonesia',
    excerpt: 'PPh Final, capital gain tax, dividen tax — biar gak kaget pas lapor SPT.',
    read: '6 min',
    body: [
      { type: 'p', text: 'Pajak transaksi saham di Indonesia simpel sebenernya — PPh Final, dipotong otomatis. Tapi banyak retail yang gak tau kalau dividen masih perlu dilaporkan di SPT.' },
      { type: 'h', text: 'Saat menjual saham' },
      { type: 'list', items: [
        'PPh Final 0,1% × nilai transaksi jual',
        'Dipotong otomatis broker, masuk ke fee jual',
        'Tidak perlu lapor lagi di SPT (sudah final)',
      ]},
      { type: 'h', text: 'Saat menerima dividen' },
      { type: 'list', items: [
        'PPh Final 10% × dividen kotor (sebelum 2021: 10% bersifat final)',
        'Sejak PMK 18/2021: bisa 0% kalau dividen diinvestasikan kembali di Indonesia minimal 3 tahun',
        'Wajib disertai Surat Pemberitahuan Investasi (SPI) ke DJP',
      ]},
      { type: 'h', text: 'Capital gain dari saham asing' },
      { type: 'p', text: 'Untuk saham asing (lewat broker luar), capital gain dikenai tarif progresif PPh OP (5-35%) dan WAJIB lapor di SPT 1770. Beda banget sama saham IDX.' },
      { type: 'tip', text: 'Simpan eviden transaksi (buy/sell history) selama minimal 5 tahun. DJP bisa minta verifikasi sewaktu-waktu.' },
    ],
    sources: [
      { name: 'PP No. 14/1997 — Pajak Penghasilan Transaksi Saham', url: 'https://jdih.kemenkeu.go.id/' },
      { name: 'PMK 18/2021 — Pengecualian PPh Dividen', url: 'https://jdih.kemenkeu.go.id/' },
      { name: 'UU No. 7/2021 (UU HPP)', url: 'https://jdih.kemenkeu.go.id/' },
    ],
  },
  {
    id: 'fundamental-101',
    cat: 'basic',
    icon: 'book',
    title: 'Analisa Fundamental 101',
    excerpt: 'PER, PBV, ROE, DER — ngerti dulu ratio dasar sebelum beli saham.',
    read: '7 min',
    body: [
      { type: 'p', text: 'Analisa fundamental = ngecek "kondisi kesehatan" perusahaan dari laporan keuangan. Ada 4 ratio yang wajib dipantau retail.' },
      { type: 'h', text: 'PER (Price to Earnings Ratio)' },
      { type: 'p', text: 'PER = Harga saham / Laba per Saham (EPS). Makin rendah makin murah, tapi konteksnya penting. Sektor bank biasanya PER 8-12, sektor consumer 20-30, sektor teknologi bisa 50+.' },
      { type: 'h', text: 'PBV (Price to Book Value)' },
      { type: 'p', text: 'PBV = Harga saham / Nilai Buku per Saham. PBV < 1 = lo beli saham di bawah nilai aset bersihnya. Tapi awas value trap — kadang PBV rendah karena aset bermasalah.' },
      { type: 'h', text: 'ROE (Return on Equity)' },
      { type: 'p', text: 'ROE = Laba Bersih / Ekuitas. Indikator efisiensi. ROE > 15% = bagus, > 20% = excellent. BBCA, BBRI, UNVR konsisten di atas 18%.' },
      { type: 'h', text: 'DER (Debt to Equity Ratio)' },
      { type: 'p', text: 'DER = Total Hutang / Ekuitas. Lebih rendah lebih aman. DER < 1 (<100%) umumnya sehat. Sektor bank dan utility wajar DER tinggi karena nature of business.' },
      { type: 'tip', text: 'Jangan pakai 1 ratio doang. Cek ke-4 ratio + tren-nya selama 3-5 tahun. Saham bagus = ROE tinggi konsisten + DER rendah + earnings growth positif.' },
    ],
    sources: [
      { name: 'Investopedia — Fundamental Analysis', url: 'https://www.investopedia.com/terms/f/fundamentalanalysis.asp' },
      { name: 'Bareksa — Edukasi Saham', url: 'https://www.bareksa.com/' },
      { name: 'Stockbit — Belajar Saham', url: 'https://stockbit.com/' },
    ],
  },
  {
    id: 'cut-loss',
    cat: 'risk',
    icon: 'arrow_left',
    title: 'Cut Loss Bukan Aib',
    excerpt: 'Disiplin cut loss adalah hal yang misahin trader pemula sama trader yang survive >5 tahun.',
    read: '5 min',
    body: [
      { type: 'p', text: 'Cut loss = jual saham di harga lebih rendah dari beli, sebelum kerugian membesar. Banyak retail anti cut-loss karena ego ("nanti juga balik lagi"). Padahal disiplin cut loss = kunci survival.' },
      { type: 'h', text: 'Kapan harus cut loss' },
      { type: 'list', items: [
        'Harga break support kuat dengan volume tinggi',
        'Fundamental perusahaan turun (earnings rugi, ada fraud)',
        'Stop loss rule lo udah ke-trigger (misal −7% dari entry)',
        'Asumsi entry awal udah gak valid lagi',
      ]},
      { type: 'h', text: 'Math of Recovery' },
      { type: 'list', items: [
        'Loss 10% → butuh +11% buat balik modal',
        'Loss 20% → butuh +25% buat balik modal',
        'Loss 50% → butuh +100% (DOUBLE) buat balik modal',
        'Loss 80% → butuh +400% buat balik modal',
      ]},
      { type: 'tip', text: 'Set stop loss SEBELUM lo beli, bukan setelah lo nyangkut. Pakai limit/stop order biar gak goyang sama emosi.' },
    ],
    sources: [
      { name: 'Investopedia — Stop Loss Order', url: 'https://www.investopedia.com/terms/s/stop-lossorder.asp' },
      { name: 'Mark Minervini — Trade Like a Stock Market Wizard', url: 'https://www.minervini.com/' },
    ],
  },
];

/* ---------- Guide card ---------- */
function GuideCard({ guide, onOpen }) {
  return (
    <button
      onClick={() => onOpen(guide)}
      className="card interactive"
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: 'pointer',
        textAlign: 'left',
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius)',
            background: 'var(--primary-soft)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={guide.icon} size={20} />
        </div>
        <span
          style={{
            fontSize: 11,
            color: 'var(--fg-muted)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {guide.read}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--primary)',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {GUIDE_CATEGORIES.find((c) => c.id === guide.cat)?.label || guide.cat}
      </div>
      <h3 style={{ fontSize: 19, letterSpacing: '-0.025em', lineHeight: 1.2 }}>{guide.title}</h3>
      <p
        style={{
          fontSize: 14,
          color: 'var(--fg-muted)',
          lineHeight: 1.55,
          margin: 0,
          flexGrow: 1,
        }}
      >
        {guide.excerpt}
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--primary)',
        }}
      >
        Baca panduan <Icon name="arrow_right" size={12} />
      </div>
    </button>
  );
}

/* ---------- Reader modal ---------- */
function GuideReader({ guide, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflow: 'auto',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 760,
          width: '100%',
          padding: 'clamp(28px, 5vw, 48px)',
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24,
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--primary)',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {GUIDE_CATEGORIES.find((c) => c.id === guide.cat)?.label}
              </span>
              <span style={{ color: 'var(--fg-faint)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 700 }}>
                {guide.read}
              </span>
            </div>
            <h1
              style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                marginBottom: 8,
              }}
            >
              {guide.title}
            </h1>
            <p style={{ fontSize: 16, color: 'var(--fg-muted)', lineHeight: 1.55, margin: 0 }}>
              {guide.excerpt}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup panduan"
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 999,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--fg)',
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            fontSize: 16,
            lineHeight: 1.7,
            color: 'var(--fg)',
          }}
        >
          {guide.body.map((b, i) => {
            if (b.type === 'h') {
              return (
                <h2 key={i} style={{ fontSize: 22, marginTop: 12, letterSpacing: '-0.02em' }}>
                  {b.text}
                </h2>
              );
            }
            if (b.type === 'p') {
              return (
                <p key={i} style={{ color: 'var(--fg-muted)', margin: 0 }}>
                  {b.text}
                </p>
              );
            }
            if (b.type === 'list') {
              return (
                <ul
                  key={i}
                  style={{
                    paddingLeft: 0,
                    margin: 0,
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {b.items.map((it, j) => (
                    <li
                      key={j}
                      style={{ display: 'flex', gap: 12, color: 'var(--fg-muted)' }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          marginTop: 9,
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: 'var(--primary)',
                        }}
                      />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            if (b.type === 'tip') {
              return (
                <div
                  key={i}
                  style={{
                    padding: 18,
                    background: 'var(--primary-soft)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }}
                  >
                    <Icon name="info" size={18} />
                  </span>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--fg)' }}>
                    <strong style={{ color: 'var(--primary)' }}>TIPS:</strong> {b.text}
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>

        {guide.sources && guide.sources.length > 0 && (
          <div
            style={{
              marginTop: 32,
              padding: 24,
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Icon name="book" size={16} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-muted)',
                }}
              >
                Sumber & Referensi
              </span>
            </div>
            <ol
              style={{
                margin: 0,
                paddingLeft: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {guide.sources.map((s, i) => (
                <li
                  key={i}
                  style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.5 }}
                >
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--primary)',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    {s.name} <span style={{ fontSize: 10 }}>↗</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>
            Last updated: Mei 2026 · CuanMeter Edu
          </span>
          <button onClick={onClose} className="btn btn-secondary">
            Tutup panduan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Guides page ---------- */
function GuidesPage() {
  const [cat, setCat] = useStateG('all');
  const [open, setOpen] = useStateG(null);
  const [search, setSearch] = useStateG('');

  const filtered = useMemoG(() => {
    let g = cat === 'all' ? GUIDES : GUIDES.filter((x) => x.cat === cat);
    if (search.trim()) {
      const s = search.toLowerCase();
      g = g.filter(
        (x) => x.title.toLowerCase().includes(s) || x.excerpt.toLowerCase().includes(s),
      );
    }
    return g;
  }, [cat, search]);

  return (
    <main style={{ padding: '48px 0 80px' }}>
      <div className="container">
        <div className="fade-up" style={{ marginBottom: 40, maxWidth: 720 }}>
          <div className="badge" style={{ marginBottom: 16 }}>
            <Icon name="book" size={12} />
            <span>PANDUAN · BELAJAR DULU, CUAN KEMUDIAN</span>
          </div>
          <h1
            style={{
              fontSize: 'clamp(36px, 5vw, 56px)',
              marginBottom: 12,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
            }}
          >
            Semua yang lo butuhin
            <br />
            buat{' '}
            <span style={{ color: 'var(--primary)' }}>jadi trader yang gak ngutang</span>.
          </h1>
          <p style={{ fontSize: 17, color: 'var(--fg-muted)', lineHeight: 1.5, margin: 0 }}>
            8 panduan praktis dari basic sampai strategi. Bahasa Gen Z, sumbernya jelas, gak
            kelamaan.
          </p>
        </div>

        {/* search + filter bar */}
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 24,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flex: '1 1 240px',
              minWidth: 200,
              gap: 10,
              alignItems: 'center',
              padding: '8px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <Icon name="target" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari panduan..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 14,
                color: 'var(--fg)',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GUIDE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                style={{
                  padding: '8px 14px',
                  background: cat === c.id ? 'var(--primary)' : 'var(--surface-2)',
                  color: cat === c.id ? 'var(--primary-fg)' : 'var(--fg)',
                  border: '1px solid ' + (cat === c.id ? 'var(--primary)' : 'var(--border)'),
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon name={c.icon} size={14} />
                {c.label}
                {c.id !== 'all' && (
                  <span style={{ fontSize: 11, opacity: 0.7 }}>
                    {GUIDES.filter((g) => g.cat === c.id).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 16, color: 'var(--fg-muted)' }}>
              Tidak ada panduan yang cocok dengan filter.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {filtered.map((g) => (
              <GuideCard key={g.id} guide={g} onOpen={setOpen} />
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 32,
            padding: 20,
            background: 'var(--bg-soft)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ color: 'var(--info)', flexShrink: 0, marginTop: 2 }}>
            <Icon name="info" size={18} />
          </span>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--fg)' }}>Disclaimer:</strong> Konten edukasi ini bukan
            rekomendasi investasi. Setiap panduan mencantumkan sumber resmi (IDX, OJK, peraturan
            menteri keuangan, atau buku/situs internasional terkemuka). DYOR — Do Your Own
            Research.
          </div>
        </div>

        {open && <GuideReader guide={open} onClose={() => setOpen(null)} />}
      </div>
    </main>
  );
}

Object.assign(window, { GuidesPage, GUIDES });
