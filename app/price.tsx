import AsyncStorage from '@react-native-async-storage/async-storage';
const HIDDEN_COMMODITIES_KEY = 'agri_hidden_commodities';
import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/supabaseClient';

import { commodityCategories, CUSTOM_COMMODITIES_KEY, defaultCommodities } from '../src/constants';

export default function PriceScreen() {
  const [date, setDate] = useState('');
  const [allCommodities, setAllCommodities] = useState<string[]>(defaultCommodities);
  const [selectedCommodity, setSelectedCommodity] = useState(defaultCommodities[0]);
  const [lowest, setLowest] = useState('');
  const [highest, setHighest] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Commodity Management state
  const [showAddCommodity, setShowAddCommodity] = useState(false);
  const [newCommodityName, setNewCommodityName] = useState('');
  const [newCommodityUnit, setNewCommodityUnit] = useState('Per Kg.');
  const [showManageCommodities, setShowManageCommodities] = useState(false);
  const [editingCustomCommodity, setEditingCustomCommodity] = useState<string | null>(null);
  const [editCustomCommodityName, setEditCustomCommodityName] = useState('');
  const [editCustomCommodityUnit, setEditCustomCommodityUnit] = useState('Per Kg.');
  const [manageSearch, setManageSearch] = useState('');
  const [hiddenCommodities, setHiddenCommodities] = useState<string[]>([]);
  
  const router = useRouter();

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

  const average = (lowest && highest) ? ((parseFloat(lowest) + parseFloat(highest)) / 2).toFixed(2) : '';

  const handleSave = async () => {
    if (!date) {
      Alert.alert('Missing Date', 'Please enter a date');
      return;
    }
    if (!lowest || !highest) {
      Alert.alert('Missing Price', 'Please enter lowest and highest prices');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('agri_price').insert({
      date,
      commodity: selectedCommodity,
      lowest_price: parseFloat(lowest),
      highest_price: parseFloat(highest),
      average_price: parseFloat(average)
    });
    setIsSaving(false);

    if (error) {
      Alert.alert('Error', 'Failed to save price: ' + error.message);
    } else {
      Alert.alert('Success', 'Price saved!');
      setLowest('');
      setHighest('');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>💰 Price Collection</Text>
      <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      
      <View style={styles.commodityHeader}>
        <Text style={styles.label}>Commodity</Text>
        <View style={styles.commodityActions}>
          <TouchableOpacity
            style={styles.addCommodityBtn}
            onPress={() => setShowAddCommodity(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.addCommodityBtnText}>Add New</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Picker selectedValue={selectedCommodity} onValueChange={setSelectedCommodity} style={styles.picker}>
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
      {selectedCommodity && !selectedCommodity.startsWith('__category__') && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: -10, marginBottom: 15 }}>
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
      <TextInput style={styles.input} placeholder="Lowest Price" keyboardType="numeric" value={lowest} onChangeText={setLowest} />
      <TextInput style={styles.input} placeholder="Highest Price" keyboardType="numeric" value={highest} onChangeText={setHighest} />
      <TextInput style={styles.input} placeholder="Average Price (auto)" value={average} editable={false} />
      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
        <Text style={styles.buttonText}>{isSaving ? '⏳ Saving...' : '💾 Save Price'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.exitButton} onPress={() => router.replace('/')}>
        <Text style={styles.buttonText}>🚪 Exit</Text>
      </TouchableOpacity>

      {/* Add Commodity Modal */}
      <Modal visible={showAddCommodity} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Commodity</Text>
              <TouchableOpacity onPress={() => setShowAddCommodity(false)}>
                <Ionicons name="close-outline" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Commodity Name (e.g. Corn)"
              value={newCommodityName}
              onChangeText={setNewCommodityName}
            />
            <Text style={styles.label}>Unit</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={newCommodityUnit}
                onValueChange={setNewCommodityUnit}
                style={styles.picker}
              >
                <Picker.Item label="Per Kg." value="Per Kg." />
                <Picker.Item label="Per Bundle" value="Per Bundle" />
                <Picker.Item label="Per Piece" value="Per Piece" />
                <Picker.Item label="Per Sack" value="Per Sack" />
                <Picker.Item label="Per Bugkos" value="Per Bugkos" />
              </Picker>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddCommodity(false);
                  setNewCommodityName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={async () => {
                  const fullName = `${newCommodityName.trim()} (${newCommodityUnit})`;
                  if (!newCommodityName.trim()) {
                    Alert.alert('Error', 'Please enter a name');
                    return;
                  }
                  try {
                    const state = await NetInfo.fetch();
                    if (state.isConnected) {
                      await supabase.from('custom_commodities').insert([{ name: fullName }]);
                    }
                    const raw = await AsyncStorage.getItem(CUSTOM_COMMODITIES_KEY);
                    const list = raw ? JSON.parse(raw) : [];
                    if (!list.includes(fullName)) {
                      list.push(fullName);
                      await AsyncStorage.setItem(CUSTOM_COMMODITIES_KEY, JSON.stringify(list));
                    }
                    setAllCommodities([...defaultCommodities, ...list]);
                    setSelectedCommodity(fullName);
                    setShowAddCommodity(false);
                    setNewCommodityName('');
                    Alert.alert('Success', 'Commodity added!');
                  } catch (e) {
                    Alert.alert('Error', 'Failed to add commodity');
                  }
                }}
              >
                <Text style={styles.modalSaveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Custom Commodity Modal */}
      <Modal visible={!!editingCustomCommodity} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {defaultCommodities.includes(editingCustomCommodity!) ? 'Override Default' : 'Edit Commodity'}
            </Text>
            <Text style={{ marginBottom: 10, color: '#666' }}>
              {defaultCommodities.includes(editingCustomCommodity!) 
                ? 'Editing a default commodity will create a custom version for you.' 
                : 'Modify your custom commodity below.'}
            </Text>
            <TextInput
              style={styles.input}
              value={editCustomCommodityName}
              onChangeText={setEditCustomCommodityName}
            />
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={editCustomCommodityUnit}
                onValueChange={setEditCustomCommodityUnit}
                style={styles.picker}
              >
                <Picker.Item label="Per Kg." value="Per Kg." />
                <Picker.Item label="Per Bundle" value="Per Bundle" />
                <Picker.Item label="Per Piece" value="Per Piece" />
                <Picker.Item label="Per Sack" value="Per Sack" />
                <Picker.Item label="Per Bugkos" value="Per Bugkos" />
              </Picker>
            </View>
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
                  const newFullName = `${editCustomCommodityName.trim()} (${editCustomCommodityUnit})`;
                  const isDefault = defaultCommodities.includes(editingCustomCommodity);
                  
                  try {
                    if (isDefault) {
                      // Create as custom and hide default
                      const state = await NetInfo.fetch();
                      if (state.isConnected) {
                        await supabase.from('custom_commodities').insert([{ name: newFullName }]);
                      }
                      const raw = await AsyncStorage.getItem(CUSTOM_COMMODITIES_KEY);
                      const list = raw ? JSON.parse(raw) : [];
                      if (!list.includes(newFullName)) {
                        list.push(newFullName);
                        await AsyncStorage.setItem(CUSTOM_COMMODITIES_KEY, JSON.stringify(list));
                      }
                      
                      let newHidden = [...hiddenCommodities];
                      if (!newHidden.includes(editingCustomCommodity)) {
                        newHidden.push(editingCustomCommodity);
                        await AsyncStorage.setItem(HIDDEN_COMMODITIES_KEY, JSON.stringify(newHidden));
                        setHiddenCommodities(newHidden);
                      }
                      
                      setAllCommodities([...defaultCommodities, ...list]);
                      setSelectedCommodity(newFullName);
                    } else {
                      // Normal edit
                      await supabase
                        .from('custom_commodities')
                        .update({ name: newFullName })
                        .eq('name', editingCustomCommodity);
                      
                      await supabase.from('agri_price').update({ commodity: newFullName }).eq('commodity', editingCustomCommodity);

                      const raw = await AsyncStorage.getItem(CUSTOM_COMMODITIES_KEY);
                      let list = raw ? JSON.parse(raw) : [];
                      list = list.map((c: string) => c === editingCustomCommodity ? newFullName : c);
                      await AsyncStorage.setItem(CUSTOM_COMMODITIES_KEY, JSON.stringify(list));
                      
                      setAllCommodities([...defaultCommodities, ...list]);
                      if (selectedCommodity === editingCustomCommodity) setSelectedCommodity(newFullName);
                    }
                    
                    setEditingCustomCommodity(null);
                    Alert.alert('Success', isDefault ? 'Default overridden with custom version!' : 'Updated!');
                  } catch (e) {
                    Alert.alert('Error', 'Action failed');
                  }
                }}
              >
                <Text style={styles.modalSaveButtonText}>{defaultCommodities.includes(editingCustomCommodity!) ? 'Create Override' : 'Update'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 15 },
  picker: { marginBottom: 15 },
  saveButton: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  exitButton: { backgroundColor: '#E53935', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 5 },
  commodityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  commodityActions: { flexDirection: 'row', gap: 10 },
  addCommodityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d6a4f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  addCommodityBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  pickerWrap: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', marginBottom: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 15, padding: 20, width: '100%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalButton: { padding: 12, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f3f4f6' },
  cancelButtonText: { color: '#374151', fontWeight: 'bold' },
  modalSaveButton: { backgroundColor: '#2d6a4f' },
  modalSaveButtonText: { color: '#fff', fontWeight: 'bold' },
  manageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 15,
    height: 40,
  },
  manageSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
  }
});
