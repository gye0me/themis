import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#11192a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#22304a',
    gap: 16,
  },
  badge: {
    color: '#8fd3ff',
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#b8c2d6',
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: '#ffb5b5',
    backgroundColor: '#381d24',
    borderRadius: 16,
    padding: 14,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    color: '#d7def0',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0d1627',
    borderColor: '#29405f',
    borderWidth: 1,
    borderRadius: 16,
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#4d7cff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  linkText: {
    color: '#8fd3ff',
    fontSize: 14,
    fontWeight: '600',
  },
});
