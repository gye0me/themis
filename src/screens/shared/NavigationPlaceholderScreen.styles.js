import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    padding: 20,
    justifyContent: 'center',
    gap: 16,
  },
  card: {
    backgroundColor: '#121b2d',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#23314f',
    gap: 10,
  },
  badge: {
    color: '#8fd3ff',
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#8fd3ff',
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    color: '#b8c2d6',
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#5b7cff',
  },
  actionButtonSecondary: {
    backgroundColor: '#16243a',
    borderWidth: 1,
    borderColor: '#29405f',
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonTextPrimary: {
    color: '#ffffff',
  },
  actionButtonTextSecondary: {
    color: '#8fd3ff',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0d1627',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#29405f',
  },
  secondaryButtonText: {
    color: '#8fd3ff',
    fontSize: 14,
    fontWeight: '700',
  },
});
