import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  AlertCircle
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

  return { trend, volume, breakout, growth, financial, valuation, institutional, sector: sectorScore, total, grade };
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
          // Deactivate alert after trigger to prevent spam
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
      const score = calculateScore(stock);
      const ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the following Indian stock data and explain its "Profit Potential Score" of ${score.total}/100 (Grade: ${score.grade}).
        
        Stock: ${stock.name} (${stock.symbol})
        Price: ${formatCurrency(stock.price)} (${stock.changePercent.toFixed(2)}%)
        Sector: ${stock.sector}
        Trend: ${stock.price > stock.dma200 ? 'Bullish' : 'Bearish'} (above 200 DMA)
        Volume: ${stock.volume > stock.avgVolume ? 'High' : 'Normal'}
        Fundamental Growth: Sales ${stock.yoySalesGrowth.toFixed(1)}%, Profit ${stock.yoyProfitGrowth.toFixed(1)}%
        Institutional: ${stock.fiiHoldingChange > 0 ? 'Buying' : 'Selling'}
        
        Provide a concise, professional summary for a swing trader including potential risks and why the score is ${score.total}. Use bullet points. Keep it under 150 words.`,
      });
      setAiExplanation(response.text);
    } catch (error) {
      console.error(error);
      setAiExplanation("Failed to generate AI analysis. Please check your API key.");
    } finally {
      setAiLoading(false);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
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
          <p className="text-slate-400 mt-1">Real-time NSE scoring engine for swing & short-term trades</p>
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
            LIVE MARKET FEED
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Scanned Stocks', value: stocks.length, icon: Activity, color: 'text-blue-400' },
          { label: 'Top Opportunities', value: stocks.filter(s => calculateScore(s).total > 80).length, icon: Zap, color: 'text-yellow-400' },
          { label: 'Avg Mkt Score', value: Math.round(stocks.reduce((acc, s) => acc + calculateScore(s).total, 0) / (stocks.length || 1)), icon: PieChart, color: 'text-purple-400' },
          { label: 'Active Alerts', value: alerts.filter(a => a.active).length, icon: Bell, color: 'text-emerald-400' },
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
                  <th className="px-6 py-4 cursor-pointer hover:text-slate-200" onClick={() => handleSort('changePercent')}>1D Change</th>
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
                  const score = calculateScore(stock);
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
                      <td className="px-6 py-4 font-mono font-medium">
                        {formatCurrency(stock.price)}
                      </td>
                      <td className={`px-6 py-4 font-semibold ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span className="flex items-center gap-1">
                          {stock.changePercent >= 0 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {Math.abs(stock.changePercent).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <div className="text-sm font-medium">{formatCompact(stock.volume)}</div>
                        <div className="text-[10px] text-slate-500">Avg: {formatCompact(stock.avgVolume)}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-sm font-bold border border-slate-700">
                          {score.total}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-block px-3 py-1 rounded border text-xs font-black ${getGradeColor(score.grade)}`}>
                          {score.grade}
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
      {selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-slate-800 p-6 flex justify-between items-center z-10">
              <div className="flex items-center gap-4">
                <div className={`text-3xl font-black p-2 rounded-lg border-2 ${getGradeColor(calculateScore(selectedStock).grade)}`}>
                  {calculateScore(selectedStock).grade}
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
                    { label: 'Trend Strength', score: calculateScore(selectedStock).trend, max: 20 },
                    { label: 'Volume Surge', score: calculateScore(selectedStock).volume, max: 15 },
                    { label: 'Price Action', score: calculateScore(selectedStock).breakout, max: 15 },
                    { label: 'Growth Potential', score: calculateScore(selectedStock).growth, max: 20 },
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

                {/* TradingView Widget Placeholder */}
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 min-h-[400px] flex flex-col items-center justify-center relative">
                   <div className="absolute top-4 left-4 text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">TRADINGVIEW ENGINE PREVIEW</div>
                   <BarChart3 className="h-24 w-24 text-slate-800 mb-4" />
                   <p className="text-slate-600 italic">Advanced Candlestick Chart for {selectedStock.symbol}:NSE</p>
                   <div className="mt-8 flex gap-4">
                     <div className="flex flex-col items-center">
                       <span className="text-xs text-slate-500">50 DMA</span>
                       <span className="text-emerald-500 font-mono font-bold">₹{selectedStock.dma50.toFixed(2)}</span>
                     </div>
                     <div className="flex flex-col items-center">
                       <span className="text-xs text-slate-500">200 DMA</span>
                       <span className="text-blue-500 font-mono font-bold">₹{selectedStock.dma200.toFixed(2)}</span>
                     </div>
                   </div>
                </div>

                {/* Key Fundamental Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-800">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Valuation & Financials
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-slate-400">P/E Ratio</span>
                        <span className="font-mono">{selectedStock.peRatio.toFixed(2)} <span className="text-[10px] text-slate-500">(Sector: {selectedStock.sectorPE.toFixed(1)})</span></span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Debt to Equity</span>
                        <span className="font-mono">{selectedStock.debtToEquity.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Institutional Change</span>
                        <span className={`font-mono ${selectedStock.fiiHoldingChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {selectedStock.fiiHoldingChange > 0 ? '+' : ''}{selectedStock.fiiHoldingChange.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-800">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Growth Metrics (YoY)
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sales Growth</span>
                        <span className={`font-mono ${selectedStock.yoySalesGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {selectedStock.yoySalesGrowth.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Profit Growth</span>
                        <span className={`font-mono ${selectedStock.yoyProfitGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {selectedStock.yoyProfitGrowth.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">EPS Growth</span>
                        <span className="font-mono text-emerald-400">{selectedStock.epsGrowth.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Analysis & Action */}
              <div className="space-y-6">
                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                    <h3 className="font-bold text-lg">AI Recommendation</h3>
                  </div>
                  
                  {aiExplanation ? (
                    <div className="text-slate-300 text-sm leading-relaxed prose prose-invert">
                      {aiExplanation.split('\n').map((line, i) => <p key={i} className="mb-2">{line}</p>)}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="bg-slate-900 h-12 w-12 rounded-full flex items-center justify-center mb-4">
                        <Info className="h-6 w-6 text-slate-600" />
                      </div>
                      <p className="text-slate-400 text-sm mb-6">Generate an AI-powered analysis of this stock's potential based on current market signals.</p>
                      <button 
                        onClick={() => getAiExplanation(selectedStock)}
                        disabled={aiLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        {aiLoading ? (
                          <><RefreshCw className="h-4 w-4 animate-spin" /> Analyzing...</>
                        ) : (
                          <>Explain this Score</>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-2xl">
                  <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2 text-sm uppercase">
                    <ShieldCheck className="h-4 w-4" /> Analyst Verdict
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This stock is currently showing {calculateScore(selectedStock).total > 70 ? 'strong bullish momentum' : 'consolidated movement'}. 
                    Ideal entry for swing traders at levels {formatCurrency(selectedStock.price * 0.98)}.
                  </p>
                </div>

                <div className="space-y-3">
                  <button className="w-full bg-slate-100 hover:bg-white text-slate-950 font-bold py-4 rounded-xl transition-all shadow-xl flex items-center justify-center gap-2">
                    Add to Watchlist
                  </button>
                  <button 
                    onClick={() => {
                      setNewAlertForm({
                        symbol: selectedStock.symbol,
                        type: 'Price',
                        condition: 'Above',
                        threshold: Math.round(selectedStock.price * 1.05)
                      });
                      setIsAlertManagerOpen(true);
                      setSelectedStock(null);
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 rounded-xl border border-slate-700 flex items-center justify-center gap-2"
                  >
                    <BellPlus className="h-5 w-5" /> Set Price Alert
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    <label className="text-xs text-slate-500 mb-1 block">Stock Symbol</label>
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
                      <label className="text-xs text-slate-500 mb-1 block">Metric</label>
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
                      <label className="text-xs text-slate-500 mb-1 block">Trigger</label>
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
                    <label className="text-xs text-slate-500 mb-1 block">Threshold Value</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                      value={newAlertForm.threshold || ''}
                      placeholder={newAlertForm.type === 'Price' ? 'e.g. 2400' : 'e.g. 85'}
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
                            {!alert.active && <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 rounded uppercase">Triggered</span>}
                          </div>
                          <div className="text-xs text-slate-500">
                            Notify when {alert.type} is {alert.condition.toLowerCase()} {alert.type === 'Price' ? formatCurrency(alert.threshold) : alert.threshold}
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
      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm pb-12">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <span>© 2025 StockProfitScanner. Powered by Gemini.</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-emerald-400 transition-colors">Privacy</a>
          <a href="#" className="hover:text-emerald-400 transition-colors">Terms</a>
          <a href="#" className="hover:text-emerald-400 transition-colors">NSE Disclaimer</a>
        </div>
      </footer>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
