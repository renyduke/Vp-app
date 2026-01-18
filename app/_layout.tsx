import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Login' }} />
      <Stack.Screen name="volume" options={{ title: 'Volume Collection' }} />
      <Stack.Screen name="price" options={{ title: 'Price Collection' }} />
    </Stack>
  );
}
