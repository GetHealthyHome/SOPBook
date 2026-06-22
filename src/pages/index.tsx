
import React, { useEffect, useState } from 'react';

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
  steps: Step[];
  revisionHistory: Revision[];
  readLogs: ReadLog[];
}

interface User {
  name: string;
  role: string;      // Operational job title (e.g., HVAC Lead, Field Apprentice)
  userType: 'admin' | 'user'; // Explicit permissions restriction
}

const PRESET_ACCOUNTS = [
  { name: "Marcus Thorne", role: "HVAC Supervisor", userType: "admin", password: "marcusPassword" },
  { name: "Sarah Lin", role: "Master Electrician", userType: "admin", password: "sarahPassword" },
  { name: "Alex Rivers", role: "Field Apprentice", userType: "user", password: "alexPassword" },
  { name: "Derrick Vance", role: "Plumbing Specialist", userType: "user", password: "derrickPassword" }
];

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

export default function App() {
  // Mounting check to eliminate Next.js server/client hydration mismatch errors
  const [mounted, setMounted] = useState(false);

  // Navigation Router: login, dashboard, new, document, addRevision, adminConsole
  const [currentView, setCurrentView] = useState<'login' | 'dashboard' | 'new' | 'document' | 'addRevision' | 'adminConsole' | 'handbook' | 'careerLadder'>('login');
  
  // Account authorization state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginName, setLoginName] = useState('');
  const [loginRole, setLoginRole] = useState('Field Apprentice');
  const [loginUserType, setLoginUserType] = useState<'admin' | 'user'>('user');
  
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showDemoDirectory, setShowDemoDirectory] = useState(false);
  
  // Core Operational Procedures Database State
  const [documents, setDocuments] = useState<SOP[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<SOP | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [docTab, setDocTab] = useState<'checklist' | 'history'>('checklist');

  // Interactive Checklist completion tracking state
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  // Dynamic SOP Form state
  const [newCategory, setNewCategory] = useState('HVAC');
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
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
  const [notifications, setNotifications] = useState<any[]>([]);

  // Auto-sync databases on boot
  useEffect(() => {
    setMounted(true);
    try {
      const savedUser = localStorage.getItem('sop_user');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
        setCurrentView('dashboard');
      }

      const savedSOPs = localStorage.getItem('sop_database_v3');
      if (savedSOPs) {
        setDocuments(JSON.parse(savedSOPs));
      } else {
        localStorage.setItem('sop_database_v3', JSON.stringify(DEFAULT_SOPS));
        setDocuments(DEFAULT_SOPS);
      }

      // Load active admin update recommendations
      const savedNotifs = localStorage.getItem('admin_notifications');
      if (savedNotifs) {
        setNotifications(JSON.parse(savedNotifs));
      }
    } catch (e) {
      setDocuments(DEFAULT_SOPS);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveToLocal = (newDocs: SOP[]) => {
    setDocuments(newDocs);
    try {
      localStorage.setItem('sop_database_v3', JSON.stringify(newDocs));
    } catch (e) {
      console.warn("Storage exception:", e);
    }
  };

  // Handler for recommending SOP updates
  const handleRecommendUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedDoc || !recommendationNotes.trim()) return;

    const newNotif = {
      id: `notif-${Date.now()}`,
      docId: selectedDoc.id,
      docTitle: selectedDoc.title,
      suggestedBy: currentUser.name,
      suggestedByRole: currentUser.role,
      notes: recommendationNotes.trim(),
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
    saveToLocal(DEFAULT_SOPS);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginName.trim()) {
      setLoginError('Teammate Name is required.');
      return;
    }
    if (!loginPassword) {
      setLoginError('Password is required.');
      return;
    }

    const matchedAccount = PRESET_ACCOUNTS.find(
      acc => acc.name.toLowerCase() === loginName.trim().toLowerCase()
    );

    if (matchedAccount) {
      if (matchedAccount.password !== loginPassword) {
        setLoginError('Incorrect password for this teammate account.');
        return;
      }
      
      const userObj: User = { 
        name: matchedAccount.name, 
        role: matchedAccount.role, 
        userType: matchedAccount.userType as 'admin' | 'user' 
      };
      setCurrentUser(userObj);
      localStorage.setItem('sop_user', JSON.stringify(userObj));
      setCurrentView('dashboard');
    } else {
      const userObj: User = { 
        name: loginName.trim(), 
        role: loginRole, 
        userType: loginUserType 
      };
      setCurrentUser(userObj);
      localStorage.setItem('sop_user', JSON.stringify(userObj));
      setCurrentView('dashboard');
    }

    setLoginPassword('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sop_user');
    setLoginPassword('');
    setLoginError('');
    setCurrentView('login');
  };

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

  const handlePublishSOP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.userType !== 'admin') return;
    
    if (!newTitle.trim() || !newSummary.trim()) {
      setFormError('Please enter a procedure title and overview tagline.');
      return;
    }
    const emptySteps = newSteps.some(s => !s.title.trim() || !s.body.trim());
    if (emptySteps) {
      setFormError('All checklists require a step action title and procedural body.');
      return;
    }

    const todayString = new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });

    const nextYear = new Date();
    nextYear.setMonth(nextYear.getMonth() + 6);
    const reviewString = nextYear.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });

    const newSOP: SOP = {
      id: `sop-${Date.now()}`,
      category: newCategory,
      title: newTitle,
      summary: newSummary,
      lastUpdated: todayString,
      lastUpdatedBy: currentUser.name,
      lastUpdatedByRole: currentUser.role,
      nextReviewDate: reviewString,
      steps: newSteps,
      revisionHistory: [
        {
          version: "v1.0",
          date: todayString,
          updatedBy: currentUser.name,
          userRole: currentUser.role,
          notes: "Initial protocol creation and structural verification check paths setup."
        }
      ],
      readLogs: []
    };

    const updated = [newSOP, ...documents];
    saveToLocal(updated);

    setNewTitle('');
    setNewSummary('');
    setNewCategory('HVAC');
    setNewSteps([{ title: '', summary: '', body: '', imageUrl: '' }]);
    setFormError('');
    setCurrentView('dashboard');
  };

  const handleMarkAsRead = () => {
    if (!currentUser || !selectedDoc) return;

    const totalSteps = selectedDoc.steps?.length || 0;
    const completedCount = Object.keys(completedSteps).filter(k => completedSteps[parseInt(k)]).length;
    if (completedCount < totalSteps) {
      return; 
    }

    const todayString = new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const currentVersion = selectedDoc.revisionHistory[0]?.version || 'v1.0';

    const alreadySigned = selectedDoc.readLogs.some(
      log => log.userName === currentUser.name && log.versionRead === currentVersion
    );

    if (alreadySigned) return;

    const newLog: ReadLog = {
      userName: currentUser.name,
      userRole: currentUser.role,
      timestamp: todayString,
      versionRead: currentVersion
    };

    const updatedDoc = {
      ...selectedDoc,
      readLogs: [newLog, ...selectedDoc.readLogs]
    };

    setSelectedDoc(updatedDoc);

    const updatedDocsList = documents.map(d => d.id === selectedDoc.id ? updatedDoc : d);
    saveToLocal(updatedDocsList);
  };

  const handlePublishRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedDoc || currentUser.userType !== 'admin') return;
    if (!revisionNotes.trim()) {
      setRevisionError('Please enter detailed changelog notes.');
      return;
    }

    const todayString = new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });

    const latestRev = selectedDoc.revisionHistory[0];
    let nextVerNum = "1.0";
    if (latestRev && latestRev.version) {
      const parsed = parseFloat(latestRev.version.replace('v', ''));
      nextVerNum = `v${(parsed + 0.1).toFixed(1)}`;
    }

    const newRevLog: Revision = {
      version: nextVerNum,
      date: todayString,
      updatedBy: currentUser.name,
      userRole: currentUser.role,
      notes: revisionNotes.trim()
    };

    const updatedDoc: SOP = {
      ...selectedDoc,
      lastUpdated: todayString,
      lastUpdatedBy: currentUser.name,
      lastUpdatedByRole: currentUser.role,
      revisionHistory: [newRevLog, ...selectedDoc.revisionHistory]
    };

    setSelectedDoc(updatedDoc);
    setRevisionNotes('');
    setRevisionError('');

    const updatedList = documents.map(d => d.id === selectedDoc.id ? updatedDoc : d);
    saveToLocal(updatedList);
    setCurrentView('document');
  };

  const categoriesList = ["All", "HVAC", "Electrical", "Plumbing", "Safety"];

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalSOPsCount = documents.length;
  const totalUniqueReadersCount = Array.from(new Set(documents.flatMap(d => d.readLogs.map(l => l.userName)))).length;
  
  const uniqueKnownTeammates = ["Alex Rivers", "Sarah Lin", "Marcus Thorne", "Derrick Vance"];
  const totalTeamSize = Math.max(uniqueKnownTeammates.length, totalUniqueReadersCount);
  const potentialTotalReadRecords = totalSOPsCount * totalTeamSize;
  const actualReadLogsCount = documents.reduce((sum, doc) => sum + doc.readLogs.length, 0);
  const aggregateComplianceRate = potentialTotalReadRecords > 0 
    ? Math.round((actualReadLogsCount / potentialTotalReadRecords) * 100) 
    : 100;

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

                <button
                  type="submit"
                  className="w-full h-12 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition-all active:scale-95 duration-100 mt-2"
                >
                  Enter Operational Portal
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
                      Copy and paste these pre-registered teammate credentials to test the permission flows (Admins can review logs and edit SOPs, Users can read and sign off):
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
                          <div className="text-right">
                            <span className="text-gray-400 text-[9px] block">Password:</span>
                            <code className="bg-white border border-gray-100 px-1.5 py-0.5 rounded-md font-mono font-bold text-emerald-800 select-all">{acc.password}</code>
                          </div>
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
              {docTab === 'checklist' && (
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
                                    e.currentTarget.parentElement!.style.display = 'none';
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
                  {Object.keys(completedSteps).filter(k => completedSteps[parseInt(k)]).length < (selectedDoc.steps?.length || 0) && (
                    <div className="bg-amber-50 text-amber-800 p-2.5 rounded-xl text-[10px] font-bold text-center border border-amber-100 shadow-xs">
                      🔒 Verification Locked: Check off { (selectedDoc.steps?.length || 0) - Object.keys(completedSteps).filter(k => completedSteps[parseInt(k)]).length } remaining procedural action steps to unlock sign-off.
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
                        Validating certifies full execution of procedural version {selectedDoc.revisionHistory[0]?.version || 'v1.0'}.
                      </p>
                    </div>

                    <button
                      onClick={handleMarkAsRead}
                      disabled={
                        Object.keys(completedSteps).filter(k => completedSteps[parseInt(k)]).length < (selectedDoc.steps?.length || 0) ||
                        selectedDoc.readLogs.some(l => l.userName === currentUser.name && l.versionRead === (selectedDoc.revisionHistory[0]?.version || 'v1.0'))
                      }
                      className={`h-11 px-4 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 ${
                        selectedDoc.readLogs.some(l => l.userName === currentUser.name && l.versionRead === (selectedDoc.revisionHistory[0]?.version || 'v1.0'))
                          ? 'bg-green-100 text-green-700 cursor-not-allowed'
                          : Object.keys(completedSteps).filter(k => completedSteps[parseInt(k)]).length < (selectedDoc.steps?.length || 0)
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed font-bold'
                          : 'bg-emerald-800 text-white hover:bg-emerald-900 active:scale-95 shadow-md shadow-emerald-100'
                      }`}
                    >
                      {selectedDoc.readLogs.some(l => l.userName === currentUser.name && l.versionRead === (selectedDoc.revisionHistory[0]?.version || 'v1.0')) ? (
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
              )}

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
                  Target Next Version: {selectedDoc.revisionHistory[0]?.version 
                    ? `v${(parseFloat(selectedDoc.revisionHistory[0].version.replace('v', '')) + 0.1).toFixed(1)}` 
                    : "v1.1"}
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
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-800 text-white rounded-2xl flex items-center justify-center mx-auto">
                  <HandbookIcon />
                </div>
                <p className="text-sm font-black text-gray-900">Coming Soon</p>
                <p className="text-xs text-gray-400 max-w-[220px] mx-auto leading-relaxed">The employee handbook section is being built out. Check back soon.</p>
              </div>
            </div>
          )}

          {/* VIEW: CAREER LADDER */}
          {currentView === 'careerLadder' && currentUser && (
            <div className="space-y-5">
              <div>
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Growth & Development</span>
                <h1 className="text-2xl font-black text-gray-950 mt-0.5 tracking-tight">Career Ladder</h1>
                <p className="text-xs text-gray-400 mt-1">Roles, progression paths, and skill benchmarks.</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-800 text-white rounded-2xl flex items-center justify-center mx-auto">
                  <CareerIcon />
                </div>
                <p className="text-sm font-black text-gray-900">Coming Soon</p>
                <p className="text-xs text-gray-400 max-w-[220px] mx-auto leading-relaxed">Career progression tracks and role benchmarks are being defined. Check back soon.</p>
              </div>
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
                currentView === 'careerLadder' ? 'text-emerald-800 scale-105' : 'text-gray-400 hover:text-gray-600'
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
