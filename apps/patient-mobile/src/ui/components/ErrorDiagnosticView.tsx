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
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    marginRight: 10,
    marginTop: 1,
  },
  iconText: {
    fontSize: 16,
  },
  messageContainer: {
    flex: 1,
  },
  userMessage: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  diagnosticBadge: {
    color: '#B91C1C',
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toggleButtonText: {
    color: '#7F1D1D',
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  dismissButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dismissButtonText: {
    color: '#991B1B',
    fontSize: 12,
  },
  detailsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    backgroundColor: '#FFF1F2',
    borderRadius: 6,
    padding: 10,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#881337',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shareButton: {
    backgroundColor: '#E11D48',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 11,
    color: '#9F1239',
    fontWeight: '600',
    width: '40%',
  },
  detailValue: {
    fontSize: 11,
    color: '#4C0519',
    width: '60%',
    textAlign: 'right',
  },
  detailValueSelectable: {
    fontSize: 11,
    color: '#4C0519',
    fontFamily: 'monospace',
    fontWeight: '700',
    width: '60%',
    textAlign: 'right',
  },
});
