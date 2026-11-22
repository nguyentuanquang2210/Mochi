import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loginWithEmail, registerWithEmail } from '../services/auth';

const messageForAuthError = (error: any) => {
  const code = error?.code || '';
  if (code.includes('invalid-email')) return 'Email không hợp lệ.';
  if (code.includes('email-already-in-use')) return 'Email này đã được đăng ký.';
  if (code.includes('weak-password')) return 'Mật khẩu cần có ít nhất 6 ký tự.';
  if (code.includes('operation-not-allowed')) return 'Firebase chưa bật phương thức Email/Password. Vào Firebase Console → Authentication → Sign-in method → bật Email/Password.';
  if (code.includes('configuration-not-found')) return 'Firebase Authentication chưa được cấu hình cho project này. Vào Firebase Console → Authentication → Get started, sau đó bật Email/Password trong Sign-in method.';
  if (code.includes('api-key-not-valid') || code.includes('invalid-api-key')) return 'Firebase API key của ứng dụng chưa hợp lệ. Hãy kiểm tra lại cấu hình Firebase.';
  if (code.includes('app-not-authorized') || code.includes('unauthorized-domain')) return 'Ứng dụng chưa được Firebase Authentication cho phép. Hãy kiểm tra cấu hình Authentication.';
  if (code.includes('too-many-requests')) return 'Bạn đã thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.';
  if (code.includes('permission-denied')) return 'Tài khoản đã tạo nhưng Firestore chưa có quyền ghi. Hãy triển khai lại Firestore Rules.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email hoặc mật khẩu chưa đúng.';
  if (code.includes('network')) return 'Không thể kết nối Firebase. Hãy kiểm tra mạng.';
  return `Thao tác chưa thành công${code ? ` (mã: ${code})` : ''}. Vui lòng thử lại.`;
};

export function AuthScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập email và mật khẩu.');
    if (isRegistering && !name.trim()) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên hiển thị.');
    setSubmitting(true);
    try {
      if (isRegistering) await registerWithEmail(name, email, password);
      else await loginWithEmail(email, password);
    } catch (error) {
      console.warn('Firebase authentication failed:', error);
      Alert.alert(isRegistering ? 'Không thể đăng ký' : 'Không thể đăng nhập', messageForAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.brand}>mochi</Text>
        <Text style={styles.title}>{isRegistering ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</Text>
        <Text style={styles.subtitle}>{isRegistering ? 'Lưu tiến trình học của bạn trên Firebase.' : 'Đăng nhập để tiếp tục học.'}</Text>
        {isRegistering && <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tên hiển thị" autoCapitalize="words" />}
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mật khẩu (ít nhất 6 ký tự)" secureTextEntry autoComplete={isRegistering ? 'new-password' : 'password'} />
        <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabled]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{isRegistering ? 'Đăng ký' : 'Đăng nhập'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity disabled={submitting} onPress={() => setIsRegistering(v => !v)} style={styles.switchButton}>
          <Text style={styles.switchText}>{isRegistering ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  brand: { color: '#2563EB', fontSize: 30, fontWeight: '800', marginBottom: 28 },
  title: { color: '#111827', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 8, marginBottom: 22, lineHeight: 20 },
  input: { height: 50, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, color: '#111827', fontSize: 15, paddingHorizontal: 14, marginBottom: 12 },
  primaryButton: { height: 50, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  disabled: { opacity: 0.65 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchButton: { alignItems: 'center', paddingTop: 20, paddingBottom: 2 },
  switchText: { color: '#2563EB', fontSize: 14, fontWeight: '600' }
});
