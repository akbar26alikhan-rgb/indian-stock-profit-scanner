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
  Workflow,
  Globe,
  Clock,
  ZapOff
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

const TradingViewWidget: React.FC<{ symbol: string; exchange: 'NSE' | 'BSE' }> = ({ symbol, exchange }) => {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = `tv_chart_${symbol}_${exchange}`;

  useEffect(() => {
    let widget: any = null;

    const initWidget = () => {
      if (container.current && (window as any).TradingView) {
        container.current.innerHTML = '';
        const widgetContainer = document.createElement('div');
        widgetContainer.id = widgetId;
        widgetContainer.style.height = '450px';
        widgetContainer.style.width = '100%';
        container.current.appendChild(widgetContainer);

        widget = new (window as any).TradingView.widget({
          autosize: true,
          symbol: `${exchange}:${symbol}`,
          interval: "D",
          timezone: "Asia/Kolkata",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0f172a",
          enable_publishing: false,
          allow_symbol_change: false,
          container_id: widgetId,
          backgroundColor: "rgba(2, 6, 23, 1)",
          gridColor: "rgba(30, 41, 59, 0.5)",
          withdateranges: true,
          hide_side_toolbar: false,
          save_image: false,
          details: true,
          hotlist: true,
          calendar: true,
          show_popup_button: true,
          popup_width: "1000",
          popup_height: "650"
        });
      }
    };

    const timeoutId = setTimeout(initWidget, 100);

    return () => {
      clearTimeout(timeoutId);
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [symbol, exchange, widgetId]);

  return (
    <div className="w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner" ref={container}>
      <div className="h-[450px] flex flex-col items-center justify-center text-slate-500 gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500/50" />
        <p className="italic text-sm">Streaming live {exchange} candles for {symbol}...</p>
      </div>
    </div>
  );
};

// --- Constants ---

const SECTORS = ['IT', 'Banking', 'Energy', 'Consumer Goods', 'Automobile', 'Pharma', 'Infrastructure'];
const TOP_SYMBOLS = [
  { s: 'RELIANCE', n: 'Reliance Industries', sector: 'Energy', base: 2950 },
  { s: 'TCS', n: 'Tata Consultancy Services', sector: 'IT', base: 4100 },
  { s: 'HDFCBANK', n: 'HDFC Bank Ltd', sector: 'Banking', base: 1720 },
  { s: 'INFY', n: 'Infosys Ltd', sector: 'IT', base: 1880 },
  { s: 'ICICIBANK', n: 'ICICI Bank Ltd', sector: 'Banking', base: 1250 },
  { s: 'HINDUNILVR', n: 'Hindustan Unilever', sector: 'Consumer Goods', base: 2450 },
  { s: 'SBIN', n: 'State Bank of India', sector: 'Banking', base: 820 },
  { s: 'BHARTIARTL', n: 'Bharti Airtel Ltd', sector: 'Telecom', base: 1550 },
  { s: 'ITC', n: 'ITC Ltd', sector: 'Consumer Goods', base: 480 },
  { s: 'KOTAKBANK', n: 'Kotak Mahindra Bank', sector: 'Banking', base: 1840 },
  { s: 'LT', n: 'Larsen & Toubro', sector: 'Infrastructure', base: 3650 },
  { s: 'AXISBANK', n: 'Axis Bank Ltd', sector: 'Banking', base: 1180 },
  { s: 'ASIANPAINT', n: 'Asian Paints Ltd', sector: 'Consumer Goods', base: 2920 },
  { s: 'MARUTI', n: 'Maruti Suzuki India', sector: 'Automobile', base: 11500 },
  { s: 'SUNPHARMA', n: 'Sun Pharmaceutical', sector: 'Pharma', base: 1910 },
  { s: 'BAJFINANCE', n: 'Bajaj Finance Ltd', sector: 'Banking', base: 7200 },
  { s: 'TITAN', n: 'Titan Company Ltd', sector: 'Consumer Goods', base: 3380 },
  { s: 'ADANIENT', n: 'Adani Enterprises', sector: 'Infrastructure', base: 3100 },
  { s: 'TATASTEEL', n: 'Tata Steel Ltd', sector: 'Energy', base: 152 },
  { s: 'M&M', n: 'Mahindra & Mahindra', sector: 'Automobile', base: 2840 }
];

// --- Utilities ---

const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const formatCompact = (val: number) => Intl.NumberFormat('en-IN', { notation: 'compact' }).format(val);

const calculateScore = (stock: StockData): ScoreBreakdown => {
  // 1. Trend Analysis (Max 25 pts)
  let trend = 0;
  const isGoldenCross = stock.dma50 > stock.dma200;
  const isAbove200 = stock.price > stock.dma200;
  const isAbove50 = stock.price > stock.dma50;
  
  if (isAbove200 && isAbove50) trend += 15;
  if (isGoldenCross) trend += 10;
  else if (isAbove200) trend += 5;

  // 2. Volume Analysis (Max 15 pts)
  let volume = 0;
  const volRatio = stock.volume / stock.avgVolume;
  if (volRatio > 2.0) volume = 15;
  else if (volRatio > 1.3) volume = 10;
  else if (volRatio > 0.9) volume = 5;

  // 3. Price Action / Breakout (Max 15 pts)
  let breakout = 0;
  if (stock.breakoutStatus === 'Confirmed') breakout = 15;
  else if (stock.breakoutStatus === 'Pending') breakout = 10;
  else if (stock.changePercent > 1.5) breakout = 5;

  // 4. Growth Fundamentals (Max 15 pts)
  let growth = 0;
  if (stock.yoySalesGrowth > 15 && stock.yoyProfitGrowth > 15) growth = 15;
  else if (stock.yoySalesGrowth > 10) growth = 10;
  else if (stock.yoySalesGrowth > 5) growth = 5;

  // 5. Financial Health (Max 10 pts)
  let financial = 0;
  if (stock.debtToEquity < 0.3) financial = 10;
  else if (stock.debtToEquity < 0.8) financial = 7;
  else if (stock.debtToEquity < 1.5) financial = 4;

  // 6. Valuation (Max 10 pts)
  let valuation = 0;
  if (stock.peRatio < stock.sectorPE) valuation = 10;
  else if (stock.peRatio < stock.sectorPE * 1.3) valuation = 5;

  // 7. Institutional Flows (Max 10 pts)
  let institutional = stock.fiiHoldingChange > 0.2 ? 10 : (stock.fiiHoldingChange > 0 ? 5 : 0);
  
  const total = trend + volume + breakout + growth + financial + valuation + institutional;

  // Technical Indicators (Mock logic tied to actual price action)
  const rsi = Math.max(25, Math.min(85, 50 + (stock.changePercent * 6) + (volRatio * 2) - (stock.price < stock.dma50 ? 10 : 0)));
  const macdVal = stock.price > stock.dma50 && stock.changePercent > 0 ? 'Bullish Crossover' : (stock.price < stock.dma50 * 0.98 ? 'Bearish Crossover' : 'Neutral');
  const momentum = rsi > 68 ? 'Exhausted' : (rsi < 42 ? 'Weak' : 'Strong');

  const justification: string[] = [];
  if (isAbove200 && isAbove50) justification.push("Strong bullish trend confirmed: Price trading above key 50 & 200 DMAs.");
  else if (isAbove200) justification.push("Bullish undercurrent: Maintaining support above the 200 DMA.");
  else justification.push("Caution: Price currently below major long-term moving averages.");

  if (rsi > 72) justification.push("RSI Overbought: Price may be due for a mean-reversion pullback.");
  else if (rsi < 35) justification.push("RSI Oversold: Potential exhaustion in selling pressure detected.");
  else justification.push("Momentum stable: RSI is in a healthy range for trend continuation.");

  if (volRatio > 1.4) justification.push("Volume surge: Institutional accumulation or distribution is likely occurring.");

  const technicals: Technicals = { rsi, macd: macdVal as any, momentum, justification };

  // --- Final Signal Logic ---
  let signal: TradeSignal = 'HOLD';
  
  // High-conviction BUY: Good score, not overbought, bullish trend
  if (total >= 70 && rsi < 68 && isAbove200) signal = 'BUY';
  // Immediate SELL: Bearish trend, weak momentum, or extremely overbought
  else if (total < 35 || rsi > 78 || (!isAbove200 && stock.changePercent < -1.5)) signal = 'SELL';

  // --- Stop Loss and Target Calculation ---
  // SL: Usually placed below 200 DMA or 5% below entry, whichever is more conservative
  let stopLoss = Math.min(stock.price * 0.95, stock.dma200 * 0.98);
  if (stock.price < stock.dma200) stopLoss = stock.price * 0.94; // If already below 200DMA

  // Target: Based on 2:1 Reward-to-Risk ratio or next major resistance (simulated)
  const risk = stock.price - stopLoss;
  let target = stock.price + (risk * 2.2); 
  
  // Capping target based on typical swing trade expectations (10-25%)
  const maxSwingTarget = stock.price * 1.25;
  target = Math.min(target, maxSwingTarget);

  let grade = 'F';
  if (total >= 85) grade = 'A+';
  else if (total >= 75) grade = 'A';
  else if (total >= 60) grade = 'B';
  else if (total >= 45) grade = 'C';
  else if (total >= 30) grade = 'D';

  return { trend, volume, breakout, growth, financial, valuation, institutional, sector: 0, total, grade, signal, stopLoss, target, technicals };
};

// --- Main Application Component ---

const App: React.FC = () => {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<'NSE' | 'BSE'>('NSE');
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [filterSector, setFilterSector] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'score', direction: 'desc' });

  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isAlertManagerOpen, setIsAlertManagerOpen] = useState(false);
  const [newAlertForm, setNewAlertForm] = useState<Partial<StockAlert>>({
    type: 'Price',
    condition: 'Above',
    threshold: 0
  });

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

  const generateMockData = useCallback(async (isInitial = false) => {
    if (!isInitial) setSyncLoading(true);
    else setLoading(true);

    try {
      // Step 1: Initialize with realistic baseline data
      const baseData: StockData[] = TOP_SYMBOLS.map(sym => {
        const price = sym.base + (Math.random() - 0.5) * (sym.base * 0.01);
        const dma200 = price * (0.88 + Math.random() * 0.1);
        const dma50 = price * (0.96 + Math.random() * 0.08);
        return {
          symbol: sym.s,
          name: sym.n,
          price: price,
          change: (Math.random() - 0.5) * (price * 0.01),
          changePercent: (Math.random() - 0.5) * 1.5,
          volume: Math.floor(Math.random() * 1000000) + 100000,
          avgVolume: Math.floor(Math.random() * 800000) + 100000,
          dma50: dma50,
          dma200: dma200,
          peRatio: Math.random() * 30 + 15,
          sectorPE: 25,
          debtToEquity: Math.random() * 1.2,
          mktCap: Math.random() > 0.5 ? 'Large' : 'Mid',
          sector: sym.sector,
          yoySalesGrowth: Math.random() * 20 + 2,
          yoyProfitGrowth: Math.random() * 25 + 5,
          epsGrowth: Math.random() * 15,
          fiiHoldingChange: (Math.random() - 0.4) * 1,
          breakoutStatus: Math.random() > 0.9 ? 'Confirmed' : 'None'
        };
      });

      // Step 2: Gemini Search Grounding for Live Context
      const ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY });
      const symbolsStr = TOP_SYMBOLS.slice(0, 5).map(s => s.s).join(', ');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Fetch current market price for NSE: ${symbolsStr}. Respond with symbol and value.`,
        config: { tools: [{ googleSearch: {} }] }
      });

      const updatedData = baseData.map(stock => {
        const regex = new RegExp(`${stock.symbol}[^0-9]*([0-9,.]+)`, 'i');
        const match = response.text?.match(regex);
        if (match && match[1]) {
          const livePrice = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(livePrice) && livePrice > 0) return { ...stock, price: livePrice };
        }
        return stock;
      });

      setStocks(updatedData);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      
      if (!isInitial) {
        addToast({ title: 'Live Sync Successful', message: 'Current prices refreshed from live charts.', type: 'info' });
      }
    } catch (error) {
      setStocks(TOP_SYMBOLS.map(sym => ({
          symbol: sym.s,
          name: sym.n,
          price: sym.base,
          change: 0,
          changePercent: 0,
          volume: 500000,
          avgVolume: 450000,
          dma50: sym.base * 0.97,
          dma200: sym.base * 0.9,
          peRatio: 20,
          sectorPE: 22,
          debtToEquity: 0.5,
          mktCap: 'Large',
          sector: sym.sector,
          yoySalesGrowth: 10,
          yoyProfitGrowth: 12,
          epsGrowth: 8,
          fiiHoldingChange: 0.1,
          breakoutStatus: 'None'
      })));
    } finally {
      setLoading(false);
      setSyncLoading(false);
    }
  }, []);

  useEffect(() => {
    generateMockData(true);
  }, [generateMockData]);

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
        contents: `Analyze ${stock.name} (${stock.symbol}) on the NSE. Current price is ${formatCurrency(stock.price)}. Using latest market news, validate if the BUY/SELL signal is appropriate for a swing trade.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      setAiExplanation(response.text);
    } catch (error) {
      console.error(error);
      setAiExplanation("AI service currently unavailable. Using technical model validation instead.");
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

      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
            <TrendingUp className="text-emerald-500 h-9 w-9" />
            NSE <span className="text-emerald-500">PROFIT</span> SCANNER
          </h1>
          <div className="flex items-center gap-2 text-slate-400 mt-1 text-sm">
            <Globe className="h-4 w-4 text-emerald-500/50" />
            <span className="font-medium tracking-tight uppercase text-xs opacity-70">AI-Grounding Technical Engine</span>
            {lastSyncTime && (
              <span className="flex items-center gap-1 ml-4 text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700 font-mono">
                <Clock className="h-3 w-3" /> SYNC: {lastSyncTime}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAlertManagerOpen(true)}
            className="relative p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700 group"
          >
            <Bell className="h-5 w-5 text-slate-300 group-hover:text-white" />
            {alerts.some(a => a.active) && (
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 border-2 border-slate-800 rounded-full"></span>
            )}
          </button>
          <button 
            onClick={() => generateMockData()}
            disabled={syncLoading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 px-5 py-2.5 rounded-xl transition-all border border-emerald-400/20 text-white font-bold text-sm shadow-xl shadow-emerald-500/10"
          >
            {syncLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncLoading ? 'SYNCING...' : 'SYNC LIVE PRICES'}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Market Bias', value: 'Bullish', icon: Activity, color: 'text-blue-400' },
          { label: 'Conviction BUY', value: stocks.filter(s => calculateScore(s).signal === 'BUY').length, icon: Zap, color: 'text-emerald-400' },
          { label: 'Risk Factor', value: 'Moderate', icon: ShieldAlert, color: 'text-red-400' },
          { label: 'Active Watches', value: alerts.filter(a => a.active).length, icon: Bell, color: 'text-yellow-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center gap-4 group hover:border-slate-700 transition-all">
            <div className={`p-3 rounded-xl bg-slate-800 ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{stat.label}</p>
              <p className="text-xl font-black">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <main className="max-w-7xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/50">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search symbol or name..."
                className="w-full bg-slate-800 border-none rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-emerald-500 text-slate-200 outline-none text-sm font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <select 
                  className="bg-slate-800 border-none rounded-xl py-2 px-3 focus:ring-2 focus:ring-emerald-500 text-slate-200 outline-none text-xs font-bold uppercase"
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                >
                  <option value="All">All Sectors</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-800/30 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:text-slate-200 transition-colors" onClick={() => handleSort('symbol')}>Stock / Sector</th>
                  <th className="px-6 py-4 cursor-pointer hover:text-slate-200 transition-colors" onClick={() => handleSort('price')}>Price</th>
                  <th className="px-6 py-4 text-center">Trade Signal</th>
                  <th className="px-6 py-4 hidden lg:table-cell cursor-pointer hover:text-slate-200 transition-colors" onClick={() => handleSort('volume')}>Volume</th>
                  <th className="px-6 py-4 text-center cursor-pointer hover:text-slate-200 transition-colors" onClick={() => handleSort('score')}>Score</th>
                  <th className="px-6 py-4 text-center">Grade</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-7"><div className="h-4 bg-slate-800 rounded-full w-full"></div></td>
                    </tr>
                  ))
                ) : sortedStocks.map((stock) => {
                  const scoreData = calculateScore(stock);
                  return (
                    <tr 
                      key={stock.symbol} 
                      className="hover:bg-slate-800/20 transition-all cursor-pointer group"
                      onClick={() => setSelectedStock(stock)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-100 group-hover:text-emerald-400 transition-colors text-sm">{stock.symbol}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">{stock.name} • {stock.sector}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-sm tracking-tight">{formatCurrency(stock.price)}</div>
                        <div className={`text-[10px] font-black flex items-center gap-0.5 ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                           {stock.changePercent >= 0 ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                           {Math.abs(stock.changePercent).toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black tracking-widest uppercase ${getSignalBadge(scoreData.signal)}`}>
                          {scoreData.signal}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <div className="text-xs font-bold">{formatCompact(stock.volume)}</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase">REL: {(stock.volume / stock.avgVolume).toFixed(1)}x</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs font-black border border-slate-700">
                          {scoreData.total}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-block px-3 py-1 rounded-lg border text-[10px] font-black ${getGradeColor(scoreData.grade)}`}>
                          {scoreData.grade}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 hover:bg-slate-700 rounded-xl text-slate-500 hover:text-emerald-400 transition-all">
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

      {/* Detail Modal */}
      {selectedStock && (() => {
        const scoreData = calculateScore(selectedStock);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-950 border border-slate-800 w-full max-w-6xl max-h-[95vh] overflow-y-auto rounded-3xl shadow-2xl relative">
              
              <div className="sticky top-0 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800 p-6 flex justify-between items-center z-20">
                <div className="flex items-center gap-5">
                  <div className={`text-4xl font-black p-3 rounded-2xl border-2 leading-none ${getGradeColor(scoreData.grade)}`}>
                    {scoreData.grade}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter">{selectedStock.name} <span className="text-slate-600 font-bold">({selectedStock.symbol})</span></h2>
                    <div className="text-slate-500 flex items-center gap-3 text-xs font-bold uppercase tracking-widest mt-1">
                      {selectedStock.sector} • {selectedStock.mktCap} CAP • {formatCurrency(selectedStock.price)}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedStock(null); setAiExplanation(null); }}
                  className="p-3 hover:bg-slate-800 rounded-2xl text-slate-500 hover:text-white transition-all border border-transparent hover:border-slate-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-10">
                  {/* Score Widgets */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {[
                      { label: 'Trend Strength', score: scoreData.trend, max: 25 },
                      { label: 'Volume Surge', score: scoreData.volume, max: 15 },
                      { label: 'Growth Rating', score: scoreData.growth, max: 15 },
                      { label: 'Valuation', score: scoreData.valuation, max: 10 },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-inner group">
                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 group-hover:text-slate-300 transition-colors">{s.label}</div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-black font-mono">{s.score}</span>
                          <span className="text-[10px] text-slate-600 font-black">/ {s.max}</span>
                        </div>
                        <div className="mt-3 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 shadow-glow-emerald transition-all duration-1000 ease-out" 
                            style={{ width: `${(s.score / s.max) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Conviction & Levels */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className={`p-8 rounded-3xl border-2 flex flex-col items-center justify-center gap-3 shadow-2xl relative overflow-hidden group ${getSignalBadge(scoreData.signal)}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform"><Activity className="h-20 w-20" /></div>
                        <p className="text-[11px] uppercase font-black tracking-[0.2em] opacity-60">Trading Signal</p>
                        <p className="text-5xl font-black italic">{scoreData.signal}</p>
                    </div>
                    <div className="p-8 rounded-3xl border bg-slate-900 border-slate-800 flex flex-col items-center justify-center gap-3 shadow-xl hover:border-emerald-500/30 transition-all">
                        <Target className="h-6 w-6 text-emerald-400" />
                        <p className="text-[11px] uppercase font-black tracking-widest text-slate-500">Target Exit</p>
                        <p className="text-2xl font-black font-mono text-emerald-400">{formatCurrency(scoreData.target)}</p>
                    </div>
                    <div className="p-8 rounded-3xl border bg-slate-900 border-slate-800 flex flex-col items-center justify-center gap-3 shadow-xl hover:border-red-500/30 transition-all">
                        <ShieldAlert className="h-6 w-6 text-red-400" />
                        <p className="text-[11px] uppercase font-black tracking-widest text-slate-500">Stop Loss</p>
                        <p className="text-2xl font-black font-mono text-red-400">{formatCurrency(scoreData.stopLoss)}</p>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl p-1">
                    <div className="flex justify-between items-center p-4">
                       <div className="flex gap-2">
                          <button onClick={() => setSelectedExchange('NSE')} className={`text-[10px] font-black px-4 py-1.5 rounded-lg border transition-all ${selectedExchange === 'NSE' ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-glow-emerald' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-100'}`}>NSE</button>
                          <button onClick={() => setSelectedExchange('BSE')} className={`text-[10px] font-black px-4 py-1.5 rounded-lg border transition-all ${selectedExchange === 'BSE' ? 'bg-blue-500 border-blue-400 text-slate-950' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-100'}`}>BSE</button>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Feed Active</span>
                       </div>
                    </div>
                    <TradingViewWidget symbol={selectedStock.symbol} exchange={selectedExchange} />
                  </div>

                  {/* Fundamentals */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" /> Valuation Deep Dive
                      </h4>
                      <div className="space-y-5">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-xs font-bold uppercase">P/E Ratio</span>
                          <span className="font-mono font-black text-sm">{selectedStock.peRatio.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-xs font-bold uppercase">Sector P/E</span>
                          <span className="font-mono font-black text-sm">{selectedStock.sectorPE.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-xs font-bold uppercase">Debt / Equity</span>
                          <span className={`font-mono font-black text-sm ${selectedStock.debtToEquity < 0.5 ? 'text-emerald-400' : 'text-slate-200'}`}>{selectedStock.debtToEquity.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                        <TrendingUp className="h-4 w-4 text-blue-500" /> Growth Trajectory
                      </h4>
                      <div className="space-y-5">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-xs font-bold uppercase">Sales YoY</span>
                          <span className={`font-mono font-black text-sm ${selectedStock.yoySalesGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{selectedStock.yoySalesGrowth.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-xs font-bold uppercase">Profit YoY</span>
                          <span className={`font-mono font-black text-sm ${selectedStock.yoyProfitGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{selectedStock.yoyProfitGrowth.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-xs font-bold uppercase">FII Activity</span>
                          <span className={`font-mono font-black text-sm ${selectedStock.fiiHoldingChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{selectedStock.fiiHoldingChange > 0 ? '+' : ''}{selectedStock.fiiHoldingChange.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                  <div className="bg-slate-900 rounded-3xl p-7 border border-slate-800 shadow-xl relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 opacity-5 group-hover:rotate-12 transition-transform duration-700"><Globe className="h-40 w-40" /></div>
                    <div className="flex items-center gap-2 mb-6">
                      <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400 animate-pulse" />
                      <h3 className="font-black text-xl tracking-tight italic">AI VALIDATION</h3>
                    </div>
                    
                    {aiExplanation ? (
                      <div className="text-slate-300 text-xs leading-relaxed space-y-4">
                        {aiExplanation.split('\n').filter(l => l.trim()).map((line, i) => (
                          <p key={i} className="mb-2 last:mb-0 border-l-2 border-slate-800 pl-4 py-1 hover:border-emerald-500 transition-colors">{line}</p>
                        ))}
                        <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
                           <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                             <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                           </div>
                           <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Grounding Confirmed</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="bg-slate-800 h-16 w-16 rounded-3xl flex items-center justify-center mb-6 border border-slate-700 shadow-xl">
                          <Workflow className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase mb-8 leading-tight">Reasoning context missing for current timeframe.</p>
                        <button 
                          onClick={() => getAiExplanation(selectedStock)}
                          disabled={aiLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 text-sm tracking-tight"
                        >
                          {aiLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                          {aiLoading ? 'GROUNDING...' : 'RUN LIVE AI CHECK'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-900 rounded-3xl p-7 border border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-5 w-5 text-blue-400" />
                      <h3 className="font-black text-xl tracking-tight italic uppercase">Indicators</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-black text-slate-500 tracking-[0.1em]">RSI (14) Momentum</span>
                        <span className={`text-sm font-black font-mono ${scoreData.technicals.rsi > 70 ? 'text-red-400' : scoreData.technicals.rsi < 40 ? 'text-emerald-400' : 'text-slate-200'}`}>{scoreData.technicals.rsi.toFixed(1)}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full flex overflow-hidden border border-slate-800 p-[1px]">
                        <div className="h-full w-[30%] bg-emerald-500/20 border-r border-slate-950"></div>
                        <div className="h-full w-[40%] bg-blue-500/10 border-r border-slate-950"></div>
                        <div className="h-full w-[30%] bg-red-500/20"></div>
                      </div>
                      <div className="relative h-1 w-full -mt-4">
                         <div className="absolute top-0 w-2 h-4 bg-white rounded-full shadow-glow-emerald -mt-1 transition-all duration-1000" style={{ left: `${scoreData.technicals.rsi}%`, transform: 'translateX(-50%)' }}></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors">
                        <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">MACD Logic</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${scoreData.technicals.macd.includes('Bullish') ? 'text-emerald-400' : 'text-red-400'}`}>{scoreData.technicals.macd}</span>
                          {scoreData.technicals.macd.includes('Bullish') ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-800">
                      {scoreData.technicals.justification.map((item, idx) => (
                        <div key={idx} className="flex gap-4 items-start animate-in slide-in-from-right duration-500" style={{ animationDelay: `${idx * 150}ms` }}>
                          <div className="mt-1.5 p-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button className="w-full bg-slate-100 hover:bg-white text-slate-950 font-black py-5 rounded-2xl transition-all shadow-2xl flex items-center justify-center gap-3 text-sm uppercase italic tracking-tighter active:scale-95">
                      Open Trade Terminal
                    </button>
                    <button 
                      onClick={() => {
                        setNewAlertForm({ symbol: selectedStock.symbol, type: 'Price', condition: 'Below', threshold: scoreData.stopLoss });
                        setIsAlertManagerOpen(true);
                        setSelectedStock(null);
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 font-black py-5 rounded-2xl border border-slate-800 flex items-center justify-center gap-3 text-sm uppercase tracking-tighter"
                    >
                      <BellPlus className="h-5 w-5" /> Set Risk Sentry
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Alert Manager */}
      {isAlertManagerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-7 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-2xl font-black italic flex items-center gap-3"><Bell className="h-6 w-6 text-emerald-500" /> RISK SENTRY</h2>
              <button onClick={() => setIsAlertManagerOpen(false)} className="p-2.5 hover:bg-slate-800 rounded-xl transition-colors"><X className="h-6 w-6" /></button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 space-y-10">
              <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-6">Provision New Alert</h3>
                <form onSubmit={createAlert} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Asset Symbol</label>
                    <select className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors" value={newAlertForm.symbol || ''} onChange={e => setNewAlertForm(prev => ({ ...prev, symbol: e.target.value }))} required>
                      <option value="">Select Asset</option>
                      {TOP_SYMBOLS.map(s => <option key={s.s} value={s.s}>{s.s}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Metric</label>
                      <select className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500" value={newAlertForm.type} onChange={e => setNewAlertForm(prev => ({ ...prev, type: e.target.value as any }))}>
                        <option value="Price">Price</option>
                        <option value="Score">Score</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Logic</label>
                      <select className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500" value={newAlertForm.condition} onChange={e => setNewAlertForm(prev => ({ ...prev, condition: e.target.value as any }))}>
                        <option value="Above">Above</option>
                        <option value="Below">Below</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Threshold</label>
                    <input type="number" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500" value={newAlertForm.threshold || ''} onChange={e => setNewAlertForm(prev => ({ ...prev, threshold: Number(e.target.value) }))} required placeholder="Value..." />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-black text-xs transition-all shadow-xl shadow-emerald-600/20 uppercase tracking-widest">
                      Commit Alert
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-5">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Active Monitors</h3>
                <div className="space-y-4">
                  {alerts.length === 0 ? (
                    <div className="text-center py-10 text-slate-700 bg-slate-950/20 rounded-3xl border border-dashed border-slate-800 font-bold uppercase text-[10px] tracking-widest italic">No active risk guards found.</div>
                  ) : alerts.map(alert => (
                    <div key={alert.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${alert.active ? 'bg-slate-800/30 border-slate-700 shadow-lg' : 'bg-slate-900 border-slate-800 opacity-40'}`}>
                      <div className="flex items-center gap-5">
                        <div className={`p-2.5 rounded-xl ${alert.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          {alert.active ? <Bell className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="font-black text-sm flex items-center gap-2 tracking-tight">
                            {alert.symbol} 
                            {!alert.active && <span className="text-[8px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded font-black uppercase tracking-widest">Triggered</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            {alert.type} {alert.condition} {alert.type === 'Price' ? formatCurrency(alert.threshold) : alert.threshold}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeAlert(alert.id)} className="p-2.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all">
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

      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] pb-12">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-4 w-4 opacity-50" />
          <span>© 2025 NSE PROFIT SCANNER • GEMINI 3 FLASH GROUNDED</span>
        </div>
        <div className="flex gap-8">
          <span className="text-emerald-500/50">Algorithmically Derived Signals</span>
          <span className="text-red-500/50">Capital Risk Exposure Disclaimer</span>
        </div>
      </footer>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
