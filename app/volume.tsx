import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../src/supabaseClient';
import { useRouter } from 'expo-router';

const commodities = ['Cabbage','Carrots','Beans','Tomato','Pechay','Pepper','Squash',
  'Green Onion','Potato','Sayote','Cucumber','Lettuce','Cauliflower','Broccoli',
  'Radish','Camote','Ginger','Eggplant'];

export default function VolumeScreen() {
  const [date, setDate] = useState('');
  const [selectedCommodity, setSelectedCommodity] = useState(commodities[0]);
  const [volume, setVolume] = useState('');
  const router = useRouter();

  const handleSave = async () => {
    const { error } = await supabase.from('agri_volume').insert({
      date,
      commodity: selectedCommodity,
      volume
    });
    if (error) {
      alert('Error saving volume: ' + error.message);
    } else {
      alert('Volume saved!');
      setVolume('');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📦 Volume Collection</Text>
      <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Picker selectedValue={selectedCommodity} onValueChange={setSelectedCommodity} style={styles.picker}>
        {commodities.map((c, i) => <Picker.Item key={i} label={c} value={c} />)}
      </Picker>
      <TextInput style={styles.input} placeholder="Volume (Kg)" keyboardType="numeric" value={volume} onChangeText={setVolume} />
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.buttonText}>💾 Save Volume</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.exitButton} onPress={() => router.replace('/')}>
        <Text style={styles.buttonText}>🚪 Exit</Text>
      </TouchableOpacity>
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
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' }
});
