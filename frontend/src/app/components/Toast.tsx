import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Briefcase, BookOpen, FileText, FolderOpen,
  Activity, ChevronRight, ChevronDown, ChevronUp,
  Plus, Search, Download, Eye, Edit2, Bell, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, DollarSign, ArrowLeft, X, Upload,
  Link2, MoreHorizontal, ChevronLeft, Filter, Tag, Paperclip,
  Clock, BarChart2, Percent, Check, Trash2, Save, FileDown, Sliders
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from "recharts";

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-5 right-5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-sm animate-in slide-in-from-bottom-2">
      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
      <p className="text-sm text-gray-800 flex-1">{message}</p>
      <button onClick={onClose} className="text-gray-300 hover:text-gray-600 ml-1"><X className="w-4 h-4" /></button>
    </div>
  );
}
