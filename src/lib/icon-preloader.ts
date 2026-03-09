/**
 * Icon Preloader
 *
 * Pre-loads ALL lucide-react icons used throughout the app in ONE PLACE
 * to prevent concurrent module initialization race conditions.
 *
 * Import this file early in App.tsx to ensure lucide-react is fully
 * initialized before any lazy-loaded components try to import from it.
 */

// Import ALL lucide icons used anywhere in the app
// This forces a single initialization point for the lucide-react module
export {
  // Navigation & UI
  Crown, Calendar, ArrowLeft, Loader2, AlertCircle, UserPlus, Edit,
  Youtube, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp,
  
  // User & Profile
  TrendingUp, Swords, Zap, Star, Shield, Users, GraduationCap,
  
  // Tournament & Competition
  Trophy, Medal, Target, Skull, Sparkles, Flame, Clock, Radio,
  Eye, Gift, Lock, Unlock, Globe, Timer, Clipboard, ClipboardList,
  Ticket, Camera, Briefcase,
  
  // Actions & Controls
  Send, Trash2, Pencil, Plus, Upload, Check, Save, RefreshCw,
  RotateCcw, Filter, Search, ArrowUp, ArrowDown, Info, AlertTriangle,
  LogOut,
  
  // Media & External
  ExternalLink, Image as ImageIcon, Tv, Popcorn, Mic, ThumbsUp, ThumbsDown,
  Heart, MessageSquare, Headphones, Film,
  
  // Status & Indicators
  CheckCircle, XCircle, Ban,
  
  // Game & Competition Specific
  GitBranch, Volume2, Play, History, Gamepad2, MailX,
  HandHelping, UserMinus,
  
  // Misc
  DollarSign, CalendarDays, Scale
} from 'lucide-react';

// Re-export the Loader2 specifically since it's used in so many places
export { Loader2 as LoadingSpinner } from 'lucide-react';