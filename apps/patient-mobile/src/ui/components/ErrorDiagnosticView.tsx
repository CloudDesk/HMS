import React, { useState } from 'react';
import {
  Alert,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  ApiFailure,
  formatDiagnosticDetails,
  friendlyError,
  getDiagnosticId,
  isRetryable,
} from '../../api/errors';
import { colors, radius, spacing, typography } from '../theme';

export interface ErrorDiagnosticViewProps {
  error: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
  showExpandToggle?: boolean;
  initiallyExpanded?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function ErrorDiagnosticView({
  error,
  onRetry,
  onDismiss,
  showExpandToggle = true,
  initiallyExpanded = false,
  containerStyle,
}: ErrorDiagnosticViewProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [isSharing, setIsSharing] = useState(false);

  if (!error) return null;

  const userMessage = friendlyError(error);
  const diagnosticId = getDiagnosticId(error);
  const canRetry = Boolean(onRetry && isRetryable(error));
  const apiFailure = error instanceof ApiFailure ? error : null;

  const handleShareDiagnostics = async () => {
    try {
      setIsSharing(true);
      const text = formatDiagnosticDetails(error);
      await Share.share({
        message: text,
        title: 'HMS Mobile Diagnostics',
      });
    } catch {
      Alert.alert('Unable to share', 'Could not open share dialog.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.bannerHeader}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>⚠️</Text>
        </View>
        <View style={styles.messageContainer}>
          <Text style={styles.userMessage}>{userMessage}</Text>
          {diagnosticId ? (
            <Text style={styles.diagnosticBadge}>Ref: {diagnosticId}</Text>
          ) : null}
        </View>
      </View>

      {/* Action buttons row */}
      <View style={styles.actionRow}>
        {canRetry ? (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        ) : null}

        {showExpandToggle && (apiFailure || diagnosticId) ? (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setExpanded(!expanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleButtonText}>
              {expanded ? 'Hide Details ▲' : 'Technical Details ▼'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {onDismiss ? (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Expanded technical details */}
      {expanded && apiFailure ? (
        <View style={styles.detailsContainer}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle}>Diagnostic Information</Text>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareDiagnostics}
              disabled={isSharing}
              activeOpacity={0.7}
            >
              <Text style={styles.shareButtonText}>
                {isSharing ? 'Sharing...' : 'Share / Copy Details'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Diagnostic ID:</Text>
            <Text style={styles.detailValueSelectable}>{apiFailure.diagnosticId}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category:</Text>
            <Text style={styles.detailValue}>{apiFailure.category}</Text>
          </View>

          {apiFailure.status ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>HTTP Status:</Text>
              <Text style={styles.detailValue}>{apiFailure.status}</Text>
            </View>
          ) : null}

          {apiFailure.code ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Code:</Text>
              <Text style={styles.detailValue}>{apiFailure.code}</Text>
            </View>
          ) : null}

          {apiFailure.requestId ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Server Request ID:</Text>
              <Text style={styles.detailValueSelectable}>{apiFailure.requestId}</Text>
            </View>
          ) : null}

          {apiFailure.endpoint ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Endpoint:</Text>
              <Text style={styles.detailValue}>
                {apiFailure.method ?? 'GET'} {apiFailure.endpoint}
              </Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Timestamp:</Text>
            <Text style={styles.detailValue}>{apiFailure.timestamp}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Retryable:</Text>
            <Text style={styles.detailValue}>
              {apiFailure.retryable ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    marginRight: spacing.sm + 2,
    marginTop: 1,
  },
  iconText: {
    fontSize: typography.size.subtitle,
  },
  messageContainer: {
    flex: 1,
  },
  userMessage: {
    ...typography.presets.bodySmallMedium,
    color: '#991B1B',
  },
  diagnosticBadge: {
    ...typography.presets.code,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: '#B91C1C',
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.status.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.xs + 2,
  },
  retryButtonText: {
    ...typography.presets.captionStrong,
    color: colors.text.inverse,
  },
  toggleButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  toggleButtonText: {
    ...typography.presets.captionMedium,
    color: '#7F1D1D',
    textDecorationLine: 'underline',
  },
  dismissButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  dismissButtonText: {
    ...typography.presets.caption,
    color: '#991B1B',
  },
  detailsContainer: {
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    backgroundColor: '#FFF1F2',
    borderRadius: radius.xs + 2,
    padding: spacing.sm + 2,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailsTitle: {
    ...typography.presets.captionStrong,
    color: '#881337',
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
  },
  shareButton: {
    backgroundColor: '#E11D48',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  shareButtonText: {
    ...typography.presets.captionStrong,
    color: colors.text.inverse,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  detailLabel: {
    ...typography.presets.captionStrong,
    color: '#9F1239',
    width: '40%',
  },
  detailValue: {
    ...typography.presets.caption,
    color: '#4C0519',
    width: '60%',
    textAlign: 'right',
  },
  detailValueSelectable: {
    ...typography.presets.code,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: '#4C0519',
    width: '60%',
    textAlign: 'right',
  },
});
