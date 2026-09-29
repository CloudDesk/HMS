import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { readPublicConfig } from '../../config/config';
import { getInitials } from '../../portal/formatters';
import { useAuth } from '../AuthContext';
import { colors, typography } from '../theme';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: AvatarSize;
  onPress?: () => void;
  showEditBadge?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_METRICS = { dimension: 48, fontSize: 18, badgeSize: 18, badgeIconSize: 11 };

const SIZE_MAP: Record<string, { dimension: number; fontSize: number; badgeSize: number; badgeIconSize: number }> = {
  xs: { dimension: 28, fontSize: 11, badgeSize: 12, badgeIconSize: 8 },
  sm: { dimension: 36, fontSize: 14, badgeSize: 14, badgeIconSize: 9 },
  md: { dimension: 48, fontSize: 18, badgeSize: 18, badgeIconSize: 11 },
  lg: { dimension: 64, fontSize: 24, badgeSize: 22, badgeIconSize: 13 },
  xl: { dimension: 88, fontSize: 32, badgeSize: 26, badgeIconSize: 15 },
};

export function Avatar({
  name,
  photoUrl,
  size = 'md',
  onPress,
  showEditBadge = false,
  style,
  testID,
}: AvatarProps) {
  const { manager } = useAuth();
  const [hasError, setHasError] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const config = useMemo(() => {
    try {
      return readPublicConfig();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setHasError(false);
  }, [photoUrl, token]);

  useEffect(() => {
    let isMounted = true;
    if (photoUrl && manager) {
      manager.accessToken().then((tok) => {
        if (isMounted) setToken(tok);
      }).catch(() => {
        if (isMounted) setToken(null);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [photoUrl, manager]);

  const sizeMetrics = typeof size === 'number'
    ? {
        dimension: size,
        fontSize: Math.round(size * 0.4),
        badgeSize: Math.round(size * 0.32),
        badgeIconSize: Math.round(size * 0.2),
      }
    : (typeof size === 'string' && SIZE_MAP[size]) ? SIZE_MAP[size] : DEFAULT_METRICS;

  const resolvedUrl = useMemo(() => {
    if (!photoUrl) return null;
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://') || photoUrl.startsWith('data:') || photoUrl.startsWith('file://')) {
      return photoUrl;
    }
    if (config?.apiBaseUrl) {
      const baseHost = config.apiBaseUrl.replace(/\/api$/, '');
      if (photoUrl.startsWith('/api/')) {
        return `${baseHost}${photoUrl}`;
      }
      if (photoUrl.startsWith('/')) {
        return `${baseHost}${photoUrl}`;
      }
      return `${config.apiBaseUrl}/${photoUrl}`;
    }
    return photoUrl;
  }, [photoUrl, config]);

  const isRemoteApiUrl = useMemo(() => {
    if (!resolvedUrl) return false;
    return !resolvedUrl.startsWith('data:') && !resolvedUrl.startsWith('file://');
  }, [resolvedUrl]);

  const initials = getInitials(name);
  const showImage = Boolean(resolvedUrl && !hasError && (!isRemoteApiUrl || !manager || token));

  const content = (
    <View
      style={[
        styles.container,
        {
          width: sizeMetrics.dimension,
          height: sizeMetrics.dimension,
          borderRadius: sizeMetrics.dimension / 2,
        },
        style,
      ]}
      testID={testID}
    >
      {showImage && resolvedUrl ? (
        <Image
          source={{
            uri: resolvedUrl,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }}
          style={[
            styles.image,
            {
              width: sizeMetrics.dimension,
              height: sizeMetrics.dimension,
              borderRadius: sizeMetrics.dimension / 2,
            },
          ]}
          resizeMode="cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: sizeMetrics.dimension,
              height: sizeMetrics.dimension,
              borderRadius: sizeMetrics.dimension / 2,
            },
          ]}
        >
          <Text
            style={[
              styles.initialsText,
              {
                fontSize: sizeMetrics.fontSize,
              },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}

      {showEditBadge ? (
        <View
          style={[
            styles.badge,
            {
              width: sizeMetrics.badgeSize,
              height: sizeMetrics.badgeSize,
              borderRadius: sizeMetrics.badgeSize / 2,
              right: 0,
              bottom: 0,
            },
          ]}
        >
          <Text style={[styles.badgeIcon, { fontSize: sizeMetrics.badgeIconSize }]}>📷</Text>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  touchable: {
    alignSelf: 'center',
  },
  container: {
    backgroundColor: colors.brand.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.brand.accent,
    position: 'relative',
    overflow: 'visible',
  },
  image: {
    backgroundColor: colors.neutral.surfaceSubtle,
  },
  fallback: {
    backgroundColor: colors.brand.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: colors.brand.primaryDark,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
  badge: {
    position: 'absolute',
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.neutral.surface,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  badgeIcon: {
    color: colors.neutral.surface,
  },
});
