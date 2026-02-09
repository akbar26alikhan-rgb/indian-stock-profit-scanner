import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Filter, 
  Activity, 
  ChevronUp, 
  ChevronDown, 
  BarChart3, 
  Info, 
  ExternalLink,
  ShieldCheck,
  Zap,
  RefreshCw,
  X,
  PieChart,
  ArrowRight,
  Bell,
  BellPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Target,
  ShieldAlert,
  Gauge,
  Workflow
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- Types & Interfaces ---

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  dma50: number;
  dma200: number;
  peRatio: number;
  sectorPE: number;
  debtToEquity: number;
  mktCap: 'Large' | 'Mid' | 'Small';
  sector: string;
  yoySalesGrowth: number;
  yoyProfitGrowth: number;
  epsGrowth: number;
  fiiHoldingChange: number;
  breakoutStatus: 'Confirmed' | 'Pending' | 'None';
}

type TradeSignal = 'BUY' | 'SELL' | 'HOLD';

interface Technicals {
  rsi: number;
  macd: 'Bullish Crossover' | 'Bearish Crossover' | 'Neutral';
  momentum: 'Strong' | 'Weak' | 'Exhausted';
  justification: string[];
}

interface ScoreBreakdown {
  trend: number;
  volume: number;
  breakout: number;
  growth: number;
  financial: number;
  valuation: number;
  institutional: number;
  sector: number;
  total: number;
  grade: string;
  signal: TradeSignal;
  stopLoss: number;
  target: number;
  technicals: Technicals;
}

interface StockAlert {
  id: string;
  symbol: string;
  type: 'Price' | 'Score';
  condition: 'Above' | 'Below';
  threshold: number;
  active: boolean;
  createdAt: number;
}

interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'alert';
}

// --- Components ---

const TradingViewWidget: React.FC<{ symbol: string }> = ({ symbol }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current && (window as any).TradingView) {
      container.current.innerHTML = '';
      const widgetContainer = document.createElement('div');
      widgetContainer.id = `tv_chart_${symbol}`;
      widgetContainer.style.height = '400px';
      widgetContainer.style.width = '100%';
      container.current.appendChild(widgetContainer);

      new (window as any).TradingView.widget({
        autosize: true,
        symbol: `NSE:${symbol}`,
        interval: "D",
        timezone: "Asia/Kolkata",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#f1f3f6",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        container_id: widgetContainer.id,
        backgroundColor: "rgba(2, 6, 23, 1)",
        gridColor: "rgba(30, 41, 59, 0.5)",
      });
    }
  }, [symbol]);

  return (
    <div className="w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800" ref={container}>
      <div className="h-[400px] flex items-center justify-center text-slate-500 italic text-sm">
        Initializing Interactive NSE Chart...
      </div>
    </div>
  );
};

// --- Mock Data Constants ---

const SECTORS = ['IT', 'Banking', 'Energy', 'Consumer Goods', 'Automobile', 'Pharma', 'Infrastructure'];
const TOP_SYMBOLS = [
  { s: 'RELIANCE', n: 'Reliance Industries', sector: 'Energy' },
  { s: 'TCS', n: 'Tata Consultancy Services', sector: 'IT' },
  { s: 'HDFCBANK', n: 'HDFC Bank Ltd', sector: 'Banking' },
  { s: 'INFY', n: 'Infosys Ltd', sector: 'IT' },
  { s: 'ICICIBANK', n: 'ICICI Bank Ltd', sector: 'Banking' },
  { s: 'HINDUNILVR', n: 'Hindustan Unilever', sector: 'Consumer Goods' },
  { s: 'SBIN', n: 'State Bank of India', sector: 'Banking' },
  { s: 'BHARTIARTL', n: 'Bharti Airtel Ltd', sector: 'Telecom' },
  { s: 'ITC', n: 'ITC Ltd', sector: 'Consumer Goods' },
  { s: 'KOTAKBANK', n: 'Kotak Mahindra Bank', sector: 'Banking' },
  { s: 'LT', n: 'Larsen & Toubro', sector: 'Infrastructure' },
  { s: 'AXISBANK', n: 'Axis Bank Ltd', sector: 'Banking' },
  { s: 'ASIANPAINT', n: 'Asian Paints Ltd', sector: 'Consumer Goods' },
  { s: 'MARUTI', n: 'Maruti Suzuki India', sector: 'Automobile' },
  { s: 'SUNPHARMA', n: 'Sun Pharmaceutical', sector: 'Pharma' },
  { s: 'BAJFINANCE', n: 'Bajaj Finance Ltd', sector: 'Banking' },
  { s: 'TITAN', n: 'Titan Company Ltd', sector: 'Consumer Goods' },
  { s: 'ADANIENT', n: 'Adani Enterprises', sector: 'Infrastructure' },
  { s: 'TATASTEEL', n: 'Tata Steel Ltd', sector: 'Energy' },
  { s: 'M&M', n: 'Mahindra & Mahindra', sector: 'Automobile' }
];

// --- Utilities ---

const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const formatCompact = (val: number) => Intl.NumberFormat('en-IN', { notation: 'compact' }).format(val);

const calculateScore = (stock: StockData): ScoreBreakdown => {
  let trend = 0;
  if (stock.price > stock.dma200 && stock.dma50 > stock.dma200) trend = 20;
  else if (stock.price > stock.dma200) trend = 15;
  else if (Math.abs(stock.price - stock.dma200) / stock.dma200 < 0.02) trend = 10;
  else if (stock.price < stock.dma200 && stock.changePercent > 0) trend = 5;

  let volume = 0;
  const volRatio = stock.volume / stock.avgVolume;
  if (volRatio > 2) volume = 15;
  else if (volRatio > 1.2) volume = 10;
  else if (volRatio > 0.8) volume = 5;

  let breakout = 0;
  if (stock.breakoutStatus === 'Confirmed') breakout = 15;
  else if (stock.breakoutStatus === 'Pending') breakout = 10;
  else breakout = 5;

  let growth = 0;
  if (stock.yoySalesGrowth > 15 && stock.yoyProfitGrowth > 15) growth = 20;
  else if (stock.yoySalesGrowth > 10) growth = 15;
  else if (stock.yoySalesGrowth > 5) growth = 10;
  else growth = 5;

  let financial = 0;
  if (stock.debtToEquity < 0.5) financial = 10;
  else if (stock.debtToEquity < 1) financial = 7;
  else if (stock.debtToEquity < 2) financial = 4;

  let valuation = 0;
  if (stock.peRatio < stock.sectorPE) valuation = 10;
  else if (stock.peRatio < stock.sectorPE * 1.2) valuation = 7;
  else if (stock.peRatio < stock.sectorPE * 2) valuation = 4;

  let institutional = stock.fiiHoldingChange > 0 ? 5 : (stock.fiiHoldingChange === 0 ? 3 : 0);
  
  let sectorScore = SECTORS.indexOf(stock.sector) % 2 === 0 ? 5 : 3;

  const total = trend + volume + breakout + growth + financial + valuation + institutional + sectorScore;

  let grade = 'F';
  if (total >= 90) grade = 'A+';
  else if (total >= 80) grade = 'A';
  else if (total >= 70) grade = 'B';
  else if (total >= 60) grade = 'C';
  else if (total >= 40) grade = 'D';

  // --- Technical Indicators Simulation ---
  const rsi = Math.max(20, Math.min(85, 40 + (stock.changePercent * 5) + (Math.random() * 10)));
  const macdVal = stock.price > stock.dma50 ? 'Bullish Crossover' : (stock.price < stock.dma50 * 0.95 ? 'Bearish Crossover' : 'Neutral');
  const momentum = rsi > 70 ? 'Exhausted' : (rsi < 40 ? 'Weak' : 'Strong');

  const justification: string[] = [];
  if (rsi > 70) justification.push("RSI indicates overbought conditions; caution on fresh entries.");
  else if (rsi < 35) justification.push("RSI in oversold territory; potential value reversal zone.");
  else justification.push("RSI is stable, supporting current price consolidation.");

  if (macdVal === 'Bullish Crossover') justification.push("MACD histogram shows bullish convergence above the signal line.");
  else if (macdVal === 'Bearish Crossover') justification.push("MACD crossover detected, suggesting downward short-term pressure.");

  if (stock.volume > stock.avgVolume * 1.5) justification.push("High relative volume confirms the current price action strength.");
  
  const technicals: Technicals = { rsi, macd: macdVal as any, momentum, justification };

  // --- Signal Calculation ---
  let signal: TradeSignal = 'HOLD';
  if (total >= 75 && rsi < 75) signal = 'BUY';
  else if (total < 45 || rsi > 80 || (stock.price < stock.dma200 && stock.changePercent < -2)) signal = 'SELL';

  // Stop Loss & Target Calculation
  const stopLoss = Math.min(stock.dma200, stock.price * 0.94);
  const target = stock.price * (1 + (total / 450) + 0.04);

  return { trend, volume, breakout, growth, financial, valuation, institutional, sector: sectorScore, total, grade, signal, stopLoss, target, technicals };
};

// --- Main Application Component ---

const App: React.FC = () => {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [filterSector, setFilterSector] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'score', direction: 'desc' });

  // Alerts & Notifications State
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isAlertManagerOpen, setIsAlertManagerOpen] = useState(false);
  const [newAlertForm, setNewAlertForm] = useState<Partial<StockAlert>>({
    type: 'Price',
    condition: 'Above',
    threshold: 0
  });

  useEffect(() => {
    generateMockData();
  }, []);

  // Alert Checking Logic
  useEffect(() => {
    if (stocks.length > 0 && alerts.length > 0) {
      alerts.forEach(alert => {
        if (!alert.active) return;
        const stock = stocks.find(s => s.symbol === alert.symbol);
        if (!stock) return;

        const score = calculateScore(stock).total;
        const currentValue = alert.type === 'Price' ? stock.price : score;
        
        const isTriggered = alert.condition === 'Above' 
          ? currentValue >= alert.threshold 
          : currentValue <= alert.threshold;

        if (isTriggered) {
          addToast({
            title: 'Alert Triggered!',
            message: `${stock.symbol} ${alert.type} is ${alert.condition.toLowerCase()} ${alert.threshold}. Current: ${alert.type === 'Price' ? formatCurrency(currentValue) : currentValue}`,
            type: 'alert'
          });
          setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, active: false } : a));
        }
      });
    }
  }, [stocks, alerts]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const generateMockData = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const data: StockData[] = TOP_SYMBOLS.map(sym => {
        const price = Math.random() * 5000 + 100;
        const dma200 = price * (0.8 + Math.random() * 0.4);
        const dma50 = price * (0.9 + Math.random() * 0.2);
        return {
          symbol: sym.s,
          name: sym.n,
          price: price,
          change: (Math.random() - 0.5) * 50,
          changePercent: (Math.random() - 0.4) * 4,
          volume: Math.floor(Math.random() * 1000000) + 50000,
          avgVolume: Math.floor(Math.random() * 800000) + 50000,
          dma50: dma50,
          dma200: dma200,
          peRatio: Math.random() * 40 + 5,
          sectorPE: Math.random() * 30 + 10,
          debtToEquity: Math.random() * 2,
          mktCap: Math.random() > 0.6 ? 'Large' : (Math.random() > 0.3 ? 'Mid' : 'Small'),
          sector: sym.sector,
          yoySalesGrowth: Math.random() * 30 - 5,
          yoyProfitGrowth: Math.random() * 40 - 10,
          epsGrowth: Math.random() * 25,
          fiiHoldingChange: (Math.random() - 0.5) * 2,
          breakoutStatus: Math.random() > 0.8 ? 'Confirmed' : (Math.random() > 0.6 ? 'Pending' : 'None')
        };
      });
      setStocks(data);
      setLoading(false);
    }, 1500);
  }, []);

  const sortedStocks = useMemo(() => {
    let filtered = stocks.filter(s => 
      (filterSector === 'All' || s.sector === filterSector) &&
      (s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      const aScore = calculateScore(a).total;
      const bScore = calculateScore(b).total;
      
      let aVal: any, bVal: any;
      if (sortConfig.key === 'score') {
        aVal = aScore;
        bVal = bScore;
      } else {
        aVal = (a as any)[sortConfig.key];
        bVal = (b as any)[sortConfig.key];
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [stocks, searchTerm, filterSector, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const createAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertForm.symbol || !newAlertForm.threshold) return;

    const alert: StockAlert = {
      id: Math.random().toString(36).substr(2, 9),
      symbol: newAlertForm.symbol,
      type: newAlertForm.type as 'Price' | 'Score',
      condition: newAlertForm.condition as 'Above' | 'Below',
      threshold: Number(newAlertForm.threshold),
      active: true,
      createdAt: Date.now()
    };

    setAlerts(prev => [alert, ...prev]);
    addToast({
      title: 'Alert Created',
      message: `Watching ${alert.symbol} for ${alert.type} ${alert.condition.toLowerCase()} ${alert.threshold}`,
      type: 'success'
    });
    setNewAlertForm({ type: 'Price', condition: 'Above', threshold: 0 });
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    addToast({
      title: 'Alert Removed',
      message: 'The alert has been deleted successfully.',
      type: 'info'
    });
  };

  const getAiExplanation = async (stock: StockData) => {
    setAiLoading(true);
    setAiExplanation(null);
    try {
      const scoreData = calculateScore(stock);
      const ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the following Indian stock data.

Stock: ${stock.name} (${stock.symbol})
Current Price: ${formatCurrency(stock.price)}
Potential Score: ${scoreData.total}/100
Current Signal: ${scoreData.signal}
Proposed Target: ${formatCurrency(scoreData.target)}
Proposed Stop Loss: ${formatCurrency(scoreData.stopLoss)}

DMA Context: 50 DMA at ${formatCurrency(stock.dma50)}, 200 DMA at ${formatCurrency(stock.dma200)}
Volume: ${stock.volume > stock.avgVolume ? 'High Surge' : 'Normal'}

Please provide:
1. SIGNAL VALIDATION: Why is the signal ${scoreData.signal}? 
2. RISK/REWARD: Analyze the Stop Loss and Target levels provided.
3. 1-WEEK OUTLOOK: Short-term price prediction range.
4. SWING TRADING TIPS: Actionable advice for this specific stock.

Keep headings clear and response concise (<200 words).`,
      });
      setAiExplanation(response.text);
    } catch (error) {
      console.error(error);
      setAiExplanation("Failed to generate AI analysis. Please check your API key.");
    } finally {
      setAiLoading(false);
    }
  };

  const getSignalBadge = (signal: TradeSignal) => {
    switch (signal) {
      case 'BUY': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'SELL': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'HOLD': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'A': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'B': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'C': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'D': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'F': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-['Inter']">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-80">
        {toasts.map(toast => (
          <div key={toast.id} className={`p-4 rounded-xl border shadow-2xl animate-in slide-in-from-right-10 duration-300 flex items-start gap-3 ${
            toast.type === 'alert' ? 'bg-red-900/90 border-red-500' : 
            toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500' : 'bg-slate-900/90 border-slate-700'
          }`}>
            {toast.type === 'alert' ? <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" /> : <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />}
            <div className="flex-1">
              <h4 className="font-bold text-sm">{toast.title}</h4>
              <p className="text-xs text-slate-300 mt-1">{toast.message}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="p-1 hover:bg-white/10 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <TrendingUp className="text-emerald-500 h-8 w-8" />
            Indian Stock <span className="text-emerald-500">Profit Scanner</span>
          </h1>
          <p className="text-slate-400 mt-1">Real-time NSE scoring engine with interactive live charts</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAlertManagerOpen(true)}
            className="relative p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
          >
            <Bell className="h-5 w-5" />
            {alerts.some(a => a.active) && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 border-2 border-slate-800 rounded-full"></span>
            )}
          </button>
          <button 
            onClick={generateMockData}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors border border-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 status-glow-success">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            LIVE FEED
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Scanned Stocks', value: stocks.length, icon: Activity, color: 'text-blue-400' },
          { label: 'BUY Signals', value: stocks.filter(s => calculateScore(s).signal === 'BUY').length, icon: Zap, color: 'text-emerald-400' },
          { label: 'Avg Mkt Score', value: Math.round(stocks.reduce((acc, s) => acc + calculateScore(s).total, 0) / (stocks.length || 1)), icon: PieChart, color: 'text-purple-400' },
          { label: 'Active Alerts', value: alerts.filter(a => a.active).length, icon: Bell, color: 'text-yellow-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-slate-800 ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Table Controls */}
          <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search symbol or name..."
                className="w-full bg-slate-800 border-none rounded-lg py-2 pl-10 pr-4 focus:ring-2 focus:ring-emerald-500 text-slate-200 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <select 
                  className="bg-slate-800 border-none rounded-lg py-2 px-3 focus:ring-2 focus:ring-emerald-500 text-slate-200 outline-none text-sm"
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                >
                  <option value="All">All Sectors</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:text-slate-200" onClick={() => handleSort('symbol')}>Stock / Sector</th>
                  <th className="px-6 py-4 cursor-pointer hover:text-slate-200" onClick={() => handleSort('price')}>Price</th>
                  <th className="px-6 py-4 text-center">Signal</th>
                  <th className="px-6 py-4 hidden lg:table-cell cursor-pointer hover:text-slate-200" onClick={() => handleSort('volume')}>Volume</th>
                  <th className="px-6 py-4 text-center cursor-pointer hover:text-slate-200" onClick={() => handleSort('score')}>Score</th>
                  <th className="px-6 py-4 text-center">Grade</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-8"><div className="h-4 bg-slate-800 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : sortedStocks.map((stock) => {
                  const scoreData = calculateScore(stock);
                  return (
                    <tr 
                      key={stock.symbol} 
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer group"
                      onClick={() => setSelectedStock(stock)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">{stock.symbol}</div>
                        <div className="text-xs text-slate-500 font-medium">{stock.name} • {stock.sector}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono font-medium">{formatCurrency(stock.price)}</div>
                        <div className={`text-[10px] flex items-center gap-0.5 ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                           {stock.changePercent >= 0 ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                           {Math.abs(stock.changePercent).toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black tracking-widest ${getSignalBadge(scoreData.signal)}`}>
                          {scoreData.signal}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <div className="text-sm font-medium">{formatCompact(stock.volume)}</div>
                        <div className="text-[10px] text-slate-500">Avg: {formatCompact(stock.avgVolume)}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-sm font-bold border border-slate-700">
                          {scoreData.total}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-block px-3 py-1 rounded border text-xs font-black ${getGradeColor(scoreData.grade)}`}>
                          {scoreData.grade}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-emerald-400">
                          <ArrowRight className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Stock Detail Modal */}
      {selectedStock && (() => {
        const scoreData = calculateScore(selectedStock);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
              <div className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-slate-800 p-6 flex justify-between items-center z-10">
                <div className="flex items-center gap-4">
                  <div className={`text-3xl font-black p-2 rounded-lg border-2 ${getGradeColor(scoreData.grade)}`}>
                    {scoreData.grade}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedStock.name} <span className="text-slate-500 font-normal">({selectedStock.symbol})</span></h2>
                    <p className="text-slate-400 flex items-center gap-2">
                      {selectedStock.sector} • {selectedStock.mktCap} Cap
                      <ExternalLink className="h-3 w-3 inline cursor-pointer hover:text-emerald-400" />
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedStock(null); setAiExplanation(null); }}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Chart and Metrics */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Score Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Trend Strength', score: scoreData.trend, max: 20 },
                      { label: 'Volume Surge', score: scoreData.volume, max: 15 },
                      { label: 'Price Action', score: scoreData.breakout, max: 15 },
                      { label: 'Growth Potential', score: scoreData.growth, max: 20 },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">{s.label}</div>
                        <div className="flex items-end justify-between">
                          <span className="text-xl font-bold">{s.score}</span>
                          <span className="text-[10px] text-slate-500">/ {s.max}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${(s.score / s.max) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary Signal Badge */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 ${getSignalBadge(scoreData.signal)}`}>
                        <p className="text-[10px] uppercase font-black opacity-60">Trading Signal</p>
                        <p className="text-3xl font-black">{scoreData.signal}</p>
                    </div>
                    <div className="p-6 rounded-2xl border bg-slate-800/50 border-emerald-500/20 flex flex-col items-center justify-center gap-2 group cursor-help relative">
                        <Target className="h-5 w-5 text-emerald-400" />
                        <p className="text-[10px] uppercase font-black text-slate-500">Target Level</p>
                        <p className="text-xl font-bold font-mono">{formatCurrency(scoreData.target)}</p>
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-[9px] p-2 rounded border border-slate-700 hidden group-hover:block w-32 text-center shadow-xl">Calculated via resistance proximity & breakout scores.</div>
                    </div>
                    <div className="p-6 rounded-2xl border bg-slate-800/50 border-red-500/20 flex flex-col items-center justify-center gap-2 group cursor-help relative">
                        <ShieldAlert className="h-5 w-5 text-red-400" />
                        <p className="text-[10px] uppercase font-black text-slate-500">Stop Loss</p>
                        <p className="text-xl font-bold font-mono">{formatCurrency(scoreData.stopLoss)}</p>
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-[9px] p-2 rounded border border-slate-700 hidden group-hover:block w-32 text-center shadow-xl">Derived from 200 DMA support levels.</div>
                    </div>
                  </div>

                  {/* Live TradingView Chart */}
                  <div className="relative group">
                    <div className="absolute top-4 left-4 z-10 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-1 rounded backdrop-blur-sm border border-slate-700 pointer-events-none uppercase">Real-Time Canvas</div>
                    <TradingViewWidget symbol={selectedStock.symbol} />
                  </div>

                  {/* Key Fundamental Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
                    <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-800">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                        <ShieldCheck className="h-3 w-3" /> Valuation
                      </h4>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">P/E Ratio</span>
                          <span className="font-mono text-sm">{selectedStock.peRatio.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">Sector P/E</span>
                          <span className="font-mono text-sm">{selectedStock.sectorPE.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">Debt/Equity</span>
                          <span className="font-mono text-sm">{selectedStock.debtToEquity.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-800">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                        <TrendingUp className="h-3 w-3" /> Momentum
                      </h4>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">Sales (YoY)</span>
                          <span className={`font-mono text-sm ${selectedStock.yoySalesGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {selectedStock.yoySalesGrowth.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">Profit (YoY)</span>
                          <span className={`font-mono text-sm ${selectedStock.yoyProfitGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {selectedStock.yoyProfitGrowth.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-sm">Institutional</span>
                          <span className={`font-mono text-sm ${selectedStock.fiiHoldingChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {selectedStock.fiiHoldingChange > 0 ? '+' : ''}{selectedStock.fiiHoldingChange.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: AI Analysis & Action */}
                <div className="space-y-6">
                  {/* AI Analysis Card */}
                  <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                      <h3 className="font-bold text-lg">Gemini Intelligence</h3>
                    </div>
                    
                    {aiExplanation ? (
                      <div className="text-slate-300 text-xs leading-relaxed prose prose-invert overflow-hidden">
                        {aiExplanation.split('\n').map((line, i) => {
                          const isHeading = line.match(/^[0-9.]+\s*[A-Z\s]+:/) || line.match(/^[A-Z\s]+:$/);
                          if (isHeading) {
                            return (
                              <h4 key={i} className="text-emerald-400 font-bold mt-5 mb-2 uppercase text-[9px] tracking-widest border-b border-emerald-500/10 pb-1">
                                {line.replace(':', '')}
                              </h4>
                            );
                          }
                          return <p key={i} className="mb-2 text-slate-300">{line}</p>;
                        })}
                        
                        <div className="mt-6 pt-4 border-t border-slate-700 flex items-center gap-3 bg-slate-900/50 -mx-6 px-6 py-4">
                          <div className="p-2 bg-emerald-500/10 rounded-lg">
                             <CalendarDays className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-500 uppercase font-black">AI Prediction Window</p>
                            <p className="text-[10px] font-bold text-slate-200">Short-Term: 1 Week Outlook</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="bg-slate-900 h-12 w-12 rounded-full flex items-center justify-center mb-4">
                          <Info className="h-6 w-6 text-slate-600" />
                        </div>
                        <p className="text-slate-400 text-xs mb-6">Request a deep-reasoning analysis of current signals.</p>
                        <button 
                          onClick={() => getAiExplanation(selectedStock)}
                          disabled={aiLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                        >
                          {aiLoading ? (
                            <><RefreshCw className="h-4 w-4 animate-spin" /> Querying Gemini...</>
                          ) : (
                            <>Generate AI Report</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* New Technical Deep Dive Section */}
                  <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg space-y-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Workflow className="h-5 w-5 text-blue-400" />
                      <h3 className="font-bold text-lg">Technical Signal Deck</h3>
                    </div>

                    {/* RSI GAUGE */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Gauge className="h-3 w-3" /> RSI (14)</span>
                        <span className={`text-xs font-black ${scoreData.technicals.rsi > 70 ? 'text-red-400' : scoreData.technicals.rsi < 40 ? 'text-emerald-400' : 'text-slate-200'}`}>{scoreData.technicals.rsi.toFixed(1)}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full flex overflow-hidden border border-slate-700">
                        <div className="h-full w-[30%] bg-emerald-500/20 border-r border-slate-700"></div>
                        <div className="h-full w-[40%] bg-blue-500/10 border-r border-slate-700"></div>
                        <div className="h-full w-[30%] bg-red-500/20"></div>
                      </div>
                      <div className="relative h-1 w-full -mt-3">
                         <div 
                           className="absolute top-0 w-1.5 h-3 bg-white rounded-full shadow-glow-emerald -mt-1 transition-all duration-700"
                           style={{ left: `${scoreData.technicals.rsi}%`, transform: 'translateX(-50%)' }}
                         ></div>
                      </div>
                    </div>

                    {/* MACD Badge */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-700">
                        <span className="text-[10px] uppercase font-bold text-slate-500">MACD Histogram</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${scoreData.technicals.macd.includes('Bullish') ? 'text-emerald-400' : 'text-red-400'}`}>{scoreData.technicals.macd}</span>
                          {scoreData.technicals.macd.includes('Bullish') ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
                        </div>
                    </div>

                    {/* Signal Justification Bullets */}
                    <div className="space-y-3 pt-2">
                      {scoreData.technicals.justification.map((item, idx) => (
                        <div key={idx} className="flex gap-3 items-start animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 150}ms` }}>
                          <div className="mt-1 p-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">{item}</p>
                        </div>
                      ))}
                    </div>

                    {/* Target & SL Breakdown */}
                    <div className="pt-4 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase font-black text-emerald-500/50 text-center">Target Exit</p>
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                          <span className="text-xs font-bold font-mono text-emerald-400">{formatCurrency(scoreData.target)}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase font-black text-red-500/50 text-center">Stop Protection</p>
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                          <span className="text-xs font-bold font-mono text-red-400">{formatCurrency(scoreData.stopLoss)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button className="w-full bg-slate-100 hover:bg-white text-slate-950 font-black py-4 rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 text-sm uppercase tracking-tight">
                      Deploy Trade Capital
                    </button>
                    <button 
                      onClick={() => {
                        setNewAlertForm({
                          symbol: selectedStock.symbol,
                          type: 'Price',
                          condition: 'Below',
                          threshold: scoreData.stopLoss
                        });
                        setIsAlertManagerOpen(true);
                        setSelectedStock(null);
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 rounded-xl border border-slate-700 flex items-center justify-center gap-2 text-sm"
                    >
                      <BellPlus className="h-5 w-5" /> Activate Risk Alert
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Alert Manager Modal */}
      {isAlertManagerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2"><Bell className="h-5 w-5 text-emerald-400" /> Alert Manager</h2>
              <button onClick={() => setIsAlertManagerOpen(false)} className="p-2 hover:bg-slate-800 rounded-full"><X className="h-6 w-6" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {/* Alert Creation Form */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">Create New Alert</h3>
                <form onSubmit={createAlert} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block uppercase">Stock Symbol</label>
                    <select 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                      value={newAlertForm.symbol || ''}
                      onChange={e => setNewAlertForm(prev => ({ ...prev, symbol: e.target.value }))}
                      required
                    >
                      <option value="">Select Symbol</option>
                      {TOP_SYMBOLS.map(s => <option key={s.s} value={s.s}>{s.s}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 block uppercase">Metric</label>
                      <select 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                        value={newAlertForm.type}
                        onChange={e => setNewAlertForm(prev => ({ ...prev, type: e.target.value as any }))}
                      >
                        <option value="Price">Price</option>
                        <option value="Score">Score</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 block uppercase">Trigger</label>
                      <select 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                        value={newAlertForm.condition}
                        onChange={e => setNewAlertForm(prev => ({ ...prev, condition: e.target.value as any }))}
                      >
                        <option value="Above">Above</option>
                        <option value="Below">Below</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block uppercase">Value</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                      value={newAlertForm.threshold || ''}
                      onChange={e => setNewAlertForm(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2">
                      <BellPlus className="h-4 w-4" /> Save Alert
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Alerts List */}
              <div>
                <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">Your Active Alerts</h3>
                <div className="space-y-3">
                  {alerts.length === 0 ? (
                    <div className="text-center py-8 text-slate-600">No alerts set yet.</div>
                  ) : alerts.map(alert => (
                    <div key={alert.id} className={`flex items-center justify-between p-4 rounded-xl border ${alert.active ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${alert.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          <Bell className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            {alert.symbol} 
                            {!alert.active && <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 rounded uppercase font-black">Triggered</span>}
                          </div>
                          <div className="text-xs text-slate-500">
                            Notify {alert.type} {alert.condition.toLowerCase()} {alert.type === 'Price' ? formatCurrency(alert.threshold) : alert.threshold}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeAlert(alert.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs pb-12">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <span>© 2025 StockProfitScanner • NSE Real-time Analytics Engine</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-emerald-400 transition-colors">Privacy</a>
          <a href="#" className="hover:text-emerald-400 transition-colors">Terms</a>
          <a href="#" className="hover:text-emerald-400 transition-colors font-bold">Disclaimer: Markets are subject to risk.</a>
        </div>
      </footer>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
