import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather, Ionicons } from './components/Icons';
import { loginWithEmail, registerWithEmail } from '../services/auth';

const messageForAuthError = (error: any) => {
  const code = error?.code || '';
  if (code.includes('invalid-email')) return 'Email không hợp lệ. Vui lòng kiểm tra lại.';
  if (code.includes('email-already-in-use')) return 'Email này đã được đăng ký tài khoản trước đó.';
  if (code.includes('weak-password')) return 'Mật khẩu quá ngắn, cần có ít nhất 6 ký tự.';
  if (code.includes('operation-not-allowed')) return 'Chưa kích hoạt phương thức Email/Password trong Firebase Console.';
  if (code.includes('configuration-not-found')) return 'Cấu hình Firebase Authentication chưa hoàn tất.';
  if (code.includes('api-key-not-valid') || code.includes('invalid-api-key')) return 'Khóa API Firebase không hợp lệ.';
  if (code.includes('app-not-authorized') || code.includes('unauthorized-domain')) return 'Ứng dụng chưa được phân quyền trong Firebase.';
  if (code.includes('too-many-requests')) return 'Bạn đã thử quá nhiều lần. Vui lòng đợi 1-2 phút rồi thử lại.';
  if (code.includes('permission-denied')) return 'Không đủ quyền truy cập tài khoản. Vui lòng kiểm tra Rules.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email hoặc mật khẩu không chính xác.';
  if (code.includes('network')) return 'Không thể kết nối mạng. Vui lòng kiểm tra lại Wifi/4G.';
  return `Thao tác chưa thành công${code ? ` (${code})` : ''}. Vui lòng thử lại.`;
};

export function AuthScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'password' | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      return Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ email và mật khẩu.');
    }
    if (isRegistering && !name.trim()) {
      return Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên hiển thị của bạn.');
    }
    if (password.length < 6) {
      return Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu cần tối thiểu 6 ký tự để đảm bảo an toàn.');
    }

    setSubmitting(true);
    try {
      if (isRegistering) {
        await registerWithEmail(name, email, password);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (error) {
      console.warn('Firebase authentication failed:', error);
      Alert.alert(isRegistering ? 'Không thể đăng ký' : 'Không thể đăng nhập', messageForAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>

            <View style={styles.brandRow}>
              <Text style={styles.brandName}>mochi</Text>
              <View style={styles.fsrsBadge}>
                <Text style={styles.fsrsBadgeText}>FSRS</Text>
              </View>
            </View>

            <Text style={styles.headerSubtitle}>
              {isRegistering
                ? 'Tạo tài khoản để đồng bộ tiến trình học và bảo toàn chuỗi ngày học của bạn'
                : 'Chào mừng trở lại! Đăng nhập để tiếp tục học từ vựng hôm nay'}
            </Text>
          </View>

          {/* Main Form Card */}
          <View style={styles.card}>
            {/* Segmented Tab Switcher */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, !isRegistering && styles.tabButtonActive]}
                onPress={() => {
                  if (isRegistering) {
                    setIsRegistering(false);
                    setFocusedField(null);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, !isRegistering && styles.tabTextActive]}>
                  Đăng nhập
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, isRegistering && styles.tabButtonActive]}
                onPress={() => {
                  if (!isRegistering) {
                    setIsRegistering(true);
                    setFocusedField(null);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, isRegistering && styles.tabTextActive]}>
                  Đăng ký
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input Fields */}
            {isRegistering && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Tên của bạn</Text>
                <View style={[styles.inputBox, focusedField === 'name' && styles.inputBoxFocused]}>
                  <Feather
                    name="user"
                    size={18}
                    color={focusedField === 'name' ? '#262626' : '#94A3B8'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Nhập họ tên hoặc biệt danh"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                  />
                  {name.length > 0 && (
                    <TouchableOpacity onPress={() => setName('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="x" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={[styles.inputBox, focusedField === 'email' && styles.inputBoxFocused]}>
                <Feather
                  name="mail"
                  size={18}
                  color={focusedField === 'email' ? '#262626' : '#94A3B8'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
                {email.length > 0 && (
                  <TouchableOpacity onPress={() => setEmail('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Mật khẩu</Text>
                {isRegistering && (
                  <Text style={styles.fieldSubLabel}>Tối thiểu 6 ký tự</Text>
                )}
              </View>
              <View style={[styles.inputBox, focusedField === 'password' && styles.inputBoxFocused]}>
                <Feather
                  name="lock"
                  size={18}
                  color={focusedField === 'password' ? '#262626' : '#94A3B8'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={isRegistering ? 'Tạo mật khẩu an toàn' : 'Nhập mật khẩu của bạn'}
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoComplete={isRegistering ? 'new-password' : 'password'}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Primary Submit Button */}
            <TouchableOpacity
              style={[styles.primaryButton, submitting && styles.buttonDisabled]}
              onPress={submit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    {isRegistering ? 'Tạo tài khoản ngay' : 'Đăng nhập'}
                  </Text>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </>
              )}
            </TouchableOpacity>

            {/* Switch Helper */}
            <TouchableOpacity
              disabled={submitting}
              onPress={() => setIsRegistering(v => !v)}
              style={styles.switchButton}
              activeOpacity={0.7}
            >
              <Text style={styles.switchTextRegular}>
                {isRegistering ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
                <Text style={styles.switchTextHighlight}>
                  {isRegistering ? 'Đăng nhập' : 'Đăng ký miễn phí'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Feature Highlights Footer */}
          <View style={styles.footerFeatures}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconCircle}>
                <Ionicons name="flash-outline" size={16} color="#E67E22" />
              </View>
              <Text style={styles.featureText}>Lặp lại ngắt quãng FSRS</Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconCircle}>
                <Ionicons name="cloud-done-outline" size={16} color="#38BDF8" />
              </View>
              <Text style={styles.featureText}>Đồng bộ Cloud an toàn</Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconCircle}>
                <Ionicons name="flame-outline" size={16} color="#FF5E00" />
              </View>
              <Text style={styles.featureText}>Chuỗi ngày học Streak</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  keyboardContainer: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28
  },
  header: {
    alignItems: 'center',
    marginBottom: 24
  },
  logoWrapper: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 14
  },
  logoImage: {
    width: 52,
    height: 52,
    borderRadius: 14
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  brandName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.6
  },
  fsrsBadge: {
    backgroundColor: '#262626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  fsrsBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10
  },
  tabButtonActive: {
    backgroundColor: '#262626',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B'
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  fieldContainer: {
    marginBottom: 16
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline'
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  fieldSubLabel: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '500'
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14
  },
  inputBoxFocused: {
    borderColor: '#262626',
    backgroundColor: '#FFFFFF'
  },
  inputIcon: {
    marginRight: 10
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0
  },
  primaryButton: {
    height: 52,
    backgroundColor: '#262626',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#262626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3
  },
  buttonDisabled: {
    opacity: 0.7
  },
  primaryButtonText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  switchButton: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 4
  },
  switchTextRegular: {
    fontSize: 13.5,
    color: '#64748B'
  },
  switchTextHighlight: {
    color: '#111827',
    fontWeight: '700'
  },
  footerFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 16
  },
  featureItem: {
    alignItems: 'center',
    maxWidth: 96
  },
  featureIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  featureText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14
  }
});
