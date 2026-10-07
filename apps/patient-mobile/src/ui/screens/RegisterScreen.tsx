import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import { ErrorDiagnosticView } from '../components/ErrorDiagnosticView';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { registrationFormSchema, type RegistrationFormValues } from '../../auth/contracts';
import { latestSelfRegistrationDob } from '../../auth/registration-date';
import { AppointmentDatePicker } from '../components/AppointmentDatePicker';
import { useFocusedInputScroll } from '../useFocusedInputScroll';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

const GENDER_OPTIONS: Array<{ label: string; value: 'MALE' | 'FEMALE' | 'OTHER' }> = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export function RegisterScreen() {
  const { state, registerPatient, cancelRegistration, setAuthMode, getPublicBranches, clearError } = useAuth();
  const { scrollRef, onInputFocus, ensureVisible, onScroll } = useFocusedInputScroll();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [preferredBranchId, setPreferredBranchId] = useState('');
  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isSubmitting = state.status === 'registering';
  const isSessionExpired = !state.registrationToken;
  const displayError =
    state.message ??
    (isSessionExpired ? 'The registration session is invalid or has expired. Please verify your mobile number again.' : localError);

  useEffect(() => {
    let active = true;
    async function loadBranches() {
      setLoadingBranches(true);
      try {
        const fetched = await getPublicBranches();
        if (active && fetched.length > 0 && fetched[0]) {
          setBranches(fetched);
          setPreferredBranchId(fetched[0].id);
        }
      } catch {
        // Fallback: continue if branches load fails; user can still submit if default is set
      } finally {
        if (active) setLoadingBranches(false);
      }
    }
    void loadBranches();
    return () => {
      active = false;
    };
  }, [getPublicBranches]);

  const handleSubmit = async () => {
    if (isSubmitting || isSessionExpired) return;
    Keyboard.dismiss();
    setLocalError(null);
    clearError();

    const payload: RegistrationFormValues = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      dateOfBirth,
      gender,
      preferredBranchId,
      bloodGroup: bloodGroup.trim() || undefined,
      line1: line1.trim() || undefined,
      city: city.trim() || undefined,
      state: stateName.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
    };

    const parsed = registrationFormSchema.safeParse(payload);
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? 'Please check all required fields.');
      return;
    }

    await registerPatient(parsed.data);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
    >
      <ScrollView ref={scrollRef} onLayout={ensureVisible} contentContainerStyle={styles.scrollContainer}
        onScroll={onScroll} scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.card}>
          <View style={styles.header}>
            <BrandLogo size="md" />
            <Text style={styles.title}>Complete Patient Details</Text>
            <Text style={styles.subtitle}>
              Fill in your details below to create your official hospital patient profile.
            </Text>

            {state.phone ? (
              <View style={styles.verifiedPhoneBadge}>
                <Text style={styles.verifiedPhoneText}>
                  ✓ Verified Mobile: <Text style={styles.phoneHighlight}>{state.phone}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          {state.errorDetails || displayError ? (
            <View style={styles.errorContainer}>
              <ErrorDiagnosticView
                error={state.errorDetails ?? displayError}
                onDismiss={() => {
                  if (localError) setLocalError(null);
                  clearError();
                }}
              />
            </View>
          ) : null}

          {/* Full Name */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Full Name <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              onFocus={onInputFocus}
              style={styles.input}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="words"
              autoCorrect={false}
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (localError) setLocalError(null);
                if (state.message || state.errorDetails) clearError();
              }}
              editable={!isSubmitting}
            />
          </View>

          {/* Email Address */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Email Address <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              onFocus={onInputFocus}
              style={styles.input}
              placeholder="e.g. rahul.sharma@example.com"
              placeholderTextColor={colors.text.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (localError) setLocalError(null);
                if (state.message || state.errorDetails) clearError();
              }}
              editable={!isSubmitting}
            />
          </View>

          {/* Date of Birth & Gender Row */}
          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
              <Text style={styles.label}>
                Date of Birth <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <AppointmentDatePicker
                minDate=""
                maxDate={latestSelfRegistrationDob()}
                showQuickOptions={false}
                label="Choose DOB"
                value={dateOfBirth}
                onChange={(text) => {
                  setDateOfBirth(text);
                  if (localError) setLocalError(null);
                  if (state.message || state.errorDetails) clearError();
                }}
                disabled={isSubmitting}
              />
              <Text style={styles.fieldHint}>Enter the patient’s date of birth.</Text>
            </View>
          </View>

          {/* Gender Selector */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Gender <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={styles.chipsRow}>
              {GENDER_OPTIONS.map((opt) => {
                const isSelected = gender === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setGender(opt.value)}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Preferred Branch */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Preferred Hospital Branch <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            {loadingBranches ? (
              <ActivityIndicator size="small" color={colors.brand.primary} style={{ marginVertical: spacing.sm }} />
            ) : (
              <View style={styles.branchesContainer}>
                {branches.map((branch) => {
                  const isSelected = preferredBranchId === branch.id;
                  return (
                    <TouchableOpacity
                      key={branch.id}
                      style={[styles.branchCard, isSelected && styles.branchCardSelected]}
                      onPress={() => setPreferredBranchId(branch.id)}
                      disabled={isSubmitting}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                        {isSelected ? <View style={styles.radioInner} /> : null}
                      </View>
                      <View style={styles.branchInfo}>
                        <Text style={[styles.branchName, isSelected && styles.branchNameSelected]}>
                          {branch.name}
                        </Text>
                        <Text style={styles.branchCode}>{branch.code}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Blood Group (Optional) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Blood Group (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bloodGroupScroll}>
              {BLOOD_GROUPS.map((bg) => {
                const isSelected = bloodGroup === bg;
                return (
                  <TouchableOpacity
                    key={bg}
                    style={[styles.bloodChip, isSelected && styles.bloodChipSelected]}
                    onPress={() => setBloodGroup(isSelected ? '' : bg)}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.bloodChipText, isSelected && styles.bloodChipTextSelected]}>
                      {bg}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Address (Optional) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Address (Optional)</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Street Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 123 Health Ave, Apt 4B"
              placeholderTextColor={colors.text.muted}
              value={line1}
              onFocus={onInputFocus}
              onChangeText={setLine1}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mumbai"
                placeholderTextColor={colors.text.muted}
                value={city}
                onFocus={onInputFocus}
                onChangeText={setCity}
                editable={!isSubmitting}
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Maharashtra"
                placeholderTextColor={colors.text.muted}
                value={stateName}
                onFocus={onInputFocus}
                onChangeText={setStateName}
                editable={!isSubmitting}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Postal / PIN Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 400001"
              placeholderTextColor={colors.text.muted}
              keyboardType="number-pad"
              value={postalCode}
              onFocus={onInputFocus}
              onChangeText={setPostalCode}
              editable={!isSubmitting}
            />
          </View>

          {/* Submit / Re-verify Button */}
          {isSessionExpired ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                cancelRegistration();
                setAuthMode('register');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Verify Mobile Number Again</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.text.inverse} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account & Sign In</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelRegistration}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>← Cancel & Return to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.card,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.presets.screenTitle,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal,
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  verifiedPhoneBadge: {
    backgroundColor: colors.status.successBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.successBorder,
  },
  verifiedPhoneText: {
    ...typography.presets.captionStrong,
    color: colors.status.success,
  },
  phoneHighlight: {
    fontWeight: typography.weight.heavy,
  },
  errorContainer: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  sectionTitle: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  formRow: {
    flexDirection: 'row',
  },
  label: {
    ...typography.presets.bodySmallStrong,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  requiredAsterisk: {
    color: colors.status.danger,
  },
  fieldHint: {
    ...typography.presets.caption,
    color: colors.text.muted,
    marginTop: spacing.xxs,
  },
  input: {
    height: 48,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.base,
    color: colors.text.primary,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.neutral.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.brand.primaryLight,
    borderColor: colors.brand.primary,
  },
  chipText: {
    ...typography.presets.bodySmallMedium,
    color: colors.text.secondary,
  },
  chipTextSelected: {
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
  },
  branchesContainer: {
    gap: spacing.sm,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.neutral.surfaceSubtle,
  },
  branchCardSelected: {
    backgroundColor: colors.brand.primarySubtle,
    borderColor: colors.brand.primary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioButtonSelected: {
    borderColor: colors.brand.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand.primary,
  },
  branchInfo: {
    flex: 1,
  },
  branchName: {
    ...typography.presets.bodyMedium,
    color: colors.text.primary,
  },
  branchNameSelected: {
    fontWeight: typography.weight.bold,
    color: colors.brand.primaryDark,
  },
  branchCode: {
    ...typography.presets.caption,
    color: colors.text.muted,
  },
  bloodGroupScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  bloodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.neutral.surfaceSubtle,
  },
  bloodChipSelected: {
    backgroundColor: colors.brand.primaryLight,
    borderColor: colors.brand.primary,
  },
  bloodChipText: {
    ...typography.presets.bodySmallMedium,
    color: colors.text.secondary,
  },
  bloodChipTextSelected: {
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
  },
  primaryButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadows.subtle,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: colors.text.inverse,
    ...typography.presets.button,
    letterSpacing: typography.letterSpacing.wide,
  },
  cancelButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelButtonText: {
    ...typography.presets.bodySmallMedium,
    color: colors.text.secondary,
  },
});
