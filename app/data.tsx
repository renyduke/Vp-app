import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/supabaseClient';

const PENDING_KEY = 'agri_pending_entries';
const HIDDEN_COMMODITIES_KEY = 'agri_hidden_commodities';
const { width } = Dimensions.get('window');
const isSmallScreen = width < 350;

import { commodityCategories, CUSTOM_COMMODITIES_KEY, defaultCommodities } from '../src/constants';

const months = [
  { label: 'January', value: 1 },
  { label: 'February', value: 2 },
  { label: 'March', value: 3 },
  { label: 'April', value: 4 },
  { label: 'May', value: 5 },
  { label: 'June', value: 6 },
  { label: 'July', value: 7 },
  { label: 'August', value: 8 },
  { label: 'September', value: 9 },
  { label: 'October', value: 10 },
  { label: 'November', value: 11 },
  { label: 'December', value: 12 },
];

const weeks = [
  { label: 'Week 1 (Days 1-7)', value: 1 },
  { label: 'Week 2 (Days 8-14)', value: 2 },
  { label: 'Week 3 (Days 15-21)', value: 3 },
  { label: 'Week 4 (Days 22-28)', value: 4 },
  { label: 'Week 5 (Days 29-31)', value: 5 },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 2020 + 6 }, (_, i) => 2020 + i);

// Add activity types
type ActivityType = 'volume_added' | 'price_added' | 'data_updated' | 'pending_sync' | 'data_deleted' | 'profile_updated';

type Activity = {
  id: string;
  type: ActivityType;
  commodity: string;
  description: string;
  timestamp: string;
  user: string;
  period: string;
  details?: string;
  isPending?: boolean;
};

type PendingEntry =
  | { type: 'volume'; year: number; month: number; week: number; commodity: string; volume: number; encoded_by: string; encoded_at: string }
  | { type: 'price'; year: number; month: number; week: number; commodity: string; lowest: number; highest: number; average: number; encoded_by: string; encoded_at: string };

type DataRecord = {
  id: string;
  year: number;
  month: number;
  week: number;
  commodity: string;
  volume?: number;
  lowest_price?: number;
  highest_price?: number;
  average_price?: number;
  encoded_by: string;
  encoded_at: string;
  type: 'volume' | 'price' | 'merged';
  isPending?: boolean;
};

export default function DataScreen() {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState(1);

  const [allCommodities, setAllCommodities] = useState<string[]>(defaultCommodities);
  const [selectedCommodity, setSelectedCommodity] = useState(defaultCommodities[0]);
  const [commoditySearch, setCommoditySearch] = useState('');
  const [mode, setMode] = useState<'volume' | 'price'>('volume');
  const [showAddCommodity, setShowAddCommodity] = useState(false);
  const [newCommodityName, setNewCommodityName] = useState('');
  const [newCommodityUnit, setNewCommodityUnit] = useState('Per Kg.');
  const [volume, setVolume] = useState('');
  const [lowest, setLowest] = useState('');
  const [highest, setHighest] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [collectorImage, setCollectorImage] = useState<string | null>(null);
  const [showProfileViewer, setShowProfileViewer] = useState(false);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [showActivities, setShowActivities] = useState(true);

  const [dataRecords, setDataRecords] = useState<DataRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [showDataRecords, setShowDataRecords] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [editVolume, setEditVolume] = useState('');
  const [editLowest, setEditLowest] = useState('');
  const [editHighest, setEditHighest] = useState('');
  const [editCommodity, setEditCommodity] = useState(defaultCommodities[0]);
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'volume' | 'price'>('all');
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterWeek, setFilterWeek] = useState<number | 'all'>('all');
  const [recordsSearch, setRecordsSearch] = useState('');
  const [showManageCommodities, setShowManageCommodities] = useState(false);
  const [editingCustomCommodity, setEditingCustomCommodity] = useState<string | null>(null);
  const [editCustomCommodityName, setEditCustomCommodityName] = useState('');
  const [editCustomCommodityUnit, setEditCustomCommodityUnit] = useState('Per Kg.');
  const [manageSearch, setManageSearch] = useState('');
  const [hiddenCommodities, setHiddenCommodities] = useState<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const router = useRouter();
  const netInfoRef = useRef<any>(null);
  const volumeInputRef = useRef<TextInput>(null);
  const lowestInputRef = useRef<TextInput>(null);
  const highestInputRef = useRef<TextInput>(null);

  const themeColors = {
    background: isDarkMode ? '#121212' : '#f0f4f8',
    card: isDarkMode ? '#1e1e1e' : '#fff',
    text: isDarkMode ? '#e5e7eb' : '#1f2937',
    subtext: isDarkMode ? '#9ca3af' : '#6b7280',
    header: isDarkMode ? '#1a1a1a' : '#2d6a4f',
    border: isDarkMode ? '#333' : '#e5e7eb',
    inputBg: isDarkMode ? '#2a2a2a' : '#f9fafb',
    sidebar: isDarkMode ? '#1a1a1a' : '#fff',
    overlay: isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)',
    divider: isDarkMode ? '#333' : '#e5e7eb',
    activityItem: isDarkMode ? '#262626' : '#f9fafb',
  };

  // Load custom commodities from Supabase & AsyncStorage
  const loadCustomCommodities = async () => {
    try {
      let customList: string[] = [];
      const raw = await AsyncStorage.getItem(CUSTOM_COMMODITIES_KEY);
      if (raw) {
        customList = JSON.parse(raw);
      }

      // Fetch from Supabase
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        const { data, error } = await supabase
          .from('custom_commodities')
          .select('name');

        if (!error && data) {
          const supabaseCommodities = data.map(item => item.name);
          // Merge local and cloud commodities (avoid duplicates)
          const mergedSet = new Set([...customList, ...supabaseCommodities]);
          customList = Array.from(mergedSet);

          // Update local storage with the merged list
          await AsyncStorage.setItem(CUSTOM_COMMODITIES_KEY, JSON.stringify(customList));
        }
      }

      const merged = [...defaultCommodities, ...customList];
      setAllCommodities(merged);
      
      const hiddenRaw = await AsyncStorage.getItem(HIDDEN_COMMODITIES_KEY);
      if (hiddenRaw) {
        setHiddenCommodities(JSON.parse(hiddenRaw));
      }
    } catch (e) {
      console.warn('Failed to load custom commodities', e);
    }
  };

  useEffect(() => {
    loadCustomCommodities();
  }, []);

  // Theme loading & persistence
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themePreference');
        if (savedTheme) {
          setIsDarkMode(savedTheme === 'dark');
        }
      } catch (e) {
        console.warn('Failed to load theme preference', e);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem('themePreference', newMode ? 'dark' : 'light');
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
  };

  // Filter commodities based on search
  const filteredCommodities = allCommodities.filter(commodity =>
    commodity.toLowerCase().includes(commoditySearch.toLowerCase())
  );

  const average = (lowest && highest)
    ? ((parseFloat(lowest || '0') + parseFloat(highest || '0')) / 2).toFixed(2)
    : '';

  // Load current user and profile
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userStr = await AsyncStorage.getItem('currentUser');
        if (userStr) {
          const user = JSON.parse(userStr);
          setCurrentUsername(user.username);

          // Try to load from AsyncStorage first (for offline)
          const cachedImage = await AsyncStorage.getItem('collectorImage');
          if (cachedImage) {
            setCollectorImage(cachedImage);
          }

          // Fetch profile from Supabase
          try {
            const { data: profileData, error } = await supabase
              .from('collector_profiles')
              .select('avatar_url')
              .eq('username', user.username)
              .single();

            if (!error && profileData?.avatar_url) {
              setCollectorImage(profileData.avatar_url);
              await AsyncStorage.setItem('collectorImage', profileData.avatar_url);
            }
          } catch (dbError) {
            console.log('No profile found in database, using cached image');
          }
        } else {
          router.replace('/');
        }
      } catch (e) {
        console.error('Failed to load user', e);
        router.replace('/');
      }
    };
    loadUser();
  }, []);

  // Function to load activities
  const loadActivities = async () => {
    setIsLoadingActivities(true);
    try {
      const state = await NetInfo.fetch();
      const isOnline = !!state.isConnected;

      let loadedActivities: Activity[] = [];

      // Add timestamp activities from current session
      const periodLabel = `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}, Week ${selectedWeek}`;

      // Load existing data for selected period
      if (isOnline) {
        const [volumeData, priceData] = await Promise.all([
          supabase
            .from('agri_volume')
            .select('*')
            .eq('year', selectedYear)
            .eq('month', selectedMonth)
            .eq('week', selectedWeek)
            .order('encoded_at', { ascending: false }),
          supabase
            .from('agri_price')
            .select('*')
            .eq('year', selectedYear)
            .eq('month', selectedMonth)
            .eq('week', selectedWeek)
            .order('encoded_at', { ascending: false })
        ]);

        // Convert volume data to activities
        volumeData.data?.forEach((record: any) => {
          loadedActivities.push({
            id: `volume_${record.id}`,
            type: 'volume_added',
            commodity: record.commodity,
            description: `Volume data recorded`,
            details: `${record.volume} kg`,
            timestamp: record.encoded_at,
            user: record.encoded_by,
            period: periodLabel,
            isPending: false
          });
        });

        // Convert price data to activities
        priceData.data?.forEach((record: any) => {
          loadedActivities.push({
            id: `price_${record.id}`,
            type: 'price_added',
            commodity: record.commodity,
            description: `Price data recorded`,
            details: `₱${record.lowest_price} - ₱${record.highest_price}`,
            timestamp: record.encoded_at,
            user: record.encoded_by,
            period: periodLabel,
            isPending: false
          });
        });
      }

      // Load pending entries as activities
      const pendingEntries = await loadPending();
      pendingEntries.forEach((entry, index) => {
        if (entry.year === selectedYear && entry.month === selectedMonth && entry.week === selectedWeek) {
          loadedActivities.push({
            id: `pending_${index}`,
            type: 'pending_sync',
            commodity: entry.commodity,
            description: entry.type === 'volume' ? 'Volume data (pending sync)' : 'Price data (pending sync)',
            details: entry.type === 'volume'
              ? `${entry.volume} kg`
              : `₱${entry.lowest} - ₱${entry.highest}`,
            timestamp: entry.encoded_at,
            user: entry.encoded_by,
            period: periodLabel,
            isPending: true
          });
        }
      });

      // Sort activities by timestamp (newest first)
      loadedActivities.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Limit to 10 most recent activities
      setActivities(loadedActivities.slice(0, 10));
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  // Load activities when period changes or after saving
  useEffect(() => {
    if (showActivities) {
      loadActivities();
    }
  }, [selectedYear, selectedMonth, selectedWeek, showActivities]);

  // Load all data records
  const loadDataRecords = async () => {
    setIsLoadingRecords(true);
    try {
      const state = await NetInfo.fetch();
      const isOnline = !!state.isConnected;

      let allRecords: DataRecord[] = [];

      if (isOnline) {
        const [volumeData, priceData] = await Promise.all([
          supabase
            .from('agri_volume')
            .select('*')
            .eq('year', filterYear)
            .eq('month', filterMonth),
          supabase
            .from('agri_price')
            .select('*')
            .eq('year', filterYear)
            .eq('month', filterMonth)
        ]);

        if (volumeData.data) {
          const volumeRecords = volumeData.data.map((record: any) => ({
            ...record,
            id: `volume_${record.id}`,
            type: 'volume' as const,
            isPending: false
          }));
          allRecords = [...allRecords, ...volumeRecords];
        }

        if (priceData.data) {
          const priceRecords = priceData.data.map((record: any) => ({
            ...record,
            id: `price_${record.id}`,
            type: 'price' as const,
            isPending: false
          }));
          allRecords = [...allRecords, ...priceRecords];
        }
      }

      const pendingEntries = await loadPending();
      pendingEntries.forEach((entry, index) => {
        if (entry.year === filterYear && entry.month === filterMonth) {
          if (entry.type === 'volume') {
            allRecords.push({
              id: `pending_volume_${index}`,
              year: entry.year,
              month: entry.month,
              week: entry.week,
              commodity: entry.commodity,
              volume: entry.volume,
              encoded_by: entry.encoded_by,
              encoded_at: entry.encoded_at,
              type: 'volume',
              isPending: true
            });
          } else {
            allRecords.push({
              id: `pending_price_${index}`,
              year: entry.year,
              month: entry.month,
              week: entry.week,
              commodity: entry.commodity,
              lowest_price: entry.lowest,
              highest_price: entry.highest,
              average_price: entry.average,
              encoded_by: entry.encoded_by,
              encoded_at: entry.encoded_at,
              type: 'price',
              isPending: true
            });
          }
        }
      });

      // If showing "all", merge volume and price records for the same commodity and period
      if (recordTypeFilter === 'all') {
        const mergedRecordsMap = new Map<string, DataRecord>();

        allRecords.forEach(record => {
          const key = `${record.year}-${record.month}-${record.week}-${record.commodity}`;

          if (mergedRecordsMap.has(key)) {
            // Merge with existing record
            const existing = mergedRecordsMap.get(key)!;

            if (record.type === 'volume' && !existing.volume) {
              mergedRecordsMap.set(key, {
                ...existing,
                volume: record.volume,
                encoded_by: existing.encoded_by || record.encoded_by,
                encoded_at: new Date(record.encoded_at) > new Date(existing.encoded_at)
                  ? record.encoded_at
                  : existing.encoded_at,
                type: 'merged',
                isPending: existing.isPending || record.isPending
              });
            }
            else if (record.type === 'price' && !existing.lowest_price) {
              mergedRecordsMap.set(key, {
                ...existing,
                lowest_price: record.lowest_price,
                highest_price: record.highest_price,
                average_price: record.average_price,
                encoded_by: existing.encoded_by || record.encoded_by,
                encoded_at: new Date(record.encoded_at) > new Date(existing.encoded_at)
                  ? record.encoded_at
                  : existing.encoded_at,
                type: 'merged',
                isPending: existing.isPending || record.isPending
              });
            }
          } else {
            mergedRecordsMap.set(key, {
              ...record,
              type: 'merged'
            });
          }
        });

        allRecords = Array.from(mergedRecordsMap.values());
      } else {
        allRecords = allRecords.filter(record => record.type === recordTypeFilter);
      }

      if (filterWeek !== 'all') {
        allRecords = allRecords.filter(record => record.week === filterWeek);
      }

      if (recordsSearch.trim() !== '') {
        const searchTerm = recordsSearch.toLowerCase().trim();
        allRecords = allRecords.filter(record =>
          record.commodity.toLowerCase().includes(searchTerm) ||
          record.encoded_by.toLowerCase().includes(searchTerm) ||
          (record.volume !== undefined && record.volume.toString().includes(searchTerm)) ||
          (record.lowest_price !== undefined && record.lowest_price.toString().includes(searchTerm)) ||
          (record.highest_price !== undefined && record.highest_price.toString().includes(searchTerm)) ||
          (record.average_price !== undefined && record.average_price.toString().includes(searchTerm))
        );
      }

      allRecords.sort((a, b) => {
        if (a.week !== b.week) return a.week - b.week;
        if (a.commodity !== b.commodity) return a.commodity.localeCompare(b.commodity);
        return 0;
      });

      setDataRecords(allRecords);
    } catch (error) {
      console.error('Error loading data records:', error);
      Alert.alert('Error', 'Failed to load data records');
    } finally {
      setIsLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (showDataRecords) {
      loadDataRecords();
    }
  }, [showDataRecords, filterYear, filterMonth, filterWeek, recordTypeFilter, recordsSearch]);

  const loadPending = async (): Promise<PendingEntry[]> => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Failed to load pending entries', e);
      return [];
    }
  };

  const savePending = async (items: PendingEntry[]) => {
    try {
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save pending entries', e);
    }
  };

  const addPending = async (entry: PendingEntry) => {
    const list = await loadPending();
    list.push(entry);
    await savePending(list);
  };

  const syncPending = async () => {
    const pending = await loadPending();
    if (!pending.length) return;

    setIsSaving(true);

    const volumes = pending.filter(p => p.type === 'volume') as Extract<PendingEntry, { type: 'volume' }>[];
    const prices = pending.filter(p => p.type === 'price') as Extract<PendingEntry, { type: 'price' }>[];

    try {
      if (volumes.length) {
        const rows = volumes.map(v => ({
          year: v.year,
          month: v.month,
          week: v.week,
          commodity: v.commodity,
          volume: v.volume,
          encoded_by: v.encoded_by,
          encoded_at: v.encoded_at
        }));
        const { error: volError } = await supabase.from('agri_volume').insert(rows);
        if (volError) throw volError;
      }

      if (prices.length) {
        const rows = prices.map(p => ({
          year: p.year,
          month: p.month,
          week: p.week,
          commodity: p.commodity,
          lowest_price: p.lowest,
          highest_price: p.highest,
          average_price: p.average,
          encoded_by: p.encoded_by,
          encoded_at: p.encoded_at
        }));
        const { error: priceError } = await supabase.from('agri_price').insert(rows);
        if (priceError) throw priceError;
      }

      await AsyncStorage.removeItem(PENDING_KEY);

      // Add sync activity
      const syncActivity: Activity = {
        id: `sync_${Date.now()}`,
        type: 'pending_sync',
        commodity: 'Multiple',
        description: 'Pending data synced successfully',
        details: `${volumes.length} volume, ${prices.length} price records`,
        timestamp: new Date().toISOString(),
        user: currentUsername,
        period: 'Online Sync',
        isPending: false
      };
      setActivities(prev => [syncActivity, ...prev.slice(0, 9)]);

      setSuccessMessage('All pending data synced successfully!');
      setShowSuccess(true);

      loadActivities();
      if (showDataRecords) loadDataRecords();
    } catch (err: any) {
      console.warn('Sync failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    (async () => {
      const state = await NetInfo.fetch();
      if (state.isConnected) await syncPending();
    })();

    netInfoRef.current = NetInfo.addEventListener(async state => {
      if (state.isConnected) await syncPending();
    });

    return () => {
      if (netInfoRef.current) netInfoRef.current();
    };
  }, []);

  const handleSave = async () => {
    if (mode === 'volume' && !volume) {
      Alert.alert('Missing value', 'Enter volume');
      return;
    }
    if (mode === 'price' && (!lowest || !highest)) {
      Alert.alert('Missing value', 'Enter lowest and highest price');
      return;
    }

    setIsSaving(true);

    const timestamp = new Date().toISOString();
    const periodLabel = `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}, Week ${selectedWeek}`;

    if (mode === 'volume') {
      const volNum = parseFloat(volume);

      // Always try Supabase first
      try {
        const { error } = await supabase.from('agri_volume').insert({
          year: selectedYear,
          month: selectedMonth,
          week: selectedWeek,
          commodity: selectedCommodity,
          volume: volNum,
          encoded_by: currentUsername,
          encoded_at: timestamp
        });

        if (error) throw error;

        // Success - saved to Supabase
        const activity: Activity = {
          id: `vol_${Date.now()}`,
          type: 'volume_added',
          commodity: selectedCommodity,
          description: 'Volume data saved',
          details: `${volNum} kg`,
          timestamp,
          user: currentUsername,
          period: periodLabel,
          isPending: false
        };
        setActivities(prev => [activity, ...prev.slice(0, 9)]);
        setSuccessMessage('Volume data saved successfully!');
        setVolume('');
        setShowSuccess(true);
      } catch (err: any) {
        console.warn('Supabase save failed, saving offline', err);

        // Fallback to offline storage
        await addPending({
          type: 'volume',
          year: selectedYear,
          month: selectedMonth,
          week: selectedWeek,
          commodity: selectedCommodity,
          volume: volNum,
          encoded_by: currentUsername,
          encoded_at: timestamp
        });

        const activity: Activity = {
          id: `pending_vol_${Date.now()}`,
          type: 'pending_sync',
          commodity: selectedCommodity,
          description: 'Volume saved (offline)',
          details: `${volNum} kg`,
          timestamp,
          user: currentUsername,
          period: periodLabel,
          isPending: true
        };
        setActivities(prev => [activity, ...prev.slice(0, 9)]);
        setSuccessMessage('Offline: Volume saved locally.\nWill sync when internet returns.');
        setVolume('');
        setShowSuccess(true);
      }
    } else {
      const low = parseFloat(lowest);
      const high = parseFloat(highest);
      const avg = parseFloat(((low + high) / 2).toFixed(2));

      // Always try Supabase first
      try {
        const { error } = await supabase.from('agri_price').insert({
          year: selectedYear,
          month: selectedMonth,
          week: selectedWeek,
          commodity: selectedCommodity,
          lowest_price: low,
          highest_price: high,
          average_price: avg,
          encoded_by: currentUsername,
          encoded_at: timestamp
        });

        if (error) throw error;

        // Success - saved to Supabase
        const activity: Activity = {
          id: `price_${Date.now()}`,
          type: 'price_added',
          commodity: selectedCommodity,
          description: 'Price data saved',
          details: `₱${low} - ₱${high}`,
          timestamp,
          user: currentUsername,
          period: periodLabel,
          isPending: false
        };
        setActivities(prev => [activity, ...prev.slice(0, 9)]);
        setSuccessMessage('Price data saved successfully!');
        setLowest('');
        setHighest('');
        setShowSuccess(true);
      } catch (err: any) {
        console.warn('Supabase save failed, saving offline', err);

        // Fallback to offline storage
        await addPending({
          type: 'price',
          year: selectedYear,
          month: selectedMonth,
          week: selectedWeek,
          commodity: selectedCommodity,
          lowest: low,
          highest: high,
          average: avg,
          encoded_by: currentUsername,
          encoded_at: timestamp
        });

        const activity: Activity = {
          id: `pending_price_${Date.now()}`,
          type: 'pending_sync',
          commodity: selectedCommodity,
          description: 'Price saved (offline)',
          details: `₱${low} - ₱${high}`,
          timestamp,
          user: currentUsername,
          period: periodLabel,
          isPending: true
        };
        setActivities(prev => [activity, ...prev.slice(0, 9)]);
        setSuccessMessage('Offline: Price saved locally.\nWill sync when internet returns.');
        setLowest('');
        setHighest('');
        setShowSuccess(true);
      }
    }

    setIsSaving(false);
  };

  // Function to update profile picture
  const updateProfilePicture = async () => {
    Alert.alert(
      'Update Profile Picture',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: () => takePhoto(),
        },
        {
          text: 'Choose from Library',
          onPress: () => pickImage(),
        },
      ]
    );
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImage(result.assets[0].uri, result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImage(result.assets[0].uri, result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImage = async (imageUrl: string, base64?: string | null) => {
    setIsSaving(true);
    try {
      // 1. First set it locally so the UI updates immediately
      setCollectorImage(imageUrl);
      await AsyncStorage.setItem('collectorImage', imageUrl);

      // 2. Upload to Supabase if we have the base64 data
      if (base64) {
        // Create a unique filename based on the username and a timestamp
        const fileExt = 'jpg';
        const fileName = `${currentUsername}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Upload the base64 image data to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(base64), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get the public URL for the uploaded image
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;

        // 3. Update or Insert into collector_profiles table
        const { error: dbError } = await supabase
          .from('collector_profiles')
          .upsert({
            username: currentUsername,
            avatar_url: publicUrl,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'username' });

        if (dbError) {
          console.error("Error linking avatar to profile:", dbError);
        } else {
          // Cache the real public URL from supabase now
          setCollectorImage(publicUrl);
          await AsyncStorage.setItem('collectorImage', publicUrl);
        }
      }

      // Add profile update activity
      const activity: Activity = {
        id: `profile_${Date.now()}`,
        type: 'profile_updated',
        commodity: 'Profile',
        description: 'Profile picture updated',
        timestamp: new Date().toISOString(),
        user: currentUsername,
        period: 'Profile Settings',
        isPending: false
      };
      setActivities(prev => [activity, ...prev.slice(0, 9)]);

      Alert.alert('Success', 'Profile picture saved!');
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save profile picture completely to cloud, but saved locally.');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditRecord = (record: DataRecord) => {
    setEditingRecord(record);
    setEditCommodity(record.commodity);

    if (record.type === 'volume' || (record.type === 'merged' && record.volume !== undefined)) {
      setEditVolume(record.volume?.toString() || '');
    } else {
      setEditVolume('');
    }

    if (record.type === 'price' || (record.type === 'merged' && record.lowest_price !== undefined)) {
      setEditLowest(record.lowest_price?.toString() || '');
      setEditHighest(record.highest_price?.toString() || '');
    } else {
      setEditLowest('');
      setEditHighest('');
    }
  };

  const handleEditSave = async () => {
    if (!editingRecord) return;

    try {
      const state = await NetInfo.fetch();
      const isOnline = !!state.isConnected;
      const timestamp = new Date().toISOString();
      const periodLabel = `${months.find(m => m.value === editingRecord.month)?.label} ${editingRecord.year}, Week ${editingRecord.week}`;

      if (editVolume && (editingRecord.type === 'volume' || (editingRecord.type === 'merged' && editingRecord.volume !== undefined))) {
        const volNum = parseFloat(editVolume);
        if (isNaN(volNum)) {
          Alert.alert('Error', 'Please enter a valid volume');
          return;
        }

        if (isOnline && !editingRecord.isPending && !editingRecord.id.startsWith('pending_')) {
          const recordId = editingRecord.id.startsWith('volume_')
            ? editingRecord.id.replace('volume_', '')
            : editingRecord.id;
          const { error } = await supabase
            .from('agri_volume')
            .update({
              commodity: editCommodity,
              volume: volNum,
              encoded_at: timestamp
            })
            .eq('year', editingRecord.year)
            .eq('month', editingRecord.month)
            .eq('week', editingRecord.week)
            .eq('commodity', editingRecord.commodity);

          if (error) throw error;
        } else {
          const pendingEntries = await loadPending();
          const updatedEntries = pendingEntries.filter(entry =>
            !(entry.year === editingRecord.year &&
              entry.month === editingRecord.month &&
              entry.week === editingRecord.week &&
              entry.commodity === editingRecord.commodity &&
              entry.type === 'volume')
          );

          const newEntry: PendingEntry = {
            type: 'volume',
            year: editingRecord.year,
            month: editingRecord.month,
            week: editingRecord.week,
            commodity: editCommodity,
            volume: volNum,
            encoded_by: currentUsername,
            encoded_at: timestamp
          };

          updatedEntries.push(newEntry);
          await savePending(updatedEntries);
        }

        // Add edit activity
        const activity: Activity = {
          id: `edit_vol_${Date.now()}`,
          type: 'data_updated',
          commodity: editCommodity,
          description: 'Volume data updated',
          details: `${volNum} kg`,
          timestamp,
          user: currentUsername,
          period: periodLabel,
          isPending: !isOnline
        };
        setActivities(prev => [activity, ...prev.slice(0, 9)]);

        setSuccessMessage('Volume record updated successfully!');
      }

      if (editLowest && editHighest && (editingRecord.type === 'price' || (editingRecord.type === 'merged' && editingRecord.lowest_price !== undefined))) {
        const low = parseFloat(editLowest);
        const high = parseFloat(editHighest);
        const avg = parseFloat(((low + high) / 2).toFixed(2));

        if (isNaN(low) || isNaN(high)) {
          Alert.alert('Error', 'Please enter valid prices');
          return;
        }

        if (isOnline && !editingRecord.isPending && !editingRecord.id.startsWith('pending_')) {
          const recordId = editingRecord.id.startsWith('price_')
            ? editingRecord.id.replace('price_', '')
            : editingRecord.id;
          const { error } = await supabase
            .from('agri_price')
            .update({
              commodity: editCommodity,
              lowest_price: low,
              highest_price: high,
              average_price: avg,
              encoded_at: timestamp
            })
            .eq('year', editingRecord.year)
            .eq('month', editingRecord.month)
            .eq('week', editingRecord.week)
            .eq('commodity', editingRecord.commodity);

          if (error) throw error;
        } else {
          const pendingEntries = await loadPending();
          const updatedEntries = pendingEntries.filter(entry =>
            !(entry.year === editingRecord.year &&
              entry.month === editingRecord.month &&
              entry.week === editingRecord.week &&
              entry.commodity === editingRecord.commodity &&
              entry.type === 'price')
          );

          const newEntry: PendingEntry = {
            type: 'price',
            year: editingRecord.year,
            month: editingRecord.month,
            week: editingRecord.week,
            commodity: editCommodity,
            lowest: low,
            highest: high,
            average: avg,
            encoded_by: currentUsername,
            encoded_at: timestamp
          };

          updatedEntries.push(newEntry);
          await savePending(updatedEntries);
        }

        // Add edit activity
        const activity: Activity = {
          id: `edit_price_${Date.now()}`,
          type: 'data_updated',
          commodity: editCommodity,
          description: 'Price data updated',
          details: `₱${low} - ₱${high}`,
          timestamp,
          user: currentUsername,
          period: periodLabel,
          isPending: !isOnline
        };
        setActivities(prev => [activity, ...prev.slice(0, 9)]);

        setSuccessMessage('Price record updated successfully!');
      }

      setEditingRecord(null);
      setEditVolume('');
      setEditLowest('');
      setEditHighest('');
      setShowSuccess(true);

      loadActivities();
      if (showDataRecords) loadDataRecords();
    } catch (err: any) {
      console.error('Edit failed:', err);
      Alert.alert('Error', 'Failed to update record');
    }
  };

  const deleteRecord = async (record: DataRecord) => {
    let message = `Are you sure you want to delete `;

    if (record.type === 'merged') {
      const hasVolume = record.volume !== undefined;
      const hasPrice = record.lowest_price !== undefined;

      if (hasVolume && hasPrice) {
        message += `complete data record for ${record.commodity}? (Both volume and price data will be deleted)`;
      } else if (hasVolume) {
        message += `volume record for ${record.commodity}?`;
      } else if (hasPrice) {
        message += `price record for ${record.commodity}?`;
      } else {
        message += `record for ${record.commodity}?`;
      }
    } else {
      message += `this ${record.type} record for ${record.commodity}?`;
    }

    Alert.alert(
      'Delete Record',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const state = await NetInfo.fetch();
              const isOnline = !!state.isConnected;

              if (record.volume !== undefined) {
                if (isOnline && !record.isPending && !record.id.startsWith('pending_')) {
                  await supabase.from('agri_volume').delete()
                    .eq('year', record.year)
                    .eq('month', record.month)
                    .eq('week', record.week)
                    .eq('commodity', record.commodity);
                } else {
                  const pendingEntries = await loadPending();
                  const updatedEntries = pendingEntries.filter(entry =>
                    !(entry.year === record.year &&
                      entry.month === record.month &&
                      entry.week === record.week &&
                      entry.commodity === record.commodity &&
                      entry.type === 'volume')
                  );
                  await savePending(updatedEntries);
                }
              }

              if (record.lowest_price !== undefined) {
                if (isOnline && !record.isPending && !record.id.startsWith('pending_')) {
                  await supabase.from('agri_price').delete()
                    .eq('year', record.year)
                    .eq('month', record.month)
                    .eq('week', record.week)
                    .eq('commodity', record.commodity);
                } else {
                  const pendingEntries = await loadPending();
                  const updatedEntries = pendingEntries.filter(entry =>
                    !(entry.year === record.year &&
                      entry.month === record.month &&
                      entry.week === record.week &&
                      entry.commodity === record.commodity &&
                      entry.type === 'price')
                  );
                  await savePending(updatedEntries);
                }
              }

              // Add delete activity
              const periodLabel = `${months.find(m => m.value === record.month)?.label} ${record.year}, Week ${record.week}`;
              const activity: Activity = {
                id: `delete_${Date.now()}`,
                type: 'data_deleted',
                commodity: record.commodity,
                description: `${record.type === 'volume' ? 'Volume' : record.type === 'price' ? 'Price' : 'Complete'} data deleted`,
                timestamp: new Date().toISOString(),
                user: currentUsername,
                period: periodLabel,
                isPending: false
              };
              setActivities(prev => [activity, ...prev.slice(0, 9)]);

              Alert.alert('Success', 'Record deleted successfully');

              loadActivities();
              if (showDataRecords) loadDataRecords();
            } catch (error) {
              console.error('Delete failed:', error);
              Alert.alert('Error', 'Failed to delete record');
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('currentUser');
            await AsyncStorage.removeItem('collectorImage');
            router.replace('/');
          },
        },
      ]
    );
  };

  const monthName = months.find(m => m.value === selectedMonth)?.label || '';
  const weekLabel = weeks.find(w => w.value === selectedWeek)?.label || '';

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'volume_added':
        return { name: 'scale-outline', color: '#3b82f6', bg: '#dbeafe' };
      case 'price_added':
        return { name: 'cash-outline', color: '#f59e0b', bg: '#fef3c7' };
      case 'data_updated':
        return { name: 'create-outline', color: '#10b981', bg: '#d1fae5' };
      case 'pending_sync':
        return { name: 'cloud-upload-outline', color: '#8b5cf6', bg: '#ede9fe' };
      case 'data_deleted':
        return { name: 'trash-outline', color: '#ef4444', bg: '#fee2e2' };
      case 'profile_updated':
        return { name: 'person-outline', color: '#8b5cf6', bg: '#ede9fe' };
      default:
        return { name: 'notifications-outline', color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case 'volume_added': return 'Volume Added';
      case 'price_added': return 'Price Added';
      case 'data_updated': return 'Data Updated';
      case 'pending_sync': return 'Pending Sync';
      case 'data_deleted': return 'Data Deleted';
      case 'profile_updated': return 'Profile Updated';
      default: return 'Activity';
    }
  };

  const renderActivityItem = ({ item }: { item: Activity }) => {
    const icon = getActivityIcon(item.type);
    const timeAgo = getTimeAgo(item.timestamp);

    return (
      <View style={[styles.activityItem, { backgroundColor: themeColors.activityItem, borderColor: themeColors.border }]}>
        <View style={styles.activityIconContainer}>
          <View style={[styles.activityIcon, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name as any} size={18} color={icon.color} />
          </View>
          <View style={styles.activityLine} />
        </View>
        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <View style={styles.activityTypeContainer}>
              <Text style={[styles.activityTypeLabel, { color: isDarkMode ? '#9ca3af' : '#4b5563' }]}>{getActivityTypeLabel(item.type)}</Text>
              {item.isPending && (
                <View style={styles.pendingBadge}>
                  <Ionicons name="cloud-upload-outline" size={10} color="#92400e" />
                  <Text style={styles.pendingText}>Pending</Text>
                </View>
              )}
            </View>
            <Text style={styles.activityTime}>{timeAgo}</Text>
          </View>
          <Text style={[styles.activityCommodity, { color: themeColors.text }]}>{item.commodity}</Text>
          <Text style={[styles.activityDescription, { color: themeColors.text }]}>{item.description}</Text>
          {item.details && (
            <Text style={styles.activityDetails}>{item.details}</Text>
          )}
          <View style={styles.activityFooter}>
            <View style={styles.userInfo}>
              <Ionicons name="person-outline" size={12} color="#9ca3af" />
              <Text style={styles.userName}>{item.user}</Text>
            </View>
            <View style={styles.periodInfo}>
              <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
              <Text style={styles.periodText}>{item.period}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  };

  const renderDataRecord = ({ item }: { item: DataRecord }) => (
    <View style={[styles.recordItem, { backgroundColor: themeColors.activityItem, borderColor: themeColors.border }]}>
      <View style={styles.recordHeader}>
        <View style={styles.recordTypeBadge}>
          {item.type === 'merged' ? (
            <View style={styles.mergedTypeBadge}>
              <Text style={styles.mergedTypeText}>📊 COMPLETE DATA</Text>
              <View style={styles.dataTypeIndicators}>
                {item.volume !== undefined && (
                  <View style={styles.dataTypeIndicator}>
                    <Ionicons name="scale" size={10} color="#1e40af" />
                  </View>
                )}
                {item.lowest_price !== undefined && (
                  <View style={styles.dataTypeIndicator}>
                    <Ionicons name="cash" size={10} color="#92400e" />
                  </View>
                )}
              </View>
            </View>
          ) : (
            <Text style={[
              styles.recordTypeText,
              item.type === 'volume' ? styles.volumeBadge : styles.priceBadge
            ]}>
              {item.type === 'volume' ? '📦 VOLUME' : '💰 PRICE'}
            </Text>
          )}
          {item.isPending && (
            <View style={styles.pendingBadge}>
              <Ionicons name="cloud-upload-outline" size={10} color="#92400e" />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
        </View>
        <Text style={[styles.recordCommodity, { color: themeColors.text }]}>{item.commodity}</Text>
      </View>

      <View style={styles.recordDetails}>
        <View style={styles.recordWeekRow}>
          <Ionicons name="calendar-outline" size={14} color="#6b7280" />
          <Text style={styles.recordWeek}>Week {item.week}</Text>
        </View>

        {item.volume !== undefined && (
          <View style={styles.recordValueRow}>
            <Ionicons name="scale" size={16} color="#3b82f6" />
            <Text style={[styles.recordValue, { color: themeColors.text }]}>Volume: {item.volume} kg</Text>
          </View>
        )}

        {item.lowest_price !== undefined && item.highest_price !== undefined && (
          <>
            <View style={styles.recordValueRow}>
              <Ionicons name="arrow-down" size={16} color="#ef4444" />
              <Text style={styles.recordValue}>Lowest: ₱{item.lowest_price}</Text>
            </View>
            <View style={styles.recordValueRow}>
              <Ionicons name="arrow-up" size={16} color="#10b981" />
              <Text style={styles.recordValue}>Highest: ₱{item.highest_price}</Text>
            </View>
            {item.average_price !== undefined && (
              <View style={styles.recordValueRow}>
                <Ionicons name="trending-up" size={16} color="#f59e0b" />
                <Text style={styles.recordValue}>Average: ₱{item.average_price}</Text>
              </View>
            )}
          </>
        )}

        {item.volume === undefined && item.lowest_price === undefined && (
          <Text style={styles.noDataText}>No data available</Text>
        )}

        <View style={styles.recordMetaRow}>
          <Ionicons name="person-outline" size={12} color="#9ca3af" />
          <Text style={styles.recordMeta}>
            Encoded by {item.encoded_by} on {new Date(item.encoded_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.recordActions}>
        <TouchableOpacity
          style={styles.editRecordButton}
          onPress={() => startEditRecord(item)}
        >
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={styles.editRecordButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteRecordButton}
          onPress={() => deleteRecord(item)}
        >
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={styles.deleteRecordButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const CollectorProfile = () => (
    <TouchableOpacity
      style={styles.collectorProfile}
      onPress={updateProfilePicture}
      activeOpacity={0.8}
    >
      <View style={styles.profileImageContainer}>
        {collectorImage ? (
          <Image source={{ uri: collectorImage }} style={styles.profileImage} />
        ) : (
          <View style={styles.profileIcon}>
            <Ionicons name="person" size={24} color="#2d6a4f" />
          </View>
        )}
        <View style={styles.profileEditBadge}>
          <Ionicons name="camera-outline" size={12} color="#fff" />
        </View>
      </View>
      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>{currentUsername}</Text>
        <Text style={styles.profileRole}>Data Collector</Text>
        <Text style={styles.profileStatus}>
          <Ionicons name="radio-button-on" size={8} color="#10b981" /> Active
        </Text>
      </View>
    </TouchableOpacity>
  );

  const ActivitiesSection = () => (
    <View style={[styles.activitiesCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={styles.activitiesHeader}>
        <View style={styles.activitiesTitleRow}>
          <Ionicons name="time-outline" size={24} color="#2d6a4f" />
          <View style={styles.activitiesTitleContainer}>
            <Text style={styles.activitiesTitle}>Recent Activities</Text>
            <Text style={styles.activitiesSubtitle}>
              {monthName} {selectedYear}, {weekLabel}
            </Text>
          </View>
        </View>
        <View style={styles.activitiesActions}>
          <TouchableOpacity
            style={[styles.refreshButtonSmall, isSmallScreen && styles.iconOnlyButton]}
            onPress={loadActivities}
          >
            <Ionicons name="refresh-outline" size={16} color="#3b82f6" />
            {!isSmallScreen && (
              <Text style={styles.refreshButtonSmallText}>Refresh</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewAllButton, isSmallScreen && styles.iconOnlyButton]}
            onPress={() => setShowDataRecords(true)}
          >
            {!isSmallScreen && (
              <Text style={styles.viewAllButtonText}>View All</Text>
            )}
            <Ionicons name="chevron-forward" size={14} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoadingActivities ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="refresh-outline" size={40} color="#6b7280" style={styles.spinningIcon} />
          <Text style={styles.loadingText}>Loading activities...</Text>
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.emptyActivities}>
          <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyActivitiesTitle}>No Activities</Text>
          <Text style={styles.emptyActivitiesMessage}>
            No activities recorded for this period. Start by adding data.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.activitiesSummary}>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="scale-outline" size={16} color="#3b82f6" />
          </View>
          <Text style={styles.summaryCount}>
            {activities.filter(a => a.type === 'volume_added').length}
          </Text>
          <Text style={styles.summaryLabel}>Volume</Text>
        </View>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="cash-outline" size={16} color="#f59e0b" />
          </View>
          <Text style={styles.summaryCount}>
            {activities.filter(a => a.type === 'price_added').length}
          </Text>
          <Text style={styles.summaryLabel}>Price</Text>
        </View>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: '#ede9fe' }]}>
            <Ionicons name="cloud-upload-outline" size={16} color="#8b5cf6" />
          </View>
          <Text style={styles.summaryCount}>
            {activities.filter(a => a.isPending).length}
          </Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: '#d1fae5' }]}>
            <Ionicons name="checkmark-done-outline" size={16} color="#10b981" />
          </View>
          <Text style={styles.summaryCount}>{activities.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { backgroundColor: themeColors.header }]}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setSidebarOpen(!sidebarOpen)}
        >
          <Ionicons name="menu-outline" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>AgriData Collector</Text>
          <Text style={styles.headerSubtitle}>Agricultural Data Collection System</Text>
        </View>

        <CollectorProfile />
      </View>

      {!showDataRecords ? (
        <ScrollView style={[styles.content, { backgroundColor: themeColors.background }]} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={[styles.card, { backgroundColor: themeColors.card }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.modeIcon, mode === 'volume' ? styles.volumeMode : styles.priceMode]}>
                  <Ionicons
                    name={mode === 'volume' ? "scale-outline" : "cash-outline"}
                    size={24}
                    color={mode === 'volume' ? "#1e40af" : "#92400e"}
                  />
                </View>
                <View>
                  <Text style={[styles.cardTitle, { color: themeColors.text }]}>
                    {mode === 'volume' ? 'Volume Data Entry' : 'Price Data Entry'}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: themeColors.subtext }]}>Enter weekly agricultural data</Text>
                </View>
              </View>
              <View style={styles.modeSwitch}>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'volume' && styles.activeModeButton]}
                  onPress={() => setMode('volume')}
                >
                  <Ionicons
                    name="scale"
                    size={16}
                    color={mode === 'volume' ? '#fff' : '#6b7280'}
                  />
                  <Text style={[styles.modeButtonText, mode === 'volume' && styles.activeModeButtonText]}>
                    Volume
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'price' && styles.activeModeButton]}
                  onPress={() => setMode('price')}
                >
                  <Ionicons
                    name="cash"
                    size={16}
                    color={mode === 'price' ? '#fff' : '#6b7280'}
                  />
                  <Text style={[styles.modeButtonText, mode === 'price' && styles.activeModeButtonText]}>
                    Price
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.periodSummary}>
              <View style={styles.periodHeader}>
                <Ionicons name="calendar" size={18} color="#1e40af" />
                <Text style={styles.periodLabel}>Selected Period</Text>
              </View>
              <Text style={styles.periodTextSummary}>
                {monthName} {selectedYear}, {weekLabel}
              </Text>
            </View>

            {/* Year, Month, Week Picker Row */}
            <View style={styles.dateRow}>
              <View style={styles.dateGroup}>
                <Text style={styles.label}>Year</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={selectedYear}
                    onValueChange={(v) => setSelectedYear(v)}
                    style={styles.picker}
                  >
                    {years.map((y) => <Picker.Item key={y} label={String(y)} value={y} />)}
                  </Picker>
                </View>
              </View>

              <View style={styles.dateGroup}>
                <Text style={styles.label}>Month</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={selectedMonth}
                    onValueChange={(v) => setSelectedMonth(v)}
                    style={styles.picker}
                  >
                    {months.map((m) => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                  </Picker>
                </View>
              </View>

              <View style={styles.dateGroup}>
                <Text style={styles.label}>Week</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={selectedWeek}
                    onValueChange={(v) => setSelectedWeek(v)}
                    style={styles.picker}
                  >
                    {weeks.map((w) => <Picker.Item key={w.value} label={w.label} value={w.value} />)}
                  </Picker>
                </View>
              </View>
            </View>

            {/* Commodity Search and Selection */}
            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.label, { color: themeColors.text }]}>Commodity</Text>
                <TouchableOpacity
                  style={styles.addCommodityBtn}
                  onPress={() => setShowAddCommodity(true)}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text style={styles.addCommodityBtnText}>Add New</Text>
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color="#9ca3af" style={styles.searchIcon} />
                   <TextInput
                    style={[styles.searchInput, { color: themeColors.text }]}
                    placeholder="Search commodity..."
                    value={commoditySearch}
                    onChangeText={setCommoditySearch}
                    placeholderTextColor={isDarkMode ? "#777" : "#9ca3af"}
                  />
                {commoditySearch.length > 0 && (
                   <TouchableOpacity onPress={() => setCommoditySearch('')}>
                    <Ionicons name="close-circle" size={20} color={isDarkMode ? "#666" : "#9ca3af"} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Commodity Picker with Category Labels */}
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={selectedCommodity}
                  onValueChange={(v) => {
                    if (v && !v.startsWith('__category__')) setSelectedCommodity(v);
                  }}
                  style={styles.picker}
                >
                  {commoditySearch.trim() === '' ? (
                    // Show categorized list
                    commodityCategories.map((cat) => [
                      <Picker.Item
                        key={`cat_${cat.label}`}
                        label={`━━ ${cat.label} ━━`}
                        value={`__category__${cat.label}`}
                        enabled={false}
                        color="#2d6a4f"
                      />,
                      ...cat.items.map((c) => (
                        <Picker.Item key={c} label={`   ${c}`} value={c} />
                      )),
                    ]).flat()
                  ) : (
                    // Show filtered results
                    filteredCommodities.map((c) => (
                      <Picker.Item key={c} label={c} value={c} />
                    ))
                  )}
                  {/* Custom commodities section */}
                  {allCommodities.length > defaultCommodities.length && commoditySearch.trim() === '' && (
                    <Picker.Item
                      key="cat_custom"
                      label="━━ ✏️ Custom Added ━━"
                      value="__category__custom"
                      enabled={false}
                      color="#2d6a4f"
                    />
                  )}
                  {commoditySearch.trim() === '' && allCommodities
                    .filter(c => !defaultCommodities.includes(c))
                    .map((c) => (
                      <Picker.Item key={c} label={`   ${c}`} value={c} />
                    ))
                  }
                </Picker>
              </View>

              {selectedCommodity && !selectedCommodity.startsWith('__category__') && (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: -5, marginBottom: 15 }}>
                  {!defaultCommodities.includes(selectedCommodity) && (
                    <TouchableOpacity 
                      style={{ marginRight: 15 }}
                      onPress={() => {
                        Alert.alert('Delete', `Delete custom commodity "${selectedCommodity}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              const { error } = await supabase.from('custom_commodities').delete().eq('name', selectedCommodity);
                              const raw = await AsyncStorage.getItem(CUSTOM_COMMODITIES_KEY);
                              let list = raw ? JSON.parse(raw) : [];
                              list = list.filter((c: string) => c !== selectedCommodity);
                              await AsyncStorage.setItem(CUSTOM_COMMODITIES_KEY, JSON.stringify(list));
                              setAllCommodities([...defaultCommodities, ...list]);
                              setSelectedCommodity(defaultCommodities[0]);
                            }
                          }
                        ]);
                      }}
                    >
                      <Text style={{ color: '#ef4444', fontSize: 14 }}>Delete</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => {
                    setEditingCustomCommodity(selectedCommodity);
                    const nameMatch = selectedCommodity.match(/^(.*) \((.*)\)$/);
                    if (nameMatch) {
                      setEditCustomCommodityName(nameMatch[1]);
                      setEditCustomCommodityUnit(nameMatch[2]);
                    } else {
                      setEditCustomCommodityName(selectedCommodity);
                      setEditCustomCommodityUnit('Per Kg.');
                    }
                  }}>
                    <Text style={{ color: '#3b82f6', fontSize: 14 }}>
                      {defaultCommodities.includes(selectedCommodity) ? 'Override Default' : 'Edit Selected'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Search Results Count */}
              <Text style={styles.searchResults}>
                Showing {filteredCommodities.length} of {allCommodities.length} commodities
              </Text>
            </View>

            {mode === 'volume' ? (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Volume (Kilograms)</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="scale" size={20} color="#3b82f6" style={styles.inputIcon} />
                   <TextInput
                    ref={volumeInputRef}
                    style={[styles.input, { color: themeColors.text }]}
                    placeholder="Enter volume in kg"
                    keyboardType="numeric"
                    value={volume}
                    onChangeText={setVolume}
                    placeholderTextColor={isDarkMode ? "#777" : "#9ca3af"}
                  />
                  {volume.length > 0 && (
                    <Text style={styles.inputUnit}>kg</Text>
                  )}
                </View>
              </View>
            ) : (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Lowest Price (₱)</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="arrow-down" size={20} color="#ef4444" style={styles.inputIcon} />
                    <TextInput
                      ref={lowestInputRef}
                      style={styles.input}
                      placeholder="Enter lowest price"
                      keyboardType="numeric"
                      value={lowest}
                      onChangeText={setLowest}
                      placeholderTextColor="#9ca3af"
                    />
                    {lowest.length > 0 && (
                      <Text style={styles.inputUnit}>₱</Text>
                    )}
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Highest Price (₱)</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="arrow-up" size={20} color="#10b981" style={styles.inputIcon} />
                    <TextInput
                      ref={highestInputRef}
                      style={styles.input}
                      placeholder="Enter highest price"
                      keyboardType="numeric"
                      value={highest}
                      onChangeText={setHighest}
                      placeholderTextColor="#9ca3af"
                    />
                    {highest.length > 0 && (
                      <Text style={styles.inputUnit}>₱</Text>
                    )}
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Average Price (₱)</Text>
                  <View style={styles.averageBox}>
                    <Ionicons name="calculator-outline" size={20} color="#166534" />
                    <Text style={styles.averageText}>{average || '—'}</Text>
                    {average !== '—' && <Text style={styles.averageUnit}>₱</Text>}
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.saveButton, mode === 'volume' ? styles.volumeSaveButton : styles.priceSaveButton]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <View style={styles.saveButtonLoading}>
                  <Ionicons name="refresh-outline" size={20} color="#fff" style={styles.spinningIcon} />
                  <Text style={styles.saveButtonText}>Saving...</Text>
                </View>
              ) : (
                <>
                  <Ionicons
                    name={mode === 'volume' ? "save-outline" : "cash-outline"}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.saveButtonText}>
                    Save {mode === 'volume' ? 'Volume' : 'Price'} Data
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <ActivitiesSection />
        </ScrollView>
      ) : (
        <ScrollView style={[styles.content, { backgroundColor: themeColors.background }]} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.recordsHeader}>
            <View style={styles.recordsTitleRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowDataRecords(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#2d6a4f" />
                <Text style={styles.backButtonText}>Back to Entry</Text>
              </TouchableOpacity>
              <View>
                <Text style={styles.recordsTitle}>📋 All Data Records</Text>
                <Text style={styles.recordsSubtitle}>View, monitor and edit your agricultural data</Text>
              </View>
            </View>
          </View>

          <View style={[styles.filterCard, { backgroundColor: themeColors.card }]}>
            <Text style={styles.filterTitle}>Filter Records</Text>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by commodity, price, or encoder..."
                value={recordsSearch}
                onChangeText={setRecordsSearch}
                placeholderTextColor="#9ca3af"
              />
              {recordsSearch.length > 0 && (
                <TouchableOpacity onPress={() => setRecordsSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filterRow}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Year</Text>
                <View style={styles.filterPickerWrap}>
                  <Picker
                    selectedValue={filterYear}
                    onValueChange={setFilterYear}
                    style={styles.filterPicker}
                  >
                    {years.map((y) => <Picker.Item key={y} label={String(y)} value={y} />)}
                  </Picker>
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Month</Text>
                <View style={styles.filterPickerWrap}>
                  <Picker
                    selectedValue={filterMonth}
                    onValueChange={setFilterMonth}
                    style={styles.filterPicker}
                  >
                    {months.map((m) => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                  </Picker>
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Week</Text>
                <View style={styles.filterPickerWrap}>
                  <Picker
                    selectedValue={filterWeek}
                    onValueChange={(value) => setFilterWeek(value)}
                    style={styles.filterPicker}
                  >
                    <Picker.Item label="All Weeks" value="all" />
                    {weeks.map((w) => <Picker.Item key={w.value} label={w.label} value={w.value} />)}
                  </Picker>
                </View>
              </View>
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Data Type</Text>
              <View style={styles.typeFilterButtons}>
                <TouchableOpacity
                  style={[
                    styles.typeFilterButton,
                    recordTypeFilter === 'all' && styles.typeFilterButtonActive
                  ]}
                  onPress={() => setRecordTypeFilter('all')}
                >
                  <Ionicons
                    name="list-outline"
                    size={16}
                    color={recordTypeFilter === 'all' ? '#fff' : '#6b7280'}
                  />
                  <Text style={[
                    styles.typeFilterButtonText,
                    recordTypeFilter === 'all' && styles.typeFilterButtonTextActive
                  ]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeFilterButton,
                    recordTypeFilter === 'volume' && styles.typeFilterButtonActive
                  ]}
                  onPress={() => setRecordTypeFilter('volume')}
                >
                  <Ionicons
                    name="scale"
                    size={16}
                    color={recordTypeFilter === 'volume' ? '#fff' : '#6b7280'}
                  />
                  <Text style={[
                    styles.typeFilterButtonText,
                    recordTypeFilter === 'volume' && styles.typeFilterButtonTextActive
                  ]}>Volume</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeFilterButton,
                    recordTypeFilter === 'price' && styles.typeFilterButtonActive
                  ]}
                  onPress={() => setRecordTypeFilter('price')}
                >
                  <Ionicons
                    name="cash"
                    size={16}
                    color={recordTypeFilter === 'price' ? '#fff' : '#6b7280'}
                  />
                  <Text style={[
                    styles.typeFilterButtonText,
                    recordTypeFilter === 'price' && styles.typeFilterButtonTextActive
                  ]}>Price</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={loadDataRecords}
            >
              <Ionicons name="refresh-outline" size={20} color="#fff" />
              <Text style={styles.refreshButtonText}>Refresh Data</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.recordsListCard, { backgroundColor: themeColors.card }]}>
            <View style={styles.recordsListHeader}>
              <View>
                <Text style={styles.recordsListTitle}>
                  {dataRecords.length} Record{dataRecords.length !== 1 ? 's' : ''} Found
                </Text>
                <Text style={styles.recordsListSubtitle}>
                  {months.find(m => m.value === filterMonth)?.label} {filterYear}
                  {filterWeek !== 'all' && `, Week ${filterWeek}`}
                  {recordsSearch && `, Search: "${recordsSearch}"`}
                </Text>
              </View>
              <View style={styles.recordsStats}>
                <View style={styles.statItem}>
                  <Ionicons name="scale" size={16} color="#3b82f6" />
                  <Text style={styles.statText}>
                    {dataRecords.filter(r => r.volume !== undefined).length} Volume
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="cash" size={16} color="#10b981" />
                  <Text style={styles.statText}>
                    {dataRecords.filter(r => r.lowest_price !== undefined).length} Price
                  </Text>
                </View>
              </View>
            </View>

            {isLoadingRecords ? (
              <View style={styles.loadingContainer}>
                <Ionicons name="refresh-outline" size={40} color="#6b7280" style={styles.spinningIcon} />
                <Text style={styles.loadingText}>Loading records...</Text>
              </View>
            ) : dataRecords.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={60} color="#d1d5db" />
                <Text style={styles.emptyTitle}>No Records Found</Text>
                <Text style={styles.emptyMessage}>
                  No data found for the selected filters. Try changing your filter criteria.
                </Text>
              </View>
            ) : (
              <FlatList
                data={dataRecords}
                renderItem={renderDataRecord}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>
      )}

      {sidebarOpen && (
        <>
          <TouchableOpacity
            style={[styles.overlay, { backgroundColor: themeColors.overlay }]}
            onPress={() => setSidebarOpen(false)}
            activeOpacity={1}
          />
          <View style={[styles.sidebar, { backgroundColor: themeColors.sidebar }]}>
            <View style={styles.sidebarHeader}>
              <View style={styles.sidebarProfileSection}>
                <TouchableOpacity
                  style={styles.sidebarProfileImage}
                  onPress={() => setShowProfileViewer(true)}
                  activeOpacity={0.8}
                >
                  {collectorImage ? (
                    <Image source={{ uri: collectorImage }} style={styles.sidebarProfileImg} />
                  ) : (
                    <View style={styles.sidebarProfileIcon}>
                      <Ionicons name="person" size={40} color="#fff" />
                    </View>
                  )}
                  <View style={styles.sidebarProfileEditBadge}>
                    <Ionicons name="expand-outline" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
                <View style={styles.sidebarProfileInfo}>
                  <Text style={styles.sidebarProfileName}>{currentUsername}</Text>
                  <Text style={styles.sidebarProfileRole}>Agricultural Data Collector</Text>
                  <View style={styles.sidebarProfileStatus}>
                    <View style={styles.statusDot} />
                    <Text style={styles.sidebarProfileStatusText}>Online</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSidebarOpen(false)}
              >
                <Ionicons name="close-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sidebarMenu} showsVerticalScrollIndicator={false}>
              <View style={styles.sidebarSection}>
                <Text style={styles.sidebarSectionTitle}>Appearance</Text>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={toggleTheme}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons 
                      name={isDarkMode ? "moon" : "sunny-outline"} 
                      size={20} 
                      color={isDarkMode ? "#fbbf24" : "#6b7280"} 
                    />
                  </View>
                  <Text style={styles.menuText}>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={[styles.themeToggle, isDarkMode ? styles.themeToggleActive : styles.themeToggleInactive]}>
                    <View style={[styles.themeToggleCircle, isDarkMode ? styles.themeToggleCircleActive : styles.themeToggleCircleInactive]} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.sidebarSection}>
                <Text style={styles.sidebarSectionTitle}>Data Entry</Text>
                <TouchableOpacity
                  style={[styles.menuItem, mode === 'volume' && (isDarkMode ? { backgroundColor: '#333' } : styles.activeMenuItem)]}
                  onPress={() => {
                    setMode('volume');
                    setSidebarOpen(false);
                  }}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: isDarkMode ? '#222' : '#f3f4f6' }]}>
                    <Ionicons name="scale-outline" size={20} color={mode === 'volume' ? (isDarkMode ? '#4ade80' : '#2d6a4f') : (isDarkMode ? '#9ca3af' : '#6b7280')} />
                  </View>
                  <Text style={[styles.menuText, { color: isDarkMode ? '#e5e7eb' : '#4b5563' }, mode === 'volume' && (isDarkMode ? { color: '#4ade80', fontWeight: '600' } : styles.activeMenuText)]}>
                    Volume Entry
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, mode === 'price' && (isDarkMode ? { backgroundColor: '#333' } : styles.activeMenuItem)]}
                  onPress={() => {
                    setMode('price');
                    setSidebarOpen(false);
                  }}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: isDarkMode ? '#222' : '#f3f4f6' }]}>
                    <Ionicons name="cash-outline" size={20} color={mode === 'price' ? (isDarkMode ? '#4ade80' : '#2d6a4f') : (isDarkMode ? '#9ca3af' : '#6b7280')} />
                  </View>
                  <Text style={[styles.menuText, { color: isDarkMode ? '#e5e7eb' : '#4b5563' }, mode === 'price' && (isDarkMode ? { color: '#4ade80', fontWeight: '600' } : styles.activeMenuText)]}>
                    Price Entry
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, showDataRecords && (isDarkMode ? { backgroundColor: '#333' } : styles.activeMenuItem)]}
                  onPress={() => {
                    setShowDataRecords(true);
                    setSidebarOpen(false);
                  }}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: isDarkMode ? '#222' : '#f3f4f6' }]}>
                    <Ionicons name="document-text-outline" size={20} color={showDataRecords ? (isDarkMode ? '#4ade80' : '#2d6a4f') : (isDarkMode ? '#9ca3af' : '#6b7280')} />
                  </View>
                  <Text style={[styles.menuText, { color: isDarkMode ? '#e5e7eb' : '#4b5563' }, showDataRecords && (isDarkMode ? { color: '#4ade80', fontWeight: '600' } : styles.activeMenuText)]}>
                    Data Records
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sidebarSection}>
                <Text style={styles.sidebarSectionTitle}>Tools</Text>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    loadActivities();
                    setSidebarOpen(false);
                  }}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="refresh-outline" size={20} color="#6b7280" />
                  </View>
                  <Text style={styles.menuText}>Refresh Activities</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={syncPending}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="cloud-upload-outline" size={20} color="#6b7280" />
                  </View>
                  <Text style={styles.menuText}>Sync Pending Data</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sidebarSection}>
                <Text style={styles.sidebarSectionTitle}>Account</Text>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    Alert.alert('Coming Soon', 'Profile settings will be available soon!');
                    setSidebarOpen(false);
                  }}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="settings-outline" size={20} color="#6b7280" />
                  </View>
                  <Text style={styles.menuText}>Settings</Text>
                </TouchableOpacity>


                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    Alert.alert('Help', 'Contact support at support@agridata.gov');
                    setSidebarOpen(false);
                  }}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="help-circle-outline" size={20} color="#6b7280" />
                  </View>
                  <Text style={styles.menuText}>Support</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleLogout}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                  </View>
                  <Text style={[styles.menuText, styles.logoutText]}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={[styles.sidebarFooter, { borderTopColor: themeColors.border }]}>
              <Text style={[styles.footerText, { color: themeColors.subtext }]}>AgriData System v2.0</Text>
              <Text style={[styles.footerSubtext, { color: isDarkMode ? '#555' : '#9ca3af' }]}>© 2024 Agricultural Department</Text>
            </View>
          </View>
        </>
      )}

      {/* Edit Record Modal */}
      <Modal
        visible={!!editingRecord}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit {editingRecord?.type === 'volume' ? 'Volume' : editingRecord?.type === 'price' ? 'Price' : 'Complete'} Record
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditingRecord(null)}
              >
                <Ionicons name="close-outline" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Week {editingRecord?.week}, {months.find(m => m.value === editingRecord?.month)?.label} {editingRecord?.year}
            </Text>

            {/* Commodity Picker in Edit Modal */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Commodity</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={editCommodity}
                  onValueChange={(v) => {
                    if (v && !v.startsWith('__category__')) setEditCommodity(v);
                  }}
                  style={styles.picker}
                >
                  {commodityCategories.map((cat) => [
                    <Picker.Item
                      key={`edit_cat_${cat.label}`}
                      label={`━━ ${cat.label} ━━`}
                      value={`__category__${cat.label}`}
                      enabled={false}
                      color="#2d6a4f"
                    />,
                    ...cat.items.map((c) => (
                      <Picker.Item key={`edit_${c}`} label={`   ${c}`} value={c} />
                    )),
                  ]).flat()}
                  {allCommodities.length > defaultCommodities.length && (
                    <Picker.Item
                      key="edit_cat_custom"
                      label="━━ ✏️ Custom Added ━━"
                      value="__category__custom"
                      enabled={false}
                      color="#2d6a4f"
                    />
                  )}
                  {allCommodities
                    .filter(c => !defaultCommodities.includes(c) && !hiddenCommodities.includes(c))
                    .map((c) => (
                      <Picker.Item key={`edit_${c}`} label={`   ${c}`} value={c} />
                    ))
                  }
                </Picker>
              </View>
            </View>

            {/* Show volume form if record has volume data */}
            {(editingRecord?.type === 'volume' || (editingRecord?.type === 'merged' && editingRecord?.volume !== undefined)) && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Volume (Kg)</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="scale" size={20} color="#3b82f6" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter volume"
                    keyboardType="numeric"
                    value={editVolume}
                    onChangeText={setEditVolume}
                    placeholderTextColor="#9ca3af"
                  />
                  {editVolume.length > 0 && (
                    <Text style={styles.inputUnit}>kg</Text>
                  )}
                </View>
              </View>
            )}

            {/* Show price form if record has price data */}
            {(editingRecord?.type === 'price' || (editingRecord?.type === 'merged' && editingRecord?.lowest_price !== undefined)) && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Lowest Price (₱)</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="arrow-down" size={20} color="#ef4444" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter lowest price"
                      keyboardType="numeric"
                      value={editLowest}
                      onChangeText={setEditLowest}
                      placeholderTextColor="#9ca3af"
                    />
                    {editLowest.length > 0 && (
                      <Text style={styles.inputUnit}>₱</Text>
                    )}
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Highest Price (₱)</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="arrow-up" size={20} color="#10b981" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter highest price"
                      keyboardType="numeric"
                      value={editHighest}
                      onChangeText={setEditHighest}
                      placeholderTextColor="#9ca3af"
                    />
                    {editHighest.length > 0 && (
                      <Text style={styles.inputUnit}>₱</Text>
                    )}
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Average Price (₱)</Text>
                  <View style={styles.averageBox}>
                    <Ionicons name="calculator-outline" size={20} color="#166534" />
                    <Text style={styles.averageText}>
                      {editLowest && editHighest
                        ? ((parseFloat(editLowest) + parseFloat(editHighest)) / 2).toFixed(2)
                        : '—'}
                    </Text>
                    {editLowest && editHighest && <Text style={styles.averageUnit}>₱</Text>}
                  </View>
                </View>
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditingRecord(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={handleEditSave}
              >
                <Text style={styles.modalSaveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {isSaving && (
        <View style={[styles.loadingOverlay, { backgroundColor: themeColors.overlay }]}>
          <View style={[styles.loadingCard, { backgroundColor: themeColors.card }]}>
            <Ionicons name="refresh-outline" size={40} color="#2d6a4f" style={styles.spinningIcon} />
            <Text style={styles.loadingText}>Saving data...</Text>
          </View>
        </View>
      )}

      {showSuccess && (
        <View style={[styles.loadingOverlay, { backgroundColor: themeColors.overlay }]}>
          <View style={[styles.successCard, { backgroundColor: themeColors.card }]}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={60} color="#10b981" />
            </View>
            <Text style={[styles.successTitle, { color: themeColors.text }]}>Success!</Text>
            <Text style={[styles.successMessage, { color: themeColors.text }]}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setShowSuccess(false)}
            >
              <Text style={styles.successButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Add Commodity Modal */}
      <Modal
        visible={showAddCommodity}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCommodity(false)}
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.addCommodityModal}>
            <View style={styles.addCommodityHeader}>
              <Ionicons name="leaf-outline" size={28} color="#2d6a4f" />
              <Text style={styles.addCommodityTitle}>Add New Commodity</Text>
              <Text style={styles.addCommoditySubtitle}>Enter the commodity name and select a unit</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Commodity Name</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="pricetag-outline" size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Corn, Mongo, etc."
                  value={newCommodityName}
                  onChangeText={setNewCommodityName}
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Unit of Measurement</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={newCommodityUnit}
                  onValueChange={(v) => setNewCommodityUnit(v)}
                  style={styles.picker}
                >
                  <Picker.Item label="Per Kg." value="Per Kg." />
                  <Picker.Item label="Per Bundle" value="Per Bundle" />
                  <Picker.Item label="Per Piece" value="Per Piece" />
                  <Picker.Item label="Per Sack" value="Per Sack" />
                  <Picker.Item label="Per Bugkos" value="Per Bugkos" />
                  <Picker.Item label="Per Crate" value="Per Crate" />
                  <Picker.Item label="Per Can" value="Per Can" />
                  <Picker.Item label="Per Box" value="Per Box" />
                </Picker>
              </View>
            </View>

            {newCommodityName.trim() !== '' && (
              <View style={styles.previewBox}>
                <Ionicons name="eye-outline" size={16} color="#1e40af" />
                <Text style={styles.previewText}>
                  Preview: {newCommodityName.trim()} ({newCommodityUnit})
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddCommodity(false);
                  setNewCommodityName('');
                  setNewCommodityUnit('Per Kg.');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={async () => {
                  const name = newCommodityName.trim();
                  if (!name) {
                    Alert.alert('Missing Name', 'Please enter a commodity name');
                    return;
                  }
                  const fullName = `${name} (${newCommodityUnit})`;
                  if (allCommodities.includes(fullName)) {
                    Alert.alert('Duplicate', 'This commodity already exists in the list');
                    return;
                  }
                  try {
                    setIsSaving(true);

                    // Save to Supabase first if online
                    const state = await NetInfo.fetch();
                    if (state.isConnected) {
                      const { error } = await supabase
                        .from('custom_commodities')
                        .insert([{ name: fullName }]);

                      if (error) {
                        console.error('Failed to save to Supabase', error);
                        Alert.alert('Cloud Sync Error', `Failed to save to cloud: ${error.message || JSON.stringify(error)}`);
                        // We still continue to save locally even if Supabase fails
                      }
                    }

                    // Save to AsyncStorage
                    const raw = await AsyncStorage.getItem(CUSTOM_COMMODITIES_KEY);
                    const customList: string[] = raw ? JSON.parse(raw) : [];
                    if (!customList.includes(fullName)) {
                      customList.push(fullName);
                      await AsyncStorage.setItem(CUSTOM_COMMODITIES_KEY, JSON.stringify(customList));
                    }

                    const merged = [...defaultCommodities, ...customList];
                    setAllCommodities(merged);
                    setSelectedCommodity(fullName);
                    setNewCommodityName('');
                    setNewCommodityUnit('Per Kg.');
                    setShowAddCommodity(false);
                    Alert.alert('Success', `"${fullName}" has been added to the list!\n\nYou can now use it to save volume or price data.`);
                  } catch (e) {
                    console.error('Failed to add commodity', e);
                    Alert.alert('Error', 'Failed to save new commodity');
                  } finally {
                    setIsSaving(false);
                  }
                }}
              >
                <Text style={styles.modalSaveButtonText}>Add Commodity</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Custom Commodity Modal */}
      <Modal
        visible={!!editingCustomCommodity}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCustomCommodity(null)}
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.addCommodityModal}>
            <View style={styles.addCommodityHeader}>
              <Ionicons name="create-outline" size={28} color="#3b82f6" />
              <Text style={styles.addCommodityTitle}>Edit Custom Commodity</Text>
              <Text style={styles.addCommoditySubtitle}>Update name or unit of measurement</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Commodity Name</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="pricetag-outline" size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Corn, Mongo, etc."
                  value={editCustomCommodityName}
                  onChangeText={setEditCustomCommodityName}
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Unit of Measurement</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={editCustomCommodityUnit}
                  onValueChange={(v) => setEditCustomCommodityUnit(v)}
                  style={styles.picker}
                >
                  <Picker.Item label="Per Kg." value="Per Kg." />
                  <Picker.Item label="Per Bundle" value="Per Bundle" />
                  <Picker.Item label="Per Piece" value="Per Piece" />
                  <Picker.Item label="Per Sack" value="Per Sack" />
                  <Picker.Item label="Per Bugkos" value="Per Bugkos" />
                  <Picker.Item label="Per Crate" value="Per Crate" />
                  <Picker.Item label="Per Can" value="Per Can" />
                  <Picker.Item label="Per Box" value="Per Box" />
                </Picker>
              </View>
            </View>

            {editCustomCommodityName.trim() !== '' && (
              <View style={styles.previewBox}>
                <Ionicons name="eye-outline" size={16} color="#1e40af" />
                <Text style={styles.previewText}>
                  Preview: {editCustomCommodityName.trim()} ({editCustomCommodityUnit})
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditingCustomCommodity(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={async () => {
                  if (!editingCustomCommodity) return;
                  const name = editCustomCommodityName.trim();
                  if (!name) {
                    Alert.alert('Missing Name', 'Please enter a commodity name');
                    return;
                  }
                  const newFullName = `${name} (${editCustomCommodityUnit})`;

                  if (newFullName === editingCustomCommodity) {
                    setEditingCustomCommodity(null);
                    return;
                  }

                  if (allCommodities.includes(newFullName)) {
                    Alert.alert('Duplicate', 'This commodity already exists in the list');
                    return;
                  }

                  try {
                    setIsSaving(true);
                    const isDefault = defaultCommodities.includes(editingCustomCommodity);
                    const state = await NetInfo.fetch();
                    const isOnline = !!state.isConnected;

                    if (isDefault) {
                      // Create as custom and hide default
                      if (isOnline) {
                        await supabase.from('custom_commodities').insert([{ name: newFullName }]);
                      }
                      const raw = await AsyncStorage.getItem(CUSTOM_COMMODITIES_KEY);
                      const customList: string[] = raw ? JSON.parse(raw) : [];
                      if (!customList.includes(newFullName)) {
                        customList.push(newFullName);
                        await AsyncStorage.setItem(CUSTOM_COMMODITIES_KEY, JSON.stringify(customList));
                      }
                      
                      let newHidden = [...hiddenCommodities];
                      if (!newHidden.includes(editingCustomCommodity)) {
                        newHidden.push(editingCustomCommodity);
                        await AsyncStorage.setItem(HIDDEN_COMMODITIES_KEY, JSON.stringify(newHidden));
                        setHiddenCommodities(newHidden);
                      }
                      
                      setAllCommodities([...defaultCommodities, ...customList]);
                      setSelectedCommodity(newFullName);
                    } else {
                      if (isOnline) {
                        // 1. Update Custom Commodities table
                        const { error: customError } = await supabase
                          .from('custom_commodities')
                          .update({ name: newFullName })
                          .eq('name', editingCustomCommodity);

                        if (customError) throw customError;

                        // 2. Update Volume historical records
                        await supabase.from('agri_volume').update({ commodity: newFullName }).eq('commodity', editingCustomCommodity);
                        // 3. Update Price historical records
                        await supabase.from('agri_price').update({ commodity: newFullName }).eq('commodity', editingCustomCommodity);
                      }

                      // Update AsyncStorage
                      const raw = await AsyncStorage.getItem(CUSTOM_COMMODITIES_KEY);
                      let customList: string[] = raw ? JSON.parse(raw) : [];
                      customList = customList.map(c => c === editingCustomCommodity ? newFullName : c);
                      await AsyncStorage.setItem(CUSTOM_COMMODITIES_KEY, JSON.stringify(customList));

                      setAllCommodities([...defaultCommodities, ...customList]);
                      if (selectedCommodity === editingCustomCommodity) setSelectedCommodity(newFullName);
                    }

                    Alert.alert('Success', isDefault ? 'Default overridden with custom version!' : 'Updated!');
                    setEditingCustomCommodity(null);
                  } catch (e) {
                    console.error('Failed to update commodity', e);
                    Alert.alert('Error', 'Failed to update commodity');
                  } finally {
                    setIsSaving(false);
                  }
                }}
              >
                <Text style={styles.modalSaveButtonText}>
                  {defaultCommodities.includes(editingCustomCommodity!) ? 'Create Override' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Viewer Modal */}
      <Modal
        visible={showProfileViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileViewer(false)}
      >
        <View style={styles.viewerOverlay}>
          <TouchableOpacity
            style={styles.viewerCloseArea}
            onPress={() => setShowProfileViewer(false)}
            activeOpacity={1}
          />
          <View style={styles.viewerContent}>
            <View style={styles.viewerImageContainer}>
              {collectorImage ? (
                <Image source={{ uri: collectorImage }} style={styles.viewerImage} resizeMode="contain" />
              ) : (
                <View style={styles.viewerIconFallback}>
                  <Ionicons name="person" size={120} color="#9ca3af" />
                </View>
              )}
            </View>
            <View style={styles.viewerActions}>
              <TouchableOpacity
                style={styles.viewerUpdateBtn}
                onPress={() => {
                  setShowProfileViewer(false);
                  updateProfilePicture();
                }}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.viewerUpdateText}>Change Picture</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewerCloseBtn}
                onPress={() => setShowProfileViewer(false)}
              >
                <Text style={styles.viewerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2d6a4f',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#d1fae5',
    marginTop: 2,
    opacity: 0.9,
  },
  collectorProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 20,
    minWidth: 120,
  },
  profileImageContainer: {
    marginRight: 8,
    position: 'relative',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#3b82f6',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  profileRole: {
    fontSize: 10,
    color: '#d1fae5',
    opacity: 0.8,
  },
  profileStatus: {
    fontSize: 9,
    color: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexWrap: 'wrap',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: '60%',
    marginBottom: 12,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  volumeMode: {
    backgroundColor: '#dbeafe',
  },
  priceMode: {
    backgroundColor: '#fef3c7',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    alignSelf: 'flex-start',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeModeButton: {
    backgroundColor: '#2d6a4f',
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: 4,
  },
  activeModeButtonText: {
    color: '#fff',
  },
  periodSummary: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    padding: 16,
    marginBottom: 20,
    borderRadius: 8,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  periodLabel: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '600',
    marginLeft: 6,
  },
  periodTextSummary: {
    fontSize: 16,
    color: '#1e3a8a',
    fontWeight: '600',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  dateGroup: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  searchResults: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  pickerWrap: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 48,
    color: '#111827',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  inputUnit: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginLeft: 8,
  },
  averageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    padding: 14,
    paddingHorizontal: 16,
  },
  averageText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#166534',
    marginLeft: 8,
  },
  averageUnit: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '500',
    marginLeft: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 8,
  },
  volumeSaveButton: {
    backgroundColor: '#3b82f6',
  },
  priceSaveButton: {
    backgroundColor: '#f59e0b',
  },
  saveButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Activities Card Styles
  activitiesCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  activitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexWrap: 'wrap',
  },
  activitiesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: '60%',
    marginBottom: 12,
  },
  activitiesTitleContainer: {
    flex: 1,
  },
  activitiesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  activitiesSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  activitiesActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  refreshButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    minWidth: 80,
  },
  iconOnlyButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 0,
  },
  refreshButtonSmallText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    minWidth: 80,
  },
  viewAllButtonText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },

  // Activity Item Styles
  activityItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  activityIconContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  activityLine: {
    width: 2,
    backgroundColor: '#e5e7eb',
    flex: 1,
    marginTop: 4,
    minHeight: 60,
  },
  activityContent: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  activityTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    textTransform: 'uppercase',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  pendingText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  activityCommodity: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  activityDetails: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userName: {
    fontSize: 11,
    color: '#6b7280',
  },
  periodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  periodText: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },

  // Activities Summary
  activitiesSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 20,
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Empty Activities
  emptyActivities: {
    alignItems: 'center',
    padding: 40,
  },
  emptyActivitiesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyActivitiesMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  recordsHeader: {
    marginBottom: 24,
  },
  recordsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 14,
    color: '#2d6a4f',
    fontWeight: '600',
  },
  recordsTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 4,
  },
  recordsSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  filterCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterPickerWrap: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
  },
  filterPicker: {
    height: 48,
    color: '#111827',
  },
  typeFilterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeFilterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  typeFilterButtonActive: {
    backgroundColor: '#2d6a4f',
  },
  typeFilterButtonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  typeFilterButtonTextActive: {
    color: '#fff',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 14,
    gap: 8,
    marginTop: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  recordsListCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  recordsListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  recordsListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  recordsListSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  recordsStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  emptyMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  recordItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recordTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordTypeText: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  volumeBadge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  priceBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  mergedTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  mergedTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e40af',
  },
  dataTypeIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dataTypeIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordCommodity: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  recordDetails: {
    marginBottom: 12,
  },
  recordWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  recordWeek: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  recordValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  recordValue: {
    fontSize: 14,
    color: '#374151',
  },
  noDataText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginVertical: 8,
  },
  recordMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  recordMeta: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  recordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editRecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  editRecordButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteRecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  deleteRecordButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveButton: {
    backgroundColor: '#2d6a4f',
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 320,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 1001,
  },
  sidebarHeader: {
    backgroundColor: '#2d6a4f',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sidebarProfileSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sidebarProfileImage: {
    position: 'relative',
  },
  sidebarProfileImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sidebarProfileIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarProfileEditBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#3b82f6',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  sidebarProfileInfo: {
    flex: 1,
  },
  sidebarProfileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  sidebarProfileRole: {
    fontSize: 12,
    color: '#d1fae5',
    opacity: 0.9,
    marginBottom: 4,
  },
  sidebarProfileStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  sidebarProfileStatusText: {
    fontSize: 11,
    color: '#d1fae5',
    opacity: 0.8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarMenu: {
    flex: 1,
    paddingVertical: 16,
  },
  sidebarSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sidebarSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  activeMenuItem: {
    backgroundColor: '#f0fdf4',
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    fontSize: 15,
    color: '#4b5563',
    fontWeight: '500',
    flex: 1,
  },
  activeMenuText: {
    color: '#2d6a4f',
    fontWeight: '600',
  },
  logoutText: {
    color: '#ef4444',
  },
  sidebarFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 10,
    color: '#9ca3af',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    gap: 16,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 340,
    gap: 12,
  },
  successIcon: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2937',
  },
  successMessage: {
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  successButton: {
    backgroundColor: '#2d6a4f',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  spinningIcon: {
    transform: [{ rotate: '360deg' }],
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
    fontWeight: '500',
  },
  addCommodityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d6a4f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  addCommodityBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addCommodityModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  addCommodityHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  addCommodityTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 8,
  },
  addCommoditySubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  previewText: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '600',
    flex: 1,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  viewerCloseArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  viewerContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  viewerImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerIconFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  viewerUpdateBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  viewerUpdateText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  viewerCloseBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseText: {
    color: '#4b5563',
    fontSize: 15,
    fontWeight: '700',
  },
  manageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  manageItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  manageItemText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  manageItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  manageEditBtn: {
    backgroundColor: '#eff6ff',
    padding: 8,
    borderRadius: 8,
  },
  manageDeleteBtn: {
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 8,
  },
  emptyManageList: {
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  emptyManageText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  themeToggle: {
    width: 44,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: 'center',
  },
  themeToggleActive: {
    backgroundColor: '#2d6a4f',
  },
  themeToggleInactive: {
    backgroundColor: '#d1d5db',
  },
  themeToggleCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  themeToggleCircleActive: {
    alignSelf: 'flex-end',
  },
  themeToggleCircleInactive: {
    alignSelf: 'flex-start',
  },
});