
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  getAttemptRecord,
  recordFailedAttempt,
  clearAttempts,
  isLockedOut,
  lockoutRemainingMs,
  attemptsUntilNextLock,
  sanitize,
} from '@/lib/security';

// Unified Custom SVG Icons - Optimized for instant compile rendering and zero bundle conflicts
const PlusIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v12m6-6H6"/></svg>;
const SearchIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
const FolderIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>;
const ChevronRightIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>;
const AlertCircleIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>;
const BookOpenIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>;
const SparklesIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>;
const FileTextIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>;
const ClockIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const ArrowLeftIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const CheckIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>;
const AwardIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>;
const ImageIcon = () => <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>;
const TagIcon = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>;
const UserIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>;
const HistoryIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const LogOutIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>;
const ShieldIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>;
const HandbookIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>;
const CareerIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>;
const CalendarIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>;
const CloudUploadIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>;

interface Step {
  title: string;
  summary: string;
  body: string;
  imageUrl?: string;
}

interface Revision {
  version: string;
  date: string;
  updatedBy: string;
  userRole: string;
  notes: string;
}

interface ReadLog {
  userName: string;
  userRole: string;
  timestamp: string;
  versionRead: string;
}

interface SOP {
  id: string;
  category: string; // HVAC, Electrical, Plumbing, Safety
  title: string;
  summary: string;
  lastUpdated: string;
  lastUpdatedBy: string;
  lastUpdatedByRole: string;
  nextReviewDate: string;
  tools: string;
  materials: string;
  steps: Step[];
  revisionHistory: Revision[];
  readLogs: ReadLog[];
}

interface User {
  name: string;
  role: string;      // Operational job title (e.g., HVAC Lead, Field Apprentice)
  userType: 'admin' | 'user'; // Explicit permissions restriction
}

interface CareerTask {
  id: number;
  track_id: number;
  title: string;
  description: string;
  image_urls: string[];
  sop_title: string;
  order_index: number;
}

interface CareerTrack {
  id: number;
  name: string;
  description: string;
  department: string;
  order_index: number;
  tasks: CareerTask[];
}

interface CareerCompletion {
  id: number;
  task_id: number;
  user_name: string;
  user_role: string;
  completed_at: string;
}

interface CareerAssignment {
  id: number;
  user_name: string;
  user_role: string;
  track_id: number;
  assigned_by: string;
  assigned_at: string;
}

interface Notification {
  id: string;
  docId: string;
  docTitle: string;
  suggestedBy: string;
  suggestedByRole: string;
  notes: string;
  timestamp: string;
}

const PRESET_ACCOUNTS = [
  { name: "Marcus Thorne", role: "HVAC Supervisor", userType: "admin" },
  { name: "Sarah Lin", role: "Master Electrician", userType: "admin" },
  { name: "Alex Rivers", role: "Field Apprentice", userType: "user" },
  { name: "Derrick Vance", role: "Plumbing Specialist", userType: "user" },
];

// Credential validation is server-side only (/api/auth/login).
// No passwords or Supabase keys exist in this client bundle.

const PHOTO_PRESETS = [
  { name: "Coil Gauges", url: "https://images.unsplash.com/photo-1581094288338-2314dddb7eed?w=600&auto=format&fit=crop&q=80" },
  { name: "Thermostat Core", url: "https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop&q=80" },
  { name: "Safety Panel", url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80" },
  { name: "PEX Piping", url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80" },
  { name: "Vacuum Pump", url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80" }
];

const DEFAULT_SOPS: SOP[] = [
  {
    id: "hvac-evac-01",
    category: "HVAC",
    title: "HVAC Evacuator & Pump Configuration",
    summary: "Mandatory multi-port coil evacuation line vacuum level check protocols.",
    lastUpdated: "06/18/2026",
    lastUpdatedBy: "Marcus Thorne",
    lastUpdatedByRole: "HVAC Supervisor",
    nextReviewDate: "12/18/2026",
    tools: "Manifold gauge set, vacuum pump, micron gauge, service wrench",
    materials: "Refrigerant (as specified), gasket seals",
    steps: [
      { 
        title: "Manifold Connection", 
        summary: "Affix gauges to high and low ports securely.", 
        body: "Connect the manifold gauge hoses to the system ports. Hand-tighten with a final quarter turn using a service wrench to prevent refrigerant bleed-off. Verify gasket seals are fully flush.",
        imageUrl: "https://images.unsplash.com/photo-1581094288338-2314dddb7eed?w=600&auto=format&fit=crop&q=80"
      },
      { 
        title: "Micron Level Pulldown", 
        summary: "Engage vacuum pump to drop below 500 microns.", 
        body: "Start the vacuum pump. Monitor micron gauge progression. Ensure the line pressure holds steady below 500 microns for a minimum of 10 minutes before system isolation check.",
        imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80"
      }
    ],
    revisionHistory: [
      {
        version: "v1.1",
        date: "06/18/2026",
        updatedBy: "Marcus Thorne",
        userRole: "HVAC Supervisor",
        notes: "Added quarter-turn service wrench security note to Step 1 manifold connections."
      },
      {
        version: "v1.0",
        date: "03/12/2026",
        updatedBy: "Marcus Thorne",
        userRole: "HVAC Supervisor",
        notes: "Initial protocol creation and core vacuum target thresholds established."
      }
    ],
    readLogs: [
      {
        userName: "Alex Rivers",
        userRole: "Field Apprentice",
        timestamp: "06/18/2026, 2:14 PM",
        versionRead: "v1.1"
      }
    ]
  },
  {
    id: "smart-therm-02",
    category: "Electrical",
    title: "Smart Thermostat Calibration",
    summary: "Setup procedure for multi-stage zoning configurations.",
    lastUpdated: "06/15/2026",
    lastUpdatedBy: "Sarah Lin",
    lastUpdatedByRole: "Master Electrician",
    nextReviewDate: "12/15/2026",
    tools: "Non-contact voltage tester, multi-meter, wire stripper",
    materials: "C-wire (blue common wire), thermostat unit, terminal board",
    steps: [
      {
        title: "Power Cycle Verification", 
        summary: "Isolate circuit breaker power loop.", 
        body: "Always verify line voltage status at the master switch panel. Use a non-contact voltage tester before touching internal copper wire clusters or handling low-voltage terminations.",
        imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80"
      },
      { 
        title: "C-Wire Continuity Diagnostic", 
        summary: "Verify stable thermostat power load connection.", 
        body: "Connect blue common wire to terminal board. Use a multi-meter to ensure 24V constant baseline current output is achieved without voltage fluctuations.",
        imageUrl: "https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop&q=80"
      }
    ],
    revisionHistory: [
      {
        version: "v1.0",
        date: "06/15/2026",
        updatedBy: "Sarah Lin",
        userRole: "Master Electrician",
        notes: "Initial safety-first guidelines for C-wire electrical circuit calibration."
      }
    ],
    readLogs: []
  }
];

// Session inactivity timeout: 30 minutes of no interaction auto-logs out
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

interface UserBadge {
  id: number;
  user_name: string;
  badge: string;
  assigned_by: string;
  assigned_at: string;
}

const ALL_BADGES = ['EPA 608', 'Spray Foam', 'BPI', 'Radon', 'Lead', 'Mold Testing', 'Forklift'] as const;
type BadgeType = typeof ALL_BADGES[number];

const BADGE_STYLES: Record<BadgeType, { bg: string; text: string; border: string; emoji: string }> = {
  'EPA 608':      { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-200',    emoji: '❄️' },
  'Spray Foam':   { bg: 'bg-purple-50',  text: 'text-purple-800',  border: 'border-purple-200',  emoji: '🔫' },
  'BPI':          { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', emoji: '🏠' },
  'Radon':        { bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-200',   emoji: '☢️' },
  'Lead':         { bg: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-200',  emoji: '⚠️' },
  'Mold Testing': { bg: 'bg-teal-50',    text: 'text-teal-800',    border: 'border-teal-200',    emoji: '🔬' },
  'Forklift':     { bg: 'bg-yellow-50',  text: 'text-yellow-800',  border: 'border-yellow-200',  emoji: '🏗️' },
};

const BadgeChip = ({ badge, onRemove }: { badge: string; onRemove?: () => void }) => {
  const style = BADGE_STYLES[badge as BadgeType] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', emoji: '🏅' };
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md border ${style.bg} ${style.text} ${style.border} leading-none`}>
      <span>{style.emoji}</span>
      <span>{badge}</span>
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity leading-none">✕</button>
      )}
    </span>
  );
};

export default function App() {
  // Mounting check to eliminate Next.js server/client hydration mismatch errors
  const [mounted, setMounted] = useState(false);

  // Navigation Router: login, dashboard, new, document, addRevision, adminConsole
  const [currentView, setCurrentView] = useState<'login' | 'dashboard' | 'new' | 'document' | 'addRevision' | 'adminConsole' | 'handbook' | 'careerLadder' | 'careerAdmin'>('login');

  // Account authorization state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginName, setLoginName] = useState('');
  const [loginRole, setLoginRole] = useState('Field Apprentice');
  const [loginUserType, setLoginUserType] = useState<'admin' | 'user'>('user');

  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showDemoDirectory, setShowDemoDirectory] = useState(false);

  // Security: rate-limiting / lockout display state
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Security: inactivity timeout ref
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Core Operational Procedures Database State
  const [documents, setDocuments] = useState<SOP[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<SOP | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [docTab, setDocTab] = useState<'checklist' | 'history'>('checklist');

  // Handbook state
  const [handbookSections, setHandbookSections] = useState<{id: number; title: string; content: string; order_index: number}[]>([]);
  const [handbookLoading, setHandbookLoading] = useState(false);
  const [handbookError, setHandbookError] = useState('');
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  // Career Ladder state
  const [careerTracks, setCareerTracks] = useState<CareerTrack[]>([]);
  const [careerCompletions, setCareerCompletions] = useState<CareerCompletion[]>([]);
  const [allCareerCompletions, setAllCareerCompletions] = useState<CareerCompletion[]>([]);
  const [myAssignment, setMyAssignment] = useState<CareerAssignment | null>(null);
  const [allAssignments, setAllAssignments] = useState<CareerAssignment[]>([]);
  const [careerLoading, setCareerLoading] = useState(false);
  const [careerError, setCareerError] = useState('');
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  // Admin task/track creation state
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [showAddTask, setShowAddTask] = useState<number | null>(null);
  const [newTrackName, setNewTrackName] = useState('');
  const [newTrackDesc, setNewTrackDesc] = useState('');
  const [newTrackDept, setNewTrackDept] = useState<'Home Performance' | 'HVAC'>('Home Performance');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskImages, setNewTaskImages] = useState('');
  const [newTaskSop, setNewTaskSop] = useState('');
  // Admin assignment state
  const [assigningUser, setAssigningUser] = useState<string | null>(null);
  const [assignDept, setAssignDept] = useState<'Home Performance' | 'HVAC'>('Home Performance');
  const [assignTrackId, setAssignTrackId] = useState<number | null>(null);

  const [allBadges, setAllBadges] = useState<UserBadge[]>([]);
  const [badgesLoaded, setBadgesLoaded] = useState(false);

  // Interactive Checklist completion tracking state
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  // Dynamic SOP Form state
  const [newCategory, setNewCategory] = useState('HVAC');
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newTools, setNewTools] = useState('');
  const [newMaterials, setNewMaterials] = useState('');
  const [newSteps, setNewSteps] = useState<Step[]>([
    { title: '', summary: '', body: '', imageUrl: '' }
  ]);
  const [formError, setFormError] = useState('');
  
  // Custom interactive mock upload states
  const [uploadTargetIdx, setUploadTargetIdx] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<Record<number, boolean>>({});

  // New Revision Form State
  const [revisionNotes, setRevisionNotes] = useState('');
  const [revisionError, setRevisionError] = useState('');

  // New Update Recommendation States
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [recommendationNotes, setRecommendationNotes] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Inactivity logout — reset the timer on any user interaction
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT_MS);
    // session kept alive via httpOnly cookie — no client-side touch needed
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync databases on boot + session validation via server cookie
  useEffect(() => {
    setMounted(true);

    // Validate the httpOnly session cookie with the server.
    // If valid, the server returns the user object (no sensitive data client-side).
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.user) {
          setCurrentUser(data.user);
          setCurrentView('dashboard');
        }
      })
      .catch(() => {}) // network error — remain on login screen
      .finally(() => {
        // Load notifications from localStorage (SOPs come from Supabase after login)
        try {
          const savedNotifs = localStorage.getItem('admin_notifications');
          if (savedNotifs) setNotifications(JSON.parse(savedNotifs));
        } catch { /* ignore */ }
        setLoading(false);
      });
  }, []);

  // Attach inactivity listeners when a user is logged in
  useEffect(() => {
    if (!currentUser) return;
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => resetInactivityTimer();
    events.forEach(ev => window.addEventListener(ev, handler, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach(ev => window.removeEventListener(ev, handler));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [currentUser, resetInactivityTimer]);

  // Load SOPs from Supabase whenever a user logs in
  useEffect(() => {
    if (!currentUser) return;
    fetch('/api/sops')
      .then(r => r.ok ? r.json() : { sops: [] })
      .then(data => {
        const sops = data.sops ?? [];
        setDocuments(sops.length > 0 ? sops : DEFAULT_SOPS);
      })
      .catch(() => setDocuments(DEFAULT_SOPS));
  }, [currentUser]);

  // Load badges whenever a user logs in
  useEffect(() => {
    if (!currentUser || badgesLoaded) return;
    fetch('/api/badges')
      .then(r => r.ok ? r.json() : { badges: [] })
      .then(data => { setAllBadges(data.badges ?? []); setBadgesLoaded(true); })
      .catch(() => setBadgesLoaded(true));
  }, [currentUser, badgesLoaded]);

  // Lockout countdown ticker
  useEffect(() => {
    if (lockoutSeconds <= 0) {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
      return;
    }
    lockoutTimerRef.current = setInterval(() => {
      setLockoutSeconds(s => {
        if (s <= 1) {
          if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current); };
  }, [lockoutSeconds]);

  useEffect(() => {
    if (currentView === 'handbook' && handbookSections.length === 0 && !handbookLoading) {
      setHandbookLoading(true);
      setHandbookError('');
      fetch('/api/handbook')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => setHandbookSections(data.sections || []))
        .catch(() => setHandbookError('Could not load handbook. Please try again.'))
        .finally(() => setHandbookLoading(false));
    }
  }, [currentView]);

  const loadCareerData = async (_user?: User) => {
    setCareerLoading(true);
    setCareerError('');
    try {
      const res = await fetch('/api/career');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const taskRows: CareerTask[] = data.tasks || [];
      const tracks: CareerTrack[] = (data.tracks || []).map((t: Omit<CareerTrack, 'tasks'>) => ({
        ...t,
        tasks: taskRows.filter(tk => tk.track_id === t.id),
      }));
      setCareerTracks(tracks);
      setCareerCompletions(data.myCompletions || []);
      setAllCareerCompletions(data.allCompletions || []);
      setMyAssignment(data.myAssignment || null);
      setAllAssignments(data.allAssignments || []);
    } catch (err) {
      console.warn('Career data load failed:', err);
      setCareerError('Could not load career ladder. Please try again.');
    } finally {
      setCareerLoading(false);
    }
  };

  const saveAssignment = async (userName: string, userRole: string, trackId: number) => {
    const existing = allAssignments.find(a => a.user_name === userName);
    try {
      const res = await fetch('/api/career/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, userRole, trackId, existingId: existing?.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { assignment } = await res.json();
      if (existing) {
        setAllAssignments(prev => prev.map(a => a.id === existing.id ? assignment : a));
      } else {
        setAllAssignments(prev => [...prev, assignment]);
      }
    } catch (err) {
      console.error('Failed to save assignment:', err);
    }
    setAssigningUser(null);
  };

  useEffect(() => {
    if ((currentView === 'careerLadder' || currentView === 'careerAdmin') && currentUser && careerTracks.length === 0 && !careerLoading) {
      loadCareerData();
    }
  }, [currentView]);

  const toggleTaskCompletion = async (task: CareerTask) => {
    if (!currentUser) return;
    const existing = careerCompletions.find(c => c.task_id === task.id);
    if (existing) {
      // Optimistic remove
      setCareerCompletions(prev => prev.filter(c => c.id !== existing.id));
      setAllCareerCompletions(prev => prev.filter(c => c.id !== existing.id));
      const res = await fetch('/api/career/complete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionId: existing.id }),
      });
      if (!res.ok) {
        // Rollback on failure
        setCareerCompletions(prev => [...prev, existing]);
        setAllCareerCompletions(prev => [...prev, existing]);
        console.error('Failed to delete completion:', res.status);
      }
    } else {
      const res = await fetch('/api/career/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id }),
      });
      if (res.ok) {
        const { completion } = await res.json();
        if (completion) {
          setCareerCompletions(prev => [...prev, completion]);
          setAllCareerCompletions(prev => [...prev, completion]);
        }
      }
    }
  };

  const addCareerTrack = async () => {
    if (!newTrackName.trim()) return;
    const deptTracks = careerTracks.filter(t => t.department === newTrackDept);
    try {
      const res = await fetch('/api/career/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTrackName.trim(), description: newTrackDesc.trim(), department: newTrackDept, orderIndex: deptTracks.length }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { track } = await res.json();
      if (track) setCareerTracks(prev => [...prev, { ...track, tasks: [] }]);
    } catch (err) { console.error('addCareerTrack failed:', err); }
    setNewTrackName('');
    setNewTrackDesc('');
    setShowAddTrack(false);
  };

  const addCareerTask = async (trackId: number) => {
    if (!newTaskTitle.trim()) return;
    const track = careerTracks.find(t => t.id === trackId);
    try {
      const res = await fetch('/api/career/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId,
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim(),
          imageUrls: newTaskImages.split('\n').map(s => s.trim()).filter(Boolean),
          sopTitle: newTaskSop.trim(),
          orderIndex: track ? track.tasks.length : 0,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { task } = await res.json();
      if (task) setCareerTracks(prev => prev.map(t => t.id === trackId ? { ...t, tasks: [...t.tasks, task] } : t));
    } catch (err) { console.error('addCareerTask failed:', err); }
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskImages('');
    setNewTaskSop('');
    setShowAddTask(null);
  };

  const saveSOPToServer = async (sop: SOP): Promise<SOP | null> => {
    const res = await fetch(`/api/sops/${sop.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sop),
    });
    if (!res.ok) return null;
    const { sop: updated } = await res.json();
    return updated ?? null;
  };

  // Handler for recommending SOP updates
  const handleRecommendUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedDoc || !recommendationNotes.trim()) return;

    const cleanNotes = sanitize(recommendationNotes, 'notes');
    if (!cleanNotes) return;

    const newNotif = {
      id: `notif-${Date.now()}`,
      docId: selectedDoc.id,
      docTitle: selectedDoc.title,
      suggestedBy: currentUser.name,
      suggestedByRole: currentUser.role,
      notes: cleanNotes,
      timestamp: new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    };

    const updatedNotifs = [newNotif, ...notifications];
    setNotifications(updatedNotifs);
    localStorage.setItem('admin_notifications', JSON.stringify(updatedNotifs));

    setRecommendationNotes('');
    setShowRecommendModal(false);
  };

  const handleLoadSamples = () => {
    setDocuments(DEFAULT_SOPS);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const rawName = loginName.trim();
    const rawPassword = loginPassword;

    if (!rawName) { setLoginError('Teammate Name is required.'); return; }
    if (!rawPassword) { setLoginError('Password is required.'); return; }

    const nameKey = rawName.toLowerCase();

    // Client-side rate limit check — first line of defense (UX feedback).
    // The server independently enforces IP-based rate limiting.
    const rec = getAttemptRecord(nameKey);
    if (isLockedOut(rec)) {
      const secs = Math.ceil(lockoutRemainingMs(rec) / 1000);
      setLockoutSeconds(secs);
      setLoginError(`Account temporarily locked. Try again in ${secs}s.`);
      setLoginPassword('');
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rawName, password: rawPassword }),
      });

      if (response.ok) {
        const { user } = await response.json();
        clearAttempts(nameKey);
        setAttemptsLeft(null);
        setCurrentUser(user);
        setCurrentView('dashboard');
      } else if (response.status === 429) {
        setLoginError('Too many requests from your network. Please wait a moment.');
      } else {
        // Record client-side attempt for UX lockout feedback
        const updated = recordFailedAttempt(nameKey);
        if (isLockedOut(updated)) {
          const secs = Math.ceil(lockoutRemainingMs(updated) / 1000);
          setLockoutSeconds(secs);
          setLoginError(`Too many failed attempts. Locked for ${secs}s.`);
        } else {
          const left = attemptsUntilNextLock(updated);
          setAttemptsLeft(left);
          setLoginError(`Invalid credentials. ${left} attempt${left !== 1 ? 's' : ''} remaining before lockout.`);
        }
      }
    } catch {
      setLoginError('Network error. Please check your connection.');
    }

    setLoginPassword('');
  };

  const handleLogout = useCallback(() => {
    // Tell the server to clear the httpOnly session cookie
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    setCurrentUser(null);
    setAllBadges([]);
    setBadgesLoaded(false);
    setLoginPassword('');
    setLoginError('');
    setLockoutSeconds(0);
    setAttemptsLeft(null);
    setCurrentView('login');
  }, []);

  const toggleStepCompleted = (index: number) => {
    setCompletedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const selectPresetPhoto = (stepIndex: number, url: string) => {
    const updated = [...newSteps];
    updated[stepIndex] = { ...updated[stepIndex], imageUrl: url };
    setNewSteps(updated);
    setUploadTargetIdx(null);
  };

  const triggerMockUpload = (stepIndex: number) => {
    setIsUploading(prev => ({ ...prev, [stepIndex]: true }));
    setTimeout(() => {
      const randomPreset = PHOTO_PRESETS[Math.floor(Math.random() * PHOTO_PRESETS.length)];
      const updated = [...newSteps];
      updated[stepIndex] = { ...updated[stepIndex], imageUrl: randomPreset.url };
      setNewSteps(updated);
      setIsUploading(prev => ({ ...prev, [stepIndex]: false }));
    }, 1500);
  };

  const handleAddCreatorStep = () => {
    setNewSteps([...newSteps, { title: '', summary: '', body: '', imageUrl: '' }]);
  };

  const handleRemoveCreatorStep = (index: number) => {
    if (newSteps.length === 1) return;
    setNewSteps(newSteps.filter((_, i) => i !== index));
  };

  const handleCreatorStepFieldChange = (index: number, field: keyof Step, value: string) => {
    const updated = [...newSteps];
    updated[index] = { ...updated[index], [field]: value };
    setNewSteps(updated);
  };

  const handlePublishSOP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.userType !== 'admin') return;

    const cleanTitle = sanitize(newTitle, 'title');
    const cleanSummary = sanitize(newSummary, 'summary');

    if (!cleanTitle || !cleanSummary) {
      setFormError('Please enter a procedure title and overview tagline.');
      return;
    }
    const emptySteps = newSteps.some(s => !s.title.trim() || !s.body.trim());
    if (emptySteps) {
      setFormError('All checklists require a step action title and procedural body.');
      return;
    }

    const todayString = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const nextReview = new Date();
    nextReview.setMonth(nextReview.getMonth() + 6);
    const reviewString = nextReview.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

    const newSOP: SOP = {
      id: `sop-${Date.now()}`,
      category: newCategory,
      title: cleanTitle,
      summary: cleanSummary,
      lastUpdated: todayString,
      lastUpdatedBy: currentUser.name,
      lastUpdatedByRole: currentUser.role,
      nextReviewDate: reviewString,
      tools: sanitize(newTools, 'notes'),
      materials: sanitize(newMaterials, 'notes'),
      steps: newSteps,
      revisionHistory: [{ version: "v1.0", date: todayString, updatedBy: currentUser.name, userRole: currentUser.role, notes: "Initial protocol creation." }],
      readLogs: []
    };

    try {
      const res = await fetch('/api/sops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSOP),
      });
      if (!res.ok) throw new Error();
      const { sop } = await res.json();
      setDocuments(prev => [sop, ...prev]);
    } catch {
      setFormError('Failed to save SOP. Please try again.');
      return;
    }

    setNewTitle('');
    setNewSummary('');
    setNewTools('');
    setNewMaterials('');
    setNewCategory('HVAC');
    setNewSteps([{ title: '', summary: '', body: '', imageUrl: '' }]);
    setFormError('');
    setCurrentView('dashboard');
  };

  const handleMarkAsRead = async () => {
    if (!currentUser || !selectedDoc) return;

    const totalSteps = selectedDoc.steps?.length || 0;
    const completedCount = Object.values(completedSteps).filter(Boolean).length;
    if (completedCount < totalSteps) return;

    const currentVersion = selectedDoc.revisionHistory[0]?.version || 'v1.0';
    const alreadySigned = selectedDoc.readLogs.some(
      log => log.userName === currentUser.name && log.versionRead === currentVersion
    );
    if (alreadySigned) return;

    const newLog: ReadLog = {
      userName: currentUser.name,
      userRole: currentUser.role,
      timestamp: new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
      versionRead: currentVersion,
    };

    // Optimistic update
    const updatedDoc = { ...selectedDoc, readLogs: [newLog, ...selectedDoc.readLogs] };
    setSelectedDoc(updatedDoc);
    setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? updatedDoc : d));

    try {
      const res = await fetch(`/api/sops/${selectedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readLogOnly: true, newLog }),
      });
      if (!res.ok) throw new Error();
      const { sop } = await res.json();
      setDocuments(prev => prev.map(d => d.id === sop.id ? sop : d));
      setSelectedDoc(sop);
    } catch {
      // Revert optimistic update on failure
      setSelectedDoc(selectedDoc);
      setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? selectedDoc : d));
    }
  };

  const handlePublishRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedDoc || currentUser.userType !== 'admin') return;
    const cleanRevNotes = sanitize(revisionNotes, 'notes');
    if (!cleanRevNotes) {
      setRevisionError('Please enter detailed changelog notes.');
      return;
    }

    const todayString = new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });

    const latestRev = selectedDoc.revisionHistory[0];
    let nextVerNum = "v1.1";
    if (latestRev?.version) {
      const [major, minor] = latestRev.version.replace('v', '').split('.').map(Number);
      nextVerNum = `v${major}.${(minor ?? 0) + 1}`;
    }

    const newRevLog: Revision = {
      version: nextVerNum,
      date: todayString,
      updatedBy: currentUser.name,
      userRole: currentUser.role,
      notes: cleanRevNotes,
    };

    const updatedDoc: SOP = {
      ...selectedDoc,
      lastUpdated: todayString,
      lastUpdatedBy: currentUser.name,
      lastUpdatedByRole: currentUser.role,
      revisionHistory: [newRevLog, ...selectedDoc.revisionHistory]
    };

    setRevisionNotes('');
    setRevisionError('');

    try {
      const saved = await saveSOPToServer(updatedDoc);
      if (!saved) throw new Error();
      setSelectedDoc(saved);
      setDocuments(prev => prev.map(d => d.id === saved.id ? saved : d));
    } catch {
      setRevisionError('Failed to save revision. Please try again.');
      return;
    }
    setCurrentView('document');
  };

  const categoriesList = ["All", "HVAC", "Electrical", "Plumbing", "Safety"];

  const filteredDocs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return documents.filter(doc => {
      const matchesSearch = doc.title?.toLowerCase().includes(q) ||
                            doc.summary?.toLowerCase().includes(q) ||
                            doc.category?.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [documents, searchQuery, selectedCategory]);

  const { totalSOPsCount, totalTeamSize, actualReadLogsCount, aggregateComplianceRate } = useMemo(() => {
    const knownTeamSize = PRESET_ACCOUNTS.length;
    const uniqueReaderCount = new Set(documents.flatMap(d => d.readLogs.map(l => l.userName))).size;
    const teamSize = Math.max(knownTeamSize, uniqueReaderCount);
    const sopCount = documents.length;
    const readCount = documents.reduce((sum, doc) => sum + doc.readLogs.length, 0);
    const potential = sopCount * teamSize;
    const compliance = potential > 0 ? Math.round((readCount / potential) * 100) : 100;
    return { totalSOPsCount: sopCount, totalTeamSize: teamSize, actualReadLogsCount: readCount, aggregateComplianceRate: compliance };
  }, [documents]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-start py-0 sm:py-8 font-sans antialiased text-gray-900">
        <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[840px] sm:rounded-[40px] sm:shadow-2xl sm:border-[8px] sm:border-gray-900 relative overflow-hidden flex flex-col items-center justify-center p-6 text-gray-400">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-800 rounded-3xl flex items-center justify-center mx-auto shadow-md animate-pulse">
            <svg className="w-6 h-6 animate-spin text-emerald-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
          <span className="text-xs font-bold tracking-wide uppercase mt-4 animate-pulse text-gray-500">Loading Operational Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-start py-0 sm:py-8 font-sans antialiased text-gray-900">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[840px] sm:rounded-[40px] sm:shadow-2xl sm:border-[8px] sm:border-gray-900 relative overflow-hidden flex flex-col">
        
        {/* Status Bar emulation */}
        <div className="bg-white px-6 pt-3 pb-2 flex justify-between items-center text-[11px] font-bold text-gray-400 select-none border-b border-gray-50">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-2 bg-gray-400 rounded-xs inline-block"></span>
            <span className="w-2.5 h-2.5 bg-gray-400 rounded-full inline-block"></span>
          </div>
        </div>

        {/* View Router Body Viewport */}
        <div className="flex-1 overflow-y-auto pb-24 px-5 pt-4">

          {/* VIEW: COMPREHENSIVE LOGIN PORTAL */}
          {currentView === 'login' && (
            <div className="space-y-6 py-8">
              <div className="text-center space-y-1.5">
                <h1 className="text-2xl font-black tracking-tight text-emerald-800 leading-tight block px-2">
                  Healthy Home Energy & Consulting
                </h1>
                <p className="text-xs font-bold tracking-widest text-gray-400 uppercase block">
                  SOP Guide
                </p>
                <p className="text-xs text-gray-400 max-w-[250px] mx-auto pt-2">Access organized operational guides and sign off compliance checklists.</p>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-100 text-red-800 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Teammate Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Marcus Thorne"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    className="w-full h-12 px-4 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none transition-all text-gray-900 shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full h-12 px-4 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 focus:outline-none transition-all text-gray-900 shadow-xs"
                  />
                </div>

                <div className="bg-gray-50 p-3 rounded-xl space-y-2 border border-gray-100">
                  <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wide">Registering New Account?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider">Access Profile</label>
                      <select
                        value={loginUserType}
                        onChange={(e) => setLoginUserType(e.target.value as 'admin' | 'user')}
                        className="w-full h-10 px-2 bg-white border border-gray-200 rounded-lg text-[10px] font-semibold focus:outline-none text-gray-900"
                      >
                        <option value="user">Standard User</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider">Assigned Role</label>
                      <select
                        value={loginRole}
                        onChange={(e) => setLoginRole(e.target.value)}
                        className="w-full h-10 px-2 bg-white border border-gray-200 rounded-lg text-[10px] font-semibold focus:outline-none text-gray-900"
                      >
                        <option value="HVAC Tech Lead">HVAC Tech Lead</option>
                        <option value="Field Apprentice">Field Apprentice</option>
                        <option value="Master Electrician">Master Electrician</option>
                        <option value="Plumbing Specialist">Plumbing Specialist</option>
                        <option value="Safety Inspector">Safety Inspector</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Lockout countdown banner */}
                {lockoutSeconds > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center space-y-1">
                    <p className="text-xs font-black text-red-700">🔒 Account Locked</p>
                    <p className="text-[10px] text-red-600 font-semibold">
                      Try again in <span className="font-black">{lockoutSeconds}s</span>
                    </p>
                  </div>
                )}

                {/* Attempts-remaining warning */}
                {attemptsLeft !== null && attemptsLeft > 0 && lockoutSeconds === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] font-bold text-amber-700">
                      ⚠️ {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining before temporary lockout
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={lockoutSeconds > 0}
                  className={`w-full h-12 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 duration-100 mt-2 ${
                    lockoutSeconds > 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                      : 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-emerald-100'
                  }`}
                >
                  {lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : 'Enter Operational Portal'}
                </button>
              </form>

              {/* Expandable Demo Directory Drawer */}
              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDemoDirectory(!showDemoDirectory)}
                  className="w-full py-2 flex items-center justify-between text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider hover:bg-emerald-50/50 rounded-lg px-2 transition-all"
                >
                  <span>{showDemoDirectory ? "Hide" : "Show"} Demo Credentials Directory</span>
                  <svg className={`w-3.5 h-3.5 transform transition-transform ${showDemoDirectory ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>

                {showDemoDirectory && (
                  <div className="mt-3 bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-2.5">
                    <p className="text-[9px] text-gray-400 font-bold leading-relaxed">
                      Pre-registered teammate accounts for testing permission flows. Contact your administrator for credentials.
                    </p>
                    <div className="space-y-2 divide-y divide-gray-100/60 text-[10px]">
                      {PRESET_ACCOUNTS.map((acc, i) => (
                        <div key={i} className="pt-2 flex justify-between items-start gap-1">
                          <div className="space-y-0.5">
                            <p className="font-extrabold text-gray-900 flex items-center gap-1">
                              <span>{acc.name}</span>
                              <span className={`text-[8px] px-1 py-0.2 rounded-xs font-black uppercase tracking-wider ${
                                acc.userType === 'admin' ? 'bg-emerald-100 text-emerald-900' : 'bg-gray-200 text-gray-700'
                              }`}>
                                {acc.userType}
                              </span>
                            </p>
                            <p className="text-gray-400 font-medium text-[9px]">{acc.role}</p>
                          </div>
                          <span className="text-[9px] font-bold text-gray-400 italic">Protected</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: MAIN SOP DIRECTORY */}
          {currentView === 'dashboard' && currentUser && (
            <div className="space-y-5">
              
              {/* Top Profile Header */}
              <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-800 rounded-lg flex items-center justify-center font-bold text-xs">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-950 leading-none">{currentUser.name}</h4>
                    <span className="text-[9px] text-gray-400 font-bold mt-0.5 flex items-center gap-1 tracking-wide">
                      {currentUser.userType === 'admin' && <ShieldIcon />}
                      <span className="capitalize">{currentUser.userType}</span> — {currentUser.role}
                    </span>
                    {allBadges.filter(b => b.user_name === currentUser.name).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {allBadges.filter(b => b.user_name === currentUser.name).map(b => (
                          <BadgeChip key={b.id} badge={b.badge} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Sign Out"
                >
                  <LogOutIcon />
                </button>
              </div>

              {/* Action Banner for Admins */}
              {currentUser.userType === 'admin' && (
                <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 rounded-2xl p-4 text-white flex justify-between items-center shadow-md">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-extrabold tracking-widest text-emerald-100 uppercase">Compliance Admin Console</p>
                    <p className="text-sm font-black">Oversight & Team Logs</p>
                    <p className="text-[9px] text-emerald-100 font-medium">Verify completion rates and audit timelines.</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('adminConsole')}
                    className="h-9 px-3.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-[10px] font-black shadow-xs transition-colors"
                  >
                    Manage Team
                  </button>
                </div>
              )}

              {/* Title Section */}
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Workspace Manual</span>
                  <h1 className="text-2xl font-black text-gray-950 mt-0.5 tracking-tight">Active Procedures</h1>
                </div>
                
                {currentUser.userType === 'admin' && (
                  <button
                    onClick={() => setCurrentView('new')}
                    className="w-10 h-10 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-100 transition-all active:scale-95"
                    title="Publish New SOP"
                  >
                    <PlusIcon />
                  </button>
                )}
              </div>

              {/* Search guidelines filter */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  placeholder="Search categories or procedures..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:border-emerald-600 focus:bg-white focus:outline-none transition-all text-gray-800 placeholder:text-gray-400 shadow-xs"
                />
              </div>

              {/* Dynamic scrollable Category Tab selectors */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-gray-400 tracking-wider uppercase block">Scope Divisions</span>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {categoriesList.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`h-8 px-4 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? 'bg-emerald-800 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Listing grid */}
              <div className="space-y-3 pt-1">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  {selectedCategory} Protocols ({filteredDocs.length})
                </h3>

                {filteredDocs.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
                    <div className="text-amber-500 mb-2 flex justify-center"><AlertCircleIcon /></div>
                    <h3 className="text-sm font-bold text-gray-900">No guidelines found</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
                      There are no protocols registered under this category tab. Click below to reload sample data.
                    </p>
                    <button
                      onClick={handleLoadSamples}
                      className="mt-4 px-4 py-2 bg-emerald-50 text-emerald-800 font-extrabold text-[10px] rounded-lg hover:bg-emerald-100 transition-all inline-flex items-center gap-1.5"
                    >
                      <SparklesIcon /> Load SOP Samples
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {filteredDocs.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => {
                          setSelectedDoc(doc);
                          setCompletedSteps({}); // Reset timeline checks
                          setDocTab('checklist');
                          setCurrentView('document');
                        }}
                        className="bg-white border border-gray-100 hover:border-emerald-100 hover:shadow-xs rounded-2xl p-4 transition-all cursor-pointer flex items-center justify-between group active:bg-gray-50 duration-150"
                      >
                        <div className="flex items-start gap-3.5 pr-2">
                          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl group-hover:bg-emerald-800 group-hover:text-white transition-all duration-150 flex-shrink-0 mt-0.5">
                            <FolderIcon />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-widest uppercase text-emerald-800 bg-emerald-50/70 px-1.5 py-0.5 rounded-xs">
                                <TagIcon /> {doc.category}
                              </span>
                              <span className="text-[9px] font-bold text-gray-400">
                                {doc.revisionHistory[0]?.version || 'v1.0'}
                              </span>
                            </div>
                            <h4 className="text-xs font-black text-gray-900 leading-snug line-clamp-1 group-hover:text-emerald-800 transition-colors">
                              {doc.title}
                            </h4>
                            <p className="text-[11px] text-gray-400 font-semibold leading-relaxed line-clamp-2">
                              {doc.summary}
                            </p>
                            <div className="flex items-center gap-2 text-[9px] text-gray-400 font-bold">
                              <span>By {doc.lastUpdatedBy}</span>
                              <span>•</span>
                              <span>{doc.lastUpdated}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRightIcon />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: DRAFT NEW CATEGORY SOP (ADMIN-ONLY) */}
          {currentView === 'new' && currentUser && currentUser.userType === 'admin' && (
            <div className="space-y-5">
              {/* Header Navigation */}
              <div className="flex items-center gap-2 -ml-1">
                <button
                  type="button"
                  onClick={() => setCurrentView('dashboard')}
                  className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                  <ArrowLeftIcon />
                </button>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Workspace Creator</span>
                  <h1 className="text-lg font-black text-gray-950 leading-tight">Draft New SOP</h1>
                </div>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-100 text-red-800 rounded-2xl p-3 text-xs font-semibold">
                  ⚠️ {formError}
                </div>
              )}

              <form onSubmit={handlePublishSOP} className="space-y-5">
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Scope Category</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full h-11 px-3.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:border-emerald-600 focus:outline-none transition-all text-gray-900 shadow-xs"
                      >
                        <option value="HVAC">HVAC</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Plumbing">Plumbing</option>
                        <option value="Safety">Safety</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Author Identity</label>
                      <input
                        type="text"
                        disabled
                        value={`${currentUser.name} (Admin)`}
                        className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 text-gray-400 rounded-xl text-[10px] font-extrabold focus:outline-none shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">SOP Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Boiler Backflow Valve Purging"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full h-11 px-3.5 bg-white border border-gray-200 rounded-xl text-xs focus:border-emerald-600 focus:outline-none font-medium text-gray-900 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Overview Tagline Summary</label>
                    <input
                      type="text"
                      placeholder="e.g., Standard protocols for safety water checks..."
                      value={newSummary}
                      onChange={(e) => setNewSummary(e.target.value)}
                      className="w-full h-11 px-3.5 bg-white border border-gray-200 rounded-xl text-xs focus:border-emerald-600 focus:outline-none font-medium text-gray-900 shadow-xs"
                    />
                  </div>
                </div>

                {/* Tools & Materials */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Tools Required</label>
                    <input
                      type="text"
                      placeholder="e.g., Manifold gauge, vacuum pump..."
                      value={newTools}
                      onChange={(e) => setNewTools(e.target.value)}
                      className="w-full h-11 px-3.5 bg-white border border-gray-200 rounded-xl text-xs focus:border-emerald-600 focus:outline-none font-medium text-gray-900 shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Materials Needed</label>
                    <input
                      type="text"
                      placeholder="e.g., Refrigerant, gasket seals..."
                      value={newMaterials}
                      onChange={(e) => setNewMaterials(e.target.value)}
                      className="w-full h-11 px-3.5 bg-white border border-gray-200 rounded-xl text-xs focus:border-emerald-600 focus:outline-none font-medium text-gray-900 shadow-xs"
                    />
                  </div>
                </div>

                {/* Steps constructor list */}
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-gray-900 flex items-center gap-1">
                      <BookOpenIcon /> Checklist Action Steps ({newSteps.length})
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddCreatorStep}
                      className="h-7 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1 transition-colors"
                    >
                      <PlusIcon /> Add Step
                    </button>
                  </div>

                  <div className="space-y-4">
                    {newSteps.map((step, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3 relative">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-gray-400 tracking-wider">STEP CHECKLIST {index + 1}</span>
                          {newSteps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCreatorStep(index)}
                              className="text-gray-400 hover:text-red-500 p-1 bg-white border border-gray-100 rounded-lg hover:shadow-xs transition-colors"
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Action Step Title (e.g., Turn power panel off)"
                            value={step.title}
                            onChange={(e) => handleCreatorStepFieldChange(index, 'title', e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-xs focus:border-emerald-600 focus:outline-none font-semibold text-gray-900 shadow-xs"
                          />

                          <input
                            type="text"
                            placeholder="Tagline (e.g., Use non-contact tester)"
                            value={step.summary}
                            onChange={(e) => handleCreatorStepFieldChange(index, 'summary', e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-xs focus:border-emerald-600 focus:outline-none text-gray-600 shadow-xs"
                          />

                          {/* Image Insertion Options */}
                          <div className="bg-white border border-gray-100 p-2.5 rounded-xl space-y-2 shadow-xs">
                            <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                              <span>Step Photography</span>
                              {step.imageUrl && <span className="text-green-600">✓ Assigned</span>}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setUploadTargetIdx(uploadTargetIdx === index ? null : index)}
                                className="flex-1 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg text-[9px] font-bold text-gray-600 transition-colors flex items-center justify-center gap-1"
                              >
                                <ImageIcon /> Preset Library
                              </button>

                              <button
                                type="button"
                                onClick={() => triggerMockUpload(index)}
                                disabled={isUploading[index]}
                                className="flex-1 h-8 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-[9px] font-extrabold text-emerald-800 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                              >
                                {isUploading[index] ? (
                                  "Uploading..."
                                ) : (
                                  <>
                                    <CloudUploadIcon /> Simulate Upload
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Preset Image Selection Dropdown Grid */}
                            {uploadTargetIdx === index && (
                              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-50">
                                {PHOTO_PRESETS.map((preset, pIdx) => (
                                  <button
                                    key={pIdx}
                                    type="button"
                                    onClick={() => selectPresetPhoto(index, preset.url)}
                                    className="flex items-center gap-1 p-1 hover:bg-emerald-50/70 rounded-md transition-colors text-left"
                                  >
                                    <span className="w-6 h-6 rounded-md overflow-hidden bg-gray-100 inline-block flex-shrink-0">
                                      <img src={preset.url} alt="" className="object-cover w-full h-full" />
                                    </span>
                                    <span className="text-[9px] font-semibold text-gray-500 truncate">{preset.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Manual link override */}
                            <input
                              type="text"
                              placeholder="Or paste direct image web URL..."
                              value={step.imageUrl || ''}
                              onChange={(e) => handleCreatorStepFieldChange(index, 'imageUrl', e.target.value)}
                              className="w-full h-8 px-2.5 border border-gray-100 bg-gray-50 text-[10px] focus:outline-none rounded-lg text-gray-500 font-mono"
                            />
                          </div>

                          <textarea
                            placeholder="Detailed protocol procedure guidelines description..."
                            rows={3}
                            value={step.body}
                            onChange={(e) => handleCreatorStepFieldChange(index, 'body', e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-emerald-600 focus:outline-none text-gray-600 leading-relaxed font-normal shadow-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submitting handles */}
                <div className="pt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentView('dashboard')}
                    className="flex-1 h-11 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 shadow-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-11 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-100"
                  >
                    Publish SOP Manual
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW: VERTICAL TIMELINE DOCUMENT STEP VIEWER */}
          {currentView === 'document' && selectedDoc && currentUser && (
            <div className="space-y-5">
              
              {/* Headings Row */}
              <div className="flex items-center justify-between -ml-1 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                  >
                    <ArrowLeftIcon />
                  </button>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-emerald-800 font-extrabold flex items-center gap-1">
                      <TagIcon /> {selectedDoc.category} SOP
                    </span>
                    <h1 className="text-sm font-black text-gray-950 leading-tight line-clamp-1">{selectedDoc.title}</h1>
                  </div>
                </div>

                {currentUser.userType === 'admin' && (
                  <button
                    onClick={() => {
                      setRevisionNotes('');
                      setRevisionError('');
                      setCurrentView('addRevision');
                    }}
                    className="h-8 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 flex-shrink-0"
                  >
                    <HistoryIcon /> Revise
                  </button>
                )}
              </div>

              {/* Version & Author metadata block */}
              <div className="bg-gray-50 rounded-2xl p-3.5 flex justify-between items-center text-[10px] shadow-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-extrabold uppercase">Current Standard</span>
                    <span className="text-emerald-800 font-black">{selectedDoc.revisionHistory[0]?.version || 'v1.0'}</span>
                  </div>
                  <p className="text-gray-800 font-extrabold leading-none mt-1">Updated by {selectedDoc.lastUpdatedBy}</p>
                  <p className="text-gray-400 font-bold mt-1">Role: {selectedDoc.lastUpdatedByRole} • {selectedDoc.lastUpdated}</p>
                  
                  {/* Scheduled review date */}
                  <div className="flex items-center gap-1 text-[9px] text-amber-600 font-bold pt-1.5">
                    <CalendarIcon />
                    <span>Next Compliance Health Review: {selectedDoc.nextReviewDate || "12/28/2026"}</span>
                  </div>
                </div>
                <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-1.5 rounded-lg flex-shrink-0">
                  {selectedDoc.steps?.length} Steps
                </span>
              </div>

              {/* Tools & Materials */}
              {(selectedDoc.tools || selectedDoc.materials) && (
                <div className="grid grid-cols-2 gap-2">
                  {selectedDoc.tools && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5">
                      <p className="text-[8px] font-black text-blue-700 uppercase tracking-wider mb-1">🔧 Tools</p>
                      <p className="text-[10px] text-blue-900 font-medium leading-relaxed">{selectedDoc.tools}</p>
                    </div>
                  )}
                  {selectedDoc.materials && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                      <p className="text-[8px] font-black text-amber-700 uppercase tracking-wider mb-1">📦 Materials</p>
                      <p className="text-[10px] text-amber-900 font-medium leading-relaxed">{selectedDoc.materials}</p>
                    </div>
                  )}
                </div>
              )}

              {/* View toggle tabs */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setDocTab('checklist')}
                  className={`flex-1 text-center py-2 text-xs font-black rounded-lg transition-all ${
                    docTab === 'checklist' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Interactive Checklist
                </button>
                <button
                  onClick={() => setDocTab('history')}
                  className={`flex-1 text-center py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    docTab === 'history' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <HistoryIcon /> Read Audit Logs ({selectedDoc.readLogs?.length})
                </button>
              </div>

              {/* TAB 1: INTERACTIVE TIMELINE CHECKLIST */}
              {docTab === 'checklist' && (() => {
                const totalStepsCount = selectedDoc.steps?.length || 0;
                const completedCount = Object.values(completedSteps).filter(Boolean).length;
                const currentVersion = selectedDoc.revisionHistory[0]?.version || 'v1.0';
                const alreadySigned = selectedDoc.readLogs.some(l => l.userName === currentUser.name && l.versionRead === currentVersion);
                return (
                <div className="space-y-5">
                  {/* Mandatory step completions disclaimer */}
                  <div className="bg-emerald-50/50 text-[10px] text-emerald-900 p-2.5 rounded-xl font-bold flex items-start gap-1.5 leading-snug">
                    <AlertCircleIcon />
                    <span>Compliance Mandate: Please review instructions and check off each step on the left sequentially as you execute them.</span>
                  </div>

                  {/* Scrolling Timeline track */}
                  <div className="relative border-l-2 border-gray-100 pl-6 ml-3 mr-1 py-1 space-y-6">
                    {selectedDoc.steps?.map((step: Step, index: number) => {
                      const isStepDone = !!completedSteps[index];
                      return (
                        <div key={index} className="relative">
                          
                          {/* Checked/Unchecked index node bubble */}
                          <button
                            onClick={() => toggleStepCompleted(index)}
                            className={`absolute -left-[35px] top-1 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black border-4 border-white shadow-xs transition-all ${
                              isStepDone 
                                ? 'bg-green-500 text-white border-green-200' 
                                : 'bg-gray-200 hover:bg-emerald-200 text-gray-500 border-white'
                            }`}
                          >
                            {isStepDone ? <CheckIcon /> : (index + 1)}
                          </button>

                          {/* Action timeline steps card */}
                          <article 
                            onClick={() => toggleStepCompleted(index)}
                            className={`bg-white border rounded-2xl p-4 shadow-xs space-y-3.5 transition-all cursor-pointer ${
                              isStepDone 
                                ? 'border-green-100 bg-green-50/10' 
                                : 'border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            {step.imageUrl && step.imageUrl.trim() !== '' && (
                              <div className="relative w-full h-44 rounded-xl overflow-hidden bg-gray-100">
                                <img
                                  src={step.imageUrl}
                                  alt={step.title}
                                  className="object-cover w-full h-full"
                                  onError={(e) => {
                                    if (e.currentTarget.parentElement) e.currentTarget.parentElement.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}

                            <div className="space-y-1">
                              <span className={`text-[9px] font-bold tracking-wider uppercase block ${
                                isStepDone ? 'text-green-600' : 'text-emerald-800'
                              }`}>
                                {step.summary || "Instructional Action Guideline"}
                              </span>
                              <h3 className={`text-xs font-black leading-snug ${
                                isStepDone ? 'text-gray-500 line-through' : 'text-gray-900'
                              }`}>
                                {step.title}
                              </h3>
                              <p className={`text-[11px] leading-relaxed pt-1 font-semibold ${
                                isStepDone ? 'text-gray-400 font-normal' : 'text-gray-600 font-medium'
                              }`}>
                                {step.body}
                              </p>
                            </div>
                          </article>
                        </div>
                      );
                    })}
                  </div>

                  {/* Lock Indicator showing unchecked steps count */}
                  {completedCount < totalStepsCount && (
                    <div className="bg-amber-50 text-amber-800 p-2.5 rounded-xl text-[10px] font-bold text-center border border-amber-100 shadow-xs">
                      🔒 Verification Locked: Check off {totalStepsCount - completedCount} remaining procedural action steps to unlock sign-off.
                    </div>
                  )}

                  {/* Dynamic update request submission drawer */}
                  <div className="bg-emerald-50/20 border border-emerald-100/50 rounded-2xl p-4 space-y-3.5 shadow-xs">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <h4 className="text-[11px] font-black text-gray-900 leading-none flex items-center gap-1">
                          <SparklesIcon /> Spot an issue with this SOP?
                        </h4>
                        <p className="text-[9px] text-gray-400 mt-1 leading-snug">
                          Recommend standard operating procedure updates directly to administrators.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRecommendModal(!showRecommendModal)}
                        className="h-7 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-[9px] font-black transition-colors"
                      >
                        {showRecommendModal ? "Cancel" : "Recommend Update"}
                      </button>
                    </div>

                    {showRecommendModal && (
                      <form onSubmit={handleRecommendUpdate} className="space-y-2 pt-2 border-t border-emerald-100/30">
                        <textarea
                          rows={3}
                          required
                          value={recommendationNotes}
                          onChange={(e) => setRecommendationNotes(e.target.value)}
                          placeholder="e.g., We need to update Step 2 because the new model uses a different torque calibration value..."
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-[11px] focus:border-emerald-600 focus:outline-none leading-relaxed font-semibold"
                        />
                        <button
                          type="submit"
                          className="w-full h-9 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs"
                        >
                          Send Update Suggestion Alert
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Bottom validation button panel */}
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                    <div className="max-w-[55%]">
                      <h4 className="text-[11px] font-bold text-gray-900 leading-none">Compliance Registry</h4>
                      <p className="text-[9px] text-gray-400 mt-1 leading-snug">
                        Validating certifies full execution of procedural version {currentVersion}.
                      </p>
                    </div>

                    <button
                      onClick={handleMarkAsRead}
                      disabled={completedCount < totalStepsCount || alreadySigned}
                      className={`h-11 px-4 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 ${
                        alreadySigned
                          ? 'bg-green-100 text-green-700 cursor-not-allowed'
                          : completedCount < totalStepsCount
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed font-bold'
                          : 'bg-emerald-800 text-white hover:bg-emerald-900 active:scale-95 shadow-md shadow-emerald-100'
                      }`}
                    >
                      {alreadySigned ? (
                        <>
                          <AwardIcon /> Approved
                        </>
                      ) : (
                        <>
                          <CheckIcon /> Mark As Read
                        </>
                      )}
                    </button>
                  </div>
                </div>
                );
              })()}

              {/* TAB 2: AUDIT & REVISION LOG JOURNALS */}
              {docTab === 'history' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <HistoryIcon /> Version Revision Changelog
                    </h3>
                    <div className="space-y-3">
                      {selectedDoc.revisionHistory?.map((rev, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-1 shadow-xs">
                          <div className="flex justify-between items-center text-[10px] font-black text-gray-900">
                            <span className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md">{rev.version}</span>
                            <span className="text-gray-400">{rev.date}</span>
                          </div>
                          <p className="text-[11px] text-gray-800 font-bold mt-1">"{rev.notes}"</p>
                          <p className="text-[9px] text-gray-400 font-bold">
                            Revised by: {rev.updatedBy} ({rev.userRole})
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <AwardIcon /> Live Sign-off verification log ({selectedDoc.readLogs?.length})
                    </h3>
                    
                    {selectedDoc.readLogs && selectedDoc.readLogs.length === 0 ? (
                      <div className="bg-gray-50 text-center py-6 rounded-xl border border-dashed border-gray-200">
                        <p className="text-[11px] text-gray-400 font-bold">No compliance sign-offs registered yet.</p>
                        <p className="text-[9px] text-gray-400">Mark this document as read to log your verification.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedDoc.readLogs?.map((log, i) => (
                          <div key={i} className="bg-white border border-gray-100 p-2.5 rounded-xl flex items-center justify-between text-[10px]">
                            <div className="space-y-0.5">
                              <p className="text-gray-900 font-black">{log.userName}</p>
                              <p className="text-gray-400 font-medium">{log.userRole} • verified version {log.versionRead}</p>
                            </div>
                            <span className="text-[9px] font-bold text-gray-400">{log.timestamp}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Export Button */}
              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={() => {
                    const doc = selectedDoc;
                    const version = doc.revisionHistory[0]?.version || 'v1.0';
                    const lines: string[] = [
                      `SOP: ${doc.title}`,
                      `Category: ${doc.category}  |  Version: ${version}`,
                      `Last Updated: ${doc.lastUpdated} by ${doc.lastUpdatedBy} (${doc.lastUpdatedByRole})`,
                      `Next Review: ${doc.nextReviewDate}`,
                      '',
                      `OVERVIEW`,
                      doc.summary,
                      '',
                    ];
                    if (doc.tools)     lines.push(`TOOLS REQUIRED`, doc.tools, '');
                    if (doc.materials) lines.push(`MATERIALS NEEDED`, doc.materials, '');
                    lines.push(`CHECKLIST STEPS`);
                    doc.steps?.forEach((step, i) => {
                      lines.push(``, `Step ${i + 1}: ${step.title}`);
                      if (step.summary) lines.push(`  Summary: ${step.summary}`);
                      lines.push(`  ${step.body}`);
                    });
                    lines.push('', `REVISION HISTORY`);
                    doc.revisionHistory?.forEach(rev => {
                      lines.push(`  ${rev.version} — ${rev.date} — ${rev.updatedBy} (${rev.userRole})`);
                      lines.push(`  "${rev.notes}"`);
                    });
                    lines.push('', `SIGN-OFF LOG`);
                    if (doc.readLogs?.length) {
                      doc.readLogs.forEach(log => {
                        lines.push(`  ${log.userName} (${log.userRole}) — ${log.versionRead} — ${log.timestamp}`);
                      });
                    } else {
                      lines.push('  No sign-offs recorded.');
                    }
                    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${doc.title.replace(/[^a-z0-9]/gi, '_')}_${version}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full h-11 rounded-xl border border-gray-200 text-[11px] font-black text-gray-500 hover:text-emerald-800 hover:border-emerald-200 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Export SOP
                </button>
              </div>

            </div>
          )}

          {/* VIEW: ADD REVISION VERSION LOGGER (ADMIN-ONLY) */}
          {currentView === 'addRevision' && selectedDoc && currentUser && currentUser.userType === 'admin' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 -ml-1">
                <button
                  onClick={() => setCurrentView('document')}
                  className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                  <ArrowLeftIcon />
                </button>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">SOP Revision Journal</span>
                  <h1 className="text-sm font-black text-gray-900 leading-none">Drafting Version Changelog</h1>
                </div>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-3.5 text-[11px] space-y-1 shadow-xs">
                <p className="font-extrabold text-emerald-900">Revision Version Level Shift</p>
                <p className="text-emerald-800 font-medium">Document: "{selectedDoc.title}"</p>
                <p className="text-emerald-800 font-medium font-bold">
                  Target Next Version: {(() => {
                    const v = selectedDoc.revisionHistory[0]?.version;
                    if (!v) return 'v1.1';
                    const [major, minor] = v.replace('v', '').split('.').map(Number);
                    return `v${major}.${(minor ?? 0) + 1}`;
                  })()}
                </p>
              </div>

              {revisionError && (
                <div className="bg-red-50 border border-red-100 text-red-800 rounded-xl p-3 text-xs font-semibold">
                  ⚠️ {revisionError}
                </div>
              )}

              <form onSubmit={handlePublishRevision} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">Revision Action Notes</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="e.g., Updated safe micron boundaries for coil vacuums to align with updated field equipment protocols..."
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs focus:border-emerald-600 focus:outline-none transition-all text-gray-800 leading-relaxed font-semibold placeholder:text-gray-300 shadow-xs"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentView('document')}
                    className="flex-1 h-11 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 shadow-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-11 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-100"
                  >
                    Commit Revision Log
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW: COMPREHENSIVE ADMIN OVERSIGHT COMPLIANCE CONSOLE (ADMIN-ONLY) */}
          {currentView === 'adminConsole' && currentUser && currentUser.userType === 'admin' && (
            <div className="space-y-5">
              
              {/* Back nav header */}
              <div className="flex items-center gap-2 -ml-1 border-b border-gray-100 pb-3">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                  <ArrowLeftIcon />
                </button>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-emerald-800 font-extrabold flex items-center gap-1">
                    <ShieldIcon /> ADMINISTRATOR CONSOLE
                  </span>
                  <h1 className="text-sm font-black text-gray-950 leading-tight">Oversight & Compliance Matrix</h1>
                </div>
              </div>

              {/* Top Analytical Progress Indicators */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-4 text-white space-y-4 shadow-lg">
                <div className="flex justify-between items-center border-b border-gray-700/60 pb-3">
                  <div>
                    <span className="text-[9px] font-extrabold text-gray-400 tracking-wider uppercase">OVERALL WORKSPACE HEALTH</span>
                    <h3 className="text-xl font-black mt-0.5">{aggregateComplianceRate}% Compliance</h3>
                  </div>
                  <span className="text-[10px] bg-blue-600 text-white font-black px-2.5 py-1 rounded-xl">
                    Active Audit
                  </span>
                </div>

                {/* Progress compliance bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${aggregateComplianceRate}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                    <span>Incomplete (Gaps)</span>
                    <span>100% Fully Compliant</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="bg-gray-800/80 p-2 rounded-xl">
                    <p className="text-[9px] text-gray-400 font-bold leading-none">Total SOPs</p>
                    <p className="text-base font-black mt-1 leading-none">{totalSOPsCount}</p>
                  </div>
                  <div className="bg-gray-800/80 p-2 rounded-xl">
                    <p className="text-[9px] text-gray-400 font-bold leading-none">Total Team</p>
                    <p className="text-base font-black mt-1 leading-none">{totalTeamSize}</p>
                  </div>
                  <div className="bg-gray-800/80 p-2 rounded-xl">
                    <p className="text-[9px] text-gray-400 font-bold leading-none">Sign-offs</p>
                    <p className="text-base font-black mt-1 leading-none">{actualReadLogsCount}</p>
                  </div>
                </div>
              </div>

              {/* Admin Pending Notifications viewport */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  🔔 SOP Update Suggestions ({notifications.length})
                </h3>
                {notifications.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-100 text-center py-5 rounded-2xl shadow-xs">
                    <p className="text-[11px] text-gray-400 font-bold">No update recommendations pending.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.map((notif) => (
                      <div key={notif.id} className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 space-y-1 relative shadow-xs">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = notifications.filter(n => n.id !== notif.id);
                            setNotifications(updated);
                            localStorage.setItem('admin_notifications', JSON.stringify(updated));
                          }}
                          className="absolute top-2.5 right-2.5 text-amber-700 hover:text-red-500 p-1"
                          title="Dismiss Suggestion"
                        >
                          ✕
                        </button>
                        <p className="text-[9px] font-black text-emerald-800 uppercase tracking-wider leading-none">
                          ALERT FOR: {notif.docTitle}
                        </p>
                        <p className="text-[11px] text-gray-850 font-semibold leading-relaxed pt-0.5">
                          "{notif.notes}"
                        </p>
                        <div className="flex justify-between items-center text-[8px] text-gray-400 font-bold pt-1">
                          <span>By: {notif.suggestedBy} ({notif.suggestedByRole})</span>
                          <span>{notif.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Badge Management Panel */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  🏅 Badge Management
                </h3>
                <div className="space-y-3">
                  {PRESET_ACCOUNTS.map(account => {
                    const userBadges = allBadges.filter(b => b.user_name === account.name);
                    const unassigned = ALL_BADGES.filter(b => !userBadges.some(ub => ub.badge === b));
                    return (
                      <div key={account.name} className="bg-white border border-gray-100 p-3.5 rounded-2xl shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black text-gray-900">{account.name}</p>
                            <p className="text-[9px] text-gray-400 font-bold">{account.role}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {userBadges.map(ub => (
                            <BadgeChip key={ub.id} badge={ub.badge} onRemove={() => {
                              fetch('/api/badges', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userName: account.name, badge: ub.badge }),
                              }).then(r => {
                                if (r.ok) setAllBadges(prev => prev.filter(b => b.id !== ub.id));
                              });
                            }} />
                          ))}
                          {unassigned.map(badge => (
                            <button
                              key={badge}
                              onClick={() => {
                                fetch('/api/badges', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ userName: account.name, badge }),
                                }).then(r => r.ok ? r.json() : null).then(data => {
                                  if (data?.badge) setAllBadges(prev => [...prev, data.badge]);
                                });
                              }}
                              className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-emerald-400 hover:text-emerald-700 transition-colors leading-none"
                            >
                              + {badge}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Matrix List of SOP Read Statuses */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">SOP Readers Audit Matrix</h3>
                <div className="space-y-3">
                  {documents.map(doc => {
                    const readCount = doc.readLogs?.length || 0;
                    const completionPct = totalTeamSize > 0 ? Math.round((readCount / totalTeamSize) * 100) : 0;
                    
                    return (
                      <div key={doc.id} className="bg-white border border-gray-100 p-3.5 rounded-2xl shadow-xs space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[8px] font-black text-emerald-800 uppercase bg-emerald-50 px-1.5 py-0.5 rounded-xs tracking-wider">
                              {doc.category}
                            </span>
                            <h4 className="text-xs font-black text-gray-900 mt-1">{doc.title}</h4>
                          </div>
                          <span className="text-[10px] font-black text-gray-900">
                            v{doc.revisionHistory[0]?.version || 'v1.0'}
                          </span>
                        </div>

                        {/* Progress Bar for individual SOP */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-[9px] text-gray-400 font-bold leading-none mb-1">
                            <span>{readCount} of {totalTeamSize} Teammates Verified</span>
                            <span className="text-gray-700 font-extrabold">{completionPct}% Read</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${
                                completionPct > 70 ? 'bg-green-500' : completionPct > 35 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${completionPct}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Display list of readers/non-readers */}
                        <div className="pt-2.5 border-t border-gray-50 space-y-1">
                          <span className="text-[8px] font-black text-gray-400 tracking-wider uppercase block">Compliance Signature Roster</span>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-0.5">
                            {doc.readLogs.length === 0 ? (
                              <span className="text-[9px] text-red-500 font-extrabold italic bg-red-50 px-1.5 py-0.5 rounded-md">
                                ⚠️ Zero Sign-offs Registered
                              </span>
                            ) : (
                              doc.readLogs.map((log, lIdx) => (
                                <span 
                                  key={lIdx}
                                  className="text-[9px] bg-green-50 text-green-700 font-extrabold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                                >
                                  <CheckIcon /> {log.userName}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* VIEW: HANDBOOK */}
          {currentView === 'handbook' && currentUser && (
            <div className="space-y-5">
              <div>
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Company Resource</span>
                <h1 className="text-2xl font-black text-gray-950 mt-0.5 tracking-tight">Handbook</h1>
                <p className="text-xs text-gray-400 mt-1">Policies, culture guidelines, and team expectations.</p>
              </div>

              {handbookLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {handbookError && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircleIcon />
                  <p className="text-xs text-red-700">{handbookError}</p>
                </div>
              )}

              {!handbookLoading && !handbookError && handbookSections.length === 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-800 text-white rounded-2xl flex items-center justify-center mx-auto">
                    <HandbookIcon />
                  </div>
                  <p className="text-sm font-black text-gray-900">No Content Yet</p>
                  <p className="text-xs text-gray-400 max-w-[220px] mx-auto leading-relaxed">Handbook sections have not been loaded. Contact your administrator.</p>
                </div>
              )}

              {!handbookLoading && handbookSections.length > 0 && (
                <div className="space-y-2">
                  {handbookSections.map((section) => {
                    const isOpen = expandedSection === section.id;
                    return (
                      <div key={section.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                        <button
                          onClick={() => setExpandedSection(isOpen ? null : section.id)}
                          className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                        >
                          <span className="text-sm font-bold text-gray-900 leading-snug pr-3">{section.title}</span>
                          <span className={`flex-shrink-0 w-5 h-5 text-emerald-800 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                            <ChevronRightIcon />
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 border-t border-gray-50">
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line pt-3">{section.content}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW: CAREER LADDER — Employee */}
          {currentView === 'careerLadder' && currentUser && (() => {
            const assignedTrack = myAssignment ? careerTracks.find(t => t.id === myAssignment.track_id) : null;
            const totalTasks = assignedTrack ? assignedTrack.tasks.length : 0;
            const doneTasks = assignedTrack ? assignedTrack.tasks.filter(t => careerCompletions.some(c => c.task_id === t.id)).length : 0;
            const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
            return (
              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Growth & Development</span>
                    <h1 className="text-2xl font-black text-gray-950 mt-0.5 tracking-tight">Career Ladder</h1>
                    <p className="text-xs text-gray-400 mt-1">Check off skills as you master them.</p>
                  </div>
                  {currentUser.userType === 'admin' && (
                    <button
                      onClick={() => { setCurrentView('careerAdmin'); if (careerTracks.length === 0) loadCareerData(); }}
                      className="flex items-center gap-1.5 bg-emerald-800 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl"
                    >
                      <ShieldIcon />
                      Team
                    </button>
                  )}
                </div>

                {careerLoading && (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {careerError && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2">
                    <p className="text-xs text-amber-800 font-bold">Career ladder tables not found.</p>
                    <p className="text-xs text-amber-700">Run the career ladder SQL in Supabase, then tap Retry.</p>
                    <button onClick={() => { setCareerError(''); loadCareerData(); }} className="text-xs font-bold text-emerald-800 bg-white border border-emerald-200 rounded-xl px-3 py-1.5">Retry</button>
                  </div>
                )}

                {/* Employee: not yet assigned */}
                {!careerLoading && !careerError && !assignedTrack && currentUser.userType !== 'admin' && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-2">
                    <div className="w-12 h-12 bg-emerald-800 text-white rounded-2xl flex items-center justify-center mx-auto">
                      <CareerIcon />
                    </div>
                    <p className="text-sm font-black text-gray-900">Path Not Assigned Yet</p>
                    <p className="text-xs text-gray-400 max-w-[220px] mx-auto leading-relaxed">Your admin will assign your career path and starting level. Check back soon.</p>
                  </div>
                )}

                {/* Employee / Admin: assigned track view */}
                {!careerLoading && !careerError && assignedTrack && (
                  <div className="space-y-4">
                    {/* Assignment banner */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">{assignedTrack.department}</p>
                          <p className="text-base font-black text-gray-900 mt-0.5">{assignedTrack.name}</p>
                          {myAssignment && <p className="text-[10px] text-gray-400 mt-0.5">Assigned by {myAssignment.assigned_by}</p>}
                        </div>
                        <span className="text-2xl font-black text-emerald-800">{pct}%</span>
                      </div>
                      <div className="mt-3 h-2 bg-emerald-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-emerald-700 mt-1">{doneTasks} of {totalTasks} tasks complete</p>
                    </div>

                    {/* Task list */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
                      {assignedTrack.tasks.length === 0 && (
                        <p className="text-xs text-gray-400 px-4 py-6 text-center">No tasks added to this level yet.</p>
                      )}
                      {assignedTrack.tasks.map(task => {
                        const completion = careerCompletions.find(c => c.task_id === task.id);
                        const isDone = !!completion;
                        const isTaskOpen = expandedTask === task.id;
                        const linkedSop = task.sop_title ? documents.find(d => d.title.toLowerCase().includes(task.sop_title.toLowerCase())) : null;
                        const hasDetail = !!(task.description || (task.image_urls && task.image_urls.length > 0) || task.sop_title);
                        return (
                          <div key={task.id} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleTaskCompletion(task)}
                                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 ${isDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300'}`}
                              >
                                {isDone && <CheckIcon />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <button onClick={() => hasDetail && setExpandedTask(isTaskOpen ? null : task.id)} className="text-left w-full">
                                  <p className={`text-sm font-semibold leading-snug ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                                  {isDone && completion && (
                                    <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">
                                      Completed {new Date(completion.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                </button>
                                {isTaskOpen && (
                                  <div className="mt-3 space-y-3">
                                    {task.description ? <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{task.description}</p> : null}
                                    {task.image_urls && task.image_urls.length > 0 && (
                                      <div className="flex gap-2 overflow-x-auto pb-1">
                                        {task.image_urls.map((url, i) => (
                                          <img key={i} src={url} alt={`Example ${i + 1}`} className="h-32 w-auto rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                                        ))}
                                      </div>
                                    )}
                                    {linkedSop && (
                                      <button onClick={() => { setSelectedDoc(linkedSop); setCurrentView('document'); }} className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 w-full text-left">
                                        <BookOpenIcon />
                                        <span className="text-xs font-bold text-emerald-800 truncate">View SOP: {linkedSop.title}</span>
                                        <ChevronRightIcon />
                                      </button>
                                    )}
                                    {task.sop_title && !linkedSop && (
                                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                                        <BookOpenIcon />
                                        <span className="text-xs text-gray-400 truncate">SOP ref: {task.sop_title}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {hasDetail && (
                                <button onClick={() => setExpandedTask(isTaskOpen ? null : task.id)} className={`flex-shrink-0 text-gray-300 transition-transform duration-150 ${isTaskOpen ? 'rotate-90' : ''}`}>
                                  <ChevronRightIcon />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Admin: add task inline */}
                      {currentUser.userType === 'admin' && (
                        <div className="px-4 py-3">
                          {showAddTask === assignedTrack.id ? (
                            <div className="space-y-2">
                              <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Task title*" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs" />
                              <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} placeholder="Description (what to do / why it matters)" rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none" />
                              <textarea value={newTaskImages} onChange={e => setNewTaskImages(e.target.value)} placeholder="Image URLs — one per line" rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none" />
                              <input value={newTaskSop} onChange={e => setNewTaskSop(e.target.value)} placeholder="Linked SOP title (partial match ok)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs" />
                              <div className="flex gap-2">
                                <button onClick={() => addCareerTask(assignedTrack.id)} className="flex-1 bg-emerald-800 text-white text-xs font-bold rounded-xl py-2">Add Task</button>
                                <button onClick={() => setShowAddTask(null)} className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-xl py-2">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setShowAddTask(assignedTrack.id)} className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                              <PlusIcon /> Add Task to This Level
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin: add level form */}
                {currentUser.userType === 'admin' && !careerLoading && !careerError && (
                  <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-4">
                    {showAddTrack ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">New Level</p>
                        <div className="flex gap-2">
                          {(['Home Performance', 'HVAC'] as const).map(d => (
                            <button key={d} onClick={() => setNewTrackDept(d)} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all ${newTrackDept === d ? 'bg-emerald-800 text-white border-emerald-800' : 'border-gray-200 text-gray-400'}`}>{d}</button>
                          ))}
                        </div>
                        <input value={newTrackName} onChange={e => setNewTrackName(e.target.value)} placeholder="Level name (e.g. Apprentice, Jr Tech)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                        <input value={newTrackDesc} onChange={e => setNewTrackDesc(e.target.value)} placeholder="Short description (optional)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs" />
                        <div className="flex gap-2">
                          <button onClick={addCareerTrack} className="flex-1 bg-emerald-800 text-white text-xs font-bold rounded-xl py-2">Create Level</button>
                          <button onClick={() => setShowAddTrack(false)} className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-xl py-2">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddTrack(true)} className="flex items-center justify-center gap-2 w-full text-gray-400 text-xs font-bold">
                        <PlusIcon /> Add New Level
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* VIEW: CAREER LADDER — Admin Team Dashboard */}
          {currentView === 'careerAdmin' && currentUser && currentUser.userType === 'admin' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setCurrentView('careerLadder')} className="text-gray-400">
                  <ArrowLeftIcon />
                </button>
                <div>
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Admin View</span>
                  <h1 className="text-2xl font-black text-gray-950 tracking-tight">Team Progress</h1>
                </div>
              </div>

              {careerLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!careerLoading && (
                <div className="space-y-3">
                  {PRESET_ACCOUNTS.filter(a => a.userType !== 'admin').map(account => {
                    const assignment = allAssignments.find(a => a.user_name === account.name);
                    const assignedTrack = assignment ? careerTracks.find(t => t.id === assignment.track_id) : null;
                    const userCompletions = allCareerCompletions.filter(c => c.user_name === account.name);
                    const totalTasks = assignedTrack ? assignedTrack.tasks.length : 0;
                    const doneTasks = assignedTrack ? assignedTrack.tasks.filter(t => userCompletions.some(c => c.task_id === t.id)).length : 0;
                    const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                    const sorted = [...userCompletions].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
                    const lastActivity = sorted[0];
                    const isAssigning = assigningUser === account.name;
                    return (
                      <div key={account.name} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{account.name}</p>
                            <p className="text-[11px] text-gray-400">{account.role}</p>
                          </div>
                          <button
                            onClick={() => { setAssigningUser(isAssigning ? null : account.name); setAssignDept(assignedTrack?.department as any || 'Home Performance'); setAssignTrackId(assignedTrack?.id || null); }}
                            className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5"
                          >
                            {assignedTrack ? 'Reassign' : 'Assign Path'}
                          </button>
                        </div>

                        {/* Assignment picker */}
                        {isAssigning && (
                          <div className="space-y-2 bg-gray-50 rounded-xl p-3">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Assign Career Path</p>
                            <div className="flex gap-2">
                              {(['Home Performance', 'HVAC'] as const).map(d => (
                                <button key={d} onClick={() => { setAssignDept(d); setAssignTrackId(null); }} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all ${assignDept === d ? 'bg-emerald-800 text-white border-emerald-800' : 'border-gray-200 text-gray-400'}`}>{d}</button>
                              ))}
                            </div>
                            <select
                              value={assignTrackId || ''}
                              onChange={e => setAssignTrackId(Number(e.target.value))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white"
                            >
                              <option value="">Select level...</option>
                              {careerTracks.filter(t => t.department === assignDept).map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                onClick={() => assignTrackId && saveAssignment(account.name, account.role, assignTrackId)}
                                disabled={!assignTrackId}
                                className="flex-1 bg-emerald-800 text-white text-xs font-bold rounded-xl py-2 disabled:opacity-40"
                              >
                                Save Assignment
                              </button>
                              <button onClick={() => setAssigningUser(null)} className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-xl py-2">Cancel</button>
                            </div>
                          </div>
                        )}

                        {/* Current path & progress */}
                        {assignedTrack ? (
                          <>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] text-emerald-700 font-black uppercase tracking-wider">{assignedTrack.department}</p>
                                <p className="text-xs font-bold text-gray-700">{assignedTrack.name}</p>
                              </div>
                              <span className="text-base font-black text-emerald-800">{pct}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-400">
                              <span>{doneTasks} of {totalTasks} tasks complete</span>
                              {lastActivity && <span>Last: {new Date(lastActivity.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400 italic">No path assigned yet.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Unified Mobile Bottom Navigation Drawer */}
        {currentUser && currentView !== 'login' && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 flex items-center justify-around px-2 z-50 shadow-lg">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex flex-col items-center gap-1 flex-1 transition-all ${
                currentView === 'dashboard' || currentView === 'document' || currentView === 'addRevision' ? 'text-emerald-800 scale-105' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <FolderIcon />
              <span className="text-[9px] font-black tracking-wider uppercase">SOPs</span>
            </button>

            <button
              onClick={() => setCurrentView('handbook')}
              className={`flex flex-col items-center gap-1 flex-1 transition-all ${
                currentView === 'handbook' ? 'text-emerald-800 scale-105' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <HandbookIcon />
              <span className="text-[9px] font-black tracking-wider uppercase">Handbook</span>
            </button>

            <button
              onClick={() => setCurrentView('careerLadder')}
              className={`flex flex-col items-center gap-1 flex-1 transition-all ${
                currentView === 'careerLadder' || currentView === 'careerAdmin' ? 'text-emerald-800 scale-105' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <CareerIcon />
              <span className="text-[9px] font-black tracking-wider uppercase">Career</span>
            </button>

            {currentUser.userType === 'admin' && (
              <>
                <button
                  onClick={() => setCurrentView('new')}
                  className={`flex flex-col items-center gap-1 flex-1 transition-all ${
                    currentView === 'new' ? 'text-emerald-800 scale-105' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <PlusIcon />
                  <span className="text-[9px] font-black tracking-wider uppercase">Draft</span>
                </button>

                <button
                  onClick={() => setCurrentView('adminConsole')}
                  className={`flex flex-col items-center gap-1 flex-1 transition-all ${
                    currentView === 'adminConsole' ? 'text-emerald-800 scale-105' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <ShieldIcon />
                  <span className="text-[9px] font-black tracking-wider uppercase">Audit</span>
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
