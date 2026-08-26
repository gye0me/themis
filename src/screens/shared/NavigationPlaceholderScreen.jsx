import { useMemo } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import styles from './NavigationPlaceholderScreen.styles';

export function NavigationPlaceholderScreen({ route, navigation }) {
  const title = route?.params?.title || route?.name || 'Screen';
  const description = route?.params?.description || 'UI는 팀원 구현본으로 교체될 예정입니다.';
  const actions = route?.params?.actions || [];

  const subtitle = useMemo(() => {
    if (route?.params?.subtitle) {
      return route.params.subtitle;
    }

    return route?.name || 'Route';
  }, [route]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.badge}>NAVIGATION</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => navigation.navigate(action.target)}
              style={({ pressed }) => [
                styles.actionButton,
                action.variant === 'secondary' ? styles.actionButtonSecondary : styles.actionButtonPrimary,
                pressed ? styles.actionButtonPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  action.variant === 'secondary' ? styles.actionButtonTextSecondary : styles.actionButtonTextPrimary,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {navigation?.canGoBack?.() ? (
        <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>뒤로가기</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
