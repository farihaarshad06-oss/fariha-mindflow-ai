import React from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { mobileApiClient } from '../lib/api';

export function LoginScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const login = async () => {
    try {
      const result = await mobileApiClient.post<{ tokens: { accessToken: string } }>('/auth/login', {
        email,
        password,
      });
      void result;
      navigation.replace('Dashboard');
    } catch {
      // Mobile login placeholder: surfaces error state in a real build.
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('appName')}</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title={t('login')} onPress={login} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12 },
});
